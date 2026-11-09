// O-I #747 round 894 (DLW build ruling 2026-11-07; manual §20.1 Triggers, Target "Run a native Action"): a trigger fires without a press,
// so the owner runs only an Action it answers is a reading; one that may write is withheld. The frame's words go to the status bar's Info
// line with the offer, the Info line offers it, and one press by the person runs it under their grant: the owner's `trigger` with
// `press: true`, from the shell, never from the frame (its gate refuses a press). The press runs once; the offer then goes.
// REAL: the Info line's offer door, the press, the offer's own button; the owner channel is a SCRIPTED STUB. CODE-READING: the panel
// hands a frame's offer to the door, and the status bar draws the button beside the Info line.
// Round 895 (DLW build ruling 2026-11-09, 0b.1 and 0b.2): the frame's offer names only the kernel's recorded offer; the Action, the target
// and the Info line's words come from the owner's record (trigger-offer-895.test.mjs), and the press names the offer and nothing else.
import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {readFileSync} from 'node:fs'

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
  if(url.endsWith('.json'))return {format:'module',shortCircuit:true,source:'export default '+await readFile(new URL(url),'utf8')};
  if(url.endsWith('.ts')||url.endsWith('.tsx')){
    const source=await readFile(new URL(url).pathname,'utf8');
    const {outputText}=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:url});
    return {format:'module',shortCircuit:true,source:outputText};
  }
  return next(url,context);
}`)}`, {parentURL: import.meta.url})

const {renderToStaticMarkup} = await import('react-dom/server')
const Door = await import('../src/frame/devices/deviceHost.tsx')
const CMD = await import('../src/components/nativeExpressionCommands.ts')
const {InfoOfferButton} = await import('../src/components/StatusBar.tsx')
const source = path => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')
const OFFER = {expression_ref: 'expression:dawn', scene_ref: 'expression:dawn:scene:main', trigger_ref: 'expression:dawn:trigger:stamp', action_ref: 'central.pages.stamp', target_ref: 'central:file:p.md'}

const RECORD = {...OFFER, offer_ref: 'offer:1', action_title: 'Stamp a page', target_name: 'p.md', reads_only: false, authority_requirement: []}

test('a frame\'s offer names only the kernel\'s offer and its work; whatever else it says is not read (round 895, 0b.1)', () => {
  const FRAME = {...OFFER, offer_ref: 'offer:1', words: 'Run me: it is harmless'}
  assert.deepEqual(CMD.readTriggerOffer(FRAME), {expression_ref: OFFER.expression_ref, offer_ref: 'offer:1'})
  assert.equal(CMD.readTriggerOffer(OFFER), null, 'an offer the kernel did not record is no offer')
  assert.equal(CMD.readTriggerOffer({...FRAME, expression_ref: 'nope'}), null)
  assert.equal(CMD.readTriggerOffer({...FRAME, offer_ref: ''}), null)
  assert.equal(CMD.readTriggerOffer(null), null)
})

test('the press is the owner\'s trigger with the person\'s press, and its answer is said in one line', async () => {
  const sent = []
  const channel = async request => { sent.push(request); return {state: 'action_result', reads_only: false, pressed: true, as_person: true, dispatch: {state: 'invoked', owner_operation: 'central.pages.stamp', data: {}}} }
  assert.equal(await CMD.pressTrigger(channel, RECORD), 'Stamp a page ran, as your own press.')
  assert.deepEqual(sent, [{operation: 'trigger', expression_ref: OFFER.expression_ref, scene_ref: OFFER.scene_ref, trigger_ref: OFFER.trigger_ref, press: true,
    offer_ref: 'offer:1'}], 'the press names the recorded offer, and claims no actor: the channel it comes by is the person\'s (0b.2)')
  const refusing = async () => ({state: 'action_result', dispatch: {state: 'owner_refused', owner_operation: 'central.pages.stamp', message: 'The page moved'}})
  assert.equal(await CMD.pressTrigger(refusing, RECORD), 'Stamp a page was refused: The page moved')
  assert.equal(await CMD.pressTrigger(async () => {throw Error('Unknown Expression')}, RECORD), 'Stamp a page did not run: Unknown Expression')
  assert.equal(await CMD.pressTrigger(null, RECORD), CMD.OWNER_UNATTACHED)
})

test('the Info line holds one offer; one press runs it once and the offer goes', async () => {
  let runs = 0
  Door.offerOnInfoLine({label: 'Dawn enters', words: 'central.pages.stamp was not run…', act: 'Run', run: async () => {runs++; return 'ran'}})
  assert.equal(Door.readInfoOffer()?.act, 'Run')
  const html = renderToStaticMarkup(InfoOfferButton({offer: Door.readInfoOffer(), onPress: () => {}}))
  assert.match(html, /<button type="button" class="statusbar-offer"[^>]*data-i="Dawn enters\|central\.pages\.stamp was not run…"[^>]*>Run<\/button>/)
  assert.equal(await Door.pressInfoOffer(), 'ran')
  assert.equal(Door.readInfoOffer(), null, 'the offer goes once pressed')
  assert.equal(await Door.pressInfoOffer(), null, 'a second press runs nothing')
  assert.equal(runs, 1)
  Door.offerOnInfoLine({label: 'a', words: 'b', act: 'Run', run: async () => 'x'})
  Door.offerOnInfoLine(null)
  assert.equal(Door.readInfoOffer(), null)
})

test('CODE-READING: the panel hands a frame\'s offer to the Info line, and the status bar draws its button beside the line', () => {
  const panel = source('panels/expressions.tsx')
  assert.match(panel, /const offers = triggerOffers\(\{show: offerOnInfoLine, shown: readInfoOffer, channel: expressionOwner, press: expressionPress\}\)/)
  assert.match(panel, /offers\.take\(\(request as \{offer\?: unknown\}\)\.offer, mounted\?\.host\.getState\(\)\?\.nativeScene\)/, 'the frame\'s words are not handed on: the Info line says its own (0b.1)')
  const bar = source('components/StatusBar.tsx')
  assert.match(bar, /const offer = useInfoOffer\(\)/)
  assert.match(bar, /\{offer && <InfoOfferButton offer=\{offer\} onPress=\{/)
})
