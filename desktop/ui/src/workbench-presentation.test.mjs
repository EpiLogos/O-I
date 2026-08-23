import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const workbench = readFileSync(new URL('./workbench.tsx', import.meta.url), 'utf8');
const runtime = readFileSync(new URL('./runtime-observation.tsx', import.meta.url), 'utf8');
const shell = readFileSync(new URL('./main.tsx', import.meta.url), 'utf8');
const host = readFileSync(new URL('./workbench-host.tsx', import.meta.url), 'utf8');
const command = readFileSync(new URL('./native-command.tsx', import.meta.url), 'utf8');

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

test('P5 keeps the inherited host boundary while implementing only the System product body', () => {
  assert.match(shell, /Project\/files\/Ground\/Knowledge navigation belongs to #106/);
  assert.match(shell, /#107 owns the canonical conversation\/Cradle body/);
  assert.match(shell, /#108 consumes the source-faithful Factory Build body/);
  assert.match(shell, /import \{ SystemWorkbench \} from '\.\/system-workbench'/);
  assert.match(shell, /O:I six-product composition workbench; native state remains owner-owned/);
  assert.match(shell, /application body belong to #110/);
});

test('generic C0 does not absorb corrected-C Epi domain semantics', () => {
  const generic = `${workbench}\n${runtime}\n${shell}\n${host}\n${command}`;
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
