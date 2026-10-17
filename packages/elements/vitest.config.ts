import { defineConfig } from "vitest/config";
import { inlineWorkerVite } from "./inline-worker";

// Two test layers (plan AD-7). `node`: pure logic + the import-safety and
// entry-contents gates — no DOM, mirroring the Astro SSG build that imports this
// package. `jsdom`: DOM renderers, opted into by the `*.dom.test.ts` suffix.
// WebGL lives in real Chromium via Playwright (e2e/), not here. Both layers
// resolve the settle worker's inline source the way the build does.
export default defineConfig({
  plugins: [inlineWorkerVite()],
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          include: ["src/**/*.test.ts"],
          exclude: ["src/**/*.dom.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "jsdom",
          environment: "jsdom",
          include: ["src/**/*.dom.test.ts"],
        },
      },
    ],
  },
});
