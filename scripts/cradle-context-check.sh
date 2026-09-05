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
echo "context chain intact"
