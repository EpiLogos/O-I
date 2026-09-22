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
    copyFileSync(join(DOCUMENTS, 'oi-epi-card.html'), join(documentsDir, 'oi-epi-card.html'));
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
    await page.locator('.pane.focused .fresh-surface:not(.rest-ground)').waitFor({ timeout: 15000 });
    const disclosure = page.locator('.pane.focused .fresh-more');
    if (!(await disclosure.evaluate((el) => el.open))) await disclosure.locator('summary').click();
    await page.locator('.pane.focused .fresh-docforms button').first().waitFor({ timeout: 5000 });
  };
  // Save through the surface's own keyboard path (⌘S); the footer status
  // span is deliberately collapsed to a sliver until the footer is hovered
  // (cradle.css pane law). No hover reveal: the pane footer follows focus
  // and is pinned up by the pane's own bottom-right dot. Pin it, read the
  // exact status, release it — and then give the editor its focus back:
  // the pin click lands on the dot button, and a ⌘S pressed while the dot
  // holds focus reaches nothing (the save handler lives on the source
  // editor's own keydown, FileSurface's source-editor-scroll). The standing
  // red of 09-20..09-22 was exactly this stolen focus, not the save.
  const waitStatus = async (text, title, timeout = 60000) => {
    const editor = page.locator(`.pane.focused .native-file-surface .cm-content[aria-label="Editing ${title}"]`);
    const hadEditorFocus = await editor.evaluate((el) => el === document.activeElement || el.contains(document.activeElement)).catch(() => false);
    const dot = page.locator('.pane.focused [data-pane-footer-dot]');
    if ((await dot.getAttribute('aria-pressed')) !== 'true') await dot.click();
    try {
      // Each file surface carries its own footer (the surface region is
      // named "File <title>"), and concealed documents keep theirs mounted.
      return await page.locator(`.pane.focused [aria-label="File ${title}"] footer span`, { hasText: new RegExp(`^${text}$`) }).waitFor({ timeout });
    } finally {
      if ((await dot.getAttribute('aria-pressed')) === 'true') await dot.click();
      // Programmatic focus keeps the caret where the writing left it — a
      // click here would move it and corrupt the next byte-exact edit.
      if (hadEditorFocus) await editor.evaluate((el) => el.focus()).catch(() => {});
    }
  };
  const save = () => page.keyboard.press('Meta+s');
  // Each view exposes its own way back to the other: from Rendered, the
  // material surface's own Document presentation tabs; from Source, the
  // editor toolbar's "Document view" group (the material toggle is present
  // but hidden there — the pane-wide selector used to catch both and die on
  // strict-mode ambiguity once the chrome grew the second toggle).
  const toSource = async (title) => {
    // The visible Source toggle: concealed documents keep their own (hidden)
    // material surface mounted, so the pane may hold several — the person
    // clicks the one on the surface they are looking at.
    await page.locator('.pane.focused .material-surface [role="tab"]').filter({ hasText: 'Source' }).locator('visible=true').first().click();
    await page.locator(`.pane.focused .native-file-surface .cm-content[aria-label="Editing ${title}"]`).waitFor({ timeout: 30000 });
    await waitStatus('Saved', title, 30000);
  };
  // Concealed documents stay mounted (the retention law), so the pane can
  // hold several material iframes at once: every frame access names its
  // document by the iframe's own title.
  const frameFor = (title) => page.frameLocator(`.pane.focused iframe.material-frame[title="${title}"]`);
  const toRendered = async (title) => {
    // The pane hosts more than one Rendered toggle (the material surface's
    // own presentation tabs, and the editor toolbar's), never more than one
    // of them visible in a given view — click the visible one, which is the
    // one act a person performs.
    await page.locator('.pane.focused [role="tab"]').filter({ hasText: 'Rendered' }).locator('visible=true').first().click();
    await page.locator(`.pane.focused iframe.material-frame[title="${title}"]`).waitFor({ timeout: 30000 });
  };
  const appendAtEnd = async (text, title) => {
    const editor = page.locator(`.pane.focused .native-file-surface .cm-content[aria-label="Editing ${title}"]`);
    await editor.click();
    await page.keyboard.press('ControlOrMeta+End');
    await page.keyboard.type(text);
  };

  // --- 4+2: the Day die opens as its real file -----------------------------
  await newBlankTab();
  const formButtons = await page.locator('.pane.focused .fresh-docforms button').allTextContents();
  check(formButtons.length === 5 && formButtons.some(t => t.includes('Flow')) && formButtons.some(t => t.includes('Day'))
      && formButtons.some(t => t.includes('Beings')) && formButtons.some(t => t.includes('Things'))
      && formButtons.some(t => t.includes('Epi-Card')),
    'The blank tab offers exactly the five document types — Day, Flow, Beings, Things, Epi-Card (the cube is withdrawn)', { formButtons });

  await page.locator('.pane.focused .fresh-docforms button', { hasText: 'Day' }).click();
  await page.locator('.tab[data-title="ql-daily-die.html"][data-active="true"]').waitFor({ timeout: 20000 });
  await page.locator('.pane.focused .material-surface').waitFor({ timeout: 20000 });
  check(await page.locator('.pane.focused iframe.material-frame[title="ql-daily-die.html"]').getAttribute('sandbox') === 'allow-scripts allow-forms allow-downloads',
    'The 4+2 document renders in the contained material surface (opaque-origin sandbox; downloads allowed only for its own local export)');
  const die = frameFor('ql-daily-die.html');
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
  await toSource('ql-daily-die.html');
  await appendAtEnd('\n', 'ql-daily-die.html');
  await waitStatus('Unsaved', 'ql-daily-die.html');
  await save();
  await waitStatus('Saved', 'ql-daily-die.html');
  const grown = provision.readDocument('ql-daily-die.html');
  check(grown.byte_len === original.byte_len + 1 && grown.revision !== original.revision,
    'A desktop edit saves through Central with an advanced content-addressed revision',
    { before: original.byte_len, after: grown.byte_len });
  await page.keyboard.press('Backspace');
  await waitStatus('Unsaved', 'ql-daily-die.html');
  await save();
  await waitStatus('Saved', 'ql-daily-die.html');
  const restored = provision.readDocument('ql-daily-die.html');
  check(restored.revision === original.revision && restored.byte_len === original.byte_len,
    'The 466,929-byte payload round-trips the desktop editor byte-exactly (the content hash returns to the original)',
    { original: original.revision, restored: restored.revision });

  // --- native Save: stale basis meets the structured conflict --------------
  const behind = provision.readDocument('ql-daily-die.html');
  provision.writeDocument('ql-daily-die.html', behind.revision, `${behind.content}\n<!-- external change while the editor held a stale basis -->`);
  await appendAtEnd('x', 'ql-daily-die.html');
  await waitStatus('Unsaved', 'ql-daily-die.html');
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
  await page.locator('.pane.focused .native-file-surface .cm-content[aria-label="Editing ql-daily-die.html"]').click();
  await save();
  await waitStatus('Saved', 'ql-daily-die.html');
  check(true, 'Rebasing the draft on the current revision lets the save land through the owner');

  // --- the document's own Save HTML copy works inside the sandbox ----------
  await toRendered('ql-daily-die.html');
  const exportFrame = frameFor('ql-daily-die.html');
  await exportFrame.locator('#cube').waitFor({ timeout: 30000 });
  const downloadPromise = page.context().waitForEvent('download', { timeout: 20000 });
  await exportFrame.locator('[aria-label="Save HTML copy"]').click();
  const download = await downloadPromise;
  check(/\.html$/i.test(download.suggestedFilename()),
    'The 4+2 document performs its own Save HTML copy — a separate, network-free export that overwrites nothing',
    { filename: download.suggestedFilename() });

  // --- 0/1: Dialogue · Flow · Journal, chosen from the keyboard ----------
  await newBlankTab('strip');
  await page.locator('.pane.focused .fresh-docforms button', { hasText: 'Flow' }).focus();
  await page.keyboard.press('Enter');
  await page.locator('.tab[data-title="ql-dialogue-flow.html"][data-active="true"]').waitFor({ timeout: 20000 });
  const dialogue = frameFor('ql-dialogue-flow.html');
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
  await toSource('ql-dialogue-flow.html');
  await appendAtEnd('\n<div id="walk-roundtrip-marker">saved through the native path</div>', 'ql-dialogue-flow.html');
  await waitStatus('Unsaved', 'ql-dialogue-flow.html');
  await save();
  await waitStatus('Saved', 'ql-dialogue-flow.html');
  const savedFlow = provision.readDocument('ql-dialogue-flow.html');
  check(savedFlow.content.includes('walk-roundtrip-marker'),
    'The 0/1 edit saved through the desktop is what Central now holds');
  await toRendered('ql-dialogue-flow.html');
  // The visible Reload control — the concealed documents keep their own
  // (hidden) material chrome mounted beside the active one.
  await page.locator('.pane.focused .material-surface button[aria-label="Reload preview"]').locator('visible=true').first().click();
  await dialogue.locator('#walk-roundtrip-marker').waitFor({ timeout: 30000 });
  check(true, 'Re-read from the owner, the rendered 0/1 document shows the saved writing');
  await shot('dialogue-01-native-save');

  // --- Epi-Card: the realized form carrier, opened as its real file --------
  // The carrier is byte-derived from the card's own sources (SPEC §3.1/§3.2/
  // §3.5/§20/§21, ui/epi-card.d.ts, the <epi-card> component at
  // codex/epi-card-card-contract 2c53bb81): its document is an EpiCardData
  // v1.0.0 whose twelve positions carry the canonical units verbatim with
  // occupancy honestly unknown, and whose faces/hexagon/drawer/return mirror
  // the component's structure. The assertions below are the spec's content,
  // not "an iframe appeared".
  await newBlankTab('strip');
  await page.locator('.pane.focused .fresh-docforms button', { hasText: 'Epi-Card' }).click();
  await page.locator('.tab[data-title="oi-epi-card.html"][data-active="true"]').waitFor({ timeout: 20000 });
  await page.locator('.pane.focused iframe.material-frame[title="oi-epi-card.html"]').waitFor({ timeout: 20000 });
  const card = frameFor('oi-epi-card.html');
  const cardDoc = JSON.parse(await card.locator('script#epi-card-doc').textContent());
  check(cardDoc.version === '1.0.0' && cardDoc.engagementId === 'oi-epi-card-form-v1'
      && cardDoc.back.pairs.length === 6 && cardDoc.back.pairs.every((p, i) => p.index === i),
    'The Epi-Card document is an EpiCardData v1.0.0 with the six canonical conjugate pairs in order',
    { version: cardDoc.version, pairs: cardDoc.back.pairs.length });
  const units = cardDoc.back.pairs.flatMap(p => [p.bimba.canonicalUnit, p.pratibimba.canonicalUnit]);
  check(JSON.stringify(units) === JSON.stringify(['Truth', 'Play', 'Mind', 'Need', 'Word', 'Sacrifice', 'Logos', 'Decision', 'Son', 'Love', 'Image', 'Work']),
    'The twelve positions carry the canonical units of the QL conjugate frame verbatim (SPEC §3.1)', { units });
  check(cardDoc.back.pairs.every(p => [p.bimba, p.pratibimba].every(pos => pos.occupancy === 'unknown' && Array.isArray(pos.claims) && pos.claims.length === 0)),
    'Every position declares its articulation honestly unknown — no invented content fills the frame (SPEC §3.5)');
  check(cardDoc.back.pairs.every((p, i) => p.bimba.address === `P${i}` && p.pratibimba.address === `P${i}′`),
    'The pairs preserve canonical addressing P0…P5 and P0′…P5′ (prime U+2032)', { sample: `${cardDoc.back.pairs[0].bimba.address}/${cardDoc.back.pairs[5].pratibimba.address}` });

  // The rendered faces mirror the component: film face with the kink
  // affordance, then the six-edge hexagon with the centre phase and the
  // return seam. The card stands on its film face first, so turn it before
  // reading the hexagon.
  await card.locator('.kink').waitFor({ timeout: 15000 });
  const edges = card.locator('.hex .edge');
  check(await edges.count() === 6
      && (await edges.nth(0).textContent()) === 'P0↔P0′' && (await edges.nth(5).textContent()) === 'P5↔P5′',
    'The back renders the six conjugate edge controls with canonical labels (SPEC §20.2)', { edges: await edges.count() });
  await card.locator('.kink').click();
  await card.locator('.back:not([hidden])').waitFor({ timeout: 10000 });
  await edges.first().waitFor({ timeout: 10000 });
  check(await card.locator('.front').isHidden(), 'The kink affordance turns the card to the six conjugate pairs');
  // An edge opens the pair drawer with both canonical positions and the
  // component's own honest occupancy sentence.
  await edges.nth(3).click();
  const drawer = card.locator('.pair-drawer');
  await drawer.waitFor({ timeout: 10000 });
  const drawerText = (await drawer.textContent()) ?? '';
  check(/Logos ↔ Decision/.test(drawerText) && /Who\? Which\? Whereby\?/.test(drawerText)
      && /This position is unknown\. Its absence is retained without an invented substitute\./.test(drawerText),
    'The P3↔P3′ drawer unfolds both canonical positions and the component\u2019s honest occupancy sentence', { drawer: drawerText.slice(0, 160) });
  await shot('epi-card-pair-drawer');
  // The centre phase control cycles Paired → Night first → Day first, and
  // the drawer re-orders with the phase (renderPairDrawer's law).
  const centre = card.locator('.centre-symbol');
  check(((await centre.getAttribute('aria-label')) ?? '') === 'Show Pratibimba first' && /Paired/.test((await centre.textContent()) ?? ''),
    'The centre phase control stands Paired with the component\u2019s orientation label');
  await centre.click();
  check(/Night first/.test((await centre.textContent()) ?? ''), 'The centre cycles the phase to Night first');
  await drawer.locator('.position').first().waitFor({ timeout: 10000 });
  check(/P3′ · pratibimba/.test((await drawer.locator('.position').first().textContent()) ?? ''),
    'Night first reorders the drawer so the pratibimba position leads');
  await centre.click();
  check(/Day first/.test((await centre.textContent()) ?? ''), 'A further cycle reaches Day first');
  // Escape closes the drawer (the component's own host-key law).
  await page.keyboard.press('Escape');
  await card.locator('.pair-drawer').waitFor({ state: 'detached', timeout: 10000 });
  check(true, 'Escape closes the conjugate pair drawer');
  // The return seam exposes the P5′→P0⁺ return from the document.
  await card.locator('.return-seam').click();
  const returnPanel = card.locator('.return-panel');
  await returnPanel.waitFor({ timeout: 10000 });
  const returnText = (await returnPanel.textContent()) ?? '';
  check(/Return · P5′→P0\+/.test(returnText) && /The return is empty/.test(returnText) && /The next ground is this frame's first engagement\./.test(returnText),
    'The return seam exposes the P5′→P0⁺ return with the document\u2019s own self-implication, remainder and next ground');
  await shot('epi-card-return');
  check(await card.locator('.film-return').isVisible() && (await card.locator('.traverse').textContent()).includes('P0⁺'),
    'The film return and the canonical traversal line close the conjugate face');

  // --- unavailable: a missing form names its exact open location ----------
  rmSync(join(provision.documentsDir, 'ql-daily-die.html'));
  await newBlankTab('strip');
  await page.locator('.pane.focused .fresh-docforms button', { hasText: '4+2' }).click();
  const alert = page.locator('.pane.focused .fresh-surface:not(.rest-ground) p[role="alert"]');
  await alert.waitFor({ timeout: 20000 });
  const message = await alert.textContent();
  check(message.includes('desktop/cradle/documents') && message.includes('ql-daily-die.html') && /Day document form/.test(message),
    'A missing form reports the precise unavailable state with its exact open location — no fabricated payload',
    { message });
  await shot('die-42-unavailable');

  check(errors.length === 0, 'No renderer page errors during document entry', { errors });
}
