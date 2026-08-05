/**
 * Checks what an ElevenLabs key can actually do for this app:
 * realtime STT over WebSocket, and TTS on a given voice.
 * Run: npx tsx scripts/probe-elevenlabs.ts
 */
import WebSocket from "ws";
import "dotenv/config";

const KEY = process.env.ELEVENLABS_API_KEY ?? process.argv[2] ?? "";
const VOICE = process.env.ELEVENLABS_VOICE_ID ?? process.argv[3] ?? "21m00Tcm4TlvDq8ikWAM";

if (!KEY) {
  console.error("Butuh ELEVENLABS_API_KEY di .env atau sebagai argumen pertama.");
  process.exit(1);
}

function tone(seconds = 1, rate = 16000): Buffer {
  const n = seconds * rate;
  const pcm = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) pcm.writeInt16LE(Math.round(6000 * Math.sin((2 * Math.PI * 300 * i) / rate)), i * 2);
  return pcm;
}

async function probeRealtimeStt(): Promise<void> {
  const url = new URL("wss://api.elevenlabs.io/v1/speech-to-text/realtime");
  url.searchParams.set("model_id", "scribe_v2_realtime");
  url.searchParams.set("audio_format", "pcm_16000");
  url.searchParams.set("language_code", "id");
  url.searchParams.set("commit_strategy", "vad");

  await new Promise<void>((resolve) => {
    const ws = new WebSocket(url, { headers: { "xi-api-key": KEY } });
    const done = (verdict: string) => {
      console.log(`  realtime STT : ${verdict}`);
      try {
        ws.close();
      } catch {
        /* noop */
      }
      resolve();
    };

    const timer = setTimeout(() => done("⚠ tidak ada balasan dalam 15s"), 15_000);

    ws.on("open", () => {
      const pcm = tone();
      for (let offset = 0; offset < pcm.length; offset += 3200) {
        ws.send(
          JSON.stringify({
            message_type: "input_audio_chunk",
            audio_base_64: pcm.subarray(offset, offset + 3200).toString("base64"),
          }),
        );
      }
    });

    ws.on("message", (raw) => {
      const payload = JSON.parse(raw.toString()) as Record<string, unknown>;
      const type = String(payload.message_type ?? payload.type ?? "");
      if (type === "session_started") {
        clearTimeout(timer);
        done("✅ terhubung, sesi dimulai");
      } else if (type.includes("error")) {
        clearTimeout(timer);
        done(`❌ ${JSON.stringify(payload).slice(0, 200)}`);
      }
    });

    ws.on("unexpected-response", (_req, res) => {
      clearTimeout(timer);
      done(`❌ HTTP ${res.statusCode} ${res.statusMessage}`);
    });
    ws.on("error", (err) => {
      clearTimeout(timer);
      done(`❌ ${err.message}`);
    });
  });
}

async function probeTts(voiceId: string): Promise<boolean> {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?output_format=mp3_22050_32`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "xi-api-key": KEY, "content-type": "application/json" },
    body: JSON.stringify({ text: "Halo.", model_id: "eleven_flash_v2_5", language_code: "id" }),
  });
  if (response.ok) {
    const bytes = (await response.arrayBuffer()).byteLength;
    console.log(`  TTS ${voiceId} : ✅ ${bytes} byte audio`);
    return true;
  }
  const detail = (await response.json().catch(() => ({}))) as { detail?: { message?: string } };
  console.log(`  TTS ${voiceId} : ❌ ${response.status} — ${detail.detail?.message ?? "tidak diketahui"}`);
  return false;
}

console.log(`\nProbe ElevenLabs (key …${KEY.slice(-6)})\n`);
await probeRealtimeStt();
await probeTts(VOICE);
console.log();
