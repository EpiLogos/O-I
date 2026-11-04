import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'

const root = new URL('../../../../', import.meta.url)
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
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext}}).outputText};
}`)}`, import.meta.url)

const door = await import('../src/inhabitants/familyManifest.ts')
const load = await import('../src/inhabitants/loadAgentShellFamilies.ts')
const addresses = await import('../src/inhabitants/agentParamAddresses.ts')
const catalogue = await import('../src/inhabitants/agentDeviceCatalogue.ts')

const TABLE = addresses.AGENT_SHELL_ADDRESS_TABLE
const byKey = (deviceInstance, key) =>
  TABLE.find(row => row.deviceInstance === deviceInstance && row.key === key)

test('every address names an admitted family, a non-empty device instance, and exactly one owner', () => {
  door.resetFamilyManifestsForTest()
  load.loadAgentShellFamilies()
  const admitted = new Set(door.allFamilyManifests().map(manifest => manifest.id))
  const seen = new Set()
  for (const row of TABLE) {
    assert.ok(admitted.has(row.family), `${row.deviceInstance}.${row.key}: family "${row.family}" must be admitted`)
    assert.equal(typeof row.deviceInstance, 'string')
    assert.ok(row.deviceInstance.length >= 1, `${row.family}: deviceInstance non-empty`)
    assert.equal(typeof row.key, 'string')
    assert.ok(row.key.length >= 1, `${row.deviceInstance}: key non-empty`)
    assert.equal(typeof row.type, 'string')
    const owner = `${row.family}|${row.deviceInstance}|${row.key}`
    assert.ok(!seen.has(owner), `duplicate owning address: ${owner}`)
    seen.add(owner)
  }
})

test('writePath is present exactly where a real owner write exists — known-refusal rows disclose instead', () => {
  // Gateway transport/approvals/stall write through the kernel harness control.
  for (const key of ['transport', 'approvals', 'stall-after']) {
    assert.equal(byKey('gateway', key)?.writePath, 'kernel:harness_agent_control', key)
  }
  // The git seat writes through the workcell-cli ops.
  assert.equal(byKey('git', 'commit-policy')?.writePath, 'workcell-cli:git commit')
  assert.equal(byKey('git', 'push-policy')?.writePath, 'workcell-cli:git push')
  assert.equal(byKey('git', 'land')?.writePath, 'workcell-cli:seat land')
  // Spend has NO writer: the row must disclose its absence, never fake a fill.
  const spend = byKey('gateway', 'spend')
  assert.equal(spend?.writePath, undefined, 'spend_ledger has no writer in O-I')
  assert.ok(spend?.disclosure?.includes('no writer'), 'spend discloses its absent writer')
  // Skillset macros are readings: admits follow the roster, nothing writes them here.
  for (const key of ['thoroughness', 'test-depth', 'reach', 'risk']) {
    assert.equal(byKey('skillset', key)?.writePath, undefined, key)
  }
  // REPLACED (lane BD round 12): every skillset row was a reading; the rack's Refining page (§19.7) answers a proposed revision through
  // AIKit's own verbs (aikit_write refinement-accept · refinement-discard), and its Test is the session's own Repeat over Skillset
  // (encounter_session_settings). Its other parameters are readings.
  // REPLACED (O-I 795 round 14): refine.accept's writePath was kernel:aikit_write. The person's Accept of a Control skill's revision is
  // Central's own act (control.skills.revision.accept through the kernel's invoke_action), AIKit's verbs carrying the hand before it and
  // the follow after it; the row names that route, and says AIKit's for a member AIKit keeps.
  assert.equal(byKey('skillset', 'refine.accept')?.writePath, 'kernel:invoke_action')
  assert.equal(byKey('skillset', 'refine.accept')?.family, 'central')
  assert.match(byKey('skillset', 'refine.accept')?.disclosure ?? '', /control\.skills\.revision\.accept[\s\S]*refinement-follow[\s\S]*AIKit keeps/)
  assert.equal(byKey('skillset', 'refine.discard')?.writePath, 'kernel:aikit_write')
  assert.equal(byKey('skillset', 'refine.run')?.writePath, 'kernel:encounter_session_settings')
  for (const key of ['refine.member', 'refine.why', 'refine.revision', 'refine.test', 'refine.result']) {
    assert.equal(byKey('skillset', key)?.writePath, undefined, key)
    assert.equal(byKey('skillset', key)?.family, 'ai-kit', key)
  }
  // Write receipts arrive; the knowledge route is available but unwired.
  assert.equal(byKey('world', 'write-receipts')?.writePath, undefined)
  assert.equal(byKey('world', 'knowledge-route')?.writePath, undefined)
  // Armed shell controls write through the shell's own setters.
  assert.equal(byKey('agent', 'effort')?.writePath, 'shell.setEffort')
  assert.equal(byKey('agent', 'input')?.writePath, 'shell.setSteer')
  assert.equal(byKey('world', 'write-mode')?.writePath, 'shell.setWriteArm')
})

test('the split agent face carries three families on ONE device instance (the §14 composition)', () => {
  assert.equal(byKey('agent', 'effort')?.family, 'actuation')
  // DLW §19.4 "One agent, three owners": Software Factory owns what the agent holds; the Agent's Autonomy is retired (§19.12: Scope's
  // Tool calls took its place).
  assert.equal(byKey('agent', 'held')?.family, 'software-factory')
  assert.equal(byKey('agent', 'held')?.writePath, undefined, 'what it holds is a reading')
  assert.equal(byKey('agent', 'autonomy'), undefined, 'no Autonomy row')
  assert.equal(byKey('agent', 'identity')?.family, 'central')
  for (const key of ['model', 'effort', 'budget-used', 'input', 'heartbeat', 'held', 'identity']) {
    assert.equal(byKey('agent', key)?.deviceInstance, 'agent', key)
  }
})

test('the world face composes central reads, the ai-kit route and the software-factory write mode', () => {
  assert.equal(byKey('world', 'reads')?.family, 'central')
  assert.equal(byKey('world', 'writes')?.family, 'central')
  assert.equal(byKey('world', 'knowledge-route')?.family, 'ai-kit')
  assert.equal(byKey('world', 'write-mode')?.family, 'software-factory')
  assert.deepEqual(byKey('world', 'write-mode')?.values, ['propose', 'draft', 'direct'])
})

test('every address sits on a chain device the catalogue renders', () => {
  door.resetFamilyManifestsForTest()
  load.loadAgentShellFamilies()
  const chainIds = new Set(catalogue.agentDeviceCatalogue().map(row => row.id))
  for (const row of TABLE) {
    assert.ok(chainIds.has(row.deviceInstance), `${row.key} addresses unrendered device "${row.deviceInstance}"`)
  }
})

test('the table counts exactly the rendered control set (F4, count from the table itself)', () => {
  // The pool renders one row per address (AgentDevicePool maps
  // agentAddressesForDevice over the selected chain device), so this count is
  // the rendered count. The acceptance claim (AGENT-DEVICE-OWNERSHIP.md) must
  // move with this number — it corrected 29 → 28 at verdict fault F4: the
  // parameter-bearing controls the devices render are gateway 7 + agent 7 +
  // skillset 4 + world 5 + git 5; admit lights are the rack's readings, not
  // §14 addresses. Never pad the table to meet a claim.
  // REPLACED (lane BD round 12): skillset 4 → 12 and 28 → 36 — the rack's Refining page (§19.7) renders eight parameters: Member, Why,
  // Revision, Test, Result, its Test press, Accept and Discard.
  const perDevice = {}
  for (const row of TABLE) perDevice[row.deviceInstance] = (perDevice[row.deviceInstance] ?? 0) + 1
  assert.deepEqual(perDevice, {gateway: 7, agent: 7, skillset: 12, world: 5, git: 5})
  assert.equal(TABLE.length, 36)
})

test('the address table module stays pure (no React, no store)', async () => {
  const source = await readFile(new URL('../src/inhabitants/agentParamAddresses.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /react/i)
  assert.doesNotMatch(source, /use[A-Z]/)
})
