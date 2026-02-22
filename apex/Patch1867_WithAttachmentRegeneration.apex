/**
 * 1867 Auto-Patch with Attachment Regeneration
 * 
 * This script replicates the manual attachment workflow:
 * 1. Read current ProductAttributeDetails.json
 * 2. Rename it to ProductAttributeDetails_old.json (backup)
 * 3. Patch OE data in memory
 * 4. Create NEW ProductAttributeDetails.json with patched data
 * 5. Call CloudSense API to sync
 * 
 * This ensures the attachment is updated with patched data!
 * 
 * Usage:
 *   1. Set serviceIds (line 24)
 *   2. Run in Anonymous Apex
 *   3. Check debug logs for results
 * 
 * Date: January 14, 2026
 * Author: Vlad Sorici (Totogi)
 */

// ========================================
// USER INPUT: Set Service IDs to Patch
// ========================================
Set<Id> serviceIds = new Set<Id>{
    'a236D000000eq06QAA'  // Replace with actual service IDs
};

// ========================================
// STEP 1: Fetch Service Records
// ========================================
System.debug('=== STEP 1: Fetching Service Records ===');
Map<Id, csord__Service__c> serviceMap = new Map<Id, csord__Service__c>([
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
    WHERE Id IN :serviceIds
]);

System.debug('Found ' + serviceMap.size() + ' service(s)');

// ========================================
// STEP 2: Fetch Current Attachments
// ========================================
System.debug('=== STEP 2: Fetching Attachments ===');
String originalAttachmentName = 'ProductAttributeDetails.json';
String backupAttachmentName = 'ProductAttributeDetails_old.json';

List<Attachment> currentAttachments = [
    SELECT Id, Body, ParentId, BodyLength, Name
    FROM Attachment
    WHERE Name = :originalAttachmentName
    AND ParentId IN :serviceMap.keySet()
];

System.debug('Found ' + currentAttachments.size() + ' attachment(s)');

if (currentAttachments.isEmpty()) {
    System.debug('ERROR: No attachments found!');
    return;
}

// ========================================
// STEP 3: Process Each Service
// ========================================
List<Attachment> backupAttachments = new List<Attachment>();
List<Attachment> newAttachments = new List<Attachment>();
Map<Id, List<cssmgnt.ProductProcessingUtility.Configuration>> configsBySolution = 
    new Map<Id, List<cssmgnt.ProductProcessingUtility.Configuration>>();

for (Attachment currentAtt : currentAttachments) {
    Id serviceId = currentAtt.ParentId;
    csord__Service__c service = serviceMap.get(serviceId);
    
    System.debug('--- Processing Service: ' + service.Name + ' (' + serviceId + ') ---');
    System.debug('Service Type: ' + service.Service_Type__c);
    
    // Parse current OE JSON
    String bodyString = currentAtt.Body.toString();
    Map<String, Object> oeJson = (Map<String, Object>) JSON.deserializeUntyped(bodyString);
    
    // Extract commercial attributes
    Map<String, Object> commercialProduct = (Map<String, Object>) oeJson.get('CommercialProduct');
    List<Object> commercialAttributes = (List<Object>) commercialProduct.get('attributes');
    
    System.debug('Original attributes count: ' + commercialAttributes.size());
    
    // Build attribute index
    Map<String, Object> attributesByName = new Map<String, Object>();
    for (Object attrObj : commercialAttributes) {
        Map<String, Object> attr = (Map<String, Object>) attrObj;
        String attrName = ((String) attr.get('name')).toLowerCase();
        attributesByName.put(attrName, attr);
    }
    
    Boolean wasPatched = false;
    
    // ========================================
    // AUTO-PATCH BY SERVICE TYPE
    // ========================================
    
    if (service.Service_Type__c == 'Voice') {
        // Patch ReservedNumber
        if (!attributesByName.containsKey('reservednumber') && String.isNotBlank(service.External_ID__c)) {
            commercialAttributes.add(new Map<String, Object>{
                'name' => 'ReservedNumber',
                'value' => service.External_ID__c,
                'label' => service.External_ID__c
            });
            System.debug('  → Patched ReservedNumber: ' + service.External_ID__c);
            wasPatched = true;
        }
        
        // Patch PICEmail
        String picEmail = service.Billing_Account__r?.Contact__r?.Email;
        if (String.isBlank(picEmail)) picEmail = service.Authorized_PIC_Email__c;
        
        if (!attributesByName.containsKey('picemail') && String.isNotBlank(picEmail)) {
            commercialAttributes.add(new Map<String, Object>{
                'name' => 'PICEmail',
                'value' => picEmail,
                'label' => picEmail
            });
            System.debug('  → Patched PICEmail: ' + picEmail);
            wasPatched = true;
        }
    }
    
    else if (service.Service_Type__c == 'Fibre Service') {
        // Patch BillingAccount
        if (!attributesByName.containsKey('billingaccount') && String.isNotBlank(service.Billing_Account__c)) {
            commercialAttributes.add(new Map<String, Object>{
                'name' => 'BillingAccount',
                'value' => service.Billing_Account__c,
                'label' => service.Billing_Account__r?.Name
            });
            System.debug('  → Patched BillingAccount: ' + service.Billing_Account__c);
            wasPatched = true;
        }
    }
    
    else if (service.Service_Type__c == 'eSMS Service') {
        // Patch ReservedNumber
        if (!attributesByName.containsKey('reservednumber') && String.isNotBlank(service.External_ID__c)) {
            commercialAttributes.add(new Map<String, Object>{
                'name' => 'ReservedNumber',
                'value' => service.External_ID__c,
                'label' => service.External_ID__c
            });
            wasPatched = true;
        }
        
        // Patch eSMSUserName
        String esmsUser = service.Billing_Account__r?.Contact__r?.Email;
        if (!attributesByName.containsKey('esmsusername') && String.isNotBlank(esmsUser)) {
            commercialAttributes.add(new Map<String, Object>{
                'name' => 'eSMSUserName',
                'value' => esmsUser,
                'label' => esmsUser
            });
            wasPatched = true;
        }
    }
    
    else if (service.Service_Type__c == 'Access Service') {
        // Patch BillingAccount
        if (!attributesByName.containsKey('billingaccount') && String.isNotBlank(service.Billing_Account__c)) {
            commercialAttributes.add(new Map<String, Object>{
                'name' => 'BillingAccount',
                'value' => service.Billing_Account__c,
                'label' => service.Billing_Account__r?.Name
            });
            wasPatched = true;
        }
        
        // Patch PICEmail
        String picEmail = service.Billing_Account__r?.Contact__r?.Email;
        if (String.isBlank(picEmail)) picEmail = service.Authorized_PIC_Email__c;
        
        if (!attributesByName.containsKey('picemail') && String.isNotBlank(picEmail)) {
            commercialAttributes.add(new Map<String, Object>{
                'name' => 'PICEmail',
                'value' => picEmail,
                'label' => picEmail
            });
            wasPatched = true;
        }
    }
    
    if (!wasPatched) {
        System.debug('  ℹ️ No patches needed for this service');
        continue;
    }
    
    System.debug('Patched attributes count: ' + commercialAttributes.size());
    
    // ========================================
    // STEP 4: Update OE JSON with Patched Data
    // ========================================
    
    // Put patched attributes back into the JSON structure
    commercialProduct.put('attributes', commercialAttributes);
    oeJson.put('CommercialProduct', commercialProduct);
    
    // Serialize patched JSON
    String patchedJson = JSON.serialize(oeJson);
    Blob patchedBlob = Blob.valueOf(patchedJson);
    
    System.debug('Patched JSON size: ' + patchedJson.length() + ' bytes');
    
    // ========================================
    // STEP 5: Backup Old Attachment (Rename to _old)
    // ========================================
    
    // Create backup by cloning current attachment with new name
    Attachment backupAtt = new Attachment();
    backupAtt.ParentId = currentAtt.ParentId;
    backupAtt.Name = backupAttachmentName;  // ProductAttributeDetails_old.json
    backupAtt.Body = currentAtt.Body;  // Original (unpatched) content
    backupAtt.ContentType = 'application/json';
    backupAttachments.add(backupAtt);
    
    System.debug('  → Created backup: ' + backupAttachmentName);
    
    // ========================================
    // STEP 6: Create New Attachment with Patched Data
    // ========================================
    
    Attachment newAtt = new Attachment();
    newAtt.ParentId = serviceId;
    newAtt.Name = originalAttachmentName;  // ProductAttributeDetails.json
    newAtt.Body = patchedBlob;  // PATCHED content
    newAtt.ContentType = 'application/json';
    newAttachments.add(newAtt);
    
    System.debug('  → Created new attachment with patched data');
    
    // ========================================
    // STEP 7: Build CloudSense Configuration (for sync)
    // ========================================
    
    Id solutionId = service.cssdm__solution_association__c;
    String pcGUID = service.csordtelcoa__Product_Configuration__r.GUID__c;
    
    if (!configsBySolution.containsKey(solutionId)) {
        configsBySolution.put(solutionId, new List<cssmgnt.ProductProcessingUtility.Configuration>());
    }
    
    cssmgnt.ProductProcessingUtility.Configuration config = 
        new cssmgnt.ProductProcessingUtility.Configuration();
    config.guid = pcGUID;
    config.attributes = new List<cssmgnt.ProductProcessingUtility.Attribute>();
    
    for (Object attrObj : commercialAttributes) {
        Map<String, Object> attrMap = (Map<String, Object>) attrObj;
        cssmgnt.ProductProcessingUtility.Attribute attr = 
            new cssmgnt.ProductProcessingUtility.Attribute();
        attr.name = (String) attrMap.get('name');
        attr.value = String.valueOf(attrMap.get('value'));
        attr.displayValue = String.valueOf(attrMap.get('label'));
        config.attributes.add(attr);
    }
    
    configsBySolution.get(solutionId).add(config);
}

// ========================================
// STEP 8: Save Backup Attachments
// ========================================
System.debug('=== STEP 8: Saving Backup Attachments ===');
try {
    insert backupAttachments;
    System.debug('✅ Saved ' + backupAttachments.size() + ' backup(s)');
} catch (Exception e) {
    System.debug('⚠️ Backup save warning: ' + e.getMessage());
}

// ========================================
// STEP 9: Delete Old Attachments
// ========================================
System.debug('=== STEP 9: Deleting Old Attachments ===');
try {
    delete currentAttachments;
    System.debug('✅ Deleted ' + currentAttachments.size() + ' old attachment(s)');
} catch (Exception e) {
    System.debug('❌ ERROR deleting old attachments: ' + e.getMessage());
    return;  // Don't continue if we can't delete old ones
}

// ========================================
// STEP 10: Insert New Attachments
// ========================================
System.debug('=== STEP 10: Inserting New Attachments ===');
try {
    insert newAttachments;
    System.debug('✅ Inserted ' + newAttachments.size() + ' new attachment(s)');
} catch (Exception e) {
    System.debug('❌ ERROR inserting new attachments: ' + e.getMessage());
    return;
}

// ========================================
// STEP 11: Call CloudSense API to Sync
// ========================================
System.debug('=== STEP 11: Syncing with CloudSense API ===');

for (Id solutionId : configsBySolution.keySet()) {
    try {
        new cssmgnt.API_1().updateConfigurations(solutionId, configsBySolution.get(solutionId));
        System.debug('✅ SUCCESS: Solution ' + solutionId + ' synced');
    } catch (Exception e) {
        System.debug('❌ ERROR syncing solution ' + solutionId + ': ' + e.getMessage());
    }
}

System.debug('=== PATCH COMPLETE ===');
System.debug('Total services processed: ' + serviceMap.size());
System.debug('Backups created: ' + backupAttachments.size());
System.debug('New attachments created: ' + newAttachments.size());

/**
 * EXPECTED OUTCOME:
 * 
 * For service a236D000000eq06QAA:
 * 
 * BEFORE:
 *   Attachments:
 *     - ProductAttributeDetails.json (LastModified: 2025-12-16)
 *       Content: Missing BillingAccount field
 * 
 * AFTER:
 *   Attachments:
 *     - ProductAttributeDetails_old.json (backup of original)
 *     - ProductAttributeDetails.json (NEW, LastModified: TODAY)
 *       Content: Has BillingAccount: a386D000000BaTWQA0
 * 
 * Verification:
 *   1. Query attachment: LastModifiedDate should be TODAY
 *   2. Fetch via gateway: Should show 0 missing fields
 *   3. TMF API: x_has1867Issue should be false
 */
