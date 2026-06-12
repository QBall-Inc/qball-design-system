#!/usr/bin/env bash
# =============================================================================
# WP-B-2.0a — Consumer distribution gate.
#
# Proves the two-pronged @qball-inc distribution model in one real consumer app:
#   - Strategy-2 (canonical): the SHIPPED component CSS (.btn) reaches a
#     tarball-installed consumer and its token vars resolve self-contained (AC-5).
#   - Optional utility surface (additive): tailwindcss + the token @theme generate
#     token utilities (bg-surface) for the CONSUMER's own markup (AC-6), with a
#     single Tailwind base block (AC-7).
#   - Negative control: drop the required component CSS and the .btn-delivery
#     assertion must fail — the gate has teeth (AC-8).
#
# Packaging uses `pnpm pack` (NOT `npm pack`): the react package depends on
# @qball-inc/tokens via `workspace:*`, and only pnpm rewrites that protocol to a
# real version (0.0.0) — exactly what the npm publish path (WP-B-5.3 changesets/
# pnpm publish) will serve. `npm pack` would leave an unresolvable `workspace:*`
# in the tarball. This is a recorded S72 deviation from AC-2's literal "npm pack"
# wording, owner-approved, honoring AC-1's "consume exactly what npm serves" intent.
#
# Non-interactive. Exit 0 on PASS, non-zero on any FAIL.
# =============================================================================
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
FIXTURE_DIR="$REPO_ROOT/fixtures/consumer"
TOKENS_DIR="$REPO_ROOT/packages/tokens"
REACT_DIR="$REPO_ROOT/packages/react"
INDEX_CSS="$FIXTURE_DIR/src/index.css"
INSTALLED_TOKENS_CSS="$FIXTURE_DIR/node_modules/@qball-inc/tokens/colors_and_type.css"

# Locate THE single emitted stylesheet (vite cssCodeSplit:false -> exactly one).
# Echoes the path; returns non-zero if the build did not emit exactly one CSS file
# (guards both a vacuous empty-bundle pass and a non-deterministic multi-file glob).
css_file() {
  local matches
  matches=$(find "$FIXTURE_DIR/dist/assets" -name '*.css')
  [ "$(printf '%s' "$matches" | grep -c .)" = "1" ] || return 1
  printf '%s\n' "$matches"
}

build_fixture() {
  rm -rf "$FIXTURE_DIR/dist"
  ( cd "$FIXTURE_DIR" && pnpm exec vite build >/dev/null )
}

echo "==> [1/6] Build @qball-inc/react (tsup) so dist/ is packable"
pnpm --filter @qball-inc/react run build >/dev/null

echo "==> [2/6] Pack tokens + react from each package dir (pnpm pack; workspace:* rewritten)"
rm -f "$FIXTURE_DIR"/qball-inc-*.tgz
( cd "$TOKENS_DIR" && pnpm pack --pack-destination "$FIXTURE_DIR" >/dev/null )
( cd "$REACT_DIR" && pnpm pack --pack-destination "$FIXTURE_DIR" >/dev/null )

echo "==> [3/6] Install the tarballs into the fixture (standalone; no workspace symlink — AR15)"
( cd "$FIXTURE_DIR" && rm -rf node_modules dist && pnpm install --ignore-workspace --no-frozen-lockfile >/dev/null )

echo "==> [4/6] Build the fixture (Strategy-2 component CSS + optional utility wiring)"
build_fixture
CSS="$(css_file)" || { echo "FAIL: positive build did not emit exactly one CSS file"; exit 1; }

echo "==> [5/6] Assert delivery (AC-5), optional utility (AC-6), single Tailwind base (AC-7)"
fail=0

# AC-5a — Strategy-2 delivery: the shipped .btn rule reaches the built bundle.
grep -qE '\.btn[[:space:]]*\{' "$CSS" || {
  echo "FAIL AC-5: .btn rule absent from built CSS (component styling did not ship)"; fail=1;
}
# AC-5b — the token vars the .btn family references are defined in the bundle.
for v in --radius-sm --bg-surface --signal-bg; do
  grep -qE -- "${v}[[:space:]]*:" "$CSS" || {
    echo "FAIL AC-5: token var $v has no definition in the built CSS"; fail=1;
  }
done
# AC-5c — self-containment (masking-proof): the SHIPPED component CSS defines those
# vars on its own, so the optional theme.css in the bundle cannot mask a Strategy-2
# gap. Asserts against the installed tarball file, not the merged bundle.
[ -f "$INSTALLED_TOKENS_CSS" ] || { echo "FAIL AC-5: installed colors_and_type.css missing"; fail=1; }
for v in --radius-sm --bg-surface --signal-bg; do
  grep -qE -- "${v}[[:space:]]*:" "$INSTALLED_TOKENS_CSS" 2>/dev/null || {
    echo "FAIL AC-5: $v not defined in the SHIPPED colors_and_type.css (not self-contained)"; fail=1;
  }
done

# AC-6 — optional token utility generated for CONSUMER markup (the only utility check).
grep -qE '\.bg-surface[[:space:]]*\{' "$CSS" || {
  echo "FAIL AC-6: consumer bg-surface utility not generated (optional path mis-wired)"; fail=1;
}

# AC-7 — exactly one Tailwind base block (a second @import "tailwindcss" -> 2).
base_count=$(grep -oE '@layer base[[:space:]]*\{' "$CSS" | wc -l | tr -d ' ')
[ "$base_count" = "1" ] || {
  echo "FAIL AC-7: expected exactly 1 Tailwind base block, found $base_count"; fail=1;
}

[ "$fail" = "0" ] || { echo "Consumer distribution gate FAILED (positive assertions)"; exit 1; }
echo "    PASS: AC-5 (.btn + vars, self-contained) / AC-6 (bg-surface) / AC-7 (single base)"

echo "==> [6/6] Negative control (AC-8): strip the required component CSS -> AC-5 must fail"
cp "$INDEX_CSS" "$INDEX_CSS.bak"
trap 'mv -f "$INDEX_CSS.bak" "$INDEX_CSS"' EXIT
grep -v 'AC-3-COMPONENT-CSS' "$INDEX_CSS.bak" > "$INDEX_CSS"
build_fixture
# Guard the empty-bundle vacuous pass: a build that emits no CSS would make the
# "no .btn" check below trivially true. css_file returns non-zero unless exactly
# one stylesheet was emitted (the stripped index.css still imports tailwind+theme,
# so a bundle is expected).
NCSS="$(css_file)" || { echo "FAIL AC-8: negative-control build did not emit exactly one CSS file"; exit 1; }
if grep -qE '\.btn[[:space:]]*\{' "$NCSS"; then
  echo "FAIL AC-8: .btn still present after removing component CSS — the gate has NO teeth"
  exit 1
fi
echo "    PASS AC-8: .btn absent without component CSS (the gate catches Strategy-2 mis-wiring)"

# Restore the positive wiring now (rather than waiting for the EXIT trap) and
# rebuild, so dist/assets/*.css reflects the real styled output for manual
# inspection (the WP verification step) instead of the negative-control artifact.
mv -f "$INDEX_CSS.bak" "$INDEX_CSS"
trap - EXIT
build_fixture

echo "Consumer distribution gate PASSED."
