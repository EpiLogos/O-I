//! Source validation at the constructive Action boundary. A SourcePool source
//! need not be a Central file: ask its native Knowledge owner in this same
//! world. Explicit file bases still use Central's disclosed file identity.
use crate::{
    files::{self, Location},
    flow::CentralClient,
    knowledge,
};
use serde::Deserialize;
use serde_json::Value;
use std::{collections::BTreeMap, path::Path};

#[derive(Debug, Default, Deserialize, PartialEq, Eq)]
pub(super) enum ContentEncoding {
    #[default]
    #[serde(rename = "utf-8")]
    Utf8,
    #[serde(rename = "base64")]
    Base64,
}
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct Basis {
    pub source_ref: String,
    pub revision: String,
    #[serde(default)]
    pub location: Option<Location>,
    #[serde(default)]
    pub content_encoding: ContentEncoding,
}

pub(super) fn verify(
    client: &CentralClient,
    cwd: &Path,
    sources: &[Basis],
    request: &Value,
) -> Result<(), String> {
    let mut content = BTreeMap::new();
    for source in sources {
        if source.source_ref.trim().is_empty() || source.revision.trim().is_empty() {
            return Err("A source basis requires its exact identity and revision".into());
        }
        let (reference, revision, body) = if let Some(location) = &source.location {
            if source.content_encoding == ContentEncoding::Base64 {
                let reading = files::read_bytes(client, location)?;
                (
                    reading
                        .source
                        .as_ref()
                        .map(|s| s.source_ref.clone())
                        .unwrap_or(reading.location.ref_id),
                    reading.revision,
                    None,
                )
            } else {
                let reading = files::read(client, location)?;
                (
                    reading
                        .source
                        .as_ref()
                        .map(|s| s.source_ref.clone())
                        .unwrap_or(reading.location.ref_id),
                    reading.revision,
                    Some(reading.content),
                )
            }
        } else {
            if source.content_encoding == ContentEncoding::Base64 {
                return Err("Binary source evidence requires its native file location".into());
            }
            let reading = knowledge::call(
                cwd,
                &knowledge::Request::Read {
                    address: knowledge::Address::Source(source.source_ref.clone()),
                },
            )
            .map_err(|e| format!("Source {} is unavailable: {e}", source.source_ref))?;
            (
                reading["resource"].as_str().unwrap_or_default().to_owned(),
                reading["revision"].as_str().unwrap_or_default().to_owned(),
                Some(reading["content"].as_str().unwrap_or_default().to_owned()),
            )
        };
        if reference != source.source_ref || revision != source.revision {
            return Err(format!(
                "source_revision_conflict: {} changed or was redirected; inspect and reconcile",
                source.source_ref
            ));
        }
        content.insert(source.source_ref.as_str(), body);
    }
    validate_selectors(request, &content)
}

fn validate_selectors(
    value: &Value,
    content: &BTreeMap<&str, Option<String>>,
) -> Result<(), String> {
    match value {
        Value::Object(object) => {
            if let Some(reference) = object.get("source_ref").and_then(Value::as_str) {
                let selector = &value["aikit.techne-facet/v1"]["selector"];
                if selector["unit"] == "other" && selector["kind"] == "markdown-utf8-span" {
                    let span: Value = serde_json::from_str(
                        selector["value"]
                            .as_str()
                            .ok_or("Selected passage has no native selector value")?,
                    )
                    .map_err(|_| "Selected passage has an unreadable byte selector")?;
                    let start = span["start_byte"]
                        .as_u64()
                        .and_then(|n| usize::try_from(n).ok())
                        .ok_or("Selected passage start is invalid")?;
                    let end = span["end_byte"]
                        .as_u64()
                        .and_then(|n| usize::try_from(n).ok())
                        .ok_or("Selected passage end is invalid")?;
                    let body = content
                        .get(reference)
                        .ok_or("Selected passage has no verified source")?
                        .as_ref()
                        .ok_or("Binary source evidence cannot provide a UTF-8 text passage")?;
                    if start >= end
                        || end - start > 65536
                        || end > body.len()
                        || !body.is_char_boundary(start)
                        || !body.is_char_boundary(end)
                    {
                        return Err(
                            "Selected passage is outside its exact native UTF-8 source span".into(),
                        );
                    }
                    if span.get("quote").is_some_and(|q| {
                        q.as_str().is_none_or(|text| {
                            text.trim().is_empty() || text.chars().count() > 12000
                        })
                    }) {
                        return Err("Selected passage quotation is empty or unbounded".into());
                    }
                }
            }
            for nested in object.values() {
                validate_selectors(nested, content)?;
            }
        }
        Value::Array(values) => {
            for nested in values {
                validate_selectors(nested, content)?;
            }
        }
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
        let content = BTreeMap::from([("source:note", Some("x🌱y".into()))]);
        assert!(validate_selectors(&evidence(1, 5), &content).is_ok());
        for (start, end) in [(1, 3), (2, 5), (0, 7), (5, 1), (1, 1)] {
            assert!(validate_selectors(&evidence(start, end), &content).is_err());
        }
        assert!(validate_selectors(&evidence(1, 5), &BTreeMap::new()).is_err());
    }
    #[test]
    fn binary_evidence_never_satisfies_text_passage_selectors() {
        let content = BTreeMap::from([("source:note", None)]);
        assert!(validate_selectors(&evidence(0, 1), &content)
            .unwrap_err()
            .contains("Binary source"));
        assert!(validate_selectors(&json!({"source_ref":"source:note"}), &content).is_ok());
    }

    #[test]
    #[ignore = "requires rebuilt actual OI_CENTRAL_CTRL_BIN; never substitutes owner replies"]
    fn binary_basis_uses_actual_owner_identity_revision_and_retrieval_guards() {
        use base64::{engine::general_purpose::STANDARD, Engine};
        use std::{
            fs,
            path::PathBuf,
            time::{SystemTime, UNIX_EPOCH},
        };
        struct Ground(PathBuf);
        impl Drop for Ground {
            fn drop(&mut self) {
                let _ = fs::remove_dir_all(&self.0);
            }
        }
        let binary =
            std::env::var_os("OI_CENTRAL_CTRL_BIN").expect("pin the rebuilt native Central owner");
        let root = std::env::temp_dir().join(format!(
            "oi-binary-basis-{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir(&root).unwrap();
        let ground = Ground(root.canonicalize().unwrap());
        let client =
            CentralClient::with(binary.into(), Some(ground.0.clone()), "ImageSource".into());
        client.run("central.init", json!({"project":null})).unwrap();
        fs::create_dir_all(ground.0.join("Work/ImageSource")).unwrap();
        client
            .run(
                "projectcentral.init",
                json!({"project":"ImageSource","project_id":"image-source"}),
            )
            .unwrap();
        let parent = client
            .run("central.files.list", json!({"path":"Work/ImageSource"}))
            .unwrap()["location"]
            .clone();
        let bytes = b"\x89PNG\r\n\x1a\n\0\xff";
        let created = client.run("central.files.create",json!({"project":null,"parent":parent,"name":"capture.png","content_encoding":"base64","content":STANDARD.encode(bytes),"expected_absent":true,"operation_ref":"native:binary-basis","actor":"native-test","actor_kind":"human"})).unwrap();
        let location: Location = serde_json::from_value(created["location"].clone()).unwrap();
        let reading = files::read_bytes(&client, &location).unwrap();
        assert_eq!(STANDARD.decode(&reading.content_base64).unwrap(), bytes);
        assert!(
            reading.source.is_none(),
            "ordinary admission must not invent source ownership"
        );
        let mut basis = Basis {
            source_ref: location.ref_id.clone(),
            revision: reading.revision,
            location: Some(location.clone()),
            content_encoding: ContentEncoding::Base64,
        };
        let request = json!({"source_ref":basis.source_ref});
        assert!(verify(&client, &ground.0, std::slice::from_ref(&basis), &request).is_ok());
        let mut span = evidence(0, 1);
        span["source_ref"] = json!(basis.source_ref);
        assert!(
            verify(&client, &ground.0, std::slice::from_ref(&basis), &span)
                .unwrap_err()
                .contains("Binary source")
        );
        basis.content_encoding = ContentEncoding::Utf8;
        assert!(verify(&client, &ground.0, std::slice::from_ref(&basis), &request).is_err());
        basis.content_encoding = ContentEncoding::Base64;
        fs::write(ground.0.join(&location.path), b"\0changed\xff").unwrap();
        assert!(
            verify(&client, &ground.0, std::slice::from_ref(&basis), &request)
                .unwrap_err()
                .contains("source_revision_conflict")
        );
        fs::write(ground.0.join(&location.path), bytes).unwrap();
        fs::write(ground.0.join("Work/ImageSource/.no-agent-retrieval"), b"").unwrap();
        assert!(verify(&client, &ground.0, std::slice::from_ref(&basis), &request).is_err());
        fs::remove_file(ground.0.join("Work/ImageSource/.no-agent-retrieval")).unwrap();
        // Native authored-source discovery discloses a different identity from
        // the file address. The bytes route must carry it, never demote it.
        fs::write(
            ground
                .0
                .join("Work/ImageSource/ProjectCentral/user/capture.png"),
            bytes,
        )
        .unwrap();
        let listing = client
            .run(
                "central.files.list",
                json!({"path":"Work/ImageSource/ProjectCentral/user"}),
            )
            .unwrap();
        let source_location: Location = serde_json::from_value(
            listing["entries"]
                .as_array()
                .unwrap()
                .iter()
                .find(|e| e["name"] == "capture.png")
                .unwrap()["location"]
                .clone(),
        )
        .unwrap();
        let source_reading = files::read_bytes(&client, &source_location).unwrap();
        let binding = source_reading
            .source
            .clone()
            .expect("real source owner binding");
        let mut source_basis = Basis {
            source_ref: binding.source_ref.clone(),
            revision: source_reading.revision,
            location: Some(source_location.clone()),
            content_encoding: ContentEncoding::Base64,
        };
        assert!(verify(
            &client,
            &ground.0,
            std::slice::from_ref(&source_basis),
            &json!({})
        )
        .is_ok());
        source_basis.source_ref = source_location.ref_id.clone();
        assert!(verify(
            &client,
            &ground.0,
            std::slice::from_ref(&source_basis),
            &json!({})
        )
        .unwrap_err()
        .contains("source_revision_conflict"));
        let mut kernel = crate::Kernel::new(client);
        let result = kernel
            .apply(crate::KernelOp::FileBytes {
                location: source_location,
            })
            .unwrap()
            .result;
        let crate::KernelOpResult::FileBytes {
            source: Some(returned),
            ..
        } = result
        else {
            panic!("kernel omitted native SourceBinding")
        };
        assert_eq!(
            serde_json::to_value(returned).unwrap(),
            serde_json::to_value(binding).unwrap()
        );
    }
}
