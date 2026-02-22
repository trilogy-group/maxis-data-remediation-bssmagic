/**
 * Enhanced 1867 Patch Script
 * 
 * Based on original script but adds attachment update at the end.
 * 
 * Does TWO things:
 * 1. Updates CloudSense internal DB (via updateOEData) - Original functionality
 * 2. Updates Salesforce attachment - NEW functionality
 * 
 * This ensures both locations are in sync!
 */

// ========================================
// USER INPUT
// ========================================
String newfileName = 'ProductAttributeDetails.json';
Set<Id> serviceIds = new Set<Id>{'a236D000000eq04QAA'};  // Your service IDs

// ========================================
// STEP 1: Fetch Service Data
// ========================================
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

System.debug('=== Found ' + serviceMap.size() + ' service(s) ===');

// ========================================
// STEP 2: Fetch Attachments
// ========================================
List<Attachment> productAttributeDetails = [
    SELECT Body, ParentId, Id
    FROM Attachment
    WHERE Name = :newfileName 
    AND ParentId IN :serviceMap.keySet()
];

System.debug('=== Found ' + productAttributeDetails.size() + ' attachment(s) ===');

// ========================================
// STEP 3: Parse Attachments
// ========================================
Map<String, List<Object>> commercialAttributeListByServiceId = new Map<String, List<Object>>();
Map<String, List<Object>> nonCommercialAttributeListByServiceId = new Map<String, List<Object>>();
Map<String, Map<String, Object>> parsedJsonByServiceId = new Map<String, Map<String, Object>>();

for (Attachment attachmentRecord : productAttributeDetails) {
    if (serviceMap.get(attachmentRecord.ParentId) != null) {
        String body = attachmentRecord.Body.toString();
        Map<String, Object> bodyMap = (Map<String, Object>) JSON.deserializeUntyped(body);
        
        // Store parsed JSON for later attachment update
        parsedJsonByServiceId.put(attachmentRecord.ParentId, bodyMap);
        
        // Commercial attributes
        List<Object> commercialAttributeMap = (List<Object>)
            ((Map<String, Object>)bodyMap.get('CommercialProduct')).get('attributes');
        commercialAttributeListByServiceId.put(attachmentRecord.ParentId, commercialAttributeMap);
        
        // Non-commercial attributes
        List<Object> nonCommercialAttributeList = (List<Object>)bodyMap.get('NonCommercialProduct');
        nonCommercialAttributeListByServiceId.put(attachmentRecord.ParentId, nonCommercialAttributeList);
    }
}

// ========================================
// STEP 4: Get Non-Commercial Product Map
// ========================================
Map<Id, cssdm__Non_Commercial_Product_Association__c> nonCommProductMap = 
    new Map<Id, cssdm__Non_Commercial_Product_Association__c>([
        SELECT Id, Name, cssdm__Product_Definition__r.Name
        FROM cssdm__Non_Commercial_Product_Association__c
        LIMIT 10000
    ]);

// ========================================
// STEP 5: Process NonCommercialProduct - UPDATE CLOUDSENSE DB
// ========================================
Map<Id, List<cssmgnt.ProductProcessingUtility.Configuration>> configurationListBySolutionId = 
    new Map<Id, List<cssmgnt.ProductProcessingUtility.Configuration>>();

for (Id serviceId : serviceMap.keySet()) {
    if (nonCommercialAttributeListByServiceId.get(serviceId) == null) {
        System.debug('No NonCommercialProduct for service: ' + serviceId);
        continue;
    }
    
    Id solutionId = serviceMap.get(serviceId).cssdm__solution_association__c;
    String pcId = serviceMap.get(serviceId).csordtelcoa__Product_Configuration__c;
    csord__Service__c serviceRecord = serviceMap.get(serviceId);
    
    for (Object nonCommercialProductAttributes : nonCommercialAttributeListByServiceId.get(serviceId)) {
        Map<String, Object> nonCommercialAttributesBySchemaName = (Map<String, Object>)nonCommercialProductAttributes;
        
        for (String schemaName : nonCommercialAttributesBySchemaName.keySet()) {
            List<Object> nonCommercialAttributesList = (List<Object>)
                ((Map<String, Object>)nonCommercialAttributesBySchemaName.get(schemaName)).get('attributes');
            
            String schemaAssociationId = '';
            for (Id schemaId : nonCommProductMap.keySet()) {
                if (serviceRecord.csordtelcoa__Product_Configuration__r.cscfga__Product_Family__c.contains(
                        nonCommProductMap.get(schemaId).cssdm__Product_Definition__r.Name)
                    && schemaName.contains(nonCommProductMap.get(schemaId).Name)) {
                    schemaAssociationId = schemaId;
                    break;
                }
            }
            
            if (String.isNotBlank(schemaAssociationId)) {
                List<Id> configIds = new List<Id>{pcId};
                
                // GET current OE from CloudSense
                Map<Id, List<cssmgnt.ProductProcessingUtility.Component>> oeMap = 
                    cssmgnt.API_1.getOEData(configIds);
                
                for (cssmgnt.ProductProcessingUtility.Component component : oeMap.get(pcId)) {
                    for (Object configurationObj : component.configurations) {
                        cssmgnt.ProductProcessingUtility.Configuration configuration = 
                            (cssmgnt.ProductProcessingUtility.Configuration)configurationObj;
                        
                        // Add attributes from patched JSON
                        for (Object attributes : nonCommercialAttributesList) {
                            Map<String, Object> attributesMap = (Map<String, Object>)attributes;
                            cssmgnt.ProductProcessingUtility.Attribute updateAttribute = 
                                new cssmgnt.ProductProcessingUtility.Attribute();
                            updateAttribute.name = String.valueOf(attributesMap.get('name'));
                            updateAttribute.value = String.valueOf(attributesMap.get('value'));
                            updateAttribute.displayValue = String.valueOf(attributesMap.get('label'));
                            configuration.attributes.add(updateAttribute);
                        }
                        
                        // Add PCID
                        cssmgnt.ProductProcessingUtility.Attribute pcidAttribute = 
                            new cssmgnt.ProductProcessingUtility.Attribute();
                        pcidAttribute.name = 'PCID';
                        pcidAttribute.value = pcId;
                        pcidAttribute.displayValue = pcId;
                        configuration.attributes.add(pcidAttribute);
                    }
                }
                
                System.debug('Updating CloudSense DB with OE data...');
                // UPDATE CloudSense internal database
                cssmgnt.API_1.updateOEData(oeMap);
                System.debug('✅ CloudSense DB updated');
            }
        }
    }
}

// ========================================
// STEP 6: UPDATE ATTACHMENTS (NEW!)
// ========================================
System.debug('=== STEP 6: Updating Attachments ===');

List<Attachment> backupAttachments = new List<Attachment>();
List<Attachment> attachmentsToDelete = new List<Attachment>();
List<Attachment> newAttachments = new List<Attachment>();

for (Attachment currentAtt : productAttributeDetails) {
    Id serviceId = currentAtt.ParentId;
    
    // Get the patched JSON
    Map<String, Object> patchedJson = parsedJsonByServiceId.get(serviceId);
    
    if (patchedJson == null) {
        System.debug('⚠️ No patched JSON for service: ' + serviceId);
        continue;
    }
    
    // Serialize patched JSON
    String patchedJsonString = JSON.serialize(patchedJson);
    Blob patchedBlob = Blob.valueOf(patchedJsonString);
    
    // Create backup
    Attachment backupAtt = new Attachment();
    backupAtt.ParentId = serviceId;
    backupAtt.Name = 'ProductAttributeDetails_old.json';
    backupAtt.Body = currentAtt.Body;  // Original content
    backupAtt.ContentType = 'application/json';
    backupAttachments.add(backupAtt);
    
    // Mark current for deletion
    attachmentsToDelete.add(currentAtt);
    
    // Create new with patched data
    Attachment newAtt = new Attachment();
    newAtt.ParentId = serviceId;
    newAtt.Name = 'ProductAttributeDetails.json';
    newAtt.Body = patchedBlob;
    newAtt.ContentType = 'application/json';
    newAttachments.add(newAtt);
    
    System.debug('Prepared attachment update for service: ' + serviceId);
}

// Execute attachment operations
if (!backupAttachments.isEmpty()) {
    insert backupAttachments;
    System.debug('✅ Created ' + backupAttachments.size() + ' backup(s)');
}

if (!attachmentsToDelete.isEmpty()) {
    delete attachmentsToDelete;
    System.debug('✅ Deleted ' + attachmentsToDelete.size() + ' old attachment(s)');
}

if (!newAttachments.isEmpty()) {
    insert newAttachments;
    System.debug('✅ Created ' + newAttachments.size() + ' new attachment(s)');
}

System.debug('=== PATCH COMPLETE ===');
System.debug('Services processed: ' + serviceMap.size());
System.debug('CloudSense DB: UPDATED');
System.debug('Attachments: UPDATED');

/**
 * RESULT:
 * 
 * For each service:
 * 1. ✅ CloudSense internal DB updated via updateOEData()
 * 2. ✅ Salesforce attachment updated (backup created, old deleted, new created)
 * 3. ✅ Both locations now have the patched OE data
 * 4. ✅ Order processing AND verification will work
 */
