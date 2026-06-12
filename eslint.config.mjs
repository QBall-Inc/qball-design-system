// ESLint flat config for the QBall Design System workspace (WP-B-0.1 scaffold).
// Covers the published packages (packages/*) + repo config files. Mirrors the
// stock-watcher conventions (typescript-eslint recommendedTypeChecked, Prettier
// last). The DESIGN.md mechanical conformance deny-rule (no-box-shadow,
// no-hardcoded-hex/rgb, no-pill-radius) is the `DESIGN_DENY` block below — the
// mechanical layer of the RB-8 two-layer gate. It is scoped to component source
// (packages/*/src) and pairs with a per-component
// VISUAL conformance review at Code Review close (the semantic rules — sage-
// leads-amber, finance-color-plus-cue, no-gradient/glass, no-emoji — that lint
// cannot catch). Passing lint alone does NOT discharge DESIGN.md conformance.

import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";
import prettier from "eslint-config-prettier";

// DESIGN.md mechanical deny-rule (RB-8 layer (a) / FR4). Each entry is an
// esquery selector matched against string Literals and template chunks in
// component source. Tightened to avoid baseline false-positives: the hex
// matcher requires a 3/4/6/8-digit color form with a word boundary (so `href="#"`
// and `#section` anchors do not trip); the radius matcher requires the
// `border-radius:` CSS context plus a >12px / pill value.
const HEX = "#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\\b";
const RGB = "rgba?\\(";
const SHADOW = "box-shadow";
const PILL_RADIUS = "border-radius\\s*:\\s*(?:9{3,}px|(?:1[3-9]|[2-9][0-9]|[1-9][0-9]{2,})px)";
const ROUNDED_FULL = "rounded-full";

const denyLiteralAndTemplate = (pattern, message) => [
  { selector: `Literal[value=/${pattern}/]`, message },
  { selector: `TemplateElement[value.raw=/${pattern}/]`, message },
];

const DESIGN_DENY = [
  ...denyLiteralAndTemplate(
    HEX,
    "DESIGN.md (FR4): no hardcoded hex colors in component source — reference a var(--*) token from @qball-inc/tokens.",
  ),
  ...denyLiteralAndTemplate(
    RGB,
    "DESIGN.md (FR4): no raw rgb()/rgba() colors in component source — reference a var(--*) token from @qball-inc/tokens.",
  ),
  ...denyLiteralAndTemplate(
    SHADOW,
    "DESIGN.md (No Shadows): no box-shadow — lift via border weight + tonal surface step + scrim.",
  ),
  {
    selector: "Property[key.name='boxShadow']",
    message:
      "DESIGN.md (No Shadows): no boxShadow inline style — lift via border weight + tonal surface step + scrim.",
  },
  ...denyLiteralAndTemplate(
    PILL_RADIUS,
    "DESIGN.md (Radii): component radius must be ≤12px — pills (999px) are off-brand.",
  ),
  ...denyLiteralAndTemplate(
    ROUNDED_FULL,
    "DESIGN.md (Radii): no rounded-full / pill radius — max 12px.",
  ),
];

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/coverage/**",
      "**/*.d.ts",
      // Pre-existing static gallery / DS-packet content — browser HTML/CSS
      // served as-authored, not part of the workspace lint scope (D-09).
      "preview/**",
      "assets/**",
      "reference/**",
      // WP-B-2.0a throwaway consumer harness — a standalone Vite + React 18 app
      // with its own tsconfig, built/asserted only via `just consumer-validate`.
      // Not a workspace member; lives outside the library lint scope.
      "fixtures/**",
    ],
  },
  // Plain JS / config files: JS recommended only (no type-aware rules).
  {
    files: ["**/*.{js,mjs,cjs}"],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...globals.node },
    },
  },
  // TypeScript files: type-aware rules via projectService (resolves the owning
  // tsconfig per file automatically).
  {
    files: ["**/*.{ts,tsx,mts,cts}"],
    extends: [js.configs.recommended, ...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: { ...globals.node },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  // DESIGN.md mechanical conformance deny-rule (RB-8 layer (a)).
  // Scoped to component source so the static gallery, config, and test-fixture
  // code are unaffected; the published token CSS owns all real color/radius/
  // shadow values, so component .tsx must reference tokens, never literals.
  {
    files: ["packages/*/src/**/*.{ts,tsx,mts,cts}"],
    rules: {
      "no-restricted-syntax": ["error", ...DESIGN_DENY],
    },
  },
  // Prettier last — disables stylistic rules that conflict with Prettier.
  prettier,
);
