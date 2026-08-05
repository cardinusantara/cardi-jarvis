import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { ComponentSpec } from "@shared/protocol.js";
import { Card, VizLegend, VizTooltip } from "../ChartChrome.js";
import { seriesColor, SURFACE } from "../viz.js";

type Spec = Extract<ComponentSpec, { type: "pie_chart" }>;

export function PieCard({ spec }: { spec: Spec }) {
  const { title, subtitle, nameKey, valueKey, data, unit, donut } = spec;
  // Past eight slices hue stops being a distinguishing channel; fold the tail.
  const slices = data.slice(0, 8);

  return (
    <Card title={title} subtitle={subtitle}>
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Tooltip content={<VizTooltip unit={unit} />} />
          <Legend content={<VizLegend shape="rect" />} />
          <Pie
            data={slices}
            dataKey={valueKey}
            nameKey={nameKey}
            innerRadius={donut ? 52 : 0}
            outerRadius={84}
            // 2px surface gap between neighbouring segments — the separator is
            // negative space, never a stroke.
            paddingAngle={1.5}
            stroke={SURFACE}
            strokeWidth={2}
            isAnimationActive={false}
          >
            {slices.map((_, index) => (
              <Cell key={index} fill={seriesColor(index)} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </Card>
  );
}
