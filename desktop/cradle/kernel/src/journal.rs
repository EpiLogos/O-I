//! The filesystem's own journal of changes, which outlives this process: what
//! lets a reading kept across a relaunch (`kept.rs`) be shown to be unchanged
//! since it was read.
//!
//! macOS keeps one journal per volume (FSEvents). Every change is given an
//! event id that only grows, and a stream opened "since" an id replays the
//! paths changed after it, up to the moment the stream was opened, then says
//! its history is done. A stamp records the journal's position before its
//! owner read starts (`position`); a replay since that position names every
//! path changed since, whether this process was running to see it or not.
//!
//! A replay that cannot vouch for what it names - the journal dropped events,
//! its ids wrapped, a watched root was moved or a volume came or went - is a
//! refusal: nothing it covers can be shown unchanged. So is a replay that has
//! not finished within its limit.
//!
//! Other platforms keep no such journal: `position` is `None` there, and
//! nothing is kept across a relaunch.
use std::path::{Path, PathBuf};
use std::time::Duration;

/// One changed path and the journal's id for the change.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Change {
    pub id: u64,
    pub path: PathBuf,
}

/// The journal's current position: every change after this moment is given a
/// larger id. `None` where there is no journal.
pub fn position() -> Option<u64> {
    imp::position()
}

/// The identity of the journal that records changes to `path`'s volume: ids
/// from one journal mean nothing in another.
pub fn volume(path: &Path) -> Option<String> {
    imp::volume(path)
}

/// Every change under `paths` after `since`, up to now; a refusal when the
/// journal cannot say, or has not said within `limit`.
pub fn since(paths: &[PathBuf], since: u64, limit: Duration) -> Result<Vec<Change>, String> {
    imp::since(paths, since, limit)
}

#[cfg(target_os = "macos")]
mod imp {
    use super::Change;
    use fsevent_sys as fs;
    use fsevent_sys::core_foundation as cf;
    use std::ffi::{CStr, CString};
    use std::os::unix::ffi::OsStrExt;
    use std::path::{Path, PathBuf};
    use std::time::{Duration, Instant};

    #[link(name = "CoreServices", kind = "framework")]
    extern "C" {
        fn FSEventsCopyUUIDForDevice(dev: libc::dev_t) -> cf::CFRef;
    }
    #[link(name = "CoreFoundation", kind = "framework")]
    extern "C" {
        fn CFUUIDCreateString(allocator: cf::CFRef, uuid: cf::CFRef) -> cf::CFStringRef;
        fn CFRunLoopRunInMode(mode: cf::CFStringRef, seconds: f64, return_after: u8) -> i32;
    }

    /// The flags that say the journal cannot vouch for what it replays.
    const UNSURE: fs::FSEventStreamEventFlags = fs::kFSEventStreamEventFlagMustScanSubDirs
        | fs::kFSEventStreamEventFlagUserDropped
        | fs::kFSEventStreamEventFlagKernelDropped
        | fs::kFSEventStreamEventFlagEventIdsWrapped
        | fs::kFSEventStreamEventFlagRootChanged
        | fs::kFSEventStreamEventFlagMount
        | fs::kFSEventStreamEventFlagUnmount;

    pub(super) fn position() -> Option<u64> {
        Some(unsafe { fs::FSEventsGetCurrentEventId() })
    }

    pub(super) fn volume(path: &Path) -> Option<String> {
        let path = CString::new(path.as_os_str().as_bytes()).ok()?;
        let mut stat: libc::stat = unsafe { std::mem::zeroed() };
        if unsafe { libc::stat(path.as_ptr(), &mut stat) } != 0 {
            return None;
        }
        unsafe {
            let uuid = FSEventsCopyUUIDForDevice(stat.st_dev);
            if uuid.is_null() {
                return None;
            }
            let text = CFUUIDCreateString(std::ptr::null_mut(), uuid);
            cf::CFRelease(uuid);
            if text.is_null() {
                return None;
            }
            let mut buffer = [0 as libc::c_char; 64];
            let copied = cf::CFStringGetCString(
                text,
                buffer.as_mut_ptr(),
                buffer.len() as cf::CFIndex,
                cf::kCFStringEncodingUTF8,
            );
            cf::CFRelease(text);
            copied.then(|| {
                CStr::from_ptr(buffer.as_ptr())
                    .to_string_lossy()
                    .into_owned()
            })
        }
    }

    struct Replayed {
        changes: Vec<Change>,
        done: bool,
        unsure: Option<String>,
    }

    extern "C" fn heard(
        _stream: fs::FSEventStreamRef,
        info: *mut libc::c_void,
        count: libc::size_t,
        paths: *mut libc::c_void,
        flags: *const fs::FSEventStreamEventFlags,
        ids: *const fs::FSEventStreamEventId,
    ) {
        // Safety: `info` is the `Replayed` the stream was created with, alive
        // for as long as its run loop runs on this same thread; FSEvents hands
        // `count` paths, flags and ids.
        unsafe {
            let replayed = &mut *(info as *mut Replayed);
            let paths = paths as *const *const libc::c_char;
            for index in 0..count {
                let flag = *flags.add(index);
                let path = PathBuf::from(
                    CStr::from_ptr(*paths.add(index))
                        .to_string_lossy()
                        .into_owned(),
                );
                if flag & fs::kFSEventStreamEventFlagHistoryDone != 0 {
                    replayed.done = true;
                    continue;
                }
                if replayed.done {
                    // Live changes after the history: the caller's own watch
                    // sees those.
                    continue;
                }
                if flag & UNSURE != 0 && replayed.unsure.is_none() {
                    replayed.unsure = Some(format!(
                        "the journal cannot vouch for {} (flags {flag:#x})",
                        path.display()
                    ));
                }
                replayed.changes.push(Change {
                    id: *ids.add(index),
                    path,
                });
            }
        }
    }

    pub(super) fn since(
        paths: &[PathBuf],
        since: u64,
        limit: Duration,
    ) -> Result<Vec<Change>, String> {
        if paths.is_empty() {
            return Ok(Vec::new());
        }
        let mut replayed = Replayed {
            changes: Vec::new(),
            done: false,
            unsure: None,
        };
        let started = Instant::now();
        // Safety: every CoreFoundation object created here is released before
        // returning; the stream's context points at `replayed`, which outlives
        // the stream (stopped, invalidated and released below), and the run
        // loop that calls `heard` is this thread's.
        unsafe {
            let watched =
                cf::CFArrayCreateMutable(cf::kCFAllocatorDefault, 0, &cf::kCFTypeArrayCallBacks);
            for path in paths {
                let Some(text) = path.to_str() else { continue };
                let mut error: cf::CFErrorRef = std::ptr::null_mut();
                let named = cf::str_path_to_cfstring_ref(text, &mut error);
                if named.is_null() {
                    if !error.is_null() {
                        cf::CFRelease(error as cf::CFRef);
                    }
                    continue;
                }
                cf::CFArrayAppendValue(watched, named);
                cf::CFRelease(named);
            }
            if cf::CFArrayGetCount(watched) == 0 {
                cf::CFRelease(watched);
                return Err("no path the journal could replay exists".into());
            }
            let context = fs::FSEventStreamContext {
                version: 0,
                info: &mut replayed as *mut Replayed as *mut libc::c_void,
                retain: None,
                release: None,
                copy_description: None,
            };
            let stream = fs::FSEventStreamCreate(
                cf::kCFAllocatorDefault,
                heard,
                &context,
                watched,
                since,
                0.0,
                fs::kFSEventStreamCreateFlagFileEvents | fs::kFSEventStreamCreateFlagNoDefer,
            );
            cf::CFRelease(watched);
            if stream.is_null() {
                return Err("the journal could not be opened".into());
            }
            let run_loop = cf::CFRunLoopGetCurrent();
            fs::FSEventStreamScheduleWithRunLoop(stream, run_loop, cf::kCFRunLoopDefaultMode);
            if fs::FSEventStreamStart(stream) == 0 {
                fs::FSEventStreamInvalidate(stream);
                fs::FSEventStreamRelease(stream);
                return Err("the journal could not be replayed".into());
            }
            while !replayed.done && started.elapsed() < limit {
                CFRunLoopRunInMode(cf::kCFRunLoopDefaultMode, 0.05, 0);
            }
            fs::FSEventStreamStop(stream);
            fs::FSEventStreamInvalidate(stream);
            fs::FSEventStreamRelease(stream);
        }
        if let Some(unsure) = replayed.unsure {
            return Err(unsure);
        }
        if !replayed.done {
            return Err(format!(
                "the journal did not finish its replay within {} ms",
                limit.as_millis()
            ));
        }
        Ok(replayed.changes)
    }
}

#[cfg(not(target_os = "macos"))]
mod imp {
    use super::Change;
    use std::path::{Path, PathBuf};
    use std::time::Duration;

    pub(super) fn position() -> Option<u64> {
        None
    }

    pub(super) fn volume(_path: &Path) -> Option<String> {
        None
    }

    pub(super) fn since(
        _paths: &[PathBuf],
        _since: u64,
        _limit: Duration,
    ) -> Result<Vec<Change>, String> {
        Err("this platform keeps no journal of changes".into())
    }
}

#[cfg(all(test, target_os = "macos"))]
mod tests {
    use super::*;

    fn temp(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "oi-journal-{name}-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::canonicalize(&dir).unwrap()
    }

    /// Replay since `mark` until `path` is in it: a change reaches the
    /// journal a moment after it is made.
    fn replayed_with(dir: &Path, mark: u64, path: &Path) -> Vec<Change> {
        let deadline = std::time::Instant::now() + Duration::from_secs(10);
        loop {
            let changes = since(&[dir.to_path_buf()], mark, Duration::from_secs(10)).unwrap();
            if changes.iter().any(|change| change.path == path)
                || std::time::Instant::now() > deadline
            {
                return changes;
            }
            std::thread::sleep(Duration::from_millis(50));
        }
    }

    #[test]
    fn a_change_after_a_position_is_replayed_and_one_before_it_is_not() {
        let dir = temp("replay");
        let (before, after) = (dir.join("before.json"), dir.join("after.json"));
        let start = position().expect("macOS keeps a journal");
        std::fs::write(&before, "{}").unwrap();
        replayed_with(&dir, start, &before);
        let mark = position().unwrap();
        std::fs::write(&after, "{}").unwrap();
        let changes = replayed_with(&dir, mark, &after);
        let named: Vec<&Path> = changes.iter().map(|change| change.path.as_path()).collect();
        assert!(named.contains(&after.as_path()), "{named:?}");
        assert!(!named.contains(&before.as_path()), "{named:?}");
        assert!(changes.iter().all(|change| change.id > mark));
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn a_volume_has_one_journal_identity() {
        let dir = temp("volume");
        let first = volume(&dir).expect("the temporary directory's volume is journaled");
        assert_eq!(volume(&dir), Some(first));
        let _ = std::fs::remove_dir_all(dir);
    }
}
