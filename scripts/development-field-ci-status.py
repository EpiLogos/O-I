#!/usr/bin/env python3
"""Explain workflow failures and blocked dependencies; never award product proof."""
import argparse
import json
import os
from pathlib import Path

DEPENDENCIES = {
    'prepare': (),
    'source_snapshot': ('prepare',),
    'probe': ('prepare',),
    'dispatch': ('prepare',),
    's3': ('probe', 'dispatch'),
    'activation': ('dispatch',),
    'lifecycle': ('activation',),
    'bridges': ('dispatch',),
    'whole_gate': ('prepare',),
}


def classify(steps):
    rows = []
    for name, dependencies in DEPENDENCIES.items():
        outcome = steps.get(name, {}).get('outcome', 'not-recorded')
        blockers = [dep for dep in dependencies if steps.get(dep, {}).get('outcome') != 'success']
        if outcome in ('success', 'failure', 'cancelled'):
            standing = {'success': 'passed', 'failure': 'failed', 'cancelled': 'cancelled'}[outcome]
        elif blockers:
            standing = 'blocked'
        else:
            standing = 'not-executed'
        rows.append({'step': name, 'outcome': outcome, 'standing': standing, 'blocked_by': blockers})
    return {
        'schema': 'oi.ci-stage-diagnostics/v1',
        'standing': 'workflow-diagnostics-only',
        'primary_failures': [row['step'] for row in rows if row['standing'] == 'failed' and row['step'] != 'whole_gate'],
        'blocked_steps': [row['step'] for row in rows if row['standing'] == 'blocked'],
        'steps': rows,
        'acceptance': 'Only native proof receipts and the unchanged whole gate establish conformance. Skipped is not passed.',
    }


def markdown(report):
    lines = ['## Development Field execution', '',
             'Failed operations and blocked dependent proof are separate. Skipped proof is not accepted.', '',
             '| Step | Standing | Blocked by |', '|---|---|---|']
    lines.extend('| {step} | {standing} | {blockers} |'.format(
        **row, blockers=', '.join(row['blocked_by']) or '—') for row in report['steps'])
    return '\n'.join(lines) + '\n'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', required=True, type=Path)
    args = parser.parse_args()
    steps = json.loads(os.environ['DF_STEPS_JSON'])
    if not isinstance(steps, dict):
        raise ValueError('workflow steps must be an object')
    report = classify(steps)
    args.out.mkdir(parents=True, exist_ok=True)
    (args.out / 'ci-stages.json').write_text(json.dumps(report, indent=2) + '\n')
    print(markdown(report))
    if os.environ.get('GITHUB_STEP_SUMMARY'):
        with open(os.environ['GITHUB_STEP_SUMMARY'], 'a') as handle:
            handle.write(markdown(report))


if __name__ == '__main__':
    main()
