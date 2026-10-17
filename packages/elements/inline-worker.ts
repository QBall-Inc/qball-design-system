// Build-time answer to `import source from "./sim-worker.inline"` in
// src/graph: bundles src/graph/sim-worker-entry.ts (and what it imports) into
// one self-contained script and hands it over as a string, so the published
// './graph' output starts its settle worker from a blob URL with no extra file
// for consumers to copy. One bundling function, two plugin shapes: esbuild's
// for tsup (the package build) and vite's for vitest (tests import src).

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { build, type Plugin as EsbuildPlugin } from "esbuild";

const SPECIFIER = /(?:^|\/)sim-worker\.inline$/;
// tsup, vitest and tsc all run from the package directory (package.json scripts),
// so the entry resolves from there; the check below fails fast if one doesn't.
const ENTRY = resolve(process.cwd(), "src/graph/sim-worker-entry.ts");
const VIRTUAL_ID = "\0qb-sim-worker-inline";

/** The worker script as an ES module whose default export is its source text. */
async function workerModule(): Promise<string> {
  if (!existsSync(ENTRY)) {
    throw new Error(
      `inline-worker: ${ENTRY} not found. Run the build and tests from packages/elements (cwd is ${process.cwd()}).`,
    );
  }
  const result = await build({
    entryPoints: [ENTRY],
    bundle: true,
    write: false,
    format: "iife",
    platform: "browser",
    target: "es2022",
    minify: true,
    legalComments: "none",
  });
  const code = result.outputFiles[0]?.text;
  if (code === undefined) throw new Error(`inline-worker: esbuild produced no output for ${ENTRY}`);
  return `export default ${JSON.stringify(code)};\n`;
}

export function inlineWorkerEsbuild(): EsbuildPlugin {
  return {
    name: "qb-inline-sim-worker",
    setup(b) {
      b.onResolve({ filter: SPECIFIER }, () => ({ path: ENTRY, namespace: "qb-inline-worker" }));
      b.onLoad({ filter: /.*/, namespace: "qb-inline-worker" }, async () => ({
        contents: await workerModule(),
        loader: "js",
      }));
    },
  };
}

/** The vite plugin shape vitest accepts (structurally typed to avoid a direct vite dependency). */
export function inlineWorkerVite(): {
  name: string;
  enforce: "pre";
  resolveId(id: string): string | null;
  load(id: string): Promise<string> | null;
} {
  return {
    name: "qb-inline-sim-worker",
    enforce: "pre",
    resolveId: (id) => (SPECIFIER.test(id) ? VIRTUAL_ID : null),
    load: (id) => (id === VIRTUAL_ID ? workerModule() : null),
  };
}
