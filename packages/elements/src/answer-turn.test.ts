import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { AnswerTurn, type FinalTurn, type TurnView } from "./answer-turn";
import { groundedExplanation, refusedExplanation, withheldExplanation } from "./locked-strings";

// vitest runs with the package directory as cwd.
const ANSWERS_DIR = resolve(process.cwd(), "../../fixtures/qubrain/provisional-answers");

type Event =
  | { op: "start" }
  | { op: "appendText"; text: string }
  | { op: "authorize" }
  | { op: "finalize"; turn: FinalTurn }
  | { op: "fail"; message: string };

interface AnswerFixture {
  _provisional: boolean;
  events: Event[];
}

function load(name: string): AnswerFixture {
  return JSON.parse(readFileSync(resolve(ANSWERS_DIR, `${name}.json`), "utf8")) as AnswerFixture;
}

function streamedText(events: readonly Event[]): string[] {
  return events.flatMap((event) => (event.op === "appendText" ? [event.text] : []));
}

/** Replays a fixture, recording every view a renderer would have been given. */
function replay(events: readonly Event[], turn = new AnswerTurn({ onWarn: () => undefined })) {
  const seen: TurnView[] = [];
  turn.subscribe((view) => seen.push(view));
  for (const event of events) {
    if (event.op === "start") turn.start();
    else if (event.op === "appendText") turn.appendText(event.text);
    else if (event.op === "authorize") turn.authorize("grounded");
    else if (event.op === "finalize") turn.finalize(event.turn);
    else turn.fail(event.message);
  }
  return { turn, seen };
}

function neverShows(views: readonly TurnView[], drafts: readonly string[]): void {
  expect(drafts.length).toBeGreaterThan(0);
  expect(views.length).toBeGreaterThan(0);
  const everything = JSON.stringify(views);
  for (const draft of drafts) expect(everything).not.toContain(draft);
}

describe("provisional answer fixtures", () => {
  it("every fixture is labelled provisional", () => {
    const files = readdirSync(ANSWERS_DIR).filter((f) => f.endsWith(".json"));
    expect(files.length).toBeGreaterThanOrEqual(5);
    for (const file of files) expect(load(file.replace(/\.json$/, ""))._provisional).toBe(true);
  });
});

describe("AnswerTurn — trust rule (early display off, the default)", () => {
  it.each(["grounded", "withheld", "refused-in-scope-empty", "refused-off-topic", "error"])(
    "%s: no streamed draft text ever reaches a view",
    (name) => {
      const { events } = load(name);
      const { seen, turn } = replay(events);
      neverShows([...seen, turn.view()], streamedText(events));
    },
  );

  it("shows only the thinking state while text streams in", () => {
    const turn = new AnswerTurn();
    turn.start();
    turn.appendText("a draft the answer may not stand behind");
    expect(turn.view()).toEqual({ status: "pending" });
  });

  it("withheld: discards the draft and exposes exactly the finalize-supplied safe content", () => {
    const { events } = load("withheld");
    const final = events.find((e) => e.op === "finalize");
    const { turn } = replay(events);
    expect(turn.view()).toEqual({ status: "final", turn: final?.op === "finalize" && final.turn });
    const view = turn.view();
    if (view.status !== "final" || view.turn.verdict !== "withheld")
      throw new Error("not withheld");
    expect(view.turn.traceableClaims).toHaveLength(2);
    expect(withheldExplanation(view.turn.explanation)).toBe(
      "2 of 5 claims untraceable · 2 claims shown",
    );
  });

  it("refused: carries the refusal kind that selects the locked explanation", () => {
    const inScope = replay(load("refused-in-scope-empty").events).turn.view();
    const offTopic = replay(load("refused-off-topic").events).turn.view();
    if (inScope.status !== "final" || inScope.turn.verdict !== "refused") throw new Error("x");
    if (offTopic.status !== "final" || offTopic.turn.verdict !== "refused") throw new Error("y");
    expect(refusedExplanation(inScope.turn.reason)).toBe("unable to answer · 0 references found");
    expect(refusedExplanation(offTopic.turn.reason)).toBe("out of scope");
  });

  it("grounded: exposes the final answer and the numbers behind its explanation", () => {
    const view = replay(load("grounded").events).turn.view();
    if (view.status !== "final" || view.turn.verdict !== "grounded")
      throw new Error("not grounded");
    expect(groundedExplanation(view.turn.explanation)).toBe(
      "6 claims · 4 episodes · high confidence",
    );
    expect(view.turn.sources).toHaveLength(3);
  });

  it("error: fail() ends the turn with the message and no draft", () => {
    const { turn } = replay(load("error").events);
    expect(turn.view()).toEqual({
      status: "error",
      error: {
        kind: "failed",
        message: "the answer service is unavailable — try again in a moment.",
      },
    });
  });
});

describe("AnswerTurn — authorize() while early display is disabled", () => {
  it("is a no-op that warns, and the draft stays hidden", () => {
    const warnings: string[] = [];
    const turn = new AnswerTurn({ onWarn: (message) => warnings.push(message) });
    turn.start();
    turn.appendText("unverified draft");
    turn.authorize("grounded");
    expect(turn.view()).toEqual({ status: "pending" });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain(
      'AnswerTurn.authorize("grounded") ignored: early display is disabled',
    );
  });

  it("finalizing withheld afterwards is a normal withheld turn, not a violation", () => {
    const { events } = load("withheld");
    const [start, ...rest] = events;
    if (start === undefined) throw new Error("empty fixture");
    const { turn, seen } = replay([start, { op: "authorize" }, ...rest]);
    expect(turn.view().status).toBe("final");
    neverShows(seen, streamedText(events));
  });
});

describe("AnswerTurn — early display explicitly enabled", () => {
  function enabled(): AnswerTurn {
    return new AnswerTurn({ earlyDisplay: true, onWarn: () => undefined });
  }

  it("shows streamed text only after authorize, then the final answer", () => {
    const { events } = load("grounded");
    const [start, first, second, finalize] = events;
    if (!start || !first || !second || !finalize) throw new Error("unexpected fixture shape");
    const { seen, turn } = replay([start, first, { op: "authorize" }, second, finalize], enabled());
    expect(seen.map((v) => v.status)).toEqual(["pending", "streaming", "streaming", "final"]);
    const drafts = streamedText(events);
    expect(seen[1]).toEqual({ status: "streaming", text: drafts[0] });
    expect(seen[2]).toEqual({ status: "streaming", text: drafts.join("") });
    expect(turn.view().status).toBe("final");
  });

  it.each(["withheld", "refused-in-scope-empty"])(
    "a later %s finalize is a contract violation: the shown text is withdrawn",
    (name) => {
      const { events } = load(name);
      const [start, ...rest] = events;
      if (start === undefined) throw new Error("empty fixture");
      const { turn } = replay([start, { op: "authorize" }, ...rest], enabled());
      const view = turn.view();
      expect(view.status).toBe("error");
      expect(view.status === "error" && view.error.kind).toBe("contract_violation");
      neverShows([view], streamedText(events));
    },
  );
});

describe("AnswerTurn — lifecycle", () => {
  it("starts idle", () => {
    expect(new AnswerTurn().view()).toEqual({ status: "idle" });
  });

  it.each([
    ["appendText before start", (t: AnswerTurn) => t.appendText("x"), "call start() first"],
    ["finalize before start", (t: AnswerTurn) => t.fail("x"), "call start() first"],
  ])("rejects %s", (_label, act, message) => {
    expect(() => act(new AnswerTurn())).toThrow(message);
  });

  it("rejects any call after the turn has ended, and a second start", () => {
    const turn = new AnswerTurn();
    turn.start();
    expect(() => turn.start()).toThrow("the turn has already started");
    turn.fail("boom");
    expect(() => turn.appendText("late")).toThrow("the turn has already ended");
    expect(() => turn.fail("again")).toThrow("the turn has already ended");
  });

  it("keeps its own copy of the final turn, so later caller mutations cannot change it", () => {
    const { events } = load("refused-off-topic");
    const finalize = events.find((e) => e.op === "finalize");
    if (finalize?.op !== "finalize") throw new Error("no finalize event");
    const turn = new AnswerTurn();
    turn.start();
    turn.finalize(finalize.turn);
    (finalize.turn as { verdict: string }).verdict = "grounded";
    const view = turn.view();
    expect(view.status === "final" && view.turn.verdict).toBe("refused");
  });

  it("stops notifying a listener after it unsubscribes", () => {
    const turn = new AnswerTurn();
    const seen: TurnView[] = [];
    const unsubscribe = turn.subscribe((view) => seen.push(view));
    turn.start();
    unsubscribe();
    turn.fail("boom");
    expect(seen).toEqual([{ status: "pending" }]);
  });
});
