#!/usr/bin/env bash
# body.sh <session> <delivery> — reconstruct the verbatim reply body from agent-message-segment events inside the row's cursor range
set -u
. /tmp/oi203/env.sh
F=$(sqlite3 -readonly "$DB" "SELECT first_cursor FROM encounter_deliveries WHERE session='$1' AND delivery='$2';")
T=$(sqlite3 -readonly "$DB" "SELECT terminal_cursor FROM encounter_deliveries WHERE session='$1' AND delivery='$2';")
if [ -z "$T" ]; then echo "(no terminal cursor)"; exit 0; fi
sqlite3 -readonly "$DB" "SELECT cursor, event FROM encounter_events WHERE session='$1' AND cursor BETWEEN $F AND $T AND event LIKE '%agent-message-segment%';" > /tmp/oi203/segs-$$
python3 - "$$" <<'PYEOF'
import json, sys
tag = sys.argv[1]
segs = []
for line in open(f"/tmp/oi203/segs-{tag}"):
    line = line.rstrip("\n")
    if not line.strip():
        continue
    cur, ev = line.split("|", 1)
    k = json.loads(ev)["event"]["Signal"]["kind"]
    if k["kind"] == "agent-message-segment":
        segs.append((int(cur), k["text"]))
body = "".join(t for _, t in segs)
print(body)
PYEOF
rm -f /tmp/oi203/segs-$$
