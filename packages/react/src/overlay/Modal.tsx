import * as AlertDialog from "@radix-ui/react-alert-dialog";
import * as Dialog from "@radix-ui/react-dialog";
import { forwardRef } from "react";
import type { ComponentPropsWithoutRef, CSSProperties, ElementRef, ReactNode } from "react";

import { TriangleAlert, X } from "../icons/generated";

/**
 * Modal — accessible dialog built on Radix `Dialog` (standard) + `AlertDialog`
 * (destructive confirm), painted entirely with the shipped `@qball-inc/tokens`
 * classes (`.modal`, `.modal__head/title/sub/x/body/foot`, `.scrim`) from the
 * `preview/modal.html` oracle.
 *
 * Radix supplies the behavior — portalled content, focus-trap, body scroll-lock,
 * Escape-to-close, and overlay(scrim)-click-to-close — while the visual surface
 * is the token CSS. This is the same "Radix for behavior, shipped classes for
 * style" pattern as `Select`. There is NO component CSS and NO hardcoded color.
 *
 * The lift is the brand's no-shadow treatment: a heavier `--border-strong` panel
 * over a dim `.scrim` (`var(--color-scrim)`) — there is NO `box-shadow` anywhere
 * (FR4 / DESIGN.md). The only inline styles are structural (fixed-centering the
 * content, and the destructive warn badge tinted via `var(--data-down*)` tokens),
 * mirroring the oracle's own preview-local layout style — no hex, no shadow.
 *
 * Composition (matches the oracle):
 *   <Modal open={open} onOpenChange={setOpen}>
 *     <ModalContent aria-label="Create alert">
 *       <div className="modal__head">
 *         <div><ModalTitle>Create alert</ModalTitle><ModalDescription>AAPL</ModalDescription></div>
 *         <ModalClose />
 *       </div>
 *       <div className="modal__body">…</div>
 *       <div className="modal__foot">
 *         <ModalClose asChild><button className="btn btn--ghost">Cancel</button></ModalClose>
 *         <button className="btn btn--primary">Save</button>
 *       </div>
 *     </ModalContent>
 *   </Modal>
 *
 * `ModalContent` must contain a `ModalTitle` (Radix's a11y contract). For a
 * destructive confirmation, prefer the all-in-one `AlertModal`.
 */

// Structural-only: fixed-center the portalled content above the scrim. No brand
// values (no color/shadow/radius literals), so the DESIGN_DENY lint is satisfied.
// The 440px cap mirrors the form-dialog width in preview/modal.html (AlertModal
// overrides to 360px to match the narrower confirm-dialog oracle).
const CONTENT_STYLE: CSSProperties = {
  position: "fixed",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: "100%",
  maxWidth: "min(92vw, 440px)",
};

// The confirm dialog has no body, so its head carries extra bottom padding
// before the foot hairline — matches preview/modal.html's `padding-bottom:18px`.
const ALERT_HEAD_STYLE: CSSProperties = {
  paddingBottom: "18px",
};

// Destructive warn badge — token-tinted (var(--data-down*)), mirroring the
// oracle's preview-local `.icon-warn`. Structural layout + token refs only.
const WARN_BADGE_STYLE: CSSProperties = {
  flex: "none",
  width: "30px",
  height: "30px",
  display: "grid",
  placeItems: "center",
  borderRadius: "var(--radius-sm)",
  background: "var(--data-down-bg)",
  color: "var(--data-down)",
};

const ALERT_HEAD_ROW_STYLE: CSSProperties = {
  display: "flex",
  gap: "12px",
  alignItems: "flex-start",
};

/** Modal root — owns the open state. Thin alias of Radix `Dialog.Root`. */
export const Modal = Dialog.Root;

/** Opens the modal; wrap a custom trigger element with `asChild`. Alias of `Dialog.Trigger`. */
export const ModalTrigger = Dialog.Trigger;

export interface ModalContentProps extends ComponentPropsWithoutRef<typeof Dialog.Content> {
  /** Close when Escape is pressed. Default `true`; set `false` to suppress (AC-6). */
  closeOnEscape?: boolean;
  /** Close when the scrim/overlay is clicked. Default `true`; set `false` to suppress (AC-6). */
  closeOnOverlayClick?: boolean;
}

/**
 * The portalled dialog surface: a `.scrim` overlay + the `.modal` content panel,
 * fixed-centered. Must contain a `ModalTitle`. Escape / overlay-click close by
 * default; pass `closeOnEscape={false}` / `closeOnOverlayClick={false}` to suppress.
 */
export const ModalContent = forwardRef<ElementRef<typeof Dialog.Content>, ModalContentProps>(
  function ModalContent(
    {
      className,
      style,
      children,
      closeOnEscape = true,
      closeOnOverlayClick = true,
      onEscapeKeyDown,
      onPointerDownOutside,
      ...rest
    },
    ref,
  ) {
    return (
      <Dialog.Portal>
        {/*
          Scroll-lock is owned HERE by Radix Dialog's built-in react-remove-scroll
          (robust: scrollbar-width compensation, iOS, nested locks). This overlay already
          shares the `.scrim` class with the standalone <Scrim> atom; Scrim is
          the scroll-lock owner for NON-Radix / custom overlays. Intentionally NOT delegated
          to <Scrim> — replacing Radix's lock with a manual overflow:hidden would regress
          (D-07).
        */}
        <Dialog.Overlay className="scrim" />
        <Dialog.Content
          ref={ref}
          className={["modal", className].filter(Boolean).join(" ")}
          style={{ ...CONTENT_STYLE, ...style }}
          onEscapeKeyDown={(event) => {
            if (!closeOnEscape) event.preventDefault();
            onEscapeKeyDown?.(event);
          }}
          onPointerDownOutside={(event) => {
            if (!closeOnOverlayClick) event.preventDefault();
            onPointerDownOutside?.(event);
          }}
          {...rest}
        >
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    );
  },
);

/** Dialog title (`.modal__title`). Required inside `ModalContent` for accessibility. */
export const ModalTitle = forwardRef<
  ElementRef<typeof Dialog.Title>,
  ComponentPropsWithoutRef<typeof Dialog.Title>
>(function ModalTitle({ className, ...rest }, ref) {
  return (
    <Dialog.Title
      ref={ref}
      className={["modal__title", className].filter(Boolean).join(" ")}
      {...rest}
    />
  );
});

/** Dialog description / subtitle (`.modal__sub`). */
export const ModalDescription = forwardRef<
  ElementRef<typeof Dialog.Description>,
  ComponentPropsWithoutRef<typeof Dialog.Description>
>(function ModalDescription({ className, ...rest }, ref) {
  return (
    <Dialog.Description
      ref={ref}
      className={["modal__sub", className].filter(Boolean).join(" ")}
      {...rest}
    />
  );
});

/**
 * Closes the modal. Defaults to the `.modal__x` icon button (for the head);
 * pass `asChild` to style any element (e.g. a `.btn` Cancel in the footer).
 */
export const ModalClose = forwardRef<
  ElementRef<typeof Dialog.Close>,
  ComponentPropsWithoutRef<typeof Dialog.Close>
>(function ModalClose({ className, children, asChild, "aria-label": ariaLabel, ...rest }, ref) {
  if (asChild === true) {
    return (
      <Dialog.Close ref={ref} asChild {...rest}>
        {children}
      </Dialog.Close>
    );
  }
  return (
    <Dialog.Close
      ref={ref}
      className={["modal__x", className].filter(Boolean).join(" ")}
      aria-label={ariaLabel ?? "Close"}
      {...rest}
    >
      {children ?? <X size={16} />}
    </Dialog.Close>
  );
});

export interface AlertModalProps {
  /** Controlled open state. */
  open?: boolean;
  /** Uncontrolled initial open state. */
  defaultOpen?: boolean;
  /** Fired when the open state changes. */
  onOpenChange?: (open: boolean) => void;
  /** Optional trigger element (wrapped with `asChild`). Omit when controlling `open` externally. */
  trigger?: ReactNode;
  /** Confirmation title (required for accessibility). */
  title: ReactNode;
  /** Supporting copy explaining the consequence. */
  description?: ReactNode;
  /** Optional extra body content between the description and the action row. */
  children?: ReactNode;
  /** Label for the confirm action. Default `"Confirm"`. */
  confirmLabel?: string;
  /** Label for the cancel action. Default `"Cancel"`. */
  cancelLabel?: string;
  /** Fired when the confirm action is chosen (the dialog then closes). */
  onConfirm?: () => void;
  /** Style the confirm button as destructive + show the warn badge. Default `true`. */
  destructive?: boolean;
  /** Accessible name for the dialog surface. */
  "aria-label"?: string;
  /** Structural style overrides merged onto the content panel (e.g. `maxWidth`). */
  style?: CSSProperties;
}

/**
 * AlertModal — a destructive/blocking confirmation built on Radix `AlertDialog`
 * (Escape + overlay-click are intentionally NOT close-on-outside by Radix design;
 * the user must choose Cancel or Confirm). Matches the `preview/modal.html`
 * confirm-modal oracle: a warn badge + title + description and a ghost Cancel /
 * destructive Confirm action row.
 */
export function AlertModal({
  open,
  defaultOpen,
  onOpenChange,
  trigger,
  title,
  description,
  children,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  destructive = true,
  "aria-label": ariaLabel,
  style,
}: AlertModalProps) {
  return (
    // Conditional spread omits undefined props under exactOptionalPropertyTypes
    // (same idiom as Select's optional passthrough).
    <AlertDialog.Root
      {...(open !== undefined ? { open } : {})}
      {...(defaultOpen !== undefined ? { defaultOpen } : {})}
      {...(onOpenChange !== undefined ? { onOpenChange } : {})}
    >
      {trigger !== undefined ? <AlertDialog.Trigger asChild>{trigger}</AlertDialog.Trigger> : null}
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="scrim" />
        <AlertDialog.Content
          className="modal"
          style={{ ...CONTENT_STYLE, maxWidth: "min(92vw, 360px)", ...style }}
          aria-label={ariaLabel}
        >
          <div className="modal__head" style={ALERT_HEAD_STYLE}>
            <div style={ALERT_HEAD_ROW_STYLE}>
              {destructive ? (
                <span style={WARN_BADGE_STYLE} aria-hidden="true">
                  <TriangleAlert size={17} strokeWidth={1.6} />
                </span>
              ) : null}
              <div>
                <AlertDialog.Title className="modal__title">{title}</AlertDialog.Title>
                {description !== undefined ? (
                  <AlertDialog.Description className="modal__sub">
                    {description}
                  </AlertDialog.Description>
                ) : null}
              </div>
            </div>
          </div>
          {children !== undefined ? <div className="modal__body">{children}</div> : null}
          <div className="modal__foot">
            <AlertDialog.Cancel asChild>
              <button type="button" className="btn btn--ghost">
                {cancelLabel}
              </button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <button
                type="button"
                className={destructive ? "btn btn--destructive" : "btn btn--primary"}
                onClick={onConfirm}
              >
                {confirmLabel}
              </button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
