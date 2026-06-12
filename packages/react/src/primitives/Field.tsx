import { cloneElement, useId } from "react";
import type { InputHTMLAttributes, ReactElement } from "react";

/**
 * Field — label + control + helper/error composition wrapper.
 *
 * Renders the shipped `.field` structure from `@qball-inc/tokens`
 * (`components.css`), matching the `preview/form-controls.html` oracle: a
 * `.field__label` associated to the control via `htmlFor`/`id`, optional
 * `.field__help`, and a `.field__error` with `role="alert"`. When `errorText`
 * is present it sets `aria-invalid` on the child control (which in turn applies
 * the `.input--error` border) and points `aria-describedby` at the messages.
 * No component CSS, no hex.
 */
type FieldControl = ReactElement<{
  id?: string;
  "aria-invalid"?: InputHTMLAttributes<HTMLInputElement>["aria-invalid"];
  "aria-describedby"?: string | undefined;
}>;

export interface FieldProps {
  /** Visible label text, associated to the control. */
  label: string;
  /** Optional helper text shown below the control (`aria-describedby`). */
  helpText?: string;
  /** Optional error text; when set, marks the control invalid and renders a `role="alert"` message. */
  errorText?: string;
  /** Render a required marker (`*`) after the label. */
  required?: boolean;
  /** The control element (typically an `Input`); receives `id`, `aria-invalid`, and `aria-describedby`. */
  children: FieldControl;
}

export function Field({ label, helpText, errorText, required, children }: FieldProps) {
  const baseId = useId();
  const controlId = `${baseId}-control`;
  const helpId = helpText !== undefined ? `${baseId}-help` : undefined;
  const errorId = errorText !== undefined ? `${baseId}-error` : undefined;

  const ownDescribedBy = [errorId, helpId]
    .filter((v): v is string => v !== undefined && v !== "")
    .join(" ");
  const childDescribedBy = children.props["aria-describedby"];
  const describedBy =
    [childDescribedBy, ownDescribedBy]
      .filter((v): v is string => v !== undefined && v !== "")
      .join(" ") || undefined;

  // cloneElement is the minimal composition seam for injecting the wiring onto
  // the control. It erodes the child's static prop types (the child is typed as
  // the FieldControl subset, not the full control interface), so the injected
  // props are validated against FieldControl above rather than the child's own
  // type. No runtime risk; a Context/render-prop migration is tracked tech-debt.
  const control = cloneElement(children, {
    id: controlId,
    "aria-invalid": errorText !== undefined ? true : children.props["aria-invalid"],
    "aria-describedby": describedBy,
  });

  return (
    <div className="field">
      <label className="field__label" htmlFor={controlId}>
        {label}
        {required === true ? <span className="field__req"> *</span> : null}
      </label>
      {control}
      {helpText !== undefined ? (
        <span className="field__help" id={helpId}>
          {helpText}
        </span>
      ) : null}
      {errorText !== undefined ? (
        <span className="field__error" id={errorId} role="alert">
          {/* Non-color cue (DESIGN.md): the alert icon carries the error signal
              alongside the --data-down color, matching the form-controls oracle. */}
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4" />
            <path d="M12 16h.01" />
          </svg>
          {errorText}
        </span>
      ) : null}
    </div>
  );
}
