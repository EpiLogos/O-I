#!/usr/bin/env bash
# Reproducible module deployment for one hosting target named in hosting.json.
#
#   shared-field/spacetimedb/deploy.sh hosted            # build, publish, regenerate bindings
#   shared-field/spacetimedb/deploy.sh local --clear     # wipe and republish a scratch database
#
# Requires the pinned SpaceTimeDB CLI (2.8.1) and, for the hosted target, an
# owner login (`spacetime login`) that this script never performs or stores.
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo="$(cd "$here/../.." && pwd)"
target="${1:-hosted}"
shift || true
clear_flag=""
for arg in "$@"; do [ "$arg" = "--clear" ] && clear_flag="--clear-database"; done

cd "$repo"
read -r server database < <(python3 - "$target" "$here/hosting.json" <<'PY'
import json, sys
t = json.load(open(sys.argv[2]))["targets"][sys.argv[1]]
print(t["server"], t["database"])
PY
)
pinned="$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["pinned_spacetimedb_version"])' "$here/hosting.json")"
spacetime --version | grep -q "$pinned" || { echo "spacetime CLI must be $pinned (spacetime version use $pinned)"; exit 1; }
npm install --prefix shared-field/spacetimedb --no-audit --no-fund >/dev/null
spacetime build --module-path shared-field/spacetimedb
spacetime publish "$database" --server "$server" --module-path shared-field/spacetimedb --yes=all $clear_flag
spacetime generate --lang typescript --out-dir shared-field/spacetimedb/module_bindings --module-path shared-field/spacetimedb
echo "published $database on $server; bindings regenerated"
