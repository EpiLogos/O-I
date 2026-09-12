# BRIEF — Task basis on the addressed composer — 2026-09-12

Queue cell 2 (NEXT-SESSION-PROMPT-2026-09-12). Re-survey of the installed
aikit `0.1.0` @ `586b85eaf77c` (unchanged digest; read from its checkout at
the same commit, never the working tree) and ctrl `59bb901c19a5`.

## Owner contract (probed this session)

- `aikit-session-space encounter-task-configure` (`TaskRequest`: central
  request + provider + canonical cwd + selected_directories +
  workcell_boundary_bin + authority_ref + optional material_host) allocates
  the Central task through `central.work.policy` → `central.now.allocate` →
  `central.work.validate`, writes boundary requirements, rebinds the session
  launcher, sets `ready=true`. `encounter-task-read` discloses the record
  (`aikit.encounter-task/v1`: revision, request, ready, allocation with
  now_ref/revision/policy, requirements, launcher, material).
- `EncounterAddressedTurn`/`EncounterGroupRecipient` accept optional
  `expected_task` (`EncounterTaskBasis`: revision, task_ref, now_ref,
  now_revision, policy_revision, cwd, agent_ref, agency_ref,
  world_binding_ref, source_ref, source_revision, source_digest) and
  validate it EXACTLY against the stored task and the session's agency
  binding before transport ("Addressed task expectations differ …").
- The binding triple (agent_ref/agency_ref/world_binding_ref/source basis)
  is NOT caller-readable on this cut: `encounter-agency-configure` writes it;
  no read action discloses it. A caller composes the expectation's binding
  half only from provisioning facts it already holds (the owner's own
  `caw_task_dispatch` test does exactly this).
- Participant/recipient enumeration: still absent (#274 caller work). The
  composer's operator-typed recipient/basis/audience fields STAY (fallback
  law — never removed while the owner still validates them).

## Change

- `desktop/cradle/kernel/src/agency.rs` — `AddressedTurn`/`GroupRecipient`
  gain optional `expected_task` (opaque `Value`, carried verbatim, never
  interpreted by the kernel); `Client::task_read` invoking the owner's
  `encounter-task-read` subcommand (same discovery/env as `read_project`).
- `desktop/cradle/kernel/src/lib.rs` — `KernelOp::EncounterTaskRead
  {project, agent_session}` with the standard project-disclosure gate and
  project-cwd resolution → `KernelOpResult::EncounterTaskReading`.
- `desktop/cradle/src/kernel/types.ts`, `src/encounter/client.ts` — the typed
  op/outcome; `AddressedTurn`/`GroupRecipient` gain optional `expected_task`.
- `desktop/cradle/src/encounter/EncounterSurface.tsx` — reads the session's
  task through the owner when the encounter opens (quiet; absence renders
  nothing); passes it to the view.
- `desktop/cradle/src/encounter/EncounterView.tsx` +
  `AddressedComposer.tsx` — a task section in the addressed composer
  rendering the session's ACTUAL task verbatim (task_ref, purpose, ready
  state, the allocation's NOW ref/revision/policy — owner facts only), with
  the honest disclosure that the owner does not yet disclose the session's
  agency basis to callers, so the desktop attaches no `expected_task` of its
  own; the kernel seam carries one when a sender supplies it. Refusals and
  absence render in the owner's words.
- `desktop/cradle/walk/scenarios/task-basis.mjs` + `walk/run.mjs` — the walk.

## Walk contract (metrics)

1. Provision the select-send skeleton (real Actuation admission, agency
   source, controlled provider) plus `encounter-task-configure` through the
   owner (real ctrl + Workcell boundary binary, WORKCELL_CONTROL_TOKEN env):
   an allocated Central task, `ready=true`.
2. The composer's task section renders the owner's record verbatim —
   task_ref, purpose, ready, now_ref, now revision, policy revision.
3. An addressed turn whose `expected_task` echoes the actual record (the
   walk composes the binding half from its own provisioning facts, exactly
   as the owner's test does) is dispatched through the kernel seam and
   RETURNS: the owner validates it against the real task + binding; the
   provider reply reaches the transcript.
4. A fabricated basis (one field altered) is REFUSED by the owner with its
   exact message; nothing transports.
5. Full regression floor green (all suites on the final bundle).

## Standing

Branch `agent/oi-task-basis`, cut from origin/main `201a65d3` (#251).
Claim: brief pushed + draft PR before the build commit.
