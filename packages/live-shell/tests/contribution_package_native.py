"""Exercise packaged contribution source through the real native owner compiler."""
import importlib.util
import os
from pathlib import Path
import tempfile
import unittest

HERE = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('builder', HERE / 'build-native-candidate.py')
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


class NativeContributionPackage(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.cli = Path(os.environ.get('OI_CONTRIBUTION_TEST_CLI', '/Users/admin/Central/Work/O-I/target/debug/oi'))
        cls.root = Path('/Users/admin/Central/Work/reverse-engineering/2026-10-07-techne-instrument-re/new-shell/evidence')
        if not cls.cli.is_file():
            raise RuntimeError('The real native contribution compiler is required')

    def test_actual_native_compiler_qualifies_copied_contributions(self):
        with tempfile.TemporaryDirectory(prefix='contribution-owner-', dir=self.root) as raw:
            root = Path(raw)
            proof = builder.stage_contributions(root, self.cli)
            self.assertEqual(proof['producer']['sha256'], builder.payload.digest(self.cli))
            self.assertEqual([r['contribution_ref'] for r in proof['contributions']], [
                'oi.contribution/core', 'oi.contribution/factory', 'oi.contribution/automations'])
            self.assertEqual(builder.payload.qualify_contribution_build(root, self.cli), proof)

    def test_mutated_copied_entry_is_refused(self):
        with tempfile.TemporaryDirectory(prefix='contribution-owner-', dir=self.root) as raw:
            root = Path(raw)
            builder.stage_contributions(root, self.cli)
            entry = root / 'Contents/Resources/live-shell-contributions/core/descriptor.tsx'
            entry.write_bytes(entry.read_bytes() + b'\n')
            with self.assertRaisesRegex(ValueError, 'Contribution source changed'):
                builder.payload.qualify_contribution_build(root, self.cli)


if __name__ == '__main__':
    unittest.main()
