---
"@qball-inc/elements": minor
---

Adopt the certified QuBrain backend contract (CL5) in the answer model. **Breaking (0.x minor).**

- **Refusal kinds** are `out_of_scope` and `no_evidence` (were `off_topic` and `in_scope_empty`).
  `abstained` is no longer a refusal kind; the refused wording is unchanged.
- **Abstained is a grounded flag.** New optional `GroundedTurn.abstained: { label }`. Your label
  replaces the evidence segment of the stamp's line; the footer is unchanged. Leave it unset for the
  usual display. New exported type `AbstainedMark`.
- **Counts.** `episodes` becomes `sources` on `GroundedTurn.explanation` and `AnswerProvenance` /
  `AnswerFooterInput`. `snapshotDate` becomes `revisionDate` (`YYYY-MM-DD`, still optional).
- **Your wording, no default.** New exported type `EvidenceLabels { outdated(count), evidence(tier) }`.
  The answer footer reads `N claims · M sources · <date> · <outdated label> · <evidence label>`, and a
  grounded stamp reads `N claims · M sources · <evidence label>`. The package no longer prints
  "<tier> confidence", "snapshot" or "superseded excluded". Pass the labels as `answer.labels` to
  `mountTranscript` (or `labels` to `renderAnswer`); a grounded answer with evidence throws without them.
- **Changed signatures:** `answerFooter(input, labels)`, `groundedExplanation(input, labels?)`,
  `verdictExplanation(verdict, labels?)`, `renderVerdictStamp(verdict, { labels })`,
  `renderProvenanceFooter("answer", data, labels)`; `AnswerOptions.labels` is new.
- **No-evidence answers** (0 claims, 0 sources) draw no verdict stamp: only the body and any links.
- **Filter bar:** an empty category stays in its taxonomy place, greyed and `aria-disabled` (it cannot
  be pressed); a domain with no populated chip gets a greyed label. Needs the matching tokens release.
- **Graph colours:** an unknown entity class (e.g. a consumer's "unclassified") renders in the muted
  grey instead of the "tool" class's sage, so the legend shows no duplicate swatch.

Migration: rename the refusal kinds and the two count/date fields in your mapping, drop any
`abstained` refusal, and pass your two labels once at mount.
