// SourceRow: the reading-list unit — badge, title, save date, ↗. ReadingList
// stacks rows, one per episode. URL policy (plan AD-4): only an http(s) URL
// makes the row a link; otherwise the row is inert text and drops the ↗, so
// it never advertises a link it does not have.

import { isSourceUnavailable, type ClaimSource, type SourceRef } from "../types";
import { el } from "./dom";
import { resolveSourceBadge, type SourceBadgeOptions } from "./source-badge";
import { EXTERNAL_LINK_REL, safeExternalUrl } from "./url";

export interface SourceRowOptions {
  /** Consumer domain badges (see SourceBadgeOptions). */
  sourceBadges?: SourceBadgeOptions;
}

/** Text shown for a source whose record could not be resolved. */
export const SOURCE_UNAVAILABLE = "source unavailable";

function availableRow(source: SourceRef, options: SourceRowOptions): HTMLElement {
  const url = safeExternalUrl(source.url);
  let row: HTMLElement;
  if (url === null) {
    row = el("div", "srcrow");
  } else {
    const link = el("a", "srcrow");
    link.setAttribute("href", url.href);
    link.setAttribute("rel", EXTERNAL_LINK_REL);
    row = link;
  }
  const badge = resolveSourceBadge(source, options.sourceBadges);
  // The empty cell keeps the title in the row's title column when there is no badge.
  row.append(badge === null ? el("span") : el("span", "srcrow__mark", badge.mark));
  const title = el("span", "srcrow__title", source.title);
  title.setAttribute("title", source.title);
  row.append(title, el("span", "srcrow__date", `saved ${source.save_date}`));
  if (url !== null) row.append(el("span", "srcrow__out", "↗"));
  return row;
}

function unavailableRow(): HTMLElement {
  const row = el("div", "srcrow");
  row.append(el("span"), el("span", "srcrow__title", SOURCE_UNAVAILABLE));
  return row;
}

/** One source as a row. An unavailable source renders as an inert "source unavailable" row. */
export function renderSourceRow(source: ClaimSource, options: SourceRowOptions = {}): HTMLElement {
  return isSourceUnavailable(source) ? unavailableRow() : availableRow(source, options);
}

/**
 * A reading list: one row per `episode_id` (first occurrence wins, input order
 * kept). Unavailable sources without an episode id are never merged.
 */
export function renderReadingList(
  sources: readonly ClaimSource[],
  options: SourceRowOptions = {},
): HTMLElement {
  const list = el("div", "srclist");
  const seen = new Set<string>();
  for (const source of sources) {
    const id = source.episode_id;
    if (id !== null) {
      if (seen.has(id)) continue;
      seen.add(id);
    }
    list.append(renderSourceRow(source, options));
  }
  return list;
}
