# Migrating `@qball-inc/elements` 0.6.0 → 1.0.0

1.0.0 freezes the API (see `api-review-1.0.0.md`). Nothing is removed or renamed. Code written
against 0.6.0 compiles and runs unchanged. The changes below are additive, plus a few visible DOM
and style changes that need action only if your own CSS selects the internal classes involved.

Upgrade both packages together, because the new looks ship in the tokens CSS:
`@qball-inc/elements@1.0.0` with the `@qball-inc/tokens` minor released alongside it.

## Additive (no consumer action needed)

| Surface                                                                                | What's new                                                                                                                                                      |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TrustMarks` type (`./trust`, `./chat`, `./graph`)                                     | `{ stamp?, footer?, endorsed?, verified?, superseded?, confidence? }`. Every key defaults to `true`.                                                            |
| `AnswerOptions.trustMarks` (also via `mountTranscript(…, { answer: { trustMarks } })`) | Hide the verdict stamp, the provenance footer, or the confidence on a withheld answer's claims.                                                                 |
| `ClaimCardOptions.trustMarks`                                                          | Hide the endorsed / verified / superseded labels, or the confidence score. A superseded claim stays struck, with its replacement.                               |
| `EntityPanelOptions.trustMarks`, `GraphExplorerOptions.trustMarks`                     | The same switches for the graph panel (footer + claim cards).                                                                                                   |
| `TranscriptOptions.intro`                                                              | A welcome line, drawn as a bot-styled row at the top of an empty chat and again after `clear()`. Plain text. Not a turn, so it has no votes, events or sources. |

Before / after, hiding the verified label everywhere:

```ts
// 0.6.0: not possible
// 1.0.0
mountTranscript(handle.body, { answer: { labels, trustMarks: { verified: false } } });
GraphExplorer.mount(host, { ...options, trustMarks: { verified: false } });
```

## Visible changes (action only if you style the internals)

| Change                         | Before (0.6.0)                                                               | After (1.0.0)                                                                                                                                                                                                | Consumer action                                                        |
| ------------------------------ | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| Inline citations               | `[n]` was always a `<span class="qcite">`.                                   | When source _n_ has an http(s) URL, `[n]` is an `<a class="qcite">` with the same href as its reading-list row (`rel="noopener noreferrer"`, the new-tab switch and label apply). Otherwise it stays a span. | None, unless your CSS targets `span.qcite`. Use `.qcite`.              |
| Sources and site-links toggles | `<button class="qsrcline ground-wave ground-wave--sources">` with a shimmer. | `<button class="qsrcline">`: a static row in info ink, with a chevron that turns when open.                                                                                                                  | None, unless your CSS or tests select `.ground-wave` on these toggles. |
| Disclaimer line                | Text directly in `.qpanel__disc`, secondary ink, 9.5px (11px on phones).     | An info icon (`.qpanel__disc-ic`, decorative) followed by `.qpanel__disc-text`, in primary ink, 11px (12px on phones). An empty disclaimer renders nothing inside.                                           | None, unless your CSS targets the disclaimer's text node.              |
| Graph legend: unknown classes  | The same grey as `standard-protocol`.                                        | A dedicated slate grey (`--stage-unclassified`, new in tokens).                                                                                                                                              | None.                                                                  |

`LAYOUT_VERSION` stays `1`: precomputed layouts from 0.6.0 remain valid.
