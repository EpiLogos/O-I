import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

// The registration seam is TypeScript + TSX, so it is exercised through the
// same Vite SSR load the T0 surface test uses — module loading only, no
// React rendering.
const cradle = fileURLToPath(new URL('..', import.meta.url));
const server = await createServer({ root: cradle, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const registerModule = await server.ssrLoadModule('/src/techne/canvas/register.ts');
  const registry = await server.ssrLoadModule('/src/techne/registry.tsx');
  const canvasModule = await server.ssrLoadModule('/src/techne/canvas/CanvasConstellation.tsx');

  test('registerCanvasSurface mounts the canvas instrument under its export name and unregisters cleanly', () => {
    assert.equal(typeof registerModule.registerCanvasSurface, 'function', 'the integration entry point exists');
    assert.equal(registry.techneSurface('canvas'), undefined, 'nothing mounts until the integration owner registers');

    const stop = registerModule.registerCanvasSurface();
    const mounted = registry.techneSurface('canvas');
    assert.equal(mounted, canvasModule.CanvasConstellation, 'the registered component is the CanvasConstellation surface');

    assert.throws(() => registerModule.registerCanvasSurface(), /already registered/, 'a duplicate registration is refused');
    stop();
    assert.equal(registry.techneSurface('canvas'), undefined, 'the unregister function unmounts cleanly');
  });
} finally {
  await server.close();
}
