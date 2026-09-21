"""Fail-closed local evidence admission; all child receipts are test-only."""
import contextlib
import copy
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('packet', Path(__file__).with_name('native-expression-local.py'))
packet = importlib.util.module_from_spec(spec)
spec.loader.exec_module(packet)


class ReceiptAdmissionTests(unittest.TestCase):
    def exercise(self, mutation=None, *, missing=False, returncode=0,
                 change_file=False, change_head=False, dirty=False, preflight=False,
                 raw=None):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            paths = {name: root / name for name in ('host', 'worker', 'bridge', 'input')}
            for name, path in paths.items():
                path.write_text('{"basis":{},"field":{}}' if name == 'input' else 'test-only; never executed')
                path.chmod(0o700)
            files = {name: {'path': str(path), 'sha256': packet.digest(path)} for name, path in paths.items()}
            joined = {'schema': 'oi.native-expression-joined-browser/v1', 'pass': True,
                      'sources': copy.deepcopy(files), 'requests': {'opens': 1, 'closes': 1},
                      'checks': ['controlled test receipt, not an engine proof']}
            if mutation:
                mutation(joined)
            output = root / 'evidence'
            args = ['packet', '--expected-head', 'a' * 40, '--output', str(output)]
            for name, path in paths.items():
                args.extend(['--' + name, str(path)])
            if not preflight:
                args.append('--run-browser-join')
            executed = False

            def run(argv, *_args, **_kwargs):
                text = ''
                if argv == ['git', 'rev-parse', 'HEAD']:
                    text = ('b' if executed and change_head else 'a') * 40 + '\n'
                elif executed and dirty and argv[:2] == ['git', 'status']:
                    text = ' M desktop/cradle/tests/native-expression-native-browser.mjs\n'
                return {'argv': argv, 'code': 0, 'stdout': text, 'stderr': ''}

            def child(*_args, **_kwargs):
                nonlocal executed
                executed = True
                if not missing:
                    (output / 'browser').mkdir()
                    (output / 'browser/joined.json').write_text(raw(joined) if callable(raw) else raw if raw is not None else json.dumps(joined))
                if change_file:
                    paths['host'].write_text('different bytes after launch')
                return returncode

            with patch.object(packet.sys, 'argv', args), patch.object(packet, 'run', side_effect=run), \
                 patch.object(packet.shutil, 'which', return_value='/explicit/test-node'), \
                 patch.object(packet.platform, 'system', return_value='Linux'), \
                 patch.object(packet, 'run_isolated', side_effect=child) as invoke, \
                 contextlib.redirect_stdout(io.StringIO()):
                code = packet.main()
            receipt = json.loads((output / 'local-receipt.json').read_text())
            self.assertTrue(all(receipt['claims'][name] is False for name in
                            ('installed_app', 'native_wkwebview', 'audible_speakers',
                             'microphone', 'real_model_provider', 'human_acceptance')))
            return code, receipt, invoke.call_count

    def test_success_binds_the_exact_child_receipt_without_promoting_installed_claims(self):
        code, result, calls = self.exercise()
        self.assertEqual(code, 0)
        self.assertEqual(calls, 1)
        self.assertEqual(result['status'], 'isolated-native-browser-passed')
        self.assertEqual(result['checks']['browser_process']['code'], 0)
        self.assertEqual(len(result['checks']['browser_receipt']['sha256']), 64)

    def test_zero_exit_without_a_receipt_is_not_a_pass(self):
        code, result, _ = self.exercise(missing=True)
        self.assertEqual(code, 1)
        self.assertEqual(result['status'], 'failed')

    def test_false_ambiguous_or_foreign_child_results_are_not_promoted(self):
        cases = [lambda r: r.update(pass_=True, **{'pass': False}),
                 lambda r: r.update(**{'pass': 1}),
                 lambda r: r.update(schema='other/v1'),
                 lambda r: r.update(failure='native assertion failed'),
                 lambda r: r.update(checks=[]),
                 lambda r: r.update(sources={}),
                 lambda r: r['sources']['host'].update(sha256='0' * 64),
                 lambda r: r['sources']['input'].update(path='/different-input'),
                 lambda r: r['requests'].update(closes=0),
                 lambda r: r['requests'].update(opens=True)]
        for index, mutate in enumerate(cases):
            with self.subTest(case=index):
                self.assertEqual(self.exercise(mutate)[0], 1)

    def test_nonzero_child_is_retained_even_with_a_passing_receipt(self):
        code, result, _ = self.exercise(returncode=7)
        self.assertEqual(code, 1)
        self.assertEqual(result['checks']['browser_process']['code'], 7)

    def test_binary_drift_during_execution_is_not_accepted(self):
        self.assertEqual(self.exercise(change_file=True)[0], 1)

    def test_source_head_or_tracked_bytes_changed_during_execution_is_not_accepted(self):
        self.assertEqual(self.exercise(change_head=True)[0], 1)
        self.assertEqual(self.exercise(dirty=True)[0], 1)

    def test_malformed_nonfinite_or_duplicate_json_is_refused(self):
        for text in ('{', '[]', '{"pass":NaN}', '{"pass":false,"pass":true}'):
            with self.subTest(text=text):
                self.assertEqual(self.exercise(raw=text)[0], 1)
        # Syntactically valid JSON can overflow float() without a NaN/Infinity token.
        for exponent in ('1e999', '-1e999'):
            with self.subTest(overflow=exponent):
                receipt = lambda r: json.dumps(r)[:-1] + ',"measurement":' + exponent + '}'
                self.assertEqual(self.exercise(raw=receipt)[0], 1)

    def test_receipt_size_and_regular_file_boundary_are_enforced(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'joined.json'
            path.write_bytes(b' ' * (16 * 1024 * 1024 + 1))
            with self.assertRaisesRegex(ValueError, '16 MiB'):
                packet.verify_joined_receipt(path, {})
            alias = Path(directory) / 'alias.json'
            alias.symlink_to(path)
            with self.assertRaisesRegex(ValueError, 'regular file'):
                packet.verify_joined_receipt(alias, {})

    def test_preflight_remains_pending_without_starting_a_child(self):
        code, result, calls = self.exercise(preflight=True)
        self.assertEqual(code, 2)
        self.assertEqual(result['status'], 'pending')
        self.assertEqual(calls, 0)


if __name__ == '__main__':
    unittest.main()
