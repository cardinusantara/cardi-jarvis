import { useCallback, useEffect, useRef, useState } from "react";
import { connect, type ReconnectingSocket } from "../lib/socket.js";
import { startMic, type MicHandle } from "./mic.js";
import { AudioQueue } from "./player.js";
import {
  browserSpeak,
  browserSttSupported,
  browserStopSpeaking,
  startBrowserRecognition,
  type BrowserRecognition,
} from "./browser-voice.js";
import type {
  AppConfig,
  SttClientMessage,
  SttServerMessage,
  TtsClientMessage,
  TtsServerMessage,
  VoiceProvider,
} from "@shared/protocol.js";

export interface VoiceState {
  listening: boolean;
  speaking: boolean;
  /** Live interim transcript, shown while the user is still talking. */
  partial: string;
  error: string | null;
  supported: boolean;
  /** May differ from config: ElevenLabs can refuse at runtime and we degrade. */
  ttsProvider: VoiceProvider;
}

/**
 * One voice interface, two providers, chosen independently for listening and
 * speaking — an ElevenLabs free plan does realtime STT happily but returns 402
 * for TTS, and that combination should just work rather than fail loudly.
 */
export function useVoice(
  config: AppConfig | null,
  onUtterance: (text: string) => void,
  onBargeIn: () => void,
) {
  const [state, setState] = useState<VoiceState>({
    listening: false,
    speaking: false,
    partial: "",
    error: null,
    supported: true,
    ttsProvider: "browser",
  });

  const sttSocket = useRef<ReconnectingSocket<SttClientMessage> | null>(null);
  const ttsSocket = useRef<ReconnectingSocket<TtsClientMessage> | null>(null);
  const mic = useRef<MicHandle | null>(null);
  const recognition = useRef<BrowserRecognition | null>(null);
  const queue = useRef<AudioQueue | null>(null);
  const listening = useRef(false);
  const speakingRef = useRef(false);
  const ttsProvider = useRef<VoiceProvider>("browser");
  /**
   * Half-duplex gate.
   *
   * The mic hears the speakers. `getUserMedia`'s echo cancellation covers the
   * WebRTC path, but not `speechSynthesis` — so with the mic open, Cardi
   * transcribes its own voice, barges in on itself, and posts its own sentences
   * back as user commands. After a long spoken report the session is
   * unrecoverable, which is exactly the "can't instruct it any more" symptom.
   *
   * So while Cardi speaks, the uplink is muted. Barge-in moves to the mic button
   * and Esc. Full duplex needs real acoustic echo cancellation over the same
   * audio graph, which browser TTS can't give us.
   */
  const muted = useRef(false);
  const unmuteTimer = useRef<number | undefined>(undefined);

  const onUtteranceRef = useRef(onUtterance);
  onUtteranceRef.current = onUtterance;
  const onBargeInRef = useRef(onBargeIn);
  onBargeInRef.current = onBargeIn;

  const setSpeaking = useCallback((speaking: boolean) => {
    speakingRef.current = speaking;
    window.clearTimeout(unmuteTimer.current);
    if (speaking) {
      muted.current = true;
    } else {
      // Short tail: the speaker is still decaying, and the transcriber would
      // happily commit that decay as a phrase.
      unmuteTimer.current = window.setTimeout(() => (muted.current = false), 400);
    }
    setState((s) => (s.speaking === speaking ? s : { ...s, speaking }));
  }, []);

  /**
   * Barge-in: kill the audio first, then tell the agent. Doing it in that order
   * is what makes interrupting feel like cutting a person off rather than
   * pausing a recording.
   *
   * Triggered by the mic button or Esc, not by the transcriber — see `muted`
   * above for why the mic can't be trusted to detect an interruption while the
   * speakers are running.
   */
  const bargeIn = useCallback(() => {
    if (!speakingRef.current) return;
    queue.current?.stop();
    browserStopSpeaking();
    ttsSocket.current?.send({ kind: "tts_stop" });
    setSpeaking(false);
    onBargeInRef.current();
  }, [setSpeaking]);

  useEffect(() => {
    if (!config) return;

    queue.current = new AudioQueue(setSpeaking);
    ttsProvider.current = config.tts;
    setState((s) => ({
      ...s,
      ttsProvider: config.tts,
      supported: config.stt === "elevenlabs" ? true : browserSttSupported(),
    }));

    const sockets: Array<ReconnectingSocket<never>> = [];

    if (config.stt === "elevenlabs") {
      const stt = connect<SttServerMessage, SttClientMessage>("/voice/stt", {
        onMessage: (msg) => {
          // Belt and braces: audio in flight when the gate closed can still
          // come back as a transcript a moment later.
          if ((msg.kind === "stt_partial" || msg.kind === "stt_final") && muted.current) return;

          if (msg.kind === "stt_partial") {
            setState((s) => ({ ...s, partial: msg.text }));
          } else if (msg.kind === "stt_final") {
            setState((s) => ({ ...s, partial: "" }));
            onUtteranceRef.current(msg.text);
          } else if (msg.kind === "stt_error") {
            setState((s) => ({ ...s, error: msg.message }));
          }
        },
      });
      sttSocket.current = stt;
      sockets.push(stt as unknown as ReconnectingSocket<never>);
    }

    if (config.tts === "elevenlabs") {
      const tts = connect<TtsServerMessage, TtsClientMessage>("/voice/tts", {
        onMessage: (msg) => {
          if (msg.kind === "tts_audio") {
            void queue.current?.push(msg.audioBase64);
          } else if (msg.kind === "tts_unavailable") {
            // Plan or key problem. Switch to browser speech for good — retrying
            // per sentence would just produce a stream of identical failures.
            ttsProvider.current = "browser";
            setState((s) => ({ ...s, ttsProvider: "browser", error: `TTS ElevenLabs: ${msg.reason}` }));
          } else if (msg.kind === "tts_error") {
            setState((s) => ({ ...s, error: msg.message }));
          }
        },
      });
      ttsSocket.current = tts;
      sockets.push(tts as unknown as ReconnectingSocket<never>);
    }

    return () => {
      for (const socket of sockets) socket.close();
      sttSocket.current = null;
      ttsSocket.current = null;
      queue.current?.stop();
      browserStopSpeaking();
    };
  }, [config, setSpeaking]);

  const startListening = useCallback(async () => {
    if (!config || listening.current) return;
    listening.current = true;
    setState((s) => ({ ...s, listening: true, error: null }));

    if (config.stt === "browser") {
      recognition.current = startBrowserRecognition(config.language, {
        onPartial: (text) => {
          if (muted.current) return;
          setState((s) => ({ ...s, partial: text }));
        },
        onFinal: (text) => {
          if (muted.current) return;
          setState((s) => ({ ...s, partial: "" }));
          onUtteranceRef.current(text);
        },
        onError: (message) => setState((s) => ({ ...s, error: message })),
      });
      if (!recognition.current) {
        listening.current = false;
        setState((s) => ({ ...s, listening: false, supported: false }));
      }
      return;
    }

    try {
      const handle = await startMic(
        (pcm) => {
          // Muted while Cardi speaks — the transcriber must never hear the speakers.
          if (muted.current) return;
          sttSocket.current?.sendBinary(pcm);
        },
        () => {
          /* the orb reads amplitude straight off the audio bus */
        },
      );
      mic.current = handle;
      sttSocket.current?.send({
        kind: "stt_start",
        sampleRate: handle.sampleRate,
        language: config.language,
      });
    } catch (error) {
      listening.current = false;
      setState((s) => ({
        ...s,
        listening: false,
        error: error instanceof Error ? error.message : "Mikrofon tidak bisa diakses.",
      }));
    }
  }, [config]);

  const stopListening = useCallback(async () => {
    listening.current = false;
    setState((s) => ({ ...s, listening: false, partial: "" }));
    recognition.current?.stop();
    recognition.current = null;
    sttSocket.current?.send({ kind: "stt_stop" });
    await mic.current?.stop();
    mic.current = null;
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!config) return;
      if (ttsProvider.current === "elevenlabs") ttsSocket.current?.send({ kind: "tts_say", text });
      else browserSpeak(text, config.language, setSpeaking);
    },
    [config, setSpeaking],
  );

  const stopSpeaking = useCallback(() => {
    queue.current?.stop();
    browserStopSpeaking();
    ttsSocket.current?.send({ kind: "tts_stop" });
    setSpeaking(false);
  }, [setSpeaking]);

  return { ...state, startListening, stopListening, speak, stopSpeaking, bargeIn };
}
