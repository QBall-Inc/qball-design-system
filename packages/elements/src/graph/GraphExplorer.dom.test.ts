// GraphExplorer in jsdom: the composed canvas, chips and panel all run for
// real; only the canvas's WebGL renderer (the context boundary jsdom cannot
// provide) is the recording stand-in from canvas-test-support. Selections go
// through the canvas handle, the same path a click takes; real pointer input
// and computed colours are proven in e2e/graph-explorer.spec.ts.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { settle } from "../trust/test-fixtures";
import type { ConnectionDetail, SkeletonBundle } from "../types";
import { mountWith as mountCanvasWith, type CanvasDeps, type GraphCanvasOptions } from "./canvas";
import { GraphCanvasError } from "./canvas-errors";
import {
  recordingRendererFactory,
  recordingThree,
  resolvedCanvasTokens,
  installTokenStyles,
  listenerLedger,
} from "./canvas-test-support";
import type { HopRequest } from "./EntityPanel";
import {
  mountWith,
  SHEET_QUERY,
  type ExplorerDeps,
  type ExplorerPathDetail,
  type GraphExplorerHandle,
  type GraphExplorerOptions,
} from "./GraphExplorer";
import type { FacetTaxonomy } from "./facets";
import { syntheticBundle } from "./test-helpers";

const detailFixture = (name: string): ConnectionDetail =>
  JSON.parse(
    readFileSync(resolve(process.cwd(), "../../fixtures/qubrain/detail", `${name}.json`), "utf8"),
  ) as ConnectionDetail;

const facet = (sub: string) => ({
  domains: ["d1"],
  sub_domains: [sub],
  pairs: [{ domain: "d1", sub_domain: sub }],
});

/** The synthetic graph (10–11 asserted, 11–12 discussed together) with paired facets. */
function bundleOf(revision = "explorer-r1"): SkeletonBundle {
  const base = syntheticBundle(revision);
  const facets: Record<number, ReturnType<typeof facet>> = {
    10: facet("s1"),
    11: facet("s1"),
    12: facet("s2"),
  };
  return {
    ...base,
    nodes: base.nodes.map((n) => {
      const f = facets[n.id];
      return f === undefined ? n : { ...n, facets: f };
    }),
  };
}
const taxonomy: FacetTaxonomy = { domains: { d1: ["s1", "s2"] } };

// ---- media: the ≤900px sheet query is controllable; every other query is false ----
let sheet: { matches: boolean; listeners: Set<() => void> };
function setSheet(matches: boolean): void {
  sheet.matches = matches;
  for (const listener of sheet.listeners) listener();
}

let host: HTMLElement;
let removeStyles: () => void;
let canvasDeps: CanvasDeps;
let deps: ExplorerDeps;
let calls: HopRequest[];
const mounted: GraphExplorerHandle[] = [];

beforeEach(() => {
  sheet = { matches: false, listeners: new Set() };
  window.matchMedia = ((query: string) => ({
    get matches() {
      return query === SHEET_QUERY ? sheet.matches : false;
    },
    media: query,
    addEventListener: (_: string, fn: () => void) => sheet.listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => sheet.listeners.delete(fn),
  })) as unknown as typeof window.matchMedia;
  host = document.createElement("div");
  document.body.append(host);
  removeStyles = installTokenStyles(document);
  const recorder = recordingRendererFactory(document);
  const gpu = recordingThree();
  canvasDeps = { loadThree: () => Promise.resolve(gpu.three), createRenderer: recorder.factory };
  deps = { mountCanvas: (h, o) => canvasWith(h, o, canvasDeps) };
  calls = [];
});

afterEach(() => {
  while (mounted.length) mounted.pop()!.destroy();
  document.body.replaceChildren();
  removeStyles();
});

/** Mounts the canvas with the resolved stage tokens on its host (jsdom does not inherit them). */
function canvasWith(h: HTMLElement, o: GraphCanvasOptions, d: CanvasDeps) {
  for (const [prop, value] of Object.entries(resolvedCanvasTokens()))
    h.style.setProperty(prop, value);
  return mountCanvasWith(h, o, d);
}

const detail = (hop: HopRequest): Promise<ConnectionDetail> => {
  calls.push(hop);
  const typed = hop.from.id + hop.to.id === 21;
  return Promise.resolve(detailFixture(typed ? "typed-connection" : "comention-connection"));
};

async function explorer(
  extra: Partial<GraphExplorerOptions> = {},
  with_: ExplorerDeps = deps,
): Promise<GraphExplorerHandle> {
  const handle = await mountWith(
    host,
    { bundle: bundleOf(), taxonomy, detail, canvas: { neighborBudget: 1 }, ...extra },
    with_,
  );
  mounted.push(handle);
  return handle;
}

const $ = <T extends Element = HTMLElement>(sel: string) => host.querySelector<T>(sel);
const panelWrap = () => $(".gx__panel")!;
const pill = () => $<HTMLButtonElement>(".gx__pshow")!;
const hideButton = () => $<HTMLButtonElement>(".gx__phide")!;
const toggle = () => $<HTMLButtonElement>(".gx__ftoggle")!;
const crumbs = () => [...host.querySelectorAll(".epanel__crumbs button")].map((b) => b.textContent);
const rows = () => [...host.querySelectorAll<HTMLButtonElement>(".epanel__rows .nrow")];
const chips = () => [...host.querySelectorAll<HTMLButtonElement>(".fchip")];

function record(handle: GraphExplorerHandle) {
  const paths: (number | null)[][] = [];
  const nodes: (string | null)[] = [];
  const panel: boolean[] = [];
  handle.on("pathchange", (e) => {
    const d: ExplorerPathDetail = e.detail;
    paths.push(d.path.map((n) => n.id));
    nodes.push(d.node?.name ?? null);
  });
  handle.on("panel", (e) => panel.push(e.detail.open));
  return { paths, nodes, panel };
}

describe("GraphExplorer — frame on mount", () => {
  it("assembles canvas, filters strip, pill and panel in one region; every overlay starts minimized", async () => {
    const x = await explorer();
    const gx = $(".gx")!;
    expect(gx.getAttribute("role")).toBe("region");
    expect(gx.getAttribute("aria-label")).toBe("graph explorer");
    const stage = gx.querySelector(".gx__stage")!;
    expect([...stage.children].map((c) => c.classList[0])).toEqual([
      "graphcanvas",
      "gx__facets",
      "gx__pshow",
      "gx__panel",
    ]);
    // filters: collapsed, the toggle controls the chip bar
    expect($(".gx__facets")!.classList.contains("is-collapsed")).toBe(true);
    expect(toggle().textContent).toBe("filters ▾");
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
    expect(toggle().getAttribute("aria-controls")).toBe($(".facetbar")!.id);
    // details: hidden and inert, the pill shows and controls it
    expect(panelWrap().classList.contains("is-hidden")).toBe(true);
    expect(panelWrap().hasAttribute("inert")).toBe(true);
    expect(pill().hidden).toBe(false);
    expect(pill().textContent).toBe("◂ details");
    expect(pill().getAttribute("aria-expanded")).toBe("false");
    expect(pill().getAttribute("aria-controls")).toBe(panelWrap().id);
    // the canvas runs with its own chip off; the hide control sits in the panel head
    expect(x.canvas).not.toBeNull();
    expect(host.querySelector(".gc-chip")).toBeNull();
    expect($(".epanel__head .epanel__top .gx__phide")).toBe(hideButton());
    expect(hideButton().textContent).toBe("hide ▸");
    expect(x.panelOpen).toBe(false);
    expect(x.path).toEqual([]);
  });

  it("fails fast on bad options and an invalid bundle, leaving the host empty", async () => {
    const bad: [Partial<GraphExplorerOptions>, string | RegExp][] = [
      [{ autoOpen: "yes" as never }, "autoOpen must be a boolean."],
      [{ suppressKeys: 1 as never }, "suppressKeys must be a function."],
      [{ canvas: "x" as never }, "canvas must be an object of canvas options."],
      [{ labels: { nope: "x" } as never }, "labels.nope is not a known label."],
      [{ detail: undefined as never }, "detail must be a function."],
      [{ canvas: { hint: "x" as never } }, "hint must be a boolean."],
    ];
    for (const [extra, message] of bad) {
      await expect(explorer(extra)).rejects.toThrow(message);
      expect(host.querySelector(".gx")).toBeNull();
    }
    const error = await explorer({ bundle: { revision: "x" } as never }).catch((e: unknown) => e);
    expect((error as GraphCanvasError).code).toBe("invalid-bundle");
    expect(host.querySelector(".gx")).toBeNull();
  });
});

describe("GraphExplorer — click path", () => {
  it("a select pushes the entity and opens the panel (desktop); a second narrates the hop", async () => {
    const x = await explorer();
    const log = record(x);
    x.canvas!.select(10);
    expect(x.panelOpen).toBe(true);
    expect(pill().hidden).toBe(true);
    expect(panelWrap().hasAttribute("inert")).toBe(false);
    expect(crumbs()).toEqual(["alpha method"]);
    x.canvas!.select(11);
    expect(crumbs()).toEqual(["alpha method", "beta toolkit"]);
    expect(calls.map((c) => [c.from.id, c.to.id])).toEqual([[10, 11]]);
    await settle();
    expect($(".epanel__hop .epanel__hlabel")!.textContent).toBe(
      "alpha method → beta toolkit · the graph asserts",
    );
    expect(log.paths).toEqual([[10], [10, 11]]);
    expect(log.nodes).toEqual(["alpha method", "beta toolkit"]);
    expect(log.panel).toEqual([true]);
  });

  it("a connection row selects through the same canvas select path, extending the path", async () => {
    const x = await explorer({ canvas: { neighborBudget: 5 } });
    const log = record(x);
    let canvasSelects = 0;
    x.canvas!.on("select", () => (canvasSelects += 1));
    x.canvas!.select(11);
    const row = rows().find((r) => r.textContent?.startsWith("gamma dataset"))!;
    row.click();
    expect(canvasSelects).toBe(2);
    expect(crumbs()).toEqual(["beta toolkit", "gamma dataset"]);
    expect(log.paths.at(-1)).toEqual([11, 12]);
    expect(calls.at(-1)!.to.id).toBe(12);
  });

  it("a crumb truncates the path and reselects without pushing", async () => {
    const x = await explorer({ canvas: { neighborBudget: 5 } });
    const log = record(x);
    x.select(10);
    x.select(11);
    x.select(12);
    expect(crumbs()).toEqual(["alpha method", "beta toolkit", "gamma dataset"]);
    host.querySelector<HTMLButtonElement>('.epanel__crumbs [data-crumb="1"]')!.click();
    expect(crumbs()).toEqual(["alpha method", "beta toolkit"]);
    expect(x.path.map((n) => n.id)).toEqual([10, 11]);
    expect(log.paths).toEqual([[10], [10, 11], [10, 11, 12], [10, 11]]);
    // the hop narrated is the truncated path's last hop again
    expect(calls.at(-1)!.from.id).toBe(10);
    expect(calls.at(-1)!.to.id).toBe(11);
  });

  it("show more grows the rows for the same entity without a path change", async () => {
    const x = await explorer();
    const log = record(x);
    x.select(11);
    expect(rows().map((r) => r.classList.contains("nrow--more"))).toEqual([false, true]);
    rows().at(-1)!.click();
    expect(rows().filter((r) => !r.classList.contains("nrow--more"))).toHaveLength(2);
    expect(log.paths).toEqual([[11]]);
    expect(crumbs()).toEqual(["beta toolkit"]);
  });

  it("clearing (canvas clear or the handle) empties the path and idles the panel", async () => {
    const x = await explorer();
    const log = record(x);
    x.select(10);
    x.select(11);
    x.canvas!.clearSelection();
    expect(x.path).toEqual([]);
    expect(host.querySelector(".epanel__crumbs")).toBeNull();
    expect(log.nodes.at(-1)).toBeNull();
    expect(log.paths.at(-1)).toEqual([]);
    x.select(12);
    x.clearSelection();
    expect(x.path).toEqual([]);
  });

  it("a filter that hides the selection clears the path", async () => {
    const x = await explorer();
    const log = record(x);
    x.select(12);
    toggle().click();
    chips()
      .find((c) => c.textContent === "s1")!
      .click();
    expect(x.path).toEqual([]);
    expect(log.paths.at(-1)).toEqual([]);
  });

  it("an unknown entity selects nothing and leaves the path", async () => {
    const x = await explorer();
    x.select(10);
    expect(x.select("no such entity", { openPanel: true })).toBe(false);
    expect(x.path.map((n) => n.id)).toEqual([10]);
  });
});

describe("GraphExplorer — panel and pill by form factor", () => {
  it("≤900px: a select keeps the sheet minimized; the pill names the entity; hide reads ▾", async () => {
    setSheet(true);
    const x = await explorer();
    expect(hideButton().textContent).toBe("hide ▾");
    expect(pill().textContent).toBe("details ▴");
    x.select(11);
    expect(x.panelOpen).toBe(false);
    expect(pill().firstChild!.textContent).toBe("details ▴");
    expect(pill().querySelector("b")!.textContent).toBe("beta toolkit");
  });

  it("a deep link (openPanel) opens the panel on the sheet and on desktop alike", async () => {
    setSheet(true);
    const x = await explorer();
    expect(x.select("beta toolkit", { openPanel: true })).toBe(true);
    expect(x.panelOpen).toBe(true);
    x.closePanel();
    setSheet(false);
    expect(x.select(10, { openPanel: true })).toBe(true);
    expect(x.panelOpen).toBe(true);
    // the request is one-shot: a later canvas click on the sheet does not open
    x.closePanel();
    setSheet(true);
    x.canvas!.select(12);
    expect(x.panelOpen).toBe(false);
  });

  it("autoOpen overrides the form factor both ways", async () => {
    setSheet(true);
    const onSheet = await explorer({ autoOpen: true });
    onSheet.select(10);
    expect(onSheet.panelOpen).toBe(true);
    onSheet.destroy();
    setSheet(false);
    const desktop = await explorer({ autoOpen: false });
    desktop.select(10);
    expect(desktop.panelOpen).toBe(false);
  });

  it("hide closes to the pill (focus follows, ring-free); the pill reopens and focuses the panel", async () => {
    const x = await explorer();
    const log = record(x);
    x.select(10);
    hideButton().focus();
    hideButton().click();
    expect(x.panelOpen).toBe(false);
    expect(panelWrap().hasAttribute("inert")).toBe(true);
    expect(document.activeElement).toBe(pill());
    // ring-free: jsdom does not read the focusVisible option, so the fallback suppresses the outline
    expect(pill().style.getPropertyValue("outline")).toBe("none");
    pill().click();
    expect(x.panelOpen).toBe(true);
    expect(document.activeElement).toBe($(".gx__panel .epanel"));
    expect(log.panel).toEqual([true, false, true]);
  });

  it("closing while focus is inside the panel hands focus to the pill", async () => {
    const x = await explorer({ canvas: { neighborBudget: 5 } });
    x.select(11);
    rows()[0]!.focus();
    x.closePanel();
    expect(document.activeElement).toBe(pill());
  });

  it("crossing the breakpoint relabels the pill and hide control", async () => {
    const x = await explorer();
    x.select(10);
    x.closePanel();
    setSheet(true);
    expect(pill().querySelector("b")!.textContent).toBe("alpha method");
    expect(hideButton().textContent).toBe("hide ▾");
    setSheet(false);
    expect(pill().textContent).toBe("◂ details");
  });
});

describe("GraphExplorer — filters", () => {
  it("the toggle expands the chips; active chips show in the toggle; clear restores", async () => {
    const x = await explorer();
    const matches: number[] = [];
    x.canvas!.on("filter", (e) => matches.push(e.detail.matches));
    toggle().click();
    expect($(".gx__facets")!.classList.contains("is-collapsed")).toBe(false);
    expect(toggle().getAttribute("aria-expanded")).toBe("true");
    expect(toggle().textContent).toBe("filters ▴");
    chips()
      .find((c) => c.textContent === "s1")!
      .click();
    expect(toggle().textContent).toBe("filters ▴ 1 active");
    expect(toggle().querySelector("b")!.textContent).toBe("1 active");
    expect(matches).toEqual([2]);
    $<HTMLButtonElement>(".facetbar__clear")!.click();
    expect(toggle().textContent).toBe("filters ▴");
    expect(matches).toEqual([2, 5]);
    toggle().click();
    expect(toggle().textContent).toBe("filters ▾");
  });
});

describe("GraphExplorer — Esc", () => {
  const esc = (target: EventTarget) =>
    target.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

  it("with focus in the panel, Esc clears the selection", async () => {
    const x = await explorer({ canvas: { neighborBudget: 5 } });
    x.select(11);
    rows()[0]!.focus();
    esc(rows()[0]!);
    expect(x.path).toEqual([]);
  });

  it("yields to suppressKeys and to typing targets", async () => {
    let suppress = true;
    const x = await explorer({ suppressKeys: () => suppress });
    x.select(10);
    hideButton().focus();
    esc(hideButton());
    expect(x.path).toHaveLength(1);
    suppress = false;
    const input = document.createElement("input");
    panelWrap().querySelector(".epanel__scroll")!.append(input);
    input.focus();
    esc(input);
    expect(x.path).toHaveLength(1);
    hideButton().focus();
    esc(hideButton());
    expect(x.path).toEqual([]);
  });
});

describe("GraphExplorer — bundle swap", () => {
  it("re-seeds everything: path, chips, toggle count and panel return to idle; new taxonomy and stats apply", async () => {
    const x = await explorer();
    const log = record(x);
    x.select(10);
    x.select(11);
    toggle().click();
    chips()[0]!.click();
    expect(toggle().textContent).toContain("1 active");
    const next = bundleOf("explorer-r2");
    next.stats = { ...next.stats, episodes: 77 };
    x.setData(next, { taxonomy: { domains: { d1: ["s2"] } }, domainLabels: { d1: "domain one" } });
    expect(x.path).toEqual([]);
    expect(log.paths.at(-1)).toEqual([]);
    expect(host.querySelector(".epanel__crumbs")).toBeNull();
    expect($(".epanel__head .epanel__meta")!.textContent).toBe("77 episodes");
    expect(chips().map((c) => c.textContent)).toEqual(["s2"]);
    expect(chips()[0]!.getAttribute("aria-pressed")).toBe("false");
    expect($(".facetbar__dom")!.textContent).toBe("domain one");
    expect(toggle().textContent).toBe("filters ▴");
    expect(x.canvas!.snapshotDate).toBe(next.stats.snapshot_date);
    // the new revision is live
    x.select(12);
    expect(crumbs()).toEqual(["gamma dataset"]);
  });

  it("a bad swap changes nothing", async () => {
    const x = await explorer();
    x.select(10);
    expect(() => x.setData({ revision: "x" } as never)).toThrow(GraphCanvasError);
    expect(() => x.setData(bundleOf("r3"), { domainLabels: { d1: 1 } as never })).toThrow(
      "domainLabels.d1 must be a string.",
    );
    expect(x.path.map((n) => n.id)).toEqual([10]);
  });
});

describe("GraphExplorer — no page side effects", () => {
  it("never touches body/html attributes or history across a full interaction", async () => {
    const changes: MutationRecord[] = [];
    const observer = new MutationObserver((list) => changes.push(...list));
    observer.observe(document.body, { attributes: true });
    observer.observe(document.documentElement, { attributes: true });
    const href = location.href;
    const length = history.length;
    const x = await explorer({ canvas: { neighborBudget: 5 } });
    x.select(10);
    x.select(11);
    rows()[0]!.click();
    hideButton().click();
    pill().click();
    toggle().click();
    chips()[0]!.click();
    x.setData(bundleOf("r2"));
    x.clearSelection();
    x.destroy();
    await settle();
    observer.disconnect();
    expect(changes).toEqual([]);
    expect(document.body.className).toBe("");
    expect(location.href).toBe(href);
    expect(history.length).toBe(length);
  });
});

describe("GraphExplorer — when the canvas cannot run", () => {
  const noGl = (): CanvasDeps => ({
    ...canvasDeps,
    createRenderer: () => {
      throw new Error("Error creating WebGL context.");
    },
  });

  it("resolves with the error figure (read from canvasError, no event); chips and panel stay usable; retry re-mounts", async () => {
    let failing = true;
    const early: string[] = [];
    host.addEventListener("error", (e) => {
      if (e instanceof CustomEvent) early.push(String((e.detail as { code: string }).code));
    });
    const x = await explorer(
      {},
      { mountCanvas: (h, o) => canvasWith(h, o, failing ? noGl() : canvasDeps) },
    );
    expect(early).toEqual([]);
    expect(x.canvas).toBeNull();
    expect(x.canvasError).toBe("webgl-unavailable");
    expect($(".gx__stage .gc-error")).not.toBeNull();
    expect(x.select(10)).toBe(false);
    toggle().click();
    chips()[0]!.click();
    expect(toggle().textContent).toContain("1 active");
    pill().click();
    expect(x.panelOpen).toBe(true);
    // a retry that still cannot start the canvas is reported
    $<HTMLButtonElement>(".gc-error button")!.click();
    await settle();
    expect(early).toEqual(["webgl-unavailable"]);
    expect(x.canvas).toBeNull();
    failing = false;
    $<HTMLButtonElement>(".gc-error button")!.click();
    await settle();
    expect(x.canvas).not.toBeNull();
    expect(x.canvasError).toBeNull();
    expect($(".gc-error")).toBeNull();
    expect(toggle().textContent).toBe("filters ▴");
    expect(x.select(10)).toBe(true);
    expect(crumbs()).toEqual(["alpha method"]);
  });

  it("a lost context reports error, drops the dead canvas, resets the path, and retry brings it back", async () => {
    const x = await explorer();
    const errors: string[] = [];
    x.on("error", (e) => errors.push(e.detail.code));
    x.select(10);
    host
      .querySelector("canvas")!
      .dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
    expect(errors).toEqual(["webgl-unavailable"]);
    expect(x.canvasError).toBe("webgl-unavailable");
    expect(x.canvas).toBeNull();
    expect(x.select(10)).toBe(false);
    expect(x.path).toEqual([]);
    $<HTMLButtonElement>(".gc-error button")!.click();
    await settle();
    expect(x.canvasError).toBeNull();
    expect(x.canvas).not.toBeNull();
    expect(x.select(11)).toBe(true);
  });

  it("a canvas that finishes mounting after destroy is destroyed, not attached", async () => {
    let open: () => void = () => undefined;
    const gate = new Promise<void>((done) => {
      open = done;
    });
    let gated = false;
    let lateHost: HTMLElement | null = null;
    const x = await explorer(
      {},
      {
        mountCanvas: async (h, o) => {
          if (gated) {
            lateHost = h;
            await gate;
          }
          return canvasWith(h, o, canvasDeps);
        },
      },
    );
    host
      .querySelector("canvas")!
      .dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
    gated = true;
    $<HTMLButtonElement>(".gc-error button")!.click();
    x.destroy();
    open();
    await settle();
    await settle();
    expect(lateHost).not.toBeNull();
    expect(lateHost!.querySelector("canvas")).toBeNull();
    expect(x.canvas).toBeNull();
  });
});

describe("GraphExplorer — destroy", () => {
  it("removes the frame and every document, window and media listener it added; the handle goes inert", async () => {
    const ledger = listenerLedger([document, window]);
    try {
      const x = await explorer();
      const log = record(x);
      x.select(10);
      expect(ledger.net()).toBeGreaterThan(0);
      expect(sheet.listeners.size).toBe(1);
      const canvas = x.canvas!;
      x.destroy();
      expect(host.querySelector(".gx")).toBeNull();
      expect(ledger.net()).toBe(0);
      expect(sheet.listeners.size).toBe(0);
      expect(canvas.select(11)).toBe(false);
      expect(x.select(11)).toBe(false);
      x.openPanel();
      x.setData(bundleOf("after"));
      x.clearSelection();
      expect(log.paths).toEqual([[10]]);
      expect(log.panel).toEqual([true]);
      x.destroy();
    } finally {
      ledger.restore();
    }
  });
});
