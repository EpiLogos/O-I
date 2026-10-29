//! The 5-field cron carrier, recreated at the *documented* grammar surface only.
//!
//! Spec §2.3: the app's own parsers accept plain integers and comma lists;
//! `*/N` in the minute position is recognized and converted to a minute-interval
//! rule; the UI always emits plain numeric crons. Richer Croner syntax is the
//! engine's capability, not the app's documented surface — this reference
//! implements exactly: `*`, integers, comma lists, `*/N` (step from 0),
//! plus `a-b` ranges as a strict superset guard (error on anything else).
//! Evaluation is standard cron: first time strictly after `now` matching all
//! fields, with day-of-month/day-of-week OR-restricted when both are limited.
//! Local-wall-clock semantics like the rule engine (see `civil.rs`).

use crate::civil;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CronParseError(pub String);

#[derive(Debug, Clone, PartialEq, Eq)]
enum Field {
    All,
    Set(Vec<u32>),
}

impl Field {
    fn matches(&self, v: u32) -> bool {
        match self {
            Field::All => true,
            Field::Set(s) => s.contains(&v),
        }
    }
    fn is_limited(&self) -> bool {
        !matches!(self, Field::All)
    }
}

#[derive(Debug, Clone)]
pub struct CronExpr {
    minute: Field, // 0..59
    hour: Field,   // 0..23
    dom: Field,    // 1..31
    mon: Field,    // 1..12
    dow: Field,    // 0..6, 0 = Sunday
}

fn parse_field(s: &str, min: u32, max: u32, what: &str) -> Result<Field, CronParseError> {
    let err = |msg: String| CronParseError(format!("{what}: {msg}"));
    if s == "*" {
        return Ok(Field::All);
    }
    let mut out = Vec::new();
    for part in s.split(',') {
        if let Some(step_s) = part.strip_prefix("*/") {
            let step: u32 = step_s.parse().map_err(|_| err(format!("bad step {step_s:?}")))?;
            if step == 0 {
                return Err(err("step 0".into()));
            }
            let mut v = min;
            while v <= max {
                out.push(v);
                v += step;
            }
        } else if let Some((a, b)) = part.split_once('-') {
            let a: u32 = a.parse().map_err(|_| err(format!("bad range {part:?}")))?;
            let b: u32 = b.parse().map_err(|_| err(format!("bad range {part:?}")))?;
            if a < min || b > max || a > b {
                return Err(err(format!("range {part:?} outside {min}..{max}")));
            }
            out.extend(a..=b);
        } else {
            let v: u32 = part.parse().map_err(|_| err(format!("bad value {part:?}")))?;
            if v < min || v > max {
                return Err(err(format!("value {v} outside {min}..{max}")));
            }
            out.push(v);
        }
    }
    if out.is_empty() {
        return Err(err("empty field".into()));
    }
    out.sort_unstable();
    out.dedup();
    Ok(Field::Set(out))
}

impl std::str::FromStr for CronExpr {
    type Err = CronParseError;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        let parts: Vec<&str> = s.split_whitespace().collect();
        if parts.len() != 5 {
            return Err(CronParseError(format!("expected 5 fields, got {}", parts.len())));
        }
        Ok(CronExpr {
            minute: parse_field(parts[0], 0, 59, "minute")?,
            hour: parse_field(parts[1], 0, 23, "hour")?,
            dom: parse_field(parts[2], 1, 31, "day-of-month")?,
            mon: parse_field(parts[3], 1, 12, "month")?,
            dow: parse_field(parts[4], 0, 6, "day-of-week")?,
        })
    }
}

impl CronExpr {
    /// First instant strictly after `now` matching all fields (standard cron
    /// dom/dow OR semantics when both are restricted). Day-level scan, capped
    /// at ~4 years.
    pub fn next_run_at(&self, now: i64) -> Option<i64> {
        let start_day = civil::day_count_of(now);
        for off in 0..=(366 * 4 + 2) {
            let day = start_day + off;
            let (_, mo, d) = civil::civil_from_days(day);
            let mon_ok = self.mon.matches(mo);
            let dom_ok = self.dom.matches(d);
            let dow_ok = self.dow.matches(civil::weekday(day));
            let day_matches = match (self.dom.is_limited(), self.dow.is_limited()) {
                (true, true) => dom_ok || dow_ok,
                _ => dom_ok && dow_ok,
            };
            if !(mon_ok && day_matches) {
                continue;
            }
            for h in 0..=23u32 {
                if !self.hour.matches(h) {
                    continue;
                }
                for mi in 0..=59u32 {
                    if !self.minute.matches(mi) {
                        continue;
                    }
                    let candidate = civil::epoch_ms_at(day, h, mi);
                    if candidate > now {
                        return Some(candidate);
                    }
                }
            }
        }
        None
    }
}

/// SPEC: `*/N * * * *` in the minute position converts to a minute-interval
/// rule; the carrier itself stays a cron. Returns the inferred interval when
/// the expression has that exact shape.
pub fn infer_minute_interval(expr: &str) -> Option<u32> {
    let parts: Vec<&str> = expr.split_whitespace().collect();
    if parts.len() != 5 {
        return None;
    }
    let step = parts[0].strip_prefix("*/")?;
    let n: u32 = step.parse().ok()?;
    if n == 0 || parts[1..].iter().any(|p| *p != "*") {
        return None;
    }
    Some(n)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::str::FromStr;

    #[test]
    fn plain_numeric_daily_nine_am() {
        // The observed live sample: `0 9 * * 1` — Mondays 09:00.
        let c = CronExpr::from_str("0 9 * * 1").unwrap();
        let mon = civil::epoch_ms_of(2026, 10, 5, 10, 0);
        assert_eq!(c.next_run_at(mon), Some(civil::epoch_ms_of(2026, 10, 12, 9, 0)));
        let sun = civil::epoch_ms_of(2026, 10, 11, 20, 0);
        assert_eq!(c.next_run_at(sun), Some(civil::epoch_ms_of(2026, 10, 12, 9, 0)));
    }

    #[test]
    fn comma_lists_and_star_step() {
        let c = CronExpr::from_str("0,30 9 * * *").unwrap();
        let t = civil::epoch_ms_of(2026, 10, 7, 9, 31);
        // First match of the set {0, 30} after 09:31 is tomorrow 09:00.
        assert_eq!(c.next_run_at(t), Some(civil::epoch_ms_of(2026, 10, 8, 9, 0)));
        let c2 = CronExpr::from_str("*/15 * * * *").unwrap();
        let t2 = civil::epoch_ms_of(2026, 10, 7, 10, 1);
        assert_eq!(c2.next_run_at(t2), Some(civil::epoch_ms_of(2026, 10, 7, 10, 15)));
        assert_eq!(infer_minute_interval("*/15 * * * *"), Some(15));
        assert_eq!(infer_minute_interval("*/15 9 * * *"), None);
    }

    #[test]
    fn rejects_rich_surface() {
        assert!(CronExpr::from_str("0 9 * * JAN").is_err());
        assert!(CronExpr::from_str("0 9 * *").is_err());
    }
}
