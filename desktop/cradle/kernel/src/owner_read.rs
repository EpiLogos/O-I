//! Native configuration disclosures do not mutate kernel state. Prepare their
//! immutable inputs under the kernel lock, then run owner processes without
//! holding the ordered mutation/event queue. Admission stays with each owner.
use crate::{flow::ReceivingRequest, CentralClient, KernelOp, KernelOpOutcome, KernelOpResult};
use serde_json::Value;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

/// The temporal projection's immutable inputs, captured under the kernel
/// lock: the ordered log's receipts as they stood at preparation, the
/// working directory for owner discovery, and the shared horizon cache.
/// Execution runs after the kernel mutex is released; nothing kernel-owned
/// is reachable from here.
pub struct TemporalReadInputs {
    pub(crate) receipts: Vec<crate::events::KernelEventReceipt>,
    pub(crate) cwd: PathBuf,
    pub(crate) cache: Arc<Mutex<crate::read_cache::OwnerReadCache>>,
}

pub struct PreparedRead {
    client: CentralClient,
    world: Option<Value>,
    op: KernelOp,
    temporal: Option<TemporalReadInputs>,
}

impl PreparedRead {
    pub(crate) fn prepare(
        client: &CentralClient,
        world: Option<Value>,
        op: &KernelOp,
        temporal: Option<TemporalReadInputs>,
    ) -> Option<Self> {
        // The temporal projection is all owner processes and in-memory
        // mapping over captured inputs — it belongs outside the ordered
        // queue like every other independent owner read. Inputs are
        // required: without them the ordered `apply` path serves the op.
        if matches!(op, KernelOp::TemporalEventsRead { .. }) {
            return temporal.map(|temporal| Self {
                client: client.clone(),
                world,
                op: op.clone(),
                temporal: Some(temporal),
            });
        }
        match op {
            KernelOp::Receiving { request: ReceivingRequest::List { .. } | ReceivingRequest::Read { .. } | ReceivingRequest::Document { .. }, .. }
            | KernelOp::GitRepositoryRead { .. }
            | KernelOp::GitDiffRead { .. }
            | KernelOp::ConfigRegistryRead
            | KernelOp::ConfigCapabilitiesRead
            | KernelOp::ConfigResolutionsRead { .. }
            | KernelOp::ConfigDiff
            | KernelOp::SystemCompositionRead
            | KernelOp::CompositionRead { .. }
            // The bounded telemetry follow waits on the owner for its whole
            // window; it reads only the owner's state file, never the kernel's.
            | KernelOp::FactoryOwner { request: crate::factory::OwnerRequest::TelemetryWatch { .. } } => Some(Self {
                client: client.clone(),
                world,
                op: op.clone(),
                temporal: None,
            }),
            _ => None,
        }
    }

    pub fn execute(self) -> Result<KernelOpOutcome, String> {
        // The temporal projection: all owner processes over captured
        // inputs. It runs here — never under the kernel mutex — and
        // answers with the same document the ordered path would build.
        if let (KernelOp::TemporalEventsRead { query }, Some(temporal)) = (&self.op, &self.temporal)
        {
            let answer = crate::temporal_sources::read_field(
                &self.client,
                &temporal.cache,
                &temporal.receipts,
                temporal.cwd.clone(),
                query,
            )
            .map_err(|error| error.to_string())?;
            return Ok(KernelOpOutcome {
                receipts: vec![],
                result: KernelOpResult::TemporalEventsReading {
                    document: serde_json::to_value(answer).map_err(|error| error.to_string())?,
                },
            });
        }
        // Inbox reads may fan out across many project registers at startup.
        // They do not alter kernel state and must not hold up native editing.
        // Review/include/recovery retain the ordered mutation path.
        if let KernelOp::Receiving { project, request } = &self.op {
            if let Some(project) = project {
                let world = match &self.world {
                    Some(world) => world.clone(),
                    None => crate::world::read_world(&self.client)?,
                };
                world["work"]["projects"]
                    .as_array()
                    .and_then(|rows| {
                        rows.iter()
                            .find(|row| row["name"].as_str() == Some(project.as_str()))
                    })
                    .ok_or("Project is outside Central's disclosed ground")?;
            }
            let data = self
                .client
                .receiving(project.as_deref(), request)
                .map_err(|error| error.to_string())?;
            return Ok(KernelOpOutcome {
                receipts: vec![],
                result: KernelOpResult::ReceivingReading { data },
            });
        }
        if let KernelOp::FactoryOwner {
            request:
                crate::factory::OwnerRequest::TelemetryWatch {
                    state_path,
                    resume,
                    duration_secs,
                    max_events,
                    run_ref,
                },
        } = &self.op
        {
            let data = crate::factory::telemetry_watch(
                state_path,
                resume.as_ref(),
                *duration_secs,
                *max_events,
                run_ref.as_deref(),
            )
            .map_err(|e| {
                serde_json::to_string(&e)
                    .unwrap_or_else(|_| "factory telemetry watch failed".into())
            })?;
            return Ok(KernelOpOutcome {
                receipts: vec![],
                result: KernelOpResult::FactoryDevelopmentReading { data },
            });
        }
        let git_reading = match &self.op {
            KernelOp::GitRepositoryRead { project } => Some(KernelOpResult::GitRepositoryReading {
                document: crate::git::repository(&self.client, project)?,
            }),
            KernelOp::GitDiffRead { request } => Some(KernelOpResult::GitDiffReading {
                document: crate::git::diff(&self.client, request.clone())?,
            }),
            _ => None,
        };
        if let Some(result) = git_reading {
            return Ok(KernelOpOutcome {
                receipts: vec![],
                result,
            });
        }

        // This schema belongs to the selected configuration engine. Reading
        // it needs no World enumeration and must not stall editor admission
        // behind unrelated owner disclosures. The producer still receives
        // the explicit host root, retained World root, or existing cwd fallback.
        if matches!(&self.op, KernelOp::ConfigCapabilitiesRead) {
            let cwd = self
                .client
                .configured_root()
                .map(std::path::PathBuf::from)
                .or_else(|| {
                    self.world
                        .as_ref()
                        .and_then(|world| world["root"].as_str())
                        .map(std::path::PathBuf::from)
                });
            let cwd = match cwd {
                Some(cwd) => cwd,
                None => std::env::current_dir().map_err(|e| e.to_string())?,
            };
            let document = crate::configuration::Client::discover().capabilities(&cwd)?;
            return Ok(KernelOpOutcome {
                receipts: vec![],
                result: KernelOpResult::ConfigCapabilitiesReading { document },
            });
        }

        let world = self
            .world
            .or_else(|| crate::world::read_world(&self.client).ok());
        let cwd = world
            .as_ref()
            .and_then(|w| w["root"].as_str())
            .map(std::path::PathBuf::from)
            .unwrap_or(std::env::current_dir().map_err(|e| e.to_string())?);
        let result = match self.op {
            KernelOp::ConfigRegistryRead => KernelOpResult::ConfigRegistryReading {
                reading: crate::configuration::Client::discover().registry_read(&cwd),
            },
            KernelOp::ConfigResolutionsRead { pairs } => KernelOpResult::ConfigResolutions {
                resolutions: crate::configuration::Client::discover()
                    .resolutions_read(&cwd, &pairs),
            },
            KernelOp::ConfigDiff => KernelOpResult::ConfigDiffReading {
                resolutions: crate::configuration::Client::discover().diff(&cwd)?,
            },
            KernelOp::SystemCompositionRead => KernelOpResult::SystemCompositionReading {
                reading: crate::system_composition::Client::discover().read(&cwd),
            },
            KernelOp::CompositionRead { owners } => KernelOpResult::CompositionReading {
                reading: crate::composition::Client::discover().read_with_owners(&cwd, owners),
            },
            _ => return Err("This operation cannot execute as an independent owner read".into()),
        };
        Ok(KernelOpOutcome {
            receipts: Vec::new(),
            result,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The telemetry follow is a prepared read (outside the kernel lock);
    /// every other Factory owner request keeps the ordered path.
    #[test]
    fn only_the_telemetry_watch_of_the_factory_family_is_prepared() {
        let client = CentralClient::discover();
        let watch: KernelOp = serde_json::from_value(serde_json::json!({"op": "factory_owner", "request": {"kind": "telemetry-watch", "state_path": "/s.json", "duration_secs": 1.0}})).unwrap();
        assert!(PreparedRead::prepare(&client, None, &watch, None).is_some());
        let status: KernelOp = serde_json::from_value(serde_json::json!({"op": "factory_owner", "request": {"kind": "telemetry-status", "state_path": "/s.json"}})).unwrap();
        assert!(PreparedRead::prepare(&client, None, &status, None).is_none());
    }

    /// The temporal read is a prepared read only when its captured inputs
    /// ride along; without them it falls to the ordered path unchanged.
    #[test]
    fn the_temporal_read_prepares_with_inputs_and_falls_back_without() {
        let client = CentralClient::discover();
        let op: KernelOp = serde_json::from_value(serde_json::json!({
            "op": "temporal_events_read",
            "query": {"window": {"window": "all"}}
        }))
        .unwrap();
        assert!(PreparedRead::prepare(&client, None, &op, None).is_none());
        let inputs = TemporalReadInputs {
            receipts: Vec::new(),
            cwd: std::env::current_dir().unwrap_or_else(|_| std::path::PathBuf::from(".")),
            cache: Arc::new(Mutex::new(crate::read_cache::OwnerReadCache::default())),
        };
        assert!(PreparedRead::prepare(&client, None, &op, Some(inputs)).is_some());
    }
}
