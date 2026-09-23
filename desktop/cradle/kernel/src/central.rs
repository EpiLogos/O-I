//! Central owns root/project, civil time, source, document and Return semantics.
//! This finite desktop adapter joins owner results; it never traverses files,
//! invents a SourceRef, starts an Agent, or rewrites temporal identity.
use crate::{files, flow::CentralClient};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum Request {
    Inspect,
    SourceLocation {
        source_ref: String,
    },
    OpenDay {
        #[serde(default)]
        day_ref: Option<String>,
    },
    EnsureDay {
        expected_time_policy_revision: String,
    },
    InitialiseDay {
        day_ref: String,
        document_id: String,
        expected_revision: String,
        expected_policy_revision: String,
        form: files::Location,
        expected_form_revision: String,
    },
}

fn reading(client: &CentralClient, project: Option<&str>, action: &str, schema: &str) -> Value {
    match client.run_envelope(action, json!({"project":project})) {
        Ok(envelope) if envelope["ok"] == true => {
            if envelope["data"]["schema"] != schema
                || envelope["data"]["automatic_agent_or_model_invocation"] == true
            {
                return json!({"state":"failed","action":action,"error":{"message":"Unsupported or redirected native reading"},"native":envelope});
            }
            json!({"state":"ready","action":action,"data":envelope["data"]})
        }
        Ok(envelope) => {
            let state = match envelope["error"]["code"].as_str() {
                Some("policy_or_source_denied" | "placement_rejected") => "denied",
                Some("source_or_scope_unavailable") => "unavailable",
                Some("stale_basis_or_identity_conflict") => "stale",
                _ => "failed",
            };
            json!({"state":state,"action":action,"error":envelope["error"],"native_status":envelope["status"]})
        }
        Err(error) => {
            json!({"state":if matches!(error,crate::OwnerCallError::Unavailable{..}){"unavailable"}else{"failed"},"action":action,"error":{"message":error.to_string()}})
        }
    }
}

pub fn day(
    client: &CentralClient,
    project: Option<&str>,
    day_ref: Option<&str>,
) -> Result<Value, String> {
    let value = client
        .run(
            "central.day.read",
            json!({"project":project,"day_ref":day_ref}),
        )
        .map_err(|e| e.to_string())?;
    if value["schema"] != "central.day-reading/v1"
        || value["automatic_agent_or_model_invocation"] != false
    {
        return Err("Unsupported native Day reading".into());
    }
    if let Some(reference) = day_ref {
        if value["day_ref"] != reference {
            return Err("Native Day reader redirected the requested historical Day".into());
        }
    } else {
        let time = client
            .run("central.time.policy", json!({"project":project}))
            .map_err(|e| e.to_string())?;
        if value["temporal"]["civil_date"] != time["civil_date"] {
            return Err("The native today pointer is stale; explicitly ensure the current Day under the native time policy".into());
        }
    }
    Ok(value)
}

pub fn day_document(day: &Value) -> Result<&Value, String> {
    let doc = &day["document"];
    if day["document_state"] != "ready" || doc["schema"] != "central.document-reading/v1" {
        return Err("Current Day has no native document yet. Use the explicit native initialisation path; its temporal artifact is not a Daily Die".into());
    }
    if doc["source"]["ref"] != day["source"]["ref"]
        || doc["revision"] != day["revision"]
        || doc["document"]["kind"] != "day"
        || doc["document"]["day_ref"] != day["day_ref"]
    {
        return Err("Native Day/document identity or revision does not match".into());
    }
    Ok(doc)
}

pub fn source_location(
    client: &CentralClient,
    project: Option<&str>,
    reference: &str,
) -> Result<files::Location, String> {
    let source = client
        .source_read(project, reference)
        .map_err(|e| e.to_string())?;
    let path = if let Some(project) = project {
        let world = client
            .run("central.world", json!({"project":null}))
            .map_err(|e| e.to_string())?;
        let path = world["work"]["projects"]
            .as_array()
            .and_then(|rows| rows.iter().find(|p| p["name"] == project))
            .and_then(|p| p["path"].as_str())
            .ok_or("Project is outside native Central ground")?;
        format!("{path}/{}", source.source.path)
    } else {
        source.source.path
    };
    // Resolve the exact returned source path through its owner's directory.
    // This is not a search for a filename that might be today's document.
    let directory = files::list(client, &files::parent_path(&path))?;
    let entry = directory
        .entries
        .into_iter()
        .find(|entry| entry.location.path == path && entry.kind == "file")
        .ok_or("Native source location is missing from its owner's directory")?;
    if !entry.retrieval_allowed {
        return Err("Native source location is denied".into());
    }
    Ok(entry.location)
}

fn form_payload(content: &str) -> Result<Value, String> {
    // Accept the actual supplied data-island, never execute document scripts.
    let id = "id=\"ql-doc\"";
    let start = content
        .find(id)
        .ok_or("Selected HTML has no ql-doc payload")?;
    let tag_start = content[..start]
        .rfind("<script")
        .ok_or("ql-doc is not a script data island")?;
    let header_end = content[start..]
        .find('>')
        .map(|i| i + start)
        .ok_or("Unterminated ql-doc tag")?;
    if !content[tag_start..header_end].contains("application/json") {
        return Err("ql-doc must be inert application/json".into());
    }
    let end = content[header_end + 1..]
        .find("</script>")
        .map(|i| i + header_end + 1)
        .ok_or("Unterminated ql-doc data")?;
    let payload: Value = serde_json::from_str(&content[header_end + 1..end])
        .map_err(|e| format!("Invalid original ql-doc: {e}"))?;
    if payload["meta"]["type"] != "daily" {
        return Err("Selected original is not a Daily Die payload".into());
    }
    if payload["fields"].as_object().is_none() {
        return Err("Selected document has no original field map".into());
    }
    Ok(payload)
}

pub fn operate(
    client: &CentralClient,
    project: Option<&str>,
    request: &Request,
) -> Result<Value, String> {
    if project.is_some_and(|p| p.trim().is_empty()) {
        return Err("An empty Project is not root scope".into());
    }
    match request {
        Request::Inspect => {
            let time=reading(client,project,"central.time.policy","central.civil-time-reading/v1");
            let mut day=reading(client,project,"central.day.read","central.day-reading/v1");
            if day["state"]=="ready" && time["state"]=="ready" && day["data"]["temporal"]["civil_date"]!=time["data"]["civil_date"] {
                day["state"]=json!("stale"); day["error"]=json!({"message":"The native today pointer belongs to an earlier civil Day; its writing is retained"});
            }
            Ok(json!({"schema":"oi.central-ground/v1","project":project,"time":time,"day":day,
                "now":reading(client,project,"central.now.list","central.now-listing/v1"),
                "sources":reading(client,project,"projectcentral.change.horizon","central.source-change-horizon/v1"),
                "placement":reading(client,project,"central.work.policy","central.effective-placement-policy/v1")}))
        }
        Request::SourceLocation{source_ref} => Ok(json!({"schema":"oi.central-source-location/v1","project":project,"source_ref":source_ref,"location":source_location(client,project,source_ref)?})),
        Request::OpenDay{day_ref} => {
            let value=day(client,project,day_ref.as_deref())?;
            let doc=day_document(&value)?;
            let reference=doc["source"]["ref"].as_str().ok_or("Day document has no source ref")?;
            let location=source_location(client,project,reference)?;
            Ok(json!({"schema":"oi.central-day-open/v1","project":project,"day":value,"location":location}))
        }
        Request::EnsureDay{expected_time_policy_revision} => client.run("central.day.ensure",json!({"project":project,"expected_time_policy_revision":expected_time_policy_revision})).map_err(|e|e.to_string()),
        Request::InitialiseDay{day_ref,document_id,expected_revision,expected_policy_revision,form,expected_form_revision} => {
            let original=files::read(client,form)?;
            if original.revision!=*expected_form_revision {return Err("Selected original form changed; review its new revision before initialising".into());}
            let mut payload=form_payload(&original.content)?;
            if payload.get("_oi_form_source").is_some(){return Err("Selected template already carries a retained form binding; choose its original source".into());}
            let mut fields:Vec<Value>=payload["fields"].as_object().ok_or("Missing field map")?.keys().map(|key|json!({"id":key,"label":key,"template_pointer":format!("/fields/{}",key.replace('~',"~0").replace('/',"~1"))})).collect();
            // Aggregate mappings preserve the actual supplied typed body,
            // checkboxes, notes, media and session rows. The seventeen original
            // keys and their individual mappings stay present, not renamed.
            for key in payload.as_object().ok_or("Original payload must be an object")?.keys() {
                fields.push(json!({"id":format!("original:{key}"),"label":format!("Original {key}"),"template_pointer":format!("/{}",key.replace('~',"~0").replace('/',"~1"))}));
            }
            let time=client.run("central.time.policy",json!({"project":project})).map_err(|e|e.to_string())?;
            let day=client.run("central.day.read",json!({"project":project,"day_ref":day_ref})).map_err(|e|e.to_string())?;
            if day["temporal"]["civil_date"]!=time["civil_date"] { return Err("Day changed before initialisation; review the current native Day".into()); }
            if let Some(meta)=payload.get_mut("meta").and_then(Value::as_object_mut) {
                // Native date/time, not the browser clock. Supplied non-empty
                // historical identity is never silently recast as today.
                for (key,value) in [("date",time["civil_date"].clone()),("timezone",time["policy"]["timezone"].clone())] {
                    if meta.get(key).is_some_and(|v| !v.is_null() && v!=&value) { return Err(format!("Original form has a different {key}; choose its original blank template or use native reviewed migration")); }
                    meta.insert(key.into(),value);
                }
                if meta.get("uuid").is_none_or(Value::is_null) {meta.insert("uuid".into(),json!(document_id));}
            }
            payload["_oi_form_source"]=json!({"schema":"oi.original-day-form/v1","location":form,"revision":expected_form_revision});
            client.run("central.document.create",json!({"project":project,"kind":"day","day_ref":day_ref,"document_id":document_id,
                "expected_revision":expected_revision,"expected_policy_revision":expected_policy_revision,"template_payload":payload,"fields":fields})).map_err(|e|e.to_string())
        }
    }
}
