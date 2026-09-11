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
  const focusBefore=JSON.stringify((await channel('read.focus')).data);
  check((await panel.locator(':scope > details.product-section').count())===7,'Settings projects all seven positions (O:I + six products)');
  check((await panel.locator(':scope > details > summary > span').filter({hasText:'— discovered, not verified ready'}).count())===6,'BOOT-06/12 honest availability chip on every discovered position');
  check((await panel.getByText(/No operations here yet\./).count())===1,'QL renders its emptiness honestly — no fabricated controls');
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
