// Reads the canvas colours from CSS custom properties on the mounted host.
// Every colour comes from @qball-inc/tokens/graph.css, which pins the dark
// stage tier on `.graphcanvas` (so a light page never repaints the nodes); the
// engine source holds no colour literals.

import { GraphCanvasError } from "./canvas-errors";

/** Entity class -> palette role (prototype CLASS_COLOR; `tool` stays brand sage). */
export const CLASS_ROLE: Readonly<Record<string, PaletteRole>> = Object.freeze({
  tool: "signal",
  "resource-collection": "anno",
  technique: "info",
  person: "amber",
  model: "down",
  org: "warn",
  "standard-protocol": "flat",
  "dataset-benchmark": "up",
  concept: "ink",
});

/** Palette role -> the CSS custom property it reads. */
export const ROLE_TOKEN = Object.freeze({
  bg: "--bg-primary",
  ink: "--text-primary",
  muted: "--text-muted",
  signal: "--color-signal",
  amber: "--color-highlight",
  anno: "--anno-source",
  up: "--data-up",
  down: "--data-down",
  warn: "--data-warn",
  info: "--data-info",
  flat: "--data-flat",
  hub: "--stage-hub",
});

export type PaletteRole = keyof typeof ROLE_TOKEN;
export type Palette = Readonly<Record<PaletteRole, string>>;

/**
 * Resolves every palette role on `host`. Rejects with `missing-styles` when any
 * token is empty — the consumer has not loaded @qball-inc/tokens/graph.css
 * (or colors_and_type.css), and a canvas drawn from empty colours would be black.
 */
export function readPalette(host: HTMLElement): Palette {
  const style = host.ownerDocument.defaultView!.getComputedStyle(host);
  const missing: string[] = [];
  const palette = {} as Record<PaletteRole, string>;
  for (const [role, token] of Object.entries(ROLE_TOKEN) as [PaletteRole, string][]) {
    const value = style.getPropertyValue(token).trim();
    if (value === "") missing.push(token);
    palette[role] = value;
  }
  if (missing.length > 0) {
    throw new GraphCanvasError(
      "missing-styles",
      `GraphCanvas colour tokens did not resolve (${missing.join(", ")}). Load @qball-inc/tokens colors_and_type.css and graph.css on the page.`,
    );
  }
  return palette;
}

/** Palette role for an entity class; unknown classes render in brand sage. */
export function classRole(cls: string): PaletteRole {
  return Object.hasOwn(CLASS_ROLE, cls) ? CLASS_ROLE[cls]! : "signal";
}
