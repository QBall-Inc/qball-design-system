// @qball-inc/elements/graph — knowledge-graph canvas, facet bar, entity panel
// and explorer (Release C). three.js is an OPTIONAL peer: it is loaded lazily
// inside GraphCanvas.mount, never at module evaluation, so importing this entry
// stays safe in a DOM-less build and pages that never mount a canvas never
// fetch it (plan AD-2).

import { mount } from "./canvas";

/** Identifies which public entry a module was loaded from. */
export const ENTRY = "graph" as const;

export { loadThree } from "./three-loader";

/** Precomputed layouts: run once server-side, ship in the bundle's `layout`. */
export { LAYOUT_VERSION, computeLayout } from "./layout";

/** The 3D knowledge-graph canvas. */
export const GraphCanvas = Object.freeze({ mount });

export type {
  GraphCanvasEventMap,
  GraphCanvasEventType,
  GraphCanvasHandle,
  GraphCanvasOptions,
  GraphNeighbor,
  GraphSelectDetail,
} from "./canvas";
export { GRAPH_CANVAS_MARKER } from "./canvas";
export type { CanvasLabels, ClassLabels } from "./canvas-copy";
export { DEFAULT_CANVAS_LABELS } from "./canvas-copy";
export type { GraphCanvasErrorCode } from "./canvas-errors";
export { GraphCanvasError } from "./canvas-errors";
