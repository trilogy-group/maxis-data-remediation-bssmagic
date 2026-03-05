"""
IoT QBS Executor - Core business logic for IoT QBS Service-to-PC mismatch remediation.

Implements the 7-step remediation workflow from LLD v2:
  Step 1: RECEIVED       - Detect held orchestration (polling or webhook)
  Step 2: LOADING_DATA   - API 1 (discovery) + API 2 (per-PC OE/config data)
  Step 3: VALIDATING     - Build truth table, safety check, detect mismatches
  Step 4: SAFE_TO_PATCH  - Construct per-PC patch payloads
  Step 5: PATCHING       - API 3 (PUT services) per target PC
  Step 6: REVALIDATING   - API 1 again to confirm corrections
  Step 7: RELEASING      - API 4 (POST release)

Key design decisions:
  - OE data (ICCID-based) is the source of truth for SIM-to-PC mapping
  - Parent PCs ("IOT Solution" type, null SIM, 0 OE entries) are skipped
  - Safety checks gate patching: orphan SIMs, duplicate ICCIDs, empty OE on non-parent PCs
  - Patch payload uses SFDC field API names directly (API 3 applies via svc.put())
  - All business logic lives here; Apex APIs are a thin data layer

This file contains ONLY pure functions (no I/O, no side effects).
The full orchestration flow (with TMF client calls) will be added in Phase 2.
"""

import logging
from typing import Any, Optional

from ..models.schemas import (
    IoTQBSRemediationState,
    IoTQBSResult,
    IoTQBSSafetyCheck,
    QBS_OE_FIELD_MAPPING,
    QBS_CONFIG_FIELD_MAPPING,
    ValidationFinding,
)

logger = logging.getLogger(__name__)


# =============================================================================
# Pure Functions: Truth Table Construction
# =============================================================================


def build_truth_table(
    pc_oe_data: dict[str, list],
) -> tuple[dict[str, str], list[str]]:
    """Build {ICCID -> pcId} truth table from per-PC OE data.

    The truth table is the authoritative mapping: each ICCID (SIM serial number)
    belongs to exactly one PC based on the Order Enrichment data from getOEData().

    Args:
        pc_oe_data: {pcId: oeData_list} from API 2 responses.
            Each oeData_list is the "oeData" array from the API 2 response:
            [{componentName, configurations: [{attributes: [{name, value, displayValue}]}]}]

    Returns:
        (truth_table, duplicate_iccids)
        truth_table: {iccid: pcId} - each ICCID mapped to its owning PC
        duplicate_iccids: list of ICCIDs that appeared in multiple PCs (unsafe)
    """
    truth_table: dict[str, str] = {}
    duplicates: list[str] = []

    for pc_id, oe_data in pc_oe_data.items():
        iccids = extract_iccids_from_oe_data(oe_data)
        for iccid in iccids:
            if iccid in truth_table:
                if iccid not in duplicates:
                    duplicates.append(iccid)
                logger.warning(
                    f"Duplicate ICCID {iccid}: already in PC {truth_table[iccid]}, "
                    f"also found in PC {pc_id}"
                )
            else:
                truth_table[iccid] = pc_id

    return truth_table, duplicates


def extract_iccids_from_oe_data(oe_data: list) -> list[str]:
    """Extract all ICCID values from an API 2 oeData response.

    OE data structure (from API spec):
    [{
        "componentName": null | str,
        "configurations": [{
            "attributes": [{"name": "ICCID", "value": "896001...", "displayValue": "..."}]
        }]
    }]
    """
    iccids: list[str] = []
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
                        iccids.append(str(val))
    return iccids


def extract_oe_line_for_sim(oe_data: list, sim: str) -> dict[str, str]:
    """Find the OE configuration line (attribute dict) matching a specific ICCID.

    Returns {attribute_name: value} for the matching configuration, or {} if not found.
    This provides the ground-truth field values for a service with that SIM.
    """
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
                if (
                    isinstance(attr, dict)
                    and attr.get("name") == "ICCID"
                    and str(attr.get("value", "")) == sim
                ):
                    return {
                        a["name"]: str(a.get("value", ""))
                        for a in attrs
                        if isinstance(a, dict) and a.get("name")
                    }
    return {}


def extract_config_attributes(config_data: dict) -> dict[str, str]:
    """Extract {name: value} from API 2 configData response.

    Config data structure: {"attributes": [{"name": "PriceItemId", "value": "..."}]}
    """
    result: dict[str, str] = {}
    if not isinstance(config_data, dict):
        return result
    for attr in config_data.get("attributes", []):
        if isinstance(attr, dict) and attr.get("name"):
            result[attr["name"]] = str(attr.get("value", ""))
    return result


# =============================================================================
# Pure Functions: Safety Checks
# =============================================================================


def check_safety(
    services: list[dict],
    truth_table: dict[str, str],
    duplicate_iccids: list[str],
    pc_oe_data: dict[str, list],
    parent_pc_ids: set[str],
) -> IoTQBSSafetyCheck:
    """Run safety checks before allowing patching.

    Unsafe scenarios (from LLD v2):
    1. Orphan SIMs: service has a SIM not found in any PC's OE data
    2. Duplicate ICCIDs: same ICCID appears in multiple PCs
    3. Empty OE on non-parent PCs: a leaf PC returned 0 OE entries (data issue)

    Parent PCs (IoT Solution type) are expected to have 0 OE entries and are excluded.

    Args:
        services: API 1 services list [{serviceId, simSerialNumber, productConfigurationId}]
        truth_table: {iccid -> pcId} from build_truth_table
        duplicate_iccids: ICCIDs found in multiple PCs
        pc_oe_data: {pcId -> oeData_list} from API 2
        parent_pc_ids: set of PC IDs identified as parent/bundle PCs (to skip)
    """
    orphan_sims: list[str] = []
    empty_oe_pcs: list[str] = []

    for svc in services:
        sim = svc.get("simSerialNumber")
        if not sim:
            continue
        if sim not in truth_table:
            orphan_sims.append(sim)

    for pc_id, oe_data in pc_oe_data.items():
        if pc_id in parent_pc_ids:
            continue
        iccids = extract_iccids_from_oe_data(oe_data)
        if len(iccids) == 0:
            empty_oe_pcs.append(pc_id)

    is_safe = (
        len(orphan_sims) == 0
        and len(duplicate_iccids) == 0
        and len(empty_oe_pcs) == 0
    )

    return IoTQBSSafetyCheck(
        orphan_sims=orphan_sims,
        duplicate_sims=duplicate_iccids,
        empty_oe_pcs=empty_oe_pcs,
        is_safe=is_safe,
    )


def identify_parent_pcs(
    pcs: list[dict],
    pc_oe_data: dict[str, list],
    services: list[dict],
) -> set[str]:
    """Identify parent/bundle PCs that should be skipped in validation.

    A parent PC is identified by:
    - Its name contains "IOT Solution" (case-insensitive), OR
    - It has 0 OE entries AND no services are linked to it with a SIM
    """
    parent_ids: set[str] = set()

    services_by_pc: dict[str, list[dict]] = {}
    for svc in services:
        pc_id = svc.get("productConfigurationId", "")
        services_by_pc.setdefault(pc_id, []).append(svc)

    for pc in pcs:
        pc_id = pc.get("pcId", "")
        pc_name = (pc.get("name") or "").lower()

        if "iot solution" in pc_name:
            parent_ids.add(pc_id)
            continue

        oe_data = pc_oe_data.get(pc_id, [])
        iccids = extract_iccids_from_oe_data(oe_data)
        pc_services = services_by_pc.get(pc_id, [])
        pc_sims = [s.get("simSerialNumber") for s in pc_services if s.get("simSerialNumber")]

        if len(iccids) == 0 and len(pc_sims) == 0:
            parent_ids.add(pc_id)

    return parent_ids


# =============================================================================
# Pure Functions: Validation (Mismatch Detection)
# =============================================================================


def validate_services(
    services: list[dict],
    truth_table: dict[str, str],
    pc_oe_data: dict[str, list],
    pc_config_data: dict[str, dict],
    parent_pc_ids: set[str],
) -> list[ValidationFinding]:
    """Validate all services against the truth table and detect mismatches.

    Two types of findings:
    - Rule 1: Wrong PC linkage (service's current PC != correct PC per truth table)
    - Rule 2: Wrong field values (OE/config attributes on service don't match source)

    Note: Rule 2 requires comparing service field values against OE data. Since API 1
    only returns serviceId/simSerialNumber/productConfigurationId, field-level comparison
    requires additional service field data. For now, we flag Rule 1 mismatches and
    construct the patch payload with all OE fields from the correct PC.

    Args:
        services: [{serviceId, simSerialNumber, productConfigurationId}] from API 1
        truth_table: {iccid -> pcId}
        pc_oe_data: {pcId -> oeData_list} from API 2
        pc_config_data: {pcId -> configData_dict} from API 2
        parent_pc_ids: PCs to skip
    """
    findings: list[ValidationFinding] = []

    for svc in services:
        svc_id = svc.get("serviceId", "")
        sim = svc.get("simSerialNumber")
        current_pc = svc.get("productConfigurationId", "")

        if not sim:
            continue

        if current_pc in parent_pc_ids:
            continue

        if sim not in truth_table:
            continue

        correct_pc = truth_table[sim]

        if current_pc != correct_pc:
            oe_line = extract_oe_line_for_sim(
                pc_oe_data.get(correct_pc, []), sim
            )
            findings.append(ValidationFinding(
                service_id=svc_id,
                sim_serial_number=sim,
                current_pc_id=current_pc,
                correct_pc_id=correct_pc,
                rule=1,
                field_mismatches=_build_field_mismatch_dict(oe_line, pc_config_data.get(correct_pc, {})),
            ))

    return findings


def _build_field_mismatch_dict(
    oe_line: dict[str, str],
    config_data: dict,
) -> dict[str, dict]:
    """Build field mismatch dict from OE line and config data.

    Maps OE attribute names to SFDC field names, recording the expected value
    from the correct PC's OE/config data. We don't know the current service
    field values (API 1 doesn't return them), so "current" is set to None.

    Returns: {sfdc_field_name: {"expected": value, "source": "oe"|"config"}}
    """
    mismatches: dict[str, dict] = {}

    for oe_attr_name, sfdc_field in QBS_OE_FIELD_MAPPING.items():
        expected = oe_line.get(oe_attr_name)
        if expected:
            mismatches[sfdc_field] = {"expected": expected, "source": "oe"}

    config_attrs = extract_config_attributes(config_data)
    for config_attr_name, sfdc_field in QBS_CONFIG_FIELD_MAPPING.items():
        expected = config_attrs.get(config_attr_name)
        if expected:
            mismatches[sfdc_field] = {"expected": expected, "source": "config"}

    return mismatches


# =============================================================================
# Pure Functions: Patch Payload Construction
# =============================================================================


def build_patch_payloads(
    findings: list[ValidationFinding],
    pc_oe_data: dict[str, list],
    pc_config_data: dict[str, dict],
) -> dict[str, list[dict]]:
    """Build per-PC patch payloads for API 3.

    Groups mismatched services by their correct (target) PC, then for each service
    constructs a patch with:
    - csordtelcoa__Product_Configuration__c = correct PC ID (re-linkage)
    - OE-sourced fields: APN_Name__c, APN_Adress_Type__c, External_ID__c, Billing_Account__c
    - Config-sourced fields: Commercial_Product__c, Commitment__c, Contract_Term__c
      (only if configData is non-empty -- blocked in sandbox currently)

    Returns: {target_pcId: [{serviceId, fields: {sfdc_field: value}}]}
    This structure matches the API 3 request body exactly.
    """
    payloads_by_pc: dict[str, list[dict]] = {}

    for finding in findings:
        if finding.rule != 1:
            continue

        target_pc = finding.correct_pc_id
        if not target_pc:
            continue

        fields = build_single_patch(
            sim=finding.sim_serial_number or "",
            target_pc_id=target_pc,
            pc_oe_data=pc_oe_data,
            pc_config_data=pc_config_data,
        )

        if not fields:
            logger.warning(
                f"Empty patch for service {finding.service_id} "
                f"(SIM={finding.sim_serial_number}, target PC={target_pc})"
            )
            continue

        payloads_by_pc.setdefault(target_pc, []).append({
            "serviceId": finding.service_id,
            "fields": fields,
        })

    return payloads_by_pc


def build_single_patch(
    sim: str,
    target_pc_id: str,
    pc_oe_data: dict[str, list],
    pc_config_data: dict[str, dict],
) -> dict[str, str]:
    """Build the fields dict for a single service patch.

    Always includes the PC re-linkage field.
    Adds OE-sourced fields from the matching ICCID line in the target PC's OE data.
    Adds config-sourced fields from the target PC's config data (if available).
    """
    fields: dict[str, str] = {}

    fields["csordtelcoa__Product_Configuration__c"] = target_pc_id

    oe_data = pc_oe_data.get(target_pc_id, [])
    oe_line = extract_oe_line_for_sim(oe_data, sim)

    for oe_attr_name, sfdc_field in QBS_OE_FIELD_MAPPING.items():
        value = oe_line.get(oe_attr_name)
        if value:
            fields[sfdc_field] = value

    config_data = pc_config_data.get(target_pc_id, {})
    config_attrs = extract_config_attributes(config_data)
    for config_attr_name, sfdc_field in QBS_CONFIG_FIELD_MAPPING.items():
        value = config_attrs.get(config_attr_name)
        if value:
            fields[sfdc_field] = value

    return fields


# =============================================================================
# Pure Functions: Revalidation
# =============================================================================


def check_revalidation(
    services_after: list[dict],
    truth_table: dict[str, str],
    parent_pc_ids: set[str],
) -> list[dict]:
    """Compare post-patch service state against truth table.

    Called after patching with fresh API 1 data. Returns list of services
    still mismatched (should be empty if patching succeeded).
    """
    remaining: list[dict] = []

    for svc in services_after:
        sim = svc.get("simSerialNumber")
        current_pc = svc.get("productConfigurationId", "")

        if not sim or sim not in truth_table:
            continue
        if current_pc in parent_pc_ids:
            continue

        correct_pc = truth_table[sim]
        if current_pc != correct_pc:
            remaining.append({
                "serviceId": svc.get("serviceId", ""),
                "sim": sim,
                "currentPc": current_pc,
                "correctPc": correct_pc,
            })

    return remaining


# =============================================================================
# Helpers
# =============================================================================


def summarize_findings(findings: list[ValidationFinding]) -> str:
    """Human-readable summary of validation findings for logging."""
    if not findings:
        return "No mismatches found"

    by_rule: dict[int, int] = {}
    for f in findings:
        by_rule[f.rule] = by_rule.get(f.rule, 0) + 1

    parts = []
    for rule, count in sorted(by_rule.items()):
        parts.append(f"Rule {rule}: {count}")
    return f"{len(findings)} findings ({', '.join(parts)})"


def summarize_payloads(payloads: dict[str, list[dict]]) -> str:
    """Human-readable summary of patch payloads for logging."""
    total_services = sum(len(svcs) for svcs in payloads.values())
    return f"{total_services} services across {len(payloads)} target PCs"
