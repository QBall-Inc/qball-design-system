// RQ-8 gate: './trust' and './chat' consumers must never pull three.js. Reads
// the BUILT output and follows each entry's relative imports (shared chunks), so
// a three reference hoisted into a shared chunk is caught too. './graph' is the
// positive control — it MUST reference three, proving the scan is not vacuous.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { type EntryName, distFile } from "./dist-paths";

const THREE_REF = /\bthree\b|\bTHREE\b/;
const RELATIVE_SPECIFIER =
  /(?:from\s*|import\s*\(\s*|require\s*\(\s*|import\s+)["'](\.{1,2}\/[^"']+)["']/g;

/** Every built file reachable from `entryFile` through relative imports. */
function reachableFiles(entryFile: string): string[] {
  const seen = new Set<string>();
  const queue = [entryFile];
  while (queue.length > 0) {
    const file = queue.pop();
    if (file === undefined || seen.has(file)) continue;
    seen.add(file);
    for (const match of readFileSync(file, "utf8").matchAll(RELATIVE_SPECIFIER)) {
      const specifier = match[1];
      if (specifier !== undefined) queue.push(resolve(dirname(file), specifier));
    }
  }
  return [...seen];
}

function referencesThree(entry: EntryName, format: "esm" | "cjs"): string[] {
  return reachableFiles(distFile(entry, format)).filter((file) =>
    THREE_REF.test(readFileSync(file, "utf8")),
  );
}

describe("per-entry contents (RQ-8)", () => {
  for (const format of ["esm", "cjs"] as const) {
    for (const entry of ["trust", "chat", "core"] as const) {
      it(`${format} '${entry}' output never references three`, () => {
        expect(referencesThree(entry, format)).toEqual([]);
      });
    }

    it(`${format} 'graph' output references three (positive control)`, () => {
      expect(referencesThree("graph", format)).not.toEqual([]);
    });
  }
});
