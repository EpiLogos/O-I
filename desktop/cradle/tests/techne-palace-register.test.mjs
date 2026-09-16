import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

const cradle = fileURLToPath(new URL('..', import.meta.url));
const server = await createServer({ root: cradle, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const registry = await server.ssrLoadModule('/src/techne/registry.tsx');
  const { registerPalaceSurface } = await server.ssrLoadModule('/src/techne/palace/register.ts');

  test('the palace surface claims the palace mount and yields it on unregister', () => {
    assert.equal(registry.techneSurface('palace'), undefined, 'clean registry before the claim');
    const unregister = registerPalaceSurface();
    assert.ok(registry.techneSurface('palace'), 'the palace surface is mounted');
    unregister();
    assert.equal(registry.techneSurface('palace'), undefined, 'the palace surface is unmounted');
  });

  test('a double palace claim is a composition bug, refused', () => {
    const first = registerPalaceSurface();
    assert.throws(() => registerPalaceSurface(), /already registered/);
    first();
    assert.equal(registry.techneSurface('palace'), undefined);
  });
} finally {
  await server.close();
}
