import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const DOCUMENTS = resolve(here, '..', '..', 'documents');

/** Wayfinder §2 + §3.3 — the blank tab's two supplied document forms (0/1,
 *  4+2), opened as their real files through the existing file route, then
 *  exercised through the native Save path: CAS revision advance, a lossless
 *  round trip of the real 466,929-byte payload, the structured conflict
 *  under an external change, the rendered document re-read from saved
 *  bytes, and the document's own Save HTML copy export inside the sandbox.
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
  const locationOf = (name) => {
    const dir = call('central.files.list', { path: 'Work/O-I/desktop/cradle/documents' });
    const entry = dir.entries.find(e => e.name === name);
    if (!entry) throw new Error(`${name} is not listed under the documents ground`);
    return entry.location;
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
      readDocument: (name) => call('central.files.read', { location: locationOf(name) }),
      writeDocument: (name, expectedRevision, content) =>
        call('central.files.write', { location: locationOf(name), expected_revision: expectedRevision, content, actor: 'walk-external-change', actor_kind: 'agent' }),
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
  // Save through the surface's own keyboard path (⌘S); the footer status
  // span is deliberately collapsed to a sliver until the footer is hovered
  // (cradle.css pane law), so hover first, then read it — exact match,
  // because "Unsaved" contains "saved" as a substring.
  const waitStatus = async (text, timeout = 60000) => {
    await page.locator('.pane.focused .native-file-surface footer.editor-footer').hover();
    return page.locator('.pane.focused .native-file-surface footer span', { hasText: new RegExp(`^${text}$`) }).waitFor({ timeout });
  };
  const save = () => page.keyboard.press('Meta+s');
  const toSource = async () => {
    await page.locator('.pane.focused .material-surface [role="tab"]', { hasText: 'Source' }).click();
    await page.locator('.pane.focused .native-file-surface .cm-content').waitFor({ timeout: 30000 });
    await waitStatus('Saved', 30000);
  };
  const toRendered = async () => {
    // In Source view the toggle renders inside FileSurface's own toolbar
    // (leadingTools), so the tabs are pane-scoped, not surface-class-scoped.
    await page.locator('.pane.focused [role="tab"]', { hasText: 'Rendered' }).click();
    await page.locator('.pane.focused iframe.material-frame').waitFor({ timeout: 30000 });
  };
  const appendAtEnd = async (text) => {
    const editor = page.locator('.pane.focused .native-file-surface .cm-content');
    await editor.click();
    await page.keyboard.press('ControlOrMeta+End');
    await page.keyboard.type(text);
  };

  // --- 4+2: the Day die opens as its real file -----------------------------
  await newBlankTab();
  const formButtons = await page.locator('.pane.focused .fresh-docforms button').allTextContents();
  check(formButtons.length === 2 && formButtons.some(t => t.includes('0/1')) && formButtons.some(t => t.includes('4+2')),
    'The blank tab offers exactly the two supplied document forms', { formButtons });

  await page.locator('.pane.focused .fresh-docforms button', { hasText: '4+2' }).click();
  await page.locator('.tab[data-title="ql-daily-die.html"][data-active="true"]').waitFor({ timeout: 20000 });
  await page.locator('.pane.focused .material-surface').waitFor({ timeout: 20000 });
  check(await page.locator('.pane.focused iframe.material-frame').getAttribute('sandbox') === 'allow-scripts allow-forms allow-downloads',
    'The 4+2 document renders in the contained material surface (opaque-origin sandbox; downloads allowed only for its own local export)');
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

  // --- native Save: the real 4+2 payload round-trips losslessly ------------
  const original = provision.readDocument('ql-daily-die.html');
  await toSource();
  await appendAtEnd('\n');
  await waitStatus('Unsaved');
  await save();
  await waitStatus('Saved');
  const grown = provision.readDocument('ql-daily-die.html');
  check(grown.byte_len === original.byte_len + 1 && grown.revision !== original.revision,
    'A desktop edit saves through Central with an advanced content-addressed revision',
    { before: original.byte_len, after: grown.byte_len });
  await page.keyboard.press('Backspace');
  await waitStatus('Unsaved');
  await save();
  await waitStatus('Saved');
  const restored = provision.readDocument('ql-daily-die.html');
  check(restored.revision === original.revision && restored.byte_len === original.byte_len,
    'The 466,929-byte payload round-trips the desktop editor byte-exactly (the content hash returns to the original)',
    { original: original.revision, restored: restored.revision });

  // --- native Save: stale basis meets the structured conflict --------------
  const behind = provision.readDocument('ql-daily-die.html');
  provision.writeDocument('ql-daily-die.html', behind.revision, `${behind.content}\n<!-- external change while the editor held a stale basis -->`);
  await appendAtEnd('x');
  await waitStatus('Unsaved');
  await save();
  const conflict = page.locator('.pane.focused [aria-label="File conflict"]');
  await conflict.waitFor({ timeout: 60000 });
  check(await conflict.locator('textarea[aria-label="Current file"]').count() === 1
    && (await conflict.textContent()).includes("differs from your draft"),
    'A stale save meets the structured conflict — the current file is shown beside the retained draft, nothing overwritten');
  await conflict.getByRole('button', { name: 'Use current revision as draft basis' }).click();
  // The rebase button holds focus after the click (it sits outside the
  // editor's scroll pane, whose onKeyDown carries ⌘S), so the caret goes
  // back into the writing surface before the save.
  await page.locator('.pane.focused .native-file-surface .cm-content').click();
  await save();
  await waitStatus('Saved');
  check(true, 'Rebasing the draft on the current revision lets the save land through the owner');

  // --- the document's own Save HTML copy works inside the sandbox ----------
  await toRendered();
  const exportFrame = page.frameLocator('.pane.focused iframe.material-frame');
  await exportFrame.locator('#cube').waitFor({ timeout: 30000 });
  const downloadPromise = page.context().waitForEvent('download', { timeout: 20000 });
  await exportFrame.locator('[aria-label="Save HTML copy"]').click();
  const download = await downloadPromise;
  check(/\.html$/i.test(download.suggestedFilename()),
    'The 4+2 document performs its own Save HTML copy — a separate, network-free export that overwrites nothing',
    { filename: download.suggestedFilename() });

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

  // --- native Save on the 0/1 file: saved bytes drive the rendered document -
  await toSource();
  await appendAtEnd('\n<div id="walk-roundtrip-marker">saved through the native path</div>');
  await waitStatus('Unsaved');
  await save();
  await waitStatus('Saved');
  const savedFlow = provision.readDocument('ql-dialogue-flow.html');
  check(savedFlow.content.includes('walk-roundtrip-marker'),
    'The 0/1 edit saved through the desktop is what Central now holds');
  await toRendered();
  await page.locator('.pane.focused .material-surface button[aria-label="Reload preview"]').click();
  await dialogue.locator('#walk-roundtrip-marker').waitFor({ timeout: 30000 });
  check(true, 'Re-read from the owner, the rendered 0/1 document shows the saved writing');
  await shot('dialogue-01-native-save');

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
