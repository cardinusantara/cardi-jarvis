import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { AppConfig, VoiceProvider } from "@shared/protocol.js";

/** Repo root, regardless of where the process was launched from. */
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

// The dev launcher runs the server with cwd=server/, so bare `dotenv/config`
// would look in the wrong directory and silently find nothing. Point at both:
// repo root first, then a server-local override if one exists.
loadEnv({ path: resolve(REPO_ROOT, ".env"), quiet: true });
loadEnv({ path: resolve(REPO_ROOT, "server/.env"), override: true, quiet: true });

const env = (key: string, fallback = "") => (process.env[key] ?? "").trim() || fallback;

export const PORT = Number(env("PORT", "8787"));
export const WEB_ORIGIN = env("WEB_ORIGIN", "http://localhost:5173");

export const ELEVENLABS_API_KEY = env("ELEVENLABS_API_KEY");
/** Default is "Rachel" — a stock ElevenLabs voice available on every account. */
export const ELEVENLABS_VOICE_ID = env("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM");
export const ELEVENLABS_STT_MODEL = env("ELEVENLABS_STT_MODEL", "scribe_v2_realtime");
export const ELEVENLABS_TTS_MODEL = env("ELEVENLABS_TTS_MODEL", "eleven_flash_v2_5");

export const LANGUAGE = env("LANGUAGE", "id");
export const MODEL = env("MODEL", "claude-sonnet-5");

/**
 * Where Claude is allowed to work. Defaults to this repo rather than the drive
 * root — the agent runs with permissions bypassed, so the blast radius is
 * whatever this points at.
 */
export const AGENT_CWD = env("AGENT_CWD", REPO_ROOT);

/**
 * `auto` means "try ElevenLabs, fall back to the browser the moment it refuses".
 * That is the useful default: a free plan does realtime STT fine but returns
 * 402 for TTS on library voices, and we'd rather degrade silently than break.
 */
const TTS_MODE = env("ELEVENLABS_TTS", "auto").toLowerCase();

export const sttProvider: VoiceProvider = ELEVENLABS_API_KEY ? "elevenlabs" : "browser";
export const ttsProvider: VoiceProvider =
  ELEVENLABS_API_KEY && TTS_MODE !== "off" ? "elevenlabs" : "browser";

const note = (): string | null => {
  if (!ELEVENLABS_API_KEY) return "ELEVENLABS_API_KEY belum diisi — suara memakai Web Speech API browser.";
  if (ttsProvider === "browser") return "TTS ElevenLabs dimatikan — suara balasan memakai browser.";
  return null;
};

export const appConfig: AppConfig = {
  stt: sttProvider,
  tts: ttsProvider,
  voiceNote: note(),
  language: LANGUAGE,
  model: MODEL,
  cwd: AGENT_CWD,
};
