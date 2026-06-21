import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { render } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AsciiBg } from "./AsciiBg";
import { GlyphsBg } from "./GlyphsBg";
import { GridBg } from "./GridBg";

// vitest-canvas-mock records every operation on the 2D context. Assert on the
// recorded DRAW operations (the canvas's output), not on spy call-counts.
interface MockCtx extends CanvasRenderingContext2D {
  __getDrawCalls: () => Array<{ type: string }>;
}
function drawTypes(canvas: HTMLCanvasElement): string[] {
  const ctx = canvas.getContext("2d") as unknown as MockCtx;
  return ctx.__getDrawCalls().map((c) => c.type);
}

/** Give the canvas a non-zero box so the draw loop has area to paint. */
function stubSize(w = 240, h = 160): void {
  vi.spyOn(HTMLCanvasElement.prototype, "getBoundingClientRect").mockReturnValue({
    width: w,
    height: h,
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: w,
    bottom: h,
    toJSON: () => ({}),
  });
}

/** Capture (but do not auto-run) the animation frame callback. */
function captureFrame(): () => FrameRequestCallback | undefined {
  let frame: FrameRequestCallback | undefined;
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
    frame = cb;
    return 1;
  });
  return () => frame;
}

beforeEach(() => {
  // restoreAllMocks() (below) empties the global matchMedia vi.fn from the shared
  // setup, so re-establish it per test (motion allowed; the hook reads it on mount).
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
});

afterEach(() => {
  vi.restoreAllMocks();
  document.documentElement.removeAttribute("style"); // drop any test-set tokens
});

const SOURCE_DIR = resolve(process.cwd(), "src/primitives/backgrounds");
const readSource = (file: string): string => readFileSync(resolve(SOURCE_DIR, file), "utf8");

describe("canvas backgrounds — render + accessibility", () => {
  it.each([
    ["GridBg", GridBg],
    ["AsciiBg", AsciiBg],
    ["GlyphsBg", GlyphsBg],
  ])("%s renders a decorative aria-hidden <canvas>", (_name, Bg) => {
    const { getByTestId } = render(<Bg data-testid="bg" />);
    const canvas = getByTestId("bg");
    expect(canvas.tagName).toBe("CANVAS");
    expect(canvas.getAttribute("aria-hidden")).toBe("true");
  });

  it.each([
    ["GridBg", GridBg],
    ["AsciiBg", AsciiBg],
    ["GlyphsBg", GlyphsBg],
  ])("%s spreads standard canvas props (className/style) onto the element", (_name, Bg) => {
    const { getByTestId } = render(
      <Bg data-testid="bg" className="hero-bg" style={{ position: "absolute" }} />,
    );
    const canvas = getByTestId("bg") as HTMLCanvasElement;
    expect(canvas.classList.contains("hero-bg")).toBe(true);
    expect(canvas.style.position).toBe("absolute");
  });

  it.each([
    ["GridBg", GridBg],
    ["AsciiBg", AsciiBg],
    ["GlyphsBg", GlyphsBg],
  ])(
    "%s renders an inert <canvas> on the server with no render-time access (SSR-safe)",
    (_n, Bg) => {
      const html = renderToStaticMarkup(<Bg className="hero-bg" />);
      expect(html).toContain("<canvas");
      expect(html).toContain('aria-hidden="true"');
      expect(html).toContain('class="hero-bg"');
    },
  );
});

describe("canvas backgrounds — token-driven drawing", () => {
  it("GridBg paints dots when --color-signal is present", () => {
    document.documentElement.style.setProperty("--color-signal", "green");
    stubSize();
    const getFrame = captureFrame();
    const { getByTestId } = render(<GridBg data-testid="bg" />);
    getFrame()?.(16);
    expect(drawTypes(getByTestId("bg") as HTMLCanvasElement)).toContain("fill");
  });

  it("GridBg draws nothing when --color-signal is absent (token-only, no hardcoded fallback)", () => {
    stubSize();
    const getFrame = captureFrame();
    const { getByTestId } = render(<GridBg data-testid="bg" />);
    getFrame()?.(16);
    expect(drawTypes(getByTestId("bg") as HTMLCanvasElement)).not.toContain("fill");
  });

  it.each([
    ["AsciiBg", AsciiBg],
    ["GlyphsBg", GlyphsBg],
  ])("%s paints glyph text when signal + highlight tokens are present", (_name, Bg) => {
    document.documentElement.style.setProperty("--color-signal", "green");
    document.documentElement.style.setProperty("--color-highlight", "orange");
    stubSize();
    const getFrame = captureFrame();
    const { getByTestId } = render(<Bg data-testid="bg" />);
    getFrame()?.(16);
    expect(drawTypes(getByTestId("bg") as HTMLCanvasElement)).toContain("fillText");
  });

  it.each([
    ["AsciiBg", AsciiBg],
    ["GlyphsBg", GlyphsBg],
  ])("%s draws nothing when color tokens are absent (token-only)", (_name, Bg) => {
    stubSize();
    const getFrame = captureFrame();
    const { getByTestId } = render(<Bg data-testid="bg" />);
    getFrame()?.(16);
    expect(drawTypes(getByTestId("bg") as HTMLCanvasElement)).not.toContain("fillText");
  });
});

describe("canvas backgrounds — font discipline (no Berkeley Mono in the public DS)", () => {
  it("reads the display font from --font-display with a Fira Code public fallback", () => {
    const tokens = readSource("tokens.ts");
    expect(tokens).toContain("--font-display");
    expect(tokens).toContain("Fira Code");
  });

  it.each(["GridBg.tsx", "AsciiBg.tsx", "GlyphsBg.tsx", "tokens.ts"])(
    "%s names no 'Berkeley Mono' font (private-app-only face)",
    (file) => {
      expect(readSource(file)).not.toContain("Berkeley Mono");
    },
  );
});
