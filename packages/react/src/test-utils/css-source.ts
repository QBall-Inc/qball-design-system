import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Shared CSS-source-contract test helpers (WP-B-3.5; extracted per S79 LINT-F01).
 *
 * jsdom does not load external stylesheets, so token / @media / animation rules
 * shipped in `@qball-inc/tokens` cannot be asserted via `getComputedStyle`. The
 * contract is instead verified against the CSS SOURCE read from disk: a DOM test
 * asserts the component applies the right class/attribute, and a source test
 * asserts the shipped rule maps that selector to the right token.
 *
 * vitest runs with cwd = `packages/react` (the package dir), so the sibling
 * tokens package resolves at `../tokens/components.css`. Resolving from
 * `process.cwd()` (not `import.meta.url`) avoids the vitest `fileURLToPath`
 * runner trap.
 */
export const componentsCss = readFileSync(
  resolve(process.cwd(), "../tokens/components.css"),
  "utf8",
);

/** Sibling read of the framework-agnostic token base (drop-in `--data-*` / element styles). */
export const colorsCss = readFileSync(
  resolve(process.cwd(), "../tokens/colors_and_type.css"),
  "utf8",
);

/** Returns the declaration body of the first `selector { ... }` rule, or "". */
export function ruleBody(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`).exec(css);
  return match?.[1] ?? "";
}
