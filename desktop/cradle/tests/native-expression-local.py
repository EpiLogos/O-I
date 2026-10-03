#!/usr/bin/env python3
"""Opt-in, isolated local acceptance for #419. No install, merge or machine repair.

Default: read-only source/binary/machine preflight, exit 2 (runtime proof pending).
--run-browser-join: execute the repository's real-native browser test in its own
namespace. This is not the installed WKWebView, audible speaker or Nara voice proof.
"""
import argparse
import ctypes
import hashlib
import json
import math
import os
from pathlib import Path
import platform
import shutil
import signal
import subprocess
import sys
import time


def run(args, cwd=None, timeout=30):
    p = subprocess.run(args, cwd=cwd, text=True, capture_output=True, timeout=timeout)
    return {"argv": args, "code": p.returncode, "stdout": p.stdout, "stderr": p.stderr}


def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as source:
        for block in iter(lambda: source.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()



def group_readback(group):
    """Observe group membership without releasing or signalling its owner."""
    try:
        if sys.platform == 'darwin':
            # Darwin can return EPERM for a retired group. Membership is an
            # independent native observation, never an inference from EPERM.
            native = ctypes.CDLL('/usr/lib/libproc.dylib', use_errno=True)
            native.proc_listpgrppids.argtypes = [ctypes.c_int, ctypes.c_void_p, ctypes.c_int]
            native.proc_listpgrppids.restype = ctypes.c_int
            members = (ctypes.c_int * 16384)()
            ctypes.set_errno(0)
            count = native.proc_listpgrppids(group, members, ctypes.sizeof(members))
            error = ctypes.get_errno()
            return {'absent': count == 0 and error == 0, 'basis': 'native proc_listpgrppids',
                    'count': count, 'errno': error,
                    'members': list(members[:count]) if 0 < count < len(members) else []}
        os.killpg(group, 0)
        return {'absent': False, 'basis': 'killpg group exists'}
    except ProcessLookupError:
        return {'absent': True, 'basis': 'killpg ESRCH'}
    except (OSError, AttributeError) as error:
        return {'absent': False, 'basis': 'group observation unavailable',
                'errno': getattr(error, 'errno', None), 'error': str(error)}


def run_isolated(args, *, cwd, env, stdout, timeout=180, cleanup=None):
    """Reap this opt-in test's owned group; preserve its unreaped PID fence.

    Temporary handlers belong only to this command. Native membership must
    qualify retirement independently; neither EPERM nor leader exit is absence.
    """
    process = None
    if not hasattr(os, 'waitid') or not hasattr(os, 'WNOWAIT'):
        raise RuntimeError('Isolated native acceptance requires unreaped-leader observation on this platform')
    previous = {sig: signal.getsignal(sig) for sig in (signal.SIGINT, signal.SIGTERM)}

    def interrupted(signum, _frame):
        raise KeyboardInterrupt(f'Isolated acceptance interrupted by signal {signum}')

    try:
        for sig in previous:
            signal.signal(sig, interrupted)
        process = subprocess.Popen(args, cwd=cwd, env=env, stdout=stdout,
                                   stderr=subprocess.STDOUT, start_new_session=True)
        deadline = time.monotonic() + timeout
        while True:
            observed = os.waitid(os.P_PID, process.pid, os.WEXITED | os.WNOHANG | os.WNOWAIT)
            if observed is not None:
                return observed.si_status if observed.si_code == os.CLD_EXITED else -observed.si_status
            if time.monotonic() >= deadline:
                raise RuntimeError('Isolated browser acceptance timed out')
            time.sleep(.005)
    finally:
        # A second interruption must not skip bounded cleanup or handler restore.
        for sig in previous:
            signal.signal(sig, signal.SIG_IGN)
        try:
            if process is not None:
                reading = {'owned_pid_and_pgid': process.pid,
                           'leader_kept_unreaped_until_group_signal': True}
                try:
                    observed = os.waitid(os.P_PID, process.pid, os.WEXITED | os.WNOHANG | os.WNOWAIT)
                    exited = observed is not None and observed.si_pid == process.pid
                    group = group_readback(process.pid)
                    reading['group_before_final_wait'] = group
                    only_exited_leader = exited and group.get('members') == [process.pid]
                    reading['only_exited_leader_before_final_wait'] = only_exited_leader
                    if group['absent']:
                        reading['owned_group_absent_before_reap'] = True
                    elif not only_exited_leader:
                        try:
                            os.killpg(process.pid, signal.SIGKILL)
                            reading['owned_group_signalled'] = 'SIGKILL'
                        except ProcessLookupError:
                            reading['owned_group_absent_before_reap'] = True
                        except OSError as error:
                            reading['group_signal_error'] = {'errno': error.errno, 'error': str(error)}
                finally:
                    # Reap even if native membership or group signalling failed.
                    try:
                        reading['leader_exit_code'] = process.wait(timeout=1)
                        reading['owned_leader_reaped'] = True
                    except subprocess.TimeoutExpired as error:
                        reading['owned_leader_reaped'] = False
                        reading['cleanup_unknown'] = 'The owned leader did not exit within one second'
                        raise RuntimeError(reading['cleanup_unknown']) from error
                    finally:
                        if cleanup is not None:
                            cleanup.update(reading)
                # Read-only after wait: never signal a reused numeric group.
                deadline = time.monotonic() + .5
                while True:
                    group = group_readback(process.pid)
                    reading['group_readback'] = group
                    reading['owned_group_absent_at_readback'] = group['absent']
                    if group['absent'] or time.monotonic() >= deadline:
                        break
                    time.sleep(.005)
                if not group['absent']:
                    reading['cleanup_unknown'] = 'Owned group disappearance was not observed after retirement and leader reap'
                if cleanup is not None:
                    cleanup.update(reading)
        finally:
            for sig, handler in previous.items():
                signal.signal(sig, handler)


def verify_joined_receipt(path, files, owners=None):
    """Bind a successful child result to its complete, exact input/binary record.

    This validates the result of the behavioural test; it is not independent
    acceptance or installed-device proof. Never infer success from exit zero.
    """
    limit = 16 * 1024 * 1024
    if path.is_symlink() or not path.is_file():
        raise ValueError('Browser acceptance receipt is missing or not a regular file')
    with path.open('rb') as source:
        raw = source.read(limit + 1)
    if len(raw) > limit:
        raise ValueError('Browser acceptance receipt exceeds the 16 MiB evidence bound')

    def unique_object(pairs):
        value = {}
        for key, item in pairs:
            if key in value:
                raise ValueError('Duplicate key in browser acceptance receipt: ' + key)
            value[key] = item
        return value

    def invalid_constant(value):
        raise ValueError('Nonfinite value in browser acceptance receipt: ' + value)

    def finite_float(value):
        result = float(value)
        if not math.isfinite(result):
            raise ValueError('Overflowed number in browser acceptance receipt: ' + value)
        return result

    reading = json.loads(raw, object_pairs_hook=unique_object,
                         parse_constant=invalid_constant, parse_float=finite_float)
    if not isinstance(reading, dict) or reading.get('schema') != 'oi.native-expression-joined-browser/v1':
        raise ValueError('Unsupported browser acceptance receipt schema')
    if reading.get('pass') is not True or 'failure' in reading:
        raise ValueError('Browser receipt does not report unambiguous success')
    checks = reading.get('checks')
    if not isinstance(checks, list) or not checks or any(not isinstance(c, str) or not c.strip() for c in checks):
        raise ValueError('Browser acceptance receipt omits its executed checks')
    requests = reading.get('requests', {})
    if not isinstance(requests, dict) or any(type(requests.get(k)) is not int or requests[k] != 1 for k in ('opens', 'closes')):
        raise ValueError('Browser acceptance did not complete one native open and close')
    if set(files) != {'host', 'worker', 'bridge', 'input'} or reading.get('sources') != files:
        raise ValueError('Browser receipt uses different native binaries or coupled input')
    for name, record in files.items():
        if digest(Path(record['path'])) != record['sha256']:
            raise ValueError(name + ' changed during browser acceptance')
    if owners is not None:
        if reading.get('native_owners') != owners:
            raise ValueError('Browser receipt uses different native Central/suite owners')
        for name, record in owners.items():
            if digest(Path(record['path'])) != record['sha256']:
                raise ValueError(name + ' owner changed during browser acceptance')
    return {'path': str(path), 'sha256': hashlib.sha256(raw).hexdigest(),
            'schema': reading['schema'], 'checks': len(checks),
            'standing': 'child behavioural result verified; not independent or installed acceptance'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--expected-head', required=True)
    parser.add_argument('--host', type=Path, required=True)
    parser.add_argument('--worker', type=Path, required=True)
    parser.add_argument('--bridge', type=Path, required=True)
    parser.add_argument('--input', type=Path, required=True, help='Explicit coupled input; may be private. Never uploaded.')
    parser.add_argument('--output', type=Path, required=True, help='New private evidence directory; must not exist')
    parser.add_argument('--run-browser-join', action='store_true')
    parser.add_argument('--hardware-gpu', action='store_true', help='Request default GPU rather than SwiftShader; actual device is recorded')
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[3]
    args.output.mkdir(mode=0o700, parents=False, exist_ok=False)
    report = {'schema': 'oi.native-expression-local/v1', 'status': 'pending', 'checks': {}, 'machine': {'system': platform.system(), 'release': platform.release(), 'machine': platform.machine()}, 'claims': {'installed_app': False, 'native_wkwebview': False, 'audible_speakers': False, 'microphone': False, 'real_model_provider': False, 'human_acceptance': False}}
    code = 2
    try:
        head = run(['git', 'rev-parse', 'HEAD'], root)
        report['checks']['head'] = head
        if head['code'] or head['stdout'].strip() != args.expected_head:
            raise ValueError('Source head differs from the explicitly selected candidate')
        dirty = run(['git', 'status', '--porcelain', '--untracked-files=no'], root)
        report['checks']['working_copy'] = dirty
        if dirty['code'] or dirty['stdout'].strip():
            raise ValueError('Tracked modifications require a separately recorded source cut; no reset performed')
        report['files'] = {}
        for name in ['host', 'worker', 'bridge', 'input']:
            path = getattr(args, name)
            if not path.is_absolute() or not path.is_file():
                raise ValueError(name + ' requires an explicit absolute existing file')
            if name != 'input' and not os.access(path, os.X_OK):
                raise ValueError(name + ' is not executable')
            report['files'][name] = {'path': str(path), 'sha256': digest(path)}
        data = json.loads(args.input.read_text())
        if not all(key in data for key in ['basis', 'field']):
            raise ValueError('Input must be the complete native coupled basis + field, not a renderer preset')
        if platform.system() == 'Darwin':
            report['checks']['mac_version'] = run(['/usr/bin/sw_vers'])
            report['checks']['mac_audio_display_inventory'] = run(['/usr/sbin/system_profiler', 'SPAudioDataType', 'SPDisplaysDataType', '-json'], timeout=90)
        node = shutil.which('node')
        if not node:
            raise ValueError('Node is unavailable; no runtime was installed')
        report['checks']['node'] = run([node, '--version'])
        if args.run_browser_join:
            owners = {}
            for name, binding in [('suite', 'OI_BIN'), ('central', 'OI_CENTRAL_CTRL_BIN')]:
                path = Path(os.environ.get(binding, ''))
                if not path.is_absolute() or not path.is_file() or not os.access(path, os.X_OK):
                    raise ValueError(binding + ' requires its explicit absolute built native owner')
                owners[name] = {'path': str(path), 'sha256': digest(path)}
            report['native_owners'] = owners
            env = dict(os.environ, NATIVE_EXPRESSION_BRIDGE=str(args.bridge), OI_QL_FIELD_HOST_BIN=str(args.host), OI_QL_FIELD_WORKER_BIN=str(args.worker), NATIVE_EXPRESSION_INPUT=str(args.input), NATIVE_EXPRESSION_OUT=str(args.output.resolve() / 'browser'), NATIVE_EXPRESSION_GPU='hardware' if args.hardware_gpu else 'software')
            with (args.output / 'browser-run.log').open('w') as log:
                cleanup = {}
                report['checks']['owned_browser_cleanup'] = cleanup
                returncode = run_isolated([node, 'tests/native-expression-native-browser.mjs'],
                                          cwd=root / 'desktop/cradle', env=env, stdout=log, cleanup=cleanup)
            report['checks']['browser_process'] = {'code': returncode}
            if cleanup.get('cleanup_unknown'):
                raise ValueError(cleanup['cleanup_unknown'])
            if returncode != 0:
                raise ValueError(f'Isolated browser acceptance exited with code {returncode}')
            report['checks']['browser_receipt'] = verify_joined_receipt(
                args.output / 'browser/joined.json', report['files'], owners)
            report['claims']['actual_native_central_disclosure'] = True
            # A valid result for a source changed while running is not this cut's proof.
            final_head = run(['git', 'rev-parse', 'HEAD'], root)
            final_dirty = run(['git', 'status', '--porcelain', '--untracked-files=no'], root)
            report['checks']['head_after'] = final_head
            report['checks']['working_copy_after'] = final_dirty
            if final_head['code'] or final_head['stdout'].strip() != args.expected_head or final_dirty['code'] or final_dirty['stdout'].strip():
                raise ValueError('Source changed during browser acceptance; result retained, not promoted')
            code = 0
            report['status'] = 'isolated-native-browser-passed'
        else:
            report['pending'] = 'Preflight only. --run-browser-join explicitly starts owned native/browser test processes. No install or device access occurred.'
    except KeyboardInterrupt as error:
        report['status'] = 'interrupted'
        report['error'] = str(error) or 'Acceptance interrupted'
        code = 130
    except Exception as error:
        report['status'] = 'failed'
        report['error'] = str(error)
        code = 1
    finally:
        (args.output / 'local-receipt.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({'status': report['status'], 'receipt': str(args.output / 'local-receipt.json'), 'exit': code}))
    return code


if __name__ == '__main__':
    sys.exit(main())
