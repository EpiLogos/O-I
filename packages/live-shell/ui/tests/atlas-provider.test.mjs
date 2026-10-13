// The founding corpus provider (T-ATLAS-PROVIDER): Archetypal-Earth's published bundle read through Central's file owner,
// validated by the found loaders, published by name. Scripted over a fixture tree shaped like AE's public/data.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'

// The same in-memory TypeScript loader as the other atlas suites; `import.meta.env` (Vite's) is stood in for, as Node has none.
const root = new URL('../../../../', import.meta.url)
const compiler = new URL('desktop/cradle/node_modules/typescript/lib/typescript.js', root).href
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
  const source=(await readFile(new URL(url),'utf8')).replace(/import\\.meta\\.env/g,'({BASE_URL:"/"})');
  return {format:'module',shortCircuit:true,source:ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:new URL(url).pathname}).outputText};
}`)}`, import.meta.url);

const providerUrl = new URL('packages/live-shell/ui/src/projections/atlas/provider/archetypalEarthProvider.ts', root);
const {archetypalEarthProvider, adaptFoundingField, adaptFoundingCorpusIndex, ARCHETYPAL_EARTH_DATA} = await import(providerUrl);

const DATA = ARCHETYPAL_EARTH_DATA;
const transport = {kind: 'unavailable', reason: 'the test injects its own reader'};

// The founding bundle's shape at AE's pinned data: the vault descriptor, `jung` cites, `subject` words, the corpus index's vaultPath.
const field = () => ({
  meta: {
    generatedAt: '2026-10-13T00:46:34.423Z',
    vaultPath: '/vault/jung-archetypal-field',
    vaultLedgerLine: '2026-10-10 — LEDGER LINE',
    counts: {archetypes: 1, theoretics: 0, families: 1, occurrences: 2, cultures: 0, images: 0},
    yearMin: 1698,
    yearMax: 1844,
  },
  archetypes: [{id: 'wayfinding', name: 'Wayfinding', oneLine: 'A course held.', prime: false, spectrum: {position: 0.8}, palette: {core: '#fff', glow: '#eee', fog: '#111', deep: '#000'}, body: [], familyIds: ['lighthouse'], occurrenceCount: 2, archetypes: []}],
  theoretics: [],
  families: [{id: 'lighthouse', name: 'Lighthouse', subtype: 'object', aliases: [], oneLine: '', archetypes: [{id: 'wayfinding', basis: 'jung'}], spectrum: {position: 0.5}, palette: {core: '#fff', glow: '#eee', fog: '#111', deep: '#000'}, body: [], occurrenceIds: ['eddystone', 'bell'], synthesised: false}],
  occurrences: [
    {id: 'eddystone', title: 'Eddystone', label: 'Eddystone', familyId: 'lighthouse', coFamilyIds: [], locusType: 'artifact', subject: 'jung', cultureIds: [], place: 'Channel', lat: 50.18, lon: -4.27, geoPrecision: 'place', year: 1698, yearDisplay: '1698', jung: [{work: 'cw12', workTitle: 'Psychology and Alchemy', year: '1936/44', locator: '¶357 (pdf p268)'}], body: [], parallelIds: ['bell']},
    {id: 'bell', title: 'Bell Rock', label: 'Bell Rock', familyId: 'lighthouse', coFamilyIds: [], locusType: 'artifact', subject: 'n/a', cultureIds: [], place: 'North Sea', lat: 56.3, lon: -2.38, geoPrecision: 'place', year: 1814, yearDisplay: '1814', jung: [], body: [], parallelIds: ['eddystone']},
  ],
  cultures: [],
  joins: [],
});
const corpusIndex = () => ({generatedAt: '2026-10-13T00:46:45.701Z', vaultPath: '/vault/jung-archetypal-field', works: [{work: 'cw12', title: 'Psychology and Alchemy', file: 'cw12.json', pages: 1, paras: 1, chapters: 0}]});
const volume = () => ({work: 'cw12', title: 'Psychology and Alchemy', chapters: [], pages: [{p: 268, text: 'a passage ¶357'}], paras: [{para: 357, p: 268, off: 0, len: 9}]});
const history = () => ({readings: [{id: 'r1', from: 1000, to: 2000, epochs: [], events: [], threads: []}]});
const symbols = () => ({source: {title: 'Symbols of the field'}, entries: []});

const complete = () => ({
  'field.json': JSON.stringify(field()),
  'history.json': JSON.stringify(history()),
  'symbols.json': JSON.stringify(symbols()),
  'theory.json': JSON.stringify({sections: ['alpha']}),
  'corpus/index.json': JSON.stringify(corpusIndex()),
  'corpus/cw12.json': JSON.stringify(volume()),
});

// A reader over a fixture tree: a folder listing returns its files with their own locations, and a folder that does not exist fails.
function fakeReader(files, log = []) {
  const folders = new Set(['']);
  for (const key of Object.keys(files)) { const slash = key.lastIndexOf('/'); if (slash >= 0) folders.add(key.slice(0, slash)); }
  const relative = path => (path === DATA ? '' : path.startsWith(`${DATA}/`) ? path.slice(DATA.length + 1) : null);
  return {
    async list(path) {
      log.push(`list ${path}`);
      const folder = relative(path);
      if (folder === null || !folders.has(folder)) throw new Error(`no such folder: ${path}`);
      const entries = Object.keys(files)
        .filter(key => (key.includes('/') ? key.slice(0, key.lastIndexOf('/')) : '') === folder)
        .map(key => ({name: key.slice(key.lastIndexOf('/') + 1), kind: 'file', byte_len: files[key].length, retrieval_allowed: true, location: {schema: 'central.path-ref/v1', ref: `ref:${DATA}/${key}`, root: 'Work', path: `${DATA}/${key}`}}));
      return {schema: 'central.directory-reading/v1', location: {schema: 'central.path-ref/v1', ref: `ref:${path}`, root: 'Work', path}, entries, automatic_agent_or_model_invocation: false};
    },
    async read(location) {
      log.push(`read ${location.path}`);
      const key = location.path.slice(DATA.length + 1);
      if (!(key in files)) throw new Error(`no such file: ${location.path}`);
      return {schema: 'central.file-reading/v1', location, revision: 'r1', byte_len: files[key].length, content_encoding: 'utf-8', content: files[key], project: null, source: null, automatic_agent_or_model_invocation: false};
    },
  };
}

test('adaptFoundingField names the provider by data and renames the cites', () => {
  const raw = field();
  const out = adaptFoundingField(raw);
  assert.deepEqual(out.meta.provider, {id: 'archetypal-earth', name: 'Jung archetypal field', home: '/vault/jung-archetypal-field'});
  assert.equal(out.meta.freshness, '2026-10-10 — LEDGER LINE');
  assert.deepEqual(out.meta.ties.bases, [{id: 'jung', label: 'Jung'}, {id: 'inferred', label: 'Inferred'}, {id: 'site', label: 'Read here'}]);
  assert.equal('vaultPath' in out.meta, false);
  assert.equal('vaultLedgerLine' in out.meta, false);
  assert.deepEqual(out.meta.counts, raw.meta.counts, 'counts travel verbatim');
  assert.deepEqual(out.occurrences[0].cites, raw.occurrences[0].jung, 'jung becomes cites');
  assert.deepEqual(out.occurrences[1].cites, [], 'no jung means no cites, never undefined');
  for (const occurrence of out.occurrences) {
    assert.equal('jung' in occurrence, false);
    assert.equal('subject' in occurrence, false, 'the vault subject word is dropped (C2 §1.3)');
  }
  assert.deepEqual(out.families, raw.families, 'every other tier is verbatim');
  assert.deepEqual(out.joins, raw.joins);
});

test('adaptFoundingCorpusIndex names the provider by data, and refuses an index with no works', () => {
  const out = adaptFoundingCorpusIndex(corpusIndex());
  assert.deepEqual(out.provider, {id: 'archetypal-earth', name: 'Jung archetypal field', home: '/vault/jung-archetypal-field'});
  assert.equal('vaultPath' in out, false);
  assert.equal(out.works.length, 1);
  assert.throws(() => adaptFoundingCorpusIndex({generatedAt: 'x'}), /lists no works/);
});

test('load validates the founding bundle through the found loaders, reading only listed locations', async () => {
  const log = [];
  const provider = archetypalEarthProvider(transport, DATA, fakeReader(complete(), log));
  assert.equal(provider.id, 'archetypal-earth');
  assert.equal(provider.name, 'Jung archetypal field');
  const bundle = await provider.load();
  assert.equal(bundle.id, 'archetypal-earth');
  assert.equal(bundle.field.occurrences.length, 2, 'loadField accepted the bundle');
  assert.equal(bundle.field.meta.provider.name, 'Jung archetypal field');
  assert.equal(bundle.history.readings.length, 1, 'loadHistory accepted the readings');
  assert.equal(bundle.symbols.source.title, 'Symbols of the field', 'loadSymbols accepted the symbols');
  assert.equal(bundle.corpus.provider.id, 'archetypal-earth');
  assert.deepEqual(bundle.images, {}, 'images ride the field inline; none are resolved here (T-ATLAS-IMAGES)');
  assert.equal(typeof bundle.published, 'function');
  assert.ok(log.length > 0 && log.every(line => line.includes(DATA)), `reads stay in the bundle: ${log.join(' | ')}`);
});

test('a bundle with no field.json, or a field with no occurrences, is unavailable, never invented', async () => {
  const noField = complete();
  delete noField['field.json'];
  await assert.rejects(archetypalEarthProvider(transport, DATA, fakeReader(noField)).load(), /^Error: The atlas data is unavailable\./);
  const empty = complete();
  empty['field.json'] = JSON.stringify({...field(), occurrences: []});
  await assert.rejects(archetypalEarthProvider(transport, DATA, fakeReader(empty)).load(), /The atlas data is unavailable\./);
});

test('absent optional material is undefined, never invented, and the load still succeeds', async () => {
  const bare = {'field.json': JSON.stringify(field())};
  const bundle = await archetypalEarthProvider(transport, DATA, fakeReader(bare)).load();
  assert.equal(bundle.history, undefined);
  assert.equal(bundle.symbols, undefined);
  assert.equal(bundle.corpus, undefined, 'no corpus index: no cite is a link');
  assert.equal(bundle.field.occurrences.length, 2);
});

test('published resolves present names, and nulls absent, withheld or climbing names', async () => {
  const files = complete();
  const provider = archetypalEarthProvider(transport, DATA, fakeReader(files));
  const bundle = await provider.load();
  const theory = await bundle.published('theory');
  assert.equal(theory.status, 200);
  assert.equal(theory.headers.get('content-type'), 'application/json');
  assert.deepEqual(await theory.json(), {sections: ['alpha']});
  const volumeResponse = await bundle.published('corpus/cw12');
  assert.equal(volumeResponse.status, 200, 'a corpus volume is published one folder down');
  assert.equal((await volumeResponse.json()).work, 'cw12');
  assert.equal(await bundle.published('redbook'), null, 'a name the bundle lacks is absent');
  assert.equal(await bundle.published('corpus/cw99'), null);
  assert.equal(await bundle.published('../field'), null, 'a name that climbs out of the bundle is refused');
  assert.equal(await bundle.published('corpus/../field'), null);
  const withheld = complete();
  const reader = fakeReader(withheld);
  const realList = reader.list;
  reader.list = async path => {
    const directory = await realList(path);
    return {...directory, entries: directory.entries.map(entry => (entry.name === 'theory.json' ? {...entry, retrieval_allowed: false} : entry))};
  };
  assert.equal(await (await archetypalEarthProvider(transport, DATA, reader).load()).published('theory'), null, 'withheld retrieval reads as absent');
});

test('the provider source reads no public/data and fetches nothing itself', async () => {
  const code = (await readFile(providerUrl, 'utf8')).split('\n').filter(line => !/^\s*(\/\/|\/\*|\*)/.test(line)).join('\n');
  assert.equal(/fetch\(/.test(code), false, 'the provider does not fetch; the found loaders take a blob URL');
  assert.equal(/['"`]\/?data\//.test(code), false, 'no /data/ URL is built; the bundle is named only by its Central folder');
  assert.equal(/public\/data/.test(code.replace(/Work\/Archetypal-Earth\/public\/data/g, '')), false, 'the bundle path is named once, as the Central folder');
});
