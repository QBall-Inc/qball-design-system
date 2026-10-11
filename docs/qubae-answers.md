---
title: Answer turns — chat
package: "@qball-inc/elements/chat"
tokens_source: "@qball-inc/tokens (components.css: .qturn*, .qsep, .vrow/.vstamp*, .vbox*, .qfb, .qsrcline, .qsrclist, .qclaims/.qclaim*, .qcite, .qgap, .qlead, .qclose, .qlink, .qnotice*, .qcursor, .qpanel__comp.is-disabled)"
preview: preview/qubae-answers.html
---

# Answer turns

`mountTranscript()` from `@qball-inc/elements/chat` renders a conversation into
any container: the overlay's `handle.body` or a plain element on a page. The
output is the same in both. Each bot turn is driven by its own `AnswerTurn`
model (see [qubrain-data-contract.md](qubrain-data-contract.md)), and the
transcript renders only what that model exposes.

The transcript stores nothing and fetches nothing. Your site sends the question,
maps its backend stream onto the turn, and replays stored history the same way
(`start()` then `finalize()`).

```ts
import { mount, mountTranscript } from "@qball-inc/elements/chat";

const chat = mount(document.body, { title: "qubae" });
const transcript = mountTranscript(chat.body, {
  botPrompt: "qubae ›",
  onFeedback: (change) => chat.relayFeedback(change),
  answer: { explorerLinkLabel: "walk this in qubrain →" },
});

chat.on("ask", ({ detail }) => {
  transcript.addUserTurn(detail.text);
  const turn = transcript.addBotTurn({ turnRef: crypto.randomUUID() });
  turn.start(); // thinking cursor
  // for each streamed chunk: turn.appendText(chunk)  — buffered, never shown
  // at the end:             turn.finalize(finalTurn) — or turn.fail("…")
});
```

All DOM is built with `createElement` / `textContent` / `setAttribute`; every
string you pass, and every string in a turn, lands as text. Nothing touches
`window` or `document` until a function runs.

## The trust rule

Streamed text is a draft. With the default settings, nothing you pass to
`appendText()` ever reaches the page. While a turn is pending, the slot shows
only the `▋` thinking cursor (`.qcursor`, blinking, static under reduced
motion). `finalize()` replaces it with the complete safe content for the
verdict, so a withheld or refused answer never flashes its draft.

**Early display** (`earlyDisplay: true`, then `turn.authorize("grounded")`)
shows the streamed text as it arrives. Enable it only once your backend sends an
irreversible grounded verdict before any tokens. If a turn shown early is then
finalized as withheld or refused, that is a **contract violation**: the shown
text is withdrawn and the turn becomes an error showing `errorText`. The
internal violation message is never shown. While early display is off,
`authorize()` changes nothing and logs a development warning.

## `mountTranscript(container, options?) → TranscriptHandle`

| Option         | Type                | Default                                        | Notes                                                                               |
| -------------- | ------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------- |
| `userPrompt`   | `string`            | `you ›`                                        | Prompt beside user turns.                                                           |
| `botPrompt`    | `string`            | `bot ›`                                        | Prompt beside bot turns. The persona name is your copy.                             |
| `earlyDisplay` | `boolean`           | `false`                                        | Passed to every `AnswerTurn` (see the trust rule).                                  |
| `onWarn`       | `(message) => void` | `console.warn` outside production              | AnswerTurn development warnings.                                                    |
| `errorText`    | `string`            | `something went wrong. try again in a moment.` | Shown for a contract violation.                                                     |
| `onFeedback`   | `(change) => void`  | —                                              | Shows `+1 / −1` in every answer box; each bot turn then needs a `turnRef`.          |
| `answer`       | `AnswerOptions`     | —                                              | Explorer link label and allow-list, withheld lead-in, source badges, `onStampOpen`. |

| Handle member                  | Purpose                                                                                          |
| ------------------------------ | ------------------------------------------------------------------------------------------------ |
| `addUserTurn(text)`            | Appends the question as plain text.                                                              |
| `addBotTurn({ turnRef? })`     | Appends a bot turn and returns its `AnswerTurn`. Drive it with `start/appendText/finalize/fail`. |
| `addNotice(text, { action? })` | Appends a notice; see below.                                                                     |
| `clear()`                      | Removes everything (e.g. "start fresh"); pending turns stop rendering.                           |
| `destroy()`                    | Clears and detaches; the handle then refuses further calls.                                      |
| `container`                    | The element rendered into.                                                                       |

Turns are separated by hairlines (`.qsep`); notices sit between them without
one. The container scrolls to the end after each change.

`fail(message)` shows `message` as the error line, so pass a short, reader-facing
sentence, never an exception message or stack. Error turns have no stamp and
no feedback.

## What each verdict renders

Every finished turn starts with the verdict stamp row (`renderVerdictStamp`),
then a verdict-tinted box holding the answer body and, when feedback is on, the
`+1 / −1` marks.

| Verdict  | After the box                                                                                                                                        |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| grounded | The sources line `[N sources · newest <mon yyyy>]`, which toggles the reading list; the provenance footer; the explorer link if one is supplied.     |
| withheld | The lead-in (default `here’s the part i can stand behind:`), then one `.qclaim` row per traceable claim: confidence glyph, sentence, tier word.      |
| refused  | The `closingLine`, verbatim, when one is supplied (`off_topic`, `in_scope_empty` and `abstained` all render the same way; the stamp explains which). |

The stamp explanation, the footer and the sources line come only from the
locked formatters (`groundedExplanation`, `withheldExplanation`,
`refusedExplanation`, `answerFooter`, `sourcesLine`), so their wording cannot drift.

**No evidence.** A grounded answer with nothing behind it (0 claims, 0
episodes, no sources) leaves out `explanation.confidenceTier` and `provenance`.
Its stamp reads `0 claims · 0 episodes`; it has no sources line and no footer.
Map a backend confidence of `none` to a missing tier. A grounded answer that
has evidence but no `provenance` is rejected.

**No snapshot date.** When `provenance.snapshotDate` is missing or `null`, the
footer leaves out the `snapshot <date>` segment:
`7 claims · 5 episodes · high confidence · 1 superseded excluded`.

**Sources line edge cases.** It counts reading-list rows (one per episode). The
date is the newest available source's save date. With no sources, neither the
line nor the list renders. If every source is unavailable, there is no date, so
the list shows open without a line.

## Answer body

The body blocks render as `p`, `h1`–`h3`, `ul`/`ol` (one nested level),
`table` and `pre`; inline runs as text, `strong`/`em`, `code`, `.qn` (figures)
and `.qgap` (gap markers). Box styles reset the page's global element styles,
so the body keeps the chat register.

**Citations** render as numbered text markers, `[1]`, `[2]`, numbered in
reading-list order, with the source title as a tooltip. They are not links: the
reading list under the sources line is where a reader opens a source. A
citation whose episode is not among the turn's sources (for a withheld turn,
its claims' sources; a refused turn has none) renders as `[source unavailable]`.
A known but unavailable source keeps its number, styled as unavailable.

## Explorer link and notice actions (internal-link policy)

The answer's `explorerLink` and a notice's `action.href` point into your own
site. Either becomes a real link only when it is:

- a root-relative path (`/explore?e=agent-memory`), or
- an absolute http(s) URL whose origin is in `answer.allowedOrigins`.

Anything else (`javascript:`, `data:`, `vbscript:`, protocol-relative `//…`,
backslash tricks, relative paths, other origins) renders as the same label in
inert text with no `href`. `safeInternalUrl` from `@qball-inc/elements/trust`
applies the same policy if you need it elsewhere.

## Notices and the disabled composer

Usage limits and pauses are notices: `addNotice(text, { action? })` renders a
`.qnotice` (`role="status"`, no stamp). A `\n` in `text` starts a new line.
`action` is either `{ label, href }` (a link, through the policy above) or
`{ label, onClick }` (a button), on its own line. The DS ships no limit copy;
every word is yours.

After a limit, disable the composer on the overlay handle:

```ts
transcript.addNotice("you’ve used today’s questions.\ncome back tomorrow.", {
  action: { label: "the explorer stays open →", href: "/explore" },
});
chat.setComposerDisabled(true, "back tomorrow");
// later — e.g. a "start fresh" button:
transcript.clear();
chat.setComposerDisabled(false);
```

The dimmed state is the tokens rule `.qpanel__comp.is-disabled` (opacity .45);
the JS only toggles the class.

## Feedback

With `onFeedback` set, every answer box (grounded, withheld and refused) shows
`+1 / −1`, and each bot turn needs a non-empty `turnRef`, which comes back with
every change. Inside the overlay, wire it to the handle so the change becomes
its typed `feedback` event: `onFeedback: (change) => chat.relayFeedback(change)`.
Recording feedback is your job.

To stop every stamp's shimmer once any stamp is opened, pass
`answer.onStampOpen` and call `markStampSeen` on each `.vrow` in the container.

## Lower-level renderers

`renderAnswer(finalTurn, options) → HTMLElement[]` returns one finished turn's
nodes, `renderErrorAnswer(text)` the error box, and `renderNotice(text, options)`
a notice. The transcript is built from these; use them directly only if you
manage turn rows yourself.
