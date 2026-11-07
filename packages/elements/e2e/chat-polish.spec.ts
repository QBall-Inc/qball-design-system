// The 1.0 chat polish in real Chromium with the real @qball-inc/tokens CSS:
// linked citations keep the citation look (no page link ink or border) and
// open their source; the finished sources and site-links toggles are static
// rows with a chevron that turns when open (no shimmer); the disclaimer is
// primary ink at AA after an info icon; the intro row reads in primary ink
// above the first turn; a claim card with confidence hidden moves validity up
// to the first row. jsdom has no computed styles or layout, so this is proven here.
// Renders the BUILT dist entries. Needs the built dist/ (`pnpm test` builds it).
import { existsSync, readFileSync } from "node:fs";
import { join, normalize, resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";

const ORIGIN = "http://elements.test";
const DIST = resolve(process.cwd(), "dist");
const TOKENS = resolve(process.cwd(), "..", "tokens");
const ANSWERS = resolve(process.cwd(), "..", "..", "fixtures", "qubrain", "answers");

const PAGE = `<!doctype html>
<html lang="en" data-theme="light">
  <head>
    <meta name="viewport" content="width=device-width">
    <link rel="stylesheet" href="/tokens/colors_and_type.css">
    <link rel="stylesheet" href="/tokens/components.css">
  </head>
  <body>
    <div id="inline"></div>
    <div id="cards"></div>
    <div id="chat"></div>
    <script type="module">
      import { mount, mountTranscript } from "/dist/chat/index.js";
      import { renderClaimCard } from "/dist/trust/index.js";
      const labels = { outdated: (k) => \`\${k} outdated claims\`, evidence: (t) => \`Evidence: \${t}\` };
      const script = await fetch("/answers/grounded-structured.json").then((r) => r.json());
      const turn = script.events.find((e) => e.op === "finalize").turn;
      const conversation = (container) => {
        const t = mountTranscript(container, {
          onWarn: () => {},
          intro: "hello. ask me about the notes.",
          answer: { labels },
        });
        t.addUserTurn(script.question);
        const bot = t.addBotTurn();
        bot.start();
        bot.finalize({
          ...turn,
          siteLinks: { heading: "related pages", items: [{ title: "a page", url: "/notes/a" }] },
        });
      };
      conversation(document.getElementById("inline"));
      const chat = mount(document.getElementById("chat"), {
        hotkey: false,
        disclaimer: "answers come only from the notes. when they don't cover it, it says so.",
      });
      chat.overlay.classList.add("open");
      conversation(chat.body);
      const claim = {
        claim_id: 1, claim_text: "The server runs on the local machine.", confidence: 0.81,
        confidence_tier: "high", valid_from: "2026-04-12",
        source: { episode_id: "ep-1", title: "Notes", url: "https://example.org/notes",
          source_type: "github", save_date: "2026-06-11" },
      };
      const cards = document.getElementById("cards");
      cards.append(renderClaimCard(claim, { trustMarks: { confidence: false } }));
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
      ["/answers/", ANSWERS, "application/json"],
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
  expect(pageErrors).toEqual([]);
}

/** WCAG contrast ratio of two computed `rgb(...)` colours. */
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

test.beforeAll(() => {
  for (const entry of ["chat", "trust"]) {
    if (!existsSync(join(DIST, entry, "index.js"))) {
      throw new Error(`${DIST}/${entry}/index.js missing — build @qball-inc/elements first.`);
    }
  }
});

test("a linked citation keeps the citation look and opens its source", async ({ page }) => {
  await load(page);
  // The open overlay covers the inline copy, so pointer checks use the panel copy.
  const cite = page.locator("#chat .vbox a.qcite").first();
  await expect(cite).toHaveText("[1]");
  const looks = await page.evaluate(() => {
    const link = document.querySelector("#inline .vbox a.qcite")!;
    const plain = document.createElement("span");
    plain.className = "qcite";
    plain.textContent = "[9]";
    link.parentElement!.append(plain);
    const read = (node: Element) => {
      const s = getComputedStyle(node);
      return [s.color, s.fontWeight, s.fontSize, s.borderBottomWidth, s.textDecorationLine];
    };
    const out = { link: read(link), plain: read(plain) };
    plain.remove();
    return out;
  });
  // Same ink, weight and size as a plain citation; no page-link border or underline at rest.
  expect(looks.link).toEqual(looks.plain);
  await cite.hover();
  await expect(cite).toHaveCSS("text-decoration-line", "underline");
  await expect(cite).toHaveCSS("border-bottom-width", "0px");
  const href = await cite.getAttribute("href");
  expect(href).toMatch(/^https?:\/\//);
  const row = page.locator(`#chat .qsrclist a.srcrow[href="${href!}"]`);
  await expect(row).toHaveCount(1);
  // A real click opens the source. Its origin is outside the harness, so serve it here.
  await page.route(`${new URL(href!).origin}/**`, (route) =>
    route.fulfill({ contentType: "text/html", body: "<title>source</title>" }),
  );
  await cite.click();
  await page.waitForURL(href!);
  expect(await page.title()).toBe("source");
});

test("the finished sources and site-links toggles are static rows with a turning chevron", async ({
  page,
}) => {
  await load(page);
  for (const sel of [".qsrcline:not(.qsitelinks__line)", ".qsitelinks__line"]) {
    const line = page.locator(`#chat ${sel}`);
    const read = () =>
      line.evaluate((node) => {
        const s = getComputedStyle(node);
        const after = getComputedStyle(node, "::after");
        return {
          animation: s.animationName,
          backgroundImage: s.backgroundImage,
          fill: s.getPropertyValue("-webkit-text-fill-color"),
          color: s.color,
          chevron: after.content,
          transform: after.transform,
          cursor: s.cursor,
        };
      });
    const closed = await read();
    expect(closed).toMatchObject({ animation: "none", backgroundImage: "none", cursor: "pointer" });
    // The glyphs are painted in their own ink, not a clipped moving gradient.
    expect(closed.fill).toBe(closed.color);
    expect(closed.chevron).toContain("›");
    expect(closed.transform).toBe("none");
    await line.click();
    await expect(line).toHaveAttribute("aria-expanded", "true");
    // A quarter turn: matrix(0, 1, -1, 0, 0, 0).
    await expect.poll(async () => (await read()).transform).toMatch(/^matrix\(0, 1, -1, 0/);
  }
  // The two toggles match.
  const ink = await page.evaluate(() =>
    [".qsrcline:not(.qsitelinks__line)", ".qsitelinks__line"].map((sel) => {
      const s = getComputedStyle(document.querySelector(`#chat ${sel}`)!);
      return [s.color, s.fontFamily, s.fontSize, s.fontWeight];
    }),
  );
  expect(ink[0]).toEqual(ink[1]);
});

test("disclaimer, intro, citations and toggles meet AA in both themes", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await load(page);
  for (const theme of ["light", "dark"]) {
    const pairs = await page.evaluate((t) => {
      const still = document.createElement("style");
      still.textContent = "*{transition:none!important}";
      document.head.append(still);
      document.documentElement.setAttribute("data-theme", t);
      const panelBg = getComputedStyle(document.querySelector("#chat .qpanel")!).backgroundColor;
      const pageBg = getComputedStyle(document.body).backgroundColor;
      const read = (sel: string, bg: string) => {
        const node = document.querySelector(sel);
        return { sel, fg: node === null ? null : getComputedStyle(node).color, bg };
      };
      return [
        read("#chat .qpanel__disc-text", panelBg),
        read("#chat .qturn--intro .qturn__t-bot", panelBg),
        read("#inline .qturn--intro .qturn__t-bot", pageBg),
        read("#inline .vbox a.qcite", pageBg),
        read("#inline .qsrcline:not(.qsitelinks__line)", pageBg),
        read("#chat .qsrcline:not(.qsitelinks__line)", panelBg),
      ];
    }, theme);
    expect(pairs).toHaveLength(6);
    for (const { sel, fg, bg } of pairs) {
      if (fg === null) throw new Error(`${sel} missing`);
      expect(contrast(fg, bg), `${theme} ${sel} ${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
  }
});

test("the disclaimer reads in primary ink, larger, after a visible info icon", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await load(page);
  const state = await page.evaluate(() => {
    const line = document.querySelector("#chat .qpanel__disc")!;
    const icon = line.querySelector("svg")!.getBoundingClientRect();
    const text = line.querySelector(".qpanel__disc-text")!;
    const probe = document.createElement("span");
    probe.style.color = "var(--text-primary)";
    line.append(probe);
    const primary = getComputedStyle(probe).color;
    probe.remove();
    return {
      ink: getComputedStyle(text).color,
      primary,
      size: getComputedStyle(text).fontSize,
      icon: { w: Math.round(icon.width), h: Math.round(icon.height) },
      iconBeforeText: icon.right <= text.getBoundingClientRect().left,
    };
  });
  expect(state.ink).toBe(state.primary);
  // 11px on desktop (was 9.5px); the phone panel steps it to 12px.
  expect(state.size).toBe("11px");
  expect(state.icon.w).toBeGreaterThan(10);
  expect(state.icon.w).toBe(state.icon.h);
  expect(state.iconBeforeText).toBe(true);
});

test("the intro sits above the first turn, in the bot column", async ({ page }) => {
  await load(page);
  const rows = page.locator("#inline > .qturn");
  await expect(rows.first()).toHaveClass("qturn qturn--intro");
  await expect(rows.first().locator(".qturn__t-bot")).toHaveText("hello. ask me about the notes.");
  const left = (sel: string) =>
    page.locator(sel).evaluate((node) => Math.round(node.getBoundingClientRect().left));
  // The intro text starts where a bot answer's text starts.
  expect(await left("#inline .qturn--intro .qturn__t-bot")).toBe(
    await left("#inline .qturn:not(.qturn--intro) .qturn__t-bot"),
  );
});

test("a claim card with confidence hidden shows validity on the first row, beside the source", async ({
  page,
}) => {
  await load(page);
  const geo = await page.evaluate(() => {
    const card = document.querySelector("#cards .claim")!;
    const valid = card.querySelector(".claim__valid")!.getBoundingClientRect();
    const label = card.querySelector(".claim__src-label")!.getBoundingClientRect();
    return { validTop: Math.round(valid.top), labelTop: Math.round(label.top) };
  });
  expect(Math.abs(geo.validTop - geo.labelTop)).toBeLessThanOrEqual(2);
});
