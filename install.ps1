# One-shot Installer & Setup Script for Cardi Jarvis (Windows PowerShell)
# Usage via iwr:
#   iwr -useb https://raw.githubusercontent.com/cardinusantara/cardi-jarvis/main/install.ps1 | iex

param (
    [string]$ElevenLabsKey = ""
)

$ErrorActionPreference = "Stop"
$RepoUrl = "https://github.com/cardinusantara/cardi-jarvis.git"
$TargetDir = "cardi-jarvis"

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "🚀 Cardi Jarvis - Quick Setup" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# 1. Check Node & npm
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Node.js belum terinstall. Silakan install Node.js (v18+) terlebih dahulu." -ForegroundColor Red
    exit 1
}

# 2. Clone or Update repository
if ((Test-Path "package.json") -and (Get-Content "package.json" -Raw | Select-String '"name": "cardi"')) {
    Write-Host "📂 Menggunakan folder proyek saat ini ($(Get-Location))." -ForegroundColor Green
    Write-Host "🔄 Memperbarui repositori ke versi terbaru (git pull)..." -ForegroundColor Yellow
    git pull origin main 2>$null
} else {
    if (-not (Test-Path $TargetDir)) {
        Write-Host "📥 Meng-clone repository $RepoUrl..." -ForegroundColor Yellow
        git clone $RepoUrl $TargetDir
        Set-Location $TargetDir
    } else {
        Write-Host "📂 Folder $TargetDir ditemukan. Memperbarui ke versi terbaru..." -ForegroundColor Yellow
        Set-Location $TargetDir
        git pull origin main 2>$null
    }
}

# 3. Prompt ElevenLabs Key if empty
if ([string]::IsNullOrWhiteSpace($ElevenLabsKey)) {
    $ElevenLabsKey = Read-Host "🔑 Masukkan ElevenLabs API Key (tekan Enter untuk lewati)"
}

# 4. Install dependencies
Write-Host "`n📦 Memeriksa & menginstall dependensi (npm install)..." -ForegroundColor Yellow
npm install

# 5. Setup .env
Write-Host "`n⚙️ Menyiapkan file .env..." -ForegroundColor Yellow
if ((-not (Test-Path ".env")) -and (Test-Path ".env.example")) {
    Copy-Item ".env.example" ".env"
}

if (-not [string]::IsNullOrWhiteSpace($ElevenLabsKey)) {
    if (Test-Path ".env") {
        $envContent = Get-Content ".env" -Raw
        if ($envContent -match "ELEVENLABS_API_KEY=") {
            $envContent = $envContent -replace "ELEVENLABS_API_KEY=.*", "ELEVENLABS_API_KEY=$ElevenLabsKey"
        } else {
            $envContent += "`nELEVENLABS_API_KEY=$ElevenLabsKey`n"
        }
        Set-Content -Path ".env" -Value $envContent -Encoding UTF8
    }
    Write-Host "✅ File .env berhasil diset dengan ELEVENLABS_API_KEY!" -ForegroundColor Green
} else {
    Write-Host "✅ File .env disiapkan (tanpa key ElevenLabs, menggunakan Web Speech API browser)." -ForegroundColor Green
}

# 6. Claude Auth Check & Login
Write-Host "`n🔐 Memeriksa autentikasi Claude..." -ForegroundColor Yellow
$authStatus = npx -y @anthropic-ai/claude-code auth status 2>$null

if ($authStatus -match '"loggedIn": true') {
    Write-Host "✅ Claude Code sudah terautentikasi!" -ForegroundColor Green
} else {
    Write-Host "`n=========================================================" -ForegroundColor Yellow
    Write-Host "🔑 AUTENTIKASI CLAUDE CODE" -ForegroundColor Yellow
    Write-Host "=========================================================" -ForegroundColor Yellow
    Write-Host "👉 Salin (copy) LINK AUTENTIKASI yang muncul di bawah ini," -ForegroundColor Yellow
    Write-Host "   lalu buka di browser untuk login." -ForegroundColor Yellow
    Write-Host "👉 Setelah login, salin kode konfirmasi dan paste di sini." -ForegroundColor Yellow
    Write-Host "=========================================================`n" -ForegroundColor Yellow

    npx -y @anthropic-ai/claude-code login
}

# 7. Register Background Service
Write-Host "`n🛠️ Mendaftarkan Cardi Jarvis sebagai Background Service..." -ForegroundColor Yellow
node scripts/service.mjs install

Write-Host "`n==========================================" -ForegroundColor Cyan
Write-Host "✨ Setup Selesai!" -ForegroundColor Green
Write-Host "🚀 Cardi Jarvis sekarang berjalan otomatis sebagai background service!" -ForegroundColor Green
Write-Host "🌐 Aplikasi terbuka di http://localhost:5173" -ForegroundColor Green
Write-Host "==========================================`n" -ForegroundColor Cyan
