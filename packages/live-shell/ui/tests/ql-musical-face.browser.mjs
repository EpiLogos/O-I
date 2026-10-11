import assert from 'node:assert/strict'
import {mkdir, writeFile} from 'node:fs/promises'
import {join, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'

// The L9 musical-family acceptance walk — scripted playwright (computer use
// is blocked machine-wide; every capture is channel-labelled). It exercises
// the REAL additive path:
//   1. the quaternal-logic family WITH the L9 declared extension, rendered by
//      the inhabitant rack — the ql-instrument face DOCKED, first with no
//      owner reading (the honest refusing state naming the launch contract),
//      then bound to an owner-shaped fixture reading (labelled: shaped like
//      the native contracts — NOT a live owner);
//   2. both QL track adapters rendering on the Timeline projection's
//      arrangement presentation, through the same World-cut presentation the
//      L4 cut renders;
//   3. the sample-clock stratum's mapping demonstrated on-page (declared
//      table rows, an anchor conversion, the spine chronos binding).
// No native effects, no audio, no sounding claim anywhere.

const {
  bundleEntry, serveShellPage, launchShell, ui, inlineModuleSafe,
} = await import('./support/agentShellHarness.mjs')
const EVIDENCE = process.argv.includes('--evidence')
  ? resolve(ui, process.argv[process.argv.indexOf('--evidence') + 1])
  : '/Users/admin/Central/Work/reverse-engineering/2026-10-07-techne-instrument-re/new-shell/evidence/musical-family-l9-20261009/captures'

const entry = `
import {createRoot} from 'react-dom/client'
import {loadWorldShellFamilies} from './src/inhabitants/worldShellFamilies'
import {inhabitantManifest} from './src/inhabitants/manifest'
import {InhabitantRack} from './src/inhabitants/inhabitantRack'
import {TimelineProjectionResidence} from './src/projections/timelineResidence'
import {createTimeSpine} from './src/timeline/timeSpine'
import {projectQlAudioTracks} from './src/timeline/qlAudioTrackAdapter'
import {projectQlPhysicsTracks} from './src/timeline/qlPhysicsTrackAdapter'
import {createQlSampleClockStratum} from './src/timeline/qlSampleClock'

loadWorldShellFamilies()
window.__marker = 'capture-entry-evaluated'

// An owner-shaped fixture reading — the retained shapes (controller.ts
// standing + instrument-session reading + native-audio receipt), disclosed
// as a fixture: shaped like the native contracts, not a live owner.
const fixtureReading = {
  schema: 'ql.instrument-reading/v1',
  standing: 'following',
  reason: null,
  identity: {
    event_ref: 'fixture:occasion', subject_ref: 'fixture:subject',
    registry_revision: 'fixture:registry', geometry_ref: 'fixture:geometry',
    material_ref: 'fixture:material', model_ref: 'fixture:model',
  },
  acknowledged: {generation: '4', samples_elapsed: '245760'},
  presented: {generation: '4', samples_elapsed: '245760'},
  audio: {
    schema: 'ql.native-audio-receipt/v1', device_epoch: 0, device_sample_rate: 48000,
    native_origin: '0', context_origin_seconds: 0.5, observed_context_seconds: 0.61,
    target_context_seconds: 5.62, status: 'scheduled', muted: true, presentation_gain: 0.1,
    scheduled_blocks: 6, discarded_blocks: 1, reason: null, interval: null,
    standing: 'native PCM scheduled on a browser audio graph; not proof of physical speaker output (fixture reading)',
  },
  available: true, held: false, in_flight: false, queued_blocks: 3, queued_bytes: 4096,
  coalesced_presentation_frames: 0, views: 1, disposed: false,
  playback_policy: {blockFrames: 8192, leadSeconds: 0.5, lookaheadSeconds: 0.5, owner: 'fixture (embedded policy values)'},
}

const params = new URLSearchParams(location.search)
const reading = params.get('reading') === 'fixture' ? fixtureReading : null

// Role-classified material for the two adapters (spans in native samples —
// the owner's cursor domain; the adapter converts through the declared table).
const audioSet = projectQlAudioTracks({
  sampleRate: 48000,
  columns: [{id: 'composition-1', name: 'Composition 1'}],
  presentedColumnId: 'composition-1',
  lanes: [
    {id: 'torus-voice', name: 'Torus voice', role: 'resonator',
      clips: [{id: 'a1', label: 'excited body', start_sample: '0', end_sample: '48000', standing: 'fact'}]},
    {id: 'flyby', name: 'Moving source', role: 'emitter',
      clips: [{id: 'a2', label: 'flyby', start_sample: '48000', end_sample: '96000', standing: 'planned'}]},
  ],
  takes: [{id: 'take-1', target: 'ql-audio:torus-voice', operation: 'record'}],
})
const physicsSet = projectQlPhysicsTracks({
  columns: [{id: 'composition-1', name: 'Composition 1'}],
  presentedColumnId: 'composition-1',
  lanes: [
    {id: 'chladni', name: 'Chladni plate', role: 'resonator', spanUnit: 'seconds',
      clips: [{id: 'p1', label: 'plate modes', start: 0, end: 2.5, standing: 'fact'}]},
    {id: 'glyph', name: 'Glyph motion', role: 'visual-only', spanUnit: 'm1-ticks',
      clips: [{id: 'p2', label: 'glyph drift', start: 0, end: 12}]},
    {id: 'contact', name: 'Contacts', role: 'collision-trigger', spanUnit: 'engine-blocks',
      clips: [{id: 'p3', label: 'strike', start: 1, end: 2, standing: 'planned'}]},
  ],
})

// The sample-clock stratum, bound read-only into the spine; the mapping is
// demonstrated with the SAME declared rows the adapters ride.
const stratum = createQlSampleClockStratum()
const spine = createTimeSpine()
const chronos = stratum.bindToSpine(spine, () => reading)
const anchor = {
  samples_elapsed: '240000', atUnixMs: Date.UTC(2026, 9, 9, 12, 0, 0),
  m1: {tick12: 0, cycle: 3}, m3: {inscription_ref: '#3-fixture'},
  sky: {epoch: '1913-01-01T00:00:00Z'}, source: 'fixture owner read',
}
const demonstration = {
  mapping_rows: stratum.mappings.map(row => \`\${row.from} -> \${row.to} (via \${row.via})\`),
  samples_to_seconds: stratum.samplesToSeconds('245760'),
  samples_to_m1_phase: stratum.samplesToM1Phase(24000, {id: 'user', ticksPerSecond: 12, source: 'PPS user-facing tick, 12 per second'}),
  instant_at_samples: stratum.instantAtSamples('288000', anchor),
  civil_day: null,
  sky_occasion: stratum.skyOccasionAt(anchor),
  inscription: stratum.inscriptionAt(anchor),
  chronos_read: chronos.read(),
  transport_take_seed: audioSet.transport.takes[0].name,
}
demonstration.civil_day = demonstration.instant_at_samples.ok
  ? stratum.civilDayAt(demonstration.instant_at_samples.value) : null
window.__demonstration = demonstration

const transport = {kind: 'unavailable', reason: 'scripted capture (no kernel transport in this harness)'}
const world = {
  source: {
    status: 'live', error: null,
    now: {instantUnixMs: Date.UTC(2026, 9, 9, 12, 0, 0), dayRef: '2026-10-09', source: 'capture fixture (no kernel read)'},
    events: [],
    sets: [audioSet, physicsSet],
    eventByClipId: new Map(),
    admittedRuns: [],
    admittedRunsError: null,
    readAtUnixMs: Date.UTC(2026, 9, 9, 12, 0, 0),
    readCadence: null,
  },
  spine,
  selectOccasion: () => {},
}

function Harness() {
  const mode = params.get('view') === 'timeline' ? 'timeline' : 'rack'
  return (
    <div style={{height: '100vh', overflow: 'auto', background: '#16181c'}}>
      {mode === 'rack'
        ? <InhabitantRack manifests={[inhabitantManifest('quaternal-logic')]} transport={transport}
            instrumentReading={reading}/>
        : <TimelineProjectionResidence set={null} document={null}
            selection={{track: 0, scene: null}} select={() => {}}
            colors={[]} setColor={() => {}}
            session={undefined} arrangement={undefined}
            compactTransport={false} presented="arrangement" world={world}/>}
      <pre data-sample-clock-demonstration style={{color: '#8a8f98', fontSize: 11, padding: 12}}>
        {JSON.stringify(demonstration, null, 2)}
      </pre>
    </div>
  )
}
createRoot(document.getElementById('root')).render(<Harness/>)
`

const html = await (async () => {
  const {js, css} = await bundleEntry({
    contents: entry,
    resolveDir: ui,
    sourcefile: 'ql-musical-face-harness.tsx',
    outfile: 'ql-musical-face-harness.mjs',
  })
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css}
html,body,#root{height:100%;margin:0;background:#16181c}
</style></head><body><div id="root"></div><script type="module">${inlineModuleSafe(js)}</script></body></html>`
})()

const steps = []
const record = {
  schema: 'oi.ql-musical-face-walk/v1',
  lane: 'zcode:musical-family-l9',
  recorded_at: new Date().toISOString(),
  channel: 'scripted playwright (computer use blocked machine-wide); every capture channel-labelled',
  url: null,
  steps,
  honesty: [
    'the docked-owner capture is a FIXTURE reading shaped exactly like the native contracts (standing/identity/cursors/receipt) — not a live owner; the shell host supplies no authorised oi.native-expression/v1 channel yet',
    'the timeline capture renders the two adapters\' OWN projections (role-classified material) through the L4 World-cut presentation — no kernel read is mocked',
    'no sounding claim: the audio receipt line carried on the face says what the binding itself says',
  ],
}

await mkdir(EVIDENCE, {recursive: true})
const page_ = await serveShellPage({html, kernelBridge: 'http://127.0.0.1:9'})
record.url = page_.url
const {browser, page, browserErrors, pageErrors} = await launchShell({width: 1600, height: 950})

async function shot(name) {
  const path = join(EVIDENCE, name)
  await page.screenshot({path})
  return path
}

try {
  // ── step 1: docked with NO owner reading — the honest refusing state ────
  await page.goto(`${page_.url}/?view=rack`, {waitUntil: 'domcontentloaded'})
  const face = page.locator('[data-face-id="ql-instrument"]')
  try {
    await face.waitFor({timeout: 20000})
  } catch (error) {
    const body = await page.locator('body').innerText().catch(() => '(no body)')
    const marker = await page.evaluate('window.__marker ?? "(none)"').catch(() => '(eval failed)')
    console.error('[ql-musical-face] face not visible; marker:', marker, '| body so far:', body.slice(0, 800).replace(/\n/g, ' | '))
    await writeFile('/tmp/l9-capture-page.html', html)
    console.error('[ql-musical-face] served page written to /tmp/l9-capture-page.html')
    throw error
  }
  await face.locator('[data-action="expand"]').click()
  await page.locator('[data-ql-instrument][data-state="refusing"]').waitFor({timeout: 15000})
  const refusingText = await page.locator('[data-ql-instrument][data-state="refusing"]').innerText()
  assert.match(refusingText, /ql-field-host/, 'the refusing state names the owner that would start')
  assert.match(refusingText, /OI_QL_FIELD_HOST_BIN/, 'the refusing state names the executable bindings')
  assert.match(refusingText, /native-expression owner/, 'the refusing state names the real launcher (the kernel)')
  assert.match(refusingText, /Tauri gate still lacks/, 'the gate gaps are disclosed in the face')
  const capture1 = await shot('01-ql-instrument-docked-refusing.png')
  steps.push({
    name: 'the instrument face docked with no owner reading renders the honest refusing state (launch contract disclosed, gate gaps named)',
    capture: capture1,
  })

  // ── step 2: docked with the fixture owner reading — real standing states ─
  await page.goto(`${page_.url}/?view=rack&reading=fixture`, {waitUntil: 'domcontentloaded'})
  await face.waitFor({timeout: 20000})
  await face.locator('[data-action="expand"]').click()
  const docked = page.locator('[data-ql-instrument][data-state="following"]')
  await docked.waitFor({timeout: 15000})
  const dockedText = await docked.innerText()
  assert.match(dockedText, /following/, 'the owner standing renders')
  for (const ref of ['fixture:occasion', 'fixture:subject', 'fixture:registry', 'fixture:geometry', 'fixture:material', 'fixture:model']) {
    assert.ok(dockedText.includes(ref), `identity tuple ref renders: ${ref}`)
  }
  assert.match(dockedText, /245760/, 'the exact sample cursor renders')
  assert.match(dockedText, /5\.120 s/, 'the work-time readout shows samples → seconds through the declared mapping')
  assert.match(dockedText, /8192/, 'the embedded playback policy renders')
  const meters = await docked.locator('.ql-instrument-meter').count()
  assert.equal(meters, 3, 'the three scheduling meters render (scheduled · discarded · queued)')
  assert.match(dockedText, /not proof of physical speaker output/, 'the owner\'s honesty line is carried verbatim')
  assert.match(dockedText, /Scheduling meters only/, 'the meters name themselves scheduling-only: no level or loudness surface is claimed')
  const capture2 = await shot('02-ql-instrument-docked-owner-standing-fixture.png')
  steps.push({
    name: 'the instrument face docked with the fixture owner reading: real standing states (following), identity tuple, exact cursors, work-time through the declared mapping, scheduling-only meters',
    detail: 'fixture reading — shaped like the native contracts, not a live owner',
    capture: capture2,
  })

  // ── step 3: both adapters on the Timeline (arrangement presentation) ────
  await page.goto(`${page_.url}/?view=timeline&reading=fixture`, {waitUntil: 'domcontentloaded'})
  await page.locator('.world-timeline.wt-arrangement').waitFor({timeout: 20000})
  const audioGroup = await page.locator('.wt-arrangement .wt-group-head', {hasText: 'QL · audio'}).count()
  const physicsGroup = await page.locator('.wt-arrangement .wt-group-head', {hasText: 'QL · physics'}).count()
  assert.equal(audioGroup, 1, 'the QL audio group renders')
  assert.equal(physicsGroup, 1, 'the QL physics group renders')
  const audioRows = await page.locator(".wt-arrangement .wt-row[data-track-row^='ql-audio:']").count()
  const physicsRows = await page.locator(".wt-arrangement .wt-row[data-track-row^='ql-physics:']").count()
  assert.equal(audioRows, 2, 'the resonator and emitter lanes render')
  assert.equal(physicsRows, 3, 'the resonator, visual-only and collision-trigger lanes render')
  const audioClips = await page.locator(".wt-arrangement .wt-row[data-track-row^='ql-audio:'] .wt-clip").count()
  const physicsClips = await page.locator(".wt-arrangement .wt-row[data-track-row^='ql-physics:'] .wt-clip").count()
  assert.equal(audioClips, 2, 'both audio clips place')
  assert.equal(physicsClips, 3, 'all three physics clips place')
  const ghostClip = page.locator(".wt-arrangement .wt-row[data-track-row^='ql-physics:glyph'] .wt-clip").first()
  assert.match(await ghostClip.innerText(), /visual-only/, 'the visual-only glyph keeps its honest standing on the Timeline')
  const capture3 = await shot('03-ql-audio-and-physics-adapters-on-timeline.png')
  steps.push({
    name: 'both adapters render on the Timeline: QL · audio (resonator + emitter lanes) and QL · physics (resonator + visual-only + collision-trigger), role standing carried on every clip',
    capture: capture3,
    assertions: {audioGroup, physicsGroup, audioRows, physicsRows, audioClips, physicsClips},
  })

  // ── step 4: the sample-clock mapping demonstration ───────────────────────
  const demonstration = await page.evaluate('window.__demonstration')
  assert.equal(demonstration.samples_to_seconds.ok, true)
  assert.equal(demonstration.samples_to_seconds.value, 5.12, '245760 samples @ 48 kHz = 5.12 s (declared row)')
  assert.equal(demonstration.samples_to_m1_phase.value.tick12, 6, '0.5 s on the declared 12/s cadence = M1 tick12 6')
  assert.equal(demonstration.instant_at_samples.ok, true, 'samples → civil instant through the measured anchor')
  assert.match(demonstration.civil_day, /^2026-10-09/, 'the civil day derives through the spine\'s own law')
  assert.match(demonstration.sky_occasion.subject_ref, /ql:sky-occasion:1913/, 'the sky occasion retains its epoch basis')
  assert.equal(demonstration.inscription.ok, true, 'the inscription maps by owner event (anchor state)')
  assert.match(demonstration.chronos_read, /samples_elapsed 245760 @ 48000 Hz/, 'the spine chronos binding reads the owner cursor')
  assert.match(demonstration.transport_take_seed, /performance-recording seed/, 'the take machinery is named as the performance-recording seed')
  assert.equal(demonstration.mapping_rows.length, 7, 'the one declared mapping table carries its rows')
  await page.locator('[data-sample-clock-demonstration]').scrollIntoViewIfNeeded()
  const capture4 = await shot('04-sample-clock-mapping-demonstration.png')
  steps.push({
    name: 'the sample-clock stratum: one declared table (7 rows), samples→seconds, samples→M1 phase (declared cadence), samples→civil day (measured anchor), sky occasion basis, inscription by event, spine chronos binding, take seed',
    capture: capture4,
    demonstration,
  })
} finally {
  const errors = {browserErrors: browserErrors.slice(0, 10), pageErrors: pageErrors.slice(0, 10)}
  await browser.close().catch(() => {})
  record.errors = errors
  record.steps = steps
  await writeFile(join(EVIDENCE, 'ql-musical-face-walk.json'), JSON.stringify(record, null, 2))
}

assert.equal(record.errors.pageErrors.length, 0, 'no page errors during the walk')
console.log(JSON.stringify({steps: steps.map(step => ({name: step.name, capture: step.capture})), errors: record.errors}, null, 2))
console.log('evidence: ' + EVIDENCE)
// The throwaway page server keeps the event loop alive; the walk is done.
process.exit(0)
