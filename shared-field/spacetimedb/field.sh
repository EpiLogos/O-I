#!/usr/bin/env bash
# The desktop kernel's doorway to the O:I-owned SharedField client (field.ts):
# one JSON request on stdin, one JSON envelope on stdout. The target comes from
# OI_SHARED_FIELD_TARGET (a name in hosting.json); credentials never travel here.
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# The kernel may call this doorway from a GUI/launchd context whose PATH
# lacks the Homebrew prefix; resolve node outright instead of through the
# tsx shim's `#!/usr/bin/env node`.
# NODE_BIN wins outright (a version manager or a pinned toolchain sets it);
# otherwise PATH, then the standard Homebrew locations.
node_bin="${NODE_BIN:-$(command -v node || true)}"
if [ -z "$node_bin" ]; then
  for candidate in /opt/homebrew/bin/node /usr/local/bin/node; do
    if [ -x "$candidate" ]; then node_bin="$candidate"; break; fi
  done
fi
exec "$node_bin" "$here/node_modules/.bin/tsx" "$here/field.ts" "$@"
