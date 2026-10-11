// Trust atoms through the PACKED tarballs in a real static Astro site.
// Each themed page must: carry the server-side import marker, render every
// state, resolve the packed token CSS to that theme's exact colours, keep
// hostile text and URLs inert (with a positive control proving they would
// fire), and load no three.js. The token stylesheets must land in their
// locked order. Expected colours come from the INSTALLED tokens CSS, so a
// palette change in the tokens package never needs an edit here.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";

const FIXTURE_DIR = fileURLToPath(new URL("..", import.meta.url));
const TOKENS_CSS = join(FIXTURE_DIR, "node_modules", "@qball-inc", "tokens", "colors_and_type.css");
const AXE = join(FIXTURE_DIR, "node_modules", "axe-core", "axe.min.js");
const THEMES = ["light", "dark"] as const;
type Theme = (typeof THEMES)[number];

/** Same matcher as packages/elements/src/entry-contents.test.ts, plus the renderer class. */
const THREE_REF = /\bthree\b|\bTHREE\b|WebGLRenderer/;

/** `#3F6B5B` → `rgb(63, 107, 91)`, the form getComputedStyle returns. */
function hexToRgb(hex: string): string {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (m === null) throw new Error(`not a #rrggbb colour: ${hex}`);
  const [r, g, b] = [m[1], m[2], m[3]].map((h) => parseInt(h ?? "", 16));
  return `rgb(${String(r)}, ${String(g)}, ${String(b)})`;
}

/** `rgb(63, 107, 91)` → `[63, 107, 91]`. */
function hexChannels(rgb: string): number[] {
  const m = /^rgb\((\d+), (\d+), (\d+)\)$/.exec(rgb);
  if (m === null) throw new Error(`not rgb(): ${rgb}`);
  return [m[1], m[2], m[3]].map((v) => Number(v));
}

/**
 * The colour `color-mix(in srgb, var(--a) pct%, var(--b))` resolves to, from the
 * installed token values: the deeper component inks the trust/chat atoms use on
 * tinted surfaces (WP-QB-1.6). Returned as 0–255 channels.
 */
function mixedColor(theme: Theme, a: string, pct: number, b: string): number[] {
  const ca = hexChannels(tokenColor(theme, a));
  const cb = hexChannels(tokenColor(theme, b));
  return ca.map((v, i) => v * (pct / 100) + (cb[i] ?? 0) * (1 - pct / 100));
}

/**
 * A computed colour (`rgb(...)` or `color(srgb ...)`) as 0–255 channels. Any
 * other form (e.g. the `oklab(...)` Chromium reports mid-transition) yields
 * `[]`, so a polled comparison retries instead of throwing.
 */
function channels(computed: string): number[] {
  const rgb = /^rgba?\((\d+), (\d+), (\d+)/.exec(computed);
  if (rgb !== null) return [rgb[1], rgb[2], rgb[3]].map((v) => Number(v));
  const srgb = /^color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)/.exec(computed);
  if (srgb !== null) return [srgb[1], srgb[2], srgb[3]].map((v) => Number(v) * 255);
  return [];
}

/** Largest channel difference; Infinity for a colour that did not parse (so polls retry). */
function distance(actual: string, expected: number[]): number {
  const got = channels(actual);
  if (got.length !== 3) return Number.POSITIVE_INFINITY;
  return Math.max(...expected.map((v, i) => Math.abs((got[i] ?? 0) - v)));
}

function expectNear(actual: string, expected: number[]): void {
  const got = channels(actual);
  expect(got, `unparsed colour ${actual}`).toHaveLength(3);
  expected.forEach((v, i) => {
    expect(Math.abs((got[i] ?? -999) - v), `${actual} vs ${expected.join(",")}`).toBeLessThan(1.5);
  });
}

/** Token value in the first block opened by `selector`, from the installed CSS. */
function tokenColor(theme: Theme, name: string): string {
  const css = readFileSync(TOKENS_CSS, "utf8");
  const selector = theme === "light" ? ":root {" : '[data-theme="dark"] {';
  const start = css.indexOf(selector);
  if (start < 0) throw new Error(`${selector} block not found in ${TOKENS_CSS}`);
  const block = css.slice(start, css.indexOf("}", start));
  const m = new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})`).exec(block);
  if (m?.[1] === undefined) throw new Error(`--${name} not set in the ${theme} block`);
  return hexToRgb(m[1]);
}

interface HostileResult {
  controlFired: number;
  fired: number;
  imgs: number;
  hrefs: (string | null)[];
  hostileTextShown: boolean;
}
type TrustResult = { ok: true; hostile: HostileResult } | { ok: false; error: string };

declare global {
  interface Window {
    __trust?: TrustResult;
  }
}

/** The slice of the injected axe-core API this spec uses. */
interface AxeApi {
  run(
    context: Document,
    options: { runOnly: string[] },
  ): Promise<Record<"violations" | "incomplete" | "passes", AxeRuleResult[]>>;
}

interface AxeRuleResult {
  impact?: string | null;
  help: string;
  nodes: { target: string[]; failureSummary?: string }[];
}

/** Opens a themed page, records errors/dialogs, and waits for the client script. */
async function openPage(page: Page, theme: Theme) {
  const errors: string[] = [];
  const dialogs: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("dialog", (dialog) => {
    dialogs.push(dialog.message());
    void dialog.dismiss();
  });
  await page.goto(`/${theme}/`);
  await page.waitForFunction(() => window.__trust !== undefined);
  const result = await page.evaluate(() => window.__trust);
  if (result === undefined) throw new Error("client script did not publish a result");
  if (!result.ok) throw new Error(`client script failed: ${result.error}`);
  return { result, errors, dialogs };
}

const atom = (page: Page, name: string) => page.locator(`[data-atom="${name}"]`);

for (const theme of THEMES) {
  test.describe(`${theme} page`, () => {
    test("prerendered with the server-side import and the page theme", async ({ page }) => {
      await openPage(page, theme);
      await expect(page.locator('meta[name="qball-ssr-entries"]')).toHaveAttribute(
        "content",
        "core,trust",
      );
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    });

    test("renders every claim, source and footer state", async ({ page }) => {
      await openPage(page, theme);
      const marks = async (name: string) => [
        await atom(page, name).locator(".claim__mark--endorsed").count(),
        await atom(page, name).locator(".claim__mark--verified").count(),
      ];
      expect(await marks("claim-high-both")).toEqual([1, 1]);
      expect(await marks("claim-endorsed-only")).toEqual([1, 0]);
      expect(await marks("claim-verified-only")).toEqual([0, 1]);
      expect(await marks("claim-medium-none")).toEqual([0, 0]);

      await expect(atom(page, "claim-high-both").locator(".claim__conf--high")).toHaveCount(1);
      await expect(atom(page, "claim-medium-none").locator(".claim__conf--med")).toHaveCount(1);
      await expect(atom(page, "claim-low").locator(".claim__conf--low")).toHaveCount(1);

      const withReplacement = atom(page, "claim-superseded-replacement");
      await expect(withReplacement.locator("article.claim--superseded")).toHaveCount(1);
      await expect(withReplacement.locator(".claim__now")).toContainText(
        "The server is generally available.",
      );
      const noReplacement = atom(page, "claim-superseded-unavailable");
      await expect(noReplacement.locator("article.claim--superseded")).toHaveCount(1);
      await expect(noReplacement.locator(".claim__now")).toContainText("replacement not available");

      // The card reads `view source ↗` over the date; the source name lives in the
      // accessible name — a consumer company badge by domain, else only the host.
      const companySrc = atom(page, "claim-company-badge").locator(".claim__src");
      await expect(companySrc).toHaveText("view source↗2025-06-20");
      await expect(companySrc).toHaveAttribute(
        "aria-label",
        "View source: Example Lab, 2025-06-20",
      );
      const noBadge = atom(page, "claim-no-badge").locator(".claim__src");
      await expect(noBadge).toHaveAttribute(
        "aria-label",
        "View source: blog.example.org, 2025-06-20",
      );
      await expect(atom(page, "claim-high-both").locator(".claim__tags")).toHaveCount(1);
      await expect(atom(page, "claim-medium-none").locator(".claim__tags")).toHaveCount(0);

      const list = atom(page, "reading-list");
      await expect(list.locator(".srcrow")).toHaveCount(4);
      await expect(list.locator(".srcrow__mark", { hasText: "EL" })).toHaveCount(1);
      await expect(list).toContainText("source unavailable");

      await expect(atom(page, "footer-answer").locator("footer.provfoot")).toContainText(
        "snapshot 2026-07-17",
      );
      await expect(atom(page, "footer-panel").locator("footer.provfoot")).toHaveCount(1);
    });

    test("verdict stamps open and close; feedback toggles", async ({ page }) => {
      await openPage(page, theme);
      for (const word of ["grounded", "withheld", "refused"]) {
        const host = atom(page, `stamp-${word}`);
        const stamp = host.locator(`.vstamp--${word}`);
        await expect(stamp).toHaveAttribute("aria-expanded", "false");
        await stamp.click();
        await expect(stamp).toHaveAttribute("aria-expanded", "true");
        await expect(host.locator(".vrow")).toHaveClass(/\bopen\b/);
        await expect(host).toHaveAttribute("data-opened", "1");
        await host.locator(".vrow__close").click();
        await expect(stamp).toHaveAttribute("aria-expanded", "false");
      }

      const feedback = atom(page, "feedback");
      const up = feedback.locator(".qfb__up");
      await up.click();
      await expect(up).toHaveAttribute("aria-pressed", "true");
      await expect(feedback).toHaveAttribute("data-change", "1:consumer-turn");
      await up.click();
      await expect(up).toHaveAttribute("aria-pressed", "false");
      await expect(feedback).toHaveAttribute("data-change", "null:consumer-turn");
    });

    test("packed token CSS resolves to this theme's colours", async ({ page }) => {
      await openPage(page, theme);
      const color = (selector: string, property = "color") =>
        page
          .locator(selector)
          .first()
          .evaluate((node, prop) => getComputedStyle(node).getPropertyValue(prop), property);

      expect(await color("body", "background-color")).toBe(tokenColor(theme, "bg-primary"));
      expect(await color(".claim__conf--high")).toBe(tokenColor(theme, "color-signal"));
      expect(await color(".claim__conf--low")).toBe(tokenColor(theme, "text-secondary"));
      expect(await color(".claim__meta")).toBe(tokenColor(theme, "text-secondary"));
      expect(await color(".provfoot b")).toBe(tokenColor(theme, "text-secondary"));
      expect(await color(".srcrow__mark")).toBe(tokenColor(theme, "anno-source"));
      // Brand inks on tinted surfaces are deepened toward the theme's text colour
      // (WP-QB-1.6): darker in light, lighter in dark.
      expectNear(
        await color(".vstamp--grounded"),
        mixedColor(theme, "color-signal", 72, "text-primary"),
      );
      expectNear(
        await color(".vstamp--withheld"),
        mixedColor(theme, "color-highlight", 72, "text-primary"),
      );
      expectNear(
        await color(".claim__conf--med"),
        mixedColor(theme, "data-warn", 60, "text-primary"),
      );

      // Feedback colours apply only to the pressed toggle; the CSS fades
      // colour in, so poll until the transition settles.
      const feedback = atom(page, "feedback");
      await feedback.locator(".qfb__down").click();
      const highlight = mixedColor(theme, "color-highlight", 72, "text-primary");
      await expect
        .poll(async () => distance(await color(".qfb__down"), highlight))
        .toBeLessThan(1.5);
      await feedback.locator(".qfb__up").click();
      const signal = mixedColor(theme, "color-signal", 72, "text-primary");
      await expect.poll(async () => distance(await color(".qfb__up"), signal)).toBeLessThan(1.5);
    });

    test("every atom and chat answer meets WCAG AA contrast (axe)", async ({ page }) => {
      // Reduced motion paints the stamp labels in their solid ink (the shimmer
      // is a gradient axe cannot measure) and settles colour transitions.
      await page.emulateMedia({ reducedMotion: "reduce" });
      await openPage(page, theme);
      // Show the hidden text too: every explanation and source list open, and
      // one pressed feedback mark of each kind.
      await page.evaluate(() => {
        for (const node of document.querySelectorAll<HTMLElement>(".vstamp, .qsrcline"))
          node.click();
      });
      const chat = atom(page, "chat-answers");
      await expect(chat.locator(".qturn")).toHaveCount(5);
      await chat.locator(".qfb__up").first().click();
      await chat.locator(".qfb__down").nth(1).click();
      // Prove the hidden states are really showing before measuring.
      const rows = page.locator(".vrow");
      expect(await rows.count()).toBeGreaterThanOrEqual(6);
      await expect(page.locator(".vrow:not(.open)")).toHaveCount(0);
      await expect(page.locator(".qsrcline")).toHaveCount(1);
      await expect(page.locator(".qsrcline")).toHaveAttribute("aria-expanded", "true");
      await expect(page.locator(".qsrclist.open .srcrow")).toHaveCount(1);
      await expect(chat.locator(".qfb__up").first()).toHaveAttribute("aria-pressed", "true");
      await expect(chat.locator(".qfb__down").nth(1)).toHaveAttribute("aria-pressed", "true");
      await expect(page.locator(".vrow__txt").first()).toBeVisible();
      await page.waitForTimeout(300);

      await page.addScriptTag({ path: AXE });
      const result = await page.evaluate(async () => {
        const axe = (window as unknown as { axe: AxeApi }).axe;
        const r = await axe.run(document, { runOnly: ["color-contrast"] });
        const list = (items: typeof r.violations) =>
          items.flatMap((v) =>
            v.nodes.map((n) => `${n.target.join(" ")} — ${n.failureSummary ?? v.help}`),
          );
        // Confidence glyphs (◆ ◈ ◇) are symbols, not text, so axe leaves them
        // undecided; they are measured below against the 3:1 non-text bar.
        const glyph = (n: { target: string[] }) => n.target.some((t) => t.includes("qclaim__conf"));
        const undecided = r.incomplete.map((v) => ({
          ...v,
          nodes: v.nodes.filter((n) => !glyph(n)),
        }));
        const toLinear = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
        const rgb = (css: string): number[] => {
          const a = /^rgba?\((\d+), (\d+), (\d+)/.exec(css);
          if (a) return [a[1], a[2], a[3]].map((v) => Number(v) / 255);
          const b = /^color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)/.exec(css);
          if (b) return [b[1], b[2], b[3]].map(Number);
          throw new Error(`unparsed colour ${css}`);
        };
        const luminance = (css: string) => {
          const [r0 = 0, g0 = 0, b0 = 0] = rgb(css).map(toLinear);
          return 0.2126 * r0 + 0.7152 * g0 + 0.0722 * b0;
        };
        const page = luminance(getComputedStyle(document.body).backgroundColor);
        const glyphs = [...document.querySelectorAll(".qclaim__conf")].map((node) => {
          const l = luminance(getComputedStyle(node).color);
          return (Math.max(l, page) + 0.05) / (Math.min(l, page) + 0.05);
        });
        return {
          violations: list(r.violations),
          incomplete: list(undecided),
          checked: r.passes.reduce((sum, v) => sum + v.nodes.length, 0),
          glyphs,
        };
      });
      expect(result.violations).toEqual([]);
      // Nothing else axe could not decide (gradients, overlaps) slips through unmeasured.
      expect(result.incomplete).toEqual([]);
      // Non-text confidence glyphs on the page surface: at least 3:1 (WCAG 1.4.11).
      expect(result.glyphs).toHaveLength(3);
      for (const ratio of result.glyphs) expect(ratio).toBeGreaterThanOrEqual(3);
      // Anti-vacuous: the rule really measured the page's text.
      expect(result.checked).toBeGreaterThan(80);
    });

    test("hostile text and URLs stay inert (positive control fires)", async ({ page }) => {
      const { result, errors, dialogs } = await openPage(page, theme);
      // The same payloads injected unsafely ran twice (img onerror + javascript: link)...
      expect(result.hostile.controlFired).toBe(2);
      // ...but through the packed atoms nothing ran, no <img> was parsed, the
      // markup shows as text and no link carries the javascript: URL.
      expect(result.hostile.fired).toBe(0);
      expect(result.hostile.imgs).toBe(0);
      expect(result.hostile.hostileTextShown).toBe(true);
      expect(result.hostile.hrefs).toEqual([]);
      expect(errors).toEqual([]);
      expect(dialogs).toEqual([]);
    });

    test("loads no three.js", async ({ page }) => {
      const pending: Promise<string>[] = [];
      page.on("response", (response) => {
        if (response.request().resourceType() === "script") pending.push(response.text());
      });
      await openPage(page, theme);
      const inline = await page
        .locator("script:not([src])")
        .evaluateAll((nodes) => nodes.map((n) => n.textContent ?? ""));
      const bodies = await Promise.all(pending);
      // Non-vacuous: the page really loaded its bundled module script.
      expect(bodies.length).toBeGreaterThan(0);
      for (const text of [...bodies, ...inline]) expect(text).not.toMatch(THREE_REF);
    });
  });
}

test("token stylesheets land in the locked order", async ({ page, request }) => {
  await openPage(page, "light");
  const hrefs = await page
    .locator('link[rel="stylesheet"]')
    .evaluateAll((nodes) => nodes.map((n) => n.getAttribute("href") ?? ""));
  // Astro splits the CSS shared with the launcher pages into its own chunk, so
  // the cascade order is the link order, then the order within each file.
  expect(hrefs.length).toBeGreaterThan(0);
  const css = (await Promise.all(hrefs.map(async (h) => (await request.get(h)).text()))).join("\n");
  // One marker that exists in only one file each: colors_and_type.css,
  // components.css, graph.css.
  const offsets = ["--stage-bg:", ".claim__conf--high", ".graphcanvas"].map((m) => css.indexOf(m));
  for (const offset of offsets) expect(offset).toBeGreaterThanOrEqual(0);
  expect([...offsets].sort((a, b) => a - b)).toEqual(offsets);
});
