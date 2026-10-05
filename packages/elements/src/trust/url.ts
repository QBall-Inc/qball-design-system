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
