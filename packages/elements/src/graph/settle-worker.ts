// Starts the settle worker for a live (no-layout) bundle, so the force
// simulation runs off the main thread and dragging stays smooth while the
// layout settles. The worker script travels inside './graph' as a string and
// starts from a blob URL: no extra file for a consumer's build to emit. A page
// whose Content-Security-Policy omits `worker-src blob:` (or a runtime with no
// Worker) gets null or a `fail` callback, and the canvas settles on the main
// thread instead, to the same layout.

import type { SettleRequest, SettleUpdate } from "./sim-worker-protocol";
import source from "./sim-worker.inline";

/**
 * How long to wait for the worker's first update before settling on the main
 * thread instead: a browser that neither runs a blocked worker nor reports an
 * error must not leave the layout stuck at 0%. A first step takes well under a
 * second even on a slow phone.
 */
export const FIRST_UPDATE_TIMEOUT_MS = 10_000;

export interface SettleWorker {
  /** Stops the worker; no handler runs after this. Safe to call twice. */
  terminate(): void;
}

export interface SettleWorkerHandlers {
  update(update: SettleUpdate): void;
  /** The worker could not run (blocked, crashed, or a message failed to arrive). Called at most once. */
  fail(): void;
}

/** Starts a worker for `request`, or returns null when this runtime cannot start one. */
export function startSettleWorker(
  view: Window & typeof globalThis,
  request: SettleRequest,
  handlers: SettleWorkerHandlers,
): SettleWorker | null {
  if (
    typeof view.Worker !== "function" ||
    typeof view.Blob !== "function" ||
    typeof view.URL?.createObjectURL !== "function"
  ) {
    return null;
  }
  let url: string | null = null;
  let worker: Worker | null = null;
  // The URL is revoked once the script has demonstrably loaded (first message),
  // not straight after the constructor: a browser may still be fetching it then.
  const release = (): void => {
    if (url !== null) view.URL.revokeObjectURL(url);
    url = null;
  };
  let closed = false;
  const terminate = (): void => {
    if (closed) return;
    closed = true;
    clearTimeout(watchdog);
    worker?.terminate();
    release();
  };
  const fail = (): void => {
    if (closed) return;
    terminate();
    handlers.fail();
  };
  const watchdog = setTimeout(fail, FIRST_UPDATE_TIMEOUT_MS);
  try {
    url = view.URL.createObjectURL(new view.Blob([source], { type: "text/javascript" }));
    const started = new view.Worker(url);
    worker = started;
    started.onmessage = (event: MessageEvent<SettleUpdate>) => {
      clearTimeout(watchdog);
      release();
      if (!closed) handlers.update(event.data);
    };
    // Chrome reports a CSP-blocked blob worker here, not as a constructor throw.
    started.onerror = started.onmessageerror = (event: Event) => {
      event.preventDefault();
      fail();
    };
    started.postMessage(request);
  } catch {
    // Some browsers throw for a CSP-blocked worker; nothing has been reported yet.
    closed = true;
    clearTimeout(watchdog);
    worker?.terminate();
    release();
    return null;
  }
  return { terminate };
}
