import type { ReactNode } from "react";

/**
 * The room the interface sits in: a faint engineering grid, a slow scan sweep,
 * corner brackets, and a vignette that pulls the eye to the middle. All of it
 * is behind `pointer-events-none` — atmosphere must never eat a click.
 */
export function HudFrame({ children }: { children: ReactNode }) {
  return (
    <div className="relative h-full w-full overflow-hidden bg-plane">
      {/* grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.5]"
        style={{
          backgroundImage:
            "linear-gradient(var(--color-grid) 1px, transparent 1px), linear-gradient(90deg, var(--color-grid) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(ellipse 90% 75% at 50% 45%, #000 30%, transparent 100%)",
        }}
      />
      {/* horizon glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-1/2 h-[70vh] -translate-y-1/2"
        style={{
          background: "radial-gradient(ellipse 55% 45% at 50% 50%, rgba(34,197,224,0.09), transparent 70%)",
        }}
      />
      {/* scan sweep */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 animate-scan opacity-40"
        style={{
          background:
            "linear-gradient(180deg, transparent 0%, rgba(46,230,255,0.05) 48%, rgba(46,230,255,0.09) 50%, rgba(46,230,255,0.05) 52%, transparent 100%)",
          backgroundSize: "100% 220px",
          backgroundRepeat: "no-repeat",
        }}
      />
      {/* interlace */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35] mix-blend-overlay"
        style={{
          backgroundImage: "repeating-linear-gradient(0deg, rgba(255,255,255,0.045) 0 1px, transparent 1px 3px)",
        }}
      />
      {/* vignette */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse 78% 70% at 50% 50%, transparent 45%, rgba(0,0,0,0.72) 100%)" }}
      />

      <Bracket className="top-3 left-3" />
      <Bracket className="top-3 right-3 rotate-90" />
      <Bracket className="right-3 bottom-3 rotate-180" />
      <Bracket className="bottom-3 left-3 -rotate-90" />

      <div className="relative z-10 flex h-full flex-col">{children}</div>
    </div>
  );
}

function Bracket({ className }: { className: string }) {
  return (
    <svg
      aria-hidden
      width="26"
      height="26"
      viewBox="0 0 26 26"
      className={`pointer-events-none absolute text-accent/35 ${className}`}
    >
      <path d="M1 9V1h8" stroke="currentColor" strokeWidth="1.5" fill="none" />
    </svg>
  );
}
