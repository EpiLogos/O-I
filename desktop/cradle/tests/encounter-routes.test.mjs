// O-I #1003 (one census), review finding 12: a conversation tab's route choices are the census's agents a person can talk to, as the
// chat offers them (AgentChat: censusConnections(census, providers)), never AIKit's stored provider rows. AIKit adds detail to a
// choice (its provider facts), never a choice; with none to offer, the tab says no agent here can be talked to, with the census's why.
// Channels: SCRIPTED — the census is the World Model's agents slice as the kernel answers it (census.rs), the providers AIKit's
// stored rows as `encounter providers` answers them; the surface is rendered on the server with its two stores stubbed (the session
// store and the World Model's), since both hold their readings in useSyncExternalStore. Not a screen pass.
import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp, rm} from 'node:fs/promises';
import {join, dirname, sep} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

const here = dirname(fileURLToPath(import.meta.url));
const temp = await mkdtemp(join(here, '.encounter-routes-'));
test.after(() => rm(temp, {recursive: true, force: true}));
const sessionModule = join(here, '../src/encounter/session.ts');
/** The surface's two stores, stubbed where the surface and the census read them: the session handle and the agents slice come from
 * the test. Everything else (census.ts, EncounterView, the session module's pure readers) is the product's own code. */
const stores = {
  name: 'encounter-route-stores',
  setup(built) {
    const from = (args, file) => args.importer.endsWith(file);
    built.onResolve({filter: /^\.\/session$/}, args => from(args, `${sep}encounter${sep}EncounterSurface.tsx`) ? {path: 'session', namespace: 'stub'} : undefined);
    built.onResolve({filter: /^\.\.\/kernel\/KernelProvider$/}, args => from(args, `${sep}encounter${sep}EncounterSurface.tsx`) ? {path: 'kernel', namespace: 'stub'} : undefined);
    built.onResolve({filter: /owners\/model$/}, args => from(args, `${sep}agency${sep}census.ts`) ? {path: 'model', namespace: 'stub'} : undefined);
    built.onLoad({filter: /.*/, namespace: 'stub'}, args => ({
      session: {contents: `export * from ${JSON.stringify(sessionModule)};\nexport function useEncounterSession(){return globalThis.__encounterHandle;}`, resolveDir: here, loader: 'js'},
      kernel: {contents: `export function useKernel(){return {transport:{kind:'tauri'}};}`, loader: 'js'},
      model: {contents: `export function useModelSlice(){return globalThis.__agentsSlice;}`, loader: 'js'},
    })[args.path]);
  },
};
await build({
  entryPoints: {surface: join(here, '../src/encounter/EncounterSurface.tsx'), view: join(here, '../src/encounter/EncounterView.tsx'), census: join(here, '../src/agency/census.ts')},
  bundle: true, platform: 'node', format: 'esm', jsx: 'automatic', define: {__CRADLE_WALK__: 'false'},
  loader: {'.css': 'empty'}, external: ['react', 'react-dom', 'react/jsx-runtime'], plugins: [stores],
  outdir: temp, outExtension: {'.js': '.mjs'}, logLevel: 'error',
});
const {EncounterSurface, conversationRoutes} = await import(pathToFileURL(join(temp, 'surface.mjs')));
const {EncounterView} = await import(pathToFileURL(join(temp, 'view.mjs')));
const {censusOf} = await import(pathToFileURL(join(temp, 'census.mjs')));

/** The agents slice as the kernel answers it (census.rs): Claude Code, Codex and Pi start and AIKit opens a conversation with each;
 * OpenClaw starts but AIKit opens none with it; OpenCode does not start. */
const slice = agents => ({state: 'held', answer: {schema: 'oi.world-model-slice/v1', slice: 'agents', owner: 'kernel', scopes: ['machine'], version: 2,
  state: 'read', error: null, read_at_unix_ms: 1, value: {agents}}});
const TALKING = [
  {slug: 'claude-code', harness_ref: 'harness/claude-code', executable: '/x/claude', starts: true, talks: true, version: '2.1.323', aikit: {client: 'claude', harness: 'claude-code'}},
  {slug: 'codex', harness_ref: 'harness/codex', executable: '/x/codex', starts: true, talks: true, version: 'codex-cli 0.155.1', aikit: {client: 'codex', harness: 'codex'}},
  {slug: 'pi', harness_ref: 'harness/pi', executable: '/x/pi', starts: true, talks: true, version: '0.70.2', aikit: {client: 'pi', harness: 'pi'}},
];
const SILENT = [
  {slug: 'openclaw', harness_ref: 'harness/openclaw', executable: '/x/openclaw', starts: true, talks: false, version: '1.0', why: 'AIKit opens no conversation with openclaw: no face', aikit: {client: 'openclaw'}},
  {slug: 'opencode', harness_ref: 'harness/opencode', executable: '/x/opencode', starts: false, talks: false, why: '/x/opencode --version exited 1', aikit: null},
];
/** AIKit's stored provider rows (`~/.aikit/state/encounter-providers/`): written by test campaigns, no Claude Code or Codex row. */
const STORED = [
  {id: 'pi', label: 'Pi', protocol: 'pi-rpc', command: 'pi'},
  {id: 'canvas-walk-pi', label: 'Canvas walk Pi (existing provider)', protocol: 'pi-rpc', command: 'pi'},
  {id: 'opencode', label: 'opencode', protocol: 'acp', command: 'opencode'},
  {id: 'openclaw', label: 'openclaw', protocol: 'acp', command: 'openclaw'},
  {id: 'kimi', label: 'kimi', protocol: 'acp', command: 'kimi'},
];
const census = agents => censusOf(slice(agents));
/** Rendered on the server: React's note that a layout effect does not run there is expected here, and the only one held back. */
const serverRender = element => {
  const error = console.error;
  console.error = (first, ...rest) => { if (!(typeof first === 'string' && first.startsWith('Warning: useLayoutEffect does nothing on the server'))) error(first, ...rest); };
  try { return renderToStaticMarkup(element); } finally { console.error = error; }
};
const READING = {agent_session: 'agent-session/a', blocks: [], more: false, permissions: [], draft: {text: '', revision: 1},
  actions: [{ref: 'aikit.encounter.open', enabled: true}, {ref: 'aikit.encounter.draft', enabled: true}]};
const DISCONNECTED = {state: 'Disconnected', resident: false};
/** The buttons of the tab's connect section, by their words. */
const routeButtons = markup => [...(markup.match(/<div class="encounter-connect">.*?<\/div>/s)?.[0] ?? '').matchAll(/<button[^>]*>([^<]*)<\/button>/g)].map(match => match[1]);
const whyLine = markup => markup.match(/<p data-encounter-routes-why="true">([^<]*)<\/p>/)?.[1];
const unescape = text => text?.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');

test('the route choices are the census\'s agents a person can talk to, carrying AIKit\'s facts; AIKit\'s stored rows offer none of their own', () => {
  const {routes, why} = conversationRoutes(census([...TALKING, ...SILENT]), STORED);
  assert.deepEqual(routes.map(route => route.id), ['claude-code', 'codex', 'pi'], 'the census\'s order: every agent that talks, and only those');
  assert.deepEqual(routes.map(route => route.label), ['Claude Code', 'Codex', 'Pi']);
  assert.equal(routes[2].protocol, 'pi-rpc', 'AIKit\'s facts for an agent its providers name ride on that agent\'s choice');
  assert.equal(why, undefined);
  // The gate's fresh home: AIKit stores no provider row, and the census still offers the agents a person can talk to.
  assert.deepEqual(conversationRoutes(census(TALKING), []).routes.map(route => route.id), ['claude-code', 'codex', 'pi']);
});

test('with no agent to talk to, the tab says so with the census\'s why: each agent\'s reason, none detected, the census unread, or still reading', () => {
  const none = conversationRoutes(census(SILENT), STORED);
  assert.deepEqual(none.routes, [], 'AIKit\'s stored rows for agents the census says cannot be talked to are no choice');
  assert.match(none.why, /^No agent here can be talked to\. /);
  assert.match(none.why, /: AIKit opens no conversation with openclaw: no face\./);
  assert.match(none.why, /: \/x\/opencode --version exited 1\.$/);
  assert.equal(conversationRoutes(census([]), STORED).why, 'No agent here can be talked to: Actuation detects no agent harness on this machine.');
  assert.match(conversationRoutes(censusOf({state: 'unavailable', reason: 'The World Model has not answered yet.'}), STORED).why,
    /^No agent here can be talked to: the agents on this machine could not be read\. The World Model has not answered yet\.$/);
  assert.equal(conversationRoutes(censusOf({state: 'reading'}), STORED).why, 'Reading the agents on this machine…');
  // One reason the census gives for several agents is said once, with their names.
  const unread = TALKING.map(agent => ({...agent, talks: false, why: 'AIKit, which opens every conversation, could not be read: offline'}));
  assert.equal(conversationRoutes(census(unread), []).why, 'No agent here can be talked to. Claude Code, Codex, Pi: AIKit, which opens every conversation, could not be read: offline.');
});

test('the tab\'s connect section draws the census\'s choices, and with none, the census\'s why where AIKit\'s "No ACP provider" line stood', () => {
  const props = {title: 'Conversation', plane: 'Conversation', onPlane() {}, reading: READING, status: DISCONNECTED, draft: '', pending: false,
    onProvider() {}, onDraft() {}, onSend() {}, onCancel() {}, onEarlier() {}, onLatest() {}, onPermission() {}, presentation: 'tab', onReconnect() {}};
  const offered = conversationRoutes(census([...TALKING, ...SILENT]), STORED);
  const drawn = serverRender(createElement(EncounterView, {...props, providers: offered.routes, routesWhy: offered.why}));
  assert.deepEqual(routeButtons(drawn), ['Claude Code', 'Codex', 'Pi']);
  assert.equal(whyLine(drawn), undefined);
  const none = conversationRoutes(census(SILENT), STORED);
  const empty = serverRender(createElement(EncounterView, {...props, providers: none.routes, routesWhy: none.why}));
  assert.deepEqual(routeButtons(empty), []);
  assert.equal(unescape(whyLine(empty)), none.why);
  assert.doesNotMatch(empty, /No ACP provider configured in AIKit/);
});

test('a Disconnected conversation tab offers the census\'s agents, not the session\'s AIKit provider rows (the surface, as mounted)', () => {
  const actions = new Proxy({}, {get: () => () => {}});
  const handle = providers => ({state: {key: 'o-i|agent-session/a', project: 'o-i', agentSession: 'agent-session/a', providers, reading: READING, status: DISCONNECTED,
    draft: '', pending: false, busy: false, draftFailed: false, a2a: {busy: false}, model: {phase: 'unread'}, mode: {phase: 'unread'}}, actions});
  const binding = {id: 'encounter-a', kind: 'encounter', title: 'Conversation', project: 'o-i', ref: 'agent-session/a'};
  const draw = () => serverRender(createElement(EncounterSurface, {binding, onView() {}, presentation: 'tab'}));
  globalThis.__agentsSlice = slice([...TALKING, ...SILENT]);
  globalThis.__encounterHandle = handle(STORED);
  assert.deepEqual(routeButtons(draw()), ['Claude Code', 'Codex', 'Pi'], 'AIKit\'s stored rows (Canvas walk Pi, opencode, openclaw, kimi) are no choice');
  globalThis.__encounterHandle = handle([]);
  assert.deepEqual(routeButtons(draw()), ['Claude Code', 'Codex', 'Pi'], 'a home with no stored row still offers the census\'s agents');
  globalThis.__agentsSlice = slice(SILENT);
  globalThis.__encounterHandle = handle(STORED);
  const silent = draw();
  assert.deepEqual(routeButtons(silent), []);
  assert.match(unescape(whyLine(silent)), /^No agent here can be talked to\. .*AIKit opens no conversation with openclaw: no face\./);
});

test('a conversation keeps its own provider as a choice where the census does not offer it, and one another world holds offers none', () => {
  // A mode's body (the kernel provisions it on a configured row the census does not list): its status names it, so it stays a choice,
  // named as this conversation's own, and Reconnect after an owner restart reaches the provider AIKit recorded.
  const MODE_BODY = {id: 'prime-rpc', label: 'Prime', protocol: 'pi-rpc', command: 'prime'};
  const own = conversationRoutes(census(TALKING), [...STORED, MODE_BODY], {provider: 'prime-rpc'})
  assert.deepEqual(own.routes.map(route => [route.id, route.label]),
    [['claude-code', 'Claude Code'], ['codex', 'Codex'], ['pi', 'Pi'], ['prime-rpc', 'Prime (this conversation\'s own)']])
  // Its own provider a census agent: offered once, as the census's.
  assert.deepEqual(conversationRoutes(census(TALKING), STORED, {provider: 'pi'}).routes.map(route => route.id), ['claude-code', 'codex', 'pi'])
  // A provider AIKit no longer lists is no choice: nothing is invented.
  assert.deepEqual(conversationRoutes(census(TALKING), STORED, {provider: 'gone'}).routes.map(route => route.id), ['claude-code', 'codex', 'pi'])
  // A conversation another world's owner holds is connected there: this machine's agents are no choice for it.
  const hosted = conversationRoutes(census(TALKING), STORED, {hosted: 'world:field'})
  assert.deepEqual(hosted.routes, [])
  assert.equal(hosted.why, 'This conversation is held by the owner of world:field, which connects it: it is not connected from here.')
})
