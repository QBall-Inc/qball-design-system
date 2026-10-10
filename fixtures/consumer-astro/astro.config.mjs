// Static output, matching the site this harness stands in for. Stylesheets
// are always emitted as files (never inlined) so the gate can read the bundled
// CSS and prove the three token files land in their locked order.
import { defineConfig } from "astro/config";

export default defineConfig({
  output: "static",
  build: { inlineStylesheets: "never" },
});
