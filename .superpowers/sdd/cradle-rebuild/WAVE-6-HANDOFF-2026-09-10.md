# Wave 6 handoff — continue the desktop waves faithfully to the plan

**To:** the next desktop session (O:I #190, the Cradle rebuild's coordinated thread).
**From:** zcode-wave6-document-entry, 2026-09-10 23:30 BST.
**Branch:** `agent/oi-wave6-document-entry`, tip `3414f83`, pushed to origin. Worktree at the time of writing: `/private/tmp/claude-501/-Users-admin-Central/b0d4948b-31e4-448b-8998-c5b6e3ea2a06/scratchpad/oi-wave6` (session scratchpad — ephemeral). If it is gone, recreate your own worktree; do NOT use the main checkout at `Work/O-I` (it stands on `site/redesign-v2` with the owner's live work — never touch it):

```bash
git worktree add <your-path> agent/oi-wave6-document-entry
```

## 0. Read properly, in this order — no exceptions

The last three sessions each lost time to someone acting before finishing this list. Read everything; the plan is short and it is the law.

1. `docs/OI-DESKTOP-CONTINUOUS-WORK-WAYFINDER.md` (on this branch) — the amended Waves 6–8 plan, owner-directed 2026-09-10. Read all of it. Load-bearing: §2 (blank tab — the bounded change already made), §3 (document/human-work semantics: Day fixtures, Flow/Dialogue/Journal, save/export law), §4/§4.1 (agent panel planes and full multi-agent continuity), §6 (human Return and safe inclusion), §7 (cuts 6A–6F and the first complete vertical), §8 (owner handoffs — you consume, you never re-implement an owner lane), §10 (candidate binding, proof and closure — the installed whole-path specimen), §11 (the execution brief), §12 (the intake record and retained agency requirements). Note §0's own warning: do not restart foundations or recreate an old `cradle-p1` branch because a historical prompt says so.
2. `.superpowers/sdd/cradle-rebuild/progress.md` — the execution ledger. The three entries dated 2026-09-10 (wave-6 opening + 6A entry cell; 6A remainder; 6E gate readiness) are the actual current state. This file outranks every summary you have been handed.
3. `desktop/cradle/documents/` and its `README.md` — the two owner-supplied portable documents, byte-exact, with fingerprints. The final 4+2 payload (`c8e81e8a…`, 466,929 bytes) supersedes the §12 specimen (`8dca584a…`). Never edit these files; they are received source, and their bytes are proven by walk receipts.
4. `desktop/cradle/walk/artifacts/document-entry.json` — the 17-check receipt for 6A, plus its screenshots. This is what "done" looks like as data; your cells should leave receipts of the same shape.
5. O:I #220 comments (entry/dependency lock — read the 2026-09-10 comments), Factory #195 comments `5620703383` (both functional specifications, verbatim) and `5620823870` (CAW implementation entry), O:I #190 comment `5621135989` (desktop amendment). These govern behaviour; the plan's §0 links them.
6. `docs/OI-DESKTOP-CRADLE-REBUILD-WAYFINDER.md` — the inherited unit identities (U/FND/GW/W1.x). Preserve them; the amendment's 6A–6F are cuts inside Wave 6, not new phase numbers.

## 1. Where the work stands

Done, with walk evidence (bridge transport, real `ctrl`, isolated scratch Central ground seeded with the committed bytes):

- **Blank tab opens the two supplied document forms** — 0/1 (`ql-dialogue-flow.html`, which contains the Journal) and 4+2 (`ql-daily-die.html`, the six-position Day die). Resolution is through Central's file route (`central.files.list` → real location → the navigator's own open path, dedup + focus); rendering is the existing material surface, opaque-origin sandbox. Missing/withheld files surface their exact open location. `FreshSurface`, `flow/documentForms.ts`, `Cradle.freshChoice` — small, keep them small.
- **Native Save on the documents is proven**: a desktop edit advances Central's content-addressed revision; the real 466,929-byte payload round-trips the editor byte-exactly (the content hash returns to the original revision); an external change behind a stale basis meets the structured conflict, nothing overwritten, and rebasing lands the save; a saved 0/1 edit is what Central then holds and re-renders; each document performs its own "Save HTML copy" export inside the sandbox.
- **Two repairs landed** (both recorded in the ledger): (1) `FileSurface.save()` was dispatched twice per ⌘S (CodeMirror `Mod-s` keymap + pane `onKeyDown`) — on large files the second write falsely conflicted; fixed with a `savingRef` re-entry guard, both paths kept. (2) The material iframe sandbox gained `allow-downloads` so the documents' own export works — frame-local only, no bridge authority; `material.mjs`'s exact-sandbox assertion was updated with it.
- **Payload offline purity verified**: the only `http` in either document is the SVG namespace; Mermaid is kept as code, never remote-rendered.
- **Integrated ready owner contributions**: `origin/agent/caw-220-governance-proving` (O:I PR #223 — proving workflow, campaign scripts, CAW profiles, case/join/probe fixtures; all disjoint files) merged into the branch. PR #218's head IS the Wave 5 commit (`56ed62a`) already on the branch.

## 2. Hard-won environment facts (re-read before your first walk)

- Local walks REQUIRE the Central owner pinned: the installed `oi`'s registered owner predates `central.world`/`central.recognize` and the desktop boot refuses without them. Always:
  ```bash
  OI_CENTRAL_CTRL_BIN=/Users/admin/.cargo/bin/ctrl SKIP_BUILD=1 node walk/run.mjs <scenario>
  ```
  Build once first if the renderer changed: `WALK=1 npm run build` (in `desktop/cradle`). Scenarios seed their own scratch ground per run; nothing you do in a walk touches the real ground.
- The FileSurface footer is deliberately collapsed to a 3 px sliver until hovered (cradle.css pane law). Walks: hover the footer, then read the status span, and match status text exactly — "Unsaved" contains "saved".
- ⌘S only reaches the save handler when focus is inside the editor's scroll pane. After clicking the conflict section's "Use current revision as draft basis" button, click back into the editor first.
- Orphaned walk services from earlier runs (ports 4173 preview / 4179 bridge) cause 0/0 boot-failure receipts. Clean them before re-running — but ONLY yours. A concurrent session's desktop preview on port 4174 (launched from the main worktree) was live at 23:02 and is not yours to touch. Serialization law: never rebuild into or disturb an app under someone else's inspection.
- Two standing scenario quirks are PRE-EXISTING, verified by A/B on the pre-6A tree — do not "fix" them silently into acceptance: `surfaces` errors at a tab click after its checks pass; `kernel-cas` intermittently double-fires the conflict event under concurrent load.

## 3. Gates — check before you dispatch, every time

- **6B (select and send) is gated on AIKit #275** — PR #278 (`agent/caw-274-277-native-continuation`) was still OPEN, partial, at 23:00. Until it merges AND installs, addressed Agent dispatch stays an honest `unavailable`; do not simulate a reply, do not invent a desktop dispatch seam.
- **6E (receive and include) is gated on Central #150–#152** — PR #155 now carries real implementation (`ctrl/src/continuous_work/{placement,temporal,documents,receiving,migration,...}`). When it merges and installs, the consumer binds these operations verbatim (recorded in the ledger so nobody re-inventories): `central.receiving.submit|review|include|recover`, `central.document.create|mutate`, `central.day.ensure|lifecycle`, `central.now.allocate|lifecycle|read|obligations`, `central.migration.plan|apply|rollback|recover`, `central.work.policy|validate`, `central.time.policy`, `projectcentral.source.write`.
- The first complete vertical (wayfinder §7) — open a real document → select a passage → send to one actual Agent → attributable reply → review and include one contribution — joins 6A/6B/6E as soon as those seams land. The desktop-side half (selection → scoped candidate → accompanying-agent panel) is real; the missing halves are owner operations, not desktop work.

## 4. Named opens inside 6A (the only 6A work left)

1. **Installed-candidate walk** (wayfinder §10): bind ONE coherent candidate through the O:I install/update/source-modality system, record every executable's path/revision/digest, and walk the whole path with the owner present. Serialized — schedule it, never overlap it with another session's candidate.
2. **The Tauri `oi-material://` export variant**: the walk proves the bridge transport; the shipped protocol handler exercises the same sandbox attributes but has not been walked with the document's own export button. Fold this into the installed walk.

## 5. Laws that must not drift (the plan says all of this; it is repeated because it is the part that decays)

- Payload bytes are source. Preserve them; their fingerprints are recorded; "template defects found during integration are recorded and repaired explicitly" — in the DESKTOP, never by editing the received files.
- Use the owner's supplied labels (0/1, 4+2) and the owner's current public operations. Do not invent ids, registries, templates, a third Journal file, or consumer bindings against unmerged PRs. A merged PR is not an installed capability; a type existing is not an operation working.
- Every control closes the chain: owner operation → actual transition → authoritative readback → panel/kernel integration proof → installed interaction evidence. Keep implementation / merge / integrated / observed as separate recorded standings (D/C walks are evidence, not M; local fixtures never become M; human EX is the experiential grade).
- One mutable shared subject, one writer. Serialized by law: shared bridge/schema joins, candidate builds, executable binding, service replacement, installed walks, evidence promotion, phase landing.
- Record actual readbacks and honest failures in `progress.md` (the ledger). A day that cannot close honestly says so; a receipt that cannot pass says what failed.

## 6. Suggested next dispatch (after your reading and gate checks)

1. Gate-check AIKit #278 and Central #155 (merged? installed?). Whichever landed first owns your next cell: 6B consumer (bind #275's discovered participants and addressed-turn dispatch into the agent panel) or 6E consumer (pending Return tray + fixture targeting + revision-checked include via the `central.receiving.*`/`central.document.*` operations recorded above).
2. If neither has landed: schedule the serialized installed-candidate walk with the owner (§4), or take a disjoint 6C/6D presentation cell that consumes only current public readings — after naming it in the ledger with its exact owner refs.
3. Whatever you do: brief → build → walk → review → receipt, one cell at a time, evidence in the ledger, coherent checkpoint committed and pushed before you stop.
