<p align="center">
  <a href="https://qball-inc.github.io/qball-design-system/">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/QBall-Inc/qball-design-system/main/assets/qball-logo-handoff/qball-logo-dark.gif">
      <img src="https://raw.githubusercontent.com/QBall-Inc/qball-design-system/main/assets/qball-logo-handoff/qball-logo-parchment.gif" alt="QBall Design System" width="180" height="180">
    </picture>
  </a>
</p>

<h1 align="center">@qball-inc/elements</h1>

<p align="center">
  Framework-free components for <b>AI answers you can check</b>: a chat agent widget,<br>
  answer and source cards that show where every claim comes from, and a 3D knowledge-graph canvas.<br>
  Plain TypeScript and DOM. No React required.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@qball-inc/elements"><img src="https://img.shields.io/npm/v/@qball-inc/elements?color=3F6B5B&label=npm" alt="npm version"></a>
  <a href="https://github.com/QBall-Inc/qball-design-system/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/@qball-inc/elements?color=3F6B5B" alt="Apache-2.0 license"></a>
  <a href="https://qball-inc.github.io/qball-design-system/"><img src="https://img.shields.io/badge/gallery-live-3F6B5B" alt="component gallery"></a>
</p>

---

## What it is

`@qball-inc/elements` is the part of the [QBall Design System](https://github.com/QBall-Inc/qball-design-system)
for putting a grounded AI assistant on a website. It gives you three families of
components:

- **Chat agent:** a corner launcher (press `Q` or click the mark) that opens a chat
  panel, plus the answer turns inside it. Each answer carries a verdict
  (grounded, withheld or refused), numbered citations, a reading list of sources
  and optional `+1 / −1` feedback marks. Streamed text stays hidden until the answer is
  final, so readers never see a draft the assistant later withdraws.
- **Trust components:** claim cards, source rows, provenance footers and verdict
  stamps, for showing what an answer rests on anywhere on a page.
- **Knowledge-graph canvas:** an interactive 3D view of entities and the
  relationships between them, with filtering, selection and labels. On npm
  since `0.4.0`.

Each component is a plain function or `mount()` call that takes data and builds
DOM. Components never fetch: your site calls its own backend and maps the reply
into a small, documented input model. All styling comes from
[`@qball-inc/tokens`](https://www.npmjs.com/package/@qball-inc/tokens), in light
and dark.

**See them live:** the [component gallery](https://qball-inc.github.io/qball-design-system/)
renders every one from the built package. Look under _Trust & provenance_ (the
chat launcher, answer turns, claim cards and verdict stamps) and _Knowledge graph_.

## Install

```sh
npm install @qball-inc/elements @qball-inc/tokens
```

Import the token CSS once per page, in this order:

```js
import "@qball-inc/tokens/colors-and-type.css"; // tokens, light + dark
import "@qball-inc/tokens/components.css"; // every component class
import "@qball-inc/tokens/graph.css"; // only on pages that show the graph
```

Set `data-theme="light"` or `data-theme="dark"` on `<html>`; without it the page
follows the visitor's system setting.

## Quick start: a chat agent on your page

```js
import { mount, mountTranscript } from "@qball-inc/elements/chat";

const chat = mount(document.body, { title: "assistant" });
const transcript = mountTranscript(chat.body, { botPrompt: "assistant ›" });

chat.on("ask", async ({ detail }) => {
  transcript.addUserTurn(detail.text);
  const turn = transcript.addBotTurn();
  turn.start(); // the thinking cursor shows
  try {
    const answer = await askYourBackend(detail.text); // your API, mapped to the input model
    turn.finalize(answer); // the verdict, body, sources and footer render
  } catch {
    turn.fail("the answer service is unavailable. try again in a moment.");
  }
});
```

While the answer is on its way you can show your own status text
(`turn.setStatus("searching the notes")`), and a grounded answer can list links
into your own pages. Every word on screen is yours to supply: the package ships
no product copy.

## What's inside

| Import                      | What you get                                                                                                                                      | Guide                                                                                                                                                                                                                                                                                                                                                        |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@qball-inc/elements/chat`  | The launcher and chat panel (`mount`) and the answer turns (`mountTranscript`)                                                                    | [Launcher and overlay](https://github.com/QBall-Inc/qball-design-system/blob/main/docs/chat-launcher.md) · [Answer turns](https://github.com/QBall-Inc/qball-design-system/blob/main/docs/qubae-answers.md)                                                                                                                                                  |
| `@qball-inc/elements/trust` | Claim card, source row and reading list, provenance footer, verdict stamp, feedback marks                                                         | [Claim card](https://github.com/QBall-Inc/qball-design-system/blob/main/docs/claim-card.md) · [Verdict stamp](https://github.com/QBall-Inc/qball-design-system/blob/main/docs/verdict-stamp.md)                                                                                                                                                              |
| `@qball-inc/elements`       | The input model: types, a validator, the answer-turn model and the shared wording formatters                                                      | [Data contract](https://github.com/QBall-Inc/qball-design-system/blob/main/docs/qubrain-data-contract.md)                                                                                                                                                                                                                                                    |
| `@qball-inc/elements/graph` | The 3D knowledge-graph canvas (`GraphCanvas.mount`), facet chips, entity panel and the assembled `GraphExplorer`; needs the optional peer `three` | [Graph canvas](https://github.com/QBall-Inc/qball-design-system/blob/main/docs/graph-canvas.md) · [Entity panel](https://github.com/QBall-Inc/qball-design-system/blob/main/docs/entity-panel.md) · [Graph explorer](https://github.com/QBall-Inc/qball-design-system/blob/main/docs/graph-explorer.md); the canvas on npm since `0.4.0`, all in the gallery |

The full adoption guide, with every component, the data model and source badges, is the
[consumer guide](https://github.com/QBall-Inc/qball-design-system/blob/main/docs/consumer-handback-elements.md).

## Good to know

- **Safe text.** Every string you pass lands as text, never as HTML. Source links
  become clickable only for `http(s)` URLs; links into your own site follow a
  stricter policy (root-relative paths, or origins you allow).
- **Static and server builds.** Every entry is safe to import during a static or
  server-side build: nothing touches `window` or `document` until a component
  renders.
- **Accessible.** Keyboard and screen-reader support is built in (focus trap and
  Esc in the chat panel, polite announcements, WCAG AA contrast in both themes),
  and motion respects `prefers-reduced-motion`.
- **`three` is optional.** Only `@qball-inc/elements/graph` needs it, and it loads
  lazily when a canvas mounts. The chat and trust entries never reference it.

## Status

The package is on **0.x**: the API can still change between minor versions until
its data contract is final, when it moves to `1.0.0`. Release notes are in the
[changelog](https://github.com/QBall-Inc/qball-design-system/blob/main/packages/elements/CHANGELOG.md).

## Part of the QBall Design System

| Package                                                                    | Use it for                                                                      |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| [`@qball-inc/tokens`](https://www.npmjs.com/package/@qball-inc/tokens)     | The design tokens and component styles as plain CSS (plus JSON). No build step. |
| [`@qball-inc/react`](https://www.npmjs.com/package/@qball-inc/react)       | The React component library: buttons, forms, data display, app chrome and more. |
| [`@qball-inc/elements`](https://www.npmjs.com/package/@qball-inc/elements) | This package: framework-free chat agent, trust and knowledge-graph components.  |

- **Gallery:** [live component contact sheet](https://qball-inc.github.io/qball-design-system/) (light and dark).
- **Source and docs:** [QBall-Inc/qball-design-system](https://github.com/QBall-Inc/qball-design-system).

## License

[Apache-2.0](https://github.com/QBall-Inc/qball-design-system/blob/main/LICENSE) © QBall Inc.
