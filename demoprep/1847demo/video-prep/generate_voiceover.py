"""
Generate voiceover for 1867 OE Partial Data Missing demo video.

Usage:
  export ELEVENLABS_API_KEY="sk_..."
  python3 generate_voiceover.py

Generates per-section MP3 files in audio/ directory.
"""

import os
import sys
import requests

API_KEY = os.environ.get("ELEVENLABS_API_KEY", "")
if not API_KEY:
    print("ERROR: Set ELEVENLABS_API_KEY environment variable")
    sys.exit(1)

VOICE_ID = "ErXwobaYiN019PkySvjV"  # Antoni
MODEL_ID = "eleven_turbo_v2_5"
OUTPUT_DIR = "audio"

DEMO_SECTIONS = {
    "01_intro": """
BSS Magic. Migrated Service Data Remediation for Maxis.
""",

    "02_problem": """
After migration, thousands of services are missing critical order enrichment data. Fields are empty. Services can't be managed. Here are seventy-seven thousand migrated services, and roughly forty percent have missing data.
""",

    "03_detection": """
BSS Magic scans every migrated service across four categories. Voice, Fibre, eSMS, and Access. For each service, it fetches the OE attachment, analyzes mandatory fields, and flags what's missing. Four hundred and forty-two services checked. One hundred and six issues found. All in under three minutes.
""",

    "04_tracking": """
Every detected issue becomes a tracked service problem with full audit trail. Missing fields, detection timestamp, product definition, enrichment status. Operations sees exactly what needs fixing.
""",

    "05_remediation": """
Remediation is one click. BSS Magic patches the OE attachment, persists to Salesforce, and triggers the SM Service sync. Six seconds per service.
""",

    "06_scheduler": """
For ongoing operations, batch remediation runs on schedule. Two thousand services per night. The full backlog cleared in seventeen nights.
""",

    "07_proof": """
After remediation, services move to resolved status. Every fix is audited. Fields patched, duration, triggered by manual or scheduled batch. Operations can filter by status, export to CSV, and validate at any time.
""",

    "08_kpi": """
The executive dashboard shows the full picture. Total detected, remediated, pending, mean time to resolution. Analytics track detection and remediation trends over time.
""",

    "09_close": """
Seventy-seven thousand services. Seventeen nights. Ready to push the button?
""",
}

os.makedirs(OUTPUT_DIR, exist_ok=True)

for section_name, text in DEMO_SECTIONS.items():
    text = text.strip()
    print(f"Generating {section_name} ({len(text)} chars)...")

    response = requests.post(
        f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}",
        headers={
            "xi-api-key": API_KEY,
            "Content-Type": "application/json",
        },
        json={
            "text": text,
            "model_id": MODEL_ID,
            "voice_settings": {
                "stability": 0.71,
                "similarity_boost": 0.75,
                "style": 0.0,
                "use_speaker_boost": True,
            },
        },
    )

    if response.status_code == 200:
        outpath = os.path.join(OUTPUT_DIR, f"{section_name}.mp3")
        with open(outpath, "wb") as f:
            f.write(response.content)
        print(f"  -> {outpath} ({len(response.content)} bytes)")
    else:
        print(f"  ERROR {response.status_code}: {response.text[:200]}")

print("\nDone. Run ffprobe on each file to check durations.")
