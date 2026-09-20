from pathlib import Path
import hashlib, lzma, os, shutil, subprocess

def run(*args):
    subprocess.run(args, check=True)
assert os.environ.get('GITHUB_REF') == 'refs/heads/agent/adoption-lifecycle-20260920'
assert subprocess.check_output(['git', 'log', '-1', '--format=%P']).decode().strip() == '4663a4dc76eb635742704082954d9eac795dd545'
root = Path('.github/adoption-delivery')
patch = lzma.decompress(b''.join((root / f'part{i}.xz').read_bytes() for i in range(6)))
assert hashlib.sha256(patch).hexdigest() == 'c460bf3e149ba16d0364877903e7cc44ec47e114b008c6f33a2cfc2d0a9a0ef1'
p = Path('/tmp/adoption-implementation.patch'); p.write_bytes(patch)
# Recover the already-landed casing-safe #406 controller name, not a replacement.
old = Path('desktop/cradle/src/configuration/setupFlow.ts')
new = old.with_name('setupFlowController.ts')
if old.exists() and not new.exists():
    old.rename(new)
    for path in ['desktop/cradle/src/configuration/PlanDrawer.tsx', 'desktop/cradle/src/configuration/SetupFlow.tsx', 'desktop/cradle/tests/configuration-setup.test.mjs', 'desktop/cradle/walk/configuration-setup.test.mjs']:
        f = Path(path)
        f.write_text(f.read_text().replace('./setupFlow"', './setupFlowController"').replace('/setupFlow.ts', '/setupFlowController.ts'))
run('git', 'apply', '--check', str(p))
run('git', 'apply', str(p))
owned = ['cli/src/setup.rs', 'cli/src/setup_command.rs', 'cli/src/setup_terminal.rs', 'cli/src/trust_closure.rs', 'cli/tests/cli.rs', 'cli/tests/setup_lifecycle.rs', 'desktop/cradle/kernel/src/setup.rs']
run('rustfmt', '--edition', '2021', *owned)
Path('.github/workflows/adoption-lifecycle.yml').write_bytes((root / 'final-workflow.yml').read_bytes())
shutil.rmtree(root)
paths = [line.split(' b/', 1)[1] for line in patch.decode().splitlines() if line.startswith('diff --git ')]
paths += ['desktop/cradle/src/configuration/setupFlow.ts', 'desktop/cradle/src/configuration/setupFlowController.ts', 'desktop/cradle/src/configuration/SetupFlow.tsx', 'desktop/cradle/tests/configuration-setup.test.mjs', 'desktop/cradle/walk/configuration-setup.test.mjs', '.github/workflows/adoption-lifecycle.yml', '.github/adoption-delivery']
run('git', 'add', '-A', '--', *paths)
run('git', 'config', 'user.name', 'O:I adoption implementation')
run('git', 'config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com')
run('git', 'commit', '-m', 'feat(adoption): connect native setup, safe terminal recovery and production desktop consumer')
run('git', 'push', 'origin', 'HEAD:refs/heads/agent/adoption-lifecycle-20260920')
