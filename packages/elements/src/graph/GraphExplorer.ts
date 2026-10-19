// GraphExplorer: the assembled knowledge-graph organism. It composes the
// canvas (GraphCanvas, its own selection chip off), the facet chips
// (FacetFilterBar) behind a collapsible filters toggle, and the reading panel
// (EntityPanel) behind a details pill, inside one `.gx` frame that graph.css
// pins to the dark stage in either page theme. It owns the click path and the
// panel's open state; the composed components stay renderers. Data-only: the
// consumer passes a ready bundle and the hop-detail callback; the explorer
// never fetches, never writes history and never touches document.body. It
// reports what changed through typed events on the host instead.

import { defaultWarn } from "../dev-warn";
import { focusWithoutRing } from "../focus";
import { el } from "../trust/dom";
import type { SourceBadgeOptions } from "../trust/source-badge";
import type { BundleNode, ConnectionDetail, SkeletonBundle } from "../types";
import {
  mount as mountGraphCanvas,
  validateBundle,
  type GraphCanvasHandle,
  type GraphCanvasOptions,
  type GraphSelectDetail,
} from "./canvas";
import { GraphCanvasError, type GraphCanvasErrorCode } from "./canvas-errors";
import { mount as mountEntityPanel, type EntityPanelHandle, type HopRequest } from "./EntityPanel";
import { DEFAULT_EXPLORER_LABELS, type ExplorerLabels } from "./explorer-copy";
import { mount as mountFacetFilterBar, type FacetFilterBarHandle } from "./FacetFilterBar";
import type { FacetTaxonomy } from "./facets";
import { isCanvasEscape } from "./keys";
import { resolveLabels, type FacetBarLabels, type PanelLabels } from "./panel-copy";

/** At this width and below the panel is a bottom sheet that selection does not open (graph.css). */
export const SHEET_QUERY = "(max-width: 900px)";

/** The pill's (and the ≤900px sheet's) top edge, and its gap below an expanded filters strip (px). */
const OVERLAY_TOP = 44;
const STRIP_GAP = 8;

/** Canvas options the explorer passes through (it sets `data`, `chip` and `suppressKeys` itself). */
export type ExplorerCanvasOptions = Omit<GraphCanvasOptions, "data" | "chip" | "suppressKeys">;

export interface GraphExplorerOptions {
  /** The graph. Validated at mount (fail-fast, path-naming errors). */
  bundle: SkeletonBundle;
  /** Domains → sub-domains for the facet chips, in display order. */
  taxonomy: FacetTaxonomy;
  /** Display label per domain id; a domain without one shows its id. */
  domainLabels?: Readonly<Record<string, string>>;
  /** Detail for the hop the panel narrates. Rejections show the panel's error state with a retry. */
  detail: (hop: HopRequest) => Promise<ConnectionDetail>;
  /** Overrides for the frame's own strings (filters toggle, details pill, hide control). */
  labels?: Partial<ExplorerLabels>;
  /** Overrides for the panel's strings (e.g. `idleTitle`, your product's name). */
  panelLabels?: Partial<PanelLabels>;
  /** Overrides for the facet chips' strings. */
  facetLabels?: Partial<FacetBarLabels>;
  /** Canvas options: labels, hint, legend, budgets, draggable, errorUi. */
  canvas?: ExplorerCanvasOptions;
  /** Consumer domain badges for claim cards and the reading list. */
  sourceBadges?: SourceBadgeOptions;
  /**
   * Open the details panel when an entity is selected. Default: yes above
   * 900px, no on the ≤900px bottom sheet (the pill shows the entity instead).
   */
  autoOpen?: boolean;
  /** Return true to make Esc do nothing, e.g. while one of your own overlays is open. */
  suppressKeys?: () => boolean;
  /** Receives the panel's development warnings (default: console.warn outside production). */
  onWarn?: (message: string) => void;
}

/** The click path after a change: oldest first; `node` is the current entity (null when cleared). */
export interface ExplorerPathDetail {
  node: BundleNode | null;
  path: BundleNode[];
}

/** Events dispatched on the host element (they do not bubble). */
export interface GraphExplorerEventMap {
  /** The click path changed (select, crumb, clear, bundle swap): for URL sync. */
  pathchange: CustomEvent<ExplorerPathDetail>;
  /** The details panel opened or closed: e.g. to hide a launcher over it. */
  panel: CustomEvent<{ open: boolean }>;
  /**
   * The canvas stopped or failed after mount: a lost WebGL context, or a retry
   * that could not start it. A failure during mount() is not an event: read
   * `canvasError` on the resolved handle. The panel and chips keep working.
   */
  error: CustomEvent<{ code: GraphCanvasErrorCode; message: string }>;
}

export type GraphExplorerEventType = keyof GraphExplorerEventMap;

export interface GraphExplorerHandle {
  /**
   * Selects by revision-scoped id or canonical name, as a click would; false
   * when unknown or when the canvas is not running. `openPanel: true` opens
   * the details panel at every width (for a deep link).
   */
  select(idOrName: number | string, options?: { openPanel?: boolean }): boolean;
  /** Clears the selection and the click path. */
  clearSelection(): void;
  /** Swaps in a new revision: clears the path, the chips and the panel; optionally a new taxonomy. */
  setData(
    bundle: SkeletonBundle,
    options?: { taxonomy?: FacetTaxonomy; domainLabels?: Readonly<Record<string, string>> },
  ): void;
  openPanel(): void;
  closePanel(): void;
  /** The click path, oldest first. */
  readonly path: readonly BundleNode[];
  readonly panelOpen: boolean;
  /** The running canvas, or null when it could not start or lost its WebGL context. */
  readonly canvas: GraphCanvasHandle | null;
  /** Why the canvas is not running, or null. */
  readonly canvasError: GraphCanvasErrorCode | null;
  /** Typed listener on the host; returns the remover. */
  on<K extends GraphExplorerEventType>(
    type: K,
    listener: (event: GraphExplorerEventMap[K]) => void,
  ): () => void;
  /** Destroys the canvas, chips and panel and removes the frame. */
  destroy(): void;
}

/** Canvas dependency; the public mount uses GraphCanvas.mount (DOM tests inject a stand-in renderer). */
export interface ExplorerDeps {
  mountCanvas: (host: HTMLElement, options: GraphCanvasOptions) => Promise<GraphCanvasHandle>;
}

const DEFAULT_DEPS: ExplorerDeps = { mountCanvas: mountGraphCanvas };

let frames = 0;

/** Mounts the explorer into `host` (its previous content is replaced). */
export function mount(
  host: HTMLElement,
  options: GraphExplorerOptions,
): Promise<GraphExplorerHandle> {
  return mountWith(host, options, DEFAULT_DEPS);
}

function requireOptions(options: GraphExplorerOptions): void {
  if (typeof options !== "object" || options === null) {
    throw new TypeError("GraphExplorer.mount needs options.");
  }
  if (options.autoOpen !== undefined && typeof options.autoOpen !== "boolean") {
    throw new TypeError("autoOpen must be a boolean.");
  }
  if (options.suppressKeys !== undefined && typeof options.suppressKeys !== "function") {
    throw new TypeError("suppressKeys must be a function.");
  }
  const canvas: unknown = options.canvas;
  if (canvas !== undefined && (typeof canvas !== "object" || canvas === null)) {
    throw new TypeError("canvas must be an object of canvas options.");
  }
}

/** mount() with an injectable canvas mount. */
export async function mountWith(
  host: HTMLElement,
  options: GraphExplorerOptions,
  deps: ExplorerDeps,
): Promise<GraphExplorerHandle> {
  if (!(host instanceof HTMLElement)) {
    throw new TypeError("GraphExplorer.mount needs a host HTMLElement.");
  }
  const doc = host.ownerDocument;
  const view = doc.defaultView;
  if (!view) throw new TypeError("GraphExplorer.mount needs a host in a document with a window.");
  requireOptions(options);
  let bundle = validateBundle(options.bundle);
  const labels = resolveLabels(DEFAULT_EXPLORER_LABELS, options.labels);
  const warn = options.onWarn ?? defaultWarn;

  // ---- frame ----
  const id = `qb-gx-${String(++frames)}`;
  const gx = el("div", "gx");
  gx.setAttribute("role", "region");
  gx.setAttribute("aria-label", labels.region);
  const stage = el("div", "gx__stage");
  const canvasHost = el("div");
  const strip = el("div", "gx__facets is-collapsed");
  const toggle = el("button", "gx__ftoggle");
  toggle.type = "button";
  const pill = el("button", "gx__pshow");
  pill.type = "button";
  pill.setAttribute("aria-controls", `${id}-panel`);
  const panelWrap = el("div", "gx__panel is-hidden");
  panelWrap.id = `${id}-panel`;
  panelWrap.setAttribute("inert", "");
  const hide = el("button", "gx__phide");
  hide.type = "button";
  hide.setAttribute("aria-controls", panelWrap.id);
  stage.append(canvasHost, strip, pill, panelWrap);
  gx.append(stage);

  // ---- state ----
  let canvas: GraphCanvasHandle | null = null;
  /** A canvas that lost its context: destroyed on retry or destroy. */
  let lostCanvas: GraphCanvasHandle | null = null;
  let canvasError: GraphCanvasErrorCode | null = null;
  let unbindCanvas: (() => void) | null = null;
  let path: BundleNode[] = [];
  let reported = "";
  /** The next select opens the panel (deep link). */
  let openPending = false;
  let open = false;
  let destroyed = false;
  let mountToken = 0;
  let pointerInFrame = false;
  let pointerOnCanvas = false;
  const sheetQuery = view.matchMedia?.(SHEET_QUERY) ?? null;
  const isSheet = (): boolean => sheetQuery?.matches === true;

  const emit = <K extends GraphExplorerEventType>(
    type: K,
    detail: GraphExplorerEventMap[K]["detail"],
  ): void => {
    host.dispatchEvent(new CustomEvent(type, { detail }));
  };

  // ---- composed renderers (they validate their own options) ----
  const barHost = el("div");
  const bar: FacetFilterBarHandle = mountFacetFilterBar(barHost, {
    nodes: bundle.nodes,
    taxonomy: options.taxonomy,
    ...(options.domainLabels === undefined ? {} : { domainLabels: options.domainLabels }),
    ...(options.facetLabels === undefined ? {} : { labels: options.facetLabels }),
    onChange: (change) => {
      canvas?.setFilter(change.predicate);
      syncToggle();
    },
  });
  const barNode = barHost.firstElementChild;
  if (!(barNode instanceof HTMLElement)) throw new Error("FacetFilterBar rendered no bar.");
  barNode.id = `${id}-facets`;
  toggle.setAttribute("aria-controls", barNode.id);
  strip.append(toggle, barNode);

  let panel: EntityPanelHandle;
  try {
    panel = mountEntityPanel(panelWrap, {
      stats: bundle.stats,
      detail: options.detail,
      headAction: hide,
      ...(options.panelLabels === undefined ? {} : { labels: options.panelLabels }),
      ...(options.sourceBadges === undefined ? {} : { sourceBadges: options.sourceBadges }),
      ...(options.onWarn === undefined ? {} : { onWarn: options.onWarn }),
      onCrumb: (index) => {
        const target = path[index];
        if (canvas === null || target === undefined) return;
        // Truncate first: the select that follows finds its entity at the path's end and does not push.
        path = path.slice(0, index + 1);
        canvas.select(target.id);
      },
      onSelect: (node) => {
        canvas?.select(node.id);
      },
      onShowMore: () => {
        canvas?.expandNeighbors();
      },
    });
  } catch (error) {
    bar.destroy();
    throw error;
  }

  // ---- path, panel, pill, toggle ----
  function reportPath(): void {
    const key = path.map((node) => String(node.id)).join(">");
    if (key === reported) return;
    reported = key;
    emit("pathchange", { node: path.at(-1) ?? null, path: [...path] });
  }

  function syncPill(): void {
    const sheet = isSheet();
    pill.replaceChildren(sheet ? labels.detailsSheet : labels.detailsShow);
    const current = path.at(-1);
    if (sheet && current !== undefined) pill.append(el("b", undefined, current.name));
    hide.textContent = sheet ? labels.hideSheet : labels.hide;
  }

  function syncToggle(): void {
    const collapsed = strip.classList.contains("is-collapsed");
    toggle.replaceChildren(collapsed ? labels.filtersShow : labels.filtersHide);
    const active = bar.activeCount;
    if (active > 0) toggle.append(" ", el("b", undefined, labels.filtersActive(active)));
    toggle.setAttribute("aria-expanded", String(!collapsed));
  }

  function setOpen(next: boolean, focus: "panel" | "pill" | null): void {
    const focusWasInside = panelWrap.contains(doc.activeElement);
    panelWrap.classList.toggle("is-hidden", !next);
    if (next) panelWrap.removeAttribute("inert");
    else panelWrap.setAttribute("inert", "");
    pill.hidden = next;
    pill.setAttribute("aria-expanded", String(next));
    syncPill();
    const panelRoot = panelWrap.querySelector<HTMLElement>(".epanel");
    if (focus === "panel" && panelRoot !== null) focusWithoutRing(panelRoot);
    // Focus never stays inside a hidden panel: it returns to the pill, ring-free.
    if (focus === "pill" || (!next && focusWasInside)) focusWithoutRing(pill);
    if (open !== next) {
      open = next;
      emit("panel", { open });
    }
  }

  function resetPath(): void {
    path = [];
    panel.idle();
    syncPill();
    reportPath();
  }

  // ---- canvas events ----
  function onCanvasSelect(event: CustomEvent<GraphSelectDetail>): void {
    const { node, neighbors, total } = event.detail;
    if (path.at(-1)?.id !== node.id) path = [...path, node];
    panel.show({ path, neighbors, total });
    const shouldOpen = openPending || (options.autoOpen ?? !isSheet());
    openPending = false;
    if (shouldOpen) setOpen(true, null);
    else syncPill();
    reportPath();
  }

  /** The canvas lost its WebGL context: it stops being `canvas`, but keeps its error figure until a retry. */
  function onCanvasError(
    event: CustomEvent<{ code: GraphCanvasErrorCode; message: string }>,
  ): void {
    unbindCanvas?.();
    unbindCanvas = null;
    lostCanvas = canvas;
    canvas = null;
    canvasError = event.detail.code;
    resetPath();
    emit("error", event.detail);
  }

  function canvasOptions(): GraphCanvasOptions {
    // The explorer owns `data`, `chip` and `suppressKeys`, whatever a caller put in `canvas`.
    const passed: Partial<GraphCanvasOptions> = { ...options.canvas };
    delete passed.suppressKeys;
    return {
      ...passed,
      data: bundle,
      chip: false,
      ...(options.suppressKeys === undefined ? {} : { suppressKeys: options.suppressKeys }),
    };
  }

  /** Mounts (or re-mounts) the canvas. `report` says whether a failure fires `error`: not during mount(). */
  async function startCanvas(report: boolean): Promise<void> {
    const token = ++mountToken;
    unbindCanvas?.();
    unbindCanvas = null;
    canvas?.destroy();
    canvas = null;
    lostCanvas?.destroy();
    lostCanvas = null;
    let handle: GraphCanvasHandle;
    try {
      handle = await deps.mountCanvas(canvasHost, canvasOptions());
    } catch (error) {
      // Bad options and data reject; a browser that cannot run the canvas does not.
      if (!(error instanceof GraphCanvasError) || error.code === "invalid-bundle") throw error;
      if (destroyed || token !== mountToken) return;
      canvasError = error.code;
      if (report) emit("error", { code: error.code, message: error.message });
      return;
    }
    if (destroyed || token !== mountToken) {
      handle.destroy();
      return;
    }
    canvas = handle;
    canvasError = null;
    const offs = [handle.on("select", onCanvasSelect), handle.on("clear", resetPath)];
    offs.push(handle.on("error", onCanvasError));
    unbindCanvas = () => {
      for (const off of offs) off();
    };
  }

  /** The canvas error figure's retry: mount the canvas again, from a clean path and chips. */
  function onRetry(): void {
    if (destroyed) return;
    resetPath();
    void startCanvas(true)
      .then(() => {
        bar.clear();
      })
      .catch((error: unknown) => {
        // The bundle was validated before, so this is unexpected: say why.
        const reason = error instanceof Error ? error.message : String(error);
        warn(`GraphExplorer: the canvas could not be mounted again (${reason}).`);
      });
  }

  /** Keeps the pill and the sheet below the filters strip, however many rows its chips take. */
  function placeBelowStrip(): void {
    const top = Math.max(OVERLAY_TOP, strip.offsetHeight + STRIP_GAP);
    gx.style.setProperty("--gx-top", `${String(top)}px`);
  }
  const stripObserver =
    typeof view.ResizeObserver === "function" ? new view.ResizeObserver(placeBelowStrip) : null;

  // ---- frame listeners ----
  function onToggle(): void {
    strip.classList.toggle("is-collapsed");
    syncToggle();
    placeBelowStrip();
  }

  function onKey(event: KeyboardEvent): void {
    if (path.length === 0 || canvas === null) return;
    const target = event.target instanceof Node ? event.target : null;
    // The canvas owns Esc while focus or the idle pointer is on it.
    if (target !== null && canvasHost.contains(target)) return;
    const nothingFocused = target === null || target === doc.body || target === doc.documentElement;
    if (nothingFocused && pointerOnCanvas) return;
    const ctx = {
      host: gx,
      pointerInside: pointerInFrame,
      suppressKeys: options.suppressKeys,
    };
    if (!isCanvasEscape(event, ctx)) return;
    event.preventDefault();
    canvas.clearSelection();
  }

  const onFrameEnter = (): void => {
    pointerInFrame = true;
  };
  const onFrameLeave = (): void => {
    pointerInFrame = false;
  };
  const onCanvasEnter = (): void => {
    pointerOnCanvas = true;
  };
  const onCanvasLeave = (): void => {
    pointerOnCanvas = false;
  };
  const onPill = (): void => setOpen(true, "panel");
  const onHide = (): void => setOpen(false, "pill");
  const onSheetChange = (): void => syncPill();

  toggle.addEventListener("click", onToggle);
  pill.addEventListener("click", onPill);
  hide.addEventListener("click", onHide);
  canvasHost.addEventListener("retry", onRetry);
  canvasHost.addEventListener("pointerenter", onCanvasEnter);
  canvasHost.addEventListener("pointerleave", onCanvasLeave);
  gx.addEventListener("pointerenter", onFrameEnter);
  gx.addEventListener("pointerleave", onFrameLeave);
  doc.addEventListener("keydown", onKey);
  sheetQuery?.addEventListener?.("change", onSheetChange);
  stripObserver?.observe(strip);

  function destroy(): void {
    if (destroyed) return;
    destroyed = true;
    mountToken++;
    unbindCanvas?.();
    canvas?.destroy();
    canvas = null;
    lostCanvas?.destroy();
    lostCanvas = null;
    toggle.removeEventListener("click", onToggle);
    pill.removeEventListener("click", onPill);
    hide.removeEventListener("click", onHide);
    canvasHost.removeEventListener("retry", onRetry);
    canvasHost.removeEventListener("pointerenter", onCanvasEnter);
    canvasHost.removeEventListener("pointerleave", onCanvasLeave);
    gx.removeEventListener("pointerenter", onFrameEnter);
    gx.removeEventListener("pointerleave", onFrameLeave);
    doc.removeEventListener("keydown", onKey);
    sheetQuery?.removeEventListener?.("change", onSheetChange);
    stripObserver?.disconnect();
    bar.destroy();
    panel.destroy();
    gx.remove();
  }

  // Every overlay starts minimized, at every width.
  setOpen(false, null);
  syncToggle();
  host.replaceChildren(gx);
  placeBelowStrip();
  try {
    await startCanvas(false);
  } catch (error) {
    destroy();
    throw error;
  }

  return {
    select(idOrName, selectOptions) {
      if (destroyed || canvas === null) return false;
      openPending = selectOptions?.openPanel === true;
      const found = canvas.select(idOrName);
      if (!found) openPending = false;
      return found;
    },
    clearSelection() {
      if (destroyed) return;
      if (canvas === null) resetPath();
      else canvas.clearSelection();
    },
    setData(next, swap) {
      if (destroyed) return;
      const valid = validateBundle(next);
      // The chips validate the taxonomy and labels first, so a bad swap changes nothing.
      bar.setData(valid.nodes, swap?.taxonomy, swap?.domainLabels);
      bundle = valid;
      canvas?.setData(valid);
      openPending = false;
      panel.setStats(valid.stats);
      resetPath();
      syncToggle();
    },
    openPanel() {
      if (!destroyed) setOpen(true, null);
    },
    closePanel() {
      if (!destroyed) setOpen(false, null);
    },
    get path() {
      return [...path];
    },
    get panelOpen() {
      return open;
    },
    get canvas() {
      return canvas;
    },
    get canvasError() {
      return canvasError;
    },
    on(type, listener) {
      const wrapped = listener as EventListener;
      host.addEventListener(type, wrapped);
      return () => host.removeEventListener(type, wrapped);
    },
    destroy,
  };
}
