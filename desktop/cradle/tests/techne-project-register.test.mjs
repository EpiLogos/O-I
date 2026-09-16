import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

const cradle = fileURLToPath(new URL('..', import.meta.url));
const server = await createServer({ root: cradle, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const registry = await server.ssrLoadModule('/src/techne/registry.tsx');
  const { registerProjectSurface } = await server.ssrLoadModule('/src/techne/project/register.ts');

  test('the M0′ project surface claims the project mount and yields it on unregister', () => {
    assert.equal(registry.techneSurface('project'), undefined, 'clean registry before the claim');
    const unregister = registerProjectSurface();
    assert.ok(registry.techneSurface('project'), 'the project surface is mounted');
    unregister();
    assert.equal(registry.techneSurface('project'), undefined, 'the project surface is unmounted');
  });

  test('a double project claim is a composition bug, refused', () => {
    const first = registerProjectSurface();
    assert.throws(() => registerProjectSurface(), /already registered/);
    first();
    assert.equal(registry.techneSurface('project'), undefined);
  });
} finally {
  await server.close();
}
