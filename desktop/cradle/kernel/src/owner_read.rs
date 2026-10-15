//! Native configuration disclosures do not mutate kernel state. Prepare their
//! immutable inputs under the kernel lock, then run owner processes without
//! holding the ordered mutation/event queue. Admission stays with each owner.
use crate::{
    files, flow::ReceivingRequest, focus, owner_relation, read_cache, retained_files,
    CentralClient, Kernel, KernelOp, KernelOpOutcome, KernelOpResult,
};
use serde_json::Value;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

/// A Central file listing or reading prepared under the kernel lock
/// (`Kernel::prepare_files_read`). Its owner call runs outside the lock
/// (`execute`); what the ordered path records — the listing's retention, the
/// reading's retained copy and the file's registration, which the
/// `SurfaceOpen` gate requires — is recorded under the lock afterwards
/// (`Kernel::finish_files_read`): never before the owner answered, never
/// skipped. A host that does not prepare it applies the op in order.
pub struct PreparedFiles {
    client: CentralClient,
    read: FilesRead,
}

enum FilesRead {
    List(PreparedListing),
    Read(files::Location),
}

/// A directory listing's retention, captured under the kernel lock: the
/// listing retained within `DIR_TTL` when one is held, else the pending
/// ticket its answer is retained under.
pub(crate) struct PreparedListing {
    path: String,
    key: String,
    held: Option<files::Directory>,
    ticket: Option<u64>,
}

pub(crate) struct ListingAnswer {
    key: String,
    ticket: Option<u64>,
    directory: Result<files::Directory, String>,
}

/// The owner's answer to a prepared file listing or reading, awaiting its
/// record under the kernel lock (`Kernel::finish_files_read`).
pub struct FilesAnswered(FilesAnswer);

enum FilesAnswer {
    Listed(ListingAnswer),
    Read {
        location: files::Location,
        fetched: Box<Result<retained_files::Fetched, String>>,
    },
}

impl PreparedListing {
    /// The owner's listing, unless a retained one was held.
    pub(crate) fn execute(self, client: &CentralClient) -> ListingAnswer {
        let directory = match self.held {
            Some(directory) => Ok(directory),
            None => files::list(client, &self.path),
        };
        ListingAnswer {
            key: self.key,
            ticket: self.ticket,
            directory,
        }
    }
}

impl PreparedFiles {
    /// The owner calls, outside the kernel lock. Nothing is recorded here.
    pub fn execute(self) -> FilesAnswered {
        FilesAnswered(match self.read {
            FilesRead::List(listing) => FilesAnswer::Listed(listing.execute(&self.client)),
            FilesRead::Read(location) => FilesAnswer::Read {
                fetched: Box::new(retained_files::Store::fetch(&self.client, &location)),
                location,
            },
        })
    }
}

impl Kernel {
    /// `FilesList` and `FileRead`, prepared under the kernel lock; every
    /// other op is not a file read.
    pub fn prepare_files_read(&mut self, op: &KernelOp) -> Option<PreparedFiles> {
        let read = match op {
            KernelOp::FilesList { path, fresh } => {
                FilesRead::List(self.prepare_listing(path, fresh.unwrap_or(false)))
            }
            KernelOp::FileRead { location } => FilesRead::Read(location.clone()),
            _ => return None,
        };
        Some(PreparedFiles {
            client: self.client.clone(),
            read,
        })
    }

    /// Record a prepared file read's answer under the kernel lock, exactly
    /// as the ordered `FilesList`/`FileRead` arms record theirs.
    pub fn finish_files_read(&mut self, done: FilesAnswered) -> Result<KernelOpOutcome, String> {
        match done.0 {
            FilesAnswer::Listed(answer) => Ok(KernelOpOutcome {
                receipts: Vec::new(),
                result: KernelOpResult::DirectoryRead {
                    directory: self.finish_listing(answer)?,
                },
            }),
            FilesAnswer::Read { location, fetched } => self.finish_file_read(&location, *fetched),
        }
    }

    /// A listing's retention as the ordered path keeps it: a fresh listing
    /// withdraws the retained one; otherwise one retained within `DIR_TTL`
    /// answers without the owner.
    pub(crate) fn prepare_listing(&mut self, path: &str, fresh: bool) -> PreparedListing {
        let key = format!("dir:{path}");
        let held = if fresh {
            self.reads.invalidate(&key);
            None
        } else {
            self.reads
                .get(&key, read_cache::DIR_TTL)
                .and_then(|value| serde_json::from_value(value).ok())
        };
        let ticket = held.is_none().then(|| self.reads.begin(key.clone()));
        PreparedListing {
            path: path.to_owned(),
            key,
            held,
            ticket,
        }
    }

    /// Retain an owner listing — unless its directory was invalidated while
    /// it was read (a write into it, a ground change) or a newer listing
    /// superseded it: that listing is answered, never retained.
    pub(crate) fn finish_listing(
        &mut self,
        answer: ListingAnswer,
    ) -> Result<files::Directory, String> {
        let current = answer
            .ticket
            .is_some_and(|ticket| self.reads.finish(&answer.key, ticket));
        let directory = answer.directory?;
        if current {
            if let Ok(value) = serde_json::to_value(&directory) {
                self.reads.put(answer.key, value);
            }
        }
        Ok(directory)
    }

    /// Record a file reading: the store keeps the reading (or remembers the
    /// failure), a refused read withdraws the file's registration and keeps
    /// the owner's words, and a served read registers the file — the
    /// `SurfaceOpen` gate's precondition.
    pub(crate) fn finish_file_read(
        &mut self,
        location: &files::Location,
        fetched: Result<retained_files::Fetched, String>,
    ) -> Result<KernelOpOutcome, String> {
        let reading = match fetched.and_then(|fetched| self.retained_files.record(fetched)) {
            Ok(reading) => reading,
            Err(error) => {
                self.file_refs.remove(&location.ref_id);
                return Err(error);
            }
        };
        let project = reading
            .project
            .as_ref()
            .and_then(|p| p.project_ref.as_ref())
            .map(|id| {
                focus::ProjectRef::try_from(owner_relation(id, "project", "central.files.read"))
            })
            .transpose()
            .map_err(|e| e.to_string())?;
        self.file_refs.insert(
            reading.location.ref_id.clone(),
            (
                owner_relation(&reading.location.ref_id, "file", "central.files.read"),
                project,
            ),
        );
        Ok(KernelOpOutcome {
            receipts: Vec::new(),
            result: KernelOpResult::FileRead { reading },
        })
    }
}

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
    graph: Option<crate::graph::PreparedGraph>,
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
                graph: None,
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
            | KernelOp::MusicModesRead
            | KernelOp::JankoWindowRead { .. }
            | KernelOp::LiveSetRead { .. }
            | KernelOp::LiveDeviceDescriptors
            | KernelOp::LiveDeviceParamsRead { .. }
            | KernelOp::LiveDeviceParamWrite { .. }
            | KernelOp::CompositionRead { .. }
            // Central's own route and Workcell's status record nothing in the
            // kernel; their owners order their own writes.
            | KernelOp::Central { .. }
            | KernelOp::WorkcellStatusRead
            // Central's Day and NOW readings, through its guarded readers.
            | KernelOp::DayRead { .. }
            | KernelOp::Now { .. }
            // The bounded telemetry follow waits on the owner for its whole
            // window; it reads only the owner's state file, never the kernel's.
            | KernelOp::FactoryOwner { request: crate::factory::OwnerRequest::TelemetryWatch { .. } } => Some(Self {
                client: client.clone(),
                world,
                op: op.clone(),
                temporal: None,
                graph: None,
            }),
            _ => None,
        }
    }

    /// The Graph op, prepared under the kernel lock (graph.rs `PreparedGraph`).
    pub(crate) fn graph(
        client: &CentralClient,
        op: &KernelOp,
        graph: crate::graph::PreparedGraph,
    ) -> Self {
        Self {
            client: client.clone(),
            world: None,
            op: op.clone(),
            temporal: None,
            graph: Some(graph),
        }
    }

    pub fn execute(self) -> Result<KernelOpOutcome, String> {
        if let Some(graph) = self.graph {
            return graph.execute();
        }
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
        // Central's route, its Day reading and Workcell's status need no
        // World, so none pays for its discovery; a NOW reading reads it only
        // to gate a named project.
        if let KernelOp::Central { project, request } = &self.op {
            return Ok(KernelOpOutcome {
                receipts: vec![],
                result: KernelOpResult::CentralReading {
                    data: crate::central::operate(&self.client, project.as_deref(), request)?,
                },
            });
        }
        if let KernelOp::DayRead { day_ref } = &self.op {
            return Ok(KernelOpOutcome {
                receipts: vec![],
                result: KernelOpResult::DayReading {
                    data: crate::central::day(&self.client, None, day_ref.as_deref())?,
                },
            });
        }
        // The same disclosure gate as the ordered arm: a named project must
        // be inside Central's disclosed ground; `None` is the root register.
        if let KernelOp::Now { project, request } = &self.op {
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
            return Ok(KernelOpOutcome {
                receipts: vec![],
                result: KernelOpResult::NowReading {
                    data: self
                        .client
                        .now(project.as_deref(), request)
                        .map_err(|error| error.to_string())?,
                },
            });
        }
        if matches!(&self.op, KernelOp::WorkcellStatusRead) {
            return Ok(KernelOpOutcome {
                receipts: vec![],
                result: KernelOpResult::WorkcellStatusReading {
                    data: workcell_status()?,
                },
            });
        }
        // The Live document owner (the 8787 seam's replacements). None of these
        // needs the World, so none pays for its discovery.
        if let Some(result) = crate::live_set_owner::execute(&self.op) {
            return Ok(KernelOpOutcome {
                receipts: vec![],
                result: result?,
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
            KernelOp::MusicModesRead => KernelOpResult::MusicModesReading {
                document: crate::ql_music::read_modes()?,
            },
            KernelOp::JankoWindowRead {
                lens,
                first_column,
                columns,
            } => KernelOpResult::JankoWindowReading {
                document: crate::ql_music::read_janko_window(lens, first_column, columns)?,
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

/// Workcell's own status reading (`workcell status --json`, or the suite's
/// `oi workcell status --json`).
fn workcell_status() -> Result<Value, String> {
    let workcell = std::env::var_os("OI_WORKCELL_BIN").map(PathBuf::from);
    let (executable, namespace): (PathBuf, Option<&str>) = match workcell {
        Some(path) => (path, None),
        None => (
            std::env::var_os("OI_BIN")
                .map(PathBuf::from)
                .unwrap_or_else(|| PathBuf::from("oi")),
            Some("workcell"),
        ),
    };
    let mut args: Vec<std::ffi::OsString> = Vec::new();
    if let Some(name) = namespace {
        args.push(name.into());
    }
    args.extend(["status".into(), "--json".into()]);
    crate::material::invoke(&executable, &args, None).map_err(|e| {
        serde_json::to_string(&e).unwrap_or_else(|_| "workcell status read failed".into())
    })
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

    #[cfg(unix)]
    fn location(path: &str) -> files::Location {
        files::Location {
            schema: "central.path-ref/v1".into(),
            ref_id: format!("ref:{path}"),
            root: "R".into(),
            path: path.into(),
        }
    }

    /// A retained-copy store of this test's own, never the native home.
    #[cfg(unix)]
    fn store(test: &str) -> PathBuf {
        std::env::temp_dir().join(format!("oi-cradle-{}-{test}-retained", std::process::id()))
    }

    /// A FileRead's owner call answers while an ordered op holds the kernel
    /// lock, and the file is registered — the SurfaceOpen gate's
    /// precondition — only when that answer is finished under the lock:
    /// the same answer and registration as the ordered arm, and no event.
    #[cfg(unix)]
    #[test]
    fn a_prepared_file_read_runs_outside_the_lock_and_registers_the_file_when_finished() {
        let owner = crate::tests::FakeOwner::spawn_counter("prepared-file-read");
        let dir = store("prepared-file-read");
        let mut kernel = owner.kernel();
        kernel.retained_files = retained_files::Store::at(dir.clone());
        let events = kernel.event_log().since(0).len();
        let kernel = Arc::new(Mutex::new(kernel));
        let read = KernelOp::FileRead {
            location: location("Work/proj/a.md"),
        };
        let prepared = kernel.lock().unwrap().prepare_files_read(&read).unwrap();
        let held = kernel.lock().unwrap();
        let (answer, answered) = std::sync::mpsc::channel();
        std::thread::spawn(move || answer.send(prepared.execute()).unwrap());
        let answered = answered
            .recv_timeout(std::time::Duration::from_secs(20))
            .expect("the owner answers while the kernel lock is held");
        assert!(
            !held.file_refs.contains_key("ref:Work/proj/a.md"),
            "nothing is registered before the owner's answer is finished"
        );
        drop(held);
        let outcome = kernel.lock().unwrap().finish_files_read(answered).unwrap();
        let kernel = kernel.lock().unwrap();
        assert!(kernel.file_refs.contains_key("ref:Work/proj/a.md"));
        assert!(outcome.receipts.is_empty());
        assert_eq!(
            kernel.event_log().since(0).len(),
            events,
            "a read emits nothing"
        );
        assert_eq!(owner.spawns("central.files.read"), 1);
        let mut ordered = owner.kernel();
        ordered.retained_files = retained_files::Store::at(dir.clone());
        let applied = ordered.apply(read).unwrap();
        assert_eq!(
            applied.result, outcome.result,
            "the ordered arm answers the same reading"
        );
        assert_eq!(
            ordered.file_refs.keys().collect::<Vec<_>>(),
            kernel.file_refs.keys().collect::<Vec<_>>()
        );
        let _ = std::fs::remove_dir_all(dir);
    }

    /// A refused read answers with the owner's words and withdraws the
    /// file's registration — under the lock, after the owner answered.
    #[cfg(unix)]
    #[test]
    fn a_refused_prepared_file_read_keeps_the_owner_words_and_withdraws_the_registration() {
        let owner = crate::tests::FakeOwner::spawn_counter("prepared-file-refused");
        let dir = store("prepared-file-refused");
        let mut kernel = owner.kernel();
        kernel.retained_files = retained_files::Store::at(dir.clone());
        let refused = location("Work/proj/refused.md");
        kernel.file_refs.insert(
            refused.ref_id.clone(),
            (
                owner_relation(&refused.ref_id, "file", "central.files.read"),
                None,
            ),
        );
        let answered = kernel
            .prepare_files_read(&KernelOp::FileRead {
                location: refused.clone(),
            })
            .unwrap()
            .execute();
        assert!(
            kernel.file_refs.contains_key(&refused.ref_id),
            "the registration stands until the answer is finished"
        );
        assert_eq!(
            kernel.finish_files_read(answered).unwrap_err(),
            "Central excludes this file from retrieval"
        );
        assert!(!kernel.file_refs.contains_key(&refused.ref_id));
        let _ = std::fs::remove_dir_all(dir);
    }

    /// A prepared listing is retained as the ordered path retains it, and
    /// served from retention by either path — unless its directory was
    /// invalidated while it was read (a write into it): that listing is
    /// answered, never retained. A fresh listing re-asks the owner.
    #[cfg(unix)]
    #[test]
    fn a_prepared_listing_is_retained_unless_its_directory_changed_while_it_was_read() {
        let owner = crate::tests::FakeOwner::spawn_counter("prepared-listing");
        let mut kernel = owner.kernel();
        let list = |fresh| KernelOp::FilesList {
            path: "Work/proj".into(),
            fresh,
        };
        assert!(kernel.prepare_files_read(&KernelOp::WorldRead).is_none());
        let answered = kernel.prepare_files_read(&list(None)).unwrap().execute();
        kernel.reads.invalidate("dir:Work/proj");
        let outcome = kernel.finish_files_read(answered).unwrap();
        assert!(matches!(
            outcome.result,
            KernelOpResult::DirectoryRead { ref directory } if directory.entries.len() == 1
        ));
        let answered = kernel.prepare_files_read(&list(None)).unwrap().execute();
        assert_eq!(
            owner.spawns("central.files.list"),
            2,
            "a listing invalidated while it was read is not retained"
        );
        kernel.finish_files_read(answered).unwrap();
        let answered = kernel.prepare_files_read(&list(None)).unwrap().execute();
        kernel.finish_files_read(answered).unwrap();
        kernel.apply(list(None)).unwrap();
        assert_eq!(
            owner.spawns("central.files.list"),
            2,
            "a retained listing serves both paths without the owner"
        );
        let answered = kernel
            .prepare_files_read(&list(Some(true)))
            .unwrap()
            .execute();
        kernel.finish_files_read(answered).unwrap();
        assert_eq!(owner.spawns("central.files.list"), 3);
    }

    /// The Live document owner's ops run outside the kernel lock, the device
    /// write included: it rewrites a user file, not kernel state.
    #[test]
    fn the_live_document_owner_ops_prepare_outside_the_lock() {
        let client = CentralClient::discover();
        for value in [
            serde_json::json!({"op": "live_set_read", "path": "/a.als"}),
            serde_json::json!({"op": "live_device_descriptors"}),
            serde_json::json!({"op": "live_device_params_read", "path": "/a.als", "track": "Master", "device": "Compressor2"}),
            serde_json::json!({"op": "live_device_param_write", "path": "/a.als", "track": "Master", "device_name": "Compressor2", "param_id": "Threshold", "value": 0.5}),
        ] {
            let op: KernelOp = serde_json::from_value(value).unwrap();
            assert!(PreparedRead::prepare(&client, None, &op, None).is_some());
        }
    }
}
