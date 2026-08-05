import { z } from "zod";

/**
 * ComponentSpec — the contract between Claude and the canvas.
 *
 * Claude emits one of these via the `render_component` tool; the web app maps
 * `type` to a React component. Keep this union tight: a precise schema is what
 * keeps Claude from inventing shapes the renderer can't draw.
 */

const Cell = z.union([z.string(), z.number(), z.null()]);
const Row = z.record(z.string(), Cell);

const Axis = z.object({
  key: z.string().describe("Field name in each data row to use for this axis"),
  label: z.string().optional(),
  type: z.enum(["category", "time", "number"]).default("category"),
});

const Series = z.object({
  key: z.string().describe("Field name in each data row holding this series' value"),
  label: z.string().optional().describe("Human-readable name shown in the legend"),
});

const SeriesChart = {
  title: z.string().optional(),
  subtitle: z.string().optional(),
  x: Axis,
  series: z.array(Series).min(1).max(8),
  data: z.array(Row).min(1),
  yLabel: z.string().optional(),
  unit: z.string().optional().describe('Appended to values, e.g. "%", "GB", "ms"'),
};

const Metric = z.object({
  label: z.string(),
  value: z.union([z.string(), z.number()]),
  unit: z.string().optional(),
  delta: z.union([z.string(), z.number()]).optional().describe("Change vs. a previous period"),
  deltaDirection: z.enum(["up", "down", "flat"]).optional(),
  hint: z.string().optional().describe("Small caption under the value"),
  sparkline: z.array(z.number()).optional().describe("Recent values, drawn as a tiny inline trend"),
  tone: z.enum(["neutral", "good", "warn", "bad"]).default("neutral"),
});

export const ComponentSpec = z.discriminatedUnion("type", [
  z.object({ type: z.literal("line_chart"), ...SeriesChart }),
  z.object({ type: z.literal("area_chart"), ...SeriesChart, stacked: z.boolean().default(false) }),
  z.object({ type: z.literal("bar_chart"), ...SeriesChart, stacked: z.boolean().default(false), horizontal: z.boolean().default(false) }),

  z.object({
    type: z.literal("pie_chart"),
    title: z.string().optional(),
    subtitle: z.string().optional(),
    nameKey: z.string(),
    valueKey: z.string(),
    data: z.array(Row).min(1),
    unit: z.string().optional(),
    donut: z.boolean().default(true),
  }),

  z.object({ type: z.literal("metric_card"), ...Metric.shape }),

  z.object({
    type: z.literal("metric_grid"),
    title: z.string().optional(),
    items: z.array(Metric).min(1).max(12),
  }),

  z.object({
    type: z.literal("data_table"),
    title: z.string().optional(),
    subtitle: z.string().optional(),
    columns: z.array(
      z.object({
        key: z.string(),
        label: z.string().optional(),
        align: z.enum(["left", "right", "center"]).default("left"),
        format: z.enum(["text", "number", "bytes", "percent", "duration"]).default("text"),
      }),
    ).min(1),
    rows: z.array(Row),
  }),

  z.object({
    type: z.literal("timeline"),
    title: z.string().optional(),
    items: z.array(
      z.object({
        time: z.string().optional(),
        title: z.string(),
        detail: z.string().optional(),
        status: z.enum(["info", "ok", "warn", "error"]).default("info"),
      }),
    ).min(1),
  }),

  z.object({
    type: z.literal("markdown"),
    title: z.string().optional(),
    content: z.string(),
  }),

  z.object({
    type: z.literal("code_block"),
    title: z.string().optional(),
    language: z.string().optional(),
    code: z.string(),
  }),

  z.object({
    type: z.literal("image"),
    title: z.string().optional(),
    url: z.string().describe("http(s) URL or a data: URI"),
    alt: z.string().optional(),
  }),
]);

export type ComponentSpec = z.infer<typeof ComponentSpec>;
export type ComponentType = ComponentSpec["type"];
export type MetricSpec = z.infer<typeof Metric>;
