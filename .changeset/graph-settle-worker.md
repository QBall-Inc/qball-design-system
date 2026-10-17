---
"@qball-inc/elements": minor
---

GraphCanvas: a bundle without a precomputed layout now settles in a Web Worker, so the page keeps drawing smoothly while the layout settles (the worker ships inside `./graph` and starts from a `blob:` URL; no extra file). Pages with a Content-Security-Policy need `worker-src 'self' blob:`; without it, or with no `Worker`, the canvas settles on the main thread as before. The settled layout is unchanged. See docs/graph-canvas.md, "Live settle in a worker".
