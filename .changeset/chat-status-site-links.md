---
"@qball-inc/elements": patch
---

Chat answer turns: two neutral slots for the consumer's own content. `AnswerTurn.setStatus(label | null)` shows short status text beside the thinking cursor, announced politely and only when it changes. `GroundedTurn.siteLinks` (`{ heading, items }`) shows a titled list of links into the consumer's pages under a grounded answer, through the internal-link policy, with a development warning for any link left inert. Neither ships default wording.
