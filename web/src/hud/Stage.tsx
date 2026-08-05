import type { CanvasCard } from "@shared/protocol.js";
import { Canvas } from "../canvas/Canvas.js";
import { Orb, type OrbState } from "./Orb.js";

/**
 * The stage has two modes and glides between them.
 *
 * With nothing to show, the orb owns the screen — this is a voice interface
 * first, and the orb is the thing you talk to. The moment Claude renders
 * something, the orb steps aside and shrinks into the corner, handing the
 * stage to the visualization. Clearing the canvas hands it back.
 */
export function Stage({
  cards,
  orbState,
  hint,
}: {
  cards: CanvasCard[];
  orbState: OrbState;
  hint: string;
}) {
  const showing = cards.length > 0;

  return (
    <div className="relative h-full min-h-0 w-full">
      {/* One orb, never remounted — only moved, so the transition is continuous. */}
      <div
        className="pointer-events-none absolute z-20 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
        style={
          showing
            ? { top: 4, left: 4, transform: "scale(0.3)", transformOrigin: "top left" }
            : { top: "50%", left: "50%", transform: "translate(-50%, -54%) scale(1)" }
        }
      >
        <Orb state={orbState} size={400} />
      </div>

      {/* Idle caption sits under the orb and fades out when the deck takes over. */}
      <div
        className={`pointer-events-none absolute inset-x-0 bottom-[14%] flex flex-col items-center gap-2 transition-opacity duration-500 ${
          showing ? "opacity-0" : "opacity-100"
        }`}
      >
        <span className="label">{hint}</span>
      </div>

      {/* Deck */}
      <div
        className={`absolute inset-0 overflow-y-auto transition-all duration-500 ${
          showing ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"
        }`}
      >
        <div className="min-h-full px-6 pt-4 pb-6 pl-32">
          <Canvas cards={cards} />
        </div>
      </div>
    </div>
  );
}
