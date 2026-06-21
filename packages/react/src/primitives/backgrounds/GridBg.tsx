import { readBackgroundStyles } from "./tokens";
import type { BackgroundProps } from "./types";
import { useCanvas2D } from "./useCanvas2D";

/**
 * `GridBg` — a slowly pulsing dot matrix in the signal (sage) token color, faded
 * toward the top-left so an overlaid headline stays readable. A decorative,
 * `aria-hidden` `<canvas>` background.
 *
 * Token-driven (reads `--color-signal` at paint time; draws nothing if the token
 * stylesheet is absent). Honors `prefers-reduced-motion` via {@link useCanvas2D} —
 * one static frame, no animation loop. Brand rule: signal color only, very slow,
 * no spring.
 */
export function GridBg(props: BackgroundProps) {
  const ref = useCanvas2D((ctx, { t, w, h, reduceMotion }) => {
    const { signal } = readBackgroundStyles();
    if (!signal) return; // token-only: no hardcoded fallback (skip if unloaded)
    ctx.fillStyle = signal;

    const step = 28;
    const cols = Math.ceil(w / step);
    const rows = Math.ceil(h / step);
    // Soft offset so the grid isn't aligned to pixel 0.
    const offX = (w - cols * step) / 2;
    const offY = (h - rows * step) / 2;

    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const x = offX + i * step + step / 2;
        const y = offY + j * step + step / 2;

        // Slow pseudo-noise from a couple of sines; static under reduced motion.
        const tt = reduceMotion ? 0 : t * 0.15;
        const n =
          Math.sin(i * 0.31 + j * 0.21 + tt) * 0.5 + Math.sin(i * 0.13 - j * 0.41 + tt * 0.7) * 0.5;
        // Falloff toward the top-left to keep an overlaid headline readable.
        const focal = 1 - Math.min(1, Math.max(0, (1 - x / w) * 0.7 + (1 - y / h) * 0.7));
        const a = Math.max(0, n * 0.5 + 0.5) * 0.35 * focal;
        if (a < 0.02) continue;

        ctx.globalAlpha = a;
        const r = 1.1 + Math.max(0, n) * 0.9;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  });

  return <canvas {...props} ref={ref} aria-hidden="true" />;
}
