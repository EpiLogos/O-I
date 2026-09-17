#!/usr/bin/env python3
"""Run the maintained owner-native task suite through the existing CAW recorder.

The Rust suite invokes actual Central/Actuation/AIKit/Workcell public operations.
This driver supplies no runtime semantics, material receipts or success fixtures.
A second invocation removes the actual Workcell service executable; it must fail.
Only the bounded task/material obligation receives D/C. P01-P28 remain binding.
"""
from __future__ import annotations
import argparse
import json
import os
from pathlib import Path
import re
import shutil
import sys
import uuid
import caw_campaign as c

TESTS = {
    'real_task_dispatch_confines_protocol_and_rechecks_source_without_duplicate_work',
    'wrong_actual_cwd_and_removed_now_cannot_launch_a_provider',
    'missing_task_authority_refuses_before_now_allocation',
    'material::persistent_storage_reentry_and_release_govern_real_turns_without_duplicate_work',
    'material::workcell_really_hosts_the_native_encounter_owner_and_its_protected_response',
    'material::absent_attachment_foreign_host_and_dropped_requirement_cannot_start_work',
    'material::a_healthy_unrelated_process_cannot_satisfy_encounter_hosting',
}
DISCONNECTED_TEST = 'material::workcell_really_hosts_the_native_encounter_owner_and_its_protected_response'
MARKERS = {
    'TASK_NATIVE_PROTECTED_DISPATCH_EXECUTED',
    'TASK_NATIVE_PERSISTENT_STORAGE_EXECUTED',
    'TASK_NATIVE_WORKCELL_HOSTED_ENCOUNTER_EXECUTED',
}
OWNER_KEYS = {
    'central': 'central', 'aikit': 'aikit', 'aikit-session-space': 'aikit',
    'aikit-task-suite': 'aikit', 'workcell': 'workcell',
    'workcell-control-service': 'workcell', 'workcell-write-boundary': 'workcell',
    'actuation': 'actuation',
}
ENV_KEYS = {
    'central': 'AIKIT_CAW_CTRL_BIN',
    'workcell': 'AIKIT_CAW_WORKCELL_BIN',
    'workcell-control-service': 'AIKIT_CAW_WORKCELL_SERVICE_BIN',
    'workcell-write-boundary': 'AIKIT_CAW_WORKCELL_BOUNDARY_BIN',
    'actuation': 'AIKIT_CAW_ACTUATION_BIN',
}
OBLIGATION = 'native-material-task-public-operation-chain'


def summary(data: bytes) -> tuple[int, int, int, int, int]:
    text = data.decode('utf-8', 'strict')
    rows = re.findall(r'test result: (?:ok|FAILED)\. (\d+) passed; (\d+) failed; (\d+) ignored; (\d+) measured; (\d+) filtered out;', text)
    if len(rows) != 1:
        raise c.Failure('native test executable omitted one unambiguous executed-test summary')
    return tuple(map(int, rows[0]))


def check_connected(code: int, data: bytes) -> None:
    if code != 0 or summary(data) != (len(TESTS), 0, 0, 0, 0):
        raise c.Failure('the full pinned native task suite did not execute successfully; skipped tests are not proof')
    text = data.decode('utf-8', 'strict')
    if not all(marker in text for marker in MARKERS):
        raise c.Failure('actual protected dispatch, persistent storage or hosted encounter witness is absent')


def check_disconnected(code: int, data: bytes) -> None:
    if code == 0 or summary(data) != (0, 1, 0, 0, len(TESTS) - 1):
        raise c.Failure('removing the native material producer did not fail its exact public-operation path')
    if 'TASK_NATIVE_WORKCELL_HOSTED_ENCOUNTER_EXECUTED' in data.decode('utf-8', 'strict'):
        raise c.Failure('disconnected native host still claimed a completed hosted encounter')


def prove(recorder: c.Recorder) -> list[dict]:
    c.governance()
    suite_binding = recorder.binaries.get('aikit-task-suite')
    if not suite_binding or not Path(suite_binding.get('path', '')).is_file():
        # The maintained seven-case suite and its encounter-task CLI surface
        # ride the unmerged ai-kit candidate branch, not the accepted cut.
        # A missing producer is not a disproven behaviour: P26 stays pending
        # and the joined task/material chain awaits the suite's transfer.
        raise c.Pending('maintained seven-case native task suite is absent from the accepted ai-kit cut; '
                        'the joined task/material chain awaits its transfer')
    cut = c.load(c.SPEC / 'sources/lock.json')['controlled_native_cut']
    paths = {}
    for owner, key in OWNER_KEYS.items():
        paths[owner] = recorder.bind(owner)
        if recorder.sources[owner]['revision'] != cut.get(key):
            raise c.Failure(f'{owner}: native source is not the maintained joined candidate cut')
    for owner in ('aikit', 'aikit-session-space'):
        if recorder.sources[owner] != recorder.sources['aikit-task-suite']:
            raise c.Failure('the compiled suite and actual session/product binaries have different source bases')
    # env! CARGO_BIN_EXE in the source-built suite names this actual product.
    # The standard Cargo build placement is checked, rather than trusting an
    # unrelated binary bound beside a clean checkout.
    source = Path(recorder.binaries['aikit-task-suite']['source']).resolve()
    target = source / 'target/debug'
    if paths['aikit-session-space'].resolve() != target / 'aikit-session-space' or paths['aikit-task-suite'].resolve().parent != target / 'deps':
        raise c.Failure('bind the native suite and session binary built together in this exact checkout; relocated compiler paths are not assumed')
    home = c.fresh_directory(recorder.output / 'isolated-home')
    node = shutil.which('node')
    env = {'HOME': str(home), 'XDG_CONFIG_HOME': str(home / '.config'),
           'XDG_DATA_HOME': str(home / '.local/share'), 'XDG_STATE_HOME': str(home / '.local/state'),
           'PATH': os.pathsep.join(([str(Path(node).parent)] if node else []) + ['/usr/bin', '/bin']),
           'LANG': 'C.UTF-8', 'TZ': 'UTC', 'RUST_BACKTRACE': '0'}
    for owner, key in ENV_KEYS.items():
        env[key] = str(paths[owner])
    first = len(recorder.records)
    code, data = recorder.execute('aikit-task-suite', ['--list'], source, env, 'task-suite-exact-inventory')
    listed = {line.removesuffix(': test') for line in data.decode('utf-8', 'strict').splitlines() if line.endswith(': test')}
    if code != 0 or listed != TESTS:
        raise c.Failure('bound native executable is not the complete maintained seven-case task suite')
    code, data = recorder.execute('aikit-task-suite', ['--ignored', '--nocapture', '--test-threads=1'], source, env, 'joined-native-task-material-connected')
    check_connected(code, data)
    # A new native test invocation constructs its own fresh disposable World.
    # The only changed binding is the actual absent native service producer.
    absent = recorder.output / 'deliberately-absent-workcell-service'
    if absent.exists():
        raise c.Failure('disconnection path unexpectedly exists')
    broken = dict(env, AIKIT_CAW_WORKCELL_SERVICE_BIN=str(absent))
    code, data = recorder.execute('aikit-task-suite', [DISCONNECTED_TEST, '--exact', '--ignored', '--nocapture', '--test-threads=1'], source, broken, 'joined-native-task-material-removed-producer')
    check_disconnected(code, data)
    for owner in OWNER_KEYS:
        recorder.bind(owner)  # No changed executable/source is repinned after execution.
    return [{'id': 'native-task-material', 'case': 'P26', 'obligation': OBLIGATION,
             'standing': 'observed', 'grade': grade, 'disconnected': 'detected',
             'scope': 'controlled-owner-native-task-suite-not-installed-or-model-proof',
             'executed_tests': len(TESTS), 'record_ids': list(range(first, len(recorder.records)))}
            for grade in ('D', 'C')]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--bindings', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    output = c.fresh_directory(args.output)
    recorder = c.Recorder(output, c.load(args.bindings), timeout=300)
    try:
        observations = prove(recorder)
    except (c.Pending, c.Failure, OSError, ValueError, KeyError) as error:
        observations = [{'id': 'native-task-material', 'case': 'P26', 'obligation': OBLIGATION,
                         'standing': 'pending' if isinstance(error, c.Pending) else 'failed', 'detail': str(error)}]
    acceptance = c.assess(c.matrix(), observations)
    c.store(output / 'report.json', {'schema': 'oi.caw-campaign-evidence/v1', 'run_id': str(uuid.uuid4()),
            'test_source_sha256': c.sha(Path(__file__).read_bytes()),
            'matrix_sha256': c.sha((c.SPEC / 'cases.json').read_bytes()),
            'commands': recorder.records, 'observations': observations, 'acceptance': acceptance,
            'native_basis': {owner: {'source': recorder.sources[owner], 'executable_sha256': recorder.pins[owner]} for owner in recorder.sources}})
    print(json.dumps({'standing': acceptance['standing'], 'observations': observations, 'report': str(output / 'report.json')}))
    return 1 if acceptance['standing'] == 'failed' else 2


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except (c.Failure, OSError, ValueError, KeyError) as error:
        print(f'caw-native-tasks: {error}', file=sys.stderr)
        raise SystemExit(1)
