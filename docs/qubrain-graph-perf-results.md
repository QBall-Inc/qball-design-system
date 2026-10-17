# Graph canvas performance results

Results of the method in
[`qubrain-graph-perf-protocol.md`](qubrain-graph-perf-protocol.md). Each batch
records the date, the browser and the renderer. The raw JSON of a batch is
written by `just qb-perf-measure` to `packages/elements/perf-results/`
(not committed); every per-run figure that gates is copied below.

## Verdict

**Pending P3 after the worker.** With the settle in a Web Worker (lever 2,
batch 2 below), every P1 and P2 gating cell passes, including the frame-time
target while a no-layout bundle settles. The phone (P3) passed every
with-layout cell before the worker; its no-layout cells are re-run on the
worker build.

## Batch 2026-10-17, 2 (P1, P2, settle in a worker)

- Same browser, renderer, host and method as batch 1 below. Build: DS
  working tree after lever 2 (the settle in a Web Worker started from a blob
  URL inside `./graph`), plus two main-thread savings found while measuring
  it. Edge styling is applied once when the edges appear, not on every settle
  frame. The per-frame edge position copy no longer allocates two subarrays
  per edge. Both draw exactly the same picture.
- Every run used the worker. The browser specs prove the worker path delivers
  every simulation step and settles to exactly the precomputed layout.
- **The P2 CPU slowdown does not reach the worker.** `Emulation.setCPUThrottlingRate`
  slows the page's main thread only, so on P2 the worker steps at full desktop
  speed. P2 frame times stay valid, because drawing, input and applying the
  worker's positions all run on the slowed main thread. P2 time to
  interactive for the no-layout bundle is **not** representative of a slow
  laptop: it drops from 12.4 s to 2.8 s only because the slowdown no longer
  applies to the simulation. The phone run (P3) is the real-device figure for
  that wait.
- This display paced Chrome at 16.7 ms on this day (17.6 ms in batch 1). The
  P1 target is relative to each run's own idle frame interval, so both
  batches are judged the same way.

### Against the targets

| Target                                                | Cell             | Measured (median)   | Result |
| ----------------------------------------------------- | ---------------- | ------------------- | ------ |
| Time to interactive ≤ 2.0 s on P2                     | P2 · with layout | 0.64 s              | Pass   |
| Drag p95 ≤ 33 ms on P2                                | P2 · with layout | 19.0 ms             | Pass   |
| Drag p95 ≤ 33 ms on P2, after the settle              | P2 · no layout   | 17.8 ms             | Pass   |
| Drag p95 ≤ 33 ms on P2, during the settle             | P2 · no layout   | 26.8 ms             | Pass   |
| Drag p95 ≤ 33 ms on P2, during the settle, reduced    | P2 · no layout   | 19.1 ms             | Pass   |
| Drag p50 within 1 ms of idle on P1                    | P1 · with layout | 16.7 ms (idle 16.7) | Pass   |
| Drag p50 within 1 ms of idle on P1, during the settle | P1 · no layout   | 16.7 ms (idle 16.7) | Pass   |
| Hover p95 ≤ 50 ms on P2                               | P2 · with layout | 3.2 ms              | Pass   |
| Hover p95 ≤ 50 ms on P2                               | P2 · no layout   | 3.5 ms              | Pass   |

Settle-drag p95 per P2 no-layout run: 26.8, 24.9, 27.5, 27.8, 25.6 ms. With
reduced motion: 18.6, 18.7, 19.3, 19.5, 19.1 ms. Time to interactive, reported
only: no layout 2.45 s on P1 (batch 1: 2.20 s on the main thread); P2 see above.

An intermediate batch the same day, with the worker but before the two
main-thread savings, measured P2 settle-drag p95 at 33.9 to 39.0 ms (a narrow
miss). The savings brought it under the target.

## Batch 2026-10-17, 1 (P1, P2, settle on the main thread)

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

### Run 2026-10-17, 1 (settle on the main thread)

Owner's phone: Android 10, Chrome 155, 7 cores, `ANGLE (Imagination
Technologies … PowerVR C-Series CXTP-48-1536 …, OpenGL ES 3.2)`, viewport
448 × 799 CSS px at device pixel ratio 3, host 448 × 559. Reduce Motion off.
Medians of 5 runs (first visit: 1 run).

| Target                                  | Measured | Result   |
| --------------------------------------- | -------- | -------- |
| Time to interactive ≤ 3.0 s, layout     | 0.25 s   | Pass     |
| Drag p95 ≤ 33 ms, with layout           | 18.8 ms  | Pass     |
| Drag p95 ≤ 33 ms, no layout, after      | 19.2 ms  | Pass     |
| Drag p95 ≤ 33 ms, no layout, during     | 189.8 ms | **Miss** |
| Hover p95, with layout (reported)       | 19.7 ms  | –        |
| Time to interactive, no layout (report) | 6.48 s   | –        |
| First visit, with layout (report)       | 0.84 s   | –        |

The phone paces at 16.6 ms (60 Hz). The miss is the main-thread settle that
lever 2 moves into a worker; only the no-layout rows need the re-run.
