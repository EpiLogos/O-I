// Desk probe: the labelled-fixture legs of the Desk's proof (handoff §10/§11)
// — the legs the walk bundle cannot mount because the labelled dev scenarios
// live behind import.meta.env.DEV and the walk bundle is a production build
// (see scenarios/factory-development.mjs for the real-read legs).
//
// Runs against the DEV bundle (default http://localhost:1432 — DESK_URL to
// override) with the walk bridge booted here so the kernel is real:
//   - the "Desk — cross-project board" fixture scenario: six whole Runs
//     across two Projects, kanban grouping over the native status, honest
//     fixture labelling, search + project-scope filtering over one pipeline;
//   - open a Run: the four depths of the Run view (Trajectory / Reading /
//     Live / Map) render real compositions — the Map's read goes through the
//     bridge to the real owner and its refusal for the fixture's locator
//     renders verbatim (the fixture names a state path the owner serves
//     differently — an honest refusal, never a fabricated map);
//   - carried-conversation binding, the exact-identity join: a REAL
//     conversation (AIKit SessionSpace, attached below) whose ref is exactly
//     the one the fixture Run's trajectory names joins as carried; opening it
//     goes through the owner's encounter machinery and whatever the owner
//     refuses surfaces verbatim in the shell's own alert — nothing invented;
//   - Back to Desk restores the board with its remembered search and scope
//     intact.
import {chromium} from 'playwright';
import {spawn, execFileSync} from 'node:child_process';
import {mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {setup as editorSetup} from './scenarios/editor.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));
const cradleRoot = join(here, '..');
const out = '/tmp/desk-shots';
const url = process.env.DESK_URL ?? 'http://localhost:1432/';
const BRIDGE_PORT = 4181;
mkdirSync(out, {recursive: true});

// --- provision: the Editor ground + a real conversation whose ref is the
// --- one the fixture Run's trajectory genuinely names (exact-identity join)
const provision = await editorSetup({cradleRoot});
const fixtureSession = 'agent-session:fixture:meredith-1';
const aikit = process.env.OI_AIKIT_BIN ?? 'aikit';
const sessionSpace = process.env.OI_AIKIT_SESSION_SPACE_BIN ?? 'aikit-session-space';
const env = {...process.env, ...provision.env, AIKIT_HOME: join(provision.root, '.aikit-home')};
const bind = JSON.parse(execFileSync(aikit, ['--json', '-C', provision.projectRoot, 'project', 'bind', 'editor-walk', '--directory', provision.projectRoot, '--no-default-skill-sets'], {encoding: 'utf8', env}));
if (!bind.ok) throw new Error(JSON.stringify(bind));
const native = (...parts) => JSON.parse(execFileSync(sessionSpace, ['-C', provision.projectRoot, ...parts], {encoding: 'utf8', env}));
const apply = preview => native('apply', '--preview-json', JSON.stringify(preview));
const space = 'session-space/desk-fixture-carried';
apply(native('create', space, '--label', 'Desk fixture carried'));
for (const intent of [
  {operation: 'bind-project-context', binding: native('project-context')},
  {operation: 'attach-agent-session', attachment: {agent_session: fixtureSession, purpose: 'Meredith · carried this Run', provenance: ['Explicit desk-probe carried-conversation fixture join']}},
]) apply(native('stage', '--space', space, '--intent-json', JSON.stringify(intent)));

// --- the walk bridge: the same typed kernel seam, fresh for this probe
const bridge = spawn('cargo', ['run', '--quiet', '--manifest-path', join(cradleRoot, 'kernel/Cargo.toml'), '--bin', 'walk-bridge', '--', `127.0.0.1:${BRIDGE_PORT}`], {cwd: cradleRoot, detached: true, stdio: ['ignore', 'pipe', 'pipe'], env: {...env, OI_AIKIT_BIN: aikit, OI_AIKIT_SESSION_SPACE_BIN: sessionSpace}});
bridge.stdout.on('data', chunk => console.log(`  [bridge] ${chunk}`.trimEnd()));
bridge.stderr.on('data', chunk => console.log(`  [bridge] ${chunk}`.trimEnd()));
const teardown = () => { try { process.kill(-bridge.pid, 'SIGTERM'); } catch {} provision.cleanup?.(); };
process.once('exit', teardown);
for (let deadline = Date.now() + 180000;;) {
  try { const response = await fetch(`http://127.0.0.1:${BRIDGE_PORT}/state`); if (response.ok) break; } catch {}
  if (Date.now() > deadline) { console.log('FAIL: the walk bridge did not come up'); process.exit(1); }
  await new Promise(resolve => setTimeout(resolve, 250));
}

const browser = await chromium.launch({headless: true});
const page = await browser.newPage({viewport: {width: 1440, height: 900}});
const errors = [];
const fail = message => { console.log(`FAIL: ${message}`); teardown(); browser.close(); process.exit(1); };
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.addInitScript(port => {
  try { sessionStorage.setItem('oi-cradle.welcome.v1', 'probe'); localStorage.setItem('oi-cradle.welcome.v1', 'probe'); } catch {}
  window.__OI_KERNEL_BRIDGE__ = `http://127.0.0.1:${port}`;
}, BRIDGE_PORT);
await page.goto(url);
await page.waitForSelector('.desktop-shell', {timeout: 20000});
await page.locator('.world-mode-strip [data-mode="factory"]').click();
await page.locator('main.factory-centre').waitFor({timeout: 20000});

// 1. Ground the mode in the Editor project: the navigator's picker is the
//    one project route — the detail's conversation list reads through it.
const picker = page.locator('nav.factory-navigator select[aria-label="Project"]');
await picker.waitFor({timeout: 20000});
await picker.selectOption('Editor');
await page.locator('.factory-space[data-bound="true"]').waitFor({timeout: 20000});

// 2. The labelled fixture board: six whole Runs across two Projects.
const scenario = page.locator('main.factory-centre select[aria-label="Dev scenario"]');
if (!await scenario.count()) fail('dev scenario select did not mount — run against the dev bundle');
await scenario.selectOption('desk');
await page.locator('.desk-board-fixture-note').waitFor({timeout: 10000});
if (!await page.locator('.desk-board-fixture-note').count()) fail('fixture disclosure note missing');
const cards = page.locator('.desk-card');
await cards.first().waitFor({timeout: 10000});
if (await cards.count() !== 6) fail(`expected 6 fixture Runs, saw ${await cards.count()}`);
const groupHeads = await page.locator('.desk-group-head').allTextContents();
for (const label of ['Needs attention', 'Active', 'Queued', 'Recent']) if (!groupHeads.some(head => head.startsWith(label))) fail(`group ${label} missing: ${groupHeads}`);
if (await page.locator('.desk-card', {hasText: 'Documentation pass'}).count() !== 2) fail('the same-named Runs across two Projects did not both render');
console.log('fixture board: 6 Runs, 4 groups, both Documentation passes');
await page.screenshot({path: `${out}/1-desk-board.png`});

// 3. One pipeline for fixture rows: scope Factory + search Documentation
//    narrows to exactly the Software Factory documentation Run.
const scope = page.locator('select[aria-label="Project scope"]');
await scope.selectOption('Factory');
await page.locator('input[aria-label="Search Runs"]').fill('Documentation');
await page.waitForTimeout(400);
const scopedCards = await page.locator('.desk-card').count();
if (scopedCards !== 1) fail(`scope+search should leave exactly the Factory documentation Run, saw ${scopedCards}`);
console.log('scope+search: 1 of 6 Runs — one filter pipeline');
await page.locator('input[aria-label="Search Runs"]').fill('');

// 4. Open the parallel-work Run: the four depths of the Run view.
const card = page.locator('.desk-card', {hasText: 'Sidebar slice — render lane'});
await card.locator('.desk-card-open').click();
const detail = page.locator('.desk-detail');
await detail.waitFor({timeout: 10000});
if ((await page.locator('.desk-detail-title h1').textContent()) !== 'Sidebar slice — render lane') fail('the opened Run detail lost the Run label');
const basis = await page.locator('.desk-detail-live .desk-detail-live-basis').textContent();
if (!/dev scenario/.test(basis)) fail(`the live strip does not disclose its fixture basis: ${basis}`);
const depthButtons = await page.locator('.desk-run-depths button').allTextContents();
if (depthButtons.join('|') !== 'Trajectory|Reading|Live|Map') fail(`the four depths did not render: ${depthButtons}`);
// Trajectory (default): the execution-trace composition over the fixture trace.
if (!await page.locator('.desk-run-view .fb-build-surface').count()) fail('the Trajectory depth did not mount the execution-trace composition');
console.log('depths: Trajectory renders the execution-trace composition');
// Reading: the SSSF semantic reading — frontier, claims, evidence.
await page.locator('.desk-run-depths button', {hasText: 'Reading'}).click();
await page.locator('.desk-run-frontier').waitFor({timeout: 5000});
if (!await page.locator('.desk-run-claim').count()) fail('the Reading depth renders no claim');
console.log('depths: Reading renders frontier + claims');
// Live: agencies and executions as the owner reads them.
await page.locator('.desk-run-depths button', {hasText: 'Live'}).click();
await page.locator('.desk-run-live-grid article').first().waitFor({timeout: 5000});
const liveCards = await page.locator('.desk-run-live-grid article').count();
if (liveCards < 3) fail(`the Live depth should render agencies and executions, saw ${liveCards}`);
console.log(`depths: Live renders ${liveCards} agency/execution cards`);
// Map: the owner's own refusal for the fixture's locator renders verbatim.
await page.locator('.desk-run-depths button', {hasText: 'Map'}).click();
const mapRefusal = page.locator('.desk-run-map .oi-note[role="alert"]');
await mapRefusal.waitFor({timeout: 30000});
const mapText = await mapRefusal.textContent();
if (!/The owner refused this Run's map reading/.test(mapText) || !/provider error|missing field|No such|refused/i.test(mapText)) fail(`the Map depth did not render the owner's refusal verbatim: ${mapText}`);
console.log(`depths: Map renders the owner's refusal verbatim (${mapText.slice(0, 80)}…)`);
await page.screenshot({path: `${out}/2-run-depths.png`});

// 5. Carried-conversation binding, the exact-identity join: the fixture
//    Run's trajectory names `agent-session:fixture:meredith-1`, and the real
//    conversation attached under exactly that ref joins as carried — the
//    desktop binds by identity, never by label. Opening it goes through the
//    owner's encounter machinery, which refuses the fixture's colon-form ref
//    as non-canonical: the owner's refusal surfaces verbatim and nothing is
//    invented — the honest limit of a labelled fixture whose session refs
//    the owner would never mint. (The full bind→Tasks→Run-link loop over a
//    canonical ref is proven by the factory-development walk scenario.)
const carried = page.locator('.desk-detail-carried .desk-receiving-row[data-carried="true"]');
await carried.waitFor({timeout: 30000});
if ((await carried.innerText()).includes('Meredith · carried this Run')) console.log('carried binding: the real conversation joined by exact session identity');
else fail('the carried row did not render the conversation the Run carried');
await carried.click();
// The owner's refusal must surface verbatim in the shell's own alert —
// nothing invented, however the owner refuses. Two wordings are honest here:
//  - the identity refusal for the fixture's colon-form ref ("canonical
//    AgentSession ref" / "encounter.identity") — this leg's original proof;
//  - since the 2026-09-20 managed suite update, the folded aikit cannot boot
//    the resident encounter owner at all: ai-kit `encounter_service::start()`
//    spawns the companion-era top-level verb `encounter-serve`, but the
//    folded binary nests it at `aikit session-space encounter-serve`, so the
//    owner exits 2 before any identity check (the O-I #376 seam; reproduced
//    standalone: `AIKIT_HOME=<tmp> aikit session-space encounter-start`).
//    That refusal is likewise the owner's own and surfaces verbatim; the
//    identity-wording claim is skipped, loudly, until the fold is repaired.
//    The leg still fails when NO refusal surfaces — the honest-surfacing
//    behaviour is what it guards.
let bindRefusal = '';
for (let deadline = Date.now() + 20000; !bindRefusal && Date.now() < deadline;) {
  await page.waitForTimeout(500);
  const messages = await page.locator('.footer-status-message, [role="alert"]').allTextContents().catch(() => []);
  bindRefusal = messages.find(text => text.includes('canonical AgentSession ref') || text.includes('encounter.identity') || text.includes('encounter.runtime')) ?? '';
}
if (!bindRefusal) fail('opening the fixture-carried conversation did not surface the owner\'s refusal');
else if (bindRefusal.includes('encounter.runtime') || bindRefusal.includes('Encounter owner exited')) console.log(`carried open: SKIP (identity-wording claim) — the resident encounter owner cannot boot on this suite (folded aikit spawns the companion-era \`encounter-serve\` verb; ai-kit O-I #376 seam). The owner's refusal still surfaced verbatim: ${bindRefusal.slice(0, 90)}…`);
else console.log(`carried open: the owner's refusal surfaces verbatim (${bindRefusal.slice(0, 80)}…)`);
await page.screenshot({path: `${out}/3-carried-refusal.png`});

// 6. Back to Desk restores the board with its remembered scope intact.
await page.locator('.desk-detail-head button.oi-action', {hasText: 'Back to Desk'}).click();
await page.locator('.desk-board').waitFor({timeout: 10000});
if (await page.locator('select[aria-label="Project scope"]').inputValue() !== 'Factory') fail('the remembered project scope did not survive the detail/Tasks round-trip');
const visibleAfter = await page.locator('.desk-card').count();
if (visibleAfter !== 3) fail(`back on the board with scope Factory, expected the 3 Factory Runs, saw ${visibleAfter}`);
console.log('back to board: scope preserved, 3 Factory Runs render');

console.log('errors:', errors.length ? errors.slice(0, 6) : 'none');
if (errors.length) { teardown(); await browser.close(); process.exit(1); }
teardown();
await browser.close();
