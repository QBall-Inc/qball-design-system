// The canvas's DOM chrome: status line + hint, selection chip, hover tip,
// empty-filter note, legend and error figure. Built with DOM APIs only — every
// string (node names included) lands via textContent, never innerHTML — and
// styled entirely by @qball-inc/tokens/graph.css (`.graphcanvas .gc-*`).

import type { BundleNode } from "../../types";
import { classLabel, type CanvasLabels } from "../canvas-copy";
import { ROLE_TOKEN, classRole, CLASS_ROLE } from "../palette";

function el<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = doc.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(doc: Document, className: string, text: string): HTMLButtonElement {
  const b = el(doc, "button", className, text);
  b.type = "button";
  return b;
}

export interface Hud {
  readonly root: HTMLElement;
  setStatus(text: string): void;
}

/** Bottom HUD: live status line (role=status) and an optional interaction hint. */
export function renderHud(doc: Document, labels: CanvasLabels, hint: string | null): Hud {
  const root = el(doc, "div", "gc-hud");
  const status = el(doc, "span", "gc-status", labels.loading);
  status.setAttribute("role", "status");
  root.append(status);
  if (hint !== null) root.append(el(doc, "span", "gc-hint", hint));
  return {
    root,
    setStatus(text) {
      status.textContent = text;
    },
  };
}

export interface Chip {
  readonly root: HTMLElement;
  show(node: BundleNode, shown: number, total: number): void;
  hide(): void;
}

/**
 * Selection chip: `<name> <CLASS> · N episodes · showing X of Y neighbors
 * [show more] [×]`. "show more" appears only while neighbors remain.
 */
export function renderChip(
  doc: Document,
  labels: CanvasLabels,
  actions: { more(): void; clear(): void },
): Chip {
  const root = el(doc, "div", "gc-chip");
  root.hidden = true;
  const more = button(doc, "", labels.showMore);
  more.addEventListener("click", () => actions.more());
  const clear = button(doc, "", "×");
  clear.setAttribute("aria-label", labels.clearSelection);
  clear.addEventListener("click", () => actions.clear());
  return {
    root,
    show(node, shown, total) {
      const name = el(doc, "b", "", node.name);
      const cls = el(doc, "span", "gc-cls", classLabel(labels, node.cls));
      const text = doc.createTextNode(
        ` · ${labels.episodes(node.eps)} · ${labels.showing(Math.min(shown, total), total)}`,
      );
      root.replaceChildren(name, doc.createTextNode(" "), cls, text);
      if (total > shown) root.append(doc.createTextNode(" "), more);
      root.append(doc.createTextNode(" "), clear);
      root.hidden = false;
    },
    hide() {
      root.hidden = true;
      root.replaceChildren();
    },
  };
}

export interface HoverTip {
  readonly root: HTMLElement;
  show(node: BundleNode, x: number, y: number): void;
  hide(): void;
}

/** Cursor tooltip: entity name + class. */
export function renderHoverTip(doc: Document, labels: CanvasLabels): HoverTip {
  const root = el(doc, "div", "gc-hover");
  root.hidden = true;
  let current: BundleNode | null = null;
  return {
    root,
    show(node, x, y) {
      if (node !== current) {
        root.replaceChildren(
          doc.createTextNode(`${node.name} `),
          el(doc, "span", "gc-cls", classLabel(labels, node.cls)),
        );
        current = node;
      }
      root.style.left = `${x}px`;
      root.style.top = `${y}px`;
      root.hidden = false;
    },
    hide() {
      root.hidden = true;
    },
  };
}

/** Centered note shown while an active filter matches nothing. */
export function renderNote(doc: Document, labels: CanvasLabels): HTMLElement {
  const root = el(doc, "div", "gc-note", labels.emptyFilter);
  root.hidden = true;
  return root;
}

/**
 * Legend of the classes present in the bundle, known classes first in palette
 * order. Collapsed behind a toggle on narrow or coarse-pointer viewports.
 */
export function renderLegend(
  doc: Document,
  labels: CanvasLabels,
  nodes: readonly BundleNode[],
  collapsed: boolean,
): HTMLElement {
  const present = new Set(nodes.map((n) => n.cls));
  const known = Object.keys(CLASS_ROLE).filter((c) => present.has(c));
  const unknown = [...present].filter((c) => !Object.hasOwn(CLASS_ROLE, c));
  const legend = el(doc, "div", "gc-legend");
  for (const cls of [...known, ...unknown]) {
    const swatch = el(doc, "span", "gc-sw");
    swatch.style.background = `var(${ROLE_TOKEN[classRole(cls)]})`;
    const item = el(doc, "span", "gc-li");
    item.append(swatch, doc.createTextNode(classLabel(labels, cls)));
    legend.append(item);
  }
  const wrap = el(doc, "div", "gc-lgwrap");
  if (collapsed) {
    const toggle = button(doc, "gc-lgbtn", labels.legendShow);
    toggle.setAttribute("aria-expanded", "false");
    legend.classList.add("is-collapsed");
    toggle.addEventListener("click", () => {
      const closed = legend.classList.toggle("is-collapsed");
      toggle.textContent = closed ? labels.legendShow : labels.legendHide;
      toggle.setAttribute("aria-expanded", String(!closed));
    });
    wrap.append(toggle);
  }
  wrap.append(legend);
  return wrap;
}

/** Centered error figure; the retry button calls `onRetry` (the canvas never refetches). */
export function renderErrorFigure(
  doc: Document,
  labels: CanvasLabels,
  onRetry: () => void,
): HTMLElement {
  const root = el(doc, "div", "gc-error");
  root.setAttribute("role", "alert");
  const retry = button(doc, "btn btn--ghost", labels.retry);
  retry.addEventListener("click", onRetry);
  root.append(el(doc, "p", "", labels.error), retry);
  return root;
}
