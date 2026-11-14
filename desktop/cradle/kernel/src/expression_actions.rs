//! Expressions' Actions (O-I #1008; docs/architecture/world-shell.md §9.3, Expressions' core, "Scene save and launch; keep a take",
//! and its transport, "Play and Stop scenes; Record a take; Tempo; Arm; Capture"): the `expressions.*` ids of the one Action
//! registry, answered by the kernel's expression store under the kernel's lock, through the act door (`act`, lib.rs). A person's
//! press and an agent's `oi act invoke` reach this one implementation. Each answer names what it moved (`expression_ref`,
//! `scene_ref`, `take_ref`; the file's `location` where a work was made, opened or saved), so the act's receipt in the Day names it
//! (central.rs `Receipt`); a refusal is the store's own words.
//!
//! Tempo is a Studio value: the field's time scale, `field.params.timeScale`, Tempo ÷ 96 (expression_playback.rs
//! `TEMPO_PER_TIME_SCALE`), written by `expressions.studio.set` as every value of the field is. Capture is `expressions.scene.capture`.
//! No transport control writes except by one of these.
use crate::action::{ActionDispatch, ActionInvocation};
use crate::expression::{Change, Document, Request, Scene};
use crate::expression_studio::{Finite, Kept, Recording, StudioTake};
use crate::files;
use crate::flow::Channel;
use crate::{Kernel, KernelEventReceipt, KernelOp, KernelOpOutcome, KernelOpResult};
use serde::Deserialize;
use serde_json::{json, Value};

/// The prefix every Action of Expressions carries.
pub const PREFIX: &str = "expressions.";
/// The owner's Action field, as `oi act` reads every owner's (cli world_heads.rs `OWNER_ACTION_FIELD_SCHEMA`).
pub const FIELD_SCHEMA: &str = "oi.owner-action-field/v1";
/// The schema of an Action's answer.
pub const ANSWER_SCHEMA: &str = "oi.expression-act/v1";
/// The owner operation an answer names: the kernel's expression store.
const OWNER_OPERATION: &str = "oi kernel expressions";
/// How each Action changes what it acts on (Central's classes, action.rs `Catalogue`): every one of these changes the store.
const MUTATION_CLASS: &str = "locally-mutating";

/// One Action of the field: its id, title, what it does, and its inputs (`name`, `type`, `required`).
struct Spec {
    id: &'static str,
    title: &'static str,
    description: &'static str,
    inputs: &'static [(&'static str, &'static str, bool)],
}

const WORK: (&str, &str, bool) = ("expression_ref", "string", true);
const SCENE: (&str, &str, bool) = ("scene_ref", "string", true);

const ACTIONS: [Spec; 18] = [
    Spec {
        id: "expressions.new",
        title: "New Expression",
        description: "Make an Expression of one blank Scene, the field's own, and save it into the works home.",
        inputs: &[("title", "string", true)],
    },
    Spec {
        id: "expressions.open",
        title: "Open an Expression",
        description: "Open an Expression from its file; it is held as its file holds it.",
        inputs: &[("location", "central.path-ref/v1", true), ("expected_file_revision", "string", false)],
    },
    Spec {
        id: "expressions.studio.set",
        title: "Set a Studio value",
        description: "Write a value of the field (`bind`, as a lane binds it: field.params.<key>; Tempo is field.params.timeScale, Tempo ÷ 96) or a device setting (`setting`: {kind, key}) into a Scene, by the law the devices write with. While the Expression records, the value is recorded on its take at the instant the kernel stamps. `changes` writes several at once. A drag's samples while a take records (`gesture`: \"sample\") land in the take alone: the Scene is written once, by the value the drag is released on.",
        inputs: &[WORK, SCENE, ("bind", "string", false), ("setting", "object", false), ("value", "json", false), ("observed", "number", false), ("changes", "array", false), ("gesture", "string", false)],
    },
    Spec {
        id: "expressions.scene.save",
        title: "Save a Scene",
        description: "Keep what the Scene holds as its saved version, then save the Expression to its file.",
        inputs: &[WORK, SCENE],
    },
    Spec {
        id: "expressions.scene.launch",
        title: "Launch Scenes",
        description: "Play a Scene of each Expression named, landing on its Quantize; an armed Expression records a take from where its Scene lands.",
        inputs: &[("launches", "array", true), ("saved", "boolean", false)],
    },
    Spec {
        id: "expressions.scene.stop",
        title: "Stop",
        description: "Stop an Expression, or every Expression (Stop All); a take that records is closed and laid on its Scene.",
        inputs: &[("expression_ref", "string", false)],
    },
    Spec {
        id: "expressions.scene.capture",
        title: "Capture",
        description: "Keep the Scene as it stands as its saved version, and start the next Scene from it, after it.",
        inputs: &[WORK, SCENE],
    },
    Spec {
        id: "expressions.arm",
        title: "Arm",
        description: "Arm an Expression, so that Play records a take, or disarm it, which closes the take it records.",
        inputs: &[WORK, ("on", "boolean", true)],
    },
    Spec {
        id: "expressions.take.keep",
        title: "Keep a take",
        description: "Keep a take, whole or from_s to to_s, into its Scene's main lane: a Studio take's values into the Scene's lanes, a Torus take's stretch comped into the performance.",
        inputs: &[WORK, SCENE, ("take_ref", "string", true), ("from_s", "number", false), ("to_s", "number", false)],
    },
    Spec {
        id: "expressions.save",
        title: "Save",
        description: "Save the Expression to its file, or into the works home when it has none.",
        inputs: &[WORK],
    },
    Spec {
        id: "expressions.mix.set",
        title: "Set the mixer",
        description: "Set one of the Expression's mixer controls: active (the Activator), solo, level (Volume, 0 to 2) or main (0 to 2).",
        inputs: &[WORK, ("key", "string", true), ("value", "json", true)],
    },
    Spec {
        id: "expressions.duplicate",
        title: "Duplicate",
        description: "Copy the Expression under a fresh ref and a title the works do not use yet, and save the copy into the works home.",
        inputs: &[WORK],
    },
    Spec {
        id: "expressions.delete",
        title: "Delete",
        description: "Take the Expression's file to Central's trash, by the person's own press; its history brings it back.",
        inputs: &[WORK, ("location", "central.path-ref/v1", false), ("expected_file_revision", "string", false)],
    },
    Spec {
        id: "expressions.scene.edit",
        title: "Edit the Scenes",
        description: "One edit of the Expression's Scenes, as Session and Arrangement make it (`operation`): duplicate, remove or add a Scene, reorder them; the Expression's title, description, colour, loop and loop edge; and Arrangement's cuts — move (insert or overwrite), trim, roll, slip, slide and split — by the field's own timeline law. A roll or slide stops at the limit it reaches and says why.",
        inputs: &[WORK, ("operation", "string", true), ("scene_ref", "string", false), ("expected_revision", "number", false), ("title", "string", false),
            ("description", "string", false), ("colour", "string", false), ("loop", "boolean", false), ("edge", "string", false), ("at", "number", false),
            ("seconds", "number", false), ("mode", "string", false), ("to_ref", "string", false), ("scene_refs", "array", false), ("after", "string", false)],
    },
    Spec {
        id: "expressions.lane.draw",
        title: "Draw a lane",
        description: "Draw a Scene's recorded lane of a Field value: the points drawn (2 to 512, in the Scene's seconds) lie over the stretch they cover, inside the Scene and the value's range, and the moves outside it stay.",
        inputs: &[WORK, SCENE, ("track_id", "string", true), ("points", "array", true)],
    },
    Spec {
        id: "expressions.studio.reenable",
        title: "Re-enable automation",
        description: "Give the values held off their automation by hand back to it: every one the Expression holds, or the one `target` names (field.<key>).",
        inputs: &[WORK, ("target", "string", false)],
    },
    Spec {
        id: "expressions.take.unkeep",
        title: "Take a kept take back",
        description: "Take a kept take back out of its Scene's main lane: a Studio take's stretch gives way to what the lane held before it was kept; a Torus take's stretch, whole or from_s to to_s, is uncomped from the performance.",
        inputs: &[WORK, SCENE, ("take_ref", "string", true), ("from_s", "number", false), ("to_s", "number", false)],
    },
    Spec {
        id: "expressions.take.lane",
        title: "Set a take lane",
        description: "A Torus take lane's Activator and Solo, kept on its lane in the Scene's performance.",
        inputs: &[WORK, SCENE, ("lane_ref", "string", true), ("enabled", "boolean", true), ("solo", "boolean", true)],
    },
];

/// The owner's Action field (`oi.owner-action-field/v1`), which `oi act` lists and describes with no app running.
pub fn field() -> Value {
    let actions: Vec<Value> = ACTIONS
        .iter()
        .map(|spec| {
            json!({"id": spec.id, "title": spec.title, "description": spec.description, "mutation_class": MUTATION_CLASS,
                "inputs": spec.inputs.iter().map(|(name, kind, required)| json!({"name": name, "type": kind, "required": required}))
                    .collect::<Vec<_>>(),
                "output": {"type": ANSWER_SCHEMA},
                "availability": {"available": true, "reason": null,
                    "runs_in": "the running desktop's kernel, which holds the expression store"}})
        })
        .collect();
    json!({"schema": FIELD_SCHEMA, "owner": "expressions", "actions": actions})
}

/// Whether an id is one of the field's.
pub fn holds(action: &str) -> bool {
    ACTIONS.iter().any(|spec| spec.id == action)
}

/// The instant now, in unix ms.
pub fn now_unix_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|since| since.as_millis() as u64)
        .unwrap_or(0)
}

/// One Action of the field, run on the kernel's expression store. A refusal is the owner's answer (`OwnerRefused`, in words); what
/// the store committed before it (a work made, then not saved) keeps its receipts.
pub(crate) fn apply(
    kernel: &mut Kernel,
    project: Option<String>,
    invocation: ActionInvocation,
    channel: Channel,
) -> Result<KernelOpOutcome, String> {
    let _ = project;
    let action = invocation.action;
    let owner_operation = format!(
        "{OWNER_OPERATION} {}",
        &action[PREFIX.len().min(action.len())..]
    );
    let input = invocation.input.unwrap_or(Value::Null);
    let person = channel == Channel::PersonPress;
    let mut act = Act {
        kernel,
        action: &action,
        actor: if person {
            "human:expressions-app"
        } else {
            "agent:oi-act"
        },
        actor_kind: if person { "human" } else { "agent" },
        channel,
        receipts: Vec::new(),
    };
    let answer = match action.as_str() {
        "expressions.new" => act.make(&input),
        "expressions.open" => act.open(&input),
        "expressions.studio.set" => act.studio_set(&input),
        "expressions.scene.save" => act.scene_save(&input),
        "expressions.scene.launch" => act.launch(&input),
        "expressions.scene.stop" => act.stop(&input),
        "expressions.scene.capture" => act.capture(&input),
        "expressions.arm" => act.arm(&input),
        "expressions.take.keep" => act.keep(&input),
        "expressions.save" => act.save_work(&input),
        "expressions.mix.set" => act.mix(&input),
        "expressions.duplicate" => act.duplicate(&input),
        "expressions.delete" => act.delete(&input),
        "expressions.scene.edit" => act.scene_edit(&input),
        "expressions.lane.draw" => act.lane_draw(&input),
        "expressions.studio.reenable" => act.reenable(&input),
        "expressions.take.unkeep" => act.unkeep(&input),
        "expressions.take.lane" => act.take_lane(&input),
        other => Err(format!(
            "`{other}` is no Action of Expressions; `oi act` lists the ones it has"
        )),
    };
    let receipts = act.receipts;
    let dispatch = match answer {
        Ok(mut data) => {
            data["schema"] = json!(ANSWER_SCHEMA);
            data["action"] = json!(action);
            ActionDispatch::Invoked {
                owner_operation,
                data,
            }
        }
        Err(message) => ActionDispatch::OwnerRefused {
            owner_operation,
            message,
        },
    };
    Ok(KernelOpOutcome {
        read_scopes: None,
        receipts,
        result: KernelOpResult::ActionDispatched {
            dispatch,
            reads_only: false,
        },
    })
}

/// An input read in the Action's own terms; a wrong one is refused naming what it takes.
fn input<T: for<'de> Deserialize<'de>>(action: &str, input: &Value) -> Result<T, String> {
    serde_json::from_value(input.clone()).map_err(|error| {
        let takes = ACTIONS
            .iter()
            .find(|spec| spec.id == action)
            .map(|spec| {
                spec.inputs
                    .iter()
                    .map(|(name, _, required)| {
                        if *required {
                            (*name).to_owned()
                        } else {
                            format!("{name}?")
                        }
                    })
                    .collect::<Vec<_>>()
                    .join(", ")
            })
            .unwrap_or_default();
        format!("{action} takes {{{takes}}}: {error}")
    })
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct NewInput {
    title: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct OpenInput {
    location: files::Location,
    #[serde(default)]
    expected_file_revision: Option<String>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct SceneInput {
    expression_ref: String,
    scene_ref: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct WorkInput {
    expression_ref: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct LaunchInput {
    launches: Vec<SceneInput>,
    #[serde(default)]
    saved: bool,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct StopInput {
    #[serde(default)]
    expression_ref: Option<String>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct ArmInput {
    expression_ref: String,
    on: bool,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct KeepInput {
    expression_ref: String,
    scene_ref: String,
    take_ref: String,
    #[serde(default)]
    from_s: Option<f64>,
    #[serde(default)]
    to_s: Option<f64>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct MixInput {
    expression_ref: String,
    key: String,
    value: Value,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct DeleteInput {
    expression_ref: String,
    #[serde(default)]
    location: Option<files::Location>,
    #[serde(default)]
    expected_file_revision: Option<String>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct DrawInput {
    expression_ref: String,
    scene_ref: String,
    track_id: String,
    points: Vec<DrawnPoint>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct DrawnPoint {
    time: f64,
    value: f64,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct ReenableInput {
    expression_ref: String,
    #[serde(default)]
    target: Option<String>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct TakeLaneInput {
    expression_ref: String,
    scene_ref: String,
    lane_ref: String,
    enabled: bool,
    solo: bool,
}

/// A fresh id, as New mints one (`expression:authored-<uuid>`).
fn uuid() -> Result<String, String> {
    let mut bytes = [0u8; 16];
    getrandom::fill(&mut bytes)
        .map_err(|error| format!("Cannot mint an Expression's id: {error}"))?;
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    let hex: String = bytes.iter().map(|byte| format!("{byte:02x}")).collect();
    Ok(format!(
        "{}-{}-{}-{}-{}",
        &hex[0..8],
        &hex[8..12],
        &hex[12..16],
        &hex[16..20],
        &hex[20..32]
    ))
}

/// A work's file name in the works home (field-studies-journeys reuse.ts `materialFileName`).
pub fn material_file_name(title: &str) -> String {
    let mut slug = String::new();
    for character in title.to_lowercase().chars() {
        if character.is_ascii_lowercase() || character.is_ascii_digit() {
            slug.push(character);
        } else if !slug.ends_with('-') {
            slug.push('-');
        }
    }
    let slug = slug.trim_matches('-');
    format!(
        "{}{}",
        if slug.is_empty() { "material" } else { slug },
        crate::expression_home::WORK_FILE_SUFFIX
    )
}

/// The store's answer said in words: its detail, its error or failure, else its state.
fn words(data: &Value) -> String {
    let state = data["state"].as_str().unwrap_or("refused");
    if let Some(text) = ["detail", "error", "message"]
        .iter()
        .find_map(|key| data[*key].as_str())
    {
        return format!("{text} ({state})");
    }
    match state {
        "revision_conflict" => format!(
            "The Expression moved meanwhile: it stands at revision {}, not {}",
            data["current_revision"], data["expected_revision"]
        ),
        "file_revision_conflict" => format!(
            "Its file moved meanwhile: it stands at revision {}, not {}",
            data["current_revision"], data["expected_revision"]
        ),
        _ => match data.get("failure").or_else(|| data.get("data")) {
            Some(Value::String(text)) => format!("{text} ({state})"),
            Some(other) if !other.is_null() => format!(
                "{} answered {other} ({state})",
                data["owner_operation"].as_str().unwrap_or("its owner")
            ),
            _ => format!("The expression store answered {state}"),
        },
    }
}

fn scene_of<'d>(document: &'d Document, scene_ref: &str) -> Result<&'d Scene, String> {
    document
        .scenes
        .iter()
        .find(|scene| scene.scene_ref == scene_ref)
        .ok_or_else(|| format!("{} holds no Scene {scene_ref}", document.expression_ref))
}

fn material_of(scene: &Scene) -> Result<&crate::expression_scene::Presentation, String> {
    scene.presentation.as_ref().ok_or_else(|| {
        format!(
            "The Scene {} holds no material of the field yet: compose it first",
            scene.title
        )
    })
}

/// The next take of a Scene: one past the highest it keeps, on a lane of its own.
fn next_take(scene: &Scene) -> (String, u32) {
    let prefix = format!("{}:take:", scene.scene_ref);
    let last = scene
        .studio_takes
        .iter()
        .filter_map(|take| take.take_ref.strip_prefix(&prefix)?.parse::<u32>().ok())
        .max()
        .unwrap_or(0);
    (format!("{prefix}{}", last + 1), last + 1)
}

/// One Action's run.
struct Act<'k> {
    kernel: &'k mut Kernel,
    action: &'k str,
    actor: &'static str,
    actor_kind: &'static str,
    channel: Channel,
    receipts: Vec<KernelEventReceipt>,
}

impl Act<'_> {
    /// One request of the expression store, as the frame's are run (lib.rs `KernelOp::Expression`), its receipts kept for the act.
    fn expression(&mut self, request: Request) -> Result<Value, String> {
        let outcome = self.kernel.apply(KernelOp::Expression { request })?;
        self.receipts.extend(outcome.receipts);
        match outcome.result {
            KernelOpResult::Expression { data } => Ok(data),
            _ => Err("The expression store answered another operation".into()),
        }
    }

    fn document(&self, expression_ref: &str) -> Result<&Document, String> {
        self.kernel
            .expressions
            .document(expression_ref)
            .map_err(|_| format!("{expression_ref} is not open: open it first (expressions.open)"))
    }

    /// Edit a work on the revision it stands at; its new revision.
    fn edit(&mut self, expression_ref: &str, changes: Vec<Change>) -> Result<u64, String> {
        let revision = self.document(expression_ref)?.revision;
        let data = self.expression(Request::Edit {
            expression_ref: expression_ref.to_owned(),
            expected_revision: revision,
            actor: self.actor.to_owned(),
            changes,
        })?;
        if data["state"] != "ready" {
            return Err(words(&data));
        }
        Ok(data["document"]["revision"].as_u64().unwrap_or(revision))
    }

    /// Save a work: to the file it was saved to or opened from, else into the works home, named as New names it. The file's
    /// location and revision.
    fn save(&mut self, expression_ref: &str) -> Result<Value, String> {
        let document = self.document(expression_ref)?;
        let (revision, title) = (document.revision, document.title.clone());
        let request = match self.kernel.expressions.file_of(expression_ref).cloned() {
            Some(file) => Request::Save {
                expression_ref: expression_ref.to_owned(),
                expected_revision: revision,
                location: serde_json::from_value(file["location"].clone())
                    .map_err(|error| format!("The work's file is not known: {error}"))?,
                expected_file_revision: file["revision"]
                    .as_str()
                    .ok_or("The work's file revision is not known: open it again")?
                    .to_owned(),
                actor: self.actor.to_owned(),
                actor_kind: self.actor_kind.to_owned(),
            },
            None => {
                let id = uuid()?;
                Request::SaveAs {
                    expression_ref: expression_ref.to_owned(),
                    expected_revision: revision,
                    parent: None,
                    name: material_file_name(&format!("{title} {}", &id[..8])),
                    operation_ref: format!("operation:expression:{id}"),
                    actor: self.actor.to_owned(),
                    actor_kind: self.actor_kind.to_owned(),
                }
            }
        };
        let data = self.expression(request)?;
        if data["state"] != "saved" {
            return Err(format!("{expression_ref} was not saved: {}", words(&data)));
        }
        Ok(data["file"].clone())
    }

    /// A work as an answer names it: its ref and revision, and its file where it has one.
    fn work_answer(&self, expression_ref: &str) -> Value {
        let revision = self
            .kernel
            .expressions
            .document(expression_ref)
            .map(|d| d.revision)
            .ok();
        let file = self.kernel.expressions.file_of(expression_ref);
        json!({"ref": expression_ref, "expression_ref": expression_ref, "revision": revision,
            "dirty": self.kernel.expressions.dirty(expression_ref),
            "location": file.map(|f| &f["location"]), "file_revision": file.map(|f| &f["revision"])})
    }

    fn make(&mut self, raw: &Value) -> Result<Value, String> {
        let NewInput { title } = input(self.action, raw)?;
        let id = uuid()?;
        let expression_ref = format!("expression:authored-{id}");
        let made = self.expression(Request::Create {
            expression_ref: expression_ref.clone(),
            title: title.clone(),
            actor: self.actor.to_owned(),
        })?;
        if made["state"] != "ready" {
            return Err(words(&made));
        }
        let scene_ref = format!("{expression_ref}:scene:main");
        let blank = crate::expression_studio::blank_title().to_owned();
        let composition: crate::expression_scene::Composition = serde_json::from_value(
            json!({"schema": "oi.journey-properties/v1", "description": "", "loop": true}),
        )
        .map_err(|error| error.to_string())?;
        // The frame's blank scene (model.ts `blankScene`), addressed by the Scene it becomes: what a scene added in the Clip panel
        // holds, so the work plays as soon as it is made (manual §20.14, an empty scene is still a scene).
        self.edit(
            &expression_ref,
            vec![
                Change::CompositionSet {
                    presentation: composition,
                },
                Change::SceneRename {
                    scene_ref: scene_ref.clone(),
                    title: blank.clone(),
                },
                Change::SceneMaterialSet {
                    scene_ref: scene_ref.clone(),
                    presentation: crate::expression_scene::Presentation {
                        schema: crate::expression_scene::SCHEMA.into(),
                        scene: crate::expression_studio::blank_scene(&scene_ref, &blank),
                        saved: None,
                    },
                },
            ],
        )
        .map_err(|error| {
            format!("{expression_ref} was made, but its blank Scene was refused: {error}")
        })?;
        let file = self.expression_save_as_new(&expression_ref, &title, &id)?;
        let mut answer = self.work_answer(&expression_ref);
        answer["scene_ref"] = json!(scene_ref);
        answer["title"] = json!(title);
        answer["file"] = file;
        Ok(answer)
    }

    /// New's save: into the works home, under its title and its id's first eight characters (nativeWorking.ts
    /// `saveIntoWorksHome`). A refused save leaves the work made and open, in the owner's words.
    fn expression_save_as_new(
        &mut self,
        expression_ref: &str,
        title: &str,
        id: &str,
    ) -> Result<Value, String> {
        let revision = self.document(expression_ref)?.revision;
        let data = self.expression(Request::SaveAs {
            expression_ref: expression_ref.to_owned(),
            expected_revision: revision,
            parent: None,
            name: material_file_name(&format!("{title} {}", &id[..8])),
            operation_ref: format!("operation:expression:{id}"),
            actor: self.actor.to_owned(),
            actor_kind: self.actor_kind.to_owned(),
        })?;
        if data["state"] != "saved" {
            return Err(format!(
                "{expression_ref} was made and stands open, but it was not saved into the works home: {}",
                words(&data)
            ));
        }
        Ok(data["file"].clone())
    }

    fn open(&mut self, raw: &Value) -> Result<Value, String> {
        let OpenInput {
            location,
            expected_file_revision,
        } = input(self.action, raw)?;
        let data = self.expression(Request::OpenFile {
            location,
            actor: self.actor.to_owned(),
            expected_file_revision,
        })?;
        if data["state"] != "ready" {
            return Err(words(&data));
        }
        let expression_ref = data["document"]["expression_ref"]
            .as_str()
            .ok_or("The opened file holds no Expression ref")?
            .to_owned();
        let mut answer = self.work_answer(&expression_ref);
        answer["scene_ref"] = data["document"]["selection"]["scene_ref"].clone();
        answer["title"] = data["document"]["title"].clone();
        Ok(answer)
    }

    fn studio_set(&mut self, raw: &Value) -> Result<Value, String> {
        let field = |key: &str| {
            raw[key]
                .as_str()
                .map(str::to_owned)
                .ok_or_else(|| format!("{} takes {{expression_ref, scene_ref, bind | setting, value, observed?}} or {{expression_ref, scene_ref, changes}}: {key} is missing", self.action))
        };
        let (expression_ref, scene_ref) = (field("expression_ref")?, field("scene_ref")?);
        let mut rest = raw.clone();
        let mut sample = false;
        if let Some(fields) = rest.as_object_mut() {
            fields.remove("expression_ref");
            fields.remove("scene_ref");
            sample = match fields.remove("gesture") {
                None => false,
                Some(Value::String(gesture)) if gesture == "sample" => true,
                Some(other) => {
                    return Err(format!(
                        "{} takes gesture \"sample\" alone (a drag's sample while a take records), not {other}",
                        self.action
                    ))
                }
            };
            if let Some(unknown) = fields.keys().find(|key| {
                !["bind", "setting", "value", "observed", "changes"].contains(&key.as_str())
            }) {
                return Err(format!("{} takes no {unknown}", self.action));
            }
        }
        let writes = crate::expression_studio::writes(&rest)?;
        let document = self.document(&expression_ref)?;
        let scene = scene_of(document, &scene_ref)?;
        let presentation = material_of(scene)?.clone();
        if sample {
            return self.studio_sample(&expression_ref, &scene_ref, &presentation, &writes);
        }
        // A value an enabled automation lane drives is held where it was put, off its lane, until Re-enable gives it back.
        let held: Vec<String> = writes
            .iter()
            .filter_map(|write| write.recorded())
            .filter_map(|(bind, _)| {
                crate::expression_studio::automated_target(&presentation.scene, bind)
            })
            .collect();
        let shared = document
            .presentation
            .as_ref()
            .and_then(|p| p.shared.as_ref());
        let moved = crate::expression_studio::write(&presentation.scene, shared, &writes)?;
        let mut changes = Vec::new();
        if moved.shared_moved {
            if let Some(mut composition) = document.presentation.clone() {
                composition.shared = moved.shared.clone();
                changes.push(Change::CompositionSet {
                    presentation: composition,
                });
            }
        }
        if moved.material != presentation.scene {
            changes.push(Change::SceneMaterialSet {
                scene_ref: scene_ref.clone(),
                presentation: crate::expression_scene::Presentation {
                    scene: moved.material,
                    ..presentation
                },
            });
        }
        let revision = if changes.is_empty() {
            self.document(&expression_ref)?.revision
        } else {
            self.edit(&expression_ref, changes)?
        };
        if !held.is_empty() {
            let playback = &mut self.kernel.expressions.playback;
            playback
                .held
                .entry(expression_ref.clone())
                .or_default()
                .extend(held.iter().cloned());
            playback.epoch += 1;
        }
        // A take that records on this Scene keeps each value written, at the instant the kernel stamps.
        let now = now_unix_ms();
        let mut recorded = None;
        if let Some(recording) = self
            .kernel
            .expressions
            .playback
            .recording_on(&expression_ref, &scene_ref)
        {
            for write in &writes {
                if let Some((bind, value)) = write.recorded() {
                    recording.record(bind, value, now)?;
                }
            }
            recorded =
                Some(json!({"take_ref": recording.take.take_ref, "at_s": recording.time_at(now)}));
        }
        Ok(
            json!({"ref": scene_ref, "expression_ref": expression_ref, "scene_ref": scene_ref, "revision": revision,
            "written": moved.written, "take_ref": recorded.as_ref().map(|r| &r["take_ref"]),
            "recorded_at_s": recorded.as_ref().map(|r| &r["at_s"]), "held": held}),
        )
    }

    /// A drag's samples while a take records on the Scene: each value lands in the take at the instant the kernel stamps, by the law
    /// the Scene is written with, and the Scene itself is not written (its revision stands). The drag's release writes it once, with the
    /// one receipt the person's act lays (central.rs `Receipt::of` lays none for a sample). A sample with no take recording, or of a
    /// setting, is refused in words: it would be a write no one could find.
    fn studio_sample(
        &mut self,
        expression_ref: &str,
        scene_ref: &str,
        presentation: &crate::expression_scene::Presentation,
        writes: &[crate::expression_studio::Write],
    ) -> Result<Value, String> {
        if writes.iter().any(|write| write.recorded().is_none()) {
            return Err(format!(
                "{}: a sample is a value of the field; a setting is written once, when it is chosen",
                self.action
            ));
        }
        let document = self.document(expression_ref)?;
        let revision = document.revision;
        let shared = document
            .presentation
            .as_ref()
            .and_then(|p| p.shared.as_ref());
        // Refused here as the release would be: out of range, not a number, a shared value.
        crate::expression_studio::write(&presentation.scene, shared, writes)?;
        let title = document.title.clone();
        let now = now_unix_ms();
        let Some(recording) = self
            .kernel
            .expressions
            .playback
            .recording_on(expression_ref, scene_ref)
        else {
            return Err(format!(
                "{}: a drag's samples land in a take that records, and {title} records none on this Scene. Arm it and press Play to record; a value is written when the drag is released.",
                self.action
            ));
        };
        for write in writes {
            if let Some((bind, value)) = write.recorded() {
                recording.record(bind, value, now)?;
            }
        }
        Ok(
            json!({"ref": scene_ref, "expression_ref": expression_ref, "scene_ref": scene_ref, "revision": revision,
            "sampled": writes.len(), "take_ref": recording.take.take_ref, "recorded_at_s": recording.time_at(now)}),
        )
    }

    fn scene_save(&mut self, raw: &Value) -> Result<Value, String> {
        let SceneInput {
            expression_ref,
            scene_ref,
        } = input(self.action, raw)?;
        let document = self.document(&expression_ref)?;
        let presentation = material_of(scene_of(document, &scene_ref)?)?.clone();
        if presentation.saved.as_ref() != Some(&presentation.scene) {
            self.edit(
                &expression_ref,
                vec![Change::SceneMaterialSet {
                    scene_ref: scene_ref.clone(),
                    presentation: crate::expression_scene::Presentation {
                        saved: Some(presentation.scene.clone()),
                        ..presentation
                    },
                }],
            )?;
        }
        let file = self.save(&expression_ref)?;
        let revision = self.document(&expression_ref)?.revision;
        Ok(
            json!({"ref": scene_ref, "expression_ref": expression_ref, "scene_ref": scene_ref, "revision": revision,
            "saved": "saved", "file": file}),
        )
    }

    /// The take a recording closed, laid on its Scene; `None` when nothing was written while it recorded.
    fn close(&mut self, recording: Recording, now: u64) -> Result<Option<String>, String> {
        let (expression_ref, scene_ref) = (
            recording.expression_ref.clone(),
            recording.scene_ref.clone(),
        );
        let Ok(document) = self.kernel.expressions.document(&expression_ref) else {
            return Ok(None);
        };
        let Ok(scene) = scene_of(document, &scene_ref) else {
            return Ok(None);
        };
        let material = scene
            .presentation
            .as_ref()
            .map(|p| p.scene.clone())
            .unwrap_or(Value::Null);
        let shared = document
            .presentation
            .as_ref()
            .and_then(|p| p.shared.clone());
        let take = recording.close(&material, shared.as_ref(), now);
        if take.tracks.is_empty() {
            return Ok(None);
        }
        let take_ref = take.take_ref.clone();
        self.edit(
            &expression_ref,
            vec![Change::StudioTakeSet { scene_ref, take }],
        )?;
        Ok(Some(take_ref))
    }

    fn launch(&mut self, raw: &Value) -> Result<Value, String> {
        let LaunchInput { launches, saved } = input(self.action, raw)?;
        if launches.is_empty() || launches.len() > 64 {
            return Err("A launch names one to 64 Scenes, at most one of each Expression".into());
        }
        let now = now_unix_ms();
        // Every launch is admitted before any plays: one refused moves nothing.
        let mut planned = Vec::new();
        for SceneInput {
            expression_ref,
            scene_ref,
        } in launches
        {
            if planned
                .iter()
                .any(|(r, _, _): &(String, String, u64)| *r == expression_ref)
            {
                return Err(format!("{expression_ref} is launched twice in one press"));
            }
            let document = self.document(&expression_ref)?;
            let presentation = material_of(scene_of(document, &scene_ref)?)?;
            let composition = document
                .presentation
                .as_ref()
                .and_then(|p| serde_json::to_value(p).ok());
            if composition
                .as_ref()
                .is_some_and(|c| c["mix"]["active"] == false)
            {
                return Err(format!(
                    "{}'s Activator is off, so it does not play: turn it on first",
                    document.title
                ));
            }
            if saved && presentation.saved.is_none() {
                return Err(format!(
                    "The Scene {} has no saved version to play: save it first",
                    scene_of(document, &scene_ref)?.title
                ));
            }
            let quantize = crate::expression_playback::scene_quantize(
                Some(&presentation.scene),
                composition.as_ref(),
            );
            let shared = document
                .presentation
                .as_ref()
                .and_then(|p| p.shared.as_ref());
            let playing = self
                .kernel
                .expressions
                .playback
                .launched
                .get(&expression_ref);
            let clock = playing.and_then(|playing| {
                let playing_material = self
                    .kernel
                    .expressions
                    .document(&playing.expression_ref)
                    .ok()
                    .and_then(|d| scene_of(d, &playing.scene_ref).ok())
                    .and_then(|s| s.presentation.as_ref())?;
                let time_scale = crate::expression_studio::values(&playing_material.scene, shared)
                    .get("field.params.timeScale")
                    .and_then(Value::as_f64)
                    .unwrap_or(1.0);
                Some((
                    playing.lands_at_unix_ms,
                    crate::expression_playback::Clock {
                        elapsed: (now as f64 - playing.lands_at_unix_ms as f64) / 1000.0,
                        time_scale,
                        end: playing_material.scene["duration"].as_f64(),
                    },
                ))
            });
            let lands_at = match &clock {
                Some((origin, clock)) => {
                    crate::expression_playback::lands_at(&quantize, Some(clock))
                        .map(|at| origin + (at * 1000.0).round() as u64)
                        .unwrap_or(now)
                }
                None => now,
            };
            planned.push((expression_ref, scene_ref, lands_at));
        }
        let mut launched = Vec::new();
        let mut closed = Vec::new();
        let mut recording = Vec::new();
        for (expression_ref, scene_ref, lands_at) in planned {
            // A take that recorded on this Expression ends where the new launch is pressed.
            if let Some(previous) = self
                .kernel
                .expressions
                .playback
                .recording
                .remove(&expression_ref)
            {
                if let Some(take_ref) = self.close(previous, now)? {
                    closed.push(take_ref);
                }
            }
            let entry = crate::expression_playback::Launched {
                expression_ref: expression_ref.clone(),
                scene_ref: scene_ref.clone(),
                launched_at_unix_ms: now,
                lands_at_unix_ms: lands_at,
                saved,
            };
            if self
                .kernel
                .expressions
                .playback
                .armed
                .contains(&expression_ref)
            {
                let document = self.document(&expression_ref)?;
                let (take_ref, lane) = next_take(scene_of(document, &scene_ref)?);
                recording.push(take_ref.clone());
                self.kernel.expressions.playback.recording.insert(
                    expression_ref.clone(),
                    Recording {
                        expression_ref: expression_ref.clone(),
                        scene_ref: scene_ref.clone(),
                        take: StudioTake {
                            take_ref,
                            lane,
                            start_s: Finite(0.0),
                            seconds: Finite(0.0),
                            tracks: Vec::new(),
                            kept: None,
                        },
                        started_at_unix_ms: lands_at,
                    },
                );
            }
            self.kernel
                .expressions
                .playback
                .launched
                .insert(expression_ref, entry.clone());
            launched.push(entry);
        }
        self.kernel.expressions.playback.epoch += 1;
        let first = &launched[0];
        Ok(
            json!({"ref": first.scene_ref, "expression_ref": first.expression_ref, "scene_ref": first.scene_ref,
            "launched": launched, "take_ref": recording.first(), "recording": recording, "closed": closed,
            "epoch": self.kernel.expressions.playback.epoch, "state": self.kernel.expressions.playback.state()}),
        )
    }

    fn stop(&mut self, raw: &Value) -> Result<Value, String> {
        let StopInput { expression_ref } = input(self.action, raw)?;
        let now = now_unix_ms();
        let playback = &self.kernel.expressions.playback;
        let targets: Vec<String> = match &expression_ref {
            Some(reference) => {
                self.document(reference)?;
                vec![reference.clone()]
            }
            None => playback
                .launched
                .keys()
                .chain(playback.recording.keys())
                .cloned()
                .collect::<std::collections::BTreeSet<_>>()
                .into_iter()
                .collect(),
        };
        let mut stopped = Vec::new();
        let mut takes = Vec::new();
        for target in &targets {
            if self
                .kernel
                .expressions
                .playback
                .launched
                .remove(target)
                .is_some()
            {
                stopped.push(target.clone());
            }
            if let Some(recording) = self.kernel.expressions.playback.recording.remove(target) {
                if let Some(take_ref) = self.close(recording, now)? {
                    takes.push(take_ref);
                }
            }
        }
        self.kernel.expressions.playback.epoch += 1;
        let reference = expression_ref
            .clone()
            .unwrap_or_else(|| "expressions:all".into());
        Ok(
            json!({"ref": reference, "expression_ref": expression_ref, "stopped": stopped, "take_ref": takes.first(),
            "takes": takes, "epoch": self.kernel.expressions.playback.epoch, "state": self.kernel.expressions.playback.state()}),
        )
    }

    fn arm(&mut self, raw: &Value) -> Result<Value, String> {
        let ArmInput { expression_ref, on } = input(self.action, raw)?;
        self.document(&expression_ref)?;
        let mut closed = None;
        if on {
            self.kernel
                .expressions
                .playback
                .armed
                .insert(expression_ref.clone());
        } else {
            self.kernel
                .expressions
                .playback
                .armed
                .remove(&expression_ref);
            if let Some(recording) = self
                .kernel
                .expressions
                .playback
                .recording
                .remove(&expression_ref)
            {
                closed = self.close(recording, now_unix_ms())?;
            }
        }
        self.kernel.expressions.playback.epoch += 1;
        Ok(
            json!({"ref": expression_ref, "expression_ref": expression_ref, "armed": on, "take_ref": closed,
            "epoch": self.kernel.expressions.playback.epoch}),
        )
    }

    fn keep(&mut self, raw: &Value) -> Result<Value, String> {
        let KeepInput {
            expression_ref,
            scene_ref,
            take_ref,
            from_s,
            to_s,
        } = input(self.action, raw)?;
        let document = self.document(&expression_ref)?;
        let scene = scene_of(document, &scene_ref)?;
        if let Some(take) = scene
            .studio_takes
            .iter()
            .find(|take| take.take_ref == take_ref)
        {
            let presentation = material_of(scene)?.clone();
            let from = from_s.unwrap_or(take.start_s.0);
            let to = to_s.unwrap_or(take.start_s.0 + take.seconds.0);
            let (material, before) =
                crate::expression_studio::keep(&presentation.scene, take, from, to)?;
            let mut kept = take.clone();
            kept.kept = Some(Kept {
                from_s: Finite(from),
                to_s: Finite(to),
                before: Some(before),
            });
            let revision = self.edit(
                &expression_ref,
                vec![
                    Change::SceneMaterialSet {
                        scene_ref: scene_ref.clone(),
                        presentation: crate::expression_scene::Presentation {
                            scene: material,
                            ..presentation
                        },
                    },
                    Change::StudioTakeSet {
                        scene_ref: scene_ref.clone(),
                        take: kept,
                    },
                ],
            )?;
            return Ok(
                json!({"ref": take_ref, "expression_ref": expression_ref, "scene_ref": scene_ref, "take_ref": take_ref,
                "kind": "studio", "kept": {"from_s": from, "to_s": to}, "revision": revision}),
            );
        }
        if let Some(performance) = &scene.performance {
            if let Some(record) = performance
                .torus_takes
                .iter()
                .find(|record| record.take.take_ref == take_ref)
            {
                let rate = f64::from(performance.sample_rate.max(1));
                let lane_ref = performance
                    .layers
                    .get(usize::from(record.layer))
                    .map(|layer| layer.layer_ref.clone())
                    .ok_or("The Torus take lies on no lane of its performance")?;
                let start =
                    from_s.map_or(record.at_sample.0, |s| (s * rate).round().max(0.0) as u64);
                let end = match to_s {
                    Some(s) => (s * rate).round().max(0.0) as u64,
                    None => record.end()?,
                };
                let comp = crate::expression_performance::torus::TakeComp {
                    lane_ref,
                    start_sample: crate::expression_performance::Counter(start),
                    end_sample: crate::expression_performance::Counter(end),
                };
                let revision = self.edit(
                    &expression_ref,
                    vec![Change::ScenePerformanceEdit {
                        scene_ref: scene_ref.clone(),
                        operations: vec![
                            crate::expression_performance::PerformanceOperation::CompTorusTake {
                                comp,
                            },
                        ],
                    }],
                )?;
                return Ok(
                    json!({"ref": take_ref, "expression_ref": expression_ref, "scene_ref": scene_ref, "take_ref": take_ref,
                    "kind": "torus", "kept": {"from_s": start as f64 / rate, "to_s": end as f64 / rate}, "revision": revision}),
                );
            }
        }
        if self
            .kernel
            .expressions
            .playback
            .recording
            .get(&expression_ref)
            .is_some_and(|recording| recording.take.take_ref == take_ref)
        {
            return Err(format!(
                "The take {take_ref} is still recording: press Stop to finish it, then keep it"
            ));
        }
        Err(format!(
            "The Scene {} keeps no take {take_ref}",
            scene.title
        ))
    }

    fn save_work(&mut self, raw: &Value) -> Result<Value, String> {
        let WorkInput { expression_ref } = input(self.action, raw)?;
        let file = self.save(&expression_ref)?;
        let mut answer = self.work_answer(&expression_ref);
        answer["file"] = file;
        Ok(answer)
    }

    fn capture(&mut self, raw: &Value) -> Result<Value, String> {
        let SceneInput {
            expression_ref,
            scene_ref,
        } = input(self.action, raw)?;
        if self
            .kernel
            .expressions
            .playback
            .recording
            .contains_key(&expression_ref)
        {
            return Err("A take is recording. Press Stop to finish it.".into());
        }
        let document = self.document(&expression_ref)?;
        if document.scenes.len() >= 64 {
            return Err("An expression can contain up to 64 scenes.".into());
        }
        let scene = scene_of(document, &scene_ref)?;
        let presentation = material_of(scene)?.clone();
        let members = scene.entity_refs.clone();
        let title: String = format!("{} / next", scene.title)
            .chars()
            .take(160)
            .collect();
        let next_ref = format!("{expression_ref}:scene:{}", uuid()?);
        let mut order: Vec<String> = document
            .scenes
            .iter()
            .map(|s| s.scene_ref.clone())
            .collect();
        let at = order
            .iter()
            .position(|r| *r == scene_ref)
            .unwrap_or(order.len() - 1);
        order.insert(at + 1, next_ref.clone());
        let mut next = presentation.scene.clone();
        next["id"] = json!(next_ref);
        next["name"] = json!(title);
        let revision = self.edit(
            &expression_ref,
            vec![
                Change::SceneMaterialSet {
                    scene_ref: scene_ref.clone(),
                    presentation: crate::expression_scene::Presentation {
                        saved: Some(presentation.scene.clone()),
                        ..presentation.clone()
                    },
                },
                Change::SceneCreate {
                    scene_ref: next_ref.clone(),
                    title: title.clone(),
                },
                Change::SceneCompose {
                    scene_ref: next_ref.clone(),
                    entity_refs: members,
                },
                Change::SceneMaterialSet {
                    scene_ref: next_ref.clone(),
                    presentation: crate::expression_scene::Presentation {
                        schema: presentation.schema.clone(),
                        scene: next,
                        saved: None,
                    },
                },
                Change::SceneReorder { scene_refs: order },
                Change::Focus {
                    scene_ref: next_ref.clone(),
                    entity_ref: None,
                },
            ],
        )?;
        Ok(
            json!({"ref": scene_ref, "expression_ref": expression_ref, "scene_ref": scene_ref, "saved": "saved",
            "next_scene_ref": next_ref, "next_title": title, "revision": revision}),
        )
    }

    fn mix(&mut self, raw: &Value) -> Result<Value, String> {
        let MixInput {
            expression_ref,
            key,
            value,
        } = input(self.action, raw)?;
        if !["active", "solo", "level", "main"].contains(&key.as_str()) {
            return Err(format!(
                "The Expression's mixer has no {key}: it has active, solo, level and main"
            ));
        }
        let document = self.document(&expression_ref)?;
        let mut composition = match document.presentation.clone() {
            Some(composition) => composition,
            None => serde_json::from_value(
                json!({"schema": "oi.journey-properties/v1", "description": "", "loop": true}),
            )
            .map_err(|error| error.to_string())?,
        };
        let mut mix = composition.mix.take().unwrap_or_else(|| json!({}));
        if !mix.is_object() {
            mix = json!({});
        }
        mix[key.as_str()] = value;
        composition.mix = Some(mix.clone());
        let revision = self.edit(
            &expression_ref,
            vec![Change::CompositionSet {
                presentation: composition,
            }],
        )?;
        Ok(
            json!({"ref": expression_ref, "expression_ref": expression_ref, "mix": mix, "revision": revision}),
        )
    }

    fn duplicate(&mut self, raw: &Value) -> Result<Value, String> {
        let WorkInput { expression_ref } = input(self.action, raw)?;
        let source = self.document(&expression_ref)?;
        let (revision, base) = (source.revision, source.title.clone());
        let id = uuid()?;
        let copy = format!("expression:authored-{id}");
        let forked = self.expression(Request::Fork {
            expression_ref: expression_ref.clone(),
            expected_revision: revision,
            new_expression_ref: copy.clone(),
            actor: self.actor.to_owned(),
        })?;
        if forked["state"] != "ready" {
            return Err(words(&forked));
        }
        // A title the works do not use yet, as the browser names a second (nativeExpressionCommands.ts `freshTitle`).
        let listed = self.expression(Request::List)?;
        let taken: std::collections::BTreeSet<&str> = listed["expressions"]
            .as_array()
            .map(|rows| {
                rows.iter()
                    .filter_map(|row| row["title"].as_str())
                    .collect()
            })
            .unwrap_or_default();
        let title = if taken.contains(base.as_str()) {
            (2..)
                .map(|n| format!("{base} {n}"))
                .find(|title| !taken.contains(title.as_str()))
                .unwrap_or(base.clone())
        } else {
            base.clone()
        };
        if title != base {
            self.edit(
                &copy,
                vec![Change::Rename {
                    title: title.clone(),
                }],
            )?;
        }
        let file = self.expression_save_as_new(&copy, &title, &id)?;
        let mut answer = self.work_answer(&copy);
        answer["source_ref"] = json!(expression_ref);
        answer["title"] = json!(title);
        answer["file"] = file;
        Ok(answer)
    }

    fn delete(&mut self, raw: &Value) -> Result<Value, String> {
        let DeleteInput {
            expression_ref,
            location,
            expected_file_revision,
        } = input(self.action, raw)?;
        let data = self.expression(Request::Delete {
            expression_ref: expression_ref.clone(),
            actor: self.actor.to_owned(),
            actor_kind: self.actor_kind.to_owned(),
            location,
            expected_file_revision,
            channel: self.channel,
        })?;
        if data["state"] != "deleted" {
            return Err(words(&data));
        }
        Ok(
            json!({"ref": expression_ref, "expression_ref": expression_ref, "location": data["location"],
            "file_revision": data["revision"], "recover": data["recover"], "title": data["title"]}),
        )
    }

    fn scene_edit(&mut self, raw: &Value) -> Result<Value, String> {
        let fields = raw
            .as_object()
            .ok_or_else(|| format!("{} takes {{expression_ref, operation, …}}", self.action))?;
        if let Some(unknown) = fields
            .keys()
            .find(|key| !timeline::KEYS.contains(&key.as_str()))
        {
            return Err(format!("{} takes no {unknown}", self.action));
        }
        let expression_ref = raw["expression_ref"]
            .as_str()
            .ok_or_else(|| {
                format!(
                    "{} names the Expression it edits (expression_ref)",
                    self.action
                )
            })?
            .to_owned();
        let operation = raw["operation"]
            .as_str()
            .ok_or_else(|| format!("{} names its operation", self.action))?
            .to_owned();
        let document = self.document(&expression_ref)?;
        if let Some(expected) = raw.get("expected_revision").filter(|v| !v.is_null()) {
            let expected = expected
                .as_u64()
                .ok_or("expected_revision is a revision number")?;
            if expected != document.revision {
                return Err(format!(
                    "The Expression moved meanwhile: it stands at revision {}, not {expected}. Nothing was changed",
                    document.revision
                ));
            }
        }
        let plan = timeline::plan(document, &operation, raw)?;
        let revision = if plan.changes.is_empty() {
            document.revision
        } else {
            self.edit(&expression_ref, plan.changes)?
        };
        let reference = plan
            .created
            .clone()
            .or_else(|| raw["scene_ref"].as_str().map(str::to_owned))
            .unwrap_or_else(|| expression_ref.clone());
        Ok(
            json!({"ref": reference, "expression_ref": expression_ref, "operation": operation, "label": plan.label,
            "revision": revision, "affected_scene_refs": plan.affected, "created_scene_ref": plan.created,
            "selected_scene_ref": plan.selected, "note": plan.note}),
        )
    }

    fn lane_draw(&mut self, raw: &Value) -> Result<Value, String> {
        let DrawInput {
            expression_ref,
            scene_ref,
            track_id,
            points,
        } = input(self.action, raw)?;
        let document = self.document(&expression_ref)?;
        let scene = scene_of(document, &scene_ref)?;
        let presentation = material_of(scene)?.clone();
        if presentation.scene["clip"]["locked"] == true {
            return Err("This Scene is locked: unlock it to change it".into());
        }
        let shared = document
            .presentation
            .as_ref()
            .and_then(|p| p.shared.as_ref());
        let drawn: Vec<(f64, f64)> = points.iter().map(|p| (p.time, p.value)).collect();
        let material =
            crate::expression_studio::draw(&presentation.scene, shared, &track_id, &drawn)?;
        let revision = self.edit(
            &expression_ref,
            vec![Change::SceneMaterialSet {
                scene_ref: scene_ref.clone(),
                presentation: crate::expression_scene::Presentation {
                    scene: material,
                    ..presentation
                },
            }],
        )?;
        Ok(
            json!({"ref": scene_ref, "expression_ref": expression_ref, "scene_ref": scene_ref, "track_id": track_id,
            "points": drawn.len(), "revision": revision}),
        )
    }

    fn reenable(&mut self, raw: &Value) -> Result<Value, String> {
        let ReenableInput {
            expression_ref,
            target,
        } = input(self.action, raw)?;
        self.document(&expression_ref)?;
        let playback = &mut self.kernel.expressions.playback;
        let not_held = || match &target {
            Some(target) => format!("{target} is not held off its automation."),
            None => "No value of this Expression is held off its automation.".to_owned(),
        };
        let held = playback
            .held
            .get_mut(&expression_ref)
            .ok_or_else(not_held)?;
        let released: Vec<String> = match &target {
            Some(target) if held.remove(target) => vec![target.clone()],
            Some(_) => return Err(not_held()),
            None => std::mem::take(held).into_iter().collect(),
        };
        if held.is_empty() {
            playback.held.remove(&expression_ref);
        }
        playback.epoch += 1;
        Ok(
            json!({"ref": expression_ref, "expression_ref": expression_ref, "released": released,
            "epoch": playback.epoch}),
        )
    }

    fn unkeep(&mut self, raw: &Value) -> Result<Value, String> {
        let KeepInput {
            expression_ref,
            scene_ref,
            take_ref,
            from_s,
            to_s,
        } = input(self.action, raw)?;
        let document = self.document(&expression_ref)?;
        let scene = scene_of(document, &scene_ref)?;
        if let Some(take) = scene
            .studio_takes
            .iter()
            .find(|take| take.take_ref == take_ref)
        {
            let kept = take.kept.as_ref().ok_or_else(|| {
                format!(
                    "Take {} is not kept, so there is nothing to take back",
                    take.lane
                )
            })?;
            let presentation = material_of(scene)?.clone();
            let material = crate::expression_studio::unkeep(&presentation.scene, kept)?;
            let unkept = json!({"from_s": kept.from_s.0, "to_s": kept.to_s.0});
            let mut back = take.clone();
            back.kept = None;
            let revision = self.edit(
                &expression_ref,
                vec![
                    Change::SceneMaterialSet {
                        scene_ref: scene_ref.clone(),
                        presentation: crate::expression_scene::Presentation {
                            scene: material,
                            ..presentation
                        },
                    },
                    Change::StudioTakeSet {
                        scene_ref: scene_ref.clone(),
                        take: back,
                    },
                ],
            )?;
            return Ok(
                json!({"ref": take_ref, "expression_ref": expression_ref, "scene_ref": scene_ref, "take_ref": take_ref,
                "kind": "studio", "unkept": unkept, "revision": revision}),
            );
        }
        if let Some(performance) = &scene.performance {
            if let Some(record) = performance
                .torus_takes
                .iter()
                .find(|record| record.take.take_ref == take_ref)
            {
                let rate = f64::from(performance.sample_rate.max(1));
                let lane_ref = performance
                    .layers
                    .get(usize::from(record.layer))
                    .map(|layer| layer.layer_ref.clone())
                    .ok_or("The Torus take lies on no lane of its performance")?;
                let start =
                    from_s.map_or(record.at_sample.0, |s| (s * rate).round().max(0.0) as u64);
                let end = match to_s {
                    Some(s) => (s * rate).round().max(0.0) as u64,
                    None => record.end()?,
                };
                let comp = crate::expression_performance::torus::TakeComp {
                    lane_ref,
                    start_sample: crate::expression_performance::Counter(start),
                    end_sample: crate::expression_performance::Counter(end),
                };
                let revision = self.edit(
                    &expression_ref,
                    vec![Change::ScenePerformanceEdit {
                        scene_ref: scene_ref.clone(),
                        operations: vec![
                            crate::expression_performance::PerformanceOperation::UncompTorusTake {
                                comp,
                            },
                        ],
                    }],
                )?;
                return Ok(
                    json!({"ref": take_ref, "expression_ref": expression_ref, "scene_ref": scene_ref, "take_ref": take_ref,
                    "kind": "torus", "unkept": {"from_s": start as f64 / rate, "to_s": end as f64 / rate}, "revision": revision}),
                );
            }
        }
        Err(format!(
            "The Scene {} keeps no take {take_ref}",
            scene.title
        ))
    }

    fn take_lane(&mut self, raw: &Value) -> Result<Value, String> {
        let TakeLaneInput {
            expression_ref,
            scene_ref,
            lane_ref,
            enabled,
            solo,
        } = input(self.action, raw)?;
        let document = self.document(&expression_ref)?;
        let scene = scene_of(document, &scene_ref)?;
        let performance = scene.performance.as_ref().ok_or_else(|| {
            format!(
                "The Scene {} holds no performance, so it has no take lanes",
                scene.title
            )
        })?;
        let (index, layer) = performance
            .layers
            .iter()
            .enumerate()
            .find(|(_, layer)| layer.layer_ref == lane_ref)
            .ok_or_else(|| format!("The Scene {} has no take lane {lane_ref}", scene.title))?;
        let index = u16::try_from(index)
            .map_err(|_| "The take lane lies past the lanes a performance holds")?;
        let mut layer = layer.clone();
        layer.enabled = enabled;
        layer.solo = solo;
        let revision = self.edit(
            &expression_ref,
            vec![Change::ScenePerformanceEdit {
                scene_ref: scene_ref.clone(),
                operations: vec![
                    crate::expression_performance::PerformanceOperation::LayerSet { index, layer },
                ],
            }],
        )?;
        Ok(
            json!({"ref": lane_ref, "expression_ref": expression_ref, "scene_ref": scene_ref, "lane_ref": lane_ref,
            "enabled": enabled, "solo": solo, "revision": revision}),
        )
    }
}

/// `expressions.scene.edit`: one edit of an Expression's Scenes, as Session and Arrangement make it (packages/expressions-boundary
/// sceneEdits.ts `prepareNativeSceneEdit`, whose operations the shell sent before this Action carried them), by the field's own
/// timeline law (field-studies-journeys sceneWorkflow.ts: insert, overwrite, retime, trim, roll, slip, slide, split; journeyMarkers.ts
/// `dragLoopEdge`). It is planned on the document as it stands and laid as one edit, so a refusal moves nothing.
mod timeline {
    use super::{uuid, Change, Document};
    use serde_json::{json, Value};
    use std::collections::{BTreeMap, BTreeSet};

    /// The inputs the Action takes, beside the Expression it edits.
    pub const KEYS: [&str; 15] = [
        "expression_ref",
        "operation",
        "scene_ref",
        "expected_revision",
        "title",
        "description",
        "colour",
        "loop",
        "edge",
        "at",
        "seconds",
        "mode",
        "to_ref",
        "scene_refs",
        "after",
    ];
    const DURATION_MIN: f64 = 1.0;
    const DURATION_MAX: f64 = 3600.0;
    const SCENES: usize = 64;
    const LOOP_MIN_SECONDS: f64 = 0.05;
    const LASTS: &str = "The cut stops here: a scene lasts 1 to 3600 seconds.";

    /// What the edit lays, and how it answers.
    pub struct Plan {
        pub changes: Vec<Change>,
        pub label: String,
        pub affected: Vec<String>,
        pub created: Option<String>,
        pub selected: String,
        pub note: Option<String>,
    }

    /// The Scenes as the edit works them: their order, each one's material, and what was made or taken away.
    struct Work<'d> {
        document: &'d Document,
        order: Vec<String>,
        materials: BTreeMap<String, Value>,
        made: Vec<(String, String, Vec<String>)>,
        removed: BTreeSet<String>,
        selected: String,
    }

    /// JavaScript's `x || 0` on a number: zero for -0 and NaN.
    fn or_zero(value: f64) -> f64 {
        if value == 0.0 || value.is_nan() {
            0.0
        } else {
            value
        }
    }

    fn title(value: &Value) -> Result<String, String> {
        match value.as_str().map(str::trim) {
            Some(text) if !text.is_empty() && text.chars().count() <= 160 => Ok(text.to_owned()),
            _ => Err("Give this Scene a name of 1–160 characters".into()),
        }
    }

    fn finite(value: &Value, words: &str) -> Result<f64, String> {
        value
            .as_f64()
            .filter(|n| n.is_finite())
            .ok_or_else(|| words.to_owned())
    }

    impl<'d> Work<'d> {
        fn of(document: &'d Document) -> Self {
            let selected = document
                .scenes
                .iter()
                .find(|s| s.scene_ref == document.selection.scene_ref)
                .or(document.scenes.first())
                .map(|s| s.scene_ref.clone())
                .unwrap_or_default();
            Work {
                document,
                order: document
                    .scenes
                    .iter()
                    .map(|s| s.scene_ref.clone())
                    .collect(),
                materials: document
                    .scenes
                    .iter()
                    .filter_map(|s| {
                        Some((s.scene_ref.clone(), s.presentation.as_ref()?.scene.clone()))
                    })
                    .collect(),
                made: Vec::new(),
                removed: BTreeSet::new(),
                selected,
            }
        }

        /// One exact Scene of the Expression, by its ref.
        fn index(&self, scene_ref: &str) -> Result<usize, String> {
            self.order
                .iter()
                .position(|r| r == scene_ref)
                .ok_or_else(|| "Choose one exact Scene ref of this Expression".to_owned())
        }

        fn scene_ref(&self, raw: &Value) -> Result<String, String> {
            let reference = raw["scene_ref"]
                .as_str()
                .ok_or("Name the Scene the edit acts on (scene_ref)")?;
            self.index(reference)?;
            Ok(reference.to_owned())
        }

        fn material(&self, scene_ref: &str) -> Result<&Value, String> {
            self.materials.get(scene_ref).ok_or_else(|| {
                "This operation needs authored Scene material; compatibility defaults were not saved as authored work".to_owned()
            })
        }

        fn material_mut(&mut self, scene_ref: &str) -> &mut Value {
            self.materials
                .entry(scene_ref.to_owned())
                .or_insert_with(|| json!({}))
        }

        /// sceneEdits.ts `changing`: each Scene whose own material a cut changes needs its authored material and must not be locked.
        fn changing(&self, refs: &[&str]) -> Result<(), String> {
            for scene_ref in refs {
                if self.material(scene_ref)?["clip"]["locked"] == true {
                    return Err("This Scene is locked: unlock it to change it".into());
                }
            }
            Ok(())
        }

        fn duration(&self, scene_ref: &str) -> f64 {
            self.materials
                .get(scene_ref)
                .and_then(|m| m["duration"].as_f64())
                .unwrap_or(0.0)
        }

        fn entry(&self, scene_ref: &str) -> f64 {
            self.materials
                .get(scene_ref)
                .and_then(|m| m["entryOffset"].as_f64())
                .unwrap_or(0.0)
        }

        fn set(&mut self, scene_ref: &str, key: &str, value: f64) {
            self.material_mut(scene_ref)[key] = json!(value);
        }

        /// sceneWorkflow.ts: an entry of 0 is absent.
        fn set_entry(&mut self, scene_ref: &str, at: f64) {
            let material = self.material_mut(scene_ref);
            if at == 0.0 {
                if let Some(fields) = material.as_object_mut() {
                    fields.remove("entryOffset");
                }
            } else {
                material["entryOffset"] = json!(at);
            }
        }

        fn label(&self, scene_ref: &str) -> String {
            self.materials
                .get(scene_ref)
                .and_then(|m| m["name"].as_str())
                .map(str::trim)
                .filter(|name| !name.is_empty())
                .unwrap_or("This scene")
                .to_owned()
        }

        /// sceneWorkflow.ts `seamLimits`: how far the seam between `left` and `right` may move, and why it stops there.
        fn seam(&self, left: &str, right: &str) -> (f64, f64, String, String) {
            let (l, r) = (self.duration(left), self.duration(right));
            let (range_min, range_max) = (
                (DURATION_MIN - l).max(r - DURATION_MAX),
                (DURATION_MAX - l).min(r - DURATION_MIN),
            );
            let entry = self.entry(right);
            let (from_content, to_content) = (-entry, DURATION_MAX - entry);
            let min_why = if from_content >= range_min {
                format!(
                    "The cut stops here: {} has no content before its own start.",
                    self.label(right)
                )
            } else {
                LASTS.to_owned()
            };
            let max_why = if to_content < range_max {
                format!(
                    "The cut stops here: {} can start at most 3600 seconds into its own content.",
                    self.label(right)
                )
            } else {
                LASTS.to_owned()
            };
            (
                or_zero(range_min.max(from_content)),
                or_zero(range_max.min(to_content)),
                min_why,
                max_why,
            )
        }

        /// sceneWorkflow.ts `cutWithin`: the seconds a seam moves inside its limits, and the words of the limit it stopped at.
        fn within(limits: (f64, f64, String, String), seconds: f64) -> (f64, Option<String>) {
            let (min, max, min_why, max_why) = limits;
            let why = if seconds < min {
                Some(min_why)
            } else if seconds > max {
                Some(max_why)
            } else {
                None
            };
            (or_zero(max.min(min.max(seconds))), why)
        }

        /// A fresh Scene of this Expression, laid at `at` in the order.
        fn make(
            &mut self,
            at: usize,
            title: String,
            members: Vec<String>,
            mut material: Value,
        ) -> Result<String, String> {
            if self.order.len() >= SCENES {
                return Err("An expression can contain up to 64 scenes.".into());
            }
            let scene_ref = format!("{}:scene:{}", self.document.expression_ref, uuid()?);
            material["id"] = json!(scene_ref);
            material["name"] = json!(title);
            self.order.insert(at, scene_ref.clone());
            self.materials.insert(scene_ref.clone(), material);
            self.made.push((scene_ref.clone(), title, members));
            Ok(scene_ref)
        }

        fn remove(&mut self, scene_ref: &str) -> Result<usize, String> {
            let at = self.index(scene_ref)?;
            self.order.remove(at);
            self.removed.insert(scene_ref.to_owned());
            Ok(at)
        }

        /// The edit as the store's changes: what is made, the materials that moved, the selection, what leaves, then the order.
        fn changes(
            self,
            composition: Option<Value>,
            rename: Option<String>,
        ) -> Result<(Vec<Change>, String), String> {
            let mut changes = Vec::new();
            if let Some(title) = rename {
                changes.push(Change::Rename { title });
            }
            if let Some(composition) = composition {
                changes.push(Change::CompositionSet {
                    presentation: serde_json::from_value(composition)
                        .map_err(|error| error.to_string())?,
                });
            }
            let schema = crate::expression_scene::SCHEMA.to_owned();
            for (scene_ref, title, members) in &self.made {
                changes.push(Change::SceneCreate {
                    scene_ref: scene_ref.clone(),
                    title: title.clone(),
                });
                if !members.is_empty() {
                    changes.push(Change::SceneCompose {
                        scene_ref: scene_ref.clone(),
                        entity_refs: members.clone(),
                    });
                }
                changes.push(Change::SceneMaterialSet {
                    scene_ref: scene_ref.clone(),
                    presentation: crate::expression_scene::Presentation {
                        schema: schema.clone(),
                        scene: self.materials[scene_ref].clone(),
                        saved: None,
                    },
                });
            }
            for scene in &self.document.scenes {
                if self.removed.contains(&scene.scene_ref) {
                    continue;
                }
                let (Some(presentation), Some(material)) =
                    (&scene.presentation, self.materials.get(&scene.scene_ref))
                else {
                    continue;
                };
                if *material != presentation.scene {
                    changes.push(Change::SceneMaterialSet {
                        scene_ref: scene.scene_ref.clone(),
                        presentation: crate::expression_scene::Presentation {
                            scene: material.clone(),
                            ..presentation.clone()
                        },
                    });
                }
            }
            if self.selected != self.document.selection.scene_ref {
                changes.push(Change::Focus {
                    scene_ref: self.selected.clone(),
                    entity_ref: None,
                });
            }
            for scene_ref in &self.removed {
                changes.push(Change::SceneRemove {
                    scene_ref: scene_ref.clone(),
                });
            }
            let before: Vec<&String> = self
                .document
                .scenes
                .iter()
                .map(|s| &s.scene_ref)
                .filter(|r| !self.removed.contains(*r))
                .collect();
            if !self.made.is_empty()
                || before.len() != self.order.len()
                || before.iter().zip(&self.order).any(|(a, b)| *a != b)
            {
                changes.push(Change::SceneReorder {
                    scene_refs: self.order.clone(),
                });
            }
            Ok((changes, self.selected))
        }
    }

    /// The Expression's properties as its document keeps them, or a blank composition.
    fn composition(document: &Document) -> Result<Value, String> {
        match &document.presentation {
            Some(composition) => {
                serde_json::to_value(composition).map_err(|error| error.to_string())
            }
            None => {
                Ok(json!({"schema": "oi.journey-properties/v1", "description": "", "loop": true}))
            }
        }
    }

    /// The edit planned on the document as it stands.
    pub fn plan(document: &Document, operation: &str, raw: &Value) -> Result<Plan, String> {
        let mut work = Work::of(document);
        let mut affected: Vec<String> = Vec::new();
        let mut created = None;
        let mut note = None;
        let mut rename = None;
        let mut properties = None;
        let label = match operation {
            "expression-title" => {
                rename = Some(title(&raw["title"])?);
                "Rename Expression"
            }
            "expression-description" => {
                let text = raw["description"]
                    .as_str()
                    .filter(|text| text.chars().count() <= 5000)
                    .ok_or("The description must be text of at most 5000 characters")?;
                let mut composition = composition(document)?;
                composition["description"] = json!(text);
                properties = Some(composition);
                "Set Expression description"
            }
            "colour" => {
                let mut composition = composition(document)?;
                match &raw["colour"] {
                    Value::Null => {
                        if let Some(fields) = composition.as_object_mut() {
                            fields.remove("colour");
                        }
                    }
                    Value::String(colour)
                        if colour.len() == 7 && colour.starts_with('#') && colour[1..].chars().all(|c| c.is_ascii_hexdigit()) =>
                    {
                        composition["colour"] = json!(colour);
                    }
                    _ => return Err("An Expression's colour is a palette colour (#RRGGBB).".into()),
                }
                properties = Some(composition);
                "Set the Expression's colour"
            }
            "loop" => {
                let on = raw["loop"].as_bool().ok_or("Loop takes a yes or no value")?;
                let mut composition = composition(document)?;
                composition["loop"] = json!(on);
                properties = Some(composition);
                "Set saved sequence loop"
            }
            "loop-edge" => {
                let edge = raw["edge"].as_str().filter(|edge| *edge == "from" || *edge == "to");
                let (Some(edge), Some(at)) = (edge, raw["at"].as_f64().filter(|n| n.is_finite())) else {
                    return Err("A loop edge is its in or out, set at a second of the sequence".into());
                };
                // journeyMarkers.ts `dragLoopEdge`, inside the working sequence; with no region kept, the brace is the whole sequence's.
                let total: f64 = work.order.iter().map(|r| work.duration(r)).sum();
                let mut composition = composition(document)?;
                let region = &composition["loopRegion"];
                let (from, to) = (region["from"].as_f64().unwrap_or(0.0), region["to"].as_f64().unwrap_or(total));
                let t = ((at * 100.0).round() / 100.0).max(0.0).min(total.max(0.0));
                let region = if edge == "from" {
                    json!({"from": t.min(to - LOOP_MIN_SECONDS), "to": to})
                } else {
                    json!({"from": from, "to": t.max(from + LOOP_MIN_SECONDS)})
                };
                composition["loopRegion"] = region;
                properties = Some(composition);
                if edge == "from" {
                    "Set loop in"
                } else {
                    "Set loop out"
                }
            }
            "reorder" => {
                let refs: Vec<String> = raw["scene_refs"]
                    .as_array()
                    .map(|refs| refs.iter().filter_map(|r| r.as_str().map(str::to_owned)).collect())
                    .unwrap_or_default();
                let mut sorted = refs.clone();
                sorted.sort();
                sorted.dedup();
                let mut known = work.order.clone();
                known.sort();
                if refs.len() != work.order.len() || sorted != known {
                    return Err("Scene order must contain every Scene ref of the Expression exactly once".into());
                }
                work.order = refs.clone();
                affected = refs;
                "Reorder Scenes"
            }
            "add" => {
                let name = match raw.get("title").filter(|t| !t.is_null()) {
                    Some(given) => title(given)?,
                    None => crate::expression_studio::blank_title().to_owned(),
                };
                let anchor = match raw["after"].as_str() {
                    Some(after) => work.index(after)?,
                    None => work.index(&work.selected.clone()).unwrap_or(work.order.len().saturating_sub(1)),
                };
                let made = work.make(anchor + 1, name.clone(), Vec::new(), crate::expression_studio::blank_scene("", &name))?;
                work.selected = made.clone();
                affected.push(made.clone());
                created = Some(made);
                "Add Scene"
            }
            "duplicate" => {
                let source = work.scene_ref(raw)?;
                let scene = document.scenes.iter().find(|s| s.scene_ref == source).ok_or("Choose one exact Scene ref of this Expression")?;
                if scene.body.is_some() || !scene.triggers.is_empty() || scene.performance.is_some() {
                    return Err("A duplicate copies the Scene whole, and its body, triggers or performance cannot be copied with it: nothing was copied".into());
                }
                let material = work.material(&source)?.clone();
                let name = match raw.get("title").filter(|t| !t.is_null()) {
                    Some(given) => title(given)?,
                    None => format!("{} / next", material["name"].as_str().unwrap_or(&scene.title)).chars().take(160).collect(),
                };
                let at = work.index(&source)? + 1;
                let made = work.make(at, name, scene.entity_refs.clone(), material)?;
                work.selected = made.clone();
                affected = vec![source, made.clone()];
                created = Some(made);
                "Duplicate Scene"
            }
            "remove" => {
                let scene_ref = work.scene_ref(raw)?;
                if work.order.len() <= 1 {
                    return Err("Keep at least one Scene in the Expression".into());
                }
                let at = work.remove(&scene_ref)?;
                if work.selected == scene_ref {
                    work.selected = work.order[at.saturating_sub(1).min(work.order.len() - 1)].clone();
                }
                affected.push(scene_ref);
                "Remove Scene"
            }
            "move" => {
                let scene_ref = work.scene_ref(raw)?;
                let to_ref = raw["to_ref"].as_str().map(str::to_owned);
                match raw["mode"].as_str() {
                    // sceneWorkflow.ts `insertScene`: before `to_ref` (null: at the end); before itself, nothing moves.
                    Some("insert") => {
                        let from = work.index(&scene_ref)?;
                        if to_ref.as_deref() != Some(scene_ref.as_str()) {
                            let to = match &to_ref {
                                None => work.order.len() - 1,
                                Some(before) => {
                                    let at = work.index(before)?;
                                    if from < at {
                                        at - 1
                                    } else {
                                        at
                                    }
                                }
                            };
                            let moving = work.order.remove(from);
                            work.order.insert(to, moving);
                        }
                        affected.push(scene_ref);
                    }
                    // sceneWorkflow.ts `overwriteScene`: the source takes the target's place, and the target leaves.
                    Some("overwrite") => {
                        let target = to_ref.ok_or("Drop the scene on the scene it replaces to overwrite it")?;
                        if target == scene_ref {
                            return Err("A scene cannot overwrite itself.".into());
                        }
                        work.index(&target)?;
                        work.changing(&[&target])?;
                        let (s, t) = (work.index(&scene_ref)?, work.index(&target)?);
                        let replaced: Vec<String> = work
                            .order
                            .iter()
                            .enumerate()
                            .map(|(i, r)| if i == t { scene_ref.clone() } else { r.clone() })
                            .enumerate()
                            .filter(|(i, _)| *i != s)
                            .map(|(_, r)| r)
                            .collect();
                        work.order = replaced;
                        work.removed.insert(target.clone());
                        if work.selected == target {
                            work.selected = scene_ref.clone();
                        }
                        affected = vec![scene_ref, target];
                    }
                    _ => return Err("A move inserts or overwrites".into()),
                }
                "Move Scene"
            }
            "trim" => {
                let scene_ref = work.scene_ref(raw)?;
                work.changing(&[&scene_ref])?;
                let seconds = finite(&raw["seconds"], "Give the cut a finite number of seconds")?;
                let duration = work.duration(&scene_ref);
                match raw["edge"].as_str() {
                    // sceneWorkflow.ts `retimeScene`: the end edge is the duration; the entry stays where it is.
                    Some("end") => {
                        let next = duration + seconds;
                        if !(DURATION_MIN..=DURATION_MAX).contains(&next) {
                            return Err("A scene lasts 1–3600 seconds.".into());
                        }
                        work.set(&scene_ref, "duration", next);
                    }
                    // sceneWorkflow.ts `trimSceneStart`: the length changes the other way, and the entry moves with the edge.
                    Some("start") => {
                        let entry = work.entry(&scene_ref);
                        let (next, offset) = (duration - seconds, entry + seconds);
                        if !(DURATION_MIN..=DURATION_MAX).contains(&next) {
                            return Err("A scene lasts 1–3600 seconds.".into());
                        }
                        if offset < 0.0 {
                            return Err(format!(
                                "A scene cannot start before the start of its own content: trim its start by no more than {} seconds earlier.",
                                (entry * 1000.0).round() / 1000.0
                            ));
                        }
                        if offset > DURATION_MAX {
                            return Err(format!(
                                "{} can start at most 3600 seconds into its own content: trim its start by less.",
                                work.label(&scene_ref)
                            ));
                        }
                        if seconds != 0.0 {
                            work.set(&scene_ref, "duration", next);
                            work.set_entry(&scene_ref, offset);
                        }
                    }
                    _ => return Err("A trim moves the start edge or the end edge".into()),
                }
                affected.push(scene_ref);
                "Trim Scene"
            }
            "roll" => {
                let scene_ref = work.scene_ref(raw)?;
                let at = work.index(&scene_ref)?;
                let next = work
                    .order
                    .get(at + 1)
                    .cloned()
                    .ok_or("There is no scene after this one to roll the seam into.")?;
                work.changing(&[&scene_ref, &next])?;
                let seconds = finite(&raw["seconds"], "Give the cut a finite number of seconds")?;
                let (cut, why) = Work::within(work.seam(&scene_ref, &next), seconds);
                if cut != 0.0 {
                    let (left, right, entry) = (work.duration(&scene_ref), work.duration(&next), work.entry(&next));
                    work.set(&scene_ref, "duration", left + cut);
                    work.set(&next, "duration", right - cut);
                    work.set_entry(&next, entry + cut);
                }
                note = why;
                affected = vec![scene_ref, next];
                "Roll Scene seam"
            }
            "slip" => {
                let scene_ref = work.scene_ref(raw)?;
                work.changing(&[&scene_ref])?;
                let seconds = finite(&raw["seconds"], "Give the cut a finite number of seconds")?;
                let offset = work.entry(&scene_ref) - seconds;
                if !offset.is_finite() || !(0.0..=DURATION_MAX).contains(&offset) {
                    return Err("A scene starts 0 to 3600 seconds into its own content.".into());
                }
                work.set_entry(&scene_ref, offset);
                affected.push(scene_ref);
                "Slip Scene"
            }
            "slide" => {
                let scene_ref = work.scene_ref(raw)?;
                let at = work.index(&scene_ref)?;
                let (Some(before), Some(after)) = (at.checked_sub(1).map(|i| work.order[i].clone()), work.order.get(at + 1).cloned()) else {
                    return Err("A scene slides between two scenes: this one has no scene on one side of it.".into());
                };
                work.changing(&[&before, &after])?;
                let seconds = finite(&raw["seconds"], "Give the cut a finite number of seconds")?;
                let (cut, why) = Work::within(work.seam(&before, &after), seconds);
                if cut != 0.0 {
                    let (b, a, entry) = (work.duration(&before), work.duration(&after), work.entry(&after));
                    work.set(&before, "duration", b + cut);
                    work.set(&after, "duration", a - cut);
                    work.set_entry(&after, entry + cut);
                }
                note = why;
                affected = vec![before, after];
                "Slide Scene"
            }
            "split" => {
                let scene_ref = work.scene_ref(raw)?;
                work.changing(&[&scene_ref])?;
                let scene = document.scenes.iter().find(|s| s.scene_ref == scene_ref).ok_or("Choose one exact Scene ref of this Expression")?;
                if scene.body.is_some() || !scene.triggers.is_empty() {
                    return Err("A split copies the Scene whole, and the Scene's body or triggers cannot be copied with it: nothing was split".into());
                }
                let t = finite(&raw["at"], "Put the playhead inside the scene to split it.")?;
                let duration = work.duration(&scene_ref);
                if t < DURATION_MIN || duration - t < DURATION_MIN {
                    return Err("Too close to an edge to split: each side of a cut must last at least 1 second.".into());
                }
                let source = work.material(&scene_ref)?.clone();
                let (left, right) = split_content(&source, t);
                let name: String = format!("{} / split", source["name"].as_str().unwrap_or(&scene.title)).chars().take(160).collect();
                let at = work.index(&scene_ref)? + 1;
                let made = work.make(at, name, scene.entity_refs.clone(), right)?;
                work.materials.insert(scene_ref.clone(), left);
                affected = vec![scene_ref, made.clone()];
                created = Some(made);
                "Split Scene"
            }
            other => {
                return Err(format!(
                    "expressions.scene.edit has no operation {other}: it duplicates, removes, adds and reorders Scenes, sets the Expression's title, description, colour, loop and loop edge, and cuts (move, trim, roll, slip, slide, split)"
                ))
            }
        };
        let (changes, selected) = work.changes(properties, rename)?;
        Ok(Plan {
            changes,
            label: label.to_owned(),
            affected,
            created,
            selected,
            note,
        })
    }

    // ------------------------------------------------------------------ the split (sceneWorkflow.ts E07)

    type Curve = [(f64, f64); 4];

    fn time(point: &Value) -> f64 {
        point["time"].as_f64().unwrap_or(0.0)
    }

    fn val(point: &Value) -> f64 {
        point["value"].as_f64().unwrap_or(0.0)
    }

    fn handle(point: &Value, key: &str) -> Option<(f64, f64)> {
        let h = point.get(key)?;
        Some((h["dt"].as_f64()?, h["dv"].as_f64()?))
    }

    /// propertyTracks.ts `segmentControls`.
    fn controls(a: &Value, b: &Value, smooth: bool) -> Curve {
        let (span, rise) = (time(b) - time(a), val(b) - val(a));
        let o = if smooth {
            (span / 3.0, 0.0)
        } else {
            handle(a, "out").unwrap_or((span / 3.0, rise / 3.0))
        };
        let n = if smooth {
            (-span / 3.0, 0.0)
        } else {
            handle(b, "in").unwrap_or((-span / 3.0, -rise / 3.0))
        };
        let x1 = time(a) + span.min(0.0f64.max(o.0));
        let x2 = x1.max(time(b) + (-span).max(0.0f64.min(n.0)));
        [
            (time(a), val(a)),
            (x1, val(a) + o.1),
            (x2, val(b) + n.1),
            (time(b), val(b)),
        ]
    }

    fn cubic(p0: f64, p1: f64, p2: f64, p3: f64, u: f64) -> f64 {
        let v = 1.0 - u;
        v * v * v * p0 + 3.0 * v * v * u * p1 + 3.0 * v * u * u * p2 + u * u * u * p3
    }

    /// propertyTracks.ts `curveParameter`: 64-step bisection on the time column.
    fn parameter(c: &Curve, t: f64) -> f64 {
        let (mut lo, mut hi) = (0.0, 1.0);
        for _ in 0..64 {
            let mid = (lo + hi) / 2.0;
            if cubic(c[0].0, c[1].0, c[2].0, c[3].0, mid) < t {
                lo = mid;
            } else {
                hi = mid;
            }
        }
        (lo + hi) / 2.0
    }

    /// propertyTracks.ts `segmentValue`.
    fn segment(a: &Value, b: &Value, at: f64) -> f64 {
        match a["type"].as_str() {
            Some("hold") => val(a),
            Some("smooth") => {
                let s = (at - time(a)) / (time(b) - time(a));
                val(a) + (val(b) - val(a)) * (s * s * (3.0 - 2.0 * s))
            }
            Some("bezier") => {
                if at <= time(a) {
                    return val(a);
                }
                let c = controls(a, b, false);
                cubic(c[0].1, c[1].1, c[2].1, c[3].1, parameter(&c, at))
            }
            _ => val(a) + (val(b) - val(a)) * (at - time(a)) / (time(b) - time(a)),
        }
    }

    /// propertyTracks.ts `valueAt`.
    fn value_at(points: &[Value], at: f64) -> Option<f64> {
        if points.is_empty() || at < time(&points[0]) {
            return None;
        }
        match points.iter().position(|p| time(p) > at) {
            None => Some(val(points.last()?)),
            Some(i) => Some(segment(&points[i - 1], &points[i], at)),
        }
    }

    fn lerp(p: (f64, f64), q: (f64, f64), u: f64) -> (f64, f64) {
        (p.0 + (q.0 - p.0) * u, p.1 + (q.1 - p.1) * u)
    }

    fn handle_of(from: (f64, f64), to: (f64, f64)) -> Value {
        json!({"dt": to.0 - from.0, "dv": to.1 - from.1})
    }

    /// sceneWorkflow.ts `splitPoints`: one track's points cut at t, each side evaluating the original curve.
    fn split_points(points: &[Value], t: f64) -> (Vec<Value>, Vec<Value>) {
        let rebase = |p: &Value| {
            let mut p = p.clone();
            p["time"] = json!(time(&p) - t);
            p
        };
        let Some(value) = value_at(points, t) else {
            return (Vec::new(), points.iter().map(rebase).collect());
        };
        if let Some(exact) = points.iter().position(|p| time(p) == t) {
            return (
                points[..=exact].to_vec(),
                points[exact..].iter().map(rebase).collect(),
            );
        }
        let Some(next) = points.iter().position(|p| time(p) > t) else {
            let mut left = points.to_vec();
            left.push(json!({"time": t, "value": value}));
            return (left, vec![json!({"time": 0, "value": value})]);
        };
        let mut left = points[..next].to_vec();
        let after = points[next].clone();
        let mut rest: Vec<Value> = points[next..].iter().map(rebase).collect();
        let kind = left
            .last()
            .and_then(|p| p["type"].as_str())
            .unwrap_or("linear")
            .to_owned();
        match kind.as_str() {
            "linear" => {
                left.push(json!({"time": t, "value": value}));
                rest.insert(0, json!({"time": 0, "value": value}));
                (left, rest)
            }
            "hold" => {
                left.push(json!({"time": t, "value": value}));
                rest.insert(0, json!({"time": 0, "value": value, "type": "hold"}));
                (left, rest)
            }
            _ => {
                let prev = left.last_mut().expect("a point before the cut");
                let c = controls(prev, &after, kind == "smooth");
                let u = parameter(&c, t);
                let (q0, q1, q2) = (
                    lerp(c[0], c[1], u),
                    lerp(c[1], c[2], u),
                    lerp(c[2], c[3], u),
                );
                let (r0, r1) = (lerp(q0, q1, u), lerp(q1, q2, u));
                let s = lerp(r0, r1, u);
                prev["type"] = json!("bezier");
                prev["out"] = handle_of(c[0], q0);
                left.push(json!({"time": t, "value": value, "in": handle_of(s, r0)}));
                rest[0]["in"] = handle_of(c[3], q2);
                rest.insert(
                    0,
                    json!({"time": 0, "value": value, "type": "bezier", "out": handle_of(s, r1)}),
                );
                (left, rest)
            }
        }
    }

    /// A sequence's value read as JavaScript's truthiness reads it.
    fn truthy(value: &Value) -> bool {
        match value {
            Value::Null => false,
            Value::Bool(b) => *b,
            Value::Number(n) => n.as_f64().is_some_and(|n| n != 0.0 && !n.is_nan()),
            Value::String(s) => !s.is_empty(),
            _ => true,
        }
    }

    /// sceneWorkflow.ts `rightSequence`: on the right, the looping seconds clock starts its cycle at the step it is in at the cut.
    fn right_sequence(sequence: &Value, t: f64) -> Value {
        let steps = sequence["steps"].as_array().cloned().unwrap_or_default();
        let periods: Vec<f64> = steps
            .iter()
            .map(|k| {
                (k["hold"].as_f64().unwrap_or(0.0) + k["transition"].as_f64().unwrap_or(0.0))
                    .max(0.05)
            })
            .collect();
        let total: f64 = periods.iter().sum();
        if !truthy(&sequence["enabled"])
            || truthy(&sequence["manual"])
            || sequence["clock"] != "seconds"
            || sequence["order"].as_str().unwrap_or("loop") != "loop"
            || truthy(&sequence["jitter"])
            || steps.len() < 2
            || total.partial_cmp(&0.0) != Some(std::cmp::Ordering::Greater)
        {
            return sequence.clone();
        }
        let phase = t * sequence["rateMul"].as_f64().unwrap_or(1.0)
            + sequence["phaseOffset"].as_f64().unwrap_or(0.0) * periods[0];
        let mut e = ((phase % total) + total) % total;
        let mut k = 0;
        while k < steps.len() - 1 && e >= periods[k] {
            e -= periods[k];
            k += 1;
        }
        let mut right = sequence.clone();
        right["steps"] = Value::Array(steps[k..].iter().chain(&steps[..k]).cloned().collect());
        right["phaseOffset"] = json!(0);
        right
    }

    fn put(material: &mut Value, key: &str, value: Option<Value>) {
        if let Some(fields) = material.as_object_mut() {
            match value {
                Some(value) => {
                    fields.insert(key.to_owned(), value);
                }
                None => {
                    fields.remove(key);
                }
            }
        }
    }

    /// sceneWorkflow.ts `splitSceneContent`: the left keeps the Scene and everything before the cut; the right carries the rest, from
    /// the evolution time at the cut, as a true cut (transition 0). The right's id and name are set where it is made.
    fn split_content(source: &Value, t: f64) -> (Value, Value) {
        let (mut left, mut right) = (source.clone(), source.clone());
        let duration = source["duration"].as_f64().unwrap_or(0.0);
        left["duration"] = json!(t);
        right["duration"] = json!(duration - t);
        right["transition"] = json!(0);
        put(&mut right, "transitionSpec", None);
        let cut_at = t + source["entryOffset"].as_f64().unwrap_or(0.0);
        put(&mut right, "entryOffset", None);
        if let Some(tracks) = source["propertyTracks"].as_array() {
            let (mut l, mut r) = (Vec::new(), Vec::new());
            for track in tracks {
                let (lp, rp) = split_points(
                    track["points"].as_array().map(Vec::as_slice).unwrap_or(&[]),
                    cut_at,
                );
                if !lp.is_empty() {
                    let mut side = track.clone();
                    side["points"] = Value::Array(lp);
                    l.push(side);
                }
                if !rp.is_empty() {
                    let mut side = track.clone();
                    side["points"] = Value::Array(rp);
                    r.push(side);
                }
            }
            put(
                &mut left,
                "propertyTracks",
                (!l.is_empty()).then_some(Value::Array(l)),
            );
            put(
                &mut right,
                "propertyTracks",
                (!r.is_empty()).then_some(Value::Array(r)),
            );
        }
        let range = &source["propertyTakeRange"];
        let (start, end) = (range["start"].as_f64(), range["end"].as_f64());
        put(
            &mut left,
            "propertyTakeRange",
            match (start, end) {
                (Some(start), Some(end)) if start < t => {
                    Some(json!({"start": start, "end": end.min(t)}))
                }
                _ => None,
            },
        );
        put(
            &mut right,
            "propertyTakeRange",
            match (start, end) {
                (Some(start), Some(end)) if end > t => {
                    Some(json!({"start": (start - t).max(0.0), "end": end - t}))
                }
                _ => None,
            },
        );
        if let Some(entities) = source["entities"].as_array() {
            right["entities"] = Value::Array(
                entities
                    .iter()
                    .map(|entity| {
                        let mut entity = entity.clone();
                        entity["sequence"] = right_sequence(&entity["sequence"], cut_at);
                        entity
                    })
                    .collect(),
            );
        }
        (left, right)
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        /// Each side of a cut plays what the whole played: before the cut on the left, after it on the right, re-based.
        #[test]
        fn a_split_track_evaluates_the_original_curve_on_each_side() {
            for kind in ["linear", "hold", "smooth", "bezier"] {
                let points = vec![
                    json!({"time": 0.0, "value": 0.0, "type": kind, "out": {"dt": 1.0, "dv": 3.0}}),
                    json!({"time": 4.0, "value": 2.0, "in": {"dt": -1.0, "dv": 1.0}}),
                    json!({"time": 6.0, "value": 1.0}),
                ];
                let (left, right) = split_points(&points, 2.5);
                for at in [0.0, 1.0, 2.0, 2.5] {
                    let (whole, part) =
                        (value_at(&points, at).unwrap(), value_at(&left, at).unwrap());
                    assert!(
                        (whole - part).abs() < 1e-6,
                        "{kind} left at {at}: {whole} against {part}"
                    );
                }
                for at in [2.5, 3.0, 4.0, 5.0, 6.0] {
                    let (whole, part) = (
                        value_at(&points, at).unwrap(),
                        value_at(&right, at - 2.5).unwrap(),
                    );
                    assert!(
                        (whole - part).abs() < 1e-6,
                        "{kind} right at {at}: {whole} against {part}"
                    );
                }
            }
            // Before the first point the track has no value: it moves right whole.
            let late = vec![
                json!({"time": 3.0, "value": 1.0}),
                json!({"time": 5.0, "value": 2.0}),
            ];
            let (left, right) = split_points(&late, 1.0);
            assert!(left.is_empty());
            assert_eq!(right[0]["time"], 2.0);
        }

        /// The looping seconds clock starts the right half at the step it is in at the cut.
        #[test]
        fn the_right_half_of_a_sequence_starts_at_the_step_the_cut_falls_in() {
            let sequence = json!({"enabled": true, "clock": "seconds", "steps": [
                {"name": "a", "hold": 1.0, "transition": 0.0}, {"name": "b", "hold": 2.0, "transition": 0.0}, {"name": "c", "hold": 1.0, "transition": 0.0}]});
            let right = right_sequence(&sequence, 1.5);
            assert_eq!(right["steps"][0]["name"], "b");
            assert_eq!(right["steps"][2]["name"], "a");
            assert_eq!(right["phaseOffset"], 0);
            let manual = json!({"enabled": true, "manual": true, "clock": "seconds", "steps": sequence["steps"]});
            assert_eq!(right_sequence(&manual, 1.5), manual);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_field_lists_each_action_under_the_prefix_with_its_class() {
        let field = field();
        assert_eq!(field["schema"], FIELD_SCHEMA);
        let actions = field["actions"].as_array().unwrap();
        assert_eq!(actions.len(), ACTIONS.len());
        for action in actions {
            assert!(action["id"].as_str().unwrap().starts_with(PREFIX));
            assert_eq!(action["mutation_class"], MUTATION_CLASS);
            assert!(action["inputs"].as_array().is_some());
        }
        let ids: std::collections::BTreeSet<&str> = ACTIONS.iter().map(|spec| spec.id).collect();
        assert_eq!(ids.len(), ACTIONS.len(), "each id once");
        assert!(holds("expressions.studio.set") && !holds("expressions.nothing"));
    }

    type Held = std::sync::Arc<std::sync::Mutex<Kernel>>;

    fn kernel() -> Held {
        std::sync::Arc::new(std::sync::Mutex::new(Kernel::new(
            crate::flow::CentralClient::with("/nonexistent/ctrl".into(), None, "test".into()),
        )))
    }

    /// One Action pressed by the person, through the kernel's one write door: its data, or the owner's words.
    fn press(kernel: &Held, action: &str, input: Value) -> Result<Value, String> {
        let op = KernelOp::Act {
            action: action.into(),
            input: Some(input),
            project: None,
            channel: Channel::PersonPress,
        };
        match crate::dispatch::dispatch(kernel, op).0?.result {
            KernelOpResult::ActionDispatched {
                dispatch: ActionDispatch::Invoked { data, .. },
                ..
            } => Ok(data),
            KernelOpResult::ActionDispatched {
                dispatch: ActionDispatch::OwnerRefused { message, .. },
                ..
            } => Err(message),
            other => panic!("another answer: {other:?}"),
        }
    }

    /// A work made by New; with no Central to save it into, New says so and the work stands open.
    fn made(kernel: &Held) -> String {
        let refused = press(kernel, "expressions.new", json!({"title": "Cuts"})).unwrap_err();
        assert!(refused.contains("stands open"), "{refused}");
        refused.split(' ').next().unwrap().to_owned()
    }

    fn scenes(kernel: &Held, work: &str) -> Vec<(String, Value)> {
        let held = kernel.lock().unwrap();
        held.expressions
            .document(work)
            .unwrap()
            .scenes
            .iter()
            .map(|s| {
                (
                    s.scene_ref.clone(),
                    s.presentation
                        .as_ref()
                        .map(|p| p.scene.clone())
                        .unwrap_or(Value::Null),
                )
            })
            .collect()
    }

    fn edit(kernel: &Held, work: &str, intent: Value) -> Result<Value, String> {
        let mut input = intent;
        input["expression_ref"] = json!(work);
        press(kernel, "expressions.scene.edit", input)
    }

    #[test]
    fn the_scene_edits_cut_by_the_field_s_timeline_law_each_one_edit() {
        let kernel = kernel();
        let work = made(&kernel);
        let main = format!("{work}:scene:main");
        let added = edit(&kernel, &work, json!({"operation": "add"})).unwrap();
        let second = added["created_scene_ref"].as_str().unwrap().to_owned();
        assert_eq!(added["selected_scene_ref"], second);
        assert_eq!(
            scenes(&kernel, &work)
                .iter()
                .map(|(r, _)| r.clone())
                .collect::<Vec<_>>(),
            vec![main.clone(), second.clone()]
        );
        // Trim: the end edge is the length; the start edge moves the entry with it.
        edit(
            &kernel,
            &work,
            json!({"operation": "trim", "scene_ref": main, "edge": "end", "seconds": 3}),
        )
        .unwrap();
        edit(
            &kernel,
            &work,
            json!({"operation": "trim", "scene_ref": second, "edge": "start", "seconds": 2}),
        )
        .unwrap();
        let now = scenes(&kernel, &work);
        assert_eq!(
            (
                now[0].1["duration"].as_f64(),
                now[1].1["duration"].as_f64(),
                now[1].1["entryOffset"].as_f64()
            ),
            (Some(15.0), Some(10.0), Some(2.0))
        );
        // A roll past what the next scene can give stops at its limit, and says why.
        let rolled = edit(
            &kernel,
            &work,
            json!({"operation": "roll", "scene_ref": main, "seconds": 1000}),
        )
        .unwrap();
        assert_eq!(
            rolled["note"],
            "The cut stops here: a scene lasts 1 to 3600 seconds."
        );
        let now = scenes(&kernel, &work);
        assert_eq!(
            (
                now[0].1["duration"].as_f64(),
                now[1].1["duration"].as_f64(),
                now[1].1["entryOffset"].as_f64()
            ),
            (Some(24.0), Some(1.0), Some(11.0))
        );
        assert!(edit(
            &kernel,
            &work,
            json!({"operation": "roll", "scene_ref": second, "seconds": 1})
        )
        .unwrap_err()
        .contains("no scene after this one"));
        // Slip moves the entry the other way to the drag; a slide between fixed neighbours.
        edit(
            &kernel,
            &work,
            json!({"operation": "slip", "scene_ref": second, "seconds": -1}),
        )
        .unwrap();
        assert_eq!(
            scenes(&kernel, &work)[1].1["entryOffset"].as_f64(),
            Some(12.0)
        );
        let duplicated = edit(
            &kernel,
            &work,
            json!({"operation": "duplicate", "scene_ref": main}),
        )
        .unwrap();
        let copy = duplicated["created_scene_ref"].as_str().unwrap().to_owned();
        edit(
            &kernel,
            &work,
            json!({"operation": "slide", "scene_ref": copy, "seconds": -5}),
        )
        .unwrap();
        let now = scenes(&kernel, &work);
        assert_eq!(
            now.iter().map(|(r, _)| r.clone()).collect::<Vec<_>>(),
            vec![main.clone(), copy.clone(), second.clone()]
        );
        assert_eq!(
            (
                now[0].1["duration"].as_f64(),
                now[2].1["duration"].as_f64(),
                now[2].1["entryOffset"].as_f64()
            ),
            (Some(19.0), Some(6.0), Some(7.0))
        );
        assert_eq!(now[1].1["name"], "Untitled scene / next");
        // Split: two Scenes whose lengths add up, the right a true cut.
        let split = edit(
            &kernel,
            &work,
            json!({"operation": "split", "scene_ref": main, "at": 10}),
        )
        .unwrap();
        let right = split["created_scene_ref"].as_str().unwrap().to_owned();
        let now = scenes(&kernel, &work);
        assert_eq!(now[1].0, right);
        assert_eq!(
            (
                now[0].1["duration"].as_f64(),
                now[1].1["duration"].as_f64(),
                now[1].1["transition"].as_f64()
            ),
            (Some(10.0), Some(9.0), Some(0.0))
        );
        assert!(edit(
            &kernel,
            &work,
            json!({"operation": "split", "scene_ref": main, "at": 0.5})
        )
        .unwrap_err()
        .contains("Too close to an edge"));
        // Move: insert before a scene; overwrite takes the target's place and the target leaves.
        edit(
            &kernel,
            &work,
            json!({"operation": "move", "scene_ref": second, "mode": "insert", "to_ref": main}),
        )
        .unwrap();
        assert_eq!(scenes(&kernel, &work)[0].0, second);
        edit(
            &kernel,
            &work,
            json!({"operation": "move", "scene_ref": copy, "mode": "overwrite", "to_ref": right}),
        )
        .unwrap();
        assert_eq!(
            scenes(&kernel, &work)
                .iter()
                .map(|(r, _)| r.clone())
                .collect::<Vec<_>>(),
            vec![second.clone(), main.clone(), copy.clone()]
        );
        // Remove, reorder; the Expression's own title, colour and loop brace.
        edit(
            &kernel,
            &work,
            json!({"operation": "remove", "scene_ref": second}),
        )
        .unwrap();
        edit(
            &kernel,
            &work,
            json!({"operation": "reorder", "scene_refs": [copy, main]}),
        )
        .unwrap();
        assert_eq!(scenes(&kernel, &work)[0].0, copy);
        edit(
            &kernel,
            &work,
            json!({"operation": "expression-title", "title": "Renamed"}),
        )
        .unwrap();
        edit(
            &kernel,
            &work,
            json!({"operation": "colour", "colour": "#aabbcc"}),
        )
        .unwrap();
        edit(
            &kernel,
            &work,
            json!({"operation": "loop-edge", "edge": "to", "at": 5}),
        )
        .unwrap();
        {
            let held = kernel.lock().unwrap();
            let document = held.expressions.document(&work).unwrap();
            let composition =
                serde_json::to_value(document.presentation.as_ref().unwrap()).unwrap();
            assert_eq!(
                (
                    document.title.as_str(),
                    &composition["colour"],
                    &composition["loopRegion"]
                ),
                (
                    "Renamed",
                    &json!("#aabbcc"),
                    &json!({"from": 0.0, "to": 5.0})
                )
            );
        }
        assert!(edit(
            &kernel,
            &work,
            json!({"operation": "colour", "colour": "red"})
        )
        .unwrap_err()
        .contains("#RRGGBB"));
        assert!(edit(&kernel, &work, json!({"operation": "nothing"}))
            .unwrap_err()
            .contains("has no operation nothing"));
        assert!(edit(
            &kernel,
            &work,
            json!({"operation": "add", "expected_revision": 1})
        )
        .unwrap_err()
        .contains("moved meanwhile"));
    }

    #[test]
    fn a_kept_take_is_drawn_given_back_and_lanes_and_holds_answer_in_words() {
        let kernel = kernel();
        let work = made(&kernel);
        let main = format!("{work}:scene:main");
        let bind = &crate::expression_studio::binds()[0];
        press(
            &kernel,
            "expressions.arm",
            json!({"expression_ref": work, "on": true}),
        )
        .unwrap();
        press(
            &kernel,
            "expressions.scene.launch",
            json!({"launches": [{"expression_ref": work, "scene_ref": main}]}),
        )
        .unwrap();
        press(&kernel, "expressions.studio.set", json!({"expression_ref": work, "scene_ref": main, "bind": bind.bind, "value": bind.hard_min})).unwrap();
        std::thread::sleep(std::time::Duration::from_millis(40));
        let stopped = press(
            &kernel,
            "expressions.scene.stop",
            json!({"expression_ref": work}),
        )
        .unwrap();
        let take = stopped["take_ref"].as_str().unwrap().to_owned();
        assert!(press(
            &kernel,
            "expressions.take.unkeep",
            json!({"expression_ref": work, "scene_ref": main, "take_ref": take})
        )
        .unwrap_err()
        .contains("is not kept"));
        press(
            &kernel,
            "expressions.take.keep",
            json!({"expression_ref": work, "scene_ref": main, "take_ref": take}),
        )
        .unwrap();
        let lane = scenes(&kernel, &work)[0].1["propertyTracks"][0]["id"]
            .as_str()
            .unwrap()
            .to_owned();
        let drawn = press(&kernel, "expressions.lane.draw", json!({"expression_ref": work, "scene_ref": main, "track_id": lane,
            "points": [{"time": 0.0, "value": bind.hard_min}, {"time": 2.0, "value": bind.hard_max}]})).unwrap();
        assert_eq!(drawn["points"], 2);
        assert!(press(&kernel, "expressions.lane.draw", json!({"expression_ref": work, "scene_ref": main, "track_id": lane,
            "points": [{"time": 0.0, "value": bind.hard_max + 1.0}, {"time": 2.0, "value": bind.hard_max}]})).unwrap_err().contains("lies outside it"));
        assert!(press(
            &kernel,
            "expressions.lane.draw",
            json!({"expression_ref": work, "scene_ref": main, "track_id": lane,
            "points": [{"time": 0.0, "value": 0.0}]})
        )
        .unwrap_err()
        .contains("2 to 512 points"));
        // Taken back, the lane the keep made goes, and the Scene stands as it stood.
        press(
            &kernel,
            "expressions.take.unkeep",
            json!({"expression_ref": work, "scene_ref": main, "take_ref": take}),
        )
        .unwrap();
        let material = &scenes(&kernel, &work)[0].1;
        assert!(
            material.get("propertyTracks").is_none() && material.get("propertyTakeRange").is_none(),
            "{material}"
        );
        assert_eq!(material["duration"].as_f64(), Some(12.0));
        assert_eq!(
            press(
                &kernel,
                "expressions.studio.reenable",
                json!({"expression_ref": work})
            )
            .unwrap_err(),
            "No value of this Expression is held off its automation."
        );
        assert!(press(&kernel, "expressions.take.lane", json!({"expression_ref": work, "scene_ref": main, "lane_ref": "lane:1", "enabled": true, "solo": false}))
            .unwrap_err().contains("holds no performance"));
    }

    #[test]
    fn a_drag_s_samples_land_in_the_take_alone_and_its_release_writes_the_scene_once() {
        let kernel = kernel();
        let work = made(&kernel);
        let main = format!("{work}:scene:main");
        let bind = &crate::expression_studio::binds()[0];
        let at = |share: f64| bind.hard_min + (bind.hard_max - bind.hard_min) * share;
        let sample = |value: f64| json!({"expression_ref": work, "scene_ref": main, "bind": bind.bind, "value": value, "gesture": "sample"});
        let revision = || {
            kernel
                .lock()
                .unwrap()
                .expressions
                .document(&work)
                .unwrap()
                .revision
        };
        let before = revision();
        // No take records: a sample would be a write no one could find.
        let refused = press(&kernel, "expressions.studio.set", sample(at(0.1))).unwrap_err();
        assert!(refused.contains("records none on this Scene"), "{refused}");
        press(
            &kernel,
            "expressions.arm",
            json!({"expression_ref": work, "on": true}),
        )
        .unwrap();
        press(
            &kernel,
            "expressions.scene.launch",
            json!({"launches": [{"expression_ref": work, "scene_ref": main}]}),
        )
        .unwrap();
        let armed = revision();
        for step in 1..=5 {
            let answer = press(
                &kernel,
                "expressions.studio.set",
                sample(at(step as f64 / 10.0)),
            )
            .unwrap();
            assert_eq!(answer["sampled"], 1);
            assert!(answer["take_ref"].is_string());
            std::thread::sleep(std::time::Duration::from_millis(5));
        }
        assert_eq!(revision(), armed, "a sample writes no Scene");
        let setting = press(&kernel, "expressions.studio.set", json!({"expression_ref": work, "scene_ref": main,
            "setting": {"kind": "panel-setting", "key": "pulse"}, "value": true, "gesture": "sample"})).unwrap_err();
        assert!(setting.contains("a setting is written once"), "{setting}");
        let other = press(
            &kernel,
            "expressions.studio.set",
            json!({"expression_ref": work, "scene_ref": main, "bind": bind.bind,
            "value": at(0.5), "gesture": "drag"}),
        )
        .unwrap_err();
        assert!(other.contains("takes gesture \"sample\" alone"), "{other}");
        let outside = press(
            &kernel,
            "expressions.studio.set",
            sample(bind.hard_max + 1.0),
        )
        .unwrap_err();
        assert!(
            !outside.is_empty() && revision() == armed,
            "an out-of-range sample is refused by the law the release is: {outside}"
        );
        // The release writes the Scene once.
        press(
            &kernel,
            "expressions.studio.set",
            json!({"expression_ref": work, "scene_ref": main, "bind": bind.bind, "value": at(0.6)}),
        )
        .unwrap();
        assert_eq!(revision(), armed + 1);
        let stopped = press(
            &kernel,
            "expressions.scene.stop",
            json!({"expression_ref": work}),
        )
        .unwrap();
        let take = stopped["take_ref"]
            .as_str()
            .expect("the take closed")
            .to_owned();
        let held = kernel.lock().unwrap();
        let document = held.expressions.document(&work).unwrap();
        let laid = document.scenes[0]
            .studio_takes
            .iter()
            .find(|t| t.take_ref == take)
            .expect("the take laid on its Scene");
        let lane = laid
            .tracks
            .iter()
            .find(|t| t.bind == bind.bind)
            .expect("the bind's lane");
        let values: Vec<f64> = lane.points.iter().map(|p| p.value.0).collect();
        assert!(
            values.len() >= 6,
            "five samples and the release: {values:?}"
        );
        assert!(
            values.windows(2).all(|w| w[0] <= w[1]),
            "in the order dragged: {values:?}"
        );
        assert_eq!(armed, before, "arming and launching write no Scene");
    }

    #[test]
    fn a_work_s_file_is_named_as_new_names_it() {
        assert_eq!(
            material_file_name("Gate act six 0f3a2b1c"),
            "gate-act-six-0f3a2b1c.expression.json"
        );
        assert_eq!(material_file_name("  ★ "), "material.expression.json");
        assert_eq!(
            material_file_name("Über—Scene"),
            "ber-scene.expression.json"
        );
        let id = uuid().unwrap();
        assert_eq!(id.len(), 36);
        assert_eq!(&id[14..15], "4");
    }
}
