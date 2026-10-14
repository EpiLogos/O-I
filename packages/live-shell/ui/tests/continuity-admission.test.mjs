import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

// Production source in memory: .ts transpiled, extensionless relative specifiers retried.
// Same loader as continuity-storage.test.mjs; admission.ts imports nothing, so no DOM is needed.
const root = new URL('../../../../', import.meta.url)
const compiler = new URL('desktop/cradle/node_modules/typescript/lib/typescript.js', root).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(specifier,context,next){
  try{return await next(specifier,context)}catch(error){
    if(!specifier.startsWith('.'))throw error;
    if(specifier.endsWith('.js')){try{return await next(specifier.slice(0,-3)+'.ts',context)}catch{}}
    for(const suffix of ['.ts','.tsx']){try{return await next(specifier+suffix,context)}catch{}}
    throw error;
  }
}
export async function load(url,context,next){
  if(url.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export {}'};
  if(!url.endsWith('.ts')&&!url.endsWith('.tsx'))return next(url,context);
  return {format:'module',shortCircuit:true,source:ts.transpileModule(await readFile(new URL(url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:new URL(url).pathname}).outputText};
}`)}`, import.meta.url)

const {applyPendingAdmission, applyVerifiedAdmission, admissionReport, sha256Hex, ADMISSION_NAMESPACE, POLICY_EMPTY, POLICY_PRESERVE, PRESERVED_SCHEMA} = await import('../src/continuity/admission.ts')

const NS = ADMISSION_NAMESPACE
const NAME = 'admission-0123456789abcdef'
const OLD_BOOK = JSON.stringify({version: 2, active: 'old', workspaces: []})
const NEW_BOOK = JSON.stringify({version: 2, active: 'w1', workspaces: [{id: 'w1', name: 'Central'}]})
const DRAFT_KEY = 'oi-cradle.draft.v1:central:path:/x/y.md'
const DRAFT = JSON.stringify({content: 'hello', base_revision: 'r1', saved_content: 's'})
const JOURNAL = JSON.stringify({version: 1, slots: {[NS]: {previous: NEW_BOOK, candidate: NEW_BOOK}}})

/** A Storage-shaped fake that logs writes, so order and count can be asserted. */
class FakeStore {
  constructor(entries = {}) {
    this.map = new Map(Object.entries(entries))
    this.writes = []
    this.failOn = null
  }
  get length() { return this.map.size }
  key(index) { return [...this.map.keys()][index] ?? null }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null }
  setItem(key, value) {
    if (this.failOn && this.failOn(key, this.writes.length)) throw new Error(`quota for ${key}`)
    this.writes.push(key)
    this.map.set(key, String(value))
  }
  snapshot() { return Object.fromEntries(this.map) }
}

async function record(target_key, text, cls) {
  return {class: cls, target_key, text, text_sha256: await sha256Hex(text)}
}

async function verified({policy = POLICY_EMPTY, owner_replace = false, present = [], records} = {}) {
  return {
    status: 'verified',
    admission: NAME,
    bundle_digest_sha256: '0123456789abcdef'.repeat(4),
    adoption_sha256: 'unused-by-webview',
    apply_policy: policy,
    owner_replace,
    candidate_keys_present: present,
    records: records ?? [
      await record(NS, NEW_BOOK, 'workspace-book'),
      await record(NS + '.stage', JOURNAL, 'checkpoint-journal'),
      await record(DRAFT_KEY, DRAFT, 'draft'),
    ],
  }
}

function deps(store, pending, confirmations = []) {
  return {
    store,
    namespace: NS,
    read: async () => pending,
    confirm: async confirmation => { confirmations.push(confirmation) },
  }
}

test('an empty candidate namespace takes every admitted record, the book last, then confirms once', async () => {
  const store = new FakeStore()
  const confirmations = []
  const outcome = await applyPendingAdmission(deps(store, await verified(), confirmations))
  assert.equal(outcome.status, 'applied')
  assert.equal(outcome.records, 3)
  assert.equal(outcome.written, 3)
  assert.equal(outcome.preserved, null)
  assert.equal(outcome.confirmed, true)
  assert.equal(store.getItem(NS), NEW_BOOK)
  assert.equal(store.getItem(DRAFT_KEY), DRAFT)
  assert.equal(store.writes.at(-1), NS, 'the workspace book is written last')
  assert.deepEqual(confirmations, [{admission: NAME, applied: 3, preserved: null}])
})

test('a non-empty candidate namespace refuses by name under the default policy and writes nothing', async () => {
  const store = new FakeStore({[NS]: OLD_BOOK})
  const confirmations = []
  const before = store.snapshot()
  const outcome = await applyPendingAdmission(deps(store, await verified(), confirmations))
  assert.equal(outcome.status, 'refused')
  assert.match(outcome.reason, new RegExp(`already holds 1 key\\(s\\) \\(first: ${NS.replace(/\./g, '\\.')}\\)`))
  assert.deepEqual(store.snapshot(), before)
  assert.equal(store.writes.length, 0)
  assert.equal(confirmations.length, 0)
})

test('owner-replace copies every existing candidate key first, verifies the copies, then writes', async () => {
  const store = new FakeStore({[NS]: OLD_BOOK, [NS + '.layout']: 'legacy'})
  const confirmations = []
  const pending = await verified({policy: POLICY_PRESERVE, owner_replace: true, present: [NS, NS + '.layout']})
  const outcome = await applyPendingAdmission(deps(store, pending, confirmations))
  assert.equal(outcome.status, 'applied')
  const manifestKey = `${NS}.preserved.0123456789abcdef`
  assert.equal(outcome.preserved, manifestKey)
  assert.equal(store.getItem(NS), NEW_BOOK)
  const manifest = JSON.parse(store.getItem(manifestKey))
  assert.equal(manifest.schema, PRESERVED_SCHEMA)
  assert.deepEqual(manifest.entries.map(e => e.source_key).sort(), [NS, NS + '.layout'].sort())
  assert.equal(store.getItem(`${manifestKey}:${NS}`), OLD_BOOK, 'the prior book is preserved verbatim')
  assert.equal(store.getItem(NS + '.layout'), 'legacy', 'keys outside the admission are never removed')
  const firstWrite = store.writes.findIndex(key => !key.startsWith(manifestKey))
  assert.ok(store.writes.slice(0, firstWrite).every(key => key.startsWith(manifestKey)), 'every snapshot write precedes the first admitted write')
  assert.equal(store.writes.at(-1), NS)
  assert.deepEqual(confirmations, [{admission: NAME, applied: 3, preserved: manifestKey}])
})

test('owner-replace without the owner flag refuses before any write', async () => {
  const store = new FakeStore({[NS]: OLD_BOOK})
  const outcome = await applyPendingAdmission(deps(store, await verified({policy: POLICY_PRESERVE, owner_replace: false, present: [NS]})))
  assert.equal(outcome.status, 'refused')
  assert.equal(store.writes.length, 0)
})

test('a re-run after a complete apply writes nothing and confirms again with every record in place', async () => {
  const store = new FakeStore()
  const confirmations = []
  const pending = await verified()
  await applyPendingAdmission(deps(store, pending, confirmations))
  store.writes.length = 0
  const again = await applyPendingAdmission(deps(store, pending, confirmations))
  assert.equal(again.status, 'applied')
  assert.equal(again.written, 0)
  assert.equal(again.records, 3)
  assert.equal(store.writes.length, 0, 'the same key and value yield no change')
  assert.equal(confirmations.length, 2)
})

test('an interrupted default apply retries: keys already holding the admitted value do not refuse', async () => {
  // The first start wrote the draft and then failed before the book; the namespace is no longer empty.
  const store = new FakeStore({[DRAFT_KEY]: DRAFT})
  const outcome = await applyPendingAdmission(deps(store, await verified()))
  assert.equal(outcome.status, 'applied')
  assert.equal(outcome.written, 2)
  assert.equal(store.getItem(NS), NEW_BOOK)
})

test('owner-replace reuses its snapshot on a retry rather than copying a half-applied state', async () => {
  const store = new FakeStore({[NS]: OLD_BOOK})
  const pending = await verified({policy: POLICY_PRESERVE, owner_replace: true, present: [NS]})
  // Interrupt the first run after the snapshot is written and before the book lands.
  store.failOn = (key) => key === NS
  const failed = await applyPendingAdmission(deps(store, pending))
  assert.equal(failed.status, 'failed')
  const manifestKey = `${NS}.preserved.0123456789abcdef`
  const snapshot = JSON.parse(store.getItem(manifestKey))
  store.failOn = null
  store.writes.length = 0
  const retried = await applyPendingAdmission(deps(store, pending))
  assert.equal(retried.status, 'applied')
  assert.equal(retried.preserved, manifestKey)
  assert.deepEqual(JSON.parse(store.getItem(manifestKey)), snapshot, 'the original snapshot is kept, not replaced')
  assert.equal(store.getItem(`${manifestKey}:${NS}`), OLD_BOOK)
  assert.ok(store.writes.every(key => !key.includes('.preserved.')), 'a retry never copies the snapshot again')
})

test('a tampered record text is refused by its digest and nothing is written', async () => {
  const store = new FakeStore()
  const confirmations = []
  const pending = await verified()
  pending.records[0].text = JSON.stringify({version: 2, active: 'forged', workspaces: []})
  const outcome = await applyPendingAdmission(deps(store, pending, confirmations))
  assert.equal(outcome.status, 'refused')
  assert.match(outcome.reason, /admitted text digest differs for/)
  assert.equal(store.writes.length, 0)
  assert.equal(confirmations.length, 0)
})

test('a key outside the migrated register is refused by name', async () => {
  const store = new FakeStore()
  const pending = await verified({records: [await record('oi.other.app.secret', '{}', 'draft')]})
  const outcome = await applyVerifiedAdmission(store, NS, pending)
  assert.equal(outcome.status, 'refused')
  assert.match(outcome.reason, /is not a continuity key/)
  assert.equal(store.writes.length, 0)
})

test('a native refusal of a tampered admission applies nothing and reports the reason by name', async () => {
  const store = new FakeStore()
  const outcome = await applyPendingAdmission(deps(store, {status: 'refused', admission: NAME, reason: 'adoption.json differs from the digest ADMISSION.json recorded; nothing applies'}))
  assert.equal(outcome.status, 'refused')
  assert.equal(store.writes.length, 0)
  assert.match(admissionReport(outcome), /not applied \(admission-0123456789abcdef\): adoption\.json differs/)
})

test('a failed confirm after writes holds the workspace; the next run re-verifies and confirms', async () => {
  const store = new FakeStore()
  let attempts = 0
  const outcome = await applyPendingAdmission({
    store,
    namespace: NS,
    read: async () => verified(),
    confirm: async () => { attempts++; throw new Error('disk full') },
  })
  assert.equal(outcome.status, 'failed')
  assert.match(outcome.reason, /APPLIED could not be recorded/)
  assert.ok(outcome.written > 0, 'records are in place, so the workspace is held until the owner chooses')
  assert.equal(attempts, 1)
  assert.equal(store.getItem(NS), NEW_BOOK, 'the admitted records stay in place')
  const next = await applyPendingAdmission(deps(store, await verified()))
  assert.equal(next.status, 'applied')
  assert.equal(next.written, 0)
  assert.equal(next.confirmed, true)
})

test('a write that fails midway is a named failure, and no confirm is sent', async () => {
  const store = new FakeStore()
  store.failOn = (key) => key === NS
  const confirmations = []
  const outcome = await applyPendingAdmission(deps(store, await verified(), confirmations))
  assert.equal(outcome.status, 'failed')
  assert.match(outcome.reason, /could not be applied/)
  assert.equal(outcome.written, 2, 'the two non-book records landed before the book failed: a partial write, so the workspace is held')
  assert.match(outcome.reason, /2 admitted record\(s\) are in place but the rest are not/)
  assert.equal(confirmations.length, 0)
})

test('a write that fails before any admitted record lands writes nothing, so the workspace mounts', async () => {
  const store = new FakeStore()
  store.failOn = () => true
  const outcome = await applyPendingAdmission(deps(store, await verified()))
  assert.equal(outcome.status, 'failed')
  assert.equal(outcome.written, 0)
  assert.match(outcome.reason, /nothing admitted was written/)
  assert.equal(store.writes.length, 0)
})

test('an unreadable native reader writes nothing and does not hold the workspace (a permanent fault must not brick the start)', async () => {
  const store = new FakeStore()
  const outcome = await applyPendingAdmission({store, read: async () => { throw new Error('Permission denied') }, confirm: async () => {}})
  assert.equal(outcome.status, 'failed')
  assert.equal(outcome.written, 0)
  assert.match(outcome.reason, /could not be read \(Permission denied\); nothing was applied/)
  assert.equal(store.writes.length, 0)
})

test('a snapshot copy that no longer matches its record is refused before any write on retry', async () => {
  const store = new FakeStore({[NS]: OLD_BOOK})
  const pending = await verified({policy: POLICY_PRESERVE, owner_replace: true, present: [NS]})
  await applyPendingAdmission(deps(store, pending))
  store.setItem(`${NS}.preserved.0123456789abcdef:${NS}`, 'altered')
  store.writes.length = 0
  const outcome = await applyPendingAdmission(deps(store, pending))
  assert.equal(outcome.status, 'failed')
  assert.match(outcome.reason, /does not match its record/)
  assert.equal(store.writes.length, 0, 'a mismatched snapshot stops the apply before any write')
  assert.equal(outcome.written, 3, 'the earlier run left every admitted record in place: the namespace is not as it was, so the start holds')
})

test('status reports name the outcome once and stay silent when nothing was offered', () => {
  assert.equal(admissionReport({status: 'none'}), null)
  assert.match(admissionReport({status: 'applied', admission: NAME, records: 3, written: 2, preserved: null, confirmed: true}), /3 record\(s\), 2 written, 1 already in place/)
  assert.match(admissionReport({status: 'applied', admission: NAME, records: 3, written: 3, preserved: `${NS}.preserved.x`, confirmed: true}), /preserved under/)
})

test('the startup gate holds only after a partial write, and the hold offers the owner a start without the admission', async () => {
  const {readFile} = await import('node:fs/promises')
  const source = await readFile(new URL('../src/continuity/workspace.tsx', import.meta.url), 'utf8')
  assert.match(source, /outcome\.status === 'failed' && outcome\.written > 0 && !startWithout/)
  assert.match(source, /data-action="start-without-admission"/)
  assert.match(source, /written: 0, reason: `The owner-admitted continuity could not start/)
})

test('a retry after a partial write still holds: the records an earlier run left in place count, though this run wrote none', async () => {
  const store = new FakeStore()
  store.failOn = (key) => key === NS
  const first = await applyPendingAdmission(deps(store, await verified()))
  assert.equal(first.status, 'failed')
  assert.equal(first.written, 2)
  store.writes.length = 0
  const second = await applyPendingAdmission(deps(store, await verified()))
  assert.equal(second.status, 'failed')
  assert.equal(store.writes.length, 0, 'the retry skipped the records already in place')
  assert.equal(second.written, 2, 'the namespace is partial, so the workspace stays held')
  assert.doesNotMatch(second.reason, /nothing admitted was written/)
})

test('after a start without the admission, the next start refuses and says it needs a fresh owner-replace admission', async () => {
  const store = new FakeStore()
  store.failOn = (key) => key === NS
  await applyPendingAdmission(deps(store, await verified()))
  store.failOn = null
  store.setItem(NS, OLD_BOOK) // the candidate, started without the admission, writes its own workspace book
  const next = await applyPendingAdmission(deps(store, await verified()))
  assert.equal(next.status, 'refused')
  assert.match(next.reason, /admit it again with --owner-replace/)
})

test('the startup read is bounded, so a read that never answers does not hold the start', async () => {
  const {readFile} = await import('node:fs/promises')
  const source = await readFile(new URL('../src/continuity/workspace.tsx', import.meta.url), 'utf8')
  assert.match(source, /read: \(\) => withinReadBound\(tauriInvoke<PendingAdmission>\('live_shell_continuity_pending'/)
  assert.match(source, /const ADMISSION_READ_BOUND_MS = 15000/)
})
