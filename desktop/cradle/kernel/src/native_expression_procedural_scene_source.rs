//! Two privately borrowed source cases through the existing native Manager.
//! Source bootstrap carries the actual native coordinate issuer, never a
//! browser source receipt. Acoustic installation carries the full retained
//! current Scene source assets; it does not create a fake first Act.
#[cfg(any(target_os = "linux", target_os = "macos"))]
use super::cursor;
use super::Manager;
use crate::expression_procedural_scene_reader::NativeSceneSourceReader;
use crate::native_expression::procedural::bootstrap::{Intent, IssuedSceneRead};
use serde_json::{json, Value};

#[cfg(any(target_os = "linux", target_os = "macos"))]
#[path = "native_expression_scene_contact.rs"]
pub(crate) mod contact;

/// Refusal from the actual private Scene operation. Imported bytes cannot
/// construct it. A full reply is retained whenever the native channel has
/// already returned one, including failed post-reply qualification.
pub(crate) struct NativeSceneOperationRefusal {
    reason: String,
    native_reply: Option<Value>,
    delivery_attempted: bool,
    #[cfg(any(target_os = "linux", target_os = "macos"))]
    diagnostics: super::act_diagnostics::NativeDiagnosticReceipts,
}
impl NativeSceneOperationRefusal {
    pub(crate) fn reason(&self) -> &str {
        &self.reason
    }
    pub(crate) fn native_reply(&self) -> Option<&Value> {
        self.native_reply.as_ref()
    }
    #[cfg(any(target_os = "linux", target_os = "macos"))]
    pub(super) fn into_recording_custody(
        self,
    ) -> (
        String,
        Option<Value>,
        super::act_diagnostics::NativeDiagnosticReceipts,
        bool,
    ) {
        (
            self.reason,
            self.native_reply,
            self.diagnostics,
            self.delivery_attempted,
        )
    }
    fn retained_channel_result(self) -> Result<Value, String> {
        match self.native_reply {
            Some(original) => Ok(json!({"schema":"oi.native-scene-source-channel-refusal/v1",
                "accepted":false,"reason":self.reason,"native_reply":original,
                "delivery_attempted":self.delivery_attempted})),
            None => Err(self.reason),
        }
    }
    // Used only after this private native route has returned an actual reply.
    // Shared physical/acoustic children use the same constructor on their
    // post-reply qualification failure; caller JSON cannot reach it.
    fn after_reply(reason: String, native_reply: Value) -> Self {
        Self {
            reason,
            native_reply: Some(native_reply),
            delivery_attempted: true,
            #[cfg(any(target_os = "linux", target_os = "macos"))]
            diagnostics: super::act_diagnostics::NativeDiagnosticReceipts::empty(),
        }
    }
    fn before(reason: String) -> Self {
        Self {
            reason,
            native_reply: None,
            delivery_attempted: false,
            #[cfg(any(target_os = "linux", target_os = "macos"))]
            diagnostics: super::act_diagnostics::NativeDiagnosticReceipts::empty(),
        }
    }
}

/// Held only by the original private Scene bootstrap call. No wire or
/// Clone constructor can turn an imported constructor fact into this pair.
#[cfg(any(target_os = "linux", target_os = "macos"))]
struct NativeIssuedSceneSource {
    read: Value,
    constructor: Option<Value>,
}

impl Manager {
    /// Explicit declared Return seed through the same qualified current source
    /// operation; the caller cannot supply a source artifact or clock.
    #[cfg(any(target_os = "linux", target_os = "macos"))]
    pub(crate) fn read_native_scene_performance(
        &mut self,
        lease: &str,
        reader: &NativeSceneSourceReader<'_>,
        declared_seed: u64,
    ) -> Result<Value, NativeSceneOperationRefusal> {
        self.closed_native_scene_operation(
            lease,
            reader,
            "performance-source",
            None,
            None,
            Some(declared_seed),
        )
    }
    /// Actual privately borrowed current Document/Scene; the existing QL
    /// field-source operation replays the complete original/current source.
    /// This wrapper does not compose, invent a first Act or install source.
    pub(crate) fn native_field_source_scene_read(
        &mut self,
        lease: &str,
        reader: &NativeSceneSourceReader<'_>,
    ) -> Result<Value, NativeSceneOperationRefusal> {
        self.closed_native_scene_operation(lease, reader, "field-source", None, None, None)
    }

    /// SAME held source Document/Scene, actual coordinate owner and complete
    /// original HostRequest. Native conduct itself admits its ordinal once.
    pub(crate) fn procedural_bootstrap_scene_read(
        &mut self,
        lease: &str,
        reader: &NativeSceneSourceReader<'_>,
        issued: &IssuedSceneRead,
        intent: &Intent,
        request: Value,
    ) -> Result<(Value, Value), NativeSceneOperationRefusal> {
        let source_read = issued
            .closed_source_read(reader, intent)
            .map_err(NativeSceneOperationRefusal::before)?;
        // The actual registered Application constructor is a separate
        // private operand. The original two-key Scene source read is untouched.
        let constructor = issued
            .closed_scene_constructor_fact(reader, intent)
            .map_err(NativeSceneOperationRefusal::before)?;
        #[cfg(any(target_os = "linux", target_os = "macos"))]
        let reply = self
            .closed_native_scene_operation_custodied_with_consumer(
                lease,
                reader,
                "source-bootstrap",
                Some(NativeIssuedSceneSource {
                    read: source_read,
                    constructor: Some(constructor.clone()),
                }),
                Some(request),
                None,
            )?
            .into_custody()
            .0;
        #[cfg(not(any(target_os = "linux", target_os = "macos")))]
        let reply = {
            let _ = constructor;
            self.closed_native_scene_operation(
                lease,
                reader,
                "source-bootstrap",
                Some(source_read),
                Some(request),
                None,
            )?
        };
        #[cfg(any(target_os = "linux", target_os = "macos"))]
        if issued
            .closed_scene_constructor_fact(reader, intent)
            .map_err(|reason| NativeSceneOperationRefusal::after_reply(reason, reply.clone()))?
            != constructor
        {
            return Err(NativeSceneOperationRefusal::after_reply(
                "actual registered Scene constructor changed after native bootstrap".into(),
                reply,
            ));
        }
        let receipt = reply["result"]["native_receipt"].clone();
        if !receipt.is_object() {
            return Err(NativeSceneOperationRefusal::after_reply(
                "source bootstrap consumed no complete original native receipt".into(),
                reply,
            ));
        }
        Ok((receipt, reply))
    }
    /// Lifecycle/cancel runs under the SAME freshly issued current Scene and
    /// original accepted bootstrap authorship. It never replays bootstrap.
    pub(crate) fn procedural_lifecycle_scene_read(
        &mut self,
        lease: &str,
        reader: &NativeSceneSourceReader<'_>,
        issued: &IssuedSceneRead,
        original_bootstrap_intent: &Intent,
        request: Value,
    ) -> Result<(Value, Value), NativeSceneOperationRefusal> {
        let source_read = issued
            .closed_source_read(reader, original_bootstrap_intent)
            .map_err(NativeSceneOperationRefusal::before)?;
        let reply = self.closed_native_scene_operation(
            lease,
            reader,
            "source-lifecycle",
            Some(source_read),
            Some(request),
            None,
        )?;
        let receipt = reply["result"]["native_receipt"].clone();
        if !receipt.is_object() {
            return Err(NativeSceneOperationRefusal::after_reply(
                "source lifecycle consumed no complete original native receipt".into(),
                reply,
            ));
        }
        Ok((receipt, reply))
    }
    /// Initial definition/continuation reuses the exact retained no-write
    /// native issuer and current reader on the SAME original C channel.
    pub(crate) fn procedural_definition_scene_read(
        &mut self,
        lease: &str,
        reader: &NativeSceneSourceReader<'_>,
        issued: &IssuedSceneRead,
        original_bootstrap_intent: &Intent,
        request: Value,
    ) -> Result<(Value, Value), NativeSceneOperationRefusal> {
        let source_read = issued
            .closed_source_read(reader, original_bootstrap_intent)
            .map_err(NativeSceneOperationRefusal::before)?;
        let reply = self.closed_native_scene_operation(
            lease,
            reader,
            "source-definition",
            Some(source_read),
            Some(request),
            None,
        )?;
        let receipt = reply["result"]["native_receipt"].clone();
        if !receipt.is_object() {
            return Err(NativeSceneOperationRefusal::after_reply(
                "source definition consumed no complete original native receipt".into(),
                reply,
            ));
        }
        Ok((receipt, reply))
    }
    /// Source-authored local control uses this SAME privately held current
    /// Scene and actual original selected source issuer. No public Exchange.
    pub(crate) fn procedural_authored_scene_read(
        &mut self,
        lease: &str,
        reader: &NativeSceneSourceReader<'_>,
        issued: &IssuedSceneRead,
        intent: &Intent,
        request: Value,
    ) -> Result<(Value, Value), NativeSceneOperationRefusal> {
        if request["command"]["request"]["action"] != "authored_driver" {
            return Err(NativeSceneOperationRefusal::before(
                "Local authored factory has another action".into(),
            ));
        }
        let source_read = issued
            .closed_source_read(reader, intent)
            .map_err(NativeSceneOperationRefusal::before)?;
        let reply = self.closed_native_scene_operation(
            lease,
            reader,
            "source-authored",
            Some(source_read),
            Some(request),
            None,
        )?;
        let receipt = reply["result"]["native_receipt"].clone();
        if !receipt.is_object() {
            return Err(NativeSceneOperationRefusal::after_reply(
                "Authored Source consumed no complete original native receipt".into(),
                reply,
            ));
        }
        Ok((receipt, reply))
    }

    /// Every opaque selected issuer belongs to the SAME original complete
    /// Application Document. The anchor is not a substitute for other Scenes.
    pub(crate) fn procedural_authored_shared_scene_read(
        &mut self,
        lease: &str,
        reader: &crate::expression_procedural_scene_reader::NativeDocumentSceneReader,
        issued: &[(String, IssuedSceneRead)],
        intents: &[(String, Intent)],
        request: Value,
    ) -> Result<(Value, Value), NativeSceneOperationRefusal> {
        let before = reader.document();
        if request["command"]["request"]["action"] != "authored_shared"
            || issued.len() != before.scenes.len()
            || intents.len() != before.scenes.len()
            || before.scenes.is_empty()
        {
            return Err(NativeSceneOperationRefusal::before(
                "Shared Source omitted actual full Scene cohort/action".into(),
            ));
        }
        // Account complete two-key source reads before constructing their
        // transport Values. The caller also reserved full outward custody.
        let mut budget = crate::expression::procedural::budget::Budget::new();
        budget
            .value(before)
            .map_err(NativeSceneOperationRefusal::before)?;
        budget
            .value(&request)
            .map_err(NativeSceneOperationRefusal::before)?;
        for ((scene, (issued_ref, actual)), (intent_ref, intent)) in
            before.scenes.iter().zip(issued).zip(intents)
        {
            if issued_ref != &scene.scene_ref || intent_ref != &scene.scene_ref {
                return Err(NativeSceneOperationRefusal::before(
                    "Shared Source reordered its actual Scene/issuer/intent".into(),
                ));
            }
            actual
                .charge_closed_source_read(&mut budget)
                .map_err(NativeSceneOperationRefusal::before)?;
            budget
                .value(intent)
                .map_err(NativeSceneOperationRefusal::before)?;
        }
        budget
            .reserve(16 * 1024)
            .map_err(NativeSceneOperationRefusal::before)?;
        let mut rows = Vec::with_capacity(issued.len());
        for ((scene_ref, actual), (_, intent)) in issued.iter().zip(intents) {
            let view = reader
                .select_scene(scene_ref)
                .map_err(NativeSceneOperationRefusal::before)?;
            let source_reader = NativeSceneSourceReader::CurrentDocumentScene(&view);
            let source_read = actual
                .closed_source_read(&source_reader, intent)
                .map_err(NativeSceneOperationRefusal::before)?;
            let mut row = serde_json::Map::new();
            row.insert("scene_ref".into(), Value::String(scene_ref.clone()));
            row.insert("source_read".into(), source_read);
            rows.push(Value::Object(row));
        }
        let mut cohort = serde_json::Map::new();
        cohort.insert(
            "schema".into(),
            Value::String("oi.native-authored-scene-cohort/v1".into()),
        );
        cohort.insert("scenes".into(), Value::Array(rows));
        let cohort = Value::Object(cohort);
        let source_reader = NativeSceneSourceReader::CurrentDocument(reader);
        let reply = self.closed_native_scene_operation(
            lease,
            &source_reader,
            "source-authored",
            Some(cohort),
            Some(request),
            None,
        )?;
        let receipt = reply["result"]["native_receipt"].clone();
        if !receipt.is_object() {
            return Err(NativeSceneOperationRefusal::after_reply(
                "Shared Source consumed no complete original native receipt".into(),
                reply,
            ));
        }
        Ok((receipt, reply))
    }

    fn closed_native_scene_operation(
        &mut self,
        lease: &str,
        reader: &NativeSceneSourceReader<'_>,
        mode: &str,
        source_read: Option<Value>,
        procedural_request: Option<Value>,
        declared_seed: Option<u64>,
    ) -> Result<Value, NativeSceneOperationRefusal> {
        #[cfg(not(any(target_os = "linux", target_os = "macos")))]
        {
            let _ = (
                lease,
                reader,
                mode,
                source_read,
                procedural_request,
                declared_seed,
            );
            Err(NativeSceneOperationRefusal::before("native closed Scene source requires the Linux/Mac OS/image-qualified channel; no ordinary Exchange fallback".into()))
        }
        #[cfg(any(target_os = "linux", target_os = "macos"))]
        {
            self.closed_native_scene_operation_custodied(
                lease,
                reader,
                mode,
                source_read,
                procedural_request,
                declared_seed,
            )
            .map(|reply| reply.into_custody().0)
        }
    }
    #[cfg(any(target_os = "linux", target_os = "macos"))]
    fn closed_native_scene_operation_custodied(
        &mut self,
        lease: &str,
        reader: &NativeSceneSourceReader<'_>,
        mode: &str,
        source_read: Option<Value>,
        procedural_request: Option<Value>,
        declared_seed: Option<u64>,
    ) -> Result<super::act_channel::NativeActChannelReply, NativeSceneOperationRefusal> {
        self.closed_native_scene_operation_custodied_with_consumer(
            lease,
            reader,
            mode,
            source_read.map(|read| NativeIssuedSceneSource {
                read,
                constructor: None,
            }),
            procedural_request,
            declared_seed,
        )
    }
    #[cfg(any(target_os = "linux", target_os = "macos"))]
    fn closed_native_scene_operation_custodied_with_consumer(
        &mut self,
        lease: &str,
        reader: &NativeSceneSourceReader<'_>,
        mode: &str,
        issued_source: Option<NativeIssuedSceneSource>,
        procedural_request: Option<Value>,
        declared_seed: Option<u64>,
    ) -> Result<super::act_channel::NativeActChannelReply, NativeSceneOperationRefusal> {
        let (source_read, scene_consumer) = match issued_source {
            Some(issued) => (Some(issued.read), issued.constructor),
            None => (None, None),
        };
        if self.recording_failure.is_some()
            || self.contact_custody.is_some()
            || self.recording_cut.is_some()
        {
            return Err(NativeSceneOperationRefusal::before(
                    "original native recording failure remains held; closed source operation cannot bypass its custody".into()));
        }
        let mut native_reply = None;
        let mut received_channel = None;
        let mut delivery_started = false;
        let mut diagnostics = super::act_diagnostics::NativeDiagnosticReceipts::empty();
        let outcome = (|| -> Result<super::act_channel::NativeActChannelReply, String> {
            let owner = self
                .active
                .as_mut()
                .ok_or("native Scene source has no current Manager owner")?;
            if owner.lease != lease || owner.stopped || owner.process_exited()? {
                return Err("native Scene source has another/closed Manager lease".into());
            }
            let channel = owner.act_channel.as_ref().ok_or_else(|| {
                owner.act_channel_unavailable.clone().unwrap_or_else(|| {
                    "native Scene source has no qualified OS/image channel".into()
                })
            })?;
            if (mode == "source-bootstrap") != scene_consumer.is_some() {
                return Err(
                    "original bootstrap requires its actual registered Scene constructor only"
                        .into(),
                );
            }
            if (mode == "performance-source" || contact::is_contact_mode(mode))
                != declared_seed.is_some()
            {
                return Err("explicit authored seed changed the native source operation".into());
            }
            let manifest = reader.native_manifest()?;
            let id = owner
                .last_request_id
                .checked_add(1)
                .ok_or("native Scene source ordinal exhausted")?;
            if mode == "recording-render" {
                contact::validate_private_render_query(
                    reader,
                    procedural_request
                        .as_ref()
                        .ok_or("actual native render query absent")?,
                )?;
                if source_read.is_some() {
                    return Err("native render carries another source issuer".into());
                }
            } else if contact::is_contact_mode(mode) {
                contact::validate_private_query(
                    reader,
                    mode,
                    procedural_request
                        .as_ref()
                        .ok_or("private Contact query absent")?,
                )?;
                if source_read.is_some() {
                    return Err("Contact carries another source issuer".into());
                }
            } else if let Some(request) = &procedural_request {
                let read = source_read
                    .as_ref()
                    .ok_or("private native Scene issuer absent")?;
                if request["schema"] != "ql.field-host-request/v1"
                    || request["instance_ref"] != owner.identity["instance_ref"]
                    || request["event_ref"] != owner.identity["event_ref"]
                    || request["subject_ref"] != owner.identity["subject_ref"]
                    || cursor(&request["request_id"])? != id
                    || request["command"]["operation"] != "procedure"
                    || (!(mode == "source-authored"
                        && request["command"]["request"]["action"] == "authored_shared")
                        && read["issuer_receipt"]["native_identity"] != owner.identity)
                {
                    return Err(
                        "native Scene source changed original scoped request/source owner".into(),
                    );
                }
                let input = &request["command"]["request"]["input"];
                let action = request["command"]["request"]["action"].as_str();
                if mode == "source-authored" && action == Some("authored_shared") {
                    validate_authored_cohort(reader, read, request, &owner.identity)?;
                } else {
                    let (actual_read, contributors) = match (mode, action) {
                        ("source-bootstrap", Some("source_bootstrap")) => {
                            if input["authorship"]
                                != read["issuer_receipt"]["original_intent"]["authorship"]
                            {
                                return Err(
                                    "source bootstrap changed complete original authorship".into(),
                                );
                            }
                            (&input["scene"], &input["authorship"]["contributors"])
                        }
                        ("source-lifecycle", Some("lifecycle")) => {
                            let scenes = input["reading"]["materialization"]["scenes"]
                                .as_array()
                                .ok_or(
                                "lifecycle has no actual whole native materialization",
                            )?;
                            let mut selected = scenes
                                .iter()
                                .filter(|scene| scene["scene_ref"] == input["scene_ref"]);
                            let scene = selected
                                .next()
                                .ok_or("lifecycle selected native Scene absent")?;
                            if selected.next().is_some() {
                                return Err("lifecycle selected native Scene duplicated".into());
                            }
                            (&input["reading"]["scene_read"], &scene["contributors"])
                        }
                        ("source-authored", Some("authored_driver")) => {
                            (&input["scene_read"], &input["contributors"])
                        }
                        ("source-lifecycle", Some("lifecycle_cancel")) => {
                            (&input["scene_read"], &input["contributors"])
                        }
                        ("source-definition", Some("install_prepared" | "source_continue")) => {
                            let bootstrap = &input["source_bootstrap"];
                            if bootstrap["authorship"]
                                != read["issuer_receipt"]["original_intent"]["authorship"]
                            {
                                return Err(
                                    "definition changed full accepted source authorship".into()
                                );
                            }
                            (
                                &bootstrap["scene"],
                                &bootstrap["authorship"]["contributors"],
                            )
                        }
                        _ => {
                            return Err(
                                "private source operation has another procedural action".into()
                            );
                        }
                    };
                    if actual_read != &read["reading"]
                        || contributors
                            != &read["issuer_receipt"]["original_intent"]["authorship"]
                                ["contributors"]
                        || (mode == "source-lifecycle"
                            && (input["expression_ref"] != read["reading"]["expression_ref"]
                                || input["scene_ref"] != read["reading"]["scene_ref"]
                                || input["document_revision"]
                                    != read["reading"]["document_revision"]))
                    {
                        return Err(
                            "private procedural action changed full original Scene/contributors"
                                .into(),
                        );
                    }
                }
            } else if matches!(
                mode,
                "source-bootstrap" | "source-lifecycle" | "source-definition" | "source-authored"
            ) {
                return Err("private procedural action has no original scoped request".into());
            }
            let registration = json!({"schema":"oi.native-field-timing-registration/v1",
                "owner_ref":owner.lease,"instance_ref":owner.identity["instance_ref"],
                "epoch_ref":owner.native_field_epoch,"domain":"native_field_samples","time_mapping_ref":null});
            let mut request = json!({"schema":"ql.native-act-owner-request/v1",
                "instance_ref":owner.identity["instance_ref"],"event_ref":owner.identity["event_ref"],
                "subject_ref":owner.identity["subject_ref"],"request_id":id.to_string(),"manager_lease":lease,
                "mode":mode,"manifest":manifest,"field_registration":registration});
            if let Some(fact) = scene_consumer {
                request["scene_consumer"] = fact;
            }
            if let Some(seed) = declared_seed {
                request["declared_seed"] = json!(seed.to_string());
            }
            if let Some(read) = source_read {
                request["source_bootstrap"] = read;
            }
            if let Some(original) = procedural_request {
                request["procedural_request"] = original;
            }
            let reply_limit = if matches!(mode, "source-definition" | "source-authored") {
                owner
                    .definition_reply_limit
                    .ok_or("Private definition response capacity was not reserved")?
            } else {
                super::MAX_REPLY
            };
            let mut query = 0_u64;
            let exchanged=channel.exchange_stream_custodied_bounded(&request,reply_limit,|value| {
                if value["schema"]!="ql.native-act-owner-query/v1" {return Ok(None);}
                query=query.checked_add(1).ok_or("native Scene part ordinal exhausted")?;
                if !matches!(mode,"source-bootstrap"|"source-lifecycle"|"source-definition"|"source-authored"|"field-descriptor"|"performance-source"|"acoustic-install"|"contact-prepare"|"contact-apply"|"contact-trigger"|"recording-render") || query>128
                    || value["instance_ref"]!=owner.identity["instance_ref"]
                    || cursor(&value["request_id"])?!=id || cursor(&value["query_ordinal"])?!=query
                    || value["kind"]!="field-part" {
                    return Err("native Scene source callback changed closed current source custody".into());
                }
                let index=usize::try_from(value["index"].as_u64().ok_or("native Scene source part index absent")?).map_err(|e|e.to_string())?;
                if index!=query as usize-1 {return Err("native Scene source parts missing/reordered".into());}
                let part=reader.field_source_part(index);
                Ok(Some(json!({"schema":"oi.native-act-owner-answer/v1","instance_ref":owner.identity["instance_ref"],
                    "request_id":id.to_string(),"query_ordinal":query.to_string(),"kind":"field-part","index":index,
                    "available":part.is_ok(),"value":part.as_ref().ok(),"error":part.as_ref().err()})))
            });
            let reply = match exchanged {
                Ok(reply) => {
                    delivery_started = true;
                    reply
                }
                Err(refusal) => {
                    let (reason, original, retained, attempted) = refusal.into_custody();
                    delivery_started = attempted;
                    native_reply = original;
                    diagnostics = retained;
                    return Err(reason);
                }
            };
            received_channel = Some(reply);
            let reply = received_channel
                .as_ref()
                .ok_or("actual Scene reply custody lost")?;
            let qualification = reply.qualification().clone();
            let value = reply.value();
            native_reply = Some(value.clone());
            if value["schema"] != "ql.native-act-owner-result/v1"
                || value["instance_ref"] != owner.identity["instance_ref"]
                || cursor(&value["request_id"])? != id
                || cursor(&value["last_request_id"])? != id
                || value["available"] != true
            {
                return Err(
                    "native Scene source lost original owner/ordinal acknowledgement".into(),
                );
            }
            owner.last_request_id = id;
            if value["status"] == "ok" {
                let evidence = &value["result"]["selection"];
                if evidence["native_parent_qualification"] != qualification
                    || evidence["field_registration"] != registration
                    || evidence["source_kind"] != "field"
                {
                    return Err("native Scene source lost actual channel/registration".into());
                }
                for key in [
                    "expanded_document_sha256",
                    "expression_ref",
                    "expression_revision",
                    "scene_ref",
                    "scene_revision",
                    "selected_scene_sha256",
                ] {
                    if evidence[key] != manifest[key] {
                        return Err(
                            "native Scene source returned another complete selection".into()
                        );
                    }
                }
                if manifest["schema"] == "oi.expression-native-current-scene-delivery/v1" {
                    if evidence["source_custody"] != "current-document"
                        || ["act_ref", "act_revision", "act_digest", "edition_position"]
                            .iter()
                            .any(|key| evidence.get(*key).is_some())
                    {
                        return Err(
                            "actual current Document source acquired a fabricated Act tuple".into(),
                        );
                    }
                } else {
                    for key in ["act_ref", "act_revision", "act_digest", "edition_position"] {
                        if evidence[key] != manifest[key] {
                            return Err("actual recorded Act source selection changed".into());
                        }
                    }
                }
            }
            if mode == "performance-source" && value["status"] == "ok" {
                let source = &value["result"]["source_artifact"];
                let expected_seed = declared_seed.ok_or("native seed lost")?.to_string();
                if source["schema"] != "ql.retained-source-performance-fixture/v1"
                    || source["basis"]["seed"].as_str() != Some(expected_seed.as_str())
                    || source["basis"]["identity"]["instance_ref"] != owner.identity["instance_ref"]
                    || source["source_assets"]["native_basis"] != source["native_basis"]
                    || !source["native_reading"].is_object()
                    || !source["pitches"].is_array()
                    || !source["native_preparation"].is_object()
                {
                    return Err(
                        "native source retention disconnected same owner/seed/full source artifact"
                            .into(),
                    );
                }
            }
            received_channel
                .take()
                .ok_or_else(|| "actual Scene reply custody lost".into())
        })();
        if outcome.is_err()
            && delivery_started
            && self
                .active
                .as_ref()
                .is_some_and(|owner| owner.lease == lease)
        {
            // Only this operation's admitted owner may have uncertain effects.
            // A preflight/wrong-lease refusal must preserve the current owner.
            self.active.take();
        }
        if outcome.is_err() {
            if let Some(original) = received_channel.take() {
                let (value, retained) = original.into_custody();
                native_reply = Some(value);
                diagnostics = retained;
            }
        }
        outcome.map_err(|reason| NativeSceneOperationRefusal {
            reason,
            native_reply,
            delivery_attempted: delivery_started,
            diagnostics,
        })
    }
}

/// Transport checks compare only original privately produced values. Native
/// QL independently qualifies EVERY issuer against the full current source.
fn validate_authored_cohort(
    reader: &NativeSceneSourceReader<'_>,
    cohort: &Value,
    request: &Value,
    identity: &Value,
) -> Result<(), String> {
    let before = reader.document();
    let sources = cohort["scenes"]
        .as_array()
        .ok_or("Actual authored source cohort absent")?;
    let input = &request["command"]["request"]["input"];
    let reads = input["scene_reads"]
        .as_array()
        .ok_or("Actual authored shared typed reads absent")?;
    let scenes = input["input"]["reading"]["scenes"]
        .as_array()
        .ok_or("Actual authored shared whole material reading absent")?;
    let order = input["input"]["reading"]["scene_order"]
        .as_array()
        .ok_or("Actual authored shared Scene order absent")?;
    if cohort["schema"] != "oi.native-authored-scene-cohort/v1"
        || sources.len() != before.scenes.len()
        || reads.len() != before.scenes.len()
        || scenes.len() != before.scenes.len()
        || order.len() != before.scenes.len()
        || input["input"]["source_scene_ref"] != reader.scene().scene_ref
        || input["input"]["reading"]["expression_ref"] != before.expression_ref
        || input["input"]["reading"]["document_revision"].as_u64() != Some(before.revision)
    {
        return Err(
            "Authored shared request differs from actual full Document/anchor/cohort".into(),
        );
    }
    for ((((scene, source), read), material), ordered) in before
        .scenes
        .iter()
        .zip(sources)
        .zip(reads)
        .zip(scenes)
        .zip(order)
    {
        let issued = &source["source_read"];
        if source["scene_ref"] != scene.scene_ref
            || ordered != &json!(scene.scene_ref)
            || issued["issuer_receipt"]["native_identity"] != *identity
            || issued["reading"]["expression_ref"] != before.expression_ref
            || issued["reading"]["document_revision"].as_u64() != Some(before.revision)
            || issued["reading"]["scene_ref"] != scene.scene_ref
            || read["scene_read"] != issued["reading"]
            || read["contributors"]
                != issued["issuer_receipt"]["original_intent"]["authorship"]["contributors"]
            || material["source"]["scene_ref"] != scene.scene_ref
            || material["source"]["contributors"] != read["contributors"]
        {
            return Err("Authored shared request changed/reordered an actual original Scene/source/contributor".into());
        }
    }
    Ok(())
}

#[cfg(all(test, any(target_os = "linux", target_os = "macos")))]
mod tests {
    use super::*;
    use crate::{Kernel, KernelOp, KernelOpResult};

    fn apply(kernel: &mut Kernel, request: Value) -> Value {
        match kernel
            .apply(KernelOp::Expression {
                request: serde_json::from_value(request).unwrap(),
            })
            .unwrap()
            .result
        {
            KernelOpResult::Expression { data } => {
                assert_eq!(data["state"], "ready", "{}", data["reason"]);
                data
            }
            other => panic!("actual Expression result expected: {other:?}"),
        }
    }

    #[test]
    fn actual_current_scene_wrong_lease_and_preflight_refusal_preserve_owned_process() {
        let mut kernel = Kernel::discover();
        let created = apply(
            &mut kernel,
            json!({"operation":"create",
            "expression_ref":"expression:lease-refusal","title":"Actual source",
            "actor":"human:lease-refusal-test"}),
        );
        let scene_ref = created["document"]["scenes"][0]["scene_ref"].clone();
        let edited = apply(
            &mut kernel,
            json!({"operation":"edit",
            "expression_ref":created["document"]["expression_ref"],
            "expected_revision":created["document"]["revision"],
            "actor":"human:lease-refusal-test","changes":[{"change":"scene_material_set",
            "scene_ref":scene_ref,"presentation":{"schema":"oi.journey-scene/v1","scene":{
                "id":scene_ref,"name":created["document"]["scenes"][0]["title"],"character":"Lease refusal",
                "duration":42,"transition":3,"view":{"mode":"3d","yaw":0.0,"pitch":0.0,
                    "zoom":1.0,"panX":0.0,"panY":0.0},
                "field":{"background":"#fafafa","palette":["#111111"],"material":"ink","params":{}},
                "composition":{},"morph":{},"engine":{},"entities":[],"text":[],"automation":[]}}}]}),
        );
        let owner = super::super::tests::owned_process_for_test("exec sleep 60");
        let pid = owner.child.id();
        let lease = owner.lease.clone();
        kernel.native_expression.active = Some(owner);
        let doc = &edited["document"];
        let actual_scene = doc["scenes"]
            .as_array()
            .unwrap()
            .iter()
            .find(|scene| scene["scene_ref"] == scene_ref)
            .unwrap();
        for supplied in ["foreign-lease", lease.as_str()] {
            let outcome = kernel
                .with_native_document_scene(
                    doc["expression_ref"].as_str().unwrap(),
                    doc["revision"].as_u64().unwrap(),
                    scene_ref.as_str().unwrap(),
                    actual_scene["revision"].as_u64().unwrap(),
                    |manager, reader| {
                        let reader = NativeSceneSourceReader::CurrentDocument(reader);
                        let result = manager.native_field_source_scene_read(supplied, &reader);
                        let error = match result {
                            Ok(_) => panic!("unqualified process gained a native source"),
                            Err(error) => error,
                        };
                        assert!(error.native_reply().is_none());
                        assert!(
                            error.reason().contains(if supplied == "foreign-lease" {
                                "another/closed Manager lease"
                            } else {
                                "no qualified OS/image channel"
                            }),
                            "{}",
                            error.reason()
                        );
                        Ok(())
                    },
                )
                .unwrap();
            outcome.result.unwrap();
            outcome.currentness.unwrap();
            let retained = kernel
                .native_expression
                .active
                .as_ref()
                .expect("preflight retired current owner");
            assert_eq!(retained.child.id(), pid);
            assert_eq!(retained.lease, lease);
            assert_eq!(retained.last_request_id, 0);
            assert!(!retained.process_exited().unwrap());
        }
        let current = apply(
            &mut kernel,
            json!({"operation":"inspect","expression_ref":doc["expression_ref"]}),
        );
        assert_eq!(current["document"], *doc);
    }
}
