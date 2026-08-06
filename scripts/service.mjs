/**
 * Cross-Platform Service Manager for Cardi Jarvis
 * Supports:
 *   - Linux: systemd user service (~/.config/systemd/user/cardi-jarvis.service)
 *   - macOS: launchd LaunchAgent (~/Library/LaunchAgents/com.cardinusantara.cardi-jarvis.plist)
 *   - Windows: Scheduled Task + VBScript background runner
 *
 * Usage:
 *   node scripts/service.mjs install
 *   node scripts/service.mjs uninstall
 *   node scripts/service.mjs status
 */
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync, spawnSync } from "node:child_process";
import os from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");
const action = process.argv[2] ?? "install";

const SERVICE_NAME = "cardi-jarvis";
const platform = process.platform;
const nodeBin = process.execPath;
const entryScript = resolve(rootDir, "scripts", "dev.mjs");

console.log(`\n⚙️ Cardi Jarvis Service Manager (${platform}) - Action: ${action}\n`);

if (action === "install") {
  installService();
} else if (action === "uninstall") {
  uninstallService();
} else if (action === "status") {
  checkStatus();
} else {
  console.log("Usage: node scripts/service.mjs [install|uninstall|status]");
}

function installService() {
  if (platform === "linux") {
    const userSystemdDir = resolve(os.homedir(), ".config", "systemd", "user");
    mkdirSync(userSystemdDir, { recursive: true });
    const serviceFile = resolve(userSystemdDir, `${SERVICE_NAME}.service`);

    const serviceContent = `[Unit]
Description=Cardi Jarvis Service
After=network.target

[Service]
Type=simple
WorkingDirectory=${rootDir}
ExecStart=${nodeBin} ${entryScript}
Restart=always
RestartSec=5
Environment=PATH=${process.env.PATH}

[Install]
WantedBy=default.target
`;

    writeFileSync(serviceFile, serviceContent, "utf-8");
    console.log(`✅ Systemd service file dibuat: ${serviceFile}`);

    try {
      execSync("systemctl --user daemon-reload");
      execSync(`systemctl --user enable ${SERVICE_NAME}`);
      execSync(`systemctl --user restart ${SERVICE_NAME}`);
      console.log(`🎉 Service systemd '${SERVICE_NAME}' berhasil diinstall dan dijalankan!`);
      console.log(`   Cek status: systemctl --user status ${SERVICE_NAME}`);
      console.log(`   Cek log   : journalctl --user -u ${SERVICE_NAME} -f`);
    } catch (e) {
      console.warn("⚠️ Perhatian pada systemctl --user:", e.message);
    }
  } else if (platform === "darwin") {
    const launchAgentsDir = resolve(os.homedir(), "Library", "LaunchAgents");
    mkdirSync(launchAgentsDir, { recursive: true });
    const plistFile = resolve(launchAgentsDir, `com.cardinusantara.${SERVICE_NAME}.plist`);

    const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.cardinusantara.${SERVICE_NAME}</string>
    <key>ProgramArguments</key>
    <array>
        <string>${nodeBin}</string>
        <string>${entryScript}</string>
    </array>
    <key>WorkingDirectory</key>
    <string>${rootDir}</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/${SERVICE_NAME}.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/${SERVICE_NAME}.error.log</string>
</dict>
</plist>
`;

    writeFileSync(plistFile, plistContent, "utf-8");
    console.log(`✅ macOS LaunchAgent plist dibuat: ${plistFile}`);

    try {
      execSync(`launchctl unload "${plistFile}" 2>/dev/null || true`);
      execSync(`launchctl load -w "${plistFile}"`);
      console.log(`🎉 Service launchctl 'com.cardinusantara.${SERVICE_NAME}' berhasil diinstall dan dijalankan!`);
      console.log(`   Cek log: tail -f /tmp/${SERVICE_NAME}.log`);
    } catch (e) {
      console.warn("⚠️ Perhatian pada launchctl:", e.message);
    }
  } else if (platform === "win32") {
    const taskName = "CardiJarvis";
    console.log("⚙️ Membuat Scheduled Task Windows untuk background service...");

    const vbsFile = resolve(rootDir, "cardi-runner.vbs");
    const vbsContent = `Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "${rootDir.replace(/\\/g, "\\\\")}"
WshShell.Run "${nodeBin.replace(/\\/g, "\\\\")} \\"${entryScript.replace(/\\/g, "\\\\")}\\"", 0, False
`;
    writeFileSync(vbsFile, vbsContent, "utf-8");

    try {
      const psCmd = `
        $action = New-ScheduledTaskAction -Execute "wscript.exe" -Argument "\\"${vbsFile.replace(/\\/g, "\\\\")}\\""
        $trigger = New-ScheduledTaskTrigger -AtLogOn
        Register-ScheduledTask -TaskName "${taskName}" -Action $action -Trigger $trigger -Description "Cardi Jarvis Service" -Force
        Start-ScheduledTask -TaskName "${taskName}"
      `;
      execSync(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${psCmd.replace(/\n/g, " ")}"`, { stdio: "inherit" });
      console.log(`🎉 Scheduled Task Windows '${taskName}' berhasil dibuat dan dijalankan!`);
    } catch (e) {
      console.warn("⚠️ Gagal membuat Scheduled Task via PowerShell. Menjalankan via VBScript langsung...", e.message);
      try {
        spawnSync("wscript.exe", [vbsFile], { detached: true, stdio: "ignore" });
        console.log("🚀 Cardi Jarvis telah dijalankan di background!");
      } catch (err) {
        console.error("❌ Gagal membuat background service di Windows.");
      }
    }
  }

  openBrowser("http://localhost:5173");
}

function uninstallService() {
  if (platform === "linux") {
    const serviceFile = resolve(os.homedir(), ".config", "systemd", "user", `${SERVICE_NAME}.service`);
    try {
      execSync(`systemctl --user stop ${SERVICE_NAME} 2>/dev/null || true`);
      execSync(`systemctl --user disable ${SERVICE_NAME} 2>/dev/null || true`);
      if (existsSync(serviceFile)) unlinkSync(serviceFile);
      execSync("systemctl --user daemon-reload 2>/dev/null || true");
      console.log("✅ Service Linux (systemd) berhasil dihapus.");
    } catch (e) {
      console.error("Error uninstall service:", e.message);
    }
  } else if (platform === "darwin") {
    const plistFile = resolve(os.homedir(), "Library", "LaunchAgents", `com.cardinusantara.${SERVICE_NAME}.plist`);
    try {
      execSync(`launchctl unload "${plistFile}" 2>/dev/null || true`);
      if (existsSync(plistFile)) unlinkSync(plistFile);
      console.log("✅ Service macOS (launchd) berhasil dihapus.");
    } catch (e) {
      console.error("Error uninstall service:", e.message);
    }
  } else if (platform === "win32") {
    try {
      execSync(`schtasks /Delete /TN "CardiJarvis" /F`, { stdio: "inherit" });
      console.log("✅ Scheduled Task Windows berhasil dihapus.");
    } catch (e) {
      console.error("Error uninstall service:", e.message);
    }
  }
}

function checkStatus() {
  if (platform === "linux") {
    try {
      const out = execSync(`systemctl --user status ${SERVICE_NAME}`, { encoding: "utf-8" });
      console.log(out);
    } catch (e) {
      console.log(e.stdout || e.message);
    }
  } else if (platform === "darwin") {
    try {
      const out = execSync(`launchctl list | grep com.cardinusantara.${SERVICE_NAME}`, { encoding: "utf-8" });
      console.log("Service Status:", out);
    } catch {
      console.log("Service tidak berjalan atau belum terinstall.");
    }
  } else if (platform === "win32") {
    try {
      const out = execSync(`schtasks /Query /TN "CardiJarvis" /FO LIST`, { encoding: "utf-8" });
      console.log(out);
    } catch {
      console.log("Scheduled Task CardiJarvis tidak ditemukan.");
    }
  }
}

function openBrowser(url) {
  try {
    if (platform === "darwin") execSync(`open "${url}"`);
    else if (platform === "win32") execSync(`start "${url}"`, { shell: "cmd.exe" });
    else execSync(`xdg-open "${url}" 2>/dev/null || true`);
  } catch {
    // Ignore if browser launch fails
  }
}
