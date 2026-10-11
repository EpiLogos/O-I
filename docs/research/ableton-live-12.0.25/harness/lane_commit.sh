#!/bin/bash
# Git commit with retry for parallel lanes (index.lock contention).
# Usage: lane_commit.sh "<message>" <path> [<path>...]
# Adds ONLY the given paths and commits. Retries while another lane holds
# the git index. Never stages anything outside the given paths.
REPO="/Users/admin/Central/Work/O-I"
MSG="$1"; shift
[ -n "$MSG" ] && [ "$#" -gt 0 ] || { echo "usage: lane_commit.sh <msg> <path>..."; exit 2; }
cd "$REPO" || exit 2

for i in $(seq 1 60); do
  [ -f "$REPO/.git/index.lock" ] && { sleep 3; continue; }
  if ! git add -- "$@"; then sleep 3; continue; fi
  if git commit -m "$MSG"; then
    git log --oneline -1
    exit 0
  fi
  echo "COMMIT FAILED (add succeeded, commit refused) — leaving changes staged"
  exit 1
done
echo "COMMIT-LOCK-TIMEOUT (git index contended for 3 min)"
exit 3
