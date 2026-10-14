// lane-5 T22 · the one open door carries two request kinds: an Expression by its ref (requestExpression) and a browser-local draft
// by its Library id (requestLocalDraft). The pane routes a draft to the host's open-local-draft command, and the Library's id-only
// relay reaches that door. Channel: source wiring of the candidate shell (App, workspace, the Expressions pane).
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

const read = path => readFile(new URL(path, import.meta.url), 'utf8')

test('the workspace door types both request kinds and exposes requestLocalDraft beside requestExpression', async () => {
  const types = await read('../src/shell/workspaceTypes.ts')
  assert.match(types, /expressionToOpen: \{ref: string; request: number\} \| \{draftId: string; request: number\} \| null/)
  assert.match(types, /requestLocalDraft: \(draftId: string\) => void/)
  const workspace = await read('../src/shell/workspace.tsx')
  assert.match(workspace, /const requestLocalDraft = \(draftId: string\) => openExpression\(current => \(\{ draftId, request: \(current\?\.request \?\? 0\) \+ 1 \}\)\)/)
  assert.match(workspace, /expressionToOpen, requestExpression, requestLocalDraft, mode, setMode,/)
})

test('the Expressions pane routes a draft request to the host open-local-draft command, last request wins, and flushes it once presented', async () => {
  const pane = await read('../src/panels/expressions.tsx')
  assert.match(pane, /mounted\.host\.openLocalDraft\(draftId, 'world\.expressions'\)/)
  assert.match(pane, /if \('draftId' in request\) \{/)
  assert.match(pane, /else \{pendingDraft\.current = request\.draftId; pendingOpen\.current = null\}/)
  assert.match(pane, /if \(!presented\(\) \|\| !mounted\) \{pendingOpen\.current = ref; pendingDraft\.current = null; return\}/)
  assert.match(pane, /if \(!presented\(\) \|\| !mounted\) \{pendingDraft\.current = draftId; pendingOpen\.current = null; return\}/)
  assert.equal((pane.match(/flushPendingOpen\(\)/g) ?? []).length, 2, 'both presentation flushes (mount and visibility) call the one function')
  assert.match(pane, /openDraftRequest\.current = null/)
})

test('the candidate shell answers an id-only Library request with a browser draft, and a ref with the Expression door', async () => {
  const app = await read('../src/App.tsx')
  assert.match(app, /window\.addEventListener\('oi:host-workspace-mode', onHostMode\)/)
  assert.match(app, /if \(request\.ref !== undefined\) requestExpressionRef\.current\(request\.ref\)\n\s+else if \(request\.id !== undefined && request\.mode === 'expressions'\) requestLocalDraftRef\.current\(request\.id\)/,
    'a ref wins; an id-only Expressions request opens the draft')
})
