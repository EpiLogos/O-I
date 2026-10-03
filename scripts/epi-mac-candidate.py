#!/usr/bin/env python3
"""Build committed native Mac delivery artifacts; never install or launch them."""
import argparse
import hashlib
import json
import os
import platform
import shutil
import stat
import subprocess
import tarfile
from pathlib import Path


def digest(path):
    with path.open('rb') as source:
        return hashlib.file_digest(source, 'sha256').hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('repo', 'ql-source', 'central-source', 'act-source', 'output'):
        parser.add_argument('--' + name, required=True, type=Path)
    parser.add_argument('--expected-oi-head', required=True)
    parser.add_argument('--expected-ql-head', required=True)
    parser.add_argument('--expected-central-head', required=True)
    parser.add_argument('--expected-act-head', required=True)
    args = parser.parse_args()
    if platform.system() != 'Darwin' or platform.machine() != 'arm64':
        raise RuntimeError('The canonical Mac bundle requires an actual Darwin arm64 builder')
    out = args.output.resolve()
    out.mkdir(parents=True, exist_ok=False)
    receipt = {'schema': 'oi.epi-mac-candidate/v1', 'pass': False,
               'standing': 'native-host build artifacts only; no installed, rendered, causal or human acceptance',
               'host': platform.uname()._asdict(), 'sources': {}, 'commands': [], 'artifacts': {}}
    env = os.environ.copy()
    env['CARGO_BUILD_JOBS'] = '2'

    def run(argv, cwd, command_env=None, timeout=2400):
        number = len(receipt['commands']) + 1
        log = out / 'commands' / (str(number).zfill(3) + '.log')
        log.parent.mkdir(exist_ok=True)
        record = {'argv': list(map(str, argv)), 'cwd': str(cwd), 'log': str(log.relative_to(out))}
        receipt['commands'].append(record)
        print(json.dumps({'command': record}), flush=True)
        try:
            with log.open('wb') as stream:
                result = subprocess.run(record['argv'], cwd=cwd, env=command_env or env,
                                        stdout=stream, stderr=subprocess.STDOUT, timeout=timeout, check=False)
            record['exit_code'] = result.returncode
            record['sha256'] = digest(log)
            if result.returncode:
                raise RuntimeError('Actual command failed: ' + ' '.join(record['argv']) + '; see ' + record['log'])
        except BaseException as error:
            record['failure'] = str(error)
            raise

    def archive_source(name, repository, expected):
        repository = repository.resolve()
        actual = subprocess.check_output(['git', '-C', str(repository), 'rev-parse', 'HEAD'], text=True).strip()
        if actual != expected or len(expected) != 40:
            raise RuntimeError(name + ': unexpected committed source')
        tree = subprocess.check_output(['git', '-C', str(repository), 'rev-parse', 'HEAD^{tree}'], text=True).strip()
        archive = out / (name + '-source.tar')
        with archive.open('wb') as stream:
            subprocess.run(['git', '-C', str(repository), 'archive', '--format=tar', actual], stdout=stream, check=True)
        # Export below this exact checked-out repository so the unchanged
        # canonical packager's Git probe sees the qualified parent HEAD.
        export = repository / '.epi-mac-committed-source'
        export.mkdir(exist_ok=False)
        records = []
        with tarfile.open(archive) as source:
            for member in source:
                path = Path(member.name)
                if path.is_absolute() or '..' in path.parts:
                    raise RuntimeError('Unsafe committed source member')
                source.extract(member, export, filter='data')
                target = export / member.name
                row = {'path': member.name, 'mode': stat.S_IMODE(target.lstat().st_mode)}
                if member.isfile():
                    records.append(row | {'kind': 'file', 'sha256': digest(target), 'bytes': target.stat().st_size})
                elif member.issym():
                    records.append(row | {'kind': 'symlink', 'target': str(target.readlink())})
                elif member.isdir():
                    records.append(row | {'kind': 'directory'})
                else:
                    raise RuntimeError('Unsupported committed source member')
        inherited = subprocess.check_output(['git', '-C', str(export), 'rev-parse', '--show-toplevel'], text=True).strip()
        inherited_head = subprocess.check_output(['git', '-C', str(export), 'rev-parse', 'HEAD'], text=True).strip()
        if Path(inherited).resolve() != repository or inherited_head != actual:
            raise RuntimeError(name + ': export does not inherit the exact qualified parent repository')
        receipt['sources'][name] = {'repository': str(repository), 'revision': actual, 'tree': tree,
                                    'archive': archive.name, 'archive_sha256': digest(archive),
                                    'inherited_git_root': inherited, 'inherited_git_head': inherited_head,
                                    'export': str(export), 'files': records}
        return export

    def qualify_sources():
        for name, source in receipt['sources'].items():
            for record in source['files']:
                path = Path(source['export']) / record['path']
                mode_matches = stat.S_IMODE(path.lstat().st_mode) == record['mode']
                if record['kind'] == 'file':
                    matches = path.is_file() and not path.is_symlink() and digest(path) == record['sha256']
                elif record['kind'] == 'symlink':
                    matches = path.is_symlink() and str(path.readlink()) == record['target']
                else:
                    matches = path.is_dir() and not path.is_symlink()
                if not mode_matches or not matches:
                    raise RuntimeError(name + ': build changed committed input ' + record['path'])
            actual = subprocess.check_output(['git', '-C', source['repository'], 'rev-parse', 'HEAD'], text=True).strip()
            inherited = subprocess.check_output(['git', '-C', source['export'], 'rev-parse', '--show-toplevel'], text=True).strip()
            inherited_head = subprocess.check_output(['git', '-C', source['export'], 'rev-parse', 'HEAD'], text=True).strip()
            if (actual != source['revision'] or inherited_head != actual
                    or Path(inherited).resolve() != Path(source['repository'])):
                raise RuntimeError(name + ': parent source moved during build')

    try:
        oi = archive_source('oi', args.repo, args.expected_oi_head)
        ql = archive_source('quaternal-logic', args.ql_source, args.expected_ql_head)
        central = archive_source('central', args.central_source, args.expected_central_head)
        act = archive_source('actuation-instrument', args.act_source, args.expected_act_head)
        copied = oi / 'desktop/cradle/expressions-app/field-studies-journeys/src/native-field/ql'
        provenance = json.loads((copied / 'PROVENANCE.json').read_text())
        if provenance['revision'] != args.expected_ql_head:
            raise RuntimeError('Mac frontend adapter and native QL cut differ')
        for name, expected in provenance['files'].items():
            if digest(copied / name) != expected or digest(ql / 'adapters/retained-field' / name) != expected:
                raise RuntimeError('Mac frontend copied adapter differs from exact native owner: ' + name)
        receipt['frontend_ql_join'] = provenance
        receipt['tool_images'] = {}
        for argv in (['node', '--version'], ['rustc', '--version'], ['spacetime', '--version'], ['uv', '--version']):
            resolved = Path(shutil.which(argv[0])).resolve(strict=True)
            receipt['tool_images'][argv[0]] = {'resolved': str(resolved), 'sha256': digest(resolved), 'bytes': resolved.stat().st_size}
            run(argv, oi, timeout=30)
        receipt['tool_images']['rustc']['standing'] = 'PATH dispatcher; actual selected compiler recorded separately'
        receipt['selected_rust_tools'] = {}
        for name in ('rustc', 'cargo'):
            selected = Path(subprocess.check_output(['rustup', 'which', name], text=True).strip()).resolve(strict=True)
            receipt['selected_rust_tools'][name] = {'resolved': str(selected), 'sha256': digest(selected),
                                                     'bytes': selected.stat().st_size,
                                                     'version': subprocess.check_output([str(selected), '--version'], text=True)}
        builds = {}
        for name, root, revision, argv in (
            ('quaternal-logic', ql, args.expected_ql_head, ['sh', 'scripts/oi-source-install.sh']),
            ('central', central, args.expected_central_head, ['cargo', 'build', '--locked', '--release', '-p', 'ctrl']),
            ('oi', oi, args.expected_oi_head, ['cargo', 'build', '--locked', '--release', '--manifest-path', 'cli/Cargo.toml', '--bin', 'oi'])):
            owner_env = env | {'CARGO_TARGET_DIR': str(out / 'build' / name), 'SUITE_BUILD_REVISION': revision}
            run(argv, root, owner_env)
            builds[name] = Path(owner_env['CARGO_TARGET_DIR']) / 'release'
        native = out / 'native'
        instrument_env = env | {'CARGO_TARGET_DIR': str(out / 'build' / 'actuation-instrument')}
        instrument_manifest = 'experiments/ql-runtime/native-owner-instrument/Cargo.toml'
        run(['cargo', 'test', '--locked', '--manifest-path', instrument_manifest], act, instrument_env)
        run(['cargo', 'build', '--locked', '--release', '--manifest-path', instrument_manifest], act, instrument_env)
        # Construct the existing Prime launcher and native research parent from
        # the same archived Actuation source in this sequential owned build slot.
        parent_build_logs = {}
        for package, executable in (('actuation-cli', 'actuation-epi-prime'),
                                    ('actuation-research', 'actuation-research')):
            run(['cargo', 'build', '--locked', '--release', '-p', package, '--bin', executable], act, instrument_env)
            parent_build_logs[executable] = receipt['commands'][-1]['log']
        builds['actuation-instrument'] = Path(instrument_env['CARGO_TARGET_DIR']) / 'release'
        for name, names in (('oi', ('oi',)), ('central', ('ctrl',)),
                            ('quaternal-logic', ('ql', 'ql-field-host', 'ql-focused-host', 'ql-field-worker', 'ql-sky')),
                            ('actuation-instrument', ('actuation-ql-owner-instrument', 'actuation-epi-prime', 'actuation-research'))):
            destination = native / name
            destination.mkdir(parents=True)
            for executable in names:
                source = builds[name] / executable
                target = destination / executable
                if not source.is_file() or source.is_symlink() or not os.access(source, os.X_OK):
                    raise RuntimeError(name + ': missing executable ' + executable)
                shutil.copy2(source, target)
                description = subprocess.check_output(['/usr/bin/file', '-b', str(target)], text=True).strip()
                row = {'sha256': digest(target), 'source_revision': receipt['sources'][name]['revision'],
                       'bytes': target.stat().st_size, 'mode': stat.S_IMODE(target.stat().st_mode), 'file_description': description}
                if name == 'actuation-instrument' and executable in parent_build_logs:
                    if source.stat().st_size != row['bytes'] or digest(source) != row['sha256']:
                        raise RuntimeError('Copied native parent differs from its actual build output: ' + executable)
                    row['build_output'] = str(source)
                    row['build_command_log'] = parent_build_logs[executable]
                    row['source_tree'] = receipt['sources'][name]['tree']
                if executable == 'ql-sky':
                    if not target.read_bytes().startswith(b'#!/bin/sh\n'):
                        raise RuntimeError('ql-sky is not the canonical generated provider script')
                else:
                    architecture = subprocess.check_output(['/usr/bin/lipo', '-archs', str(target)], text=True).strip()
                    if architecture != 'arm64' or 'Mach-O' not in description:
                        raise RuntimeError('Native artifact is not Mach-O arm64: ' + executable)
                    row['architectures'] = architecture
                    row['otool_dependencies'] = subprocess.check_output(['/usr/bin/otool', '-L', str(target)], text=True)
                receipt['artifacts'][str(target.relative_to(out))] = row
        instrument = native / 'actuation-instrument' / 'actuation-ql-owner-instrument'
        request = {'operation': 'vocabulary'}
        operation = subprocess.run([str(instrument)], input=json.dumps(request),
                                   text=True, capture_output=True, timeout=30, check=False)
        receipt['instrument_native_vocabulary_invocation'] = {'request': request, 'argv': [str(instrument)],
                                                               'returncode': operation.returncode,
                                                               'stdout': operation.stdout, 'stderr': operation.stderr}
        if operation.returncode != 0:
            raise RuntimeError('Actual instrument vocabulary invocation failed; raw result retained')
        observed = json.loads(operation.stdout)
        if observed['owner_revision'] != args.expected_ql_head or not observed.get('result'):
            raise RuntimeError('Actual instrument does not receive the current QL vocabulary')
        receipt['instrument_native_vocabulary'] = observed
        for name, executable, revision in (('oi', 'oi', args.expected_oi_head), ('central', 'ctrl', args.expected_central_head),
                                           ('quaternal-logic', 'ql', args.expected_ql_head)):
            binary = native / name / executable
            version = subprocess.check_output([str(binary), '--version'], text=True, timeout=30)
            if revision not in version and revision[:12] not in version:
                raise RuntimeError(name + ': actual primary does not name its committed cut')
            receipt['artifacts'][str(binary.relative_to(out))]['version_output'] = version
        bundle_env = env | {'CARGO_TARGET_DIR': str(out / 'build' / 'desktop'), 'SUITE_BUILD_REVISION': args.expected_oi_head}
        run(['bash', 'desktop/cradle/package-bundle.sh', '--out', str(out / 'bundle')], oi, bundle_env)
        receipt['emitted_frontend'] = []
        for directory in (oi / 'desktop/cradle/dist', oi / 'desktop/cradle/expressions-app/dist'):
            if not directory.is_dir():
                raise RuntimeError('Native app build did not emit frontend: ' + str(directory))
            for path in sorted(directory.rglob('*')):
                if path.is_file():
                    if path.is_symlink():
                        raise RuntimeError('Emitted frontend contains a symlink')
                    receipt['emitted_frontend'].append({'path': str(path.relative_to(oi)), 'bytes': path.stat().st_size,
                                                         'sha256': digest(path)})
        # Retain actual emitted bytes for the controlled HTTP receiving gate.
        # Receipt rows alone and a compiled native bundle cannot serve HTML.
        frontend_rel = 'desktop/cradle/expressions-app/dist/field-studies.html'
        frontend_rows = [row for row in receipt['emitted_frontend'] if row['path'] == frontend_rel]
        if len(frontend_rows) != 1:
            raise RuntimeError('Exactly one emitted ordinary application row is required')
        frontend_source = oi / frontend_rel
        frontend_row = frontend_rows[0]
        if (not frontend_source.is_file() or frontend_source.is_symlink()
                or frontend_source.stat().st_size != frontend_row['bytes']
                or digest(frontend_source) != frontend_row['sha256']):
            raise RuntimeError('Actual emitted frontend changed before retention')
        frontend_target = out / 'frontend' / 'field-studies.html'
        frontend_target.parent.mkdir(exist_ok=True)
        if frontend_target.exists() or frontend_target.is_symlink():
            raise RuntimeError('Refuse to overwrite previously retained frontend')
        shutil.copy2(frontend_source, frontend_target)
        if (frontend_target.stat().st_size != frontend_row['bytes']
                or digest(frontend_target) != frontend_row['sha256']):
            raise RuntimeError('Retained frontend differs from actual canonical emission')
        retained_frontend = {'path': str(frontend_target.relative_to(out)),
                             'source_path': frontend_rel, 'bytes': frontend_row['bytes'],
                             'sha256': frontend_row['sha256'],
                             'source_revision': args.expected_oi_head,
                             'standing': 'Actual canonical emitted application bytes; no render, installed or model acceptance'}
        receipt['retained_frontend'] = [retained_frontend]
        receipt['artifacts'][retained_frontend['path']] = retained_frontend
        bundles = list((out / 'bundle').glob('*.tar.gz'))
        if len(bundles) != 1:
            raise RuntimeError('Canonical packager did not emit exactly one bundle')
        bundle = bundles[0]
        with tarfile.open(bundle, 'r:gz') as source:
            metadata = json.load(source.extractfile('oi-desktop-bundle/BUNDLE.json'))
            if metadata['source_revision'] != args.expected_oi_head or metadata['target'] != 'aarch64-apple-darwin':
                raise RuntimeError('Canonical bundle source or target differs')
            binaries = [member for member in source if member.isfile() and '/Contents/MacOS/' in member.name]
            if not binaries:
                raise RuntimeError('Canonical bundle contains no actual app executable')
            app_hashes = {}
            for member in binaries:
                with source.extractfile(member) as stream:
                    app_hashes[member.name] = hashlib.file_digest(stream, 'sha256').hexdigest()
        receipt['artifacts'][str(bundle.relative_to(out))] = {'sha256': digest(bundle), 'bytes': bundle.stat().st_size,
                                                           'bundle': metadata, 'app_executables': app_hashes}
        qualify_sources()
        receipt['pass'] = True
    except BaseException as error:
        receipt['failure'] = str(error)
        raise
    finally:
        (out / 'receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')


if __name__ == '__main__':
    main()
