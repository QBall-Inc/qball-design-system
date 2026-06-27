import { cleanup } from "@testing-library/react";
import { afterEach, beforeAll, vi } from "vitest";

// These are jsdom-only environment shims. A few test files opt into the `node`
// environment via `// @vitest-environment node` (e.g. the esbuild tree-shake
// build test, which needs real Node globals and touches no DOM); those have no
// `window`, so skip the DOM shims rather than crash on `window`/`Element`.
if (typeof window !== "undefined") {
  // Canvas 2D context mock — jsdom does not implement HTMLCanvasElement.getContext,
  // so it returns null and the canvas-background primitives' useCanvas2D hook would
  // no-op (its null-context guard). This shim provides a recording 2D context so the
  // draw loop actually runs in tests. It is a test-only environment shim
  // (a dev dependency), not a stand-in for any system under test (T1).
  await import("vitest-canvas-mock");

  // Radix Select relies on browser APIs jsdom does not implement (pointer capture,
  // scrollIntoView, ResizeObserver). Polyfill them so the Select keyboard-nav tests
  // drive the REAL Radix behavior (AC-2) rather than mocking the component under
  // test (T1). These are environment shims, not stand-ins for the SUT.
  beforeAll(() => {
    Element.prototype.hasPointerCapture = vi.fn(() => false);
    Element.prototype.setPointerCapture = vi.fn();
    Element.prototype.releasePointerCapture = vi.fn();
    Element.prototype.scrollIntoView = vi.fn();
    globalThis.ResizeObserver = class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    };
    // Sonner (Toast) reads matchMedia for prefers-reduced-motion / theme; jsdom
    // does not implement it. Shim a non-matching query so the real Sonner runtime
    // mounts (T1 — environment shim, not a stand-in for the SUT).
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

  // Unmount and clear the jsdom container after every test so multi-test files
  // don't accumulate rendered DOM (otherwise getByRole finds duplicate elements).
  afterEach(() => {
    cleanup();
  });
}
