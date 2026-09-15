#!/usr/bin/env bash
# The desktop kernel's doorway to the O:I-owned SharedField client (field.ts):
# one JSON request on stdin, one JSON envelope on stdout. The target comes from
# OI_SHARED_FIELD_TARGET (a name in hosting.json); credentials never travel here.
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "$here/node_modules/.bin/tsx" "$here/field.ts" "$@"
