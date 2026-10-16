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
  /** `.qpanel__comp` — the composer row (prompt + textarea). */
  composer: HTMLElement;
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
  setComposerText(input, options.placeholder);
  composer.append(el("span", "qpanel__prompt", "you ›"), input);

  panel.append(head, body, composer, el("div", "qpanel__disc", options.disclaimer));
  root.append(scrim, panel);
  return { root, scrim, closeButton, body, composer, input };
}

/** Sets the composer's placeholder and the accessible name derived from it. */
export function setComposerText(input: HTMLTextAreaElement, placeholder: string): void {
  input.placeholder = placeholder;
  input.setAttribute("aria-label", placeholder.length > 0 ? placeholder : "message");
}

/**
 * Disables or re-enables the composer. Disabled: the textarea is disabled, the
 * row gets `is-disabled` (tokens CSS dims it) and `placeholder` replaces the
 * usual one. Re-enabled: `restorePlaceholder` comes back.
 */
export function setComposerState(
  parts: Pick<OverlayParts, "composer" | "input">,
  disabled: boolean,
  placeholder: string,
): void {
  parts.input.disabled = disabled;
  parts.composer.classList.toggle("is-disabled", disabled);
  setComposerText(parts.input, placeholder);
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
 * Pins `root` (a position:fixed layer) to the visual viewport — the part of the
 * page actually on screen. Mobile browsers keep the layout viewport full height
 * when the on-screen keyboard opens; tracking the visual viewport keeps the
 * layer inside what the visitor can see. Updates on the viewport's resize and
 * scroll. Without `visualViewport` it does nothing and the CSS geometry
 * governs. Returns the release function, which removes the listeners and
 * restores the prior inline style.
 */
export function pinToVisualViewport(root: HTMLElement): () => void {
  const viewport = root.ownerDocument.defaultView?.visualViewport;
  if (viewport === undefined || viewport === null) return () => {};
  const previousStyle = root.style.cssText;
  const place = (): void => {
    const { style } = root;
    style.top = `${viewport.offsetTop}px`;
    style.left = `${viewport.offsetLeft}px`;
    style.right = "auto";
    style.bottom = "auto";
    style.width = `${viewport.width}px`;
    style.height = `${viewport.height}px`;
  };
  place();
  viewport.addEventListener("resize", place);
  viewport.addEventListener("scroll", place);
  return () => {
    viewport.removeEventListener("resize", place);
    viewport.removeEventListener("scroll", place);
    root.style.cssText = previousStyle;
  };
}

/**
 * Focuses `node` without a keyboard-focus ring; the ring comes back when the
 * visitor next presses Tab. Uses the `focusVisible: false` focus option where
 * the browser supports it (detected by whether it reads the option), else a
 * temporary inline `outline: none` on `node` alone, cleared on its blur or the
 * next Tab. Returns null when focus did not land on `node` (detached, hidden,
 * not focusable), else a function that clears any pending suppression.
 */
export function focusWithoutRing(node: HTMLElement): (() => void) | null {
  let native = false;
  // `focusVisible` is newer than the TypeScript DOM lib's FocusOptions.
  const options: FocusOptions & { readonly focusVisible: boolean } = {
    get focusVisible(): boolean {
      native = true;
      return false;
    },
  };
  node.focus(options);
  const doc = node.ownerDocument;
  if (doc.activeElement !== node) return null;
  if (native) return () => {};

  const { style } = node;
  const previousValue = style.getPropertyValue("outline");
  const previousPriority = style.getPropertyPriority("outline");
  style.setProperty("outline", "none", "important");
  let cleared = false;
  const clear = (): void => {
    if (cleared) return;
    cleared = true;
    node.removeEventListener("blur", clear);
    doc.removeEventListener("keydown", onKey, true);
    if (previousValue === "") style.removeProperty("outline");
    else style.setProperty("outline", previousValue, previousPriority);
  };
  const onKey = (event: KeyboardEvent): void => {
    if (event.key === "Tab") clear();
  };
  node.addEventListener("blur", clear);
  doc.addEventListener("keydown", onKey, true);
  return clear;
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
