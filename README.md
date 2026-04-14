# Talking-Head B-roll Skill

Turn a talking-head video into a dynamic edit with automatic B-roll clips, word-level captions, and optional AI-generated music.

Works with:
- **Claude Code** (local) — `skills/claude-code.md`
- **OpenClaw** (WhatsApp bot) — `skills/openclaw.md`

---

## 🇮🇱 צ'ק-ליסט התקנה

**המטרה: מינימום עלויות. שדרוגים — רק כשצריך.**

### 💰 טבלת עלויות

| רכיב | מסלול בסיסי | שדרוג |
|---|---|---|
| **Gemini API** (ניתוח B-roll) | חינם (1500 בקשות/יום) | $0.001/סרטון |
| **ElevenLabs Scribe v2** (תמלול) | Starter ~$5/חודש | כלול במנוי |
| **Pexels Stock Video** | **חינם** (200 בקשות/שעה) | — |
| **Runware** (AI image gen) | חינם, אופציונלי | — |
| **מוזיקת רקע Lyria 3 Pro** | מבוטל כברירת מחדל | $0.08/סרטון |
| **שליחה WhatsApp** | Green API מסלול חינמי | ~$10/חודש pro |
| **🎯 עלות מינימלית** | **~$5/חודש** (ElevenLabs) | — |

---

### 🔧 שלב 1: תוכנה
- [ ] **Node.js 20+** — [nodejs.org](https://nodejs.org)
- [ ] **ffmpeg + ffprobe**
- [ ] **git**
- [ ] Linux בלבד: `sudo apt install libnss3 libatk1.0-0 libxcomposite1 libxdamage1 libxrandr2 libgbm1 libasound2`

### 🔑 שלב 2: מפתחות API

**חובה:**
- [ ] **Gemini** (חינם) → [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
- [ ] **ElevenLabs** — Starter ~$5/חודש → [elevenlabs.io](https://elevenlabs.io/app/settings/api-keys)
  - חייב מנוי בתשלום (כולל Scribe v2 לתמלול + voice cloning לפרויקטים אחרים)
- [ ] **Pexels** (חינם) → [pexels.com/api](https://www.pexels.com/api/) — נדרש לקליפי B-roll

**אופציונלי:**
- [ ] **Runware** (חינם tier) → [runware.ai](https://runware.ai) — AI image generation כתחליף/תוספת ל-Pexels
- [ ] **Green API** (חינם tier) → [green-api.com](https://green-api.com) — שליחה אוטומטית ל-WhatsApp

### 📝 שלב 3: קונפיגורציה
- [ ] `cp .env.example .env` → למלא את המפתחות
- [ ] `cp config.example.json config.json` → להתאים לפי הצורך (ברירות המחדל טובות)
- [ ] `cd scripts && npm install`
- [ ] `cd ../remotion && npm install`

### 🔤 שלב 4: פונט עברי להעלאה
- [ ] הורד מ-[Google Fonts — Assistant](https://fonts.google.com/specimen/Assistant): Regular + Bold
- [ ] שים ב-`remotion/public/fonts/` (שמור את השמות `Assistant-Regular.ttf` + `Assistant-Bold.ttf`)

### 🎯 שלב 5: התקנת הסקיל (בחר אחד)
- [ ] **Claude Code:** `cp skills/claude-code.md ~/.claude/skills/talking-head-broll/SKILL.md` — החלף `<PIPELINE_PATH>`
- [ ] **OpenClaw:** `cp skills/openclaw.md` לתיקיית הסקילים של הבוט

### ✅ שלב 6: בדיקת שפיות
```bash
./scripts/pipeline.sh \
  --video /path/to/talking-head.mp4 \
  --config ./config.json
```

---

## What the pipeline does

Input: a talking-head video (person speaking to camera).
Output: a polished edit with:
- 🎥 The original as Picture-in-Picture (PIP) bottom-right
- 🎞️ Full-screen B-roll clips (from Pexels or AI-generated via Runware) matched to what the speaker says
- ✍️ Word-level captions in Hebrew (ElevenLabs Scribe v2)
- 🎵 Optional Lyria 3 Pro AI music matching the content mood
- 🔊 Voice enhancement (noise reduction + loudness normalization)

Flow: extract audio → enhance voice → transcribe (Scribe v2) → Gemini picks B-roll moments + mood → download Pexels clips (and/or generate AI images) → optional Lyria music → Remotion render → compress → send.

Time: **3-6 minutes** for a 1-2 minute input video.

---

## 🚀 Upgrades (in priority order)

1. **Pexels + Runware both** — better visual variety than Pexels alone
2. **Green API pro** (~$10/mo) — WhatsApp auto-send at scale
3. **Lyria 3 Pro music** (~$0.08/video) — flip `lyria_music_enabled: true` in config. Generates instrumental matched to detected mood (calm/energetic/corporate/emotional/tech).
4. **Premium Hebrew font** — if you license one, drop in `remotion/public/fonts/` and update `font_family` in config.

---

## Author

Built by **Meir Arad** — [mehubarim.org.il](https://mehubarim.org.il).

Contributions welcome via PR.

## License

MIT — see [LICENSE](LICENSE). User-provided assets (fonts, logos, music) carry their own licenses.
