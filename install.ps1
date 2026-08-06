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

# 2. Check current directory or clone
if ((Test-Path "package.json") -and (Get-Content "package.json" -Raw | Select-String '"name": "cardi"')) {
    Write-Host "📂 Menggunakan folder proyek saat ini." -ForegroundColor Green
} else {
    if (-not (Test-Path $TargetDir)) {
        Write-Host "📥 Meng-clone repository $RepoUrl..." -ForegroundColor Yellow
        git clone $RepoUrl $TargetDir
    }
    Set-Location $TargetDir
}

# 3. Prompt ElevenLabs Key if empty
if ([string]::IsNullOrWhiteSpace($ElevenLabsKey)) {
    $ElevenLabsKey = Read-Host "🔑 Masukkan ElevenLabs API Key (tekan Enter untuk lewati)"
}

# 4. Install dependencies
if (-not (Test-Path "node_modules")) {
    Write-Host "`n📦 Menginstall dependensi (npm install)..." -ForegroundColor Yellow
    npm install
} else {
    Write-Host "✅ node_modules sudah ditemukan." -ForegroundColor Green
}

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

# 6. Claude Auth Login
Write-Host "`n🔐 Membuka browser untuk autentikasi Claude..." -ForegroundColor Yellow
Write-Host "   Silakan selesaikan login Anthropic / Claude di browser yang terbuka.`n" -ForegroundColor Yellow

npx -y @anthropic-ai/claude-code login

# 7. Register Background Service
Write-Host "`n🛠️ Mendaftarkan Cardi Jarvis sebagai Background Service..." -ForegroundColor Yellow
node scripts/service.mjs install

Write-Host "`n==========================================" -ForegroundColor Cyan
Write-Host "✨ Setup Selesai!" -ForegroundColor Green
Write-Host "🚀 Cardi Jarvis sekarang berjalan otomatis sebagai background service!" -ForegroundColor Green
Write-Host "🌐 Aplikasi terbuka di http://localhost:5173" -ForegroundColor Green
Write-Host "==========================================`n" -ForegroundColor Cyan
