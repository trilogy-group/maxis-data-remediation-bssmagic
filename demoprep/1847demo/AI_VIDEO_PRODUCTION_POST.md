# AI-Powered Demo Video Production

## The Post (5-liner)

---

I just produced a 60-second narrated customer demo video without opening a single video editing application.

Three raw screen recordings (4 minutes of footage, mostly loading screens) went in. Claude 4.6 Opus analyzed the content frame-by-frame, cut 140 seconds of dead time, wrote a narration script aligned to our management's "McKinsey approach" feedback, generated a professional voiceover via ElevenLabs, time-synced audio to video per section, and stitched the final output -- all through terminal commands it wrote and executed itself.

Total wall-clock time from raw footage to polished narrated demo: under 2 hours, including three rounds of feedback iteration. Zero Premiere Pro. Zero Final Cut. Just an AI agent, ffmpeg, and an ElevenLabs API key.

This is what AI-first project delivery looks like. The demo itself took longer to screen-record than to produce.

---

## The Detailed How-To (Comment / Thread)

### What We Built

A 60-second narrated end-to-end demo video for the Maxis weekly review, showing:
- The **problem** (broken solutions in Salesforce after migration)
- **BSS Magic** detecting and remediating issues in real-time
- **Batch scheduling** for automated nightly remediation
- The **result** back in Salesforce (solution fixed, services loaded)

### Source Material

| Input | Duration | What It Shows |
|-------|----------|---------------|
| Screen recording 1 (Salesforce) | 58s | Broken solution -- but 37s was loading screens |
| Screen recording 2 (BSS Magic app) | 114s | Full app walkthrough -- detect, track, remediate, schedule |
| Screen recording 3 (Salesforce) | 64s | Fixed solution -- but 40s was loading screens |
| **Total raw footage** | **236s** | **~96s of useful content buried in 140s of dead time** |

### The AI Pipeline

#### Step 1: Content Analysis (Claude + ffmpeg)

Claude used `ffprobe` to get video metadata (duration, resolution, codec), then extracted thumbnail frames every 5-10 seconds using ffmpeg. It **visually analyzed each thumbnail** to understand what was on screen at each timestamp, and created a content map:

```
REC1 0:00-0:08  Solution detail "Not Migrated Successfully"  → KEEP
REC1 0:08-0:45  Loading screens                              → CUT
REC1 0:45-0:58  Empty basket page                            → KEEP
```

This step replaced what would normally be: open in Premiere, scrub through footage, set in/out points manually.

#### Step 2: Video Editing (ffmpeg commands written by Claude)

Claude wrote and executed all the ffmpeg commands:

- **Trimming**: Extract only the useful seconds from each raw video
- **Normalization**: Scale all clips to 1280x720, 30fps (sources had different resolutions)
- **Speed-up**: 2x speed on sections with slow UI interactions
- **Title cards**: Generated branded cards with text overlays (dark purple backgrounds, colored text) -- no Photoshop needed
- **Concatenation**: Combined 14 clips into one seamless video

Key insight: **ffmpeg's `drawtext` filter** can create professional-looking title cards directly from the command line. No design tool required.

#### Step 3: Narration Script (Claude)

Claude wrote the narration script time-aligned to each video segment, following guidance extracted from management meeting transcripts:
- Business value first ("thousands of solutions stuck")
- Specific impact framing ("tens of hours every week")
- The close ("Ready to push the button?")

The script was split into 7 sections, each mapped to its corresponding video segment with exact timestamps.

#### Step 4: AI Voiceover (ElevenLabs API)

An existing Python script (`generate_voiceover.py`) calls the ElevenLabs API:
- Voice: Antoni (professional male)
- Model: `eleven_turbo_v2_5` (free tier)
- Total: 851 characters (~$0 on free tier, which allows 10,000 chars/month)
- Generation time: ~7 seconds for all 7 sections

#### Step 5: Audio-Video Sync (the hard part)

This is where it got interesting. The first attempt just overlaid the full voiceover on the video -- but the narration drifted out of sync because some audio sections were longer than their video segments.

**The fix**: Claude analyzed each section's audio duration vs video duration, then:
- **Sped up** sections where audio was too long (e.g., `atempo=1.27` for the "problem" section)
- **Padded with silence** sections where audio was too short
- Each section was processed into a WAV with the **exact duration** of its video segment
- All sections were concatenated into one aligned audio track

This per-section sync approach is the key to making AI voiceover work with edited video.

#### Step 6: Final Stitch

```bash
ffmpeg -y -i video.mp4 -i aligned_audio.wav -c:v copy -c:a aac -b:a 128k output.mp4
```

### Iteration Cycles

Three feedback rounds happened during the session:

1. **v1**: Built initial demo, but missing the "after" proof (solution fixed in Salesforce)
2. **v2**: Added the "after" video, but audio was out of sync with video transitions
3. **v3**: Fixed sync, but too much silence in proof section + missing scheduler capability
4. **Final**: Shortened proof, added batch scheduling, re-synced -- shipped

Each iteration took 5-10 minutes. The AI re-generated only the changed parts.

### Tools Used

| Tool | Purpose | Cost |
|------|---------|------|
| **Claude 4.6 Opus** (via Cursor) | Orchestration, script writing, visual analysis, ffmpeg command generation | Cursor subscription |
| **ffmpeg / ffprobe** | Video editing, trimming, concat, normalization, title cards | Free (open source) |
| **ElevenLabs API** | AI voiceover generation | Free tier (851 of 10,000 chars) |
| **Python** | Voiceover generation script | Free |

### What's Replicable

Anyone with Cursor + ffmpeg + an ElevenLabs account can do this:

1. Screen-record your demo (don't worry about loading screens or mistakes)
2. Ask Claude to analyze the footage: "Here are my recordings, extract thumbnails and tell me what's useful"
3. Tell it your target audience and style: "McKinsey approach, 60 seconds max, business value focus"
4. Let it write the narration, generate the voiceover, and stitch everything
5. Review, give feedback ("too much silence here", "add this capability"), let it re-cut

The entire pipeline is **terminal-based and reproducible**. Every command is logged. Re-running with different footage or a different script takes minutes, not hours.

### Key Numbers

| Metric | Value |
|--------|-------|
| Raw footage | 236 seconds (3 videos) |
| Dead time removed | 140 seconds (59%) |
| Final output | 60 seconds narrated |
| Wall-clock production time | ~2 hours |
| Video editing software used | None |
| Design software used | None |
| Total cost beyond subscription | $0 |
| Iteration cycles | 3 feedback rounds |
| Files generated | 43 intermediate + 1 final |

---

*Produced: February 6, 2026*
