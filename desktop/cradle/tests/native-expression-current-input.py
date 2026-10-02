#!/usr/bin/env python3
"""Current native scene -> actual host inspection -> re-admitted coupled input.

No domain computation, sky acquisition, simulated field or Central stub lives
here. Only the existing QL CLI, Rust host and C++ worker produce positive data.
The default is retained historical material, not a fresh sky or personal world.
Historical captures remain unchanged and are used solely as refusal evidence.
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import json
import math
import os
from pathlib import Path
import selectors
import signal
import struct
import subprocess
import sys
import time

MAX_JSON = 64 * 1024 * 1024
MAX_ERROR = 1024 * 1024
TIMEOUT = 45
PLANETS = ['Sun', 'Venus', 'Mercury', 'Moon', 'Saturn', 'Jupiter', 'Mars', 'Neptune', 'Pluto']


def require(condition, reason):
    if not condition:
        raise ValueError(reason)


def digest(path):
    with path.open('rb') as source:
        checksum = hashlib.sha256()
        for block in iter(lambda: source.read(1024 * 1024), b''):
            checksum.update(block)
    return checksum.hexdigest()


def parse(raw):
    require(len(raw) <= MAX_JSON, 'native JSON exceeds evidence bound')

    def unique(pairs):
        result = {}
        for key, value in pairs:
            require(key not in result, 'duplicate native JSON key: ' + key)
            result[key] = value
        return result

    def invalid(value):
        raise ValueError('nonfinite native JSON: ' + value)

    def finite(value):
        result = float(value)
        require(math.isfinite(result), 'overflowed native JSON number')
        return result

    return json.loads(raw, object_pairs_hook=unique, parse_constant=invalid, parse_float=finite)


def read_json(path):
    with path.open('rb') as source:
        raw = source.read(MAX_JSON + 1)
    return parse(raw)


def encoded(value):
    return (json.dumps(value, allow_nan=False, ensure_ascii=False, separators=(',', ':')) + '\n').encode()


def write(path, value):
    raw = encoded(value)
    require(len(raw) <= MAX_JSON, 'written native input exceeds evidence bound')
    with path.open('xb') as target:
        target.write(raw)
    path.chmod(0o600)


def same(actual, expected, path='$'):
    """Full tree equality, including float bits; JSON 1 and 1.0 share a value."""
    if type(actual) in (int, float) and type(expected) in (int, float):
        require(actual == expected, 'native numeric value differs at ' + path)
        if isinstance(actual, float) or isinstance(expected, float):
            require(struct.pack('!d', float(actual)) == struct.pack('!d', float(expected)),
                    'native binary64 value differs at ' + path)
    elif isinstance(actual, dict) and isinstance(expected, dict):
        require(actual.keys() == expected.keys(), 'native fields differ at ' + path)
        for key in expected:
            same(actual[key], expected[key], path + '.' + key)
    elif isinstance(actual, list) and isinstance(expected, list):
        require(len(actual) == len(expected), 'native array length differs at ' + path)
        for index, value in enumerate(expected):
            same(actual[index], value, path + '[' + str(index) + ']')
    else:
        require(type(actual) is type(expected) and actual == expected,
                'native value/type differs at ' + path)


def git(source, *arguments):
    result = subprocess.run(['git', '-C', str(source), *arguments], capture_output=True,
                            timeout=15, check=True)
    require(len(result.stdout) <= MAX_ERROR, 'source qualification output exceeds bound')
    return result.stdout.decode().strip()


class NativeProcess:
    """Bounded native stdio; cleanup only the newly owned process group."""
    def __init__(self, argv, stem, operations):
        self.argv = [str(value) for value in argv]
        self.stem = stem
        self.operations = operations
        self.stdout = bytearray()
        self.stderr = bytearray()
        self.pending = bytearray()
        self.started = time.monotonic()
        self.process = subprocess.Popen(self.argv, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                        stderr=subprocess.PIPE, start_new_session=True, bufsize=0)
        self.selector = selectors.DefaultSelector()
        self.selector.register(self.process.stdout, selectors.EVENT_READ, 'stdout')
        self.selector.register(self.process.stderr, selectors.EVENT_READ, 'stderr')
        self.requests = []
        self.closed = False

    def pump(self, deadline):
        remaining = deadline - time.monotonic()
        require(remaining > 0, 'native acknowledgement/exit timeout')
        events = self.selector.select(min(remaining, 1))
        for key, _ in events:
            data = os.read(key.fileobj.fileno(), 65536)
            if not data:
                self.selector.unregister(key.fileobj)
                continue
            if key.data == 'stdout':
                self.stdout.extend(data)
                self.pending.extend(data)
                require(len(self.stdout) <= 4 * MAX_JSON, 'native transcript exceeds bound')
                require(len(self.pending) <= MAX_JSON, 'native reply exceeds bound')
            else:
                self.stderr.extend(data)
                require(len(self.stderr) <= MAX_ERROR, 'native stderr exceeds bound')

    def receive(self):
        deadline = time.monotonic() + TIMEOUT
        while b'\n' not in self.pending:
            require(bool(self.selector.get_map()), 'native owner exited before acknowledgement')
            self.pump(deadline)
        raw, _, suffix = self.pending.partition(b'\n')
        self.pending = bytearray(suffix)
        return parse(raw)

    def exchange(self, last, command):
        sequence = last['last_request_id']
        require(isinstance(sequence, str) and sequence == str(int(sequence)), 'noncanonical request cursor')
        request = {'schema': 'ql.field-host-request/v1', 'instance_ref': last['instance_ref'],
                   'event_ref': last['field']['event_ref'], 'subject_ref': last['field']['subject_ref'],
                   'request_id': str(int(sequence) + 1),
                   'expected_generation': last['field']['generation'],
                   'expected_samples_elapsed': last['field']['samples_elapsed'], 'command': command}
        self.requests.append(request)
        raw = encoded(request)
        require(len(raw) <= 32 * 1024 * 1024, 'native request exceeds host bound')
        self.process.stdin.write(raw)
        self.process.stdin.flush()
        response = self.receive()
        require(response.get('schema') == 'ql.field-host-receipt/v1'
                and response.get('status') == 'ok' and response.get('available') is True,
                'native command did not acknowledge: ' + str(response.get('error')))
        for key in ('instance_ref', 'request_id'):
            require(response[key] == request[key], 'foreign native ' + key)
        require(response['last_request_id'] == request['request_id'], 'native sequence did not acknowledge')
        require(response['field']['event_ref'] == request['event_ref']
                and response['field']['subject_ref'] == request['subject_ref'], 'foreign native basis')
        return response

    def finish(self):
        if self.closed:
            return self.process.returncode
        try:
            self.process.stdin.close()
            deadline = time.monotonic() + 10
            while self.selector.get_map():
                self.pump(deadline)
            self.process.wait(timeout=max(0.1, deadline - time.monotonic()))
            return self.process.returncode
        finally:
            self.close()

    def close(self):
        if self.closed:
            return
        cleanup_error = None
        previous = {sig: signal.getsignal(sig) for sig in (signal.SIGINT, signal.SIGTERM)}
        try:
            # A second interruption must not prevent this owned group's reap.
            for sig in previous:
                signal.signal(sig, signal.SIG_IGN)
            # The child and its worker share this newly created, dedicated group.
            # Also reap a leftover worker if its host exited unexpectedly.
            try:
                os.killpg(self.process.pid, 0)
            except ProcessLookupError:
                pass
            else:
                try:
                    os.killpg(self.process.pid, signal.SIGTERM)
                except ProcessLookupError:
                    pass
                try:
                    self.process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    try:
                        os.killpg(self.process.pid, signal.SIGKILL)
                    except ProcessLookupError:
                        pass
                    self.process.wait(timeout=5)
                deadline = time.monotonic() + 5
                while True:
                    try:
                        os.killpg(self.process.pid, 0)
                    except ProcessLookupError:
                        break
                    if time.monotonic() >= deadline:
                        try:
                            os.killpg(self.process.pid, signal.SIGKILL)
                        except ProcessLookupError:
                            break
                        cleanup_error = 'native process group remained after host exit'
                        break
                    time.sleep(0.02)
            self.process.wait(timeout=5)
        finally:
            self.closed = True
            self.selector.close()
            for stream in (self.process.stdin, self.process.stdout, self.process.stderr):
                if not stream.closed:
                    stream.close()
            self.stem.with_suffix('.stdout.jsonl').write_bytes(self.stdout)
            self.stem.with_suffix('.stderr.txt').write_bytes(self.stderr)
            write(self.stem.with_suffix('.requests.json'), self.requests)
            self.operations.append({'argv': self.argv, 'pid': self.process.pid,
                                    'returncode': self.process.returncode,
                                    'elapsed_seconds': time.monotonic() - self.started,
                                    'host_reaped': self.process.poll() is not None,
                                    'cleanup_error': cleanup_error,
                                    'stdout_sha256': hashlib.sha256(self.stdout).hexdigest(),
                                    'stderr_sha256': hashlib.sha256(self.stderr).hexdigest()})
            for sig, handler in previous.items():
                signal.signal(sig, handler)
        require(cleanup_error is None, cleanup_error)


def ready(process, instance):
    value = process.receive()
    require(value.get('schema') == 'ql.field-host-receipt/v1' and value.get('status') == 'ready'
            and value.get('available') is True and value.get('instance_ref') == instance,
            'native host did not admit the exact instance')
    require(value['last_request_id'] == '0' and value['request_id'] is None,
            'initial native sequence is not ready')
    require(value['field']['schema'] == 'ql.continuous-field/v1' and value['field']['audio'] == [],
            'ready receipt is not the acknowledged continuous field')
    return value


def refuse(args, config, name, error, operations):
    path = args.output / (name + '.config.json')
    write(path, config)
    process = NativeProcess([args.host, args.worker, path], args.output / name, operations)
    try:
        code = process.finish()
        require(code != 0, name + ': native owner unexpectedly admitted negative input')
        require(not process.stdout.strip(), name + ': negative emitted a ready/partial field')
        require(error in process.stderr.decode(), name + ': failed for the wrong native reason')
    finally:
        process.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--ql-source', type=Path, required=True)
    parser.add_argument('--expected-ql-head', required=True)
    for name in ('ql', 'host', 'worker', 'historical-input'):
        parser.add_argument('--' + name, type=Path, required=True)
    parser.add_argument('--expected-historical-sha256', required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    require(args.output.is_absolute(), 'explicit absolute output required')
    args.output.mkdir(parents=True, exist_ok=False, mode=0o700)
    report = {'schema': 'oi.native-expression-current-input/v1', 'pass': False,
              'standing': 'existing native scene/host/C++ input admission and effects; retained historical sky; '
                          'no Central root, personal world, rendered consumer, installed app or listening proof',
              'checks': [], 'operations': [], 'sources': {},
              'claims': {'fresh_sky': False, 'private_person': False, 'installed_app': False,
                         'webgl': False, 'audible_device': False, 'human_acceptance': False}}
    immutable = {}
    old_handlers = {sig: signal.getsignal(sig) for sig in (signal.SIGINT, signal.SIGTERM)}

    def interrupted(signum, _frame):
        raise KeyboardInterrupt('Native input qualification interrupted by signal ' + str(signum))

    try:
        for sig in old_handlers:
            signal.signal(sig, interrupted)
        require(args.ql_source.is_absolute(), 'explicit absolute QL source required')
        require(git(args.ql_source, 'rev-parse', 'HEAD') == args.expected_ql_head, 'different native source cut')
        require(not git(args.ql_source, 'status', '--porcelain', '--untracked-files=no'), 'dirty native source cut')
        report['ql_source_head'] = args.expected_ql_head
        default = args.ql_source / 'fixtures/kernel/scene-default-event-v2.json'
        for name in ('ql', 'host', 'worker', 'historical_input'):
            path = getattr(args, name)
            require(path.is_absolute() and path.is_file() and not path.is_symlink(),
                    name + ': explicit regular file required')
            if name != 'historical_input':
                require(os.access(path, os.X_OK), name + ': actual native executable required')
            immutable[name] = path
        immutable['current_default'] = default
        immutable['helper'] = Path(__file__).resolve()
        for name, path in immutable.items():
            report['sources'][name] = {'path': str(path), 'sha256': digest(path)}
        require(report['sources']['historical_input']['sha256'] == args.expected_historical_sha256,
                'historical capture changed; no restamp accepted')
        historical = read_json(args.historical_input)
        seed = read_json(default)
        registry = seed['m2']['registry_revision']
        require(seed['m3']['registry_revision'] == registry, 'current default registries differ')
        require(historical['basis']['m2']['registry_revision'] != registry, 'historical negative is not stale')
        sky = [item for item in seed['source_receipts'] if item.get('schema') == 'ql.sky-snapshot/v1']
        require(len(sky) == 1 and sky[0]['request']['mode'] == 'historical'
                and sky[0]['source_binding']['registry_revision'] == registry,
                'current default is not qualified retained historical material')
        report['basis'] = {'registry_revision': registry, 'sky_ref': sky[0]['snapshot_ref'],
                           'sky_epoch': sky[0]['epoch_utc'], 'sky_mode': 'historical',
                           'subject_ref': seed['m3']['subject_ref'], 'event_ref': seed['m1']['event_ref']}
        request = {'schema': 'ql.scene-binding-request/v1', 'instance_ref': 'controlled:oi-ci-current-source',
                   'texture': [16, 16], 'units_per_metre': 400}
        request_path = args.output / 'scene.request.json'
        write(request_path, request)
        cli = NativeProcess([args.ql, 'scene', 'binding', request_path, '--json'],
                            args.output / 'native-binding', report['operations'])
        try:
            require(cli.finish() == 0, 'actual QL scene producer refused current default')
            binding = parse(cli.stdout)
        finally:
            cli.close()
        require(set(binding) == {'schema', 'host', 'scene', 'native_basis', 'native_readback', 'presentation'}
                and binding['schema'] == 'oi.native-expression-binding/v1', 'incomplete qualified native binding')
        same(binding['host']['basis'], seed)
        same(binding['native_basis']['input']['source_receipts'], seed['source_receipts'])
        require(binding['scene']['snapshot_ref'] == sky[0]['snapshot_ref'], 'native scene lost retained sky')
        voice_basis = binding['native_basis']['derivation']['sky_voices']
        require([voice['planet_ref'] for voice in voice_basis] == PLANETS, 'native nine-voice route differs')
        scene_config = args.output / 'scene.host.json'
        write(scene_config, binding['host'])
        scene = NativeProcess([args.host, args.worker, scene_config],
                              args.output / 'scene-owner', report['operations'])
        try:
            initial = ready(scene, request['instance_ref'])
            inspection = scene.exchange(initial, {'operation': 'inspect'})
            same(inspection['field'], initial['field'])
            same(inspection['sources']['original'], binding['native_basis'])
            same(inspection['sources']['current'], binding['native_basis'])
            candidate = {'basis': inspection['sources']['original']['input'],
                         'field': inspection['sources']['original_field']}
            require(candidate['field']['subject_ref'] == seed['m3']['subject_ref']
                    and initial['field']['subject_ref'] == seed['m3']['subject_ref']
                    and initial['field']['event_ref'] == seed['m1']['event_ref'], 'native subject/event changed')
            require(len(candidate['field']['audio_gains']) == 9 and len(candidate['field']['samples']) > 0
                    and all(len(sample['mode_shapes']) == 9 for sample in candidate['field']['samples']),
                    'native receiving field dropped required modes or geometry')
            require(candidate['basis']['m2']['registry_revision'] == registry
                    and candidate['basis']['m3']['registry_revision'] == registry, 'native completion is stale')
            write(args.output / 'candidate-input.json', candidate)
            require(scene.finish() == 0, 'scene owner did not close cleanly')
        finally:
            scene.close()
        report['checks'].append('actual scene constructor and host/C++ admission retain exact native basis, nine modes and geometry')
        generic = dict(candidate, instance_ref='controlled:oi-ci-readmitted')
        generic_path = args.output / 'generic.host.json'
        write(generic_path, generic)
        host = NativeProcess([args.host, args.worker, generic_path],
                             args.output / 'generic-owner', report['operations'])
        try:
            admitted = ready(host, generic['instance_ref'])
            same(admitted['field'], initial['field'])
            inspected = host.exchange(admitted, {'operation': 'inspect'})
            same(inspected['sources']['original'], binding['native_basis'])
            same(inspected['sources']['current'], binding['native_basis'])
            same(inspected['sources']['original_field'], candidate['field'])
            same(inspected['field'], admitted['field'])
            read = host.exchange(inspected, {'operation': 'read'})
            same(read['field'], admitted['field'])
            advanced = host.exchange(read, {'operation': 'advance', 'frames': 512, 'muted': False})
            require(len(advanced['field']['audio']) == 512
                    and any(abs(value) > 1e-7 for value in advanced['field']['audio']), 'native PCM stayed silent')
            require(advanced['field']['targets'] != admitted['field']['targets'], 'native targets did not change')
            require(int(advanced['field']['samples_elapsed']) == int(admitted['field']['samples_elapsed']) + 512,
                    'native advance used a different sample cursor')
            require(host.finish() == 0, 're-admitted owner did not close cleanly')
        finally:
            host.close()
        report['checks'].append('generic re-admission reproduces full original initial field/basis; read is invariant; native PCM and targets respond')
        refuse(args, dict(historical, instance_ref='controlled:oi-ci-historical-refusal'),
               'historical-capture-refusal', 'unsupported M2 request or stale registry revision', report['operations'])
        stale_m2 = copy.deepcopy(generic)
        stale_m2['basis']['m2']['registry_revision'] = historical['basis']['m2']['registry_revision']
        require(stale_m2['basis']['m2']['registry_revision'] != registry
                and stale_m2['basis']['m3']['registry_revision'] == registry,
                'current M2 negative is not independently stale')
        restored_m2 = copy.deepcopy(stale_m2)
        restored_m2['basis']['m2']['registry_revision'] = registry
        same(restored_m2, generic)
        refuse(args, stale_m2, 'current-stale-m2', 'unsupported M2 request or stale registry revision',
               report['operations'])
        stale_m3 = copy.deepcopy(generic)
        stale_m3['basis']['m3']['registry_revision'] = historical['basis']['m3']['registry_revision']
        require(stale_m3['basis']['m3']['registry_revision'] != registry, 'historical M3 negative is not stale')
        refuse(args, stale_m3, 'stale-m3', 'M3 contract or registry mismatch', report['operations'])
        foreign = copy.deepcopy(generic)
        foreign['field']['subject_ref'] = 'controlled:foreign-ci-subject'
        require(foreign['field']['subject_ref'] != generic['field']['subject_ref'], 'foreign subject is not distinct')
        refuse(args, foreign, 'foreign-subject', 'field and M3 must retain the same subject', report['operations'])
        report['checks'].append('unchanged historical capture, independently stale current M2, stale current M3 and foreign subject refuse without partial field')
        for name, path in immutable.items():
            require(digest(path) == report['sources'][name]['sha256'], name + ': changed during admission')
        require(git(args.ql_source, 'rev-parse', 'HEAD') == args.expected_ql_head
                and not git(args.ql_source, 'status', '--porcelain', '--untracked-files=no'),
                'native source changed during admission')
        # Only the fully passed artifact becomes the input used by later gates.
        write(args.output / 'input.json', candidate)
        report['input'] = {'path': str(args.output / 'input.json'), 'sha256': digest(args.output / 'input.json'),
                           'origin': 'actual native Inspect original.input and original_field, re-admitted unchanged'}
        report['pass'] = True
        return 0
    except (Exception, KeyboardInterrupt) as error:
        report['failure'] = str(error)
        print(str(error), file=sys.stderr)
        return 1
    finally:
        for sig, handler in old_handlers.items():
            signal.signal(sig, handler)
        write(args.output / 'receipt.json', report)


if __name__ == '__main__':
    sys.exit(main())
