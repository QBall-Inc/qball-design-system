// Name-based node lookup. Node ids are scoped to one bundle revision (G-CON-2)
// and must never be persisted or carried across bundles; anything that outlives
// a bundle (a deep link, a breadcrumb, a URL) refers to a node by its name.

import type { BundleNode } from "../types";

/**
 * The node whose name matches exactly (case-sensitive), or undefined. If a
 * bundle ever carries duplicate names, the first in bundle order wins, so a
 * deep link always resolves to the same node.
 */
export function resolveByName(nodes: readonly BundleNode[], name: string): BundleNode | undefined {
  return nodes.find((node) => node.name === name);
}
