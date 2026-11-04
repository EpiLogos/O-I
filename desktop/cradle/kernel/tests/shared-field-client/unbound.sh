#!/usr/bin/env bash
# Test witness, held (`--held`, O-I #858): the client's own unbound answer (no
# OI_SHARED_FIELD_TARGET) to every request, by id.
while IFS= read -r line; do
  id="${line#\{\"id\":}"; id="${id%%,*}"
  printf '{"id":%s,"ok":false,"error":{"kind":"unbound","message":"no SharedField target bound: set OI_SHARED_FIELD_TARGET to a target named in shared-field/spacetimedb/hosting.json"}}\n' "$id"
done
