// FacetFilterBar: the explorer's facet chips. Domain-grouped, squared chips
// built only from the caller's taxonomy (domain display labels are a prop),
// each a toggle with aria-pressed; active chips OR together. While any chip is
// active it shows the match count and a clear-all button. When the facet data
// is incomplete (entities whose sub-topic cannot be placed in one domain), the
// affected chips carry a mark and the count says how many may be missing.
// A renderer: it owns no canvas. The caller applies `onChange`'s predicate
// (e.g. to GraphCanvas.setFilter) and owns any collapse toggle around it.

import type { BundleNode } from "../types";
import { el } from "../trust/dom";
import { buildFacetModel, type FacetChip, type FacetModel, type FacetTaxonomy } from "./facets";
import { DEFAULT_FACET_BAR_LABELS, resolveLabels, type FacetBarLabels } from "./panel-copy";

/** What changed: the active chips, their match count and the filter to apply. */
export interface FacetFilterChange {
  /** Active chips in taxonomy order. */
  active: FacetChip[];
  /** Entities matching any active chip (0 when none are active). */
  matches: number;
  /** Keeps the matching nodes; null when no chip is active (no filter). */
  predicate: ((node: BundleNode) => boolean) | null;
}

export interface FacetFilterBarOptions {
  /** The bundle's nodes (their `facets` drive the chips' matches). */
  nodes: readonly BundleNode[];
  /** Domains → sub-domains, in display order. */
  taxonomy: FacetTaxonomy;
  /** Display label per domain id; a domain without one shows its id. */
  domainLabels?: Readonly<Record<string, string>>;
  /** Overrides for any default string. */
  labels?: Partial<FacetBarLabels>;
  /** Called after every chip toggle or clear. */
  onChange?: (change: FacetFilterChange) => void;
}

export interface FacetFilterBarHandle {
  /** Active chips in taxonomy order. */
  readonly active: readonly FacetChip[];
  /** Number of active chips (for a "N active" toggle). */
  readonly activeCount: number;
  /** Deactivates every chip (calls onChange when any was active). */
  clear(): void;
  /** Rebuilds the chips for a new bundle (and taxonomy); every chip starts inactive, without calling onChange. */
  setData(nodes: readonly BundleNode[], taxonomy?: FacetTaxonomy): void;
  /** Removes the bar and its listeners. */
  destroy(): void;
}

function requireDomainLabels(value: unknown): Readonly<Record<string, string>> {
  if (value === undefined) return {};
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError("domainLabels must be an object of strings.");
  }
  for (const [domain, label] of Object.entries(value)) {
    if (typeof label !== "string") throw new TypeError(`domainLabels.${domain} must be a string.`);
  }
  return value as Readonly<Record<string, string>>;
}

/** Mounts the bar into `host` (its previous content is replaced). */
export function mount(host: HTMLElement, options: FacetFilterBarOptions): FacetFilterBarHandle {
  if (!(host instanceof HTMLElement))
    throw new TypeError("FacetFilterBar.mount needs a host element.");
  if (!Array.isArray(options.nodes)) throw new TypeError("nodes must be an array of bundle nodes.");
  if (options.onChange !== undefined && typeof options.onChange !== "function") {
    throw new TypeError("onChange must be a function.");
  }
  const labels = resolveLabels(DEFAULT_FACET_BAR_LABELS, options.labels);
  const domainLabels = requireDomainLabels(options.domainLabels);
  const onChange = options.onChange;

  let model: FacetModel = buildFacetModel(options.nodes, options.taxonomy);
  let taxonomy = options.taxonomy;
  let chips: { chip: FacetChip; button: HTMLButtonElement }[] = [];
  let active = new Set<HTMLButtonElement>();

  const bar = el("div", "facetbar");
  bar.setAttribute("role", "group");
  bar.setAttribute("aria-label", labels.group);
  const count = el("span", "facetbar__count");
  count.setAttribute("role", "status");
  const clearButton = el("button", "facetbar__clear", labels.clear);
  clearButton.type = "button";

  function activeChips(): FacetChip[] {
    return chips.filter(({ button }) => active.has(button)).map(({ chip }) => chip);
  }

  function render(): void {
    chips = [];
    active = new Set();
    bar.replaceChildren();
    let at = 0;
    for (const [domain, subs] of Object.entries(taxonomy.domains)) {
      const group = el("div", "facetbar__group");
      const label = Object.hasOwn(domainLabels, domain) ? domainLabels[domain]! : domain;
      group.append(el("span", "facetbar__dom", label));
      for (const sub of subs) {
        const counts = model.chips[at++]!;
        const button = el("button", "fchip", sub);
        button.type = "button";
        button.setAttribute("aria-pressed", "false");
        if (counts.unattributable > 0) {
          button.classList.add("is-incomplete");
          button.setAttribute("aria-label", labels.incompleteChip(sub, counts.unattributable));
          const mark = el("span", "fchip__inc", labels.incompleteMark);
          mark.setAttribute("aria-hidden", "true");
          button.append(mark);
        }
        chips.push({ chip: { domain, sub_domain: sub }, button });
        group.append(button);
      }
      bar.append(group);
    }
    bar.append(count, clearButton);
    sync();
  }

  function sync(): FacetFilterChange {
    const on = activeChips();
    for (const { button } of chips) button.setAttribute("aria-pressed", String(active.has(button)));
    const any = on.length > 0;
    count.hidden = !any;
    clearButton.hidden = !any;
    if (!any) {
      count.textContent = "";
      return { active: on, matches: 0, predicate: null };
    }
    const ids = model.activeFacets(on);
    // Entities the active chips may miss: unassignable for one of them and not
    // already matched by another.
    let unassignable = 0;
    if (!model.facetsComplete) {
      for (const id of model.unattributableFor(on)) if (!ids.has(id)) unassignable += 1;
    }
    count.textContent =
      unassignable > 0
        ? labels.matchesIncomplete(ids.size, unassignable)
        : labels.matches(ids.size);
    return { active: on, matches: ids.size, predicate: (node) => ids.has(node.id) };
  }

  function changed(): void {
    const change = sync();
    onChange?.(change);
  }

  function onClick(event: MouseEvent): void {
    const target = event.target instanceof Element ? event.target.closest("button") : null;
    if (target === null) return;
    if (target === clearButton) {
      active.clear();
      changed();
      return;
    }
    if (!chips.some(({ button }) => button === target)) return;
    if (active.has(target)) active.delete(target);
    else active.add(target);
    changed();
  }

  render();
  bar.addEventListener("click", onClick);
  host.replaceChildren(bar);

  return {
    get active() {
      return activeChips();
    },
    get activeCount() {
      return active.size;
    },
    clear() {
      if (active.size === 0) return;
      active.clear();
      changed();
    },
    setData(nodes, nextTaxonomy) {
      if (!Array.isArray(nodes)) throw new TypeError("nodes must be an array of bundle nodes.");
      const next = nextTaxonomy ?? taxonomy;
      model = buildFacetModel(nodes, next);
      taxonomy = next;
      render();
    },
    destroy() {
      bar.removeEventListener("click", onClick);
      bar.remove();
    },
  };
}
