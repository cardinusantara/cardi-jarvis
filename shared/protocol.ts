import type { ComponentSpec } from "./spec.js";

export type { ComponentSpec };

/** A card on the canvas: either a registry component or a sandboxed HTML frame. */
export type CanvasCard =
  | { id: string; kind: "component"; spec: ComponentSpec }
  | { id: string; kind: "html"; html: string; height?: number; title?: string };

export type ToolStatus = "running" | "ok" | "error";

/* ── /agent ───────────────────────────────────────────────────────────── */

export type AgentClientMessage =
  | { kind: "user_text"; text: string }
  | { kind: "interrupt" };

export type AgentServerMessage =
  /** Session is up and accepting input. */
  | { kind: "ready"; sessionId: string | null; model: string | null; cwd: string }
  /** Claude started a new assistant turn. */
  | { kind: "turn_start" }
  /** Incremental assistant prose. Concatenate in order. */
  | { kind: "assistant_delta"; text: string }
  /** A complete sentence, ready to be spoken. Emitted alongside the deltas. */
  | { kind: "speak"; text: string }
  /** Claude finished producing prose for this turn. */
  | { kind: "turn_end" }
  | { kind: "tool_start"; id: string; name: string; summary: string }
  | { kind: "tool_end"; id: string; status: Exclude<ToolStatus, "running">; preview?: string }
  | { kind: "render"; card: CanvasCard }
  | { kind: "canvas_clear" }
  | { kind: "result"; ok: boolean; costUsd?: number; durationMs?: number }
  | { kind: "error"; message: string };

/* ── /voice/stt ───────────────────────────────────────────────────────── */

/** Control frames; raw PCM16 audio is sent as binary frames on the same socket. */
export type SttClientMessage =
  | { kind: "stt_start"; sampleRate: number; language: string }
  | { kind: "stt_stop" };

export type SttServerMessage =
  | { kind: "stt_open" }
  /** Interim text — may change. Show it live, don't act on it. */
  | { kind: "stt_partial"; text: string }
  /** Committed by VAD. This is what gets sent to the agent. */
  | { kind: "stt_final"; text: string }
  | { kind: "stt_error"; message: string };

/* ── /voice/tts ───────────────────────────────────────────────────────── */

export type TtsClientMessage =
  | { kind: "tts_say"; text: string }
  /** Barge-in: drop everything queued and stop the current utterance. */
  | { kind: "tts_stop" };

export type TtsServerMessage =
  | { kind: "tts_audio"; audioBase64: string; mime: string }
  | { kind: "tts_done" }
  /** Permanent: the account can't synthesise. Switch to browser speech and stop asking. */
  | { kind: "tts_unavailable"; reason: string }
  | { kind: "tts_error"; message: string };

/* ── /api/config ──────────────────────────────────────────────────────── */

export type VoiceProvider = "elevenlabs" | "browser";

export interface AppConfig {
  /**
   * Chosen independently: an ElevenLabs free plan can do realtime STT but is
   * refused TTS on library voices, so the useful combination is elevenlabs
   * listening + browser speaking.
   */
  stt: VoiceProvider;
  tts: VoiceProvider;
  /** Why a fallback is in use, when one is. Shown in the UI. */
  voiceNote: string | null;
  language: string;
  model: string;
  cwd: string;
}
