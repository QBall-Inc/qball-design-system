// GraphCanvas mount in jsdom: the real canvas, real three.js scene objects and
// the real token CSS; only the WebGL renderer is a recording stand-in (WebGL
// rendering itself is covered in real Chromium by e2e/graph-canvas.spec.ts).

import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { canvasStatus } from "../locked-strings";
import type { SkeletonBundle } from "../types";
import { BundleValidationError } from "../validator";
import {
  GRAPH_CANVAS_MARKER,
  mountWith,
  type CanvasDeps,
  type GraphCanvasHandle,
  type GraphCanvasOptions,
  type GraphSelectDetail,
} from "./canvas";
import {
  frames,
  installTokenStyles,
  installWorkerStandIn,
  listenerLedger,
  recordingRendererFactory,
  recordingThree,
  type GpuLedger,
  type RecordingRenderer,
} from "./canvas-test-support";
import { DEFAULT_CANVAS_LABELS } from "./canvas-copy";
import { GraphCanvasError } from "./canvas-errors";
import { rngForRevision } from "./prng";
import { FIRST_UPDATE_TIMEOUT_MS } from "./settle-worker";
import { DEFAULT_SIM_CONFIG, buildSimEdges, makeSim, resolvePositions } from "./sim";
import { loadWithLayoutBundle, syntheticBundle } from "./test-helpers";

let removeStyles: () => void;
let host: HTMLElement;
let gpu: GpuLedger;
let renderers: RecordingRenderer[];
let deps: CanvasDeps;
const mounted: GraphCanvasHandle[] = [];

beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  removeStyles = installTokenStyles(document, host);
  gpu = recordingThree();
  const recorder = recordingRendererFactory(document);
  renderers = recorder.instances;
  deps = { loadThree: () => Promise.resolve(gpu.three), createRenderer: recorder.factory };
});

afterEach(() => {
  while (mounted.length) mounted.pop()!.destroy();
  document.body.replaceChildren();
  removeStyles();
});

async function mountCanvas(options: GraphCanvasOptions): Promise<GraphCanvasHandle> {
  const handle = await mountWith(host, options, deps);
  mounted.push(handle);
  return handle;
}

/** Node positions as uploaded to the point geometry (the first geometry a mount creates). */
function uploadedPositions(): Float32Array {
  const geometry = gpu.created[0] as unknown as {
    getAttribute(name: string): { array: Float32Array };
  };
  return geometry.getAttribute("position").array;
}

function uploadedDims(): Float32Array {
  const geometry = gpu.created[0] as unknown as {
    getAttribute(name: string): { array: Float32Array };
  };
  return geometry.getAttribute("aDim").array;
}

const nextEvent = <T>(type: string): Promise<CustomEvent<T>> =>
  new Promise((done) =>
    host.addEventListener(type, (e) => done(e as CustomEvent<T>), { once: true }),
  );

const escape = (target: EventTarget, init: KeyboardEventInit = {}): KeyboardEvent => {
  const event = new KeyboardEvent("keydown", {
    key: "Escape",
    bubbles: true,
    cancelable: true,
    ...init,
  });
  target.dispatchEvent(event);
  return event;
};

describe("GraphCanvas mount", () => {
  it("renders the canvas with the package marker, the HUD and the locked status line", async () => {
    const bundle = loadWithLayoutBundle();
    const handle = await mountCanvas({ data: bundle });
    await handle.settled;
    const canvas = host.querySelector("canvas")!;
    expect(canvas.dataset["qbEngine"]).toBe(GRAPH_CANVAS_MARKER);
    expect(canvas.getAttribute("aria-label")).toBe(DEFAULT_CANVAS_LABELS.canvas);
    expect(host.classList.contains("graphcanvas")).toBe(true);
    // jsdom lays nothing out (width 0), so the host is "narrow".
    expect(host.querySelector(".gc-status")!.textContent).toBe(
      canvasStatus(
        { entities: 3294, typed: 2857, comention: 10003, snapshotDate: bundle.stats.snapshot_date },
        "narrow",
      ),
    );
    expect(host.querySelector(".gc-hint")!.textContent).toBe(DEFAULT_CANVAS_LABELS.hintFine);
    expect(handle.snapshotDate).toBe("2026-07-17");
  });

  it("renders a precomputed layout unchanged, without simulating", async () => {
    const bundle = loadWithLayoutBundle();
    const handle = await mountCanvas({ data: bundle });
    await handle.settled; // resolves synchronously-settled: no settle frames needed
    const pos = uploadedPositions();
    bundle.nodes.forEach((node, i) => {
      const [x, y, z] = bundle.layout![String(node.id)]!;
      expect([pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]]).toEqual([
        Math.fround(x),
        Math.fround(y),
        Math.fround(z),
      ]);
    });
  });

  it("settles to the seeded layout of record: same revision, same positions (no unseeded randomness)", async () => {
    const bundle = syntheticBundle("seed-r1");
    const handle = await mountCanvas({ data: bundle });
    await handle.settled;
    const expected = resolvePositions(bundle).positions;
    expect(Array.from(uploadedPositions())).toEqual(Array.from(expected));
    expect(host.querySelector(".gc-status")!.textContent).toContain("5 entities");
  });

  it("shows hostile names as literal text and never parses them", async () => {
    const payload = `<img src=x onerror="window.__pwned=1">&"'`;
    const bundle = syntheticBundle("hostile-r1");
    bundle.nodes[1]!.name = payload; // highest eps: an always-on label
    const handle = await mountCanvas({ data: bundle });
    await handle.settled;
    expect(handle.select(payload)).toBe(true);
    await frames(window, 2);
    const label = [...host.querySelectorAll(".gc-label")].find((l) => l.textContent === payload);
    expect(label, "label renders the literal name").toBeDefined();
    expect(host.querySelector(".gc-chip b")!.textContent).toBe(payload);
    expect(host.querySelector("img")).toBeNull();
    expect((window as unknown as { __pwned?: number }).__pwned).toBeUndefined();
  });

  it("styles labels from graph.css: inline style is position only", async () => {
    const handle = await mountCanvas({ data: syntheticBundle() });
    await handle.settled;
    await frames(window, 2);
    const labels = [...host.querySelectorAll<HTMLElement>(".gc-label")];
    expect(labels.length).toBeGreaterThan(0);
    for (const label of labels) {
      const props = [...Array(label.style.length).keys()].map((i) => label.style.item(i));
      expect(props.every((p) => p === "left" || p === "top")).toBe(true);
    }
    const style = getComputedStyle(labels[0]!);
    expect(style.getPropertyValue("text-shadow")).toContain("var(--bg-primary)");
  });
});

describe("GraphCanvas selection and filter", () => {
  it("emits select with the budgeted neighbor list, grows it on expand, and clears", async () => {
    const bundle = loadWithLayoutBundle();
    const handle = await mountCanvas({ data: bundle });
    await handle.settled;
    // The node with the most neighbors (a hub: far more than the budget of 20).
    const degree = new Map<number, number>();
    for (const e of [...bundle.typed_edges, ...bundle.comention_edges]) {
      degree.set(e.a, (degree.get(e.a) ?? 0) + 1);
      degree.set(e.b, (degree.get(e.b) ?? 0) + 1);
    }
    const [hubId, hubDegree] = [...degree].sort((x, y) => y[1] - x[1])[0]!;
    expect(hubDegree).toBeGreaterThan(40);

    const selected = nextEvent<GraphSelectDetail>("select");
    expect(handle.select(hubId)).toBe(true);
    const detail = (await selected).detail;
    expect(detail.node.id).toBe(hubId);
    expect(detail.total).toBe(hubDegree);
    expect(detail.neighbors).toHaveLength(20);
    expect(detail.neighbors.every((n) => typeof n.typed === "boolean" && n.weight >= 1)).toBe(true);
    // Typed (asserted) neighbors rank ahead of co-mention ones.
    const firstCo = detail.neighbors.findIndex((n) => !n.typed);
    if (firstCo >= 0) expect(detail.neighbors.slice(firstCo).every((n) => !n.typed)).toBe(true);
    expect(host.querySelector(".gc-chip")!.textContent).toContain("showing 20 of");

    const grown = nextEvent<GraphSelectDetail>("select");
    expect(handle.expandNeighbors()).toBe(true);
    const more = (await grown).detail;
    expect(more.neighbors).toHaveLength(40);
    expect(more.neighbors.slice(0, 20)).toEqual(detail.neighbors);

    const cleared = nextEvent("clear");
    handle.clearSelection();
    await cleared;
    expect(host.querySelector<HTMLElement>(".gc-chip")!.hidden).toBe(true);
  });

  it("selects by canonical name, and an unknown name is a no-op returning false", async () => {
    const handle = await mountCanvas({ data: syntheticBundle() });
    let events = 0;
    host.addEventListener("select", () => events++);
    expect(handle.select("no such entity")).toBe(false);
    expect(handle.select(99999)).toBe(false);
    expect(events).toBe(0);
    expect(handle.select("beta toolkit")).toBe(true);
    expect(events).toBe(1);
  });

  it("ghosts non-matching nodes and shows the empty-filter note with filter {matches:0}", async () => {
    const handle = await mountCanvas({ data: syntheticBundle() });
    await handle.settled;
    const filtered = nextEvent<{ matches: number }>("filter");
    expect(handle.setFilter((n) => n.cls === "tool")).toBe(1);
    expect((await filtered).detail.matches).toBe(1);
    expect(Array.from(uploadedDims())).toEqual([0.06, 1, 0.06, 0.06, 0.06].map(Math.fround));

    const empty = nextEvent<{ matches: number }>("filter");
    expect(handle.setFilter(() => false)).toBe(0);
    expect((await empty).detail.matches).toBe(0);
    const note = host.querySelector<HTMLElement>(".gc-note")!;
    expect(note.hidden).toBe(false);
    expect(note.textContent).toBe(DEFAULT_CANVAS_LABELS.emptyFilter);

    handle.setFilter(null);
    expect(note.hidden).toBe(true);
  });

  it("drops (and announces) a selection the new filter excludes", async () => {
    const handle = await mountCanvas({ data: syntheticBundle() });
    handle.select("beta toolkit");
    const cleared = nextEvent("clear");
    handle.setFilter((n) => n.cls === "model");
    await cleared;
    expect(host.querySelector<HTMLElement>(".gc-chip")!.hidden).toBe(true);
    expect(handle.select("beta toolkit")).toBe(true); // still selectable once the filter allows it
  });
});

describe("GraphCanvas setData", () => {
  it("swaps revisions cleanly: names resolve in the new bundle, GPU objects match a fresh mount", async () => {
    const handle = await mountCanvas({ data: syntheticBundle("rev-a") });
    await handle.settled;
    const freshLive = gpu.live();

    // Same names, different revision-scoped ids.
    const next = syntheticBundle("rev-b");
    const shift = (id: number): number => id + 100;
    next.nodes.forEach((n) => (n.id = shift(n.id)));
    next.typed_edges.forEach((e) => ((e.a = shift(e.a)), (e.b = shift(e.b))));
    next.comention_edges.forEach((e) => ((e.a = shift(e.a)), (e.b = shift(e.b))));

    handle.select("beta toolkit");
    handle.setData(next);
    handle.setData(next);
    await handle.settled;
    expect(gpu.live()).toBe(freshLive);
    expect(renderers).toHaveLength(1);
    expect(host.querySelectorAll("canvas")).toHaveLength(1);
    expect(host.querySelector<HTMLElement>(".gc-chip")!.hidden).toBe(true);

    const selected = nextEvent<GraphSelectDetail>("select");
    expect(handle.select("beta toolkit")).toBe(true);
    expect((await selected).detail.node.id).toBe(111);
    expect(handle.select(11)).toBe(false); // the old revision's id means nothing now
  });

  it("rejects an invalid bundle with invalid-bundle and keeps the current graph", async () => {
    const handle = await mountCanvas({ data: syntheticBundle() });
    expect(() => handle.setData({ revision: "x" } as unknown as SkeletonBundle)).toThrow(
      GraphCanvasError,
    );
    expect(handle.select("beta toolkit")).toBe(true);
  });
});

describe("GraphCanvas destroy", () => {
  it("disposes every geometry, material and the renderer, removes every listener, and stops rendering", async () => {
    const ledger = listenerLedger([document, window, host]);
    try {
      const handle = await mountWith(host, { data: syntheticBundle() }, deps);
      await handle.settled;
      const canvas = renderers[0]!.domElement;
      const canvasLedger = listenerLedger([canvas]);
      handle.setData(syntheticBundle("rev-2")); // re-attaches canvas listeners
      expect(canvasLedger.net()).toBeGreaterThan(0);
      handle.destroy();
      expect(gpu.created.length).toBeGreaterThan(0);
      expect(gpu.live()).toBe(0);
      expect(renderers[0]!.disposed).toBe(true);
      expect(ledger.net()).toBe(0);
      expect(canvasLedger.net()).toBe(0);
      canvasLedger.restore();
      expect(host.childElementCount).toBe(0);
      expect(host.classList.contains("graphcanvas")).toBe(false);
      const renders = renderers[0]!.renders;
      await frames(window, 3);
      expect(renderers[0]!.renders).toBe(renders);
    } finally {
      ledger.restore();
    }
  });
});

describe("GraphCanvas lifecycle edges", () => {
  it("releases `settled` when the bundle is replaced or the canvas destroyed mid-settle", async () => {
    const handle = await mountCanvas({ data: syntheticBundle("mid-a") });
    const outcome = (p: Promise<void>): Promise<string> =>
      Promise.race([
        p.then(() => "released"),
        new Promise<string>((done) => setTimeout(() => done("hung"), 1000)),
      ]);
    const first = handle.settled;
    handle.setData(syntheticBundle("mid-b")); // first bundle never finished settling
    expect(await outcome(first)).toBe("released");
    const second = handle.settled;
    handle.destroy();
    expect(await outcome(second)).toBe("released");
  });

  it("goes inert after context loss: GPU objects released, no further frames, handle calls are no-ops", async () => {
    const handle = await mountCanvas({ data: syntheticBundle() });
    await handle.settled;
    host
      .querySelector("canvas")!
      .dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
    expect(gpu.live()).toBe(0);
    const renders = renderers[0]!.renders;
    expect(handle.select("beta toolkit")).toBe(false);
    expect(handle.setFilter(() => true)).toBe(0);
    await frames(window, 3);
    expect(renderers[0]!.renders).toBe(renders);
    handle.destroy();
    expect(renderers[0]!.disposed).toBe(true);
    expect(host.childElementCount).toBe(0);
  });

  it("a late destroy() of the old handle leaves a remounted canvas intact (retry flow)", async () => {
    const old = await mountCanvas({ data: syntheticBundle() });
    host
      .querySelector("canvas")!
      .dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
    const fresh = await mountCanvas({ data: syntheticBundle("retry-r2") });
    old.destroy();
    expect(host.querySelectorAll("canvas")).toHaveLength(1);
    expect(host.classList.contains("graphcanvas")).toBe(true);
    expect(fresh.select("beta toolkit")).toBe(true);
  });

  it("accepts labelBudget 0 (no always-on labels)", async () => {
    const handle = await mountCanvas({ data: syntheticBundle(), labelBudget: 0 });
    await handle.settled;
    expect(host.querySelectorAll(".gc-label")).toHaveLength(0);
  });

  it("fails fast on a host in a window-less document", async () => {
    const detached = document.implementation.createHTMLDocument("x").createElement("div");
    await expect(mountWith(detached, { data: syntheticBundle() }, deps)).rejects.toThrow(
      "mount() needs a host in a document with a window.",
    );
  });
});

describe("GraphCanvas Esc ownership", () => {
  async function selected(options: Partial<GraphCanvasOptions> = {}): Promise<GraphCanvasHandle> {
    const handle = await mountCanvas({ data: syntheticBundle(), ...options });
    handle.select("beta toolkit");
    return handle;
  }
  const chipShown = (): boolean => !host.querySelector<HTMLElement>(".gc-chip")!.hidden;

  it("clears the selection on Esc from inside the canvas", async () => {
    await selected();
    const event = escape(host.querySelector("canvas")!);
    expect(chipShown()).toBe(false);
    expect(event.defaultPrevented).toBe(true);
  });

  it("ignores Esc from elsewhere on the page when the pointer is not on the canvas", async () => {
    await selected();
    escape(document.body);
    expect(chipShown()).toBe(true);
  });

  it("acts on a page-level Esc while the pointer is over the canvas", async () => {
    await selected();
    host.dispatchEvent(new Event("pointerenter"));
    escape(document.body);
    expect(chipShown()).toBe(false);
  });

  it("yields while an aria-modal overlay is open", async () => {
    await selected();
    const overlay = document.createElement("div");
    overlay.setAttribute("aria-modal", "true");
    document.body.append(overlay);
    escape(host.querySelector("canvas")!);
    expect(chipShown()).toBe(true);
    // A closed overlay (visibility hidden, as ./chat's .qoverlay) does not block.
    overlay.style.visibility = "hidden";
    escape(host.querySelector("canvas")!);
    expect(chipShown()).toBe(false);
  });

  it("yields to suppressKeys, typing targets and already-handled events", async () => {
    let suppress = true;
    await selected({ suppressKeys: () => suppress });
    escape(host.querySelector("canvas")!);
    expect(chipShown()).toBe(true);
    suppress = false;

    const input = document.createElement("input");
    host.append(input);
    escape(input);
    expect(chipShown()).toBe(true);

    const claimed = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    });
    claimed.preventDefault();
    host.querySelector("canvas")!.dispatchEvent(claimed);
    expect(chipShown()).toBe(true);

    escape(host.querySelector("canvas")!);
    expect(chipShown()).toBe(false);
  });

  it("never acts on Q (the chat hotkey)", async () => {
    await selected();
    host
      .querySelector("canvas")!
      .dispatchEvent(new KeyboardEvent("keydown", { key: "q", bubbles: true, cancelable: true }));
    expect(chipShown()).toBe(true);
  });
});

describe("GraphCanvas failures", () => {
  it("rejects with three-unavailable and renders the error figure whose retry emits retry", async () => {
    const failing: CanvasDeps = {
      ...deps,
      loadThree: () => Promise.reject(new Error("chunk failed")),
    };
    const error = await mountWith(host, { data: syntheticBundle() }, failing).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(GraphCanvasError);
    expect((error as GraphCanvasError).code).toBe("three-unavailable");
    expect((error as GraphCanvasError).cause).toBeInstanceOf(Error);
    const figure = host.querySelector(".gc-error")!;
    expect(figure.textContent).toContain(DEFAULT_CANVAS_LABELS.error);
    expect(host.querySelector("canvas")).toBeNull();
    const retry = nextEvent<{ code: string }>("retry");
    figure.querySelector("button")!.click();
    expect((await retry).detail.code).toBe("three-unavailable");
  });

  it("rejects with webgl-unavailable when no context can be created; errorUi:false leaves the host empty", async () => {
    const noGl: CanvasDeps = {
      ...deps,
      createRenderer: () => {
        throw new Error("Error creating WebGL context.");
      },
    };
    const error = await mountWith(host, { data: syntheticBundle(), errorUi: false }, noGl).catch(
      (e: unknown) => e,
    );
    expect((error as GraphCanvasError).code).toBe("webgl-unavailable");
    expect(host.childElementCount).toBe(0);
  });

  it("rejects with invalid-bundle carrying the path-naming validation error", async () => {
    const error = await mountWith(
      host,
      { data: { revision: "x" } as unknown as SkeletonBundle },
      deps,
    ).catch((e: unknown) => e);
    expect((error as GraphCanvasError).code).toBe("invalid-bundle");
    expect((error as GraphCanvasError).cause).toBeInstanceOf(BundleValidationError);
  });

  it("rejects with missing-styles when the token CSS is not loaded", async () => {
    removeStyles();
    const error = await mountWith(host, { data: syntheticBundle() }, deps).catch((e: unknown) => e);
    expect((error as GraphCanvasError).code).toBe("missing-styles");
    expect((error as GraphCanvasError).message).toContain("--stage-hub");
    removeStyles = installTokenStyles(document, host);
  });

  it("shows the error figure and emits error when the WebGL context is lost", async () => {
    await mountCanvas({ data: syntheticBundle() });
    const failed = nextEvent<{ code: string }>("error");
    host
      .querySelector("canvas")!
      .dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
    expect((await failed).detail.code).toBe("webgl-unavailable");
    expect(host.querySelector(".gc-error")).not.toBeNull();
  });
});

describe("GraphCanvas options and copy", () => {
  it("applies label overrides and the hint/legend/chip toggles", async () => {
    const handle = await mountCanvas({
      data: syntheticBundle(),
      labels: { emptyFilter: "nothing here", classes: { tool: "instrument" } },
      hint: false,
      chip: false,
    });
    expect(host.querySelector(".gc-hint")).toBeNull();
    expect(host.querySelector(".gc-chip")).toBeNull();
    expect(host.querySelector(".gc-legend")!.textContent).toContain("instrument");
    handle.setFilter(() => false);
    expect(host.querySelector(".gc-note")!.textContent).toBe("nothing here");
    handle.select("beta toolkit");
    expect(host.querySelector(".gc-chip")).toBeNull();
  });

  it("shows the touch hint, not the mouse hint, on a coarse pointer", async () => {
    const original = window.matchMedia;
    window.matchMedia = (query: string) =>
      ({ matches: query === "(pointer: coarse)" }) as MediaQueryList;
    try {
      await mountCanvas({ data: syntheticBundle() });
    } finally {
      window.matchMedia = original;
    }
    expect(host.querySelector(".gc-hint")!.textContent).toBe(DEFAULT_CANVAS_LABELS.hintCoarse);
    // The default wording matches the consumer site's how-to line exactly.
    expect(DEFAULT_CANVAS_LABELS.hintCoarse).toBe(
      "drag to orbit · pinch to zoom · two-finger drag to pan · tap to select",
    );
    expect(DEFAULT_CANVAS_LABELS.hintFine).toBe(
      "drag to orbit · alt/⌘+drag to pan · scroll to zoom · click to select · esc clears",
    );
  });

  it("fails fast on an unknown label key or a wrongly typed option", async () => {
    await expect(
      mountWith(host, { data: syntheticBundle(), labels: { nope: "x" } as never }, deps),
    ).rejects.toThrow("labels.nope is not a known label.");
    await expect(
      mountWith(host, { data: syntheticBundle(), hint: "no" as never }, deps),
    ).rejects.toThrow("hint must be a boolean.");
  });

  it("ships default copy free of em-dashes", () => {
    const strings = Object.values(DEFAULT_CANVAS_LABELS).flatMap((v: unknown) =>
      typeof v === "function"
        ? [String((v as (a: number, b: number) => string)(3, 9))]
        : typeof v === "string"
          ? [v]
          : Object.values(v as object).map(String),
    );
    expect(strings.length).toBeGreaterThan(10);
    for (const s of strings) expect(s).not.toContain("—");
  });
});

describe("GraphCanvas rendering cadence", () => {
  it("does not render while the document is hidden, and resumes on visibilitychange", async () => {
    const handle = await mountCanvas({ data: syntheticBundle() });
    await handle.settled;
    await frames(window, 2);
    const r = renderers[0]!;
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    try {
      const before = r.renders;
      handle.select("beta toolkit");
      await frames(window, 3);
      expect(r.renders).toBe(before);
      Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
      document.dispatchEvent(new Event("visibilitychange"));
      await frames(window, 2);
      expect(r.renders).toBeGreaterThan(before);
    } finally {
      Reflect.deleteProperty(document, "hidden");
    }
  });

  it("idles between changes (no frame without a change)", async () => {
    const handle = await mountCanvas({ data: syntheticBundle() });
    await handle.settled;
    await frames(window, 2);
    const r = renderers[0]!;
    const before = r.renders;
    await frames(window, 4);
    expect(r.renders).toBe(before);
  });
});

describe("GraphCanvas source hygiene", () => {
  it("never assigns innerHTML/outerHTML or calls insertAdjacentHTML in the graph module", () => {
    const dir = resolve(process.cwd(), "src/graph");
    const files = [
      ...readdirSync(dir).map((f) => resolve(dir, f)),
      ...readdirSync(resolve(dir, "render")).map((f) => resolve(dir, "render", f)),
    ].filter((f) => f.endsWith(".ts") && !f.includes(".test.") && !f.endsWith("test-support.ts"));
    expect(files.length).toBeGreaterThan(8);
    for (const file of files) {
      expect(readFileSync(file, "utf8"), file).not.toMatch(
        /\.(?:innerHTML|outerHTML)\s*[+]?=|insertAdjacentHTML\s*\(/,
      );
    }
  });
});

describe("settling in a worker (stand-in thread running the real inline worker script)", () => {
  let restoreWorker: (() => void) | null = null;
  afterEach(() => {
    restoreWorker?.();
    restoreWorker = null;
  });
  const standIn = (options: Parameters<typeof installWorkerStandIn>[1] = {}) => {
    const ledger = installWorkerStandIn(window, options);
    restoreWorker = ledger.restore;
    return ledger;
  };

  it("settles in the worker to the seeded layout, then stops the worker and frees its URL", async () => {
    const ledger = standIn();
    const bundle = syntheticBundle("worker-r1");
    const handle = await mountCanvas({ data: bundle });
    await handle.settled;
    expect(Array.from(uploadedPositions())).toEqual(Array.from(resolvePositions(bundle).positions));
    // Every step came from the worker (a silent fallback would deliver none).
    expect(ledger).toMatchObject({
      started: 1,
      delivered: DEFAULT_SIM_CONFIG.iters,
      terminated: 1,
      urlsCreated: 1,
      urlsRevoked: 1,
    });
    expect(host.querySelector(".gc-status")!.textContent).toContain("5 entities");
  });

  it("moves the nodes during the settle from the worker's positions, not the seeded start", async () => {
    standIn();
    const bundle = syntheticBundle("worker-mid");
    const handle = await mountCanvas({ data: bundle });
    const start = Array.from(uploadedPositions());
    let moved = false;
    for (let i = 0; i < 400 && !moved; i++) {
      await frames(window, 1);
      moved = Array.from(uploadedPositions()).some((v, k) => v !== start[k]);
    }
    expect(moved).toBe(true);
    await handle.settled;
  });

  it("starts no worker for a bundle with a precomputed layout", async () => {
    const ledger = standIn();
    const handle = await mountCanvas({ data: loadWithLayoutBundle() });
    await handle.settled;
    expect(ledger.started).toBe(0);
  });

  it("falls back to the main thread when the worker fails before its first update", async () => {
    const ledger = standIn({ failAfter: 0 });
    const bundle = syntheticBundle("worker-fail-0");
    const handle = await mountCanvas({ data: bundle });
    await handle.settled;
    expect(Array.from(uploadedPositions())).toEqual(Array.from(resolvePositions(bundle).positions));
    expect(ledger).toMatchObject({ started: 1, delivered: 0, terminated: 1 });
    expect(ledger.urlsRevoked).toBe(ledger.urlsCreated);
  });

  it("restarts on the main thread from the seeded start when the worker fails mid-settle, reaching the same layout", async () => {
    const bundle = syntheticBundle("worker-fail-mid");
    const seededStart = Array.from(
      makeSim(
        bundle.nodes.length,
        buildSimEdges(bundle),
        DEFAULT_SIM_CONFIG,
        rngForRevision(bundle.revision),
      ).pos,
    );
    let atFailure: number[] = [];
    // Updates a frame apart, so the canvas has drawn worker positions before the failure.
    const ledger = standIn({
      failAfter: 5,
      spacingMs: 40,
      onFail: () => (atFailure = Array.from(uploadedPositions())),
    });
    const handle = await mountCanvas({ data: bundle });
    await handle.settled;
    expect(atFailure).toHaveLength(seededStart.length);
    expect(atFailure).not.toEqual(seededStart);
    expect(Array.from(uploadedPositions())).toEqual(Array.from(resolvePositions(bundle).positions));
    expect(ledger).toMatchObject({ started: 1, delivered: 5, terminated: 1 });
  });

  it("settles on the main thread when the browser refuses to construct the worker", async () => {
    const ledger = standIn({ throwOnConstruct: true });
    const bundle = syntheticBundle("worker-throw");
    const handle = await mountCanvas({ data: bundle });
    await handle.settled;
    expect(Array.from(uploadedPositions())).toEqual(Array.from(resolvePositions(bundle).positions));
    expect(ledger).toMatchObject({ started: 1, delivered: 0, urlsCreated: 1, urlsRevoked: 1 });
  });

  it("gives up on a worker that never answers and settles on the main thread", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      const ledger = standIn({ silent: true });
      const bundle = syntheticBundle("worker-silent");
      const handle = await mountCanvas({ data: bundle });
      await frames(window, 3);
      expect(host.querySelector(".gc-status")!.textContent).toMatch(/^settling… 0%$/);
      vi.advanceTimersByTime(FIRST_UPDATE_TIMEOUT_MS);
      await handle.settled;
      expect(Array.from(uploadedPositions())).toEqual(
        Array.from(resolvePositions(bundle).positions),
      );
      expect(ledger).toMatchObject({ started: 1, delivered: 0, terminated: 1, urlsRevoked: 1 });
    } finally {
      vi.useRealTimers();
    }
  });

  it("stops the worker when the canvas is destroyed mid-settle", async () => {
    const ledger = standIn();
    const handle = await mountCanvas({ data: syntheticBundle("worker-destroy") });
    handle.destroy();
    await handle.settled;
    expect(ledger).toMatchObject({ started: 1, terminated: 1, urlsCreated: 1, urlsRevoked: 1 });
  });

  it("stops the first bundle's worker when setData swaps bundles mid-settle", async () => {
    const ledger = standIn();
    const handle = await mountCanvas({ data: syntheticBundle("worker-swap-a") });
    handle.setData(syntheticBundle("worker-swap-b"));
    await handle.settled;
    // One worker per bundle; the first stopped at the swap, the second when it finished.
    expect(ledger).toMatchObject({ started: 2, terminated: 2, urlsCreated: 2, urlsRevoked: 2 });
  });
});
