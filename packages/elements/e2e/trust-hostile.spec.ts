// Hostile-payload execution gate for the trust atoms (plan AD-4, G-SEC-1/2).
// jsdom never runs inline handlers or javascript: URLs, so "did not execute"
// can only be proven in a real browser. This page first runs POSITIVE
// CONTROLS — the same payloads parsed unsafely (innerHTML) and a real
// javascript: link — and requires them to fire; only then does it render the
// built ./trust atoms with those payloads and require that nothing fires.
// Needs the built dist/ (`pnpm test` builds it; CI runs it first).
import { existsSync, readFileSync } from "node:fs";
import { join, normalize, resolve } from "node:path";
import { expect, test } from "@playwright/test";

const ORIGIN = "http://elements.test";
const DIST = resolve(process.cwd(), "dist");

const PAGE = `<!doctype html>
<html>
  <body>
    <div id="out"></div>
    <script type="module">
      import {
        renderClaimCard,
        renderReadingList,
        renderSourceRow,
        renderProvenanceFooter,
      } from "/dist/trust/index.js";

      const HOSTILE = '<img src="/missing.png" onerror="window.__pwned = (window.__pwned || 0) + 1">';
      const JS_URL = "javascript:window.__pwned=(window.__pwned||0)+1";
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const out = document.getElementById("out");

      async function controls() {
        const parsed = document.createElement("div");
        parsed.innerHTML = HOSTILE;
        document.body.append(parsed);
        const link = document.createElement("a");
        link.setAttribute("href", JS_URL);
        document.body.append(link);
        link.click();
        await wait(400);
        const fired = window.__pwned ?? 0;
        parsed.remove();
        link.remove();
        delete window.__pwned;
        return fired;
      }

      async function atoms() {
        const source = {
          episode_id: "ep-1",
          title: HOSTILE,
          url: JS_URL,
          source_type: "web",
          save_date: "2025-06-20",
        };
        const badges = { domains: { "example-lab.com": { mark: "EL", label: HOSTILE } } };
        const old = {
          claim_id: 1,
          claim_text: HOSTILE,
          confidence: 0.9,
          confidence_tier: "high",
          valid_from: "2025-03-11",
          valid_to: "2025-06-20",
          superseded_by_claim_id: 2,
          source,
        };
        const { valid_to: _to, superseded_by_claim_id: _by, ...current } = old;
        const replacement = { ...current, claim_id: 2 };
        out.append(
          renderClaimCard(old, { replacement: { kind: "available", claim: replacement }, sourceBadges: badges }),
          renderClaimCard({ ...replacement, source: { ...source, url: "https://example-lab.com/a" } }, { sourceBadges: badges }),
          renderSourceRow(source),
          renderReadingList([
            { ...source, episode_id: "ep-2", url: "data:text/html,<script>parent.__pwned=1<\\/script>" },
            { ...source, episode_id: "ep-3", url: "vbscript:msgbox(1)" },
          ]),
          renderProvenanceFooter("panel", { claims: 1, sources: 1, revisionDate: "2026-07-17", supersededShown: 1 }),
        );
        for (const node of out.querySelectorAll(".claim__src:not([href]), .srcrow:not([href])")) node.click();
        await wait(400);
        return {
          fired: window.__pwned ?? 0,
          imgs: out.querySelectorAll("img").length,
          hrefs: [...out.querySelectorAll("[href]")].map((n) => n.getAttribute("href")),
          hostileTextShown: out.textContent.includes(HOSTILE),
        };
      }

      try {
        const controlFired = await controls();
        window.__result = { ok: true, controlFired, ...(await atoms()) };
      } catch (err) {
        window.__result = { ok: false, error: String(err) };
      }
    </script>
  </body>
</html>`;

interface HostileResult {
  ok: boolean;
  error?: string;
  controlFired?: number;
  fired?: number;
  imgs?: number;
  hrefs?: string[];
  hostileTextShown?: boolean;
}

declare global {
  interface Window {
    __result?: HostileResult;
  }
}

test("trust atoms never execute hostile text or URLs (real Chromium)", async ({ page }) => {
  if (!existsSync(join(DIST, "trust", "index.js"))) {
    throw new Error(
      `${DIST}/trust/index.js missing — build @qball-inc/elements first (pnpm test).`,
    );
  }
  const pageErrors: string[] = [];
  page.on("pageerror", (err) => pageErrors.push(err.message));

  await page.route(`${ORIGIN}/**`, async (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname === "/") {
      await route.fulfill({ contentType: "text/html", body: PAGE });
      return;
    }
    const file = normalize(join(DIST, pathname.replace(/^\/dist\//, "")));
    if (pathname.startsWith("/dist/") && file.startsWith(DIST) && existsSync(file)) {
      await route.fulfill({ contentType: "text/javascript", body: readFileSync(file) });
    } else {
      await route.fulfill({ status: 404, body: "not found" });
    }
  });

  await page.goto(`${ORIGIN}/`);
  await page.waitForFunction(() => window.__result !== undefined);
  const result = await page.evaluate(() => window.__result);
  if (result === undefined) throw new Error("page did not publish a result");

  expect(pageErrors).toEqual([]);
  expect(result.error).toBeUndefined();
  expect(result.ok).toBe(true);
  // Positive controls: the unsafe <img onerror> and the javascript: link both ran.
  expect(result.controlFired).toBe(2);
  // The atoms: nothing ran, no <img> was parsed, the markup is visible as text,
  // and the only link is the http(s) one.
  expect(result.fired).toBe(0);
  expect(result.imgs).toBe(0);
  expect(result.hostileTextShown).toBe(true);
  expect(result.hrefs).toEqual(["https://example-lab.com/a"]);
});
