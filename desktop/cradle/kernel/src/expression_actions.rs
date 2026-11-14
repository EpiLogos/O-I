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

const ACTIONS: [Spec; 13] = [
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
        description: "Write a value of the field (`bind`, as a lane binds it: field.params.<key>; Tempo is field.params.timeScale, Tempo ÷ 96) or a device setting (`setting`: {kind, key}) into a Scene, by the law the devices write with. While the Expression records, the value is recorded on its take at the instant the kernel stamps. `changes` writes several at once.",
        inputs: &[WORK, SCENE, ("bind", "string", false), ("setting", "object", false), ("value", "json", false), ("observed", "number", false), ("changes", "array", false)],
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
        if let Some(fields) = rest.as_object_mut() {
            fields.remove("expression_ref");
            fields.remove("scene_ref");
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
            "recorded_at_s": recorded.as_ref().map(|r| &r["at_s"])}),
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
            let material = crate::expression_studio::keep(&presentation.scene, take, from, to)?;
            let mut kept = take.clone();
            kept.kept = Some(Kept {
                from_s: Finite(from),
                to_s: Finite(to),
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
