#!/usr/bin/env bash
set -e

# One-shot Installer & Setup Script for Cardi Jarvis (macOS & Ubuntu/Linux)
# Usage via curl:
#   curl -fsSL https://raw.githubusercontent.com/cardinusantara/cardi-jarvis/main/install.sh | bash -s -- [ELEVENLABS_API_KEY]

ELEVENLABS_KEY="$1"
REPO_URL="https://github.com/cardinusantara/cardi-jarvis.git"
TARGET_DIR="cardi-jarvis"

echo ""
echo "=========================================="
echo "🚀 Cardi Jarvis - Quick Setup"
echo "=========================================="

# 1. Check prerequisites
if ! command -v node &> /dev/null; then
    echo "❌ Node.js belum terinstall. Silakan install Node.js (v18+) terlebih dahulu."
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "❌ npm belum terinstall."
    exit 1
fi

# 2. Clone or Update repository
if [ -f "package.json" ] && grep -q '"name": "cardi"' package.json 2>/dev/null; then
    echo "📂 Menggunakan folder proyek saat ini ($(pwd))."
    echo "🔄 Memperbarui repositori ke versi terbaru (git pull)..."
    git pull origin main 2>/dev/null || true
else
    if [ ! -d "$TARGET_DIR" ]; then
        echo "📥 Meng-clone repository $REPO_URL..."
        git clone "$REPO_URL" "$TARGET_DIR"
        cd "$TARGET_DIR"
    else
        echo "📂 Folder $TARGET_DIR ditemukan. Memperbarui ke versi terbaru..."
        cd "$TARGET_DIR"
        git pull origin main 2>/dev/null || true
    fi
fi

# 3. Prompt key if not provided as argument
if [ -z "$ELEVENLABS_KEY" ]; then
    if [ -t 0 ]; then
        read -p "🔑 Masukkan ElevenLabs API Key (tekan Enter untuk lewati): " ELEVENLABS_KEY
    elif [ -c /dev/tty ]; then
        read -p "🔑 Masukkan ElevenLabs API Key (tekan Enter untuk lewati): " ELEVENLABS_KEY < /dev/tty
    fi
fi

# 4. Install dependencies
echo ""
echo "📦 Memeriksa & menginstall dependensi (npm install)..."
npm install

# 5. Create or Update .env file
echo ""
echo "⚙️ Menyiapkan file .env..."
if [ ! -f ".env" ] && [ -f ".env.example" ]; then
    cp .env.example .env
fi

if [ -n "$ELEVENLABS_KEY" ]; then
    if [ -f ".env" ]; then
        if grep -q "ELEVENLABS_API_KEY=" .env; then
            if [[ "$OSTYPE" == "darwin"* ]]; then
                sed -i '' "s/ELEVENLABS_API_KEY=.*/ELEVENLABS_API_KEY=$ELEVENLABS_KEY/" .env
            else
                sed -i "s/ELEVENLABS_API_KEY=.*/ELEVENLABS_API_KEY=$ELEVENLABS_KEY/" .env
            fi
        else
            echo "ELEVENLABS_API_KEY=$ELEVENLABS_KEY" >> .env
        fi
    fi
    echo "✅ File .env berhasil diset dengan ELEVENLABS_API_KEY!"
else
    echo "✅ File .env disiapkan (tanpa key ElevenLabs, menggunakan Web Speech API browser)."
fi

# 6. Check & Run Claude Code login
echo ""
echo "🔐 Memeriksa autentikasi Claude..."

IS_LOGGED_IN=$(npx -y @anthropic-ai/claude-code auth status 2>/dev/null | grep -o '"loggedIn": true' || true)

if [ -n "$IS_LOGGED_IN" ]; then
    echo "✅ Claude Code sudah terautentikasi!"
else
    echo ""
    echo "========================================================="
    echo "🔑 AUTENTIKASI CLAUDE CODE"
    echo "========================================================="
    echo "👉 Salin (copy) LINK AUTENTIKASI yang muncul di bawah ini,"
    echo "   lalu buka di browser laptop / HP Anda untuk login."
    echo "👉 Setelah login, salin kode konfirmasi dan paste di sini."
    echo "========================================================="
    echo ""

    if [ -c /dev/tty ]; then
        npx -y @anthropic-ai/claude-code login < /dev/tty > /dev/tty 2>&1 || true
    else
        npx -y @anthropic-ai/claude-code login || true
    fi
fi

# 7. Register Background Service
echo ""
echo "🛠️ Mendaftarkan Cardi Jarvis sebagai Background Service..."
node scripts/service.mjs install

echo ""
echo "=========================================="
echo "✨ Setup Selesai!"
echo "🚀 Cardi Jarvis sekarang berjalan otomatis sebagai background service!"
echo "📁 Folder : $(pwd)"
echo "=========================================="
echo ""
