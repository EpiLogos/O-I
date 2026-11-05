// The Archetypal-Earth port pin (T-AE-REPORT; DEVICE-SEMANTICS-LOCK §7.4.1, §8.4): every port module equals AE's
// bytes at the pinned commit, or is a recorded host adaptation, or is recorded port-new; every pinned AE module is in
// the port or recorded host-only. A module that differs without a record fails here, by name.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {PIN_PATH, PORT_ROOT, checkPort, portHashes} from '../scripts/atlas-port-pin.mjs'

test('the atlas port matches its pinned AE commit, except recorded adaptations', async () => {
  const pin = JSON.parse(await readFile(PIN_PATH, 'utf8'))
  assert.match(pin.commit, /^[0-9a-f]{40}$/, 'the pin is a full AE commit')
  const {faults, differing} = await checkPort(pin, await portHashes())
  assert.deepEqual(faults, [], `port drift against AE ${pin.commit}:\n${faults.join('\n')}`)
  assert.deepEqual([...differing].sort(), Object.keys(pin.adapted).sort(), 'every recorded adaptation still differs')
  for (const [path, reason] of Object.entries(pin.adapted)) assert.ok(/^\[(C2|§8\.4)\]/.test(reason), `${path}: the reason names its law`)
})

test('the port reads no AE public/data and no browser storage', async () => {
  const {readdir} = await import('node:fs/promises')
  const {join} = await import('node:path')
  const walk = async dir => (await Promise.all((await readdir(dir, {withFileTypes: true})).map(e => e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]))).flat()
  const offenders = []
  for (const file of await walk(PORT_ROOT)) {
    if (!/\.ts$/.test(file)) continue
    const code = (await readFile(file, 'utf8')).split('\n').filter(line => !/^\s*(\/\/|\*|\/\*)/.test(line)).join('\n')
    if (/\blocalStorage\b|\bsessionStorage\b|\bindexedDB\b/.test(code.replace(/\/\*[\s\S]*?\*\//g, ''))) offenders.push(`${file}: browser storage`)
    if (/fetch[A-Za-z]*\(\s*`\$\{[a-zA-Z_]+\}\/data\/(redbook|dynamics|dynamics-route|sky-cards|aionbook)\.json`/.test(code)) offenders.push(`${file}: public/data fetch`)
    if (/data\/\$\{name\}\.json/.test(code)) offenders.push(`${file}: public/data lens fetch`)
  }
  assert.deepEqual(offenders, [])
})

// Round 870 (DLW build ruling 2026-11-05): the dust's Barnes–Hut is AE's own since EpiLogos/archetypal-earth#2 (022d9ac). The port's
// graph/field-force.ts is pinned there, one module at its own commit while the rest of the port stays at the pin's: its bytes are AE's at
// 022d9ac, so it is no host adaptation, and view.ts names no FIELD_THETA among its adaptations (AE carries it at 022d9ac).
test('(r870) graph/field-force.ts is pinned at AE 022d9ac, its bytes AE\'s there, and no adaptation names the field\'s theta', async () => {
  const pin = JSON.parse(await readFile(PIN_PATH, 'utf8'))
  assert.equal(pin.pinnedAt?.['graph/field-force.ts']?.commit, '022d9acffd523eb004a16c4ad4b634d68d6a16ad')
  assert.equal(pin.ae['graph/field-force.ts'], '1c79adca46bb8a21b62f3ce85dba6a0fcfc9ad81a55634f42f1d54b0fbdb5318', 'the sha-256 of AE 022d9ac:src/graph/field-force.ts')
  assert.equal(pin.adapted['graph/field-force.ts'], undefined, 'equal to AE at its commit: no adaptation to record')
  assert.doesNotMatch(pin.adapted['graph/view.ts'], /FIELD_THETA|far field's theta/)
  for (const [path, at] of Object.entries(pin.pinnedAt)) {
    assert.match(at.commit, /^[0-9a-f]{40}$/, `${path}: pinned at a full AE commit`)
    assert.ok(path in pin.ae, `${path}: its hash is kept with the others`)
    assert.ok(typeof at.why === 'string' && at.why.length > 20, `${path}: why it stands at its own commit`)
  }
})

test('(r870) a module pinned at its own commit is checked against that commit, and its faults name it', async () => {
  const base = 'a'.repeat(40), own = 'b'.repeat(40)
  const pin = {commit: base, ae: {'x.ts': 'h-own', 'y.ts': 'h-base'}, adapted: {}, portNew: {}, hostOnly: {}, pinnedAt: {'x.ts': {commit: own, why: 'AE carries it at its own commit'}}}
  assert.deepEqual((await checkPort(pin, {'x.ts': 'h-own', 'y.ts': 'h-base'})).faults, [])
  const {faults} = await checkPort(pin, {'x.ts': 'h-other', 'y.ts': 'h-other'})
  assert.deepEqual(faults, [`x.ts: differs from AE @ ${own} and is not a recorded host adaptation`, `y.ts: differs from AE @ ${base} and is not a recorded host adaptation`])
})
