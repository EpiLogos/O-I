// #772: Docs' six-tier binding (manual §18.5) on Central's own readings, and its acts as the person's presses.
//   Tiers: projectcentral.docs.inspect {project} (central.development-field-reading/v1: each tier's sources, the unbound ones, the
//   experiences and their returns, whether the world has its account); Recognised: projectcentral.ground.inspect {project}
//   (recognised_sources, each with its provenance and standing); Make: central.doctor (the root's parts) and central.world.reproject.plan
//   {project} (the world's scaffold). Meaning (O-I #786): each reflection law the world declares, listed by AIKit (`aikit knowledge
//   reflection laws`, the kernel's aikit_read reflection-laws) and its verdict asked (`aikit knowledge reflection verify -`, aikit_read
//   reflection-verify), both in the world's ground; Moved since: Central's change horizon (projectcentral.change.horizon {project}) counted
//   after the source revision each law was last read against the work at.
// Channels: REAL — the owners' answers below are Central's own, run 28 Oct 2026 on O-I (`ctrl --json action run <id> '{"project":"O-I"}'`),
//   trimmed to one source a tier and two unbound ones, the machine's root written <root>; AIKit's listing and verdict are its own (REAL,
//   ai-kit f2c6ae59 on a scratch project, 28 Oct), re-aimed at O-I's sources; the horizon is SCRIPTED in Central's shape
//   (ctrl/src/source_horizon.rs SourceHorizon); SCRIPTED — Central's writes go to a recording port, never to the owner. Not a screen pass.
import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(s, c, n) {
  if (s === 'react' || s.startsWith('react/')) return n(s, {...c, parentURL: ${JSON.stringify(import.meta.url)}})
  let r = null
  try { r = await n(s, c) } catch (e) { if (!s.startsWith('.')) throw e }
  if (r) {
    if (r.url.endsWith('.html') || r.url.endsWith('.css')) return {...r, format: 'module'}
    return r
  }
  if (s.endsWith('.js')) { try { return await n(s.slice(0, -3) + '.ts', c) } catch {} }
  for (const x of ['.ts', '.tsx']) { try { return await n(s + x, c) } catch {} }
  for (const x of ['/index.ts', '/index.tsx']) { try { return await n(s + x, c) } catch {} }
  throw new Error('cannot resolve ' + s)
}
export async function load(u, c, n) {
  if (u.endsWith('.css')) return {format: 'module', shortCircuit: true, source: 'export {}'};
  if (u.includes('?raw') || u.includes('.html')) return {format: 'module', shortCircuit: true, source: 'export default ""'};
  if (u.endsWith('.json')) return {format: 'module', shortCircuit: true, source: 'export default ' + await readFile(new URL(u), 'utf8')};
  if (!u.endsWith('.ts') && !u.endsWith('.tsx')) return n(u, c);
  return {format: 'module', shortCircuit: true, source: ts.transpileModule(await readFile(new URL(u), 'utf8'), {fileName: new URL(u).pathname,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText};
}`)}`, import.meta.url)

globalThis.document ??= {getElementById: () => null, createElement: () => ({}), head: {appendChild: () => {}}, documentElement: {}}
const {createElement} = await import('react')
const {renderToStaticMarkup} = await import('react-dom/server')
const host = await import('../src/frame/devices/deviceHost.tsx')
const pages = await import('../src/central/devices/pageBindings.ts')
const {design: docsDesign} = await import('../src/inhabitants/catalogue/panels/central__docs.tsx')

const REAL = {"inspect": {"automatic_agent_or_model_invocation": false, "canonical_tier_labels_invented": false, "ex": [], "relation_source": "ProjectCentral/relations/development-field.json", "schema": "central.development-field-reading/v1", "scope_ref": "project:O-I", "self_aperture": {"exists": true, "issues": [], "linked_sources": [], "path": "ProjectCentral/docs", "status": "present", "unbound_sources": [{"authority_from_location": false, "path": "ProjectCentral/docs/1-vision/dlw/gallery.mjs", "provenance": "unresolved", "ref": "central:source:project:O-I:ProjectCentral/docs/1-vision/dlw/gallery.mjs", "revision": {"byte_len": 5604, "revision": "central.content-fnv1a64/v1:5604:937d7393dc59c85f"}, "standing": "unresolved"}, {"authority_from_location": false, "path": "ProjectCentral/docs/1-vision/dlw/render.mjs", "provenance": "unresolved", "ref": "central:source:project:O-I:ProjectCentral/docs/1-vision/dlw/render.mjs", "revision": {"byte_len": 16047, "revision": "central.content-fnv1a64/v1:16047:fe547f850516cb59"}, "standing": "unresolved"}]}, "source_payloads_exposed": false, "tier_bindings": [{"canonical_label": "0-ground", "canonical_path": "ProjectCentral/docs/0-ground", "semantic_office": "originating authored ground / why / positions / intent", "sources": [{"agent_retrieval_allowed": true, "path": "ProjectCentral/docs/0-ground/CORE-PRIMITIVE-FIELD.md", "provenance": "human-adopted", "ref": "central:source:project:O-I:ProjectCentral/docs/0-ground/CORE-PRIMITIVE-FIELD.md", "retained_native": false, "revision": {"byte_len": 13808, "revision": "central.content-fnv1a64/v1:13808:dcbd37c6d6e4c54a"}, "roles": ["document-tier-0", "project-docs-source-aperture", "self-description-source"], "standing": "authored-human-position", "treatment": "ordinary-project-source"}], "tier": 0}, {"canonical_label": "1-vision", "canonical_path": "ProjectCentral/docs/1-vision", "semantic_office": "intended experience / vision", "sources": [{"agent_retrieval_allowed": true, "path": "ProjectCentral/docs/1-vision/VISION.md", "provenance": "human-adopted", "ref": "central:source:project:O-I:ProjectCentral/docs/1-vision/VISION.md", "retained_native": false, "revision": {"byte_len": 13841, "revision": "central.content-fnv1a64/v1:13841:90c2368cec337ac5"}, "roles": ["document-tier-1", "project-docs-source-aperture", "self-description-source"], "standing": "design-commitment", "treatment": "ordinary-project-source"}], "tier": 1}, {"canonical_label": "2-design", "canonical_path": "ProjectCentral/docs/2-design", "semantic_office": "design / capabilities / functional form", "sources": [{"agent_retrieval_allowed": true, "path": "ProjectCentral/docs/2-design/CAPABILITY-MATRIX.md", "provenance": "human-adopted", "ref": "central:source:project:O-I:ProjectCentral/docs/2-design/CAPABILITY-MATRIX.md", "retained_native": false, "revision": {"byte_len": 43247, "revision": "central.content-fnv1a64/v1:43247:ecc74e1aebaa015d"}, "roles": ["document-tier-2", "project-docs-source-aperture", "self-description-source"], "standing": "design-commitment", "treatment": "ordinary-project-source"}], "tier": 2}, {"canonical_label": "3-architecture", "canonical_path": "ProjectCentral/docs/3-architecture", "semantic_office": "architecture / contracts / owned relations", "sources": [{"agent_retrieval_allowed": true, "path": "ProjectCentral/docs/3-architecture/CONTEXT-FRAME-ACCEPTANCE-CAMPAIGN.md", "provenance": "human-adopted", "ref": "central:source:project:O-I:ProjectCentral/docs/3-architecture/CONTEXT-FRAME-ACCEPTANCE-CAMPAIGN.md", "retained_native": false, "revision": {"byte_len": 11495, "revision": "central.content-fnv1a64/v1:11495:424b064a3984f3ea"}, "roles": ["document-tier-3", "project-docs-source-aperture", "self-description-source"], "standing": "architecture-contract", "treatment": "ordinary-project-source"}], "tier": 3}, {"canonical_label": "4-development", "canonical_path": "ProjectCentral/docs/4-development", "semantic_office": "implementation / active development / operational form", "sources": [{"agent_retrieval_allowed": true, "path": "ProjectCentral/docs/4-development/CONVERGENCE-AND-ACCEPTANCE.md", "provenance": "human-adopted", "ref": "central:source:project:O-I:ProjectCentral/docs/4-development/CONVERGENCE-AND-ACCEPTANCE.md", "retained_native": false, "revision": {"byte_len": 4564, "revision": "central.content-fnv1a64/v1:4564:8dec4d1044830b4e"}, "roles": ["document-tier-4", "project-docs-source-aperture", "self-description-source"], "standing": "current-development-state", "treatment": "ordinary-project-source"}], "tier": 4}, {"canonical_label": "5-evidence", "canonical_path": "ProjectCentral/docs/5-evidence", "semantic_office": "evidence / returned reality / Recognition pressure", "sources": [{"agent_retrieval_allowed": true, "path": "ProjectCentral/docs/5-evidence/CONTINUOUS-WORK-PROVING.md", "provenance": "observed", "ref": "central:source:project:O-I:ProjectCentral/docs/5-evidence/CONTINUOUS-WORK-PROVING.md", "retained_native": false, "revision": {"byte_len": 13489, "revision": "central.content-fnv1a64/v1:13489:c20d0ec4d1fb4562"}, "roles": ["document-tier-5", "project-docs-source-aperture", "self-description-source"], "standing": "observed-evidence", "treatment": "ordinary-project-source"}], "tier": 5}], "ux": []}, "ground": {"human_source": "ProjectCentral/user", "next_actions": ["No additional document is required; revise authored ground only when human judgement or returned reality warrants it.", "Review native candidates conservatively; retain useful source in place by default rather than moving everything into ProjectCentral."], "project_id": "O-I", "project_root": "<root>/Work/O-I", "projectcentral_ready": true, "return_policy": {"agent_wiki_may_be_maintained_independently": true, "difference_automatically_mutates_human_source": false, "human_source_return": "direct human authorship or an explicit proposal/review/accepted source mutation"}, "skipped_sources": [], "status": "established", "recognised_sources": [{"basis": "explicit accepted ProjectCentral source relation", "exists": true, "path": "ProjectCentral/docs/0-ground/CORE-PRIMITIVE-FIELD.md", "provenance": "human-adopted", "ref": "central:source:project:O-I:ProjectCentral/docs/0-ground/CORE-PRIMITIVE-FIELD.md", "roles": ["document-tier-0", "project-docs-source-aperture", "self-description-source"], "standing": "authored-human-position", "treatment": "ordinary-project-source"}, {"basis": "explicit accepted ProjectCentral source relation", "exists": true, "path": "ProjectCentral/docs/1-vision/VISION.md", "provenance": "human-adopted", "ref": "central:source:project:O-I:ProjectCentral/docs/1-vision/VISION.md", "roles": ["document-tier-1", "project-docs-source-aperture", "self-description-source"], "standing": "design-commitment", "treatment": "ordinary-project-source"}, {"basis": "explicit accepted ProjectCentral source relation", "exists": true, "path": "ProjectCentral/docs/2-design/CAPABILITY-MATRIX.md", "provenance": "human-adopted", "ref": "central:source:project:O-I:ProjectCentral/docs/2-design/CAPABILITY-MATRIX.md", "roles": ["document-tier-2", "project-docs-source-aperture", "self-description-source"], "standing": "design-commitment", "treatment": "ordinary-project-source"}, {"basis": "explicit accepted ProjectCentral source relation", "exists": true, "path": "ProjectCentral/docs/3-architecture/CONTEXT-FRAME-ACCEPTANCE-CAMPAIGN.md", "provenance": "human-adopted", "ref": "central:source:project:O-I:ProjectCentral/docs/3-architecture/CONTEXT-FRAME-ACCEPTANCE-CAMPAIGN.md", "roles": ["document-tier-3", "project-docs-source-aperture", "self-description-source"], "standing": "architecture-contract", "treatment": "ordinary-project-source"}, {"basis": "explicit accepted ProjectCentral source relation", "exists": true, "path": "ProjectCentral/docs/4-development/CONVERGENCE-AND-ACCEPTANCE.md", "provenance": "human-adopted", "ref": "central:source:project:O-I:ProjectCentral/docs/4-development/CONVERGENCE-AND-ACCEPTANCE.md", "roles": ["document-tier-4", "project-docs-source-aperture", "self-description-source"], "standing": "current-development-state", "treatment": "ordinary-project-source"}, {"basis": "explicit accepted ProjectCentral source relation", "exists": true, "path": "ProjectCentral/docs/5-evidence/CONTINUOUS-WORK-PROVING.md", "provenance": "observed", "ref": "central:source:project:O-I:ProjectCentral/docs/5-evidence/CONTINUOUS-WORK-PROVING.md", "roles": ["document-tier-5", "project-docs-source-aperture", "self-description-source"], "standing": "observed-evidence", "treatment": "ordinary-project-source"}], "native_candidates": []}, "doctor": {"checks": [{"path": "Control/user", "valid": true}, {"path": "Control/agents/governance", "valid": true}, {"path": "Control/agents/wiki", "valid": true}, {"path": "Control/machines", "valid": true}, {"path": ".central", "valid": true}, {"path": "Work", "valid": true}], "mixed_root": {"detected": false, "signals": []}, "root": "<root>", "root_state": "directory", "valid": true}, "plan": {"already_present": [{"kind": "directory", "path": "Work/O-I/ProjectCentral"}, {"kind": "file", "path": "Work/O-I/ProjectCentral/project.json"}, {"kind": "directory", "path": "Work/O-I/ProjectCentral/user"}, {"kind": "directory", "path": "Work/O-I/ProjectCentral/agents/governance"}, {"kind": "directory", "path": "Work/O-I/ProjectCentral/agents/wiki"}, {"kind": "file", "path": "Work/O-I/ProjectCentral/agents/wiki/wiki.json"}, {"kind": "directory", "path": "Work/O-I/ProjectCentral/relations"}], "mutation": "additive-only", "noop": true, "project": "O-I", "project_id": "O-I", "project_id_source": "manifest", "project_root": "<root>/Work/O-I", "projectcentral": "Work/O-I/ProjectCentral", "schema": "central.world-reproject-plan/v1", "sources_by_provenance": {"agent-maintained": 15, "generated-derived": 14, "human-adopted": 178, "observed": 67, "unresolved": 7}, "would_not": ["never move, rename, delete, or relabel anything", "never write into an existing file, including an existing manifest or wiki.json", "never stamp authored relations: ProjectCentral/relations/source-relations.json is human/agent authored", "never fabricate ProjectCentral/provenance.json: a mutation receipt must be earned by a real mutation", "never federate the Project WikiSpace into the root WikiSpace: wiki tooling's job", "never write Wiki content: reprojection stamps structure only"], "would_stamp": []}}
const answered = value => ({status: 'answered', value})
const READINGS = {inspect: answered(REAL.inspect), ground: answered(REAL.ground), doctor: answered(REAL.doctor), plan: answered(REAL.plan)}
const OI = {name: 'O-I', project: 'O-I'}
const ID = 'central:docs'
const viewsOf = design => design.views ?? ['folded', 'compact', 'whole', 'full', 'widget']
const drawn = binding => viewsOf(docsDesign).filter(view => view !== 'popout').map(view => renderToStaticMarkup(createElement(host.HostedDevice, {designed: docsDesign, binding, view, nav: {}}))).join('\n')
/** A recording Central: each press as Central is asked it. */
function central() {
  const asked = []
  return {asked, port: async (action, input) => { asked.push([action, input]); return {} }}
}

test('Docs reads the six tiers, the unbound sources and their recognition from Central', () => {
  pages.resetHolds()
  const binding = pages.docsBinding(ID, OI, READINGS)
  assert.equal(binding.values.light, 'lit', 'the account stands: Central answered its inspection')
  const sources = JSON.parse(binding.values.sources)
  const tier0 = sources.find(row => row.tier === 0)
  assert.deepEqual(tier0, {path: 'ProjectCentral/docs/0-ground/CORE-PRIMITIVE-FIELD.md', tier: 0, rev: 'central.content-fnv1a64/v1:13808:dcbd37c6d6e4c54a',
    hints: [], recognised: {provenance: 'human-adopted', standing: 'authored-human-position'}})
  assert.deepEqual(sources.filter(row => row.tier !== null).map(row => row.tier), [0, 1, 2, 3, 4, 5], 'one source on each tier, in tier order')
  const loose = sources.filter(row => row.tier === null)
  assert.deepEqual(loose.map(row => [row.path, row.recognised]), [['ProjectCentral/docs/1-vision/dlw/gallery.mjs', false], ['ProjectCentral/docs/1-vision/dlw/render.mjs', false]],
    'a source no tier holds stands unbound, and Central recognises it as no ground')
  // Meaning and Moved since are not read until AIKit lists the world's laws: no source carries them (each tick hollow).
  assert.ok(sources.every(row => !('meaning' in row) && !('moved' in row)))
  assert.match(pages.DOCS_WIRING.reads.sources, /aikit knowledge reflection laws/)
  assert.match(pages.DOCS_WIRING.reads.sources, /projectcentral\.change\.horizon/)
  assert.deepEqual(JSON.parse(binding.values.account), {exists: true})
  assert.deepEqual([JSON.parse(binding.values.ux), JSON.parse(binding.values.ex)], [[], []], 'O-I binds no experience and no return yet: Central says so')
  const root = JSON.parse(binding.values.root)
  assert.equal(root.valid, true)
  assert.deepEqual(root.checks.map(check => check.path), ['Control/user', 'Control/agents/governance', 'Control/agents/wiki', 'Control/machines', '.central', 'Work'])
  const scaffold = JSON.parse(binding.values.scaffold)
  assert.equal(scaffold.project, 'O-I')
  assert.equal(scaffold.missing.length, 0)
  assert.ok(scaffold.present.includes('Work/O-I/ProjectCentral/project.json'))
  // Drawn: the account, not the reading's absence.
  const markup = drawn(binding)
  assert.doesNotMatch(markup, /\bNaN\b|undefined|data-device-fault/, 'every view draws, and no absent key is drawn as text')
  assert.match(markup, /CORE-PRIMITIVE-FIELD\.md/)
  assert.doesNotMatch(markup, /No reading of the account/)
})

// ---------------------------------------------------------------------------------------------------------------- Meaning and Moved since

const VISION = REAL.inspect.tier_bindings[1].sources[0], MATRIX = REAL.inspect.tier_bindings[2].sources[0]
/** A law the world writes in its `.aikit/reflection-laws/` (AIKit's listing, REAL in shape: ai-kit f2c6ae59), on one of O-I's sources. */
const LAW = (id, source, revision, coordinate, implementation) => ({id, source: source.ref, source_revision: revision, unique_implementation: true,
  mappings: [{coordinate, semantic: `wiki:node:${id}`, implementation, relation: 'implemented-by', description: null, description_relation: null, expected_implementation_revision: null}],
  constitutive_relations: []})
const VISION_LAW = LAW('law/vision', VISION, VISION.revision.revision, '§1 Vision', 'code:symbol:shell::vision')
const MATRIX_LAW = LAW('law/matrix', MATRIX, 'central.content-fnv1a64/v1:40000:aaaaaaaaaaaaaaaa', 'Capability matrix', 'code:symbol:matrix::rows')
const LISTING = {automatic_agent_or_model_invocation: false, declared_in: '.aikit/reflection-laws', version: 'aikit.reflection-laws/v1',
  laws: [{path: '.aikit/reflection-laws/matrix.json', law: MATRIX_LAW}, {path: '.aikit/reflection-laws/vision.json', law: VISION_LAW}],
  unreadable: [{path: '.aikit/reflection-laws/draft.json', error: 'not a ReflectionLaw: key must be a string at line 1 column 2'}]}
/** AIKit's verdict (aikit.reflection-verdict/v1, REAL in shape): the issues it found, by the coordinate they name. */
const VERDICT = (law, issues) => ({automatic_agent_or_model_invocation: false, law: law.id, map_bindings: 0, version: 'aikit.reflection-verdict/v1',
  verification: {issues, law: law.id, passed: issues.length === 0, source_revision: law.source_revision}})
const VERDICTS = {'law/vision': answered(VERDICT(VISION_LAW, [])),
  'law/matrix': answered(VERDICT(MATRIX_LAW, [{detail: 'missing reflected binding wiki:node:law/matrix -> code:symbol:matrix::rows', kind: 'missing', relation_ref: 'Capability matrix'},
    {detail: 'implementation endpoint code:symbol:matrix::rows is absent', kind: 'missing', relation_ref: 'Capability matrix'}]))}
/** Central's change horizon (central.source-change-horizon/v1) for O-I: the matrix moved three times since an earlier revision, twice since
 * the law read it; the vision has not moved since its law read it. */
const change = (cursor, source, before, after) => ({schema: 'central.source-change/v1', change_ref: `central:change:project:O-I:${cursor}`, cursor, world_ref: 'project:O-I',
  source_ref: source.ref, source_path: source.path, before_revision: before, after_revision: after, kind: 'modified', provider: 'central.filesystem-reconcile/v1'})
const HORIZON = {schema: 'central.source-change-horizon/v1', world_ref: 'project:O-I', cursor: 9, provider: 'central.filesystem-reconcile/v1', consumer_cursors: {},
  sources: [{binding: {ref: VISION.ref, path: VISION.path}, revision: VISION.revision}, {binding: {ref: MATRIX.ref, path: MATRIX.path}, revision: MATRIX.revision}],
  changes: [change(2, MATRIX, null, 'central.content-fnv1a64/v1:39000:9999999999999999'), change(4, MATRIX, 'central.content-fnv1a64/v1:39000:9999999999999999', MATRIX_LAW.source_revision),
    change(6, MATRIX, MATRIX_LAW.source_revision, 'central.content-fnv1a64/v1:41000:bbbbbbbbbbbbbbbb'), change(8, MATRIX, 'central.content-fnv1a64/v1:41000:bbbbbbbbbbbbbbbb', MATRIX.revision.revision),
    change(9, VISION, null, VISION.revision.revision)]}

test('Docs\' Meaning is each law the world declares, verified by AIKit; Moved since counts Central\'s changes since the law read its source', () => {
  pages.resetHolds()
  const binding = pages.docsBinding(ID, OI, {...READINGS, meaning: answered({laws: LISTING, verdicts: VERDICTS}), horizon: answered(HORIZON)})
  const sources = JSON.parse(binding.values.sources)
  const row = path => sources.find(r => r.path === path)
  assert.equal(row(VISION.path).meaning, 'holds', 'the vision\'s law holds')
  assert.deepEqual(row(VISION.path).mappings, [{coordinate: '§1 Vision', implementation: 'code:symbol:shell::vision', state: 'holds'}])
  assert.equal(row(VISION.path).moved, 0, 'nothing moved since its law read it')
  assert.equal(row(MATRIX.path).meaning, 'missing', 'how the matrix\'s law does not hold, in AIKit\'s word')
  assert.deepEqual(row(MATRIX.path).mappings, [{coordinate: 'Capability matrix', implementation: 'code:symbol:matrix::rows', state: 'missing',
    detail: 'missing reflected binding wiki:node:law/matrix -> code:symbol:matrix::rows; implementation endpoint code:symbol:matrix::rows is absent'}])
  assert.equal(row(MATRIX.path).moved, 2, 'two changes since the revision its law read, not the one before it')
  for (const other of sources.filter(r => r.path !== VISION.path && r.path !== MATRIX.path)) {
    assert.equal(other.meaning, 'none', `${other.path}: no law binds it`)
    assert.ok(!('moved' in other), `${other.path}: never read against the work, so nothing to count from`)
  }
  assert.match(binding.values['refusal:meaning'], /draft\.json is not a law: not a ReflectionLaw/, 'a file that is not a law is named')
  assert.equal(binding.values['refusal:moved'], undefined)
  // Drawn: the matrix waits on its meaning, and says how often it moved.
  const markup = drawn(binding)
  assert.doesNotMatch(markup, /\bNaN\b|undefined|data-device-fault/)
  assert.match(markup, /Meaning: missing/)
  assert.match(markup, /Moved 2 times since it was last read/)
})

test('Meaning and Moved since stand unread in their owners\' words when AIKit or Central refuses', () => {
  pages.resetHolds()
  const words = 'aikit knowledge reflection laws: no project is resolved here'
  const refused = pages.docsBinding(ID, OI, {...READINGS, meaning: {status: 'refused', error: words}})
  const rows = JSON.parse(refused.values.sources)
  assert.ok(rows.every(row => !('meaning' in row) && !('moved' in row)), 'nothing read: every tick hollow')
  assert.match(refused.values['refusal:meaning'], /no project is resolved here/)
  assert.match(drawn(refused), /Meaning is not read: aikit knowledge reflection laws: no project is resolved here/, 'the refusal is drawn in AIKit\'s words')
  const verdictRefused = pages.docsBinding(ID, OI, {...READINGS, meaning: answered({laws: LISTING, verdicts: {...VERDICTS, 'law/matrix': {status: 'refused', error: 'AIKit could not build the ProjectMap'}}}),
    horizon: {status: 'refused', error: 'Central could not reconcile the horizon'}})
  const sources = JSON.parse(verdictRefused.values.sources)
  const matrix = sources.find(r => r.path === MATRIX.path)
  assert.ok(!('meaning' in matrix), 'a law whose verdict was refused leaves its source unread')
  assert.equal(sources.find(r => r.path === VISION.path).meaning, 'holds')
  assert.match(verdictRefused.values['refusal:meaning'], /law\/matrix: AIKit could not build the ProjectMap/)
  assert.ok(sources.every(row => !('moved' in row)), 'Moved since stands unread while Central refuses its horizon')
  assert.equal(verdictRefused.values['refusal:moved'], 'Central could not reconcile the horizon')
})

test('Meaning is read from AIKit through the kernel: the laws a world declares, then each law\'s verdict, both in that world\'s ground', async () => {
  const asked = []
  const ask = async request => {
    asked.push(request)
    if (request.kind === 'reflection-laws') return LISTING
    if (request.law.id === 'law/matrix') throw new Error('AIKit could not build the ProjectMap')
    return VERDICTS[request.law.id].value
  }
  const meaning = await pages.readDocsMeaning('O-I', ask)
  assert.deepEqual(asked, [{kind: 'reflection-laws', project: 'O-I'}, {kind: 'reflection-verify', law: MATRIX_LAW, project: 'O-I'}, {kind: 'reflection-verify', law: VISION_LAW, project: 'O-I'}],
    'the listing, then each listed law as written, in the world\'s ground')
  assert.equal(meaning.laws, LISTING)
  assert.deepEqual(meaning.verdicts['law/matrix'], {status: 'refused', error: 'AIKit could not build the ProjectMap'})
  assert.deepEqual(meaning.verdicts['law/vision'], VERDICTS['law/vision'])
  // The horizon is asked only when a law names the revision it read its source at.
  assert.deepEqual(pages.docsHorizonInput('O-I', answered({laws: LISTING, verdicts: VERDICTS})), {project: 'O-I'})
  assert.equal(pages.docsHorizonInput('O-I', answered({laws: {...LISTING, laws: []}, verdicts: {}})), null)
  assert.equal(pages.docsHorizonInput(null, answered({laws: LISTING, verdicts: VERDICTS})), null)
})

test('Docs\' experiences and returns are Central\'s ux and ex, each named by its ref and source', () => {
  // SCRIPTED on Central's own record shape (ctrl/src/development_field.rs UxReading, ExReading): no world binds one yet (REAL: O-I, ai-kit,
  // Central, Workcell, Actuation and Archetypal-Earth each answer ux [] and ex []).
  const source = REAL.inspect.tier_bindings[1].sources[0]
  const inspect = {...REAL.inspect, ux: [{ux_ref: 'ux:dlw', source, intended_experience: true, implementation_fact: false, test_result: false, agent_inference: false, ex_human_return: false}],
    ex: [{ex_ref: 'ex:first-walk', ux_refs: ['ux:dlw'], source, artifact_refs: [], recorded_at_unix_seconds: 1, human_experience_return: true}]}
  const binding = pages.docsBinding(ID, OI, {...READINGS, inspect: answered(inspect)})
  assert.deepEqual(JSON.parse(binding.values.ux), [{ref: 'ux:dlw', source: source.path}])
  assert.deepEqual(JSON.parse(binding.values.ex), [{ref: 'ex:first-walk', source: source.path, ux: ['ux:dlw']}])
})

test('a refused reading stands in Central\'s words; your root world has no account to read', () => {
  pages.resetHolds()
  const words = 'Project root does not exist: <root>/Work/Nowhere'
  const refused = pages.docsBinding(ID, {name: 'Nowhere', project: 'Nowhere'}, {...READINGS, inspect: {status: 'refused', error: words}, plan: {status: 'refused', error: words}})
  assert.equal(refused.values.light, 'dark')
  for (const key of ['sources', 'account', 'ux', 'ex', 'scaffold']) {
    assert.equal(refused.values[key], undefined, `${key} is absent`)
    assert.equal(refused.standing[key].disabled, words, `${key}: the refusal word for word`)
  }
  assert.ok(refused.values.root, 'the root is read all the same')
  // Your world: Central reads one project's account; the root has none to inspect.
  const root = pages.docsBinding(ID, {name: 'Your world', project: null}, {doctor: READINGS.doctor})
  assert.equal(root.values.sources, undefined)
  assert.equal(root.standing.sources.disabled, pages.DOCS_NO_PROJECT)
  assert.ok(root.values.root)
})

test('Relate, Recognise, Ensure, Reproject and Initialise root write through Central as the person\'s presses, then Docs reads again', async () => {
  pages.resetHolds()
  const owner = central()
  let reread = 0
  const binding = pages.docsBinding(ID, OI, READINGS, {central: owner.port, reread: async () => { reread++ }})
  for (const key of ['relate', 'recognise', 'ensure', 'reproject', 'initRoot', 'readNow']) assert.equal(binding.standing?.[key], undefined, `${key} stands enabled`)
  const gallery = 'ProjectCentral/docs/1-vision/dlw/gallery.mjs'
  await binding.write([{key: 'relate', value: JSON.stringify({as: '2', source: gallery})}])
  await binding.write([{key: 'recognise', value: JSON.stringify({source: gallery, provenance: 'human-authored', standing: 'design-commitment'})}])
  await binding.write([{key: 'ensure', value: true}])
  await binding.write([{key: 'reproject', value: true}])
  await binding.write([{key: 'initRoot', value: true}])
  await binding.write([{key: 'readNow', value: true}])
  assert.deepEqual(owner.asked, [
    ['projectcentral.docs.tier.relate', {project: 'O-I', source_ref: 'central:source:project:O-I:ProjectCentral/docs/1-vision/dlw/gallery.mjs', tier: 2, acceptance: 'human-accepted'}],
    ['projectcentral.ground.apply', {project: 'O-I', source: gallery, provenance: 'human-authored', standing: 'design-commitment', treatment: 'retain-native-in-place', acceptance: 'human-accepted'}],
    ['projectcentral.docs.ensure', {project: 'O-I'}],
    ['central.world.reproject.apply', {project: 'O-I'}],
    ['central.init', {}],
  ])
  assert.equal(reread, 6, 'each act, and Read now, reads the account again')
  // A source Central names no ref for is not related; an experience or a return asks a ref the press does not name.
  await assert.rejects(binding.write([{key: 'relate', value: JSON.stringify({as: '1', source: 'nowhere.md'})}]), /nowhere\.md is not among the unbound sources/)
  await assert.rejects(binding.write([{key: 'relate', value: JSON.stringify({as: 'ux', source: gallery})}]), {message: pages.DOCS_RELATE_UX_EX})
  assert.equal(owner.asked.length, 5)
  // Open stands refused, naming what the Document opens.
  await assert.rejects(binding.write([{key: 'openSource', value: gallery}]), {message: pages.DOCS_WIRING.refused.openSource})
  // With no carrier, each press stands disabled saying so.
  const bare = pages.docsBinding(ID, OI, READINGS)
  for (const key of ['relate', 'recognise', 'ensure', 'reproject', 'initRoot']) assert.equal(bare.standing[key].disabled, pages.DOCS_NO_CARRIER)
})
