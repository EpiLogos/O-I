//! Short-horizon read-through cache for the owner readings the desktop
//! re-reads many times across one interaction: the World map, project
//! mappings, change horizons and directory listings. Every owner read is a
//! process spawn on the seam the UI shares (`central.world` ≈ 250 ms,
//! `central.files.list` ≈ 5 ms), so repeat reads inside one interaction are
//! served from memory while the TTLs keep staleness shorter than a glance.
//!
//! The law of the cache: it stores the owner's answer verbatim and mints
//! nothing. A `fresh` operation bypasses and replaces one exact entry;
//! mutations the kernel can localise invalidate the entries they name
//! (a file write invalidates its parent listing); every entry expires on
//! its own TTL, which is also the only defence against writers the kernel
//! cannot see (agents, CLI sessions). A ground change clears everything —
//! cached paths belong to the ground they were read from.
use std::collections::HashMap;
use std::time::{Duration, Instant};

/// How long each class of reading may serve. Long enough to absorb one
/// interaction's repeat reads, short enough that staleness never outlives
/// the moment that produced it.
pub const WORLD_TTL: Duration = Duration::from_millis(4000);
pub const PROJECT_TTL: Duration = Duration::from_millis(4000);
pub const HORIZON_TTL: Duration = Duration::from_millis(2000);
pub const DIR_TTL: Duration = Duration::from_millis(1500);

/// Bound on held readings; the cache is a desk, not an archive.
const MAX_ENTRIES: usize = 512;

#[derive(Debug, Default)]
pub struct OwnerReadCache {
    entries: HashMap<String, (Instant, serde_json::Value)>,
}

impl OwnerReadCache {
    /// The cached answer for `key`, if it is still inside `ttl`.
    pub fn get(&self, key: &str, ttl: Duration) -> Option<serde_json::Value> {
        let (read_at, value) = self.entries.get(key)?;
        if read_at.elapsed() >= ttl {
            return None;
        }
        Some(value.clone())
    }

    pub fn put(&mut self, key: String, value: serde_json::Value) {
        if self.entries.len() >= MAX_ENTRIES {
            self.entries.clear();
        }
        self.entries.insert(key, (Instant::now(), value));
    }

    /// Drop one exact entry; the fresh path replaces it with what the
    /// owner just answered.
    pub fn invalidate(&mut self, key: &str) {
        self.entries.remove(key);
    }

    /// A ground change re-bases every cached path; nothing survives it.
    pub fn clear(&mut self) {
        self.entries.clear();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn a_reading_serves_inside_its_ttl_and_expires_after_it() {
        let mut cache = OwnerReadCache::default();
        cache.put("dir:Work".into(), json!({"entries": 3}));
        assert_eq!(cache.get("dir:Work", DIR_TTL), Some(json!({"entries": 3})));
        // An expired entry answers nothing (TTL is the only defence against
        // writers the kernel cannot see).
        assert_eq!(cache.get("dir:Work", Duration::from_millis(0)), None);
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
        assert_eq!(cache.get("dir:Work", DIR_TTL), None);
    }
}
