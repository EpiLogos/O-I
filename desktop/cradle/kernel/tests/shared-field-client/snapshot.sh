#!/usr/bin/env bash
# Test witness for the SharedField client doorway: answers `status` and
# `snapshot` with a fixed, hand-countable field (2 projections, 3 entries,
# 2 relations). Not a SharedField implementation — a transport fixture.
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
request="$(cat)"
case "$request" in
  *'"kind":"status"'*) printf '%s\n' '{"ok":true,"data":{"schema":"oi.shared-field.status/v1","bound":true,"target":{"name":"fixture","uri":"ws://fixture.invalid:3000","database":"oi-shared-field-fixture"}}}' ;;
  *'"kind":"snapshot"'*) printf '{"ok":true,"data":'; cat "$here/snapshot.json"; printf '}\n' ;;
  *) printf '%s\n' '{"ok":false,"error":{"kind":"malformed","message":"fixture answers status and snapshot only"}}'; exit 1 ;;
esac
