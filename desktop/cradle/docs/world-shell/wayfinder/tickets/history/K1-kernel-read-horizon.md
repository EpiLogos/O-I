# K1 — Kernel read horizon: the volume lever

Label: wayfinder:task (execution lane — kernel ground)
Claimed-by: zcode:kernel-horizon-k1 (dispatched by orchestrator zcode:world-shell-orchestrator, 9 Oct)

## Resolution — 2026-10-09 (zcode:kernel-horizon-k1; converged by orchestrator)

**Cost finding (measured):** `temporal_events_read` spawned **~114 serial
`oi central` processes per read** — `central.now.thoughts.read` ×109 (one
per clearing), `central.now.list` ×2 (same register read twice), policy,
files.list, aikit history ×1 each; each wrapper spawn ~0.5 s (the
`oi`→owner wrapper; `ctrl` answers the same envelope in 0.005–0.1 s).
Projection/deep-copy work was microseconds — the cost was all spawns.
Table: `new-shell/evidence/kernel-read-horizon-k1-20261009/COST-TABLE.md`.

**Fix (at the kernel, `desktop/cradle/kernel/src/{flow.rs, owner_read.rs,
temporal_sources.rs, lib.rs}`):** one shared register reading; the 109
thoughts reads over bounded 8-worker fan-out (owner serialises at ~71 ms —
that is the owner-side floor); a 2 s answer cache keyed by exact query
(`read_cache::HORIZON_TTL`, the horizon the acceptance record names);
prepared-read off the kernel mutex (walk-bridge and Tauri host both take
it); additive owner-direct route honouring the documented
`OI_CENTRAL_CTRL_BIN`. Revision-keyed thoughts caching was **tested and
refused as dishonest**: 35 clearings carry `T/` fixtures newer than their
`now.json`, so clearing revision does not cover the thought stream. The
co-worker's temporal WIP is preserved byte-for-byte (two-hand annotated
diff in evidence).

**Measured (same harness: shell's 24 h query through walk-bridge):** before
55.10 / 52.44 / 57.64 s → after **12.81 s** cold (suite route) / **6.85 s**
cold (owner-direct) / **<0.01 s** warm. **Identity byte-equal** — 7 events,
element-wise, same schema/window/civil field; only the observed instants
differ, as they honestly must (`identity-check.json`). Tests: 18/18
temporal (13 existing + 5 new), full kernel suite **287/0/8 ignored**.

**⚠ Commit sequenced, not landed:** the fix layers onto the co-worker's
uncommitted temporal-events hand in `temporal_sources.rs` + `lib.rs` —
staging those files would commit another lane's work, which no lane may do.
The four files stand uncommitted in the seat; **the orchestrator commits
K1's work immediately after the temporal-events co-worker's change lands**,
verifying the joined tree builds and the suite stays green. Recorded
dependency, per this ticket's coordination rule.

**→ COMMIT LANDED (owner ruled the temporal lane done, 9 Oct):**
`92695a963` on `agent/o-i-20261007-1639` — 4 files, +784/−60, both hands
attributed in the message; 18/18 temporal re-verified on the joined tree
immediately before the commit. Stack restarted on the patched binary
(bridge 4179 PID 88442, shell 8788 PID 88740) and measured live:
**cold 11.4 s → warm 1.4 ms** through the real bridge. The full live-suite
needle verification against the patched bridge is deferred only because the
atlas port lane's in-progress import broke the package bundle (fault named
to that lane) — it rides that lane's landing + the orchestrator's
integrated build.

**Remaining acceptance (named):** (1) shell temporal needles verified
against the patched bridge — needs a bridge restart, same sequencing as the
commit; (2) cold ~6.9 s vs the ~2 s target closes only with a **Central
owner-side batch thoughts Action** (out of kernel zone — named on the map
to the Central owners); (3) the shell's 90 s cadence
(`useTemporalEvents.ts`) is shell-lane code, revisitable once the patch is
live; (4) `owner_direct_from_env`'s env-set path measured against the real
ground but unit-tested only via its fallback.

Status: **resolved in code — measurement, identity and tests executed;
commit and live-needle verification sequenced behind the temporal-events
lane's landing.**
Blocked-by: —

Zones: kernel temporal/read-queue sources (O-I kernel crates — named after
reading; the agent shell consumes via `temporal_events_read` on the
walk-bridge).

## Question

The kernel's read queue is the agent shell's known cost driver: the
temporal projection costs ~70 s per call, so the shell windows it to 24 h
at a 90 s cadence as a workaround. The named lever, from the lane that
measured it: **raise the read horizon toward ~2 s.**

- Profile the temporal projection read path and identify where the cost
  lives (queue scan, envelope decode, full-window recompute, serialisation).
- Implement the horizon raise with receipts and identity intact — this is
  a performance change at the native owner, not a consumer workaround.
- Measure before/after with the same harness the 70 s figure came from.

**Coordination rule:** the `temporal_sources.rs` envelope repairs ride a
co-worker's uncommitted temporal WIP. Read the register for that lane,
coordinate before touching the temporal slice, and never commit over their
hand. If the WIP conflicts, sequence after it and record the dependency
here.

## Evidence / acceptance

Measured read latency before/after (the target is order-of-magnitude, not
cosmetic); shell temporal needles verified against the faster horizon; no
receipt or identity regressions; the co-worker coordination recorded.
