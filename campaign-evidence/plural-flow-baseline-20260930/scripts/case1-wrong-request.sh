#!/usr/bin/env bash
# MP04-flavoured discriminating case: an unrelated/newer reply must NOT satisfy
# the wrong request. Runs against the installed encounter owner on frank.
#   aikit 0.1.0 (eeaab031bd94), provider pi (pi-rpc, zai/glm-5.3-flash)
set -u
ENC="aikit session-space encounter --request-json"
S2="agent-session/pf-baseline-inv-2"
REV2="rev/aikit-mint-1790764664-6f7f"
DB="$HOME/.aikit/state/encounters.sqlite3"
QA="delivery/pf-case1-qa"
QB="delivery/pf-case1-qb"

row() { sqlite3 -readonly "$DB" "SELECT phase||' '||first_cursor||'-'||COALESCE(terminal_cursor,'open') FROM encounter_deliveries WHERE session='$S2' AND delivery='$1';"; }

echo "== step 1: send QA (expects TOKEN-ALPHA-9042)"
$ENC "{\"action\":\"send\",\"agent_session\":\"$S2\",\"turn\":{\"delivery_ref\":\"$QA\",\"sender\":\"human:owner\",\"expected_binding_revision\":\"$REV2\",\"packet\":{\"text\":\"Reply with exactly the token TOKEN-ALPHA-9042 and nothing else.\",\"source_refs\":[],\"audience\":[\"agent/o-i-chat\"]}}}" \
  | python3 -c 'import json,sys; d=json.load(sys.stdin); print("QA accepted:", d["data"]["delivery"]["phase"], d["data"]["delivery"]["first_cursor"])'

echo "== step 2: while QA in flight, send unrelated QB to the SAME session (must serialize, not guess)"
sleep 1
QB1=$($ENC "{\"action\":\"send\",\"agent_session\":\"$S2\",\"turn\":{\"delivery_ref\":\"$QB\",\"sender\":\"human:owner\",\"expected_binding_revision\":\"$REV2\",\"packet\":{\"text\":\"Reply with exactly the token TOKEN-BETA-5117 and nothing else.\",\"source_refs\":[],\"audience\":[\"agent/o-i-chat\"]}}}" 2>&1)
echo "$QB1" | python3 -c 'import json,sys
d=json.load(sys.stdin)
if d.get("ok"): print("QB accepted while QA in flight:", d["data"]["delivery"]["phase"])
else: print("QB refused while QA in flight:", d["error"]["code"], "-", d["error"]["message"][:90])'

echo "== step 3: wait for QA terminal state"
for i in $(seq 1 20); do
  P=$(row "$QA")
  case "$P" in returned*|failed*|cancelled*) echo "QA: $P (poll $i)"; break;; esac
  sleep 3
done

echo "== step 4: now send QB for real"
$ENC "{\"action\":\"send\",\"agent_session\":\"$S2\",\"turn\":{\"delivery_ref\":\"$QB\",\"sender\":\"human:owner\",\"expected_binding_revision\":\"$REV2\",\"packet\":{\"text\":\"Reply with exactly the token TOKEN-BETA-5117 and nothing else.\",\"source_refs\":[],\"audience\":[\"agent/o-i-chat\"]}}}" \
  | python3 -c 'import json,sys; d=json.load(sys.stdin); print("QB accepted:", d["data"]["delivery"]["phase"], d["data"]["delivery"]["first_cursor"])'
for i in $(seq 1 20); do
  P=$(row "$QB")
  case "$P" in returned*|failed*|cancelled*) echo "QB: $P (poll $i)"; break;; esac
  sleep 3
done

echo "== step 5: read back QA delivery state — must still be QA's own turn, never the newer BETA"
$ENC "{\"action\":\"delivery\",\"agent_session\":\"$S2\",\"delivery_ref\":\"$QA\"}" \
  | python3 -c 'import json,sys; d=json.load(sys.stdin); dd=d["data"]; print("QA readback:", dd["phase"], dd["first_cursor"], dd["terminal_cursor"])'

echo "== step 6: extract the final agent-message-segment text attributed to each delivery's own cursor range"
QA_F=$(sqlite3 -readonly "$DB" "SELECT first_cursor FROM encounter_deliveries WHERE session='$S2' AND delivery='$QA';")
QA_T=$(sqlite3 -readonly "$DB" "SELECT terminal_cursor FROM encounter_deliveries WHERE session='$S2' AND delivery='$QA';")
QB_F=$(sqlite3 -readonly "$DB" "SELECT first_cursor FROM encounter_deliveries WHERE session='$S2' AND delivery='$QB';")
QB_T=$(sqlite3 -readonly "$DB" "SELECT terminal_cursor FROM encounter_deliveries WHERE session='$S2' AND delivery='$QB';")
for pair in "QA $QA_F $QA_T" "QB $QB_F $QB_T"; do
  set -- $pair; NAME=$1; F=$2; T=$3
  TXT=$(sqlite3 -readonly "$DB" "SELECT event FROM encounter_events WHERE session='$S2' AND cursor BETWEEN $F AND $T AND event LIKE '%agent-message-segment%';" \
    | python3 -c 'import sys,json
segs=[]
for line in sys.stdin:
    line=line.rstrip()
    if not line: continue
    _,_,ev=line.split("|",2)
    k=json.loads(ev)["event"]["Signal"]["kind"]
    if k["kind"]=="agent-message-segment": segs.append(k["text"])
print(" | ".join(segs) if segs else "(none)")')
  echo "$NAME segments [$F-$T]: $TXT"
done

echo "== VERDICT"
QA_SEG=$(sqlite3 -readonly "$DB" "SELECT event FROM encounter_events WHERE session='$S2' AND cursor BETWEEN $QA_F AND $QA_T AND event LIKE '%agent-message-segment%';" | grep -c "TOKEN-ALPHA-9042" || true)
QB_IN_QA=$(sqlite3 -readonly "$DB" "SELECT event FROM encounter_events WHERE session='$S2' AND cursor BETWEEN $QA_F AND $QA_T AND event LIKE '%agent-message-segment%';" | grep -c "TOKEN-BETA-5117" || true)
if [ "$QA_SEG" -ge 1 ] && [ "$QB_IN_QA" -eq 0 ]; then
  echo "PASS: QA's recorded reply is its own TOKEN-ALPHA-9042; the newer unrelated TOKEN-BETA-5117 never satisfied QA."
else
  echo "FAIL: QA cursor range contains ALPHA=$QA_SEG BETA=$QB_IN_QA — newest-block confusion."
fi
