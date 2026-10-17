// Messages between the canvas and its settle worker (sim-worker-entry.ts).
// Type-only: neither side pulls the other's code in through this module.

import type { SimConfig, SimEdge } from "./sim";

/** The one message the canvas sends: everything `makeSim` needs to rebuild the same seeded simulation. */
export interface SettleRequest {
  nodeCount: number;
  edges: SimEdge[];
  config: SimConfig;
  /** Bundle revision; seeds the layout's random stream (rngForRevision). */
  revision: string;
}

/** Posted after every simulation step. `pos` is a fresh copy, transferred. */
export interface SettleUpdate {
  pos: Float32Array;
  progress: number;
  done: boolean;
}
