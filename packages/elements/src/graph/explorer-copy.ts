// Every user-visible default string the GraphExplorer frame renders itself:
// the filters toggle, the details pill and the panel's hide control. The
// canvas, facet bar and panel keep their own label sets (canvas-copy.ts,
// panel-copy.ts); the explorer passes those through. Defaults are neutral and
// lowercase (the frame's CSS sets the case); all copy lands via textContent.

export interface ExplorerLabels {
  /** Accessible name of the explorer frame. */
  region: string;
  /** Filters toggle while the chips are collapsed, and while they are shown. */
  filtersShow: string;
  filtersHide: string;
  /** Filters toggle suffix while chips are active: `N active`. */
  filtersActive: (count: number) => string;
  /** Pill that reopens the hidden details panel on wide screens. */
  detailsShow: string;
  /** Pill that reopens the bottom sheet (≤900px); the current entity's name follows it. */
  detailsSheet: string;
  /** The panel's hide control on wide screens, and on the bottom sheet. */
  hide: string;
  hideSheet: string;
}

export const DEFAULT_EXPLORER_LABELS: Readonly<ExplorerLabels> = Object.freeze({
  region: "graph explorer",
  filtersShow: "filters ▾",
  filtersHide: "filters ▴",
  filtersActive: (count: number) => `${count} active`,
  detailsShow: "◂ details",
  detailsSheet: "details ▴",
  hide: "hide ▸",
  hideSheet: "hide ▾",
});
