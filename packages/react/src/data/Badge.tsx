import type { ReactNode } from "react";

/**
 * Badge — a small status / finance pill, painted with the shipped
 * `@qball-inc/tokens` `.badge` classes (`components.css`) as shown in the
 * `preview/colors-data.html` oracle (and in context in `preview/data-table.html`
 * / the app-chrome previews).
 *
 * NOTE — this is the `.badge` finance/status pill, NOT the editorial `.tag`
 * (`preview/tags.html`, `colors_and_type.css`): those are two distinct shipped
 * components (SD1 finding D-09). Badge targets `.badge`, never `.tag`.
 *
 * Every visual comes from the token CSS — `.badge` + the `--*` variant modifiers
 * + the optional `.badge__dot`; there is no component CSS, no hardcoded color, no
 * box-shadow.
 *
 * Variants split into two families:
 * - **Semantic**: `neutral` (base `.badge`), `info`, `success`, `warning`, `error`.
 * - **Finance**: `up`, `down`, `flat`.
 *
 * Variant → shipped class (note the abbreviated `warn`, mirroring `Callout`):
 * `neutral` is the base `.badge` (no modifier); `warning` → `.badge--warn`;
 * `info`/`up`/`down` map to their existing classes; `success` → `.badge--success`,
 * `error` → `.badge--error`, and `flat` → `.badge--flat` are the WP-B-3.3 additions
 * to `components.css` (success = gain green, error = loss red, flat = neutral stone).
 *
 * **Finance variants pair color with a non-color cue (FR4 / RB-8).** `up`/`down`/
 * `flat` render a leading ▲/▼/— glyph so the finance color is never the sole
 * signal. Semantic variants carry their meaning in the label text.
 */

export type BadgeVariant =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "error"
  | "up"
  | "down"
  | "flat";

export interface BadgeProps {
  /** Semantic or finance treatment. Default `neutral` (base `.badge`). */
  variant?: BadgeVariant;
  /** Badge content. */
  children?: ReactNode;
  /** Render a leading status dot (`.badge__dot`). Default `false`. */
  dot?: boolean;
  /** className merged onto the `.badge` root. */
  className?: string;
}

// variant -> shipped class. neutral is the base `.badge` (no modifier).
const VARIANT_CLASS: Partial<Record<BadgeVariant, string>> = {
  info: "badge--info",
  success: "badge--success",
  warning: "badge--warn",
  error: "badge--error",
  up: "badge--up",
  down: "badge--down",
  flat: "badge--flat",
};

// Finance variants pair color with a directional non-color cue (FR4 / RB-8).
const FINANCE_CUE: Partial<Record<BadgeVariant, string>> = {
  up: "▲",
  down: "▼",
  flat: "—",
};

export function Badge({ variant = "neutral", children, dot = false, className }: BadgeProps) {
  const cls = ["badge", VARIANT_CLASS[variant], className].filter(Boolean).join(" ");
  const cue = FINANCE_CUE[variant];
  return (
    <span className={cls}>
      {dot ? <span className="badge__dot" /> : null}
      {cue !== undefined ? <span>{cue}</span> : null}
      {children}
    </span>
  );
}
