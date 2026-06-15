import type { ReactNode } from "react";

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

function CalloutIcon({ variant }: { variant: CalloutVariant }) {
  const common = {
    width: 17,
    height: 17,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (variant === "warning") {
    return (
      <svg {...common}>
        <path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3Z" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
      </svg>
    );
  }
  if (variant === "error") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="10" />
        <path d="m15 9-6 6" />
        <path d="m9 9 6 6" />
      </svg>
    );
  }
  // info + neutral share the info-circle glyph.
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
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
          <CloseIcon />
        </button>
      ) : null}
    </div>
  );
}
