//! Strict decoding of native owner contracts, shared by the development and installed hosts.
use serde::Deserialize;

pub(crate) fn current_world_output(output: std::process::Output) -> Result<serde_json::Value, String> {
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

/// Project effective product presence from the native owner's positions.
/// This is not an installation backing or profile: those retain their own
/// qualified receipts. Validate every position before admitting any product.
pub(crate) fn current_world_product_ids(reading: &serde_json::Value) -> Result<Vec<String>, String> {
    if reading["schema"] != "oi.current-world/v2" {
        return Err("Native CurrentWorld returned an incompatible schema".into());
    }
    let positions = reading["positions"]
        .as_array()
        .ok_or("Native CurrentWorld positions is missing or is not an array")?;
    let mut seen = std::collections::BTreeSet::new();
    let mut products = Vec::new();
    for (index, position) in positions.iter().enumerate() {
        let position = position.as_object().ok_or_else(|| {
            format!("Native CurrentWorld positions[{index}] is not an object")
        })?;
        let present = position
            .get("present")
            .and_then(serde_json::Value::as_bool)
            .ok_or_else(|| {
                format!("Native CurrentWorld positions[{index}].present is missing or is not a boolean")
            })?;
        let id = position
            .get("product_id")
            .and_then(serde_json::Value::as_str)
            .filter(|id| {
                !id.is_empty()
                    && !id.chars().any(|character| {
                        character.is_whitespace() || character.is_control()
                    })
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
