import { useRef, useState } from "react";
import type { ChangeEvent, KeyboardEvent, ReactNode } from "react";

import { ArrowRight } from "../icons/generated";

/**
 * Composer — the terminal's multiline input + inline send control, painted with
 * the shipped `.term__composer` / `.term__prompt` / `.term__input` classes from
 * the `preview/conversation-terminal.html` oracle. Standalone so it can sit in a
 * `Terminal` footer (via the `composer` slot) or on its own.
 *
 * Send fires on Enter (without Shift) or a click of the inline `.iconbtn` send
 * arrow; the textarea then clears and its auto-grown height resets. The BYO-key
 * gate (`keyProvided={false}`) disables the input + send and shows an "Add your
 * key" prompt — `onSend` is never invoked while gated. The Composer does NOT
 * render the key-entry flow (that is `SecretInput`); it only reflects
 * the `keyProvided` boolean and exposes the disabled visual state.
 */
export interface ComposerProps {
  /** Fired with the trimmed text on Enter (no Shift) or a send-click. */
  onSend: (text: string) => void;
  /** BYO-key gate. When `false`, the input + send are disabled and a prompt shows. Default `true`. */
  keyProvided?: boolean;
  /** Placeholder for the textarea. */
  placeholder?: string;
  /** The `.term__prompt` label. Default `"you ›"`. */
  prompt?: ReactNode;
  /** The gated-state prompt (must read as "add your key"). Default `"Add your key to start chatting."`. */
  keyPrompt?: ReactNode;
  /** Accessible label for the send button + the textarea. Defaults `"Send"` / `"Message"`. */
  sendLabel?: string;
  inputLabel?: string;
  /** className merged onto the `.term__composer` root. */
  className?: string;
}

export function Composer({
  onSend,
  keyProvided = true,
  placeholder = "type a question…",
  prompt = "you ›",
  keyPrompt = "Add your key to start chatting.",
  sendLabel = "Send",
  inputLabel = "Message",
  className,
}: ComposerProps) {
  const [value, setValue] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);
  const disabled = !keyProvided;

  // Auto-grow: collapse to the content height on every edit (the oracle's inline
  // script behaviour, in React). Runs only in input handlers, so it is SSR-safe.
  function grow() {
    const ta = taRef.current;
    if (ta === null) return;
    ta.style.height = "auto";
    ta.style.height = `${ta.scrollHeight}px`;
  }

  function send() {
    if (disabled) return;
    const text = value.trim();
    if (text === "") return;
    onSend(text);
    setValue("");
    const ta = taRef.current;
    if (ta !== null) ta.style.height = "auto";
  }

  function handleChange(e: ChangeEvent<HTMLTextAreaElement>) {
    setValue(e.target.value);
    grow();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className={["term__composer", className].filter(Boolean).join(" ")}>
      <span className="term__prompt">{prompt}</span>
      <textarea
        ref={taRef}
        className="term__input"
        rows={1}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        aria-label={inputLabel}
      />
      <button
        type="button"
        className="iconbtn term__send"
        onClick={send}
        disabled={disabled}
        aria-label={sendLabel}
      >
        <ArrowRight size={16} strokeWidth={1.6} />
      </button>
      {disabled ? <p className="term__keyhint">{keyPrompt}</p> : null}
    </div>
  );
}
