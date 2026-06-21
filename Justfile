# QBall Design System — Justfile.
# `build` runs each publishable package's tsup harness (dual ESM/CJS + dts);
# `test` runs each package's vitest suite. `license-check` is the enforceable
# WP-B-0.2 dual-assertion font-binary gate (scripts/license-check.sh); `ci`
# mirrors the GitHub Actions gate chain for local parity.
#
# Recipes are single-line shell invocations on purpose: `just` runs them via
# the configured shell (no shebang temp-file), so the /mnt/c exec-bit stripping
# under WSL is a non-issue. Any future multi-line shell goes through a committed
# `scripts/<name>.sh` invoked as `bash scripts/<name>.sh`.

set shell := ["bash", "-cu"]
set windows-shell := ["powershell.exe", "-c"]

# Workspace-local tool bins first.
export PATH := "./node_modules/.bin:" + env_var("PATH")

# Default: list available recipes.
default:
    @just --list

# Install workspace dependencies.
install:
    pnpm install

# Typecheck every workspace package (no emit).
typecheck:
    pnpm -r exec tsc --noEmit

# Lint (ESLint flat config + Prettier-compat).
lint:
    eslint .

# Format-write the workspace (pre-existing DS-packet files are prettier-ignored).
format:
    prettier --write .

# Format-check (CI-safe; no writes).
format-check:
    prettier --check .

# Build every publishable package that defines a build script (dual ESM/CJS + dts via tsup).
build:
    pnpm --filter "@qball-inc/*" --if-present run build

# Run every publishable package test suite that defines a test script (vitest).
test:
    pnpm --filter "@qball-inc/*" --if-present run test

# Icon-system codegen (WP-B-4b.2): regenerate the committed src/icons/generated/**
# from the manifest + pinned lucide-react@1.17.0. Run after editing the manifest.
generate-icons:
    pnpm --filter "@qball-inc/react" run generate:icons

# Icon-system codegen drift gate (WP-B-4b.2-B1): the committed src/icons/generated/**
# must match what generate-icons.mjs reproduces from pinned lucide-react@1.17.0 + the manifest.
generate-icons-check:
    pnpm --filter "@qball-inc/react" run generate:icons:check

# License-clean (font-binary) dual-assertion gate: npm pack tarballs + committed tree (WP-B-0.2, RB-1).
license-check:
    bash scripts/license-check.sh

# NET-NEW SPDX / pack-license assertion (WP-B-4b.2, §12): icon-pack devDeps exact-pinned
# + declared SPDX (lucide ISC / simple-icons CC0) + per-file provenance headers + MARKS.md.
# Distinct from the font-binary license-check above.
spdx-check:
    node scripts/spdx-check.mjs

# Consumer distribution gate (WP-B-2.0a, RB-2): packs the @qball-inc tarballs the
# way the npm publish path will (pnpm pack rewrites workspace:* -> a real version,
# NOT the @source utility-purge model), installs them into the throwaway
# fixtures/consumer app, and asserts the Strategy-2 component CSS (.btn) delivers +
# its token vars resolve self-contained + the optional token utility generates +
# a single Tailwind base block + a negative control. Multi-line shell lives in the
# committed script (WSL exec-bit pattern), invoked via bash.
consumer-validate:
    bash fixtures/consumer/scripts/validate-consumer.sh

# Full local gate (mirrors CI): generate-icons-check -> typecheck -> lint -> test -> license-check -> spdx-check -> consumer-validate.
ci: generate-icons-check typecheck lint test license-check spdx-check consumer-validate
    @echo "ci: all gates passed"
