import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { connect, type ReconnectingSocket } from "./socket.js";
import type {
  AgentClientMessage,
  AgentServerMessage,
  CanvasCard,
} from "@shared/protocol.js";

export interface TranscriptEntry {
  id: string;
  role: "user" | "assistant";
  text: string;
  /** True while deltas are still arriving, so the UI can show a caret. */
  streaming: boolean;
}

export interface ToolEntry {
  id: string;
  name: string;
  summary: string;
  status: "running" | "ok" | "error";
  preview?: string;
}

export type AgentPhase = "offline" | "idle" | "working";

export interface AgentState {
  phase: AgentPhase;
  transcript: TranscriptEntry[];
  tools: ToolEntry[];
  cards: CanvasCard[];
  sessionId: string | null;
  lastError: string | null;
}

let counter = 0;
const nextId = () => `e${++counter}`;

export function useAgent(onSpeak: (text: string) => void) {
  const [state, setState] = useState<AgentState>({
    phase: "offline",
    transcript: [],
    tools: [],
    cards: [],
    sessionId: null,
    lastError: null,
  });

  const socketRef = useRef<ReconnectingSocket<AgentClientMessage> | null>(null);
  // Kept in a ref so the socket effect never needs to re-subscribe when the
  // voice layer's identity changes.
  const speak = useRef(onSpeak);
  speak.current = onSpeak;

  useEffect(() => {
    const socket = connect<AgentServerMessage, AgentClientMessage>("/agent", {
      onOpen: () => setState((s) => ({ ...s, phase: "idle", lastError: null })),
      onClose: () => setState((s) => ({ ...s, phase: "offline" })),
      onMessage: (msg) => {
        setState((prev) => reduce(prev, msg));
        if (msg.kind === "speak") speak.current(msg.text);
      },
    });
    socketRef.current = socket;
    return () => socket.close();
  }, []);

  const send = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setState((prev) => ({
      ...prev,
      phase: "working",
      transcript: [...prev.transcript, { id: nextId(), role: "user", text: trimmed, streaming: false }],
    }));
    socketRef.current?.send({ kind: "user_text", text: trimmed });
  }, []);

  const interrupt = useCallback(() => {
    socketRef.current?.send({ kind: "interrupt" });
    setState((prev) => ({ ...prev, phase: "idle" }));
  }, []);

  return useMemo(() => ({ ...state, send, interrupt }), [state, send, interrupt]);
}

function reduce(state: AgentState, msg: AgentServerMessage): AgentState {
  switch (msg.kind) {
    case "ready":
      return { ...state, phase: "idle", sessionId: msg.sessionId ?? state.sessionId };

    case "turn_start":
      return {
        ...state,
        phase: "working",
        transcript: [...state.transcript, { id: nextId(), role: "assistant", text: "", streaming: true }],
      };

    case "assistant_delta": {
      const transcript = [...state.transcript];
      const last = transcript.at(-1);
      if (last?.role === "assistant" && last.streaming) {
        transcript[transcript.length - 1] = { ...last, text: last.text + msg.text };
      } else {
        transcript.push({ id: nextId(), role: "assistant", text: msg.text, streaming: true });
      }
      return { ...state, phase: "working", transcript };
    }

    case "turn_end": {
      const transcript = state.transcript.map((entry) =>
        entry.streaming ? { ...entry, streaming: false } : entry,
      );
      return { ...state, transcript };
    }

    case "tool_start":
      return {
        ...state,
        phase: "working",
        tools: [...state.tools, { id: msg.id, name: msg.name, summary: msg.summary, status: "running" }],
      };

    case "tool_end":
      return {
        ...state,
        tools: state.tools.map((tool) =>
          tool.id === msg.id ? { ...tool, status: msg.status, preview: msg.preview } : tool,
        ),
      };

    case "render": {
      const cards = [...state.cards];
      const index = cards.findIndex((card) => card.id === msg.card.id);
      // Same id means "update in place" — that's what keeps a monitoring chart
      // from stacking a new copy of itself every second.
      if (index >= 0) cards[index] = msg.card;
      else cards.push(msg.card);
      return { ...state, cards };
    }

    case "canvas_clear":
      return { ...state, cards: [] };

    case "result":
      return {
        ...state,
        phase: "idle",
        transcript: state.transcript.map((e) => (e.streaming ? { ...e, streaming: false } : e)),
      };

    case "error":
      return { ...state, phase: "idle", lastError: msg.message };

    default:
      return state;
  }
}
