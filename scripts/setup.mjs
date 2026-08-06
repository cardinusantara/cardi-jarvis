/**
 * Cross-platform one-shot setup script for Linux, macOS, and Windows.
 * Usage:
 *   npm run setup <ELEVENLABS_API_KEY>
 *   or
 *   node scripts/setup.mjs <ELEVENLABS_API_KEY>
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import readline from "node:readline";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");
const envFile = resolve(rootDir, ".env");
const envExampleFile = resolve(rootDir, ".env.example");

console.log("\n==========================================");
console.log("🚀 Cardi Jarvis - One-Shot Setup");
console.log("==========================================");

// 1. Determine ElevenLabs API Key argument
let elevenlabsKey = process.argv[2]?.trim();

async function askKey() {
  if (!elevenlabsKey) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    elevenlabsKey = await new Promise((res) => {
      rl.question("\n🔑 Masukkan ElevenLabs API Key (tekan Enter untuk lewati): ", (ans) => {
        rl.close();
        res(ans.trim());
      });
    });
  }
}

async function main() {
  await askKey();

  // 2. Install dependencies if node_modules missing
  const nodeModulesPath = resolve(rootDir, "node_modules");
  if (!existsSync(nodeModulesPath)) {
    console.log("\n📦 Menginstall dependensi (npm install)...");
    const installRes = spawnSync("npm", ["install"], {
      cwd: rootDir,
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    if (installRes.status !== 0) {
      console.error("❌ Gagal menginstall dependensi.");
      process.exit(1);
    }
  } else {
    console.log("\n✅ node_modules sudah ditemukan.");
  }

  // 3. Create or Update .env file
  console.log("\n⚙️  Menyiapkan file .env...");
  let envContent = "";
  if (existsSync(envExampleFile)) {
    envContent = readFileSync(envExampleFile, "utf-8");
  }

  if (elevenlabsKey) {
    if (envContent.includes("ELEVENLABS_API_KEY=")) {
      envContent = envContent.replace(
        /ELEVENLABS_API_KEY=.*/,
        `ELEVENLABS_API_KEY=${elevenlabsKey}`
      );
    } else {
      envContent += `\nELEVENLABS_API_KEY=${elevenlabsKey}\n`;
    }
  }

  // Preserve existing .env values if rerun without key parameter
  if (existsSync(envFile)) {
    const existing = readFileSync(envFile, "utf-8");
    if (!elevenlabsKey) {
      const match = existing.match(/ELEVENLABS_API_KEY=(.*)/);
      if (match && match[1]?.trim()) {
        elevenlabsKey = match[1].trim();
        envContent = envContent.replace(
          /ELEVENLABS_API_KEY=.*/,
          `ELEVENLABS_API_KEY=${elevenlabsKey}`
        );
      }
    }
  }

  writeFileSync(envFile, envContent, "utf-8");
  console.log("✅ File .env berhasil dibuat/diperbarui!");
  if (elevenlabsKey) {
    const masked = elevenlabsKey.length > 10
      ? `${elevenlabsKey.slice(0, 6)}...${elevenlabsKey.slice(-4)}`
      : "***";
    console.log(`   ELEVENLABS_API_KEY: ${masked}`);
  } else {
    console.log("   ELEVENLABS_API_KEY: (kosong - menggunakan Web Speech API browser)");
  }

  // 4. Run Claude Code Auth Check & Login
  console.log("\n🔐 Memeriksa autentikasi Claude...");
  const statusRes = spawnSync("npx", ["-y", "@anthropic-ai/claude-code", "auth", "status"], {
    cwd: rootDir,
    encoding: "utf-8",
    shell: process.platform === "win32",
  });

  if (statusRes.stdout && statusRes.stdout.includes('"loggedIn": true')) {
    console.log("✅ Claude Code sudah terautentikasi!");
  } else {
    console.log("\n=========================================================");
    console.log("🔑 AUTENTIKASI CLAUDE CODE");
    console.log("=========================================================");
    console.log("👉 Salin (copy) LINK AUTENTIKASI yang muncul di bawah ini,");
    console.log("   lalu buka di browser laptop / HP Anda untuk login.");
    console.log("👉 Setelah login, salin kode konfirmasi dan paste di sini.");
    console.log("=========================================================\n");

    const authRes = spawnSync("npx", ["-y", "@anthropic-ai/claude-code", "login"], {
      cwd: rootDir,
      stdio: "inherit",
      shell: process.platform === "win32",
    });

    if (authRes.status === 0) {
      console.log("\n🎉 Autentikasi Claude berhasil!");
    } else {
      console.log("\n⚠️ Autentikasi Claude selesai atau dilewati.");
    }
  }

  // 5. Register Background Service
  console.log("\n🛠️ Mendaftarkan Cardi Jarvis sebagai Background Service...");
  spawnSync("node", ["scripts/service.mjs", "install"], {
    cwd: rootDir,
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  console.log("\n==========================================");
  console.log("✨ Setup Selesai!");
  console.log("🚀 Cardi Jarvis sekarang berjalan sebagai background service!");
  console.log("🌐 Aplikasi terbuka di http://localhost:5173");
  console.log("   (Tidak perlu lagi menjalankan `npm run dev` manual)");
  console.log("==========================================\n");
}

main().catch((err) => {
  console.error("❌ Error saat setup:", err);
  process.exit(1);
});
