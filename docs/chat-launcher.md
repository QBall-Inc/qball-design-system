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
`handle.body` (answer turns are a separate renderer).

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

| Option           | Type                      | Default                     | Notes                                                                                                                              |
| ---------------- | ------------------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `title`          | `string`                  | `assistant`                 | Panel title and the dialog's accessible name.                                                                                      |
| `hint`           | `string`                  | `ask`                       | Launcher caption before the `Q` keycap (hidden under 720px).                                                                       |
| `placeholder`    | `string`                  | `ask a question…`           | Composer placeholder.                                                                                                              |
| `disclaimer`     | `string`                  | `""`                        | Line under the composer. The DS ships none; the site supplies its own.                                                             |
| `label`          | `string`                  | `open <title> — or press Q` | Launcher accessible name.                                                                                                          |
| `mascot`         | `() => Element`           | the built-in mascot         | Factory, called for the launcher and the panel head. Build the node yourself; markup strings are not accepted.                     |
| `variant`        | `"corner" \| "post-page"` | `"corner"`                  | `post-page` moves the launcher bottom-left under 720px (`.qlaunch--post`), for pages whose bottom-right corner holds other chrome. |
| `onStage`        | `boolean`                 | `false`                     | Light launcher ink over the dark graph stage (`.qlaunch--on-stage`, needs `graph.css`).                                            |
| `hotkey`         | `boolean`                 | `true`                      | Open on Q. Turn off for extra display-only mounts (Esc still closes an open overlay).                                              |
| `suppressHotkey` | `() => boolean`           | —                           | Return `true` to ignore Q, e.g. while one of your own dialogs is open.                                                             |
| `onAsk`          | `(text, handle) => void`  | —                           | Called after the `ask` event for every submitted question.                                                                         |

Invalid options throw at mount: a non-string copy option, an unknown
`variant`, a `mascot` that is not a function or does not return an `Element`.

The defaults are deliberately persona-neutral. The QuBae persona (name,
placeholder, disclaimer) is the site's copy and is passed at call time.

## Handle

| Member                            | Purpose                                                                                                                                                       |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `open()` / `close()` / `toggle()` | Imperative control; repeat calls are no-ops.                                                                                                                  |
| `isOpen()`                        | Current state.                                                                                                                                                |
| `body`                            | The panel's scrolling message container (`.qpanel__body`), empty at mount.                                                                                    |
| `launcher`                        | The `.qlaunch` button.                                                                                                                                        |
| `overlay`                         | The `.qoverlay` dialog root.                                                                                                                                  |
| `setHidden(hidden)`               | Hides or shows the launcher only (the overlay and hotkey are unaffected). Use it to yield the corner, e.g. while a graph side panel is open on small screens. |
| `relayFeedback(change)`           | Re-emits an answer-feedback change as this handle's `feedback` event. Pass it as `renderFeedback`'s `onChange`.                                               |
| `on(type, listener)`              | Typed listener on `host`; returns a remover.                                                                                                                  |
| `destroy()`                       | Removes both nodes and every listener (including the document-level hotkey), and releases the page if open.                                                   |

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
- On close, the exact prior state is restored and focus returns to the
  launcher (unless it is hidden).

## Motion

Owned by the tokens CSS; the JS has no motion logic.

- **Antenna pulse-dot.** It breathes over 2.4s, ease-in-out (opacity .35 → 1,
  scale 1 → 1.25). It is the brand's one sanctioned idle motion.
- **Panel entrance.** The panel rises 14px while fading in, over `--dur-base`
  with `--ease-out`. The scrim fades in alongside it.
- **Reduced motion.** Under `prefers-reduced-motion: reduce` the dot is static
  at opacity .8 and the panel only fades.

## Geometry

- **Desktop.** The panel is `min(460px, 100vw − 36px)` × `min(600px, 100vh − 32px)`
  (content box, plus its 1px frame), placed 18px from the right and 16px from
  the bottom.
- **720px and narrower.** The panel spans the full width with equal 12px
  gutters and a height that accounts for `100dvh`.
- **Launcher.** Its size and corner offsets scale with `clamp()`.

## DESIGN.md carve-outs

- **Panel shadow.** `0 18px 48px rgba(20,20,20,.18)` is a documented
  exception to No Shadows. It is the one lift an overlay floating above
  arbitrary page content needs. It lives in tokens CSS, not in component
  source.
- **`esc` keycap optical lift.** The keycap sits 1px higher
  (`position: relative; top: -1px`). Its 2px bottom edge reads visually low,
  so this is an owner-verified correction: geometric centres were confirmed
  identical. Do not remove it.
