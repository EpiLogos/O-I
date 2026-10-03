"""Explicit remote Linux cgroup OS tests. No suite/browser/model execution.

Run only as the job's privileged supervisor with explicit actual runner IDs.
A missing native cgroup capability is a failure, never an ignored success.
"""
import importlib.util
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import tempfile
import time
import unittest

spec = importlib.util.spec_from_file_location('packet', Path(__file__).with_name('native-expression-local.py'))
packet = importlib.util.module_from_spec(spec)
spec.loader.exec_module(packet)


class NativeCgroupTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if sys.platform != 'linux' or os.geteuid() != 0:
            raise RuntimeError('Explicit real Linux root supervisor required; no cgroup case was qualified')
        cls.uid = int(os.environ['OI_NATIVE_CGROUP_UID'])
        cls.gid = int(os.environ['OI_NATIVE_CGROUP_GID'])
        if cls.uid <= 0 or cls.gid <= 0:
            raise RuntimeError('Explicit actual nonroot runner UID/GID required')
        cls.owner = {'root': '/sys/fs/cgroup', 'uid': cls.uid, 'gid': cls.gid}

    def setUp(self):
        self.scratch = tempfile.TemporaryDirectory(prefix='oi-real-cgroup-test-')
        self.root = Path(self.scratch.name)
        os.chown(self.root, self.uid, self.gid)
        self.addCleanup(self.scratch.cleanup)

    def execute(self, source, timeout=2, cleanup=None, owner=None):
        with tempfile.TemporaryFile(mode='w+') as log:
            try:
                result = packet.run_isolated([sys.executable, '-c', source], cwd=self.root,
                    env=os.environ.copy(), stdout=log, timeout=timeout, cleanup=cleanup,
                    linux_cgroup=self.owner if owner is None else owner)
            finally:
                log.seek(0)
                self.last_output = log.read()
        return result, self.last_output

    def assert_retired(self, cleanup):
        native = cleanup['linux_cgroup']
        self.assertEqual(native['schema'], 'oi.native-test-cgroup/v1')
        self.assertEqual(native['child_uid'], self.uid)
        self.assertEqual(native['child_gid'], self.gid)
        self.assertEqual(native['filesystem_magic'], 0x63677270)
        self.assertTrue(native['same_directory_before_retirement'])
        self.assertEqual(native['events_after_retirement']['populated'], 0)
        self.assertTrue(native['owned_leaf_removed'])
        self.assertTrue(native['descriptor_closed'])
        self.assertNotIn('cleanup_unknown', native)
        self.assertNotIn('cleanup_unknown', cleanup)
        self.assertTrue(cleanup['owned_leader_reaped'])
        self.assertTrue(cleanup['owned_group_absent_at_readback'])
        self.assertFalse(Path(native['path']).exists())

    def assert_inactive(self, pid):
        state = subprocess.run(['ps', '-o', 'stat=', '-p', str(pid)],
            capture_output=True, text=True, timeout=2).stdout.strip()
        self.assertTrue(not state or state.startswith('Z'), state)

    def test_actual_child_enters_native_cgroup_before_exec_with_runner_identity_and_no_owner_fd(self):
        cleanup = {}
        source = '''import json,os
fds=[]
for fd in os.listdir('/proc/self/fd'):
 try:fds.append(os.readlink('/proc/self/fd/'+fd))
 except FileNotFoundError:pass
print(json.dumps({'uid':os.getuid(),'gid':os.getgid(),'groups':os.getgroups(),
 'membership':open('/proc/self/cgroup').read(),'fds':fds}),flush=True)
'''
        result, output = self.execute(source, cleanup=cleanup)
        reading = json.loads(output)
        self.assertEqual(result, 0)
        self.assertEqual(reading['uid'], self.uid)
        self.assertEqual(reading['gid'], self.gid)
        self.assertEqual(reading['groups'], [])
        self.assertIn('/'+cleanup['linux_cgroup']['name'], reading['membership'])
        self.assertFalse(any('/sys/fs/cgroup' in fd for fd in reading['fds']))
        self.assert_retired(cleanup)

    def test_completed_leader_retires_detached_descendant_without_touching_foreign_process(self):
        foreign = subprocess.Popen([sys.executable, '-c', 'import time;time.sleep(30)'], start_new_session=True)
        try:
            cleanup = {}
            result, output = self.execute('''import json,subprocess,sys
child=subprocess.Popen([sys.executable,'-c','import signal,time;signal.signal(signal.SIGTERM,signal.SIG_IGN);time.sleep(30)'],
 start_new_session=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
print(json.dumps({'detached_pid':child.pid}),flush=True)
''', cleanup=cleanup)
            self.assertEqual(result, 0)
            self.assert_inactive(json.loads(output)['detached_pid'])
            self.assertIsNone(foreign.poll())
            self.assert_retired(cleanup)
        finally:
            if foreign.returncode is None:
                os.killpg(foreign.pid, signal.SIGKILL)
            foreign.wait(timeout=2)

    def test_timeout_retires_term_ignoring_leader_and_detached_descendant(self):
        cleanup = {}
        started = time.monotonic()
        with self.assertRaisesRegex(RuntimeError, 'timed out'):
            self.execute('''import json,signal,subprocess,sys,time
signal.signal(signal.SIGTERM,signal.SIG_IGN)
child=subprocess.Popen([sys.executable,'-c','import signal,time;signal.signal(signal.SIGTERM,signal.SIG_IGN);time.sleep(30)'],
 start_new_session=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
print(json.dumps({'detached_pid':child.pid}),flush=True)
time.sleep(30)
''', timeout=1, cleanup=cleanup)
        self.assertLess(time.monotonic()-started, 7)
        self.assert_inactive(json.loads(self.last_output)['detached_pid'])
        self.assertEqual(cleanup['leader_exit_code'], -signal.SIGKILL)
        self.assert_retired(cleanup)

    def test_actual_interruption_retires_cgroup_and_restores_signal_handler(self):
        marker = self.root/'native-ready'
        sender = subprocess.Popen([sys.executable, '-c', '''import os,pathlib,signal,sys,time
marker=pathlib.Path(sys.argv[1]);deadline=time.monotonic()+3
while not marker.exists():
 if time.monotonic()>=deadline:raise SystemExit(3)
 time.sleep(.005)
os.kill(int(sys.argv[2]),signal.SIGTERM)
''', str(marker), str(os.getpid())], start_new_session=True)
        previous = signal.getsignal(signal.SIGTERM)
        cleanup = {}
        try:
            with self.assertRaises(KeyboardInterrupt):
                self.execute('''import pathlib,subprocess,sys,time
child=subprocess.Popen([sys.executable,'-c','import time;time.sleep(30)'],start_new_session=True,
 stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
pathlib.Path('native-ready').write_text(str(child.pid))
time.sleep(30)
''', timeout=4, cleanup=cleanup)
            self.assertEqual(sender.wait(timeout=2), 0)
            self.assert_inactive(int(marker.read_text()))
            self.assertEqual(signal.getsignal(signal.SIGTERM), previous)
            self.assert_retired(cleanup)
        finally:
            if sender.returncode is None:
                os.killpg(sender.pid, signal.SIGKILL)
            sender.wait(timeout=2)

    def test_real_exec_failure_retires_allocated_native_leaf_without_product_effect(self):
        cleanup = {}
        with self.assertRaises(OSError):
            packet.run_isolated([str(self.root/'absent-native-executable')], cwd=self.root,
                env=os.environ.copy(), stdout=None, cleanup=cleanup, linux_cgroup=self.owner)
        native = cleanup['linux_cgroup']
        self.assertEqual(native['events_after_retirement']['populated'], 0)
        self.assertTrue(native['owned_leaf_removed'])
        self.assertTrue(native['descriptor_closed'])
        self.assertNotIn('owned_leader_reaped', cleanup)
        self.assertFalse(Path(native['path']).exists())

    def test_actual_non_cgroup_filesystem_refuses_before_launch(self):
        marker = self.root/'must-not-run'
        with self.assertRaisesRegex(RuntimeError, 'cgroup v2'):
            self.execute("open('must-not-run','w').write('actual effect')", cleanup={},
                owner={'root':str(self.root),'uid':self.uid,'gid':self.gid})
        self.assertFalse(marker.exists())
        self.assertEqual(list(self.root.iterdir()), [])

    def test_invalid_root_identity_refuses_before_launch(self):
        marker = self.root/'must-not-run'
        with self.assertRaisesRegex(ValueError, 'nonroot'):
            self.execute("open('must-not-run','w').write('actual effect')", cleanup={},
                owner={'root':'/sys/fs/cgroup','uid':0,'gid':self.gid})
        self.assertFalse(marker.exists())

    def test_nonzero_exit_is_preserved_with_native_retirement_receipt(self):
        cleanup = {}
        result, output = self.execute("print('actual refusal');raise SystemExit(7)", cleanup=cleanup)
        self.assertEqual(result, 7)
        self.assertEqual(output.strip(), 'actual refusal')
        self.assertEqual(cleanup['leader_exit_code'], 7)
        self.assertTrue(cleanup['leader_kept_unreaped_until_group_signal'])
        self.assert_retired(cleanup)


if __name__ == '__main__':
    unittest.main()
