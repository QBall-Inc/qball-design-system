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
import { TEST_LABELS } from "./trust/test-fixtures";

// Expected strings are written out verbatim (plan AD-11); only the numeric,
// date and tier slots vary, plus the consumer-worded segments (TEST_LABELS).
// Every counted noun is covered at N = 0, 1 and > 1.

describe("groundedExplanation", () => {
  it.each([
    [0, 0, "0 claims · 0 sources · Evidence: high"],
    [1, 1, "1 claim · 1 source · Evidence: high"],
    [6, 4, "6 claims · 4 sources · Evidence: high"],
  ])("claims=%i sources=%i → %s", (claims, sources, expected) => {
    expect(groundedExplanation({ claims, sources, confidenceTier: "high" }, TEST_LABELS)).toBe(
      expected,
    );
  });

  it("passes the canonical tier to the consumer's evidence label (`med` → medium)", () => {
    const seen: string[] = [];
    const labels = {
      ...TEST_LABELS,
      evidence: (tier: string) => {
        seen.push(tier);
        return `Evidence: ${tier}`;
      },
    };
    expect(groundedExplanation({ claims: 2, sources: 1, confidenceTier: "med" }, labels)).toBe(
      "2 claims · 1 source · Evidence: medium",
    );
    expect(seen).toEqual(["medium"]);
  });

  it("an abstained label takes the evidence segment's place (labels not needed)", () => {
    expect(
      groundedExplanation({
        claims: 6,
        sources: 4,
        confidenceTier: "high",
        abstained: { label: "notes don't cover this" },
      }),
    ).toBe("6 claims · 4 sources · notes don't cover this");
  });

  it("still checks the tier on an abstained answer", () => {
    expect(() =>
      groundedExplanation({
        claims: 1,
        sources: 1,
        confidenceTier: "sure",
        abstained: { label: "x" },
      }),
    ).toThrow('Unknown confidence_tier "sure"');
  });

  it("without labels, a line with evidence fails with the fix", () => {
    expect(() => groundedExplanation({ claims: 1, sources: 1, confidenceTier: "high" })).toThrow(
      "groundedExplanation needs EvidenceLabels { outdated, evidence } (functions).",
    );
  });

  it.each([
    ["", "EvidenceLabels.evidence must return a non-empty string."],
    ["   ", "EvidenceLabels.evidence must return a non-empty string."],
  ])("rejects an empty evidence label %j", (bad, message) => {
    const labels = { ...TEST_LABELS, evidence: () => bad };
    expect(() =>
      groundedExplanation({ claims: 1, sources: 1, confidenceTier: "high" }, labels),
    ).toThrow(message);
  });
});

describe("withheldExplanation", () => {
  it.each([
    [0, 0, "0 figures untraceable · 0 claims shown"],
    [1, 1, "1 figure untraceable · 1 claim shown"],
    [2, 12, "2 figures untraceable · 12 claims shown"],
  ])("untraceableFigures=%i claimsShown=%i → %s", (untraceableFigures, claimsShown, expected) => {
    expect(withheldExplanation({ untraceableFigures, claimsShown })).toBe(expected);
  });

  it("rejects counts that are not non-negative integers", () => {
    expect(() => withheldExplanation({ untraceableFigures: -1, claimsShown: 0 })).toThrow(
      "untraceableFigures must be a non-negative integer (got -1).",
    );
    expect(() => withheldExplanation({ untraceableFigures: 1, claimsShown: 1.5 })).toThrow(
      "claimsShown must be a non-negative integer (got 1.5).",
    );
  });
});

describe("refusedExplanation", () => {
  it("has one locked line per refusal kind", () => {
    expect(refusedExplanation("out_of_scope")).toBe("out of scope");
    expect(refusedExplanation("no_evidence")).toBe("unable to answer · 0 references found");
  });

  it("rejects a kind outside the contract (abstained is a grounded flag, not a refusal)", () => {
    expect(() => refusedExplanation("abstained" as never)).toThrow(
      'Unknown refusal kind "abstained" — expected out_of_scope or no_evidence.',
    );
  });
});

describe("answerFooter", () => {
  it.each([
    [0, 0, 0, "0 claims · 0 sources · 2026-07-17 · 0 outdated claims · Evidence: high"],
    [1, 1, 1, "1 claim · 1 source · 2026-07-17 · 1 outdated claim · Evidence: high"],
    [7, 5, 1, "7 claims · 5 sources · 2026-07-17 · 1 outdated claim · Evidence: high"],
  ])("claims=%i sources=%i superseded=%i → %s", (claims, sources, superseded, expected) => {
    expect(
      answerFooter(
        {
          claims,
          sources,
          confidenceTier: "high",
          revisionDate: "2026-07-17",
          supersededExcluded: superseded,
        },
        TEST_LABELS,
      ),
    ).toBe(expected);
  });

  it("passes the superseded count to the consumer's outdated label", () => {
    const labels = { ...TEST_LABELS, outdated: (k: number) => `K=${String(k)}` };
    expect(
      answerFooter({ claims: 3, sources: 2, confidenceTier: "low", supersededExcluded: 4 }, labels),
    ).toBe("3 claims · 2 sources · K=4 · Evidence: low");
  });

  it("needs the consumer labels (no DS wording)", () => {
    expect(() =>
      answerFooter(
        { claims: 1, sources: 1, confidenceTier: "high", supersededExcluded: 0 },
        undefined as never,
      ),
    ).toThrow("answerFooter needs EvidenceLabels { outdated, evidence } (functions).");
    expect(() =>
      answerFooter(
        { claims: 1, sources: 1, confidenceTier: "high", supersededExcluded: 0 },
        null as never,
      ),
    ).toThrow("answerFooter needs EvidenceLabels { outdated, evidence } (functions).");
    expect(() =>
      answerFooter(
        { claims: 1, sources: 1, confidenceTier: "high", supersededExcluded: 0 },
        { ...TEST_LABELS, outdated: () => "" },
      ),
    ).toThrow("EvidenceLabels.outdated must return a non-empty string.");
  });
});

describe("answerFooter without a revision date (owner S123: drop the segment)", () => {
  it.each([
    [0, 0, 0, undefined, "0 claims · 0 sources · 0 outdated claims · Evidence: high"],
    [1, 1, 1, null, "1 claim · 1 source · 1 outdated claim · Evidence: high"],
    [7, 5, 2, null, "7 claims · 5 sources · 2 outdated claims · Evidence: high"],
  ])(
    "claims=%i sources=%i superseded=%i date=%s → %s",
    (claims, sources, superseded, revisionDate, expected) => {
      expect(
        answerFooter(
          {
            claims,
            sources,
            confidenceTier: "high",
            revisionDate,
            supersededExcluded: superseded,
          },
          TEST_LABELS,
        ),
      ).toBe(expected);
    },
  );

  it("still rejects a present but malformed date", () => {
    expect(() =>
      answerFooter(
        {
          claims: 1,
          sources: 1,
          confidenceTier: "high",
          revisionDate: "",
          supersededExcluded: 0,
        },
        TEST_LABELS,
      ),
    ).toThrow('revisionDate must be an ISO date YYYY-MM-DD (got "").');
  });
});

describe("groundedExplanation for a no-evidence answer (owner S123: counts, no confidence)", () => {
  it("reads `0 claims · 0 sources` without a tier", () => {
    expect(groundedExplanation({ claims: 0, sources: 0 })).toBe("0 claims · 0 sources");
  });

  it.each([
    [1, 0],
    [0, 1],
    [3, 2],
  ])("requires a tier when there is evidence (claims=%i sources=%i)", (claims, sources) => {
    expect(() => groundedExplanation({ claims, sources })).toThrow(
      "confidenceTier is required unless the answer has no evidence (0 claims, 0 sources).",
    );
  });

  it("keeps the tier when one is given at zero counts", () => {
    expect(groundedExplanation({ claims: 0, sources: 0, confidenceTier: "low" }, TEST_LABELS)).toBe(
      "0 claims · 0 sources · Evidence: low",
    );
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
    expect(() =>
      groundedExplanation({ claims: bad, sources: 1, confidenceTier: "high" }, TEST_LABELS),
    ).toThrow(`claims must be a non-negative integer (got ${String(bad)}).`);
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
    expect(() =>
      groundedExplanation({ claims: 1, sources: 1, confidenceTier: "sure" }, TEST_LABELS),
    ).toThrow('Unknown confidence_tier "sure"');
  });

  it("joins segments with the exported separator", () => {
    expect(LOCKED_SEPARATOR).toBe(" · ");
    expect(refusedExplanation("no_evidence").split(LOCKED_SEPARATOR)).toEqual([
      "unable to answer",
      "0 references found",
    ]);
  });
});
