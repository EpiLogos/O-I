#!/usr/bin/env bash
# Test witness for the SharedField client doorway, held (`--held`, O-I #858):
# one request per line in, its envelope back by id; answers `status` and
# `snapshot` with a fixed, hand-countable field (the CI World publication
# bundle: 1 projection, 7 entries, 9 relations, generated from
# shared-field/fixtures/central-world-ci.*). Not a SharedField
# implementation — a transport fixture.
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
while IFS= read -r line; do
  id="${line#\{\"id\":}"; id="${id%%,*}"
  case "$line" in
    *'"kind":"status"'*) printf '{"id":%s,"ok":true,"data":{"schema":"oi.shared-field.status/v1","bound":true,"target":{"name":"fixture","uri":"ws://fixture.invalid:3000","database":"oi-shared-field-fixture"}}}\n' "$id" ;;
    *'"kind":"snapshot"'*) printf '{"id":%s,"ok":true,"data":%s}\n' "$id" "$(tr -d '\n' < "$here/inhabited-snapshot.json")" ;;
    *) printf '{"id":%s,"ok":false,"error":{"kind":"malformed","message":"fixture answers status and snapshot only"}}\n' "$id" ;;
  esac
done
