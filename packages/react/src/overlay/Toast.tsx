import { Toaster as SonnerToaster, toast as sonnerToast } from "sonner";
import type { ToasterProps } from "sonner";
import type { ReactNode } from "react";

import { CircleCheckBig, CircleX, Info, TriangleAlert, X } from "../icons/generated";

/**
 * Toast — transient notifications built on Sonner, painted with the shipped
 * `@qball-inc/tokens` `.toast` classes from the `preview/toast.html` oracle.
 *
 * Sonner supplies the behavior (imperative `toast()` API, top-anchored stacking,
 * auto-dismiss timer, reduced-motion handling) while every visual comes from the
 * token CSS: each toast renders the `.toast` / `.toast--{success,warning,error,
 * info}` markup with a `.toast__icon` (inline SVG, per the oracle), `.toast__body`
 * (`.toast__title` + `.toast__msg`), and a manual `.toast__x` close button. The
 * `<Toaster>` is rendered `unstyled` so Sonner contributes NO chrome of its own —
 * there is no component CSS, no hardcoded color, no box-shadow.
 *
 * Semantics ride the left-accent stripe (the shipped `.toast--*` border-left
 * color), never a background fill alone (finance-color-plus-cue, FR4): the icon
 * is the redundant non-color cue.
 *
 * Consumer setup: render `<Toaster />` once at the app root, then call
 * `toast.info("…")` / `.success` / `.warning` / `.error` from anywhere. Sonner is
 * bundled into this package, so its toast store is internal — always use this
 * re-exported `toast` + `Toaster` pair (a separately-installed `sonner` in the
 * consumer app would have its own store and would not register here).
 */

const DEFAULT_DURATION_MS = 4000;

type ToastVariant = "info" | "success" | "warning" | "error";

export interface ToastOptions {
  /** Secondary body line under the title (`.toast__msg`). */
  description?: ReactNode;
  /** Auto-dismiss duration in ms. Default 4000. Pass `Infinity` to require manual dismiss. */
  duration?: number;
  /** Accessible label for the close button. Default `"Dismiss"`. */
  dismissLabel?: string;
}

// Variant → B2 generated glyph (17px, stroke 1.6): success → circle-check-big,
// warning → triangle-alert, error → circle-x, info → info-circle. The icon is the
// FR4 non-color cue; the `.toast__icon` wrapper owns the semantic accent color.
function VariantIcon({ variant }: { variant: ToastVariant }) {
  switch (variant) {
    case "success":
      return <CircleCheckBig size={17} strokeWidth={1.6} />;
    case "warning":
      return <TriangleAlert size={17} strokeWidth={1.6} />;
    case "error":
      return <CircleX size={17} strokeWidth={1.6} />;
    case "info":
    default:
      return <Info size={17} strokeWidth={1.6} />;
  }
}

function ToastCard({
  variant,
  title,
  description,
  onDismiss,
  dismissLabel = "Dismiss",
}: {
  variant: ToastVariant;
  title: ReactNode;
  description?: ReactNode;
  onDismiss: () => void;
  dismissLabel?: string;
}) {
  // error is assertive; the rest are polite status updates.
  const role = variant === "error" ? "alert" : "status";
  return (
    <div className={`toast toast--${variant}`} role={role}>
      <span className="toast__icon">
        <VariantIcon variant={variant} />
      </span>
      <div className="toast__body">
        <p className="toast__title">{title}</p>
        {description !== undefined ? <p className="toast__msg">{description}</p> : null}
      </div>
      <button type="button" className="toast__x" aria-label={dismissLabel} onClick={onDismiss}>
        <X size={14} strokeWidth={1.6} />
      </button>
    </div>
  );
}

function show(variant: ToastVariant, title: ReactNode, options?: ToastOptions): string | number {
  return sonnerToast.custom(
    (id) => (
      <ToastCard
        variant={variant}
        title={title}
        {...(options?.description !== undefined ? { description: options.description } : {})}
        {...(options?.dismissLabel !== undefined ? { dismissLabel: options.dismissLabel } : {})}
        onDismiss={() => {
          sonnerToast.dismiss(id);
        }}
      />
    ),
    { duration: options?.duration ?? DEFAULT_DURATION_MS },
  );
}

/**
 * Imperative toast API. Each variant maps to a shipped `.toast--*` accent stripe
 * + matching icon. Returns the toast id (pass to `toast.dismiss(id)`).
 */
export const toast = {
  info: (title: ReactNode, options?: ToastOptions) => show("info", title, options),
  success: (title: ReactNode, options?: ToastOptions) => show("success", title, options),
  warning: (title: ReactNode, options?: ToastOptions) => show("warning", title, options),
  error: (title: ReactNode, options?: ToastOptions) => show("error", title, options),
  /** Dismiss a specific toast by id, or all toasts when called with no id. */
  dismiss: (id?: string | number) => sonnerToast.dismiss(id),
};

/**
 * Toast provider. Render once at the app root. Defaults to `top-center` (FR /
 * AC-7) and `unstyled` toasts so the shipped `.toast` classes own all visuals;
 * any `ToasterProps` may be overridden (e.g. `visibleToasts`, `expand`). Keep
 * `unstyled` on — overriding it to `false` re-enables Sonner's default card
 * chrome and breaks the token styling.
 */
export function Toaster({ position = "top-center", toastOptions, ...rest }: ToasterProps) {
  return (
    <SonnerToaster
      position={position}
      toastOptions={{ unstyled: true, ...toastOptions }}
      {...rest}
    />
  );
}

export type { ToasterProps };
