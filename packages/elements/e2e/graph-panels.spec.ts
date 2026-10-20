// FacetFilterBar and EntityPanel in real Chromium with the real tokens CSS
// (incl. graph.css): inside the explorer root `.gx` both resolve to the dark
// stage on a light page, while a bare mount follows the page theme; the panel
// footer stays pinned while the body scrolls; the incomplete-chip mark and the
// match count meet AA contrast. jsdom has no computed styles, so this is
// proven here. Renders the BUILT dist/graph entry (`pnpm test` builds it).
import { existsSync, readFileSync } from "node:fs";
import { join, normalize, resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";

const ORIGIN = "http://elements.test";
const DIST = resolve(process.cwd(), "dist");
const TOKENS = resolve(process.cwd(), "..", "tokens");
const DETAIL = resolve(process.cwd(), "..", "..", "fixtures", "qubrain", "detail");

const PAGE = `<!doctype html>
<html lang="en" data-theme="light">
  <head>
    <link rel="stylesheet" href="/tokens/colors_and_type.css">
    <link rel="stylesheet" href="/tokens/components.css">
    <link rel="stylesheet" href="/tokens/graph.css">
    <style>
      .frame{height:360px;width:380px;display:flex;border:1px solid var(--border-strong)}
      .frame > .epanel{flex:1;min-width:0}
    </style>
  </head>
  <body>
    <div id="plainBar"></div>
    <div class="frame" id="plainPanel"></div>
    <div class="gx" id="stage" style="min-height:0;height:auto">
      <div id="stageBar"></div>
      <div class="frame" id="stagePanel"></div>
    </div>
    <script type="module">
      import { EntityPanel, FacetFilterBar } from "/dist/graph/index.js";
      const typed = await fetch("/detail/typed-superseded-with-replacement.json").then((r) => r.json());
      // Many claims, so the panel body must scroll.
      const many = { ...typed, claims: Array.from({ length: 8 }, (_, i) => ({ ...typed.claims[1], claim_id: 500 + i })) };
      const taxonomy = { domains: { a: ["x", "other"], b: ["y", "other"] } };
      const node = (id, domains, subs) => ({ id, name: "n" + id, cls: "concept", eps: 2, aliases: ["alias"], facets: { domains, sub_domains: subs } });
      const nodes = [node(1, ["a"], ["x"]), node(2, ["a", "b"], ["other"]), node(3, ["b"], ["y"])];
      const stats = { entities: 3, claims_total: 0, claims_valid: 0, claims_superseded: 0, episodes: 9,
        earliest_claim_date: "2026-01-01", latest_claim_date: "2026-07-01", snapshot_date: "2026-07-17" };
      const path = [nodes[0], nodes[2]];
      const neighbors = [{ node: nodes[1], typed: false, weight: 2 }];
      for (const [bar, panel, detail] of [["plainBar", "plainPanel", typed], ["stageBar", "stagePanel", many]]) {
        FacetFilterBar.mount(document.getElementById(bar), { nodes, taxonomy });
        EntityPanel.mount(document.getElementById(panel), { stats, detail: () => Promise.resolve(detail) })
          .show({ path, neighbors, total: 4 });
        // Press the incomplete "other" chip so the count shows.
        document.querySelector("#" + bar + " .fchip.is-incomplete").click();
      }
      await new Promise((r) => setTimeout(r, 0));
      window.__ready = true;
    </script>
  </body>
</html>`;

declare global {
  interface Window {
    __ready?: boolean;
  }
}

async function load(page: Page): Promise<void> {
  const pageErrors: string[] = [];
  page.on("pageerror", (err) => pageErrors.push(err.message));
  await page.route(`${ORIGIN}/**`, async (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname === "/") {
      await route.fulfill({ contentType: "text/html", body: PAGE });
      return;
    }
    const roots: [string, string, string][] = [
      ["/dist/", DIST, "text/javascript"],
      ["/tokens/", TOKENS, "text/css"],
      ["/detail/", DETAIL, "application/json"],
    ];
    const match = roots.find(([prefix]) => pathname.startsWith(prefix));
    if (match !== undefined) {
      const [prefix, base, type] = match;
      const file = normalize(join(base, pathname.slice(prefix.length)));
      if (file.startsWith(base) && existsSync(file)) {
        await route.fulfill({ contentType: type, body: readFileSync(file) });
        return;
      }
    }
    await route.fulfill({ status: 404, body: "not found" });
  });
  await page.goto(`${ORIGIN}/`);
  await page.waitForFunction(() => window.__ready === true);
  await expect(page.locator("#stagePanel .claim").first()).toBeVisible();
  expect(pageErrors).toEqual([]);
}

test.beforeAll(() => {
  if (!existsSync(join(DIST, "graph", "index.js"))) {
    throw new Error(
      `${DIST}/graph/index.js missing — build @qball-inc/elements first (pnpm test).`,
    );
  }
});

/** `fill` (possibly translucent rgba) composited over the opaque `under`, as rgb(). */
function over(fill: string, under: string): string {
  const [r = 0, g = 0, b = 0, a = 1] = (fill.match(/[\d.]+/g) ?? []).map(Number);
  const [r0 = 0, g0 = 0, b0 = 0] = (under.match(/[\d.]+/g) ?? []).map(Number);
  const mix = (top: number, bottom: number) => Math.round(top * a + bottom * (1 - a));
  return `rgb(${String(mix(r, r0))}, ${String(mix(g, g0))}, ${String(mix(b, b0))})`;
}

function contrast(fg: string, bg: string): number {
  const lum = (css: string): number => {
    const [r, g, b] = (css.match(/[\d.]+/g) ?? [])
      .slice(0, 3)
      .map(Number)
      .map((v) => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      }) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [hi, lo] = [lum(fg), lum(bg)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

test("inside .gx both components resolve to the dark stage on a light page; bare mounts follow the page", async ({
  page,
}) => {
  await load(page);
  const read = await page.evaluate(() => {
    // A stage token's computed colour, read from a probe outside any scope.
    const token = (name: string, prop: "color" | "backgroundColor" = "color") => {
      const probe = document.createElement("div");
      probe.style[prop] = `var(${name})`;
      document.body.append(probe);
      const value = getComputedStyle(probe)[prop];
      probe.remove();
      return value;
    };
    const style = (sel: string, prop: "color" | "backgroundColor" | "borderTopColor") =>
      getComputedStyle(document.querySelector(sel)!)[prop];
    const sides = (scope: string, panel: string) => ({
      panelBg: style(`${panel} .epanel`, "backgroundColor"),
      name: style(`${panel} .epanel__name`, "color"),
      claim: style(`${panel} .claim__text`, "color"),
      source: style(`${panel} .srcrow__title`, "color"),
      chip: style(`${scope} .fchip`, "color"),
      chipBorder: style(`${scope} .fchip`, "borderTopColor"),
    });
    return {
      stage: sides("#stageBar", "#stagePanel"),
      plain: sides("#plainBar", "#plainPanel"),
      tokens: {
        panelBg: token("--stage-panel-bg", "backgroundColor"),
        name: token("--stage-panel-text-primary"),
        chip: token("--stage-panel-text-secondary"),
        chipBorder: token("--stage-panel-border-strong"),
      },
      light: {
        panelBg: token("--bg-primary", "backgroundColor"),
        name: token("--text-primary"),
      },
    };
  });
  expect(read.stage.panelBg).toBe(read.tokens.panelBg);
  expect(read.stage.name).toBe(read.tokens.name);
  expect(read.stage.chip).toBe(read.tokens.chip);
  expect(read.stage.chipBorder).toBe(read.tokens.chipBorder);
  // ClaimCards and SourceRows inside the scope take the stage text token too.
  expect(read.stage.claim).toBe(read.tokens.name);
  expect(read.stage.source).toBe(read.tokens.name);
  expect(read.stage.claim).not.toBe(read.plain.claim);
  // The bare mount follows the light page.
  expect(read.plain.panelBg).toBe(read.light.panelBg);
  expect(read.plain.name).toBe(read.light.name);
  expect(read.stage.panelBg).not.toBe(read.plain.panelBg);
});

test("connection rows span the full list width, so dividers align and the whole row is the click target", async ({
  page,
}) => {
  await load(page);
  for (const panel of ["#plainPanel", "#stagePanel"]) {
    const widths = await page.locator(`${panel} .epanel__rows`).evaluate((list) => {
      const rows = [...list.querySelectorAll<HTMLElement>(".nrow")];
      return { list: list.clientWidth, rows: rows.map((r) => r.getBoundingClientRect().width) };
    });
    expect(widths.rows.length).toBeGreaterThanOrEqual(2); // a connection row and "show more"
    for (const w of widths.rows) expect(Math.round(w)).toBe(widths.list);
  }
});

test("the panel footer stays pinned while the body scrolls", async ({ page }) => {
  await load(page);
  const scroller = page.locator("#stagePanel .epanel__scroll");
  const footer = page.locator("#stagePanel .provfoot");
  const metrics = await scroller.evaluate((el) => ({
    scroll: el.scrollHeight,
    client: el.clientHeight,
  }));
  expect(metrics.scroll).toBeGreaterThan(metrics.client * 1.5); // precondition: it really scrolls
  const before = await footer.boundingBox();
  await scroller.evaluate((el) => el.scrollTo(0, el.scrollHeight));
  expect(await scroller.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  const after = await footer.boundingBox();
  const frame = await page.locator("#stagePanel").boundingBox();
  expect(after).toEqual(before);
  expect(after!.y + after!.height).toBeLessThanOrEqual(frame!.y + frame!.height);
  await expect(footer).toHaveText("8 claims · 1 source · revision 2026-07-17 · 0 superseded shown");
});

test("faint text (incomplete mark, count, domain names, co-mention rows, meta, headings) meets AA, on the page and on the stage", async ({
  page,
}) => {
  await load(page);
  for (const theme of ["light", "dark"]) {
    const pairs = await page.evaluate((t) => {
      const still = document.createElement("style");
      still.textContent = "*{transition:none!important}";
      document.head.append(still);
      document.documentElement.setAttribute("data-theme", t);
      const surfaces = [
        { scope: "#plain", bg: getComputedStyle(document.body).backgroundColor },
        {
          scope: "#stage",
          bg: getComputedStyle(document.getElementById("stage")!).backgroundColor,
        },
      ];
      // Faint text in both components: on the bare page and inside the stage.
      const selectors = [
        "Bar .fchip:not([aria-pressed=true]) .fchip__inc",
        "Bar .facetbar__count",
        "Bar .facetbar__dom",
        "Panel .nrow__kind--com",
        "Panel .epanel__meta",
        "Panel .epanel__hlabel",
      ];
      return surfaces.flatMap(({ scope, bg }) =>
        selectors.map((sel) => {
          const node = document.querySelector(`${scope}${sel}`);
          return {
            sel: `${scope}${sel}`,
            fg: node === null ? null : getComputedStyle(node).color,
            bg,
          };
        }),
      );
    }, theme);
    expect(pairs).toHaveLength(12);
    // On a pressed chip the mark takes the chip's own label colour (never the
    // amber that is too faint on the chip's fill), so it reads like the label.
    const pressed = await page.evaluate(() =>
      ["#plainBar", "#stageBar"].map((scope) => {
        const chip = document.querySelector(`${scope} .fchip[aria-pressed=true]`)!;
        return {
          scope,
          mark: getComputedStyle(chip.querySelector(".fchip__inc")!).color,
          label: getComputedStyle(chip).color,
          fill: getComputedStyle(chip).backgroundColor,
          under: getComputedStyle(
            scope === "#plainBar" ? document.body : document.getElementById("stage")!,
          ).backgroundColor,
        };
      }),
    );
    for (const { scope, mark, label, fill, under } of pressed) {
      expect(mark, `${theme} ${scope} pressed mark`).toBe(label);
      // The pressed label (and so the mark) meets AA on its own fill, on the
      // page in both themes and on the stage: dark fills use --signal-strong.
      expect(
        contrast(label, over(fill, under)),
        `${theme} ${scope} pressed label ${label} on ${fill}`,
      ).toBeGreaterThanOrEqual(4.5);
    }
    for (const { sel, fg, bg } of pairs) {
      if (fg === null) throw new Error(`${sel} missing`);
      expect(contrast(fg, bg), `${theme} ${sel} ${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
  }
});
