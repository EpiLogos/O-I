//! Native configuration disclosures do not mutate kernel state. Prepare their
//! immutable inputs under the kernel lock, then run owner processes without
//! holding the ordered mutation/event queue. Admission stays with each owner.
use crate::{
    agent_prepared::PreparedWorld, files, flow::ReceivingRequest, focus, owner_relation,
    read_cache, retained_files, CentralClient, Kernel, KernelOp, KernelOpOutcome, KernelOpResult,
};
use serde_json::Value;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

/// A Central file listing or reading prepared under the kernel lock
/// (`Kernel::prepare_files_read`). Its owner call runs outside the lock
/// (`execute`), and so does writing a reading's retained copy to disk; what
/// the ordered path records — the listing's retention, the store's note of
/// the reading and the file's registration, which the `SurfaceOpen` gate
/// requires — is recorded under the lock afterwards
/// (`Kernel::finish_files_read`): never before the owner answered, never
/// skipped. A host that does not prepare it applies the op in order.
///
/// The same discipline serves a file's bytes (`FileBytes`, the material
/// route's reading), a last-reading recovery, the participating sources'
/// listing and an open source's history (lane K2).
pub struct PreparedFiles {
    client: CentralClient,
    retainer: retained_files::Retainer,
    read: FilesRead,
}

enum FilesRead {
    List(PreparedListing),
    Read(files::Location),
    Bytes(files::Location),
    LastReading(files::Location),
    Sources(PreparedSources),
    /// An open source's history: the buffer's Project, captured under the
    /// lock; nothing is recorded.
    History {
        project: String,
        source_ref: String,
    },
}

/// The participating sources' listing, retained for `HORIZON_TTL` as the
/// ordered path retains it: the held listing, else the ticket its answer is
/// retained under (a degraded listing is answered, never retained).
pub(crate) struct PreparedSources {
    project: Option<String>,
    key: String,
    held: Option<crate::world::SourceListing>,
    ticket: Option<u64>,
}

pub(crate) struct SourcesAnswer {
    key: String,
    ticket: Option<u64>,
    listing: crate::world::SourceListing,
}

impl PreparedSources {
    /// The owner's listing, unless a retained one was held.
    pub(crate) fn execute(self, client: &CentralClient) -> SourcesAnswer {
        let listing = match self.held {
            Some(listing) => listing,
            None => crate::world::participating_sources(client, self.project.as_deref()),
        };
        SourcesAnswer {
            key: self.key,
            ticket: self.ticket,
            listing,
        }
    }
}

/// A directory listing's retention, captured under the kernel lock: the
/// listing retained within `DIR_TTL` when one is held, else the pending
/// ticket its answer is retained under.
pub(crate) struct PreparedListing {
    path: String,
    /// An explicit refresh: the owner is asked, whatever is retained.
    fresh: bool,
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
    /// A reading whose retained copy was already kept on disk.
    Read {
        location: files::Location,
        fetched: Box<Result<retained_files::Fetched, String>>,
    },
    Bytes {
        location: files::Location,
        reading: Box<Result<files::BytesReading, String>>,
    },
    LastReading(Box<retained_files::Recovering>),
    Sources(SourcesAnswer),
    History(Result<crate::history::SourceHistory, String>),
}

impl PreparedListing {
    /// The owner's listing, unless a retained one was held.
    pub(crate) fn execute(self, client: &CentralClient) -> ListingAnswer {
        let directory = match self.held {
            Some(directory) => Ok(directory),
            None if self.fresh => read_cache::with_fresh(|| files::list(client, &self.path)),
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
    /// The owner calls, outside the kernel lock, and a served reading's
    /// retained copy written to disk. Nothing is recorded in the kernel here.
    pub fn execute(self) -> FilesAnswered {
        FilesAnswered(match self.read {
            FilesRead::List(listing) => FilesAnswer::Listed(listing.execute(&self.client)),
            FilesRead::Read(location) => {
                let fetched = retained_files::Store::fetch(&self.client, &location);
                if let Ok(fetched) = &fetched {
                    self.retainer.keep(fetched);
                }
                FilesAnswer::Read {
                    fetched: Box::new(fetched),
                    location,
                }
            }
            FilesRead::Bytes(location) => FilesAnswer::Bytes {
                reading: Box::new(files::read_bytes(&self.client, &location)),
                location,
            },
            FilesRead::LastReading(location) => {
                FilesAnswer::LastReading(Box::new(self.retainer.recover(&self.client, &location)))
            }
            FilesRead::Sources(sources) => FilesAnswer::Sources(sources.execute(&self.client)),
            FilesRead::History {
                project,
                source_ref,
            } => FilesAnswer::History(
                crate::history::read(&self.client, &project, &source_ref)
                    .map_err(|e| e.to_string()),
            ),
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
            KernelOp::FileBytes { location } => FilesRead::Bytes(location.clone()),
            KernelOp::FileLastReading { location } => FilesRead::LastReading(location.clone()),
            KernelOp::SourcesList { project } => {
                FilesRead::Sources(self.prepare_sources(project.as_deref()))
            }
            // A source not open answers the ordered arm's refusal.
            KernelOp::SourceHistory { source_ref } => FilesRead::History {
                project: self.buffers.get(source_ref)?.project.clone(),
                source_ref: source_ref.clone(),
            },
            _ => return None,
        };
        Some(PreparedFiles {
            client: self.client.clone(),
            retainer: self.retained_files.retainer(),
            read,
        })
    }

    /// Record a prepared file read's answer under the kernel lock, exactly
    /// as the ordered `FilesList`/`FileRead` arms record theirs.
    pub fn finish_files_read(&mut self, done: FilesAnswered) -> Result<KernelOpOutcome, String> {
        match done.0 {
            FilesAnswer::Listed(answer) => Ok(KernelOpOutcome {
                read_scopes: None,
                receipts: Vec::new(),
                result: KernelOpResult::DirectoryRead {
                    directory: self.finish_listing(answer)?,
                },
            }),
            FilesAnswer::Read { location, fetched } => {
                let reading = fetched.and_then(|fetched| self.retained_files.note(fetched));
                self.finish_file_read(&location, reading)
            }
            FilesAnswer::Bytes { location, reading } => self.finish_file_bytes(&location, *reading),
            FilesAnswer::LastReading(recovering) => Ok(KernelOpOutcome {
                read_scopes: None,
                receipts: Vec::new(),
                result: KernelOpResult::FileLastReading {
                    recovery: self.retained_files.recovered(*recovering)?,
                },
            }),
            FilesAnswer::Sources(answer) => Ok(KernelOpOutcome {
                read_scopes: None,
                receipts: Vec::new(),
                result: KernelOpResult::SourcesListed {
                    listing: self.finish_sources(answer),
                },
            }),
            FilesAnswer::History(history) => Ok(KernelOpOutcome {
                read_scopes: None,
                receipts: Vec::new(),
                result: KernelOpResult::SourceHistory { history: history? },
            }),
        }
    }

    /// The participating sources' retention as the ordered path keeps it: a
    /// listing retained within `HORIZON_TTL` answers without the owner.
    pub(crate) fn prepare_sources(&mut self, project: Option<&str>) -> PreparedSources {
        let key = format!("horizon:{}", project.unwrap_or(""));
        let held = self
            .reads
            .get(&key, read_cache::HORIZON_TTL)
            .and_then(|value| serde_json::from_value(value).ok());
        let ticket = held.is_none().then(|| self.reads.begin(key.clone()));
        PreparedSources {
            project: project.map(str::to_owned),
            key,
            held,
            ticket,
        }
    }

    /// Retain a horizon-served listing — a degraded reading is the error
    /// path, never retained — unless a newer listing or an invalidation
    /// moved its key while it was read.
    pub(crate) fn finish_sources(&mut self, answer: SourcesAnswer) -> crate::world::SourceListing {
        let current = answer
            .ticket
            .is_some_and(|ticket| self.reads.finish(&answer.key, ticket));
        if current
            && matches!(
                answer.listing.availability,
                crate::world::ListingAvailability::Horizon
            )
        {
            if let Ok(value) = serde_json::to_value(&answer.listing) {
                self.reads.put(answer.key, value);
            }
        }
        answer.listing
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
            fresh,
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
        reading: Result<files::Reading, String>,
    ) -> Result<KernelOpOutcome, String> {
        let reading = match reading {
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
            read_scopes: None,
            receipts: Vec::new(),
            result: KernelOpResult::FileRead { reading },
        })
    }

    /// Record a file's bytes reading as `finish_file_read` records a reading:
    /// a refused read withdraws the file's registration; a served one
    /// registers it. FND-04: a binary material file (image/pdf/unsupported)
    /// is opened as a surface through this op, never `FileRead` — the
    /// `SurfaceOpen` gate ("File must be read successfully through Central
    /// before opening its surface") checks `file_refs` regardless of which
    /// read resolved the ref, so this registration is required exactly as
    /// `FileRead`'s is.
    pub(crate) fn finish_file_bytes(
        &mut self,
        location: &files::Location,
        reading: Result<files::BytesReading, String>,
    ) -> Result<KernelOpOutcome, String> {
        let reading = match reading {
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
            read_scopes: None,
            receipts: Vec::new(),
            result: KernelOpResult::FileBytes {
                location: reading.location,
                revision: reading.revision,
                byte_len: reading.byte_len,
                mime_hint: reading.mime_hint,
                content_base64: reading.content_base64,
                source: reading.source,
            },
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
    world: PreparedWorld,
    op: KernelOp,
    temporal: Option<TemporalReadInputs>,
    graph: Option<crate::graph::PreparedGraph>,
}

impl PreparedRead {
    pub(crate) fn prepare(
        client: &CentralClient,
        world: PreparedWorld,
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
            | KernelOp::LiveClipRead { .. }
            | KernelOp::LiveClipWrite { .. }
            | KernelOp::LiveClipCreate { .. }
            | KernelOp::LiveTrackMixerWrite { .. }
            | KernelOp::LiveTakeComp { .. }
            | KernelOp::LiveGroovePoolRead { .. }
            | KernelOp::LiveGroovePoolWrite { .. }
            | KernelOp::LiveSetAct { .. }
            | KernelOp::CompositionRead { .. }
            // Central's own route and Workcell's status record nothing in the
            // kernel. Central's Day writes are prepared writes (owner_write.rs):
            // their finish records what the owner did.
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
            KernelOp::Page { request } if !request.is_write() => Some(Self {
                client: client.clone(),
                world,
                op: op.clone(),
                temporal: None,
                graph: None,
            }),
            KernelOp::Central { request, .. } if !crate::owner_write::central_write(request) => Some(Self {
                client: client.clone(),
                world,
                op: op.clone(),
                temporal: None,
                graph: None,
            }),
            op if Self::reads_owner(op) => Some(Self {
                client: client.clone(),
                world,
                op: op.clone(),
                temporal: None,
                graph: None,
            }),
            _ => None,
        }
    }

    /// The owner reads lane K left under the lock, now prepared (lane K2):
    /// each records nothing in the kernel. Their owners' writes — a Factory
    /// action, recognition, commission or close; a credential change — are
    /// prepared writes (owner_write.rs); a SharedField write is free
    /// (dispatch.rs, lane W3).
    pub(crate) fn reads_owner(op: &KernelOp) -> bool {
        match op {
            KernelOp::MaterialRead { .. }
            | KernelOp::FactoryBuildSnapshot { .. }
            | KernelOp::FactoryDevelopmentRead { .. }
            | KernelOp::FactoryAttemptRead { .. }
            | KernelOp::FactoryAttemptTaskListRead { .. }
            | KernelOp::FactoryAttemptTaskRead { .. }
            | KernelOp::InhabitationRead { .. }
            | KernelOp::WikiProjectionRead { .. }
            | KernelOp::WikiProjectionSources
            | KernelOp::ChatDefaultRead
            | KernelOp::CredentialList
            | KernelOp::CredentialDiscover
            | KernelOp::HarnessAuthDescribe { .. }
            | KernelOp::ProfileList
            | KernelOp::ProfileRead { .. }
            | KernelOp::ConfigReceipts
            | KernelOp::AgentCard { .. }
            | KernelOp::EncounterJoin { .. }
            | KernelOp::FlowChangedSince { .. }
            | KernelOp::KnowledgeImpact { .. }
            // Lane K1: the seat instrument, Central's source returns and
            // AIKit's declared remotes — each needs no World.
            | KernelOp::SeatStatusRead
            | KernelOp::SourceReturnsRead { .. }
            | KernelOp::GatewayRemotesRead
            // Lane W3 (T-COVERAGE §1.2): the owner routes that only read
            // (owner_routes.rs); a team action other than `read` is a write.
            | KernelOp::ActuationRead { .. }
            | KernelOp::QlRead { .. }
            | KernelOp::WorkcellRead { .. }
            | KernelOp::AikitRead { .. } => true,
            KernelOp::GatewayTeam { request } => request.is_read(),
            KernelOp::FactoryOwner { request } => request.is_read(),
            KernelOp::SharedField { request } => crate::shared_field::is_read(request),
            // Nara's practice reads (T-WORLDS W4): QL over what Central's owners read; none needs the World. A journey's
            // opening and acts are prepared writes (owner_write.rs).
            KernelOp::NaraJourney { request } => !request.is_write(),
            KernelOp::NaraLivedContext { .. } | KernelOp::NaraElemental { .. } => true,
            _ => false,
        }
    }

    /// Whether a prepared owner read is scoped by the World (it then shares
    /// its burst's World reading, read_cache `flight`).
    pub(crate) fn reads_world(op: &KernelOp) -> bool {
        matches!(
            op,
            KernelOp::FactoryBuildSnapshot { .. }
                | KernelOp::FactoryDevelopmentRead { .. }
                | KernelOp::FactoryOwner {
                    request: crate::factory::OwnerRequest::Locate { .. }
                }
                | KernelOp::InhabitationRead { .. }
                | KernelOp::CredentialList
                | KernelOp::CredentialDiscover
                | KernelOp::HarnessAuthDescribe { .. }
                | KernelOp::ProfileList
                | KernelOp::ProfileRead { .. }
                | KernelOp::ConfigReceipts
                | KernelOp::EncounterJoin { .. }
                | KernelOp::FlowChangedSince { .. }
                | KernelOp::KnowledgeImpact { .. }
        )
    }

    /// The Graph op, prepared under the kernel lock (graph.rs `PreparedGraph`).
    pub(crate) fn graph(
        client: &CentralClient,
        op: &KernelOp,
        graph: crate::graph::PreparedGraph,
    ) -> Self {
        Self {
            client: client.clone(),
            world: PreparedWorld::held_only(client.clone(), None),
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
                read_scopes: None,
                receipts: vec![],
                result: KernelOpResult::TemporalEventsReading {
                    document: serde_json::to_value(answer).map_err(|error| error.to_string())?,
                },
            });
        }
        // Inbox reads may fan out across many project registers at startup.
        // They do not alter kernel state and must not hold up native editing.
        // Submit/review/include/recover are prepared writes (owner_write.rs).
        if let KernelOp::Receiving { project, request } = &self.op {
            if let Some(project) = project {
                disclosed(&self.world.read()?, project)?;
            }
            let data = self
                .client
                .receiving(project.as_deref(), request)
                .map_err(|error| error.to_string())?;
            return Ok(KernelOpOutcome {
                read_scopes: None,
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
                read_scopes: None,
                receipts: vec![],
                result: KernelOpResult::FactoryDevelopmentReading { data },
            });
        }
        // Central's route, its Day reading and Workcell's status need no
        // World, so none pays for its discovery; a NOW reading reads it only
        // to gate a named project.
        // A page and a world's pages: the file owner's reads, each island
        // placed by its form (page.rs); no World is read.
        if let KernelOp::Page { request } = &self.op {
            let data = match request {
                crate::page::Request::Read { location } => {
                    crate::page::read(&self.client, location)?
                }
                crate::page::Request::List { path, limit } => {
                    crate::page::list_pages(&self.client, path, *limit)?
                }
                crate::page::Request::MutateField { .. }
                | crate::page::Request::Launch { .. }
                | crate::page::Request::Stop { .. } => {
                    return Err("A page's write is the owner write's, not a read".into())
                }
            };
            return Ok(KernelOpOutcome {
                read_scopes: None,
                receipts: vec![],
                result: KernelOpResult::PageReading { data },
            });
        }
        if let KernelOp::Central { project, request } = &self.op {
            return Ok(KernelOpOutcome {
                read_scopes: None,
                receipts: vec![],
                result: KernelOpResult::CentralReading {
                    data: crate::central::operate(&self.client, project.as_deref(), request)?,
                },
            });
        }
        if let KernelOp::DayRead { day_ref } = &self.op {
            return Ok(KernelOpOutcome {
                read_scopes: None,
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
                disclosed(&self.world.read()?, project)?;
            }
            return Ok(KernelOpOutcome {
                read_scopes: None,
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
                read_scopes: None,
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
                read_scopes: None,
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
                read_scopes: None,
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
                        .held()
                        .and_then(|world| world["root"].as_str())
                        .map(std::path::PathBuf::from)
                });
            let cwd = match cwd {
                Some(cwd) => cwd,
                None => std::env::current_dir().map_err(|e| e.to_string())?,
            };
            let document = crate::configuration::Client::discover().capabilities(&cwd)?;
            return Ok(KernelOpOutcome {
                read_scopes: None,
                receipts: vec![],
                result: KernelOpResult::ConfigCapabilitiesReading { document },
            });
        }

        if let Some(answer) = self.owner_reading() {
            return answer.map(|result| KernelOpOutcome {
                read_scopes: None,
                receipts: Vec::new(),
                result,
            });
        }
        let world = self.world.read().ok();
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
            read_scopes: None,
            receipts: Vec::new(),
            result,
        })
    }
}

impl PreparedRead {
    /// The owner reads lane K left under the lock (lane K2), each asking its
    /// owner here — outside the lock — and answering what its ordered arm
    /// answered: the arm in lib.rs `apply` now runs these same steps. Ported
    /// from those arms; the World is the one preparation captured
    /// (`PreparedWorld`), never a second read per op of a burst.
    fn owner_reading(&self) -> Option<Result<KernelOpResult, String>> {
        if !Self::reads_owner(&self.op)
            || matches!(
                &self.op,
                KernelOp::FactoryOwner {
                    request: crate::factory::OwnerRequest::TelemetryWatch { .. }
                }
            )
        {
            return None;
        }
        Some(self.owner_read())
    }

    fn owner_read(&self) -> Result<KernelOpResult, String> {
        use crate::{factory, material};
        let failed = |what: &'static str| {
            move |error: material::Error| {
                serde_json::to_string(&error).unwrap_or_else(|_| what.into())
            }
        };
        Ok(match &self.op {
            KernelOp::MaterialRead { target } => {
                return crate::native_owner_reading(
                    "workcell",
                    material::Client::discover().read(target),
                )
                .map(|outcome| outcome.result)
            }
            KernelOp::NaraJourney { request } => KernelOpResult::NaraJourney {
                data: crate::nara_journey::execute(&self.client, request)?,
            },
            KernelOp::NaraLivedContext { request } => KernelOpResult::NaraLivedContext {
                data: crate::nara_lived_context::execute(&self.client, request)?,
            },
            KernelOp::NaraElemental { request } => KernelOpResult::NaraElemental {
                data: crate::nara_elemental::execute(&self.client, request)?,
            },
            KernelOp::FactoryBuildSnapshot {
                project,
                state_path,
                project_ref,
                run_ref,
            } => {
                if let Some(project) = project {
                    disclosed(&self.world.read()?, project)?;
                }
                let (executable, suite_route) = factory::owner_executable();
                let data = factory::Client::with(executable)
                    .build_snapshot(state_path, project_ref, run_ref, suite_route)
                    .map_err(|e| {
                        serde_json::to_string(&e)
                            .unwrap_or_else(|_| "factory build snapshot failed".into())
                    })?;
                KernelOpResult::FactoryDevelopmentReading { data }
            }
            KernelOp::FactoryDevelopmentRead {
                project,
                state_path,
                read,
                subject,
            } => {
                if let Some(project) = project {
                    disclosed(&self.world.read()?, project)?;
                }
                // The allowlist holds on this path too: the arm builds the
                // owner grammar itself, so it must not bypass the list the
                // client enforces.
                if !factory::is_development_read(read) {
                    return Err(format!("Unsupported Factory development read ({read})"));
                }
                let (executable, suite_route) = factory::owner_executable();
                let args = factory::development_read_args(
                    state_path,
                    read,
                    subject.as_deref(),
                    suite_route,
                );
                KernelOpResult::FactoryDevelopmentReading {
                    data: material::invoke(&executable, &args, None)
                        .map_err(failed("factory development read failed"))?,
                }
            }
            KernelOp::FactoryAttemptRead {
                state_path,
                run_ref,
            } => {
                let data = factory_attempt(
                    &["attempt", "read"],
                    state_path,
                    &[run_ref],
                    &[],
                    "factory attempt read failed",
                )?;
                if data.get("contract").and_then(Value::as_str)
                    != Some("factory.attempt-reading/v1")
                {
                    return Err("Factory returned incompatible attempt reading".into());
                }
                KernelOpResult::FactoryAttemptReading { data }
            }
            KernelOp::FactoryAttemptTaskListRead {
                state_path,
                run_ref,
            } => {
                let data = factory_attempt(
                    &["attempt", "list"],
                    state_path,
                    &[run_ref],
                    &[],
                    "factory attempt list failed",
                )?;
                if data.get("contract").and_then(Value::as_str)
                    != Some("factory.attempt-task-list-reading/v1")
                {
                    return Err("Factory returned incompatible attempt-task list reading".into());
                }
                KernelOpResult::FactoryAttemptTaskListReading { data }
            }
            KernelOp::FactoryAttemptTaskRead {
                state_path,
                run_ref,
                task_ref,
                limit,
                cursor,
            } => {
                let mut tail: Vec<std::ffi::OsString> = Vec::new();
                if let Some(limit) = limit {
                    tail.push("--limit".into());
                    tail.push(limit.to_string().into());
                }
                if let Some(cursor) = cursor {
                    tail.push("--cursor".into());
                    tail.push(
                        serde_json::to_string(cursor)
                            .map_err(|e| e.to_string())?
                            .into(),
                    );
                }
                let data = factory_attempt(
                    &["attempt", "task"],
                    state_path,
                    &[run_ref, task_ref],
                    &tail,
                    "factory attempt task failed",
                )?;
                if data.get("contract").and_then(Value::as_str)
                    != Some("factory.attempt-task-reading/v1")
                {
                    return Err("Factory returned incompatible attempt-task reading".into());
                }
                KernelOpResult::FactoryAttemptTaskReading { data }
            }
            KernelOp::FactoryOwner { request } => {
                let world = if request.needs_world() {
                    Some(self.world.read()?)
                } else {
                    None
                };
                let ask = || {
                    factory::owner(request.clone(), world.as_ref()).map_err(|e| {
                        serde_json::to_string(&e)
                            .unwrap_or_else(|_| "factory owner request failed".into())
                    })
                };
                KernelOpResult::FactoryDevelopmentReading {
                    // Where the Factory's state lives is found by listing each
                    // root's directories: kept while they did not change, and
                    // shared by the panels that ask at once.
                    data: match request {
                        factory::OwnerRequest::Locate { project, all } => {
                            let model = read_cache::ReadModel::global();
                            let scopes = match project {
                                Some(project) if !*all => {
                                    vec![model.watch().project_scope(project)]
                                }
                                _ => vec![crate::watch::Scope::All],
                            };
                            let key = format!(
                                "factory:locate:{}:{project:?}:{all}",
                                self.client.owner_identity()
                            );
                            model.read(
                                &key,
                                &read_cache::Dep::new(scopes, std::time::Duration::from_secs(4)),
                                ask,
                            )?
                        }
                        _ => ask()?,
                    },
                }
            }
            KernelOp::InhabitationRead { request } => {
                // The scope's ground comes from Central's own disclosure: a
                // project's working directory and canonical ProjectRef, or the
                // Central root for a root-scope read (best effort — AIKit
                // resolves its own root when Central's world is unreadable).
                let ground: Option<(PathBuf, Option<String>)> = match request.project() {
                    Some(project) => {
                        let (cwd, project_id) =
                            project_ground(&self.client, &self.world.read()?, project)?;
                        Some((cwd, Some(format!("project:{project_id}"))))
                    }
                    None => self
                        .world
                        .read()
                        .ok()
                        .and_then(|world| world["root"].as_str().map(PathBuf::from))
                        .map(|root| (root, None)),
                };
                let (data, warnings) = crate::inhabitation::read(
                    request,
                    ground
                        .as_ref()
                        .map(|(cwd, world)| (cwd.as_path(), world.as_deref())),
                )
                .map_err(|e| {
                    serde_json::to_string(&e).unwrap_or_else(|_| "inhabitation read failed".into())
                })?;
                KernelOpResult::InhabitationReading { data, warnings }
            }
            KernelOp::WikiProjectionRead { root, path } => {
                let args: Vec<std::ffi::OsString> = vec![
                    "--json".into(),
                    "-C".into(),
                    root.as_os_str().to_string_lossy().into_owned().into(),
                    "wiki".into(),
                    "projection".into(),
                    "read".into(),
                    "--file".into(),
                    path.into(),
                ];
                let data = material::invoke(&aikit(), &args, None)
                    .map_err(failed("wiki projection read failed"))?;
                if data.get("state").and_then(Value::as_str).is_none()
                    || data.get("projection").is_none()
                {
                    return Err("AIKit returned an incompatible wiki projection reading".into());
                }
                KernelOpResult::WikiProjectionReading { data }
            }
            KernelOp::WikiProjectionSources => {
                let args: Vec<std::ffi::OsString> =
                    vec!["--json".into(), "context".into(), "current".into()];
                let data = material::invoke(&aikit(), &args, None)
                    .map_err(failed("wiki projection sources read failed"))?;
                if data.get("continuity").is_none() {
                    return Err("AIKit returned a context reading without continuity".into());
                }
                KernelOpResult::WikiProjectionSourcesReading { data }
            }
            KernelOp::ChatDefaultRead => KernelOpResult::ChatDefaultReading {
                document: crate::chat_defaults::read()?,
            },
            op @ (KernelOp::CredentialList
            | KernelOp::CredentialDiscover
            | KernelOp::HarnessAuthDescribe { .. }) => {
                crate::credentials::apply(&self.root_or_cwd()?, op.clone())?
            }
            KernelOp::ProfileList => {
                let listing =
                    crate::configuration::Client::discover().profile_list(&self.root_or_cwd()?)?;
                KernelOpResult::ProfileListing {
                    active_profile_ref: listing.active_profile_ref,
                    profiles: listing.profiles,
                    degraded: listing.degraded,
                }
            }
            KernelOp::ProfileRead { profile_ref } => KernelOpResult::ProfileReading {
                profile: crate::configuration::Client::discover()
                    .profile_read(&self.root_or_cwd()?, profile_ref)?,
            },
            KernelOp::ConfigReceipts => KernelOpResult::ConfigReceipts {
                document: crate::configuration::Client::discover()
                    .config_receipts(&self.root_or_cwd()?)?,
            },
            KernelOp::AgentCard {
                agent_ref,
                world_ref,
            } => KernelOpResult::AgentCardReading {
                data: crate::agent_card::read(
                    &crate::agent_card::oi_executable(),
                    agent_ref,
                    world_ref.as_deref(),
                )?,
            },
            KernelOp::EncounterJoin {
                session,
                request_ref,
                reply,
            } => {
                // Central discloses the context anchor; the lifecycle store
                // itself is the AIKit owner's, never renderer-supplied.
                let world = self.world.read()?;
                let cwd = PathBuf::from(
                    world["root"]
                        .as_str()
                        .ok_or("Central root location unavailable")?,
                );
                KernelOpResult::EncounterJoined {
                    reading: crate::encounter::assemble(&cwd, session, request_ref, reply.as_ref()),
                }
            }
            KernelOp::SharedField { request } => KernelOpResult::SharedFieldReading {
                data: crate::shared_field::reading(request)?,
            },
            KernelOp::FlowChangedSince { project, thought } => {
                // Central discloses the scope: renderer-supplied paths never
                // become context.
                let cwd = crate::agent_prepared::location(&self.world.read()?, project.as_deref())?;
                KernelOpResult::FlowChangedSince {
                    reading: crate::flow_cognition::changed_since(
                        &self.client,
                        project
                            .as_deref()
                            .unwrap_or_else(|| self.client.configured_project()),
                        &cwd,
                        thought,
                    )
                    .map_err(|e| e.to_string())?,
                }
            }
            KernelOp::KnowledgeImpact {
                project,
                readings,
                max_depth,
                max_affected,
            } => {
                // As for FlowChangedSince: Central discloses the scope.
                let cwd = crate::agent_prepared::location(&self.world.read()?, project.as_deref())?;
                KernelOpResult::KnowledgeImpact {
                    reading: crate::flow_cognition::knowledge_impact(
                        &self.client,
                        project
                            .as_deref()
                            .unwrap_or_else(|| self.client.configured_project()),
                        &cwd,
                        readings,
                        *max_depth,
                        *max_affected,
                    ),
                }
            }
            // The seat instrument reads every seat's git standing (22-30 s
            // for 24 seats): kept while no seat, the Workcell register or
            // Control changed.
            KernelOp::SeatStatusRead => {
                let model = read_cache::ReadModel::global();
                let dep = read_cache::Dep::new(
                    vec![crate::watch::Scope::Seats, crate::watch::Scope::Root],
                    std::time::Duration::from_secs(30),
                )
                .floor(read_cache::WORLD_FLOOR);
                KernelOpResult::SeatStatusReading {
                    data: model.read("seat:status", &dep, || {
                        seat_status().map_err(failed("seat status read failed"))
                    })?,
                }
            }
            KernelOp::SourceReturnsRead {
                project,
                limit,
                before,
            } => KernelOpResult::SourceReturnsReading {
                data: self
                    .client
                    .source_returns(
                        project
                            .as_deref()
                            .unwrap_or_else(|| self.client.configured_project()),
                        *limit,
                        before.as_deref(),
                    )
                    .map_err(|e| e.to_string())?,
            },
            KernelOp::GatewayRemotesRead => {
                let (data, warnings) =
                    gateway_remotes().map_err(failed("gateway remote list failed"))?;
                KernelOpResult::GatewayRemotesReading { data, warnings }
            }
            // Lane W3: the owner routes that only read (owner_routes.rs).
            KernelOp::ActuationRead { request } => {
                crate::owner_routes::actuation_read(request)?.into()
            }
            KernelOp::QlRead { request } => crate::owner_routes::ql_read(request)?.into(),
            KernelOp::WorkcellRead { request } => {
                crate::owner_routes::workcell_read(request)?.into()
            }
            KernelOp::AikitRead { request } => {
                let cwd = self.route_ground(request.project())?.0;
                crate::owner_routes::aikit_read(request, cwd.as_deref())?.into()
            }
            KernelOp::GatewayTeam { request } => {
                let cwd = self.route_ground(request.project.as_deref())?.0;
                crate::owner_routes::gateway_team_read(request, cwd.as_deref())?.into()
            }
            _ => return Err("This operation cannot execute as an independent owner read".into()),
        })
    }

    /// Where an owner route runs (lane W3): a named project's working
    /// directory and canonical Project World, from Central's own disclosure
    /// (never the caller's); else the Central root, best effort (the owner
    /// resolves its own when Central's world is unreadable).
    fn route_ground(&self, project: Option<&str>) -> Result<RouteGround, String> {
        route_ground(&self.client, &self.world, project)
    }

    /// The Central root the World discloses, else this process's directory.
    fn root_or_cwd(&self) -> Result<PathBuf, String> {
        match self
            .world
            .read()
            .ok()
            .and_then(|world| world["root"].as_str().map(PathBuf::from))
        {
            Some(root) => Ok(root),
            None => std::env::current_dir().map_err(|e| e.to_string()),
        }
    }
}

/// A named Project must be inside Central's disclosed ground — the gate
/// every project-scoped op shares.
pub(crate) fn disclosed(world: &Value, project: &str) -> Result<(), String> {
    world["work"]["projects"]
        .as_array()
        .and_then(|rows| {
            rows.iter()
                .find(|row| row["name"].as_str() == Some(project))
        })
        .ok_or("Project is outside Central's disclosed ground")?;
    Ok(())
}

/// A Project's working directory from the World and its canonical
/// ProjectRef from Central's own inspect reading (lib.rs `project_ground`).
pub(crate) fn project_ground(
    client: &CentralClient,
    world: &Value,
    project: &str,
) -> Result<(PathBuf, String), String> {
    let cwd = crate::agent_prepared::location(world, Some(project))?;
    let inspection = client
        .run(
            "projectcentral.inspect",
            serde_json::json!({"project":project}),
        )
        .map_err(|e| e.to_string())?;
    let project_ref = inspection["manifest"]["project_id"]
        .as_str()
        .ok_or("Central has not bound a canonical ProjectRef")?
        .to_owned();
    Ok((cwd, project_ref))
}

/// An owner route's working directory and canonical Project World (lane W3).
pub(crate) type RouteGround = (Option<PathBuf>, Option<String>);

/// See `PreparedRead::route_ground`; the prepared writes share it.
pub(crate) fn route_ground(
    client: &CentralClient,
    world: &PreparedWorld,
    project: Option<&str>,
) -> Result<RouteGround, String> {
    match project {
        Some(project) => {
            let (cwd, project_id) = project_ground(client, &world.read()?, project)?;
            Ok((Some(cwd), Some(format!("project:{project_id}"))))
        }
        None => Ok((
            world
                .read()
                .ok()
                .and_then(|world| world["root"].as_str().map(PathBuf::from)),
            None,
        )),
    }
}

/// AIKit's own executable for the wiki projection reads (`OI_AIKIT_BIN`,
/// else `aikit`).
fn aikit() -> PathBuf {
    std::env::var_os("OI_AIKIT_BIN")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("aikit"))
}

/// One Factory attempt read: `[factory] <verb…> <state> <refs…> --json <tail…>`
/// through the Factory owner (`OI_FACTORY_BIN`, else the suite route).
fn factory_attempt(
    verb: &[&str],
    state_path: &std::path::Path,
    refs: &[&String],
    tail: &[std::ffi::OsString],
    failed: &str,
) -> Result<Value, String> {
    let (executable, suite_route) = crate::factory::owner_executable();
    let mut args: Vec<std::ffi::OsString> = Vec::new();
    if suite_route {
        args.push("factory".into());
    }
    args.extend(verb.iter().map(|word| (*word).into()));
    args.push(state_path.as_os_str().to_string_lossy().into_owned().into());
    args.extend(refs.iter().map(|reference| reference.as_str().into()));
    args.push("--json".into());
    args.extend(tail.iter().cloned());
    crate::material::invoke(&executable, &args, None)
        .map_err(|e| serde_json::to_string(&e).unwrap_or_else(|_| failed.into()))
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

/// The seat instrument's schema (`seat status --json`).
pub const SEAT_STATUS_SCHEMA: &str = "central.workcell-status/v1";
/// AIKit's declared-remotes schema (`aikit gateway remote list --json`).
pub const GATEWAY_REMOTES_SCHEMA: &str = "aikit.gateway-remotes/v1";
/// The seat instrument reads every seat's git standing; measured on
/// 17 Oct 2026 it answered in 22–30 s for 24 seats. The bound is for one
/// that never answers.
const SEAT_STATUS_LIMIT: std::time::Duration = std::time::Duration::from_secs(60);

/// The seat instrument (`OI_SEAT_BIN`, else `seat` on PATH, else
/// `~/.local/bin/seat` — a Finder launch's PATH never holds it).
pub(crate) fn seat_executable() -> PathBuf {
    if let Some(bin) = std::env::var_os("OI_SEAT_BIN").filter(|bin| !bin.is_empty()) {
        return PathBuf::from(bin);
    }
    let runnable = |candidate: &std::path::Path| {
        use std::os::unix::fs::PermissionsExt;
        std::fs::metadata(candidate)
            .is_ok_and(|meta| meta.is_file() && meta.permissions().mode() & 0o111 != 0)
    };
    std::env::var_os("PATH")
        .iter()
        .flat_map(std::env::split_paths)
        .map(|dir| dir.join("seat"))
        .find(|candidate| candidate.is_absolute() && runnable(candidate))
        .or_else(|| {
            std::env::var_os("HOME")
                .map(|home| PathBuf::from(home).join(".local/bin/seat"))
                .filter(|managed| managed.is_absolute() && runnable(managed))
        })
        .unwrap_or_else(|| PathBuf::from("seat"))
}

/// The seat instrument's own reading, read only (`seat status --json`):
/// bounded, its refusal in its own words, another schema refused by name.
fn seat_status() -> Result<Value, crate::material::Error> {
    let source = "seat status";
    let data = crate::inhabitation::run_bounded(
        &seat_executable(),
        &["status".into(), "--json".into()],
        None,
        SEAT_STATUS_LIMIT,
        source,
    )?;
    schema_is(data, SEAT_STATUS_SCHEMA, source)
}

/// AIKit's declared gateway remotes (`aikit gateway remote list --json`,
/// AIKit's own route — `OI_AIKIT_BIN`, else the suite's `oi aikit`): the
/// envelope's reading and warnings, bounded like every inhabitation read.
fn gateway_remotes() -> Result<(Value, Vec<Value>), crate::material::Error> {
    let source = "aikit gateway remote list";
    let (executable, suite_route) = crate::inhabitation::aikit_executable();
    let mut args: Vec<std::ffi::OsString> = Vec::new();
    if suite_route {
        args.push("aikit".into());
    }
    args.extend([
        "gateway".into(),
        "remote".into(),
        "list".into(),
        "--json".into(),
    ]);
    let document = crate::inhabitation::run_bounded(
        &executable,
        &args,
        None,
        crate::factory::inhabitation_read_timeout(),
        source,
    )?;
    let (data, warnings) = crate::inhabitation::unwrap_envelope(document, source)?;
    Ok((schema_is(data, GATEWAY_REMOTES_SCHEMA, source)?, warnings))
}

/// An owner reading of the schema asked for, or the owner's other answer
/// named.
fn schema_is(data: Value, schema: &str, source: &str) -> Result<Value, crate::material::Error> {
    let answered = data
        .get("schema")
        .and_then(Value::as_str)
        .unwrap_or_default();
    if answered == schema {
        return Ok(data);
    }
    Err(crate::material::Error {
        kind: "incompatible".into(),
        message: format!(
            "{source} answered an unexpected reading ({answered}) where {schema} was asked for"
        ),
        operation_may_have_run: false,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn unheld(client: &CentralClient) -> PreparedWorld {
        PreparedWorld::held_only(client.clone(), None)
    }

    /// A Factory owner read — the telemetry follow, a status, a locate — is
    /// a prepared read (outside the kernel lock), and so is a SharedField
    /// read; a Factory write, a SharedField write and a credential change are
    /// not prepared reads (they are prepared writes, owner_write.rs, or free,
    /// dispatch.rs). The machine-level reads lane K left under the lock are
    /// prepared.
    #[test]
    fn owner_reads_are_prepared_and_owner_writes_are_not_reads() {
        use serde_json::json;
        let client = CentralClient::discover();
        let prepared = |value: &Value| {
            let op: KernelOp = serde_json::from_value(value.clone()).unwrap();
            PreparedRead::prepare(&client, unheld(&client), &op, None).is_some()
        };
        for read in [
            json!({"op": "factory_owner", "request": {"kind": "telemetry-watch", "state_path": "/s.json", "duration_secs": 1.0}}),
            json!({"op": "factory_owner", "request": {"kind": "telemetry-status", "state_path": "/s.json"}}),
            json!({"op": "factory_owner", "request": {"kind": "locate"}}),
            json!({"op": "factory_attempt_read", "state_path": "/s.json", "run_ref": "run:1"}),
            json!({"op": "shared_field", "request": {"kind": "snapshot"}}),
            json!({"op": "shared_field", "request": {"kind": "field-now", "field_ref": "field:1"}}),
            json!({"op": "credential_list"}),
            json!({"op": "profile_list"}),
            json!({"op": "config_receipts"}),
            json!({"op": "chat_default_read"}),
            json!({"op": "wiki_projection_sources"}),
        ] {
            assert!(prepared(&read), "{read} is prepared");
        }
        for write in [
            json!({"op": "factory_owner", "request": {"kind": "recognise", "state_path": "/s.json", "journey_ref": "j", "subject_ref": "s"}}),
            json!({"op": "shared_field", "request": {"kind": "contribute"}}),
            json!({"op": "shared_field", "request": {"kind": "enter"}}),
            json!({"op": "shared_field", "request": {"kind": "observe-stop", "observer_ref": "o"}}),
            json!({"op": "credential_revoke", "credential": "credential:x"}),
            json!({"op": "chat_default_discard"}),
        ] {
            assert!(!prepared(&write), "{write} is not a prepared read");
        }
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
        assert!(PreparedRead::prepare(&client, unheld(&client), &op, None).is_none());
        let inputs = TemporalReadInputs {
            receipts: Vec::new(),
            cwd: std::env::current_dir().unwrap_or_else(|_| std::path::PathBuf::from(".")),
            cache: Arc::new(Mutex::new(crate::read_cache::OwnerReadCache::default())),
        };
        assert!(PreparedRead::prepare(&client, unheld(&client), &op, Some(inputs)).is_some());
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
        let kept = std::fs::read_dir(&dir)
            .map(|entries| entries.flatten().count())
            .unwrap_or(0);
        assert_eq!(
            kept, 1,
            "the retained copy is written while the kernel lock is held elsewhere"
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

    /// A file's bytes (the material route's reading) are read outside the
    /// lock and the file registered only when the answer is finished under
    /// it — the same answer and registration as the ordered arm.
    #[cfg(unix)]
    #[test]
    fn a_prepared_bytes_read_runs_outside_the_lock_and_registers_the_file_when_finished() {
        let owner = crate::tests::FakeOwner::spawn_counter("prepared-file-bytes");
        let kernel = Arc::new(Mutex::new(owner.kernel()));
        let read = KernelOp::FileBytes {
            location: location("Work/proj/a.md"),
        };
        let prepared = kernel.lock().unwrap().prepare_files_read(&read).unwrap();
        let held = kernel.lock().unwrap();
        let (answer, answered) = std::sync::mpsc::channel();
        std::thread::spawn(move || answer.send(prepared.execute()).unwrap());
        let answered = answered
            .recv_timeout(std::time::Duration::from_secs(20))
            .expect("the owner answers while the kernel lock is held");
        assert!(!held.file_refs.contains_key("ref:Work/proj/a.md"));
        drop(held);
        let outcome = kernel.lock().unwrap().finish_files_read(answered).unwrap();
        assert!(kernel
            .lock()
            .unwrap()
            .file_refs
            .contains_key("ref:Work/proj/a.md"));
        assert!(matches!(
            &outcome.result,
            KernelOpResult::FileBytes { content_base64, .. } if content_base64 == "a2VwdA=="
        ));
        assert_eq!(owner.kernel().apply(read).unwrap().result, outcome.result);
    }

    /// The material route through the one dispatch: the asset is resolved
    /// through Central's own listing of its directory and its bytes read —
    /// the same target and reading as resolving and reading under the lock.
    #[cfg(unix)]
    #[test]
    fn the_material_route_resolves_and_reads_through_the_dispatch() {
        let owner = crate::tests::FakeOwner::spawn_counter("material-route");
        let kernel = Mutex::new(owner.kernel());
        let base = location("Work/proj/doc.md");
        let (target, bytes) = files::read_material(&kernel, &base, &["a.md".to_owned()])
            .unwrap_or_else(|_| {
                panic!("the listed asset resolves");
            });
        assert_eq!(target.path, "Work/proj/a.md");
        assert!(matches!(
            bytes.unwrap().result,
            KernelOpResult::FileBytes { ref content_base64, .. } if content_base64 == "a2VwdA=="
        ));
        assert!(matches!(
            files::read_material(&kernel, &base, &["absent.md".to_owned()]),
            Err(files::MaterialRouteError::NotFound(_))
        ));
        assert!(matches!(
            files::read_material(&kernel, &base, &["..".to_owned()]),
            Err(files::MaterialRouteError::Forbidden(_))
        ));
        let mut ordered = owner.kernel();
        assert_eq!(
            files::resolve_material(&mut ordered, &base, &["a.md".to_owned()])
                .ok()
                .map(|target| target.path),
            Some("Work/proj/a.md".to_owned())
        );
    }

    /// A last-reading recovery's owner work runs outside the lock and its
    /// answer is decided under it: the same recovery the ordered arm gives.
    #[cfg(unix)]
    #[test]
    fn a_prepared_last_reading_recovery_answers_as_the_ordered_arm() {
        let owner = crate::tests::FakeOwner::spawn_counter("prepared-last-reading");
        let dir = store("prepared-last-reading");
        let mut kernel = owner.kernel();
        kernel.retained_files = retained_files::Store::at(dir.clone());
        let op = KernelOp::FileLastReading {
            location: location("Work/proj/a.md"),
        };
        let answered = kernel.prepare_files_read(&op).unwrap().execute();
        let prepared = kernel.finish_files_read(answered).unwrap();
        let KernelOpResult::FileLastReading { recovery } = &prepared.result else {
            panic!("a recovery");
        };
        assert!(recovery.migration_allowed);
        assert_eq!(
            recovery
                .retained
                .as_ref()
                .map(|r| r.reading.content.as_str()),
            Some("kept")
        );
        let mut ordered = owner.kernel();
        ordered.retained_files = retained_files::Store::at(dir.clone());
        let KernelOpResult::FileLastReading { recovery: applied } =
            ordered.apply(op).unwrap().result
        else {
            panic!("a recovery");
        };
        // The same answer; only the retained copy's observation time moves.
        assert_eq!(applied.migration_allowed, recovery.migration_allowed);
        assert_eq!(applied.reason, recovery.reason);
        assert_eq!(
            applied.retained.map(|r| r.reading),
            recovery.retained.clone().map(|r| r.reading)
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
            assert!(PreparedRead::prepare(&client, unheld(&client), &op, None).is_some());
        }
    }
}
