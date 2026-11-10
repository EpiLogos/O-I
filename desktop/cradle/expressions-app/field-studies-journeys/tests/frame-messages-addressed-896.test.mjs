// O-I #747 round 896, 1R-surface.10 (DLW build ruling 2026-11-09): the frame's messages are addressed. The Expressions frame is served
// at an origin of its own (item 0.3), so every message it posts its host names the host's exact origin, never '*', and every message it
// reads is its host's only when the hosting window sent it from that origin: a message another window posts, or the hosting window's
// from another origin, is not heard. A frame not hosted sends nothing.
// SCRIPTED: the frame's window (its location and the browser's record of its host, its parent's postMessage, its listeners) and the
// messages that reach it. REAL: the frame's channels as its pages run them (the native field's channel, the kernel channel, the scene
// portal's request), bundled from source, and the sources of every module the frame's pages load.
import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync, statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const require = createRequire(import.meta.url);
const esbuild = require('esbuild');
const journeys = fileURLToPath(new URL('..', import.meta.url));
const app = join(journeys, '..');
const repo = join(journeys, '../../../..');
const out = mkdtempSync(join(tmpdir(), 'frame-messages-addressed-896-'));
after(() => rmSync(out, {recursive: true, force: true}));
const entry = join(out, 'entry.ts');
writeFileSync(entry, [
  `export {NativeChannel} from ${JSON.stringify(join(journeys, 'src/native-field/channel.ts'))};`,
  `export {installKernelExpressions, kernelExpressionsAvailable} from ${JSON.stringify(join(journeys, 'src/kernelExpressions.ts'))};`,
  `export {openScenePortal} from ${JSON.stringify(join(journeys, 'src/scenePortal.ts'))};`,
].join('\n'));
const outfile = join(out, 'entry.mjs');
const before = globalThis.window;
after(() => {if (before === undefined) delete globalThis.window; else globalThis.window = before;});
await esbuild.build({absWorkingDir: journeys, nodePaths: [join(journeys, '../node_modules')], entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile, logLevel: 'silent',
  loader: {'.woff': 'dataurl', '.woff2': 'dataurl', '.ttf': 'dataurl', '.svg': 'dataurl', '.png': 'dataurl', '.css': 'empty', '.html': 'text'}});
const M = await import(pathToFileURL(outfile).href);

const SHELL = 'tauri://localhost', FRAME = 'oi-material://application.localhost', FOREIGN = 'https://elsewhere.example';
const settle = () => new Promise(resolve => setImmediate(resolve));

/** The frame's window, hosted by a window at `host` (or not hosted, `host: null`): what it posts its parent, and `deliver` for a message
 * that reaches it from `source` (its parent by default) at `origin` (the host's by default). */
function frameWindow({host = SHELL} = {}) {
  const listeners = new Set(), posted = [];
  const win = {
    location: {origin: FRAME, href: `${FRAME}/__application/expressions/index.html`, ancestorOrigins: host ? {length: 1, 0: host} : {length: 0}},
    document: {referrer: ''},
    addEventListener: (type, listener) => {if (type === 'message') listeners.add(listener);},
    removeEventListener: (type, listener) => {if (type === 'message') listeners.delete(listener);},
    setTimeout, clearTimeout,
    postMessage(data, origin) {posted.push({to: 'itself', data, origin});},
  };
  win.parent = host ? {postMessage(data, origin) {posted.push({to: 'host', data, origin});}} : win;
  const other = {postMessage() {}};
  const deliver = (data, {origin = host, source = win.parent} = {}) => {for (const listener of [...listeners]) listener({data, origin, source});};
  globalThis.window = win;
  return {win, posted, deliver, other};
}

test('1R-surface.10: the native field\'s channel speaks to its host at the host\'s origin, and hears only its host', async () => {
  const {posted, deliver, other} = frameWindow();
  const port = new M.NativeChannel();
  assert.deepEqual(posted.map(row => [row.to, row.origin, row.data.kind]), [['host', SHELL, 'hello']], 'the hello names the host\'s origin');
  const available = {schema: 'oi.native-expression/v1', kind: 'available', epoch: 'e1', available: true};
  deliver(available, {origin: FOREIGN});
  assert.equal(port.available, false, 'the hosting window\'s message from another origin is not heard');
  deliver(available, {source: other});
  assert.equal(port.available, false, 'another window\'s message at the host\'s origin is not heard');
  deliver(available);
  assert.equal(port.available, true, 'the host\'s, from its origin, is');
  const asked = port.request({operation: 'read'}, 5000);
  const request = posted.at(-1);
  assert.deepEqual([request.to, request.origin, request.data.kind], ['host', SHELL, 'request']);
  deliver({schema: 'oi.native-expression/v1', kind: 'result', epoch: 'e1', req: request.data.req, ok: true, data: {forged: true}}, {origin: FOREIGN});
  deliver({schema: 'oi.native-expression/v1', kind: 'result', epoch: 'e1', req: request.data.req, ok: true, data: {answered: true}});
  assert.deepEqual(await asked, {answered: true}, 'the answer is the host\'s, the forged one unheard');
  port.beat();
  port.dispose();
  assert.ok(posted.every(row => row.to === 'host' && row.origin === SHELL), 'every message goes to the host\'s exact origin, never \'*\'');
});

test('1R-surface.10: the kernel channel stands only on its host\'s announce, from the host\'s origin', async () => {
  const {posted, deliver} = frameWindow();
  M.installKernelExpressions();
  assert.deepEqual(posted.map(row => [row.to, row.origin, row.data.kind]), [['host', SHELL, 'oi-kernel-hello']]);
  deliver({v: 1, kind: 'oi-kernel-channel', channel: 'kernel-expression'}, {origin: FOREIGN});
  assert.equal(M.kernelExpressionsAvailable(), false, 'a forged announce from another origin does not stand the channel');
  deliver({v: 1, kind: 'oi-kernel-channel', channel: 'kernel-expression'});
  assert.equal(M.kernelExpressionsAvailable(), true);
});

test('1R-surface.10: a scene portal is asked of the host at its origin, and settled only by the host\'s answer', async () => {
  const {posted, deliver} = frameWindow();
  let settled = null;
  const asked = M.openScenePortal('expression:e:trigger:p1', {expression_ref: 'expression:e', revision: 3, scene_ref: 'scene:one'})
    .then(note => {settled = {note};}, error => {settled = {error: error.message};});
  const request = posted.at(-1);
  assert.deepEqual([request.to, request.origin, request.data.kind, request.data.request], ['host', SHELL, 'host-request', 'scene-portal']);
  deliver({v: 1, kind: 'scene-portal-result', request_id: request.data.request_id, ok: false, error: 'forged'}, {origin: FOREIGN});
  await settle();
  assert.equal(settled, null, 'a forged answer from another origin does not settle the ask');
  deliver({v: 1, kind: 'scene-portal-result', request_id: request.data.request_id, ok: true, note: 'placed beside'});
  await asked;
  assert.deepEqual(settled, {note: 'placed beside'});
});

test('1R-surface.10: a frame not hosted posts nothing, not even to itself', () => {
  const {posted, deliver} = frameWindow({host: null});
  const port = new M.NativeChannel();
  deliver({schema: 'oi.native-expression/v1', kind: 'available', epoch: 'e1', available: true}, {origin: FRAME});
  assert.equal(port.available, false, 'its own message is not its host\'s');
  port.dispose();
  assert.deepEqual(posted, []);
});

// Every module the frame's pages (index, legacy, library, render) load, type-only imports aside.
const strip = source => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
function framePagesModules() {
  const pages = ['index.html', 'legacy.html', 'library.html', 'render.html'];
  const entries = pages.flatMap(page => [...readFileSync(join(app, page), 'utf8').matchAll(/<script[^>]*\bsrc="\/([^"]+)"/g)].map(m => join(app, m[1])));
  assert.equal(entries.length, pages.length);
  const file = base => {
    for (const suffix of ['', '.ts', '.tsx', '.js', '/index.ts', '/index.tsx']) if (existsSync(base + suffix) && statSync(base + suffix).isFile()) return base + suffix;
    return base.endsWith('.js') ? file(base.slice(0, -3)) : null;
  };
  const seen = new Set(), queue = [...entries];
  while (queue.length) {
    const at = queue.shift();
    if (seen.has(at) || !/\.(ts|tsx|js|mjs)$/.test(at)) continue;
    seen.add(at);
    const code = strip(readFileSync(at, 'utf8')).replace(/(?:import|export)\s+type\s[^;]*?from\s*['"][^'"]+['"]/g, '');
    for (const m of code.matchAll(/(?:from\s*|import\s*\(\s*|import\s+)['"](\.[^'"]+)['"]/g)) {const next = file(resolve(dirname(at), m[1])); if (next) queue.push(next);}
  }
  return [...seen];
}
/** The modules that address their host with a window given them: they name the host's origin and check it themselves. */
const OWN_ADDRESS = {
  'desktop/cradle/expressions-app/field-studies-journeys/src/hostChannel.ts': 'the frame\'s channel to its host',
  'desktop/cradle/expressions-app/field-studies-journeys/src/hostEditor.ts': 'the editor channel: posts to hostOrigin(target), reads event.origin',
  'packages/expressions-boundary/src/storageCarry.ts': 'the storage carry: posts to knownHostOrigin(target), reads event.origin',
};
/** The modules that post only on a MessageChannel of their own: a task queued for themselves, never a message to a window or a host. */
const OWN_PORT = {
  'desktop/cradle/expressions-app/src/engine/PointCloudField.ts': 'a hidden wake\'s next task (1T.0.1: stepWake), queued on a channel it makes',
};
/** Every post of the module is on a port of a channel it makes (`new MessageChannel()`, `….port1` or `….port2`). */
const ownPortOnly = code => /\bnew MessageChannel\(\)/.test(code) && [...code.matchAll(/([\w$.]+)\.postMessage\(/g)].every(m => /\.port[12]$/.test(m[1]));

test('1R-surface.10: no module the frame\'s pages load posts to \'*\' or reads a message by its source alone', () => {
  const modules = framePagesModules().map(at => ({at: at.slice(repo.length + 1), code: strip(readFileSync(at, 'utf8'))}));
  assert.ok(modules.some(m => m.at.endsWith('field-studies-journeys/src/app.ts')) && modules.some(m => m.at.endsWith('native-field/channel.ts')));
  const starred = [], unchecked = [], bySource = [], posting = [];
  for (const {at, code} of modules) {
    if (/postMessage\([^;]*?,\s*['"]\*['"]\s*\)/.test(code)) starred.push(at);
    if (/\.source\s*[!=]==?\s*window\.parent|window\.parent\s*[!=]==?\s*[A-Za-z]+\.source/.test(code)) bySource.push(at);
    if (/\.postMessage\(/.test(code) && !(at in OWN_ADDRESS) && !(at in OWN_PORT && ownPortOnly(code))) posting.push(at);
    if (/addEventListener\(\s*['"]message['"]/.test(code) && !(at in OWN_ADDRESS) && !/\bfromHost\(/.test(code)) unchecked.push(at);
  }
  assert.deepEqual(starred, [], 'a frame module posting to \'*\'');
  assert.deepEqual(bySource, [], 'a frame module reading its host\'s messages by their source alone');
  assert.deepEqual(posting, [], 'a frame module posting other than through postToHost');
  assert.deepEqual(unchecked, [], 'a frame module hearing messages it does not check are its host\'s');
  for (const [at, why] of Object.entries(OWN_ADDRESS)) {
    const own = modules.find(m => m.at === at);
    assert.ok(own, `${at} is loaded by the frame's pages (${why})`);
    if (/addEventListener\(\s*['"]message['"]/.test(own.code)) assert.match(own.code, /\.origin\s*!==\s*host|event\.origin\s*!==/, `${at} reads the host's origin`);
  }
  for (const [at, why] of Object.entries(OWN_PORT)) {
    const own = modules.find(m => m.at === at);
    assert.ok(own, `${at} is loaded by the frame's pages (${why})`);
    assert.ok(ownPortOnly(own.code), `${at} posts only on a channel of its own (${why})`);
  }
  // A post on a window is never taken for a channel's: the scan's own reading of the two.
  assert.equal(ownPortOnly('const c = new MessageChannel(); c.port2.postMessage(null);'), true);
  assert.equal(ownPortOnly('const c = new MessageChannel(); c.port2.postMessage(null); window.parent.postMessage(m, origin);'), false);
  assert.equal(ownPortOnly('port.port2.postMessage(null);'), false, 'a channel it did not make');
});
