// O-I #844 (lane BD, Songs: work written once, run again, and used whole in other work; manual §19.1 Songs, §10.3 Material and Packs,
// §10.9 File › Export Song…, §19.7 the Skillset rack's Capture page). A song is made one clip by Software Factory (`factory workflow
// export`, factory.song-clip/v1, the kernel's factory_owner `workflow-export`); Material › Songs lists every disclosed project's clips
// (`factory workflow songs`, gathered by the kernel as oi.factory-songs/v1, `workflow-songs-read`), each with whether its set has moved;
// Remake makes one again from its set (`workflow-remake`); a clip dropped on a session's track is one unit of the song the session's Run
// performs, with the thread form canon (`factory workflow edit` canon), and the score draws it as one note holding its song, which a
// double-click opens; Capture on the Skillset rack's Capture page, Source › A clip, writes a Method from the selected clip through AIKit
// (`aikit capture --from-song`, aikit_write capture with from_song), which waits in the inbox until the person's Accept promotes it.
// Packs has no owner that lists what was installed together, so the place stands refused, naming the read it waits for.
// Channels: REAL — Factory's answers and refusals (Factory's CLI built from dlw/844-songs, walked headless on two scratch projects,
// song-maker and song-taker) and AIKit's capture, inbox and promote (AIKit's CLI built from dlw/844-capture, on a scratch home), all in
// tests/fixtures/factory-songs-2026-11-03.json with their scratch roots written /walk. DERIVED — the kernel's gathering of those two
// projects' listings, in the shape desktop/cradle/kernel/src/factory.rs songs_of_location writes (its own test pins it). SCRIPTED — the
// kernel behind the bridge's fetch, recording every op; the designs rendered on the server. FIXTURE — the session tracks and AIKit's and
// Factory's attempt readings, owner-shaped, as tests/factory-attempt-takes.test.mjs has them. Not a screen pass: dropping a clip on a
// track in the native window, double-clicking its note, and Export Song… from the native menu are UNVERIFIED (the lead's walk; the
// tracks' drop takes the song's drag only once tracks-844.patch lands, and the menu row only once menus-844.patch does).
//
// Each test loads what it reads itself, so each one fails on its own reason against a tree without the change.
import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {readFile} from 'node:fs/promises'

const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(s, c, n) {
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

const noop = () => {}
globalThis.document ??= {getElementById: () => null, createElement: () => ({style: {}, setAttribute: noop, appendChild: noop}), head: {appendChild: noop},
  addEventListener: noop, removeEventListener: noop, querySelector: () => null, documentElement: {style: {}}}
// The window's events, so the owners' notices (owners/notices.ts tellOwnerChanged) reach their listeners here.
const bus = new EventTarget()
globalThis.window ??= globalThis
globalThis.addEventListener = bus.addEventListener.bind(bus); globalThis.removeEventListener = bus.removeEventListener.bind(bus)
globalThis.dispatchEvent = bus.dispatchEvent.bind(bus)
globalThis.localStorage ??= {getItem: () => null, setItem: noop}

const {createElement} = await import('react')
const {renderToStaticMarkup} = await import('react-dom/server')
const source = path => readFile(new URL(path, import.meta.url), 'utf8')

const REAL = JSON.parse(await readFile(new URL('./fixtures/factory-songs-2026-11-03.json', import.meta.url), 'utf8'))
const MAKER = '/walk/maker/.factory/development-state.json', TAKER = '/walk/taker/.factory/development-state.json'
// DERIVED: the kernel's gathering of the two scratch projects (factory.rs songs_of_location), and one project Factory refused.
const GATHERED = {contract: 'oi.factory-songs/v1', projects: [
  {project: 'song-maker', root: '/walk/maker', statePath: MAKER, state: 'read', reading: REAL.songs_maker},
  {project: 'song-taker', root: '/walk/taker', statePath: TAKER, state: 'read', reading: REAL.songs_taker},
  {project: 'Loose', root: '/walk/loose', state: 'absent', error: 'no Factory source'},
  {project: 'Broken', root: '/walk/broken', statePath: '/walk/broken/.factory/development-state.json', state: 'refused', error: 'factory workflow songs: the developmental state is unreadable'},
]}

/** A scripted kernel behind the bridge's fetch: `answer(op)` is the outcome, or an Error for the owner's refusal. It keeps every op. */
function kernel(answer) {
  const ops = []
  const was = globalThis.fetch
  globalThis.fetch = async (_url, init) => {
    const op = JSON.parse(init.body)
    ops.push(op)
    const outcome = answer(op)
    return {json: async () => (outcome instanceof Error ? {ok: false, error: outcome.message} : {ok: true, outcome})}
  }
  return {transport: {kind: 'bridge', url: 'http://songs.test'}, ops, restore: () => { globalThis.fetch = was }}
}
const factoryAnswer = data => ({result: 'factory_development_reading', data, receipts: []})
/** Factory's refusal as the kernel carries it: the diagnostic's words in the owner envelope. */
const factoryRefusal = diagnostic => new Error(JSON.stringify({kind: 'owner-refused-or-failed', message: diagnostic.error.message, operation_may_have_run: false}))

test('Material › Songs: every disclosed project\'s clips, grouped by the project that keeps each, with where its set stands', async () => {
  const songs = await import('../src/agent/songClips.ts')
  const {writesOwner} = await import('../../../../desktop/cradle/src/kernel/bridge.ts')
  const reading = songs.songsOf(GATHERED)
  assert.equal(reading.state, 'read')
  assert.deepEqual(reading.groups.map(group => [group.label, group.state, group.songs.map(row => [row.name, row.standing])]), [
    ['song-maker', 'read', [['eros-part', 'current'], ['release-check', 'current']]],
    ['song-taker', 'read', [['release-check', 'imported']]],
    ['Broken', 'refused', []],
  ], 'a project with no Factory source is left out; one Factory refused says so')
  assert.match(reading.groups[2].why, /the developmental state is unreadable/, 'in Factory\'s words')
  const kept = reading.groups[0].songs.find(row => row.name === 'release-check')
  assert.equal(kept.clipRef, 'factory-song:song-maker/release-check')
  assert.equal(kept.path, '/walk/maker/.factory/songs/release-check.song.json')
  assert.equal(kept.statePath, MAKER)
  assert.equal(kept.clip.contract, 'factory.song-clip/v1', 'the clip as Factory wrote it, for the Capture page')
  assert.match(songs.songWords(kept), /^release-check — a song made into one clip \(factory-song:song-maker\/release-check\), rendered from development-and-knowledge\.workflow\.ts: 6 units on 6 rows/)
  const imported = reading.groups[1].songs[0]
  assert.equal(imported.importedFrom, 'factory-song:song-maker/release-check', 'an import keeps where it came from (§10.3)')
  assert.match(songs.songWords(imported), /imported from factory-song:song-maker\/release-check/)
  // After the maker's set changed (REAL): Factory says the set moved, and the row says so.
  const moved = songs.songsOf({...GATHERED, projects: [{...GATHERED.projects[0], reading: REAL.songs_moved}]})
  assert.deepEqual(moved.groups[0].songs.map(row => songs.STANDING_WORD[row.standing]), ['set moved', 'set moved'])
  assert.match(songs.songsOf({contract: 'factory.song-clips/v1'}).why, /oi\.factory-songs\/v1/, 'anything but the kernel\'s gathering is no reading')
  // One read through the kernel, which the bridge hears as a read.
  const asked = []
  await songs.readSongs(async op => { asked.push(op); return {outcome: factoryAnswer(GATHERED)} })
  assert.deepEqual(asked, [{op: 'factory_owner', request: {kind: 'workflow-songs-read', all: true}}])
  assert.equal(writesOwner(asked[0]), false)
  assert.match((await songs.readSongs(async () => ({error: 'factory_owner: unknown variant `workflow-songs-read`'}))).why, /^Factory's songs were not read: /)
})

test('Export Song… makes the selected task\'s song one clip through Factory; Remake makes it again from its set; a refusal is Factory\'s words', async () => {
  const songs = await import('../src/agent/songClips.ts')
  const {onOwnerChanged} = await import('../src/owners/notices.ts')
  const {writesOwner} = await import('../../../../desktop/cradle/src/kernel/bridge.ts')
  const moved = []
  const stop = onOwnerChanged('temporal', change => moved.push(change.cause))
  const target = {statePath: TAKER, runRef: REAL.score_after.runRef, unitRef: REAL.score_after.units[0].unitRef}
  const scored = {state: 'read', reading: REAL.score_after, target}
  let k = kernel(() => factoryAnswer(REAL.export))
  try {
    const answer = await songs.exportSong(k.transport, scored)
    assert.deepEqual(k.ops, [{op: 'factory_owner', request: {kind: 'workflow-export', state_path: TAKER, entry: 'development-and-knowledge.workflow.ts'}}],
      'the song the task\'s Run performs, from its file under the project root')
    assert.equal(writesOwner(k.ops[0]), true, 'an export is a write')
    assert.equal(answer.ok, true)
    assert.match(answer.note, /^release-check is a clip under Material › Songs, 6 units rendered from development-and-knowledge\.workflow\.ts \(factory-song:song-maker\/release-check\)/)
    assert.equal(moved.length, 1, 'every reader of the songs is told')
    await songs.exportSong(k.transport, scored, {name: 'verify-part', rows: ['agent/anima-eros'], units: ['eros-verify']})
    assert.deepEqual(k.ops[1].request, {kind: 'workflow-export', state_path: TAKER, entry: 'development-and-knowledge.workflow.ts', name: 'verify-part',
      rows: ['agent/anima-eros'], units: ['eros-verify']}, 'Factory takes the tracks and the range when they are chosen')
  } finally { k.restore() }
  // A render of that name already stands (REAL): Factory's words, and nothing moved.
  k = kernel(() => factoryRefusal(REAL.export_refused))
  try {
    const refused = await songs.exportSong(k.transport, scored)
    assert.equal(refused.ok, false)
    assert.match(refused.error, /A clip named release-check already stands in this project's songs\. A render is never edited in place: Remake makes it again/)
  } finally { k.restore() }
  assert.equal((await songs.exportSong({kind: 'bridge', url: 'x'}, null)).error, songs.EXPORT_NO_SCORE, 'no task\'s score: nothing is asked')
  // Remake (REAL: after the set moved).
  const row = songs.songsOf(GATHERED).groups[0].songs.find(item => item.name === 'release-check')
  k = kernel(() => factoryAnswer(REAL.remake))
  try {
    const remade = await songs.remakeSong(k.transport, row)
    assert.deepEqual(k.ops, [{op: 'factory_owner', request: {kind: 'workflow-remake', state_path: MAKER, name: 'release-check'}}])
    assert.equal(remade.ok, true)
    assert.match(remade.note, /release-check was made again from its set, which had moved/)
  } finally { k.restore() }
  // Remake of an import (REAL): Factory refuses in its words — an import is made again where it was made.
  k = kernel(() => factoryRefusal(REAL.remake_import_refused))
  try {
    const refused = await songs.remakeSong(k.transport, songs.songsOf(GATHERED).groups[1].songs[0])
    assert.equal(refused.ok, false)
    assert.ok(refused.error.includes(REAL.remake_import_refused.error.message.slice(0, 40)), refused.error)
  } finally { k.restore() }
  stop()
})

// The session the song is dropped on (FIXTURE, owner-shaped): its task serves one attempt of the taker's Run, on eros-verify.
const TASK = 'task:01M6SONGTAKER0000000000'
const UNIT = REAL.score_after.units.find(unit => unit.key === 'eros-verify').unitRef
const ATTEMPTS = {schema: 'aikit.encounter-task-attempts-list/v1', readings: [{schema: 'aikit.encounter-task-attempts/v1', agent_session: 'ses-eros',
  revision: 'task-attempts/ONE', task_ref: TASK, earlier: [], attempts: [{task_ref: TASK, attempt_ref: 'attempt:A1', run_ref: REAL.score_after.runRef,
    state_path: TAKER, workflow_unit: UNIT, execution_ref: 'execution:A1', delivery_ref: 'delivery:A1', recorded_by: 'factory', recorded_at_unix_ms: 1_000}]}]}
const RUN_READING = {contract: 'factory.attempt-reading/v1', revision: 3, runRef: REAL.score_after.runRef, attempts: [{attemptRef: 'attempt:A1', taskRef: TASK,
  workflowUnitRef: UNIT, reservedExecutionRef: 'reserved:A1', failureEvidenceRefs: [], observations: [], verifications: [], attemptRecordedAt: '2026-11-03T20:00:00Z',
  executionRef: 'execution:A1'}]}
const ownersOfTheDrop = edit => op => op.op === 'encounter_task_attempts_list' ? {result: 'encounter_task_attempts_list_reading', data: ATTEMPTS, receipts: []}
  : op.op === 'factory_attempt_read' ? {result: 'factory_attempt_reading', data: RUN_READING, receipts: []}
    : op.op === 'factory_owner' && op.request.kind === 'workflow-score-read' ? factoryAnswer(REAL.score_after)
      : op.op === 'factory_owner' && op.request.kind === 'workflow-edit' ? edit(op) : new Error(`unexpected ${op.op}`)

test('a song\'s clip dropped on a session\'s track, from another project, is one unit of that session\'s song with the thread form canon', async () => {
  const songs = await import('../src/agent/songClips.ts')
  const row = songs.songsOf(GATHERED).groups[0].songs.find(item => item.name === 'release-check')
  const payload = songs.songOfPayload(songs.songPayload(row))
  assert.deepEqual(payload, {clipRef: 'factory-song:song-maker/release-check', path: '/walk/maker/.factory/songs/release-check.song.json', name: 'release-check'})
  assert.equal(songs.songOfPayload('central:constellation:control:root:release'), null, 'a constellation\'s ref is no song')
  assert.equal(songs.songOfPayload('{"clipRef":"workflow:nope","path":"/x","name":"x"}'), null)
  const track = {sessionRef: 'ses-eros', label: 'Eros', agentRef: 'agent/anima-eros', project: 'song-taker'}
  let k = kernel(ownersOfTheDrop(() => factoryAnswer(REAL.canon_receipt)))
  try {
    const answer = await songs.dropSong(k.transport, track, payload)
    assert.deepEqual(k.ops.map(op => op.op === 'factory_owner' ? op.request.kind : op.op),
      ['encounter_task_attempts_list', 'factory_attempt_read', 'workflow-score-read', 'workflow-edit'], 'the song the session\'s Run performs, read, then edited')
    assert.equal(k.ops[0].project, 'song-taker')
    const edit = k.ops[3].request
    assert.deepEqual([edit.state_path, edit.run_ref], [TAKER, REAL.score_after.runRef])
    assert.deepEqual(edit.request, {contract: 'factory.workflow-edit/v1', expectedRevision: REAL.score_after.song.file.byteRevision,
      edits: [{op: 'canon', clip: payload.path, to: {kind: 'agent', ref: 'agent/anima-eros'}}]}, 'compare-and-swap on the byte revision Factory read, given to the track\'s agent')
    assert.equal(answer.ok, true)
    assert.match(answer.note, /^release-check is a task of Eros's song with the thread form canon \(release-check\); this project keeps an import of factory-song:song-maker\/release-check/)
  } finally { k.restore() }
  // The song's file changed since it was read (REAL): Factory's words, and the song stands as it was.
  k = kernel(ownersOfTheDrop(() => factoryRefusal(REAL.canon_stale_refused)))
  try {
    const stale = await songs.dropSong(k.transport, track, payload)
    assert.equal(stale.ok, false)
    assert.match(stale.error, /The song's file changed since it was read/)
  } finally { k.restore() }
  assert.equal((await songs.dropSong({kind: 'bridge', url: 'x'}, {...track, agentRef: null}, payload)).error, songs.DROP_NO_AGENT)
  // The maker Factory's set carries takes the song's drag beside the constellation's, and hands it to the drop.
  const clip = await import('../src/agent/clipBinding.ts')
  const {trackKey} = await import('../src/agent/agentRunModel.ts')
  const eros = {sessionRef: 'ses-eros', purpose: null, agentRef: 'agent/anima-eros', agentName: 'Eros', agentAccepted: true, spaceRef: null, spaceLabel: null, depth: 0,
    parentRef: null, group: false, memberRefs: [], tasks: [], needle: null, telemetryOn: true, budget: {used: null, max: null}, disclosure: null, project: 'song-taker'}
  const dropped = []
  const maker = clip.taskMaker({kind: 'bridge', url: 'x'}, [eros], () => null, async (_transport, on, song) => { dropped.push([on, song]); return {ok: true} })
  assert.deepEqual(maker.alsoAccepts, [songs.SONG_CLIP_DRAG])
  assert.deepEqual(await maker.run(trackKey(eros), songs.songPayload(row)), {ok: true})
  assert.deepEqual(dropped, [[{sessionRef: 'ses-eros', label: 'Eros', agentRef: 'agent/anima-eros', project: 'song-taker'}, payload]])
  assert.match((await maker.run('elsewhere', songs.songPayload(row))).error, /Only a session's track takes a song's clip/)
  assert.match((await maker.run(trackKey(eros), 'central:constellation:nope')).error, /no constellation the wiki's reading holds/, 'a constellation stays the constellation\'s')
})

test('the score draws the dropped clip as one note with the thread form canon, its song inside it, which a double-click opens', async () => {
  const score = await import('../src/agent/scoreBinding.ts')
  const {loadClip} = await import('../src/inhabitants/catalogue/clips/index.ts')
  const target = {statePath: TAKER, runRef: REAL.score_after.runRef, unitRef: REAL.score_after.units.find(unit => unit.key === 'eros-verify').unitRef}
  const values = score.scoreValuesOf({state: 'read', reading: REAL.score_after, target}, [], null)
  const drawn = JSON.parse(values.score)
  const canon = drawn.units.find(unit => unit.key === 'release-check')
  assert.equal(canon.heads.CFP, 'CFP5', 'the thread form canon')
  assert.equal(canon.row, 'agent/anima-eros')
  assert.equal(canon.song.name, 'development-and-knowledge')
  assert.deepEqual(canon.song.units.map(unit => unit.key), REAL.score_after.units.find(unit => unit.key === 'release-check').song.units.map(unit => unit.key),
    'the clip\'s units, as Factory rendered them')
  assert.equal(drawn.units.find(unit => unit.key === 'eros-verify').song, undefined, 'a unit that is no canon holds no song')
  // A clip whose own units hold a canon draws it inside, as deep as Factory rendered it.
  const nested = score.songScoreOf({workflowKey: 'outer', rows: [], units: [{key: 'inner', form: 'canon', heads: {}, song: {workflowKey: 'inner-song', rows: [], units: [{key: 'leaf'}]}}]})
  assert.deepEqual([nested.units[0].heads.CFP, nested.units[0].song.name, nested.units[0].song.units[0].key], ['CFP5', 'inner-song', 'leaf'])
  const design = await loadClip('factory')
  const notes = design.editor.find(tab => tab.id === 'notes')
  const draw = v => renderToStaticMarkup(createElement(notes.draw, {v, set: noop, standing: {}, size: 'detail', room: {w: 900, h: 360}}))
  const outer = draw(values)
  assert.ok(outer.includes('release-check'), 'the canon note stands on its row')
  const opened = draw({...values, 'score.open': 'release-check'})
  assert.ok(opened.includes('Back to development-and-knowledge'), 'opened, the song inside it is the score shown, and Back returns')
})

test('File › Export Song… is a command of the menu bar, answered by Factory\'s Clip view; Songs stands under Factory\'s Material; Packs says what it waits for', async () => {
  const {MENU_COMMANDS} = await import('../src/frame/menu/commandDoor.ts')
  const {MENU_ACCELERATORS} = await import('../src/central/searchLineModel.ts')
  assert.equal(MENU_COMMANDS['file.export.song'], 'Export Song…')
  assert.equal(MENU_ACCELERATORS['file.export.song'], null)
  const binding = await source('../src/agent/clipBinding.ts')
  assert.match(binding, /window\.addEventListener\(MENU_ACT, act\)/)
  assert.match(binding, /detail\?\.id !== 'file\.export\.song'\) return\s+event\.preventDefault\(\)/, 'Factory\'s Clip view answers it; another mode leaves it to the status bar')
  const {browserSourcesOf} = await import('../src/shell/modeBrowsers.tsx')
  const {SURF_MODES} = await import('../src/shell/modeGrammar.ts')
  const factory = browserSourcesOf('factory').flatMap(item => item.categories.map(category => ({...category, source: item.id})))
  const songsCategory = factory.find(category => category.id === 'songs')
  assert.deepEqual([songsCategory.source, songsCategory.label, songsCategory.kind], ['songs', 'Songs', 'material'])
  for (const mode of SURF_MODES) {
    const places = browserSourcesOf(mode).flatMap(item => item.categories).filter(category => category.kind === 'place')
    assert.deepEqual(places.map(category => category.id), ['you', 'agents', 'machines', 'work', 'packs'], `${mode}: the five places`)
  }
  const {PLACES, PACKS_WAIT} = await import('../src/frame/browser/places.ts')
  const packs = PLACES.find(place => place.id === 'packs')
  assert.equal(packs.label, 'Packs')
  assert.match(packs.hint, /^what you installed together: racks with their agents on their chains, songs, and the practice they carry/)
  assert.match(PACKS_WAIT.said, /No owner lists what you installed together yet/)
  assert.match(PACKS_WAIT.waitsFor, /owner read of installed packs/)
  const rows = await source('../src/frame/browser/PlaceRows.tsx')
  assert.match(rows, /refused: \{said: PACKS_WAIT\.said, error: PACKS_WAIT\.waitsFor\}/, 'the place stands refused through the one Refusal pattern')
})

test('the Songs rows: grouped by project, each draggable as its clip, a refusal in Factory\'s words, the selected clip previewed with Remake', async () => {
  const songs = await import('../src/agent/songClips.ts')
  const {SongRowsView} = await import('../src/agent/SongRows.tsx')
  const reading = songs.songsOf(GATHERED)
  const selected = reading.groups[0].songs.find(row => row.name === 'release-check')
  const markup = renderToStaticMarkup(createElement(SongRowsView, {reading, query: '', selected, onSelect: noop, onRemake: noop}))
  for (const words of ['song-maker', 'song-taker', 'eros-part', 'imported', 'Broken']) assert.ok(markup.includes(words), words)
  assert.equal((markup.match(/draggable="true"/g) ?? []).length, 3, 'every clip with a ref drags')
  assert.match(markup, /data-song="factory-song:song-maker\/release-check"[^>]*data-standing="current"/)
  assert.match(markup, /aria-pressed="true"[^>]*data-song="factory-song:song-maker\/release-check"/)
  assert.match(markup, /class="native-error" role="alert"><p class="oi-refusal-line">Factory did not list Broken(&#x27;|')s songs: factory workflow songs: the developmental state is unreadable\.<\/p>/,
    'Factory\'s refusal through the Refusal pattern, said once')
  assert.ok(renderToStaticMarkup(createElement(SongRowsView, {reading, query: 'eros', selected: null, onSelect: noop, onRemake: noop})).includes('eros-part'))
  assert.doesNotMatch(renderToStaticMarkup(createElement(SongRowsView, {reading, query: 'eros', selected: null, onSelect: noop, onRemake: noop})), /data-song="factory-song:song-maker\/release-check"/)
  assert.match(renderToStaticMarkup(createElement(SongRowsView, {reading: null, query: '', selected: null, onSelect: noop, onRemake: noop})), /Reading your songs…/)
  const refused = renderToStaticMarkup(createElement(SongRowsView, {reading, query: '', selected, onSelect: noop, onRemake: noop,
    remade: {ok: false, error: REAL.remake_import_refused.error.message}}))
  assert.match(refused, /Remake did not make the song again\./)
  // The selection is the browser's own: the Capture page reads it.
  songs.selectSongClip(selected)
  assert.equal(songs.songClipFocus(), selected)
  songs.selectSongClip(null)
})

test('Capture, Source › A clip: the selected song\'s clip is captured as a Method through AIKit, waits in the inbox, and Accept keeps it', async () => {
  const capture = await import('../src/agent/devices/captureSkillBinding.ts')
  const bind = await import('../src/agent/devices/designBindings.ts')
  const routes = await import('../src/agent/devices/ownerRoutes.ts')
  bind.resetHolds()
  // The clip selected under Songs, as the page takes it: its name, its ref and the clip Factory wrote (REAL, the maker's listing).
  const listed = REAL.songs_maker.songs.find(row => row.name === 'release-check')
  const song = {name: listed.name, clipRef: listed.clipRef, clip: listed.clip}
  const inbox = {status: 'answered', value: {items: []}, error: null}
  const asked = []
  const ports = {promote: async () => ({}), capture: async request => { asked.push(request) }}
  const binding = capture.captureSkillBinding({inbox, holds: bind.chainHolds(), song}, ports)
  assert.equal(binding.local.source, undefined, 'Source goes through the write: choosing A clip captures')
  assert.equal(binding.writes('source'), true)
  await binding.write([{key: 'source', value: 'minutes'}])
  assert.deepEqual(asked, [], 'the last minutes capture nothing from here')
  await binding.write([{key: 'source', value: 'clip'}])
  assert.equal(asked.length, 1)
  assert.deepEqual({...asked[0], body: JSON.parse(asked[0].body)}, {title: 'release-check', body: song.clip, scope: 'project', sourceRef: 'factory-song:song-maker/release-check'})
  assert.equal(capture.captureSkillBinding({inbox, holds: bind.chainHolds(), song}, ports).values.source, 'clip', 'the choice is held')
  bind.holdView(capture.CAPTURE_SKILL_ID, 'name', 'release-gate')
  bind.holdView(capture.CAPTURE_SKILL_ID, 'scope', 'home')
  await capture.captureSkillBinding({inbox, holds: bind.chainHolds(), song}, ports).write([{key: 'source', value: 'clip'}])
  assert.deepEqual([asked[1].title, asked[1].scope], ['release-gate', 'home'], 'the hand\'s Name and Scope')
  // Refused in the page's words: no clip selected, a Skill, no carrier.
  await assert.rejects(capture.captureSkillBinding({inbox, holds: bind.chainHolds(), song: null}, ports).write([{key: 'source', value: 'clip'}]), {message: capture.CAPTURE_SONG.none})
  assert.equal(capture.captureSkillBinding({inbox, holds: bind.chainHolds(), song: null}, ports).standing.clip.disabled, capture.CAPTURE_SONG.none)
  bind.holdView(capture.CAPTURE_SKILL_ID, 'form', 'skill')
  await assert.rejects(capture.captureSkillBinding({inbox, holds: bind.chainHolds(), song}, ports).write([{key: 'source', value: 'clip'}]), {message: capture.CAPTURE_SONG.skill})
  bind.holdView(capture.CAPTURE_SKILL_ID, 'form', 'method')
  await assert.rejects(capture.captureSkillBinding({inbox, holds: bind.chainHolds(), song}, {}).write([{key: 'source', value: 'clip'}]), {message: capture.CAPTURE_SONG.carrier})
  // AIKit filed it (REAL): a Method that waits — the inbox's newest open candidate, Ready — and Accept promotes it.
  assert.deepEqual([REAL.aikit_capture.data.kind, REAL.aikit_capture.data.proposed_id, REAL.aikit_capture.data.source_ref ?? REAL.aikit_capture.data.song.clip],
    ['skill', 'skill/project/method-release-check', 'factory-song:song-maker/release-check'])
  bind.resetHolds()
  const promoted = []
  const waiting = capture.captureSkillBinding({inbox: {status: 'answered', value: REAL.aikit_inbox.data, error: null}, holds: bind.chainHolds(), song},
    {promote: async (candidate, id) => { promoted.push([candidate, id]) }, capture: async () => {}})
  assert.deepEqual([waiting.values.proposal, waiting.values.name], ['ready', 'skill/project/method-release-check'])
  await waiting.write([{key: 'accept', value: true}])
  assert.deepEqual(promoted, [[REAL.aikit_capture.data.candidate, 'skill/project/method-release-check']])
  assert.equal(REAL.aikit_promote.data.id, 'skill/project/method-release-check', 'AIKit kept it under that id (REAL)')
  // Through the kernel: aikit_write capture with from_song, the clip on stdin.
  const k = kernel(() => ({result: 'owner_route_reading', route: 'aikit capture', data: REAL.aikit_capture.data, receipts: []}))
  try {
    await routes.ownerRouteWrite(k.transport, routes.aikitWriteOp({kind: 'capture', project: 'song-maker', title: 'release-check', body: JSON.stringify(song.clip),
      scope: 'project', source_ref: song.clipRef, by: 'human', from_song: true}), '`aikit capture --from-song`')
    assert.equal(k.ops[0].request.from_song, true)
  } finally { k.restore() }
  const chain = await source('../src/agent/devices/FactoryDeviceChain.tsx')
  assert.match(chain, /aikitWriteOp\(\{kind: 'capture', project: register, title, body, scope, source_ref: sourceRef, by: 'human', from_song: true\}\)/)
  assert.match(chain, /song: captureSong\}/, 'the page reads the clip selected under Material › Songs')
  bind.resetHolds()
})
