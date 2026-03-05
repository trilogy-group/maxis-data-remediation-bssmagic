"""
IoT QBS Apex REST API Smoke Tests

Validates that the Apex REST APIs (deployed by Ashish) match the API specification
documented in 'iot-qbs module/IoT QBS Service Remediation API Specific'.

Tests API 1 (GET discovery) and API 2 (GET pc-data) against the live sandbox.
Does NOT test API 3 (PUT services) or API 4 (POST release) to avoid modifying data.

Usage:
    cd batch-orchestrator
    source .venv/bin/activate
    python -m pytest tests/test_iot_qbs_apex.py -v -s
"""

import json
import os
import pytest
import httpx

# Load credentials from environment variables (set in .env or CI/CD)
SF_LOGIN_URL = os.getenv("SF_LOGIN_URL", "https://test.salesforce.com")
SF_USERNAME = os.getenv("SF_USERNAME")  # e.g., user@example.com.sandbox
SF_PASSWORD = os.getenv("SF_PASSWORD")  # Salesforce password
SF_SECURITY_TOKEN = os.getenv("SF_SECURITY_TOKEN")  # Security token
SF_CLIENT_ID = os.getenv("SF_CLIENT_ID")  # OAuth consumer key
SF_CLIENT_SECRET = os.getenv("SF_CLIENT_SECRET")  # OAuth consumer secret

# Validate required credentials
if not all([SF_USERNAME, SF_PASSWORD, SF_SECURITY_TOKEN, SF_CLIENT_ID, SF_CLIENT_SECRET]):
    pytest.skip("Salesforce credentials not configured (set SF_USERNAME, SF_PASSWORD, SF_SECURITY_TOKEN, SF_CLIENT_ID, SF_CLIENT_SECRET)")


API_BASE_PATH = "/services/apexrest/api/v1/iot-qbs-orders"

KNOWN_HELD_ORCHESTRATIONS = [
    "a1dMS00000109cEYAQ",   # Order a20MS000000AU6UYAW - known mismatch case
    "a1dMS000000Bt1BYAS",   # Order a20MS0000002wntYAA - IOT SERVICE SIT PRODUCTION DEFECT
    "a1dMS0000002SeZYAU",   # Order a20Hy000002WuQ6IAK - YJWTEST IoT Patching 2
    "a1dHy000003gNaxIAE",   # Order a20Hy000002WuQ6IAK - YJWTEST IoT Patching
    "a1dHy000003g8nAIAQ",   # Order a20Hy000003pspLIAQ - Cloned IoT
]

KNOWN_ORDER_WITH_MISMATCH = "a20MS000000AU6UYAW"
KNOWN_PC1 = "a0xMS000000BiaPYAS"  # No Change, qty=7
KNOWN_PC2 = "a0xMS000000Bic1YAC"  # Change APN, qty=3


# ---------------------------------------------------------------------------
# OAuth helper
# ---------------------------------------------------------------------------

def get_salesforce_token() -> tuple[str, str]:
    """
    Get OAuth access token via username-password flow.
    Returns (instance_url, access_token).
    """
    resp = httpx.post(
        f"{SF_LOGIN_URL}/services/oauth2/token",
        data={
            "grant_type": "password",
            "client_id": SF_CLIENT_ID,
            "client_secret": SF_CLIENT_SECRET,
            "username": SF_USERNAME,
            "password": SF_PASSWORD + SF_SECURITY_TOKEN,
        },
        timeout=30.0,
    )
    resp.raise_for_status()
    body = resp.json()
    return body["instance_url"], body["access_token"]


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def sf_session():
    """Authenticated Salesforce session with instance URL and token."""
    instance_url, token = get_salesforce_token()
    print(f"\n  Instance URL: {instance_url}")
    return {"instance_url": instance_url, "token": token}


@pytest.fixture(scope="module")
def sf_client(sf_session):
    """httpx client pre-configured for Apex REST calls."""
    return httpx.Client(
        base_url=sf_session["instance_url"],
        headers={
            "Authorization": f"Bearer {sf_session['token']}",
            "Content-Type": "application/json",
        },
        timeout=60.0,
    )


@pytest.fixture(scope="module")
def api1_response(sf_client):
    """Cached API 1 response for the first known held orchestration."""
    orch_id = KNOWN_HELD_ORCHESTRATIONS[0]
    resp = sf_client.get(f"{API_BASE_PATH}/{orch_id}")
    return resp


# ---------------------------------------------------------------------------
# Test 1: OAuth + API 1 Smoke Test
# ---------------------------------------------------------------------------

class TestOAuthAndAPI1:
    """Validate OAuth works and API 1 returns expected structure."""

    def test_oauth_token_acquisition(self, sf_session):
        assert sf_session["instance_url"], "Instance URL should not be empty"
        assert sf_session["token"], "Token should not be empty"
        assert "salesforce.com" in sf_session["instance_url"]

    def test_api1_returns_200(self, api1_response):
        print(f"\n  API 1 status: {api1_response.status_code}")
        if api1_response.status_code != 200:
            print(f"  Response body: {api1_response.text[:2000]}")
        assert api1_response.status_code == 200

    def test_api1_has_success_flag(self, api1_response):
        body = api1_response.json()
        assert "success" in body, f"Missing 'success' key. Keys: {list(body.keys())}"
        print(f"\n  success: {body['success']}")

    def test_api1_has_orchestration_process(self, api1_response):
        body = api1_response.json()
        assert "orchestrationProcess" in body, f"Missing 'orchestrationProcess'. Keys: {list(body.keys())}"
        op = body["orchestrationProcess"]
        print(f"\n  orchestrationProcess keys: {list(op.keys())}")
        assert "id" in op, f"Missing 'id' in orchestrationProcess"
        assert "onHold" in op, f"Missing 'onHold' in orchestrationProcess"

    def test_api1_has_product_configurations(self, api1_response):
        body = api1_response.json()
        assert "productConfigurations" in body, f"Missing 'productConfigurations'. Keys: {list(body.keys())}"
        pcs = body["productConfigurations"]
        assert isinstance(pcs, list), f"productConfigurations should be a list, got {type(pcs)}"
        assert len(pcs) > 0, "productConfigurations should not be empty"

        pc = pcs[0]
        print(f"\n  PC count: {len(pcs)}")
        print(f"  First PC keys: {list(pc.keys())}")
        for key in ["pcId", "guid", "solutionId"]:
            assert key in pc, f"Missing '{key}' in productConfigurations[0]"

    def test_api1_has_services(self, api1_response):
        body = api1_response.json()
        assert "services" in body, f"Missing 'services'. Keys: {list(body.keys())}"
        services = body["services"]
        assert isinstance(services, list), f"services should be a list, got {type(services)}"
        assert len(services) > 0, "services should not be empty"

        svc = services[0]
        print(f"\n  Service count: {len(services)}")
        print(f"  First service keys: {list(svc.keys())}")
        for key in ["serviceId", "simSerialNumber", "productConfigurationId"]:
            assert key in svc, f"Missing '{key}' in services[0]"

    def test_api1_print_full_response(self, api1_response):
        """Print the full API 1 response for visual inspection."""
        body = api1_response.json()
        print(f"\n  === API 1 FULL RESPONSE ===")
        print(json.dumps(body, indent=2)[:5000])


# ---------------------------------------------------------------------------
# Test 2: API 1 for all known orchestrations
# ---------------------------------------------------------------------------

class TestAPI1AllOrchestrations:
    """Call API 1 for each known held orchestration to validate consistency."""

    @pytest.mark.parametrize("orch_id", KNOWN_HELD_ORCHESTRATIONS)
    def test_api1_for_each_orchestration(self, sf_client, orch_id):
        resp = sf_client.get(f"{API_BASE_PATH}/{orch_id}")
        print(f"\n  {orch_id}: status={resp.status_code}")
        if resp.status_code == 200:
            body = resp.json()
            svc_count = len(body.get("services", []))
            pc_count = len(body.get("productConfigurations", []))
            on_hold = body.get("orchestrationProcess", {}).get("onHold")
            print(f"    PCs: {pc_count}, Services: {svc_count}, onHold: {on_hold}")
        else:
            print(f"    Error: {resp.text[:500]}")


# ---------------------------------------------------------------------------
# Test 3: API 2 Per-PC Data
# ---------------------------------------------------------------------------

class TestAPI2PcData:
    """Validate API 2 returns OE + Config data for each PC."""

    def test_api2_for_each_pc(self, sf_client, api1_response):
        body = api1_response.json()
        if not body.get("success"):
            pytest.skip("API 1 did not succeed, skipping API 2 tests")

        orch_id = body["orchestrationProcess"]["id"]
        pcs = body["productConfigurations"]

        for pc in pcs:
            pc_id = pc["pcId"]
            guid = pc.get("guid", "")
            solution_id = pc.get("solutionId", "")

            print(f"\n  --- API 2 for PC {pc_id} ---")
            print(f"    guid: {guid}")
            print(f"    solutionId: {solution_id}")

            resp = sf_client.get(
                f"{API_BASE_PATH}/{orch_id}/pc-data/{pc_id}",
                params={"guid": guid, "solutionId": solution_id},
            )
            print(f"    Status: {resp.status_code}")

            if resp.status_code != 200:
                print(f"    Error: {resp.text[:1000]}")
                continue

            pc_body = resp.json()
            print(f"    Response keys: {list(pc_body.keys())}")

            # Validate oeData
            assert "oeData" in pc_body, f"Missing 'oeData' in API 2 response for PC {pc_id}"
            oe_data = pc_body["oeData"]
            print(f"    oeData type: {type(oe_data).__name__}, length: {len(oe_data) if isinstance(oe_data, list) else 'N/A'}")

            if isinstance(oe_data, list) and len(oe_data) > 0:
                component = oe_data[0]
                print(f"    First component keys: {list(component.keys()) if isinstance(component, dict) else 'not a dict'}")
                configs = component.get("configurations", [])
                print(f"    Configurations count: {len(configs)}")

                if configs:
                    attrs = configs[0].get("attributes", [])
                    attr_names = [a.get("name") for a in attrs if isinstance(a, dict)]
                    print(f"    First configuration attribute names: {attr_names}")

                    iccid_attrs = [a for a in attrs if a.get("name") == "ICCID"]
                    print(f"    ICCID found: {len(iccid_attrs) > 0}")
                    if iccid_attrs:
                        print(f"    ICCID value: {iccid_attrs[0].get('value')}")

            # Validate configData
            assert "configData" in pc_body, f"Missing 'configData' in API 2 response for PC {pc_id}"
            config_data = pc_body["configData"]
            print(f"    configData type: {type(config_data).__name__}")

            if isinstance(config_data, dict):
                config_attrs = config_data.get("attributes", [])
                config_names = [a.get("name") for a in config_attrs if isinstance(a, dict)]
                print(f"    Config attribute names: {config_names}")


# ---------------------------------------------------------------------------
# Test 4: Build Truth Table from Live Data
# ---------------------------------------------------------------------------

class TestTruthTable:
    """Build {ICCID -> correct_pcId} truth table and detect mismatches."""

    def _extract_iccids_from_oe_data(self, oe_data: list) -> list[str]:
        """Extract all ICCIDs from an API 2 oeData response."""
        iccids = []
        if not isinstance(oe_data, list):
            return iccids
        for component in oe_data:
            if not isinstance(component, dict):
                continue
            for config in component.get("configurations", []):
                if not isinstance(config, dict):
                    continue
                for attr in config.get("attributes", []):
                    if isinstance(attr, dict) and attr.get("name") == "ICCID":
                        val = attr.get("value")
                        if val:
                            iccids.append(val)
        return iccids

    def _extract_oe_line_for_sim(self, oe_data: list, sim: str) -> dict:
        """Find the OE configuration line matching a specific ICCID."""
        if not isinstance(oe_data, list):
            return {}
        for component in oe_data:
            if not isinstance(component, dict):
                continue
            for config in component.get("configurations", []):
                if not isinstance(config, dict):
                    continue
                attrs = config.get("attributes", [])
                for attr in attrs:
                    if isinstance(attr, dict) and attr.get("name") == "ICCID" and attr.get("value") == sim:
                        return {a["name"]: a.get("value") for a in attrs if isinstance(a, dict)}
        return {}

    def test_build_truth_table_and_detect_mismatches(self, sf_client, api1_response):
        body = api1_response.json()
        if not body.get("success"):
            pytest.skip("API 1 did not succeed")

        orch_id = body["orchestrationProcess"]["id"]
        services = body["services"]
        pcs = body["productConfigurations"]

        print(f"\n  Orchestration: {orch_id}")
        print(f"  PCs: {len(pcs)}, Services: {len(services)}")

        # Build truth table: {ICCID -> pcId}
        truth_table: dict[str, str] = {}
        pc_oe_data: dict[str, list] = {}
        pc_config_data: dict[str, dict] = {}

        for pc in pcs:
            pc_id = pc["pcId"]
            guid = pc.get("guid", "")
            solution_id = pc.get("solutionId", "")

            resp = sf_client.get(
                f"{API_BASE_PATH}/{orch_id}/pc-data/{pc_id}",
                params={"guid": guid, "solutionId": solution_id},
            )

            if resp.status_code != 200:
                print(f"  WARN: API 2 failed for PC {pc_id}: {resp.status_code}")
                continue

            pc_body = resp.json()
            oe_data = pc_body.get("oeData", [])
            config_data = pc_body.get("configData", {})

            pc_oe_data[pc_id] = oe_data
            pc_config_data[pc_id] = config_data

            iccids = self._extract_iccids_from_oe_data(oe_data)
            print(f"\n  PC {pc_id}: {len(iccids)} ICCIDs in OE data")
            for iccid in iccids:
                if iccid in truth_table:
                    print(f"    DUPLICATE ICCID: {iccid} already in PC {truth_table[iccid]}")
                truth_table[iccid] = pc_id

        print(f"\n  Truth table size: {len(truth_table)} entries")

        # Check for mismatches
        mismatches = []
        orphans = []

        for svc in services:
            sim = svc.get("simSerialNumber")
            current_pc = svc.get("productConfigurationId")
            svc_id = svc.get("serviceId")

            if sim not in truth_table:
                orphans.append({"serviceId": svc_id, "sim": sim})
                continue

            correct_pc = truth_table[sim]
            if current_pc != correct_pc:
                mismatches.append({
                    "serviceId": svc_id,
                    "sim": sim,
                    "currentPc": current_pc,
                    "correctPc": correct_pc,
                })

        print(f"\n  === RESULTS ===")
        print(f"  Total services: {len(services)}")
        print(f"  Mismatches (Rule 1): {len(mismatches)}")
        print(f"  Orphan SIMs: {len(orphans)}")

        if mismatches:
            print(f"\n  Mismatched services:")
            for m in mismatches:
                sim_short = m['sim'][-4:] if m['sim'] else '????'
                oe_line = self._extract_oe_line_for_sim(pc_oe_data[m['correctPc']], m['sim'])
                print(f"    SIM ...{sim_short}: currently {m['currentPc']}, should be {m['correctPc']}")
                if oe_line:
                    print(f"      OE line attributes: {list(oe_line.keys())}")

        if orphans:
            print(f"\n  Orphan services (SIM not in any PC's OE data):")
            for o in orphans:
                print(f"    {o['serviceId']}: SIM {o['sim']}")

        # Count services per PC (actual vs expected from truth table)
        actual_counts: dict[str, int] = {}
        for svc in services:
            pc = svc.get("productConfigurationId", "unknown")
            actual_counts[pc] = actual_counts.get(pc, 0) + 1

        expected_counts: dict[str, int] = {}
        for iccid, pc_id in truth_table.items():
            expected_counts[pc_id] = expected_counts.get(pc_id, 0) + 1

        print(f"\n  PC service counts:")
        for pc_id in set(list(actual_counts.keys()) + list(expected_counts.keys())):
            actual = actual_counts.get(pc_id, 0)
            expected = expected_counts.get(pc_id, 0)
            match = "OK" if actual == expected else "MISMATCH"
            print(f"    {pc_id}: actual={actual}, expected={expected} [{match}]")


# ---------------------------------------------------------------------------
# Test 5: Error Handling
# ---------------------------------------------------------------------------

class TestErrorHandling:
    """Validate API error responses match the spec."""

    def test_api1_invalid_orchestration_id(self, sf_client):
        resp = sf_client.get(f"{API_BASE_PATH}/INVALID_ID_000000000")
        print(f"\n  Invalid ID status: {resp.status_code}")
        print(f"  Response: {resp.text[:500]}")
        assert resp.status_code in (400, 404, 500), f"Expected error status, got {resp.status_code}"

    def test_api2_invalid_pc_id(self, sf_client):
        orch_id = KNOWN_HELD_ORCHESTRATIONS[0]
        resp = sf_client.get(
            f"{API_BASE_PATH}/{orch_id}/pc-data/INVALID_PC_ID",
            params={"guid": "fake-guid", "solutionId": "fake-solution"},
        )
        print(f"\n  Invalid PC status: {resp.status_code}")
        print(f"  Response: {resp.text[:500]}")

    def test_api2_missing_guid_param(self, sf_client):
        orch_id = KNOWN_HELD_ORCHESTRATIONS[0]
        resp = sf_client.get(
            f"{API_BASE_PATH}/{orch_id}/pc-data/{KNOWN_PC1}",
        )
        print(f"\n  Missing guid status: {resp.status_code}")
        print(f"  Response: {resp.text[:500]}")
