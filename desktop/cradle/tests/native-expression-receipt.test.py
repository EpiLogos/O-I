"""Real receipt admission/refusal. Positive proof requires the actual producer packet.

These file/parser checks never fabricate a successful child process or native
owner response. The hosted producer runs first; its exact retained receipt and
still-present binary bytes supply the only positive case.
"""
import copy
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('packet', Path(__file__).with_name('native-expression-local.py'))
packet = importlib.util.module_from_spec(spec)
spec.loader.exec_module(packet)


class ReceiptAdmissionTests(unittest.TestCase):
    @unittest.skipUnless(os.environ.get('NATIVE_LOCAL_RECEIPT'),
                         'Actual native producer receipt is required for positive admission')
    def test_success_binds_the_exact_child_receipt_without_promoting_installed_claims(self):
        path = Path(os.environ['NATIVE_LOCAL_RECEIPT'])
        retained = json.loads(path.read_text())
        self.assertEqual(retained['schema'], 'oi.native-expression-local/v1')
        self.assertEqual(retained['status'], 'isolated-native-browser-passed')
        self.assertEqual(retained['checks']['browser_process']['code'], 0)
        self.assertTrue(retained['checks']['owned_browser_cleanup']['owned_group_absent_at_readback'])
        for name in ('installed_app', 'native_wkwebview', 'audible_speakers',
                     'microphone', 'real_model_provider', 'human_acceptance'):
            self.assertIs(retained['claims'][name], False)
        self.assertIs(retained['claims']['actual_native_central_disclosure'], True)
        admitted = packet.verify_joined_receipt(path.parent / 'browser/joined.json',
                                                retained['files'], retained['native_owners'])
        self.assertEqual(admitted, retained['checks']['browser_receipt'])
        self.assertGreater(admitted['checks'], 0)

    def refuse(self, raw, files=None, owners=None):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'joined.json'
            path.write_text(raw)
            with self.assertRaises((ValueError, KeyError, OSError)):
                packet.verify_joined_receipt(path, files or {}, owners)

    def test_actual_native_receipt_drift_is_refused(self):
        if not os.environ.get('NATIVE_LOCAL_RECEIPT'):
            self.skipTest('Requires the actual producer packet for native binary/identity drift checks')
        path = Path(os.environ['NATIVE_LOCAL_RECEIPT'])
        retained = json.loads(path.read_text())
        actual = json.loads((path.parent / 'browser/joined.json').read_text())
        cases = [lambda r: r['sources']['host'].update(sha256='0' * 64),
                 lambda r: r['sources']['input'].update(path='/different-input'),
                 lambda r: r['native_owners']['central'].update(sha256='0' * 64),
                 lambda r: r.update(**{'pass': False}),
                 lambda r: r.update(**{'pass': 1}),
                 lambda r: r.update(schema='other/v1'),
                 lambda r: r.update(checks=[]),
                 lambda r: r['requests'].update(opens=True),
                 lambda r: r['requests'].update(closes=0)]
        for index, mutation in enumerate(cases):
            value = copy.deepcopy(actual)
            mutation(value)
            with self.subTest(case=index):
                self.refuse(json.dumps(value), retained['files'], retained['native_owners'])

    def test_invalid_json_syntax_is_refused(self):
        self.refuse('{')

    def test_nonfinite_and_duplicate_keys_in_actual_native_receipt_are_refused(self):
        if not os.environ.get('NATIVE_LOCAL_RECEIPT'):
            self.skipTest('Requires an otherwise-valid actual native producer receipt')
        path = Path(os.environ['NATIVE_LOCAL_RECEIPT'])
        retained = json.loads(path.read_text())
        raw = (path.parent / 'browser/joined.json').read_text().rstrip()
        # Preserve every actual owner/hash/check and alter only this syntax
        # boundary. Without the specific rejection, these would be admitted.
        for suffix in ('"measurement":NaN', '"measurement":1e999',
                       '"measurement":-1e999', '"pass":true'):
            with self.subTest(suffix=suffix):
                self.refuse(raw[:-1] + ',' + suffix + '}', retained['files'],
                            retained['native_owners'])

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


if __name__ == '__main__':
    if os.environ.get('REQUIRE_NATIVE_RECEIPT') == '1' and not os.environ.get('NATIVE_LOCAL_RECEIPT'):
        raise SystemExit('Explicit actual native producer receipt required; no positive substitute')
    unittest.main()
