"""
1867 OE Patcher Service

Automatically patches missing OE fields by:
1. Fetching service data from Salesforce
2. Reading OE JSON from attachment
3. Identifying missing fields
4. Generating Apex script with patch logic
5. Executing via Salesforce Tooling API
"""
import json
from typing import Dict, List, Optional
from simple_salesforce import Salesforce
from app.config import settings
from app.services.apex_executor import execute_anonymous_apex
from app.services.attachment_service import fetch_attachment_for_service


def get_salesforce_connection():
    """Create authenticated Salesforce connection"""
    return Salesforce(
        username=settings.SF_USERNAME,
        password=settings.SF_PASSWORD,
        security_token=settings.SF_SECURITY_TOKEN,
        domain='test'  # 'test' for sandbox
    )


async def analyze_and_patch_service(
    service_id: str,
    dry_run: bool = False
) -> Dict:
    """
    Analyze service OE data and optionally patch missing fields.
    
    Args:
        service_id: Salesforce Service ID
        dry_run: If True, only analyze without patching
        
    Returns:
        Dict with analysis and patch results
    """
    # Step 1: Fetch attachment and analyze
    attachment_result = await fetch_attachment_for_service(service_id)
    
    if not attachment_result.get('success'):
        return {
            'success': False,
            'serviceId': service_id,
            'error': attachment_result.get('error', 'Failed to fetch attachment')
        }
    
    service_type = attachment_result.get('serviceType')
    analysis = attachment_result.get('analysis', {})
    missing_fields = analysis.get('missingFields', [])
    
    if not missing_fields:
        return {
            'success': True,
            'serviceId': service_id,
            'serviceName': attachment_result.get('serviceName'),
            'serviceType': service_type,
            'originalMissingFields': [],
            'patchedFields': [],
            'remainingMissingFields': [],
            'dryRun': dry_run,
            'apexExecuted': False,
            'message': 'No missing fields - service OE is complete'
        }
    
    # Step 2: Fetch service data to get patchable values
    sf = get_salesforce_connection()
    service_query = f"""
        SELECT 
            Id, Name, Service_Type__c,
            External_ID__c,
            Billing_Account__c,
            Billing_Account__r.Name,
            Billing_Account__r.Contact__r.Email,
            Authorized_PIC_Email__c,
            cssdm__solution_association__c,
            csordtelcoa__Product_Configuration__c,
            csordtelcoa__Product_Configuration__r.GUID__c
        FROM csord__Service__c
        WHERE Id = '{service_id}'
    """
    service_result = sf.query(service_query)
    
    if service_result['totalSize'] == 0:
        return {
            'success': False,
            'serviceId': service_id,
            'error': 'Service not found'
        }
    
    service = service_result['records'][0]
    
    # Step 3: Determine what can be patched
    patchable_fields = []
    remaining_missing = []
    warnings = []
    
    field_mapping = get_field_mapping(service_type)
    
    for field in missing_fields:
        source_field = field_mapping.get(field)
        if not source_field:
            remaining_missing.append(field)
            warnings.append(f"No Salesforce source mapping for {field}")
            continue
        
        # Get value from service
        value = get_nested_value(service, source_field['path'])
        
        if value:
            patchable_fields.append({
                'fieldName': field,
                'oldValue': None,
                'newValue': str(value),
                'source': source_field['path']
            })
        else:
            remaining_missing.append(field)
            warnings.append(f"{field}: Source field '{source_field['path']}' is NULL in Salesforce")
    
    if not patchable_fields:
        return {
            'success': False,
            'serviceId': service_id,
            'serviceName': service.get('Name'),
            'serviceType': service_type,
            'originalMissingFields': missing_fields,
            'patchedFields': [],
            'remainingMissingFields': missing_fields,
            'dryRun': dry_run,
            'apexExecuted': False,
            'error': 'No fields can be auto-patched - all source values are NULL',
            'warnings': warnings
        }
    
    # Step 4: If dry run, return analysis only
    if dry_run:
        return {
            'success': True,
            'serviceId': service_id,
            'serviceName': service.get('Name'),
            'serviceType': service_type,
            'solutionId': service.get('cssdm__solution_association__c'),
            'originalMissingFields': missing_fields,
            'patchedFields': patchable_fields,
            'remainingMissingFields': remaining_missing,
            'dryRun': True,
            'apexExecuted': False,
            'warnings': warnings
        }
    
    # Step 5: Generate and execute Apex patch script
    apex_script = generate_patch_apex_script(service_id, patchable_fields, service)
    
    try:
        result = await execute_anonymous_apex(apex_script)
        
        return {
            'success': result.get('success', False),
            'serviceId': service_id,
            'serviceName': service.get('Name'),
            'serviceType': service_type,
            'solutionId': service.get('cssdm__solution_association__c'),
            'originalMissingFields': missing_fields,
            'patchedFields': patchable_fields if result.get('success') else [],
            'remainingMissingFields': remaining_missing if result.get('success') else missing_fields,
            'dryRun': False,
            'apexExecuted': True,
            'jobId': result.get('jobId'),
            'error': result.get('error'),
            'warnings': warnings
        }
    
    except Exception as e:
        return {
            'success': False,
            'serviceId': service_id,
            'serviceName': service.get('Name'),
            'serviceType': service_type,
            'originalMissingFields': missing_fields,
            'patchedFields': [],
            'remainingMissingFields': missing_fields,
            'dryRun': False,
            'apexExecuted': False,
            'error': f'Failed to execute Apex: {str(e)}',
            'warnings': warnings
        }


def get_field_mapping(service_type: str) -> Dict:
    """
    Get Salesforce field mapping for OE fields by service type.
    
    Returns:
        Dict mapping OE field name to source info
    """
    mappings = {
        'Voice': {
            'ReservedNumber': {
                'path': 'External_ID__c',
                'description': 'External ID field on Service'
            },
            'PICEmail': {
                'path': 'Billing_Account__r.Contact__r.Email',
                'fallback': 'Authorized_PIC_Email__c',
                'description': 'Email from Billing Account Contact'
            }
        },
        'Fibre Service': {
            'BillingAccount': {
                'path': 'Billing_Account__c',
                'description': 'Billing Account ID'
            }
        },
        'eSMS Service': {
            'ReservedNumber': {
                'path': 'External_ID__c',
                'description': 'External ID field on Service'
            },
            'eSMSUserName': {
                'path': 'Billing_Account__r.Contact__r.Email',
                'description': 'Email from Billing Account Contact'
            }
        },
        'Access Service': {
            'BillingAccount': {
                'path': 'Billing_Account__c',
                'description': 'Billing Account ID'
            },
            'PICEmail': {
                'path': 'Billing_Account__r.Contact__r.Email',
                'fallback': 'Authorized_PIC_Email__c',
                'description': 'Email from Billing Account Contact'
            }
        }
    }
    
    return mappings.get(service_type, {})


def get_nested_value(obj: Dict, path: str) -> Optional[str]:
    """
    Get nested value from Salesforce record using dot notation.
    
    Example: 'Billing_Account__r.Contact__r.Email'
    """
    parts = path.split('.')
    current = obj
    
    for part in parts:
        if current is None:
            return None
        if isinstance(current, dict):
            current = current.get(part)
        else:
            return None
    
    return current if current is not None else None


def generate_patch_apex_script(
    service_id: str,
    patchable_fields: List[Dict],
    service_data: Dict
) -> str:
    """
    Generate dynamic Apex script for patching a single service.
    
    Returns:
        Complete Apex script ready to execute
    """
    service_type = service_data.get('Service_Type__c', '')
    solution_id = service_data.get('cssdm__solution_association__c', '')
    pc_guid = service_data.get('csordtelcoa__Product_Configuration__r', {}).get('GUID__c', '')
    
    # Build the patch statements
    patch_statements = []
    for field in patchable_fields:
        field_name = field['fieldName']
        new_value = field['newValue'].replace("'", "\\'")  # Escape quotes
        
        patch_statements.append(f"""
        // Patch {field_name}
        if (!attributesByName.containsKey('{field_name.lower()}')) {{
            commercialAttributes.add(new Map<String, Object>{{
                'name' => '{field_name}',
                'value' => '{new_value}',
                'label' => '{new_value}'
            }});
            System.debug('  → Patched {field_name}: {new_value}');
            wasPatched = true;
        }}
""")
    
    from datetime import datetime
    timestamp = datetime.utcnow().isoformat()
    
    apex_script = f"""
// Auto-generated 1867 Patch Script for Service: {service_id}
// Service Type: {service_type}
// Generated: {timestamp}

Set<Id> serviceIds = new Set<Id>{{'{service_id}'}};
Map<Id, csord__Service__c> serviceMap = new Map<Id, csord__Service__c>([
    SELECT Id, Name, Service_Type__c,
           cssdm__solution_association__c,
           csordtelcoa__Product_Configuration__c,
           csordtelcoa__Product_Configuration__r.GUID__c
    FROM csord__Service__c
    WHERE Id IN :serviceIds
]);

List<Attachment> attachments = [
    SELECT Id, Body, ParentId
    FROM Attachment
    WHERE Name = 'ProductAttributeDetails.json' 
    AND ParentId IN :serviceMap.keySet()
];

if (attachments.isEmpty()) {{
    System.debug('ERROR: No attachment found');
    return;
}}

Map<Id, List<cssmgnt.ProductProcessingUtility.Configuration>> configsBySolution = 
    new Map<Id, List<cssmgnt.ProductProcessingUtility.Configuration>>();

for (Attachment att : attachments) {{
    csord__Service__c service = serviceMap.get(att.ParentId);
    String bodyString = att.Body.toString();
    Map<String, Object> oeJson = (Map<String, Object>) JSON.deserializeUntyped(bodyString);
    
    Map<String, Object> commercialProduct = (Map<String, Object>) oeJson.get('CommercialProduct');
    List<Object> commercialAttributes = (List<Object>) commercialProduct.get('attributes');
    
    // Build index
    Map<String, Object> attributesByName = new Map<String, Object>();
    for (Object attrObj : commercialAttributes) {{
        Map<String, Object> attr = (Map<String, Object>) attrObj;
        String attrName = (String) attr.get('name');
        attributesByName.put(attrName.toLowerCase(), attr);
    }}
    
    Boolean wasPatched = false;
    
    // AUTO-PATCH LOGIC
{''.join(patch_statements)}
    
    if (!wasPatched) {{
        System.debug('No patches applied');
        continue;
    }}
    
    // Build configuration
    Id solutionId = service.cssdm__solution_association__c;
    String pcGUID = service.csordtelcoa__Product_Configuration__r.GUID__c;
    
    if (!configsBySolution.containsKey(solutionId)) {{
        configsBySolution.put(solutionId, new List<cssmgnt.ProductProcessingUtility.Configuration>());
    }}
    
    cssmgnt.ProductProcessingUtility.Configuration config = 
        new cssmgnt.ProductProcessingUtility.Configuration();
    config.guid = pcGUID;
    config.attributes = new List<cssmgnt.ProductProcessingUtility.Attribute>();
    
    for (Object attrObj : commercialAttributes) {{
        Map<String, Object> attrMap = (Map<String, Object>) attrObj;
        cssmgnt.ProductProcessingUtility.Attribute attr = 
            new cssmgnt.ProductProcessingUtility.Attribute();
        attr.name = (String) attrMap.get('name');
        attr.value = (String) attrMap.get('value');
        attr.displayValue = (String) attrMap.get('label');
        config.attributes.add(attr);
    }}
    
    configsBySolution.get(solutionId).add(config);
}}

// Call CloudSense API
for (Id solutionId : configsBySolution.keySet()) {{
    try {{
        new cssmgnt.API_1().updateConfigurations(solutionId, configsBySolution.get(solutionId));
        System.debug('✅ SUCCESS: Solution ' + solutionId + ' patched');
    }} catch (Exception e) {{
        System.debug('❌ ERROR: ' + e.getMessage());
    }}
}}

System.debug('=== PATCH COMPLETE ===');
"""
    
    return apex_script


async def get_service_patch_preview(service_id: str) -> Dict:
    """
    Get a preview of what will be patched without executing.
    
    Returns:
        Analysis showing missing fields, available patches, and warnings
    """
    # Fetch attachment analysis
    attachment_result = await fetch_attachment_for_service(service_id)
    
    if not attachment_result.get('success'):
        return {
            'success': False,
            'serviceId': service_id,
            'error': attachment_result.get('error')
        }
    
    analysis = attachment_result.get('analysis', {})
    missing_fields = analysis.get('missingFields', [])
    service_type = attachment_result.get('serviceType')
    
    # Fetch service to check what values are available
    sf = get_salesforce_connection()
    service_query = f"""
        SELECT 
            Id, Name, Service_Type__c,
            External_ID__c,
            Billing_Account__c,
            Billing_Account__r.Name,
            Billing_Account__r.Contact__r.Email,
            Authorized_PIC_Email__c,
            cssdm__solution_association__c
        FROM csord__Service__c
        WHERE Id = '{service_id}'
    """
    service_result = sf.query(service_query)
    service = service_result['records'][0]
    
    # Analyze what can be patched
    field_mapping = get_field_mapping(service_type)
    patchable = []
    not_patchable = []
    warnings = []
    
    for field in missing_fields:
        mapping = field_mapping.get(field)
        if not mapping:
            not_patchable.append(field)
            warnings.append(f"No mapping defined for {field}")
            continue
        
        value = get_nested_value(service, mapping['path'])
        
        # Try fallback if primary is NULL
        if not value and mapping.get('fallback'):
            value = get_nested_value(service, mapping['fallback'])
            if value:
                warnings.append(f"{field}: Using fallback field {mapping['fallback']}")
        
        if value:
            patchable.append({
                'fieldName': field,
                'newValue': str(value),
                'source': mapping['path'],
                'description': mapping.get('description', '')
            })
        else:
            not_patchable.append(field)
            warnings.append(f"{field}: Source field '{mapping['path']}' is NULL")
    
    return {
        'success': True,
        'serviceId': service_id,
        'serviceName': service.get('Name'),
        'serviceType': service_type,
        'solutionId': service.get('cssdm__solution_association__c'),
        'originalMissingFields': missing_fields,
        'patchableFields': patchable,
        'notPatchableFields': not_patchable,
        'warnings': warnings,
        'canPatch': len(patchable) > 0
    }
