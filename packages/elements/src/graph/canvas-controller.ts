// The running graph canvas: owns the DOM chrome, the frame loop and the
// bundle-scoped session (model, layout, scene, labels, controls), and turns
// handle calls and input into view-state changes and events. Built by
// mountWith() once the engine (three + renderer) is in hand.

import { canvasStatus } from "../locked-strings";
import type { BundleNode, SkeletonBundle } from "../types";
import type { GraphCanvasEventMap, GraphCanvasEventType } from "./canvas";
import { GraphCanvasError } from "./canvas-errors";
import {
  baseLabelIndices,
  buildCanvasModel,
  edgeStyle,
  litSet,
  nodeDims,
  type CanvasModel,
  type EdgeStyle,
  type ViewState,
} from "./canvas-model";
import type { ResolvedOptions } from "./canvas-options";
import { attachControls } from "./controls";
import { isCanvasEscape } from "./keys";
import { expandNeighbors, topNeighbors } from "./neighbors";
import type { Palette } from "./palette";
import { rngForRevision } from "./prng";
import {
  renderChip,
  renderErrorFigure,
  renderHoverTip,
  renderHud,
  renderLegend,
  renderNote,
  type Chip,
  type HoverTip,
  type Hud,
} from "./render/chrome";
import { renderLabelLayer, type LabelKind, type LabelLayer } from "./render/labels";
import { resolveByName } from "./resolveByName";
import { createScene, type GraphScene, type RendererLike, type Three } from "./scene";
import { startSettleWorker, type SettleWorker } from "./settle-worker";
import {
  DEFAULT_SIM_CONFIG,
  buildSimEdges,
  makeSim,
  positionsFromLayout,
  type Simulation,
} from "./sim";
import type { SettleRequest, SettleUpdate } from "./sim-worker-protocol";

/** Hosts narrower than this get the short status line and a collapsed legend. */
const NARROW_WIDTH = 640;
/** Simulation steps per animation frame while settling (prototype). */
const STEPS_PER_FRAME = 4;
/** Steps per macrotask when settling without motion. */
const STEPS_PER_BATCH = 12;
/** Edge styling joins the live settle once the cloud has spread this far (prototype). */
const EDGE_STYLE_FROM = 0.12;
/** Hover tip offset from the pointer, px (prototype). */
const HOVER_OFFSET_X = 14;
const HOVER_OFFSET_Y = -10;

/** The bundle-scoped part of a mount: rebuilt by setData, closed by destroy or context loss. */
interface Session {
  bundle: SkeletonBundle;
  model: CanvasModel;
  /**
   * The settling simulation, null once settled. Its `pos` is the buffer the
   * scene and controls read. While a worker runs, the worker steps its own copy
   * and this one only receives the worker's positions.
   */
  sim: Simulation | null;
  /** What a restart of the simulation needs (same seed, same edges). */
  simRequest: SettleRequest | null;
  worker: SettleWorker | null;
  /** The worker's newest positions not yet applied (latest wins). */
  update: SettleUpdate | null;
  /** Edge styling has joined the settle (it does not change with progress, so it is applied once). */
  edgesStyled: boolean;
  scene: GraphScene;
  labels: LabelLayer;
  baseLabels: number[];
  legend: HTMLElement | null;
  state: ViewState;
  dims: Float32Array;
  typedStyle: EdgeStyle;
  comentionStyle: EdgeStyle;
  detachControls: () => void;
  settled: Promise<void>;
  markSettled: () => void;
}

export interface Engine {
  three: Three;
  renderer: RendererLike;
  palette: Palette;
}

export class CanvasController {
  private readonly doc: Document;
  private readonly view: Window & typeof globalThis;
  private readonly canvas: HTMLCanvasElement;
  private readonly hud: Hud;
  private readonly chip: Chip | null;
  private readonly hover: HoverTip;
  private readonly note: HTMLElement;
  /** Placeholder holding the label layer's slot between sessions. */
  private readonly labelSlot: HTMLElement;
  private readonly textScale: number;
  private readonly resizeObserver: ResizeObserver | null;
  private readonly intersection: IntersectionObserver | null;
  private session: Session | null = null;
  private errorFigure: HTMLElement | null = null;
  private destroyed = false;
  private raf = 0;
  private batchTimer: ReturnType<typeof setTimeout> | undefined;
  private pending = false;
  private onScreen = true;
  private pointerInside = false;
  private snapshot = "";

  constructor(
    private readonly host: HTMLElement,
    private readonly opts: ResolvedOptions,
    private readonly engine: Engine,
    hud: Hud,
    bundle: SkeletonBundle,
    marker: string,
  ) {
    this.doc = host.ownerDocument;
    this.view = this.doc.defaultView!;
    this.hud = hud;
    this.canvas = engine.renderer.domElement;
    this.canvas.dataset["qbEngine"] = marker;
    this.canvas.tabIndex = -1;
    this.canvas.setAttribute("role", "img");
    this.canvas.setAttribute("aria-label", opts.labels.canvas);
    this.labelSlot = this.doc.createElement("div");
    this.chip = opts.chip
      ? renderChip(this.doc, opts.labels, {
          more: () => this.expand(),
          clear: () => this.selectIndex(-1),
        })
      : null;
    this.hover = renderHoverTip(this.doc, opts.labels);
    this.note = renderNote(this.doc, opts.labels);
    host.prepend(this.canvas);
    host.append(this.labelSlot, ...(this.chip ? [this.chip.root] : []), this.hover.root, this.note);
    this.textScale =
      Number.parseFloat(this.view.getComputedStyle(host).getPropertyValue("--text-scale")) || 1;

    this.doc.addEventListener("keydown", this.onKey);
    this.doc.addEventListener("visibilitychange", this.onVisibility);
    host.addEventListener("pointerenter", this.onEnter);
    host.addEventListener("pointerleave", this.onLeave);
    this.canvas.addEventListener("webglcontextlost", this.onContextLost);
    this.resizeObserver =
      typeof this.view.ResizeObserver === "function"
        ? new this.view.ResizeObserver(this.onResize)
        : null;
    this.resizeObserver?.observe(host);
    this.intersection =
      typeof this.view.IntersectionObserver === "function"
        ? new this.view.IntersectionObserver(this.onIntersect)
        : null;
    this.intersection?.observe(host);

    this.session = this.openSession(bundle);
    this.requestFrame();
  }

  // ---- public operations (the handle delegates here) ----

  get settled(): Promise<void> {
    return this.session ? this.session.settled : Promise.resolve();
  }

  /** The current (or, after destroy, the last) bundle's snapshot date. */
  get snapshotDate(): string {
    return this.snapshot;
  }

  select(idOrName: number | string): boolean {
    const s = this.session;
    if (!s) return false;
    let index = -1;
    if (typeof idOrName === "number") index = s.model.indexOf.get(idOrName) ?? -1;
    else if (typeof idOrName === "string") {
      const node = resolveByName(s.model.nodes, idOrName);
      if (node) index = s.model.indexOf.get(node.id)!;
    }
    if (index < 0) return false;
    this.selectIndex(index);
    return true;
  }

  clearSelection(): void {
    this.selectIndex(-1);
  }

  expand(): boolean {
    const s = this.session;
    if (!s || s.state.selected < 0) return false;
    const sorted = s.model.adjacency[s.state.selected]!;
    const current = topNeighbors(sorted, s.state.shown);
    if (!current.hasMore) return false;
    s.state.shown = expandNeighbors(sorted, current, this.opts.neighborBudget).shown;
    this.restyle(s, true);
    return true;
  }

  setFilter(predicate: ((node: BundleNode) => boolean) | null): number {
    if (predicate !== null && typeof predicate !== "function") {
      throw new TypeError("setFilter needs a function or null.");
    }
    const s = this.session;
    if (!s) return 0;
    let matches = s.model.count;
    s.state.filterMask = null;
    if (predicate) {
      const mask = new Uint8Array(s.model.count);
      matches = 0;
      s.model.nodes.forEach((node, i) => {
        if (predicate(node)) {
          mask[i] = 1;
          matches++;
        }
      });
      s.state.filterMask = mask;
    }
    const dropSelection =
      s.state.selected >= 0 && s.state.filterMask !== null && !s.state.filterMask[s.state.selected];
    if (dropSelection) {
      s.state.selected = -1;
      s.state.shown = this.opts.neighborBudget;
    }
    this.restyle(s, dropSelection);
    this.note.hidden = !(predicate && matches === 0);
    this.emit("filter", { matches });
    return matches;
  }

  /** Swaps the bundle (already validated by the caller). */
  setData(bundle: SkeletonBundle): void {
    if (!this.session) return;
    this.closeSession(this.session);
    this.session = this.openSession(bundle);
    this.requestFrame();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.cancelFrame();
    if (this.session) this.closeSession(this.session);
    this.session = null;
    this.doc.removeEventListener("keydown", this.onKey);
    this.doc.removeEventListener("visibilitychange", this.onVisibility);
    this.host.removeEventListener("pointerenter", this.onEnter);
    this.host.removeEventListener("pointerleave", this.onLeave);
    this.canvas.removeEventListener("webglcontextlost", this.onContextLost);
    this.resizeObserver?.disconnect();
    this.intersection?.disconnect();
    this.engine.renderer.dispose();
    // Remove only what this mount created: a newer mount on the same host
    // (e.g. after a retry) must survive a late destroy() of this handle.
    for (const node of this.ownedNodes()) node.remove();
    if (!this.host.querySelector("[data-qb-engine]")) this.host.classList.remove("graphcanvas");
  }

  // ---- frames: on demand, paused while hidden or offscreen ----

  private requestFrame = (): void => {
    this.pending = true;
    if (this.raf === 0 && this.session && this.onScreen && !this.doc.hidden) {
      this.raf = this.view.requestAnimationFrame(this.frame);
    }
  };

  private cancelFrame(): void {
    if (this.raf !== 0) this.view.cancelAnimationFrame(this.raf);
    this.raf = 0;
    if (this.batchTimer !== undefined) clearTimeout(this.batchTimer);
    this.batchTimer = undefined;
  }

  private frame = (): void => {
    this.raf = 0;
    const s = this.session;
    if (!s) return;
    this.pending = false;
    if (s.sim && !this.opts.reducedMotion) {
      if (s.worker) this.applyUpdate(s, s.sim);
      else this.stepLive(s, s.sim);
    }
    s.scene.render();
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    s.labels.sync((i) => s.scene.project(i, w, h), s.dims, this.textScale);
    if (this.pending) this.requestFrame();
  };

  /** One frame of the visible settle on the main thread (no worker). */
  private stepLive(s: Session, sim: Simulation): void {
    let more = true;
    for (let k = 0; k < STEPS_PER_FRAME && more; k++) more = sim.step();
    s.scene.positionsChanged();
    this.styleEdgesOnce(s, sim.progress);
    if (more) {
      this.hud.setStatus(this.opts.labels.settling(Math.round(sim.progress * 100)));
      this.pending = true;
    } else this.finishSettle(s);
  }

  /** The reduced-motion settle: batches of steps per macrotask, one paint at the end. */
  private settleWithoutMotion(s: Session): void {
    this.batchTimer = undefined;
    if (this.session !== s || !s.sim) return;
    let more = true;
    for (let k = 0; k < STEPS_PER_BATCH && more; k++) more = s.sim.step();
    if (more) {
      this.hud.setStatus(this.opts.labels.settling(Math.round(s.sim.progress * 100)));
      this.batchTimer = setTimeout(() => this.settleWithoutMotion(s), 0);
    } else {
      s.scene.positionsChanged();
      this.finishSettle(s);
    }
  }

  // ---- the settle worker ----

  private onWorkerUpdate(s: Session, update: SettleUpdate): void {
    if (this.session !== s || !s.sim) return;
    s.update = update;
    // The final update carries the whole layout: stop the worker now, even if a
    // hidden tab delays the frame that applies it. `s.worker` stays set until
    // finishSettle, so frames keep taking the worker path.
    if (update.done) s.worker?.terminate();
    if (!this.opts.reducedMotion) this.requestFrame();
    else if (update.done) this.applyUpdate(s, s.sim);
    else this.hud.setStatus(this.opts.labels.settling(Math.round(update.progress * 100)));
  }

  /** Applies the worker's newest positions (one frame's worth, or the final layout). */
  private applyUpdate(s: Session, sim: Simulation): void {
    const update = s.update;
    if (!update) return;
    s.update = null;
    sim.pos.set(update.pos);
    s.scene.positionsChanged();
    if (update.done) {
      this.finishSettle(s);
      return;
    }
    this.styleEdgesOnce(s, update.progress);
    this.hud.setStatus(this.opts.labels.settling(Math.round(update.progress * 100)));
  }

  /**
   * The worker could not run: settle on the main thread instead. The simulation
   * restarts from its seeded start (in the same buffer) rather than continuing
   * from the worker's last positions, so the layout is the one the worker would
   * have reached.
   */
  private onWorkerFail(s: Session): void {
    if (this.session !== s || !s.sim || !s.simRequest) return;
    s.worker = null;
    s.update = null;
    const { nodeCount, edges, config, revision } = s.simRequest;
    s.sim = makeSim(nodeCount, edges, config, rngForRevision(revision), s.sim.pos);
    s.scene.positionsChanged();
    if (this.opts.reducedMotion) {
      this.batchTimer = setTimeout(() => this.settleWithoutMotion(s), 0);
    } else this.requestFrame();
  }

  /** Brings edge styling in once the cloud has spread past EDGE_STYLE_FROM. */
  private styleEdgesOnce(s: Session, progress: number): void {
    if (s.edgesStyled || progress <= EDGE_STYLE_FROM) return;
    s.edgesStyled = true;
    this.restyle(s, false);
  }

  private finishSettle(s: Session): void {
    s.worker?.terminate();
    s.worker = null;
    s.update = null;
    s.simRequest = null;
    s.sim = null;
    this.restyle(s, false);
    this.hud.setStatus(this.status(s));
    s.markSettled();
  }

  private status(s: Session): string {
    return canvasStatus(
      {
        entities: s.model.count,
        typed: s.model.typed.length,
        comention: s.model.comention.length,
        snapshotDate: s.bundle.stats.snapshot_date,
      },
      this.host.clientWidth < NARROW_WIDTH ? "narrow" : "wide",
    );
  }

  // ---- view state -> buffers, labels, chip, events ----

  private restyle(s: Session, announce: boolean): void {
    const lit = s.state.selected >= 0 ? litSet(s.model, s.state.selected, s.state.shown) : null;
    nodeDims(s.model, s.state, s.dims, lit);
    edgeStyle(s.model, s.state, true, s.typedStyle, lit);
    edgeStyle(s.model, s.state, false, s.comentionStyle, lit);
    s.scene.applyStyle(s.state.selected, s.dims, s.typedStyle, s.comentionStyle);
    const entries = new Map<number, LabelKind>(s.baseLabels.map((i) => [i, "top"]));
    if (lit) for (const i of lit) entries.set(i, i === s.state.selected ? "sel" : "nbr");
    s.labels.set(entries);
    if (s.state.selected >= 0) this.showSelection(s, announce);
    else {
      this.chip?.hide();
      if (announce) this.emit("clear", {});
    }
    this.requestFrame();
  }

  private showSelection(s: Session, announce: boolean): void {
    const sorted = s.model.adjacency[s.state.selected]!;
    const node = s.model.nodes[s.state.selected]!;
    this.chip?.show(node, s.state.shown, sorted.length);
    if (!announce) return;
    const page = topNeighbors(sorted, s.state.shown);
    this.emit("select", {
      node,
      total: page.total,
      neighbors: page.items.map((nb) => ({
        node: s.model.nodes[nb.j]!,
        typed: nb.typed,
        weight: nb.typed ? nb.w - 100 : nb.w,
      })),
    });
  }

  private selectIndex = (index: number): void => {
    const s = this.session;
    if (!s || (index < 0 && s.state.selected < 0)) return;
    s.state.selected = index;
    s.state.shown = this.opts.neighborBudget;
    this.hover.hide();
    this.restyle(s, true);
  };

  // ---- session lifecycle ----

  private openSession(bundle: SkeletonBundle): Session {
    const { three, renderer, palette } = this.engine;
    this.snapshot = bundle.stats.snapshot_date;
    const model = buildCanvasModel(bundle);
    const fromLayout = positionsFromLayout(bundle);
    const simRequest: SettleRequest | null = fromLayout
      ? null
      : {
          nodeCount: model.count,
          edges: buildSimEdges(bundle),
          config: { ...DEFAULT_SIM_CONFIG },
          revision: bundle.revision,
        };
    // The main-thread simulation exists even when a worker runs: it seeds the
    // first frame's positions, and the fallback restarts it in the same buffer.
    const sim = simRequest
      ? makeSim(
          simRequest.nodeCount,
          simRequest.edges,
          simRequest.config,
          rngForRevision(simRequest.revision),
        )
      : null;
    const positions = fromLayout ?? sim!.pos;
    const scene = createScene(
      three,
      renderer,
      model,
      positions,
      palette,
      this.view.devicePixelRatio || 1,
    );
    const labels = renderLabelLayer(this.doc, bundle.nodes);
    this.labelSlot.replaceWith(labels.root);
    let markSettled!: () => void;
    const settled = new Promise<void>((resolve) => (markSettled = resolve));
    const s: Session = {
      bundle,
      model,
      sim,
      simRequest,
      worker: null,
      update: null,
      edgesStyled: false,
      scene,
      labels,
      baseLabels: baseLabelIndices(model, this.opts.labelBudget),
      legend: this.opts.legend
        ? renderLegend(
            this.doc,
            this.opts.labels,
            bundle.nodes,
            this.host.clientWidth < NARROW_WIDTH || this.opts.coarse,
          )
        : null,
      state: { selected: -1, shown: this.opts.neighborBudget, filterMask: null },
      dims: new Float32Array(model.count),
      typedStyle: {
        alpha: new Float32Array(model.typed.length),
        role: new Uint8Array(model.typed.length),
      },
      comentionStyle: {
        alpha: new Float32Array(model.comention.length),
        role: new Uint8Array(model.comention.length),
      },
      detachControls: () => undefined,
      settled,
      markSettled,
    };
    if (s.legend) this.host.append(s.legend);
    s.detachControls = this.attachSessionControls(s, positions);
    scene.resize(this.host.clientWidth, this.host.clientHeight);
    scene.positionsChanged();
    // Nodes and labels show from the first frame; edge styling joins once the cloud has spread.
    nodeDims(model, s.state, s.dims, null);
    scene.applyStyle(-1, s.dims, s.typedStyle, s.comentionStyle);
    labels.set(new Map(s.baseLabels.map((i) => [i, "top" as const])));
    if (!sim || !simRequest) this.finishSettle(s);
    else {
      this.hud.setStatus(this.opts.labels.settling(0));
      s.worker = startSettleWorker(this.view, simRequest, {
        update: (update) => this.onWorkerUpdate(s, update),
        fail: () => this.onWorkerFail(s),
      });
      if (!s.worker && this.opts.reducedMotion)
        this.batchTimer = setTimeout(() => this.settleWithoutMotion(s), 0);
    }
    return s;
  }

  private attachSessionControls(s: Session, positions: Float32Array): () => void {
    return attachControls({
      canvas: this.canvas,
      scene: s.scene,
      model: s.model,
      positions,
      coarse: this.opts.coarse,
      draggable: this.opts.draggable,
      dims: () => s.dims,
      focused: () => s.state.selected >= 0 || s.state.filterMask !== null,
      settling: () => s.sim !== null,
      select: this.selectIndex,
      hover: (i, x, y) => {
        if (i >= 0) this.hover.show(s.model.nodes[i]!, x + HOVER_OFFSET_X, y + HOVER_OFFSET_Y);
        else this.hover.hide();
        this.canvas.style.cursor = i >= 0 ? "pointer" : "";
      },
      changed: this.requestFrame,
    });
  }

  /** Releases a session's GPU objects and listeners; anyone awaiting `settled` is released too. */
  private closeSession(s: Session): void {
    s.worker?.terminate();
    s.worker = null;
    s.detachControls();
    s.scene.dispose();
    s.legend?.remove();
    s.labels.root.replaceWith(this.labelSlot);
    this.chip?.hide();
    this.hover.hide();
    this.note.hidden = true;
    this.cancelFrame();
    s.markSettled();
  }

  // ---- failure after mount ----

  private onContextLost = (event: Event): void => {
    event.preventDefault();
    if (this.session) this.closeSession(this.session);
    this.session = null;
    for (const node of this.ownedNodes()) node.remove();
    const error = new GraphCanvasError("webgl-unavailable", "GraphCanvas lost its WebGL context.");
    if (this.opts.errorUi) {
      this.errorFigure = renderErrorFigure(this.doc, this.opts.labels, () =>
        this.emit("retry", { code: error.code }),
      );
      this.host.append(this.errorFigure);
    }
    this.emit("error", { code: error.code, message: error.message });
  };

  private ownedNodes(): Element[] {
    const nodes: Element[] = [
      this.canvas,
      this.hud.root,
      this.labelSlot,
      this.hover.root,
      this.note,
    ];
    if (this.chip) nodes.push(this.chip.root);
    if (this.errorFigure) nodes.push(this.errorFigure);
    if (this.session) {
      nodes.push(this.session.labels.root);
      if (this.session.legend) nodes.push(this.session.legend);
    }
    return nodes;
  }

  // ---- host and document listeners ----

  private onKey = (event: KeyboardEvent): void => {
    const s = this.session;
    if (!s) return;
    const ctx = {
      host: this.host,
      pointerInside: this.pointerInside,
      suppressKeys: this.opts.suppressKeys,
    };
    if (!isCanvasEscape(event, ctx)) return;
    if (s.state.selected >= 0) this.selectIndex(-1);
    else if (s.scene.isPanned()) {
      s.scene.recenter();
      this.requestFrame();
    } else return;
    event.preventDefault();
  };

  private onEnter = (): void => {
    this.pointerInside = true;
  };

  private onLeave = (): void => {
    this.pointerInside = false;
  };

  private onVisibility = (): void => {
    if (this.pending) this.requestFrame();
  };

  private onIntersect = (entries: IntersectionObserverEntry[]): void => {
    this.onScreen = entries.some((e) => e.isIntersecting);
    if (this.onScreen && this.pending) this.requestFrame();
  };

  private onResize = (): void => {
    const s = this.session;
    if (!s) return;
    s.scene.resize(this.host.clientWidth, this.host.clientHeight);
    if (!s.sim) this.hud.setStatus(this.status(s));
    this.requestFrame();
  };

  private emit<K extends GraphCanvasEventType>(
    type: K,
    detail: GraphCanvasEventMap[K]["detail"],
  ): void {
    this.host.dispatchEvent(new CustomEvent(type, { detail }));
  }
}

/** Builds the HUD up front so mount can show the loading status while three loads. */
export function createHud(doc: Document, opts: ResolvedOptions): Hud {
  return renderHud(doc, opts.labels, opts.hint);
}

/** Renders the mount-time error figure; its retry button dispatches `retry` on the host. */
export function renderMountFailure(
  host: HTMLElement,
  opts: ResolvedOptions,
  error: GraphCanvasError,
): void {
  host.replaceChildren();
  if (!opts.errorUi) return;
  host.append(
    renderErrorFigure(host.ownerDocument, opts.labels, () =>
      host.dispatchEvent(new CustomEvent("retry", { detail: { code: error.code } })),
    ),
  );
}
