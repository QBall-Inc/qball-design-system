// Every user-visible default string FacetFilterBar and EntityPanel render. A
// consumer overrides any of them through the `labels` mount option (partial;
// the rest keep these defaults). Defaults are neutral, lowercase and free of
// em-dashes, like the canvas copy; product wording (a panel title, say) comes
// from the consumer. All copy lands via textContent or attributes. The panel
// footer is not here: it is the locked `panelFooter` line.

import { DEFAULT_CLASS_LABELS, requireClassLabels, type ClassLabels } from "./canvas-copy";

export interface FacetBarLabels {
  /** Accessible name of the chip group. */
  group: string;
  /** Match count while chips are active: `N entities match`. */
  matches: (count: number) => string;
  /**
   * Match count when some entities cannot be placed in a domain (the facet
   * data is incomplete): `N match · K unassignable`.
   */
  matchesIncomplete: (count: number, unassignable: number) => string;
  /** Visible mark on a chip whose count is incomplete. */
  incompleteMark: string;
  /** Accessible name of such a chip: its sub-topic and how many are unassignable. */
  incompleteChip: (subDomain: string, unassignable: number) => string;
  /** Clear-all button text. */
  clear: string;
}

export const DEFAULT_FACET_BAR_LABELS: Readonly<FacetBarLabels> = Object.freeze({
  group: "filter by facet",
  matches: (count: number) => `${count} ${count === 1 ? "entity matches" : "entities match"}`,
  matchesIncomplete: (count: number, unassignable: number) =>
    `${count} match · ${unassignable} unassignable`,
  incompleteMark: "≈",
  incompleteChip: (subDomain: string, unassignable: number) =>
    `${subDomain}, incomplete: ${unassignable} unassignable`,
  clear: "× clear",
});

export interface PanelLabels {
  /** Idle header title, e.g. your product's name. No default: empty shows none. */
  idleTitle: string;
  /** Idle header meta line from the bundle stats: `N episodes`. */
  idleMeta: (episodes: number) => string;
  /** Idle body. */
  idleBody: string;
  /** Body with one entity selected and no connections to show. */
  pickHop: string;
  /** Accessible name of the breadcrumb trail. */
  crumbs: string;
  /** Entity class display names, keyed by `BundleNode.cls` (unknown classes show the raw class). */
  classes: ClassLabels;
  /** Header meta: `N episodes`. */
  episodes: (count: number) => string;
  /** Header meta suffix for the first alias: `aka “alias”`. */
  aka: (alias: string) => string;
  /** Typed hop heading: `A → B · the graph asserts`. */
  hopAsserts: (from: string, to: string) => string;
  /** Co-mention hop heading: `A · B`. */
  hopComention: (from: string, to: string) => string;
  /** Co-mention hop note, `sources` being the shared-source count. */
  comentionNote: (sources: number) => string;
  /** Hop section while its detail is loading. */
  hopLoading: string;
  /** Hop section when its detail failed, and the retry button. */
  hopError: string;
  retry: string;
  /** Connections heading: `connections · showing N of M`. */
  connections: (shown: number, total: number) => string;
  /** Typed neighbour row: `k claims`. */
  rowClaims: (claims: number) => string;
  /** Co-mention neighbour row: `discussed together · n src`. */
  rowComention: (sources: number) => string;
  /** "Show more" row and its remaining count. */
  showMore: string;
  remaining: (count: number) => string;
  /** Reading-list heading. */
  readingList: string;
}

const plural = (count: number, one: string, many: string): string =>
  `${count} ${count === 1 ? one : many}`;

export const DEFAULT_PANEL_LABELS: Readonly<PanelLabels> = Object.freeze({
  idleTitle: "",
  idleMeta: (episodes: number) => plural(episodes, "episode", "episodes"),
  idleBody:
    "click an entity on the canvas to begin. click a connected entity next and this panel narrates the hop with the actual claim sentences, never bare counts.",
  pickHop:
    "click a connected entity on the canvas, or a connection below, to narrate the hop in claims.",
  crumbs: "click path",
  classes: DEFAULT_CLASS_LABELS,
  episodes: (count: number) => plural(count, "episode", "episodes"),
  aka: (alias: string) => `aka “${alias}”`,
  hopAsserts: (from: string, to: string) => `${from} → ${to} · the graph asserts`,
  hopComention: (from: string, to: string) => `${from} · ${to}`,
  comentionNote: (sources: number) =>
    `no asserted relationship: these entities were discussed together in ${plural(sources, "source", "sources")}. association, not assertion.`,
  hopLoading: "loading the claims…",
  hopError: "the claims could not be loaded.",
  retry: "retry",
  connections: (shown: number, total: number) => `connections · showing ${shown} of ${total}`,
  rowClaims: (claims: number) => plural(claims, "claim", "claims"),
  rowComention: (sources: number) => `discussed together · ${sources} src`,
  showMore: "show more",
  remaining: (count: number) => `${count} remaining`,
  readingList: "reading list",
});

/**
 * Merges a partial `labels` option over `defaults`. Fails fast on an unknown
 * key or a wrongly typed value (string vs function), naming the key.
 */
export function resolveLabels<T extends object>(defaults: Readonly<T>, partial: unknown): T {
  const merged = { ...defaults } as Record<string, unknown>;
  if (partial === undefined) return merged as T;
  if (typeof partial !== "object" || partial === null || Array.isArray(partial)) {
    throw new TypeError("labels must be an object.");
  }
  for (const [key, value] of Object.entries(partial)) {
    if (!Object.hasOwn(defaults, key)) throw new TypeError(`labels.${key} is not a known label.`);
    const fallback = (defaults as Record<string, unknown>)[key];
    if (key === "classes") {
      merged["classes"] = { ...(fallback as ClassLabels), ...requireClassLabels(value) };
    } else if (typeof fallback === "function") {
      if (typeof value !== "function") throw new TypeError(`labels.${key} must be a function.`);
      merged[key] = value;
    } else {
      if (typeof value !== "string") throw new TypeError(`labels.${key} must be a string.`);
      merged[key] = value;
    }
  }
  return merged as T;
}
