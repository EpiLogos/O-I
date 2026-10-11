import test from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';

// Production sources in memory through the sibling composition loader: .ts is
// transpiled, .css is a non-executing stub. The app shell (DOM, DOM-mounted
// Studio) is not imported; its nav list and placement are pure modules.
const root = new URL('../../../../', import.meta.url);
const compiler = new URL('desktop/cradle/node_modules/typescript/lib/typescript.js', root).href;
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
}`)}`, import.meta.url);

const app = new URL('desktop/cradle/expressions-app/field-studies-journeys/src/', root);
const [studio, boundary, protocol, {deviceCatalogue}, openStudio] = await Promise.all([
  import(new URL('studioSections.ts', app)),
  import(new URL('packages/expressions-boundary/src/host.ts', root)),
  import(new URL('packages/expressions-boundary/src/protocol.ts', root)),
  import('../src/components/nativeDeviceCatalogue.ts'),
  import('../src/native/openStudio.ts'),
]);
const {STUDIO_SECTIONS, isStudioSection, studioPlacement} = studio;
const {ExpressionsHost} = boundary;
const {CHANNEL_VERSION, OPEN_STUDIO_COMMAND, readOpenStudioResult} = protocol;
const {parseNativeOpenStudio, NATIVE_OPEN_STUDIO, NATIVE_PRESENT_EXPRESSIONS} = openStudio;

const origin = 'http://127.0.0.1:8788';
const READY = {v: CHANNEL_VERSION, kind: 'oi-app-state', state: {hostMode: 'expressions', sceneCount: 1,
  document: {id: 'expression:kept', name: 'Kept work'}, nativeScene: {expression_ref: 'expression:kept', revision: 3, scene_ref: 'scene:one'}}};

/** The real ExpressionsHost over a stubbed frame: every posted message is recorded. */
function aperture(t, options = {}) {
  const sent = [], results = [];
  let presented = true;
  const frame = new EventTarget();
  frame.src = `${origin}/__application/expressions/index.html`;
  frame.contentWindow = {postMessage(data, targetOrigin) {assert.equal(targetOrigin, origin); sent.push(data);}};
  frame.closest = () => null;
  const host = new ExpressionsHost(frame, {bindingId: 'world.expressions', owners: {channels: {}}, messageTarget: new EventTarget(),
    handshakeTimeoutMs: 60000, isPresented: () => presented, onStudioResult: result => results.push(result), ...options});
  t.after(() => host.dispose());
  const deliver = data => host.handleMessage({source: frame.contentWindow, origin, data});
  const commands = () => sent.filter(data => data.kind === 'host-command' && data.command === OPEN_STUDIO_COMMAND);
  return {frame, host, deliver, sent, results, commands, conceal: () => {presented = false}, reveal: () => {presented = true}};
}

test('the Studio section list is the nav: unique ids, and only those ids validate', () => {
  const ids = STUDIO_SECTIONS.map(([id]) => id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(ids.length, 20);
  for (const id of ids) assert.equal(isStudioSection(id), true, id);
  for (const hostile of ['', 'Physics', 'physics ', 'constructor', '__proto__', 'toString', 'hasOwnProperty', '../physics', 'physics\n', 4, null, undefined, {}, ['physics']]) {
    assert.equal(isStudioSection(hostile), false, JSON.stringify(hostile));
  }
});

test('every device the shell can place declares a real Studio section', () => {
  const devices = deviceCatalogue();
  assert.ok(devices.length >= 12, 'at least the original twelve devices');
  const table = [];
  for (const device of devices) {
    assert.equal(isStudioSection(device.studio), true, `${device.family} declares studio ${JSON.stringify(device.studio)}`);
    const placed = studioPlacement(device.studio);
    assert.ok(['objects', 'motion', 'scene', 'field', 'appearance'].includes(placed.tab) || typeof placed.tab === 'string', device.family);
    table.push([device.family, device.studio]);
  }
  const used = new Set(table.map(([, id]) => id));
  for (const id of ['appearance', 'collision', 'focus', 'formations', 'motion', 'physics', 'pointer', 'relational', 'resonance', 'volume']) assert.ok(used.has(id), `a device opens ${id}`);
});

test('section placement matches the nav handler for the sections devices open', () => {
  assert.deepEqual(studioPlacement('physics'), {tab: 'field', motionTab: 'sequence'});
  assert.deepEqual(studioPlacement('motion'), {tab: 'motion', motionTab: 'morph'});
  assert.deepEqual(studioPlacement('automation'), {tab: 'motion', motionTab: 'automation'});
  assert.deepEqual(studioPlacement('focus'), {tab: 'motion', motionTab: 'focus'});
  assert.deepEqual(studioPlacement('formations'), {tab: 'objects', motionTab: 'sequence'});
  assert.deepEqual(studioPlacement('scene'), {tab: 'scene', motionTab: 'sequence'});
});

test('protocol accepts the open-studio command name and reads only well-formed answers', () => {
  assert.equal(OPEN_STUDIO_COMMAND, 'open-studio');
  const answer = (over) => ({v: 1, kind: 'host-command-result', command: 'open-studio', ...over});
  assert.deepEqual(readOpenStudioResult(answer({ok: true, section: 'physics'})), {ok: true, section: 'physics'});
  assert.deepEqual(readOpenStudioResult(answer({ok: false, error: 'Unknown Expressions Studio section'})), {ok: false, error: 'Unknown Expressions Studio section'});
  assert.equal(readOpenStudioResult(answer({ok: true, section: 'nope'})), null);
  assert.equal(readOpenStudioResult(answer({ok: 'yes', section: 'physics'})), null);
  assert.equal(readOpenStudioResult(answer({ok: false, error: 'bad\u0007'})), null);
  assert.equal(readOpenStudioResult(answer({ok: false, error: 'x'.repeat(513)})), null);
  assert.equal(readOpenStudioResult({v: 1, kind: 'host-command-result', command: 'open-expression', ok: true, section: 'physics'}), null);
});

test('the host posts exactly the typed open-studio command once the application is ready', async t => {
  const a = aperture(t);
  await a.deliver(READY);
  a.host.openStudio('physics');
  assert.deepEqual(a.commands(), [{v: 1, kind: 'host-command', command: 'open-studio', section: 'physics'}]);
});

test('the host refuses an unknown section, a concealed host, and a disposed host without posting', async t => {
  const a = aperture(t);
  await a.deliver(READY);
  const before = a.sent.length;
  for (const bad of ['nope', 'constructor', '', 7]) assert.throws(() => a.host.openStudio(bad), /Unknown Expressions Studio section/);
  assert.equal(a.sent.length, before);
  a.conceal();
  assert.throws(() => a.host.openStudio('physics'), /concealed/);
  assert.equal(a.commands().length, 0);
  a.reveal();
  a.host.dispose();
  assert.throws(() => a.host.openStudio('physics'), /disposed/);
  assert.equal(a.commands().length, 0);
});

test('a request made before the application is ready is queued and sent on its first state reading', async t => {
  const a = aperture(t);
  a.host.openStudio('motion');
  assert.equal(a.commands().length, 0);
  await a.deliver(READY);
  assert.deepEqual(a.commands(), [{v: 1, kind: 'host-command', command: 'open-studio', section: 'motion'}]);
  await a.deliver(READY);
  assert.equal(a.commands().length, 1, 'a queued request is sent once');
});

test('a queued request dies with the document it was asked of', async t => {
  const a = aperture(t);
  a.host.openStudio('motion');
  a.frame.dispatchEvent(new Event('load'));
  await a.deliver(READY);
  assert.equal(a.commands().length, 0);
});

test('the application answer is delivered to the host, and malformed answers are not', async t => {
  const a = aperture(t);
  await a.deliver(READY);
  await a.deliver({v: 1, kind: 'host-command-result', command: 'open-studio', ok: false, error: 'This Studio section is not offered in this application cut'});
  await a.deliver({v: 1, kind: 'host-command-result', command: 'open-studio', ok: true, section: 'physics'});
  await a.deliver({v: 1, kind: 'host-command-result', command: 'open-studio', ok: 'no', error: 'x'});
  await a.deliver({v: 1, kind: 'host-command-result', command: 'open-expression', ok: true, section: 'physics'});
  assert.deepEqual(a.results, [
    {ok: false, error: 'This Studio section is not offered in this application cut'},
    {ok: true, section: 'physics'},
  ]);
  assert.equal(a.sent.filter(data => data.kind === 'host-command-result').length, 0, 'an answer is never echoed back');
});

test('the event parser accepts a typed section and ignores every other detail', () => {
  assert.equal(NATIVE_OPEN_STUDIO, 'oi:native-open-studio');
  assert.equal(NATIVE_PRESENT_EXPRESSIONS, 'oi:native-present-expressions');
  assert.equal(parseNativeOpenStudio({section: 'physics'}), 'physics');
  assert.equal(parseNativeOpenStudio({section: 'native'}), 'native');
  for (const malformed of [null, undefined, 'physics', ['physics'], {}, {section: 'Physics'}, {section: 'constructor'}, {section: ['physics']}, {section: 7}]) {
    assert.equal(parseNativeOpenStudio(malformed), null, JSON.stringify(malformed));
  }
});
