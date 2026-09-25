import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const DOCUMENTS = resolve(here, '..', '..', 'documents');

/** The shared experiential Document Surface, walked for real (Wayfinder
 *  agent-praxis-document-world §21 first vertical, local lane; W6/W7).
 *
 *  A. A Project Vision is CREATED IN PLACE through the owner's authored
 *     door (projectcentral.source.create), opened as an experiential page,
 *     edited DIRECTLY in its rendered body, saved through the owner's
 *     source CAS from the page's own payload, reopened and recovered.
 *  B. A stale basis refuses to save (the structured refusal; nothing
 *     overwritten, the owner's newer revision stands).
 *  E. A UI Mockup is created the same way, its live states operate, and a
 *     selection inside a state carries the state's semantic identity.
 *  F/G. The negative half of Return: a page can push nothing into its
 *     source by talking — the bridge answers reads only.
 *  H. A restart-restore keeps the open documents and their saved content.
 *
 *  The scratch ground carries the ACTUAL documents directory (including the
 *  vision and mockup templates), and the ctrl named by OI_CENTRAL_CTRL_BIN
 *  must carry projectcentral.source.create — the door this walk proves. */
export async function setup() {
  const root = mkdtempSync(join(tmpdir(), 'oi-cradle-docsurface-'));
  const ctrl = process.env.OI_CENTRAL_CTRL_BIN ?? 'ctrl';
  const call = (action, input = {}) => {
    const r = JSON.parse(execFileSync(ctrl, ['--root', root, '--json', 'action', 'run', action, JSON.stringify(input)], { encoding: 'utf8' }));
    if (!r.ok) throw new Error(JSON.stringify(r));
    return r.data;
  };
  const locations = new Map();
  const locationOf = (relative) => {
    if (locations.has(relative)) return locations.get(relative);
    const grounded = `Work/O-I/${relative}`;
    const parent = grounded.split('/').slice(0, -1).join('/');
    const name = grounded.split('/').pop();
    const dir = call('central.files.list', { path: parent });
    const entry = dir.entries.find((e) => e.kind === 'file' && e.name === name);
    if (!entry) throw new Error(`${grounded} is not listed under its owner directory`);
    locations.set(relative, entry.location);
    return entry.location;
  };
  // Only owned ground participates in the horizon — the vision page once it
  // exists (aperture), not the ordinary document templates.
  const horizon = () => call('projectcentral.change.horizon', { project: 'O-I' });
  const horizonSource = (pathSuffix) => {
    const found = horizon().sources.find((s) => typeof s.binding?.path === 'string' && s.binding.path.endsWith(pathSuffix));
    if (!found) throw new Error(`no horizon source for ${pathSuffix}`);
    return { ref: found.binding.ref, revision: found.revision.revision, path: found.binding.path };
  };
  // The horizon's change records are the creation's and every write's
  // attribution of record (the CLI history Action needs a connector
  // provider; the horizon is the owner state itself).
  const horizonChanges = (sourceRef) => horizon().changes.filter((c) => c.source_ref === sourceRef);
  try {
    call('central.init');
    // The O-I project's native ProjectCentral: the vision/mockup human
    // ground and the source horizon are its own.
    mkdirSync(join(root, 'Work', 'O-I'), { recursive: true });
    call('projectcentral.init', { project: 'O-I', project_id: 'o-i' });
    const documentsDir = join(root, 'Work', 'O-I', 'desktop', 'cradle', 'documents');
    cpSync(DOCUMENTS, documentsDir, { recursive: true });
    return {
      root,
      documentsDir,
      readDocument: (relative) => call('central.files.read', { location: locationOf(relative) }),
      writeAsOwner: (sourceRef, expectedRevision, content) => call('projectcentral.source.write', {
        project: 'O-I', source_ref: sourceRef, expected_revision: expectedRevision,
        content, actor: 'walk-owner', actor_kind: 'human',
      }),
      horizonSource,
      horizonChanges,
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

  const newBlankTab = async () => {
    await page.keyboard.press('Meta+t');
    await page.locator('.pane.focused .fresh-surface:not(.rest-ground)').waitFor({ timeout: 15000 });
    const disclosure = page.locator('.pane.focused .fresh-more');
    if (!(await disclosure.evaluate((el) => el.open))) await disclosure.locator('summary').click();
    const projectSelect = page.locator('.pane.focused select[aria-label="New tab project"]');
    await projectSelect.locator('option[value="O-I"]').waitFor({ state: 'attached', timeout: 20000 });
    await projectSelect.selectOption('O-I');
  };
  // The material footer hides behind the pane footer dot until pinned; pin,
  // read, release — the same grammar document-entry walks.
  const withMaterialFooter = async (title, act) => {
    const dot = page.locator('.pane.focused [data-pane-footer-dot]');
    const pinned = (await dot.getAttribute('aria-pressed')) === 'true';
    if (!pinned) await dot.click();
    try {
      return await act(page.locator(`.pane.focused [aria-label="Material ${title}"] footer`));
    } finally {
      if ((await dot.getAttribute('aria-pressed')) === 'true' && !pinned) await dot.click();
    }
  };
  const frameFor = (title) => page.frameLocator(`.pane.focused iframe.material-frame[title="${title}"]`);

  // A created project page is a bound source: it opens as a source surface
  // whose rendered view IS the document host (the Day die's law, generalized).
  const hostBar = () => page.locator('.pane.focused [data-document-host]');
  const hostFrame = (title) => page.frameLocator(`.pane.focused iframe.document-frame[title="${title}"]`);

  // --- A. Vision: created in place through the owner's door ----------------
  await newBlankTab();
  await page.locator('.pane.focused .fresh-docforms button', { hasText: 'Vision' }).click();
  await page.locator('.tab[data-title="oi.html"][data-active="true"]').waitFor({ timeout: 20000 });
  await hostBar().waitFor({ timeout: 30000 });
  check((await provision.readDocument('ProjectCentral/user/oi.html')).content.includes('oi.page/v1'),
    'Choosing Vision creates the project vision page in its human ground through the owner door (an oi.page/v1 document at ProjectCentral/user/oi.html)');
  check(await hostBar().getAttribute('data-document-family') === 'Vision',
    'The document host names the family from the payload itself, not the filename');
  await shot('vision-created');

  // Direct manipulation: the person edits the vision in its own body.
  const vision = hostFrame('oi.html');
  const islandNow = () => vision.locator('body').evaluate(() => {
    const read = window.__OI_DOCUMENT_HOST__?.read?.();
    const doc = read?.valid ? JSON.parse(read.text) : null;
    return { revision: doc?.meta?.revision ?? null, introduction: doc?.page?.introduction ?? null };
  });
  const ensureEditing = async () => {
    for (let attempt = 0; attempt < 4; attempt++) {
      const pressed = await vision.locator('#edit-page').getAttribute('aria-pressed').catch(() => null);
      if (pressed === 'true') {
        const editable = await vision.locator('[data-field="introduction"]').getAttribute('contenteditable');
        if (editable === 'plaintext-only') return;
      }
      await vision.locator('#edit-page').click().catch(() => {});
      await vision.locator('#edit-page[aria-pressed="true"]').waitFor({ timeout: 5000 }).catch(() => {});
    }
    throw new Error('the vision page never entered edit mode');
  };
  const determination = 'The document is the product: authored, encounterable, native.';
  await ensureEditing();
  await vision.locator('[data-field="introduction"]').click();
  await vision.locator('[data-field="introduction"]').fill(determination);
  await page.locator('.pane.focused [data-document-state="Unsaved on the page"]').waitFor({ timeout: 10000 });
  const islandAfterEdit = await islandNow();
  check(islandAfterEdit.revision === 1 && (islandAfterEdit.introduction ?? '').includes('authored, encounterable'),
    'Editing in the rendered body turns the host state to "Unsaved on the page" and the page island itself carries the determination',
    islandAfterEdit);
  await shot('vision-edited-on-page');

  // Save: the page island crosses the host bridge into the buffer and the
  // kernel's source CAS; the source history records the declared-human write.
  const islandAtSave = await islandNow();
  await page.locator('.pane.focused [data-document-save]').click();
  await page.locator('.pane.focused [data-document-state="Saved"]').waitFor({ timeout: 30000 });
  const visionSource = provision.horizonSource('ProjectCentral/user/oi.html');
  const changes = provision.horizonChanges(visionSource.ref);
  const desktopWrite = changes.find((c) => c.actor === 'human:desktop');
  const savedIsland = JSON.parse(provision.readDocument('ProjectCentral/user/oi.html').content.match(/<script type="application\/json" id="ql-doc">([\s\S]*?)<\/script>/)[1]);
  check(savedIsland.page?.introduction === determination && !!desktopWrite && desktopWrite.actor_kind === 'human',
    'The direct edit saves through the source CAS; the horizon’s change record carries the desktop’s declared-human attribution (the kernel’s human:desktop identity)',
    { actors: changes.map((c) => `${c.actor}/${c.actor_kind}/${c.kind}`), islandAtSave, savedIntroduction: savedIsland.page?.introduction ?? null });
  await shot('vision-saved');
  await shot('vision-after-save');
  const islandAfterSave = await islandNow();
  check((islandAfterSave.introduction ?? '').includes('authored, encounterable'),
    'After the save the rendered page still shows the authored determination',
    islandAfterSave);

  // --- B. Stale basis: the structured conflict, nothing overwritten ---------
  const owner = provision.horizonSource('ProjectCentral/user/oi.html');
  const savedContent = provision.readDocument('ProjectCentral/user/oi.html').content;
  const external = provision.writeAsOwner(owner.ref, owner.revision, `${savedContent}\n<!-- owner-external touch -->\n`);
  const externalRevision = external.receipt?.revision?.revision;
  await ensureEditing();
  await vision.locator('[data-field="introduction"]').fill(`${determination} Second thought.`);
  await page.locator('.pane.focused [data-document-state="Unsaved on the page"]').waitFor({ timeout: 10000 });
  await page.locator('.pane.focused [data-document-save]').click();
  await page.locator('.pane.focused [data-document-state*="resolve it in Source view"]').waitFor({ timeout: 30000 });
  const afterRefusal = provision.readDocument('ProjectCentral/user/oi.html');
  check(afterRefusal.content.includes('owner-external touch') && afterRefusal.revision === externalRevision,
    'A stale basis refuses the save and the owner’s newer revision stands untouched; the conflict is the structured one');
  await shot('vision-stale-conflict');

  // Rebase through the existing conflict grammar, back to the document.
  await page.locator('.pane.focused [aria-label="Document view"] [role="tab"]', { hasText: 'Source' }).click();
  await page.locator('.pane.focused .source-conflict [data-action="source.reread"]').click();
  await page.locator('.pane.focused [aria-label="Document view"] [role="tab"]', { hasText: 'Rendered' }).click();
  await page.locator('.pane.focused [data-document-state]').waitFor({ timeout: 15000 });
  await page.locator('.pane.focused [data-document-state="Source changes pending save"]').waitFor({ timeout: 20000 });
  // The rebase kept the person's edit on the new basis (the conflict
  // grammar's law); saving lands it.
  await page.locator('.pane.focused [data-document-save]').click();
  await page.locator('.pane.focused [data-document-state="Saved"]').waitFor({ timeout: 30000 });
  const rebasedContent = provision.readDocument('ProjectCentral/user/oi.html').content;
  check(rebasedContent.includes('Second thought'),
    'After the rebase the kept edit saves onto the new basis — the person’s explicit save is what changes the source',
    { hasSecondThought: rebasedContent.includes('Second thought') });

  // --- E. UI Mockup: created, alive, semantically addressable --------------
  await newBlankTab();
  await page.locator('.pane.focused .fresh-docforms button', { hasText: 'Mockup' }).click();
  await page.locator('.tab[data-active="true"][data-title*="mockup-"]').waitFor({ timeout: 20000 });
  const mockupTitle = await page.locator('.tab[data-active="true"][data-title*="mockup-"]').getAttribute('data-title');
  await page.locator(`.pane.focused iframe.document-frame[title="${mockupTitle}"]`).waitFor({ timeout: 30000 });
  check((await provision.readDocument(`ProjectCentral/user/${mockupTitle}`)).content.includes('mockup-provenance'),
    'Choosing Mockup creates a dated project mockup in the human ground from the retained template', { file: mockupTitle });
  const mockup = hostFrame(mockupTitle);
  await mockup.locator('#state-loading').waitFor({ state: 'attached', timeout: 30000 });
  await mockup.locator('.switcher button[data-state="loading"]').click();
  await mockup.locator('#state-loading.active').waitFor({ timeout: 10000 });
  check(await mockup.locator('#state-loading.active').count() === 1
    && (await mockup.locator('#t-state').textContent()) === 'loading',
    'The mockup’s own state switcher operates: the loading state is the live one and the trace names it');
  const relationsText = await hostBar().locator('.document-host-relations').textContent({ timeout: 8000 }).catch(error => `absent: ${String(error).slice(0, 80)}`);
  check(typeof relationsText === 'string' && relationsText.includes('vision.html#unit-id'),
    'The mockup’s provenance (its vision/design/capability trace) is visible in the host bar',
    { relationsText });
  await shot('mockup-loading-state');
  // Select the loading heading; the page bridge reports the observation with
  // the state's actual locator as its semantic unit.
  const unit = await mockup.locator('body').evaluate(() => {
    const heading = document.querySelector('#state-loading h2');
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.selectAllChildren(heading);
    const observed = window.__OI_PAGE_CONTEXT__?.selection();
    selection.removeAllRanges();
    return observed ? { nodeRef: observed.nodeRef ?? null, role: observed.role, text: observed.text.slice(0, 40) } : { none: true };
  });
  check(unit && unit.nodeRef === 'state-loading',
    'A selection inside a mockup state carries the state’s semantic identity (the actual locator), not a bare text blob',
    unit);
  await shot('mockup-semantic-selection');

  // --- F/G. The page can push nothing: the bridge answers reads only -------
  const beforeForge = provision.readDocument(`ProjectCentral/user/${mockupTitle}`).revision;
  await mockup.locator('body').evaluate(() => {
    parent.postMessage({ type: 'oi:document-host-response', request: 'forged', result: { present: true, payload: 'ql-doc', text: '{"meta":{"revision":999}}', revision: 999, valid: true } }, '*');
    parent.postMessage({ type: 'oi:context-candidate', detail: { bindingId: 'x', kind: 'text', text: 'injected' } }, '*');
  });
  await page.waitForTimeout(500);
  check(provision.readDocument(`ProjectCentral/user/${mockupTitle}`).revision === beforeForge,
    'Forged page messages move nothing: the revision is unchanged and only the host’s own controls can save');

  // --- H. Continuity: a restart keeps the opened documents and content -----
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('.tab[data-title="oi.html"]').waitFor({ timeout: 30000 });
  await page.locator('.tab[data-title*="mockup-"]').waitFor({ timeout: 30000 });
  await page.locator('iframe.document-frame[title="oi.html"]').waitFor({ state: 'attached', timeout: 30000 });
  const restoredState = await page.frameLocator('iframe.document-frame[title="oi.html"]').locator('body').evaluate(() => {
    const read = window.__OI_DOCUMENT_HOST__?.read?.();
    const doc = read?.valid ? JSON.parse(read.text) : null;
    return { revision: doc?.meta?.revision ?? null, introduction: (doc?.page?.introduction ?? '').slice(0, 60), bar: document.querySelector('[data-document-state]')?.getAttribute('data-document-state') ?? null };
  }).catch(error => ({ error: String(error).slice(0, 120) }));
  check((restoredState.introduction ?? '').includes('authored, encounterable'),
    'After a reload the workspace restores the open Vision and Mockup, and the saved determination is still on the page',
    restoredState);
  await shot('continuity-restored');

  // The retained mockup template's own hash routing calls
  // history.replaceState, which throws inside the opaque-origin srcdoc
  // transport (no URL to rewrite). Under the installed oi-material://
  // transport the frame carries a URL and the call is legal. State
  // switching itself operated (checks above), so this named degradation is
  // recorded, not silently swallowed.
  const knownTemplateDegradation = (message) => message.includes("replaceState") && message.includes("origin 'null'");
  const unexpected = errors.filter((message) => !knownTemplateDegradation(message));
  const named = errors.filter(knownTemplateDegradation);
  check(unexpected.length === 0, 'No unexpected page errors during the document-surface walk', unexpected);
  check(named.length > 0,
    'The mockup template’s hash routing degrades, named: its replaceState is illegal in the opaque-origin srcdoc transport (a feedback item for the template’s owner); state switching still operates',
    { count: named.length });
}
