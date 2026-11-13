import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {register} from 'node:module'

// O-I 540 (map O-I 530, the material field): the UI standards every lane on the material field's surfaces is checked against, pinned. The
// owner's law for those lanes (map O-I 530, decision 3): no metadata dumped into the UI, real normalized functionality, actual useful info
// only, accepted on walked screens with receipts. The documents the ticket named (docs/cradle 03, 04 and 10, the old Settings and Factory
// laws) have folded into the one specification, so each standard is pinned to the place it stands now, by a quote that must still stand
// there: a home that moves fails this pin, and the list is pinned again rather than dug for. Each standard a test can check is checked on
// the surfaces as built: the Settings window's Machines & services page (settings/windowValues.ts machineValues, settings/windowPages.ts
// useMachinesPage, the Settings design). A lane that adds a material-field surface adds it here. Each checker is first shown to catch its
// own violation.
// The one standard no test can stand for, the walk, is listed as the walk's: the lane's receipt carries it.
//
//   node --test packages/live-shell/ui/tests/material-field-ui-standards-540.test.mjs
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(specifier,context,next){
  try{return await next(specifier,context)}catch(error){
    if(!specifier.startsWith('.'))throw error;
    if(specifier.endsWith('.js')){try{return await next(specifier.slice(0,-3)+'.ts',context)}catch{}}
    for(const suffix of ['.ts','.tsx','/index.ts','/index.tsx']){try{return await next(specifier+suffix,context)}catch{}}
    throw error;
  }
}
export async function load(url,context,next){
  if(url.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export default null'};
  if(url.endsWith('.ts')||url.endsWith('.tsx')){
    const source=await readFile(new URL(url).pathname,'utf8');
    const {outputText}=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:url});
    return {format:'module',shortCircuit:true,source:outputText.split('import.meta.env').join('({BASE_URL: "/"})')};
  }
  return next(url,context);
}`)}`, {parentURL: import.meta.url})

const repo = path => readFileSync(new URL(`../../../../${path}`, import.meta.url), 'utf8')
const ui = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const MANUAL = 'ProjectCentral/docs/1-vision/dlw/DLW.md', CAMPAIGN = 'docs/experience/LOCAL-CAMPAIGN.md'
const flat = text => text.replace(/\s+/g, ' ')

/** The checklist: each standard in one line, where it stands now (by a quote that must stand there), and what checks it. */
export const MATERIAL_FIELD_UI_STANDARDS = Object.freeze([
  {id: 'useful-only', rule: 'Actual useful info only: a page shows rows with their controls, never an owner\'s raw record.',
    home: [MANUAL, '§10.10 Settings, Rules', 'An owner\'s raw record never stands on a page; its configuration as written stands read only on the System page.'], check: 'no raw record in the page\'s values'},
  {id: 'no-secret', rule: 'No secret: a machine\'s connection and a credential show their reference, and a token is never entered.',
    home: [MANUAL, '§10.10 Settings, Rules', 'Settings shows no secret and takes none. A credential, a projection and a machine\'s connection show their reference.'], check: 'no secret in the values; a token is refused'},
  {id: 'yours-until-applied', rule: 'A change stays yours until its owner applies it: an act re-reads the owner first, and a stale read keeps your draft.',
    home: [MANUAL, '§10.10 Settings, Rules', 'A change stays yours until its owner applies it.'], check: 'the act reads the owner again before acting'},
  {id: 'dimmed-says-why', rule: 'An act its owner cannot take stays in place, dimmed, and says why.',
    home: [MANUAL, '§10.10 Settings, Rules', 'An act its owner cannot take stays in place, dimmed, and the status bar says why.'], check: 'every machine act has its why without an owner'},
  {id: 'acknowledged', rule: 'An act its owner takes is acknowledged in the owner\'s words, and the page reads the owner back.',
    home: [MANUAL, '§10.10 Settings, Rules', 'An act its owner takes is acknowledged on the status bar, in its words.'], check: 'the answer is the owner\'s status and message, then a re-read'},
  {id: 'release-held', rule: 'Release is held: Disconnect and Remove are pressed and held.',
    home: [MANUAL, '§10.10 Settings, Rules', 'Revoke, Remove, Disconnect, Run now and Disable are held: press and hold them.'], check: 'Disconnect and Remove are held acts'},
  {id: 'unknown-not-empty', rule: 'A missing reading is named, never drawn as nothing: unknown state is not an empty list.',
    home: [MANUAL, '§16.12 The display', 'When a reading is missing, say which one in the well. Do not draw it as zero.'], check: 'a failed read refuses, it never lists nothing'},
  {id: 'no-likely-rows', rule: 'Draw from the owner\'s readings only: no likely or invented rows.',
    home: [MANUAL, '§16.12 The display', 'Draw every mark from the device\'s values or readings, by the device\'s own law. Do not draw a likely picture.'], check: 'every row is one the owner read'},
  {id: 'walked', rule: 'Accepted on the native candidate, walked by someone other than its builder, with a receipt.',
    home: [CAMPAIGN, '§4 The verifier\'s walk on the native app', 'The verifier drives the native candidate only; a browser render is never a substitute, because only the native host reaches the products\' owners.'], check: 'walked'},
])

// ── the checkers, each over what a surface shows ─────────────────────────────

/** The keys of the owner's own records (settings/machines.ts RemoteMachineDeclaration, MachineConnection) that no page shows as they are. */
const RAW_KEYS = ['connection_ref', 'provenance', 'remote_workcell_ref', 'local_software', 'granted_operations', 'credential_ref', 'connected_at_unix_ms', 'expires_at_unix_ms', 'last_reconciled_at_unix_ms']
/** What of an owner's raw record a page's values carry: a record key, or a bare instant in milliseconds where a time in words stands. */
function rawRecordIn(values) {
  const found = []
  const walk = (value, where) => {
    if (typeof value === 'string' && /^[[{]/.test(value)) { try { walk(JSON.parse(value), where); return } catch { /* a plain string */ } }
    if (Array.isArray(value)) value.forEach((item, i) => walk(item, `${where}[${i}]`))
    else if (value && typeof value === 'object') for (const [key, item] of Object.entries(value)) {
      if (RAW_KEYS.includes(key)) found.push(`${where}.${key}`)
      walk(item, `${where}.${key}`)
    } else if (typeof value === 'number' && value > 1e11) found.push(`${where}: ${value}`)
  }
  for (const [key, value] of Object.entries(values)) walk(value, key)
  return found
}
/** Which of the secrets a page's values show. */
const secretsIn = (values, secrets) => secrets.filter(secret => JSON.stringify(values).includes(secret))
/** The acts a design draws without a hold, of those named. */
const unheld = (design, labels) => labels.filter(label => !new RegExp(`<Action [^>]*\\bhold label="${label}"`).test(design))

const win = await import('../src/settings/windowValues.ts')
const machines = await import('../src/settings/machines.ts')
const DECLARED = [{label: 'omarchy', endpoint: 'omarchy.local:7777', credential_ref: 'keychain://workcell/omarchy', operations: ['status', 'run'], note: 'the spare machine'}]
const CONNECTED = [{connection_ref: 'workcell:connection/7f3a', label: 'omarchy', endpoint: 'omarchy.local:7777', protocol: 'workcell-wire/1', remote_workcell_ref: 'workcell:omarchy',
  remote_software: 'workcell 0.9.2', local_software: 'workcell 0.9.2', granted_operations: ['status', 'run'], credential_ref: 'keychain://workcell/omarchy', state: 'connected',
  detail: null, connected_at_unix_ms: 1792400000000, expires_at_unix_ms: 1792500000000, last_reconciled_at_unix_ms: 1792400000000, provenance: {connected_by: 'workcell connect'}}]
const SCOPE = {scope_kind: 'workcell', scope_ref: 'env-1'}

test('the checklist is short enough to check against: each standard stands where it is pinned, and each names its check', () => {
  assert.ok(MATERIAL_FIELD_UI_STANDARDS.length <= 12, 'a checklist, not a document')
  assert.equal(new Set(MATERIAL_FIELD_UI_STANDARDS.map(item => item.id)).size, MATERIAL_FIELD_UI_STANDARDS.length)
  for (const {id, rule, home: [file, where, quote], check} of MATERIAL_FIELD_UI_STANDARDS) {
    assert.ok(rule.length <= 160 && check, `${id}: one line, with its check`)
    assert.ok(flat(repo(file)).includes(flat(quote)), `${id}: the standard no longer stands at ${file} ${where}; pin it where it stands now`)
  }
  assert.deepEqual(MATERIAL_FIELD_UI_STANDARDS.filter(item => item.check === 'walked').map(item => item.id), ['walked'], 'only the walk is left to the walk')
})

test('each checker catches its own violation first', () => {
  assert.deepEqual(rawRecordIn({connections: JSON.stringify([{label: 'omarchy', connection_ref: 'c', reconciled: 1792400000000}])}),
    ['connections[0].connection_ref', 'connections[0].reconciled: 1792400000000'], 'a record key and a bare instant are caught')
  assert.deepEqual(rawRecordIn({connections: JSON.stringify([{label: 'omarchy', provenance: {by: 'x'}}])}), ['connections[0].provenance'])
  assert.deepEqual(secretsIn({machines: JSON.stringify([{credential: 'sk-live-123'}])}, ['sk-live-123']), ['sk-live-123'])
  assert.deepEqual(unheld('<Action label="Disconnect" /> <Action hold label="Remove" />', ['Disconnect', 'Remove']), ['Disconnect'])
})

test('useful-only and no-likely-rows: the Machines & services page shows the owner\'s rows normalized, and no raw record', () => {
  const values = win.machineValues(DECLARED, CONNECTED, ['status', 'run'], SCOPE)
  assert.deepEqual(rawRecordIn(values), [], 'no record key and no bare instant reaches the page')
  const [row] = JSON.parse(values.connections)
  assert.deepEqual(Object.keys(row).sort(), ['granted', 'expires', 'label', 'protocol', 'reconciled', 'remote', 'state'].sort(), 'what a person reads of a connection')
  assert.equal(row.reconciled, '2026-10-19 08:53', 'a time in words')
  assert.equal(JSON.parse(values.machines).length, DECLARED.length, 'one row for each machine Workcell declares, and no other')
  assert.equal(JSON.parse(win.machineValues(DECLARED, [], ['status'], SCOPE).connections).length, 0, 'no connection is drawn that Workcell did not read')
  assert.equal('machines' in win.machineValues(null, null, null, null), false, 'nothing read, nothing listed')
})

test('no-secret: a connection and a credential show their reference; a token typed where a reference goes is refused', () => {
  const values = win.machineValues(DECLARED, CONNECTED, ['status', 'run'], SCOPE)
  assert.deepEqual(secretsIn(values, ['sk-', 'ghp_', 'Bearer ']), [])
  assert.equal(JSON.parse(values.machines)[0].credential, 'keychain://workcell/omarchy', 'the reference, never what it holds')
  assert.match(machines.validateMachine({...DECLARED[0], label: 'spare', credential_ref: 'sk-live-123'}, ['status', 'run'], DECLARED).credential_ref, /Do not enter a token\./)
})

test('yours-until-applied, dimmed-says-why, acknowledged and unknown-not-empty: the page acts only on the owner as it reads now, and says what it did', () => {
  const page = ui('src/settings/windowPages.ts')
  const hook = page.slice(page.indexOf('export function useMachinesPage('), page.indexOf('// ----', page.indexOf('export function useMachinesPage(')))
  assert.match(hook, /const \[fresh, receipts\] = await Promise\.all\(\[machines\.readMachines\(\), machines\.readConnections\(\)\]\)/, 'the owner is read again before any act')
  assert.match(hook, /Machine setup changed after this page was read\. It is read again: accept the current setup, then retry\. Your draft is retained\./, 'a stale read keeps the draft')
  assert.match(hook, /for \(const key of \['addMachine', 'connect', 'disconnect', 'removeMachine'\]\) if \(!source\) why\[key\] = NO_MACHINES\s*else if \(wrongScope\) why\[key\] = WRONG_WORKCELL/, 'each act says why it cannot be taken')
  assert.match(hook, /if \(response\.status !== 'acknowledged'\) throw new Error\(`\$\{response\.status === 'pending' \? 'Awaiting acknowledgement' : response\.status\} · \$\{response\.message\}`\)/, 'an answer short of acknowledged is said in the owner\'s words')
  assert.match(hook, /await read\.refresh\(\)\s*return `\$\{response\.status\} · \$\{response\.message\}`/, 'the owner\'s words, then the page reads it back')
  // O-I #758: the read is readMachineSetup, which says Workcell's refusal in its words; settings-window.test.mjs exercises it.
  assert.match(hook, /readMachineSetup\(adapterNow\.remoteMachines!\)/, 'the page reads through readMachineSetup')
  assert.match(page, /if \(declared\.status === 'fulfilled' && receipts\.status === 'fulfilled'\) return \{machines: declared\.value, connections: receipts\.value\}\s*[^]*?throw new Error\(`Workcell did not read its machines: /, 'a failed read is not an empty list')
  assert.equal(win.NO_MACHINES.length > 0 && !/undefined/.test(win.NO_MACHINES), true)
})

test('release-held: Disconnect and Remove are pressed and held on the Machines & services page', () => {
  assert.deepEqual(unheld(ui('src/inhabitants/catalogue/panels/settings__window.tsx'), ['Disconnect', 'Remove']), [])
})
