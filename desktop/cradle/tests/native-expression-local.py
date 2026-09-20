#!/usr/bin/env python3
"""Opt-in, isolated local acceptance for #419. No install, merge or machine repair.

Default: read-only source/binary/machine preflight, exit 2 (runtime proof pending).
--run-browser-join: execute the repository's real-native browser test in its own
namespace. This is not the installed WKWebView, audible speaker or Nara voice proof.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import platform
import shutil
import signal
import subprocess
import sys


def run(args, cwd=None, timeout=30):
    p = subprocess.run(args, cwd=cwd, text=True, capture_output=True, timeout=timeout)
    return {"argv": args, "code": p.returncode, "stdout": p.stdout, "stderr": p.stderr}


def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as source:
        for block in iter(lambda: source.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--expected-head', required=True)
    parser.add_argument('--host', type=Path, required=True)
    parser.add_argument('--worker', type=Path, required=True)
    parser.add_argument('--bridge', type=Path, required=True)
    parser.add_argument('--input', type=Path, required=True, help='Explicit coupled input; may be private. Never uploaded.')
    parser.add_argument('--output', type=Path, required=True, help='New private evidence directory; must not exist')
    parser.add_argument('--run-browser-join', action='store_true')
    parser.add_argument('--hardware-gpu', action='store_true', help='Request default GPU rather than SwiftShader; actual device is recorded')
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[3]
    args.output.mkdir(mode=0o700, parents=False, exist_ok=False)
    report = {'schema': 'oi.native-expression-local/v1', 'status': 'pending', 'checks': {}, 'machine': {'system': platform.system(), 'release': platform.release(), 'machine': platform.machine()}, 'claims': {'installed_app': False, 'native_wkwebview': False, 'audible_speakers': False, 'microphone': False, 'real_model_provider': False, 'human_acceptance': False}}
    code = 2
    try:
        head = run(['git', 'rev-parse', 'HEAD'], root)
        report['checks']['head'] = head
        if head['code'] or head['stdout'].strip() != args.expected_head:
            raise ValueError('Source head differs from the explicitly selected candidate')
        dirty = run(['git', 'status', '--porcelain', '--untracked-files=no'], root)
        report['checks']['working_copy'] = dirty
        if dirty['code'] or dirty['stdout'].strip():
            raise ValueError('Tracked modifications require a separately recorded source cut; no reset performed')
        report['files'] = {}
        for name in ['host', 'worker', 'bridge', 'input']:
            path = getattr(args, name)
            if not path.is_absolute() or not path.is_file():
                raise ValueError(name + ' requires an explicit absolute existing file')
            if name != 'input' and not os.access(path, os.X_OK):
                raise ValueError(name + ' is not executable')
            report['files'][name] = {'path': str(path), 'sha256': digest(path)}
        data = json.loads(args.input.read_text())
        if not all(key in data for key in ['basis', 'field']):
            raise ValueError('Input must be the complete native coupled basis + field, not a renderer preset')
        if platform.system() == 'Darwin':
            report['checks']['mac_version'] = run(['/usr/bin/sw_vers'])
            report['checks']['mac_audio_display_inventory'] = run(['/usr/sbin/system_profiler', 'SPAudioDataType', 'SPDisplaysDataType', '-json'], timeout=90)
        node = shutil.which('node')
        if not node:
            raise ValueError('Node is unavailable; no runtime was installed')
        report['checks']['node'] = run([node, '--version'])
        if args.run_browser_join:
            env = dict(os.environ, NATIVE_EXPRESSION_BRIDGE=str(args.bridge), OI_QL_FIELD_HOST_BIN=str(args.host), OI_QL_FIELD_WORKER_BIN=str(args.worker), NATIVE_EXPRESSION_INPUT=str(args.input), NATIVE_EXPRESSION_OUT=str(args.output.resolve() / 'browser'), NATIVE_EXPRESSION_GPU='hardware' if args.hardware_gpu else 'software')
            with (args.output / 'browser-run.log').open('w') as log:
                result = subprocess.Popen([node, 'tests/native-expression-native-browser.mjs'], cwd=root / 'desktop/cradle', env=env, stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
                try:
                    result.wait(timeout=180)
                except subprocess.TimeoutExpired:
                    os.killpg(result.pid, signal.SIGTERM)
                    try:
                        result.wait(timeout=10)
                    except subprocess.TimeoutExpired:
                        os.killpg(result.pid, signal.SIGKILL)
                        result.wait()
                    raise RuntimeError('Isolated browser acceptance timed out; its owned process group was released')
            code = 0 if result.returncode == 0 else 1
            report['status'] = 'isolated-native-browser-passed' if code == 0 else 'failed'
            report['claims']['controlled_central_disclosure'] = True
            report['claims']['installed_app'] = False
        else:
            report['pending'] = 'Preflight only. --run-browser-join explicitly starts owned native/browser test processes. No install or device access occurred.'
    except Exception as error:
        report['status'] = 'failed'
        report['error'] = str(error)
        code = 1
    finally:
        (args.output / 'local-receipt.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({'status': report['status'], 'receipt': str(args.output / 'local-receipt.json'), 'exit': code}))
    return code


if __name__ == '__main__':
    sys.exit(main())
