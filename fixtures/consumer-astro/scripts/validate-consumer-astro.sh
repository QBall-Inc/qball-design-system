#!/usr/bin/env bash
# =============================================================================
# Astro consumer gate (WP-QB-1.3).
#
# Proves @qball-inc/tokens + @qball-inc/elements work for a real static Astro
# site that installs the PACKED tarballs exactly as npm would serve them:
#   - the fixture's TypeScript type-checks against the packed .d.ts files;
#   - `astro build` prerenders every page, importing the elements entries
#     server-side (no browser global touched at module load);
#   - Playwright serves the built output and checks every page under e2e/
#     (rendered states, per-theme computed colours, hostile payloads inert,
#     no three.js loaded, token CSS order).
#
# Separate from fixtures/consumer (the React gate): this one adds elements and
# Astro, and later WPs add pages + specs here. Nothing below names a page, so
# new pages and specs are picked up without editing this script.
#
# Registry mode (post-publish check, never part of `ci`): set
#   QBALL_FROM_REGISTRY="<tokens-version>,<elements-version>"
# to skip build + pack and install those PUBLISHED versions from npm instead;
# every later step is identical. package.json is restored afterwards.
#
# Non-interactive. Exit 0 on PASS, non-zero on any FAIL.
# =============================================================================
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
FIXTURE_DIR="$REPO_ROOT/fixtures/consumer-astro"
TOKENS_DIR="$REPO_ROOT/packages/tokens"
ELEMENTS_DIR="$REPO_ROOT/packages/elements"
export ASTRO_TELEMETRY_DISABLED=1
# pnpm --filter / exec resolve against the workspace root, whatever the caller's cwd.
cd "$REPO_ROOT"

if [ -n "${QBALL_FROM_REGISTRY:-}" ]; then
  IFS=, read -r TOKENS_VER ELEMENTS_VER <<<"$QBALL_FROM_REGISTRY"
  # Exact published versions only (no ranges, tags, file: or git specs).
  semver='^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$'
  if ! [[ "$TOKENS_VER" =~ $semver && "$ELEMENTS_VER" =~ $semver ]]; then
    echo "FAIL: QBALL_FROM_REGISTRY must be '<tokens-version>,<elements-version>' (exact versions, e.g. 1.1.0,0.1.0)"; exit 1
  fi
  echo "==> [1-3/5] Registry mode: install @qball-inc/tokens@$TOKENS_VER + @qball-inc/elements@$ELEMENTS_VER from npm"
  cp "$FIXTURE_DIR/package.json" "$FIXTURE_DIR/package.json.bak"
  trap 'mv -f "$FIXTURE_DIR/package.json.bak" "$FIXTURE_DIR/package.json"' EXIT
  node -e '
    const fs = require("fs");
    const [file, tokens, elements] = process.argv.slice(1);
    const pkg = JSON.parse(fs.readFileSync(file, "utf8"));
    pkg.dependencies["@qball-inc/tokens"] = tokens;
    pkg.dependencies["@qball-inc/elements"] = elements;
    fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + "\n");
  ' "$FIXTURE_DIR/package.json" "$TOKENS_VER" "$ELEMENTS_VER"
  ( cd "$FIXTURE_DIR" && rm -rf node_modules dist .astro pnpm-lock.yaml && pnpm install --ignore-workspace --no-frozen-lockfile >/dev/null )
  for pkg in tokens elements; do
    want="$([ "$pkg" = tokens ] && echo "$TOKENS_VER" || echo "$ELEMENTS_VER")"
    got="$(node -p "require('$FIXTURE_DIR/node_modules/@qball-inc/$pkg/package.json').version")"
    [ "$got" = "$want" ] || { echo "FAIL: installed @qball-inc/$pkg@$got, expected $want"; exit 1; }
  done
else
  echo "==> [1/5] Build @qball-inc/elements (tsup) so dist/ is packable"
  pnpm --filter @qball-inc/elements run build >/dev/null

  echo "==> [2/5] Pack tokens + elements (pnpm pack) under stable file names"
  rm -f "$FIXTURE_DIR"/qball-inc-*.tgz
  ( cd "$TOKENS_DIR" && pnpm pack --pack-destination "$FIXTURE_DIR" >/dev/null )
  ( cd "$ELEMENTS_DIR" && pnpm pack --pack-destination "$FIXTURE_DIR" >/dev/null )
  mv -f "$FIXTURE_DIR"/qball-inc-tokens-*.tgz "$FIXTURE_DIR/qball-inc-tokens.tgz"
  mv -f "$FIXTURE_DIR"/qball-inc-elements-*.tgz "$FIXTURE_DIR/qball-inc-elements.tgz"

  echo "==> [3/5] Install the tarballs into the fixture (standalone; no workspace link)"
  ( cd "$FIXTURE_DIR" && rm -rf node_modules dist .astro && pnpm install --ignore-workspace --no-frozen-lockfile >/dev/null )
fi

echo "==> [4/5] Type-check against the packed types, then astro build"
pnpm exec tsc --noEmit -p "$FIXTURE_DIR/tsconfig.json"
( cd "$FIXTURE_DIR" && pnpm exec astro build >/dev/null )
[ -n "$(find "$FIXTURE_DIR/dist" -name '*.html' -print -quit)" ] || {
  echo "FAIL: astro build emitted no pages"; exit 1;
}

echo "==> [5/5] Browser checks over the built site (Chromium)"
pnpm exec playwright test --config "$FIXTURE_DIR/playwright.config.mjs"

echo "Astro consumer gate PASSED."
