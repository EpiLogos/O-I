//! The workspace book's native owner (T-WORLDS §3, W1): the shell's per-person context — its workspaces, what each keeps, the
//! pool's footer, the layouts each mode opens with — kept in the candidate's own data home beside the continuity admission
//! (continuity_admission.rs `data_home`), never in authored ground (central-placement: per-person application context).
//!
//! One JSON file, a revision per write (the sha256 of its bytes), and the revisions before it kept beside it (the last
//! `HISTORY_KEPT`), so no write loses the copy it replaced. A write names the revision it was made on and is refused, in plain
//! words, when the book moved since; the shell reads again and writes on the revision it read.
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::fs;
use std::io::{ErrorKind, Write};
use std::path::Path;

const BOOK_FILE: &str = "book.json";
const HISTORY_DIR: &str = "history";
/// How many earlier revisions stay beside the book.
pub const HISTORY_KEPT: usize = 32;
/// The book's bound: a book past it is refused, never truncated.
pub const BOOK_MAX_BYTES: usize = 16 * 1024 * 1024;

/// A book's revision: its bytes' sha256.
pub fn revision_of(bytes: &[u8]) -> String {
    format!("book/{:x}", Sha256::digest(bytes))
}

/// The kept book, its revision and the revisions kept before it (newest first); a book never written reads as none.
pub fn read(dir: &Path) -> Result<Value, String> {
    match fs::read(dir.join(BOOK_FILE)) {
        Ok(bytes) => {
            let book: Value = serde_json::from_slice(&bytes).map_err(|error| {
                format!("The kept workspace book does not read as JSON: {error}")
            })?;
            Ok(json!({"book": book, "revision": revision_of(&bytes), "history": history(dir)}))
        }
        Err(error) if error.kind() == ErrorKind::NotFound => {
            Ok(json!({"book": null, "revision": null, "history": []}))
        }
        Err(error) => Err(format!("The workspace book could not be read: {error}")),
    }
}

/// Write the book on the revision it was read at (None: no book yet). The copy it replaces is kept under history/.
pub fn write(dir: &Path, expected: Option<&str>, book: &Value) -> Result<Value, String> {
    let shaped = book.get("version").and_then(Value::as_u64) == Some(2)
        && book.get("workspaces").is_some_and(Value::is_array)
        && book.get("active").is_some_and(Value::is_string);
    if !shaped {
        return Err("A workspace book has its version 2, the workspace you are in and its workspaces; this one does not, so nothing was written".into());
    }
    let bytes = serde_json::to_vec(book).map_err(|error| error.to_string())?;
    if bytes.len() > BOOK_MAX_BYTES {
        return Err(format!(
            "The workspace book is {} bytes, past its bound of {BOOK_MAX_BYTES}: nothing was written",
            bytes.len()
        ));
    }
    fs::create_dir_all(dir)
        .map_err(|error| format!("The workspace book's home could not be made: {error}"))?;
    let path = dir.join(BOOK_FILE);
    let held = match fs::read(&path) {
        Ok(bytes) => Some(bytes),
        Err(error) if error.kind() == ErrorKind::NotFound => None,
        Err(error) => return Err(format!("The workspace book could not be read: {error}")),
    };
    let current = held.as_deref().map(revision_of);
    if current.as_deref() != expected {
        return Err(format!(
            "The workspace book moved since it was read (the owner holds {}): nothing was overwritten. Read it again and keep on that revision.",
            current.as_deref().unwrap_or("no book")
        ));
    }
    let revision = revision_of(&bytes);
    if current.as_deref() == Some(revision.as_str()) {
        return Ok(json!({"revision": revision, "unchanged": true}));
    }
    if let (Some(previous), Some(previous_revision)) = (held.as_deref(), current.as_deref()) {
        keep_history(dir, previous_revision, previous)?;
    }
    write_atomic(dir, BOOK_FILE, &bytes)?;
    Ok(json!({"revision": revision}))
}

fn history_name(revision: &str) -> String {
    format!("{}.json", revision.trim_start_matches("book/"))
}

/// The revisions kept before the book, newest first.
fn history(dir: &Path) -> Vec<Value> {
    let mut kept: Vec<(std::time::SystemTime, String)> = fs::read_dir(dir.join(HISTORY_DIR))
        .map(|entries| {
            entries
                .flatten()
                .filter_map(|entry| {
                    let name = entry.file_name().to_string_lossy().to_string();
                    let modified = entry.metadata().and_then(|meta| meta.modified()).ok()?;
                    name.strip_suffix(".json")
                        .map(|hash| (modified, format!("book/{hash}")))
                })
                .collect()
        })
        .unwrap_or_default();
    kept.sort_by_key(|a| std::cmp::Reverse(a.0));
    kept.into_iter()
        .map(|(_, revision)| json!(revision))
        .collect()
}

fn keep_history(dir: &Path, revision: &str, bytes: &[u8]) -> Result<(), String> {
    let history_dir = dir.join(HISTORY_DIR);
    fs::create_dir_all(&history_dir)
        .map_err(|error| format!("The workspace book's history could not be made: {error}"))?;
    write_atomic(&history_dir, &history_name(revision), bytes)?;
    let mut kept: Vec<(std::time::SystemTime, std::path::PathBuf)> = fs::read_dir(&history_dir)
        .map_err(|error| error.to_string())?
        .flatten()
        .filter_map(|entry| {
            Some((
                entry.metadata().and_then(|meta| meta.modified()).ok()?,
                entry.path(),
            ))
        })
        .collect();
    if kept.len() > HISTORY_KEPT {
        kept.sort_by_key(|a| a.0);
        for (_, path) in kept.iter().take(kept.len() - HISTORY_KEPT) {
            let _ = fs::remove_file(path);
        }
    }
    Ok(())
}

/// Stage, flush, rename over the file and flush the directory: an interrupted write leaves the copy before it readable.
fn write_atomic(dir: &Path, file: &str, bytes: &[u8]) -> Result<(), String> {
    let staged = dir.join(format!(".{file}.staged"));
    let mut handle = fs::File::create(&staged)
        .map_err(|error| format!("The workspace book could not be staged: {error}"))?;
    handle.write_all(bytes).map_err(|error| error.to_string())?;
    handle.sync_all().map_err(|error| error.to_string())?;
    fs::rename(&staged, dir.join(file))
        .map_err(|error| format!("The workspace book could not be put in place: {error}"))?;
    if let Ok(directory) = fs::File::open(dir) {
        let _ = directory.sync_all();
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn home() -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "oi-workspace-book-{}-{}",
            std::process::id(),
            rand_suffix()
        ));
        fs::create_dir_all(&dir).unwrap();
        dir
    }
    fn rand_suffix() -> u128 {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    }
    fn book(name: &str) -> Value {
        json!({"version": 2, "active": "a", "workspaces": [{"id": "a", "name": name}]})
    }

    #[test]
    fn a_book_never_written_reads_as_none_and_the_first_write_needs_no_revision() {
        let dir = home();
        assert_eq!(
            read(&dir).unwrap(),
            json!({"book": null, "revision": null, "history": []})
        );
        let first = write(&dir, None, &book("Writing")).unwrap();
        let revision = first["revision"].as_str().unwrap().to_string();
        assert!(revision.starts_with("book/"));
        let reading = read(&dir).unwrap();
        assert_eq!(reading["book"], book("Writing"));
        assert_eq!(reading["revision"], json!(revision));
    }

    #[test]
    fn a_write_on_a_stale_revision_is_refused_and_overwrites_nothing() {
        let dir = home();
        let first = write(&dir, None, &book("one")).unwrap()["revision"]
            .as_str()
            .unwrap()
            .to_string();
        write(&dir, Some(&first), &book("two")).unwrap();
        let refused = write(&dir, Some(&first), &book("three")).unwrap_err();
        assert!(refused.contains("moved since it was read"), "{refused}");
        assert_eq!(read(&dir).unwrap()["book"], book("two"));
        assert!(
            write(&dir, None, &book("again"))
                .unwrap_err()
                .contains("moved"),
            "a first write over a book is refused too"
        );
    }

    #[test]
    fn each_write_keeps_the_copy_it_replaced_and_the_history_is_bounded() {
        let dir = home();
        let mut revision: Option<String> = None;
        for n in 0..(HISTORY_KEPT + 4) {
            let next = write(&dir, revision.as_deref(), &book(&format!("w{n}"))).unwrap();
            revision = Some(next["revision"].as_str().unwrap().to_string());
        }
        let history = read(&dir).unwrap()["history"].as_array().unwrap().len();
        assert_eq!(history, HISTORY_KEPT);
        let same = write(
            &dir,
            revision.as_deref(),
            &book(&format!("w{}", HISTORY_KEPT + 3)),
        )
        .unwrap();
        assert_eq!(
            same["unchanged"],
            json!(true),
            "the same bytes write nothing"
        );
    }

    #[test]
    fn a_book_out_of_shape_is_refused_by_name() {
        let dir = home();
        let refused = write(&dir, None, &json!({"version": 1, "workspaces": []})).unwrap_err();
        assert!(refused.contains("version 2"), "{refused}");
        assert_eq!(read(&dir).unwrap()["book"], Value::Null);
    }
}
