import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

const cradle = fileURLToPath(new URL('..', import.meta.url));
const server = await createServer({
  root: cradle,
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
  logLevel: 'error',
  cacheDir: fileURLToPath(new URL('../node_modules/.vite-timeline-test', import.meta.url)),
});
try {
  const { registerTimelineSurface } = await server.ssrLoadModule('/src/techne/timeline/register.ts');
  const registry = await server.ssrLoadModule('/src/techne/registry.tsx');

  test('registerTimelineSurface mounts the timeline instrument under "timeline"', () => {
    const stop = registerTimelineSurface();
    const surface = registry.techneSurface('timeline');
    assert.equal(typeof surface, 'function', 'the timeline lane mounts one component');
    const previous = registry.techneSurface('canvas');
    assert.equal(previous, undefined, 'registration touches no other instrument');
    stop();
    assert.equal(registry.techneSurface('timeline'), undefined, 'unregistering returns the registry to rest');
  });

  test('a duplicate timeline registration is refused — composition bugs do not silently win', () => {
    const stop = registerTimelineSurface();
    assert.throws(() => registerTimelineSurface(), /already registered/);
    stop();
    assert.equal(registry.techneSurface('timeline'), undefined);
  });
} finally {
  await server.close();
}
