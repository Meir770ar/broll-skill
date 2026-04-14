#!/bin/bash
# B-roll Pipeline — universal version
# Flow: extract audio → enhance → transcribe → Gemini B-roll plan → download clips
#       → (optional) Lyria music → Remotion render → compress → send
set -euo pipefail

# --- Arg parsing ---
VIDEO=""
CONFIG=""
PHONE=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --video) VIDEO="$2"; shift 2 ;;
    --config) CONFIG="$2"; shift 2 ;;
    --phone) PHONE="$2"; shift 2 ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

if [ -z "$VIDEO" ] || [ -z "$CONFIG" ]; then
  echo "Usage: pipeline.sh --video <mp4> --config <config.json> [--phone <digits>]" >&2
  exit 1
fi
if [ ! -f "$VIDEO" ]; then echo "ERROR: video not found: $VIDEO" >&2; exit 1; fi
if [ ! -f "$CONFIG" ]; then echo "ERROR: config not found: $CONFIG" >&2; exit 1; fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUTPUT_DIR="$ROOT/output"
TMPDIR="$ROOT/tmp/$(date +%s)"
mkdir -p "$OUTPUT_DIR" "$TMPDIR/broll"

# Load .env
if [ -f "$ROOT/.env" ]; then
  set -a; source "$ROOT/.env"; set +a
fi

# Load config-derived env once
eval "$(node -e "
const c = JSON.parse(require('fs').readFileSync('$CONFIG','utf8'));
console.log('LYRIA_ENABLED=' + (c.lyria_music_enabled ? 'true' : 'false'));
console.log('VOICE_ENHANCE=' + (c.voice_enhance !== false ? 'true' : 'false'));
console.log('COMPRESS_THRESHOLD_MB=' + (c.compress_if_over_mb || 60));
console.log('DEFAULT_PHONE=' + (c.default_phone || ''));
console.log('BROLL_STYLE=' + (c.broll_style || 'pip'));
console.log('TRANSCRIBE_PROVIDER=' + (c.transcribe_provider || 'groq'));
")"
export BROLL_STYLE TRANSCRIBE_PROVIDER

echo "[pipeline] Video: $VIDEO"
INPUT="$VIDEO"

# --- Step 1: Extract audio for transcription ---
echo "[pipeline] Step 1: extracting audio..."
ffmpeg -y -i "$INPUT" -vn -acodec libmp3lame -ar 16000 -ac 1 "$TMPDIR/audio.mp3" -loglevel error

# --- Step 1b: Voice enhancement (optional, config-gated) ---
if [ "$VOICE_ENHANCE" = "true" ]; then
  echo "[pipeline] Step 1b: enhancing voice..."
  ffmpeg -y -i "$INPUT" -af "
    afftdn=nf=-25:nr=10:nt=w,
    highpass=f=80,
    lowpass=f=13000,
    loudnorm=I=-16:LRA=11:TP=-1.5
  " -c:v copy "$TMPDIR/enhanced.mp4" -loglevel error
  [ -f "$TMPDIR/enhanced.mp4" ] && INPUT="$TMPDIR/enhanced.mp4"
fi

# --- Step 2: Transcribe (ElevenLabs Scribe v2) ---
echo "[pipeline] Step 2: transcribing..."
node "$ROOT/scripts/transcribe.mjs" "$TMPDIR/audio.mp3" > "$TMPDIR/transcript.json"
WORD_COUNT=$(node -e "const d=require('$TMPDIR/transcript.json'); console.log(d.words ? d.words.length : 0)")
echo "[pipeline] Transcription: $WORD_COUNT words"

# --- Step 3: Analyze + download B-roll ---
echo "[pipeline] Step 3: analyzing for B-roll..."
node "$ROOT/scripts/analyze-broll.mjs" "$TMPDIR/transcript.json" "$TMPDIR/broll" > "$TMPDIR/broll-segments.json"
SEG_COUNT=$(node -e "const d=require('$TMPDIR/broll-segments.json'); console.log(d.segments ? d.segments.length : 0)")
echo "[pipeline] B-roll: $SEG_COUNT segments"

# --- Step 3b: (Optional) Generate matching instrumental via Lyria 3 Pro ---
MUSIC_PATH=""
if [ "$LYRIA_ENABLED" = "true" ]; then
  echo "[pipeline] Step 3b: generating instrumental music (Lyria 3 Pro)..."
  MUSIC_OUT="$TMPDIR/music.mp3"
  if node "$ROOT/scripts/generate-music.mjs" "$TMPDIR/broll-segments.json" "$MUSIC_OUT" 2>&1; then
    MUSIC_PATH="$MUSIC_OUT"
  else
    echo "[pipeline] Lyria failed — proceeding without dynamic music"
  fi
fi

# --- Step 4: Stage media + build props ---
echo "[pipeline] Step 4: staging assets + building props..."
MEDIA_DIR="$ROOT/remotion/public/media-$$"
mkdir -p "$MEDIA_DIR"
cp "$INPUT" "$MEDIA_DIR/talking-head.mp4"
for f in "$TMPDIR"/broll/broll_*.mp4; do
  [ -f "$f" ] && cp "$f" "$MEDIA_DIR/" || true
done
[ -n "$MUSIC_PATH" ] && [ -f "$MUSIC_PATH" ] && cp "$MUSIC_PATH" "$MEDIA_DIR/music.mp3"

node -e "
const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');
const cfg = JSON.parse(fs.readFileSync('$CONFIG','utf8'));
const transcript = JSON.parse(fs.readFileSync('$TMPDIR/transcript.json', 'utf-8'));
const broll = JSON.parse(fs.readFileSync('$TMPDIR/broll-segments.json', 'utf-8'));

const probe = JSON.parse(execSync('ffprobe -v error -select_streams v:0 -show_entries stream=width,height:format=duration -of json \"$INPUT\"').toString());
const duration = parseFloat(probe.format.duration);
const stream = probe.streams?.[0] || {};
const width = stream.width || 1080;
const height = stream.height || 1920;
const fps = cfg.render_fps || 30;
const mediaDir = 'media-$$';
const hasMusic = fs.existsSync('$MEDIA_DIR/music.mp3');

const props = {
  talkingHeadSrc: mediaDir + '/talking-head.mp4',
  durationInFrames: Math.ceil(duration * fps),
  fps, width, height,
  broll: broll.segments.map(s => {
    const sf = Math.round(s.start * fps);
    return {
      startFrame: sf,
      endFrame: Math.max(sf + 1, Math.round(s.end * fps)),
      src: mediaDir + '/' + path.basename(s.localPath),
      query: s.query,
    };
  }),
  captions: transcript.words.map(w => {
    const sf = Math.round(w.start * fps);
    return {
      startFrame: sf,
      endFrame: Math.max(sf + 1, Math.round(w.end * fps)),
      text: w.word,
    };
  }),
  mood: broll.mood || 'calm',
  musicSrc: hasMusic ? mediaDir + '/music.mp3' : (cfg.fallback_music ? cfg.fallback_music : null),
  musicVolume: cfg.music_volume != null ? cfg.music_volume : 0.25,
  showCaptions: cfg.show_captions !== false,
  pipSize: cfg.pip_size || 280,
  pipPosition: cfg.pip_position || 'bottom-right',
  style: cfg.broll_style || 'pip',
  fontFamily: cfg.font_family || 'Assistant, sans-serif',
};

fs.writeFileSync('$TMPDIR/props.json', JSON.stringify(props, null, 2));
console.log('Props:', JSON.stringify({frames: props.durationInFrames, broll: props.broll.length, captions: props.captions.length}));
"

# --- Step 5: Render Remotion ---
echo "[pipeline] Step 5: rendering (Remotion)..."
OUT_MP4="$TMPDIR/output.mp4"
cd "$ROOT/remotion"
npx remotion render src/Root.tsx TalkingHeadBroll "$OUT_MP4" --props "$TMPDIR/props.json" --concurrency 2 --log error
cd "$ROOT"

# --- Step 6: Compress if needed ---
SIZE_MB=$(( $(stat -c%s "$OUT_MP4" 2>/dev/null || stat -f%z "$OUT_MP4") / 1024 / 1024 ))
echo "[pipeline] Output: ${SIZE_MB}MB"
if [ "$SIZE_MB" -gt "$COMPRESS_THRESHOLD_MB" ]; then
  echo "[pipeline] Step 6: compressing..."
  ffmpeg -y -i "$OUT_MP4" -crf 28 -preset fast -movflags +faststart "$TMPDIR/compressed.mp4" -loglevel error
  mv "$TMPDIR/compressed.mp4" "$OUT_MP4"
fi

# --- Step 7: Send ---
FINAL="$OUTPUT_DIR/broll-$(date +%Y%m%d-%H%M%S).mp4"
cp "$OUT_MP4" "$FINAL"
echo "[pipeline] ✓ Output: $FINAL"

SENDER="${SENDER:-skip}"
case "$SENDER" in
  green-api|openclaw)
    PHONE_TO_USE="${PHONE:-$DEFAULT_PHONE}"
    if [ -z "$PHONE_TO_USE" ]; then
      echo "[pipeline] No phone — skipping send"
    else
      node "$ROOT/scripts/send-whatsapp.mjs" --sender "$SENDER" --file "$FINAL" --phone "$PHONE_TO_USE" --caption "B-roll video ready"
    fi
    ;;
  *)
    echo "[pipeline] SENDER=skip — saved locally"
    ;;
esac

rm -rf "$MEDIA_DIR" "$TMPDIR" 2>/dev/null || true
echo "[pipeline] ✅ Done"
