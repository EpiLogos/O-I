import assert from 'node:assert/strict';
import { rmdir } from 'node:fs/promises';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { glob } from './vendor/quartz/quartz/util/glob.ts';

test('selected staged Markdown survives Git storage exclusions while private input stays excluded', async () => {
  const content = fileURLToPath(new URL('./vendor/quartz/content/', import.meta.url));
  await mkdir(content, { recursive: true });
  const staged = await mkdtemp(join(content, 'discovery-gate-'));
  const previous = process.env.OI_QUARTZ_STAGED_INPUTS;
  try {
    await writeFile(join(staged, 'index.md'), '# Selected essay\n');
    await mkdir(join(staged, 'private'));
    await writeFile(join(staged, 'private', 'note.md'), '# Withheld private note\n');
    await mkdir(join(staged, 'templates'));
    await writeFile(join(staged, 'templates', 'entry.md'), '# Template\n');
    const ignored = ['private', 'templates', '.obsidian'];
    delete process.env.OI_QUARTZ_STAGED_INPUTS;
    assert.deepEqual(await glob('**/*.md', staged, ignored), []);
    process.env.OI_QUARTZ_STAGED_INPUTS = '1';
    assert.deepEqual(await glob('**/*.md', staged, ignored), ['index.md']);
  } finally {
    if (previous === undefined) delete process.env.OI_QUARTZ_STAGED_INPUTS;
    else process.env.OI_QUARTZ_STAGED_INPUTS = previous;
    await rm(staged, { recursive: true, force: true });
    // The test created `content/` only to stage into; an empty one left behind makes other suites read it as the corpus.
    await rmdir(content).catch(() => {});
  }
});
