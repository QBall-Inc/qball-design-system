import type { ReactNode } from "react";
import { useEffect, useRef } from "react";

import { Button } from "../primitives/Button";
import { Callout } from "../overlay/Callout";

/**
 * Terminal — the Stocky AI conversation transcript, painted with the shipped
 * `@qball-inc/tokens` `.term*` classes from the `preview/conversation-terminal.html`
 * oracle. A scrollable, growable transcript of `you ›` / `stocky ›` turns with
 * token-only styling (no component CSS, no hardcoded color, no box-shadow).
 *
 * Behaviour this surface owns: auto-scroll to the newest content on append, the
 * blinking streaming cursor at the end of the in-progress assistant turn, a
 * persistent (non-dismissible) AI disclaimer rendered via the shipped `Callout`
 * (the DESIGNATED disclaimer host — owner decision S86, in place of the oracle's
 * inline footer), and an error row that visually distinguishes a transient
 * `Retrying…` frame (warning) from a fatal `Try again` frame (error).
 *
 * Streaming state comes from the `useStreaming` hook (`messages` / `streaming` /
 * `error`), but `Terminal` is a pure display surface — it accepts that state as
 * props. Grounding annotations (`[source]` / `[unverified]`) are OUT of scope:
 * Grounding annotations are composed in afterward via `GroundingFlag`.
 */

/** Speaker for a transcript turn. */
export type TerminalRole = "user" | "assistant";

/**
 * A single streamed token. The streaming hook accumulates these into the
 * in-progress assistant message; `Terminal` flattens them to display text.
 */
export interface StreamToken {
  /** The text fragment carried by this token. */
  text: string;
}

/** One transcript turn. `content` is a plain string or an accumulating token list. */
export interface TerminalMessage {
  /** Optional stable identity used as the React key; falls back to the index. */
  id?: string | number;
  role: TerminalRole;
  content: string | StreamToken[];
}

/**
 * A provider error surfaced into the transcript. Discriminated on `kind` so a
 * retryable frame is never confused with a string sentinel
 * (the `discriminated {kind}` pattern over a `string | "literal"` union).
 */
export interface StreamError {
  kind: "error";
  /** Retryable → a transient `Retrying…` indicator; fatal → a `Try again` action. */
  retryable: boolean;
  message: string;
}

export interface TerminalProps {
  /** The transcript, oldest first. */
  messages: TerminalMessage[];
  /** While true, the last assistant turn shows the blinking streaming cursor. */
  streaming?: boolean;
  /** A provider error to surface as an error row (`null` / omitted = none). */
  error?: StreamError | null;
  /** Fired by the fatal-error row's `Try again` action. */
  onRetry?: () => void;
  /** Composer slot rendered in the terminal footer (e.g. a `<Composer/>`). */
  composer?: ReactNode;
  /** The persistent AI disclaimer. Defaults to the standard "not advice" notice. */
  disclaimer?: ReactNode;
  /** Header title (`.term__title`). Default `"stocky"`. */
  title?: ReactNode;
  /** Max height of the scrollable transcript body (a number is treated as px). */
  maxHeight?: number | string;
  /** className merged onto the `.term` root. */
  className?: string;
}

const DEFAULT_DISCLAIMER =
  "Stocky is AI and can get things wrong — not financial advice. Double-check before you trade.";

const ROLE_PREFIX: Record<TerminalRole, { label: string; preClass: string; txtClass: string }> = {
  user: { label: "you ›", preClass: "term__pre--you", txtClass: "term__txt--you" },
  assistant: { label: "stocky ›", preClass: "term__pre--bot", txtClass: "term__txt--bot" },
};

function toText(content: string | StreamToken[]): string {
  return typeof content === "string" ? content : content.map((t) => t.text).join("");
}

export function Terminal({
  messages,
  streaming = false,
  error = null,
  onRetry,
  composer,
  disclaimer = DEFAULT_DISCLAIMER,
  title = "stocky",
  maxHeight,
  className,
}: TerminalProps) {
  const endRef = useRef<HTMLDivElement>(null);

  // Auto-scroll the transcript to the newest content on every append / token /
  // error. useEffect runs client-only, so this is SSR-safe; scrollIntoView is
  // the observable hook the auto-scroll test asserts against (jsdom does no
  // layout, so scrollTop math would be untestable).
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, streaming, error]);

  const lastIndex = messages.length - 1;
  const bodyStyle =
    maxHeight === undefined
      ? undefined
      : { maxHeight: typeof maxHeight === "number" ? `${maxHeight}px` : maxHeight };

  return (
    <div className={["term", className].filter(Boolean).join(" ")}>
      <div className="term__head">
        <span className="term__caret" aria-hidden="true">
          ›_
        </span>
        <span className="term__title">{title}</span>
      </div>

      <div className="term__body" style={bodyStyle} aria-live="polite" aria-atomic="false">
        {messages.map((m, i) => {
          const { label, preClass, txtClass } = ROLE_PREFIX[m.role];
          const showCursor = streaming && i === lastIndex && m.role === "assistant";
          return (
            <div key={m.id ?? i}>
              {i > 0 ? <hr className="term__sep" /> : null}
              <div className="term__turn">
                <span className={preClass}>{label}</span>
                <span className={txtClass}>
                  {toText(m.content)}
                  {showCursor ? (
                    <span className="term__cursor" data-testid="term-cursor" aria-hidden="true" />
                  ) : null}
                </span>
              </div>
            </div>
          );
        })}

        {error ? (
          <Callout
            variant={error.retryable ? "warning" : "error"}
            title={error.retryable ? "Retrying…" : "Error"}
            className="term__errrow"
          >
            {error.message}
            {!error.retryable && onRetry !== undefined ? (
              <>
                {" "}
                <Button variant="secondary" onClick={onRetry}>
                  Try again
                </Button>
              </>
            ) : null}
          </Callout>
        ) : null}

        <div ref={endRef} />
      </div>

      {composer}

      <Callout variant="neutral" icon={false} className="term__disc">
        {disclaimer}
      </Callout>
    </div>
  );
}
