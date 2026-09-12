# BRIEF — U3.3 Remember-this (the desktop half) — 2026-09-12

Relation cell: `(S→S0) return mode` — remember a selection into a chosen
destination, as proposal until recognised (wayfinder §2.2; Slice 4).

## Law excerpts (verbatim, enforced)

> "remember a selection into a chosen destination, as proposal until recognised
> | S→S0 · return mode (tail of the 4→5→0 triad) | durable ground is
> Central-authored; a remembered note carries generated-provenance until the
> person recognises it" — wayfinder §2.2, U3.3 row.

> "walk: remember from canvas → note lands in the chosen destination with
> provenance `generated-proposal`; recognition promotes it." — wayfinder §5 U3.3.

> "Honesty. Truthful state only — no invented health, no fake loading, no
> simulated streams, unavailable ≠ error." — law 7. Recognition has NO owner
> operation on this cut (`central.recognize` is directory inspection; 154
> actions, none promotes a note): the desktop discloses recognition as the
> human owner's separate act and offers no control that claims it.

> "No capability theatre." — law 10. The owner operation exists (`central.remember`
> / `projectcentral.remember`, mutation class locally-mutating, typed
> `remembered-note-proposal` output with `central.remembered-note/v1` +
> `central.remembered-note-provenance/v1`, authorship `generated-proposal`,
> recognition `unrecognised`, owner `read_path` disclosure). The cell only
> renders it honestly.

## Owner contract (probed live on the installed cut `ctrl 0.1.0` @ `9debcf4f0bf9`, sha256 `573495a4…`)

- `central.remember {selection, source_ref, destination:"remembered"}` → note
  under root `Control/agents/remembered/`. `projectcentral.remember
  {project, selection, source_ref, destination:"remembered"}` → note under
  `Work/<project>/ProjectCentral/agents/remembered/`.
- Output: `remembered-note-proposal` — note ref `remembered-note:<fnv>`,
  provenance (verbatim selection, source_ref, origin action,
  `recorded_at_unix_seconds`, recognition `unrecognised`), and `read_path`
  disclosing the owner read (`central.files.read` with location + ref).
- Refusals are machine-readable: invalid destination, empty selection, invalid
  source ref, absent/unwritable ground. Kernel routing already exists
  (`action.rs` prefix rule → real ctrl runner; no kernel change).

## Files

- `desktop/cradle/src/context/ContextTray.tsx` — a fourth destination,
  "Remember this": rendered only for revision-carrying selections (same gate
  as publish/A2A); a register select (Root register / the selection's project
  register, defaulting to the selection's own register); invokes the kernel's
  typed `invoke_action` dispatch (`central.remember` with explicit
  `project: null` input so the root call stays clean; `projectcentral.remember`
  with the named project); renders the typed receipt inline: note ref,
  authorship, recognition state + the honesty line, verbatim selection,
  source ref, origin action, recorded time, and the owner's own read-path
  operation. Dispatch failure states render in the owner's words.
- `desktop/cradle/src/context/context.css` — receipt styles, tokens only.
- `desktop/cradle/walk/scenarios/remember.mjs` — new scenario (aliases
  `remember`, `u3.3`), reusing editor.mjs source provisioning.
- `desktop/cradle/walk/run.mjs` — scenario registration.
- `.superpowers/sdd/cradle-rebuild/progress.md` — claim row (this file's
  landing) + receipt row after the walk; also records the missing flow-canvas
  ledger row (PR #242 landed without one; recorded from the merged PR body).

## Walk contract (metrics)

1. Remember appears for revision-carrying selections; absent for observed
   element selections (no owner source ref, nothing advertised that cannot run).
2. Register select offers Root + the selection's project; defaults to the
   selection's own register.
3. Remember to the project register: receipt names `remembered-note:` ref,
   `generated-proposal`, `unrecognised`, the verbatim selection bytes, the
   exact Central source ref, origin action `projectcentral.remember`.
4. Owner readback through the receipt's own `read_path` (`central.files.read`
   via the scratch ctrl) returns the note; provenance selection matches the
   selected bytes byte-for-byte (owner's word, not a desktop assertion).
5. Ground fact: the note file exists under
   `Work/Editor/ProjectCentral/agents/remembered/`.
6. Remember the same passage to the Root register: the note lands under
   `<root>/Control/agents/remembered/` with the full project source ref in its
   provenance.
7. Recognition honesty: the receipt states recognition is the human owner's
   separate act; no desktop control claims or performs it.
8. Stale selection: external edit between selection and Remember → the tray's
   currency error names it; NO note lands (owner ground unchanged).
9. Full regression floor green including the new suite (16 suites).

## Standing

- Branch `agent/oi-u33-remember`, cut from origin/main `11e9790` (#242).
- Context chain: wayfinder, skill, orchestrator artifacts present; surface
  audit green (aikit compose/client, ctrl actions); installed owners unchanged
  from the ledger's last binding record (ctrl `9debcf4f0bf9`, aikit
  `586b85eaf77c` — digests re-verified this session).
- Law-13 report: stray worktrees exist from the coordinated thread's scratch
  practice (`oi-desktop`, `oi-wave6`, `oi-repair`) plus this session's own
  scratch (`/private/tmp/oi-u33-remember`). Reported, not silently cleaned;
  the primary checkout stays untouched on the owner's site branch.
