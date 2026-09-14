# BRIEF — NOW-relations beside their records — 2026-09-12

Queue cell 1 (NEXT-SESSION-PROMPT-2026-09-12). The named open from the 6C cut 1
survey ("NOW relations … no owner action enumerates NOWs by participant") is
CLOSED on the installed cut: the re-survey law paid off again — installed ctrl
MOVED `9debcf4f0bf9` → `59bb901c19a5` (Central @ `59bb901`, the `central.now.list`
propagation, native tests green) and the new action is live: 156 actions where
the frozen survey recorded 154.

## Owner contract (probed live, `ctrl 0.1.0` @ `59bb901c19a5`, sha256 `2f03ec33…`)

- `central.now.list {project?, participant_refs?}` (read-only) →
  `central.now-listing/v1`: rows of `{now_ref, source_ref, scope_ref, task_ref,
  purpose, participant_refs[], source_refs[], lifecycle, created_at_unix_seconds,
  revision}`.
- `central.now.read {project?, now_ref, with_placement?}` (read-only) →
  `central.now-reading/v1`: `{record: NowRecord, source, revision,
  automatic_agent_or_model_invocation:false}`; `NowRecord` carries
  `now_ref, source_ref, scope_ref, task_ref, purpose, participant_refs[],
  source_refs[], policy_revision_at_allocation, created_at_unix_seconds,
  lifecycle, obligations[], continuation_refs[], archive_ref`.
- `central.receiving.submit` accepts optional `now_ref`; every receiving row
  discloses `now_ref/day_ref/task_ref/run_ref/session_ref` when present —
  the records through which NOWs reach the desktop.
- Both registers: root via explicit-null `project` (the run-level convention);
  a project register names its project.

## Design citations (already authored, not re-decided)

> "6C — … NOW relations and truthful alternate-Surface continuity" — wayfinder §7.
> "Inspect — stable document/NOW/Agent/… refs, revisions, provenance and
> genuinely available native operations" — wayfinder §4 plane table.
> "Honesty. Truthful state only — no invented health, no fake loading …
> unavailable ≠ error." — law 7. A record that names no NOW renders no NOW;
> an owner refusal renders verbatim.

## Change

- `desktop/cradle/kernel/src/flow.rs` — `NowRequest` (list/read) +
  `CentralClient::now` mirroring `receiving`'s explicit-null project law and
  verbatim payload carriage.
- `desktop/cradle/kernel/src/lib.rs` — `KernelOp::Now {project, request}` →
  `KernelOpResult::NowReading`, same project-disclosure gate as `Receiving`.
- `desktop/cradle/src/kernel/types.ts` — the typed op + outcome.
- `desktop/cradle/src/receiving/now.ts` (new) — typed client
  (`NowListing`/`NowReading`) over the kernel op.
- `desktop/cradle/src/receiving/NowRelations.tsx` (new) — given a `now_ref` +
  register, reads the NOW through the owner and renders its relations VERBATIM:
  task, purpose, lifecycle, revision, participants, sources, continuations;
  the owner's refusal verbatim when the read fails; nothing derived, nothing
  inferred, no polling.
- `desktop/cradle/src/receiving/ReturnsTray.tsx` + `DocumentReturns.tsx` —
  records that name a `now_ref` mount `NowRelations` beside their detail; rows
  carrying one show a `now` marker. Records without one render unchanged.
- `desktop/cradle/src/encounter/EncounterView.tsx` — Inspect plane gains
  "NOW records reached this surface": refs collected from the surface's own
  addressed dispatch records. On this cut deliveries carry no now_ref, so the
  section renders the honest empty state — the surface does not invent refs.
  When a future owner receipt names one, the same section renders it.
- `desktop/cradle/src/receiving/receiving.css` — styles, tokens only.
- `desktop/cradle/walk/scenarios/now-relations.mjs` + `walk/run.mjs` — the walk.

## Walk contract (metrics)

1. Seed through the owner: allocate a NOW (`central.now.allocate`, project
   register, participant_refs + source_refs) and submit a Return carrying its
   `now_ref`; allocate a second NOW in the ROOT register for the explicit-null
   convention.
2. The project tray's record detail renders the NOW's real relations verbatim
   (task/purpose/lifecycle/participants/sources read through `central.now.read`
   — proven by seeding distinct values and asserting them byte-for-byte).
3. A root-register record reads its NOW with `project: null` (the walk's own
   owner probe must match the rendered relations; a project-scoped read of a
   root NOW would refuse — the desktop must not attempt it).
4. Absence stays honest: a record without now_ref renders no NOW section; a
   tampered/unknown now_ref renders the OWNER'S refusal verbatim, never a
   desktop-fabricated "missing"; the Inspect plane's NOW section shows the
   honest empty state with no deliveries carrying refs.
5. Full regression floor green (all suites on the final bundle).

## Standing

Branch `agent/oi-now-relations`, cut from origin/main `fb22777` (#250).
Claim: this brief pushed + draft PR opened before the build commit.
