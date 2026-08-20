import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const workbench = readFileSync(new URL('./workbench.tsx', import.meta.url), 'utf8');
const runtime = readFileSync(new URL('./runtime-observation.tsx', import.meta.url), 'utf8');
const shell = readFileSync(new URL('./main.tsx', import.meta.url), 'utf8');
const host = readFileSync(new URL('./workbench-host.tsx', import.meta.url), 'utf8');
const command = readFileSync(new URL('./native-command.tsx', import.meta.url), 'utf8');
const factoryHost = readFileSync(new URL('./factory-build/FactoryBuildHost.tsx', import.meta.url), 'utf8');
const factorySourceFiles = new Map([
  ['BuildSurface.tsx', [readFileSync(new URL('./factory-build/BuildSurface.tsx', import.meta.url), 'utf8'), '466446b355f2a018b96cc033e48c1d43ab33652d']],
  ['types.ts', [readFileSync(new URL('./factory-build/types.ts', import.meta.url), 'utf8'), 'b8d95224426b01a80709e7c9c6c4e0ae4e3b8b79']],
  ['read-model.ts', [readFileSync(new URL('./factory-build/read-model.ts', import.meta.url), 'utf8'), 'a9ad81f0ac2be231f4474c0600d00e5179149034']],
  ['components/SessionCards.tsx', [readFileSync(new URL('./factory-build/components/SessionCards.tsx', import.meta.url), 'utf8'), '8843228a45f69111d9661f467383d35c8d09f55c']],
  ['components/TraceWaterfall.tsx', [readFileSync(new URL('./factory-build/components/TraceWaterfall.tsx', import.meta.url), 'utf8'), '3bbb0adc3174e8f44eb0a9010850f51cff12a0c8']],
  ['components/SpanDetail.tsx', [readFileSync(new URL('./factory-build/components/SpanDetail.tsx', import.meta.url), 'utf8'), 'ea18338042ca6bcf1802b5d338bac3748214995a']],
  ['styles.css', [readFileSync(new URL('./factory-build/styles.css', import.meta.url), 'utf8'), '465871d0885bd953fe84b94c0afc8fc9cf81a9d9']],
  ['build-surface.css', [readFileSync(new URL('./factory-build/build-surface.css', import.meta.url), 'utf8'), 'fe521ef5afb21da236f579e65f5de225df6ade3e']],
  ['THIRD_PARTY_NOTICES.md', [readFileSync(new URL('./factory-build/THIRD_PARTY_NOTICES.md', import.meta.url), 'utf8'), '1f6682ef1babe4d3cdfd70283a90bdd6f2e63bc0']],
]);

function gitBlobSha(content) {
  const header = Buffer.from(`blob ${Buffer.byteLength(content)}\0`);
  return createHash('sha1').update(header).update(content).digest('hex');
}

// Presentation contract only: native/provider acceptance remains in Rust and the
// physical alpha. These assertions prevent the renderer from silently becoming a
// second state owner while the generic workbench evolves.
test('workbench projects the native SessionSpace application rather than inventing desktop state', () => {
  assert.match(workbench, /aikit_session_spaces/);
  assert.match(workbench, /aikit_session_space_read/);
  assert.match(workbench, /aikit_session_space_focus/);
  assert.match(workbench, /AIKit SessionSpace application/);
  assert.equal(workbench.includes('DesktopSessionSpace'), false);
  assert.equal(workbench.includes('OiSessionSpace'), false);
});

test('AgentSession conversation inhabits Encounter and keeps provider identity separate', () => {
  assert.match(workbench, /createPortal/);
  assert.match(workbench, /\.oi-shell__inspector/);
  assert.match(workbench, /agent_surface_open/);
  assert.match(workbench, /agent_surface_send/);
  assert.match(workbench, /agent_surface_cancel/);
  assert.match(workbench, /binding\.agent_session/);
  assert.match(workbench, /binding\.native_session_id/);
  assert.equal(workbench.includes('DesktopChat'), false);
  assert.equal(workbench.includes('OiConversation'), false);
  assert.equal(workbench.includes('model picker'), false);
});

test('Knowledge exposes bounded list tree graph reading and history without an O:I graph ontology', () => {
  for (const mode of ['list', 'tree', 'graph', 'reading', 'history']) {
    assert.match(workbench, new RegExp(`'${mode}'`));
  }
  assert.match(workbench, /knowledge_search/);
  assert.match(workbench, /knowledge_relations/);
  assert.match(workbench, /KnowledgeRelationView/);
  assert.match(workbench, /edge\.origin\.authority/);
  assert.equal(workbench.includes('OiGraphNode'), false);
  assert.equal(workbench.includes('DesktopWiki'), false);
});

test('target-owned runtime observation stays visibly separate from authored application state', () => {
  assert.match(runtime, /aikit_session_space_read/);
  assert.match(runtime, /Target-owned runtime observation/);
  assert.match(runtime, /AgentSessions/);
  assert.match(runtime, /Components/);
  assert.match(runtime, /Surfaces/);
  assert.match(runtime, /Connections/);
  assert.match(runtime, /provider\/native ids are observation|Provider\/native ids are observation/i);
});

test('P1 host exposes the stable five-region workbench and editor-group presentation grammar', () => {
  for (const region of ['navigator', 'canvas', 'sidecar', 'lower', 'system']) {
    assert.match(host, new RegExp(`'${region}'`));
    assert.match(host, new RegExp(`data-host-region=\\"${region}\\"`));
  }
  assert.match(host, /WorkbenchSplit = 'single' \| 'horizontal' \| 'vertical'/);
  assert.match(host, /SurfacePresentationBinding/);
  assert.match(host, /oi\.desktop\.workbench-layout\/v1/);
  assert.match(host, /pinned/);
  assert.match(host, /reopenClosed/);
  assert.match(host, /openCurrentInSplit/);
  assert.match(host, /moveActiveToSplit/);
  assert.match(host, /provider-local persistence/i);
  assert.match(host, /will not recreate the missing native Surface or semantic subject/i);
});

test('one canonical SurfaceRef may be placed in several host regions without a desktop Surface identity', () => {
  assert.match(host, /regions\?: WorkbenchHostRegion\[\]/);
  assert.match(host, /function surfaceRegions/);
  assert.match(host, /HostRegionSurfaces/);
  assert.match(host, /data-surface-ref=\{surface\.surfaceRef\}/);
  for (const region of ['navigator', 'sidecar', 'lower', 'system']) {
    assert.match(host, new RegExp(`HostRegionSurfaces region=\\"${region}\\"`));
  }
  assert.equal(host.includes('DesktopSurfaceRef'), false);
});

test('presentation identity and semantic subject remain separate across tabs splits and restore', () => {
  assert.match(host, /bindingId: string/);
  assert.match(host, /surfaceRef: string/);
  assert.match(host, /subjectRef\?: string/);
  assert.match(shell, /provider-local presentation/);
  assert.match(shell, /never substituted for a native Surface or semantic subject ref/);
  assert.equal(host.includes('ContextResolution:'), false);
  assert.equal(host.includes('DesktopResourceRef'), false);
  assert.equal(host.includes('DesktopSurfaceRef'), false);
});

test('Search and Command aggregate native descriptors and never define a desktop Action catalog', () => {
  assert.match(command, /aikit_context_resolution/);
  assert.match(command, /contribution_catalog/);
  assert.match(command, /aikit_session_spaces/);
  assert.match(command, /knowledge_search/);
  assert.match(command, /factory_build_snapshot/);
  assert.match(command, /NativePaletteResult/);
  assert.match(command, /ResourceRef \/ ActionRef preserved/);
  assert.match(command, /discoverable ≠ authorised/);
  assert.equal(command.includes('OiActionCatalog'), false);
  assert.equal(command.includes('DesktopAction'), false);
  assert.equal(command.includes('DesktopContextResolver'), false);
});

test('Search preserves the actual externally tagged AIKit ContextResolution availability contract', () => {
  assert.match(command, /type ContextAvailability/);
  assert.match(command, /\{ unresolved: \{ reasons: string\[\] \} \}/);
  assert.match(command, /\{ unavailable: \{ reasons: string\[\] \} \}/);
  assert.match(command, /value === 'available'/);
  assert.match(command, /'unresolved' in value/);
  assert.match(command, /'unavailable' in value/);
});

test('keyboard and mouse command activation converge on the same canonical Action path', () => {
  assert.match(command, /function activateResult/);
  assert.match(command, /onClick=\{\(\) => void activateResult\(result\)\}/);
  assert.match(command, /if \(event\.key === 'Enter'\)/);
  assert.match(command, /void activateResult\(result\)/);
  assert.match(command, /dispatch_contextual_factory_action/);
  assert.match(command, /actionRef: result\.ref/);
  assert.match(command, /subjectRef: result\.subjectRef/);
  assert.equal(command.includes('authorityRef:'), false);
});

test('P4 imports the current Factory Build body as exact owner-source blobs', () => {
  for (const [path, [content, expectedSha]] of factorySourceFiles) {
    assert.equal(gitBlobSha(content), expectedSha, `${path} drifted from the pinned Factory source blob`);
  }
  assert.match(factoryHost, /06579aada01a77bd719c0c010a10f91084b4326f/);
  assert.match(factoryHost, /de31374882e7a4e3e5b7bb9bd09e69dc2f779356/);
});

test('P4 keeps semantic live and trajectory depths in the Factory-owned body', () => {
  const build = factorySourceFiles.get('BuildSurface.tsx')[0];
  const types = factorySourceFiles.get('types.ts')[0];
  for (const depth of ['semantic', 'live', 'trajectory']) assert.match(build, new RegExp(`'${depth}'`));
  for (const relation of ['frontier', 'candidates', 'claims', 'evidence', 'humanRequests', 'agencies', 'executions', 'trajectories']) {
    assert.match(types, new RegExp(relation));
  }
  assert.match(build, /SessionCards/);
  assert.match(build, /TraceWaterfall/);
  assert.match(build, /SpanDetail/);
  assert.match(shell, /FactoryTrajectoryRegion/);
});

test('P4 preserves Factory ActionRef subjectRef emission and the existing native handler bridge', () => {
  const build = factorySourceFiles.get('BuildSurface.tsx')[0];
  assert.match(build, /onAction\?\.\(\{ actionRef, subjectRef \}\)/);
  assert.match(shell, /dispatch_contextual_factory_action/);
  assert.match(shell, /emission: invocation/);
  assert.equal(shell.includes('authorityRef:'), false);
  assert.equal(factoryHost.includes('FactoryActionExecutor'), false);
  assert.equal(factoryHost.includes('FactoryBuildFileProvider'), false);
  assert.equal(factoryHost.includes('FactoryBuildState'), false);
});

test('P4 composes Factory subjects into shared selection without minting O:I semantic state', () => {
  assert.match(factoryHost, /factoryBuildSubjects/);
  for (const kind of ['project', 'run', 'candidate', 'claim', 'evidence', 'execution', 'human-request']) {
    assert.match(factoryHost, new RegExp(`'${kind}'`));
  }
  assert.match(shell, /selectFactoryBuildSubject/);
  assert.match(shell, /factoryBuild\.provenance\.owner/);
  assert.equal(factoryHost.includes('OiFactory'), false);
  assert.equal(factoryHost.includes('DesktopFactory'), false);
});

test('P1 leaves P2-P6 product bodies explicit rather than implementing them in the host', () => {
  assert.match(shell, /Project\/files\/Ground\/Knowledge navigation belongs to #106/);
  assert.match(shell, /#107 owns the canonical conversation\/Cradle body/);
  assert.match(shell, /#108 consumes the source-faithful Factory Build body/);
  assert.match(shell, /six-product configuration workbench/);
  assert.match(shell, /application body belong to #110/);
});

test('generic C0 does not absorb corrected-C Epi domain semantics', () => {
  const generic = `${workbench}\n${runtime}\n${shell}\n${host}\n${command}\n${factoryHost}`;
  for (const forbidden of [
    'EpiiRuntime',
    'AnuttaraRuntime',
    'epi_personal_depth',
    'M4′ Nara',
    'M5′ Epii',
    'M0′ Anuttara',
  ]) {
    assert.equal(generic.includes(forbidden), false, `generic workbench must not contain ${forbidden}`);
  }
});
