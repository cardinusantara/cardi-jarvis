import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AppConfig } from "@shared/protocol.js";
import { useAgent } from "./lib/useAgent.js";
import { useVoice } from "./voice/useVoice.js";
import { HudFrame } from "./hud/HudFrame.js";
import { Stage } from "./hud/Stage.js";
import { ConversationRail } from "./hud/ConversationRail.js";
import { SystemRail } from "./hud/SystemRail.js";
import { CommandBar } from "./hud/CommandBar.js";
import type { OrbState } from "./hud/Orb.js";

export default function App() {
  const [config, setConfig] = useState<AppConfig | null>(null);

  useEffect(() => {
    fetch("/api/config")
      .then((response) => response.json())
      .then(setConfig)
      .catch(() => setConfig(null));
  }, []);

  // The agent hook and the voice hook know nothing about each other; App is the
  // only place they meet. Voice hands over finished utterances, the agent hands
  // back finished sentences, and neither has to import the other.
  //
  // Routing through refs rather than state is deliberate: a single state slot
  // silently drops events when two arrive in the same tick, which happens
  // constantly now that Cardi narrates while it works — several sentences can
  // land between one render and the next, and only the last would be spoken.
  const speakRef = useRef<(text: string) => void>(() => {});
  const sendRef = useRef<(text: string) => void>(() => {});

  const agent = useAgent(useCallback((text: string) => speakRef.current(text), []));
  const voice = useVoice(
    config,
    useCallback((text: string) => sendRef.current(text), []),
    agent.interrupt,
  );

  speakRef.current = voice.speak;
  sendRef.current = agent.send;

  const offline = agent.phase === "offline";
  const working = agent.phase === "working";

  const orbState: OrbState = useMemo(() => {
    if (offline) return "offline";
    if (voice.speaking) return "speaking";
    if (voice.listening) return "listening";
    if (working) return "thinking";
    return "idle";
  }, [offline, voice.speaking, voice.listening, working]);

  const hint = offline
    ? "koneksi terputus"
    : voice.listening
      ? "mendengarkan…"
      : voice.speaking
        ? "menjawab"
        : working
          ? "memproses"
          : "siap";

  const toggleMic = () => {
    // While Cardi is talking the mic button means "stop and listen to me" — the
    // transcriber can't detect an interruption itself, because the mic is muted
    // during playback to keep Cardi from hearing its own voice.
    if (voice.speaking) {
      voice.bargeIn();
      if (!voice.listening) void voice.startListening();
      return;
    }
    if (voice.listening) void voice.stopListening();
    else void voice.startListening();
  };

  const stop = () => {
    voice.stopSpeaking();
    agent.interrupt();
  };

  return (
    <HudFrame>
      <header className="flex shrink-0 items-center gap-3 px-5 py-3">
        <span className="text-[15px] font-semibold tracking-[0.22em] text-accent uppercase">cardi</span>
        <span className="h-px flex-1 bg-line" />
        <div className="flex items-center gap-2">
          {voice.error && <Chip tone="bad">{voice.error}</Chip>}
          {agent.lastError && <Chip tone="bad">{agent.lastError}</Chip>}
          {config && (
            <Chip title={config.voiceNote ?? undefined}>
              dengar {config.stt === "elevenlabs" ? "11L" : "browser"} · bicara{" "}
              {voice.ttsProvider === "elevenlabs" ? "11L" : "browser"}
            </Chip>
          )}
          <Chip>{config?.model ?? "…"}</Chip>
          <Chip tone={offline ? "bad" : "ok"}>
            <span
              aria-hidden
              className={`mr-1.5 inline-block size-1.5 rounded-full align-middle ${
                offline ? "bg-critical" : working ? "animate-blink bg-amber" : "bg-accent"
              }`}
            />
            {hint}
          </Chip>
        </div>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-[16rem_minmax(0,1fr)] gap-0 xl:grid-cols-[17rem_minmax(0,1fr)_16rem]">
        <aside className="min-h-0 border-r border-line-soft">
          <ConversationRail entries={agent.transcript} partial={voice.partial} />
        </aside>

        <section className="min-h-0">
          <Stage cards={agent.cards} orbState={orbState} hint={hint} />
        </section>

        <aside className="hidden min-h-0 border-l border-line-soft xl:block">
          <SystemRail tools={agent.tools} />
        </aside>
      </main>

      <footer className="shrink-0 px-5 pt-2 pb-4">
        <div className="mx-auto max-w-3xl">
          <CommandBar
            onSend={agent.send}
            onStop={stop}
            onToggleMic={toggleMic}
            listening={voice.listening}
            busy={working || voice.speaking}
            disabled={offline}
            micDisabled={offline || !voice.supported}
          />
        </div>
      </footer>
    </HudFrame>
  );
}

function Chip({
  children,
  tone = "muted",
  title,
}: {
  children: React.ReactNode;
  tone?: "muted" | "ok" | "bad";
  title?: string;
}) {
  const border =
    tone === "bad" ? "border-critical/50 text-critical" : tone === "ok" ? "border-line text-ink-2" : "border-line text-ink-3";
  return (
    <span
      title={title}
      className={`max-w-72 truncate rounded-full border px-2.5 py-1 font-mono text-[10px] tracking-wide ${border}`}
    >
      {children}
    </span>
  );
}
