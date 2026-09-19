/** The donut→head verdict: the laminated showcase must show FACE layers
 * (solid center occupancy from the sampled image), three depth bands, and a
 * whole-body sequence running. */
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE || undefined, args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e));
await page.goto((process.env.OI_TEST_URL || 'http://localhost:3001/') + '#library', { waitUntil: 'load' });
await page.waitForFunction('() => !!window.__FIELD_STUDIES__', null, { timeout: 45000 });
await page.waitForTimeout(2500);
const found = await page.evaluate(`(() => { const b = document.querySelector('[data-action="start-mode"][data-id="source-laminate-head"]'); if (b) b.click(); return !!b; })()`);
console.log('showcase present:', found);
await page.waitForFunction(`() => window.__FIELD_STUDIES__.getState().engine === 'Native particle field'`, null, { timeout: 45000 });
await page.waitForTimeout(25000);
const r = await page.evaluate(`(() => {
  const s = window.__FIELD_STUDIES__.inspect(true);
  const p = s.positions;
  let nan = 0, maxAbsZ = 0, near = 0, core = 0, xSpread = [Infinity, -Infinity];
  const n = Math.floor(p.length / 4);
  for (let i = 0; i < n; i++) {
    const x = p[i * 4], y = p[i * 4 + 1], z = p[i * 4 + 2];
    if (!Number.isFinite(z)) { nan++; continue; }
    if (Math.abs(z) > maxAbsZ) maxAbsZ = Math.abs(z);
    if (Math.abs(z) > 100) { near++; } else if (Math.abs(z) < 30) { core++; }
    if (Math.abs(z) > 100) { if (x < xSpread[0]) xSpread[0] = x; if (x > xSpread[1]) xSpread[1] = x; }
  }
  // Head-vs-donut: the ring of an 'O' is hollow — a sampled face fills the middle.
  const band = xSpread[1] - xSpread[0];
  let center = 0, bandTotal = 0;
  for (let i = 0; i < n; i++) {
    const x = p[i * 4], z = p[i * 4 + 2];
    if (Math.abs(z) > 100 && x > xSpread[0] + band * 0.35 && x < xSpread[1] - band * 0.35) { bandTotal++; if (Math.abs(p[i * 4 + 1]) < 60) center++; }
  }
  return { nan, maxAbsZ: maxAbsZ.toFixed(0), near, core, centerDensity: bandTotal ? (center / bandTotal).toFixed(2) : 'n/a' };
})()`);
console.log('profile:', JSON.stringify(r));
const headVerdict = r.nan === 0 && parseInt(r.maxAbsZ) > 100 && r.near > 12000 && parseFloat(r.centerDensity) >= 0.15;
console.log('VERDICT: head, not donut →', headVerdict);
// Layers editor present for the formation.
const entityId = await page.evaluate(`window.__FIELD_STUDIES__.getDocument().scenes[0].entities.find(v => v.kind === 'formation')?.id`) ?? '';
await page.evaluate(`(() => { window.__FIELD_STUDIES__.selectEntity(` + JSON.stringify(entityId) + `); })()`);
await page.waitForTimeout(1200);
const editor = await page.evaluate(`(() => ({
  rows: document.querySelectorAll('#live-content .layer-row').length,
  addButtons: [...document.querySelectorAll('#live-content [data-action="layer-add"]')].map(b => b.dataset.kind),
  depths: [...document.querySelectorAll('#live-content input[data-layer-depth]')].map(i2 => i2.value)
}))()`);
console.log('layers editor:', JSON.stringify(editor));
console.log('page errors:', errors.length ? errors.slice(0, 2) : 'none');
await browser.close();
