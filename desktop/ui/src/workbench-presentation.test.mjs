import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const workbench = [
  readFileSync(new URL('./workbench.tsx', import.meta.url), 'utf8'),
  readFileSync(new URL('./workbench-native.tsx', import.meta.url), 'utf8'),
].join('\n');
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
  assert.match(host, /export type WorkbenchHostRegion = 'navigator' \| 'canvas' \| 'sidecar' \| 'lower' \| 'system'/);
  // each summoned region renders its own literal body, and every region carries
  // its name on the element — canvas literally, the summoned four by their key
  for (const region of ['navigator', 'sidecar', 'lower', 'system']) {
    assert.match(host, new RegExp(`region=\\"${region}\\"`));
  }
  assert.match(host, /\(\['navigator', 'sidecar', 'system', 'lower'\] as const\)\.map\(\(region\)/);
  assert.match(host, /data-host-region=\{region\}/);
  assert.match(host, /data-host-region="canvas"/);
  assert.match(host, /WorkbenchSplit = 'single' \| 'horizontal' \| 'vertical'/);
  assert.match(host, /SurfacePresentationBinding/);
  // v2: the resting shape became the product (03 §J), so the persisted layout
  // is versioned and parsed fail-closed by the pure layout module.
  assert.match(host, /WORKBENCH_LAYOUT_STORAGE_KEY/);
  assert.match(host, /parseLayout\(stored, restSurfaceRef\)/);
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

test('generic P1 host remains bounded while recovered System and Explore application bodies consume owner-native state', () => {
  assert.match(shell, /Project\/files\/Ground\/Knowledge navigation belongs to #106/);
  assert.match(shell, /#107 owns the canonical conversation\/Cradle body/);
  assert.match(shell, /#108 consumes the source-faithful Factory Build body/);
  assert.match(shell, /import \{ SystemWorkbench \} from '.\/system-workbench'/);
  assert.match(shell, /import \{ ExploreWorkbenchSurface \} from '.\/explore-workbench'/);
  assert.match(shell, /O:I six-product composition workbench; native state remains owner-owned/);
  assert.match(shell, /System composes owner-native state without acquiring configuration, Action, credential, provider, Agent or Run authority/);
  assert.match(shell, /Explore is the workbench projection of the same renderer-neutral application used by hosted\/browser and structured Agent Surfaces/);
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

test('the World tree is the main view and rest is the product (01 §2, 03 §J)', () => {
  const layout = readFileSync(new URL('./workbench-layout.mjs', import.meta.url), 'utf8');
  const tree = `${readFileSync(new URL('./world-tree.tsx', import.meta.url), 'utf8')}\n${readFileSync(new URL('./world-tree-model.mjs', import.meta.url), 'utf8')}`;
  // the canvas rests on the World tree, pinned, and returns to it
  assert.match(layout, /restLayout\(restSurfaceRef\)/);
  assert.match(layout, /surfaceRef: restSurfaceRef/);
  assert.match(layout, /pinned: true/);
  assert.match(layout, /presentation: 'rest'/);
  assert.match(layout, /if \(region !== 'sidecar'\) next\.regions\[region\]\.present = false/, 'rest leaves the agency field and nothing else');
  // the shell hands the tree the resting SurfaceRef
  assert.match(shell, /restSurfaceRef=\{WORLD_TREE_SURFACE\}/);
  assert.match(shell, /const WORLD_TREE_SURFACE = 'surface\/oi\/world-tree'/);
  // nodes are rendered from the reading, with their Wiki presence and access facts
  assert.match(tree, /oi\.world-tree\/v1/);
  assert.match(tree, /wiki_ref/);
  assert.match(tree, /node\.access_facts\.length > 0/);
});

test('node selection dispatches the kernel open/select operation and copies nothing locally (02 §5, 04 §3)', () => {
  // one kernel verb does select AND read; the shell keeps only the reading
  assert.match(shell, /invoke<SubjectReading>\('open_subject', \{ subject \}\)/);
  assert.equal(shell.includes('setSelection('), false, 'no component-local selection state');
  assert.equal(shell.includes('useState<SemanticRef'), false);
  // focus still arrives the one way: kernel snapshot pull, then FocusChanged
  assert.match(shell, /useKernelFocus\(snapshot\.focus \?\? snapshot\.selection\)/);
  assert.match(shell, /const selection = focus\?\.subject \?\? undefined/);
  // a fresh tree read never renders selection from a node's access facts
  const treeModel = readFileSync(new URL('./world-tree-model.mjs', import.meta.url), 'utf8');
  assert.match(treeModel, /function nodeIsFocused/);
  assert.match(treeModel, /node\.ref === refs\.world \|\| node\.ref === refs\.project/);
  assert.equal(/selected/.test(treeModel.split('nodeIsFocused')[1].split('}')[0]), false, 'nodeIsFocused never reads access.selected');
});

test('destination-set shell navigation is retired — the desktop is a tree you walk', () => {
  assert.equal(shell.includes('open_destination'), false, 'no destination-set navigation remains in the shell');
  assert.equal(shell.includes('DESTINATION_BY_SURFACE'), false);
  assert.equal(shell.includes('openDestination'), false);
  // the application hosts are reached as summoned depth, by their SurfaceRef
  assert.match(shell, /'surface\/oi\/personal-host'/);
  assert.match(shell, /'surface\/oi\/system-host'/);
  // the composition reading replaces the static System constitution table
  assert.match(shell, /invoke<CompositionReading>\('composition_reading'\)/);
  assert.match(shell, /composition=\{composition\}/);
  const systemModel = readFileSync(new URL('./system-workbench-model.mjs', import.meta.url), 'utf8');
  assert.equal(systemModel.includes('constitutionFromCurrentWorld'), false, 'the static constitution is gone');
  assert.equal(systemModel.includes('CF5_POSITIONS'), false);
  assert.match(systemModel, /oi\.composition-reading\/v1/);
});

test('a failed native selection discloses instead of failing silently (K1 M3)', () => {
  assert.match(shell, /try \{\n\s*await invoke\('select_semantic_ref', \{ subject \}\);\n\s*setFocusError\(null\);\n\s*\} catch \(error\) \{\n\s*setFocusError\(`Selection refused: \$\{String\(error\)\}`\);/);
  assert.match(shell, /\{focusError && <span role="alert">\{focusError\}<\/span>\}/);
});

test('the tree walks to the application hosts — pointer and keyboard through one button (K3 fix 1, Important 2)', () => {
  // the four application hosts are named by the SurfaceRef they always had
  assert.match(shell, /const DEPTH_SURFACE_REFS = \[/);
  assert.match(shell, /'surface\/oi\/personal-host',/);
  assert.match(shell, /'surface\/oi\/build-host',/);
  assert.match(shell, /'surface\/oi\/explore-host',/);
  assert.match(shell, /'surface\/oi\/system-host',/);
  // the walk is the host's own openSurface act — one verb, no second identity
  assert.match(shell, /function openDepthSurface\(surfaceRef: string\) \{/);
  assert.match(shell, /hostRef\.current\?\.openSurface\(surfaceRef, 'canvas'\)/);
  // the tree renders them as real buttons naming their SurfaceRef: one element,
  // one handler, so a pointer click and keyboard Enter are the same act
  const tree = readFileSync(new URL('./world-tree.tsx', import.meta.url), 'utf8');
  assert.match(tree, /className="oi-world-tree__depth"/);
  assert.match(tree, /<button\n\s+type="button"\n\s+data-surface-ref=\{entry\.surfaceRef\}/);
  assert.match(tree, /onClick=\{\(\) => onOpenDepth\(entry\.surfaceRef\)\}/);
  assert.match(tree, /Application surfaces of this desktop/);
  // both World tree render paths (navigator and canvas) offer the walk
  assert.equal((shell.match(/depth=\{DEPTH_SURFACES\}/g) || []).length, 2);
});

test('a subject binding shows its own subject — never the globally latest reading (K3 fix 1, Important 3)', () => {
  // readings are held per subject and merged by ref: opening B never rewrites A
  assert.match(shell, /const \[subjectReadings, setSubjectReadings\] = useState<Record<string, SubjectReading>>\(\{\}\);/);
  assert.match(shell, /setSubjectReadings\(\(current\) => \(\{ \.\.\.current, \[subject\.ref\]: reading \}\)\)/);
  assert.match(shell, /not one global "latest reading"/);
  // the binding's own subjectRef selects the reading and the save state
  assert.match(shell, /reading=\{binding\.subjectRef \? subjectReadings\[binding\.subjectRef\] \?\? null : null\}/);
  assert.match(shell, /saveState=\{binding\.subjectRef \? subjectSaves\[binding\.subjectRef\] \?\? \{\} : \{\}\}/);
  // save state is per subject too
  assert.match(shell, /const \[subjectSaves, setSubjectSaves\] = useState<Record<string, SubjectSaveState>>\(\{\}\);/);
  // a binding restored without a subject (selection is never persisted) says so
  assert.match(shell, /This binding was restored without a subject/);
  // a source change re-reads every open subject, not just the one on top
  assert.match(shell, /for \(const reading of Object\.values\(subjectReadings\)\) \{/);
});

test('cold-host advice fires only for the unserved shape opening the project can cure (K3 fix 1, Minor 8)', () => {
  const model = readFileSync(new URL('./world-tree-model.mjs', import.meta.url), 'utf8');
  const subject = readFileSync(new URL('./world-subject.tsx', import.meta.url), 'utf8');
  // the kernel's structured reason is carried verbatim, and the advice button
  // is gated on it — never on warning prose, never on every unserved shape
  assert.match(model, /unserved_reason: typeof reading\.unserved_reason === 'string'/);
  assert.match(subject, /model\.unserved_reason === 'no_project_relation'/);
});

test('openSurface dedupes against the state updater, not the render closure (K3 fix 1, New-breakage 5)', () => {
  assert.match(host, /function openSurface\(surfaceRef: string, region: WorkbenchHostRegion = 'canvas', subjectRef\?: string\) \{/);
  // the duplicate-binding check reads `current` inside the updater, so two
  // opens in one tick cannot mint two bindings for one subject
  assert.match(host, /setLayout\(\(current\) => \{\n\s+for \(const group of current\.groups\) \{/);
  assert.match(host, /const existing = group\.tabs\.find\(\(tab\) => tab\.surfaceRef === surfaceRef && tab\.subjectRef === subjectRef\);/);
});
