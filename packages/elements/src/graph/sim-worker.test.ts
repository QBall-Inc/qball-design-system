import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { rngForRevision } from "./prng";
import { DEFAULT_SIM_CONFIG, buildSimEdges, makeSim, resolvePositions } from "./sim";
import { runSettle } from "./sim-worker";
import type { SettleRequest, SettleUpdate } from "./sim-worker-protocol";
import source from "./sim-worker.inline";
import { loadMockBundle, syntheticBundle } from "./test-helpers";

const bytes = (a: Float32Array) => Buffer.from(a.buffer, a.byteOffset, a.byteLength);

function requestFor(bundle: ReturnType<typeof loadMockBundle>): SettleRequest {
  return {
    nodeCount: bundle.nodes.length,
    edges: buildSimEdges(bundle),
    config: { ...DEFAULT_SIM_CONFIG },
    revision: bundle.revision,
  };
}

function collect(request: SettleRequest): { update: SettleUpdate; transfer: Transferable[] }[] {
  const posts: { update: SettleUpdate; transfer: Transferable[] }[] = [];
  runSettle(request, (update, transfer) => posts.push({ update, transfer }));
  return posts;
}

describe("runSettle (the settle worker's work)", () => {
  const mock = loadMockBundle();
  const posts = collect(requestFor(mock));

  it("ends on exactly the main-thread layout for the same bundle", () => {
    expect(posts.length).toBeGreaterThan(0);
    const last = posts.at(-1)!.update;
    expect(last.done).toBe(true);
    expect(bytes(last.pos).equals(bytes(resolvePositions(mock).positions))).toBe(true);
  });

  it("posts once per step, with progress rising to 1 and only the last marked done", () => {
    expect(posts).toHaveLength(DEFAULT_SIM_CONFIG.iters);
    const progress = posts.map((p) => p.update.progress);
    expect(progress.every((v, i) => i === 0 || v > progress[i - 1]!)).toBe(true);
    expect(progress.at(-1)).toBe(1);
    expect(posts.filter((p) => p.update.done)).toHaveLength(1);
  });

  it("posts a fresh copy each step and transfers its buffer", () => {
    const buffers = new Set(posts.map((p) => p.update.pos.buffer));
    expect(buffers.size).toBe(posts.length);
    for (const { update, transfer } of posts) {
      expect(update.pos).toHaveLength(mock.nodes.length * 3);
      expect(transfer).toEqual([update.pos.buffer]);
    }
  });

  it("re-seeds from the request's revision", () => {
    const a = syntheticBundle("rev-a");
    const b = syntheticBundle("rev-b");
    const finalOf = (bundle: typeof a) => collect(requestFor(bundle)).at(-1)!.update.pos;
    expect(bytes(finalOf(a)).equals(bytes(resolvePositions(a).positions))).toBe(true);
    expect(bytes(finalOf(a)).equals(bytes(finalOf(b)))).toBe(false);
  });
});

describe("makeSim into an existing buffer (the canvas's fallback restart)", () => {
  const bundle = syntheticBundle("into");
  const n = bundle.nodes.length;
  const edges = buildSimEdges(bundle);
  const fresh = () =>
    makeSim(n, edges, DEFAULT_SIM_CONFIG, rngForRevision(bundle.revision)).pos.slice();

  it("writes the seeded start into the given buffer and steps it in place", () => {
    const buffer = new Float32Array(n * 3).fill(12345);
    const sim = makeSim(n, edges, DEFAULT_SIM_CONFIG, rngForRevision(bundle.revision), buffer);
    expect(sim.pos).toBe(buffer);
    expect(bytes(buffer).equals(bytes(fresh()))).toBe(true);
    sim.step();
    expect(bytes(buffer).equals(bytes(fresh()))).toBe(false);
  });

  it("rejects a buffer of the wrong size", () => {
    expect(() =>
      makeSim(n, edges, DEFAULT_SIM_CONFIG, rngForRevision("x"), new Float32Array(n * 3 - 1)),
    ).toThrow(RangeError);
  });
});

describe("the inline worker source (what './graph' ships)", () => {
  it("is one self-contained script with no module syntax", () => {
    expect(source.length).toBeGreaterThan(1000);
    expect(source).toContain("onmessage");
    expect(source).not.toMatch(/\bimport\s*[{("'*]|\bexport\s/);
  });

  it("runs as a classic worker script and settles to the main-thread layout", () => {
    const bundle = syntheticBundle("inline-run");
    const updates: SettleUpdate[] = [];
    const scope: {
      onmessage: ((event: { data: SettleRequest }) => void) | null;
      postMessage: (u: SettleUpdate) => void;
    } = { onmessage: null, postMessage: (u) => updates.push(u) };
    // A fresh V8 context whose global is `scope`, like a worker's own global scope.
    runInNewContext(source, scope);
    expect(typeof scope.onmessage).toBe("function");
    scope.onmessage!({ data: requestFor(bundle) });
    expect(scope.onmessage).toBeNull();
    expect(updates.at(-1)?.done).toBe(true);
    expect(bytes(updates.at(-1)!.pos).equals(bytes(resolvePositions(bundle).positions))).toBe(true);
  });
});
