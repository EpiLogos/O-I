# T-RECOVERY-FOR-OPENED-WORKS — a native Expression the candidate opens can open

**Found:** 15 Oct 2026, lane S (PATH.md, the paragraph on Technē's subject
door). The frame refuses every Expression the host opens — "No host-selected
native recovery address is attached" (`packages/expressions-boundary/src/recoveryBinding.ts`,
`RecoveryAdmission.admit`) — because the candidate selects recovery addresses
only from a `saved-work.json` (`desktop/cradle/src-tauri/src/native_shell.rs`
382–403), the owner's candidate config holds none, and so
`recoveryBindings` (`packages/live-shell/ui/src/panels/expressions.tsx`) is
undefined. With no address, the frame falls back to finding a checkpoint by its
ref (`find_checkpoint`), which the boundary refuses; if that is let through, the
frame's first working-checkpoint write (`nativeWorking.ts` `adopt`) is refused
by the same admission. Technē's door, the browser's Open and New, and a
Featured/Starter fork all go through `host.openExpression`, so all of them were
blocked.

## Decision

**The host selects the recovery address of an Expression it opens itself,
when no configured saved-work address names it. The address is deterministic:
`{scope: 'expressions', checkpoint_id: <ref>, expression_ref: <ref>}`. A
configured address always wins and is never replaced. The owner's "no
checkpoint here yet" is a reading, not a refusal: the work opens on the
owner's own Document, and the frame's first working checkpoint creates the
record through the owner's compare-and-set.**

### Why the host may choose

- The boundary already says the host chooses: "The host chooses native
  identities" (`packages/expressions-boundary/src/continuation.ts:6`). The
  admission is "A host-selected native recovery address" and "Routing
  metadata only. The native owner retains every byte and CAS basis"
  (`recoveryBinding.ts:5`, `:29`).
- The decision that left this gap named who may close it: "broader work
  creation and selection need the host/native owner to establish a
  legitimate address before retention"
  (`desktop/cradle/docs/world-shell/RECOVERY-ROUTING-AUDIT.md:27`); "A
  new/unconfigured work needs an explicit creation/selection route before
  hosted recovery can operate" (`packages/expressions-boundary/RECOVERY-OWNERSHIP.md:58`).
  The host or the owner, before retention. Nothing reserves it to the person.
- Saved works are "operator-chosen" (`STARTUP-CONTINUATION.md:3`): that is
  the choice of which retained works reopen at startup. Selecting the address
  of a work the host is opening now is a different act, and it does not touch
  the configured ones.
- Owners write; faces read (`wayfinder/DEVICE-SEMANTICS-LOCK.md` §0.4). The
  host selects only routing (scope, id, ref). The kernel's recovery owner
  (`desktop/cradle/kernel/src/expression_recovery.rs`) keeps every byte, the
  file lock and every revision. The first checkpoint is the frame's ordinary
  `adopt` of the owner's own Document (`nativeWorking.ts:279`), written with an
  absent basis, which the owner accepts only if no record exists
  (`expression_recovery.rs:1565`). Nothing is copied in and nothing is
  invented.

### Why the address is `(expressions, ref, ref)`

- **The id is the ref, by the owner's own law.** The owner keeps a
  checkpoint's id, its `draft_id` and its Journey id equal
  (`expression_recovery.rs:302`, `:307` → `journey` `:257`). The frame names
  an owner Document's Journey by its ref (`kernelDocumentBridge.ts:142–150`,
  `:289`). So the frame's first checkpoint of an owner Document can only be
  written at id = ref. Configured works hold the same rule: "canonical
  checkpoint id equal to ref" (`STARTUP-CONTINUATION.md:14`;
  `continuation.ts:41`). A host-allocated random id that the owner records
  would break the identity law, and keeping its mapping across restarts would
  need a new store. The deterministic id needs neither: the boot query and the
  host agree without a table, and the same work meets its own checkpoint after
  a restart.
- **One scope, never the presentation mode.** "Presentation mode is not part
  of its authority" (`recoveryBinding.ts:5`); "Mode remains presentation"
  (`RECOVERY-OWNERSHIP.md:8`). GUI Save was paused once because the frame
  took its scope from its first URL (`STARTUP-CONTINUATION.md:16`). The
  candidate mounts one application ("The real application is mounted once",
  `expressions.tsx:53`), so there is no second aperture a host-opened work
  could belong to. `expressions` is the Expression owner's own scope.
- **No discovery.** An exact address names at most one record. The owner's
  ref search refuses duplicates (`expression_recovery.rs:1537`), and the
  owner's real store holds the same ref in both scopes
  (`RECOVERY-OWNERSHIP.md`, Native evidence). So the boundary keeps refusing
  `find_checkpoint`: an older Technē-scope copy stays where it is,
  untouched, and is reached only through a configured address.

### What this costs

A work with an older checkpoint only in the Technē scope opens from its
owner Document, and a new Expressions-scope checkpoint is started for it. Both
records are kept. Going back to the old one is an owner-configured saved work.

## Built

- `recoveryBinding.ts`: `RecoveryAdmission(bindings, {selectOpened})`. On
  `binding(ref)`, a configured address is returned first. Otherwise a
  canonical ref (`expression:[A-Za-z0-9_.-]{1,128}`) gets
  `(expressions, ref, ref)` before the open command is posted. An address
  that another work already holds is refused, and so is a 257th address.
  When a checkpoint read comes back absent, the draft named by the
  checkpoint's own id is granted to that address (the same grant a present
  checkpoint's read gives). Before that answer, a checkpoint or draft write
  is still refused.
- `host.ts`: `selectOpenedWorks` on `ExpressionsHostOptions`, passed to the
  host's admission and to `mountExpressionsApplication`'s boot admission
  (the boot deep link gets the same address in its query).
- Frame: `recovery.ts` `readBoundWorkingDraft` answers `undefined` ("none
  yet") for an absent checkpoint at a canonical address and addresses its
  draft there (`nativeRecovery.ts` `acceptAbsentRecoveryCheckpoint`). An
  absent checkpoint at any other address is still refused, as before. `followOpen`
  then adopts the owner Document, as it does for any work with no
  checkpoint.
- Shell: `panels/expressions.tsx` passes `selectOpenedWorks: true` and no
  longer refuses to mount when the book's last work is not a configured one.
  That work now gets the selected address.
- Kernel: unchanged. It already answers an absent read with `ready` and
  `record: null`, and creates on an absent compare-and-set basis (its tests
  `durable_reopen_scopes_metadata_and_no_revision_aba`,
  `independent_store_writers_have_exactly_one_cas_winner`).

## Found while proving: the opening canvas blocks the first open

The candidate's works home holds no Expression files, so the frame starts on
its own opening canvas (`app.ts` `oiMark()`, or Technē's "Twelve faces"),
not on a native reference. Before reading where it is going, `followOpen`
keeps the draft it is leaving (`host.shouldRetainDraft`). For a frame that
did not start on a native reference, `app.ts:2490` answers
`!awaitingNativeBoot||store.revision!==0`, which is true even when the canvas
is untouched. That draft has no host-selected address, so the boundary
refuses it ("The recovery record is outside the host-selected address"). The
open then stops with a toast inside the frame, before any recovery traffic.
`app.ts` already says what the rule should be: "an untouched opening canvas is
not recovery material" (`:243`), and "A blank boot frame is not a new chosen
work" (`:1374`).

Proposed, one line in `app.ts:2490` (not in this lane's zone):
`shouldRetainDraft:()=>store.revision!==0||!!nativeWorkspace?.nativeView()`.
That keeps three things: any edit, a recovered draft (the boot recovery
touches the store, `:2968–2978`), and an open native work (its draft has an
address). It drops only an untouched canvas that is not native. An edited
local draft is still kept, and is still refused in a hosted frame. Where a
hosted frame's local drafts should live is a separate decision, the
"unconfigured work" seam in `RECOVERY-ROUTING-AUDIT.md:27`.

## Acceptance

- Scripted: `packages/expressions-boundary/tests/opened-work-recovery.test.mjs`
  runs the real host and admission, the frame's own `followOpen`,
  `readBoundWorkingDraft`, recovery functions and `NativeWorking`, and the
  boot mount, against a scripted stub of the recovery owner.
  `packages/live-shell/ui/tests/expressions-opened-recovery.test.mjs` reads
  the panel's code to check its wiring.
- Headless, own stack (bridge :4241, live-shell :8921, Vite :5221), the real
  native owner, run 15 Oct:
  - The door's ask for O-I, with the frame mounted on that work: the owner
    read the exact address (no checkpoint yet), the frame adopted the owner's
    Document, and the first checkpoint was written with an absent basis
    (revision 1). The frame reports its `nativeScene` for
    `expression:techne-m0.central.dd19…`.
  - Restart (new bridge, new page): the same address now reads revision 1 and
    its draft, and the work reopens. Nothing was searched for and nothing was
    copied.
  - The real path, Technē › Locations › double-click O-I, with the frame
    standing on its opening canvas: refused with this lane's change alone.
    With the proposed `app.ts` line (served from a scratch build) the door is
    shown: "in O I · +2", the frame on the register's Expression.
  - Expressions › New (Central root pointed at a scratch ground): with this
    lane's change alone, the first open is refused by the opening canvas, and
    the work shows once the panel mounts on it. With the proposed line, New
    opens the work directly: "Opened, and saved to
    Control/user/flows/untitled-expression-….expression.json" (in the scratch
    ground).
- Native screen: the lead's (not verified here).

## State of record (moved from PATH sec 7, 22 Oct 2026)

Moved verbatim from the retired `PATH.md` (history: PATH.md at `41557a9ed`). Hashes, run labels (r1, r23 ...) and cross-references inside are as PATH wrote them; "PATH sec N" and "FOUNDATION sec N" in this text name the retired files, whose content is now in `MAP.md` (State of the streams, The foundation's route), `EXECUTE.md` and the tickets.

### PATH sec 7: the subject door and the opened work (lanes W, S, N)

Then: a native Expression the candidate opens can open (`5bacd1d8c`, lane W; `14fb4913d`). Decided from the authored ground
(`tickets/T-RECOVERY-FOR-OPENED-WORKS.md`: "The host chooses native identities"; an address is "routing metadata only"): the host
selects `{scope: expressions, checkpoint_id = the ref}` for every work it opens with no configured address, before the frame
asks; a configured saved work keeps its own; an empty checkpoint reads as "none yet" and the first is created through the
owner's absent-basis CAS; and an untouched opening canvas is no longer retained as a draft, so the door's Scene and New open
straight from the frame's blank canvas. Headless on the real ground (lane W's stack): the door reached "shown" ("in O I · +2")
and reopened from revision 1 after a restart; New opened its work (in a scratch Central root). Carried from lane W: the owner
quarantine ops (`keep/remove_draft_quarantine`) are refused by the admission ("Unsupported native recovery operation"); the
boot read of the opening canvas's checkpoint is refused ("Native recovery was not adopted…"); an edited local draft in a hosted
frame has no address, so opening something else from it is refused; the panel never retries a failed boot `list`; the wiki
registers took 200–300 s under this machine's load, so an early door ask settles absent and must be asked again. Screen leg
UNVERIFIED.

Then: Technē's subject door traced (lane S, headless against the real ground): two breaks in series. (1) The stage pane's
placement record was erased by a remounted instance's late unmount, so the frame never stood over the stage and no navigator
took the ask — fixed (`989f27921`: a pane's record belongs to the instance that admitted it). (2) The frame then refuses the
Expression the host opened — "No host-selected native recovery address is attached" — because the candidate selects recovery
addresses only from a `saved-work.json` the owner's config does not hold; by code-reading this blocks every native Expression
open in the candidate (the browser's Open too), not only the door (lane W). The door is never silent now (`02e9f0370`): a taken
ask settles shown or refused, the row reads "asking for <Scene>…" until the frame shows it, and a stalled ask says why on the
row and the pane's fault line. The register's progress axis follows the code (`7f6d706e6`, lane V: implemented 125 → 106, all
lane 4, the frame map's evidence gone with the map); implemented is proven at a target's home (`8b0ed7afd`: an off-target
quote no longer holds; `prove-at-home` checks the home's own line, tests that reach it and the commit; lane 4 re-proven on the
atlas — 105 implemented). Carried from lane V: after lane U lands, `reprogress --apply --lane 4 --lane 5 --at-home`; 53 rows in
lanes 1–3 and 5 cite evidence outside their home's file — re-prove at home lane by lane as the exercised column is worked
(FOUNDATION §6 step 4), not by a blanket return; T14/T15/T24/T10's proofs cover their behaviour in part.

Then: Technē starts from the world (`3a8fbc2d6`, lane N, S1 + G2). N2's subject door is mounted: Locations and Places list
the owner's subjects from the atlas's suite standing (Bodies and Journeys say which input they wait on), double-click or Enter
opens a subject in the Scene that carries it through the owner's reverse query and selection ask, the subject is named in the
title line, Trail, aperture and Clip side, and the Graph opens turned to it. Headless, the door's wiki load took 144–188 s and
answered absent (ensureWikiStanding 16–40 s per register, 17 registers) — passed to lane Q with the Graph op. Carried from
lane N: one atlas per session, so a Graph opened beside Technē's Earth is held and takes nothing when the Earth closes (to lane
O). Found while converging it: the Expressions panel had been opening its engine-checkpoint binding as a tab into whichever
tree stood in front, 20–140 s after entering a mode, and moving it into the tree in front on every switch — the empty
Expressions pane seen natively in Technē and Live; the binding is now held on no tab (`10d17bf49`, headless: three minutes
in Technē, the Earth alone, the binding kept). The native pass at `a8ec87dda` could not run: the Mac was locked with the
candidate in Stage Manager's strip (FOUNDATION §5).
