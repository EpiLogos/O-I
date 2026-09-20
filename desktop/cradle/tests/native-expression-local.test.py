"""Protocol tests for the opt-in local packet; no suite binary/device execution."""
import importlib.util
from pathlib import Path
import hashlib
import tempfile
import unittest
from unittest.mock import Mock, patch, call
import signal
import subprocess
import sys
import os

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

class IsolatedExecutionTests(unittest.TestCase):
    def exercise(self):
        return packet.run_isolated(['explicit-test'], cwd='.', env={}, stdout=None, timeout=1)

    def test_success_does_not_signal_other_processes(self):
        child = Mock(pid=43210, returncode=0)
        child.poll.return_value = 0
        previous = {sig: signal.getsignal(sig) for sig in (signal.SIGINT, signal.SIGTERM)}
        with patch.object(packet.subprocess, 'Popen', return_value=child) as spawn, patch.object(packet.os, 'killpg') as kill:
            self.assertEqual(self.exercise(), 0)
        self.assertTrue(spawn.call_args.kwargs['start_new_session'])
        kill.assert_not_called()
        for sig, handler in previous.items():
            self.assertEqual(signal.getsignal(sig), handler)

    def test_timeout_reaps_only_the_owned_group(self):
        child = Mock(pid=43210)
        child.poll.return_value = None
        child.wait.side_effect = [subprocess.TimeoutExpired('explicit-test', 1), None]
        with patch.object(packet.subprocess, 'Popen', return_value=child), patch.object(packet.os, 'killpg') as kill:
            with self.assertRaisesRegex(RuntimeError, 'timed out'):
                self.exercise()
        kill.assert_called_once_with(child.pid, signal.SIGTERM)
        self.assertEqual(child.wait.call_args_list, [call(timeout=1), call(timeout=10)])

    def test_keyboard_and_termination_signal_reap_and_restore_handlers(self):
        for signum in (signal.SIGINT, signal.SIGTERM):
            with self.subTest(signal=signum):
                previous = signal.getsignal(signum)
                child = Mock(pid=43210)
                child.poll.return_value = None
                def first_wait(**_kwargs):
                    signal.getsignal(signum)(signum, None)
                # Invoke the real installed handler without signalling the test runner.
                waited = False
                def wait(**kwargs):
                    nonlocal waited
                    if not waited:
                        waited = True
                        first_wait(**kwargs)
                child.wait.side_effect = wait
                with patch.object(packet.subprocess, 'Popen', return_value=child), patch.object(packet.os, 'killpg') as kill:
                    with self.assertRaises(KeyboardInterrupt):
                        self.exercise()
                kill.assert_called_once_with(child.pid, signal.SIGTERM)
                self.assertEqual(signal.getsignal(signum), previous)

    def test_uncooperative_child_has_bounded_kill_and_reap(self):
        child = Mock(pid=43210)
        child.poll.return_value = None
        child.wait.side_effect = [KeyboardInterrupt(), subprocess.TimeoutExpired('explicit-test', 10), None]
        with patch.object(packet.subprocess, 'Popen', return_value=child), patch.object(packet.os, 'killpg') as kill:
            with self.assertRaises(KeyboardInterrupt):
                self.exercise()
        self.assertEqual(kill.call_args_list, [call(child.pid, signal.SIGTERM), call(child.pid, signal.SIGKILL)])
        self.assertEqual(child.wait.call_args_list, [call(timeout=1), call(timeout=10), call(timeout=10)])

    def test_spawn_failure_keeps_handlers_and_does_not_kill(self):
        previous = signal.getsignal(signal.SIGTERM)
        with patch.object(packet.subprocess, 'Popen', side_effect=OSError('explicit missing binary')), patch.object(packet.os, 'killpg') as kill:
            with self.assertRaisesRegex(OSError, 'missing binary'):
                self.exercise()
        self.assertEqual(signal.getsignal(signal.SIGTERM), previous)
        kill.assert_not_called()

    def test_interruption_is_recorded_as_interrupted_not_passed(self):
        import json
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            binary = root / 'explicit-binary'
            binary.write_text('not executed')
            binary.chmod(0o700)
            input_path = root / 'input.json'
            input_path.write_text('{"basis":{},"field":{}}')
            output = root / 'evidence'
            args = ['packet', '--expected-head', 'selected', '--host', str(binary),
                    '--worker', str(binary), '--bridge', str(binary),
                    '--input', str(input_path), '--output', str(output), '--run-browser-join']
            def reading(argv, *_args, **_kwargs):
                return {'argv': argv, 'code': 0, 'stdout': 'selected\n' if argv == ['git', 'rev-parse', 'HEAD'] else '', 'stderr': ''}
            with patch.object(packet.sys, 'argv', args), patch.object(packet, 'run', side_effect=reading), patch.object(packet.shutil, 'which', return_value='/explicit/node'), patch.object(packet, 'run_isolated', side_effect=KeyboardInterrupt('test interruption')):
                self.assertEqual(packet.main(), 130)
            receipt = json.loads((output / 'local-receipt.json').read_text())
            self.assertEqual(receipt['status'], 'interrupted')
            self.assertEqual(receipt['error'], 'test interruption')
            self.assertFalse(receipt['claims']['installed_app'])
            self.assertFalse(receipt['claims']['audible_speakers'])

    def test_real_isolated_timeout_reaps_its_child(self):
        # A local Python sleep, not suite binaries, devices or services.
        real_spawn = subprocess.Popen
        spawned = []
        def spawn(*args, **kwargs):
            child = real_spawn(*args, **kwargs)
            spawned.append(child)
            return child
        with tempfile.TemporaryFile(mode='w+') as log, patch.object(packet.subprocess, 'Popen', side_effect=spawn):
            with self.assertRaisesRegex(RuntimeError, 'timed out'):
                packet.run_isolated([sys.executable, '-c', 'import time;time.sleep(30)'], cwd='.', env=os.environ.copy(), stdout=log, timeout=.1)
        self.assertIsNotNone(spawned[0].poll())

if __name__ == '__main__':
    unittest.main()
