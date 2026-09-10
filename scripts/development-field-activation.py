#!/usr/bin/env python3
"""Native S0 activation in a fresh temporary CI home, never on a user's installed suite.

Consume exact source-built binary evidence. Do not relabel current binaries with
historical catalogue revisions just to make activation pass.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', required=True, type=Path)
    out = parser.parse_args().out.resolve()
    cut_path = ROOT / 'tests/development-field/cut.json'
    cut = json.loads(cut_path.read_text())
    expected = {x['id']: x['revision'] for x in cut['owners']}
    dispatch = json.loads((out / 'source-dispatch.json').read_text())
    assert dispatch['status'] == 'passed'
    assert dispatch['oi']['revision'] == expected['oi']
    oi = Path(dispatch['oi']['executable'])
    assert sha(oi) == dispatch['oi']['sha256']
    modules = {}
    for product in dispatch['products']:
        assert product['revision'] == expected[product['owner']]
        assert sha(Path(product['executable'])) == product['sha256']
        modules[product['owner']] = {'id': product['owner'], 'public_name': product['owner'],
            'native_executable': product['executable'], 'version': product['revision'],
            'docs': '', 'modality': 'developer-source', 'install_source': 'exact-ci-source-cut'}
    assert set(modules) == set(expected) - {'oi'}
    home = out / 'activation-home'
    config = home / '.config/oi'
    config.mkdir(parents=True, exist_ok=False)
    (config / 'composition.json').write_text(json.dumps({'schema': 1, 'modules': modules}, indent=2) + '\n')
    env = {key: value for key, value in os.environ.items() if not key.startswith('OI_') and key not in {'CENTRAL_ROOT', 'AIKIT_HOME'}}
    env.update(HOME=str(home), OI_HOME=str(config), OI_DATA_HOME=str(home / '.local/share/oi'), NO_COLOR='1')
    env['PATH'] = str(out / 'poisoned-path') + os.pathsep + os.environ['PATH']
    records = []
    def call(arguments):
        result = subprocess.run([str(oi), *arguments], cwd=home, env=env, capture_output=True, text=True)
        records.append({'argv': ['oi', *arguments], 'exit_code': result.returncode, 'stdout': result.stdout, 'stderr': result.stderr})
        return result
    selected = call(['suite', 'channel', 'source'])
    assert selected.returncode == 0, selected.stderr
    activated = call(['suite', 'update', '--json'])
    observed = call(['suite', 'status', '--json'])
    receipt = {'schema': 'oi.development-field-source-activation-probe/v1', 'cut_sha256': sha(cut_path),
        'harness_revision': os.environ.get('GITHUB_SHA'),
        'status': 'blocked' if activated.returncode else 'activation-passed-lifecycle-not-established',
        'commands': records, 'registered_source_revisions': {key: value['version'] for key, value in modules.items()},
        'executable_evidence': dispatch, 'suite_status': json.loads(observed.stdout) if observed.returncode == 0 else None,
        'revision_relabelling': False, 'user_home_modified': False,
        'whole_C': 'not-established', 'P': 'not-exercised', 'M': 'not-exercised', 'H': 'not-exercised'}
    (out / 'source-activation.json').write_text(json.dumps(receipt, indent=2, sort_keys=True) + '\n')
    print(json.dumps({'status': receipt['status'], 'activation_exit': activated.returncode, 'stderr': activated.stderr}))
    return 1 if activated.returncode else 0

if __name__ == '__main__':
    sys.exit(main())
