import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('./content/public-site.md', import.meta.url), 'utf8');
const viteConfig = readFileSync(new URL('./vite.config.ts', import.meta.url), 'utf8');

function hasHeading(level, id) {
  const marks = '#'.repeat(level);
  return new RegExp(`^${marks} \\[${id}\\] `, 'm').test(source);
}

function sectionBody(pageId, sectionId) {
  const pageStart = source.search(new RegExp(`^# \\[${pageId}\\] `, 'm'));
  assert.notEqual(pageStart, -1, `missing page ${pageId}`);
  const nextPage = source.slice(pageStart + 1).search(/^# \[[a-z0-9-]+\] /m);
  const page = nextPage === -1 ? source.slice(pageStart) : source.slice(pageStart, pageStart + 1 + nextPage);
  const sectionStart = page.search(new RegExp(`^## \\[${sectionId}\\] `, 'm'));
  assert.notEqual(sectionStart, -1, `missing section ${pageId}/${sectionId}`);
  const nextSection = page.slice(sectionStart + 1).search(/^## \[[a-z0-9-]+\] /m);
  return nextSection === -1 ? page.slice(sectionStart) : page.slice(sectionStart, sectionStart + 1 + nextSection);
}

test('public site markdown contains every routed page', () => {
  for (const page of ['home', 'oi', 'products', 'shared-field', 'research', 'build']) {
    assert.equal(hasHeading(1, page), true, `missing [${page}] page heading`);
  }
});

test('product sections expose the renderer contract', () => {
  for (const product of ['central', 'actuation', 'aikit', 'factory', 'workcell', 'ql']) {
    const body = sectionBody('products', product);
    for (const field of ['summary', 'lede', 'what', 'why', 'change', 'capabilities', 'repo']) {
      assert.match(body, new RegExp(`^### \\[${field}\\] `, 'm'), `${product} missing ${field}`);
    }
  }
});

test('research page represents the wider programme and keeps QL as one deeper surface', () => {
  for (const section of ['object', 'method', 'programme', 'ql', 'open']) {
    sectionBody('research', section);
  }
  assert.match(sectionBody('research', 'method'), /^### \[cycle\] Discover → Source-lock → Study →/m);
  assert.match(sectionBody('research', 'programme'), /Personal and project worlds/);
  assert.match(sectionBody('research', 'ql'), /A deeper formal research programme/);
});

test('first-contact copy names the world and our products directly', () => {
  assert.match(sectionBody('shared-field', 'intro'), /^### \[title\] A world, defined for agents\.$/m);
  assert.match(sectionBody('home', 'centres'), /We are developing six products/);
});

test('Objective : Internality is the authored title form', () => {
  assert.match(source, /^### \[title\] Objective : Internality$/m);
  assert.doesNotMatch(source, /^#{1,4} .*Objective Internality[.]*$/m);
});

test('vite emits the structured public pages without replacing Explore', () => {
  for (const entry of ['index.html', 'oi.html', 'products.html', 'shared-field.html', 'research.html', 'build.html', 'explore.html']) {
    assert.match(viteConfig, new RegExp(entry.replace('.', '\\.')));
  }
});
