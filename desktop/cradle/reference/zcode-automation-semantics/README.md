# zcode-automation-semantics (reference crate)

Clean-room Rust recreation of the ZCode desktop (v3.14.3) automation scheduling
semantics, written from the reverse-engineering study's **behavior specification**
only. No decompiled code was transcribed; the spec it was written from is the
placed study deliverable (`docs/research/zcode-desktop-3.14.3/AUTOMATIONS-SEMANTICS.md`
— see that study directory for every claim's evidence, confidence and
limitations).

**Status: reference, generated-until-adopted.** This crate is NOT wired into the
`oi-cradle-kernel` build and makes no claim on product APIs. Adoption is the
owner's act.

## What's inside

| Module | Recreates | Evidence anchor (spec §) |
|---|---|---|
| `civil` | Naive proleptic-Gregorian calendar math (days-from-civil) | §2.3 note on local-time evaluation |
| `rule` | `schedule_rule` next-run engine: minute / hourly / daily / weekly / monthly(date,weekday) / yearly, documented scan caps | §2.3 |
| `cron` | 5-field cron carrier at the documented grammar (plain ints, comma lists, `*/N`) + `*/N`→minute-interval inference | §2.3 |
| `automation` | Dispatch state machine: due sweep, CAS claim, 10-min stale reclaim, 5-min late window, coalesce-and-skip, retry backoff `min(30s·2^(n−1), 15min)` over 5 attempts, one-shot/`end_at` completion, run-now, restart, run-ledger shapes | §4–§8 |

## Constants (all pinned by the study)

`TICK 20s · RETRY base 30s cap 15min · MAX ATTEMPTS 5 · LATE WINDOW 5min ·
STALE CLAIM 10min · AUTOMATION CAP 20 · CREATION STALENESS <60s fire / 1–30min error / >30min future`

## Verify gates

`cargo test` replays the study's gate behaviors, including a minute-level
replay of the **live probe** performed against the running ZCode store on
2026-10-07 (3-minute relative-delay one-shot: slot exact to the millisecond,
claim within one tick, one-shot completed on dispatch) and the live-observed
**32-minute-late skip** with reason `computer_asleep_or_app_not_running`.

## Known limitations (inherited from the study, not hidden)

- **Timezone/DST**: ZCode evaluates in host-local civil time; this crate is
  TZ-agnostic (naive clock, caller-injected). DST gap/repeat behaviour is
  unmodelled — the study's own open question (spec §10.2).
- **Phase interpretations** at three points where the spec prose admits more
  than one reading (hourly/day/month anchoring; short-month handling; first-
  weekday-of-month) are marked `SPEC-INTERPRETATION` inline and carry medium
  confidence.
- **Rich cron syntax** beyond the documented surface (named months, `?`,
  seconds) is rejected by design — the app's own parsers don't accept it
  (spec §2.3, §10.9).
- Off-peak (idle) queue semantics are documented in the study spec but **not**
  recreated here (server-ticket protocol is a host concern).

## Provenance

- Study: ZCode desktop RE for the O-I cradle, 2026-10-07 (clean-room;
  document-only; evidence + confidence + limitations per claim).
- Author: agent lane under the owner's commissioned study; generated until
  adopted by the owner.
