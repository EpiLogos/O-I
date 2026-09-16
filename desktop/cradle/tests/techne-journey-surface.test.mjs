import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const journey = fileURLToPath(new URL('../src/techne/journey/', import.meta.url));

test('the journey modules persist nothing: no storage APIs appear anywhere in the lane', async () => {
  const modules = ['beats.ts', 'sequence.ts', 'JourneyInstrument.tsx', 'register.ts'];
  for (const name of modules) {
    const source = await readFile(`${journey}${name}`, 'utf8');
    assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB|openDatabase|caches\./,
      `${name} must hold no persistence API — drafts are local until routed, and the Expression substrate stays the only store`);
  }
});

test('the journey modules keep no shadow store of their own: beats and sequence are pure derivations', async () => {
  for (const name of ['beats.ts', 'sequence.ts']) {
    const source = await readFile(`${journey}${name}`, 'utf8');
    assert.doesNotMatch(source, /\bfetch\s*\(|new\s+Date|crypto\.|document\.|window\./,
      `${name} must stay pure — no I/O, no clock, no DOM`);
  }
});

test('registerJourneySurface mounts the journey surface through the Technē registry and unregisters cleanly', async () => {
  const cradle = fileURLToPath(new URL('..', import.meta.url));
  const server = await createServer({ root: cradle, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
  try {
    const registry = await server.ssrLoadModule('/src/techne/registry.tsx');
    const { registerJourneySurface } = await server.ssrLoadModule('/src/techne/journey/register.ts');
    assert.equal(registry.techneSurface('journey'), undefined, 'nothing is mounted before the lane registers');
    const stop = registerJourneySurface();
    const surface = registry.techneSurface('journey');
    assert.ok(surface, 'the journey instrument is mounted');
    assert.throws(() => registerJourneySurface(), /already registered/, 'one surface per instrument');
    stop();
    assert.equal(registry.techneSurface('journey'), undefined, 'unregistration restores the honest placeholder');
  } finally {
    await server.close();
  }
});
