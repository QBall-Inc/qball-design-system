# QuBrain input model — `@qball-inc/elements` core entry

The core entry (`import … from "@qball-inc/elements"`) holds the **input model** every
QuBrain / QuBae surface renders from: the shapes the components accept. It is pure logic:
no DOM, safe to import in a static-site build.

The input model is backend-agnostic. The package never fetches data, parses a wire format
or knows any backend's field names. Your app maps its own backend's payloads into these
types (see [Write your adapter](#write-your-adapter)) and hands the result to the
components.

## The types

| Type                                      | What it is                                                                               |
| ----------------------------------------- | ---------------------------------------------------------------------------------------- |
| `SkeletonBundle` (+ `BundleNode`, edges)  | The graph the page loads once: stats, nodes, typed and co-mention edges, optional layout |
| `Claim`, `SourceRef`, `UnavailableSource` | One claim and where it came from                                                         |
| `ConnectionDetail`                        | What a clicked edge or path hop shows: asserting claims, or shared sources               |
| `AnswerTurn` + `FinalTurn` / `TurnView`   | The model behind one QuBae answer                                                        |

Two distinctions the types make explicit:

- **Typed vs co-mention.** A typed edge is an assertion ("the graph asserts"), backed by
  claims. A co-mention edge is association only ("discussed together in N sources").
- **Source unavailable.** A claim's `source` is a `SourceRef`, or
  `{ kind: "unavailable", episode_id }` when the record is gone or your payload did not
  carry it. Claims are never dropped for a missing source, and a missing source is never
  shown as a real one with empty fields. Use `isSourceUnavailable(source)` to tell them
  apart.

Superseded claims stay visible. A claim is superseded exactly when `valid_to` is set.
`resolveReplacement(claim, claims)` returns the replacing claim when it is among `claims`,
`{ kind: "unavailable" }` when it is not, and `null` for a current claim.

## Write your adapter

Your adapter is a function in your app, not in this package, that turns your backend's
responses into the types above. Keep it in one module so a backend change touches one
file.

### Field reference

**`SkeletonBundle`**

| Field             | Type                              | Notes                                                       |
| ----------------- | --------------------------------- | ----------------------------------------------------------- |
| `revision`        | string                            | Identity of this graph snapshot; every id is scoped to it   |
| `stats`           | `BundleStats`                     | Counts plus three ISO `YYYY-MM-DD` dates (see below)        |
| `nodes`           | `BundleNode[]`                    | One per entity                                              |
| `typed_edges`     | `TypedEdge[]`                     | `{ a, b, n, rels }`: endpoints, claim count, top relations  |
| `comention_edges` | `ComentionEdge[]`                 | `{ a, b, w }`: endpoints, shared-source count               |
| `layout`          | `Record<id, [x, y, z]>` or `null` | Required key; `null` when you have no precomputed positions |

`BundleStats`: `entities`, `claims_total`, `claims_valid`, `claims_superseded`,
`episodes` (counts), and `earliest_claim_date`, `latest_claim_date`,
`snapshot_date` (the revision date shown in footers).

`BundleNode`: `id` (number), `name` (display name), `cls` (entity class such as person or
org), `eps` (source count, drives size), `aliases` (for search; may be empty), and optional
`facets: { domains, sub_domains }`.

**`Claim`**

| Field                    | Type             | Notes                                                  |
| ------------------------ | ---------------- | ------------------------------------------------------ |
| `claim_id`               | number           | Per revision                                           |
| `claim_text`             | string           | The full sentence the panel shows                      |
| `confidence`             | number           | 0 to 1                                                 |
| `confidence_tier`        | string           | `high`, `medium` (or `med`) or `low`, any case         |
| `valid_from`             | string           | ISO date the claim became current                      |
| `valid_to`               | string, optional | Set means superseded                                   |
| `superseded_by_claim_id` | number, optional | The replacing claim, when known                        |
| `endorsement_tier`       | string, optional | Omit when your data has none                           |
| `verification`           | string, optional | Omit when your data has none                           |
| `source`                 | `ClaimSource`    | A `SourceRef` or `{ kind: "unavailable", episode_id }` |

`SourceRef`: `episode_id`, `title`, `url`, `source_type`, `save_date`, all strings. If any
of them is missing, emit `{ kind: "unavailable", episode_id }` instead of filling blanks.

`ConnectionDetail`: `{ kind: "typed", claims }` for a typed edge (current and superseded
claims together) or `{ kind: "comention", shared_sources }` for a co-mention edge.

### Invariants

- **Ids are per revision.** Node and claim ids are only meaningful inside one `revision`.
  Never persist them or put them in a URL.
- **Select by name.** Deep links and saved selections refer to entities by `name`, which
  is stable across revisions.
- **Edges reference real nodes.** Every `a` and `b` must be the `id` of a node in `nodes`.
- **Layout is all or nothing.** `layout` is used only when it places every node. If any
  node is missing, the graph computes its own seeded layout instead. Send `null` rather
  than a partial layout when in doubt.
- **Never drop, never invent.** Keep claims whose source cannot be resolved (mark the
  source unavailable), and keep superseded claims alongside their replacements.
- **Read named fields only.** Copy the fields above and nothing else, so private fields
  in your backend's response can never reach a rendered surface.

### Validate after adapting

Run the validator where the adapted bundle enters the page. It fails fast with a
`BundleValidationError` whose message names the exact path, for example
`Invalid SkeletonBundle at typed_edges[0].b: references node id 99, which is not in nodes`.
It checks every stats field, unique node ids, that every edge endpoint exists, and that
`layout` is `null` or `[x, y, z]` per entry.

```ts
import { validateSkeletonBundle, type SkeletonBundle } from "@qball-inc/elements";

const bundle: SkeletonBundle = toSkeletonBundle(await response.json()); // your adapter
validateSkeletonBundle(bundle); // throws BundleValidationError on the first problem
```

Only the skeleton bundle has a validator. `ConnectionDetail` and `FinalTurn` values are
trusted as typed, so build them only from the named fields above.

## Confidence

`confidenceMark(tier)` returns a glyph **and** a word — ◆ high, ◈ medium, ◇ low — so
confidence is never colour alone. It maps the tier word your adapter supplies; the numeric
thresholds behind a tier are your app's call. An unknown tier throws.

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

Your app maps its answer stream onto an `AnswerTurn`; the package never parses a wire format.

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
`authorize()` does nothing and logs a development warning. Enable it only once your backend
guarantees an irreversible grounded verdict before any tokens. With it on, a later
non-grounded `finalize()` is a contract violation: the shown text is withdrawn and the view
becomes an error.

## Fixtures

- `fixtures/qubrain/mock-bundle.json`: the skeleton-bundle fixture of record. It is
  never edited.
- `fixtures/qubrain/detail/*.json`: `ConnectionDetail` values in the input-model shape.
  They cover typed hops, superseded claims with and without their replacement,
  unavailable sources, and a co-mention hop.
- `fixtures/qubrain/answers/*.json`: answer-turn event scripts for grounded, withheld,
  refused (in scope / off-topic) and error.

All fixture content is synthetic and public-safe.
