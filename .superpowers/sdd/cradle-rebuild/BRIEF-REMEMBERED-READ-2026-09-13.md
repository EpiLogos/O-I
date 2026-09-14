# BRIEF — Remembered notes, read — 2026-09-13

Queue cell D (NEXT-SESSION-PROMPT-2026-09-12-2), the U3.3 named open. The
remember WRITE landed through the owner's typed operations (#250-era); the
notes are plain owner ground files and had no read surface.

## Owner contract (probed live)

- `central.remember` writes `Control/agents/remembered/`;
  `projectcentral.remember` writes
  `Work/<Name>/ProjectCentral/agents/remembered/` — plain files, no read
  action exists (`central.remembered-notes.list` is unknown to the owner).
- The `central.files` family reads ground truth:
  `central.files.list {path}` (`central.directory-reading/v1`) and
  `central.files.read {location, encoding}` (`central.file-reading/v1`); the
  kernel routes `files_list` already carries the listing. A listing of a
  directory that does not exist refuses with "No such file or directory" —
  on this surface that exact refusal IS what nothing-remembered looks like.

## Change

- `desktop/cradle/src/context/RememberedList.tsx` (new) — per-register read
  list: `files_list` over the register's remembered path; each entry
  expands through `central.files.read` (invoked as the owner action) and
  renders the file VERBATIM against its path ref; an absent remembered
  directory renders honest absence; any other owner refusal renders in the
  owner's words. Read-only — nothing here recognises, promotes or edits;
  recognition stays the human owner's separate act.
- `desktop/cradle/src/surfaces/navigator/WorldNavigator.tsx` — mounted in
  each bound project's chats navigation beside Flows and Encounters, reading
  `Work/<Name>/ProjectCentral/agents/remembered` (the project register; the
  same component takes the root register's path unchanged).
- `desktop/cradle/src/surfaces/navigator/navigator.css` — tokens-only styles.
- `desktop/cradle/walk/scenarios/remember.mjs` — extended with the read half.

## Walk contract (metrics)

1. Before anything is remembered: the list renders honest absence.
2. After the project-register remember: the list carries exactly the note
   the owner holds.
3. Reading the note renders the owner's file verbatim — the verbatim
   selection and the content-addressed ref included.
4. Full regression floor green (all 20 suites on the final bundle).

## Standing

Branch `agent/oi-remembered-read`, cut from origin/main `458bcfbf` (#264).
Claim: brief pushed + draft PR before the build commit.
