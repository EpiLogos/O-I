#!/usr/bin/env bash
# oi203 phase B: reconnect and read the journal back. Read-only.
set -u
. /tmp/oi203/env.sh
echo "== B1: all delivery rows created by this episode (frank)"
sqlite3 -readonly -header -column "$DB" "SELECT session, delivery, phase, first_cursor, terminal_cursor FROM encounter_deliveries WHERE session LIKE '%oi203-pf%' ORDER BY first_cursor;"
echo
echo "== B2: verbatim reply bodies reconstructed from agent-message-segment events inside each row's cursors"
for pair in "$S1 delivery/oi203-pf-q1" "$S1 delivery/oi203-pf-group1" "$S2 delivery/oi203-pf-group1" "$S3 delivery/oi203-pf-qx" "$S3 delivery/oi203-pf-qx2" "$S3 delivery/oi203-pf-qx3"; do
  set -- $pair
  echo "--- ROW session=$1 delivery=$2"
  /tmp/oi203/body.sh "$1" "$2"
  echo
done
echo "== B3: TurnEnded count inside each group row (exactly-once check)"
for S in "$S1" "$S2"; do
  F=$(sqlite3 -readonly "$DB" "SELECT first_cursor FROM encounter_deliveries WHERE session='$S' AND delivery='delivery/oi203-pf-group1';")
  T=$(sqlite3 -readonly "$DB" "SELECT terminal_cursor FROM encounter_deliveries WHERE session='$S' AND delivery='delivery/oi203-pf-group1';")
  N=$(sqlite3 -readonly "$DB" "SELECT COUNT(*) FROM encounter_events WHERE session='$S' AND cursor BETWEEN $F AND $T AND event LIKE '%TurnEnded%';")
  echo "$S group1 row $F-$T: TurnEnded=$N"
done
echo
echo "== B4: correlation verdict probes"
for S in "$S1" "$S2"; do
  F=$(sqlite3 -readonly "$DB" "SELECT first_cursor FROM encounter_deliveries WHERE session='$S' AND delivery='delivery/oi203-pf-group1';")
  T=$(sqlite3 -readonly "$DB" "SELECT terminal_cursor FROM encounter_deliveries WHERE session='$S' AND delivery='delivery/oi203-pf-group1';")
  G=$(sqlite3 -readonly "$DB" "SELECT COUNT(*) FROM encounter_events WHERE session='$S' AND cursor BETWEEN $F AND $T AND event LIKE '%GROUPSIG-OI203-4F7Q%';")
  Q=$(sqlite3 -readonly "$DB" "SELECT COUNT(*) FROM encounter_events WHERE session='$S' AND cursor BETWEEN $F AND $T AND event LIKE '%QX-INTERLEAVE%';")
  P=$(sqlite3 -readonly "$DB" "SELECT COUNT(*) FROM encounter_events WHERE session='$S' AND cursor BETWEEN $F AND $T AND event LIKE '%OI203-PONG-ALPHA%';")
  echo "$S group1 [$F-$T]: GROUPSIG=$G interleave-tokens=$Q pong-tokens=$P"
done
F=$(sqlite3 -readonly "$DB" "SELECT first_cursor FROM encounter_deliveries WHERE session='$S3' AND delivery='delivery/oi203-pf-qx3';")
T=$(sqlite3 -readonly "$DB" "SELECT terminal_cursor FROM encounter_deliveries WHERE session='$S3' AND delivery='delivery/oi203-pf-qx3';")
C=$(sqlite3 -readonly "$DB" "SELECT COUNT(*) FROM encounter_events WHERE session='$S3' AND cursor BETWEEN $F AND $T AND event LIKE '%QX-INTERLEAVE-C5A1%';")
echo "s3 qx3 [$F-$T]: own token C5A1 present=$C"
echo
echo "== B5: does the s3 interleave cursor sit inside each group row's span?"
S3C=$F
for S in "$S1" "$S2"; do
  GF=$(sqlite3 -readonly "$DB" "SELECT first_cursor FROM encounter_deliveries WHERE session='$S' AND delivery='delivery/oi203-pf-group1';")
  GT=$(sqlite3 -readonly "$DB" "SELECT terminal_cursor FROM encounter_deliveries WHERE session='$S' AND delivery='delivery/oi203-pf-group1';")
  if [ "$S3C" -ge "$GF" ] && [ "$S3C" -le "$GT" ]; then echo "s3 cursor $S3C INSIDE $S group span [$GF-$GT]"; else echo "s3 cursor $S3C outside $S group span [$GF-$GT]"; fi
done
echo
echo "== B6: owner health after reconnect"
$ENC '{"action":"health"}' | python3 -c 'import json,sys; d=json.load(sys.stdin); print("owner pid", d["data"]["pid"], "protocol", d["data"]["protocol"])'
