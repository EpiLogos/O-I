import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { MANUSCRIPT_ID, OFFICES, publishVault } from './essay-browser.mjs';
import { hrefFor, resolveEssayRequest } from './src/essay/resolve.ts';

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'essay-vault-'));
  const files = {
    'README.md': `---
title: "The Return of Zero — Reading Root"
page_type: reading-root
---
# The Return of Zero — Reading Root

Read [the question](section-rooms/00-integral-threshold/movements/01-question.md) and the [manuscript](THE-RETURN-OF-ZERO.md).

The [quilt note](quilt/secret.md) stays out of the publication.
`,
    'THE-RETURN-OF-ZERO.md': `---
title: "The Return of Zero"
page_type: master-manuscript
stage: composing
---
# The Return of Zero

Relational Logos is named where it is written, in [S1](symbolon/episteme/products/S1-Actuation.md).[^s5-relational]

$$
\\\\frac{1}{2}
$$

[^s5-relational]: [S1, Relational Logos](symbolon/episteme/products/S1-Actuation.md#relational-logos). Point at the page.
`,
    'section-rooms/README.md': '---\ntitle: "The rooms"\n---\n# The rooms\n',
    'section-rooms/00-integral-threshold/ROOM.md': '---\ntitle: "Integral Threshold"\n---\n# Integral Threshold\n',
    'section-rooms/00-integral-threshold/movements/01-question.md': `---
title: "The Question Before the Mechanism"
---
# The Question Before the Mechanism

[[symbolon/the-slash|the slash]] and [[02-next|the next movement]].
`,
    'section-rooms/00-integral-threshold/movements/02-next.md': '---\ntitle: "Next"\n---\n# Next\n',
    'symbolon/the-slash.md': '---\ntitle: "The slash"\n---\n# The slash\n',
    'symbolon/README.md': '---\ntitle: "Symbolon"\n---\n# Symbolon\n',
    'symbolon/matheme/README.md': '---\ntitle: "Matheme"\n---\n# Matheme\n',
    'symbolon/mytheme/README.md': '---\ntitle: "Mytheme"\n---\n# Mytheme\n',
    'symbolon/episteme/README.md': '---\ntitle: "Episteme"\n---\n# Episteme\n',
    'symbolon/episteme/products/S1-Actuation.md': `---
title: "S1 — Actuation"
---
# S1 — Actuation

### Relational Logos and co-present consciousness

The section stays on this page.
`,
    'symbolon/matheme/quilt/skip.md': '# Quilt child\n',
    'quilt/secret.md': '# Do not publish\n',
    'symbolon/episteme/concepts/reference-notes/skip.md': '# Notes\n',
    'symbolon/episteme/sources/house/NOTES.md': '# Notes\n',
    'symbolon/episteme/sources/house/house-NOTES.md': '# Notes\n',
    'symbolon/episteme/maps/navigation/audit.json': '{"navigation":true}\n',
  };
  for (const [rel, text] of Object.entries(files)) {
    const abs = join(root, rel);
    await mkdir(join(abs, '..'), { recursive: true });
    await writeFile(abs, text);
  }
  return root;
}

test('publication keeps the six folders and drops quilt, NOTES, reference-notes, and JSON', async () => {
  const root = await fixture();
  try {
    const files = [];
    const { readdir, readFile } = await import('node:fs/promises');
    async function walk(dir, prefix = '') {
      for (const entry of await readdir(dir, { withFileTypes: true })) {
        const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) await walk(join(dir, entry.name), rel);
        else files.push({ rel, text: await readFile(join(dir, entry.name), 'utf8') });
      }
    }
    await walk(root);
    const { catalog, pages } = publishVault(files, { repo: 'fixture', ref: 'test', commit: 'abc', path: 'fixture' });
    const ids = catalog.files.map((file) => file.id);
    assert.equal(catalog.offices.length, 6);
    assert.deepEqual(catalog.offices.map((office) => office.label), ['Rooms', 'Symbolon', 'Matheme', 'Mytheme', 'Episteme', 'Manuscript']);
    assert.ok(ids.includes(MANUSCRIPT_ID));
    assert.equal(ids.includes('THE-RETURN-OF-ZERO'), false);
    assert.equal(ids.some((id) => id.includes('quilt') || id.endsWith('NOTES') || id.includes('reference-notes') || id.endsWith('.json')), false);
    assert.equal(catalog.files.filter((file) => file.office === 'manuscript').length, 1);
    assert.equal(catalog.files.filter((file) => file.office === 'symbolon').some((file) => file.id.startsWith('symbolon/matheme/')), false);
    assert.ok(catalog.files.some((file) => file.office === 'symbolon/matheme'));
    const manuscript = pages.find((page) => page.id === MANUSCRIPT_ID);
    assert.ok(manuscript.html.length > 80);
    assert.equal(/http-equiv\s*=\s*["']refresh/i.test(manuscript.html), false);
    assert.match(manuscript.html, /Relational Logos is named where it is written/);
    assert.ok(manuscript.links.includes('symbolon/episteme/products/S1-Actuation'));
    assert.equal(manuscript.html.includes('quilt/secret'), false);
    const question = catalog.files.find((file) => file.id.endsWith('/01-question'));
    assert.ok(question.links.includes('symbolon/the-slash'));
    assert.ok(question.links.includes('section-rooms/00-integral-threshold/movements/02-next'));
    const rootPage = catalog.files.find((file) => file.id === 'README');
    assert.ok(rootPage.links.includes(MANUSCRIPT_ID));
    assert.equal(rootPage.links.some((id) => id.includes('quilt')), false);

    assert.deepEqual(resolveEssayRequest('/essay', catalog), { kind: 'page', id: 'README' });
    assert.deepEqual(resolveEssayRequest('/essay/THE-RETURN-OF-ZERO.html', catalog), { kind: 'page', id: MANUSCRIPT_ID });
    assert.deepEqual(resolveEssayRequest('/essay/read.html', catalog), { kind: 'page', id: MANUSCRIPT_ID });
    assert.deepEqual(resolveEssayRequest('/essay/symbolon/matheme', catalog), { kind: 'page', id: 'symbolon/matheme/README' });
    assert.deepEqual(resolveEssayRequest('/section-rooms/00-integral-threshold', catalog), { kind: 'page', id: 'section-rooms/00-integral-threshold/ROOM' });
    assert.equal(resolveEssayRequest('/essay/not-a-real-page', catalog).kind, 'missing');
    assert.equal(hrefFor('README', catalog), '/essay');
    assert.equal(hrefFor(MANUSCRIPT_ID, catalog), '/essay/manuscript/THE-RETURN-OF-ZERO');
    assert.equal(OFFICES.filter((office) => office.child).map((office) => office.id).join(','), 'symbolon/matheme,symbolon/mytheme,symbolon/episteme');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('the shell points at Relational Logos and does not paste it into site prose', async () => {
  const app = await readFile(new URL('./src/essay/EssayApp.tsx', import.meta.url), 'utf8');
  assert.equal(app.includes('Relational Logos places self'), false);
  assert.equal(app.includes('co-present consciousness'), false);
});
