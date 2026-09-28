// Boundary validator for the skeleton bundle. Fails fast on the first problem
// with a message naming the offending path, id or field, so a bad bundle is
// caught where it enters instead of surfacing as a broken canvas later.
import type { SkeletonBundle } from "./types";

/** Thrown when a skeleton bundle is malformed; `path` locates the problem. */
export class BundleValidationError extends Error {
  readonly path: string;

  constructor(path: string, problem: string) {
    super(`Invalid SkeletonBundle at ${path}: ${problem}`);
    this.name = "BundleValidationError";
    this.path = path;
  }
}

type Json = Record<string, unknown>;

const STAT_NUMBERS = [
  "entities",
  "claims_total",
  "claims_valid",
  "claims_superseded",
  "episodes",
] as const;

const STAT_DATES = ["earliest_claim_date", "latest_claim_date", "snapshot_date"] as const;

function describe(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function object(value: unknown, path: string): Json {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new BundleValidationError(path, `expected an object, got ${describe(value)}`);
  }
  return value as Json;
}

function array(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new BundleValidationError(path, `expected an array, got ${describe(value)}`);
  }
  return value;
}

function number(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new BundleValidationError(path, `expected a finite number, got ${describe(value)}`);
  }
  return value;
}

function string(value: unknown, path: string): string {
  if (typeof value !== "string") {
    throw new BundleValidationError(path, `expected a string, got ${describe(value)}`);
  }
  return value;
}

function strings(value: unknown, path: string): void {
  array(value, path).forEach((item, i) => string(item, `${path}[${i}]`));
}

function nodeRef(value: unknown, path: string, ids: ReadonlySet<number>): void {
  const id = number(value, path);
  if (!ids.has(id)) {
    throw new BundleValidationError(path, `references node id ${id}, which is not in nodes`);
  }
}

function validateStats(value: unknown): void {
  const stats = object(value, "stats");
  for (const field of STAT_NUMBERS) number(stats[field], `stats.${field}`);
  for (const field of STAT_DATES) string(stats[field], `stats.${field}`);
}

function validateNodes(value: unknown): Set<number> {
  const firstSeen = new Map<number, number>();
  array(value, "nodes").forEach((item, i) => {
    const path = `nodes[${i}]`;
    const node = object(item, path);
    const id = number(node["id"], `${path}.id`);
    const previous = firstSeen.get(id);
    if (previous !== undefined) {
      throw new BundleValidationError(
        `${path}.id`,
        `duplicate id ${id} (first seen at nodes[${previous}])`,
      );
    }
    firstSeen.set(id, i);
    string(node["name"], `${path}.name`);
    string(node["cls"], `${path}.cls`);
    number(node["eps"], `${path}.eps`);
    strings(node["aliases"], `${path}.aliases`);
    if (node["facets"] !== undefined) {
      const facets = object(node["facets"], `${path}.facets`);
      strings(facets["domains"], `${path}.facets.domains`);
      strings(facets["sub_domains"], `${path}.facets.sub_domains`);
    }
  });
  return new Set(firstSeen.keys());
}

function validateTypedEdges(value: unknown, ids: ReadonlySet<number>): void {
  array(value, "typed_edges").forEach((item, i) => {
    const path = `typed_edges[${i}]`;
    const edge = object(item, path);
    nodeRef(edge["a"], `${path}.a`, ids);
    nodeRef(edge["b"], `${path}.b`, ids);
    number(edge["n"], `${path}.n`);
    strings(edge["rels"], `${path}.rels`);
  });
}

function validateComentionEdges(value: unknown, ids: ReadonlySet<number>): void {
  array(value, "comention_edges").forEach((item, i) => {
    const path = `comention_edges[${i}]`;
    const edge = object(item, path);
    nodeRef(edge["a"], `${path}.a`, ids);
    nodeRef(edge["b"], `${path}.b`, ids);
    number(edge["w"], `${path}.w`);
  });
}

function validateLayout(value: unknown): void {
  if (value === null) return;
  const layout = object(value, "layout");
  for (const [key, position] of Object.entries(layout)) {
    const coords = array(position, `layout["${key}"]`);
    if (coords.length !== 3) {
      throw new BundleValidationError(
        `layout["${key}"]`,
        `expected [x, y, z], got ${coords.length} values`,
      );
    }
    coords.forEach((c, i) => number(c, `layout["${key}"][${i}]`));
  }
}

/**
 * Asserts `bundle` is a well-formed SkeletonBundle: every stats field present
 * and typed, unique node ids, every edge endpoint present in `nodes`, and a
 * layout that is `null` or `[x, y, z]` per node. Throws BundleValidationError.
 */
export function validateSkeletonBundle(bundle: unknown): asserts bundle is SkeletonBundle {
  const root = object(bundle, "(root)");
  string(root["revision"], "revision");
  validateStats(root["stats"]);
  const ids = validateNodes(root["nodes"]);
  validateTypedEdges(root["typed_edges"], ids);
  validateComentionEdges(root["comention_edges"], ids);
  if (!("layout" in root)) {
    throw new BundleValidationError(
      "layout",
      "missing (use null when there is no precomputed layout)",
    );
  }
  validateLayout(root["layout"]);
}
