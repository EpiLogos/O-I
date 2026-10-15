//! Existing-ground recognition and binding through S; no initialization.
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{path::PathBuf, process::Command};

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
pub struct Identity {
    pub device: String,
    pub inode: String,
}
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
pub struct BindingRequest {
    pub expected_previous: Option<String>,
    pub canonical_path: String,
    pub identity: Identity,
}
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(tag = "action", rename_all = "snake_case")]
pub enum Request {
    Status,
    Recognize { path: String },
    Bind { request: BindingRequest },
}
impl Request {
    /// Only `Bind` actually re-bases the ground. `Status` is a plain read
    /// and `Recognize`'s own reply is rejected below if it ever comes back
    /// mutated or bound — a caller holding a whole-cache clear for either
    /// of those is clearing every other in-flight read on pure coincidence
    /// of timing, not because anything under it changed.
    pub fn mutates(&self) -> bool {
        matches!(self, Request::Bind { .. })
    }
}

/// A ground reading (status, recognition) answers from records; a bind
/// writes the suite's binding. Neither has a measured pace beyond a second;
/// the bounds are for an owner that never answers.
const GROUND_READ_LIMIT: std::time::Duration = std::time::Duration::from_secs(30);
const GROUND_BIND_LIMIT: std::time::Duration = std::time::Duration::from_secs(60);

pub fn operate(request: Request) -> Result<Value, String> {
    let executable = std::env::var_os("OI_BIN")
        .map(PathBuf::from)
        .unwrap_or_else(|| "oi".into());
    let bound = match &request {
        Request::Status => {
            crate::owner_process::Bound::read("O:I", "ground status", GROUND_READ_LIMIT)
        }
        Request::Recognize { .. } => {
            crate::owner_process::Bound::read("Central", "central.recognize", GROUND_READ_LIMIT)
        }
        Request::Bind { .. } => {
            crate::owner_process::Bound::write("O:I", "ground bind", GROUND_BIND_LIMIT)
        }
    };
    let (args, schema, envelope) = match request {
        Request::Status => (
            vec!["ground".into(), "status".into(), "--json".into()],
            "oi.ground-binding/v1",
            false,
        ),
        Request::Recognize { path } => {
            if !std::path::Path::new(&path).is_absolute() {
                return Err("Choose an absolute Central path".into());
            }
            (
                vec![
                    "central".into(),
                    "--json".into(),
                    "action".into(),
                    "run".into(),
                    "central.recognize".into(),
                    json!({"path":path}).to_string(),
                ],
                "central.root-recognition/v1",
                true,
            )
        }
        Request::Bind { request } => (
            vec![
                "ground".into(),
                "bind".into(),
                "--request-json".into(),
                serde_json::to_string(&request).map_err(|e| e.to_string())?,
            ],
            "oi.ground-binding/v1",
            false,
        ),
    };
    let output = crate::owner_process::output(Command::new(executable).args(args), None, bound)
        .map_err(|e| format!("Suite ground operation unavailable: {e}"))?;
    let value: Value = serde_json::from_slice(&output.stdout).map_err(|e| {
        format!(
            "Suite ground response unreadable: {e}; {}",
            String::from_utf8_lossy(&output.stderr).trim()
        )
    })?;
    let reading = if envelope {
        if value["ok"] != true {
            return Err(value
                .pointer("/error/message")
                .and_then(Value::as_str)
                .unwrap_or("Central refused recognition")
                .into());
        }
        value["data"].clone()
    } else {
        value
    };
    if reading["schema"] != schema {
        return Err(format!("Unsupported ground response; expected {schema}"));
    }
    if envelope && (reading["mutated"] != false || reading["bound"] != false) {
        return Err("Recognition violated its read-only contract".into());
    }
    // Owner refusal/conflict readings retain their structured outcomes.
    if !output.status.success() && reading.get("outcome").is_none() {
        return Err(format!("Suite ground operation failed: {}", output.status));
    }
    Ok(reading)
}

/// A ground operation prepared under the kernel lock; its suite call runs
/// outside it (dispatch.rs). A bind re-bases every path the kernel's caches
/// hold, so they are withdrawn when it is prepared — as the ordered arm did
/// before its owner call — and again when it is finished: a read begun while
/// the suite was binding is withdrawn with them and never retained. Status
/// and recognition are reads and withdraw nothing.
pub struct Prepared {
    request: Request,
}
/// The suite's answer to a prepared ground operation, awaiting its finish.
pub struct Answered {
    mutates: bool,
    reading: Result<Value, String>,
}
impl Prepared {
    /// The suite call, outside the kernel lock. Nothing is recorded here.
    pub fn execute(self) -> Answered {
        Answered {
            mutates: self.request.mutates(),
            reading: operate(self.request),
        }
    }
}
impl crate::Kernel {
    pub fn prepare_ground(&mut self, op: &crate::KernelOp) -> Option<Prepared> {
        let crate::KernelOp::Ground { request } = op else {
            return None;
        };
        if request.mutates() {
            self.ground_changed();
        }
        Some(Prepared {
            request: request.clone(),
        })
    }
    pub fn finish_ground(&mut self, answered: Answered) -> Result<crate::KernelOpOutcome, String> {
        if answered.mutates {
            self.ground_changed();
        }
        Ok(crate::KernelOpOutcome {
            receipts: Vec::new(),
            result: crate::KernelOpResult::GroundReading {
                reading: answered.reading?,
            },
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A bind withdraws the kernel's retained readings when it is prepared
    /// and again when it is finished; a status reading withdraws nothing.
    #[cfg(unix)]
    #[test]
    fn a_bind_withdraws_retained_readings_before_and_after_its_suite_call() {
        let owner = crate::tests::FakeOwner::spawn_counter("ground-bind");
        let mut kernel = owner.kernel();
        kernel.reads.put("world".into(), json!({"root": "/tmp"}));
        let status = kernel
            .prepare_ground(&crate::KernelOp::Ground {
                request: Request::Status,
            })
            .unwrap();
        assert!(kernel
            .reads
            .get("world", crate::read_cache::WORLD_TTL)
            .is_some());
        assert!(!status.request.mutates());
        let bind = crate::KernelOp::Ground {
            request: Request::Bind {
                request: BindingRequest {
                    expected_previous: None,
                    canonical_path: "/x".into(),
                    identity: Identity {
                        device: "d".into(),
                        inode: "i".into(),
                    },
                },
            },
        };
        kernel.prepare_ground(&bind).unwrap();
        assert!(kernel
            .reads
            .get("world", crate::read_cache::WORLD_TTL)
            .is_none());
        // A read begun while the suite was binding is withdrawn at finish.
        let ticket = kernel.reads.begin("dir:Work".into());
        let outcome = kernel
            .finish_ground(Answered {
                mutates: true,
                reading: Ok(json!({"schema": "oi.ground-binding/v1"})),
            })
            .unwrap();
        assert!(!kernel.reads.finish("dir:Work", ticket));
        assert!(matches!(
            outcome.result,
            crate::KernelOpResult::GroundReading { .. }
        ));
        assert!(kernel
            .finish_ground(Answered {
                mutates: false,
                reading: Err("refused".into()),
            })
            .is_err());
    }

    #[test]
    fn only_bind_is_a_mutation() {
        assert!(!Request::Status.mutates());
        assert!(!Request::Recognize { path: "/x".into() }.mutates());
        assert!(Request::Bind {
            request: BindingRequest {
                expected_previous: None,
                canonical_path: "/x".into(),
                identity: Identity {
                    device: "d".into(),
                    inode: "i".into()
                },
            }
        }
        .mutates());
    }
}
