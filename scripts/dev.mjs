/**
 * Starts the server and the web dev server together.
 *
 * This replaces `concurrently`: on Windows its `npm:script` shorthand nests
 * four levels of cmd.exe (npm → concurrently → npm → npm → tsx) and the server
 * child silently never bound its port. Spawning the two watchers directly with
 * inherited stdio is both more reliable and one dependency lighter.
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const targets = [
  { name: "server", cwd: resolve(root, "server"), args: ["tsx", "watch", "--clear-screen=false", "src/index.ts"] },
  { name: "web", cwd: resolve(root, "web"), args: ["vite"] },
];

const children = targets.map(({ name, cwd, args }) => {
  const child = spawn("npx", args, {
    cwd,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  child.on("exit", (code, signal) => {
    if (shuttingDown) return;
    console.error(`\n[${name}] exited (${signal ?? code}) — stopping the other process too.`);
    shutdown();
  });
  return child;
});

let shuttingDown = false;
function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) child.kill();
  setTimeout(() => process.exit(1), 300);
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    shuttingDown = true;
    for (const child of children) child.kill();
    process.exit(0);
  });
}
