import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

// The AI sparkle shimmer is the icon system's ONLY animation (§7a). Its motion and
// its reduced-motion fallback live in the shipped @qball-inc/tokens CSS, which jsdom
// neither loads (no external stylesheet) nor evaluates (no @media matching). So the
// conformance is asserted at the CSS-source contract level — read the shipped CSS and
// assert the rule. cwd = packages/react under `vitest run`; source == shipped (RB-10).
const componentsCss = readFileSync(resolve(process.cwd(), "../tokens/components.css"), "utf8");

describe("AI sparkle shimmer — CSS-source contract (§7a, the only animated icon)", () => {
  it("defines .ic-ai-shimmer with an animation paced by a --dur-* token", () => {
    const rule = componentsCss.match(/\.ic-ai-shimmer\s*\{[^}]*\}/)?.[0];
    expect(rule, "no .ic-ai-shimmer rule shipped").toBeTruthy();
    expect(rule).toMatch(/animation:\s*ic-ai-shimmer/);
    // Motion is paced by a design --dur-* token (colors_and_type drop-in namespace),
    // not a magic number (AC-8). Renamed from theme-only --duration-*.
    expect(rule).toMatch(/var\(--dur-[a-z]+\)/);
  });

  it("ships the @keyframes ic-ai-shimmer the animation references", () => {
    expect(componentsCss).toMatch(/@keyframes\s+ic-ai-shimmer\s*\{/);
  });

  it("collapses to a static sparkle under prefers-reduced-motion (no loop)", () => {
    // Mirrors the .skel / .spinner reduced-motion contract: the shipped rule must
    // stop the loop entirely inside a prefers-reduced-motion block.
    const pattern =
      /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{\s*\.ic-ai-shimmer\s*\{[^}]*animation:\s*none/;
    expect(componentsCss, "no reduced-motion animation:none rule for .ic-ai-shimmer").toMatch(
      pattern,
    );
  });
});
