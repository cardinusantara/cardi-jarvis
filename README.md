# Cardi

Asisten bersuara untuk Cardi Nusantara, dijalankan oleh Claude.

Bicara ke mikrofon; Cardi mengerjakan apa pun yang biasa dikerjakan Claude Code — baca
file, jalankan perintah, cari di web, periksa kondisi mesin — sambil **bercerita apa yang
sedang dia lakukan**, lalu menjawab lewat suara. Kalau kamu minta visualisasi, dia
menggambarnya langsung di halaman.

```
Kamu : "Lihat isi folder server/src, baca satu file yang menarik, jelaskan singkat."
Cardi: "Oke, saya lihat dulu ya isi foldernya."          → Bash
       "Ada dua subfolder, agent dan voice."             → Bash
       "session.ts paling besar — itu yang saya buka."   → Read
       "Ternyata isinya kelas AgentSession, jantung sesi percakapan…"

Kamu : "Oke coba buat visualisasinya"
Cardi: "Sudah aku tampilkan di sebelah…"      ← kartu muncul di canvas
```

Narasi itu bukan hiasan: asisten suara yang diam empat puluh detik sambil bekerja terasa
rusak, walau sebenarnya tidak.

## Menjalankan

### 1-Liner Setup via `curl` (Tanpa perlu download script file manual)

**macOS / Ubuntu / Linux (via `curl`):**
```bash
curl -fsSL https://raw.githubusercontent.com/cardinusantara/cardi-jarvis/main/install.sh | bash -s -- <ELEVENLABS_API_KEY>
```

**Windows (via PowerShell `iwr`):**
```powershell
iwr -useb https://raw.githubusercontent.com/cardinusantara/cardi-jarvis/main/install.ps1 | iex
```

### Setup Lokal (Jika repositori sudah di-clone)

```bash
# Menggunakan npm:
npm run setup <ELEVENLABS_API_KEY>

# Atau via bash (Linux/macOS):
./setup.sh <ELEVENLABS_API_KEY>

# Atau via CMD/PowerShell (Windows):
.\setup.bat <ELEVENLABS_API_KEY>
```

> **Apa yang dilakukan skrip setup ini secara otomatis?**
> 1. Menginstall semua dependensi (`npm install`).
> 2. Menyiapkan file `.env` dengan token ElevenLabs milikmu.
> 3. Membuka browser secara otomatis untuk autentikasi Claude (`claude auth login`).

Setelah setup selesai, cukup jalankan:

```bash
npm run dev              # server :8787 + web :5173
```

Buka <http://localhost:5173>. Tidak perlu `ANTHROPIC_API_KEY`: SDK memakai kredensial
Claude Code yang sudah diproses saat login.

> ⚠️ Agent berjalan dengan `permissionMode: bypassPermissions` — Claude bisa menulis
> dan menghapus file **tanpa bertanya**. Arahkan `AGENT_CWD` ke folder kerja, bukan
> root drive.

## Suara

`ELEVENLABS_API_KEY` opsional dan dipilih terpisah untuk mendengar dan berbicara.

| | Tanpa key | Dengan key |
|---|---|---|
| Dengar (STT) | Web Speech API (Chrome) | ElevenLabs Scribe v2 Realtime |
| Bicara (TTS) | `speechSynthesis` browser | ElevenLabs — **butuh plan berbayar** |

Akun ElevenLabs gratis bisa STT realtime tapi ditolak (`402`) untuk TTS dengan
*library voice*. Server menangani ini sendiri: percobaan pertama gagal, satu pesan
`tts_unavailable` dikirim, lalu suara balasan pindah ke browser untuk seterusnya.

Cek kemampuan key-mu:

```bash
npm run probe:voice -w server
```

### Kenapa mikrofon dibisukan saat Cardi bicara

Mikrofon mendengar speaker. Echo-cancellation `getUserMedia` menutupi jalur WebRTC, tapi
**tidak** menutupi `speechSynthesis` — jadi dengan mikrofon terbuka, Cardi mentranskrip
suaranya sendiri, meng-interrupt dirinya sendiri, lalu mengirim kalimatnya sendiri balik
sebagai perintah. Setelah satu laporan panjang, sesi jadi tidak bisa dipakai lagi.

Maka jalur mikrofon dibisukan selama Cardi berbicara (plus ekor 400 ms untuk peluruhan
speaker). Konsekuensinya: **memotong Cardi di tengah kalimat dilakukan lewat tombol
mikrofon atau `Esc`**, bukan dengan berbicara. Full-duplex butuh AEC sungguhan pada satu
graf audio, yang tidak bisa diberikan TTS browser.

## Bagaimana Claude bisa menggambar

`createSdkMcpServer` menjalankan tool **di dalam proses server kita**. Jadi handler-nya
bisa langsung mengirim spec ke browser lewat WebSocket lalu membalas satu baris ke
Claude. Tanpa message bus, tanpa polling.

| Tool | Fungsi |
|---|---|
| `render_component` | Kartu dari registry: chart garis/area/batang/pie, metrik, tabel, timeline, markdown, kode, gambar |
| `update_component` | Perbarui kartu di tempat lewat `id` — untuk data yang bergerak |
| `render_html` | HTML bebas di iframe sandbox, untuk yang tidak muat di registry |
| `clear_canvas` | Kosongkan canvas |
| `system_metrics` | CPU/RAM/disk/jaringan/proses, snapshot atau deret waktu |

Selebihnya tool bawaan Claude Code: Bash, Read, Write, Edit, Glob, Grep, WebSearch, WebFetch.

## Struktur

```
shared/       protocol.ts (pesan WS) + spec.ts (skema Zod komponen)
server/       Express + ws; AgentSession, tool MCP, proxy suara
web/          React + Vite; HUD, orb canvas, registry chart
scripts/      dev.mjs — menyalakan keduanya
```

Alur satu giliran: browser → `/agent` → `AgentSession` → Claude Agent SDK → tool →
handler mengirim balik ke `/agent` → React merender.

## Skrip

| Perintah | Fungsi |
|---|---|
| `npm run setup` | Setup 1-kali (install deps, buat `.env`, login Claude) |
| `npm run dev` | Server + web dengan watch |
| `npm run typecheck` | Kedua workspace |
| `npm run smoke -w server` | Uji SDK terpisah dari plumbing kita |
| `npm run probe:voice -w server` | Uji STT realtime dan TTS ElevenLabs |

## Catatan teknis

- **Streaming input mode.** `prompt` berupa `AsyncGenerator` yang tidak pernah selesai —
  itulah yang memberi sesi panjang, antrean pesan, dan `interrupt()`.
- **`system/init` datang setelah pesan pertama.** Jangan menunggu "ready" sebelum
  mengirim; itu deadlock. Server mengirim `ready` awal dari config.
- **`settingSources: []`.** Agent tidak mewarisi `~/.claude/CLAUDE.md` atau setelan
  proyek — system prompt kita satu-satunya sumber instruksi (persona Cardi ada di sana).
- **Sesi STT disambung ulang sendiri.** ElevenLabs menutup sesi realtime setelah kira-kira
  15 detik tanpa audio. Karena mikrofon dibisukan saat Cardi bicara, itu pasti kejadian —
  jadi server menyambungkannya kembali dengan backoff selama mikrofon masih aktif.
- **Palet chart** memakai langkah gelap palet referensi `dataviz`, tervalidasi terhadap
  permukaan `#0d1117` (lightness band, chroma floor, pemisahan CVD, contrast).
  Warna HUD sengaja dipisah dari warna data.
