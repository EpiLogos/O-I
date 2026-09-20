//! Retained, disposable owner answers shared by the application kernel.
//! Entries retain the original revision and content; expiry is not a claim
//! that a source stayed unchanged. Explicit refresh/authority-sensitive reads
//! bypass retention, known native writes invalidate derived knowledge, and a
//! ground change clears every entry. Nothing authored is stored only here.
use std::collections::HashMap;
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
}
#[derive(Debug, Default)]
pub struct OwnerReadCache {
    entries: HashMap<String, Entry>,
    bytes: usize,
}
impl OwnerReadCache {
    pub fn get(&self, key: &str, ttl: Duration) -> Option<serde_json::Value> {
        let entry = self.entries.get(key)?;
        (entry.at.elapsed() < ttl).then(|| entry.value.clone())
    }
    pub fn put(&mut self, key: String, value: serde_json::Value) {
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
            },
        );
    }
    pub fn invalidate(&mut self, key: &str) {
        if let Some(entry) = self.entries.remove(key) {
            self.bytes = self.bytes.saturating_sub(entry.bytes);
        }
    }
    pub fn invalidate_prefix(&mut self, prefix: &str) {
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
}
