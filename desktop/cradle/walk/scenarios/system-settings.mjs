import {chmodSync} from 'node:fs';
import {join} from 'node:path';
import {setup as baseSetup} from './system.mjs';
import {assertNoRawJson} from '../lib/read-model.mjs';
import {
  assertStatusPanel,
  assertHarnessesPanel,
  assertModelsPanel,
  assertCredentialsPanel,
  assertSkillsPanel,
} from '../lib/settings-sections.mjs';
/** The walk reads the EMPTY fixture world through the real census seam:
 * OI_BIN points at walk/fixtures/oi-fixture-world.mjs, a minimal `oi`
 * stand-in whose census answers all six products missing (docs/cradle/06
 * §6.2 — the bootstrap state). The kernel spawns it for composition_read
 * and for every per-owner disclosure read, so the page renders the empty
 * world exactly as it would render a machine with nothing installed —
 * same seam, same projection, nothing bypassed. */
export async function setup(args) {
  const provision=await baseSetup(args);
  const fixtureOi=join(args.cradleRoot,'walk','fixtures','oi-fixture-world.mjs');
  chmodSync(fixtureOi,0o755);
  provision.env={...provision.env,OI_BIN:fixtureOi};
  return provision;
}
/** The settings redesign (docs/cradle/06-SYSTEM-SETTINGS.md), asserted on
 * the REAL primary surface: src/workspace/SystemPanel.tsx → the v2 settings
 * page (one canvas, Settings / System / Visuals rail). This walk was
 * re-contracted to that page when it replaced the classic rail, and it
 * carries the §7 acceptance rows this lane owns:
 *
 *   L5   — the primary views contain no raw JSON and no wire-shape dumps;
 *          every raw record sits behind a <details>-grade disclosure that
 *          is collapsed by default (walk/lib/read-model.mjs asserts the
 *          law mechanically, and proves it discriminates: an OPEN developer
 *          record stays clean because it is behind disclosure);
 *   §6.2 — the walk drives the EMPTY fixture world through the real census
 *          seam: setup points OI_BIN at walk/fixtures/oi-fixture-world.mjs
 *          (a minimal `oi` answering all six products missing), so the page
 *          renders the bootstrap state — seven named sections, no spinner,
 *          the install sequence as the same page's own entry, no fabricated
 *          health or activity; the configuration plane's empty-registry
 *          world renders the same honesty on the Settings face;
 *   §6.3 — the drifted fixture setting renders BOTH sides (asked-for here
 *          vs the product's own axes) with its refs and the DISCLOSED
 *          remediation — plan-first through the product's own operation,
 *          owner authority visible before anything moves — never a fake
 *          fix.
 *
 * The existing L1/L3 honesty floor is kept, re-worded for the v2 vocabulary
 * (src/workspace/settings/v2/vocabulary.ts translates every contract word;
 * the walk asserts the words a person actually reads).
 */
export default async function run({page,baseUrl,check,shot,channel}) {
  await page.goto(baseUrl);
  await channel('info');
  const focusBefore=JSON.stringify((await channel('read.focus')).data);
  // The sidebar's terminal System entry (owner pass 2026-09-17: the
  // navigator's bottom row carries the mode strip plus the System glyph).
  // It enters the settings mode, whose centre surface is the settings page.
  await page.locator('.world-system-settings').click();
  const panel=page.getByRole('region',{name:'Settings and system'});
  await panel.waitFor();

  // --- the Settings face: drift (§6.3) and the empty world (§6.2) ----------
  await panel.locator('[data-settings-home]').waitFor({timeout:30000});
  await panel.locator('[data-config-source="fixture"]').waitFor({timeout:30000});
  const modelRow=panel.locator('[data-setting-ref="ai-kit:resolution:model.default"]');
  await modelRow.waitFor({timeout:30000});
  // The resolutions read lands after the rows; the drift row is only fully
  // rendered once its desired fact shows.
  await page.waitForFunction(()=>document.querySelector('[data-setting-ref="ai-kit:resolution:model.default"]')?.textContent?.includes('Asked for here'),null,{timeout:30000});
  // §6.3: the drift is announced in the visible word, never only in a data
  // attribute (attribute vocabulary alone is not proof of legibility).
  check((await modelRow.getAttribute('data-reconciliation'))==='drifted'
    &&((await modelRow.locator('.settings-status').textContent())??'').trim()==='Out of step',
    '§6.3 the drifted setting renders its status in the visible word "Out of step", not only as a data attribute');
  // §6.3: BOTH sides stay visible — what the profile asks for here, and
  // what the product reports on its own axes.
  const rowText=(await modelRow.textContent())??'';
  check(rowText.includes('Asked for here')&&rowText.includes('sonnet-next'),
    '§6.3 the desired side renders with its value ("Asked for here" · sonnet-next)');
  check(rowText.includes('The product has')&&rowText.includes('sonnet-current'),
    '§6.3 the native side renders beside it (the product\'s own value sonnet-current stays visible)');
  // §6.3: the drift carries its refs — the owner's own name heads the
  // group, the reason names the relation in words, and the setting's full
  // ref stays attached to its row.
  check(((await panel.locator('[data-owner="ai-kit"] h3').textContent())??'').trim()==='AIKit',
    '§6.3 the drift renders under its owner\'s own name');
  check(((await modelRow.locator('.settings-reason').textContent())??'').includes('desired differs from'),
    '§6.3 the drift\'s reason names the two sides\' relation in words');
  check(((await modelRow.locator('.settings-copy').getAttribute('title'))??'').includes('ai-kit:resolution:model.default'),
    '§6.3 the setting\'s full ref stays attached to its row (the copy-id action carries it)');
  // §6.3: the remediation is the DISCLOSED one — plan-first through the
  // product's own operation, never an instant fake fix. Opening it shows
  // the reviewed native plan and the authority note before anything moves;
  // the walk cancels without applying.
  const apply=modelRow.getByRole('button',{name:'Apply…',exact:true});
  check((await apply.getAttribute('title'))==='Apply this change through the product\'s own operation',
    '§6.3 the remediation routes through the product\'s own operation');
  await apply.click();
  const drawer=panel.locator('[data-config-drawer]');
  await drawer.waitFor({timeout:15000});
  await drawer.getByText('a plan or button is not a grant').waitFor({timeout:15000});
  check((await drawer.locator('.config-plan').count())>=1&&((await drawer.getByText('Owner authority').count())>=1),
    '§6.3 the remediation opens on the reviewed native plan with its owner authority, before anything has moved');
  await shot('settings-drift-plan');
  await drawer.getByRole('button',{name:'Cancel'}).click();
  await panel.locator('[data-config-drawer]').waitFor({state:'detached',timeout:15000});

  // §6.2 on the Settings face: the fixture world's empty registry is the
  // bootstrap relation — the same system in its honest beginning, with
  // nothing fabricated to fill the space (L3).
  await panel.locator('[data-config-fixture-console] summary').click();
  await panel.getByRole('button',{name:'Empty the registry (bootstrap world)'}).click();
  await panel.locator('[data-config-empty-registry]').waitFor({timeout:15000});
  check(((await panel.locator('[data-config-empty-registry]').textContent())??'').includes('Nothing installed to configure yet'),
    '§6.2 the empty world renders the honest beginning — the bootstrap banner, not an error');
  check((await panel.locator('[data-setting-ref]').count())===0,
    '§6.2 the empty world fabricates no settings and no controls');
  await shot('settings-bootstrap-empty');
  await panel.getByRole('button',{name:'Restore the full registry'}).click();
  await panel.locator('[data-owner]').first().waitFor({timeout:15000});

  // L5 on the primary Settings view: no raw JSON, no wire-shape dumps — and
  // (owner ruling 2026-09-22) the developer dump itself is GONE: there is
  // no developer view in the shipping application, and the surface stays
  // clean without it.
  await assertNoRawJson({check},panel,
    'L5 the primary Settings view renders no raw JSON and no wire-shape dumps');
  check((await panel.locator('details.settings-dev').count())===0,
    'L5 the raw-documents developer view does not exist — the dump died, and the view is clean without it');
  await shot('settings-face');

  // --- the System face: the census and the empty world ----------------------
  await panel.getByRole('button',{name:'System',exact:true}).click();
  await panel.locator('.settings-world-header').waitFor({timeout:30000});
  // The census is a real native read of the walk's isolated world; the
  // header names its counts once the read lands, and the panel leaves its
  // reading state (no spinner stands in for a product).
  await page.waitForFunction(()=>/^\d+ of 7 products installed/.test(document.querySelector('.settings-world-header p')?.textContent??''),null,{timeout:60000});
  await page.waitForFunction(()=>{
    const panel=document.querySelector('section.system-panel');
    return panel?.getAttribute('aria-busy')==='false'&&!panel.querySelector('.settings-note[role="status"]');
  },null,{timeout:30000});
  const headerLine=(await panel.locator('.settings-world-header p').first().textContent())??'';
  const installed=Number(headerLine.match(/^(\d+) of 7 products installed/)?.[1]);
  // §6.2: the walk's world IS the empty fixture world (a fresh suite home);
  // the page must read it as the bootstrap state, never as an error.
  check(installed===0,'§6.2 the empty fixture world reads as the bootstrap state: zero products discovered, named in the world header',
    {headerLine});
  check(headerLine.includes('not installed'),'§6.2 the bootstrap header carries the honest not-installed aggregate',{headerLine});
  const sections=await panel.locator(':scope > details.product-section').all();
  check(sections.length===7,'Settings projects all seven positions (O:I + six products)');
  // §6.2: every position is a NAMED section with its honest availability —
  // discovery is a named fact per product, never a spinner stand-in.
  const names=[];
  for(const section of sections)names.push(((await section.locator(':scope > summary > strong').textContent())??'').trim());
  check(names.every(name=>name.length>0),'§6.2 every position renders as a named section — discovery is a named fact, never a spinner',{names});
  // §6.2: the install sequence is the same page's own entry — bootstrap is
  // finished here, not by leaving the page. (Running an install is an owner
  // operation; the walk proves the entry exists and stays honest.)
  check((await panel.locator('[data-adoption-entry]').getByRole('button',{name:'Install and set up…'}).count())===1,
    '§6.2 the install sequence lives on this page ("Install and set up…"), not in a separate wizard');
  // §6.2 / L3: the empty world fabricates no health and no activity. The
  // page must claim no readiness it has not read; the ai-kit activity rows
  // render their honest form — the no-project absence, or real disclosed
  // counts for the open project — never a fabricated session.
  const panelText=(await panel.textContent())??'';
  const healthMatch=panelText.match(/.{0,40}(verified ready|all products ready|healthy).{0,40}/i);
  check(!healthMatch,'§6.2 the bootstrap world fabricates no health — no ready or healthy claims anywhere',{match:healthMatch?.[0]});
  const aikit=sections[names.indexOf('AIKit')];
  check(/No project is currently open|disclosed for /.test((await aikit.textContent())??''),
    '§6.2/L3 activity renders its honest form — the no-project absence or real disclosed counts, never a fabricated session');
  // L1 (BOOT-06/12): every position carries its honest availability label.
  // A census section reads the honest word or the "not checked for
  // readiness yet" form; an owner's own section carries its own chip.
  const unlabelled=[];
  for(const [index,section] of sections.entries()){
    const name=names[index];
    const cls=(await section.getAttribute('class'))??'';
    if(/native-product-section/.test(cls)){
      const chip=((await section.locator(':scope > summary .native-owner-availability').textContent())??'').trim();
      if(!chip)unlabelled.push(`${name}: native section with an empty owner availability chip`);
    }else{
      const label=((await section.locator(':scope > summary > span').allTextContents()).join(' ')).trim();
      if(!(/ — not checked for readiness yet$/.test(label)||/^(Not installed|Not disclosed|Unavailable|State unknown)$/.test(label)))
        unlabelled.push(`${name}: census section labelled "${label}"`);
    }
  }
  check(unlabelled.length===0,'L1 every position carries its honest availability label — discovered never stands for ready',{unlabelled});
  // L3: disclosed rows or the honest emptiness, never both, never a
  // filled-in fabrication.
  let fabricated=0;const honesty=[];
  for(const [index,section] of sections.entries()){
    const rows=await section.locator(':scope ul.product-actions > li').count();
    const empty=await section.locator(':scope p.product-empty').filter({hasText:'No operations here yet.'}).count();
    if((rows===0)===(empty===0))fabricated++;
    honesty.push(`${names[index]}: ${rows} disclosed action(s), ${empty} honest emptiness`);
  }
  check(fabricated===0,'L3 every section discloses its actions or renders its emptiness honestly — nothing fabricated',{honesty});
  const notYetAvailable=(await panel.locator('.product-action-availability.is-missing_native_obligation').allTextContents()).join(' ');
  check(notYetAvailable.includes('not available here yet'),'Missing native operations render as a plain not-yet-available note, never as disabled buttons');
  // L5 on the primary System view, then the disclosure proof: every section
  // keeps its raw record behind its own collapsed ADVANCED disclosure (the
  // "developer surface" naming is gone from the shipping app — owner ruling
  // 2026-09-22), and an OPEN record stays clean because it is behind
  // disclosure — the scanner discriminates on disclosure, not on the mere
  // absence of JSON.
  await assertNoRawJson({check},panel,
    'L5 the primary System view renders no raw JSON and no wire-shape dumps');
  const rawDisclosures=await panel.locator(':scope > details.product-section > details.product-advanced').all();
  check(rawDisclosures.length===7,'L5 each section keeps its raw record behind its own Advanced disclosure');
  check((await panel.getByText('Developer record').count())===0,
    'no "developer" surface survives in the shipping application — the disclosure is named Advanced');
  let openRaw=0;
  for(const disclosure of rawDisclosures)if((await disclosure.getAttribute('open'))!==null)openRaw++;
  check(openRaw===0,'L5 raw records are collapsed by default — the primary view is the readable one');
  // The section itself is a <details> too: open it, then its developer
  // record, and prove the open record stays clean BECAUSE it is behind
  // disclosure — the scanner discriminates on disclosure, not on the mere
  // absence of JSON.
  await sections[0].locator(':scope > summary').click();
  await rawDisclosures[0].locator('summary').click();
  await rawDisclosures[0].locator('pre').waitFor({timeout:5000});
  check((await rawDisclosures[0].locator('pre').isVisible())===true,
    'L5 the raw record is there for the integrator, behind its disclosure');
  await assertNoRawJson({check},panel,
    'L5 an open developer record stays clean — it is behind disclosure, and the check knows the difference');
  await rawDisclosures[0].locator('summary').click();
  await sections[0].locator(':scope > summary').click();
  await shot('settings-system');

  // --- the rebuilt sections (HARNESS-SETTINGS-RESEARCH §2) in the empty
  // fixture-oi world ---------------------------------------------------------
  // OI_BIN here is the EMPTY fixture world, so the AIKit disclosure does
  // not mount: Status/Credentials/Skills must render that absence by name
  // (L3) while the aikit-driven reads (harness status, model catalogue)
  // stay real and assert their live round trips. The aikit binary is NOT
  // fixture-scoped: these are the machine's own harnesses and catalogue.
  await panel.getByRole('button',{name:'Settings',exact:true}).click();
  await panel.locator('[data-settings-home]').waitFor({timeout:30000});
  await assertStatusPanel({page, check, disclosureAvailable:false});
  await shot('section-status-absent-disclosure');
  await assertHarnessesPanel({page, check});
  await assertModelsPanel({page, check});
  await assertCredentialsPanel({page, check, disclosureAvailable:false});
  await assertSkillsPanel({page, check, disclosureAvailable:false});
  // The section panels keep the L5 law too.
  for (const name of ['status','harnesses','models','credentials','skills']) {
    const sectionPanel = page.locator(`[data-${name==='harnesses'?'harness':name}-panel]`);
    await assertNoRawJson({check}, sectionPanel, `${name}: the rebuilt section renders no raw JSON (L5, fixture world)`);
  }
  await page.locator('.settings-toc button', {hasText:'All settings'}).first().click();
  await panel.locator('[data-owner]').first().waitFor({timeout:15000});
  check(JSON.stringify((await channel('read.focus')).data)===focusBefore,'Settings inspection never reassigns semantic focus');
}
