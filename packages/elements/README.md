# @qball-inc/elements

Framework-free building blocks for the QBall Design System: plain TypeScript +
DOM components that paint the shipped `@qball-inc/tokens` CSS. No React or other
framework runtime is required.

> **Status: pre-release scaffold.** Nothing is published yet. Components land
> over the upcoming 0.x releases.

## Entry points

| Import                      | Contents                                                           |
| --------------------------- | ------------------------------------------------------------------ |
| `@qball-inc/elements`       | Types, input-model validator and AnswerTurn model (no DOM)         |
| `@qball-inc/elements/trust` | Claim card, source row, provenance footer, verdict stamp, feedback |
| `@qball-inc/elements/chat`  | Ask launcher, overlay, answer turns                                |
| `@qball-inc/elements/graph` | Knowledge-graph canvas and explorer (needs `three`)                |

Every entry is safe to import during a server-side / static build: nothing
touches `window` or `document` until a component is mounted.

## three.js

`three` is an **optional peer dependency** needed only by
`@qball-inc/elements/graph`. Install it yourself if you use the graph:

```sh
npm install three
```

The `trust` and `chat` entries never reference it.

## License

Apache-2.0
