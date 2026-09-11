#!/usr/bin/env python3
"""Native S0 activation in a fresh CI home, not a release or user installation.

Retain the bootstrap-catalogue attempt, then use O:I's native catalogue adoption
surface to admit the exact tested source cut. Never relabel binaries to older
revisions, replace native packages with test scripts, or change owner source.
"""
import argparse
from datetime import datetime, timezone
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
    env = {key: value for key, value in os.environ.items() if not key.startswith(('OI_', 'AIKIT_')) and key != 'CENTRAL_ROOT'}
    env.update(HOME=str(home), OI_HOME=str(config), OI_DATA_HOME=str(home / '.local/share/oi'), NO_COLOR='1')
    env['PATH'] = str(out / 'poisoned-path') + os.pathsep + os.environ['PATH']
    records = []
    receipt = {'schema': 'oi.development-field-source-activation-probe/v1', 'cut_sha256': sha(cut_path),
        'harness_revision': os.environ.get('GITHUB_SHA'), 'status': 'not-established',
        'commands': records, 'registered_source_revisions': {key: value['version'] for key, value in modules.items()},
        'executable_evidence': dispatch, 'revision_relabelling': False, 'user_home_modified': False,
        'repository_catalogue_modified': False, 'release_publication': False,
        'whole_C': 'not-established', 'P': 'not-exercised', 'M': 'not-exercised', 'H': 'not-exercised'}
    def call(arguments):
        result = subprocess.run([str(oi), *arguments], cwd=home, env=env, capture_output=True, text=True)
        records.append({'argv': ['oi', *arguments], 'exit_code': result.returncode, 'stdout': result.stdout, 'stderr': result.stderr})
        return result
    activated = None
    try:
        selected = call(['suite', 'channel', 'source'])
        assert selected.returncode == 0, selected.stderr
        baseline = call(['suite', 'update', '--json'])
        before = call(['suite', 'status', '--json'])
        assert before.returncode == 0, before.stderr
        before_status = json.loads(before.stdout)
        receipt['bootstrap_catalogue_attempt'] = {'exit_code': baseline.returncode, 'stderr': baseline.stderr,
            'suite_status': before_status, 'standing': 'observation-not-irreducible-blocker'}

        # Derive only admission revisions; keep the native owner command grammar
        # and package/install descriptors untouched. The original catalogue is
        # retained by the exact O:I source archive, not overwritten or republished.
        original = ROOT / '.development-field-owners/oi/surfaces.json'
        catalogue = json.loads(original.read_text())
        assert catalogue['schema'] == 1
        assert len(catalogue['surfaces']) == 6
        assert {s['id'] for s in catalogue['surfaces']} == set(modules)
        changes = []
        for surface in catalogue['surfaces']:
            revision = expected[surface['id']]
            assert surface['native']['command_standing'] == 'accepted-main'
            for section, key in [('native', 'command_revision'), ('install', 'ref'), ('install', 'revision')]:
                changes.append({'product': surface['id'], 'path': section + '.' + key,
                    'from': surface[section][key], 'to': revision})
                surface[section][key] = revision
        catalogue['verified_at'] = datetime.now(timezone.utc).isoformat()
        catalogue['conformance_basis'] = {'standing': 'explicit-ci-source-cut-not-release',
            'cut_sha256': sha(cut_path), 'oi_revision': expected['oi'], 'derived_from_sha256': sha(original)}
        candidate_path = out / 'source-cut-catalogue.json'
        candidate_path.write_text(json.dumps(catalogue, indent=2, sort_keys=True) + '\n')
        receipt['catalogue_derivation'] = {**catalogue['conformance_basis'], 'revision_changes': changes,
            'catalogue_sha256': sha(candidate_path), 'path': str(candidate_path),
            'native_command_grammar_changed': False, 'native_package_descriptors_changed': False}
        adopted = call(['catalogue', 'adopt', str(candidate_path)])
        assert adopted.returncode == 0, adopted.stderr
        disclosed = call(['catalogue', 'show', '--json'])
        assert disclosed.returncode == 0, disclosed.stderr
        receipt['catalogue_disclosure'] = json.loads(disclosed.stdout)
        assert receipt['catalogue_disclosure']['origin'] == 'runtime'
        assert sha(config / 'catalogue.json') == sha(candidate_path)
        receipt['exact_cut_catalogue_adopted'] = True
        activated = call(['suite', 'update', '--json'])
        observed = call(['suite', 'status', '--json'])
        assert observed.returncode == 0, observed.stderr
        receipt['suite_status'] = json.loads(observed.stdout)
        receipt['activation_exit_code'] = activated.returncode
        receipt['activation_stderr'] = activated.stderr
        if activated.returncode:
            assert receipt['suite_status']['active'] == before_status['active'], 'failed activation changed the active suite'
            receipt['failed_activation_preserves_previous_receipt'] = True
            receipt['status'] = 'blocked'
        else:
            assert receipt['suite_status']['active_ok'] is True
            receipt['status'] = 'activation-passed-lifecycle-not-established'
    except Exception as error:
        receipt.update(status='harness-or-contract-failure', error=str(error))
    finally:
        (out / 'source-activation.json').write_text(json.dumps(receipt, indent=2, sort_keys=True) + '\n')
        print(json.dumps({'status': receipt['status'], 'catalogue_adopted': receipt.get('exact_cut_catalogue_adopted', False),
            'activation_exit': activated.returncode if activated is not None else None,
            'stderr': activated.stderr if activated is not None else receipt.get('error')}))
    return int(receipt['status'] != 'activation-passed-lifecycle-not-established')

if __name__ == '__main__':
    sys.exit(main())
