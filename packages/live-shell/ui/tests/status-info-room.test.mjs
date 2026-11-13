import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

// Lane F, F4: the status bar's Info line has its room first (manual §10.1: "Read what any control does"; manual §16.9: the
// status bar is the single explanation surface; the mockup's `.sb .info`, "Info  Hover anything to read what it does."). Seen
// natively (the lead, 16 Oct): the leftmost cell showed one letter ("C", "E", "L"…) that changed with the pointer — the line had
// flex-basis 0 and min-width 0, so the run context's long admission list ("Native host · revision … · 6 of 6 owners admitted ·
// Central (central) · admitted · Actuation …") took every pixel and the line kept only its padding. Headless (lane F, the native
// words set into the bar, 1280/1372/1440): the line holds 560 px and reads the control under the pointer; the run context
// ellipsizes and the owner readback shows its count. Channel here: scripted (the stylesheet's rules).
const css = (await readFile(new URL('../src/styles.css', import.meta.url), 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '')
const rule = selector => css.match(new RegExp(`(?:^|\\n)${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{([^}]*)\\}`))?.[1] ?? null

test('the Info line never narrows below its floor and takes all the room left', () => {
  const line = rule('.statusbar-info-line')
  assert.ok(line, 'the Info line has its rule')
  assert.match(line, /flex:1 1 0;/, 'it grows into every pixel the readings leave')
  const floor = line.match(/min-width:([^;]+);/)?.[1]
  assert.ok(floor && floor.trim() !== '0', `its floor is not zero (was min-width:0 — one letter natively); found ${floor}`)
  assert.match(floor, /min\(45%, 560px\)/, 'about half the bar, at most 560 px: room for a control\'s name and what it does')
})

test('the readings to its right stand whole or drop out whole, never cut mid-word; the run context and owner readback yield first', () => {
  // Seen on the built candidate (window ~1135 px): "6 of 6 o…", "Native host · rev…" — the readings ellipsized mid-word.
  assert.match(css, /\n\.statusbar \{ flex-wrap:wrap; align-content:flex-start; height:28px;[^}]*overflow:hidden/,
    'one 28px line that wraps into nothing: a reading with no room drops out entire')
  assert.match(rule('.statusbar > :not(.statusbar-info-line)'), /flex:none/, 'every reading keeps its whole width')
  assert.doesNotMatch(css, /\.statusbar > :is\(\.statusbar-counts[^{]*\{[^}]*text-overflow:ellipsis/, 'the counts no longer ellipsize')
  const order = selector => Number(rule(selector)?.match(/order:(\d+)/)?.[1])
  assert.ok(order('.statusbar > .statusbar-counts') < order('.statusbar > .status-detail-views'), 'the counts, then Clip | Device, as the mockup')
  assert.ok(order('.statusbar > .status-detail-views') < order('.statusbar > .statusbar-track'))
  assert.ok(order('.statusbar > .statusbar-track') < order('.statusbar > .run-context'), 'the run context yields before the mockup\'s readings')
  assert.ok(order('.statusbar > .run-context') < order('.statusbar > .owner-readback'), 'and the owner readback yields first of all')
  assert.equal(order('.statusbar > .owner-readback:has([data-owner-state="failed"])'), 1, 'a failed owner is kept forward')
  assert.match(rule('.statusbar > .statusbar-error'), /flex:1 1 0; min-width:120px; overflow:hidden; text-overflow:ellipsis/, 'a refusal shortens, never drops')
  assert.match(rule('.statusbar .owner-readback-row:not([data-owner-state="failed"])'), /display:none/,
    'its admitted rows fold away to the count ("6 of 6 owners admitted"); a failed owner stays in the bar, in --rec')
})

test('the run context and the owner readback still carry their whole words in their titles (what the Info line reads on hover)', async () => {
  const run = await readFile(new URL('../src/shell/runContext.tsx', import.meta.url), 'utf8')
  assert.match(run, /title=\{reading\.line\}/, 'the run context\'s whole sentence')
  const owners = await readFile(new URL('../src/shell/ownerReadback.tsx', import.meta.url), 'utf8')
  assert.match(owners, /aria-label=\{reading\.line\} title=\{reading\.line\}/, 'the readback\'s whole sentence')
})
