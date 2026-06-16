import type { ReactNode } from "react";

/**
 * Meter — a horizontal usage / progress bar, painted with the shipped
 * `@qball-inc/tokens` `.meter` classes from the `preview/stats-meters.html` oracle.
 *
 * A head row (label + readout) over a track/fill bar. Every visual comes from the
 * token CSS — `.meter` + `.meter__{head,label,val,track,fill}` + the `--warn`
 * (gold) / `--over` (red) threshold modifiers; there is no component CSS, no
 * hardcoded color, no box-shadow. The `.meter__track` 999px pill is the sanctioned
 * track carve-out — it lives in `components.css`, not here, so the component never
 * trips the ≤12px radius deny-rule (FR4).
 *
 * `value`/`max` drive the fill width (clamped 0–100%); `variant` selects the
 * threshold treatment. The track carries `role="meter"` + `aria-valuenow/min/max`.
 */

export type MeterVariant = "normal" | "warn" | "over";

export interface MeterProps {
  /** Current value (numerator). */
  value: number;
  /** Maximum (denominator). Default `100`. */
  max?: number;
  /** Eyebrow label (`.meter__label`). Optional. */
  label?: ReactNode;
  /** Readout text (`.meter__val`). Default `"{value} / {max}"`. */
  readout?: ReactNode;
  /** Threshold treatment: `warn` (gold fill) / `over` (red fill). Default `normal` (base `.meter`). */
  variant?: MeterVariant;
  /** Accessible name for the meter when `label` is not a plain string. */
  ariaLabel?: string;
  /** className merged onto the `.meter` root. */
  className?: string;
}

// variant -> shipped class. normal is the base `.meter` (no modifier).
const VARIANT_CLASS: Partial<Record<MeterVariant, string>> = {
  warn: "meter--warn",
  over: "meter--over",
};

export function Meter({
  value,
  max = 100,
  label,
  readout,
  variant = "normal",
  ariaLabel,
  className,
}: MeterProps) {
  const cls = ["meter", VARIANT_CLASS[variant], className].filter(Boolean).join(" ");
  // Clamp the fill to 0–100% of max; round to hundredths so floating-point
  // products (e.g. 0.42 * 100) don't leak into the inline width string.
  const raw = max > 0 ? (value / max) * 100 : 0;
  const pct = Math.round(Math.max(0, Math.min(100, raw)) * 100) / 100;
  const name = ariaLabel ?? (typeof label === "string" ? label : undefined);
  return (
    <div className={cls}>
      <div className="meter__head">
        {label !== undefined ? <span className="meter__label">{label}</span> : null}
        <span className="meter__val">{readout !== undefined ? readout : `${value} / ${max}`}</span>
      </div>
      <div
        className="meter__track"
        role="meter"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={name}
      >
        <div className="meter__fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
