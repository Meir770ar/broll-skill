# Setup Guide — B-roll Skill

See the checklist in [README.md](README.md) for the quick path. This file has the details.

## 1. Install

```bash
git clone <this-repo> broll-skill
cd broll-skill
cd scripts && npm install && cd ..
cd remotion && npm install && cd ..
```

System requirements: Node 20+, ffmpeg, git. On Linux, also install Chromium libs for Remotion:
```bash
sudo apt install libnss3 libatk1.0-0 libxcomposite1 libxdamage1 libxrandr2 libgbm1 libasound2
```

## 2. API keys

### Required
| Service | Cost | Where |
|---|---|---|
| Gemini API | Free (1500/day) | https://aistudio.google.com/apikey |
| ElevenLabs (Scribe v2) | ~$5/mo (Starter) | https://elevenlabs.io/app/settings/api-keys |
| Pexels | Free (200 req/hr) | https://www.pexels.com/api/ |

### Optional
| Service | Cost | Purpose |
|---|---|---|
| Runware | Free tier | AI image generation — richer visuals than Pexels alone |
| Green API | Free tier (or $10/mo pro) | WhatsApp auto-send |

## 3. Configure

```bash
cp .env.example .env
cp config.example.json config.json
```

Edit `.env` with your keys. At minimum: `GEMINI_API_KEY`, `ELEVENLABS_API_KEY`, `PEXELS_API_KEY`.

Edit `config.json`:
- `lyria_music_enabled` — set to `true` to get AI-generated music per video (+$0.08/video)
- `voice_enhance` — set to `false` if you already post-process audio
- `default_phone` — only needed for auto-send

## 4. Add Hebrew fonts

Download **Regular + Bold** of [Assistant](https://fonts.google.com/specimen/Assistant) from Google Fonts and drop both TTF files into `remotion/public/fonts/`.

If you use a different font, update `remotion/src/fonts.js` (family name + paths) and `config.json` → `font_family`.

## 5. Smoke test

```bash
./scripts/pipeline.sh --video /path/to/short-selfie.mp4 --config ./config.json
```

First run will take extra time as Remotion downloads Chromium.

Output appears at `output/broll-<timestamp>.mp4`.

## 6. Install the skill

### For Claude Code
```bash
mkdir -p ~/.claude/skills/talking-head-broll
cp skills/claude-code.md ~/.claude/skills/talking-head-broll/SKILL.md
# Edit the file — replace <PIPELINE_PATH> and <CONFIG_PATH> with absolute paths.
```

### For OpenClaw
Copy `skills/openclaw.md` to your OpenClaw skills directory (e.g., `/root/openclaw-scripts/skills/talking-head-broll.md`). Replace `<PIPELINE_PATH>` and `<CONFIG_PATH>` placeholders.

## Cost estimate

Per 1-minute video:
- ElevenLabs Scribe v2: ~$0.007 (or included in Starter plan's monthly minutes)
- Gemini 2.5 Flash: ~$0.001
- Pexels: free
- Lyria (if enabled): $0.08
- **Total without Lyria: ~$0.01** (mostly subscription-amortized)
- **Total with Lyria: ~$0.09**

## Troubleshooting

**"Scribe v2: 401 Unauthorized"** — ElevenLabs plan doesn't include Scribe. Check your tier.

**"durationInFrames must be positive"** — a transcribed word has 0-duration. Pipeline guards with `Math.max(sf+1, ef)` — if you still hit this, edit `pipeline.sh` step 4.

**"No B-roll clips downloaded"** — `PEXELS_API_KEY` not set, or Pexels returned no matches for Gemini's queries. Try adding `RUNWARE_API_KEY` for AI fallback.

**Hebrew text renders as boxes** — Fonts didn't load. Verify `remotion/public/fonts/` contains the TTF files and filenames match `remotion/src/fonts.js`.

**"Lyria 3 Pro: 404"** — your Gemini key doesn't have Lyria preview access. Check your Google AI Studio project permissions.
