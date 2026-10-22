// GraphExplorer in real Chromium (SwiftShader WebGL) with the real tokens CSS:
// desktop mouse and 390px touch, on a light AND a dark host page. Selections
// are real clicks/taps on rendered nodes (the canvas writes each always-on
// label at its node's projected point); the panel, pill, chips, crumbs and
// keyboard path are driven by real input too. Computed colours prove the
// whole frame is the dark stage on either page theme; a sibling with a
// z-index proves the frame's stacking never escapes. Renders the BUILT
// dist/graph entry (`pnpm test` builds it).
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, join, normalize, resolve, sep } from "node:path";
import { expect, test, type Page } from "@playwright/test";

const ORIGIN = "http://elements.test";
const DIST = resolve(process.cwd(), "dist");
const TOKENS = resolve(process.cwd(), "..", "tokens");
const FIXTURES = resolve(process.cwd(), "..", "..", "fixtures", "qubrain");
const THREE_BUILD_DIR = dirname(createRequire(import.meta.url).resolve("three"));

const page = (theme: string, height: number) => `<!doctype html>
<html lang="en" data-theme="${theme}">
  <head>
    <meta name="viewport" content="width=device-width">
    <link rel="stylesheet" href="/tokens/colors_and_type.css">
    <link rel="stylesheet" href="/tokens/components.css">
    <link rel="stylesheet" href="/tokens/graph.css">
    <style>
      html,body{margin:0}body{background:var(--bg-primary);padding:8px}
      #host{height:${height}px}
      #sibling{position:absolute;z-index:5;top:140px;right:60px;width:200px;height:60px;background:var(--bg-surface)}
    </style>
    <script type="importmap">{ "imports": { "three": "/three/three.module.js" } }</script>
  </head>
  <body>
    <div id="host"></div>
    <div id="sibling">sibling</div>
    <script type="module">
      import { GraphExplorer } from "/dist/graph/index.js";
      const json = (p) => fetch(p).then((r) => r.json());
      const host = document.getElementById("host");
      const bundle = await json("/fixtures/mock-bundle.with-layout.json");
      const taxonomy = await json("/fixtures/taxonomy.json");
      const typed = await json("/fixtures/detail/typed-connection.json");
      const comention = await json("/fixtures/detail/comention-connection.json");
      const typedPairs = new Set(bundle.typed_edges.flatMap((e) => [e.a + ":" + e.b, e.b + ":" + e.a]));
      const events = [];
      const hops = [];
      host.addEventListener("pathchange", (e) =>
        events.push({ type: "pathchange", node: e.detail.node && e.detail.node.name, path: e.detail.path.map((n) => n.name) }));
      host.addEventListener("panel", (e) => events.push({ type: "panel", open: e.detail.open }));
      host.addEventListener("error", (e) => events.push({ type: "error", code: e.detail.code }));
      const detail = ({ from, to }) => {
        hops.push([from.name, to.name]);
        return Promise.resolve(typedPairs.has(from.id + ":" + to.id) ? typed : comention);
      };
      let handle = null;
      window.__gx = {
        events, hops,
        async mount(options = {}) {
          try {
            handle = await GraphExplorer.mount(host, {
              bundle, taxonomy, detail, panelLabels: { idleTitle: "explorer" }, ...options,
            });
            return { ok: true, canvas: handle.canvas !== null, error: handle.canvasError };
          } catch (error) {
            return { ok: false, message: String(error && error.message) };
          }
        },
        settled: () => (handle.canvas ? handle.canvas.settled.then(() => true) : true),
        select: (name, options) => handle.select(name, options),
        path: () => handle.path.map((n) => n.name),
        open: () => handle.panelOpen,
        swap(revision) {
          const next = structuredClone(bundle);
          next.revision = revision;
          handle.setData(next);
        },
      };
      window.__ready = true;
    </script>
  </body>
</html>`;

interface Driver {
  events: { type: string; node?: string | null; path?: string[]; open?: boolean; code?: string }[];
  hops: [string, string][];
  mount(
    options?: Record<string, unknown>,
  ): Promise<{ ok: boolean; canvas?: boolean; error?: string | null }>;
  settled(): Promise<boolean>;
  select(name: string, options?: { openPanel?: boolean }): boolean;
  path(): string[];
  open(): boolean;
  swap(revision: string): void;
}

declare global {
  interface Window {
    __gx: Driver;
  }
}

function serveFrom(root: string, rest: string): string | null {
  const file = normalize(join(root, rest));
  return file.startsWith(root + sep) && existsSync(file) ? file : null;
}

async function load(p: Page, theme: string, height = 640): Promise<void> {
  await p.route(`${ORIGIN}/**`, async (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname === "/") {
      await route.fulfill({ contentType: "text/html", body: page(theme, height) });
      return;
    }
    if (pathname.startsWith("/three/")) {
      const file = join(THREE_BUILD_DIR, basename(pathname));
      await route.fulfill({ contentType: "text/javascript", body: readFileSync(file) });
      return;
    }
    for (const [prefix, root] of [
      ["/dist/", DIST],
      ["/tokens/", TOKENS],
      ["/fixtures/", FIXTURES],
    ] as const) {
      if (!pathname.startsWith(prefix)) continue;
      const file = serveFrom(root, pathname.slice(prefix.length));
      if (file === null) break;
      const type = file.endsWith(".css")
        ? "text/css"
        : file.endsWith(".json")
          ? "application/json"
          : "text/javascript";
      await route.fulfill({ contentType: type, body: readFileSync(file) });
      return;
    }
    await route.fulfill({ status: 404, body: "not found" });
  });
  await p.goto(`${ORIGIN}/`);
  await p.waitForFunction(() => (window as unknown as { __ready?: boolean }).__ready === true);
}

async function mounted(p: Page, theme: string, options: Record<string, unknown> = {}) {
  await load(p, theme);
  const result = await p.evaluate((o) => window.__gx.mount(o), options);
  expect(result).toMatchObject({ ok: true, canvas: true });
  await p.evaluate(() => window.__gx.settled());
  await frames(p);
}

const frames = (p: Page) =>
  p.evaluate(
    () =>
      new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))),
  );

/** A visible always-on label whose node point is open canvas (not under an overlay). */
async function openNode(p: Page): Promise<{ name: string; x: number; y: number }> {
  await frames(p);
  const found = await p.evaluate(() => {
    const canvasHost = document.querySelector<HTMLElement>(".gx__stage .graphcanvas")!;
    const box = canvasHost.getBoundingClientRect();
    for (const label of document.querySelectorAll<HTMLElement>(".gx .gc-label")) {
      if (label.hasAttribute("data-off")) continue;
      const x = box.left + parseFloat(label.style.left);
      const y = box.top + parseFloat(label.style.top);
      const hit = document.elementFromPoint(x, y);
      if (hit === null || !canvasHost.contains(hit)) continue;
      if (hit.closest(".gc-lgwrap, .gc-hud, .gc-error")) continue;
      return { name: label.textContent ?? "", x, y };
    }
    return null;
  });
  if (found === null) throw new Error("no open node to click");
  return found;
}

const panel = (p: Page) => p.locator(".gx__panel");
const pill = (p: Page) => p.locator(".gx__pshow");
const crumbs = (p: Page) => p.locator(".epanel__crumbs button");
const lastPath = (p: Page) =>
  p.evaluate(() => window.__gx.events.filter((e) => e.type === "pathchange").at(-1)?.path ?? null);

for (const theme of ["light", "dark"]) {
  test.describe(`desktop mouse · ${theme} page`, () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    test("click selects and auto-opens the panel; a typed connection row narrates the hop in claims; a crumb steps back", async ({
      page: p,
    }) => {
      await mounted(p, theme);
      await expect(panel(p)).toHaveClass(/is-hidden/);
      const target = await openNode(p);
      await p.mouse.click(target.x, target.y);
      await expect(panel(p)).not.toHaveClass(/is-hidden/);
      await expect(pill(p)).toBeHidden();
      await expect(crumbs(p)).toHaveText([target.name]);
      const row = p.locator(".epanel__rows .nrow:has(.nrow__kind--typed)").first();
      const next = (await row.locator(".nrow__name").textContent())!;
      await row.click();
      await expect(crumbs(p)).toHaveText([target.name, next]);
      await expect(p.locator(".epanel__hop .epanel__hlabel").first()).toHaveText(
        `${target.name} → ${next} · the graph asserts`,
      );
      await expect(p.locator(".epanel__hop .claim").first()).toBeVisible();
      expect(await p.evaluate(() => window.__gx.hops.at(-1))).toEqual([target.name, next]);
      await crumbs(p).first().click();
      await expect(crumbs(p)).toHaveText([target.name]);
      expect(await lastPath(p)).toEqual([target.name]);
      expect(await p.evaluate(() => document.body.className)).toBe("");
    });

    test("hide slides the panel away to the pill, which reopens it", async ({ page: p }) => {
      await mounted(p, theme);
      const target = await openNode(p);
      await p.mouse.click(target.x, target.y);
      await p.locator(".gx__phide").click();
      await expect(panel(p)).toHaveClass(/is-hidden/);
      await expect(pill(p)).toHaveText("◂ details");
      await expect(pill(p)).toBeFocused();
      await pill(p).click();
      await expect(panel(p)).not.toHaveClass(/is-hidden/);
      expect(
        await p.evaluate(() =>
          window.__gx.events.filter((e) => e.type === "panel").map((e) => e.open),
        ),
      ).toEqual([true, false, true]);
    });
  });

  test.describe(`390px touch · ${theme} page`, () => {
    test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });

    test("tap selects without opening the sheet; the pill names the entity and opens the sheet; hide ▾ closes it", async ({
      page: p,
    }) => {
      await mounted(p, theme);
      const target = await openNode(p);
      await p.touchscreen.tap(target.x, target.y);
      await expect.poll(() => lastPath(p)).toEqual([target.name]);
      await expect(panel(p)).toHaveClass(/is-hidden/);
      await expect(pill(p).locator("b")).toHaveText(target.name);
      await expect(pill(p)).toHaveCSS("text-transform", "uppercase");
      await expect(pill(p).locator("b")).toHaveCSS("text-transform", "none");
      await p.addStyleTag({ content: "*{transition:none!important}" });
      await pill(p).tap();
      await expect(panel(p)).not.toHaveClass(/is-hidden/);
      // near-full bottom sheet: 12px side gutters, 44px from the top, 12px from the bottom
      const frame = (await p.locator(".gx").boundingBox())!;
      const sheet = (await panel(p).boundingBox())!;
      expect(Math.round(sheet.x - frame.x)).toBe(13);
      expect(Math.round(sheet.y - frame.y)).toBe(45);
      expect(Math.round(frame.y + frame.height - (sheet.y + sheet.height))).toBe(13);
      await expect(p.locator(".gx__phide")).toHaveText("hide ▾");
      await p.locator(".gx__phide").tap();
      await expect(panel(p)).toHaveClass(/is-hidden/);
    });
  });

  for (const form of ["desktop", "phone"] as const) {
    test.describe(`${form} · ${theme} page`, () => {
      test.use(
        form === "desktop"
          ? { viewport: { width: 1280, height: 800 } }
          : { hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } },
      );

      test("a facet chip filters, the toggle counts it, × clear restores", async ({ page: p }) => {
        await mounted(p, theme);
        const toggle = p.locator(".gx__ftoggle");
        await expect(toggle).toHaveText("filters ▾");
        await toggle.click();
        await expect(p.locator(".gx__facets")).not.toHaveClass(/is-collapsed/);
        await p.locator(".fchip").first().click();
        await expect(toggle).toHaveText(/^filters ▴ 1 active$/);
        await expect(p.locator(".facetbar__count")).toHaveText(
          /^\d+ (entity matches|entities match|match · \d+ unassignable)$/,
        );
        await p.locator(".facetbar__clear").click();
        await expect(toggle).toHaveText("filters ▴");
        await expect(p.locator(".facetbar__count")).toBeHidden();
      });

      test("with the filters open, the details pill (and the sheet) sit below the strip and stay usable", async ({
        page: p,
      }) => {
        await mounted(p, theme);
        await p.addStyleTag({ content: "*{transition:none!important}" });
        await p.evaluate(() => window.__gx.select("n8n"));
        if (form === "desktop") await p.locator(".gx__phide").click();
        await p.locator(".gx__ftoggle").click();
        const strip = (await p.locator(".gx__facets").boundingBox())!;
        expect(strip.height).toBeGreaterThan(44);
        await expect
          .poll(async () => (await pill(p).boundingBox())!.y)
          .toBeGreaterThanOrEqual(strip.y + strip.height);
        await pill(p).click();
        await expect(panel(p)).not.toHaveClass(/is-hidden/);
        if (form === "phone") {
          const sheet = (await panel(p).boundingBox())!;
          expect(sheet.y).toBeGreaterThanOrEqual(strip.y + strip.height);
        }
        // collapsing the filters returns the overlays to the designed 44px
        await p.locator(".gx__ftoggle").click();
        const frame = (await p.locator(".gx").boundingBox())!;
        if (form === "phone") {
          await expect
            .poll(async () => Math.round((await panel(p).boundingBox())!.y - frame.y))
            .toBe(45);
        }
      });

      test("a deep link opens the panel on this form factor too", async ({ page: p }) => {
        await mounted(p, theme);
        expect(await p.evaluate(() => window.__gx.select("n8n", { openPanel: true }))).toBe(true);
        await expect(panel(p)).not.toHaveClass(/is-hidden/);
        await expect(p.locator(".epanel__name")).toContainText("n8n");
      });

      test("a revision swap clears the path, the chips and the panel", async ({ page: p }) => {
        await mounted(p, theme);
        await p.locator(".gx__ftoggle").click();
        await p.locator(".fchip").first().click();
        // select after filtering: a chip that hides the selection clears it
        await p.evaluate(() => window.__gx.select("n8n", { openPanel: true }));
        // the state the swap must clear is really there
        await expect(crumbs(p)).toHaveText(["n8n"]);
        await expect(p.locator(".fchip[aria-pressed=true]")).toHaveCount(1);
        await expect(p.locator(".gx__ftoggle")).toHaveText(/1 active/);
        await p.evaluate(() => window.__gx.swap("swapped-r2"));
        await expect(crumbs(p)).toHaveCount(0);
        await expect(p.locator(".fchip[aria-pressed=true]")).toHaveCount(0);
        await expect(p.locator(".gx__ftoggle")).toHaveText("filters ▴");
        expect(await lastPath(p)).toEqual([]);
        await expect(p.locator(".epanel__name")).toHaveText("explorer");
      });

      test("the status line is not covered by the legend, the pill, the filters strip or the panel", async ({
        page: p,
      }) => {
        await mounted(p, theme);
        await p.addStyleTag({ content: "*{transition:none!important}" });
        const status = (await p.locator(".gx .gc-status").boundingBox())!;
        expect(status.width).toBeGreaterThan(0);
        const clear = async (state: string, selectors: string[]) => {
          for (const sel of selectors) {
            const box = await p.locator(sel).boundingBox();
            expect(box, `${state}: ${sel} is not rendered`).not.toBeNull();
            const overlaps =
              box!.x < status.x + status.width &&
              status.x < box!.x + box!.width &&
              box!.y < status.y + status.height &&
              status.y < box!.y + box!.height;
            expect(overlaps, `${state}: ${sel} overlaps the status line`).toBe(false);
          }
        };
        const legend = form === "desktop" ? ".gx .gc-legend" : ".gx .gc-lgbtn";
        await clear("on mount", [legend, ".gx__pshow", ".gx__facets"]);
        await p.locator(".gx__ftoggle").click();
        await clear("filters open", [legend, ".gx__pshow", ".gx__facets"]);
        if (form === "desktop") {
          await p.evaluate(() => window.__gx.select("n8n"));
          await clear("panel open", [legend, ".gx__panel", ".gx__facets"]);
        }
      });
    });
  }

  test(`the whole frame is the dark stage on a ${theme} page`, async ({ page: p }) => {
    await mounted(p, theme);
    await p.evaluate(() => window.__gx.select("n8n", { openPanel: true }));
    const read = await p.evaluate(() => {
      const css = (sel: string, prop: string) =>
        getComputedStyle(document.querySelector(sel)!).getPropertyValue(prop);
      return {
        frameBg: css(".gx", "background-color"),
        panelMeta: css(".gx__panel .epanel__meta", "color"),
        toggle: css(".gx__ftoggle", "color"),
        canvasBg: css(".gx .graphcanvas", "background-color"),
        status: css(".gx .gc-status", "color"),
        frameText: css(".gx", "color"),
        panelText: css(".gx__panel", "color"),
        pageText: css("body", "color"),
      };
    });
    // Wrapper text never inherits the page body's colour.
    expect(read.frameText).toBe("rgb(231, 224, 214)"); // --stage-panel-text-primary #E7E0D6
    expect(read.panelText).toBe("rgb(231, 224, 214)");
    if (theme === "light") expect(read.pageText).not.toBe(read.frameText);
    expect(read.frameBg).toBe("rgb(30, 29, 27)"); // --stage-panel-bg #1E1D1B
    expect(read.panelMeta).toBe("rgb(205, 198, 187)"); // --stage-panel-text-secondary #CDC6BB
    expect(read.toggle).toBe("rgb(138, 132, 125)"); // --stage-panel-text-muted #8A847D
    expect(read.canvasBg).toBe("rgb(18, 22, 31)"); // --stage-bg #12161F
    expect(read.status).toBe("rgb(168, 162, 158)"); // --stage-text-muted #A8A29E
  });
}

test.describe("frame", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("internal z-indices never escape: a z-index:5 sibling stays above the open panel", async ({
    page: p,
  }) => {
    await mounted(p, "light");
    await p.evaluate(() => window.__gx.select("n8n", { openPanel: true }));
    await expect(p.locator(".gx")).toHaveCSS("isolation", "isolate");
    await p.addStyleTag({ content: "*{transition:none!important}" });
    const sibling = (await p.locator("#sibling").boundingBox())!;
    const panelBox = (await panel(p).boundingBox())!;
    const x = sibling.x + sibling.width / 2;
    const y = sibling.y + sibling.height / 2;
    // the point is inside the open panel (z-index 8 inside the frame)
    expect(x).toBeGreaterThan(panelBox.x);
    expect(y).toBeGreaterThan(panelBox.y);
    expect(y).toBeLessThan(panelBox.y + panelBox.height);
    const hit = await p.evaluate(([px, py]) => document.elementFromPoint(px!, py!)?.id, [x, y]);
    expect(hit).toBe("sibling");
  });

  test("keyboard only after a deep link: rows, crumbs and Esc; a hidden panel takes no focus", async ({
    page: p,
  }) => {
    await mounted(p, "dark");
    // Hidden: Tab never lands inside the panel.
    for (let i = 0; i < 12; i++) {
      await p.keyboard.press("Tab");
      expect(await p.evaluate(() => !!document.activeElement?.closest(".gx__panel"))).toBe(false);
    }
    await p.evaluate(() => window.__gx.select("n8n", { openPanel: true }));
    await p.locator(".gx__phide").focus();
    let onRow = false;
    for (let i = 0; i < 20 && !onRow; i++) {
      await p.keyboard.press("Tab");
      onRow = await p.evaluate(
        () => !!document.activeElement?.matches(".epanel__rows .nrow:not(.nrow--more)"),
      );
    }
    expect(onRow).toBe(true);
    const next = await p.evaluate(
      () => document.activeElement!.querySelector(".nrow__name")!.textContent,
    );
    await p.keyboard.press("Enter");
    await expect(crumbs(p)).toHaveText(["n8n", next]);
    await crumbs(p).first().focus();
    await p.keyboard.press("Enter");
    await expect(crumbs(p)).toHaveText(["n8n"]);
    await p.keyboard.press("Escape");
    await expect(crumbs(p)).toHaveCount(0);
    expect(await lastPath(p)).toEqual([]);
  });

  test("no WebGL: the canvas error figure shows, chips and panel still work, nothing throws", async ({
    page: p,
  }) => {
    const errors: string[] = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.addInitScript(() => {
      const proto = HTMLCanvasElement.prototype;
      const original = Reflect.get(proto, "getContext") as (
        this: HTMLCanvasElement,
        ...args: unknown[]
      ) => unknown;
      Reflect.set(proto, "getContext", function (this: HTMLCanvasElement, ...args: unknown[]) {
        return /webgl/i.test(String(args[0])) ? null : original.apply(this, args);
      });
    });
    await load(p, "light");
    const result = await p.evaluate(() => window.__gx.mount());
    expect(result).toEqual({ ok: true, canvas: false, error: "webgl-unavailable" });
    await expect(p.locator(".gx .gc-error")).toBeVisible();
    await p.locator(".gx__ftoggle").click();
    await p.locator(".fchip").first().click();
    await expect(p.locator(".gx__ftoggle")).toHaveText(/1 active/);
    await pill(p).click();
    await expect(panel(p)).not.toHaveClass(/is-hidden/);
    await expect(p.locator(".epanel__name")).toHaveText("explorer");
    expect(await p.evaluate(() => window.__gx.select("n8n"))).toBe(false);
    expect(errors).toEqual([]);
  });
});
