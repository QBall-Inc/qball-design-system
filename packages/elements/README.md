# @qball-inc/elements

Framework-free building blocks for the QBall Design System: plain TypeScript +
DOM components that paint the shipped `@qball-inc/tokens` CSS. No React or other
framework runtime is required.

> **Status: 0.x.** `0.1.0` ships the trust components and the input model. The
> API can still adjust between 0.x minor versions; it moves to `1.0.0` once its
> data contract is final.

## Install

```sh
npm install @qball-inc/elements @qball-inc/tokens
```

Import the tokens CSS once, in this order (`graph.css` only on pages that show
the graph):

```js
import "@qball-inc/tokens/colors-and-type.css";
import "@qball-inc/tokens/components.css";
import "@qball-inc/tokens/graph.css";
```

## Entry points

| Import                      | Contents                                                           | Status          |
| --------------------------- | ------------------------------------------------------------------ | --------------- |
| `@qball-inc/elements`       | Types, input-model validator and AnswerTurn model (no DOM)         | 0.1.0           |
| `@qball-inc/elements/trust` | Claim card, source row, provenance footer, verdict stamp, feedback | 0.1.0           |
| `@qball-inc/elements/chat`  | Ask launcher, overlay, answer turns                                | a later release |
| `@qball-inc/elements/graph` | Knowledge-graph canvas and explorer (needs `three`)                | a later release |

Every entry is safe to import during a server-side / static build: nothing
touches `window` or `document` until a component is rendered.

## Example

Each component is a function that takes data and returns an element:

```js
import { renderClaimCard, renderVerdictStamp } from "@qball-inc/elements/trust";

document.querySelector("#answer").append(
  renderVerdictStamp({
    verdict: "grounded",
    explanation: { claims: 6, episodes: 4, confidenceTier: "high" },
  }),
  renderClaimCard({
    claim_id: 1,
    claim_text: "The server runs on the local machine.",
    confidence: 0.95,
    confidence_tier: "high",
    valid_from: "2025-06-20",
    source: {
      episode_id: "ep-1",
      title: "Running a server locally",
      url: "https://example.com/local-server",
      source_type: "github",
      save_date: "2025-06-20",
    },
  }),
);
```

All text is rendered as text, never as HTML, and only `http(s)` source links
become clickable. See the
[consumer guide](https://github.com/QBall-Inc/qball-design-system/blob/main/docs/consumer-handback-elements.md)
for every component, source badges and the full data model.

## three.js

`three` is an **optional peer dependency**, needed only by
`@qball-inc/elements/graph` (a later release). The `trust` and `chat` entries
never reference it.

## License

Apache-2.0
