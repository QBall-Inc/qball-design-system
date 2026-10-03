import { describe, expect, it } from "vitest";
import { mulberry32, rngForRevision, seedFromRevision } from "./prng";
import { loadMockBundle } from "./test-helpers";

describe("seedFromRevision", () => {
  it("is a stable 32-bit unsigned hash of the revision string", () => {
    // FNV-1a 32-bit reference values: offset basis for "", 0xe40c292c for "a".
    expect(seedFromRevision("")).toBe(0x811c9dc5);
    expect(seedFromRevision("a")).toBe(0xe40c292c);
  });

  it("gives the mock revision one seed, and a different revision another", () => {
    const { revision } = loadMockBundle();
    expect(seedFromRevision(revision)).toBe(seedFromRevision(revision));
    expect(seedFromRevision(`${revision}-next`)).not.toBe(seedFromRevision(revision));
  });
});

describe("mulberry32", () => {
  it("replays the same stream for the same seed and stays in [0, 1)", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const xs = Array.from({ length: 1000 }, () => a());
    const ys = Array.from({ length: 1000 }, () => b());
    expect(xs).toEqual(ys);
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
    // Not degenerate: a thousand draws are not all the same value.
    expect(new Set(xs).size).toBeGreaterThan(990);
  });

  it("diverges for different revisions", () => {
    const a = rngForRevision("rev-a");
    const b = rngForRevision("rev-b");
    expect([a(), a(), a()]).not.toEqual([b(), b(), b()]);
  });
});
