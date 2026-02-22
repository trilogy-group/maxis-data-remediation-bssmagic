"""
Attachment Patcher Service

Replicates the manual attachment workflow via Salesforce REST API:
1. Fetch current ProductAttributeDetails.json
2. Rename to ProductAttributeDetails_old.json (backup)
3. Patch OE data in memory
4. Upload new ProductAttributeDetails.json with patched data

This ensures the attachment is updated and verification works!
"""
import json
import base64
from typing import Dict, List, Optional
from simple_salesforce import Salesforce
from app.config import settings


def get_salesforce_connection():
    """Create authenticated Salesforce connection"""
    return Salesforce(
        username=settings.SF_USERNAME,
        password=settings.SF_PASSWORD,
        security_token=settings.SF_SECURITY_TOKEN,
        domain='test'
    )


async def patch_service_with_attachment_update(
    service_id: str,
    fields_to_patch: List[Dict]
) -> Dict:
    """
    Patch service OE and update the attachment file.
    
    Steps:
    1. Fetch current attachment
    2. Enrich field labels (get BA name if missing)
    3. Create backup (rename to _old)
    4. Patch JSON in memory (using provided field data from UI)
    5. Delete old attachment
    6. Create new attachment with patched data
    
    Args:
        service_id: Salesforce Service ID
        fields_to_patch: List of {fieldName, value, label} from UI
        
    Returns:
        Dict with success status and details
    """
    sf = get_salesforce_connection()
    
    # Enrich labels and add hardcoded fields (e.g., get BA name, add ResourceSystemGroupID='Migrated')
    print(f"  Enriching {len(fields_to_patch)} field(s)...")
    
    # First, query Service to get additional data needed for Voice services
    service_data = None
    if any(f['fieldName'] in ['PICEmail', 'ReservedNumber'] for f in fields_to_patch):
        try:
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
            if service_result['totalSize'] > 0:
                service_data = service_result['records'][0]
                print(f"  ℹ️ Fetched service data for Voice field enrichment")
        except Exception as e:
            print(f"  ⚠️ Could not fetch service data: {str(e)}")
    
    enriched_fields = []
    for field in fields_to_patch:
        enriched_field = dict(field)  # Copy
        field_name = field['fieldName']
        current_label = field.get('label')
        
        print(f"    Field: {field_name}, Value: {field.get('value')}, Label: {current_label}")
        
        # BillingAccount: Fetch BA name
        if field_name == 'BillingAccount':
            ba_id = field['value']
            if not current_label or current_label == ba_id:
                print(f"      Need to enrich BA name for ID: {ba_id}")
                try:
                    ba_query = f"""
                        SELECT Name 
                        FROM csconta__Billing_Account__c 
                        WHERE Id = '{ba_id}'
                        LIMIT 1
                    """
                    ba_result = sf.query(ba_query)
                    if ba_result['totalSize'] > 0:
                        ba_name = ba_result['records'][0]['Name']
                        enriched_field['label'] = ba_name
                        print(f"      ✅ Enriched BillingAccount label: {ba_name}")
                except Exception as e:
                    print(f"      ⚠️ Could not fetch BA name: {str(e)}")
                    enriched_field['label'] = ba_id
        
        # PICEmail: Fetch from Billing_Account -> Contact -> Email if not provided
        elif field_name == 'PICEmail' and service_data:
            if not field.get('value'):
                pic_email = service_data.get('Billing_Account__r', {}).get('Contact__r', {}).get('Email')
                if not pic_email:
                    pic_email = service_data.get('Authorized_PIC_Email__c')
                if pic_email:
                    enriched_field['value'] = pic_email
                    enriched_field['label'] = pic_email
                    print(f"      ✅ Enriched PICEmail: {pic_email}")
        
        # ReservedNumber: Fetch from External_ID__c if not provided
        elif field_name == 'ReservedNumber' and service_data:
            if not field.get('value'):
                reserved_number = service_data.get('External_ID__c')
                if reserved_number:
                    enriched_field['value'] = reserved_number
                    enriched_field['label'] = reserved_number
                    print(f"      ✅ Enriched ReservedNumber: {reserved_number}")
        
        enriched_fields.append(enriched_field)
    
    # Add hardcoded fields for Voice services
    field_names_being_patched = {f['fieldName'] for f in enriched_fields}
    
    if 'ResourceSystemGroupID' not in field_names_being_patched:
        # Check if this is a Voice service that needs this field
        if any(f['fieldName'] in ['ReservedNumber', 'PICEmail'] for f in enriched_fields):
            enriched_fields.append({
                'fieldName': 'ResourceSystemGroupID',
                'value': 'Migrated',
                'label': 'Migrated'
            })
            print(f"    ✅ Added ResourceSystemGroupID: Migrated (hardcoded)")
    
    if 'NumberStatus' not in field_names_being_patched:
        # Check if this is a Voice service that needs this field
        if any(f['fieldName'] in ['ReservedNumber', 'PICEmail'] for f in enriched_fields):
            enriched_fields.append({
                'fieldName': 'NumberStatus',
                'value': 'Reserved',
                'label': 'Reserved'
            })
            print(f"    ✅ Added NumberStatus: Reserved (hardcoded)")
    
    fields_to_patch = enriched_fields
    print(f"  Enrichment complete. Proceeding with {len(fields_to_patch)} field(s)...")
    
    # Step 1: Fetch current attachment
    try:
        attachment_query = f"""
            SELECT Id, Body, ParentId, BodyLength, Name
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
                'serviceId': service_id
            }
        
        current_attachment = att_result['records'][0]
        attachment_id = current_attachment['Id']
        
        # Fetch attachment body
        att_sobject = sf.Attachment.get(attachment_id)
        body_url = att_sobject.get('Body')
        
        import requests
        instance_url = sf.sf_instance
        if not instance_url.startswith('http'):
            instance_url = 'https://' + instance_url
        full_url = instance_url + body_url
        headers = {'Authorization': f'Bearer {sf.session_id}'}
        response = requests.get(full_url, headers=headers)
        response.raise_for_status()
        
        # Parse OE JSON
        oe_json = json.loads(response.content.decode('utf-8'))
        
    except Exception as e:
        return {
            'success': False,
            'error': f'Failed to fetch attachment: {str(e)}',
            'serviceId': service_id
        }
    
    # Step 2: Patch OE JSON in NonCommercialProduct (not CommercialProduct!)
    try:
        non_commercial_product = oe_json.get('NonCommercialProduct', [])
        
        if not non_commercial_product or not isinstance(non_commercial_product, list):
            return {
                'success': False,
                'error': 'NonCommercialProduct not found or invalid structure',
                'serviceId': service_id
            }
        
        # Find the correct OE schema based on service type
        # Determine which schema to patch
        schema_mapping = {
            'Voice': 'Voice OE',
            'Fibre Service': 'Fibre Service OE',
            'eSMS Service': 'eSMS OE',  # Assumption - verify with Ashish
            'Access Service': 'Access OE'  # Assumption - verify with Ashish
        }
        
        # Get service type from first field or try to detect
        service_type = None
        for field in fields_to_patch:
            # Try to infer from field names
            if field['fieldName'] in ['ReservedNumber', 'ResourceSystemGroupID', 'NumberStatus']:
                service_type = 'Voice'
                break
            elif field['fieldName'] == 'BillingAccount':
                # Could be Fibre or Access - need to check structure
                pass
        
        # Find the schema object
        target_schema_name = None
        target_attributes = None
        
        for schema_obj in non_commercial_product:
            for schema_name, schema_data in schema_obj.items():
                # Try to match known schema names
                if 'Voice OE' in schema_name:
                    target_schema_name = schema_name
                    target_attributes = schema_data.get('attributes', [])
                    service_type = 'Voice'
                    break
                elif 'Fibre Service OE' in schema_name:
                    target_schema_name = schema_name
                    target_attributes = schema_data.get('attributes', [])
                    service_type = 'Fibre Service'
                    break
            if target_schema_name:
                break
        
        if not target_attributes:
            return {
                'success': False,
                'error': f'Could not find OE schema in NonCommercialProduct. Available schemas: {[list(s.keys())[0] for s in non_commercial_product if s]}',
                'serviceId': service_id
            }
        
        print(f"  Target schema: {target_schema_name}")
        print(f"  Original attributes count: {len(target_attributes)}")
        
        # Build index (normalize: lowercase + remove spaces)
        attr_index = {attr['name'].lower().replace(' ', ''): attr for attr in target_attributes}
        print(f"  Attribute index keys (first 10): {list(attr_index.keys())[:10]}")
        
        # Map UI field names to actual NonCommercialProduct OE field names (with spaces!)
        field_name_mapping = {
            'BillingAccount': 'Billing Account',      # Voice/Fibre/Access OE
            'ReservedNumber': 'ReservedNumber',       # Voice/eSMS OE
            'ResourceSystemGroupID': 'ResourceSystemGroupID',  # Voice OE
            'NumberStatus': 'NumberStatus',           # Voice OE
            'PICEmail': 'PIC Email',                  # Voice/Access OE (with space!)
            'eSMSUserName': 'eSMS UserName'           # eSMS OE
        }
        
        # Add or UPDATE fields using data provided by UI
        for field in fields_to_patch:
            ui_field_name = field['fieldName']
            # Use mapped name for OE JSON
            field_name = field_name_mapping.get(ui_field_name, ui_field_name)
            field_value = field['value']
            field_label = field.get('label', field_value)
            field_name_lower = field_name.lower().replace(' ', '')  # Remove spaces for matching
            
            print(f"  Checking {field_name} (lowercase: {field_name_lower})")
            
            if field_name_lower in attr_index:
                # Field exists - CHECK both value AND label
                existing_attr = attr_index[field_name_lower]
                existing_value = str(existing_attr.get('value', '')).strip()
                existing_label = str(existing_attr.get('label', '')).strip()
                
                print(f"  Exists with value: '{existing_value}', label: '{existing_label}'")
                
                needs_update = False
                
                # Update if value is empty or different
                if not existing_value or existing_value != field_value:
                    existing_attr['value'] = field_value
                    needs_update = True
                    print(f"  → Updating value: '{existing_value}' → '{field_value}'")
                
                # Update if label is empty, missing, or same as value (meaning it's ID, not name)
                if not existing_label or existing_label == existing_value or existing_label != field_label:
                    existing_attr['label'] = field_label
                    needs_update = True
                    print(f"  → Updating label: '{existing_label}' → '{field_label}'")
                
                if needs_update:
                    print(f"  ✅ UPDATED {field_name}")
                else:
                    print(f"  ✅ {field_name} already correct, skipping")
            else:
                # Field doesn't exist - ADD it
                new_attr = {
                    'name': field_name,
                    'value': field_value,
                    'label': field_label
                }
                target_attributes.append(new_attr)
                print(f"  → ADDED {field_name}: {field_value} (label: {field_label})")
        
        print(f"  Patched attributes count: {len(target_attributes)}")
        
        # Update JSON structure - put patched attributes back into the schema
        for schema_obj in non_commercial_product:
            if target_schema_name in schema_obj:
                schema_obj[target_schema_name]['attributes'] = target_attributes
                break
        
        oe_json['NonCommercialProduct'] = non_commercial_product
        
        # Serialize patched JSON
        patched_json = json.dumps(oe_json, indent=2)
        patched_body = base64.b64encode(patched_json.encode('utf-8')).decode('utf-8')
        
        print(f"  Patched JSON size: {len(patched_json)} bytes")
        
    except Exception as e:
        return {
            'success': False,
            'error': f'Failed to patch JSON: {str(e)}',
            'serviceId': service_id
        }
    
    # Step 3: Create backup attachment (rename old to _old)
    try:
        backup_attachment = {
            'ParentId': service_id,
            'Name': 'ProductAttributeDetails_old.json',
            'Body': base64.b64encode(response.content).decode('utf-8'),
            'ContentType': 'application/json'
        }
        sf.Attachment.create(backup_attachment)
        print(f"  ✅ Backup created: ProductAttributeDetails_old.json")
        
    except Exception as e:
        return {
            'success': False,
            'error': f'Failed to create backup: {str(e)}',
            'serviceId': service_id,
            'warning': 'Could not backup original attachment'
        }
    
    # Step 4: Delete old attachment
    try:
        sf.Attachment.delete(attachment_id)
        print(f"  ✅ Deleted old attachment: {attachment_id}")
        
    except Exception as e:
        return {
            'success': False,
            'error': f'Failed to delete old attachment: {str(e)}',
            'serviceId': service_id,
            'warning': 'Backup created but could not delete old attachment'
        }
    
    # Step 5: Create new attachment with patched data
    try:
        new_attachment = {
            'ParentId': service_id,
            'Name': 'ProductAttributeDetails.json',
            'Body': patched_body,
            'ContentType': 'application/json'
        }
        result = sf.Attachment.create(new_attachment)
        new_attachment_id = result['id']
        
        print(f"  ✅ New attachment created: {new_attachment_id}")
        
    except Exception as e:
        return {
            'success': False,
            'error': f'Failed to create new attachment: {str(e)}',
            'serviceId': service_id,
            'critical': True,
            'warning': 'Old attachment deleted but new one failed to create! Service has no attachment now!'
        }
    
    # Step 6: Verify new attachment was created
    try:
        verify_query = f"""
            SELECT Id, Name, LastModifiedDate, BodyLength
            FROM Attachment
            WHERE ParentId = '{service_id}'
            AND Name = 'ProductAttributeDetails.json'
            LIMIT 1
        """
        verify_result = sf.query(verify_query)
        
        if verify_result['totalSize'] > 0:
            new_att = verify_result['records'][0]
            # Return the fields we actually patched
            patched_field_summary = [
                {
                    'fieldName': f['fieldName'],
                    'newValue': f['value'],
                    'source': 'UI (from TMF Service x_ fields)'
                }
                for f in fields_to_patch
            ]
            
            return {
                'success': True,
                'serviceId': service_id,
                'patchedFields': patched_field_summary,
                'attachmentUpdated': True,
                'newAttachmentId': new_att['Id'],
                'lastModifiedDate': new_att['LastModifiedDate'],
                'bodyLength': new_att['BodyLength'],
                'backupCreated': True,
                'message': f'Successfully patched {len(fields_to_patch)} field(s) and updated attachment'
            }
        else:
            return {
                'success': False,
                'error': 'New attachment not found after creation',
                'serviceId': service_id
            }
            
    except Exception as e:
        patched_field_summary = [
            {
                'fieldName': f['fieldName'],
                'newValue': f['value'],
                'source': 'UI (from TMF Service x_ fields)'
            }
            for f in fields_to_patch
        ]
        
        return {
            'success': True,  # Patch succeeded even if verification failed
            'serviceId': service_id,
            'patchedFields': patched_field_summary,
            'attachmentUpdated': True,
            'warning': f'Attachment created but verification failed: {str(e)}'
        }


async def get_attachment_regeneration_status(service_id: str) -> Dict:
    """
    Check if attachment was recently regenerated.
    
    Returns:
        Info about attachment age and whether it's stale
    """
    sf = get_salesforce_connection()
    
    try:
        query = f"""
            SELECT Id, Name, LastModifiedDate, LastModifiedBy.Name, BodyLength
            FROM Attachment
            WHERE ParentId = '{service_id}'
            AND Name = 'ProductAttributeDetails.json'
            LIMIT 1
        """
        result = sf.query(query)
        
        if result['totalSize'] == 0:
            return {
                'success': False,
                'error': 'No attachment found',
                'serviceId': service_id
            }
        
        att = result['records'][0]
        last_modified = att['LastModifiedDate']
        
        # Parse date and check if recent (within last hour)
        from datetime import datetime, timezone, timedelta
        modified_dt = datetime.fromisoformat(last_modified.replace('+0000', '+00:00'))
        now = datetime.now(timezone.utc)
        age_hours = (now - modified_dt).total_seconds() / 3600
        
        is_recent = age_hours < 1  # Modified within last hour
        is_stale = age_hours > 24  # Older than 1 day
        
        return {
            'success': True,
            'serviceId': service_id,
            'attachmentId': att['Id'],
            'lastModifiedDate': last_modified,
            'lastModifiedBy': att['LastModifiedBy']['Name'],
            'ageHours': round(age_hours, 2),
            'isRecent': is_recent,
            'isStale': is_stale,
            'bodyLength': att['BodyLength']
        }
        
    except Exception as e:
        return {
            'success': False,
            'error': str(e),
            'serviceId': service_id
        }
