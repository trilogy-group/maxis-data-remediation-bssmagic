"""
CloudSense JS Engine (Reusable)
===============================
Reusable Playwright+Salesforce session wrapper that can:
- Authenticate to Salesforce via API session (simple-salesforce)
- Open Solution Console through Basket Builder
- Execute CloudSense JS APIs:
  - solution.getAllConfigurations()
  - solution.updateOrderEnrichmentConfigurationAttribute()
  - Persist changes via "Calculate Totals"

This module is intentionally framework-agnostic so it can be used by:
- `cloudsense_api_service/main.py` (FastAPI gateway)
- Standalone remediation scripts (e.g., 1867 OE patcher)
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List, Optional

from simple_salesforce import Salesforce
from playwright.async_api import async_playwright, Browser, Page


def log(msg: str, level: str = "INFO"):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{ts}] [{level}] {msg}")


@dataclass(frozen=True)
class SalesforceCredentials:
    username: str
    password: str
    security_token: str
    domain: str = "test"


class CloudSenseJSEngine:
    """Executes CloudSense JS APIs via (headless) browser automation."""

    def __init__(
        self,
        credentials: SalesforceCredentials,
        *,
        headless: bool = True,
        slow_mo: int = 0,
        timeout_ms: int = 60000,
    ):
        self.credentials = credentials
        self.headless = headless
        self.slow_mo = slow_mo
        self.timeout_ms = timeout_ms

        self.sf: Optional[Salesforce] = None
        self.playwright = None
        self.browser: Optional[Browser] = None
        self.page: Optional[Page] = None
        self.context = None

    async def __aenter__(self) -> "CloudSenseJSEngine":
        log("Initializing CloudSense JS Engine...")

        # 1) Salesforce API login to get a session id (bypasses email verification/MFA prompts)
        log(f"Authenticating as {self.credentials.username}...")
        self.sf = Salesforce(
            username=self.credentials.username,
            password=self.credentials.password,
            security_token=self.credentials.security_token,
            domain=self.credentials.domain,
        )
        log(f"✅ Authenticated! Instance: {self.sf.sf_instance}")

        # 2) Launch browser
        log("Launching browser...")
        self.playwright = await async_playwright().start()
        self.browser = await self.playwright.chromium.launch(
            headless=self.headless,
            slow_mo=self.slow_mo,
            args=["--disable-dev-shm-usage", "--no-sandbox"],
        )
        self.context = await self.browser.new_context(viewport={"width": 1920, "height": 1080})
        self.page = await self.context.new_page()
        self.page.set_default_timeout(self.timeout_ms)
        log(f"✅ Browser launched (headless={self.headless})")

        # 3) Authenticate the browser via frontdoor.jsp
        log("Authenticating browser via frontdoor.jsp...")
        frontdoor_url = f"https://{self.sf.sf_instance}/secur/frontdoor.jsp?sid={self.sf.session_id}"
        await self.page.goto(frontdoor_url, wait_until="domcontentloaded")
        await self.page.wait_for_timeout(3000)
        if "login" in (self.page.url or "").lower():
            raise RuntimeError("Browser authentication failed (redirected to login)")
        log("✅ Browser authenticated")

        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        log("Closing browser...")
        try:
            if self.browser:
                await self.browser.close()
        finally:
            if self.playwright:
                await self.playwright.stop()
        log("✅ Browser closed")

    async def navigate_to_solution_console(self, basket_id: str, solution_name: str) -> bool:
        """Navigate to Solution Console for a basket and select a specific solution."""
        assert self.page is not None
        assert self.sf is not None

        # Go through Basket Builder (most reliable)
        basket_url = f"https://{self.sf.sf_instance}/apex/csbb__basketbuilderapp?Id={basket_id}"
        log(f"Navigating to basket builder: {basket_url}")
        await self.page.goto(basket_url, wait_until="domcontentloaded")
        await self.page.wait_for_timeout(5000)

        # Click "Manage Solutions"
        try:
            manage_btn = self.page.get_by_role("button", name="Manage Solutions")
            await manage_btn.click(timeout=10000)
            log("✅ Clicked 'Manage Solutions'")
            await self.page.wait_for_timeout(8000)
        except Exception as e:
            log(f"⚠️ Could not click 'Manage Solutions' ({str(e)[:120]}). Trying direct URL...", "WARNING")
            sc_url = f"https://{self.sf.sf_instance}/apex/cssmgnt__sceditor?basketId={basket_id}"
            await self.page.goto(sc_url, wait_until="domcontentloaded")
            await self.page.wait_for_timeout(8000)

        # Select solution
        try:
            solution_link = self.page.get_by_role("link", name=solution_name)
            await solution_link.click(timeout=10000)
            log(f"✅ Clicked solution '{solution_name}'")
            await self.page.wait_for_timeout(5000)
        except Exception as e:
            log(f"⚠️ Exact match failed for '{solution_name}' ({str(e)[:120]}). Trying partial match...", "WARNING")
            try:
                solution_link = self.page.locator(f"a:has-text('{solution_name}')").first
                await solution_link.click(timeout=5000)
                log("✅ Clicked solution (partial match)")
                await self.page.wait_for_timeout(5000)
            except Exception as e2:
                log(f"❌ Could not find solution '{solution_name}' ({str(e2)[:120]})", "ERROR")
                return False

        # Wait for solution object
        for attempt in range(20):
            try:
                ready = await self.page.evaluate(
                    """
                    () => {
                      if (typeof solution === 'undefined' || solution === null) return { ready: false, reason: 'solution undefined' };
                      if (typeof solution.getAllConfigurations !== 'function') return { ready: false, reason: 'getAllConfigurations missing' };
                      return { ready: true };
                    }
                    """
                )
                if ready.get("ready"):
                    log("✅ Solution object ready")
                    return True
                log(f"  Waiting for solution... ({attempt + 1}/20): {ready.get('reason')}")
            except Exception as e:
                log(f"  Waiting for solution... ({attempt + 1}/20): {str(e)[:80]}")
            await self.page.wait_for_timeout(2000)

        log("❌ Solution object not available after ~40s", "ERROR")
        return False

    async def get_all_configurations(self) -> Dict[str, Any]:
        """Execute solution.getAllConfigurations() and return structured data."""
        assert self.page is not None

        js_code = """
        () => {
          try {
            if (typeof solution === 'undefined') return { error: 'solution object not found' };
            const toArray = (obj) => {
              if (!obj) return [];
              if (Array.isArray(obj)) return obj;
              if (typeof obj === 'object') return Object.values(obj);
              return [];
            };

            const configsRaw = solution.getAllConfigurations();
            const configs = toArray(configsRaw);

            const solutionInfo = {
              id: solution.solutionId || null,
              name: solution.solutionName || null,
              guid: solution.guid || null
            };

            return {
              success: true,
              solution: solutionInfo,
              count: configs.length,
              configurations: configs.map(c => {
                const oeList = toArray(c.orderEnrichmentList);
                return {
                  guid: c.guid,
                  name: c.name,
                  productConfigurationId: c.productConfigurationId,
                  productDefinition: c.productDefinition,
                  serviceId: c.serviceId,
                  status: c.status,
                  orderEnrichmentCount: oeList.length,
                  orderEnrichmentList: oeList.map(oe => {
                    const attrs = toArray(oe.attributes);
                    return {
                      guid: oe.guid,
                      name: oe.name,
                      attributeCount: attrs.length,
                      attributes: attrs.map(a => ({
                        name: a.name,
                        value: a.value,
                        displayValue: a.displayValue,
                        readonly: a.readonly,
                        required: a.required
                      }))
                    };
                  })
                };
              })
            };
          } catch (e) {
            return { error: e.message, stack: e.stack };
          }
        }
        """

        result = await self.page.evaluate(js_code)
        if result.get("error"):
            raise RuntimeError(result["error"])
        return result

    async def update_oe_attributes(self, config_guid: str, oe_guid: str, attributes: List[Dict[str, str]]) -> Dict[str, Any]:
        """Execute solution.updateOrderEnrichmentConfigurationAttribute()."""
        assert self.page is not None
        attrs_json = json.dumps(attributes)
        js_code = f"""
        () => {{
          try {{
            if (typeof solution === 'undefined') return {{ error: 'solution object not found' }};
            const attrs = {attrs_json};
            const result = solution.updateOrderEnrichmentConfigurationAttribute('{config_guid}', '{oe_guid}', attrs);
            return {{ success: true, result }};
          }} catch (e) {{
            return {{ error: e.message, stack: e.stack }};
          }}
        }}
        """
        return await self.page.evaluate(js_code)

    async def click_calculate_totals(self) -> Dict[str, Any]:
        """Click Calculate Totals to persist changes."""
        assert self.page is not None
        try:
            btn = self.page.get_by_role("button", name="Calculate Totals")
            await btn.click(timeout=30000)
            await self.page.wait_for_timeout(5000)
            return {"success": True}
        except Exception as e:
            return {"success": False, "error": str(e)}




