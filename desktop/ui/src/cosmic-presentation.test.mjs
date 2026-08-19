import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const surface = readFileSync(new URL('./CosmicSurface.tsx', import.meta.url), 'utf8');
const shell = readFileSync(new URL('./main.tsx', import.meta.url), 'utf8');

// Presentation-only acceptance over the checked-in renderer. Computation remains
// source-owned and is proven separately by the real cross-repository provider test.
test('Cosmic is one current instrument over distinguishable M1 M2 M3 aspects', () => {
  assert.match(surface, /Integrated Cosmic instrument/);
  assert.match(surface, /epi_cosmic_snapshot/);
  assert.match(surface, /one current profile/);
  assert.match(surface, /movement/);
  assert.match(surface, /resonance/);
  assert.match(surface, /symbol \/ time/);
  for (const coordinate of ["M1'", "M2'", "M3'"]) {
    assert.match(surface, new RegExp(coordinate.replace("'", "\\'")));
  }
  assert.equal(surface.includes('M1 dashboard'), false);
  assert.equal(surface.includes('M2 dashboard'), false);
  assert.equal(surface.includes('M3 dashboard'), false);
});

test('renderer reads source composition and does not recompute the cosmos', () => {
  for (const forbidden of [
    'Math.sin(',
    'Math.cos(',
    'Math.pow(',
    'new Float32Array',
    'calculateResonance',
    'computeHexagram',
    'deriveCodon',
    'CosmicStateStore',
    'CosmicRuntime',
  ]) {
    assert.equal(surface.includes(forbidden), false, `renderer must not compute or own ${forbidden}`);
  }
  assert.match(surface, /profileRef/);
  assert.match(surface, /operatorRefs/);
  assert.match(surface, /semanticSources/);
  assert.match(surface, /implementationSources/);
  assert.match(surface, /not promoted/);
});

test('all six deep workspaces are source-addressed and selection enters the shared shell ref', () => {
  assert.match(surface, /deepWorkspaces\.map/);
  assert.match(surface, /workspace\.workspaceRef/);
  assert.match(surface, /select_semantic_ref/);
  assert.match(surface, /epi-deep-workspace/);
  assert.match(shell, /Cosmic · M1′ \+ M2′ \+ M3′/);
  assert.match(shell, /Cosmic coordinate/);
  assert.match(shell, /snapshot\.selection/);
});

test('readiness and research absence stay visible rather than becoming N\/A', () => {
  assert.match(surface, /reading\.readiness\.map/);
  assert.match(surface, /item\.status/);
  assert.match(surface, /item\.detail/);
  assert.equal(surface.includes('N/A'), false);
});
