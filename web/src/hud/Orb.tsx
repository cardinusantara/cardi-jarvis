import { useEffect, useRef } from "react";
import { audioBus } from "../voice/audio-bus.js";

export type OrbState = "idle" | "listening" | "thinking" | "speaking" | "offline";

/**
 * Each state gets a colour and a temperament; transitions are interpolated,
 * never cut. `thinking` and `speaking` share the same orange — they're one
 * continuous "AI is doing something" mood, not two. Splitting them by colour
 * used to make the orb look like it snapped back to idle the instant text
 * finished streaming, even though audio was still playing.
 */
const STATES: Record<OrbState, { rgb: [number, number, number]; energy: number; spin: number }> = {
  offline: { rgb: [90, 96, 104], energy: 0.12, spin: 0.15 },
  idle: { rgb: [34, 197, 224], energy: 0.28, spin: 0.4 },
  listening: { rgb: [56, 232, 255], energy: 0.85, spin: 1.0 },
  thinking: { rgb: [255, 176, 32], energy: 0.62, spin: 1.8 },
  speaking: { rgb: [255, 158, 24], energy: 0.95, spin: 0.85 },
};

const TICKS = 108;
const PARTICLES = 46;

interface Particle {
  radius: number;
  tilt: number;
  phase: number;
  speed: number;
  size: number;
}

const particles: Particle[] = Array.from({ length: PARTICLES }, (_, i) => ({
  radius: 1.16 + (i % 5) * 0.09,
  tilt: (i / PARTICLES) * Math.PI,
  phase: (i * 137.5 * Math.PI) / 180,
  speed: 0.18 + ((i * 7) % 11) / 42,
  size: 0.9 + ((i * 3) % 5) * 0.32,
}));

const mix = (a: number, b: number, t: number) => a + (b - a) * t;

export function Orb({ state, size = 420 }: { state: OrbState; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let t = 0;
    // Colour and energy chase the target so a state change reads as a mood
    // shift rather than a jump cut.
    const current: [number, number, number] = [...STATES[state].rgb];
    let energy = STATES[state].energy;
    let spin = STATES[state].spin;
    let angle = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = size * dpr;
      canvas.height = size * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const draw = () => {
      const target = STATES[stateRef.current];
      for (let i = 0; i < 3; i++) current[i] = mix(current[i]!, target.rgb[i]!, 0.06);
      energy = mix(energy, target.energy, 0.05);
      spin = mix(spin, target.spin, 0.04);

      // Speaking → animate purely off Cardi's voice; listening → purely off
      // the user's. Other states fall back to whichever is actually audible.
      const preferred = stateRef.current === "speaking" ? "playback" : stateRef.current === "listening" ? "mic" : "auto";
      const audio = audioBus.read(preferred);
      const loud = Math.min(1, audio.level * 3.4);
      const pulse = energy * (0.55 + loud * 0.85);

      const [r, g, b] = current;
      const rgba = (alpha: number) => `rgba(${r | 0},${g | 0},${b | 0},${alpha})`;

      const c = size / 2;
      const R = size * 0.2;

      t += 1 / 60;
      angle += 0.0035 * spin;

      ctx.clearRect(0, 0, size, size);
      ctx.save();
      ctx.translate(c, c);

      /* — outer spectrum ring: the mic/voice made visible — */
      const tickR = R * 1.72;
      ctx.lineCap = "round";
      for (let i = 0; i < TICKS; i++) {
        const a = (i / TICKS) * Math.PI * 2 + angle * 0.35;
        const bin = audio.freq[Math.floor((i / TICKS) * audio.freq.length)] ?? 0;
        const magnitude = (bin / 255) * 0.85 + 0.15;
        const len = R * (0.06 + magnitude * 0.42 * (0.35 + pulse));
        const x0 = Math.cos(a) * tickR;
        const y0 = Math.sin(a) * tickR;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(Math.cos(a) * (tickR + len), Math.sin(a) * (tickR + len));
        ctx.strokeStyle = rgba(0.12 + magnitude * 0.55 * (0.3 + pulse));
        ctx.lineWidth = 1.6;
        ctx.stroke();
      }

      /* — sweeping arcs, different radii and directions — */
      const arcs: Array<[number, number, number, number, number]> = [
        [R * 1.5, 0.62, 1, 1.6, 0.5],
        [R * 1.38, 0.34, -1, 1.2, 0.34],
        [R * 1.26, 0.5, 1, 1, 0.22],
      ];
      for (const [radius, span, dir, width, alpha] of arcs) {
        const start = angle * dir * 2.1 + radius;
        ctx.beginPath();
        ctx.arc(0, 0, radius, start, start + span * Math.PI * 2);
        ctx.strokeStyle = rgba(alpha * (0.4 + pulse * 0.7));
        ctx.lineWidth = width;
        ctx.stroke();
      }

      /* — dashed containment ring — */
      ctx.save();
      ctx.rotate(-angle * 1.4);
      ctx.beginPath();
      ctx.arc(0, 0, R * 1.12, 0, Math.PI * 2);
      ctx.setLineDash([2, 9]);
      ctx.strokeStyle = rgba(0.3 + pulse * 0.3);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      /* — orbiting particles, faked into 3D by squashing the minor axis — */
      for (const p of particles) {
        const a = p.phase + t * p.speed * spin;
        const depth = Math.sin(a); // −1 behind, +1 in front
        const x = Math.cos(a) * R * p.radius;
        const y = Math.sin(a) * R * p.radius * Math.cos(p.tilt + t * 0.05);
        const scale = 0.55 + (depth + 1) * 0.36;
        ctx.beginPath();
        ctx.arc(x, y, p.size * scale * (0.7 + pulse * 0.6), 0, Math.PI * 2);
        ctx.fillStyle = rgba(0.18 + scale * 0.5 * (0.35 + pulse));
        ctx.fill();
      }

      /* — core: bloom, then body, then a hot centre — */
      const bloom = ctx.createRadialGradient(0, 0, R * 0.1, 0, 0, R * 1.9);
      bloom.addColorStop(0, rgba(0.3 + pulse * 0.34));
      bloom.addColorStop(0.42, rgba(0.09 + pulse * 0.12));
      bloom.addColorStop(1, rgba(0));
      ctx.fillStyle = bloom;
      ctx.beginPath();
      ctx.arc(0, 0, R * 1.9, 0, Math.PI * 2);
      ctx.fill();

      const body = ctx.createRadialGradient(-R * 0.25, -R * 0.3, R * 0.05, 0, 0, R);
      body.addColorStop(0, rgba(0.62 + pulse * 0.3));
      body.addColorStop(0.55, rgba(0.16 + pulse * 0.16));
      body.addColorStop(1, rgba(0.02));
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.arc(0, 0, R * (0.94 + pulse * 0.06), 0, Math.PI * 2);
      ctx.fill();

      /* — circular oscilloscope, the voice itself — */
      const waveR = R * 0.72;
      ctx.beginPath();
      const points = 160;
      for (let i = 0; i <= points; i++) {
        const a = (i / points) * Math.PI * 2 - Math.PI / 2;
        const sample = audio.wave[Math.floor((i / points) * audio.wave.length)] ?? 128;
        const deviation = ((sample - 128) / 128) * R * 0.34 * (0.25 + pulse);
        const rr = waveR + deviation;
        const x = Math.cos(a) * rr;
        const y = Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = rgba(0.5 + pulse * 0.45);
      ctx.lineWidth = 1.4;
      ctx.stroke();

      const hot = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 0.42);
      hot.addColorStop(0, `rgba(255,255,255,${0.5 + pulse * 0.4})`);
      hot.addColorStop(0.5, rgba(0.4 + pulse * 0.3));
      hot.addColorStop(1, rgba(0));
      ctx.fillStyle = hot;
      ctx.beginPath();
      ctx.arc(0, 0, R * 0.42, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [size, state]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className="pointer-events-none select-none"
      aria-hidden
    />
  );
}
