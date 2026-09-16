import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const story = fileURLToPath(new URL('../src/techne/story/', import.meta.url));

test('the story modules persist nothing: no storage APIs appear anywhere in the lane', async () => {
  const modules = ['beats.ts', 'sequence.ts', 'StoryInstrument.tsx', 'register.ts'];
  for (const name of modules) {
    const source = await readFile(`${story}${name}`, 'utf8');
    assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB|openDatabase|caches\./,
      `${name} must hold no persistence API — drafts are local until routed, and the Expression substrate stays the only store`);
  }
});

test('the story modules keep no shadow store of their own: beats and sequence are pure derivations', async () => {
  for (const name of ['beats.ts', 'sequence.ts']) {
    const source = await readFile(`${story}${name}`, 'utf8');
    assert.doesNotMatch(source, /\bfetch\s*\(|new\s+Date|crypto\.|document\.|window\./,
      `${name} must stay pure — no I/O, no clock, no DOM`);
  }
});

test('registerStorySurface mounts the story surface through the Technē registry and unregisters cleanly', async () => {
  const cradle = fileURLToPath(new URL('..', import.meta.url));
  const server = await createServer({ root: cradle, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
  try {
    const registry = await server.ssrLoadModule('/src/techne/registry.tsx');
    const { registerStorySurface } = await server.ssrLoadModule('/src/techne/story/register.ts');
    assert.equal(registry.techneSurface('story'), undefined, 'nothing is mounted before the lane registers');
    const stop = registerStorySurface();
    const surface = registry.techneSurface('story');
    assert.ok(surface, 'the story instrument is mounted');
    assert.throws(() => registerStorySurface(), /already registered/, 'one surface per instrument');
    stop();
    assert.equal(registry.techneSurface('story'), undefined, 'unregistration restores the honest placeholder');
  } finally {
    await server.close();
  }
});
