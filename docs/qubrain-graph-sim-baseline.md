# QuBrain graph — simulation baseline (plain Node)

The wall-clock cost of laying out the full mock graph with `@qball-inc/elements`'
seeded force simulation, measured outside any browser. This is the numeric
starting point for the canvas performance gate: the browser measurements there
add rendering on top of this, and decide whether the precomputed-layout or
worker levers are needed.

## Result

| Date       | Graph                                                          | Runs | Simulation time (ms)                     |
| ---------- | -------------------------------------------------------------- | ---- | ---------------------------------------- |
| 2026-10-02 | full mock: 3,294 nodes · 2,857 typed · 10,003 co-mention edges | 3    | 1,747 · 1,760 · 1,732 (median **1,747**) |

- **What is timed:** `resolvePositions(bundle)` on `fixtures/qubrain/mock-bundle.json`
  (`layout: null`): building the simulation edges, seeding from the revision, and all
  160 iterations. Loading and parsing the JSON is excluded.
- **Machine:** desktop-class x86-64 (Intel Core i9-9900K, 8 cores / 16 threads), Linux
  under WSL2, Node v22.22.3, one run at a time, no throttling.
- **How to reproduce:** `just elements-layout-fixture` prints `sim_ms=` for one run
  (and rewrites the derived fixture, which is byte-identical on every run).

## Reading it

- The simulation runs on the main thread in the browser today. At roughly 11 ms
  per iteration on this machine, the canvas has to run it in small batches (the
  simulation is steppable for this) so the page stays responsive while it settles.
  A slower phone will be several times slower.
- If the browser measurements miss their targets, the first lever is a precomputed
  layout: a bundle whose `layout` places every node skips the simulation entirely.
  `fixtures/qubrain/mock-bundle.with-layout.json` exercises that path at full scale.
