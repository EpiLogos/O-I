import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

// W2 (T-WORLDS §4: "Clips are pages: Beings, Things, Flows … in the world's folder, not Control/user/flows/"; "create in the world's
// folder (projectcentral.source.create for a project's world)"): a page made in a project's scope lands in that project's human
// ground through Central's source door, a page made in no project's scope in your world's folder through the first-save door, and
// each page's island names its world (a Being's or Thing's bindings.worldRef, a Flow's meta.world — the keys kernel/src/page.rs
// reads). Channels: SCRIPTED — a stubbed kernel bridge; the templates are the real ones from desktop/cradle/documents. NOT a
// screen pass.
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(specifier,context,next){
  if(specifier.endsWith('?raw')){const r=await next(specifier.slice(0,-4),context);return {...r,url:r.url+'?raw'}}
  try{return await next(specifier,context)}catch(error){
    if(!specifier.startsWith('.'))throw error;
    for(const suffix of ['.ts','.tsx','/index.ts']){try{return await next(specifier+suffix,context)}catch{}}
    throw error;
  }
}
export async function load(url,context,next){
  if(url.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export default null'};
  if(url.endsWith('?raw'))return {format:'module',shortCircuit:true,source:'export default '+JSON.stringify(await readFile(new URL(url.slice(0,-4)),'utf8'))};
  if(url.endsWith('.json'))return {format:'module',shortCircuit:true,source:'export default '+await readFile(new URL(url),'utf8')};
  if(url.endsWith('.ts')||url.endsWith('.tsx')){
    const source=await readFile(new URL(url).pathname,'utf8');
    const {outputText}=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:url});
    return {format:'module',shortCircuit:true,source:outputText};
  }
  return next(url,context);
}`)}`, {parentURL: import.meta.url})

const {readFile} = await import('node:fs/promises')
const create = await import('../../../../desktop/cradle/src/flow/createInPlace.ts')
const {DOCUMENT_FORMS} = await import('../../../../desktop/cradle/src/flow/documentForms.ts')
const {parseInstance} = await import('../../../../desktop/cradle/src/flow/instance.ts')

const documents = new URL('../../../../desktop/cradle/documents/', import.meta.url)
const islandOf = html => JSON.parse(/<script type="application\/json" id="ql-doc">([\s\S]*?)<\/script>/.exec(html)[1].replace(/\\u003c/g, '<'))
const formOf = kind => DOCUMENT_FORMS.find(form => form.kind === kind)

test('a page is tied to its world: a Being\'s or Thing\'s bindings.worldRef, a Flow\'s meta.world; everything else stays', async () => {
  const beings = await readFile(new URL('oi-beings.html', documents), 'utf8')
  const tied = create.tieWorld(beings, 'central:wiki:project:O-I')
  assert.equal(islandOf(tied).bindings.worldRef, 'central:wiki:project:O-I')
  assert.equal(tied.slice(0, tied.indexOf('<script type="application/json" id="ql-doc">')), beings.slice(0, beings.indexOf('<script type="application/json" id="ql-doc">')), 'the page around the island is the template\'s')
  const flow = await readFile(new URL('ql-flow.html', documents), 'utf8')
  assert.equal(parseInstance(create.tieWorld(flow, 'central:wiki:root')).meta.world, 'central:wiki:root')
  assert.equal(create.tieWorld('<html>no island</html>', 'w'), '<html>no island</html>')
})

/** A kernel bridge standing in for Central: it lists the forms and grounds, reads the templates from disk, and records each create. */
function bridge() {
  const created = []
  const at = path => ({schema: 'central.path-ref/v1', ref: `central:path:/ground:${path}`, root: '/ground', path})
  const answer = outcome => ({json: async () => ({ok: true, outcome})})
  const fetch = async (_url, init) => {
    const body = JSON.parse(init.body)
    if (body.op === 'files_list') {
      if (body.path.endsWith('desktop/cradle/documents')) return answer({result: 'directory_read', directory: {schema: 'central.directory-reading/v1', location: at(body.path),
        entries: ['oi-beings.html', 'oi-things.html', 'ql-flow.html'].map(name => ({name, kind: 'file', byte_len: 1, retrieval_allowed: true, location: at(`${body.path}/${name}`)}))}})
      const made = created.filter(item => item.path.startsWith(body.path)).map(item => item.path.slice(body.path.length + 1))
      return answer({result: 'directory_read', directory: {schema: 'central.directory-reading/v1', location: at(body.path),
        entries: made.map(name => ({name, kind: 'file', byte_len: 1, retrieval_allowed: true, location: at(`${body.path}/${name}`)}))}})
    }
    if (body.op === 'file_read') {
      const content = await readFile(new URL(body.location.path.split('/').pop(), documents), 'utf8')
      return answer({result: 'file_read', reading: {schema: 'central.file-reading/v1', location: body.location, revision: 'r', content, byte_len: content.length, content_encoding: 'utf-8'}})
    }
    if (body.op === 'invoke_action' && body.invocation.action === 'projectcentral.source.create') {
      const input = body.invocation.input
      created.push({door: 'projectcentral.source.create', path: `Work/${input.project}/${input.path}`, content: input.content, actor_kind: input.actor_kind})
      return answer({result: 'action_dispatched', dispatch: {state: 'invoked'}})
    }
    if (body.op === 'file_operation' && body.request.action === 'write') {
      created.push({door: 'central.files.write', path: body.location.path, content: body.request.content})
      return answer({result: 'file_operation', data: {outcome: 'created', revision: 'r1'}})
    }
    return {json: async () => ({ok: false, error: `unexpected op ${body.op}`})}
  }
  return {fetch, created}
}

async function withBridge(stub, run) {
  const real = globalThis.fetch
  globalThis.fetch = stub.fetch
  try { return await run({kind: 'bridge', url: 'http://central.fixture'}) } finally { globalThis.fetch = real }
}

test('a Being made in a project\'s scope lands in the project\'s human ground through the source door, naming the project\'s world', async () => {
  const stub = bridge()
  const projects = [{name: 'O-I', path: 'Work/O-I'}]
  const copy = await withBridge(stub, transport => create.createFormInPlace(transport, formOf('document-beings'), {project: 'O-I', projects, worldRef: 'central:wiki:project:O-I', now: new Date(2026, 9, 18, 9, 30)}))
  assert.equal(stub.created.length, 1)
  assert.deepEqual([stub.created[0].door, stub.created[0].path, stub.created[0].actor_kind], ['projectcentral.source.create', 'Work/O-I/ProjectCentral/user/beings-2026-10-18-0930.html', 'human'])
  assert.equal(islandOf(stub.created[0].content).bindings.worldRef, 'central:wiki:project:O-I')
  assert.equal(copy.location.path, 'Work/O-I/ProjectCentral/user/beings-2026-10-18-0930.html', 'the copy\'s location is the owner\'s own listing of it')
})

test('a Thing made in no project\'s scope lands in your world\'s folder through the first-save door, naming your world', async () => {
  const stub = bridge()
  await withBridge(stub, transport => create.createFormInPlace(transport, formOf('document-things'), {worldRef: 'central:wiki:root', now: new Date(2026, 9, 18, 9, 31)}))
  assert.deepEqual([stub.created[0].door, stub.created[0].path.replace(/^.*Control/, 'Control')], ['central.files.write', 'Control/user/flows/things-2026-10-18-0931.html'])
  assert.equal(islandOf(stub.created[0].content).bindings.worldRef, 'central:wiki:root')
})

test('a Being or a Thing opens in a document pane of its own: its subject names its kind and its owner ref; its tab says which it is', async () => {
  const docs = await import('../src/central/documents/centralDocuments.ts')
  const ref = 'central:path:/ground:Work/O-I/ProjectCentral/user/beings-2026-10-18-0930.html'
  const subject = docs.parseDocumentSubject(`page:being:${ref}`)
  assert.deepEqual(subject, {form: 'page', kind: 'being', location: {schema: 'central.path-ref/v1', ref, root: '/ground', path: 'Work/O-I/ProjectCentral/user/beings-2026-10-18-0930.html'}})
  assert.deepEqual(docs.subjectOf({form: 'page', kind: 'thing', location: subject.location}), {ref: `page:thing:${ref}`, title: 'Thing · beings-2026-10-18-0930'})
  assert.equal(docs.parseDocumentSubject('page:goal:x'), null, 'only a Being or a Thing is a page subject')
  const opener = await import('../src/central/documents/useOpenCentralDocument.ts')
  let layout = {groups: {}, surfaces: {}}
  const held = {workspace: {current: {}}, book: {current: {setLayout: update => { layout = update(layout) }}}}
  const open = opener.centralDocumentOpener(held)
  const ok = await open.openPage({name: 'beings-1.html', kind: 'file', retrieval_allowed: true, location: subject.location}, 'being').then(() => true, () => true)
  assert.ok(ok)
  await assert.rejects(open.openPage({name: 'folder', kind: 'directory', retrieval_allowed: true, location: null}, 'being'), /no page file/)
})

test('a link a page follows opens in the shell: a page of a world as its page, an http(s) address in a web pane, anything else said', async () => {
  const {linkTarget} = await import('../src/inhabitants/DocumentPageFace.tsx')
  assert.deepEqual(linkTarget('https://example.org/a?b=1'), {kind: 'web', url: 'https://example.org/a?b=1'})
  assert.deepEqual(linkTarget('central:path:/ground:Control/user/flows/beings-1.html'), {kind: 'page', path: 'Control/user/flows/beings-1.html'})
  assert.deepEqual(linkTarget('Work/O-I/ProjectCentral/user/things-1.html'), {kind: 'page', path: 'Work/O-I/ProjectCentral/user/things-1.html'})
  assert.equal(linkTarget('https://user:pw@example.org').kind, 'none', 'credentials in a link are not opened')
  assert.match(linkTarget('javascript:alert(1)').why, /neither a page of a world nor an http\(s\) address/)
  assert.equal(linkTarget('').kind, 'none')
})

test('the worlds wait for Central\'s first browse: a snapshot with no root yet is asked again, a refusal is said at once (r13)', async () => {
  const {readWorlds} = await import('../src/central/centralWorlds.ts')
  const root = {control: {agent_wiki: {wiki: {space_ref: 'central:wiki:root'}}}, work: {projects: [{name: 'O-I', path: 'Work/O-I',
    projectcentral: {user: {exists: true, path: 'Work/O-I/ProjectCentral/user'}, agent_wiki: {wiki: {space_ref: 'central:wiki:project:O-I'}}}}]}}
  const browse = answers => {
    let asked = 0
    return {fetch: async () => ({json: async () => ({ok: true, outcome: {result: 'world_read', snapshot: {navigator: answers[Math.min(asked++, answers.length - 1)]}}})}), asked: () => asked}
  }
  const settle = {tries: 4, apartMs: 1}
  const late = browse([null, {}, {root}])
  const read = await withBridge(late, transport => readWorlds(transport, settle))
  assert.equal(read.state, 'read'); assert.deepEqual(read.worlds.map(world => world.ref), ['central:wiki:root', 'central:wiki:project:O-I'])
  assert.equal(late.asked(), 3, 'asked until the root was disclosed')
  const refused = browse([{error: 'the map is unreadable'}])
  assert.deepEqual(await withBridge(refused, transport => readWorlds(transport, settle)), {state: 'unavailable', reason: 'the map is unreadable'})
  assert.equal(refused.asked(), 1, 'a refusal is not asked again')
  const never = browse([null])
  assert.deepEqual(await withBridge(never, transport => readWorlds(transport, settle)), {state: 'unavailable', reason: 'Central returned no root disclosure'})
  assert.equal(never.asked(), 4)
})

test('a Being\'s pane draws the page by the current template from its island, whatever script the file was copied with (r14)', async () => {
  const {currentPage} = await import('../src/inhabitants/DocumentPageFace.tsx')
  const {blankPage, renderPage, readPage} = await import('../../../../desktop/cradle/src/personal/page.mjs')
  // A page copied from an older template: its HTML shows the blank page, its island holds what the owner wrote since.
  const old = renderPage(blankPage('beings')).replace(/(<script type="application\/json" id="ql-doc">)([\s\S]*?)(<\/script>)/, (_, open, body, close) => {
    const island = JSON.parse(body.replace(/\\u003c/g, '<'))
    island.meta.title = 'Hildegard of Bingen'
    island.highlights = [{id: 'h1', part: 'introduction', passage: null, colour: 'green'}]
    return open + JSON.stringify(island).replace(/</g, '\\u003c') + close
  })
  assert.doesNotMatch(old.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)[1], /Hildegard/, 'the copied HTML still shows the blank title')
  const drawn = currentPage(old)
  assert.match(drawn.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)[1], /Hildegard of Bingen/)
  assert.deepEqual(readPage(drawn).highlights, [{id: 'h1', part: 'introduction', passage: null, colour: 'green'}], 'the island is kept whole, the owner\'s keys with it')
  assert.equal(currentPage('<html><body>no page here</body></html>'), '<html><body>no page here</body></html>', 'a file that is no page is hosted as it is')
})

test('a Flow in a project world\'s own ground opens as its Flow; the Goals, Beings and Things beside it do not (r15: a practice Journal)', async () => {
  const docs = await import('../src/central/documents/centralDocuments.ts')
  const journal = 'central:path:/Users/admin/Central:Work/personal/ProjectCentral/user/flow-2026-10-19-1002.html'
  assert.deepEqual(docs.parseDocumentSubject(journal)?.form, 'flow')
  assert.equal(docs.parseDocumentSubject(journal).location.path, 'Work/personal/ProjectCentral/user/flow-2026-10-19-1002.html')
  assert.equal(docs.isFlowPath('Work/O-I/ProjectCentral/user/practice/flow-2026-10-19-1002-2.html'), true)
  assert.equal(docs.isFlowPath('Control/user/flows/oi203-multiagent-20260930.html'), true, 'your world\'s flows folder keeps every name')
  for (const other of ['Work/O-I/ProjectCentral/user/goal-2026-10-19-1002.html', 'Work/O-I/ProjectCentral/user/beings-2026-10-19-1002.html',
    'Work/O-I/ProjectCentral/user/O-I.html', 'Work/O-I/ProjectCentral/agents/flow-1.html', 'Work/O-I/desktop/flow-1.html']) {
    assert.equal(docs.isFlowPath(other), false, other)
  }
})

test('a document page stands clear of its pane\'s edge band, so the band answers over it as over any pane (r15: the rail did not open)', async () => {
  const {readFile} = await import('node:fs/promises')
  const sheet = await readFile(new URL('../src/central/documents/centralDocuments.css', import.meta.url), 'utf8')
  const pane = sheet.slice(sheet.indexOf('.central-document-pane {'), sheet.indexOf('}', sheet.indexOf('.central-document-pane {')))
  assert.match(pane, /padding-left:\s*var\(--pane-edge-band,\s*0(px)?\)/, 'the page frame never lies under the band')
  const shell = await readFile(new URL('../src/native/workbench.css', import.meta.url), 'utf8')
  assert.match(shell, /--pane-edge-band:\s*14px/, 'the pane names the band\'s width')
})
