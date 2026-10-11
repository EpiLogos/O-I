#!/usr/bin/env python3
"""Archive only unchanged, declared build sources; never recapture an old build.

The caller supplies the actual repository root, staging basis and optional
frontend pre-build basis. An exclusively published directory contains a
content-addressed source archive and its byte receipt. Build completion and
installed/runtime acceptance remain separate owner operations.
"""
import argparse
import gzip
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path, PurePosixPath
import tarfile
import tempfile
import tomllib

HERE = Path(__file__).resolve().parent


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


recorder = load('source_archive_recorder', HERE / 'record-cli-build.py')
payload = load('source_archive_payload', HERE / 'package-payload.py')
require = recorder.require
canonical = recorder.canonical
MAX_FILES = 250_000
MAX_FILE_BYTES = 256 * 1024 * 1024
MAX_SOURCE_BYTES = 2 * 1024 * 1024 * 1024


def ordinary_path(path):
    """Refuse symlinks in the entire lookup, including unrecorded ancestors."""
    path = Path(path).absolute()
    for part in (path, *path.parents):
        require(not part.is_symlink(), f'Source path crosses a symlink: {path}')
    require(path.is_file(), f'Declared source absent: {path}')
    return path


def read_recorded_basis(path):
    """Parse the exact bytes whose record is retained, through the owned reader."""
    path = ordinary_path(path)
    record = recorder.file_record(path)
    require(record['size_bytes'] <= 16 * 1024 * 1024, f'JSON exceeds 16 MiB: {path}')
    before = path.stat()
    descriptor = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    with os.fdopen(descriptor, 'rb') as stream:
        opened = os.fstat(stream.fileno())
        require((before.st_dev, before.st_ino, before.st_size, before.st_mtime_ns) ==
                (opened.st_dev, opened.st_ino, opened.st_size, opened.st_mtime_ns),
                f'Basis identity changed at open: {path}')
        raw = stream.read(16 * 1024 * 1024 + 1)
        after = os.fstat(stream.fileno())
        require((opened.st_dev, opened.st_ino, opened.st_size, opened.st_mtime_ns) ==
                (after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns),
                f'Basis descriptor changed during read: {path}')
    require(len(raw) == record['size_bytes'] and hashlib.sha256(raw).hexdigest() == record['sha256'],
            f'Basis bytes changed during read: {path}')
    ordinary_path(path)
    require(recorder.file_record(path) == record, f'Basis changed after read: {path}')
    # Use the existing duplicate-key refusing reader on a private, anonymous
    # snapshot descriptor. It cannot reread a replacement at the original path.
    # No raw basis (which also contains tool/env readings) enters the archive.
    with tempfile.TemporaryFile(dir=path.parent) as snapshot:
        snapshot.write(raw)
        snapshot.flush()
        snapshot.seek(0)
        value = payload.read_json(Path('/dev/fd') / str(snapshot.fileno()))
    return value, record


def source_record(record, root, relative):
    require(isinstance(record, dict), 'Source record must be an object')
    allowed = {'path', 'bytes', 'sha256'} if relative else {'path', 'size_bytes', 'sha256'}
    require(set(record) == allowed, f'Unsupported source record fields: {record.get("path")}')
    require(payload.exact_hex(record['sha256'], 64), 'Invalid declared source digest')
    size = record['bytes' if relative else 'size_bytes']
    require(type(size) is int and 0 <= size <= MAX_FILE_BYTES, 'Invalid or excessive source size')
    name = record['path']
    require(isinstance(name, str) and name and '\x00' not in name and '\\' not in name,
            'Invalid declared source path')
    path = PurePosixPath(name)
    require(path.as_posix() == name, f'Noncanonical declared source path: {name}')
    require(all(p not in ('', '.', '..') for p in name.split('/') if p or not path.is_absolute()),
            f'Uncontained source path: {name}')
    if relative:
        require(not path.is_absolute(), f'Broad source must be repository relative: {name}')
        actual = root / name
    else:
        require(path.is_absolute(), f'Native source must retain its absolute path: {name}')
        actual = Path(name)
    actual = ordinary_path(actual)
    if relative:
        require(actual.resolve().is_relative_to(root), f'Broad source escapes actual root: {name}')
    expected = {'path': str(actual), 'size_bytes': size, 'sha256': record['sha256']}
    require(recorder.file_record(actual) == expected, f'Declared source bytes changed: {actual}')
    return actual, expected


def no_secret_source(path, content):
    # These are source objects, never a credential or environment shipment.
    require(path.name not in ('.env', '.npmrc', '.netrc', 'credentials', 'credentials.toml',
                              'id_rsa', 'id_ed25519') and not path.name.startswith('.env.'),
            f'Credential/environment source is not admissible: {path}')
    require(not content.startswith((b'\x7fELF', bytes.fromhex('cffaedfe'), bytes.fromhex('cafebabe'))),
            f'Compiler/executable object is not a source input: {path}')
    require(not any(line.strip().startswith((b'-----BEGIN PRIVATE KEY-----', b'-----BEGIN RSA PRIVATE KEY-----',
                                             b'-----BEGIN OPENSSH PRIVATE KEY-----', b'-----BEGIN EC PRIVATE KEY-----'))
                    for line in content.splitlines()),
            f'Private key is not a source input: {path}')
    if path.name in ('config', 'config.toml') and '.cargo' in path.parts:
        configuration = tomllib.loads(content.decode('utf-8'))
        def inspect(value):
            if isinstance(value, dict):
                for key, child in value.items():
                    require(key.lower().replace('_', '-') not in ('token', 'password', 'authorization', 'private-key'),
                            f'Credential-bearing Cargo configuration is not admissible: {path}')
                    inspect(child)
            elif isinstance(value, list):
                for child in value:
                    inspect(child)
        inspect(configuration)


def snapshot_object(actual, expected, objects):
    """The bytes written, not a preceding checksum, decide object identity."""
    require(recorder.file_record(actual) == expected, f'Source changed before copy: {actual}')
    target = objects / expected['sha256']
    before = actual.stat()
    descriptor = os.open(actual, os.O_RDONLY | os.O_NOFOLLOW)
    with os.fdopen(descriptor, 'rb') as stream:
        opened = os.fstat(stream.fileno())
        require((before.st_dev, before.st_ino, before.st_size, before.st_mtime_ns) ==
                (opened.st_dev, opened.st_ino, opened.st_size, opened.st_mtime_ns),
                f'Source identity changed at open: {actual}')
        content = stream.read(MAX_FILE_BYTES + 1)
        after = os.fstat(stream.fileno())
        require((opened.st_dev, opened.st_ino, opened.st_size, opened.st_mtime_ns) ==
                (after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns),
                f'Source descriptor changed during copy: {actual}')
    require(len(content) == expected['size_bytes'] and hashlib.sha256(content).hexdigest() == expected['sha256'],
            f'Source changed during copy: {actual}')
    no_secret_source(actual, content)
    ordinary_path(actual)
    require(recorder.file_record(actual) == expected, f'Source changed after copy: {actual}')
    if not target.exists():
        with target.open('xb') as stream:
            stream.write(content)
        target.chmod(0o600)
    else:
        require(recorder.sha(target) == expected['sha256'] and target.stat().st_size == expected['size_bytes'],
                'Content-addressed source collision')
    return 'objects/sha256/' + expected['sha256']


def phase(name, basis, relative):
    records = basis.get('source_files')
    require(isinstance(records, list) and 0 < len(records) <= MAX_FILES, f'Empty/excessive source phase: {name}')
    require(len({r.get('path') for r in records if isinstance(r, dict)}) == len(records),
            f'Duplicate/invalid source paths: {name}')
    digest = hashlib.sha256(canonical(records)).hexdigest()
    require(basis.get('source_tree_sha256') == digest, f'Declared tree digest differs: {name}')
    result = {'id': name, 'path_format': 'repository-relative' if relative else 'absolute-owner-source',
              'source_tree_sha256': digest, 'declared_source_files': records, 'files': []}
    if 'source_revision' in basis or 'source_dirty' in basis:
        require(payload.exact_hex(basis.get('source_revision'), 40) and type(basis.get('source_dirty')) is bool,
                f'Phase revision/dirty standing is absent: {name}')
        result.update(source_revision=basis['source_revision'], source_dirty=basis['source_dirty'])
    return result


def graph_owners(native, scope='native-normal-build'):
    dependencies = native.get('dependency_packages')
    require(isinstance(dependencies, list) and dependencies, 'Declared normal/build dependency graph is absent')
    owners = []
    for index, dependency in enumerate(dependencies):
        require(isinstance(dependency, dict) and isinstance(dependency.get('manifest_path'), str),
                'Invalid native dependency owner')
        manifest = Path(dependency['manifest_path'])
        require(manifest.is_absolute(), 'Native owner manifest must retain its absolute path')
        owners.append({'id': f'{scope}-package-{index}', 'source_root': str(manifest.parent),
                       'declared_package': dependency})
    return owners


def suite_artifact(basis):
    require(basis.get('schema') == 'oi.cli-build-basis/v1', 'Expected actual suite CLI build basis')
    require(payload.exact_hex(basis.get('source_revision'), 40) and type(basis.get('source_dirty')) is bool,
            'Suite source revision/dirty standing is absent')
    verification = basis.get('verification', {})
    require(verification.get('source_inputs_unchanged_before_and_after') is True and
            verification.get('build_exit_code') == 0, 'Suite release compiler qualification is absent')
    artifact = basis.get('artifact', {})
    command = artifact.get('build_command')
    require(artifact.get('profile') == 'release' and isinstance(command, list) and
            all(isinstance(p, str) for p in command) and 'cargo' in command and
            'build' in command and '--release' in command, 'Suite release build command is absent')
    path = ordinary_path(artifact.get('path', ''))
    require(path.name == 'oi', 'Suite artifact must be the actual oi owner')
    payload.native_executable(path, darwin_arm64=True)
    require(payload.exact_hex(artifact.get('sha256'), 64) and type(artifact.get('size_bytes')) is int,
            'Suite artifact digest/size is absent')
    expected = {'path': str(path), 'sha256': artifact['sha256'], 'size_bytes': artifact['size_bytes']}
    require(recorder.file_record(path) == expected, 'Suite release artifact differs from its recorded basis')
    return expected


def mapping(actual, root, owners, registries):
    matches = [o for o in owners if actual.is_relative_to(Path(o['source_root']))]
    # The nearest actual manifest is the source owner; enclosing workspace
    # membership is still present in the full declared graph above.
    if matches:
        longest = max(len(Path(o['source_root']).parts) for o in matches)
        matches = [o for o in matches if len(Path(o['source_root']).parts) == longest]
    archives = [r['root'] for r in registries if r.get('source_archive') == str(actual)]
    if actual.is_relative_to(root):
        source_root, kind = str(root), 'declared-repository-source'
    elif matches:
        source_root, kind = matches[0]['source_root'], 'declared-native-package-source'
    else:
        source_root, kind = str(actual.parent), 'declared-external-build-input'
    return {'absolute_path': str(actual), 'source_root': source_root,
            'root_relative_path': actual.relative_to(Path(source_root)).as_posix(), 'kind': kind,
            'native_owner_ids': [o['id'] for o in matches], 'registry_archive_for_roots': archives}


def tar_member(archive, name, content):
    info = tarfile.TarInfo(name)
    info.size = len(content)
    info.mode = 0o644
    info.mtime = 0
    archive.addfile(info, io.BytesIO(content))


def archive_sources(args):
    root = Path(args.source_root).absolute()
    require(root.is_dir() and root.resolve() == root, 'Explicit canonical source root is required')
    require(all(not p.is_symlink() for p in (root, *root.parents)), 'Source root crosses a symlink')
    output = Path(args.output).absolute()
    require(not output.exists() and not output.is_symlink(), 'Refusing existing source archive destination')
    basis_path = ordinary_path(args.basis)
    basis, basis_record = read_recorded_basis(basis_path)
    require(payload.exact_hex(basis.get('source_revision'), 40) and type(basis.get('source_dirty')) is bool,
            'Actual staging revision/dirty standing is absent')
    native = basis.get('native_build_inputs')
    require(isinstance(native, dict), 'Actual staged normal/build input declarations are required')
    phases = [phase('broad-staging', basis, True), phase('native-normal-build', native, False)]
    inputs = [{'role': 'staging-basis', **basis_record}]
    if args.frontend_basis:
        frontend_path = ordinary_path(args.frontend_basis)
        frontend, frontend_record = read_recorded_basis(frontend_path)
        require(frontend.get('source_revision') == basis['source_revision'], 'Frontend/staging revisions differ')
        phases.insert(0, phase('frontend-prebuild', frontend, True))
        inputs.insert(0, {'role': 'frontend-prebuild-basis', **frontend_record})
    owners = graph_owners(native)
    registries = native.get('registry_sources', [])
    require(isinstance(registries, list), 'Invalid declared registry mapping')
    graphs = {'native-normal-build': {'source_root': str(root), 'source_revision': basis['source_revision'],
                                     'source_dirty': basis['source_dirty'], 'package_owners': owners,
                                     'registry_sources': registries, 'git_dependencies': native.get('git_dependencies', [])}}
    suite = None
    artifact = None
    if args.suite_basis:
        suite_path = ordinary_path(args.suite_basis)
        suite, suite_record = read_recorded_basis(suite_path)
        artifact = suite_artifact(suite)
        suite_root = Path(suite.get('source_root', ''))
        require(suite_root.is_absolute() and suite_root.resolve() == suite_root and suite_root.is_dir(),
                'Suite basis must disclose its actual canonical source root')
        phases.append(phase('suite-normal-build', suite, False))
        suite_owners = graph_owners(suite, 'suite-normal-build')
        suite_registries = suite.get('registry_sources', [])
        require(isinstance(suite_registries, list), 'Invalid suite registry mapping')
        graphs['suite-normal-build'] = {'source_root': str(suite_root), 'source_revision': suite['source_revision'],
                                       'source_dirty': suite['source_dirty'], 'package_owners': suite_owners,
                                       'registry_sources': suite_registries, 'git_dependencies': suite.get('git_dependencies', [])}
        inputs.append({'role': 'suite-release-basis', **suite_record})
    output.parent.mkdir(parents=True, exist_ok=True)
    require(output.parent.resolve() == output.parent, 'Archive destination crosses a symlink')
    with tempfile.TemporaryDirectory(prefix='.source-archive-', dir=output.parent) as temporary:
        stage = Path(temporary) / 'published'
        objects = Path(temporary) / 'objects'
        stage.mkdir(mode=0o700)
        objects.mkdir(mode=0o700)
        verified, total = {}, 0
        for item in phases:
            relative = item['path_format'] == 'repository-relative'
            graph = graphs['suite-normal-build' if item['id'] == 'suite-normal-build' else 'native-normal-build']
            phase_root = Path(graph['source_root'])
            item['source_root'] = str(phase_root)
            item.setdefault('source_revision', graph['source_revision'])
            item.setdefault('source_dirty', graph['source_dirty'])
            for record in item['declared_source_files']:
                actual, expected = source_record(record, phase_root, relative)
                require(not actual.is_relative_to(output), 'Source archive cannot consume its own destination')
                previous = verified.get(str(actual))
                require(previous is None or previous == expected, f'Phases declare different bytes for one source: {actual}')
                if previous is None:
                    total += expected['size_bytes']
                    require(total <= MAX_SOURCE_BYTES, 'Declared sources exceed 2 GiB archive budget')
                    verified[str(actual)] = expected
                object_path = snapshot_object(actual, expected, objects)
                item['files'].append({'declared_path': record['path'], 'object': object_path,
                                      'sha256': record['sha256'], 'size_bytes': expected['size_bytes'],
                                      **mapping(actual, phase_root, graph['package_owners'], graph['registry_sources'])})
        recorder.verify_records(list(verified.values()))
        manifest = {'schema': 'oi.build-source-objects/v1', 'source_root': str(root),
                    'source_revision': basis['source_revision'], 'source_dirty': basis['source_dirty'],
                    'standing': 'verified declared input bytes; build completion remains separately qualified',
                    'basis_inputs': inputs, 'phases': phases, 'owner_graphs': graphs,
                    'suite_release_artifact': artifact}
        manifest_bytes = canonical(manifest)
        archive_path = stage / 'sources.tar.gz'
        with archive_path.open('xb') as raw:
            with gzip.GzipFile(filename='', fileobj=raw, mode='wb', mtime=0) as zipped:
                with tarfile.open(fileobj=zipped, mode='w', format=tarfile.PAX_FORMAT) as archive:
                    tar_member(archive, 'SOURCE-OBJECTS.json', manifest_bytes)
                    for obj in sorted(objects.iterdir()):
                        tar_member(archive, 'objects/sha256/' + obj.name, obj.read_bytes())
            raw.flush()
            os.fsync(raw.fileno())
        archive_path.chmod(0o600)
        # Verify the published representation, including every embedded object.
        with tarfile.open(archive_path, 'r:gz') as archive:
            require(archive.extractfile('SOURCE-OBJECTS.json').read() == manifest_bytes, 'Archive manifest differs')
            for obj in objects.iterdir():
                content = archive.extractfile('objects/sha256/' + obj.name).read()
                require(hashlib.sha256(content).hexdigest() == obj.name, 'Archived source object differs')
        recorder.verify_records(list(verified.values()))
        if suite:
            require(suite_artifact(suite) == artifact, 'Suite artifact changed during source archive publication')
        for item in inputs:
            require(recorder.file_record(item['path']) == {k: v for k, v in item.items() if k != 'role'},
                    'Input basis changed during archive publication')
        receipt = {'schema': 'oi.build-source-archive/v1', 'standing': manifest['standing'],
                   'archive': {'path': str(output / archive_path.name), 'sha256': recorder.sha(archive_path),
                               'size_bytes': archive_path.stat().st_size},
                   'manifest_sha256': hashlib.sha256(manifest_bytes).hexdigest(), 'basis_inputs': inputs,
                   'source_revision': basis['source_revision'], 'source_dirty': basis['source_dirty'],
                   'phase_tree_sha256': {p['id']: p['source_tree_sha256'] for p in phases},
                   'suite_release_artifact': artifact,
                   'unique_source_paths': len(verified), 'unique_objects': len(list(objects.iterdir())),
                   'source_bytes': total}
        receipt_path = stage / 'receipt.json'
        with receipt_path.open('x') as stream:
            json.dump(receipt, stream, indent=2, sort_keys=True)
            stream.write('\n')
            stream.flush()
            os.fsync(stream.fileno())
        receipt_path.chmod(0o600)
        descriptor = os.open(stage, os.O_RDONLY)
        try:
            os.fsync(descriptor)
        finally:
            os.close(descriptor)
        # Claim the destination exclusively; never replace foreign output.
        output.mkdir(mode=0o700)
        try:
            os.replace(stage, output)
            descriptor = os.open(output.parent, os.O_RDONLY)
            try:
                os.fsync(descriptor)
            finally:
                os.close(descriptor)
        except BaseException:
            if output.is_dir() and not any(output.iterdir()):
                output.rmdir()
            raise
    return receipt


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('source-root', 'basis', 'output'):
        parser.add_argument('--' + name, required=True, type=Path)
    parser.add_argument('--frontend-basis', type=Path)
    parser.add_argument('--suite-basis', type=Path, help='Actual qualified suite CLI release basis; sources only, no executable copy')
    try:
        result = archive_sources(parser.parse_args())
        print(json.dumps(result, sort_keys=True))
    except (OSError, ValueError, KeyError, TypeError, tarfile.TarError) as error:
        parser.exit(2, f'Declared source archive refused: {error}\n')


if __name__ == '__main__':
    main()
