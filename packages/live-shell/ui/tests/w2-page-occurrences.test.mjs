import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

// W2 (T-WORLDS §4 "Beings and Things in reading, walks and sky"): each page projects one occurrence into the Earth's field through
// the one admission path, as the QL family places the Sun. Channels: PURE — page readings as the page owner gives them (kernel/src/
// page.rs read), a field of the atlas contract. NOT a screen pass.
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

const pages = await import('../src/central/pageOccurrences.ts')
const {checkOccurrence} = await import('../src/projections/occurrence.ts')

const loc = path => ({schema: 'central.path-ref/v1', ref: `central:path:/ground:${path}`, root: '/ground', path})
const reading = (path, form, island, revision = 'rev-1') => ({schema: 'oi.page-reading/v1', location: loc(path), revision, form, title: island.meta?.title ?? null, island})
const HILDEGARD = reading('Control/user/flows/beings-2026-10-18-0930.html', 'being', {
  meta: {title: 'Hildegard of Bingen', created: '2026-10-18T09:30:00Z'},
  page: {subtitle: 'Visions and music', introduction: 'She wrote what she saw.', sections: [{id: 'section-1', heading: 'Music', text: 'Wide leaps.'}]},
  bindings: {anchor: {lat: 49.97, lon: 7.9}, sources: [{ref: 'central:path:/ground:Work/books/scivias.md', revision: 'src-3'}, {ref: '', revision: 'x'}]},
  notes: [{id: 'n1', text: 'a private reading note'}]})
const STONE = reading('Work/O-I/ProjectCentral/user/things-2026-10-19-1000.html', 'thing', {meta: {title: ''}, page: {introduction: ''}, bindings: {}})
const FIELD = {families: [{id: 'serpent', name: 'Serpent', subtype: 'figure', aliases: [], oneLine: '', archetypes: [], spectrum: {position: 0.5},
  palette: {core: '#fff', glow: '#fff', fog: '#000', deep: '#000'}, body: [], occurrenceIds: ['o1'], synthesised: false}],
  occurrences: [{id: 'o1', title: 'One', label: 'One', familyId: 'serpent', coFamilyIds: [], locusType: 'dream', cultureIds: [], place: '', lat: 0, lon: 0,
    geoPrecision: 'none', year: 1930, yearDisplay: '1930', cites: [], body: [], parallelIds: []}],
  meta: {counts: {archetypes: 0, theoretics: 0, families: 1, occurrences: 1, cultures: 0, images: 0}, yearMax: 2026}}

test('a Being is one occurrence: a figure, an artifact at its anchor, dated by its making, its opening and sections its body, its sources its cites', () => {
  const made = pages.pageOccurrence(HILDEGARD, 2026)
  assert.equal(made.ok, true)
  const item = made.value
  assert.deepEqual([item.id, item.subject_ref, item.familyId, item.locusType], [`page:${HILDEGARD.location.ref}`, HILDEGARD.location.ref, 'oi-page-being', 'artifact'])
  assert.deepEqual([item.lat, item.lon, item.geoPrecision, item.year, item.yearDisplay, item.dated], [49.97, 7.9, 'place', 2026, '2026-10-18', undefined])
  assert.deepEqual(item.body, ['Visions and music', 'She wrote what she saw.', 'Music', 'Wide leaps.'], 'the notes are the reader\'s and stay out')
  assert.deepEqual(item.cites, [{work: 'central:path:/ground:Work/books/scivias.md', workTitle: 'scivias.md', year: '', locator: 'at src-3'}], 'a source without its ref is not cited')
  assert.deepEqual(item.basis, {ref: HILDEGARD.location.ref, revision: 'rev-1'})
  assert.equal(checkOccurrence(item).ok, true)
})

test('a page with no anchor stands unplaced, one with no making date is undated, one with no title is named by its file', () => {
  const item = pages.pageOccurrence(STONE, 2026).value
  assert.deepEqual([item.lat, item.lon, item.geoPrecision, item.place], [0, 0, 'none', ''])
  assert.deepEqual([item.dated, item.year, item.yearDisplay], [false, 2026, 'undated'])
  assert.deepEqual([item.title, item.familyId, item.body], ['things-2026-10-19-1000', 'oi-page-thing', []])
  const flow = pages.pageOccurrence(reading('Control/user/flows/flow-1.html', 'flow', {meta: {}}), 2026)
  assert.match(flow.reason, /is a flow, not a Being or a Thing/)
})

test('pages are admitted through the one path: their families declared, the field\'s own kept, a re-read page replaced, never doubled', () => {
  const first = pages.admitPages(FIELD, [HILDEGARD, STONE])
  assert.equal(first.admitted.length, 2); assert.deepEqual(first.refused, [])
  assert.deepEqual(first.field.families.map(entry => entry.id), ['serpent', 'oi-page-being', 'oi-page-thing'])
  assert.deepEqual(first.field.families[1].palette, pages.PAGE_FAMILIES.being.palette, 'coloured by its own ref, never invented')
  assert.equal(first.field.meta.counts.occurrences, 3)
  const again = pages.admitPages(first.field, [{...HILDEGARD, revision: 'rev-2'}])
  assert.equal(again.field.occurrences.length, 2, 'the Thing not read again leaves; Hildegard is one occurrence')
  assert.equal(again.field.occurrences.find(item => item.subject_ref === HILDEGARD.location.ref).basis.revision, 'rev-2')
  assert.deepEqual(again.field.families.find(entry => entry.id === 'oi-page-thing').occurrenceIds, [])
  assert.equal(pages.withoutPages(FIELD), FIELD, 'a field with no pages is the same field')
  const refused = pages.admitPages(FIELD, [reading('Control/user/flows/flow-1.html', 'flow', {meta: {}})])
  assert.match(refused.refused[0].reason, /not a Being or a Thing/)
})

test('the Earth reads every world\'s Beings and Things through the page owner; a world or page that does not answer is named', async () => {
  const root = {control: {agent_wiki: {wiki: {space_ref: 'central:wiki:root'}}}, work: {projects: [{name: 'O-I', path: 'Work/O-I',
    projectcentral: {user: {exists: true, path: 'Work/O-I/ProjectCentral/user'}, agent_wiki: {wiki: {space_ref: 'central:wiki:project:O-I'}}}}]}}
  const answer = outcome => ({json: async () => ({ok: true, outcome})})
  const listed = {schema: 'oi.page-list/v1', path: 'Control/user/flows', more: false, not_pages: [], pages: [
    {location: loc('Control/user/flows/beings-1.html'), name: 'beings-1.html', form: 'being', title: 'A', revision: 'r', world: 'central:wiki:root'},
    {location: loc('Control/user/flows/flow-1.html'), name: 'flow-1.html', form: 'flow', title: 'F', revision: 'r', world: 'central:wiki:root'},
    {location: loc('Control/user/flows/things-1.html'), name: 'things-1.html', form: 'thing', title: 'T', revision: 'r', world: 'central:wiki:root'}]}
  const asked = []
  const real = globalThis.fetch
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(init.body)
    if (body.op === 'world_browse') return answer({result: 'world_read', snapshot: {navigator: {root}}})
    if (body.op === 'page' && body.request.operation === 'list') {
      if (body.request.path.startsWith('Work/O-I')) return {json: async () => ({ok: false, error: 'the project ground is not readable'})}
      return answer({result: 'page_reading', data: listed})
    }
    if (body.op === 'page' && body.request.operation === 'read') {
      asked.push(body.request.location.path)
      if (body.request.location.path.endsWith('things-1.html')) return {json: async () => ({ok: false, error: 'the page moved'})}
      return answer({result: 'page_reading', data: HILDEGARD})
    }
    return {json: async () => ({ok: false, error: `unexpected ${body.op}`})}
  }
  try {
    const {readings, unread} = await pages.readWorldPagesForEarth({kind: 'bridge', url: 'http://central.fixture'})
    assert.deepEqual(asked, ['Control/user/flows/beings-1.html', 'Control/user/flows/things-1.html'], 'only Beings and Things are read; a Flow is no occurrence')
    assert.equal(readings.length, 1)
    assert.equal(unread.length, 2)
    assert.match(unread[0], /things-1\.html: .*the page moved/)
    assert.match(unread[1], /^O-I: .*the project ground is not readable/)
  } finally { globalThis.fetch = real }
})

test('your pages come to the Earth after it stands: each page\'s occurrence with its family, what was not read said', async () => {
  const root = {control: {agent_wiki: {wiki: {space_ref: 'central:wiki:root'}}}, work: {projects: []}}
  const answer = outcome => ({json: async () => ({ok: true, outcome})})
  const listing = {schema: 'oi.page-list/v1', path: 'Control/user/flows', more: false, not_pages: [], pages: [
    {location: HILDEGARD.location, name: 'beings-2026-10-18-0930.html', form: 'being', title: 'H', revision: 'r', world: 'central:wiki:root'},
    {location: loc('Control/user/flows/things-9.html'), name: 'things-9.html', form: 'thing', title: 'T', revision: 'r', world: 'central:wiki:root'}]}
  const real = globalThis.fetch
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(init.body)
    if (body.op === 'world_browse') return answer({result: 'world_read', snapshot: {navigator: {root}}})
    if (body.op === 'page' && body.request.operation === 'list') return answer({result: 'page_reading', data: listing})
    if (body.op === 'page' && body.request.operation === 'read' && body.request.location.path === HILDEGARD.location.path) return answer({result: 'page_reading', data: HILDEGARD})
    return {json: async () => ({ok: false, error: 'the page is gone'})}
  }
  try {
    const said = []
    const pagesOnEarth = await pages.yourPagesForEarth({kind: 'bridge', url: 'http://central.fixture'}, 2026, text => said.push(text))
    assert.deepEqual(pagesOnEarth.map(item => [item.occurrence.subject_ref, item.family.id]), [[HILDEGARD.location.ref, 'oi-page-being']])
    assert.equal(said.length, 1); assert.match(said[0], /^Not on the Earth: Control\/user\/flows\/things-9\.html: .*the page is gone\.$/)
  } finally { globalThis.fetch = real }
})

test('pages join the Earth through the seam behind the Sun: the Sun steps off the tail and is put back last; a refusal says what joined', () => {
  // A stand-in for the mounted Earth that keeps the seam's own rule: only the last occurrence may be taken away.
  const earth = (occ, refuse = null) => ({model: {occ}, calls: [], replaceOccurrence(item, id) {
    this.calls.push([item ? 'put' : 'take', id])
    if (item === null) { if (occ.at(-1)?.id !== id) throw new Error(`${id} is not last`); occ.pop(); return }
    if (refuse === id) throw new Error(`${id} is placed at a recorded place`)
    const at = occ.findIndex(entry => entry.id === id); if (at >= 0) occ[at] = item; else occ.push(item)
  }})
  const sun = {id: 'sky-subsolar'}, one = {id: 'o1'}
  const page = id => ({occurrence: {id}, family: pages.PAGE_FAMILIES.being})
  const withSun = earth([one, sun])
  assert.equal(pages.joinPagesToEarth(withSun, [page('page:a'), page('page:b')], 'sky-subsolar', () => {}), 2)
  assert.deepEqual(withSun.model.occ.map(entry => entry.id), ['o1', 'page:a', 'page:b', 'sky-subsolar'], 'the Sun stays last, so it can still leave')
  const noSun = earth([one])
  pages.joinPagesToEarth(noSun, [page('page:a')], 'sky-subsolar', () => {})
  assert.deepEqual(noSun.model.occ.map(entry => entry.id), ['o1', 'page:a'], 'with no Sun drawn the pages simply join')
  const said = []
  const refusing = earth([one, sun], 'page:b')
  assert.equal(pages.joinPagesToEarth(refusing, [page('page:a'), page('page:b'), page('page:c')], 'sky-subsolar', text => said.push(text)), 1)
  assert.deepEqual(refusing.model.occ.map(entry => entry.id), ['o1', 'page:a', 'sky-subsolar'], 'the Sun is put back even when a page is refused')
  assert.match(said[0], /^1 of your 3 pages joined the Earth; the next was refused: page:b is placed at a recorded place\.$/)
  assert.equal(pages.joinPagesToEarth(earth([sun]), [], 'sky-subsolar', () => {}), 0)
})
