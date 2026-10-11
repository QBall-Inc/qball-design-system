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
      turns: 10,
      boxes: [
        "vbox vbox--grounded",
        "vbox vbox--withheld",
        "vbox vbox--refused",
        "vbox vbox--grounded",
        "vbox vbox--error",
      ],
      draftShown: false,
      drafts: 7,
      paraFont: true,
    });
  }
});
