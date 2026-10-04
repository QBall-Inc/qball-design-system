// The input model for QuBrain surfaces: the shapes the components render from.
// It is backend-agnostic. Each consumer maps its own backend's payloads into
// these types (its adapter lives in the consumer, never in this package) and
// validates the result where it enters the page.

/** Graph-wide counts carried by every skeleton bundle. Dates are ISO `YYYY-MM-DD`. */
export interface BundleStats {
  entities: number;
  claims_total: number;
  claims_valid: number;
  claims_superseded: number;
  episodes: number;
  earliest_claim_date: string;
  latest_claim_date: string;
  /** ISO date the graph revision was published — the panel footer's "revision date". */
  snapshot_date: string;
}

/** One `(domain, sub_domain)` facet tag exactly as a source was filed. */
export interface FacetPair {
  domain: string;
  sub_domain: string;
}

/** An entity's facet tags: the UNION of its sources' tags (may span several domains). */
export interface BundleFacets {
  domains: string[];
  sub_domains: string[];
  /**
   * The same tags kept as pairs. When present, facet matching uses these and
   * ignores the flat arrays; without them, a sub-domain shared by several of
   * the entity's domains (e.g. `other`) cannot be attributed and is reported
   * as unattributable rather than guessed.
   */
  pairs?: FacetPair[];
}

export interface BundleNode {
  /** EPHEMERAL per revision — never persist across bundles. */
  id: number;
  /** Canonical display name. */
  name: string;
  /** Entity class: person | org | product | concept | ... */
  cls: string;
  /** Episode count (size signal). */
  eps: number;
  /** For client-side search; may be empty. */
  aliases: string[];
  facets?: BundleFacets;
}

/** An asserted relationship: backed by `n` claims, labelled by `rels`. */
export interface TypedEdge {
  a: number;
  b: number;
  /** Claim count backing this edge (1..47 in real data). */
  n: number;
  /** Top relation labels, most frequent first. */
  rels: string[];
}

/** Association, not assertion: the two entities appeared together in `w` sources. */
export interface ComentionEdge {
  a: number;
  b: number;
  /** Shared-source count (1..8 in real data). */
  w: number;
}

/** Precomputed x,y,z per node id (keys are stringified ids). */
export type BundleLayout = Record<string, [number, number, number]>;

export interface SkeletonBundle {
  /** Present in the mock only. */
  _note?: string;
  /** Bundle identity; every id in the bundle is scoped to it. */
  revision: string;
  stats: BundleStats;
  nodes: BundleNode[];
  typed_edges: TypedEdge[];
  comention_edges: ComentionEdge[];
  layout: BundleLayout | null;
}

/** Where a claim came from: the reading-list unit. */
export interface SourceRef {
  episode_id: string;
  title: string;
  url: string;
  source_type: string;
  save_date: string;
}

/**
 * A source that cannot be resolved (its record is gone, or the consumer's
 * payload did not carry it). Rendered as "source unavailable" — never dropped,
 * never dressed up as a real source with empty fields.
 */
export interface UnavailableSource {
  kind: "unavailable";
  /** The episode the claim points at, when the payload named one. */
  episode_id: string | null;
}

export type ClaimSource = SourceRef | UnavailableSource;

export interface Claim {
  /** Ephemeral per revision. */
  claim_id: number;
  /** Full sentence — the panel's primary content. */
  claim_text: string;
  /** 0..1 */
  confidence: number;
  confidence_tier: string;
  valid_from: string;
  /** Set => superseded. */
  valid_to?: string;
  superseded_by_claim_id?: number;
  /** Absent on older data. */
  endorsement_tier?: string;
  verification?: string;
  source: ClaimSource;
}

/** Detail for a clicked edge or path hop. */
export interface ConnectionDetail {
  kind: "typed" | "comention";
  /** typed: the asserting claims (current and superseded). */
  claims?: Claim[];
  /** comention: the shared articles. */
  shared_sources?: ClaimSource[];
}

/** Narrows a claim source to a real, linkable SourceRef. */
export function isSourceUnavailable(source: ClaimSource): source is UnavailableSource {
  return "kind" in source && source.kind === "unavailable";
}
