import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

// The L4 World-cut acceptance walk — scripted playwright (computer use is
// blocked machine-wide; every capture is channel-labelled). The Timeline
// projection's World cut is exercised through the REAL additive path:
// TimelineProjectionResidence → SessionView/ArrangementView with the
// `world` prop, over the LIVE walk-bridge's kernel temporal read. No
// synthetic history: what the tracks show is what the kernel read returned.
//
// Usage: node tests/timeline-world-cut.browser.mjs [--evidence <dir>]

const {
  bundleEntry, serveShellPage, launchShell, postOp, ui,
} = await import('./support/agentShellHarness.mjs');

const BRIDGE = process.env.OI_KERNEL_BRIDGE ?? 'http://127.0.0.1:4179';
// The programme tree: walk up from the ui package until a ground holding
// Work/reverse-engineering/<programme> exists (never an absolute guess).
const {existsSync} = await import('node:fs');
const {dirname} = await import('node:path');
let programme = null;
for (let dir = ui; ; dir = dirname(dir)) {
  const candidate = join(dir, 'Work', 'reverse-engineering', '2026-10-07-techne-instrument-re');
  if (existsSync(candidate)) { programme = candidate; break; }
  const parent = dirname(dir);
  if (parent === dir) break;
}
if (!programme) throw new Error('the programme tree (Work/reverse-engineering/2026-10-07-techne-instrument-re) was not found from ' + ui);
const EVIDENCE = process.argv.includes('--evidence')
  ? resolve(ui, process.argv[process.argv.indexOf('--evidence') + 1])
  : join(programme, 'new-shell', 'evidence', 'timeline-spine-l4-20261009', 'captures');

const bridgeUp = await (async () => {
  try {
    const reply = await postOp(BRIDGE, {op: 'harness_status'}, 8000);
    return {up: true, refused: reply.error ?? null};
  } catch (error) {
    return {up: false, reason: String(error)};
  }
})();

const entry = `
import {createRoot} from 'react-dom/client'
import {useMemo} from 'react'
import {TimelineProjectionResidence} from './src/projections/timelineResidence'
import {useWorldTemporalReading} from './src/projections/useWorldTemporalReading'

function WorldCutHarness() {
  const params = new URLSearchParams(location.search)
  const presentation = params.get('presentation') === 'session' ? 'session' : 'arrangement'
  const transport = useMemo(() => ({kind: 'bridge', url: params.get('bridge')}), [])
  const world = useWorldTemporalReading(transport)
  return (
    <div style={{height: '100vh'}}>
      <TimelineProjectionResidence
        set={null} document={null}
        selection={{track: 0, scene: null}} select={() => {}}
        colors={[]} setColor={() => {}}
        session={undefined} arrangement={undefined}
        compactTransport={false}
        presented={presentation}
        world={world}
      />
    </div>
  )
}

createRoot(document.getElementById('root')).render(<WorldCutHarness />)
`;

const {js, css} = await bundleEntry({
  contents: entry,
  resolveDir: ui,
  sourcefile: 'timeline-world-cut-harness.tsx',
  outfile: 'timeline-world-cut-harness.mjs',
});
const html = `<!doctype html><html><head><meta charset="utf-8"><style>${css}
html,body,#root{height:100%;margin:0;background:#16181c}
</style></head><body><div id="root"></div><script type="module">${js.replace(/<\/script/g, '<\\/script')}</script></body></html>`;

const steps = [];
const record = {
  schema: 'oi.timeline-world-cut-walk/v1',
  lane: 'zcode:timeline-spine-l4',
  recorded_at: new Date().toISOString(),
  channel: 'scripted-playwright (computer use blocked machine-wide)',
  bridge: BRIDGE,
  bridge_up: bridgeUp.up,
  bridge_note: bridgeUp.up
    ? 'the walk-bridge was already running; not restarted. harness_status disclosed: ' + JSON.stringify(bridgeUp.refused)
    : 'the walk-bridge was unreachable; only the honest-unavailable capture is valid',
  url: null,
  steps,
  notes: [],
};

await mkdir(EVIDENCE, {recursive: true});
const page_ = await serveShellPage({html, kernelBridge: BRIDGE});
record.url = page_.url;
const {browser, page, browserErrors, pageErrors} = await launchShell({width: 1600, height: 950});

async function shot(name) {
  const path = join(EVIDENCE, name);
  await page.screenshot({path});
  return path;
}

try {
  // ── step 1: the civil-field read lands; day + run tracks render ────────
  const t0 = Date.now();
  if (bridgeUp.up) {
    await page.goto(`${page_.url}/?bridge=${encodeURIComponent(BRIDGE)}&presentation=arrangement`, {waitUntil: 'domcontentloaded'});
    await page.locator('.world-timeline.wt-arrangement').waitFor({timeout: 15000});
    // The first read is cold (K1: the temporal read walks every stream).
    await page.locator('.wt-arrangement .wt-chip.wt-read-chip', {hasText: 'events'}).waitFor({timeout: 120000, state: 'visible'});
    const readChip = await page.locator('.wt-arrangement .wt-chip.wt-read-chip').innerText();
    const readSeconds = (Date.now() - t0) / 1000;
    const dayGroup = await page.locator('.wt-arrangement .wt-group-head', {hasText: /central · civil field/i}).count();
    const runGroup = await page.locator('.wt-arrangement .wt-group-head', {hasText: /runs · factory & agency/i}).count();
    const dayClips = await page.locator(".wt-arrangement [data-track-row='central-day'] .wt-clip").count();
    const runRows = await page.locator(".wt-arrangement .wt-row[data-track-row^='run:']").count();
    const nowCursor = await page.locator('.wt-arrangement .wt-cursor.wt-now').count();
    const breakTick = await page.locator('.wt-arrangement .wt-tick-today').count();
    assert.ok(dayGroup === 1 && runGroup === 1, 'the day and run track groups render');
    assert.ok(dayClips >= 1, 'day clips place over the live reading');
    assert.ok(runRows >= 1, 'run track rows render');
    assert.ok(nowCursor >= 1, 'the now cursor renders (drawn per lane — a continuous line through the rows, the mockup\'s single-cursor form)');
    assert.ok(breakTick >= 1, 'the declared break into the civil strip renders');
    const capture = await shot('01-day-and-run-tracks-arrangement.png');
    steps.push({
      name: 'a day track and a run track are visible in the Timeline projection (arrangement presentation)',
      detail: `read chip: "${readChip.trim()}" · day clips: ${dayClips} · run rows: ${runRows} · cold read ${readSeconds.toFixed(1)}s`,
      capture,
      assertions: {dayGroup, runGroup, dayClips, runRows, nowCursor, breakTick},
    });

    // ── step 2: the cron firing landed as a clip ──────────────────────────
    const cronChip = await page.locator('.wt-arrangement .wt-chip.wt-cron-chip').innerText();
    const cronClips = await page.locator(".wt-arrangement [data-track-row='cron'] .wt-clip").count();
    assert.ok(cronClips >= 1, 'the read cadence firing landed as a cron clip');
    assert.match(cronChip, /1 firing landed/);
    const cronCapture = await shot('02-cron-firing-landed-as-clip.png');
    steps.push({
      name: 'a cron firing lands as a clip',
      detail: `cron chip: "${cronChip.trim().replace(/\s+/g, ' ')}" · cron clips: ${cronClips}`,
      capture: cronCapture,
      assertions: {cronClips},
    });

    // ── step 3: an occasion switch retains its basis ──────────────────────
    const firstClip = page.locator(".wt-arrangement [data-track-row='central-day'] .wt-clip").first();
    await firstClip.evaluate(el => el.click());
    const basisA = (await page.locator('.wt-arrangement .wt-occasion-chip').innerText()).replace(/\s+/g, ' ').trim();
    const secondClip = page.locator(".wt-arrangement [data-track-row='central-day'] .wt-clip").nth(1);
    await secondClip.evaluate(el => el.click());
    const basisB = (await page.locator('.wt-arrangement .wt-occasion-chip').innerText()).replace(/\s+/g, ' ').trim();
    await firstClip.evaluate(el => el.click());
    const basisAgain = (await page.locator('.wt-arrangement .wt-occasion-chip').innerText()).replace(/\s+/g, ' ').trim();
    assert.notEqual(basisA, basisB, 'the second selection switched the occasion');
    assert.equal(basisAgain, basisA, 'returning to the first clip restores ITS retained basis');
    assert.match(basisA, /Occasion/i);
    const occasionCapture = await shot('03-occasion-retains-basis.png');
    steps.push({
      name: 'an occasion switch retains its basis',
      detail: `basis A: "${basisA}" · basis B: "${basisB}" · return: "${basisAgain}" · the light starts unqualified (no illuminated indicator)`,
      capture: occasionCapture,
      assertions: {basisA, basisB, basisAgain},
    });
  } else {
    await page.goto(`${page_.url}/?bridge=${encodeURIComponent('http://127.0.0.1:9')}&presentation=arrangement`, {waitUntil: 'domcontentloaded'});
    await page.locator('.world-timeline.wt-arrangement .view-empty').waitFor({timeout: 20000});
    const text = await page.locator('.world-timeline.wt-arrangement .view-empty').innerText();
    assert.match(text, /The civil field is unread/);
    const capture = await shot('00-honest-unavailable.png');
    steps.push({
      name: 'honest refusal when the kernel read is unreachable',
      detail: text,
      capture,
    });
  }

  // ── step 4: the session presentation of the same World cut ─────────────
  await page.goto(`${page_.url}/?bridge=${encodeURIComponent(bridgeUp.up ? BRIDGE : 'http://127.0.0.1:9')}&presentation=session`, {waitUntil: 'domcontentloaded'});
  await page.locator('.world-timeline.wt-session').waitFor({timeout: 15000});
  if (bridgeUp.up) {
    await page.locator('.wt-session .wt-chip.wt-read-chip', {hasText: 'events'}).waitFor({timeout: 120000, state: 'visible'});
    const sessionDayCells = await page.locator('.wt-session .wt-session-cell').count();
    assert.ok(sessionDayCells >= 1, 'the session grid places days as columns');
  }
  const sessionCapture = await shot('04-session-presentation.png');
  steps.push({
    name: 'the Session presentation presents the same World material (the second presentation of one Timeline projection)',
    capture: sessionCapture,
  });
} finally {
  const errors = {browserErrors: browserErrors.slice(0, 10), pageErrors: pageErrors.slice(0, 10)};
  await browser.close().catch(() => {});
  await page_.close();
  record.notes.push(...errors.pageErrors.map((error) => `pageerror: ${error}`));
  record.notes.push(...errors.browserErrors.map((error) => `console error: ${error}`));
}

await writeFile(join(EVIDENCE, '..', 'world-cut-walk.json'), JSON.stringify(record, null, 2));
console.log(JSON.stringify({ok: true, steps: steps.length, evidence: EVIDENCE}, null, 2));
