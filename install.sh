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

# 2. Clone repo if not inside project folder
if [ -f "package.json" ] && grep -q '"name": "cardi"' package.json 2>/dev/null; then
    echo "📂 Menggunakan folder proyek saat ini."
else
    if [ ! -d "$TARGET_DIR" ]; then
        echo "📥 Meng-clone repository $REPO_URL..."
        git clone "$REPO_URL" "$TARGET_DIR"
    fi
    cd "$TARGET_DIR"
fi

# 3. Prompt key if not provided as argument
if [ -z "$ELEVENLABS_KEY" ]; then
    if [ -t 0 ]; then
        read -p "🔑 Masukkan ElevenLabs API Key (tekan Enter untuk lewati): " ELEVENLABS_KEY
    elif [ -c /dev/tty ]; then
        read -p "🔑 Masukkan ElevenLabs API Key (tekan Enter untuk lewati): " ELEVENLABS_KEY < /dev/tty
    fi
fi

# 4. Install dependencies if node_modules missing
if [ ! -d "node_modules" ]; then
    echo ""
    echo "📦 Menginstall dependensi (npm install)..."
    npm install
else
    echo "✅ node_modules sudah ditemukan."
fi

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

# 6. Run Claude Code login (Opens Browser for Auth)
echo ""
echo "🔐 Membuka browser untuk autentikasi Claude..."
echo "   Silakan selesaikan login Anthropic / Claude di browser yang terbuka."
echo ""

if [ -c /dev/tty ]; then
    npx -y @anthropic-ai/claude-code login < /dev/tty || true
else
    npx -y @anthropic-ai/claude-code login || true
fi

echo ""
echo "=========================================="
echo "✨ Setup Selesai! Kamu siap menjalankan aplikasi."
echo "   Folder : $(pwd)"
echo "   Jalankan: npm run dev"
echo "=========================================="
echo ""
