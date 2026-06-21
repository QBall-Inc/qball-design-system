import { useRef } from "react";

import { readBackgroundStyles } from "./tokens";
import type { BackgroundProps } from "./types";
import { useCanvas2D } from "./useCanvas2D";

/** One falling column of mono glyphs. */
interface AsciiColumn {
  x: number;
  head: number;
  speed: number;
  len: number;
  glyphs: string[];
}

interface AsciiState {
  /** Canvas width the columns were laid out for (relaid out if it changes). */
  w: number;
  cols: AsciiColumn[];
  /** Last frame time (seconds) — used to derive a frame-rate-independent delta. */
  lastT: number;
}

const ASCII_CHARS = "01·→/\\><+=-:.";

/**
 * `AsciiBg` — slow falling streams of mono characters: bright amber (highlight) at
 * each column head fading to sage (signal) down the tail. A decorative,
 * `aria-hidden` `<canvas>` background.
 *
 * Token-driven (reads `--color-signal`, `--color-highlight`, and `--font-display`
 * at paint time; draws nothing if the color tokens are absent). The glyph font is
 * the design-system display font (`--font-display`), falling back to the public
 * Fira Code default — never the private commercial display face. Honors
 * `prefers-reduced-motion` via {@link useCanvas2D} (one static frame, no loop).
 */
export function AsciiBg(props: BackgroundProps) {
  const stateRef = useRef<AsciiState | null>(null);

  const ref = useCanvas2D((ctx, { t, w, h, reduceMotion }) => {
    const { signal, highlight, font } = readBackgroundStyles();
    if (!signal || !highlight) return; // token-only: no hardcoded fallback

    const colW = 14; // column spacing — tighter for density
    const lineH = 20; // row spacing

    // Initialize columns lazily; relay out if the width changed materially.
    if (!stateRef.current || Math.abs(stateRef.current.w - w) > colW) {
      const nCols = Math.floor(w / colW);
      const cols: AsciiColumn[] = [];
      for (let i = 0; i < nCols; i++) {
        // Dense — keep ~85% of columns active.
        if (Math.random() > 0.85) continue;
        cols.push({
          x: i * colW + colW / 2,
          head: Math.random() * h,
          speed: 10 + Math.random() * 22, // px/sec — slow but varied
          len: 10 + Math.floor(Math.random() * 18),
          glyphs: Array.from({ length: 30 }, () =>
            ASCII_CHARS.charAt(Math.floor(Math.random() * ASCII_CHARS.length)),
          ),
        });
      }
      stateRef.current = { w, cols, lastT: t };
    }

    // Frame-rate-independent delta (px/sec speeds × seconds), clamped to absorb a
    // tab-switch gap; zero under reduced motion.
    const dt = reduceMotion ? 0 : Math.min(0.05, t - stateRef.current.lastT);
    stateRef.current.lastT = t;
    // Glyph cycling is itself motion — freeze the cycle index under reduced motion.
    const cycle = reduceMotion ? 0 : Math.floor(t * 2);
    ctx.font = `400 13px ${font}`;
    ctx.textBaseline = "top";

    for (const col of stateRef.current.cols) {
      col.head += col.speed * dt;
      if (col.head - col.len * lineH > h) {
        col.head = -Math.random() * 200;
      }
      for (let k = 0; k < col.len; k++) {
        const y = col.head - k * lineH;
        if (y < -lineH || y > h) continue;
        // Brightest at the head, fading toward the tail.
        const fade = 1 - k / col.len;
        const focal = 0.45 + 0.55 * Math.min(1, y / h);
        ctx.globalAlpha = 0.55 * fade * focal;
        ctx.fillStyle = k === 0 ? highlight : signal;
        const g = col.glyphs[(k + cycle) % col.glyphs.length] ?? "";
        ctx.fillText(g, col.x, y);
      }
    }
    ctx.globalAlpha = 1;
  });

  return <canvas {...props} ref={ref} aria-hidden="true" />;
}
