"""
Pydantic schemas for 1867 OE Patch API
"""
from pydantic import BaseModel
from typing import List, Optional, Dict, Any


class PatchFieldData(BaseModel):
    """Data for a field to be patched"""
    fieldName: str
    value: str
    label: Optional[str] = None  # Display value (e.g., BA name)


class PatchOERequest(BaseModel):
    """Request to patch OE data for a service"""
    serviceId: str
    serviceType: Optional[str] = None  # Voice, Fibre Service, eSMS Service, Access Service
    fieldsToPatch: List[PatchFieldData] = []  # Fields to patch with their values from UI
    dryRun: bool = False  # If true, only analyze, don't actually patch


class PatchedField(BaseModel):
    """Details of a field that was patched"""
    fieldName: str
    oldValue: Optional[str] = None
    newValue: str
    source: str  # e.g., "External_ID__c", "Billing_Account__r.Contact__r.Email"


class PatchOEResponse(BaseModel):
    """Response from OE patch operation"""
    success: bool
    serviceId: str
    serviceName: Optional[str] = None
    serviceType: Optional[str] = None
    solutionId: Optional[str] = None
    
    # Analysis before patch
    originalMissingFields: List[str] = []
    patchedFields: List[PatchedField] = []
    remainingMissingFields: List[str] = []
    
    # Execution details
    dryRun: bool = False
    apexExecuted: bool = False
    jobId: Optional[str] = None
    
    # Errors
    error: Optional[str] = None
    warnings: List[str] = []
