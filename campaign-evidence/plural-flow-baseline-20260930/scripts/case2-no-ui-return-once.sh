#!/usr/bin/env bash
# MP06-flavoured discriminating case: a delayed response must return exactly
# once after every UI/reading client is closed, and reconnection must find it
# on its correct request without restarting the turn.
#   aikit 0.1.0 (eeaab031bd94), provider pi (pi-rpc, zai/glm-5.3-flash)
set -u
ENC="aikit session-space encounter --request-json"
S3="agent-session/pf-baseline-inv-3"
REV3="rev/aikit-mint-1790764770-8e8d"
DB="$HOME/.aikit/state/encounters.sqlite3"
QD="delivery/pf-case2-qd2"

row() { sqlite3 -readonly "$DB" "SELECT phase||' '||first_cursor||'-'||COALESCE(terminal_cursor,'open') FROM encounter_deliveries WHERE session='$S3' AND delivery='$QD';"; }

echo "== step 1: send the delayed question"
$ENC "{\"action\":\"send\",\"agent_session\":\"$S3\",\"turn\":{\"delivery_ref\":\"$QD\",\"sender\":\"human:owner\",\"expected_binding_revision\":\"$REV3\",\"packet\":{\"text\":\"Write a careful answer of roughly 150 words explaining how ocean tides work. Take your time and reason before answering. Finish with the exact token TOKEN-DELTA-3311.\",\"source_refs\":[],\"audience\":[\"agent/o-i-chat\"]}}}" \
  | python3 -c 'import json,sys; d=json.load(sys.stdin); dd=d["data"]["delivery"]; print("QD accepted:", dd["phase"], "first_cursor", dd["first_cursor"])'

echo "== step 2: close every reading client (no poller stays attached). The resident owner keeps the turn."
sleep 2
OWNER_PID=$(aikit session-space encounter --request-json '{"action":"health"}' | python3 -c 'import json,sys; print(json.load(sys.stdin)["data"]["pid"])')
echo "clients closed at $(date -u +%H:%M:%SZ); resident owner pid: $OWNER_PID"

echo "== step 3: stay disconnected until well past expected completion (45s)"
sleep 45

echo "== step 4: reconnect and read the journal back"
row "$QD"

echo "== step 5: read the delivery twice through the owner (fresh client each time)"
for i in 1 2; do
  $ENC "{\"action\":\"delivery\",\"agent_session\":\"$S3\",\"delivery_ref\":\"$QD\"}" \
    | python3 -c 'import json,sys; d=json.load(sys.stdin); dd=d["data"]; print("readback '$i':", dd["phase"], dd["first_cursor"], dd["terminal_cursor"])'
done

echo "== step 6: is the full answer in the owner journal between the row's cursors?"
F=$(sqlite3 -readonly "$DB" "SELECT first_cursor FROM encounter_deliveries WHERE session='$S3' AND delivery='$QD';")
T=$(sqlite3 -readonly "$DB" "SELECT terminal_cursor FROM encounter_deliveries WHERE session='$S3' AND delivery='$QD';")
echo "row cursors: $F-$T"
sqlite3 -readonly "$DB" "SELECT cursor, event FROM encounter_events WHERE session='$S3' AND cursor BETWEEN $F AND $T AND event LIKE '%agent-message-segment%';" > /tmp/pf-case2-segments.raw
python3 - <<'EOF'
import json
segs = []
for line in open("/tmp/pf-case2-segments.raw"):
    line = line.rstrip("\n")
    if not line.strip():
        continue
    cur, ev = line.split("|", 1)
    k = json.loads(ev)["event"]["Signal"]["kind"]
    if k["kind"] == "agent-message-segment":
        segs.append((int(cur), k["text"]))
body = " ".join(t for _, t in segs)
print("segments:", len(segs), "body chars:", len(body))
print("ends with TOKEN-DELTA-3311:", body.rstrip().endswith("TOKEN-DELTA-3311"))
print("tail:", repr(body[-80:]))
EOF

echo "== step 7: exactly-once accounting"
ROWS=$(sqlite3 -readonly "$DB" "SELECT COUNT(*) FROM encounter_deliveries WHERE session='$S3' AND delivery='$QD';")
TURNS=$(sqlite3 -readonly "$DB" "SELECT COUNT(*) FROM encounter_events WHERE session='$S3' AND cursor BETWEEN $F AND $T AND event LIKE '%TurnEnded%';")
echo "delivery rows for $QD: $ROWS; TurnEnded events in range: $TURNS"

echo "== VERDICT"
if [ "$ROWS" = "1" ] && [ "$TURNS" = "1" ]; then
  echo "PASS: exactly one delivery row and one completed turn survived full client closure; reconnection read it without restarting."
else
  echo "FAIL: rows=$ROWS turns=$TURNS"
fi
