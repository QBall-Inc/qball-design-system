import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { DetailAdapterError, adaptConnection } from "./adapter";
import { resolveReplacement } from "./claims";
import type { Claim } from "./types";

// vitest runs with the package directory as cwd.
const DETAIL_DIR = resolve(process.cwd(), "../../fixtures/qubrain/provisional-detail");
const SRC_DIR = resolve(process.cwd(), "src");

function fixture(name: string): Record<string, unknown> {
  return JSON.parse(readFileSync(resolve(DETAIL_DIR, `${name}.json`), "utf8")) as Record<
    string,
    unknown
  >;
}

function claimsOf(name: string): Claim[] {
  const detail = adaptConnection("typed", fixture(name));
  if (detail.claims === undefined) throw new Error(`${name}: no claims adapted`);
  return detail.claims;
}

const MEMORY_SOURCE = {
  episode_id: "ep-demo-0001",
  title: "Memory in the age of agents",
  url: "https://example.com/memory-in-the-age-of-agents",
  source_type: "blog",
  save_date: "2026-07-02",
};

const AGENTS_SOURCE = {
  episode_id: "ep-demo-0002",
  title: "LLM-powered autonomous agents",
  url: "https://example.com/llm-powered-autonomous-agents",
  source_type: "blog",
  save_date: "2026-05-18",
};

describe("adaptConnection — typed hops", () => {
  it("maps freshness dates and joins each claim to its sibling provenance entry", () => {
    expect(adaptConnection("typed", fixture("typed-connection"))).toEqual({
      kind: "typed",
      claims: [
        {
          claim_id: 101,
          claim_text: "episodic memory outperforms flat context past 100 turns",
          confidence: 0.94,
          confidence_tier: "high",
          valid_from: "2026-05-18",
          endorsement_tier: "endorsed",
          verification: "verified",
          source: MEMORY_SOURCE,
        },
        {
          claim_id: 102,
          claim_text: "memory compaction loses retrieval accuracy on long-running agents",
          confidence: 0.71,
          confidence_tier: "medium",
          valid_from: "2026-05-18",
          source: AGENTS_SOURCE,
        },
      ],
    });
  });

  it("carries only public contract fields (backend-only fields are dropped)", () => {
    const [claim] = claimsOf("typed-connection");
    expect(claim).toBeDefined();
    const keys = Object.keys(claim ?? {});
    expect(keys.length).toBeGreaterThan(0);
    for (const backendOnly of ["subject", "relation", "object", "episode_id", "freshness"]) {
      expect(keys).not.toContain(backendOnly);
    }
  });

  it("exposes a superseded claim's replacement when the payload carries it", () => {
    const claims = claimsOf("typed-superseded-with-replacement");
    const retired = claims.find((c) => c.claim_id === 201);
    expect(retired).toMatchObject({ valid_to: "2026-07-02", superseded_by_claim_id: 202 });
    if (retired === undefined) throw new Error("claim 201 missing");
    const replacement = resolveReplacement(retired, claims);
    expect(replacement?.kind).toBe("available");
    expect(replacement?.kind === "available" && replacement.claim.claim_text).toBe(
      "episodic recall beats flat context for long-running agents",
    );
  });

  it("marks the replacement unavailable when the payload does not carry it", () => {
    const claims = claimsOf("typed-superseded-without-replacement");
    const retired = claims.find((c) => c.claim_id === 301);
    if (retired === undefined) throw new Error("claim 301 missing");
    expect(resolveReplacement(retired, claims)).toEqual({ kind: "unavailable", claim_id: 399 });
  });

  it("keeps a claim whose source is unresolved, marking the source unavailable", () => {
    const claims = claimsOf("typed-superseded-without-replacement");
    expect(claims.map((c) => c.claim_id)).toEqual([301, 302, 303]);
    expect(claims.find((c) => c.claim_id === 302)?.source).toEqual({
      kind: "unavailable",
      episode_id: "ep-demo-0009",
    });
    // 303 points at an episode the provenance array does not include at all.
    expect(claims.find((c) => c.claim_id === 303)?.source).toEqual({
      kind: "unavailable",
      episode_id: "ep-demo-0404",
    });
  });

  it("marks the source unavailable when a claim names no episode", () => {
    const payload = fixture("typed-connection");
    const [first] = payload["typed_claims"] as Record<string, unknown>[];
    const detail = adaptConnection("typed", {
      typed_claims: [{ ...first, episode_id: null }],
      provenance: payload["provenance"],
    });
    expect(detail.claims?.[0]?.source).toEqual({ kind: "unavailable", episode_id: null });
  });

  it("treats an unresolved entry as unavailable even when it carries a fallback title", () => {
    // The backend fills `title` from a fallback when it has no record (resolved: false).
    const detail = adaptConnection("comention", {
      shared_episodes: [{ ...MEMORY_SOURCE, resolved: false }],
    });
    expect(detail.shared_sources).toEqual([{ kind: "unavailable", episode_id: "ep-demo-0001" }]);
  });

  it("treats a 'resolved' entry with a null field as unavailable, not as an empty source", () => {
    const detail = adaptConnection("comention", {
      shared_episodes: [{ ...MEMORY_SOURCE, resolved: true, url: null }],
    });
    expect(detail.shared_sources).toEqual([{ kind: "unavailable", episode_id: "ep-demo-0001" }]);
  });
});

describe("adaptConnection — co-mention hops", () => {
  it("maps shared episodes to sources, keeping the unresolved one as unavailable", () => {
    expect(adaptConnection("comention", fixture("comention-connection"))).toEqual({
      kind: "comention",
      shared_sources: [
        MEMORY_SOURCE,
        {
          episode_id: "ep-demo-0003",
          title: "Context engineering notes",
          url: "https://example.com/context-engineering-notes",
          source_type: "web",
          save_date: "2026-07-30",
        },
        { kind: "unavailable", episode_id: "ep-demo-0009" },
      ],
    });
  });
});

describe("adaptConnection — fails fast on malformed payloads", () => {
  it.each([
    ["a non-object payload", null, "(root)"],
    ["typed_claims that is not an array", { typed_claims: {} }, "typed_claims"],
    [
      "a claim without freshness",
      { typed_claims: [{ claim_id: 1, claim_text: "x", confidence: 1, confidence_tier: "high" }] },
      "typed_claims[0].freshness",
    ],
    [
      "a claim whose claim_id is a string",
      {
        typed_claims: [
          {
            claim_id: "1",
            claim_text: "x",
            confidence: 1,
            confidence_tier: "high",
            freshness: { valid_from: "2026-01-01" },
          },
        ],
      },
      "typed_claims[0].claim_id",
    ],
    [
      "freshness without valid_from",
      {
        typed_claims: [
          { claim_id: 1, claim_text: "x", confidence: 1, confidence_tier: "high", freshness: {} },
        ],
      },
      "typed_claims[0].freshness.valid_from",
    ],
    [
      "a provenance entry without episode_id",
      { typed_claims: [], provenance: [{ resolved: true }] },
      "provenance[0].episode_id",
    ],
  ])("rejects %s, naming the path", (_label, payload, path) => {
    expect(() => adaptConnection("typed", payload)).toThrow(DetailAdapterError);
    expect(() => adaptConnection("typed", payload)).toThrow(`at ${path}:`);
  });
});

describe("adaptConnection — boundary guards", () => {
  it.each([-0.01, 1.5])("rejects a confidence of %s (must be 0..1)", (confidence) => {
    const payload = fixture("typed-connection");
    const [first] = payload["typed_claims"] as Record<string, unknown>[];
    expect(() => adaptConnection("typed", { typed_claims: [{ ...first, confidence }] })).toThrow(
      `at typed_claims[0].confidence: expected a value between 0 and 1, got ${confidence}`,
    );
  });

  it("rejects an unknown edge kind from an untyped caller", () => {
    const kind = "asserted" as unknown as "typed";
    expect(() => adaptConnection(kind, fixture("typed-connection"))).toThrow(
      'at kind: expected "typed" or "comention", got "asserted"',
    );
  });
});

describe("single change point", () => {
  it("only adapter.ts knows the provisional `freshness` nesting", () => {
    const sources = readdirSync(SRC_DIR, { recursive: true, encoding: "utf8" }).filter(
      (file) => file.endsWith(".ts") && !file.endsWith(".test.ts"),
    );
    expect(sources).toContain("adapter.ts");
    const aware = sources.filter((file) =>
      readFileSync(resolve(SRC_DIR, file), "utf8").includes("freshness"),
    );
    expect(aware).toEqual(["adapter.ts"]);
  });
});
