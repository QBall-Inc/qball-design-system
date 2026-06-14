import { cleanup } from "@testing-library/react";
import { afterEach, beforeAll, vi } from "vitest";

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
});

// Unmount and clear the jsdom container after every test so multi-test files
// don't accumulate rendered DOM (otherwise getByRole finds duplicate elements).
afterEach(() => {
  cleanup();
});
