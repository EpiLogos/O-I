import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const DOCUMENTS = resolve(here, '..', '..', 'documents');

/** Wayfinder §2 — the blank tab's two supplied document forms (0/1, 4+2),
 *  opened as their real files through the existing file route.
 *
 *  The scratch ground carries the ACTUAL committed intake bytes (copied
 *  from `desktop/cradle/documents/`), so what the iframe renders is the
 *  owner payload, not a synthetic look-alike. The unavailable case removes
 *  one file from the controlled ground and expects the tab's precise
 *  open-location error — never a fabricated document or silent fallback. */
export async function setup() {
  const root = mkdtempSync(join(tmpdir(), 'oi-cradle-docentry-'));
  // The Central owner is bound explicitly (executable-binding law): the
  // walk kernel calls `oi central`, and the boot actions (central.world,
  // central.recognize) must reach the SAME ctrl this setup seeds with.
  const ctrl = process.env.OI_CENTRAL_CTRL_BIN ?? 'ctrl';
  const call = (action, input = {}) => {
    const r = JSON.parse(execFileSync(ctrl, ['--root', root, '--json', 'action', 'run', action, JSON.stringify(input)], { encoding: 'utf8' }));
    if (!r.ok) throw new Error(JSON.stringify(r));
    return r.data;
  };
  try {
    call('central.init');
    const documentsDir = join(root, 'Work', 'O-I', 'desktop', 'cradle', 'documents');
    mkdirSync(documentsDir, { recursive: true });
    copyFileSync(join(DOCUMENTS, 'ql-daily-die.html'), join(documentsDir, 'ql-daily-die.html'));
    copyFileSync(join(DOCUMENTS, 'ql-dialogue-flow.html'), join(documentsDir, 'ql-dialogue-flow.html'));
    return {
      root,
      documentsDir,
      env: { OI_CENTRAL_ROOT: root, OI_CENTRAL_PROJECT_QUERY: 'O-I', OI_CENTRAL_CTRL_BIN: ctrl },
      cleanup: () => rmSync(root, { recursive: true, force: true }),
    };
  } catch (error) {
    rmSync(root, { recursive: true, force: true });
    throw error;
  }
}

export default async function run({ page, baseUrl, provision, check, shot }) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(baseUrl);

  const nav = page.getByRole('complementary', { name: 'World navigator' });
  await nav.locator('[data-project-path="Work/O-I"]').waitFor({ timeout: 30000 });
  await nav.locator('[data-project-path="Work/O-I"]').click();

  // A blank tab is an ordinary new tab; the two document forms sit beside
  // Write/Search/Terminal as real, keyboard-reachable buttons. The first
  // tab comes from the keyboard (⌘T); later ones from the tab strip's own
  // New tab control, because a document iframe holds keyboard focus after
  // it has been interacted with (the frame, not the desktop, gets ⌘T).
  const newBlankTab = async (via = 'keyboard') => {
    if (via === 'keyboard') await page.keyboard.press('Meta+t');
    else await page.locator('.pane.focused .strip-open').click();
    await page.locator('.pane.focused .fresh-surface').waitFor({ timeout: 15000 });
    await page.locator('.pane.focused .fresh-docforms button').first().waitFor({ timeout: 5000 });
  };

  // --- 4+2: the Day die opens as its real file -----------------------------
  await newBlankTab();
  const formButtons = await page.locator('.pane.focused .fresh-docforms button').allTextContents();
  check(formButtons.length === 2 && formButtons.some(t => t.includes('0/1')) && formButtons.some(t => t.includes('4+2')),
    'The blank tab offers exactly the two supplied document forms', { formButtons });

  await page.locator('.pane.focused .fresh-docforms button', { hasText: '4+2' }).click();
  await page.locator('.tab[data-title="ql-daily-die.html"][data-active="true"]').waitFor({ timeout: 20000 });
  await page.locator('.pane.focused .material-surface').waitFor({ timeout: 20000 });
  check(await page.locator('.pane.focused iframe.material-frame').getAttribute('sandbox') === 'allow-scripts allow-forms',
    'The 4+2 document renders in the contained material surface (opaque-origin sandbox)');
  const die = page.frameLocator('.pane.focused iframe.material-frame');
  await die.locator('#cube').waitFor({ timeout: 30000 });
  const faces = await die.locator('.face').count();
  check(faces === 6, 'The 4+2 file IS the six-position die document (six faces rendered from the real payload)', { faces });
  const dieDoc = JSON.parse(await die.locator('script#ql-doc').textContent());
  check(dieDoc.meta?.type === 'daily' && Object.keys(dieDoc.fields ?? {}).length === 17,
    'The 4+2 payload keeps its daily type and all seventeen field keys',
    { type: dieDoc.meta?.type, fields: Object.keys(dieDoc.fields ?? {}).length, revision: dieDoc.meta?.revision });
  const dieMetaKeys = Object.keys(dieDoc.meta ?? {});
  check(['uuid', 'created', 'name', 'title', 'type', 'date', 'timezone', 'revision'].every(k => dieMetaKeys.includes(k))
    && Array.isArray(dieDoc.capture) && Array.isArray(dieDoc.sessions),
    'The 4+2 payload identity keys and fixture collections survive the round trip into the desktop (blank values are legitimate)',
    { metaKeys: dieMetaKeys, collections: ['capture', 'sessions', 'completed', 'media', 'notes', 'contributions'].filter(k => Array.isArray(dieDoc[k])) });
  await shot('die-42-rendered');

  // --- 0/1: Dialogue · Flow · Journal, chosen from the keyboard ----------
  await newBlankTab('strip');
  await page.locator('.pane.focused .fresh-docforms button', { hasText: '0/1' }).focus();
  await page.keyboard.press('Enter');
  await page.locator('.tab[data-title="ql-dialogue-flow.html"][data-active="true"]').waitFor({ timeout: 20000 });
  const dialogue = page.frameLocator('.pane.focused iframe.material-frame');
  await dialogue.locator('.mast .views').waitFor({ timeout: 30000 });
  check(await dialogue.locator('.mast .views button', { hasText: 'Journal' }).count() === 1,
    'The 0/1 document exposes its Journal mode — no third file exists or is needed');
  const dialogueDoc = JSON.parse(await dialogue.locator('script#ql-doc').textContent());
  check(Array.isArray(dialogueDoc.entries) && Array.isArray(dialogueDoc.journal) && dialogueDoc.entries !== dialogueDoc.journal,
    'Dialogue entries and single-person Journal pages remain distinct collections inside the 0/1 file',
    { entries: dialogueDoc.entries.length, journal: dialogueDoc.journal.length });
  await dialogue.locator('.mast .views button', { hasText: 'Journal' }).click();
  await dialogue.locator('.journal .body').waitFor({ timeout: 15000 });
  check(true, 'The 0/1 Journal view opens as a single-person writing page inside the same document');
  await shot('dialogue-01-journal');

  // --- unavailable: a missing form names its exact open location ----------
  rmSync(join(provision.documentsDir, 'ql-daily-die.html'));
  await newBlankTab('strip');
  await page.locator('.pane.focused .fresh-docforms button', { hasText: '4+2' }).click();
  const alert = page.locator('.pane.focused .fresh-surface p[role="alert"]');
  await alert.waitFor({ timeout: 20000 });
  const message = await alert.textContent();
  check(message.includes('desktop/cradle/documents') && message.includes('ql-daily-die.html') && message.includes('4+2'),
    'A missing form reports the precise unavailable state with its exact open location — no fabricated payload',
    { message });
  await shot('die-42-unavailable');

  check(errors.length === 0, 'No renderer page errors during document entry', { errors });
}
