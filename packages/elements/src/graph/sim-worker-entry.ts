// The settle worker's entry point. Never imported by the canvas directly: the
// build bundles this file into a string (inline-worker.ts), which the canvas
// starts from a blob URL (settle-worker.ts). It takes one request and posts
// updates until the layout is done.

import type { SettleRequest } from "./sim-worker-protocol";
import { runSettle } from "./sim-worker";

/** The slice of a dedicated worker's global scope this entry uses (the DOM lib types `globalThis` as a window). */
interface WorkerScope {
  onmessage: ((event: MessageEvent<SettleRequest>) => void) | null;
  postMessage(message: unknown, transfer: Transferable[]): void;
}

const scope = globalThis as unknown as WorkerScope;

scope.onmessage = (event) => {
  scope.onmessage = null;
  runSettle(event.data, (update, transfer) => scope.postMessage(update, transfer));
};
