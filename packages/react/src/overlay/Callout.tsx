import type { ReactNode } from "react";

import { CircleX, Info, TriangleAlert, X } from "../icons/generated";

/**
 * Callout — inline banner / message surface, painted with the shipped
 * `@qball-inc/tokens` `.callout` classes from the `preview/banner.html` oracle.
 *
 * This is a purely presentational component (no behavioral library): a tinted
 * semantic surface with an accent edge, a leading icon (the redundant non-color
 * cue — finance-color-plus-cue, FR4), an optional title, and a `children` body
 * slot. Every visual comes from the token CSS — `.callout` / `.callout--{warn,
 * error,neutral}` / `.callout__{icon,body,title,msg,x}`; there is no component
 * CSS, no hardcoded color, no box-shadow.
 *
 * Callout is the DESIGNATED HOST for app-level disclaimers (the persistent v1
 * "not financial advice" notice, rate-limit / degraded-data warnings). The
 * `children` slot accepts rich inline content (text, links, inline elements) so
 * a disclaimer can carry a "read more" link. The `neutral` variant is the home
 * for non-urgent informational disclaimers.
 *
 * Variant → shipped class (note the abbreviated `warn`): `info` is the base
 * `.callout` (no modifier), `warning` → `.callout--warn`, `error` →
 * `.callout--error`, `neutral` → `.callout--neutral`.
 */
export type CalloutVariant = "info" | "warning" | "error" | "neutral";

export interface CalloutProps {
  /** Semantic treatment. Default `info` (the base `.callout`). */
  variant?: CalloutVariant;
  /** Optional bold lead line (`.callout__title`). */
  title?: ReactNode;
  /** Body content (`.callout__msg`) — rich inline content allowed (links, etc.). */
  children?: ReactNode;
  /** Render a dismiss (`.callout__x`) button. Default `false` (disclaimers are persistent). */
  dismissible?: boolean;
  /** Fired when the dismiss button is clicked. */
  onDismiss?: () => void;
  /** Accessible label for the dismiss button. Default `"Dismiss"`. */
  dismissLabel?: string;
  /** Render the leading semantic icon. Default `true`. */
  icon?: boolean;
  /** className merged onto the `.callout` root. */
  className?: string;
}

// info is the base `.callout` (no modifier — hence omitted here, so its lookup
// is `undefined` and drops out of the className join); the rest are abbreviated
// to match the shipped class names.
const VARIANT_CLASS: Partial<Record<CalloutVariant, string>> = {
  warning: "callout--warn",
  error: "callout--error",
  neutral: "callout--neutral",
};

// error is assertive; warning/info are polite status; neutral is a passive note.
const VARIANT_ROLE: Record<CalloutVariant, "status" | "alert" | "note"> = {
  info: "status",
  warning: "status",
  error: "alert",
  neutral: "note",
};

// Variant → B2 generated glyph (17px, stroke 1.6): warning → triangle-alert,
// error → circle-x, info + neutral share the info-circle. The leading icon is the
// FR4 non-color cue; the wrapper (`.callout__icon`) owns the semantic color.
function CalloutIcon({ variant }: { variant: CalloutVariant }) {
  if (variant === "warning") return <TriangleAlert size={17} strokeWidth={1.6} />;
  if (variant === "error") return <CircleX size={17} strokeWidth={1.6} />;
  return <Info size={17} strokeWidth={1.6} />;
}

export function Callout({
  variant = "info",
  title,
  children,
  dismissible = false,
  onDismiss,
  dismissLabel = "Dismiss",
  icon = true,
  className,
}: CalloutProps) {
  const cls = ["callout", VARIANT_CLASS[variant], className].filter(Boolean).join(" ");
  return (
    <div className={cls} role={VARIANT_ROLE[variant]}>
      {icon ? (
        <span className="callout__icon">
          <CalloutIcon variant={variant} />
        </span>
      ) : null}
      <div className="callout__body">
        {title !== undefined ? <p className="callout__title">{title}</p> : null}
        {children !== undefined ? <p className="callout__msg">{children}</p> : null}
      </div>
      {dismissible ? (
        <button type="button" className="callout__x" aria-label={dismissLabel} onClick={onDismiss}>
          <X size={14} strokeWidth={1.6} />
        </button>
      ) : null}
    </div>
  );
}
