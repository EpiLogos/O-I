//! Central navigation — `WorldRead`, `ProjectRead`, `WorldBrowse`,
//! `ProjectBrowse` — prepared under the kernel lock and run outside it
//! (dispatch.rs). Ported from the file listing (owner_read.rs
//! `PreparedListing`): preparation captures the retained owner readings the
//! navigation would serve (the World through its shared reading,
//! agent_prepared.rs `PreparedWorld`) and takes a ticket for each reading it
//! will ask the owner for, and one for the navigator itself; the owner reads
//! run without the lock; the finish, under it, moves the navigator and focus
//! exactly as the ordered navigation did and retains each fresh reading
//! whose ticket is still current. A navigation that a newer one superseded,
//! or that a ground change withdrew, is retired: it writes nothing and
//! answers the kernel's current snapshot. The ordered arms run these same
//! steps under the lock.
use crate::agent_prepared::PreparedWorld;
use crate::world::{self, SourceListing};
use crate::{
    focus, read_cache, refs, CentralClient, Kernel, KernelEvent, KernelOp, KernelOpOutcome,
    KernelOpResult, SemanticRef,
};
use serde_json::Value;

/// The navigator's own ticket key: the latest navigation prepared is the
/// one whose answer may move it.
const NAVIGATOR: &str = "navigator";

/// Each reading a navigation serves: the retained one (`Ok`), else the
/// ticket the owner's answer is retained under (`Err`).
type Held<T> = Result<T, u64>;

enum Target {
    Root(PreparedWorld),
    Project {
        query: String,
        held: Held<Value>,
        sources: Held<SourceListing>,
        inspect: Held<Value>,
    },
}

/// One navigation prepared under the kernel lock
/// (`Kernel::prepare_navigation`); `execute` runs its owner reads outside it
/// and records nothing.
pub struct PreparedNavigation {
    client: CentralClient,
    target: Target,
    browse_only: bool,
    ticket: u64,
}

enum Reading {
    Root {
        world: Value,
        /// Read for this navigation, not served from a retained reading.
        fresh: bool,
    },
    Project(Box<ProjectReading>),
}

/// A project navigation's owner readings, each with the ticket a fresh one
/// is retained under.
struct ProjectReading {
    query: String,
    mapping: Value,
    mapping_ticket: Option<u64>,
    sources: Option<(SourceListing, Option<u64>)>,
    inspection: Option<(Option<Value>, Option<u64>)>,
}

/// A navigation's owner answer awaiting its finish under the kernel lock.
pub struct NavigationAnswered {
    browse_only: bool,
    ticket: u64,
    reading: Result<Reading, String>,
}

impl PreparedNavigation {
    /// The owner reads, outside the kernel lock. Nothing is recorded here.
    pub fn execute(self) -> NavigationAnswered {
        let reading = match self.target {
            Target::Root(world) => {
                let fresh = !world.is_held();
                world.read().map(|world| Reading::Root { world, fresh })
            }
            Target::Project {
                query,
                held,
                sources,
                inspect,
            } => Self::project(&self.client, query, held, sources, inspect),
        };
        NavigationAnswered {
            browse_only: self.browse_only,
            ticket: self.ticket,
            reading,
        }
    }

    fn project(
        client: &CentralClient,
        query: String,
        held: Held<Value>,
        sources: Held<SourceListing>,
        inspect: Held<Value>,
    ) -> Result<Reading, String> {
        let (mapping, mapping_ticket) = match held {
            Ok(mapping) => (mapping, None),
            Err(ticket) => (world::read_project(client, &query)?, Some(ticket)),
        };
        let bound = mapping["project"]["projectcentral"]["state"] != "absent";
        let sources = bound.then(|| match sources {
            Ok(listing) => (listing, None),
            Err(ticket) => (
                world::participating_sources(client, Some(&query)),
                Some(ticket),
            ),
        });
        // An unreadable inspection is no project ref, never retained.
        let inspection = bound.then(|| match inspect {
            Ok(value) => (Some(value), None),
            Err(ticket) => (
                client
                    .run(
                        "projectcentral.inspect",
                        serde_json::json!({"project": query}),
                    )
                    .ok(),
                Some(ticket),
            ),
        });
        Ok(Reading::Project(Box::new(ProjectReading {
            query,
            mapping,
            mapping_ticket,
            sources,
            inspection,
        })))
    }
}

impl Kernel {
    /// The four navigation ops, prepared under the kernel lock; every other
    /// op is not a navigation. A project outside the World mapping the
    /// navigator holds is refused here, as the ordered arm refused it.
    pub fn prepare_navigation(
        &mut self,
        op: &KernelOp,
    ) -> Result<Option<PreparedNavigation>, String> {
        let (project, browse_only, fresh) = match op {
            KernelOp::WorldRead => (None, false, false),
            KernelOp::ProjectRead { project } => (Some(project.as_str()), false, false),
            KernelOp::WorldBrowse { fresh } => (None, true, fresh.unwrap_or(false)),
            KernelOp::ProjectBrowse { project, fresh } => {
                (Some(project.as_str()), true, fresh.unwrap_or(false))
            }
            _ => return Ok(None),
        };
        self.prepare_navigation_for(project, browse_only, fresh)
            .map(Some)
    }

    pub(crate) fn prepare_navigation_for(
        &mut self,
        project: Option<&str>,
        browse_only: bool,
        fresh: bool,
    ) -> Result<PreparedNavigation, String> {
        let target = match project {
            None => {
                if fresh {
                    self.reads.invalidate("world");
                }
                // The World is this op's answer, not only its scoping.
                read_cache::note_scopes(&[crate::watch::Scope::All], crate::watch::Clock::None);
                Target::Root(self.prepare_world_reading())
            }
            Some(query) => {
                // Resolve only a project the owner's current root map disclosed.
                let known = self
                    .navigator
                    .root
                    .as_ref()
                    .and_then(|r| r["work"]["projects"].as_array())
                    .is_some_and(|rows| rows.iter().any(|p| p["name"].as_str() == Some(query)));
                if !known {
                    return Err(
                        "Project is outside the disclosed World mapping; refresh World first"
                            .into(),
                    );
                }
                let mapping_key = format!("project:{query}");
                let inspect_key = format!("inspect:{query}");
                if fresh {
                    self.reads.invalidate(&mapping_key);
                    self.reads.invalidate(&inspect_key);
                }
                let sources_key = format!("horizon:{query}");
                let held = self.reads.get(&mapping_key, read_cache::PROJECT_TTL);
                let held = held.ok_or_else(|| self.reads.begin(mapping_key));
                let sources = self
                    .reads
                    .get(&sources_key, read_cache::HORIZON_TTL)
                    .and_then(|value| serde_json::from_value(value).ok());
                let sources = sources.ok_or_else(|| self.reads.begin(sources_key));
                let inspect = self.reads.get(&inspect_key, read_cache::HORIZON_TTL);
                let inspect = inspect.ok_or_else(|| self.reads.begin(inspect_key));
                Target::Project {
                    query: query.to_owned(),
                    held,
                    sources,
                    inspect,
                }
            }
        };
        Ok(PreparedNavigation {
            client: self.client.clone(),
            target,
            browse_only,
            ticket: self.reads.begin(NAVIGATOR.to_owned()),
        })
    }

    /// Move the navigator and focus by a navigation's answer, under the
    /// kernel lock — or retire it when a newer navigation or a ground change
    /// moved its basis: nothing is written and the current snapshot answers.
    pub fn finish_navigation(
        &mut self,
        answered: NavigationAnswered,
    ) -> Result<KernelOpOutcome, String> {
        if !self.reads.finish(NAVIGATOR, answered.ticket) {
            return Ok(KernelOpOutcome {
                read_scopes: None,
                receipts: Vec::new(),
                result: KernelOpResult::WorldRead {
                    snapshot: self.snapshot(),
                },
            });
        }
        let before = self.navigator.clone();
        let old_focus = self.focus.clone();
        let result = answered.reading.map(|reading| match reading {
            Reading::Root { world, fresh } => self.navigated_root(world, fresh),
            Reading::Project(reading) => self.navigated_project(*reading),
        });
        self.navigator.error = result.err();
        // Browsing changes the navigation reading, not the semantic subject
        // currently bound to open work. Explicit focus remains a separate act.
        if answered.browse_only {
            self.focus = old_focus.clone();
        }
        let mut receipts = Vec::new();
        if self.navigator != before {
            receipts.push(self.log.record(KernelEvent::WorldChanged {
                summary: "Central navigator reading changed".into(),
            }));
        }
        if self.focus != old_focus {
            receipts.push(self.log.record(KernelEvent::FocusChanged {
                focus: self.focus.clone(),
            }));
        }
        Ok(KernelOpOutcome {
            read_scopes: None,
            receipts,
            result: KernelOpResult::WorldRead {
                snapshot: self.snapshot(),
            },
        })
    }

    /// Keep a fresh owner reading under its ticket, as the ordered path's
    /// cache kept it — unless its key was withdrawn or re-read meanwhile.
    fn retain_navigated(&mut self, key: String, ticket: Option<u64>, value: Value) {
        if let Some(ticket) = ticket {
            if self.reads.finish(&key, ticket) {
                self.reads.put(key, value);
            }
        }
    }

    /// The root mapping arm — state moves exactly as before the cache existed.
    fn navigated_root(&mut self, world: Value, fresh: bool) {
        // A World read for this navigation is retained for every reader that
        // asks the cache; a retained one is never re-dated.
        if fresh {
            self.reads.put("world".into(), world.clone());
        }
        if self.navigator.project.is_some() {
            self.focus.project = None;
            self.focus.world = None;
            self.focus.clear_subject();
        }
        self.navigator.root = Some(world);
        self.navigator.project = None;
        self.navigator.sources = None;
        self.navigator.project_ref = None;
    }

    /// The project mapping arm.
    fn navigated_project(&mut self, reading: ProjectReading) {
        let ProjectReading {
            query,
            mapping,
            mapping_ticket,
            sources,
            inspection,
        } = reading;
        self.retain_navigated(format!("project:{query}"), mapping_ticket, mapping.clone());
        let sources = sources.map(|(listing, ticket)| {
            // A degraded reading is the error path, never retained.
            if matches!(listing.availability, world::ListingAvailability::Horizon) {
                if let Ok(value) = serde_json::to_value(&listing) {
                    self.retain_navigated(format!("horizon:{query}"), ticket, value);
                }
            }
            listing
        });
        let project_ref = inspection.and_then(|(value, ticket)| {
            let value = value?;
            self.retain_navigated(format!("inspect:{query}"), ticket, value.clone());
            value["manifest"]["project_id"]
                .as_str()
                .filter(|id| !id.trim().is_empty())
                .map(str::to_owned)
        });
        self.focus.project = None;
        self.focus.world = None;
        self.focus.clear_subject();
        let semantic = |id: String, kind: &str| SemanticRef {
            ref_id: id,
            kind: kind.into(),
            native_owner: "central".into(),
            provenance: refs::RefProvenance {
                source: "projectcentral.inspect".into(),
                revision: None,
            },
        };
        if let Some(id) = project_ref.as_ref() {
            let reference = semantic(id.clone(), "project");
            self.focus.bind_project(
                focus::ProjectRef::try_from(reference.clone()).expect("owner project ref"),
            );
            self.focus
                .focus_subject(reference)
                .expect("owner project ref");
        }
        if let Some(id) = sources
            .as_ref()
            .and_then(|s| s.world_ref.as_ref())
            .filter(|id| !id.trim().is_empty())
        {
            let mut reference = semantic(id.clone(), "world");
            reference.provenance.source = "projectcentral.change.horizon".into();
            self.focus
                .bind_world(focus::WorldRef::try_from(reference).expect("owner world ref"));
        }
        self.navigator.project = Some(mapping);
        self.navigator.sources = sources;
        self.navigator.project_ref = project_ref;
    }
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;

    /// A navigation answers from its owner read outside the lock and moves
    /// the navigator only on finish; one a newer navigation superseded, or
    /// a ground change withdrew, is retired — it writes nothing and answers
    /// the current snapshot.
    #[test]
    fn a_superseded_navigation_is_retired_and_the_latest_moves_the_navigator() {
        let owner = crate::tests::FakeOwner::spawn_counter("navigation");
        let mut kernel = owner.kernel();
        let older = kernel
            .prepare_navigation(&KernelOp::WorldRead)
            .unwrap()
            .unwrap()
            .execute();
        let newer = kernel
            .prepare_navigation(&KernelOp::WorldBrowse { fresh: Some(true) })
            .unwrap()
            .unwrap()
            .execute();
        assert!(
            kernel.navigator.root.is_none(),
            "nothing moves before a finish"
        );
        let events = kernel.event_log().since(0).len();
        let retired = kernel.finish_navigation(older).unwrap();
        assert!(retired.receipts.is_empty());
        assert!(kernel.navigator.root.is_none());
        assert_eq!(kernel.event_log().since(0).len(), events);
        let moved = kernel.finish_navigation(newer).unwrap();
        assert_eq!(moved.receipts.len(), 1, "WorldChanged, recorded once");
        assert_eq!(kernel.navigator.root.as_ref().unwrap()["root"], "/tmp");
        // The fresh World is retained: the ordered read serves it.
        let spawns = owner.spawns("central.world");
        kernel.apply(KernelOp::WorldRead).unwrap();
        assert_eq!(owner.spawns("central.world"), spawns);
        // A ground change while a navigation is read retires it.
        kernel.reads.invalidate("world");
        let pending = kernel
            .prepare_navigation(&KernelOp::WorldRead)
            .unwrap()
            .unwrap()
            .execute();
        kernel.ground_changed();
        let before = kernel.navigator.clone();
        assert!(kernel
            .finish_navigation(pending)
            .unwrap()
            .receipts
            .is_empty());
        assert_eq!(kernel.navigator, before);
        // A project outside the held World mapping is refused at preparation.
        assert!(kernel
            .prepare_navigation(&KernelOp::ProjectRead {
                project: "Elsewhere".into()
            })
            .is_err());
    }
}
