import { defineConfig } from "vitest/config";

// Two test layers (plan AD-7). `node`: pure logic + the import-safety and
// entry-contents gates — no DOM, mirroring the Astro SSG build that imports this
// package. `jsdom`: DOM renderers, opted into by the `*.dom.test.ts` suffix.
// WebGL lives in real Chromium via Playwright (e2e/), not here.
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "node",
          environment: "node",
          include: ["src/**/*.test.ts"],
          exclude: ["src/**/*.dom.test.ts"],
        },
      },
      {
        test: {
          name: "jsdom",
          environment: "jsdom",
          include: ["src/**/*.dom.test.ts"],
        },
      },
    ],
  },
});
