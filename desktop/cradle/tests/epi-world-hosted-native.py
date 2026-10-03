#!/usr/bin/env python3
"""One source-built hosted Epi encounter, then an owned-kernel/fresh-browser restart.

Consumes exact historical controlled material through native file admission.
All calculations, saves and receiving assertions remain with their existing
native owners and production browser driver. This is not a managed Mac install,
hardware GPU, physical audio, model answer, H or Recognition acceptance.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import platform
import re
import select
import shutil
import signal
import stat
import subprocess
import sys
import tarfile
import threading
import time
import urllib.error
import urllib.request

MAX_JSON = 24 * 1024 * 1024
MAX_PACKAGE = 64 * 1024 * 1024
ROLES = ('ql', 'ql-field-host', 'ql-field-worker', 'ql-focused-host', 'ql-sky')
PERSONS = ('person:controlled-world-a', 'person:controlled-world-b')
D30_TEMPLATE_PATH = 'desktop/cradle/tests/fixtures/epi-world-hosted/expectation-template-d30-6a81fc44.json'
D30_TEMPLATE_SHA256 = 'd16c3ee6f757cff878939c2c5cd768a8412c20ae6e43b59cfe87364b2dad3c60'
D30_SUCCESSION_SHA256 = '2c36eb34c388903d7d6dd97c3a36f2b399c164d0974680f09bfe9d0958fabd8f'
LOCUS = 'ql:m-coordinate:bimba:M4.4.4.4'
OI_SCOPE = [
    'desktop/cradle/tests/epi-selected-conversation-native.mjs',
    'desktop/cradle/tests/epi-first-rest-receiving.mjs',
    'desktop/cradle/tests/epi-world-production-native.mjs',
    'desktop/cradle/tests/epi-saved-identity-use-refusals.mjs',
    'desktop/cradle/tests/epi-personal-native-proof.mjs',
    'desktop/cradle/tests/epi-scene-damping-native-proof.mjs',
    'desktop/cradle/tests/epi-scene-axis-native-proof.mjs',
    'desktop/cradle/tests/epi-world-portable-custody.mjs',
    'desktop/cradle/tests/build-portable-expectation.mjs',
    D30_TEMPLATE_PATH,
    'desktop/cradle/tests/fixtures/epi-world-hosted/source-succession-d30-6a81fc44.json',
    'desktop/cradle/tests/epi-world-hosted-native.py',
    'desktop/cradle/tests/current-manifest-artifact-guards.mjs',
    'desktop/cradle/expressions-app/field-studies-journeys/src/app.ts',
    'desktop/cradle/expressions-app/field-studies-journeys/src/epiWorldProduction.ts',
    'desktop/cradle/expressions-app/field-studies-journeys/src/epiWorldMaterial.ts',
    'desktop/cradle/expressions-app/field-studies-journeys/src/nativeWorkspace.ts',
    'desktop/cradle/src/expressions/hostedApp.ts',
    'desktop/cradle/src/expressions/naraChannel.ts',
    'desktop/cradle/src/expressions/nativeChannel.ts',
    'desktop/cradle/kernel/src/native_expression.rs',
    'desktop/cradle/kernel/src/expression.rs',
    'desktop/cradle/kernel/src/expression_file.rs',
    'desktop/cradle/kernel/src/expression_recovery.rs',
    'desktop/cradle/kernel/src/nara_identity.rs',
    'desktop/cradle/kernel/src/nara_current.rs',
    'desktop/cradle/kernel/src/lib.rs',
    'desktop/cradle/kernel/src/nara_current_store.rs',
    'desktop/cradle/kernel/src/m3_reception.rs',
    'desktop/cradle/kernel/src/nara_dialogue.rs',
    'desktop/cradle/src/nara/nativeCurrent.ts',
    'desktop/cradle/src/nara/instrumentProtocol.ts',
    'desktop/cradle/expressions-app/field-studies-journeys/src/naraInstrument.tsx',
    'desktop/cradle/kernel/src/bin/walk-bridge.rs',
]


def require(condition, message):
    if not condition:
        raise AssertionError(message)


def parse(raw):
    def unique(pairs):
        result = {}
        for key, value in pairs:
            require(key not in result, 'Duplicate JSON field: ' + key)
            result[key] = value
        return result
    return json.loads(raw, object_pairs_hook=unique,
                      parse_constant=lambda text: (_ for _ in ()).throw(ValueError(text)))


def read_json(path, limit=MAX_JSON):
    path = Path(path)
    require(path.is_file() and not path.is_symlink(), 'Expected regular JSON: ' + str(path))
    with path.open('rb') as stream:
        raw = stream.read(limit + 1)
    require(len(raw) <= limit, 'JSON exceeds evidence bound: ' + str(path))
    return parse(raw)


def file_ref(path, proc_image=False):
    path = Path(path)
    require(path.is_file() and (proc_image or not path.is_symlink()), 'Expected regular file: ' + str(path))
    digest, size = hashlib.sha256(), 0
    with path.open('rb') as stream:
        while block := stream.read(1024 * 1024):
            digest.update(block)
            size += len(block)
    return {'path': str(path.absolute()), 'bytes': size, 'sha256': digest.hexdigest()}


def save(path, value):
    Path(path).write_text(json.dumps(value, indent=2, allow_nan=False) + '\n')


def proc_stat(pid):
    try:
        raw = Path(f'/proc/{pid}/stat').read_text()
        tail = raw.rsplit(')', 1)[1].split()
        return {'pid': int(pid), 'ppid': int(tail[1]), 'starttime': int(tail[19]), 'state': tail[0]}
    except (FileNotFoundError, ProcessLookupError, PermissionError, ValueError, IndexError):
        return None


class OwnedProcesses:
    """Observe only descendants of processes this run started; PID reuse fenced.

    Native hosts create their own process groups. Descendant/starttime custody
    is therefore needed beyond the bridge's process group for exact cleanup.
    No global process-name kill and no ambient process arguments are recorded.
    """
    def __init__(self, output):
        self.output = output
        self.roots, self.known, self.rows, self.errors = {}, {}, {}, []
        self.completed_short_commands = []
        self.image_cache = {}
        self.lock = threading.RLock()
        self.quit = threading.Event()
        self.phase = 'build'
        self.expected = {}
        self.monitor = threading.Thread(target=self.loop, daemon=True)
        self.monitor.start()

    def add(self, process, label, allow_completed=False):
        value = proc_stat(process.pid)
        if value is None:
            status = process.poll()
            require(allow_completed and status is not None, 'Owned live process disappeared before registration: ' + label)
            with self.lock:
                require(len(self.completed_short_commands) < 512, 'Completed command evidence bound exceeded')
                self.completed_short_commands.append({'pid': process.pid, 'label': label, 'exit': status,
                    'standing': 'Actual already completed non-bridge command; stdout/stderr/exit retained separately, no live image or descendant claim'})
            return False
        with self.lock:
            identity = (process.pid, value['starttime'])
            process.epi_owned_identity = identity
            self.roots[identity] = {**value, 'label': label, 'process': process}
            self.known[identity] = {**value, 'root': identity}
        return True

    def loop(self):
        while not self.quit.wait(0.05):
            try:
                self.capture()
            except Exception as error:
                with self.lock:
                    if len(self.errors) < 16:
                        self.errors.append(str(error))

    def capture(self):
        with self.lock:
            table = {}
            for entry in Path('/proc').iterdir():
                if entry.name.isdigit():
                    value = proc_stat(int(entry.name))
                    if value:
                        table[value['pid']] = value
            owners = {}
            for (pid, start), value in self.known.items():
                if pid in table and table[pid]['starttime'] == start:
                    owners[pid] = value['root']
            changed = True
            while changed:
                changed = False
                for pid, value in table.items():
                    if pid not in owners and value['ppid'] in owners:
                        owners[pid] = owners[value['ppid']]
                        changed = True
            require(len(owners) <= 512, 'Owned process population exceeds bounded observer')
            for pid, root in owners.items():
                value = {**table[pid], 'root': root}
                key = (pid, value['starttime'])
                self.known[key] = value
                if self.phase == 'build':
                    continue
                try:
                    image = os.readlink(f'/proc/{pid}/exe')
                    row_key = (pid, value['starttime'], image)
                    if row_key in self.rows:
                        continue
                    require(len(self.rows) < 512, 'Owned observation record bound exceeded')
                    with open(f'/proc/{pid}/cmdline', 'rb') as stream:
                        argv = stream.read(32769)
                    require(len(argv) <= 32768, 'Owned argv exceeds observation bound')
                    row = {**value, 'exe': image,
                           'argv': argv.rstrip(b'\0').decode('utf-8', errors='replace').split('\0'),
                           'phase': self.phase, 'observed_monotonic': time.monotonic(),
                           'root_label': self.roots[root]['label'], 'root_pid': root[0], 'root_starttime': root[1]}
                    for role, offered in self.expected.items():
                        if image == offered['path']:
                            image_path = Path(f'/proc/{pid}/exe')
                            status = image_path.stat()
                            inode = (status.st_dev, status.st_ino, status.st_size, status.st_mtime_ns)
                            if inode not in self.image_cache:
                                actual = file_ref(image_path, proc_image=True)
                                after = image_path.stat()
                                require(inode == (after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns),
                                        'Loaded process image changed during read-only hashing')
                                self.image_cache[inode] = {'ref': actual, 'first_observed_pid': pid,
                                                           'first_observed_starttime': value['starttime']}
                            hashed = self.image_cache[inode]
                            actual = hashed['ref']
                            require(actual['sha256'] == offered['sha256'] and actual['bytes'] == offered['bytes'],
                                    'Loaded owned native image differs from offered cut: ' + role)
                            row['loaded_native_role'] = role
                            row['actual_image'] = {'path': str(image_path), 'sha256': actual['sha256'], 'bytes': actual['bytes']}
                            row['loaded_inode'] = list(inode)
                            row['image_hash_source'] = hashed
                            row['offered_image'] = offered
                    self.rows[row_key] = row
                    encoded = json.dumps(list(self.rows.values())).encode()
                    require(len(encoded) <= 2 * 1024 * 1024, 'Aggregate owned observation byte bound exceeded')
                except (FileNotFoundError, ProcessLookupError):
                    continue

    def evidence(self):
        self.capture()
        with self.lock:
            value = {'schema': 'epi.hosted-owned-process-images/v1',
                     'scope': 'Actual Linux descendants of explicitly owned roots only; no inferred image fields from kernel',
                     'records': list(self.rows.values()), 'errors': list(self.errors),
                     'completed_short_commands_without_live_image_claim': list(self.completed_short_commands)}
            save(self.output / 'owned-process-images.json', value)
            return value

    def stop(self, process):
        self.capture()
        root_identity = process.epi_owned_identity
        root = self.roots[root_identity]
        with self.lock:
            targets = [dict(v) for v in self.known.values() if v['root'] == root_identity]
        # Snapshot before the bridge exits and descendants can be reparented.
        sent = []
        for sig in (signal.SIGTERM, signal.SIGKILL):
            for value in reversed(targets):
                now = proc_stat(value['pid'])
                if now and now['starttime'] == value['starttime'] and now['state'] != 'Z':
                    try:
                        os.kill(value['pid'], sig)
                        sent.append({'pid': value['pid'], 'starttime': value['starttime'], 'signal': sig.name})
                    except ProcessLookupError:
                        pass
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                pass
            deadline = time.monotonic() + 5
            while time.monotonic() < deadline:
                alive = [v for v in targets if (now := proc_stat(v['pid']))
                         and now['starttime'] == v['starttime'] and now['state'] != 'Z']
                if not alive:
                    break
                time.sleep(0.05)
        require(process.poll() is not None, 'Owned root did not terminate: ' + root['label'])
        alive = [v for v in targets if (now := proc_stat(v['pid']))
                 and now['starttime'] == v['starttime'] and now['state'] != 'Z']
        require(not alive, 'Owned native descendants remain live after cleanup')
        return {'root_pid': process.pid, 'root_starttime': root['starttime'],
                'label': root['label'], 'exit': process.returncode, 'signals': sent,
                'live_descendants_remaining': alive,
                'zombie_descendants_remaining': [v for v in targets if (now := proc_stat(v['pid']))
                    and now['starttime'] == v['starttime'] and now['state'] == 'Z']}

    def close(self):
        cleanups = []
        for root in list(self.roots.values())[::-1]:
            cleanups.append(self.stop(root['process']))
        self.quit.set()
        self.monitor.join(timeout=5)
        save(self.output / 'owned-process-cleanup.json', cleanups)


class Replay:
    def __init__(self, args):
        self.args = args
        self.repo, self.ql, self.central, self.aikit = (Path(v).resolve(strict=True) for v in (args.repo, args.ql_source, args.central_source, args.aikit_source))
        self.out = Path(args.output).absolute()
        require(not self.out.exists(), 'Use a fresh owned evidence directory')
        self.out.mkdir(parents=True)
        self.commands = self.out / 'commands'
        self.commands.mkdir()
        self.owned = OwnedProcesses(self.out)
        self.number = 0
        self.bridge_process = None
        self.report = {'schema': 'oi.epi-world-hosted-native/v1', 'passed': False,
                       'standing': 'Pending actual source-built hosted native/production receiving replay; no managed/installed claim',
                       'claims': {'installed_mac': False, 'hardware_gpu': False, 'physical_audio': False,
                                  'fresh_model_answer': False, 'human_recognition': False},
                       'commands': [], 'operations': [], 'phases': [],
                       'machine': {'system': platform.system(), 'release': platform.release(), 'machine': platform.machine()}}
        self.env = dict(os.environ)
        for name in ('CENTRAL_NATIVE_TOKEN', 'QL_NARA_PYTHON', 'OI_ACTUATION_BIN', 'OI_AIKIT_BIN', 'CARGO_TARGET_DIR',
                     'OI_NATIVE_OWNER_SOCKET', 'OI_NATIVE_OWNER_OFFER', 'RUSTC', 'RUSTC_WRAPPER', 'RUSTC_WORKSPACE_WRAPPER', 'CC', 'CXX'):
            self.env.pop(name, None)
        self.env['CARGO_BUILD_JOBS'] = '2'
        self.env['AIKIT_HOME'] = str(self.out / 'aikit-home')
        self.env['XDG_CACHE_HOME'] = str(self.out / 'cache')
        self.env['UV_CACHE_DIR'] = str(self.out / 'uv-cache')
        self.env['QL_NARA_UV'] = str(Path(args.uv).resolve(strict=True))
        self.env['PATH'] = str(Path(args.uv).resolve(strict=True).parent) + os.pathsep + self.env.get('PATH', '')

    def command(self, label, argv, cwd, env=None, timeout=1800):
        self.number += 1
        base = self.commands / f'{self.number:02d}-{label}'
        argv = [str(x) for x in argv]
        started = time.monotonic()
        with base.with_suffix('.stdout').open('wb') as stdout, base.with_suffix('.stderr').open('wb') as stderr:
            process = subprocess.Popen(argv, cwd=cwd, env=env or self.env,
                                       stdout=stdout, stderr=stderr, start_new_session=True)
            registered = self.owned.add(process, label, allow_completed=True)
            try:
                code = process.wait(timeout=timeout)
            except BaseException as error:
                cleanup_receipt, cleanup_error = None, None
                try:
                    if registered:
                        cleanup_receipt = self.owned.stop(process)
                except BaseException as stop_error:
                    cleanup_error = repr(stop_error)
                    raise
                finally:
                    # Preserve the actual failed command after the same owned
                    # stop, including a cumulative deadline and final outputs.
                    self.report['commands'].append({
                        'name': label, 'argv': argv, 'cwd': str(cwd),
                        'pid': process.pid, 'exit': process.poll(),
                        'output_custody': ('final after successful identity-owned family stop'
                                           if cleanup_receipt is not None and process.poll() is not None
                                           else 'observed; complete owned-family output finality unproved'),
                        'cleanup_attempted': registered,
                        'cleanup_receipt': cleanup_receipt, 'cleanup_error': cleanup_error,
                        'failure': repr(error),
                        'timed_out': isinstance(error, subprocess.TimeoutExpired),
                        'timeout_seconds': timeout,
                        'stdout_ref': file_ref(base.with_suffix('.stdout')),
                        'stderr_ref': file_ref(base.with_suffix('.stderr')),
                        'elapsed_seconds': time.monotonic() - started})
                    save(self.out / 'receipt.json', self.report)
                raise
        row = {'name': label, 'argv': argv, 'cwd': str(cwd), 'exit': code,
               'stdout_ref': file_ref(base.with_suffix('.stdout')),
               'stderr_ref': file_ref(base.with_suffix('.stderr')), 'elapsed_seconds': time.monotonic() - started}
        self.report['commands'].append(row)
        save(self.out / 'receipt.json', self.report)
        require(code == 0, label + ': actual command failed, see retained stdout/stderr')
        return row

    def git(self, root, *args):
        row = self.command('git-' + args[0], ['git', '-C', root, *args], self.out, timeout=30)
        return Path(row['stdout_ref']['path']).read_text().strip()

    def cut(self, root, expected):
        require(re.fullmatch('[0-9a-f]{40}', expected), 'An exact immutable source cut is required')
        require(self.git(root, 'rev-parse', 'HEAD') == expected, 'Wrong actual source checkout: ' + str(root))
        require(self.git(root, 'status', '--porcelain', '--untracked-files=no') == '', 'Tracked source is dirty: ' + str(root))
        return {'root': str(root), 'cut': expected, 'tree': self.git(root, 'rev-parse', 'HEAD^{tree}'), 'tracked_source_dirty': False}

    def source_rows(self, root, cut, paths):
        rows = []
        for relative in sorted(set(paths)):
            require(not PurePosixPath(relative).is_absolute() and '..' not in PurePosixPath(relative).parts,
                    'Invalid qualified source path')
            path = root / relative
            require(path.resolve(strict=True).is_relative_to(root), 'Source escaped checkout')
            qualified = self.git(root, 'rev-parse', cut + ':' + relative)
            actual = self.git(root, 'hash-object', str(path))
            require(qualified == actual, 'Working source differs from committed cut: ' + relative)
            rows.append({'path': relative, 'physical_path': str(path), 'cut': cut,
                         **{k: v for k, v in file_ref(path).items() if k != 'path'}, 'working_bytes_equal_cut': True})
        return rows

    def package(self):
        archive = Path(self.args.fixture_archive).resolve(strict=True)
        require(file_ref(archive)['sha256'] == self.args.fixture_sha256, 'Wrong immutable controlled fixture archive')
        fixture = self.out / 'fixtures'
        fixture.mkdir()
        total, names = 0, set()
        with tarfile.open(archive, 'r:gz') as package:
            for member in package:
                name = PurePosixPath(member.name)
                require(member.isfile() and not name.is_absolute() and '..' not in name.parts
                        and member.name not in names and member.size <= MAX_JSON, 'Invalid controlled fixture member')
                names.add(member.name)
                total += member.size
                require(total <= MAX_PACKAGE, 'Controlled fixture expansion exceeds bound')
                target = fixture / member.name
                target.parent.mkdir(parents=True, exist_ok=True)
                with package.extractfile(member) as source, target.open('xb') as destination:
                    shutil.copyfileobj(source, destination, 1024 * 1024)
        manifest = read_json(fixture / 'controlled-fixtures.json')
        require(manifest['schema'] == 'epi.controlled-historical-world-fixtures/v1', 'Wrong controlled fixture schema')
        expected = {'controlled-fixtures.json'} | {row['path'] for row in manifest['files']}
        require(names == expected, 'No undeclared or missing fixture material permitted')
        for row in manifest['files']:
            actual = file_ref(fixture / row['path'])
            require(actual['sha256'] == row['sha256'] and actual['bytes'] == row['bytes'], 'Fixture bytes changed: ' + row['path'])
        self.report['fixture_archive'] = file_ref(archive)
        self.report['fixture_manifest'] = file_ref(fixture / 'controlled-fixtures.json')
        return fixture, manifest

    def native_get(self, label, route):
        with urllib.request.urlopen(self.url + route, timeout=30) as response:
            raw = response.read(MAX_JSON + 1)
        require(len(raw) <= MAX_JSON, 'Actual native envelope exceeds evidence read bound')
        target = self.out / f'{label}.raw.json'
        target.write_bytes(raw)
        result = parse(raw)
        self.report['operations'].append({'method': 'GET', 'route': route, 'response_ref': file_ref(target)})
        return result

    def op(self, label, request):
        target = self.out / f'{label}.json'
        encoded = json.dumps(request, allow_nan=False).encode()
        require(len(encoded) <= MAX_JSON, 'Native request exceeds bound')
        http = urllib.request.Request(self.url + '/op', encoded, {'Content-Type': 'application/json'})
        try:
            response = urllib.request.urlopen(http, timeout=180)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            raw = response.read(MAX_JSON + 1)
            status = response.status
        require(len(raw) <= MAX_JSON, 'Native response exceeds evidence bound')
        raw_target = self.out / f'{label}.raw.json'
        raw_target.write_bytes(raw)
        result = parse(raw)
        save(target, {'request': request, 'http_status': status, 'response': result})
        self.report['operations'].append({'name': label, 'request': request, 'raw_response_ref': file_ref(raw_target), 'evidence_ref': file_ref(target)})
        save(self.out / 'receipt.json', self.report)
        require(status == 200 and result.get('ok') is True, label + ': real native operation failed')
        return result['outcome']

    def start_bridge(self, name):
        self.owned.phase = name
        stderr = (self.out / f'{name}-bridge.stderr').open('wb')
        process = subprocess.Popen([self.bridge, '127.0.0.1:0'], cwd=self.world, env=self.env,
                                   stdout=subprocess.PIPE, stderr=stderr, start_new_session=True)
        self.owned.add(process, name + '-bridge')
        self.bridge_process, self.bridge_stderr = process, stderr
        ready, _, _ = select.select([process.stdout], [], [], 45)
        require(ready, 'Actual bridge failed to announce its owned port')
        line = process.stdout.readline(4097)
        require(len(line) <= 4096, 'Bridge announcement exceeds bound')
        match = re.search(rb'http://127\.0\.0\.1:([0-9]+)', line)
        require(match is not None, 'Actual bridge announcement has no loopback URL')
        self.url = match.group().decode()
        (self.out / f'{name}-bridge.announcement').write_bytes(line)
        replay = self.native_get(name + '-generation', '/event-replay?cursor=1&limit=1')['replay']
        require(replay['schema'] == 'oi.kernel-event-replay/v1' and isinstance(replay['generation'], str)
                and replay['generation'], 'Actual event owner must disclose its generation')
        value = {'name': name, 'pid': process.pid, 'starttime': proc_stat(process.pid)['starttime'],
                 'url': self.url, 'native_generation': replay['generation'], 'bridge': file_ref(self.bridge)}
        self.report['phases'].append(value)
        return value

    def stop_bridge(self):
        if self.bridge_process:
            self.report.setdefault('bridge_cleanups', []).append(self.owned.stop(self.bridge_process))
            self.bridge_process.stdout.close()
            self.bridge_stderr.close()
            self.bridge_process = None

    def file_admission(self, relative, label, expected_revision=None):
        outcome = self.op(label + '-listing', {'op': 'files_list', 'path': str(PurePosixPath(relative).parent), 'fresh': True})
        require(outcome['result'] == 'directory_read', 'Native listing result required')
        directory = outcome['directory']
        entries = [row for row in directory['entries'] if row['location']['path'] == relative]
        require(len(entries) == 1 and entries[0]['kind'] == 'file' and entries[0]['retrieval_allowed'], 'Exactly one native readable material file required')
        location = entries[0]['location']
        require(Path(location['root']).resolve() == self.world and location['path'] == relative,
                'Owner-disclosed location must bind this actual controlled world')
        outcome = self.op(label + '-read', {'op': 'file_read', 'location': location})
        require(outcome['result'] == 'file_read', 'Actual native file read required')
        reading = outcome['reading']
        require(reading['location'] == location, 'Native file read redirected location')
        if expected_revision is not None:
            require(reading['revision'] == expected_revision, 'Acknowledged current file fence changed')
        outcome = self.op(label + '-inspect', {'op': 'expression', 'request': {
            'operation': 'inspect_file', 'location': location, 'expected_file_revision': reading['revision']}})
        require(outcome['result'] == 'expression', 'Actual Expression owner admission required')
        data = outcome['data']
        require(data['state'] == 'ready' and data['file'] == {'location': location, 'revision': reading['revision']},
                'Native file owner must admit exact current file fence')
        document = data['document']
        require(document['schema'] == 'oi.expression/v1', 'Full native decoded Expression required')
        require(LOCUS in [entity.get('subject', {}).get('subject_ref') for entity in document['entities'].values()], 'Canonical actual personal locus required')
        return reading, document

    def adopt_current_controlled_profile(self, relative, reading, document):
        """Explicit repair of the retained controlled candidate, not loader rebasing.

        The imported131 fixture and all original receipts remain immutable.
        Only the existing native profile adoption and file CAS operations make
        its successor. No Scene, subject, identity, occasion or authored form
        is reconstructed here.
        """
        adoptions = [row for row in document['profiles']
                     if row['profile_ref'].startswith('profile:epi-coordinate-')]
        old_ref = 'profile:epi-coordinate-fd9f0de5a1784ac5f7166913b0fd63eaedd00fe5c3e43d597a81e0868a540ebb'
        require(len(adoptions) == 1 and adoptions[0]['profile_ref'] == old_ref
                and adoptions[0]['revision'] == 1
                and adoptions[0]['overridden_parameters'] == {}
                and adoptions[0]['source_basis']['ref'] == LOCUS,
                'Explicit repair applies only to the reviewed original131 controlled adoption')
        opened = self.op('profile-review-open', {'op': 'expression', 'request': {
            'operation': 'open_file', 'location': reading['location'],
            'expected_file_revision': reading['revision'], 'actor': 'agent:epi-fidelity-repair'}})['data']
        require(opened['state'] == 'ready' and opened['document'] == document,
                'Repair must begin from the complete exact admitted131 Document')
        current = self.op('profile-review-current-coordinate', {'op': 'nara_coordinate', 'request': {
            'coordinate_ref': LOCUS, 'face': 'bimba', 'include_content': True}})['data']
        binding = current['binding']
        content = current['source_content']
        source = current['subject_binding']['sources'][0]
        record = document['scenes'][0]['presentation']['scene']['epiWorld']
        native_source_paths = ['fixtures/kernel/bimba-content-v1.json',
                               'crates/ql-mef/src/bimba_content.rs',
                               'crates/ql-mef/src/coordinate_expression.rs']
        source_before = self.source_rows(self.ql, self.args.expected_ql_head, native_source_paths)
        bimba = read_json(self.ql / native_source_paths[0], limit=MAX_PACKAGE)
        original_properties = bimba['content']['nodes']['M4.4.4.4']['properties']
        hub_rows = [row for row in record['inventory'] if row['canonical_ref'] == LOCUS]
        require(current['schema'] == 'oi.nara-coordinate/v1'
                and binding['face'] == 'bimba'
                and current['subject_binding']['subject_ref'] == LOCUS
                and source == adoptions[0]['source_basis']
                and binding['rooted_world']['registry_revision'] == record['source_basis']['registry_revision']
                and content['identity']['canonical_ref'] == LOCUS
                and content['identity']['uuid'] == 'dcb274c1-fbbc-5914-b27d-dea979c78558'
                and content['source_revision'] == record['source_basis']['source_revision']
                and bimba['source_revision'] == content['source_revision']
                and content['identity']['properties'] == original_properties
                and len(hub_rows) == 1
                and content['identity']['properties_sha256'] == hub_rows[0]['properties_sha256']
                and any(row['record']['payload_sha256'] == hub_rows[0]['properties_sha256']
                        for row in binding['property_sources']),
                'Current grammar review must retain the exact whole Bimba hub basis')
        incident = [(index, row) for index, row in enumerate(bimba['content']['relations'])
                    if row[0] == 'M4.4.4.4' or row[2] == 'M4.4.4.4']
        source_refs = {row['coordinate']: row['canonical_ref'] for row in record['inventory']}
        require(len(source_refs) == len(record['inventory']), 'Complete retained source identities must be unambiguous')
        def source_digest(value):
            return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True,
                                             separators=(',', ':'), allow_nan=False).encode()).hexdigest()
        require(len(incident) == len(content['relations']) == 23,
                'Complete original hub incident relations are required')
        for actual, (index, row) in zip(content['relations'], incident):
            require(actual['source_index'] == index and actual['from_coordinate'] == row[0]
                    and actual['kind'] == row[1] and actual['to_coordinate'] == row[2]
                    and actual['properties'] == row[3] and actual['orientation'] == 'directed'
                    and actual['source_revision'] == bimba['source_revision']
                    and actual['properties_sha256'] == source_digest(row[3])
                    and actual['relation_ref'] == 'bimba:relation:' + source_digest(row[:3])[:24]
                    and actual['from_ref'] == source_refs[row[0]]
                    and actual['to_ref'] == source_refs[row[2]],
                    'Current native hub relation differs from the exact directed qualified source tuple')
        source_after = self.source_rows(self.ql, self.args.expected_ql_head, native_source_paths)
        require(source_after == source_before, 'Hub source custody changed during explicit grammar review')
        profiles = current['profiles']
        require(len(profiles) == 4
                and profiles[-1]['profile_ref'] == binding['resolved_profile_ref']
                and profiles[-1]['revision'] == binding['profile_revision']
                and binding['resolved_profile_ref'] != old_ref,
                'A real current native lineage must replace the independently identified stale grammar')
        for index, profile in enumerate(profiles):
            require(profile['parent_profile_refs'] == ([] if index == 0 else [profiles[index - 1]['profile_ref']]),
                    'Native lineage must be complete and parents-first')
            defined = self.op(f'profile-review-define-{index}', {'op': 'expression', 'request': {
                'operation': 'profile_define', 'profile': profile, 'actor': 'agent:epi-fidelity-repair'}})['data']
            inspected = self.op(f'profile-review-inspect-{index}', {'op': 'expression', 'request': {
                'operation': 'profile_inspect', 'profile_ref': profile['profile_ref']}})['data']
            require(defined['state'] == inspected['state'] == 'profile'
                    and defined['profile'] == inspected['profile'] == profile,
                    'Actual native profile admission and independent readback must match exact source')
        adoption = {'profile_ref': binding['resolved_profile_ref'], 'revision': binding['profile_revision'],
                    'source_basis': source, 'overridden_parameters': {}}
        changes = [{'change': 'profile_release', 'profile_ref': old_ref},
                   {'change': 'profile_adopt', 'adoption': adoption}]
        accepted = self.op('profile-review-explicit-adoption', {'op': 'expression', 'request': {
            'operation': 'edit', 'expression_ref': document['expression_ref'],
            'expected_revision': document['revision'], 'actor': 'agent:epi-fidelity-repair',
            'changes': changes}})['data']
        expected = json.loads(json.dumps(document))
        expected['revision'] += 1
        expected['profiles'] = [row for row in document['profiles'] if row['profile_ref'] != old_ref] + [adoption]
        require(accepted['state'] == 'ready' and accepted['document'] == expected,
                'Profile repair may change only the single adoption and Document revision')
        saved = self.op('profile-review-native-save', {'op': 'expression', 'request': {
            'operation': 'save', 'expression_ref': expected['expression_ref'],
            'expected_revision': expected['revision'], 'location': reading['location'],
            'expected_file_revision': reading['revision'], 'actor': 'agent:epi-fidelity-repair',
            'actor_kind': 'agent'}})['data']
        require(saved['state'] == 'saved' and saved['persisted'] is True
                and saved['readback_verified'] is True
                and saved['expression_revision'] == expected['revision']
                and saved['file']['location'] == reading['location'],
                'Only an acknowledged ordinary native save supplies the successor file')
        live = self.op('profile-review-saved-live-inspect', {'op': 'expression', 'request': {
            'operation': 'inspect', 'expression_ref': expected['expression_ref']}})['data']
        require(live['state'] == 'ready' and live['document'] == expected
                and live['dirty'] is False and live['saved_revision'] == expected['revision']
                and live['file'] == saved['file'],
                'Actual saved live native Document and current file binding must match the explicit repair')
        received, decoded = self.file_admission(relative, 'profile-review-saved-readback', saved['file']['revision'])
        require(decoded == expected, 'Complete independent native saved-file admission must match the explicit repair')
        repair = {'schema': 'epi.explicit-current-coordinate-profile-repair/v1',
                  'source_cut': self.args.expected_ql_head,
                  'original_document_revision': document['revision'], 'successor_document_revision': decoded['revision'],
                  'before_file': {'location': reading['location'], 'revision': reading['revision']},
                  'after_file': {'location': received['location'], 'revision': received['revision']},
                  'old_adoption': adoptions[0], 'current_adoption': adoption,
                  'current_coordinate_ref': file_ref(self.out / 'profile-review-current-coordinate.json'),
                  'source_qualification': source_before, 'complete_properties': len(original_properties),
                  'complete_directed_incident_relations': len(incident),
                  'changes': changes, 'all_other_document_values_equal': True,
                  'source_basis_unchanged': True, 'material_members': [len(scene['entity_refs']) for scene in decoded['scenes']],
                  'standing': 'Actual explicit native candidate repair and full save/readback; original fixture retained; production loader does not rebase; whole replay follows'}
        save(self.out / 'explicit-profile-repair.json', repair)
        self.report['explicit_profile_repair'] = file_ref(self.out / 'explicit-profile-repair.json')
        return received, decoded

    def selected_stage(self, name, config, custody, deadline):
        """Actual production admission/selected-focus proof; never whole/body GO."""
        remaining = deadline - time.monotonic()
        require(remaining > 0, 'Selection-only aggregate engineering envelope expired')
        custody_path = self.out / f'{name}-owner-custody.json'
        save(custody_path, custody)
        target = self.out / f'{name}-config.json'
        save(target, {**config, 'bridge': self.url, 'output': str(self.out / name),
                      'selection_custody_file': str(custody_path),
                      'selection_custody_sha256': file_ref(custody_path)['sha256']})
        self.command(name, ['node', self.repo / 'desktop/cradle/tests/epi-world-production-native.mjs', target],
                     self.repo / 'desktop/cradle', timeout=min(300, remaining))
        path = self.out / name / 'receipt.json'
        receipt = read_json(path)
        require(receipt['schema'] == 'oi.epi-selected-conversation-hosted-stage/v1'
                and receipt['passed'] is True and 'failure' not in receipt
                and not receipt['entry']['changed_on_disk'], 'Actual isolated selection stage failed')
        self.report.setdefault('selected_conversation', {'scope': 'Selection/focus/ordinary conversation opening only; no question/provider answer/Keep/restart/installed/H',
            'aggregate_seconds': 1500, 'case_operation_deadlines_unchanged': True,
            'queue_superseded_invalidated': 'Still required and unexecuted by these four cases', 'stages': []})['stages'].append(file_ref(path))
        save(self.out / 'receipt.json', self.report)
        return receipt

    def selected_custody(self, owner, document, acknowledged, oi_sources, manifest_path, admission_ref=None, current_custody_ref=None):
        require(self.bridge_process.pid == owner['pid'] and proc_stat(owner['pid'])['starttime'] == owner['starttime'],
                'Selection custody must name this actual live owned bridge')
        records = [scene['presentation']['scene']['epiWorld'] for scene in document['scenes']
                   if scene.get('presentation', {}).get('scene', {}).get('epiWorld')]
        require(len(records) == 1, 'Exactly one source-bearing Epi world carrier required')
        record = records[0]
        require(record['person_ref'] == PERSONS[0]
                and record['identity_source']['source_ref'] == read_json(acknowledged[0])['source']['source_ref'],
                'Only actual controlled A native identity may supply selection custody')
        value = {'schema': 'epi.hosted-native-selection-owner-custody/v1',
                 'world': str(self.world), 'owned_output_root': str(self.out), 'expression_ref': document['expression_ref'],
                 'source_cuts': self.report['source_cuts'], 'oi_sources': oi_sources,
                 'native_process': owner, 'all_five': file_ref(manifest_path),
                 'host_owners': self.report['host_owners'],
                 'host_build_operations': [next(row for row in self.report['commands'] if row['name'] == name)
                      for name in ('oi-cli-build', 'oi-kernel-build', 'central-build', 'aikit-build')],
                 'identity_ref': file_ref(acknowledged[0]),
                 'identity_source_ref': record['identity_source']['source_ref'],
                 'native_source_expectation_ref': self.selection_source_expectation_ref,
                 'original_world_ref': self.selection_original_world_ref}
        if admission_ref is not None:
            value['admission_ref'] = admission_ref
        if current_custody_ref is not None:
            value['protected_current_custody_ref'] = current_custody_ref
        return value

    def current_request(self, document, operation):
        records = [scene['presentation']['scene']['epiWorld'] for scene in document['scenes']
                   if scene.get('presentation', {}).get('scene', {}).get('epiWorld')]
        require(len(records) == 1, 'One exact actual Epi carrier must own the private current')
        record = records[0]
        # This external empty project selector is resolved by the native kernel
        # through AIKit to its nonempty canonical ProjectRef. It is never used
        # as the internal protected checkpoint project or inferred from cwd.
        return {'op': 'nara_current', 'project': '', 'request': {'operation': operation, 'binding': {
            'operation': 'context', 'role': 'nara', 'source_ref': record['identity_source']['source_ref'],
            'expected_revision': record['identity_source']['revision'], 'person_ref': record['person_ref'],
            'nara_ref': record['nara_ref'], 'expression_ref': document['expression_ref']}}}

    def current_read(self, label, document):
        result = self.op(label, self.current_request(document, 'read'))['data']
        require(result['schema'] == 'oi.nara-personal-current-context/v1' and result['status'] == 'available'
                and result['private'] is True and result['public_export'] is False
                and result['expression_ref'] == document['expression_ref']
                and result['expression_revision'] == document['revision'], 'Actual native current read lost its complete current document basis')
        record = next(scene['presentation']['scene']['epiWorld'] for scene in document['scenes']
                      if scene.get('presentation', {}).get('scene', {}).get('epiWorld'))
        reference = record['receiving']['personal']['current']
        require(reference == {'ref': result['context']['reading_ref'], 'revision': result['context']['reading_revision'],
                              'availability': 'available'}
                and result['context']['event_ref'] == record['world']['event_ref']
                and result['reading']['identity']['person_ref'] == record['person_ref'],
                'The saved current reference must match the actual full native protected reading')
        return result

    def checkpoint_bytes(self, path):
        path = Path(path)
        require(path.is_absolute(), 'An owned checkpoint path must be absolute')
        fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
        try:
            before = os.fstat(fd)
            require(stat.S_ISREG(before.st_mode) and before.st_uid == os.geteuid() and before.st_nlink == 1
                    and stat.S_IMODE(before.st_mode) == 0o600 and before.st_size <= 16 * 1024 * 1024,
                    'Actual private checkpoint file violates native ownership/mode/link/record bounds')
            with os.fdopen(os.dup(fd), 'rb') as stream:
                raw = stream.read(16 * 1024 * 1024 + 1)
            after = os.fstat(fd)
            require(len(raw) == before.st_size and (before.st_dev, before.st_ino, before.st_size, before.st_mtime_ns)
                    == (after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns),
                    'Actual native checkpoint changed during bounded custody read')
            require(path.lstat().st_ino == after.st_ino and not path.is_symlink(), 'Checkpoint pathname changed during read')
            return raw
        finally:
            os.close(fd)

    def qualify_current_checkpoint(self, document, qualified_ql, kernel_env, selection_deadline):
        current = self.current_read('after-selection-native-current-read', document)
        directory = Path(self.env['OI_HOME']) / 'desktop/nara-current'
        require(directory.is_dir() and not directory.is_symlink() and stat.S_IMODE(directory.stat().st_mode) == 0o700 and directory.stat().st_uid == os.geteuid(),
                'Actual native private checkpoint directory is unavailable or not private')
        reference = current['context']['reading_ref']
        suffix = reference.removeprefix('personal:nara-current:')
        require(re.fullmatch('[0-9a-f]{64}', suffix), 'Actual current has no full native digest reference')
        candidates, total, records = [], 0, 0
        for member in directory.iterdir():
            if member.name == '.lock':
                continue
            require(re.fullmatch(r'[0-9a-f]{64}-[0-9a-f]{64}\.json', member.name), 'Foreign private checkpoint member')
            records += 1
            require(records <= 256, 'Native checkpoint count exceeded its existing limit')
            raw = self.checkpoint_bytes(member)
            total += len(raw)
            require(total <= 64 * 1024 * 1024, 'Native checkpoint scope exceeds its existing limit')
            if member.name.endswith('-' + suffix + '.json'):
                candidates.append((member, raw, parse(raw)))
        require(len(candidates) == 1, 'Exact actual saved current must name one private native checkpoint')
        path, raw, stored = candidates[0]
        require(set(stored) == {'record', 'record_sha256'} and re.fullmatch('[0-9a-f]{64}', stored['record_sha256']),
                'Actual private checkpoint has another envelope')
        record = stored['record']
        require(record['schema'] == 'oi.nara-native-current-checkpoint/v1'
                and record['project'] and record['context'] == current['context'] and record['reading'] == current['reading']
                and record['binding'] == self.current_request(document, 'read')['request']['binding']
                and record['owner']['sha256'] == qualified_ql['sha256'] and record['owner']['bytes'] == qualified_ql['bytes']
                and Path(record['owner']['path']).resolve(strict=True) == Path(qualified_ql['path']).resolve(strict=True),
                'Actual checkpoint differs from native full current/person/binding/qualified owner')
        scope_env = {**self.env, 'CENTRAL_ROOT': str(self.world)}
        scope_command = self.command('controlled-current-canonical-project', [self.env['OI_BIN'], 'aikit', 'session-space',
            '-C', self.world, 'agent-session-scope'], self.world, scope_env, timeout=120)
        scope = read_json(scope_command['stdout_ref']['path'])
        require(scope['schema'] == 'aikit.direct-agent-scope/v1' and scope['execution_authority_granted'] is False
                and scope['project_ref'] == record['project'], 'Checkpoint project must be the actual native canonical AIKit root binding')
        document_path = self.out / 'actual-newly-admitted-current-document.json'
        save(document_path, document)
        remaining = selection_deadline - time.monotonic()
        require(remaining > 0, 'The unchanged selection aggregate envelope expired before private custody counterproofs')
        test_env = {**self.env, 'CARGO_TARGET_DIR': kernel_env['CARGO_TARGET_DIR'],
            'OI_ACTUAL_NATIVE_CURRENT_CHECKPOINT': str(path), 'OI_ACTUAL_NATIVE_CURRENT_DOCUMENT': str(document_path),
            'OI_ACTUAL_NATIVE_CURRENT_TEST_HOME': str(self.out / 'actual-current-native-unit-home')}
        test = self.command('actual-newly-admitted-current-custody-regression', ['cargo', 'test', '--locked', '--manifest-path',
            self.repo / 'desktop/cradle/kernel/Cargo.toml', '--lib',
            'nara_current::retention::actual_checkpoint_tests::actual_admitted_checkpoint_cold_restore_and_refusals',
            '--', '--exact', '--ignored', '--nocapture'], self.repo, test_env, timeout=min(180, remaining))
        require(re.search(r'test result: ok\. 1 passed; 0 failed; 0 ignored;', Path(test['stdout_ref']['path']).read_text()),
                'The explicitly configured actual-checkpoint regression must execute exactly once')
        require(self.checkpoint_bytes(path) == raw, 'Native counterproofs changed the original admitted current checkpoint')
        after = self.current_read('after-checkpoint-counterproof-native-current-read', document)
        require(after == current, 'Native checkpoint counterproofs changed the actual live admitted current')
        custody_path = self.out / 'selection-native-current-custody.json'
        save(custody_path, {'schema': 'epi.hosted-native-protected-current-custody/v1',
            'checkpoint_ref': file_ref(path), 'checkpoint_name': path.name, 'resolved_native_project': record['project'],
            'actual_project_scope_command': scope_command, 'current': current, 'document_ref': file_ref(document_path),
            'actual_native_current_read_ref': file_ref(self.out / 'after-selection-native-current-read.json'),
            'native_counterproof_command': test, 'qualified_ql': qualified_ql,
            'scope': 'Real native newly admitted full protected checkpoint and actual native guard mutations; only controlled A. No historical f119 recovery or source-math revalidation claimed.'})
        self.report['protected_current_custody'] = file_ref(custody_path)
        save(self.out / 'receipt.json', self.report)
        return file_ref(custody_path)

    def transfer_current_checkpoint(self, custody_ref, destination_home, label):
        require(file_ref(custody_ref['path']) == custody_ref, 'Frozen actual private current custody changed')
        custody = read_json(custody_ref['path'])
        source = custody['checkpoint_ref']
        raw = self.checkpoint_bytes(source['path'])
        require(file_ref(source['path']) == source, 'Actual native checkpoint bytes changed before cold transfer')
        home = Path(destination_home)
        require(not home.exists(), 'Cold native checkpoint transfer requires a fresh private home')
        home.mkdir(mode=0o700)
        desktop = home / 'desktop'; desktop.mkdir(mode=0o700)
        directory = desktop / 'nara-current'; directory.mkdir(mode=0o700)
        target = directory / custody['checkpoint_name']
        fd = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
        try:
            with os.fdopen(os.dup(fd), 'wb') as stream:
                stream.write(raw); stream.flush(); os.fsync(stream.fileno())
        finally:
            os.close(fd)
        # Persist the actual member's containing directories as well as its
        # bytes; later native Restore still verifies its own anchored owner.
        for parent in (directory, desktop, home, home.parent):
            directory_fd = os.open(parent, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
            try:
                os.fsync(directory_fd)
            finally:
                os.close(directory_fd)
        require(self.checkpoint_bytes(target) == raw and self.checkpoint_bytes(source['path']) == raw,
                'Controlled cold transfer must preserve exact complete actual native checkpoint bytes')
        receipt_path = self.out / (label + '-actual-current-transfer.json')
        save(receipt_path, {'schema': 'epi.controlled-native-current-byte-transfer/v1', 'source_custody_ref': custody_ref,
            'source': source, 'target': file_ref(target), 'resolved_native_project': custody['resolved_native_project'],
            'scope': 'Declared byte-exact transfer of one actual controlled native admitted immutable checkpoint into a fresh owner; no mutable OI state, private owner input, browser draft, answer, provider or native response copied.'})
        self.report.setdefault('protected_current_transfers', []).append(file_ref(receipt_path))
        save(self.out / 'receipt.json', self.report)

    def driver(self, phase, config):
        target = self.out / f'{phase}-config.json'
        config = {**config, 'bridge': self.url, 'output': str(self.out / phase)}
        save(target, config)
        # The complete software-GPU workload reached the saved-personal
        # snapshot with only 43 seconds of the former 1200s envelope remaining.
        # Its remaining mandatory gates need their original operation bounds.
        # This finite aggregate budget changes no prediction or local deadline;
        # separate fresh-process entry retains its original 1200s envelope.
        aggregate_seconds = 3600 if phase == 'whole-production' else 1200
        self.command(phase, ['node', self.repo / 'desktop/cradle/tests/epi-world-production-native.mjs', target],
                     self.repo / 'desktop/cradle', timeout=aggregate_seconds)
        receipt = read_json(self.out / phase / 'receipt.json')
        require(receipt['schema'] == 'oi.epi-world-production-native-proof/v1' and receipt['passed'] is True
                and 'failure' not in receipt and not receipt['entry']['changed_on_disk'], 'Original strict production driver failed')
        self.report[phase] = file_ref(self.out / phase / 'receipt.json')
        return receipt

    def run(self):
        require(platform.system() == 'Linux' and Path('/proc').is_dir(), 'This explicit hosted custody route requires Linux /proc')
        fixture, fm = self.package()
        original_template = fixture / fm['expectation_template']
        require(file_ref(original_template)['sha256'] == '98d9ed07dbfe9212f9eedff6583c894d074d89f3d96d08d9b07d82e35c89f845',
                'Historical archive retains its original reviewed Ec template byte-exact')
        template = Path(self.args.source_expectation_template).resolve(strict=True)
        require(template == self.repo / D30_TEMPLATE_PATH and file_ref(template)['sha256'] == D30_TEMPLATE_SHA256,
                'Explicit exact reviewed D30 source-expectation template required')
        t = read_json(template, 1024 * 1024)
        require(t['schema'] == 'epi.native-world-source-expectation-template/v3', 'Reviewed source-only v3 template required')
        require(t['source_succession']['path'] == 'source-succession-d30-6a81fc44.json', 'Exact adjacent source-succession record required')
        succession_path = template.parent / t['source_succession']['path']
        succession_ref = file_ref(succession_path)
        require(succession_ref['sha256'] == D30_SUCCESSION_SHA256 == t['source_succession']['sha256']
                and succession_ref['bytes'] == t['source_succession']['bytes'], 'Exact reviewed source-succession artifact required')
        succession = read_json(succession_path, 1024 * 1024)
        require(succession['schema'] == 'epi.native-source-succession/v1'
                and succession['current_source_cut'] == self.args.expected_ql_head == '6a81fc441e4dda477f4de3a7ebd59c368cb28f37',
                'No arbitrary source cut or template retag is admitted')
        prior = read_json(original_template, 1024 * 1024)
        predicted = parse(json.dumps(prior, allow_nan=False))
        field_path = 'crates/ql-mef/src/continuous/scene_field.rs'
        field_hash = next(row['sha256'] for row in succession['constructor_source_locks']['current'] if row['path'] == field_path)
        predicted['expected_native_owner_sources']['field']['revision'] = 'sha256:' + field_hash
        next(row for row in predicted['source_locks'] if row['path'] == field_path)['sha256'] = field_hash
        next(row for row in predicted['semantic_metadata_transition']['derivation_sources'] if row['path'] == field_path)['sha256'] = field_hash
        predicted['source_succession'] = t['source_succession']
        require(t == predicted, 'Every original semantic/numerical/buffer/sky/ledger prediction must remain exact before any native build or request')
        self.report['source_expectation_selection'] = {'original_template': file_ref(original_template),
            'current_template': file_ref(template), 'source_succession': succession_ref,
            'standing': 'Explicit reviewed source-only successor; immutable archive/historical material remain unchanged'}
        self.report['source_cuts'] = {
            'oi': self.cut(self.repo, self.args.expected_oi_head),
            'ql': self.cut(self.ql, self.args.expected_ql_head),
            'central': self.cut(self.central, self.args.expected_central_head),
            'aikit': self.cut(self.aikit, self.args.expected_aikit_head)}
        require(self.report['source_cuts']['ql']['tree'] == succession['current_source_tree'], 'Exact reviewed D30 source tree required')
        provenance = read_json(self.repo / 'desktop/cradle/expressions-app/field-studies-journeys/src/native-field/ql/PROVENANCE.json')
        require(provenance['revision'] == self.args.expected_ql_head, 'Copied adapter provenance must bind the actual owner cut')
        for name, checksum in provenance['files'].items():
            require(file_ref(self.ql / 'adapters/retained-field' / name)['sha256'] == checksum
                    == file_ref(self.repo / 'desktop/cradle/expressions-app/field-studies-journeys/src/native-field/ql' / name)['sha256'],
                    'Copied/native QL client differs: ' + name)
        oi_sources = self.source_rows(self.repo, self.args.expected_oi_head, OI_SCOPE)
        ql_rows_before = self.source_rows(self.ql, self.args.expected_ql_head, [row['path'] for row in t['source_locks']])
        locks = {row['path']: row['sha256'] for row in t['source_locks']}
        require(len(locks) == len(t['source_locks']) and all(row['sha256'] == locks[row['path']] for row in ql_rows_before),
                'Committed current source differs from independently frozen source predictions')
        consumer_paths = [row['path'] for row in succession['consumer_sources']]
        require(consumer_paths == ['crates/ql-mef/src/continuous/scene_field.rs', 'crates/ql-mef/src/continuous/host.rs',
                                  'adapters/retained-field/instrument-session.mjs', 'crates/ql-mef/tests/scene_instrument.rs'],
                'Exact four D30 consumer sources required separately from the unchanged constructor lock paths')
        consumer_rows_before = self.source_rows(self.ql, self.args.expected_ql_head, consumer_paths)
        for row in consumer_rows_before:
            lock = next(source['current'] for source in succession['consumer_sources'] if source['path'] == row['path'])
            require(row['sha256'] == lock['sha256'] and row['bytes'] == lock['bytes']
                    and self.git(self.ql, 'rev-parse', self.args.expected_ql_head + ':' + row['path']) == lock['git_blob'],
                    'Committed D30 consumer source differs from reviewed source succession: ' + row['path'])
        self.report['source_succession_before_build'] = {'record_ref': succession_ref, 'consumer_sources': consumer_rows_before}
        toolchain, toolchain_resolution = [], []
        tools = {}
        rustup = Path(shutil.which('rustup')).resolve(strict=True)
        for name in ('rustc', 'cargo'):
            disclosure = self.command('rustup-which-' + name, [rustup, 'which', name], self.out, timeout=30)
            tools[name] = Path(disclosure['stdout_ref']['path']).read_text().strip()
            toolchain_resolution.append({**{key: disclosure[key] for key in ('argv', 'cwd', 'exit', 'stdout_ref', 'stderr_ref')},
                                         'name': name, 'executable_ref': file_ref(rustup)})
        for name, executable in [('cc', shutil.which('cc')), ('cxx', shutil.which('c++')), ('make', shutil.which('make')),
                                 ('uv', self.args.uv), ('python', sys.executable)]:
            require(executable is not None, 'Required actual toolchain executable absent: ' + name)
            tools[name] = executable
        for name in ('rustc', 'cargo', 'cc', 'cxx', 'make', 'uv', 'python'):
            executable = Path(tools[name]).resolve(strict=True)
            require(os.access(executable, os.X_OK), 'Required executable is not runnable: ' + name)
            tools[name] = str(executable)
            row = self.command(name, [executable, '--version'], self.out, timeout=30)
            toolchain.append({**{key: row[key] for key in ('name', 'argv', 'cwd', 'exit', 'stdout_ref', 'stderr_ref')},
                              'executable_ref': file_ref(executable)})
        self.env.update({'RUSTC': tools['rustc'], 'CC': tools['cc'], 'CXX': tools['cxx']})
        tool_bin = self.out / 'toolchain-bin'
        tool_bin.mkdir()
        for command, role in [('rustc', 'rustc'), ('cargo', 'cargo'), ('cc', 'cc'), ('c++', 'cxx'),
                              ('make', 'make'), ('uv', 'uv'), ('python3', 'python')]:
            (tool_bin / command).symlink_to(tools[role])
        self.env['PATH'] = str(tool_bin) + os.pathsep + self.env['PATH']
        ql_target = self.out / 'build/ql'
        def observed_absent(path):
            try:
                path.lstat()
                return False
            except FileNotFoundError:
                return True
        preflight = {'schema': 'epi.source-installer-output-preflight/v1',
                     'operation': 'pathlib-lstat-before-owner-install',
                     'observed_at_utc': datetime.now(timezone.utc).isoformat(),
                     'source_cut': self.args.expected_ql_head, 'source_tree': self.report['source_cuts']['ql']['tree'],
                     'target_root': str(ql_target), 'target_exists': not observed_absent(ql_target),
                     'outputs': [{'name': role, 'path': str(ql_target / 'release' / role),
                                  'exists': not observed_absent(ql_target / 'release' / role),
                                  'is_symlink': (ql_target / 'release' / role).is_symlink()} for role in ROLES]}
        preflight_path = self.out / 'ql-owner-install-output-preflight.json'
        save(preflight_path, preflight)
        require(preflight['target_exists'] is False and all(not row['exists'] and not row['is_symlink'] for row in preflight['outputs']),
                'All-five installer must start with an absent owned output tree')
        ql_env = {**self.env, 'CARGO_TARGET_DIR': str(ql_target)}
        installer = self.command('ql-all-five-source-install', ['sh', 'scripts/oi-source-install.sh'], self.ql, ql_env, timeout=1800)
        # Existing configured real-worker gate. Ignored tests without this
        # explicitly named actual companion never count as D30 native proof.
        self.command('ql-scene-native-material-regression', ['cargo', 'test', '--locked', '-p', 'ql-mef', '--test', 'scene_instrument', '--', '--ignored', '--test-threads=1'], self.ql,
                     {**ql_env, 'QL_FIELD_WORKER': str(ql_target / 'release/ql-field-worker')}, timeout=600)
        installer_log = self.out / 'ql-source-install.log'
        with installer_log.open('wb') as log:
            for key in ('stdout_ref', 'stderr_ref'):
                with Path(installer[key]['path']).open('rb') as source:
                    shutil.copyfileobj(source, log, 1024 * 1024)
        binaries = [{ 'name': role, **file_ref(self.out / 'build/ql/release' / role)} for role in ROLES]
        ql_rows = self.source_rows(self.ql, self.args.expected_ql_head, [row['path'] for row in t['source_locks']])
        self.cut(self.ql, self.args.expected_ql_head)
        require(ql_rows == ql_rows_before, 'Source changed during native owner build')
        consumer_rows = self.source_rows(self.ql, self.args.expected_ql_head, consumer_paths)
        require(consumer_rows == consumer_rows_before, 'D30 native host/client/test source changed during build')
        native_manifest = {'schema': 'epi.source-built-hosted-native-cut/v1', 'product': 'quaternal-logic',
                           'custody': 'source-built-hosted', 'source_root': str(self.ql), 'source_cut': self.args.expected_ql_head,
                           'tree': self.report['source_cuts']['ql']['tree'], 'source_dirty': False,
                           'installer': {'argv': ['sh', 'scripts/oi-source-install.sh'], 'cwd': str(self.ql), 'exit': installer['exit'],
                                         'script_ref': file_ref(self.ql / 'scripts/oi-source-install.sh'), 'log_ref': file_ref(installer_log),
                                         'output_root': str(ql_target / 'release'), 'output_directory_was_absent': True,
                                         'prebuild_output_ref': file_ref(preflight_path),
                                         'environment': {key: ql_env[key] for key in ('CARGO_TARGET_DIR', 'RUSTC', 'CC', 'CXX', 'PATH')},
                                         'shell_ref': file_ref(Path(shutil.which('sh')).resolve(strict=True))},
                           'toolchain': toolchain, 'toolchain_resolution': toolchain_resolution, 'toolchain_cwd': str(self.out),
                           'all_five': binaries, 'source': ql_rows,
                           'source_succession': {'schema': 'epi.native-source-succession-build-custody/v1',
                               'record_ref': succession_ref, 'consumer_sources': consumer_rows}}
        manifest_path = self.out / 'source-built-ql-cut.json'
        save(manifest_path, native_manifest)
        self.report['ql_native_cut'] = file_ref(manifest_path)
        # Source predictions were fixed before build; actual all-five output custody
        # is now qualified before any native world request. Configured real-worker
        # regression execution above remains a separate native test receipt.
        expectation = self.out / 'expectation-before-native.json'
        self.command('source-expectation', ['node', self.repo / 'desktop/cradle/tests/build-portable-expectation.mjs',
                     '--template', template, '--fixture-root', fixture, '--current-manifest', manifest_path, '--output', expectation], self.repo)
        prepared = read_json(expectation)
        require(prepared['schema'] == 'epi.native-world-source-expectation/v3'
                and prepared['current_custody']['kind'] == 'source-built-hosted'
                and prepared['historical_custody']['kind'] == 'historical-independently-verified', 'Explicit current/historical custody required')
        self.report['expectation_before_native'] = file_ref(expectation)
        current_guards = self.out / 'actual-current-manifest-artifact-guards.json'
        self.command('actual-current-manifest-artifact-guards', ['node', self.repo / 'desktop/cradle/tests/current-manifest-artifact-guards.mjs',
                     expectation, current_guards], self.repo, timeout=180)
        guards = read_json(current_guards)
        require(guards['schema'] == 'epi.portable-current-manifest-artifact-guards/v3' and guards['passed'] is True
                and guards['negative_count'] == 13 and guards['actual_expectation'] == file_ref(expectation),
                'Actual current built-manifest negative custody gates must execute before first native request')
        self.report['actual_current_manifest_guards'] = file_ref(current_guards)
        oi_cli_env = {**self.env, 'CARGO_TARGET_DIR': str(self.out / 'build/oi-cli')}
        kernel_env = {**self.env, 'CARGO_TARGET_DIR': str(self.out / 'build/oi-kernel')}
        central_env = {**self.env, 'CARGO_TARGET_DIR': str(self.out / 'build/central')}
        aikit_env = {**self.env, 'CARGO_TARGET_DIR': str(self.out / 'build/aikit')}
        self.command('oi-cli-build', ['cargo', 'build', '--locked', '--manifest-path', self.repo / 'cli/Cargo.toml', '--bin', 'oi'], self.repo, oi_cli_env)
        self.command('oi-kernel-build', ['cargo', 'build', '--locked', '--manifest-path', self.repo / 'desktop/cradle/kernel/Cargo.toml', '--bin', 'walk-bridge'], self.repo, kernel_env)
        self.command('central-build', ['cargo', 'build', '--locked', '--manifest-path', self.central / 'Cargo.toml', '-p', 'ctrl'], self.central, central_env)
        self.command('aikit-build', ['cargo', 'build', '--locked', '--manifest-path', self.aikit / 'Cargo.toml', '--bin', 'aikit'], self.aikit, aikit_env)
        aikit = str(self.out / 'build/aikit/debug/aikit')
        self.command('aikit-version', [aikit, '--version'], self.out, timeout=30)
        self.bridge = str(self.out / 'build/oi-kernel/debug/walk-bridge')
        oi = str(self.out / 'build/oi-cli/debug/oi')
        ctrl = str(self.out / 'build/central/debug/ctrl')
        self.report['host_owners'] = {'oi': file_ref(oi), 'bridge': file_ref(self.bridge), 'central': file_ref(ctrl), 'aikit': file_ref(aikit)}
        qualified_native = self.out / 'qualified-native'
        qualified_native.mkdir()
        preserved = []
        for role, original in [(row['name'], row) for row in binaries] + [(name, self.report['host_owners'][key])
                for name, key in [('oi', 'oi'), ('walk-bridge', 'bridge'), ('ctrl', 'central'), ('aikit', 'aikit')]]:
            destination = qualified_native / role
            with Path(original['path']).open('rb') as source, destination.open('xb') as target:
                shutil.copyfileobj(source, target, 1024 * 1024)
            destination.chmod(0o755)
            copied = file_ref(destination)
            require(copied['sha256'] == original['sha256'] and copied['bytes'] == original['bytes'], 'Qualified native copy differs: ' + role)
            preserved.append({'name': role, 'qualified_owner_output': original, 'artifact_copy': copied})
        save(qualified_native / 'digest-manifest.json', {'schema': 'epi.hosted-qualified-native-artifact-copies/v1',
             'custody': 'source-built-hosted', 'scope': 'Exact nine current source-built owner images, including the actual AIKit context owner; no original Mac images or Rust build tree',
             'source_cuts': self.report['source_cuts'], 'images': preserved})
        self.report['qualified_native_artifact_copies'] = file_ref(qualified_native / 'digest-manifest.json')
        by_role = {row['name']: row for row in binaries}
        self.owned.expected = {k: by_role[k] for k in ('ql', 'ql-field-host', 'ql-field-worker', 'ql-focused-host')}
        self.owned.expected['walk-bridge'] = self.report['host_owners']['bridge']
        self.owned.expected['aikit'] = self.report['host_owners']['aikit']
        self.world = self.out / 'world'
        self.env.update({'OI_BIN': oi, 'OI_HOME': str(self.out / 'oi-home'), 'OI_DATA_HOME': str(self.out / 'oi-data'),
                         'OI_CENTRAL_ROOT': str(self.world), 'OI_CENTRAL_CTRL_BIN': ctrl, 'OI_AIKIT_BIN': aikit,
                         'OI_CENTRAL_PROJECT_QUERY': 'controlled-no-project', 'OI_CRADLE_STATE': str(self.out / 'cradle-state.json'),
                         'OI_EXPRESSION_SOCKET': str(self.out / 'expression.sock'),
                         'QL_NARA_PROVIDER_CACHE': str(self.out / 'nara-provider-cache'),
                         'OI_QL_BIN': by_role['ql']['path'], 'OI_QL_SKY_BIN': by_role['ql-sky']['path'],
                         'OI_QL_FIELD_HOST_BIN': by_role['ql-field-host']['path'], 'OI_QL_FIELD_WORKER_BIN': by_role['ql-field-worker']['path']})
        self.report['owned_environment'] = {key: self.env[key] for key in ('OI_BIN', 'OI_HOME', 'OI_DATA_HOME', 'AIKIT_HOME', 'OI_AIKIT_BIN', 'OI_CENTRAL_ROOT',
            'OI_CENTRAL_CTRL_BIN', 'OI_CENTRAL_PROJECT_QUERY', 'OI_CRADLE_STATE', 'OI_EXPRESSION_SOCKET', 'QL_NARA_PROVIDER_CACHE',
            'OI_QL_BIN', 'OI_QL_SKY_BIN', 'OI_QL_FIELD_HOST_BIN', 'OI_QL_FIELD_WORKER_BIN', 'QL_NARA_UV', 'XDG_CACHE_HOME', 'UV_CACHE_DIR')}
        self.report['owned_environment']['PLAYWRIGHT_BROWSERS_PATH'] = self.env.get('PLAYWRIGHT_BROWSERS_PATH')
        self.command('central-controlled-init', [ctrl, '--json', '--root', self.world, 'init'], self.out, timeout=120)
        require(self.world.is_dir(), 'Actual Central init did not create the owned world')
        first = self.start_bridge('selection-setup')
        acknowledged = []
        for index, relative in enumerate(fm['identity_files']):
            historical = read_json(fixture / relative)
            require(historical['reading']['person_ref'] == PERSONS[index], 'Only the exact controlled A/B identities may be inputs')
            profile = historical['reading']['profile']
            require(profile['person_ref'] == PERSONS[index] and all(profile[k] is None for k in ('gene_keys', 'human_design', 'jungian', 'quintessence')),
                    'No owner identity or imported private report permitted')
            outcome = self.op(f'identity-{index}-save', {'op': 'nara_identity', 'request': {
                'operation': 'save', 'profile': profile, 'source_ref': None, 'expected_revision': None}})
            require(outcome['result'] == 'nara_identity', 'Actual identity owner save required')
            created = outcome['data']
            require(created['source'] == historical['source'], 'Exact original identity source/ref/revision changed')
            opened = self.op(f'identity-{index}-open', {'op': 'nara_identity', 'request': {
                'operation': 'open', 'source_ref': created['source']['source_ref']}})['data']
            require(opened['source'] == created['source'] and opened['reading']['profile'] == profile
                    and opened['reading']['input_revision'] == historical['reading']['input_revision']
                    and opened['reading']['person_ref'] == PERSONS[index], 'Real identity reopen differs from the exact historical basis')
            target = self.out / f'identity-{index}.json'
            save(target, {'source': opened['source'], 'reading': opened['reading']})
            acknowledged.append(str(target))
        doc_fixture = fm['controlled_document']
        relative = doc_fixture['ordinary_relative_path']
        require(relative.startswith('Work/O-I/desktop/cradle/material/expressive-material/expression/')
                and '..' not in PurePosixPath(relative).parts, 'Controlled material path escaped ordinary production location')
        target = self.world / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        # Declared fixture import only; subsequent production saves execute natively.
        with (fixture / doc_fixture['path']).open('rb') as source, target.open('xb') as destination:
            shutil.copyfileobj(source, destination, 1024 * 1024)
        reading, document = self.file_admission(relative, 'imported131')
        require(hashlib.sha256(reading['content'].encode()).hexdigest() == doc_fixture['sha256']
                and len(reading['content'].encode()) == doc_fixture['bytes'], 'Actual native imported storage differs')
        require(document['expression_ref'] == doc_fixture['expression_ref'] and document['revision'] == 131
                and [len(scene['entity_refs']) for scene in document['scenes']] == [32, 9, 7], 'Native owner did not decode the complete original131 composition')
        self.report['imported_prior_save'] = {'standing': 'Declared exact historical fixture import, not a claimed native save',
                                             'file': {'location': reading['location'], 'revision': reading['revision']},
                                             'document_ref': document['expression_ref'], 'document_revision': document['revision']}
        reading, document = self.adopt_current_controlled_profile(relative, reading, document)
        entry = self.repo / 'desktop/cradle/expressions-app/field-studies-journeys/public/index.html'
        require(entry.is_file(), 'Build the actual production journey application before this driver')
        self.report['production_entry'] = file_ref(entry)
        common = {'app_entry': str(entry), 'identity_files': acknowledged, 'native_owner_expectation_file': str(expectation),
                  'original_owner_world_file': str(fixture / fm['original_world']), 'pause_for_review_ms': 1000,
                  'consumer_replays': True, 'binaries': {'quaternal_logic': {'source_cut': self.args.expected_ql_head,
                    'custody': 'source-built-hosted', 'manifest': file_ref(manifest_path)},
                    'oi': {'source_cut': self.args.expected_oi_head}, 'central': {'source_cut': self.args.expected_central_head}}}
        # These source/selection cases are admission tests, not a shortened
        # whole proof. The first real ordinary open may acknowledge current
        # caption/personal refs through the unchanged producer. Preserve both
        # complete native documents, then fence the resulting durable basis.
        selection_deadline = time.monotonic() + 1500
        self.selection_source_expectation_ref = file_ref(expectation)
        self.selection_original_world_ref = file_ref(fixture / fm['original_world'])
        setup_custody = self.selected_custody(first, document, acknowledged, oi_sources, manifest_path)
        setup = self.selected_stage('selected-conversation-setup', {**common, 'reopen_file': relative,
                                    'stage': 'selected-conversation-setup'}, setup_custody, selection_deadline)
        setup_reading, setup_document = self.file_admission(relative, 'after-ordinary-selection-setup')
        baseline_ref = setup['selection_admission_ref']
        baseline = read_json(baseline_ref['path'])
        require(file_ref(baseline_ref['path']) == baseline_ref
                and baseline['schema'] == 'epi.hosted-native-selected-admission/v1'
                and baseline['document'] == setup_document
                and baseline['file'] == {'location': setup_reading['location'], 'revision': setup_reading['revision'],
                                         'expression_ref': setup_document['expression_ref'],
                                         'document_revision': setup_document['revision']}
                and baseline['content_sha256'] == hashlib.sha256(setup_reading['content'].encode()).hexdigest()
                and baseline['content_bytes'] == len(setup_reading['content'].encode()),
                'The selection baseline must be the full actual ordinary-admission native save/readback')
        save(self.out / 'selected-ordinary-admission-before-after.json', {
            'schema': 'epi.hosted-native-selection-ordinary-admission/v1',
            'before_document': document, 'after_document': setup_document,
            'before_file': {'location': reading['location'], 'revision': reading['revision']},
            'after_file': baseline['file'], 'after_acknowledgement_ref': baseline_ref,
            'scope': 'Actual current producer admission, including recorded native migrations; these before/after documents are not claimed equal'})
        self.report['selected_conversation']['ordinary_admission_ref'] = file_ref(self.out / 'selected-ordinary-admission-before-after.json')
        self.report['selected_conversation']['baseline_ref'] = baseline_ref
        current_custody_ref = self.qualify_current_checkpoint(setup_document, by_role['ql'], kernel_env, selection_deadline)
        self.stop_bridge()
        original_env = dict(self.env)
        try:
            for selection_case in ('positive', 'native-refusal', 'native-changed', 'local-changed',
                                   'navigation-choose-positive', 'navigation-return-positive',
                                   'navigation-native-refusal', 'navigation-local-changed',
                                   'required-cosmic-body-disabled'):
                name = 'selected-conversation-' + selection_case
                case_root = self.out / (name + '-owner')
                require(not case_root.exists(), 'Each selection case needs a fresh owned owner location')
                case_root.mkdir()
                # The controlled Central identity/material and owned AIKit
                # source-context ground remain the same. Native OI state,
                # pending selection, socket and browser are case-local; no
                # provider/body/session/answer is acquired or substituted.
                self.env.update({'OI_HOME': str(case_root / 'oi-home'), 'OI_DATA_HOME': str(case_root / 'oi-data'),
                                 'OI_CRADLE_STATE': str(case_root / 'cradle-state.json'),
                                 'OI_EXPRESSION_SOCKET': str(case_root / 'expression.sock')})
                self.transfer_current_checkpoint(current_custody_ref, self.env['OI_HOME'], name)
                owner = self.start_bridge(name)
                require(all(owner['native_generation'] != prior['native_generation']
                            and (owner['pid'], owner['starttime']) != (prior['pid'], prior['starttime'])
                            for prior in self.report['phases'][:-1]),
                        'Each case requires an actually fresh native owner lifetime')
                prior_reading, prior_document = self.file_admission(relative, name + '-before', baseline['file']['revision'])
                require(prior_reading['content'] == setup_reading['content'] and prior_document == setup_document,
                        'A prior selection case changed the independent durable setup basis')
                custody = self.selected_custody(owner, setup_document, acknowledged, oi_sources, manifest_path, baseline_ref, current_custody_ref)
                case = self.selected_stage(name, {**common, 'reopen_file': relative, 'stage': 'selected-conversation-case',
                                           'selection_case': selection_case}, custody, selection_deadline)
                selected_path = case['selected_case_ref']['path']
                require(file_ref(selected_path) == case['selected_case_ref'], 'Exact actual selected-case receipt changed')
                selected = read_json(selected_path, 2 * 1024 * 1024)
                require(selected['schema'] == 'oi.epi-selected-conversation-native-gate/v1'
                        and selected['selection_case'] == selection_case and selected['passed'] is True
                        and 'failure' not in selected and len(selected['durable_conservation']) == 2,
                        'Every original selection case must execute with before/after complete durable conservation')
                after_reading, after_document = self.file_admission(relative, name + '-after', baseline['file']['revision'])
                require(after_reading['content'] == setup_reading['content'] and after_document == setup_document,
                        'An actual refused/pending selection altered the complete native saved world')
                observed = self.owned.evidence()
                require(not observed['errors'] and any(row.get('loaded_native_role') == 'walk-bridge'
                        and row['root_pid'] == owner['pid'] and row['root_starttime'] == owner['starttime']
                        and row['actual_image']['sha256'] == owner['bridge']['sha256'] for row in observed['records']),
                        'Each case requires independently observed actual owned bridge image custody')
                self.stop_bridge()
        finally:
            # Leave refused/pending state in its terminated private owner;
            # never rollback or clean it into the original whole lifetime.
            self.stop_bridge()
            self.env = original_env
        require(len(self.report['selected_conversation']['stages']) == 10,
                'Setup, all four original Ask cases, four ordinary navigation cases and actual required-body counterproof are mandatory')
        self.report['selected_conversation']['passed'] = True
        self.report['selected_conversation']['elapsed_seconds'] = 1500 - (selection_deadline - time.monotonic())
        first = self.start_bridge('whole')
        require(all(first['native_generation'] != phase['native_generation']
                and (first['pid'], first['starttime']) != (phase['pid'], phase['starttime'])
                for phase in self.report['phases'][:-1]), 'The original whole must start in a separate fresh native owner')
        reading, document = self.file_admission(relative, 'before-original-whole-after-selection', baseline['file']['revision'])
        require(reading['content'] == setup_reading['content'] and document == setup_document,
                'The original whole must receive the exact complete independently acknowledged setup basis')
        whole = self.driver('whole-production', {**common, 'reopen_file': relative})
        for name in ('personal_modal', 'personal_release', 'personal_cold_draft'):
            require(whole.get(name, {}).get('passed') is True, 'Full production driver omitted required personal gate: ' + name)
        require(whole.get('consumer_replays') is not None, 'Actual receiving discrimination cannot be skipped')
        require(whole.get('scene_damping', {}).get('passed') is True, 'D30 actual Scene/native material gate cannot be skipped')
        require(whole.get('scene_axes', {}).get('passed') is True, 'Ordinary native independent-axis/private-form gate cannot be skipped')
        observed = self.owned.evidence()
        require(not observed['errors'], 'Actual owned process observation failed')
        for role in ('ql-field-host', 'ql-field-worker'):
            require(any(row.get('loaded_native_role') == role and row['root_pid'] == first['pid'] and row['root_starttime'] == first['starttime']
                        for row in observed['records']), 'Actual leased process image was not observed: ' + role)
        continuation = whole['continuation']
        require(continuation['person_ref'] == PERSONS[0] and continuation['expression_ref'] == document['expression_ref'],
                'Restart must continue the acknowledged A instance')
        current_reading, current_doc = self.file_admission(relative, 'before-process-restart', continuation['file']['revision'])
        require(current_reading['location'] == continuation['file']['location'], 'Restart cannot substitute another file')
        selection = current_doc['selection']
        require(selection['entity_ref'] == continuation['entity_ref'] and selection['scene_ref'] == continuation['scene_ref'],
                'Restart must use actual acknowledged saved selection')
        expected = {key: continuation[key] for key in ('expression_ref', 'event_ref', 'person_ref', 'scene_ref', 'entity_ref')}
        prior_saved_file_path = self.out / 'whole-production/m3-axis-final-current-continuation-file.json'
        prior_saved_file = read_json(prior_saved_file_path)
        require(current_doc == prior_saved_file['document']
                and hashlib.sha256(current_reading['content'].encode()).hexdigest() == prior_saved_file['content_sha256']
                and current_reading['revision'] == prior_saved_file['revision']
                and current_reading['location'] == prior_saved_file['location'],
                'Latest actual save/native file read/inspect must agree on full durable Document, content and CAS fence')
        acknowledgement_path = self.out / 'acknowledged-saved-a-before-restart.json'
        acknowledgement = {'schema': 'epi.hosted-native-saved-continuation/v1',
                           'prior_full_receipt_ref': self.report['whole-production'],
                           'prior_saved_file_ref': file_ref(prior_saved_file_path),
                           'prior_native_generation': first['native_generation'],
                           'file': {'location': current_reading['location'], 'revision': current_reading['revision']},
                           'document': current_doc, 'expected': expected,
                           'source_evidence_refs': [row['evidence_ref'] for row in self.report['operations']
                               if row.get('name', '').startswith('before-process-restart-')],
                           'standing': 'Actual prior native save/file read/inspect; expected durable state before restarted requests'}
        save(acknowledgement_path, acknowledgement)
        self.report['restart_basis'] = {'file': acknowledgement['file'], 'document_revision': current_doc['revision'],
                                       'expected': expected, 'acknowledgement_ref': file_ref(acknowledgement_path)}
        self.stop_bridge()
        second = self.start_bridge('restart')
        require((first['pid'], first['starttime']) != (second['pid'], second['starttime'])
                and first['native_generation'] != second['native_generation'], 'Restart requires a genuinely new owned process/native generation')
        reopened_reading, reopened_doc = self.file_admission(relative, 'after-process-restart', current_reading['revision'])
        require(reopened_reading['content'] == current_reading['content'] and reopened_doc == current_doc,
                'Fresh kernel native file admission changed acknowledged saved material')
        reopened = self.driver('fresh-process-entry', {**common, 'reopen_file': relative, 'stage': 'entry', 'reopen_expected': expected,
                    'reopen_acknowledgement_file': str(acknowledgement_path),
                    'reopen_acknowledgement_sha256': file_ref(acknowledgement_path)['sha256'],
                    'reopen_prior_native_generation': first['native_generation']})
        require(reopened.get('reopen_expected') == expected, 'Fresh browser did not execute exact saved continuation gate')
        require(reopened.get('scene_damping_restart', {}).get('passed') is True, 'Fresh owned-kernel/browser material receiving gate cannot be skipped')
        require(reopened.get('scene_axes_restart', {}).get('passed') is True, 'Fresh owned-kernel/browser must consume the exact independently acknowledged saved continuous axes')
        self.stop_bridge()
        self.owned.evidence()
        for before in binaries:
            after = file_ref(before['path'])
            require(after['sha256'] == before['sha256'] and after['bytes'] == before['bytes'], 'Native companion changed during whole receiving')
        require(file_ref(expectation) == self.report['expectation_before_native'], 'Predictions changed after native replies')
        require(file_ref(entry) == self.report['production_entry'], 'Production entry changed during receiving')
        self.report['source_recheck'] = {
            'ql': self.cut(self.ql, self.args.expected_ql_head), 'oi': self.cut(self.repo, self.args.expected_oi_head),
            'central': self.cut(self.central, self.args.expected_central_head),
            'aikit': self.cut(self.aikit, self.args.expected_aikit_head),
            'aikit_image_unchanged': file_ref(aikit) == self.report['host_owners']['aikit'],
            'oi_source_unchanged': self.source_rows(self.repo, self.args.expected_oi_head, OI_SCOPE) == oi_sources,
            'ql_source_unchanged': self.source_rows(self.ql, self.args.expected_ql_head, [row['path'] for row in ql_rows]) == ql_rows,
            'ql_succession_consumers_unchanged': self.source_rows(self.ql, self.args.expected_ql_head, consumer_paths) == consumer_rows}
        require(self.report['source_recheck']['oi_source_unchanged'] and self.report['source_recheck']['ql_source_unchanged'] and self.report['source_recheck']['ql_succession_consumers_unchanged'] and self.report['source_recheck']['aikit_image_unchanged'], 'Qualified source changed during native receiving')
        self.report['passed'] = True
        self.report['standing'] = 'Executed strict whole production and separate owned-kernel/fresh-browser entry in one source-built hosted Linux environment; managed installed Mac/H remain separate'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('repo', 'ql-source', 'central-source', 'aikit-source', 'expected-oi-head', 'expected-ql-head', 'expected-central-head', 'expected-aikit-head',
                 'fixture-archive', 'fixture-sha256', 'source-expectation-template', 'uv', 'output'):
        parser.add_argument('--' + name, required=True)
    args = parser.parse_args()
    replay = Replay(args)
    def interrupted(signum, frame):
        raise InterruptedError('Owned hosted replay interrupted by signal ' + str(signum))
    signal.signal(signal.SIGTERM, interrupted)
    signal.signal(signal.SIGINT, interrupted)
    try:
        replay.run()
    except BaseException as error:
        replay.report['passed'] = False
        replay.report['failure'] = repr(error)
    finally:
        try:
            replay.stop_bridge()
            replay.owned.evidence()
            replay.owned.close()
        except BaseException as error:
            replay.report['passed'] = False
            replay.report['cleanup_failure'] = repr(error)
        save(replay.out / 'receipt.json', replay.report)
    require(replay.report['passed'], replay.report.get('failure', replay.report.get('cleanup_failure', 'Hosted replay failed')))


if __name__ == '__main__':
    main()
