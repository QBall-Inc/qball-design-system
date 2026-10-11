---
"@qball-inc/elements": minor
---

`./chat`: answer turns. `mountTranscript(container, options)` renders a conversation into the overlay's `handle.body` or any page element. Each bot turn is an `AnswerTurn` whose streamed draft never reaches the page until it is finalized. It renders every verdict (grounded with sources line, reading list, footer and optional explorer link; withheld with traceable-claim rows; refused with the site's closing line), error turns and limit notices (`renderNotice`, with an optional link or button action). Also adds `renderAnswer` / `renderErrorAnswer`, and `ChatHandle.setComposerDisabled(disabled, placeholder?)` / `isComposerDisabled()` for usage limits. `safeInternalUrl` (`./trust`) is the internal-link policy for explorer links and notice actions: root-relative paths or allow-listed origins only.

Input model: a grounded answer with no evidence may leave out `explanation.confidenceTier` and `provenance`. Its stamp reads `0 claims · 0 episodes`, with no sources line or footer. `snapshotDate` is now optional: when missing or null, the footer leaves out the `snapshot <date>` segment instead of throwing.
