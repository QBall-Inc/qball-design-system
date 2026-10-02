// Playwright config for the gallery deploy gate (plan AD-7): drives the STAGED
// _site (built by scripts/build-pages-site.sh) in headless Chromium with
// SwiftShader software GL, so it runs on GPU-less CI runners. Repo-level and
// separate from packages/elements/playwright.config.ts, which tests the package
// itself. The site is served by Python's built-in static server.
import { defineConfig, devices } from "@playwright/test";

const PORT = 8124;

export default defineConfig({
  testDir: "./e2e-pages",
  testMatch: "**/*.spec.mjs",
  outputDir: "test-results/pages",
  forbidOnly: !!process.env["CI"],
  retries: 0,
  reporter: process.env["CI"] ? "github" : "list",
  use: { baseURL: `http://127.0.0.1:${PORT}` },
  webServer: {
    command: `python3 -m http.server ${PORT} --bind 127.0.0.1 --directory _site`,
    url: `http://127.0.0.1:${PORT}/index.html`,
    reuseExistingServer: false,
    timeout: 30_000,
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
