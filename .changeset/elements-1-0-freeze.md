---
"@qball-inc/elements": major
---

**1.0.0: API freeze.** The public surface in `docs/api-review-1.0.0.md` is now stable under the house
semver contract (`CAVEATS.md` → Versioning; `RELEASING.md`). Removing, renaming or visibly changing any
listed export, option, handle member, event or consumer-facing class is MAJOR; adding is MINOR.

Classification of the changes folded into this release (all additive at the API level; see
`docs/migration-1.0.md`):

- **MINOR (additive): trust-mark switches.** New `TrustMarks` type
  (`{ stamp?, footer?, endorsed?, verified?, superseded?, confidence? }`, all default `true`), accepted
  by `AnswerOptions`, `ClaimCardOptions`, `EntityPanelOptions` and `GraphExplorerOptions`. Leaving it
  out renders exactly as 0.6.0.
- **MINOR (additive): `TranscriptOptions.intro`.** A plain-text welcome row at the top of an empty
  chat, and again after `clear()`. Not a turn: no votes, events or sources.
- **Visible behaviour (no API change):** an inline citation `[n]` whose source has an http(s) URL is
  now a link to that source (same href as its reading-list row, with the new-tab switch applied); the
  finished sources and site-links toggles are static rows with a chevron (no shimmer); the disclaimer
  line gains an info icon and primary ink; unknown entity classes get their own legend grey.

The major bump is the 1.0 freeze itself, cut after the certified backend contract was adopted in
0.6.0. No 0.6.0 call site needs to change.
