//! A clip's source, kept beside the set (DLW §16.5: "A clip's source is its
//! constellation, as a sample is an audio clip's"; §21.1 the Clip panel's
//! Constellation, "The clip's source when Live made it of a constellation";
//! §10.3 Sets, files and media: "The set is a file of the DLW's own … Its
//! clips refer to the constellation's nodes, never to copies of them").
//!
//! A MIDI clip in an `.als` has no source of its own (an audio clip's sample
//! is its `SampleRef`; a MIDI clip carries nothing like it), and Live writes
//! the document again from its own model when it saves, so anything written
//! into the clip that Live does not know would be lost. The source is kept in
//! the DLW's own record of the set instead, beside it: `<set>.als` →
//! `<set>.dlw.json` (schema `oi.dlw-set/v1`), one row for each clip Live made
//! of a constellation, named by its track's own `Id` (Live keeps it when the
//! tracks are reordered) and its place (a session slot's scene, or an
//! arrangement index). It holds the constellation's ref, never a copy of the
//! constellation. The record is replaced whole and atomically.
//!
//! Since O-I #855 it keeps two more things Live's document cannot hold (DLW
//! §21.2 Rules: "A saved sound keeps every parameter, its body, and its
//! tuning with the sources it was read from. It opens with the same sound";
//! "A recorded performance keeps what it needs to be played on"):
//!   - `parts`: a part's Torus as it was left, one row for each part that
//!     keeps one, named by its track's `Id` — the instrument's own state as
//!     its owner announced it (the Torus is no Live device, so the `.als`
//!     has no place for it, as it has none for a clip's source);
//!   - `takes`: what a recorded take keeps beyond its notes, one row for each
//!     take, named by its track's `Id` and its `TakeId` (Live keeps the
//!     `TakeId` on the take and on every stretch comped from it, so the row
//!     follows the take wherever its clips are laid).
//!
//! Both are kept as the shell gave them (`checked_keep`: an object, bounded),
//! never read into a sound here: the Torus's owner is the instrument.
//!
//! The record's first schema, `oi.dlw-set/v1`, held the clips' sources only:
//! it reads as this one with no parts and no takes, and is written as this
//! one at its next write.

use crate::edit::ClipAt;
use serde_json::{json, Value};
use std::path::{Path, PathBuf};

pub const SCHEMA: &str = "oi.dlw-set/v2";
/// The record's first schema (clips' sources only), read as `SCHEMA`.
pub const SCHEMA_V1: &str = "oi.dlw-set/v1";
/// The longest source ref the record keeps (a wiki ref).
const REF_MAX: usize = 512;
/// The most clips the record names, and the most parts and takes.
const ROWS_MAX: usize = 4096;
/// The most a part's Torus or a take's keeps may weigh, as JSON text.
pub const KEEP_BYTES_MAX: usize = 256 * 1024;
/// How deep a kept value may nest.
const KEEP_DEPTH_MAX: usize = 32;

/// The record, whole: its clips' sources, its parts' Torus and its takes' keeps.
#[derive(Debug, Default, PartialEq)]
struct Record {
    clips: Vec<Value>,
    parts: Vec<Value>,
    takes: Vec<Value>,
}

/// The DLW's own record of the set at `set`: beside it, `<stem>.dlw.json`.
pub fn record_path(set: &Path) -> PathBuf {
    let stem = set
        .file_stem()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_else(|| "set".into());
    set.with_file_name(format!("{stem}.dlw.json"))
}

fn at_json(at: ClipAt) -> Value {
    match at {
        ClipAt::Arrangement(j) => json!({"arrangement": j}),
        ClipAt::Slot(scene) => json!({"slot": scene}),
    }
}

/// A source ref as the record keeps it: a ref of at most 512 characters, no
/// control characters, not blank.
pub fn checked_ref(source: &str) -> Result<&str, String> {
    let ok = !source.trim().is_empty()
        && source.chars().count() <= REF_MAX
        && !source.chars().any(char::is_control);
    if ok {
        Ok(source)
    } else {
        Err("A clip's source is a constellation's ref: text of at most 512 characters".into())
    }
}

/// The record; empty when the set has no record yet. A record that is not
/// the DLW's set is refused in words, never read as empty. A `v1` record (the
/// clips' sources only) reads with no parts and no takes.
fn read(set: &Path) -> Result<Record, String> {
    let path = record_path(set);
    let text = match std::fs::read_to_string(&path) {
        Ok(text) => text,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(Record::default()),
        Err(e) => return Err(format!("The set's DLW record could not be read: {e}")),
    };
    let record: Value = serde_json::from_str(&text)
        .map_err(|e| format!("The set's DLW record is not JSON: {e}"))?;
    let schema = record.get("schema").and_then(Value::as_str);
    if schema != Some(SCHEMA) && schema != Some(SCHEMA_V1) {
        return Err(format!("The set's DLW record is not {SCHEMA}"));
    }
    let list = |name: &str, required: bool| -> Result<Vec<Value>, String> {
        match record.get(name) {
            None if !required => Ok(Vec::new()),
            Some(Value::Array(rows)) => Ok(rows.clone()),
            _ => Err(format!("The set's DLW record lists no {name}")),
        }
    };
    let v2 = schema == Some(SCHEMA);
    Ok(Record {
        clips: list("clips", true)?,
        parts: if v2 {
            list("parts", false)?
        } else {
            Vec::new()
        },
        takes: if v2 {
            list("takes", false)?
        } else {
            Vec::new()
        },
    })
}

/// Replace the record whole and atomically, as this schema.
fn write(set: &Path, record: &Record) -> Result<(), String> {
    for (rows, what) in [
        (&record.clips, "clips"),
        (&record.parts, "parts"),
        (&record.takes, "takes"),
    ] {
        if rows.len() > ROWS_MAX {
            return Err(format!(
                "The set's DLW record names at most {ROWS_MAX} {what}"
            ));
        }
    }
    let name = set
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_default();
    let value = json!({"schema": SCHEMA, "set": name, "clips": record.clips, "parts": record.parts, "takes": record.takes});
    let text = serde_json::to_string_pretty(&value).map_err(|e| e.to_string())?;
    write_atomically(&record_path(set), text.as_bytes())
}

fn rows(set: &Path) -> Result<Vec<Value>, String> {
    Ok(read(set)?.clips)
}

/// A value the record keeps for a part or a take, as the shell gave it: an
/// object of at most `KEEP_BYTES_MAX` bytes of JSON, nested at most
/// `KEEP_DEPTH_MAX` deep, holding no NUL. Refused in words otherwise.
pub fn checked_keep<'a>(value: &'a Value, what: &str) -> Result<&'a Value, String> {
    fn depth(value: &Value, at: usize) -> bool {
        if at > KEEP_DEPTH_MAX {
            return false;
        }
        match value {
            Value::Array(items) => items.iter().all(|v| depth(v, at + 1)),
            Value::Object(fields) => fields
                .iter()
                .all(|(k, v)| !k.contains('\0') && depth(v, at + 1)),
            Value::String(text) => !text.contains('\0'),
            _ => true,
        }
    }
    let size = serde_json::to_vec(value)
        .map(|v| v.len())
        .unwrap_or(usize::MAX);
    if !value.is_object() || size > KEEP_BYTES_MAX || !depth(value, 0) {
        return Err(format!(
            "{what} is kept as one object of at most {} KiB",
            KEEP_BYTES_MAX / 1024
        ));
    }
    Ok(value)
}

/// The Torus the part whose track `Id` is `track_id` keeps, or none.
pub fn torus_of(set: &Path, track_id: &str) -> Result<Option<Value>, String> {
    Ok(read(set)?
        .parts
        .into_iter()
        .find(|row| row.get("track").and_then(Value::as_str) == Some(track_id))
        .and_then(|row| row.get("torus").cloned()))
}

/// Keep `torus` as the part's Torus (none: the part keeps none), replacing the
/// record whole and atomically.
pub fn set_torus(set: &Path, track_id: &str, torus: Option<&Value>) -> Result<(), String> {
    if let Some(torus) = torus {
        checked_keep(torus, "A part's Torus")?;
    }
    let mut record = read(set)?;
    record
        .parts
        .retain(|row| row.get("track").and_then(Value::as_str) != Some(track_id));
    if let Some(torus) = torus {
        record
            .parts
            .push(json!({"track": track_id, "torus": torus}));
    }
    write(set, &record)
}

/// What the take `take` (its `TakeId`) on the track whose `Id` is `track_id`
/// keeps beyond its notes, or none.
pub fn keeps_of(set: &Path, track_id: &str, take: u64) -> Result<Option<Value>, String> {
    Ok(read(set)?
        .takes
        .into_iter()
        .find(|row| {
            row.get("track").and_then(Value::as_str) == Some(track_id)
                && row.get("take").and_then(Value::as_u64) == Some(take)
        })
        .and_then(|row| row.get("keeps").cloned()))
}

/// Keep `keeps` for the take `take` on the track whose `Id` is `track_id`,
/// replacing the record whole and atomically.
pub fn set_keeps(set: &Path, track_id: &str, take: u64, keeps: &Value) -> Result<(), String> {
    checked_keep(keeps, "A take's keeps")?;
    let mut record = read(set)?;
    record.takes.retain(|row| {
        !(row.get("track").and_then(Value::as_str) == Some(track_id)
            && row.get("take").and_then(Value::as_u64) == Some(take))
    });
    record
        .takes
        .push(json!({"track": track_id, "take": take, "keeps": keeps}));
    write(set, &record)
}

/// The source the record keeps for the clip at `at` on the track whose `Id`
/// is `track_id`: its constellation's ref, or none.
pub fn source_of(set: &Path, track_id: &str, at: ClipAt) -> Result<Option<String>, String> {
    let at = at_json(at);
    Ok(rows(set)?
        .iter()
        .find(|row| {
            row.get("track").and_then(Value::as_str) == Some(track_id) && row.get("at") == Some(&at)
        })
        .and_then(|row| row.get("source").and_then(Value::as_str))
        .map(str::to_string))
}

/// Keep `source` as the clip's source (none: the clip is made of no
/// constellation), replacing the record whole and atomically.
pub fn set_source(
    set: &Path,
    track_id: &str,
    at: ClipAt,
    source: Option<&str>,
) -> Result<(), String> {
    if let Some(source) = source {
        checked_ref(source)?;
    }
    let at_value = at_json(at);
    let mut record = read(set)?;
    record.clips.retain(|row| {
        !(row.get("track").and_then(Value::as_str) == Some(track_id)
            && row.get("at") == Some(&at_value))
    });
    if let Some(source) = source {
        record
            .clips
            .push(json!({"track": track_id, "at": at_value, "source": source}));
    }
    write(set, &record)
}

/// Move each clip's row with its clip after an act moved clips (`acts.rs`):
/// `place` answers where the clip at `at` on the track whose `Id` is the
/// first argument now stands — nowhere (it is gone), one place (it moved, or
/// stayed), or more (it was copied, and the copy keeps its source). A set
/// with no record has nothing to move; the record is replaced whole and
/// atomically, and only when a row moved.
pub fn remap(
    set: &Path,
    mut place: impl FnMut(&str, ClipAt) -> Vec<(String, ClipAt)>,
) -> Result<(), String> {
    if !record_path(set).exists() {
        return Ok(());
    }
    let mut record = read(set)?;
    let before = std::mem::take(&mut record.clips);
    let mut after: Vec<Value> = Vec::with_capacity(before.len());
    for row in &before {
        let found = row
            .get("track")
            .and_then(Value::as_str)
            .zip(row.get("at").and_then(|at| ClipAt::of(at).ok()));
        let Some((track, at)) = found else {
            after.push(row.clone());
            continue;
        };
        for (track, at) in place(track, at) {
            let mut moved = row.clone();
            moved["track"] = json!(track);
            moved["at"] = at_json(at);
            after.retain(|kept: &Value| {
                !(kept.get("track") == moved.get("track") && kept.get("at") == moved.get("at"))
            });
            after.push(moved);
        }
    }
    if after == before {
        return Ok(());
    }
    record.clips = after;
    write(set, &record)
}

/// Write beside the record and rename over it, so a crash never leaves half a record.
fn write_atomically(path: &Path, bytes: &[u8]) -> Result<(), String> {
    use std::io::Write;
    let dir = path.parent().ok_or("the set has no parent directory")?;
    let temp = dir.join(format!(
        ".{}.{}.tmp",
        path.file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_default(),
        std::process::id()
    ));
    let mut file = std::fs::File::create(&temp)
        .map_err(|e| format!("The set's DLW record could not be written: {e}"))?;
    let written = file.write_all(bytes).and_then(|()| file.sync_all());
    if let Err(e) = written {
        let _ = std::fs::remove_file(&temp);
        return Err(format!("The set's DLW record could not be written: {e}"));
    }
    std::fs::rename(&temp, path).map_err(|e| {
        let _ = std::fs::remove_file(&temp);
        format!("The set's DLW record could not be written: {e}")
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn dir() -> PathBuf {
        use std::sync::atomic::{AtomicUsize, Ordering};
        static NEXT: AtomicUsize = AtomicUsize::new(0);
        let dir = std::env::temp_dir().join(format!(
            "live-set-sources-{}-{}",
            std::process::id(),
            NEXT.fetch_add(1, Ordering::SeqCst)
        ));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn the_record_stands_beside_the_set_and_keeps_each_clips_source_by_its_track_id_and_place() {
        let dir = dir();
        let set = dir.join("Song.als");
        assert_eq!(record_path(&set), dir.join("Song.dlw.json"));
        assert_eq!(
            source_of(&set, "12", ClipAt::Slot(1)).unwrap(),
            None,
            "no record: no source"
        );
        set_source(&set, "12", ClipAt::Slot(1), Some("wiki:anchor:lived-in")).unwrap();
        set_source(
            &set,
            "12",
            ClipAt::Arrangement(0),
            Some("wiki:node:central"),
        )
        .unwrap();
        assert_eq!(
            source_of(&set, "12", ClipAt::Slot(1)).unwrap().as_deref(),
            Some("wiki:anchor:lived-in")
        );
        assert_eq!(
            source_of(&set, "12", ClipAt::Arrangement(0))
                .unwrap()
                .as_deref(),
            Some("wiki:node:central")
        );
        assert_eq!(
            source_of(&set, "13", ClipAt::Slot(1)).unwrap(),
            None,
            "another track's clip is not this one"
        );
        set_source(&set, "12", ClipAt::Slot(1), Some("wiki:node:o-i/dlw")).unwrap();
        assert_eq!(
            source_of(&set, "12", ClipAt::Slot(1)).unwrap().as_deref(),
            Some("wiki:node:o-i/dlw"),
            "one row per clip"
        );
        set_source(&set, "12", ClipAt::Slot(1), None).unwrap();
        assert_eq!(source_of(&set, "12", ClipAt::Slot(1)).unwrap(), None);
        let record: Value =
            serde_json::from_str(&std::fs::read_to_string(record_path(&set)).unwrap()).unwrap();
        assert_eq!(record["schema"], SCHEMA);
        assert_eq!(record["set"], "Song.als");
        assert_eq!(record["clips"].as_array().unwrap().len(), 1);
        let leftovers: Vec<_> = std::fs::read_dir(&dir)
            .unwrap()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_name().to_string_lossy().ends_with(".tmp"))
            .collect();
        assert!(leftovers.is_empty(), "no half-written record is left");
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn a_record_that_is_not_the_dlws_or_a_ref_that_is_no_ref_is_refused_in_words() {
        let dir = dir();
        let set = dir.join("Song.als");
        assert!(set_source(&set, "12", ClipAt::Slot(0), Some("  "))
            .unwrap_err()
            .contains("constellation's ref"));
        assert!(set_source(&set, "12", ClipAt::Slot(0), Some(&"x".repeat(513))).is_err());
        std::fs::write(record_path(&set), "{\"schema\":\"other/v1\",\"clips\":[]}").unwrap();
        assert!(source_of(&set, "12", ClipAt::Slot(0))
            .unwrap_err()
            .contains(SCHEMA));
        std::fs::write(record_path(&set), "not json").unwrap();
        assert!(source_of(&set, "12", ClipAt::Slot(0))
            .unwrap_err()
            .contains("not JSON"));
        std::fs::remove_dir_all(&dir).unwrap();
    }
}
