# BRIEF — Flow instances: the ratified carrier, end to end — 2026-09-13

Queue follow-through on the ratified PROPOSAL-FLOW-DAY-LOGICS-2026-09-13-2
(#267): flow files are dated, self-contained 0/1 template instances in
`Control/user/flows/`, accumulating through a day, fileable into `/day`
folders, riding the day/now archiving. This cell locks the desktop to that
carrier end to end.

## Owner doors (probed live)

- Central #174 (landed this session, ctrl `d488dfe69a3a`): `central.files.write`
  creates an absent file only under `Control/user/flows/` with an empty
  expected revision (staged/renamed, journal-seeded, CAS thereafter) and
  refuses creation everywhere else; existing files write revision-checked.
- `central.files.list` / `central.files.read` cover listing and reading
  (readings are `central.directory-reading/v1` / `central.file-reading/v1`).
- The 0/1 template (`desktop/cradle/documents/ql-dialogue-flow.html`) mints
  `documentId`/`created` at first open; the desktop mints them at Save so the
  instance is identity-stable from birth, carrying the writing as the first
  F entry (escaped, verbatim bytes preserved in `provenance`-equivalent form:
  the entry html IS the writing).

## Change

- `desktop/cradle/src/flow/instance.ts` (new) — template import (`?raw`),
  mint (documentId/created/first F entry), read (parse embedded `#ql-doc`),
  append (new F entry, `meta.revision+1`), serialize.
- `desktop/cradle/kernel/src/{flow.rs→files paths,lib.rs}` + `types.ts` —
  `KernelOp::FileRead {location}` exposing the existing `files::read`
  (schema-verified `central.file-reading/v1`), mirroring `FilesList`.
- `desktop/cradle/src/flow/instances.ts` (new) — typed client: list / read /
  write (create or revision-checked save) through the owner routes.
- `Cradle.tsx` — explicit Save mints the dated instance
  (`flow-<local-stamp>.html`, suffix on name collision) and opens the
  document surface; the register picker is gone (one user-section home).
- `FlowSurface` — document mode: reads the instance, renders the thread
  (entries with declared author + timestamp), an append-entry composer (the
  template's own contract: the desktop appends F entries and never rewrites
  the human's rich html), Save = whole-document write against the file's
  central revision; stale revision renders the owner's conflict verbatim with
  the buffer retained and the current bytes offered as a rebase.
- Navigator — the per-project Flows group retires with the store path; a
  user-section Flows list (root area, beside the User/Agent spaces) lists
  `Control/user/flows/` dated documents, honest absence when the folder does
  not exist, New flow opens the retained draft.
- Residue cleanup (O-I repo, custody in git history): the five walk-era
  placeholder files under `ProjectCentral/now/flows/` and the local
  `.central/flows.json` state are removed from the project ground fixtures
  this desktop no longer writes.
- Walks re-contracted: `flow-canvas` (mint via Save into
  `Control/user/flows/`, revision stability across appends, session binding,
  structured conflict through the file CAS), `navigator` (user-section list
  unchanged by opening; no mint), `remember`/`leave-reenter` placement
  wording.

## Walk contract (metrics)

1. New flow → draft mints nothing (owner listing and filesystem unchanged).
2. Explicit Save creates `Control/user/flows/flow-<stamp>.html` whose
   embedded document carries the exact typed writing; the surface opens it.
3. Appending an entry advances the file revision; the document id is stable;
   the human's earlier entries are preserved byte-exact.
4. A stale save renders the owner's conflict verbatim, buffer retained,
   rebase offered and provable.
5. Absence renders honest absence; nothing polls or invents.
6. Full regression floor green (all 20 suites on the final bundle).

## Standing

Branch `agent/oi-flow-instances`, cut from origin/main `9d7f6246` (#267).
Claim: brief pushed + draft PR before the build commit. Named remainder: the
kernel's contemplate/commission flow ops still address Central's legacy
knowledge-node actions; retiring that store is the Central-side follow-up
(the writing path no longer touches it).
