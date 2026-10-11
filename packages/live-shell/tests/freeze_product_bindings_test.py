#!/usr/bin/env python3
"""Qualification against actual managed artifacts and native provider exports."""
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest

HERE = Path(__file__).resolve().parents[1]
REPO = HERE.parents[1]
RECEIPTS = Path('/Users/admin/Library/Application Support/OI/receipts/updates/active.json')
QL = Path('/Users/admin/Central/Work/Quaternal-Logic/target/native-composition')


class FreezeBindingsTests(unittest.TestCase):
    def setUp(self):
        producer = HERE / 'freeze-product-bindings.py'
        self.assertTrue(producer.is_file(), 'Native binding freeze producer is missing')
        spec = importlib.util.spec_from_file_location('freeze_bindings', producer)
        self.freeze = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.freeze)
        self.receipts, _ = self.freeze.read_input(RECEIPTS)
        self.catalogue, _ = self.freeze.read_input(REPO / 'surfaces.json')
        self.footprint, _ = self.freeze.read_input(REPO / 'desktop/install-footprint.json')

    def test_selection_uses_actual_native_footprint_and_excludes_other_installed_products(self):
        for backing, spec in self.footprint['backing']['options'].items():
            self.assertEqual(self.freeze.selection(self.footprint, backing), spec['products'])
        small = self.freeze.selection(self.footprint, '0/1')
        self.assertTrue(set(small) < set(self.receipts['products']))
        with self.assertRaisesRegex(ValueError, 'backing'):
            self.freeze.selection(self.footprint, 'invented-backing')

    def test_real_managed_main_and_companion_digests_and_dirty_flags(self):
        products = {}
        for identity in self.freeze.selection(self.footprint, 'full-suite'):
            products[identity] = self.freeze.managed_product(identity, self.receipts['products'][identity], self.catalogue)
            native = products[identity]
            self.assertEqual(native['source_dirty'], self.receipts['products'][identity]['source_dirty'])
            self.assertIsNone(native['source_tree_sha256'])
            for item in native['executables']:
                self.assertEqual(self.freeze.digest(item['path']), item['sha256'])
        self.assertTrue(products['software-factory']['source_dirty'])
        self.assertTrue(products['workcell']['source_dirty'])
        self.assertEqual({Path(x['path']).name for x in products['quaternal-logic']['executables']},
                         {'ql', 'ql-field-host', 'ql-focused-host', 'ql-field-worker', 'ql-sky'})
        corrupted = dict(self.receipts['products']['actuation'], sha256='0' * 64)
        with self.assertRaisesRegex(ValueError, 'digest'):
            self.freeze.managed_product('actuation', corrupted, self.catalogue)

    def test_real_ql_export_preserves_new_artifact_source_provenance(self):
        receipt, _ = self.freeze.read_input(QL / 'ql-sky.receipt.json')
        binding = self.freeze.ql_export(QL / 'ql-sky', receipt)
        self.assertEqual(binding['sha256'], self.freeze.digest(QL / 'ql-sky'))
        self.assertEqual(binding['kind'], 'shell-script')
        self.assertTrue(binding['provenance']['source_dirty'])
        self.assertEqual(binding['provenance']['source_input_sha256'], receipt['source_input_sha256'])
        changed = dict(receipt, installed_uv_fallback='/Users/admin/.local/bin/uv')
        with self.assertRaisesRegex(ValueError, 'fallback'):
            self.freeze.ql_export(QL / 'ql-sky', changed)

    def test_actual_runtime_inventory_has_contained_explicit_file_bindings(self):
        inventory, _ = self.freeze.read_input(QL / 'provider-runtime-inputs.json')
        resources = self.freeze.runtime_resources(inventory)
        paths = {item['path']: item for item in resources}
        self.assertEqual(len(paths), len(resources))
        interpreter = paths['runtime/python/bin/python3.13']
        self.assertEqual(interpreter['sha256'], self.freeze.digest(interpreter['source']))
        self.assertIn('runtime/python/lib/python3.13/site-packages/kerykeion/sweph/seas_18.se1', paths)
        self.assertIn('runtime/python/lib/python3.13/site-packages/pyswisseph-2.10.3.2.dist-info/licenses/LICENSE.txt', paths)
        for item in resources:
            self.assertFalse(Path(item['path']).is_absolute())
            self.assertNotIn('..', Path(item['path']).parts)
            self.assertTrue(Path(item['source']).is_file())

    def test_actual_corresponding_archives_and_json_c_are_bound_by_recorded_bytes(self):
        sources, _ = self.freeze.read_input(QL / 'corresponding-source/source-archives.json')
        resources = self.freeze.provider_source_resources(sources)
        dependency, _ = self.freeze.read_input(QL / 'corresponding-source/json-c-source.json')
        worker = Path(self.receipts['products']['quaternal-logic']['managed']).parent / 'ql-field-worker'
        try:
            extra, transformations = self.freeze.dependency_resources(dependency, worker)
        except TypeError:
            self.fail('Dependency freeze must admit the actual worker load binding')
        self.assertIn('lib/libjson-c.5.dylib', {item['path'] for item in extra})
        self.assertIn('sources/provider/kerykeion-5.7.1.tar.gz', {item['path'] for item in resources})
        self.assertEqual(transformations[0]['path'], 'bin/ql-field-worker')
        for item in [*resources, *extra]:
            self.assertEqual(item['sha256'], self.freeze.digest(item['source']))
        wrong_library = dict(dependency, installed_dylib={
            'path': '/Users/admin/.local/share/uv/python/cpython-3.13.11-macos-aarch64-none/lib/libpython3.13.dylib',
            'sha256': self.freeze.digest('/Users/admin/.local/share/uv/python/cpython-3.13.11-macos-aarch64-none/lib/libpython3.13.dylib')})
        with self.assertRaisesRegex(ValueError, 'json-c load binding'):
            self.freeze.dependency_resources(wrong_library, worker)

    def test_release_requires_an_independent_actual_build_artifact_binding(self):
        actual = Path(self.receipts['products']['oi']['managed'])
        with self.assertRaisesRegex(ValueError, 'release artifact'):
            self.freeze.suite_cli(actual, {'source_revision': self.receipts['products']['oi']['revision'],
                                          'source_tree_sha256': '0' * 64})

    def test_full_freeze_uses_only_root_supplied_completed_release_inputs(self):
        inputs = os.environ.get('OI_TEST_FREEZE_INPUTS')
        if not inputs:
            self.skipTest('OI_TEST_FREEZE_INPUTS must supply actual completed release/source/notice inputs')
        supplied, _ = self.freeze.read_input(inputs)
        scratch = Path(os.environ.get('LIVE_SHELL_TEST_ROOT', '/Users/admin/Central/Work/reverse-engineering/2026-10-07-techne-instrument-re/new-shell/evidence'))
        with tempfile.TemporaryDirectory(prefix='freeze-bindings-', dir=scratch) as directory:
            supplied['output'] = str(Path(directory) / 'products.json')
            args = self.freeze.parser().parse_args([piece for key, value in supplied.items()
                                                   for piece in ('--' + key.replace('_', '-'), str(value))])
            result = self.freeze.freeze(args)
            self.assertEqual({x['id'] for x in result['products']},
                             set(self.freeze.selection(self.footprint, args.backing)))
            self.assertEqual(self.freeze.digest(result['suite_cli']['path']), result['suite_cli']['sha256'])
            for record in result['provenance'].values():
                if isinstance(record, dict) and 'sha256' in record and 'path' in record:
                    self.assertEqual(self.freeze.digest(record['path']), record['sha256'])
            with self.assertRaisesRegex(ValueError, 'existing'):
                self.freeze.freeze(args)


if __name__ == '__main__':
    unittest.main()
