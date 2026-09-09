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
  case "$bin" in
    aikit) executable=${OI_AIKIT_BIN:-aikit} ;;
    ctrl) executable=${OI_CENTRAL_CTRL_BIN:-ctrl} ;;
  esac
  if ! command -v "$executable" >/dev/null 2>&1; then
    echo "MISSING BIN: $executable (build and bind the product's executable)"
    surface_fail=1
    continue
  fi
  # Keep the selected executable whole, including paths containing spaces.
  result=0
  case "$spec" in
    "aikit compose --help") "$executable" compose --help >/dev/null 2>&1 || result=$? ;;
    "aikit client --help") "$executable" client --help >/dev/null 2>&1 || result=$? ;;
    "ctrl actions --json") "$executable" actions --json >/dev/null 2>&1 || result=$? ;;
  esac
  if [ "$result" -ne 0 ]; then
    echo "MISSING SURFACE: $spec via $executable — verify the selected owner build"
    surface_fail=1
  fi
done
if [ "$surface_fail" -ne 0 ]; then
  echo "machine surfaces out of step with the chain — rebuild and install before executing"
  exit 1
fi
# Git ground check (map §1 law 13): execution belongs on a phase branch, in
# the primary worktree only. Warnings do not break the chain on main itself
# (gate work happens there legitimately); violations on any other branch do.
branch=$(git branch --show-current)
extra_worktrees=$(git worktree list | tail -n +2)
if [ -n "$extra_worktrees" ]; then
  echo "GIT GROUND: stray worktree(s) present — stop and report (law 13):"
  echo "$extra_worktrees"
  exit 1
fi
if [ "$branch" = "main" ] && [ "${CRADLE_ALLOW_MAIN:-0}" != "1" ]; then
  echo "GIT GROUND: on main — execution units run on cradle-<phase> (law 13)."
  echo "Set CRADLE_ALLOW_MAIN=1 only for orchestrator gate work (merge/push/retire)."
  exit 1
fi
echo "context chain intact (branch: ${branch:-detached})"
