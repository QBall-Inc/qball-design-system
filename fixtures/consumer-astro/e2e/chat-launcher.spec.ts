// The ask launcher through the PACKED tarballs, mounted once from a shared
// Astro layout on two pages (corner on a standard page, post-page on a post).
// Each page must: prerender the chat entry server-side, load only the two
// launcher stylesheets (no graph.css) and no three.js, open on Q (but not
// while typing in the page's own field), close on Esc / scrim / keycap with
// focus in the composer while open, and answer through a transcript inside the
// overlay whose streamed drafts never reach the page. Hostile persona copy and
// hostile answer data stay inert, with a positive control proving they would fire.
import { expect, test, type Page } from "@playwright/test";

interface ChatRun {
  name: string;
  drafts: string[];
  leakedDraft: boolean;
}
type ChatResult =
  | { ok: true; runs: ChatRun[]; controlFired: number }
  | { ok: false; error: string };

declare global {
  interface Window {
    __pwned?: number;
    __chat?: ChatResult;
  }
}

/** Same matcher as e2e/trust-atoms.spec.ts. */
const THREE_REF = /\bthree\b|\bTHREE\b|WebGLRenderer/;
const HOSTILE_IMG = '<img src="data:image/png;base64,AAAA"';

const PAGES = [
  { path: "/launcher-standard/", variant: "corner", field: "#page-search", hostilePersona: false },
  {
    path: "/launcher-post-page/",
    variant: "post-page",
    field: "#page-notes",
    hostilePersona: true,
  },
] as const;

async function openPage(page: Page, path: string) {
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
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(path);
  await page.waitForFunction(() => window.__chat !== undefined);
  const result = await page.evaluate(() => window.__chat);
  if (result === undefined) throw new Error("client script did not publish a result");
  if (!result.ok) throw new Error(`client script failed: ${result.error}`);
  return { result, errors, dialogs };
}

const overlay = (page: Page) => page.locator(".qoverlay");
const composer = (page: Page) => page.locator(".qpanel__input");

async function expectOpen(page: Page): Promise<void> {
  await expect(overlay(page)).toBeVisible();
  await expect(composer(page)).toBeFocused();
}

async function ask(page: Page, text: string): Promise<ChatRun> {
  const before = await page.evaluate(() => (window.__chat?.ok ? window.__chat.runs.length : -1));
  await composer(page).fill(text);
  await composer(page).press("Enter");
  await page.waitForFunction(
    (n) => window.__chat?.ok === true && window.__chat.runs.length > n,
    before,
  );
  const run = await page.evaluate(
    (n) => (window.__chat?.ok ? window.__chat.runs[n] : undefined),
    before,
  );
  if (run === undefined) throw new Error(`no run recorded for "${text}"`);
  return run;
}

for (const spec of PAGES) {
  test.describe(`${spec.variant} launcher page`, () => {
    test("prerenders the chat entry and loads only the launcher stylesheets", async ({
      page,
      request,
    }) => {
      await openPage(page, spec.path);
      await expect(page.locator('meta[name="qball-ssr-entries"]')).toHaveAttribute(
        "content",
        "chat",
      );
      const hrefs = await page
        .locator('link[rel="stylesheet"]')
        .evaluateAll((nodes) => nodes.map((n) => n.getAttribute("href") ?? ""));
      expect(hrefs.length).toBeGreaterThan(0);
      const linked = await Promise.all(hrefs.map(async (h) => (await request.get(h)).text()));
      // Inline <style> too, so an inlined graph.css could not slip past the scan.
      const inline = await page
        .locator("style")
        .evaluateAll((nodes) => nodes.map((n) => n.textContent ?? ""));
      const css = [...linked, ...inline].join("\n");
      // colors_and_type.css then components.css (markers that exist in one file each)...
      const offsets = ["--stage-bg:", ".claim__conf--high"].map((m) => css.indexOf(m));
      for (const offset of offsets) expect(offset).toBeGreaterThanOrEqual(0);
      expect([...offsets].sort((a, b) => a - b)).toEqual(offsets);
      // ...and no graph.css.
      expect(css).not.toContain(".graphcanvas");
    });

    test("one launcher of the right variant; Q opens unless typing in a page field", async ({
      page,
    }) => {
      const { errors } = await openPage(page, spec.path);
      const launcher = page.locator(".qlaunch");
      await expect(launcher).toHaveCount(1);
      if (spec.variant === "post-page") await expect(launcher).toHaveClass(/qlaunch--post/);
      else await expect(launcher).not.toHaveClass(/qlaunch--post/);
      await expect(page.locator(".qpanel__title")).toHaveText("guide");

      // The overlay is mounted (closed) up front, so "hidden" below is meaningful.
      await expect(overlay(page)).toHaveCount(1);
      await expect(overlay(page)).toBeHidden();

      // Suppressed while the page's own field has focus.
      await page.locator(spec.field).focus();
      await page.keyboard.press("q");
      await expect(overlay(page)).toBeHidden();
      await expect(page.locator(spec.field)).toHaveValue("q");

      await page.locator(spec.field).blur();
      await page.keyboard.press("q");
      await expectOpen(page);
      expect(errors).toEqual([]);
    });

    test("Esc, scrim and keycap each close the overlay", async ({ page }) => {
      await openPage(page, spec.path);
      await page.keyboard.press("q");
      await expectOpen(page);
      await page.keyboard.press("Escape");
      await expect(overlay(page)).toBeHidden();

      await page.locator(".qlaunch").click();
      await expectOpen(page);
      await page.locator(".qoverlay__scrim").click({ position: { x: 5, y: 5 } });
      await expect(overlay(page)).toBeHidden();

      await page.keyboard.press("q");
      await expectOpen(page);
      await page.locator(".qpanel__esc .keycap").click();
      await expect(overlay(page)).toBeHidden();
    });

    test("answers render in the overlay; streamed drafts never reach the page", async ({
      page,
    }) => {
      const { errors } = await openPage(page, spec.path);
      await page.keyboard.press("q");
      await expectOpen(page);

      // Each fixture's own verdict box and a phrase only its final body holds.
      const body = page.locator(".qpanel__body");
      const CASES = [
        { name: "grounded", box: "vbox--grounded", phrase: "episodic recall" },
        { name: "withheld", box: "vbox--withheld", phrase: "sitting on it until they do" },
        { name: "refused", box: "vbox--refused", phrase: "walk you through it" },
        { name: "structured", box: "vbox--grounded", phrase: "the short version" },
      ];
      for (const [i, c] of CASES.entries()) {
        const run = await ask(page, `${c.name} please`);
        expect(run.name).toBe(c.name);
        expect(run.drafts.length).toBeGreaterThan(0);
        expect(run.leakedDraft).toBe(false);
        const botTurn = body.locator(".qturn__t-bot").nth(i);
        await expect(botTurn.locator(`.${c.box}`)).toHaveCount(1);
        await expect(botTurn).toContainText(c.phrase);
      }
      await expect(body.locator(".qturn__t-you")).toHaveCount(4);
      await expect(body.locator(".qturn__t-bot")).toHaveCount(4);
      await expect(body.locator(".vbox--error")).toHaveCount(0);

      // Boundary: a whitespace-only question is trimmed away and never asked.
      await composer(page).fill("   ");
      await composer(page).press("Enter");
      await expect(body.locator(".qturn__t-you")).toHaveCount(4);

      // The packed CSS resolves inside the overlay: the panel paints a real
      // surface colour and the transcript is laid out, not unstyled flow.
      const panelBg = await page
        .locator(".qpanel")
        .evaluate((n) => getComputedStyle(n).backgroundColor);
      expect(panelBg).not.toBe("rgba(0, 0, 0, 0)");
      const position = await overlay(page).evaluate((n) => getComputedStyle(n).position);
      expect(position).toBe("fixed");
      expect(errors).toEqual([]);
    });

    test("hostile persona and answer data stay inert (positive control fires)", async ({
      page,
    }) => {
      const { result, errors, dialogs } = await openPage(page, spec.path);
      if (!result.ok) throw new Error("unreachable");
      expect(result.controlFired).toBe(2);

      await page.keyboard.press("q");
      await expectOpen(page);
      if (spec.hostilePersona) {
        await expect(page.locator(".qpanel__disc")).toContainText(HOSTILE_IMG);
      }
      await ask(page, "hostile please");
      const panel = page.locator(".qpanel");
      await expect(panel).toContainText(HOSTILE_IMG);
      await page.waitForTimeout(400);
      expect(await page.evaluate(() => window.__pwned ?? 0)).toBe(0);
      expect(await panel.locator("img").count()).toBe(0);
      const hrefs = await panel
        .locator("[href]")
        .evaluateAll((nodes) => nodes.map((n) => n.getAttribute("href") ?? ""));
      // Non-vacuous: the answer's other (https) sources did render as links...
      expect(hrefs.some((href) => href.startsWith("https://"))).toBe(true);
      // ...while the javascript: one did not.
      for (const href of hrefs) expect(href).not.toMatch(/^\s*javascript:/i);
      expect(errors).toEqual([]);
      expect(dialogs).toEqual([]);
    });

    test("loads no three.js", async ({ page }) => {
      const pending: Promise<string>[] = [];
      page.on("response", (response) => {
        if (response.request().resourceType() === "script") pending.push(response.text());
      });
      await openPage(page, spec.path);
      const inline = await page
        .locator("script:not([src])")
        .evaluateAll((nodes) => nodes.map((n) => n.textContent ?? ""));
      const bodies = await Promise.all(pending);
      expect(bodies.length).toBeGreaterThan(0);
      for (const text of [...bodies, ...inline]) expect(text).not.toMatch(THREE_REF);
    });
  });
}
