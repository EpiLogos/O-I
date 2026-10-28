import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'

// Lane Q: Settings reads its registry, its resolutions and the owner's apply qualification when Settings is opened (or its
// reading is first asked for), not at boot — the panel stands mounted, hidden, for the whole session. Channel: scripted over
// the real native settings connector (src/native/configuration.ts) with the bridge's fetch stubbed; the workspace's gate is
// pinned on source (its effects need a DOM this suite does not have). On screen: UNVERIFIED.
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(s, c, n) {
  try { return await n(s, c) } catch (e) {
    if (!s.startsWith('.')) throw e;
    if (s.endsWith('.js')) { try { return await n(s.slice(0, -3) + '.ts', c) } catch {} }
    for (const x of ['.ts', '.tsx']) { try { return await n(s + x, c) } catch {} }
    throw e;
  }
}
export async function load(u, c, n) {
  if (u.endsWith('.css')) return {format: 'module', shortCircuit: true, source: 'export {}'};
  if (!u.endsWith('.ts') && !u.endsWith('.tsx')) return n(u, c);
  return {format: 'module', shortCircuit: true, source: ts.transpileModule(await readFile(new URL(u), 'utf8'), {fileName: new URL(u).pathname,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText};
}`)}`, import.meta.url)

const {connectNativeSettings} = await import('../src/native/configuration.ts')

function bridge(url, answers) {
  const calls = []
  const original = globalThis.fetch
  globalThis.fetch = async (target, init) => {
    if (!String(target).startsWith(url)) return original(target, init)
    const op = JSON.parse(init.body)
    calls.push(op.op)
    return {json: async () => answers[op.op] ?? {ok: false, error: `stub: no ${op.op}`}}
  }
  return {calls, restore: () => { globalThis.fetch = original }}
}

const REGISTRY = {ok: true, outcome: {result: 'config_registry_reading', reading: {mounts: [], observed_at_unix_ms: 7}}}

test('connecting reads nothing; opening Settings asks the qualification once, then the registry', async () => {
  const transport = {kind: 'bridge', url: 'http://bridge.test/settings-open'}
  const stub = bridge(transport.url, {
    config_registry_read: REGISTRY,
    config_capabilities_read: {ok: true, outcome: {result: 'config_capabilities_reading', document: {schema: 'oi.config-capabilities/v1', reviewed_apply: true, owner_plan_passthrough: true, native_reset: true}}},
  })
  try {
    const adapter = await connectNativeSettings(transport, {ownerEpoch: 'epoch-1', isCurrent: () => true})
    assert.deepEqual(stub.calls, [], 'boot qualifies the access and asks the owner nothing')
    assert.equal(adapter.canApply, false, 'unread, Apply is not offered')
    assert.match(adapter.applyUnavailableReason, /read when Settings opens/)
    assert.equal(adapter.reset, undefined)
    await adapter.readRegistry()
    assert.deepEqual(stub.calls, ['config_capabilities_read', 'config_registry_read'], 'opened: the qualification, then the registry')
    assert.equal(adapter.canApply, true)
    assert.equal(adapter.applyUnavailableReason, undefined)
    assert.equal(typeof adapter.reset, 'function', 'the owner offers reset: it is connected')
    await adapter.readRegistry()
    assert.deepEqual(stub.calls, ['config_capabilities_read', 'config_registry_read', 'config_registry_read'], 'the qualification is read once per owner epoch')
  } finally { stub.restore() }
})

test('a refused qualification is remembered for its epoch and stays the stated reason; the next epoch asks again', async () => {
  const transport = {kind: 'bridge', url: 'http://bridge.test/settings-refused'}
  const stub = bridge(transport.url, {
    config_registry_read: REGISTRY,
    config_capabilities_read: {ok: false, error: 'this owner does not disclose configuration capabilities'},
  })
  try {
    const adapter = await connectNativeSettings(transport, {ownerEpoch: 'epoch-1', isCurrent: () => true})
    await adapter.readRegistry()
    await adapter.readRegistry()
    await assert.rejects(adapter.apply([]), /does not disclose configuration capabilities/)
    assert.equal(stub.calls.filter(op => op === 'config_capabilities_read').length, 1, 'asked once in the epoch, whatever asks again')
    assert.equal(adapter.canApply, false)
    assert.equal(adapter.applyUnavailableReason, 'this owner does not disclose configuration capabilities', 'the refusal stays visible in the owner\'s words')
    const next = await connectNativeSettings(transport, {ownerEpoch: 'epoch-2', isCurrent: () => true})
    await next.readRegistry()
    assert.equal(stub.calls.filter(op => op === 'config_capabilities_read').length, 2, 'a new owner epoch asks again')
  } finally { stub.restore() }
})

test('the Preferences workspace reads its registry and resolutions only once it is opened or asked for', async () => {
  const source = await readFile(new URL('../src/settings/SettingsWorkspace.tsx', import.meta.url), 'utf8')
  assert.match(source, /const \[wanted, setWanted\] = useState\(active \|\| !!request\)/, 'wanted from the first opening or request')
  assert.match(source, /if \(!wanted && \(active \|\| request\)\) setWanted\(true\)/, 'opening (active) or a contextual request asks for it, once')
  // The registry's effect: behind the gate, read again for a new adapter or owner epoch, or when Read again is pressed (registryRead).
  const start = source.indexOf('useEffect(() => {\n    if (!wanted) return'), end = source.indexOf('}, [adapter, adapter.ownerEpoch, wanted, registryRead])')
  assert.ok(start >= 0 && end > start, 'the registry\'s effect, gated, with its dependencies')
  const registryEffect = source.slice(start, end)
  assert.match(registryEffect, /adapter\.readRegistry\(\)/, 'the registry read stands behind the gate')
  assert.match(source, /if \(loading\) return\n    let cancelled = false\n    const pairs/, 'resolutions wait for the registry, which waits for the gate')
  const panel = await readFile(new URL('../src/panels/settings.tsx', import.meta.url), 'utf8')
  assert.match(panel, /active=\{visible\}/, 'the always-mounted panel passes whether it is open')
})
