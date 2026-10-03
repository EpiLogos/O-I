//! The selected native owner supplies provenance; the Expression owner supplies
//! the exact material and CAS. Neither part can be issued by a JSON request.
use crate::expression::{Document, ReadingRef};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::sync::atomic::{AtomicU64, Ordering};

pub const INTENT_SCHEMA: &str = "oi.expression-procedural-source-bootstrap-intent/v1";
pub const RESPONSE_SCHEMA: &str = "oi.expression-procedural-source-bootstrap/v1";
static READ_SEQUENCE: AtomicU64 = AtomicU64::new(0);

/// Created by the Kernel over its actual selected Document. The existing
/// coordinate owner executes outside the mutation lock, then the same native
/// lease, complete Document and original request are admitted again.
pub struct Prepared {
    before: Document,
    identity: Value,
    input: super::conduct::Request,
    intent: Intent,
    scene_owner: crate::expression::procedural::scene_receiver::SceneOwner,
}
pub struct Completed {
    before: Document,
    identity: Value,
    input: super::conduct::Request,
    intent: Intent,
    issued: IssuedSceneRead,
}
impl Prepared {
    pub fn execute(self) -> Result<Completed, String> {
        let issued = read_selected_scene(&self.before, &self.identity, &self.intent)?
            .with_scene_owner(self.scene_owner, &self.before, &self.intent)?;
        Ok(Completed {
            before: self.before,
            identity: self.identity,
            input: self.input,
            intent: self.intent,
            issued,
        })
    }
}

/// Execute the existing coordinate owner over the original accepted source
/// authorship and a fresh actual Document. Only protected native operations
/// can obtain the non-deserializable selected-Scene read.
pub(super) fn read_selected_scene(
    before: &Document,
    identity: &Value,
    intent: &Intent,
) -> Result<IssuedSceneRead, String> {
    intent.validate()?;
    let ground = intent.authorship["ground_ref"]
        .as_str()
        .ok_or("Source authorship requires its actual canonical ground")?;
    let face = intent.authorship["ground_face"]
        .as_str()
        .ok_or("Source authorship requires its actual native face")?;
    crate::expression::text(ground)?;
    if !matches!(face, "bimba" | "pratibimba") {
        return Err("Source authorship has no native Bimba/Pratibimba face".into());
    }
    // Use the existing original coordinate wire. Optional disclosure and
    // inventory extensions remain owned by the current native adapter.
    let coordinate_request: crate::nara_coordinate::Request =
        serde_json::from_value(json!({"coordinate_ref":ground,"face":face}))
            .map_err(|e| e.to_string())?;
    let outcome = crate::nara_coordinate::execute(coordinate_request)?;
    let crate::KernelOpResult::NaraCoordinate { data: coordinate } = outcome.result else {
        return Err("The actual coordinate owner returned another result".into());
    };
    let subject: crate::expression::SubjectBinding =
        serde_json::from_value(coordinate["subject_binding"].clone()).map_err(|e| e.to_string())?;
    let locus = subject
        .sources
        .first()
        .ok_or("Native canonical locus is absent")?;
    let source = subject
        .readings
        .first()
        .ok_or("Native resolved profile source is absent")?;
    let binding = &coordinate["binding"];
    let world = &binding["rooted_world"];
    let native_face = if face == "bimba" {
        "direct"
    } else {
        "conjugate"
    };
    if coordinate["schema"] != "oi.nara-coordinate/v1"
        || binding["schema"] != "ql.coordinate-expression-binding/v1"
        || binding["face"] != face
        || subject.native_owner != "ql-mef"
        || subject.subject_ref != ground
        || locus.r#ref != subject.subject_ref
        || world[native_face]["canonical_ref"] != subject.subject_ref
        || world["registry_revision"] != locus.revision
        || binding["resolved_profile_ref"] != source.r#ref
        || binding["binding_content_revision"] != source.revision
        || locus.availability != crate::expression::Availability::Available
        || source.availability != crate::expression::Availability::Available
    {
        return Err(
            "Native coordinate/profile/locus differs from the original authored ground".into(),
        );
    }
    let scene = before
        .scenes
        .iter()
        .find(|s| s.scene_ref == intent.scene_ref)
        .ok_or("The actual selected native Scene is absent")?;
    let current_bindings = scene
        .presentation
        .as_ref()
        .and_then(|p| p.scene["procedural"]["bindings"].as_array());
    for current in current_bindings.into_iter().flatten().filter(|b| {
        b["address"]["scene_ref"] == intent.scene_ref
            && b["address"]["component"] == "scene"
            && b["address"]["entity_ref"].is_null()
    }) {
        if current["locus"] != json!(locus) {
            return Err("The actual Scene already stands at another native locus; review an explicit source change".into());
        }
    }
    for adopted in before.profiles.iter().filter(|p| {
        p.source_basis
            .as_ref()
            .is_some_and(|b| b.r#ref == locus.r#ref)
    }) {
        if adopted.source_basis.as_ref() != Some(locus)
            || adopted.profile_ref != source.r#ref
            || binding["profile_revision"].as_u64() != Some(adopted.revision)
        {
            return Err("The actual adopted native coordinate profile is stale; refresh its original owner reading".into());
        }
    }
    let sequence = READ_SEQUENCE
        .try_update(Ordering::Relaxed, Ordering::Relaxed, |n| n.checked_add(1))
        .map_err(|_| "Native selected Scene read sequence exhausted")?;
    let receipt_ref = format!(
        "native-scene-read:{}:{}:{sequence}",
        std::process::id(),
        super::super::unix_ms()?
    );
    let receipt = json!({"schema":"oi.native-selected-scene-source-read/v1",
            "receipt_ref":receipt_ref,"expression_ref":before.expression_ref,
            "scene_ref":intent.scene_ref,"document_revision":before.revision,
            "document_fingerprint":fingerprint(&before)?,"native_identity":identity,
            "coordinate":coordinate,"original_intent":intent});
    let issued = IssuedSceneRead::from_selected_owner(
        before,
        &intent.scene_ref,
        source.clone(),
        locus.clone(),
        receipt_ref,
        receipt,
    )?;
    Ok(issued)
}

impl crate::Kernel {
    pub fn prepare_native_procedural_bootstrap(
        &mut self,
        op: &crate::KernelOp,
    ) -> Result<Option<Prepared>, String> {
        let crate::KernelOp::NativeExpression {
            request: super::super::Request::ProceduralConduct { request: input },
        } = op
        else {
            return Ok(None);
        };
        if input.request["command"]["request"]["action"] != "source_bootstrap" {
            return Ok(None);
        }
        if input.request["schema"] != "ql.field-host-request/v1"
            || input.request["command"]["operation"] != "procedure"
            || input.source_producer_ref.is_some()
        {
            return Err("Source bootstrap requires the original scoped native host intent".into());
        }
        let intent: Intent =
            serde_json::from_value(input.request["command"]["request"]["input"].clone())
                .map_err(|e| e.to_string())?;
        intent.validate()?;
        let before = self
            .expressions
            .procedural_source_snapshot(&input.expression_ref, input.document_revision)?;
        crate::expression::procedural::bootstrap::preflight_native_intake(&before, input)?;
        let scene_owner = self
            .expressions
            .procedural_scene_owner(&before, &intent.scene_ref)?;
        let owner = self
            .native_expression
            .active
            .as_mut()
            .ok_or("No current native Scene source owner")?;
        if owner.lease != input.lease || owner.stopped || owner.process_exited()? {
            return Err("Source bootstrap belongs to another or closed native owner".into());
        }
        Ok(Some(Prepared {
            before,
            identity: owner.identity.clone(),
            input: input.clone(),
            intent,
            scene_owner,
        }))
    }

    pub fn finish_native_procedural_bootstrap(
        &mut self,
        completed: Completed,
    ) -> Result<crate::KernelOpOutcome, String> {
        let Completed {
            before,
            identity,
            input,
            intent,
            issued,
        } = completed;
        let current = self
            .expressions
            .procedural_source_snapshot(&input.expression_ref, input.document_revision)?;
        if current != before {
            return Err("The full selected native Document changed during source reading; retain and requalify the original authorship".into());
        }
        issued.require_scene_owner(&self.expressions, &before)?;
        let owner = self
            .native_expression
            .active
            .as_mut()
            .ok_or("Native Scene source owner closed during coordinate reading")?;
        if owner.lease != input.lease
            || owner.stopped
            || owner.identity != identity
            || owner.process_exited()?
        {
            return Err("Native Scene source owner changed during coordinate reading".into());
        }
        let mut request = input.request;
        request["command"]["request"]["input"] = issued.request(&intent)?;
        let scene_revision = before
            .scenes
            .iter()
            .find(|scene| scene.scene_ref == intent.scene_ref)
            .ok_or("Actual current source Scene disappeared")?
            .revision;
        let outcome = self.with_native_document_scene(
            &input.expression_ref, input.document_revision, &intent.scene_ref, scene_revision,
            |manager, reader| Ok(manager.procedural_bootstrap_scene_read(
                &input.lease,
                &crate::expression_procedural_scene_reader::NativeSceneSourceReader::CurrentDocument(reader),
                &issued, &intent, request,
            )),
        )?;
        let (reply, channel_receipt) = match outcome.result? {
            Ok(receipts) => receipts,
            Err(refusal) => {
                return Ok(crate::KernelOpOutcome {
                    receipts: Vec::new(),
                    result: crate::KernelOpResult::NativeExpression {
                        data: json!({"schema":RESPONSE_SCHEMA,"original_intent":intent,
                            "native_receipt":refusal.native_reply().and_then(|reply| reply.get("result")).and_then(|result| result.get("native_receipt")),
                            "native_source_channel":refusal.native_reply(),"state":"source_channel_refused",
                            "reason":refusal.reason(),"source_currentness":outcome.currentness.as_ref().err(),
                            "source_current":false,"qualification":"unqualified","replayed":false}),
                    },
                });
            }
        };
        let source_currentness = outcome
            .currentness
            .and_then(|()| issued.require_scene_owner(&self.expressions, &before));
        let (data, changed) = if reply["status"] == "ok" {
            let admitted = source_currentness
                .and_then(|()| issued.qualify(&before, &intent, &reply))
                .and_then(|admission| {
                    self.expressions
                        .finish_source_bootstrap(&self.client, admission)
                });
            match admitted {
                Ok(accepted) => accepted,
                Err(reason) => {
                    // The native ordinal/pulse has already been consumed. Its
                    // complete original ACK must reach the same session even
                    // when Source qualification or Document adoption refuses.
                    let inspected = self.expressions.apply(
                        &self.client,
                        crate::expression::Request::Inspect {
                            expression_ref: before.expression_ref.clone(),
                        },
                    );
                    let (document_receipt, unchanged) = match inspected {
                        Ok((inspected, _)) => {
                            let unchanged =
                                serde_json::from_value::<Document>(inspected["document"].clone())
                                    .is_ok_and(|document| document == before);
                            (inspected, unchanged)
                        }
                        Err(error) => (json!({"state":"unavailable","reason":error}), false),
                    };
                    (
                        json!({"schema":RESPONSE_SCHEMA,"original_intent":intent,
                        "native_receipt":reply,"state":if unchanged {"source_attribution_refused"} else {"reconciliation_required"},
                        "reason":reason,"document_receipt":document_receipt,"source":null,
                        "source_current":false,"qualification":"unqualified","replayed":false}),
                        None,
                    )
                }
            }
        } else {
            (
                json!({"schema":RESPONSE_SCHEMA,"original_intent":intent,"native_receipt":reply,
                "source_current":false,"qualification":"source_refused","replayed":false,
                "state":"source_refused"}),
                None,
            )
        };
        let mut data = data;
        data["native_source_channel"] = channel_receipt;
        let mut receipts = Vec::new();
        if let Some(change) = changed {
            for entry in self.nara_contexts.values_mut() {
                if entry
                    .m3
                    .as_ref()
                    .is_some_and(|state| state.expression_ref() == change.expression_ref)
                {
                    entry.m3 = None;
                }
            }
            self.nara_voice
                .invalidate_expression(&change.expression_ref);
            receipts.push(self.log.record(crate::KernelEvent::ExpressionChanged {
                expression_ref: change.expression_ref,
                revision: change.revision,
                actor: change.actor,
                activity_ref: change.activity_ref,
            }));
        }
        Ok(crate::KernelOpOutcome {
            receipts,
            result: crate::KernelOpResult::NativeExpression { data },
        })
    }
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct Intent {
    pub schema: String,
    pub scene_ref: String,
    pub operation_ref: String,
    pub authorship: Value,
}
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct RetryRequest {
    pub schema: String,
    pub lease: String,
    pub expression_ref: String,
    pub document_revision: u64,
    pub intent: Intent,
}
impl RetryRequest {
    pub(crate) fn validate(&self) -> Result<(), String> {
        if self.schema != "oi.expression-procedural-source-bootstrap-retry/v1"
            || self.document_revision == 0
        {
            return Err("Expected the original native source-bootstrap retry basis".into());
        }
        crate::expression::text(&self.lease)?;
        crate::expression::text(&self.expression_ref)?;
        self.intent.validate()
    }
}
impl Intent {
    pub(crate) fn validate(&self) -> Result<(), String> {
        if self.schema != INTENT_SCHEMA || !self.authorship.is_object() {
            return Err("Expected explicit native source authorship".into());
        }
        crate::expression::text(&self.scene_ref)?;
        crate::expression::text(&self.operation_ref)?;
        crate::expression::text(
            self.authorship["actor_ref"]
                .as_str()
                .ok_or("Source authorship has no original actor")?,
        )?;
        Ok(())
    }
}

/// This type has no wire constructor, Clone, Serialize or Deserialize. The
/// existing closed selected-Act reader calls the constructor after qualifying
/// its actual source/profile/locus receipt against this same Document.
pub(crate) struct IssuedSceneRead {
    before_fingerprint: String,
    reading: Value,
    issuer_receipt: Value,
    scene_owner: Option<crate::expression::procedural::scene_receiver::SceneOwner>,
}
impl IssuedSceneRead {
    fn with_scene_owner(
        mut self,
        owner: crate::expression::procedural::scene_receiver::SceneOwner,
        before: &Document,
        intent: &Intent,
    ) -> Result<Self, String> {
        if self.scene_owner.is_some() || self.before_fingerprint != fingerprint(before)? {
            return Err(
                "Selected native Scene constructor already bound or Document changed".into(),
            );
        }
        owner.closed_constructor_fact(before, &intent.scene_ref)?;
        self.scene_owner = Some(owner);
        Ok(self)
    }

    fn require_scene_owner(
        &self,
        application: &crate::expression::Application,
        before: &Document,
    ) -> Result<(), String> {
        let owner = self
            .scene_owner
            .as_ref()
            .ok_or("Original native Scene constructor absent")?;
        application.require_procedural_scene_owner(owner, before)
    }

    /// C31 obtains this only from the original registered native constructor
    /// paired with this same complete private selected-Scene source read.
    /// It is separate from the unchanged original two-field source-read wire.
    pub(crate) fn closed_scene_constructor_fact(
        &self,
        reader: &crate::expression_procedural_scene_reader::NativeSceneSourceReader<'_>,
        intent: &Intent,
    ) -> Result<Value, String> {
        self.validate_closed_source_read(reader, intent)?;
        self.scene_owner
            .as_ref()
            .ok_or("Original native Document Scene constructor absent")?
            .closed_constructor_fact(reader.document(), &reader.scene().scene_ref)
    }
    /// C31 captures this only while its actual Document/Scene reader is held.
    /// The receipt contains the original authored selection; it cannot be
    /// reconstructed by a procedural request or a retained source label.
    pub(crate) fn closed_source_read(
        &self,
        reader: &crate::expression_procedural_scene_reader::NativeSceneSourceReader<'_>,
        intent: &Intent,
    ) -> Result<Value, String> {
        self.validate_closed_source_read(reader, intent)?;
        Ok(json!({"reading":self.reading,"issuer_receipt":self.issuer_receipt}))
    }

    fn validate_closed_source_read(
        &self,
        reader: &crate::expression_procedural_scene_reader::NativeSceneSourceReader<'_>,
        intent: &Intent,
    ) -> Result<(), String> {
        self.request(intent)?;
        if fingerprint(reader.document())? != self.before_fingerprint
            || reader.scene().scene_ref != intent.scene_ref
            || self.issuer_receipt["document_fingerprint"] != self.before_fingerprint
            || self.issuer_receipt["original_intent"]
                != serde_json::to_value(intent).map_err(|e| e.to_string())?
            || self.issuer_receipt["receipt_ref"] != self.reading["source_read_receipt_ref"]
            || crate::expression::procedural::manual::scene_material(reader.scene())?
                != self.reading["presentation"]
        {
            return Err(
                "Actual private Scene source issuer changed the full Document/material/intent"
                    .into(),
            );
        }
        Ok(())
    }

    pub(super) fn lifecycle_reading(
        &self,
        before: &Document,
        scene_ref: &str,
    ) -> Result<Value, String> {
        if self.before_fingerprint != fingerprint(before)?
            || self.reading["expression_ref"] != before.expression_ref
            || self.reading["document_revision"].as_u64() != Some(before.revision)
            || self.reading["scene_ref"] != scene_ref
        {
            return Err(
                "Lifecycle private selected-Scene read has another actual Document/Scene".into(),
            );
        }
        crate::expression::procedural::bootstrap::preflight_scene_request(
            &self.reading,
            &serde_json::from_value::<Intent>(self.issuer_receipt["original_intent"].clone())
                .map_err(|e| e.to_string())?,
        )?;
        Ok(self.reading.clone())
    }

    pub(in crate::native_expression) fn from_selected_owner(
        before: &Document,
        scene_ref: &str,
        source: ReadingRef,
        locus: ReadingRef,
        source_read_receipt_ref: String,
        issuer_receipt: Value,
    ) -> Result<Self, String> {
        crate::expression::readings(&[source.clone(), locus.clone()])?;
        if source.availability != crate::expression::Availability::Available
            || locus.availability != crate::expression::Availability::Available
        {
            return Err("The selected native source/profile/locus is unavailable".into());
        }
        crate::expression::text(&source_read_receipt_ref)?;
        if !issuer_receipt.is_object() {
            return Err("The selected owner has no actual source-read receipt".into());
        }
        crate::expression::procedural::bootstrap::preflight_scene_read(
            before,
            scene_ref,
            &source,
            &locus,
            &issuer_receipt,
        )?;
        let scene = before
            .scenes
            .iter()
            .find(|scene| scene.scene_ref == scene_ref)
            .ok_or("The selected native source Scene is absent")?;
        let presentation = crate::expression::procedural::manual::scene_material(scene)?;
        let reading = json!({"native_owner":"oi.expression", "expression_ref":before.expression_ref,
            "scene_ref":scene_ref,"document_revision":before.revision,
            "source_basis":{"source_ref":source.r#ref,"revision":source.revision},
            "material_fingerprint":fingerprint(&presentation)?,"presentation":presentation,
            "locus":locus,"source_read_receipt_ref":source_read_receipt_ref});
        Ok(Self {
            before_fingerprint: fingerprint(before)?,
            reading,
            issuer_receipt,
            scene_owner: None,
        })
    }

    pub(crate) fn request(&self, intent: &Intent) -> Result<Value, String> {
        intent.validate()?;
        if self.reading["scene_ref"] != intent.scene_ref {
            return Err("Source authorship addresses another selected native Scene".into());
        }
        crate::expression::procedural::bootstrap::preflight_scene_request(&self.reading, intent)?;
        Ok(
            json!({"schema":"ql.native-procedural-source-bootstrap-request/v1",
            "scene":self.reading,"authorship":intent.authorship}),
        )
    }

    pub(crate) fn qualify(
        self,
        before: &Document,
        intent: &Intent,
        native_receipt: &Value,
    ) -> Result<crate::expression::procedural::bootstrap::Admission, String> {
        intent.validate()?;
        if self.before_fingerprint != fingerprint(before)? {
            return Err("The original private selected-Scene read has another Document".into());
        }
        let source = &native_receipt["procedural"];
        if native_receipt["status"] != "ok"
            || source["schema"] != "ql.native-procedural-source-bootstrap/v1"
            || source["native_owner"] != "ql-mef"
            || source["expression_ref"] != before.expression_ref
            || source["scene_ref"] != intent.scene_ref
            || source["document_revision"].as_u64() != Some(before.revision)
            || source["source_read_receipt_ref"] != self.reading["source_read_receipt_ref"]
            || source["source_material_fingerprint"] != self.reading["material_fingerprint"]
            || source["thread_plan"] != intent.authorship["thread_plan"]
            || source["authored_cprime"]["actor"] != intent.authorship["actor_ref"]
        {
            return Err(
                "Native source bootstrap differs from its actual original owner read/authorship"
                    .into(),
            );
        }
        let scene = &source["native_scene_source"];
        let principal: crate::expression::SubjectBinding =
            serde_json::from_value(scene["principal"].clone()).map_err(|e| e.to_string())?;
        crate::expression::text(&principal.subject_ref)?;
        crate::expression::readings(&principal.sources)?;
        let position = &source["native_position"];
        let field_source = &source["native_field_source"];
        for (value, name) in [
            (&position["instance_ref"], "native instance"),
            (&position["event_ref"], "native event"),
            (&position["subject_ref"], "native subject"),
            (&native_receipt["instance_ref"], "host instance"),
            (&source["timing"]["owner_ref"], "native timing owner"),
            (&source["timing"]["epoch_ref"], "native timing epoch"),
        ] {
            crate::expression::text(value.as_str().ok_or_else(|| format!("Missing {name}"))?)?;
        }
        let generation = super::super::cursor(&position["generation"])?;
        let samples = super::super::cursor(&position["samples_elapsed"])?;
        if field_source["instance_ref"] != position["instance_ref"]
            || field_source["current_basis"]["input"]["m3"]["subject_ref"] != principal.subject_ref
            || field_source["current_basis"]["input"]["m1"]["event_ref"] != position["event_ref"]
            || source["registry_revision"]
                != self.issuer_receipt["coordinate"]["binding"]["rooted_world"]["registry_revision"]
        {
            return Err("Native bootstrap has another actual source/registry boundary".into());
        }
        validate_timing_boundary(source, native_receipt, generation, samples)?;
        for key in [
            "native_owner",
            "expression_ref",
            "scene_ref",
            "document_revision",
            "source_basis",
            "material_fingerprint",
            "presentation",
        ] {
            if scene[key] != self.reading[key] {
                return Err(format!(
                    "Native source bootstrap changed original Scene {key}"
                ));
            }
        }
        if scene["contributors"] != intent.authorship["contributors"]
            || scene["locus_ref"] != self.reading["locus"]["ref"]
            || scene["locus_revision"] != self.reading["locus"]["revision"]
            || source["native_field_source"]["schema"] != "ql.native-held-field-source/v1"
            || source["native_position"]["instance_ref"] != native_receipt["instance_ref"]
            || source["native_position"]["subject_ref"] != scene["principal"]["subject_ref"]
            || !source["native_act_source"].is_object()
        {
            return Err("Native bootstrap has another actual field/source/Scene boundary".into());
        }
        let expected_binding = json!({"address":{"expression_ref":before.expression_ref,
            "scene_ref":intent.scene_ref,"entity_ref":null,"component":"scene",
            "constituent_ref":null,"property":null},
            "principal":scene["principal"],"contributors":scene["contributors"],
            "locus":self.reading["locus"],"tags":[]});
        if source["binding"] != expected_binding {
            return Err(
                "Native bootstrap binding exceeds its exact source Scene/principal/locus".into(),
            );
        }
        crate::expression::procedural::bootstrap::Admission::from_native_owner(
            before,
            intent.clone(),
            self.reading,
            self.issuer_receipt,
            native_receipt,
        )
    }
}
pub(super) fn validate_timing_boundary(
    source: &Value,
    receipt: &Value,
    generation: u64,
    samples: u64,
) -> Result<(), String> {
    let position = &source["native_position"];
    let timing = &source["timing"];
    let mapping = timing
        .get("time_mapping_ref")
        .ok_or("Native timing omitted its explicit mapping")?;
    if !mapping.is_null() {
        crate::expression::text(mapping.as_str().ok_or("Invalid native timing mapping")?)?;
    }
    match timing["domain"].as_str() {
        Some("native_field_samples") => {
            let field = &receipt["field"];
            if !source["native_timing_pulse"].is_null()
                || source["native_field_receipt"] != *field
                || position["event_ref"] != field["event_ref"]
                || position["subject_ref"] != field["subject_ref"]
                || super::super::cursor(&field["generation"])? != generation
                || super::super::cursor(&field["samples_elapsed"])? != samples
                || timing["requested_cursor"].as_u64() != Some(samples)
            {
                return Err("Bootstrap differs from its actual guarded FIELD receipt".into());
            }
        }
        Some("native_samples") => {
            let pulse = &source["native_timing_pulse"];
            let fact = &pulse["payload"]["timing_fact"];
            let binding = &fact["binding"];
            let reading = &pulse["reading"];
            let horizon = super::super::cursor(&fact["admission_horizon"])?;
            if !source["native_field_receipt"].is_null()
                || *pulse != receipt["native_timing_pulse"]
                || pulse["schema"] != "ql.performance-worker-reply/v1"
                || pulse["accepted"] != true
                || fact["schema"] != "ql.native-performance-timing-fact/v1"
                || fact["moment"] != "boundary"
                || fact["native_position"] != *position
                || binding["owner_ref"] != timing["owner_ref"]
                || binding["domain"] != timing["domain"]
                || binding["epoch_ref"] != timing["epoch_ref"]
                || binding["time_mapping_ref"] != *mapping
                || super::super::cursor(&binding["requested_cursor"])? != horizon
                || timing["requested_cursor"].as_u64() != Some(horizon)
                || horizon < samples
                || super::super::cursor(&fact["committed_cursor"])? != samples
                || fact["committed_cursor"] != reading["samples_elapsed"]
                || fact["committed_cursor"] != reading["physical"]["samples_elapsed"]
                || fact["committed_cursor"] != position["samples_elapsed"]
                || reading["scope"]["instance_ref"] != position["instance_ref"]
                || reading["scope"]["event_ref"] != position["event_ref"]
                || reading["scope"]["subject_ref"] != position["subject_ref"]
                || reading["physical"]["source_generation"] != position["generation"]
                || fact["transport_epoch"] != reading["transport_epoch"]
            {
                return Err(
                    "Bootstrap differs from its same native performance Boundary/pulse".into(),
                );
            }
        }
        _ => return Err("Bootstrap native timing owner is unpaired".into()),
    }
    Ok(())
}
pub(crate) fn fingerprint<T: Serialize + ?Sized>(value: &T) -> Result<String, String> {
    struct DigestWriter(Sha256);
    impl std::io::Write for DigestWriter {
        fn write(&mut self, bytes: &[u8]) -> std::io::Result<usize> {
            self.0.update(bytes);
            Ok(bytes.len())
        }
        fn flush(&mut self) -> std::io::Result<()> {
            Ok(())
        }
    }
    let mut writer = DigestWriter(Sha256::new());
    serde_json::to_writer(&mut writer, value).map_err(|e| e.to_string())?;
    Ok(format!("{:x}", writer.0.finalize()))
}

impl crate::Kernel {
    /// Read-only retry through the same native Document transaction. This
    /// does not exchange with QL or consume a request ordinal. The original
    /// host receipt remains historical evidence and is never an ACK here.
    pub(crate) fn native_procedural_source_bootstrap_retry(
        &mut self,
        request: RetryRequest,
    ) -> Result<Value, String> {
        request.validate()?;
        let owner = self
            .native_expression
            .active
            .as_mut()
            .ok_or("No current native source bootstrap owner; re-open and requalify")?;
        if owner.lease != request.lease || owner.stopped || owner.process_exited()? {
            return Err("Source bootstrap retry belongs to another or closed native owner".into());
        }
        let identity = owner.identity.clone();
        if let Some(replayed) = self.expressions.replay_source_bootstrap(
            &request.expression_ref,
            request.document_revision,
            &request.intent,
        )? {
            let position = &replayed["source"]["native_position"];
            if ["instance_ref", "event_ref", "subject_ref"]
                .iter()
                .any(|key| position[*key] != identity[*key])
            {
                return Err(
                    "Historical bootstrap source belongs to another current native owner".into(),
                );
            }
            return Ok(replayed);
        }
        let (inspected, _) = self.expressions.apply(
            &self.client,
            crate::expression::Request::Inspect {
                expression_ref: request.expression_ref.clone(),
            },
        )?;
        let revision = inspected["document"]["revision"]
            .as_u64()
            .ok_or("The native bootstrap retry has no actual current Document")?;
        Ok(json!({"schema":RESPONSE_SCHEMA,
            "state":if revision==request.document_revision {"cache_miss"} else {"revision_conflict"},
            "original_intent":request.intent,"expression_ref":request.expression_ref,
            "document_revision":revision,"document_receipt":inspected,
            "native_receipt":null,"historical_native_receipt":null,"native_procedural_receipts":[],
            "source_current":false,"replayed":false,"qualification":"unqualified"}))
    }
}
