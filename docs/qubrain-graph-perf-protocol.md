# Graph canvas performance protocol

This is the fixed method for measuring the knowledge-graph canvas
(`GraphCanvas.mount` in `@qball-inc/elements/graph`) against its performance
targets. It was committed before the first measurement run. A later session that
follows it should get comparable numbers. Results live in
[`qubrain-graph-perf-results.md`](qubrain-graph-perf-results.md).

The owner confirmed the targets on 2026-10-17. The owner will also do a hands-on
feel test, and may adjust a target afterwards. Any change is recorded here with
its date.

## Profiles

| Profile | What it is                                                                                                                                                                                                                                       |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **P1**  | Desktop-class Windows PC (Intel Core i9-9900K, NVIDIA RTX 2080). Windows Chrome, headless, rendering on the real GPU through Direct3D 11. No throttling. A desktop stands in for the plan's "owner laptop"; it is the faster machine of the two. |
| **P2**  | The same machine and browser with a 4x CPU slowdown (Chrome DevTools Protocol `Emulation.setCPUThrottlingRate`, rate 4): the mid-range proxy.                                                                                                    |
| **P3**  | One real mid-range phone. The phone opens a self-timing page that runs the same sequence and shows the numbers. The results log records the device class only, nothing that identifies its owner.                                                |

**GPU rule.** Every P1 and P2 run records the WebGL renderer string. A run whose
renderer is a software rasteriser (SwiftShader, llvmpipe) is invalid and is
discarded. The browser tests in CI render in software, so a CI timing is never a
performance number.

## Fixtures

- **With layout**: `fixtures/qubrain/mock-bundle.with-layout.json`. This is the
  full mock (3,294 nodes, 2,857 typed edges, 10,003 co-mention edges) plus a
  precomputed `layout`, so it renders with no settle. Production bundles get a
  layout the same way: the site computes one per revision with `computeLayout`.
- **No layout**: `fixtures/qubrain/mock-bundle.json` (`layout: null`). The
  canvas settles live, running 160 simulation iterations at 4 per frame.

## Targets

| Metric                   | Target                                        | Gates on                                                                                         |
| ------------------------ | --------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Time to interactive      | ≤ 2.0 s on P2; ≤ 3.0 s on P3                  | the with-layout bundle. For the no-layout bundle it is reported only.                            |
| Drag-rotation frame time | p95 ≤ 33 ms on P2 and P3; p50 ≤ 16.7 ms on P1 | both bundles. For the no-layout bundle it is measured during the live settle and again after it. |
| Hover/pick latency       | p95 ≤ 50 ms on P2                             | both bundles, after the settle (hover is off while the canvas settles).                          |

Every metric is measured on every profile for both bundles. The table shows
which cells gate. The other cells are recorded for context.

## Instrumentation

All timestamps come from `performance.now()` in the page under test.

**Time to interactive.**

- Start (`t0`): immediately before `GraphCanvas.mount(host, { data })` is
  called. The bundle is already fetched and parsed, so JSON parsing is outside
  the window.
- `three` is imported inside `mount`, and its load time is inside the window. On
  P1 and P2 the module is served from local memory, which is the warm case. On P3
  the first run fetches it cold and later runs hit the browser cache. The cold
  first run is reported separately and does not gate.
- End: the first animation frame after `handle.settled` resolves. That is the
  first frame in which hover, pick and node drag respond.
- Also recorded:
  - `mount` resolving: the canvas is drawing.
  - `handle.settled` resolving.

**Drag-rotation frame time.**

- The page runs its own `requestAnimationFrame` loop. Each frame it sends the
  canvas element one pointer move, continuing a drag that started with a
  pointer-down at the centre. The drag sweeps horizontally at 6 px per frame for
  180 frames, then releases. Driving the input every frame means the canvas
  redraws every frame, so the time between frames measures the redraw cost, not
  input gaps.
- Frame time is the difference between consecutive `requestAnimationFrame`
  timestamps over the 180 frames. Reported as p50, p95 and max.
- The pointer events are synthetic, created in the page. This is the same on
  every profile, so the profiles stay comparable. The page replaces the canvas
  element's `setPointerCapture` with a no-op, because the browser rejects capture
  for a synthetic pointer id. Capture does not change rendering cost.
- For the no-layout bundle the drag runs twice: once starting right after
  `mount` resolves (during the settle) and once after `handle.settled`.

**Hover/pick latency.**

- After the settle, the page moves a synthetic pointer across a fixed 20 × 12
  grid over the canvas, holding each point for 120 ms.
- For each move that changes the hover card to show a different node:
  - Start: the pointer event's `timeStamp`.
  - End: the first animation frame after the card's content or position
    changed, watched with a `MutationObserver` on `.gc-hover`.
- Moves that hit no node are skipped. Reported as p50, p95 and max, with the
  count of hits.

**Reduced motion.** Under `prefers-reduced-motion` the no-layout settle runs in
batches with one paint at the end. That is a different code path. It is
measured once on P2 and reported on its own row, never as an optimisation.

## Runs

- Each profile × bundle cell runs 5 times, each in a fresh page.
- The results log records every raw number and the median of the 5.
- Gating uses the median run's p95 for frame time and hover, and the median of
  the 5 for time to interactive.
- The host element is 1,000 × 640 CSS px on P1 and P2. P3 uses the phone's full
  viewport width at a height of 70% of the viewport.
- Before each P1/P2 batch, the machine has no other heavy foreground work. The
  log records the date, the browser version and the renderer string.

## Tools

- `just qb-perf-measure` runs P1 and P2 for both bundles and writes the raw
  numbers as JSON. It drives Windows Chrome over the DevTools Protocol from the
  repo's WSL environment. Chrome listens on `127.0.0.1` only, with a throwaway
  profile.
- The P3 page is a self-contained build of the same sequence. The owner opens
  it on the phone, taps start, and reads back the numbers.

## Verdict

- **PROCEED**: every gating cell meets its target.
- If a gating cell misses, the agreed levers apply in this order, with a
  re-measurement after each:
  1. The precomputed layout. This is already in the canvas, and production
     layouts come from `computeLayout`.
  2. Moving the simulation to a worker. This only matters for the no-layout
     path's frame smoothness.
  3. Smaller label and edge budgets on coarse or low-power devices.
- **KILL**: the targets are still missed on P2 or P3 after all levers. Release C
  stops and the renderer and experience go back to the owner. A 2D fallback is
  not the default answer.
