import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

// Serves both BUILT negative fixtures with Astro's preview server, one port
// each, and runs e2e/. Same Chromium + software-GL flags as fixtures/consumer-astro.
const ROOT = fileURLToPath(new URL(".", import.meta.url));
const server = (project, port) => ({
  // --ignore-lock: keep preview a foreground server (Astro 7 backgrounds it for AI agents).
  command: `pnpm exec astro preview --ignore-lock --host 127.0.0.1 --port ${port}`,
  cwd: `${ROOT}${project}`,
  url: `http://127.0.0.1:${port}/`,
  reuseExistingServer: false,
  timeout: 60_000,
});

export default defineConfig({
  testDir: "./e2e",
  forbidOnly: !!process.env["CI"],
  retries: 0,
  reporter: process.env["CI"] ? "github" : "list",
  webServer: [server("explorer-only", 4331), server("launcher-only", 4332)],
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
