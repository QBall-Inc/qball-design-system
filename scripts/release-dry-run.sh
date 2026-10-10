#!/usr/bin/env bash
# scripts/release-dry-run.sh — non-mutating release preview + guardrails.
#
# Exercises the release mechanics WITHOUT publishing:
#   1. Zero-secret assertion — no NPM_TOKEN / NODE_AUTH_TOKEN in any workflow
#      (publishing is npm OIDC trusted publishing only).
#   2. OIDC assertion — release.yml grants id-token: write + sets provenance.
#   3. Released-on-0.x check — @qball-inc/elements carries a released 0.x
#      version (first published as 0.1.0; it stays on 0.x until its 1.0 is cut
#      deliberately).
#   4. Next-release preview — drops an EPHEMERAL `minor` changeset for
#      @qball-inc/elements alone and asserts `changeset status` proposes the
#      next 0.x minor (0.N.x -> 0.(N+1).0), never a jump to 1.0.0.
#   5. Prints the semver-contract scenarios for the releaser.
#
# Invoked by `just release-dry-run`. Safe to run repeatedly: it mutates nothing
# permanent — the ephemeral changeset is always cleaned up via the EXIT trap.
set -euo pipefail
cd "$(dirname "$0")/.."

fail() { echo "FAIL: $*" >&2; exit 1; }

echo "== 1. Zero-NPM_TOKEN assertion (OIDC trusted publishing only) =="
# Assert no static npm publish credential is wired anywhere we control:
#   (a) a secrets.* npm token / NODE_AUTH_TOKEN env / _authToken in a workflow, and
#   (b) a committed .npmrc carrying _authToken.
# secrets.GITHUB_TOKEN (the built-in for the version PR, not an npm token) is allowed.
token_re='secrets\.(NPM_TOKEN|NODE_AUTH_TOKEN)|NODE_AUTH_TOKEN[[:space:]]*:|_authToken'
if grep -rniE "$token_re" .github/workflows >/dev/null 2>&1; then
  grep -rniE "$token_re" .github/workflows >&2 || true
  fail "a publish-token reference exists in .github/workflows (must be OIDC-only)"
fi
if git grep -nE '_authToken' -- '*.npmrc' '.npmrc' >/dev/null 2>&1; then
  git grep -nE '_authToken' -- '*.npmrc' '.npmrc' >&2 || true
  fail "a committed .npmrc wires _authToken (must be OIDC-only)"
fi
echo "OK — no npm publish token wired in workflows or a committed .npmrc"

echo
echo "== 2. OIDC + provenance assertion (release.yml) =="
grep -q 'id-token: write' .github/workflows/release.yml || fail "id-token: write missing from release.yml"
grep -q 'NPM_CONFIG_PROVENANCE' .github/workflows/release.yml || fail "NPM_CONFIG_PROVENANCE missing from release.yml"
echo "OK — id-token: write + NPM_CONFIG_PROVENANCE present"

echo
echo "== 3. @qball-inc/elements is released and stays on 0.x =="
tmp=".changeset/zzz-dry-run-probe.md"
out="$(mktemp -u)"
cleanup() { rm -f "$tmp" "$out"; }
trap cleanup EXIT

elements_ver="$(node -p "require('./packages/elements/package.json').version")"
[[ "$elements_ver" =~ ^0\.([1-9][0-9]*)\.[0-9]+$ ]] \
  || fail "@qball-inc/elements is $elements_ver — expected a released 0.x version (>= 0.1.0, < 1.0.0)"
elements_minor="${BASH_REMATCH[1]}"
echo "OK — @qball-inc/elements@$elements_ver (released, 0.x)"

# planned_release <status.json> <name> -> prints "old -> new (type)" or "none".
planned_release() {
  node -e '
    const s = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
    const r = (s.releases || []).find((x) => x.name === process.argv[2]);
    console.log(r ? r.oldVersion + " -> " + r.newVersion + " (" + r.type + ")" : "none");
  ' "$1" "$2"
}

echo
echo "== 4. Next-release preview (ephemeral minor changeset, @qball-inc/elements) =="
printf '%s\n' '---' '"@qball-inc/elements": minor' '---' '' 'release-dry-run probe (ephemeral).' > "$tmp"
pnpm exec changeset status --verbose --output "$out" >/dev/null
plan="$(planned_release "$out" "@qball-inc/elements")"
expected="$elements_ver -> 0.$((elements_minor + 1)).0 (minor)"
echo "  @qball-inc/elements: $plan"
[ "$plan" = "$expected" ] || fail "@qball-inc/elements expected $expected, got: $plan"
rm -f "$tmp"
echo "OK — a minor changeset keeps @qball-inc/elements on 0.x"

echo
echo "== Semver contract scenarios (declared per changeset; see RELEASING.md / CAVEATS.md) =="
echo "  1. token value change ............ MAJOR"
echo "  2. --font-display fallback change . MAJOR"
echo "  3. \$description-only edit ......... EXEMPT (no changeset, no bump)"
echo "  4. additive component / variant ... MINOR"
echo "  5. zero NPM_TOKEN ................. asserted in step 1 (OIDC only)"

echo
echo "release-dry-run: PASS"
