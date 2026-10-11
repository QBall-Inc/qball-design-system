// GraphCanvas.mount(): the QuBrain 3D knowledge-graph canvas ("Observatory"),
// ported from the prototype engine (design bundle graph/graph-canvas.js) onto
// the package's pure graph logic. Data-only: the consumer passes a validated
// SkeletonBundle and drives loading/refresh; the canvas never fetches. three.js
// is imported lazily inside mount (AD-2). Every colour is a CSS token
// (graph.css); every string is overridable via `labels` and lands as text.
//
// This module is the public surface: types, option/engine acquisition and the
// handle facade. The running canvas lives in canvas-controller.ts.

import type { BundleNode, SkeletonBundle } from "../types";
import { validateSkeletonBundle } from "../validator";
import { GraphCanvasError, type GraphCanvasErrorCode } from "./canvas-errors";
import { CanvasController, createHud, renderMountFailure, type Engine } from "./canvas-controller";
import { resolveOptions, type GraphCanvasOptions, type ResolvedOptions } from "./canvas-options";
import { readPalette } from "./palette";
import { createWebGLRenderer, type RendererFactory, type RendererLike, type Three } from "./scene";
import { loadThree } from "./three-loader";

export type { GraphCanvasOptions } from "./canvas-options";

/**
 * Package-unique marker string, carried by every mounted canvas element
 * (`data-qb-engine`) and therefore by any bundle chunk that includes the
 * canvas. Consumers grep their build output for it to prove a page or flag-off
 * build ships no graph code.
 */
export const GRAPH_CANVAS_MARKER = "qball-elements-graphcanvas";

export interface GraphNeighbor {
  node: BundleNode;
  /** Asserted (typed edge) or association (co-mention edge). */
  typed: boolean;
  /** Claim count `n` (typed) or shared-source count `w` (co-mention). */
  weight: number;
}

export interface GraphSelectDetail {
  node: BundleNode;
  /** The budgeted neighbor list currently shown, strongest first. */
  neighbors: GraphNeighbor[];
  /** All neighbors of the node. */
  total: number;
}

/** Events dispatched on the host element (they do not bubble). */
export interface GraphCanvasEventMap {
  select: CustomEvent<GraphSelectDetail>;
  clear: CustomEvent<Record<string, never>>;
  filter: CustomEvent<{ matches: number }>;
  /** The error figure's retry button was pressed: destroy the old handle (if any), then mount again. */
  retry: CustomEvent<{ code: GraphCanvasErrorCode }>;
  /** The canvas failed after mount (the WebGL context was lost). */
  error: CustomEvent<{ code: GraphCanvasErrorCode; message: string }>;
}

export type GraphCanvasEventType = keyof GraphCanvasEventMap;

export interface GraphCanvasHandle {
  /** Selects by revision-scoped id or by canonical name; false when unknown. */
  select(idOrName: number | string): boolean;
  clearSelection(): void;
  /** "Show more": grows the selection's neighbor list by the budget; false when nothing grew. */
  expandNeighbors(): boolean;
  /** Ghosts non-matching nodes; null clears. Returns the match count. */
  setFilter(predicate: ((node: BundleNode) => boolean) | null): number;
  /** Swaps in a new bundle without remounting; clears selection and filter. */
  setData(bundle: SkeletonBundle): void;
  /**
   * Resolves when the current bundle's layout has settled, or when that bundle
   * is replaced (setData), lost or destroyed first — it never hangs.
   */
  readonly settled: Promise<void>;
  readonly snapshotDate: string;
  /** Typed listener on the host; returns the remover. */
  on<K extends GraphCanvasEventType>(
    type: K,
    listener: (event: GraphCanvasEventMap[K]) => void,
  ): () => void;
  /** Stops rendering, disposes every GPU object and listener, and removes what this mount added. */
  destroy(): void;
}

/** Engine dependencies; the public mount uses the real ones. */
export interface CanvasDeps {
  loadThree: () => Promise<Three>;
  createRenderer: RendererFactory;
}

const DEFAULT_DEPS: CanvasDeps = { loadThree, createRenderer: createWebGLRenderer };

/** Mounts the canvas into `host` (its previous content is replaced). */
export function mount(host: HTMLElement, options: GraphCanvasOptions): Promise<GraphCanvasHandle> {
  return mountWith(host, options, DEFAULT_DEPS);
}

/** Validates a bundle, rethrowing as the typed `invalid-bundle` failure. */
export function validateBundle(bundle: unknown): SkeletonBundle {
  try {
    validateSkeletonBundle(bundle);
    return bundle;
  } catch (cause) {
    throw new GraphCanvasError(
      "invalid-bundle",
      `GraphCanvas data is not a valid bundle: ${String(cause)}`,
      { cause },
    );
  }
}

/** Loads three and creates the renderer, mapping each failure to its typed code. */
async function acquireEngine(host: HTMLElement, deps: CanvasDeps): Promise<Engine> {
  const palette = readPalette(host);
  let three: Three;
  try {
    three = await deps.loadThree();
  } catch (cause) {
    throw new GraphCanvasError(
      "three-unavailable",
      "GraphCanvas could not load three.js (install the `three` peer).",
      { cause },
    );
  }
  let renderer: RendererLike;
  try {
    renderer = deps.createRenderer(three);
  } catch (cause) {
    throw new GraphCanvasError(
      "webgl-unavailable",
      "GraphCanvas could not create a WebGL context.",
      {
        cause,
      },
    );
  }
  return { three, renderer, palette };
}

/** mount() with injectable engine dependencies (the DOM tests pass a stand-in renderer). */
export async function mountWith(
  host: HTMLElement,
  options: GraphCanvasOptions,
  deps: CanvasDeps,
): Promise<GraphCanvasHandle> {
  if (!(host instanceof HTMLElement)) throw new TypeError("mount() needs a host HTMLElement.");
  const view = host.ownerDocument.defaultView;
  if (!view) throw new TypeError("mount() needs a host in a document with a window.");
  const opts: ResolvedOptions = resolveOptions(
    options,
    (query) => view.matchMedia?.(query).matches ?? false,
  );

  host.replaceChildren();
  host.classList.add("graphcanvas");
  const hud = createHud(host.ownerDocument, opts);
  host.append(hud.root);

  let bundle: SkeletonBundle;
  let engine: Engine;
  try {
    bundle = validateBundle(options.data);
    engine = await acquireEngine(host, deps);
  } catch (error) {
    if (error instanceof GraphCanvasError) renderMountFailure(host, opts, error);
    throw error;
  }

  const controller = new CanvasController(host, opts, engine, hud, bundle, GRAPH_CANVAS_MARKER);
  return {
    select: (idOrName) => controller.select(idOrName),
    clearSelection: () => controller.clearSelection(),
    expandNeighbors: () => controller.expand(),
    setFilter: (predicate) => controller.setFilter(predicate),
    setData: (next) => controller.setData(validateBundle(next)),
    get settled() {
      return controller.settled;
    },
    get snapshotDate() {
      return controller.snapshotDate;
    },
    on(type, listener) {
      const wrapped = listener as EventListener;
      host.addEventListener(type, wrapped);
      return () => host.removeEventListener(type, wrapped);
    },
    destroy: () => controller.destroy(),
  };
}
