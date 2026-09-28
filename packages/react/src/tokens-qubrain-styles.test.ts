import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

// CSS-source contract for the QuBrain / QuBae styles port (@qball-inc/tokens 1.1.0).
// jsdom neither loads stylesheets nor matches @media, so — like the other token
// contract tests — this reads the SHIPPED CSS from disk (cwd = packages/react).
const tokensDir = resolve(process.cwd(), "../tokens");
const read = (file: string): string => readFileSync(resolve(tokensDir, file), "utf8");

const componentsCss = read("components.css");
const graphCss = read("graph.css");
const colorsCss = read("colors_and_type.css");
const tokensPkg = JSON.parse(read("package.json")) as {
  exports: Record<string, string>;
  files: string[];
};
const tokensJson = JSON.parse(read("tokens.json")) as Record<string, unknown>;

/**
 * Value of the first declaration of `prop` in `css`. Asserts the declaration exists
 * with a non-blank value, so a deleted, renamed or whitespace-only token fails loudly
 * instead of letting an equality / inequality check compare "" and pass vacuously.
 */
function declaredValue(css: string, prop: string): string {
  const value = new RegExp(`${prop}:\\s*([^;]+);`).exec(css)?.[1]?.trim() ?? "";
  expect(value, `${prop} is not declared (or is blank)`).not.toBe("");
  return value;
}
const cssValue = (prop: string): string => declaredValue(colorsCss, prop);

// Pre-1.1.0 components.css (tokens 1.0.1, commit 9c2067a): the shipped rules every
// existing consumer depends on. The port is append-only, so the file must still START
// with exactly these bytes. A deliberate edit to a shipped rule must update this
// baseline on purpose (and is a semver decision), never silently.
const SHIPPED_BYTES = 60055;
const SHIPPED_SHA256 = "b6ba6b820f8497b55fa3f5959b9dfd16627ec888a6c66b125e2f53601db93e6f";

const componentsBuf = readFileSync(resolve(tokensDir, "components.css"));
const addedCss = componentsBuf.subarray(SHIPPED_BYTES).toString("utf8");
const newCss = `${addedCss}\n${graphCss}`;

/** Custom properties defined anywhere in the given CSS (`--name:`). */
function definedProps(css: string): Set<string> {
  return new Set([...css.matchAll(/(--[a-z0-9-]+)\s*:/gi)].map((m) => m[1] ?? ""));
}

/** Custom properties referenced via `var(--name…)`. */
function referencedProps(css: string): Set<string> {
  return new Set([...css.matchAll(/var\((--[a-z0-9-]+)/gi)].map((m) => m[1] ?? ""));
}

/** Concatenated bodies of every `@media (prefers-reduced-motion:reduce)` block. */
function reducedMotionCss(css: string): string {
  return [
    ...css.matchAll(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{((?:[^{}]*\{[^}]*\})+)\s*\}/g,
    ),
  ]
    .map((m) => m[1] ?? "")
    .join("\n");
}

describe("@qball-inc/tokens 1.1.0 — shipped components.css is untouched", () => {
  it("still starts with the exact pre-1.1.0 bytes (append-only port)", () => {
    const prefix = componentsBuf.subarray(0, SHIPPED_BYTES);
    expect(prefix.length).toBe(SHIPPED_BYTES);
    expect(createHash("sha256").update(prefix).digest("hex")).toBe(SHIPPED_SHA256);
  });

  it("appends the QuBrain trust + QuBae chat classes after the shipped content", () => {
    for (const selector of [
      ".claim{",
      ".srcrow{",
      ".provfoot{",
      ".facetbar{",
      ".epanel{",
      ".nrow{",
      ".qlaunch{",
      ".qpanel{",
      ".vstamp{",
      ".vbox{",
      ".qnotice{",
      ".qlink{",
      ".qcursor{",
    ]) {
      expect(addedCss, `missing ${selector}`).toContain(selector);
    }
  });
});

describe("graph.css — opt-in subpath", () => {
  it("is exported and published alongside components.css", () => {
    expect(tokensPkg.exports["./graph.css"]).toBe("./graph.css");
    expect(tokensPkg.files).toContain("graph.css");
  });

  it("stays out of components.css (existing consumers pay nothing)", () => {
    expect(componentsCss).not.toMatch(/@import|url\([^)]*graph\.css/);
    expect(componentsCss).not.toMatch(/\.(gx|graphcanvas)\b/);
    expect(graphCss).toMatch(/\.graphcanvas\{/);
    expect(graphCss).toMatch(/\.gx\{/);
  });

  it("puts the whole explorer on the dark stage, with the brighter canvas tier on the canvas", () => {
    const panelTier = /\.gx,\.gx \[data-theme\]\{([^}]*)\}/.exec(graphCss)?.[1] ?? "";
    expect(panelTier).toContain("--text-secondary:var(--stage-panel-text-secondary)");
    expect(panelTier).toContain("--text-muted:var(--stage-panel-text-muted)");
    expect(panelTier).toContain("--data-up:var(--stage-data-up)");

    const canvasTier =
      /\.graphcanvas,\.graphcanvas\[data-theme\],[^{]*\{([^}]*)\}/.exec(graphCss)?.[1] ?? "";
    expect(canvasTier).toContain("--bg-primary:var(--stage-bg)");
    expect(canvasTier).toContain("--text-primary:var(--stage-text-primary)");
    expect(canvasTier).toContain("--border-strong:var(--stage-border-strong)");
  });

  it("mirrors every stage token 1:1 in tokens.json", () => {
    const stageJson = (tokensJson["stage"] ?? {}) as Record<string, { $value?: unknown }>;
    const cssStage = [...colorsCss.matchAll(/--stage-([a-z-]+):\s*([^;]+);/g)];
    // Anti-vacuous: 0 CSS tokens vs 0 JSON tokens must not count as "mirrored".
    expect(cssStage.length).toBeGreaterThan(0);
    expect(cssStage.length).toBe(Object.keys(stageJson).filter((k) => !k.startsWith("$")).length);
    for (const [, name = "", value = ""] of cssStage) {
      expect(String(stageJson[name]?.$value).replace(/\s/g, ""), `--stage-${name}`).toBe(
        value.replace(/\s/g, ""),
      );
    }
    expect(cssValue("--text-scale")).toBe("1");
    expect((tokensJson["scale"] as Record<string, { $value?: unknown }>)["text"]?.$value).toBe(1);
  });

  it("uses the site's lighter panel greys, not the page dark theme (owner decision S113)", () => {
    const darkTheme = /\[data-theme="dark"\]\s*\{([^}]*)\}/.exec(colorsCss)?.[1] ?? "";
    // Both sides of every comparison below are asserted present and non-blank first.
    const dark = (prop: string): string => declaredValue(darkTheme, prop);
    expect(cssValue("--stage-panel-text-secondary")).not.toBe(dark("--text-secondary"));
    expect(cssValue("--stage-panel-text-muted")).not.toBe(dark("--text-muted"));
    // Panel text-primary and surfaces match the dark theme; the canvas labels are brighter still.
    expect(cssValue("--stage-panel-text-primary")).toBe(dark("--text-primary"));
    expect(cssValue("--stage-panel-bg")).toBe(dark("--bg-primary"));
    expect(cssValue("--stage-text-primary")).not.toBe(dark("--text-primary"));
  });
});

describe("new styles are token-driven and self-contained", () => {
  it("references only tokens that the shipped CSS defines", () => {
    const defined = new Set([...definedProps(colorsCss), ...definedProps(newCss)]);
    // Set inline by the component at runtime (documented in docs/frozen-tokens.md).
    const componentProvided = new Set(["--tdur"]);
    const referenced = referencedProps(newCss);
    expect(referenced.size).toBeGreaterThan(0); // anti-vacuous: an empty set has nothing "missing"
    const missing = [...referenced].filter((p) => !defined.has(p) && !componentProvided.has(p));
    expect(missing).toEqual([]);
  });

  it("introduces no raw colours outside the documented exceptions", () => {
    const allowed = [
      /\.qb-(screen|scan|eye|glint|dot)\{fill:#[0-9A-F]{6}\}/g, // mascot fills (.stocky-screen precedent)
      /--wave-hi:#A7D0F0/g, // sources shimmer highlight (shipped --wave-hi precedent)
      /color-mix\(in srgb,var\(--[a-z-]+\) 35%,#fff\)/g, // stamp shimmer highlight mix
      /#000(?= )|#000\)/g, // alpha mask stops (not a colour)
      /box-shadow:0 18px 48px rgba\(20,20,20,\.18\)/g, // DESIGN.md exception 1: qpanel lift
    ];
    const stripped = allowed.reduce((css, re) => css.replace(re, ""), newCss);
    expect(stripped.match(/#[0-9a-f]{3,8}\b|rgba?\(/gi) ?? []).toEqual([]);
  });

  it("sizes every new text via --text-scale (the chat launcher keeps its fluid clamp)", () => {
    const sizes = [...newCss.matchAll(/font-size:([^;}]+)/g)].map((m) => m[1] ?? "");
    const unscaled = sizes.filter(
      (s) => !/^calc\([\d.]+px \* var\(--text-scale, 1\)\)$/.test(s) && !s.startsWith("clamp("),
    );
    // Anti-vacuous guard: the port carries ~55 sized rules; a broken regex that
    // matched nothing would otherwise pass the "no unscaled sizes" check below.
    expect(sizes.length).toBeGreaterThan(40);
    expect(unscaled).toEqual([]);
    expect(addedCss).toContain(
      ".claim .badge,.epanel .badge{font-size:calc(11px * var(--text-scale, 1))}",
    );
    expect(addedCss).toContain(
      ".qlaunch__cap{display:flex;align-items:center;gap:5px;font-family:var(--font-ui);font-size:clamp(9.5px,.6vw,11px)",
    );
  });

  it("gives every new animation and slide a prefers-reduced-motion fallback", () => {
    const reduced = reducedMotionCss(newCss);
    for (const selector of [
      ".qlaunch__dot",
      ".qpanel",
      ".qoverlay__scrim",
      ".vstamp__wave",
      ".vrow__txt.is-ticking .vtick",
      ".qcursor",
      ".gx__panel",
    ]) {
      expect(reduced, `no reduced-motion rule for ${selector}`).toContain(`${selector}{`);
    }
    // The sources shimmer rides the shipped .ground-wave rule, which already stops under reduced motion.
    expect(addedCss).toMatch(
      /\.ground-wave--sources\{--wave-base:var\(--data-info\);--wave-hi:#A7D0F0\}/,
    );
  });
});

describe("public-repo hygiene", () => {
  it("carries no owner-personal copy, names or backend limits", () => {
    expect(newCss).not.toMatch(/ashay|my knowledge graph|\b(12|20) questions?\b|qlimit/i);
  });
});
