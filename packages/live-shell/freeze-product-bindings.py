#!/usr/bin/env python3
"""Freeze real native candidate inputs. Does not build, install, relocate or sign.

The release CLI requires its independent build receipt. Managed source revisions
and git trees are retained as recorded provenance, never promoted to an unknown
dirty compiled source-tree digest. Writable runtime caches belong to the isolated
host profile; executable paths belong to the packaged product.
"""
import argparse
import base64
import gzip
import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import shutil
import struct
import subprocess
import tarfile
import tempfile

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
PRODUCTS = {'central', 'actuation', 'ai-kit', 'software-factory', 'workcell', 'quaternal-logic'}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def digest(path):
    with Path(path).open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def hex_value(value, length):
    return isinstance(value, str) and len(value) == length and all(c in '0123456789abcdef' for c in value)


def read_input(path):
    raw = Path(path).read_bytes()
    require(len(raw) <= 64 * 1024 * 1024, f'JSON input exceeds 64 MiB: {path}')
    def unique(pairs):
        result = {}
        for key, value in pairs:
            require(key not in result, f'Duplicate JSON field: {key}')
            result[key] = value
        return result
    return json.loads(raw, object_pairs_hook=unique), raw


def relative(value):
    require(isinstance(value, str) and value and '\\' not in value, 'Expected contained relative path')
    path = PurePosixPath(value)
    require(not path.is_absolute() and all(p not in ('', '.', '..') for p in value.split('/')), f'Uncontained relative path: {value}')
    return path.as_posix()


def file_binding(source, path, expected=None, size=None):
    source = Path(source)
    require(source.is_absolute() and source.is_file(), f'Explicit source file absent: {source}')
    actual = digest(source)
    if expected is not None:
        require(hex_value(expected, 64) and actual == expected, f'Source digest mismatch: {source}')
    if size is not None:
        require(source.stat().st_size == size, f'Source size mismatch: {source}')
    return {'source': str(source), 'path': relative(path), 'sha256': actual, 'bytes': source.stat().st_size}


def native(path, script=False):
    path = Path(path)
    require(path.is_file() and os.access(path, os.X_OK), f'Native executable absent/not executable: {path}')
    require('debug' not in path.parts and 'debug' not in path.resolve().parts, f'Development executable cannot be frozen: {path}')
    with path.open('rb') as stream:
        header = stream.read(4096)
    if script:
        require(header.startswith(b'#!/bin/sh\n'), f'Owner script requires its real /bin/sh interpreter: {path}')
        return
    magic = header[:4]
    arm64 = magic == bytes.fromhex('cffaedfe') and len(header) >= 8 and struct.unpack_from('<I', header, 4)[0] == 0x0100000c
    if magic in (bytes.fromhex('cafebabe'), bytes.fromhex('bebafeca')):
        order = 'big' if magic == bytes.fromhex('cafebabe') else 'little'
        count = int.from_bytes(header[4:8], order)
        require(0 < count <= 64 and len(header) >= 8 + count * 20, 'Malformed native universal header')
        arm64 = any(int.from_bytes(header[8 + i * 20:12 + i * 20], order) == 0x0100000c for i in range(count))
    require(arm64, f'Expected actual Darwin arm64 native executable: {path}')


def selection(footprint, backing):
    require(footprint.get('schema') == 'oi.desktop-footprint/v1', 'Expected native desktop footprint')
    require(backing in footprint['backing']['options'], f'Unknown native backing: {backing}')
    identities = footprint['backing']['options'][backing]['products']
    require(identities and len(identities) == len(set(identities)) and set(identities) <= PRODUCTS, 'Invalid native backing membership')
    return identities


def managed_product(identity, receipt, catalogue):
    require(hex_value(receipt.get('revision'), 40) and isinstance(receipt.get('source_dirty'), bool), f'Managed source provenance absent: {identity}')
    descriptor = Path(receipt['source_path']) / '.oi/product.json'
    lifecycle, descriptor_bytes = read_input(descriptor)
    require(lifecycle.get('schema') == 'oi.product-lifecycle/v1' and lifecycle.get('id') == identity, f'Native lifecycle descriptor mismatch: {identity}')
    surface = next((s for s in catalogue['surfaces'] if s['id'] == identity), None)
    require(surface is not None, f'Native catalogue owner absent: {identity}')
    main = Path(receipt['managed'])
    require(main.name == receipt['exe'] == surface['native']['executable'] == Path(lifecycle['artifact']['entry']).name, f'Native owner executable identity mismatch: {identity}')
    companions = receipt.get('companions', {})
    declared = {c['executable'] for c in surface['native'].get('source_install', {}).get('companions', [])}
    require(set(companions) == declared, f'Native owner companion receipt mismatch: {identity}')
    binaries = [(main, receipt['sha256']), *[(main.parent / name, sha) for name, sha in sorted(companions.items())]]
    records = []
    for path, sha in binaries:
        require(path.name not in ('.', '..') and path.parent == main.parent, 'Companion path escapes managed owner')
        is_script = identity == 'quaternal-logic' and path.name == 'ql-sky'
        native(path, script=is_script)
        require(hex_value(sha, 64) and digest(path) == sha, f'Managed artifact digest mismatch: {path}')
        record = {'path': str(path), 'sha256': sha, 'kind': 'shell-script' if is_script else 'native'}
        if is_script:
            record['interpreter'] = '/bin/sh'
        records.append(record)
    return {'id': identity, 'source_revision': receipt['revision'], 'source_dirty': receipt['source_dirty'],
            'source_tree_sha256': None, 'descriptor': str(descriptor), 'executables': records,
            'provenance': {'managed_receipt': receipt, 'compiled_source_tree_standing': 'unknown',
                           'owner_descriptor_input': {'path': str(descriptor), 'sha256': hashlib.sha256(descriptor_bytes).hexdigest(), 'bytes': len(descriptor_bytes)},
                           'descriptor_standing': 'actual owner lifecycle reading, snapshotted separately'}}


def suite_cli(path, basis):
    artifact = basis.get('artifact')
    require(isinstance(artifact, dict), 'Independent release artifact binding is absent')
    command = artifact.get('build_command')
    require(artifact.get('profile') == 'release' and isinstance(command, list) and
            all(isinstance(p, str) for p in command) and 'cargo' in command and 'build' in command and '--release' in command,
            'Recorded release artifact build command is required')
    path = Path(path).absolute()
    require(Path(artifact['path']).resolve() == path.resolve() and path.name == 'oi', 'Release artifact path/name mismatch')
    native(path)
    require(hex_value(artifact.get('sha256'), 64) and digest(path) == artifact['sha256'], 'Release artifact digest mismatch')
    require(hex_value(basis.get('source_revision'), 40) and hex_value(basis.get('source_tree_sha256'), 64), 'Independent release compiled source basis absent')
    if 'source_files' in basis:
        require(isinstance(basis['source_files'], list) and basis['source_files'], 'Release source file receipt is empty')
        recorded = hashlib.sha256(json.dumps(basis['source_files'], sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode()).hexdigest()
        require(recorded == basis['source_tree_sha256'], 'Release source file receipt digest mismatch')
    return {'path': str(path), 'sha256': artifact['sha256'], 'source_revision': basis['source_revision'], 'source_tree_sha256': basis['source_tree_sha256']}


def ql_export(path, receipt):
    require(receipt.get('schema') == 'ql.sky-command-export/v1', 'Expected native QL export receipt')
    require(receipt.get('installed_uv_fallback') is None, 'Candidate QL export must omit installed uv fallback')
    artifact = receipt['artifact']
    require(artifact['kind'] == 'shell-script' and artifact['interpreter'] == '/bin/sh', 'Native QL script contract mismatch')
    path = Path(path).absolute()
    require(path.name == 'ql-sky' and path.resolve() == Path(artifact['path']).resolve(), 'QL export path/name mismatch')
    native(path, script=True)
    require(digest(path) == artifact['sha256'] and path.stat().st_size == artifact['size_bytes'], 'QL export artifact digest/size mismatch')
    root = Path(receipt['source_root'])
    descriptor, _ = read_input(root / '.oi/product.json')
    require(descriptor.get('id') == 'quaternal-logic', 'QL export source owner mismatch')
    for item in receipt['source_inputs']:
        source = root / relative(item['path'])
        require(digest(source) == item['sha256'] and source.stat().st_size == item['size_bytes'], f'QL export source input changed: {source}')
    input_sha = hashlib.sha256(json.dumps(receipt['source_inputs'], sort_keys=True, separators=(',', ':')).encode()).hexdigest()
    require(input_sha == receipt['source_input_sha256'], 'QL export source-input digest mismatch')
    data = path.read_bytes()
    payload = next((line.removeprefix(b'payload=') for line in data.splitlines() if line.startswith(b'payload=')), None)
    require(payload is not None and hashlib.sha256(payload).hexdigest() == receipt['payload_sha256'], 'QL embedded payload digest mismatch')
    bundle = gzip.decompress(base64.b64decode(payload, validate=True))
    require(len(bundle) <= 16 * 1024 * 1024, 'QL embedded source archive exceeds bound')
    with tarfile.open(fileobj=io.BytesIO(bundle)) as archive:
        members = archive.getmembers()
        require(len(members) == len(receipt['resources']) and all(m.isfile() for m in members), 'QL embedded resources differ from owner export')
        for record in receipt['resources']:
            content = archive.extractfile(record['path']).read()
            require(hashlib.sha256(content).hexdigest() == record['sha256'] and len(content) == record['size_bytes'], 'QL embedded resource digest mismatch')
    require(hex_value(receipt.get('source_revision'), 40) and isinstance(receipt.get('source_dirty'), bool), 'QL export source provenance absent')
    return {'path': str(path), 'sha256': artifact['sha256'], 'kind': 'shell-script', 'interpreter': '/bin/sh',
            'provenance': {'source_revision': receipt['source_revision'], 'source_dirty': receipt['source_dirty'],
                           'source_input_sha256': receipt['source_input_sha256'], 'compiled_source_tree_standing': 'not claimed; exact producer inputs recorded'}}


def runtime_resources(inventory):
    require(inventory.get('schema') == 'ql.provider-runtime-inputs/v1', 'Expected actual native provider inventory')
    result = []
    for key, prefix in [('python', 'runtime/python'), ('provider', 'runtime/python/lib/python3.13/site-packages')]:
        tree = inventory[key]
        root = Path(tree['root']).resolve()
        by_path = {item['path']: item for item in tree['files']}
        require(len(by_path) == len(tree['files']), 'Duplicate runtime source inventory path')
        for item in tree['files']:
            source = root / relative(item['path'])
            require(source.resolve().is_relative_to(root), f'Runtime source escapes declared root: {source}')
            expected = item.get('sha256')
            if 'symlink' in item:
                require(source.is_symlink() and os.readlink(source) == item['symlink'] and str(source.resolve()) == item['resolved_path'], 'Runtime source symlink changed')
                target = source.resolve().relative_to(root).as_posix()
                expected = by_path[target]['sha256']
                source = source.resolve()
            require(expected is not None, 'Runtime file has no exact source hash')
            result.append(file_binding(source, prefix + '/' + item['path'], expected, item['size_bytes']))
    require(len({r['path'] for r in result}) == len(result), 'Runtime resource target collision')
    return result


def provider_source_resources(sources):
    require(sources.get('schema') == 'ql.provider-source-archives/v1', 'Expected native provider source archive receipt')
    result = []
    for record in sources['records']:
        archive = Path(record['source_archive'])
        require(record['sha256'] == record['published_sha256'], 'Published provider source checksum differs')
        result.append(file_binding(archive, 'sources/provider/' + archive.name, record['sha256'], record['size_bytes']))
        base = archive.parent / (record['name'] + '-' + record['version'] + '-notices')
        for notice in record['notices']:
            source = Path(notice['path'])
            result.append(file_binding(source, 'sources/provider/notices/' + base.name + '/' + source.relative_to(base).as_posix(), notice['sha256']))
    require({'kerykeion', 'pyswisseph', 'scour'} <= {r['name'] for r in sources['records']}, 'Required provider corresponding source absent')
    return result


def dependency_resources(dependency, worker):
    require(dependency.get('schema') == 'ql.dependency-source-archive/v1' and dependency.get('name') == 'json-c' and dependency.get('version') == '0.19', 'Expected recorded json-c dependency contract')
    library = dependency['installed_dylib']
    native(worker)
    load_output = subprocess.check_output(['/usr/bin/otool', '-L', str(worker)], text=True)
    loads = [line.strip().split(' (compatibility version', 1)[0] for line in load_output.splitlines() if line.startswith('\t')]
    external = [name for name in loads if not name.startswith(('/usr/lib/', '/System/Library/'))]
    matching = [name for name in external if Path(name).is_absolute() and Path(name).resolve() == Path(library['path']).resolve()]
    require(len(matching) == 1 and len(external) == 1 and Path(matching[0]).name == 'libjson-c.5.dylib', 'Actual native worker json-c load binding differs from dependency receipt')
    result = [file_binding(library['path'], 'lib/libjson-c.5.dylib', library['sha256'])]
    archive = Path(dependency['source_archive'])
    result.append(file_binding(archive, 'sources/json-c/' + archive.name, dependency['sha256'], dependency['size_bytes']))
    for key in ('installed_formula', 'installed_receipt'):
        item = dependency[key]
        result.append(file_binding(item['path'], 'sources/json-c/' + Path(item['path']).name, item['sha256']))
    for notice in dependency['notices']:
        result.append(file_binding(notice['path'], 'sources/json-c/notices/' + Path(notice['path']).name, notice['sha256']))
    changes = [{'path': 'bin/ql-field-worker', 'changes': [{'from': matching[0], 'to': '@loader_path/../lib/libjson-c.5.dylib'}]},
               {'path': 'lib/libjson-c.5.dylib', 'changes': [], 'id': '@loader_path/libjson-c.5.dylib'},
               {'path': 'runtime/python/lib/libpython3.13.dylib', 'changes': [], 'id': '@rpath/libpython3.13.dylib'}]
    return result, changes


class Snapshots:
    def __init__(self, staging, final):
        self.staging, self.final = Path(staging), Path(final)

    def write(self, member, source, raw):
        member = relative(member)
        target = self.staging / member
        target.parent.mkdir(parents=True, exist_ok=True)
        with target.open('xb') as stream:
            stream.write(raw)
        return {'path': str(self.final / member), 'source': str(Path(source).absolute()),
                'sha256': hashlib.sha256(raw).hexdigest(), 'bytes': len(raw)}


def parser():
    result = argparse.ArgumentParser(description=__doc__)
    for name in ('receipts', 'footprint', 'suite-cli', 'suite-source-basis', 'notices', 'output'):
        result.add_argument('--' + name, required=True, type=Path)
    result.add_argument('--backing', required=True)
    result.add_argument('--catalogue', type=Path, default=REPO / 'surfaces.json')
    for name in ('ql-export', 'ql-export-receipt', 'runtime-inventory', 'provider-sources', 'dependency-source', 'source-correspondence'):
        result.add_argument('--' + name, type=Path)
    return result


def freeze(args):
    output = args.output.absolute()
    inputs = output.with_name(output.name + '.inputs')
    require(not output.exists() and not inputs.exists(), 'Refusing existing frozen output/input snapshots')
    receipts, receipt_bytes = read_input(args.receipts)
    footprint, footprint_bytes = read_input(args.footprint)
    catalogue, catalogue_bytes = read_input(args.catalogue)
    basis, basis_bytes = read_input(args.suite_source_basis)
    notices, notices_bytes = read_input(args.notices)
    require(receipts.get('schema') == 'oi.managed-update/v1', 'Expected native managed update receipt')
    identities = selection(footprint, args.backing)
    suite = suite_cli(args.suite_cli, basis)
    notice_map = notices.get('products', notices)
    products = [managed_product(identity, receipts['products'][identity], catalogue) for identity in identities]
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='.freeze-', dir=output.parent) as temporary:
        stage = Path(temporary) / 'inputs'
        stage.mkdir()
        snapshots = Snapshots(stage, inputs)
        provenance = {key: snapshots.write(name, path, raw) for key, name, path, raw in [
            ('managed_receipts', 'active.json', args.receipts, receipt_bytes),
            ('footprint', 'footprint.json', args.footprint, footprint_bytes),
            ('catalogue', 'surfaces.json', args.catalogue, catalogue_bytes),
            ('suite_source_basis', 'suite-source-basis.json', args.suite_source_basis, basis_bytes),
            ('notices_input', 'notices-input.json', args.notices, notices_bytes)]}
        for product in products:
            identity = product['id']
            descriptor = Path(product['descriptor'])
            descriptor_bytes = descriptor.read_bytes()
            require(hashlib.sha256(descriptor_bytes).hexdigest() == product['provenance']['owner_descriptor_input']['sha256'], f'Native lifecycle descriptor changed during freeze: {identity}')
            product['provenance']['descriptor'] = snapshots.write('products/' + identity + '/product.json', descriptor, descriptor_bytes)
            product['descriptor'] = product['provenance']['descriptor']['path']
            original_notices = notice_map.get(identity)
            require(isinstance(original_notices, list) and original_notices, f'Actual product notices absent: {identity}')
            require(len({Path(p).name for p in original_notices}) == len(original_notices), f'Duplicate notice filenames: {identity}')
            notice_records = []
            for source in original_notices:
                source = Path(source)
                require(source.is_file() and not source.is_symlink(), f'Actual notice file absent: {source}')
                notice_records.append(snapshots.write('products/' + identity + '/notices/' + source.name, source, source.read_bytes()))
            product['notices'] = [item['path'] for item in notice_records]
            product['provenance']['notice_files'] = notice_records
            product.update(resources=[], runtime_env={}, transformations=[])
        if 'quaternal-logic' in identities:
            for key in ('ql_export', 'ql_export_receipt', 'runtime_inventory', 'provider_sources', 'dependency_source', 'source_correspondence'):
                require(getattr(args, key) is not None, f'Explicit native QL input required: --{key.replace("_", "-")}')
            ql = next(p for p in products if p['id'] == 'quaternal-logic')
            data = {}
            for key in ('ql_export_receipt', 'runtime_inventory', 'provider_sources', 'dependency_source', 'source_correspondence'):
                value, raw = read_input(getattr(args, key))
                data[key] = value
                provenance[key] = snapshots.write(key + '.json', getattr(args, key), raw)
            exported = ql_export(args.ql_export, data['ql_export_receipt'])
            exported['provenance']['export_receipt'] = provenance['ql_export_receipt']
            ql['executables'] = [exported if Path(item['path']).name == 'ql-sky' else item for item in ql['executables']]
            ql['source_dirty'] = ql['source_dirty'] or exported['provenance']['source_dirty']
            ql['resources'] = runtime_resources(data['runtime_inventory']) + provider_source_resources(data['provider_sources'])
            worker = next(item['path'] for item in ql['executables'] if Path(item['path']).name == 'ql-field-worker')
            dependency, transformations = dependency_resources(data['dependency_source'], worker)
            ql['resources'] += dependency
            for key, snapshot in provenance.items():
                if key in data:
                    ql['resources'].append({'source': snapshot['path'], 'path': 'sources/' + key + '.json', 'sha256': snapshot['sha256'], 'bytes': snapshot['bytes']})
            correspondence = data['source_correspondence']
            require(correspondence.get('schema') == 'ql.provider-corresponding-source/v1', 'Expected actual provider source correspondence record')
            for key in ('extracted_notice', 'licence_text'):
                notice = correspondence['scour_notice']
                expected = notice['sha256'] if key == 'extracted_notice' else notice['licence_sha256']
                ql['resources'].append(file_binding(notice[key], 'sources/provider/notices/scour-0.38.2/' + Path(notice[key]).name, expected))
            ql['runtime_env'] = {'QL_SKY_PYTHON': {'kind': 'executable', 'path': 'runtime/python/bin/python3.13'},
                                 'QL_NARA_PYTHON': {'kind': 'executable', 'path': 'runtime/python/bin/python3.13'},
                                 'QL_NARA_PROVIDER_CACHE': {'kind': 'cache', 'path': 'nara-provider'}}
            ql['transformations'] = transformations
            require(len({r['path'] for r in ql['resources']}) == len(ql['resources']), 'QL resource target collision')
        result = {'schema': 'oi.live-shell-products/v1', 'backing_id': args.backing, 'suite_cli': suite,
                  'products': products, 'provenance': provenance,
                  'standing': 'frozen actual input bytes; packaging and native runtime acceptance pending'}
        # Claim the snapshot destination exclusively before publishing any manifest.
        inputs.mkdir()
        try:
            os.replace(stage, inputs)
            with output.open('x') as stream:
                json.dump(result, stream, indent=2, sort_keys=True)
                stream.write('\n')
        except BaseException:
            shutil.rmtree(inputs)
            raise
    return result


if __name__ == '__main__':
    arguments = parser().parse_args()
    frozen = freeze(arguments)
    print(json.dumps({'manifest': str(arguments.output.absolute()), 'sha256': digest(arguments.output),
                      'backing_id': frozen['backing_id'], 'product_ids': [p['id'] for p in frozen['products']],
                      'standing': frozen['standing']}))
