import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useCanvas2D, type CanvasDraw, type CanvasFrame } from "./useCanvas2D";

/** A minimal host that wires the hook's ref to a real <canvas>. */
function Harness({ draw }: { draw: CanvasDraw }) {
  const ref = useCanvas2D(draw);
  return <canvas ref={ref} data-testid="cv" aria-hidden="true" />;
}

/** Forces `prefers-reduced-motion: reduce` (or not) on the jsdom matchMedia shim. */
function setReducedMotion(reduce: boolean): void {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: reduce && query.includes("reduce"),
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useCanvas2D", () => {
  it("attaches its ref to a rendered <canvas>", () => {
    const { getByTestId } = render(<Harness draw={() => {}} />);
    expect(getByTestId("cv").tagName).toBe("CANVAS");
  });

  it("no-ops without throwing when the 2D context is unavailable (SSR/jsdom guard)", () => {
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    const draw = vi.fn();
    // The render must not throw even though getContext returns null.
    const { getByTestId } = render(<Harness draw={draw} />);
    expect(getByTestId("cv").tagName).toBe("CANVAS");
    expect(draw).not.toHaveBeenCalled(); // guarded out before any drawing
    getContext.mockRestore();
  });

  it("runs the draw callback with a frame when a 2D context is available", () => {
    setReducedMotion(false);
    let frame: CanvasFrame | undefined;
    const draw = vi.fn((_ctx, f: CanvasFrame) => {
      frame = f;
    });
    let raf: FrameRequestCallback | undefined;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      raf = cb;
      return 1;
    });

    render(<Harness draw={draw} />);
    // The loop was scheduled (motion allowed) but not yet run.
    expect(draw).not.toHaveBeenCalled();
    raf?.(16);
    expect(draw).toHaveBeenCalledTimes(1);
    expect(frame).toMatchObject({ reduceMotion: false });
    expect(typeof frame?.t).toBe("number");
    expect(typeof frame?.w).toBe("number");
    expect(typeof frame?.h).toBe("number");
  });

  it("honors reduced motion as a TRUE short-circuit — one static frame, no rAF loop", () => {
    setReducedMotion(true);
    let frame: CanvasFrame | undefined;
    const draw = vi.fn((_ctx, f: CanvasFrame) => {
      frame = f;
    });
    const raf = vi.spyOn(window, "requestAnimationFrame");

    render(<Harness draw={draw} />);

    // Painted exactly one static frame, and scheduled NO animation frame.
    expect(draw).toHaveBeenCalledTimes(1);
    expect(frame?.reduceMotion).toBe(true);
    expect(raf).not.toHaveBeenCalled();
  });

  it("continues animating across frames when motion is allowed", () => {
    setReducedMotion(false);
    const draw = vi.fn();
    let raf: FrameRequestCallback | undefined;
    const rafSpy = vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      raf = cb;
      return 1;
    });

    render(<Harness draw={draw} />);
    expect(rafSpy).toHaveBeenCalledTimes(1); // initial schedule
    raf?.(16); // run one frame → it reschedules the next
    expect(draw).toHaveBeenCalledTimes(1);
    expect(rafSpy).toHaveBeenCalledTimes(2); // loop continues
  });

  it("caps the device pixel ratio at 2× when sizing the backing store", () => {
    setReducedMotion(false);
    Object.defineProperty(window, "devicePixelRatio", { value: 3, configurable: true });
    vi.spyOn(HTMLCanvasElement.prototype, "getBoundingClientRect").mockReturnValue({
      width: 100,
      height: 50,
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 100,
      bottom: 50,
      toJSON: () => ({}),
    });

    const { getByTestId } = render(<Harness draw={() => {}} />);
    const canvas = getByTestId("cv") as HTMLCanvasElement;
    // 100 × min(3, 2) = 200, 50 × 2 = 100 — DPR capped at 2.
    expect(canvas.width).toBe(200);
    expect(canvas.height).toBe(100);
  });

  it("stops drawing after unmount — cancels the frame and ignores a late callback (RB-4)", () => {
    setReducedMotion(false);
    const draw = vi.fn();
    let raf: FrameRequestCallback | undefined;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      raf = cb;
      return 1;
    });
    const cancel = vi.spyOn(window, "cancelAnimationFrame");

    const { unmount } = render(<Harness draw={draw} />);
    unmount();
    expect(cancel).toHaveBeenCalled();

    // A frame callback that fires after unmount must not draw.
    draw.mockClear();
    raf?.(32);
    expect(draw).not.toHaveBeenCalled();
  });
});
