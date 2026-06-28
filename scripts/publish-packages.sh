#!/usr/bin/env bash
# scripts/publish-packages.sh — idempotent, topological npm publish for the
# QBall Design System.
#
# Publish ORDER is load-bearing: @qball-inc/react depends on @qball-inc/tokens
# (`workspace:*`, rewritten to the published version on pack), so tokens MUST be
# live on npm before react is published. tokens is static (no build); react
# builds via tsup (only when it will actually publish).
#
# IDEMPOTENT by design: changesets/action runs this `publish` command on any
# push to main that carries no changesets, so re-publishing must be a clean
# no-op. Per package we SKIP when the version is either:
#   - `0.0.0` (the changesets "unreleased" placeholder — give it a real version
#     via a changeset + the Version Packages PR before it can publish), or
#   - already live on npm (so a no-changeset push never errors on a dup publish).
#
# Auth: this script carries NO npm token. It is invoked by
# .github/workflows/release.yml under npm OIDC trusted publishing
# (permissions: id-token: write + provenance) — credentials come from the OIDC
# exchange at publish time, never from the environment or this file. The font
# license gate (scripts/license-check.sh, via `pnpm run ci`) runs in CI BEFORE
# this script.
#
# `--access public` is required for the @qball-inc scope's first publish;
# `--no-git-checks` allows publishing the version bumps that `changeset version`
# wrote but the release flow has not yet committed.
#
# Usage: bash scripts/publish-packages.sh
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

TOKENS_VER="$(node -p "require('./packages/tokens/package.json').version")"
REACT_VER="$(node -p "require('./packages/react/package.json').version")"

# tokens first (react depends on it via workspace:*). tokens is static — no build.
if needs_publish "@qball-inc/tokens" "$TOKENS_VER"; then
  echo "==> Publishing @qball-inc/tokens@$TOKENS_VER"
  pnpm --filter @qball-inc/tokens publish --access public --no-git-checks
fi

# react second. Build (tsup) only when it will actually publish.
if needs_publish "@qball-inc/react" "$REACT_VER"; then
  echo "==> Building @qball-inc/react (tsup)"
  pnpm --filter @qball-inc/react build
  echo "==> Publishing @qball-inc/react@$REACT_VER"
  pnpm --filter @qball-inc/react publish --access public --no-git-checks
fi

echo "==> Publish step complete (nothing to publish is a valid no-op)."
