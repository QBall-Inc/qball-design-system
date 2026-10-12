---
"@qball-inc/elements": patch
---

chat: `BotTurnOptions.initialFeedback` (`1 | -1 | null`) restores a visitor's earlier vote on a replayed answer turn. The mark renders pressed without firing `onFeedback`, and later clicks toggle from it. An invalid value throws a `RangeError` when the turn is added; passing it without `onFeedback` throws a `TypeError`.
