import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { componentsCss, ruleBody } from "../test-utils/css-source";
import { MarkdownRenderer } from "./MarkdownRenderer";

// The prose surface (bare h1-h4/p/blockquote/code/pre/a styles) ships in
// @qball-inc/tokens colors_and_type.css; the streaming cursor + its reduced-motion
// fallback ship in components.css. jsdom loads neither external sheet, so those
// token / @media guarantees are asserted at the CSS-SOURCE contract level (read
// from disk), while behaviour (which elements render, sanitization) is asserted on
// the DOM. cwd = package dir, so the sibling tokens package resolves at ../tokens.
const typeCss = readFileSync(resolve(process.cwd(), "../tokens/colors_and_type.css"), "utf8");
const componentSrc = readFileSync(resolve(process.cwd(), "src/ai/MarkdownRenderer.tsx"), "utf8");

/** Reads `window.__xss` without widening the global type. */
function xssFlag(): unknown {
  return (window as unknown as Record<string, unknown>)["__xss"];
}

afterEach(() => {
  // Defensive: no payload should ever set this, but never let one test's leak mask
  // another's. (If a payload HAD executed, the same-test assertion already failed.)
  delete (window as unknown as Record<string, unknown>)["__xss"];
});

describe("MarkdownRenderer", () => {
  // ── Element mapping (AC-1/AC-2) ───────────────────────────────────────────
  it("renders headings h1-h4 as the matching element tags", () => {
    const { container } = render(<MarkdownRenderer content={"# A\n\n## B\n\n### C\n\n#### D"} />);
    expect(container.querySelector("h1")?.textContent).toBe("A");
    expect(container.querySelector("h2")?.textContent).toBe("B");
    expect(container.querySelector("h3")?.textContent).toBe("C");
    expect(container.querySelector("h4")?.textContent).toBe("D");
  });

  it("renders p / inline code / blockquote / anchor for the matching markdown", () => {
    const { container } = render(
      <MarkdownRenderer
        content={"Para with `code`.\n\n> A quote.\n\n[link](https://example.com)"}
      />,
    );
    expect(container.querySelector("p")).not.toBeNull();
    expect(container.querySelector("code")?.textContent).toBe("code");
    expect(container.querySelector("blockquote")?.textContent).toContain("A quote.");
    expect(container.querySelector("a")?.textContent).toBe("link");
  });

  it("renders a fenced code block as <pre><code>", () => {
    const { container } = render(<MarkdownRenderer content={"```\nconst x = 1;\n```"} />);
    const pre = container.querySelector("pre");
    expect(pre).not.toBeNull();
    expect(pre?.querySelector("code")?.textContent).toContain("const x = 1;");
  });

  it("renders emphasis, lists, and a horizontal rule from the matching markdown", () => {
    const { container } = render(
      <MarkdownRenderer content={"*em* and **strong**\n\n- one\n- two\n\n1. first\n\n---"} />,
    );
    expect(container.querySelector("em")?.textContent).toBe("em");
    expect(container.querySelector("strong")?.textContent).toBe("strong");
    expect(container.querySelectorAll("ul li").length).toBeGreaterThanOrEqual(2);
    expect(container.querySelector("ol li")).not.toBeNull();
    expect(container.querySelector("hr")).not.toBeNull();
  });

  // ── Bare-element prose styling is shipped (AC-6/AC-7 oracle contract) ──────
  it("AC-7: shipped blockquote prose style uses the quote font token (pull-quote oracle)", () => {
    expect(ruleBody(typeCss, "blockquote, .pullquote")).toMatch(/var\(--font-quote\)/);
  });

  it("AC-6: shipped code/pre prose styles use the code font token (code-block oracle)", () => {
    expect(ruleBody(typeCss, "pre, .codeblock")).not.toBe("");
    expect(ruleBody(typeCss, "code, .code")).toMatch(/var\(--font-code\)/);
  });

  // ── Anchor handling: .link hook + safe rel (AC-8 focus ring, Q3) ──────────
  it("renders anchors with the .link class so the shared sage focus ring applies", () => {
    const { container } = render(<MarkdownRenderer content={"[x](https://example.com)"} />);
    const a = container.querySelector("a");
    expect(a?.classList.contains("link")).toBe(true);
    expect(a?.getAttribute("href")).toBe("https://example.com");
    expect(a?.getAttribute("rel")).toContain("noopener");
  });

  it("AC-8: the shared sage :focus-visible ring is extended to prose links (.link:focus-visible)", () => {
    expect(componentsCss).toMatch(/\.link:focus-visible/);
  });

  // ── Allowlist is default-deny (AC-4) ──────────────────────────────────────
  it("drops elements outside the allowlist (markdown image → no <img>)", () => {
    const { container } = render(
      <MarkdownRenderer content={"![alt](https://example.com/x.png)"} />,
    );
    expect(container.querySelector("img")).toBeNull();
  });

  // ── XSS dual-assert rejection (AC-9 — BINDING security gate) ───────────────
  // Each case asserts BOTH that the payload did not execute (window.__xss
  // undefined) AND that the disallowed element is absent from the DOM
  // (feedback_dual_assertion_rce_regression).
  it("AC-9a: <script> payload neither executes nor renders a <script> element", () => {
    const { container } = render(<MarkdownRenderer content={"<script>window.__xss=1</script>"} />);
    expect(xssFlag()).toBeUndefined();
    expect(container.querySelector("script")).toBeNull();
  });

  it("AC-9b: <img onerror> payload neither executes nor renders an <img> element", () => {
    const { container } = render(
      <MarkdownRenderer content={'<img src=x onerror="window.__xss=2">'} />,
    );
    expect(xssFlag()).toBeUndefined();
    expect(container.querySelector("img")).toBeNull();
  });

  it("AC-9c: javascript: link is neutralized — no execution, href is not javascript:", () => {
    const { container } = render(
      <MarkdownRenderer content={"[click](<javascript:window.__xss=3>)"} />,
    );
    expect(xssFlag()).toBeUndefined();
    const href = container.querySelector("a")?.getAttribute("href") ?? "";
    expect(href).not.toMatch(/^javascript:/i);
  });

  it("AC-9d: <iframe data:> payload neither executes nor renders an <iframe> element", () => {
    const { container } = render(
      <MarkdownRenderer
        content={'<iframe src="data:text/html,<script>window.__xss=4</script>"></iframe>'}
      />,
    );
    expect(xssFlag()).toBeUndefined();
    expect(container.querySelector("iframe")).toBeNull();
  });

  // AC-9 (link-scheme regression net): the dangerous-scheme variants a hand-rolled
  // regex would miss — bare/uppercase, control-char-interrupted, and the other
  // executable schemes — all collapse to a safe href via defaultUrlTransform.
  const DANGEROUS_LINKS = [
    { label: "bare javascript:", content: "[x](javascript:window.__xss=11)" },
    { label: "uppercase JAVASCRIPT:", content: "[x](JAVASCRIPT:window.__xss=12)" },
    { label: "vbscript:", content: "[x](vbscript:window.__xss=13)" },
    { label: "data:text/html", content: "[x](data:text/html,alert(14))" },
    { label: "leading-space javascript:", content: "[x](<  javascript:window.__xss=15>)" },
    { label: "tab-interrupted javascript:", content: "[x](<java\tscript:window.__xss=16>)" },
  ];

  it.each(DANGEROUS_LINKS)(
    "AC-9 link scheme: neutralizes $label (no execution, href is not a dangerous scheme)",
    ({ content }) => {
      const { container } = render(<MarkdownRenderer content={content} />);
      expect(xssFlag()).toBeUndefined();
      // defaultUrlTransform collapses every dangerous scheme to an empty href; assert
      // both the empty result AND (defensively) that no dangerous scheme leaked.
      const href = container.querySelector("a")?.getAttribute("href") ?? "";
      expect(href).toBe("");
      expect(href.trim()).not.toMatch(/^(javascript|data|vbscript):/i);
    },
  );

  it("AC-9 link scheme: protocol-relative //host passes through as a navigable link (intentional)", () => {
    // No scheme → resolves to the page protocol (http/https): a navigable link, not an
    // XSS sink. We intentionally do not block it (react-markdown's default policy).
    const { container } = render(<MarkdownRenderer content={"[x](//example.com/page)"} />);
    expect(container.querySelector("a")?.getAttribute("href")).toBe("//example.com/page");
  });

  // ── Streaming cursor (AC-5) — composes the shipped .term__cursor ──────────
  it("appends the shipped .term__cursor when streaming and removes it when not", () => {
    const { container, rerender } = render(
      <MarkdownRenderer content={"answer in progress"} streaming />,
    );
    expect(container.querySelector(".term__cursor")).not.toBeNull();

    rerender(<MarkdownRenderer content={"answer in progress"} streaming={false} />);
    expect(container.querySelector(".term__cursor")).toBeNull();
  });

  it("AC-5/NFR5: the cursor blink is suppressed under reduced-motion via shipped CSS (no JS matchMedia)", () => {
    // jsdom can't compute external @media; assert the shipped stylesheet declares a
    // reduced-motion block that zeroes the .term__cursor animation (a static block,
    // not a silent removal), and that the component carries no matchMedia.
    expect(componentsCss).toMatch(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{\s*\.term__cursor\s*\{[^}]*animation:\s*none[^}]*\}/,
    );
    // Assert no matchMedia CALL — `/matchMedia\(/`, not the bare substring, so the
    // JSDoc's "no matchMedia here" prose doesn't trip the check (self-assertion trap).
    expect(componentSrc).not.toMatch(/matchMedia\(/);
  });

  // ── Token-only / no-shadow source contract (AC-8/AC-10) ───────────────────
  it("ships zero component CSS: no shadow, no hardcoded color, no font string in source (AC-10)", () => {
    // The literal "box-shadow" is itself DESIGN_DENY-blocked (as in Tooltip/GroundingFlag
    // tests); assert the broad "shadow" substring — also catches drop/text-shadow.
    expect(componentSrc).not.toContain("shadow");
    expect(componentSrc).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(componentSrc).not.toMatch(/\b(rgb|hsl)\(/);
    // Prose styling is inherited from the shipped sheet — the component declares no
    // font-family of its own.
    expect(componentSrc).not.toMatch(/font-family/);
  });

  it("AC-3: never uses dangerouslySetInnerHTML (no raw-HTML sink in source)", () => {
    // Match the PROP USAGE (`dangerouslySetInnerHTML=`), not the bare word — the JSDoc
    // says "No dangerouslySetInnerHTML, ever", which a substring grep would trip on
    // (the same self-assertion trap as the matchMedia check above).
    expect(componentSrc).not.toMatch(/dangerouslySetInnerHTML\s*=/);
  });
});
