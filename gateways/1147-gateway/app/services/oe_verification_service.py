"""
OE Verification Service - Check CloudSense Internal DB (Heroku) for OE data

This service verifies that OE data was properly updated in the CloudSense
internal database after a patch operation.
"""
from simple_salesforce import Salesforce
from app.config import settings
import requests


def get_salesforce_connection():
    """Create authenticated Salesforce connection"""
    return Salesforce(
        username=settings.SF_USERNAME,
        password=settings.SF_PASSWORD,
        security_token=settings.SF_SECURITY_TOKEN,
        domain='test'
    )


async def verify_oe_data(service_id: str, fields_to_check: list = None) -> dict:
    """
    Verify OE data in CloudSense internal database via Apex API.
    
    Args:
        service_id: The Salesforce service ID
        fields_to_check: Optional list of field names to specifically check for
                        (e.g., ['BillingAccount', 'PICEmail'])
    
    Returns:
        dict with:
        - success: bool
        - serviceId: str
        - productConfigurationId: str
        - oeDataFound: bool
        - fields: dict of field name -> {value, displayValue, found}
        - componentsCount: int
        - attributesCount: int
    """
    sf = get_salesforce_connection()
    
    # First, get the Product Configuration ID from the service
    service_query = f"""
        SELECT Id, Name, csordtelcoa__Product_Configuration__c
        FROM csord__Service__c 
        WHERE Id = '{service_id}'
    """
    service_result = sf.query(service_query)
    
    if service_result['totalSize'] == 0:
        return {
            'success': False,
            'error': f'Service not found: {service_id}',
            'serviceId': service_id
        }
    
    service = service_result['records'][0]
    pc_id = service.get('csordtelcoa__Product_Configuration__c')
    
    if not pc_id:
        return {
            'success': False,
            'error': 'Service has no Product Configuration linked',
            'serviceId': service_id,
            'serviceName': service.get('Name')
        }
    
    # Default fields to check
    if not fields_to_check:
        fields_to_check = ['Billing Account', 'PIC Email', 'Reserved Number', 
                          'ResourceSystemGroupID', 'NumberStatus', 'eSMSUserName']
    
    # Build Apex script to check OE data
    fields_check_parts = []
    for f in fields_to_check:
        safe_name = f.replace("'", "\\'")
        check_code = (
            f"if(attr.name != null && attr.name.containsIgnoreCase('{safe_name}'))" + "{"
            f"result += '{safe_name}||' + String.valueOf(attr.value) + '||' + String.valueOf(attr.displayValue) + '\\n';"
            "}"
        )
        fields_check_parts.append(check_code)
    fields_check_apex = '\n'.join(fields_check_parts)
    
    apex_script = f"""
Id pcId = '{pc_id}';
Map<Id, List<cssmgnt.ProductProcessingUtility.Component>> oeData = cssmgnt.API_1.getOEData(new List<Id>{{pcId}});
String result = 'HEADER||{pc_id}\\n';

Integer compCount = 0;
Integer attrCount = 0;

if(oeData.containsKey(pcId) && oeData.get(pcId) != null) {{
    List<cssmgnt.ProductProcessingUtility.Component> comps = oeData.get(pcId);
    compCount = comps.size();
    result += 'COMPONENTS||' + compCount + '\\n';
    
    for(cssmgnt.ProductProcessingUtility.Component cmp : comps) {{
        if(cmp.configurations != null) {{
            for(Object cfgObj : cmp.configurations) {{
                cssmgnt.ProductProcessingUtility.Configuration cfg = (cssmgnt.ProductProcessingUtility.Configuration)cfgObj;
                attrCount += cfg.attributes.size();
                
                for(cssmgnt.ProductProcessingUtility.Attribute attr : cfg.attributes) {{
                    {fields_check_apex}
                }}
            }}
        }}
    }}
    result += 'ATTRIBUTES||' + attrCount + '\\n';
}} else {{
    result += 'NO_DATA||true\\n';
}}

Attachment tempAtt = new Attachment(ParentId = pcId, Name = 'OE_VERIFY_TEMP.txt', Body = Blob.valueOf(result), ContentType = 'text/plain');
insert tempAtt;
"""
    
    try:
        # Execute Apex
        exec_result = sf.restful('tooling/executeAnonymous', params={'anonymousBody': apex_script})
        
        if not exec_result.get('success'):
            return {
                'success': False,
                'error': exec_result.get('compileProblem') or exec_result.get('exceptionMessage') or 'Apex execution failed',
                'serviceId': service_id,
                'productConfigurationId': pc_id
            }
        
        # Get the temp attachment
        atts = sf.query(f"SELECT Id FROM Attachment WHERE ParentId = '{pc_id}' AND Name = 'OE_VERIFY_TEMP.txt' ORDER BY CreatedDate DESC LIMIT 1")
        
        if atts['totalSize'] == 0:
            return {
                'success': False,
                'error': 'Failed to retrieve OE verification results',
                'serviceId': service_id,
                'productConfigurationId': pc_id
            }
        
        att_id = atts['records'][0]['Id']
        
        # Get body
        instance_url = 'https://' + sf.sf_instance if not sf.sf_instance.startswith('http') else sf.sf_instance
        url = f"{instance_url}/services/data/v59.0/sobjects/Attachment/{att_id}/Body"
        headers = {'Authorization': f'Bearer {sf.session_id}'}
        response = requests.get(url, headers=headers)
        
        result_text = response.text
        
        # Clean up temp attachment
        sf.Attachment.delete(att_id)
        
        # Parse results
        fields_found = {}
        components_count = 0
        attributes_count = 0
        oe_data_found = True
        
        for line in result_text.strip().split('\n'):
            parts = line.split('||')
            if len(parts) >= 2:
                key = parts[0]
                if key == 'COMPONENTS':
                    components_count = int(parts[1])
                elif key == 'ATTRIBUTES':
                    attributes_count = int(parts[1])
                elif key == 'NO_DATA':
                    oe_data_found = False
                elif key == 'HEADER':
                    pass  # Skip header
                else:
                    # Field data: name||value||displayValue
                    field_name = key
                    field_value = parts[1] if len(parts) > 1 else None
                    field_display = parts[2] if len(parts) > 2 else None
                    
                    # Clean up "null" strings
                    if field_value == 'null':
                        field_value = None
                    if field_display == 'null':
                        field_display = None
                    
                    fields_found[field_name] = {
                        'value': field_value,
                        'displayValue': field_display,
                        'found': field_value is not None and field_value != ''
                    }
        
        return {
            'success': True,
            'serviceId': service_id,
            'serviceName': service.get('Name'),
            'productConfigurationId': pc_id,
            'oeDataFound': oe_data_found,
            'componentsCount': components_count,
            'attributesCount': attributes_count,
            'fields': fields_found,
            'allFieldsPresent': all(f.get('found', False) for f in fields_found.values()) if fields_found else False
        }
        
    except Exception as e:
        return {
            'success': False,
            'error': str(e),
            'serviceId': service_id,
            'productConfigurationId': pc_id
        }
