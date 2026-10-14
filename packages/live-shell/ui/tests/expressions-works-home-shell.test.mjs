import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'

// FOUNDATION N1, the shell side: the works the owner lists only as files in its works home reach the browser's works and
// Technē's Sources with their location, open through the owner's own open_file, and every new or opened work is saved into
// the home the owner's list discloses.
//
// What these tests are. The owner is a SCRIPTED STUB (a reducer in this file) speaking the kernel's `list` reading
// (oi.expression-list/v1 with `open`, `location`, `file_revision`, `unreadable` and `home` — the shapes the kernel's own
// tests prove over a fake Central file owner, desktop/cradle/kernel/src/expression_home.rs) and open_file, create and
// save_as. It is not the Rust owner and proves nothing about persistence. What is real is the code under test:
// nativeExpressionCommands.ts. The panel and browser wiring React effects hide is read from the source text ("code-reading").
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

const shell = new URL('../src/', import.meta.url)
const CMD = await import(new URL('components/nativeExpressionCommands.ts', shell))
const read = name => readFile(new URL(name, shell), 'utf8')
const clone = value => structuredClone(value)

// ——— the scripted stub owner ————————————————————————————————————————————————————————————————————
const ROOT = '/ground'
const at = path => ({schema: 'central.path-ref/v1', ref: `central:path:${ROOT}:${path}`, root: ROOT, path})
const HOME = at('Control/user/flows')
const documentOf = (ref, title, revision = 1) => ({schema: 'oi.expression/v1', expression_ref: ref, revision, title,
  scenes: [{scene_ref: ref + ':scene:main', revision: 1, title: 'Main', entity_refs: []}], entities: {}, relations: {},
  selection: {scene_ref: ref + ':scene:main', entity_ref: null}, provenance: [], representations: [], refinements: []})
/** `files`: name → document (or a string that does not decode). `home: false` is a home the owner cannot list. */
function stubOwner({files = {}, open = [], home = true, override = {}} = {}) {
  const held = new Map(open.map(d => [d.expression_ref, clone(d)])), stored = new Map(), calls = []
  const put = (name, document) => stored.set(HOME.path + '/' + name, {document: clone(document), revision: `file-r${stored.size + 1}`})
  for (const [name, document] of Object.entries(files)) put(name, document)
  const channel = async request => {
    calls.push(clone(request))
    if (override[request.operation]) return override[request.operation](request, calls)
    switch (request.operation) {
      case 'list': {
        const rows = [...held.values()].map(d => ({expression_ref: d.expression_ref, revision: d.revision, title: d.title, dirty: true, last_touched_unix: 5, open: true}))
        if (!home) return {schema: 'oi.expression-list/v1', expressions: rows, unreadable: [], home: {path: HOME.path, state: 'unavailable', error: 'Central listing requires a directory'}}
        const closed = [], unreadable = []
        for (const [path, file] of stored) {
          const name = path.slice(HOME.path.length + 1)
          if (typeof file.document === 'string') unreadable.push({name, location: at(path), error: 'Expected value at line 1 column 2'})
          else if (!held.has(file.document.expression_ref)) closed.push({expression_ref: file.document.expression_ref, revision: file.document.revision, title: file.document.title,
            dirty: false, last_touched_unix: 0, open: false, location: at(path), file_revision: file.revision})
        }
        return {schema: 'oi.expression-list/v1', expressions: [...rows, ...closed], unreadable, home: {path: HOME.path, state: 'listed', location: HOME, truncated: false}}
      }
      case 'open_file': {
        const file = stored.get(request.location.path)
        if (!file) throw Error('No such native file')
        if (request.expected_file_revision !== undefined && request.expected_file_revision !== file.revision) return {state: 'file_revision_conflict', expected_revision: request.expected_file_revision, current_revision: file.revision}
        const existing = held.get(file.document.expression_ref)
        if (existing && JSON.stringify(existing) !== JSON.stringify(file.document)) return {state: 'revision_conflict', expression_ref: existing.expression_ref, current_revision: existing.revision, detail: 'An open draft is never replaced implicitly'}
        held.set(file.document.expression_ref, clone(file.document))
        return {state: 'ready', document: clone(file.document), dirty: false, saved_revision: file.document.revision, file: {location: request.location, revision: file.revision}}
      }
      case 'create': { const d = documentOf(request.expression_ref, request.title); held.set(d.expression_ref, d); return {state: 'ready', document: clone(d)} }
      case 'save_as': {
        const d = held.get(request.expression_ref)
        if (request.expected_revision !== d.revision) return {state: 'revision_conflict', current_revision: d.revision}
        put(request.name, d)
        const path = request.parent.path + '/' + request.name
        return {state: 'saved', persisted: true, readback_verified: true, owner_operation: 'central.files.create', file: {location: at(path), revision: stored.get(path).revision}}
      }
      default: assert.fail('unexpected owner operation ' + request.operation)
    }
  }
  return {channel, calls, held}
}
const operations = calls => calls.map(call => call.operation)
const ports = (owner, extra = {}) => {
  const events = [], published = []
  const wrapped = async request => { events.push(request.operation); return owner.channel(request) }
  return {events, published, ports: {expression: wrapped, parent: () => CMD.worksHome(wrapped), uuid: () => '00000001-0000-4000-8000-000000000000',
    current: () => true, refresh: () => CMD.enumerateWorks(wrapped, works => published.push(works), () => true),
    open: ref => events.push('open:' + ref), ...extra}}
}

// ——— the works list ————————————————————————————————————————————————————————————————————————————
test('enumerate publishes the open works, then each work that lives only as a file in the home with its location, then the files the owner could not read', async () => {
  const owner = stubOwner({open: [documentOf('expression:open', 'Open')],
    files: {'alpha.expression.json': documentOf('expression:alpha', 'Alpha', 3), 'broken.expression.json': '{"schema'}})
  const published = []
  const works = await CMD.enumerateWorks(owner.channel, rows => published.push(rows), () => true)
  assert.deepEqual(published, [works])
  assert.deepEqual(works.map(work => [work.expression_ref, work.open]), [
    ['expression:open', true], ['expression:alpha', false], [at('Control/user/flows/broken.expression.json').ref, false]])
  const alpha = works[1]
  assert.deepEqual([alpha.title, alpha.revision, alpha.location, alpha.file_revision], ['Alpha', 3, at('Control/user/flows/alpha.expression.json'), 'file-r1'])
  const broken = works[2]
  assert.equal(broken.title, 'broken.expression.json', 'an unreadable file is shown under its own name, never dropped')
  assert.equal(broken.error, 'Expected value at line 1 column 2')
  assert.deepEqual(broken.location, at('Control/user/flows/broken.expression.json'))
  assert.equal(CMD.closedWork(works, 'expression:alpha'), alpha)
  assert.equal(CMD.closedWork(works, 'expression:open'), null, 'an open work opens by ref')
  assert.equal(CMD.closedWork(works, 'expression:absent'), null)
})

test('the save parent is the works home the owner disclosed on its last list, listed afresh when none is held, refused with the owner\'s reason', async () => {
  const owner = stubOwner()
  CMD.setExpressionOwner(null)
  assert.deepEqual(await CMD.worksHome(owner.channel), HOME, 'nothing held: the home is listed')
  assert.deepEqual(operations(owner.calls), ['list'])
  await CMD.enumerateWorks(owner.channel, () => {}, () => true)
  assert.deepEqual(await CMD.worksHome(owner.channel), HOME)
  assert.deepEqual(operations(owner.calls), ['list', 'list'], 'held from the last list: no second list')
  CMD.setExpressionOwner(async () => ({}))
  CMD.setExpressionOwner(null)
  const missing = stubOwner({home: false})
  await assert.rejects(CMD.worksHome(missing.channel), /The works home Control\/user\/flows is unavailable: Central listing requires a directory/)
  await CMD.enumerateWorks(missing.channel, () => {}, () => true)
  await assert.rejects(CMD.worksHome(missing.channel), /unavailable/, 'an unavailable home is never a parent')
  CMD.setExpressionOwner(null)
})

// ——— opening a work that lives only as its file ————————————————————————————————————————————————
test('opening a listed file sends the owner\'s open_file with its location and file revision, and the work is then held', async () => {
  const owner = stubOwner({files: {'alpha.expression.json': documentOf('expression:alpha', 'Alpha')}})
  const works = await CMD.enumerateWorks(owner.channel, () => {}, () => true)
  await CMD.openListedWork(owner.channel, CMD.closedWork(works, 'expression:alpha'))
  const open = owner.calls.at(-1)
  assert.deepEqual(open, {operation: 'open_file', location: at('Control/user/flows/alpha.expression.json'), expected_file_revision: 'file-r1', actor: CMD.OPEN_ACTOR})
  assert.ok(owner.held.has('expression:alpha'))
  const again = await CMD.enumerateWorks(owner.channel, () => {}, () => true)
  assert.equal(again.find(work => work.expression_ref === 'expression:alpha').open, true)
})

test('a live draft the owner already holds stands; a changed file, an owner refusal and an unreadable file each say why', async () => {
  const alpha = documentOf('expression:alpha', 'Alpha')
  const owner = stubOwner({files: {'alpha.expression.json': alpha, 'broken.expression.json': '{'}})
  const works = await CMD.enumerateWorks(owner.channel, () => {}, () => true)
  owner.held.set('expression:alpha', {...alpha, revision: 4, title: 'Alpha, edited'})
  await CMD.openListedWork(owner.channel, CMD.closedWork(works, 'expression:alpha'))
  assert.equal(owner.held.get('expression:alpha').revision, 4, 'the open draft is never replaced by its older file')

  const stale = {...CMD.closedWork(works, 'expression:alpha'), file_revision: 'file-r0'}
  await assert.rejects(CMD.openListedWork(owner.channel, stale), /Expression open: file revision conflict/)

  const refusing = stubOwner({override: {open_file: async () => { throw Error('This location is excluded by .no-agent-retrieval') }}})
  await assert.rejects(CMD.openListedWork(refusing.channel, CMD.closedWork(works, 'expression:alpha')), /excluded by \.no-agent-retrieval/)

  const before = owner.calls.length
  const broken = CMD.closedWork(works, at('Control/user/flows/broken.expression.json').ref)
  await assert.rejects(CMD.openListedWork(owner.channel, broken), /broken\.expression\.json could not be read from the works home: Expected value/)
  assert.equal(owner.calls.length, before, 'an unreadable file sends nothing')

  const other = stubOwner({override: {open_file: async () => ({state: 'ready', document: documentOf('expression:other', 'Other')})}})
  await assert.rejects(CMD.openListedWork(other.channel, CMD.closedWork(works, 'expression:alpha')), /did not open Alpha from its file/)
})

// ——— new and opened works are saved into the home ——————————————————————————————————————————————
test('New is create, then save_as into the home the owner disclosed, then the open door; after a restart the list holds it as a file', async () => {
  CMD.setExpressionOwner(null)
  const owner = stubOwner(), {ports: p, events, published} = ports(owner)
  const outcome = await CMD.newExpression(p, 'Untitled expression')
  const ref = 'expression:authored-00000001-0000-4000-8000-000000000000'
  assert.equal(outcome.ok, true, outcome.error)
  assert.deepEqual(events, ['create', 'list', 'save_as', 'open:' + ref, 'list'])
  const saveAs = owner.calls.find(call => call.operation === 'save_as')
  assert.deepEqual(saveAs.parent, HOME, 'the parent is the home the owner\'s list disclosed')
  assert.match(saveAs.name, /^untitled-expression-00000001\.expression\.json$/)
  assert.deepEqual([saveAs.expression_ref, saveAs.expected_revision, saveAs.actor, saveAs.actor_kind], [ref, 1, CMD.OPEN_ACTOR, 'human'])
  assert.deepEqual(outcome.saved, {path: 'Control/user/flows/' + saveAs.name, revision: 'file-r1'})
  assert.equal(published.at(-1)[0].expression_ref, ref)

  owner.held.clear() // the owner restarts: its memory is empty, its home file is not
  const after = await CMD.enumerateWorks(owner.channel, () => {}, () => true)
  assert.deepEqual(after.map(work => [work.expression_ref, work.open, work.location.path]), [[ref, false, 'Control/user/flows/' + saveAs.name]])
  CMD.setExpressionOwner(null)
})

test('a home the owner cannot list leaves a New work open and unsaved, with the owner\'s reason on the row', async () => {
  CMD.setExpressionOwner(null)
  const owner = stubOwner({home: false}), {ports: p, events} = ports(owner)
  const outcome = await CMD.newExpression(p, 'Untitled expression')
  assert.equal(outcome.ok, true)
  assert.equal(outcome.saved, null)
  assert.match(outcome.refused, /works home Control\/user\/flows is unavailable/)
  assert.ok(!events.includes('save_as'))
  assert.ok(events.some(event => event.startsWith('open:')))
})

// ——— code-reading: the wiring React effects hide ——————————————————————————————————————————————
test('code-reading: the panel\'s door opens a work listed only as a file through open_file before presenting it, and so does its boot', async () => {
  const panel = await read('panels/expressions.tsx')
  assert.match(panel, /import \{closedWork, expressionOwner, openListedWork\} from '\.\.\/components\/nativeExpressionCommands'/)
  const door = panel.slice(panel.indexOf('const openNative = (ref: string) => {'), panel.indexOf('openRequest.current = openNative'))
  assert.match(door, /const closed = closedWork\(workspaceRef\.current\.nativeWorks, ref\), channel = expressionOwner\(\)/)
  assert.match(door, /if \(!closed \|\| !channel\) \{presenting\.openExpression\(ref, 'world\.expressions'\); return\}/, 'an open work still opens by ref')
  assert.ok(door.indexOf('openListedWork(channel, closed)') < door.lastIndexOf('presenting.openExpression(ref'), 'open_file first, then the frame by ref')
  assert.match(door, /return enumerateWorks\(channel, works => workspaceRef\.current\.publishWorks\(works\), current\)/, 'the row then reads open')
  const boot = panel.slice(panel.indexOf('let initialRef: string | undefined = '), panel.indexOf('selectionOwner.current = {workspaceId: bookRef.current.current.id, expected: initialRef}'))
  assert.match(boot, /const firstClosed = initialRef \? closedWork\(existing, initialRef\) : null/)
  assert.match(boot, /try \{await openListedWork\(owner, firstClosed\); await enumerate\(\)\}/)
  assert.match(boot, /catch \(cause\) \{fail\(cause\); initialRef = undefined\}/, 'a refused file shows and the frame boots on no work')
  const collections = await read('components/NativeExpressionCollections.tsx')
  assert.match(collections, /parent: channel \? \(\) => worksHome\(channel\) : null/, 'Open and New save into the owner\'s works home')
  assert.doesNotMatch(collections + await read('components/nativeExpressionCommands.ts'), /WORKS_FOLDER|listFiles/, 'the home is named once, in the kernel')
})

test('code-reading: Technē\'s Sources and the browser\'s works rows reach the same door by ref', async () => {
  const modeBrowser = await read('shell/ModeBrowser.tsx'), worldBrowser = await read('components/WorldBrowser.tsx')
  assert.match(modeBrowser, /onClick=\{\(\) => workspace\.requestExpression\(work\.expression_ref\)\}/)
  assert.match(worldBrowser, /onClick=\{\(\) => openWork\(work\.expression_ref\)\}/)
})
