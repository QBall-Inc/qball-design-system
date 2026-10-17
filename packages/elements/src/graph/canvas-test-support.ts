// Test support for the GraphCanvas DOM tests. The canvas logic and three.js run
// for real; only the WebGL renderer — the context boundary jsdom cannot
// provide — is a recording stand-in. three's geometry/material classes are
// subclassed (not replaced) so tests can observe every GPU object a mount
// creates and whether it was disposed. Colour tokens come from the SHIPPED
// @qball-inc/tokens CSS, loaded into the jsdom document.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import * as THREE from "three";
import type { RendererFactory, RendererLike, Three } from "./scene";

const TOKENS_DIR = resolve(process.cwd(), "../tokens");

const readToken = (file: string): string => readFileSync(resolve(TOKENS_DIR, file), "utf8");

/**
 * The palette tokens as a browser computes them on a `.graphcanvas` host, read
 * from the SHIPPED CSS: graph.css maps each ordinary token onto a `--stage-*`
 * token (`--bg-primary:var(--stage-bg)`), whose value is declared on :root in
 * colors_and_type.css. jsdom neither inherits custom properties from :root nor
 * resolves var(), so tests apply these resolved values to the host inline.
 */
export function resolvedCanvasTokens(): Record<string, string> {
  const colors = readToken("colors_and_type.css");
  const graph = readToken("graph.css");
  const root = new Map(
    [...colors.matchAll(/(--stage-[a-z-]+):\s*([^;]+);/g)].map((m) => [m[1]!, m[2]!.trim()]),
  );
  const tier = /\.graphcanvas,\.graphcanvas\[data-theme\],[^{]*\{([^}]*)\}/.exec(graph)?.[1] ?? "";
  const out: Record<string, string> = {};
  for (const [, prop = "", ref = ""] of tier.matchAll(/(--[a-z-]+):var\((--stage-[a-z-]+)\)/g)) {
    const value = root.get(ref);
    if (value !== undefined) out[prop] = value;
  }
  out["--stage-hub"] = root.get("--stage-hub") ?? "";
  return out;
}

/**
 * Loads the shipped colors_and_type.css + graph.css into `doc` (label and chrome
 * rules) and applies the resolved palette tokens to `host`. Returns the remover.
 */
export function installTokenStyles(doc: Document, host?: HTMLElement): () => void {
  const style = doc.createElement("style");
  style.textContent = ["colors_and_type.css", "graph.css"].map(readToken).join("\n");
  doc.head.append(style);
  const tokens = Object.entries(resolvedCanvasTokens());
  if (host) for (const [prop, value] of tokens) host.style.setProperty(prop, value);
  return () => {
    style.remove();
    if (host) for (const [prop] of tokens) host.style.removeProperty(prop);
  };
}

export interface GpuLedger {
  readonly three: Three;
  /** Geometries and materials created through `three`, in creation order. */
  readonly created: { dispose(): void }[];
  /** Objects that have emitted three's `dispose` event. */
  readonly disposed: Set<object>;
  /** Created and not yet disposed. */
  live(): number;
}

/** A three namespace whose BufferGeometry/ShaderMaterial record creation and disposal. */
export function recordingThree(): GpuLedger {
  const created: { dispose(): void }[] = [];
  const disposed = new Set<object>();
  const track = (obj: THREE.EventDispatcher<{ dispose: object }> & { dispose(): void }): void => {
    created.push(obj);
    obj.addEventListener("dispose", () => disposed.add(obj));
  };
  class BufferGeometry extends THREE.BufferGeometry {
    constructor() {
      super();
      track(this);
    }
  }
  class ShaderMaterial extends THREE.ShaderMaterial {
    constructor(parameters?: THREE.ShaderMaterialParameters) {
      super(parameters);
      track(this);
    }
  }
  const three = { ...THREE, BufferGeometry, ShaderMaterial } as unknown as Three;
  return { three, created, disposed, live: () => created.length - disposed.size };
}

export interface RecordingRenderer extends RendererLike {
  renders: number;
  disposed: boolean;
  sizes: [number, number][];
}

/** A renderer stand-in over a real <canvas>: counts frames, sizes and disposal. */
export function recordingRendererFactory(doc: Document): {
  factory: RendererFactory;
  instances: RecordingRenderer[];
} {
  const instances: RecordingRenderer[] = [];
  const factory: RendererFactory = () => {
    const r: RecordingRenderer = {
      domElement: doc.createElement("canvas"),
      renders: 0,
      disposed: false,
      sizes: [],
      setPixelRatio() {},
      setSize(width, height) {
        r.sizes.push([width, height]);
      },
      render() {
        r.renders++;
      },
      dispose() {
        r.disposed = true;
      },
    };
    instances.push(r);
    return r;
  };
  return { factory, instances };
}

/** Net event-listener registrations per target, observed via add/removeEventListener. */
export function listenerLedger(targets: EventTarget[]): { net(): number; restore(): void } {
  const live = new Set<string>();
  const ids = new WeakMap<object, number>();
  let next = 0;
  const id = (o: object): number => {
    if (!ids.has(o)) ids.set(o, next++);
    return ids.get(o)!;
  };
  const restores: (() => void)[] = [];
  targets.forEach((target, t) => {
    const add = target.addEventListener.bind(target);
    const remove = target.removeEventListener.bind(target);
    target.addEventListener = (
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      opts?: boolean | AddEventListenerOptions,
    ) => {
      if (listener) live.add(`${t}:${type}:${id(listener)}`);
      add(type, listener, opts);
    };
    target.removeEventListener = (
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      opts?: boolean | EventListenerOptions,
    ) => {
      if (listener) live.delete(`${t}:${type}:${id(listener)}`);
      remove(type, listener, opts);
    };
    restores.push(() => {
      target.addEventListener = add;
      target.removeEventListener = remove;
    });
  });
  return { net: () => live.size, restore: () => restores.forEach((r) => r()) };
}

/** Resolves after `count` animation frames. */
export async function frames(view: Window, count: number): Promise<void> {
  for (let i = 0; i < count; i++) {
    await new Promise<void>((done) => view.requestAnimationFrame(() => done()));
  }
}

/** What the worker stand-in observed. */
export interface WorkerLedger {
  started: number;
  /** Updates handed to the canvas's message handler. */
  delivered: number;
  terminated: number;
  urlsCreated: number;
  urlsRevoked: number;
  restore: () => void;
}

/**
 * A dedicated-worker stand-in for jsdom, which has no Worker: it reads the
 * blob the canvas created, runs that REAL worker script (sim-worker-entry.ts as
 * the build inlines it) in its own V8 context (node:vm, standing in for the
 * worker's global scope), and delivers each update as a
 * message `spacingMs` apart (default: one macrotask), the way a worker thread's
 * messages arrive. Only the thread boundary is simulated.
 */
export interface StandInOptions {
  /** Fire the worker's error event instead of update k (0 = before the first message). */
  failAfter?: number;
  /** Called just before that error fires (e.g. to snapshot positions). */
  onFail?: () => void;
  /** Delay between updates; above one frame (~16 ms) the canvas applies each one. */
  spacingMs?: number;
  /** The constructor throws, as some browsers do for a CSP-blocked worker. */
  throwOnConstruct?: boolean;
  /** The worker never answers and never errors. */
  silent?: boolean;
}

export function installWorkerStandIn(
  view: Window & typeof globalThis,
  {
    failAfter,
    onFail,
    spacingMs = 0,
    throwOnConstruct = false,
    silent = false,
  }: StandInOptions = {},
): WorkerLedger {
  const blobs = new Map<string, Blob>();
  let seq = 0;
  const urls = view.URL;
  // jsdom defines neither Worker nor the blob-URL functions; restore exactly what was there.
  const previous = {
    Worker: Object.getOwnPropertyDescriptor(view, "Worker"),
    create: Object.getOwnPropertyDescriptor(urls, "createObjectURL"),
    revoke: Object.getOwnPropertyDescriptor(urls, "revokeObjectURL"),
  };
  const put = (target: object, key: string, desc: PropertyDescriptor | undefined): void => {
    if (desc) Object.defineProperty(target, key, desc);
    else Reflect.deleteProperty(target, key);
  };
  const ledger: WorkerLedger = {
    started: 0,
    delivered: 0,
    terminated: 0,
    urlsCreated: 0,
    urlsRevoked: 0,
    restore: () => {
      put(view, "Worker", previous.Worker);
      put(urls, "createObjectURL", previous.create);
      put(urls, "revokeObjectURL", previous.revoke);
    },
  };
  view.URL.createObjectURL = (blob: Blob | MediaSource) => {
    const url = `blob:stand-in/${++seq}`;
    blobs.set(url, blob as Blob);
    ledger.urlsCreated++;
    return url;
  };
  view.URL.revokeObjectURL = (url: string) => {
    if (blobs.delete(url)) ledger.urlsRevoked++;
  };
  class StandInWorker {
    onmessage: ((event: MessageEvent) => void) | null = null;
    onerror: ((event: Event) => void) | null = null;
    onmessageerror: ((event: Event) => void) | null = null;
    private dead = false;
    private readonly script: Promise<string>;

    constructor(url: string) {
      ledger.started++;
      if (throwOnConstruct) throw new view.DOMException("blocked by CSP", "SecurityError");
      const blob = blobs.get(url);
      // jsdom's Blob has no text(); its FileReader reads one.
      this.script = new Promise((done, fail) => {
        if (!blob) return fail(new Error(`no blob at ${url}`));
        const reader = new view.FileReader();
        reader.onload = () => done(typeof reader.result === "string" ? reader.result : "");
        reader.onerror = () => fail(new Error(`FileReader: ${reader.error?.message ?? "failed"}`));
        reader.readAsText(blob);
      });
    }

    postMessage(request: unknown): void {
      if (silent) return;
      void this.script.then((source) => {
        const updates: unknown[] = [];
        const scope: {
          onmessage: ((e: { data: unknown }) => void) | null;
          postMessage(u: unknown): void;
        } = {
          onmessage: null,
          postMessage: (u) => updates.push(u),
        };
        runInNewContext(source, scope);
        scope.onmessage?.({ data: structuredClone(request) });
        const deliver = (i: number): void => {
          if (this.dead) return;
          if (failAfter !== undefined && i >= failAfter) {
            onFail?.();
            this.onerror?.(new view.Event("error", { cancelable: true }));
            return;
          }
          if (i >= updates.length) return;
          ledger.delivered++;
          this.onmessage?.(new view.MessageEvent("message", { data: updates[i] }));
          setTimeout(() => deliver(i + 1), spacingMs);
        };
        setTimeout(() => deliver(0), 0);
      });
    }

    terminate(): void {
      if (!this.dead) ledger.terminated++;
      this.dead = true;
    }
  }
  view.Worker = StandInWorker as unknown as typeof Worker;
  return ledger;
}
