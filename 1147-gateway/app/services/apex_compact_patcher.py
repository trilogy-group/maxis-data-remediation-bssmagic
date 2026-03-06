"""
Compact Apex script that updates BOTH CloudSense DB and Attachment.
Optimized for minimal size while maintaining full functionality.
"""
from typing import Dict, List
from app.services.apex_executor import execute_anonymous_apex


async def patch_complete_compact(
    service_id: str,
    fields_to_patch: List[Dict]
) -> Dict:
    """
    Compact Apex that updates both CloudSense DB AND attachment.
    Minimal size to fit within URL limits.
    """
    
    # Build compact patch entries for CloudSense DB
    db_patch_code = []
    for field in fields_to_patch:
        field_name = field['fieldName']
        oe_name = 'PIC Email' if field_name == 'PICEmail' else field_name
        oe_name = 'Billing Account' if field_name == 'BillingAccount' else oe_name
        
        value = field['value'].replace("'", "\\'")
        label = (field.get('label') or value).replace("'", "\\'")
        
        # Compact attribute creation for CloudSense DB
        db_patch_code.append(
            f"cssmgnt.ProductProcessingUtility.Attribute {field_name.lower()}A=new cssmgnt.ProductProcessingUtility.Attribute();"
            f"{field_name.lower()}A.name='{oe_name}';{field_name.lower()}A.value='{value}';{field_name.lower()}A.displayValue='{label}';"
            f"cfg.attributes.add({field_name.lower()}A);"
        )
    
    db_patches = ''.join(db_patch_code)
    
    # Build compact patch map for JSON
    json_patch_code = []
    for field in fields_to_patch:
        field_name = field['fieldName']
        oe_name = 'PIC Email' if field_name == 'PICEmail' else field_name
        oe_name = 'Billing Account' if field_name == 'BillingAccount' else oe_name
        
        value = field['value'].replace("'", "\\'")
        label = (field.get('label') or value).replace("'", "\\'")
        json_patch_code.append(f"pm.put('{oe_name}',new Map<String,String>{{'v'=>'{value}','d'=>'{label}'}});")
    
    json_patches = ''.join(json_patch_code)
    
    # Compact full Apex script
    apex_script = f"""
Id sid='{service_id}';
csord__Service__c svc=[SELECT Id,csordtelcoa__Product_Configuration__c,csordtelcoa__Product_Configuration__r.cscfga__Product_Family__c FROM csord__Service__c WHERE Id=:sid];
Attachment att=[SELECT Body,ParentId FROM Attachment WHERE Name='ProductAttributeDetails.json' AND ParentId=:sid LIMIT 1];
Map<String,Object> js=(Map<String,Object>)JSON.deserializeUntyped(att.Body.toString());
String pcId=svc.csordtelcoa__Product_Configuration__c;
String pf=svc.csordtelcoa__Product_Configuration__r!=null?svc.csordtelcoa__Product_Configuration__r.cscfga__Product_Family__c:'';
List<Object> ncp=(List<Object>)js.get('NonCommercialProduct');
Map<Id,cssdm__Non_Commercial_Product_Association__c> ncm=new Map<Id,cssdm__Non_Commercial_Product_Association__c>([SELECT Id,Name,cssdm__Product_Definition__r.Name FROM cssdm__Non_Commercial_Product_Association__c LIMIT 5000]);
if(pcId!=null&&ncp!=null){{for(Object no:ncp){{Map<String,Object> nm=(Map<String,Object>)no;for(String sk:nm.keySet()){{String schId='';for(Id ni:ncm.keySet()){{cssdm__Non_Commercial_Product_Association__c nc=ncm.get(ni);String pdn=nc.cssdm__Product_Definition__r!=null?nc.cssdm__Product_Definition__r.Name:'';if(pf!=null&&pdn!=null&&pf.contains(pdn)&&sk.contains(nc.Name)){{schId=ni;break;}}}}if(String.isNotBlank(schId)){{Map<Id,List<cssmgnt.ProductProcessingUtility.Component>> oe=cssmgnt.API_1.getOEData(new List<Id>{{pcId}});if(oe.get(pcId)!=null){{for(cssmgnt.ProductProcessingUtility.Component cmp:oe.get(pcId)){{for(Object co:cmp.configurations){{cssmgnt.ProductProcessingUtility.Configuration cfg=(cssmgnt.ProductProcessingUtility.Configuration)co;{db_patches}}}}}cssmgnt.API_1.updateOEData(oe);}}}}}}}}}}
Map<String,Map<String,String>> pm=new Map<String,Map<String,String>>();
{json_patches}
if(ncp!=null){{for(Object o:ncp){{Map<String,Object> n=(Map<String,Object>)o;for(String k:n.keySet()){{Map<String,Object> s=(Map<String,Object>)n.get(k);List<Object> at=(List<Object>)s.get('attributes');if(at!=null){{for(String fn:pm.keySet()){{Map<String,String> fd=pm.get(fn);Boolean f=false;for(Object ao:at){{Map<String,Object> aa=(Map<String,Object>)ao;if(aa.get('name')==fn){{aa.put('value',fd.get('v'));aa.put('displayValue',fd.get('d'));f=true;break;}}}}if(!f){{Map<String,Object> na=new Map<String,Object>();na.put('name',fn);na.put('value',fd.get('v'));na.put('displayValue',fd.get('d'));at.add(na);}}}}}}}}}}}}
insert new Attachment(ParentId=sid,Name='ProductAttributeDetails_old.json',Body=att.Body,ContentType='application/json');
delete att;
insert new Attachment(ParentId=sid,Name='ProductAttributeDetails.json',Body=Blob.valueOf(JSON.serialize(js)),ContentType='application/json');
"""
    
    script_size = len(apex_script)
    print(f"[compact_patcher] Script size: {script_size} chars")
    
    try:
        result = await execute_anonymous_apex(apex_script)
        
        success = result.get('success', False)
        compiled = result.get('compiled', False)
        
        if not compiled:
            return {
                'success': False,
                'compiled': False,
                'error': result.get('error', 'Compilation failed'),
                'line': result.get('line'),
                'column': result.get('column')
            }
        
        return {
            'success': success,
            'compiled': compiled,
            'error': result.get('error') if not success else None,
            'output': result.get('output'),
            'patchedFields': fields_to_patch,
            'cloudsenseDBUpdated': success,
            'attachmentUpdated': success,
            'scriptSize': script_size
        }
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }
