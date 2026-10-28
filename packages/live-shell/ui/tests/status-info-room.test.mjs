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

test('the readings to its right shorten to what fits, each whole in its title; the switch and the aperture keep their size', () => {
  assert.match(rule('.statusbar > :is(.statusbar-counts, .statusbar-error)'), /flex:0 1 auto; min-width:0; overflow:hidden; text-overflow:ellipsis/,
    'the run context and the counts ellipsize instead of crushing the line')
  assert.match(rule('.statusbar > :is(.statusbar-aperture, .status-detail-views)'), /flex:none/, 'Clip | Device and the aperture stand whole (the mockup\'s right side)')
  assert.match(rule('.statusbar > .owner-readback'), /flex-shrink:4/, 'the owner readback gives way first')
  assert.match(rule('.statusbar .owner-readback-row:not([data-owner-state="failed"])'), /display:none/,
    'its admitted rows fold away to the count ("6 of 6 owners admitted"); a failed owner stays in the bar, in --rec')
  assert.match(rule('.statusbar .owner-readback-summary'), /min-width:0; overflow:hidden; text-overflow:ellipsis/)
})

test('the run context and the owner readback still carry their whole words in their titles (what the Info line reads on hover)', async () => {
  const run = await readFile(new URL('../src/shell/runContext.tsx', import.meta.url), 'utf8')
  assert.match(run, /title=\{reading\.line\}/, 'the run context\'s whole sentence')
  const owners = await readFile(new URL('../src/shell/ownerReadback.tsx', import.meta.url), 'utf8')
  assert.match(owners, /aria-label=\{reading\.line\} title=\{reading\.line\}/, 'the readback\'s whole sentence')
})
