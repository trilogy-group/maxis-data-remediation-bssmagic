/**
 * Verify CloudSense Internal DB Contents
 * 
 * Uses CloudSense API to fetch OE data from internal database
 * and checks if BillingAccount field is present.
 * 
 * This verifies what CloudSense will use for order processing.
 */

// ========================================
// USER INPUT: Service to check
// ========================================
Id serviceId = 'a236D000000eq06QAA';

// ========================================
// STEP 1: Get Service and PC Info
// ========================================
csord__Service__c service = [
    SELECT 
        Id,
        Name,
        csordtelcoa__Product_Configuration__c,
        csordtelcoa__Product_Configuration__r.GUID__c,
        csordtelcoa__Product_Configuration__r.cscfga__Product_Family__c
    FROM csord__Service__c
    WHERE Id = :serviceId
    LIMIT 1
];

String pcId = service.csordtelcoa__Product_Configuration__c;
String pcGUID = service.csordtelcoa__Product_Configuration__r.GUID__c;

System.debug('Service: ' + service.Name);
System.debug('PC ID: ' + pcId);
System.debug('PC GUID: ' + pcGUID);

// ========================================
// STEP 2: Fetch OE Data from CloudSense DB
// ========================================
System.debug('=== Fetching OE from CloudSense Internal DB ===');

List<Id> configIds = new List<Id>{pcId};

try {
    // This fetches from CloudSense Heroku database!
    Map<Id, List<cssmgnt.ProductProcessingUtility.Component>> oeMap = 
        cssmgnt.API_1.getOEData(configIds);
    
    System.debug('OE Map keys: ' + oeMap.keySet());
    
    if (oeMap.containsKey(pcId)) {
        List<cssmgnt.ProductProcessingUtility.Component> components = oeMap.get(pcId);
        System.debug('Number of components: ' + components.size());
        
        // Check each component
        for (cssmgnt.ProductProcessingUtility.Component component : components) {
            System.debug('\n--- Component: ' + component.name + ' ---');
            System.debug('Schema name: ' + component.schemaName);
            
            // Check each configuration in the component
            for (Object configObj : component.configurations) {
                cssmgnt.ProductProcessingUtility.Configuration config = 
                    (cssmgnt.ProductProcessingUtility.Configuration)configObj;
                
                System.debug('\nConfiguration GUID: ' + config.guid);
                System.debug('Number of attributes: ' + config.attributes.size());
                
                // Look for BillingAccount/Billing Account
                Boolean foundBillingAccount = false;
                String billingAccountValue = null;
                
                for (cssmgnt.ProductProcessingUtility.Attribute attr : config.attributes) {
                    String attrName = attr.name.toLowerCase().replace(' ', '');
                    
                    // Check for billing account (case-insensitive, space-insensitive)
                    if (attrName.contains('billingaccount') || attrName.contains('billing')) {
                        foundBillingAccount = true;
                        billingAccountValue = attr.value;
                        System.debug('  ✅ Found: ' + attr.name + ' = ' + attr.value + ' (label: ' + attr.displayValue + ')');
                    }
                    
                    // Show all attribute names for debugging
                    System.debug('  • ' + attr.name + ': ' + attr.value);
                }
                
                if (!foundBillingAccount) {
                    System.debug('  ❌ BillingAccount NOT FOUND in CloudSense DB');
                } else {
                    System.debug('\n✅ CloudSense DB HAS BillingAccount: ' + billingAccountValue);
                }
            }
        }
    } else {
        System.debug('❌ No OE data found for PC ID: ' + pcId);
    }
    
} catch (Exception e) {
    System.debug('❌ ERROR fetching OE: ' + e.getMessage());
    System.debug('Stack trace: ' + e.getStackTraceString());
}

System.debug('\n=== VERIFICATION COMPLETE ===');

/**
 * EXPECTED OUTPUT (if DB has BillingAccount):
 * 
 * --- Component: Fibre Service OE ---
 * Schema name: Fibre Service OE
 * Configuration GUID: 39ab92b5-2907-3dc3-70ce-e65b370e22c7
 * Number of attributes: 17
 *   • OEAccountId: 0016D00000SJhazQAD
 *   • Installation Name: LAI CHUN ON YU WENG SDN BHD
 *   ...
 *   ✅ Found: Billing Account = a386D000000BaTWQA0 (label: BA-0234411)
 * 
 * ✅ CloudSense DB HAS BillingAccount: a386D000000BaTWQA0
 * 
 * 
 * EXPECTED OUTPUT (if DB doesn't have BillingAccount):
 * 
 * --- Component: Fibre Service OE ---
 * Number of attributes: 16
 *   • OEAccountId: ...
 *   • Installation Name: ...
 *   (no BillingAccount listed)
 * 
 * ❌ BillingAccount NOT FOUND in CloudSense DB
 */
