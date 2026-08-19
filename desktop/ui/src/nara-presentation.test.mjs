import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const surface = readFileSync(new URL('./NaraSurface.tsx', import.meta.url), 'utf8');
const shell = readFileSync(new URL('./main.tsx', import.meta.url), 'utf8');

// These are presentation contracts over the actual checked-in components,
// not fixture implementations of Nara/Epi semantics.
test('Nara remains the write-first daily root over native provider operations', () => {
  assert.match(surface, /<textarea/);
  assert.match(surface, /nara_daily_snapshot/);
  assert.match(surface, /nara_save_daily/);
  assert.match(surface, /nara_send_selection/);
  assert.match(surface, /Explain this reading/);
  assert.match(surface, /protected personal context|identityOrientation/);
});

test('Personal 4\/5\/0 depth is summoned around the governed Nara selection', () => {
  assert.match(surface, /epi_personal_depth/);
  assert.match(surface, /M5′ Epii/);
  assert.match(surface, /M0′ Anuttara \/ Bimba/);
  for (const summon of ['Explain', 'Review', 'Source', 'Bimba', 'Provenance', 'Proposal', 'History']) {
    assert.match(surface, new RegExp(`>${summon}<`));
  }
  assert.match(surface, /central_now_snapshot/);
  assert.match(surface, /Central NOW is a temporal working field, not canon/);
  assert.match(surface, /subjectRef !== selected\.selectionRef/);
  assert.match(surface, /authoritySubjectRef !== selected\.episodeRef/);
  assert.match(surface, /same selection/);
  assert.match(surface, /Why this ground/);
  assert.match(surface, /Source mutation/);
  assert.match(surface, /Reject \/ do not adopt/);
  assert.match(surface, /human-accepted promotion path/);
  assert.equal(surface.includes('Epii dashboard'), false);
  assert.equal(surface.includes('Bimba dashboard'), false);
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
    'EpiiRuntime',
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
