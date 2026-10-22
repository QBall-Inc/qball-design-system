---
title: Ask launcher and overlay — chat
package: "@qball-inc/elements/chat"
tokens_source: "@qball-inc/tokens (components.css: .qbmark, .keycap, .qlaunch*, .qoverlay*, .qpanel*; graph.css: .qlaunch--on-stage)"
preview: preview/qubae-launcher.html
---

# Ask launcher and overlay

A fixed-corner mascot button (`ask [Q]`) that opens a portrait chat panel.
`mount()` from `@qball-inc/elements/chat` builds both, wires the Q hotkey and
the composer, and reports what happens as events. It is data-agnostic: it never
fetches. The site answers each question and renders the reply into
`handle.body`, usually with `mountTranscript` (see [qubae-answers.md](qubae-answers.md)).

All DOM is built with `createElement` / `textContent` / `setAttribute`; option
strings always land as text. Nothing touches `window` or `document` until
`mount()` runs, so the entry is safe to import during a static build.

```ts
import { mount } from "@qball-inc/elements/chat";

const chat = mount(document.body, {
  title: "qubae",
  placeholder: "ask me anything…",
  disclaimer: "…your site's own disclaimer line…",
  onAsk: (text, handle) => {
    /* send `text` to your backend, render the answer into handle.body */
  },
});
```

Load `components.css` from `@qball-inc/tokens` (and `graph.css` if you use
`onStage`).

## `mount(host, options?) → ChatHandle`

`host` is the element the launcher and overlay are appended into, usually
`document.body`. Events are dispatched on `host`.

| Option           | Type                      | Default                     | Notes                                                                                                                                |
| ---------------- | ------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `title`          | `string`                  | `assistant`                 | Panel title and the dialog's accessible name.                                                                                        |
| `hint`           | `string`                  | `ask`                       | Launcher caption before the `Q` keycap (hidden under 720px).                                                                         |
| `placeholder`    | `string`                  | `ask a question…`           | Composer placeholder.                                                                                                                |
| `disclaimer`     | `string`                  | `""`                        | Line under the composer. The DS ships none; the site supplies its own.                                                               |
| `label`          | `string`                  | `open <title> — or press Q` | Launcher accessible name.                                                                                                            |
| `mascot`         | `() => Element`           | the built-in mascot         | Factory, called for the launcher and the panel head. Build the node yourself; markup strings are not accepted.                       |
| `variant`        | `"corner" \| "post-page"` | `"corner"`                  | `post-page` puts the launcher bottom-left at every width (`.qlaunch--post`), for pages whose bottom-right corner holds other chrome. |
| `onStage`        | `boolean`                 | `false`                     | Light launcher ink over the dark graph stage (`.qlaunch--on-stage`, needs `graph.css`).                                              |
| `hotkey`         | `boolean`                 | `true`                      | Open on Q. Turn off for extra display-only mounts (Esc still closes an open overlay).                                                |
| `suppressHotkey` | `() => boolean`           | —                           | Return `true` to ignore Q, e.g. while one of your own dialogs is open.                                                               |
| `onAsk`          | `(text, handle) => void`  | —                           | Called after the `ask` event for every submitted question.                                                                           |

`onStage` only sets `.qlaunch--on-stage` when the launcher is created. After mount the
library never adds, removes or re-applies any class on `handle.launcher`, so a site may
toggle `.qlaunch--on-stage` itself at any time, e.g. light ink only while the launcher
overlaps a dark graph frame:
`handle.launcher.classList.toggle("qlaunch--on-stage", overStage)`. Opening, closing,
`setHidden`, the Q key and `setComposerDisabled` leave the site's classes as they are.

Invalid options throw at mount: a non-string copy option, an unknown
`variant`, a `mascot` that is not a function or does not return an `Element`.

The defaults are deliberately persona-neutral. The QuBae persona (name,
placeholder, disclaimer) is the site's copy and is passed at call time.

## Handle

| Member                                        | Purpose                                                                                                                                                                                                                                                                   |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `open()` / `close()` / `toggle()`             | Imperative control; repeat calls are no-ops.                                                                                                                                                                                                                              |
| `isOpen()`                                    | Current state.                                                                                                                                                                                                                                                            |
| `body`                                        | The panel's scrolling message container (`.qpanel__body`), empty at mount.                                                                                                                                                                                                |
| `launcher`                                    | The `.qlaunch` button.                                                                                                                                                                                                                                                    |
| `overlay`                                     | The `.qoverlay` dialog root.                                                                                                                                                                                                                                              |
| `setHidden(hidden)`                           | Hides or shows the launcher only (the overlay and hotkey are unaffected). Use it to yield the corner, e.g. while a graph side panel is open on small screens.                                                                                                             |
| `setComposerDisabled(disabled, placeholder?)` | Disables the composer after a usage limit: the textarea is disabled, Enter does nothing, the row dims (`.qpanel__comp.is-disabled`, opacity .45 in the tokens CSS) and `placeholder` replaces the usual one. `setComposerDisabled(false)` restores the mount placeholder. |
| `isComposerDisabled()`                        | Current composer state.                                                                                                                                                                                                                                                   |
| `relayFeedback(change)`                       | Re-emits an answer-feedback change as this handle's `feedback` event. Wire it as the transcript's `onFeedback` (`(change) => handle.relayFeedback(change)`).                                                                                                              |
| `on(type, listener)`                          | Typed listener on `host`; returns a remover.                                                                                                                                                                                                                              |
| `destroy()`                                   | Removes both nodes and every listener (including the document-level hotkey), and releases the page if open.                                                                                                                                                               |

## Events

Dispatched on `host` as `CustomEvent`s. They do not bubble and never go to
`document`.

| Event      | `detail`                                      | When                                |
| ---------- | --------------------------------------------- | ----------------------------------- |
| `open`     | `{}`                                          | The overlay opened.                 |
| `close`    | `{}`                                          | The overlay closed.                 |
| `ask`      | `{ text: string }`                            | A question was submitted (trimmed). |
| `feedback` | `{ value: 1 \| -1 \| null, turnRef: string }` | `relayFeedback` was called.         |

The `feedback` detail is the trust atom's `FeedbackChange`: `null` means the
reader cleared their mark.

## Keyboard and focus

- **Q** opens the overlay from anywhere, except:
  - the focus is in an `input`, `textarea`, `select` or `contenteditable` element;
  - an IME composition is in progress (`isComposing`, or `keyCode` 229);
  - Meta, Ctrl or Alt is held;
  - the overlay is already open, or `suppressHotkey()` returns `true`;
  - the key is auto-repeating, or another handler already called `preventDefault()`.
- **Enter** submits the composer. **Shift+Enter** adds a line, and so does
  Enter during an IME composition. Blank input is ignored. The composer grows
  with its text.
- **Esc**, a click on the scrim, or the `esc` keycap closes the overlay. Esc
  works wherever focus is while the overlay is open (a click on blank panel
  space drops focus to `<body>`). An Esc that only cancels an IME
  composition is ignored. Esc while closed is left alone.
- When the overlay opens, focus moves to the composer. Tab and Shift+Tab cycle
  inside the panel.
- Everything else on the page is made `inert` and body scroll is locked. This
  works wherever `host` sits in the page.
- On close, the exact prior state is restored. If the overlay was opened with
  **Q**, focus returns to the element that had it before (when that element is
  still on the page and focusable); otherwise it returns to the launcher
  (unless the launcher is hidden).
- The element that receives focus on close shows **no focus ring**; the ring
  comes back when the visitor next presses Tab. Browsers that support the
  `focusVisible: false` focus option use it; elsewhere a temporary inline
  `outline: none` sits on that one element until its blur or the next Tab.

## Motion

Owned by the tokens CSS; the JS has no motion logic.

- **Antenna pulse-dot.** It breathes over 2.4s, ease-in-out (opacity .35 → 1,
  scale 1 → 1.25). It is the brand's one sanctioned idle motion.
- **Panel entrance.** The panel rises 14px while fading in, over `--dur-base`
  with `--ease-out`. The scrim fades in alongside it.
- **Reduced motion.** Under `prefers-reduced-motion: reduce` the dot is static
  at opacity .8 and the panel only fades.

## Geometry

- **Visible viewport.** While open, the overlay is pinned to
  `window.visualViewport` (the part of the page actually on screen) and follows
  its `resize` and `scroll`, so an on-screen keyboard shrinks the overlay
  instead of covering it: the header stays at the top and the composer sits
  just above the keyboard. The pin is released on close and destroy. Without
  `visualViewport` the CSS geometry below applies to the full viewport. No
  viewport-meta change is needed on the site.
- **Desktop.** The panel is `min(460px, 100% − 36px)` × `min(600px, 100% − 32px)`
  of the overlay (content box, plus its 1px frame), placed 18px from the right
  and 16px from the bottom.
- **720px and narrower.** The panel spans the full width with equal 12px
  gutters, `min(720px, 100% − 24px)` tall.
- **Launcher.** Its size and corner offsets scale with `clamp()`. The caption
  sits on a small patch of the page colour (the stage colour for `onStage`), so
  it stays legible over any page content.

## Phone type

At 720px and narrower the panel's type is larger: conversation and prompts
14px, verdict row, feedback, sources and footer 11.5–12px, disclaimer 11px,
title 13px, all still multiplied by `--text-scale`. The prompt column widens
with them. The composer is at least 16px there and on any touch screen
(`pointer: coarse`, e.g. a phone held sideways), because iOS Safari zooms the
page when an input under 16px takes focus.

## DESIGN.md carve-outs

- **Panel shadow.** `0 18px 48px rgba(20,20,20,.18)` is a documented
  exception to No Shadows. It is the one lift an overlay floating above
  arbitrary page content needs. It lives in tokens CSS, not in component
  source.
- **`esc` keycap optical lift.** The keycap sits 1px higher
  (`position: relative; top: -1px`). Its 2px bottom edge reads visually low,
  so this is an owner-verified correction: geometric centres were confirmed
  identical. Do not remove it.
