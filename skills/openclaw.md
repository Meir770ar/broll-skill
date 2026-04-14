---
name: talking-head-broll
description: "Add AI-selected B-roll clips, word-level captions, voice enhancement, and optional AI music to a talking-head video. Use ONLY when the user sends a TALKING-HEAD video (person speaking to camera — NOT a screen recording) and asks for B-roll editing. Trigger words: בירול, ברול, B-roll, broll, הוסף קליפים. For screen recordings use screen-tutorial instead. If unclear whether input is talking-head or screen recording, ASK before running."
---

# Talking-Head B-roll Editor — OpenClaw

## When to trigger
User sends a talking-head video (person speaking to camera, typical vertical 9:16 or 1:1).

**Trigger phrases:** "בירול", "ברול", "B-roll", "broll", "הוסף קליפים", "תוסיף קליפים".

**If user says only "ערוך":** ASK first — "זה וידאו של דובר להוסיף B-roll, או הקלטת מסך למדריך?" — do not guess.

## The ONE command

```bash
bash <PIPELINE_PATH> \
  --video <inbound-mp4> \
  --config <CONFIG_PATH> \
  --phone <phone-digits>
```

### Argument sources (OpenClaw context)

- `<PIPELINE_PATH>` — absolute path to `scripts/pipeline.sh`. Replace during setup.
- `<inbound-mp4>` — inbound WhatsApp media, typically `/home/node/.openclaw/media/inbound/<uuid>.mp4`. Pick the file matching the current message.
- `<CONFIG_PATH>` — absolute path to `config.json` (set during install).
- `<phone-digits>` — sender phone, digits only (e.g. `972501234567`).

## What the pipeline does (7 steps, automatic)

1. Extracts audio
2. Light voice enhancement (FFT denoise, loudness normalize)
3. Transcribes via **ElevenLabs Scribe v2** (high-accuracy Hebrew word-level)
4. Gemini 2.5 Flash picks B-roll moments + mood + prompts → Pexels stock or Runware AI images downloaded
5. (Optional) Lyria 3 Pro generates instrumental matching the mood — enable via `lyria_music_enabled: true` in config
6. Remotion renders: talking-head as PIP, B-roll full-screen, word captions
7. Compress if >60MB and send via configured channel

## Rules

- **ONE command.** Pipeline handles all steps.
- **Wait** for `✅ Done` in output before telling user "שלחתי".
- **Total time: 3-6 minutes** for 1-2 minute inputs. Do not retry.
- **Do NOT use for screen recordings** — use screen-tutorial skill instead.

## What NOT to do

- ❌ Run in parallel (shared `/tmp`).
- ❌ Retry to "verify" — trust the completion marker.
- ❌ Run on screen recordings — use the correct skill.
