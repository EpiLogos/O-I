/**
 * The configuration-plane walk (#299 §21, C6): the generic Configuration
 * and Profiles projections exercised against the frozen C0 fixtures via
 * the fixture-backed source (`src/configuration/fixtureSource.ts`).
 *
 * The System surface mounts through the real kernel bridge; the
 * CONFIGURATION DATA comes from the fixture world in dev/walk builds
 * (`__CRADLE_WALK__`) — exactly the lane's contract: the live KernelOp
 * data binding is the integrator's convergence work, documented in
 * `src/configuration/source.ts`.
 *
 * Proven here, per the lane acceptance:
 *  - ordinary settings render/edit with zero product-specific branches
 *    (controls derive from value_schema kinds only);
 *  - desired and native axes stay legible, never one collapsed value;
 *  - all six frozen reconciliation statuses render;
 *  - plan/diff/apply uses the frozen ChangeSet shapes with owner authority
 *    and expected effect visible BEFORE apply;
 *  - partial failure is truthful (the fixture world's `oi` owner fails
 *    apply, mirroring changeset-partial-apply: one verified op + one
 *    failed op → partially_applied, no fake rollback);
 *  - an external native change appears on reread;
 *  - empty registry and unavailable-owner worlds are first-class;
 *  - profile switching is inspectable; native profiles stay references;
 *    secret entries stay presence/reference.
 */
export default async function run({page,baseUrl,check,shot}) {
  await page.goto(baseUrl);
  await page.getByRole('button',{name:'System',exact:true}).click();
  const panel=page.getByRole('region',{name:'System composition'});
  await panel.waitFor();

  // --- Configuration: the generic projection -------------------------------
  await panel.getByRole('button',{name:'Configuration',exact:true}).click();
  await panel.locator('[data-config-source="fixture"]').waitFor({timeout:30000});
  await panel.locator('[data-owner]').first().waitFor({timeout:30000});

  const ownerRefs=await Promise.all((await panel.locator('[data-owner]').all()).map(o=>o.getAttribute('data-owner')));
  check(ownerRefs.length===4 && ownerRefs.includes('ai-kit') && ownerRefs.includes('oi')
    && ownerRefs.includes('workcell') && ownerRefs.includes('connector/factory-actuation'),
    'The registry projects every mounted contribution generically (two products, the oi composition owner, a connector)',{ownerRefs});

  const workcell=panel.locator('[data-owner="workcell"]');
  check((await workcell.getAttribute('data-availability'))==='unavailable','The unavailable owner renders its disclosed availability');
  check((await workcell.locator('[data-config-empty-owner]').count())===1,'The unavailable owner renders its honest absence — no fabricated settings, no fake controls');

  // Generic controls per value-schema kind — no product branch rendered any
  // of these.
  check((await panel.locator('[data-config-control="boolean"]').count())>=1,'boolean → switch');
  check((await panel.locator('[data-config-control="enum"]').count())>=2,'enum → choice');
  check((await panel.locator('[data-config-control="path"]').count())>=1,'path → path field');
  check((await panel.locator('[data-config-control="table"]').count())>=1,'table → structured editor');
  check((await panel.locator('[data-config-control="reference"]').count())>=1,'reference → reference field (native resolver)');
  const secretRow=panel.locator('[data-setting-ref="ai-kit:providers:credentials.anthropic"]');
  check((await secretRow.getByText('present',{exact:true}).count())===1,'secret → presence only');
  check((await secretRow.getByText('aikit:credentials:anthropic-key').count())>=1,'secret → reference shown, never a value');

  // Four of the frozen reconciliation statuses render straight from the
  // mounted world; `unknown` and `unsupported` are proven further below.
  const statusesOf=async()=>Object.fromEntries(await Promise.all((await panel.locator('[data-setting-ref]').all()).map(async row=>[await row.getAttribute('data-setting-ref'), await row.getAttribute('data-reconciliation')])));
  let statuses=await statusesOf();
  const present=new Set(Object.values(statuses));
  check(['satisfied','drifted','pending','blocked'].every(s=>present.has(s)),
    'satisfied, drifted, pending and blocked render from the frozen vocabulary (§7.1)',{statuses});
  await shot('configuration-registry');

  // Desired and native stay two legible axes on the drifted setting.
  const modelRow=panel.locator('[data-setting-ref="ai-kit:resolution:model.default"]');
  check((await modelRow.getAttribute('data-reconciliation'))==='drifted','model.default is drifted (profile desired vs native)');
  check((await modelRow.getByText('sonnet-current').count())>=1,'the native axis stays visible');
  check((await modelRow.getByText('sonnet-next').count())>=1,'the desired axis stays visible beside it');

  // --- Plan / apply: authority + expected effect BEFORE, ChangeSet after ---
  await modelRow.getByRole('button',{name:'Plan apply…'}).click();
  const drawer=panel.locator('[data-config-drawer]');
  await drawer.getByText('session-restart-required').first().waitFor({timeout:15000});
  check((await drawer.getByText(/Authority/).count())>=1,'owner authority is visible before apply');
  check((await drawer.getByText('Expected effect').count())>=1,'expected effect is visible before apply');
  await shot('configuration-plan');
  await drawer.locator('[data-config-apply]').click();
  await drawer.locator('[data-changeset-status="verified"]').waitFor({timeout:15000});
  check((await drawer.locator('[data-op-status="verified"]').count())===1,'the ChangeSet records per-operation truth');
  check((await drawer.getByText('satisfied').count())>=1,'re-read verification reconciles the applied setting');
  await drawer.getByRole('button',{name:'close'}).click();
  await page.waitForTimeout(600); // the parent re-read lands
  check((await modelRow.getAttribute('data-reconciliation'))==='satisfied','after apply + reread the setting reconciles satisfied');

  // --- Holding desired drifts before any owner is touched ------------------
  const verifyRow=panel.locator('[data-setting-ref="oi:verify:verify.before-run"]');
  await verifyRow.locator('[data-config-control="boolean"]').click(); // hold desired: off
  await page.waitForTimeout(600);
  check((await verifyRow.getAttribute('data-reconciliation'))==='drifted','holding desired drifts the setting before any owner is touched');

  // --- An undisclosed setting with held desired is `unknown`, never guessed
  const instanceRow=panel.locator('[data-setting-ref="ai-kit:session:provider-instance"]');
  await instanceRow.locator('input[data-config-control="reference"]').fill('workcell:instance-7');
  await instanceRow.locator('input[data-config-control="reference"]').press('Enter');
  await page.waitForTimeout(600);
  check((await instanceRow.getAttribute('data-reconciliation'))==='unknown','desired over an undisclosed subject is unknown — never guessed, never fabricated');
  statuses=await statusesOf();
  check(Object.values(statuses).includes('unknown'),'all five registry-renderable statuses have now rendered',{statuses});

  // --- External native change appears on reread (§10) ----------------------
  await panel.locator('[data-config-fixture-console] summary').click();
  await panel.getByRole('button',{name:/Simulate external native edit/}).click();
  await page.waitForTimeout(600);
  check((await modelRow.getAttribute('data-reconciliation'))==='drifted','an external native edit appears on reread as drift, never silently rewritten');

  // --- Partial failure is truthful: two owners, one fails (§8) -------------
  await panel.locator('[data-config-plan-all]').click();
  const batchDrawer=panel.locator('[data-config-drawer]');
  await batchDrawer.locator('[data-config-apply]').waitFor({timeout:15000});
  await batchDrawer.locator('[data-config-apply]').click();
  await batchDrawer.locator('[data-changeset-status="partially_applied"]').waitFor({timeout:15000});
  check((await batchDrawer.locator('[data-op-status="verified"]').count())===1,'the succeeded owner operation is recorded verified');
  check((await batchDrawer.locator('[data-op-status="failed"]').count())===1,'the failed owner operation is recorded failed');
  check((await batchDrawer.getByText('owner_unavailable').count())>=1,'the owner error renders verbatim — no fake rollback, no faked success');
  await shot('configuration-partial');
  await batchDrawer.getByRole('button',{name:'close'}).click();

  // --- Empty registry is first-class ---------------------------------------
  await panel.getByRole('button',{name:'Empty the registry (bootstrap world)'}).click();
  await panel.locator('[data-config-empty-registry]').waitFor({timeout:15000});
  check(true,'an empty World renders the honest beginning, same system, no fabricated rows');
  await shot('configuration-empty');
  await panel.getByRole('button',{name:'Restore the full registry'}).click();
  await panel.locator('[data-owner]').first().waitFor({timeout:15000});

  // --- Profiles -------------------------------------------------------------
  await panel.getByRole('button',{name:'Profiles',exact:true}).click();
  const devButton=panel.locator('[data-profile-ref="development"]');
  await devButton.waitFor({timeout:15000});
  check((await devButton.locator('.config-chip.is-active').count())===1,'the active profile is marked');
  const staging=panel.locator('[data-profile-ref="staging"]');
  await staging.click();
  const unsupportedEntry=panel.locator('[data-profile-entry="workcell:placement:placement.policy"]');
  await unsupportedEntry.waitFor({timeout:15000});
  check((await unsupportedEntry.getAttribute('data-supported'))==='false','an entry no owner contributes renders unsupported — held honestly, never dropped (the sixth status)');
  check((await panel.getByText('workcell → placement-default').count())>=1,'native profiles render as references, never expanded');
  await panel.getByRole('button',{name:'Use…'}).click();
  const usePlan=panel.locator('[data-profile-use-plan]');
  await usePlan.waitFor({timeout:15000});
  check((await usePlan.getByText('Nothing has moved yet').count())===1,'profile use shows the inspectable plan before anything moves');
  await shot('profiles-use-plan');
  await usePlan.getByRole('button',{name:'Make active'}).click();
  await panel.locator('[data-profile-detail="staging"]').waitFor({timeout:15000});
  await page.waitForTimeout(600);
  check((await panel.locator('[data-profile-ref="staging"] .config-chip.is-active').count())===1,'the switch happened only after the plan was shown and accepted');
  check((await panel.locator('[data-profile-ref="development"] .config-chip.is-active').count())===0,'the previous profile is no longer marked active');
  const result=panel.locator('[aria-label="Profile use result"]');
  check((await result.count())===1,'the switch result renders as a ChangeSet');
  await result.getByRole('button',{name:'close'}).click();
}
