// ClaimCard meta geometry in real Chromium: one fixed two-row layout at every
// width (confidence | view source on row 1, validity | source date on row 2),
// status labels in a strip above the sentence, and a source link whose tap
// area is at least 44px tall. jsdom has no layout, so this is proven here.
// Renders the BUILT dist/trust entry with the real @qball-inc/tokens CSS.
// Needs the built dist/ (`pnpm test` builds it; CI runs it first).
import { existsSync, readFileSync } from "node:fs";
import { join, normalize, resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";

const ORIGIN = "http://elements.test";
const DIST = resolve(process.cwd(), "dist");
const TOKENS = resolve(process.cwd(), "..", "tokens");

const PAGE = `<!doctype html>
<html lang="en" data-theme="light">
  <head>
    <meta name="viewport" content="width=device-width">
    <link rel="stylesheet" href="/tokens/colors_and_type.css">
    <link rel="stylesheet" href="/tokens/components.css">
    <style>body{margin:0;padding:16px;display:flex;flex-direction:column;gap:12px}</style>
  </head>
  <body>
    <script type="module">
      import { renderClaimCard } from "/dist/trust/index.js";
      const source = (o) => ({ episode_id: "ep-1", title: "Notes", url: "https://example.org/notes",
        source_type: "github", save_date: "2026-06-11", ...o });
      const claim = (o) => ({ claim_id: 1, claim_text: "The server runs on the local machine.",
        confidence: 0.81, confidence_tier: "high", valid_from: "2026-04-12", source: source(), ...o });
      const superseded = claim({ claim_id: 10, valid_to: "2026-06-11", superseded_by_claim_id: 11,
        endorsement_tier: "owner", verification: "checked" });
      const cards = {
        plain: renderClaimCard(claim()),
        marks: renderClaimCard(claim({ endorsement_tier: "owner", verification: "checked" })),
        superseded: renderClaimCard(superseded, {
          replacement: { kind: "available", claim: claim({ claim_id: 11 }) },
        }),
        unavailable: renderClaimCard(claim({ source: { kind: "unavailable", episode_id: null } })),
        inert: renderClaimCard(claim({ source: source({ url: "javascript:void 0" }) })),
        // An inert source has no host, so its name is at most the longest built-in platform label.
        "inert-long": renderClaimCard(
          claim({ source: source({ url: "ftp://x", source_type: "huggingface" }) }),
        ),
      };
      for (const [name, card] of Object.entries(cards)) {
        card.dataset.variant = name;
        document.body.append(card);
      }
      window.__ready = true;
    </script>
  </body>
</html>`;

declare global {
  interface Window {
    __ready?: boolean;
  }
}

const VARIANTS = ["plain", "marks", "superseded", "unavailable", "inert", "inert-long"] as const;
type Variant = (typeof VARIANTS)[number];

interface Box {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

interface Geometry {
  meta: Box;
  conf: Box;
  valid: Box;
  src: Box;
  label: Box | null;
  date: Box | null;
  text: Box;
  tags: Box | null;
  validParts: Box[];
  lineHeight: number;
}

async function load(page: Page, width: number): Promise<void> {
  await page.setViewportSize({ width, height: 900 });
  const pageErrors: string[] = [];
  page.on("pageerror", (err) => pageErrors.push(err.message));
  await page.route(`${ORIGIN}/**`, async (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname === "/") {
      await route.fulfill({ contentType: "text/html", body: PAGE });
      return;
    }
    const [base, prefix, type] = pathname.startsWith("/dist/")
      ? [DIST, "/dist/", "text/javascript"]
      : [TOKENS, "/tokens/", "text/css"];
    const file = normalize(join(base, pathname.slice(prefix.length)));
    if (pathname.startsWith(prefix) && file.startsWith(base) && existsSync(file)) {
      await route.fulfill({ contentType: type, body: readFileSync(file) });
    } else {
      await route.fulfill({ status: 404, body: "not found" });
    }
  });
  await page.goto(`${ORIGIN}/`);
  await page.waitForFunction(() => window.__ready === true);
  await page.evaluate(() => document.fonts.ready);
  expect(pageErrors).toEqual([]);
}

function geometry(page: Page, variant: Variant): Promise<Geometry> {
  return page.evaluate((name) => {
    const card = document.querySelector<HTMLElement>(`[data-variant="${name}"]`);
    if (card === null) throw new Error(`card ${name} missing`);
    const box = (node: Element | null): Box | null => {
      if (node === null) return null;
      const r = node.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
    };
    const need = (selector: string): Box => {
      const b = box(card.querySelector(selector));
      if (b === null) throw new Error(`${selector} missing in ${name}`);
      return b;
    };
    const conf = need(".claim__conf");
    return {
      meta: need(".claim__meta"),
      conf,
      valid: need(".claim__valid"),
      src: need(".claim__src"),
      label: box(card.querySelector(".claim__src-label")),
      date: box(card.querySelector(".claim__src-date")),
      text: need(".claim__text"),
      tags: box(card.querySelector(".claim__tags")),
      validParts: [...card.querySelectorAll(".claim__valid > span")].map((s) => box(s) as Box),
      // The confidence cell is always one line: its height is the meta's line box.
      lineHeight: conf.bottom - conf.top,
    };
  }, variant);
}

const near = (a: number, b: number, tolerance = 2): boolean => Math.abs(a - b) <= tolerance;

test.beforeAll(() => {
  if (!existsSync(join(DIST, "trust", "index.js"))) {
    throw new Error(
      `${DIST}/trust/index.js missing — build @qball-inc/elements first (pnpm test).`,
    );
  }
});

for (const width of [320, 390, 1024]) {
  test.describe(`at ${width}px`, () => {
    test.beforeEach(async ({ page }) => {
      await load(page, width);
    });

    test("every card keeps the same two-row meta: confidence | source over validity | date", async ({
      page,
    }) => {
      for (const variant of VARIANTS) {
        const g = await geometry(page, variant);
        // Left column: confidence on row 1, validity directly below it, same left edge.
        expect(near(g.conf.left, g.meta.left), `${variant} confidence left`).toBe(true);
        expect(near(g.valid.left, g.meta.left), `${variant} validity left`).toBe(true);
        expect(g.valid.top, `${variant} validity below confidence`).toBeGreaterThanOrEqual(
          g.conf.bottom - 1,
        );
        // Right column: the source block is flush right and starts on row 1.
        expect(near(g.src.right, g.meta.right), `${variant} source flush right`).toBe(true);
        expect(near(g.src.top, g.conf.top, 3), `${variant} source starts on row 1`).toBe(true);
        expect(g.src.left, `${variant} columns never overlap`).toBeGreaterThan(g.conf.right);
        // Nothing spills out of the card's meta box.
        for (const [part, b] of Object.entries({ conf: g.conf, valid: g.valid, src: g.src })) {
          expect(b.right, `${variant} ${part} inside meta`).toBeLessThanOrEqual(g.meta.right + 0.5);
        }
        // Linked and inert sources: label on row 1, date on row 2 — aligned with the left cells.
        if (g.label !== null && g.date !== null) {
          expect(near(g.label.top, g.conf.top, 3), `${variant} label on row 1`).toBe(true);
          expect(near(g.date.top, g.valid.top, 3), `${variant} date on row 2`).toBe(true);
          expect(near(g.label.right, g.date.right), `${variant} label/date right-aligned`).toBe(
            true,
          );
        }
      }
    });

    test("status labels sit in a strip above the sentence, only when present", async ({ page }) => {
      for (const variant of VARIANTS) {
        const g = await geometry(page, variant);
        if (variant === "marks" || variant === "superseded") {
          expect(g.tags, `${variant} has a tag strip`).not.toBeNull();
          expect(g.tags?.bottom ?? Infinity).toBeLessThanOrEqual(g.text.top);
        } else {
          expect(g.tags, `${variant} has no tag strip`).toBeNull();
        }
      }
    });

    test("the superseded date range breaks only before the end date", async ({ page }) => {
      const g = await geometry(page, "superseded");
      expect(g.validParts).toHaveLength(2);
      const [from, to] = g.validParts as [Box, Box];
      const oneLine = near(from.top, to.top);
      // Either one line, or the end date wrapped whole onto exactly one more line.
      if (!oneLine) {
        expect(near(to.left, g.valid.left)).toBe(true);
        expect(to.top).toBeGreaterThanOrEqual(from.bottom - 1);
      }
      expect(g.valid.bottom - g.valid.top).toBeLessThan(g.lineHeight * 2.5);
      if (width >= 1024) expect(oneLine).toBe(true);
    });

    test("an unavailable source holds the right slot with no date; two lines on a phone", async ({
      page,
    }) => {
      const g = await geometry(page, "unavailable");
      expect(g.date).toBeNull();
      const lines = Math.round((g.src.bottom - g.src.top) / g.lineHeight);
      expect(lines).toBe(width <= 720 ? 2 : 1);
    });

    test("the whole source block is one link with a tap area at least 44px tall", async ({
      page,
    }) => {
      const link = page.locator('[data-variant="plain"] a.claim__src');
      await expect(link).toHaveAttribute("aria-label", "View source: GitHub, 2026-06-11");
      const g = await geometry(page, "plain");
      const hit = await page.evaluate(
        ({ x, top, bottom }) => {
          const a = document.querySelector('[data-variant="plain"] a.claim__src');
          const inLink = (y: number): boolean => {
            const target = document.elementFromPoint(x, y);
            return target !== null && a !== null && a.contains(target);
          };
          let lo = top;
          while (inLink(lo - 1)) lo -= 1;
          let hi = bottom;
          while (inLink(hi + 1)) hi += 1;
          return hi - lo;
        },
        { x: g.src.right - 4, top: g.src.top + 2, bottom: g.src.bottom - 2 },
      );
      expect(hit).toBeGreaterThanOrEqual(44);
      // Both lines are inside the one link.
      expect(await link.locator(".claim__src-label").count()).toBe(1);
      expect(await link.locator(".claim__src-date").count()).toBe(1);
    });
  });
}
