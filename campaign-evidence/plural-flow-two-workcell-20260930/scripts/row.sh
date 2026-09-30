#!/usr/bin/env bash
# row.sh <session> <delivery> — print "phase first-terminal"
set -u
. /tmp/oi203/env.sh
sqlite3 -readonly "$DB" "SELECT phase||' '||first_cursor||'-'||COALESCE(terminal_cursor,'open') FROM encounter_deliveries WHERE session='$1' AND delivery='$2';"
