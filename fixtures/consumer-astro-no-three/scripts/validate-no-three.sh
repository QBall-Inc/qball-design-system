#!/usr/bin/env bash
# =============================================================================
# No-three consumer gate (WP-QB-4.3).
#
# `three` is an OPTIONAL peer of @qball-inc/elements, so chat-only sites never
# install it. This gate pins down what happens when a site that DOES mount the
# explorer forgets it, using two static Astro sites that install the PACKED
# tarballs without three:
#   - explorer-only: `astro build` still exits 0, because Vite replaces the
#     missing optional peer with a stub chunk that throws at run time. The
#     built output therefore contains the stub's message, and in the browser
#     the explorer mount resolves with canvasError "three-unavailable" and
#     shows the canvas error figure (e2e/no-three.spec.ts).
#   - launcher-only: builds without three, contains no stub, and runs.
#
# Step 3 runs the consumer hand-back's CI check (stub_check below is that
# check, verbatim: fail when dist/ is missing or contains the stub) on both
# sites: it must fail on explorer-only and pass on launcher-only.
#
# Non-interactive. Exit 0 on PASS, non-zero on any FAIL.
# =============================================================================
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
GATE_DIR="$REPO_ROOT/fixtures/consumer-astro-no-three"
export ASTRO_TELEMETRY_DISABLED=1
cd "$REPO_ROOT"

echo "==> [1/4] Build @qball-inc/elements and pack tokens + elements under stable names"
pnpm --filter @qball-inc/elements run build >/dev/null
rm -f "$GATE_DIR"/qball-inc-*.tgz
( cd packages/tokens && pnpm pack --pack-destination "$GATE_DIR" >/dev/null )
( cd packages/elements && pnpm pack --pack-destination "$GATE_DIR" >/dev/null )
mv -f "$GATE_DIR"/qball-inc-tokens-*.tgz "$GATE_DIR/qball-inc-tokens.tgz"
mv -f "$GATE_DIR"/qball-inc-elements-*.tgz "$GATE_DIR/qball-inc-elements.tgz"

for project in explorer-only launcher-only; do
  dir="$GATE_DIR/$project"
  echo "==> [2/4] $project: install the tarballs WITHOUT three, then astro build (must pass)"
  ( cd "$dir" && rm -rf node_modules dist .astro && pnpm install --ignore-workspace --no-frozen-lockfile >/dev/null )
  if ( cd "$dir" && node -e 'require.resolve("three")' ) 2>/dev/null; then
    echo "FAIL: $project can resolve three; the negative fixture is not negative"; exit 1
  fi
  ( cd "$dir" && pnpm exec astro build >/dev/null ) || {
    echo "FAIL: $project: astro build failed without three (expected it to pass)"; exit 1;
  }
  [ -f "$dir/dist/index.html" ] || { echo "FAIL: $project: astro build emitted no page"; exit 1; }
done

stub_check() (
  cd "$1"
  if [ ! -d dist ] || grep -rqF 'Could not resolve "three"' dist/; then
    echo "dist/ missing, or a page ships a graph that cannot load: install three"; exit 1
  fi
)

echo "==> [3/4] The consumer CI check fails on explorer-only and passes on launcher-only"
if stub_check "$GATE_DIR/explorer-only" >/dev/null; then
  echo "FAIL: the hand-back's CI check passed on explorer-only; it would miss a missing three"; exit 1
fi
stub_check "$GATE_DIR/launcher-only" || {
  echo "FAIL: the hand-back's CI check failed on launcher-only; a chat-only page pulled in the graph"; exit 1;
}

echo "==> [4/4] Browser checks over both built sites (Chromium)"
pnpm exec playwright test --config "$GATE_DIR/playwright.config.mjs"

echo "No-three consumer gate PASSED."
