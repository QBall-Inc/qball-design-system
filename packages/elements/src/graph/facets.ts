// Facet model behind the explorer's filter chips. Driven only by a
// caller-supplied taxonomy (any number of domains, each with its own
// sub-domains) — the prototype's best-domain-by-weighted-count heuristic is
// deliberately not ported. A chip is a (domain, sub_domain) pair. Nodes that
// carry `facets.pairs` match exactly; nodes with only the flat arrays match
// when the taxonomy attributes the sub-domain to exactly one of the node's
// domains, and are otherwise reported as unattributable, never guessed.

import type { BundleNode, FacetPair } from "../types";

/**
 * Domains → their sub-domains, in display order. Structurally compatible with
 * a backend vocab object such as `{ vocab_version, domains }`; extra keys are
 * ignored. Display labels are not part of the taxonomy: they are a UI prop.
 */
export interface FacetTaxonomy {
  domains: Readonly<Record<string, readonly string[]>>;
}

/** A filter chip: one (domain, sub_domain) pair from the taxonomy. */
export type FacetChip = FacetPair;

/** Per-chip counts. Each node counts at most once per chip. */
export interface ChipCount {
  chip: FacetChip;
  /** Nodes that carry this chip's pair (exactly, or unambiguously attributed). */
  matches: number;
  /**
   * Nodes that carry this chip's sub-domain and are candidates for its domain,
   * but whose flat facet arrays cannot say which domain the tag belongs to.
   * Always 0 for nodes that carry `facets.pairs`.
   */
  unattributable: number;
}

export interface FacetModel {
  /** Every chip in taxonomy order, with its counts. */
  readonly chips: readonly ChipCount[];
  /** True when no chip has an unattributable node, so every count is exact. */
  readonly facetsComplete: boolean;
  /**
   * Ids of the nodes matching ANY of the given chips (chips OR together).
   * An empty chip list returns an empty set; callers treat "no active chips"
   * as "no filter". Throws when a chip is not in the taxonomy.
   */
  activeFacets(chips: readonly FacetChip[]): Set<number>;
}

interface ChipNodes {
  matches: Set<number>;
  unattributable: Set<number>;
}

const chipKey = (domain: string, subDomain: string): string => `${domain}\u0000${subDomain}`;

function checkTaxonomy(taxonomy: FacetTaxonomy): void {
  const { domains } = taxonomy as { domains: unknown };
  if (typeof domains !== "object" || domains === null || Array.isArray(domains)) {
    throw new Error("FacetTaxonomy.domains must be an object of domain → sub-domain list");
  }
  for (const [domain, subs] of Object.entries(domains as Record<string, unknown>)) {
    if (!Array.isArray(subs) || subs.some((s) => typeof s !== "string")) {
      throw new Error(`FacetTaxonomy.domains["${domain}"] must be an array of strings`);
    }
    const seen = new Set<string>();
    for (const sub of subs as string[]) {
      if (seen.has(sub)) {
        throw new Error(`FacetTaxonomy.domains["${domain}"] lists "${sub}" more than once`);
      }
      seen.add(sub);
    }
  }
}

/**
 * Builds the facet model for one bundle's nodes. Runs once per bundle and
 * taxonomy; `activeFacets` then answers filter changes from the index. Tags
 * the taxonomy does not list (a pair or sub-domain outside it) have no chip
 * and are not counted, so pass the taxonomy that matches the bundle's vocab.
 */
export function buildFacetModel(nodes: readonly BundleNode[], taxonomy: FacetTaxonomy): FacetModel {
  checkTaxonomy(taxonomy);

  const index = new Map<string, ChipNodes>();
  const owners = new Map<string, string[]>();
  const order: FacetChip[] = [];
  for (const [domain, subs] of Object.entries(taxonomy.domains)) {
    for (const sub of subs) {
      index.set(chipKey(domain, sub), { matches: new Set(), unattributable: new Set() });
      order.push({ domain, sub_domain: sub });
      const list = owners.get(sub);
      if (list) list.push(domain);
      else owners.set(sub, [domain]);
    }
  }

  for (const node of nodes) {
    const facets = node.facets;
    if (!facets) continue;
    if (facets.pairs) {
      for (const pair of facets.pairs) {
        index.get(chipKey(pair.domain, pair.sub_domain))?.matches.add(node.id);
      }
      continue;
    }
    const nodeDomains = new Set(facets.domains);
    for (const sub of facets.sub_domains) {
      const candidates = (owners.get(sub) ?? []).filter((d) => nodeDomains.has(d));
      const bucket = candidates.length === 1 ? "matches" : "unattributable";
      for (const domain of candidates) {
        index.get(chipKey(domain, sub))![bucket].add(node.id);
      }
    }
  }

  const chips = order.map((chip) => {
    const entry = index.get(chipKey(chip.domain, chip.sub_domain))!;
    return { chip, matches: entry.matches.size, unattributable: entry.unattributable.size };
  });

  return {
    chips,
    facetsComplete: chips.every((c) => c.unattributable === 0),
    activeFacets(active) {
      const result = new Set<number>();
      for (const chip of active) {
        const entry = index.get(chipKey(chip.domain, chip.sub_domain));
        if (!entry) {
          throw new Error(`chip (${chip.domain}, ${chip.sub_domain}) is not in the facet taxonomy`);
        }
        for (const id of entry.matches) result.add(id);
      }
      return result;
    },
  };
}
