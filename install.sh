#!/bin/bash
# B-roll Skill — one-command installer
# Usage: curl -sSL https://raw.githubusercontent.com/Meir770ar/broll-skill/master/install.sh | bash
set -e

REPO_URL="https://github.com/Meir770ar/broll-skill.git"
TARGET="${BROLL_SKILL_DIR:-$HOME/broll-skill}"

echo ""
echo "🎬 B-roll Skill Installer"
echo "========================="
echo ""

# --- 1. Check prerequisites ---
echo "[1/6] Checking prerequisites..."
MISSING=""
for cmd in node npm git ffmpeg; do
  if ! command -v "$cmd" > /dev/null 2>&1; then
    MISSING="$MISSING $cmd"
  fi
done

if [ -n "$MISSING" ]; then
  echo ""
  echo "❌ Missing required tools:$MISSING"
  echo ""
  echo "Install them first:"
  echo "  macOS:    brew install node ffmpeg git"
  echo "  Ubuntu:   sudo apt install -y nodejs npm ffmpeg git"
  echo "  Windows:  https://nodejs.org  +  https://www.gyan.dev/ffmpeg/builds/"
  exit 1
fi

NODE_MAJOR=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "❌ Node.js $NODE_MAJOR detected. Requires 20+. Upgrade at https://nodejs.org"
  exit 1
fi
echo "✅ All prerequisites installed"

# --- 2. Clone repo ---
echo ""
echo "[2/6] Cloning repo to $TARGET..."
if [ -d "$TARGET" ]; then
  echo "⚠️  $TARGET already exists. Pulling latest instead of cloning."
  cd "$TARGET" && git pull --ff-only || { echo "❌ git pull failed"; exit 1; }
else
  git clone "$REPO_URL" "$TARGET"
  cd "$TARGET"
fi
echo "✅ Repo ready at $TARGET"

# --- 3. Install dependencies ---
echo ""
echo "[3/6] Installing dependencies (may take 2-3 min for Chromium)..."
(cd scripts && npm install --silent)
(cd remotion && npm install --silent)
echo "✅ Dependencies installed"

# --- 4. Create config files ---
echo ""
echo "[4/6] Creating config files..."
[ ! -f .env ] && cp .env.example .env && echo "  → .env created from template"
[ ! -f config.json ] && cp config.example.json config.json && echo "  → config.json created from template"
echo "✅ Config files ready"

# --- 5. Create fonts directory ---
echo ""
echo "[5/6] Preparing fonts directory..."
mkdir -p remotion/public/fonts
if [ ! -f remotion/public/fonts/Assistant-Regular.ttf ]; then
  echo "  → Attempting auto-download of Assistant font from Google Fonts..."
  if command -v curl > /dev/null 2>&1; then
    curl -sSL -o remotion/public/fonts/Assistant-Regular.ttf \
      "https://github.com/google/fonts/raw/main/ofl/assistant/Assistant%5Bwght%5D.ttf" 2>/dev/null || true
    curl -sSL -o remotion/public/fonts/Assistant-Bold.ttf \
      "https://github.com/google/fonts/raw/main/ofl/assistant/Assistant%5Bwght%5D.ttf" 2>/dev/null || true
  fi
  if [ -s remotion/public/fonts/Assistant-Regular.ttf ]; then
    echo "  ✅ Font downloaded"
  else
    echo "  ⚠️  Auto-download failed. Download manually from https://fonts.google.com/specimen/Assistant"
    echo "     and place Assistant-Regular.ttf + Assistant-Bold.ttf in remotion/public/fonts/"
  fi
fi

# --- 6. Final instructions ---
echo ""
echo "[6/6] Installation complete!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ INSTALLED at: $TARGET"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📝 NEXT STEPS — get 3 free API keys (takes 5 minutes):"
echo ""
echo "  1. Gemini (FREE)    → https://aistudio.google.com/apikey"
echo "  2. ElevenLabs (\$5)  → https://elevenlabs.io/app/settings/api-keys"
echo "  3. Pexels (FREE)    → https://www.pexels.com/api/"
echo ""
echo "📝 THEN edit this file with your keys:"
echo "     $TARGET/.env"
echo ""
echo "🧪 TEST with:"
echo "     cd $TARGET"
echo "     ./scripts/pipeline.sh --video /path/to/test.mp4 --config ./config.json"
echo ""
echo "📚 Full guide: $TARGET/README.md"
echo ""
