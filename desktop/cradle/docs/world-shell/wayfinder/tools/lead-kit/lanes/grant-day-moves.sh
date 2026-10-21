#!/bin/bash
# The Day's moves need these grants in Control/user/native-action-authority.json (Central #286, ai-kit #538):
#  1. your human grant gains central.day.settings.write, central.day.move.record, central.day.rollover and
#     central.day.close-carry (saving the Day's settings, pressing a move, opening tomorrow, closing with the carry);
#  2. a new service principal for the Day's agent, native-service:aikit/day-agent, with central.day.move.record,
#     central.receiving.submit and central.day.close-carry, over the same scopes as yours and the same expiry. Its token is
#     created once at ~/.central/native-token-day-agent (owner-only, 0600); only its sha256 goes into the grants file.
# The file keeps its own format (indent 1, no trailing newline). A copy of the old file goes to ~/.central/archive/.
set -euo pipefail
BACKUP=~/.central/archive/native-action-authority.before-day-moves.json
AUTH=/Users/admin/Central/Control/user/native-action-authority.json
cp -p "$AUTH" "$BACKUP"
python3 - "$AUTH" <<'EOF'
import json, secrets, hashlib, os, sys
p = sys.argv[1]
d = json.loads(open(p).read())
human = next(g for g in d['grants'] if g['actor_kind'] == 'human')
for a in ['central.day.settings.write', 'central.day.move.record', 'central.day.rollover', 'central.day.close-carry']:
    if a not in human['actions']:
        human['actions'].append(a)
human['actions'].sort()
tok_path = os.path.expanduser('~/.central/native-token-day-agent')
if os.path.exists(tok_path):
    token = open(tok_path).read().strip()
else:
    token = secrets.token_hex(32)
    fd = os.open(tok_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    os.write(fd, token.encode())
    os.close(fd)
sha = hashlib.sha256(token.encode()).hexdigest()
d['grants'] = [g for g in d['grants'] if g['principal_ref'] != 'native-service:aikit/day-agent']
d['grants'].append({
    'principal_ref': 'native-service:aikit/day-agent',
    'actor_kind': 'native-service',
    'token_sha256': sha,
    'scope_refs': list(human['scope_refs']),
    'actions': ['central.day.close-carry', 'central.day.move.record', 'central.receiving.submit'],
    'expires_at_unix_seconds': human['expires_at_unix_seconds'],
})
open(p, 'w').write(json.dumps(d, indent=1))
for g in d['grants']:
    print(g['principal_ref'], '—', len(g['actions']), 'actions')
EOF
ls -l ~/.central/native-token-day-agent
diff <(python3 -m json.tool "$BACKUP") <(python3 -m json.tool "$AUTH") | grep -v token_sha256 || true
