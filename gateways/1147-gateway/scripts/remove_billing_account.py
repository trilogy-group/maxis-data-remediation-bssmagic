"""
Quick script to remove BillingAccount field from attachment

Purpose: Reset service a236D000000eq06QAA to clean state for testing
"""
import sys
import os
sys.path.insert(0, '/Users/vladsorici/BSSMagic-RUNTIME/1147-gateway')

from simple_salesforce import Salesforce
import json
import base64
import requests
from app.config import settings

# Connect to Salesforce
sf = Salesforce(
    username=settings.SF_USERNAME,
    password=settings.SF_PASSWORD,
    security_token=settings.SF_SECURITY_TOKEN,
    domain='test'
)

service_id = 'a236D000000eq06QAA'

print(f"=== Removing BillingAccount from service {service_id} ===\n")

# Step 1: Fetch current attachment
print("Step 1: Fetching attachment...")
attachment_query = f"""
    SELECT Id, Body, ParentId, BodyLength
    FROM Attachment
    WHERE ParentId = '{service_id}'
    AND Name = 'ProductAttributeDetails.json'
    LIMIT 1
"""
att_result = sf.query(attachment_query)

if att_result['totalSize'] == 0:
    print("❌ No attachment found!")
    sys.exit(1)

attachment_id = att_result['records'][0]['Id']
print(f"  Found attachment: {attachment_id}")

# Step 2: Fetch body
print("\nStep 2: Fetching attachment body...")
att_sobject = sf.Attachment.get(attachment_id)
body_url = att_sobject.get('Body')

instance_url = sf.sf_instance
if not instance_url.startswith('http'):
    instance_url = 'https://' + instance_url
full_url = instance_url + body_url
headers = {'Authorization': f'Bearer {sf.session_id}'}
response = requests.get(full_url, headers=headers)
oe_json = response.json()

print(f"  Body size: {len(response.content)} bytes")

# Step 3: Remove BillingAccount from both locations
print("\nStep 3: Removing BillingAccount...")

removed_from_commercial = False
removed_from_noncommercial = False

# Remove from CommercialProduct
if 'CommercialProduct' in oe_json:
    attrs = oe_json['CommercialProduct'].get('attributes', [])
    original_count = len(attrs)
    attrs = [a for a in attrs if a.get('name') not in ['BillingAccount', 'Billing Account']]
    new_count = len(attrs)
    if original_count > new_count:
        oe_json['CommercialProduct']['attributes'] = attrs
        removed_from_commercial = True
        print(f"  ✅ Removed from CommercialProduct ({original_count} → {new_count} attrs)")

# Remove from NonCommercialProduct
if 'NonCommercialProduct' in oe_json and isinstance(oe_json['NonCommercialProduct'], list):
    for schema_obj in oe_json['NonCommercialProduct']:
        for schema_name, schema_data in schema_obj.items():
            if 'Fibre Service OE' in schema_name or 'Voice OE' in schema_name:
                attrs = schema_data.get('attributes', [])
                original_count = len(attrs)
                attrs = [a for a in attrs if a.get('name') not in ['BillingAccount', 'Billing Account']]
                new_count = len(attrs)
                if original_count > new_count:
                    schema_data['attributes'] = attrs
                    removed_from_noncommercial = True
                    print(f"  ✅ Removed from NonCommercialProduct['{schema_name}'] ({original_count} → {new_count} attrs)")

if not removed_from_commercial and not removed_from_noncommercial:
    print("  ℹ️ BillingAccount not found in attachment (already clean?)")
    sys.exit(0)

# Step 4: Create backup
print("\nStep 4: Creating backup...")
backup_attachment = {
    'ParentId': service_id,
    'Name': 'ProductAttributeDetails_before_removal.json',
    'Body': base64.b64encode(response.content).decode('utf-8'),
    'ContentType': 'application/json'
}
sf.Attachment.create(backup_attachment)
print("  ✅ Backup created: ProductAttributeDetails_before_removal.json")

# Step 5: Delete old attachment
print("\nStep 5: Deleting old attachment...")
sf.Attachment.delete(attachment_id)
print(f"  ✅ Deleted: {attachment_id}")

# Step 6: Create new attachment with BillingAccount removed
print("\nStep 6: Creating new attachment...")
cleaned_json = json.dumps(oe_json, indent=2)
cleaned_body = base64.b64encode(cleaned_json.encode('utf-8')).decode('utf-8')

new_attachment = {
    'ParentId': service_id,
    'Name': 'ProductAttributeDetails.json',
    'Body': cleaned_body,
    'ContentType': 'application/json'
}
result = sf.Attachment.create(new_attachment)
new_attachment_id = result['id']
print(f"  ✅ Created new attachment: {new_attachment_id}")

# Step 7: Verify
print("\nStep 7: Verifying...")
verify_query = f"""
    SELECT Id, Name, LastModifiedDate, BodyLength
    FROM Attachment
    WHERE ParentId = '{service_id}'
    AND Name LIKE '%ProductAttribute%'
"""
verify_result = sf.query(verify_query)

for att in verify_result['records']:
    print(f"  • {att['Name']}: {att['BodyLength']} bytes (Modified: {att['LastModifiedDate']})")

print("\n" + "="*60)
print("✅ COMPLETE!")
print("="*60)
print(f"\nService {service_id}:")
print("  ✅ BillingAccount removed from attachment")
print("  ✅ Backup created (_before_removal.json)")
print("  ✅ Ready for complete patch testing")
print("\nNote: CloudSense internal DB still has BillingAccount")
print("      (will be removed when complete patch runs)")
