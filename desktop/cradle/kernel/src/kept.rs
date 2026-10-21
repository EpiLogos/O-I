//! Readings kept across a relaunch.
//!
//! The read model (`read_cache.rs`) holds every owner reading while the change
//! watch says its sources stand; a new process starts empty and asks every
//! owner again. This module writes the readings out as they are retained and,
//! at the next launch, takes back each one the filesystem's journal
//! (`journal.rs`) shows unchanged since, so a launch asks the owners only for
//! what moved while the application was closed.
//!
//! What makes a written reading trustworthy at the next launch:
//! - **When it stood.** Before writing, the kernel notes the journal's
//!   position, changes a beacon file beside the readings and waits for its own
//!   watcher to report that change. The watcher reports changes in the
//!   journal's order, so every change made before the beacon has been seen by
//!   then; a reading the watch still holds after that stood at the noted
//!   position.
//! - **What moved since.** At launch the journal replays every change under
//!   Central's root, the AIKit home and the readings' own directory after that
//!   position. Each changed path is classified as the watch classifies it
//!   (noise moves nothing); a reading whose scopes moved is dropped, the rest
//!   are taken back stamped with the epochs from before the watcher started,
//!   so anything the watcher sees from then on moves them as usual.
//! - **That the journal remembers.** The replay must include the beacon's
//!   change. A journal that purged its history past it, dropped events, or
//!   wrapped its ids vouches for nothing, and nothing is taken back.
//! - **That nothing else changed the answers.** The readings are written with
//!   the identity (size and modification time) of the kernel and of every
//!   owner program it ran, the roots and the journal's volume; any difference
//!   at launch takes nothing back. A reading tied to the minute is never
//!   written; one tied to the civil day is taken back only within the same
//!   tick.
//!
//! Where there is no journal (Linux), nothing is written or taken back.
//! `OI_KEPT_READINGS=off` turns keeping off; `OI_KEPT_READINGS=<file>` names
//! where readings are written (default `$OI_HOME/desktop/kept-readings.jsonl`,
//! else `~/.oi/desktop/kept-readings.jsonl`).
//!
//! The file is JSON lines: a header, then for each reading a line describing
//! it and a line holding its encoded value.
use crate::read_cache::ReadModel;
use crate::watch::{Clock, Mark, Roots, Scope, Watch};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeSet, HashMap};
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};

const FORMAT: &str = "oi.kept-readings/v1";
const FILE_NAME: &str = "kept-readings.jsonl";
/// How long the first readers of a launch wait for the kept readings.
const RESTORE_WAIT: Duration = Duration::from_millis(1500);
/// How long the journal is given to replay what changed since.
const REPLAY_LIMIT: Duration = Duration::from_secs(4);
/// How long the watcher is given to report the beacon.
const BEACON_LIMIT: Duration = Duration::from_secs(5);
/// How often the writer looks for retained readings that changed, and how
/// long they must have stopped changing before they are written.
const SETTLE: Duration = Duration::from_secs(2);
/// The most that is written: past it, the largest readings are left out.
const MAX_BYTES: usize = 64 * 1024 * 1024;

/// Where readings are kept; `None` when keeping is off.
pub fn location() -> Option<PathBuf> {
    match std::env::var_os("OI_KEPT_READINGS").filter(|value| !value.is_empty()) {
        Some(value) if value == "off" => None,
        Some(file) => Some(PathBuf::from(file)),
        None => std::env::var_os("OI_HOME")
            .filter(|home| !home.is_empty())
            .map(PathBuf::from)
            .or_else(|| {
                std::env::var_os("HOME")
                    .filter(|home| !home.is_empty())
                    .map(|home| PathBuf::from(home).join(".oi"))
            })
            .map(|home| home.join("desktop").join(FILE_NAME)),
    }
}

/// Whether `path` is one of the files keeping writes (the readings, their
/// temporary, a beacon): never a change of any reading.
pub(crate) fn owns(path: &Path) -> bool {
    path.file_name()
        .and_then(|name| name.to_str())
        .is_some_and(|name| name.starts_with("kept-readings"))
}

/// The filesystem's journal, as keeping uses it (the system's, or a test's).
pub(crate) trait Journal: Send + Sync {
    fn position(&self) -> Option<u64>;
    fn volume(&self, path: &Path) -> Option<String>;
    fn since(
        &self,
        paths: &[PathBuf],
        since: u64,
        limit: Duration,
    ) -> Result<Vec<crate::journal::Change>, String>;
}

struct System;

impl Journal for System {
    fn position(&self) -> Option<u64> {
        crate::journal::position()
    }
    fn volume(&self, path: &Path) -> Option<String> {
        crate::journal::volume(path)
    }
    fn since(
        &self,
        paths: &[PathBuf],
        since: u64,
        limit: Duration,
    ) -> Result<Vec<crate::journal::Change>, String> {
        crate::journal::since(paths, since, limit)
    }
}

/// A file's identity: a rebuilt or reinstalled program has another.
#[derive(Clone, Debug, Deserialize, Eq, Ord, PartialEq, PartialOrd, Serialize)]
struct Identity {
    path: String,
    len: u64,
    modified_ns: u128,
}

impl Identity {
    fn of(path: &Path) -> Option<Self> {
        let metadata = std::fs::metadata(path).ok()?;
        let modified_ns = metadata
            .modified()
            .ok()?
            .duration_since(std::time::UNIX_EPOCH)
            .ok()?
            .as_nanos();
        Some(Self {
            path: path.to_string_lossy().into_owned(),
            len: metadata.len(),
            modified_ns,
        })
    }

    /// Whether the file is still the one this identity names.
    fn stands(&self) -> bool {
        Self::of(Path::new(&self.path)).as_ref() == Some(self)
    }
}

/// The identities of the owner programs this process ran (named as they
/// were started; a bare name is found on `PATH`).
fn owner_identities() -> Vec<Identity> {
    let mut identities: Vec<Identity> = crate::owner_process::programs()
        .iter()
        .filter_map(|program| {
            if program.is_absolute() {
                return Identity::of(program);
            }
            if program.components().count() != 1 {
                return None;
            }
            let paths = std::env::var_os("PATH")?;
            std::env::split_paths(&paths)
                .map(|dir| dir.join(program))
                .find(|candidate| candidate.is_file())
                .and_then(|found| Identity::of(&found))
        })
        .collect();
    identities.sort();
    identities.dedup();
    identities
}

fn kernel_identity() -> Option<Identity> {
    Identity::of(&std::env::current_exe().ok()?)
}

#[derive(Debug, Deserialize, Serialize)]
struct Header {
    format: String,
    kernel: Identity,
    central: String,
    aikit: String,
    volume: String,
    owners: Vec<Identity>,
    /// The beacon changed just after `since` was noted.
    beacon: String,
    /// The journal's position at which every written reading stood.
    since: u64,
    written_at_unix_ms: u64,
}

#[derive(Debug, Deserialize, Serialize)]
struct Line {
    key: String,
    scopes: Vec<String>,
    clock: String,
    tick: u64,
    ttl_ms: u64,
    floor_ms: u64,
}

/// What one restore did, for the trace and the tests.
#[derive(Debug, Default, PartialEq)]
pub(crate) struct Restored {
    pub taken: usize,
    pub moved: usize,
    pub refused: Option<String>,
}

/// Where keeping writes, and what it checks against.
pub(crate) struct Keeping {
    file: PathBuf,
    roots: Roots,
    journal: Box<dyn Journal>,
    kernel: Identity,
}

impl Keeping {
    fn new(file: PathBuf, roots: Roots, journal: Box<dyn Journal>, kernel: Identity) -> Self {
        Self {
            file,
            roots,
            journal,
            kernel,
        }
    }

    fn dir(&self) -> PathBuf {
        self.file
            .parent()
            .map(Path::to_path_buf)
            .unwrap_or_default()
    }

    fn beacon(&self) -> PathBuf {
        self.dir()
            .join(format!("kept-readings-{}.beacon", std::process::id()))
    }

    /// The journal's volume, when the roots and the readings all lie on it.
    fn volume(&self) -> Option<String> {
        let volume = self.journal.volume(&self.roots.central)?;
        let same = |path: &Path| self.journal.volume(path).as_deref() == Some(volume.as_str());
        (same(&self.roots.aikit) && same(&self.dir())).then_some(volume)
    }

    /// Take back the readings written by the last run that the journal shows
    /// unchanged since, stamped as standing at `mark`.
    pub(crate) fn restore(&self, model: &ReadModel, mark: &Mark) -> Restored {
        let refused = |why: String| Restored {
            refused: Some(why),
            ..Restored::default()
        };
        let text = match std::fs::read(&self.file) {
            Ok(text) => text,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                return refused("nothing was kept".into())
            }
            Err(error) => return refused(format!("the kept readings could not be read: {error}")),
        };
        let mut lines = text.split(|byte| *byte == b'\n');
        let header: Header = match lines.next().map(serde_json::from_slice) {
            Some(Ok(header)) => header,
            _ => return refused("the kept readings have no header".into()),
        };
        if header.format != FORMAT {
            return refused(format!("the kept readings are {}", header.format));
        }
        if header.kernel != self.kernel {
            return refused("the kernel changed since they were kept".into());
        }
        if Path::new(&header.central) != self.roots.central
            || Path::new(&header.aikit) != self.roots.aikit
        {
            return refused("they were kept over other roots".into());
        }
        if self.volume().as_deref() != Some(header.volume.as_str()) {
            return refused("they were kept on another journal".into());
        }
        if let Some(owner) = header.owners.iter().find(|owner| !owner.stands()) {
            return refused(format!("{} changed since they were kept", owner.path));
        }
        let paths = [
            self.roots.central.clone(),
            self.roots.aikit.clone(),
            self.dir(),
        ];
        let changes = match self.journal.since(&paths, header.since, REPLAY_LIMIT) {
            Ok(changes) => changes,
            Err(why) => return refused(why),
        };
        let beacon = Path::new(&header.beacon);
        if !changes
            .iter()
            .any(|change| change.path == beacon && change.id > header.since)
        {
            return refused("the journal no longer reaches back to when they were kept".into());
        }
        // What moved while nothing was watching.
        let mut moved: BTreeSet<Scope> = BTreeSet::new();
        let mut sample: HashMap<Scope, PathBuf> = HashMap::new();
        for change in &changes {
            if change.id <= header.since {
                continue;
            }
            for scope in crate::watch::classify(&self.roots, &change.path) {
                sample
                    .entry(scope.clone())
                    .or_insert_with(|| change.path.clone());
                moved.insert(scope);
            }
        }
        // Whatever moves a project moves the readings across projects.
        if moved.iter().any(|scope| matches!(scope, Scope::Project(_))) {
            moved.insert(Scope::Work);
        }
        let mut restored = Restored::default();
        let mut dropped_by: BTreeSet<Scope> = BTreeSet::new();
        while let (Some(described), Some(value)) = (lines.next(), lines.next()) {
            let Ok(line) = serde_json::from_slice::<Line>(described) else {
                continue;
            };
            let scopes: Option<Vec<Scope>> = line
                .scopes
                .iter()
                .map(|wire| Scope::from_wire(wire))
                .collect();
            let (Some(scopes), Some(clock)) = (scopes, Clock::from_wire(&line.clock)) else {
                continue;
            };
            if clock == Clock::Minute || (clock == Clock::Day && clock.tick() != line.tick) {
                restored.moved += 1;
                continue;
            }
            let by: Vec<&Scope> = scopes
                .iter()
                .filter(|scope| match scope {
                    Scope::All => !moved.is_empty(),
                    scope => moved.contains(*scope),
                })
                .collect();
            if !by.is_empty() {
                restored.moved += 1;
                dropped_by.extend(by.into_iter().cloned());
                continue;
            }
            let stamp = model.stamp_kept(mark, &scopes, clock, line.tick);
            if model.restore(
                &line.key,
                value.to_vec(),
                stamp,
                (
                    Duration::from_millis(line.ttl_ms),
                    Duration::from_millis(line.floor_ms),
                ),
            ) {
                restored.taken += 1;
            }
        }
        for scope in dropped_by.iter().filter(|scope| **scope != Scope::All) {
            if let Some(path) = sample.get(scope) {
                crate::dispatch::trace_kept(&format!("moved {} {}", scope.wire(), path.display()));
            }
        }
        restored
    }

    /// Write out what the model holds now, as standing at a journal position
    /// the watcher is shown to have seen everything before; the count
    /// written, or why nothing was.
    pub(crate) fn write(&self, model: &ReadModel, watch: &Watch) -> Result<usize, String> {
        let volume = self
            .volume()
            .ok_or("the roots and the kept readings do not share one journal")?;
        let since = self
            .journal
            .position()
            .ok_or("this platform keeps no journal")?;
        let beacon = self.beacon();
        std::fs::create_dir_all(self.dir()).map_err(|error| error.to_string())?;
        let heard = watch.await_heard(
            &beacon,
            || std::fs::write(&beacon, since.to_string()),
            BEACON_LIMIT,
        );
        let _ = std::fs::remove_file(&beacon);
        if !heard {
            return Err("the watcher did not report the beacon".into());
        }
        let mut kept = model.keepable();
        let mut encoded: Vec<(crate::read_cache::Keepable, Vec<u8>)> = kept
            .drain(..)
            .filter_map(|reading| {
                let bytes = reading.encode()?;
                Some((reading, bytes))
            })
            .collect();
        // The smallest first, so a cap leaves out the fewest readings.
        encoded.sort_by_key(|(reading, bytes)| (bytes.len(), reading.key.clone()));
        let header = Header {
            format: FORMAT.into(),
            kernel: self.kernel.clone(),
            central: self.roots.central.to_string_lossy().into_owned(),
            aikit: self.roots.aikit.to_string_lossy().into_owned(),
            volume,
            owners: owner_identities(),
            beacon: beacon.to_string_lossy().into_owned(),
            since,
            written_at_unix_ms: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|elapsed| elapsed.as_millis() as u64)
                .unwrap_or(0),
        };
        let mut out = serde_json::to_vec(&header).map_err(|error| error.to_string())?;
        out.push(b'\n');
        let mut written = 0;
        for (reading, bytes) in encoded {
            let line = Line {
                key: reading.key.clone(),
                scopes: reading.scopes.iter().map(Scope::wire).collect(),
                clock: reading.clock.wire().into(),
                tick: reading.tick,
                ttl_ms: reading.ttl.as_millis() as u64,
                floor_ms: reading.floor.as_millis() as u64,
            };
            let described = serde_json::to_vec(&line).map_err(|error| error.to_string())?;
            if out.len() + described.len() + bytes.len() + 2 > MAX_BYTES {
                break;
            }
            out.extend_from_slice(&described);
            out.push(b'\n');
            out.extend_from_slice(&bytes);
            out.push(b'\n');
            written += 1;
        }
        let temporary = self
            .dir()
            .join(format!("{FILE_NAME}.{}.tmp", std::process::id()));
        std::fs::write(&temporary, &out).map_err(|error| error.to_string())?;
        std::fs::rename(&temporary, &self.file).map_err(|error| {
            let _ = std::fs::remove_file(&temporary);
            error.to_string()
        })?;
        Ok(written)
    }
}

/// Take back what the last run kept, then keep writing what this one holds:
/// started once, with the watcher live, from `watch::start_global`. `mark`
/// is the epochs from before the watcher started.
pub(crate) fn begin(watch: &'static Watch, model: &'static ReadModel, mark: Mark) {
    static BEGUN: std::sync::Once = std::sync::Once::new();
    BEGUN.call_once(|| {
        let Some(file) = location() else {
            crate::dispatch::trace_kept("off");
            return;
        };
        let (Some(roots), Some(kernel)) = (watch.roots(), kernel_identity()) else {
            return;
        };
        if crate::journal::position().is_none() {
            crate::dispatch::trace_kept("off: this platform keeps no journal");
            return;
        }
        let keeping = Keeping::new(file, roots, Box::new(System), kernel);
        model.restoring_until(Instant::now() + RESTORE_WAIT);
        let _ = std::thread::Builder::new()
            .name("oi-kept-readings".into())
            .spawn(move || {
                let started = Instant::now();
                let restored = keeping.restore(model, &mark);
                model.restore_done();
                crate::dispatch::trace_kept(&match &restored.refused {
                    Some(why) => format!("restored none: {why}"),
                    None => format!(
                        "restored {} ({} moved) in {} ms",
                        restored.taken,
                        restored.moved,
                        started.elapsed().as_millis()
                    ),
                });
                keep_writing(&keeping, model, watch);
            });
    });
}

/// Write whenever what would be written changed and has settled.
fn keep_writing(keeping: &Keeping, model: &ReadModel, watch: &Watch) {
    // The readings last written (by key and value: a re-read is another
    // value), and the count of changes they reflect.
    let mut written: Option<Vec<(String, usize)>> = None;
    let mut handled = None;
    let mut seen = model.kept_generation();
    loop {
        std::thread::sleep(SETTLE);
        let now = model.kept_generation();
        if now != seen {
            // Still changing: wait for it to settle.
            seen = now;
            continue;
        }
        if handled == Some(now) || !watch.live() {
            continue;
        }
        handled = Some(now);
        let kept = model.keepable();
        let mut held: Vec<(String, usize)> = kept
            .iter()
            .map(|reading| (reading.key.clone(), reading.identity()))
            .collect();
        drop(kept);
        held.sort();
        if written.as_ref() == Some(&held) {
            continue;
        }
        let started = Instant::now();
        // A refusal is tried again at the next change, not before.
        match keeping.write(model, watch) {
            Ok(count) => {
                crate::dispatch::trace_kept(&format!(
                    "wrote {count} in {} ms",
                    started.elapsed().as_millis()
                ));
                written = Some(held);
            }
            Err(why) => crate::dispatch::trace_kept(&format!("not written: {why}")),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::journal::Change;
    use crate::read_cache::Dep;
    use std::sync::{Arc, Mutex};

    /// A journal whose position is a counter and whose history is what the
    /// test says changed.
    #[derive(Clone, Default)]
    struct Fake {
        inner: Arc<Mutex<FakeState>>,
    }
    #[derive(Default)]
    struct FakeState {
        position: u64,
        changes: Vec<Change>,
        forgets_before: u64,
        unsure: bool,
    }
    impl Fake {
        fn change(&self, path: PathBuf) {
            let mut state = self.inner.lock().unwrap();
            state.position += 1;
            let id = state.position;
            state.changes.push(Change { id, path });
        }
    }
    impl Journal for Fake {
        fn position(&self) -> Option<u64> {
            Some(self.inner.lock().unwrap().position)
        }
        fn volume(&self, _path: &Path) -> Option<String> {
            Some("volume".into())
        }
        fn since(
            &self,
            paths: &[PathBuf],
            since: u64,
            _limit: Duration,
        ) -> Result<Vec<Change>, String> {
            let state = self.inner.lock().unwrap();
            if state.unsure {
                return Err("the journal cannot vouch".into());
            }
            Ok(state
                .changes
                .iter()
                .filter(|change| change.id > since && change.id >= state.forgets_before)
                .filter(|change| paths.iter().any(|path| change.path.starts_with(path)))
                .cloned()
                .collect())
        }
    }

    struct Run {
        watch: Watch,
        model: &'static ReadModel,
        keeping: Keeping,
        journal: Fake,
    }

    fn roots(dir: &Path) -> Roots {
        Roots {
            central: dir.join("central"),
            aikit: dir.join("aikit"),
            ignore: Vec::new(),
            kept: Some(dir.join("state")),
        }
    }

    fn temp(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "oi-kept-{name}-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(dir.join("state")).unwrap();
        dir
    }

    fn kernel() -> Identity {
        Identity {
            path: "/kernel".into(),
            len: 1,
            modified_ns: 1,
        }
    }

    /// One process's run over `dir`: a watch fed by hand that hears the
    /// beacon as the journal records it, and a model over it.
    fn run(dir: &Path, journal: &Fake) -> Run {
        let watch = Watch::fed(roots(dir));
        let model: &'static ReadModel = Box::leak(Box::new(ReadModel::over(watch.clone())));
        let keeping = Keeping::new(
            dir.join("state").join(FILE_NAME),
            roots(dir),
            Box::new(journal.clone()),
            kernel(),
        );
        Run {
            watch,
            model,
            keeping,
            journal: journal.clone(),
        }
    }

    impl Run {
        /// A reading over `scopes` asked through the model; `true` when the
        /// owner was asked.
        fn read(&self, key: &str, scopes: Vec<Scope>, clock: Clock) -> (serde_json::Value, bool) {
            let asked = std::cell::Cell::new(false);
            let value = self
                .model
                .read(
                    key,
                    &Dep::new(scopes, Duration::from_secs(4)).clock(clock),
                    || {
                        asked.set(true);
                        Ok::<_, String>(serde_json::json!({"key": key, "n": 1}))
                    },
                )
                .unwrap();
            (value, asked.get())
        }

        /// Write out, with the beacon heard as the journal records it.
        fn write(&self) -> usize {
            let watch = self.watch.clone();
            let journal = self.journal.clone();
            let beacon = self.keeping.beacon();
            // The fed watch has no watcher: the journal records the beacon
            // and the watch hears it, as FSEvents and the watcher would.
            let hearing = std::thread::spawn(move || {
                for _ in 0..200 {
                    if beacon.exists() {
                        journal.change(beacon.clone());
                        watch.hear(std::slice::from_ref(&beacon));
                        return;
                    }
                    std::thread::sleep(Duration::from_millis(5));
                }
            });
            let written = self.keeping.write(self.model, &self.watch).unwrap();
            hearing.join().unwrap();
            written
        }

        /// A changed path the next run's journal replays.
        fn change(&self, path: PathBuf) {
            self.journal.change(path);
        }

        fn restore(&self) -> Restored {
            let mark = self.watch.mark();
            self.keeping.restore(self.model, &mark)
        }
    }

    #[test]
    fn a_reading_whose_scopes_did_not_move_is_taken_back_without_asking_the_owner() {
        let dir = temp("taken-back");
        let journal = Fake::default();
        let first = run(&dir, &journal);
        assert!(first.read("world", vec![Scope::All], Clock::None).1);
        assert!(
            first
                .read("o-i", vec![Scope::Project("O-I".into())], Clock::None)
                .1
        );
        assert_eq!(first.write(), 2);

        let second = run(&dir, &journal);
        assert_eq!(
            second.restore(),
            Restored {
                taken: 2,
                moved: 0,
                refused: None
            }
        );
        let (value, asked) = second.read("o-i", vec![Scope::Project("O-I".into())], Clock::None);
        assert!(!asked, "a kept reading answers");
        assert_eq!(value, serde_json::json!({"key": "o-i", "n": 1}));
        assert!(!second.read("world", vec![Scope::All], Clock::None).1);
        assert_eq!(second.model.counts().hits, 2);
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn a_change_while_closed_drops_the_readings_over_its_scope_and_noise_drops_none() {
        let dir = temp("moved");
        let journal = Fake::default();
        let first = run(&dir, &journal);
        first.read("world", vec![Scope::All], Clock::None);
        first.read("o-i", vec![Scope::Project("O-I".into())], Clock::None);
        first.read(
            "factory",
            vec![Scope::Project("Factory".into())],
            Clock::None,
        );
        first.read("root", vec![Scope::Root], Clock::None);
        first.read("census", vec![Scope::Root, Scope::Seats], Clock::None);
        first.read("projects", vec![Scope::Root, Scope::Work], Clock::None);
        first.write();
        // Noise moves nothing; a change in O-I's tree moves O-I and the
        // readings across the projects; a seat's change moves what reads
        // seats.
        first.change(dir.join("central/Work/O-I/target/debug/build.o"));
        first.change(dir.join("central/Work/O-I/.git/FETCH_HEAD"));
        first.change(dir.join("central/Work/O-I/README.md"));
        first.change(dir.join("central/worktrees/env-1/o-i/src/lib.rs"));

        let second = run(&dir, &journal);
        let restored = second.restore();
        assert_eq!((restored.taken, restored.moved), (2, 4), "{restored:?}");
        assert!(
            second
                .read("o-i", vec![Scope::Project("O-I".into())], Clock::None)
                .1
        );
        assert!(second.read("world", vec![Scope::All], Clock::None).1);
        assert!(
            second
                .read("census", vec![Scope::Root, Scope::Seats], Clock::None)
                .1
        );
        assert!(
            second
                .read("projects", vec![Scope::Root, Scope::Work], Clock::None)
                .1
        );
        assert!(
            !second
                .read(
                    "factory",
                    vec![Scope::Project("Factory".into())],
                    Clock::None
                )
                .1
        );
        assert!(!second.read("root", vec![Scope::Root], Clock::None).1);
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn a_change_the_watcher_saw_after_launch_moves_a_kept_reading() {
        let dir = temp("seen-after");
        let journal = Fake::default();
        let first = run(&dir, &journal);
        first.read("o-i", vec![Scope::Project("O-I".into())], Clock::None);
        first.write();
        let second = run(&dir, &journal);
        assert_eq!(second.restore().taken, 1);
        second
            .watch
            .ingest(&[dir.join("central/Work/O-I/src/lib.rs")]);
        // Moved: served only inside its floor, like any reading the watch
        // saw move, and asked again by a native write.
        assert!(
            !second
                .read("o-i", vec![Scope::Project("O-I".into())], Clock::None)
                .1
        );
        assert_eq!(second.model.counts().settled, 1);
        second.watch.changed_here();
        assert!(
            second
                .read("o-i", vec![Scope::Project("O-I".into())], Clock::None)
                .1
        );
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn nothing_is_taken_back_when_the_journal_cannot_vouch_or_the_owners_changed() {
        let dir = temp("refused");
        let journal = Fake::default();
        let first = run(&dir, &journal);
        first.read("root", vec![Scope::Root], Clock::None);
        first.write();

        // The journal forgot the beacon: it no longer reaches back.
        journal.inner.lock().unwrap().forgets_before = u64::MAX;
        let restored = run(&dir, &journal).restore();
        assert_eq!(restored.taken, 0);
        assert!(restored.refused.unwrap().contains("reaches back"));
        journal.inner.lock().unwrap().forgets_before = 0;

        // Dropped events or wrapped ids.
        journal.inner.lock().unwrap().unsure = true;
        assert_eq!(run(&dir, &journal).restore().taken, 0);
        journal.inner.lock().unwrap().unsure = false;

        // Another kernel.
        let mut other = run(&dir, &journal);
        other.keeping.kernel.len = 2;
        assert!(other.restore().refused.unwrap().contains("kernel"));

        // An owner program rebuilt since.
        let owner = dir.join("owner");
        std::fs::write(&owner, "1").unwrap();
        let mut header_owner = Identity::of(&owner).unwrap();
        header_owner.len += 1;
        let text = std::fs::read_to_string(dir.join("state").join(FILE_NAME)).unwrap();
        let (first_line, rest) = text.split_once('\n').unwrap();
        let mut header: Header = serde_json::from_str(first_line).unwrap();
        header.owners = vec![header_owner];
        std::fs::write(
            dir.join("state").join(FILE_NAME),
            format!("{}\n{rest}", serde_json::to_string(&header).unwrap()),
        )
        .unwrap();
        assert!(run(&dir, &journal)
            .restore()
            .refused
            .unwrap()
            .contains("changed since"));
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn a_reading_of_the_minute_is_never_written_and_one_of_the_day_only_within_its_tick() {
        let dir = temp("clock");
        let journal = Fake::default();
        let first = run(&dir, &journal);
        first.read("policy", vec![Scope::Root], Clock::Minute);
        first.read("day", vec![Scope::Root], Clock::Day);
        assert_eq!(first.write(), 1);
        // The same tick: taken back.
        assert_eq!(run(&dir, &journal).restore().taken, 1);
        // Another tick: rewrite the line as if written a tick before.
        let path = dir.join("state").join(FILE_NAME);
        let text = std::fs::read_to_string(&path).unwrap();
        let tick = Clock::Day.tick();
        let moved = text.replace(
            &format!("\"tick\":{tick}"),
            &format!("\"tick\":{}", tick - 1),
        );
        std::fs::write(&path, moved).unwrap();
        let restored = run(&dir, &journal).restore();
        assert_eq!((restored.taken, restored.moved), (0, 1));
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn a_reading_read_in_this_run_is_newer_than_a_kept_one() {
        let dir = temp("newer");
        let journal = Fake::default();
        let first = run(&dir, &journal);
        first.read("root", vec![Scope::Root], Clock::None);
        first.write();
        let second = run(&dir, &journal);
        let fresh = second
            .model
            .read(
                "root",
                &Dep::new(vec![Scope::Root], Duration::from_secs(4)),
                || Ok::<_, String>(serde_json::json!("this run")),
            )
            .unwrap();
        assert_eq!(fresh, serde_json::json!("this run"));
        assert_eq!(second.restore().taken, 0);
        let (value, asked) = second.read("root", vec![Scope::Root], Clock::None);
        assert!(!asked);
        assert_eq!(value, serde_json::json!("this run"));
        let _ = std::fs::remove_dir_all(dir);
    }

    /// Wait until the journal holds a change of `path` after `since`: a
    /// change reaches it a moment after it is made.
    #[cfg(target_os = "macos")]
    fn journaled(dir: &Path, since: u64, path: &Path) {
        let deadline = Instant::now() + Duration::from_secs(10);
        while Instant::now() < deadline {
            let changes = crate::journal::since(&[dir.to_path_buf()], since, REPLAY_LIMIT)
                .unwrap_or_default();
            if changes.iter().any(|change| change.path == path) {
                return;
            }
            std::thread::sleep(Duration::from_millis(50));
        }
        panic!("{} never reached the journal", path.display());
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn across_a_real_relaunch_the_journal_keeps_what_did_not_move() {
        let dir = std::fs::canonicalize(temp("relaunch")).unwrap();
        let start = crate::journal::position().unwrap();
        for made in [
            "central/Work/A",
            "central/Work/B",
            "central/Control",
            "aikit",
        ] {
            std::fs::create_dir_all(dir.join(made)).unwrap();
        }
        std::fs::write(dir.join("central/Work/B/settled"), "1").unwrap();
        journaled(&dir, start, &dir.join("central/Work/B/settled"));
        let launch = || {
            let watch = Watch::new();
            let mark = watch.mark();
            watch.start(roots(&dir), Box::new(|_, _| {})).unwrap();
            let model: &'static ReadModel = Box::leak(Box::new(ReadModel::over(watch.clone())));
            let keeping = Keeping::new(
                dir.join("state").join(FILE_NAME),
                watch.roots().unwrap(),
                Box::new(System),
                kernel(),
            );
            (watch, model, keeping, mark)
        };
        let asks = std::sync::atomic::AtomicUsize::new(0);
        let read = |model: &ReadModel, project: &str| {
            model
                .read(
                    project,
                    &Dep::new(vec![Scope::Project(project.into())], Duration::from_secs(4)),
                    || {
                        asks.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
                        Ok::<_, String>(serde_json::json!({ "project": project }))
                    },
                )
                .unwrap()
        };

        let (watch, model, keeping, _) = launch();
        read(model, "A");
        read(model, "B");
        assert_eq!(keeping.write(model, &watch), Ok(2));
        watch.stop();

        // While the application is closed, A changes.
        let closed = crate::journal::position().unwrap();
        std::fs::write(dir.join("central/Work/A/file.txt"), "changed").unwrap();
        journaled(&dir, closed, &dir.join("central/Work/A/file.txt"));

        let (watch, model, keeping, mark) = launch();
        let restored = keeping.restore(model, &mark);
        assert_eq!((restored.taken, restored.moved), (1, 1), "{restored:?}");
        let before = asks.load(std::sync::atomic::Ordering::SeqCst);
        assert_eq!(read(model, "B"), serde_json::json!({ "project": "B" }));
        assert_eq!(
            asks.load(std::sync::atomic::Ordering::SeqCst),
            before,
            "B was kept"
        );
        read(model, "A");
        assert_eq!(
            asks.load(std::sync::atomic::Ordering::SeqCst),
            before + 1,
            "A moved"
        );
        watch.stop();
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn keeping_files_are_never_a_change() {
        let dir = temp("own-files");
        let mut roots = roots(&dir);
        // Even when the readings are kept under Central's root.
        roots.kept = Some(dir.join("central/Control/state"));
        for name in [
            "kept-readings.jsonl",
            "kept-readings.jsonl.12.tmp",
            "kept-readings-12.beacon",
        ] {
            assert!(
                crate::watch::classify(&roots, &dir.join("central/Control/state").join(name))
                    .is_empty()
            );
        }
        assert!(
            !crate::watch::classify(&roots, &dir.join("central/Control/state/other.json"))
                .is_empty()
        );
        let _ = std::fs::remove_dir_all(dir);
    }
}
