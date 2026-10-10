# @qball-inc/elements

## 0.1.0

### Minor Changes

- First release: framework-free TypeScript + DOM components for the QBall Design System, on 0.x.
  - `@qball-inc/elements/trust`: `renderClaimCard`, `renderSourceRow` / `renderReadingList`, `renderProvenanceFooter`, `renderVerdictStamp` and `renderFeedback`. Pure render functions (data in, one element out) that paint the `@qball-inc/tokens` CSS. Text is never parsed as HTML, and only absolute http(s) source URLs become links.
  - `@qball-inc/elements`: the input model types, `validateSkeletonBundle`, confidence and superseded semantics, the locked-string formatters and the AnswerTurn model. No DOM, so it is safe to import in a static build.
  - `./chat` and `./graph` are placeholders until later releases.
