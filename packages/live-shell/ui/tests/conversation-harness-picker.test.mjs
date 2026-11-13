// The conversation's harness picker (Factory's Conversation pane, the composer's "Choose a harness" chip): it offers every harness AIKit
// detects on this computer that opens a conversation by its slug, named as Settings names it, with its own login read the way Settings
// reads it (aikit harness auth <client> --check: claude auth status, codex login status). Choosing one opens it by its slug; Settings
// is a link beside the list, never a step before it. The menu wears the shell's ordinary menu.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

const H = await import('../../../../desktop/cradle/src/agent/chat/harness.ts')
const S = await import('../../../../desktop/cradle/src/configuration/harnessSource.ts')
const N = await import('../../../../desktop/cradle/src/workspace/settings/sectionModel.ts')
const read = path => readFile(new URL(path, import.meta.url), 'utf8')

// AIKit client status as #627 writes it: each row's `conversation` (encounter_service.rs conversation_detail).
const STATUS = {clients: [
  {client: 'claude', harness: 'claude-code', detection: 'detected', conversation: {opens: true, protocol: 'acp'}},
  {client: 'codex', harness: 'codex', detection: 'detected', conversation: {opens: true, protocol: 'acp'}},
  {client: 'pi', harness: 'pi', detection: 'detected', conversation: {opens: true, protocol: 'pi-rpc'}},
  {client: 'aider', harness: 'aider', detection: 'detected', conversation: {opens: false, why: 'AIKit opens no conversation with aider'}},
  {client: 'cursor-cli', harness: 'cursor-cli', detection: 'not-installed', conversation: {opens: true, protocol: 'acp'}},
  {client: 'broker', detection: 'self', dispatch: 'self'},
]}

test('client status carries whether each harness opens a conversation, and says nothing where an older AIKit says nothing', () => {
  const rows = S.shapeHarnessClients(STATUS)
  assert.deepEqual(rows.map(row => [row.client, row.conversation]), [
    ['claude', {opens: true, why: null}], ['codex', {opens: true, why: null}], ['pi', {opens: true, why: null}],
    ['aider', {opens: false, why: 'AIKit opens no conversation with aider'}], ['cursor-cli', {opens: true, why: null}]])
  assert.equal(S.shapeHarnessClients({clients: [{client: 'claude', harness: 'claude-code', detection: 'detected'}]})[0].conversation, null)
})

test('the picker offers each detected harness that opens a conversation, by name, beside the configured providers and never twice', () => {
  const rows = S.shapeHarnessClients(STATUS)
  const providers = [{id: 'pi', label: 'pi', protocol: 'pi-rpc', command: 'pi'}]
  const standing = {claude: {signedIn: true, said: 'Signed in · claude auth status'}, codex: {signedIn: false, said: 'Not signed in · codex login status'}}
  const offered = H.conversationHarnesses(rows, providers, N.harnessName, standing)
  assert.deepEqual(offered.map(row => row.id), ['pi', 'claude-code', 'codex'], 'opened by slug; aider opens none, cursor-cli is not here')
  assert.deepEqual(H.groupByHarness(offered).map(group => group.name), ['Pi', 'Claude Code', 'Codex'])
  assert.deepEqual(offered.map(row => row.standing?.said), [undefined, 'Signed in · claude auth status', 'Not signed in · codex login status'])
  // Before: only the configured providers reached the picker, so Claude Code and Codex were never offered.
  assert.deepEqual(H.groupByHarness(providers).map(group => group.name), ['Pi'])
})

test('a harness\'s standing is what its own status command says, as Settings reads it', () => {
  const face = {own_login: [{provider_ref: 'provider:anthropic', runnable: true, argv: ['claude', 'auth', 'login'], status: ['claude', 'auth', 'status']}]}
  assert.deepEqual(S.loginStanding({face, checks: [{provider_ref: 'provider:anthropic', signed_in: true}]}), {signedIn: true, said: 'Signed in · claude auth status'})
  assert.deepEqual(S.loginStanding({face, checks: [{provider_ref: 'provider:anthropic', signed_in: false}]}), {signedIn: false, said: 'Not signed in · claude auth status'})
  assert.deepEqual(S.loginStanding({face, checks: [], checkError: 'timed out'}), {said: 'claude auth status did not answer'})
  assert.deepEqual(S.loginStanding({face: {own_login: [], note: 'pi keeps its login'}, checks: null}), {said: 'Its own login; no status command to read'})
})

test('the login read is the one Settings uses: describe, then the status command only where one is declared', async () => {
  const sent = []
  const call = async op => {
    sent.push(op)
    return op.check
      ? {outcome: {result: 'harness_auth_reading', data: {checks: [{provider_ref: 'provider:openai', signed_in: true}]}}}
      : {outcome: {result: 'harness_auth_reading', data: {own_login: [{provider_ref: 'provider:openai', runnable: true, argv: ['codex', 'login'], status: ['codex', 'login', 'status']}]}}}
  }
  const login = await S.readHarnessLogin(call, 'codex')
  assert.deepEqual(sent, [{op: 'harness_auth_describe', harness: 'codex'}, {op: 'harness_auth_describe', harness: 'codex', check: true}])
  assert.equal(S.loginStanding(login).signedIn, true)
  assert.match(await read('../../../../desktop/cradle/src/workspace/settings/settingsData.ts'), /readHarnessLogin\(send, harness\)/, 'Settings reads through the same function')
})

test('the chip asks for a harness, links to Settings after the list, and its menu wears the shell\'s menu', async () => {
  const chips = await read('../../../../desktop/cradle/src/agent/chat/ComposerChips.tsx')
  const connection = chips.slice(chips.indexOf('export function ConnectionChip'))
  assert.match(connection, /useConversationHarnesses\(open,providers\)/)
  assert.match(connection, /label=\{resume\?"Reconnect":"Choose a harness"\}/)
  assert.ok(connection.indexOf('<HarnessPicker') < connection.indexOf('Harnesses in Settings…'), 'Settings is a link after the harnesses')
  assert.doesNotMatch(connection, /Not connected|credential setup/)
  assert.match(await read('../../../../desktop/cradle/src/agent/chat/ChatComposer.tsx'), /"Choose a harness below, then write…"/)
  const css = await read('../src/agent/agentShell.css')
  assert.match(css, /\.agent-layer \.chat-chip-menu \{[^}]*background:var\(--bg-2\)[^}]*border:1px solid var\(--line-strong\)/)
  assert.match(css, /\.agent-layer \.chat-chip-menu :is\(\.oi-menu-item, \.harness-row\)/)
})

test('Add AIKit reads AIKit\'s own integration word first (ai-kit #629), and the older installed field only where that is missing', async () => {
  const rows = S.shapeHarnessClients({clients: [
    {client: 'claude', harness: 'claude-code', detection: 'detected', aikit_integration: 'installed', config_dir_present: true},
    {client: 'codex', harness: 'codex', detection: 'detected', aikit_integration: 'outdated', aikit_integration_reason: 'hooks predate 0.2'},
    {client: 'pi', harness: 'pi', detection: 'detected', aikit_integration: 'absent'},
    {client: 'gemini-cli', harness: 'gemini', detection: 'detected', aikit_integration: 'unknown'},
    {client: 'hermes', harness: 'hermes', detection: 'detected', installed: false},
    {client: 'kimi', harness: 'kimi', detection: 'detected', installed: true},
  ]})
  assert.deepEqual(rows.map(row => [row.client, row.installed, S.aikitToAdd(row)]), [
    ['claude', true, false], ['codex', false, true], ['pi', false, true], ['gemini-cli', false, false], ['hermes', false, true], ['kimi', true, false]])
  assert.equal(rows[1].aikit_integration_reason, 'hooks predate 0.2')
  assert.match(await read('../src/inhabitants/catalogue/panels/settings__window.tsx'), /typeof h\.addAikit === 'boolean' \? h\.addAikit : h\.aikit === false/)
})
