//! The `schedule_rule` engine: next-run computation from the rule carrier.
//!
//! Recreated from the behavior spec (§2.3): ZCode stores two interchangeable
//! carriers — a 5-field cron string and a strict JSON `schedule_rule` — and the
//! rule wins when present. Rule semantics, quoted from the spec:
//!
//! - `minute`: every `interval` minutes from `anchorAt` (pure millisecond stepping).
//! - `hourly`: at `:minute` of every `interval`-th hour, anchored.
//! - `daily`: hour:minute local time, every `interval` days (scan <= 36600 days).
//! - `weekly`: weekdays[] (default [1] = Monday), every `interval` weeks,
//!   Monday-anchored (scan <= 5220 weeks).
//! - `monthly`: `monthlyMode:"weekday"` -> first weekday-of-month pattern
//!   (`weekdays[0] ?? 1`); else `monthDays[]` (default [1]); every `interval`
//!   months (scan <= 1200 months).
//! - `yearly` (fallback): months[0]/monthDays[0], every `interval` years (scan <= 400).
//!
//! Where the spec prose admits more than one phase convention (which instant is
//! "anchored"), the implementation picks the day/month-index phase reading and
//! marks it SPEC-INTERPRETATION inline. The observed live sample pins `minute`
//! exactly: `nextRunAt == anchorAt + interval*60_000` to the millisecond.

use crate::civil;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Unit {
    Minute,
    Hourly,
    Daily,
    Weekly,
    Monthly,
    Yearly,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MonthlyMode {
    Date,
    Weekday,
}

#[derive(Debug, Clone)]
pub struct ScheduleRule {
    pub unit: Unit,
    pub interval: u32,
    pub hour: u32, // 0..23
    pub minute: u32, // 0..59
    pub anchor_at: i64, // epoch ms
    pub weekdays: Vec<u32>,   // 0..6, 0 = Sunday; default [1] = Monday
    pub month_days: Vec<u32>, // 1..31; default [1]
    pub months: Vec<u32>,     // 1..12; default [1] for yearly
    pub monthly_mode: MonthlyMode,
}

const DAILY_SCAN_DAYS: i64 = 36_600;
const WEEKLY_SCAN_WEEKS: i64 = 5_220;
const MONTHLY_SCAN_MONTHS: i64 = 1_200;
const YEARLY_SCAN_YEARS: i64 = 400;

impl ScheduleRule {
    /// Next strictly-after-`now` slot, or None when the documented scan cap
    /// exhausts (the reference renders that as "no next run").
    pub fn next_run_at(&self, now: i64) -> Option<i64> {
        match self.unit {
            Unit::Minute => self.next_minute(now),
            Unit::Hourly => self.next_hourly(now),
            Unit::Daily => self.next_daily(now),
            Unit::Weekly => self.next_weekly(now),
            Unit::Monthly => self.next_monthly(now),
            Unit::Yearly => self.next_yearly(now),
        }
    }

    /// SPEC: pure millisecond stepping from anchor. Live-verified.
    fn next_minute(&self, now: i64) -> Option<i64> {
        let step = (self.interval as i64) * 60_000;
        if step <= 0 {
            return None;
        }
        let k = ((now - self.anchor_at).div_euclid(step)) + 1;
        Some(self.anchor_at + k * step)
    }

    /// SPEC: at `:minute` of every `interval`-th hour, anchored.
    /// SPEC-INTERPRETATION: hour-of-day phase — an hour h qualifies when
    /// (h - anchor_hour) mod interval == 0.
    fn next_hourly(&self, now: i64) -> Option<i64> {
        if self.interval == 0 {
            return None;
        }
        let (_, _, _, anchor_h, _) = civil::parts_of(self.anchor_at);
        // Day granularity scan is sufficient: at most interval hours per day
        // qualify, and the phase repeats every LCM(interval, 24) hours <= 24*interval.
        let start_day = civil::day_count_of(now);
        for day_off in 0..=(self.interval as i64) * 3 + 2 {
            let day = start_day + day_off;
            for h in 0..24u32 {
                if (h as i64 - anchor_h as i64).rem_euclid(self.interval as i64) != 0 {
                    continue;
                }
                let candidate = civil::epoch_ms_at(day, h, self.minute);
                if candidate > now {
                    return Some(candidate);
                }
            }
        }
        None
    }

    /// SPEC: hour:minute local time, every `interval` days; scan <= 36600 days.
    /// SPEC-INTERPRETATION: day-phase — a day qualifies when
    /// (day - anchor_day) mod interval == 0.
    fn next_daily(&self, now: i64) -> Option<i64> {
        if self.interval == 0 {
            return None;
        }
        let anchor_day = civil::day_count_of(self.anchor_at);
        let start_day = civil::day_count_of(now);
        for off in 0..=DAILY_SCAN_DAYS {
            let day = start_day + off;
            if (day - anchor_day).rem_euclid(self.interval as i64) != 0 {
                continue;
            }
            let candidate = civil::epoch_ms_at(day, self.hour, self.minute);
            if candidate > now {
                return Some(candidate);
            }
        }
        None
    }

    /// SPEC: weekdays[] (default [1] Monday), every `interval` weeks,
    /// Monday-anchored; scan <= 5220 weeks.
    fn next_weekly(&self, now: i64) -> Option<i64> {
        if self.interval == 0 {
            return None;
        }
        let weekdays: Vec<u32> = if self.weekdays.is_empty() {
            vec![1]
        } else {
            self.weekdays.clone()
        };
        let anchor_week = civil::week_index(civil::day_count_of(self.anchor_at));
        let start_day = civil::day_count_of(now);
        for off in 0..=(WEEKLY_SCAN_WEEKS * 7 + 7) {
            let day = start_day + off;
            let week = civil::week_index(day);
            if (week - anchor_week).rem_euclid(self.interval as i64) != 0 {
                continue;
            }
            if !weekdays.contains(&civil::weekday(day)) {
                continue;
            }
            let candidate = civil::epoch_ms_at(day, self.hour, self.minute);
            if candidate > now {
                return Some(candidate);
            }
        }
        None
    }

    /// SPEC: weekday mode -> first `weekdays[0] ?? Monday` of the month;
    /// date mode -> `monthDays[]` (default [1]); every `interval` months,
    /// scan <= 1200. Days that do not exist in the month are skipped
    /// (SPEC-INTERPRETATION: skip, not clamp).
    fn next_monthly(&self, now: i64) -> Option<i64> {
        if self.interval == 0 {
            return None;
        }
        let anchor_month = {
            let (y, m, _) = {
                let (y, m, d, _, _) = civil::parts_of(self.anchor_at);
                (y, m, d)
            };
            civil::month_index(y, m)
        };
        let (start_y, start_m, _, _, _) = civil::parts_of(now);
        let start_month = civil::month_index(start_y, start_m);
        for off in 0..=MONTHLY_SCAN_MONTHS {
            let month = start_month + off;
            if (month - anchor_month).rem_euclid(self.interval as i64) != 0 {
                continue;
            }
            let y = month.div_euclid(12);
            let m = (month.rem_euclid(12) + 1) as u32;
            for day in self.candidate_days(y, m) {
                let candidate = civil::epoch_ms_at(civil::days_from_civil(y, m, day), self.hour, self.minute);
                if candidate > now {
                    return Some(candidate);
                }
            }
            let _ = (start_y, start_m); // keep the bind for readability
        }
        None
    }

    fn candidate_days(&self, y: i64, m: u32) -> Vec<u32> {
        match self.monthly_mode {
            MonthlyMode::Date => {
                let days: Vec<u32> = if self.month_days.is_empty() {
                    vec![1]
                } else {
                    let mut v = self.month_days.clone();
                    v.sort_unstable();
                    v.dedup();
                    v
                };
                let last = civil::days_in_month(y, m);
                days.into_iter().filter(|d| *d <= last).collect()
            }
            MonthlyMode::Weekday => {
                let want = if self.weekdays.is_empty() { 1 } else { self.weekdays[0] };
                let first = civil::days_from_civil(y, m, 1);
                let first_wd = civil::weekday(first);
                let delta = (want as i64 - first_wd as i64).rem_euclid(7);
                vec![(1 + delta) as u32]
            }
        }
    }

    /// SPEC (fallback): months[0]/monthDays[0], every `interval` years, scan <= 400.
    fn next_yearly(&self, now: i64) -> Option<i64> {
        if self.interval == 0 {
            return None;
        }
        let month = *self.months.first().unwrap_or(&1);
        let (anchor_y, _, _, _, _) = civil::parts_of(self.anchor_at);
        let (start_y, _, _, _, _) = civil::parts_of(now);
        for off in 0..=YEARLY_SCAN_YEARS {
            let y = start_y + off;
            if (y - anchor_y).rem_euclid(self.interval as i64) != 0 {
                continue;
            }
            let last = civil::days_in_month(y, month);
            let day = self.month_days.first().copied().unwrap_or(1).min(last);
            let candidate = civil::epoch_ms_at(civil::days_from_civil(y, month, day), self.hour, self.minute);
            if candidate > now {
                return Some(candidate);
            }
        }
        None
    }
}

/// SPEC: relative-delay one-shots are stored as a one-shot cron at
/// `now + delay` plus a minute rule `{unit:"minute", interval:delay, anchorAt:now}`.
/// The live probe pinned this shape; the rule alone reproduces the slot.
pub fn relative_delay_slot(now: i64, delay_minutes: u32) -> (i64, ScheduleRule) {
    let slot = now + (delay_minutes as i64) * 60_000;
    let rule = ScheduleRule {
        unit: Unit::Minute,
        interval: delay_minutes,
        hour: 0,
        minute: 0,
        anchor_at: now,
        weekdays: vec![],
        month_days: vec![],
        months: vec![],
        monthly_mode: MonthlyMode::Date,
    };
    (slot, rule)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn rule(unit: Unit, interval: u32, hour: u32, minute: u32, anchor: i64) -> ScheduleRule {
        ScheduleRule {
            unit,
            interval,
            hour,
            minute,
            anchor_at: anchor,
            weekdays: vec![],
            month_days: vec![],
            months: vec![],
            monthly_mode: MonthlyMode::Date,
        }
    }

    #[test]
    fn minute_stepping_matches_live_probe() {
        // Live probe, 2026-10-07: anchor 01:31:01.391, delay 3 min -> slot 01:34:01.391.
        let anchor = civil::epoch_ms_of(2026, 10, 7, 1, 31) + 1_391;
        let (slot, r) = relative_delay_slot(anchor, 3);
        assert_eq!(slot, anchor + 180_000);
        assert_eq!(r.next_run_at(anchor + 1), Some(anchor + 180_000));
        assert_eq!(r.next_run_at(slot), Some(anchor + 360_000));
    }

    #[test]
    fn daily_every_n_days_at_hm() {
        let anchor = civil::epoch_ms_of(2026, 10, 1, 9, 0);
        let r = rule(Unit::Daily, 3, 9, 0, anchor);
        let now = civil::epoch_ms_of(2026, 10, 7, 10, 0); // just past today's 09:00
        // Days 0,3,6,9... from anchor Oct 1. Oct 7 = day 6 (qualifies, passed), so next is Oct 10.
        assert_eq!(r.next_run_at(now), Some(civil::epoch_ms_of(2026, 10, 10, 9, 0)));
        let now2 = civil::epoch_ms_of(2026, 10, 7, 8, 0); // before today's 09:00
        assert_eq!(r.next_run_at(now2), Some(civil::epoch_ms_of(2026, 10, 7, 9, 0)));
    }

    #[test]
    fn weekly_weekdays_monday_anchored() {
        // Anchor Monday 2026-10-05, Mondays+Fridays at 09:00 every week.
        let anchor = civil::epoch_ms_of(2026, 10, 5, 9, 0);
        let r = ScheduleRule {
            weekdays: vec![1, 5],
            ..rule(Unit::Weekly, 1, 9, 0, anchor)
        };
        let wed = civil::epoch_ms_of(2026, 10, 7, 12, 0);
        assert_eq!(r.next_run_at(wed), Some(civil::epoch_ms_of(2026, 10, 9, 9, 0))); // Friday
        let fri_after = civil::epoch_ms_of(2026, 10, 9, 10, 0);
        assert_eq!(r.next_run_at(fri_after), Some(civil::epoch_ms_of(2026, 10, 12, 9, 0))); // Monday
    }

    #[test]
    fn weekly_every_two_weeks() {
        let anchor = civil::epoch_ms_of(2026, 10, 5, 9, 0); // Monday, week 0
        let r = rule(Unit::Weekly, 2, 9, 0, anchor);
        let in_off_week = civil::epoch_ms_of(2026, 10, 12, 9, 0) + 1; // qualifying Monday passed
        assert_eq!(r.next_run_at(in_off_week), Some(civil::epoch_ms_of(2026, 10, 19, 9, 0)));
    }

    #[test]
    fn monthly_date_mode_skips_short_months() {
        // Every month on the 31st at 08:00 -> after Oct 31, next is Dec 31 (Nov has 30).
        let anchor = civil::epoch_ms_of(2026, 1, 31, 8, 0);
        let r = ScheduleRule {
            month_days: vec![31],
            ..rule(Unit::Monthly, 1, 8, 0, anchor)
        };
        let nov1 = civil::epoch_ms_of(2026, 11, 1, 0, 0);
        assert_eq!(r.next_run_at(nov1), Some(civil::epoch_ms_of(2026, 12, 31, 8, 0)));
    }

    #[test]
    fn monthly_weekday_mode_first_monday() {
        // First Monday of every 2nd month from anchor Sept 2026: Sept 7 is the first Monday.
        let anchor = civil::epoch_ms_of(2026, 9, 7, 9, 0);
        let r = ScheduleRule {
            monthly_mode: MonthlyMode::Weekday,
            weekdays: vec![1],
            ..rule(Unit::Monthly, 2, 9, 0, anchor)
        };
        // Next qualifying month = November 2026; first Monday = Nov 2.
        let oct1 = civil::epoch_ms_of(2026, 10, 1, 0, 0);
        assert_eq!(r.next_run_at(oct1), Some(civil::epoch_ms_of(2026, 11, 2, 9, 0)));
    }

    #[test]
    fn yearly() {
        let anchor = civil::epoch_ms_of(2024, 3, 15, 12, 0);
        let r = ScheduleRule {
            months: vec![3],
            month_days: vec![15],
            ..rule(Unit::Yearly, 1, 12, 0, anchor)
        };
        let after = civil::epoch_ms_of(2026, 3, 15, 13, 0);
        assert_eq!(r.next_run_at(after), Some(civil::epoch_ms_of(2027, 3, 15, 12, 0)));
    }

    #[test]
    fn hourly_anchored_phase() {
        // Anchor at 01:31 -> qualifying hours are 1, 4, 7... (interval 3) at :00.
        let anchor = civil::epoch_ms_of(2026, 10, 7, 1, 31);
        let r = rule(Unit::Hourly, 3, 0, 0, anchor);
        let now = civil::epoch_ms_of(2026, 10, 7, 2, 0);
        assert_eq!(r.next_run_at(now), Some(civil::epoch_ms_of(2026, 10, 7, 4, 0)));
    }
}
