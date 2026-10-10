import { beforeEach, describe, expect, it } from "vitest";
import { resolveReplacement } from "../claims";
import { REPLACEMENT_UNAVAILABLE, renderClaimCard, type ClaimCardOptions } from "./ClaimCard";
import {
  HOSTILE_MARKUP,
  claim,
  pwned,
  resetPwned,
  settle,
  sourceRef,
  supersededPair,
  unavailableSource,
} from "./test-fixtures";

function meta(card: HTMLElement): HTMLElement {
  const node = card.querySelector<HTMLElement>(".claim__meta");
  if (node === null) throw new Error("claim__meta missing");
  return node;
}

/** Direct children of the meta grid, by class, in DOM order. */
function metaCells(card: HTMLElement): string[] {
  return [...meta(card).children].map((child) => child.className);
}

beforeEach(() => {
  document.body.replaceChildren();
  resetPwned();
});

describe("renderClaimCard — sentence and confidence", () => {
  it("renders the full sentence as primary content, untruncated", () => {
    const long =
      "Running several concurrent sessions against one repository is reported to work as long as each session owns a separate worktree, though the reports come from a single thread rather than any documentation at all.";
    const card = renderClaimCard(claim({ claim_text: long }));
    expect(card.tagName).toBe("ARTICLE");
    expect(card.className).toBe("claim");
    expect(card.querySelector(".claim__text")?.textContent).toBe(long);
  });

  it.each([
    ["high", 0.95, "◆ 0.95 high", "claim__conf--high"],
    ["medium", 0.82, "◈ 0.82 medium", "claim__conf--med"],
    ["med", 0.8, "◈ 0.80 medium", "claim__conf--med"],
    ["low", 0.55, "◇ 0.55 low", "claim__conf--low"],
  ])("tier %s %f → glyph + score + word %j", (tier, confidence, text, cls) => {
    const conf = renderClaimCard(claim({ confidence_tier: tier, confidence })).querySelector(
      ".claim__conf",
    );
    expect(conf?.textContent).toBe(text);
    expect(conf?.classList.contains(cls)).toBe(true);
  });

  it("renders `validity: current` for a current claim", () => {
    expect(renderClaimCard(claim()).querySelector(".claim__valid")?.textContent).toBe(
      "validity: current",
    );
  });

  it("keeps the meta to exactly confidence, validity and source, in reading order", () => {
    for (const card of [
      renderClaimCard(claim()),
      renderClaimCard(claim({ endorsement_tier: "owner", verification: "checked" })),
      renderClaimCard(supersededPair().old),
      renderClaimCard(claim({ source: unavailableSource() })),
    ]) {
      expect(metaCells(card)).toEqual([
        expect.stringContaining("claim__conf"),
        "claim__valid",
        expect.stringContaining("claim__src"),
      ]);
    }
  });

  it("fails fast on an unknown tier or an out-of-range score", () => {
    expect(() => renderClaimCard(claim({ confidence_tier: "certain" }))).toThrow(RangeError);
    expect(() => renderClaimCard(claim({ confidence: 1.2 }))).toThrow(/confidence must be 0..1/);
    expect(() => renderClaimCard(claim({ confidence: Number.NaN }))).toThrow(RangeError);
  });
});

describe("renderClaimCard — endorsed / verified marks", () => {
  it.each([
    ["neither", {}, false, false],
    ["endorsed only", { endorsement_tier: "owner" }, true, false],
    ["verified only", { verification: "checked" }, false, true],
    ["both", { endorsement_tier: "owner", verification: "checked" }, true, true],
  ])("%s", (_name, overrides, endorsed, verified) => {
    const card = renderClaimCard(claim(overrides));
    const tags = card.querySelector(".claim__tags");
    expect(tags?.querySelector(".claim__mark--endorsed")?.textContent ?? null).toBe(
      endorsed ? "✓ endorsed" : null,
    );
    expect(tags?.querySelector(".claim__mark--verified")?.textContent ?? null).toBe(
      verified ? "⁂ verified" : null,
    );
    expect(meta(card).textContent.includes("endorsed")).toBe(false);
    expect(meta(card).textContent.includes("verified")).toBe(false);
  });

  it("renders no tag strip when the claim carries no status", () => {
    expect(renderClaimCard(claim()).querySelector(".claim__tags")).toBeNull();
  });

  it("puts the strip above the sentence, superseded first", () => {
    const { old } = supersededPair();
    const card = renderClaimCard({ ...old, endorsement_tier: "owner", verification: "checked" });
    expect(card.firstElementChild?.className).toBe("claim__tags");
    expect([...(card.firstElementChild?.children ?? [])].map((t) => t.textContent)).toEqual([
      "superseded",
      "✓ endorsed",
      "⁂ verified",
    ]);
  });
});

describe("renderClaimCard — superseded", () => {
  it("keeps the struck original, badges it and shows the replacement", () => {
    const { old, replacement } = supersededPair();
    const card = renderClaimCard(old, { replacement: resolveReplacement(old, [replacement]) });
    expect(card.classList.contains("claim--superseded")).toBe(true);
    expect(card.querySelector(".claim__text")?.textContent).toBe(old.claim_text);
    expect(card.querySelector(".claim__now")?.textContent).toBe(`now${replacement.claim_text}`);
    expect(card.querySelector(".claim__now b")?.textContent).toBe("now");
    expect(card.querySelector(".claim__tags .badge.badge--highlight")?.textContent).toBe(
      "superseded",
    );
    const validity = card.querySelector(".claim__valid");
    expect(validity?.textContent).toBe("validity: 2025-03-11 - 2025-06-20");
    // Two unbreakable halves: a narrow card may break only before the end date.
    expect([...(validity?.children ?? [])].map((part) => part.textContent)).toEqual([
      "validity: 2025-03-11",
      "- 2025-06-20",
    ]);
  });

  it.each([
    [
      "the replacement is not in the payload",
      (): ClaimCardOptions => ({ replacement: resolveReplacement(supersededPair().old, []) }),
    ],
    ["no replacement is passed", (): ClaimCardOptions => ({})],
    ["null is passed", (): ClaimCardOptions => ({ replacement: null })],
  ])("renders an explicit unavailable line when %s", (_name, options) => {
    const { old } = supersededPair();
    const card = renderClaimCard(old, options());
    expect(card.querySelector(".claim__now")?.textContent).toBe(`now${REPLACEMENT_UNAVAILABLE}`);
    expect(card.querySelector(".claim__text")?.textContent).toBe(old.claim_text);
  });

  it("rejects a replacement for a current claim", () => {
    const { replacement } = supersededPair();
    expect(() =>
      renderClaimCard(claim(), { replacement: { kind: "available", claim: replacement } }),
    ).toThrow(/is current/);
  });

  it("rejects a replacement whose id does not match superseded_by_claim_id", () => {
    const { old } = supersededPair();
    expect(() =>
      renderClaimCard(old, { replacement: { kind: "available", claim: claim({ claim_id: 9 }) } }),
    ).toThrow(/superseded_by_claim_id is 2/);
  });
});

describe("renderClaimCard — source link", () => {
  it("links the whole two-line block: `view source ↗` over the bare save date", () => {
    const link = renderClaimCard(claim()).querySelector("a.claim__src");
    expect(link?.querySelector(".claim__src-label")?.textContent).toBe("view source ↗");
    expect(link?.querySelector(".claim__src-date")?.textContent).toBe("2025-06-20");
    expect(link?.textContent).not.toContain("saved");
    expect(link?.getAttribute("href")).toBe("https://example.org/notes");
    expect(link?.getAttribute("rel")).toBe("noopener noreferrer");
    expect(link?.hasAttribute("tabindex")).toBe(false);
  });

  it("keeps the source name in the accessible name and tooltip", () => {
    const link = renderClaimCard(claim()).querySelector("a.claim__src");
    expect(link?.getAttribute("aria-label")).toBe("View source: GitHub, 2025-06-20");
    expect(link?.getAttribute("title")).toBe("GitHub");
  });

  it("uses a consumer domain badge's label as the name", () => {
    const card = renderClaimCard(
      claim({ source: sourceRef({ source_type: "web", url: "https://news.example-lab.com/a" }) }),
      { sourceBadges: { domains: { "example-lab.com": { mark: "EL", label: "Example Lab" } } } },
    );
    expect(card.querySelector(".claim__src")?.getAttribute("aria-label")).toBe(
      "View source: Example Lab, 2025-06-20",
    );
  });

  it("falls back to the host when no badge matches", () => {
    const card = renderClaimCard(
      claim({ source: sourceRef({ source_type: "web", url: "https://www.example.org/x" }) }),
    );
    expect(card.querySelector(".claim__src")?.getAttribute("title")).toBe("example.org");
  });

  it("renders an unavailable source as plain text in the same slot, no date, never an empty link", () => {
    const card = renderClaimCard(claim({ source: unavailableSource() }));
    expect(card.querySelector("a")).toBeNull();
    const src = card.querySelector(".claim__src");
    expect(src?.textContent).toBe("source unavailable");
    expect(src?.classList.contains("claim__src--unavailable")).toBe(true);
    expect(src?.querySelector(".claim__src-date")).toBeNull();
  });
});

describe("renderClaimCard — hostile payloads (rendered as text; execution is checked in e2e/trust-hostile.spec.ts)", () => {
  it("renders markup in claim_text and replacement text as inert text", async () => {
    const { old, replacement } = supersededPair();
    const hostileOld = { ...old, claim_text: HOSTILE_MARKUP };
    const hostileNew = { ...replacement, claim_text: HOSTILE_MARKUP };
    const card = renderClaimCard(hostileOld, {
      replacement: { kind: "available", claim: hostileNew },
    });
    document.body.append(card);
    await settle();
    expect(card.querySelector("img")).toBeNull();
    expect(card.querySelector(".claim__text")?.textContent).toBe(HOSTILE_MARKUP);
    expect(card.querySelector(".claim__now")?.textContent).toBe(`now${HOSTILE_MARKUP}`);
    expect(pwned()).toBe(false);
  });

  it("renders a hostile consumer badge label as text", () => {
    const card = renderClaimCard(
      claim({ source: sourceRef({ source_type: "web", url: "https://example-lab.com/a" }) }),
      { sourceBadges: { domains: { "example-lab.com": { mark: "EL", label: HOSTILE_MARKUP } } } },
    );
    const link = card.querySelector(".claim__src");
    expect(card.querySelector("img")).toBeNull();
    expect(link?.getAttribute("title")).toBe(HOSTILE_MARKUP);
    expect(link?.getAttribute("aria-label")).toBe(`View source: ${HOSTILE_MARKUP}, 2025-06-20`);
    expect(link?.textContent).toBe("view source ↗2025-06-20");
  });

  it.each([
    "javascript:globalThis.__trustPwned=1",
    " JaVaScRiPt:globalThis.__trustPwned=1",
    "data:text/html,<script>globalThis.__trustPwned=1</script>",
    "vbscript:msgbox(1)",
    "//evil.example/x",
    "not a url",
  ])("renders source url %j as inert text with no href and no ↗", async (url) => {
    const card = renderClaimCard(claim({ source: sourceRef({ url }) }));
    document.body.append(card);
    const src = card.querySelector<HTMLElement>(".claim__src");
    expect(src?.tagName).toBe("SPAN");
    expect(card.querySelector("[href]")).toBeNull();
    // Inert: the name replaces `view source`, the ↗ is dropped, the date stays.
    expect(src?.textContent).toBe("GitHub2025-06-20");
    src?.click();
    await settle();
    expect(pwned()).toBe(false);
  });
});
