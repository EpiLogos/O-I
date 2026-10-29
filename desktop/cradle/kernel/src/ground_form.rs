//! The Day's form in a new world (O-I #740; manual §10.11 Ground, §18.2 Day). Today's Day is made from the Day form
//! (`central.rs` InitialiseDay reads it through Central's file route) and its page reads that form where it stands
//! (`_oi_form_source`, DayDieFace.tsx). The owner's ground carries the forms in its O-I project (`Work/O-I/desktop/cradle/documents`,
//! documentForms.ts); a world Setup makes has no such project, so its Day could never be made.
//!
//! This route keeps the application's own Day form — the very bytes in `desktop/cradle/documents`, compiled into the kernel — in the
//! world's ground through Central's own operation (`central.ground.form.preview` / `.adopt`, `Control/forms/<name>`), on Setup's held
//! Ground Accept. A ground whose O-I project carries the form changes nothing; a form that stands is never replaced.
use crate::flow::CentralClient;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

pub const SCHEMA: &str = "oi.ground-form/v1";
pub const DAY_FORM_NAME: &str = "ql-daily-die.html";
/// The application's own Day form: the file the owner's O-I project carries (documentForms.ts `DOCUMENT_FORM_DIR`).
pub const DAY_FORM: &str = include_str!("../../documents/ql-daily-die.html");
/// Where the owner's ground carries the forms: its O-I project's documents (documentForms.ts, `Work/O-I` + `DOCUMENT_FORM_DIR`).
pub const PROJECT_FORMS: &str = "Work/O-I/desktop/cradle/documents";

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(tag = "operation", rename_all = "snake_case", deny_unknown_fields)]
pub enum Request {
    Preview,
    Keep {
        acceptance_ref: String,
        expected_digest: String,
    },
}

/// Whether the ground's O-I project carries the Day form (the place documentForms.ts reads it from first).
fn carried_by_project(client: &CentralClient) -> bool {
    crate::files::list(client, PROJECT_FORMS).is_ok_and(|directory| {
        directory
            .entries
            .iter()
            .any(|entry| entry.kind == "file" && entry.name == DAY_FORM_NAME)
    })
}
fn central(client: &CentralClient, action: &str, input: Value) -> Result<Value, String> {
    client.run(action, input).map_err(|e| e.to_string())
}

/// Preview or keep the Day's form in this world's ground (`Request`).
pub fn operate(client: &CentralClient, request: &Request) -> Result<Value, String> {
    if carried_by_project(client) {
        return Ok(
            json!({"schema":SCHEMA,"name":DAY_FORM_NAME,"carried_by":PROJECT_FORMS,"kept":false,"state":"project"}),
        );
    }
    let preview = central(
        client,
        "central.ground.form.preview",
        json!({"name":DAY_FORM_NAME,"content":DAY_FORM}),
    )?;
    match request {
        Request::Preview => Ok(json!({"schema":SCHEMA,"name":DAY_FORM_NAME,"central":preview})),
        Request::Keep {
            acceptance_ref,
            expected_digest,
        } => {
            if preview["state"] == "present" {
                return Ok(
                    json!({"schema":SCHEMA,"name":DAY_FORM_NAME,"kept":false,"state":"present","reason":preview["reason"]}),
                );
            }
            let receipt = central(
                client,
                "central.ground.form.adopt",
                json!({"actor_kind":"human","acceptance":"human-accepted","acceptance_ref":acceptance_ref,
                    "name":DAY_FORM_NAME,"content":DAY_FORM,"expected_digest":expected_digest}),
            )?;
            crate::read_cache::written();
            Ok(
                json!({"schema":SCHEMA,"name":DAY_FORM_NAME,"kept":receipt["adopted"] == true,"state":"present",
                "source_path":receipt["source_path"]}),
            )
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_form_kept_is_the_application_s_own_day_form() {
        let repository = std::fs::read_to_string(
            std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../documents/ql-daily-die.html"),
        )
        .unwrap();
        assert_eq!(
            DAY_FORM, repository,
            "the very bytes the O-I project carries"
        );
        assert!(
            DAY_FORM.contains("id=\"ql-doc\""),
            "a Day form, with its data island"
        );
    }

    #[test]
    #[ignore = "requires the rebuilt actual OI_CENTRAL_CTRL_BIN; never substitutes owner replies"]
    fn a_new_ground_keeps_the_day_form_once_and_its_day_is_made_from_it() {
        use std::time::{SystemTime, UNIX_EPOCH};
        let binary =
            std::env::var_os("OI_CENTRAL_CTRL_BIN").expect("pin the rebuilt native Central owner");
        let home = std::env::temp_dir().join(format!(
            "oi-ground-form-{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&home).unwrap();
        let ground = home.canonicalize().unwrap().join("Central");
        let client = CentralClient::with(binary.into(), Some(ground.clone()), String::new());
        client.run("central.init", json!({"project":null})).unwrap();
        let preview = operate(&client, &Request::Preview).unwrap();
        assert_eq!(preview["central"]["state"], "absent", "{preview}");
        let kept = operate(
            &client,
            &Request::Keep {
                acceptance_ref: "test".into(),
                expected_digest: preview["central"]["digest"].as_str().unwrap().into(),
            },
        )
        .unwrap();
        assert_eq!(kept["kept"], true, "{kept}");
        let listed = crate::files::list(&client, "Control/forms").unwrap();
        let entry = listed
            .entries
            .iter()
            .find(|e| e.name == DAY_FORM_NAME)
            .unwrap();
        assert!(entry.retrieval_allowed);
        let read = crate::files::read(&client, &entry.location).unwrap();
        assert_eq!(read.content, DAY_FORM);
        let again = operate(
            &client,
            &Request::Keep {
                acceptance_ref: "x".into(),
                expected_digest: "x".into(),
            },
        )
        .unwrap();
        assert_eq!(again["kept"], false, "kept once");
        let _ = std::fs::remove_dir_all(&home);
    }
}
