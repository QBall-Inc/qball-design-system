import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// jsdom environment so React components can render to a real DOM in tests
// (AC-10). The React plugin wires the automatic JSX runtime for .tsx test files.
// setupFiles registers Testing Library's afterEach(cleanup) so multi-test files
// don't leak rendered DOM between cases.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
  },
});
