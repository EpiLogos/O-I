import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  detectSiteBase,
  finalizeEssayDist,
  isEssayRoute,
  rewriteBuiltEssayHtml,
  startEssayHost,
} from './essay-host.ts';

test('site base is the path in front of an essay route', () => {
  assert.equal(detectSiteBase('/essay'), '');
  assert.equal(detectSiteBase('/essay/'), '');
  assert.equal(detectSiteBase('/essay.html'), '');
  assert.equal(detectSiteBase('/essay/symbolon/matheme'), '');
  assert.equal(detectSiteBase('/essay/read.html'), '');
  assert.equal(detectSiteBase('/section-rooms/00-integral-threshold'), '');
  assert.equal(detectSiteBase('/O-I/essay'), '/O-I');
  assert.equal(detectSiteBase('/O-I/essay/'), '/O-I');
  assert.equal(detectSiteBase('/O-I/essay.html'), '/O-I');
  assert.equal(detectSiteBase('/O-I/essay/symbolon/matheme'), '/O-I');
  assert.equal(detectSiteBase('/O-I/essay/read.html'), '/O-I');
  assert.equal(detectSiteBase('/O-I/manuscript/THE-RETURN-OF-ZERO'), '/O-I');
  assert.equal(detectSiteBase('/O-I/not-a-page'), '');
  assert.equal(isEssayRoute('/essay/symbolon/matheme'), true);
  assert.equal(isEssayRoute('/section-rooms'), true);
  assert.equal(isEssayRoute('/symbolon/matheme'), true);
  assert.equal(isEssayRoute('/manuscript'), true);
  assert.equal(isEssayRoute('/O-I/library.html'), false);
  assert.equal(isEssayRoute('/essayist'), false);
});

test('built essay.html boots from the site base and drops root-absolute asset tags', () => {
  const html = `<!doctype html><html><head><link rel="stylesheet" crossorigin href="./assets/essay-abc.css"></head><body><div id="root"></div><script type="module" crossorigin src="./assets/essay-abc.js"></script></body></html>`;
  const out = rewriteBuiltEssayHtml(html);
  assert.equal(out.includes('src="./assets/'), false);
  assert.equal(out.includes('href="./assets/'), false);
  assert.match(out, /__OI_SITE_BASE__/);
  assert.match(out, /\/assets\/essay-abc\.js/);
  assert.match(out, /\/assets\/essay-abc\.css/);
  assert.match(out, /This page is not on the site/);
});

test('the publish step deletes Quartz under essay/ and copies the shell to 404.html', () => {
  const dir = mkdtempSync(join(tmpdir(), 'essay-dist-'));
  try {
    mkdirSync(join(dir, 'essay', 'symbolon'), { recursive: true });
    writeFileSync(join(dir, 'essay', 'index.html'), '<html><meta name="generator" content="Quartz"></html>');
    writeFileSync(join(dir, 'essay', 'symbolon', 'matheme.html'), '<meta http-equiv="refresh" content="0">');
    const shell = rewriteBuiltEssayHtml('<html><body><script type="module" src="./assets/essay-abc.js"></script></body></html>');
    writeFileSync(join(dir, 'essay.html'), shell);
    mkdirSync(join(dir, 'essay-shell'), { recursive: true });
    writeFileSync(join(dir, 'essay-shell', 'catalog.json'), '{}');
    finalizeEssayDist(dir);
    assert.equal(readFileSync(join(dir, '404.html'), 'utf8'), shell);
    assert.throws(() => readFileSync(join(dir, 'essay', 'index.html')));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a refresh stub or a missing catalog fails the publish step', () => {
  const dir = mkdtempSync(join(tmpdir(), 'essay-dist-'));
  try {
    writeFileSync(join(dir, 'essay.html'), '<meta http-equiv="refresh" content="0;url=./zero">');
    assert.throws(() => finalizeEssayDist(dir), /refresh stub/);
    writeFileSync(join(dir, 'essay.html'), rewriteBuiltEssayHtml('<html><body><script type="module" src="/assets/essay-abc.js"></script></body></html>'));
    assert.throws(() => finalizeEssayDist(dir), /catalog.json/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('pages serves deep essay links from 404.html; vercel rewrites them and an existing file wins', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'essay-host-'));
  const shell = rewriteBuiltEssayHtml('<html><body><div id="root"></div><script type="module" src="./assets/app.js"></script></body></html>');
  try {
    mkdirSync(join(dir, 'essay'), { recursive: true });
    writeFileSync(join(dir, 'essay', 'index.html'), 'QUARTZ');
    writeFileSync(join(dir, 'essay.html'), shell);
    writeFileSync(join(dir, '404.html'), shell);
    writeFileSync(join(dir, 'index.html'), 'PLATE-A');
    mkdirSync(join(dir, 'assets'), { recursive: true });
    writeFileSync(join(dir, 'assets', 'app.js'), 'export {}');
    const pages = await startEssayHost({ dist: dir, mode: 'pages', prefix: '/O-I', port: 0 });
    const vercel = await startEssayHost({ dist: dir, mode: 'vercel', prefix: '', port: 0 });
    try {
      const deep = await fetch(`http://127.0.0.1:${pages.port}/O-I/essay/symbolon/matheme`);
      assert.equal(deep.status, 404);
      assert.match(await deep.text(), /__OI_SITE_BASE__/);
      const read = await fetch(`http://127.0.0.1:${pages.port}/O-I/essay/read.html`);
      assert.equal(read.status, 404);
      assert.match(await read.text(), /__OI_SITE_BASE__/);
      const home = await fetch(`http://127.0.0.1:${pages.port}/O-I/`);
      assert.equal(home.status, 200);
      assert.equal(await home.text(), 'PLATE-A');
      const asset = await fetch(`http://127.0.0.1:${pages.port}/O-I/assets/app.js`);
      assert.equal(asset.status, 200);
      const quartz = await fetch(`http://127.0.0.1:${vercel.port}/essay`);
      assert.equal(quartz.status, 200);
      assert.equal(await quartz.text(), 'QUARTZ');
      const leaf = await fetch(`http://127.0.0.1:${vercel.port}/essay/read.html`);
      assert.equal(leaf.status, 200);
      assert.match(await leaf.text(), /__OI_SITE_BASE__/);
      const plate = await fetch(`http://127.0.0.1:${vercel.port}/`);
      assert.equal(plate.status, 200);
      assert.equal(await plate.text(), 'PLATE-A');
    } finally {
      await pages.close();
      await vercel.close();
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
