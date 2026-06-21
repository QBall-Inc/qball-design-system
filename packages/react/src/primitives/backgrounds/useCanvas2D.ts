import { useEffect, useRef, type DependencyList } from "react";

/**
 * The per-frame context handed to a {@link CanvasDraw} callback. Sizes are in CSS
 * pixels (the draw callback works in CSS-pixel space; the hook has already applied
 * the device-pixel-ratio transform to the context).
 */
export interface CanvasFrame {
  /** Seconds elapsed since the animation started. */
  t: number;
  /** CSS-pixel width of the canvas (from `getBoundingClientRect`). */
  w: number;
  /** CSS-pixel height of the canvas. */
  h: number;
  /**
   * `true` when the user prefers reduced motion. The hook draws a single static
   * frame in that case (see the hook docs); a draw callback should additionally
   * zero any time-derived motion so the one frame it paints is still.
   */
  reduceMotion: boolean;
}

/** A draw callback: paints one frame onto a 2D context. */
export type CanvasDraw = (ctx: CanvasRenderingContext2D, frame: CanvasFrame) => void;

/**
 * `useCanvas2D` — a DPR-aware (capped at 2×), `ResizeObserver`-refit driver for an
 * animated `<canvas>`. Returns a ref to attach to a `<canvas>` element.
 *
 * **SSR/static-safe.** Every canvas / `window` / `ResizeObserver` access lives
 * inside the effect, so the host component renders an inert `<canvas>` on the
 * server and only begins drawing after hydration. If the 2D context is
 * unavailable (server, jsdom without a canvas mock, or a browser without canvas),
 * the hook no-ops — the `<canvas>` still renders, nothing throws.
 *
 * **Honors `prefers-reduced-motion` as a TRUE short-circuit.** When reduced motion
 * is requested the hook paints exactly one static frame and starts **no** animation
 * loop (`requestAnimationFrame` is never called). A later resize repaints that one
 * frame so the canvas is never left blank. This differs from the original port,
 * which kept the rAF loop spinning on a frozen frame.
 *
 * **No leaked work (RB-4).** The effect cleanup flips the running flag, cancels any
 * pending frame, and disconnects the `ResizeObserver`, so no loop, frame, or
 * observer survives an unmount or a dependency change.
 *
 * @param draw  Per-frame paint callback. Read theme/colors/state fresh inside it.
 * @param deps  Dependencies that re-key the effect (default `[]`). The draw closure
 *              reads its inputs fresh each frame, so most backgrounds pass none.
 */
export function useCanvas2D(draw: CanvasDraw, deps: DependencyList = []) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return; // inert in non-canvas environments (server / jsdom / no-2d)

    let rafId = 0;
    let running = true;
    const t0 = performance.now();
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const renderFrame = (now: number) => {
      const { width, height } = canvas.getBoundingClientRect();
      // Clear the full backing store in DEVICE pixels. The active transform is
      // DPR-scaled, so a CSS-pixel clearRect can leave a sub-pixel edge uncleared
      // on fractional widths (visible as trails on a 2× display) — reset to
      // identity, clear the whole store, then restore the DPR transform.
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
      draw(ctx, { t: (now - t0) / 1000, w: width, h: height, reduceMotion });
    };

    const fit = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const { width, height } = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    fit();

    // A canvas is cleared by a resize. Under reduced motion there is no loop to
    // repaint, so re-render the single static frame after each re-fit.
    const ro = new ResizeObserver(() => {
      fit();
      if (reduceMotion) renderFrame(performance.now());
    });
    ro.observe(canvas);

    if (reduceMotion) {
      renderFrame(performance.now());
    } else {
      const loop = (now: number) => {
        if (!running) return;
        renderFrame(now);
        rafId = requestAnimationFrame(loop);
      };
      rafId = requestAnimationFrame(loop);
    }

    return () => {
      running = false;
      cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, deps);

  return ref;
}
