// Mount-option validation for the graph canvas: fail-fast, key-naming errors,
// and every default in one place. Pure apart from the media queries it is given.

import type { SkeletonBundle } from "../types";
import { resolveCanvasLabels, type CanvasLabels } from "./canvas-copy";
import { DEFAULT_LABEL_BUDGET } from "./labels";
import { DEFAULT_NEIGHBOR_BUDGET } from "./neighbors";

/** Always-on labels on touch devices (prototype). */
export const COARSE_LABEL_BUDGET = 14;

export interface GraphCanvasOptions {
  /** The graph. Validated at mount (fail-fast, path-naming errors). */
  data: SkeletonBundle;
  /** Partial overrides for every user-visible string. */
  labels?: Partial<CanvasLabels>;
  /** Show the interaction hint in the HUD (default true). */
  hint?: boolean;
  /** Show the class legend (default true). */
  legend?: boolean;
  /** Show the selection chip (default true; an explorer with its own panel passes false). */
  chip?: boolean;
  /** Mouse-drag moves nodes (default true). */
  draggable?: boolean;
  /** Neighbors shown per selection and per "show more" (default 20). */
  neighborBudget?: number;
  /** Always-on labels, top by episode count (default 30; 14 on touch; 0 for none). */
  labelBudget?: number;
  /** Return true to make Esc do nothing, e.g. while one of your own overlays is open. */
  suppressKeys?: () => boolean;
  /** Render the error figure on failure (default true). Pass false to show your own. */
  errorUi?: boolean;
}

/** Options after validation and defaulting, plus the environment they depend on. */
export interface ResolvedOptions {
  labels: CanvasLabels;
  /** The hint text to show, or null when hidden. */
  hint: string | null;
  legend: boolean;
  chip: boolean;
  draggable: boolean;
  errorUi: boolean;
  neighborBudget: number;
  labelBudget: number;
  suppressKeys: (() => boolean) | undefined;
  /** Touch-first pointer: bigger hit targets, fewer labels, touch hint. */
  coarse: boolean;
  /** Settle without animation (prefers-reduced-motion). */
  reducedMotion: boolean;
}

function requireBool(name: string, value: unknown, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  if (typeof value !== "boolean") throw new TypeError(`${name} must be a boolean.`);
  return value;
}

function requireCount(name: string, value: unknown, fallback: number, min: number): number {
  if (value === undefined) return fallback;
  if (typeof value !== "number" || !Number.isInteger(value) || value < min) {
    throw new TypeError(`${name} must be an integer >= ${min}.`);
  }
  return value;
}

/** Validates `options` (TypeError naming the bad key) and fills every default. */
export function resolveOptions(
  options: GraphCanvasOptions,
  media: (query: string) => boolean,
): ResolvedOptions {
  if (typeof options !== "object" || options === null) {
    throw new TypeError("mount() needs options.");
  }
  if (options.suppressKeys !== undefined && typeof options.suppressKeys !== "function") {
    throw new TypeError("suppressKeys must be a function.");
  }
  const labels = resolveCanvasLabels(options.labels);
  const coarse = media("(pointer: coarse)");
  const showHint = requireBool("hint", options.hint, true);
  return {
    labels,
    hint: showHint ? (coarse ? labels.hintCoarse : labels.hintFine) : null,
    legend: requireBool("legend", options.legend, true),
    chip: requireBool("chip", options.chip, true),
    draggable: requireBool("draggable", options.draggable, true),
    errorUi: requireBool("errorUi", options.errorUi, true),
    neighborBudget: requireCount(
      "neighborBudget",
      options.neighborBudget,
      DEFAULT_NEIGHBOR_BUDGET,
      1,
    ),
    labelBudget: requireCount(
      "labelBudget",
      options.labelBudget,
      coarse ? COARSE_LABEL_BUDGET : DEFAULT_LABEL_BUDGET,
      0,
    ),
    suppressKeys: options.suppressKeys,
    coarse,
    reducedMotion: media("(prefers-reduced-motion: reduce)"),
  };
}
