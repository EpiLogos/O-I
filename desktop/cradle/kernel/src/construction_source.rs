//! Source validation at the constructive Action boundary. A SourcePool source
//! need not be a Central file: ask its native Knowledge owner in this same
//! world. Explicit file bases still use Central's disclosed file identity.
use crate::{files::{self, Location}, flow::CentralClient, knowledge};
use serde::Deserialize;
use serde_json::Value;
use std::{collections::BTreeMap, path::Path};

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct Basis {
    pub source_ref: String,
    pub revision: String,
    #[serde(default)]
    pub location: Option<Location>,
}

pub(super) fn verify(client: &CentralClient, cwd: &Path, sources: &[Basis], request: &Value) -> Result<(), String> {
    let mut content = BTreeMap::new();
    for source in sources {
        if source.source_ref.trim().is_empty() || source.revision.trim().is_empty() {
            return Err("A source basis requires its exact identity and revision".into());
        }
        let (reference, revision, body) = if let Some(location) = &source.location {
            let reading = files::read(client, location)?;
            (reading.source.as_ref().map(|s| s.source_ref.clone()).unwrap_or(reading.location.ref_id), reading.revision, reading.content)
        } else {
            let reading = knowledge::call(cwd, &knowledge::Request::Read {address: knowledge::Address::Source(source.source_ref.clone())})
                .map_err(|e| format!("Source {} is unavailable: {e}", source.source_ref))?;
            (reading["resource"].as_str().unwrap_or_default().to_owned(), reading["revision"].as_str().unwrap_or_default().to_owned(), reading["content"].as_str().unwrap_or_default().to_owned())
        };
        if reference != source.source_ref || revision != source.revision {
            return Err(format!("source_revision_conflict: {} changed or was redirected; inspect and reconcile", source.source_ref));
        }
        content.insert(source.source_ref.as_str(), body);
    }
    validate_selectors(request, &content)
}

fn validate_selectors(value: &Value, content: &BTreeMap<&str, String>) -> Result<(), String> {
    match value {
        Value::Object(object) => {
            if let Some(reference) = object.get("source_ref").and_then(Value::as_str) {
                let selector = &value["aikit.techne-facet/v1"]["selector"];
                if selector["unit"] == "other" && selector["kind"] == "markdown-utf8-span" {
                    let span: Value = serde_json::from_str(selector["value"].as_str().ok_or("Selected passage has no native selector value")?)
                        .map_err(|_| "Selected passage has an unreadable byte selector")?;
                    let start = span["start_byte"].as_u64().and_then(|n| usize::try_from(n).ok()).ok_or("Selected passage start is invalid")?;
                    let end = span["end_byte"].as_u64().and_then(|n| usize::try_from(n).ok()).ok_or("Selected passage end is invalid")?;
                    let body = content.get(reference).ok_or("Selected passage has no verified source")?;
                    if start >= end || end - start > 65536 || end > body.len() || !body.is_char_boundary(start) || !body.is_char_boundary(end) {
                        return Err("Selected passage is outside its exact native UTF-8 source span".into());
                    }
                    if span.get("quote").is_some_and(|q| q.as_str().is_none_or(|text| text.trim().is_empty() || text.chars().count() > 12000)) {
                        return Err("Selected passage quotation is empty or unbounded".into());
                    }
                }
            }
            for nested in object.values() {validate_selectors(nested, content)?;}
        }
        Value::Array(values) => for nested in values {validate_selectors(nested, content)?;},
        _ => {}
    }
    Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    fn evidence(start: u64, end: u64) -> Value {
        json!({"source_ref":"source:note","source_revision":"r1","aikit.techne-facet/v1":{"selector":{
            "unit":"other","kind":"markdown-utf8-span","value":json!({"start_byte":start,"end_byte":end,"quote":"🌱"}).to_string()}}})
    }
    #[test]
    fn source_selectors_use_utf8_bytes_not_javascript_code_units() {
        let content = BTreeMap::from([("source:note", "x🌱y".into())]);
        assert!(validate_selectors(&evidence(1, 5), &content).is_ok());
        for (start, end) in [(1, 3), (2, 5), (0, 7), (5, 1), (1, 1)] {
            assert!(validate_selectors(&evidence(start, end), &content).is_err());
        }
        assert!(validate_selectors(&evidence(1, 5), &BTreeMap::new()).is_err());
    }
}
