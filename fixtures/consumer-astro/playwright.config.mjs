import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

// Serves the BUILT static site with Astro's own preview server and runs every
// spec under e2e/. Chromium only, with the same software-GL flags as
// @qball-inc/elements so later graph pages run on GPU-less CI runners.
const FIXTURE_DIR = fileURLToPath(new URL(".", import.meta.url));
const PORT = 4329;

export default defineConfig({
  testDir: "./e2e",
  forbidOnly: !!process.env["CI"],
  retries: 0,
  reporter: process.env["CI"] ? "github" : "list",
  use: { baseURL: `http://127.0.0.1:${PORT}` },
  webServer: {
    // --ignore-lock keeps preview a foreground one-off server. Astro 7 otherwise
    // detaches it into the background when it detects an AI coding agent, which
    // Playwright can neither wait on nor stop.
    command: `pnpm exec astro preview --ignore-lock --host 127.0.0.1 --port ${PORT}`,
    cwd: FIXTURE_DIR,
    url: `http://127.0.0.1:${PORT}/light/`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
        },
      },
    },
  ],
});
