# Consumer hand-back packet — `@qball-inc/elements` @ 0.1.0

Everything a site needs to adopt the framework-free trust components. Companion docs are
linked inline; this page is the index. For `@qball-inc/react`, see
[consumer-handback.md](./consumer-handback.md).

---

## 1. Install

```sh
npm install @qball-inc/elements @qball-inc/tokens
```

`@qball-inc/elements` has no runtime dependencies. It does not depend on
`@qball-inc/tokens`: install both and import the tokens CSS yourself (section 2).
`three` is an optional peer, needed only by the graph entry in a later release.

The package is on **0.x**: the API can still adjust between minor versions until the data
contract is final and `1.0.0` is cut.

## 2. CSS — the locked import order

Import the token stylesheets once per page, in exactly this order:

1. `@qball-inc/tokens/colors-and-type.css` — tokens, light/dark values, base type
2. `@qball-inc/tokens/components.css` — every component class, the trust atoms included
3. `@qball-inc/tokens/graph.css` — graph and explorer chrome (pins a dark stage); pages that
   show the graph only

Later files build on earlier ones, so the order is part of the contract. Set
`data-theme="light"` or `data-theme="dark"` on `<html>`. Without it, the page follows the
visitor's system setting.

## 3. What 0.1.0 ships

| Entry                       | Contents                                                                                                                    |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `@qball-inc/elements`       | The input model types, `validateSkeletonBundle`, confidence and superseded helpers, locked-string formatters, AnswerTurn    |
| `@qball-inc/elements/trust` | `renderClaimCard`, `renderSourceRow`, `renderReadingList`, `renderProvenanceFooter`, `renderVerdictStamp`, `renderFeedback` |

Every component is a plain function: data in, one `HTMLElement` out. Nothing touches
`window` or `document` until you call one, so both entries are safe to import during a
static (SSG) build.

Full component references:

- [claim-card.md](./claim-card.md) — ClaimCard, SourceRow / reading list, ProvenanceFooter,
  source badges, URL policy
- [verdict-stamp.md](./verdict-stamp.md) — VerdictStamp (locked explanation lines, ticker,
  shimmer) and the +1 / −1 feedback toggle
- [qubrain-data-contract.md](./qubrain-data-contract.md) — the input model your backend data
  is mapped into, its invariants, and the validator

## 4. Worked example — Astro

The components need no framework island. A plain `<script>` in an Astro page is bundled
as a module and runs in the browser:

```astro
---
// src/pages/answer.astro
import "@qball-inc/tokens/colors-and-type.css";
import "@qball-inc/tokens/components.css";
---

<html lang="en" data-theme="light">
  <body>
    <section id="answer"></section>
    <script>
      import {
        renderVerdictStamp,
        renderClaimCard,
        renderReadingList,
        renderProvenanceFooter,
      } from "@qball-inc/elements/trust";

      const source = {
        episode_id: "ep-1",
        title: "Running a server locally",
        url: "https://example.com/local-server",
        source_type: "github",
        save_date: "2025-06-20",
      };

      document.querySelector("#answer")?.append(
        renderVerdictStamp({
          verdict: "grounded",
          explanation: { claims: 1, episodes: 1, confidenceTier: "high" },
        }),
        renderClaimCard(
          {
            claim_id: 1,
            claim_text: "The server runs on the local machine.",
            confidence: 0.95,
            confidence_tier: "high",
            valid_from: "2025-06-20",
            source,
          },
          // Company badges are yours to supply, keyed by domain.
          { sourceBadges: { domains: { "example-lab.com": { mark: "EL", label: "Example Lab" } } } },
        ),
        renderReadingList([source]),
        renderProvenanceFooter("answer", {
          claims: 1,
          episodes: 1,
          confidenceTier: "high",
          snapshotDate: "2026-07-17",
          supersededExcluded: 0,
        }),
      );
    </script>
  </body>
</html>
```

In a real site the data comes from your backend, mapped into the input model (see
[qubrain-data-contract.md](./qubrain-data-contract.md)). A `FinalTurn` can be passed to
`renderVerdictStamp` as it is.

This exact setup — packed tarballs, the CSS order above, a plain `<script>`, light and
dark pages — is exercised on every CI run by `fixtures/consumer-astro`.

## 5. URLs — two rules

- **External source links** (`SourceRef.url`, from your data): the components link a
  source only when its URL is an absolute `http:` / `https:` URL, with
  `rel="noopener noreferrer"`. Anything else (`javascript:`, `data:`, relative, malformed)
  renders as plain text with no link. You don't need to pre-filter; the components enforce
  this.
- **Site-supplied internal links** (links your own site builds, such as an answer's
  link to an entity page): these are your responsibility and are not taken by any 0.1.0
  component. They arrive with the chat components in a later release.

All data text (claim text, titles, badge labels) is rendered as text, never as HTML.

## 6. Not yet available

| Coming                                                        | Entry                       | Release   |
| ------------------------------------------------------------- | --------------------------- | --------- |
| Ask launcher, chat overlay, answer turns                      | `@qball-inc/elements/chat`  | Release B |
| Graph canvas, facet filters, entity panel, explorer (`three`) | `@qball-inc/elements/graph` | Release C |

The `./chat` and `./graph` entries exist in 0.1.0 as placeholders only; don't build on
them yet.
