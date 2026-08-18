import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const surface = readFileSync(new URL('./NaraSurface.tsx', import.meta.url), 'utf8');
const shell = readFileSync(new URL('./main.tsx', import.meta.url), 'utf8');

// This is intentionally a presentation contract over the actual checked-in
// component, not a fixture implementation of Nara semantics.
test('Nara is a write-first daily canvas over native provider operations', () => {
  assert.match(surface, /<textarea/);
  assert.match(surface, /nara_daily_snapshot/);
  assert.match(surface, /nara_save_daily/);
  assert.match(surface, /nara_send_selection/);
  assert.match(surface, /Explain this reading/);
  assert.match(surface, /protected personal context|identityOrientation/);
});

test('renderer does not grow a second cosmology or private identity model', () => {
  for (const forbidden of [
    'Math.sin(',
    'Math.cos(',
    'qCosmic',
    'quaternion',
    'identityRef',
    'personalFieldRef',
    'dreamText',
    'relationship',
    'health',
  ]) {
    assert.equal(surface.includes(forbidden), false, `renderer must not own or expose ${forbidden}`);
  }
});

test('situated region co-refers to the governed stable selection packet only', () => {
  assert.match(shell, /SituatedNaraPacket/);
  assert.match(shell, /selection\.selectionRef/);
  assert.match(shell, /selection\.episodeRef/);
  assert.match(shell, /selection\.selectedText/);
  assert.match(shell, /agentContextScope/);
  assert.match(shell, /Exact disclosure scope/);
  assert.equal(shell.includes('dangerouslySetInnerHTML'), false);
});
