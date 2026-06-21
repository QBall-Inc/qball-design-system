import { useRef } from "react";

import { readBackgroundStyles } from "./tokens";
import type { BackgroundProps } from "./types";
import { useCanvas2D } from "./useCanvas2D";

/** One drifting glyph in the constellation. */
interface Glyph {
  g: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  highlight: boolean;
  base: number;
  phase: number;
}

interface GlyphsState {
  /** Canvas width the constellation was laid out for. */
  w: number;
  items: Glyph[];
  /** Last frame time (seconds) — used to derive a clamped delta. */
  lastT: number;
}

const GLYPHS = ["→", "↳", "/", "\\", "·", "<", ">", "+", "*", "∞", "◇"];

/**
 * `GlyphsBg` — brand glyphs drifting slowly like a constellation, mostly in the
 * signal (sage) token color with roughly one in six in amber (highlight), each
 * breathing in opacity. A decorative, `aria-hidden` `<canvas>` background.
 *
 * Token-driven (reads `--color-signal`, `--color-highlight`, and `--font-display`
 * at paint time; draws nothing if the color tokens are absent). The glyph font is
 * the design-system display font (`--font-display`), falling back to the public
 * Fira Code default — never the private commercial display face. Honors
 * `prefers-reduced-motion` via {@link useCanvas2D} (one static frame, no loop).
 */
export function GlyphsBg(props: BackgroundProps) {
  const stateRef = useRef<GlyphsState | null>(null);

  const ref = useCanvas2D((ctx, { t, w, h, reduceMotion }) => {
    const { signal, highlight, font } = readBackgroundStyles();
    if (!signal || !highlight) return; // token-only: no hardcoded fallback

    if (!stateRef.current || Math.abs(stateRef.current.w - w) > 8) {
      const n = Math.min(28, Math.max(14, Math.floor((w * h) / 60000)));
      const items: Glyph[] = [];
      for (let i = 0; i < n; i++) {
        items.push({
          g: GLYPHS[Math.floor(Math.random() * GLYPHS.length)] ?? "·",
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 4, // very slow drift, px/sec
          vy: (Math.random() - 0.5) * 4,
          size: 14 + Math.random() * 36,
          highlight: Math.random() < 0.18, // ~1 in 6 is amber
          base: 0.18 + Math.random() * 0.22,
          phase: Math.random() * Math.PI * 2,
        });
      }
      stateRef.current = { w, items, lastT: t };
    }

    const dt = reduceMotion ? 0 : Math.min(0.05, t - stateRef.current.lastT);
    stateRef.current.lastT = t;
    // Freeze the opacity "breathing" too, so the reduced-motion frame is static.
    const tt = reduceMotion ? 0 : t;

    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    for (const it of stateRef.current.items) {
      it.x += it.vx * dt;
      it.y += it.vy * dt;
      // Wrap edges with a soft margin.
      const m = 60;
      if (it.x < -m) it.x = w + m;
      if (it.x > w + m) it.x = -m;
      if (it.y < -m) it.y = h + m;
      if (it.y > h + m) it.y = -m;

      ctx.globalAlpha = it.base * (0.6 + 0.4 * Math.sin(tt * 0.4 + it.phase));
      ctx.fillStyle = it.highlight ? highlight : signal;
      ctx.font = `300 ${it.size}px ${font}`;
      ctx.fillText(it.g, it.x, it.y);
    }
    ctx.globalAlpha = 1;
  });

  return <canvas {...props} ref={ref} aria-hidden="true" />;
}
