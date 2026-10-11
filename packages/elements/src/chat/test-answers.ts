// Loads the answer-turn event scripts in fixtures/qubrain/answers for the chat
// tests and replays them into an AnswerTurn (test-only; not part of any entry).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { AnswerTurn, FinalTurn, GroundedTurn } from "../answer-turn";

// vitest runs with the package directory as cwd.
const ANSWERS_DIR = resolve(process.cwd(), "../../fixtures/qubrain/answers");

export type AnswerEvent =
  | { op: "start" }
  | { op: "appendText"; text: string }
  | { op: "authorize" }
  | { op: "finalize"; turn: FinalTurn }
  | { op: "fail"; message: string };

export interface AnswerScript {
  question: string;
  events: AnswerEvent[];
}

export function loadScript(name: string): AnswerScript {
  return JSON.parse(readFileSync(resolve(ANSWERS_DIR, `${name}.json`), "utf8")) as AnswerScript;
}

export function finalOf(name: string): FinalTurn {
  const event = loadScript(name).events.find((e) => e.op === "finalize");
  if (event?.op !== "finalize") throw new Error(`${name} has no finalize event`);
  return event.turn;
}

export function groundedOf(name: string): GroundedTurn {
  const turn = finalOf(name);
  if (turn.verdict !== "grounded") throw new Error(`${name} is not grounded`);
  return turn;
}

export function draftsOf(name: string): string[] {
  return loadScript(name).events.flatMap((e) => (e.op === "appendText" ? [e.text] : []));
}

/** Applies one event; `after` runs after each, e.g. to inspect the DOM. */
export function replay(turn: AnswerTurn, events: readonly AnswerEvent[], after?: () => void): void {
  for (const event of events) {
    if (event.op === "start") turn.start();
    else if (event.op === "appendText") turn.appendText(event.text);
    else if (event.op === "authorize") turn.authorize("grounded");
    else if (event.op === "finalize") turn.finalize(event.turn);
    else turn.fail(event.message);
    after?.();
  }
}
