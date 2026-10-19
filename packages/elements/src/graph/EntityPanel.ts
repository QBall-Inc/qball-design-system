// EntityPanel: the explorer's reading surface. Props-driven: the caller passes
// the click path and the selection's neighbours, and supplies the detail for a
// hop through a callback (the panel never fetches). It renders the breadcrumb
// trail, the entity header, the hop (the claims the graph asserts, or the
// co-mention note), the connection rows, the reading list and the pinned
// panel footer. Crumb, row and "show more" clicks are reported back; the
// caller owns the click path. Every data string lands via textContent.

import { isSuperseded, resolveReplacement } from "../claims";
import { defaultWarn } from "../dev-warn";
import { renderClaimCard } from "../trust/ClaimCard";
import { el } from "../trust/dom";
import { renderProvenanceFooter } from "../trust/ProvenanceFooter";
import { renderReadingList } from "../trust/SourceRow";
import type { SourceBadgeOptions } from "../trust/source-badge";
import type { BundleNode, BundleStats, Claim, ClaimSource, ConnectionDetail } from "../types";
import type { GraphNeighbor } from "./canvas";
import { classLabel } from "./canvas-copy";
import { DEFAULT_PANEL_LABELS, resolveLabels, type PanelLabels } from "./panel-copy";

/** The hop the panel needs detail for: the last two entities of the path. */
export interface HopRequest {
  from: BundleNode;
  to: BundleNode;
  /** Aborted when the hop is no longer shown (a newer selection, or destroy). */
  signal: AbortSignal;
}

/** What to show: the click path (oldest first) and the selection's neighbours. */
export interface EntityPanelView {
  path: readonly BundleNode[];
  /** The budgeted neighbour list shown, strongest first (e.g. GraphSelectDetail.neighbors). */
  neighbors?: readonly GraphNeighbor[];
  /** All neighbours of the selection (defaults to the list's length). */
  total?: number;
}

export interface EntityPanelOptions {
  /** The bundle's stats: idle meta line and the footer's revision date. */
  stats: BundleStats;
  /** Detail for a hop. Rejections show an error state with a retry. */
  detail: (hop: HopRequest) => Promise<ConnectionDetail>;
  /** Overrides for any default string. */
  labels?: Partial<PanelLabels>;
  /** Consumer domain badges for claim cards and the reading list. */
  sourceBadges?: SourceBadgeOptions;
  /** A breadcrumb before the current one was activated: `index` into the path. */
  onCrumb?: (index: number, node: BundleNode) => void;
  /** A connection row was activated. */
  onSelect?: (node: BundleNode) => void;
  /** The "show more" row was activated. */
  onShowMore?: () => void;
  /** Receives development warnings, e.g. why a hop's detail could not be shown (default: console.warn outside production). */
  onWarn?: (message: string) => void;
  /**
   * One control of your own (e.g. a "hide" button) shown at the right of the
   * header's top row, beside the click path or the idle title. The panel
   * re-appends this same element on every redraw and keeps its focus.
   */
  headAction?: HTMLElement;
}

export interface EntityPanelHandle {
  /** Shows a path (an empty path is the idle state). Requests the hop's detail when the hop changed. */
  show(view: EntityPanelView): void;
  /** Replaces only the connection rows (after "show more"). */
  setNeighbors(neighbors: readonly GraphNeighbor[], total?: number): void;
  /** The idle state. */
  idle(): void;
  /** New bundle stats (a revision swap); re-renders the current view. */
  setStats(stats: BundleStats): void;
  /** Removes the panel; a pending detail response is discarded. */
  destroy(): void;
}

type HopState =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "typed"; claims: Claim[] }
  | { kind: "comention"; sources: ClaimSource[] };

interface Hop {
  key: string;
  from: BundleNode;
  to: BundleNode;
  state: HopState;
  controller: AbortController;
}

function requireFunction(name: string, value: unknown, optional: boolean): void {
  if (value === undefined && optional) return;
  if (typeof value !== "function") throw new TypeError(`${name} must be a function.`);
}

/** A resolved detail as a hop state; throws on a malformed value. */
function hopStateOf(detail: unknown): HopState {
  const value = detail as Partial<ConnectionDetail> | null;
  if (value?.kind === "typed" && Array.isArray(value.claims) && value.claims.length > 0) {
    return { kind: "typed", claims: value.claims };
  }
  if (value?.kind === "comention" && Array.isArray(value.shared_sources)) {
    return { kind: "comention", sources: value.shared_sources };
  }
  throw new TypeError(
    'detail must resolve to { kind: "typed", claims: [≥1] } or { kind: "comention", shared_sources: [] }.',
  );
}

/** Mounts the panel into `host` (its previous content is replaced), in the idle state. */
export function mount(host: HTMLElement, options: EntityPanelOptions): EntityPanelHandle {
  if (!(host instanceof HTMLElement))
    throw new TypeError("EntityPanel.mount needs a host element.");
  requireFunction("detail", options.detail, false);
  requireFunction("onCrumb", options.onCrumb, true);
  requireFunction("onSelect", options.onSelect, true);
  requireFunction("onShowMore", options.onShowMore, true);
  requireFunction("onWarn", options.onWarn, true);
  const headAction = options.headAction;
  if (headAction !== undefined && !(headAction instanceof HTMLElement)) {
    throw new TypeError("headAction must be an HTMLElement.");
  }
  const warn = options.onWarn ?? defaultWarn;
  const labels = resolveLabels(DEFAULT_PANEL_LABELS, options.labels);
  const badges = options.sourceBadges === undefined ? {} : { sourceBadges: options.sourceBadges };

  let stats = options.stats;
  let path: readonly BundleNode[] = [];
  let neighbors: readonly GraphNeighbor[] = [];
  let total = 0;
  let hop: Hop | null = null;
  let destroyed = false;
  const rowNodes = new WeakMap<Element, BundleNode>();

  const root = el("aside", "epanel");
  // Focus falls back to the panel itself when a redraw removes the focused control.
  root.tabIndex = -1;
  const head = el("header", "epanel__head");
  const scroll = el("div", "epanel__scroll");
  const foot = el("div", "epanel__foot");
  root.append(head, scroll, foot);

  /** The header's first element, sharing a row with the consumer's action when there is one. */
  function topRow(first: HTMLElement | null): void {
    if (headAction === undefined) {
      if (first !== null) head.append(first);
      return;
    }
    const row = el("div", "epanel__top");
    if (first !== null) row.append(first);
    headAction.classList.add("epanel__action");
    row.append(headAction);
    head.append(row);
  }

  function renderHead(): void {
    head.replaceChildren();
    const current = path.at(-1);
    if (current === undefined) {
      topRow(labels.idleTitle === "" ? null : el("h3", "epanel__name", labels.idleTitle));
      head.append(el("div", "epanel__meta", labels.idleMeta(stats.episodes)));
      return;
    }
    const crumbs = el("nav", "epanel__crumbs");
    crumbs.setAttribute("aria-label", labels.crumbs);
    path.forEach((node, index) => {
      if (index > 0) {
        const sep = el("span", undefined, "›");
        sep.setAttribute("aria-hidden", "true");
        crumbs.append(sep);
      }
      const crumb = el("button", undefined, node.name);
      crumb.type = "button";
      crumb.dataset["crumb"] = String(index);
      if (index === path.length - 1) crumb.setAttribute("aria-current", "true");
      crumbs.append(crumb);
    });
    const name = el("h3", "epanel__name", current.name);
    name.append(" ", el("span", "epanel__cls", classLabel(labels, current.cls)));
    const alias = current.aliases[0];
    const meta = el(
      "div",
      "epanel__meta",
      labels.episodes(current.eps) + (alias === undefined ? "" : ` · ${labels.aka(alias)}`),
    );
    topRow(crumbs);
    head.append(name, meta);
    const tags = [...(current.facets?.domains ?? []), ...(current.facets?.sub_domains ?? [])];
    if (tags.length > 0) {
      const box = el("div", "epanel__tags");
      tags.slice(0, 5).forEach((tag, index) => {
        box.append(el("span", index === 0 ? "badge badge--signal" : "badge", tag));
      });
      head.append(box);
    }
  }

  function renderHop(current: Hop): { section: HTMLElement; sources: ClaimSource[] } {
    const section = el("section", "epanel__hop");
    const state = current.state;
    if (state.kind === "typed") {
      section.append(
        el("h4", "epanel__hlabel", labels.hopAsserts(current.from.name, current.to.name)),
      );
      for (const claim of state.claims) {
        section.append(
          renderClaimCard(claim, {
            ...badges,
            replacement: resolveReplacement(claim, state.claims),
          }),
        );
      }
      return { section, sources: state.claims.map((claim) => claim.source) };
    }
    section.append(
      el("h4", "epanel__hlabel", labels.hopComention(current.from.name, current.to.name)),
    );
    if (state.kind === "comention") {
      section.append(el("p", "epanel__comnote", labels.comentionNote(state.sources.length)));
      return { section, sources: state.sources };
    }
    if (state.kind === "loading") {
      const note = el("p", "epanel__empty", labels.hopLoading);
      note.setAttribute("role", "status");
      section.append(note);
    } else {
      const note = el("p", "epanel__empty", labels.hopError);
      note.setAttribute("role", "alert");
      const retry = el("button", "btn btn--ghost epanel__retry", labels.retry);
      retry.type = "button";
      section.append(note, retry);
    }
    return { section, sources: [] };
  }

  function renderRows(container: HTMLElement): void {
    container.replaceChildren();
    for (const neighbor of neighbors) {
      const row = el("button", "nrow");
      row.type = "button";
      row.append(
        el("span", "nrow__name", neighbor.node.name),
        neighbor.typed
          ? el("span", "nrow__kind nrow__kind--typed", labels.rowClaims(neighbor.weight))
          : el("span", "nrow__kind nrow__kind--com", labels.rowComention(neighbor.weight)),
      );
      rowNodes.set(row, neighbor.node);
      container.append(row);
    }
    if (total > neighbors.length) {
      const more = el("button", "nrow nrow--more");
      more.type = "button";
      more.append(
        el("span", "nrow__name nrow__kind--typed", labels.showMore),
        el("span", "nrow__kind nrow__kind--com", labels.remaining(total - neighbors.length)),
      );
      container.append(more);
    }
  }

  function renderConnections(): HTMLElement | null {
    if (neighbors.length === 0) return null;
    const section = el("section", "epanel__hop epanel__conns");
    const rows = el("div", "epanel__rows");
    renderRows(rows);
    section.append(el("h4", "epanel__hlabel", labels.connections(neighbors.length, total)), rows);
    return section;
  }

  /** Which control has focus inside the panel, so a redraw can put it back. */
  function focusKey(): string | null {
    const active = document.activeElement;
    if (!(active instanceof HTMLElement) || !root.contains(active)) return null;
    if (headAction?.contains(active) === true) return "action";
    if (active.dataset["crumb"] !== undefined) return "crumb";
    if (active.classList.contains("nrow--more")) return "more";
    if (active.classList.contains("epanel__retry")) return "retry";
    const node = rowNodes.get(active);
    return node === undefined ? "panel" : `row:${String(node.id)}`;
  }

  /**
   * Refocuses the same control after a redraw. When it is gone (a row that
   * selected its entity, say), focus goes to the current crumb, else the panel.
   */
  function restoreFocus(key: string | null): void {
    if (key === null) return;
    const rows = [...scroll.querySelectorAll<HTMLElement>(".epanel__rows .nrow")];
    let target: HTMLElement | null | undefined = null;
    if (key === "action") {
      target = headAction;
    } else if (key.startsWith("row:")) {
      target = rows.find((row) => {
        const node = rowNodes.get(row);
        return node !== undefined && `row:${String(node.id)}` === key;
      });
    } else if (key === "more") {
      target = scroll.querySelector<HTMLElement>(".nrow--more") ?? rows.at(-1);
    } else if (key === "retry") {
      target = scroll.querySelector<HTMLElement>(".epanel__retry");
    }
    target ??= head.querySelector<HTMLElement>('[aria-current="true"]') ?? root;
    if (document.activeElement !== target) target.focus();
  }

  function render(): void {
    const key = focusKey();
    paint();
    restoreFocus(key);
  }

  function paint(): void {
    renderHead();
    scroll.replaceChildren();
    let claims: Claim[] = [];
    let sources: ClaimSource[] = [];
    if (path.length === 0) {
      scroll.append(el("p", "epanel__empty", labels.idleBody));
    } else {
      if (hop !== null) {
        const part = renderHop(hop);
        scroll.append(part.section);
        sources = part.sources;
        if (hop.state.kind === "typed") claims = hop.state.claims;
      }
      const connections = renderConnections();
      if (connections !== null) scroll.append(connections);
      if (hop === null && connections === null) {
        scroll.append(el("p", "epanel__empty", labels.pickHop));
      }
    }
    let sourceCount = 0;
    if (sources.length > 0) {
      const list = renderReadingList(sources, badges);
      sourceCount = list.childElementCount;
      const section = el("section");
      section.append(el("h4", "epanel__hlabel", labels.readingList), list);
      scroll.append(section);
    }
    foot.replaceChildren(
      renderProvenanceFooter("panel", {
        claims: claims.length,
        sources: sourceCount,
        revisionDate: stats.snapshot_date,
        supersededShown: claims.filter(isSuperseded).length,
      }),
    );
  }

  function request(current: Hop): void {
    current.state = { kind: "loading" };
    const { signal } = current.controller;
    let pending: Promise<ConnectionDetail>;
    try {
      pending = Promise.resolve(options.detail({ from: current.from, to: current.to, signal }));
    } catch (error) {
      pending = Promise.reject(error instanceof Error ? error : new Error(String(error)));
    }
    // Never rejects: the catch below turns every failure into the error state.
    void pending
      .then((detail) => {
        const state = hopStateOf(detail);
        // Draw the hop once off-screen, so a malformed claim or source fails
        // here (into the error state) instead of half-drawing the panel.
        renderReadingList(renderHop({ ...current, state }).sources, badges);
        return state;
      })
      .catch((error: unknown): HopState => {
        if (!destroyed && !signal.aborted) {
          const reason = error instanceof Error ? error.message : String(error);
          warn(
            `EntityPanel: the detail for "${current.from.name}" → "${current.to.name}" could not be shown (${reason}). The panel shows its error state with a retry.`,
          );
        }
        return { kind: "error" };
      })
      .then((state) => {
        // A response for a hop that is no longer shown is discarded.
        if (destroyed || hop !== current || signal.aborted) return;
        current.state = state;
        render();
      });
  }

  function retire(): void {
    hop?.controller.abort();
    hop = null;
  }

  function onClick(event: MouseEvent): void {
    const button = event.target instanceof Element ? event.target.closest("button") : null;
    if (button === null || !root.contains(button) || headAction?.contains(button) === true) return;
    const crumb = button.dataset["crumb"];
    if (crumb !== undefined) {
      const index = Number(crumb);
      if (index < path.length - 1) options.onCrumb?.(index, path[index]!);
      return;
    }
    if (button.classList.contains("nrow--more")) {
      options.onShowMore?.();
      return;
    }
    if (button.classList.contains("epanel__retry")) {
      if (hop !== null) {
        request(hop);
        render();
      }
      return;
    }
    const node = rowNodes.get(button);
    if (node !== undefined) options.onSelect?.(node);
  }

  function setNeighborList(
    next: readonly GraphNeighbor[] | undefined,
    nextTotal: number | undefined,
  ): void {
    if (next !== undefined && !Array.isArray(next))
      throw new TypeError("neighbors must be an array.");
    neighbors = next ?? [];
    total = Math.max(nextTotal ?? neighbors.length, neighbors.length);
  }

  root.addEventListener("click", onClick);
  host.replaceChildren(root);
  render();

  return {
    show(view) {
      if (destroyed) return;
      const nextPath: unknown = view.path;
      if (!Array.isArray(nextPath)) {
        throw new TypeError("view.path must be an array of bundle nodes.");
      }
      setNeighborList(view.neighbors, view.total);
      const previous = path.at(-1);
      path = [...(nextPath as readonly BundleNode[])];
      const from = path.at(-2);
      const to = path.at(-1);
      if (from === undefined || to === undefined) {
        retire();
      } else {
        const key = `${String(from.id)}>${String(to.id)}`;
        if (hop?.key !== key) {
          retire();
          hop = { key, from, to, state: { kind: "loading" }, controller: new AbortController() };
          request(hop);
        }
      }
      render();
      // A new selection starts at the top of the body.
      if (path.at(-1)?.id !== previous?.id) scroll.scrollTop = 0;
    },
    setNeighbors(next, nextTotal) {
      if (destroyed) return;
      setNeighborList(next, nextTotal);
      const rows = scroll.querySelector<HTMLElement>(".epanel__rows");
      const heading = scroll.querySelector(".epanel__conns .epanel__hlabel");
      if (rows === null || heading === null || neighbors.length === 0) {
        render();
        return;
      }
      heading.textContent = labels.connections(neighbors.length, total);
      const key = focusKey();
      renderRows(rows);
      restoreFocus(key);
    },
    idle() {
      if (destroyed) return;
      path = [];
      setNeighborList([], 0);
      retire();
      render();
    },
    setStats(next) {
      if (destroyed) return;
      stats = next;
      render();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      retire();
      root.removeEventListener("click", onClick);
      root.remove();
    },
  };
}
