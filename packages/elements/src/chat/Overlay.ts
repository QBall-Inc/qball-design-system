// Overlay: the ask panel — scrim, head (mascot, title, esc keycap), an empty
// message body, the `you ›` composer and a disclaimer line. Geometry, the
// entrance motion and its reduced-motion fallback are shipped tokens CSS
// (`.qoverlay`, `.qpanel*`); this module builds the DOM and owns the modal
// behavior: focus trap, inert background and body scroll lock.

import { el } from "../trust/dom";
import { buildMascot } from "./Launcher";

export interface OverlayOptions {
  /** Panel title; also the dialog's accessible name. */
  title: string;
  placeholder: string;
  disclaimer: string;
  mascot: () => Element;
}

export interface OverlayParts {
  /** `.qoverlay` — the dialog root (scrim + panel). */
  root: HTMLElement;
  scrim: HTMLElement;
  /** The esc keycap button in the head. */
  closeButton: HTMLButtonElement;
  /** `.qpanel__body` — the scrolling message container. */
  body: HTMLElement;
  /** The composer textarea. */
  input: HTMLTextAreaElement;
}

/** Builds the overlay DOM, closed. All option strings land as text or attributes. */
export function renderOverlay(options: OverlayOptions): OverlayParts {
  const root = el("div", "qoverlay");
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-label", options.title);

  const scrim = el("div", "qoverlay__scrim");
  const panel = el("div", "qpanel");

  const head = el("div", "qpanel__head");
  const mark = el("span", "qbmark");
  mark.append(buildMascot(options.mascot));
  const esc = el("span", "qpanel__esc");
  const closeButton = el("button", "keycap", "esc");
  closeButton.type = "button";
  closeButton.setAttribute("aria-label", `close ${options.title}`);
  esc.append(closeButton);
  head.append(mark, el("span", "qpanel__title", options.title), esc);

  const body = el("div", "qpanel__body");

  const composer = el("div", "qpanel__comp");
  const input = el("textarea", "qpanel__input");
  input.rows = 1;
  input.placeholder = options.placeholder;
  input.setAttribute(
    "aria-label",
    options.placeholder.length > 0 ? options.placeholder : "message",
  );
  composer.append(el("span", "qpanel__prompt", "you ›"), input);

  panel.append(head, body, composer, el("div", "qpanel__disc", options.disclaimer));
  root.append(scrim, panel);
  return { root, scrim, closeButton, body, input };
}

/** Grows the composer to fit its text (recomputed from scrollHeight). */
export function autoGrow(input: HTMLTextAreaElement): void {
  input.style.height = "auto";
  input.style.height = `${input.scrollHeight}px`;
}

const FOCUSABLE =
  'button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])';

/** The focusable elements inside `root`, in DOM order, skipping hidden ones. */
export function focusableIn(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (node) => !node.hidden && node.closest("[hidden],[inert]") === null,
  );
}

/**
 * Keeps Tab / Shift+Tab cycling inside `root`. Returns true when it moved
 * focus itself (the caller then prevents the browser default).
 */
export function trapTab(root: HTMLElement, event: KeyboardEvent): boolean {
  const nodes = focusableIn(root);
  const first = nodes[0];
  const last = nodes[nodes.length - 1];
  if (first === undefined || last === undefined) return false;
  const active = root.ownerDocument.activeElement;
  const inside = active instanceof Node && root.contains(active);
  if (event.shiftKey && (active === first || !inside)) {
    last.focus();
    return true;
  }
  if (!event.shiftKey && (active === last || !inside)) {
    first.focus();
    return true;
  }
  return false;
}

/**
 * Makes everything on the page except `keep` inert and locks body scroll.
 * Walks from `keep` up to <body>, marking each ancestor's siblings inert, so
 * it works wherever the overlay is mounted. Returns the release function,
 * which restores exactly the prior state.
 */
export function lockBackground(keep: HTMLElement): () => void {
  const doc = keep.ownerDocument;
  const marked: Element[] = [];
  for (let node: Element = keep; node !== doc.body && node.parentElement !== null; ) {
    const parent: Element = node.parentElement;
    for (const sibling of Array.from(parent.children)) {
      if (sibling !== node && !sibling.hasAttribute("inert")) {
        sibling.setAttribute("inert", "");
        marked.push(sibling);
      }
    }
    node = parent;
  }
  const previousOverflow = doc.body.style.overflow;
  doc.body.style.overflow = "hidden";
  return () => {
    for (const node of marked) node.removeAttribute("inert");
    doc.body.style.overflow = previousOverflow;
  };
}
