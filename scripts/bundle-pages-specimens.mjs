// scripts/bundle-pages-specimens.mjs — bundle the gallery's live specimens.
//
// Each specimen is a small browser entry that imports the BUILT
// @qball-inc/elements output (packages/elements/dist). esbuild bundles each one
// into a single self-contained ES module under _site/specimens/, with every
// dependency (incl. the optional `three` peer, which the elements graph entry
// loads lazily) inlined — no bare-module import ever reaches the browser.
//
// ENTRY-LIST driven: add a specimen by appending { name, entry } below. Keep
// trust/chat-only specimens free of the `./graph` entry so they never inline
// three.
//
// Invoked by scripts/build-pages-site.sh after staging (needs a prior
// `pnpm --filter @qball-inc/elements build`). Output is ephemeral (_site/).
import { existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { build } from "esbuild";

const ROOT = resolve(import.meta.dirname, "..");
const OUT_DIR = join(ROOT, "_site", "specimens");
const ELEMENTS_DIST = join(ROOT, "packages", "elements", "dist", "index.js");

const SPECIMENS = [{ name: "graph-smoke", entry: "specimens/graph-smoke.entry.mjs" }];

if (!existsSync(ELEMENTS_DIST)) {
  console.error(
    `FATAL: ${ELEMENTS_DIST} not found — run \`pnpm --filter @qball-inc/elements build\` before bundling specimens.`,
  );
  process.exit(1);
}

mkdirSync(OUT_DIR, { recursive: true });
for (const { name, entry } of SPECIMENS) {
  const outfile = join(OUT_DIR, `${name}.bundle.js`);
  await build({
    entryPoints: [join(ROOT, entry)],
    outfile,
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "es2022",
    minify: true,
    logLevel: "warning",
  });
  console.log(`bundle-pages-specimens: ${entry} -> ${outfile.slice(ROOT.length + 1)}`);
}
