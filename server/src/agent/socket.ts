import type { WebSocket } from "ws";
import { AgentSession } from "./session.js";
import { AGENT_CWD, MODEL } from "../config.js";
import type { AgentClientMessage, AgentServerMessage } from "@shared/protocol.js";

export function attachAgentSocket(ws: WebSocket) {
  const send = (msg: AgentServerMessage) => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
  };

  const session = new AgentSession(send);
  session.start();

  // The SDK only emits system/init once the first user message is in flight, so
  // an "are we ready?" handshake here would deadlock: the client would wait for
  // a message that only its own message can trigger. Announce readiness up
  // front from config; the real session id arrives with the first turn.
  send({ kind: "ready", sessionId: null, model: MODEL, cwd: AGENT_CWD });

  ws.on("message", (raw) => {
    let msg: AgentClientMessage;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (msg.kind === "user_text") {
      const text = msg.text.trim();
      if (text) session.send(text);
    } else if (msg.kind === "interrupt") {
      void session.interrupt();
    }
  });

  ws.on("close", () => session.close());
  ws.on("error", () => session.close());
}
