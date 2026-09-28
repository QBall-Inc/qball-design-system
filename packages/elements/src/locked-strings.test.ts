import { describe, expect, it } from "vitest";
import {
  LOCKED_SEPARATOR,
  answerFooter,
  canvasStatus,
  groundedExplanation,
  panelFooter,
  refusedExplanation,
  sourcesLine,
  withheldExplanation,
} from "./locked-strings";

// Expected strings are written out verbatim (plan AD-11); only the numeric,
// date and tier slots vary. Every counted noun is covered at N = 0, 1 and > 1.

describe("groundedExplanation", () => {
  it.each([
    [0, 0, "0 claims · 0 episodes · high confidence"],
    [1, 1, "1 claim · 1 episode · high confidence"],
    [6, 4, "6 claims · 4 episodes · high confidence"],
  ])("claims=%i episodes=%i → %s", (claims, episodes, expected) => {
    expect(groundedExplanation({ claims, episodes, confidenceTier: "high" })).toBe(expected);
  });

  it("uses the tier word for the confidence slot", () => {
    expect(groundedExplanation({ claims: 2, episodes: 1, confidenceTier: "med" })).toBe(
      "2 claims · 1 episode · medium confidence",
    );
  });
});

describe("withheldExplanation", () => {
  it.each([
    [0, 0, 0, "0 of 0 claims untraceable · 0 claims shown"],
    [1, 1, 0, "1 of 1 claim untraceable · 0 claims shown"],
    [1, 3, 1, "1 of 3 claims untraceable · 1 claim shown"],
    [2, 5, 2, "2 of 5 claims untraceable · 2 claims shown"],
  ])("untraceable=%i total=%i shown=%i → %s", (untraceable, total, shown, expected) => {
    expect(withheldExplanation({ untraceable, total, shown })).toBe(expected);
  });

  it("rejects counts that cannot describe a real withheld answer", () => {
    expect(() => withheldExplanation({ untraceable: 4, total: 3, shown: 0 })).toThrow(
      "untraceable (4) cannot exceed total (3).",
    );
    expect(() => withheldExplanation({ untraceable: 2, total: 5, shown: 4 })).toThrow(
      "shown (4) cannot exceed the traceable claims (3 of 5).",
    );
  });
});

describe("refusedExplanation", () => {
  it("distinguishes off-topic from in-scope-but-empty", () => {
    expect(refusedExplanation("off_topic")).toBe("out of scope");
    expect(refusedExplanation("in_scope_empty")).toBe("unable to answer · 0 references found");
  });
});

describe("answerFooter", () => {
  it.each([
    [0, 0, 0, "0 claims · 0 episodes · high confidence · 2026-07-17 · 0 superseded excluded"],
    [1, 1, 1, "1 claim · 1 episode · high confidence · 2026-07-17 · 1 superseded excluded"],
    [7, 5, 1, "7 claims · 5 episodes · high confidence · 2026-07-17 · 1 superseded excluded"],
  ])("claims=%i episodes=%i superseded=%i → %s", (claims, episodes, superseded, expected) => {
    expect(
      answerFooter({
        claims,
        episodes,
        confidenceTier: "high",
        snapshotDate: "2026-07-17",
        supersededExcluded: superseded,
      }),
    ).toBe(expected);
  });
});

describe("panelFooter", () => {
  it.each([
    [0, 0, 0, "0 claims · 0 sources · revision 2026-07-17 · 0 superseded shown"],
    [1, 1, 0, "1 claim · 1 source · revision 2026-07-17 · 0 superseded shown"],
    [12, 7, 2, "12 claims · 7 sources · revision 2026-07-17 · 2 superseded shown"],
  ])("claims=%i sources=%i superseded=%i → %s", (claims, sources, superseded, expected) => {
    expect(
      panelFooter({ claims, sources, revisionDate: "2026-07-17", supersededShown: superseded }),
    ).toBe(expected);
  });
});

describe("sourcesLine", () => {
  it.each([
    [1, "2026-07-30", "[1 source · newest jul 2026]"],
    [3, "2026-07-30", "[3 sources · newest jul 2026]"],
    [5, "2025-12-04", "[5 sources · newest dec 2025]"],
    [2, "2026-01-09", "[2 sources · newest jan 2026]"],
  ])("sources=%i newest=%s → %s", (sources, newestDate, expected) => {
    expect(sourcesLine({ sources, newestDate })).toBe(expected);
  });

  it("refuses N = 0: with no sources there is no newest date, so the line is omitted", () => {
    expect(() => sourcesLine({ sources: 0, newestDate: "2026-07-30" })).toThrow(
      "sourcesLine needs at least one source; omit the line when there are none.",
    );
  });

  it("rejects a date with an impossible month", () => {
    expect(() => sourcesLine({ sources: 1, newestDate: "2026-13-01" })).toThrow(
      'newestDate has no valid month (got "2026-13-01").',
    );
  });
});

describe("canvasStatus", () => {
  it.each([
    [0, "0 entities · 0 typed · 0 co-mention · snapshot 2026-07-17"],
    [1, "1 entity · 1 typed · 1 co-mention · snapshot 2026-07-17"],
    [3294, "3294 entities · 3294 typed · 3294 co-mention · snapshot 2026-07-17"],
  ])("wide, n=%i → %s", (n, expected) => {
    expect(canvasStatus({ entities: n, typed: n, comention: n, snapshotDate: "2026-07-17" })).toBe(
      expected,
    );
  });

  it.each([
    [0, "0 entities · snapshot 2026-07-17"],
    [1, "1 entity · snapshot 2026-07-17"],
    [2, "2 entities · snapshot 2026-07-17"],
  ])("narrow, entities=%i → %s", (entities, expected) => {
    expect(
      canvasStatus({ entities, typed: 9, comention: 9, snapshotDate: "2026-07-17" }, "narrow"),
    ).toBe(expected);
  });
});

describe("input guards", () => {
  it.each([-1, 1.5, Number.NaN])("rejects a count of %s", (bad) => {
    expect(() => groundedExplanation({ claims: bad, episodes: 1, confidenceTier: "high" })).toThrow(
      `claims must be a non-negative integer (got ${String(bad)}).`,
    );
  });

  it.each(["2026-7-17", "17/07/2026", "", "2026-07-17T00:00:00Z"])(
    "rejects a non-ISO date %j",
    (bad) => {
      expect(() =>
        panelFooter({ claims: 1, sources: 1, revisionDate: bad, supersededShown: 0 }),
      ).toThrow(`revisionDate must be an ISO date YYYY-MM-DD (got "${bad}").`);
    },
  );

  it("rejects an unknown confidence tier instead of printing it", () => {
    expect(() => groundedExplanation({ claims: 1, episodes: 1, confidenceTier: "sure" })).toThrow(
      'Unknown confidence_tier "sure"',
    );
  });

  it("joins segments with the exported separator", () => {
    expect(LOCKED_SEPARATOR).toBe(" · ");
    expect(refusedExplanation("in_scope_empty").split(LOCKED_SEPARATOR)).toEqual([
      "unable to answer",
      "0 references found",
    ]);
  });
});
