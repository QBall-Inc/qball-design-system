// Plan AD-6 gate: every public entry must be importable in a DOM-less Node
// runtime (the Astro SSG build) WITHOUT touching a browser global at module
// evaluation. Runs against the BUILT output — what consumers actually load.
import { createRequire } from "node:module";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ENTRIES, distFile } from "./dist-paths";

// Browser-only globals a module could reach for at evaluation time. Any name
// Node itself already defines is left alone (not a browser-only signal).
const BROWSER_GLOBALS = [
  "window",
  "document",
  "self",
  "HTMLElement",
  "customElements",
  "matchMedia",
  "requestAnimationFrame",
  "getComputedStyle",
  "devicePixelRatio",
  "localStorage",
  "sessionStorage",
] as const;

let touched: Set<string>;
let trapped: string[];

beforeEach(() => {
  touched = new Set();
  trapped = BROWSER_GLOBALS.filter((name) => !(name in globalThis));
  for (const name of trapped) {
    Object.defineProperty(globalThis, name, {
      configurable: true,
      get() {
        touched.add(name);
        return undefined;
      },
    });
  }
});

afterEach(() => {
  for (const name of trapped) {
    Reflect.deleteProperty(globalThis, name);
  }
});

describe("import safety (AD-6)", () => {
  it("detects a module that touches a browser global (negative control)", async () => {
    const dir = mkdtempSync(join(tmpdir(), "elements-import-safety-"));
    try {
      const probe = join(dir, "touches-window.mjs");
      writeFileSync(probe, "export const hasWindow = typeof window !== 'undefined';\n");
      await import(pathToFileURL(probe).href);
      expect([...touched]).toEqual(["window"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  for (const entry of ENTRIES) {
    it(`ESM '${entry}' entry imports without a DOM and touches no browser global`, async () => {
      const mod = (await import(pathToFileURL(distFile(entry, "esm")).href)) as { ENTRY: unknown };
      expect(mod.ENTRY).toBe(entry);
      expect([...touched]).toEqual([]);
    });

    it(`CJS '${entry}' entry requires without a DOM and touches no browser global`, () => {
      const require = createRequire(distFile(entry, "cjs"));
      const mod = require(distFile(entry, "cjs")) as { ENTRY: unknown };
      expect(mod.ENTRY).toBe(entry);
      expect([...touched]).toEqual([]);
    });
  }
});
