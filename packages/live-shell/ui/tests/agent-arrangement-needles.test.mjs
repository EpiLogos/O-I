import test from 'node:test'
import assert from 'node:assert/strict'
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
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText};
}`)}`, import.meta.url)

const {
  needleFor,
  sharedAxis,
  HEARTBEAT_HORIZON_MS,
} = await import('../src/agent/agentRunModel.ts')

const NOW = 1_800_000_000_000
const HOUR = 60 * 60 * 1000

test('sharedAxis is one fixed window ending now — not data-fitted', () => {
  assert.deepEqual(sharedAxis([], NOW), {startUnixMs: NOW - HOUR, endUnixMs: NOW})
  const custom = sharedAxis([], NOW, 10 * 60_000)
  assert.equal(custom.endUnixMs - custom.startUnixMs, 10 * 60_000)
  const withData = sharedAxis([{subject_ref: 'x', instant_unix_ms: NOW - 20 * HOUR}], NOW)
  assert.equal(withData.endUnixMs - withData.startUnixMs, HOUR, 'old events widen nothing; the ruler stays stable')
})

test('needleFor is live within the heartbeat horizon and freezes at the exact last-output instant when stalled', () => {
  const axis = {startUnixMs: NOW - HOUR, endUnixMs: NOW}
  const live = needleFor([{subject_ref: 'agency/sess-a1/hb', instant_unix_ms: NOW - 10_000}], 'sess-a1', axis)
  assert.equal(live.state, 'live')
  assert.equal(live.atUnixMs, NOW - 10_000)
  assert.equal(live.disclosure, null)

  const at = NOW - 10 * 60_000
  const stalled = needleFor([{subject_ref: 'sess-a2', instant_unix_ms: at}], 'sess-a2', axis)
  assert.equal(stalled.state, 'stalled')
  assert.equal(stalled.atUnixMs, at, 'frozen at the last activity instant, never advanced')
  assert.match(stalled.disclosure, /frozen at last output/)
  assert.ok(10 * 60_000 > HEARTBEAT_HORIZON_MS)

  const idle = needleFor([], 'sess-b1', axis)
  assert.equal(idle.state, 'idle')
  assert.equal(idle.atUnixMs, null)
  assert.match(idle.disclosure, /No temporal event matches/)

  const beforeWindow = needleFor([{subject_ref: 'sess-b1', instant_unix_ms: NOW - 2 * HOUR}], 'sess-b1', axis)
  assert.equal(beforeWindow.state, 'idle')
  assert.match(beforeWindow.disclosure, /before the axis window/)
})

test('matching prefers the structural subject_ref event over the summary-mention decoy', () => {
  const axis = {startUnixMs: NOW - HOUR, endUnixMs: NOW}
  const needle = needleFor([
    {subject_ref: 'unrelated/other', instant_unix_ms: NOW - 1_000, summary: 'progress on sess-a1 continues'},
    {subject_ref: 'agency/sess-a1/tool.done', instant_unix_ms: NOW - 30_000, summary: 'tool finished'},
  ], 'sess-a1', axis)
  assert.equal(needle.atUnixMs, NOW - 30_000, 'the decoy did not move the needle')
})
