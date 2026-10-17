// The settle worker's work, DOM-free so it runs (and is tested) anywhere: it
// rebuilds the canvas's seeded simulation and posts the positions after every
// step. The same code and seed run on the main thread when no worker can start,
// so both paths reach the same layout. Wired to the worker scope by
// sim-worker-entry.ts.

import { rngForRevision } from "./prng";
import { makeSim } from "./sim";
import type { SettleRequest, SettleUpdate } from "./sim-worker-protocol";

export type PostUpdate = (update: SettleUpdate, transfer: Transferable[]) => void;

/** Runs the simulation to completion, posting a copy of the positions after each step. */
export function runSettle(request: SettleRequest, post: PostUpdate): void {
  const sim = makeSim(
    request.nodeCount,
    request.edges,
    request.config,
    rngForRevision(request.revision),
  );
  let more = true;
  while (more) {
    more = sim.step();
    const pos = sim.pos.slice();
    post({ pos, progress: sim.progress, done: !more }, [pos.buffer]);
  }
}
