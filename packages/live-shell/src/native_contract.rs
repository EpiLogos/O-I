//! Strict decoding of native owner contracts, shared by the development and installed hosts.
use serde::Deserialize;

pub(crate) fn current_world_output(
    output: std::process::Output,
) -> Result<serde_json::Value, String> {
    if !output.status.success() {
        return Err(format!(
            "Native CurrentWorld failed ({}): {}",
            output.status,
            String::from_utf8_lossy(&output.stderr)
        ));
    }
    if output.stdout.len() > 2 * 1024 * 1024 {
        return Err("Native CurrentWorld exceeded its bounded response".into());
    }
    let reading: serde_json::Value = unique_json(&output.stdout)?;
    if reading["schema"] != "oi.current-world/v2" {
        return Err("Native CurrentWorld returned an incompatible schema".into());
    }
    Ok(reading)
}

/// The last CurrentWorld reading, kept so that every ask of the shell's
/// configuration does not start the owner (which reads the composition, the
/// machine register and each suite repository's git standing) again.
///
/// A reading is served while the host's change signal (`bind_change_epoch`:
/// the kernel's filesystem watch) has not moved since before the owner was
/// asked, and for no longer than `LONGEST`: part of what the owner reads (the
/// installed composition under the user's config directory) lies outside what
/// the watch covers. A host with no change signal (the development server)
/// serves it for `WITHOUT_SIGNAL`. A failed reading is never kept.
mod remembered_world {
    use std::path::{Path, PathBuf};
    use std::sync::{Mutex, OnceLock};
    use std::time::{Duration, Instant};

    const LONGEST: Duration = Duration::from_secs(300);
    const WITHOUT_SIGNAL: Duration = Duration::from_secs(10);

    struct Held {
        suite_cli: PathBuf,
        at: Instant,
        epoch: Option<u64>,
        reading: serde_json::Value,
    }

    static HELD: Mutex<Option<Held>> = Mutex::new(None);
    static EPOCH: OnceLock<fn() -> Option<u64>> = OnceLock::new();

    /// The host's change signal: a count that grows when anything the owner
    /// reads may have changed, `None` while it cannot say.
    #[allow(dead_code)] // bound by the installed host, not the development server
    pub fn bind_change_epoch(epoch: fn() -> Option<u64>) {
        let _ = EPOCH.set(epoch);
    }

    /// The change signal now; take it before the owner is asked.
    pub(crate) fn epoch_now() -> Option<u64> {
        EPOCH.get().and_then(|epoch| epoch())
    }

    pub(crate) fn recall(suite_cli: &Path) -> Option<serde_json::Value> {
        let held = HELD.lock().unwrap_or_else(|e| e.into_inner());
        let held = held.as_ref().filter(|held| held.suite_cli == suite_cli)?;
        let still = match (held.epoch, epoch_now()) {
            (Some(then), Some(now)) => then == now && held.at.elapsed() < LONGEST,
            _ => held.at.elapsed() < WITHOUT_SIGNAL,
        };
        still.then(|| held.reading.clone())
    }

    /// Keep a reading the owner gave, taken under `epoch` (the signal before
    /// it was asked).
    pub(crate) fn keep(suite_cli: &Path, epoch: Option<u64>, reading: &serde_json::Value) {
        *HELD.lock().unwrap_or_else(|e| e.into_inner()) = Some(Held {
            suite_cli: suite_cli.to_path_buf(),
            at: Instant::now(),
            epoch,
            reading: reading.clone(),
        });
    }
}
#[allow(unused_imports)]
pub use remembered_world::bind_change_epoch;
pub(crate) use remembered_world::{epoch_now, keep as remember_world, recall as recalled_world};

/// Project effective product presence from the native owner's positions.
/// This is not an installation backing or profile: those retain their own
/// qualified receipts. Validate every position before admitting any product.
pub(crate) fn current_world_product_ids(
    reading: &serde_json::Value,
) -> Result<Vec<String>, String> {
    if reading["schema"] != "oi.current-world/v2" {
        return Err("Native CurrentWorld returned an incompatible schema".into());
    }
    let positions = reading["positions"]
        .as_array()
        .ok_or("Native CurrentWorld positions is missing or is not an array")?;
    let mut seen = std::collections::BTreeSet::new();
    let mut products = Vec::new();
    for (index, position) in positions.iter().enumerate() {
        let position = position
            .as_object()
            .ok_or_else(|| format!("Native CurrentWorld positions[{index}] is not an object"))?;
        let present = position
            .get("present")
            .and_then(serde_json::Value::as_bool)
            .ok_or_else(|| {
                format!(
                    "Native CurrentWorld positions[{index}].present is missing or is not a boolean"
                )
            })?;
        let id = position
            .get("product_id")
            .and_then(serde_json::Value::as_str)
            .filter(|id| {
                !id.is_empty()
                    && !id
                        .chars()
                        .any(|character| character.is_whitespace() || character.is_control())
            })
            .ok_or_else(|| {
                format!("Native CurrentWorld positions[{index}].product_id is missing or malformed")
            })?;
        if !seen.insert(id) {
            return Err(format!(
                "Native CurrentWorld positions contains duplicate product_id: {id}"
            ));
        }
        if present {
            products.push(id.to_owned());
        }
    }
    Ok(products)
}

// serde_json::Value alone silently accepts duplicate object fields. Reject
// ambiguity recursively before decoding a native contract into its typed form.
struct UniqueValue(serde_json::Value);
impl<'de> Deserialize<'de> for UniqueValue {
    fn deserialize<D: serde::Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
        struct Visitor;
        impl<'de> serde::de::Visitor<'de> for Visitor {
            type Value = UniqueValue;
            fn expecting(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
                f.write_str("unambiguous JSON")
            }
            fn visit_bool<E: serde::de::Error>(self, v: bool) -> Result<Self::Value, E> {
                Ok(UniqueValue(v.into()))
            }
            fn visit_i64<E: serde::de::Error>(self, v: i64) -> Result<Self::Value, E> {
                Ok(UniqueValue(v.into()))
            }
            fn visit_u64<E: serde::de::Error>(self, v: u64) -> Result<Self::Value, E> {
                Ok(UniqueValue(v.into()))
            }
            fn visit_f64<E: serde::de::Error>(self, v: f64) -> Result<Self::Value, E> {
                serde_json::Number::from_f64(v)
                    .map(|n| UniqueValue(n.into()))
                    .ok_or_else(|| E::custom("Nonfinite JSON number"))
            }
            fn visit_str<E: serde::de::Error>(self, v: &str) -> Result<Self::Value, E> {
                Ok(UniqueValue(v.into()))
            }
            fn visit_string<E: serde::de::Error>(self, v: String) -> Result<Self::Value, E> {
                Ok(UniqueValue(v.into()))
            }
            fn visit_unit<E: serde::de::Error>(self) -> Result<Self::Value, E> {
                Ok(UniqueValue(serde_json::Value::Null))
            }
            fn visit_seq<A: serde::de::SeqAccess<'de>>(
                self,
                mut a: A,
            ) -> Result<Self::Value, A::Error> {
                let mut v = Vec::new();
                while let Some(UniqueValue(item)) = a.next_element()? {
                    v.push(item);
                }
                Ok(UniqueValue(v.into()))
            }
            fn visit_map<A: serde::de::MapAccess<'de>>(
                self,
                mut a: A,
            ) -> Result<Self::Value, A::Error> {
                let mut v = serde_json::Map::new();
                while let Some((key, UniqueValue(item))) = a.next_entry::<String, UniqueValue>()? {
                    if v.insert(key.clone(), item).is_some() {
                        return Err(serde::de::Error::custom(format!(
                            "Duplicate JSON field: {key}"
                        )));
                    }
                }
                Ok(UniqueValue(v.into()))
            }
        }
        d.deserialize_any(Visitor)
    }
}
pub fn unique_json<T: serde::de::DeserializeOwned>(bytes: &[u8]) -> Result<T, String> {
    if bytes.len() > 16 * 1024 * 1024 {
        return Err("JSON exceeds 16 MiB".into());
    }
    let mut deserializer = serde_json::Deserializer::from_slice(bytes);
    let UniqueValue(value) =
        UniqueValue::deserialize(&mut deserializer).map_err(|e| e.to_string())?;
    deserializer.end().map_err(|e| e.to_string())?;
    serde_json::from_value(value).map_err(|e| e.to_string())
}
