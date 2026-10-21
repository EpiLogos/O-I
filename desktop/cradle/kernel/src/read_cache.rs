//! Retained, disposable owner readings shared by the application kernel.
//!
//! A retained reading is served only while the kernel can say that the
//! sources it was read from did not change: the change watch (`watch.rs`)
//! stamps a reading with the epochs of the scopes it depends on before its
//! owner read starts, and the reading is valid while those epochs stand. The
//! owner's own revision (`put_at`/`get_at`) is the other such signal. Where
//! no change signal exists - the watcher could not start, a scope it does
//! not cover, a hosted source - a reading is served for a bounded time
//! (`*_TTL`), and the stamp says it is validated by time rather than by
//! epochs. An explicit refresh (`fresh`) and the authority-sensitive reads
//! go to the owner. The owner remains the only store of authored content:
//! a retained reading is a copy that can be dropped at any moment and is
//! never written back.
//!
//! Two layers share this module. `ReadModel` is the one read path for owner
//! readings: `read(key, dep, f)` serves a valid retained reading, joins an
//! identical read in flight (concurrent askers share one owner call), or
//! reads once through `f`. `OwnerReadCache` is the kernel's keyed store for
//! the prepared forms that retain their own typed answers (a listing, the
//! World); its entries are validated the same way.
//!
//! A reading that changed while it was being read is answered to those who
//! asked for it but not retained: the stamp it would have been retained
//! under was taken before the read, and no longer stands.
//!
//! A reading whose answer depends on the clock names the granularity at
//! which its content changes (`watch::Clock`), per owner action in
//! `central_dep`.
//!
//! Churn the kernel did not cause (other sessions' git fetches and edits)
//! moves scopes all the time. A retained reading whose scopes moved is
//! still served while it is younger than its floor - how long it is
//! tolerated to be behind, per class of reading (`floor_of_key`,
//! `central_dep`) - and one trailing notice for its scopes is scheduled for
//! the moment the floor ends, so the views that hold it ask again once the
//! churn has settled. A kernel write, a new minute or day for a reading
//! that depends on the clock, and an explicit fresh read ignore floors.
//!
//! Every reading served through this module is also recorded in the
//! op-wide attribution (`attributed`), so an op's outcome can say which
//! scopes its answer depends on.
//!
//! The read model's readings outlive the process where the filesystem's
//! journal can vouch for them (`kept.rs`): they are written out as they are
//! retained, and the next launch takes back the ones whose scopes the journal
//! shows unchanged since.
use crate::watch::{Clock, Mark, Scope, Stamp, Watch};
use std::any::Any;
use std::cell::RefCell;
use std::collections::{BTreeSet, HashMap};
use std::path::Path;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Condvar, Mutex, OnceLock};
use std::time::{Duration, Instant};

/// How long a reading is served where nothing can say its sources stayed
/// unchanged (the watch is not running, or does not cover its scope). With
/// the watch running these bound nothing: a reading is valid while its
/// scopes' epochs stand.
pub const WORLD_TTL: Duration = Duration::from_millis(4000);
pub const PROJECT_TTL: Duration = Duration::from_millis(4000);
pub const HORIZON_TTL: Duration = Duration::from_millis(2000);
pub const DIR_TTL: Duration = Duration::from_millis(1500);
pub const KNOWLEDGE_TTL: Duration = Duration::from_millis(4000);
pub const GRAPH_TTL: Duration = Duration::from_millis(4000);
const MAX_ENTRIES: usize = 512;
const MAX_BYTES: usize = 32 * 1024 * 1024;

/// How long a reading whose scopes moved is still served (see the module
/// description), by class of reading. Each is the longest a view of that
/// reading may reasonably show an answer older than a change:
/// - default: a person who saves a file and looks again within two seconds
///   should not see a stale answer for long; owners that are cheap read
///   again soon.
pub const DEFAULT_FLOOR: Duration = Duration::from_secs(2);
/// - the World, its project, the census of repositories and the seat
///   standing count across every project and cost many processes; they move
///   with any session's work, and their content (project list, commit
///   counts, branch standing) is not read to the second.
pub const WORLD_FLOOR: Duration = Duration::from_secs(30);
/// - knowledge, the graph and the temporal field (which carries AIKit's
///   history) are large compositions of many owner reads; a quarter minute
///   behind is a fair price for not re-composing them on every notice.
pub const COMPOSED_FLOOR: Duration = Duration::from_secs(15);
/// - AIKit's encounter reads (context, the task read) show a running
///   session; they stay on the default.
pub const ENCOUNTER_FLOOR: Duration = DEFAULT_FLOOR;

/// Whether serving the keyed reading says something about the op being
/// served. The World is also read to find where a project lives, which any
/// op does: that scoping is not what the op's answer depends on, so it is
/// recorded only by the ops whose answer it is (`world_prepared.rs`).
fn is_attributed(key: &str) -> bool {
    key != "world"
}

/// The floor of an `OwnerReadCache` reading by its key.
fn floor_of_key(key: &str) -> Duration {
    if key == "world" {
        WORLD_FLOOR
    } else if key.starts_with("knowledge:")
        || key.starts_with("graph:")
        || key.starts_with("temporal-events:")
    {
        COMPOSED_FLOOR
    } else {
        DEFAULT_FLOOR
    }
}

// ---------------------------------------------------------------------------
// Which scopes an op's answer depends on.
// ---------------------------------------------------------------------------

#[derive(Default)]
struct Attribution {
    scopes: BTreeSet<String>,
    read: bool,
}

type Collector = Arc<Mutex<Attribution>>;

thread_local! {
    static COLLECTOR: RefCell<Option<Collector>> = const { RefCell::new(None) };
}

/// Run `f` and say which scopes the readings it asked through the read
/// model (and the keyed cache), on this thread or on threads started with
/// `carried`, depend on: `None` when it asked none. The caller decides what
/// no reading means.
pub fn attributed<T>(f: impl FnOnce() -> T) -> (T, Option<Vec<String>>) {
    let collector: Collector = Arc::default();
    let before = COLLECTOR.with(|slot| slot.replace(Some(Arc::clone(&collector))));
    struct Restore(Option<Collector>);
    impl Drop for Restore {
        fn drop(&mut self) {
            COLLECTOR.with(|slot| *slot.borrow_mut() = self.0.take());
        }
    }
    let _restore = Restore(before);
    let value = f();
    let seen = collector.lock().unwrap_or_else(|e| e.into_inner());
    let scopes = seen.read.then(|| seen.scopes.iter().cloned().collect());
    (value, scopes)
}

/// Record that the op being served read something that depends on `scopes`
/// (and on the clock when `clock` is not `Clock::None`).
pub(crate) fn note_scopes(scopes: &[Scope], clock: Clock) {
    COLLECTOR.with(|slot| {
        if let Some(collector) = slot.borrow().as_ref() {
            let mut seen = collector.lock().unwrap_or_else(|e| e.into_inner());
            seen.read = true;
            seen.scopes.extend(scopes.iter().map(Scope::wire));
            if clock != Clock::None {
                seen.scopes.insert("clock".to_owned());
            }
        }
    });
}

/// `f` wrapped so that, run on another thread, its readings are recorded
/// for the op that is being served on this one. Every thread a read can
/// run on - `beside`, the readers' pools, `thread::scope` - starts its work
/// through this.
///
/// An explicit refresh (`with_fresh`) is carried the same way: a read the
/// refresh starts on another thread is still a refresh.
pub(crate) fn carried<T>(f: impl FnOnce() -> T + Send) -> impl FnOnce() -> T + Send {
    let collector = COLLECTOR.with(|slot| slot.borrow().clone());
    let fresh = fresh_asked();
    move || {
        let before = COLLECTOR.with(|slot| slot.replace(collector));
        struct Restore(Option<Collector>);
        impl Drop for Restore {
            fn drop(&mut self) {
                COLLECTOR.with(|slot| *slot.borrow_mut() = self.0.take());
            }
        }
        let _restore = Restore(before);
        if fresh {
            with_fresh(f)
        } else {
            f()
        }
    }
}

// ---------------------------------------------------------------------------
// The trailing notice at the end of a floor.
// ---------------------------------------------------------------------------

/// Set when the reading it belongs to is dropped or replaced: its trailing
/// notice is then not sent.
#[derive(Debug, Default)]
struct Withdrawn(Arc<AtomicBool>);
impl Drop for Withdrawn {
    fn drop(&mut self) {
        self.0.store(true, Ordering::SeqCst);
    }
}

struct Due {
    at: Instant,
    watch: Watch,
    scopes: BTreeSet<Scope>,
    withdrawn: Arc<AtomicBool>,
}

#[derive(Default)]
struct Trailing {
    queue: Mutex<Vec<Due>>,
    wake: Condvar,
}

impl Trailing {
    fn global() -> &'static Trailing {
        static GLOBAL: OnceLock<&'static Trailing> = OnceLock::new();
        GLOBAL.get_or_init(|| {
            let trailing: &'static Trailing = Box::leak(Box::default());
            let _ = std::thread::Builder::new()
                .name("oi-trailing-notices".into())
                .spawn(move || trailing.run());
            trailing
        })
    }

    /// Say, at `at`, that readings over `scopes` should be asked again.
    fn schedule(&self, due: Due) {
        self.queue
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .push(due);
        self.wake.notify_all();
    }

    fn run(&self) {
        let mut queue = self.queue.lock().unwrap_or_else(|e| e.into_inner());
        loop {
            let now = Instant::now();
            let (due, waiting): (Vec<Due>, Vec<Due>) = std::mem::take(&mut *queue)
                .into_iter()
                .partition(|d| d.at <= now);
            *queue = waiting;
            for due in due {
                if !due.withdrawn.load(Ordering::SeqCst) {
                    due.watch.notify(due.scopes);
                }
            }
            queue = match queue.iter().map(|d| d.at).min() {
                Some(next) => {
                    self.wake
                        .wait_timeout(queue, next.saturating_duration_since(Instant::now()))
                        .unwrap_or_else(|e| e.into_inner())
                        .0
                }
                None => self.wake.wait(queue).unwrap_or_else(|e| e.into_inner()),
            };
        }
    }
}

/// Schedule the one notice that a reading served inside its floor is due.
fn trail(watch: &Watch, at: Instant, scopes: &[Scope], withdrawn: &Withdrawn) {
    Trailing::global().schedule(Due {
        at,
        watch: watch.clone(),
        scopes: scopes.iter().cloned().collect(),
        withdrawn: Arc::clone(&withdrawn.0),
    });
}

#[derive(Debug)]
struct Entry {
    at: Instant,
    /// What validates the reading: the epochs of its scopes taken before it
    /// was read, or - where the watch does not cover it - its age.
    stamp: Stamp,
    /// Nothing tracked when this reading began (`put` without a finished
    /// `begin`): its stamp was taken as it was retained, so a change while
    /// it was read is not seen, and its age bounds it as well.
    untracked: bool,
    value: serde_json::Value,
    bytes: usize,
    /// The owner's own revision of the retained reading, when it gave one.
    revision: Option<String>,
    /// How long it is served after its scopes moved.
    floor: Duration,
    /// Whether the trailing notice at the end of its floor was scheduled.
    trailing: AtomicBool,
    withdrawn: Withdrawn,
}
/// One owner reading shared by the prepared reads that ask for it while it
/// is in flight or just read (`OwnerReadCache::flight`): the first to
/// execute reads it through the owner, the others wait for that reading and
/// take it. It is held while its scopes' epochs stand (`ttl` where the
/// watch cannot say), counted from before the owner read began. A failed
/// read is not shared: the next reader asks the owner itself.
#[derive(Debug)]
pub struct Flight {
    watch: Watch,
    scopes: Vec<Scope>,
    floor: Duration,
    /// Whether what it serves is recorded for the op (`is_attributed`).
    attributed: bool,
    held: Mutex<Option<FlightHeld>>,
}
#[derive(Debug)]
struct FlightHeld {
    stamp: Stamp,
    value: serde_json::Value,
    trailing: bool,
    withdrawn: Withdrawn,
}
impl Default for Flight {
    fn default() -> Self {
        Self::over(
            Watch::global().clone(),
            vec![Scope::All],
            DEFAULT_FLOOR,
            true,
        )
    }
}
impl Flight {
    fn over(watch: Watch, scopes: Vec<Scope>, floor: Duration, attributed: bool) -> Self {
        Self {
            watch,
            scopes,
            floor,
            attributed,
            held: Mutex::new(None),
        }
    }
    /// The held reading if it stands, or moved only by churn and is younger
    /// than the flight's floor (scheduling the one notice for its end).
    fn serving(&self, held: &mut FlightHeld, ttl: Duration) -> Option<serde_json::Value> {
        let standing = self.watch.still(&held.stamp, ttl);
        let settled = !standing && self.watch.churned(&held.stamp) && held.stamp.age() < self.floor;
        if !(standing || settled) {
            return None;
        }
        if self.attributed {
            note_scopes(&self.scopes, Clock::None);
        }
        if settled && !held.trailing {
            held.trailing = true;
            trail(
                &self.watch,
                Instant::now() + self.floor.saturating_sub(held.stamp.age()),
                &self.scopes,
                &held.withdrawn,
            );
        }
        Some(held.value.clone())
    }
    /// The shared reading, read with `read` only when none is held that
    /// still stands (within `ttl` where the watch cannot say).
    pub fn read(
        &self,
        ttl: Duration,
        read: impl FnOnce() -> Result<serde_json::Value, String>,
    ) -> Result<serde_json::Value, String> {
        let mut held = self.held.lock().unwrap_or_else(|e| e.into_inner());
        if let Some(held) = held.as_mut() {
            if let Some(value) = self.serving(held, ttl) {
                return Ok(value);
            }
        }
        if self.attributed {
            note_scopes(&self.scopes, Clock::None);
        }
        let stamp = self.watch.stamp(&self.scopes, Clock::None);
        let value = read()?;
        *held = Some(FlightHeld {
            stamp,
            value: value.clone(),
            trailing: false,
            withdrawn: Withdrawn::default(),
        });
        Ok(value)
    }
    /// The reading already held that still stands; never waits for one in
    /// flight.
    pub fn held(&self, ttl: Duration) -> Option<serde_json::Value> {
        let mut held = self.held.try_lock().ok()?;
        self.serving(held.as_mut()?, ttl)
    }
    /// Read once and since let go. A flight still reading (or whose read
    /// failed) has not lapsed: a later ask joins it.
    fn lapsed(&self, ttl: Duration) -> bool {
        let lapsed = |held: &Option<FlightHeld>| {
            held.as_ref().is_some_and(|held| {
                !self.watch.still(&held.stamp, ttl)
                    && !(self.watch.churned(&held.stamp) && held.stamp.age() < self.floor)
            })
        };
        match self.held.try_lock() {
            Ok(held) => lapsed(&held),
            Err(std::sync::TryLockError::Poisoned(held)) => lapsed(&held.into_inner()),
            Err(std::sync::TryLockError::WouldBlock) => false,
        }
    }
}
#[derive(Debug)]
pub struct OwnerReadCache {
    watch: Watch,
    /// Whether a moved reading is served for its floor (tests that need the
    /// plain validity of a stamp turn it off).
    floors: bool,
    entries: HashMap<String, Entry>,
    bytes: usize,
    request_clock: u64,
    requests: HashMap<String, u64>,
    /// The stamp of each pending read, taken when it began.
    stamps: HashMap<String, Stamp>,
    /// The stamp of a read that finished, until its reading is retained.
    settled: HashMap<String, Stamp>,
    /// Shared readings by key, each a pending read under its `requests`
    /// ticket: whatever withdraws the ticket withdraws the flight.
    flights: HashMap<String, (u64, Arc<Flight>)>,
}
impl Default for OwnerReadCache {
    fn default() -> Self {
        Self::over(Watch::global().clone())
    }
}
/// The scopes a keyed reading depends on: a listing its directory, the
/// sources' horizon its project and the root, the World Control and every
/// project; any other reading, everything.
fn scopes_for_key(watch: &Watch, key: &str) -> Vec<Scope> {
    if key == "world" {
        return vec![Scope::Root, Scope::Work];
    }
    // A project's place in the World, and its ProjectCentral inspection
    // (`world_prepared.rs`), as `central_dep` scopes them.
    if key.starts_with("project:") {
        return vec![Scope::Root, Scope::Work];
    }
    if let Some(project) = key.strip_prefix("inspect:") {
        return vec![Scope::Root, watch.project_scope(project)];
    }
    if let Some(path) = key.strip_prefix("dir:") {
        return watch.scopes_of_path(Path::new(path));
    }
    if let Some(project) = key.strip_prefix("horizon:") {
        return if project.is_empty() {
            vec![Scope::Root]
        } else {
            vec![Scope::Root, watch.project_scope(project)]
        };
    }
    vec![Scope::All]
}
impl OwnerReadCache {
    fn over(watch: Watch) -> Self {
        Self {
            watch,
            floors: true,
            entries: HashMap::new(),
            bytes: 0,
            request_clock: 0,
            requests: HashMap::new(),
            stamps: HashMap::new(),
            settled: HashMap::new(),
            flights: HashMap::new(),
        }
    }
    /// The reading of `key` every prepared read shares while it is in flight
    /// or was read within `ttl`; otherwise a new one. A flight is a pending
    /// owner read like any other (`begin`): invalidating its key, retaining
    /// a newer reading of it (`put`) or a ground change (`clear`) withdraws
    /// it, so a later ask never joins a reading the cache has let go of.
    pub(crate) fn flight(&mut self, key: &str, ttl: Duration) -> Arc<Flight> {
        if let Some((ticket, flight)) = self.flights.get(key) {
            if self.current(key, *ticket) && !flight.lapsed(ttl) {
                return Arc::clone(flight);
            }
        }
        let ticket = self.begin(key.to_owned());
        let scopes = scopes_for_key(&self.watch, key);
        let flight = Arc::new(Flight::over(
            self.watch.clone(),
            scopes,
            floor_of_key(key),
            is_attributed(key),
        ));
        self.flights
            .insert(key.to_owned(), (ticket, Arc::clone(&flight)));
        flight
    }
    /// The reading a current flight of `key` already holds within `ttl`;
    /// never starts a flight and never waits for one in flight.
    pub(crate) fn flight_held(&self, key: &str, ttl: Duration) -> Option<serde_json::Value> {
        let (ticket, flight) = self.flights.get(key)?;
        if !self.current(key, *ticket) {
            return None;
        }
        flight.held(ttl)
    }
    /// A pending owner read is a distinct observation, not a cache entry.
    /// Latest request wins, and source invalidation also withdraws pending reads.
    pub(crate) fn begin(&mut self, key: String) -> u64 {
        let scopes = scopes_for_key(&self.watch, &key);
        self.begin_in(key, scopes)
    }
    /// `begin` for a read whose sources the caller knows.
    pub(crate) fn begin_in(&mut self, key: String, scopes: Vec<Scope>) -> u64 {
        if is_attributed(&key) {
            note_scopes(&scopes, Clock::None);
            if key.starts_with("temporal-events:") {
                // The temporal field is composed against the time of day.
                note_scopes(&[], Clock::Minute);
            }
        }
        self.request_clock = self
            .request_clock
            .checked_add(1)
            .expect("owner read ticket exhausted");
        if self.requests.len() >= MAX_ENTRIES && !self.requests.contains_key(&key) {
            if let Some(oldest) = self
                .requests
                .iter()
                .min_by_key(|(_, ticket)| *ticket)
                .map(|(key, _)| key.clone())
            {
                self.requests.remove(&oldest);
                self.stamps.remove(&oldest);
            }
        }
        self.stamps
            .insert(key.clone(), self.watch.stamp(&scopes, Clock::None));
        self.requests.insert(key, self.request_clock);
        self.request_clock
    }
    #[cfg(test)]
    fn without_floors(mut self) -> Self {
        self.floors = false;
        self
    }
    pub(crate) fn current(&self, key: &str, ticket: u64) -> bool {
        self.requests.get(key) == Some(&ticket)
    }
    pub(crate) fn finish(&mut self, key: &str, ticket: u64) -> bool {
        if !self.current(key, ticket) {
            return false;
        }
        self.requests.remove(key);
        if let Some(stamp) = self.stamps.remove(key) {
            if self.settled.len() >= MAX_ENTRIES {
                self.settled.clear();
            }
            self.settled.insert(key.to_owned(), stamp);
        }
        true
    }

    /// A finished read's stamp, kept for the reading retained under another
    /// key than the one it was tracked by.
    pub(crate) fn adopt_stamp(&mut self, from: &str, to: &str) {
        if let Some(stamp) = self.settled.remove(from) {
            self.settled.insert(to.to_owned(), stamp);
        }
    }
    /// The scopes a keyed reading of `path` depends on, with the AIKit home
    /// and the root register (owner readings that go through AIKit).
    pub(crate) fn aikit_scopes(&self, path: &Path) -> Vec<Scope> {
        aikit_scopes(&self.watch, path)
    }

    pub fn get(&self, key: &str, ttl: Duration) -> Option<serde_json::Value> {
        let entry = self.entries.get(key)?;
        let standing =
            self.watch.still(&entry.stamp, ttl) && (!entry.untracked || entry.at.elapsed() < ttl);
        let settled = !standing
            && !entry.untracked
            && entry.at.elapsed() < entry.floor
            && self.watch.churned(&entry.stamp);
        if !(standing || settled) {
            return None;
        }
        if is_attributed(key) {
            note_scopes(entry.stamp.scopes(), entry.stamp.clock());
            if key.starts_with("temporal-events:") {
                note_scopes(&[], Clock::Minute);
            }
        }
        if settled && !entry.trailing.swap(true, Ordering::SeqCst) {
            trail(
                &self.watch,
                entry.at + entry.floor,
                entry.stamp.scopes(),
                &entry.withdrawn,
            );
        }
        Some(entry.value.clone())
    }
    pub fn put(&mut self, key: String, value: serde_json::Value) {
        self.retain(key, None, value);
    }
    /// The retained reading only while the owner still discloses `revision`.
    pub fn get_at(&self, key: &str, revision: &str) -> Option<serde_json::Value> {
        let entry = self.entries.get(key)?;
        (entry.revision.as_deref() == Some(revision)).then(|| entry.value.clone())
    }
    /// The owner revision a retained reading was put at, if any.
    pub fn revision_of(&self, key: &str) -> Option<&str> {
        self.entries.get(key)?.revision.as_deref()
    }
    /// Retain an owner reading by the revision the owner gave for it.
    pub fn put_at(&mut self, key: String, revision: String, value: serde_json::Value) {
        self.retain(key, Some(revision), value);
    }
    fn retain(&mut self, key: String, revision: Option<String>, value: serde_json::Value) {
        let bytes = key.len() + value.to_string().len();
        // The stamp the read began under, when `begin`/`finish` tracked it.
        let (stamp, untracked) = match self.settled.remove(&key) {
            // The temporal field also reads the kernel's own event log, which
            // no file change announces: its age bounds it as well.
            Some(stamp) => (stamp, key.starts_with("temporal-events:")),
            None => {
                let scopes = scopes_for_key(&self.watch, &key);
                (self.watch.stamp(&scopes, Clock::None), true)
            }
        };
        self.invalidate(&key);
        if bytes > MAX_BYTES {
            return;
        }
        while self.entries.len() >= MAX_ENTRIES || self.bytes + bytes > MAX_BYTES {
            let oldest = self
                .entries
                .iter()
                .min_by_key(|(_, entry)| entry.at)
                .map(|(key, _)| key.clone());
            if let Some(key) = oldest {
                self.invalidate(&key);
            } else {
                break;
            }
        }
        self.bytes += bytes;
        let key_for_floor = key.clone();
        self.entries.insert(
            key,
            Entry {
                at: Instant::now(),
                stamp,
                untracked,
                value,
                bytes,
                revision,
                floor: if self.floors {
                    floor_of_key(&key_for_floor)
                } else {
                    Duration::ZERO
                },
                trailing: AtomicBool::new(false),
                withdrawn: Withdrawn::default(),
            },
        );
    }
    pub fn invalidate(&mut self, key: &str) {
        self.requests.remove(key);
        self.stamps.remove(key);
        self.settled.remove(key);
        self.flights.remove(key);
        if let Some(entry) = self.entries.remove(key) {
            self.bytes = self.bytes.saturating_sub(entry.bytes);
        }
    }
    pub fn invalidate_prefix(&mut self, prefix: &str) {
        self.requests.retain(|key, _| !key.starts_with(prefix));
        self.stamps.retain(|key, _| !key.starts_with(prefix));
        self.settled.retain(|key, _| !key.starts_with(prefix));
        self.flights.retain(|key, _| !key.starts_with(prefix));
        let keys: Vec<_> = self
            .entries
            .keys()
            .filter(|key| key.starts_with(prefix))
            .cloned()
            .collect();
        for key in keys {
            self.invalidate(&key);
        }
    }
    pub fn clear(&mut self) {
        self.requests.clear();
        self.stamps.clear();
        self.settled.clear();
        self.flights.clear();
        self.entries.clear();
        self.bytes = 0;
    }
}
// ---------------------------------------------------------------------------
// The read model: one path for every owner reading.
// ---------------------------------------------------------------------------

/// What a reading depends on, and how long it is served where the watch
/// cannot say whether it changed.
#[derive(Clone, Debug)]
pub struct Dep {
    pub scopes: Vec<Scope>,
    pub clock: Clock,
    pub ttl: Duration,
    /// How long the reading is still served after its scopes moved.
    pub floor: Duration,
}

impl Dep {
    pub fn new(scopes: Vec<Scope>, ttl: Duration) -> Self {
        Self {
            scopes,
            clock: Clock::None,
            ttl,
            floor: DEFAULT_FLOOR,
        }
    }
    pub fn clock(mut self, clock: Clock) -> Self {
        self.clock = clock;
        self
    }
    pub fn floor(mut self, floor: Duration) -> Self {
        self.floor = floor;
        self
    }
}

const MODEL_MAX_ENTRIES: usize = 1024;
const MODEL_MAX_BYTES: usize = 96 * 1024 * 1024;

type Shared = Arc<dyn Any + Send + Sync>;

/// How a retained reading is written out (`kept.rs`): its JSON encoding.
type Encoder = fn(&(dyn Any + Send + Sync)) -> Option<Vec<u8>>;

fn encode_as<T: serde::Serialize + 'static>(value: &(dyn Any + Send + Sync)) -> Option<Vec<u8>> {
    serde_json::to_vec(value.downcast_ref::<T>()?).ok()
}

/// A reading taken back from the last run, still in the encoding it was
/// written in: the first reader to ask for it decodes it to the type it reads.
struct Restored(Vec<u8>);

fn encode_restored(value: &(dyn Any + Send + Sync)) -> Option<Vec<u8>> {
    Some(value.downcast_ref::<Restored>()?.0.clone())
}

/// A retained reading as it is written out: what it depends on and how to
/// encode it.
pub(crate) struct Keepable {
    pub key: String,
    pub scopes: Vec<Scope>,
    pub clock: Clock,
    pub tick: u64,
    pub ttl: Duration,
    pub floor: Duration,
    value: Shared,
    encode: Encoder,
}

impl Keepable {
    pub(crate) fn encode(&self) -> Option<Vec<u8>> {
        (self.encode)(self.value.as_ref())
    }
    /// Which reading this is: a re-read is another, even when it reads the
    /// same.
    pub(crate) fn identity(&self) -> usize {
        Arc::as_ptr(&self.value) as *const () as usize
    }
}

struct Held {
    value: Shared,
    encode: Encoder,
    stamp: Stamp,
    ttl: Duration,
    floor: Duration,
    bytes: usize,
    at: Instant,
    trailing: bool,
    withdrawn: Withdrawn,
}

/// One read in flight: its stamp (taken before the owner was asked) and,
/// once finished, its outcome.
struct Slot {
    stamp: Stamp,
    ttl: Duration,
    outcome: Mutex<Option<Result<Shared, String>>>,
    done: Condvar,
}

impl Slot {
    fn finish(&self, outcome: Result<Shared, String>) {
        *self.outcome.lock().unwrap_or_else(|e| e.into_inner()) = Some(outcome);
        self.done.notify_all();
    }
    fn wait(&self) -> Result<Shared, String> {
        let mut outcome = self.outcome.lock().unwrap_or_else(|e| e.into_inner());
        loop {
            if let Some(outcome) = outcome.as_ref() {
                return outcome.clone();
            }
            outcome = self.done.wait(outcome).unwrap_or_else(|e| e.into_inner());
        }
    }
}

#[derive(Default)]
struct ModelState {
    entries: HashMap<String, Held>,
    flights: HashMap<String, Arc<Slot>>,
    bytes: usize,
    /// A digest of the last reading each key was asked for, to tell a re-read
    /// that came back unchanged from one that did not.
    digests: HashMap<String, u64>,
    /// Incremented by anything that withdraws every reading (`clear`): a
    /// read that began before cannot be retained after.
    generation: u64,
}

/// Counts of how readings were answered (the trace carries the same).
#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub struct Counts {
    pub hits: u64,
    pub misses: u64,
    pub joined: u64,
    /// Readings served inside their floor after their scopes moved.
    pub settled: u64,
}

/// The read model over a change watch.
///
/// `read(key, dep, f)`: a valid retained reading answers (`hit`); an
/// identical read already in flight is joined (`joined`), so concurrent
/// askers share one owner call; otherwise `f` asks the owner (`miss`) and
/// its reading is retained if its sources did not change while it was read.
/// Readings are retained while the watch can validate them: by epochs, and
/// within their time-to-live where it covers their scopes only in part; with
/// the watch down, concurrent identical reads are still shared but each later
/// read asks the owner again. An explicit fresh read (`with_fresh`) always asks
/// the owner and replaces what was retained.
pub struct ReadModel {
    watch: Watch,
    state: Mutex<ModelState>,
    counts: Mutex<Counts>,
    /// Counts each change of what would be written out (`kept.rs`).
    kept: AtomicU64,
    /// Until when a reader waits for the readings kept from the last run to
    /// be taken back (`None`: no restore under way).
    restoring: Mutex<Option<Instant>>,
    restored: Condvar,
}

thread_local! {
    static FRESH: std::cell::Cell<bool> = const { std::cell::Cell::new(false) };
}

/// Run `f` so that every reading it asks through the model goes to the
/// owner (an explicit refresh), replacing what was retained.
pub fn with_fresh<T>(f: impl FnOnce() -> T) -> T {
    let before = FRESH.with(|fresh| fresh.replace(true));
    let value = f();
    FRESH.with(|fresh| fresh.set(before));
    value
}

fn fresh_asked() -> bool {
    FRESH.with(std::cell::Cell::get)
}

impl ReadModel {
    pub fn over(watch: Watch) -> Self {
        Self {
            watch,
            state: Mutex::new(ModelState::default()),
            counts: Mutex::new(Counts::default()),
            kept: AtomicU64::new(0),
            restoring: Mutex::new(None),
            restored: Condvar::new(),
        }
    }

    /// The process's read model, over the process's watch.
    pub fn global() -> &'static ReadModel {
        static GLOBAL: OnceLock<ReadModel> = OnceLock::new();
        GLOBAL.get_or_init(|| ReadModel::over(Watch::global().clone()))
    }

    pub fn watch(&self) -> &Watch {
        &self.watch
    }

    /// Whether a retained reading depends on the clock at `grain`.
    pub fn holds(&self, grain: Clock) -> bool {
        self.state
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .entries
            .values()
            .any(|held| held.stamp.clock() == grain)
    }

    #[cfg_attr(not(test), allow(dead_code))]
    pub fn counts(&self) -> Counts {
        *self.counts.lock().unwrap_or_else(|e| e.into_inner())
    }

    fn note(&self, key: &str, how: &str) {
        {
            let mut counts = self.counts.lock().unwrap_or_else(|e| e.into_inner());
            match how {
                "hit" | "kept" => counts.hits += 1,
                "miss" => counts.misses += 1,
                "settled" => counts.settled += 1,
                _ => counts.joined += 1,
            }
        }
        crate::dispatch::trace_read(key, how);
    }

    /// Withdraw every retained reading and every read in flight.
    pub fn clear(&self) {
        let mut state = self.state.lock().unwrap_or_else(|e| e.into_inner());
        state.generation += 1;
        state.entries.clear();
        state.flights.clear();
        state.bytes = 0;
        self.kept.fetch_add(1, Ordering::SeqCst);
    }

    /// Readers wait up to `deadline` for the readings kept from the last run
    /// to be taken back, so the first asks after a launch are answered from
    /// them rather than all asking the owners at once.
    pub(crate) fn restoring_until(&self, deadline: Instant) {
        *self.restoring.lock().unwrap_or_else(|e| e.into_inner()) = Some(deadline);
    }

    /// The readings kept from the last run are back (or none could be).
    pub(crate) fn restore_done(&self) {
        *self.restoring.lock().unwrap_or_else(|e| e.into_inner()) = None;
        self.restored.notify_all();
    }

    fn await_restore(&self) {
        let mut restoring = self.restoring.lock().unwrap_or_else(|e| e.into_inner());
        while let Some(deadline) = *restoring {
            let left = deadline.saturating_duration_since(Instant::now());
            if left.is_zero() {
                return;
            }
            restoring = self
                .restored
                .wait_timeout(restoring, left)
                .unwrap_or_else(|e| e.into_inner())
                .0;
        }
    }

    /// Take back one reading kept from the last run, which stood at `mark`
    /// (the journal shows its scopes unchanged since it was written out). A
    /// reading already read in this run is newer and stays.
    pub(crate) fn restore(
        &self,
        key: &str,
        encoded: Vec<u8>,
        stamp: Stamp,
        (ttl, floor): (Duration, Duration),
    ) -> bool {
        let mut state = self.state.lock().unwrap_or_else(|e| e.into_inner());
        if state.entries.contains_key(key) || state.flights.contains_key(key) {
            return false;
        }
        let bytes = key.len() + encoded.len();
        self.retain(
            &mut state,
            key,
            (Arc::new(Restored(encoded)), encode_restored),
            bytes,
            stamp,
            (ttl, floor),
        );
        true
    }

    /// What would be written out now: each retained reading that stands by
    /// the watch's epochs (not by its time alone) and that no new minute
    /// ends (a day's reading is checked against its tick when taken back).
    pub(crate) fn keepable(&self) -> Vec<Keepable> {
        let state = self.state.lock().unwrap_or_else(|e| e.into_inner());
        state
            .entries
            .iter()
            .filter(|(_, held)| {
                held.stamp.clock() != Clock::Minute
                    && self.watch.by_epochs(&held.stamp)
                    && self.watch.still(&held.stamp, held.ttl)
            })
            .map(|(key, held)| Keepable {
                key: key.clone(),
                scopes: held.stamp.scopes().to_vec(),
                clock: held.stamp.clock(),
                tick: held.stamp.tick(),
                ttl: held.ttl,
                floor: held.floor,
                value: Arc::clone(&held.value),
                encode: held.encode,
            })
            .collect()
    }

    /// The count of changes of what would be written out.
    pub(crate) fn kept_generation(&self) -> u64 {
        self.kept.load(Ordering::SeqCst)
    }

    /// The stamp of a reading kept from the last run (`kept.rs`).
    pub(crate) fn stamp_kept(
        &self,
        mark: &Mark,
        scopes: &[Scope],
        clock: Clock,
        tick: u64,
    ) -> Stamp {
        self.watch.stamp_as_of(mark, scopes, clock, tick)
    }

    /// The reading of `key`; see the type's description.
    pub fn read<T, E: std::fmt::Display>(
        &self,
        key: &str,
        dep: &Dep,
        f: impl FnOnce() -> Result<T, E>,
    ) -> Result<T, E>
    where
        T: Clone + serde::Serialize + serde::de::DeserializeOwned + Send + Sync + 'static,
    {
        self.read_if(key, dep, |_| true, f)
    }

    /// `read`, retaining the reading only when `keep` says it is one worth
    /// keeping (an owner's refusal is answered, never retained).
    pub fn read_if<T, E: std::fmt::Display>(
        &self,
        key: &str,
        dep: &Dep,
        keep: impl FnOnce(&T) -> bool,
        f: impl FnOnce() -> Result<T, E>,
    ) -> Result<T, E>
    where
        T: Clone + serde::Serialize + serde::de::DeserializeOwned + Send + Sync + 'static,
    {
        self.await_restore();
        let fresh = fresh_asked();
        note_scopes(&dep.scopes, dep.clock);
        let mut f = Some(f);
        loop {
            let mut state = self.state.lock().unwrap_or_else(|e| e.into_inner());
            if !fresh {
                // Standing: no scope moved. Settled: scopes moved by churn
                // but the reading is younger than its floor.
                let verdict = state.entries.get(key).map(|held| {
                    if self.watch.still(&held.stamp, held.ttl) {
                        Some(false)
                    } else if held.at.elapsed() < held.floor && self.watch.churned(&held.stamp) {
                        Some(true)
                    } else {
                        None
                    }
                });
                match verdict {
                    Some(Some(settled)) => {
                        let held = state.entries.get_mut(key);
                        let mut decoded = false;
                        let served = held.and_then(|held| {
                            if let Some(restored) = held.value.downcast_ref::<Restored>() {
                                // Kept from the last run: decoded once, to the
                                // type it is read as.
                                let value: T = serde_json::from_slice(&restored.0).ok()?;
                                held.value = Arc::new(value);
                                held.encode = encode_as::<T>;
                                decoded = true;
                            }
                            let value = held.value.downcast_ref::<T>().cloned()?;
                            if settled && !held.trailing {
                                held.trailing = true;
                                trail(
                                    &self.watch,
                                    held.at + held.floor,
                                    held.stamp.scopes(),
                                    &held.withdrawn,
                                );
                            }
                            Some(value)
                        });
                        if let Some(value) = served {
                            drop(state);
                            let how = match (settled, decoded) {
                                (true, _) => "settled",
                                (false, true) => "kept",
                                (false, false) => "hit",
                            };
                            self.note(key, how);
                            return Ok(value);
                        }
                        // Held as another type, or kept in a form this type
                        // does not read: asked again.
                        self.drop_entry(&mut state, key);
                    }
                    Some(None) => self.drop_entry(&mut state, key),
                    None => {}
                }
                if let Some(slot) = state.flights.get(key).cloned() {
                    if self.watch.still(&slot.stamp, slot.ttl) {
                        drop(state);
                        // A failed read is not shared: ask again.
                        if let Ok(shared) = slot.wait() {
                            if let Some(value) = shared.downcast_ref::<T>() {
                                self.note(key, "joined");
                                return Ok(value.clone());
                            }
                        }
                        continue;
                    }
                }
            }
            // Ask the owner. The stamp is taken before the read begins.
            let stamp = self.watch.stamp(&dep.scopes, dep.clock);
            let slot = Arc::new(Slot {
                stamp: stamp.clone(),
                ttl: dep.ttl,
                outcome: Mutex::new(None),
                done: Condvar::new(),
            });
            state.flights.insert(key.to_owned(), Arc::clone(&slot));
            let generation = state.generation;
            drop(state);
            self.note(key, "miss");
            let mut leader = Leader {
                model: self,
                key,
                slot: &slot,
                finished: false,
            };
            let read = f.take().expect("a read asks the owner once");
            let result = read();
            // Encode and share the reading once, before taking the model's
            // lock: a large reading (a listing, a document) must not hold
            // every other reader while it is serialised or cloned.
            let shared = result.as_ref().ok().map(|value| {
                (
                    Arc::new(value.clone()) as Shared,
                    serde_json::to_vec(value).ok(),
                )
            });
            let mut state = self.state.lock().unwrap_or_else(|e| e.into_inner());
            if state
                .flights
                .get(key)
                .is_some_and(|current| Arc::ptr_eq(current, &slot))
            {
                state.flights.remove(key);
            }
            if let (Ok(value), Some((shared, encoded))) = (&result, &shared) {
                if let Some(encoded) = encoded {
                    self.note_digest(&mut state, key, encoded);
                }
                // Retained where the watch can say the reading stands: by
                // epochs where it covers every scope, and for the reading's
                // time-to-live too where it covers them only in part (Linux:
                // a project's ProjectCentral and refs, not its working tree).
                // A watch that is down retains nothing.
                let retainable = state.generation == generation
                    && (self.watch.by_epochs(&stamp) || self.watch.live())
                    && self.watch.still(&stamp, dep.ttl)
                    && keep(value);
                if retainable {
                    let bytes = key.len() + encoded.as_ref().map_or(0, Vec::len);
                    self.retain(
                        &mut state,
                        key,
                        (Arc::clone(shared), encode_as::<T>),
                        bytes,
                        stamp,
                        (dep.ttl, dep.floor),
                    );
                }
            }
            drop(state);
            leader.finished = true;
            slot.finish(match (&result, shared) {
                (Ok(_), Some((shared, _))) => Ok(shared),
                (Err(error), _) => Err(error.to_string()),
                (Ok(_), None) => unreachable!("an answered read is shared"),
            });
            return result;
        }
    }

    /// Tell the watch whether this reading is the one the key gave last time
    /// (the loop breaker's evidence that a notice was an owner's own write).
    fn note_digest(&self, state: &mut ModelState, key: &str, bytes: &[u8]) {
        use std::hash::{Hash, Hasher};
        let mut hasher = std::collections::hash_map::DefaultHasher::new();
        bytes.hash(&mut hasher);
        let digest = hasher.finish();
        if state.digests.len() > 4096 {
            state.digests.clear();
        }
        if let Some(before) = state.digests.insert(key.to_owned(), digest) {
            self.watch.note_reread(before == digest);
        }
    }

    fn drop_entry(&self, state: &mut ModelState, key: &str) {
        if let Some(held) = state.entries.remove(key) {
            state.bytes = state.bytes.saturating_sub(held.bytes);
            self.kept.fetch_add(1, Ordering::SeqCst);
        }
    }

    fn retain(
        &self,
        state: &mut ModelState,
        key: &str,
        (value, encode): (Shared, Encoder),
        bytes: usize,
        stamp: Stamp,
        (ttl, floor): (Duration, Duration),
    ) {
        self.drop_entry(state, key);
        if bytes > MODEL_MAX_BYTES / 4 {
            return;
        }
        while state.entries.len() >= MODEL_MAX_ENTRIES || state.bytes + bytes > MODEL_MAX_BYTES {
            let oldest = state
                .entries
                .iter()
                .min_by_key(|(_, held)| held.at)
                .map(|(key, _)| key.clone());
            match oldest {
                Some(oldest) => self.drop_entry(state, &oldest),
                None => break,
            }
        }
        state.bytes += bytes;
        self.kept.fetch_add(1, Ordering::SeqCst);
        state.entries.insert(
            key.to_owned(),
            Held {
                value,
                encode,
                stamp,
                ttl,
                floor,
                bytes,
                at: Instant::now(),
                trailing: false,
                withdrawn: Withdrawn::default(),
            },
        );
    }
}

/// Completes a read's slot with a refusal if the reader unwinds, so those
/// who joined it are never left waiting.
struct Leader<'a> {
    model: &'a ReadModel,
    key: &'a str,
    slot: &'a Arc<Slot>,
    finished: bool,
}

impl Drop for Leader<'_> {
    fn drop(&mut self) {
        if self.finished {
            return;
        }
        let mut state = self.model.state.lock().unwrap_or_else(|e| e.into_inner());
        if state
            .flights
            .get(self.key)
            .is_some_and(|current| Arc::ptr_eq(current, self.slot))
        {
            state.flights.remove(self.key);
        }
        drop(state);
        self.slot
            .finish(Err("the owner read did not complete".into()));
    }
}

/// A native write happened here (an owner write the kernel ran): what was
/// retained from before it, and every read in flight across it, is withdrawn
/// without waiting for the watcher to see the files change.
#[track_caller]
pub fn written() {
    let at = std::panic::Location::caller();
    crate::dispatch::trace_read(&format!("* {}:{}", at.file(), at.line()), "written");
    let watch = Watch::global();
    watch.changed_here();
    ReadModel::global().clear();
}

/// What a reading AIKit makes over `cwd` depends on: its own home, the root
/// register, and wherever `cwd` lies.
pub(crate) fn aikit_scopes(watch: &Watch, cwd: &Path) -> Vec<Scope> {
    let mut scopes = vec![Scope::Aikit, Scope::Root];
    scopes.extend(watch.scopes_of_path(cwd));
    scopes.sort();
    scopes.dedup();
    scopes
}

/// An AIKit reading over `cwd` through the read model. `identity` names the
/// AIKit asked (`agency::Client::identity`), `what` the reading. No clock
/// dependence: AIKit's answers are its journal's and registry's content.
pub(crate) fn aikit_read<T>(
    identity: &str,
    what: &str,
    cwd: &Path,
    read: impl FnOnce() -> Result<T, String>,
) -> Result<T, String>
where
    T: Clone + serde::Serialize + serde::de::DeserializeOwned + Send + Sync + 'static,
{
    let model = ReadModel::global();
    let floor = if what.starts_with("encounter") {
        ENCOUNTER_FLOOR
    } else {
        DEFAULT_FLOOR
    };
    let dep = Dep::new(aikit_scopes(model.watch(), cwd), CENTRAL_TTL).floor(floor);
    model.read(&format!("aikit:{what}:{cwd:?}:{identity}"), &dep, read)
}

const CENTRAL_TTL: Duration = Duration::from_secs(4);

/// The dependencies of one Central owner action, when it is a reading the
/// model retains: its key (the host's owner identity, the action and its
/// input) and what it depends on. A writer or an unknown action is `None`.
///
/// Clock dependence is per action, found by reading the owner's answers:
/// - `central.time.policy` and `central.work.policy` echo the instant they
///   were observed (`local_time`, `observed_at_unix_seconds`, the policy's
///   `expires_at_unix_seconds`, an hour out): minute.
/// - `central.day.read` names the civil day: the day's tick (a quarter hour,
///   since the policy's zone may differ from the machine's by a half hour).
/// - Every other retained action's content is its sources' content; the
///   instants it echoes (`reconciled_at_unix_seconds`, `observed_at`) are
///   when the owner looked, which a retained reading reports as it was.
pub fn central_dep(
    watch: &Watch,
    owner: &str,
    action: &str,
    input: &serde_json::Value,
) -> Option<(String, Dep)> {
    let project = input
        .get("project")
        .and_then(serde_json::Value::as_str)
        .filter(|project| !project.is_empty());
    let project_scopes = || -> Vec<Scope> {
        match project {
            Some(project) => vec![Scope::Root, watch.project_scope(project)],
            None => vec![Scope::Root],
        }
    };
    let path_scopes = || -> Vec<Scope> {
        let path = input
            .pointer("/location/path")
            .or_else(|| input.get("path"))
            .or_else(|| input.get("repo_root"))
            .and_then(serde_json::Value::as_str);
        let root = input
            .pointer("/location/root")
            .and_then(serde_json::Value::as_str);
        match (root, path) {
            (Some(root), Some(path)) => watch.scopes_of_path(&Path::new(root).join(path)),
            (None, Some(path)) => watch.scopes_of_path(Path::new(path)),
            _ => vec![Scope::All],
        }
    };
    let (scopes, clock) = match action {
        // The World counts Control and every project's ground; it reads no
        // seat and nothing of AIKit's.
        "central.world" | "central.world.project" => (vec![Scope::Root, Scope::Work], Clock::None),
        // The census also reads each seat's branch and changed paths.
        "central.git.census" => (vec![Scope::Root, Scope::Work, Scope::Seats], Clock::None),
        "central.git.diff" => (
            watch.scopes_of_path(Path::new(
                input
                    .get("repo_root")
                    .and_then(serde_json::Value::as_str)
                    .unwrap_or(""),
            )),
            Clock::None,
        ),
        "central.time.policy" | "central.work.policy" => (project_scopes(), Clock::Minute),
        "central.day.read" => (project_scopes(), Clock::Day),
        "central.now.list"
        | "central.now.read"
        | "central.now.thoughts.read"
        | "central.now.thoughts.read-batch"
        | "projectcentral.change.horizon"
        | "projectcentral.inspect"
        | "projectcentral.ground.inspect"
        | "projectcentral.source.read"
        | "projectcentral.source.returns"
        | "projectcentral.source.return_read"
        | "central.wiki.read"
        | "projectcentral.wiki.read"
        | "central.document.read"
        | "central.agent-set.read"
        | "central.receiving.list"
        | "central.receiving.read"
        | "agent-profile.roster"
        | "agent-profile.read"
        | "central.world.effective-sources"
        | "central.day.settings.read" => (project_scopes(), Clock::None),
        // The person's notification ledger (Central#288) is the root's own
        // `.central/notifications/ledger.jsonl`: a root path, whatever the project.
        "personal.notifications.list" => (vec![Scope::Root], Clock::None),
        "central.files.read"
        | "central.files.read-batch"
        | "central.files.list"
        | "central.files.history"
        | "central.files.resolve" => (path_scopes(), Clock::None),
        _ => return None,
    };
    let floor = match action {
        "central.world" | "central.world.project" | "central.git.census" => WORLD_FLOOR,
        _ => DEFAULT_FLOOR,
    };
    let key = format!("central:{action}:{input}:{owner}");
    Some((key, Dep::new(scopes, CENTRAL_TTL).clock(clock).floor(floor)))
}

/// Central readings whose names none of the suffixes below marks as one
/// (`-history` and `-sources` are not `.history`).
const CENTRAL_READINGS: [&str; 2] = [
    "central.temporal.source-history",
    "central.world.effective-sources",
];

/// Whether a Central action only reads (so running it moves nothing). Any
/// other action may write, and a write moves every retained reading.
pub fn central_reads(action: &str) -> bool {
    const READING: [&str; 17] = [
        ".roster",
        ".read",
        ".list",
        ".inspect",
        ".policy",
        ".census",
        ".diff",
        ".horizon",
        ".read-batch",
        ".history",
        ".resolve",
        ".world",
        ".returns",
        ".return_read",
        ".recovery_preview",
        ".search",
        // A Preview or Preflight press: `projectcentral.adopt.preview`,
        // `projectcentral.migrate.preview` (lane W3).
        ".preview",
    ];
    action == "central.world"
        || CENTRAL_READINGS.contains(&action)
        || READING.iter().any(|suffix| action.ends_with(suffix))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    #[test]
    fn a_reading_serves_inside_its_ttl_and_expires_after_it() {
        let mut cache = OwnerReadCache::default();
        cache.put("dir:Work".into(), json!({"entries":3}));
        assert_eq!(cache.get("dir:Work", DIR_TTL), Some(json!({"entries":3})));
        assert_eq!(cache.get("dir:Work", Duration::ZERO), None);
    }
    #[test]
    fn a_revisioned_reading_serves_while_its_revision_holds_and_never_by_age() {
        let mut cache = OwnerReadCache::default();
        cache.put_at("doc:a".into(), "rev-1".into(), json!("first"));
        assert_eq!(cache.revision_of("doc:a"), Some("rev-1"));
        // An unmoved revision serves the retained reading, whatever its age.
        assert_eq!(cache.get_at("doc:a", "rev-1"), Some(json!("first")));
        // A moved revision does not: the caller re-reads.
        assert_eq!(cache.get_at("doc:a", "rev-2"), None);
        // A reading retained by time alone is never served as revisioned.
        cache.put("doc:b".into(), json!("timed"));
        assert_eq!(cache.revision_of("doc:b"), None);
        assert_eq!(cache.get_at("doc:b", ""), None);
        // Re-reading at the moved revision replaces the retained one.
        cache.put_at("doc:a".into(), "rev-2".into(), json!("second"));
        assert_eq!(cache.get_at("doc:a", "rev-1"), None);
        assert_eq!(cache.get_at("doc:a", "rev-2"), Some(json!("second")));
        cache.invalidate_prefix("doc:");
        assert_eq!(cache.get_at("doc:a", "rev-2"), None);
        assert_eq!(cache.bytes, 0);
    }
    #[test]
    fn invalidate_removes_one_entry_and_clear_removes_every_entry() {
        let mut cache = OwnerReadCache::default();
        cache.put("world".into(), json!(1));
        cache.put("dir:Work".into(), json!(2));
        cache.invalidate("world");
        assert_eq!(cache.get("world", WORLD_TTL), None);
        assert_eq!(cache.get("dir:Work", DIR_TTL), Some(json!(2)));
        cache.clear();
        assert_eq!(cache.bytes, 0);
        assert_eq!(cache.get("dir:Work", DIR_TTL), None);
    }
    #[test]
    fn knowledge_invalidation_preserves_unrelated_application_resources() {
        let mut cache = OwnerReadCache::default();
        cache.put("knowledge:/world:a".into(), json!({"revision":"r1"}));
        cache.put("world".into(), json!(1));
        cache.invalidate_prefix("knowledge:");
        assert!(cache.get("knowledge:/world:a", KNOWLEDGE_TTL).is_none());
        assert_eq!(cache.get("world", WORLD_TTL), Some(json!(1)));
    }
    #[test]
    fn eviction_is_bounded_and_does_not_clear_the_whole_working_set() {
        let mut cache = OwnerReadCache::default();
        for index in 0..MAX_ENTRIES + 1 {
            cache.put(index.to_string(), json!(index));
        }
        assert_eq!(cache.entries.len(), MAX_ENTRIES);
        assert!(cache.get("0", GRAPH_TTL).is_none());
        assert!(cache.get(&MAX_ENTRIES.to_string(), GRAPH_TTL).is_some());
        let before = cache.bytes;
        cache.put("large".into(), json!("x".repeat(MAX_BYTES + 1)));
        assert_eq!(cache.bytes, before);
    }
    #[test]
    fn pending_reads_cannot_return_after_refresh_or_source_invalidation() {
        let mut cache = OwnerReadCache::default();
        let key = "knowledge:pending:read";
        let older = cache.begin(key.into());
        let newer = cache.begin(key.into());
        assert!(!cache.finish(key, older));
        assert!(cache.current(key, newer));
        cache.invalidate_prefix("knowledge:");
        assert!(!cache.finish(key, newer));
        let before_ground = cache.begin(key.into());
        cache.clear();
        let after_ground = cache.begin(key.into());
        assert!(!cache.finish(key, before_ground));
        assert!(cache.finish(key, after_ground));
    }
    #[test]
    fn a_flight_is_shared_while_in_flight_or_just_read_and_withdrawn_by_the_cache() {
        let mut cache = OwnerReadCache::default();
        let first = cache.flight("world", WORLD_TTL);
        assert!(Arc::ptr_eq(&first, &cache.flight("world", WORLD_TTL)));
        assert_eq!(first.read(WORLD_TTL, || Ok(json!(1))), Ok(json!(1)));
        assert_eq!(first.held(WORLD_TTL), Some(json!(1)));
        assert!(
            Arc::ptr_eq(&first, &cache.flight("world", WORLD_TTL)),
            "a reading just read is shared"
        );
        assert!(
            !Arc::ptr_eq(&first, &cache.flight("world", Duration::ZERO)),
            "a reading past its TTL is read again"
        );
        // A world change withdraws the flight: invalidation, a newer
        // retained reading, a ground change.
        let flight = cache.flight("world", WORLD_TTL);
        cache.invalidate("world");
        assert!(!Arc::ptr_eq(&flight, &cache.flight("world", WORLD_TTL)));
        let flight = cache.flight("world", WORLD_TTL);
        cache.put("world".into(), json!(2));
        assert!(!Arc::ptr_eq(&flight, &cache.flight("world", WORLD_TTL)));
        let flight = cache.flight("world", WORLD_TTL);
        cache.clear();
        assert!(!Arc::ptr_eq(&flight, &cache.flight("world", WORLD_TTL)));
    }
    #[test]
    fn one_flight_reads_once_for_its_readers_and_never_shares_a_failure() {
        use std::sync::atomic::{AtomicUsize, Ordering};
        let flight = Arc::new(Flight::default());
        let reads = Arc::new(AtomicUsize::new(0));
        let readers: Vec<_> = (0..4)
            .map(|_| {
                let (flight, reads) = (Arc::clone(&flight), Arc::clone(&reads));
                std::thread::spawn(move || {
                    flight.read(WORLD_TTL, || {
                        reads.fetch_add(1, Ordering::SeqCst);
                        std::thread::sleep(Duration::from_millis(50));
                        Ok(json!("world"))
                    })
                })
            })
            .collect();
        for reader in readers {
            assert_eq!(reader.join().unwrap(), Ok(json!("world")));
        }
        assert_eq!(reads.load(Ordering::SeqCst), 1);
        let failing = Flight::default();
        assert!(failing
            .read(WORLD_TTL, || Err("owner unavailable".into()))
            .is_err());
        assert_eq!(failing.held(WORLD_TTL), None);
        assert_eq!(
            failing.read(WORLD_TTL, || Ok(json!(1))),
            Ok(json!(1)),
            "the next reader asks the owner itself"
        );
    }
    #[test]
    fn unrelated_reads_do_not_cancel_each_other_and_tickets_are_bounded() {
        let mut cache = OwnerReadCache::default();
        let first = cache.begin("knowledge:pending:one".into());
        cache.put("world".into(), json!("native root"));
        cache.invalidate("dir:Work");
        assert!(cache.current("knowledge:pending:one", first));
        for n in 0..MAX_ENTRIES {
            cache.begin(format!("knowledge:pending:{n}"));
        }
        assert_eq!(cache.requests.len(), MAX_ENTRIES);
        assert!(!cache.finish("knowledge:pending:one", first));
    }

    // --- the read model ---

    use crate::watch::{Roots, Watch};
    use std::path::PathBuf;
    use std::sync::atomic::{AtomicUsize, Ordering};

    fn fed_roots() -> Roots {
        Roots {
            central: PathBuf::from("/central"),
            aikit: PathBuf::from("/aikit"),
            ignore: Vec::new(),
            kept: None,
        }
    }
    fn changed(watch: &Watch, path: &str) {
        watch.ingest(&[PathBuf::from("/central").join(path)]);
    }
    fn root_dep() -> Dep {
        Dep::new(vec![Scope::Root], Duration::from_secs(60))
    }

    #[test]
    fn concurrent_identical_reads_share_one_owner_call() {
        let model = Arc::new(ReadModel::over(Watch::fed(fed_roots())));
        let owner = Arc::new(AtomicUsize::new(0));
        let readers: Vec<_> = (0..6)
            .map(|_| {
                let (model, owner) = (Arc::clone(&model), Arc::clone(&owner));
                std::thread::spawn(move || {
                    model.read("now:list", &root_dep(), || -> Result<_, String> {
                        owner.fetch_add(1, Ordering::SeqCst);
                        std::thread::sleep(Duration::from_millis(150));
                        Ok(json!({"records": 3}))
                    })
                })
            })
            .collect();
        for reader in readers {
            assert_eq!(reader.join().unwrap(), Ok(json!({"records": 3})));
        }
        assert_eq!(owner.load(Ordering::SeqCst), 1);
        let counts = model.counts();
        assert_eq!(counts.misses, 1);
        assert_eq!(counts.hits + counts.joined, 5);
    }

    #[test]
    fn a_reading_is_retained_until_its_scope_changes_and_unrelated_changes_leave_it() {
        let watch = Watch::fed(fed_roots());
        let model = ReadModel::over(watch.clone());
        let owner = AtomicUsize::new(0);
        let ask = |key: &str, dep: &Dep| {
            model
                .read(key, dep, || -> Result<_, String> {
                    Ok(owner.fetch_add(1, Ordering::SeqCst))
                })
                .unwrap()
        };
        let project =
            Dep::new(vec![Scope::Project("A".into())], Duration::ZERO).floor(Duration::ZERO);
        assert_eq!(ask("a", &project), 0);
        // The retention does not depend on its time-to-live while the watch runs.
        assert_eq!(ask("a", &project), 0);
        changed(&watch, "Work/B/file");
        assert_eq!(ask("a", &project), 0, "an unrelated project changed");
        changed(&watch, "Control/agents/x");
        assert_eq!(ask("a", &project), 0, "the root is not this project's");
        changed(&watch, "Work/A/file");
        assert_eq!(ask("a", &project), 1, "its own scope changed: read again");
        assert_eq!(ask("a", &project), 1);
        // A rescan (dropped events) and a native write move everything.
        watch.rescan();
        assert_eq!(ask("a", &project), 2);
        watch.changed_here();
        assert_eq!(ask("a", &project), 3);
        // A noisy path moves nothing.
        changed(&watch, "Work/A/target/debug/x");
        assert_eq!(ask("a", &project), 3);
    }

    #[test]
    fn a_reading_that_changed_while_it_was_read_is_answered_but_not_retained() {
        let watch = Watch::fed(fed_roots());
        let model = ReadModel::over(watch.clone());
        let dep = Dep::new(vec![Scope::Project("A".into())], Duration::from_secs(60));
        let first = model.read("a", &dep, || -> Result<_, String> {
            // The sources change after the owner was asked, before it answered.
            changed(&watch, "Work/A/file");
            Ok("before the change".to_owned())
        });
        assert_eq!(first, Ok("before the change".to_owned()));
        let again = model.read("a", &dep, || -> Result<_, String> {
            Ok("after the change".to_owned())
        });
        assert_eq!(
            again,
            Ok("after the change".to_owned()),
            "the first reading was not kept"
        );
        let kept = model.read("a", &dep, || -> Result<_, String> {
            Ok("never asked".to_owned())
        });
        assert_eq!(kept, Ok("after the change".to_owned()));
        // A read that began before a change is not joined by one after it.
        let model = Arc::new(ReadModel::over(watch.clone()));
        let (started, release) = std::sync::mpsc::channel::<()>();
        let (go, wait) = std::sync::mpsc::channel::<()>();
        let slow = {
            let (model, dep) = (Arc::clone(&model), dep.clone());
            std::thread::spawn(move || {
                model.read("b", &dep, || -> Result<_, String> {
                    started.send(()).unwrap();
                    wait.recv().unwrap();
                    Ok("old".to_owned())
                })
            })
        };
        release.recv().unwrap();
        changed(&watch, "Work/A/file");
        let newer = model.read("b", &dep, || -> Result<_, String> { Ok("new".to_owned()) });
        assert_eq!(
            newer,
            Ok("new".to_owned()),
            "a read after the change asks the owner"
        );
        go.send(()).unwrap();
        assert_eq!(slow.join().unwrap(), Ok("old".to_owned()));
    }

    #[test]
    fn a_fresh_read_asks_the_owner_and_replaces_what_was_retained() {
        let model = ReadModel::over(Watch::fed(fed_roots()));
        let owner = AtomicUsize::new(0);
        let ask = || {
            model
                .read("k", &root_dep(), || -> Result<_, String> {
                    Ok(owner.fetch_add(1, Ordering::SeqCst))
                })
                .unwrap()
        };
        assert_eq!(ask(), 0);
        assert_eq!(with_fresh(ask), 1);
        assert_eq!(ask(), 1, "the fresh reading replaced the retained one");
        assert_eq!(owner.load(Ordering::SeqCst), 2);
    }

    #[test]
    fn a_refusal_is_not_shared_or_retained_and_a_kept_test_can_decline() {
        let model = ReadModel::over(Watch::fed(fed_roots()));
        let owner = AtomicUsize::new(0);
        assert!(model
            .read("k", &root_dep(), || -> Result<u32, String> {
                owner.fetch_add(1, Ordering::SeqCst);
                Err("owner unavailable".into())
            })
            .is_err());
        assert_eq!(
            model.read("k", &root_dep(), || -> Result<_, String> { Ok(1) }),
            Ok(1)
        );
        let declined = |value: u32| {
            model.read_if(
                "d",
                &root_dep(),
                |value: &u32| *value > 1,
                || -> Result<_, String> { Ok(value) },
            )
        };
        assert_eq!(declined(1), Ok(1));
        assert_eq!(declined(2), Ok(2), "a declined reading was asked again");
        assert_eq!(declined(3), Ok(2), "a kept one is served");
    }

    #[test]
    fn a_watch_that_is_not_running_shares_concurrent_reads_but_retains_nothing() {
        let model = Arc::new(ReadModel::over(Watch::new()));
        let owner = Arc::new(AtomicUsize::new(0));
        let ask = |model: &ReadModel, owner: &AtomicUsize| {
            model
                .read("k", &root_dep(), || -> Result<_, String> {
                    owner.fetch_add(1, Ordering::SeqCst);
                    std::thread::sleep(Duration::from_millis(100));
                    Ok(1)
                })
                .unwrap()
        };
        let readers: Vec<_> = (0..4)
            .map(|_| {
                let (model, owner) = (Arc::clone(&model), Arc::clone(&owner));
                std::thread::spawn(move || ask(&model, &owner))
            })
            .collect();
        readers.into_iter().for_each(|r| {
            r.join().unwrap();
        });
        assert_eq!(owner.load(Ordering::SeqCst), 1);
        ask(&model, &owner);
        assert_eq!(owner.load(Ordering::SeqCst), 2, "nothing was retained");
    }

    /// Linux watches a project's ProjectCentral and refs but not its working
    /// tree: a reading over that project is still retained, ends on what the
    /// watch does see, and is bounded by its time-to-live for the rest.
    #[test]
    fn a_partly_covered_scope_is_retained_for_its_time_to_live() {
        let watch = Watch::fed(fed_roots());
        let project = Scope::Project("X".into());
        watch.uncover(project.clone());
        let model = ReadModel::over(watch);
        let dep = Dep::new(vec![Scope::Root, project], Duration::from_millis(300));
        let owner = AtomicUsize::new(0);
        let ask = || {
            model
                .read("x", &dep, || -> Result<_, String> {
                    Ok(owner.fetch_add(1, Ordering::SeqCst))
                })
                .unwrap()
        };
        assert_eq!(ask(), 0);
        assert_eq!(
            ask(),
            0,
            "retained: nothing seen moved, within its time-to-live"
        );
        changed(model.watch(), "Work/X/ProjectCentral/a.json");
        std::thread::sleep(Duration::from_millis(50));
        assert_eq!(ask(), 1, "a change the watch saw under it ends it");
        std::thread::sleep(Duration::from_millis(350));
        assert_eq!(
            ask(),
            2,
            "and its time-to-live bounds what the watch cannot see"
        );
    }

    #[test]
    fn a_clock_dependence_ends_a_retained_reading_at_its_granularity() {
        let model = ReadModel::over(Watch::fed(fed_roots()));
        let dep = root_dep().clock(Clock::Minute);
        let owner = AtomicUsize::new(0);
        let ask = || {
            model
                .read("t", &dep, || -> Result<_, String> {
                    Ok(owner.fetch_add(1, Ordering::SeqCst))
                })
                .unwrap()
        };
        assert_eq!(ask(), 0);
        assert_eq!(ask(), 0);
        // Age the retained reading's tick by a minute.
        let mut state = model.state.lock().unwrap();
        for held in state.entries.values_mut() {
            held.stamp = held.stamp.with_tick_before();
        }
        drop(state);
        assert_eq!(ask(), 1);
    }

    #[test]
    fn central_readings_name_their_scopes_and_writers_are_not_readings() {
        let watch = Watch::fed(fed_roots());
        watch.ingest(&[PathBuf::from("/central/Work/O-I/x")]);
        let dep =
            |action: &str, input: serde_json::Value| central_dep(&watch, "owner", action, &input);
        let (key, now) = dep("central.now.list", json!({"project":"o-i"})).unwrap();
        assert!(key.contains("central.now.list") && key.contains("o-i"));
        assert_eq!(now.scopes, vec![Scope::Root, Scope::Project("O-I".into())]);
        assert_eq!(
            dep("central.now.list", json!({})).unwrap().1.scopes,
            vec![Scope::Root]
        );
        assert_eq!(
            dep("central.time.policy", json!({})).unwrap().1.clock,
            Clock::Minute
        );
        assert_eq!(
            dep("central.day.read", json!({})).unwrap().1.clock,
            Clock::Day
        );
        assert_eq!(
            dep(
                "central.files.read",
                json!({"location":{"path":"/central/Work/O-I/a.md"}})
            )
            .unwrap()
            .1
            .scopes,
            vec![Scope::Project("O-I".into())]
        );
        // The World reads no seat and nothing of AIKit's; the census also
        // reads the seats.
        assert_eq!(
            dep("central.world", json!({})).unwrap().1.scopes,
            vec![Scope::Root, Scope::Work]
        );
        assert_eq!(
            dep("central.git.census", json!({})).unwrap().1.scopes,
            vec![Scope::Root, Scope::Work, Scope::Seats]
        );
        assert!(dep("central.files.write", json!({})).is_none());
        assert!(dep("projectcentral.now.return", json!({})).is_none());
        // The person's notification ledger is the root's own, whatever the
        // project (Central#288), and a change to it is a root change.
        assert_eq!(
            dep("personal.notifications.list", json!({"project": "O-I"}))
                .unwrap()
                .1
                .scopes,
            vec![Scope::Root]
        );
        assert!(dep("personal.notify", json!({})).is_none());
        assert_eq!(
            watch.scopes_of_path(Path::new("/central/.central/notifications/ledger.jsonl")),
            vec![Scope::Root]
        );
        assert!(central_reads("central.agent-set.read") && central_reads("central.world"));
        // Readings no suffix names are still readings: running one never
        // withdraws what the model holds.
        assert!(central_reads("central.world.effective-sources"));
        assert!(central_reads("central.temporal.source-history"));
        assert_eq!(
            dep("central.world.effective-sources", json!({"project": "O-I"}))
                .unwrap()
                .1
                .scopes
                .len(),
            2
        );
        assert!(
            !central_reads("central.files.write") && !central_reads("projectcentral.now.return")
        );
        // A preview is a reading; the act it previews is not.
        assert!(
            central_reads("projectcentral.adopt.preview")
                && central_reads("projectcentral.migrate.preview")
        );
        assert!(!central_reads("projectcentral.adopt") && !central_reads("projectcentral.migrate"));
    }

    #[test]
    fn a_keyed_reading_is_valid_while_its_scopes_stand_not_for_its_age() {
        let watch = Watch::fed(fed_roots());
        let mut cache = OwnerReadCache::over(watch.clone()).without_floors();
        let key = "dir:/central/Work/A";
        let ticket = cache.begin(key.into());
        assert!(cache.finish(key, ticket));
        cache.put(key.into(), json!({"entries": 2}));
        // Long past its time-to-live, but nothing it depends on changed.
        assert_eq!(cache.get(key, Duration::ZERO), Some(json!({"entries": 2})));
        changed(&watch, "Work/B/x");
        assert_eq!(cache.get(key, Duration::ZERO), Some(json!({"entries": 2})));
        changed(&watch, "Work/A/x");
        assert_eq!(cache.get(key, Duration::ZERO), None);
        // A change during the read: the reading began under the older stamp.
        let ticket = cache.begin(key.into());
        changed(&watch, "Work/A/y");
        assert!(cache.finish(key, ticket));
        cache.put(key.into(), json!({"entries": 3}));
        assert_eq!(cache.get(key, Duration::from_secs(60)), None);
        // A reading nothing tracked the start of is held for its time only.
        cache.put("world".into(), json!(1));
        assert_eq!(cache.get("world", Duration::from_secs(60)), Some(json!(1)));
        assert_eq!(cache.get("world", Duration::ZERO), None);
    }

    /// A watch over the fed roots whose announcements go to the channel.
    fn announcing(watch_roots: Roots) -> (Watch, std::sync::mpsc::Receiver<(Vec<Scope>, u64)>) {
        let (sender, receiver) = std::sync::mpsc::channel();
        let sender = Mutex::new(sender);
        let watch = Watch::fed_announcing(
            watch_roots,
            Box::new(move |scopes, epoch| {
                let _ = sender.lock().unwrap().send((scopes, epoch));
            }),
        );
        (watch, receiver)
    }

    fn drain(
        receiver: &std::sync::mpsc::Receiver<(Vec<Scope>, u64)>,
        within: Duration,
    ) -> Vec<Vec<Scope>> {
        let until = Instant::now() + within;
        let mut seen = Vec::new();
        while let Some(left) = until.checked_duration_since(Instant::now()) {
            if let Ok((scopes, _)) = receiver.recv_timeout(left) {
                seen.push(scopes);
            }
        }
        seen
    }

    #[test]
    fn a_moved_reading_inside_its_floor_is_served_and_one_notice_follows_its_end() {
        let (watch, receiver) = announcing(fed_roots());
        let model = ReadModel::over(watch.clone());
        let owner = AtomicUsize::new(0);
        let ask = || {
            model
                .read(
                    "a",
                    &Dep::new(vec![Scope::Project("A".into())], Duration::from_secs(60))
                        .floor(Duration::from_millis(900)),
                    || -> Result<_, String> { Ok(owner.fetch_add(1, Ordering::SeqCst)) },
                )
                .unwrap()
        };
        assert_eq!(ask(), 0);
        changed(&watch, "Work/A/file");
        // The scope moved, the reading is younger than its floor: served,
        // however often it is asked, and counted as settled.
        assert_eq!(ask(), 0);
        assert_eq!(ask(), 0);
        assert_eq!(model.counts().settled, 2);
        assert_eq!(model.counts().misses, 1);
        // The change's own notice (a project's change names work too), then
        // exactly one trailing notice for the reading's scopes when its
        // floor ends.
        let notices = drain(&receiver, Duration::from_millis(2500));
        assert_eq!(
            notices,
            vec![
                vec![Scope::Work, Scope::Project("A".into())],
                vec![Scope::Project("A".into())]
            ],
            "the change, then one trailing notice"
        );
        // Past its floor the moved reading is a miss.
        assert_eq!(ask(), 1);
        assert_eq!(owner.load(Ordering::SeqCst), 2);
        watch.stop();
    }

    #[test]
    fn a_reading_replaced_inside_its_floor_sends_no_trailing_notice() {
        let (watch, receiver) = announcing(fed_roots());
        let model = ReadModel::over(watch.clone());
        let dep = Dep::new(vec![Scope::Project("A".into())], Duration::from_secs(60))
            .floor(Duration::from_millis(700));
        let ask = |fresh: bool| {
            let read = || {
                model
                    .read("a", &dep, || -> Result<_, String> { Ok(1) })
                    .unwrap()
            };
            if fresh {
                with_fresh(read)
            } else {
                read()
            }
        };
        ask(false);
        changed(&watch, "Work/A/file");
        ask(false);
        ask(true);
        let notices = drain(&receiver, Duration::from_millis(1800));
        assert_eq!(
            notices.len(),
            1,
            "only the change's own notice: {notices:?}"
        );
        watch.stop();
    }

    #[test]
    fn a_fresh_read_a_native_write_and_a_new_tick_ignore_the_floor() {
        let (watch, _receiver) = announcing(fed_roots());
        let model = ReadModel::over(watch.clone());
        let owner = AtomicUsize::new(0);
        let dep = Dep::new(vec![Scope::Project("A".into())], Duration::from_secs(60))
            .floor(Duration::from_secs(60));
        let ask = || {
            model
                .read("a", &dep, || -> Result<_, String> {
                    Ok(owner.fetch_add(1, Ordering::SeqCst))
                })
                .unwrap()
        };
        assert_eq!(ask(), 0);
        changed(&watch, "Work/A/file");
        assert_eq!(ask(), 0, "inside the floor");
        assert_eq!(with_fresh(ask), 1, "a fresh read goes to the owner");
        assert_eq!(ask(), 1);
        watch.changed_here();
        assert_eq!(ask(), 2, "the kernel's own write ends the floor");
        // A reading that depends on the minute is not served past the tick.
        let minute = Dep::new(vec![Scope::Root], Duration::from_secs(60))
            .clock(Clock::Minute)
            .floor(Duration::from_secs(60));
        let first = model
            .read("m", &minute, || -> Result<_, String> { Ok(1) })
            .unwrap();
        assert_eq!(first, 1);
        changed(&watch, "Control/x");
        assert_eq!(
            model.read("m", &minute, || -> Result<_, String> { Ok(2) }),
            Ok(1),
            "inside the floor, same minute"
        );
        watch.stop();
    }

    #[test]
    fn a_keyed_reading_that_moved_is_served_inside_its_floor() {
        let (watch, receiver) = announcing(fed_roots());
        let mut cache = OwnerReadCache::over(watch.clone());
        let key = "world";
        let ticket = cache.begin(key.into());
        assert!(cache.finish(key, ticket));
        cache.put(key.into(), json!({"projects": 3}));
        changed(&watch, "Work/A/x");
        assert_eq!(
            cache.get(key, Duration::from_secs(60)),
            Some(json!({"projects": 3})),
            "the World is tolerated behind for its floor"
        );
        // Other readings keep the default floor: a moved listing is served
        // for it too, a kernel write ends it.
        let dir = "dir:/central/Work/A";
        let ticket = cache.begin(dir.into());
        assert!(cache.finish(dir, ticket));
        cache.put(dir.into(), json!({"entries": 1}));
        watch.changed_here();
        assert_eq!(cache.get(dir, Duration::from_secs(60)), None);
        assert_eq!(cache.get(key, Duration::from_secs(60)), None);
        let _ = receiver;
        watch.stop();
    }

    #[test]
    fn a_project_notice_does_not_move_a_reading_scoped_to_another_project() {
        let watch = Watch::fed(fed_roots());
        let model = ReadModel::over(watch.clone());
        let owner = AtomicUsize::new(0);
        let dep = Dep::new(
            vec![Scope::Root, Scope::Project("O-I".into())],
            Duration::from_secs(60),
        )
        .floor(Duration::ZERO);
        let ask = || {
            attributed(|| {
                model
                    .read("o-i", &dep, || -> Result<_, String> {
                        Ok(owner.fetch_add(1, Ordering::SeqCst))
                    })
                    .unwrap()
            })
        };
        let (_, scopes) = ask();
        assert_eq!(
            scopes,
            Some(vec!["project:O-I".to_owned(), "root".to_owned()])
        );
        changed(&watch, "Work/face-rig/src/x.js");
        let (value, scopes) = ask();
        assert_eq!(value, 0, "another project's change leaves it held");
        assert_eq!(
            scopes,
            Some(vec!["project:O-I".to_owned(), "root".to_owned()])
        );
        assert_eq!(model.counts().hits, 1, "the hit is attributed too");
        changed(&watch, "Work/O-I/src/x.rs");
        assert_eq!(ask().0, 1);
    }

    #[test]
    fn attribution_follows_reads_onto_threads_started_with_carried() {
        let watch = Watch::fed(fed_roots());
        let model = ReadModel::over(watch);
        let read = |key: &str, scope: Scope| {
            model
                .read(
                    key,
                    &Dep::new(vec![scope], Duration::from_secs(60)),
                    || -> Result<_, String> { Ok(0) },
                )
                .unwrap()
        };
        // Nothing asked: nothing to say.
        assert_eq!(attributed(|| 1).1, None);
        let (_, scopes) = attributed(|| {
            std::thread::scope(|scope| {
                scope.spawn(carried(|| read("seats", Scope::Seats)));
                scope.spawn(carried(|| read("project", Scope::Project("B".into()))));
                // A thread started without it is not seen.
                scope.spawn(|| read("lost", Scope::Aikit));
            });
        });
        assert_eq!(
            scopes,
            Some(vec!["project:B".to_owned(), "seats".to_owned()])
        );
        // A reading that depends on the clock says so.
        let (_, scopes) = attributed(|| {
            model
                .read(
                    "clock",
                    &Dep::new(vec![Scope::Root], Duration::from_secs(60)).clock(Clock::Day),
                    || -> Result<_, String> { Ok(0) },
                )
                .unwrap()
        });
        assert_eq!(scopes, Some(vec!["clock".to_owned(), "root".to_owned()]));
        // The refresh a caller asked for is carried to the thread too.
        let owner = AtomicUsize::new(0);
        let asked = || {
            read_cache_ask(&model, &owner);
        };
        asked();
        with_fresh(|| std::thread::scope(|scope| scope.spawn(carried(asked)).join().unwrap()));
        assert_eq!(owner.load(Ordering::SeqCst), 2);
    }

    fn read_cache_ask(model: &ReadModel, owner: &AtomicUsize) {
        model
            .read(
                "carried-fresh",
                &Dep::new(vec![Scope::Root], Duration::from_secs(60)),
                || -> Result<_, String> { Ok(owner.fetch_add(1, Ordering::SeqCst)) },
            )
            .unwrap();
    }
}
