// The transport-neutral model behind one QuBae answer turn (plan AD-10). The
// site maps its backend stream onto start → appendText → finalize | fail; the
// DS never parses a wire format.
//
// TRUST RULE: streamed text is a DRAFT. It is buffered privately and never
// appears on the read surface (`view()`) until the turn is authorized for
// display — by finalize() with a verdict. finalize() carries the complete safe
// final turn; a withheld or refused finalize discards the draft, so text the
// answer could not stand behind is never shown. Early display (authorize on a
// grounded-verdict event) exists but is OFF unless the consumer opts in; while
// off, authorize() is a no-op that warns in development. With it on, a later
// non-grounded finalize is a contract violation: the shown text is withdrawn
// and the turn becomes an error.
import type { Claim, ClaimSource } from "./types";
import type { RefusalKind } from "./locked-strings";

/** Answer text as segments; `figure` marks a count the renderer emphasises. */
export type AnswerSegment = { kind: "text"; text: string } | { kind: "figure"; text: string };

/** Counts behind the answer-variant provenance footer. */
export interface AnswerProvenance {
  claims: number;
  episodes: number;
  confidenceTier: string;
  snapshotDate: string;
  supersededExcluded: number;
}

export interface GroundedTurn {
  verdict: "grounded";
  /** Numbers behind `N claims · M episodes · <tier> confidence`. */
  explanation: { claims: number; episodes: number; confidenceTier: string };
  body: AnswerSegment[];
  sources: ClaimSource[];
  provenance: AnswerProvenance;
  /** Optional link into the graph explorer for this answer. */
  explorerLink?: string;
}

export interface WithheldTurn {
  verdict: "withheld";
  /** Numbers behind `X of Y claims untraceable · Z claims shown`. */
  explanation: { untraceable: number; total: number; shown: number };
  /** The held-draft note (why the answer is being held back). */
  body: AnswerSegment[];
  /** "The part i can stand behind": the traceable claims, shown with confidence. */
  traceableClaims: Claim[];
}

export interface RefusedTurn {
  verdict: "refused";
  reason: RefusalKind;
  body: AnswerSegment[];
  /** Consumer-supplied closing line (e.g. where the agent is useful). */
  closingLine?: string;
}

/** The complete, safe content of a finished turn. */
export type FinalTurn = GroundedTurn | WithheldTurn | RefusedTurn;

export type Verdict = FinalTurn["verdict"];

export type TurnError =
  | { kind: "failed"; message: string }
  | { kind: "contract_violation"; message: string };

/** Everything a renderer may show. Draft text appears only in `streaming`. */
export type TurnView =
  | { status: "idle" }
  | { status: "pending" }
  | { status: "streaming"; text: string }
  | { status: "final"; turn: FinalTurn }
  | { status: "error"; error: TurnError };

export interface AnswerTurnOptions {
  /**
   * Show streamed text before finalize() once authorize("grounded") is called.
   * Leave off until the backend guarantees an irreversible grounded-verdict
   * event that precedes every token.
   */
  earlyDisplay?: boolean;
  /** Receives development warnings (default: console.warn outside production). */
  onWarn?: (message: string) => void;
}

type Listener = (view: TurnView) => void;

/**
 * Bundlers replace the literal `process.env.NODE_ENV` at build time, so it is
 * read with dot access; a bare browser without `process` counts as development.
 */
function isProduction(): boolean {
  try {
    return (process.env as { NODE_ENV?: string }).NODE_ENV === "production";
  } catch {
    return false;
  }
}

function defaultWarn(message: string): void {
  if (!isProduction()) console.warn(message);
}

export class AnswerTurn {
  readonly #earlyDisplay: boolean;
  readonly #warn: (message: string) => void;
  readonly #listeners = new Set<Listener>();
  #phase: "idle" | "pending" | "done" = "idle";
  #draft = "";
  #authorized = false;
  #view: TurnView = { status: "idle" };

  constructor(options: AnswerTurnOptions = {}) {
    this.#earlyDisplay = options.earlyDisplay === true;
    this.#warn = options.onWarn ?? defaultWarn;
  }

  /** The current displayable state. Never contains unauthorized draft text. */
  view(): TurnView {
    return this.#view;
  }

  /** Calls `listener` after every change; returns an unsubscribe function. */
  subscribe(listener: Listener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  /** Opens the turn: the thinking indicator shows, no text. */
  start(): void {
    if (this.#phase !== "idle")
      throw new Error("AnswerTurn.start(): the turn has already started.");
    this.#phase = "pending";
    this.#set({ status: "pending" });
  }

  /** Buffers a streamed chunk. Visible only if early display was authorized. */
  appendText(chunk: string): void {
    this.#requirePending("appendText");
    this.#draft += chunk;
    if (this.#authorized) this.#set({ status: "streaming", text: this.#draft });
  }

  /**
   * Early-display gate for a grounded-verdict event. A no-op (with a
   * development warning) unless the turn was created with `earlyDisplay: true`.
   */
  authorize(verdict: "grounded"): void {
    this.#requirePending("authorize");
    if (!this.#earlyDisplay) {
      this.#warn(
        `AnswerTurn.authorize("${verdict}") ignored: early display is disabled, so streamed text stays hidden until finalize(). Pass { earlyDisplay: true } only once the backend emits an irreversible grounded verdict before any tokens.`,
      );
      return;
    }
    this.#authorized = true;
    this.#set({ status: "streaming", text: this.#draft });
  }

  /** Ends the turn with its complete safe content; the draft is discarded. */
  finalize(turn: FinalTurn): void {
    this.#requirePending("finalize");
    const wasShown = this.#authorized;
    this.#close();
    if (wasShown && turn.verdict !== "grounded") {
      this.#set({
        status: "error",
        error: {
          kind: "contract_violation",
          message: `Turn was authorized as grounded but finalized as ${turn.verdict}; the shown text was withdrawn.`,
        },
      });
      return;
    }
    this.#set({ status: "final", turn: structuredClone(turn) });
  }

  /** Ends the turn as an error; the draft is discarded. */
  fail(message: string): void {
    this.#requirePending("fail");
    this.#close();
    this.#set({ status: "error", error: { kind: "failed", message } });
  }

  #requirePending(method: string): void {
    if (this.#phase === "idle") throw new Error(`AnswerTurn.${method}(): call start() first.`);
    if (this.#phase === "done")
      throw new Error(`AnswerTurn.${method}(): the turn has already ended.`);
  }

  #close(): void {
    this.#phase = "done";
    this.#draft = "";
    this.#authorized = false;
  }

  #set(view: TurnView): void {
    this.#view = view;
    for (const listener of this.#listeners) listener(view);
  }
}
