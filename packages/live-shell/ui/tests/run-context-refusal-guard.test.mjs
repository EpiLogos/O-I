import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile, readdir} from 'node:fs/promises'

// P0-R5 (B) grep guard: no panel renders raw JSON for an owner refusal. The
// guard is textual on purpose: a refusal that reaches a panel as a JSON
// dump is caught by reading the source, not by a render that might not
// happen to trigger it. Two rules:
//   1. The refusal surfaces named by the ticket (NativeMaterialBrowser,
//      ProductPreferences) carry no JSON.stringify and no safeJson at all, and
//      route their refusals through OwnerRefusal.
//   2. Across src, a preformatted JSON dump is allowed only in the developer
//      disclosures listed below, each with its reason. A new raw dump fails
//      the guard until it is either disclosed as a developer view with a
//      reason here, or rebuilt through OwnerRefusal / scalar rows.

const src = new URL('../src/', import.meta.url)

async function walk(dir, base = '') {
  const out = []
  for (const entry of await readdir(dir, {withFileTypes: true})) {
    const rel = base ? `${base}/${entry.name}` : entry.name
    if (entry.isDirectory()) out.push(...await walk(new URL(`${entry.name}/`, dir), rel))
    else if (/\.(tsx|ts)$/.test(entry.name)) out.push(rel)
  }
  return out
}
const read = rel => readFile(new URL(rel, src), 'utf8')

// The owner-refusal surfaces the ticket names: no JSON dump may remain in them.
const REFUSAL_SURFACES = ['components/NativeMaterialBrowser.tsx', 'settings/ProductPreferences.tsx']

// The one serialisation a refusal surface may keep: the native-outcome receipt,
// folded beneath the owner's words as a developer view (PATH §10 item 18, the
// conductor's ruling 12 Oct: receipts stay intact; the owner's words lead).
const FOLDED_RECEIPTS = {
  'components/NativeMaterialBrowser.tsx': 'native-outcome',
}

// Developer disclosures that may still preformat JSON, with the reason each is
// not an owner refusal (the rescope in the ticket's Resolution).
const DEVELOPER_DISCLOSURES = {
  'settings/SettingsWorkspace.tsx': 'developer plan blocks and the acknowledgement of a settings apply (rescope: plan blocks are not refusals; the acknowledgement dump is a carried follow-up)',
  'components/NativeInputRetention.tsx': 'the input gesture receipt of a retained copy (an input record, not an owner refusal)',
  'agent/RefusalCard.tsx': 'the verbatim receipt folded behind a summary, never the surface (the refusal line is the surface)',
  'components/NativeMaterialBrowser.tsx': 'the native-outcome receipt of a refused material operation, folded beneath the owner\'s words as a developer view (allowlisted by name, PATH §10 item 18)',
}

// A preformatted block that serialises a value with JSON.stringify or safeJson,
// including inside a ternary within the block's expression.
const RAW_DUMP = /<pre[^>]*>[^<]*(?:JSON\.stringify\(|safeJson\()/

test('the named owner-refusal surfaces carry no raw JSON serialisation outside their named folded receipt', async () => {
  for (const rel of REFUSAL_SURFACES) {
    const text = await read(rel)
    assert.doesNotMatch(text, /safeJson\(/, `${rel} must not serialise a receipt into the panel`)
    assert.match(text, /import \{ ?OwnerRefusal ?\} from/, `${rel} renders its refusals through OwnerRefusal`)
    const folded = FOLDED_RECEIPTS[rel]
    if (!folded) {
      assert.doesNotMatch(text, /JSON\.stringify\(/, `${rel} must not serialise JSON into the panel`)
      continue
    }
    // The receipt is the only serialisation, and it sits inside its named <details> developer view.
    const views = text.match(new RegExp(`<details[^>]*data-developer-view="${folded}"[\\s\\S]*?</details>`, 'g')) ?? []
    assert.equal(views.length, 1, `${rel} folds its ${folded} receipt in exactly one named developer view`)
    assert.equal((text.match(/JSON\.stringify\(/g) ?? []).length, 1, `${rel} serialises JSON only once, in the folded receipt`)
    assert.match(views[0], /JSON\.stringify\(/, `${rel}: the serialisation sits inside the folded receipt`)
    assert.match(views[0], /<summary>Developer view/, `${rel}: the receipt is labelled as a developer view`)
  }
})

test('the run-context and carrier call sites read the carrier through carrierOf, never a second kind-only reading', async () => {
  // The browser's aperture no longer names the carrier as its World (it reads the World from the book and the host:
  // frame/encounter/encounterRows.ts, once the browser's aperture slot); the carrier stays the transport's link readout (App.tsx). Neither shows a bare kind.
  for (const rel of ['shell/ModeBrowser.tsx', 'frame/encounter/encounterRows.ts', 'shell/ModeContextDock.tsx', 'App.tsx']) {
    const text = await read(rel)
    if (!rel.includes('ModeBrowser') && !rel.includes('encounterRows')) assert.match(text, /import \{ ?carrierOf ?\} from/, `${rel} imports the one carrier reader`)
    assert.doesNotMatch(text, /'—' : (?:workspace\.)?transport\.kind\b/, `${rel} must not show the bare transport kind as the carrier`)
    assert.doesNotMatch(text, /value: (?:workspace\.)?transport\.kind\b/, `${rel} must not show the bare transport kind as the carrier`)
  }
})

test('the run-context reading follows configuration refreshes, not only its first read', async () => {
  const text = await read('shell/runContext.tsx')
  assert.match(text, /subscribeShellConfig\(/, 'RunContextReading subscribes to the configuration readings')
})

test('OwnerRefusal itself renders no preformatted block and no JSON', async () => {
  const text = await read('components/OwnerRefusal.tsx')
  assert.doesNotMatch(text, /<pre/)
  assert.doesNotMatch(text, /JSON\.stringify|safeJson/)
  assert.match(text, /refusalLine\(/, 'the owner words come from the one refusal reader, not a second one')
})

test('across src, a raw JSON dump appears only in the listed developer disclosures', async () => {
  const offenders = []
  const dumpers = new Set()
  for (const rel of await walk(src)) {
    const text = await read(rel)
    const lines = text.split('\n')
    lines.forEach((line, index) => {
      if (RAW_DUMP.test(line)) {
        dumpers.add(rel)
        if (!(rel in DEVELOPER_DISCLOSURES)) offenders.push(`${rel}:${index + 1}`)
      }
    })
  }
  assert.deepEqual(offenders, [], `raw JSON dumps outside the developer disclosures: ${offenders.join(', ')}`)
  for (const rel of Object.keys(DEVELOPER_DISCLOSURES)) {
    assert.ok(dumpers.has(rel), `${rel} is listed as a developer disclosure but no longer dumps JSON: remove it from the list`)
  }
})

test('the guard reads a real dump: a preformatted JSON.stringify is caught, a plain text pre is not', () => {
  assert.match('<pre>{JSON.stringify(result.output,null,2)}</pre>', RAW_DUMP)
  assert.match('<pre>{safeJson(document)}</pre>', RAW_DUMP)
  assert.doesNotMatch('<pre>{receipt}</pre>', RAW_DUMP, 'a plain text receipt is not a JSON serialisation')
})
