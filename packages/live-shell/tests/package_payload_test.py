"""Real file/profile qualification. A real native package remains a separate gate."""
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest

HERE = Path(__file__).resolve().parents[1]
REPO = HERE.parents[1]
spec = importlib.util.spec_from_file_location('package_payload', HERE / 'package-payload.py')
payload = importlib.util.module_from_spec(spec)
spec.loader.exec_module(payload)


class PayloadQualification(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.footprint = payload.read_json(REPO / 'desktop/install-footprint.json')
        cls.shell_dist = HERE / 'ui/ui-dist'
        cls.expressions_dist = REPO / 'desktop/cradle/expressions-app/dist'
        cls.scratch_root = Path(os.environ.get('LIVE_SHELL_TEST_ROOT', '/Users/admin/Central/Work/reverse-engineering/2026-10-07-techne-instrument-re/new-shell/evidence'))
        if not cls.scratch_root.is_dir():
            raise RuntimeError('Set LIVE_SHELL_TEST_ROOT to the existing native campaign Run/evidence directory')

    def temporary(self):
        return tempfile.TemporaryDirectory(prefix='package-qualification-', dir=self.scratch_root)

    def test_actual_candidate_build_inventory_and_digests(self):
        for directory in [self.shell_dist, self.expressions_dist]:
            files = payload.asset_files(directory)
            self.assertIn(directory / 'index.html', files)
            self.assertGreater(len(files), 1)
            for path in files:
                record = payload.file_record(directory, path)
                self.assertEqual(record['bytes'], path.stat().st_size)
                self.assertEqual(record['sha256'], payload.digest(path))

    def test_native_footprint_controls_default_and_smaller_membership(self):
        for backing, native in self.footprint['backing']['options'].items():
            bindings = {'schema': 'oi.live-shell-products/v1', 'products': [{'id': identity} for identity in native['products']]}
            selected, identities = payload.qualify_profile(self.footprint, backing, bindings)
            self.assertEqual(selected, backing)
            self.assertEqual(identities, native['products'])

    def test_full_suite_is_explicit_native_membership_with_smaller_default_retained(self):
        self.assertEqual(self.footprint['backing']['default'], '0/1/2')
        self.assertEqual(self.footprint['backing']['options']['full-suite']['products'], [
            'central', 'actuation', 'ai-kit', 'software-factory', 'workcell', 'quaternal-logic',
        ])

    def test_excluded_product_is_refused_even_when_installed_globally(self):
        backing = '0/1'
        ids = self.footprint['backing']['options'][backing]['products']
        self.assertTrue(Path('/Users/admin/.local/bin/aikit').is_file(), 'This installed-world case needs the actual extra product')
        bindings = {'schema': 'oi.live-shell-products/v1', 'products': [{'id': identity} for identity in [*ids, 'ai-kit']]}
        with self.assertRaisesRegex(ValueError, 'excluded products must be absent'):
            payload.qualify_profile(self.footprint, backing, bindings)

    def test_real_managed_native_binary_is_read_without_global_lookup(self):
        path = Path('/Users/admin/.local/bin/ctrl').resolve()
        self.assertEqual(payload.native_executable(path), path)
        self.assertTrue(payload.exact_hex(payload.digest(path), 64))

    def test_missing_real_host_marker_cannot_be_a_packaging_success(self):
        app = Path(os.environ.get('LIVE_SHELL_NATIVE_APP', '/Users/admin/Applications/O-I.app'))
        if app.is_dir() and (app / 'Contents/Resources/live-shell-host.json').exists():
            payload.qualify_host(app)
        else:
            with self.assertRaises((ValueError, OSError)):
                payload.qualify_host(app)

    def test_asset_symlink_cannot_import_foreign_checkout(self):
        with self.temporary() as raw:
            root = Path(raw)
            (root / 'index.html').write_bytes((self.shell_dist / 'index.html').read_bytes())
            (root / 'foreign.js').symlink_to(self.expressions_dist / 'index.html')
            with self.assertRaisesRegex(ValueError, 'symlink'):
                payload.asset_files(root)

    def test_duplicate_input_field_refuses_before_profile_resolution(self):
        with self.temporary() as raw:
            path = Path(raw) / 'input.json'
            path.write_text('{"schema":"oi.live-shell-products/v1","schema":"foreign"}')
            with self.assertRaisesRegex(ValueError, 'Duplicate JSON field'):
                payload.read_json(path)

    def test_file_record_refuses_asset_outside_payload(self):
        with self.temporary() as raw:
            with self.assertRaisesRegex(ValueError, 'escapes root'):
                payload.file_record(Path(raw), self.shell_dist / 'index.html')

    def test_stale_metadata_refuses_before_other_artifact_writes(self):
        with self.temporary() as raw:
            name = 'oi-cradle-0.1.0-aarch64-apple-darwin.tar.gz'
            archive, checksum, metadata = payload.artifact_paths(raw, name)
            metadata.write_bytes(b'Preserved prior artifact metadata\n')
            before = metadata.read_bytes()
            with self.assertRaisesRegex(ValueError, 'refusing replacement'):
                payload.refuse_existing_artifacts(raw, name)
            self.assertEqual(metadata.read_bytes(), before)
            self.assertFalse(archive.exists())
            self.assertFalse(checksum.exists())

    def test_actual_asset_digest_changes_after_a_real_file_changes(self):
        with self.temporary() as raw:
            root = Path(raw)
            original = (self.shell_dist / 'index.html').read_bytes()
            (root / 'index.html').write_bytes(original)
            before = payload.asset_digest(root)
            (root / 'index.html').write_bytes(original + b'\n')
            self.assertNotEqual(payload.asset_digest(root), before)

    def test_native_frontend_stage_contains_actual_bytes_and_no_host_marker(self):
        spec = importlib.util.spec_from_file_location('native_build', HERE / 'build-native-candidate.py')
        builder = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(builder)
        from types import SimpleNamespace
        with self.temporary() as raw:
            destination, config, basis = builder.stage(SimpleNamespace(shell_dist=self.shell_dist, expressions_dist=self.expressions_dist, stage=Path(raw) / 'stage'))
            self.assertEqual(payload.asset_digest(destination / 'frontend/app'), payload.asset_digest(self.shell_dist))
            self.assertEqual(payload.asset_digest(destination / 'frontend/__application/expressions'), payload.asset_digest(self.expressions_dist))
            self.assertEqual(payload.read_json(config)['app']['windows'][0]['url'], 'app/index.html')
            candidate_footprint = payload.read_json(destination / 'footprint.json')
            self.assertEqual(candidate_footprint['app_id'], 'org.epilogos.oi.live-shell')
            self.assertEqual(candidate_footprint['backing'], self.footprint['backing'])
            self.assertTrue(payload.exact_hex(basis['source_tree_sha256'], 64))
            self.assertFalse(any(destination.rglob('live-shell-host.json')))

    def ql_export(self):
        directory = Path(os.environ.get('QL_NATIVE_EXPORT_ROOT', '/Users/admin/Central/Work/Quaternal-Logic/target/native-composition'))
        script = directory / 'ql-sky'
        receipt_path = directory / 'ql-sky.receipt.json'
        receipt = payload.read_json(receipt_path)
        record = {'path': str(receipt_path), 'sha256': payload.digest(receipt_path), 'bytes': receipt_path.stat().st_size}
        item = {'path': str(script), 'sha256': payload.digest(script), 'kind': 'shell-script', 'interpreter': '/bin/sh',
                'provenance': {'export_receipt': record, 'source_input_sha256': receipt['source_input_sha256']}}
        binding = {'id': 'quaternal-logic', 'resources': [{'source': str(receipt_path), 'path': 'sources/ql_export_receipt.json',
                    'sha256': record['sha256'], 'bytes': record['bytes']}]}
        return binding, item, receipt

    def test_real_native_ql_owner_export_is_admitted_by_its_receipt(self):
        binding, item, receipt = self.ql_export()
        self.assertEqual(payload.qualify_owner_export(binding, item), receipt)
        with self.assertRaisesRegex(ValueError, 'real native executable'):
            payload.native_executable(item['path'], darwin_arm64=True)

    def test_tampered_real_ql_export_is_refused_without_replacing_owner_artifact(self):
        binding, item, _ = self.ql_export()
        original = Path(item['path'])
        before = payload.digest(original)
        with self.temporary() as raw:
            changed = Path(raw) / 'ql-sky'
            changed.write_bytes(original.read_bytes() + b'\n')
            changed.chmod(original.stat().st_mode)
            item['path'] = str(changed)
            with self.assertRaisesRegex(ValueError, 'differs from its owner receipt'):
                payload.qualify_owner_export(binding, item)
        self.assertEqual(payload.digest(original), before)

    def test_real_native_code_digest_survives_resource_sealing_and_seal_detects_tamper(self):
        import shutil
        import subprocess
        source = Path('/Users/admin/Applications/O-I.app')
        with self.temporary() as raw:
            app = Path(raw) / 'Owner-signing-replay.app'
            shutil.copytree(source, app)
            executable = app / 'Contents/MacOS/oi-cradle'
            before = payload.macho_code(executable)
            resource = app / 'Contents/Resources/signing-replay.html'
            resource.write_bytes((self.shell_dist / 'index.html').read_bytes())
            subprocess.run(['/usr/bin/codesign', '--force', '--sign', '-', str(app)], check=True, capture_output=True)
            subprocess.run(['/usr/bin/codesign', '--verify', '--strict', '--all-architectures', str(app)], check=True, capture_output=True)
            self.assertEqual(payload.macho_code(executable), before)
            resource.write_bytes(resource.read_bytes() + b'\n')
            verification = subprocess.run(['/usr/bin/codesign', '--verify', '--strict', '--all-architectures', str(app)], capture_output=True)
            self.assertNotEqual(verification.returncode, 0)
            self.assertEqual(payload.macho_code(executable), before)


if __name__ == '__main__':
    unittest.main()
