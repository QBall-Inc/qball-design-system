// Source badges: the short mark on a SourceRow and the label on a ClaimCard's
// source link. The DS knows only platforms (keyed by `source_type`); which
// companies get a badge is the consumer's call, supplied by domain because a
// company's posts arrive as ordinary web sources. A source that matches
// neither gets no badge — never a generic placeholder.

import type { SourceRef } from "../types";
import { safeExternalUrl } from "./url";

export interface SourceBadge {
  /** Short mark shown on a SourceRow, at most 4 characters (e.g. `GH`). */
  mark: string;
  /** Name shown on a ClaimCard's source link (e.g. `GitHub`). */
  label: string;
}

export interface SourceBadgeOptions {
  /**
   * Consumer badges keyed by bare hostname (`example.com`, `ai.example.com`;
   * case and a leading `www.` are ignored). A key matches its host and every
   * subdomain at a label boundary — never `notexample.com` — and the longest
   * matching key wins. Checked before the built-in platform badges. Throws
   * RangeError on a key with a scheme, path or port, a mark outside 1-4
   * characters, or an empty label.
   */
  domains?: Readonly<Record<string, SourceBadge>>;
}

const MAX_MARK_LENGTH = 4;

/**
 * Built-in platform badges, keyed by lowercase `source_type`. A Map, so a
 * `source_type` such as `constructor` can never hit an Object prototype key.
 */
const PLATFORM_BADGES: ReadonlyMap<string, SourceBadge> = new Map([
  ["github", { mark: "GH", label: "GitHub" }],
  ["youtube", { mark: "YT", label: "YouTube" }],
  ["substack", { mark: "SB", label: "Substack" }],
  ["medium", { mark: "MD", label: "Medium" }],
  ["linkedin", { mark: "LI", label: "LinkedIn" }],
  ["reddit", { mark: "RD", label: "Reddit" }],
  ["arxiv", { mark: "AX", label: "arXiv" }],
  ["x", { mark: "X", label: "X" }],
  ["huggingface", { mark: "HF", label: "Hugging Face" }],
]);

function stripWww(host: string): string {
  return host.startsWith("www.") ? host.slice(4) : host;
}

// A bare hostname: lowercase labels joined by dots, at least two labels.
const DOMAIN_KEY = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/;

function checkedKey(rawKey: string): string {
  const key = stripWww(rawKey.trim().toLowerCase());
  if (!DOMAIN_KEY.test(key)) {
    throw new RangeError(
      `sourceBadges.domains key "${rawKey}" must be a bare hostname such as "example.com" (no scheme, path or port).`,
    );
  }
  return key;
}

function checkedBadge(rawKey: string, badge: SourceBadge): SourceBadge {
  const mark = badge.mark.trim();
  const label = badge.label.trim();
  if (mark.length === 0 || mark.length > MAX_MARK_LENGTH) {
    throw new RangeError(
      `sourceBadges.domains["${rawKey}"].mark must be 1-${String(MAX_MARK_LENGTH)} characters (got "${badge.mark}").`,
    );
  }
  if (label.length === 0) {
    throw new RangeError(`sourceBadges.domains["${rawKey}"].label must not be empty.`);
  }
  return { mark, label };
}

/**
 * Every entry is validated on every call — a malformed entry fails even when
 * it would not have matched — then the longest key that equals the host or
 * ends at a label boundary (`.` + key) wins.
 */
function domainBadge(
  host: string | null,
  domains: Readonly<Record<string, SourceBadge>>,
): SourceBadge | null {
  let best: { key: string; badge: SourceBadge } | null = null;
  for (const [rawKey, rawBadge] of Object.entries(domains)) {
    const key = checkedKey(rawKey);
    const badge = checkedBadge(rawKey, rawBadge);
    const matches = host !== null && (host === key || host.endsWith(`.${key}`));
    if (matches && (best === null || key.length > best.key.length)) best = { key, badge };
  }
  return best === null ? null : best.badge;
}

/** The source's host without `www.`, or `null` when its URL is not http(s). */
export function sourceHost(source: SourceRef): string | null {
  const url = safeExternalUrl(source.url);
  return url === null ? null : stripWww(url.hostname.toLowerCase());
}

/**
 * The badge for `source`: a consumer domain badge, else a built-in platform
 * badge for its `source_type`, else `null` (render no badge).
 */
export function resolveSourceBadge(
  source: SourceRef,
  options: SourceBadgeOptions = {},
): SourceBadge | null {
  const host = sourceHost(source);
  if (options.domains !== undefined) {
    const badge = domainBadge(host, options.domains);
    if (badge !== null) return badge;
  }
  return PLATFORM_BADGES.get(source.source_type.trim().toLowerCase()) ?? null;
}
