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
