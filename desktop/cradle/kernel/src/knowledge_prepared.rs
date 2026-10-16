//! Knowledge reads perform owner I/O outside the ordered kernel mutation lock.
//! Only validated native readings are admitted back into the semantic ref set.
//!
//! A burst's relations reads of wiki addresses under one Central root ride
//! one AIKit `relations-batch` process (`Relations`, gathered for
//! `GATHER_WINDOW`); each is answered with its single read's envelope the
//! moment AIKit streams that item, never held for a slower one. An AIKit
//! whose batch answers only the whole document answers them all at once; an
//! AIKit without the verb reads them one by one, as before.
use crate::{
    knowledge, read_cache, CentralClient, Kernel, KernelOp, KernelOpOutcome, KernelOpResult,
    SemanticRef,
};
use serde_json::Value;
use std::collections::{HashMap, HashSet};
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

/// How long the first relations read of a burst waits for the burst's other
/// reads to join it before AIKit is asked once for all of them. Measured on
/// the door (scratchpad inv-speed/door1.tsv, 15 Oct): a Technē door's
/// seventeen registers asked for relations sixteen within 150 ms of the
/// first and the seventeenth 1.2 s later, after its 1.6 s wiki file read;
/// lane K2's own door, 190 ms and 0.4 s. 250 ms gathers the burst with room
/// for a loaded machine; a lone read pays it once, beside AIKit's own time.
pub(crate) const GATHER_WINDOW: std::time::Duration = std::time::Duration::from_millis(250);

static RELATIONS: std::sync::OnceLock<Relations> = std::sync::OnceLock::new();

/// Concurrent relations reads of wiki addresses under one Central root,
/// gathered into one AIKit `relations-batch` process (ported from the
/// World flight, read_cache `Flight`: the first read of a gathering asks
/// the owner, the others wait for that answer and take their own part of
/// it). Each read is answered with exactly its single read's envelope,
/// through the same decode, its own refusal included — as soon as AIKit
/// streams its item. An AIKit that refuses the verb is remembered by its
/// identity, and its reads are single reads, as before batching; one that
/// refuses the streamed form is remembered too, and asked for the whole
/// document.
pub(crate) struct Relations {
    window: std::time::Duration,
    open: Mutex<HashMap<(PathBuf, knowledge::AikitIdentity), Arc<Gathering>>>,
    absent: Mutex<HashSet<knowledge::AikitIdentity>>,
    unstreamed: Mutex<HashSet<knowledge::AikitIdentity>>,
}

/// One gathering: its items, frozen when it leaves `Relations::open`, and
/// what AIKit has answered of them.
struct Gathering {
    items: Mutex<Vec<knowledge::RelationsItem>>,
    answer: Mutex<Answer>,
    answered: Condvar,
}

/// A gathering's answers so far: each item AIKit streamed, and the batch's
/// whole answer once its process ended.
#[derive(Default)]
struct Answer {
    items: HashMap<usize, Result<Value, knowledge::CallError>>,
    batch: Option<Arc<knowledge::RelationsBatch>>,
}

/// A gathered read's outcome.
pub(crate) enum Gathered {
    /// Its own answer from the batch: its reading or its refusal.
    Answer(Result<Value, knowledge::CallError>),
    /// Not batchable here (an AIKit without the batch, or a working
    /// directory a batch cannot name): read it alone.
    Single,
}

fn held<T>(mutex: &Mutex<T>) -> std::sync::MutexGuard<'_, T> {
    mutex.lock().unwrap_or_else(|e| e.into_inner())
}

impl Gathering {
    /// Join with `item`: its index (an identical item already gathered is
    /// shared), or none when the gathering is full.
    fn join(&self, item: &knowledge::RelationsItem) -> Option<usize> {
        let mut items = held(&self.items);
        if let Some(index) = items.iter().position(|held| held == item) {
            return Some(index);
        }
        (items.len() < knowledge::RELATIONS_BATCH_MAX_ITEMS).then(|| {
            items.push(item.clone());
            items.len() - 1
        })
    }
    /// One item, the moment AIKit streamed it: its waiting reads go.
    fn publish_item(&self, index: usize, item: Result<Value, knowledge::CallError>) {
        held(&self.answer).items.entry(index).or_insert(item);
        self.answered.notify_all();
    }
    /// The batch's whole answer: every read still waiting goes.
    fn publish(&self, batch: knowledge::RelationsBatch) {
        let mut answer = held(&self.answer);
        if answer.batch.is_none() {
            answer.batch = Some(Arc::new(batch));
        }
        self.answered.notify_all();
    }
    /// The read of item `index`: its streamed answer, else its part of the
    /// batch's whole answer, whichever comes first.
    fn wait(&self, index: usize) -> Gathered {
        let mut answer = held(&self.answer);
        loop {
            if let Some(item) = answer.items.get(&index) {
                return Gathered::Answer(item.clone());
            }
            if let Some(batch) = answer.batch.as_ref() {
                return match &**batch {
                    knowledge::RelationsBatch::Answered(answers) => {
                        Gathered::Answer(answers.get(index).cloned().unwrap_or_else(|| {
                            Err(knowledge::CallError::Malformed {
                                detail:
                                    "AIKit's relations batch did not answer each item it was asked"
                                        .into(),
                            })
                        }))
                    }
                    knowledge::RelationsBatch::Absent | knowledge::RelationsBatch::Unstreamed => {
                        Gathered::Single
                    }
                    knowledge::RelationsBatch::Failed(error) => {
                        Gathered::Answer(Err(error.clone()))
                    }
                };
            }
            answer = self
                .answered
                .wait(answer)
                .unwrap_or_else(|e| e.into_inner());
        }
    }
}

/// A gathering's leader answers its gathering however it leaves — a leader
/// that unwinds still releases the reads waiting on it.
struct Publish<'a>(&'a Gathering);
impl Drop for Publish<'_> {
    fn drop(&mut self) {
        self.0.publish(knowledge::RelationsBatch::Failed(
            knowledge::CallError::Malformed {
                detail: "The relations batch ended without an answer".into(),
            },
        ));
    }
}

impl Relations {
    pub(crate) fn new(window: std::time::Duration) -> Self {
        Self {
            window,
            open: Mutex::new(HashMap::new()),
            absent: Mutex::new(HashSet::new()),
            unstreamed: Mutex::new(HashSet::new()),
        }
    }

    /// One relations read (`item`: its address and working directory) under
    /// the Central root `root`, through the suite `executable` reaching the
    /// AIKit `identity`: joined to the open gathering of that root and
    /// AIKit, else leading a new one. The batch's owner call takes one
    /// `readers` slot for the whole gathering and runs on its own thread, so
    /// the read that led the gathering is answered the moment its own item
    /// streams, like every read that joined it — never held for the batch's
    /// slowest item.
    pub(crate) fn read(
        &'static self,
        readers: &'static Readers,
        executable: &std::ffi::OsStr,
        identity: knowledge::AikitIdentity,
        root: &std::path::Path,
        item: knowledge::RelationsItem,
    ) -> Gathered {
        if item.cwd.to_str().is_none() || held(&self.absent).contains(&identity) {
            return Gathered::Single;
        }
        let key = (root.to_path_buf(), identity);
        let (gathering, index, leads) = {
            let mut open = held(&self.open);
            let joined = open
                .get(&key)
                .and_then(|gathering| Some((Arc::clone(gathering), gathering.join(&item)?)));
            match joined {
                Some((gathering, index)) => (gathering, index, false),
                None => {
                    let gathering = Arc::new(Gathering {
                        items: Mutex::new(vec![item]),
                        answer: Mutex::new(Answer::default()),
                        answered: Condvar::new(),
                    });
                    open.insert(key.clone(), Arc::clone(&gathering));
                    (gathering, 0, true)
                }
            }
        };
        if leads {
            let batch = Arc::clone(&gathering);
            let (executable, root) = (executable.to_owned(), root.to_path_buf());
            let lead = Arc::new(Mutex::new(Some(move || {
                self.answer_gathering(readers, &executable, &root, key, &batch)
            })));
            let spawned = {
                let lead = Arc::clone(&lead);
                std::thread::Builder::new()
                    .name("oi-relations-batch".into())
                    .spawn(move || held(&lead).take().map(|run| run()))
            };
            // A thread the machine refuses leaves the leader to run the batch
            // itself, as before: its own read then waits for the whole batch.
            if spawned.is_err() {
                if let Some(run) = held(&lead).take() {
                    run()
                }
            }
        }
        gathering.wait(index)
    }

    /// Lead one gathering to its answer: hold the window open, freeze the
    /// items, run AIKit's batch in a `readers` slot (streamed, else the whole
    /// document, else remembered absent) and publish what it said. Whatever
    /// happens, every read waiting on the gathering is released (`Publish`).
    fn answer_gathering(
        &self,
        readers: &Readers,
        executable: &std::ffi::OsStr,
        root: &std::path::Path,
        key: (PathBuf, knowledge::AikitIdentity),
        gathering: &Arc<Gathering>,
    ) {
        let _answers = Publish(gathering);
        std::thread::sleep(self.window);
        // Leaving `open` freezes the items: a read joins only while its
        // gathering is there, under the same lock.
        {
            let mut open = held(&self.open);
            if open
                .get(&key)
                .is_some_and(|current| Arc::ptr_eq(current, gathering))
            {
                open.remove(&key);
            }
        }
        let items = held(&gathering.items).clone();
        let batch = readers.run(|| {
            if !held(&self.unstreamed).contains(&key.1) {
                let heard = Arc::clone(gathering);
                let batch = knowledge::relations_batch(
                    executable,
                    root,
                    &items,
                    Some(Box::new(move |index, item| heard.publish_item(index, item))),
                );
                if !matches!(batch, knowledge::RelationsBatch::Unstreamed) {
                    return batch;
                }
                held(&self.unstreamed).insert(key.1.clone());
            }
            knowledge::relations_batch(executable, root, &items, None)
        });
        if matches!(batch, knowledge::RelationsBatch::Absent) {
            held(&self.absent).insert(key.1.clone());
        }
        gathering.publish(batch);
    }
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
            _ => match &self.request {
                // A wiki's relations ride its burst's one relations batch.
                knowledge::Request::Relations {
                    address: address @ knowledge::Address::Wiki(_),
                } => {
                    knowledge::admissible(&self.request)?;
                    let root = PathBuf::from(
                        world["root"]
                            .as_str()
                            .ok_or("Central root location unavailable")?,
                    );
                    let item = knowledge::RelationsItem {
                        cwd: cwd.clone(),
                        address: address.clone(),
                    };
                    let executable = knowledge::executable();
                    let identity = knowledge::AikitIdentity::of(&executable);
                    match RELATIONS
                        .get_or_init(|| Relations::new(GATHER_WINDOW))
                        .read(&AIKIT_READERS, &executable, identity, &root, item)
                    {
                        Gathered::Answer(answer) => answer.map_err(knowledge::describe)?,
                        Gathered::Single => {
                            AIKIT_READERS.run(|| knowledge::call(&cwd, &self.request))?
                        }
                    }
                }
                _ => AIKIT_READERS.run(|| knowledge::call(&cwd, &self.request))?,
            },
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
