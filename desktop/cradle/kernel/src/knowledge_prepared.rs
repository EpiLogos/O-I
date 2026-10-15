//! Knowledge reads perform owner I/O outside the ordered kernel mutation lock.
//! Only validated native readings are admitted back into the semantic ref set.
use crate::{
    knowledge, read_cache, CentralClient, Kernel, KernelOp, KernelOpOutcome, KernelOpResult,
    SemanticRef,
};
use serde_json::Value;
use std::path::PathBuf;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Condvar, Mutex};

/// AIKit knowledge reads in flight at once, process-wide; each is its own
/// owner process (ported: graph.rs / expression_home.rs `READERS`). A burst
/// of registers (Technē's seventeen) queues its AIKit calls instead of
/// sharing AIKit's 20 s limit seventeen ways.
const READERS: usize = 5;
static AIKIT_READERS: Readers = Readers::new(READERS);

/// A bound on owner calls in flight. A prepared knowledge read takes a slot
/// for its AIKit call only: after preparation released the kernel lock, and
/// gives it back before its finish takes the lock again — a slot is never
/// held while the kernel lock is taken.
pub(crate) struct Readers {
    limit: AtomicUsize,
    busy: Mutex<usize>,
    freed: Condvar,
}
impl Readers {
    pub(crate) const fn new(limit: usize) -> Self {
        Self {
            limit: AtomicUsize::new(limit),
            busy: Mutex::new(0),
            freed: Condvar::new(),
        }
    }
    /// Run one owner call in a slot, waiting while the limit is in flight.
    pub(crate) fn run<T>(&self, call: impl FnOnce() -> T) -> T {
        struct Slot<'a>(&'a Readers);
        impl Drop for Slot<'_> {
            fn drop(&mut self) {
                *self.0.busy.lock().unwrap_or_else(|e| e.into_inner()) -= 1;
                self.0.freed.notify_one();
            }
        }
        let mut busy = self.busy.lock().unwrap_or_else(|e| e.into_inner());
        while *busy >= self.limit.load(Ordering::SeqCst) {
            busy = self.freed.wait(busy).unwrap_or_else(|e| e.into_inner());
        }
        *busy += 1;
        drop(busy);
        let _slot = Slot(self);
        call()
    }
}
/// Set the process-wide bound (the real-ground sweep; `usize::MAX` is
/// unbounded).
#[cfg(test)]
pub(crate) fn set_aikit_readers(limit: usize) {
    AIKIT_READERS.limit.store(limit, Ordering::SeqCst);
    AIKIT_READERS.freed.notify_all();
}
pub struct Prepared {
    client: CentralClient,
    world: Option<Value>,
    /// The World reading this read shares with every other prepared read of
    /// its burst, when the kernel held none at preparation.
    world_flight: Option<Arc<read_cache::Flight>>,
    project: Option<String>,
    request: knowledge::Request,
    held: Option<Value>,
    ticket_key: String,
    ticket: u64,
}
pub struct Completed {
    key: String,
    cacheable: bool,
    request: knowledge::Request,
    data: Value,
    project_ref: Option<crate::focus::ProjectRef>,
    ticket_key: String,
    ticket: u64,
    retained: bool,
}
fn scope(
    world: &Value,
    project: Option<String>,
    request: &knowledge::Request,
) -> Result<(PathBuf, Option<String>), String> {
    let project = if let knowledge::Request::Read { address } = request {
        world["work"]["projects"]
            .as_array()
            .and_then(|rows| {
                rows.iter().find(|r| {
                    r["projectcentral"]["agent_wiki"]["wiki"]["space_ref"].as_str()
                        == Some(address.reference())
                })
            })
            .and_then(|r| r["name"].as_str())
            .map(str::to_owned)
            .or(project)
    } else {
        project
    };
    let root = PathBuf::from(
        world["root"]
            .as_str()
            .ok_or("Central root location unavailable")?,
    );
    let cwd = if let Some(name) = &project {
        let row = world["work"]["projects"]
            .as_array()
            .and_then(|r| r.iter().find(|r| r["name"].as_str() == Some(name)))
            .ok_or("Project is outside Central's disclosed ground")?;
        root.join(row["path"].as_str().ok_or("Project location unavailable")?)
    } else {
        root
    };
    Ok((cwd, project))
}
fn key(cwd: &std::path::Path, request: &knowledge::Request) -> Result<String, String> {
    Ok(format!(
        "knowledge:{}:{}",
        cwd.display(),
        serde_json::to_string(request).map_err(|e| e.to_string())?
    ))
}
impl Kernel {
    pub fn prepare_knowledge(&mut self, op: &KernelOp) -> Result<Option<Prepared>, String> {
        let KernelOp::Knowledge {
            project,
            request,
            fresh,
        } = op
        else {
            return Ok(None);
        };
        // Recording use mutates owner learning and keeps the existing admitted-ref gate.
        if matches!(request, knowledge::Request::Use { .. }) {
            return Ok(None);
        }
        // One World reading serves every register a burst prepares: the
        // retained one, else the one in flight or just read (read_cache
        // `flight`) — never one World read per register.
        let mut world = self.reads.get("world", read_cache::WORLD_TTL);
        let world_flight = if world.is_none() {
            let flight = self.reads.flight("world", read_cache::WORLD_TTL);
            world = flight.held(read_cache::WORLD_TTL);
            world.is_none().then_some(flight)
        } else {
            None
        };
        let held = if let Some(world) = &world {
            let (cwd, _) = scope(world, project.clone(), request)?;
            let key = key(&cwd, request)?;
            if *fresh {
                self.reads.invalidate(&key);
                None
            } else {
                self.reads.get(&key, read_cache::KNOWLEDGE_TTL)
            }
        } else {
            None
        };
        // Available before owner I/O even when the world cache is cold.
        let ticket_key = format!(
            "knowledge:pending:{}:{}",
            serde_json::to_string(project).map_err(|e| e.to_string())?,
            serde_json::to_string(request).map_err(|e| e.to_string())?
        );
        let ticket = self.reads.begin(ticket_key.clone());
        Ok(Some(Prepared {
            client: self.client.clone(),
            world,
            world_flight,
            project: project.clone(),
            request: request.clone(),
            held,
            ticket_key,
            ticket,
        }))
    }
    pub fn finish_knowledge(&mut self, done: Completed) -> Result<KernelOpOutcome, String> {
        if !self.reads.finish(&done.ticket_key, done.ticket) {
            return Err(
                "Knowledge read was superseded or its source scope was invalidated; read again"
                    .into(),
            );
        }
        if let knowledge::Request::Read { address } = &done.request {
            // execute checked exact owner identity before producing this completion.
            self.knowledge_projects
                .insert(address.reference().into(), done.project_ref);
            self.knowledge_refs.insert(
                address.reference().into(),
                SemanticRef {
                    ref_id: address.reference().into(),
                    kind: "knowledge".into(),
                    native_owner: "ai-kit".into(),
                    provenance: crate::refs::RefProvenance {
                        source: "aikit.knowledge.read".into(),
                        revision: done.data["revision"].as_str().map(str::to_owned),
                    },
                },
            );
        }
        if done.cacheable && !done.retained {
            self.reads.put(done.key, done.data.clone());
        }
        Ok(KernelOpOutcome {
            receipts: vec![],
            result: KernelOpResult::Knowledge { data: done.data },
        })
    }
}
impl Prepared {
    /// The World this read is scoped by: the reading held at preparation,
    /// else its burst's shared reading — read through the owner once, by
    /// whichever read of the burst gets there first.
    fn world(&self) -> Result<Value, String> {
        match (&self.world, &self.world_flight) {
            (Some(world), _) => Ok(world.clone()),
            (None, Some(flight)) => flight.read(read_cache::WORLD_TTL, || {
                crate::world::read_world(&self.client)
            }),
            (None, None) => crate::world::read_world(&self.client),
        }
    }
    pub fn execute(self) -> Result<Completed, String> {
        let world = self.world()?;
        let (cwd, project) = scope(&world, self.project, &self.request)?;
        let key = key(&cwd, &self.request)?;
        let cacheable = matches!(
            &self.request,
            knowledge::Request::Read { .. } | knowledge::Request::Relations { .. }
        );
        let retained = self.held.is_some() && cacheable;
        let data = match self.held {
            Some(data) if cacheable => data,
            _ => AIKIT_READERS.run(|| knowledge::call(&cwd, &self.request))?,
        };
        if let knowledge::Request::Relations { address } = &self.request {
            if data["query"]["focus"].as_str() != Some(address.reference()) {
                return Err("AIKit relation identity does not match the requested subject".into());
            }
        }
        let mut project_ref = None;
        if let knowledge::Request::Read { address } = &self.request {
            if data["resource"].as_str() != Some(address.reference()) {
                return Err("AIKit reading identity does not match the requested subject".into());
            }
            if let Some(project) = project {
                let reading = self
                    .client
                    .run(
                        "projectcentral.inspect",
                        serde_json::json!({"project":project}),
                    )
                    .map_err(|e| e.to_string())?;
                let reference = reading["manifest"]["project_id"]
                    .as_str()
                    .ok_or("Central project reading did not disclose its project identity")?;
                project_ref = Some(
                    crate::focus::ProjectRef::try_from(crate::owner_relation(
                        reference,
                        "project",
                        "projectcentral.inspect",
                    ))
                    .map_err(|e| e.to_string())?,
                );
            }
        }
        Ok(Completed {
            key,
            cacheable,
            request: self.request,
            data,
            project_ref,
            ticket_key: self.ticket_key,
            ticket: self.ticket,
            retained,
        })
    }
}

#[cfg(test)]
#[path = "knowledge_prepared_tests.rs"]
mod tests;
