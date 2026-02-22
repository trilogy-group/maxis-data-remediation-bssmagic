"""
TMF API Client for the Batch Orchestrator.
All orchestrator actions go through the TMF API (ALB), not direct DB access.
This keeps the architecture clean (Layer 2 → Layer 1).
"""

import json
import logging
from typing import Any, Optional

import httpx

logger = logging.getLogger(__name__)


class TMFClient:
    """
    HTTP client for the BSS Magic TMF Runtime API.
    Wraps BatchJob, BatchSchedule, and SolutionManagement endpoints.
    """

    def __init__(
        self,
        base_url: str = "http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com",
        api_key: str = "bssmagic-d58d6761265b01accc13e8b21bae8282",
        timeout: float = 30.0,
    ):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.timeout = timeout
        self._headers = {
            "X-API-Key": api_key,
            "Content-Type": "application/json",
        }

    def _client(self) -> httpx.Client:
        return httpx.Client(
            base_url=self.base_url,
            headers=self._headers,
            timeout=self.timeout,
        )

    # =========================================================================
    # BatchSchedule endpoints
    # =========================================================================

    def list_schedules(self, is_active: Optional[bool] = None) -> list[dict]:
        """GET /tmf-api/batchProcessing/v1/batchSchedule"""
        params = {}
        if is_active is not None:
            params["isActive"] = str(is_active).lower()
        
        with self._client() as client:
            resp = client.get("/tmf-api/batchProcessing/v1/batchSchedule", params=params)
            resp.raise_for_status()
            return resp.json()

    def get_schedule(self, schedule_id: str) -> dict:
        """GET /tmf-api/batchProcessing/v1/batchSchedule/{id}"""
        with self._client() as client:
            resp = client.get(f"/tmf-api/batchProcessing/v1/batchSchedule/{schedule_id}")
            resp.raise_for_status()
            return resp.json()

    def update_schedule(self, schedule_id: str, patch: dict) -> dict:
        """PATCH /tmf-api/batchProcessing/v1/batchSchedule/{id}"""
        with self._client() as client:
            resp = client.patch(
                f"/tmf-api/batchProcessing/v1/batchSchedule/{schedule_id}",
                json=patch,
            )
            resp.raise_for_status()
            return resp.json()

    # =========================================================================
    # BatchJob endpoints
    # =========================================================================

    def create_job(self, job_data: dict) -> dict:
        """POST /tmf-api/batchProcessing/v1/batchJob"""
        with self._client() as client:
            resp = client.post("/tmf-api/batchProcessing/v1/batchJob", json=job_data)
            resp.raise_for_status()
            return resp.json()

    def list_jobs(self, **filters) -> list[dict]:
        """GET /tmf-api/batchProcessing/v1/batchJob"""
        with self._client() as client:
            resp = client.get("/tmf-api/batchProcessing/v1/batchJob", params=filters)
            resp.raise_for_status()
            return resp.json()

    def get_job(self, job_id: str) -> dict:
        """GET /tmf-api/batchProcessing/v1/batchJob/{id}"""
        with self._client() as client:
            resp = client.get(f"/tmf-api/batchProcessing/v1/batchJob/{job_id}")
            resp.raise_for_status()
            return resp.json()

    def update_job(self, job_id: str, patch: dict) -> dict:
        """PATCH /tmf-api/batchProcessing/v1/batchJob/{id}"""
        with self._client() as client:
            resp = client.patch(
                f"/tmf-api/batchProcessing/v1/batchJob/{job_id}",
                json=patch,
            )
            resp.raise_for_status()
            return resp.json()

    def delete_job(self, job_id: str) -> None:
        """DELETE /tmf-api/batchProcessing/v1/batchJob/{id}"""
        with self._client() as client:
            resp = client.delete(f"/tmf-api/batchProcessing/v1/batchJob/{job_id}")
            resp.raise_for_status()

    # =========================================================================
    # ServiceProblem endpoints (solution discovery + status update)
    # =========================================================================

    def discover_solutions(
        self,
        category: str = "SolutionEmpty",
        max_count: int = 100,
    ) -> list[dict]:
        """
        Query ServiceProblem to find pending solution IDs for remediation.
        
        Returns list of dicts: [{"solutionId": "...", "serviceProblemId": "..."}, ...]
        Only returns solutions with remediationState == DETECTED.
        """
        with self._client() as client:
            resp = client.get(
                "/tmf-api/serviceProblemManagement/v5/serviceProblem",
                params={
                    "category": category,
                    "status": "pending",
                    "limit": str(max_count),
                },
                timeout=60.0,
            )
            resp.raise_for_status()
            problems = resp.json()

        if not isinstance(problems, list):
            logger.warning(f"discover_solutions: expected list, got {type(problems)}")
            return []

        discovered = []
        for sp in problems:
            chars = sp.get("characteristic", [])
            if isinstance(chars, str):
                try:
                    chars = json.loads(chars)
                except (json.JSONDecodeError, TypeError):
                    chars = []

            if not isinstance(chars, list):
                continue

            state = None
            sid = None
            for c in chars:
                if not isinstance(c, dict):
                    continue
                name = c.get("name", "")
                value = c.get("value", "")
                if name == "remediationState":
                    state = value
                elif name == "solutionId":
                    sid = value

            if sid and state == "DETECTED":
                discovered.append({
                    "solutionId": sid,
                    "serviceProblemId": sp.get("id", ""),
                })

        logger.info(f"Discovered {len(discovered)} solutions (category={category}, status=pending, state=DETECTED)")
        return discovered

    def resolve_service_problems(self, solution_ids: list[str]) -> dict[str, str]:
        """
        Resolve solution IDs to their corresponding ServiceProblem IDs.
        
        Queries all service problems and builds a mapping:
        {solutionId: serviceProblemId}
        
        Used by the /remediate endpoint to enable post-remediation SP updates.
        """
        if not solution_ids:
            return {}

        target_ids = set(solution_ids)
        mapping: dict[str, str] = {}

        with self._client() as client:
            resp = client.get(
                "/tmf-api/serviceProblemManagement/v5/serviceProblem",
                params={"limit": "200"},
                timeout=60.0,
            )
            resp.raise_for_status()
            problems = resp.json()

        if not isinstance(problems, list):
            logger.warning(f"resolve_service_problems: expected list, got {type(problems)}")
            return {}

        for sp in problems:
            chars = sp.get("characteristic", [])
            if isinstance(chars, str):
                try:
                    chars = json.loads(chars)
                except (json.JSONDecodeError, TypeError):
                    chars = []

            if not isinstance(chars, list):
                continue

            sid = None
            for c in chars:
                if isinstance(c, dict) and c.get("name") == "solutionId":
                    sid = c.get("value")
                    break

            if sid and sid in target_ids:
                mapping[sid] = sp.get("id", "")

        logger.info(f"Resolved {len(mapping)}/{len(solution_ids)} solution IDs to ServiceProblem IDs")
        return mapping

    def update_service_problem(
        self,
        problem_id: str,
        status: str,
        remediation_state: str,
        reason: str = "",
    ) -> dict:
        """
        Update a ServiceProblem's status and remediationState characteristic.
        
        Strategy: GET current state, merge changes, PATCH once with everything.
        """
        # Step 1: GET the current service problem to read its characteristics
        with self._client() as client:
            resp = client.get(
                f"/tmf-api/serviceProblemManagement/v5/serviceProblem/{problem_id}",
                timeout=30.0,
            )
            resp.raise_for_status()
            current = resp.json()

        # Step 2: Build merged characteristic array
        existing_chars = current.get("characteristic", [])
        if isinstance(existing_chars, str):
            try:
                existing_chars = json.loads(existing_chars)
            except (json.JSONDecodeError, TypeError):
                existing_chars = []
        if not isinstance(existing_chars, list):
            existing_chars = []

        updated = False
        merged_chars = []
        for c in existing_chars:
            if isinstance(c, dict) and c.get("name") == "remediationState":
                merged_chars.append({
                    "@type": "StringCharacteristic",
                    "name": "remediationState",
                    "value": remediation_state,
                })
                updated = True
            else:
                merged_chars.append(c)

        if not updated:
            merged_chars.append({
                "@type": "StringCharacteristic",
                "name": "remediationState",
                "value": remediation_state,
            })

        # Step 3: PATCH status first (simple field, always works)
        patch: dict[str, Any] = {"status": status}
        if reason:
            patch["statusChangeReason"] = reason

        with self._client() as client:
            resp = client.patch(
                f"/tmf-api/serviceProblemManagement/v5/serviceProblem/{problem_id}",
                json=patch,
                timeout=30.0,
            )
            resp.raise_for_status()
            result = resp.json()

        # Step 4: PATCH characteristics separately (array field)
        try:
            char_payload = {"characteristic": merged_chars}
            logger.info(f"PATCH characteristic for {problem_id}: {len(merged_chars)} entries, payload={json.dumps(char_payload)[:500]}")
            with self._client() as client:
                resp = client.patch(
                    f"/tmf-api/serviceProblemManagement/v5/serviceProblem/{problem_id}",
                    json=char_payload,
                    timeout=30.0,
                )
                resp.raise_for_status()
                result = resp.json()
                logger.info(f"Updated characteristic for {problem_id}: response has {len(result.get('characteristic', []))} entries")
        except Exception as e:
            logger.warning(f"Could not update characteristic for {problem_id}: {e}")

        return result

    # =========================================================================
    # SolutionManagement endpoints (REST FDW → Salesforce)
    # =========================================================================

    def validate_solution(self, solution_id: str) -> dict:
        """GET /tmf-api/solutionManagement/v5/solutionInfo/{id}"""
        with self._client() as client:
            resp = client.get(
                f"/tmf-api/solutionManagement/v5/solutionInfo/{solution_id}",
                timeout=60.0,  # Salesforce calls can be slow
            )
            resp.raise_for_status()
            return resp.json()

    def delete_solution(self, solution_id: str) -> dict:
        """DELETE /tmf-api/solutionManagement/v5/solutionMigration/{id}
        
        Returns {"success": True} on 204 No Content (successful delete).
        """
        with self._client() as client:
            resp = client.delete(
                f"/tmf-api/solutionManagement/v5/solutionMigration/{solution_id}",
                timeout=60.0,
            )
            resp.raise_for_status()
            # DELETE returns 204 No Content on success - no body to parse
            if resp.status_code == 204 or not resp.content:
                return {"success": True}
            return resp.json()

    def migrate_solution(self, solution_id: str) -> dict:
        """POST /tmf-api/solutionManagement/v5/solutionMigration"""
        with self._client() as client:
            resp = client.post(
                "/tmf-api/solutionManagement/v5/solutionMigration",
                json={"solutionId": solution_id},
                timeout=120.0,  # Migrations can take time
            )
            resp.raise_for_status()
            return resp.json()

    def poll_migration_status(self, solution_id: str) -> dict:
        """GET /tmf-api/solutionManagement/v5/migrationStatus/{id}"""
        with self._client() as client:
            resp = client.get(
                f"/tmf-api/solutionManagement/v5/migrationStatus/{solution_id}",
                timeout=30.0,
            )
            resp.raise_for_status()
            return resp.json()

    # =========================================================================
    # OE Service Management endpoints (Module 1867 - REST FDW → Salesforce)
    # =========================================================================

    def get_oe_service_info(self, service_id: str) -> dict:
        """GET /tmf-api/oeServiceManagement/v1/oeServiceInfo/{id}

        Step 1: Fetch raw OE data + eligibility from Salesforce.
        Returns attachmentContent, productDefinitionName, replacementServiceExists.
        BSS Magic uses this raw data to determine which attributes need patching.
        """
        with self._client() as client:
            resp = client.get(
                f"/tmf-api/oeServiceManagement/v1/oeServiceInfo/{service_id}",
                timeout=60.0,
            )
            resp.raise_for_status()
            return resp.json()

    def update_oe_attachment(self, service_id: str, patched_content: str) -> dict:
        """POST /tmf-api/oeServiceManagement/v1/oeServiceAttachment

        Step 3: Send patched attachment JSON to Salesforce for persistence.
        Salesforce Apex backs up old attachment and creates new one.
        BSS Magic constructs the patched JSON; Salesforce only persists.
        """
        with self._client() as client:
            resp = client.post(
                "/tmf-api/oeServiceManagement/v1/oeServiceAttachment",
                json={
                    "serviceId": service_id,
                    "attachmentContent": patched_content,
                },
                timeout=60.0,
            )
            resp.raise_for_status()
            return resp.json()

    def trigger_oe_remediation(
        self, service_id: str, product_definition_name: str
    ) -> dict:
        """POST /tmf-api/oeServiceManagement/v1/oeServiceRemediation

        Step 4: Trigger SM Service sync (cssmgnt.API_1.updateOEData()).
        Salesforce reads the patched attachment and syncs to Heroku Postgres.
        """
        with self._client() as client:
            resp = client.post(
                "/tmf-api/oeServiceManagement/v1/oeServiceRemediation",
                json={
                    "serviceId": service_id,
                    "productDefinitionName": product_definition_name,
                },
                timeout=120.0,
            )
            resp.raise_for_status()
            return resp.json()

    def discover_oe_services(self, max_count: int = 100) -> list[dict]:
        """Query ServiceProblem for pending 1867 OE services.

        Returns list of dicts: [{"serviceId": "...", "serviceProblemId": "...",
                                  "serviceType": "..."}, ...]
        Only returns services with remediationState == DETECTED.
        """
        with self._client() as client:
            resp = client.get(
                "/tmf-api/serviceProblemManagement/v5/serviceProblem",
                params={
                    "category": "PartialDataMissing",
                    "status": "pending",
                    "limit": str(max_count),
                },
                timeout=60.0,
            )
            resp.raise_for_status()
            problems = resp.json()

        if not isinstance(problems, list):
            logger.warning(f"discover_oe_services: expected list, got {type(problems)}")
            return []

        discovered = []
        for sp in problems:
            chars = sp.get("characteristic", [])
            if isinstance(chars, str):
                try:
                    chars = json.loads(chars)
                except (json.JSONDecodeError, TypeError):
                    chars = []

            if not isinstance(chars, list):
                continue

            state = None
            sid = None
            stype = None
            for c in chars:
                if not isinstance(c, dict):
                    continue
                name = c.get("name", "")
                value = c.get("value", "")
                if name == "remediationState":
                    state = value
                elif name == "serviceId":
                    sid = value
                elif name == "serviceType":
                    stype = value

            if sid and state == "DETECTED":
                discovered.append({
                    "serviceId": sid,
                    "serviceProblemId": sp.get("id", ""),
                    "serviceType": stype or "",
                })

        logger.info(
            f"Discovered {len(discovered)} OE services "
            f"(category=PartialDataMissing, status=pending, state=DETECTED)"
        )
        return discovered

    def create_oe_service_problem(
        self,
        service_id: str,
        service_type: str,
        missing_fields: list[str],
    ) -> dict:
        """Create a ServiceProblem record for a detected 1867 service."""
        payload = {
            "category": "PartialDataMissing",
            "status": "pending",
            "description": f"OE partial data missing for {service_type} service {service_id}",
            "priority": "medium",
            "characteristic": [
                {"@type": "StringCharacteristic", "name": "serviceId", "value": service_id},
                {"@type": "StringCharacteristic", "name": "serviceType", "value": service_type},
                {"@type": "StringCharacteristic", "name": "remediationState", "value": "DETECTED"},
                {"@type": "StringCharacteristic", "name": "missingFields", "value": ",".join(missing_fields)},
            ],
        }
        with self._client() as client:
            resp = client.post(
                "/tmf-api/serviceProblemManagement/v5/serviceProblem",
                json=payload,
                timeout=30.0,
            )
            resp.raise_for_status()
            return resp.json()

    def get_oe_enrichment_data(self, service_id: str) -> dict:
        """Resolve enrichment data for a service via TMF API calls.

        Performs the same 3-hop traversal as the dashboard usePicEmailLookup:
          Service -> BillingAccount -> Individual -> Email

        Returns dict with resolved values:
          {billingAccountId, billingAccountName, picEmail, reservedNumber}
        """
        result: dict[str, Any] = {}

        # Step 1: Get service (already have x_ fields from detection)
        try:
            with self._client() as client:
                resp = client.get(
                    f"/tmf-api/serviceInventoryManagement/v5/service/{service_id}",
                    timeout=30.0,
                )
                resp.raise_for_status()
                service = resp.json()

            result["reservedNumber"] = service.get("x_externalId") or ""
            ba_id = service.get("x_billingAccountId") or ""
            result["billingAccountId"] = ba_id
        except Exception as e:
            logger.warning(f"get_oe_enrichment_data: failed to fetch service {service_id}: {e}")
            return result

        if not ba_id:
            return result

        # Step 2: Get BillingAccount -> extract name + contact reference
        try:
            with self._client() as client:
                resp = client.get(
                    f"/tmf-api/accountManagement/v5/billingAccount/{ba_id}",
                    timeout=30.0,
                )
                resp.raise_for_status()
                ba = resp.json()

            result["billingAccountName"] = ba.get("name", "")

            contact_id = None
            for party in ba.get("relatedParty", []):
                if isinstance(party, dict) and party.get("role") == "contact":
                    contact_id = party.get("id")
                    break
        except Exception as e:
            logger.warning(f"get_oe_enrichment_data: failed to fetch BA {ba_id}: {e}")
            return result

        if not contact_id:
            return result

        # Step 3: Get Individual -> extract email
        try:
            with self._client() as client:
                resp = client.get(
                    f"/tmf-api/partyManagement/v5/individual/{contact_id}",
                    timeout=30.0,
                )
                resp.raise_for_status()
                individual = resp.json()

            for medium in individual.get("contactMedium", []):
                if isinstance(medium, dict):
                    char = medium.get("characteristic", {})
                    if isinstance(char, dict) and char.get("contactType") == "email":
                        result["picEmail"] = char.get("emailAddress", "")
                        break
        except Exception as e:
            logger.warning(f"get_oe_enrichment_data: failed to fetch individual {contact_id}: {e}")

        return result

    # =========================================================================
    # SolutionManagement endpoints (Module 1147 - REST FDW → Salesforce)
    # =========================================================================

    # Default SFDC field updates for post-migration
    _DEFAULT_SFDC_UPDATES = {
        "isMigratedToHeroku": True,
        "isConfigurationUpdatedToHeroku": True,
        "externalIdentifier": "",
    }

    def post_update_solution(
        self,
        solution_id: str,
        job_id: Optional[str] = None,
        sfdc_updates: Optional[dict] = None,
    ) -> dict:
        """POST /tmf-api/solutionManagement/v5/solutionPostUpdate

        Args:
            solution_id: Salesforce Solution ID
            job_id:      Optional jobId from the MIGRATE step (forwarded to Salesforce)
            sfdc_updates: Override default SFDC field updates
        """
        payload: dict = {
            "solutionId": solution_id,
            "migrationStatus": "COMPLETED",
            "sfdcUpdates": sfdc_updates if sfdc_updates is not None else self._DEFAULT_SFDC_UPDATES,
        }
        if job_id:
            payload["jobId"] = job_id

        with self._client() as client:
            resp = client.post(
                "/tmf-api/solutionManagement/v5/solutionPostUpdate",
                json=payload,
                timeout=60.0,
            )
            resp.raise_for_status()
            return resp.json()
