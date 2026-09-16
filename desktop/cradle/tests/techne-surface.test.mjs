import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import { createDisclosureSessionStore, techneSurfaceBinding } from '../src/techne/session.ts';

const cradle = fileURLToPath(new URL('..', import.meta.url));
const server = await createServer({ root: cradle, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const { decodeLayout } = await server.ssrLoadModule('/src/surface/persist.ts');
  const techneRegistry = await server.ssrLoadModule('/src/techne/registry.tsx');

  const store = createDisclosureSessionStore();
  const session = store.setSelection({
    selection_ref: 'ql.techne:selection:surface',
    subject_ref: 'central:source:control:root:Control/user/placement.json',
    reading_ref: 'ql.techne:reading:fixture:absent-facets@1',
    instrument: 'canvas',
  });
  const binding = techneSurfaceBinding(session, 'surface:techne');

  const layout = () => ({
    root: { type: 'group', id: 'g1', tabs: [binding.id], pinned: [], active: binding.id },
    surfaces: { [binding.id]: JSON.parse(JSON.stringify(binding)) },
    closedStack: [],
    focusedGroupId: 'g1',
    agencyDepth: 'strip',
  });

  test('a kind "techne" binding round-trips its payload through the layout persistence', () => {
    const restored = decodeLayout(layout());
    assert.ok(restored.surfaces[binding.id], 'the techne binding survives decode');
    assert.equal(restored.surfaces[binding.id].kind, 'techne');
    assert.equal(restored.surfaces[binding.id].ref, session.subject_ref);
    assert.deepEqual(restored.surfaces[binding.id].techne, {
      instrument: 'canvas',
      subjectRef: session.subject_ref,
      selectionRef: session.selection.selection_ref,
    });
    assert.equal(restored.root.tabs[0], binding.id);
  });

  test('a techne binding whose payload is broken or unaligned is dropped, not guessed', () => {
    const broken = layout();
    broken.surfaces[binding.id] = { ...broken.surfaces[binding.id], techne: { instrument: 'canvas' } };
    assert.equal(decodeLayout(broken).surfaces[binding.id], undefined);
    const misattributed = layout();
    misattributed.surfaces[binding.id] = {
      ...misattributed.surfaces[binding.id],
      techne: { instrument: 'canvas', subjectRef: 'another:subject', selectionRef: 'ql.techne:selection:surface' },
    };
    assert.equal(decodeLayout(misattributed).surfaces[binding.id], undefined, 'the payload subject must be the binding ref');
  });

  test('the instrument registry mounts one component per instrument and refuses duplicates', () => {
    const story = () => null;
    const palace = () => null;
    const stopStory = techneRegistry.registerTechneSurface('journey', story);
    assert.equal(techneRegistry.techneSurface('journey'), story);
    assert.equal(techneRegistry.techneSurface('palace'), undefined, 'unmounted instruments stay unmounted');
    assert.throws(() => techneRegistry.registerTechneSurface('journey', palace), /already registered/);
    stopStory();
    assert.equal(techneRegistry.techneSurface('journey'), undefined);
    const stopPalace = techneRegistry.registerTechneSurface('palace', palace);
    stopPalace();
    assert.equal(techneRegistry.techneSurface('palace'), undefined);
  });
} finally {
  await server.close();
}
