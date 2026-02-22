"""Patch the REST FDW to add stub_select option for write-only endpoints."""
import sys

FDW_PATH = "/usr/local/lib/python3.11/dist-packages/fdw_rest/rest_fdw.py"

content = open(FDW_PATH).read()

# 1. Add stub_select option parsing in __init__
old_init = 'self.get_before_update = options.get("get_before_update", "false").lower() == "true"'
new_init = old_init + '\n        self.stub_select = options.get("stub_select", "false").lower() == "true"'

if "stub_select" in content:
    print("Already patched, skipping")
    sys.exit(0)

content = content.replace(old_init, new_init, 1)

# 2. Add stub logic at top of execute() -- skip GET for write-only endpoints
old_exec = """    def execute(self, quals, columns, sortkeys=None, limit=None, offset=None):
        
        # Extract parameter values from quals"""

new_exec = """    def execute(self, quals, columns, sortkeys=None, limit=None, offset=None):
        
        # Write-only endpoints: return a stub row from quals instead of GET
        if self.stub_select:
            stub = {}
            for qual in quals:
                stub[qual.field_name] = qual.value
            yield stub
            return

        # Extract parameter values from quals"""

content = content.replace(old_exec, new_exec, 1)

open(FDW_PATH, "w").write(content)
print("REST FDW patched with stub_select support")
