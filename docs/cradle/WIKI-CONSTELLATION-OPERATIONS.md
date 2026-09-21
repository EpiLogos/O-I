# Working with linked writing and constellations

This guide describes the Wiki implementation in O-I #418 and its native dependencies. It is not an installed-suite acceptance receipt. Product reasons and decisions remain in [Wiki constellation practice](../positions/WIKI-CONSTELLATION-PRACTICE.md); requirements remain in the [joined Wayfinder](../../.wayfinder/maps/wiki-constellation-development.md), [specification](WIKI-CONSTELLATION-SPEC.md) and [UX](../experience/WIKI-CONSTELLATION-UX.md).

## Begin with existing writing

Open an ordinary source through the Wiki. Markdown links, wikilinks, headings, backlinks, source tags and previews use AIKit's native document reading. No QL classification is necessary. The original document remains the source: selecting it, following a link or making a constellation does not rewrite its prose.

The small-node graph can display the available field or a selected subject's neighbourhood. Depth and direction change traversal. Kind, tag, relation and relationship-layer controls change the displayed reading. With structural context retained, a matching constellation member keeps its disclosed surrounding formation; matches-only views remain explicitly partial. Neither operation changes membership. Saved filter views are presentation preferences, not authored constellations.

A directly opened Wiki establishes Central's root mapping before asking for a child Project's register. This is a navigation prerequisite, not a requirement for a person to visit a separate dashboard first. Central remains the root meta-project. A child absent from the native root disclosure is refused rather than guessed from a path or silently replaced by another Project.

## Make a constellation from material, or choose its frame first

Select a passage in the reader and choose **Add to constellation**. The drawer holds its source identity, exact source revision, native UTF-8 span and rendered quotation. Two different passages in one source are separate contextual participations; the underlying document is still one source. **Add to Context** is a separate operation. Constructive selection does not automatically disclose the passage to an agent.

Name the inquiry, write its question and choose an available Wiki space. Keep **Open arrangement** for ordinary constructive work, or choose an authoring form returned by the native owner. QL roles may remain open. Choosing a form states an interpretive framing, not a claim that the original writing has been conclusively classified.

For frame-first work, open **Constellations**, start a new inquiry and save its chosen frame before adding passages. Open positions do not become fabricated source members. Add material later through the same reader selection operation.

Assign roles and add named connections between contextual participants. A connection has direction and standing: proposed, asserted, contested or uncertain. These are deliberate authored relations, not deductions from spatial proximity. Removing a member retracts its connections as part of the proposal; reconnecting a retained relationship addresses the original native edge. The source itself is not deleted.

**Save constellation** sends a revision-bound native action. The register and each cited source must still match their recorded basis. An acknowledged native save and indexed availability are separate facts: the UI states whether Wiki/search readback actually found the saved result. A transport receipt alone is not reported as indexed knowledge.

## Work in the real Expression medium

After saving, **Open live composition** binds the native participants and relationships to the existing Expression Stage. Role positions provide the initial arrangement. Distinct participations remain distinct bodies even when they read the same source. Native relation references remain attached to the visible connection.

**Edit glyphs, text, media and motion** enters the existing composer. It is not another graph editor or another renderer. Reprojection updates native bindings without resetting a body's deliberate spatial edits. If a source changed since the saved interpretation, the consumer refuses to present it as current and asks for reconciliation instead of silently rebasing passages.

The Wiki drawer offers an entrance into the same construction and composition practice. The deeper six-instrument, agent, Journey, Palace and hosted workflows retain their own requirements and evidence in the Technè programme. A working Wiki entrance does not by itself close those wider walks.

## Save the artifact, then Return it

An Expression working document is not yet a native file. Under **Save and Return composition**, choose an existing destination directory and a filename. First save uses Central's explicit no-overwrite creation operation; a later save uses the expected revision of the previously saved file.

The native save response carries a file receipt. It is not required to repeat the entire Expression document. The consumer independently reads the saved file and compares its complete document with the intended working revision. Matching only the Expression reference and revision number is insufficient when the body differs.

After the file is verified, **Return saved Expression to constellation** records its exact native artifact location and source revision in the construction. File save and Return are intentionally separate: an unavailable Wiki operation must not erase or repeat a successful artifact save. The original sources, contextual memberships and whole remain distinct. The returned artifact is derived work, not independent corroboration of the sources which produced it.

Returned work reopens through its actual native file after a kernel restart. A reference is not treated as proof that an in-memory working document still exists. If the artifact has changed since the recorded Return, inspect the current file before replacing the recorded composition.

## Recover a changed or interrupted operation

Unsaved construction input stays with the Wiki surface. Before a native constellation save, the exact pending request and operation identity are persisted. After an uncertain result, **Inspect saved state** checks the native register. If that operation is recorded, the saved result is recovered without creating another constellation. If another edit advanced the basis, the proposal is retained for explicit reconciliation. It is never automatically applied to the new revision.

Before an artifact save, the exact intended Expression document, destination and first-save operation identity are retained. **Inspect pending Expression file** performs a read, not a replay. A completely matching file recovers the successful save. A different file remains a conflict; the consumer never overwrites it merely because the reference or filename looks familiar.

**Restore retained composition** uses the native Expression validator to restore the exact pending working document after a restart. **Retry exact file save** reuses the retained operation only while its intended content still matches. A changed live composition is not submitted under the old creation identity. A failed checkpoint write is surfaced before starting a new native operation; clearing or repairing browser storage is not silently treated as successful recovery.

### Exact save and Return recovery

The file address is the selected native Central directory, not the currently focused Project. The Expression first-save adapter explicitly suppresses automatic Project-operand injection for `central.files.create`. Central keeps rejecting unknown creation fields; its protected-ground, source, symlink and no-overwrite checks remain unchanged.

A refusal now names the native owner's diagnostic. A write acknowledged before readback failed is described as an acknowledged write, not as an unsaved artifact. Successful Return requires the file location and revision in the save receipt to agree with an independent read of the exact destination. The diagnostic never dumps the source document into an alert.

Before **Return saved Expression to constellation**, the drawer retains the exact native Return request and artifact pointer in its existing checkpoint. Failure to retain that checkpoint prevents dispatch. A lost response leaves the artifact saved and makes **Retry exact Return** available. The retry reuses the original operation identity; it does not generate another Expression or re-save its file.

After restart, the retry reads the exact recorded file and checks its source revision and Expression identity. It does not open or replace an unrelated live composition. A changed, redirected or malformed file refuses before the Return action. **Inspect saved state** distinguishes an absent Return from a recorded one. For a recorded Return, both the native operation's actor/basis and the intended current attachment must match; an old historical receipt alone cannot establish that a later-replaced attachment is still current. The same check is applied to an idempotent retry response before the drawer reports completion. Inspection remains read-only.

## Development verification

The read-only `Wiki constellation integration` workflow pins the actual AIKit Wiki/construction owner and Central first-save owner. It builds each native binary, records Cargo's real executable artifact paths and uses a temporary Central/Notes world. Binary-helper unit tests write their own isolated receipts, never the real build receipt.

Focused local checks are:

```sh
cd desktop/cradle
npx tsc --noEmit
node --experimental-strip-types --import ./tests/ts-register.mjs --test tests/wiki-*.test.mjs
node tests/knowledge-expression.mjs
```

The supplementary `tests/wiki-recovery-browser.mjs` exercises the production drawer in an in-memory browser document with explicitly controlled host responses and checkpoint storage. It covers owner refusal, a lost response, exact retries, checkpoint failure, restart input, current-attachment verification and stale artifact refusal. It is component evidence, not native storage or Stage proof.

The shared successor includes the kernel first-save regression at `kernel/tests/wiki_expression_save.rs`. Run the existing complete kernel suite against the integrated patch; the local component results below do not replace native execution. The configured Project must not appear in the creation input.

The complete browser test is `tests/wiki-constructive-browser.mjs`. It requires the real `OI_BIN`, `OI_AIKIT_BIN`, `OI_CENTRAL_CTRL_BIN` and `WIKI_KERNEL_BIN` executables. It does not mock the kernel transport. The intended walk is selected Markdown passages → native constellation and relation → real Stage/composer → native artifact → Return → separate kernel restart and reopen, followed by frame-first construction and stale-source refusal.

Keep the performed test result, source revision and native revisions with every claim. A committed test is not a passed test. Controlled native/browser evidence does not assert installation on the owner's machine, live agent-provider performance, hosted privacy acceptance or human-use completion.
