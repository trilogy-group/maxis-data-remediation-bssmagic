"""
Unit tests for IoT QBS pure validation functions.

Tests use mock API responses based on the API spec worked example
(2 PCs, "Group A" with 7 SIMs and "Group B" with 3 SIMs) plus
real sandbox data patterns (parent "IOT Solution" PC with 0 OE entries).

Usage:
    cd batch-orchestrator
    python -m pytest tests/test_iot_qbs_pure.py -v
"""

import pytest

from app.services.iot_qbs_executor import (
    build_truth_table,
    extract_iccids_from_oe_data,
    extract_oe_line_for_sim,
    extract_config_attributes,
    check_safety,
    identify_parent_pcs,
    validate_services,
    build_patch_payloads,
    build_single_patch,
    check_revalidation,
    summarize_findings,
    summarize_payloads,
)
from app.models.schemas import ValidationFinding


# =============================================================================
# Test Fixtures: Mock API Responses
# =============================================================================

PC_A_ID = "a0xMS000000AIQHYA4"
PC_B_ID = "a0xMS000000BIQHYA4"
PC_PARENT_ID = "a0xMS000000PARENT1"

GUID_A = "e094a175-5fee-18d0-2b82-c752a8dd0289"
GUID_B = "f1a2b3c4-d5e6-7890-abcd-ef1234567890"
SOLUTION_ID = "a24MS000000ABlNYAW"


def _oe_line(iccid: str, msisdn: str, apn: str = "MACHINE1C", apn_type: str = "Public", ba: str = "BA-001") -> dict:
    """Helper to create a single OE configuration line (one SIM's attributes)."""
    return {
        "attributes": [
            {"name": "ICCID", "value": iccid, "displayValue": iccid},
            {"name": "MSISDN", "value": msisdn, "displayValue": msisdn},
            {"name": "APN Name", "value": apn, "displayValue": apn},
            {"name": "APN Type", "value": apn_type, "displayValue": apn_type},
            {"name": "IMSI", "value": f"50212{msisdn[-7:]}", "displayValue": f"50212{msisdn[-7:]}"},
            {"name": "Billing Account", "value": ba, "displayValue": ba},
        ]
    }


def _make_oe_data(configs: list[dict]) -> list:
    """Wrap configuration lines in the oeData component structure."""
    return [{"componentName": None, "configurations": configs}]


def _make_config_data(price_item: str = "a1PriceItem001", plan: str = "IoT Basic Plan", term: str = "24") -> dict:
    """Create a configData response."""
    return {
        "attributes": [
            {"name": "PriceItemId", "value": price_item},
            {"name": "Plan", "value": plan},
            {"name": "ContractTerm", "value": term},
            {"name": "OrderServiceType", "value": "Add"},
            {"name": "SIM", "value": "8960011234567890001"},
            {"name": "Billing Account", "value": "BA-001"},
        ]
    }


SIMS_A = [f"896001123456789000{i}" for i in range(1, 8)]  # 7 SIMs for PC A
SIMS_B = [f"896001123456789001{i}" for i in range(0, 3)]   # 3 SIMs for PC B


@pytest.fixture
def pc_a_oe_data():
    """OE data for PC A: 7 configurations, one per SIM."""
    configs = [_oe_line(sim, f"6012345{sim[-4:]}") for sim in SIMS_A]
    return _make_oe_data(configs)


@pytest.fixture
def pc_b_oe_data():
    """OE data for PC B: 3 configurations, one per SIM."""
    configs = [
        _oe_line(sim, f"6012345{sim[-4:]}", apn="MACHINE2D", ba="BA-002")
        for sim in SIMS_B
    ]
    return _make_oe_data(configs)


@pytest.fixture
def parent_oe_data():
    """Parent PC "IOT Solution": empty OE data (0 configurations)."""
    return _make_oe_data([])


@pytest.fixture
def all_pc_oe_data(pc_a_oe_data, pc_b_oe_data, parent_oe_data):
    return {
        PC_A_ID: pc_a_oe_data,
        PC_B_ID: pc_b_oe_data,
        PC_PARENT_ID: parent_oe_data,
    }


@pytest.fixture
def config_data_a():
    return _make_config_data("a1PriceItemA", "IoT Basic Plan", "24")


@pytest.fixture
def config_data_b():
    return _make_config_data("a1PriceItemB", "IoT Premium Plan", "36")


@pytest.fixture
def all_pc_config_data(config_data_a, config_data_b):
    return {
        PC_A_ID: config_data_a,
        PC_B_ID: config_data_b,
        PC_PARENT_ID: {"attributes": []},
    }


@pytest.fixture
def pcs_metadata():
    return [
        {"pcId": PC_A_ID, "name": "IoT SIM Plan - Group A", "guid": GUID_A, "solutionId": SOLUTION_ID},
        {"pcId": PC_B_ID, "name": "IoT SIM Plan - Group B", "guid": GUID_B, "solutionId": SOLUTION_ID},
        {"pcId": PC_PARENT_ID, "name": "IOT Solution", "guid": "", "solutionId": SOLUTION_ID},
    ]


@pytest.fixture
def correct_services():
    """Services where every SIM is linked to the correct PC (no mismatches)."""
    services = []
    for sim in SIMS_A:
        services.append({"serviceId": f"svc_{sim[-4:]}", "simSerialNumber": sim, "productConfigurationId": PC_A_ID})
    for sim in SIMS_B:
        services.append({"serviceId": f"svc_{sim[-4:]}", "simSerialNumber": sim, "productConfigurationId": PC_B_ID})
    return services


@pytest.fixture
def mismatched_services():
    """Services with 3 mismatches: last 3 SIMs of PC A are linked to PC B instead."""
    services = []
    for sim in SIMS_A[:4]:
        services.append({"serviceId": f"svc_{sim[-4:]}", "simSerialNumber": sim, "productConfigurationId": PC_A_ID})
    for sim in SIMS_A[4:]:
        services.append({"serviceId": f"svc_{sim[-4:]}", "simSerialNumber": sim, "productConfigurationId": PC_B_ID})
    for sim in SIMS_B:
        services.append({"serviceId": f"svc_{sim[-4:]}", "simSerialNumber": sim, "productConfigurationId": PC_B_ID})
    return services


# =============================================================================
# Tests: extract_iccids_from_oe_data
# =============================================================================

class TestExtractIccids:
    def test_extracts_all_iccids(self, pc_a_oe_data):
        iccids = extract_iccids_from_oe_data(pc_a_oe_data)
        assert len(iccids) == 7
        assert iccids[0] == SIMS_A[0]

    def test_empty_oe_data(self):
        assert extract_iccids_from_oe_data([]) == []

    def test_empty_configurations(self):
        oe = _make_oe_data([])
        assert extract_iccids_from_oe_data(oe) == []

    def test_non_list_input(self):
        assert extract_iccids_from_oe_data("not a list") == []
        assert extract_iccids_from_oe_data(None) == []

    def test_missing_iccid_attribute(self):
        configs = [{"attributes": [{"name": "MSISDN", "value": "123"}]}]
        oe = _make_oe_data(configs)
        assert extract_iccids_from_oe_data(oe) == []


# =============================================================================
# Tests: extract_oe_line_for_sim
# =============================================================================

class TestExtractOeLineForSim:
    def test_finds_matching_sim(self, pc_a_oe_data):
        line = extract_oe_line_for_sim(pc_a_oe_data, SIMS_A[0])
        assert line["ICCID"] == SIMS_A[0]
        assert "MSISDN" in line
        assert "APN Name" in line

    def test_returns_empty_for_unknown_sim(self, pc_a_oe_data):
        assert extract_oe_line_for_sim(pc_a_oe_data, "UNKNOWN_SIM") == {}

    def test_returns_empty_for_empty_data(self):
        assert extract_oe_line_for_sim([], "any_sim") == {}


# =============================================================================
# Tests: extract_config_attributes
# =============================================================================

class TestExtractConfigAttributes:
    def test_extracts_all_attributes(self, config_data_a):
        attrs = extract_config_attributes(config_data_a)
        assert attrs["PriceItemId"] == "a1PriceItemA"
        assert attrs["Plan"] == "IoT Basic Plan"
        assert attrs["ContractTerm"] == "24"

    def test_empty_config(self):
        assert extract_config_attributes({}) == {}
        assert extract_config_attributes({"attributes": []}) == {}

    def test_non_dict_input(self):
        assert extract_config_attributes("not a dict") == {}


# =============================================================================
# Tests: build_truth_table
# =============================================================================

class TestBuildTruthTable:
    def test_builds_correct_mapping(self, all_pc_oe_data):
        tt, dups = build_truth_table(all_pc_oe_data)
        assert len(tt) == 10  # 7 + 3 SIMs
        assert len(dups) == 0
        for sim in SIMS_A:
            assert tt[sim] == PC_A_ID
        for sim in SIMS_B:
            assert tt[sim] == PC_B_ID

    def test_parent_pc_has_no_entries(self, all_pc_oe_data):
        tt, _ = build_truth_table(all_pc_oe_data)
        pc_ids_in_tt = set(tt.values())
        assert PC_PARENT_ID not in pc_ids_in_tt

    def test_detects_duplicate_iccids(self):
        dup_sim = SIMS_A[0]
        pc_oe = {
            PC_A_ID: _make_oe_data([_oe_line(dup_sim, "601")]),
            PC_B_ID: _make_oe_data([_oe_line(dup_sim, "602")]),
        }
        tt, dups = build_truth_table(pc_oe)
        assert dup_sim in dups
        assert len(dups) == 1

    def test_empty_input(self):
        tt, dups = build_truth_table({})
        assert tt == {}
        assert dups == []


# =============================================================================
# Tests: identify_parent_pcs
# =============================================================================

class TestIdentifyParentPcs:
    def test_identifies_iot_solution_by_name(self, pcs_metadata, all_pc_oe_data, correct_services):
        parents = identify_parent_pcs(pcs_metadata, all_pc_oe_data, correct_services)
        assert PC_PARENT_ID in parents
        assert PC_A_ID not in parents
        assert PC_B_ID not in parents

    def test_identifies_parent_with_zero_oe_and_no_services(self):
        pcs = [{"pcId": "orphan_pc", "name": "Some PC"}]
        pc_oe = {"orphan_pc": _make_oe_data([])}
        services: list[dict] = []
        parents = identify_parent_pcs(pcs, pc_oe, services)
        assert "orphan_pc" in parents


# =============================================================================
# Tests: check_safety
# =============================================================================

class TestCheckSafety:
    def test_safe_when_all_sims_mapped(self, correct_services, all_pc_oe_data):
        tt, dups = build_truth_table(all_pc_oe_data)
        parents = {PC_PARENT_ID}
        result = check_safety(correct_services, tt, dups, all_pc_oe_data, parents)
        assert result.is_safe is True
        assert result.orphan_sims == []
        assert result.duplicate_sims == []
        assert result.empty_oe_pcs == []

    def test_unsafe_orphan_sim(self, all_pc_oe_data):
        services = [{"serviceId": "svc_x", "simSerialNumber": "UNKNOWN_SIM", "productConfigurationId": PC_A_ID}]
        tt, dups = build_truth_table(all_pc_oe_data)
        parents = {PC_PARENT_ID}
        result = check_safety(services, tt, dups, all_pc_oe_data, parents)
        assert result.is_safe is False
        assert "UNKNOWN_SIM" in result.orphan_sims

    def test_unsafe_duplicate_iccid(self, correct_services, all_pc_oe_data):
        dups = [SIMS_A[0]]
        tt, _ = build_truth_table(all_pc_oe_data)
        parents = {PC_PARENT_ID}
        result = check_safety(correct_services, tt, dups, all_pc_oe_data, parents)
        assert result.is_safe is False
        assert SIMS_A[0] in result.duplicate_sims

    def test_unsafe_empty_oe_non_parent_pc(self, correct_services):
        pc_oe = {
            PC_A_ID: _make_oe_data([_oe_line(SIMS_A[0], "601")]),
            PC_B_ID: _make_oe_data([]),  # empty but NOT parent
        }
        tt, dups = build_truth_table(pc_oe)
        parents: set[str] = set()
        result = check_safety(correct_services, tt, dups, pc_oe, parents)
        assert result.is_safe is False
        assert PC_B_ID in result.empty_oe_pcs


# =============================================================================
# Tests: validate_services
# =============================================================================

class TestValidateServices:
    def test_no_findings_when_correct(self, correct_services, all_pc_oe_data, all_pc_config_data):
        tt, _ = build_truth_table(all_pc_oe_data)
        parents = {PC_PARENT_ID}
        findings = validate_services(correct_services, tt, all_pc_oe_data, all_pc_config_data, parents)
        assert len(findings) == 0

    def test_detects_mismatches(self, mismatched_services, all_pc_oe_data, all_pc_config_data):
        tt, _ = build_truth_table(all_pc_oe_data)
        parents = {PC_PARENT_ID}
        findings = validate_services(mismatched_services, tt, all_pc_oe_data, all_pc_config_data, parents)
        assert len(findings) == 3
        for f in findings:
            assert f.rule == 1
            assert f.current_pc_id == PC_B_ID
            assert f.correct_pc_id == PC_A_ID

    def test_finding_has_field_mismatches(self, mismatched_services, all_pc_oe_data, all_pc_config_data):
        tt, _ = build_truth_table(all_pc_oe_data)
        parents = {PC_PARENT_ID}
        findings = validate_services(mismatched_services, tt, all_pc_oe_data, all_pc_config_data, parents)
        f = findings[0]
        assert "External_ID__c" in f.field_mismatches  # MSISDN
        assert "APN_Name__c" in f.field_mismatches
        assert f.field_mismatches["APN_Name__c"]["source"] == "oe"
        assert "Commercial_Product__c" in f.field_mismatches  # from config
        assert f.field_mismatches["Commercial_Product__c"]["source"] == "config"

    def test_skips_null_sim_services(self, all_pc_oe_data, all_pc_config_data):
        services = [{"serviceId": "svc_x", "simSerialNumber": None, "productConfigurationId": PC_A_ID}]
        tt, _ = build_truth_table(all_pc_oe_data)
        parents = {PC_PARENT_ID}
        findings = validate_services(services, tt, all_pc_oe_data, all_pc_config_data, parents)
        assert len(findings) == 0

    def test_skips_parent_pc_services(self, all_pc_oe_data, all_pc_config_data):
        services = [{"serviceId": "svc_parent", "simSerialNumber": "any_sim", "productConfigurationId": PC_PARENT_ID}]
        tt, _ = build_truth_table(all_pc_oe_data)
        parents = {PC_PARENT_ID}
        findings = validate_services(services, tt, all_pc_oe_data, all_pc_config_data, parents)
        assert len(findings) == 0


# =============================================================================
# Tests: build_patch_payloads
# =============================================================================

class TestBuildPatchPayloads:
    def test_groups_by_target_pc(self, mismatched_services, all_pc_oe_data, all_pc_config_data):
        tt, _ = build_truth_table(all_pc_oe_data)
        parents = {PC_PARENT_ID}
        findings = validate_services(mismatched_services, tt, all_pc_oe_data, all_pc_config_data, parents)
        payloads = build_patch_payloads(findings, all_pc_oe_data, all_pc_config_data)

        assert PC_A_ID in payloads
        assert len(payloads[PC_A_ID]) == 3

    def test_patch_includes_pc_relinkage(self, mismatched_services, all_pc_oe_data, all_pc_config_data):
        tt, _ = build_truth_table(all_pc_oe_data)
        parents = {PC_PARENT_ID}
        findings = validate_services(mismatched_services, tt, all_pc_oe_data, all_pc_config_data, parents)
        payloads = build_patch_payloads(findings, all_pc_oe_data, all_pc_config_data)

        patch = payloads[PC_A_ID][0]
        assert patch["fields"]["csordtelcoa__Product_Configuration__c"] == PC_A_ID

    def test_patch_includes_oe_fields(self, mismatched_services, all_pc_oe_data, all_pc_config_data):
        tt, _ = build_truth_table(all_pc_oe_data)
        parents = {PC_PARENT_ID}
        findings = validate_services(mismatched_services, tt, all_pc_oe_data, all_pc_config_data, parents)
        payloads = build_patch_payloads(findings, all_pc_oe_data, all_pc_config_data)

        patch = payloads[PC_A_ID][0]
        assert "External_ID__c" in patch["fields"]
        assert "APN_Name__c" in patch["fields"]
        assert "APN_Adress_Type__c" in patch["fields"]
        assert "Billing_Account__c" in patch["fields"]

    def test_patch_includes_config_fields(self, mismatched_services, all_pc_oe_data, all_pc_config_data):
        tt, _ = build_truth_table(all_pc_oe_data)
        parents = {PC_PARENT_ID}
        findings = validate_services(mismatched_services, tt, all_pc_oe_data, all_pc_config_data, parents)
        payloads = build_patch_payloads(findings, all_pc_oe_data, all_pc_config_data)

        patch = payloads[PC_A_ID][0]
        assert "Commercial_Product__c" in patch["fields"]
        assert "Commitment__c" in patch["fields"]
        assert "Contract_Term__c" in patch["fields"]

    def test_empty_findings(self, all_pc_oe_data, all_pc_config_data):
        payloads = build_patch_payloads([], all_pc_oe_data, all_pc_config_data)
        assert payloads == {}


# =============================================================================
# Tests: build_single_patch
# =============================================================================

class TestBuildSinglePatch:
    def test_correct_sim_lookup(self, all_pc_oe_data, all_pc_config_data):
        patch = build_single_patch(SIMS_A[0], PC_A_ID, all_pc_oe_data, all_pc_config_data)
        assert patch["csordtelcoa__Product_Configuration__c"] == PC_A_ID
        assert patch["APN_Name__c"] == "MACHINE1C"

    def test_sim_not_found_returns_pc_only(self, all_pc_oe_data, all_pc_config_data):
        patch = build_single_patch("UNKNOWN_SIM", PC_A_ID, all_pc_oe_data, all_pc_config_data)
        assert patch["csordtelcoa__Product_Configuration__c"] == PC_A_ID
        assert "APN_Name__c" not in patch


# =============================================================================
# Tests: check_revalidation
# =============================================================================

class TestCheckRevalidation:
    def test_no_remaining_after_fix(self, correct_services, all_pc_oe_data):
        tt, _ = build_truth_table(all_pc_oe_data)
        parents = {PC_PARENT_ID}
        remaining = check_revalidation(correct_services, tt, parents)
        assert len(remaining) == 0

    def test_remaining_if_still_wrong(self, mismatched_services, all_pc_oe_data):
        tt, _ = build_truth_table(all_pc_oe_data)
        parents = {PC_PARENT_ID}
        remaining = check_revalidation(mismatched_services, tt, parents)
        assert len(remaining) == 3


# =============================================================================
# Tests: Summarize helpers
# =============================================================================

class TestSummarize:
    def test_summarize_findings_empty(self):
        assert summarize_findings([]) == "No mismatches found"

    def test_summarize_findings_with_data(self):
        findings = [
            ValidationFinding(service_id="s1", rule=1),
            ValidationFinding(service_id="s2", rule=1),
        ]
        summary = summarize_findings(findings)
        assert "2 findings" in summary
        assert "Rule 1: 2" in summary

    def test_summarize_payloads(self):
        payloads = {
            "pc_a": [{"serviceId": "s1"}, {"serviceId": "s2"}],
            "pc_b": [{"serviceId": "s3"}],
        }
        summary = summarize_payloads(payloads)
        assert "3 services" in summary
        assert "2 target PCs" in summary
