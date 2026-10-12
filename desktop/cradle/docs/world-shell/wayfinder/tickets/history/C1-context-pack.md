# C1 — Context pack: pin the port sources and standards

Label: wayfinder:research (AFK)
Claimed-by: zcode:context-pack-c1 (dispatched by orchestrator zcode:world-shell-orchestrator, 9 Oct)

## Resolution — 2026-10-09 (zcode:context-pack-c1, converged by orchestrator)

Delivered `wayfinder/CONTEXT-PACK.md` (1017 lines, four commissioned sections
+ a verification record). Atlas pinned at `fbdb9e9f` — 19 commits past the
commission's `932b360`; hash spot-checked by the orchestrator against the
pinned content (field.ts `f211ede9…` exact). Findings that correct standing
records:

- **Atlas grew a sky subsystem after `932b360`** (globe 10 files not 7;
  `state/timeModel.ts` exists; controller at `src/app/controller.ts`; aion
  5 files) — design §3.1's "the Atlas has no ephemeris code" is stale at
  HEAD.
- **`DEVICE_FAMILIES` no longer exists in the seat** — superseded by
  `EXPRESSIONS_FAMILIES` (`packages/expressions-boundary/src/expressionsFamilies.ts`).
- **QL capability-matrix path moved** to `docs/integrations/epi-logos/…`;
  matrices live at three grounds (QL field index 185 obligations unaccepted;
  O-I 166-capability; new-shell browser-taxonomy 68 cells).
- **Sky contract verified line-by-line**: `ql.sky-request/v1` →
  `ql.sky-snapshot/v1`, ten bodies / nine non-Sun operators / **seven
  receiving centres** (the commission's "seven centuries" was a
  mis-transcription; epoch range [1800,2400)), Earth anchor `#2-5-0/1-0`
  outside the array; contract of record
  `Work/Quaternal-Logic/docs/kernel-rebuild/K8-SKY-CONTRACT.md`.
- Port ledger counts confirmed past the contract's wave-4 numbers (136/33/4/11).

Errata appended by the orchestrator: HEAD has moved past the pin
(`606fbe6` at 01:23, curation lane active) — §5 of the pack already
instructs re-pinning; L5 re-pins at its own start.

Receipt note: the lane's protocol receipt was owed as its first message and
was delivered with its final report instead; the lane names this itself.
Spot-checked content is sound. Status: resolved. **L5's Blocked-by is now
fully closed.**
Blocked-by: —

## Question

Pin the exact sources every lane ports from and validates against, so no lane
ever works from memory:

1. Archetypal-Earth module inventory — for each of `src/globe/*` (engine,
   earth, tiles, controls, presences, arcs, shaders), `src/graph/*` (build,
   view, tools, switch), `src/state/*` (store, router, controller),
   `src/aion/*` (model, view), `src/data/time.ts`, `src/types/field.ts`,
   `scripts/images.mjs`: exact path, exports, internal dependencies, sha256,
   and "what it needs from its host".
2. QL sky contract — `providers/sky/kerykeion_snapshot.py` and its contract
   document: what the Earth projection's sky layer binds from.
3. Widget catalogue — every component form in `new-shell/agent-shell-mockup.html`
   (devices, racks, chains, knobs, lights, transport, clip tabs, browser pool),
   with its behaviours.
4. The port ledger shape (`EXPRESSIONS-PORT-STATUS.json`), the existing device
   face registry, the capability matrices' location and current cells, and the
   governing documents list.

## Evidence / acceptance

`wayfinder/CONTEXT-PACK.md` complete: every path verified to exist, hashes
recorded, atlas repo pinned at its current HEAD. No corpus data copied into
the pack. A lane that cites the pack never needs to re-derive a source.
