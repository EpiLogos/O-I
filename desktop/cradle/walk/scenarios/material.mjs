import {docText, waitForDoc} from '../editor-doc.mjs';
// FND-04 general canvas material host — walked against real Central
// ground (unadopted "Work/Material", same native-file pattern as
// files.mjs's "Work/Other") and the real dev-only material route on the
// walk bridge. Every renderer here runs the "bridge" transport branch
// (there is no Tauri host in a walk); the `oi-material://` protocol
// itself is exercised only by the shipped app.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// The smallest real, decodable 1x1 transparent PNG (well-known bytes) —
// the walk must prove an actual image decodes, not just that bytes moved.
const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

function minimalPdf() {
  const parts = [];
  let offset = 0;
  const offsets = {};
  const push = (text) => {
    parts.push(text);
    offset += Buffer.byteLength(text, 'latin1');
  };
  push('%PDF-1.4\n');
  offsets[1] = offset;
  push('1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n');
  offsets[2] = offset;
  push('2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n');
  offsets[3] = offset;
  push('3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]/Resources<<>>>>endobj\n');
  const xrefOffset = offset;
  push('xref\n0 4\n');
  push('0000000000 65535 f \n');
  for (let i = 1; i <= 3; i++) push(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
  push(`trailer<</Size 4/Root 1 0 R>>\nstartxref\n${xrefOffset}\n%%EOF`);
  return Buffer.from(parts.join(''), 'latin1');
}

export async function setup() {
  const root = mkdtempSync(join(tmpdir(), 'oi-cradle-material-'));
  const ctrl = process.env.OI_CENTRAL_CTRL_BIN ?? 'ctrl';
  const call = (action, input = {}) => {
    const r = JSON.parse(execFileSync(ctrl, ['--root', root, '--json', 'action', 'run', action, JSON.stringify(input)], { encoding: 'utf8' }));
    if (!r.ok) throw new Error(JSON.stringify(r));
    return r.data;
  };
  try {
    call('central.init');
    const projectRoot = join(root, 'Work', 'Material');
    mkdirSync(join(projectRoot, 'assets'), { recursive: true });
    writeFileSync(
      join(projectRoot, 'study.html'),
      '<!doctype html>\n<html><head><link rel="stylesheet" href="assets/style.css"></head>\n'
        + '<body><h1>Material study</h1><img src="assets/logo.png" alt="logo" id="logo">'
        + '<a href="notes.txt" id="sibling-link">notes</a><button id="increment">Increment</button><output id="count">0</output><script src="assets/interaction.js"></script></body></html>\n',
    );
    writeFileSync(join(projectRoot, 'assets', 'interaction.js'), 'document.querySelector("#increment").onclick=()=>{document.querySelector("#count").textContent=String(Number(document.querySelector("#count").textContent)+1)}');
    writeFileSync(join(projectRoot, 'assets', 'style.css'), 'body{background-color:rgb(17,34,51);}\n');
    writeFileSync(join(projectRoot, 'assets', 'logo.png'), PNG_BYTES);
    writeFileSync(
      join(projectRoot, 'notes.md'),
      '# Notes\n\nA paragraph with **bold** and *italic* text.\n\n- one\n- two\n\n'
        + '`inline code`\n\n[sibling](notes.txt)\n\n![logo](assets/logo.png)\n',
    );
    writeFileSync(join(projectRoot, 'notes.txt'), 'Sibling text file.\n');
    writeFileSync(join(projectRoot, 'mystery.bin'), Buffer.from([0, 1, 2, 255, 0, 3]));
    writeFileSync(join(projectRoot, 'document.pdf'), minimalPdf());
    return {
      root,
      projectRoot,
      call,
      env: { OI_CENTRAL_ROOT: root, OI_CENTRAL_PROJECT_QUERY: 'Material' },
      cleanup: () => rmSync(root, { recursive: true, force: true }),
    };
  } catch (error) {
    rmSync(root, { recursive: true, force: true });
    throw error;
  }
}

export default async function run({ page, baseUrl, bridgeUrl, check, metric, shot, channel, log }) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(baseUrl);
  await channel('info');
  const nav = page.getByRole('complementary', { name: 'World navigator' });
  await nav.locator('[data-project-path="Work/Material"]').click();
  if ((await page.getByRole('button', { name: 'Material: files', exact: true }).getAttribute('aria-pressed')) !== 'true') {
    await page.getByRole('button', { name: 'Material: files', exact: true }).click();
  }

  const openFile = async (path) => {
    const title = path.split('/').pop();
    await nav.locator(`[data-file-path="Work/Material/${path}"]`).click();
    // Wait for the real active tab (not just "any material/file surface
    // already in the DOM" — with a second surface already open, that
    // locator's `.first()` can match the previous surface's still-mounted
    // node before React has actually switched the active tab over).
    await page.locator(`.tab[data-title="${title}"][data-active="true"]`).waitFor();
    await page.locator('.pane.focused .material-surface, .pane.focused .native-file-surface').first().waitFor();
  };

  // --- HTML: relative image + stylesheet + link, in a contained surface ---
  await openFile('study.html');
  const htmlFrame = page.frameLocator('iframe.material-frame');
  await htmlFrame.locator('#logo').waitFor();
  const logoLoaded = await htmlFrame.locator('#logo').evaluate((img) => img.naturalWidth > 0);
  check(logoLoaded, 'HTML relative <img> resolves through the material route and actually decodes');
  const bodyBackground = await htmlFrame.locator('body').evaluate((el) => getComputedStyle(el).backgroundColor);
  check(bodyBackground === 'rgb(17, 34, 51)', 'HTML relative <link rel=stylesheet> is loaded and applied', { bodyBackground });
  check(await htmlFrame.locator('#sibling-link').getAttribute('href') === 'notes.txt', 'HTML relative <a> keeps its literal reference (never rewritten)');
  await htmlFrame.locator('#increment').click();
  check(await htmlFrame.locator('#count').innerText()==='1','Owner-resolved relative JavaScript executes the actual HTML interaction');
  check(await page.locator('iframe.material-frame').getAttribute('sandbox')==='allow-scripts allow-forms allow-downloads','HTML retains opaque-origin sandbox without native bridge authority (allow-downloads only serves the document\'s own local Save HTML copy export)');
  await shot('html-rendered');

  // --- traversal outside the material directory is refused (direct bridge check) ---
  const studyLocation = (await (await fetch(`${bridgeUrl}/op`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ op: 'files_list', path: 'Work/Material' }),
  })).json()).outcome.directory.entries.find((e) => e.name === 'study.html').location;
  const encodedLocation = encodeURIComponent(JSON.stringify(studyLocation));
  // Percent-encoded so the client's own URL parser cannot collapse the
  // dot-segments before the request is even sent — the literal string
  // "%2e%2e" must arrive at the server for this to test the real
  // traversal refusal in `resolve_material`, not client-side normalisation.
  const traversal = await fetch(`${bridgeUrl}/material/${encodedLocation}/%2e%2e/%2e%2e/root-note-does-not-exist`);
  check(traversal.status === 403 || traversal.status === 404, `Traversal outside the material directory is refused (status ${traversal.status})`);
  const legitimate = await fetch(`${bridgeUrl}/material/${encodedLocation}/assets/logo.png`);
  check(legitimate.status === 200 && legitimate.headers.get('content-type') === 'image/png', 'A real sibling asset resolves with the owner mime hint as Content-Type');

  // --- suspend on maximize: a second pane's iframe blanks while hidden, mounted ---
  // study.html is already open (tab 1); open notes.txt as a second tab in the
  // same pane, then split — the active tab (notes.txt) moves to a new pane,
  // leaving study.html alone (and now hidden) in the first.
  await openFile('notes.txt');
  await page.keyboard.press('Meta+d');
  await page.waitForFunction(() => document.querySelectorAll('.pane.group').length === 2);
  const htmlFrameLocator = page.locator('iframe.material-frame');
  await page.keyboard.press('Meta+Alt+Enter');
  // `:visible` is a Playwright-locator-only pseudo-class — inside a real
  // browser evaluate/waitForFunction callback only native selectors run, so
  // visibility is checked via `offsetParent` (null once an ancestor
  // `.pane.split` is set to `display:none` by maximize — Workbench.tsx).
  await page.waitForFunction((count) => [...document.querySelectorAll('.pane.group')].filter((el) => el.offsetParent !== null).length === count, 1);
  // A retrying wait, not a one-shot `.count()` snapshot: the pane-visibility
  // wait above only guarantees CSS has settled, not that every consumer
  // (IntersectionObserver-driven suspend, in particular) has finished its
  // own async reaction to it.
  await page.waitForFunction(() => document.querySelectorAll('iframe.material-frame').length === 1);
  check(true, 'Maximizing another pane keeps the hidden HTML surface mounted');
  // The walk always runs the "bridge" transport branch (MaterialSurface.tsx):
  // a hidden HTML iframe is suspended by clearing its `srcDoc` prop (React
  // omits the `srcdoc` attribute entirely), never by setting `src`, which
  // this transport's iframe never has at all — `src="about:blank"` is the
  // Tauri-only suspension path.
  await page.waitForFunction(() => document.querySelector('iframe.material-frame')?.getAttribute('srcdoc') === null);
  const blankedSrcdoc = await htmlFrameLocator.getAttribute('srcdoc');
  check(blankedSrcdoc === null, 'A hidden pane (maximize) suspends its iframe (srcdoc cleared)', { blankedSrcdoc });
  await page.keyboard.press('Meta+Alt+Enter');
  await page.waitForFunction((count) => [...document.querySelectorAll('.pane.group')].filter((el) => el.offsetParent !== null).length === count, 2);
  await page.waitForFunction(() => !!document.querySelector('iframe.material-frame')?.getAttribute('srcdoc'));
  const resumedSrcdoc = await htmlFrameLocator.getAttribute('srcdoc');
  check(!!resumedSrcdoc, 'Restoring the pane resumes the real material content (srcdoc restored)', { resumedSrcdocLength: resumedSrcdoc?.length });
  // Close the split-off pane's tab (notes.txt) so a single pane remains.
  await page.keyboard.press('Meta+w');
  await page.waitForFunction(() => document.querySelectorAll('.pane.group').length === 1);

  // --- suspend on document hidden (window hidden) ---
  await openFile('study.html');
  await page.locator('iframe.material-frame').waitFor();
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForFunction(() => document.querySelector('iframe.material-frame')?.getAttribute('srcdoc') === null);
  check(true, 'document.visibilityState hidden suspends the rendered iframe');
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForFunction(() => !!document.querySelector('iframe.material-frame')?.getAttribute('srcdoc'));
  check(true, 'document visible again resumes the rendered iframe');

  // --- Markdown: rendered view distinct from Source, Source is the real editor ---
  await openFile('notes.md');
  const mdFrame = page.frameLocator('iframe.material-frame');
  await mdFrame.locator('h1').waitFor();
  check((await mdFrame.locator('h1').innerText()) === 'Notes', 'Markdown heading renders');
  check((await mdFrame.locator('li').allInnerTexts()).join(',') === 'one,two', 'Markdown list renders as real <li> elements');
  check(await mdFrame.locator('strong').innerText() === 'bold', 'Markdown bold emphasis renders');
  const mdImageLoaded = await mdFrame.locator('img').evaluate((img) => new Promise((resolve) => {
    if (img.complete) return resolve(img.naturalWidth > 0);
    img.onload = () => resolve(img.naturalWidth > 0);
    img.onerror = () => resolve(false);
  }));
  check(mdImageLoaded, 'Markdown image resolves through the material route and decodes');
  await page.getByRole('tab', { name: 'Source' }).click();
  await page.locator('.cm-content').waitFor();
  check((await docText(page,'.cm-content')).startsWith('# Notes'), 'Source toggle returns the real FileSurface editor over the raw Markdown bytes');
  await page.getByRole('tab', { name: 'Rendered' }).click();
  await mdFrame.locator('h1').waitFor();
  check(true, 'Toggling back to Rendered re-renders Markdown');
  await shot('markdown-rendered');

  // --- Image: a real decodable <img> from the material route ---
  await nav.getByRole('button', { name: 'Expand folder assets', exact: true }).click();
  // The listing that populates "assets"'s children is its own owner round
  // trip (`central.files.list`) — wait for the real entry to actually
  // exist rather than assuming the expand click's re-render already
  // landed by the time the next line runs.
  await nav.locator('[data-file-path="Work/Material/assets/logo.png"]').waitFor();
  await openFile('assets/logo.png');
  await page.locator('img.material-image').waitFor();
  const imageDecoded = await page.locator('img.material-image').evaluate((img) => img.naturalWidth > 0);
  check(imageDecoded, 'A standalone image file renders as a real decoded <img>, not a textarea');
  await shot('image-rendered');

  // --- PDF: renders, or an honest unavailable state — never silent ---
  await openFile('document.pdf');
  await page.waitForSelector('iframe.material-frame, .material-unavailable', { timeout: 10000 });
  const pdfRendered = await page.locator('iframe.material-frame').count() === 1;
  const pdfUnavailable = await page.locator('.material-unavailable').count() === 1;
  check(pdfRendered || pdfUnavailable, 'PDF either renders in the platform viewer or discloses an honest unavailable state', { pdfRendered, pdfUnavailable });
  await shot('pdf-state');

  // --- Unsupported binary: an honest disposition card, no open-with button ---
  await openFile('mystery.bin');
  await page.locator('.material-disposition').waitFor();
  check(await page.locator('.material-disposition-note').innerText() === 'Central serves this file read-only; no renderer is available in the desktop.', 'Unsupported binary discloses the exact honest disposition sentence');
  check((await page.locator('.material-disposition dd').nth(1).innerText()).includes('6'), 'Disposition card shows the real byte length', { bytes: await page.locator('.material-disposition dd').nth(1).innerText() });
  check(await page.getByRole('button', { name: /open with/i }).count() === 0, 'No open-with control is offered — work.open has no generic file-path form (verified by research; not wired)');
  await shot('unsupported-disposition');

  // --- Text still opens the plain editor, unaffected by the delegation ---
  await openFile('notes.txt');
  await page.locator('.cm-content').waitFor();
  check((await docText(page,'.cm-content')) === 'Sibling text file.\n', 'A plain text file still opens the native FileSurface editor directly');

  // --- close and reopen restores the rendered view (not stuck on Source) ---
  await openFile('notes.md');
  await page.getByRole('tab', { name: 'Source' }).click();
  await page.locator('.cm-content').waitFor();
  await page.keyboard.press('Meta+w');
  await openFile('notes.md');
  await page.frameLocator('iframe.material-frame').locator('h1').waitFor();
  check(true, 'Close and reopen restores the Markdown rendered view (fresh mount, not stuck on Source)');

  check(errors.length === 0, 'No uncaught page errors during the material walk', { errors });
  metric('material_checks', 1);
  log('material walk complete');
}
