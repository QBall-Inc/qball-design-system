// Precomputed layouts for the graph canvas. computeLayout runs the canvas's own
// seeded simulation to completion, so a server can compute a revision's layout
// once and hand it to every visitor: a bundle that carries a complete `layout`
// renders at once, with no settle. DOM-free and three-free (safe in Node).

import type { BundleLayout, SkeletonBundle } from "../types";
import { validateSkeletonBundle } from "../validator";
import { rngForRevision } from "./prng";
import { DEFAULT_SIM_CONFIG, buildSimEdges, makeSim, runToCompletion } from "./sim";

/**
 * Identifies the layout algorithm's output. It changes only when the same
 * bundle would produce different positions (simulation constants, forces,
 * seeding or edge mapping), never on an ordinary release. Key any stored
 * layout by `revision` plus this value.
 */
export const LAYOUT_VERSION = 1;

/**
 * The layout the canvas would settle to for `bundle`, as the bundle's `layout`
 * field (x, y, z per stringified node id). Always simulates, ignoring any
 * layout the bundle already carries. Reads only `revision`, the node ids and
 * their order, and the edges; the same inputs give the same bytes.
 * Throws BundleValidationError for a bundle that is not a valid SkeletonBundle.
 */
export function computeLayout(bundle: SkeletonBundle): BundleLayout {
  validateSkeletonBundle(bundle);
  const sim = makeSim(
    bundle.nodes.length,
    buildSimEdges(bundle),
    DEFAULT_SIM_CONFIG,
    rngForRevision(bundle.revision),
  );
  const positions = runToCompletion(sim);
  const layout: BundleLayout = {};
  bundle.nodes.forEach((node, i) => {
    layout[String(node.id)] = [positions[i * 3]!, positions[i * 3 + 1]!, positions[i * 3 + 2]!];
  });
  return layout;
}
