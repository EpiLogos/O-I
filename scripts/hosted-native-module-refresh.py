"""Hosted-only bounded emission; original desktop gates run after this preparation."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json
import os
import platform
import sys
import shutil
import signal
import subprocess
import time

assert os.environ.get('GITHUB_ACTIONS') == 'true', 'This emitter guard is hosted-only'
assert os.environ.get('GITHUB_REPOSITORY') == 'EpiLogos/O-I', 'Unexpected hosted source owner'
root = Path(__file__).resolve().parents[1]
package = root / 'packages/oi-design-system/expressions-engine'
out = root / 'desktop/cradle/tests/artifacts/shared-expression-resources/native-module-refresh'
out.mkdir(parents=True, exist_ok=False)
modules = ['src/engine/PointCloudField.ts', 'field-studies-journeys/src/production.ts',
           'src/engine/shaders/particleShaders.ts', 'src/engine/entityRuntime.ts']
outputs = ['engine/PointCloudField.mjs', 'shell/production.mjs',
           'engine/shaders/particleShaders.mjs', 'engine/entityRuntime.mjs']
sha = lambda raw: hashlib.sha256(raw).hexdigest()
def digest(path):
    checksum = hashlib.sha256()
    with path.open('rb') as source:
        for block in iter(lambda: source.read(65536), b''): checksum.update(block)
    return checksum.hexdigest()
tree = lambda: {str(p.relative_to(package)): digest(p) for p in package.rglob('*') if p.is_file()}
head = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip()
assert head == os.environ['GITHUB_SHA'], 'Hosted checkout is not the declared source revision'
emitter = root / 'scripts/vendor-expressions-engine.mjs'
assert emitter.read_bytes() == subprocess.check_output(['git', 'show', head + ':scripts/vendor-expressions-engine.mjs'], cwd=root)
lock_path = root / 'desktop/cradle/package-lock.json'
assert lock_path.read_bytes() == subprocess.check_output(['git', 'show', head + ':desktop/cradle/package-lock.json'], cwd=root, timeout=3)
lock = json.loads(lock_path.read_text())
node_runtime = subprocess.check_output(['node', '--version'], cwd=root, text=True, timeout=3).strip()
assert len(node_runtime.encode()) <= 256, 'Runtime disclosure byte bound'
installed = json.loads((root / 'desktop/cradle/node_modules/esbuild/package.json').read_text())
assert installed['version'] == lock['packages']['node_modules/esbuild']['version']
before = tree()
prior = json.loads((package / 'PROVENANCE.json').read_text())
receipt = {'schema': 'oi.hosted-native-module-refresh/v1', 'source_head': head,
           'standing': 'Hosted compiler preparation only; no installed app, model, tool effects or two-human acceptance',
           'started_at': datetime.now(timezone.utc).isoformat(), 'compiler': 'esbuild@' + installed['version'],
           'compiler_lock_sha256': digest(root / 'desktop/cradle/package-lock.json'),
           'emitter_sha256': digest(emitter), 'before': before, 'modules': [], 'pass': False,
           'runtime': {'node': node_runtime, 'python': sys.version[:256],
                       'os': dict(zip(('system', 'node', 'release', 'version', 'machine'), os.uname()))},
           'budget_standing': 'Sampled aggregate compiler-group RSS and file byte admission; not an absolute peak/cgroup or whole-job bound',
           'adapter_standing': 'Finite hosted test material adapter for the unchanged native vendor command; no product process authority or arbitrary command surface',
           'limits': {'aggregate_rss_bytes': 256 * 1024**2, 'wall_seconds_per_module': 60,
                      'compiler_log_bytes': 1024**2, 'output_file_bytes': 4 * 1024**2}}

def owned(pgid, deadline):
    rows = []
    remaining = deadline - time.monotonic()
    if remaining <= 0: raise TimeoutError('Native group observation deadline expired before read')
    reading = subprocess.check_output(['ps', '-eo', 'pid=,ppid=,pgid=,rss=,stat='], text=True, timeout=min(3, remaining))
    if time.monotonic() > deadline: raise TimeoutError('Native group observation deadline expired during read')
    for line in reading.splitlines():
        parts = line.split()
        if len(parts) == 5 and int(parts[2]) == pgid:
            rows.append({'pid': int(parts[0]), 'ppid': int(parts[1]), 'pgid': pgid,
                         'rss_bytes': int(parts[3]) * 1024, 'state': parts[4]})
    return rows

def group_absent(pgid):
    try:
        os.killpg(pgid, 0)
        return {'absent': False, 'basis': 'native group exists'}
    except ProcessLookupError:
        return {'absent': True, 'basis': 'native ESRCH'}
    except OSError as error:
        return {'absent': False, 'basis': 'observation unavailable', 'errno': error.errno}

assert hasattr(os, 'waitid') and hasattr(os, 'WNOWAIT'), 'Native unreaped leader fence required'

def run_emitter(command, log_name, source_reading):
    # Only callers below bind this local test adapter to the native emitter.
    log_path = out / log_name
    entry = {'command': command, **source_reading, 'samples': [], 'budget_failure': None,
             'cleanup_errors': [], 'execution_failure': None}
    receipt['modules'].append(entry)
    start = time.monotonic()
    process = None
    try:
        with log_path.open('xb') as log:
            try:
                process = subprocess.Popen(command, cwd=root, stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
                entry['owned_pgid'] = process.pid
                # WNOWAIT retains the actual leader until the final group signal.
                # No poll/wait before that signal, and no signal after reap.
                while os.waitid(os.P_PID, process.pid, os.WEXITED | os.WNOHANG | os.WNOWAIT) is None:
                    rows = owned(process.pid, start + 57)
                    elapsed = time.monotonic() - start
                    rss = sum(row['rss_bytes'] for row in rows)
                    entry['samples'].append({'elapsed_seconds': round(elapsed, 4), 'rss_bytes': rss, 'members': rows})
                    if rss > receipt['limits']['aggregate_rss_bytes'] or elapsed > 57 or log_path.stat().st_size > receipt['limits']['compiler_log_bytes']:
                        entry['budget_failure'] = 'aggregate RSS' if rss > receipt['limits']['aggregate_rss_bytes'] else 'wall time' if elapsed > 57 else 'compiler log bytes'
                        raise RuntimeError(entry['budget_failure'])
                    time.sleep(0.05)
                if time.monotonic() > start + 57: raise TimeoutError('Compiler terminal observation exceeded execution budget')
            except BaseException as error:
                entry['execution_failure'] = {'type': type(error).__name__, 'detail': str(error)}
            finally:
                if process is not None:
                    fence_held = False
                    try:
                        os.waitid(os.P_PID, process.pid, os.WEXITED | os.WNOHANG | os.WNOWAIT)
                        fence_held = True
                        entry['leader_kept_unreaped_until_group_signal'] = True
                    except BaseException as error:
                        entry['cleanup_errors'].append({'operation': 'unreaped leader check', 'type': type(error).__name__, 'detail': str(error)})
                        entry['leader_fence_lost'] = True
                    if fence_held:
                        try:
                            os.killpg(process.pid, signal.SIGKILL)
                            entry['group_signal'] = 'SIGKILL before final wait'
                        except ProcessLookupError:
                            entry['group_absent_before_reap'] = True
                        except BaseException as error:
                            entry['cleanup_errors'].append({'operation': 'group signal', 'type': type(error).__name__, 'detail': str(error)})
                        try:
                            entry['exit_code'] = process.wait(timeout=max(0.01, min(3, start + 59 - time.monotonic())))
                            entry['owned_leader_reaped'] = True
                        except BaseException as error:
                            entry['cleanup_errors'].append({'operation': 'leader reap', 'type': type(error).__name__, 'detail': str(error)})
                    # Every observation after this point is read-only. Lost
                    # ownership never authorizes a numeric-group retry signal.
                    cleanup_deadline = min(start + 59, time.monotonic() + 3)
                    try:
                        while True:
                            if time.monotonic() >= cleanup_deadline: raise TimeoutError('Native cleanup deadline expired before observation')
                            entry['remaining_owned_processes'] = owned(process.pid, cleanup_deadline)
                            entry['group_readback'] = group_absent(process.pid)
                            if time.monotonic() > cleanup_deadline: raise TimeoutError('Native cleanup deadline expired during observation')
                            if not entry['remaining_owned_processes'] and entry['group_readback']['absent']:
                                break
                            if time.monotonic() >= cleanup_deadline:
                                raise RuntimeError('Owned group absence not established within cleanup budget')
                            time.sleep(0.05)
                    except BaseException as error:
                        entry['cleanup_errors'].append({'operation': 'group absence readback', 'type': type(error).__name__, 'detail': str(error)})
        if entry['execution_failure'] or entry['cleanup_errors']:
            raise RuntimeError(json.dumps({'execution_failure': entry['execution_failure'], 'cleanup_errors': entry['cleanup_errors']}))
        assert entry.get('owned_leader_reaped') and entry['group_readback']['absent'], entry
        assert log_path.stat().st_size <= receipt['limits']['compiler_log_bytes'], 'Compiler log byte cap exceeded'
        return entry, log_path
    except BaseException as error:
        entry['failure'] = {'type': type(error).__name__, 'detail': str(error)}
        raise
    finally:
        entry['wall_seconds'] = round(time.monotonic() - start, 4)
        entry['maximum_sampled_aggregate_rss_bytes'] = max((sample['rss_bytes'] for sample in entry['samples']), default=0)
        if log_path.is_file():
            entry['log_bytes'] = log_path.stat().st_size
            entry['log_sha256'] = digest(log_path)
        entry['wall_seconds'] = round(time.monotonic() - start, 4)
        if entry['wall_seconds'] > 60:
            entry['receipt_budget_failure'] = 'Native command/observation/hash exceeded per-module budget'
            if entry['execution_failure'] is None:
                entry['execution_failure'] = {'type': 'TimeoutError', 'detail': entry['receipt_budget_failure']}
            (out / 'receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
            raise TimeoutError(entry['receipt_budget_failure'])
        (out / 'receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')

try:
    # Actual native emitter refusal, not a replacement producer or mocked
    # process. The unsupported traversal is refused before any output write;
    # retain its actual failed command, log and owned group retirement.
    refusal_command = ['node', 'scripts/vendor-expressions-engine.mjs', '--refresh-module',
                       'src/engine/../PointCloudField.ts', '--retain-dependencies']
    refusal, refusal_log = run_emitter(refusal_command, 'native-source-refusal.compiler.log',
                                     {'standing': 'Actual native emitter unsupported Source refusal; no compiler output accepted'})
    refusal['native_refusal_accepted'] = refusal['exit_code'] != 0 and 'Invalid native module source' in refusal_log.read_text()
    assert refusal['native_refusal_accepted'] and tree() == before, refusal
    for module, expected in zip(modules, outputs):
        source = root / 'desktop/cradle/expressions-app' / module
        assert source.read_bytes() == subprocess.check_output(['git', 'show', head + ':' + str(source.relative_to(root))], cwd=root, timeout=3)
        command = ['node', 'scripts/vendor-expressions-engine.mjs', '--refresh-module', module, '--retain-dependencies']
        entry, log_path = run_emitter(command, module.rsplit('/', 1)[-1] + '.compiler.log',
                                     {'source': str(source.relative_to(root)), 'source_sha256': digest(source), 'output': expected})
        assert entry['budget_failure'] is None and entry['exit_code'] == 0, entry
        emitted = json.loads(log_path.read_text())
        assert emitted['refreshed'] == [expected] and emitted['retained_dependencies'] is True, emitted
        assert (package / expected).stat().st_size <= receipt['limits']['output_file_bytes'], 'Emitted native module byte cap exceeded'
        assert (package / 'PROVENANCE.json').stat().st_size <= receipt['limits']['output_file_bytes'], 'Native provenance byte cap exceeded'
    after = tree()
    changed = sorted(k for k in before.keys() | after.keys() if before.get(k) != after.get(k))
    assert changed == sorted(outputs + ['PROVENANCE.json']), changed
    current = json.loads((package / 'PROVENANCE.json').read_text())
    unrelated_before = json.loads(json.dumps(prior))
    unrelated_after = json.loads(json.dumps(current))
    for name in outputs:
        unrelated_before['module_refreshes'].pop(name, None)
        unrelated_after['module_refreshes'].pop(name, None)
        refresh = current['module_refreshes'][name]
        assert refresh['source_sha256'] == digest(root / refresh['source'])
        assert refresh['output_sha256'] == digest(package / name)
        assert refresh['compiler'] == receipt['compiler']
        target = out / 'outputs' / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(package / name, target)
    assert unrelated_before == unrelated_after, 'Unrelated retained provenance changed'
    shutil.copyfile(package / 'PROVENANCE.json', out / 'outputs/PROVENANCE.json')
    receipt.update({'after': after, 'changed_outputs': changed,
                    'compiler_readings': {name: current['module_refreshes'][name] for name in outputs}, 'pass': True})
finally:
    receipt['finished_at'] = datetime.now(timezone.utc).isoformat()
    (out / 'receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
print(json.dumps({'pass': receipt['pass'], 'source_head': head, 'outputs': outputs,
                  'scope': 'Native compiler preparation; original full desktop gates still required'}))
