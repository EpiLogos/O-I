//! Retained, disposable owner answers shared by the application kernel.
//! Entries retain the original revision and content; expiry is not a claim
//! that a source stayed unchanged. Explicit refresh/authority-sensitive reads
//! bypass retention, known native writes invalidate derived knowledge, and a
//! ground change clears every entry. Nothing authored is stored only here.
//!
//! A reading the owner gives a revision for may instead be retained by that
//! revision (`put_at`): it is served only while the owner still discloses
//! the same revision (`get_at`) and never because of its age. A size or a
//! time is never a revision.
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

pub const WORLD_TTL: Duration = Duration::from_millis(4000);
pub const PROJECT_TTL: Duration = Duration::from_millis(4000);
pub const HORIZON_TTL: Duration = Duration::from_millis(2000);
pub const DIR_TTL: Duration = Duration::from_millis(1500);
pub const KNOWLEDGE_TTL: Duration = Duration::from_millis(4000);
pub const GRAPH_TTL: Duration = Duration::from_millis(4000);
const MAX_ENTRIES: usize = 512;
const MAX_BYTES: usize = 32 * 1024 * 1024;

#[derive(Debug)]
struct Entry {
    at: Instant,
    value: serde_json::Value,
    bytes: usize,
    /// The owner's own revision of the retained reading, when it gave one.
    revision: Option<String>,
}
/// One owner reading shared by the prepared reads that ask for it while it
/// is in flight or just read (`OwnerReadCache::flight`): the first to
/// execute reads it through the owner, the others wait for that reading and
/// take it. It is held for its key's TTL from the moment it was read — the
/// cache's own retention, never a revision. A failed read is not shared:
/// the next reader asks the owner itself.
#[derive(Debug, Default)]
pub struct Flight(Mutex<Option<(Instant, serde_json::Value)>>);
impl Flight {
    /// The shared reading, read with `read` only when none is held within `ttl`.
    pub fn read(
        &self,
        ttl: Duration,
        read: impl FnOnce() -> Result<serde_json::Value, String>,
    ) -> Result<serde_json::Value, String> {
        let mut held = self.0.lock().unwrap_or_else(|e| e.into_inner());
        if let Some((at, value)) = held.as_ref() {
            if at.elapsed() < ttl {
                return Ok(value.clone());
            }
        }
        let value = read()?;
        *held = Some((Instant::now(), value.clone()));
        Ok(value)
    }
    /// The reading already held within `ttl`; never waits for one in flight.
    pub fn held(&self, ttl: Duration) -> Option<serde_json::Value> {
        let held = self.0.try_lock().ok()?;
        held.as_ref()
            .filter(|(at, _)| at.elapsed() < ttl)
            .map(|(_, value)| value.clone())
    }
    /// Read once and since let go by its TTL. A flight still reading (or
    /// whose read failed) has not lapsed: a later ask joins it.
    fn lapsed(&self, ttl: Duration) -> bool {
        match self.0.try_lock() {
            Ok(held) => held.as_ref().is_some_and(|(at, _)| at.elapsed() >= ttl),
            Err(std::sync::TryLockError::Poisoned(held)) => held
                .into_inner()
                .as_ref()
                .is_some_and(|(at, _)| at.elapsed() >= ttl),
            Err(std::sync::TryLockError::WouldBlock) => false,
        }
    }
}
#[derive(Debug, Default)]
pub struct OwnerReadCache {
    entries: HashMap<String, Entry>,
    bytes: usize,
    request_clock: u64,
    requests: HashMap<String, u64>,
    /// Shared readings by key, each a pending read under its `requests`
    /// ticket: whatever withdraws the ticket withdraws the flight.
    flights: HashMap<String, (u64, Arc<Flight>)>,
}
impl OwnerReadCache {
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
        let flight = Arc::new(Flight::default());
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
            }
        }
        self.requests.insert(key, self.request_clock);
        self.request_clock
    }
    pub(crate) fn current(&self, key: &str, ticket: u64) -> bool {
        self.requests.get(key) == Some(&ticket)
    }
    pub(crate) fn finish(&mut self, key: &str, ticket: u64) -> bool {
        if !self.current(key, ticket) {
            return false;
        }
        self.requests.remove(key);
        true
    }

    pub fn get(&self, key: &str, ttl: Duration) -> Option<serde_json::Value> {
        let entry = self.entries.get(key)?;
        (entry.at.elapsed() < ttl).then(|| entry.value.clone())
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
        self.entries.insert(
            key,
            Entry {
                at: Instant::now(),
                value,
                bytes,
                revision,
            },
        );
    }
    pub fn invalidate(&mut self, key: &str) {
        self.requests.remove(key);
        self.flights.remove(key);
        if let Some(entry) = self.entries.remove(key) {
            self.bytes = self.bytes.saturating_sub(entry.bytes);
        }
    }
    pub fn invalidate_prefix(&mut self, prefix: &str) {
        self.requests.retain(|key, _| !key.starts_with(prefix));
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
        self.flights.clear();
        self.entries.clear();
        self.bytes = 0;
    }
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
}
