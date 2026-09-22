// DEV-ONLY DIAGNOSTIC — NO ACCEPTANCE STANDING.
//
// This probe runs on the FIXTURE WORLD: the labelled dev scenario's
// simulated arrival, fixture-labelled material and fixture Run detail. It is
// excluded from the acceptance set (research dossier
// docs/experience/HARNESS-SETTINGS-RESEARCH-2026-09-22.md §4, negative
// roster item 5; DESKTOP-LANGUAGE.md ruling 8, 2026-09-22): acceptance for
// the Desk's detail surfaces lives in
// walk/scenarios/factory-development.mjs, restated over the real kernel legs
// (the owner's build views and run readings for a real conformance state).
// This file survives as a developer diagnostic for the fixture scenario's
// own mechanics.
//
// Walk probe: the ported donor surfaces in the Desk (PR #292 lanes) —
// live refresh acknowledge (FactoryLive machinery over the labelled fixture
// scenario), the Produced material section (CandidateReading +
// FactoryMaterialSurface, fixture-labelled), and the attempt-handoff honest
// unavailable state (the attempt-task kernel ops are absent from this cut).
import {chromium} from 'playwright';
const out = '/tmp/desk-shots';
import {mkdirSync} from 'fs';
mkdirSync(out, {recursive: true});
const browser = await chromium.launch({headless: true});
const page = await browser.newPage({viewport: {width: 1440, height: 900}});
const errors = [];
const fail = (message) => { console.log(`FAIL: ${message}`); browser.close(); process.exit(1); };
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.addInitScript(() => { try { sessionStorage.setItem('oi-cradle.welcome.v1', 'probe'); localStorage.setItem('oi-cradle.welcome.v1', 'probe'); } catch {} });
await page.goto('http://localhost:1432/');
await page.waitForSelector('.desktop-shell', {timeout: 20000});
await page.waitForTimeout(1500);
await page.locator('.world-mode-strip [data-mode="factory"]').click();
await page.waitForTimeout(1200);

// 1. Board + labelled dev scenario — baseline observations, no arrivals yet.
const scenario = page.locator('main.factory-centre select[aria-label="Dev scenario"]');
if (!await scenario.count()) fail('dev scenario select did not mount');
await scenario.selectOption('desk');
await page.waitForTimeout(900);
if (await page.locator('.desk-card-live').count()) fail('live arrival marker shown before anything arrived');
console.log('baseline cards:', await page.locator('.desk-card').count());

// 2. Simulate update (labelled dev-scenario mutation) → arrival + acknowledge.
const simulate = page.locator('.desk-board-tools .factory-side-scenarios button', {hasText: 'Simulate update'});
if (!await simulate.count()) fail('Simulate update control not present for the desk scenario');
await simulate.click();
await page.waitForTimeout(900);
const liveMarker = page.locator('.desk-card-live');
if (!await liveMarker.count()) fail('no live arrival marker after the simulated update');
const markerText = await liveMarker.first().textContent();
console.log('live marker:', markerText.trim());
if (!/new output/.test(markerText)) fail('live marker does not name the new outputs');
await page.screenshot({path: `${out}/lm-1-live-arrival.png`});
await liveMarker.locator('button', {hasText: 'Acknowledge'}).click();
await page.waitForTimeout(500);
if (await page.locator('.desk-card-live').count()) fail('arrival marker survived the revision acknowledge');
console.log('acknowledge: cleared');

// 3. Open the candidate-bearing Run — material section (fixture-labelled).
const card = page.locator('.desk-card', {hasText: 'Candidate recognition'});
await card.locator('.desk-card-open').click();
await page.waitForTimeout(1200);
if (!await page.locator('.desk-detail-live').count()) fail('live-follow strip did not mount in the Run detail');
const basis = await page.locator('.desk-detail-live .desk-detail-live-basis').textContent();
console.log('live basis:', basis.trim());
if (!/dev scenario/.test(basis)) fail('fixture basis not disclosed on the live strip');

// 3a. Handoff availability — honest unavailable state naming the missing ops.
const handoff = page.locator('.desk-detail-handoff');
if (!await handoff.count()) fail('attempt handoff section did not mount');
const handoffText = await handoff.textContent();
if (!handoffText.includes('factory_attempt_task_list_read') || !handoffText.includes('factory_attempt_task_read'))
  fail('handoff state does not name the missing kernel ops');
if (await handoff.locator('.desk-handoff-task-list button').count()) fail('a task list rendered although the owner ops are absent');
if (await handoff.locator('.desk-handoff-document').count()) fail('a handoff document rendered although the owner ops are absent');
console.log('handoff unavailable state: named ops, no invented list');
await page.screenshot({path: `${out}/lm-2-handoff-unavailable.png`});

// 3b. Material — the labelled fixture reading behind the subject browser.
const material = page.locator('.desk-detail-material');
if (!await material.count()) fail('produced material section did not mount');
if (!await material.locator('.desk-detail-fixture-note').count()) fail('fixture note missing on the material section');
const candidateButton = material.locator('.desk-material-candidate-list button', {hasText: 'Candidate A'});
if (!await candidateButton.count()) fail('no candidate subject in the material browser');
await candidateButton.click();
await page.waitForTimeout(700);
const surface = material.locator('.desk-material-surface');
if (!await surface.count()) fail('material surface did not open for the selected subject');
if (await surface.getAttribute('data-fixture') !== 'true') fail('material surface not labelled as fixture-fed');
const surfaceText = await surface.textContent();
if (!surfaceText.includes('Candidate A · Desk optic')) fail('material surface does not carry the selected subject');
if (surfaceText.includes('Refresh native read')) fail('fixture material surface offers a native read it cannot perform');
if (!surfaceText.includes('no native Factory read stands behind it')) fail('fixture disclosure missing inside the material surface');
console.log('material: fixture-labelled subject reading rendered');
await page.screenshot({path: `${out}/lm-3-material-fixture.png`});
await surface.locator('button', {hasText: 'Close'}).click();
await page.waitForTimeout(400);
if (await surface.count()) fail('material surface did not close');

// 3c. Detail live-follow: explicit Refresh present; already acknowledged → no acknowledge control.
if (!await page.locator('.desk-detail-live button', {hasText: 'Refresh'}).count()) fail('live-follow Refresh control missing');
console.log('live-follow refresh: present');

// 4. A Run with no produced material — honest absence.
await page.locator('.desk-detail-head button.oi-action').first().click();
await page.waitForTimeout(700);
const docsCard = page.locator('.desk-card', {hasText: 'Documentation pass'}).first();
await docsCard.locator('.desk-card-open').click();
await page.waitForTimeout(1000);
const emptyMaterial = page.locator('.desk-detail-material .oi-note', {hasText: 'retained no produced candidate or evidence'});
if (!await emptyMaterial.count()) fail('honest empty material state missing for a Run without candidates');
console.log('material empty state: honest');
await page.screenshot({path: `${out}/lm-4-material-empty.png`});

console.log('errors:', errors.length ? errors.slice(0, 6) : 'none');
if (errors.length) { await browser.close(); process.exit(1); }
await browser.close();
