// DOM-free force layout for the knowledge graph, ported from the prototype's
// `makeSim` (design bundle graph/graph-canvas.js L23-175; edge strengths from
// L226-229). Fruchterman-Reingold with grid-approximated repulsion and
// component-aware anchoring: the largest connected component forms the main
// cloud, smaller components ("satellites") sit on a shell around it.
//
// Port changes, all deliberate:
//  - randomness comes from an injected `Rng` (seeded per revision, G-CON-4);
//  - the caller's edges are never mutated (the prototype wrote `e.k` onto them);
//  - a precomputed bundle `layout` short-circuits the simulation (G-CON-3).
// The step loop is unchanged, so a caller can run it in batches (main thread
// today, a Web Worker if the WP-QB-2.2 performance gate needs one).
//
// Hot loops index typed arrays whose bounds hold by construction (3 floats per
// node, edge endpoints validated in buildSimEdges), hence the `!` assertions.

import type { SkeletonBundle } from "../types";
import { rngForRevision, type Rng } from "./prng";

/** Layout tuning, prototype DEFAULTS.sim; `heat` and `gravity` are its in-code fallbacks. */
export interface SimConfig {
  iters: number;
  cool: number;
  spring: number;
  radius: number;
  k: number;
  heat: number;
  gravity: number;
}

export const DEFAULT_SIM_CONFIG: Readonly<SimConfig> = Object.freeze({
  iters: 160,
  cool: 0.965,
  spring: 1.0,
  radius: 700,
  k: 1.2,
  heat: 6,
  gravity: 0.006,
});

/** A layout edge between node INDICES (not ids) with spring strength `s`. */
export interface SimEdge {
  a: number;
  b: number;
  s: number;
}

/** A steppable simulation. `pos` holds x,y,z per node index and updates in place. */
export interface Simulation {
  readonly pos: Float32Array;
  /** Typed + co-mention degree per node index. */
  readonly deg: Float32Array;
  /** Runs one iteration; returns true while more iterations remain. */
  step(): boolean;
  /** Fraction of iterations completed, 0..1. */
  readonly progress: number;
}

/**
 * Maps a bundle's typed and co-mention edges onto node indices with the
 * prototype's spring strengths: typed `1 + ln n`, co-mention `0.05 * (1 + ln w)`.
 * Typed edges come first (the prototype's `typed.concat(com)` order).
 */
export function buildSimEdges(bundle: SkeletonBundle): SimEdge[] {
  const indexOf = new Map<number, number>();
  bundle.nodes.forEach((node, i) => indexOf.set(node.id, i));
  const at = (id: number, edge: string): number => {
    const i = indexOf.get(id);
    if (i === undefined) {
      throw new Error(`${edge} references node id ${id}, which is not in the bundle`);
    }
    return i;
  };
  // A count below 1 (or not a number) would make ln() -Infinity/NaN and poison
  // every position through the shared forces, so reject it here, by path.
  const count = (value: number, path: string): number => {
    if (!(value >= 1) || !Number.isFinite(value)) {
      throw new RangeError(`${path} must be a finite count >= 1, got ${value}`);
    }
    return value;
  };
  const typed = bundle.typed_edges.map((e, k) => ({
    a: at(e.a, `typed_edges[${k}]`),
    b: at(e.b, `typed_edges[${k}]`),
    s: 1 + Math.log(count(e.n, `typed_edges[${k}].n`)),
  }));
  const comention = bundle.comention_edges.map((e, k) => ({
    a: at(e.a, `comention_edges[${k}]`),
    b: at(e.b, `comention_edges[${k}]`),
    s: 0.05 * (1 + Math.log(count(e.w, `comention_edges[${k}].w`))),
  }));
  return typed.concat(comention);
}

/** Creates the simulation with seeded initial positions; call `step()` to advance it. */
export function makeSim(
  nodeCount: number,
  edges: readonly SimEdge[],
  simCfg: Readonly<SimConfig>,
  rng: Rng,
): Simulation {
  const n = nodeCount;
  edges.forEach((e, k) => {
    if (
      !(
        Number.isInteger(e.a) &&
        Number.isInteger(e.b) &&
        e.a >= 0 &&
        e.b >= 0 &&
        e.a < n &&
        e.b < n
      )
    ) {
      throw new RangeError(`edges[${k}] joins ${e.a}-${e.b}, outside node indices 0..${n - 1}`);
    }
  });
  const R = simCfg.radius;
  const K = (simCfg.k * R) / Math.cbrt(n);
  const pos = new Float32Array(n * 3);
  const disp = new Float32Array(n * 3);
  const deg = new Float32Array(n);
  for (const e of edges) {
    deg[e.a]!++;
    deg[e.b]!++;
  }
  const springK = new Float64Array(edges.length);
  edges.forEach((e, k) => {
    springK[k] = e.s / Math.sqrt(Math.min(deg[e.a]!, deg[e.b]!) + 1);
  });

  // Connected components (union-find); satellites anchor on a shell around the main cloud.
  const uf = new Int32Array(n);
  for (let i = 0; i < n; i++) uf[i] = i;
  const find = (x: number): number => {
    while (uf[x] !== x) {
      uf[x] = uf[uf[x]!]!;
      x = uf[x]!;
    }
    return x;
  };
  for (const e of edges) {
    const a = find(e.a);
    const b = find(e.b);
    if (a !== b) uf[a] = b;
  }
  const compOf = new Int32Array(n);
  const csize = new Map<number, number>();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    compOf[i] = r;
    csize.set(r, (csize.get(r) ?? 0) + 1);
  }
  let mainRoot = -1;
  let mx = 0;
  for (const [r, s] of csize) {
    if (s > mx) {
      mx = s;
      mainRoot = r;
    }
  }
  const satRoots = [...csize.keys()].filter((r) => r !== mainRoot);
  const anchor = new Map<number, [number, number, number]>();
  const M = Math.max(satRoots.length, 1);
  satRoots.forEach((r, k) => {
    const y = 1 - (2 * (k + 0.5)) / M;
    const rad = Math.sqrt(Math.max(0, 1 - y * y));
    const th = 2.399963 * k;
    const sh = R * (1.18 + (0.2 * (k % 3)) / 2);
    anchor.set(r, [Math.cos(th) * rad * sh, y * sh, Math.sin(th) * rad * sh]);
  });
  for (let i = 0; i < n; i++) {
    const a = anchor.get(compOf[i]!);
    const u = rng();
    const v = rng();
    const th = 2 * Math.PI * u;
    const ph = Math.acos(2 * v - 1);
    if (a) {
      const r = R * 0.08 * Math.cbrt(rng());
      pos[i * 3] = a[0] + r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = a[1] + r * Math.sin(ph) * Math.sin(th);
      pos[i * 3 + 2] = a[2] + r * Math.cos(ph);
    } else {
      const r = (R * 0.85 * Math.cbrt(rng())) / (1 + Math.log(1 + deg[i]!) * 0.22);
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th);
      pos[i * 3 + 2] = r * Math.cos(ph);
    }
  }

  let t = R / simCfg.heat;
  let iter = 0;
  const { iters, cool, spring, gravity: grav } = simCfg;

  interface Cell {
    x: number;
    y: number;
    z: number;
    c: number;
    ids: number[];
  }

  function step(): boolean {
    disp.fill(0);
    const cell = K * 1.7;
    const map = new Map<string, Cell>();
    for (let i = 0; i < n; i++) {
      const key = `${(pos[i * 3]! / cell) | 0}:${(pos[i * 3 + 1]! / cell) | 0}:${(pos[i * 3 + 2]! / cell) | 0}`;
      let b = map.get(key);
      if (!b) {
        b = { x: 0, y: 0, z: 0, c: 0, ids: [] };
        map.set(key, b);
      }
      b.x += pos[i * 3]!;
      b.y += pos[i * 3 + 1]!;
      b.z += pos[i * 3 + 2]!;
      b.c++;
      if (b.ids.length < 16) b.ids.push(i);
    }
    const K2 = K * K;
    for (let i = 0; i < n; i++) {
      const ix = pos[i * 3]!;
      const iy = pos[i * 3 + 1]!;
      const iz = pos[i * 3 + 2]!;
      const cx = (ix / cell) | 0;
      const cy = (iy / cell) | 0;
      const cz = (iz / cell) | 0;
      let dx = 0;
      let dy = 0;
      let dz = 0;
      for (let ox = -1; ox <= 1; ox++) {
        for (let oy = -1; oy <= 1; oy++) {
          for (let oz = -1; oz <= 1; oz++) {
            const b = map.get(`${cx + ox}:${cy + oy}:${cz + oz}`);
            if (!b) continue;
            if (ox === 0 && oy === 0 && oz === 0) {
              for (const j of b.ids) {
                if (j === i) continue;
                const ex = ix - pos[j * 3]!;
                const ey = iy - pos[j * 3 + 1]!;
                const ez = iz - pos[j * 3 + 2]!;
                let d2 = ex * ex + ey * ey + ez * ez;
                if (d2 < 1) d2 = 1;
                const f = K2 / d2;
                const d = Math.sqrt(d2);
                dx += (ex / d) * f;
                dy += (ey / d) * f;
                dz += (ez / d) * f;
              }
            } else {
              const ex = ix - b.x / b.c;
              const ey = iy - b.y / b.c;
              const ez = iz - b.z / b.c;
              let d2 = ex * ex + ey * ey + ez * ez;
              if (d2 < 1) d2 = 1;
              const f = (K2 / d2) * b.c;
              const d = Math.sqrt(d2);
              dx += (ex / d) * f;
              dy += (ey / d) * f;
              dz += (ez / d) * f;
            }
          }
        }
      }
      const a = anchor.get(compOf[i]!);
      if (a) {
        const g2 = 0.05;
        dx += (a[0] - ix) * g2;
        dy += (a[1] - iy) * g2;
        dz += (a[2] - iz) * g2;
      } else {
        const g = grav * (1 + Math.log(1 + deg[i]!) * 0.25);
        dx -= ix * g;
        dy -= iy * g;
        dz -= iz * g;
      }
      disp[i * 3]! += dx;
      disp[i * 3 + 1]! += dy;
      disp[i * 3 + 2]! += dz;
    }
    edges.forEach((e, k) => {
      const a = e.a;
      const b = e.b;
      let ex = pos[a * 3]! - pos[b * 3]!;
      let ey = pos[a * 3 + 1]! - pos[b * 3 + 1]!;
      let ez = pos[a * 3 + 2]! - pos[b * 3 + 2]!;
      const d = Math.sqrt(ex * ex + ey * ey + ez * ez) || 1;
      const f = (((d * d) / K) * springK[k]! * spring) / d;
      ex *= f;
      ey *= f;
      ez *= f;
      disp[a * 3]! -= ex;
      disp[a * 3 + 1]! -= ey;
      disp[a * 3 + 2]! -= ez;
      disp[b * 3]! += ex;
      disp[b * 3 + 1]! += ey;
      disp[b * 3 + 2]! += ez;
    });
    for (let i = 0; i < n; i++) {
      const dx = disp[i * 3]!;
      const dy = disp[i * 3 + 1]!;
      const dz = disp[i * 3 + 2]!;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
      const m = Math.min(d, t) / d;
      pos[i * 3]! += dx * m;
      pos[i * 3 + 1]! += dy * m;
      pos[i * 3 + 2]! += dz * m;
    }
    // Recenter on the main component's centroid, hold its radius, cap drift.
    let cxx = 0;
    let cyy = 0;
    let czz = 0;
    let cn = 0;
    for (let i = 0; i < n; i++) {
      if (compOf[i] === mainRoot) {
        cxx += pos[i * 3]!;
        cyy += pos[i * 3 + 1]!;
        czz += pos[i * 3 + 2]!;
        cn++;
      }
    }
    if (cn) {
      cxx /= cn;
      cyy /= cn;
      czz /= cn;
      for (let i = 0; i < n; i++) {
        pos[i * 3]! -= cxx;
        pos[i * 3 + 1]! -= cyy;
        pos[i * 3 + 2]! -= czz;
      }
    }
    let ss = 0;
    let mc = 0;
    for (let i = 0; i < n; i++) {
      if (compOf[i] === mainRoot) {
        ss += pos[i * 3]! ** 2 + pos[i * 3 + 1]! ** 2 + pos[i * 3 + 2]! ** 2;
        mc++;
      }
    }
    const rms = Math.sqrt(ss / Math.max(mc, 1)) || 1;
    const sc = 1 + ((R * 0.84) / rms - 1) * 0.3;
    if (Math.abs(sc - 1) > 0.002) {
      for (let i = 0; i < n; i++) {
        if (compOf[i] === mainRoot) {
          pos[i * 3]! *= sc;
          pos[i * 3 + 1]! *= sc;
          pos[i * 3 + 2]! *= sc;
        }
      }
    }
    const maxR = R * 1.6;
    for (let i = 0; i < n; i++) {
      const x = pos[i * 3]!;
      const y = pos[i * 3 + 1]!;
      const z = pos[i * 3 + 2]!;
      const d = Math.sqrt(x * x + y * y + z * z);
      if (d > maxR) {
        const m = maxR / d;
        pos[i * 3]! *= m;
        pos[i * 3 + 1]! *= m;
        pos[i * 3 + 2]! *= m;
      }
    }
    t *= cool;
    iter++;
    return iter < iters;
  }

  return {
    pos,
    deg,
    step,
    get progress() {
      return iter / iters;
    },
  };
}

/** Advances a simulation until it reports no iterations remain. */
export function runToCompletion(sim: Simulation): Float32Array {
  while (sim.step()) {
    // each step mutates sim.pos in place
  }
  return sim.pos;
}

/**
 * The bundle's precomputed positions as x,y,z per node index, or null when the
 * bundle has no layout or the layout does not place every node (a partial
 * layout falls back to simulation rather than rendering half-placed).
 */
export function positionsFromLayout(bundle: SkeletonBundle): Float32Array | null {
  const layout = bundle.layout;
  if (!layout) return null;
  const pos = new Float32Array(bundle.nodes.length * 3);
  for (let i = 0; i < bundle.nodes.length; i++) {
    const p = layout[String(bundle.nodes[i]!.id)];
    if (!p) return null;
    pos[i * 3] = p[0];
    pos[i * 3 + 1] = p[1];
    pos[i * 3 + 2] = p[2];
  }
  return pos;
}

export interface ResolvedPositions {
  positions: Float32Array;
  source: "layout" | "simulated";
}

/**
 * Final node positions for a bundle: its precomputed layout when complete,
 * otherwise a full seeded simulation (seed derived from `bundle.revision`).
 */
export function resolvePositions(
  bundle: SkeletonBundle,
  simCfg: Readonly<SimConfig> = DEFAULT_SIM_CONFIG,
): ResolvedPositions {
  const fromLayout = positionsFromLayout(bundle);
  if (fromLayout) return { positions: fromLayout, source: "layout" };
  const sim = makeSim(
    bundle.nodes.length,
    buildSimEdges(bundle),
    simCfg,
    rngForRevision(bundle.revision),
  );
  return { positions: runToCompletion(sim), source: "simulated" };
}
