# Consumer hand-back packet — `@qball-inc/elements` @ 0.3.0

Everything a site needs to adopt the framework-free trust and chat components. Companion docs are
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

## 3. What 0.3.0 ships

| Entry                       | Contents                                                                                                                    |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `@qball-inc/elements`       | The input model types, `validateSkeletonBundle`, confidence and superseded helpers, locked-string formatters, AnswerTurn    |
| `@qball-inc/elements/trust` | `renderClaimCard`, `renderSourceRow`, `renderReadingList`, `renderProvenanceFooter`, `renderVerdictStamp`, `renderFeedback` |
| `@qball-inc/elements/chat`  | `mount` (ask launcher + overlay), `mountTranscript`, `renderAnswer`, `renderNotice` — see section 6                         |

Every component is a plain function: data in, one `HTMLElement` out. Nothing touches
`window` or `document` until you call one, so every entry is safe to import during a
static (SSG) build.

Full component references:

- [claim-card.md](./claim-card.md) — ClaimCard, SourceRow / reading list, ProvenanceFooter,
  source badges, URL policy
- [verdict-stamp.md](./verdict-stamp.md) — VerdictStamp (locked explanation lines, ticker,
  shimmer) and the +1 / −1 feedback toggle
- [qubrain-data-contract.md](./qubrain-data-contract.md) — the input model your backend data
  is mapped into, its invariants, and the validator
- [chat-launcher.md](./chat-launcher.md) — the ask launcher, overlay, hotkey and events
- [qubae-answers.md](./qubae-answers.md) — the transcript, answer turns, notices and the
  disabled composer

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
- **Site-supplied internal links** (an answer's `explorerLink`, a notice's
  `action.href`): linked only when root-relative (`/explore?e=…`) or an absolute http(s)
  URL on an origin you list in `answer.allowedOrigins`; anything else renders as inert
  text. `safeInternalUrl` applies the same rule elsewhere. Details:
  [qubae-answers.md](./qubae-answers.md#explorer-link-and-notice-actions-internal-link-policy).

All data text (claim text, titles, badge labels) is rendered as text, never as HTML.

## 6. Release B — the ask launcher and answer turns

### Mount it once from your layout

Put the launcher in the one layout every page uses, not in each page. The layout imports
`colors-and-type.css` and `components.css` only (the launcher needs no `graph.css`), and a
plain `<script>` mounts it with your persona copy:

```astro
---
// src/layouts/Base.astro
import "@qball-inc/tokens/colors-and-type.css";
import "@qball-inc/tokens/components.css";
const { variant = "corner" } = Astro.props;
---
<html lang="en" data-theme="light">
  <body>
    <slot />
    <div id="chat" data-variant={variant} hidden></div>
    <script>
      import { mount, mountTranscript } from "@qball-inc/elements/chat";

      const variant = document.getElementById("chat")?.dataset.variant;
      const chat = mount(document.body, {
        variant: variant === "post-page" ? "post-page" : "corner",
        title: "your assistant name",
        hint: "ask",
        placeholder: "ask about these notes…",
        disclaimer: "your own disclaimer line",
        onAsk: (text) => {
          transcript.addUserTurn(text);
          const turn = transcript.addBotTurn({ turnRef: crypto.randomUUID() });
          // stream your backend reply into `turn` (see below)
        },
      });
      const transcript = mountTranscript(chat.body, {
        onFeedback: (change) => chat.relayFeedback(change),
      });
    </script>
  </body>
</html>
```

`fixtures/consumer-astro` proves exactly this pattern on every CI run: one shared layout,
two pages, the packed tarballs, Q/Esc/scrim/keycap behaviour, answers inside the overlay,
no `three` in the bundle, and hostile persona and answer text staying inert.

### Which variant

- `corner` (default): the fixed bottom-right launcher, for standard pages.
- `post-page`: moves the launcher bottom-left on small screens (under 720px), for pages
  whose bottom-right corner already holds other chrome (a post's reading controls, a
  back-to-top button).

### Events

The handle dispatches typed, non-bubbling events on the host: `open`, `close`,
`ask` (`{ text }`) and `feedback` (the +1 / −1 change). Wire them to your analytics with
`chat.on("ask", (e) => …)`; recording feedback is your job.

### Mapping your backend stream into an answer turn

Each bot turn is an `AnswerTurn`: call `start()`, then `appendText(chunk)` for each streamed
chunk (buffered, never shown), then exactly one of `finalize(turn)` with the final
grounded / withheld / refused turn, or `fail(message)`. With the default settings no
draft ever reaches the page. Drafts show as they stream only with `earlyDisplay: true` plus `turn.authorize("grounded")`, and only
when your backend sends an irreversible grounded verdict before any tokens. The full
mapping, every verdict and the notices are in
[qubae-answers.md](./qubae-answers.md).

**Renderer-only; backend integration at phase_5.** This release proves the components
render the input model correctly from stored fixtures, inside a real static site. It does
not prove any particular backend stream maps into it; that integration is a later, gated
step.

## 7. Not yet available

| Coming                                                        | Entry                       | Release   |
| ------------------------------------------------------------- | --------------------------- | --------- |
| Graph canvas, facet filters, entity panel, explorer (`three`) | `@qball-inc/elements/graph` | Release C |

The `./graph` entry exists as a placeholder only; don't build on it yet.
