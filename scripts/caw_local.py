#!/usr/bin/env python3
"""Run the available native CAW campaigns independently and preserve all P01-P28.

No installation, network fetch, credentials inheritance or private Control writes.
Sources/binaries must already be built and explicitly bound. Child failure does
not suppress another available owner probe. Raw evidence is private by default.
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path
import subprocess
import sys
import uuid
import caw_campaign as c


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--bindings', type=Path)
    p.add_argument('--recipes', type=Path)
    p.add_argument('--case', action='append', default=[])
    p.add_argument('--output', type=Path, required=True)
    args = p.parse_args()
    cases = c.matrix()
    if set(args.case) - {case['id'] for case in cases}:
        raise c.Failure('unknown case selection')
    output = c.fresh_directory(args.output)
    bindings = args.bindings.resolve() if args.bindings else output / 'unbound.json'
    if not args.bindings:
        c.store(bindings, {})
    # Always use the actual sibling executables, not a configurable test runtime.
    invocations = []
    if not args.case or 'P01' in args.case:
        invocations.append(('profiles', 'caw_native_profiles.py', []))
    options = []
    if args.recipes:
        options.extend(['--recipes', str(args.recipes.resolve())])
    for case in args.case:
        options.extend(['--case', case])
    invocations.append(('native', 'caw_campaign.py', ['run', *options]))
    if not args.case or 'P26' in args.case:
        invocations.append(('tasks', 'caw_native_tasks.py', []))
    commands, observations, children = [], [], []
    for stage, script, options in invocations:
        argv = [sys.executable, str(c.ROOT / 'scripts' / script), *options,
                '--bindings', str(bindings), '--output', str(output / stage)]
        # Outer diagnostics remain private; all native process records are in
        # child reports. Child execution here is not itself counted as native C.
        with (output / f'{stage}.stdout').open('xb') as out, (output / f'{stage}.stderr').open('xb') as err:
            result = subprocess.run(argv, stdin=subprocess.DEVNULL, stdout=out, stderr=err, check=False)
        report_path = output / stage / 'report.json'
        if result.returncode not in (0, 1, 2) or not report_path.is_file():
            observations.append({'case': 'P01', 'standing': 'failed', 'detail': f'{stage}: campaign failed to produce evidence'})
            continue
        report = c.load(report_path)
        # Verify captured native outputs before admitting them to this run's
        # aggregate; nothing can enter through a user-supplied passed JSON.
        c.export_evidence(output / stage, output / f'{stage}-fingerprints.json')
        offset = len(commands)
        for old in report['commands']:
            record = dict(old)
            record['id'] += offset
            for channel in ('stdout', 'stderr'):
                record[channel] = {**old[channel], 'file': f"{stage}/{old[channel]['file']}"}
            commands.append(record)
        for old in report['observations']:
            observation = dict(old)
            if 'record_ids' in old:
                observation['record_ids'] = [i + offset for i in old['record_ids']]
            observations.append(observation)
        if result.returncode == 1 and not any(o.get('standing') == 'failed' for o in report['observations']):
            observations.append({'case': 'P01', 'standing': 'failed', 'detail': f'{stage}: nonzero failure without a graded failure record'})
        children.append({'stage': stage, 'exit': result.returncode, 'sha256': c.sha(report_path.read_bytes()),
                         'test_source_sha256': report['test_source_sha256']})
    acceptance = c.assess(cases, observations)
    c.store(output / 'report.json', {'schema': 'oi.caw-campaign-evidence/v1', 'run_id': str(uuid.uuid4()),
            'test_source_sha256': c.sha(Path(__file__).read_bytes()),
            'matrix_sha256': c.sha((c.SPEC / 'cases.json').read_bytes()),
            'children': children, 'commands': commands, 'observations': observations, 'acceptance': acceptance})
    print(json.dumps({'standing': acceptance['standing'], 'native_commands': len(commands),
                      'cases': len(cases), 'report': str(output / 'report.json'), 'whole_feature_verdict': None}))
    return 1 if acceptance['standing'] == 'failed' else 2 if acceptance['standing'] == 'pending' else 0


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except (c.Failure, OSError, ValueError, KeyError, subprocess.SubprocessError) as error:
        print(f'caw-local: {error}', file=sys.stderr)
        raise SystemExit(1)
