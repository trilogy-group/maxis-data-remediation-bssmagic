# BSS Magic Runtime - Core Components

PostgreSQL database with Salesforce Foreign Data Wrapper + TMF Server.

## Structure

- `views/`: SQL views mapping CloudSense to TMF (49 files)
- `types/`: TMF type definitions (PostgreSQL + JSON)
- `fdw/`: Foreign Data Wrapper configuration and patches
- `tests/`: API and remediation chain tests

## Deploying Views

Views are ephemeral and lost on container restart. After ECS restart:

1. Wait 3 minutes for container startup
2. Trigger Salesforce foreign table import (via BSS Magic UI or ECS exec)
3. Deploy views:
   ```bash
   cd runtime/views
   ./apply_all_views.sh  # Production
   ./apply_sandbox_views.sh  # Sandbox
   ```

## View Development

**Key Constraints:**
- Use direct column references (pushes to Salesforce)
- Avoid COALESCE/CASE in filterable fields (client-side filtering)
- Use `ROW(...)::tmf."TypeName"` for complex types
- Test queries in PostgreSQL before exposing via TMF API

See [View Development Guide](../docs/5_View_Development_Guide.md)

## FDW Configuration

Salesforce FDW translates SQL to SOQL. See:
- [FDW Limitations](../docs/18_FDW_Limitations_and_Salesforce_Rate_Limiting.md)
