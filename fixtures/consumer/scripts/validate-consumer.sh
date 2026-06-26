#!/usr/bin/env bash
# =============================================================================
# WP-B-2.0a — Consumer distribution gate (extended by WP-B-5.2).
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
# WP-B-5.2 additions (the full consumer integration pass):
#   - Component-delivery proofs (emitted-CSS, anti-vacuous): the shipped
#     .stat__delta--up rule resolves the --data-up finance token (defined in the
#     bundle), and .stat__value carries the var(--font-display) numeric display
#     family. App.tsx renders Button + Switch + Modal + Stat from the tarball.
#   - FR10 --font-display override sub-test: inject a cascade-only Berkeley Mono
#     override, rebuild, and assert it resolves in the emitted CSS (zero binaries).
#   - NFR1/RB-1 zero-binaries scan: the installed @qball-inc packages carry no
#     woff2/woff/ttf/otf/eot files.
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

echo "==> [1/8] Build @qball-inc/react (tsup) so dist/ is packable"
pnpm --filter @qball-inc/react run build >/dev/null

echo "==> [2/8] Pack tokens + react from each package dir (pnpm pack; workspace:* rewritten)"
rm -f "$FIXTURE_DIR"/qball-inc-*.tgz
( cd "$TOKENS_DIR" && pnpm pack --pack-destination "$FIXTURE_DIR" >/dev/null )
( cd "$REACT_DIR" && pnpm pack --pack-destination "$FIXTURE_DIR" >/dev/null )

echo "==> [3/8] Install the tarballs into the fixture (standalone; no workspace symlink — AR15)"
( cd "$FIXTURE_DIR" && rm -rf node_modules dist && pnpm install --ignore-workspace --no-frozen-lockfile >/dev/null )

echo "==> [4/8] Build the fixture (Button+Switch+Modal+Stat + optional utility wiring)"
build_fixture
CSS="$(css_file)" || { echo "FAIL: positive build did not emit exactly one CSS file"; exit 1; }

echo "==> [5/8] Assert delivery (AC-5 + WP-5.2 component proofs), optional utility (AC-6), single base (AC-7)"
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

# AC-5.2a (WP-B-5.2) — Stat finance-color delivery (anti-vacuous, emitted-CSS): the
# shipped .stat__delta--up rule resolves the finance-up token, AND --data-up is
# defined in the bundle. Mirrors AC-5b/AC-5c (reference + definition), not DOM-presence.
grep -qE '\.stat__delta--up[[:space:]]*\{[^}]*color:[[:space:]]*var\(--data-up\)' "$CSS" || {
  echo "FAIL AC-5.2: .stat__delta--up { color: var(--data-up) } absent from built CSS"; fail=1;
}
grep -qE -- '--data-up[[:space:]]*:' "$CSS" || {
  echo "FAIL AC-5.2: finance token --data-up has no definition in the built CSS"; fail=1;
}
# AC-5.2b (WP-B-5.2) — numeric display family: the .stat__value rule (a .num-equivalent
# numeric class) uses the display-font token, AND --font-display is defined in the bundle
# (symmetric with AC-5.2a: reference + definition, so a missing token can't pass vacuously).
grep -qE '\.stat__value[[:space:]]*\{[^}]*font-family:[[:space:]]*var\(--font-display\)' "$CSS" || {
  echo "FAIL AC-5.2: .stat__value { font-family: var(--font-display) } absent from built CSS"; fail=1;
}
grep -qE -- '--font-display[[:space:]]*:' "$CSS" || {
  echo "FAIL AC-5.2: display-font token --font-display has no definition in the built CSS"; fail=1;
}

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
echo "    PASS: AC-5 (.btn + vars) / AC-5.2 (.stat__delta + .stat__value) / AC-6 (bg-surface) / AC-7 (single base)"

echo "==> [6/8] Negative control (AC-8): strip the required component CSS -> AC-5 must fail"
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

echo "==> [7/8] FR10 --font-display override sub-test (cascade-only; zero binaries)"
# Inject a single CSS-variable override AFTER the token imports so it wins the
# cascade (later wins at equal specificity), rebuild, and assert the consumer's
# override SURVIVES the build into the emitted bundle as the --font-display value.
# Proves the .stat__value/.num display family is overridable by a license-holding
# consumer WITHOUT any bundled binary. (This is an emitted-CSS-artifact check: it
# confirms the override is preserved + wins source order, not paint-time resolution —
# the harness is browser-free; see spec-verify-103-WP-B-5.2.md D-17.) Mirrors the
# AC-8 negative-control backup/modify/rebuild/restore pattern (EXIT+TERM+INT trap).
cp "$INDEX_CSS" "$INDEX_CSS.bak"
trap 'mv -f "$INDEX_CSS.bak" "$INDEX_CSS"' EXIT TERM INT
printf '\n/* WP-B-5.2 Berkeley override sub-test (injected by validate-consumer.sh; reverted after) */\n:root { --font-display: "Berkeley Mono", monospace; }\n' >> "$INDEX_CSS"
build_fixture
BCSS="$(css_file)" || { echo "FAIL FR10: Berkeley-override build did not emit exactly one CSS file"; exit 1; }
grep -qE -- '--font-display:[^;}]*Berkeley Mono' "$BCSS" || {
  echo "FAIL FR10: --font-display override not preserved as 'Berkeley Mono' in the emitted CSS"; exit 1;
}
echo "    PASS FR10: --font-display override preserved as the winning value (Berkeley Mono) in the emitted CSS"
# Restore the pristine positive wiring + rebuild (leave dist/ in the styled state).
mv -f "$INDEX_CSS.bak" "$INDEX_CSS"
trap - EXIT
build_fixture

echo "==> [8/8] Zero-binaries scan (NFR1/RB-1): installed @qball-inc packages carry no font files"
binaries=$(find \
  "$FIXTURE_DIR/node_modules/@qball-inc/tokens" \
  "$FIXTURE_DIR/node_modules/@qball-inc/react" \
  -type f \( -name '*.woff2' -o -name '*.woff' -o -name '*.ttf' -o -name '*.otf' -o -name '*.eot' \) \
  2>/dev/null | grep -c . || true)
[ "$binaries" = "0" ] || {
  echo "FAIL NFR1: found $binaries font binary file(s) in the installed @qball-inc packages (must be 0)"; exit 1;
}
echo "    PASS NFR1: 0 font binaries in installed @qball-inc/tokens + @qball-inc/react"

echo "Consumer distribution gate PASSED."
