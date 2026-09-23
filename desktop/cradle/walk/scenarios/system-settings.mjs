import {chmodSync} from 'node:fs';
import {join} from 'node:path';
import {setup as baseSetup} from './system.mjs';
import {disabledControls, enterSettings, openProduct, openSection, rawJsonOutsideShowRaw} from '../lib/settings-walk.mjs';
/** The walk reads the EMPTY world through the real census seam: OI_BIN
 * points at walk/fixtures/oi-fixture-world.mjs, a minimal `oi` stand-in
 * whose census answers all six products missing (docs/cradle/06 §6.2 — the
 * bootstrap state) and refuses every other owner verb. The kernel spawns it
 * for every census, disclosure and configuration read, so the page renders
 * the empty world exactly as it would render a machine with nothing
 * installed — same seam, nothing bypassed. */
export async function setup(args) {
  const provision=await baseSetup(args);
  const fixtureOi=join(args.cradleRoot,'walk','fixtures','oi-fixture-world.mjs');
  chmodSync(fixtureOi,0o755);
  provision.env={...provision.env,OI_BIN:fixtureOi};
  return provision;
}
/** 06-SYSTEM-SETTINGS §7, re-contracted to the 12-SETTINGS page (Status,
 * task sections, one page per product):
 *
 *   §6.2 — the empty world: every product page names its absence with the
 *          owner's reason and fabricates no settings, no health, no drift
 *          verdict; Install and set up… lives on the O:I page;
 *   L5   — no raw JSON outside a collapsed Show raw, on every section and
 *          product page; an OPEN Show raw stays clean because it is the
 *          disclosure (the scanner discriminates on disclosure);
 *   L4   — missing operations are sentences, never disabled buttons;
 *   §6.3 — (the fixture plane, `?fixtures=1`) a drifted desired setting is a
 *          staged change: both sides render in the review (from → to) with
 *          the owner's effect, and nothing moves before Apply.
 */
export default async function run({page,baseUrl,check,shot,channel,provision}) {
  await enterSettings(page,{root:provision.root,baseUrl});
  await channel('info');
  const focusBefore=JSON.stringify((await channel('read.focus')).data);

  // --- §6.2 · the empty world on Status ------------------------------------
  await openSection(page,'status');
  await page.locator('[data-status-drift-unknown], [data-status-drift-none], [data-status-drift]').first().waitFor({timeout:240000});
  const status=(await page.locator('[data-status-section]').innerText())??'';
  check(await page.locator('[data-status-drift-unknown]').count()===1 && await page.locator('[data-status-drift-none]').count()===0,
    '§6.2 with no product disclosure mounted, Status says drift cannot be known — it never claims "nothing has drifted"');
  const health=status.match(/.{0,40}(verified ready|all products ready|healthy).{0,40}/i);
  check(!health,'§6.2 the empty world fabricates no health — no ready or healthy claims',{match:health?.[0]});

  // --- §6.2 · each product page names its absence --------------------------
  const products=['central','ai-kit','actuation','software-factory','workcell','quaternal-logic'];
  const named=[];
  for(const product of products){
    await openProduct(page,product);
    const pageLocator=page.locator(`[data-product-page="${product}"]`);
    await pageLocator.locator('[data-product-health]').waitFor({timeout:240000});
    const state=await pageLocator.locator('[data-product-health]').getAttribute('data-product-health');
    const line=((await pageLocator.locator('[data-product-health]').textContent())??'').trim();
    const rows=await pageLocator.locator('[data-settings-row^="setting:"]').count();
    named.push({product,state,line,rows});
    check((await rawJsonOutsideShowRaw(page)).length===0,`L5 ${product}: no raw JSON outside Show raw`);
    const raw=pageLocator.locator('[data-show-raw]');
    check(await raw.count()===1 && (await raw.getAttribute('open'))===null,`L5 ${product}: Show raw is present and collapsed`);
  }
  check(named.every((row)=>row.state!=='available' && row.line.length>0 && row.rows===0),
    '§6.2 every product page names its absence (not available, with the reason) and fabricates no settings rows',{named});
  // Open one Show raw: the JSON is there for the integrator, behind the
  // disclosure, and the scanner still passes — it knows the difference.
  const raw=page.locator('[data-product-page="quaternal-logic"] [data-show-raw]');
  await raw.locator('summary').click();
  await raw.locator('pre').waitFor();
  check(((await raw.locator('pre').textContent())??'').trim().startsWith('{'),'L5 the raw record is there, behind Show raw');
  check((await rawJsonOutsideShowRaw(page)).length===0,'L5 an OPEN Show raw stays clean — it is the disclosure, and the check knows the difference');
  await raw.locator('summary').click();

  await openProduct(page,'oi');
  await page.locator('[data-adoption-entry]').waitFor({timeout:240000});
  check(await page.locator('[data-adoption-entry]').getByRole('button',{name:'Install and set up…'}).count()===1,
    '§6.2 the install sequence lives on the O:I page ("Install and set up…"), not in a separate wizard');
  await shot('empty-world-oi');

  // --- L4 · missing operations are sentences ------------------------------
  for(const id of ['harnesses','credentials','models','skills','permissions']){
    await openSection(page,id);
    await page.waitForTimeout(1500);
    check((await rawJsonOutsideShowRaw(page)).length===0,`L5 ${id}: no raw JSON outside Show raw (empty world)`);
  }
  check((await disabledControls(page,'[data-settings-page]')).length===0,'L4 no disabled control stands in for a missing operation');
  await openSection(page,'credentials');
  await page.locator('[data-settings-unreadable]').first().waitFor({timeout:240000});
  check(((await page.locator('[data-settings-unreadable]').first().textContent())??'').startsWith("Couldn't load these settings."),
    'the empty world cannot read credentials and says so — never "No keys yet"');
  await shot('empty-world-credentials');

  // --- §6.3 · drift as a staged change (fixture plane) ----------------------
  await enterSettings(page,{root:provision.root,baseUrl,query:'?fixtures=1'});
  await page.locator('[data-config-source="fixture"]').waitFor({timeout:120000});
  const strip=page.locator('[data-settings-pending]');
  await strip.waitFor({timeout:120000});
  await strip.getByRole('button',{name:'Review changes'}).click();
  const sheet=page.locator('[data-settings-review-sheet]');
  await page.waitForFunction(()=>document.querySelector('[data-settings-review-sheet]')?.getAttribute('data-phase')==='ready',null,{timeout:120000});
  const drift=sheet.locator('[data-review-row*="model.default"]');
  const detail=((await drift.locator('[data-review-detail]').textContent())??'');
  check(detail.includes('sonnet-current → sonnet-next'),'§6.3 both sides render: the product has sonnet-current, the profile asks for sonnet-next',{detail});
  check(((await drift.locator('[data-review-effect]').textContent())??'').length>0,'§6.3 the drift carries its effect in the owner\'s words before anything moves');
  check(await sheet.getByRole('button',{name:'Apply changes'}).count()===1,'§6.3 the remedy is the owner\'s own plan, applied only by an explicit Apply');
  await shot('drift-review');
  await sheet.getByRole('button',{name:'Keep editing'}).click();
  check(JSON.stringify((await channel('read.focus')).data)===focusBefore,'Settings inspection never reassigns semantic focus');
}
