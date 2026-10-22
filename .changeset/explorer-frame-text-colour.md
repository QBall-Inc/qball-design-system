---
"@qball-inc/tokens": patch
---

graph.css: the explorer frame (`.gx`) sets its own text colour (the stage text colour), so
wrapper text never inherits the host page's body colour on a light or dark page.
