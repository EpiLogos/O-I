//! Open the actual selected Application Scene through its saved native World.
//! The browser supplies refs/CAS only. Actual source bytes and the registered
//! Scene constructor are borrowed from the existing native Document owner.
use super::{compose_request, sha256_hex, ComposeFinish, ComposedBinding, PreparedCompose};
use crate::expression::{procedural::scene_receiver::SceneOwner, Document};
use crate::expression_procedural_scene_reader::NativeDocumentSceneReader;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

#[path = "native_expression_selected_scene_source.rs"]
pub mod source;

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct Request {
    pub expression_ref: String,
    pub document_revision: u64,
    pub scene_ref: String,
    pub scene_revision: u64,
}
impl Request {
    fn validate(&self) -> Result<(), String> {
        crate::expression::text(&self.expression_ref)?;
        crate::expression::text(&self.scene_ref)?;
        if self.document_revision == 0
            || self.scene_revision == 0
            || self.scene_revision > self.document_revision
        {
            return Err("Selected native Scene requires its actual Document/Scene CAS".into());
        }
        Ok(())
    }
}

/// No wire constructor: this source is read from the SAME current native Scene.
struct RetainedWorld {
    record: Value,
    original_request: Value,
    consumer_request: Value,
    source_manifest: Value,
    world_source_scene: Value,
}
impl RetainedWorld {
    fn read(reader: &NativeDocumentSceneReader) -> Result<Self, String> {
        let refuse =
            |reason: &str| format!("native-expression.selected_scene_source_refused: {reason}");
        // A continuing World is retained once in the same actual Document,
        // rather than copied into each of its canonical/generated Scenes.
        let worlds: Vec<_> = reader
            .document()
            .scenes
            .iter()
            .filter_map(|scene| {
                scene
                    .presentation
                    .as_ref()
                    .and_then(|p| p.scene.get("epiWorld"))
                    .filter(|v| v.is_object())
                    .map(|record| (scene, record))
            })
            .collect();
        if worlds.is_empty() {
            return Err(refuse(
                "The selected Scene has no saved native World constructor in its continuing Document; refresh its actual native source owner",
            ));
        }
        if worlds.len() != 1 {
            return Err(refuse(
                "The current Document has ambiguous native World carriers; select/reconcile its actual native source owner",
            ));
        }
        let (world_scene, record) = worlds[0];
        let world_source_scene = json!({"expression_ref":reader.document().expression_ref,
            "document_revision":reader.document().revision,"scene_ref":world_scene.scene_ref,"scene_revision":world_scene.revision});
        let source = &record["native_source"];
        let world = &record["world"];
        let original_bytes = source["constructor_request_bytes"].as_str()
            .ok_or_else(|| refuse("Saved native World lost its exact original constructor bytes; refresh its actual source owner"))?;
        let original_value: Value = serde_json::from_str(original_bytes).map_err(|e| {
            refuse(&format!(
                "Saved original native constructor bytes are invalid: {e}"
            ))
        })?;
        let original = &original_value;
        if !same_json(original, &source["constructor_request"]) {
            return Err(refuse(
                "Saved typed constructor differs from its exact original native bytes",
            ));
        }
        if record["schema"] != "oi.epi-world-material/v1"
            || world["schema"] != "oi.epi-portable-world/v1"
            || source["schema"] != "oi.native-expression-composed-source/v1"
            || original["schema"] != "ql.scene-world-request/v1"
        {
            return Err(refuse(
                "The saved Scene lacks its complete original native World/source constructor",
            ));
        }
        // Later acknowledged continuation and material belong to their native
        // current-source/recording owner. Until that producer is paired, refuse
        // before compilation rather than restart this World at its origin.
        if record
            .get("native_readback")
            .is_some_and(|current| !same_json(current, &world["native_readback"]))
            || record.get("continuation_start").is_some_and(|current| {
                record.get("native_readback").is_none()
                    || !same_json(current, &world["native_readback"]["continuation_start"])
            })
        {
            return Err(refuse(
                "Saved acknowledged World continuation requires its actual native current-source/recording opening; original-world restart refused",
            ));
        }
        if let Some(policy) = record.get("current_material_policy") {
            if policy["schema"] != "oi.epi-current-material-policy/v1"
                || !same_json(&policy["material"], &world["binding"]["host"]["material"])
            {
                return Err(refuse(
                    "Saved current native material policy requires its actual continuation source opening; original material restart refused",
                ));
            }
        }
        let input = original
            .as_object()
            .ok_or_else(|| refuse("Original constructor is not an object"))?;
        if input.keys().any(|key| {
            ![
                "schema",
                "instance_ref",
                "event_ref",
                "subject_ref",
                "sky",
                "texture",
                "units_per_metre",
                "snapshot_purpose",
                "start",
                "material",
            ]
            .contains(&key.as_str())
        }) {
            return Err(refuse(
                "Original World constructor contains an unsupported constituent",
            ));
        }
        let hash = sha256_hex(original_bytes.as_bytes());
        if serde_json::to_string(original).map_err(|e| e.to_string())? != original_bytes {
            return Err(refuse(
                "Saved original constructor is not the exact native canonical encoding",
            ));
        }
        if source["request_sha256"] != hash
            || source["world_ref"]["revision"] != hash
            || source["world_ref"]["availability"] != "available"
            || source["world_ref"]["ref"]
                != format!("ql:scene-world:{}", reader.document().expression_ref)
            || original["instance_ref"] != reader.document().expression_ref
            || world["instance_ref"] != original["instance_ref"]
            || record["receiving"]["expression_ref"] != original["instance_ref"]
            || record["receiving"]["scene_ref"] != world_scene.scene_ref
            || record["receiving"]["subject_ref"] != original["subject_ref"]
            || record["receiving"]["event_ref"] != original["event_ref"]
            || original["subject_ref"] != record["person_ref"]
            || world["subject_ref"] != original["subject_ref"]
            || original["event_ref"] != original["sky"]["snapshot_ref"]
            || world["event_ref"] != original["event_ref"]
            || world["snapshot_ref"] != original["event_ref"]
            || record["receiving"]["snapshot_ref"] != original["event_ref"]
            || !same_json(&world["sky"], &original["sky"])
            || !same_json(&source["sky"], &original["sky"])
        {
            return Err(refuse(
                "Saved World, original constructor, particular subject, occasion or source digest differ",
            ));
        }
        if !source["binding_sha256"].as_str().is_some_and(valid_digest)
            || !source["ql_executable_sha256"]
                .as_str()
                .is_some_and(valid_digest)
            || !matches!(
                source["ql_selection"].as_str(),
                Some("installed" | "operator-override")
            )
            || !(source["ql_revision"].is_null()
                || source["ql_revision"]
                    .as_str()
                    .is_some_and(|v| !v.is_empty()))
        {
            return Err(refuse(
                "Saved native provider/binding qualification is incomplete; refresh its source owner",
            ));
        }
        let mut world_input =
            json!({"instance_ref":original["instance_ref"], "subject_ref":original["subject_ref"]});
        for key in ["start", "material"] {
            if let Some(value) = original.get(key) {
                world_input[key] = value.clone();
            }
        }
        // Every value is an original native constructor constituent. In
        // particular there is no default sky, material, texture or new subject.
        let mut consumer = json!({"texture":original["texture"], "units_per_metre":original["units_per_metre"],
            "sky_snapshot":original["sky"], "world":world_input});
        if let Some(value) = original.get("snapshot_purpose") {
            consumer["snapshot_purpose"] = value.clone();
        }
        compose_request(&consumer)?;
        let source_manifest = reader.native_manifest()?;
        Ok(Self {
            record: record.clone(),
            original_request: original.clone(),
            consumer_request: consumer,
            source_manifest,
            world_source_scene,
        })
    }

    fn qualify(&self, composed: &ComposedBinding) -> Result<(), String> {
        let refuse =
            |reason: &str| format!("native-expression.selected_scene_source_refused: {reason}");
        let actual = composed.source();
        let saved = &self.record["native_source"];
        if composed.world_opening.is_none()
            || composed.finish != ComposeFinish::Open
            || actual["constructor_request"] != self.original_request
        {
            return Err(refuse(
                "Actual native composer returned a different original constructor or no private opening",
            ));
        }
        for key in [
            "request_sha256",
            "ql_executable_sha256",
            "ql_revision",
            "ql_selection",
            "sky",
        ] {
            if !same_json(&actual[key], &saved[key]) {
                return Err(refuse(&format!(
                    "Actual native provider/source {key} changed; refresh the native source owner"
                )));
            }
        }
        let binding_digest = sha256_hex(composed.binding_content().as_bytes());
        if saved["binding_sha256"] != binding_digest || actual["binding_sha256"] != binding_digest {
            return Err(refuse(
                "Actual native binding differs from the saved complete source binding",
            ));
        }
        let mut portable = actual["world"].clone();
        if portable["schema"] != "ql.scene-world/v1" {
            return Err(refuse("Actual native World schema changed"));
        }
        let presentation = portable["binding"]["presentation"]
            .as_object_mut()
            .ok_or_else(|| refuse("Actual native World has no compiled presentation"))?;
        let runtime = &self.record["runtime_buffers"];
        let rows = runtime["buffers"]
            .as_array()
            .ok_or_else(|| refuse("Saved native runtime buffer qualification absent"))?;
        if runtime["schema"] != "oi.epi-native-runtime-buffers/v1"
            || runtime["policy"] != "native-owner-recompose"
            || rows.len() != 2
            || runtime["reading"] != saved["world_ref"]
        {
            return Err(refuse(
                "Saved World lost its original native runtime buffer policy/source",
            ));
        }
        for key in ["slots_a", "slots_b"] {
            let values = presentation
                .remove(key)
                .ok_or_else(|| refuse("Actual native World omitted a runtime buffer"))?;
            let values = values
                .as_array()
                .ok_or_else(|| refuse("Native runtime buffer is not an array"))?;
            let matching: Vec<_> = rows.iter().filter(|row| row["key"] == key).collect();
            if matching.len() != 1
                || matching[0]["values"].as_u64() != Some(values.len() as u64)
                || !matching[0]["json_sha256"]
                    .as_str()
                    .is_some_and(valid_digest)
            {
                return Err(refuse(
                    "Saved native runtime buffer identity/cardinality is inconsistent",
                ));
            }
            // The complete original binding digest above qualifies ALL original
            // runtime values. Portable JSON's JS lexical digest is retained as
            // evidence; it does not replace the native binding byte digest.
        }
        let owners = portable["native_owner_sources"]
            .as_object()
            .ok_or_else(|| refuse("Actual native World lost its native owner roles"))?;
        if owners.len() != 3
            || !["constructor", "coupled", "field"]
                .iter()
                .all(|role| owners.contains_key(*role))
        {
            return Err(refuse(
                "Actual native World omitted an original native owner role",
            ));
        }
        let mut owner_rows: Vec<_> = owners
            .iter()
            .map(|(role, reading)| json!({"role":role,"reading":reading}))
            .collect();
        owner_rows.sort_by_key(|row| row["role"].as_str().unwrap_or("").to_owned());
        portable["native_owner_sources"] = json!(owner_rows);
        portable["schema"] = json!("oi.epi-portable-world/v1");
        let mut retained = self.record["world"].clone();
        let retained_owners = retained["native_owner_sources"]
            .as_array_mut()
            .ok_or_else(|| refuse("Saved portable World has no original native owner roles"))?;
        retained_owners.sort_by_key(|row| row["role"].as_str().unwrap_or("").to_owned());
        if !same_json(&portable, &retained) {
            return Err(refuse(
                "Complete actual native World differs from the saved portable World",
            ));
        }
        Ok(())
    }
}
// JSON number lexical changes (1.0→1) in the ordinary JS save path cannot
// change the binary64 value. Exact native constructor bytes remain separately
// hashed above; this comparison permits only equivalent JSON number spelling.
fn same_json(left: &Value, right: &Value) -> bool {
    match (left, right) {
        (Value::Number(a), Value::Number(b)) => {
            if a == b {
                return true;
            }
            if (a.is_i64() || a.is_u64()) && (b.is_i64() || b.is_u64()) {
                return false;
            }
            // Never round a distinct native integer through binary64. A JS
            // lexical integer/float transition is safe only within its exact
            // integer range; identities and 64-bit counters remain exact.
            const SAFE: u64 = 9_007_199_254_740_991;
            if [a, b].iter().any(|n| {
                n.as_u64().is_some_and(|v| v > SAFE)
                    || n.as_i64().is_some_and(|v| v.unsigned_abs() > SAFE)
            }) {
                return false;
            }
            match (a.as_f64(), b.as_f64()) {
                (Some(a), Some(b)) => a.to_bits() == b.to_bits(),
                _ => false,
            }
        }
        (Value::Array(a), Value::Array(b)) => {
            a.len() == b.len() && a.iter().zip(b).all(|(a, b)| same_json(a, b))
        }
        (Value::Object(a), Value::Object(b)) => {
            a.len() == b.len()
                && a.iter()
                    .all(|(key, value)| b.get(key).is_some_and(|other| same_json(value, other)))
        }
        _ => left == right,
    }
}
fn valid_digest(value: &str) -> bool {
    value.len() == 64
        && value
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
}

/// Prepared under the actual Kernel lock; composition executes outside it.
/// The private Scene owner is the existing Application constructor Arc.
pub struct Prepared {
    request: Request,
    before: Document,
    scene_owner: SceneOwner,
    retained: RetainedWorld,
    compose: PreparedCompose,
}
/// One original reply held by its actual Manager. This is not a new source
/// registry or imported acknowledgement and has no wire constructor.
#[derive(Debug)]
pub(super) struct SelectedOpening {
    request: Request,
    document_sha256: String,
    scene_owner: SceneOwner,
    opened: Value,
    closed: Option<Value>,
    source_observation: Option<source::Observation>,
}

pub struct Completed {
    request: Request,
    before: Document,
    scene_owner: SceneOwner,
    retained: RetainedWorld,
    composed: ComposedBinding,
}
impl Prepared {
    pub fn execute(self) -> Result<Completed, String> {
        let composed = self.compose.execute()?;
        self.retained.qualify(&composed)?;
        Ok(Completed {
            request: self.request,
            before: self.before,
            scene_owner: self.scene_owner,
            retained: self.retained,
            composed,
        })
    }
}
impl super::Manager {
    pub(super) fn retain_selected_scene_closure(&mut self, lease: &str, actual_close: &Value) {
        if let Some(stored) = self.selected_scene_opening.as_mut() {
            if stored.opened["lease"] == lease {
                stored.closed = Some(actual_close.clone());
            }
        }
    }
}

impl crate::Kernel {
    pub(crate) fn native_selected_scene_open(&mut self, request: Request) -> Result<Value, String> {
        let op = crate::KernelOp::NativeExpression {
            request: super::Request::OpenSelectedScene { request },
        };
        let prepared = self
            .prepare_native_selected_scene_open(&op)?
            .ok_or("Selected native Scene opening was not prepared")?;
        let outcome = self.finish_native_selected_scene_open(prepared.execute()?)?;
        match outcome.result {
            crate::KernelOpResult::NativeExpression { data } => Ok(data),
            _ => Err("Selected native Scene opening returned another native result".into()),
        }
    }

    pub(crate) fn recover_native_selected_scene_open(
        &mut self,
        request: Request,
    ) -> Result<Value, String> {
        request.validate()?;
        let stored = self
            .native_expression
            .selected_scene_opening
            .as_ref()
            .ok_or("No original selected-Scene opening is retained by this native Manager")?;
        if stored.request != request {
            return Err(
                "Selected-Scene recovery belongs to another original Document/Scene request".into(),
            );
        }
        if let Some(closed) = &stored.closed {
            return Ok(
                json!({"schema":"oi.native-expression-selected-scene-recovery/v1",
                "original_open":stored.opened,"original_close":closed,"source_current":false,
                "source_currentness":"Original selected-Scene opening was closed",
                "recoverable":false,"reason":"The actual native owner acknowledged closure; abandon the exact original pending opening","replayed":false}),
            );
        }
        let owner = self
            .native_expression
            .active
            .as_mut()
            .ok_or("Original selected-Scene native owner is no longer active")?;
        if stored.opened["lease"] != owner.lease || owner.stopped || owner.process_exited()? {
            return Err("Original selected-Scene native process/lease is no longer current".into());
        }
        let unconsumed = super::cursor(&stored.opened["receipt"]["last_request_id"])?
            == owner.last_request_id
            && stored.opened["receipt"]["field"]["generation"]
                == owner.procedural_position["generation"]
            && stored.opened["receipt"]["field"]["samples_elapsed"]
                == owner.procedural_position["samples_elapsed"];
        // A previously refused native admission cannot become qualified merely
        // because its Document and cursor did not change.
        let original_qualified = stored.opened["source_current"] == true
            && stored.opened["qualification"] == "pending_source_bootstrap"
            && ["instance_ref", "event_ref", "subject_ref"]
                .iter()
                .all(|key| {
                    owner.identity[*key] == stored.opened["source"]["constructor_request"][*key]
                });
        let currentness = self.expressions.procedural_source_snapshot(&request.expression_ref, request.document_revision)
            .and_then(|current| {
                if crate::native_expression::procedural::bootstrap::fingerprint(&current)? != stored.document_sha256 {
                    return Err("Complete selected Document changed after the original native opening".into());
                }
                self.expressions.require_procedural_scene_owner(&stored.scene_owner, &current)
            })
            .and_then(|()| if original_qualified {Ok(())} else {Err("Original actual native opening was unqualified or its live identity changed".into())});
        Ok(
            json!({"schema":"oi.native-expression-selected-scene-recovery/v1",
            "original_open":stored.opened,"source_current":currentness.is_ok(),
            "source_currentness":currentness.as_ref().err(),"recoverable":unconsumed && currentness.is_ok(),
            "reason":if unconsumed {Value::Null} else {json!("Original native owner has consumed later work; use its original ordered receiver recovery or abandon this exact opening")},
            "replayed":false}),
        )
    }

    pub(crate) fn abandon_native_selected_scene_open(
        &mut self,
        request: Request,
    ) -> Result<Value, String> {
        request.validate()?;
        let stored = self
            .native_expression
            .selected_scene_opening
            .as_ref()
            .ok_or("No original selected-Scene opening is retained by this native Manager")?;
        if stored.request != request {
            return Err("Selected-Scene abandonment belongs to another original request".into());
        }
        if let Some(closed) = &stored.closed {
            let mut data = closed.clone();
            data["original_selected_scene"] = json!(request);
            data["abandoned"] = json!(true);
            data["recovered_closure"] = json!(true);
            self.native_expression.selected_scene_opening = None;
            return Ok(data);
        }
        let lease = stored.opened["lease"]
            .as_str()
            .ok_or("Original native opening has no lease")?
            .to_owned();
        let mut data = self
            .native_expression
            .apply(&self.client, super::Request::Close { lease })?;
        self.native_expression.selected_scene_opening = None;
        data["original_selected_scene"] = json!(request);
        data["abandoned"] = json!(true);
        Ok(data)
    }

    pub fn prepare_native_selected_scene_open(
        &mut self,
        op: &crate::KernelOp,
    ) -> Result<Option<Prepared>, String> {
        let crate::KernelOp::NativeExpression {
            request: super::Request::OpenSelectedScene { request },
        } = op
        else {
            return Ok(None);
        };
        request.validate()?;
        let before = self
            .expressions
            .procedural_source_snapshot(&request.expression_ref, request.document_revision)?;
        let scene_owner = self
            .expressions
            .procedural_scene_owner(&before, &request.scene_ref)?;
        let result = self.with_native_document_scene(
            &request.expression_ref,
            request.document_revision,
            &request.scene_ref,
            request.scene_revision,
            |manager, reader| {
                let retained = RetainedWorld::read(reader)?;
                let compose = manager.prepare_compose(&retained.consumer_request)?;
                Ok((retained, compose))
            },
        )?;
        result.currentness?;
        let (retained, compose) = result.result?;
        scene_owner.closed_constructor_fact(&before, &request.scene_ref)?;
        Ok(Some(Prepared {
            request: request.clone(),
            before,
            scene_owner,
            retained,
            compose,
        }))
    }

    pub fn finish_native_selected_scene_open(
        &mut self,
        completed: Completed,
    ) -> Result<crate::KernelOpOutcome, String> {
        let Completed {
            request,
            before,
            scene_owner,
            retained,
            composed,
        } = completed;
        let actual = self
            .expressions
            .procedural_source_snapshot(&request.expression_ref, request.document_revision)?;
        if actual != before {
            return Err("Complete selected native Document changed during World compilation; reread its current Scene".into());
        }
        self.expressions
            .require_procedural_scene_owner(&scene_owner, &before)?;
        let constructor = scene_owner.closed_constructor_fact(&before, &request.scene_ref)?;
        retained.qualify(&composed)?;
        let mut data = self.native_expression.finish_compose(composed)?;
        // Preserve the actual open/lease/initial native receipt even on a
        // post-operation source refusal. It must never be replayed as an ACK.
        let currentness = self
            .expressions
            .procedural_source_snapshot(&request.expression_ref, request.document_revision)
            .and_then(|current| {
                if current == before {
                    Ok(())
                } else {
                    Err("Full selected Document changed after native opening".into())
                }
            })
            .and_then(|()| {
                self.expressions
                    .require_procedural_scene_owner(&scene_owner, &before)
            });
        let identity_ok = data["receipt"]["instance_ref"]
            == retained.original_request["instance_ref"]
            && data["receipt"]["field"]["event_ref"] == retained.original_request["event_ref"]
            && data["receipt"]["field"]["subject_ref"] == retained.original_request["subject_ref"];
        let currentness = currentness.and_then(|()| {
            if identity_ok {
                Ok(())
            } else {
                Err("Actual opened native World returned another subject/occasion".into())
            }
        });
        data["selected_scene"] = json!(request);
        data["source_read_receipt"] = retained.source_manifest;
        data["world_source_scene"] = retained.world_source_scene;
        data["native_scene_constructor"] = constructor;
        data["source_current"] = json!(currentness.is_ok());
        data["source_currentness"] = json!(currentness.as_ref().err());
        // Opening is a real native World admission. The existing SAME-session
        // source_bootstrap still issues the separate C31 procedural Source grant.
        data["bootstrap"] = Value::Null;
        data["native_source_channel"] = Value::Null;
        data["qualification"] = json!(if currentness.is_ok() {
            "pending_source_bootstrap"
        } else {
            "unqualified"
        });
        self.native_expression.selected_scene_opening = Some(SelectedOpening {
            request,
            document_sha256: crate::native_expression::procedural::bootstrap::fingerprint(&before)?,
            scene_owner,
            opened: data.clone(),
            closed: None,
            source_observation: None,
        });
        Ok(crate::KernelOpOutcome {
            receipts: Vec::new(),
            result: crate::KernelOpResult::NativeExpression { data },
        })
    }
}
