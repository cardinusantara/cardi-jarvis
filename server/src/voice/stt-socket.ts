import WebSocket from "ws";
import type { WebSocket as ClientSocket } from "ws";
import { ELEVENLABS_API_KEY, ELEVENLABS_STT_MODEL, LANGUAGE } from "../config.js";
import type { SttClientMessage, SttServerMessage } from "@shared/protocol.js";

const ENDPOINT = "wss://api.elevenlabs.io/v1/speech-to-text/realtime";

/** Enough audio to cover a reconnect without clipping the start of a word. */
const MAX_BACKLOG = 120;

/**
 * Proxies browser mic audio to ElevenLabs Scribe v2 Realtime.
 *
 * Going through the server keeps the API key off the client and puts the
 * fallback decision in one place. On localhost the extra hop is free.
 *
 * The upstream connection is treated as disposable: ElevenLabs drops it after a
 * stretch of silence, and a long agent turn is exactly such a stretch. So while
 * the user still has the mic open we reconnect on our own — otherwise the mic
 * stays lit while nothing is listening, which is the worst possible failure for
 * a voice interface because it looks like it's working.
 */
export function attachSttSocket(client: ClientSocket) {
  const send = (msg: SttServerMessage) => {
    if (client.readyState === client.OPEN) client.send(JSON.stringify(msg));
  };

  let upstream: WebSocket | null = null;
  let ready = false;
  let listening = false;
  let session: { sampleRate: number; language: string } | null = null;
  let attempt = 0;
  let retryTimer: NodeJS.Timeout | null = null;
  const backlog: string[] = [];

  const open = () => {
    if (!ELEVENLABS_API_KEY) {
      send({ kind: "stt_error", message: "ELEVENLABS_API_KEY tidak diset." });
      return;
    }
    if (upstream || !session) return;

    const url = new URL(ENDPOINT);
    url.searchParams.set("model_id", ELEVENLABS_STT_MODEL);
    url.searchParams.set("audio_format", `pcm_${session.sampleRate}`);
    url.searchParams.set("language_code", session.language || LANGUAGE);
    url.searchParams.set("commit_strategy", "vad");
    url.searchParams.set("vad_silence_threshold_secs", "0.6");

    const socket = new WebSocket(url, { headers: { "xi-api-key": ELEVENLABS_API_KEY } });
    upstream = socket;

    socket.on("open", () => {
      ready = true;
      attempt = 0;
      send({ kind: "stt_open" });
      for (const chunk of backlog.splice(0)) socket.send(chunk);
    });

    socket.on("message", (raw) => {
      let payload: Record<string, unknown>;
      try {
        payload = JSON.parse(raw.toString());
      } catch {
        return;
      }
      const type = String(payload.message_type ?? payload.type ?? "");
      const text = extractText(payload);

      if (type === "partial_transcript") {
        if (text) send({ kind: "stt_partial", text });
      } else if (type === "committed_transcript" || type === "final_transcript") {
        if (text) send({ kind: "stt_final", text });
      } else if (type.endsWith("_error") || type === "error") {
        send({ kind: "stt_error", message: String(payload.message ?? payload.error ?? type) });
      }
    });

    socket.on("error", (err) => {
      // Errors arrive right before close; let close drive the reconnect so we
      // don't schedule two.
      console.warn(`[stt] upstream error: ${err.message}`);
    });

    socket.on("close", (code, reason) => {
      ready = false;
      if (upstream === socket) upstream = null;
      if (!listening) return;

      console.warn(`[stt] upstream closed (${code} ${reason.toString().slice(0, 80)}) — menyambung ulang`);
      const delay = Math.min(300 * 2 ** attempt++, 4000);
      retryTimer = setTimeout(open, delay);
    });
  };

  client.on("message", (raw, isBinary) => {
    if (isBinary) {
      // Raw PCM16 frames straight off the AudioWorklet.
      const frame = JSON.stringify({
        message_type: "input_audio_chunk",
        audio_base_64: (raw as Buffer).toString("base64"),
      });
      if (ready && upstream) {
        upstream.send(frame);
        return;
      }
      // Hold a little audio across the handshake or a reconnect, and drop the
      // oldest rather than the newest — stale audio is worthless.
      backlog.push(frame);
      if (backlog.length > MAX_BACKLOG) backlog.shift();
      return;
    }

    let msg: SttClientMessage;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (msg.kind === "stt_start") {
      session = { sampleRate: msg.sampleRate, language: msg.language };
      listening = true;
      attempt = 0;
      open();
    } else if (msg.kind === "stt_stop") {
      listening = false;
      backlog.length = 0;
      if (retryTimer) clearTimeout(retryTimer);
      upstream?.close();
    }
  });

  const shutdown = () => {
    listening = false;
    if (retryTimer) clearTimeout(retryTimer);
    upstream?.close();
    upstream = null;
  };
  client.on("close", shutdown);
  client.on("error", shutdown);
}

/** The realtime API has shipped a few field names; accept the ones we've seen. */
function extractText(payload: Record<string, unknown>): string {
  for (const key of ["text", "transcript"]) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  const nested = payload.transcript ?? payload.result;
  if (nested && typeof nested === "object") {
    const value = (nested as Record<string, unknown>).text;
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}
