//! The Studio of an Expression (O-I #1008; docs/architecture/world-shell.md §9.3, Expressions' chain "Studio: the field and its
//! devices"): the values its devices write into a Scene's material, the takes a recording keeps of them, and a take kept into the
//! Scene's main lane. The expression store holds all of it; the frame plays what the store holds and records nothing.
//!
//! A value is addressed by a `bind`, the vocabulary a `propertyTracks` lane already uses (`field.params.<key>`, `morph.<key>`,
//! `engine.<key>`, `composition.<key>`), or a discrete `setting` by its kind and key (`field-setting`, `panel-setting`,
//! `morph-setting`, `colour-setting`). Each is written by the law the frame's device reducer applies (expressions-boundary
//! nativeDeviceEdits.ts `parameter` and its setting arms): its hard bounds, a whole number where the solver counts, the Expression's
//! shared value where the path is shared (sharedSettings.ts `writeShared`), a replacing automation lane offset instead of the value
//! (automationLinks.ts `offsetAutomatedTarget`), and the focus tint's side rule. The table it reads, `expression_studio.json`, is
//! generated from those TypeScript owners and held equal to them by expressions-boundary's tests/studio-table.test.mjs.
use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};
use std::collections::BTreeMap;
use std::sync::OnceLock;

/// A take lane's bounds, as the kernel already holds them for `propertyTracks` (propertyTracks.ts `validateTracks`).
pub const TRACKS: usize = 2048;
pub const POINTS: usize = 72_000;
pub const SECONDS: f64 = 3600.0;
/// How many Studio takes one Scene keeps.
pub const TAKES: usize = 64;

#[derive(Deserialize)]
struct Table {
    schema: String,
    binds: Vec<Bind>,
    pointer_paths: Vec<String>,
    settings: BTreeMap<String, BTreeMap<String, SettingSpec>>,
    carry_tint_bind: String,
    blank_scene: Value,
}

/// One Field binding (nativeParameters.ts `NativeBinding`), in authored units.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Bind {
    pub key: String,
    pub bind: String,
    pub path: String,
    pub label: String,
    pub group: String,
    pub hard_min: f64,
    pub hard_max: f64,
    pub default_value: f64,
    pub factor: f64,
    pub whole: bool,
}

#[derive(Debug, Deserialize)]
struct SettingSpec {
    path: String,
    #[serde(default)]
    values: Option<Vec<Value>>,
    #[serde(default)]
    min: Option<f64>,
    #[serde(default)]
    max: Option<f64>,
}

fn table() -> &'static Table {
    static TABLE: OnceLock<Table> = OnceLock::new();
    TABLE.get_or_init(|| {
        let table: Table = serde_json::from_str(include_str!("expression_studio.json"))
            .expect("expression_studio.json is the generated Studio table");
        assert_eq!(table.schema, "oi.expression-studio-table/v1");
        table
    })
}

/// The Field bindings, in the registry's order.
pub fn binds() -> &'static [Bind] {
    &table().binds
}

/// A binding by its bind (`field.params.timeScale`) or its device target (`field.timeScale`).
pub fn bind(name: &str) -> Option<&'static Bind> {
    let binds = binds();
    binds.iter().find(|bind| bind.bind == name).or_else(|| {
        name.strip_prefix("field.")
            .and_then(|key| binds.iter().find(|bind| bind.key == key))
    })
}

/// New's scene (model.ts `blankScene`), addressed by the Scene it becomes and titled by it.
pub fn blank_scene(scene_ref: &str, title: &str) -> Value {
    let mut scene = table().blank_scene.clone();
    scene["id"] = json!(scene_ref);
    scene["name"] = json!(title);
    scene
}

/// The blank scene's own title.
pub fn blank_title() -> &'static str {
    table().blank_scene["name"]
        .as_str()
        .unwrap_or("Untitled scene")
}

// ---------------------------------------------------------------------------
// Reading a value as the frame reads it.
// ---------------------------------------------------------------------------

fn read_path<'a>(root: &'a Value, path: &str) -> Option<&'a Value> {
    path.split('.').try_fold(root, |value, key| value.get(key))
}

fn local_pointer(material: &Value) -> bool {
    material["pointerScope"] == "local"
}

fn pointer_path(path: &str) -> bool {
    table().pointer_paths.iter().any(|known| known == path)
}

/// A value as the Scene stands with its Expression's shared settings over it (sharedSettings.ts `effectiveScene`): the shared
/// pointer value while the Scene's pointer is global, else the shared value, else the Scene's own.
fn effective<'a>(material: &'a Value, shared: Option<&'a Value>, path: &str) -> Option<&'a Value> {
    if let Some(shared) = shared {
        if !local_pointer(material) {
            if let Some(value) = shared["pointer"].get(path) {
                return Some(value);
            }
        }
        if let Some(value) = shared["values"].get(path) {
            return Some(value);
        }
    }
    read_path(material, path)
}

/// Every Field binding's value as the Scene stands (nativeParameters.ts `baseValue` over `effectiveScene`): the value it holds,
/// else the binding's default.
pub fn values(material: &Value, shared: Option<&Value>) -> BTreeMap<String, Value> {
    binds()
        .iter()
        .map(|bind| {
            let value = effective(material, shared, &bind.bind)
                .and_then(Value::as_f64)
                .filter(|value| value.is_finite())
                .unwrap_or(bind.default_value);
            (bind.bind.clone(), json!(value))
        })
        .collect()
}

/// Every setting the Scene holds, by `<kind>:<key>`; a setting it does not hold is absent.
pub fn settings(material: &Value, shared: Option<&Value>) -> BTreeMap<String, Value> {
    let mut out = BTreeMap::new();
    for (kind, settings) in &table().settings {
        for (key, spec) in settings {
            if let Some(value) = effective(material, shared, &spec.path).filter(|v| !v.is_null()) {
                out.insert(format!("{kind}:{key}"), value.clone());
            }
        }
    }
    out
}

/// One binding's value as the Scene stands, for a recorded take's end point.
fn value_now(material: &Value, shared: Option<&Value>, bind: &Bind) -> f64 {
    effective(material, shared, &bind.bind)
        .and_then(Value::as_f64)
        .filter(|value| value.is_finite())
        .unwrap_or(bind.default_value)
}

// ---------------------------------------------------------------------------
// Writing a value.
// ---------------------------------------------------------------------------

/// One Studio write.
#[derive(Debug)]
pub struct Write {
    target: Target,
    value: Value,
    observed: Option<f64>,
}

#[derive(Debug)]
enum Target {
    Bind(&'static Bind),
    Setting {
        kind: String,
        key: String,
        spec: &'static SettingSpec,
    },
}

impl Write {
    /// The bind a numeric write records on, when it is one.
    pub fn recorded(&self) -> Option<(&'static str, f64)> {
        match self.target {
            Target::Bind(bind) => self.value.as_f64().map(|value| (bind.bind.as_str(), value)),
            Target::Setting { .. } => None,
        }
    }

    /// What it addresses, as the answer names it.
    fn named(&self) -> Value {
        match &self.target {
            Target::Bind(bind) => json!({"bind": bind.bind, "value": self.value}),
            Target::Setting { kind, key, .. } => {
                json!({"setting": {"kind": kind, "key": key}, "value": self.value})
            }
        }
    }
}

/// The writes an `expressions.studio.set` input names: one (`bind` or `setting`, with `value` and an optional `observed`), or a
/// `changes` list of them, applied together. Refused in words before anything is written.
pub fn writes(input: &Value) -> Result<Vec<Write>, String> {
    let rows: Vec<&Value> = match input.get("changes") {
        Some(Value::Array(rows)) if !rows.is_empty() && rows.len() <= 256 => rows.iter().collect(),
        Some(_) => return Err("A Studio change list holds 1 to 256 writes".into()),
        None => vec![input],
    };
    let mut seen = std::collections::BTreeSet::new();
    rows.into_iter()
        .map(|row| {
            let value = row
                .get("value")
                .cloned()
                .ok_or("A Studio write names its value")?;
            let observed = row.get("observed").and_then(Value::as_f64);
            let target = match (row.get("bind"), row.get("setting")) {
                (Some(Value::String(name)), None) => Target::Bind(
                    bind(name).ok_or_else(|| format!("The Studio has no Field value at {name}"))?,
                ),
                (None, Some(setting)) => {
                    let kind = setting["kind"].as_str().unwrap_or_default();
                    let key = setting["key"].as_str().unwrap_or_default();
                    let spec = table()
                        .settings
                        .get(kind)
                        .and_then(|settings| settings.get(key))
                        .ok_or_else(|| format!("The Studio has no setting {kind} {key}"))?;
                    Target::Setting {
                        kind: kind.to_owned(),
                        key: key.to_owned(),
                        spec,
                    }
                }
                _ => return Err("A Studio write names one bind or one setting".into()),
            };
            let named = match &target {
                Target::Bind(bind) => bind.bind.clone(),
                Target::Setting { kind, key, .. } => format!("{kind}:{key}"),
            };
            if !seen.insert(named.clone()) {
                return Err(format!("A Studio gesture writes {named} once"));
            }
            Ok(Write {
                target,
                value,
                observed,
            })
        })
        .collect()
}

fn unsafe_key(key: &str) -> bool {
    matches!(key, "__proto__" | "prototype" | "constructor")
}

/// nativeParameters.ts `bindValue`: the value at the path, each missing object on the way made.
fn bind_value(root: &mut Value, path: &str, value: Value) -> Result<(), String> {
    let keys: Vec<&str> = path.split('.').collect();
    if keys.iter().any(|key| unsafe_key(key) || key.is_empty()) {
        return Err("Unsafe document path".into());
    }
    let mut at = root;
    for key in &keys[..keys.len() - 1] {
        let object = at
            .as_object_mut()
            .ok_or_else(|| format!("The Scene's {path} does not stand under an object"))?;
        at = object.entry(*key).or_insert_with(|| json!({}));
    }
    at.as_object_mut()
        .ok_or_else(|| format!("The Scene's {path} does not stand under an object"))?
        .insert(keys[keys.len() - 1].to_owned(), value);
    Ok(())
}

/// sharedSettings.ts `isShared`.
fn is_shared(shared: Option<&Value>, material: &Value, path: &str) -> bool {
    shared.is_some_and(|shared| {
        shared["values"].get(path).is_some() || (!local_pointer(material) && pointer_path(path))
    })
}

/// sharedSettings.ts `writeShared`: the Expression's shared value, when the path is shared.
fn write_shared(shared: &mut Option<Value>, material: &Value, path: &str, value: &Value) -> bool {
    if !is_shared(shared.as_ref(), material, path) {
        return false;
    }
    let bucket = if pointer_path(path) && !local_pointer(material) {
        "pointer"
    } else {
        "values"
    };
    if let Some(shared) = shared.as_mut() {
        if !shared[bucket].is_object() {
            shared[bucket] = json!({});
        }
        shared[bucket][path] = value.clone();
    }
    true
}

/// automationLinks.ts `automationLeader`: the lane a lane follows (its `syncWith` chain), or the lane itself.
fn leader<'a>(lanes: &'a [Value], lane: &'a Value) -> Result<&'a Value, String> {
    let mut at = lane;
    for _ in 0..=lanes.len() {
        let Some(parent) = at["syncWith"].as_str().filter(|id| !id.is_empty()) else {
            return Ok(at);
        };
        at = lanes
            .iter()
            .find(|candidate| candidate["id"].as_str() == Some(parent))
            .ok_or("An automation lane follows a lane that no longer exists")?;
    }
    Err("Automation lanes follow each other in a circle".into())
}

/// automationLinks.ts `offsetAutomatedTarget`'s lane: the last enabled lane on `target`, when it replaces the value.
fn replacing_lane(lanes: &[Value], target: &str) -> Result<Option<usize>, String> {
    let mut found = None;
    for (index, lane) in lanes.iter().enumerate() {
        if lane["target"].as_str() != Some(target) {
            continue;
        }
        let enabled = lane["enabled"] != false && leader(lanes, lane)?["enabled"] != false;
        if enabled {
            found = Some(index);
        }
    }
    Ok(found.filter(|index| lanes[*index]["blend"] == "replace"))
}

/// nativeDeviceEdits.ts `parameter`, for a Field binding.
fn parameter(
    material: &mut Value,
    shared: &mut Option<Value>,
    bind: &Bind,
    value: &Value,
    observed: Option<f64>,
) -> Result<(), String> {
    let number = value
        .as_f64()
        .filter(|n| n.is_finite())
        .ok_or("Enter a finite parameter value.")?;
    if number < bind.hard_min || number > bind.hard_max {
        return Err(format!(
            "{} must be between {} and {}.",
            bind.label, bind.hard_min, bind.hard_max
        ));
    }
    if bind.whole && (number * bind.factor).fract() != 0.0 {
        return Err(format!("{} requires a whole number.", bind.label));
    }
    let shared_here = is_shared(shared.as_ref(), material, &bind.bind);
    if !shared_here {
        let target = format!("field.{}", bind.key);
        let lanes = material["automation"]
            .as_array()
            .cloned()
            .unwrap_or_default();
        if let Some(index) = replacing_lane(&lanes, &target)? {
            let previous = observed
                .filter(|n| n.is_finite())
                .ok_or("Read the effective automated value before moving this control.")?;
            let delta = number - previous;
            let lane = &mut material["automation"][index];
            let (min, max) = (
                lane["min"].as_f64().unwrap_or(0.0) + delta,
                lane["max"].as_f64().unwrap_or(0.0) + delta,
            );
            if !min.is_finite() || !max.is_finite() {
                return Err("The automated range would exceed finite values.".into());
            }
            lane["min"] = json!(min);
            lane["max"] = json!(max);
            return Ok(());
        }
    }
    if !write_shared(shared, material, &bind.bind, value) {
        bind_value(material, &bind.bind, json!(number))?;
    }
    if bind.bind == table().carry_tint_bind && number > 0.0 {
        bind_value(material, "composition.carryTint", json!(true))?;
    }
    Ok(())
}

/// The setting arms of nativeDeviceEdits.ts `applyNativeDeviceChanges` (`field-setting`, `morph-setting`, `colour-setting`,
/// `panel-setting`): the listed value, or a number inside its range, at its path, shared where the path is shared. A Scene's
/// pointer scope is moved as sharedSettings.ts `useLocalPointer` moves it.
fn setting(
    material: &mut Value,
    shared: &mut Option<Value>,
    kind: &str,
    key: &str,
    spec: &SettingSpec,
    value: &Value,
) -> Result<(), String> {
    let admitted = match (&spec.values, spec.min, spec.max) {
        (Some(values), _, _) => values.contains(value),
        (None, Some(min), Some(max)) => value
            .as_f64()
            .is_some_and(|n| n.is_finite() && n >= min && n <= max),
        _ => false,
    };
    if !admitted {
        return Err(format!(
            "Choose an admitted value for the Studio's {kind} {key}."
        ));
    }
    if kind == "panel-setting" && key == "pointerScope" {
        if value == "local" {
            let current = material.clone();
            for path in &table().pointer_paths {
                if let Some(held) = effective(&current, shared.as_ref(), path) {
                    bind_value(material, path, held.clone())?;
                }
            }
            material["pointerScope"] = json!("local");
        } else {
            material["pointerScope"] = json!("global");
        }
        return Ok(());
    }
    if !write_shared(shared, material, &spec.path, value) {
        bind_value(material, &spec.path, value.clone())?;
    }
    Ok(())
}

/// What a Studio write moved: the Scene's material, the Expression's shared settings when they moved, and what each write named.
#[derive(Debug)]
pub struct Moved {
    pub material: Value,
    pub shared: Option<Value>,
    pub shared_moved: bool,
    pub written: Vec<Value>,
}

/// Apply `writes` to a Scene's material under its Expression's shared settings, atomically: one refusal writes nothing.
pub fn write(material: &Value, shared: Option<&Value>, writes: &[Write]) -> Result<Moved, String> {
    let mut material = material.clone();
    let mut held = shared.cloned();
    for write in writes {
        match &write.target {
            Target::Bind(bind) => {
                parameter(&mut material, &mut held, bind, &write.value, write.observed)?
            }
            Target::Setting { kind, key, spec } => {
                setting(&mut material, &mut held, kind, key, spec, &write.value)?
            }
        }
    }
    let shared_moved = held.as_ref() != shared;
    Ok(Moved {
        material,
        shared: held,
        shared_moved,
        written: writes.iter().map(Write::named).collect(),
    })
}

// ---------------------------------------------------------------------------
// Studio takes.
// ---------------------------------------------------------------------------

/// A finite number, as a take's times and values are: never NaN, so a take compares whole (a Scene is `Eq`).
#[derive(Clone, Copy, Debug, PartialEq, PartialOrd, Serialize)]
#[serde(transparent)]
pub struct Finite(pub f64);

impl Eq for Finite {}

impl<'de> Deserialize<'de> for Finite {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let value = f64::deserialize(deserializer)?;
        if value.is_finite() {
            Ok(Finite(value))
        } else {
            Err(serde::de::Error::custom("A take's numbers are finite"))
        }
    }
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct TakePoint {
    pub time: Finite,
    pub value: Finite,
}

/// One bind's lane of a take: what the person moved, stamped by the kernel.
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct TakeTrack {
    pub id: String,
    pub bind: String,
    pub points: Vec<TakePoint>,
}

/// The stretch of a take kept into the Scene's main lane.
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct Kept {
    pub from_s: Finite,
    pub to_s: Finite,
    /// What the keep laid over in the main lane, so that `expressions.take.unkeep` gives it back: each bind's lane as it stood
    /// inside the stretch (`created` where the keep made the lane), and the Scene's length and take range before it.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub before: Option<Value>,
}

/// A Studio take (manual §20.1, "Arm the Expression and press Play, and Play records a take"): the values the Studio's devices
/// wrote while the Scene played armed, each at the Scene's time the kernel stamped, on its own take lane. Kept, the stretch named
/// lies in the Scene's `propertyTracks`, the main lane the engine plays.
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct StudioTake {
    pub take_ref: String,
    pub lane: u32,
    pub start_s: Finite,
    pub seconds: Finite,
    pub tracks: Vec<TakeTrack>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub kept: Option<Kept>,
}

/// A Scene's takes, as a document holds them: bounded, each lane in time order inside the Scene's hour.
pub fn validate_takes(scene_ref: &str, takes: &[StudioTake]) -> Result<(), String> {
    if takes.len() > TAKES {
        return Err(format!("A Scene keeps at most {TAKES} Studio takes"));
    }
    let mut refs = std::collections::BTreeSet::new();
    for take in takes {
        if !take.take_ref.starts_with(&format!("{scene_ref}:take:")) || !refs.insert(&take.take_ref)
        {
            return Err("A Studio take is addressed once, under its Scene".into());
        }
        let (start, seconds) = (take.start_s.0, take.seconds.0);
        if start < 0.0 || seconds < 0.0 || start + seconds > SECONDS {
            return Err("A Studio take lies inside its Scene's hour".into());
        }
        if take.tracks.len() > TRACKS {
            return Err(format!("A Studio take holds at most {TRACKS} lanes"));
        }
        let mut binds = std::collections::BTreeSet::new();
        for track in &take.tracks {
            if bind(&track.bind).is_none() || !binds.insert(&track.bind) {
                return Err(format!(
                    "A Studio take records each Field value once ({})",
                    track.bind
                ));
            }
            if track.points.len() > POINTS {
                return Err(format!("A Studio take lane holds at most {POINTS} points"));
            }
            let mut last = -1.0;
            for point in &track.points {
                if point.time.0 <= last || point.time.0 > SECONDS {
                    return Err("A Studio take's points stand in time order".into());
                }
                last = point.time.0;
            }
        }
        if let Some(kept) = &take.kept {
            if kept.from_s.0 < 0.0 || kept.to_s.0 <= kept.from_s.0 || kept.to_s.0 > SECONDS {
                return Err("A kept stretch runs forward inside the Scene's hour".into());
            }
        }
    }
    Ok(())
}

/// A take being recorded: its lanes grow as the Studio's writes land.
#[derive(Clone, Debug)]
pub struct Recording {
    pub expression_ref: String,
    pub scene_ref: String,
    pub take: StudioTake,
    /// The instant the Scene's time `start_s` stands at (its launch's landing), in unix ms.
    pub started_at_unix_ms: u64,
}

impl Recording {
    /// The Scene's time at `now`, in seconds, never before the take's start.
    pub fn time_at(&self, now_unix_ms: u64) -> f64 {
        let elapsed = now_unix_ms.saturating_sub(self.started_at_unix_ms) as f64 / 1000.0;
        (self.take.start_s.0 + elapsed).min(SECONDS)
    }

    /// One written value on its bind's lane, at the time the kernel stamps. A second value at the same instant replaces the first.
    pub fn record(&mut self, bind_name: &str, value: f64, now_unix_ms: u64) -> Result<(), String> {
        let time = self.time_at(now_unix_ms);
        let index = match self.take.tracks.iter().position(|t| t.bind == bind_name) {
            Some(index) => index,
            None => {
                if self.take.tracks.len() >= TRACKS {
                    return Err(format!("A Studio take holds at most {TRACKS} lanes"));
                }
                self.take.tracks.push(TakeTrack {
                    id: format!("{}:{bind_name}", self.take.take_ref),
                    bind: bind_name.to_owned(),
                    points: Vec::new(),
                });
                self.take.tracks.len() - 1
            }
        };
        let points = &mut self.take.tracks[index].points;
        if let Some(last) = points.last_mut().filter(|last| last.time.0 >= time) {
            last.value = Finite(value);
            return Ok(());
        }
        if points.len() >= POINTS {
            return Err(format!("A Studio take lane holds at most {POINTS} points"));
        }
        points.push(TakePoint {
            time: Finite(time),
            value: Finite(value),
        });
        Ok(())
    }

    /// The take closed at `now`: each lane ends on its value then, and the take's length is where it ended.
    pub fn close(
        mut self,
        material: &Value,
        shared: Option<&Value>,
        now_unix_ms: u64,
    ) -> StudioTake {
        let end = self.time_at(now_unix_ms);
        for track in &mut self.take.tracks {
            let Some(bind) = bind(&track.bind) else {
                continue;
            };
            let value = value_now(material, shared, bind);
            if track.points.last().is_some_and(|last| last.time.0 < end) {
                track.points.push(TakePoint {
                    time: Finite(end),
                    value: Finite(value),
                });
            }
        }
        self.take.seconds = Finite((end - self.take.start_s.0).max(0.0));
        self.take
    }
}

/// A take kept into the Scene's main lane (propertyTracks.ts `layPropertyTake` and `mergeTake`): the stretch `from..to` of each of
/// its lanes laid over the Scene's lane on the same bind (what lies there outside the stretch stays), a lane of its own where the
/// Scene had none; the Scene's take range is the stretch, and its length grows to hold it. Returns the material as it stands after.
pub fn keep(
    material: &Value,
    take: &StudioTake,
    from: f64,
    to: f64,
) -> Result<(Value, Value), String> {
    if !(from >= 0.0 && to > from && to <= SECONDS) {
        return Err("A kept stretch runs forward inside the Scene's hour".into());
    }
    let mut material = material.clone();
    let mut tracks: Vec<Value> = material["propertyTracks"]
        .as_array()
        .cloned()
        .unwrap_or_default();
    let inside = |point: &Value| {
        let time = point["time"].as_f64().unwrap_or(-1.0);
        time >= from && time <= to
    };
    let mut before = Vec::new();
    for lane in &take.tracks {
        let points: Vec<Value> = lane
            .points
            .iter()
            .filter(|point| point.time.0 >= from && point.time.0 <= to)
            .map(|point| json!({"time": point.time.0, "value": point.value.0}))
            .collect();
        if points.is_empty() {
            continue;
        }
        match tracks
            .iter_mut()
            .find(|track| track["bind"] == lane.bind.as_str() && track.get("entityId").is_none())
        {
            Some(track) => {
                before.push(json!({"id": track["id"], "bind": lane.bind, "created": false,
                    "points": track["points"].as_array().into_iter().flatten().filter(|point| inside(point)).cloned().collect::<Vec<_>>()}));
                let mut merged: Vec<Value> = track["points"]
                    .as_array()
                    .cloned()
                    .unwrap_or_default()
                    .into_iter()
                    .filter(|point| {
                        let time = point["time"].as_f64().unwrap_or(-1.0);
                        time < from || time > to
                    })
                    .chain(points)
                    .collect();
                merged.sort_by(|a, b| {
                    let (a, b) = (
                        a["time"].as_f64().unwrap_or(0.0),
                        b["time"].as_f64().unwrap_or(0.0),
                    );
                    a.total_cmp(&b)
                });
                track["points"] = Value::Array(merged);
            }
            None => {
                if tracks.len() >= TRACKS {
                    return Err(format!("A Scene holds at most {TRACKS} property lanes"));
                }
                before
                    .push(json!({"id": lane.id, "bind": lane.bind, "created": true, "points": []}));
                tracks.push(json!({"id": lane.id, "bind": lane.bind, "points": points}));
            }
        }
    }
    let before = json!({"lanes": before, "duration": material["duration"], "propertyTakeRange": material["propertyTakeRange"]});
    let duration = material["duration"]
        .as_f64()
        .unwrap_or(0.0)
        .max(to)
        .min(SECONDS);
    material["propertyTakeRange"] = json!({"start": from, "end": to});
    material["propertyTracks"] = Value::Array(tracks);
    material["duration"] = json!(duration);
    Ok((material, before))
}

/// A kept take given back (`expressions.take.unkeep`, Undo's way back for a keep): inside the stretch it was kept over, each of its
/// binds' main lanes holds again what it held before the keep (a lane the keep made is taken away), and the Scene's length and take
/// range stand as they stood. Moves made since on that stretch of those lanes give way to it, as an Undo's do.
pub fn unkeep(material: &Value, kept: &Kept) -> Result<Value, String> {
    let before = kept
        .before
        .as_ref()
        .ok_or("This take was kept before the main lane remembered what it laid over, so there is nothing to give back")?;
    let (from, to) = (kept.from_s.0, kept.to_s.0);
    let mut material = material.clone();
    let mut tracks: Vec<Value> = material["propertyTracks"]
        .as_array()
        .cloned()
        .unwrap_or_default();
    for lane in before["lanes"].as_array().into_iter().flatten() {
        let bind = lane["bind"].as_str().unwrap_or_default();
        let at = tracks
            .iter()
            .position(|track| track["bind"] == bind && track.get("entityId").is_none());
        let Some(at) = at else { continue };
        if lane["created"] == true {
            tracks.remove(at);
            continue;
        }
        let mut points: Vec<Value> = tracks[at]["points"]
            .as_array()
            .cloned()
            .unwrap_or_default()
            .into_iter()
            .filter(|point| {
                let time = point["time"].as_f64().unwrap_or(-1.0);
                time < from || time > to
            })
            .chain(lane["points"].as_array().cloned().unwrap_or_default())
            .collect();
        points.sort_by(|a, b| {
            let (a, b) = (
                a["time"].as_f64().unwrap_or(0.0),
                b["time"].as_f64().unwrap_or(0.0),
            );
            a.total_cmp(&b)
        });
        tracks[at]["points"] = Value::Array(points);
    }
    let fields = material
        .as_object_mut()
        .ok_or("The Scene's material is not an object")?;
    if tracks.is_empty() {
        fields.remove("propertyTracks");
    } else {
        fields.insert("propertyTracks".into(), Value::Array(tracks));
    }
    for key in ["duration", "propertyTakeRange"] {
        match &before[key] {
            Value::Null => {
                fields.remove(key);
            }
            value => {
                fields.insert(key.into(), value.clone());
            }
        }
    }
    Ok(material)
}

/// The automated target a Field bind's write is held on (the frame's `live hold`: an enabled automation lane drives it), if one is.
pub fn automated_target(material: &Value, bind_name: &str) -> Option<String> {
    let target = format!("field.{}", bind(bind_name)?.key);
    material["automation"]
        .as_array()?
        .iter()
        .any(|lane| lane["target"] == target.as_str() && lane["enabled"] != false)
        .then_some(target)
}

/// A recorded lane's device and parameter, from its binding (the Scene's own parameter names stand where the binding is a Field's).
fn bind_words(bind: &str) -> (String, String) {
    if let Some(parameter) = bind.strip_prefix("field.params.") {
        return ("Field".into(), parameter.into());
    }
    let (head, rest) = bind.split_once('.').unwrap_or((bind, ""));
    let device = if head == "entity" {
        "Symbol"
    } else if head.is_empty() {
        "Scene"
    } else {
        head
    };
    (
        device.into(),
        if rest.is_empty() {
            bind.into()
        } else {
            rest.into()
        },
    )
}

/// A Scene's automation lanes as the Set lays them (manual §16.6; XT10): each recorded lane (a property track: a kept take's moves or
/// a lane drawn) with its points on its value's own range, drawable there — or, where the Scene no longer holds what it moves or it
/// moves an object, normalised to the span it recorded and not drawn — and each enabled generator lane, naming what moves its value.
pub fn lanes(material: &Value) -> Vec<Value> {
    let recorded = material["propertyTracks"].as_array().into_iter().flatten().map(|track| {
        let bind_name = track["bind"].as_str().unwrap_or_default();
        let field = bind(bind_name).filter(|_| track.get("entityId").is_none());
        let values: Vec<f64> = track["points"].as_array().into_iter().flatten().filter_map(|p| p["value"].as_f64()).collect();
        let (min, max) = match field {
            Some(binding) => (binding.hard_min, binding.hard_max),
            None if values.is_empty() => (0.0, 0.0),
            None => (values.iter().copied().fold(f64::INFINITY, f64::min), values.iter().copied().fold(f64::NEG_INFINITY, f64::max)),
        };
        let spread = max - min;
        let (device, parameter) = bind_words(bind_name);
        let points: Vec<Value> = track["points"].as_array().into_iter().flatten().map(|point| {
            let value = point["value"].as_f64().unwrap_or(0.0);
            json!({"at": point["time"], "value": if spread > 0.0 { ((value - min) / spread).clamp(0.0, 1.0) } else { 0.5 }})
        }).collect();
        json!({"id": track["id"], "device": device, "parameter": parameter, "range": {"min": min, "max": max},
            "drawable": field.is_some() && spread > 0.0, "points": points})
    });
    let generated = material["automation"].as_array().into_iter().flatten().filter(|lane| lane["enabled"] != false).map(|lane| {
        let (device, parameter) = bind_words(lane["target"].as_str().unwrap_or_default());
        let blend = lane["blend"].as_str().unwrap_or_default();
        let moves = format!("{} · {} · {} Hz · {}", lane["type"].as_str().unwrap_or_default(), lane["wave"].as_str().unwrap_or_default(),
            lane["rate"], if blend == "replace" { "automation".to_owned() } else { format!("modulation ({blend})") });
        json!({"id": lane["id"], "device": device, "parameter": parameter, "range": {"min": lane["min"], "max": lane["max"]},
            "modulated_by": moves, "points": []})
    });
    recorded.chain(generated).collect()
}

/// The most points a lane is drawn with (nativeTrackEdits.ts `DRAW_POINTS`), as many as a Live envelope drawn across a Scene keeps.
pub const DRAWN_POINTS: usize = 512;

/// A recorded lane drawn (nativeTrackEdits.ts `applyNativeTrackChanges`, `track-draw`; XT10): the points drawn lie over the stretch
/// they cover, inside the Scene and the value's range, and the moves outside it stay; a kept move's curve handle never reaches into
/// the stretch drawn over. A value shared by All scenes is not recorded, so it is not drawn. The material as it stands after.
pub fn draw(
    material: &Value,
    shared: Option<&Value>,
    track_id: &str,
    drawn: &[(f64, f64)],
) -> Result<Value, String> {
    const REFUSAL: &str = "Draw a lane with 2 to 512 points, in time order, from 0 to 3600 s.";
    if drawn.len() < 2 || drawn.len() > DRAWN_POINTS {
        return Err(REFUSAL.into());
    }
    let mut last = f64::NEG_INFINITY;
    for (time, value) in drawn {
        if !time.is_finite()
            || !value.is_finite()
            || *time < 0.0
            || *time > SECONDS
            || *time <= last
        {
            return Err(REFUSAL.into());
        }
        last = *time;
    }
    let gone = "The recorded property track no longer belongs to this Scene. Read it again.";
    let found = material["propertyTracks"]
        .as_array()
        .and_then(|tracks| tracks.iter().find(|track| track["id"] == track_id))
        .ok_or(gone)?;
    let Some(binding) = found["bind"]
        .as_str()
        .and_then(bind)
        .filter(|_| found.get("entityId").is_none())
    else {
        return Err("This lane moves an object of the field: draw it in the field's own editor, where the object's range is read.".into());
    };
    if is_shared(shared, material, &binding.bind) {
        return Err(
            "A macro set to All scenes is not recorded. Turn All scenes off to draw its moves."
                .into(),
        );
    }
    let mut material = material.clone();
    let duration = material["duration"].as_f64().unwrap_or(0.0);
    let track = material["propertyTracks"]
        .as_array_mut()
        .and_then(|tracks| tracks.iter_mut().find(|track| track["id"] == track_id))
        .ok_or(gone)?;
    let (from, to) = (drawn[0].0, drawn[drawn.len() - 1].0);
    if to > duration {
        return Err(format!(
            "A lane is drawn within its scene: 0 to {duration} s."
        ));
    }
    if let Some((_, value)) = drawn
        .iter()
        .find(|(_, value)| *value < binding.hard_min || *value > binding.hard_max)
    {
        return Err(format!(
            "{} moves between {} and {}: {value} lies outside it.",
            binding.label, binding.hard_min, binding.hard_max
        ));
    }
    let kept = track["points"]
        .as_array()
        .cloned()
        .unwrap_or_default()
        .into_iter()
        .filter_map(|mut point| {
            let time = point["time"].as_f64()?;
            if time >= from && time <= to {
                return None;
            }
            if let Some(fields) = point.as_object_mut() {
                if time > from {
                    fields.remove("in");
                }
                if time < to {
                    fields.remove("out");
                }
            }
            Some(point)
        });
    let mut points: Vec<Value> = kept
        .chain(
            drawn
                .iter()
                .map(|(time, value)| json!({"time": time, "value": value})),
        )
        .collect();
    points.sort_by(|a, b| {
        let (a, b) = (
            a["time"].as_f64().unwrap_or(0.0),
            b["time"].as_f64().unwrap_or(0.0),
        );
        a.total_cmp(&b)
    });
    track["points"] = Value::Array(points);
    Ok(material)
}

/// A take as the reading and the Set name it: `state` is `running` while it records, else `returned`.
pub fn take_summary(take: &StudioTake, running: bool) -> Value {
    json!({"take_ref": take.take_ref, "kind": "studio", "lane": take.lane, "start_s": take.start_s.0, "seconds": take.seconds.0,
        "binds": take.tracks.iter().map(|t| t.bind.as_str()).collect::<Vec<_>>(),
        "points": take.tracks.iter().map(|t| t.points.len()).sum::<usize>(),
        "state": if running { "running" } else { "returned" },
        "kept": take.kept.as_ref().map(|kept| json!({"from_s": kept.from_s.0, "to_s": kept.to_s.0}))})
}

/// The Studio of a Scene as the reading and the Set give it: every Field value and every setting it holds.
pub fn studio(scene_ref: &str, material: &Value, shared: Option<&Value>) -> Value {
    let values: Map<String, Value> = values(material, shared).into_iter().collect();
    let settings: Map<String, Value> = settings(material, shared).into_iter().collect();
    json!({"scene_ref": scene_ref, "values": values, "settings": settings})
}

#[cfg(test)]
mod tests {
    use super::*;

    fn scene() -> Value {
        blank_scene("expression:t:scene:main", "Untitled scene")
    }

    #[test]
    fn the_table_is_the_generated_one_and_new_s_scene_comes_from_it() {
        assert!(binds().len() > 100);
        let time = bind("field.params.timeScale").expect("Tempo's binding");
        assert_eq!(time.key, "timeScale");
        assert!(
            bind("field.timeScale").is_some(),
            "a device target names the same binding"
        );
        let blank = scene();
        assert_eq!(blank["id"], "expression:t:scene:main");
        assert_eq!(blank["field"]["params"]["timeScale"].as_f64(), Some(1.0));
        assert_eq!(blank_title(), "Untitled scene");
    }

    #[test]
    fn a_value_is_written_inside_its_bounds_and_read_back_with_its_default() {
        let one = writes(&json!({"bind": "field.params.timeScale", "value": 1.5})).unwrap();
        let moved = write(&scene(), None, &one).unwrap();
        assert_eq!(
            moved.material["field"]["params"]["timeScale"].as_f64(),
            Some(1.5)
        );
        assert!(!moved.shared_moved);
        let read = values(&moved.material, None);
        assert_eq!(read["field.params.timeScale"].as_f64(), Some(1.5));
        let out = writes(&json!({"bind": "field.params.timeScale", "value": 1e9})).unwrap();
        assert!(write(&scene(), None, &out)
            .unwrap_err()
            .contains("must be between"));
        assert!(writes(&json!({"bind": "field.params.nothing", "value": 1})).is_err());
    }

    #[test]
    fn a_shared_value_is_written_to_the_expression_and_a_replacing_lane_is_offset() {
        let shared =
            json!({"toolbelt": [], "values": {"field.params.timeScale": 1}, "pointer": {}});
        let moved = write(
            &scene(),
            Some(&shared),
            &writes(&json!({"bind": "field.params.timeScale", "value": 2})).unwrap(),
        )
        .unwrap();
        assert!(moved.shared_moved);
        assert_eq!(
            moved.shared.unwrap()["values"]["field.params.timeScale"],
            json!(2)
        );
        assert_eq!(
            moved.material["field"]["params"]["timeScale"].as_f64(),
            Some(1.0),
            "the Scene keeps its own"
        );
        let mut automated = scene();
        automated["automation"] = json!([{"id": "a", "target": "field.timeScale", "enabled": true, "blend": "replace", "min": 0.5, "max": 1.5}]);
        let refused = write(
            &automated,
            None,
            &writes(&json!({"bind": "field.params.timeScale", "value": 2})).unwrap(),
        );
        assert!(refused
            .unwrap_err()
            .contains("Read the effective automated value"));
        let moved = write(
            &automated,
            None,
            &writes(&json!({"bind": "field.params.timeScale", "value": 2, "observed": 1})).unwrap(),
        )
        .unwrap();
        assert_eq!(moved.material["automation"][0]["min"].as_f64(), Some(1.5));
        assert_eq!(
            moved.material["field"]["params"]["timeScale"].as_f64(),
            Some(1.0)
        );
    }

    #[test]
    fn a_setting_takes_a_listed_value_and_the_pointer_scope_copies_the_pointer() {
        let on = writes(
            &json!({"setting": {"kind": "field-setting", "key": "mediumEnabled"}, "value": true}),
        )
        .unwrap();
        let moved = write(&scene(), None, &on).unwrap();
        assert_eq!(moved.material["engine"]["mediumEnabled"], json!(true));
        assert_eq!(
            settings(&moved.material, None)["field-setting:mediumEnabled"],
            json!(true)
        );
        let wrong = writes(
            &json!({"setting": {"kind": "field-setting", "key": "mediumEnabled"}, "value": "yes"}),
        )
        .unwrap();
        assert!(write(&scene(), None, &wrong).is_err());
        let local = writes(
            &json!({"setting": {"kind": "panel-setting", "key": "pointerScope"}, "value": "local"}),
        )
        .unwrap();
        let moved = write(&scene(), None, &local).unwrap();
        assert_eq!(moved.material["pointerScope"], "local");
    }

    #[test]
    fn a_recorded_take_is_stamped_in_order_closed_and_kept_into_the_main_lane() {
        let mut recording = Recording {
            expression_ref: "expression:t".into(),
            scene_ref: "expression:t:scene:main".into(),
            take: StudioTake {
                take_ref: "expression:t:scene:main:take:1".into(),
                lane: 1,
                start_s: Finite(0.0),
                seconds: Finite(0.0),
                tracks: vec![],
                kept: None,
            },
            started_at_unix_ms: 10_000,
        };
        recording
            .record("field.params.timeScale", 1.2, 10_500)
            .unwrap();
        recording
            .record("field.params.timeScale", 1.4, 10_800)
            .unwrap();
        let mut material = scene();
        material["field"]["params"]["timeScale"] = json!(1.4);
        let take = recording.close(&material, None, 11_000);
        assert_eq!(take.tracks[0].points.len(), 3);
        assert_eq!(take.tracks[0].points[0].time.0, 0.5);
        assert_eq!(take.tracks[0].points[2].time.0, 1.0);
        assert_eq!(take.seconds.0, 1.0);
        validate_takes("expression:t:scene:main", std::slice::from_ref(&take)).unwrap();
        let (kept, _) = keep(&material, &take, 0.0, take.seconds.0).unwrap();
        let lane = &kept["propertyTracks"][0];
        assert_eq!(lane["bind"], "field.params.timeScale");
        assert_eq!(lane["points"].as_array().unwrap().len(), 3);
        assert_eq!(kept["propertyTakeRange"]["end"].as_f64(), Some(1.0));
    }
}
