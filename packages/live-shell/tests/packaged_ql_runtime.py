#!/usr/bin/env python3
"""Independent real QL fragment replay; does not attest an installed application."""
import argparse
import hashlib
import importlib.util
import json
import math
import os
from pathlib import Path
import shutil
import subprocess
import sys
import unittest
import uuid

sys.dont_write_bytecode = True

ROOT = Path('/Users/admin/Central/Work/reverse-engineering/2026-10-07-techne-instrument-re/new-shell/evidence')
HERE = Path(__file__).resolve().parents[1]
REPO = HERE.parents[1]
QL = Path('/Users/admin/Central/Work/Quaternal-Logic/target/native-composition')
RECEIPTS = Path('/Users/admin/Library/Application Support/OI/receipts/updates/active.json')


def load(name, source):
    spec = importlib.util.spec_from_file_location(name, source)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def require(value, message):
    if not value:
        raise AssertionError(message)


def digest(path):
    with Path(path).open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def inventory(root):
    records = {}
    for path in sorted(root.rglob('*')):
        require(not path.is_symlink(), f'Fragment contains a symlink: {path}')
        if path.is_file():
            records[path.relative_to(root).as_posix()] = {'sha256': digest(path), 'bytes': path.stat().st_size}
    return records


def actual_binding(freeze, directory):
    """Use native producer helpers without inventing a suite release/build basis."""
    inputs = directory / 'inputs'
    inputs.mkdir()
    snapshots = freeze.Snapshots(inputs, inputs)
    provenance, documents = {}, {}
    sources = {'managed_receipts': RECEIPTS, 'catalogue': REPO / 'surfaces.json',
               'footprint': REPO / 'desktop/install-footprint.json',
               'ql_export_receipt': QL / 'ql-sky.receipt.json',
               'runtime_inventory': QL / 'provider-runtime-inputs.json',
               'provider_sources': QL / 'corresponding-source/source-archives.json',
               'dependency_source': QL / 'corresponding-source/json-c-source.json',
               'source_correspondence': QL / 'corresponding-source/source-correspondence.json'}
    for key, source in sources.items():
        documents[key], raw = freeze.read_input(source)
        provenance[key] = snapshots.write(key + '.json', source, raw)
    require('quaternal-logic' in freeze.selection(documents['footprint'], 'full-suite'), 'Actual footprint excludes QL')
    product = freeze.managed_product('quaternal-logic', documents['managed_receipts']['products']['quaternal-logic'], documents['catalogue'])
    descriptor = Path(product['descriptor'])
    require(digest(descriptor) == product['provenance']['owner_descriptor_input']['sha256'], 'Owner descriptor changed')
    descriptor_record = snapshots.write('product.json', descriptor, descriptor.read_bytes())
    product['descriptor'] = descriptor_record['path']
    product['provenance']['descriptor'] = descriptor_record
    exported = freeze.ql_export(QL / 'ql-sky', documents['ql_export_receipt'])
    exported['provenance']['export_receipt'] = provenance['ql_export_receipt']
    product['executables'] = [exported if Path(item['path']).name == 'ql-sky' else item for item in product['executables']]
    product['source_dirty'] |= exported['provenance']['source_dirty']
    resources = freeze.runtime_resources(documents['runtime_inventory']) + freeze.provider_source_resources(documents['provider_sources'])
    worker = next(item['path'] for item in product['executables'] if Path(item['path']).name == 'ql-field-worker')
    dependencies, transformations = freeze.dependency_resources(documents['dependency_source'], worker)
    resources += dependencies
    for key in ('ql_export_receipt', 'runtime_inventory', 'provider_sources', 'dependency_source', 'source_correspondence'):
        record = provenance[key]
        resources.append({'source': record['path'], 'path': 'sources/' + key + '.json', 'sha256': record['sha256'], 'bytes': record['bytes']})
    correspondence = documents['source_correspondence']
    require(correspondence['schema'] == 'ql.provider-corresponding-source/v1', 'Corresponding source evidence absent')
    scour = correspondence['scour_notice']
    for key, sha_key in [('extracted_notice', 'sha256'), ('licence_text', 'licence_sha256')]:
        resources.append(freeze.file_binding(scour[key], 'sources/provider/notices/scour-0.38.2/' + Path(scour[key]).name, scour[sha_key]))
    # Actual third-party notices, labelled by their source; no invented QL licence.
    notice_inputs = []
    for package in documents['provider_sources']['records']:
        for number, notice in enumerate(package['notices']):
            notice_inputs.append((package['name'] + '-' + str(number) + '-' + Path(notice['path']).name, Path(notice['path']), notice['sha256']))
    for number, notice in enumerate(documents['dependency_source']['notices']):
        notice_inputs.append(('json-c-' + str(number) + '-' + Path(notice['path']).name, Path(notice['path']), notice['sha256']))
    py = documents['runtime_inventory']['python']
    py_notice = next(item for item in py['files'] if item['path'] == 'lib/python3.13/LICENSE.txt')
    notice_inputs.append(('python-LICENSE.txt', Path(py['root']) / py_notice['path'], py_notice['sha256']))
    notice_records = []
    for name, source, expected in notice_inputs:
        require(digest(source) == expected, f'Actual notice changed: {source}')
        notice_records.append(snapshots.write('notices/' + name, source, source.read_bytes()))
    product.update(resources=resources, transformations=transformations,
                   runtime_env={'QL_SKY_PYTHON': {'kind': 'executable', 'path': 'runtime/python/bin/python3.13'},
                                'QL_NARA_PYTHON': {'kind': 'executable', 'path': 'runtime/python/bin/python3.13'},
                                'QL_NARA_PROVIDER_CACHE': {'kind': 'cache', 'path': 'nara-provider'}},
                   notices=[record['path'] for record in notice_records])
    product['provenance']['notice_files'] = notice_records
    product['provenance']['fragment_inputs'] = provenance
    return product, documents['catalogue'], Path(documents['ql_export_receipt']['source_root'])


def invoke(argv, env, input=None):
    result = subprocess.run([str(a) for a in argv], input=input, capture_output=True, text=True, env=env, timeout=120)
    require(result.returncode == 0, f'Actual component failed: {argv}: exit {result.returncode}: {result.stderr}')
    return result


def exercise_actual_fragment(evidence):
    require(evidence.is_dir(), 'Existing campaign evidence directory is required')
    directory = evidence / ('ql-runtime-fragment-' + uuid.uuid4().hex[:12])
    directory.mkdir()
    freeze = load('actual_freeze', HERE / 'freeze-product-bindings.py')
    pack = load('actual_packager', HERE / 'package-payload.py')
    try:
        binding, catalogue, source_root = actual_binding(freeze, directory)
        estimated = sum(item['bytes'] for item in binding['resources']) + sum(Path(item['path']).stat().st_size for item in binding['executables'])
        require(shutil.disk_usage(directory).free > estimated + 64 * 1024 * 1024, 'Insufficient disk for the actual fragment; no copy performed')
        (directory / 'binding.json').write_text(json.dumps({'schema': 'oi.ql-component-bindings/v1', 'product': binding}, indent=2) + '\n')
        staging = directory / 'staging'
        products = staging / 'products'
        products.mkdir(parents=True)
        final_records = pack.copy_product(binding, staging, products, catalogue)
        (directory / 'copied-records.json').write_text(json.dumps(final_records, indent=2) + '\n')
        relocated = directory / 'relocated'
        staging.rename(relocated)
        require(not staging.exists(), 'Original staged owner path remains available')
        owner = relocated / 'products/quaternal-logic'
        before = inventory(owner)
        profile = directory / 'profile'
        profile.mkdir()
        (profile / 'tmp').mkdir()
        env = {'PATH': '/usr/bin:/bin', 'HOME': str(profile), 'TMPDIR': str(profile / 'tmp'),
               'XDG_CACHE_HOME': str(profile / 'cache'), 'PYTHONNOUSERSITE': '1',
               'PYTHONDONTWRITEBYTECODE': '1', 'QL_SKY_PYTHON': str(owner / 'runtime/python/bin/python3.13'),
               'QL_NARA_PYTHON': str(owner / 'runtime/python/bin/python3.13'),
               'QL_NARA_PROVIDER_CACHE': str(profile / 'nara-provider')}
        # Exercise libpython, real C extensions, timezone/certificate data and Tcl
        # initialization. Tcl() does not create a window or enter a GUI loop.
        code = """import json,sys,kerykeion,swisseph,pydantic_core,charset_normalizer,pytz,certifi,tkinter
print(json.dumps({'executable':sys.executable,'prefix':sys.prefix,'modules':{m.__name__:m.__file__ for m in (kerykeion,swisseph,pydantic_core,charset_normalizer,pytz,certifi)},'tcl_version':tkinter.Tcl().eval('info patchlevel'),'certificate':certifi.where(),'timezone_count':len(pytz.all_timezones)}))"""
        imports = json.loads(invoke([env['QL_SKY_PYTHON'], '-c', code], env).stdout)
        for path in [imports['executable'], imports['prefix'], imports['certificate'], *imports['modules'].values()]:
            require(Path(path).resolve().is_relative_to(owner.resolve()), f'Runtime used an external Python/provider root: {path}')
        reference_path = source_root / 'fixtures/kernel/sky-snapshot-world-2026-09-28-v2.json'
        reference = json.loads(reference_path.read_bytes())
        sky = json.loads(invoke([owner / 'bin/ql-sky', '-'], env, json.dumps(reference['request'])).stdout)
        require(sky['schema'] == 'ql.sky-snapshot/v1' and sky['request'] == reference['request'], 'Actual sky request/result contract differs')
        require(len(sky['bodies']) == 10 and [b['native_planet_id'] for b in sky['bodies']] == [b['native_planet_id'] for b in reference['bodies']], 'Actual native planet basis differs')
        differences = [abs(actual['longitude_degrees'] - expected['longitude_degrees']) for actual, expected in zip(sky['bodies'], reference['bodies'])]
        require(max(differences) <= 1e-8, 'Relocated provider differs from retained actual numerical result')
        (directory / 'sky.json').write_text(json.dumps(sky, indent=2) + '\n')
        invalid = subprocess.run([str(owner / 'bin/ql-sky'), '-'], input=json.dumps(reference['request']),
                                 env=dict(env, QL_SKY_PYTHON=str(profile / 'absent-python')), capture_output=True, text=True, timeout=120)
        require(invalid.returncode == 2 and not invalid.stdout and json.loads(invalid.stderr)['schema'] == 'ql.sky-error/v1', 'Invalid explicit bundled interpreter was not rejected')
        worker = owner / 'bin/ql-field-worker'
        loads, _, _ = pack.load_commands(worker)
        json_c_load = '@loader_path/../lib/libjson-c.5.dylib'
        require(json_c_load in loads and not any(name.startswith('/opt/') for name in loads), 'Worker retains a development json-c load')
        # A real native owner rejection proves the JSON-C entry/serialization
        # contract while keeping uninitialized field activation explicitly absent.
        request = {'schema': 'ql.field-control/v1', 'operation': 'read'}
        response = json.loads(invoke([worker], env, json.dumps(request) + '\n').stdout)
        require(response['schema'] == 'ql.field-error/v1' and response['error'] == 'field is not initialized' and response['state_committed'] is False,
                'Actual uninitialized worker admission differs')
        after = inventory(owner)
        require(after == before, 'Actual component operations mutated declared payload bytes')
        new_bytecode = sorted(path for path in after if path.endswith(('.pyc', '.pyo')) or '__pycache__' in Path(path).parts)
        require(not new_bytecode, 'Actual bundled imports wrote bytecode into the sealed payload')
        signatures = []
        for path in sorted(owner.rglob('*')):
            if path.is_file() and pack.macho(path):
                invoke(['/usr/bin/codesign', '--verify', '--strict', '--all-architectures', path], env)
                signatures.append({'path': path.relative_to(owner).as_posix(), 'sha256': digest(path)})
        result = {'schema': 'oi.ql-component-replay/v1', 'standing': 'actual relocated QL fragment; installed application, full release freeze and field activation not attested',
                  'directory': str(directory), 'producer': {'path': str(Path(__file__).resolve()), 'sha256': digest(__file__)},
                  'consumer': {'path': str(HERE / 'package-payload.py'), 'sha256': digest(HERE / 'package-payload.py')},
                  'binding': {'path': str(directory / 'binding.json'), 'sha256': digest(directory / 'binding.json')},
                  'reference': {'path': str(reference_path), 'sha256': digest(reference_path)}, 'python': imports,
                  'sky': {'body_count': len(sky['bodies']), 'max_retained_difference_degrees': max(differences),
                          'snapshot': {'path': str(directory / 'sky.json'), 'sha256': digest(directory / 'sky.json')}, 'invalid_explicit_exit': invalid.returncode},
                  'worker': {'passed': True, 'json_c_load': json_c_load, 'field_activated': False, 'request': request, 'response': response},
                  'files_unchanged': True, 'payload_file_count': len(after), 'new_bytecode_files': new_bytecode,
                  'helper_signatures_verified': len(signatures), 'helper_signatures': signatures}
        (directory / 'result.json').write_text(json.dumps(result, indent=2) + '\n')
        print(json.dumps({'result': str(directory / 'result.json'), 'sha256': digest(directory / 'result.json'),
                          'standing': result['standing'], 'files': len(after), 'signatures': len(signatures)}), flush=True)
        return result
    except BaseException as error:
        (directory / 'failure.json').write_text(json.dumps({'schema': 'oi.ql-component-replay-failure/v1', 'error': str(error),
                                                          'directory': str(directory), 'standing': 'actual component failure preserved; no acceptance'}) + '\n')
        raise


class PackagedQLRuntimeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.result = exercise_actual_fragment(ROOT)

    def test_actual_relocated_sky_matches_retained_provider_result(self):
        self.assertEqual(self.result['sky']['body_count'], 10)
        self.assertLessEqual(self.result['sky']['max_retained_difference_degrees'], 1e-8)

    def test_actual_worker_loads_bundled_json_c(self):
        self.assertTrue(self.result['worker']['passed'])
        self.assertEqual(self.result['worker']['json_c_load'], '@loader_path/../lib/libjson-c.5.dylib')

    def test_operations_preserve_declared_bytes_and_helper_signatures(self):
        self.assertTrue(self.result['files_unchanged'])
        self.assertGreater(self.result['helper_signatures_verified'], 0)
        self.assertEqual(self.result['new_bytecode_files'], [])


if __name__ == '__main__':
    unittest.main()
