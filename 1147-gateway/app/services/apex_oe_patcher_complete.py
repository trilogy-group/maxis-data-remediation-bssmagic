"""
Complete Apex OE Patcher

Generates and executes enhanced Apex script that updates BOTH:
1. CloudSense internal DB (via updateOEData API)
2. Salesforce attachment (via DML operations)

This is based on the original "1867 - Partial Data Missing - Patch Apex Script.txt"
but enhanced to also update the attachment.
"""
from typing import List, Dict
from app.services.apex_executor import execute_anonymous_apex


async def generate_and_execute_complete_patch_apex(
    service_id: str,
    fields_to_patch: List[Dict]
) -> Dict:
    """
    Generate and execute Apex script that updates both CloudSense DB and attachment.
    
    Args:
        service_id: Salesforce Service ID
        fields_to_patch: List of {fieldName, value, label}
        
    Returns:
        Dict with execution results
    """
    
    # ENRICH empty fields before generating Apex
    from simple_salesforce import Salesforce
    from app.config import settings
    
    sf = Salesforce(
        username=settings.SF_USERNAME,
        password=settings.SF_PASSWORD,
        security_token=settings.SF_SECURITY_TOKEN,
        domain='test'
    )
    
    # Fetch service data for enrichment
    service_query = f"""
        SELECT 
            External_ID__c,
            Billing_Account__c,
            Billing_Account__r.Name,
            Billing_Account__r.Contact__r.Email,
            Authorized_PIC_Email__c
        FROM csord__Service__c
        WHERE Id = '{service_id}'
        LIMIT 1
    """
    service_result = sf.query(service_query)
    
    if service_result['totalSize'] == 0:
        return {'success': False, 'error': f'Service not found: {service_id}'}
    
    service_data = service_result['records'][0]
    
    # Enrich fields
    print(f"  Enriching {len(fields_to_patch)} field(s) from Salesforce...")
    enriched_fields = []
    for field in fields_to_patch:
        enriched_field = dict(field)
        field_name = field['fieldName']
        field_value = field.get('value', '').strip()
        
        print(f"    Field: {field_name}, Value: '{field_value}'")
        
        # Enrich if empty
        if not field_value:
            print(f"      Value is empty, enriching from Salesforce...")
            if field_name == 'ReservedNumber':
                enriched_field['value'] = service_data.get('External_ID__c') or ''
                enriched_field['label'] = enriched_field['value']
            elif field_name == 'PICEmail':
                email = service_data.get('Billing_Account__r', {}).get('Contact__r', {}).get('Email')
                if not email:
                    email = service_data.get('Authorized_PIC_Email__c')
                enriched_field['value'] = email or ''
                enriched_field['label'] = email or ''
                print(f"      ✅ Enriched PICEmail: {email}")
            elif field_name == 'BillingAccount':
                ba_id = service_data.get('Billing_Account__c')
                ba_name = service_data.get('Billing_Account__r', {}).get('Name')
                enriched_field['value'] = ba_id or ''
                enriched_field['label'] = ba_name or ba_id or ''
        
        # Only add if we have a value
        if enriched_field.get('value'):
            enriched_fields.append(enriched_field)
            print(f"      ✅ Field added: {field_name} = {enriched_field['value']}")
        else:
            print(f"      ⚠️ Field skipped (no value): {field_name}")
    
    fields_to_patch = enriched_fields
    print(f"  Total fields after enrichment: {len(fields_to_patch)}")
    
    # Build Apex code to inject patch fields
    patch_fields_code = []
    for field in fields_to_patch:
        field_name = field['fieldName']
        # Map to OE field name (with spaces if needed)
        oe_field_name = 'Billing Account' if field_name == 'BillingAccount' else field_name
        oe_field_name = 'PIC Email' if field_name == 'PICEmail' else oe_field_name
        
        value = field['value'].replace("'", "\\'")  # Escape quotes
        label = field.get('label', value).replace("'", "\\'") if field.get('label') else value
        
        patch_fields_code.append(f"""
                        // Add {field_name} to CloudSense Configuration
                        cssmgnt.ProductProcessingUtility.Attribute {field_name.lower()}Attr = 
                            new cssmgnt.ProductProcessingUtility.Attribute();
                        {field_name.lower()}Attr.name = '{oe_field_name}';
                        {field_name.lower()}Attr.value = '{value}';
                        {field_name.lower()}Attr.displayValue = '{label}';
                        configuration.attributes.add({field_name.lower()}Attr);
                        System.debug('  → Added {oe_field_name}: {value}');
""")
    
    patches_code = ''.join(patch_fields_code)
    
    # Build Apex code to populate patchFieldsMap for JSON patching
    json_patch_code = []
    for field in fields_to_patch:
        field_name = field['fieldName']
        # Map to OE field name (with spaces if needed)
        oe_field_name = 'Billing Account' if field_name == 'BillingAccount' else field_name
        oe_field_name = 'PIC Email' if field_name == 'PICEmail' else oe_field_name
        
        value = field['value'].replace("'", "\\'")
        label = field.get('label', value).replace("'", "\\'") if field.get('label') else value
        
        json_patch_code.append(f"""patchFieldsMap.put('{oe_field_name}', new Map<String, String>{{'value' => '{value}', 'displayValue' => '{label}'}});
""")
    
    patches_code_for_json = ''.join(json_patch_code)
    
    # Generate the enhanced Apex script
    apex_script = f"""
// Enhanced 1867 Patch Script - Updates CloudSense DB + Attachment
// Service: {service_id}
// Fields to patch: {', '.join(f['fieldName'] for f in fields_to_patch)}

String newfileName = 'ProductAttributeDetails.json';
Set<Id> serviceIds = new Set<Id>{{'{service_id}'}};

// Fetch service data
Map<Id, csord__Service__c> serviceMap = new Map<Id, csord__Service__c>([
    SELECT
        Id,
        cssdm__solution_association__c,
        cssdm__solution_association__r.Is_Configuration_Updated_To_Heroku__c,
        csordtelcoa__Product_Configuration__c,
        csordtelcoa__Product_Configuration__r.GUID__c,
        csordtelcoa__Product_Configuration__r.cscfga__Product_Definition__r.Name,
        csordtelcoa__Product_Configuration__r.cscfga__Product_Family__c
    FROM csord__Service__c
    WHERE Id IN :serviceIds
]);

// Fetch attachments
List<Attachment> productAttributeDetails = [
    SELECT Body, ParentId, Id
    FROM Attachment
    WHERE Name = :newfileName 
    AND ParentId IN :serviceMap.keySet()
];

// Parse attachments
Map<String, List<Object>> nonCommercialAttributeListByServiceId = new Map<String, List<Object>>();
Map<String, Map<String, Object>> parsedJsonByServiceId = new Map<String, Map<String, Object>>();

for (Attachment attachmentRecord : productAttributeDetails) {{
    if (serviceMap.get(attachmentRecord.ParentId) != null) {{
        String body = attachmentRecord.Body.toString();
        Map<String, Object> bodyMap = (Map<String, Object>) JSON.deserializeUntyped(body);
        
        parsedJsonByServiceId.put(attachmentRecord.ParentId, bodyMap);
        
        List<Object> nonCommercialAttributeList = (List<Object>)bodyMap.get('NonCommercialProduct');
        nonCommercialAttributeListByServiceId.put(attachmentRecord.ParentId, nonCommercialAttributeList);
    }}
}}

// Get Non-Commercial Product Map
Map<Id, cssdm__Non_Commercial_Product_Association__c> nonCommProductMap = 
    new Map<Id, cssdm__Non_Commercial_Product_Association__c>([
        SELECT Id, Name, cssdm__Product_Definition__r.Name
        FROM cssdm__Non_Commercial_Product_Association__c
        LIMIT 10000
    ]);

// =====================================
// PART 1: UPDATE CLOUDSENSE DB
// =====================================
System.debug('=== PART 1: Updating CloudSense Internal DB ===');

for (Id serviceId : serviceMap.keySet()) {{
    if (nonCommercialAttributeListByServiceId.get(serviceId) == null) {{
        continue;
    }}
    
    String pcId = serviceMap.get(serviceId).csordtelcoa__Product_Configuration__c;
    csord__Service__c serviceRecord = serviceMap.get(serviceId);
    
    // Null safety checks for nested objects
    if (pcId == null) {{
        System.debug('⚠️ Service ' + serviceId + ' has no Product Configuration - skipping DB update');
        continue;
    }}
    
    String productFamily = null;
    if (serviceRecord.csordtelcoa__Product_Configuration__r != null) {{
        productFamily = serviceRecord.csordtelcoa__Product_Configuration__r.cscfga__Product_Family__c;
    }}
    
    for (Object nonCommercialProductAttributes : nonCommercialAttributeListByServiceId.get(serviceId)) {{
        Map<String, Object> nonCommercialAttributesBySchemaName = (Map<String, Object>)nonCommercialProductAttributes;
        
        for (String schemaName : nonCommercialAttributesBySchemaName.keySet()) {{
            List<Object> nonCommercialAttributesList = (List<Object>)
                ((Map<String, Object>)nonCommercialAttributesBySchemaName.get(schemaName)).get('attributes');
            
            String schemaAssociationId = '';
            for (Id schemaId : nonCommProductMap.keySet()) {{
                cssdm__Non_Commercial_Product_Association__c ncpa = nonCommProductMap.get(schemaId);
                String productDefName = (ncpa.cssdm__Product_Definition__r != null) 
                    ? ncpa.cssdm__Product_Definition__r.Name : null;
                
                // Only match if we have valid data
                if (productFamily != null && productDefName != null 
                    && productFamily.contains(productDefName)
                    && schemaName.contains(ncpa.Name)) {{
                    schemaAssociationId = schemaId;
                    break;
                }}
            }}
            
            if (String.isNotBlank(schemaAssociationId)) {{
                List<Id> configIds = new List<Id>{{pcId}};
                
                // GET current OE from CloudSense internal DB
                Map<Id, List<cssmgnt.ProductProcessingUtility.Component>> oeMap = 
                    cssmgnt.API_1.getOEData(configIds);
                
                System.debug('Got OE from CloudSense DB for PC: ' + pcId);
                
                // Patch the OE data
                for (cssmgnt.ProductProcessingUtility.Component component : oeMap.get(pcId)) {{
                    System.debug('Processing component: ' + component.name);
                    
                    for (Object configurationObj : component.configurations) {{
                        cssmgnt.ProductProcessingUtility.Configuration configuration = 
                            (cssmgnt.ProductProcessingUtility.Configuration)configurationObj;
                        
                        System.debug('Configuration GUID: ' + configuration.guid);
                        System.debug('Original attributes: ' + configuration.attributes.size());
                        
                        // INJECT PATCH FIELDS directly to CloudSense Configuration
{patches_code}
                        
                        // Add PCID
                        cssmgnt.ProductProcessingUtility.Attribute pcidAttr = 
                            new cssmgnt.ProductProcessingUtility.Attribute();
                        pcidAttr.name = 'PCID';
                        pcidAttr.value = pcId;
                        pcidAttr.displayValue = pcId;
                        configuration.attributes.add(pcidAttr);
                        
                        System.debug('Patched attributes: ' + configuration.attributes.size());
                    }}
                }}
                
                // UPDATE CloudSense internal database
                System.debug('Calling updateOEData()...');
                cssmgnt.API_1.updateOEData(oeMap);
                System.debug('✅ CloudSense DB updated for schema: ' + schemaName);
            }}
        }}
    }}
}}

// =====================================
// PART 2: UPDATE ATTACHMENTS
// =====================================
System.debug('=== PART 2: Updating Attachments ===');

// Patch fields to add to JSON
Map<String, Map<String, String>> patchFieldsMap = new Map<String, Map<String, String>>();
{patches_code_for_json}

List<Attachment> backupAttachments = new List<Attachment>();
List<Attachment> newAttachments = new List<Attachment>();

for (Attachment currentAtt : productAttributeDetails) {{
    Id serviceId = currentAtt.ParentId;
    Map<String, Object> patchedJson = parsedJsonByServiceId.get(serviceId);
    
    if (patchedJson == null) {{
        continue;
    }}
    
    // Patch the JSON with new field values
    List<Object> nonCommProducts = (List<Object>)patchedJson.get('NonCommercialProduct');
    if (nonCommProducts != null) {{
        for (Object ncpObj : nonCommProducts) {{
            Map<String, Object> ncpMap = (Map<String, Object>)ncpObj;
            for (String schemaKey : ncpMap.keySet()) {{
                Map<String, Object> schemaData = (Map<String, Object>)ncpMap.get(schemaKey);
                List<Object> attrs = (List<Object>)schemaData.get('attributes');
                if (attrs != null) {{
                    for (String fieldName : patchFieldsMap.keySet()) {{
                        Map<String, String> fieldData = patchFieldsMap.get(fieldName);
                        // Find existing attr or add new
                        Boolean found = false;
                        for (Object attrObj : attrs) {{
                            Map<String, Object> attr = (Map<String, Object>)attrObj;
                            if (attr.get('name') == fieldName) {{
                                attr.put('value', fieldData.get('value'));
                                attr.put('displayValue', fieldData.get('displayValue'));
                                found = true;
                                System.debug('✅ Updated ' + fieldName + ' in JSON: ' + fieldData.get('value'));
                                break;
                            }}
                        }}
                        if (!found) {{
                            // Add new attribute
                            Map<String, Object> newAttr = new Map<String, Object>();
                            newAttr.put('name', fieldName);
                            newAttr.put('value', fieldData.get('value'));
                            newAttr.put('displayValue', fieldData.get('displayValue'));
                            attrs.add(newAttr);
                            System.debug('✅ Added ' + fieldName + ' to JSON: ' + fieldData.get('value'));
                        }}
                    }}
                }}
            }}
        }}
    }}
    
    // Create backup
    Attachment backupAtt = new Attachment();
    backupAtt.ParentId = serviceId;
    backupAtt.Name = 'ProductAttributeDetails_old.json';
    backupAtt.Body = currentAtt.Body;
    backupAtt.ContentType = 'application/json';
    backupAttachments.add(backupAtt);
    
    // Create new with patched data
    Attachment newAtt = new Attachment();
    newAtt.ParentId = serviceId;
    newAtt.Name = 'ProductAttributeDetails.json';
    newAtt.Body = Blob.valueOf(JSON.serialize(patchedJson));
    newAtt.ContentType = 'application/json';
    newAttachments.add(newAtt);
}}

// Execute attachment operations
if (!backupAttachments.isEmpty()) {{
    insert backupAttachments;
    System.debug('✅ Backups created: ' + backupAttachments.size());
}}

if (!productAttributeDetails.isEmpty()) {{
    delete productAttributeDetails;
    System.debug('✅ Old attachments deleted: ' + productAttributeDetails.size());
}}

if (!newAttachments.isEmpty()) {{
    insert newAttachments;
    System.debug('✅ New attachments created: ' + newAttachments.size());
}}

System.debug('=== COMPLETE: Both CloudSense DB and Attachments Updated ===');
"""
    
    # Execute the Apex script
    try:
        result = await execute_anonymous_apex(apex_script)
        
        # Return enriched fields (not original empty ones!)
        enriched_fields_summary = [
            {
                'fieldName': f['fieldName'],
                'value': f['value'],
                'label': f.get('label', f['value'])
            }
            for f in fields_to_patch
        ]
        
        return {
            'success': result.get('success', False),
            'serviceId': service_id,
            'patchedFields': enriched_fields_summary,  # Return enriched fields
            'cloudsenseDBUpdated': result.get('success', False),
            'attachmentUpdated': result.get('success', False),
            'jobId': result.get('jobId'),
            'output': result.get('output'),
            'error': result.get('error')
        }
    
    except Exception as e:
        return {
            'success': False,
            'serviceId': service_id,
            'error': f'Failed to execute Apex: {str(e)}'
        }
