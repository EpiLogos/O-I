#!/usr/bin/env bash
# Test witness, held (`--held`, O-I #858): the client's own unavailable answer
# (field did not answer) to every request, by id.
while IFS= read -r line; do
  id="${line#\{\"id\":}"; id="${id%%,*}"
  printf '{"id":%s,"ok":false,"error":{"kind":"unavailable","message":"SharedField oi-shared-field-fixture at ws://fixture.invalid:3000 is unavailable: did not answer within 15000 ms"}}\n' "$id"
done
