#!/usr/bin/env bash
# Test witness: the client's own unbound answer (no OI_SHARED_FIELD_TARGET).
printf '%s\n' '{"ok":false,"error":{"kind":"unbound","message":"no SharedField target bound: set OI_SHARED_FIELD_TARGET to a target named in shared-field/spacetimedb/hosting.json"}}'
exit 1
