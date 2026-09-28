// The ONE module that knows the backend's current, provisional detail shape:
// claim dates nested under `freshness`, and sources returned as a sibling
// provenance array joined by `episode_id` instead of embedded under `source`.
// When the certified contract lands, this file is the single change point.
//
// Only named public fields are read. Anything else a payload carries is ignored
// by construction, so it can never leak into a rendered surface.
import type { Claim, ClaimSource, ConnectionDetail, SourceRef } from "./types";

/** A claim as the backend serializes it today (provisional). */
export interface ProvisionalClaim {
  claim_id: number;
  claim_text: string;
  confidence: number;
  confidence_tier: string;
  episode_id?: string | null;
  freshness: {
    valid_from: string;
    valid_to?: string | null;
    superseded_by_claim_id?: number | null;
  };
  endorsement_tier?: string | null;
  verification?: string | null;
}

/** A provenance entry as the backend serializes it today (provisional). */
export interface ProvisionalProvenance {
  episode_id: string;
  /** false when the backend has no record for this episode. */
  resolved: boolean;
  title: string | null;
  url: string | null;
  source_type: string | null;
  save_date: string | null;
}

/** An edge/hop detail payload as the backend serializes it today (provisional). */
export interface ProvisionalConnection {
  typed_claims?: ProvisionalClaim[];
  shared_episodes?: ProvisionalProvenance[];
  /** Sibling provenance for the typed claims' episodes. */
  provenance?: ProvisionalProvenance[];
}

/** Thrown when a provisional payload is missing a field the adapter needs. */
export class DetailAdapterError extends Error {
  constructor(path: string, problem: string) {
    super(`Cannot adapt detail payload at ${path}: ${problem}`);
    this.name = "DetailAdapterError";
  }
}

type Json = Record<string, unknown>;

function object(value: unknown, path: string): Json {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new DetailAdapterError(path, "expected an object");
  }
  return value as Json;
}

function list(value: unknown, path: string): unknown[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new DetailAdapterError(path, "expected an array");
  return value;
}

function requiredString(record: Json, field: string, path: string): string {
  const value = record[field];
  if (typeof value !== "string")
    throw new DetailAdapterError(`${path}.${field}`, "expected a string");
  return value;
}

function requiredNumber(record: Json, field: string, path: string): number {
  const value = record[field];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new DetailAdapterError(`${path}.${field}`, "expected a finite number");
  }
  return value;
}

function optionalString(record: Json, field: string, path: string): string | undefined {
  const value = record[field];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") {
    throw new DetailAdapterError(`${path}.${field}`, "expected a string or null");
  }
  return value;
}

function optionalNumber(record: Json, field: string, path: string): number | undefined {
  const value = record[field];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new DetailAdapterError(`${path}.${field}`, "expected a finite number or null");
  }
  return value;
}

function unitInterval(record: Json, field: string, path: string): number {
  const value = requiredNumber(record, field, path);
  if (value < 0 || value > 1) {
    throw new DetailAdapterError(
      `${path}.${field}`,
      `expected a value between 0 and 1, got ${value}`,
    );
  }
  return value;
}

/** Resolved provenance → SourceRef; unresolved or incomplete → unavailable. */
function toSource(value: unknown, path: string): ClaimSource {
  const entry = object(value, path);
  const episodeId = requiredString(entry, "episode_id", path);
  const fields = ["title", "url", "source_type", "save_date"] as const;
  const values = fields.map((field) => optionalString(entry, field, path));
  const [title, url, sourceType, saveDate] = values;
  if (
    entry["resolved"] !== true ||
    title === undefined ||
    url === undefined ||
    sourceType === undefined ||
    saveDate === undefined
  ) {
    return { kind: "unavailable", episode_id: episodeId };
  }
  const source: SourceRef = {
    episode_id: episodeId,
    title,
    url,
    source_type: sourceType,
    save_date: saveDate,
  };
  return source;
}

function indexSources(raw: Json, fields: readonly string[]): Map<string, ClaimSource> {
  const byEpisode = new Map<string, ClaimSource>();
  for (const field of fields) {
    list(raw[field], field).forEach((entry, i) => {
      const source = toSource(entry, `${field}[${i}]`);
      if (source.episode_id !== null) byEpisode.set(source.episode_id, source);
    });
  }
  return byEpisode;
}

function toClaim(value: unknown, path: string, sources: ReadonlyMap<string, ClaimSource>): Claim {
  const raw = object(value, path);
  const freshness = object(raw["freshness"], `${path}.freshness`);
  const episodeId = optionalString(raw, "episode_id", path) ?? null;
  const claim: Claim = {
    claim_id: requiredNumber(raw, "claim_id", path),
    claim_text: requiredString(raw, "claim_text", path),
    confidence: unitInterval(raw, "confidence", path),
    confidence_tier: requiredString(raw, "confidence_tier", path),
    valid_from: requiredString(freshness, "valid_from", `${path}.freshness`),
    source: (episodeId === null ? undefined : sources.get(episodeId)) ?? {
      kind: "unavailable",
      episode_id: episodeId,
    },
  };
  const validTo = optionalString(freshness, "valid_to", `${path}.freshness`);
  if (validTo !== undefined) claim.valid_to = validTo;
  const supersededBy = optionalNumber(freshness, "superseded_by_claim_id", `${path}.freshness`);
  if (supersededBy !== undefined) claim.superseded_by_claim_id = supersededBy;
  const endorsement = optionalString(raw, "endorsement_tier", path);
  if (endorsement !== undefined) claim.endorsement_tier = endorsement;
  const verification = optionalString(raw, "verification", path);
  if (verification !== undefined) claim.verification = verification;
  return claim;
}

/**
 * Maps a provisional edge/hop payload into the public ConnectionDetail.
 * `payload` is expected to match ProvisionalConnection and is checked field by
 * field. `kind` is the edge class the user clicked. Typed: every claim (current and
 * superseded) with its source joined from the sibling provenance. Co-mention:
 * the shared sources. A source that cannot be resolved becomes
 * `{ kind: "unavailable" }`; no claim or source is ever dropped.
 */
export function adaptConnection(
  kind: ConnectionDetail["kind"],
  payload: unknown,
): ConnectionDetail {
  if (kind !== "typed" && kind !== "comention") {
    throw new DetailAdapterError(
      "kind",
      `expected "typed" or "comention", got ${JSON.stringify(kind)}`,
    );
  }
  const raw = object(payload, "(root)");
  if (kind === "comention") {
    const shared = list(raw["shared_episodes"], "shared_episodes");
    return {
      kind,
      shared_sources: shared.map((entry, i) => toSource(entry, `shared_episodes[${i}]`)),
    };
  }
  const sources = indexSources(raw, ["provenance", "shared_episodes"]);
  const claims = list(raw["typed_claims"], "typed_claims");
  return {
    kind,
    claims: claims.map((claim, i) => toClaim(claim, `typed_claims[${i}]`, sources)),
  };
}
