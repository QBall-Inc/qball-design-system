# QBall Design System — Justfile.
# `build` + `test` are no-op stubs; the per-package build/test harnesses land in
# WP-B-2.0 and the component WPs. `license-check` is the enforceable WP-B-0.2
# dual-assertion font-binary gate (scripts/license-check.sh); `ci` mirrors the
# GitHub Actions gate chain for local parity.
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

# Build stub — per-package dual-ESM/CJS build harness lands in WP-B-2.0.
build:
    @echo "build: no-op stub (build harness lands in WP-B-2.0)"

# Test stub — component test harness lands with the first component WP.
test:
    @echo "test: no-op stub (test harness lands in WP-B-2.x)"

# License-clean (font-binary) dual-assertion gate: npm pack tarballs + committed tree (WP-B-0.2, RB-1).
license-check:
    bash scripts/license-check.sh

# Full local gate (mirrors CI): typecheck -> lint -> test -> license-check.
ci: typecheck lint test license-check
    @echo "ci: all gates passed"
