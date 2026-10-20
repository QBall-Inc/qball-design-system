// Client script for the explorer page: mounts the PACKED @qball-inc/elements
// GraphExplorer the way a real site does: it fetches the bundle (emitted as a
// static asset), answers each hop from a provisional detail fixture through a
// real `detail` callback, and hides the page's launcher while the details
// panel is open (the documented launcher-yield recipe). The launcher itself
// comes from the shared ChatLayout.
import type { ConnectionDetail, SkeletonBundle } from "@qball-inc/elements";
import { GraphExplorer } from "@qball-inc/elements/graph";
import bundleUrl from "../../qubrain/mock-bundle.json?url";
import taxonomy from "../../qubrain/taxonomy.json";
import comention from "../../qubrain/detail/comention-connection.json";
import typed from "../../qubrain/detail/typed-connection.json";
import { chatReady } from "./chat-demo";

/** What the spec reads back: mount outcome, every hop asked for, every event. */
export type ExplorerResult =
  | {
      ok: true;
      canvasError: string | null;
      hops: [string, string][];
      events: { type: string; node?: string | null; open?: boolean }[];
    }
  | { ok: false; error: string };

declare global {
  interface Window {
    __explorer?: ExplorerResult;
  }
}

async function main(): Promise<void> {
  try {
    const host = document.getElementById("explorer");
    if (host === null) throw new Error("missing #explorer host");
    const response = await fetch(bundleUrl);
    if (!response.ok) throw new Error(`bundle fetch failed: ${String(response.status)}`);
    const bundle = (await response.json()) as SkeletonBundle;
    const typedPairs = new Set(
      bundle.typed_edges.flatMap((e) => [
        `${String(e.a)}:${String(e.b)}`,
        `${String(e.b)}:${String(e.a)}`,
      ]),
    );
    const hops: [string, string][] = [];
    const events: { type: string; node?: string | null; open?: boolean }[] = [];
    const explorer = await GraphExplorer.mount(host, {
      bundle,
      taxonomy,
      detail: ({ from, to }) => {
        hops.push([from.name, to.name]);
        const pair = `${String(from.id)}:${String(to.id)}`;
        // JSON imports widen literal types; the panel validates the shape it renders.
        return Promise.resolve((typedPairs.has(pair) ? typed : comention) as ConnectionDetail);
      },
      panelLabels: { idleTitle: "notes graph" },
    });
    const chat = await chatReady;
    explorer.on("pathchange", ({ detail }) =>
      events.push({ type: "pathchange", node: detail.node?.name ?? null }),
    );
    explorer.on("panel", ({ detail }) => {
      events.push({ type: "panel", open: detail.open });
      chat?.setHidden(detail.open);
    });
    explorer.on("error", ({ detail }) => events.push({ type: "error", node: detail.code }));
    window.__explorer = { ok: true, canvasError: explorer.canvasError, hops, events };
  } catch (err) {
    window.__explorer = { ok: false, error: String(err) };
  }
}

void main();
