import type { ComponentSpec } from "@shared/protocol.js";
import { Card } from "../ChartChrome.js";
import { formatCell } from "../viz.js";

type Spec = Extract<ComponentSpec, { type: "data_table" }>;

const align = { left: "text-left", right: "text-right", center: "text-center" } as const;

export function DataTable({ spec }: { spec: Spec }) {
  const { title, subtitle, columns, rows } = spec;

  return (
    <Card title={title} subtitle={subtitle}>
      <div className="-mx-1 max-h-80 overflow-auto">
        <table className="w-full border-collapse text-[12px]">
          <thead className="sticky top-0 glass">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={`border-b border-line px-2 pb-2 font-medium text-ink-3 ${align[column.align]}`}
                >
                  {column.label ?? column.key}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index} className="border-b border-line-soft last:border-0 hover:bg-white/[0.02]">
                {columns.map((column) => (
                  <td
                    key={column.key}
                    // Columns of numbers do want tabular figures — they have to line up.
                    className={`px-2 py-1.5 text-ink-2 ${align[column.align]} ${
                      column.format === "text" ? "" : "font-mono tabular-nums text-ink"
                    }`}
                  >
                    {formatCell(row[column.key], column.format)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="px-2 py-6 text-center text-[12px] text-ink-4">Tidak ada baris.</p>}
      </div>
    </Card>
  );
}
