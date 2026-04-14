---
name: talking-head-broll
description: "Add AI-selected B-roll clips, word-level captions, voice enhancement, and optional AI music to a talking-head video. Use when the user provides a TALKING-HEAD video file (person speaking to camera) and wants to add B-roll. Triggers: 'B-roll', 'broll', 'ברול', 'בירול', 'הוסף קליפים', 'add B-roll to this video'. Do NOT use for screen recordings."
---

# Talking-Head B-roll Editor — Claude Code

## When to use
User provides a talking-head video file and wants to add B-roll overlay clips, captions, and optional AI music.

## Inputs to collect

Ask (or extract from the user's message):
1. **Path to the video** — local MP4 (vertical 9:16 or square 1:1 work best)
2. **Enable Lyria music?** — yes/no (default no; adds ~$0.08/video)
3. **Delivery** — WhatsApp auto-send (if configured) or local save (default)

## The ONE command

```bash
bash <PIPELINE_PATH> \
  --video "<user-provided-mp4-path>" \
  --config <CONFIG_PATH>
```

Replace placeholders during install:
- `<PIPELINE_PATH>` — absolute path to `scripts/pipeline.sh`
- `<CONFIG_PATH>` — absolute path to `config.json`

## What the pipeline does (7 steps, automatic)

1. Extracts audio for transcription
2. Light voice enhancement (denoise + normalize)
3. **ElevenLabs Scribe v2** transcription (word-level, high-accuracy Hebrew)
4. Gemini 2.5 Flash generates B-roll plan + mood + Pexels queries / Runware prompts
5. Downloads B-roll clips (Pexels stock, and/or AI-generated via Runware if configured)
6. (Optional) Lyria 3 Pro generates instrumental music for the detected mood
7. Remotion renders, compresses, saves to `output/` (and sends via configured channel)

## Behavior rules

- Run once, wait 3-6 minutes. Do not retry.
- If the user wants Lyria music, instruct them to set `lyria_music_enabled: true` in `config.json` before running.
- For Hebrew videos, transcription quality is high with Scribe v2 but specialized terminology may mis-spell — ask the user to review the output caption if critical.

## What NOT to do

- ❌ Do not use on screen recordings — that is a different skill.
- ❌ Do not run parallel pipelines on the same machine (shared `/tmp`).
- ❌ Do not skip the user's config — it controls music, captions, PIP position.

## Example invocation

User: *"Add B-roll to /Users/me/Videos/interview.mp4"*

You run:
```bash
bash ~/broll-skill/scripts/pipeline.sh \
  --video "/Users/me/Videos/interview.mp4" \
  --config ~/broll-skill/config.json
```

Wait for `✓ Output: <path>` and report the final MP4 path to the user.
