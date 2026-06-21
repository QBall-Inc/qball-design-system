/**
 * Runtime token reader for the canvas backgrounds. A `<canvas>` cannot reference a
 * `var(--token)` the way CSS does — it needs a concrete color string — so these
 * primitives resolve the design-system tokens at paint time via `getComputedStyle`.
 *
 * **Token-only, no hardcoded fallbacks (WP-B-4b.1, owner decision S91).** The
 * design system treats its token stylesheet as a hard import contract, and the
 * library keeps zero hardcoded color literals in component source (RB-8 / the
 * `DESIGN_DENY` lint rule). So a missing token resolves to an empty string and the
 * caller skips the draw, rather than falling back to a baked-in hex that could
 * drift from the token source of truth. The font is the one exception the rule
 * allows: a `font-family` string is not a color, so it carries a Fira Code public
 * default (which is exactly what `--font-display` ships as).
 */
export interface BackgroundStyles {
  /** `--color-signal` (sage) resolved, or `""` if the token stylesheet is absent. */
  signal: string;
  /** `--color-highlight` (amber) resolved, or `""`. */
  highlight: string;
  /** `--font-display` resolved, or the `"Fira Code", monospace` public default. */
  font: string;
}

/**
 * Reads the background tokens off `:root` at paint time. Called once per animation
 * frame (intentionally) so a host theme flip is reflected live; a single
 * `getComputedStyle` on the document element is cheap enough for a decorative
 * background.
 */
export function readBackgroundStyles(): BackgroundStyles {
  const cs = getComputedStyle(document.documentElement);
  const read = (name: string): string => cs.getPropertyValue(name).trim();
  return {
    signal: read("--color-signal"),
    highlight: read("--color-highlight"),
    font: read("--font-display") || '"Fira Code", monospace',
  };
}
