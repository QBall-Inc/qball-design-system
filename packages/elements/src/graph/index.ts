// @qball-inc/elements/graph — knowledge-graph canvas, facet bar, entity panel
// and explorer (Release C). three.js is an OPTIONAL peer: it is loaded lazily
// here, never at module evaluation, so importing this entry stays safe in a
// DOM-less build and pages that never mount a canvas never fetch it (plan AD-2).

/** Identifies which public entry a module was loaded from. */
export const ENTRY = "graph" as const;

/**
 * Loads the consumer-installed `three` peer on demand.
 * Rejects with the bundler/runtime module-resolution error when `three` is not
 * installed — './graph' consumers must install it (documented prerequisite).
 */
export function loadThree(): Promise<typeof import("three")> {
  return import("three");
}
