import { useEffect, useRef } from "react";
import type { TranscriptEntry } from "../lib/useAgent.js";

/**
 * The conversation log. Deliberately quiet: this is a voice interface, so the
 * text is a record of what was said, not the main event. The orb is.
 */
export function ConversationRail({
  entries,
  partial,
}: {
  entries: TranscriptEntry[];
  partial: string;
}) {
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [entries, partial]);

  return (
    <div className="flex h-full flex-col">
      <div className="label flex items-center gap-2 px-4 py-3">
        <span className="h-px flex-1 bg-line" />
        <span>dialog</span>
        <span className="h-px flex-1 bg-line" />
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-4 pb-4">
        {entries.length === 0 && !partial && (
          <p className="pt-6 text-center text-[11px] leading-relaxed text-ink-4">
            Tekan mikrofon lalu bicara,
            <br />
            atau ketik perintah di bawah.
          </p>
        )}

        {entries.map((entry) => (
          <article key={entry.id} className="animate-rise">
            <div className="label mb-1 flex items-center gap-1.5">
              <span
                aria-hidden
                className={`inline-block size-1 rounded-full ${entry.role === "user" ? "bg-ink-3" : "bg-accent"}`}
              />
              {entry.role === "user" ? "kamu" : "cardi"}
            </div>
            <p
              className={`text-[12.5px] leading-relaxed whitespace-pre-wrap ${
                entry.role === "user" ? "text-ink-2" : "text-ink"
              }`}
            >
              {entry.text}
              {entry.streaming && (
                <span
                  aria-hidden
                  className="animate-blink ml-0.5 inline-block h-3 w-1.5 translate-y-px bg-accent"
                />
              )}
            </p>
          </article>
        ))}

        {/* Interim speech: italic and dimmed, so it never looks committed. */}
        {partial && (
          <article className="opacity-55">
            <div className="label mb-1 flex items-center gap-1.5">
              <span aria-hidden className="animate-blink inline-block size-1 rounded-full bg-live" />
              mendengar
            </div>
            <p className="text-[12.5px] leading-relaxed text-ink-2 italic">{partial}</p>
          </article>
        )}

        <div ref={bottom} />
      </div>
    </div>
  );
}
