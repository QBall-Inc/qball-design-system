#!/usr/bin/env bash
# scripts/license-check.sh — dual-assertion font-binary license gate.
#
# Enforces the "embed-in-deploy, never-in-source" posture (plan_v1 RB-1):
# a licensed font binary (Berkeley Mono, et al.) must never reach the public
# repo source tree NOR a published npm tarball — `git clone` and `npm install`
# are both public redistribution, which the LR-02 Website Grant does not cover.
# Berkeley is injected only at Pages-deploy time from a private source.
#
#   Gate (a): scan each PUBLISHABLE package's `npm pack` tarball.
#   Gate (b): scan the committed repo tree (`git ls-files`).
#
# Either match fails the gate (exit 1). No git-history scan — the posture is
# clean-by-construction (fonts are never committed), so the current tree and
# freshly-produced tarballs are the only surfaces that need checking.
#
# Detection is extension-based (the seven binary font extensions in FONT_RE).
# Out of scope by design: a font renamed to a non-font extension, a font
# embedded as a base64 data-URI inside CSS, and SVG fonts (.svg is deliberately
# excluded — a design system ships many non-font SVG assets that would false-
# positive). Expand the threat model in a future WP if those vectors matter.
set -euo pipefail

# Anchor to the repo root so `git ls-files` and the packages/* glob resolve
# regardless of the caller's CWD — no hidden CWD dependency (CS2).
cd "$(git rev-parse --show-toplevel)"

FONT_RE='\.(woff2?|ttf|otf|eot|pfb|pfm)$'
fail=0

# --- Gate (b): committed-tree scan ---
echo "license-check: gate (b) — committed-tree font scan"
if tree_hits=$(git ls-files | grep -Ei "$FONT_RE"); then
  echo "FAIL gate (b): font binaries committed to the repo tree:" >&2
  echo "$tree_hits" >&2
  fail=1
else
  echo "  ok — zero font binaries in the committed tree"
fi

# --- Gate (a): npm pack tarball scan ---
# Publishable packages are discovered dynamically from the workspace glob so a
# newly-added package cannot silently escape the tarball scan. A package is
# publishable unless its package.json sets "private": true.
echo "license-check: gate (a) — npm pack tarball font scan"
packdir="$(mktemp -d)"
trap 'rm -rf "$packdir"' EXIT

packages=()
for pkgjson in packages/*/package.json; do
  [ -e "$pkgjson" ] || continue  # literal glob when packages/ is empty
  if [ "$(node -p "require('./$pkgjson').private === true")" = "true" ]; then
    continue
  fi
  packages+=("$(dirname "$pkgjson")")
done

if [ "${#packages[@]}" -eq 0 ]; then
  echo "  (no publishable packages found under packages/*)"
else
  for pkg in "${packages[@]}"; do
    # npm pack prints the produced tarball filename to stdout; --silent strips
    # the progress noise so the last line is the filename. stderr is left intact
    # so a genuine pack failure surfaces an actionable message.
    tarball=$(cd "$pkg" && npm pack --pack-destination "$packdir" --silent | tail -1)
    if tar_hits=$(tar tzf "$packdir/$tarball" | grep -Ei "$FONT_RE"); then
      echo "FAIL gate (a): font binaries in $pkg tarball ($tarball):" >&2
      echo "$tar_hits" >&2
      fail=1
    else
      echo "  ok — $pkg tarball ($tarball) is font-free"
    fi
  done
fi

if [ "$fail" -ne 0 ]; then
  echo "license-check: FAILED — licensed-font leak detected (see above)." >&2
  exit 1
fi
echo "license-check: PASSED — source tree and tarballs are font-free."
