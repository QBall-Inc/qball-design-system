#!/usr/bin/env bash
# scripts/build-pages-site.sh — WP-B-5.1 GitHub Pages artifact builder.
#
# Stages the curated gallery surface into _site/ and injects the licensed
# Berkeley Mono @font-face declarations + a Berkeley-first --font-display into
# the ARTIFACT COPY of packages/tokens/colors_and_type.css ONLY. The committed
# source tree stays font-binary-free and Berkeley-free; the WP-B-0.2 license
# gate (scripts/license-check.sh) enforces that continuously.
#
# The 6 licensed woff2 weights are fetched at deploy time from the PRIVATE
# stock-watcher repo (see .github/workflows/pages.yml, which sparse-checks out
# docs/stocky-github-pages/fonts into _fonts_src/) and copied here into
# _site/packages/tokens/fonts/. They are NEVER written back to the repo tree
# (LR-02 Website Grant: the deployed site may SERVE Berkeley Mono; it may not
# redistribute the binaries via a public git tree).
#
# The font @font-face src urls are document-relative to the CSS file, so they
# resolve under the /qball-design-system/ Pages subpath without a base path.
#
# Local dry-run against a checkout of the private repo:
#   FONTS_SRC=/mnt/c/projects/stock-watcher/docs/stocky-github-pages/fonts \
#     bash scripts/build-pages-site.sh
set -euo pipefail

# Anchor to the repo root so relative copies resolve regardless of caller CWD.
cd "$(git rev-parse --show-toplevel)"

SITE="_site"
FONTS_SRC="${FONTS_SRC:-_fonts_src/docs/stocky-github-pages/fonts}"
CSS="${SITE}/packages/tokens/colors_and_type.css"

# The 6 weights that ACTUALLY ship. The private source CSS over-declares Thin
# (100) / ExtraLight (200) / SemiLight (350) + every oblique, but only these
# six normal-style SemiCondensed weights have committed woff2 files — injecting
# the others would 404. "<file>:<css-weight>".
WEIGHTS=(
  "BerkeleyMono-Light-SemiCondensed.woff2:300"
  "BerkeleyMono-SemiCondensed.woff2:400"
  "BerkeleyMono-Medium-SemiCondensed.woff2:500"
  "BerkeleyMono-SemiBold-SemiCondensed.woff2:600"
  "BerkeleyMono-Bold-SemiCondensed.woff2:700"
  "BerkeleyMono-ExtraBold-SemiCondensed.woff2:800"
)

# --- 1. Fresh _site with the curated static surface --------------------------
rm -rf "${SITE}"
mkdir -p "${SITE}/packages/tokens/fonts"

cp index.html gallery.html "${SITE}/"
cp -r preview "${SITE}/preview"
cp -r assets "${SITE}/assets"
cp packages/tokens/colors_and_type.css \
   packages/tokens/components.css \
   packages/tokens/theme.css \
   "${SITE}/packages/tokens/"
[ -f packages/tokens/tokens.json ] && cp packages/tokens/tokens.json "${SITE}/packages/tokens/"

# --- 2. Copy the licensed woff2 into the artifact (fail fast if missing) ------
for entry in "${WEIGHTS[@]}"; do
  file="${entry%%:*}"
  if [ ! -f "${FONTS_SRC}/${file}" ]; then
    echo "FATAL: licensed font missing from private source: ${FONTS_SRC}/${file}" >&2
    echo "       (set FONTS_SRC to the stocky-github-pages/fonts dir)" >&2
    exit 1
  fi
  cp "${FONTS_SRC}/${file}" "${SITE}/packages/tokens/fonts/${file}"
done

# --- 3. Inject the @font-face declarations (top-level) into the artifact CSS --
{
  echo "/* WP-B-5.1: Berkeley Mono injected at Pages-deploy time — EPHEMERAL"
  echo "   artifact only; NEVER committed (LR-02 Website Grant: serve, do not"
  echo "   redistribute). Source of truth: ashaykubal/stock-watcher (private). */"
  for entry in "${WEIGHTS[@]}"; do
    file="${entry%%:*}"
    weight="${entry##*:}"
    printf "@font-face { font-family: 'Berkeley Mono'; src: url('./fonts/%s') format('woff2'); font-weight: %s; font-style: normal; font-display: swap; }\n" \
      "${file}" "${weight}"
  done
  cat "${CSS}"
} > "${CSS}.tmp"
mv "${CSS}.tmp" "${CSS}"

# --- 4. Put 'Berkeley Mono' first in --font-display (artifact copy only) ------
# Mirrors the canonical private colors_and_type.css (--font-display only;
# --font-heading intentionally stays Fira Code, matching the real Stocky site).
if ! grep -q "\-\-font-display: 'Fira Code'," "${CSS}"; then
  echo "FATAL: --font-display 'Fira Code' anchor not found in ${CSS}; CSS drifted, injection aborted." >&2
  exit 1
fi
sed -i "s/--font-display: 'Fira Code',/--font-display: 'Berkeley Mono', 'Fira Code',/" "${CSS}"

# --- 5. Self-checks: artifact carries the family; no font escaped to the tree -
# Anchor on ^@font-face so the count ignores the "re-add the @font-face
# declarations" mention inside the file's leading comment block.
faces="$(grep -c "^@font-face" "${CSS}")"
if [ "${faces}" -ne "${#WEIGHTS[@]}" ]; then
  echo "FATAL: expected ${#WEIGHTS[@]} @font-face blocks, found ${faces}." >&2
  exit 1
fi
if ! grep -q "\-\-font-display: 'Berkeley Mono'," "${CSS}"; then
  echo "FATAL: --font-display was not switched to Berkeley-first." >&2
  exit 1
fi

echo "build-pages-site: staged ${SITE} ($(du -sh "${SITE}" | cut -f1)); ${faces} @font-face injected; --font-display Berkeley-first."
