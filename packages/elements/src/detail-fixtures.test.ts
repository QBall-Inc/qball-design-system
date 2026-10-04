import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveReplacement } from "./claims";
import { type Claim, type ClaimSource, type ConnectionDetail, isSourceUnavailable } from "./types";

// vitest runs with the package directory as cwd.
const DETAIL_DIR = resolve(process.cwd(), "../../fixtures/qubrain/detail");

const CLAIM_KEYS = new Set([
  "claim_id",
  "claim_text",
  "confidence",
  "confidence_tier",
  "valid_from",
  "valid_to",
  "superseded_by_claim_id",
  "endorsement_tier",
  "verification",
  "source",
]);
const SOURCE_KEYS = ["episode_id", "title", "url", "source_type", "save_date"];

function load(name: string): ConnectionDetail {
  return JSON.parse(readFileSync(resolve(DETAIL_DIR, `${name}.json`), "utf8")) as ConnectionDetail;
}

function claimsOf(name: string): Claim[] {
  const { claims } = load(name);
  if (claims === undefined) throw new Error(`${name} has no claims`);
  return claims;
}

function byId(claims: readonly Claim[], id: number): Claim {
  const found = claims.find((claim) => claim.claim_id === id);
  if (found === undefined) throw new Error(`claim ${id} not in fixture`);
  return found;
}

function expectSourceShape(source: ClaimSource): void {
  if (isSourceUnavailable(source)) {
    expect(Object.keys(source).sort()).toEqual(["episode_id", "kind"]);
  } else {
    expect(Object.keys(source).sort()).toEqual([...SOURCE_KEYS].sort());
    for (const key of SOURCE_KEYS) expect(source[key as keyof typeof source]).toBeTypeOf("string");
  }
}

describe("detail fixtures are in the input-model shape", () => {
  const names = readdirSync(DETAIL_DIR)
    .filter((file) => file.endsWith(".json"))
    .map((file) => file.replace(/\.json$/, ""));

  it("covers typed and co-mention hops", () => {
    expect(names.length).toBeGreaterThanOrEqual(4);
    const kinds = new Set(names.map((name) => load(name).kind));
    expect(kinds).toEqual(new Set(["typed", "comention"]));
  });

  it("every claim carries only input-model fields and a well-formed source", () => {
    const typed = names.filter((name) => load(name).kind === "typed");
    const claims = typed.flatMap(claimsOf);
    expect(claims.length).toBeGreaterThan(0);
    for (const claim of claims) {
      for (const key of Object.keys(claim)) expect(CLAIM_KEYS).toContain(key);
      expect(claim.confidence).toBeGreaterThanOrEqual(0);
      expect(claim.confidence).toBeLessThanOrEqual(1);
      expectSourceShape(claim.source);
    }
  });

  it("every co-mention source is well-formed", () => {
    const { shared_sources: sources } = load("comention-connection");
    expect(sources?.length).toBeGreaterThan(0);
    for (const source of sources ?? []) expectSourceShape(source);
  });
});

describe("detail fixtures exercise the trust semantics", () => {
  it("a superseded claim resolves to its replacement when it is among the claims", () => {
    const claims = claimsOf("typed-superseded-with-replacement");
    expect(resolveReplacement(byId(claims, 201), claims)).toEqual({
      kind: "available",
      claim: byId(claims, 202),
    });
  });

  it("a superseded claim whose replacement is missing is marked unavailable", () => {
    const claims = claimsOf("typed-superseded-without-replacement");
    expect(resolveReplacement(byId(claims, 301), claims)).toEqual({
      kind: "unavailable",
      claim_id: 399,
    });
  });

  it("claims with unresolved sources keep the claim and mark the source unavailable", () => {
    const claims = claimsOf("typed-superseded-without-replacement");
    expect(byId(claims, 302).source).toEqual({ kind: "unavailable", episode_id: "ep-demo-0009" });
    expect(byId(claims, 303).source).toEqual({ kind: "unavailable", episode_id: "ep-demo-0404" });
  });

  it("a co-mention hop keeps its unresolved source alongside the real ones", () => {
    const sources = load("comention-connection").shared_sources ?? [];
    expect(sources.map(isSourceUnavailable)).toEqual([false, false, true]);
  });
});
