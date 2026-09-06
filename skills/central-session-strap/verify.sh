#!/usr/bin/env bash
# central-session-strap verification suite.
#
# Proves the full commissioned flow end to end, without touching live ground
# except read-only proofs:
#   T1  ctrl project NOW Actions work on a real project (read-only inspect)
#   T2  root-register lifecycle semantics on a fixture (return/update/promote/
#       rollover: carry, removal, preserve-ref protection, snapshot fidelity,
#       refusal to re-close a day, human-ground acceptance gate)
#   T3  derived context render is byte-idempotent and provenance-stamped
#   T4  projection wiring (skill resolves in control ground; harness trees
#       report it after aikit projection)
#
# Usage: bash verify.sh [--skip-projection]
set -uo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CENTRAL_ROOT="$(cd "$SKILL_DIR/../../../.." && pwd)"
NOW="$SKILL_DIR/now.py"
PASS=0; FAIL=0

ok()   { PASS=$((PASS+1)); echo "  ok: $1"; }
bad()  { FAIL=$((FAIL+1)); echo "FAIL: $1"; }
check(){ if [ "$2" = "$3" ]; then ok "$1"; else bad "$1 (expected [$3] got [$2])"; fi; }

echo "T1 — project register (canonical ctrl Actions, read-only)"
if ctrl --json action run projectcentral.now.inspect '{"project":"O-I"}' >/tmp/t1.json 2>&1; then
  ok "projectcentral.now.inspect O-I"
  check "field reported present" "$(python3 -c "import json;print(json.load(open('/tmp/t1.json'))['data']['exists'])")" "True"
else
  bad "projectcentral.now.inspect O-I: $(head -c200 /tmp/t1.json)"
fi

echo "T2 — root-register lifecycle on a fixture"
FX=$(mktemp -d)
trap 'rm -rf "$FX"' EXIT
mkdir -p "$FX/Control/agents/now/user" "$FX/Control/agents/now/agents" \
         "$FX/Control/agents/now/day" "$FX/Control/user" "$FX/Control/agents/wiki/returns"
cp "$CENTRAL_ROOT/Control/agents/now/policy.json"    "$FX/Control/agents/now/policy.json"
cp "$CENTRAL_ROOT/Control/agents/now/promotions.json" "$FX/Control/agents/now/promotions.json"
printf 'root scratch, my own words\n' > "$FX/Control/agents/now/user/current.md"
N="python3 $NOW --root $FX"

$N return --actor fixture --kind question --subject q --result "waiting question" --status waiting --id q1 --session-ref sess-1 >/dev/null || bad "return q1"
$N return --actor fixture --kind note --subject n --result "done note" --status resolved --id n1 >/dev/null || bad "return n1"
$N return --actor fixture --kind learning --subject l --result "protected learning" --status resolved --id l1 --preserve-ref "run:example" >/dev/null || bad "return l1"
ok "three returns written"

INSPECT=$($N inspect)
check "active carries waiting"  "$(echo "$INSPECT" | python3 -c "import json,sys;d=json.load(sys.stdin);print('Control/agents/now/agents/q1.json' in d['active_items'])")" "True"
check "open question listed"    "$(echo "$INSPECT" | python3 -c "import json,sys;d=json.load(sys.stdin);print(d['open_questions'])")" "['Control/agents/now/agents/q1.json']"
check "inactive listed"         "$(echo "$INSPECT" | python3 -c "import json,sys;d=json.load(sys.stdin);print(len(d['inactive_items']))")" "2"

$N update --id q1 --status waiting >/dev/null || bad "update noop"

$N promote --source Control/agents/now/agents/l1.json --target agent-wiki \
  --destination Control/agents/wiki/returns/l1.json --acceptance agent-return >/dev/null || bad "agent-wiki promote"
test -f "$FX/Control/agents/wiki/returns/l1.json" && ok "wiki return written"
check "promoted lineage stamped" "$(python3 -c "import json;print(json.load(open('$FX/Control/agents/wiki/returns/l1.json'))['promoted_to'])")" "['Control/agents/wiki/returns/l1.json']"
check "promotions ledger entry"  "$(python3 -c "import json;print(len(json.load(open('$FX/Control/agents/now/promotions.json'))['entries']))")" "1"

if $N promote --source Control/agents/now/user/current.md --target human-ground \
     --destination Control/user/current.md --acceptance agent-return >/dev/null 2>&1; then
  bad "human-ground without human-accepted must refuse"
else
  ok "human-ground acceptance gate refuses"
fi

$N rollover --day 2026-09-06 --next-day 2026-09-07 >/tmp/t2roll.json || bad "rollover: $(cat /tmp/t2roll.json)"
ROLL=$(python3 -c "import json;d=json.load(open('/tmp/t2roll.json'));print(' '.join(d['carried']),'|',' '.join(d['removed']),'|',' '.join(d['protected']))")
check "rollover classification (q1 carried, l1 promoted+protected, n1 removed)" "$ROLL" \
  "Control/agents/now/agents/q1.json | Control/agents/now/agents/n1.json | Control/agents/now/agents/l1.json"
test ! -e "$FX/Control/agents/now/agents/n1.json" && ok "resolved removed from moving field"
check "carried lineage gained day" "$(python3 -c "import json;print(json.load(open('$FX/Control/agents/now/agents/q1.json'))['carried_from_days'])")" "['2026-09-06']"
check "ledger reset after close" "$(python3 -c "import json;print(json.load(open('$FX/Control/agents/now/promotions.json'))['entries'])")" "[]"
diff -q <(printf 'root scratch, my own words\n') "$FX/Control/agents/now/day/2026-09-06.sources/user/current.md" >/dev/null \
  && ok "human scratch byte-preserved in day sources"
test -f "$FX/Control/agents/now/user/current.md" && ok "live human scratch untouched by close"
grep -q "root scratch, my own words" "$FX/Control/agents/now/day/2026-09-06.md" && ok "day reading renders human words"
if $N rollover --day 2026-09-06 --next-day 2026-09-08 >/dev/null 2>&1; then
  bad "re-closing a closed day must refuse"
else
  ok "re-close refused"
fi

echo "T3 — derived context render (byte-idempotent, provenance-stamped)"
(cd "$CENTRAL_ROOT" && python3 "$SKILL_DIR/render-context.py" >/tmp/t3a.json)
(cd "$CENTRAL_ROOT" && python3 "$SKILL_DIR/render-context.py" >/tmp/t3b.json)
check "second render changes nothing" "$(python3 -c "import json;print([json.loads(l)['changed'] for l in open('/tmp/t3b.json')])")" "[False, False]"
cmp -s "$CENTRAL_ROOT/AGENTS.md" "$CENTRAL_ROOT/CLAUDE.md" && ok "AGENTS.md and CLAUDE.md are twins"
grep -q "central.content-fnv1a64/v1" "$CENTRAL_ROOT/AGENTS.md" && ok "provenance revisions stamped"
grep -q "generated-derived" "$CENTRAL_ROOT/AGENTS.md" && ok "derived standing disclosed"

echo "T4 — projection wiring"
if ctrl --json action run control.skills.inspect 2>/dev/null | grep -q central-session-strap; then
  ok "skill resolves in control ground"
else
  bad "skill not found by control.skills.inspect"
fi
if [ "${1:-}" != "--skip-projection" ]; then
  FOUND=no
  for TREE in "$HOME/.agents/skills/central-session-strap" "$HOME/.claude/skills/central-session-strap"; do
    if [ -f "$TREE/SKILL.md" ]; then FOUND="$TREE"; fi
  done
  if [ "$FOUND" != "no" ]; then
    ok "projected into harness trees ($FOUND resolves)"
  else
    bad "projected into harness trees (no tree resolves the skill)"
  fi
else
  echo "  (skipped: --skip-projection)"
fi

echo
echo "passed=$PASS failed=$FAIL"
[ "$FAIL" -eq 0 ]
