#!/usr/bin/env python3
"""Stage actual frontend bytes; --build runs the feature host and then qualifies its marker."""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import plistlib
import re
import shutil
import subprocess
import sys

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
spec = importlib.util.spec_from_file_location('payload', HERE / 'package-payload.py')
payload = importlib.util.module_from_spec(spec)
spec.loader.exec_module(payload)
SOURCE_DIRS = [REPO / path for path in ['cli/src', 'cli/product-manifests', 'desktop/cradle/kernel/src', 'desktop/cradle/src', 'desktop/cradle/src-tauri/src', 'desktop/cradle/src-tauri/capabilities', 'desktop/cradle/expressions-app/src', 'desktop/cradle/expressions-app/field-studies-journeys/src', 'desktop/cradle/expressions-app/field-studies-journeys/scripts', 'packages/live-shell/src', 'packages/live-shell/ui/src', 'packages/live-set/src', 'packages/field-engine/src', 'packages/expressions-boundary/src', 'packages/instrument-editors/src', 'desktop/cradle/expressions-app/vendor/research-canvas/packages']]
SOURCE_FILES = [REPO / path for path in ['Cargo.toml', 'Cargo.lock', 'cli/Cargo.toml', 'surfaces.json', 'desktop/install-footprint.json', 'desktop/cradle/kernel/Cargo.toml', 'desktop/cradle/src-tauri/Cargo.toml', 'desktop/cradle/src-tauri/Cargo.lock', 'desktop/cradle/src-tauri/build.rs', 'desktop/cradle/src-tauri/tauri.conf.json', 'desktop/cradle/package.json', 'desktop/cradle/package-lock.json', 'desktop/cradle/expressions-app/package.json', 'desktop/cradle/expressions-app/package-lock.json', 'desktop/cradle/expressions-app/vite.config.ts', 'desktop/cradle/expressions-app/tsconfig.json', 'packages/live-set/Cargo.toml', 'packages/live-shell/Cargo.toml', 'packages/live-shell/ui/package.json', 'packages/live-shell/ui/package-lock.json', 'packages/live-shell/ui/vite.config.ts', 'packages/live-shell/ui/tsconfig.json', 'packages/live-shell/build-native-candidate.py', 'packages/live-shell/record-cli-build.py', 'desktop/cradle/expressions-app/vendor/research-canvas/browserExporter.ts', 'packages/live-shell/package-payload.py', 'packages/live-shell/tauri.candidate.conf.json']]
FRONTEND_SOURCE_DIRS = [REPO / path for path in ['desktop/cradle/src', 'desktop/cradle/expressions-app/src', 'desktop/cradle/expressions-app/field-studies-journeys/src', 'desktop/cradle/expressions-app/field-studies-journeys/scripts', 'desktop/cradle/expressions-app/vendor/research-canvas/packages', 'packages/live-shell/ui/src', 'packages/field-engine/src', 'packages/expressions-boundary/src', 'packages/instrument-editors/src']]
FRONTEND_SOURCE_DIRS += [REPO / 'packages/oi-design-system/themes', REPO / 'packages/oi-design-system/expressions-engine']
SOURCE_DIRS += FRONTEND_SOURCE_DIRS[-2:]
SOURCE_FILES += [REPO / path for path in ['packages/live-shell/ui/index.html', 'desktop/cradle/expressions-app/index.html', 'desktop/cradle/expressions-app/legacy.html', 'desktop/cradle/expressions-app/render.html', 'desktop/cradle/expressions-app/library.html', 'desktop/cradle/expressions-app/field-studies-journeys/tsconfig.json']]
SOURCE_FILES.append(HERE / 'application-support.py')
SOURCE_FILES.append(HERE / 'build-source-archive.py')
# Tauri consumes these outside Cargo's normal/build module graph. Capture even
# optional config names so their appearance during a build changes the basis.
SOURCE_DIRS += [REPO / 'desktop/cradle/src-tauri/icons', REPO / 'shared-field/dist-client']
SOURCE_FILES += [REPO / 'desktop/cradle/src-tauri' / name for name in ['Info.plist', 'tauri.macos.conf.json', 'tauri.macos.conf.json5', 'Tauri.macos.toml', 'tauri.conf.json5', 'Tauri.toml', '.cargo/config', '.cargo/config.toml']]
SOURCE_FILES += [REPO / directory / name for directory in ['desktop', 'desktop/cradle', 'desktop/cradle/src-tauri'] for name in ['.cargo/config', '.cargo/config.toml', 'rust-toolchain', 'rust-toolchain.toml']]


def shared_field_inputs():
    module = REPO / 'shared-field/spacetimedb'
    files = set(path for path in (REPO / 'shared-field').iterdir() if path.is_file() and path.suffix in ('.mjs', '.json'))
    files.update(path for path in module.iterdir() if path.is_file() and path.suffix in ('.mjs', '.ts', '.json'))
    for directory in [module / 'src', module / 'node_modules', REPO / 'shared-field/scripts']:
        if directory.is_dir():
            files.update(path for path in directory.rglob('*') if path.is_file())
    return sorted(files)


def source_basis():
    files = set(path for path in SOURCE_FILES if path.is_file())
    # Generated bindings are real inputs to the client compiler, not authored
    # substitutes for the native module. Both enter the final source basis.
    files.update(path for path in shared_field_inputs() if 'node_modules' not in path.relative_to(REPO).parts)
    bindings = REPO / 'shared-field/spacetimedb/module_bindings'
    if bindings.is_dir():
        files.update(path for path in bindings.rglob('*') if path.is_file())
    for directory in SOURCE_DIRS:
        if directory.is_dir():
            files.update(path for path in directory.rglob('*') if path.is_file())
    permissions = REPO / 'desktop/cradle/src-tauri/permissions'
    if permissions.is_dir():
        files.update(path for path in permissions.rglob('*') if path.is_file() and 'autogenerated' not in path.relative_to(permissions).parts)
    records = []
    for path in sorted(files):
        payload.require(not path.is_symlink(), f'Native build source cannot escape through a symlink: {path}')
        records.append(payload.file_record(REPO, path))
    revision = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=REPO, text=True).strip()
    payload.require(payload.exact_hex(revision, 40), 'Native source revision is unavailable')
    digest = hashlib.sha256(json.dumps(records, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode()).hexdigest()
    dirty = bool(subprocess.check_output(['git', 'status', '--porcelain=v1', '--untracked-files=normal'], cwd=REPO))
    return {'source_revision': revision, 'source_tree_sha256': digest, 'source_dirty': dirty, 'source_files': records}



def native_inputs(target_dir):
    """Reuse the existing normal/build graph recorder, including dirty Git inputs."""
    module_spec = importlib.util.spec_from_file_location('native_build_recorder', HERE / 'record-cli-build.py')
    recorder = importlib.util.module_from_spec(module_spec)
    module_spec.loader.exec_module(recorder)
    env = dict(os.environ, CARGO_TARGET_DIR=str(Path(target_dir).resolve()), CARGO_BUILD_JOBS='1', RUSTC_WRAPPER='', RUSTC_WORKSPACE_WRAPPER='')
    payload.require(not env.get('NAPI_RS_NATIVE_LIBRARY_PATH'), 'Native Tauri helper override needs an explicit recorded producer adapter')
    payload.require(not env.get('NAPI_RS_FORCE_WASI'), 'Native Tauri WASI override needs an explicit recorded producer adapter')
    payload.require(not env.get('NODE_OPTIONS') and not env.get('NODE_PATH'), 'Native Node injection needs an explicit recorded producer adapter')
    native_directory = REPO / 'desktop/cradle/src-tauri'
    command = ['cargo', 'metadata', '--locked', '--offline', '--format-version', '1',
               '--filter-platform', 'aarch64-apple-darwin', '--manifest-path', str(native_directory / 'Cargo.toml'), '--features', 'native_shell,tauri/custom-protocol']
    metadata = json.loads(subprocess.check_output(command, cwd=native_directory, env=env))
    snapshot = recorder.source_snapshot(metadata, Path(metadata['workspace_root']) / 'Cargo.lock', env, require_aikit=False)
    tools = {}
    for name in ['cargo', 'rustc']:
        selected = Path(subprocess.check_output(['rustup', 'which', name], cwd=native_directory, env=env, text=True).strip())
        payload.require(not (name == 'rustc' and env.get('RUSTC')), 'A custom RUSTC needs an explicit recorded build adapter')
        tools[name] = {'executable': recorder.file_record(selected),
                       'version': subprocess.check_output([str(selected), '--version', '--verbose'], cwd=native_directory, env=env, text=True)}
    node_path = shutil.which('node')
    payload.require(node_path, 'Native Tauri producer requires the declared Node runtime')
    node = Path(node_path)
    tools['node'] = {'executable': recorder.file_record(node), 'version': subprocess.check_output([str(node), '--version'], text=True).strip()}
    tools['tauri'] = {'files': [recorder.file_record(path) for path in [REPO / 'desktop/cradle/node_modules/@tauri-apps/cli/tauri.js', REPO / 'desktop/cradle/node_modules/@tauri-apps/cli/main.js', REPO / 'desktop/cradle/node_modules/@tauri-apps/cli/index.js', REPO / 'desktop/cradle/node_modules/@tauri-apps/cli/package.json', REPO / 'desktop/cradle/node_modules/@tauri-apps/cli-darwin-arm64/package.json', REPO / 'desktop/cradle/node_modules/@tauri-apps/cli-darwin-arm64/cli.darwin-arm64.node']]}
    cli_directory = REPO / 'desktop/cradle/node_modules/@tauri-apps/cli'
    absent_local = [cli_directory / name for name in ['cli.darwin-universal.node', 'cli.darwin-arm64.node', 'cli.wasi.cjs']]
    payload.require(all(not path.exists() and not path.is_symlink() for path in absent_local), 'Unrecorded local Tauri helper precedes the declared packaged native helper')
    resolution = json.loads(subprocess.check_output([str(node), '-e', '''
const requireFromCli = require('node:module').createRequire(process.argv[1]);
const resolve = name => { try { return requireFromCli.resolve(name); } catch (error) { if (error.code === 'MODULE_NOT_FOUND') return null; throw error; } };
process.stdout.write(JSON.stringify({platform:process.platform,arch:process.arch,arm64:resolve('@tauri-apps/cli-darwin-arm64'),universal:resolve('@tauri-apps/cli-darwin-universal'),wasi:resolve('@tauri-apps/cli-wasm32-wasi')}));
''', str(cli_directory / 'index.js')], cwd=REPO, env=env, text=True))
    payload.require(resolution['platform'] == 'darwin' and resolution['arch'] == 'arm64' and resolution['arm64'] == str(REPO / 'desktop/cradle/node_modules/@tauri-apps/cli-darwin-arm64/cli.darwin-arm64.node') and resolution['universal'] is None and resolution['wasi'] is None, 'Tauri helper resolution differs from the recorded Darwin arm64 adapter')
    tools['tauri']['native_loader'] = {'resolution': resolution, 'absent_local_paths': [str(path) for path in absent_local]}
    launcher = REPO / 'desktop/cradle/node_modules/.bin/tauri'
    payload.require(launcher.resolve() == (REPO / 'desktop/cradle/node_modules/@tauri-apps/cli/tauri.js').resolve(), 'Native build launcher differs from the recorded Tauri adapter')
    tools['tauri']['launcher'] = recorder.file_record(launcher)
    environment_keys = (*recorder.ENV_KEYS, 'NODE_OPTIONS', 'TAURI_CONFIG', 'TAURI_SKIP_SIDECAR_SIGNATURE_CHECK', 'TAURI_SIGNING_PRIVATE_KEY', 'TAURI_SIGNING_PRIVATE_KEY_PASSWORD')
    payload.require(not env.get('TAURI_SIGNING_PRIVATE_KEY') and not env.get('TAURI_SIGNING_PRIVATE_KEY_PASSWORD'), 'Unsigned candidate producer must not receive signing credentials')
    return {'metadata_command': command, 'metadata_cwd': str(native_directory), 'cargo_metadata_sha256': hashlib.sha256(recorder.canonical(metadata)).hexdigest(),
            'tools': tools, 'build_environment': {key:env.get(key) for key in environment_keys}, **snapshot}


def unchanged_source(basis, phase, evidence=None):
    current = source_basis()
    if current['source_tree_sha256'] != basis['source_tree_sha256']:
        before = {row['path']:row for row in basis['source_files']}
        after = {row['path']:row for row in current['source_files']}
        changed = sorted(path for path in before.keys() | after.keys() if before.get(path) != after.get(path))
        if evidence:
            Path(evidence).write_text(json.dumps({'phase':phase, 'before':basis, 'after':current, 'changed_files':changed}, indent=2) + '\n')
        raise ValueError(f'Source changed during {phase}; do not qualify these bytes: {changed}')


def native_checkout_drift(basis, destination):
    """Frozen frontend bytes no longer consume their mutable checkout sources."""
    current = source_basis()
    payload.require(current['source_revision'] == basis['source_revision'], 'Native source revision changed during compilation')
    before = {row['path']: row for row in basis['source_files']}
    after = {row['path']: row for row in current['source_files']}
    changed = sorted(path for path in before.keys() | after.keys() if before.get(path) != after.get(path))
    native_paths = {Path(row['path']).resolve() for row in basis['native_build_inputs']['source_files']}
    invalid = [path for path in changed if (REPO / path).resolve() in native_paths or not any((REPO / path).is_relative_to(directory) for directory in FRONTEND_SOURCE_DIRS)]
    record = {'phase': 'native build', 'compiled_source_tree_sha256': basis['source_tree_sha256'], 'current_checkout_source_tree_sha256': current['source_tree_sha256'], 'changed_files': changed, 'changed_native_inputs': invalid, 'standing': 'later-checkout-drift' if not invalid else 'refused-native-source-race'}
    (destination / 'native-checkout-drift.json').write_text(json.dumps(record, indent=2) + '\n')
    payload.require(not invalid, f'Native consumed source changed during compilation: {invalid}')
    return record


def qualify_generated_permissions():
    source = (REPO / 'desktop/cradle/src-tauri/build.rs').read_text()
    declarations = re.search(r'\.commands\s*\(\s*&\[(.*?)\]', source, re.S)
    payload.require(declarations, 'Native command permission declaration unavailable')
    command_text = declarations.group(1)
    payload.require(re.fullmatch(r'\s*(?:"[a-z][a-z0-9_]*"\s*,?\s*)+', command_text), 'Native permission producer needs its actual literal command list')
    commands = re.findall(r'"([a-z][a-z0-9_]*)"', command_text)
    payload.require(len(set(commands)) == len(commands), 'Native permission declaration repeats a command')
    root = REPO / 'desktop/cradle/src-tauri/permissions/autogenerated'
    files = {path.relative_to(root).as_posix(): path for path in root.rglob('*') if path.is_file()}
    payload.require(set(files) == {command + '.toml' for command in commands}, 'Generated native permission inventory differs from its actual owner declarations')
    for command in commands:
        identifier = command.replace('_', '-')
        expected = '# Automatically generated - DO NOT EDIT!\n\n'
        for disposition, verb in [('allow', 'Enables'), ('deny', 'Denies')]:
            expected += f'[[permission]]\nidentifier = "{disposition}-{identifier}"\ndescription = "{verb} the {command} command without any pre-configured scope."\ncommands.{disposition} = ["{command}"]\n\n'
        path = files[command + '.toml']
        payload.require(not path.is_symlink() and path.read_text().rstrip('\n') == expected.rstrip('\n'), f'Generated native permission differs from the owner template: {command}')
    return [payload.file_record(REPO, path) for path in sorted(files.values())]


def build_shared_field(args):
    """Reuse the original client and binding producers before native staging."""
    module_spec = importlib.util.spec_from_file_location('client_input_recorder', HERE / 'record-cli-build.py')
    recorder = importlib.util.module_from_spec(module_spec)
    module_spec.loader.exec_module(recorder)
    before = [recorder.file_record(path) for path in shared_field_inputs()]
    def selected_tools():
        tools = {}
        for name in ['node', 'spacetime']:
            executable = shutil.which(name)
            payload.require(executable, f'SharedField owner build tool is unavailable: {name}')
            version = subprocess.check_output([executable, '--version'], cwd=REPO, text=True)
            tools[name] = {'dispatcher': recorder.file_record(executable), 'version': version}
            if name == 'spacetime':
                selected = re.search(r'^spacetime Path: (.+)$', version, re.M)
                payload.require(selected, 'SharedField native generator did not disclose its selected executable')
                tools[name]['selected_executable'] = recorder.file_record(selected.group(1))
        return tools
    tools = selected_tools()
    commands = [['spacetime', 'generate', '--lang', 'typescript', '--out-dir', 'shared-field/spacetimedb/module_bindings', '--module-path', 'shared-field/spacetimedb', '-y'], ['node', 'shared-field/spacetimedb/build-client.mjs']]
    proof = Path(args.stage).with_suffix('.shared-field-build.json')
    payload.require(not proof.exists(), 'SharedField build proof already exists; use a fresh stage')
    receipts = []
    generated_before = None
    for index, command in enumerate(commands):
        result = subprocess.run(command, cwd=REPO, check=True)
        receipts.append({'cwd': str(REPO), 'argv': command, 'exit_code': result.returncode})
        if index == 0:
            generated_before = [recorder.file_record(path) for path in sorted((REPO / 'shared-field/spacetimedb/module_bindings').rglob('*')) if path.is_file()]
    after = [recorder.file_record(path) for path in shared_field_inputs()]
    payload.require(before == after, 'SharedField source/dependency inputs changed during client generation')
    generated_after = [recorder.file_record(path) for path in sorted((REPO / 'shared-field/spacetimedb/module_bindings').rglob('*')) if path.is_file()]
    payload.require(generated_before == generated_after and tools == selected_tools(), 'SharedField generated inputs or selected tools changed during client compilation')
    client_root = REPO / 'shared-field/dist-client'
    client = payload.read_json(client_root / 'CLIENT.json')
    payload.require(client.get('schema') == 'oi.shared-field-client-bundle/v1', 'Native client producer did not publish its actual receipt')
    for name, digest in client['files'].items():
        payload.require(Path(name).name == name and digest == 'sha256:' + payload.digest(client_root / name), 'SharedField client producer output differs from its receipt')
    record = {'standing': 'native-client-component-build', 'commands': receipts, 'source_inputs': before, 'generated_binding_files': generated_after, 'tools': tools, 'client': client}
    proof.parent.mkdir(parents=True, exist_ok=True)
    proof.write_text(json.dumps(record, indent=2) + '\n')
    return record


def stage_contributions(destination, suite_cli):
    """Carry the reviewed native sources, using their owner's actual compiler."""
    source = REPO / 'desktop/cradle/src/contributions'
    manifests = [source / name / 'contribution.json' for name in ['core', 'factory', 'automations']]
    compiler = Path(suite_cli).resolve()
    command = [str(compiler), 'contribution', 'compile-registry', '--root', str(source), *map(str, manifests)]
    compiled = subprocess.check_output(command)
    payload.require(compiled == (source / 'generated.ts').read_bytes(),
                    'Native contribution registry differs from its reviewed source; rebuild it at its owner')
    root = Path(destination) / 'Contents/Resources/live-shell-contributions'
    root.mkdir(parents=True)
    contributions = []
    for manifest in manifests:
        value = payload.read_json(manifest)
        # Compilation above owns validation, entry containment and digest rules.
        entry = manifest.parent / value['entry']
        for original in [manifest, entry]:
            target = root / original.relative_to(source)
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(original, target)
        contributions.append({'manifest': manifest.relative_to(source).as_posix(),
                              'contribution_ref': value['contribution_ref'],
                              'owner': value['owner'], 'revision': value['revision']})
    (root / 'generated.ts').write_bytes(compiled)
    proof = {'schema': 'oi.live-shell-contributions/v1',
             'producer': {'path': str(compiler), 'sha256': payload.digest(compiler), 'bytes': compiler.stat().st_size},
             'registry_sha256': payload.digest(root / 'generated.ts'),
             'contributions': contributions,
             'files': [payload.file_record(root, path) for path in sorted(root.rglob('*')) if path.is_file()]}
    (root / 'index.json').write_text(json.dumps(proof, indent=2) + '\n')
    payload.qualify_contribution_build(destination, compiler)
    return proof


def stage(args):
    shell = Path(args.shell_dist).resolve()
    expressions = Path(args.expressions_dist).resolve()
    payload.asset_files(shell)
    payload.asset_files(expressions)
    destination = Path(args.stage).resolve()
    payload.require(not destination.exists(), 'Candidate staging directory already exists; supply a new bounded directory')
    basis = source_basis()
    destination.mkdir(parents=True)
    frontend = destination / 'frontend'
    frontend.mkdir()
    shutil.copytree(shell, frontend / 'app')
    # The existing personal facade requires the application's own origin.
    # Tauri serves these embedded bytes directly; oi-material still owns
    # material rendering through the separately sealed payload resolver.
    shutil.copytree(expressions, frontend / '__application/expressions')
    overlay = payload.read_json(HERE / 'tauri.candidate.conf.json')
    if getattr(args, 'version', None):
        payload.require(re.fullmatch(r'\d+\.\d+\.\d+', args.version), 'Candidate version must be an explicit stable semantic version')
        overlay['version'] = args.version
    overlay['build']['frontendDist'] = str(frontend)
    config = destination / 'tauri.conf.json'
    config.write_text(json.dumps(overlay, indent=2) + '\n')
    footprint = payload.read_json(REPO / 'desktop/install-footprint.json')
    footprint.update(app_id='org.epilogos.oi.live-shell', public_name='O-I Shell Candidate', managed_root='products/live-shell-candidate')
    footprint['targets']['aarch64-apple-darwin']['registrations'] = [{'kind': 'macos-app-copy', 'path': '~/Applications/O-I Shell Candidate.app'}]
    # This candidate build is Darwin-only; avoid claiming unbuilt Linux assets.
    footprint['targets'] = {'aarch64-apple-darwin': footprint['targets']['aarch64-apple-darwin']}
    (destination / 'footprint.json').write_text(json.dumps(footprint, indent=2) + '\n')
    basis.update(shell_assets_sha256=payload.asset_digest(shell), expressions_assets_sha256=payload.asset_digest(expressions))
    if getattr(args, 'suite_cli', None):
        basis['contribution_build'] = stage_contributions(destination, args.suite_cli)
    payload.require(source_basis()['source_tree_sha256'] == basis['source_tree_sha256'],
                    'Source changed during native staging; do not qualify its bytes')
    (destination / 'source-basis.json').write_text(json.dumps(basis, indent=2) + '\n')
    return destination, config, basis


def build(args, destination, config, basis):
    payload.require(sys.platform == 'darwin', 'The real candidate app build requires a Darwin host')
    target = Path(args.target_dir).resolve()
    tauri = REPO / 'desktop/cradle/node_modules/.bin/tauri'
    payload.require(tauri.is_file(), 'Install the declared Cradle npm dependencies before building')
    env = dict(os.environ, CARGO_TARGET_DIR=str(target), CARGO_BUILD_JOBS='1', RUSTC_WRAPPER='', RUSTC_WORKSPACE_WRAPPER='')
    app = target / 'release/bundle/macos/O-I Shell Candidate.app'
    payload.require(not app.exists(), 'Candidate build output already exists; preserve the prior artifact before a new build')
    config_sha256 = payload.digest(config)
    archive = basis['source_archive']
    archive_path = Path(archive['archive']['path'])
    receipt_path = archive_path.parent / 'receipt.json'
    receipt_bytes = receipt_path.read_bytes()
    payload.require(payload.read_json(receipt_path) == archive and
                    payload.digest(archive_path) == archive['archive']['sha256'] and
                    archive_path.stat().st_size == archive['archive']['size_bytes'],
                    'Declared source archive differs before native compilation')
    command = [str(tauri), 'build', '--features', 'native_shell', '--config', str(config), '--bundles', 'app', '--no-sign', '--', '--locked', '-j1']
    subprocess.run(command, cwd=REPO / 'desktop/cradle', env=env, check=True)
    drift = native_checkout_drift(basis, destination)
    payload.require(native_inputs(target) == basis['native_build_inputs'], 'Native dependency/tool inputs changed during the build; do not qualify this result')
    payload.require(payload.digest(config) == config_sha256, 'Native staged config changed during compilation')
    permissions = qualify_generated_permissions()
    payload.require(payload.asset_digest(destination / 'frontend/app') == basis['shell_assets_sha256'] and payload.asset_digest(destination / 'frontend/__application/expressions') == basis['expressions_assets_sha256'], 'Frontend bytes changed during native feature build')
    payload.qualify_contribution_build(destination, args.suite_cli)
    payload.require(payload.digest(archive_path) == archive['archive']['sha256'] and
                    archive_path.stat().st_size == archive['archive']['size_bytes'] and
                    receipt_path.read_bytes() == receipt_bytes and
                    payload.read_json(receipt_path) == archive,
                    'Declared source archive changed during native compilation')
    with (app / 'Contents/Info.plist').open('rb') as stream:
        app_version = plistlib.load(stream)['CFBundleShortVersionString']
    payload.require(not args.version or app_version == args.version, 'Actual native app version differs from the requested version')
    basis['native_build'] = {'command': command, 'cwd': str(REPO / 'desktop/cradle'), 'exit_code': 0, 'config_sha256': config_sha256, 'application_version': app_version, 'checkout_drift': drift, 'generated_permissions': permissions}
    (destination / 'source-basis.json').write_text(json.dumps(basis, indent=2) + '\n')
    binary = payload.native_executable(app / 'Contents/MacOS/oi-cradle', darwin_arm64=True)
    marker_path = app / 'Contents/Resources/live-shell-host.json'
    payload.require(not marker_path.exists(), 'A marker already exists; refuse stamping a pre-existing native app')
    marker = {key: basis[key] for key in ['source_revision', 'source_tree_sha256', 'source_dirty', 'shell_assets_sha256', 'expressions_assets_sha256']}
    marker.update(schema='oi.live-shell-native-host/v1', executable_sha256=payload.digest(binary), bootstrap=payload.BOOTSTRAP)
    code = payload.macho_code(binary)
    marker.update(executable_code_sha256=code['code_sha256'], executable_code_bytes=code['code_bytes'])
    marker_path.parent.mkdir(parents=True, exist_ok=True)
    shutil.copytree(destination / 'Contents/Resources/live-shell-contributions',
                    app / 'Contents/Resources/live-shell-contributions')
    source_resources = app / 'Contents/Resources/live-shell-sources'
    source_resources.mkdir()
    shutil.copy2(archive_path, source_resources / 'sources.tar.gz')
    shutil.copy2(receipt_path, source_resources / 'receipt.json')
    payload.require(payload.digest(source_resources / 'sources.tar.gz') == archive['archive']['sha256'] and
                    (source_resources / 'receipt.json').read_bytes() == receipt_bytes,
                    'Bundled declared source bytes differ from their qualified archive')
    marker['source_archive'] = {
        'archive': payload.file_record(app, source_resources / 'sources.tar.gz'),
        'receipt': payload.file_record(app, source_resources / 'receipt.json'),
    }
    shutil.copy2(destination / 'source-basis.json', app / 'Contents/Resources/live-shell-build.json')
    with marker_path.open('x') as stream:
        stream.write(json.dumps(marker, indent=2) + '\n')
    payload.qualify_host(app)
    return app


def build_frontends(args):
    """Build the two declared applications serially against the captured source.

    The native marker must never pair current source with a stale ui-dist from
    an earlier build. Stage-only remains a byte inspection, without that claim.
    """
    payload.require(Path(args.shell_dist).resolve() == (HERE / 'ui/ui-dist').resolve() and
                    Path(args.expressions_dist).resolve() == (REPO / 'desktop/cradle/expressions-app/dist').resolve(),
                    'Native build must consume the declared frontend build outputs')
    basis = source_basis()
    proof = Path(args.stage).with_suffix('.frontend-source.json')
    payload.require(not proof.exists(), 'Frontend source proof already exists; supply a fresh staging path')
    proof.parent.mkdir(parents=True, exist_ok=True)
    proof.write_text(json.dumps(basis, indent=2) + '\n')
    commands = []
    for directory in [HERE / 'ui', REPO / 'desktop/cradle/expressions-app']:
        command = ['npm', 'run', 'build']
        subprocess.run(command, cwd=directory, check=True)
        commands.append({'cwd': str(directory), 'argv': command})
    unchanged_source(basis, 'frontend builds', Path(args.stage).with_suffix('.frontend-race.json'))
    return {'source_tree_sha256': basis['source_tree_sha256'], 'commands': commands,
            'shell_assets_sha256': payload.asset_digest(args.shell_dist),
            'expressions_assets_sha256': payload.asset_digest(args.expressions_dist)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--shell-dist', default=str(HERE / 'ui/ui-dist'))
    parser.add_argument('--expressions-dist', default=str(REPO / 'desktop/cradle/expressions-app/dist'))
    parser.add_argument('--stage', required=True, help='New staging directory inside the assigned campaign evidence/output field')
    parser.add_argument('--target-dir', default='/Users/admin/Central/Work/O-I/target')
    parser.add_argument('--suite-cli', help='The recorded release native owner used to compile contribution admission')
    parser.add_argument('--suite-source-basis', help='Actual qualified suite CLI release basis for source archiving')
    parser.add_argument('--version', help='Actual native application version for a recorded candidate update')
    parser.add_argument('--build', action='store_true', help='Run the real serialized native feature build; never merely stamp an existing app')
    try:
        args = parser.parse_args()
        if args.build:
            payload.require(args.suite_cli, 'Native build needs the recorded release --suite-cli')
            payload.require(args.suite_source_basis, 'Native build needs the qualified --suite-source-basis')
            suite_basis = payload.read_json(args.suite_source_basis)
            payload.require(Path(suite_basis['artifact']['path']).resolve() == Path(args.suite_cli).resolve(),
                            'Suite source basis names another compiler owner artifact')
            payload.native_executable(args.suite_cli, darwin_arm64=True)
        support = build_shared_field(args) if args.build else None
        frontends = build_frontends(args) if args.build else None
        destination, config, basis = stage(args)
        if frontends:
            payload.require(frontends['source_tree_sha256'] == basis['source_tree_sha256'], 'Source changed before native staging')
            basis['frontend_build'] = frontends
            basis['shared_field_build'] = support
            basis['native_build_inputs'] = native_inputs(args.target_dir)
            (destination / 'source-basis.json').write_text(json.dumps(basis, indent=2) + '\n')
        if args.build:
            # Immutable declarations preserve the source archive input identity;
            # the public final basis receives subsequent compiler qualification.
            declared_basis = destination / 'declared-source-basis.json'
            with declared_basis.open('xb') as stream:
                stream.write((destination / 'source-basis.json').read_bytes())
            archive_output = destination.with_suffix('.sources')
            archive_command = [sys.executable, str(HERE / 'build-source-archive.py'),
                               '--source-root', str(REPO), '--basis', str(declared_basis),
                               '--frontend-basis', str(Path(args.stage).with_suffix('.frontend-source.json')),
                               '--suite-basis', str(args.suite_source_basis), '--output', str(archive_output)]
            subprocess.run(archive_command, cwd=REPO, check=True)
            basis['source_archive'] = payload.read_json(archive_output / 'receipt.json')
            (destination / 'source-basis.json').write_text(json.dumps(basis, indent=2) + '\n')
        app = build(args, destination, config, basis) if args.build else None
        print(json.dumps({'standing': 'native-feature-build-bytes' if app else 'frontend-stage-only', 'stage': str(destination), 'native_app': str(app) if app else None, 'footprint': str(destination / 'footprint.json'), 'source_revision': basis['source_revision'], 'source_tree_sha256': basis['source_tree_sha256'], 'functional_acceptance': 'pending'}, indent=2))
    except (OSError, ValueError, KeyError, subprocess.CalledProcessError) as error:
        parser.exit(2, f'Native candidate staging/build refused: {error}\n')


if __name__ == '__main__':
    main()
