//! Existing-ground recognition and binding through S; no initialization.
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{path::PathBuf, process::Command};

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
pub struct Identity { pub device: String, pub inode: String }
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
pub struct BindingRequest {
    pub expected_previous: Option<String>,
    pub canonical_path: String,
    pub identity: Identity,
}
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(tag="action", rename_all="snake_case")]
pub enum Request { Status, Recognize { path:String }, Bind { request:BindingRequest } }

pub fn operate(request: Request) -> Result<Value,String> {
    let executable=std::env::var_os("OI_BIN").map(PathBuf::from).unwrap_or_else(||"oi".into());
    let (args, schema, envelope) = match request {
        Request::Status => (vec!["ground".into(),"status".into(),"--json".into()],"oi.ground-binding/v1",false),
        Request::Recognize{path} => {
            if !std::path::Path::new(&path).is_absolute() { return Err("Choose an absolute Central path".into()); }
            (vec!["central".into(),"--json".into(),"action".into(),"run".into(),"central.recognize".into(),json!({"path":path}).to_string()],"central.root-recognition/v1",true)
        },
        Request::Bind{request} => (vec!["ground".into(),"bind".into(),"--request-json".into(),serde_json::to_string(&request).map_err(|e|e.to_string())?],"oi.ground-binding/v1",false),
    };
    let output=Command::new(executable).args(args).output().map_err(|e|format!("Suite ground operation unavailable: {e}"))?;
    let value:Value=serde_json::from_slice(&output.stdout).map_err(|e|format!("Suite ground response unreadable: {e}; {}",String::from_utf8_lossy(&output.stderr).trim()))?;
    let reading=if envelope {
        if value["ok"]!=true {return Err(value.pointer("/error/message").and_then(Value::as_str).unwrap_or("Central refused recognition").into());}
        value["data"].clone()
    } else { value };
    if reading["schema"]!=schema {return Err(format!("Unsupported ground response; expected {schema}"));}
    if envelope && (reading["mutated"]!=false || reading["bound"]!=false) {return Err("Recognition violated its read-only contract".into());}
    // Owner refusal/conflict readings retain their structured outcomes.
    if !output.status.success() && reading.get("outcome").is_none() {return Err(format!("Suite ground operation failed: {}",output.status));}
    Ok(reading)
}
