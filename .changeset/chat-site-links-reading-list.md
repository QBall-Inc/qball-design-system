---
"@qball-inc/elements": minor
"@qball-inc/tokens": minor
---

Site links now look like the sources: a collapsed toggle line (`button.qsrcline.ground-wave.ground-wave--sources.qsitelinks__line`, the consumer's `siteLinks.heading` verbatim, `aria-expanded`) opening reading-list rows (`div.srclist.qsrclist.qsitelinks` of `.srcrow.qsitelinks__link`: title and ↗, no badge or date; an inert link is a `div.is-inert` row with no ↗). Replaces the `.qsitelinks__heading` / `ul.qsitelinks__list` markup. The `siteLinks` input is unchanged. tokens (minor — removes classes): the old `.qsitelinks`, `.qsitelinks__heading` and `.qsitelinks__list` rules are removed (use with elements 0.4.0+); adds `.qsitelinks__line` and the inert-row title colour.
