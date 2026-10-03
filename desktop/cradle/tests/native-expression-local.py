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
import threading
import uuid


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


class _LinuxTestCgroup:
    """One explicit remote test subtree, pinned until native empty readback.

    The privileged supervisor owns control descriptors; only its pre-exec
    child enters, then drops to the explicitly supplied actual runner IDs.
    This does not authenticate a World or grant any product operation.
    """
    def __init__(self, specification, reading):
        if sys.platform != 'linux' or os.geteuid() != 0:
            raise PermissionError('Explicit Linux root test supervisor required for native cgroup custody')
        if threading.active_count() != 1:
            raise RuntimeError('Native cgroup pre-exec custody requires a single-threaded supervisor')
        if not isinstance(specification, dict) or set(specification) != {'root', 'uid', 'gid'}:
            raise ValueError('Native cgroup requires exactly root, uid and gid')
        self.uid, self.gid = specification['uid'], specification['gid']
        if any(type(value) is not int or value <= 0 for value in (self.uid, self.gid)):
            raise ValueError('Native cgroup child requires explicit nonroot runner UID/GID')
        root = Path(specification['root'])
        if not root.is_absolute() or root.resolve(strict=True) != root:
            raise ValueError('Native cgroup root must be an explicit canonical directory')
        self.reading = reading
        self.root_fd = self.leaf_fd = self.kill_fd = self.events_fd = None
        self.created = False
        self.name = 'oi-walk-' + uuid.uuid4().hex
        self.path = root/self.name
        self.reading.update({'schema': 'oi.native-test-cgroup/v1', 'name': self.name,
                            'path': str(self.path), 'child_uid': self.uid, 'child_gid': self.gid})
        try:
            flags = os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC
            self.root_fd = os.open(root, os.O_RDONLY | flags)
            magic = self._filesystem_magic(self.root_fd)
            self.reading['filesystem_magic'] = magic
            if magic != 0x63677270:
                raise RuntimeError('Native test custody requires the actual Linux cgroup v2 filesystem')
            os.mkdir(self.name, 0o700, dir_fd=self.root_fd)
            self.created = True
            self.leaf_fd = os.open(self.name, os.O_RDONLY | flags, dir_fd=self.root_fd)
            owned = os.fstat(self.leaf_fd)
            self.identity = (owned.st_dev, owned.st_ino)
            self.reading['directory_identity'] = {'device': owned.st_dev, 'inode': owned.st_ino}
            self.kill_fd = os.open('cgroup.kill', os.O_WRONLY | os.O_NOFOLLOW | os.O_CLOEXEC,
                                   dir_fd=self.leaf_fd)
            self.events_fd = os.open('cgroup.events', os.O_RDONLY | os.O_NOFOLLOW | os.O_CLOEXEC,
                                     dir_fd=self.leaf_fd)
            initial = self._events()
            self.reading['events_before_launch'] = initial
            if initial['populated'] != 0:
                raise RuntimeError('New native test cgroup was already populated; no product launched')
        except BaseException:
            # Construction may already own a leaf. Preserve retirement evidence
            # independently of the original admission/setup exception.
            try:
                self.retire()
            except BaseException as error:
                self.reading['cleanup_unknown'] = str(error)
            finally:
                try:
                    self.close_descriptors()
                except OSError as error:
                    self.reading['cleanup_unknown'] = str(error)
                except RuntimeError:
                    pass
            raise

    @staticmethod
    def _filesystem_magic(fd):
        native = ctypes.CDLL(None, use_errno=True)
        native.fstatfs.argtypes = [ctypes.c_int, ctypes.c_void_p]
        native.fstatfs.restype = ctypes.c_int
        # Linux's native statfs starts with f_type. This over-sized aligned
        # storage supports both native 32/64-bit layouts without an ABI struct.
        storage = (ctypes.c_long * 64)()
        if native.fstatfs(fd, ctypes.byref(storage)) != 0:
            error = ctypes.get_errno()
            raise OSError(error, os.strerror(error))
        return storage[0]

    def _events(self):
        os.lseek(self.events_fd, 0, os.SEEK_SET)
        raw = os.read(self.events_fd, 4097)
        if len(raw) > 4096:
            raise RuntimeError('Native cgroup event reading exceeded its finite bound')
        value = {}
        for line in raw.decode('ascii').splitlines():
            key, number = line.split()
            if key in value:
                raise RuntimeError('Native cgroup event reading contains duplicate keys')
            value[key] = int(number)
        if value.get('populated') not in (0, 1):
            raise RuntimeError('Native cgroup populated reading is unavailable')
        return value

    def prepare_child(self):
        owned = os.fstat(self.leaf_fd)
        if (owned.st_dev, owned.st_ino) != self.identity:
            raise RuntimeError('Native cgroup descriptor identity changed before child admission')
        fd = os.open('cgroup.procs', os.O_WRONLY | os.O_NOFOLLOW | os.O_CLOEXEC,
                     dir_fd=self.leaf_fd)
        try:
            entry = (str(os.getpid())+'\n').encode('ascii')
            if os.write(fd, entry) != len(entry):
                raise RuntimeError('Native child cgroup admission did not complete')
        finally:
            os.close(fd)
        with open('/proc/self/cgroup', 'r') as membership:
            rows = membership.read(4097)
        if len(rows) > 4096 or not any(row == '0::/'+self.name or row.endswith('/'+self.name)
                                     for row in rows.splitlines() if row.startswith('0::')):
            raise RuntimeError('Native child membership does not match its owned cgroup')
        os.close(self.leaf_fd)
        os.setgroups([])
        os.setresgid(self.gid, self.gid, self.gid)
        os.setresuid(self.uid, self.uid, self.uid)
        if os.getuid() != self.uid or os.geteuid() != self.uid or os.getgid() != self.gid or os.getegid() != self.gid:
            raise RuntimeError('Native child did not enter the actual runner identity')

    def retire(self):
        if not self.created:
            self.reading['owned_leaf_created'] = False
            return
        self.reading['owned_leaf_created'] = True
        if self.leaf_fd is None:
            raise RuntimeError('Native cgroup allocation has no pinned directory descriptor; retained for inspection')
        if self.events_fd is None:
            self.events_fd = os.open('cgroup.events', os.O_RDONLY | os.O_NOFOLLOW | os.O_CLOEXEC,
                                     dir_fd=self.leaf_fd)
        try:
            named = os.stat(self.name, dir_fd=self.root_fd, follow_symlinks=False)
            same = (named.st_dev, named.st_ino) == self.identity
        except OSError as error:
            same = False
            self.reading['name_observation_error'] = {'errno': error.errno, 'detail': str(error)}
        self.reading['same_directory_before_retirement'] = same
        # The kill FD remains attached to the actual owned subtree even if an
        # external privileged writer moved its name. Never signal by cached PID.
        failure = None
        try:
            if self.kill_fd is None:
                self.kill_fd = os.open('cgroup.kill', os.O_WRONLY | os.O_NOFOLLOW | os.O_CLOEXEC,
                                       dir_fd=self.leaf_fd)
            if os.write(self.kill_fd, b'1\n') != 2:
                raise RuntimeError('Native cgroup retirement write did not complete')
            self.reading['native_subtree_signalled'] = 'cgroup.kill'
        except (OSError, RuntimeError) as error:
            failure = error
            self.reading['native_signal_error'] = {'errno': getattr(error, 'errno', None), 'detail': str(error)}
        deadline = time.monotonic()+3
        while True:
            events = self._events()
            self.reading['events_after_retirement'] = events
            if events['populated'] == 0:
                break
            if time.monotonic() >= deadline:
                raise RuntimeError('Native cgroup empty-subtree readback did not complete within three seconds')
            time.sleep(.005)
        if not same:
            raise RuntimeError('Owned cgroup name no longer matches its pinned native directory; not removed')
        named = os.stat(self.name, dir_fd=self.root_fd, follow_symlinks=False)
        if (named.st_dev, named.st_ino) != self.identity:
            raise RuntimeError('Owned cgroup name changed before removal; not removed')
        # Kernel rmdir refuses a populated cgroup. Keep the native directory FD
        # until both empty readback and this exact owned-name removal complete.
        os.rmdir(self.name, dir_fd=self.root_fd)
        self.created = False
        self.reading['owned_leaf_removed'] = True
        if failure is not None:
            raise RuntimeError('Native cgroup retirement signal failed; retained native empty/removal evidence') from failure

    def close_descriptors(self):
        errors = []
        for name in ('events_fd', 'kill_fd', 'leaf_fd', 'root_fd'):
            fd = getattr(self, name)
            if fd is not None:
                try:
                    os.close(fd)
                except OSError as error:
                    errors.append({'descriptor': name, 'errno': error.errno, 'detail': str(error)})
                finally:
                    # Never retry closing a numeric descriptor after ownership
                    # was lost; attempt retirement of every other owned FD.
                    setattr(self, name, None)
        self.reading['descriptor_closed'] = not errors
        if errors:
            self.reading['descriptor_close_errors'] = errors
            self.reading['cleanup_unknown'] = 'Native cgroup descriptor retirement failed'
            raise RuntimeError(self.reading['cleanup_unknown'])


def run_isolated(args, *, cwd, env, stdout, timeout=180, cleanup=None, linux_cgroup=None):
    """Reap this opt-in test's owned group; preserve its unreaped PID fence.

    Temporary handlers belong only to this command. Native membership must
    qualify retirement independently; neither EPERM nor leader exit is absence.
    """
    process = None
    cgroup = None
    cgroup_failure = None
    if not hasattr(os, 'waitid') or not hasattr(os, 'WNOWAIT'):
        raise RuntimeError('Isolated native acceptance requires unreaped-leader observation on this platform')
    previous = {sig: signal.getsignal(sig) for sig in (signal.SIGINT, signal.SIGTERM)}

    def interrupted(signum, _frame):
        raise KeyboardInterrupt(f'Isolated acceptance interrupted by signal {signum}')

    try:
        for sig in previous:
            signal.signal(sig, interrupted)
        launch = {}
        if linux_cgroup is not None:
            native = {}
            if cleanup is not None:
                cleanup['linux_cgroup'] = native
            cgroup = _LinuxTestCgroup(linux_cgroup, native)
            launch = {'preexec_fn': cgroup.prepare_child, 'pass_fds': (cgroup.leaf_fd,)}
        process = subprocess.Popen(args, cwd=cwd, env=env, stdout=stdout,
                                   stderr=subprocess.STDOUT, start_new_session=True, **launch)
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
            if cgroup is not None:
                try:
                    cgroup.retire()
                except BaseException as error:
                    cgroup_failure = error
                    cgroup.reading['cleanup_unknown'] = str(error)
                    if cleanup is not None:
                        cleanup['cleanup_unknown'] = 'Native cgroup retirement is unavailable: '+str(error)
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
            try:
                if cgroup is not None:
                    try:
                        cgroup.close_descriptors()
                    except BaseException as error:
                        cgroup_failure = cgroup_failure or error
                        if cleanup is not None:
                            cleanup['cleanup_unknown'] = str(error)
            finally:
                for sig, handler in previous.items():
                    signal.signal(sig, handler)
        if cgroup_failure is not None:
            raise RuntimeError('Native cgroup cleanup failed; inspect retained native ownership evidence') from cgroup_failure


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
