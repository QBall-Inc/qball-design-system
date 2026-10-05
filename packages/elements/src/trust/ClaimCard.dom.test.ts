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

  it("renders the valid-from date for a current claim", () => {
    expect(meta(renderClaimCard(claim())).textContent).toContain("valid from 2025-06-20");
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
    expect(card.querySelector(".claim__mark--endorsed")?.textContent ?? null).toBe(
      endorsed ? "✓ endorsed" : null,
    );
    expect(card.querySelector(".claim__mark--verified")?.textContent ?? null).toBe(
      verified ? "⁂ verified" : null,
    );
    expect(meta(card).textContent.includes("endorsed")).toBe(endorsed);
    expect(meta(card).textContent.includes("verified")).toBe(verified);
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
    expect(card.querySelector(".badge.badge--highlight")?.textContent).toBe("superseded");
    expect(meta(card).textContent).toContain("valid 2025-03-11 → 2025-06-20");
    expect(meta(card).textContent).not.toContain("valid from");
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
  it("links a platform source with its label, save date and rel", () => {
    const link = renderClaimCard(claim()).querySelector("a.claim__src");
    expect(link?.textContent).toBe("GitHub · saved 2025-06-20 ↗");
    expect(link?.getAttribute("href")).toBe("https://example.org/notes");
    expect(link?.getAttribute("rel")).toBe("noopener noreferrer");
    expect(link?.hasAttribute("tabindex")).toBe(false);
  });

  it("uses a consumer domain badge's label", () => {
    const card = renderClaimCard(
      claim({ source: sourceRef({ source_type: "web", url: "https://news.example-lab.com/a" }) }),
      { sourceBadges: { domains: { "example-lab.com": { mark: "EL", label: "Example Lab" } } } },
    );
    expect(card.querySelector(".claim__src")?.textContent).toBe("Example Lab · saved 2025-06-20 ↗");
  });

  it("falls back to the host when no badge matches", () => {
    const card = renderClaimCard(
      claim({ source: sourceRef({ source_type: "web", url: "https://www.example.org/x" }) }),
    );
    expect(card.querySelector(".claim__src")?.textContent).toBe("example.org · saved 2025-06-20 ↗");
  });

  it("renders an unavailable source as plain text, never an empty link", () => {
    const card = renderClaimCard(claim({ source: unavailableSource() }));
    expect(card.querySelector("a")).toBeNull();
    expect(card.querySelector(".claim__src")?.textContent).toBe("source unavailable");
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
    expect(card.querySelector("img")).toBeNull();
    expect(card.querySelector(".claim__src")?.textContent).toBe(
      `${HOSTILE_MARKUP} · saved 2025-06-20 ↗`,
    );
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
    expect(src?.textContent).toBe("GitHub · saved 2025-06-20");
    src?.click();
    await settle();
    expect(pwned()).toBe(false);
  });
});
