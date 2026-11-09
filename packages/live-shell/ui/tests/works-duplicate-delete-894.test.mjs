// O-I #747 round 894, the port ledger's fork-saved and delete-saved (manual §10.9: a track's acts are Rename ⌘R, Duplicate ⌘D and Delete
// ⌫; §20.1: in Expressions a track is an Expression). Duplicate is the owner's fork of the work under a fresh ref, named as a second of
// its title, saved into the works home and opened; a work listed only as its file is opened from it first. Delete is the owner's delete:
// the work's file leaves the works home for Central's trash on the revision read, by the person's own act, and the works list is read
// again; Central's file history brings it back. Each refusal is the owner's words.
// The owner is a SCRIPTED STUB (as native-expression-open.test.mjs); what is real is the shell's sequences and the track menu's acts
// (timeline/expressionsTrackAdapter.ts, frame/menu/objectActions.ts).
import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {readFile} from 'node:fs/promises'

const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(specifier,context,next){
  try{return await next(specifier,context)}catch(error){
    if(!specifier.startsWith('.'))throw error;
    if(specifier.endsWith('.js')){try{return await next(specifier.slice(0,-3)+'.ts',context)}catch{}}
    for(const suffix of ['.ts','.tsx']){try{return await next(specifier+suffix,context)}catch{}}
    throw error;
  }
}
export async function load(url,context,next){
  if(url.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export {}'};
  if(!url.endsWith('.ts')&&!url.endsWith('.tsx'))return next(url,context);
  return {format:'module',shortCircuit:true,source:ts.transpileModule(await readFile(new URL(url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:new URL(url).pathname}).outputText};
}`)}`, import.meta.url)

const root = new URL('../../../../', import.meta.url)
const shell = new URL('packages/live-shell/ui/src/', root)
const [CMD, Adapter, Menu] = await Promise.all([
  import(new URL('components/nativeExpressionCommands.ts', shell)),
  import(new URL('timeline/expressionsTrackAdapter.ts', shell)),
  import(new URL('frame/menu/objectActions.ts', shell)),
])
const read = name => readFile(new URL(name, shell), 'utf8')
const clone = value => structuredClone(value)

// ——— the scripted stub owner ————————————————————————————————————————————————————————————————————
const reorder = value => Array.isArray(value) ? value.map(reorder) : value && typeof value === 'object'
  ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, reorder(v)])) : value
function emptyDocument(ref, title) {
  return {schema: 'oi.expression/v1', expression_ref: ref, revision: 1, title, scenes: [{scene_ref: ref + ':scene:main', revision: 1, title: 'Main', entity_refs: []}],
    entities: {}, relations: {}, selection: {scene_ref: ref + ':scene:main', entity_ref: null}, provenance: [], representations: [], refinements: []}
}
/** The edit reducer of the frame's native-composition.test.mjs (ownerEdit): the changes a composition edit may carry, applied to the document. */
function applyEdit(document, request) {
  if (request.expected_revision !== document.revision) return {state: 'revision_conflict', current_revision: document.revision}
  const d = clone(document), scene = ref => d.scenes.find(row => row.scene_ref === ref)
  for (const c of request.changes) {
    switch (c.change) {
      case 'rename': d.title = c.title; break
      case 'composition_set': d.presentation = clone(c.presentation); break
      case 'scene_create': d.scenes.push({scene_ref: c.scene_ref, title: c.title, revision: 1, entity_refs: []}); break
      case 'entity_add': d.entities[c.entity_ref] = {entity_ref: c.entity_ref, title: c.title, revision: 1, subject: null, parameters: {glyph: {value: 'O'}}}; scene(c.scene_ref).entity_refs.push(c.entity_ref); break
      case 'scene_rename': scene(c.scene_ref).title = c.title; if (scene(c.scene_ref).presentation) scene(c.scene_ref).presentation.scene.name = c.title; break
      case 'scene_compose': scene(c.scene_ref).entity_refs = [...c.entity_refs]; break
      case 'scene_material_set': scene(c.scene_ref).presentation = clone(c.presentation); if (!c.presentation.saved) delete scene(c.scene_ref).presentation.saved; break
      case 'scene_remove': d.scenes = d.scenes.filter(row => row.scene_ref !== c.scene_ref); break
      case 'scene_reorder': d.scenes = c.scene_refs.map(scene); break
      case 'focus': d.selection = {scene_ref: c.scene_ref, entity_ref: c.entity_ref}; break
      default: assert.fail('Unexpected native operation ' + c.change)
    }
  }
  if (request.changes.length) d.revision++
  return {state: 'ready', document: reorder(d)}
}
const CENTRAL_ROOT = {schema: 'central.path-ref/v1', ref: 'central:root', root: 'central:root', path: ''}
/** `override` replaces the stub's answer to one operation: (request, document, calls) => reply, or throws as the transport does on a refusal. */
function stubOwner(override = {}) {
  const documents = new Map(), calls = []
  const channel = async request => {
    calls.push(clone(request))
    if (override[request.operation]) return override[request.operation](request, documents.get(request.expression_ref), calls)
    switch (request.operation) {
      case 'create': { const d = emptyDocument(request.expression_ref, request.title); documents.set(d.expression_ref, d); return {state: 'ready', document: clone(d)} }
      case 'inspect': return {state: 'ready', document: clone(documents.get(request.expression_ref))}
      case 'edit': { const result = applyEdit(documents.get(request.expression_ref), request); if (result.document) documents.set(request.expression_ref, result.document); return result }
      case 'save_as': {
        const d = documents.get(request.expression_ref)
        if (request.expected_revision !== d.revision) return {state: 'revision_conflict', current_revision: d.revision}
        return {state: 'saved', persisted: true, readback_verified: true, owner_operation: 'central.files.create',
          file: {location: {schema: 'central.path-ref/v1', ref: 'central:file:' + request.name, root: request.parent.root, path: request.name}, revision: 'file-r1'}}
      }
      case 'list': return {schema: 'oi.expression-list/v1', expressions: [...documents.values()].map(d => ({expression_ref: d.expression_ref, revision: d.revision, title: d.title, dirty: true, last_touched_unix: 0}))}
      default: assert.fail('unexpected owner operation ' + request.operation)
    }
  }
  return {channel, calls, documents}
}
/** Ports over a stub owner. `events` interleaves the owner's requests with the shell's own steps, in order. */
function portsOver(owner, extra = {}) {
  const events = [], published = []
  let uuid = 0
  const wrapped = async request => { events.push(request.operation); return owner.channel(request) }
  const ports = {
    expression: wrapped,
    // Round 895 (0b.2): Delete goes by the person's own press channel, which the stub answers as the owner.
    press: wrapped,
    parent: async () => { events.push('parent'); return CENTRAL_ROOT },
    uuid: () => `${String(++uuid).padStart(8, '0')}-0000-4000-8000-000000000000`,
    current: () => true,
    refresh: async () => { events.push('refresh'); return CMD.enumerateWorks(wrapped, works => published.push(works), () => true) },
    open: ref => events.push('open:' + ref),
    ...extra,
  }
  return {ports, events, published}
}
const operations = calls => calls.map(call => call.operation)
/** The ref the first uuid of a ports object mints. */
const FIRST_REF = 'expression:authored-00000001-0000-4000-8000-000000000000'


function forking(documents) {
  return {fork: request => {
    const d = documents.get(request.expression_ref)
    if (request.expected_revision !== d.revision) return {state: 'revision_conflict', current_revision: d.revision}
    const f = clone(d); f.expression_ref = request.new_expression_ref; f.revision = 1
    f.scenes = f.scenes.map(s => ({...s, scene_ref: request.new_expression_ref + s.scene_ref.slice(request.expression_ref.length)}))
    documents.set(f.expression_ref, f); return {state: 'ready', document: clone(f)}
  }}
}
function owner(extra = {}) {
  const box = {}
  const made = stubOwner({...forking({get: ref => box.made.documents.get(ref), set: (ref, d) => box.made.documents.set(ref, d)}), ...extra})
  box.made = made
  return made
}
const works = documents => [...documents.values()].map(d => ({expression_ref: d.expression_ref, title: d.title, revision: d.revision, open: true}))

test('Duplicate is the owner\'s fork under a fresh ref, named a second of its title, saved into the works home, then opened', async () => {
  const o = owner()
  o.documents.set('expression:dawn', emptyDocument('expression:dawn', 'Dawn'))
  const {ports, events} = portsOver(o)
  const outcome = await CMD.duplicateWork(ports, works(o.documents), 'expression:dawn')
  assert.equal(outcome.ok, true, outcome.error)
  assert.equal(outcome.expression_ref, FIRST_REF)
  assert.equal(outcome.title, 'Dawn 2')
  assert.deepEqual(events.filter(e => !['list'].includes(e)), ['inspect', 'fork', 'edit', 'parent', 'save_as', 'open:' + FIRST_REF, 'refresh'])
  const fork = o.calls.find(call => call.operation === 'fork')
  assert.deepEqual(fork, {operation: 'fork', expression_ref: 'expression:dawn', expected_revision: 1, new_expression_ref: FIRST_REF, actor: 'human:expressions-app'})
  assert.equal(o.documents.get(FIRST_REF).title, 'Dawn 2')
  assert.equal(o.documents.get('expression:dawn').title, 'Dawn', 'the work duplicated is left as it was')
  assert.match(o.calls.find(call => call.operation === 'save_as').name, /^dawn-2-00000001\.expression\.json$/)
})

test('a work listed only as its file is opened from it first; a refused fork stops with the owner\'s words', async () => {
  const file = {schema: 'central.path-ref/v1', ref: 'central:file:dusk', root: 'central:root', path: 'Control/user/flows/dusk.expression.json'}
  let o
  o = owner({open_file: () => { o.documents.set('expression:dusk', emptyDocument('expression:dusk', 'Dusk')); return {state: 'ready', document: emptyDocument('expression:dusk', 'Dusk'), dirty: false} }})
  const listed = [{expression_ref: 'expression:dusk', title: 'Dusk', revision: 1, open: false, location: file, file_revision: 'r9'}]
  const outcome = await CMD.duplicateWork(portsOver(o).ports, listed, 'expression:dusk')
  assert.equal(outcome.ok, true, outcome.error)
  assert.deepEqual(o.calls.map(call => call.operation).slice(0, 3), ['open_file', 'inspect', 'fork'])
  assert.deepEqual([o.calls[0].location, o.calls[0].expected_file_revision], [file, 'r9'])
  assert.equal(outcome.title, 'Dusk 2')
  const refusing = owner({fork: () => ({state: 'revision_conflict', current_revision: 4})})
  refusing.documents.set('expression:dawn', emptyDocument('expression:dawn', 'Dawn'))
  const stopped = await CMD.duplicateWork(portsOver(refusing).ports, works(refusing.documents), 'expression:dawn')
  assert.equal(stopped.ok, false)
  assert.match(stopped.error, /revision/i)
  assert.ok(!refusing.calls.some(call => call.operation === 'save_as'), 'nothing is saved past a refused fork')
})

test('Delete is the owner\'s delete of the work, then the works list again; a closed work names its file and the revision read', async () => {
  const o = owner({delete: request => ({state: 'deleted', expression_ref: request.expression_ref, title: 'Dawn', location: {path: 'Control/user/flows/dawn.expression.json'}, revision: 'r3',
    recover: {action: 'central.files.restore', expected_revision: '', revision: 'r3'}})})
  o.documents.set('expression:dawn', emptyDocument('expression:dawn', 'Dawn'))
  const {ports, events} = portsOver(o)
  const answer = await CMD.deleteWork(ports, works(o.documents), 'expression:dawn')
  // REPLACED (O-I #747 round 896, 1R-surface.8): Delete's sentences quote the title, isolated (offerWords' quoted name).
  assert.deepEqual(answer, {ok: true, note: '“\u2068Dawn\u2069” left the works home for Central\'s trash: Central\'s file history brings it back.'})
  assert.deepEqual(o.calls[0], {operation: 'delete', expression_ref: 'expression:dawn', actor: 'human:expressions-app', actor_kind: 'human'})
  assert.ok(events.includes('refresh'))
  const file = {schema: 'central.path-ref/v1', ref: 'central:file:dusk', root: 'central:root', path: 'Control/user/flows/dusk.expression.json'}
  await CMD.deleteWork(ports, [{expression_ref: 'expression:dusk', title: 'Dusk', revision: 1, open: false, location: file, file_revision: 'r9'}], 'expression:dusk')
  assert.deepEqual(o.calls.find(call => call.operation === 'delete' && call.expression_ref === 'expression:dusk'), {operation: 'delete', expression_ref: 'expression:dusk', actor: 'human:expressions-app', actor_kind: 'human', location: file, expected_file_revision: 'r9'})
})

test('a delete the owner refuses keeps the work and says the owner\'s words', async () => {
  const dirty = owner({delete: () => ({state: 'dirty', detail: 'The Expression has unsaved changes: save it first, so the trash keeps what you made (delete never discards unsaved work)'})})
  dirty.documents.set('expression:dawn', emptyDocument('expression:dawn', 'Dawn'))
  assert.deepEqual(await CMD.deleteWork(portsOver(dirty).ports, works(dirty.documents), 'expression:dawn'),
    {ok: false, error: 'The Expression has unsaved changes: save it first, so the trash keeps what you made (delete never discards unsaved work)'})
  const unauth = owner({delete: () => ({state: 'delete_refused', owner_operation: 'central.files.trash', failure: {kind: 'refused', message: 'missing bounded CENTRAL_NATIVE_TOKEN'}})})
  unauth.documents.set('expression:dawn', emptyDocument('expression:dawn', 'Dawn'))
  assert.deepEqual(await CMD.deleteWork(portsOver(unauth).ports, works(unauth.documents), 'expression:dawn'),
    {ok: false, error: 'Central would not take it to the trash: missing bounded CENTRAL_NATIVE_TOKEN'})
  assert.deepEqual(await CMD.deleteWork({...portsOver(unauth).ports, expression: null}, [], 'expression:dawn'), {ok: false, error: CMD.OWNER_UNATTACHED})
  assert.deepEqual(await CMD.deleteWork({...portsOver(unauth).ports, press: null}, [], 'expression:dawn'), {ok: false, error: CMD.OWNER_UNATTACHED},
    'with no press channel of the person\'s own, nothing is sent (round 895, 0b.2)')
})

// O-I #747 round 896, 1S (DLW build ruling 2026-11-09, F4 of review c99c): one Delete at a time per work (1R-surface.4), pinned in the
// shell's own suite as well as the frame's (delete-hold-896): a second Delete of the same work while the first waits for Central's answer is
// refused in words naming the work, and the owner is not asked again; once the first is answered, the work's Delete goes again.
test('round 896, 1S: a second Delete of a work whose Delete waits is refused in words, and the owner is not asked again', async () => {
  let answer
  const waits = new Promise(resolve => { answer = resolve })
  const o = owner({delete: async request => { await waits; return {state: 'deleted', expression_ref: request.expression_ref, title: 'Dawn'} }})
  o.documents.set('expression:dawn', emptyDocument('expression:dawn', 'Dawn'))
  const {ports} = portsOver(o)
  const deletes = () => operations(o.calls).filter(operation => operation === 'delete').length
  const turns = async () => { for (let i = 0; i < 50; i++) await new Promise(resolve => setImmediate(resolve)) }
  try {
    const first = CMD.deleteWork(ports, works(o.documents), 'expression:dawn')
    await turns()
    assert.equal(deletes(), 1, 'the first Delete reached the owner, and waits for its answer')
    // Raced against the event loop's turns: a second Delete that went on to the owner would wait there on the first one's answer.
    const again = await Promise.race([CMD.deleteWork(ports, works(o.documents), 'expression:dawn'), turns().then(() => 'the second Delete went on to the owner')])
    assert.deepEqual(again, {ok: false, error: `“⁨Dawn⁩” ${CMD.DELETE_IN_FLIGHT}`})
    assert.equal(deletes(), 1, 'the owner is not asked again')
    answer()
    assert.equal((await first).ok, true)
    assert.equal((await CMD.deleteWork(ports, works(o.documents), 'expression:dawn')).ok, true, 'answered, the work\'s Delete goes again')
    assert.equal(deletes(), 2)
  } finally { answer() }
})

test('an Expression\'s track carries Duplicate (⌘D) and Delete (⌫), each on its own Expression; Delete is drawn as an act that takes away', () => {
  const ran = []
  const reading = {expressions: [{id: 'expression:dawn', name: 'Dawn', scenes: [{id: 'expression:dawn:scene:main', name: 'Main', duration: 4}]}],
    controls: {works: {op: 'the owner\'s fork and save_as; its delete', duplicate: ref => ran.push(['duplicate', ref]), remove: ref => ran.push(['remove', ref])}}}
  const set = Adapter.expressionsTrackAdapter.project(reading)
  const track = set.tracks.find(t => t.id === 'expression:expression:dawn:visual')
  assert.ok(track, JSON.stringify(set.tracks.map(t => t.id)))
  assert.match(set.actions.duplicateTrack.op, /fork/)
  set.actions.duplicateTrack.run(track.id); set.actions.removeTrack.run('expression:expression:dawn:audio')
  assert.deepEqual(ran, [['duplicate', 'expression:dawn'], ['remove', 'expression:dawn']])
  const items = Menu.objectMenu({kind: 'track', id: track.id, name: 'Dawn'}, set, {view: 'session', binding: null, press: (k, w, run) => run(), rename: () => {}, writeClip: async () => {}})
  const duplicate = items.find(item => item.id === 'duplicate'), del = items.find(item => item.id === 'delete')
  assert.equal(duplicate.disabled, undefined, duplicate.why)
  assert.equal(del.disabled, undefined, del.why)
  assert.equal(del.tone, 'destructive')
})

test('CODE-READING: the Expressions tracks get their works acts from the panel\'s owner channel and the one open door', async () => {
  const tracks = await read('frame/tracks/modeTracks.ts')
  assert.match(tracks, /controls\.works = \{op: [^\n]*duplicate: ref => duplicateWork\(ports, works\(\), ref\)[^\n]*remove: ref => deleteWork\(ports, works\(\), ref\)/)
})
