//! Retained physical-musical work on the existing native Expression Scene.
//! This module computes prospective edits and bounded replay/export material.
//! Document::edited/Act editions own mutation/history; Central files own save.
//! Audio advances its existing sample cursor. No callback, clock, store, graph,
//! pitch generator, codon classifier or private project format lives here.
use crate::expression::{Availability, ReadingRef};
use serde::{Deserialize, Deserializer, Serialize, Serializer};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, BTreeSet};

pub const SCHEMA: &str = "oi.expression-performance/v1";
pub const SOURCE_SCHEMA: &str = "oi.expression-performance/v2";
pub const RECORDING_SCHEMA: &str = "oi.expression-performance/v3";
pub const BASIS_SCHEMA: &str = "oi.expression-performance-basis/v1";
pub const CHECKPOINT_SCHEMA: &str = "oi.expression-performance-checkpoint/v1";
pub const MAX_PAGE_EVENTS: usize = 4096;
pub const RETAINED_PAGE_EVENTS: usize = 128;
pub const MAX_PAGES: usize = MAX_EVENTS / RETAINED_PAGE_EVENTS + 1;
pub const MAX_EVENTS: usize = 262_144;
pub const MAX_BASES: usize = 256;
pub const MAX_PITCHES: usize = 4096;
pub const MAX_LAYERS: usize = 64;
pub const MAX_ROUTES: usize = 256;
pub const MAX_CHECKPOINTS: usize = 256;
pub const MAX_PERFORMANCE_BYTES: usize = 8 * 1024 * 1024;
pub const MAX_CHECKPOINT_BYTES: usize = 1024 * 1024;
pub const MAX_PREPARED_OPERATIONS: usize = 256;

/// Canonical decimal transport preserves the entire native u64 sample domain.
#[derive(Clone, Copy, Debug, Default, Eq, Ord, PartialEq, PartialOrd)]
pub struct Counter(pub u64);
impl Serialize for Counter {
    fn serialize<S: Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&self.0.to_string())
    }
}
impl<'de> Deserialize<'de> for Counter {
    fn deserialize<D: Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
        let text = String::deserialize(d)?;
        let value = text.parse::<u64>().map_err(serde::de::Error::custom)?;
        if text != value.to_string() {
            return Err(serde::de::Error::custom("noncanonical performance counter"));
        }
        Ok(Self(value))
    }
}
/// Native Scene equality remains total. NaN/infinity cannot enter a Document.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct Scalar(u64);
impl Scalar {
    pub fn new(value: f64) -> Result<Self, String> {
        if !value.is_finite() {
            return Err("performance scalar must be finite".into());
        }
        Ok(Self((if value == 0.0 { 0.0 } else { value }).to_bits()))
    }
    pub fn value(self) -> f64 {
        f64::from_bits(self.0)
    }
}
impl Serialize for Scalar {
    fn serialize<S: Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_f64(self.value())
    }
}
impl<'de> Deserialize<'de> for Scalar {
    fn deserialize<D: Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
        Self::new(f64::deserialize(d)?).map_err(serde::de::Error::custom)
    }
}
fn text(value: &str) -> Result<(), String> {
    if value.trim().is_empty() || value.len() > 4096 || value.chars().any(char::is_control) {
        return Err("bounded printable performance reference required".into());
    }
    Ok(())
}
fn range(value: Scalar, low: f64, high: f64) -> Result<(), String> {
    let v = value.value();
    if v < low || v > high {
        return Err("performance magnitude outside native bounds".into());
    }
    Ok(())
}
fn reading(value: &ReadingRef) -> Result<(), String> {
    text(&value.r#ref)?;
    text(&value.revision)
}
fn digest<T: Serialize + ?Sized>(value: &T) -> Result<String, String> {
    let bytes = serde_json::to_vec(value).map_err(|e| e.to_string())?;
    Ok(format!("sha256:{:x}", Sha256::digest(bytes)))
}
pub(crate) fn safe(value: &Value, depth: usize) -> Result<(), String> {
    if depth > 48 {
        return Err("performance native reading nesting budget exceeded".into());
    }
    match value {
        Value::String(v) if v.contains('\0') => return Err("performance contains NUL".into()),
        Value::Array(v) => {
            if v.len() > 4096 {
                return Err("performance native reading array budget exceeded".into());
            }
            for x in v {
                safe(x, depth + 1)?;
            }
        }
        Value::Object(v) => {
            for (key, x) in v {
                if ["__proto__", "prototype"].contains(&key.as_str())
                    || (key == "constructor"
                        && !crate::expression_performance_source_asset::native_constructor_metadata(v))
                {
                    return Err("unsafe performance native reading key".into());
                }
                safe(x, depth + 1)?;
            }
        }
        _ => {}
    }
    Ok(())
}
fn member<'a>(value: &'a Value, path: &str) -> Result<&'a Value, String> {
    value
        .pointer(path)
        .filter(|v| !v.is_null())
        .ok_or_else(|| format!("required retained native reading absent: {path}"))
}
fn equal_string(value: &Value, path: &str, expected: &str) -> Result<(), String> {
    if member(value, path)?.as_str() != Some(expected) {
        return Err(format!(
            "retained native identity/contract mismatch: {path}"
        ));
    }
    Ok(())
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Identity {
    pub instance_ref: String,
    pub event_ref: String,
    pub subject_ref: String,
    pub m1_revision: Counter,
    pub m2_generation: Counter,
    pub m3_generation: Counter,
    pub occurrence_unix_ms: Counter,
    pub receipt_unix_ms: Counter,
}
impl Identity {
    pub(crate) fn validate(&self) -> Result<(), String> {
        for v in [&self.instance_ref, &self.event_ref, &self.subject_ref] {
            text(v)?;
        }
        if self.receipt_unix_ms < self.occurrence_unix_ms {
            return Err("performance receipt precedes occurrence".into());
        }
        Ok(())
    }
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ContextKind {
    World,
    Personal,
    Shared,
}
#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum OccasionMode {
    Live,
    OriginalReplay,
    Reinterpretation,
}
/// Protected personal state stays at its existing owner, represented by refs.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct ContextBinding {
    pub kind: ContextKind,
    pub occasion_mode: OccasionMode,
    pub context: ReadingRef,
    pub receiver: ReadingRef,
    pub source_occasion: Option<ReadingRef>,
    pub protected_state: Option<ReadingRef>,
    pub consent: Option<ReadingRef>,
    pub private: bool,
}
impl ContextBinding {
    pub(crate) fn validate(&self) -> Result<(), String> {
        for v in [&self.context, &self.receiver] {
            reading(v)?;
        }
        for v in [&self.protected_state, &self.source_occasion, &self.consent]
            .into_iter()
            .flatten()
        {
            reading(v)?;
        }
        if self.kind == ContextKind::Personal
            && (!self.private || self.protected_state.is_none() || self.source_occasion.is_none())
        {
            return Err("personal performance requires protected private context".into());
        }
        if self.kind == ContextKind::Shared
            && (!self.private
                || self.protected_state.is_none()
                || self.consent.is_none()
                || self.source_occasion.is_none())
        {
            return Err("shared performance requires native consent reading".into());
        }
        if self.kind == ContextKind::World
            && (self.private
                || self.protected_state.is_some()
                || self.source_occasion.is_some()
                || self.consent.is_some())
        {
            return Err("World performance requires ordinary public neutral context".into());
        }
        Ok(())
    }
}

/// These are exact opaque outputs of the domain owners, not reconstructed
/// correspondence tables. Native producers still validate their own semantics.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct PerformanceBasis {
    pub schema: String,
    pub identity: Identity,
    pub sources: Vec<ReadingRef>,
    pub m1_coordinate: String,
    pub m1_prime: bool,
    pub m1: Value,
    pub m2_plan: Value,
    pub audio_determination: Value,
    pub m3_score: Value,
    pub m3_replay: Value,
    pub m4_episode: Option<Value>,
    pub prepared_body: Value,
    pub tuning: Value,
    pub force_state: Value,
    pub form_state: Value,
    pub context: ContextBinding,
    pub seed: Counter,
    pub required_assets: Vec<ReadingRef>,
    /// Hash of every field above, sealed only after native producer validation.
    pub content_digest: String,
}
impl PerformanceBasis {
    fn hash(&self) -> Result<String, String> {
        // Excludes only the self-digest. Removing any determining relation
        // changes this fingerprint, even if a renderer still shows a label.
        // serde implements native Rust tuples only through length 16. Serialize
        // the original 18-element tuple explicitly; field order and JSON bytes
        // remain the v1 basis fingerprint, without an intermediate Value map.
        struct BasisDigest<'a>(&'a PerformanceBasis);
        impl Serialize for BasisDigest<'_> {
            fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
                use serde::ser::SerializeTuple;
                let b = self.0;
                let mut tuple = serializer.serialize_tuple(18)?;
                tuple.serialize_element(&b.schema)?;
                tuple.serialize_element(&b.identity)?;
                tuple.serialize_element(&b.sources)?;
                tuple.serialize_element(&b.m1_coordinate)?;
                tuple.serialize_element(&b.m1_prime)?;
                tuple.serialize_element(&b.m1)?;
                tuple.serialize_element(&b.m2_plan)?;
                tuple.serialize_element(&b.audio_determination)?;
                tuple.serialize_element(&b.m3_score)?;
                tuple.serialize_element(&b.m3_replay)?;
                tuple.serialize_element(&b.m4_episode)?;
                tuple.serialize_element(&b.prepared_body)?;
                tuple.serialize_element(&b.tuning)?;
                tuple.serialize_element(&b.force_state)?;
                tuple.serialize_element(&b.form_state)?;
                tuple.serialize_element(&b.context)?;
                tuple.serialize_element(&b.seed)?;
                tuple.serialize_element(&b.required_assets)?;
                tuple.end()
            }
        }
        digest(&BasisDigest(self))
    }
    pub fn seal(mut self) -> Result<Self, String> {
        self.validate_content()?;
        self.content_digest = self.hash()?;
        Ok(self)
    }
    pub fn validate(&self) -> Result<(), String> {
        self.validate_content()?;
        if self.hash()? != self.content_digest {
            return Err("retained performance basis lost or altered a determining relation".into());
        }
        Ok(())
    }
    fn validate_content(&self) -> Result<(), String> {
        if self.schema != BASIS_SCHEMA {
            return Err("unsupported retained performance basis schema".into());
        }
        self.identity.validate()?;
        self.context.validate()?;
        text(&self.m1_coordinate)?;
        if self.sources.is_empty() || self.sources.len() > 256 || self.required_assets.len() > 256 {
            return Err("performance source/asset basis budget exceeded or empty".into());
        }
        let mut refs = BTreeSet::new();
        for v in &self.sources {
            reading(v)?;
            if !refs.insert((&v.r#ref, &v.revision)) {
                return Err("duplicate performance source basis".into());
            }
        }
        for v in &self.required_assets {
            reading(v)?;
        }
        for value in [
            &self.m1,
            &self.m2_plan,
            &self.audio_determination,
            &self.m3_score,
            &self.m3_replay,
            &self.prepared_body,
            &self.tuning,
            &self.force_state,
            &self.form_state,
        ] {
            if !value.is_object() {
                return Err("complete native performance reading required".into());
            }
            safe(value, 0)?;
        }
        if let Some(episode) = &self.m4_episode {
            safe(episode, 0)?;
        }
        equal_string(&self.m2_plan, "/schema", "epi.m2.relation-plan.v1")?;
        equal_string(&self.m1, "/config/event_ref", &self.identity.event_ref)?;
        equal_string(&self.m1, "/config/selected_coordinate", &self.m1_coordinate)?;
        equal_string(
            &self.m1,
            "/config/revision",
            &self.identity.m1_revision.0.to_string(),
        )?;
        for path in [
            "/clock/tick12",
            "/clock/degree720",
            "/source",
            "/carrier",
            "/music",
            "/relations",
        ] {
            member(&self.m1, path)?;
        }
        equal_string(
            &self.m2_plan,
            "/nativeExtension",
            "ql.m2-relation-plan/native-v1",
        )?;
        equal_string(
            &self.m2_plan,
            "/identity/event_ref",
            &self.identity.event_ref,
        )?;
        if member(&self.m2_plan, "/identity/profile_generation")?.as_u64()
            != Some(self.identity.m2_generation.0)
        {
            return Err("retained M2 generation mismatch".into());
        }
        member(&self.m2_plan, "/sourceReceipts/operations")?;
        member(&self.m2_plan, "/sourceReceipts/relationSets")?;
        member(&self.m2_plan, "/inputBasisSha256")?;
        equal_string(
            &self.audio_determination,
            "/identity/instance",
            &self.identity.instance_ref,
        )?;
        equal_string(
            &self.audio_determination,
            "/identity/event",
            &self.identity.event_ref,
        )?;
        equal_string(
            &self.audio_determination,
            "/identity/subject",
            &self.identity.subject_ref,
        )?;
        equal_string(
            &self.audio_determination,
            "/identity/m1_revision",
            &self.identity.m1_revision.0.to_string(),
        )?;
        equal_string(
            &self.audio_determination,
            "/identity/m2_generation",
            &self.identity.m2_generation.0.to_string(),
        )?;
        equal_string(
            &self.audio_determination,
            "/m1_coordinate",
            &self.m1_coordinate,
        )?;
        if member(&self.audio_determination, "/m1_face")?.as_u64() != Some(u64::from(self.m1_prime))
            || member(&self.audio_determination, "/audio_octet_hz")?
                .as_array()
                .map(Vec::len)
                != Some(8)
            || member(&self.audio_determination, "/nodal_quartet")?
                .as_array()
                .map(Vec::len)
                != Some(4)
        {
            return Err("retained native M1 face/M2 audible-nodal roles differ".into());
        }
        equal_string(
            &self.audio_determination,
            "/body_preparation_ref",
            member(&self.prepared_body, "/request/preparation_ref")?
                .as_str()
                .ok_or("body preparation ref absent")?,
        )?;
        equal_string(
            &self.audio_determination,
            "/body_state_ref",
            member(&self.prepared_body, "/request/state_ref")?
                .as_str()
                .ok_or("body state ref absent")?,
        )?;
        for path in ["/request", "/commands", "/receipts"] {
            member(&self.m3_replay, path)?;
        }
        equal_string(&self.m3_score, "/schema", "ql.m3-state/v1")?;
        equal_string(
            &self.m3_score,
            "/identity/event_ref",
            &self.identity.event_ref,
        )?;
        equal_string(&self.m3_score, "/subject_ref", &self.identity.subject_ref)?;
        if member(&self.m3_score, "/identity/profile_generation")?.as_u64()
            != Some(self.identity.m3_generation.0)
        {
            return Err("retained M3 generation mismatch".into());
        }
        for path in [
            "/form/codon/ref",
            "/form/hexagram/ref",
            "/form/pose_ordinal",
            "/form/matrix_axis",
            "/transcription/sequence",
            "/transcription/source",
            "/clock/steps",
            "/clock/degree720",
            "/tarot",
            "/bases",
        ] {
            member(&self.m3_score, path)?;
        }
        equal_string(
            &self.prepared_body,
            "/schema",
            "ql.physical-body-preparation/v1",
        )?;
        equal_string(&self.prepared_body, "/contract", "ql.physical-body/v1")?;
        equal_string(&self.prepared_body, "/event_ref", &self.identity.event_ref)?;
        equal_string(
            &self.prepared_body,
            "/subject_ref",
            &self.identity.subject_ref,
        )?;
        if member(&self.prepared_body, "/source_generation")?.as_u64()
            != Some(self.identity.m3_generation.0)
        {
            return Err("retained body is detached from native M3 generation".into());
        }
        for path in [
            "/request/preparation_ref",
            "/request/state_ref",
            "/request/body_revision",
            "/request/geometry",
            "/request/material",
            "/request/exciter",
            "/request/pickup",
            "/request/sample_rate",
            "/form",
            "/clock",
            "/units",
        ] {
            member(&self.prepared_body, path)?;
        }
        if self.form_state != *member(&self.prepared_body, "/form")? {
            return Err("retained performance form differs from prepared native body".into());
        }
        // Explicit unavailable authentic material is valid retained history,
        // and readiness rejects sounding it. It is never filled by 12-TET.
        member(&self.tuning, "/policy_ref")?;
        member(&self.tuning, "/source_ref")?;
        member(&self.tuning, "/revision")?;
        member(&self.tuning, "/standing")?;
        if member(&self.tuning, "/available")?.as_bool().is_none() {
            return Err("explicit tuning availability required".into());
        }
        equal_string(&self.force_state, "/unit", "N")?;
        equal_string(
            &self.force_state,
            "/preparation_ref",
            member(&self.prepared_body, "/request/preparation_ref")?
                .as_str()
                .ok_or("body preparation ref absent")?,
        )?;
        equal_string(
            &self.force_state,
            "/state_ref",
            member(&self.prepared_body, "/request/state_ref")?
                .as_str()
                .ok_or("body state ref absent")?,
        )?;
        for path in ["/source_ref", "/revision", "/exciter"] {
            member(&self.force_state, path)?;
        }
        if self.force_state["exciter"] != self.prepared_body["request"]["exciter"] {
            return Err("force context differs from exact native exciter".into());
        }
        if let Some(episode) = &self.m4_episode {
            equal_string(episode, "/event/event_ref", &self.identity.event_ref)?;
            equal_string(episode, "/event/subject_ref", &self.identity.subject_ref)?;
            equal_string(episode, "/subject_id", &self.identity.subject_ref)?;
            let source = self
                .context
                .source_occasion
                .as_ref()
                .ok_or("native episode requires its exact source occasion reading")?;
            equal_string(episode, "/occasion_ref", &source.r#ref)?;
            if let Some(protected) = &self.context.protected_state {
                equal_string(episode, "/protected_state_ref/ref_id", &protected.r#ref)?;
                equal_string(
                    episode,
                    "/protected_state_ref/revision",
                    &protected.revision,
                )?;
            }
            for path in [
                "/occasion_ref",
                "/identity_revision",
                "/day_ref",
                "/now_ref",
                "/protected_state_ref",
                "/source_revisions",
            ] {
                member(episode, path)?;
            }
        }
        if self.context.kind == ContextKind::World && self.m4_episode.is_some() {
            return Err("World performance cannot retain a protected native episode".into());
        }
        if self.context.kind != ContextKind::World && self.m4_episode.is_none() {
            return Err("situated performance requires its exact original native episode".into());
        }
        Ok(())
    }
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Ratio {
    pub numerator: Counter,
    pub denominator: Counter,
}
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Pitch {
    pub basis: u16,
    pub source_coordinate: String,
    pub source_prime: bool,
    pub key: u8,
    pub pitch_class: u8,
    pub register: i8,
    pub fundamental_hz: Scalar,
    pub hertz: Scalar,
    pub exact_ratio: Option<Ratio>,
    pub tuning_ref: String,
}
impl Pitch {
    fn validate(&self, bases: &[PerformanceBasis], rate: u32) -> Result<(), String> {
        let basis = bases
            .get(usize::from(self.basis))
            .ok_or("pitch basis absent")?;
        text(&self.tuning_ref)?;
        if self.source_coordinate != basis.m1_coordinate
            || self.source_prime != basis.m1_prime
            || self.key >= 12
            || self.pitch_class >= 12
            || !(-32..=32).contains(&self.register)
        {
            return Err("pitch native coordinate/phase identity mismatch".into());
        }
        range(self.hertz, 0.001, f64::from(rate) * 0.45)?;
        range(self.fundamental_hz, 0.001, f64::from(rate) * 0.45)?;
        if let Some(ratio) = &self.exact_ratio {
            if ratio.numerator.0 == 0 || ratio.denominator.0 == 0 {
                return Err("invalid exact retained ratio".into());
            }
            let hertz =
                self.fundamental_hz.value() * ratio.numerator.0 as f64 / ratio.denominator.0 as f64;
            if (hertz - self.hertz.value()).abs() > self.hertz.value() * 1e-11 {
                return Err("retained Hz differs from exact native ratio".into());
            }
        }
        Ok(())
    }
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Layer {
    pub layer_ref: String,
    pub title: String,
    pub enabled: bool,
    pub solo: bool,
}
#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Scope {
    Note,
    Instrument,
    Body,
    Context,
    Presentation,
}
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct ParameterTarget {
    pub native_owner: String,
    pub action_ref: String,
    pub target_ref: String,
    pub unit: String,
    pub scope: Scope,
    pub minimum: Scalar,
    pub maximum: Scalar,
    pub baseline: Scalar,
    pub smoothing_samples: Counter,
}
impl ParameterTarget {
    fn validate(&self) -> Result<(), String> {
        for v in [
            &self.native_owner,
            &self.action_ref,
            &self.target_ref,
            &self.unit,
        ] {
            text(v)?;
        }
        if self.minimum.value() > self.maximum.value() {
            return Err("parameter range reversed".into());
        }
        range(self.baseline, self.minimum.value(), self.maximum.value())
    }
}
#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Transfer {
    Replace,
    Add,
    Multiply,
}
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct ModulationRoute {
    pub route_ref: String,
    pub source: ReadingRef,
    pub source_unit: String,
    pub destination: ParameterTarget,
    pub transfer: Transfer,
    pub amount: Scalar,
    pub delay_samples: Counter,
    pub feedback: bool,
    pub enabled: bool,
}
impl ModulationRoute {
    fn validate(&self) -> Result<(), String> {
        text(&self.route_ref)?;
        reading(&self.source)?;
        text(&self.source_unit)?;
        self.destination.validate()?;
        if self.source_unit != self.destination.unit && self.source_unit != "normalized" {
            return Err("modulation source/destination dimensions differ".into());
        }
        if self.transfer == Transfer::Multiply && self.source_unit != "normalized" {
            return Err("multiplicative modulation must be dimensionless".into());
        }
        if self.feedback && (self.delay_samples.0 == 0 || self.amount.value().abs() >= 1.0) {
            return Err("feedback requires explicit delay and bounded sub-unity gain".into());
        }
        Ok(())
    }
    pub fn effective(&self, source: Scalar) -> Result<Scalar, String> {
        self.validate()?;
        if !self.enabled {
            return Ok(self.destination.baseline);
        }
        let baseline = self.destination.baseline.value();
        let amount = self.amount.value() * source.value();
        let value = match self.transfer {
            Transfer::Replace => amount,
            Transfer::Add => baseline + amount,
            Transfer::Multiply => baseline * amount,
        };
        let value = Scalar::new(value)?;
        range(
            value,
            self.destination.minimum.value(),
            self.destination.maximum.value(),
        )?;
        Ok(value)
    }
}

/// Tuple event wire format is versioned by SCHEMA. It retains every operand
/// while keeping long native Scenes inside the existing file budget.
/// sequence, sample, layer index, immutable basis index, native action.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct TimedEvent(pub Counter, pub Counter, pub u16, pub u16, pub EventAction);
impl TimedEvent {
    pub fn sequence(&self) -> u64 {
        self.0 .0
    }
    pub fn sample(&self) -> u64 {
        self.1 .0
    }
    pub fn layer(&self) -> usize {
        usize::from(self.2)
    }
    pub fn basis(&self) -> usize {
        usize::from(self.3)
    }
}
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub enum EventAction {
    /// touch token, member token, pitch index, velocity, initial sin/cos.
    #[serde(rename = "n")]
    NoteOn(Counter, Counter, u16, Scalar, Scalar, Scalar),
    #[serde(rename = "o")]
    NoteOff(Counter),
    #[serde(rename = "s")]
    Sustain(bool),
    /// touch token, pressure, explicitly prepared Hz (no canonical retuning).
    #[serde(rename = "e")]
    Expression(Counter, Scalar, Scalar),
    #[serde(rename = "p")]
    Parameter(u16, Scalar, Option<Counter>),
    #[serde(rename = "a")]
    Automation(u16, Scalar, Option<Counter>),
    /// exact native force/exciter identity, Newton vector and cause reading.
    #[serde(rename = "f")]
    Force(String, [Scalar; 3], ReadingRef),
    /// Full new native form/body/tuning/receiver basis, supplied at this sample.
    #[serde(rename = "b")]
    Basis,
    #[serde(rename = "c")]
    Context,
    #[serde(rename = "x")]
    Panic,
}
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct EventPage {
    pub events: Vec<TimedEvent>,
}
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct TempoSegment {
    pub at_sample: Counter,
    pub at_tick: Counter,
    pub micros_per_quarter: u32,
}
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct LoopRange {
    pub from_sample: Counter,
    pub to_sample: Counter,
}
#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ReplayMode {
    SeededFromStart,
    NativeCheckpoint,
}
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct ReplayPolicy {
    pub mode: ReplayMode,
    pub max_reconstruction_samples: Counter,
    pub model_revision: String,
    pub event_tolerance_samples: u8,
    pub physical_tolerance: Scalar,
    pub display_policy: String,
}
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct QueuedEventReceipt {
    pub native_sequence: Counter,
    pub recorded_sequence: Counter,
    pub effective_sample: Counter,
}
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct CheckpointReceipt {
    pub checkpoint_ref: String,
    pub identity: Identity,
    pub sample: Counter,
    pub basis_digest: String,
    pub event_prefix_digest: String,
    pub queued_events: Vec<QueuedEventReceipt>,
    pub acknowledged_stopped: bool,
}
/// A bounded immutable snapshot of BOTH native owners at one acknowledged
/// stopped sample boundary. It is stored by the ordinary Scene/file owner.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct CheckpointBinding {
    pub schema: String,
    pub checkpoint_ref: String,
    pub identity: Identity,
    pub sample: Counter,
    pub basis_digest: String,
    pub event_prefix_digest: String,
    pub native_audio_contract: String,
    pub native_physical_contract: String,
    pub audio: Value,
    pub queued_events: Vec<QueuedEventReceipt>,
    pub physical: Value,
    /// Complete native input/session custody, with the native pair stored once.
    /// Paired-only v1 editions retain their original serialization and hash.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub management: Option<crate::expression_performance_management::ManagementState>,
    pub acknowledged_stopped: bool,
    pub content_digest: String,
}
impl CheckpointBinding {
    pub fn seal(mut self) -> Result<Self, String> {
        self.validate_content()?;
        self.content_digest = self.hash()?;
        Ok(self)
    }
    fn hash(&self) -> Result<String, String> {
        let original = digest(&(
            &self.schema,
            &self.checkpoint_ref,
            &self.identity,
            self.sample,
            &self.basis_digest,
            &self.event_prefix_digest,
            &self.native_audio_contract,
            &self.native_physical_contract,
            &self.audio,
            &self.queued_events,
            &self.physical,
            self.acknowledged_stopped,
        ))?;
        match &self.management {
            Some(management) => digest(&(&original, management)),
            None => Ok(original),
        }
    }
    fn validate_content(&self) -> Result<(), String> {
        if self.schema != CHECKPOINT_SCHEMA || !self.acknowledged_stopped {
            return Err("checkpoint requires acknowledged stopped native custody".into());
        }
        self.identity.validate()?;
        for v in [
            &self.checkpoint_ref,
            &self.basis_digest,
            &self.event_prefix_digest,
            &self.native_audio_contract,
            &self.native_physical_contract,
        ] {
            text(v)?;
        }
        if self.native_audio_contract != "ql.performance-audio/v1"
            || self.native_physical_contract != "ql.physical-body/v1"
        {
            return Err("checkpoint owner/model contract mismatch".into());
        }
        for value in [&self.audio, &self.physical] {
            safe(value, 0)?;
            if !value.is_object()
                || serde_json::to_vec(value).map_err(|e| e.to_string())?.len()
                    > MAX_CHECKPOINT_BYTES
            {
                return Err("native checkpoint body exceeds bounded snapshot".into());
            }
        }
        let ordinal_checkpoint = match self.audio["schema"].as_str() {
            Some("ql.performance-checkpoint/v1") if self.audio["version"] == 1 => false,
            Some("ql.performance-checkpoint/v2") if self.audio["version"] == 2 => true,
            _ => return Err("unsupported native audio checkpoint schema/version".into()),
        };
        equal_string(&self.audio, "/model_revision", "ql.performance-audio/v1")?;
        equal_string(&self.physical, "/schema", "ql.physical-body-checkpoint/v1")?;
        if self.physical["version"] != 1 {
            return Err("unsupported native audio/physical checkpoint version".into());
        }
        if ordinal_checkpoint {
            let high_water: Counter = serde_json::from_value(
                member(&self.audio, "/applied_application_ordinal")?.clone(),
            )
            .map_err(|e| e.to_string())?;
            let unread = member(&self.audio, "/applications/entries")?
                .as_array()
                .ok_or("native committed application queue absent")?;
            if unread.len() > 256 {
                return Err("native committed application queue exceeds bound".into());
            }
            let mut previous = Counter(0);
            for application in unread {
                equal_string(application, "/schema", "ql.performance-applied-event/v2")?;
                let ordinal: Counter = serde_json::from_value(
                    member(application, "/applied_application_ordinal")?.clone(),
                )
                .map_err(|e| e.to_string())?;
                if ordinal <= previous || ordinal > high_water {
                    return Err("native application checkpoint order/high water differs".into());
                }
                previous = ordinal;
            }
        }
        for (path, expected) in [
            ("/determination/identity/event", &self.identity.event_ref),
            (
                "/determination/identity/subject",
                &self.identity.subject_ref,
            ),
            (
                "/determination/identity/instance",
                &self.identity.instance_ref,
            ),
        ] {
            equal_string(&self.audio, path, expected)?;
        }
        equal_string(
            &self.physical,
            "/identity/event_ref",
            &self.identity.event_ref,
        )?;
        equal_string(
            &self.physical,
            "/identity/subject_ref",
            &self.identity.subject_ref,
        )?;
        equal_string(&self.audio, "/cursor", &self.sample.0.to_string())?;
        equal_string(
            &self.physical,
            "/state/samples_elapsed",
            &self.sample.0.to_string(),
        )?;
        equal_string(
            &self.audio,
            "/determination/identity/m1_revision",
            &self.identity.m1_revision.0.to_string(),
        )?;
        equal_string(
            &self.audio,
            "/determination/identity/m2_generation",
            &self.identity.m2_generation.0.to_string(),
        )?;
        equal_string(
            &self.physical,
            "/identity/source_generation",
            &self.identity.m3_generation.0.to_string(),
        )?;
        for (audio, physical) in [
            ("/determination/body_revision", "/identity/body_revision"),
            (
                "/determination/body_preparation_ref",
                "/identity/preparation_ref",
            ),
            ("/determination/body_state_ref", "/identity/state_ref"),
        ] {
            if member(&self.audio, audio)? != member(&self.physical, physical)? {
                return Err("native checkpoint body/audio causality disconnected".into());
            }
        }
        if self.audio["sample_rate"] != self.physical["basis"]["sample_rate"] {
            return Err("native checkpoint rates differ".into());
        }
        for path in [
            "/determination",
            "/producer_determination",
            "/producer_identity",
            "/source_schedule",
            "/voices",
            "/touches",
            "/tails",
            "/operations",
            "/releases",
            "/pending_operations",
            "/operation_heap",
            "/pending_releases",
            "/source_parameters",
            "/effective_parameters",
            "/accepted_sequence",
            "/accepted_sample",
            "/applied_sequence",
            "/panic_fence",
            "/overflow_count",
            "/emergency",
            "/capture",
            "/fault",
            "/sustain",
        ] {
            member(&self.audio, path)?;
        }
        for path in [
            "/identity",
            "/basis/eigenbasis_identity",
            "/units",
            "/state/displacement_modal_metres",
            "/state/velocity_modal_metres_per_second",
            "/state/last_pickup_linear",
        ] {
            member(&self.physical, path)?;
        }
        let mut queued = BTreeMap::new();
        for (path, key) in [
            ("/operations/entries", None),
            ("/releases/entries", None),
            ("/pending_operations", Some("operation")),
            ("/pending_releases", Some("release")),
        ] {
            for entry in member(&self.audio, path)?
                .as_array()
                .ok_or("native pending queue array absent")?
            {
                let op = key.map_or(entry, |k| &entry[k]);
                let sequence: Counter = serde_json::from_value(member(op, "/sequence")?.clone())
                    .map_err(|e| e.to_string())?;
                let sample: Counter = serde_json::from_value(member(op, "/sample")?.clone())
                    .map_err(|e| e.to_string())?;
                if queued.insert(sequence, sample).is_some() {
                    return Err("duplicate native pending queue ordinal".into());
                }
            }
        }
        if queued.len() > 320 || self.queued_events.len() != queued.len() {
            return Err("checkpoint lost native-to-recorded pending event receipts".into());
        }
        let mut mapped = BTreeSet::new();
        for event in &self.queued_events {
            if !mapped.insert(event.native_sequence)
                || queued.get(&event.native_sequence) != Some(&event.effective_sample)
                || event.recorded_sequence.0 == 0
            {
                return Err("checkpoint native/recorded pending event mapping differs".into());
            }
        }
        if let Some(management) = &self.management {
            management.validate_against(self)?;
        }
        Ok(())
    }
    /// Receive exactly A/P's frozen paired transport. The stopped native
    /// owner still validates/restores its candidate before committing either.
    pub fn from_native_pair(receipt: CheckpointReceipt, pair: Value) -> Result<Self, String> {
        equal_string(&pair, "/schema", "ql.performance-physical-checkpoint/v1")?;
        Self {
            schema: CHECKPOINT_SCHEMA.into(),
            checkpoint_ref: receipt.checkpoint_ref,
            identity: receipt.identity,
            sample: receipt.sample,
            basis_digest: receipt.basis_digest,
            event_prefix_digest: receipt.event_prefix_digest,
            native_audio_contract: "ql.performance-audio/v1".into(),
            native_physical_contract: "ql.physical-body/v1".into(),
            audio: member(&pair, "/audio")?.clone(),
            physical: member(&pair, "/physical")?.clone(),
            management: None,
            queued_events: receipt.queued_events,
            acknowledged_stopped: receipt.acknowledged_stopped,
            content_digest: String::new(),
        }
        .seal()
    }
    /// Receive the actual stopped native management owner without discarding
    /// original input bindings, pending releases or undelivered journal data.
    pub fn from_native_management(receipt: CheckpointReceipt, wire: Value) -> Result<Self, String> {
        let mut checkpoint =
            Self::from_native_pair(receipt, member(&wire, "/native_pair")?.clone())?;
        let management = crate::expression_performance_management::ManagementState::from_wire(
            wire,
            &checkpoint,
        )?;
        checkpoint.management = Some(management);
        checkpoint.seal()
    }
    pub fn native_management_wire(&self) -> Result<Value, String> {
        self.validate()?;
        self.management
            .as_ref()
            .ok_or("original input custody unavailable in paired-only edition")?
            .wire(self)
    }
    pub fn native_pair_wire(&self) -> Result<Value, String> {
        self.validate()?;
        Ok(
            serde_json::json!({"schema":"ql.performance-physical-checkpoint/v1","audio":self.audio,"physical":self.physical}),
        )
    }
    pub fn validate(&self) -> Result<(), String> {
        self.validate_content()?;
        if self.hash()? != self.content_digest {
            return Err("native checkpoint state altered or lost".into());
        }
        Ok(())
    }
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Performance {
    pub schema: String,
    pub performance_ref: String,
    pub sample_rate: u32,
    pub duration_samples: Counter,
    pub ppq: u16,
    pub bases: Vec<PerformanceBasis>,
    pub pitches: Vec<Pitch>,
    pub layers: Vec<Layer>,
    pub pages: Vec<EventPage>,
    pub parameters: Vec<ParameterTarget>,
    pub routes: Vec<ModulationRoute>,
    pub tempo: Vec<TempoSegment>,
    pub loop_range: Option<LoopRange>,
    /// Authored transport position, advanced by explicit native operations only.
    pub position_sample: Counter,
    pub replay: ReplayPolicy,
    pub checkpoints: Vec<CheckpointBinding>,
    /// Complete native producer assets once per selected edition, interned in
    /// the existing Act/file catalog. Old v1 bytes omit this empty addition.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub native_sources:
        Vec<crate::expression_performance_source_asset::NativePerformanceSourceAsset>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub native_recordings: Vec<crate::expression_performance_recording::NativeRecordingPage>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub native_reservations: Vec<crate::expression_performance_reservation::NativeScoreReservation>,
    /// Seals the full act, including all event, route and transport operands.
    pub content_digest: String,
}
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(tag = "operation", rename_all = "snake_case", deny_unknown_fields)]
pub enum PerformanceOperation {
    Record {
        events: Vec<TimedEvent>,
    },
    RecordNative {
        events: Vec<TimedEvent>,
        page: crate::expression_performance_recording::NativeRecordingPage,
    },
    ReserveNative {
        reservations: Vec<crate::expression_performance_reservation::NativeScoreReservation>,
    },
    Overdub {
        layer: Layer,
        events: Vec<TimedEvent>,
    },
    EditEvent {
        sequence: Counter,
        replacement: TimedEvent,
    },
    RemoveEvent {
        sequence: Counter,
    },
    LayerSet {
        index: u16,
        layer: Layer,
    },
    RouteSet {
        route: ModulationRoute,
    },
    RouteClear {
        route_ref: String,
    },
    Automate {
        route_index: u16,
        events: Vec<TimedEvent>,
    },
    Loop {
        range: Option<LoopRange>,
    },
    Seek {
        sample: Counter,
    },
    Tempo {
        segments: Vec<TempoSegment>,
    },
    AdmitBasis {
        basis: Box<PerformanceBasis>,
        pitches: Vec<Pitch>,
    },
    Checkpoint {
        checkpoint: Box<CheckpointBinding>,
    },
    /// Existing native owner supplies a complete qualified asset. This edit
    /// retains bytes, and never grants playback authority by JSON or digest.
    RetainNativeSource {
        source: Box<crate::expression_performance_source_asset::NativePerformanceSourceAsset>,
    },
}
impl Performance {
    pub fn events(&self) -> impl Iterator<Item = &TimedEvent> {
        self.pages.iter().flat_map(|p| &p.events)
    }
    pub fn event_count(&self) -> usize {
        self.pages.iter().map(|p| p.events.len()).sum()
    }
    fn hash(&self) -> Result<String, String> {
        let original = digest(&(
            &self.schema,
            &self.performance_ref,
            self.sample_rate,
            self.duration_samples,
            self.ppq,
            &self.bases,
            &self.pitches,
            &self.layers,
            &self.pages,
            &self.parameters,
            &self.routes,
            &self.tempo,
            &self.loop_range,
            self.position_sample,
            &self.replay,
            &self.checkpoints,
        ))?;
        let source = if self.native_sources.is_empty() {
            original
        } else {
            digest(&(&original, &self.native_sources))?
        };
        let recording = if self.native_recordings.is_empty() {
            source
        } else {
            digest(&(&source, &self.native_recordings))?
        };
        if self.native_reservations.is_empty() {
            Ok(recording)
        } else {
            digest(&(&recording, &self.native_reservations))
        }
    }
    pub fn seal(mut self) -> Result<Self, String> {
        self.validate_content()?;
        self.content_digest = self.hash()?;
        Ok(self)
    }
    pub fn fingerprint(&self) -> Result<String, String> {
        self.validate()?;
        Ok(self.content_digest.clone())
    }
    pub fn validate(&self) -> Result<(), String> {
        self.validate_content()?;
        if self.hash()? != self.content_digest {
            return Err("retained physical-musical act lost or altered data".into());
        }
        Ok(())
    }
    /// The retained native owner recomputes one COMPLETE source bundle per
    /// saved basis before live continuation. This refuses legacy bytes lacking
    /// assets; opening old configuration remains a separate valid operation.
    pub fn verify_native_source_replay(&self, actual: &[Value]) -> Result<(), String> {
        self.validate()?;
        if self.native_sources.len() != self.bases.len() || actual.len() != self.bases.len() {
            return Err("complete retained native source replay unavailable".into());
        }
        for (basis, replayed) in self.bases.iter().zip(actual) {
            let source = self
                .native_sources
                .iter()
                .find(|s| s.basis_digest() == basis.content_digest)
                .ok_or("retained native source basis missing")?;
            source.verify_native_replay(basis, replayed)?;
        }
        Ok(())
    }
    pub fn prefix_digest(&self, sample: u64) -> Result<String, String> {
        digest(
            &self
                .events()
                .filter(|e| e.sample() < sample)
                .collect::<Vec<_>>(),
        )
    }
    fn validate_content(&self) -> Result<(), String> {
        if self.schema
            != if !self.native_recordings.is_empty() || !self.native_reservations.is_empty() {
                RECORDING_SCHEMA
            } else if self.native_sources.is_empty() {
                SCHEMA
            } else {
                SOURCE_SCHEMA
            }
            || !(8000..=192000).contains(&self.sample_rate)
            || self.ppq == 0
            || self.ppq > 32767
            || self.bases.is_empty()
            || self.bases.len() > MAX_BASES
            || self.pitches.len() > MAX_PITCHES
            || self.layers.is_empty()
            || self.layers.len() > MAX_LAYERS
            || self.routes.len() > MAX_ROUTES
            || self.parameters.len() > MAX_ROUTES
            || self.checkpoints.len() > MAX_CHECKPOINTS
            || self.native_recordings.len() > MAX_PAGES
            || self.native_sources.len() > MAX_BASES
            || self.event_count() > MAX_EVENTS
            || self.position_sample > self.duration_samples
        {
            return Err("performance schema, timing or resource budget invalid".into());
        }
        text(&self.performance_ref)?;
        if self.pages.len() > MAX_PAGES
            || self
                .pages
                .iter()
                .any(|p| p.events.is_empty() || p.events.len() > MAX_PAGE_EVENTS)
        {
            return Err("performance event page budget invalid".into());
        }
        for b in &self.bases {
            b.validate()?;
            if member(&b.prepared_body, "/request/sample_rate")?.as_u64()
                != Some(u64::from(self.sample_rate))
            {
                return Err("performance and physical preparation sample rates differ".into());
            }
        }
        let mut source_refs = BTreeSet::new();
        let mut source_bases = BTreeSet::new();
        for source in &self.native_sources {
            let reading = source.reading()?;
            if !source_refs.insert(reading.r#ref.clone())
                || !source_bases.insert(source.basis_digest())
            {
                return Err("duplicate retained native source asset".into());
            }
            let mut used = false;
            for basis in &self.bases {
                if basis.content_digest == source.basis_digest() {
                    source.validate_basis(basis)?;
                    used = true;
                }
            }
            if !used {
                return Err("unreferenced retained native source asset".into());
            }
        }
        if !self.native_sources.is_empty()
            && self
                .bases
                .iter()
                .any(|b| !source_bases.contains(b.content_digest.as_str()))
        {
            return Err("missing retained native source asset for saved basis".into());
        }
        for p in &self.pitches {
            p.validate(&self.bases, self.sample_rate)?;
        }
        let mut layer_refs = BTreeSet::new();
        for l in &self.layers {
            text(&l.layer_ref)?;
            text(&l.title)?;
            if !layer_refs.insert(&l.layer_ref) {
                return Err("duplicate performance layer".into());
            }
        }
        let mut route_refs = BTreeSet::new();
        for r in &self.routes {
            r.validate()?;
            if !route_refs.insert(&r.route_ref) {
                return Err("duplicate modulation route".into());
            }
        }
        for p in &self.parameters {
            p.validate()?;
        }
        self.validate_tempo()?;
        if let Some(l) = &self.loop_range {
            if l.from_sample >= l.to_sample || l.to_sample > self.duration_samples {
                return Err("invalid retained loop range".into());
            }
        }
        text(&self.replay.model_revision)?;
        text(&self.replay.display_policy)?;
        range(self.replay.physical_tolerance, 0.0, 1.0)?;
        if self.replay.event_tolerance_samples > 1 {
            return Err("replay event tolerance exceeds one sample".into());
        }
        let mut sequences = BTreeSet::new();
        let mut previous = None;
        let mut touches = BTreeMap::new();
        for e in self.events() {
            if e.sequence() == 0
                || !sequences.insert(e.sequence())
                || e.sample() > self.duration_samples.0
                || e.layer() >= self.layers.len()
                || e.basis() >= self.bases.len()
            {
                return Err("event sequence, sample, layer or basis invalid".into());
            }
            let order = (e.sample(), e.sequence());
            if previous.is_some_and(|p| order <= p) {
                return Err("performance event order invalid".into());
            }
            previous = Some(order);
            self.validate_event(e, &mut touches)?;
        }
        let mut checkpoint_refs = BTreeSet::new();
        let mut previous_sample = None;
        for c in &self.checkpoints {
            c.validate()?;
            if !checkpoint_refs.insert(&c.checkpoint_ref)
                || c.sample > self.duration_samples
                || previous_sample.is_some_and(|p| c.sample <= p)
                || c.event_prefix_digest != self.prefix_digest(c.sample.0)?
            {
                return Err("checkpoint detached from retained event prefix/order".into());
            }
            let b = self
                .bases
                .iter()
                .find(|b| b.content_digest == c.basis_digest)
                .ok_or("checkpoint basis absent")?;
            if b.identity != c.identity {
                return Err("checkpoint belongs to another native instance/event/subject".into());
            }
            for queued in &c.queued_events {
                let e = self
                    .events()
                    .find(|e| e.0 == queued.recorded_sequence)
                    .ok_or("checkpoint queued occurrence absent from retained performance")?;
                let delay = match &e.4 {
                    EventAction::Automation(i, _, _) => {
                        self.routes[usize::from(*i)].delay_samples.0
                    }
                    _ => 0,
                };
                if e.sample().checked_add(delay) != Some(queued.effective_sample.0)
                    || self.bases[e.basis()].identity != c.identity
                {
                    return Err(
                        "checkpoint pending occurrence/source/effective sample differs".into(),
                    );
                }
            }
            previous_sample = Some(c.sample);
        }
        crate::expression_performance_reservation::validate_pending(self)?;
        crate::expression_performance_recording::validate_recording_pages(self)?;
        if crate::expression_act_storage::measure(self, MAX_PERFORMANCE_BYTES)?
            > MAX_PERFORMANCE_BYTES
        {
            return Err("complete performance exceeds native Document allowance; use existing asset/file custody".into());
        }
        Ok(())
    }
    fn validate_event(
        &self,
        e: &TimedEvent,
        touches: &mut BTreeMap<u64, (usize, usize)>,
    ) -> Result<(), String> {
        match &e.4 {
            EventAction::NoteOn(touch, member_id, pitch, velocity, sine, cosine) => {
                let p = self
                    .pitches
                    .get(usize::from(*pitch))
                    .ok_or("note pitch absent")?;
                if touch.0 == 0
                    || member_id.0 == 0
                    || p.basis != e.3
                    || touches.contains_key(&touch.0)
                {
                    return Err("note touch/member/native basis invalid or already held".into());
                }
                range(*velocity, 0.0, 1.0)?;
                range(*sine, -1.0, 1.0)?;
                range(*cosine, -1.0, 1.0)?;
                if (sine.value().powi(2) + cosine.value().powi(2) - 1.0).abs() > 1e-10 {
                    return Err("note phase quadrature invalid".into());
                }
                touches.insert(touch.0, (e.layer(), e.basis()));
            }
            EventAction::NoteOff(touch) => {
                if touches.remove(&touch.0) != Some((e.layer(), e.basis())) {
                    return Err("note release detached from its held touch/layer/basis".into());
                }
            }
            EventAction::Expression(touch, pressure, hertz) => {
                if touches.get(&touch.0) != Some(&(e.layer(), e.basis())) {
                    return Err("expression detached from held note".into());
                }
                range(*pressure, 0.0, 1.0)?;
                range(*hertz, 0.001, f64::from(self.sample_rate) * 0.45)?;
            }
            EventAction::Parameter(index, value, touch) => {
                let p = self
                    .parameters
                    .get(usize::from(*index))
                    .ok_or("parameter target absent")?;
                range(*value, p.minimum.value(), p.maximum.value())?;
                self.note_scope(p.scope, *touch, e, touches)?;
            }
            EventAction::Automation(index, value, touch) => {
                let r = self
                    .routes
                    .get(usize::from(*index))
                    .ok_or("automation route absent")?;
                r.effective(*value)?;
                self.note_scope(r.destination.scope, *touch, e, touches)?;
            }
            EventAction::Force(reference, force, cause) => {
                text(reference)?;
                reading(cause)?;
                equal_string(
                    &self.bases[e.basis()].prepared_body,
                    "/request/preparation_ref",
                    reference,
                )?;
                let max = member(
                    &self.bases[e.basis()].prepared_body,
                    "/request/max_force_newtons",
                )?
                .as_f64()
                .ok_or("physical force bound missing")?;
                if !max.is_finite() || max <= 0.0 {
                    return Err("physical force bound invalid".into());
                }
                if force.iter().map(|v| v.value().powi(2)).sum::<f64>().sqrt() > max {
                    return Err("recorded force exceeds prepared body bound".into());
                }
            }
            EventAction::Basis | EventAction::Context => {
                // A/B/P rebinding while keys are held requires an explicit
                // native transfer/reset operation; do not invent that here.
                if touches.values().any(|(l, _)| *l == e.layer()) {
                    return Err("basis/context change requires explicit held-note release".into());
                }
            }
            EventAction::Panic => touches.retain(|_, (l, _)| *l != e.layer()),
            EventAction::Sustain(_) => {}
        }
        Ok(())
    }
    fn note_scope(
        &self,
        scope: Scope,
        touch: Option<Counter>,
        e: &TimedEvent,
        touches: &BTreeMap<u64, (usize, usize)>,
    ) -> Result<(), String> {
        if scope == Scope::Note {
            let touch = touch.ok_or("note parameter needs exact touch")?;
            if touches.get(&touch.0) != Some(&(e.layer(), e.basis())) {
                return Err("note parameter detached from held touch".into());
            }
        } else if touch.is_some() {
            return Err("global parameter cannot silently select one note".into());
        }
        Ok(())
    }
    fn validate_tempo(&self) -> Result<(), String> {
        if self.tempo.is_empty()
            || self.tempo.len() > 256
            || self.tempo[0].at_sample.0 != 0
            || self.tempo[0].at_tick.0 != 0
        {
            return Err("musical transport requires an explicit initial tempo mapping".into());
        }
        for (i, t) in self.tempo.iter().enumerate() {
            if !(1..=16_777_215).contains(&t.micros_per_quarter)
                || t.at_sample > self.duration_samples
            {
                return Err("tempo segment outside retained transport".into());
            }
            if i > 0 {
                let prev = &self.tempo[i - 1];
                if t.at_sample <= prev.at_sample
                    || t.at_tick.0 != self.tick_at_from(t.at_sample.0, prev)?
                {
                    return Err("tempo mapping is discontinuous or unordered".into());
                }
            }
        }
        Ok(())
    }
    fn tick_at_from(&self, sample: u64, t: &TempoSegment) -> Result<u64, String> {
        let samples = sample
            .checked_sub(t.at_sample.0)
            .ok_or("sample before tempo segment")?;
        let n = u128::from(samples) * 1_000_000 * u128::from(self.ppq);
        let d = u128::from(self.sample_rate) * u128::from(t.micros_per_quarter);
        let ticks = (n + d / 2) / d;
        t.at_tick
            .0
            .checked_add(u64::try_from(ticks).map_err(|_| "musical tick overflow")?)
            .ok_or_else(|| "musical tick overflow".into())
    }
    pub fn tick_at(&self, sample: u64) -> Result<u64, String> {
        self.validate_tempo()?;
        let t = self
            .tempo
            .iter()
            .rev()
            .find(|t| t.at_sample.0 <= sample)
            .ok_or("initial tempo absent")?;
        self.tick_at_from(sample, t)
    }
    fn repage(&mut self, mut events: Vec<TimedEvent>) {
        events.sort_by_key(|e| (e.sample(), e.sequence()));
        self.pages = events
            .chunks(RETAINED_PAGE_EVENTS)
            .map(|events| EventPage {
                events: events.to_vec(),
            })
            .collect();
    }
    /// No mutation on refusal, no private undo. Native Document/Act records the
    /// accepted prospective Scene in the same atomic application change.
    pub fn edited(&self, operations: Vec<PerformanceOperation>) -> Result<Self, String> {
        self.validate()?;
        if operations.is_empty() || operations.len() > 256 {
            return Err("performance edit requires 1..256 operations".into());
        }
        let mut next = self.clone();
        for op in operations {
            next.change(op)?;
        }
        next.seal()
    }
    fn append(&mut self, events: Vec<TimedEvent>) -> Result<(), String> {
        if events.is_empty()
            || events.len() > 256
            || self.event_count().saturating_add(events.len()) > MAX_EVENTS
        {
            return Err("record requires bounded nonempty native event batch".into());
        }
        let mut all: Vec<_> = self.events().cloned().collect();
        all.extend(events);
        self.repage(all);
        Ok(())
    }
    fn change(&mut self, op: PerformanceOperation) -> Result<(), String> {
        match op {
            PerformanceOperation::Record { events } => self.append(events)?,
            PerformanceOperation::RecordNative { events, page } => {
                page.validate()?;
                let mut all: Vec<_> = self.events().cloned().collect();
                for (reservation, replacement) in page.reservation_updates()? {
                    let position = self
                        .native_reservations
                        .iter()
                        .position(|r| r == &reservation)
                        .ok_or("native resolved reservation is absent or changed")?;
                    self.native_reservations.remove(position);
                    let event = all
                        .iter()
                        .position(|e| e.0 == reservation.recorded_sequence)
                        .ok_or("resolved original score occurrence absent")?;
                    if all[event] != reservation.queued_occurrence()? {
                        return Err("pending score occurrence changed before application".into());
                    }
                    if let Some(replacement) = replacement {
                        all[event] = replacement;
                    } else {
                        all.remove(event);
                    }
                }
                self.repage(all);
                if !events.is_empty() {
                    self.append(events)?;
                }
                if let Some(combined) = self
                    .native_recordings
                    .last()
                    .map(|last| last.combined(&page))
                    .transpose()?
                    .flatten()
                {
                    *self.native_recordings.last_mut().unwrap() = combined;
                } else {
                    self.native_recordings.push(page);
                }
                self.schema = RECORDING_SCHEMA.into();
            }
            PerformanceOperation::ReserveNative { reservations } => {
                if reservations.is_empty() {
                    return Err("native reservation admission is empty".into());
                }
                for reservation in &reservations {
                    reservation.validate(self)?;
                }
                self.native_reservations.extend(reservations);
                self.schema = RECORDING_SCHEMA.into();
            }
            PerformanceOperation::Overdub { layer, mut events } => {
                if self.layers.len() >= MAX_LAYERS {
                    return Err("performance layer budget exceeded".into());
                }
                let index = u16::try_from(self.layers.len()).map_err(|_| "layer index overflow")?;
                self.layers.push(layer);
                for e in &mut events {
                    e.2 = index;
                }
                self.append(events)?;
            }
            PerformanceOperation::EditEvent {
                sequence,
                replacement,
            } => {
                if replacement.0 != sequence {
                    return Err("event edit cannot change occurrence identity".into());
                }
                let mut events: Vec<_> = self.events().cloned().collect();
                let old = events
                    .iter_mut()
                    .find(|e| e.0 == sequence)
                    .ok_or("edited event absent")?;
                *old = replacement;
                self.repage(events);
            }
            PerformanceOperation::RemoveEvent { sequence } => {
                let mut events: Vec<_> = self.events().cloned().collect();
                let before = events.len();
                events.retain(|e| e.0 != sequence);
                if events.len() == before {
                    return Err("removed event absent".into());
                }
                self.repage(events);
            }
            PerformanceOperation::LayerSet { index, layer } => {
                *self
                    .layers
                    .get_mut(usize::from(index))
                    .ok_or("layer absent")? = layer;
            }
            PerformanceOperation::RouteSet { route } => {
                route.validate()?;
                if let Some(old) = self
                    .routes
                    .iter_mut()
                    .find(|r| r.route_ref == route.route_ref)
                {
                    *old = route;
                } else {
                    self.routes.push(route);
                }
            }
            PerformanceOperation::RouteClear { route_ref } => {
                // Retain the route and its historical events, disable its
                // current effect. A label removal cannot erase recorded acts.
                self.routes
                    .iter_mut()
                    .find(|r| r.route_ref == route_ref)
                    .ok_or("route absent")?
                    .enabled = false;
            }
            PerformanceOperation::Automate {
                route_index,
                events,
            } => {
                if !events
                    .iter()
                    .all(|e| matches!(&e.4, EventAction::Automation(i, _, _) if *i == route_index))
                {
                    return Err("automation edit contains another native target".into());
                }
                self.append(events)?;
            }
            PerformanceOperation::Loop { range } => self.loop_range = range,
            PerformanceOperation::Seek { sample } => self.position_sample = sample,
            PerformanceOperation::Tempo { segments } => self.tempo = segments,
            PerformanceOperation::AdmitBasis { basis, pitches } => {
                basis.validate()?;
                let index = u16::try_from(self.bases.len()).map_err(|_| "basis index overflow")?;
                if pitches.iter().any(|p| p.basis != index) {
                    return Err("new pitch basis index mismatch".into());
                }
                self.bases.push(*basis);
                self.pitches.extend(pitches);
            }
            PerformanceOperation::Checkpoint { checkpoint } => {
                checkpoint.validate()?;
                self.checkpoints.push(*checkpoint);
            }
            PerformanceOperation::RetainNativeSource { source } => {
                source.validate()?;
                let reading = source.reading()?;
                if !self
                    .bases
                    .iter()
                    .any(|b| b.content_digest == source.basis_digest())
                {
                    return Err("native source admission requires exact saved basis digest".into());
                }
                if let Some(old) = self
                    .native_sources
                    .iter()
                    .find(|s| s.reading().ok().as_ref() == Some(&reading))
                {
                    if old != source.as_ref() {
                        return Err("native source asset address collision".into());
                    }
                } else {
                    self.native_sources.push(*source);
                }
                self.schema =
                    if self.native_recordings.is_empty() && self.native_reservations.is_empty() {
                        SOURCE_SCHEMA
                    } else {
                        RECORDING_SCHEMA
                    }
                    .into();
            }
        }
        Ok(())
    }
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub struct ReadinessIssue {
    pub reference: String,
    pub kind: String,
    pub expected_revision: String,
    pub actual_revision: Option<String>,
}
#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub struct ReplayReadiness {
    pub ready: bool,
    pub historical: bool,
    pub issues: Vec<ReadinessIssue>,
}
impl Performance {
    /// Readiness is returned explicitly, never replaced by empty successful
    /// sound. Source history remains exact and is never upgraded to freshness.
    pub fn readiness(
        &self,
        current: &BTreeMap<String, ReadingRef>,
        original_replay: bool,
    ) -> Result<ReplayReadiness, String> {
        self.validate()?;
        let mut issues = Vec::new();
        for page in &self.native_recordings {
            if let Some(termination) = page.termination()? {
                if termination.standing
                    == crate::expression_performance_reservation::ReservationStanding::Lost
                {
                    issues.push(ReadinessIssue {
                        reference: termination.after.checkpoint_ref,
                        kind: "native_applied_recording_loss".into(),
                        expected_revision: "complete native application stream".into(),
                        actual_revision: None,
                    });
                }
            }
        }
        for b in &self.bases {
            let mut source_context_refs = Vec::new();
            if let Some(source) = self
                .native_sources
                .iter()
                .find(|s| s.basis_digest() == b.content_digest)
            {
                if let Ok(refs) = source.context_readings(b) {
                    source_context_refs = refs;
                } else {
                    issues.push(ReadinessIssue {
                        reference: b.context.context.r#ref.clone(),
                        kind: "native_source_context_unavailable".into(),
                        expected_revision: b.context.context.revision.clone(),
                        actual_revision: None,
                    });
                }
            }
            if b.tuning["available"] != true {
                issues.push(ReadinessIssue {
                    reference: b.tuning["policy_ref"]
                        .as_str()
                        .unwrap_or("unknown-tuning")
                        .into(),
                    kind: "authentic_pitch_material_unavailable".into(),
                    expected_revision: b.tuning["revision"].as_str().unwrap_or("unknown").into(),
                    actual_revision: None,
                });
            }
            for r in b
                .sources
                .iter()
                .map(|r| (r, true))
                .chain(b.required_assets.iter().map(|r| (r, false)))
                .chain(
                    [&b.context.receiver, &b.context.context]
                        .into_iter()
                        .map(|r| (r, false)),
                )
                .chain(b.context.source_occasion.iter().map(|r| (r, false)))
                .chain(b.context.protected_state.iter().map(|r| (r, false)))
                .chain(b.context.consent.iter().map(|r| (r, false)))
                .chain(source_context_refs.iter().map(|r| (r, false)))
            {
                let (r, source_role) = r;
                let actual = current.get(&r.r#ref);
                // Full original domain outputs can replay historical sources;
                // receiver/assets must still be present at the exact revision.
                let retained_source = original_replay && source_role;
                if retained_source {
                    continue;
                }
                let kind = match actual {
                    None => Some("missing_native_reading"),
                    Some(v) if v.availability != Availability::Available => {
                        Some("native_reading_unavailable")
                    }
                    Some(v) if v.r#ref != r.r#ref => Some("native_reading_identity_differs"),
                    Some(v) if v.revision != r.revision => Some("native_source_drift"),
                    _ => None,
                };
                if let Some(kind) = kind {
                    issues.push(ReadinessIssue {
                        reference: r.r#ref.clone(),
                        kind: kind.into(),
                        expected_revision: r.revision.clone(),
                        actual_revision: actual.map(|r| r.revision.clone()),
                    });
                }
            }
        }
        Ok(ReplayReadiness {
            ready: issues.is_empty(),
            historical: original_replay,
            issues,
        })
    }
    pub fn seek_preparation(&self, sample: Counter) -> Result<SeekPreparation, String> {
        self.validate()?;
        if sample > self.duration_samples {
            return Err("seek exceeds retained performance".into());
        }
        let checkpoint = self
            .checkpoints
            .iter()
            .rev()
            .find(|c| c.sample <= sample)
            .cloned();
        let from = checkpoint.as_ref().map_or(0, |c| c.sample.0);
        if self.replay.mode == ReplayMode::NativeCheckpoint && checkpoint.is_none() && sample.0 != 0
        {
            return Err("bounded seek requires its native audio/physical checkpoint".into());
        }
        if sample.0 - from > self.replay.max_reconstruction_samples.0 {
            return Err("seek reconstruction exceeds explicit sample budget".into());
        }
        let event_ids = self
            .events()
            .filter(|e| e.sample() >= from && e.sample() < sample.0)
            .map(|e| e.0)
            .collect();
        Ok(SeekPreparation {
            performance_digest: self.fingerprint()?,
            target_sample: sample,
            from_sample: Counter(from),
            checkpoint,
            event_ids,
            restore_owner_state_before_audio: true,
        })
    }
    /// The actual A cursor is an argument, not a counter advanced by this module.
    /// At most two seconds and256 operations leave the serial control owner.
    pub fn prepare_window(
        &self,
        cursor: &ReplayCursor,
        frames: u32,
        current: &BTreeMap<String, ReadingRef>,
        original_replay: bool,
    ) -> Result<PreparedWindow, String> {
        ReplayPlan::prepare(self, current, original_replay)?.prepare_window(cursor, frames)
    }
}
#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub struct SeekPreparation {
    pub performance_digest: String,
    pub target_sample: Counter,
    pub from_sample: Counter,
    pub checkpoint: Option<CheckpointBinding>,
    pub event_ids: Vec<Counter>,
    pub restore_owner_state_before_audio: bool,
}
#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub struct ReplayCursor {
    pub instance_ref: String,
    pub event_ref: String,
    pub subject_ref: String,
    pub sample: Counter,
    pub last_sequence: Counter,
    /// Native paired restore acknowledged this retained checkpoint. None for
    /// uninterrupted play; a caller cannot invent a skip-event list.
    pub checkpoint_digest: Option<String>,
}
#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub struct PreparedWindow {
    pub performance_digest: String,
    pub start_sample: Counter,
    pub end_sample: Counter,
    pub prior_sequence: Counter,
    pub next_sequence: Counter,
    pub operations: Vec<PreparedOperation>,
}
#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub struct PreparedOperation {
    pub sequence: Counter,
    pub sample: Counter,
    pub recorded_sequence: Counter,
    pub identity: Identity,
    pub basis_digest: String,
    pub native: NativeOperation,
}
#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(tag = "operation", rename_all = "snake_case")]
pub enum NativeOperation {
    NoteOn {
        touch: Counter,
        member: Counter,
        pitch: Pitch,
        velocity: Scalar,
        phase_sin: Scalar,
        phase_cos: Scalar,
    },
    NoteOff {
        touch: Counter,
    },
    Sustain {
        enabled: bool,
    },
    Expression {
        touch: Counter,
        pressure: Scalar,
        pitch_hz: Scalar,
    },
    Parameter {
        target: ParameterTarget,
        value: Scalar,
        touch: Option<Counter>,
        route_ref: Option<String>,
    },
    Force {
        exciter_ref: String,
        newtons: [Scalar; 3],
        cause: ReadingRef,
    },
    Rebind {
        context_switch: bool,
    },
    Panic,
}

/// Prepared once off the callback. The borrowed immutable Scene prevents a
/// stale edit from changing an indexed event underneath a live consumer.
pub struct ReplayPlan<'a> {
    performance: &'a Performance,
    events: Vec<IndexedEvent<'a>>,
    fingerprint: String,
    readiness: ReplayReadiness,
}
impl<'a> ReplayPlan<'a> {
    pub fn prepare(
        performance: &'a Performance,
        current: &BTreeMap<String, ReadingRef>,
        original_replay: bool,
    ) -> Result<Self, String> {
        let readiness = performance.readiness(current, original_replay)?;
        if !readiness.ready {
            return Err("performance native readings/tuning unavailable".into());
        }
        let mut events = Vec::with_capacity(performance.event_count());
        for event in performance.events() {
            let delay = match &event.4 {
                EventAction::Automation(index, _, _) => {
                    performance.routes[usize::from(*index)].delay_samples.0
                }
                _ => 0,
            };
            let effective_sample = event
                .sample()
                .checked_add(delay)
                .ok_or("modulation sample overflow")?;
            if effective_sample > performance.duration_samples.0 {
                return Err("delayed modulation exceeds retained duration".into());
            }
            events.push(IndexedEvent {
                event,
                effective_sample: Counter(effective_sample),
            });
        }
        events.sort_by_key(|e| (e.effective_sample, e.event.sequence()));
        Ok(Self {
            performance,
            events,
            fingerprint: performance.content_digest.clone(),
            readiness,
        })
    }
    pub fn readiness(&self) -> &ReplayReadiness {
        &self.readiness
    }
    pub fn fingerprint(&self) -> &str {
        &self.fingerprint
    }
    pub fn event_window(&self, from: Counter, to: Counter) -> Result<&[IndexedEvent<'a>], String> {
        if from > to || to > self.performance.duration_samples {
            return Err("indexed replay window outside performance".into());
        }
        let first = self.events.partition_point(|e| e.effective_sample < from);
        let end = self.events.partition_point(|e| e.effective_sample < to);
        if end - first > MAX_PREPARED_OPERATIONS {
            return Err("indexed replay window exceeds native operation bound".into());
        }
        Ok(&self.events[first..end])
    }
}

/// Effective sample is a mapping of the recorded sample plus the authored route
/// delay, never a separate advancing clock.
pub struct IndexedEvent<'a> {
    pub event: &'a TimedEvent,
    pub effective_sample: Counter,
}
impl ReplayPlan<'_> {
    pub fn prepare_window(
        &self,
        cursor: &ReplayCursor,
        frames: u32,
    ) -> Result<PreparedWindow, String> {
        let p = self.performance;
        if frames == 0 || frames > p.sample_rate * 2 || cursor.sample > p.duration_samples {
            return Err("replay window outside native audio lookahead".into());
        }
        let end = cursor
            .sample
            .0
            .checked_add(u64::from(frames))
            .ok_or("replay sample overflow")?
            .min(p.duration_samples.0);
        let restored = if let Some(digest) = &cursor.checkpoint_digest {
            let checkpoint = p
                .checkpoints
                .iter()
                .find(|c| &c.content_digest == digest)
                .ok_or("native replay cursor checkpoint absent")?;
            if checkpoint.sample > cursor.sample
                || checkpoint.identity.instance_ref != cursor.instance_ref
            {
                return Err("native replay cursor/checkpoint identity differs".into());
            }
            let accepted: Counter =
                serde_json::from_value(checkpoint.audio["accepted_sequence"].clone())
                    .map_err(|e| e.to_string())?;
            if cursor.last_sequence < accepted {
                return Err("native replay cursor precedes restored pending queue".into());
            }
            Some(checkpoint)
        } else {
            None
        };
        let solo = p.layers.iter().any(|l| l.enabled && l.solo);
        let mut sequence = cursor.last_sequence.0;
        let mut operations = Vec::new();
        for indexed in self.event_window(cursor.sample, Counter(end))? {
            let e = indexed.event;
            if restored.is_some_and(|c| {
                c.queued_events.iter().any(|q| {
                    q.recorded_sequence == e.0 && q.native_sequence <= cursor.last_sequence
                })
            }) {
                continue;
            }
            let layer = &p.layers[e.layer()];
            if !layer.enabled || (solo && !layer.solo) {
                continue;
            }
            let basis = &p.bases[e.basis()];
            if basis.identity.instance_ref != cursor.instance_ref
                || basis.identity.event_ref != cursor.event_ref
                || basis.identity.subject_ref != cursor.subject_ref
            {
                return Err(
                    "replay window belongs to another native instance/event/subject".into(),
                );
            }
            let native = match &e.4 {
                EventAction::NoteOn(touch, member_id, pitch, velocity, sine, cosine) => {
                    NativeOperation::NoteOn {
                        touch: *touch,
                        member: *member_id,
                        pitch: p.pitches[usize::from(*pitch)].clone(),
                        velocity: *velocity,
                        phase_sin: *sine,
                        phase_cos: *cosine,
                    }
                }
                EventAction::NoteOff(touch) => NativeOperation::NoteOff { touch: *touch },
                EventAction::Sustain(value) => NativeOperation::Sustain { enabled: *value },
                EventAction::Expression(touch, pressure, hertz) => NativeOperation::Expression {
                    touch: *touch,
                    pressure: *pressure,
                    pitch_hz: *hertz,
                },
                EventAction::Parameter(index, value, touch) => NativeOperation::Parameter {
                    target: p.parameters[usize::from(*index)].clone(),
                    value: *value,
                    touch: *touch,
                    route_ref: None,
                },
                EventAction::Automation(index, source, touch) => {
                    let route = &p.routes[usize::from(*index)];
                    if !route.enabled {
                        continue;
                    }
                    NativeOperation::Parameter {
                        target: route.destination.clone(),
                        value: route.effective(*source)?,
                        touch: *touch,
                        route_ref: Some(route.route_ref.clone()),
                    }
                }
                EventAction::Force(reference, newtons, cause) => NativeOperation::Force {
                    exciter_ref: reference.clone(),
                    newtons: *newtons,
                    cause: cause.clone(),
                },
                EventAction::Basis => NativeOperation::Rebind {
                    context_switch: false,
                },
                EventAction::Context => NativeOperation::Rebind {
                    context_switch: true,
                },
                EventAction::Panic => NativeOperation::Panic,
            };
            sequence = sequence
                .checked_add(1)
                .ok_or("native operation sequence exhausted")?;
            operations.push(PreparedOperation {
                sequence: Counter(sequence),
                sample: indexed.effective_sample,
                recorded_sequence: e.0,
                identity: basis.identity.clone(),
                basis_digest: basis.content_digest.clone(),
                native,
            });
        }
        Ok(PreparedWindow {
            performance_digest: self.fingerprint.clone(),
            start_sample: cursor.sample,
            end_sample: Counter(end),
            prior_sequence: cursor.last_sequence,
            next_sequence: Counter(sequence),
            operations,
        })
    }
}
