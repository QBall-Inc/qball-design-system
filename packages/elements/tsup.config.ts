import { defineConfig } from "tsup";
import { inlineWorkerEsbuild } from "./inline-worker";

// Dual ESM/CJS build + TypeScript declarations for the four public entries
// ('.', './trust', './chat', './graph'). Entry keys become the dist paths
// (e.g. dist/trust/index.js). `three` is an optional peer loaded by a dynamic
// import() inside './graph' only — externalized so it is never inlined, and so
// './trust' / './chat' output never references it (checked by
// src/entry-contents.test.ts). The graph's settle worker is bundled into
// './graph' as a string by inline-worker.ts.
export default defineConfig({
  entry: {
    index: "src/index.ts",
    "trust/index": "src/trust/index.ts",
    "chat/index": "src/chat/index.ts",
    "graph/index": "src/graph/index.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  tsconfig: "./tsconfig.build.json",
  external: ["three"],
  esbuildPlugins: [inlineWorkerEsbuild()],
  clean: true,
  treeshake: true,
  sourcemap: true,
  target: "es2022",
  outExtension: ({ format }) => ({ js: format === "cjs" ? ".cjs" : ".js" }),
});
