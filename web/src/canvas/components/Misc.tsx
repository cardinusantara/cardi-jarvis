import { useMemo } from "react";
import { marked } from "marked";
import type { ComponentSpec } from "@shared/protocol.js";
import { Card } from "../ChartChrome.js";
import { STATUS } from "../viz.js";

type TimelineSpec = Extract<ComponentSpec, { type: "timeline" }>;
type MarkdownSpec = Extract<ComponentSpec, { type: "markdown" }>;
type CodeSpec = Extract<ComponentSpec, { type: "code_block" }>;
type ImageSpec = Extract<ComponentSpec, { type: "image" }>;
type HtmlCard = { html: string; height?: number; title?: string };

export function Timeline({ spec }: { spec: TimelineSpec }) {
  return (
    <Card title={spec.title}>
      <ol className="relative flex flex-col gap-4 pl-4">
        <span aria-hidden className="absolute top-1.5 bottom-1.5 left-[3px] w-px bg-line" />
        {spec.items.map((item, index) => (
          <li key={index} className="relative">
            <span
              aria-hidden
              className="absolute top-1 -left-4 size-[7px] rounded-full ring-2 ring-panel"
              style={{ background: STATUS[item.status] }}
            />
            <div className="flex items-baseline gap-2">
              <span className="text-[12px] font-medium text-ink">{item.title}</span>
              {item.time && <span className="font-mono text-[11px] text-ink-4">{item.time}</span>}
            </div>
            {item.detail && <p className="mt-0.5 text-[11px] leading-relaxed text-ink-3">{item.detail}</p>}
          </li>
        ))}
      </ol>
    </Card>
  );
}

export function Markdown({ spec }: { spec: MarkdownSpec }) {
  const html = useMemo(() => marked.parse(spec.content, { async: false }), [spec.content]);
  return (
    <Card title={spec.title}>
      <div
        className="prose-invert max-w-none text-[13px] leading-relaxed text-ink-2 [&_a]:text-s1 [&_code]:rounded [&_code]:bg-raised [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[12px] [&_h1]:mt-0 [&_h1]:mb-2 [&_h1]:text-[15px] [&_h1]:font-semibold [&_h1]:text-ink [&_h2]:mt-3 [&_h2]:mb-1.5 [&_h2]:text-[14px] [&_h2]:font-semibold [&_h2]:text-ink [&_h3]:mt-3 [&_h3]:mb-1 [&_h3]:text-[13px] [&_h3]:font-semibold [&_h3]:text-ink [&_li]:my-0.5 [&_p]:my-2 [&_strong]:text-ink [&_table]:w-full [&_table]:text-[12px] [&_td]:border-b [&_td]:border-line-soft [&_td]:py-1 [&_th]:border-b [&_th]:border-line [&_th]:py-1 [&_th]:text-left [&_th]:text-ink-3 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </Card>
  );
}

export function CodeBlock({ spec }: { spec: CodeSpec }) {
  return (
    <Card title={spec.title} subtitle={spec.language}>
      <pre className="max-h-96 overflow-auto rounded-lg bg-sunken p-3 font-mono text-[12px] leading-relaxed text-ink-2">
        <code>{spec.code}</code>
      </pre>
    </Card>
  );
}

export function ImageCard({ spec }: { spec: ImageSpec }) {
  return (
    <Card title={spec.title}>
      <img src={spec.url} alt={spec.alt ?? spec.title ?? ""} className="max-h-96 w-full rounded-lg object-contain" />
    </Card>
  );
}

/**
 * Escape hatch for anything the registry can't express.
 *
 * `sandbox="allow-scripts"` without `allow-same-origin` puts the frame in an
 * opaque origin: scripts run, but they cannot reach our DOM, storage, or
 * cookies. Claude gets a real canvas without getting our page.
 */
export function HtmlFrame({ card }: { card: HtmlCard }) {
  const doc = useMemo(
    () => `<!doctype html><html><head><meta charset="utf-8"><style>
      :root { color-scheme: dark; }
      html,body { margin:0; padding:0; background:transparent;
        color:#e8f6fa; font-family:"Segoe UI Variable Display","Segoe UI",system-ui,sans-serif; font-size:13px; }
      a { color:#2ee6ff; }
      code,pre { font-family:ui-monospace,"Cascadia Mono",Consolas,monospace; }
      button,input,select { font: inherit; color: inherit; }
    </style></head><body>${card.html}</body></html>`,
    [card.html],
  );

  return (
    <Card title={card.title}>
      <iframe
        title={card.title ?? "Konten khusus"}
        srcDoc={doc}
        sandbox="allow-scripts"
        referrerPolicy="no-referrer"
        className="w-full rounded-lg border-0 bg-sunken"
        style={{ height: card.height ?? 360 }}
      />
    </Card>
  );
}
