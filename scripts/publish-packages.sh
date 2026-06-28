#!/usr/bin/env bash
# scripts/publish-packages.sh — idempotent, topological npm publish for the
# QBall Design System, via npm OIDC trusted publishing.
#
# Publish ORDER is load-bearing: @qball-inc/react depends on @qball-inc/tokens
# (`workspace:*`, rewritten to the published version on pack), so tokens MUST be
# live on npm before react resolves. tokens is static (no build); react builds
# via tsup (only when it will actually publish).
#
# IDEMPOTENT by design: changesets/action runs this `publish` command on any push
# to main that carries no changesets, so re-publishing must be a clean no-op. Per
# package we SKIP when the version is either:
#   - `0.0.0` (the changesets "unreleased" placeholder — give it a real version
#     via a changeset + the Version Packages PR before it can publish), or
#   - already live on npm (so a no-changeset push never errors on a dup publish).
#
# PUBLISH CLIENT — npm, not pnpm. npm trusted publishing (OIDC) requires npm CLI
# >= 11.5.1 on Node >= 22.14; pnpm@9.15.0 (this repo's packageManager, used for
# install/build/pack) cannot perform the OIDC token exchange. So we PACK with
# pnpm — the only client that rewrites `workspace:*` to the real version inside
# the tarball, exactly what npm must serve — and PUBLISH the resulting tarball
# with npm.
#
# Auth carries NO npm token. In CI, npm exchanges the GitHub OIDC id-token
# (release.yml grants id-token: write) against each package's trusted-publisher
# config on npmjs.org, and provenance is attached automatically. The font-license
# gate (scripts/license-check.sh, via `pnpm run ci`) runs in CI BEFORE this.
#
# `--access public` is required for the @qball-inc scope's first publish (also
# pinned in each package's publishConfig).
#
# Usage (CI):    invoked by .github/workflows/release.yml as the changesets/action
#                `publish:` command, under OIDC (Node 22 + npm@latest).
# Usage (local): fallback only — `npm login` first, then run this. No OIDC, no
#                provenance (npm uses the login token); the same script applies.
set -euo pipefail
cd "$(dirname "$0")/.."

# needs_publish <name> <version> -> exit 0 (publish) / 1 (skip, with reason).
needs_publish() {
  local name="$1" ver="$2"
  if [ "$ver" = "0.0.0" ]; then
    echo "==> SKIP $name@$ver (unreleased placeholder — needs a changeset + version bump)"
    return 1
  fi
  if npm view "$name@$ver" version >/dev/null 2>&1; then
    echo "==> SKIP $name@$ver (already published on npm)"
    return 1
  fi
  return 0
}

# publish_tarball <name> <dir> <version> <slug>
# Packs <dir> with pnpm (rewriting workspace:* to a real version in the tarball)
# and publishes the tarball with npm (OIDC in CI; login token locally). <slug> is
# the scope-flattened pnpm-pack prefix, e.g. `qball-inc-tokens` for @qball-inc/tokens.
publish_tarball() {
  local name="$1" dir="$2" ver="$3" slug="$4"
  local tgz="$dir/$slug-$ver.tgz"
  echo "==> Packing $name@$ver (pnpm pack; workspace:* rewritten)"
  ( cd "$dir" && rm -f "$slug"-*.tgz && pnpm pack >/dev/null )
  [ -f "$tgz" ] || { echo "ERROR: expected tarball $tgz not found after pnpm pack" >&2; exit 1; }
  echo "==> Publishing $name@$ver via npm (OIDC in CI; provenance=${NPM_CONFIG_PROVENANCE:-unset})"
  npm publish "$tgz" --access public
  rm -f "$tgz"
}

TOKENS_VER="$(node -p "require('./packages/tokens/package.json').version")"
REACT_VER="$(node -p "require('./packages/react/package.json').version")"

# tokens first (react depends on it via workspace:*). tokens is static — no build.
if needs_publish "@qball-inc/tokens" "$TOKENS_VER"; then
  publish_tarball "@qball-inc/tokens" "packages/tokens" "$TOKENS_VER" "qball-inc-tokens"
fi

# react second. Build (tsup) only when it will actually publish.
if needs_publish "@qball-inc/react" "$REACT_VER"; then
  echo "==> Building @qball-inc/react (tsup)"
  pnpm --filter @qball-inc/react build
  publish_tarball "@qball-inc/react" "packages/react" "$REACT_VER" "qball-inc-react"
fi

echo "==> Publish step complete (nothing to publish is a valid no-op)."
