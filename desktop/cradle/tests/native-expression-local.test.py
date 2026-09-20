"""Protocol tests for the opt-in local packet; no binary/device execution."""
import importlib.util
from pathlib import Path
import hashlib
import tempfile
import unittest

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

if __name__ == '__main__':
    unittest.main()
