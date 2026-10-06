import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const tool = fileURLToPath(new URL('./cut-reading-edition.mjs', import.meta.url));

test('a reading edition is cut from the committed basis, never the working tree, and changes nothing but its own prefix', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cut-edition-'));
  try {
    const origin = join(dir, 'origin.git'), vault = join(dir, 'vault'), scratch = join(dir, 'scratch');
    await mkdir(vault); await mkdir(scratch);
    execFileSync('git', ['init', '--bare', '-b', 'main', origin]);
    const git = (...args) => execFileSync('git', args, { cwd: vault, stdio: 'pipe' }).toString().trim();
    git('init', '-b', 'main'); git('config', 'user.name', 'Edition Test'); git('config', 'user.email', 'edition-test@example.invalid');
    git('remote', 'add', 'origin', origin);
    const essay = join(vault, 'submission-package/essay');
    await mkdir(join(essay, 'section-rooms/00-integral-threshold'), { recursive: true });
    await mkdir(join(essay, 'symbolon/mytheme/worlds/x/images'), { recursive: true });
    await writeFile(join(essay, 'README.md'), '# Foundation\n');
    await writeFile(join(essay, 'section-rooms/00-integral-threshold/ROOM-00-integral-threshold.md'), '# §0/1\n');
    await writeFile(join(essay, 'symbolon/mytheme/worlds/x/WHOLE.md'), '# Whole\n![fig](images/a.jpg)\n');
    await writeFile(join(essay, 'symbolon/mytheme/worlds/x/images/a.jpg'), Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
    await writeFile(join(vault, 'PRIVATE-WORKING.md'), 'outside the reading body\n');
    git('add', '.'); git('commit', '-m', 'Committed essay state');
    git('push', 'origin', 'main');
    const basis = git('rev-parse', 'HEAD');
    // live authorial work that is NOT committed must never be read
    await writeFile(join(essay, 'README.md'), '# Foundation, edited and uncommitted\n');
    await writeFile(join(essay, 'UNCOMMITTED-NEW.md'), '# not yet\n');
    const branchesBefore = git('branch', '--list').split('\n').length;

    const out = JSON.parse(execFileSync(process.execPath, ['--experimental-strip-types', tool, '--vault', vault, '--date', '2026-10-06', '--scratch', scratch], { stdio: 'pipe' }).toString().trim().split('\n').pop());
    assert.equal(out.basis, basis);
    assert.equal(out.branch, 'publication/reading-2026-10-06');
    assert.equal(out.files, 4);          // README, ROOM, WHOLE, the image
    assert.equal(out.assets, 1);
    assert.equal(out.pushed, false);

    const clone = join(scratch, 'vault');
    const show = (path) => execFileSync('git', ['-C', clone, 'show', `${out.commit}:${path}`], { stdio: 'pipe' }).toString();
    assert.equal(show('published-reading/2026-10-06/README.md'), '# Foundation\n');      // the committed bytes, not the edit
    assert.equal(show('published-reading/2026-10-06/symbolon/mytheme/worlds/x/WHOLE.md').includes('images/a.jpg'), true);
    assert.equal(execFileSync('git', ['-C', clone, 'cat-file', '-t', `${out.commit}:published-reading/2026-10-06/symbolon/mytheme/worlds/x/images/a.jpg`]).toString().trim(), 'blob');
    assert.throws(() => show('published-reading/2026-10-06/UNCOMMITTED-NEW.md'));
    assert.throws(() => show('published-reading/2026-10-06/PRIVATE-WORKING.md'));
    const receipt = JSON.parse(show('published-reading/2026-10-06/PUBLICATION-INPUTS.json'));
    assert.equal(receipt.schema, 'essay.curated-reading-snapshot/v1');
    assert.equal(receipt.canonical_main, basis);
    assert.equal(receipt.files.length, 4);
    assert.equal(receipt.input_sha256, out.input_sha256);
    // the commit sits on the basis and differs from it only under its prefix
    assert.equal(execFileSync('git', ['-C', clone, 'rev-parse', `${out.commit}^`]).toString().trim(), basis);
    const changed = execFileSync('git', ['-C', clone, 'diff', '--name-only', basis, out.commit]).toString().trim().split('\n');
    assert.ok(changed.every((p) => p.startsWith('published-reading/2026-10-06/')));
    // the vault checkout itself is untouched: same branches, the uncommitted edit still there
    assert.equal(git('branch', '--list').split('\n').length, branchesBefore);
    assert.equal(await readFile(join(essay, 'README.md'), 'utf8'), '# Foundation, edited and uncommitted\n');

    // --push publishes the branch to origin
    const pushed = JSON.parse(execFileSync(process.execPath, ['--experimental-strip-types', tool, '--vault', vault, '--date', '2026-10-07', '--scratch', join(dir, 'scratch2'), '--push'], { stdio: 'pipe' }).toString().trim().split('\n').pop());
    assert.equal(pushed.pushed, true);
    assert.equal(execFileSync('git', ['-C', origin, 'rev-parse', 'publication/reading-2026-10-07']).toString().trim(), pushed.commit);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
