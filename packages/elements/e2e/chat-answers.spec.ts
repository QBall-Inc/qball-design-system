// Chat answer turns in real Chromium, with the real @qball-inc/tokens CSS:
// the thinking cursor blinks and goes static under reduced motion; the
// disabled composer's dimming comes from the tokens rule; the same
// conversation renders identically in the overlay body and in a bare page
// element; answer text keeps the chat register (not the page's paragraph
// style). jsdom has no computed styles, so this is proven here.
// Renders the BUILT dist/chat entry. Needs the built dist/ (`pnpm test` builds it).
import { existsSync, readFileSync } from "node:fs";
import { join, normalize, resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";

const ORIGIN = "http://elements.test";
const DIST = resolve(process.cwd(), "dist");
const TOKENS = resolve(process.cwd(), "..", "tokens");
const ANSWERS = resolve(process.cwd(), "..", "..", "fixtures", "qubrain", "answers");

const SCRIPTS = ["grounded", "withheld", "refused-off-topic", "grounded-no-evidence", "error"];

const PAGE = `<!doctype html>
<html lang="en" data-theme="light">
  <head>
    <meta name="viewport" content="width=device-width">
    <link rel="stylesheet" href="/tokens/colors_and_type.css">
    <link rel="stylesheet" href="/tokens/components.css">
  </head>
  <body>
    <div id="inline"></div>
    <div id="thinking"></div>
    <div id="chat"></div>
    <script type="module">
      import { mount, mountTranscript } from "/dist/chat/index.js";
      const scripts = await Promise.all(
        ${JSON.stringify(SCRIPTS)}.map((name) => fetch("/answers/" + name + ".json").then((r) => r.json())),
      );
      const replay = (turn, events) => {
        for (const e of events) {
          if (e.op === "start") turn.start();
          else if (e.op === "appendText") turn.appendText(e.text);
          else if (e.op === "finalize") turn.finalize(e.turn);
          else if (e.op === "fail") turn.fail(e.message);
        }
      };
      const conversation = (container) => {
        const t = mountTranscript(container, { onWarn: () => {} });
        for (const s of scripts) {
          t.addUserTurn(s.question);
          replay(t.addBotTurn(), s.events);
        }
        t.addNotice("you’ve used today’s questions.\\ncome back tomorrow.", {
          action: { label: "explore →", href: "/explore" },
        });
      };
      const chat = mount(document.getElementById("chat"), { hotkey: false });
      chat.overlay.classList.add("open");
      conversation(chat.body);
      conversation(document.getElementById("inline"));
      chat.setComposerDisabled(true, "back tomorrow");
      const pending = mountTranscript(document.getElementById("thinking"));
      pending.addBotTurn().start();
      // Status label + site links, inline and in the overlay panel.
      const grounded = scripts[0].events.find((e) => e.op === "finalize").turn;
      const extras = (container) => {
        const t = mountTranscript(container, { onWarn: () => {} });
        const turn = t.addBotTurn();
        turn.start();
        turn.setStatus("searching the notes");
        const linked = t.addBotTurn();
        linked.start();
        linked.finalize({
          ...grounded,
          explorerLink: "/explore?e=x",
          siteLinks: {
            heading: "related pages",
            items: [
              { title: "a page", url: "/notes/a" },
              { title: "an unlisted page", url: "https://elsewhere.example/b" },
            ],
          },
        });
      };
      // Into both copies, so the overlay and the inline page stay identical.
      for (const host of [chat.body, document.getElementById("inline")]) {
        const box = document.createElement("div");
        host.append(box);
        extras(box);
      }
      window.__drafts = scripts.flatMap((s) => s.events.filter((e) => e.op === "appendText").map((e) => e.text));
      window.__ready = true;
    </script>
  </body>
</html>`;

declare global {
  interface Window {
    __ready?: boolean;
    __drafts?: string[];
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

test.beforeAll(() => {
  if (!existsSync(join(DIST, "chat", "index.js"))) {
    throw new Error(`${DIST}/chat/index.js missing — build @qball-inc/elements first (pnpm test).`);
  }
});

test("the thinking cursor blinks, and is static under reduced motion", async ({ browser }) => {
  for (const [reducedMotion, expected] of [
    ["no-preference", "qc-blink"],
    ["reduce", "none"],
  ] as const) {
    const context = await browser.newContext({ reducedMotion });
    const page = await context.newPage();
    await load(page);
    const animation = await page.evaluate(() => {
      const cursor = document.querySelector("#thinking .qcursor");
      return cursor === null ? null : getComputedStyle(cursor).animationName;
    });
    expect(animation).toBe(expected);
    await context.close();
  }
});

test("the disabled composer is dimmed by the tokens rule and shows its placeholder", async ({
  page,
}) => {
  await load(page);
  const state = await page.evaluate(() => {
    const row = document.querySelector<HTMLElement>("#chat .qpanel__comp");
    const input = document.querySelector<HTMLTextAreaElement>("#chat .qpanel__input");
    if (row === null || input === null) return null;
    const dimmed = getComputedStyle(row).opacity;
    row.classList.remove("is-disabled");
    const plain = getComputedStyle(row).opacity;
    row.classList.add("is-disabled");
    return { dimmed, plain, disabled: input.disabled, placeholder: input.placeholder };
  });
  expect(state).toEqual({
    dimmed: "0.45",
    plain: "1",
    disabled: true,
    placeholder: "back tomorrow",
  });
});

test("the same conversation renders identically in the overlay and inline, with no draft text", async ({
  page,
}) => {
  await load(page);
  for (const theme of ["light", "dark"]) {
    const result = await page.evaluate((t) => {
      document.documentElement.setAttribute("data-theme", t);
      const overlay = document.querySelector("#chat .qpanel__body");
      const inline = document.querySelector("#inline");
      if (overlay === null || inline === null) return null;
      const box = inline.querySelector(".vbox--grounded");
      const para = box?.querySelector("p");
      const turn = inline.querySelector(".qturn");
      return {
        same: overlay.innerHTML === inline.innerHTML,
        turns: inline.querySelectorAll(".qturn").length,
        boxes: [...inline.querySelectorAll(".vbox")].map((node) => node.className),
        draftShown: (window.__drafts ?? []).some((draft) => inline.textContent.includes(draft)),
        drafts: (window.__drafts ?? []).length,
        // Answer text keeps the turn's register, not the page's global <p> style.
        paraFont:
          para && turn
            ? getComputedStyle(para).fontFamily === getComputedStyle(turn).fontFamily &&
              getComputedStyle(para).fontSize === getComputedStyle(turn).fontSize
            : null,
      };
    }, theme);
    expect(result).toEqual({
      same: true,
      // The five scripts, then the status-label turn and the site-links turn.
      turns: 12,
      boxes: [
        "vbox vbox--grounded",
        "vbox vbox--withheld",
        "vbox vbox--refused",
        "vbox vbox--grounded",
        "vbox vbox--error",
        "vbox vbox--grounded",
      ],
      draftShown: false,
      drafts: 7,
      paraFont: true,
    });
  }
});

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

for (const width of [1280, 390]) {
  test(`status label sits on one line between the prompt and the cursor (${String(width)}px)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await load(page);
    const rows = await page.evaluate(() => {
      const measure = (scope: string) => {
        const row = document.querySelector(`${scope} .qturn--thinking`);
        const box = (sel: string) => row?.querySelector(sel)?.getBoundingClientRect() ?? null;
        const status = row?.querySelector(".qstatus");
        return {
          prompt: box(".qturn__bot"),
          status: box(".qstatus"),
          cursor: box(".qcursor"),
          role: status?.getAttribute("role") ?? null,
          text: status?.textContent ?? null,
          busyOutside: status?.closest("[aria-busy]") === null,
        };
      };
      return [measure("#inline"), measure("#chat .qpanel__body")];
    });
    for (const row of rows) {
      const { prompt, status, cursor } = row;
      if (prompt === null || status === null || cursor === null) throw new Error("row missing");
      expect(row).toMatchObject({ role: "status", text: "searching the notes", busyOutside: true });
      expect(status.left).toBeGreaterThanOrEqual(prompt.right);
      expect(cursor.left).toBeGreaterThanOrEqual(status.right);
      expect(cursor.left - status.right).toBeLessThanOrEqual(12);
      expect(Math.abs(cursor.top - status.top)).toBeLessThanOrEqual(4);
    }
  });
}

test("without a label the cursor stays where the answer text starts", async ({ page }) => {
  await load(page);
  const offsets = await page.evaluate(() => {
    const at = (sel: string) => {
      const node = document.querySelector(sel);
      const turn = node?.closest(".qturn")?.getBoundingClientRect();
      const box = node?.getBoundingClientRect();
      return turn === undefined || box === undefined ? null : box.left - turn.left;
    };
    return { cursor: at("#thinking .qcursor"), answer: at("#inline .qturn__t-bot") };
  });
  expect(offsets.cursor).not.toBeNull();
  expect(offsets.cursor).toBeCloseTo(offsets.answer ?? Number.NaN, 0);
});

test("site links render with the tokens CSS; an unlisted link is plain text", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await load(page);
  const state = await page.evaluate(() => {
    const read = (scope: string) => {
      const block = document.querySelector(`${scope} .qsitelinks`);
      const list = block?.querySelector(".qsitelinks__list");
      const link = block?.querySelector("a");
      const inert = block?.querySelector(".is-inert");
      const qlink = block?.closest(".qturn")?.querySelector(".qlink");
      if (!block || !list || !link || !inert || !qlink) return null;
      return {
        heading: block.querySelector(".qsitelinks__heading")?.textContent,
        href: link.getAttribute("href"),
        inertTag: inert.tagName,
        listStyle: getComputedStyle(list).listStyleType,
        fontSize: getComputedStyle(block).fontSize,
        sameFaceAsSources:
          getComputedStyle(block).fontFamily === getComputedStyle(qlink).fontFamily,
      };
    };
    return { inline: read("#inline"), panel: read("#chat .qpanel__body") };
  });
  expect(state.inline).toMatchObject({
    heading: "related pages",
    href: "/notes/a",
    inertTag: "SPAN",
    listStyle: "none",
    sameFaceAsSources: true,
  });
  // Phone panel type scale: the links read at the sources line's 12px.
  expect(state.panel).toMatchObject({ fontSize: "12px", sameFaceAsSources: true });
});

test("status text, links heading and inert links meet AA contrast in both themes", async ({
  page,
}) => {
  await load(page);
  for (const theme of ["light", "dark"]) {
    const pairs = await page.evaluate((t) => {
      // Links fade colour on a theme change; read the settled colour, not mid-fade.
      const still = document.createElement("style");
      still.textContent = "*{transition:none!important}";
      document.head.append(still);
      document.documentElement.setAttribute("data-theme", t);
      const panel = document.querySelector("#chat .qpanel");
      // The page surface (inline) and the overlay panel's own surface.
      const surfaces = [
        { scope: "#inline", bg: getComputedStyle(document.body).backgroundColor },
        {
          scope: "#chat .qpanel__body",
          bg: panel === null ? "" : getComputedStyle(panel).backgroundColor,
        },
      ];
      const selectors = [
        ".qstatus",
        ".qsitelinks__heading",
        ".qsitelinks__link.is-inert",
        ".qsitelinks a",
      ];
      return surfaces.flatMap(({ scope, bg }) =>
        selectors.map((sel) => {
          const node = document.querySelector(`${scope} ${sel}`);
          return {
            sel: `${scope} ${sel}`,
            fg: node === null ? null : getComputedStyle(node).color,
            bg,
          };
        }),
      );
    }, theme);
    expect(pairs).toHaveLength(8);
    for (const { sel, fg, bg } of pairs) {
      if (fg === null) throw new Error(`${sel} missing`);
      expect(bg).toMatch(/^rgb\(/);
      expect(contrast(fg, bg), `${theme} ${sel} ${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
  }
});
