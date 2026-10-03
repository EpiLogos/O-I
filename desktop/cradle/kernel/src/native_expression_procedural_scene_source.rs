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

/// Refusal from the actual private Scene operation. Imported bytes cannot
/// construct it. A full reply is retained whenever the native channel has
/// already returned one, including failed post-reply qualification.
pub(crate) struct NativeSceneOperationRefusal {
    reason: String,
    native_reply: Option<Value>,
}
impl NativeSceneOperationRefusal {
    pub(crate) fn reason(&self) -> &str {
        &self.reason
    }
    pub(crate) fn native_reply(&self) -> Option<&Value> {
        self.native_reply.as_ref()
    }
    fn retained_channel_result(self) -> Result<Value, String> {
        match self.native_reply {
            Some(original) => Ok(json!({"schema":"oi.native-scene-source-channel-refusal/v1",
                "accepted":false,"reason":self.reason,"native_reply":original})),
            None => Err(self.reason),
        }
    }
    fn before(reason: String) -> Self {
        Self {
            reason,
            native_reply: None,
        }
    }
}

impl Manager {
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
        let reply = self.closed_native_scene_operation(
            lease,
            reader,
            "source-bootstrap",
            Some(source_read),
            Some(request),
            None,
        )?;
        let receipt = reply["result"]["native_receipt"].clone();
        if !receipt.is_object() {
            return Err(NativeSceneOperationRefusal {
                reason: "source bootstrap consumed no complete original native receipt".into(),
                native_reply: Some(reply),
            });
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
            return Err(NativeSceneOperationRefusal {
                reason: "source lifecycle consumed no complete original native receipt".into(),
                native_reply: Some(reply),
            });
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
            Err(NativeSceneOperationRefusal::before(
                "native closed Scene source requires the Linux/Mac OS/image-qualified channel; no ordinary Exchange fallback".into()))
        }
        #[cfg(any(target_os = "linux", target_os = "macos"))]
        {
            let mut native_reply = None;
            let mut delivery_started = false;
            let outcome = (|| -> Result<Value, String> {
                let owner = self
                    .active
                    .as_mut()
                    .ok_or("native Scene source has no current Manager owner")?;
                if owner.lease != lease || owner.stopped || owner.process_exited()? {
                    return Err("native Scene source has another/closed Manager lease".into());
                }
                let channel = owner
                    .act_channel
                    .as_ref()
                    .ok_or("native Scene source has no qualified OS/image channel")?;
                if (mode == "performance-source") != declared_seed.is_some() {
                    return Err("explicit authored seed changed the native source operation".into());
                }
                let manifest = reader.native_manifest()?;
                let id = owner
                    .last_request_id
                    .checked_add(1)
                    .ok_or("native Scene source ordinal exhausted")?;
                if let Some(request) = &procedural_request {
                    let read = source_read
                        .as_ref()
                        .ok_or("private native Scene issuer absent")?;
                    if request["schema"] != "ql.field-host-request/v1"
                        || request["instance_ref"] != owner.identity["instance_ref"]
                        || request["event_ref"] != owner.identity["event_ref"]
                        || request["subject_ref"] != owner.identity["subject_ref"]
                        || cursor(&request["request_id"])? != id
                        || request["command"]["operation"] != "procedure"
                        || read["issuer_receipt"]["native_identity"] != owner.identity
                    {
                        return Err(
                            "native Scene source changed original scoped request/source owner"
                                .into(),
                        );
                    }
                    let input = &request["command"]["request"]["input"];
                    let action = request["command"]["request"]["action"].as_str();
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
                        ("source-lifecycle", Some("lifecycle_cancel")) => {
                            (&input["scene_read"], &input["contributors"])
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
                } else if matches!(mode, "source-bootstrap" | "source-lifecycle") {
                    return Err("private procedural action has no original scoped request".into());
                }
                let registration = json!({"schema":"oi.native-field-timing-registration/v1",
                "owner_ref":owner.lease,"instance_ref":owner.identity["instance_ref"],
                "epoch_ref":owner.native_field_epoch,"domain":"native_field_samples","time_mapping_ref":null});
                let mut request = json!({"schema":"ql.native-act-owner-request/v1",
                "instance_ref":owner.identity["instance_ref"],"event_ref":owner.identity["event_ref"],
                "subject_ref":owner.identity["subject_ref"],"request_id":id.to_string(),"manager_lease":lease,
                "mode":mode,"manifest":manifest,"field_registration":registration});
                if let Some(seed) = declared_seed {
                    request["declared_seed"] = json!(seed.to_string());
                }
                if let Some(read) = source_read {
                    request["source_bootstrap"] = read;
                }
                if let Some(original) = procedural_request {
                    request["procedural_request"] = original;
                }
                let mut query = 0_u64;
                delivery_started = true;
                let reply=channel.exchange_stream(&request,|value| {
                if value["schema"]!="ql.native-act-owner-query/v1" {return Ok(None);}
                query=query.checked_add(1).ok_or("native Scene part ordinal exhausted")?;
                if !matches!(mode,"source-bootstrap"|"source-lifecycle"|"field-descriptor"|"performance-source"|"acoustic-install") || query>128
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
            })?;
                native_reply = Some(reply.value().clone());
                let value = reply.value();
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
                    if evidence["native_parent_qualification"] != *reply.qualification()
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
                                "actual current Document source acquired a fabricated Act tuple"
                                    .into(),
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
                        || source["basis"]["identity"]["instance_ref"]
                            != owner.identity["instance_ref"]
                        || source["source_assets"]["native_basis"] != source["native_basis"]
                        || !source["native_reading"].is_object()
                        || !source["pitches"].is_array()
                        || !source["native_preparation"].is_object()
                    {
                        return Err("native source retention disconnected same owner/seed/full source artifact".into());
                    }
                }
                Ok(value.clone())
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
            outcome.map_err(|reason| NativeSceneOperationRefusal {
                reason,
                native_reply,
            })
        }
    }
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
