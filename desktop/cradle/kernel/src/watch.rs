//! The change watch: one filesystem watcher over Central's root and the
//! AIKit home, and the epochs a retained reading is validated against.
//!
//! A changed path maps to the scopes it can change the answer of:
//! `root` (anything under `Control/`), `project:<Name>` (under
//! `Work/<Name>/`), `seats` (under `worktrees/` and the Workcell register),
//! `aikit` (the AIKit home). A rescan request or dropped events mean
//! anything may have changed: every scope moves. Each scope has an epoch
//! that only grows; a `Stamp` is the epochs of a reading's scopes captured
//! before its owner read started, and the reading is valid while
//! `Watch::still(&stamp)` holds. Epochs are atomics (the project map is a
//! small separate lock), so validity is checked without the kernel lock.
//!
//! Epochs move when a change is seen, not when it is announced: the
//! debounced announcement (`Callback`, at most one per `ANNOUNCE_EVERY`)
//! only reports what moved since the last one, for readers that want to
//! re-ask.
//!
//! When the watcher cannot start, or a scope lies outside what it covers
//! (on Linux a recursive inotify watch over the whole root is too heavy, so
//! only `Control`, each project's `ProjectCentral`, each repository's
//! `.git/HEAD` and `.git/refs`, `worktrees` and the AIKit home are
//! watched), `still` cannot answer from epochs. It then falls back to the
//! reading's own time-to-live, which the caller supplies with the stamp; the
//! watch says so through `live()` / `covers()` and the code that retains a
//! reading records which of the two validated it.
use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use std::collections::{BTreeSet, HashMap};
use std::path::{Component, Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Condvar, Mutex, OnceLock};
use std::time::{Duration, Instant};

/// Announcements of a change are coalesced to at most one per this long.
pub const ANNOUNCE_EVERY: Duration = Duration::from_millis(250);
/// How long a burst of events is allowed to keep growing before it is
/// announced.
const SETTLE: Duration = Duration::from_millis(150);

/// What a reading depends on.
#[derive(Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
pub enum Scope {
    /// Anything under `Control/`.
    Root,
    /// `worktrees/` and the Workcell register.
    Seats,
    /// The AIKit home.
    Aikit,
    /// Anything under `Work/<Name>/`.
    Project(String),
    /// Every other scope: a reading that counts across projects.
    All,
}

impl Scope {
    /// The wire name (`KernelEvent::ReadingsChanged`).
    pub fn wire(&self) -> String {
        match self {
            Self::Root => "root".into(),
            Self::Seats => "seats".into(),
            Self::Aikit => "aikit".into(),
            Self::Project(name) => format!("project:{name}"),
            Self::All => "all".into(),
        }
    }
}

/// The granularity at which a reading's content depends on the clock.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Clock {
    /// The reading does not depend on the time.
    None,
    /// Its content changes with the minute.
    Minute,
    /// Its content changes with the civil day. The civil day is read in
    /// the machine's zone, which can differ from the policy's by a whole
    /// number of hours or a half, so the tick is a quarter hour.
    Day,
}

impl Clock {
    fn tick(self) -> u64 {
        let seconds = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|elapsed| elapsed.as_secs())
            .unwrap_or(0);
        match self {
            Self::None => 0,
            Self::Minute => seconds / 60,
            Self::Day => seconds / (15 * 60),
        }
    }
}

/// The epochs of a reading's scopes (and its clock tick) when its owner
/// read started.
#[derive(Clone, Debug)]
pub struct Stamp {
    taken: Instant,
    /// The watch generation the epochs belong to (`None`: nothing was
    /// watched, the stamp validates by its time-to-live).
    epochs: Option<(u64, Vec<(Scope, u64)>)>,
    clock: Clock,
    tick: u64,
}

impl Stamp {
    pub(crate) fn clock(&self) -> Clock {
        self.clock
    }
    /// This stamp as it would be one tick of its clock earlier.
    #[cfg(test)]
    pub(crate) fn with_tick_before(&self) -> Self {
        Self {
            tick: self.tick.wrapping_sub(1),
            ..self.clone()
        }
    }
}

/// What the watch is given to watch.
#[derive(Clone, Debug)]
pub struct Roots {
    /// Central's root (`Control/`, `Work/`, `worktrees/`).
    pub central: PathBuf,
    /// The AIKit home.
    pub aikit: PathBuf,
    /// Files written by the kernel itself, never a change of any reading.
    pub ignore: Vec<PathBuf>,
}

impl Roots {
    /// The roots this process's owners read: the explicit host root
    /// (`OI_CENTRAL_ROOT`) or `~/Central`, and `AIKIT_HOME` or `~/.aikit`.
    pub fn resolve(configured: Option<&Path>) -> Option<Self> {
        let home = std::env::var_os("HOME").map(PathBuf::from);
        let central = configured
            .map(Path::to_path_buf)
            .or_else(|| {
                std::env::var_os("OI_CENTRAL_ROOT")
                    .filter(|v| !v.is_empty())
                    .map(PathBuf::from)
            })
            .or_else(|| home.as_ref().map(|home| home.join("Central")))?;
        let aikit = std::env::var_os("AIKIT_HOME")
            .filter(|v| !v.is_empty())
            .map(PathBuf::from)
            .or_else(|| home.map(|home| home.join(".aikit")))?;
        let mut ignore = Vec::new();
        if let Some(trace) = std::env::var_os("OI_KERNEL_TRACE_FILE").filter(|v| !v.is_empty()) {
            ignore.push(PathBuf::from(trace));
        }
        Some(Self {
            central,
            aikit,
            ignore,
        })
    }
}

/// A debounced announcement: the scopes that moved and the watch's change
/// counter after the change.
pub type Callback = Box<dyn Fn(Vec<Scope>, u64) + Send + Sync>;

#[derive(Default)]
struct Pending {
    scopes: BTreeSet<Scope>,
    epoch: u64,
    stop: bool,
    /// The first few (scope, path) pairs of the batch, for the trace.
    sample: Vec<(Scope, PathBuf)>,
}

/// Paths named in the trace per announced batch.
const SAMPLE_PATHS: usize = 5;
/// A degraded watch (it could not start) still says "ask again" this often.
pub const DEGRADED_NOTICE_EVERY: Duration = Duration::from_secs(30);

struct Inner {
    live: AtomicBool,
    /// Counts every change seen; the epoch of `Scope::All`.
    global: AtomicU64,
    /// Counts rescans; part of every stamp, so a rescan invalidates all.
    rescans: AtomicU64,
    root: AtomicU64,
    seats: AtomicU64,
    aikit: AtomicU64,
    projects: Mutex<HashMap<String, u64>>,
    /// Scopes the watcher does not cover (validated by time-to-live).
    uncovered: Mutex<BTreeSet<Scope>>,
    pending: Mutex<Pending>,
    wake: Condvar,
    roots: Mutex<Option<Roots>>,
    /// Project directory names under `Work/`, by lower-case name: a reading
    /// names its project the way its owner does (`o-i`), a path names it by
    /// its directory (`O-I`).
    known: Mutex<HashMap<String, String>>,
    /// Re-reads (by the read model) whose answer was byte-identical to the
    /// one before / differed, since the last announcement: the loop breaker's
    /// evidence that a notice is only the owner's own write coming back.
    identical: AtomicU64,
    different: AtomicU64,
    /// The periodic notice of a watch that is not running.
    ticking: AtomicBool,
    period: Mutex<Duration>,
    announce: Mutex<Option<Shared>>,
}

type Shared = Arc<dyn Fn(Vec<Scope>, u64) + Send + Sync>;

/// The change watch. Cloning shares it.
#[derive(Clone)]
pub struct Watch {
    inner: Arc<Inner>,
    watcher: Arc<Mutex<Option<RecommendedWatcher>>>,
}

impl std::fmt::Debug for Watch {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter
            .debug_struct("Watch")
            .field("live", &self.live())
            .field("epoch", &self.epoch())
            .finish()
    }
}

impl Default for Watch {
    fn default() -> Self {
        Self::new()
    }
}

impl Watch {
    /// A watch that watches nothing yet: every stamp validates by
    /// time-to-live until `start` succeeds.
    pub fn new() -> Self {
        Self {
            inner: Arc::new(Inner {
                live: AtomicBool::new(false),
                global: AtomicU64::new(0),
                rescans: AtomicU64::new(0),
                root: AtomicU64::new(0),
                seats: AtomicU64::new(0),
                aikit: AtomicU64::new(0),
                projects: Mutex::new(HashMap::new()),
                uncovered: Mutex::new(BTreeSet::new()),
                pending: Mutex::new(Pending::default()),
                wake: Condvar::new(),
                roots: Mutex::new(None),
                known: Mutex::new(HashMap::new()),
                identical: AtomicU64::new(0),
                different: AtomicU64::new(0),
                ticking: AtomicBool::new(false),
                period: Mutex::new(DEGRADED_NOTICE_EVERY),
                announce: Mutex::new(None),
            }),
            watcher: Arc::new(Mutex::new(None)),
        }
    }

    /// A watch that classifies with `roots` and counts what it is fed
    /// (`ingest`), without a filesystem watcher: for tests of what is built
    /// on epochs.
    #[cfg(test)]
    pub(crate) fn fed(roots: Roots) -> Self {
        let watch = Self::new();
        *watch.inner.roots.lock().unwrap() = Some(roots);
        watch.inner.live.store(true, Ordering::SeqCst);
        watch
    }

    /// The process's watch, shared by the kernel's read model and the host.
    pub fn global() -> &'static Watch {
        static GLOBAL: OnceLock<Watch> = OnceLock::new();
        let watch = GLOBAL.get_or_init(Watch::new);
        // An owner call that may have written moves every reading, without
        // waiting for the watcher to see the files change.
        static HOOKED: std::sync::Once = std::sync::Once::new();
        HOOKED.call_once(|| crate::owner_process::on_write(|| Watch::global().changed_here()));
        watch
    }

    /// Whether epochs can validate readings at all.
    pub fn live(&self) -> bool {
        self.inner.live.load(Ordering::SeqCst)
    }

    /// Whether the watcher covers `scope` (a scope it does not cover
    /// validates by time-to-live).
    pub fn covers(&self, scope: &Scope) -> bool {
        self.live()
            && !self
                .inner
                .uncovered
                .lock()
                .unwrap_or_else(|e| e.into_inner())
                .contains(scope)
    }

    /// The count of changes seen while the watch is running; none when it
    /// cannot say (the signal for a host with no other).
    pub fn change_epoch(&self) -> Option<u64> {
        self.live().then(|| self.epoch())
    }

    /// The count of changes seen.
    pub fn epoch(&self) -> u64 {
        self.inner.global.load(Ordering::SeqCst)
    }

    fn scope_epoch(&self, scope: &Scope) -> u64 {
        match scope {
            Scope::Root => self.inner.root.load(Ordering::SeqCst),
            Scope::Seats => self.inner.seats.load(Ordering::SeqCst),
            Scope::Aikit => self.inner.aikit.load(Ordering::SeqCst),
            Scope::All => self.inner.global.load(Ordering::SeqCst),
            Scope::Project(name) => self
                .inner
                .projects
                .lock()
                .unwrap_or_else(|e| e.into_inner())
                .get(name)
                .copied()
                .unwrap_or(0),
        }
    }

    /// The stamp of a reading about to start, over `scopes`. Capture it
    /// before the owner read begins.
    pub fn stamp(&self, scopes: &[Scope], clock: Clock) -> Stamp {
        let epochs = self.live().then(|| {
            let mut captured: Vec<(Scope, u64)> = scopes
                .iter()
                .map(|scope| (scope.clone(), self.scope_epoch(scope)))
                .collect();
            captured.sort();
            captured.dedup();
            (self.inner.rescans.load(Ordering::SeqCst), captured)
        });
        Stamp {
            taken: Instant::now(),
            epochs,
            clock,
            tick: clock.tick(),
        }
    }

    /// A stamp that only ages: for a reading nothing tracked the start of
    /// (it validates by its time-to-live, never by epochs).
    pub fn stamp_timed(&self) -> Stamp {
        Stamp {
            taken: Instant::now(),
            epochs: None,
            clock: Clock::None,
            tick: 0,
        }
    }

    /// Whether a reading stamped by `stamp` can still be served: no scope it
    /// depends on has moved and its clock tick is unchanged. Where the watch
    /// does not cover the reading (not started, a scope outside it), the
    /// reading is served for `ttl` from the stamp instead.
    pub fn still(&self, stamp: &Stamp, ttl: Duration) -> bool {
        if stamp.clock != Clock::None && stamp.clock.tick() != stamp.tick {
            return false;
        }
        match &stamp.epochs {
            Some((rescans, scopes)) if self.live() => {
                if self.inner.rescans.load(Ordering::SeqCst) != *rescans {
                    return false;
                }
                let covered = scopes.iter().all(|(scope, _)| self.covers(scope));
                if !covered {
                    return stamp.taken.elapsed() < ttl;
                }
                scopes
                    .iter()
                    .all(|(scope, epoch)| self.scope_epoch(scope) == *epoch)
            }
            _ => stamp.taken.elapsed() < ttl,
        }
    }

    /// Whether `stamp` is validated by epochs rather than by its time.
    pub fn by_epochs(&self, stamp: &Stamp) -> bool {
        match &stamp.epochs {
            Some((_, scopes)) => scopes.iter().all(|(scope, _)| self.covers(scope)),
            None => false,
        }
    }

    /// A change this process made itself (a native write): every scope
    /// moves at once, without waiting for the watcher to see it. Nothing is
    /// announced: the watcher sees the same change and announces what moved.
    pub fn changed_here(&self) {
        self.bump_all();
    }

    /// Dropped events, a rescan flag or a ground change: everything moved.
    pub fn rescan(&self) {
        let epoch = self.bump_all();
        self.announce([Scope::All].into(), epoch);
    }

    fn bump_all(&self) -> u64 {
        self.inner.rescans.fetch_add(1, Ordering::SeqCst);
        self.inner.root.fetch_add(1, Ordering::SeqCst);
        self.inner.seats.fetch_add(1, Ordering::SeqCst);
        self.inner.aikit.fetch_add(1, Ordering::SeqCst);
        self.inner
            .projects
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .values_mut()
            .for_each(|epoch| *epoch += 1);
        self.inner.global.fetch_add(1, Ordering::SeqCst) + 1
    }

    /// The scope of the project a reading names (`o-i`, `project:o-i`, a
    /// directory name). A project the watch has not seen under `Work/` could
    /// be any directory, so the reading depends on everything.
    pub fn project_scope(&self, name: &str) -> Scope {
        let lower = name
            .strip_prefix("project:")
            .unwrap_or(name)
            .to_ascii_lowercase();
        match self
            .inner
            .known
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .get(&lower)
        {
            Some(directory) => Scope::Project(directory.clone()),
            None if !self.live() => Scope::Project(name.to_owned()),
            None => Scope::All,
        }
    }

    /// The scopes a reading of `path` (absolute, or relative to Central's
    /// root) depends on; everything when it lies outside what is watched.
    pub fn scopes_of_path(&self, path: &Path) -> Vec<Scope> {
        let roots = self
            .inner
            .roots
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .clone();
        let Some(roots) = roots else {
            return vec![Scope::All];
        };
        let absolute = if path.is_absolute() {
            path.to_path_buf()
        } else {
            roots.central.join(path)
        };
        // The root, `Work/` and `worktrees/` list what lies beneath them:
        // anything that comes or goes under them changes the listing.
        let shallow = absolute
            .strip_prefix(&roots.central)
            .map(|inside| {
                let mut parts = inside.components();
                match (parts.next(), parts.next()) {
                    (None, _) => true,
                    (Some(first), None) => {
                        matches!(first.as_os_str().to_str(), Some("Work" | "worktrees"))
                    }
                    _ => false,
                }
            })
            .unwrap_or(false);
        let scopes = if shallow {
            Vec::new()
        } else {
            classify_path(&roots, &absolute)
        };
        if scopes.is_empty() {
            vec![Scope::All]
        } else {
            scopes
        }
    }

    fn learn_projects(&self, moved: &BTreeSet<Scope>) {
        let mut known = self.inner.known.lock().unwrap_or_else(|e| e.into_inner());
        for scope in moved {
            if let Scope::Project(name) = scope {
                known
                    .entry(name.to_ascii_lowercase())
                    .or_insert_with(|| name.clone());
            }
        }
    }

    /// Record changed paths: move the scopes they belong to, ignoring
    /// noise. The watcher's callback and the tests both come through here.
    pub fn ingest(&self, paths: &[PathBuf]) {
        let roots = self
            .inner
            .roots
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .clone();
        let Some(roots) = roots else { return };
        let mut moved: BTreeSet<Scope> = BTreeSet::new();
        let mut sample: Vec<(Scope, PathBuf)> = Vec::new();
        for path in paths {
            for scope in classify(&roots, path) {
                if sample.len() < SAMPLE_PATHS {
                    sample.push((scope.clone(), path.clone()));
                }
                moved.insert(scope);
            }
        }
        if moved.is_empty() {
            return;
        }
        self.learn_projects(&moved);
        for scope in &moved {
            match scope {
                Scope::Root => {
                    self.inner.root.fetch_add(1, Ordering::SeqCst);
                }
                Scope::Seats => {
                    self.inner.seats.fetch_add(1, Ordering::SeqCst);
                }
                Scope::Aikit => {
                    self.inner.aikit.fetch_add(1, Ordering::SeqCst);
                }
                Scope::Project(name) => {
                    *self
                        .inner
                        .projects
                        .lock()
                        .unwrap_or_else(|e| e.into_inner())
                        .entry(name.clone())
                        .or_insert(0) += 1;
                }
                Scope::All => {}
            }
        }
        let epoch = self.inner.global.fetch_add(1, Ordering::SeqCst) + 1;
        self.announce_with(moved, epoch, sample);
    }

    fn announce(&self, scopes: BTreeSet<Scope>, epoch: u64) {
        self.announce_with(scopes, epoch, Vec::new());
    }

    fn announce_with(&self, scopes: BTreeSet<Scope>, epoch: u64, sample: Vec<(Scope, PathBuf)>) {
        let mut pending = self.inner.pending.lock().unwrap_or_else(|e| e.into_inner());
        pending.scopes.extend(scopes);
        pending.epoch = epoch;
        for entry in sample {
            if pending.sample.len() < SAMPLE_PATHS {
                pending.sample.push(entry);
            }
        }
        self.inner.wake.notify_all();
    }

    /// The read model re-read something a change had ended: whether the
    /// answer was byte-identical to the one before it.
    pub fn note_reread(&self, identical: bool) {
        let counter = if identical {
            &self.inner.identical
        } else {
            &self.inner.different
        };
        counter.fetch_add(1, Ordering::Relaxed);
    }

    /// Say "ask again" for everything, every `period`, from a watch that is
    /// not running: readings are held for their time-to-live only, so the
    /// views that refresh on a notice still refresh. Started once.
    fn degrade(&self, reason: &str) {
        crate::dispatch::trace_watch(&format!("degraded {reason}"));
        if self.inner.ticking.swap(true, Ordering::SeqCst) {
            return;
        }
        let watch = self.clone();
        let _ = std::thread::Builder::new()
            .name("oi-change-watch-degraded".into())
            .spawn(move || loop {
                let period = *watch.inner.period.lock().unwrap_or_else(|e| e.into_inner());
                std::thread::sleep(period);
                if watch.live() {
                    // A later start succeeded: the watcher says what moved.
                    watch.inner.ticking.store(false, Ordering::SeqCst);
                    return;
                }
                let notice = watch
                    .inner
                    .announce
                    .lock()
                    .unwrap_or_else(|e| e.into_inner())
                    .clone();
                let epoch = watch.inner.global.fetch_add(1, Ordering::SeqCst) + 1;
                if let Some(notice) = notice {
                    notice(vec![Scope::All], epoch);
                }
            });
    }

    /// Start watching. `announce` is called from the watch's own thread,
    /// debounced. On failure the watch stays in its degraded mode (every
    /// stamp validates by time-to-live) and the error says why.
    pub fn start(&self, roots: Roots, announce: Callback) -> Result<(), String> {
        if self.live() {
            return Ok(());
        }
        let announce: Shared = Arc::from(announce);
        *self
            .inner
            .announce
            .lock()
            .unwrap_or_else(|e| e.into_inner()) = Some(Arc::clone(&announce));
        let started = self.start_watching(roots, &announce);
        if let Err(reason) = &started {
            self.degrade(reason);
        }
        started
    }

    fn start_watching(&self, roots: Roots, announce: &Shared) -> Result<(), String> {
        let roots = Roots {
            central: canonical(&roots.central),
            aikit: canonical(&roots.aikit),
            ignore: roots.ignore,
        };
        *self.inner.roots.lock().unwrap_or_else(|e| e.into_inner()) = Some(roots.clone());
        if let Ok(projects) = std::fs::read_dir(roots.central.join("Work")) {
            let mut known = self.inner.known.lock().unwrap_or_else(|e| e.into_inner());
            for project in projects.flatten() {
                if let Some(name) = project.file_name().to_str() {
                    known.insert(name.to_ascii_lowercase(), name.to_owned());
                }
            }
        }
        let handler = self.clone();
        let mut watcher = notify::recommended_watcher(move |event: notify::Result<Event>| {
            match event {
                Ok(event) => {
                    if event.need_rescan() {
                        handler.rescan();
                    }
                    if !matches!(event.kind, EventKind::Access(_)) {
                        handler.ingest(&event.paths);
                    }
                }
                // The watcher lost track of something: anything may have changed.
                Err(_) => handler.rescan(),
            }
        })
        .map_err(|error| format!("change watch unavailable: {error}"))?;
        let mut uncovered = BTreeSet::new();
        let mut watched = 0usize;
        for (path, recursive) in watch_plan(&roots, &mut uncovered) {
            let mode = if recursive {
                RecursiveMode::Recursive
            } else {
                RecursiveMode::NonRecursive
            };
            if watcher.watch(&path, mode).is_ok() {
                watched += 1;
            }
        }
        if watched == 0 {
            return Err("change watch unavailable: nothing could be watched".into());
        }
        *self
            .inner
            .uncovered
            .lock()
            .unwrap_or_else(|e| e.into_inner()) = uncovered;
        *self.watcher.lock().unwrap_or_else(|e| e.into_inner()) = Some(watcher);
        self.inner.live.store(true, Ordering::SeqCst);
        let inner = Arc::clone(&self.inner);
        let announce = Arc::clone(announce);
        crate::dispatch::trace_watch(&format!(
            "live {} {}",
            roots.central.display(),
            roots.aikit.display()
        ));
        std::thread::Builder::new()
            .name("oi-change-watch".into())
            .spawn(move || announce_loop(&inner, announce.as_ref()))
            .map_err(|error| format!("change watch unavailable: {error}"))?;
        Ok(())
    }

    /// Stop announcing and watching; stamps validate by time-to-live again.
    pub fn stop(&self) {
        self.inner.live.store(false, Ordering::SeqCst);
        *self.watcher.lock().unwrap_or_else(|e| e.into_inner()) = None;
        let mut pending = self.inner.pending.lock().unwrap_or_else(|e| e.into_inner());
        pending.stop = true;
        self.inner.wake.notify_all();
        drop(pending);
        let was_announcing = self
            .inner
            .announce
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .is_some();
        if was_announcing {
            self.degrade("the watch was stopped");
        }
    }
}

/// Backs off notices that are only the owners' own writes coming back: when
/// the watch has announced in `THRESHOLD` windows within `WITHIN` and the
/// readings re-read in between came back byte-identical, each next
/// announcement waits twice as long as the last (to `CAP`) until a re-read
/// differs or a window passes with no identical re-read. Readings still
/// honour the epochs; only the notices are held back.
#[derive(Debug, Default)]
struct Damper {
    windows: std::collections::VecDeque<Instant>,
    backoff: Duration,
}

const DAMP_THRESHOLD: usize = 8;
const DAMP_WITHIN: Duration = Duration::from_secs(10);
const DAMP_FIRST: Duration = Duration::from_millis(500);
const DAMP_CAP: Duration = Duration::from_secs(30);

impl Damper {
    /// One announcement window closed: how long to hold its notice.
    fn window(&mut self, now: Instant, identical: u64, different: u64) -> Duration {
        while self
            .windows
            .front()
            .is_some_and(|at| now.duration_since(*at) > DAMP_WITHIN)
        {
            self.windows.pop_front();
        }
        self.windows.push_back(now);
        if different > 0 || identical == 0 {
            if self.backoff.is_zero() {
                if different > 0 {
                    self.windows.clear();
                }
                return Duration::ZERO;
            }
            // Damped, and the loop is over: back to announcing at once.
            self.backoff = Duration::ZERO;
            self.windows.clear();
            return Duration::ZERO;
        }
        if !self.backoff.is_zero() {
            self.backoff = (self.backoff * 2).min(DAMP_CAP);
        } else if self.windows.len() >= DAMP_THRESHOLD {
            self.backoff = DAMP_FIRST;
        }
        self.backoff
    }
}

fn announce_loop(inner: &Inner, announce: &(dyn Fn(Vec<Scope>, u64) + Send + Sync)) {
    let mut last: Option<Instant> = None;
    let mut damper = Damper::default();
    loop {
        let mut pending = inner.pending.lock().unwrap_or_else(|e| e.into_inner());
        while pending.scopes.is_empty() && !pending.stop {
            pending = inner.wake.wait(pending).unwrap_or_else(|e| e.into_inner());
        }
        if pending.stop {
            return;
        }
        drop(pending);
        // Let the burst settle, and keep announcements apart.
        let mut wait = SETTLE;
        if let Some(last) = last {
            wait = wait.max(ANNOUNCE_EVERY.saturating_sub(last.elapsed()));
        }
        std::thread::sleep(wait);
        let pending = inner.pending.lock().unwrap_or_else(|e| e.into_inner());
        if pending.stop {
            return;
        }
        drop(pending);
        let hold = damper.window(
            Instant::now(),
            inner.identical.swap(0, Ordering::Relaxed),
            inner.different.swap(0, Ordering::Relaxed),
        );
        if !hold.is_zero() {
            let named: Vec<String> = inner
                .pending
                .lock()
                .unwrap_or_else(|e| e.into_inner())
                .scopes
                .iter()
                .map(Scope::wire)
                .collect();
            crate::dispatch::trace_watch(&format!(
                "damped {} for {} ms",
                named.join(","),
                hold.as_millis()
            ));
            std::thread::sleep(hold);
        }
        let mut pending = inner.pending.lock().unwrap_or_else(|e| e.into_inner());
        if pending.stop {
            return;
        }
        let scopes: Vec<Scope> = std::mem::take(&mut pending.scopes).into_iter().collect();
        let epoch = pending.epoch;
        let sample = std::mem::take(&mut pending.sample);
        drop(pending);
        last = Some(Instant::now());
        for (scope, path) in sample {
            crate::dispatch::trace_watch(&format!("{} {}", scope.wire(), path.display()));
        }
        if !scopes.is_empty() {
            announce(scopes, epoch);
        }
    }
}

fn canonical(path: &Path) -> PathBuf {
    std::fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf())
}

/// Start the process's change watch over the roots its owners read, calling
/// `announce` with the wire names of what moved (`Scope::wire`) and the
/// watch's change count, debounced. On failure the watch stays degraded -
/// readings validate by their time-to-live - and the error says why.
pub fn start_global(
    configured_root: Option<&Path>,
    announce: impl Fn(Vec<String>, u64) + Send + Sync + 'static,
) -> Result<(), String> {
    let announce = Arc::new(announce);
    let clock = Arc::clone(&announce);
    start_clock_notices(move |epoch| clock(vec!["clock".to_owned()], epoch));
    let Some(roots) = Roots::resolve(configured_root) else {
        let reason = "change watch unavailable: no home directory".to_owned();
        // No announce callback exists to tick with yet: bind it, then degrade.
        let watch = Watch::global();
        *watch
            .inner
            .announce
            .lock()
            .unwrap_or_else(|e| e.into_inner()) =
            Some(Arc::new(move |scopes: Vec<Scope>, epoch| {
                announce(scopes.iter().map(Scope::wire).collect(), epoch)
            }));
        watch.degrade(&reason);
        return Err(reason);
    };
    Watch::global().start(
        roots,
        Box::new(move |scopes, epoch| {
            announce(scopes.iter().map(Scope::wire).collect(), epoch);
        }),
    )
}

/// Notices for readings that depend on the clock: at each minute boundary
/// when a retained reading carries a minute dependency, otherwise at the
/// civil-day boundary (machine zone). Nothing is said while nothing depends
/// on the time.
fn start_clock_notices(notice: impl Fn(u64) + Send + 'static) {
    let _ = std::thread::Builder::new()
        .name("oi-clock-notices".into())
        .spawn(move || {
            let today = || jiff::Zoned::now().date();
            let mut day = today();
            loop {
                let into_minute = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .map(|elapsed| elapsed.as_secs() % 60)
                    .unwrap_or(0);
                std::thread::sleep(Duration::from_secs(60 - into_minute));
                let now = today();
                let new_day = now != day;
                day = now;
                if crate::read_cache::ReadModel::global().holds(Clock::Minute) || new_day {
                    notice(Watch::global().epoch());
                }
            }
        });
}

/// What to watch, and the scopes that stay uncovered.
///
/// macOS (FSEvents) and the other recursive-capable backends watch the
/// whole root. Linux (inotify) costs a watch per directory, which a root
/// holding many repositories' working trees makes too heavy: only the
/// bounded set that carries authored ground and git state is watched, and
/// each project's scope outside that set is left uncovered.
fn watch_plan(roots: &Roots, uncovered: &mut BTreeSet<Scope>) -> Vec<(PathBuf, bool)> {
    let mut plan = Vec::new();
    if roots.aikit.exists() {
        plan.push((roots.aikit.clone(), true));
    }
    if !cfg!(target_os = "linux") {
        plan.push((roots.central.clone(), true));
        return plan;
    }
    plan.push((roots.central.join("Control"), true));
    plan.push((roots.central.join("worktrees"), false));
    uncovered.insert(Scope::All);
    if let Ok(projects) = std::fs::read_dir(roots.central.join("Work")) {
        for project in projects.flatten() {
            let dir = project.path();
            if !dir.is_dir() {
                continue;
            }
            let Some(name) = project.file_name().to_str().map(str::to_owned) else {
                continue;
            };
            plan.push((dir.join("ProjectCentral"), true));
            plan.push((dir.join(".git").join("HEAD"), false));
            plan.push((dir.join(".git").join("refs"), true));
            // The working tree itself is not watched.
            uncovered.insert(Scope::Project(name));
        }
    }
    plan.retain(|(path, _)| path.exists());
    plan
}

/// The scopes a changed path moves; none for noise.
pub fn classify(roots: &Roots, path: &Path) -> Vec<Scope> {
    classify_path(roots, path)
}

fn classify_path(roots: &Roots, path: &Path) -> Vec<Scope> {
    if roots.ignore.iter().any(|ignored| path == ignored) {
        return Vec::new();
    }
    let relative_to = |base: &Path| path.strip_prefix(base).ok().map(Path::to_path_buf);
    if let Some(inside) = relative_to(&roots.aikit) {
        return if aikit_noise(&inside) {
            Vec::new()
        } else {
            vec![Scope::Aikit]
        };
    }
    let Some(inside) = relative_to(&roots.central) else {
        return Vec::new();
    };
    if noise(&inside) {
        return Vec::new();
    }
    let mut parts = inside.components().filter_map(|part| match part {
        Component::Normal(part) => part.to_str(),
        _ => None,
    });
    match parts.next() {
        Some("Control") => {
            if inside.ends_with("machines/workcells.register.json") {
                vec![Scope::Root, Scope::Seats]
            } else {
                vec![Scope::Root]
            }
        }
        Some("Work") => match parts.next() {
            // A seat checkout's branch, index and the refs it is counted
            // against live in its product's repository (`Work/<Name>/.git`,
            // `.git/worktrees/<seat>`), not under `worktrees/`.
            Some(name) if parts.next() == Some(".git") => {
                vec![Scope::Project(name.to_owned()), Scope::Seats]
            }
            Some(name) => vec![Scope::Project(name.to_owned())],
            // The Work directory itself: a project was added or removed.
            None => vec![Scope::Root],
        },
        Some("worktrees") => vec![Scope::Seats],
        _ => vec![Scope::Root],
    }
}

/// Paths whose changes are never a change of what an owner reads: build
/// output, dependency trees, git's object store, Finder droppings, and the
/// caches and lock files owners write around their own reads (Central's
/// `.central/bkmr` index and `source-change-horizon.json`, GitNexus's index).
/// Without this a read would announce its own cache write and be asked again.
fn noise(relative: &Path) -> bool {
    let parts = names(relative);
    for (index, part) in parts.iter().enumerate() {
        match *part {
            "target" | "node_modules" | "dist" | ".DS_Store" | ".gitnexus" => return true,
            ".git" => {
                if git_bookkeeping(&parts[index + 1..]) {
                    return true;
                }
            }
            ".central" => {
                if matches!(
                    parts.get(index + 1),
                    Some(&"bkmr") | Some(&"source-change-horizon.json")
                ) {
                    return true;
                }
            }
            _ => {}
        }
    }
    locked(&parts) || transient(&parts)
}

/// Git's own bookkeeping inside a `.git` directory (given as the parts after
/// it; a linked checkout's `worktrees/<name>/` prefix is looked through):
/// its object store, reflogs, and the files git rewrites on every fetch,
/// status or gc. A branch moving (`HEAD`, `refs/**`, `packed-refs`) is a
/// change and is kept.
fn git_bookkeeping(inside: &[&str]) -> bool {
    let inside = match inside {
        ["worktrees", _, rest @ ..] => rest,
        other => other,
    };
    match inside {
        ["objects" | "lfs" | "logs", ..] => true,
        [name] => matches!(
            *name,
            "FETCH_HEAD" | "ORIG_HEAD" | "index" | "COMMIT_EDITMSG" | "gc.log" | "gc.pid" | "locked"
        ),
        _ => false,
    }
}

/// Files that exist while something is written and then replaced or removed:
/// atomic-write and editor temporaries, logs, SQLite shared-memory files.
fn transient(parts: &[&str]) -> bool {
    parts.last().is_some_and(|name| {
        name.ends_with(".tmp")
            || name.contains(".tmp.")
            || name.ends_with(".swp")
            || name.ends_with('~')
            || name.starts_with(".#")
            || name.ends_with(".log")
            || name.ends_with("-shm")
    })
}

/// The same for the AIKit home: its caches, the services it keeps running
/// (the Redis append-only file), its logs, and the state files its own
/// readings refresh (`temporal-floor`, `wiki-projection`, `development-entry`,
/// `knowledge`, the observation database).
fn aikit_noise(relative: &Path) -> bool {
    let parts = names(relative);
    match parts.first() {
        Some(&"cache") | Some(&"services") | Some(&"logs") | Some(&".DS_Store") => return true,
        Some(&"state") => {
            if let Some(name) = parts.get(1) {
                if matches!(
                    *name,
                    "temporal-floor" | "wiki-projection" | "development-entry" | "knowledge"
                ) || name.starts_with("observations.sqlite3")
                {
                    return true;
                }
                // The gateway and the routine dispatcher rewrite their
                // heartbeats every few seconds.
                if matches!(
                    *name,
                    "gateway.json"
                        | "gateway-process.json"
                        | "gateway.sock"
                        | "routine-dispatcher.json"
                        | "encounter-owner.log"
                ) {
                    return true;
                }
            }
        }
        _ => {}
    }
    locked(&parts) || transient(&parts)
}

fn names(relative: &Path) -> Vec<&str> {
    relative
        .components()
        .filter_map(|part| match part {
            Component::Normal(part) => part.to_str(),
            _ => None,
        })
        .collect()
}

/// A lock file an owner creates and removes around a write: `x.lock`,
/// `x.lock.1`, `.wiki.json.publication.lock`, `aikit.sqlite-open.lock`.
fn locked(parts: &[&str]) -> bool {
    parts.last().is_some_and(|name| {
        *name != "Cargo.lock" && (name.ends_with(".lock") || name.contains(".lock."))
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::mpsc;

    fn roots(central: &Path, aikit: &Path) -> Roots {
        Roots {
            central: canonical(central),
            aikit: canonical(aikit),
            ignore: vec![canonical(central).join("trace.log")],
        }
    }

    fn temp(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "oi-watch-{name}-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&dir).unwrap();
        canonical(&dir)
    }

    /// A watch that classifies with `roots` but is fed paths by hand.
    fn fed(roots: &Roots) -> Watch {
        let watch = Watch::new();
        *watch.inner.roots.lock().unwrap() = Some(roots.clone());
        watch.inner.live.store(true, Ordering::SeqCst);
        watch
    }

    #[test]
    fn paths_map_to_scopes_and_noise_moves_nothing() {
        let central = temp("scopes");
        let aikit = temp("scopes-aikit");
        let roots = roots(&central, &aikit);
        let at = |p: &str| classify(&roots, &roots.central.join(p));
        assert_eq!(at("Control/agents/now/a.json"), vec![Scope::Root]);
        assert_eq!(
            at("Work/O-I/src/main.rs"),
            vec![Scope::Project("O-I".into())]
        );
        assert_eq!(at("worktrees/env-1/o-i/x"), vec![Scope::Seats]);
        assert_eq!(
            at("Work/O-I/.git/worktrees/o-i/HEAD"),
            vec![Scope::Project("O-I".into()), Scope::Seats]
        );
        assert_eq!(
            at("Work/O-I/.git/refs/heads/main"),
            vec![Scope::Project("O-I".into()), Scope::Seats]
        );
        assert_eq!(
            at("Control/machines/workcells.register.json"),
            vec![Scope::Root, Scope::Seats]
        );
        assert_eq!(
            classify(&roots, &roots.aikit.join("db")),
            vec![Scope::Aikit]
        );
        assert!(at("Work/O-I/target/debug/x").is_empty());
        assert!(at("Work/O-I/ui/node_modules/a/b.js").is_empty());
        assert!(at("Work/O-I/.git/objects/ab/cdef").is_empty());
        assert!(at("Work/O-I/.git/lfs/tmp/x").is_empty());
        assert_eq!(
            at("Work/O-I/.git/HEAD"),
            vec![Scope::Project("O-I".into()), Scope::Seats]
        );
        assert!(at("Work/O-I/dist/app.js").is_empty());
        assert!(at("Control/.DS_Store").is_empty());
        assert!(at("Control/agents/now/x.lock").is_empty());
        assert!(at("trace.log").is_empty());
        assert!(classify(&roots, Path::new("/elsewhere/file")).is_empty());
    }

    #[test]
    fn a_change_moves_its_scope_and_leaves_unrelated_scopes_valid() {
        let central = temp("epochs");
        let aikit = temp("epochs-aikit");
        let roots = roots(&central, &aikit);
        let watch = fed(&roots);
        let long = Duration::from_secs(3600);
        let root_stamp = watch.stamp(&[Scope::Root], Clock::None);
        let project_stamp = watch.stamp(&[Scope::Project("O-I".into())], Clock::None);
        let all_stamp = watch.stamp(&[Scope::All], Clock::None);
        assert!(watch.still(&root_stamp, long));
        watch.ingest(&[roots.central.join("Work/O-I/a.rs")]);
        assert!(watch.still(&root_stamp, long), "an unrelated scope holds");
        assert!(!watch.still(&project_stamp, long), "its own scope moved");
        assert!(
            !watch.still(&all_stamp, long),
            "all depends on every change"
        );
        // Noise moves nothing.
        let after = watch.stamp(&[Scope::Project("O-I".into())], Clock::None);
        let epoch = watch.epoch();
        watch.ingest(&[roots.central.join("Work/O-I/target/x")]);
        assert_eq!(watch.epoch(), epoch);
        assert!(watch.still(&after, long));
    }

    #[test]
    fn a_rescan_moves_every_scope() {
        let central = temp("rescan");
        let aikit = temp("rescan-aikit");
        let roots = roots(&central, &aikit);
        let watch = fed(&roots);
        let long = Duration::from_secs(3600);
        let stamps: Vec<Stamp> = [
            Scope::Root,
            Scope::Seats,
            Scope::Aikit,
            Scope::Project("Never-Seen".into()),
        ]
        .iter()
        .map(|scope| watch.stamp(std::slice::from_ref(scope), Clock::None))
        .collect();
        assert!(stamps.iter().all(|stamp| watch.still(stamp, long)));
        watch.rescan();
        assert!(stamps.iter().all(|stamp| !watch.still(stamp, long)));
        // A native write moves everything the same way, at once.
        let stamp = watch.stamp(&[Scope::Root], Clock::None);
        watch.changed_here();
        assert!(!watch.still(&stamp, long));
        // An unseen project is any directory: a reading naming it depends on
        // everything; a seen one on its own directory, however it is spelled.
        assert_eq!(watch.project_scope("o-i"), Scope::All);
        watch.ingest(&[roots.central.join("Work/O-I/x")]);
        assert_eq!(watch.project_scope("o-i"), Scope::Project("O-I".into()));
        assert_eq!(
            watch.project_scope("project:O-I"),
            Scope::Project("O-I".into())
        );
    }

    #[test]
    fn a_watch_that_did_not_start_validates_by_time() {
        let watch = Watch::new();
        let stamp = watch.stamp(&[Scope::Root], Clock::None);
        assert!(!watch.live());
        assert!(!watch.by_epochs(&stamp));
        assert!(watch.still(&stamp, Duration::from_secs(60)));
        assert!(!watch.still(&stamp, Duration::ZERO));
    }

    #[test]
    fn an_uncovered_scope_validates_by_time_and_a_clock_tick_expires_a_reading() {
        let central = temp("uncovered");
        let aikit = temp("uncovered-aikit");
        let roots = roots(&central, &aikit);
        let watch = fed(&roots);
        watch
            .inner
            .uncovered
            .lock()
            .unwrap()
            .insert(Scope::Project("Big".into()));
        let stamp = watch.stamp(&[Scope::Project("Big".into())], Clock::None);
        let big = roots.central.join("Work/Big/a");
        watch.ingest(&[big]);
        assert!(!watch.by_epochs(&stamp));
        assert!(
            watch.still(&stamp, Duration::from_secs(60)),
            "time, not epochs"
        );
        let mut aged = watch.stamp(&[Scope::Root], Clock::Minute);
        assert!(watch.still(&aged, Duration::from_secs(60)));
        aged.tick = aged.tick.wrapping_sub(1);
        assert!(!watch.still(&aged, Duration::from_secs(60)));
    }

    #[test]
    fn announcements_are_debounced_and_carry_the_moved_scopes() {
        let central = temp("announce");
        let aikit = temp("announce-aikit");
        let roots = roots(&central, &aikit);
        let watch = fed(&roots);
        // Run the announce loop over the hand-fed watch.
        let (sender, receiver) = mpsc::channel();
        let sender = Mutex::new(sender);
        let callback: Callback = Box::new(move |scopes, epoch| {
            let _ = sender.lock().unwrap().send((scopes, epoch));
        });
        let inner = Arc::clone(&watch.inner);
        std::thread::spawn(move || announce_loop(&inner, &callback));
        for n in 0..5 {
            watch.ingest(&[roots.central.join(format!("Work/A/f{n}"))]);
            watch.ingest(&[roots.central.join(format!("Control/f{n}"))]);
        }
        let (scopes, epoch) = receiver.recv_timeout(Duration::from_secs(3)).unwrap();
        assert_eq!(scopes, vec![Scope::Root, Scope::Project("A".into())]);
        assert_eq!(epoch, watch.epoch());
        assert!(
            receiver.recv_timeout(Duration::from_millis(500)).is_err(),
            "a burst is one announcement"
        );
        watch.stop();
    }

    #[test]
    fn the_real_watcher_sees_files_under_control_and_work_and_ignores_target() {
        let central = temp("real");
        let aikit = temp("real-aikit");
        for dir in ["Control/agents", "Work/X/src", "Work/X/target"] {
            std::fs::create_dir_all(central.join(dir)).unwrap();
        }
        let watch = Watch::new();
        let (sender, receiver) = mpsc::channel();
        let sender = Mutex::new(sender);
        watch
            .start(
                roots(&central, &aikit),
                Box::new(move |scopes, epoch| {
                    let _ = sender.lock().unwrap().send((scopes, epoch));
                }),
            )
            .expect("the watcher starts");
        assert!(watch.live());
        let long = Duration::from_secs(3600);
        let wait_for = |expected: Scope| {
            let deadline = Instant::now() + Duration::from_secs(10);
            while Instant::now() < deadline {
                if let Ok((scopes, _)) = receiver.recv_timeout(Duration::from_millis(500)) {
                    if scopes.contains(&expected) {
                        return;
                    }
                }
            }
            panic!("no announcement for {expected:?}");
        };
        // Let the watcher settle, then drain whatever the setup produced.
        std::thread::sleep(Duration::from_millis(800));
        while receiver.try_recv().is_ok() {}
        let before_root = watch.stamp(&[Scope::Root], Clock::None);
        let before_project = watch.stamp(&[Scope::Project("X".into())], Clock::None);
        std::fs::write(central.join("Control/agents/a.txt"), "1").unwrap();
        wait_for(Scope::Root);
        assert!(!watch.still(&before_root, long));
        assert!(
            watch.still(&before_project, long),
            "the project did not change"
        );
        std::fs::write(central.join("Work/X/src/m.rs"), "1").unwrap();
        wait_for(Scope::Project("X".into()));
        assert!(!watch.still(&before_project, long));
        let ignored = watch.stamp(&[Scope::Project("X".into())], Clock::None);
        std::fs::write(central.join("Work/X/target/out.o"), "1").unwrap();
        std::thread::sleep(Duration::from_secs(2));
        assert!(watch.still(&ignored, long), "target/ is noise");
        watch.stop();
    }

    #[test]
    fn owner_caches_services_logs_and_locks_are_not_changes() {
        let central = temp("owner-noise");
        let aikit = temp("owner-noise-aikit");
        let roots = roots(&central, &aikit);
        let in_aikit = |p: &str| classify(&roots, &roots.aikit.join(p));
        for ignored in [
            "cache/knowledge/discovery",
            "services/redis-now/data/appendonly.aof",
            "logs/today.log",
            "state/temporal-floor",
            "state/wiki-projection",
            "state/development-entry",
            "state/knowledge",
            "state/observations.sqlite3-wal",
            "state/aikit.sqlite-open.lock",
        ] {
            assert!(in_aikit(ignored).is_empty(), "{ignored}");
        }
        assert_eq!(in_aikit("state/aikit.sqlite"), vec![Scope::Aikit]);
        assert_eq!(in_aikit("profiles/p.toml"), vec![Scope::Aikit]);
        let at = |p: &str| classify(&roots, &roots.central.join(p));
        for ignored in [
            "Work/O-I/.central/bkmr/index.db",
            "Work/O-I/.central/source-change-horizon.json",
            "Work/O-I/ProjectCentral/agents/wiki/.wiki.json.publication.lock",
            "Work/O-I/x.lock.1",
            "Work/O-I/.gitnexus/graph.db",
        ] {
            assert!(at(ignored).is_empty(), "{ignored}");
        }
        assert_eq!(
            at("Work/O-I/.central/source-returns/r.json"),
            vec![Scope::Project("O-I".into())]
        );
    }

    #[test]
    fn git_bookkeeping_temporaries_and_heartbeats_are_not_changes() {
        let central = temp("churn-noise");
        let aikit = temp("churn-noise-aikit");
        let roots = roots(&central, &aikit);
        let at = |p: &str| classify(&roots, &roots.central.join(p));
        let in_aikit = |p: &str| classify(&roots, &roots.aikit.join(p));
        for ignored in [
            "Work/O-I/.git/FETCH_HEAD",
            "Work/O-I/.git/ORIG_HEAD",
            "Work/O-I/.git/index",
            "Work/O-I/.git/COMMIT_EDITMSG",
            "Work/O-I/.git/gc.log",
            "Work/O-I/.git/gc.pid",
            "Work/O-I/.git/logs/HEAD",
            "Work/O-I/.git/locked",
            "Work/O-I/.git/worktrees/o-i/FETCH_HEAD",
            "Work/O-I/.git/worktrees/o-i/index",
            "Work/O-I/.git/worktrees/o-i/logs/HEAD",
            "Work/O-I/.git/worktrees/o-i/locked",
            "Work/O-I/src/main.rs.tmp",
            "Work/O-I/src/main.rs.tmp.4812",
            "Work/O-I/src/.main.rs.swp",
            "Work/O-I/src/main.rs~",
            "Work/O-I/src/.#main.rs",
            "Work/O-I/build.log",
            "Work/O-I/db.sqlite-shm",
            "Work/O-I/aikit.sqlite-open.lock",
            "Control/agents/now/draft.md.tmp",
        ] {
            assert!(at(ignored).is_empty(), "{ignored}");
        }
        for ignored in [
            "state/gateway.json",
            "state/gateway.json.tmp",
            "state/gateway-process.json",
            "state/gateway.sock",
            "state/routine-dispatcher.json",
            "state/encounter-owner.log",
        ] {
            assert!(in_aikit(ignored).is_empty(), "{ignored}");
        }
        for moved in [
            "Work/O-I/.git/HEAD",
            "Work/O-I/.git/packed-refs",
            "Work/O-I/.git/refs/heads/dlw/build",
            "Work/O-I/.git/refs/remotes/origin/main",
            "Work/O-I/.git/refs/heads/index",
            "Work/O-I/.git/worktrees/o-i/HEAD",
        ] {
            assert!(
                at(moved).contains(&Scope::Project("O-I".into())),
                "{moved}"
            );
        }
        assert_eq!(in_aikit("state/gateway-registry.json"), vec![Scope::Aikit]);
    }

    /// An owner that writes under a path the watch ignores (its cache) moves
    /// no epoch and announces nothing; one that writes a real path does.
    #[test]
    fn an_owners_cache_write_moves_nothing_and_a_real_write_moves_its_scope() {
        let central = temp("owner-write");
        let aikit = temp("owner-write-aikit");
        for dir in ["Control/agents", "Work/X/.central/bkmr"] {
            std::fs::create_dir_all(central.join(dir)).unwrap();
        }
        std::fs::create_dir_all(aikit.join("cache")).unwrap();
        let watch = Watch::new();
        let (sender, receiver) = mpsc::channel();
        let sender = Mutex::new(sender);
        watch
            .start(
                roots(&central, &aikit),
                Box::new(move |scopes, epoch| {
                    let _ = sender.lock().unwrap().send((scopes, epoch));
                }),
            )
            .expect("the watcher starts");
        std::thread::sleep(Duration::from_millis(800));
        while receiver.try_recv().is_ok() {}
        let owner = |target: &Path| {
            let status = std::process::Command::new("/bin/sh")
                .arg("-c")
                .arg(format!("echo read > '{}'", target.display()))
                .status()
                .unwrap();
            assert!(status.success());
        };
        let before = watch.epoch();
        owner(&aikit.join("cache/discovery"));
        owner(&central.join("Work/X/.central/bkmr/index.db"));
        owner(&central.join("Work/X/.central/source-change-horizon.json"));
        std::thread::sleep(Duration::from_secs(2));
        assert_eq!(
            watch.epoch(),
            before,
            "an owner's own cache write is no change"
        );
        assert!(receiver.try_recv().is_err());
        owner(&central.join("Control/agents/n.json"));
        let (scopes, _) = receiver.recv_timeout(Duration::from_secs(10)).unwrap();
        assert!(scopes.contains(&Scope::Root));
        assert!(watch.epoch() > before);
        watch.stop();
    }

    #[test]
    fn notices_that_are_only_an_owners_own_writes_coming_back_are_damped() {
        let mut damper = Damper::default();
        let start = Instant::now();
        let at = |n: u64| start + Duration::from_millis(500 * n);
        // Seven windows with identical re-reads: not yet.
        for n in 0..7 {
            assert_eq!(damper.window(at(n), 1, 0), Duration::ZERO, "{n}");
        }
        // The eighth within ten seconds starts the backoff, then it doubles to the cap.
        assert_eq!(damper.window(at(7), 1, 0), DAMP_FIRST);
        assert_eq!(damper.window(at(8), 1, 0), DAMP_FIRST * 2);
        let mut last = Duration::ZERO;
        for n in 9..20 {
            last = damper.window(at(n), 1, 0);
        }
        assert_eq!(last, DAMP_CAP);
        // A re-read that differs ends it at once.
        assert_eq!(damper.window(at(21), 1, 1), Duration::ZERO);
        assert_eq!(damper.window(at(22), 1, 0), Duration::ZERO);
        // So does a window with no identical re-read, and a change with no
        // re-read at all is never damped.
        let mut quiet = Damper::default();
        for n in 0..20 {
            assert_eq!(quiet.window(at(n), 0, 0), Duration::ZERO);
        }
    }

    /// A watch that cannot start still says "ask again" on a fixed period, so
    /// the views that refresh on a notice keep refreshing.
    #[test]
    fn a_watch_that_cannot_start_announces_all_on_a_fixed_period() {
        let watch = Watch::new();
        *watch.inner.period.lock().unwrap() = Duration::from_millis(100);
        let (sender, receiver) = mpsc::channel();
        let sender = Mutex::new(sender);
        let missing = std::env::temp_dir().join("oi-watch-missing-root-nothing-here");
        let error = watch
            .start(
                Roots {
                    central: missing.clone(),
                    aikit: missing,
                    ignore: Vec::new(),
                },
                Box::new(move |scopes, epoch| {
                    let _ = sender.lock().unwrap().send((scopes, epoch));
                }),
            )
            .unwrap_err();
        assert!(error.contains("unavailable"), "{error}");
        assert!(!watch.live());
        let first = receiver.recv_timeout(Duration::from_secs(5)).unwrap();
        let second = receiver.recv_timeout(Duration::from_secs(5)).unwrap();
        assert_eq!(first.0, vec![Scope::All]);
        assert_eq!(second.0, vec![Scope::All]);
        assert!(second.1 > first.1, "the epoch advances with each notice");
        // Readings in that mode are bounded by their time-to-live.
        let stamp = watch.stamp(&[Scope::Root], Clock::None);
        assert!(!watch.by_epochs(&stamp));
    }
}
