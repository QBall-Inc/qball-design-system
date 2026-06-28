#!/usr/bin/env bash
# scripts/release-dry-run.sh — non-mutating release preview + guardrails.
#
# Exercises the release mechanics WITHOUT publishing:
#   1. Zero-secret assertion — no NPM_TOKEN / NODE_AUTH_TOKEN in any workflow
#      (publishing is npm OIDC trusted publishing only).
#   2. OIDC assertion — release.yml grants id-token: write + sets provenance.
#   3. 1.0.0 version-jump preview — drops an EPHEMERAL `major` changeset for both
#      packages, runs `changeset status`, asserts tokens 0.1.0 -> 1.0.0 and react
#      (unpublished) -> 1.0.0, then removes the ephemeral changeset.
#   4. Prints the semver-contract scenarios for the releaser.
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
echo "== 3. 1.0.0 version-jump preview (ephemeral changeset) =="
tmp=".changeset/zzz-dry-run-probe.md"
out="$(mktemp -u)"
cleanup() { rm -f "$tmp" "$out"; }
trap cleanup EXIT
printf '%s\n' '---' '"@qball-inc/tokens": major' '"@qball-inc/react": major' '---' '' 'release-dry-run probe (ephemeral).' > "$tmp"
pnpm exec changeset status --verbose --output "$out"
node -e '
  const fs = require("fs");
  const s = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  const want = { "@qball-inc/tokens": "1.0.0", "@qball-inc/react": "1.0.0" };
  let ok = true;
  for (const [name, newVersion] of Object.entries(want)) {
    const r = (s.releases || []).find((x) => x.name === name);
    if (!r) { console.error("FAIL: no planned release for " + name); ok = false; continue; }
    console.log("  " + name + ": " + r.oldVersion + " -> " + r.newVersion + " (" + r.type + ")");
    if (r.newVersion !== newVersion) { console.error("FAIL: " + name + " expected -> " + newVersion); ok = false; }
  }
  process.exit(ok ? 0 : 1);
' "$out"
echo "OK — both packages bump to 1.0.0 (the strict contract takes effect at 1.0.0)"

echo
echo "== Semver contract scenarios (declared per changeset; see RELEASING.md / CAVEATS.md) =="
echo "  1. token value change ............ MAJOR"
echo "  2. --font-display fallback change . MAJOR"
echo "  3. \$description-only edit ......... EXEMPT (no changeset, no bump)"
echo "  4. additive component / variant ... MINOR"
echo "  5. zero NPM_TOKEN ................. asserted in step 1 (OIDC only)"

echo
echo "release-dry-run: PASS"
