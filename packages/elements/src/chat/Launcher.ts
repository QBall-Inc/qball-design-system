// Launcher: the fixed-corner mascot button with its antenna pulse-dot and an
// `ask [Q]` caption. Placement, sizing, the pulse and its reduced-motion
// stillness all live in the shipped tokens CSS (`.qlaunch*`); this module
// only builds the button and toggles its modifier classes.

import { el } from "../trust/dom";

/** The mascot, verbatim from the reference engine (static chrome, no data). */
export const MASCOT_SVG =
  '<svg viewBox="0 0 32 36" fill="none" aria-hidden="true"><path d="M13.5 9.5 10.8 4M18.5 9.5 21.2 4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><circle class="qb-dot" cx="10.5" cy="3.4" r="1.7"/><circle class="qb-dot" cx="21.5" cy="3.4" r="1.7"/><rect x="4" y="9.5" width="24" height="19.5" rx="5" stroke="currentColor" stroke-width="2"/><rect class="qb-screen" x="7.5" y="13" width="17" height="12.5" rx="3"/><rect class="qb-scan" x="9" y="14.6" width="14" height="1.5" rx=".75"/><circle class="qb-eye" cx="12.9" cy="20.3" r="2.3"/><circle class="qb-glint" cx="13.6" cy="19.6" r=".65"/><circle class="qb-eye" cx="19.1" cy="20.3" r="2.3"/><circle class="qb-glint" cx="19.8" cy="19.6" r=".65"/><rect x="9.5" y="29" width="2.8" height="3.2" rx="1.2" fill="currentColor"/><rect x="19.7" y="29" width="2.8" height="3.2" rx="1.2" fill="currentColor"/></svg>';

/**
 * Builds the default mascot as a fresh SVG element. Parsed as HTML (an inert
 * document — nothing in it runs) so the markup lands in the SVG namespace
 * without an xmlns attribute, exactly as inline <svg> does; never innerHTML.
 */
export function defaultMascot(): Element {
  const svg = new DOMParser().parseFromString(MASCOT_SVG, "text/html").body.firstElementChild;
  if (svg === null) throw new Error("The built-in mascot failed to parse.");
  return document.importNode(svg, true);
}

/** Corner placement, or the compact bottom-left corner for long-form pages. */
export type LauncherVariant = "corner" | "post-page";

const VARIANTS: readonly LauncherVariant[] = ["corner", "post-page"];

export interface LauncherOptions {
  /** Caption before the Q keycap. */
  hint: string;
  /** Accessible name of the button. */
  label: string;
  /** Builds one mascot node; called once per mascot shown. */
  mascot: () => Element;
  variant: LauncherVariant;
  /** Light ink for placement over the dark graph stage (needs graph.css). */
  onStage: boolean;
}

/** Calls a mascot factory and fails fast if it does not return an element. */
export function buildMascot(factory: () => Element): Element {
  const node: unknown = factory();
  if (!(node instanceof Element)) {
    throw new TypeError("mascot() must return a DOM Element.");
  }
  return node;
}

/** Throws unless `variant` is a known launcher variant. */
export function assertVariant(variant: unknown): asserts variant is LauncherVariant {
  if (!VARIANTS.includes(variant as LauncherVariant)) {
    throw new RangeError(
      `Unknown launcher variant "${String(variant)}" — expected "corner" or "post-page".`,
    );
  }
}

/** `<button class="qlaunch">` with mascot, pulse-dot and `hint [Q]` caption. */
export function renderLauncher(options: LauncherOptions): HTMLButtonElement {
  assertVariant(options.variant);
  const button = el("button", "qlaunch");
  button.type = "button";
  button.setAttribute("aria-haspopup", "dialog");
  button.setAttribute("aria-expanded", "false");
  button.setAttribute("aria-label", options.label);
  if (options.variant === "post-page") button.classList.add("qlaunch--post");
  if (options.onStage) button.classList.add("qlaunch--on-stage");

  const mark = el("span", "qbmark");
  mark.append(buildMascot(options.mascot), el("span", "qlaunch__dot"));
  const caption = el("span", "qlaunch__cap", `${options.hint} `);
  caption.append(el("span", "keycap", "Q"));
  button.append(mark, caption);
  return button;
}

/**
 * Hides or shows the launcher. The shipped `.qlaunch` rule sets `display`, so
 * the `hidden` attribute alone would not hide it; an inline style backs it up.
 */
export function setLauncherHidden(button: HTMLElement, hidden: boolean): void {
  button.hidden = hidden;
  button.style.display = hidden ? "none" : "";
}
