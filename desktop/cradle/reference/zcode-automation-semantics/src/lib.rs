//! Clean-room Rust recreation of the ZCode desktop (v3.14.3) automation
//! scheduling semantics, written from the reverse-engineering study's behavior
//! specification — not from recovered source.
//!
//! Study of record: "ZCode desktop RE for the O-I cradle", 2026-10-07
//! (behavior spec: automations semantics,
//! `docs/research/zcode-desktop-3.14.3/AUTOMATIONS-SEMANTICS.md` in the O-I
//! repository, with the live-verification addendum in its §11).
//!
//! What is recreated here:
//! - [`rule`] — the `schedule_rule` next-run engine (six units, documented
//!   scan caps, anchored phase semantics; the `minute` unit is live-verified
//!   to the millisecond).
//! - [`cron`] — the 5-field cron carrier at its documented grammar surface
//!   (plain integers, comma lists, `*/N`; ranges as a guarded superset) and
//!   the `*/N` → minute-interval inference.
//! - [`automation`] — the dispatch state machine: due sweep, CAS claim and
//!   stale reclaim, the 5-minute late-fire window with coalesce-and-skip,
//!   retry backoff and give-up, one-shot and `end_at` completion, run-now,
//!   restart, and the run-ledger record shapes.
//!
//! Deliberately NOT recreated: storage (SQLite/WAL), the scheduler process,
//! IPC, off-peak server tickets, UI. Those are host concerns the O-I suite
//! would host differently; see the study's integration map.
//!
//! Status: REFERENCE — generated output of the study, not adopted product
//! code; not wired into the `oi-cradle-kernel` build.

pub mod automation;
pub mod civil;
pub mod cron;
pub mod rule;
