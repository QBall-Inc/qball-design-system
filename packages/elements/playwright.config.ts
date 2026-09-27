import { defineConfig, devices } from "@playwright/test";

// Real-browser layer (plan AD-7): WebGL canvas behavior runs in headless
// Chromium, rendering through SwiftShader (software GL) so it works on CI
// runners with no GPU. Chromium only — the graph targets evergreen browsers and
// one engine keeps the CI browser install small.
export default defineConfig({
  testDir: "./e2e",
  forbidOnly: !!process.env["CI"],
  retries: 0,
  reporter: process.env["CI"] ? "github" : "list",
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
