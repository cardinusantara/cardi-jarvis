import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ComponentSpec } from "@shared/protocol.js";
import { Card, VizLegend, VizTooltip } from "../ChartChrome.js";
import { axisProps, formatNumber, GRID, seriesColor, SURFACE } from "../viz.js";

type Spec = Extract<ComponentSpec, { type: "line_chart" | "area_chart" | "bar_chart" }>;

/**
 * Line, area, and bar share one implementation: same axes, same grid, same
 * tooltip. Consistency here is what makes a canvas of several charts read as
 * one instrument rather than three widgets.
 */
export function SeriesChart({ spec }: { spec: Spec }) {
  const { title, subtitle, x, series, data, unit, yLabel } = spec;
  const stacked = "stacked" in spec ? spec.stacked : false;
  const horizontal = spec.type === "bar_chart" && spec.horizontal;
  const showLegend = series.length >= 2;

  const grid = (
    <CartesianGrid
      stroke={GRID}
      strokeWidth={1}
      vertical={horizontal}
      horizontal={!horizontal}
    />
  );

  const axes = horizontal
    ? [
        <XAxis key="x" type="number" {...axisProps} tickFormatter={formatNumber} />,
        <YAxis key="y" type="category" dataKey={x.key} width={96} {...axisProps} />,
      ]
    : [
        <XAxis key="x" dataKey={x.key} {...axisProps} minTickGap={24} />,
        <YAxis
          key="y"
          {...axisProps}
          width={48}
          tickFormatter={formatNumber}
          label={
            yLabel
              ? { value: yLabel, angle: -90, position: "insideLeft", fill: "#6b8894", fontSize: 11 }
              : undefined
          }
        />,
      ];

  // Line and area get a crosshair that snaps to the nearest X — readers aim at a
  // date, not at a 2px line. Bars are their own hit target, so they get a band
  // highlight instead; two cursors on one chart is one too many.
  const cursor =
    spec.type === "bar_chart"
      ? { fill: "rgba(255,255,255,0.04)" }
      : { stroke: "rgba(46,230,255,0.35)", strokeWidth: 1 };

  const tooltip = <Tooltip content={<VizTooltip unit={unit} />} cursor={cursor} />;

  const legend = showLegend ? (
    <Legend content={<VizLegend shape={spec.type === "line_chart" ? "line" : "rect"} />} />
  ) : null;

  return (
    <Card title={title} subtitle={subtitle}>
      <ResponsiveContainer width="100%" height={240}>
        {spec.type === "line_chart" ? (
          <LineChart data={data} margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
            {grid}
            {axes}
            {tooltip}
            {legend}
            {series.map((s, i) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label ?? s.key}
                stroke={seriesColor(i)}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                dot={false}
                // 8px marker with a 2px surface ring, so it survives crossings.
                activeDot={{ r: 4, strokeWidth: 2, stroke: SURFACE }}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        ) : spec.type === "area_chart" ? (
          <AreaChart data={data} margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
            {grid}
            {axes}
            {tooltip}
            {legend}
            {series.map((s, i) => (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label ?? s.key}
                stackId={stacked ? "stack" : undefined}
                stroke={seriesColor(i)}
                strokeWidth={2}
                fill={seriesColor(i)}
                fillOpacity={0.1}
                activeDot={{ r: 4, strokeWidth: 2, stroke: SURFACE }}
                isAnimationActive={false}
              />
            ))}
          </AreaChart>
        ) : (
          <BarChart
            data={data}
            layout={horizontal ? "vertical" : "horizontal"}
            margin={{ top: 4, right: 12, bottom: 0, left: 0 }}
          >
            {grid}
            {axes}
            {tooltip}
            {legend}
            {series.map((s, i) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.label ?? s.key}
                stackId={stacked ? "stack" : undefined}
                fill={seriesColor(i)}
                maxBarSize={24}
                // 4px rounded data-end, square at the baseline.
                radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        )}
      </ResponsiveContainer>
    </Card>
  );
}
