import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

// W1 (T-WORLDS §3: "The workspace book persists to browser storage today. Give it a native owner with revisions"): the book's owner
// is the native host (desktop/cradle/src-tauri/src/workspace_book.rs: one file, a revision per write, the copies before it kept);
// the browser's storage is the working copy the store reads while rendering. Before the book mounts the owner's book stands over the
// working copy when it is of another revision; each change is kept on the owner on the revision last read, and a moved book is read
// again and kept on its revision. Channels: SCRIPTED — a fixture host and storage; CODE-READING — the provider's gate and the host's
// commands. The Rust owner's own tests stand in workspace_book.rs. NOT a screen pass.
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(specifier,context,next){
  try{return await next(specifier,context)}catch(error){
    if(!specifier.startsWith('.'))throw error;
    for(const suffix of ['.ts','.tsx','/index.ts']){try{return await next(specifier+suffix,context)}catch{}}
    throw error;
  }
}
export async function load(url,context,next){
  if(url.endsWith('.ts')||url.endsWith('.tsx')){
    const source=await readFile(new URL(url).pathname,'utf8');
    const {outputText}=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:url});
    return {format:'module',shortCircuit:true,source:outputText};
  }
  return next(url,context);
}`)}`, {parentURL: import.meta.url})

const {readFile} = await import('node:fs/promises')
const native = await import('../src/continuity/nativeBook.ts')
const KEY = 'oi.live-shell.candidate.workspace.v2'

const storage = () => { const held = new Map(); return {held, getItem: key => held.get(key) ?? null, setItem: (key, value) => held.set(key, value)} }
/** A host that keeps one book with a revision per write, as workspace_book.rs does. */
function host(start = null) {
  let book = start, n = start ? 1 : 0, writes = []
  return {
    writes,
    get revision() { return book ? `book/${n}` : null },
    read: async () => ({book, revision: book ? `book/${n}` : null, history: []}),
    write: async (expected, next) => {
      const current = book ? `book/${n}` : null
      writes.push(expected)
      if (current !== expected) throw new Error(`The workspace book moved since it was read (the owner holds ${current ?? 'no book'})`)
      book = next; n += 1
      return {revision: `book/${n}`}
    },
    moveBy: () => { n += 1 },
  }
}
const BOOK = {version: 2, active: 'a', workspaces: [{id: 'a', name: 'Writing'}]}

test('before the book mounts, the owner\'s book stands over the working copy when it is of another revision', async () => {
  const s = storage(); s.setItem(KEY, JSON.stringify({version: 2, active: 'old', workspaces: []}))
  const seeded = await native.seedFromNative(host(BOOK), s, KEY)
  assert.deepEqual(seeded, {seeded: true, revision: 'book/1'})
  assert.deepEqual(JSON.parse(s.getItem(KEY)), BOOK); assert.equal(s.getItem(native.nativeRevisionKey(KEY)), 'book/1')
  assert.deepEqual(await native.seedFromNative(host(BOOK), s, KEY), {seeded: false, revision: 'book/1'}, 'the same revision: the working copy stands')
})

test('with no native book the working copy stands; an owner that does not answer leaves it too, and says so', async () => {
  const s = storage(); s.setItem(KEY, JSON.stringify(BOOK))
  assert.deepEqual(await native.seedFromNative(host(null), s, KEY), {seeded: false, revision: null})
  const silent = {read: async () => { throw new Error('no answer within 15 s') }, write: async () => ({revision: 'x'})}
  const quiet = await native.seedFromNative(silent, s, KEY)
  assert.equal(quiet.seeded, false); assert.match(quiet.fault, /did not answer \(no answer within 15 s\); the working copy stands/)
  assert.deepEqual(JSON.parse(s.getItem(KEY)), BOOK)
})

test('each change is kept on the owner after a pause, on the revision last kept; a burst is one write', async () => {
  const s = storage(), h = host(null), faults = []
  const keeper = native.createBookKeeper(h, s, KEY, words => faults.push(words), 5)
  keeper.keep({...BOOK, active: 'a'}); keeper.keep({...BOOK, active: 'b'}); keeper.keep(BOOK)
  await keeper.flush()
  assert.deepEqual(h.writes, [null], 'the first write is made on no book, once for the burst')
  assert.equal(s.getItem(native.nativeRevisionKey(KEY)), 'book/1')
  keeper.keep({...BOOK, active: 'b'}); await keeper.flush()
  assert.deepEqual(h.writes, [null, 'book/1']); assert.equal(keeper.revision(), 'book/2')
  assert.deepEqual(faults, [null, null])
})

test('a book that moved since is read again and kept on its revision; the owner keeps the copy it replaced', async () => {
  const s = storage(), h = host(BOOK), faults = []
  s.setItem(native.nativeRevisionKey(KEY), 'book/1')
  const keeper = native.createBookKeeper(h, s, KEY, words => faults.push(words), 5)
  h.moveBy()
  keeper.keep({...BOOK, active: 'b'}); await keeper.flush()
  assert.deepEqual(h.writes, ['book/1', 'book/2'], 'refused on the stale revision, kept on the one read again')
  assert.equal(keeper.revision(), 'book/3'); assert.deepEqual(faults, [null])
})

test('the provider reads the owner after the admission and before the book mounts; the host carries the two commands (code-reading)', async () => {
  const provider = await readFile(new URL('../src/continuity/workspace.tsx', import.meta.url), 'utf8')
  assert.match(provider, /tauriInvoke<NativeBookReading>\('live_shell_book_read', \{\}\)/)
  assert.match(provider, /tauriInvoke<\{revision: string; unchanged\?: boolean\}>\('live_shell_book_write', \{expectedRevision, book\}\)/)
  assert.match(provider, /seedOnce\(outcome\.status === 'applied'\)/, 'a book the admission just wrote is the newer')
  assert.match(provider, /if \(!seeded\) return <p role="status"[^>]*>Reading the workspace book…<\/p>/)
  const host = await readFile(new URL('../../../../desktop/cradle/src-tauri/src/native_shell.rs', import.meta.url), 'utf8')
  assert.match(host, /pub async fn live_shell_book_read\(/); assert.match(host, /pub async fn live_shell_book_write\(/)
  assert.match(host, /continuity_home\(\)\?\.0\.join\("workspace-book"\)/, 'the book lives in the candidate\'s own data home')
  const main = await readFile(new URL('../../../../desktop/cradle/src-tauri/src/main.rs', import.meta.url), 'utf8')
  assert.match(main, /native_shell::live_shell_book_read,native_shell::live_shell_book_write,/)
  const capability = await readFile(new URL('../../../../desktop/cradle/src-tauri/capabilities/native-shell.json', import.meta.url), 'utf8')
  assert.match(capability, /"allow-live-shell-book-read", "allow-live-shell-book-write"/)
})
