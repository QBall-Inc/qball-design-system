---
"@qball-inc/tokens": patch
---

`components.css`: styles for chat answer turns:

- Structured answer bodies inside `.vbox` (paragraphs, headings, lists, tables, code), reset from the page's global element styles.
- Citation markers (`.qcite`) and gap markers (`.qgap`).
- The withheld lead-in (`.qlead`) and the refused closing line (`.qclose`).
- The footer spacing under an answer, and the error box (`.vbox--error`).
- Notice actions (`.qnotice__act`).
- The disabled composer (`.qpanel__comp.is-disabled`, opacity .45).
