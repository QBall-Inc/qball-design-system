# QuBrain data contract — `@qball-inc/elements` core entry

The core entry (`import … from "@qball-inc/elements"`) holds the data contract every
QuBrain / QuBae surface renders from. It is pure logic: no DOM, safe to import in a
static-site build. The package is `0.x` — the detail shapes below are **provisional**
until the backend certifies its contract.

## The types

| Type                                      | Status      | What it is                                                                                 |
| ----------------------------------------- | ----------- | ------------------------------------------------------------------------------------------ |
| `SkeletonBundle` (+ `BundleNode`, edges)  | stable      | The graph the site fetches once: stats, nodes, typed and co-mention edges, optional layout |
| `Claim`, `SourceRef`, `UnavailableSource` | provisional | One claim and where it came from                                                           |
| `ConnectionDetail`                        | provisional | What a clicked edge or path hop shows: asserting claims, or shared sources                 |
| `AnswerTurn` + `FinalTurn` / `TurnView`   | DS-owned    | The model behind one QuBae answer                                                          |

Two distinctions the types make explicit:

- **Typed vs co-mention.** A typed edge is an assertion ("the graph asserts"), backed by
  claims. A co-mention edge is association only ("discussed together in N sources").
- **Source unavailable.** A claim's `source` is a `SourceRef` or
  `{ kind: "unavailable", episode_id }` when the backend no longer has the record. Claims
  are never dropped for a missing source, and a missing source is never shown as a real
  one with empty fields. Use `isSourceUnavailable(source)` to tell them apart.

## Validating a bundle

`validateSkeletonBundle(bundle)` fails fast with a `BundleValidationError` whose message
names the exact path, for example
`Invalid SkeletonBundle at typed_edges[0].b: references node id 99, which is not in nodes`.
It checks every stats field, unique node ids, that every edge endpoint exists, and that
`layout` is `null` or `[x, y, z]` per node. Call it where the bundle enters the page.

## The adapter — the single change point

The backend's current detail payloads differ from the public types: claim dates sit under
a `freshness` object, and sources come back as a sibling provenance array joined by
`episode_id`. `adaptConnection(kind, payload)` maps one payload into a
`ConnectionDetail`. It is the **only** module that knows the provisional nesting (a test
enforces this), so when the certified contract lands, this is the one file that changes.
It reads named public fields only; anything else in the payload is ignored.

Superseded claims stay visible. `resolveReplacement(claim, claims)` returns the replacing
claim when the payload carries it, `{ kind: "unavailable" }` when it does not, and `null`
for a current claim.

## Confidence

`confidenceMark(tier)` returns a glyph **and** a word — ◆ high, ◈ medium, ◇ low — so
confidence is never colour alone. It maps the backend's tier word; the numeric thresholds
behind a tier are the site's call. An unknown tier throws.

## Locked strings

These lines are owner-locked: build them only through these functions, which take numbers,
dates and enums, never free text. Nouns follow their count (`1 claim`, `2 claims`).

| Function              | Output                                                                                                                |
| --------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `groundedExplanation` | `6 claims · 4 episodes · high confidence`                                                                             |
| `withheldExplanation` | `2 of 5 claims untraceable · 2 claims shown`                                                                          |
| `refusedExplanation`  | `out of scope` (off-topic) · `unable to answer · 0 references found` (in scope)                                       |
| `answerFooter`        | `7 claims · 5 episodes · high confidence · 2026-07-17 · 1 superseded excluded`                                        |
| `panelFooter`         | `1 claim · 1 source · revision 2026-07-17 · 0 superseded shown`                                                       |
| `sourcesLine`         | `[3 sources · newest jul 2026]` (needs at least one source; omit the line at zero)                                    |
| `canvasStatus`        | `3294 entities · 2857 typed · 10003 co-mention · snapshot 2026-07-17` (narrow: `3294 entities · snapshot 2026-07-17`) |

## AnswerTurn and the trust rule

The site maps its backend stream onto an `AnswerTurn`; the DS never parses a wire format.

```ts
const turn = new AnswerTurn();
turn.subscribe((view) => render(view));
turn.start(); // thinking indicator
turn.appendText(chunk); // buffered — never shown
turn.finalize({ verdict: "withheld", explanation, body, traceableClaims });
// or turn.fail("the answer service is unavailable")
```

**Trust rule.** Streamed text is a draft. It is held privately and never appears in
`view()` until the turn is authorized for display, which normally means `finalize()`.
`finalize()` carries the complete safe content for its verdict. A withheld or refused
turn discards the draft entirely, so text the answer could not stand behind is never
shown.

**Early display** (`new AnswerTurn({ earlyDisplay: true })` plus `authorize("grounded")`)
shows streamed text before finalize. It is off by default. While it is off,
`authorize()` does nothing and logs a development warning. Enable it only once the backend
guarantees an irreversible grounded verdict before any tokens. With it on, a later
non-grounded `finalize()` is a contract violation: the shown text is withdrawn and the view
becomes an error.

## Fixtures

- `fixtures/qubrain/mock-bundle.json`: the skeleton-bundle fixture of record. It is
  never edited.
- `fixtures/qubrain/provisional-detail/*.json`: backend-shaped detail payloads (the
  adapter's input). They cover typed hops, superseded claims with and without their
  replacement, unresolved sources, and a co-mention hop.
- `fixtures/qubrain/provisional-answers/*.json`: answer-turn event scripts for grounded,
  withheld, refused (in scope / off-topic) and error.

Every provisional fixture carries `"_provisional": true` and is replaced by the backend's
certified pack when it arrives.
