// The environs of the process devices (manual §25.6 "Process types, read in time": a creature shows an agent's act, an environ a
// process's course): the Gateway's river (§19.2), the NOWs' seasons (§23.6), the succession on the Seat page of Git / landing and the
// erosion on its Checkouts page (§19.16), and the erosion of Docs (§18.5). Each is read from the value keys its device already carries
// (faces/environReadings.ts) and drawn in the kit's well (faces/EnvironFaces.tsx), at its home in the device's views; while a reading is
// missing the picture stands still and says which reading it waits on, and nothing in it moves.
// Channels: REAL (tests/fixtures/environ-readings-2026-10-21.json: `central.now.list` and `seat status --json` read on workcell:mac,
// 21 Oct, read-only, the clearings' purposes replaced); BINDING (the Gateway's, the NOWs' and the Seat's own value functions on those
// readings, or on the answer shapes their tests use); SCRIPTED (the designs rendered to static markup on their defaults and fixtures).
// Ported by hand from the design lane's proposal (O-I 871182e98) onto today's homes. Loader as factory-design-binding.test.mjs.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {register} from 'node:module'

const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
const boundary = new URL('packages/expressions-boundary/src/', new URL('../../../../', import.meta.url)).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
const BOUNDARY = ${JSON.stringify(boundary)};
export async function resolve(specifier,context,next){
  if(specifier.startsWith('@epilogos/expressions-boundary/'))return next(BOUNDARY+specifier.slice('@epilogos/expressions-boundary/'.length)+'.ts',context);
  try{return await next(specifier,context)}catch(error){
    if(!specifier.startsWith('.'))throw error;
    if(specifier.endsWith('.js')){try{return await next(specifier.slice(0,-3)+'.ts',context)}catch{}}
    for(const suffix of ['.ts','.tsx','/index.ts','/index.tsx']){try{return await next(specifier+suffix,context)}catch{}}
    throw error;
  }
}
export async function load(url,context,next){
  if(url.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export default null'};
  if(url.endsWith('.html')||url.includes('?raw'))return {format:'module',shortCircuit:true,source:'export default ""'};
  if(url.endsWith('.ts')||url.endsWith('.tsx')){
    const source=await readFile(new URL(url).pathname,'utf8');
    const {outputText}=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:url});
    return {format:'module',shortCircuit:true,source:outputText};
  }
  return next(url,context);
}`)}`, {parentURL: import.meta.url})

globalThis.document = {getElementById: () => null, createElement: () => ({}), head: {appendChild: () => {}}, documentElement: {}}
const {createElement: h} = await import('react')
const {renderToStaticMarkup} = await import('react-dom/server')
const F = await import('../src/inhabitants/catalogue/faces/environReadings.ts')
const faces = await import('../src/inhabitants/catalogue/faces/EnvironFaces.tsx')
const hygiene = await import('../src/inhabitants/centralHygieneModel.ts')
const model = await import('../src/agent/devices/agentChainDevices.ts')
const bind = await import('../src/agent/devices/designBindings.ts')
const rail = await import('../src/widgets/railBindings.ts')
const cell = await import('../src/agent/devices/workcellBindings.ts')
const {prefixed} = await import('../src/inhabitants/catalogue/panels/design.ts')
const {design: gateway} = await import('../src/inhabitants/catalogue/panels/actuation__gateway.tsx')
const {design: nows} = await import('../src/inhabitants/catalogue/panels/widgets__nows.tsx')
const {design: git} = await import('../src/inhabitants/catalogue/panels/workcell__git-seat.tsx')
const {design: docs} = await import('../src/inhabitants/catalogue/panels/central__docs.tsx')
const REAL = JSON.parse(readFileSync(new URL('./fixtures/environ-readings-2026-10-21.json', import.meta.url), 'utf8'))

const nav = {select() {}, expand() {}, full() {}, popout() {}, fold() {}, unfold() {}, rail() {}, close() {}}
const props = (v, extra = {}) => ({v, set() {}, nav, page: '', setPage() {}, standing: {}, owner: v, frame: 'pane', room: {w: 900, h: 520}, ...extra})
const draw = node => renderToStaticMarkup(node)
/** The environ wells a markup holds: kind, state, and the words standing in its picture. */
const environs = markup => [...markup.matchAll(/<div class="fx-env" data-environ="([a-z]+)" data-environ-state="([a-z]+)">([\s\S]*?)<\/svg>/g)]
  .map(([, kind, state, body]) => ({kind, state, body, words: [...body.matchAll(/<text[^>]*data-environ-words=""[^>]*>([\s\S]*?)<\/text>/g)].map(m => m[1].replace(/<tspan[^>]*>/g, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()).join(' ')}))
const only = (markup, kind) => { const found = environs(markup).filter(e => e.kind === kind); assert.equal(found.length, 1, `one ${kind} well (${found.length})`); return found[0] }
const FOUR = 'Waits on the time since the last check-in, the turns running, the frames in flight and the frames.'

// ---------------------------------------------------------------- the river

test('the river: still while any of the Gateway\'s four link readings is missing, naming them; flowing on all four inside Stall after; dry while nothing can come in', () => {
  assert.equal(F.isAbsent(F.riverOf({})), true)
  assert.match(F.riverOf({}).waits, /reported nothing/)
  assert.deepEqual([F.riverOf({light: 'lit', refused: 'harness_agent_read: no binding'}).flow, F.riverOf({light: 'lit', refused: 'harness_agent_read: no binding'}).why], ['dry', 'harness_agent_read: no binding'])
  assert.equal(F.riverOf({light: 'lit', connect: false}).flow, 'dry')
  assert.equal(F.riverOf({light: 'dark'}).flow, 'dry')
  const today = F.riverOf({light: 'lit', connect: true, readiness: 'ready', stallAfter: 300})
  assert.deepEqual([today.flow, today.waits, today.why], ['still', ['beatAge', 'running', 'inflight', 'frames'], FOUR], 'as the Gateway is bound today: still, and it names the four readings')
  assert.deepEqual(F.riverOf({light: 'lit', beatAge: 4, running: 2, inflight: 1}).waits, ['frames'], 'three of four is still still')
  const frames = JSON.stringify([{session: 'a', dir: 'in'}, {session: 'b', dir: 'out'}, {session: 'a', dir: 'in'}])
  const flowing = F.riverOf({light: 'lit', beatAge: 5, running: 3, inflight: 4, frames, stallAfter: 90})
  assert.deepEqual([flowing.flow, flowing.sessions, flowing.inflight, flowing.waits], ['flowing', 3, 4, []])
  assert.equal(F.riverOf({light: 'lit', beatAge: 5, inflight: 1, frames, running: null}).waits.includes('running'), true)
  const stalled = F.riverOf({light: 'lit', beatAge: 400, running: 2, inflight: 0, frames, stallAfter: 90})
  assert.deepEqual([stalled.flow, stalled.why], ['still', 'No check-in for 400 s: past Stall after (90 s).'])
  assert.equal(F.riverOf({light: 'lit', beatAge: -1, running: 0, inflight: 0, frames: '[]'}).flow, 'still', 'beatAge -1: no check-in yet')
})

test('the river at its home: across the head of the Gateway\'s Full, live on all four readings, still on a gateway that predates the link with the four named in the picture', () => {
  const live = only(draw(gateway.full(props(gateway.defaults))), 'river')
  assert.equal(live.state, 'live', 'the catalogue\'s sample carries all four')
  assert.equal((live.body.match(/<ellipse /g) ?? []).length, gateway.defaults.inflight, 'one leaf on the current for each frame in flight')
  // The real binding, on the harness's answer as its own test reads it (factory-design-binding.test.mjs): an answer with no link carries
  // none of the four (a gateway that carries it: tests/t745-readings.test.mjs).
  const answered = {...model.INITIAL_READING, gatewayAdmitted: true, gatewayDoc: {state: 'ready', transport: 'ws', connect: true, stall_after_seconds: 300}}
  const binding = bind.gatewayBinding('factory:gateway', {reading: answered, harness: {binding: 'harness:hermes', resolved: true}}, {}, async () => ({kind: 'refused', reason: 'x'}))
  const values = {...gateway.defaults, beatAge: undefined, running: undefined, inflight: undefined, frames: undefined, ...binding.values}
  const still = only(draw(gateway.full(props(values, {standing: binding.standing}))), 'river')
  assert.equal(still.state, 'still')
  assert.equal(still.words, FOUR, 'the still picture says which readings it waits on')
  assert.doesNotMatch(still.body, /<ellipse /, 'nothing floats on a river that has no reading of its frames')
  assert.match(still.body, /data-i="The river\|[^"]*carries no link/, 'the info line carries the binding\'s own reason')
  const fixture = only(draw(gateway.full(props({...gateway.defaults, ...gateway.fixtures['As bound today']}))), 'river')
  assert.equal(fixture.state, 'live', 'the catalogue carries today\'s binding as a fixture: the four link readings stand')
  assert.equal(only(draw(gateway.full(props({...gateway.defaults, ...gateway.fixtures.Stalled}))), 'river').state, 'still', 'a stall does not breathe')
  assert.equal(only(draw(gateway.full(props({...gateway.defaults, ...gateway.fixtures.Refused}))), 'river').state, 'dry')
})

// ---------------------------------------------------------------- the seasons

test('the seasons: the real NOW field read as a year, its clearings in growth, dormant, harvested and in the record', () => {
  const rows = REAL.nows.records
  const tally = {active: 0, quiescent: 0, closed: 0, archived: 0}
  for (const r of rows) tally[r.lifecycle] += 1
  const reading = F.seasonsOf({nows: JSON.stringify(rows.filter(r => r.lifecycle !== 'archived')), seasons: JSON.stringify(tally)})
  assert.deepEqual(reading.counts, {growth: tally.active, dormant: tally.quiescent, harvested: tally.closed, record: tally.archived})
  assert.equal(reading.standing.length, tally.active + tally.quiescent, 'the standing field: active and quiescent')
  const created = ref => rows.find(r => r.now_ref === ref).created_at_unix_seconds
  assert.ok(reading.standing.every((c, i, all) => i === 0 || created(all[i - 1].ref) <= created(c.ref)), 'oldest first')
  assert.equal(F.seasonsOf({nows: '[]'}).counts.record, null, 'without the year\'s count the record is unread, not zero')
  assert.deepEqual(F.seasonsOf({reason: 'central.now.list: refused'}), {absent: true, waits: 'Waits on the NOW listing: central.now.list: refused.'})
})

test('the NOWs binding counts the field\'s year over the whole listing, archived clearings too, beside the rows that leave them out', () => {
  const listing = {schema: 'central.now-listing/v1', automatic_agent_or_model_invocation: false, records: REAL.nows.records}
  const values = rail.nowsValues({time: {state: 'failed', action: 'central.time.policy'}, day: {state: 'failed', action: 'central.day.read'}, now: {state: 'ready', action: 'central.now.list', data: listing}, sources: {state: 'unavailable', action: 'x'}})
  const seasons = JSON.parse(values.seasons)
  assert.equal(seasons.active + seasons.quiescent + seasons.closed + seasons.archived, REAL.nows.records.length)
  assert.equal(seasons.archived, 58, 'the real field holds 58 archived')
  assert.ok(JSON.parse(values.nows).every(r => r.lifecycle !== 'archived'), 'the rows still leave them out')
  const full = only(draw(nows.full(props({...nows.defaults, ...values}))), 'seasons')
  assert.equal(full.state, 'live')
  assert.equal((full.body.match(/data-season="growth"/g) ?? []).length, seasons.active, 'a stalk in ear for each clearing in growth')
  assert.equal((full.body.match(/data-season="harvested"/g) ?? []).length, Math.min(5, seasons.closed), 'a sheaf for each harvested clearing, five at most')
  assert.match(full.body, new RegExp(`${seasons.active} in growth · ${seasons.quiescent} dormant · ${seasons.closed} harvested · 58 in the record`))
  const unread = only(draw(nows.full(props({...nows.defaults, ...nows.fixtures['The ground reports nothing']}))), 'seasons')
  assert.deepEqual([unread.state, unread.words], ['waiting', 'Waits on the NOW listing: The ground did not answer.'])
})

// ---------------------------------------------------------------- the succession

test('the succession: each seat of a product is ground; a lane grows on it, main\'s newer commits lie on top, loose files mound, drift flags', () => {
  const reading = F.successionOf({seats: JSON.stringify([
    {workcell: 'env-1', product: 'o-i', state: 'claimed', branch: 'dlw/build', claimedBy: 'a', dirty: 3, untracked: 2, ahead: 12, behind: 4, drift: 'none', zones: [{actor: 'a'}, {actor: 'b'}]},
    {workcell: 'env-2', product: 'o-i', state: 'free', branch: null, dirty: 0, untracked: 0, ahead: 0, behind: 0},
    {workcell: 'env-3', product: 'o-i', state: 'occupied-foreign-lane', branch: 'fold/x', dirty: null, untracked: null, ahead: null, behind: null, drift: 'head differs'},
    {workcell: 'env-1', product: 'central', state: 'free'}])})
  assert.deepEqual(reading.plots.map(p => [p.seat, p.state, p.lane, p.ahead, p.loose, p.workers, p.drift]), [
    ['env-1', 'held', 'dlw/build', 12, 5, 2, false], ['env-2', 'free', null, 0, 0, 0, false], ['env-3', 'foreign', 'fold/x', null, null, 1, true]],
    'the first row\'s product unless one is chosen; loose ground is what has no commit; the workers the zones name')
  assert.match(F.successionOf({}).waits, /seat instrument \(seat status\)/)
  assert.match(F.successionOf({seats: '[]'}).waits, /a product/)
  assert.match(F.successionOf({seats: JSON.stringify([{workcell: 'env-1', product: 'o-i', state: 'free'}]), product: 'ql-mef'}).waits, /seat of ql-mef/)
})

test('the succession at its home: the Seat page of Git / landing, read through the Seat\'s own binding on the real seat status', () => {
  const values = cell.seatValues({status: REAL.seat, project: 'actuation', branch: null, holds: {views: {}}})
  assert.ok(values.seats, 'the real reading reaches the Seat page\'s values')
  const markup = draw(git.whole(props({...git.defaults, ...prefixed('seat.', {...values, seats: values.seats})}, {page: 'seat', frame: 'chain'})))
  const well = only(markup, 'succession')
  assert.equal(well.state, 'live')
  const actuation = JSON.parse(values.seats).filter(s => s.product === 'actuation')
  assert.deepEqual([...well.body.matchAll(/data-plot="([a-z]+)"/g)].map(m => m[1]),
    actuation.sort((a, b) => a.workcell.localeCompare(b.workcell)).map(s => s.state === 'claimed' ? 'held' : s.state === 'free' ? 'free' : s.state === 'occupied-foreign-lane' ? 'foreign' : 'unknown'))
  const none = only(draw(git.whole(props({...git.defaults, 'seat.seats': undefined}, {page: 'seat', frame: 'chain'}))), 'succession')
  assert.deepEqual([none.state, none.words], ['waiting', 'Waits on the seat instrument (seat status).'])
  assert.equal(environs(draw(git.whole(props(git.defaults, {page: 'landing', frame: 'chain'})))).length, 0, 'the Landing page draws no environ')
})

// ---------------------------------------------------------------- the erosion

test('the erosion of the checkouts: the real seat status as findings on the rings; a refused ring unsurveyed; the Checkouts page draws it', () => {
  const seats = hygiene.parseSeatStatusJson(JSON.stringify(REAL.seat))
  const sources = [{boundaryOp: 'seat status (Control/user/workcell/seat)', channel: 'machine-instrument', at: 'x'},
    {boundaryOp: 'git worktree list --porcelain', channel: 'machine-instrument', at: 'x', refusal: 'the git repository reading did not answer'}]
  const census = hygiene.assembleCensus({sources, seats, machineRef: 'workcell:mac'})
  const findings = hygiene.hygieneFindings(census, hygiene.registeredSeatPaths(census))
  const reading = F.checkoutErosionOf({findings: JSON.stringify(findings), sources: JSON.stringify(sources), seats: JSON.stringify(seats)})
  const by = Object.fromEntries(reading.stretches.map(s => [s.id, s]))
  const onSeats = findings.filter(f => ['seat-claimed', 'seat-drift', 'seat-floor-breach', 'checkout-missing', 'foreign-lane', 'occupied-by-landed'].includes(f.kind))
  assert.ok(onSeats.length > 0, 'the real machine has findings on its seats')
  assert.equal(by.seats.wear.reduce((n, w) => n + w.count, 0), onSeats.length, 'the seats stretch wears every finding on the seats')
  assert.ok(by.seats.wear.every((w, i, all) => i === 0 || all[i - 1].depth >= w.depth), 'the deepest channel first')
  assert.deepEqual([by.worktrees.state, by.worktrees.why], ['unsurveyed', 'git worktree list --porcelain: the git repository reading did not answer'], 'a refused read leaves its ring unsurveyed')
  assert.deepEqual([by.branches.state, by.branches.why], ['unsurveyed', 'No reading of the branches.'])
  assert.match(F.checkoutErosionOf({}).waits, /Waits on the checkouts/)
  const page = only(draw(git.whole(props(git.defaults, {page: 'checkouts', frame: 'chain'}))), 'erosion')
  assert.equal(page.state, 'live')
  assert.deepEqual([...page.body.matchAll(/data-stretch="([a-z]+)"/g)].map(m => m[1]).length, 3, 'branches, seats, worktrees')
  const none = only(draw(git.whole(props({...git.defaults, ...git.fixtures['No machine read']}, {page: 'checkouts', frame: 'chain'}))), 'erosion')
  assert.deepEqual([none.state, none.words], ['waiting', 'Waits on the checkouts: git worktree list --porcelain refused (the git repository reading did not answer).'])
})

test('the erosion of Docs: each tier a stretch, worn by every move since its law read it, grooved where a meaning drifts; a refused source unsurveyed, an empty tier bare', () => {
  const reading = F.docsErosionOf(docs.defaults)
  const by = Object.fromEntries(reading.stretches.map(s => [s.id, s]))
  assert.deepEqual(reading.stretches.map(s => s.label), ['0 ground', '1 experience', '2 design', '3 architecture', '4 implementation', '5 evidence'])
  assert.deepEqual(by['tier-1'].wear.map(w => [w.kind, w.count, w.depth]), [['stale', 1, 2], ['moved', 3, 1]], 'DLW.md: moved 3 since its law read it, and stale')
  assert.deepEqual(by['tier-2'].wear.map(w => [w.kind, w.depth]), [['missing', 3], ['moved', 1]], 'a meaning whose implementation is missing is a gully')
  assert.equal(by['tier-0'].state, 'sound', 'read against the work, nothing moved')
  assert.equal(by['tier-4'].state, 'bare', 'no source stands on tier 4')
  const refused = F.docsErosionOf({...docs.defaults, sources: JSON.stringify([{path: 'docs/architecture', tier: 3, refusal: 'The source is a folder.'}]), 'refusal:moved': 'the horizon is not read'})
  assert.deepEqual([refused.stretches[3].state, refused.stretches[3].why], ['unsurveyed', 'docs/architecture: The source is a folder.'])
  assert.deepEqual(refused.unread, ['Moved since is not read: the horizon is not read'])
  assert.match(F.docsErosionOf({}).waits, /projectcentral\.docs\.inspect/)
  const pane = only(draw(docs.full(props(docs.defaults))), 'erosion')
  assert.equal(pane.state, 'live')
  assert.deepEqual([...pane.body.matchAll(/data-stretch="([a-z]+)"/g)].map(m => m[1]), reading.stretches.map(s => s.state))
  const none = only(draw(docs.full(props({...docs.defaults, ...docs.fixtures['No readings']}))), 'erosion')
  assert.deepEqual([none.state, none.words], ['waiting', 'Waits on the account (projectcentral.docs.inspect).'])
})

// ---------------------------------------------------------------- the rules

test('an environ is the state now: nothing in it moves, it paints only with the shell\'s tokens, and the kit exports the four with their readers', async () => {
  const {readFile} = await import('node:fs/promises')
  const source = await readFile(new URL('../src/inhabitants/catalogue/faces/EnvironFaces.tsx', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /<animate|requestAnimationFrame|setInterval|setTimeout|@keyframes|animation/, 'no motion without an event')
  assert.doesNotMatch(source.replace(/\/\/[^\n]*/g, ''), /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/, 'no raw colour: every paint is a token')
  assert.doesNotMatch(source, /figures|INK\b/, 'the environs are drawn in the kit\'s inks, not the creatures\' roster inks')
  const kit = await import('../src/inhabitants/catalogue/faces/index.ts')
  for (const name of ['RiverEnviron', 'SeasonsEnviron', 'SuccessionEnviron', 'ErosionEnviron', 'riverOf', 'seasonsOf', 'successionOf', 'checkoutErosionOf', 'docsErosionOf'])
    assert.equal(typeof kit[name], 'function', name)
  assert.equal(typeof faces.RiverEnviron, 'function')
})
