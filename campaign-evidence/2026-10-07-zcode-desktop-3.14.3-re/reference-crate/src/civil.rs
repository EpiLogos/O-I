//! Naive civil-calendar math (proleptic Gregorian) used by the schedule engines.
//!
//! ZCode evaluates schedules in the host's local civil time (plain JS `Date`
//! semantics, per the behavior spec §2.3). This reference keeps the algorithms
//! timezone-agnostic: callers hand in epoch milliseconds and the engines work
//! on the UTC-naive civil reading of them; a production host injects its own
//! local clock. DST gap/repeat behaviour is therefore NOT modelled here — it
//! is a named limitation shared with the study (spec §10, open question 2).

/// Days since 1970-01-01 for a civil date (Howard Hinnant's days_from_civil).
pub fn days_from_civil(y: i64, m: u32, d: u32) -> i64 {
    let y = if m <= 2 { y - 1 } else { y };
    let era = if y >= 0 { y } else { y - 399 } / 400;
    let yoe = (y - era * 400) as i64; // [0, 399]
    let m = m as i64;
    let doy = (153 * (if m > 2 { m - 3 } else { m + 9 }) + 2) / 5 + d as i64 - 1; // [0, 365]
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy; // [0, 146096]
    era * 146_097 + doe - 719_468
}

/// Inverse of [`days_from_civil`].
pub fn civil_from_days(z: i64) -> (i64, u32, u32) {
    let z = z + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = z - era * 146_097; // [0, 146096]
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365; // [0, 399]
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100); // [0, 365]
    let mp = (5 * doy + 2) / 153; // [0, 11]
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32; // [1, 31]
    let m = (if mp < 10 { mp + 3 } else { mp - 9 }) as u32; // [1, 12]
    (if m <= 2 { y + 1 } else { y }, m, d)
}

/// Weekday of a day count, 0 = Sunday .. 6 = Saturday (1970-01-01 was Thursday).
pub fn weekday(z: i64) -> u32 {
    (((z % 7) + 7 + 4) % 7) as u32
}

/// Days in a civil month.
pub fn days_in_month(y: i64, m: u32) -> u32 {
    match m {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 => {
            if (y % 4 == 0 && y % 100 != 0) || y % 400 == 0 {
                29
            } else {
                28
            }
        }
        _ => 0,
    }
}

/// The (year, month, day, hour, minute) civil reading of epoch milliseconds,
/// on the naive clock this crate computes on.
pub fn parts_of(epoch_ms: i64) -> (i64, u32, u32, u32, u32) {
    let secs = epoch_ms.div_euclid(1000);
    let days = secs.div_euclid(86_400);
    let sod = secs.rem_euclid(86_400);
    let (y, mo, d) = civil_from_days(days);
    (y, mo, d, (sod / 3600) as u32, ((sod % 3600) / 60) as u32)
}

/// Epoch milliseconds for a civil datetime on the naive clock.
pub fn epoch_ms_of(y: i64, mo: u32, d: u32, h: u32, mi: u32) -> i64 {
    (days_from_civil(y, mo, d) * 86_400 + (h as i64) * 3600 + (mi as i64) * 60) * 1000
}

/// Epoch ms for `day_count` at the given wall-clock hour:minute.
pub fn epoch_ms_at(day_count: i64, hour: u32, minute: u32) -> i64 {
    (day_count * 86_400 + (hour as i64) * 3600 + (minute as i64) * 60) * 1000
}

/// Day count containing `epoch_ms`.
pub fn day_count_of(epoch_ms: i64) -> i64 {
    epoch_ms.div_euclid(1000).div_euclid(86_400)
}

/// Monday-aligned week index of a day count (1970-01-05 was the first Monday).
pub fn week_index(day_count: i64) -> i64 {
    (day_count - 4).div_euclid(7)
}

/// Month index (months since year 0, proleptic) of a civil date.
pub fn month_index(y: i64, m: u32) -> i64 {
    y * 12 + (m as i64) - 1
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn epoch_round_trip() {
        // 2026-10-07 01:34 local-naive
        let ms = epoch_ms_of(2026, 10, 7, 1, 34);
        assert_eq!(parts_of(ms), (2026, 10, 7, 1, 34));
        assert_eq!(weekday(days_from_civil(2026, 10, 7)), 3); // Wednesday
    }

    #[test]
    fn known_instants() {
        // 1970-01-01T00:00 == 0
        assert_eq!(days_from_civil(1970, 1, 1), 0);
        // 2000-03-01 == 11017
        assert_eq!(days_from_civil(2000, 3, 1), 11_017);
        assert_eq!(weekday(0), 4); // Thursday
    }

    #[test]
    fn month_lengths() {
        assert_eq!(days_in_month(2026, 2), 28);
        assert_eq!(days_in_month(2024, 2), 29);
        assert_eq!(days_in_month(2026, 10), 31);
    }
}
