import type { WebSocket as ClientSocket } from "ws";
import {
  ELEVENLABS_API_KEY,
  ELEVENLABS_TTS_MODEL,
  ELEVENLABS_VOICE_ID,
  LANGUAGE,
} from "../config.js";
import type { TtsClientMessage, TtsServerMessage } from "@shared/protocol.js";

const OUTPUT_FORMAT = "mp3_22050_32";

/**
 * Sentence-at-a-time TTS.
 *
 * The plan called for the stream-input WebSocket, but the HTTP streaming
 * endpoint turned out to be the better fit here: sentences are short, and an
 * AbortController gives clean, instant cancellation for barge-in — which the
 * WS route makes awkward. Audio still starts as soon as the *first* sentence
 * is ready, so the perceived latency is the same. If we ever want sub-sentence
 * streaming, /stream-input is the upgrade.
 */
export function attachTtsSocket(client: ClientSocket) {
  const send = (msg: TtsServerMessage) => {
    if (client.readyState === client.OPEN) client.send(JSON.stringify(msg));
  };

  const queue: string[] = [];
  let draining = false;
  let inFlight: AbortController | null = null;
  let unavailable = false;

  const drain = async () => {
    if (draining) return;
    draining = true;
    try {
      while (queue.length && !unavailable) {
        const text = queue.shift()!;
        const controller = new AbortController();
        inFlight = controller;
        try {
          const audio = await synthesize(text, controller.signal);
          if (controller.signal.aborted) return;
          send({ kind: "tts_audio", audioBase64: audio, mime: "audio/mpeg" });
        } catch (error) {
          if (controller.signal.aborted) return;
          if (error instanceof TtsUnavailable) {
            // Plan or key problem — retrying every sentence would just stack up
            // failures. Tell the client once and let it speak locally instead.
            unavailable = true;
            queue.length = 0;
            send({ kind: "tts_unavailable", reason: error.message });
          } else {
            send({ kind: "tts_error", message: error instanceof Error ? error.message : String(error) });
          }
        } finally {
          inFlight = null;
        }
      }
      if (!unavailable) send({ kind: "tts_done" });
    } finally {
      draining = false;
    }
  };

  client.on("message", (raw) => {
    let msg: TtsClientMessage;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (msg.kind === "tts_say") {
      if (!ELEVENLABS_API_KEY) {
        send({ kind: "tts_error", message: "ELEVENLABS_API_KEY tidak diset." });
        return;
      }
      const text = msg.text.trim();
      if (!text) return;
      queue.push(text);
      void drain();
    } else if (msg.kind === "tts_stop") {
      queue.length = 0;
      inFlight?.abort();
    }
  });

  const shutdown = () => {
    queue.length = 0;
    inFlight?.abort();
  };
  client.on("close", shutdown);
  client.on("error", shutdown);
}

/** Raised for failures that will repeat on every request: bad key, wrong plan, unusable voice. */
class TtsUnavailable extends Error {}

async function synthesize(text: string, signal: AbortSignal): Promise<string> {
  const url = new URL(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}/stream`);
  url.searchParams.set("output_format", OUTPUT_FORMAT);

  const response = await fetch(url, {
    method: "POST",
    signal,
    headers: {
      "xi-api-key": ELEVENLABS_API_KEY,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      text,
      model_id: ELEVENLABS_TTS_MODEL,
      language_code: LANGUAGE,
      voice_settings: { stability: 0.4, similarity_boost: 0.75, speed: 1.05 },
    }),
  });

  if (!response.ok) {
    const raw = await response.text().catch(() => "");
    let message = raw.slice(0, 200);
    try {
      const parsed = JSON.parse(raw) as { detail?: { message?: string } | string };
      const detail = parsed.detail;
      message = typeof detail === "string" ? detail : (detail?.message ?? message);
    } catch {
      /* not JSON — keep the raw prefix */
    }
    // 401 key, 402 plan, 403 permission, 404 unknown voice: none of these get
    // better by trying the next sentence.
    if ([401, 402, 403, 404].includes(response.status)) throw new TtsUnavailable(message);
    throw new Error(`ElevenLabs TTS ${response.status}: ${message}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  return buffer.toString("base64");
}
