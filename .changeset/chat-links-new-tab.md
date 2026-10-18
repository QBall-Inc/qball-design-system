---
"@qball-inc/elements": minor
"@qball-inc/tokens": patch
---

Chat links can open in a new tab: `mountTranscript({ openLinksInNewTab: true })` (off by default) opens every link the chat draws — explorer link, site links, reading-list sources, notice `action.href` — with `target="_blank"` and `rel="noopener noreferrer"`. The same field works on `answer`, `renderAnswer`, `renderNotice`, `renderSourceRow` and `renderReadingList`. Optional `newTabLabel` is your own wording, read out (visually hidden) after each such link; the DS ships none. tokens: `.qsr` visually hidden text rule.
