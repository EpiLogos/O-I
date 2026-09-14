import {setup} from './system.mjs';
export {setup};
/** The settings redesign (docs/cradle/06) keeps the system surface's
 * contract while growing it into the seven-position settings page:
 * health/activity/config/bootstrap rail, uniform product sections, world
 * header. Asserts the P1 honesty laws alongside the census contract. */
export default async function run({page,baseUrl,check,shot,channel}) {
  await page.goto(baseUrl);
  await page.getByRole('button',{name:'System',exact:true}).click();
  const panel=page.getByRole('region',{name:'System composition'});
  await panel.locator(':scope > details').first().waitFor();
  // Wait for the native census read — sections render first with an
  // honest not-disclosed placeholder.
  await panel.getByText('not verified ready').first().waitFor({timeout:30000});
  // The per-owner native disclosure read (Wave 5) lands seconds AFTER the
  // census and flips mounted positions from the census section to the
  // owner's own (measured on the run this re-contract was written from:
  // census first, mounts ~4–6s later). Counting before it settles races
  // the mounts, so wait until the native-section count is stable.
  let nativeCount=-1;
  for(let stable=0,seen=0;seen<60;){
    const count=await panel.locator(':scope > details.native-product-section').count();
    stable=count===nativeCount?stable+1:0;
    nativeCount=count;
    if(stable>=6)break; // ~3s without a mount flip: the read has settled
    await page.waitForTimeout(500);seen++;
  }
  const focusBefore=JSON.stringify((await channel('read.focus')).data);
  check((await panel.locator(':scope > details.product-section').count())===7,'Settings projects all seven positions (O:I + six products)');
  // BOOT-06/12 (docs/cradle/06 §2 L1) with L6's stronger honesty: every
  // position is honestly labelled. A position still rendered from the
  // census carries the honest non-readiness form — "… — discovered, not
  // verified ready", or the census's own missing/not-disclosed word. A
  // position whose owner ships its own oi.product-settings-disclosure/v2
  // renders the OWNER'S OWN availability word instead (the descriptor is
  // product-owned; the cradle only projects). Which owners ship is this
  // machine's truth, not the walk's assumption — the earlier frozen count
  // (exactly six census chips) pinned one machine's moment; the law under
  // assertion is the labelling itself.
  const sections=await panel.locator(':scope > details.product-section').all();
  const unlabelled=[];
  for(const section of sections){
    const cls=await section.getAttribute('class')??'';
    const name=(await section.locator(':scope > summary > strong').textContent())?.trim()??'';
    if(/native-product-section/.test(cls)){
      const chip=((await section.locator(':scope > summary .native-owner-availability').textContent())??'').trim();
      if(!chip)unlabelled.push(`${name}: native section with an empty owner availability chip`);
    }else{
      const label=((await section.locator(':scope > summary > span').allTextContents()).join(' ')).trim();
      if(!(/ — discovered, not verified ready$/.test(label)||/^(missing|not disclosed|unavailable)$/.test(label)))
        unlabelled.push(`${name}: census section labelled "${label}"`);
    }
  }
  check(unlabelled.length===0,'BOOT-06/12 every position carries its honest availability label — the census chip or the owner\'s own disclosed word, never fabricated readiness',{unlabelled});
  // L3 (docs/cradle/06 §2): empty is proof, not failure. A section whose
  // owner discloses actions renders those rows; a section with nothing
  // disclosed renders its emptiness honestly ("No operations here yet.").
  // Quaternal Logic once was the only empty position — the earlier
  // exactly-one count pinned that moment; today its own descriptor
  // discloses a real operator. The law under assertion is per position:
  // disclosed rows or the honest emptiness, never both, never a filled-in
  // fabrication.
  let fabricated=0;
  const honesty=[];
  for(const section of sections){
    const name=(await section.locator(':scope > summary > strong').textContent())?.trim()??'';
    const rows=await section.locator(':scope ul.product-actions > li').count();
    const empty=await section.locator(':scope p.product-empty').filter({hasText:'No operations here yet.'}).count();
    if((rows===0)===(empty===0))fabricated++;
    honesty.push(`${name}: ${rows} disclosed action(s), ${empty} honest emptiness`);
  }
  check(fabricated===0,'L3 every section discloses its actions or renders its emptiness honestly — nothing fabricated, nothing filled in',{honesty});
  const notYetAvailable=(await panel.locator('.product-action-availability.is-missing_native_obligation').allTextContents()).join(' ');
  check(notYetAvailable.includes('not available yet'),'Missing native operations render as a plain not-yet-available note, never as disabled buttons');
  await panel.getByRole('button',{name:'Activity',exact:true}).click();
  check((await panel.getByText('No project is currently open',{exact:false}).count())===1,'Activity view shows the honest no-project absence');
  await shot('settings-activity');
  await panel.getByRole('button',{name:'Config',exact:true}).click();
  await panel.getByText('Central location',{exact:true}).waitFor();
  await shot('settings-config');
  await panel.getByRole('button',{name:'Bootstrap',exact:true}).click();
  await panel.getByText('Bind the ground').waitFor();
  await shot('settings-bootstrap');
  await panel.getByRole('button',{name:'Health',exact:true}).click();
  check((await panel.locator(':scope > details.product-section').count())===7,'Health rail restores the seven-position census');
  check(JSON.stringify((await channel('read.focus')).data)===focusBefore,'Settings inspection never reassigns semantic focus');
  await shot('settings-health');
}
