"""
Attachment Service - Fetch ProductAttributeDetails.json from Salesforce

This service fetches the OE JSON attachment content for services,
allowing 1867 issue inspection.
"""
import json
import base64
from simple_salesforce import Salesforce
from app.config import settings


def get_salesforce_connection():
    """Create authenticated Salesforce connection"""
    return Salesforce(
        username=settings.SF_USERNAME,
        password=settings.SF_PASSWORD,
        security_token=settings.SF_SECURITY_TOKEN,
        domain='test'  # 'test' for sandbox, 'login' for production
    )


async def fetch_attachment_for_service(service_id: str) -> dict:
    """
    Fetch the ProductAttributeDetails.json attachment for a service.
    
    Returns:
        dict with attachment info and parsed JSON content
    """
    sf = get_salesforce_connection()
    
    # First get service info
    service_query = f"""
        SELECT Id, Name, Service_Type__c, Migrated_Data__c, 
               External_ID__c, Billing_Account__c
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
    
    # Get attachment metadata
    attachment_query = f"""
        SELECT Id, Name, ParentId, BodyLength
        FROM Attachment 
        WHERE ParentId = '{service_id}' 
        AND Name = 'ProductAttributeDetails.json'
        LIMIT 1
    """
    att_result = sf.query(attachment_query)
    
    if att_result['totalSize'] == 0:
        return {
            'success': False,
            'error': 'No ProductAttributeDetails.json attachment found',
            'serviceId': service_id,
            'serviceName': service.get('Name'),
            'serviceType': service.get('Service_Type__c'),
            'hasAttachment': False
        }
    
    attachment = att_result['records'][0]
    attachment_id = attachment['Id']
    
    # Fetch actual body content via REST API
    # Use the Attachment body endpoint
    try:
        # Get the body using the sobjects API
        att_sobject = sf.Attachment.get(attachment_id)
        body_url = att_sobject.get('Body')
        
        if not body_url:
            return {
                'success': False,
                'error': 'Attachment has no body URL',
                'attachmentId': attachment_id,
                'serviceId': service_id,
                'serviceName': service.get('Name'),
                'serviceType': service.get('Service_Type__c')
            }
        
        # Fetch the actual body content
        # The body_url is a relative path like /services/data/v59.0/sobjects/Attachment/{id}/Body
        # We need to combine it with the instance URL (not base_url which includes /services/data)
        import requests
        instance_url = sf.sf_instance  # e.g., maxis--fdrv2.sandbox.my.salesforce.com
        # Ensure we have the https:// prefix
        if not instance_url.startswith('http'):
            instance_url = 'https://' + instance_url
        full_url = instance_url + body_url
        headers = {'Authorization': f'Bearer {sf.session_id}'}
        response = requests.get(full_url, headers=headers)
        response.raise_for_status()
        body_content = response.content
        
        # Decode the JSON
        try:
            content = json.loads(body_content.decode('utf-8'))
        except (json.JSONDecodeError, UnicodeDecodeError):
            # If it's base64 encoded
            try:
                decoded = base64.b64decode(body_content)
                content = json.loads(decoded.decode('utf-8'))
            except:
                content = None
        
        # Analyze for 1867 issues
        analysis = analyze_oe_content(content, service.get('Service_Type__c')) if content else None
        
        return {
            'success': True,
            'attachmentId': attachment_id,
            'serviceId': service_id,
            'serviceName': service.get('Name'),
            'serviceType': service.get('Service_Type__c'),
            'migratedData': service.get('Migrated_Data__c'),
            'externalId': service.get('External_ID__c'),
            'billingAccount': service.get('Billing_Account__c'),
            'bodyLength': attachment.get('BodyLength'),
            'hasAttachment': True,
            'content': content,
            'analysis': analysis
        }
        
    except Exception as e:
        return {
            'success': False,
            'error': f'Failed to fetch attachment body: {str(e)}',
            'attachmentId': attachment_id,
            'serviceId': service_id,
            'serviceName': service.get('Name'),
            'serviceType': service.get('Service_Type__c')
        }


def analyze_oe_content(content: dict, service_type: str) -> dict:
    """
    Analyze OE content for missing mandatory fields based on service type.
    
    Service Type → Mandatory Fields:
    - Voice: ReservedNumber, ResourceSystemGroupID, NumberStatus, PICEmail
    - Fibre Service: BillingAccount
    - eSMS Service: ReservedNumber, eSMSUserName
    - Access Service: BillingAccount, PICEmail
    """
    if not content:
        return {'error': 'No content to analyze', 'has1867Issue': True}
    
    # Define mandatory fields for each service type
    mandatory_fields = {
        'Voice': ['ReservedNumber', 'ResourceSystemGroupID', 'NumberStatus', 'PICEmail'],
        'Fibre Service': ['BillingAccount'],
        'eSMS Service': ['ReservedNumber', 'eSMSUserName'],
        'Access Service': ['BillingAccount', 'PICEmail']
    }
    
    # Field name variations (the JSON might use different casing/formats)
    # Note: NonCommercialProduct uses names WITH SPACES
    field_aliases = {
        'ReservedNumber': ['ReservedNumber', 'reservedNumber', 'Reserved Number', 'reserved number', 'Reserved_Number'],
        'ResourceSystemGroupID': ['ResourceSystemGroupID', 'resourceSystemGroupId', 'Resource System Group ID', 'ResourceSystemGroupId'],
        'NumberStatus': ['NumberStatus', 'numberStatus', 'Number Status', 'Number_Status'],
        'PICEmail': ['PICEmail', 'picEmail', 'PIC Email', 'PIC_Email', 'pic email'],
        'BillingAccount': ['BillingAccount', 'billingAccount', 'Billing Account', 'billing account', 'Billing_Account'],
        'eSMSUserName': ['eSMSUserName', 'esmsUserName', 'eSMS UserName', 'eSMS_UserName', 'esms username']
    }
    
    required = mandatory_fields.get(service_type, [])
    missing = []
    present = {}
    
    # Build attribute index by searching ONLY NonCommercialProduct
    # (Mandatory OE fields like BillingAccount, PICEmail, ReservedNumber should be here)
    attr_by_name = {}
    
    non_commercial_product = content.get('NonCommercialProduct', [])
    total_non_comm_attrs = 0
    
    if isinstance(non_commercial_product, list):
        for schema_obj in non_commercial_product:
            if isinstance(schema_obj, dict):
                for schema_name, schema_data in schema_obj.items():
                    if isinstance(schema_data, dict):
                        schema_attributes = schema_data.get('attributes', [])
                        total_non_comm_attrs += len(schema_attributes)
                        for attr in schema_attributes:
                            if isinstance(attr, dict):
                                # Normalize: lowercase + remove spaces for matching
                                attr_name_normalized = attr.get('name', '').lower().replace(' ', '')
                                attr_value = attr.get('value', '')
                                if attr_name_normalized:
                                    attr_by_name[attr_name_normalized] = attr_value
    
    print(f"  Found {total_non_comm_attrs} attributes in NonCommercialProduct")
    print(f"  Searching for mandatory fields in NonCommercialProduct only")
    
    # Check each required field
    for field in required:
        found = False
        found_value = None
        
        # Check all aliases
        for alias in field_aliases.get(field, [field]):
            alias_normalized = alias.lower().replace(' ', '')  # Normalize for matching
            
            # Check in attributes array
            if alias_normalized in attr_by_name:
                found_value = attr_by_name[alias_normalized]
                # Consider found if value is not None and not empty string
                if found_value is not None and str(found_value).strip() != '':
                    found = True
                    print(f"  ✅ Found {field}: {found_value}")
                    break
                else:
                    print(f"  ⚠️ Found {field} but value is empty: '{found_value}'")
        
        if found:
            present[field] = found_value
        else:
            missing.append(field)
            print(f"  ❌ Missing {field}")
    
    return {
        'serviceType': service_type,
        'mandatoryFields': required,
        'missingFields': missing,
        'presentFields': present,
        'has1867Issue': len(missing) > 0,
        'issueCount': len(missing),
        'summary': f"{len(missing)} of {len(required)} mandatory fields missing" if required else "No mandatory fields defined for this service type"
    }

