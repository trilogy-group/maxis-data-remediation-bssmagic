"""
OE Executor - Core business logic for Module 1867 (OE Partial Data Missing).

Ports and consolidates logic from the legacy 1147-gateway:
  - attachment_service.py  -> analyze_oe_content() detection
  - attachment_patcher.py  -> SET_IF_EMPTY JSON patching, enrichment
  - oe_patcher.py          -> field_mapping, dry_run, enrichment paths
  - apex_compact_patcher.py -> dual-system sync order

Key architectural differences from legacy:
  1. Attachment fetch/persist via TMF API (REST FDW -> Salesforce Apex),
     not direct SOQL or simple_salesforce.
  2. SM Service sync is a single API call (POST /remediations),
     not Apex Tooling executeAnonymous().
  3. Enrichment via TMF API (Service -> BA -> Contact -> Email),
     not direct SOQL queries.
  4. Strict SET_IF_EMPTY semantics: only fill empty values, never overwrite.

4-step remediation flow:
  Step 1: Fetch raw OE data from Salesforce (GET /migrated-services/{id})
  Step 2: Analyze + Patch attachment JSON in memory (Python business logic)
  Step 3: Persist patched attachment (PUT /migrated-services/{id}/attachment)
  Step 4: Trigger SM Service sync (POST /migrated-services/{id}/remediations)
"""

import json
import logging
import time
from copy import deepcopy
from typing import Any, Optional

from ..models.schemas import OERemediationState, OEResult
from .tmf_client import TMFClient

logger = logging.getLogger(__name__)


# =============================================================================
# OE Mandatory Fields (from LLD Appendix A)
# =============================================================================
# Source: attachment_service.py::analyze_oe_content()
# These are the fields that MUST be populated in NonCommercialProduct attributes.

MANDATORY_FIELDS: dict[str, list[str]] = {
    "Voice": ["ReservedNumber", "ResourceSystemGroupID", "NumberStatus", "PICEmail"],
    "Fibre Service": ["BillingAccount"],
    "eSMS Service": ["ReservedNumber", "eSMSUserName"],
    "Access Service": ["BillingAccount", "PICEmail"],
}

# =============================================================================
# Field Aliases (normalization for matching)
# =============================================================================
# Source: attachment_service.py::analyze_oe_content()
# The JSON attachment may use different casing/spacing for the same logical field.

FIELD_ALIASES: dict[str, list[str]] = {
    "ReservedNumber": [
        "ReservedNumber", "reservedNumber", "Reserved Number",
        "reserved number", "Reserved_Number",
    ],
    "ResourceSystemGroupID": [
        "ResourceSystemGroupID", "resourceSystemGroupId",
        "Resource System Group ID", "ResourceSystemGroupId",
    ],
    "NumberStatus": [
        "NumberStatus", "numberStatus", "Number Status", "Number_Status",
    ],
    "PICEmail": [
        "PICEmail", "picEmail", "PIC Email", "PIC_Email", "pic email",
    ],
    "BillingAccount": [
        "BillingAccount", "billingAccount", "Billing Account",
        "billing account", "Billing_Account",
    ],
    "eSMSUserName": [
        "eSMSUserName", "esmsUserName", "eSMS UserName",
        "eSMS_UserName", "esms username",
    ],
}

# =============================================================================
# OE Schema Mapping (service type -> NonCommercialProduct schema key substring)
# =============================================================================
# Source: attachment_patcher.py (schema_mapping dict)
# Used to find the correct schema object inside NonCommercialProduct[].

OE_SCHEMA_MAPPING: dict[str, str] = {
    "Voice": "Voice OE",
    "Fibre Service": "Fibre Service OE",
    "eSMS Service": "eSMS OE",
    "Access Service": "Access OE",
}

# =============================================================================
# Field Name Mapping (UI/canonical name -> OE JSON attribute name)
# =============================================================================
# Source: attachment_patcher.py (field_name_mapping dict)
# NonCommercialProduct attributes use names WITH SPACES in some cases.

FIELD_NAME_TO_OE: dict[str, str] = {
    "BillingAccount": "Billing Account",
    "ReservedNumber": "ReservedNumber",
    "ResourceSystemGroupID": "ResourceSystemGroupID",
    "NumberStatus": "NumberStatus",
    "PICEmail": "PIC Email",
    "eSMSUserName": "eSMS UserName",
}

# =============================================================================
# Hardcoded Constants (Voice services)
# =============================================================================
# Source: attachment_patcher.py (lines 131-151)
# ResourceSystemGroupID and NumberStatus are always fixed for Voice.

VOICE_CONSTANTS: dict[str, str] = {
    "ResourceSystemGroupID": "Migrated",
    "NumberStatus": "Reserved",
}


class OEExecutor:
    """
    Executes the 4-step OE remediation flow for a single service.

    Usage:
        executor = OEExecutor(tmf_client)
        result = executor.remediate("a0Xxx...")
    """

    def __init__(self, tmf_client: TMFClient):
        self.tmf = tmf_client

    def remediate(
        self,
        service_id: str,
        enrichment_data: Optional[dict] = None,
        dry_run: bool = False,
    ) -> OEResult:
        """
        Full 4-step OE remediation for a single service.

        Args:
            service_id: Salesforce Service__c ID
            enrichment_data: Pre-fetched enrichment values (picEmail, reservedNumber,
                             billingAccountId, billingAccountName). If None, will be
                             resolved via TMF API calls.
            dry_run: If True, analyze and compute patch but do NOT persist or trigger
                     SM sync. Returns the result with fields_patched populated.

        Returns:
            OEResult with final_state and details.
        """
        start = time.time()

        # -----------------------------------------------------------------
        # Step 1: Fetch raw OE data from Salesforce
        # -----------------------------------------------------------------
        try:
            info = self.tmf.get_oe_service_info(service_id)
        except Exception as e:
            return self._fail(service_id, "FETCH", str(e), start)

        if not _is_success(info):
            msg = info.get("message", "Unknown error from Salesforce")
            code = info.get("errorCode", "")
            return self._fail(service_id, "FETCH", f"{code}: {msg}", start)

        # Check eligibility: replacement service must not exist
        if info.get("replacementServiceExists", "").lower() == "true":
            return OEResult(
                service_id=service_id,
                service_name=info.get("serviceName"),
                final_state=OERemediationState.SKIPPED,
                error="Replacement service exists (MACD scenario)",
                duration_seconds=time.time() - start,
            )

        attachment_content = info.get("attachmentContent")
        if not attachment_content:
            return self._fail(service_id, "FETCH", "No attachment content returned", start)

        product_definition_name = info.get("productDefinitionName", "")
        service_name = info.get("serviceName", "")

        # Parse the attachment JSON
        try:
            oe_json = json.loads(attachment_content)
        except json.JSONDecodeError as e:
            return self._fail(service_id, "PARSE", f"Invalid JSON: {e}", start)

        # -----------------------------------------------------------------
        # Step 2: Analyze + Patch in memory
        # -----------------------------------------------------------------
        service_type = _infer_service_type(product_definition_name, oe_json)
        if not service_type:
            return self._fail(
                service_id, "ANALYZE",
                f"Cannot determine service type from PDName='{product_definition_name}'",
                start,
            )

        # Resolve enrichment data if not provided
        if enrichment_data is None:
            enrichment_data = self._resolve_enrichment(service_id)

        analysis = analyze_oe_content(oe_json, service_type)
        missing = analysis.get("missingFields", [])

        if not missing:
            return OEResult(
                service_id=service_id,
                service_name=service_name,
                service_type=service_type,
                final_state=OERemediationState.NOT_IMPACTED,
                duration_seconds=time.time() - start,
            )

        # Build patch instructions
        fields_to_patch = _build_patch_instructions(
            missing, service_type, enrichment_data
        )

        if not fields_to_patch:
            return self._fail(
                service_id, "ENRICH",
                f"Missing fields {missing} but no enrichment data available",
                start,
            )

        # Apply patches to JSON (SET_IF_EMPTY semantics)
        patched_json, patched_field_names = patch_oe_json(oe_json, fields_to_patch, service_type)

        if not patched_field_names:
            return OEResult(
                service_id=service_id,
                service_name=service_name,
                service_type=service_type,
                final_state=OERemediationState.NOT_IMPACTED,
                fields_patched=[],
                duration_seconds=time.time() - start,
            )

        if dry_run:
            return OEResult(
                service_id=service_id,
                service_name=service_name,
                service_type=service_type,
                final_state=OERemediationState.VALIDATED,
                fields_patched=patched_field_names,
                duration_seconds=time.time() - start,
            )

        # -----------------------------------------------------------------
        # Step 3: Persist patched attachment to Salesforce
        # -----------------------------------------------------------------
        patched_content = json.dumps(patched_json)
        try:
            att_resp = self.tmf.update_oe_attachment(service_id, patched_content)
        except Exception as e:
            return self._fail(service_id, "ATTACHMENT", str(e), start)

        if not _is_success(att_resp):
            return self._fail(
                service_id, "ATTACHMENT",
                att_resp.get("message", "Attachment update failed"),
                start,
            )

        # -----------------------------------------------------------------
        # Step 4: Trigger SM Service sync
        # -----------------------------------------------------------------
        try:
            rem_resp = self.tmf.trigger_oe_remediation(service_id, product_definition_name)
        except Exception as e:
            return self._fail(service_id, "SM_SYNC", str(e), start)

        if not _is_success(rem_resp):
            return self._fail(
                service_id, "SM_SYNC",
                rem_resp.get("message", "SM sync failed"),
                start,
            )

        return OEResult(
            service_id=service_id,
            service_name=service_name,
            service_type=service_type,
            final_state=OERemediationState.REMEDIATED,
            fields_patched=patched_field_names,
            duration_seconds=time.time() - start,
        )

    def _resolve_enrichment(self, service_id: str) -> dict:
        """Resolve enrichment data via TMF API (Service -> BA -> Contact -> Email)."""
        try:
            return self.tmf.get_oe_enrichment_data(service_id)
        except Exception as e:
            logger.warning(f"Enrichment resolution failed for {service_id}: {e}")
            return {}

    @staticmethod
    def _fail(
        service_id: str, stage: str, error: str, start: float
    ) -> OEResult:
        logger.error(f"OE remediation failed at {stage} for {service_id}: {error}")
        return OEResult(
            service_id=service_id,
            final_state=OERemediationState.FAILED,
            failure_stage=stage,
            error=error,
            duration_seconds=time.time() - start,
        )


# =============================================================================
# Pure Functions (no side effects, fully testable)
# =============================================================================


def analyze_oe_content(content: dict, service_type: str) -> dict:
    """
    Analyze OE content for missing mandatory fields based on service type.

    Searches ONLY NonCommercialProduct[] (not CommercialProduct).
    Ported from: attachment_service.py::analyze_oe_content()

    Returns:
        {serviceType, mandatoryFields, missingFields, presentFields, has1867Issue}
    """
    if not content:
        return {"error": "No content to analyze", "has1867Issue": True, "missingFields": []}

    required = MANDATORY_FIELDS.get(service_type, [])
    if not required:
        return {
            "serviceType": service_type,
            "mandatoryFields": [],
            "missingFields": [],
            "presentFields": {},
            "has1867Issue": False,
        }

    attr_by_name = _build_ncp_attribute_index(content)

    missing: list[str] = []
    present: dict[str, Any] = {}

    for field in required:
        found = False
        for alias in FIELD_ALIASES.get(field, [field]):
            normalized = alias.lower().replace(" ", "")
            if normalized in attr_by_name:
                value = attr_by_name[normalized]
                if value is not None and str(value).strip():
                    found = True
                    present[field] = value
                    break

        if not found:
            missing.append(field)

    return {
        "serviceType": service_type,
        "mandatoryFields": required,
        "missingFields": missing,
        "presentFields": present,
        "has1867Issue": len(missing) > 0,
    }


def patch_oe_json(
    oe_json: dict,
    fields_to_patch: list[dict],
    service_type: str,
) -> tuple[dict, list[str]]:
    """
    Apply SET_IF_EMPTY patches to the OE JSON (NonCommercialProduct).

    Ported from: attachment_patcher.py::patch_service_with_attachment_update()

    SET_IF_EMPTY semantics (critical):
      - If attribute exists AND has a non-empty value -> skip (never overwrite)
      - If attribute exists but value is empty/None -> update value AND label
      - If attribute doesn't exist -> add new attribute with value and label

    Args:
        oe_json: Parsed ProductAttributeDetails.json (will be deep-copied)
        fields_to_patch: [{fieldName, value, label}, ...]
        service_type: Used to locate the correct OE schema

    Returns:
        (patched_json, list_of_patched_field_names)
    """
    patched = deepcopy(oe_json)
    ncp = patched.get("NonCommercialProduct", [])

    if not isinstance(ncp, list) or not ncp:
        logger.warning("NonCommercialProduct is empty or not a list")
        return patched, []

    # Find target schema
    schema_key_substr = OE_SCHEMA_MAPPING.get(service_type, "")
    target_schema_name = None
    target_attributes = None

    for schema_obj in ncp:
        if not isinstance(schema_obj, dict):
            continue
        for schema_name, schema_data in schema_obj.items():
            if schema_key_substr and schema_key_substr in schema_name:
                target_schema_name = schema_name
                if isinstance(schema_data, dict):
                    target_attributes = schema_data.get("attributes", [])
                break
        if target_schema_name:
            break

    if target_attributes is None:
        logger.warning(
            f"Could not find OE schema '{schema_key_substr}' in NonCommercialProduct. "
            f"Available: {[list(s.keys()) for s in ncp if isinstance(s, dict)]}"
        )
        return patched, []

    # Build index (normalized name -> attribute dict reference)
    attr_index: dict[str, dict] = {}
    for attr in target_attributes:
        if isinstance(attr, dict) and attr.get("name"):
            attr_index[attr["name"].lower().replace(" ", "")] = attr

    patched_names: list[str] = []

    for field in fields_to_patch:
        ui_name = field["fieldName"]
        oe_name = FIELD_NAME_TO_OE.get(ui_name, ui_name)
        new_value = field["value"]
        new_label = field.get("label", new_value)
        normalized = oe_name.lower().replace(" ", "")

        if normalized in attr_index:
            existing = attr_index[normalized]
            existing_value = str(existing.get("value", "")).strip()

            # SET_IF_EMPTY: skip if value already populated
            if existing_value:
                logger.debug(f"  {oe_name}: already has value '{existing_value}', skipping")
                continue

            existing["value"] = new_value
            existing["label"] = new_label
            patched_names.append(ui_name)
            logger.info(f"  {oe_name}: SET value='{new_value}', label='{new_label}'")
        else:
            # Attribute doesn't exist at all -> add it
            new_attr = {"name": oe_name, "value": new_value, "label": new_label}
            target_attributes.append(new_attr)
            patched_names.append(ui_name)
            logger.info(f"  {oe_name}: ADDED value='{new_value}', label='{new_label}'")

    # Write attributes back into the schema
    for schema_obj in ncp:
        if isinstance(schema_obj, dict) and target_schema_name in schema_obj:
            schema_obj[target_schema_name]["attributes"] = target_attributes
            break

    patched["NonCommercialProduct"] = ncp
    return patched, patched_names


# =============================================================================
# Helpers
# =============================================================================


def _is_success(response: dict) -> bool:
    """Check if a Salesforce REST response indicates success."""
    success = response.get("success", "")
    if isinstance(success, bool):
        return success
    return str(success).lower() == "true"


def _build_ncp_attribute_index(content: dict) -> dict[str, Any]:
    """Build a normalized-name -> value index from NonCommercialProduct attributes."""
    index: dict[str, Any] = {}
    ncp = content.get("NonCommercialProduct", [])

    if not isinstance(ncp, list):
        return index

    for schema_obj in ncp:
        if not isinstance(schema_obj, dict):
            continue
        for _schema_name, schema_data in schema_obj.items():
            if not isinstance(schema_data, dict):
                continue
            for attr in schema_data.get("attributes", []):
                if isinstance(attr, dict):
                    name = attr.get("name", "")
                    normalized = name.lower().replace(" ", "")
                    if normalized:
                        index[normalized] = attr.get("value", "")

    return index


def _infer_service_type(product_definition_name: str, oe_json: dict) -> Optional[str]:
    """
    Determine service type from product definition name or attachment structure.

    Falls back to checking which OE schema keys exist in NonCommercialProduct.
    """
    pdname_lower = product_definition_name.lower() if product_definition_name else ""

    if "voice" in pdname_lower:
        return "Voice"
    if "fibre" in pdname_lower:
        return "Fibre Service"
    if "esms" in pdname_lower or "e-sms" in pdname_lower:
        return "eSMS Service"
    if "access" in pdname_lower:
        return "Access Service"

    # Fallback: check schema keys in NonCommercialProduct
    ncp = oe_json.get("NonCommercialProduct", [])
    if isinstance(ncp, list):
        for schema_obj in ncp:
            if isinstance(schema_obj, dict):
                for key in schema_obj.keys():
                    key_lower = key.lower()
                    if "voice oe" in key_lower:
                        return "Voice"
                    if "fibre service oe" in key_lower:
                        return "Fibre Service"
                    if "esms oe" in key_lower or "e-sms oe" in key_lower:
                        return "eSMS Service"
                    if "access oe" in key_lower:
                        return "Access Service"

    return None


def _build_patch_instructions(
    missing_fields: list[str],
    service_type: str,
    enrichment_data: dict,
) -> list[dict]:
    """
    Build patch instructions from missing fields + enrichment data.

    Applies:
      - Voice constants (ResourceSystemGroupID='Migrated', NumberStatus='Reserved')
      - PICEmail from enrichment (with Authorized_PIC_Email__c handled upstream)
      - ReservedNumber from enrichment (External_ID__c)
      - BillingAccount ID + name from enrichment
      - eSMSUserName from PIC Email enrichment

    Returns:
        [{fieldName, value, label}, ...] -- only for fields we CAN patch.
    """
    instructions: list[dict] = []

    for field in missing_fields:
        value: Optional[str] = None
        label: Optional[str] = None

        if field in VOICE_CONSTANTS:
            value = VOICE_CONSTANTS[field]
            label = value
        elif field == "ReservedNumber":
            value = enrichment_data.get("reservedNumber")
            label = value
        elif field == "PICEmail":
            value = enrichment_data.get("picEmail")
            label = value
        elif field == "BillingAccount":
            value = enrichment_data.get("billingAccountId")
            label = enrichment_data.get("billingAccountName") or value
        elif field == "eSMSUserName":
            value = enrichment_data.get("picEmail")
            label = value

        if value:
            instructions.append({
                "fieldName": field,
                "value": value,
                "label": label or value,
            })
        else:
            logger.warning(
                f"Cannot resolve enrichment for {field} "
                f"(service_type={service_type}, enrichment keys={list(enrichment_data.keys())})"
            )

    return instructions
