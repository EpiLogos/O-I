#!/usr/bin/env bash
# Test witness: the client's own unavailable answer (field did not answer).
printf '%s\n' '{"ok":false,"error":{"kind":"unavailable","message":"SharedField oi-shared-field-fixture at ws://fixture.invalid:3000 is unavailable: did not answer within 15000 ms"}}'
exit 1
