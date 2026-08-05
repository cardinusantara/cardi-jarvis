import type { CanvasCard } from "@shared/protocol.js";
import { SeriesChart } from "./components/SeriesChart.js";
import { PieCard } from "./components/PieCard.js";
import { MetricCardView, MetricGridView } from "./components/Metrics.js";
import { DataTable } from "./components/DataTable.js";
import { CodeBlock, HtmlFrame, ImageCard, Markdown, Timeline } from "./components/Misc.js";

/** Maps a spec's `type` to a component. Unknown types fail visibly, not silently. */
function CardBody({ card }: { card: CanvasCard }) {
  if (card.kind === "html") return <HtmlFrame card={card} />;

  const spec = card.spec;
  switch (spec.type) {
    case "line_chart":
    case "area_chart":
    case "bar_chart":
      return <SeriesChart spec={spec} />;
    case "pie_chart":
      return <PieCard spec={spec} />;
    case "metric_card":
      return <MetricCardView spec={spec} />;
    case "metric_grid":
      return <MetricGridView spec={spec} />;
    case "data_table":
      return <DataTable spec={spec} />;
    case "timeline":
      return <Timeline spec={spec} />;
    case "markdown":
      return <Markdown spec={spec} />;
    case "code_block":
      return <CodeBlock spec={spec} />;
    case "image":
      return <ImageCard spec={spec} />;
    default:
      return (
        <div className="rounded-xl border border-dashed border-line p-4 text-[12px] text-ink-4">
          Komponen tak dikenal: <code className="font-mono">{(spec as { type: string }).type}</code>
        </div>
      );
  }
}

export function Canvas({ cards }: { cards: CanvasCard[] }) {
  // The orb is the empty state — an "empty canvas" placeholder underneath it
  // would be dead weight in the accessibility tree and visible to nobody.
  if (cards.length === 0) return null;

  return (
    <div className="grid auto-rows-min grid-cols-1 gap-4 xl:grid-cols-2">
      {cards.map((card) => (
        <div key={card.id} className={spansFullWidth(card) ? "xl:col-span-2" : undefined}>
          <CardBody card={card} />
        </div>
      ))}
    </div>
  );
}

/** Wide content shouldn't be squeezed into half a column. */
function spansFullWidth(card: CanvasCard): boolean {
  if (card.kind === "html") return (card.height ?? 360) > 420;
  const type = card.spec.type;
  if (type === "metric_grid") return card.spec.items.length > 3;
  if (type === "data_table") return card.spec.columns.length > 3;
  return type === "markdown" || type === "code_block";
}

