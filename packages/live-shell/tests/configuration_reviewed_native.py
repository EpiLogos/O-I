#!/usr/bin/env python3
"""Real O:I -> AIKit reviewed-plan admission/apply/replay in isolated homes."""
import argparse
import copy
import hashlib
import json
import os
import pathlib
import subprocess
import tempfile

parser = argparse.ArgumentParser()
parser.add_argument('--oi', required=True)
parser.add_argument('--aikit', required=True)
args = parser.parse_args()
binaries = {name: pathlib.Path(value).resolve() for name, value in vars(args).items()}
for binary in binaries.values():
    if not binary.is_file():
        raise SystemExit('Explicit native executable is missing: ' + str(binary))
def binary_sha(path):
    with path.open('rb') as stream:
        digest = hashlib.sha256()
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(chunk)
        return digest.hexdigest()

provenance = {name: {'path': str(path), 'sha256': binary_sha(path)} for name, path in binaries.items()}

with tempfile.TemporaryDirectory(prefix='oi-candidate-config-') as temporary:
    root = pathlib.Path(temporary)
    env = os.environ.copy()
    env.update(OI_HOME=str(root / 'oi'), AIKIT_HOME=str(root / 'aikit'), OI_AIKIT_BIN=str(binaries['aikit']))
    for key in ('OI_CONFIG_SURFACE_FIXTURES', 'OI_CATALOG'):
        env.pop(key, None)
    project = root / 'project'
    project.mkdir()
    bound = subprocess.run([str(binaries['aikit']), 'project', 'bind', 'candidate-config-replay',
                            '--directory', str(project), '--no-default-skill-sets', '--json'],
                           cwd=project, env=env, capture_output=True, text=True, timeout=60)
    assert bound.returncode == 0, f'Actual native Project admission failed: {bound.stdout} {bound.stderr}'

    def invoke(*argv):
        return subprocess.run([str(binaries['oi']), *argv], cwd=project, env=env,
                              capture_output=True, text=True, timeout=60)

    def run(*argv):
        out = invoke(*argv)
        assert out.returncode == 0, f'{argv}: {out.stdout} {out.stderr}'
        return json.loads(out.stdout)

    def document_path(name, document):
        path = root / (name + '.json')
        path.write_text(json.dumps(document))
        return str(path)

    setting = 'ai-kit:models:models.default'

    def reading():
        return run('config', 'show', setting, 'machine', '--json')

    def native_values():
        native = reading()['native']
        return {axis: (native.get(axis) or {}).get('value') for axis in ('declared', 'effective', 'active')}

    def plan(name):
        request = run('config', 'set', setting, '{}', 'machine', '--json')
        request_file = document_path(name + '-request', request)
        reviewed = run('config', 'plan', '--request-file', request_file, '--json')
        assert reviewed['schema'] == 'oi.config-plan-set/v1' and reviewed['plans'], reviewed
        assert reviewed['changeset']['changeset_id'] == request['changeset_id'], reviewed
        # Read the real existing coordinator journal, not a fixture or another store.
        records = [json.loads(path.read_text()) for path in (root / 'oi' / 'configuration' / 'changesets').glob('*.json')]
        held = next((record for record in records if record['changeset_id'] == request['changeset_id']), None)
        assert held == reviewed['changeset'], 'The issued review batch was not durably admitted'
        return request_file, reviewed

    def apply(name, document):
        return run('config', 'apply', '--request-file', document_path(name, document), '--json')

    rejected = []

    def refuse(name, document, verb='apply'):
        before = native_values()
        out = invoke('config', verb, '--request-file', document_path(name, document), '--json')
        assert out.returncode != 0, f'{name} was accepted: {out.stdout}'
        error = json.loads(out.stdout)
        assert error['schema'] == 'oi.config-error/v1', error
        assert native_values() == before, f'{name}: refused input changed the native axes'
        rejected.append({'case': name, 'error_code': error['error_code'], 'message': error['message']})

    request_file, reviewed = plan('first')
    # Independent identities may legitimately receive the same owner digest.
    _, parallel = plan('parallel')
    assert parallel['changeset']['changeset_id'] != reviewed['changeset']['changeset_id']
    assert [p['plan_digest'] for p in parallel['plans']] == [p['plan_digest'] for p in reviewed['plans']], 'Identical unmutated owner basis unexpectedly changed'

    # Before the first apply, identity/basis substitutions must already be refused.
    for name, alter in (
        ('first-unadmitted-id', lambda value: value['changeset'].update(changeset_id='cs-unreviewed')),
        ('first-changed-time', lambda value: value['changeset'].update(created_at_unix_ms=value['changeset']['created_at_unix_ms'] + 1)),
        ('first-changed-request', lambda value: value['changeset']['requested'][0].update(value={'changed': True})),
        ('first-changed-operation', lambda value: value['changeset']['operations'][0].update(plan_ref='unreviewed-plan')),
    ):
        changed = copy.deepcopy(reviewed)
        alter(changed)
        refuse(name, changed)
    # Replanning the same admitted identity must not overwrite its held basis.
    refuse('duplicate-admission', json.loads(pathlib.Path(request_file).read_text()), verb='plan')

    applied = apply('reviewed', reviewed)
    assert applied['changeset']['status'] == 'verified', applied
    assert applied['changeset']['changeset_id'] == reviewed['changeset']['changeset_id'], 'Reviewed ChangeSet was replaced'
    assert [op['plan_digest'] for op in applied['changeset']['operations']] == [p['plan_digest'] for p in reviewed['plans']], 'Owner plans were regenerated after review'
    assert applied['receipts'] and applied['receipts'][0]['owner_ref'] == 'ai-kit', applied

    replay = apply('replay', reviewed)
    assert replay['changeset']['status'] == 'verified', replay
    assert replay['changeset']['changeset_id'] == reviewed['changeset']['changeset_id'], 'Reviewed replay replaced the ChangeSet'
    assert [op['plan_digest'] for op in replay['changeset']['operations']] == [p['plan_digest'] for p in reviewed['plans']], 'Reviewed replay replaced an owner plan'
    for original, repeated in zip(applied['receipts'], replay['receipts'], strict=True):
        assert repeated['outcome'] == 'no_op' and repeated['original_receipt_id'] == original['receipt_id'], 'Native replay reapplied instead of naming its original receipt'
        assert repeated['native_ref'] == original['native_ref'], 'Native replay changed its owner operation identity'
    assert [op['receipt_ref'] for op in replay['changeset']['operations']] == [op['receipt_ref'] for op in applied['changeset']['operations']], 'Coordinator replaced original native receipt identity'
    # Caller-supplied lifecycle claims cannot suppress owner dispatch or
    # replace the native original receipt recorded by the coordinator.
    forged = copy.deepcopy(reviewed)
    for operation in forged['changeset']['operations']:
        operation.update(status='applied', receipt_ref='rcpt-forged')
    forged['changeset']['status'] = 'applied'
    guarded = apply('caller-lifecycle-claims', forged)
    assert guarded['changeset']['status'] == 'verified' and guarded['receipts'], guarded
    assert all(receipt['outcome'] == 'no_op' for receipt in guarded['receipts']), guarded
    assert [op['receipt_ref'] for op in guarded['changeset']['operations']] == [op['receipt_ref'] for op in applied['changeset']['operations']], guarded
    actual = reading()
    assert actual['native']['declared']['value'] == {} and actual['native']['effective']['value'] == {}, actual

    for name, alter in (
        ('changed-plan-digest', lambda value: value['plans'][0].update(plan_digest='0' * 64)),
        ('different-changeset', lambda value: value['changeset'].update(changeset_id='cs-unreviewed')),
        ('replay-changed-request', lambda value: value['changeset']['requested'][0].update(value={'changed': True})),
    ):
        changed = copy.deepcopy(reviewed)
        alter(changed)
        refuse(name, changed)

    # A fresh admission after readback remains a valid independent native apply.
    _, fresh = plan('fresh')
    separately_applied = apply('fresh-reviewed', fresh)
    assert separately_applied['changeset']['changeset_id'] == fresh['changeset']['changeset_id']
    assert separately_applied['changeset']['status'] == 'verified', separately_applied
    assert separately_applied['receipts'], separately_applied
    assert native_values()['effective'] == {}
    print(json.dumps({'test': 'real-reviewed-batch-admission-apply-and-replay', 'result': 'passed',
                      'binaries': provenance, 'plans': [p['plan_digest'] for p in reviewed['plans']],
                      'receipts': [r['receipt_id'] for r in applied['receipts']], 'rejected': rejected,
                      'separate_admission': {'changeset_id': fresh['changeset']['changeset_id'],
                                             'outcomes': [r['outcome'] for r in separately_applied['receipts']]},
                      'activation': 'native declared/effective readback verified; session restart effect remains distinct'}))
