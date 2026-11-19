---
"@qball-inc/elements": minor
"@qball-inc/tokens": patch
---

Superseded claims can show the latest replacement inline. `Claim` gains an optional
`current_replacement` (new `ClaimReplacement` type): when present, ClaimCard's `now` line
renders it with a `since {valid_from}` date, even when the replacing claim lives on another
entity pair, and adds `a newer version isn't available` for an incomplete chain. New
export `NEWER_VERSION_UNAVAILABLE` from `./trust`. Payloads without the field render as before.
Tokens: `.claim__now-date` and `.claim__now-note` styles.
