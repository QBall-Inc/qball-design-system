import { forwardRef, useId, useState } from "react";
import type { KeyboardEvent } from "react";

import { Eye, EyeOff } from "../icons/generated";

/**
 * SecretInput — masked BYO-key / secret entry with reveal, set, rotate, remove.
 *
 * A token-driven className wrapper over the shipped `@qball-inc/tokens` surface
 * (`components.css` / `colors_and_type.css`), matching the
 * `preview/secret-input.html` oracle card: a `.field` composition wrapping an
 * `.input-wrap` (the `.input num` masked field + an `.input-wrap__affix` reveal
 * toggle) and a `.btn` action row. There is NO behavioral library and NO
 * component CSS — masking is the native `<input type="password">`, the reveal
 * toggle flips `type` to `text`, and every visual comes from the shipped token
 * classes. The two inline styles are structural-only (`display:flex` row +
 * `gap`/`color` from `var(--*)` tokens), mirroring the oracle's own
 * `style="color:var(--data-down)"` Delete affordance — no hex, no shadow.
 *
 * Security posture (BINDING): the raw secret lives ONLY as the controlled
 * input's value — it is never duplicated into another node, attribute, or text,
 * and is never passed to `console.*`. The masked state relies on the native
 * password mask; the reveal toggle is the only path to plaintext, and only
 * while held in view. The leak gate in `SecretInput.test.tsx` asserts the
 * secret is confined to that single input's value and is absent from every
 * other attribute, all text content, web storage, cookies, and `console.*`.
 *
 * State model:
 * - `isSet={false}` (unset): editable input + a single "Set" affordance.
 * - `isSet` (set): masked read-only value + "Rotate" + "Remove". "Rotate" opens
 *   an in-place edit (Update / Cancel) without round-tripping the stored secret.
 */
export interface SecretInputProps {
  /** Current input value (controlled). In the masked set-state this is what the consumer chooses to display. */
  value: string;
  /** Fired with the new string on each edit (the value, not the DOM event). */
  onChange: (value: string) => void;
  /** Commit handler — fired with the current value when the user confirms (Set / Update / Enter). */
  onSet: (value: string) => void;
  /** Clear/remove handler — fired when the user removes a stored secret; resets to the unset state. */
  onRemove: () => void;
  /** Visible label, associated to the input via `htmlFor`/`id`. */
  label: string;
  /** Whether a secret is currently stored. `false` → unset/entry; `true` → masked display with rotate/remove. */
  isSet?: boolean;
  /** Disable the whole control. */
  disabled?: boolean;
  /** Placeholder shown in the unset/entry state. */
  placeholder?: string;
  /** Form field name; pairs with `autocomplete="new-password"` to suppress credential autofill. */
  name?: string;
  /** Optional helper text below the field (`aria-describedby`). */
  helpText?: string;
  /** Render a required marker (`*`) after the label. */
  required?: boolean;
  /** Label for the commit button in the unset state. Default `"Set"`. */
  setLabel?: string;
  /** Label for the commit button while rotating an existing secret. Default `"Update"`. */
  updateLabel?: string;
  /** Label for the rotate affordance in the set state. Default `"Rotate"`. */
  rotateLabel?: string;
  /** Label for the remove affordance in the set state. Default `"Remove"`. */
  removeLabel?: string;
  /** Label for the cancel affordance while rotating. Default `"Cancel"`. */
  cancelLabel?: string;
  /** `aria-label` for the reveal toggle when masked. Default `"Show secret"`. */
  showSecretLabel?: string;
  /** `aria-label` for the reveal toggle when revealed. Default `"Hide secret"`. */
  hideSecretLabel?: string;
}

export const SecretInput = forwardRef<HTMLInputElement, SecretInputProps>(function SecretInput(
  {
    value,
    onChange,
    onSet,
    onRemove,
    label,
    isSet = false,
    disabled = false,
    placeholder,
    name,
    helpText,
    required = false,
    setLabel = "Set",
    updateLabel = "Update",
    rotateLabel = "Rotate",
    removeLabel = "Remove",
    cancelLabel = "Cancel",
    showSecretLabel = "Show secret",
    hideSecretLabel = "Hide secret",
  },
  ref,
) {
  const [showSecret, setShowSecret] = useState(false);
  const [editing, setEditing] = useState(false);

  const baseId = useId();
  const inputId = `${baseId}-secret`;
  const helpId = helpText !== undefined ? `${baseId}-help` : undefined;

  // Editable when there is no stored secret, or when the user is rotating one.
  const editable = isSet !== true || editing;
  const canCommit = value.trim().length > 0;

  const commit = () => {
    if (!canCommit) return;
    onSet(value);
    setEditing(false);
    setShowSecret(false);
  };
  const cancelRotate = () => {
    setEditing(false);
    setShowSecret(false);
  };
  const remove = () => {
    onRemove();
    setShowSecret(false);
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && editable && canCommit) {
      event.preventDefault();
      commit();
    }
  };

  return (
    <div className="field">
      <label className="field__label" htmlFor={inputId}>
        {label}
        {required ? <span className="field__req"> *</span> : null}
      </label>

      <div className="input-wrap">
        <input
          ref={ref}
          id={inputId}
          name={name}
          className="input num"
          type={showSecret ? "text" : "password"}
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={!editable}
          // new-password suppresses autofill/storage of real credentials (AC-5).
          autoComplete="new-password"
          aria-describedby={helpId}
          onChange={(event) => {
            onChange(event.target.value);
          }}
          onKeyDown={handleKeyDown}
        />
        <button
          type="button"
          className="input-wrap__affix"
          aria-label={showSecret ? hideSecretLabel : showSecretLabel}
          aria-pressed={showSecret}
          disabled={disabled}
          onClick={() => {
            setShowSecret((shown) => !shown);
          }}
        >
          {showSecret ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>

      {helpText !== undefined ? (
        <span className="field__help" id={helpId}>
          {helpText}
        </span>
      ) : null}

      {/* Structural row only: flex + token gap, mirroring the oracle's `.actions`
          demo style (which is preview-local, not shipped). No brand values. */}
      <div style={{ display: "flex", gap: "var(--space-sm)" }}>
        {editable ? (
          <>
            <button
              type="button"
              className="btn btn--primary"
              disabled={disabled || !canCommit}
              onClick={commit}
            >
              {isSet ? updateLabel : setLabel}
            </button>
            {isSet && editing ? (
              <button
                type="button"
                className="btn btn--ghost"
                disabled={disabled}
                onClick={cancelRotate}
              >
                {cancelLabel}
              </button>
            ) : null}
          </>
        ) : (
          <>
            <button
              type="button"
              className="btn btn--secondary"
              disabled={disabled}
              onClick={() => {
                setEditing(true);
              }}
            >
              {rotateLabel}
            </button>
            {/* Subtle destructive affordance: ghost button tinted with the down
                token, matching the oracle's `style="color:var(--data-down)"`. */}
            <button
              type="button"
              className="btn btn--ghost"
              style={{ color: "var(--data-down)" }}
              disabled={disabled}
              onClick={remove}
            >
              {removeLabel}
            </button>
          </>
        )}
      </div>
    </div>
  );
});
