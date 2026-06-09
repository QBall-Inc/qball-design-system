// ESLint flat config for the QBall Design System workspace (WP-B-0.1 scaffold).
// Covers the published packages (packages/*) + repo config files. Mirrors the
// stock-watcher conventions (typescript-eslint recommendedTypeChecked, Prettier
// last). DESIGN.md conformance lint rules (no-box-shadow, no-hardcoded-hex,
// no-pill-radius, etc.) are authored in WP-B-0.2 and the component WPs.

import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";
import prettier from "eslint-config-prettier";

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
  // Prettier last — disables stylistic rules that conflict with Prettier.
  prettier,
);
