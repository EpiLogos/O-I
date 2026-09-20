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

# The local server is part of the same pinned deployment unit: the running
# standalone must be the pinned version too, or the pin is theatre.
if [ "$server" = "local" ]; then
  sp="$(pgrep -f 'spacetimedb-standalone start' | head -1)"
  [ -n "$sp" ] || { echo "local spacetimedb server is not running"; exit 1; }
  real_bin="$(lsof -p "$sp" 2>/dev/null | awk '$4=="txt" && /spacetimedb-standalone/ {print $NF; exit}')"
  [ -n "$real_bin" ] || real_bin="$(ps -p "$sp" -o command= | awk '{for(i=1;i<=NF;i++) if ($i ~ /spacetimedb-standalone$/) {print $i; exit}}')"
  running_version="$("$real_bin" --version 2>/dev/null | grep -oE 'tool version [0-9.]+' | awk '{print $3}')"
  [ "$running_version" = "$pinned" ] || { echo "local spacetimedb server runs ${running_version:-unknown}, pinned is $pinned — restart the server unit on the pinned binary."; exit 1; }
fi

restore_login=0
# Publish as the database's recorded owner, never the ambient CLI login.
# The owner token is created on first publish and reused; the caller's
# cli.toml login is saved and restored around the run.
token_file="${OI_STATE_HOME:-$HOME/.local/state/oi}/spacetimedb/$database.owner-token"
cli_toml="$HOME/.config/spacetime/cli.toml"
if [ -f "$token_file" ]; then
  cp "$cli_toml" "$cli_toml.deploy-pre-owner.bak"
  spacetime login --token "$(cat "$token_file")" >/dev/null
  restore_login=1
elif [ "$server" = "local" ]; then
  echo "no owner token for $database ($token_file). First publish must be explicit: spacetime login --token <owner token for this database>, then rerun."
  exit 1
fi
npm install --prefix shared-field/spacetimedb --no-audit --no-fund >/dev/null
spacetime build --module-path shared-field/spacetimedb
spacetime publish "$database" --server "$server" --module-path shared-field/spacetimedb --yes=all $clear_flag
spacetime generate --lang typescript --out-dir shared-field/spacetimedb/module_bindings --module-path shared-field/spacetimedb
if [ "${restore_login:-0}" = 1 ]; then cp "$cli_toml.deploy-pre-owner.bak" "$cli_toml"; rm -f "$cli_toml.deploy-pre-owner.bak"; fi
echo "published $database on $server; bindings regenerated"
