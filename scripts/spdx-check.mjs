// scripts/spdx-check.mjs — NET-NEW pack-license / SPDX assertion (WP-B-4b.2, §12).
//
// Distinct from scripts/license-check.sh (a FONT-BINARY leak scanner that neither
// trips on nor validates a code dependency). This gate grounds the icon system's
// third-party provenance so it cannot silently drift:
//
//   1. The icon-pack devDeps are EXACT-pinned (no ^/~ range) — a pinned SPDX claim.
//   2. The installed packs carry the declared SPDX license (lucide ISC, simple-icons CC0-1.0).
//   3. Every codegen component carries the right provenance header for its source pack.
//   4. Every hand-authored brand asset carries a nominative-use note (→ MARKS.md).
//   5. MARKS.md ships with the package (listed in `files`).
//
// Fail-fast: any violation prints an actionable error and exits 1.

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const REACT = join(ROOT, "packages", "react");
const ICONS = join(REACT, "src", "icons");

/** The pinned icon source packs: dep name → expected SPDX license id. */
const PACKS = {
  "lucide-react": "ISC",
  "simple-icons": "CC0-1.0",
};

const failures = [];
const fail = (msg) => failures.push(msg);

const reactPkg = JSON.parse(readFileSync(join(REACT, "package.json"), "utf8"));
const devDeps = reactPkg.devDependencies ?? {};

// 1 + 2 — each pack is exact-pinned AND installed with the declared license.
for (const [dep, expectedLicense] of Object.entries(PACKS)) {
  const spec = devDeps[dep];
  if (!spec) {
    fail(`devDependency "${dep}" is missing from packages/react/package.json.`);
    continue;
  }
  if (!/^\d+\.\d+\.\d+$/.test(spec)) {
    fail(`devDependency "${dep}" must be EXACT-pinned (a pinned SPDX claim), got "${spec}".`);
  }
  const installedPkgPath = join(REACT, "node_modules", dep, "package.json");
  if (!existsSync(installedPkgPath)) {
    fail(`"${dep}" is not installed (expected ${installedPkgPath}).`);
    continue;
  }
  const installed = JSON.parse(readFileSync(installedPkgPath, "utf8"));
  if (installed.license !== expectedLicense) {
    fail(
      `"${dep}@${installed.version}" license is "${installed.license}", expected "${expectedLicense}".`,
    );
  }
}

/** Every .tsx file directly under a generated/<track> dir. */
const genFiles = (track) => {
  const dir = join(ICONS, "generated", track);
  return existsSync(dir)
    ? readdirSync(dir)
        .filter((f) => f.endsWith(".tsx"))
        .map((f) => join(dir, f))
    : [];
};

// 3 — codegen provenance headers: ui+ai cite lucide ISC; brand cites simple-icons CC0.
// Named (not positional) so the brand-count guard + success log below can't silently
// bind to the wrong track if a third pack is ever added or the order shifts.
const lucideHeaders = {
  files: [...genFiles("ui"), ...genFiles("ai")],
  needle: "lucide-react@",
  spdx: "(ISC)",
};
const simpleIconsHeaders = {
  files: genFiles("brand"),
  needle: "simple-icons@",
  spdx: "(CC0-1.0)",
};
const headerExpectations = [lucideHeaders, simpleIconsHeaders];
for (const { files, needle, spdx } of headerExpectations) {
  for (const file of files) {
    const head = readFileSync(file, "utf8").split("\n")[0];
    if (!head.includes(needle) || !head.includes(spdx)) {
      fail(`${file}: missing provenance header (expected "${needle}…${spdx}"), got: ${head}`);
    }
  }
}
if (simpleIconsHeaders.files.length === 0) {
  fail("No generated brand marks found — the simple-icons codegen produced nothing.");
}

// 4 — hand-authored brand assets carry a nominative-use note pointing at MARKS.md.
const brandDir = join(ICONS, "brand");
const assetFiles = existsSync(brandDir)
  ? readdirSync(brandDir)
      .filter((f) => f.endsWith(".tsx"))
      .map((f) => join(brandDir, f))
  : [];
for (const file of assetFiles) {
  if (!readFileSync(file, "utf8").includes("MARKS.md")) {
    fail(
      `${file}: hand-authored brand asset must carry a nominative-use note referencing MARKS.md.`,
    );
  }
}

// 5 — MARKS.md exists and ships with the package.
if (!existsSync(join(REACT, "MARKS.md"))) {
  fail("packages/react/MARKS.md is missing (the trademark/nominative-use disclaimer).");
} else if (!(reactPkg.files ?? []).includes("MARKS.md")) {
  fail('MARKS.md exists but is not in packages/react/package.json "files" — it would not ship.');
}

if (failures.length) {
  console.error(`spdx-check FAILED — ${failures.length} issue(s):\n  ${failures.join("\n  ")}`);
  process.exit(1);
}
console.log(
  `spdx-check OK — packs pinned + licensed (${Object.keys(PACKS).join(", ")}); ` +
    `${lucideHeaders.files.length} lucide + ${simpleIconsHeaders.files.length} simple-icons headers; ` +
    `${assetFiles.length} nominative assets; MARKS.md ships.`,
);
