// Generates fixtures/qubrain/mock-bundle.with-layout.json: the fixture of
// record (mock-bundle.json, never modified) plus a `layout` computed by the
// package's own seeded simulation. Deterministic: two runs write identical
// bytes. Also prints the simulation's wall-clock time under plain Node (the
// baseline recorded in docs/qubrain-graph-sim-baseline.md).
//
// The graph logic is TypeScript inside the package, so it is bundled to a
// temporary ES module with esbuild (a root devDependency) and imported from
// there. Run via `just elements-layout-fixture`.

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../..");
const source = join(repoRoot, "fixtures/qubrain/mock-bundle.json");
const target = join(repoRoot, "fixtures/qubrain/mock-bundle.with-layout.json");

const workDir = mkdtempSync(join(tmpdir(), "elements-layout-"));
try {
  const logicFile = join(workDir, "logic.mjs");
  await build({
    entryPoints: [resolve(here, "../src/graph/logic.ts")],
    bundle: true,
    format: "esm",
    platform: "node",
    outfile: logicFile,
    logLevel: "warning",
  });
  const { resolvePositions } = await import(pathToFileURL(logicFile).href);

  const bundle = JSON.parse(readFileSync(source, "utf8"));
  if (bundle.layout !== null) {
    throw new Error(
      `${source} already carries a layout; expected the fixture of record (layout: null)`,
    );
  }

  const started = performance.now();
  const { positions, source: from } = resolvePositions(bundle);
  const elapsedMs = performance.now() - started;
  if (from !== "simulated") throw new Error(`expected a simulated layout, got ${from}`);

  const layout = {};
  bundle.nodes.forEach((node, i) => {
    layout[String(node.id)] = [positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]];
  });
  const derived = {
    ...bundle,
    _note: `DERIVED by packages/elements/scripts/generate-with-layout-fixture.mjs from mock-bundle.json (layout = the package's seeded simulation for revision ${bundle.revision}). Do not edit by hand. Original note: ${bundle._note ?? "(none)"}`,
    layout,
  };
  writeFileSync(target, JSON.stringify(derived));

  console.log(`wrote ${target}`);
  console.log(
    `nodes=${bundle.nodes.length} typed=${bundle.typed_edges.length} comention=${bundle.comention_edges.length} sim_ms=${elapsedMs.toFixed(0)} node=${process.version}`,
  );
} finally {
  rmSync(workDir, { recursive: true, force: true });
}
