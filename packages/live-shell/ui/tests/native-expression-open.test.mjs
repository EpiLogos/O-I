import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

// T-EXPRESSIONS-OPEN. Production sources in memory, same loader as native-expression-commands.test.mjs: .ts/.tsx transpiled,
// CSS stubbed, the frame's .js specifiers resolved to their .ts sources.
//
// What these tests are. The owner here is a SCRIPTED STUB (a small reducer in this file, the same kind the frame's own
// native-composition.test.mjs uses): it answers create, edit, inspect, save_as and list, and it records every request in order.
// It is not the Rust expression owner and proves nothing about persistence. What is real is the code under test: the open
// sequence (nativeExpressionCommands.ts), the frame's NativeWorking and prepareCompositionEdit it drives, the frame's
// own starter documents, and the save receipt reader. The panel and browser wiring that React effects hide is asserted from
// the source text (labelled "code-reading").
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
const [CMD, COL, Context] = await Promise.all([
  import(new URL('components/nativeExpressionCommands.ts', shell)),
  import(new URL('components/NativeExpressionCollections.tsx', shell)),
  import(new URL('shell/workspaceContext.tsx', shell)),
])
const read = name => readFile(new URL(name, shell), 'utf8')
const escapeHtml = value => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;')
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

// ——— Open: Featured, Starters and presets ————————————————————————————————————————————————————————
test('Open on "O:I — the mark" is create, edit, save_as, then the open door, in that order, on the owner basis each step returned', async () => {
  const owner = stubOwner(), {ports, events, published} = portsOver(owner)
  const mark = COL.appCollectionItems().find(item => item.group === 'Featured' && item.name === 'O:I — the mark')
  assert.ok(mark, 'the featured collection holds "O:I — the mark"')
  const journey = COL.appCollectionJourney(mark.id)
  const outcome = await CMD.openStarter(ports, journey)

  assert.equal(outcome.ok, true, outcome.error)
  const ref = FIRST_REF
  assert.deepEqual(events, ['create', 'edit', 'parent', 'save_as', 'open:' + ref, 'refresh', 'list'], 'owner steps in order; the door opens only after the save; the list is read after')
  const [create, edit, saveAs] = owner.calls
  assert.deepEqual([create.operation, create.expression_ref, create.title, create.actor], ['create', ref, 'O:I — the mark', CMD.OPEN_ACTOR])
  assert.equal(edit.expected_revision, 1)
  assert.ok(edit.changes.some(change => change.change === 'scene_material_set'), 'the starter document rides the edit')
  const final = owner.documents.get(ref)
  assert.equal(final.scenes.length, journey.scenes.length, 'every Scene of the starter reached the owner')
  assert.ok(Object.keys(final.entities).length > 0, 'the starter\'s objects reached the owner')
  assert.equal(saveAs.expected_revision, final.revision, 'save_as names the revision the edit returned')
  assert.deepEqual(saveAs.parent, CENTRAL_ROOT)
  assert.match(saveAs.name, /^o-i-the-mark-[0-9a-f]{8}\.expression\.json$/)
  assert.match(saveAs.operation_ref, /^operation:expression:/)
  assert.deepEqual([saveAs.actor, saveAs.actor_kind], [CMD.OPEN_ACTOR, 'human'])
  assert.deepEqual(outcome.saved, {path: saveAs.name, revision: 'file-r1'})
  assert.equal(outcome.refused, null)
  assert.deepEqual(published.at(-1).map(work => work.expression_ref), [ref], 'the list is published after the open: the work is in it')
})

test('every Featured, Starter and preset row composes natively through the sequence and opens its own result', async () => {
  for (const item of COL.appCollectionItems()) {
    const owner = stubOwner(), {ports, events} = portsOver(owner)
    const outcome = await CMD.openStarter(ports, COL.appCollectionJourney(item.id))
    assert.equal(outcome.ok, true, `${item.group} · ${item.name}: ${outcome.error}`)
    assert.deepEqual(operations(owner.calls), ['create', 'edit', 'save_as', 'list'], item.name)
    assert.equal(events.filter(event => event.startsWith('open:')).length, 1, item.name)
    assert.ok(owner.calls[1].changes.length <= 256, `${item.name}: one edit stays inside the owner's 256-change guard`)
  }
})

test('each open forks a fresh identity: the same row twice makes two works, never one overwritten', async () => {
  const owner = stubOwner(), {ports} = portsOver(owner)
  const first = COL.appCollectionJourney('composition-chakra_body'), second = COL.appCollectionJourney('composition-chakra_body')
  assert.ok(first && second && first.id !== second.id, 'forkExpression mints a new Expression identity')
  const a = await CMD.openStarter(ports, first), b = await CMD.openStarter(ports, second)
  assert.equal(a.ok && b.ok, true)
  assert.notEqual(a.expression_ref, b.expression_ref)
  const names = owner.calls.filter(call => call.operation === 'save_as').map(call => call.name)
  assert.equal(new Set(names).size, 2, 'file names differ, so the second save is not refused as occupied')
})

test('the app collections have one starter document per row, forked on demand', () => {
  const items = COL.appCollectionItems()
  assert.equal(new Set(items.map(item => item.id)).size, items.length, 'row ids are unique across Featured, Starters and presets')
  for (const item of items) {
    const journey = COL.appCollectionJourney(item.id)
    assert.ok(journey, item.id)
    assert.equal(journey.name, item.name)
  }
  assert.equal(COL.appCollectionJourney('no-such-row'), undefined)
})

// ——— the refusal paths —————————————————————————————————————————————————————————————————————————
const aStarter = () => COL.appCollectionJourney('composition-chakra_body')

test('a create the owner refuses shows the owner\'s own text and goes no further', async () => {
  const owner = stubOwner({create: async () => { throw Error('Open Expression budget exceeded') }}), {ports, events} = portsOver(owner)
  const outcome = await CMD.openStarter(ports, aStarter())
  assert.equal(outcome.ok, false)
  assert.equal(outcome.error, 'Open Expression budget exceeded')
  assert.deepEqual(operations(owner.calls), ['create', 'list'])
  assert.ok(!events.some(event => event.startsWith('open:')) && !events.includes('parent'), 'no save and no open after a refused create')
})

test('an edit the owner refuses (revision conflict) stops before save_as and names the conflict', async () => {
  const owner = stubOwner({edit: async () => ({state: 'revision_conflict', current_revision: 7})}), {ports, events} = portsOver(owner)
  const outcome = await CMD.openStarter(ports, aStarter())
  assert.equal(outcome.ok, false)
  assert.match(outcome.error, /revision_conflict/)
  assert.equal(outcome.expression_ref, FIRST_REF, 'the work the owner already holds is named')
  assert.ok(!operations(owner.calls).includes('save_as'))
  assert.ok(!events.some(event => event.startsWith('open:')))
  assert.equal(events.at(-1), 'list', 'the works list is read again so it shows what the owner holds')
})

test('a save_as the owner refuses leaves the committed work open and puts the owner\'s own detail on the row', async () => {
  const owner = stubOwner({save_as: async () => ({state: 'save_refused', owner_operation: 'central.files.create', failure: {message: 'The destination directory is read-only'}})})
  const {ports, events, published} = portsOver(owner)
  const outcome = await CMD.openStarter(ports, aStarter())
  assert.equal(outcome.ok, true, 'the owner holds a committed native Expression; only the file was refused')
  assert.equal(outcome.saved, null)
  assert.match(outcome.refused, /The destination directory is read-only/)
  assert.match(outcome.refused, /central\.files\.create/, 'the owner operation that refused is named')
  assert.deepEqual(events.slice(0, 4), ['create', 'edit', 'parent', 'save_as'])
  assert.deepEqual(events.filter(event => event.startsWith('open:')), ['open:' + FIRST_REF], 'the work opens after the refused save, once')
  assert.equal(published.at(-1).length, 1, 'and it is in the list')
  const report = COL.reportOf('row', outcome)
  assert.equal(report.kind, 'error')
  assert.match(report.text, /^Opened, but not saved to a file\. .*The destination directory is read-only/)
})

test('a save that is acknowledged without a verified readback is not a save: the owner\'s text shows and no file is claimed', async () => {
  const owner = stubOwner({save_as: async request => ({state: 'saved_readback_failed', persisted: true, readback_verified: false, owner_operation: 'central.files.create', error: 'Native readback differs from the saved Expression',
    file: {location: {...CENTRAL_ROOT, path: request.name}, revision: 'r1'}})})
  const {ports} = portsOver(owner)
  const outcome = await CMD.openStarter(ports, aStarter())
  assert.equal(outcome.ok, true)
  assert.equal(outcome.saved, null, 'no saved file is claimed')
  assert.match(outcome.refused, /Native readback differs/)
})

test('a folder the owner cannot disclose sends no save_as and carries the owner\'s text on the row', async () => {
  const owner = stubOwner(), {ports, events} = portsOver(owner, {parent: async () => { throw Error('Central did not return a directory reading') }})
  const outcome = await CMD.openStarter(ports, aStarter())
  assert.equal(outcome.ok, true)
  assert.equal(outcome.refused, 'Central did not return a directory reading')
  assert.ok(!operations(owner.calls).includes('save_as'))
  assert.ok(events.some(event => event.startsWith('open:')))
})

test('with no owner channel attached the row says so and sends nothing', async () => {
  for (const run of [ports => CMD.openStarter(ports, aStarter()), ports => CMD.newExpression(ports, 'Untitled expression')]) {
    const owner = stubOwner(), {ports, events} = portsOver(owner, {expression: null})
    const outcome = await run(ports)
    assert.deepEqual(outcome, {ok: false, error: CMD.OWNER_UNATTACHED, expression_ref: null})
    assert.deepEqual(events, [])
    assert.deepEqual(owner.calls, [])
  }
})

test('a native access retired mid-sequence stops the save and the open', async () => {
  const owner = stubOwner(); let live = true
  const {ports, events} = portsOver(owner)
  ports.expression = async request => { const reply = await owner.channel(request); if (request.operation === 'edit') live = false; return reply }
  ports.current = () => live
  const outcome = await CMD.openStarter(ports, aStarter())
  assert.equal(outcome.ok, false)
  assert.equal(outcome.error, CMD.ACCESS_RETIRED)
  assert.ok(!operations(owner.calls).includes('save_as') && !events.some(event => event.startsWith('open:')))
})

test('a works list that cannot refresh after a good open is a warning beside the outcome, not a failure', async () => {
  const owner = stubOwner(), {ports, events} = portsOver(owner, {refresh: async () => { throw Error('list timed out') }})
  const outcome = await CMD.openStarter(ports, aStarter())
  assert.equal(outcome.ok, true)
  assert.match(outcome.warning, /list timed out/)
  assert.ok(events.some(event => event.startsWith('open:')), 'the work still opened')
})

// ——— New ———————————————————————————————————————————————————————————————————————————————————
test('New is one create with a fresh ref and title, then save_as into the works home, then the open door (N1)', async () => {
  const owner = stubOwner(), {ports, events, published} = portsOver(owner)
  const outcome = await CMD.newExpression(ports, 'Untitled expression')
  const ref = FIRST_REF
  assert.equal(outcome.ok, true)
  assert.deepEqual(events, ['create', 'parent', 'save_as', 'open:' + ref, 'refresh', 'list'])
  assert.deepEqual(operations(owner.calls), ['create', 'save_as', 'list'])
  assert.deepEqual([owner.calls[0].expression_ref, owner.calls[0].title, owner.calls[0].actor], [ref, 'Untitled expression', CMD.OPEN_ACTOR])
  const document = owner.documents.get(ref)
  assert.deepEqual([document.scenes.length, Object.keys(document.entities).length], [1, 0], 'an empty work: one Scene, no objects')
  assert.deepEqual(owner.calls[1].parent, CENTRAL_ROOT)
  assert.match(owner.calls[1].name, /^untitled-expression-00000001\.expression\.json$/)
  assert.deepEqual(outcome.saved, {path: owner.calls[1].name, revision: 'file-r1'})
  assert.deepEqual(published.at(-1).map(work => work.title), ['Untitled expression'])
})

test('two New works are two refs and two titles in the list', async () => {
  const owner = stubOwner(), {ports, published} = portsOver(owner)
  const first = await CMD.newExpression(ports, CMD.freshTitle('Untitled expression', []))
  const second = await CMD.newExpression(ports, CMD.freshTitle('Untitled expression', published.at(-1).map(work => work.title)))
  assert.equal(first.ok && second.ok, true)
  assert.notEqual(first.expression_ref, second.expression_ref)
  assert.deepEqual(published.at(-1).map(work => work.title).sort(), ['Untitled expression', 'Untitled expression 2'])
  assert.equal(CMD.freshTitle('Untitled expression', ['Untitled expression', 'Untitled expression 2']), 'Untitled expression 3')
  assert.equal(CMD.freshTitle('Untitled expression', ['Other']), 'Untitled expression')
})

test('a create the owner answers with a refusal state shows that text and opens nothing', async () => {
  const owner = stubOwner({create: async () => ({state: 'revision_conflict', detail: 'An open draft is never replaced implicitly'})}), {ports, events} = portsOver(owner)
  const outcome = await CMD.newExpression(ports, 'Untitled expression')
  assert.equal(outcome.ok, false)
  assert.match(outcome.error, /An open draft is never replaced implicitly/)
  assert.ok(!events.some(event => event.startsWith('open:')))
})

// ——— enumerate ————————————————————————————————————————————————————————————————————————————
test('enumerateWorks lists through the owner channel and publishes what it read, only while the access stands', async () => {
  const owner = stubOwner(); await owner.channel({operation: 'create', expression_ref: 'expression:a', title: 'A', actor: 'human:test'})
  const published = []
  assert.deepEqual((await CMD.enumerateWorks(owner.channel, works => published.push(works), () => true)).map(work => work.title), ['A'])
  assert.equal(published.length, 1)
  assert.deepEqual(await CMD.enumerateWorks(owner.channel, works => published.push(works), () => false), [])
  assert.equal(published.length, 1, 'a retired access publishes nothing')
  assert.deepEqual(await CMD.enumerateWorks(async () => ({schema: 'oi.expression-list/v1'}), works => published.push(works), () => true), [])
  assert.deepEqual(published.at(-1), [], 'an owner list with no expressions publishes the empty list, not a stale one')
})

test('a work presented after boot is listed once per distinct ref, never in a loop', () => {
  const held = [{expression_ref: 'expression:held'}]
  assert.equal(CMD.needsListing('expression:new', null, held), true, 'a presented work the list does not hold')
  assert.equal(CMD.needsListing('expression:new', 'expression:new', held), false, 'already asked for this ref')
  assert.equal(CMD.needsListing('expression:held', null, held), false, 'the list holds it')
  assert.equal(CMD.needsListing(undefined, null, held), false, 'no work presented')
  assert.equal(CMD.needsListing('expression:other', 'expression:new', held), true, 'a different ref is a new question')
})

test('code-reading: the Expressions panel lists the works after boot in every case, registers the owner channel, and lists a work it first presents', async () => {
  const panel = await read('panels/expressions.tsx')
  assert.match(panel, /import \{enumerateWorks, needsListing, setExpressionOwner, type NativeWorkRow\} from '\.\.\/components\/nativeExpressionCommands'/)
  assert.match(panel, /const boot = knownRef \|\| initial \? null : await enumerate\(\)\.then\(works => \(\{works\}\), cause => \(\{cause\}\)\)/, 'no held address: listed before mount, to choose the first work')
  assert.match(panel, /const existing = boot && 'works' in boot \? boot\.works : \[\]/)
  // O-I #763: a known open work, or a boot whose own listing failed, is listed after mount until the owner answers
  // (the former `void enumerate().catch(fail)` never asked again; expressions-opened-recovery.test.mjs runs the listing).
  assert.match(panel, /if \(!boot \|\| 'cause' in boot\) \{[\s\S]*?void listWorksUntilAnswered\(enumerate, \{/, 'a known open work: listed after mount (the former skip)')
  assert.match(panel, /return enumerateWorks\(request => owners\.channels\['kernel-expression'\]\(request, context\(\)\), works => workspaceRef\.current\.publishWorks\(works\)/)
  assert.match(panel, /needsListing\(presentedRef, listedFor, workspaceRef\.current\.nativeWorks\)/)
  assert.match(panel, /setExpressionOwner\(request => owners\.channels\['kernel-expression'\]\(request, context\(\)\)\)/)
  assert.match(panel, /live = false; setExpressionOwner\(null\)/, 'the channel is withdrawn with the panel')
  assert.doesNotMatch(panel, /interface NativeWork \{/, 'one row type, with enumerateWorks')
})

test('the owner channel registry holds the panel\'s channel and lets it go', () => {
  const channel = async () => ({})
  CMD.setExpressionOwner(channel)
  assert.equal(CMD.expressionOwner(), channel)
  CMD.setExpressionOwner(null)
  assert.equal(CMD.expressionOwner(), null)
})

// ——— the rows ——————————————————————————————————————————————————————————————————————————————
const sectionsOf = query => CMD.collectionSections(COL.appCollectionItems(), query)
const list = (props = {}) => renderToStaticMarkup(createElement(COL.CollectionList, {sections: sectionsOf(''), query: '', busy: null, report: null, onOpen: () => {}, onNew: () => {}, ...props}))

test('every row offers a live action: New, then Open on every Featured, Starter and preset row, with nothing disabled and no fork excuse', () => {
  const markup = list()
  for (const title of ['New', 'Featured', 'Starters', 'Built-in presets']) assert.match(markup, new RegExp(`aria-label="${title}"`))
  assert.match(markup, /<button[^>]*aria-label="New Expression"[^>]*>New<\/button>/)
  const opens = markup.match(/<button[^>]*aria-label="Open [^"]*"[^>]*>Open<\/button>/g) ?? []
  assert.equal(opens.length, COL.appCollectionItems().length)
  assert.doesNotMatch(markup, /disabled=""/, 'no row is disabled while nothing runs')
  assert.doesNotMatch(markup, /save_as owner operation|cannot call|unavailable/)
  assert.ok(markup.includes('O:I — the mark'))
  assert.ok((markup.match(/data-browser-row/g) ?? []).length === opens.length + 1, 'the rows join the browser\'s arrow-key walk')
})

test('while one row runs it says Opening and every row waits', () => {
  const featured = sectionsOf('')[0].rows[0]
  const markup = list({busy: featured.id})
  const busyButton = markup.match(new RegExp(`<button[^>]*aria-label="Open ${escapeHtml(featured.name)}"[^>]*>[^<]*</button>`))[0]
  assert.match(busyButton, /aria-busy="true"/)
  assert.match(busyButton, />Opening…<\/button>$/)
  assert.equal((markup.match(/<button[^>]*disabled=""/g) ?? []).length, COL.appCollectionItems().length + 1)
})

test('the owner\'s refusal is shown on its own row, as an alert, verbatim', () => {
  const [featured, other] = sectionsOf('')[0].rows.concat(sectionsOf('')[1].rows)
  const text = 'save_as (central.files.create): The destination directory is read-only <not a tag>'
  const markup = list({report: {id: featured.id, kind: 'error', text}})
  assert.equal((markup.match(/role="alert"/g) ?? []).length, 1)
  assert.ok(markup.includes(`<p class="native-error" role="alert">${escapeHtml(text)}</p>`))
  const row = id => markup.split('data-collection-row="').find(part => part.startsWith(id + '"')) ?? ''
  assert.ok(row(featured.id).includes('role="alert"'))
  assert.ok(!row(other.id).includes('role="alert"'), 'only the row that was refused shows it')
})

test('a success says where the work was saved, as a status; a bare New says nothing', () => {
  const featured = sectionsOf('')[0].rows[0]
  const saved = COL.reportOf(featured.id, {ok: true, expression_ref: 'expression:x', title: 'X', saved: {path: 'o-i-the-mark-1.expression.json', revision: 'r1'}, refused: null, warning: null})
  assert.deepEqual(saved, {id: featured.id, kind: 'status', text: 'Opened, and saved to o-i-the-mark-1.expression.json.'})
  assert.match(list({report: saved}), /<p class="native-empty" role="status">Opened, and saved to o-i-the-mark-1\.expression\.json\.<\/p>/)
  assert.equal(COL.reportOf('new', {ok: true, expression_ref: 'expression:x', title: 'X', saved: null, refused: null, warning: null}), null)
  assert.deepEqual(COL.reportOf('new', {ok: true, expression_ref: 'expression:x', title: 'X', saved: null, refused: null, warning: 'The works list could not be refreshed: x'}),
    {id: 'new', kind: 'status', text: 'The works list could not be refreshed: x'})
  assert.deepEqual(COL.reportOf('f', {ok: false, error: 'refused', expression_ref: null}), {id: 'f', kind: 'error', text: 'refused'})
})

test('a search narrows the collections and keeps New', () => {
  const markup = list({sections: sectionsOf('zz-no-such-collection'), query: 'zz-no-such-collection'})
  assert.match(markup, /aria-label="New"/)
  assert.equal((markup.match(/No collections match this search\./g) ?? []).length, 3)
  const mark = list({sections: sectionsOf('the mark'), query: 'the mark'})
  assert.ok(mark.includes('O:I — the mark'))
})

test('the browser container renders the same rows from the shell workspace and holds no document', () => {
  const workspace = {workspaceId: 'w', accessEpoch: 1, nativeAccessCurrent: () => true, nativeWorks: [], publishWorks: () => {}, requestExpression: () => {},
    mode: 'expressions', setMode: () => {}, transport: {kind: 'unavailable', reason: 'test'}}
  const markup = renderToStaticMarkup(createElement(Context.Workspace.Provider, {value: workspace}, createElement(COL.NativeExpressionCollections, {query: ''})))
  assert.match(markup, /aria-label="Open O:I — the mark"/)
  assert.doesNotMatch(markup, /disabled=""/)
})

test('code-reading: FORK_REASON is gone from the shell, and the container opens through the panel\'s channel and the one open door', async () => {
  for (const name of ['components/nativeExpressionCommands.ts', 'components/NativeExpressionCollections.tsx', 'components/NativeExpressionGuide.tsx', 'components/WorldBrowser.tsx', 'panels/expressions.tsx']) {
    assert.doesNotMatch(await read(name), /FORK_REASON|cannot call|needs the native save_as owner operation/, name)
  }
  assert.equal(CMD.FORK_REASON, undefined)
  const collections = await read('components/NativeExpressionCollections.tsx')
  assert.match(collections, /const epoch = workspace\.accessEpoch, workspaceId = workspace\.workspaceId, channel = expressionOwner\(\)/)
  assert.match(collections, /onDoubleClick=\{busy === null \? act : undefined\}/, 'manual 10.3: double-click opens, as the button does')
  assert.match(collections, /if \(running\.current\) return\n\s+running\.current = true/, 'one run at a time')
  assert.match(collections, /shell\.requestExpression\(ref\)/, 'the open door is workspace.requestExpression')
  assert.match(collections, /if \(shell\.mode === 'audio'\) shell\.setMode\('expressions'\)/, 'Live reveals Expressions first, as a works row does')
  const browser = await read('components/WorldBrowser.tsx')
  assert.match(browser, /<NativeExpressionCollections query=\{query\}\/>/, 'the browser mounts the collections with the one prop')
})

test('with no works home (parent null), New commits and opens the work and saves no file', async () => {
  const sent = []
  const channel = async request => {
    sent.push(request.operation)
    if (request.operation === 'create') return {state: 'ready', document: {expression_ref: request.expression_ref, title: request.title, revision: 1}}
    return {state: 'ready', document: {expression_ref: request.expression_ref, title: 't', revision: 2}}
  }
  const opened = []
  const outcome = await CMD.newExpression({expression: channel, parent: null, uuid: () => 'u-1', current: () => true, refresh: async () => {}, open: ref => opened.push(ref)}, 'Untitled')
  assert.equal(outcome.ok, true)
  assert.equal(outcome.saved, null)
  assert.deepEqual(opened, ['expression:authored-u-1'])
  assert.ok(!sent.includes('save_as'))
})
