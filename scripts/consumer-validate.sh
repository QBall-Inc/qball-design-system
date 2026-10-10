#!/usr/bin/env bash
# Runs every packed-consumer gate: the React fixture (tokens + react) and the
# Astro fixture (tokens + elements). Both always run; the script fails if
# either fails. The single entry point for `just consumer-validate` and the
# `pnpm run consumer-validate` script CI calls, so the two cannot drift.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
status=0

for gate in \
  "$REPO_ROOT/fixtures/consumer/scripts/validate-consumer.sh" \
  "$REPO_ROOT/fixtures/consumer-astro/scripts/validate-consumer-astro.sh"; do
  echo "######## ${gate#"$REPO_ROOT"/}"
  if ! bash "$gate"; then
    echo "FAIL: ${gate#"$REPO_ROOT"/}"
    status=1
  fi
done

exit "$status"
