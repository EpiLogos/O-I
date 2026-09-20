"""Executable acceptance-driver safety regressions, not installed-system proof."""
import importlib.util
import json
from pathlib import Path
import stat
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('adoption_packet', Path(__file__).with_name('test-adoption-local.py'))
packet = importlib.util.module_from_spec(spec)
spec.loader.exec_module(packet)

class EvidenceSafety(unittest.TestCase):
    def test_private_new_report(self):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / 'private' / 'evidence.json'
            packet.write_private_report(path, {'passed': False, 'failure': 'preserved'})
            self.assertEqual(json.loads(path.read_text())['failure'], 'preserved')
            self.assertEqual(stat.S_IMODE(path.stat().st_mode), 0o600)

    def test_existing_failure_cannot_be_overwritten(self):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / 'evidence.json'
            packet.write_private_report(path, {'passed': False})
            with self.assertRaises(FileExistsError):
                packet.write_private_report(path, {'passed': True})
            self.assertFalse(json.loads(path.read_text())['passed'])

    def test_symlink_is_not_followed(self):
        with tempfile.TemporaryDirectory() as d:
            target = Path(d) / 'target'; target.write_text('human source')
            link = Path(d) / 'link'; link.symlink_to(target)
            with self.assertRaises(OSError):
                packet.write_private_report(link, {'passed': True})
            self.assertEqual(target.read_text(), 'human source')

    def test_each_terminal_answer_has_a_fresh_prompt(self):
        # Drive a separate real TTY process, not mocked select/read/return codes.
        with tempfile.TemporaryDirectory() as d:
            root = Path(d); home = root / 'world'; home.mkdir()
            exe = root / 'prompt.py'
            exe.write_text('#!/usr/bin/python3\nimport sys\nfor _ in range(2):\n print("Question:",flush=True)\n assert input()=="q"\n')
            exe.chmod(0o700)
            result = packet.terminal_walk(exe, home, [(b'Question:', b'q\n'), (b'Question:', b'q\n')], 'two prompts')
            self.assertTrue(result['passed'])

if __name__ == '__main__':
    unittest.main()
