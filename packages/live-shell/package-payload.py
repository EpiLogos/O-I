#!/usr/bin/env python3
"""Stage real candidate bytes for the native O:I desktop installer; never build/install."""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path, PurePosixPath
import plistlib
import shutil
import tarfile
import tempfile
import struct
import subprocess
import sys

BOOTSTRAP = {
    'shell_entry': '/app/index.html',
    'expressions_entry': '/__application/expressions/index.html',
    'transport': 'tauri-kernel',
    'configuration': 'native-owner-discovery',
    'product_resolution': 'payload-only',
}
PRODUCT_IDS = {'central', 'actuation', 'ai-kit', 'software-factory', 'workcell', 'quaternal-logic'}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def digest(path):
    with Path(path).open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def read_json(path):
    path = Path(path)
    require(path.stat().st_size <= 16 * 1024 * 1024, f'JSON exceeds 16 MiB: {path}')
    def unique(pairs):
        result = {}
        for key, value in pairs:
            require(key not in result, f'Duplicate JSON field: {key}')
            result[key] = value
        return result
    return json.loads(path.read_text(), object_pairs_hook=unique)


def exact_hex(value, length):
    return isinstance(value, str) and len(value) == length and all(c in '0123456789abcdef' for c in value)


def native_executable(path, darwin_arm64=False):
    path = Path(path)
    require(path.is_file() and os.access(path, os.X_OK), f'Native executable absent/not executable: {path}')
    require('debug' not in path.parts and 'debug' not in path.resolve().parts and path.name != 'walk-bridge', f'Development executable cannot be packaged: {path}')
    with path.open('rb') as stream:
        header = stream.read(4096)
    magic = header[:4]
    require(magic in (b'\x7fELF', b'\xcf\xfa\xed\xfe', b'\xce\xfa\xed\xfe', b'\xfe\xed\xfa\xcf', b'\xca\xfe\xba\xbe', b'\xbe\xba\xfe\xca'), f'Expected a real native executable, not a launcher substitute: {path}')
    if darwin_arm64:
        arm64 = magic == b'\xcf\xfa\xed\xfe' and int.from_bytes(header[4:8], 'little') == 0x0100000c
        if magic in (b'\xca\xfe\xba\xbe', b'\xbe\xba\xfe\xca'):
            order = 'big' if magic == b'\xca\xfe\xba\xbe' else 'little'
            count = int.from_bytes(header[4:8], order)
            require(0 < count <= 64 and 8 + count * 20 <= len(header), 'Malformed universal native executable')
            arm64 = any(int.from_bytes(header[8 + index * 20:12 + index * 20], order) == 0x0100000c for index in range(count))
        require(arm64, f'Candidate Darwin payload requires arm64 native executable: {path}')
    return path


def file_record(root, path):
    path = Path(path)
    require(path.is_file(), f'Missing payload file: {path}')
    require(path.resolve().is_relative_to(root.resolve()), f'Payload file escapes root: {path}')
    return {'path': path.relative_to(root).as_posix(), 'sha256': digest(path), 'bytes': path.stat().st_size}


def macho_code(path):
    """Canonical arm64 code bytes, excluding the mutable embedded signature.

    The final resource seal is verified by codesign; the native archive SHA
    records every final byte. Keeping the code digest separate avoids sealing
    a manifest that contains the signature's own recursively dependent hash.
    """
    data = bytearray(Path(path).read_bytes())
    require(len(data) >= 32 and data[:4] == b'\xcf\xfa\xed\xfe', 'Native host requires a thin 64-bit Mach-O')
    require(struct.unpack_from('<I', data, 4)[0] == 0x0100000c, 'Native host requires arm64 code')
    commands, commands_bytes = struct.unpack_from('<II', data, 16)
    require(0 < commands <= 4096 and 32 + commands_bytes <= len(data), 'Malformed native Mach-O commands')
    offset, signature, linkedit = 32, None, None
    for _ in range(commands):
        require(offset + 8 <= 32 + commands_bytes, 'Truncated native Mach-O command')
        kind, size = struct.unpack_from('<II', data, offset)
        require(size >= 8 and offset + size <= 32 + commands_bytes, 'Malformed native Mach-O command size')
        if kind == 0x1d:
            require(size == 16 and signature is None, 'Ambiguous native code signature command')
            signature = struct.unpack_from('<II', data, offset + 8)
            data[offset + 8:offset + 16] = bytes(8)
        if kind == 0x19 and bytes(data[offset + 8:offset + 24]).rstrip(b'\0') == b'__LINKEDIT':
            require(size >= 72 and linkedit is None, 'Ambiguous native linkedit segment')
            linkedit = offset
            data[offset + 32:offset + 40] = bytes(8)
            data[offset + 48:offset + 56] = bytes(8)
        offset += size
    require(offset == 32 + commands_bytes and signature is not None and linkedit is not None, 'Native host has no linker-signed code contract')
    code_bytes, signature_bytes = signature
    require(code_bytes >= offset and signature_bytes > 0 and code_bytes + signature_bytes == len(data), 'Native signature must be the exact final code region')
    return {'code_sha256': hashlib.sha256(data[:code_bytes]).hexdigest(), 'code_bytes': code_bytes}


def code_record(root, path, build_sha256):
    record = macho_code(path)
    record.update(path=Path(path).relative_to(root).as_posix(), build_sha256=build_sha256)
    return record


def asset_files(directory):
    directory = Path(directory)
    require(directory.is_dir() and (directory / 'index.html').is_file(), f'Missing real built application: {directory}')
    files = []
    for path in sorted(directory.rglob('*')):
        require(not path.is_symlink(), f'Asset symlink is not admitted: {path}')
        if path.is_file():
            files.append(path)
        else:
            require(path.is_dir(), f'Unsupported asset type: {path}')
    require(files, f'Empty asset build: {directory}')
    return files


def asset_digest(directory):
    records = [file_record(Path(directory), path) for path in asset_files(directory)]
    return hashlib.sha256(json.dumps(records, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode()).hexdigest()


def artifact_paths(out, name):
    archive = Path(out) / name
    return archive, Path(str(archive) + '.sha256'), archive.with_name(name.removesuffix('.tar.gz') + '.asset.json')


def refuse_existing_artifacts(out, name):
    paths = artifact_paths(out, name)
    require(not any(path.exists() for path in paths), 'Candidate artifact already exists; refusing replacement')
    return paths


def qualify_profile(footprint, backing, products):
    require(footprint.get('schema') == 'oi.desktop-footprint/v1', 'Expected native desktop footprint')
    backing = backing or footprint['backing']['default']
    require(backing in footprint['backing']['options'], f'Backing {backing} is absent from native footprint')
    ids = footprint['backing']['options'][backing]['products']
    require(len(ids) == len(set(ids)) and set(ids) <= PRODUCT_IDS, 'Invalid native backing membership')
    require(products.get('schema') == 'oi.live-shell-products/v1', 'Expected exact candidate product bindings')
    supplied = [product['id'] for product in products['products']]
    require(len(supplied) == len(set(supplied)) and set(supplied) == set(ids), 'Product bindings differ from native backing; excluded products must be absent')
    return backing, ids


def qualify_host(app):
    app = Path(app)
    require(app.is_dir() and app.suffix == '.app', 'A real adapted Tauri .app is required')
    info = plistlib.loads((app / 'Contents/Info.plist').read_bytes())
    require(info.get('CFBundleExecutable') == 'oi-cradle', 'Candidate must retain the real oi-cradle native host')
    require(info.get('CFBundleIdentifier') == 'org.epilogos.oi.live-shell', 'Candidate must have its distinct native app identity')
    binary = native_executable(app / 'Contents/MacOS/oi-cradle', darwin_arm64=True)
    marker_path = app / 'Contents/Resources/live-shell-host.json'
    require(marker_path.is_file(), 'Native host has no candidate bootstrap marker; adapt/build the real Tauri host first')
    marker = read_json(marker_path)
    require(set(marker) == {'schema', 'source_revision', 'source_tree_sha256', 'source_dirty', 'executable_sha256', 'executable_code_sha256', 'executable_code_bytes', 'shell_assets_sha256', 'expressions_assets_sha256', 'bootstrap', 'source_archive'}, 'Unexpected native host marker fields')
    require(isinstance(marker['source_dirty'], bool), 'Native host must disclose dirty source standing')
    require(marker['schema'] == 'oi.live-shell-native-host/v1' and marker['bootstrap'] == BOOTSTRAP, 'Native host does not declare this candidate bootstrap')
    require(exact_hex(marker['source_revision'], 40) and exact_hex(marker['source_tree_sha256'], 64), 'Native host needs exact source provenance')
    require(marker['executable_sha256'] == digest(binary), 'Native host marker executable digest mismatch')
    code = macho_code(binary)
    require(marker['executable_code_sha256'] == code['code_sha256'] and marker['executable_code_bytes'] == code['code_bytes'], 'Native host code digest mismatch')
    require(all(exact_hex(marker[key], 64) for key in ['shell_assets_sha256', 'expressions_assets_sha256']), 'Native embedded asset provenance is missing')
    for path in app.rglob('*'):
        if path.is_symlink():
            require(path.resolve().is_relative_to(app.resolve()), f'Native app symlink escapes payload: {path}')
    require((app / 'Contents/Resources/shared-field/field-client.sh').is_file(), 'Native host must retain its real bundled SharedField client')
    require(not (app / 'Contents/_CodeSignature/CodeResources').exists(), 'A sealed distribution app needs a signing producer that includes the final payload; refuse invalidating its resource seal')
    qualify_host_sources(app, marker)
    return marker


def qualify_host_sources(app, marker, suite=None):
    app = Path(app)
    sources = marker['source_archive']
    require(isinstance(sources, dict) and set(sources) == {'archive', 'receipt'}, 'Native source archive binding is absent')
    for key, name in [('archive', 'sources.tar.gz'), ('receipt', 'receipt.json')]:
        path = app / 'Contents/Resources/live-shell-sources' / name
        require(sources[key] == file_record(app, path), 'Native source archive bytes differ from the qualified host')
    receipt = read_json(app / sources['receipt']['path'])
    basis = read_json(app / 'Contents/Resources/live-shell-build.json')
    require(receipt.get('schema') == 'oi.build-source-archive/v1' and basis.get('source_archive') == receipt,
            'Native source archive receipt differs from the build basis')
    require(all(basis.get(key) == marker[key] and receipt.get(key) == marker[key]
                for key in ['source_revision', 'source_dirty']), 'Native source archive provenance differs from the host')
    require(basis.get('source_tree_sha256') == marker['source_tree_sha256'] and
            receipt['phase_tree_sha256']['broad-staging'] == marker['source_tree_sha256'] and
            receipt['phase_tree_sha256']['native-normal-build'] == basis['native_build_inputs']['source_tree_sha256'] and
            receipt['phase_tree_sha256']['frontend-prebuild'] == basis['frontend_build']['source_tree_sha256'],
            'Native source archive phases differ from the actual build inputs')
    require(receipt['archive']['sha256'] == sources['archive']['sha256'] and
            receipt['archive']['size_bytes'] == sources['archive']['bytes'] and
            basis['native_build']['exit_code'] == 0,
            'Native source archive lacks successful compiler qualification')
    if suite is not None:
        require(receipt['phase_tree_sha256']['suite-normal-build'] == suite['source_tree_sha256'] and
                receipt['suite_release_artifact']['sha256'] == suite['sha256'] and
                Path(receipt['suite_release_artifact']['path']).resolve() == Path(suite['path']).resolve(),
                'Native source archive names another suite release basis')
    return receipt


def qualify_suite(binding):
    require(set(binding) == {'path', 'sha256', 'source_revision', 'source_tree_sha256'}, 'Suite CLI requires its exact build binding')
    binary = native_executable(binding['path'], darwin_arm64=True)
    require(binary.name == 'oi' and digest(binary) == binding['sha256'], 'Suite CLI binary/name digest mismatch')
    require(exact_hex(binding['source_revision'], 40) and exact_hex(binding['source_tree_sha256'], 64), 'Suite CLI needs independent source provenance')
    return binary


def relative(raw):
    require(isinstance(raw, str) and raw and '\\' not in raw and
            not PurePosixPath(raw).is_absolute() and
            all(part not in ('', '.', '..') for part in raw.split('/')),
            f'Expected contained product-relative path: {raw}')
    return raw


def qualify_owner_export(binding, item):
    path = Path(item['path'])
    require(binding['id'] == 'quaternal-logic' and path.name == 'ql-sky' and
            item.get('kind') == 'shell-script' and item.get('interpreter') == '/bin/sh',
            'Only the native QL sky owner export is a script entry')
    receipt_binding = item.get('provenance', {}).get('export_receipt', {})
    receipt_path = Path(receipt_binding.get('path', ''))
    require(receipt_path.is_file() and exact_hex(receipt_binding.get('sha256'), 64) and
            digest(receipt_path) == receipt_binding['sha256'] and
            receipt_path.stat().st_size == receipt_binding.get('bytes'), 'QL owner export receipt changed')
    receipt = read_json(receipt_path)
    artifact = receipt.get('artifact', {})
    require(receipt.get('schema') == 'ql.sky-command-export/v1' and
            'installed_uv_fallback' in receipt and receipt['installed_uv_fallback'] is None and
            artifact.get('kind') == 'shell-script' and artifact.get('interpreter') == '/bin/sh' and
            exact_hex(receipt.get('source_revision'), 40) and
            exact_hex(receipt.get('source_input_sha256'), 64) and
            receipt['source_input_sha256'] == item['provenance'].get('source_input_sha256'),
            'QL sky requires its exact fallback-free native export receipt')
    require(path.is_file() and os.access(path, os.X_OK) and
            path.read_bytes().startswith(b'#!/bin/sh\n') and
            digest(path) == artifact.get('sha256') == item.get('sha256') and
            path.stat().st_size == artifact.get('size_bytes'), 'QL exported executable differs from its owner receipt')
    bundled = [r for r in binding.get('resources', []) if r['path'] == 'sources/ql_export_receipt.json']
    require(len(bundled) == 1 and bundled[0]['sha256'] == receipt_binding['sha256'] and
            bundled[0]['bytes'] == receipt_binding['bytes'], 'QL native export receipt must travel with the executable')
    return receipt


def qualify_runtime_env(binding):
    env = binding.get('runtime_env', {})
    require(isinstance(env, dict), 'Runtime bindings must be an owner map')
    if binding['id'] != 'quaternal-logic':
        require(not env, 'No runtime environment extension is declared by this native owner')
        return env
    require(set(env) == {'QL_SKY_PYTHON', 'QL_NARA_PYTHON', 'QL_NARA_PROVIDER_CACHE'},
            'QL payload requires explicit interpreter and cache bindings')
    resource_paths = {r['path'] for r in binding.get('resources', [])}
    for name, value in env.items():
        require(set(value) == {'kind', 'path'}, f'Unexpected runtime binding fields: {name}')
        relative(value['path'])
        kind = 'cache' if name == 'QL_NARA_PROVIDER_CACHE' else 'executable'
        require(value['kind'] == kind, f'Native runtime binding kind mismatch: {name}')
        if kind == 'executable':
            require(value['path'] in resource_paths, 'Runtime interpreter must be a declared payload resource')
    return env


def qualify_product(binding, catalogue=None):
    require(exact_hex(binding.get('source_revision'), 40), f'Product {binding["id"]} lacks exact revision')
    descriptor_path = Path(binding['descriptor'])
    descriptor = read_json(descriptor_path)
    require(descriptor.get('schema') == 'oi.product-lifecycle/v1' and descriptor.get('id') == binding['id'], 'Native product lifecycle descriptor mismatch')
    binaries = binding['executables']
    require(binaries and len({Path(item['path']).name for item in binaries}) == len(binaries), 'Product binaries absent or duplicate')
    owner_entry = Path(descriptor['artifact']['entry']).name
    require(owner_entry in {Path(item['path']).name for item in binaries}, 'Product native entry is absent')
    catalogue = catalogue or read_json(Path(__file__).resolve().parents[2] / 'surfaces.json')
    surface = next((item for item in catalogue['surfaces'] if item['id'] == binding['id']), None)
    require(surface is not None, 'Native catalogue has no selected owner')
    companions = {item['executable'] for item in surface['native'].get('source_install', {}).get('companions', [])}
    require(companions <= {Path(item['path']).name for item in binaries}, 'Native owner-declared companion executable is absent')
    for item in binaries:
        if item.get('kind', 'native') == 'shell-script':
            qualify_owner_export(binding, item)
            binary = Path(item['path'])
        else:
            require(item.get('kind', 'native') == 'native', 'Unknown native executable kind')
            binary = native_executable(item['path'], darwin_arm64=True)
        require(exact_hex(item.get('sha256'), 64) and digest(binary) == item['sha256'], f'Product binary digest mismatch: {binary}')
    require(binding.get('notices'), f'Product {binding["id"]} needs its actual licence/notices')
    require(len({Path(path).name for path in binding['notices']}) == len(binding['notices']), 'Duplicate notice filename')
    for raw in binding['notices']:
        require(Path(raw).is_file() and not Path(raw).is_symlink(), f'Notice absent: {raw}')
    frozen = binding.get('provenance', {})
    if frozen:
        descriptor_record = frozen['descriptor']
        require(digest(descriptor_path) == descriptor_record['sha256'] and descriptor_path.stat().st_size == descriptor_record['bytes'], 'Frozen owner descriptor changed')
        expected_notices = {n['path']: n for n in frozen['notice_files']}
        require(set(expected_notices) == set(binding['notices']), 'Notices differ from frozen native input set')
        for raw in binding['notices']:
            require(digest(raw) == expected_notices[raw]['sha256'] and Path(raw).stat().st_size == expected_notices[raw]['bytes'], 'Frozen owner notice changed')
    resources = binding.get('resources', [])
    require(isinstance(resources, list) and len({r['path'] for r in resources}) == len(resources), 'Duplicate product resource path')
    reserved = {'product.json', 'provenance.json'} | {'bin/' + Path(b['path']).name for b in binaries} | {'notices/' + Path(n).name for n in binding['notices']}
    for item in resources:
        require(set(item) == {'source', 'path', 'sha256', 'bytes'}, 'Unexpected product resource fields')
        target = relative(item['path'])
        require(target not in reserved, f'Resource replaces an owned payload file: {target}')
        source = Path(item['source'])
        require(source.is_absolute() and source.is_file() and exact_hex(item['sha256'], 64) and
                digest(source) == item['sha256'] and source.stat().st_size == item['bytes'], f'Resource changed since native input freeze: {source}')
    qualify_runtime_env(binding)
    return descriptor_path


def macho(path):
    with Path(path).open('rb') as stream:
        return stream.read(4) in (bytes.fromhex('cffaedfe'), bytes.fromhex('cefaedfe'), bytes.fromhex('feedfacf'), bytes.fromhex('cafebabe'), bytes.fromhex('bebafeca'))


def load_commands(path):
    result = subprocess.run(['/usr/bin/otool', '-l', str(path)], check=True, capture_output=True, text=True).stdout.splitlines()
    kind, names, rpaths, identity = None, [], [], None
    for line in result:
        fields = line.strip().split()
        if fields[:1] == ['cmd']:
            kind = fields[1]
        elif fields[:1] == ['name'] and kind in ('LC_LOAD_DYLIB', 'LC_LOAD_WEAK_DYLIB', 'LC_REEXPORT_DYLIB', 'LC_LOAD_UPWARD_DYLIB'):
            names.append(line.strip()[5:].rsplit(' (offset ', 1)[0])
        elif fields[:1] == ['name'] and kind == 'LC_ID_DYLIB':
            identity = line.strip()[5:].rsplit(' (offset ', 1)[0]
        elif fields[:1] == ['path'] and kind == 'LC_RPATH':
            rpaths.append(line.strip()[5:].rsplit(' (offset ', 1)[0])
    return names, rpaths, identity


def relocate_and_sign(binding, destination, targets):
    transformations = binding.get('transformations', [])
    require(len({t['path'] for t in transformations}) == len(transformations), 'Duplicate native transformation target')
    for transformation in transformations:
        require(set(transformation) <= {'path', 'changes', 'id'}, 'Unexpected native transformation fields')
        raw = relative(transformation['path'])
        require(raw in targets and macho(targets[raw]), 'Relocation must target a declared Mach-O artifact')
        target = targets[raw]
        names, _, identity = load_commands(target)
        arguments = []
        for change in transformation.get('changes', []):
            require(set(change) == {'from', 'to'} and change['from'] in names, 'Relocation source is not an actual native load command')
            replacement = change['to']
            require(replacement.startswith('@loader_path/'), 'Native dependency relocation must be relative to its loader')
            resolved = (target.parent / replacement.removeprefix('@loader_path/')).resolve()
            require(resolved.is_file() and resolved.is_relative_to(destination.resolve()), 'Relocated native dependency must be present in its owner payload')
            arguments.extend(['-change', change['from'], replacement])
        if 'id' in transformation:
            require(identity is not None and transformation['id'].startswith(('@loader_path/', '@rpath/')), 'Native library identity must be relocatable')
            arguments.extend(['-id', transformation['id']])
        require(arguments, 'Empty native artifact transformation')
        subprocess.run(['/usr/bin/install_name_tool', *arguments, str(target)], check=True)
    native_paths = sorted({p for p in targets.values() if macho(p)})
    # Libraries/extensions are sealed individually before the containing app.
    # Preserve the exact original artifact digests in provenance, record final
    # signed bytes in the payload manifest.
    for target in native_paths:
        subprocess.run(['/usr/bin/codesign', '--force', '--sign', '-', str(target)], check=True, capture_output=True)
        subprocess.run(['/usr/bin/codesign', '--verify', '--strict', str(target)], check=True, capture_output=True)
    entries = [targets['bin/' + Path(e['path']).name] for e in binding['executables'] if e.get('kind', 'native') == 'native']
    entries += [targets[v['path']] for v in binding.get('runtime_env', {}).values() if v['kind'] == 'executable']
    commands = {path: load_commands(path) for path in native_paths}
    for target in native_paths:
        names, own_rpaths, _ = commands[target]
        def expand(value, loader, entry):
            return Path(value.replace('@loader_path', str(loader.parent)).replace('@executable_path', str(entry.parent)))
        for name in names:
            if name.startswith(('/usr/lib/', '/System/Library/')):
                continue
            candidates = []
            for entry in entries:
                if name.startswith('@rpath/'):
                    _, inherited, _ = commands[entry]
                    candidates.extend(expand(rpath, loader, entry) / name.removeprefix('@rpath/') for loader, rpaths in [(target, own_rpaths), (entry, inherited)] for rpath in rpaths)
                elif name.startswith(('@loader_path/', '@executable_path/')):
                    candidates.append(expand(name, target, entry))
            require(any(p.is_file() and p.resolve().is_relative_to(destination.resolve()) for p in candidates),
                    f'Native dependency is not contained in the installed owner payload: {target}: {name}')


def qualify_contribution_build(app, suite_binary):
    root = Path(app) / 'Contents/Resources/live-shell-contributions'
    proof = read_json(root / 'index.json')
    require(proof['schema'] == 'oi.live-shell-contributions/v1', 'Native contribution build schema mismatch')
    require(proof['producer']['sha256'] == digest(suite_binary) and
            proof['producer']['bytes'] == Path(suite_binary).stat().st_size,
            'Contribution compiler differs from the frozen suite CLI')
    records = proof['files']
    require(isinstance(records, list) and len({r['path'] for r in records}) == len(records), 'Duplicate contribution source')
    expected = {r['path'] for r in records}
    actual = {p.relative_to(root).as_posix() for p in root.rglob('*') if p.is_file() and p != root / 'index.json'}
    require(actual == expected, 'Contribution source inventory changed')
    for record in records:
        relative = Path(record['path'])
        require(not relative.is_absolute() and relative.parts and all(p not in ('.', '..') for p in relative.parts),
                'Contribution source path escapes its owner')
        path = root / relative
        require(not path.is_symlink() and path.resolve().is_relative_to(root.resolve()) and
                digest(path) == record['sha256'] and path.stat().st_size == record['bytes'], 'Contribution source changed')
    manifests = []
    for record in proof['contributions']:
        require(record['manifest'] in expected, 'Contribution manifest is outside the captured inventory')
        manifest = root / record['manifest']
        value = read_json(manifest)
        require(all(record[key] == value[key] for key in ['contribution_ref', 'owner', 'revision']),
                'Contribution identity differs from its source')
        manifests.append(str(manifest))
    require(manifests, 'Native application has no compiled contributions')
    compiled = subprocess.check_output([str(Path(suite_binary).resolve()), 'contribution', 'compile-registry',
                                        '--root', str(root), *manifests])
    require(compiled == (root / 'generated.ts').read_bytes() and
            digest(root / 'generated.ts') == proof['registry_sha256'], 'Native contribution compiler rejected the packaged registry')
    return proof


def copy_product(binding, app, products_root, catalogue=None):
    descriptor_path = qualify_product(binding, catalogue)
    binaries = binding['executables']
    destination = products_root / binding['id']
    (destination / 'bin').mkdir(parents=True)
    shutil.copy2(descriptor_path, destination / 'product.json')
    targets = {}
    for item in binaries:
        binary = Path(item['path'])
        target = destination / 'bin' / binary.name
        shutil.copy2(binary, target)
        require(digest(target) == item['sha256'], 'Native artifact changed during copy')
        targets['bin/' + binary.name] = target
    notices = []
    require(binding.get('notices'), f'Product {binding["id"]} needs its actual licence/notices')
    (destination / 'notices').mkdir()
    require(len({Path(path).name for path in binding['notices']}) == len(binding['notices']), 'Duplicate notice filename')
    for raw in binding['notices']:
        source = Path(raw)
        require(source.is_file() and not source.is_symlink(), f'Notice absent: {source}')
        target = destination / 'notices' / source.name
        shutil.copy2(source, target)
        notices.append(file_record(app, target))
    for item in binding.get('resources', []):
        target = destination / item['path']
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(item['source'], target, follow_symlinks=True)
        require(digest(target) == item['sha256'] and target.stat().st_size == item['bytes'], 'Native resource changed during copy')
        targets[item['path']] = target
    for value in binding.get('runtime_env', {}).values():
        if value['kind'] == 'executable':
            native_executable(targets[value['path']], darwin_arm64=True)
    relocate_and_sign(binding, destination, targets)
    provenance_path = destination / 'provenance.json'
    provenance_path.write_text(json.dumps({'schema': 'oi.live-shell-product-provenance/v1', 'input': binding}, indent=2, sort_keys=True) + '\n')
    exports = []
    for item in binaries:
        if item.get('kind') == 'shell-script':
            exports.append({'executable': file_record(app, targets['bin/' + Path(item['path']).name]),
                            'receipt': file_record(app, targets['sources/ql_export_receipt.json']),
                            'source_input_sha256': item['provenance']['source_input_sha256']})
    return {'id': binding['id'], 'source_revision': binding['source_revision'], 'descriptor': file_record(app, destination / 'product.json'),
            'executables': [file_record(app, targets['bin/' + Path(item['path']).name]) for item in binaries], 'notices': notices,
            'resources': [file_record(app, targets[item['path']]) for item in binding.get('resources', [])],
            'runtime_env': binding.get('runtime_env', {}), 'exports': exports, 'provenance': file_record(app, provenance_path)}


def application_support_module():
    path = Path(__file__).resolve().with_name('application-support.py')
    spec = importlib.util.spec_from_file_location('native_application_support', path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def package(args):
    require(sys.platform == 'darwin', 'Final native candidate sealing requires the Darwin codesign owner')
    footprint = read_json(args.footprint)
    bindings = read_json(args.products_manifest)
    backing, ids = qualify_profile(footprint, args.backing, bindings)
    marker = qualify_host(args.native_app)
    require('aarch64-apple-darwin' in footprint['targets'], 'Native footprint has no Darwin target')
    require(footprint['app_id'] == 'org.epilogos.oi.live-shell', 'Candidate footprint app identity mismatch')
    app_info = plistlib.loads((Path(args.native_app) / 'Contents/Info.plist').read_bytes())
    require(app_info.get('CFBundleIdentifier') == footprint['app_id'], 'Native application app identity mismatch')
    version = app_info.get('CFBundleShortVersionString')
    require(isinstance(version, str) and version and all(c.isalnum() or c in '._-' for c in version), 'Native app version cannot name an artifact')
    asset_files(args.shell_dist)
    asset_files(args.expressions_dist)
    require(marker['shell_assets_sha256'] == asset_digest(args.shell_dist) and marker['expressions_assets_sha256'] == asset_digest(args.expressions_dist), 'Assets differ from the real feature host build')
    suite_binary = qualify_suite(bindings['suite_cli'])
    qualify_host_sources(args.native_app, marker, bindings['suite_cli'])
    qualify_contribution_build(args.native_app, suite_binary)
    provenance = bindings.get('provenance', {})
    for record in provenance.values():
        require(Path(record['path']).is_file() and digest(record['path']) == record['sha256'] and Path(record['path']).stat().st_size == record['bytes'], 'Frozen suite input changed')
    catalogue_source = Path(provenance['catalogue']['path']) if provenance else Path(__file__).resolve().parents[2] / 'surfaces.json'
    catalogue = read_json(catalogue_source)
    require(catalogue.get('schema') == 1, 'Native source catalogue is unavailable')
    if provenance:
        require(bindings.get('backing_id') == backing and digest(args.footprint) == provenance['footprint']['sha256'], 'Package footprint/backing differs from frozen selection')
        basis = read_json(provenance['suite_source_basis']['path'])
        require(all(basis[key] == bindings['suite_cli'][key] for key in ['source_revision', 'source_tree_sha256']) and basis['artifact']['sha256'] == bindings['suite_cli']['sha256'] and basis['artifact']['profile'] == 'release', 'Suite CLI differs from frozen release basis')
    for raw in args.notice:
        require(Path(raw).is_file(), f'Candidate notice absent: {raw}')
    require(args.notice, 'Actual candidate third-party notices are required')
    for binding in bindings['products']:
        qualify_product(binding, catalogue)
    support_module = application_support_module()
    support_binding = read_json(args.application_support)
    support_module.qualify_support(support_binding, native_executable)
    if args.dry_run:
        return {'standing': 'preflight-only', 'backing_id': backing, 'product_ids': ids, 'source_revision': marker['source_revision'], 'native_app': str(Path(args.native_app).resolve()), 'writes': False}
    out = Path(args.out)
    name = f'oi-cradle-{version}-aarch64-apple-darwin.tar.gz'
    archive, checksum_path, asset_path = refuse_existing_artifacts(out, name)
    out.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='.shell-stage-', dir=out) as temporary:
        root = Path(temporary) / 'oi-desktop-bundle'
        app = root / 'app/O-I Shell Candidate.app'
        app.parent.mkdir(parents=True)
        shutil.copytree(args.native_app, app, symlinks=True)
        host_resources = [file_record(app, path) for path in sorted((app / 'Contents/Resources').rglob('*')) if path.is_file() and path.name != 'live-shell-host.json']
        resource = app / 'Contents/Resources/live-shell'
        require(not resource.exists() and not (app / 'SHELL-PAYLOAD.json').exists() and not (app / 'Contents/Resources/SHELL-PAYLOAD.json').exists(), 'Native app already carries a payload; supply its unfilled candidate host')
        resource.mkdir()
        shutil.copy2(catalogue_source, resource / 'catalogue-source.json')
        shutil.copy2(args.footprint, app / 'Contents/Resources/live-shell-footprint.json')
        (resource / 'bin').mkdir()
        shutil.copy2(suite_binary, resource / 'bin/oi')
        products_root = resource / 'native-products'
        products_root.mkdir()
        trees = {}
        for kind, source in [('shell', args.shell_dist), ('expressions', args.expressions_dist)]:
            target = resource / kind
            shutil.copytree(source, target)
            trees[kind] = {'root': target.relative_to(app).as_posix(), 'files': [file_record(app, p) for p in asset_files(target)]}
        products = [copy_product(binding, app, products_root, catalogue) for binding in sorted(bindings['products'], key=lambda item: item['id'])]
        node_runtime = support_module.copy_support(support_binding, app, native_executable,
                                                   relocate_and_sign, file_record)
        frozen_root = resource / 'provenance'
        frozen_root.mkdir()
        shutil.copy2(args.products_manifest, frozen_root / 'bindings.json')
        for key, record in provenance.items():
            require(key and all(c.isalnum() or c == '_' for c in key), 'Invalid frozen provenance name')
            target = frozen_root / (key + '.json')
            shutil.copy2(record['path'], target)
            require(digest(target) == record['sha256'], 'Frozen suite input changed during copy')
        notices = resource / 'notices'
        notices.mkdir()
        require(len({Path(path).name for path in args.notice}) == len(args.notice), 'Duplicate candidate notice filename')
        for raw in args.notice:
            shutil.copy2(raw, notices / Path(raw).name)
        suite_record = {'executable': file_record(app, resource / 'bin/oi'), 'source_revision': bindings['suite_cli']['source_revision'], 'source_tree_sha256': bindings['suite_cli']['source_tree_sha256']}
        payload = {'schema': 'oi.live-shell-payload/v1', 'source_revision': marker['source_revision'], 'source_tree_sha256': marker['source_tree_sha256'], 'source_dirty': marker['source_dirty'], 'backing_id': backing, 'product_ids': ids, 'products_root': products_root.relative_to(app).as_posix(), 'host': {'executable': code_record(app, app / 'Contents/MacOS/oi-cradle', marker['executable_sha256']), 'marker': file_record(app, app / 'Contents/Resources/live-shell-host.json'), 'suite_cli': suite_record}, 'shell': trees['shell'], 'expressions': trees['expressions'], 'products': products}
        payload['notices'] = [file_record(app, path) for path in sorted(notices.iterdir())]
        payload['footprint'] = file_record(app, app / 'Contents/Resources/live-shell-footprint.json')
        payload['catalogue'] = file_record(app, resource / 'catalogue-source.json')
        payload['host']['resources'] = host_resources
        payload['node_runtime'] = node_runtime
        payload['provenance'] = [file_record(app, path) for path in sorted(frozen_root.iterdir())]
        (app / 'Contents/Resources/SHELL-PAYLOAD.json').write_text(json.dumps(payload, indent=2) + '\n')
        subprocess.run(['/usr/bin/codesign', '--force', '--sign', '-', str(app)], check=True)
        subprocess.run(['/usr/bin/codesign', '--verify', '--strict', '--all-architectures', str(app)], check=True)
        require(macho_code(app / 'Contents/MacOS/oi-cradle') == {'code_sha256': marker['executable_code_sha256'], 'code_bytes': marker['executable_code_bytes']}, 'Signing changed qualified native code bytes')
        shutil.copy2(args.footprint, root / 'footprint.json')
        bundle = {'schema': 'oi.desktop-bundle/v1', 'name': name, 'version': version, 'target': 'aarch64-apple-darwin', 'app_id': footprint['app_id'], 'source_revision': marker['source_revision'], 'app_entry': 'app/O-I Shell Candidate.app', 'app_kind': 'app-bundle'}
        (root / 'BUNDLE.json').write_text(json.dumps(bundle, indent=2) + '\n')
        with tarfile.open(archive, 'x:gz') as stream:
            stream.add(root, arcname='oi-desktop-bundle', recursive=True)
    checksum = digest(archive)
    with checksum_path.open('x') as stream:
        stream.write(f'{checksum}  {name}\n')
    with asset_path.open('x') as stream:
        stream.write(json.dumps({'target': 'aarch64-apple-darwin', 'name': name, 'sha256': checksum}, indent=2) + '\n')
    return {'standing': 'packaged-bytes-only', 'archive': str(archive.resolve()), 'sha256': checksum, 'backing_id': backing, 'product_ids': ids, 'native_installer': ['oi', 'desktop', 'install', '--bundle', str(archive.resolve()), '--backing', backing], 'installed_acceptance': 'pending'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for option in ['native-app', 'shell-dist', 'expressions-dist', 'products-manifest', 'footprint', 'out']:
        parser.add_argument('--' + option, required=True)
    parser.add_argument('--application-support', required=True, help='Frozen official Node and SharedField SDK support receipt')
    parser.add_argument('--backing', help='Native footprint backing ID; defaults to its declared default')
    parser.add_argument('--notice', action='append', default=[])
    parser.add_argument('--dry-run', action='store_true')
    try:
        print(json.dumps(package(parser.parse_args()), indent=2))
    except (ValueError, OSError, KeyError, TypeError, json.JSONDecodeError, plistlib.InvalidFileException, subprocess.CalledProcessError) as error:
        parser.exit(2, f'Candidate packaging refused: {error}\n')


if __name__ == '__main__':
    main()
