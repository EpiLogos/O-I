#!/usr/bin/env bash
# poll.sh <session> <delivery> [timeout_polls] — poll until terminal, print row
set -u
. /tmp/oi203/env.sh
for i in $(seq 1 "${3:-30}"); do
  P=$(/tmp/oi203/row.sh "$1" "$2")
  case "$P" in returned*|failed*|cancelled*|"") echo "$P (poll $i)"; exit 0;; esac
  sleep 3
done
echo "still-open: $P"
