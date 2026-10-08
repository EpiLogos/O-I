import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

const fidelity = JSON.parse(await readFile(
  process.env.OI_AGENT_SHELL_ORACLE ?? '/Users/admin/Central/Work/reverse-engineering/2026-10-07-techne-instrument-re/new-shell/agent-shell-fidelity.json',
  'utf8',
))
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

const {AgentShellProvider} = await import('../src/agent/AgentShellContext.tsx')
const {AgentShellTransport} = await import('../src/agent/AgentShellTransport.tsx')
const {AGENT_TRANSPORT_IDS} = await import('../src/agent/agentFidelity.ts')

test('transport orderHint ids from the F1 oracle are present on the live transport', () => {
  assert.deepEqual([...AGENT_TRANSPORT_IDS], fidelity.transport.orderHint)
  const html = renderToStaticMarkup(createElement(AgentShellProvider, null, createElement(AgentShellTransport, {
    title: 'Agent sessions',
    browser: true,
    detail: true,
    dock: true,
    toggleBrowser: () => {},
    toggleDetail: () => {},
    toggleDock: () => {},
    onCentreView: () => {},
    centreView: 'session',
    transport: {kind: 'unavailable', reason: 'unit'},
  })))
  for (const id of fidelity.transport.orderHint) {
    assert.ok(html.includes(`id="${id}"`), `missing #${id}`)
  }
  assert.ok(html.includes('data-region="transport"'))
  assert.ok(html.includes('data-i="Run|'))
})
