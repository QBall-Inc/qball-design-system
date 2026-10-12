// mountTranscript(): renders a conversation into any container — the overlay's
// `handle.body` or a plain page element. Each bot turn is driven by its own
// AnswerTurn model; the transcript renders only what the model's view()
// exposes, so streamed draft text never reaches the DOM unless the consumer
// enabled early display and authorized the turn (plan AD-10). The transcript
// stores nothing: the consumer replays history through start() → finalize().
// Touches the DOM only when called, never at module evaluation (AD-6).

import { AnswerTurn, type TurnView } from "../answer-turn";
import type { FeedbackChange, FeedbackValue } from "../trust/Feedback";
import { el } from "../trust/dom";
import { renderAnswer, renderErrorAnswer, type AnswerOptions } from "./AnswerBox";
import { renderNotice, type NoticeAction } from "./Notice";

export interface TranscriptOptions {
  /** Prompt beside user turns (default `you ›`). */
  userPrompt?: string;
  /** Prompt beside bot turns (default `bot ›`). */
  botPrompt?: string;
  /**
   * Passed to every AnswerTurn. Leave off until the backend guarantees an
   * irreversible grounded verdict before any tokens.
   */
  earlyDisplay?: boolean;
  /** Receives AnswerTurn development warnings. */
  onWarn?: (message: string) => void;
  /** Shown for a contract-violation error (default `something went wrong. try again in a moment.`). */
  errorText?: string;
  /** Called on every +1 / −1 change; turns then need a turnRef. */
  onFeedback?: (change: FeedbackChange) => void;
  /** Passed to every answer (see AnswerOptions); `feedback` is set per turn. */
  answer?: Omit<AnswerOptions, "feedback">;
}

export interface BotTurnOptions {
  /** The consumer's id for this turn; required when `onFeedback` is set. */
  turnRef?: string;
  /**
   * The visitor's earlier vote, shown pressed without firing `onFeedback`
   * (e.g. restored from browser storage on a replayed turn). A vote needs
   * `onFeedback`; `null` means no vote.
   */
  initialFeedback?: FeedbackValue;
}

export interface TranscriptNoticeOptions {
  action?: NoticeAction;
}

export interface TranscriptHandle {
  /** The element the transcript renders into. */
  readonly container: HTMLElement;
  /** Appends the user's question as plain text. */
  addUserTurn(text: string): HTMLElement;
  /**
   * Appends a bot turn and returns its model. Drive it with start() →
   * appendText() → finalize() | fail(); the row renders from its view.
   */
  addBotTurn(options?: BotTurnOptions): AnswerTurn;
  /** Appends a notice (limits, pauses); `\n` starts a new line. */
  addNotice(text: string, options?: TranscriptNoticeOptions): HTMLElement;
  /** Removes every rendered turn and notice. */
  clear(): void;
  /** Clears the container and detaches from every turn. */
  destroy(): void;
}

export const TRANSCRIPT_DEFAULTS = {
  userPrompt: "you ›",
  botPrompt: "bot ›",
  errorText: "something went wrong. try again in a moment.",
} as const;

const CURSOR = "▋";

function optionalString(name: string, value: unknown, fallback: string): string {
  if (value === undefined) return fallback;
  if (typeof value !== "string") throw new TypeError(`${name} must be a string.`);
  return value;
}

/** The thinking cursor: decorative; the turn's aria-busy carries the state. */
function cursor(): HTMLElement {
  const node = el("span", "qcursor", CURSOR);
  node.setAttribute("aria-hidden", "true");
  return node;
}

/** Mounts a transcript into `container` and returns its handle. */
export function mountTranscript(
  container: HTMLElement,
  options: TranscriptOptions = {},
): TranscriptHandle {
  if (!(container instanceof HTMLElement)) {
    throw new TypeError("mountTranscript() needs a container HTMLElement.");
  }
  const userPrompt = optionalString(
    "userPrompt",
    options.userPrompt,
    TRANSCRIPT_DEFAULTS.userPrompt,
  );
  const botPrompt = optionalString("botPrompt", options.botPrompt, TRANSCRIPT_DEFAULTS.botPrompt);
  const errorText = optionalString("errorText", options.errorText, TRANSCRIPT_DEFAULTS.errorText);
  for (const name of ["onWarn", "onFeedback"] as const) {
    if (options[name] !== undefined && typeof options[name] !== "function") {
      throw new TypeError(`${name} must be a function.`);
    }
  }
  const answerOptions = options.answer ?? {};
  const detachers = new Set<() => void>();
  let destroyed = false;

  const requireLive = (method: string): void => {
    if (destroyed) throw new Error(`TranscriptHandle.${method}(): the transcript was destroyed.`);
  };

  const scrollToEnd = (): void => {
    container.scrollTop = container.scrollHeight;
  };

  /** Appends a turn row, preceded by a hairline when something is above it. */
  const appendTurn = (row: HTMLElement): void => {
    if (container.childElementCount > 0) container.append(el("hr", "qsep"));
    container.append(row);
    scrollToEnd();
  };

  const turnRow = (promptClass: string, prompt: string, textClass: string) => {
    const row = el("div", "qturn");
    const text = el("div", textClass);
    row.append(el("span", promptClass, prompt), text);
    return { row, text };
  };

  const renderView = (
    slot: HTMLElement,
    view: TurnView,
    turnRef: string | undefined,
    initialFeedback: FeedbackValue | undefined,
  ): void => {
    switch (view.status) {
      case "idle":
        slot.replaceChildren();
        return;
      case "pending":
        slot.setAttribute("aria-busy", "true");
        slot.replaceChildren(cursor());
        return;
      case "streaming":
        slot.setAttribute("aria-busy", "true");
        slot.replaceChildren(document.createTextNode(view.text), cursor());
        return;
      case "final": {
        const feedback =
          options.onFeedback !== undefined && turnRef !== undefined
            ? {
                feedback: {
                  turnRef,
                  onChange: options.onFeedback,
                  ...(initialFeedback === undefined ? {} : { initial: initialFeedback }),
                },
              }
            : {};
        slot.removeAttribute("aria-busy");
        try {
          slot.replaceChildren(...renderAnswer(view.turn, { ...answerOptions, ...feedback }));
        } catch (error) {
          // Bad turn data: never leave the cursor spinning — show the generic
          // error turn, then let the error reach the consumer's finalize() call.
          slot.replaceChildren(renderErrorAnswer(errorText));
          throw error;
        }
        return;
      }
      case "error":
        slot.removeAttribute("aria-busy");
        // A contract violation's message is internal; only a failure's
        // consumer-supplied message is meant for the reader.
        slot.replaceChildren(
          renderErrorAnswer(view.error.kind === "failed" ? view.error.message : errorText),
        );
        return;
    }
  };

  return {
    container,
    addUserTurn(text) {
      requireLive("addUserTurn");
      if (typeof text !== "string") throw new TypeError("text must be a string.");
      const { row, text: slot } = turnRow("qturn__you", userPrompt, "qturn__t-you");
      slot.textContent = text;
      appendTurn(row);
      return row;
    },
    addBotTurn(turnOptions = {}) {
      requireLive("addBotTurn");
      const turnRef = turnOptions.turnRef;
      if (turnRef !== undefined && (typeof turnRef !== "string" || turnRef.trim().length === 0)) {
        throw new TypeError("turnRef must be a non-empty string.");
      }
      if (options.onFeedback !== undefined && turnRef === undefined) {
        throw new TypeError("addBotTurn() needs a turnRef when onFeedback is set.");
      }
      const initialFeedback = turnOptions.initialFeedback;
      if (
        initialFeedback !== undefined &&
        initialFeedback !== null &&
        initialFeedback !== 1 &&
        initialFeedback !== -1
      ) {
        throw new RangeError(
          `initialFeedback must be 1, -1 or null (got ${String(initialFeedback)}).`,
        );
      }
      if (
        initialFeedback !== undefined &&
        initialFeedback !== null &&
        options.onFeedback === undefined
      ) {
        throw new TypeError("initialFeedback needs onFeedback (no marks render without it).");
      }
      const turn = new AnswerTurn({
        earlyDisplay: options.earlyDisplay === true,
        ...(options.onWarn === undefined ? {} : { onWarn: options.onWarn }),
      });
      const { row, text } = turnRow("qturn__bot", botPrompt, "qturn__t-bot");
      appendTurn(row);
      const unsubscribe = turn.subscribe((view) => {
        try {
          renderView(text, view, turnRef, initialFeedback);
        } finally {
          scrollToEnd();
          if (view.status === "final" || view.status === "error") detach();
        }
      });
      const detach = (): void => {
        unsubscribe();
        detachers.delete(detach);
      };
      detachers.add(detach);
      return turn;
    },
    addNotice(text, noticeOptions = {}) {
      requireLive("addNotice");
      const notice = renderNotice(text, {
        ...(noticeOptions.action === undefined ? {} : { action: noticeOptions.action }),
        ...(answerOptions.allowedOrigins === undefined
          ? {}
          : { allowedOrigins: answerOptions.allowedOrigins }),
      });
      container.append(notice);
      scrollToEnd();
      return notice;
    },
    clear() {
      requireLive("clear");
      for (const detach of [...detachers]) detach();
      container.replaceChildren();
    },
    destroy() {
      if (destroyed) return;
      for (const detach of [...detachers]) detach();
      container.replaceChildren();
      destroyed = true;
    },
  };
}
