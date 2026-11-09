// O-I #747 round 896, 1S (DLW build ruling 2026-11-09, review c99c L3): the frame's channels (expressions-boundary cradle.ts
// createCradleOwners) hand their helpers the wired transport (bridge.ts wireTransport), never the shell's own. A helper handed the shell's
// own would send a person act it asks for a frame's word by the person's press channel (kernelOp of an Action goes by `kernel_press`):
// dormant today, since no helper asks one, so the helper here is a stand-in that asks one. The Nara relay alone takes the shell's own
// transport: it wires it itself, and keeps the shell's only for the Day Return it offers for the person's own press
// (shell-window-channel-896.test.mjs pins that relay).
// SCRIPTED: the host's invoke, and the Library's reader (the helper behind the frame's `library-read` channel), which asks a person act
// on the transport it is handed and presses it. REAL: createCradleOwners and the kernel bridge.
import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {readFileSync} from 'node:fs'

const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
const bridge = new URL('../../../../desktop/cradle/src/kernel/bridge.ts', import.meta.url).href
// The Library's reader, stood in for: it reports whether its transport is the wired one, sends a person act by kernelOp, and presses it.
const reader = `data:text/javascript,${encodeURIComponent(`
import {kernelOp, kernelPress, isWireTransport} from ${JSON.stringify(bridge)};
const ACT = {op: 'invoke_action', project: null, invocation: {action: 'central.world.name', target_ref: 't', input: {}}};
export async function readLibrary(transport) {
  const sent = await kernelOp(transport, ACT);
  const pressed = await kernelPress(transport, ACT);
  return {wired: isWireTransport(transport), sent, pressed};
}`)}`
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(specifier,context,next){
  if(specifier.endsWith('/library/libraryReading'))return {url:${JSON.stringify(reader)},shortCircuit:true};
  try{return await next(specifier,context)}catch(error){
    if(!specifier.startsWith('.'))throw error;
    if(specifier.endsWith('.js')){try{return await next(specifier.slice(0,-3)+'.ts',context)}catch{}}
    for(const suffix of ['.ts','.tsx','/index.ts','/index.tsx']){try{return await next(specifier+suffix,context)}catch{}}
    throw error;
  }
}
export async function load(url,context,next){
  if(url.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export default null'};
  if(url.endsWith('.json'))return {format:'module',shortCircuit:true,source:'export default '+await readFile(new URL(url),'utf8')};
  if(url.split('?')[0].endsWith('.html')||url.split('?')[0].endsWith('.svg'))return {format:'module',shortCircuit:true,source:'export default '+JSON.stringify(await readFile(new URL(url.split('?')[0]),'utf8'))};
  if(url.endsWith('.ts')||url.endsWith('.tsx')){
    const source=await readFile(new URL(url).pathname,'utf8');
    const {outputText}=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:url});
    return {format:'module',shortCircuit:true,source:outputText};
  }
  return next(url,context);
}`)}`, {parentURL: import.meta.url})

const Bridge = await import('../../../../desktop/cradle/src/kernel/bridge.ts')
const {createCradleOwners} = await import('../../../expressions-boundary/src/cradle.ts')

/** The host's invoke, scripted: each command it is asked and the Action it names. */
async function overTheHost(run) {
  const invoked = []
  const prior = globalThis.window
  globalThis.window = {__TAURI_INTERNALS__: {invoke: async (command, args) => {
    invoked.push([command, args.op.op === 'invoke_action' ? args.op.invocation.action : args.op.op])
    return {result: 'action_dispatched', dispatch: {state: 'invoked', owner_operation: 'central.world.name', data: {results: []}}}
  }}}
  try { await run(); return invoked } finally {
    if (prior === undefined) delete globalThis.window; else globalThis.window = prior
  }
}

test('1S (L3): the frame\'s channels hand their helpers the wired transport: a helper\'s person act goes by kernel_op, and its press is refused in words, asking nothing', async () => {
  const owners = createCradleOwners({kind: 'tauri'}, {project: 'O-I'})
  let reply
  const invoked = await overTheHost(async () => { reply = await owners.channels['library-read']({scope: 'local'}) })
  assert.equal(reply.wired, true, 'the helper was handed the wired transport')
  assert.deepEqual(reply.pressed, {outcome: null, error: Bridge.FRAME_PRESSES_NOTHING})
  assert.deepEqual(invoked, [['kernel_op', 'central.world.name']], 'the person act went by the wire, where the kernel refuses it in words; the press asked nothing')
})

test('1S (L3): createCradleOwners names the shell\'s own transport only to wire it and to hand it to the Nara relay', () => {
  const text = readFileSync(new URL('../../../expressions-boundary/src/cradle.ts', import.meta.url), 'utf8')
  const start = text.indexOf('export function createCradleOwners(')
  const body = text.slice(start, text.indexOf('\n}\n', start))
  // Its code, comments and strings blanked.
  const code = body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
    .replace(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g, "''")
  assert.equal(code.match(/\btransport\b/g).length, 3, 'the signature, the wire, and the Nara relay')
  assert.match(code, /stop = relayNaraChannel\(frame, transport, \{/)
  assert.match(code, /^export function createCradleOwners\(transport: KernelTransportStatus, options: CradleOwnersOptions\): ExpressionsOwners \{\s*const wire = wireTransport\(transport\);/)
})
