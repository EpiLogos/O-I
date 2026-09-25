//! Thin consumer of Central's existing GitState owner. No Git subprocesses here.
use crate::{flow::CentralClient, world};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct DiffRequest {
    pub repo_root: String,
    pub from: String,
    pub to: String,
    #[serde(default)]
    pub ignore_whitespace: bool,
    #[serde(default = "limit")]
    pub max_bytes: usize,
    #[serde(default = "files")]
    pub max_files: usize,
}
fn limit() -> usize {
    65536
}
fn files() -> usize {
    200
}
pub fn diff(client: &CentralClient, request: DiffRequest) -> Result<Value, String> {
    let mut input = serde_json::to_value(request).map_err(|e| e.to_string())?;
    input["project"] = Value::Null;
    let data = client
        .run("central.git.diff", input)
        .map_err(|e| e.to_string())?;
    if data["schema"] != "central.git-diff/v1" || !data["files"].is_array() {
        return Err("Central returned an unsupported Git diff".into());
    }
    Ok(data)
}
pub fn repository(client: &CentralClient, project: &str) -> Result<Value, String> {
    let map = world::read_project(client, project)?;
    let path = map["project"]["path"]
        .as_str()
        .ok_or("Central did not disclose the project path")?;
    let leaf = std::path::Path::new(path)
        .file_name()
        .and_then(|p| p.to_str())
        .ok_or("Project path has no repository name")?;
    let data = client
        .run(
            "central.git.census",
            json!({"project":leaf,"include_paths":true}),
        )
        .map_err(|e| e.to_string())?;
    let repos = data["repos"]
        .as_array()
        .ok_or("Central did not disclose its repositories")?;
    let repo = repos
        .iter()
        .find(|r| {
            r["repo"]
                .as_str()
                .is_some_and(|s| s.ends_with(&format!("/{leaf}")))
        })
        .ok_or("This project has no Git repository")?;
    if let Some(error) = repo["error"].as_str() {
        return Err(error.into());
    }
    Ok(repo.clone())
}
