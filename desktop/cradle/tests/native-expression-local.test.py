"""Protocol tests for the opt-in local packet; no suite binary/device execution."""
import importlib.util
from pathlib import Path
import hashlib
import tempfile
import unittest
import signal
import subprocess
import sys
import os
import json
import threading
import time

spec = importlib.util.spec_from_file_location('packet', Path(__file__).with_name('native-expression-local.py'))
packet = importlib.util.module_from_spec(spec)
spec.loader.exec_module(packet)

class PacketTests(unittest.TestCase):
    def test_hash_covers_exact_bytes(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / 'source'
            path.write_bytes(b'\x00native\n')
            self.assertEqual(packet.digest(path), hashlib.sha256(b'\x00native\n').hexdigest())
            path.write_bytes(b'\x00native\r\n')
            self.assertNotEqual(packet.digest(path), hashlib.sha256(b'\x00native\n').hexdigest())

    def test_command_failure_is_retained_not_promoted(self):
        import sys
        result = packet.run([sys.executable, '-c', 'import sys;print("retained failure",file=sys.stderr);sys.exit(7)'])
        self.assertEqual(result['code'], 7)
        self.assertIn('retained failure', result['stderr'])

    def test_no_shell_interpolation(self):
        import sys
        result = packet.run([sys.executable, '-c', 'import sys;print(sys.argv[1])', '$(do-not-execute)'])
        self.assertEqual(result['stdout'].strip(), '$(do-not-execute)')

@unittest.skipUnless(hasattr(os, 'waitid') and hasattr(os, 'WNOWAIT'), 'requires actual POSIX unreaped-leader observation')
class IsolatedExecutionTests(unittest.TestCase):
    def execute(self, code, timeout=2, cleanup=None):
        with tempfile.TemporaryFile(mode='w+') as log:
            result = packet.run_isolated([sys.executable, '-c', code], cwd='.', env=os.environ.copy(), stdout=log, timeout=timeout, cleanup=cleanup)
            log.seek(0)
            return result, log.read()

    def test_success_reaps_its_owned_leader_and_preserves_an_unrelated_child(self):
        foreign = subprocess.Popen([sys.executable, '-c', 'import time;time.sleep(30)'], start_new_session=True)
        previous = {sig: signal.getsignal(sig) for sig in (signal.SIGINT, signal.SIGTERM)}
        try:
            cleanup = {}
            result, text = self.execute('print("actual owned child");raise SystemExit(7)', cleanup=cleanup)
            self.assertEqual(result, 7)
            self.assertEqual(text.strip(), 'actual owned child')
            self.assertEqual(cleanup['leader_exit_code'], 7)
            self.assertTrue(cleanup['leader_kept_unreaped_until_group_signal'])
            self.assertTrue(cleanup['owned_group_absent_at_readback'])
            self.assertIsNone(foreign.poll())
            for sig, handler in previous.items():
                self.assertEqual(signal.getsignal(sig), handler)
        finally:
            foreign.terminate()
            foreign.wait(timeout=3)

    def test_completed_leader_cannot_abandon_an_inherited_descendant(self):
        cleanup = {}
        code = 'import subprocess,sys;child=subprocess.Popen([sys.executable,"-c","import time;time.sleep(30)"]);print(child.pid,flush=True)'
        result, text = self.execute(code, cleanup=cleanup)
        self.assertEqual(result, 0)
        descendant = int(text.strip())
        # A killed orphan can await init's reap briefly; it must not remain
        # an active reader or writer. This is a real OS readback, not a double.
        state = subprocess.run(['ps', '-o', 'stat=', '-p', str(descendant)], capture_output=True, text=True, timeout=2).stdout.strip()
        self.assertTrue(not state or state.startswith('Z'), state)
        self.assertEqual(cleanup['owned_group_signalled'], 'SIGKILL')
        self.assertTrue(cleanup['leader_kept_unreaped_until_group_signal'])
        self.assertIn('owned_group_absent_at_readback', cleanup)

    def test_timeout_has_bounded_cleanup_for_a_child_ignoring_termination(self):
        cleanup = {}
        started = time.monotonic()
        with self.assertRaisesRegex(RuntimeError, 'timed out'):
            self.execute('import signal,time;signal.signal(signal.SIGTERM,signal.SIG_IGN);time.sleep(30)', timeout=.2, cleanup=cleanup)
        self.assertLess(time.monotonic()-started, 3)
        self.assertEqual(cleanup['leader_exit_code'], -signal.SIGKILL)
        self.assertTrue(cleanup['owned_group_absent_at_readback'])

    def test_actual_keyboard_and_termination_signals_reap_and_restore_handlers(self):
        for signum in (signal.SIGINT, signal.SIGTERM):
            with self.subTest(signal=signum):
                previous = {sig: signal.getsignal(sig) for sig in (signal.SIGINT, signal.SIGTERM)}
                cleanup = {}
                timer = threading.Timer(.2, lambda: os.kill(os.getpid(), signum))
                timer.start()
                try:
                    with self.assertRaises(KeyboardInterrupt):
                        self.execute('import time;time.sleep(30)', cleanup=cleanup)
                finally:
                    timer.cancel()
                    timer.join(timeout=1)
                self.assertEqual(cleanup['leader_exit_code'], -signal.SIGKILL)
                self.assertTrue(cleanup['owned_group_absent_at_readback'])
                for sig, handler in previous.items():
                    self.assertEqual(signal.getsignal(sig), handler)

    def test_real_spawn_failure_restores_handlers_without_claiming_cleanup(self):
        previous = signal.getsignal(signal.SIGTERM)
        cleanup = {}
        with tempfile.TemporaryDirectory() as temp:
            with self.assertRaises(OSError):
                packet.run_isolated([str(Path(temp)/'absent-owner')], cwd='.', env=os.environ.copy(), stdout=None, cleanup=cleanup)
        self.assertEqual(signal.getsignal(signal.SIGTERM), previous)
        self.assertEqual(cleanup, {})

    def test_native_membership_observes_only_its_owned_live_group_and_retirement(self):
        process = subprocess.Popen([sys.executable, '-c', 'import time;time.sleep(30)'], start_new_session=True)
        try:
            before = packet.group_readback(process.pid)
            self.assertFalse(before['absent'])
            if sys.platform == 'darwin':
                self.assertEqual(before['basis'], 'native proc_listpgrppids')
                self.assertIn(process.pid, before['members'])
                self.assertEqual(before['errno'], 0)
        finally:
            os.killpg(process.pid, signal.SIGKILL)
            process.wait(timeout=2)
        after = packet.group_readback(process.pid)
        self.assertTrue(after['absent'], after)
        if sys.platform == 'darwin':
            self.assertEqual(after['basis'], 'native proc_listpgrppids')
            self.assertEqual(after['count'], 0)
            self.assertEqual(after['errno'], 0)

    def test_actual_packet_retains_a_source_preflight_failure(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            input_path = root/'input.json'
            input_path.write_text('{"basis":{},"field":{}}')
            output = root/'evidence'
            command = [sys.executable, str(Path(packet.__file__)), '--expected-head', 'deliberately-not-the-selected-head',
                       '--host', sys.executable, '--worker', sys.executable, '--bridge', sys.executable,
                       '--input', str(input_path), '--output', str(output)]
            result = subprocess.run(command, capture_output=True, text=True, timeout=10)
            self.assertEqual(result.returncode, 1, result.stderr)
            receipt = json.loads((output/'local-receipt.json').read_text())
            self.assertEqual(receipt['status'], 'failed')
            self.assertIn('Source head differs', receipt['error'])
            self.assertFalse(receipt['claims']['installed_app'])
            self.assertFalse(receipt['claims']['real_model_provider'])

if __name__ == '__main__':
    unittest.main()
