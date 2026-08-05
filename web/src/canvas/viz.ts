/**
 * Chart primitives shared by every canvas component.
 *
 * Palette: dataviz reference dark steps, in fixed slot order — validated
 * against our surface (#111214) for lightness band, chroma floor, adjacent CVD
 * separation, normal-vision floor, and 3:1 contrast. Assign in order; never
 * cycle. Past eight series, fold into "Other".
 */
export const SERIES = [
  "#3987e5", // 1 blue
  "#d95926", // 2 orange
  "#199e70", // 3 aqua
  "#c98500", // 4 yellow
  "#d55181", // 5 magenta
  "#008300", // 6 green
  "#9085e9", // 7 violet
  "#e66767", // 8 red
] as const;

export const SURFACE = "#0d1117";
export const GRID = "rgba(46,230,255,0.08)";
export const AXIS = "rgba(46,230,255,0.18)";
export const INK = "#e8f6fa";
export const INK_2 = "#9fb4bd";
export const INK_3 = "#6b8894";

export const STATUS = {
  info: "#3987e5",
  ok: "#0ca30c",
  warn: "#fab219",
  error: "#d03b3b",
} as const;

export const TONE = {
  neutral: INK,
  good: "#0ca30c",
  warn: "#fab219",
  bad: "#d03b3b",
} as const;

export const seriesColor = (index: number) => SERIES[index % SERIES.length]!;

/** Recharts axis styling, applied identically everywhere so charts read as one system. */
export const axisProps = {
  stroke: AXIS,
  tick: { fill: INK_3, fontSize: 11, fontFamily: "var(--font-mono)" },
  tickLine: false,
  axisLine: { stroke: AXIS },
} as const;

const compact = new Intl.NumberFormat("id-ID", { notation: "compact", maximumFractionDigits: 1 });
const plain = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 });

export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return Math.abs(value) >= 10_000 ? compact.format(value) : plain.format(value);
}

export function formatBytes(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  let n = Math.abs(value);
  let unit = 0;
  while (n >= 1024 && unit < units.length - 1) {
    n /= 1024;
    unit++;
  }
  return `${plain.format(Math.sign(value) * n)} ${units[unit]}`;
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds)) return "—";
  if (seconds < 60) return `${plain.format(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  return `${Math.floor(seconds / 3600)}j ${Math.round((seconds % 3600) / 60)}m`;
}

export type CellFormat = "text" | "number" | "bytes" | "percent" | "duration";

export function formatCell(value: unknown, format: CellFormat): string {
  if (value === null || value === undefined || value === "") return "—";
  if (format === "text") return String(value);
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return String(value);
  switch (format) {
    case "number":
      return formatNumber(n);
    case "bytes":
      return formatBytes(n);
    case "percent":
      return `${plain.format(n)}%`;
    case "duration":
      return formatDuration(n);
  }
}
