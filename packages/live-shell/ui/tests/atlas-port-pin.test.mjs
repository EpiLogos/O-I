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
