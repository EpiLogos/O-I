import { setup } from './system.mjs';
export { setup };
/** Settings → Visuals: the expression layer's control surface.
 *
 * Asserts the desktop asks: one unambiguous master on/off (off removes the
 * renderer, on recreates it), typed text targets reach the engine, and the
 * theme choice resolves onto the shell tokens. The census contract is the
 * system-settings scenario's; this one guards the visuals seam. */
export default async function run({page,baseUrl,check,shot}) {
  await page.goto(baseUrl);
  await page.getByRole('button',{name:'System',exact:true}).click();
  const panel=page.getByRole('region',{name:'System composition'});
  await panel.locator(':scope > details').first().waitFor();
  await panel.getByRole('button',{name:'Visuals'}).click();
  await panel.getByRole('button',{name:'Themes',exact:true}).waitFor();
  check((await panel.getByRole('button',{name:'Themes',exact:true}).count())===1
    && (await panel.getByRole('button',{name:'Expression',exact:true}).count())===1,
    'Visuals splits into Themes and Expression');

  await panel.getByRole('button',{name:'Expression',exact:true}).click();
  const master=panel.getByRole('button',{name:/^Expression: (On|Off)$/});
  await master.waitFor();
  check((await master.getAttribute('aria-pressed'))==='true','The expression layer starts on');
  // The preview stage is the panel's one explicit renderer; wait for the
  // lazy host to bring the canvas up.
  await page.locator('.oi-point-cloud-overlay').waitFor({timeout:20000});
  check((await page.locator('.oi-point-cloud-overlay').count())===1,'Enabling the visuals hosts exactly one window expression canvas');

  // Typed text reaches the engine: bake a word and see the preview target change.
  await panel.getByPlaceholder('e.g. FLUID, VOID, 42').fill('VOID');
  await panel.getByRole('button',{name:'Bake word'}).click();
  await panel.locator('.visuals-diagnostics summary').click();
  await page.waitForFunction(() => {
    const pre=document.querySelector('.visuals-diagnostics pre');
    return pre ? pre.textContent.includes('VOID') : false;
  }, { timeout: 5000 });
  check(true,'The baked word reaches the running field');

  await shot('visuals-expression');

  // Master off: the renderer goes away entirely. Master on: it returns.
  await master.click();
  await page.waitForTimeout(400);
  check((await page.locator('.oi-point-cloud-overlay').count())===0,'Off removes the renderer — nothing runs hidden');
  check((await panel.getByRole('button',{name:'Expression: Off'}).getAttribute('aria-pressed'))==='false','The master switch reports the off state');
  await master.click();
  await page.locator('.oi-point-cloud-overlay').waitFor({timeout:20000});
  check((await page.locator('.oi-point-cloud-overlay').count())===1,'On recreates the renderer');

  // Theme resolution lands on the shell tokens.
  await panel.getByRole('button',{name:'Themes',exact:true}).click();
  await panel.getByRole('button',{name:'Dark',exact:true}).click();
  await page.waitForFunction(() => document.body.dataset.theme==='dark');
  check(true,'Dark theme resolves onto the oi-desktop body');
  await panel.getByRole('button',{name:'Light',exact:true}).click();
  await page.waitForFunction(() => !document.body.dataset.theme);
  check(true,'Light theme clears the override');
  await shot('visuals-panel');
}
