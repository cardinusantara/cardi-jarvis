import type { ComponentSpec } from "@shared/protocol.js";
import { Card } from "../ChartChrome.js";
import { TONE } from "../viz.js";

type MetricGridSpec = Extract<ComponentSpec, { type: "metric_grid" }>;
type MetricCardSpec = Extract<ComponentSpec, { type: "metric_card" }>;
type Metric = MetricGridSpec["items"][number];

/** 12-point sparkline in the de-emphasis ink; the number is the story, not the line. */
function Sparkline({ values, tone }: { values: number[]; tone: Metric["tone"] }) {
  if (values.length < 2) return null;
  const width = 72;
  const height = 20;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width;
      const y = height - ((v - min) / span) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke={TONE[tone]}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={tone === "neutral" ? 0.4 : 0.85}
      />
    </svg>
  );
}

function deltaGlyph(direction: Metric["deltaDirection"]) {
  if (direction === "up") return "↑";
  if (direction === "down") return "↓";
  return "→";
}

export function MetricTile({ metric, compact = false }: { metric: Metric; compact?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="truncate text-[11px] text-ink-3">{metric.label}</span>
      <div className="flex items-baseline gap-1.5">
        {/* Proportional figures: tabular-nums makes a large standalone number look loose. */}
        <span className={`font-semibold text-ink ${compact ? "text-2xl" : "text-3xl"}`}>
          {typeof metric.value === "number" ? metric.value.toLocaleString("id-ID") : metric.value}
        </span>
        {metric.unit && <span className="text-[13px] text-ink-3">{metric.unit}</span>}
      </div>
      <div className="flex items-center gap-2">
        {metric.delta !== undefined && (
          <span className="font-mono text-[11px] tabular-nums" style={{ color: TONE[metric.tone] }}>
            {deltaGlyph(metric.deltaDirection)} {metric.delta}
          </span>
        )}
        {metric.sparkline && metric.sparkline.length > 1 && (
          <Sparkline values={metric.sparkline.slice(-12)} tone={metric.tone} />
        )}
      </div>
      {metric.hint && <span className="truncate text-[11px] text-ink-4">{metric.hint}</span>}
    </div>
  );
}

export function MetricCardView({ spec }: { spec: MetricCardSpec }) {
  const { type: _type, ...metric } = spec;
  return (
    <Card>
      <MetricTile metric={metric} />
    </Card>
  );
}

export function MetricGridView({ spec }: { spec: MetricGridSpec }) {
  return (
    <Card title={spec.title}>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] gap-x-6 gap-y-5">
        {spec.items.map((metric, index) => (
          <MetricTile key={`${metric.label}-${index}`} metric={metric} compact={spec.items.length > 3} />
        ))}
      </div>
    </Card>
  );
}
