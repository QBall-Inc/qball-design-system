// Every user-visible default string the graph canvas renders. A consumer
// overrides any of them through the `labels` mount option (partial; the rest
// keep these defaults). Defaults are lowercase and free of em-dashes, matching
// the consumer site's voice. All copy lands via textContent or attributes.

/** Display names for entity classes, keyed by `BundleNode.cls`. */
export type ClassLabels = Readonly<Record<string, string>>;

export interface CanvasLabels {
  /** Status line before the layout starts. */
  loading: string;
  /** Status line while the layout settles; `percent` is 0..100. */
  settling: (percent: number) => string;
  /** Interaction hint for mouse / trackpad. */
  hintFine: string;
  /** Interaction hint for touch. */
  hintCoarse: string;
  /** Legend toggle text, collapsed and expanded. */
  legendShow: string;
  legendHide: string;
  /** Entity class display names; unknown classes show their raw `cls`. */
  classes: ClassLabels;
  /** Selection chip: `N episodes`. */
  episodes: (count: number) => string;
  /** Selection chip: `showing X of Y neighbors`. */
  showing: (shown: number, total: number) => string;
  /** Selection chip "show more" button. */
  showMore: string;
  /** Accessible name of the chip's clear button (its visible text is `×`). */
  clearSelection: string;
  /** Centered note when an active filter matches nothing. */
  emptyFilter: string;
  /** Error figure text and retry button. */
  error: string;
  retry: string;
  /** Accessible name of the canvas element. */
  canvas: string;
}

export const DEFAULT_CLASS_LABELS: ClassLabels = Object.freeze({
  tool: "tool",
  "resource-collection": "resource",
  technique: "technique",
  person: "person",
  model: "model",
  org: "org",
  "standard-protocol": "protocol",
  "dataset-benchmark": "dataset",
  concept: "concept",
});

export const DEFAULT_CANVAS_LABELS: Readonly<CanvasLabels> = Object.freeze({
  loading: "loading graph…",
  settling: (percent: number) => `settling… ${percent}%`,
  hintFine: "drag to orbit · alt/⌘+drag to pan · scroll to zoom · click to select · esc clears",
  hintCoarse: "drag to orbit · pinch to zoom · two-finger drag to pan · tap to select",
  legendShow: "legend ▾",
  legendHide: "legend ▴",
  classes: DEFAULT_CLASS_LABELS,
  episodes: (count: number) => `${count} episode${count === 1 ? "" : "s"}`,
  showing: (shown: number, total: number) => `showing ${shown} of ${total} neighbors`,
  showMore: "show more",
  clearSelection: "clear selection",
  emptyFilter: "no entities match the active filters.",
  error: "the graph could not be loaded.",
  retry: "retry",
  canvas: "knowledge graph",
});

type FunctionKey = "settling" | "episodes" | "showing";
type StringKey = Exclude<keyof CanvasLabels, FunctionKey | "classes">;

const FUNCTION_KEYS: readonly FunctionKey[] = ["settling", "episodes", "showing"];

const isFunctionKey = (key: string): key is FunctionKey =>
  (FUNCTION_KEYS as readonly string[]).includes(key);
const isStringKey = (key: string): key is StringKey =>
  key in DEFAULT_CANVAS_LABELS && key !== "classes" && !isFunctionKey(key);

/**
 * Merges a partial `labels` option over the defaults. Fails fast on an unknown
 * key or a wrongly typed value, naming the key.
 */
export function resolveCanvasLabels(partial: unknown): CanvasLabels {
  const merged: CanvasLabels = { ...DEFAULT_CANVAS_LABELS };
  if (partial === undefined) return merged;
  if (typeof partial !== "object" || partial === null || Array.isArray(partial)) {
    throw new TypeError("labels must be an object.");
  }
  for (const [key, value] of Object.entries(partial)) {
    if (key === "classes") {
      merged.classes = { ...DEFAULT_CLASS_LABELS, ...requireClassLabels(value) };
    } else if (isFunctionKey(key)) {
      if (typeof value !== "function") throw new TypeError(`labels.${key} must be a function.`);
      // Arity and return type are the consumer's contract (documented); typeof is all JS can check.
      const fn = value as (...counts: number[]) => string;
      if (key === "settling") merged.settling = fn;
      else if (key === "episodes") merged.episodes = fn;
      else merged.showing = fn;
    } else if (isStringKey(key)) {
      if (typeof value !== "string") throw new TypeError(`labels.${key} must be a string.`);
      merged[key] = value;
    } else {
      throw new TypeError(`labels.${key} is not a known label.`);
    }
  }
  return merged;
}

/** Checks a `labels.classes` value: an object of strings. */
export function requireClassLabels(value: unknown): ClassLabels {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError("labels.classes must be an object of strings.");
  }
  for (const [cls, label] of Object.entries(value)) {
    if (typeof label !== "string") throw new TypeError(`labels.classes.${cls} must be a string.`);
  }
  return value as ClassLabels;
}

/** Display name for an entity class: the configured label, else the raw class. */
export function classLabel(labels: { readonly classes: ClassLabels }, cls: string): string {
  return Object.hasOwn(labels.classes, cls) ? labels.classes[cls]! : cls;
}
