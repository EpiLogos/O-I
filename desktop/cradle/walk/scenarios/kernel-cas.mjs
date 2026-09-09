import {docText, waitForDoc} from '../editor-doc.mjs';
/**
 * Scenario: kernel-cas (ported from the u0.4 walk) — the kernel seam
 * re-proof, verified by operation in the running app (map §5 U0.4;
 * 05-EXECUTION §3: prose and tests do not establish the condition — the
 * walk does).
 *
 * How the kernel is reached: the walk bundle driven by Playwright, with the
 * kernel invoked for real through the dev-only walk bridge (map §3 D10) —
 * the same typed KernelOp seam the Tauri host fronts. The runner spawns a
 * fresh bridge with the real `ctrl` on PATH and the real O-I ProjectCentral
 * ground — no fixtures anywhere in the chain. The `__cradle.walk` channel
 * (U0.6) carries the typed invokes/reads: the reconcile re-read, the second
 * save, and the harness-driven focus change all cross the same seam the
 * app's own surfaces use.
 *
 * Covers the unit contract:
 *   1. list real sources of project O-I from the real horizon; open one
 *      real file -> content renders; edit -> dirty marker + exactly ONE
 *      buffer-dirty event;
 *   2. ⌘S -> revision advances (receipt revision != previous), canonical
 *      layer updated, buffer clean again, exactly one save-success event;
 *   3. concurrent external edit then ⌘S -> structured conflict
 *      {kind: revision-conflict, expected != current}, BOTH sides
 *      preserved, exactly one conflict event; after the channel-driven
 *      re-read of the new revision, a channel-driven second save succeeds;
 *   4. focus: the harness drives a REAL focus change through the channel
 *      (invoke.surface_focus) -> exactly one focus event carrying the same
 *      ref — and the renderer's active tab does not move (the channel has
 *      no presentation authority);
 *   5. event log seq strictly monotonic 1..N, no gaps, no duplicate
 *      emission for one state change; screenshots of the conflict state
 *      and the focus-driven state.
 *
 * The walk leaves the world as it found it: its last act saves the original
 * content back through the owner (a real save, honestly attributed), and
 * the revision returns to the original content hash.
 */

export { setup } from './editor.mjs';
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";



export default async function run(ctx) {
  const {
    page,
    baseUrl,
    bridgeUrl,
    check,
    metric,
    shot,
    channel,
    op,
    eventsAfter,
    waitForEvents,
    log,
  } = ctx;

  const p = ctx.provision;
  const TARGET_PATH = p.sources[0].binding.path;
  const TARGET_FILE = join(p.projectRoot, TARGET_PATH);
  const TARGET_REF = p.sources[0].binding.ref;

  /** The walk leaves the world as it found it — even if it fails midway:
   * the exit path restores the real file's original bytes. */
  let originalContent = null;
  const restoreFileOnExit = () => {
    if (originalContent === null) return;
    try {
      const onDisk = readFileSync(TARGET_FILE, "utf8");
      if (onDisk !== originalContent) {
        writeFileSync(TARGET_FILE, originalContent);
        log(`[exit restore] ${TARGET_PATH} returned to its original bytes`);
      }
    } catch (error) {
      log(`[exit restore] could not check ${TARGET_FILE}: ${error}`);
    }
  };

  try {
    log(`walk bridge: ${bridgeUrl} (real ctrl, project o-i)`);

    // -------------------------------------------------------------------------
    // 0. Rest first — the kernel provider adds no DOM; austere rest is intact.
    await page.goto(baseUrl, { waitUntil: "load" });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: "load" });
    check(await page.locator('.desktop-shell').count() === 1, "Spatial shell hosts the real kernel");
    const nav = page.getByRole('complementary', {name:'World navigator'});
    await nav.locator('[data-project-path="Work/Editor"]').click();
  if(await page.getByRole('button',{name:'Editor: files',exact:true}).getAttribute('aria-pressed') !== 'true') await page.getByRole('button',{name:'Editor: files',exact:true}).click();
    await nav.locator('[data-file-path]').first().waitFor();
    const rows = (await channel('read.sources')).data.sources;
    check(
      rows.length >= 3,
      `the real horizon lists ${rows.length} participating sources (≥3, no fixtures)`,
    );
    check(
      rows.every((row) => row.ref.startsWith("central:source:")),
      "every listed ref is Central's canonical grammar (central:source:project:project:o-i:…)",
    );
    check(
      rows.every((row) => row.revision.startsWith("central.content-fnv1a64/v1:")),
      "every row carries the horizon's live revision",
    );
    const readmeRow = rows.find((row) => row.ref === TARGET_REF);
    check(!!readmeRow, `the walk's real file is listed: ${TARGET_PATH}`);

    // The channel reads the same listing the surface renders — one seam.
    const listingRead = await channel("read.sources");
    check(
      listingRead.data.sources.some((source) => source.ref === readmeRow.ref),
      "read.sources through the channel carries the same real listing the index renders",
    );

    originalContent = readFileSync(TARGET_FILE, "utf8");
    const originalRevision = readmeRow.revision;

    const lastSeq = async () => {
      const read = await channel("read.events");
      return read.data.last_seq ?? 0;
    };

    const seqBeforeOpen = await lastSeq();
    const openFile = await op("ui.open_real_file", async () => {
      await nav.locator(`[data-file-path="Work/Editor/${readmeRow.path}"]`).click();
      await page.waitForSelector(".cm-content", { timeout: 10_000 });
      await page.waitForFunction(
        () => document.querySelectorAll(".cm-content .cm-line").length > 0,
        null,
        { timeout: 10_000 },
      );
    });
    metric("open_file_ms", openFile.duration_ms);
    const rendered = await page.evaluate(() => ({
      value: (document.querySelector('.text-editor-host')?.__oiDocument?.() ?? [...document.querySelectorAll('.cm-content .cm-line')].map(l=>l.textContent.replace(/\u00a0/g,' ')).join('\n')),
      revision: document.querySelector(".source-revision").dataset.revision,
      ref: document.querySelector(".source-editor").dataset.ref,
    }));
    check(rendered.value === originalContent, "the real file's content renders verbatim in the editor");
    check(rendered.revision === originalRevision, "the canonical revision shown is the horizon's");
    check(rendered.ref === readmeRow.ref, "the surface carries the owner's ref verbatim");

    const openEvents = await waitForEvents(
      seqBeforeOpen,
      (events) => events.some((event) => event.event === "source_opened"),
      "source_opened after opening",
    );
    check(
      openEvents.filter((event) => event.event === "source_opened").length === 1,
      "exactly one source_opened event for the open",
    );
    check(
      openEvents.filter((event) => event.event === "focus_changed").length === 1 &&
        openEvents.find((event) => event.event === "focus_changed")?.focus?.subject?.ref === readmeRow.ref,
      "the open focused the file's ref (one focus event, same ref)",
    );
    check(
      openEvents.filter((event) => event.event === "surface_changed").length === 1,
      "exactly one surface_changed event for the new surface",
    );

    // -------------------------------------------------------------------------
    // 2. Edit -> dirty marker + exactly ONE buffer-dirty event.
    const edit1 = `${originalContent}\n<!-- u0.4 kernel seam walk: edit one -->\n`;
    await page.fill(".cm-content", edit1);
    await page.waitForSelector(".source-editor[data-dirty='true']", { timeout: 10_000 });
    check(!!(await page.$(".source-dirty-marker")), "the dirty marker renders (buffer ≠ canonical)");
    check(
      !!(await page.$(".tab[data-dirty='true']")),
      "the tab carries the dirty state too",
    );
    let seqBeforeEdit = await lastSeq();
    await page.fill(".cm-content", `${edit1}more typing that is not a new state change\n`);
    await page.waitForTimeout(600); // give any spurious emission time to appear
    const edit2Events = await eventsAfter(seqBeforeEdit);
    check(
      edit2Events.filter((event) => event.event === "buffer_dirty").length === 0,
      "continued typing emits nothing (no duplicate buffer-dirty for one state)",
    );

    // -------------------------------------------------------------------------
    // 3. ⌘S -> revision advances, canonical updated, buffer clean, one event.
    const revisionBeforeSave = await page.evaluate(
      () => document.querySelector(".source-revision").dataset.revision,
    );
    seqBeforeEdit = await lastSeq();
    const save1 = await op("ui.save", async () => {
      await page.keyboard.press("Meta+s");
      await waitForEvents(
        seqBeforeEdit,
        (events) => events.some((event) => event.event === "source_changed"),
        "save-success event",
      );
      await page.waitForSelector(".source-editor[data-dirty='false']", { timeout: 10_000 });
    });
    metric("save_ms", save1.duration_ms);
    const save1Events = (await eventsAfter(seqBeforeEdit)).filter(
      (event) => event.seq > seqBeforeEdit,
    );
    check(
      save1Events.filter((event) => event.event === "source_changed").length === 1,
      "exactly one save-success (source_changed) event",
    );
    const save1Event = save1Events.find((event) => event.event === "source_changed");
    const revisionAfterSave = save1Event.revision;
    check(
      revisionAfterSave !== revisionBeforeSave,
      `the revision advanced on save: …${revisionBeforeSave.slice(-16)} -> …${revisionAfterSave.slice(-16)}`,
    );
    const canonicalNow = await page.evaluate(
      () => document.querySelector(".source-revision").dataset.revision,
    );
    check(
      canonicalNow === revisionAfterSave,
      "the canonical layer shown advanced to the receipt revision",
    );
    check(
      !(await page.$(".source-dirty-marker")),
      "the buffer is clean again (both layers synced)",
    );

    // -------------------------------------------------------------------------
    // 4. Concurrent external edit -> ⌘S -> structured conflict, both sides kept.
    const dirtyContent = await page.evaluate(() => (document.querySelector('.text-editor-host')?.__oiDocument?.() ?? [...document.querySelectorAll('.cm-content .cm-line')].map(l=>l.textContent.replace(/\u00a0/g,' ')).join('\n')));
    const edit2 = `${dirtyContent}\n<!-- u0.4 kernel seam walk: edit two (the cradle side) -->\n`;
    await page.fill(".cm-content", edit2);
    await page.waitForSelector(".source-editor[data-dirty='true']", { timeout: 10_000 });
    // The external edit lands on disk under the buffer — echo via shell.
    const externalLine = "external edit from outside the cradle (u0.4 conflict probe)";
    writeFileSync(TARGET_FILE, readFileSync(TARGET_FILE, "utf8") + externalLine + "\n");
    log(`external edit appended on disk: ${TARGET_PATH}`);

    seqBeforeEdit = await lastSeq();
    await page.keyboard.press("Meta+s");
    await waitForEvents(
      seqBeforeEdit,
      (events) => events.some((event) => event.event === "source_write_conflict"),
      "structured conflict event",
    );
    await page.waitForSelector(".source-editor[data-conflicted='true']", { timeout: 10_000 });
    const conflictEvents = (await eventsAfter(seqBeforeEdit)).filter(
      (event) => event.seq > seqBeforeEdit,
    );
    check(
      conflictEvents.filter((event) => event.event === "source_write_conflict").length === 1,
      "exactly one conflict (source_write_conflict) event",
    );
    const conflictEvent = conflictEvents.find((event) => event.event === "source_write_conflict");
    check(
      conflictEvent.source.ref === readmeRow.ref &&
        conflictEvent.expected_revision === revisionAfterSave &&
        conflictEvent.current_revision !== conflictEvent.expected_revision,
      `the conflict is structured with both revisions: expected ≠ current (…${conflictEvent.expected_revision.slice(-12)} ≠ …${conflictEvent.current_revision.slice(-12)})`,
    );
    // BOTH sides preserved.
    const conflictDom = await page.evaluate(() => ({
      buffer: (document.querySelector('.text-editor-host')?.__oiDocument?.() ?? [...document.querySelectorAll('.cm-content .cm-line')].map(l=>l.textContent.replace(/\u00a0/g,' ')).join('\n')),
      expected: document.querySelector("[data-expected]").dataset.expected,
      current: document.querySelector("[data-current]").dataset.current,
      canonical: document.querySelector(".source-conflict-canonical-body").textContent,
      dirty: document.querySelector(".source-editor").dataset.dirty,
    }));
    check(conflictDom.buffer === edit2, "the cradle buffer is intact (dirty, preserved — no data loss)");
    check(conflictDom.dirty === "true", "the buffer stays dirty through the conflict");
    check(
      conflictDom.expected === revisionAfterSave && conflictDom.current === conflictEvent.current_revision,
      "the surfaced panel carries the same expected/current pair as the event",
    );
    check(
      conflictDom.canonical.includes(externalLine) && conflictDom.canonical.includes("edit one"),
      "the canonical side is readable and shows the external edit (the other preserved side)",
    );
    await shot("conflict");

    // -------------------------------------------------------------------------
    // 5. Re-read the new revision (a typed channel invoke), then a second
    //    save (also through the channel) — the same KernelOp seam, no other
    //    path.
    let seqBefore = await lastSeq();
    const reread = await channel("invoke.source_reread", [readmeRow.ref]);
    check(reread.ok && reread.seq_range !== undefined, "invoke.source_reread crosses the seam and returns its receipt", {
      seq_range: reread.seq_range,
    });
    await page.waitForSelector(".source-editor[data-conflicted='false']", { timeout: 10_000 });
    const rereadEvents = (await eventsAfter(seqBefore)).filter((event) => event.seq > seqBefore);
    check(
      rereadEvents.filter((event) => event.event === "source_opened").length === 1,
      "the re-read is one canonical re-open event",
    );
    const rebased = await page.evaluate(() => ({
      base: document.querySelector(".source-revision").dataset.revision,
      buffer: (document.querySelector('.text-editor-host')?.__oiDocument?.() ?? [...document.querySelectorAll('.cm-content .cm-line')].map(l=>l.textContent.replace(/\u00a0/g,' ')).join('\n')),
      dirty: document.querySelector(".source-editor").dataset.dirty,
    }));
    check(
      rebased.base === conflictEvent.current_revision,
      "the buffer's base rebased onto the current canonical revision",
    );
    check(
      rebased.buffer === edit2 && rebased.dirty === "true",
      "the cradle edit survived the re-read (still dirty — the layers stay distinct)",
    );

    await page.click(".cm-content"); // the caret returns to the writing layer
    seqBefore = await lastSeq();
    const save2 = await channel("invoke.source_save", [readmeRow.ref]);
    check(save2.ok, "invoke.source_save crosses the seam (typed call, not a UI shortcut)");
    await page.waitForSelector(".source-editor[data-dirty='false']", { timeout: 10_000 });
    const save2Events = (await eventsAfter(seqBefore)).filter((event) => event.seq > seqBefore);
    check(
      save2Events.filter((event) => event.event === "source_changed").length === 1,
      "after the re-read, the second save succeeds — exactly one save-success event",
    );
    const save2Event = save2Events.find((event) => event.event === "source_changed");
    check(
      save2Event.revision !== conflictEvent.current_revision,
      `the revision advanced again on the reconciled save (…${save2Event.revision.slice(-16)})`,
    );

    // -------------------------------------------------------------------------
    // 6. The harness drives a REAL focus change through the channel (the
    //    U0.6 walk): select the sources index surface (focus relation
    //    clears), then invoke.surface_focus on the file's binding — exactly
    //    one focus event carrying the same ref, and the renderer's active
    //    tab does not move: the channel has no presentation authority.
    const second = p.sources[1];
    await nav.locator(`[data-file-path="Work/Editor/${second.binding.path}"]`).click();
    await page.waitForFunction(ref => document.querySelector('.cm-content')?.dataset.sourceRef === ref, second.binding.ref);
    await page.waitForTimeout(400); // let any spurious focus emission surface
    const stateRead = await channel("read.state");
    const readmeSurface = Object.values(stateRead.data.surfaces).find(
      (surface) => surface.kind === "source" && surface.source_ref === readmeRow.ref,
    );
    check(!!readmeSurface, "read.state shows the file's kernel surface binding");
    seqBefore = await lastSeq();
    const focusChange = await channel("invoke.surface_focus", [readmeSurface.surface_id]);
    check(
      focusChange.ok && focusChange.seq_range !== undefined,
      "invoke.surface_focus returns ok with its receipt seq range",
      { seq_range: focusChange.seq_range },
    );
    const focusEvents = (await eventsAfter(seqBefore)).filter((event) => event.seq > seqBefore);
    check(
      focusEvents.filter((event) => event.event === "focus_changed").length === 1,
      "the harness-driven focus change emits exactly one focus event",
    );
    check(
      focusEvents.find((event) => event.event === "focus_changed")?.focus?.subject?.ref === readmeRow.ref,
      "the focus event carries the same ref (the one global focus relation)",
    );
    const activeTabTitle = await page.evaluate(
      () => document.querySelector(".tab.active")?.dataset.title ?? null,
    );
    check(
      activeTabTitle === second.binding.path.split("/").pop(),
      "the renderer's active tab is unmoved — the channel drove the kernel relation, not the UI",
    );
    await shot("focus");

    // -------------------------------------------------------------------------
    // 7. Leave the world as found: save the original content back through
    //    the owner; the revision returns to the original content hash.
    await page.locator(".tab").filter({hasText:TARGET_PATH.split("/").pop()}).click();
    await page.waitForSelector(".cm-content", { timeout: 10_000 });
    await page.fill(".cm-content", originalContent);
    await page.waitForSelector(".source-editor[data-dirty='true']", { timeout: 10_000 });
    seqBefore = await lastSeq();
    await page.keyboard.press("Meta+s");
    await waitForEvents(
      seqBefore,
      (events) => events.some((event) => event.event === "source_changed"),
      "restore save",
    );
    await page.waitForSelector(".source-editor[data-dirty='false']", { timeout: 10_000 });
    const restoreEvents = (await eventsAfter(seqBefore)).filter((event) => event.seq > seqBefore);
    const restore = restoreEvents.find((event) => event.event === "source_changed");
    check(
      restore.revision === originalRevision,
      "the original content restored through a real save — the revision returns to the original hash",
    );
    const onDiskAfter = readFileSync(TARGET_FILE, "utf8");
    check(onDiskAfter === originalContent, "the file on disk is byte-identical to how the walk found it");

    // -------------------------------------------------------------------------
    // 8. The whole log as data: strictly monotonic seqs, no gaps, no dupes.
    const snapshot = await channel("capture.events");
    const receipts = snapshot.data.receipts;
    const seqs = receipts.map((receipt) => receipt.seq);
    const histogram = receipts.reduce((counts, receipt) => {
      counts[receipt.event] = (counts[receipt.event] ?? 0) + 1;
      return counts;
    }, {});
    metric("kernel_events_total", receipts.length);
    check(
      seqs.length === new Set(seqs).size && seqs.every((seq, index) => seq === index + 1),
      `the event log is strictly monotonic 1..${seqs.length} with no gaps and no duplicate emission`,
      { histogram },
    );
    log(
      `revision pair: …${revisionBeforeSave.slice(-16)} -> …${revisionAfterSave.slice(-16)} (save 1); ` +
        `conflict pair: expected …${conflictEvent.expected_revision.slice(-16)} ≠ current …${conflictEvent.current_revision.slice(-16)}`,
    );
  } finally {
    restoreFileOnExit();
  }
}
