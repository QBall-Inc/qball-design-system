// External-source URL policy (plan AD-4) shared by every trust atom: a source
// becomes a navigable link only for an absolute http(s) URL. Anything else —
// `javascript:`, `data:`, `vbscript:`, protocol-relative `//…`, relative or
// malformed — renders as inert text with no href.

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

/** Rel applied to every external source link. */
export const EXTERNAL_LINK_REL = "noopener noreferrer";

/** The parsed URL when it is an absolute http(s) URL, otherwise `null`. */
export function safeExternalUrl(raw: string): URL | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  return ALLOWED_PROTOCOLS.has(url.protocol) ? url : null;
}

// Internal-link policy (plan AD-4, the second policy) for consumer-supplied
// links into its own site — the answer's explorer link and notice actions. A
// link is navigable only when it is a same-origin root-relative path (`/…`),
// or an absolute http(s) URL whose origin the consumer allow-listed.
// Protocol-relative (`//…`), backslash tricks, `javascript:`, `data:`,
// `vbscript:` and relative paths all render as inert text.

const PROBE_ORIGIN = "https://internal.invalid";

/**
 * The href to use for an internal link, or `null` when it must stay inert.
 * `allowedOrigins` are exact origins such as `https://example.com`.
 */
export function safeInternalUrl(
  raw: string,
  allowedOrigins: readonly string[] = [],
): string | null {
  if (raw.startsWith("/") && !raw.startsWith("//") && !raw.includes("\\")) {
    let url: URL;
    try {
      url = new URL(raw, PROBE_ORIGIN);
    } catch {
      return null;
    }
    // Normalisation must not have moved the path to another origin.
    return url.origin === PROBE_ORIGIN ? `${url.pathname}${url.search}${url.hash}` : null;
  }
  const url = safeExternalUrl(raw);
  if (url === null) return null;
  return allowedOrigins.includes(url.origin) ? url.href : null;
}

// New-tab switch (WP-QB-3.8): off by default; when a consumer turns it on,
// every link it covers opens in a new tab with the opener cut. The DS ships no
// wording: the consumer may pass `newTabLabel`, read out (visually hidden) at
// the end of each such link.

/** A resolved new-tab setting: the consumer's spoken suffix, or null for none. */
export interface NewTab {
  readonly label: string | null;
}

/**
 * The `openLinksInNewTab` / `newTabLabel` pair as a NewTab, or null when the
 * switch is off (the default). Throws on a non-boolean switch or a label that
 * is not a non-empty string. A label without the switch has no effect.
 */
export function resolveNewTab(open: unknown, label: unknown): NewTab | null {
  if (open !== undefined && typeof open !== "boolean") {
    throw new TypeError("openLinksInNewTab must be a boolean.");
  }
  if (label !== undefined && (typeof label !== "string" || label.trim().length === 0)) {
    throw new TypeError("newTabLabel must be a non-empty string.");
  }
  return open === true ? { label: label ?? null } : null;
}

/** Makes `link` open in a new tab (`rel="noopener noreferrer"`), appending the spoken label if any. */
export function openInNewTab(link: HTMLAnchorElement, newTab: NewTab): void {
  link.setAttribute("target", "_blank");
  link.setAttribute("rel", EXTERNAL_LINK_REL);
  if (newTab.label !== null) {
    const hidden = link.ownerDocument.createElement("span");
    hidden.className = "qnewtab";
    hidden.textContent = ` ${newTab.label}`;
    link.append(hidden);
  }
}
