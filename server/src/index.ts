import express from "express";
import { createServer } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import { appConfig, PORT, WEB_ORIGIN } from "./config.js";
import { attachAgentSocket } from "./agent/socket.js";
import { attachSttSocket } from "./voice/stt-socket.js";
import { attachTtsSocket } from "./voice/tts-socket.js";

const app = express();

app.use((_req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", WEB_ORIGIN);
  next();
});

app.get("/api/config", (_req, res) => res.json(appConfig));
app.get("/api/health", (_req, res) => res.json({ ok: true }));

const server = createServer(app);

/**
 * One WebSocketServer per path, dispatched manually on upgrade. Keeping the
 * three concerns on separate sockets means a voice hiccup can't stall the
 * agent stream, and vice versa.
 */
const routes: Record<string, { wss: WebSocketServer; attach: (ws: WebSocket) => void }> = {
  "/agent": { wss: new WebSocketServer({ noServer: true }), attach: attachAgentSocket },
  "/voice/stt": { wss: new WebSocketServer({ noServer: true }), attach: attachSttSocket },
  "/voice/tts": { wss: new WebSocketServer({ noServer: true }), attach: attachTtsSocket },
};

server.on("upgrade", (req, socket, head) => {
  const path = new URL(req.url ?? "/", "http://localhost").pathname;
  const route = routes[path];
  if (!route) {
    socket.destroy();
    return;
  }
  route.wss.handleUpgrade(req, socket, head, (ws) => route.attach(ws));
});

server.listen(PORT, () => {
  console.log(`\n  cardi server →  http://localhost:${PORT}`);
  console.log(`  dengar (stt) →  ${appConfig.stt}`);
  console.log(`  bicara (tts) →  ${appConfig.tts}${appConfig.voiceNote ? `  (${appConfig.voiceNote})` : ""}`);
  console.log(`  model        →  ${appConfig.model}`);
  console.log(`  cwd          →  ${appConfig.cwd}\n`);
});
