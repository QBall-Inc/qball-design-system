// Test-support: resolves the built dist/ entry files. Tests run from the
// package directory (`pnpm --filter @qball-inc/elements test`), so paths are
// anchored on process.cwd() — import.meta.url is not usable under vitest.
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

export const ENTRIES = ["core", "trust", "chat", "graph"] as const;
export type EntryName = (typeof ENTRIES)[number];

export const DIST_DIR = resolve(process.cwd(), "dist");

/** Absolute path of an entry's built file for the given module format. */
export function distFile(entry: EntryName, format: "esm" | "cjs"): string {
  const ext = format === "esm" ? "js" : "cjs";
  const file =
    entry === "core" ? join(DIST_DIR, `index.${ext}`) : join(DIST_DIR, entry, `index.${ext}`);
  if (!existsSync(file)) {
    throw new Error(
      `Built entry not found: ${file}. Run the package test script (it builds first) from packages/elements.`,
    );
  }
  return file;
}
