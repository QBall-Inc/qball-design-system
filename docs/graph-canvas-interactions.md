# Graph canvas interactions

How a visitor drives `GraphCanvas`, and the one keyboard trade-off it makes on
purpose. The API reference (options, events, the full list of when Esc yields)
is in [graph-canvas.md](graph-canvas.md).

The canvas is **pointer-first**. It is a 3D cloud you look around in, so
mouse and touch are the main way in.

## Mouse and trackpad

| Action               | Result                                     |
| -------------------- | ------------------------------------------ |
| Drag the empty stage | Orbit the cloud                            |
| Alt/⌘ + drag         | Pan                                        |
| Scroll               | Zoom (clamped)                             |
| Click a node         | Select it; the selection chip opens        |
| Drag a node          | Move it (selects on release only if still) |
| Hover a node         | Show its name and class                    |

Default hint: `drag to orbit · alt/⌘+drag to pan · scroll to zoom · click to select · esc clears`

## Touch

| Action          | Result    |
| --------------- | --------- |
| Drag            | Orbit     |
| Pinch           | Zoom      |
| Two-finger drag | Pan       |
| Tap a node      | Select it |

Default hint: `drag to orbit · pinch to zoom · two-finger drag to pan · tap to select`

The hint picks itself from the pointer type (`(pointer: coarse)` → touch).
Pass `hint: false` when your page shows its own how-to line, and use the
`hintFine` / `hintCoarse` labels to change the wording.

## Keyboard

- **Esc** is the only key the canvas binds. The first press clears the
  selection; the next press recentres a panned view. It acts only while the
  visitor is on the canvas (focus inside it, or nothing focused and the pointer
  over it). It never acts while a dialog or modal overlay is open, while
  someone is typing, or when your `suppressKeys()` returns `true`.
- **Tab** reaches the canvas's buttons in page order: the legend toggle (narrow
  canvases, where the legend starts collapsed), the selection chip's "show more" and clear buttons, and the error
  figure's retry. Each shows the library's sage focus ring. The canvas itself
  is not a tab stop (clicking it focuses it), and Tab always moves on past the
  last button, so focus is never trapped.
- No arrow-key orbit, zoom or reset is bound.

## The keyboard trade-off

A keyboard-only visitor **cannot make the first selection on the canvas**.
Points in a 3D cloud have no useful tab order, so the canvas does not pretend
to offer one.

Once something is selected, the explorer's side panel carries the rest. Its
connection rows and breadcrumbs are ordinary links and buttons, so a visitor
can move from entity to entity by keyboard. That traversal ships with the
assembled explorer.

## Backlog

- **Find an entity by name**: a search field that selects a match. It would
  give keyboard visitors their first selection. Not built; it is listed for
  the shared design-system backlog.
