import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {readFileSync} from 'node:fs'

// The pages lane (wayfinder MAP "Lanes now", 19 Oct): the four templates onto the shell's paper, links that open in the shell, and the
// Day die hardened where its host meets it — a turn from the Day device or the transport reaches the Day a pane holds open, and a pane
// keeps a drafted Day when Central's current Day moves on. Channels: SCRIPTED — a stubbed kernel bridge with the owner's CAS law; the
// form is the real one from desktop/cradle/documents. NOT a screen pass (the die's own census is desktop/cradle/tests/day-die-browser.mjs).
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

const door = await import('../src/central/documents/documentDoor.ts')
const {turnDieFace} = await import('../src/central/devices/centralDeviceWrites.ts')
const {DayFormSession, validateDocumentBasis} = await import('../../../../desktop/cradle/src/central/dayForm.ts')
const {keptDay} = await import('../src/central/documents/CentralDocumentPane.tsx')
const {linkTarget} = await import('../src/inhabitants/DocumentPageFace.tsx')

const here = new URL('./', import.meta.url)
const read = path => readFileSync(new URL(path, here), 'utf8')
const form = read('../../../../desktop/cradle/documents/ql-daily-die.html')
const blank = JSON.parse(/<script type="application\/json" id="ql-doc">([\s\S]*?)<\/script>/.exec(form)[1])

/** Central's Day owner as the kernel bridge answers it: one Day document, its aggregate field map (as the owner's Days carry it), and
 * the receiving law — `document` reads it, `mutate-field` CAS-checks `expected_revision` and refuses a stale write. */
function owner() {
  const SOURCE = 'central:source:control:root:Control/user/day/2026-10-19/day.md', ID = 'document:fixture'
  const fields = Object.keys(blank).map(key => ({id: key, template_pointer: `/${key}`}))
  const state = {revision: 1, payload: structuredClone(blank), writes: 0}
  state.payload.meta = {...state.payload.meta, uuid: ID, date: '2026-10-19', timezone: 'Europe/London', face: 0}
  const reading = receipt => ({schema: 'central.document-reading/v1', source: {ref: SOURCE, path: 'Control/user/day/2026-10-19/day.md'}, document_id: ID,
    revision: {revision: `r${state.revision}`}, document: {document_id: ID, kind: 'day', template_payload: structuredClone(state.payload), fields},
    automatic_agent_or_model_invocation: false, ...(receipt ? {operation_receipt: receipt} : {})})
  const answer = data => ({json: async () => ({ok: true, outcome: {result: 'receiving_reading', data}})})
  const fetch = async (_url, init) => {
    const body = JSON.parse(init.body)
    if (body.op !== 'receiving') return {json: async () => ({ok: false, error: `unexpected op ${body.op}`})}
    if (body.request.Document) return answer(reading())
    const write = body.request.MutateField
    if (!write) return {json: async () => ({ok: false, error: 'unexpected receiving request'})}
    if (write.expected_revision !== `r${state.revision}`) return {json: async () => ({ok: false, error: `stale: the Day is at r${state.revision}, the write expected ${write.expected_revision}`})}
    const previous = `r${state.revision}`
    state.payload[fields.find(field => field.id === write.field_id).template_pointer.slice(1)] = structuredClone(write.value)
    state.revision++; state.writes++
    return answer(reading({status: 'committed', previous_revision: previous, revision: `r${state.revision}`}))
  }
  return {fetch, state, aperture: {project: null, sourceRef: SOURCE, documentId: ID}, reading}
}
async function withOwner(stub, run) {
  const real = globalThis.fetch
  globalThis.fetch = stub.fetch
  try { return await run({kind: 'bridge', url: 'http://central.fixture'}) } finally { globalThis.fetch = real }
}
/** The pane's draft: the form's payload as its snapshot posts it — the face the form shows and one written line. */
const draftOf = (basis, face) => { const draft = structuredClone(basis.payload); draft.meta.face = face; draft.fields.p0_quick_thoughts = '<p>The stone.</p>'; return draft }

test('before the door: a device turn written to the owner moves the Day under the open pane, whose Save is then refused as stale', async () => {
  const stub = owner()
  await withOwner(stub, async transport => {
    const pane = new DayFormSession(validateDocumentBasis(stub.reading(), stub.aperture.sourceRef, stub.aperture.documentId))
    await turnDieFace(transport, stub.aperture, 3)
    pane.stage(draftOf(pane.basis, 0))
    await assert.rejects(pane.save(input => fetch('x', {method: 'POST', body: JSON.stringify({op: 'receiving', request: {MutateField: input}})}).then(r => r.json()).then(r => {
      if (!r.ok) throw new Error(r.error); return r.outcome.data })), /stale/)
  })
})

test('a device turn while a pane holds the Day turns the pane, writes nothing, and the pane\'s next Save is not refused as stale', async () => {
  const stub = owner()
  await withOwner(stub, async transport => {
    const pane = new DayFormSession(validateDocumentBasis(stub.reading(), stub.aperture.sourceRef, stub.aperture.documentId))
    const turned = []
    const release = door.holdDayInPane(stub.aperture.documentId, 'pane:a', {face: 0, turn: face => turned.push(face)})
    try {
      assert.equal(await door.turnDay(stub.aperture.documentId, 3, () => turnDieFace(transport, stub.aperture, 3)), 'pane')
      assert.deepEqual(turned, [3], 'the pane\'s form was turned')
      assert.equal(stub.state.writes, 0, 'the owner was not written: the pane\'s basis stands')
      pane.stage(draftOf(pane.basis, 3))
      const {receiving} = await import('../../../../desktop/cradle/src/receiving/client.ts')
      await pane.save(input => receiving(transport, null, {kind: 'mutate-field', ...input}))
      assert.equal(stub.state.payload.meta.face, 3, 'the owner holds the turn with the Day\'s Save')
      assert.equal(stub.state.payload.fields.p0_quick_thoughts, '<p>The stone.</p>')
    } finally { release() }
  })
})

test('with no pane holding the Day, a device turn goes to the owner as before', async () => {
  const stub = owner()
  await withOwner(stub, async transport => {
    assert.equal(door.dayInPane(stub.aperture.documentId), null)
    assert.equal(await door.turnDay(stub.aperture.documentId, 2, () => turnDieFace(transport, stub.aperture, 2)), 'owner')
    assert.equal(stub.state.payload.meta.face, 2)
    assert.equal(stub.state.writes, 1)
  })
})

test('the door names the pane the hand last reached when a Day stands in two, and forgets a pane that leaves', () => {
  const a = {face: 1, turn: () => {}}, b = {face: 4, turn: () => {}}
  const offA = door.holdDayInPane('document:two', 'pane:a', a), offB = door.holdDayInPane('document:two', 'pane:b', b)
  door.publishDocument({key: 'pane:a', form: 'Day', title: 'Day', state: 'as read', day: {project: null, sourceRef: 's', documentId: 'document:two'}, face: 1}, true)
  assert.equal(door.dayInPane('document:two'), a)
  door.withdrawDocument('pane:a')
  assert.equal(door.dayInPane('document:two'), b, 'with none reached, the last pane to stand')
  offB(); assert.equal(door.dayInPane('document:two'), a); offA(); assert.equal(door.dayInPane('document:two'), null)
})

test('the Day device and the transport turn through the door, and read the face the pane shows', () => {
  const devices = read('../src/central/devices/CentralDevices.tsx'), transport = read('../src/shell/transports/useCentralTransport.tsx')
  assert.match(devices, /turn: async \(aperture, face\) => \{ if \(await turnDay\(aperture\.documentId, face, \(\) => turnDieFace\(transport, aperture, face\)\) === 'owner'\) refreshDocument\(\) \}/)
  assert.match(devices, /const shownFace = inPane\?\.face \?\? document\.face/)
  assert.match(transport, /turnDay\(die\.aperture\.documentId, face, \(\) => turnDieFace\(transport, die\.aperture, face\)\)/)
  assert.match(transport, /centralBindings\(\{[^}]*\.\.\.\(shownFace !== null \? \{face: shownFace\} : \{\}\)\}\)/)
})

test('Two Days at a time: a pane keeps a drafted Day when Central\'s current Day moves on, and follows the owner once it is saved', () => {
  const day = (date, id) => ({state: 'ready', dayRef: `central:day:control:root:${date}`, civilDate: date, sourceRef: `src:${date}`, documentId: id, revision: 'r1'})
  const d19 = day('2026-10-19', 'document:19'), d20 = day('2026-10-20', 'document:20')
  assert.deepEqual(keptDay(null, d19, false), {held: d19, shown: d19, kept: false})
  assert.deepEqual(keptDay(d19, d20, true), {held: d19, shown: d19, kept: true}, 'the draft keeps the 19th in its pane when the owner names the 20th')
  assert.deepEqual(keptDay(d19, null, true), {held: d19, shown: d19, kept: true}, 'and when the new Day has no document yet')
  assert.deepEqual(keptDay(d19, d20, false), {held: d20, shown: d20, kept: false}, 'saved, the pane moves on')
  assert.deepEqual(keptDay(d19, null, false), {held: d19, shown: null, kept: false}, 'with no draft and no document, the owner\'s sentence stands')
  const again = {...d19, revision: 'r2'}
  assert.equal(keptDay(d19, again, true).held, d19, 'the same Day read again is the same Day')
})

test('a followed link opens in the shell: an http(s) address in the Web widget, a page of a world as its page, nothing else', () => {
  assert.deepEqual(linkTarget('https://example.org/stone'), {kind: 'web', url: 'https://example.org/stone'})
  assert.deepEqual(linkTarget('Work/O-I/ProjectCentral/user/beings/ada.html'), {kind: 'page', path: 'Work/O-I/ProjectCentral/user/beings/ada.html'})
  assert.deepEqual(linkTarget('central:path:/Users/admin/Central:Control/user/flows/flow-1.html'), {kind: 'page', path: 'Control/user/flows/flow-1.html'})
  for (const href of ['javascript:alert(1)', 'https://user:pw@example.org/', 'file:///etc/passwd', 'notes.txt', '']) assert.equal(linkTarget(href).kind, 'none', href)
})

/** The paper family as styles.css :root defines it, and a template's own declarations of the same names. */
const family = css => Object.fromEntries([...css.matchAll(/--(paper|pfield|ink|pmid|pfaint|prule|hl|psans|serif|mono):\s*([^;}]+)/g)].map(([, name, value]) => [name, value.trim()]))
const shell = family(read('../src/styles.css').match(/^:root \{[\s\S]*?\}\n/m)[0])
const ink = Object.fromEntries([...read('../src/styles.css').matchAll(/--pi-(paper|pfield|ink|pmid|pfaint|prule):\s*([^;}]+)/g)].map(([, name, value]) => [name, value.trim()]))

test('the four templates draw in the shell\'s paper family: the same names, the same values, the Ink tone the same', () => {
  const norm = v => v.replace(/"/g, "'").toLowerCase()
  const PAPER = ['paper', 'pfield', 'ink', 'pmid', 'pfaint', 'prule', 'hl', 'psans', 'serif']
  for (const [name, css] of [['ql-daily-die.html', read('../../../../desktop/cradle/documents/ql-daily-die.html')], ['ql-flow.html', read('../../../../desktop/cradle/documents/ql-flow.html')],
    ['page.mjs (Beings, Things)', read('../../../../desktop/cradle/src/personal/page.mjs')]]) {
    const root = family(css.match(/:root\{[\s\S]*?\}/)[0])
    for (const token of PAPER) assert.equal(norm(root[token] ?? ''), norm(shell[token]), `${name} --${token}`)
    assert.equal(norm(root.mono ?? ''), norm(read('../src/styles.css').match(/--mono:([^;]+);/)[1]), `${name} --mono`)
    assert.doesNotMatch(css.replace(/<script type="application\/json" id="ql-doc">[\s\S]*?<\/script>/, ''), /var\(--(field|mid|faint|rule|sans|space|lid)\)/, `${name} reads no name outside the family`)
  }
  const tone = family(read('../../../../desktop/cradle/src/personal/page.mjs').match(/body\[data-tone=ink\]\{[^}]*\}/)[0])
  for (const token of Object.keys(ink)) assert.equal(tone[token].toLowerCase(), ink[token].toLowerCase(), `the Ink tone --${token}`)
})

test('the shell\'s page faces carry no paper of their own: every page sheet reads the family\'s tokens', () => {
  const PAPER_HEX = /#(EFEFED|FAFAF8|F7F7F5|E4E4E1|6E6E6A|A3A39E|A6A6A1|C9C9C4|1a1a18|20231f|282c26|eeeee8|b2b7aa|8e9688|555e50)\b/i
  for (const file of ['central/documents/centralDocuments.css', 'inhabitants/DocumentDayDieFace.tsx', 'inhabitants/catalogue/panels/central__beings.tsx',
    'inhabitants/catalogue/panels/central__things.tsx', 'inhabitants/catalogue/panels/central__document.tsx', 'inhabitants/catalogue/panels/central__text.css',
    'inhabitants/catalogue/panels/central__notes.css', 'inhabitants/catalogue/panels/central__highlight.css', 'inhabitants/catalogue/panels/central__highlight.tsx']) {
    const text = read(`../src/${file}`).replace(/\/\*[\s\S]*?\*\//g, '').replace(/var\(--[a-z-]+, #[0-9a-f]+\)/gi, '')
    assert.doesNotMatch(text, PAPER_HEX, file)
  }
})

test('a Flow on the form\'s current schema is drawn by the shell\'s own form from its island; an earlier Flow as it was made', async () => {
  const {currentFlow} = await import('../src/inhabitants/DocumentFlowFace.tsx')
  const {parseInstance, embedDocument} = await import('../../../../desktop/cradle/src/flow/instance.ts')
  const flowForm = read('../../../../desktop/cradle/documents/ql-flow.html')
  const doc = parseInstance(flowForm); doc.meta.title = 'Closing the day'; doc.meta.template = 'ql-dialogue-flow v0.4'
  // A Flow minted from an earlier copy of the form: the same island, an older runtime (no link handling, the old paper).
  const older = embedDocument(flowForm.replace("ev.preventDefault(); window.parent.postMessage({type:'oi:page-link',href},'*');", '').replace('--pfield:#FAFAF8', '--field:#FAFAF8'), doc)
  const drawn = currentFlow(older)
  assert.deepEqual(parseInstance(drawn), doc, 'the island is drawn whole')
  assert.match(drawn, /type:'oi:page-link'/, 'by the current form: its links reach the host')
  assert.equal(drawn.replace(/<script type="application\/json" id="ql-doc">[\s\S]*?<\/script>/, ''), flowForm.replace(/<script type="application\/json" id="ql-doc">[\s\S]*?<\/script>/, ''))
  const v01 = embedDocument(flowForm, {...doc, meta: {...doc.meta, template: 'ql-dialogue-flow v0.1'}})
  assert.equal(currentFlow(v01), v01, 'a Flow of an earlier schema is hosted as it is')
  assert.equal(currentFlow('<html>no island</html>'), '<html>no island</html>')
})

test('the Day is drawn by the shell\'s own form, never the copy in the primary checkout, which can be older than its bridge', () => {
  const face = read('../src/inhabitants/DocumentDayDieFace.tsx')
  assert.match(face, /import dieForm from '\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/desktop\/cradle\/documents\/ql-daily-die\.html\?raw'/)
  assert.match(face, /projectDieDocument\(dieForm, validated\.payload\)/)
  assert.doesNotMatch(face, /resolveDocumentForm|readFile\(/, 'no form is read from the owner\'s ground for drawing')
})
