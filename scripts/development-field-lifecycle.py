#!/usr/bin/env python3
"""Exercise the S0 whole-suite lifecycle: update, repair and rollback.

Runs against the already-activated exact source cut (development-field-activation.py
prepares the home and receipt). This step proves the transactional lifecycle the
whole-gate S0 check names — that a coherent active receipt repairs as a no-op,
that a drifted receipt is re-materialised, and that activating a newer candidate
then rolling back atomically restores the previous coherent receipt.

It never claims install/update/repair/rollback against a physical machine, a
release artifact, or a human; those remain P/M/H and are not exercised here.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', required=True, type=Path)
    out = parser.parse_args().out.resolve()

    cut_path = ROOT / 'tests/development-field/cut.json'
    cut = json.loads(cut_path.read_text())
    cut_sha256 = sha(cut_path)
    expected = {x['id']: x['revision'] for x in cut['owners']}

    dispatch = json.loads((out / 'source-dispatch.json').read_text())
    assert dispatch['status'] == 'passed'
    oi = Path(dispatch['oi']['executable'])
    products = {p['owner']: p for p in dispatch['products']}
    assert set(products) == set(expected) - {'oi'}
    for owner, product in products.items():
        assert product['revision'] == expected[owner]

    home = out / 'activation-home'
    config = home / '.config/oi'
    composition_path = config / 'composition.json'
    active_path = home / '.local/share/oi/receipts/active-suite.json'
    assert composition_path.is_file(), 'lifecycle requires the activated suite from development-field-activation.py'
    assert active_path.is_file(), 'lifecycle requires an active suite receipt'

    env = {key: value for key, value in os.environ.items() if not key.startswith(('OI_', 'AIKIT_')) and key != 'CENTRAL_ROOT'}
    env.update(HOME=str(home), OI_HOME=str(config), OI_DATA_HOME=str(home / '.local/share/oi'), NO_COLOR='1')
    env['PATH'] = str(out / 'poisoned-path') + os.pathsep + os.environ['PATH']

    record = {
        'schema': 'oi.development-field-suite-lifecycle/v1',
        'cut_sha256': cut_sha256,
        'harness_revision': os.environ.get('GITHUB_SHA'),
        'status': 'failed',
        'steps': [],
        'P': 'not-exercised', 'M': 'not-exercised', 'H': 'not-exercised',
    }

    def call(arguments):
        result = subprocess.run([str(oi), *arguments], cwd=home, env=env, capture_output=True, text=True)
        record['steps'].append({'argv': ['oi', *arguments], 'exit_code': result.returncode,
                                'stdout': result.stdout, 'stderr': result.stderr})
        return result

    def active_receipt():
        return json.loads(active_path.read_text())

    try:
        assert call(['suite', 'status', '--json']).returncode == 0, 'oi suite status must run'
        before_ref = active_receipt()['receipt_ref']
        record['active_receipt_before'] = before_ref
        original_actuation_sha256 = active_receipt()['products']['actuation']['sha256']
        assert active_receipt()['products']['actuation']['revision'] == expected['actuation']

        # repair: a coherent active receipt is a no-op, never a rewrite.
        coherent = call(['suite', 'repair', '--json'])
        assert coherent.returncode == 0, coherent.stderr
        assert active_receipt()['receipt_ref'] == before_ref, 'repair on a coherent receipt must not rewrite it'
        record['repair_coherent'] = {'noop': True, 'receipt_unchanged': True}

        # rollback: activate a newer candidate, then restore the previous receipt.
        original_composition = composition_path.read_text()
        actuation_executable = Path(json.loads(original_composition)['modules']['actuation']['native_executable'])
        assert actuation_executable.is_file()
        v2_dir = out / 'lifecycle-actuation-v2'
        v2_dir.mkdir(parents=True, exist_ok=True)
        v2_bin = v2_dir / 'actuation'
        shutil.copyfile(actuation_executable, v2_bin)
        with v2_bin.open('ab') as handle:
            handle.write(b'\n')
        v2_bin.chmod(0o755)
        assert sha(v2_bin) != sha(actuation_executable)
        assert subprocess.run([str(v2_bin), '--version'], capture_output=True).returncode == 0

        composition = json.loads(original_composition)
        composition['modules']['actuation']['native_executable'] = str(v2_bin)
        composition_path.write_text(json.dumps(composition, indent=2) + '\n')

        newer = call(['suite', 'update', '--json'])
        assert newer.returncode == 0, newer.stderr
        after_update = active_receipt()
        assert after_update['receipt_ref'] != before_ref, 'a changed candidate must produce a new receipt'
        assert after_update['previous_receipt_ref'] == before_ref, 'the superseded receipt must be retained as the lineage previous'
        record['rollback_second_candidate'] = {'receipt_ref': after_update['receipt_ref'],
                                               'previous_ref': before_ref,
                                               'actuation_bytes_changed': True}

        rolled = call(['suite', 'rollback', '--json'])
        assert rolled.returncode == 0, rolled.stderr
        restored = active_receipt()
        assert restored['receipt_ref'] == before_ref, 'rollback must restore the previous coherent receipt'
        assert restored['products']['actuation']['sha256'] == original_actuation_sha256, \
            'rollback must restore the original product bytes, not the newer candidate'
        record['rollback'] = {'restored_ref': restored['receipt_ref'], 'actuation_restored': True}

        # restore the original composition so repair re-materialises the accepted candidate
        composition_path.write_text(original_composition)

        # repair on drift: corrupt the active receipt, then re-materialise.
        active_root = home / '.local/share/oi/suites' / before_ref
        staged_actuation = active_root / 'products' / 'actuation' / 'bin' / 'actuation'
        assert staged_actuation.is_file()
        with staged_actuation.open('ab') as handle:
            handle.write(b'# drift\n')
        drifted = call(['suite', 'status', '--json'])
        drifted_report = json.loads(drifted.stdout)
        assert drifted_report.get('active_ok') is False, 'corrupted receipt must be reported incoherent'
        assert drifted.returncode != 0, 'a drifted receipt must be reported with a non-zero status exit'
        repaired = call(['suite', 'repair', '--json'])
        assert repaired.returncode == 0, repaired.stderr
        repaired_ref = active_receipt()['receipt_ref']
        assert repaired_ref != before_ref, 'repair of a drifted receipt re-materialises a fresh receipt'
        record['repair_drift'] = {'drift_detected': True, 'repaired_ref': repaired_ref}

        record['status'] = 'passed'
        record['active_receipt_after'] = repaired_ref
        return 0
    except Exception as error:
        record['error'] = str(error)
        return 1
    finally:
        (out / 'suite-lifecycle.json').write_text(json.dumps(record, indent=2, sort_keys=True) + '\n')
        print(json.dumps({'status': record['status'], 'steps': len(record['steps']),
                          'error': record.get('error'), 'active_after': record.get('active_receipt_after')}))


if __name__ == '__main__':
    sys.exit(main())
