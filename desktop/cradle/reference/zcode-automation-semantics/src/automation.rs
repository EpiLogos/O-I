//! The automations dispatch state machine, recreated from the behavior spec
//! (§4 trigger loop, §5 dispatch machine, §5.1 late/missed semantics, §6 lifecycle).
//!
//! Pure transitions over the documented state; storage, IPC and the scheduler
//! process are the host's concern. Every constant below is pinned by the spec
//! and corroborated by the live-store observation recorded in the study.

use crate::cron::CronExpr;
use crate::rule::ScheduleRule;

// — Documented constants (spec §4–§6) —
/// Scheduler tick: `setInterval(requestTick, 20_000)` plus an immediate tick at
/// startup and on wake messages.
pub const TICK_MS: i64 = 20_000;
/// Retry backoff base: `min(30s * 2^(n-1), 15 min)` with n the attempt number
/// (1-based) after increment.
pub const RETRY_BASE_MS: i64 = 30_000;
pub const RETRY_CAP_MS: i64 = 900_000;
/// Maximum dispatch attempts per slot, then give-up.
pub const MAX_DISPATCH_ATTEMPTS: u32 = 5;
/// Late-fire window: a slot older than 5 minutes when claimed (and not
/// retrying) is skipped, not fired.
pub const LATE_WINDOW_MS: i64 = 300_000;
/// A claim older than 10 minutes is stale and reclaimed.
pub const STALE_CLAIM_MS: i64 = 600_000;
/// Hard cap on stored automations, including paused/completed/failed.
pub const AUTOMATION_CAP: usize = 20;
/// Creation-time staleness for a one-shot whose absolute slot already passed:
/// < 60 s late starts immediately; 1–30 min is the stale-schedule error;
/// > 30 min is treated as a future schedule.
pub const CREATION_LATE_GRACE_MS: i64 = 60_000;
pub const CREATION_STALE_MAX_MS: i64 = 1_800_000;

pub const SKIP_REASON_ASLEEP: &str = "computer_asleep_or_app_not_running";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DispatchStatus {
    Idle,
    Claimed,
    Dispatched,
    FailedToDispatch,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Lifecycle {
    Active,
    Paused,
    Completed,
    Failed,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Trigger {
    Schedule,
    Manual,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RunDispatch {
    Claimed,
    Dispatched,
    FailedToDispatch,
    Skipped,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Outcome {
    Running,
    Succeeded,
    Failed,
    Stopped,
}

/// The schedule carriers, rule-wins-when-present (spec §2.3).
#[derive(Debug, Clone)]
pub enum Schedule {
    Rule(ScheduleRule),
    Cron(CronExpr),
}

impl Schedule {
    pub fn next_after(&self, t: i64) -> Option<i64> {
        match self {
            Schedule::Rule(r) => r.next_run_at(t),
            Schedule::Cron(c) => c.next_run_at(t),
        }
    }
}

/// The `automations` row, projected to the fields the semantics touch.
#[derive(Debug, Clone)]
pub struct Automation {
    pub automation_id: String,
    pub schedule: Schedule,
    pub recurring: bool,
    pub max_runs: Option<u32>,
    pub enabled: bool,
    pub lifecycle: Lifecycle,
    pub end_at: Option<i64>,
    pub run_count: u64,
    pub scheduled_run_count: u64,
    pub next_run_at: Option<i64>,
    pub last_run_at: Option<i64>,
    pub running: bool,
    pub claimed_at: Option<i64>,
    pub dispatch_status: DispatchStatus,
    pub dispatch_attempts: u32,
    pub retry_at: Option<i64>,
    pub last_error: Option<String>,
}

/// The `automation_runs` ledger row.
#[derive(Debug, Clone)]
pub struct RunRecord {
    pub run_id: String,
    pub automation_id: String,
    pub scheduled_at: i64,
    pub trigger: Trigger,
    pub dispatch: RunDispatch,
    pub outcome: Outcome,
    pub session_id: Option<String>,
    pub error: Option<String>,
    pub attempts: u32,
}

impl RunRecord {
    /// SPEC: scheduled run ids are `<automation_id>:<scheduled_at>`;
    /// manual runs append `manual:<opaque>`.
    pub fn scheduled_id(automation_id: &str, scheduled_at: i64) -> String {
        format!("{automation_id}:{scheduled_at}")
    }
    pub fn manual_id(automation_id: &str, opaque: &str) -> String {
        format!("{automation_id}:manual:{opaque}")
    }
}

impl Automation {
    /// SPEC: `!recurring && (max_runs ?? 1) <= 1`.
    pub fn is_one_shot(&self) -> bool {
        !self.recurring && self.max_runs.unwrap_or(1) <= 1
    }

    /// The slot a claim resolves to: `nextRunAt ?? retryAt ?? now`.
    pub fn resolve_scheduled_at(&self, now: i64) -> i64 {
        self.next_run_at.or(self.retry_at).unwrap_or(now)
    }

    fn release_claim(&mut self) {
        self.running = false;
        self.claimed_at = None;
    }

    /// Completion rule (spec §5/§6): one-shot whose `scheduled_run_count`
    /// reached `max_runs ?? 1`, or whose next slot passed `end_at`.
    /// On completion: `lifecycle=completed, enabled=0, next_run_at=NULL`.
    fn complete_if_done(&mut self, at: i64) {
        let one_shot_done = !self.recurring && self.scheduled_run_count >= self.max_runs.unwrap_or(1) as u64;
        let past_end = matches!((self.end_at, self.next_run_at), (Some(end), Some(next)) if next > end)
            || matches!((self.end_at, self.next_run_at), (Some(end), None) if at > end);
        if one_shot_done || past_end {
            self.lifecycle = Lifecycle::Completed;
            self.enabled = false;
            self.next_run_at = None;
        }
    }
}

/// One claimed automation handed to dispatch by a tick.
#[derive(Debug, Clone)]
pub struct Claim {
    pub automation_id: String,
    pub scheduled_at: i64,
}

/// The due sweep a single 20-second tick performs (spec §4), in order:
/// 1. `end_at` expiry completes expired automations;
/// 2. stale claims (older than 10 min) are reclaimed;
/// 3. due automations are CAS-claimed (`running` 0→1 must hold).
///
/// The reference store is the caller's `Vec<Automation>`; ordering within the
/// due select is input order (the spec does not document a scheduling order).
pub fn claim_due(store: &mut [Automation], now: i64) -> Vec<Claim> {
    for a in store.iter_mut() {
        // 1. end_at expiry
        if a.enabled && a.lifecycle == Lifecycle::Active {
            if let Some(end) = a.end_at {
                if end < now {
                    a.lifecycle = Lifecycle::Completed;
                    a.enabled = false;
                    a.next_run_at = None;
                }
            }
        }
        // 2. stale-claim recovery
        if a.running && a.claimed_at.map(|c| c <= now - STALE_CLAIM_MS).unwrap_or(false) {
            a.release_claim();
        }
    }
    let mut claims = Vec::new();
    for a in store.iter_mut() {
        // 3. due query: enabled AND running=0 AND (retry due OR next slot due)
        if !a.enabled || a.running || a.lifecycle == Lifecycle::Completed {
            continue;
        }
        let due = if let Some(retry) = a.retry_at {
            retry <= now
        } else {
            a.next_run_at.map(|n| n <= now).unwrap_or(false)
        };
        if !due {
            continue;
        }
        // CAS claim: unconditional here because the sweep is single-threaded,
        // but modeled as the guarded update (`WHERE running=0` must change 1 row).
        if a.running {
            continue;
        }
        a.running = true;
        a.claimed_at = Some(now);
        a.dispatch_status = DispatchStatus::Claimed;
        let scheduled_at = a.resolve_scheduled_at(now);
        claims.push(Claim { automation_id: a.automation_id.clone(), scheduled_at });
    }
    claims
}

/// The late/missed check on a claimed automation (spec §5.1). When the slot is
/// older than 5 minutes and the automation is not retrying
/// (`dispatch_attempts == 0`), the run is skipped: one `skipped` ledger row
/// carrying the reason, the slot advances to the next occurrence, the claim
/// releases, attempts reset — and `last_error` is NOT cleared. A one-shot
/// finalizes (completes) instead of advancing. Missed slots coalesce: the
/// ledger records only the latest missed slot.
pub fn handle_claimed(a: &mut Automation, ledger: &mut Vec<RunRecord>, now: i64) {
    let slot = a.resolve_scheduled_at(now);
    let late = now - slot > LATE_WINDOW_MS;
    if late && a.dispatch_attempts == 0 {
        skip_and_reschedule(a, ledger, slot, now);
    }
    // Otherwise the caller proceeds to dispatch (`attempts+1` ledger upsert
    // happens there); the late-but-within-window case fires normally.
}

/// Coalesce-and-skip: advance past every slot older than the late window and
/// write ONE skipped row for the latest missed slot (spec §5.1: "multiple
/// missed slots collapse into one skipped row for the latest slot only").
/// The cursor lands on the first slot not older than the window.
pub fn skip_and_reschedule(a: &mut Automation, ledger: &mut Vec<RunRecord>, first_missed_slot: i64, now: i64) {
    // Collapse: step the schedule forward through every slot older than the
    // window, remembering the latest missed one.
    let mut latest = first_missed_slot;
    loop {
        match a.schedule.next_after(latest) {
            Some(next) if now - next > LATE_WINDOW_MS => latest = next,
            _ => break,
        }
    }
    ledger.push(RunRecord {
        run_id: RunRecord::scheduled_id(&a.automation_id, latest),
        automation_id: a.automation_id.clone(),
        scheduled_at: latest,
        trigger: Trigger::Schedule,
        dispatch: RunDispatch::Skipped,
        outcome: Outcome::Failed,
        session_id: None,
        error: Some(SKIP_REASON_ASLEEP.to_string()),
        attempts: 0,
    });
    a.release_claim();
    a.dispatch_status = DispatchStatus::Idle;
    a.dispatch_attempts = 0;
    a.retry_at = None;
    if a.is_one_shot() {
        a.lifecycle = Lifecycle::Completed;
        a.enabled = false;
        a.next_run_at = None;
    } else {
        a.next_run_at = a.schedule.next_after(latest);
        a.complete_if_done(now);
        if a.lifecycle == Lifecycle::Completed {
            a.enabled = false;
            a.next_run_at = None;
        }
    }
}

/// Successful dispatch (spec §5 `markDispatched`): release the claim, reset the
/// slot's retry state, advance the schedule cursor, bump both counters, stamp
/// `last_run_at` — then apply the completion rule. The ledger row flips to
/// `dispatched` with `outcome=running`; the terminal outcome arrives later
/// from the session side.
pub fn mark_dispatched(a: &mut Automation, ledger: &mut Vec<RunRecord>, slot: i64, now: i64, session_id: Option<&str>) {
    a.release_claim();
    a.dispatch_status = DispatchStatus::Dispatched;
    a.dispatch_attempts = 0;
    a.retry_at = None;
    a.last_error = None;
    a.next_run_at = a.schedule.next_after(slot);
    a.run_count += 1;
    a.scheduled_run_count += 1;
    a.last_run_at = Some(now);
    if let Some(row) = ledger.iter_mut().find(|r| r.run_id == RunRecord::scheduled_id(&a.automation_id, slot)) {
        row.dispatch = RunDispatch::Dispatched;
        row.outcome = Outcome::Running;
        row.session_id = session_id.map(|s| s.to_string());
    } else {
        ledger.push(RunRecord {
            run_id: RunRecord::scheduled_id(&a.automation_id, slot),
            automation_id: a.automation_id.clone(),
            scheduled_at: slot,
            trigger: Trigger::Schedule,
            dispatch: RunDispatch::Dispatched,
            outcome: Outcome::Running,
            session_id: session_id.map(|s| s.to_string()),
            error: None,
            attempts: 0,
        });
    }
    a.complete_if_done(now);
    if a.lifecycle == Lifecycle::Completed {
        a.enabled = false;
        a.next_run_at = None;
    }
}

/// Session-side terminal outcome for a dispatched run (spec §8): the
/// transient `running` marker never overwrites a terminal outcome.
pub fn set_run_outcome(ledger: &mut [RunRecord], run_id: &str, outcome: Outcome) {
    if let Some(row) = ledger.iter_mut().find(|r| r.run_id == run_id) {
        if row.outcome != Outcome::Running {
            return;
        }
        row.outcome = outcome;
    }
}

/// What a dispatch failure does (spec §5): attempts below the cap schedule a
/// retry (`failed_to_dispatch`, `retry_at = now + min(30s*2^(n-1), 15min)`);
/// at the cap, give-up — recurring returns to `idle` with the slot advanced
/// and `last_error` kept; a one-shot fails terminally (`enabled=0`).
pub enum FailureEffect {
    Retry { retry_at: i64 },
    GaveUpRecurring,
    FailedOneShot,
}

pub fn on_dispatch_failure(a: &mut Automation, ledger: &mut Vec<RunRecord>, slot: i64, now: i64, error: &str) -> FailureEffect {
    let attempt = a.dispatch_attempts + 1;
    a.dispatch_attempts = attempt;
    let run_id = RunRecord::scheduled_id(&a.automation_id, slot);
    if let Some(row) = ledger.iter_mut().find(|r| r.run_id == run_id) {
        row.dispatch = RunDispatch::FailedToDispatch;
        row.error = Some(error.to_string());
        row.attempts = attempt - 1; // 0-based: after N claims the row shows N-1
    }
    a.release_claim();
    a.last_error = Some(error.to_string());
    if attempt >= MAX_DISPATCH_ATTEMPTS {
        a.retry_at = None;
        if a.is_one_shot() {
            a.lifecycle = Lifecycle::Failed;
            a.enabled = false;
            a.dispatch_status = DispatchStatus::FailedToDispatch;
            FailureEffect::FailedOneShot
        } else {
            a.dispatch_status = DispatchStatus::Idle;
            a.dispatch_attempts = 0;
            a.next_run_at = a.schedule.next_after(slot);
            a.complete_if_done(now);
            if a.lifecycle == Lifecycle::Completed {
                a.enabled = false;
                a.next_run_at = None;
            }
            FailureEffect::GaveUpRecurring
        }
    } else {
        let backoff = RETRY_BASE_MS
            .saturating_mul(1i64 << (attempt - 1).min(62))
            .min(RETRY_CAP_MS);
        let retry_at = now + backoff;
        a.retry_at = Some(retry_at);
        a.dispatch_status = DispatchStatus::FailedToDispatch;
        FailureEffect::Retry { retry_at }
    }
}

/// Creation-time staleness for one-shots with an absolute slot (spec §5.1):
/// `< 60s` late starts immediately; `1–30 min` late is the
/// `StaleOneShotAutomationScheduleError`; `> 30 min` is treated as a future
/// schedule (the slot simply sits until the normal skip logic sees it).
pub enum CreationStaleness {
    StartImmediately,
    StaleOneShotSchedule,
    Future,
}

pub fn creation_staleness(now: i64, slot: i64) -> CreationStaleness {
    let late = now - slot;
    if late <= 0 {
        // The slot is still ahead of the clock — a future schedule.
        CreationStaleness::Future
    } else if late < CREATION_LATE_GRACE_MS {
        CreationStaleness::StartImmediately
    } else if late <= CREATION_STALE_MAX_MS {
        CreationStaleness::StaleOneShotSchedule
    } else {
        CreationStaleness::Future
    }
}

/// Run-now (spec §6): CAS-claims (a second runNow while running is a
/// duplicate), inserts a manual run (`attempts=1`), bumps `run_count` only —
/// manual dispatches never exhaust `max_runs`.
pub fn run_now(a: &mut Automation, ledger: &mut Vec<RunRecord>, now: i64, opaque: &str) -> Result<String, &'static str> {
    if a.running {
        return Err("duplicate");
    }
    a.running = true;
    a.claimed_at = Some(now);
    let run_id = RunRecord::manual_id(&a.automation_id, opaque);
    ledger.push(RunRecord {
        run_id: run_id.clone(),
        automation_id: a.automation_id.clone(),
        scheduled_at: now,
        trigger: Trigger::Manual,
        dispatch: RunDispatch::Claimed,
        outcome: Outcome::Running,
        session_id: None,
        error: None,
        attempts: 1,
    });
    Ok(run_id)
}

/// Restart (spec §6, the 重新启动 affordance): a fresh bounded run — counters
/// reset, retry state cleared, `active` again, cursor recomputed.
pub fn restart(a: &mut Automation, now: i64) {
    a.run_count = 0;
    a.scheduled_run_count = 0;
    a.dispatch_attempts = 0;
    a.retry_at = None;
    a.last_error = None;
    a.release_claim();
    a.dispatch_status = DispatchStatus::Idle;
    a.lifecycle = Lifecycle::Active;
    a.enabled = true;
    a.next_run_at = a.schedule.next_after(now);
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::rule::relative_delay_slot;
    use std::str::FromStr;

    fn t(y: i64, mo: u32, d: u32, h: u32, mi: u32) -> i64 {
        crate::civil::epoch_ms_of(y, mo, d, h, mi)
    }

    fn one_shot_cron(expr: &str, id: &str) -> Automation {
        Automation {
            automation_id: id.to_string(),
            schedule: Schedule::Cron(CronExpr::from_str(expr).unwrap()),
            recurring: false,
            max_runs: None,
            enabled: true,
            lifecycle: Lifecycle::Active,
            end_at: None,
            run_count: 0,
            scheduled_run_count: 0,
            next_run_at: None,
            last_run_at: None,
            running: false,
            claimed_at: None,
            dispatch_status: DispatchStatus::Idle,
            dispatch_attempts: 0,
            retry_at: None,
            last_error: None,
        }
    }

    /// Replays the live probe of 2026-10-07 01:31–01:38 (+0100): a 3-minute
    /// relative-delay one-shot; the scheduler claimed 6.8 s after the slot and
    /// the automation completed on dispatch.
    #[test]
    fn live_probe_replay_one_shot_completes_on_dispatch() {
        let anchor = t(2026, 10, 7, 1, 31) + 1_391;
        let (slot, rule) = relative_delay_slot(anchor, 3);
        assert_eq!(slot, anchor + 180_000);
        let mut a = Automation {
            automation_id: "automation-faa4d02a".into(),
            schedule: Schedule::Rule(rule),
            recurring: false,
            max_runs: None,
            enabled: true,
            lifecycle: Lifecycle::Active,
            end_at: None,
            run_count: 0,
            scheduled_run_count: 0,
            next_run_at: Some(slot),
            last_run_at: None,
            running: false,
            claimed_at: None,
            dispatch_status: DispatchStatus::Idle,
            dispatch_attempts: 0,
            retry_at: None,
            last_error: None,
        };
        let mut ledger = Vec::new();
        let now_claim = slot + 6_829; // live: run row created 6.8 s after slot
        let claims = claim_due(std::slice::from_mut(&mut a), now_claim);
        assert_eq!(claims.len(), 1);
        assert_eq!(claims[0].scheduled_at, slot);
        assert_eq!(a.dispatch_status, DispatchStatus::Claimed);
        handle_claimed(&mut a, &mut ledger, now_claim);
        assert!(ledger.is_empty(), "fresh slot must not skip");
        mark_dispatched(&mut a, &mut ledger, slot, now_claim + 955, Some("sess_live"));
        assert_eq!(a.lifecycle, Lifecycle::Completed, "one-shot completes on dispatch");
        assert!(!a.enabled);
        assert_eq!(a.next_run_at, None);
        assert_eq!(a.run_count, 1);
        assert_eq!(a.scheduled_run_count, 1);
        assert_eq!(ledger.len(), 1);
        assert_eq!(ledger[0].dispatch, RunDispatch::Dispatched);
        assert_eq!(ledger[0].outcome, Outcome::Running);
        let run_id = ledger[0].run_id.clone();
        set_run_outcome(&mut ledger, &run_id, Outcome::Succeeded);
        assert_eq!(ledger[0].outcome, Outcome::Succeeded);
        // Terminal outcomes are never overwritten by a stray `running` write.
        set_run_outcome(&mut ledger, &run_id, Outcome::Running);
        assert_eq!(ledger[0].outcome, Outcome::Succeeded);
    }

    #[test]
    fn late_within_window_fires() {
        let mut a = one_shot_cron("0 9 * * 1", "late-ok");
        a.next_run_at = Some(t(2026, 10, 5, 9, 0)); // Monday 09:00
        let mut ledger = Vec::new();
        let now = t(2026, 10, 5, 9, 4); // 4 minutes late — inside the window
        claim_due(std::slice::from_mut(&mut a), now);
        handle_claimed(&mut a, &mut ledger, now);
        assert!(ledger.is_empty(), "within the 5-minute window the run fires");
        mark_dispatched(&mut a, &mut ledger, t(2026, 10, 5, 9, 0), now, None);
        assert_eq!(a.lifecycle, Lifecycle::Completed);
    }

    #[test]
    fn late_beyond_window_skips_with_reason_and_one_shot_finalizes() {
        let mut a = one_shot_cron("0 9 * * 1", "skip-1");
        a.next_run_at = Some(t(2026, 10, 5, 9, 0));
        let mut ledger = Vec::new();
        let now = t(2026, 10, 5, 9, 32); // 32 minutes late — the live observed case
        claim_due(std::slice::from_mut(&mut a), now);
        handle_claimed(&mut a, &mut ledger, now);
        assert_eq!(ledger.len(), 1);
        assert_eq!(ledger[0].dispatch, RunDispatch::Skipped);
        assert_eq!(ledger[0].error.as_deref(), Some(SKIP_REASON_ASLEEP));
        assert_eq!(ledger[0].attempts, 0);
        assert_eq!(a.dispatch_status, DispatchStatus::Idle);
        assert_eq!(a.dispatch_attempts, 0);
        assert!(!a.enabled, "one-shot finalizes after skip");
        assert_eq!(a.lifecycle, Lifecycle::Completed);
        assert!(a.last_error.is_none());
    }

    #[test]
    fn recurring_missed_slots_coalesce_to_next_slot() {
        let mut a = one_shot_cron("0 9 * * 1", "coal");
        a.recurring = true; // weekly Mondays 09:00, recurring
        a.max_runs = None;
        a.next_run_at = Some(t(2026, 10, 5, 9, 0));
        let mut ledger = Vec::new();
        // App slept two full weeks: claims during the week of Oct 19.
        let now = t(2026, 10, 21, 12, 0);
        claim_due(std::slice::from_mut(&mut a), now);
        handle_claimed(&mut a, &mut ledger, now);
        assert_eq!(ledger.len(), 1, "missed slots collapse into one skipped row");
        assert_eq!(ledger[0].scheduled_at, t(2026, 10, 19, 9, 0), "the latest missed slot, not the oldest");
        assert_eq!(a.next_run_at, Some(t(2026, 10, 26, 9, 0)), "cursor advances to next occurrence");
        assert!(a.enabled && a.lifecycle == Lifecycle::Active);
    }

    #[test]
    fn retry_backoff_schedule_and_give_up() {
        let mut a = one_shot_cron("0 9 * * 1", "retry");
        a.recurring = true;
        a.next_run_at = Some(t(2026, 10, 5, 9, 0));
        let mut ledger: Vec<RunRecord> = Vec::new();
        let mut now = t(2026, 10, 5, 9, 0);
        let mut slot;
        let mut gave_up = false;
        // Drive claim→fail cycles until the documented give-up on the 5th attempt.
        for _ in 0..5 {
            let claims = claim_due(std::slice::from_mut(&mut a), now);
            assert_eq!(claims.len(), 1, "retrying automation must be due");
            slot = claims[0].scheduled_at;
            // Ledger rows are upserted per slot (attempts+1 on conflict), never duplicated.
            let run_id = RunRecord::scheduled_id(&a.automation_id, slot);
            if !ledger.iter().any(|r| r.run_id == run_id) {
                ledger.push(RunRecord {
                    run_id,
                    automation_id: a.automation_id.clone(),
                    scheduled_at: slot,
                    trigger: Trigger::Schedule,
                    dispatch: RunDispatch::Claimed,
                    outcome: Outcome::Running,
                    session_id: None,
                    error: None,
                    attempts: 0,
                });
            }
            let effect = on_dispatch_failure(&mut a, &mut ledger, slot, now, "model unavailable");
            match effect {
                FailureEffect::Retry { retry_at } => now = retry_at + 1,
                FailureEffect::GaveUpRecurring => {
                    gave_up = true;
                    break;
                }
                FailureEffect::FailedOneShot => break,
            }
        }
        assert!(gave_up);
        assert_eq!(a.dispatch_attempts, 0, "give-up resets the retry counter");
        assert_eq!(a.dispatch_status, DispatchStatus::Idle);
        assert_eq!(a.last_error.as_deref(), Some("model unavailable"), "last_error survives give-up");
        assert_eq!(a.next_run_at, Some(t(2026, 10, 12, 9, 0)), "slot advanced");
        assert!(a.enabled);
        let failed: Vec<&RunRecord> = ledger.iter().filter(|r| r.dispatch == RunDispatch::FailedToDispatch).collect();
        assert_eq!(failed.len(), 1, "one ledger row per slot, retried in place");
        assert_eq!(failed[0].attempts, 4, "ledger attempts counter is 0-based after 5 claims");
        // The advanced slot is due and claimable again; its ledger row is
        // created by the dispatch path's upsert when that run starts.
        let now2 = t(2026, 10, 12, 9, 0);
        let claims = claim_due(std::slice::from_mut(&mut a), now2);
        assert_eq!(claims.len(), 1);
        assert_eq!(claims[0].scheduled_at, t(2026, 10, 12, 9, 0));
    }

    #[test]
    fn one_shot_gives_up_failed() {
        let mut a = one_shot_cron("0 9 * * 1", "giveup-1");
        a.next_run_at = Some(t(2026, 10, 5, 9, 0));
        let mut ledger = Vec::new();
        let slot = a.next_run_at.unwrap();
        let mut now = slot;
        ledger.push(RunRecord {
            run_id: RunRecord::scheduled_id(&a.automation_id, slot),
            automation_id: a.automation_id.clone(),
            scheduled_at: slot,
            trigger: Trigger::Schedule,
            dispatch: RunDispatch::Claimed,
            outcome: Outcome::Running,
            session_id: None,
            error: None,
            attempts: 0,
        });
        for _ in 0..11 {
            if a.running {
                let e = on_dispatch_failure(&mut a, &mut ledger, slot, now, "boom");
                if matches!(e, FailureEffect::FailedOneShot) {
                    break;
                }
                if let FailureEffect::Retry { retry_at } = e {
                    now = retry_at + 1;
                }
            } else {
                claim_due(std::slice::from_mut(&mut a), now);
            }
        }
        assert_eq!(a.lifecycle, Lifecycle::Failed);
        assert!(!a.enabled);
        assert_eq!(a.dispatch_status, DispatchStatus::FailedToDispatch);
    }

    #[test]
    fn end_at_expiry_completes_at_claim_sweep() {
        let mut a = one_shot_cron("0 9 * * 1", "endat");
        a.recurring = true;
        a.end_at = Some(t(2026, 10, 6, 0, 0));
        a.next_run_at = Some(t(2026, 10, 12, 9, 0));
        let now = t(2026, 10, 7, 0, 0);
        let claims = claim_due(std::slice::from_mut(&mut a), now);
        assert!(claims.is_empty());
        assert_eq!(a.lifecycle, Lifecycle::Completed);
        assert!(!a.enabled);
        assert_eq!(a.next_run_at, None);
    }

    #[test]
    fn stale_claim_reclaimed_after_ten_minutes() {
        let mut a = one_shot_cron("0 9 * * 1", "stale");
        a.recurring = true;
        a.next_run_at = Some(t(2026, 10, 5, 9, 0));
        let slot = a.next_run_at.unwrap();
        let mut ledger = Vec::new();
        let claim_time = slot;
        claim_due(std::slice::from_mut(&mut a), claim_time);
        assert!(a.running);
        // 9 minutes later: still held.
        claim_due(std::slice::from_mut(&mut a), claim_time + 9 * 60_000);
        assert!(a.running);
        // 11 minutes later: reclaimed and immediately due again.
        let claims = claim_due(std::slice::from_mut(&mut a), claim_time + 11 * 60_000);
        assert_eq!(claims.len(), 1);
        assert_eq!(claims[0].scheduled_at, slot);
        // And it is now 11 minutes late with attempts==0 → skipped, not fired.
        handle_claimed(&mut a, &mut ledger, claim_time + 11 * 60_000);
        assert_eq!(ledger.len(), 1);
        assert_eq!(ledger[0].dispatch, RunDispatch::Skipped);
    }

    #[test]
    fn creation_staleness_boundaries() {
        let slot = t(2026, 10, 7, 12, 0);
        assert!(matches!(creation_staleness(slot - 5_000, slot), CreationStaleness::Future));
        assert!(matches!(creation_staleness(slot + 59_999, slot), CreationStaleness::StartImmediately));
        assert!(matches!(creation_staleness(slot + 60_001, slot), CreationStaleness::StaleOneShotSchedule));
        assert!(matches!(creation_staleness(slot + 1_800_000, slot), CreationStaleness::StaleOneShotSchedule));
        assert!(matches!(creation_staleness(slot + 1_800_001, slot), CreationStaleness::Future));
    }

    #[test]
    fn run_now_is_manual_and_never_exhausts_max_runs() {
        let mut a = one_shot_cron("0 9 * * 1", "manual");
        a.recurring = true;
        a.max_runs = Some(1);
        let mut ledger = Vec::new();
        let now = t(2026, 10, 5, 8, 0);
        let run_id = run_now(&mut a, &mut ledger, now, "opaque-1").unwrap();
        assert!(run_id.ends_with(":manual:opaque-1"));
        assert!(a.running);
        assert_eq!(run_now(&mut a, &mut ledger, now, "opaque-2"), Err("duplicate"));
        assert_eq!(ledger[0].trigger, Trigger::Manual);
        assert_eq!(ledger[0].attempts, 1);
        // Manual success bumps run_count but NOT scheduled_run_count.
        a.release_claim();
        a.run_count += 1;
        assert_eq!(a.run_count, 1);
        assert_eq!(a.scheduled_run_count, 0);
        assert!(a.enabled, "manual dispatches never exhaust max_runs");
    }

    #[test]
    fn restart_resets_for_a_fresh_bounded_run() {
        let (slot, rule) = relative_delay_slot(t(2026, 10, 7, 1, 31), 3);
        let mut a = one_shot_cron("0 9 * * 1", "restart");
        a.schedule = Schedule::Rule(rule);
        a.lifecycle = Lifecycle::Completed;
        a.enabled = false;
        a.run_count = 3;
        a.scheduled_run_count = 3;
        a.last_error = Some("old failure".into());
        restart(&mut a, slot);
        assert_eq!(a.lifecycle, Lifecycle::Active);
        assert!(a.enabled);
        assert_eq!(a.run_count, 0);
        assert_eq!(a.scheduled_run_count, 0);
        assert_eq!(a.last_error, None);
        assert_eq!(a.next_run_at, Some(slot + 180_000));
    }

    #[test]
    fn automation_cap_constant_matches_spec() {
        assert_eq!(AUTOMATION_CAP, 20);
        assert_eq!(TICK_MS, 20_000);
        assert_eq!(LATE_WINDOW_MS, 300_000);
        assert_eq!(STALE_CLAIM_MS, 600_000);
        assert_eq!(MAX_DISPATCH_ATTEMPTS, 5);
        assert_eq!(RETRY_CAP_MS, 900_000);
    }
}
