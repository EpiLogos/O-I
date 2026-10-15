//! Read the working surface the native session actually binds. No renderer
//! path, executable, pane id or label can substitute for that owner identity.
use crate::agency::Client;
use serde_json::{json, Value};
use std::path::Path;

pub struct PreparedRead {
    pub client: Client,
    pub central: crate::CentralClient,
    pub world: Option<Value>,
    /// The agent reads cache the root Project binding is kept in
    /// (agent_prepared.rs), shared with the kernel.
    pub(crate) agent_reads: std::sync::Arc<std::sync::Mutex<crate::read_cache::OwnerReadCache>>,
    pub project: String,
    pub agent_session: String,
    pub binding: Option<String>,
    pub attachment: bool,
}
impl PreparedRead {
    pub fn execute(self) -> Result<Value, String> {
        let world = match self.world {
            Some(value) => value,
            None => crate::world::read_world(&self.central)?,
        };
        // The agent ops' own location and binding law (agent_prepared.rs).
        let label = (!self.project.is_empty()).then_some(self.project.as_str());
        let cwd = crate::agent_prepared::location(&world, label)?;
        let project = crate::agent_prepared::project_ref(
            &self.central,
            &self.client,
            &self.agent_reads,
            &self.project,
            &cwd,
        )?;
        read(
            &self.client,
            &cwd,
            &project,
            &self.agent_session,
            self.binding.as_deref(),
            self.attachment,
        )
    }
}

pub fn read(
    client: &Client,
    cwd: &Path,
    project: &str,
    agent_session: &str,
    selected: Option<&str>,
    attachment: bool,
) -> Result<Value, String> {
    let spaces = client.read_project(cwd, project)?;
    let mut bindings = Vec::new();
    for space in spaces.as_array().ok_or("Native spaces are not an array")? {
        let Some(space_ref) = space["definition"]["id"].as_str() else {
            continue;
        };
        for binding in space["working_surfaces"]
            .as_object()
            .into_iter()
            .flat_map(|rows| rows.values())
        {
            if binding["agent_session"].as_str() != Some(agent_session) {
                continue;
            }
            let reference = binding["binding"]
                .as_str()
                .ok_or("Working surface has no canonical binding")?;
            bindings.push(json!({"space":space_ref,"binding":reference,"surface":binding["surface"],"provider":binding["provider"],"label":binding["plan"]["name"]}));
        }
    }
    let mut result = json!({"schema":"oi.working-surface-reading/v1","agent_session":agent_session,"cwd":cwd,"bindings":bindings,"capture":null,"attachment":null});
    let rows = result["bindings"].as_array().expect("bindings");
    let chosen = if let Some(reference) = selected {
        Some(
            rows.iter()
                .find(|row| row["binding"].as_str() == Some(reference))
                .ok_or("Selected working surface is no longer bound to this session")?
                .clone(),
        )
    } else if rows.len() == 1 {
        Some(rows[0].clone())
    } else {
        None
    };
    let Some(chosen) = chosen else {
        result["reason"] = json!(if rows.is_empty() {
            "This session has no bound terminal surface. Remote desktop capture is not exposed by its owner."
        } else {
            "Choose a bound terminal surface."
        });
        return Ok(result);
    };
    let space = chosen["space"].as_str().expect("space");
    let binding = chosen["binding"].as_str().expect("binding");
    let document = client.working_surface_call(cwd, space, binding, attachment)?;
    if attachment {
        if document["subject"] != chosen["surface"] || document["provider"] != chosen["provider"] {
            return Err("Native attachment differs from the selected surface".into());
        }
        result["attachment"] = document;
    } else {
        if document["schema"] != "aikit.session-space-working-surface-capture/v1"
            || document["agent_session"] != agent_session
            || document["space"] != space
            || document["binding"] != binding
            || document["surface"] != chosen["surface"]
        {
            return Err("Native capture differs from the selected surface".into());
        }
        result["capture"] = document;
    }
    result["selected"] = chosen;
    Ok(result)
}

pub fn recording_capability() -> Value {
    json!({"schema":"oi.recording-capability/v1","state":"unavailable","reason":"This installation has no native run-recording producer. Screen scope and retention have not been selected; recording is off."})
}
