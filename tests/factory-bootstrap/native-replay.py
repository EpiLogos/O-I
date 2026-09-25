#!/usr/bin/env python3
"""Real Central/Factory/O:I bootstrap replay; no provider or model is invoked.
All inputs, native outputs and negative outcomes remain under --out.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess

p = argparse.ArgumentParser()
for name in ('oi', 'ctrl', 'factory', 'out'):
    p.add_argument('--' + name, required=True)
a = p.parse_args()
out = Path(a.out).resolve()
out.mkdir(parents=True, exist_ok=False)
root = out / 'Central'
home = out / 'oi-home'
home.mkdir()
env = dict(os.environ, OI_HOME=str(home))
log = out / 'native-operations.jsonl'

def run(argv, expected=0, structured=False):
    result = subprocess.run([str(x) for x in argv], env=env, text=True, capture_output=True)
    with log.open('a') as f:
        f.write(json.dumps({'argv':[str(x) for x in argv], 'exit':result.returncode,
                            'stdout':result.stdout, 'stderr':result.stderr}) + '\n')
    assert result.returncode == expected, (argv, result.stdout, result.stderr)
    return json.loads(result.stdout) if structured else result

def action(name, data):
    value = run([a.ctrl, '--root', root, '--json', 'action', 'run', name, json.dumps(data)], structured=True)
    assert value['ok'], value
    return value['data']

def read_sources(reconcile=False):
    return run([a.oi, 'factory-projects', *(['--reconcile'] if reconcile else []), '--json'], structured=True)

def state_bytes(source):
    return Path(source['statePath']).read_bytes()

run([a.ctrl, '--root', root, 'init', '--json'])
for name in ('My Project', 'Existing', 'Before'):
    (root / 'Work' / name).mkdir()
action('projectcentral.init', {'project':'Existing', 'project_id':'native-existing-id'})
action('projectcentral.init', {'project':'Before', 'project_id':'native-moved-id'})
modules = {}
for owner, binary, alias in [('central',a.ctrl,'ctrl'), ('software-factory',a.factory,'factory')]:
    modules[owner] = {'id':owner, 'public_name':owner, 'native_executable':str(Path(binary).resolve()),
                      'alias':alias, 'docs':'native bootstrap replay'}
(home / 'composition.json').write_text(json.dumps({'schema':1, 'personal_ground':str(root), 'modules':modules}))
first = read_sources(True)
assert first['complete'], first
sources = {s['centralProject']:s for s in first['sources']}
assert set(sources) == {'', 'My Project', 'Existing', 'Before'}, sources
assert sources['']['projectKey'] == 'control:root'
assert sources['My Project']['centralProjectRef'] == 'My Project'
assert sources['Existing']['centralProjectRef'] == 'native-existing-id'
assert all(s['runCount'] == 0 for s in sources.values())
original = {key:state_bytes(source) for key,source in sources.items()}
second = read_sources(True)
assert second['complete'], second
assert {s['centralProject']:state_bytes(s) for s in second['sources']} == original

# Real Git material and uncommitted content move intact. Factory relocation
# preserves its Project identity and records the old/new source relation.
before = root / 'Work' / 'Before'
run(['git', 'init', '--quiet', before])
(before / 'authored.txt').write_text('Retain this uncommitted product source.\n')
git_bytes = {str(x.relative_to(before)):x.read_bytes() for x in (before / '.git').rglob('*') if x.is_file()}
incoming = out / 'Incoming'
before.rename(incoming)
run([a.oi, 'migrate', incoming])
moved = root / 'Work' / 'Incoming'
assert moved.exists() and not incoming.exists()
assert (moved / 'authored.txt').read_text() == 'Retain this uncommitted product source.\n'
assert {str(x.relative_to(moved)):x.read_bytes() for x in (moved / '.git').rglob('*') if x.is_file()} == git_bytes
reading = read_sources()
assert reading['complete'], reading
moved_source = next(s for s in reading['sources'] if s['centralProject'] == 'Incoming')
assert moved_source['projectRef'] == sources['Before']['projectRef']
state = json.loads(state_bytes(moved_source))['state']
assert len(state['centralProjectLinkRelocations']) == 1
assert state['journeys'] == json.loads(original['Before'])['state']['journeys']

# A corrupt independent project cannot undo a completed move or make readable
# scopes disappear. Preserve its broken bytes and the native refusal.
placement = root / 'Work' / 'Existing' / '.factory' / 'project.json'
placement.write_text('{invalid placement retained for the negative case')
new = out / 'Another Project'
new.mkdir()
(new / 'work.txt').write_text('preserve me')
result = run([a.oi, 'migrate', new])
assert 'primary setup/placement operation completed' in result.stderr.lower(), result
assert (root / 'Work' / 'Another Project' / 'work.txt').read_text() == 'preserve me'
partial = read_sources()
assert not partial['complete']
assert any(e['project'] == 'Existing' for e in partial['errors'])
assert {'', 'My Project', 'Incoming', 'Another Project'} <= {s['centralProject'] for s in partial['sources']}

# A changed Central identity must not be silently attached to old Factory work.
manifest = root / 'Work' / 'My Project' / 'ProjectCentral' / 'project.json'
changed = json.loads(manifest.read_text())
changed['project_id'] = 'foreign identity'
manifest.write_text(json.dumps(changed))
foreign = read_sources()
assert any(e['project'] == 'My Project' for e in foreign['errors'])
assert not any(s['centralProject'] == 'My Project' for s in foreign['sources'])
result = {'standing':'controlled-real-native-bootstrap-replay', 'provider_execution':False,
          'checks':['root and ordinary child bootstrap','existing identity','spaced project identity',
                    'byte-identical replay','Git and dirty-file migration','native link relocation',
                    'partial reconciliation after committed move','foreign identity refusal'],
          'native_operation_log':str(log), 'complete':True}
(out / 'return.json').write_text(json.dumps(result, indent=2))
print(json.dumps(result, indent=2))
