//! AgentWorldParticipation — O:I's composed reading of one Agent in one World,
//! and the human Agent card derived from it.
//!
//! Contract: `EpiLogos/ai-kit` docs/PRAXIS-ARCHITECTURE.md §6 (participation
//! and citizenship) and §7 (two cards, one Agent). O:I composes; the owners
//! hold state. Nothing here writes a store, mints an identity or keeps a
//! second copy of a profile: every field is read from the owner's native
//! command at call time and keeps the native refs it came from.
//!
//! ```text
//! Central    agent-profile.roster / agent-profile.read / central.position.list / central.world.here
//! AIKit      aikit --json praxis disclose --profile-json <file>   (aikit.agent-praxis-disclosure/v1)
//! Actuation  actuation occupancy list --json                      (tenure, presence, workcell_ref)
//! Factory    factory development custody list --position <P> --json   (cwd = the Project's tree)
//! Workcell   material presence from tenure.workcell_ref
//! ```
//!
//! A facet whose owner could not be read is `unavailable` with the failing
//! command, never guessed. Citizenship is a vector of eleven dimensions; no
//! scalar is computed, and card prose never feeds a dimension.

use serde_json::{json, Map, Value};
use std::collections::BTreeSet;
use std::path::{Path, PathBuf};

pub const PARTICIPATION_SCHEMA: &str = "oi.agent-world-participation/v1";
pub const HUMAN_CARD_SCHEMA: &str = "oi.human-agent-card/v1";
pub const PRAXIS_DISCLOSURE_SCHEMA: &str = "aikit.agent-praxis-disclosure/v1";

/// The owners O:I composes this reading from.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Product {
    Central,
    AiKit,
    Actuation,
    Factory,
    Workcell,
}

impl Product {
    /// The catalogue namespace the product resolves under (`oi <namespace>`).
    pub fn namespace(self) -> &'static str {
        match self {
            Product::Central => "central",
            Product::AiKit => "aikit",
            Product::Actuation => "actuation",
            Product::Factory => "factory",
            Product::Workcell => "workcell",
        }
    }
    /// The installed executable name used when naming a failing command.
    pub fn executable(self) -> &'static str {
        match self {
            Product::Central => "ctrl",
            Product::AiKit => "aikit",
            Product::Actuation => "actuation",
            Product::Factory => "factory",
            Product::Workcell => "workcell",
        }
    }
}

/// Why an owner could not be read.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct RunFailure {
    /// The exact command line that failed, as a person would type it.
    pub command: String,
    /// `not-installed | unsupported | refused | invalid-output`
    pub kind: &'static str,
    pub detail: String,
}

/// The injectable product runner. The shipped implementation resolves each
/// product's executable through O:I's product command catalogue (explicit
/// override → active suite receipt → registered composition → PATH); tests
/// supply canned native output.
pub trait ProductRunner {
    fn run(
        &self,
        product: Product,
        args: &[String],
        cwd: Option<&Path>,
    ) -> Result<Value, RunFailure>;
}

pub fn command_line(product: Product, args: &[String]) -> String {
    let mut line = product.executable().to_owned();
    for arg in args {
        line.push(' ');
        if arg.contains(char::is_whitespace) || arg.contains('{') {
            line.push('\'');
            line.push_str(arg);
            line.push('\'');
        } else {
            line.push_str(arg);
        }
    }
    line
}

/// A refusal in the three-part form (fact, consequence, action).
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Refusal {
    pub code: &'static str,
    pub fact: String,
    pub consequence: String,
    pub action: String,
}

impl Refusal {
    pub fn to_json(&self) -> Value {
        json!({"ok": false, "error": {"code": self.code, "fact": self.fact,
            "consequence": self.consequence, "action": self.action}})
    }
    pub fn message(&self) -> String {
        format!("{} — {} Next: {}", self.fact, self.consequence, self.action)
    }
}

pub struct ParticipationRequest<'a> {
    pub agent_ref: &'a str,
    pub world_ref: Option<&'a str>,
    /// Where the praxis profile input is written for `aikit praxis disclose`.
    pub scratch_dir: &'a Path,
}

/// One owner read, retained as evidence whether it answered or not.
struct Facet {
    owner: &'static str,
    command: String,
    state: &'static str,
    reason: Option<String>,
}

struct Reader<'r> {
    runner: &'r dyn ProductRunner,
    facets: Vec<Facet>,
}

impl<'r> Reader<'r> {
    fn read(
        &mut self,
        product: Product,
        args: Vec<String>,
        cwd: Option<&Path>,
    ) -> Result<Value, RunFailure> {
        let command = command_line(product, &args);
        match self.runner.run(product, &args, cwd) {
            Ok(value) => {
                self.facets.push(Facet {
                    owner: product.namespace(),
                    command,
                    state: "present",
                    reason: None,
                });
                Ok(value)
            }
            Err(failure) => {
                self.facets.push(Facet {
                    owner: product.namespace(),
                    command: failure.command.clone(),
                    state: "unavailable",
                    reason: Some(format!("{}: {}", failure.kind, failure.detail)),
                });
                Err(failure)
            }
        }
    }

    /// Central Actions answer `{ok, status, action, data}`; unwrap `data`.
    fn central(&mut self, action: &str, input: Value) -> Result<Value, RunFailure> {
        let args = vec![
            "--json".to_owned(),
            "action".to_owned(),
            "run".to_owned(),
            action.to_owned(),
            input.to_string(),
        ];
        let command = command_line(Product::Central, &args);
        let envelope = self.read(Product::Central, args, None)?;
        if envelope.get("ok").and_then(Value::as_bool) == Some(false) {
            let detail = envelope["error"]["message"]
                .as_str()
                .or_else(|| envelope["error"]["code"].as_str())
                .unwrap_or("Central refused the action")
                .to_owned();
            if let Some(last) = self.facets.last_mut() {
                last.state = "unavailable";
                last.reason = Some(format!("refused: {detail}"));
            }
            return Err(RunFailure {
                command,
                kind: "refused",
                detail,
            });
        }
        Ok(envelope.get("data").cloned().unwrap_or(envelope))
    }
}

fn strings(value: &Value) -> Vec<String> {
    value
        .as_array()
        .map(|items| {
            items
                .iter()
                .filter_map(Value::as_str)
                .map(str::to_owned)
                .collect()
        })
        .unwrap_or_default()
}

fn text(value: &Value) -> Option<String> {
    value
        .as_str()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_owned)
}

/// `project:<Name>` → `Some("Name")`; `control:root` → `None`.
fn project_of(world_ref: &str) -> Option<&str> {
    world_ref.strip_prefix("project:")
}

fn dimension(state: &str, basis: Vec<String>, reading: impl Into<String>) -> Value {
    json!({"state": state, "basis": basis, "reading": reading.into()})
}

fn unavailable(failure: &RunFailure, what: &str) -> Value {
    json!({"state": "unavailable", "basis": [], "command": failure.command,
        "reading": format!("{what} could not be read: `{}` ({}: {}).", failure.command, failure.kind, failure.detail)})
}

pub const CITIZENSHIP_DIMENSIONS: [&str; 11] = [
    "residence",
    "role",
    "repertoire",
    "reach",
    "authority",
    "relation",
    "contribution",
    "reciprocity",
    "reliability",
    "recognition",
    "continuity",
];

/// Locate the Agent's Central roster entry: the personal register first,
/// then the selected World's Project register.
fn find_profile(
    reader: &mut Reader<'_>,
    agent_ref: &str,
    world_ref: Option<&str>,
) -> Result<(Value, &'static str, Option<String>), Refusal> {
    let mut scopes: Vec<(Value, &'static str, Option<String>)> =
        vec![(json!({"scope": "root"}), "root", None)];
    if let Some(project) = world_ref.and_then(project_of) {
        scopes.push((
            json!({"scope": "project", "project": project}),
            "project",
            Some(project.to_owned()),
        ));
    }
    let mut failures = Vec::new();
    for (input, scope, project) in scopes {
        match reader.central("agent-profile.roster", input) {
            Ok(roster) => {
                if let Some(entry) = roster["profiles"].as_array().and_then(|rows| {
                    rows.iter()
                        .find(|row| row["profile"]["agent_ref"].as_str() == Some(agent_ref))
                }) {
                    return Ok((entry.clone(), scope, project));
                }
            }
            Err(failure) => failures.push(failure),
        }
    }
    if let Some(failure) = failures.first() {
        return Err(Refusal {
            code: "participation.central_unavailable",
            fact: format!("Central's Agent roster could not be read: `{}` ({}).", failure.command, failure.detail),
            consequence: "No participation reading was composed; Central holds the Agent's identity and O:I will not guess it.".into(),
            action: "run `ctrl --json action run agent-profile.roster '{\"scope\":\"root\"}'` and repair Central first".into(),
        });
    }
    Err(Refusal {
        code: "participation.agent_not_found",
        fact: format!("No Central AgentProfile names agent_ref `{agent_ref}` in the personal register{}.",
            world_ref.and_then(project_of).map(|p| format!(" or the {p} Project register")).unwrap_or_default()),
        consequence: "No participation reading was composed; an Agent without a Central profile has no identity for O:I to compose.".into(),
        action: "list the roster with `ctrl --json action run agent-profile.roster '{\"scope\":\"root\"}'` and pass an agent_ref it names".into(),
    })
}

/// Compose `oi.agent-world-participation/v1`.
pub fn compose_participation(
    runner: &dyn ProductRunner,
    request: &ParticipationRequest<'_>,
) -> Result<Value, Refusal> {
    let mut reader = Reader {
        runner,
        facets: Vec::new(),
    };
    let agent_ref = request.agent_ref;
    let (entry, register, register_project) =
        find_profile(&mut reader, agent_ref, request.world_ref)?;
    let roster_profile = entry["profile"].clone();
    let profile_ref = text(&roster_profile["ref"]).unwrap_or_default();

    // The exact profile as agent-profile.read returns it is AIKit's input.
    let mut read_input = json!({"scope": register, "profile_ref": profile_ref});
    if let Some(project) = &register_project {
        read_input["project"] = json!(project);
    }
    let read = reader
        .central("agent-profile.read", read_input)
        .unwrap_or_else(|_| json!({"profile": roster_profile.clone()}));
    let profile = if read["profile"].is_object() {
        read["profile"].clone()
    } else {
        roster_profile.clone()
    };
    let profile_revision = text(&profile["revision"]).unwrap_or_default();
    let home_world = text(&profile["world_ref"]).unwrap_or_else(|| "control:root".into());
    let ratified = strings(&profile["ratified_world_refs"]);
    let world_ref = request
        .world_ref
        .map(str::to_owned)
        .unwrap_or_else(|| home_world.clone());
    let world_project = project_of(&world_ref).map(str::to_owned);

    // ---- Central: Positions of this World that name the Agent -------------
    let position_input = match &world_project {
        Some(project) => json!({"project": project}),
        None => json!({}),
    };
    let positions_read = reader.central("central.position.list", position_input);
    let world_positions: Vec<Value> = match &positions_read {
        Ok(listing) => listing["positions"]
            .as_array()
            .into_iter()
            .flatten()
            .chain(listing["inherited"].as_array().into_iter().flatten())
            .cloned()
            .collect(),
        Err(_) => Vec::new(),
    };
    let names_agent = |position: &Value| {
        let record = &position["record"];
        strings(&record["eligible_agent_refs"])
            .iter()
            .any(|a| a == agent_ref)
            || (!profile_ref.is_empty() && record["profile_ref"].as_str() == Some(&profile_ref))
    };
    let eligible: Vec<Value> = world_positions
        .iter()
        .filter(|p| names_agent(p))
        .map(|p| {
            json!({"position_ref": p["record"]["ref"], "label": p["record"]["label"],
                "handle": p["record"]["handle"], "role_ref": p["record"]["role_ref"],
                "revision": p["record"]["revision"], "source_ref": p["source"]["ref"],
                "source_revision": p["source"]["revision"]})
        })
        .collect();

    // ---- Central: where the World's tree is (Factory reads need it) -------
    let world_root: Option<PathBuf> = match &world_project {
        Some(project) => reader
            .central("central.world.here", json!({"project": project}))
            .ok()
            .and_then(|here| {
                let root = text(&here["local_world"]["root"])?;
                let path = text(&here["project_world"]["path"])?;
                Some(Path::new(&root).join(path))
            }),
        None => None,
    };

    // ---- Actuation: occupancy in this World --------------------------------
    let world_prefix = format!("central:position:{world_ref}:");
    let occupancy = reader.read(
        Product::Actuation,
        vec!["occupancy".into(), "list".into(), "--json".into()],
        None,
    );
    let listed: Vec<Value> = match &occupancy {
        Ok(listing) => listing["positions"]
            .as_array()
            .into_iter()
            .flatten()
            .filter(|p| {
                p["position_ref"]
                    .as_str()
                    .is_some_and(|r| r.starts_with(&world_prefix))
            })
            .cloned()
            .collect(),
        Err(_) => Vec::new(),
    };
    let held: Vec<&Value> = listed
        .iter()
        .filter(|p| {
            p["state"] == "occupied" && p["current"]["agent_ref"].as_str() == Some(agent_ref)
        })
        .collect();
    let others: Vec<&Value> = listed
        .iter()
        .filter(|p| {
            p["state"] == "occupied" && p["current"]["agent_ref"].as_str() != Some(agent_ref)
        })
        .collect();
    let occupied: Vec<Value> = held
        .iter()
        .map(|p| {
            let t = &p["current"];
            json!({"position_ref": p["position_ref"], "generation_ref": t["generation_ref"],
                "generation_ordinal": t["generation_ordinal"], "kind": t["kind"],
                "agency_ref": t["agency_ref"], "began_at_unix_ms": t["began_at_unix_ms"],
                "reason": t["reason"]})
        })
        .collect();
    let presence: Vec<Value> = held
        .iter()
        .map(|p| {
            json!({"position_ref": p["position_ref"],
                "presence": p["presence"]["presence"].as_str().unwrap_or("unreported"),
                "attention": p["presence"]["attention"],
                "at_unix_ms": p["presence"]["at_unix_ms"],
                "generation_ref": p["current"]["generation_ref"]})
        })
        .collect();
    let agency_refs: BTreeSet<String> = held
        .iter()
        .filter_map(|p| text(&p["current"]["agency_ref"]))
        .collect();
    let workcell_refs: BTreeSet<String> = held
        .iter()
        .filter_map(|p| text(&p["current"]["workcell_ref"]))
        .collect();
    let surfaces: Vec<Value> = held
        .iter()
        .flat_map(|p| {
            let t = &p["current"];
            [
                ("gateway", "gateway_address"),
                ("agent-session", "agent_session_ref"),
                ("session-space", "session_space_ref"),
                ("harness-composition", "harness_composition_ref"),
            ]
            .into_iter()
            .filter_map(move |(kind, key)| {
                text(&t[key])
                    .map(|r| json!({"kind": kind, "ref": r, "position_ref": p["position_ref"]}))
            })
        })
        .collect();

    // ---- AIKit: praxis disclosure over the exact profile -------------------
    let profile_file = request
        .scratch_dir
        .join(format!("agent-profile-{}.json", sanitize(agent_ref)));
    let disclosure = match std::fs::write(
        &profile_file,
        serde_json::to_vec_pretty(&read).unwrap_or_default(),
    ) {
        Ok(()) => reader
            .read(
                Product::AiKit,
                vec![
                    "--json".into(),
                    "praxis".into(),
                    "disclose".into(),
                    "--profile-json".into(),
                    profile_file.display().to_string(),
                ],
                None,
            )
            .and_then(|value| {
                // AIKit's --json envelope may wrap the disclosure in `data`.
                let body = if value["schema"] == PRAXIS_DISCLOSURE_SCHEMA {
                    value
                } else {
                    value.get("data").cloned().unwrap_or(value)
                };
                if body["schema"] == PRAXIS_DISCLOSURE_SCHEMA {
                    Ok(body)
                } else {
                    Err(RunFailure {
                        command: format!(
                            "aikit --json praxis disclose --profile-json {}",
                            profile_file.display()
                        ),
                        kind: "invalid-output",
                        detail: format!("expected {PRAXIS_DISCLOSURE_SCHEMA}"),
                    })
                }
            }),
        Err(error) => Err(RunFailure {
            command: "aikit --json praxis disclose --profile-json <file>".into(),
            kind: "refused",
            detail: format!("the profile input could not be written: {error}"),
        }),
    };
    let _ = std::fs::remove_file(&profile_file);
    // The profile input was a temporary file; name it by what it held so the
    // failing command stays reproducible after the file is gone.
    let placeholder = "<agent-profile.read JSON>";
    let file_text = profile_file.display().to_string();
    let disclosure = disclosure.map_err(|mut failure| {
        failure.command = failure.command.replace(&file_text, placeholder);
        failure
    });
    for facet in reader.facets.iter_mut() {
        facet.command = facet.command.replace(&file_text, placeholder);
    }

    // ---- Factory: custody of the Positions this Agent holds or may hold ---
    let custody_positions: BTreeSet<String> = occupied
        .iter()
        .chain(eligible.iter())
        .filter_map(|p| text(&p["position_ref"]))
        .collect();
    let custody: Result<Vec<Value>, RunFailure> =
        match (&world_root, custody_positions.is_empty()) {
            (_, true) => Ok(Vec::new()),
            (None, false) => Err(RunFailure {
                command: "factory development custody list --position <P> --json".into(),
                kind: "unsupported",
                detail: format!("{world_ref} has no Factory project tree O:I could resolve"),
            }),
            (Some(root), false) => {
                let mut rows = Vec::new();
                let mut failed = None;
                for position in &custody_positions {
                    match reader.read(
                        Product::Factory,
                        vec![
                            "development".into(),
                            "custody".into(),
                            "list".into(),
                            "--position".into(),
                            position.clone(),
                            "--json".into(),
                        ],
                        Some(root),
                    ) {
                        Ok(listing) => rows
                            .extend(listing["custody"].as_array().into_iter().flatten().cloned()),
                        Err(failure) => {
                            failed = Some(failure);
                            break;
                        }
                    }
                }
                match failed {
                    Some(failure) => Err(failure),
                    None => Ok(rows),
                }
            }
        };

    // ---- Recognition: Central acceptance ----------------------------------
    let accepted = entry["accepted"].as_bool() == Some(true);
    let acceptance = entry["acceptance"].clone();

    // ---- Public disclosure boundary ---------------------------------------
    let (public_capabilities, public_basis) =
        public_capabilities(&profile, disclosure.as_ref().ok());

    // ---- Citizenship vector ------------------------------------------------
    let mut citizenship = Map::new();
    let profile_basis = vec![format!("{profile_ref}@{profile_revision}")];

    // residence
    let residence = if world_ref == home_world || ratified.iter().any(|w| w == &world_ref) {
        dimension(
            "established",
            {
                let mut b = profile_basis.clone();
                b.push(world_ref.clone());
                b
            },
            format!("{world_ref} is the Agent's World or one it has ratified."),
        )
    } else if world_project.is_some()
        && (home_world == "control:root" || ratified.iter().any(|w| w == "control:root"))
    {
        dimension("partial", {
            let mut b = profile_basis.clone();
            b.push("control:root".into());
            b
        }, format!("{world_ref} inherits control:root, which the Agent ratified; the Project World itself is not ratified."))
    } else {
        dimension(
            "absent",
            profile_basis.clone(),
            format!("The profile neither lives in nor ratifies {world_ref}."),
        )
    };
    citizenship.insert("residence".into(), residence);

    // role
    let role = match (&positions_read, &occupancy) {
        (Err(f), _) => unavailable(f, "World Positions"),
        (_, Err(f)) if eligible.is_empty() => unavailable(f, "Position occupancy"),
        _ if !occupied.is_empty() => dimension(
            "established",
            occupied
                .iter()
                .filter_map(|p| text(&p["generation_ref"]))
                .chain(occupied.iter().filter_map(|p| text(&p["position_ref"])))
                .collect(),
            format!("Holds {} Position(s) in {world_ref}.", occupied.len()),
        ),
        _ if !eligible.is_empty() => dimension(
            "partial",
            eligible
                .iter()
                .filter_map(|p| text(&p["position_ref"]))
                .collect(),
            format!(
                "Eligible for {} Position(s) in {world_ref} but holds none now.",
                eligible.len()
            ),
        ),
        _ => dimension(
            "absent",
            vec![],
            format!("No Position in {world_ref} names this Agent."),
        ),
    };
    citizenship.insert("role".into(), role);

    // repertoire + reach (AIKit)
    match &disclosure {
        Err(f) => {
            citizenship.insert(
                "repertoire".into(),
                unavailable(f, "The AIKit praxis disclosure"),
            );
            citizenship.insert(
                "reach".into(),
                unavailable(f, "The AIKit praxis disclosure"),
            );
        }
        Ok(d) => {
            let sets: Vec<String> = d["repertoire"]["authored_skill_sets"]
                .as_array()
                .into_iter()
                .flatten()
                .filter_map(|s| text(&s["ref"]))
                .collect();
            let praxis = d["praxis"].as_array().cloned().unwrap_or_default();
            let unresolved = d["repertoire"]["unresolved"].as_array().map_or(0, Vec::len);
            let withheld = praxis
                .iter()
                .filter(|p| !p["withheld_reason"].is_null())
                .count();
            let carried = praxis
                .iter()
                .filter(|p| p["involvement"]["carried"] == true)
                .count();
            let mut basis = sets.clone();
            basis.push(format!(
                "{PRAXIS_DISCLOSURE_SCHEMA}:{profile_ref}@{profile_revision}"
            ));
            let repertoire = if carried == 0 {
                dimension(
                    "absent",
                    basis.clone(),
                    "AIKit discloses no carried praxis for this profile.",
                )
            } else if unresolved > 0 || withheld > 0 {
                dimension(
                    "partial",
                    basis.clone(),
                    format!("{carried} carried; {unresolved} unresolved and {withheld} withheld."),
                )
            } else {
                dimension(
                    "established",
                    basis.clone(),
                    format!(
                        "{carried} carried praxis resolved from {} SkillSet(s).",
                        sets.len()
                    ),
                )
            };
            citizenship.insert("repertoire".into(), repertoire);
            let available = praxis
                .iter()
                .filter(|p| {
                    p["involvement"]["available"] == true || p["involvement"]["projected"] == true
                })
                .count();
            let reach = if carried == 0 {
                dimension(
                    "absent",
                    basis,
                    "Nothing carried, so nothing reaches this context.",
                )
            } else if available == carried {
                dimension(
                    "established",
                    basis,
                    format!("All {carried} carried praxis are available here."),
                )
            } else if available > 0 {
                dimension(
                    "partial",
                    basis,
                    format!("{available} of {carried} carried praxis are available here."),
                )
            } else {
                dimension(
                    "partial",
                    basis,
                    format!("{carried} carried; availability in this context was not observed."),
                )
            };
            citizenship.insert("reach".into(), reach);
        }
    }

    // authority (Actuation)
    let authority = match &occupancy {
        Err(f) => unavailable(f, "Actuation occupancy"),
        Ok(_) if !agency_refs.is_empty() => dimension(
            "partial",
            agency_refs.iter().cloned().collect(),
            "Acts through a bound Agency; its grants are not readable (Actuation exposes no authority listing, and `actuation authority resolve` needs a request).",
        ),
        Ok(_) => json!({"state": "unavailable", "basis": [],
            "command": "actuation authority resolve <request>",
            "reading": "No Agency is bound to this Agent in this World, and Actuation exposes no authority listing to read grants from."}),
    };
    citizenship.insert("authority".into(), authority);

    // relation
    let co_agents: BTreeSet<String> = others
        .iter()
        .filter_map(|p| text(&p["current"]["agent_ref"]))
        .collect();
    let relation = match &occupancy {
        Err(f) => unavailable(f, "Actuation occupancy"),
        Ok(_) if !co_agents.is_empty() && !occupied.is_empty() => dimension(
            "established",
            co_agents.iter().cloned().collect(),
            format!(
                "Shares {world_ref} with {} other occupant(s).",
                co_agents.len()
            ),
        ),
        Ok(_) if !co_agents.is_empty() => dimension(
            "partial",
            co_agents.iter().cloned().collect(),
            format!(
                "{} other occupant(s) in {world_ref}; this Agent holds no Position beside them.",
                co_agents.len()
            ),
        ),
        Ok(_) => dimension(
            "absent",
            vec![],
            format!("No other occupant in {world_ref}."),
        ),
    };
    citizenship.insert("relation".into(), relation);

    // contribution + reciprocity (Factory custody)
    match &custody {
        Err(f) => {
            citizenship.insert(
                "contribution".into(),
                unavailable(f, "Factory work custody"),
            );
            citizenship.insert("reciprocity".into(), unavailable(f, "Factory work custody"));
        }
        Ok(rows) => {
            let refs: Vec<String> = rows
                .iter()
                .filter_map(|c| text(&c["custody_ref"]))
                .collect();
            let returned: Vec<String> = rows
                .iter()
                .filter(|c| matches!(c["state"].as_str(), Some("completed" | "handed-off")))
                .filter_map(|c| text(&c["custody_ref"]))
                .collect();
            let active = rows.iter().filter(|c| c["state"] == "in-progress").count();
            citizenship.insert(
                "contribution".into(),
                if !returned.is_empty() {
                    dimension(
                        "established",
                        refs.clone(),
                        format!(
                            "{} work item(s) completed or handed off; {active} in progress.",
                            returned.len()
                        ),
                    )
                } else if !rows.is_empty() {
                    dimension(
                        "partial",
                        refs.clone(),
                        format!(
                            "{} work item(s) in custody, none completed yet.",
                            rows.len()
                        ),
                    )
                } else {
                    dimension(
                        "absent",
                        vec![],
                        format!(
                            "No Factory work custody for this Agent's Positions in {world_ref}."
                        ),
                    )
                },
            );
            citizenship.insert(
                "reciprocity".into(),
                if !returned.is_empty() {
                    dimension(
                        "established",
                        returned.clone(),
                        format!("{} Return(s) closed through custody.", returned.len()),
                    )
                } else if active > 0 {
                    dimension(
                        "partial",
                        refs,
                        "Carries work whose Return has not closed yet.",
                    )
                } else {
                    dimension(
                        "absent",
                        vec![],
                        "No Return recorded through Factory custody.",
                    )
                },
            );
        }
    }

    // reliability (AIKit activity rungs)
    let reliability = match &disclosure {
        Err(f) => unavailable(f, "The AIKit praxis disclosure"),
        Ok(d) => {
            let praxis = d["praxis"].as_array().cloned().unwrap_or_default();
            let verified: Vec<String> = praxis
                .iter()
                .filter(|p| p["involvement"]["verified"] == true)
                .filter_map(|p| text(&p["id"]))
                .collect();
            let succeeded: Vec<String> = praxis
                .iter()
                .filter(|p| p["involvement"]["succeeded"] == true)
                .filter_map(|p| text(&p["id"]))
                .collect();
            if !verified.is_empty() {
                dimension(
                    "established",
                    verified,
                    "Independent verification passed for disclosed praxis.",
                )
            } else if !succeeded.is_empty() {
                dimension(
                    "partial",
                    succeeded,
                    "Praxis succeeded, but no independent verification is recorded.",
                )
            } else {
                dimension(
                    "absent",
                    strings(&d["operative"]["evidence_refs"]),
                    "No success or verification evidence is disclosed for this Agent.",
                )
            }
        }
    };
    citizenship.insert("reliability".into(), reliability);

    // recognition (Central acceptance)
    let recognition_dim = if accepted {
        dimension(
            "established",
            text(&acceptance["acceptance_ref"]).into_iter().collect(),
            "The owner accepted this exact Agent definition in Central.",
        )
    } else {
        dimension(
            "absent",
            profile_basis.clone(),
            format!(
                "Not accepted; the profile stands as {}.",
                text(&profile["intent_provenance"]["recognition"])
                    .unwrap_or_else(|| "an unaccepted definition".into())
            ),
        )
    };
    citizenship.insert("recognition".into(), recognition_dim);

    // continuity (Actuation tenure generations)
    let continuity = match &occupancy {
        Err(f) => unavailable(f, "Actuation occupancy"),
        Ok(_)
            if occupied.iter().any(|t| {
                t["generation_ordinal"].as_u64().unwrap_or(0) > 1 || t["kind"] == "handover"
            }) =>
        {
            dimension(
                "established",
                occupied
                    .iter()
                    .filter_map(|t| text(&t["generation_ref"]))
                    .collect(),
                "Holds its Position across more than one tenure generation.",
            )
        }
        Ok(_) if !occupied.is_empty() => dimension(
            "partial",
            occupied
                .iter()
                .filter_map(|t| text(&t["generation_ref"]))
                .collect(),
            "Holds a first tenure; no handover history yet.",
        ),
        Ok(_) => dimension(
            "absent",
            profile_basis.clone(),
            format!("The profile persists, but no tenure in {world_ref}."),
        ),
    };
    citizenship.insert("continuity".into(), continuity);

    // ---- Relations, returns, evidence -------------------------------------
    let other_positions: Vec<Value> = others
        .iter()
        .map(|p| {
            json!({"position_ref": p["position_ref"], "agent_ref": p["current"]["agent_ref"],
            "agency_ref": p["current"]["agency_ref"]})
        })
        .collect();
    let returns = json!({
        "destinations": disclosure.as_ref().ok().map(|d| d["return"]["destinations"].clone()).unwrap_or(json!([])),
        "custody_closed": custody.as_ref().ok().map(|rows| rows.iter()
            .filter(|c| matches!(c["state"].as_str(), Some("completed" | "handed-off")))
            .filter_map(|c| text(&c["custody_ref"])).collect::<Vec<_>>()).unwrap_or_default(),
        "source_rewritten": false,
    });

    let facet_json: Vec<Value> = reader
        .facets
        .iter()
        .map(|f| json!({"owner": f.owner, "command": f.command, "state": f.state, "reason": f.reason}))
        .collect();

    let repertoire = match &disclosure {
        Ok(d) => json!({
            "state": "present",
            "source": PRAXIS_DISCLOSURE_SCHEMA,
            "authored_skill_sets": d["repertoire"]["authored_skill_sets"],
            "effective_skill_sets": d["repertoire"]["effective_skill_sets"],
            "direct_skill_refs": d["repertoire"]["direct_skill_refs"],
            "method_refs": d["repertoire"]["method_refs"],
            "unresolved": d["repertoire"]["unresolved"],
            "praxis": d["praxis"].as_array().into_iter().flatten().map(|p| json!({
                "id": p["id"], "name": p["name"], "form": p["form"], "revision": p["revision"],
                "via": p["via"], "withheld_reason": p["withheld_reason"],
                "carried": p["involvement"]["carried"], "available": p["involvement"]["available"]
            })).collect::<Vec<_>>(),
        }),
        Err(f) => json!({
            "state": "unavailable",
            "command": f.command,
            "reason": format!("{}: {}", f.kind, f.detail),
            "authored_skill_set_refs": profile["skill_set_refs"],
            "authored_skill_refs": profile["skill_refs"],
            "authored_method_refs": profile["method_refs"],
        }),
    };

    let custody_json = match &custody {
        Ok(rows) => json!({"state": "present", "custody": rows.iter().map(|c| json!({
            "custody_ref": c["custody_ref"], "position_ref": c["position_ref"], "work_ref": c["work_ref"],
            "run_ref": c["run_ref"], "state": c["state"], "revision": c["revision"], "reason": c["reason"]
        })).collect::<Vec<_>>()}),
        Err(f) => {
            json!({"state": "unavailable", "command": f.command, "reason": format!("{}: {}", f.kind, f.detail)})
        }
    };

    // A reading ref, not a store: the same Agent, World and profile revision
    // name the same composition. Nothing is persisted under it.
    let participation_ref =
        format!("oi:participation:{agent_ref}@{world_ref}#{profile_ref}@{profile_revision}");
    Ok(json!({
        "schema": PARTICIPATION_SCHEMA,
        "participation_ref": participation_ref,
        "agent_ref": agent_ref,
        "world_ref": world_ref,
        "profile": {
            "ref": profile_ref,
            "revision": profile_revision,
            "name": profile["name"],
            "register": register,
            "project": register_project,
            "source_path": read["source_path"],
            "content_digest": entry["content_digest"],
        },
        "expression": {
            "name": profile["name"],
            "purpose": profile["purpose"],
            "role": profile["role"],
            "intent_expression": profile["intent_provenance"]["intent_expression"],
            "authorship": profile["intent_provenance"]["authorship"],
            "recognition": profile["intent_provenance"]["recognition"],
        },
        "roles": {
            "profile_role": profile["role"],
            "occupied": occupied,
            "eligible": eligible,
        },
        "residence": {
            "profile_scope": profile["scope"],
            "world_ref": home_world,
            "ratified_world_refs": ratified,
            "selected_world_ref": world_ref,
            "occupied_position_refs": occupied.iter().filter_map(|p| text(&p["position_ref"])).collect::<Vec<_>>(),
        },
        "repertoire": repertoire,
        "public_capabilities": public_capabilities,
        "interaction_surfaces": surfaces,
        "authority": {
            "agency_refs": agency_refs.iter().cloned().collect::<Vec<_>>(),
            "execution_authority_granted_by_profile": entry["execution_authority_granted"],
            "grants": {"state": "unavailable", "command": "actuation authority resolve <request>",
                "reason": "Actuation publishes no authority listing; grants are resolved per request."},
        },
        "material_presence": {
            "workcell_refs": workcell_refs.iter().cloned().collect::<Vec<_>>(),
            "basis": "actuation tenure workcell_ref",
        },
        "relations": {
            "co_occupants": other_positions,
            "agencies": agency_refs.iter().cloned().collect::<Vec<_>>(),
            "projects": world_project.iter().cloned().collect::<Vec<_>>(),
        },
        "availability": {
            "state": match &occupancy { Ok(_) => "present", Err(_) => "unavailable" },
            "presence": presence,
        },
        "contribution": custody_json,
        "returns": returns,
        "evidence": facet_json,
        "recognition": {
            "accepted": accepted,
            "acceptance": acceptance,
        },
        "disclosure": {
            "public_basis": public_basis,
            // O:I serves no authenticated extended card; no provider, docs,
            // icon or security scheme is declared by any native owner today.
            "extended_card_served": false,
            "provider": Value::Null,
            "documentation_url": Value::Null,
            "icon_url": Value::Null,
            "security_schemes": Value::Null,
            "security_requirements": [],
            "boundary": "Only praxis explicitly disclosed as public reaches public_capabilities; internal repertoire is not public disclosure.",
        },
        "citizenship": Value::Object(citizenship),
    }))
}

/// Public capabilities are only praxis explicitly disclosed as public. The
/// Central AgentProfile schema (central.agent-profile/v1) has no public
/// disclosure field today; if one appears as `public_skill_refs` (top level
/// or under `disclosure`) it is honoured, intersected with carried praxis.
fn public_capabilities(profile: &Value, disclosure: Option<&Value>) -> (Vec<Value>, &'static str) {
    let declared: Vec<String> = [
        &profile["public_skill_refs"],
        &profile["disclosure"]["public_skill_refs"],
    ]
    .into_iter()
    .flat_map(strings)
    .collect();
    if declared.is_empty() {
        return (Vec::new(), "none-declared");
    }
    let Some(d) = disclosure else {
        return (Vec::new(), "declared-unresolved");
    };
    let caps = d["praxis"]
        .as_array()
        .into_iter()
        .flatten()
        .filter(|p| p["involvement"]["carried"] == true && p["withheld_reason"].is_null())
        .filter(|p| {
            declared
                .iter()
                .any(|r| p["id"].as_str() == Some(r) || p["name"].as_str() == Some(r))
        })
        .map(|p| {
            // Field names are exactly what AIKit's A2A builder reads
            // (aikit-core a2a_card::PublicCapability).
            let name = text(&p["name"])
                .or_else(|| text(&p["id"]))
                .unwrap_or_default();
            let description = text(&p["payload"]).unwrap_or_else(|| name.clone());
            let mut tags = vec![p["form"].as_str().unwrap_or("skill").to_owned()];
            if let Some(revision) = text(&p["revision"]) {
                tags.push(format!("revision:{revision}"));
            }
            json!({"id": p["id"], "name": name, "description": description, "tags": tags})
        })
        .collect();
    (caps, "profile-declared")
}

fn sanitize(value: &str) -> String {
    value
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' {
                c
            } else {
                '_'
            }
        })
        .collect()
}

// ---------------------------------------------------------------------------
// Human Agent card (oi.human-agent-card/v1)
// ---------------------------------------------------------------------------

fn praxis_of_form<'a>(participation: &'a Value, form: &str) -> Vec<&'a Value> {
    participation["repertoire"]["praxis"]
        .as_array()
        .into_iter()
        .flatten()
        .filter(|p| p["form"] == form && p["withheld_reason"].is_null())
        .collect()
}

fn names(items: &[&Value]) -> Vec<String> {
    items
        .iter()
        .filter_map(|p| text(&p["name"]).or_else(|| text(&p["id"])))
        .collect()
}

fn ids(items: &[&Value]) -> Vec<String> {
    items.iter().filter_map(|p| text(&p["id"])).collect()
}

fn listing(items: &[String]) -> String {
    match items.len() {
        0 => String::new(),
        1..=4 => items.join(", "),
        n => format!("{} and {} more", items[..3].join(", "), n - 3),
    }
}

/// Derive the human card from a participation reading. The card is never
/// identity authority and never edited: a change to intent, SkillSets,
/// participation or public disclosure re-derives it.
pub fn human_card(participation: &Value) -> Value {
    let p = participation;
    let profile_ref = text(&p["profile"]["ref"]).unwrap_or_default();
    let revision = text(&p["profile"]["revision"]).unwrap_or_default();
    let profile_at = format!("{profile_ref}@{revision}");
    let agent_ref = text(&p["agent_ref"]).unwrap_or_default();
    let world_ref = text(&p["world_ref"]).unwrap_or_default();
    let name = text(&p["expression"]["name"]).unwrap_or_else(|| agent_ref.clone());
    let repertoire_present = p["repertoire"]["state"] == "present";
    let unavailable_note = |what: &str| {
        json!({"state": "unavailable", "command": p["repertoire"]["command"],
            "text": format!("{what} is not readable here: AIKit's praxis disclosure is unavailable ({}).",
                p["repertoire"]["command"].as_str().unwrap_or("aikit praxis disclose"))})
    };

    // what I can do — unprefixed Skills
    let skills = praxis_of_form(p, "skill");
    let what_i_can_do = if repertoire_present {
        let n = names(&skills);
        json!({"text": if n.is_empty() { "No Skills are carried.".to_owned() } else { format!("Can draw on {}.", listing(&n)) },
            "items": n, "refs": ids(&skills)})
    } else {
        let authored = strings(&p["repertoire"]["authored_skill_refs"]);
        let mut v = unavailable_note("Resolved repertoire");
        v["items"] = json!(authored.clone());
        v["standing"] = json!("authored-unresolved");
        v["refs"] = json!(authored);
        v
    };

    // how I work — Methods
    let methods = praxis_of_form(p, "method");
    let how_i_work = if repertoire_present {
        let n = names(&methods);
        json!({"text": if n.is_empty() { "No Methods are carried.".to_owned() } else { format!("Works by {}.", listing(&n)) },
            "items": n, "refs": ids(&methods)})
    } else {
        let authored = strings(&p["repertoire"]["authored_method_refs"]);
        let mut v = unavailable_note("Method resolution");
        v["items"] = json!(authored.clone());
        v["standing"] = json!("authored-unresolved");
        v["refs"] = json!(authored);
        v
    };

    // how I orient — Methodologies; omitted (null) when none
    let methodologies = praxis_of_form(p, "methodology");
    let how_i_orient = if methodologies.is_empty() {
        Value::Null
    } else {
        let n = names(&methodologies);
        json!({"text": format!("Orients through {}.", listing(&n)), "items": n, "refs": ids(&methodologies)})
    };

    // what I carry — SkillSets
    let (carry_refs, carry_items): (Vec<String>, Vec<Value>) = if repertoire_present {
        let sets = p["repertoire"]["authored_skill_sets"]
            .as_array()
            .cloned()
            .unwrap_or_default();
        (
            sets.iter()
                .filter_map(|s| {
                    text(&s["ref"]).map(|r| match text(&s["revision"]) {
                        Some(rev) => format!("{r}@{rev}"),
                        None => r,
                    })
                })
                .collect(),
            sets.iter()
                .map(|s| {
                    json!({"ref": s["ref"], "resolved": s["resolved"],
                "members": s["members"].as_array().map_or(0, Vec::len),
                "withheld": s["withheld"].as_array().map_or(0, Vec::len)})
                })
                .collect(),
        )
    } else {
        let authored = strings(&p["repertoire"]["authored_skill_set_refs"]);
        (
            authored.clone(),
            authored
                .iter()
                .map(|r| json!({"ref": r, "resolved": null}))
                .collect(),
        )
    };
    let what_i_carry = json!({
        "text": if carry_refs.is_empty() { "Carries no SkillSet.".to_owned() }
                else { format!("Carries {}.", listing(&carry_items.iter().filter_map(|i| text(&i["ref"])).collect::<Vec<_>>())) },
        "skill_sets": carry_items,
        "refs": carry_refs,
    });

    // where I participate
    let occupied: Vec<String> = p["roles"]["occupied"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|o| text(&o["label"]).or_else(|| text(&o["position_ref"])))
        .collect();
    let occupied_refs: Vec<String> = p["roles"]["occupied"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|o| text(&o["position_ref"]))
        .collect();
    let eligible_refs: Vec<String> = p["roles"]["eligible"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|o| text(&o["position_ref"]))
        .collect();
    let ratified = strings(&p["residence"]["ratified_world_refs"]);
    let mut where_refs = vec![world_ref.clone()];
    where_refs.extend(occupied_refs.iter().cloned());
    where_refs.extend(eligible_refs.iter().cloned());
    let where_i_participate = json!({
        "text": if occupied_refs.is_empty() {
            format!("Lives in {}; holds no Position in {world_ref}.", p["residence"]["world_ref"].as_str().unwrap_or("its World"))
        } else {
            format!("Holds {} in {world_ref}.", listing(&occupied_refs))
        },
        "world_ref": world_ref,
        "home_world_ref": p["residence"]["world_ref"],
        "other_worlds": ratified.iter().filter(|w| **w != world_ref).cloned().collect::<Vec<_>>(),
        "positions": {"occupied": occupied_refs, "eligible": eligible_refs},
        "refs": where_refs,
    });
    let _ = occupied;

    // citizenship summary
    let mut counts = [0usize; 4];
    let mut states = Map::new();
    let mut cit_refs = Vec::new();
    for dim in CITIZENSHIP_DIMENSIONS {
        let d = &p["citizenship"][dim];
        let state = d["state"].as_str().unwrap_or("unavailable");
        let slot = match state {
            "established" => 0,
            "partial" => 1,
            "absent" => 2,
            _ => 3,
        };
        counts[slot] += 1;
        states.insert(dim.into(), json!({"state": state, "reading": d["reading"], "basis": d["basis"], "command": d.get("command")}));
        cit_refs.extend(strings(&d["basis"]));
    }
    cit_refs.sort();
    cit_refs.dedup();
    let citizenship = json!({
        "summary": format!("{} established · {} partial · {} absent · {} unavailable in {world_ref}",
            counts[0], counts[1], counts[2], counts[3]),
        "dimensions": states,
        "refs": cit_refs,
    });

    // currently
    let presence: Vec<Value> = p["availability"]["presence"]
        .as_array()
        .cloned()
        .unwrap_or_default();
    let active_work: Vec<Value> = p["contribution"]["custody"]
        .as_array()
        .into_iter()
        .flatten()
        .filter(|c| c["state"] == "in-progress")
        .cloned()
        .collect();
    let mut current_refs: Vec<String> = presence
        .iter()
        .filter_map(|x| text(&x["generation_ref"]))
        .collect();
    current_refs.extend(active_work.iter().filter_map(|c| text(&c["custody_ref"])));
    let currently = json!({
        "text": match (presence.first(), active_work.len()) {
            (None, 0) => "Not present in this World now.".to_owned(),
            (None, n) => format!("{n} work item(s) in custody; no current tenure."),
            (Some(first), n) => format!("{} in {}; {n} work item(s) in progress.",
                first["presence"].as_str().unwrap_or("unreported"),
                first["position_ref"].as_str().unwrap_or("its Position")),
        },
        "presence": presence,
        "work": active_work.iter().map(|c| json!({"custody_ref": c["custody_ref"], "work_ref": c["work_ref"], "state": c["state"]})).collect::<Vec<_>>(),
        "refs": current_refs,
    });

    json!({
        "schema": HUMAN_CARD_SCHEMA,
        "derived_from": {"schema": PARTICIPATION_SCHEMA, "agent_ref": agent_ref, "world_ref": world_ref,
            "profile": profile_at},
        "identity": {"name": name, "agent_ref": agent_ref, "profile_ref": profile_ref,
            "revision": revision, "refs": [agent_ref, profile_at]},
        "why_im_here": {
            "text": p["expression"]["purpose"],
            "intent_expression": p["expression"]["intent_expression"],
            "role": p["expression"]["role"],
            "refs": [profile_at],
        },
        "what_i_can_do": what_i_can_do,
        "how_i_work": how_i_work,
        "how_i_orient": how_i_orient,
        "what_i_carry": what_i_carry,
        "where_i_participate": where_i_participate,
        "citizenship": citizenship,
        "currently": currently,
        "public": {
            "capabilities": p["public_capabilities"],
            "basis": p["disclosure"]["public_basis"],
            "refs": p["public_capabilities"].as_array().into_iter().flatten().filter_map(|c| text(&c["id"])).collect::<Vec<_>>(),
        },
    })
}

/// Build the argv for AIKit's A2A card builder over a participation file.
pub fn a2a_card_args(participation_file: &Path, interface_url: &str) -> Vec<String> {
    vec![
        "--json".into(),
        "a2a".into(),
        "card".into(),
        "--participation-json".into(),
        participation_file.display().to_string(),
        "--interface-url".into(),
        interface_url.into(),
    ]
}
