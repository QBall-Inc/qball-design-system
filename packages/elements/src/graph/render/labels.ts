// DOM label overlay. Each label's text is set once at creation (textContent);
// per frame only its position (left/top) and visibility (`data-off`) change —
// font, colour, weight and halo come from graph.css by `data-kind`. Labels are
// collision-culled in priority order: selection, its lit neighbors, then the
// always-on top-by-episodes set.

import type { BundleNode } from "../../types";
import type { ProjectedPoint } from "../scene";

export type LabelKind = "sel" | "nbr" | "top";

const RANK: Record<LabelKind, number> = { sel: 0, nbr: 1, top: 2 };
/** Collision box at text scale 1 (prototype: 90 x 15 px). */
const CULL_WIDTH = 90;
const CULL_HEIGHT = 15;

export interface LabelLayer {
  readonly root: HTMLElement;
  /** Replaces the labelled set; existing nodes are reused. */
  set(entries: ReadonlyMap<number, LabelKind>): void;
  /** Positions and culls every label against the current camera. */
  sync(project: (index: number) => ProjectedPoint, dims: Float32Array, textScale: number): void;
}

export function renderLabelLayer(doc: Document, nodes: readonly BundleNode[]): LabelLayer {
  const root = doc.createElement("div");
  root.className = "gc-labels";
  const pool = new Map<number, HTMLElement>();
  let order: number[] = [];

  return {
    root,
    set(entries) {
      for (const [i, label] of pool) {
        if (!entries.has(i)) {
          label.remove();
          pool.delete(i);
        }
      }
      for (const [i, kind] of entries) {
        let label = pool.get(i);
        if (!label) {
          label = doc.createElement("div");
          label.className = "gc-label";
          label.textContent = nodes[i]!.name;
          label.setAttribute("data-off", "");
          root.append(label);
          pool.set(i, label);
        }
        label.dataset["kind"] = kind;
      }
      order = [...entries.keys()].sort(
        (a, b) => RANK[entries.get(a)!] - RANK[entries.get(b)!] || nodes[b]!.eps - nodes[a]!.eps,
      );
    },
    sync(project, dims, textScale) {
      const placed: [number, number][] = [];
      const w = CULL_WIDTH * textScale;
      const h = CULL_HEIGHT * textScale;
      for (const i of order) {
        const label = pool.get(i)!;
        const p = project(i);
        let visible = p.onScreen && dims[i]! > 0.5;
        if (visible) {
          for (const [qx, qy] of placed) {
            if (Math.abs(qx - p.x) < w && Math.abs(qy - p.y) < h) {
              visible = false;
              break;
            }
          }
        }
        if (visible) {
          placed.push([p.x, p.y]);
          label.style.left = `${p.x}px`;
          label.style.top = `${p.y}px`;
          label.removeAttribute("data-off");
        } else {
          label.setAttribute("data-off", "");
        }
      }
    },
  };
}
