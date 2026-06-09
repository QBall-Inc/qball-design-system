import { defineConfig } from "tsup";

// Dual ESM/CJS build + TypeScript declarations (RB-3 gate). Peer dependencies
// are externalized so consumer-installed singletons (react/react-dom) and large
// optional peers (d3, lucide-react) are never inlined into the bundle. The dts
// pass uses tsconfig.build.json (test files excluded from the public types).
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  tsconfig: "./tsconfig.build.json",
  external: ["react", "react-dom", /^@radix-ui\//, "lucide-react", "d3"],
  clean: true,
  treeshake: true,
  sourcemap: true,
  target: "es2022",
  outExtension: ({ format }) => ({ js: format === "cjs" ? ".cjs" : ".js" }),
});
