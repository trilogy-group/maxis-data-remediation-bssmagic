/**
 * 1867 Auto-Patch Script
 * 
 * Automatically patches missing OE fields for migrated services by:
 * 1. Reading ProductAttributeDetails.json attachment
 * 2. Identifying missing mandatory OE fields
 * 3. Fetching correct values from Salesforce
 * 4. Patching OE data directly (no manual attachment editing!)
 * 5. Calling CloudSense API to update OE
 * 
 * Usage:
 *   1. Set serviceIds (line 23)
 *   2. Run in Anonymous Apex
 *   3. Check debug logs for results
 * 
 * Date: January 14, 2026
 * Author: Vlad Sorici (Totogi)
 * Project: Maxis BSS Magic - 1867 OE Patcher
 */

// ========================================
// USER INPUT: Set Service IDs to Patch
// ========================================
Set<Id> serviceIds = new Set<Id>{
    'a236D000000eq04QAA'  // Replace with actual service IDs from TMF API
};

// ========================================
// STEP 1: Fetch Service Records with Related Data
// ========================================
System.debug('=== STEP 1: Fetching Service Records ===');
Map<Id, csord__Service__c> serviceMap = new Map<Id, csord__Service__c>([
    SELECT
        Id,
        Name,
        Service_Type__c,
        External_ID__c,
        Billing_Account__c,
        Billing_Account__r.Name,
        Billing_Account__r.Contact__c,
        Billing_Account__r.Contact__r.Email,
        cssdm__solution_association__c,
        cssdm__solution_association__r.Is_Configuration_Updated_To_Heroku__c,
        csordtelcoa__Product_Configuration__c,
        csordtelcoa__Product_Configuration__r.GUID__c,
        csordtelcoa__Product_Configuration__r.cscfga__Product_Definition__r.Name,
        csordtelcoa__Product_Configuration__r.cscfga__Product_Family__c,
        Migrated_Data__c,
        Migrated_To_Heroku__c,
        Authorized_PIC_Email__c
    FROM
        csord__Service__c
    WHERE
        Id IN :serviceIds
]);

System.debug('Found ' + serviceMap.size() + ' service(s)');

if (serviceMap.isEmpty()) {
    System.debug('ERROR: No services found!');
    return;
}

// ========================================
// STEP 2: Fetch Attachments
// ========================================
System.debug('=== STEP 2: Fetching Attachments ===');
String attachmentName = 'ProductAttributeDetails.json';
List<Attachment> attachments = [
    SELECT
        Id,
        Body,
        ParentId,
        BodyLength
    FROM
        Attachment
    WHERE
        Name = :attachmentName 
        AND ParentId IN :serviceMap.keySet()
];

System.debug('Found ' + attachments.size() + ' attachment(s)');

if (attachments.isEmpty()) {
    System.debug('ERROR: No attachments found for these services!');
    return;
}

// ========================================
// STEP 3: Parse OE JSON and Auto-Patch
// ========================================
System.debug('=== STEP 3: Parsing & Patching OE Data ===');

Map<Id, List<cssmgnt.ProductProcessingUtility.Configuration>> configurationsBySolutionId = 
    new Map<Id, List<cssmgnt.ProductProcessingUtility.Configuration>>();

for (Attachment att : attachments) {
    Id serviceId = att.ParentId;
    csord__Service__c service = serviceMap.get(serviceId);
    
    if (service == null) {
        System.debug('ERROR: Service not found for attachment: ' + serviceId);
        continue;
    }
    
    System.debug('--- Processing Service: ' + service.Name + ' (' + serviceId + ') ---');
    System.debug('Service Type: ' + service.Service_Type__c);
    System.debug('Migrated Data: ' + service.Migrated_Data__c);
    
    // Parse OE JSON from attachment
    String bodyString = att.Body.toString();
    Map<String, Object> oeJson = (Map<String, Object>) JSON.deserializeUntyped(bodyString);
    
    // Extract commercial product attributes
    Map<String, Object> commercialProduct = (Map<String, Object>) oeJson.get('CommercialProduct');
    List<Object> commercialAttributes = (List<Object>) commercialProduct.get('attributes');
    
    System.debug('Original commercial attributes count: ' + commercialAttributes.size());
    
    // ========================================
    // AUTO-PATCH: Add Missing Mandatory Fields
    // ========================================
    Boolean wasPatched = false;
    
    // Convert to mutable map for easier manipulation
    Map<String, Object> attributesByName = new Map<String, Object>();
    for (Object attrObj : commercialAttributes) {
        Map<String, Object> attr = (Map<String, Object>) attrObj;
        String attrName = (String) attr.get('name');
        attributesByName.put(attrName.toLowerCase(), attr);
    }
    
    // --- Patch Logic by Service Type ---
    
    if (service.Service_Type__c == 'Voice') {
        System.debug('Patching Voice service...');
        
        // 1. ReservedNumber (from External_ID__c)
        if (!attributesByName.containsKey('reservednumber') || String.isBlank((String)((Map<String, Object>)attributesByName.get('reservednumber')).get('value'))) {
            if (String.isNotBlank(service.External_ID__c)) {
                System.debug('  → Patching ReservedNumber: ' + service.External_ID__c);
                commercialAttributes.add(new Map<String, Object>{
                    'name' => 'ReservedNumber',
                    'value' => service.External_ID__c,
                    'label' => service.External_ID__c
                });
                wasPatched = true;
            }
        }
        
        // 2. PIC Email (from Billing_Account__r.Contact__r.Email)
        if (!attributesByName.containsKey('picemail') || String.isBlank((String)((Map<String, Object>)attributesByName.get('picemail')).get('value'))) {
            String picEmail = service.Billing_Account__r?.Contact__r?.Email;
            if (String.isBlank(picEmail)) {
                picEmail = service.Authorized_PIC_Email__c; // Fallback
            }
            if (String.isNotBlank(picEmail)) {
                System.debug('  → Patching PICEmail: ' + picEmail);
                commercialAttributes.add(new Map<String, Object>{
                    'name' => 'PICEmail',
                    'value' => picEmail,
                    'label' => picEmail
                });
                wasPatched = true;
            }
        }
        
        // 3. ResourceSystemGroupID (if needed - check with Ashish for source)
        if (!attributesByName.containsKey('resourcesystemgroupid') || String.isBlank((String)((Map<String, Object>)attributesByName.get('resourcesystemgroupid')).get('value'))) {
            System.debug('  ⚠️ ResourceSystemGroupID missing - no Salesforce source field identified');
        }
        
        // 4. NumberStatus (if needed - check with Ashish for source)
        if (!attributesByName.containsKey('numberstatus') || String.isBlank((String)((Map<String, Object>)attributesByName.get('numberstatus')).get('value'))) {
            System.debug('  ⚠️ NumberStatus missing - no Salesforce source field identified');
        }
    }
    
    else if (service.Service_Type__c == 'Fibre Service') {
        System.debug('Patching Fibre Service...');
        
        // BillingAccount (from Billing_Account__c)
        if (!attributesByName.containsKey('billingaccount') || String.isBlank((String)((Map<String, Object>)attributesByName.get('billingaccount')).get('value'))) {
            if (String.isNotBlank(service.Billing_Account__c)) {
                System.debug('  → Patching BillingAccount: ' + service.Billing_Account__c);
                commercialAttributes.add(new Map<String, Object>{
                    'name' => 'BillingAccount',
                    'value' => service.Billing_Account__c,
                    'label' => service.Billing_Account__r?.Name
                });
                wasPatched = true;
            }
        }
    }
    
    else if (service.Service_Type__c == 'eSMS Service') {
        System.debug('Patching eSMS Service...');
        
        // 1. ReservedNumber (from External_ID__c)
        if (!attributesByName.containsKey('reservednumber') || String.isBlank((String)((Map<String, Object>)attributesByName.get('reservednumber')).get('value'))) {
            if (String.isNotBlank(service.External_ID__c)) {
                System.debug('  → Patching ReservedNumber: ' + service.External_ID__c);
                commercialAttributes.add(new Map<String, Object>{
                    'name' => 'ReservedNumber',
                    'value' => service.External_ID__c,
                    'label' => service.External_ID__c
                });
                wasPatched = true;
            }
        }
        
        // 2. eSMSUserName (from Contact Email - confirmation needed with Ashish)
        if (!attributesByName.containsKey('esmsusername') || String.isBlank((String)((Map<String, Object>)attributesByName.get('esmsusername')).get('value'))) {
            String esmsUser = service.Billing_Account__r?.Contact__r?.Email;
            if (String.isNotBlank(esmsUser)) {
                System.debug('  → Patching eSMSUserName: ' + esmsUser);
                commercialAttributes.add(new Map<String, Object>{
                    'name' => 'eSMSUserName',
                    'value' => esmsUser,
                    'label' => esmsUser
                });
                wasPatched = true;
            }
        }
    }
    
    else if (service.Service_Type__c == 'Access Service') {
        System.debug('Patching Access Service...');
        
        // 1. BillingAccount (from Billing_Account__c)
        if (!attributesByName.containsKey('billingaccount') || String.isBlank((String)((Map<String, Object>)attributesByName.get('billingaccount')).get('value'))) {
            if (String.isNotBlank(service.Billing_Account__c)) {
                System.debug('  → Patching BillingAccount: ' + service.Billing_Account__c);
                commercialAttributes.add(new Map<String, Object>{
                    'name' => 'BillingAccount',
                    'value' => service.Billing_Account__c,
                    'label' => service.Billing_Account__r?.Name
                });
                wasPatched = true;
            }
        }
        
        // 2. PIC Email (from Billing_Account__r.Contact__r.Email)
        if (!attributesByName.containsKey('picemail') || String.isBlank((String)((Map<String, Object>)attributesByName.get('picemail')).get('value'))) {
            String picEmail = service.Billing_Account__r?.Contact__r?.Email;
            if (String.isBlank(picEmail)) {
                picEmail = service.Authorized_PIC_Email__c; // Fallback
            }
            if (String.isNotBlank(picEmail)) {
                System.debug('  → Patching PICEmail: ' + picEmail);
                commercialAttributes.add(new Map<String, Object>{
                    'name' => 'PICEmail',
                    'value' => picEmail,
                    'label' => picEmail
                });
                wasPatched = true;
            }
        }
    }
    
    if (!wasPatched) {
        System.debug('  ℹ️ No patches needed - all mandatory fields present');
        continue;
    }
    
    System.debug('Patched attributes count: ' + commercialAttributes.size());
    
    // ========================================
    // STEP 4: Build Configuration Object for CloudSense API
    // ========================================
    Id solutionId = service.cssdm__solution_association__c;
    String pcGUID = service.csordtelcoa__Product_Configuration__r.GUID__c;
    
    if (String.isBlank(solutionId) || String.isBlank(pcGUID)) {
        System.debug('ERROR: Missing solutionId or PC GUID for service: ' + serviceId);
        continue;
    }
    
    // Initialize configuration list for this solution
    if (!configurationsBySolutionId.containsKey(solutionId)) {
        configurationsBySolutionId.put(
            solutionId, 
            new List<cssmgnt.ProductProcessingUtility.Configuration>()
        );
    }
    
    // Build Configuration object
    cssmgnt.ProductProcessingUtility.Configuration configuration = 
        new cssmgnt.ProductProcessingUtility.Configuration();
    configuration.guid = pcGUID;
    configuration.attributes = new List<cssmgnt.ProductProcessingUtility.Attribute>();
    
    // Convert patched attributes to CloudSense Attribute objects
    for (Object attrObj : commercialAttributes) {
        Map<String, Object> attrMap = (Map<String, Object>) attrObj;
        
        cssmgnt.ProductProcessingUtility.Attribute attr = 
            new cssmgnt.ProductProcessingUtility.Attribute();
        attr.name = (String) attrMap.get('name');
        attr.value = (String) attrMap.get('value');
        attr.displayValue = (String) attrMap.get('label');
        
        configuration.attributes.add(attr);
    }
    
    configurationsBySolutionId.get(solutionId).add(configuration);
    System.debug('✅ Configuration prepared for solution: ' + solutionId);
}

// ========================================
// STEP 5: Call CloudSense API to Update OE
// ========================================
System.debug('=== STEP 5: Calling CloudSense API ===');

for (Id solutionId : configurationsBySolutionId.keySet()) {
    List<cssmgnt.ProductProcessingUtility.Configuration> configs = 
        configurationsBySolutionId.get(solutionId);
    
    System.debug('Updating solution: ' + solutionId + ' with ' + configs.size() + ' configuration(s)');
    
    try {
        // Call CloudSense API to update configurations
        new cssmgnt.API_1().updateConfigurations(solutionId, configs);
        System.debug('✅ SUCCESS: Solution ' + solutionId + ' updated');
    } catch (Exception e) {
        System.debug('❌ ERROR updating solution ' + solutionId + ': ' + e.getMessage());
        System.debug('Stack trace: ' + e.getStackTraceString());
    }
}

System.debug('=== PATCH COMPLETE ===');
System.debug('Total services processed: ' + serviceMap.size());
System.debug('Total solutions updated: ' + configurationsBySolutionId.size());

/**
 * EXPECTED OUTPUT:
 * 
 * === STEP 1: Fetching Service Records ===
 * Found 1 service(s)
 * --- Processing Service: Services for BizFibre - BizFibre 300 (a236D000000eq04QAA) ---
 * Service Type: Voice
 * Migrated Data: true
 * Original commercial attributes count: 45
 * Patching Voice service...
 *   → Patching ReservedNumber: 60312345678
 *   → Patching PICEmail: customer@example.com
 * Patched attributes count: 47
 * ✅ Configuration prepared for solution: a246D000000d9gVQAQ
 * 
 * === STEP 5: Calling CloudSense API ===
 * Updating solution: a246D000000d9gVQAQ with 1 configuration(s)
 * ✅ SUCCESS: Solution a246D000000d9gVQAQ updated
 * 
 * === PATCH COMPLETE ===
 * Total services processed: 1
 * Total solutions updated: 1
 */
