#!/usr/bin/env bash
# Runs every packed-consumer gate: the React fixture (tokens + react), the
# Astro fixture (tokens + elements) and the no-three Astro pair (the optional
# three peer skipped). Every gate always runs; the script fails if
# any fails. The single entry point for `just consumer-validate` and the
# `pnpm run consumer-validate` script CI calls, so the two cannot drift.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
status=0

for gate in \
  "$REPO_ROOT/fixtures/consumer/scripts/validate-consumer.sh" \
  "$REPO_ROOT/fixtures/consumer-astro/scripts/validate-consumer-astro.sh" \
  "$REPO_ROOT/fixtures/consumer-astro-no-three/scripts/validate-no-three.sh"; do
  echo "######## ${gate#"$REPO_ROOT"/}"
  if ! bash "$gate"; then
    echo "FAIL: ${gate#"$REPO_ROOT"/}"
    status=1
  fi
done

exit "$status"
