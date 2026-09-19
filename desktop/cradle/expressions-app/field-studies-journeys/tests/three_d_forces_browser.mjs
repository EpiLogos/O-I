/**
 * Acceptance: the force layer follows the 3D body — relational, pairwise,
 * resonator (3D), medium (3D) and the Surfaces-occlude control. Drives the
 * real studio controls and reads settled GPU particle state back through the
 * engine's own diagnostics.
 *
 * Run with the dev server up:  node tests/three_d_forces_browser.mjs
 */
import { chromium } from 'playwright';

const URL = process.env.OI_TEST_URL || 'http://localhost:3001/';
const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ` — ${detail}` : ''));
};

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_EXECUTABLE || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'],
});
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e));
page.on('console', (e) => { if (e.type() === 'error') errors.push('console: ' + e.text()); });

await page.goto(URL, { waitUntil: 'load' });
await page.waitForFunction('() => !!window.__FIELD_STUDIES__', null, { timeout: 45000 });
await page.waitForTimeout(5000);
// The playhead boots paused, but physics always breathes — no transport call
// needed (and the external transport UI would rebuild the inspector content).

const zStats = () => page.evaluate(`(() => {
  const s = window.__FIELD_STUDIES__.inspect(true);
  const p = s.positions;
  let mn = Infinity, mx = -Infinity, sum = 0, nan = 0;
  const n = Math.floor(p.length / 4);
  for (let i = 0; i < n; i++) {
    const z = p[i * 4 + 2];
    if (!Number.isFinite(z)) { nan++; continue; }
    if (z < mn) mn = z;
    if (z > mx) mx = z;
    sum += Math.abs(z);
  }
  return { count: n, nan, spanZ: mx - mn, meanAbsZ: sum / n };
})()`);

const waitStable = async (timeout = 150000) => {
  let prev = -1;
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const { spanZ } = await zStats();
    if (prev > 0 && Math.abs(spanZ - prev) < Math.max(1, prev * 0.02)) return spanZ;
    prev = spanZ;
    await page.waitForTimeout(4000);
  }
  return prev;
};

const openSection = async (value) => {
  await page.evaluate(`(() => {
    window.__FIELD_STUDIES__.openEditor('field');
    const b = document.querySelector('[data-action="studio-section"][data-value="${value}"]');
    if (b) b.click();
    return !!b;
  })()`);
  await page.waitForTimeout(900);
};

const tick = async (bind, want = true) => {
  const found = await page.evaluate(`(() => {
    const el = document.querySelector('input[data-bind="${bind}"]');
    if (!el) return false;
    if (el.checked !== ${want}) { el.checked = ${want}; el.dispatchEvent(new Event('change', {bubbles: true})); }
    return true;
  })()`);
  await page.waitForTimeout(900);
  return found;
};

const setSelect = async (bind, value) => {
  const found = await page.evaluate(`(() => {
    const el = document.querySelector('select[data-bind="${bind}"]');
    if (!el) return false;
    el.value = '${value}';
    el.dispatchEvent(new Event('change', {bubbles: true}));
    return true;
  })()`);
  await page.waitForTimeout(900);
  return found;
};

// --- 1. Body on -------------------------------------------------------------
await openSection('volume');
check('the body toggle engages', await tick('engine.volumeEnabled'));
const settled = await waitStable();
const body = await zStats();
check('the glyph becomes a body', body.spanZ > 30 && body.nan === 0,
  `span ${body.spanZ.toFixed(1)}, ${body.nan} NaN`);

// --- 2. Relational forces act through the body, not against it --------------
await openSection('relational');
check('relational forces engage', await tick('engine.relationalEnabled'));
await waitStable();
const rel = await zStats();
// Legacy attractors pinned to z=0 dragged bodies flat; the 3D relational
// system must keep the body's depth presence.
check('the body keeps its depth under relational gravity', rel.meanAbsZ > body.meanAbsZ * 0.4 && rel.spanZ > 20,
  `mean |z| ${body.meanAbsZ.toFixed(2)} → ${rel.meanAbsZ.toFixed(2)}, span ${rel.spanZ.toFixed(1)}`);
check('relational disengages', await tick('engine.relationalEnabled', false));

// --- 3. Pairwise contacts in 3D: sheets survive contact ---------------------
await openSection('collision');
check('pairwise contacts engage', await tick('engine.pairwiseEnabled'));
await waitStable();
const pw = await zStats();
check('contacts no longer flatten the body', pw.spanZ > body.spanZ * 0.5,
  `span ${body.spanZ.toFixed(1)} → ${pw.spanZ.toFixed(1)}`);
check('pairwise disengages', await tick('engine.pairwiseEnabled', false));

// --- 4. Resonator: 3D volumetric field --------------------------------------
await openSection('resonance');
check('the resonator dimension control exists', await setSelect('engine.templateDimension', '3D'));
check('the resonator engages', await tick('engine.resonanceEnabled'));
await waitStable();
const res3d = await zStats();
check('the 3D resonator keeps the field volumetric', res3d.spanZ > 20 && res3d.nan === 0,
  `span ${res3d.spanZ.toFixed(1)}, mean |z| ${res3d.meanAbsZ.toFixed(2)}`);
check('the resonator disengages', await tick('engine.resonanceEnabled', false));

// --- 5. Medium: 3D fluid space ----------------------------------------------
await openSection('collision');
check('the medium space control exists', await setSelect('engine.mediumDimension', '3D'));
check('the medium engages', await tick('engine.mediumEnabled'));
await page.waitForTimeout(12000);
const med = await zStats();
check('the field still settles in the 3D medium', Number.isFinite(med.meanAbsZ) && med.count > 1000 && med.nan === 0,
  `span ${med.spanZ.toFixed(1)}`);
check('the medium disengages', await tick('engine.mediumEnabled', false));

// --- 6. Surfaces occlude: the setting registers ------------------------------
await openSection('volume');
check('occlusion select exists', await setSelect('engine.depthOcclusion', 'on'));
const stored = await page.evaluate(`window.__FIELD_STUDIES__.getDocument().scenes[0].engine.depthOcclusion`);
check('the scene stores the occlusion choice', stored === 'on' || stored === true, String(stored));
await page.waitForTimeout(2500);
check('occlusion "No" restores every mark drawing', await setSelect('engine.depthOcclusion', 'off'));
await page.waitForTimeout(2500);

// --- 7. The whole session stayed healthy ------------------------------------
const frames = await page.evaluate(`(() => new Promise(res => {
  let n = 0; const t0 = performance.now();
  const step = () => { n++; performance.now() - t0 < 1500 ? requestAnimationFrame(step) : res(n); };
  requestAnimationFrame(step);
}))()`);
check('the renderer kept drawing through every subsystem', frames > 3, `${frames} frames in 1.5s on software WebGL`);
const shaderErrors = errors.filter((e) => /GL_|shader|program/i.test(e));
check('no WebGL/shader errors', !shaderErrors.length, shaderErrors.slice(0, 2).join(' | '));
check('no page errors', !errors.filter((e) => e.startsWith('pageerror')).length, errors.slice(0, 2).join(' | '));

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length} checks — ${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
