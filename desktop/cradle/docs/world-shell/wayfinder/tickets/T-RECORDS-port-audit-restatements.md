# T-RECORDS — the port audit's record corrections, the vendor overlays labelled, the Expressions status reclassified

FOUNDATION §4 "Can start now" (records) and F0 ("correct the overstated
records"). PORT-AUDIT §E 1–12. Builder: Haiku (mechanical). Wave 1, 14 Oct 2026.

## Rule for every restatement

A restatement says what is true now, in one or two plain sentences, with the
evidence path the audit gives. It never deletes the history: where a record
has a status field, set the status and add a dated note
(`2026-10-14: restated by PORT-AUDIT §E<n> — …`). No product code changes
except the comment and string lines named below.

## Items (PORT-AUDIT §E, `desktop/cradle/docs/world-shell/audit-20261014/PORT-AUDIT.md` lines 223–256)

1. `wayfinder/tickets/T-ATLAS-PROVIDER-founding-provider-through-central.md`
   (its "a scratch run … loaded 2,854 occurrences" passage): the provider has
   never loaded the real field through its declared path; Central refuses
   `field.json` (4 MiB text bound). Add: the field is now N3 (FOUNDATION §3),
   the suite's data model, not AE's corpus.
2. `wayfinder/tickets/T-ATLAS-HOST-earth-projection-in-the-shell.md` "Code
   landed": the Earth has never been seen natively; the only rendering was the
   fixture harness (`atlas/dev/main.ts:8`).
3. `packages/live-shell/ui/src/projections/atlas/provider/skyProvider.ts`
   header (line ~124, "the atlas's own generated sky stays corpus-side with its
   provider"): no provider supplies the sky grid; Sky mode is unbound until
   N3's QL sky producer. Comment-only change.
4. Skip (`globe/earth.ts` comment belongs to T-ATLAS-ASSETS).
5. `desktop/cradle/expressions-app/vendor/research-canvas/PROVENANCE.json`
   `scope`: keep the sentence about the 130 `files`, and add that the 30
   `overlays` under `packages/canvas/src/**` are port-new modules written by
   lanes 1–5, with no upstream at any revision. Add a field
   `"overlays_standing": "port-new — authored in O-I lanes 1–5, not upstream"`
   (or the file's existing per-overlay shape if it has one). Do not move files.
6. `desktop/cradle/docs/world-shell/EXPRESSIONS-PORT-STATUS.json`: restate
   `standing` so `ported` means "a shell React home plus a boundary op, read
   statically"; every row stays `live_replay: pending-native-stack`. The rows
   whose reason says `save_as` "which the shell cannot call" become
   `shell-wiring-gap` with the note "save_as, fork and create exist
   (kernel expression.rs:907) and are relayed (expressions-boundary
   protocol.ts:18, host.ts:248); T-EXPRESSIONS-OPEN wires them". Recount
   `counts` from the rows after the change; the counts must equal the rows.
7. `FUNCTIONAL-CROSSWALK.json` (find it under `desktop/cradle/docs/world-shell/`):
   add a top-level `standing` note that the shell destinations name lens-bar
   entries which, in Technē, open the shell's World cut, the atlas or disabled
   buttons — not the frame instruments the targets were built in; the targets
   are re-homed after F2–F5 (FOUNDATION §8).
8. Already restated in `LEGACY-CRADLE-RETIREMENT.md` gate 3 (commit
   `3718109f7`) — check it says the migration has never run; fix only if not.
9. Wherever `port-ledger.test.mjs` "3 of 3 pass" is cited as gate evidence
   (grep `desktop/cradle/docs/world-shell`), add that it checks the ledger's
   shape, not behaviour.
10. Skip (`live/liveChain.ts` and `panels/devices-b2` are being removed by
    the lead).
11. Skip (`FORK_REASON` is T-EXPRESSIONS-OPEN's).
12. `packages/live-shell/ui/src/shell/modeGrammar.ts:446–447` "Earth places —
    the Atlas port's surface. Waits for the Places owner": the atlas is
    registered; what waits is its data (N3). String-only change.

Also (FOUNDATION §8): in `desktop/cradle/docs/world-shell/targets.json` and
`ACCEPTANCE-CHECKPOINT.md`, add a dated standing note that "implemented: 125"
counts frame code, mostly unreachable from the candidate (PORT-AUDIT B2), and
that each target is re-homed with `home` and `owner_op` after F2–F5. Do not
change any per-target value, and do not run `acceptance.py` to re-record its
basis (PATH §9 forbids it without a dated note of what changed — if a test
re-hashes targets.json, report it in OPEN instead).

## Zone

- `desktop/cradle/docs/world-shell/**` except `wayfinder/PATH.md`,
  `wayfinder/FOUNDATION.md`, `wayfinder/EXECUTE.md`, `audit-20261014/**`
- `desktop/cradle/expressions-app/vendor/research-canvas/PROVENANCE.json`
- `packages/live-shell/ui/src/projections/atlas/provider/skyProvider.ts` (comment only)
- `packages/live-shell/ui/src/shell/modeGrammar.ts` (the one string at 446–447)

## Done when

Every item above is restated or reported skipped with its reason; the JSON
files still parse; these pass from the seat:
- `node --test desktop/cradle/tests/conformance/*.test.mjs` (run in `desktop/cradle`)
- `node --experimental-strip-types --test tests/mode-grammar*.test.mjs tests/atlas-*.test.mjs`
  in `packages/live-shell/ui` (whatever exists of those names)
- `(cd packages/live-shell/ui && npx tsc --noEmit -p .)`
- any test that reads `EXPRESSIONS-PORT-STATUS.json`, `PROVENANCE.json` or
  `targets.json` (grep `desktop/cradle/tests`, `desktop/cradle/expressions-app`
  and `packages/live-shell/ui/tests` for the file names and run what you find).
