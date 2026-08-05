import { useEffect, useRef } from "react";
import type { ToolEntry } from "../lib/useAgent.js";

const dot: Record<ToolEntry["status"], string> = {
  running: "bg-accent animate-blink",
  ok: "bg-accent-dim",
  error: "bg-critical",
};

/**
 * Telemetry rail. Watching real tool calls scroll past — `Bash: git status`,
 * `system.metrics: sampling 5s` — is what separates "the agent is working" from
 * "the app has frozen". A spinner says neither.
 */
export function SystemRail({ tools }: { tools: ToolEntry[] }) {
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [tools]);

  const running = tools.filter((tool) => tool.status === "running").length;

  return (
    <div className="flex h-full flex-col">
      <div className="label flex items-center gap-2 px-4 py-3">
        <span className="h-px flex-1 bg-line" />
        <span>telemetri</span>
        <span className="h-px flex-1 bg-line" />
      </div>

      <div className="flex-1 space-y-2.5 overflow-y-auto px-4 pb-4">
        {tools.length === 0 && <p className="pt-6 text-center text-[11px] text-ink-4">Menunggu perintah.</p>}

        {tools.slice(-60).map((tool) => (
          <div key={tool.id} className="animate-rise flex gap-2">
            <span aria-hidden className={`mt-[5px] size-1 shrink-0 rounded-full ${dot[tool.status]}`} />
            <div className="min-w-0 flex-1">
              <div className="font-mono text-[10.5px] text-ink-2">{tool.name}</div>
              {tool.summary && (
                <div className="truncate font-mono text-[10px] text-ink-4" title={tool.summary}>
                  {tool.summary}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={bottom} />
      </div>

      <div className="label border-t border-line-soft px-4 py-2.5">
        {tools.length} panggilan{running > 0 ? ` · ${running} aktif` : ""}
      </div>
    </div>
  );
}
