// Shared page harness for the GraphCanvas browser specs. Serves the BUILT
// dist/graph entry, the real @qball-inc/tokens CSS, the installed three build
// (via an import map) and the QuBrain mock bundles over an intercepted origin
// (no dev server). The page exposes a small driver on `window.__gc` so specs
// can mount with options and read events; every interaction the specs assert
// on is real browser input on the rendered canvas.
// Needs the built dist/ (`pnpm test` builds it).
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, join, normalize, resolve, sep } from "node:path";
import type { Page } from "@playwright/test";

export const ORIGIN = "http://elements.test";
const DIST = resolve(process.cwd(), "dist");
const TOKENS = resolve(process.cwd(), "..", "tokens");
const FIXTURES = resolve(process.cwd(), "..", "..", "fixtures", "qubrain");
const PERF = resolve(process.cwd(), "perf");
const THREE_BUILD_DIR = dirname(createRequire(import.meta.url).resolve("three"));

/** The full mock bundle with precomputed positions: renders without a settle. */
export const LAYOUT_BUNDLE = "mock-bundle.with-layout.json";
/** The fixture of record (`layout: null`): the canvas settles it live. */
export const LIVE_BUNDLE = "mock-bundle.json";

export interface HarnessOptions {
  /** Host size in CSS px. */
  width?: number;
  height?: number;
  /** Serve three from a missing path so the lazy import rejects. */
  breakThree?: boolean;
  /** Hold the three module response until `releaseThree()` is called. */
  holdThree?: boolean;
  /** A Content-Security-Policy header for the page (e.g. to block workers). */
  csp?: string;
}

export interface Harness {
  /** Releases a held three response (only with `holdThree`). */
  releaseThree(): void;
}

function page(width: number, height: number, breakThree: boolean): string {
  const threePath = breakThree ? "/missing/three.module.js" : "/three/three.module.js";
  return `<!doctype html>
<html lang="en" data-theme="light">
  <head>
    <meta name="viewport" content="width=device-width">
    <link rel="stylesheet" href="/tokens/colors_and_type.css">
    <link rel="stylesheet" href="/tokens/graph.css">
    <style>html,body{margin:0}#host{width:${width}px;height:${height}px;position:relative}</style>
    <script type="importmap">{ "imports": { "three": "${threePath}" } }</script>
  </head>
  <body>
    <div id="host"></div>
    <script type="module">
      import { GraphCanvas, GraphCanvasError } from "/dist/graph/index.js";
      const host = document.getElementById("host");
      const events = [];
      for (const type of ["select", "clear", "filter", "retry", "error"]) {
        host.addEventListener(type, (e) => events.push({ type, detail: e.detail }));
      }
      const bundles = {};
      const load = async (name) => (bundles[name] ??= await fetch("/fixtures/" + name).then((r) => r.json()));
      let handle = null;
      window.__gc = {
        events,
        async mount(name, options = {}) {
          try {
            handle = await GraphCanvas.mount(host, { ...options, data: await load(name) });
            return { ok: true };
          } catch (error) {
            return {
              ok: false,
              typed: error instanceof GraphCanvasError,
              code: error && error.code,
              message: String(error && error.message),
            };
          }
        },
        settled: () => handle.settled.then(() => true),
        select: (idOrName) => handle.select(idOrName),
        expand: () => handle.expandNeighbors(),
        clear: () => handle.clearSelection(),
        filterClass: (cls) => handle.setFilter(cls === null ? null : (n) => n.cls === cls),
        filterNone: () => handle.setFilter(() => false),
        async setData(name, revision) {
          const next = structuredClone(await load(name));
          if (revision) next.revision = revision;
          handle.setData(next);
        },
        destroy: () => handle.destroy(),
        snapshotDate: () => handle.snapshotDate,
      };
      window.__ready = true;
    </script>
  </body>
</html>`;
}

function serveFrom(root: string, rest: string): string | null {
  const file = normalize(join(root, rest));
  return file.startsWith(root + sep) && existsSync(file) ? file : null;
}

const TYPES: Record<string, string> = {
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".map": "application/json",
};
const typeOf = (file: string): string => TYPES[file.slice(file.lastIndexOf("."))] ?? "text/plain";

/** Routes the harness origin and opens the page; resolves once the driver is ready. */
export async function openHarness(p: Page, options: HarnessOptions = {}): Promise<Harness> {
  const { width = 900, height = 600, breakThree = false, holdThree = false, csp } = options;
  let release: () => void = () => undefined;
  const held = new Promise<void>((done) => {
    release = done;
  });
  await p.route(`${ORIGIN}/**`, async (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname === "/") {
      await route.fulfill({
        contentType: "text/html",
        headers: csp === undefined ? {} : { "Content-Security-Policy": csp },
        body: page(width, height, breakThree),
      });
      return;
    }
    const roots: [string, string][] = [
      ["/dist/", DIST],
      ["/tokens/", TOKENS],
      ["/fixtures/", FIXTURES],
      ["/perf/", PERF],
    ];
    for (const [prefix, root] of roots) {
      if (!pathname.startsWith(prefix)) continue;
      const file = serveFrom(root, pathname.slice(prefix.length));
      if (file === null) break;
      await route.fulfill({ contentType: typeOf(file), body: readFileSync(file) });
      return;
    }
    if (pathname.startsWith("/three/")) {
      if (holdThree && basename(pathname) === "three.module.js") await held;
      const file = join(THREE_BUILD_DIR, basename(pathname));
      await route.fulfill({ contentType: "text/javascript", body: readFileSync(file) });
      return;
    }
    await route.fulfill({ status: 404, body: "not found" });
  });
  await p.goto(`${ORIGIN}/`);
  await p.waitForFunction(() => (window as unknown as { __ready?: boolean }).__ready === true);
  return { releaseThree: () => release() };
}

export interface MountResult {
  ok: boolean;
  typed?: boolean;
  code?: string;
  message?: string;
}

export interface CanvasEvent {
  type: string;
  detail: {
    node?: { name: string; cls: string };
    neighbors?: { node: { name: string }; typed: boolean }[];
    total?: number;
    matches?: number;
    code?: string;
  };
}

interface Driver {
  events: CanvasEvent[];
  mount(name: string, options?: Record<string, unknown>): Promise<MountResult>;
  settled(): Promise<boolean>;
  select(idOrName: number | string): boolean;
  expand(): boolean;
  clear(): void;
  filterClass(cls: string | null): number;
  filterNone(): number;
  setData(name: string, revision?: string): Promise<void>;
  destroy(): void;
  snapshotDate(): string;
}

declare global {
  interface Window {
    __gc: Driver;
  }
}

export const mountCanvas = (p: Page, name: string, options: Record<string, unknown> = {}) =>
  p.evaluate(([n, o]) => window.__gc.mount(n, o), [name, options] as const);

/**
 * Waits two animation frames. The canvas repaints labels on the frame after a
 * state change (select, filter, mount), so DOM label reads must follow one.
 */
export const nextFrames = (p: Page) =>
  p.evaluate(
    () =>
      new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))),
  );

export const settle = (p: Page) => p.evaluate(() => window.__gc.settled());

export const events = (p: Page) => p.evaluate(() => window.__gc.events);

export interface PlacedLabel {
  name: string;
  /** Page coordinates of the node the label marks. */
  x: number;
  y: number;
}

/**
 * Visible always-on labels with the page position of the node each one marks.
 * The engine writes a label's left/top as its node's projected screen point,
 * so these are real on-screen node positions. Waits for the repaint that
 * follows any state change or input first.
 */
export const visibleLabels = async (p: Page): Promise<PlacedLabel[]> => {
  await nextFrames(p);
  return p.evaluate(() => {
    const host = document.getElementById("host")!.getBoundingClientRect();
    return [...document.querySelectorAll<HTMLElement>("#host .gc-label")]
      .filter((label) => !label.hasAttribute("data-off"))
      .map((label) => ({
        name: label.textContent ?? "",
        x: host.left + parseFloat(label.style.left),
        y: host.top + parseFloat(label.style.top),
      }));
  });
};

/** Label positions keyed by name (for measuring camera moves). */
export async function labelMap(p: Page): Promise<Map<string, PlacedLabel>> {
  return new Map((await visibleLabels(p)).map((label) => [label.name, label]));
}

/** Labels visible in both snapshots. */
export function shared(
  a: Map<string, PlacedLabel>,
  b: Map<string, PlacedLabel>,
): [PlacedLabel, PlacedLabel][] {
  return [...a.values()].flatMap((la) => {
    const lb = b.get(la.name);
    return lb ? [[la, lb] as [PlacedLabel, PlacedLabel]] : [];
  });
}

/** Mean distance of the given points from their centroid (the cloud's spread). */
export function spread(points: readonly { x: number; y: number }[]): number {
  const cx = points.reduce((s, p) => s + p.x, 0) / points.length;
  const cy = points.reduce((s, p) => s + p.y, 0) / points.length;
  return points.reduce((s, p) => s + Math.hypot(p.x - cx, p.y - cy), 0) / points.length;
}

/** Screenshot style that hides the DOM overlay, so only the WebGL drawing is read. */
const HIDE_OVERLAY =
  "#host :is(.gc-labels, .gc-hud, .gc-chip, .gc-hover, .gc-legend, .gc-lgwrap){visibility:hidden!important}";

/**
 * Counts canvas pixels drawn in each colour over the stage, from a real
 * screenshot decoded and counted in the page. Points and lines are blended
 * with the stage (alpha, fog), so a pixel counts toward a colour when it lies
 * on the stage→colour blend line at least `minMix` of the way along, within
 * `distance` of it (RGB units). Also returns how many pixels are bare stage.
 */
export async function countBlends(
  p: Page,
  stage: readonly [number, number, number],
  colors: readonly (readonly [number, number, number])[],
  { minMix = 0.25, distance = 14 }: { minMix?: number; distance?: number } = {},
): Promise<{ total: number; stage: number; blends: number[] }> {
  const png = await p.locator("#host canvas").screenshot({ style: HIDE_OVERLAY });
  return p.evaluate(
    async ([b64, bg, cols, mix, dist]) => {
      const blob = await (await fetch(`data:image/png;base64,${b64}`)).blob();
      const bitmap = await createImageBitmap(blob);
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(bitmap, 0, 0);
      const d = ctx.getImageData(0, 0, bitmap.width, bitmap.height).data;
      const dirs = cols.map(([r, g, b]) => [r - bg[0], g - bg[1], b - bg[2]] as const);
      const blends = cols.map(() => 0);
      let bare = 0;
      for (let i = 0; i < d.length; i += 4) {
        const v = [d[i]! - bg[0], d[i + 1]! - bg[1], d[i + 2]! - bg[2]];
        if (Math.abs(v[0]!) <= 3 && Math.abs(v[1]!) <= 3 && Math.abs(v[2]!) <= 3) {
          bare++;
          continue;
        }
        dirs.forEach((u, k) => {
          const len2 = u[0] * u[0] + u[1] * u[1] + u[2] * u[2];
          const t = (v[0]! * u[0] + v[1]! * u[1] + v[2]! * u[2]) / len2;
          if (t < mix || t > 1.1) return;
          const off = Math.hypot(v[0]! - t * u[0], v[1]! - t * u[1], v[2]! - t * u[2]);
          if (off <= dist) blends[k]!++;
        });
      }
      return { total: d.length / 4, stage: bare, blends };
    },
    [png.toString("base64"), stage, colors, minMix, distance] as const,
  );
}

/**
 * Mean colour of the drawn line between two page points: samples the middle
 * half of the segment and, at each step, keeps the pixel within 2px that
 * stands out most from the stage. From a real screenshot with the DOM overlay
 * hidden, so only WebGL drawing is read.
 */
export async function segmentColors(
  p: Page,
  stage: readonly [number, number, number],
  segments: readonly { from: { x: number; y: number }; to: { x: number; y: number } }[],
): Promise<[number, number, number][]> {
  const canvas = p.locator("#host canvas");
  const box = (await canvas.boundingBox())!;
  const png = await canvas.screenshot({ style: HIDE_OVERLAY });
  return p.evaluate(
    async ([b64, bg, segs, origin]) => {
      const blob = await (await fetch(`data:image/png;base64,${b64}`)).blob();
      const bitmap = await createImageBitmap(blob);
      const off = new OffscreenCanvas(bitmap.width, bitmap.height);
      const ctx = off.getContext("2d")!;
      ctx.drawImage(bitmap, 0, 0);
      const { data, width, height } = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
      const at = (x: number, y: number): number[] => {
        const i = (Math.round(y) * width + Math.round(x)) * 4;
        return [data[i]!, data[i + 1]!, data[i + 2]!];
      };
      const lift = (c: number[]) => Math.hypot(c[0]! - bg[0], c[1]! - bg[1], c[2]! - bg[2]);
      return segs.map(({ from, to }) => {
        let r = 0;
        let g = 0;
        let b = 0;
        let n = 0;
        for (let k = 0; k <= 24; k++) {
          const t = 0.25 + (0.5 * k) / 24;
          const x = from.x + (to.x - from.x) * t - origin.x;
          const y = from.y + (to.y - from.y) * t - origin.y;
          let best: number[] | null = null;
          for (let dx = -2; dx <= 2; dx++) {
            for (let dy = -2; dy <= 2; dy++) {
              const px = x + dx;
              const py = y + dy;
              if (px < 0 || py < 0 || px >= width || py >= height) continue;
              const c = at(px, py);
              if (best === null || lift(c) > lift(best)) best = c;
            }
          }
          if (best) {
            r += best[0]!;
            g += best[1]!;
            b += best[2]!;
            n++;
          }
        }
        return [r / n, g / n, b / n] as [number, number, number];
      });
    },
    [png.toString("base64"), stage, segments, { x: box.x, y: box.y }] as const,
  );
}

/** Which of `candidates` the stage→colour blend `c` points toward (cosine of the lifts). */
export function nearestHue(
  stage: readonly [number, number, number],
  c: readonly [number, number, number],
  candidates: readonly (readonly [number, number, number])[],
): number {
  const lift = (v: readonly number[]) => [v[0]! - stage[0], v[1]! - stage[1], v[2]! - stage[2]];
  const cos = (a: number[], b: number[]) =>
    (a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!) / (Math.hypot(...a) * Math.hypot(...b) || 1);
  const scores = candidates.map((k) => cos(lift(c), lift(k)));
  return scores.indexOf(Math.max(...scores));
}

/** A CSS colour (`#rrggbb` or `rgb(...)`) resolved in the page, as [r, g, b]. */
export const tokenRgb = (p: Page, token: string): Promise<[number, number, number]> =>
  p.evaluate((name) => {
    const probe = document.createElement("div");
    probe.style.color = `var(${name})`;
    document.getElementById("host")!.append(probe);
    const [r, g, b] = getComputedStyle(probe).color.match(/\d+/g)!.map(Number);
    probe.remove();
    return [r!, g!, b!] as [number, number, number];
  }, token);
