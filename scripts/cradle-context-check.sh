#!/bin/sh
# OI-CRADLE-REBUILD-WF — context-chain check.
# Every artifact the map, the cradle-execution skill, and the orchestrator
# prompt cite must exist at its cited path in this repo, except paths that
# execution itself creates or removes. Run from anywhere inside the O:I repo.
# Exit 1 = broken chain: repair before executing anything.
set -e
cd "$(git rev-parse --show-toplevel)"
missing=0
for p in $(
  grep -ohE '(docs|skills|scripts|packages|desktop)/[A-Za-z0-9_./-]+' \
    docs/OI-DESKTOP-CRADLE-REBUILD-WAYFINDER.md \
    skills/cradle-execution/SKILL.md \
    .superpowers/sdd/cradle-rebuild/ORCHESTRATOR-PROMPT.md 2>/dev/null | sort -u
); do
  case "$p" in
    desktop/cradle*) continue ;; # created by execution (U0.3)
    desktop/ui*)     continue ;; # removed by execution (U0.7) — absence is fine
  esac
  [ -e "$p" ] || { echo "MISSING: $p"; missing=1; }
done
if [ "$missing" -ne 0 ]; then
  echo "context chain broken — repair before executing (cradle-execution skill, step 0)"
  exit 1
fi
# Executable-surface audit: the chain cites commands, not just files. An
# installed binary that predates the source it should carry is the same broken
# chain as a missing file (found 2026-09-05: ~/.cargo/bin/aikit was a 10 Aug
# build from a line that no longer exists). Reinstall from the product's
# release build; never pin prose to a stale binary.
surface_fail=0
for spec in "aikit compose --help" "aikit client --help" "ctrl actions --json"; do
  bin=${spec%% *}
  if ! command -v "$bin" >/dev/null 2>&1; then
    echo "MISSING BIN: $bin (build and install the product's release binary)"
    surface_fail=1
    continue
  fi
  # Intentional word-splitting: each spec is a fixed, known-good invocation.
  if ! $spec >/dev/null 2>&1; then
    echo "MISSING SURFACE: $spec — installed binary predates cited source; rebuild + reinstall"
    surface_fail=1
  fi
done
if [ "$surface_fail" -ne 0 ]; then
  echo "machine surfaces out of step with the chain — rebuild and install before executing"
  exit 1
fi
echo "context chain intact"
