#!/usr/bin/env bash
set -u
. /tmp/oi203/env.sh
GROUPSIG="GROUPSIG-OI203-4F7Q"
QTEXT="You are one recipient session in a live multi-recipient correlation test on this machine. Answer in about 170 words: in a multi-recipient conversation, what must reply correlation rest on, and what breaks if an owner infers an answer from recency (the newest assistant block) instead of durable delivery identity? Answer plainly from the position of a session whose reply is being attributed. End your reply with the exact token $GROUPSIG and nothing after it."
QX2="Reply with exactly the token QX-INTERLEAVE-B3E8 and nothing else."

echo "== A2-1: send-group delivery/oi203-pf-group1 to s1+s2 (one logical request, two recipients)"
$ENC "{\"action\":\"send-group\",\"space\":\"session-space/oi203-pf\",\"recipients\":[{\"agent_session\":\"$S1\"},{\"agent_session\":\"$S2\"}],\"delivery_ref\":\"delivery/oi203-pf-group1\",\"sender\":\"human:owner\",\"expected_binding_revision\":\"$REV1\",\"packet\":{\"text\":\"$QTEXT\",\"source_refs\":[],\"audience\":[\"$AGENT\"]}}}" > /tmp/oi203/group1-accept.json 2>&1
python3 - <<'PY'
import json
d = json.load(open("/tmp/oi203/group1-accept.json"))
if d.get("ok"):
    print("GROUP accepted; data keys:", sorted(d["data"].keys()))
    print(json.dumps(d["data"], indent=1)[:1200])
else:
    print("GROUP REFUSED:", d.get("error",{}).get("code"), "-", str(d.get("error",{}).get("message"))[:200])
PY

echo "== A2-2: immediately fire unrelated interleaved question on s3 (lands inside the group's span)"
sleep 1
$ENC "{\"action\":\"send\",\"space\":\"session-space/oi203-pf\",\"agent_session\":\"$S3\",\"turn\":{\"delivery_ref\":\"delivery/oi203-pf-qx2\",\"sender\":\"human:owner\",\"expected_binding_revision\":\"$REV3\",\"packet\":{\"text\":\"$QX2\",\"source_refs\":[],\"audience\":[\"$AGENT\"]}}}" > /tmp/oi203/qx2-accept.json 2>&1
python3 - <<'PY'
import json
d = json.load(open("/tmp/oi203/qx2-accept.json"))
if d.get("ok"):
    dl = d["data"]["delivery"]
    print("QX2 accepted:", dl["phase"], "first_cursor", dl["first_cursor"])
else:
    print("QX2 REFUSED:", d.get("error",{}).get("code"), "-", str(d.get("error",{}).get("message"))[:200])
PY
echo "== A2-3: clients closed"
date -u +"clients-closed %H:%M:%SZ"
