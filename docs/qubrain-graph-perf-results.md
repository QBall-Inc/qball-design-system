# Graph canvas performance results

Results of the method in
[`qubrain-graph-perf-protocol.md`](qubrain-graph-perf-protocol.md). Each batch
records the date, the browser and the renderer. The raw JSON of a batch is
written by `just qb-perf-measure` to `packages/elements/perf-results/`
(not committed); every per-run figure that gates is copied below.

## Verdict

**Pending.** Every gating cell for bundles that carry a precomputed layout
passes. The no-layout bundle misses the frame-time target while it settles, on
P1 and P2. The owner chose lever 2 (the simulation in a worker) on 2026-10-17;
P1 and P2 are re-measured after it lands. P3 (phone) is pending.

## Batch 2026-10-17 (P1, P2)

- Browser: Chrome 155.0.8059.84 on Windows, `--headless=new`, driven over the
  DevTools Protocol from WSL.
- Renderer: `ANGLE (NVIDIA, NVIDIA GeForce RTX 2080 (0x00001E82) Direct3D11 vs_5_0 ps_5_0, D3D11)`.
  No run used a software rasteriser.
- Host 1,000 × 640 CSS px at device pixel ratio 1. 5 runs per cell, each in a
  fresh browser context.
- The driver refuses a run that used a hidden or software renderer, a run whose
  page went into the background, a run whose reduced-motion setting does not
  match its cell, and a run whose drag did not move the view. The last three
  checks were added after this batch, after review. A short check run with
  them passed every cell.
- The machine is shared with other work sessions; nothing heavy ran during the
  batch. An earlier batch the same day (same method, before the settle-frame
  row was added) agreed with this one within run-to-run spread.

### Against the targets

| Target                                                | Cell             | Measured (median)   | Result   |
| ----------------------------------------------------- | ---------------- | ------------------- | -------- |
| Time to interactive ≤ 2.0 s on P2                     | P2 · with layout | 0.53 s              | Pass     |
| Drag p95 ≤ 33 ms on P2                                | P2 · with layout | 19.9 ms             | Pass     |
| Drag p95 ≤ 33 ms on P2, after the settle              | P2 · no layout   | 18.9 ms             | Pass     |
| Drag p95 ≤ 33 ms on P2, during the settle             | P2 · no layout   | 361.6 ms            | **Miss** |
| Drag p50 within 1 ms of idle on P1                    | P1 · with layout | 17.6 ms (idle 17.6) | Pass     |
| Drag p50 within 1 ms of idle on P1, after the settle  | P1 · no layout   | 17.6 ms (idle 17.7) | Pass     |
| Drag p50 within 1 ms of idle on P1, during the settle | P1 · no layout   | 47.8 ms (idle 17.7) | **Miss** |
| Hover p95 ≤ 50 ms on P2                               | P2 · with layout | 3.4 ms              | Pass     |
| Hover p95 ≤ 50 ms on P2                               | P2 · no layout   | 2.3 ms              | Pass     |

Time to interactive for the no-layout bundle is reported only: 2.20 s on P1 and
12.39 s on P2. Hover stays well inside its target even at the least favourable
point in a frame: handler p95 plus one frame interval is about 21 ms on P2.

### Medians per cell

Times in ms unless marked. "Settle-drag" is the part of the first drag that ran
while the no-layout bundle was still settling.

| Cell                            | TTI (s) | Settled (s) | Drag p50 | Drag p95 | Settle-drag p50 | Settle-drag p95 | Hover p95 | Hover handler p95 | Idle frame p50 |
| ------------------------------- | ------- | ----------- | -------- | -------- | --------------- | --------------- | --------- | ----------------- | -------------- |
| P1 · with layout                | 0.26    | 0.24        | 17.6     | 18.2     | –               | –               | 0.5       | 0.3               | 17.6           |
| P1 · no layout                  | 2.20    | 2.20        | 17.6     | 18.1     | 47.8            | 53.6            | 0.5       | 0.3               | 17.7           |
| P2 · with layout                | 0.53    | 0.47        | 17.8     | 19.9     | –               | –               | 3.4       | 2.9               | 17.9           |
| P2 · no layout                  | 12.39   | 12.38       | 17.8     | 18.9     | 287.3           | 361.6           | 2.3       | 1.8               | 17.8           |
| P2 · no layout · reduced motion | 11.67   | 11.66       | 17.9     | 18.5     | 760.0           | 911.5           | 2.2       | 1.8               | 17.7           |

### Every run

| Cell                            | Run | TTI (s) | Drag p50 / p95 | Settle-drag p95 | Hover p95 (hits) | Idle frame p50 |
| ------------------------------- | --- | ------- | -------------- | --------------- | ---------------- | -------------- |
| P1 · with layout                | 1   | 0.30    | 17.9 / 18.2    | –               | 0.5 (107)        | 18.0           |
| P1 · with layout                | 2   | 0.31    | 17.6 / 18.2    | –               | 0.5 (107)        | 17.6           |
| P1 · with layout                | 3   | 0.26    | 17.6 / 18.2    | –               | 0.5 (107)        | 17.6           |
| P1 · with layout                | 4   | 0.24    | 17.6 / 18.1    | –               | 0.5 (107)        | 17.7           |
| P1 · with layout                | 5   | 0.25    | 17.6 / 18.2    | –               | 0.6 (107)        | 17.6           |
| P1 · no layout                  | 1   | 2.20    | 17.6 / 18.2    | 53.2            | 0.5 (111)        | 17.6           |
| P1 · no layout                  | 2   | 2.23    | 17.6 / 18.1    | 58.0            | 0.5 (111)        | 17.9           |
| P1 · no layout                  | 3   | 2.19    | 17.6 / 18.1    | 53.6            | 0.5 (111)        | 17.8           |
| P1 · no layout                  | 4   | 2.21    | 17.6 / 18.2    | 53.9            | 0.5 (111)        | 17.6           |
| P1 · no layout                  | 5   | 2.17    | 17.6 / 18.1    | 52.3            | 0.6 (111)        | 17.7           |
| P2 · with layout                | 1   | 0.53    | 17.8 / 19.7    | –               | 3.5 (107)        | 17.9           |
| P2 · with layout                | 2   | 0.49    | 17.7 / 19.5    | –               | 3.4 (107)        | 18.0           |
| P2 · with layout                | 3   | 0.49    | 17.8 / 20.0    | –               | 3.3 (107)        | 17.8           |
| P2 · with layout                | 4   | 0.54    | 17.8 / 20.1    | –               | 3.4 (107)        | 17.9           |
| P2 · with layout                | 5   | 0.53    | 17.6 / 19.9    | –               | 3.4 (107)        | 17.6           |
| P2 · no layout                  | 1   | 11.60   | 17.8 / 18.4    | 342.8           | 2.3 (111)        | 18.0           |
| P2 · no layout                  | 2   | 12.39   | 17.6 / 19.7    | 376.3           | 2.0 (111)        | 17.8           |
| P2 · no layout                  | 3   | 12.96   | 17.7 / 18.9    | 406.3           | 3.4 (111)        | 18.0           |
| P2 · no layout                  | 4   | 12.58   | 17.9 / 19.9    | 361.6           | 1.8 (111)        | 17.6           |
| P2 · no layout                  | 5   | 11.88   | 17.8 / 18.6    | 313.4           | 3.1 (111)        | 17.7           |
| P2 · no layout · reduced motion | 1   | 11.34   | 17.9 / 18.3    | 868.9           | 2.1 (111)        | 17.6           |
| P2 · no layout · reduced motion | 2   | 11.67   | 17.9 / 18.5    | 850.8           | 2.2 (111)        | 17.6           |
| P2 · no layout · reduced motion | 3   | 12.56   | 17.8 / 18.5    | 1046.3          | 2.8 (111)        | 17.7           |
| P2 · no layout · reduced motion | 4   | 12.74   | 17.8 / 19.1    | 1085.0          | 3.2 (111)        | 17.7           |
| P2 · no layout · reduced motion | 5   | 11.31   | 17.9 / 18.4    | 911.5           | 2.2 (111)        | 17.8           |

### Reading

- With a layout, the graph is ready in about a quarter of a second on P1 and
  half a second on P2. Dragging and hovering never drop a frame on either
  profile.
- Without a layout, the settle takes about 40 frames (160 simulation steps at
  4 per frame). Each of those frames runs 4 steps on the main thread: about
  48 ms on P1 and about 290 ms on P2, so the view drops to about 20 and about
  3 frames a second until the settle ends. After the settle, it is as smooth
  as the with-layout bundle.
- Reduced motion does not shorten the settle. It runs the steps in batches
  between paints, so the page freezes for 0.8 to 0.9 s at a time instead.
- The no-layout P2 settle (12.4 s) is longer than the brief's estimate of
  about 7 s. Under the 4x slowdown each simulation step costs more than four
  times the unthrottled baseline.

## P3 (phone)

Pending. The owner runs the self-timing page built by
`just qb-perf-phone-page`.
