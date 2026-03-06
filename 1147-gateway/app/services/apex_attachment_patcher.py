"""
Lightweight Apex script generator for patching OE attachments only.
Optimized for size to fit within Salesforce Tooling API URL limits.
"""
from typing import Dict, List
from app.services.apex_executor import execute_anonymous_apex


async def patch_attachment_only(
    service_id: str,
    fields_to_patch: List[Dict]
) -> Dict:
    """
    Generate minimal Apex to patch attachment only (no CloudSense DB update).
    
    This is a lightweight version for when the full script exceeds URL limits.
    CloudSense DB can be updated separately or will sync automatically.
    """
    
    # Build compact patch map
    patch_entries = []
    for field in fields_to_patch:
        field_name = field['fieldName']
        oe_name = 'PIC Email' if field_name == 'PICEmail' else field_name
        oe_name = 'Billing Account' if field_name == 'BillingAccount' else oe_name
        
        value = field['value'].replace("'", "\\'")
        label = (field.get('label') or value).replace("'", "\\'")
        patch_entries.append(f"m.put('{oe_name}',new Map<String,String>{{'v'=>'{value}','d'=>'{label}'}});")
    
    patch_map_code = ''.join(patch_entries)
    
    # Minimal Apex script - attachment update only
    apex_script = f"""
Id sid='{service_id}';
Attachment a=[SELECT Body,ParentId FROM Attachment WHERE Name='ProductAttributeDetails.json' AND ParentId=:sid LIMIT 1];
Map<String,Object> j=(Map<String,Object>)JSON.deserializeUntyped(a.Body.toString());
Map<String,Map<String,String>> m=new Map<String,Map<String,String>>();
{patch_map_code}
List<Object> ncp=(List<Object>)j.get('NonCommercialProduct');
if(ncp!=null){{for(Object o:ncp){{Map<String,Object> n=(Map<String,Object>)o;for(String k:n.keySet()){{Map<String,Object> s=(Map<String,Object>)n.get(k);List<Object> at=(List<Object>)s.get('attributes');if(at!=null){{for(String fn:m.keySet()){{Map<String,String> fd=m.get(fn);Boolean f=false;for(Object ao:at){{Map<String,Object> aa=(Map<String,Object>)ao;if(aa.get('name')==fn){{aa.put('value',fd.get('v'));aa.put('displayValue',fd.get('d'));f=true;break;}}}}if(!f){{Map<String,Object> na=new Map<String,Object>();na.put('name',fn);na.put('value',fd.get('v'));na.put('displayValue',fd.get('d'));at.add(na);}}}}}}}}}}}}
Attachment bk=new Attachment(ParentId=sid,Name='ProductAttributeDetails_old.json',Body=a.Body,ContentType='application/json');
insert bk;
delete a;
Attachment nw=new Attachment(ParentId=sid,Name='ProductAttributeDetails.json',Body=Blob.valueOf(JSON.serialize(j)),ContentType='application/json');
insert nw;
System.debug('Done:'+nw.Id);
"""
    
    print(f"[attachment_patcher] Script size: {len(apex_script)} chars")
    
    try:
        result = await execute_anonymous_apex(apex_script)
        
        return {
            'success': result.get('success', False),
            'compiled': result.get('compiled', False),
            'error': result.get('error'),
            'output': result.get('output'),
            'patchedFields': fields_to_patch,
            'mode': 'attachment_only',
            'note': 'CloudSense DB NOT updated. Use JS Gateway verify-oe to check sync status.'
        }
    except Exception as e:
        return {
            'success': False,
            'error': str(e),
            'mode': 'attachment_only'
        }
