import type { ReactNode } from "react";
import { INK_3, seriesColor, SURFACE } from "./viz.js";

/**
 * Tooltip. Values lead and labels follow — the reader already knows which
 * series they're pointing at and wants the number. Series identity rides a
 * short line key, never coloured text.
 */
export function VizTooltip({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number | string; color?: string; dataKey?: string }>;
  label?: string | number;
  unit?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-36 rounded-lg border border-line bg-raised/95 px-3 py-2 shadow-xl backdrop-blur-sm">
      {label !== undefined && (
        <div className="mb-1.5 font-mono text-[11px] tracking-wide text-ink-3">{String(label)}</div>
      )}
      <div className="flex flex-col gap-1">
        {payload.map((row, index) => (
          <div key={`${row.dataKey ?? index}`} className="flex items-baseline gap-2">
            <span
              aria-hidden
              className="mt-1 h-0.5 w-3 shrink-0 rounded-full"
              style={{ background: row.color ?? seriesColor(index) }}
            />
            <span className="font-mono text-[13px] font-semibold tabular-nums text-ink">
              {typeof row.value === "number" ? row.value.toLocaleString("id-ID") : row.value}
              {unit ? <span className="ml-0.5 text-ink-3">{unit}</span> : null}
            </span>
            <span className="truncate text-[11px] text-ink-3">{row.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Legend. Always present for two or more series — identity must never rest on
 * colour matching alone. A single series gets none: the title already names it.
 */
export function VizLegend({
  payload,
  shape = "line",
}: {
  payload?: Array<{ value?: string; color?: string }>;
  shape?: "line" | "rect";
}) {
  if (!payload?.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-3 pl-1">
      {payload.map((item, index) => (
        <span key={`${item.value}-${index}`} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className={shape === "line" ? "h-0.5 w-3.5 rounded-full" : "h-2.5 w-2.5 rounded-[3px]"}
            style={{ background: item.color ?? seriesColor(index) }}
          />
          <span className="text-[11px] text-ink-2">{item.value}</span>
        </span>
      ))}
    </div>
  );
}

/** Every card wears the same frame, so a canvas of mixed cards still reads as one surface. */
export function Card({
  title,
  subtitle,
  children,
  actions,
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="glass animate-materialize overflow-hidden rounded-xl">
      {(title || subtitle || actions) && (
        <header className="flex items-start justify-between gap-4 px-4 pt-3.5 pb-1">
          <div className="min-w-0">
            {title && <h3 className="truncate text-[13px] font-semibold text-ink">{title}</h3>}
            {subtitle && <p className="mt-0.5 truncate text-[11px] text-ink-3">{subtitle}</p>}
          </div>
          {actions}
        </header>
      )}
      <div className="px-4 pt-2 pb-4">{children}</div>
    </section>
  );
}

/** Marker ring colour — dots stay legible where they cross a line. */
export const RING = SURFACE;
export const MUTED = INK_3;
