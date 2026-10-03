//! Save the actual opened World's source through its existing native channel.
//! This is a source observation and ordinary Document edit, not a Source grant,
//! procedural application, replacement clock or physical/music acknowledgement.
use super::{same_json, RetainedWorld};
use crate::expression::{procedural::scene_receiver::SceneOwner, Change, Document};
use crate::expression_procedural_field_source::NativeFieldSource;
use crate::expression_procedural_scene_reader::NativeSceneSourceReader;
use crate::expression_procedural_source_budget::{digest, measure};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct Request {
    pub selection: super::Request,
    pub lease: String,
    pub actor: String,
    pub expected_request_id: String,
    pub expected_generation: String,
    pub expected_samples_elapsed: String,
}
impl Request {
    fn validate(&self) -> Result<(), String> {
        self.selection.validate()?;
        crate::expression::text(&self.lease)?;
        crate::expression::text(&self.actor)?;
        if super::super::cursor(&json!(self.expected_request_id))? == 0 {
            return Err(
                "Native source observation requires the next actual request ordinal".into(),
            );
        }
        super::super::cursor(&json!(self.expected_generation))?;
        super::super::cursor(&json!(self.expected_samples_elapsed))?;
        Ok(())
    }
}

/// One original outcome on the SAME selected opening. Values here are retained
/// evidence only: they cannot instantiate a native channel, intake or source.
#[derive(Debug)]
pub(super) struct Observation {
    request: Request,
    original: Value,
    document_revision: u64,
    document_sha256: String,
    scene_owner: SceneOwner,
}

fn fingerprint(document: &Document) -> Result<String, String> {
    measure(document, crate::expression::DOCUMENT_BYTES)?;
    Ok(digest(
        &serde_json::to_vec(document).map_err(|e| e.to_string())?,
    ))
}

/// Select only the original receipt issued by FieldHost at this actual Act
/// operation. Never derive a host acknowledgement from the earlier open frame.
fn receipt<'a>(
    native: &'a Value,
    request: &Request,
    identity: &Value,
) -> Result<&'a Value, String> {
    let ack = &native["host_receipt"];
    if native["schema"] != "ql.native-act-owner-result/v1"
        || native["instance_ref"] != identity["instance_ref"]
        || native["request_id"] != request.expected_request_id
        || native["last_request_id"] != request.expected_request_id
        || ack["schema"] != "ql.field-host-receipt/v1"
        || ack["instance_ref"] != identity["instance_ref"]
        || ack["request_id"] != request.expected_request_id
        || ack["last_request_id"] != request.expected_request_id
        || ack["status"] != native["status"]
        || !matches!(ack["status"].as_str(), Some("ok" | "refused"))
        || ack["available"] != true
        || native["available"] != true
        || ack["field"]["event_ref"] != identity["event_ref"]
        || ack["field"]["subject_ref"] != identity["subject_ref"]
        || ack["field"]["generation"] != request.expected_generation
        || ack["field"]["samples_elapsed"] != request.expected_samples_elapsed
        || ack["field"]["audio"] != json!([])
    {
        return Err("Source observation has no same-operation original host receipt at the unchanged native position".into());
    }
    Ok(ack)
}

impl crate::Kernel {
    pub(crate) fn native_selected_scene_source_recover(
        &mut self,
        request: Request,
    ) -> Result<Value, String> {
        request.validate()?;
        let opening = self
            .native_expression
            .selected_scene_opening
            .as_ref()
            .ok_or("No actual selected-Scene opening owns this source observation")?;
        let stored = opening
            .source_observation
            .as_ref()
            .ok_or("No original selected-Scene source observation is retained")?;
        if stored.request != request {
            return Err("Source recovery requires the exact original selection, lease, actor and request position".into());
        }
        let currentness = self
            .expressions
            .procedural_source_snapshot(&request.selection.expression_ref, stored.document_revision)
            .and_then(|current| {
                if fingerprint(&current)? != stored.document_sha256 {
                    return Err(
                        "Complete Document changed after the original source observation".into(),
                    );
                }
                self.expressions
                    .require_procedural_scene_owner(&stored.scene_owner, &current)
            });
        let owner_current = match self.native_expression.active.as_mut() {
            Some(owner) => {
                owner.lease == request.lease
                    && !owner.stopped
                    && !owner.process_exited()?
                    && owner.last_request_id.to_string() == request.expected_request_id
                    && owner.procedural_position["generation"] == request.expected_generation
                    && owner.procedural_position["samples_elapsed"]
                        == request.expected_samples_elapsed
            }
            None => false,
        };
        let mut original = stored.original.clone();
        original["recovered"] = json!(true);
        original["replayed"] = json!(false);
        original["recovery_current"] = json!(owner_current && currentness.is_ok());
        original["recovery_currentness"] = json!(currentness.err());
        Ok(original)
    }

    pub(crate) fn native_selected_scene_source_retain(
        &mut self,
        request: Request,
    ) -> Result<crate::KernelOpOutcome, String> {
        request.validate()?;
        if self
            .native_expression
            .selected_scene_opening
            .as_ref()
            .and_then(|opening| opening.source_observation.as_ref())
            .is_some_and(|stored| stored.request == request)
        {
            return self
                .native_selected_scene_source_recover(request)
                .map(|data| crate::KernelOpOutcome {
                    receipts: Vec::new(),
                    result: crate::KernelOpResult::NativeExpression { data },
                });
        }
        let selected = &request.selection;
        let before = self
            .expressions
            .procedural_source_snapshot(&selected.expression_ref, selected.document_revision)?;
        let opening = self
            .native_expression
            .selected_scene_opening
            .as_ref()
            .ok_or("No actual selected-Scene opening owns this source observation")?;
        if opening.request.expression_ref != selected.expression_ref
            || opening.request.scene_ref != selected.scene_ref
            || opening.opened["lease"] != request.lease
            || opening.closed.is_some()
            || opening.opened["source_current"] != true
        {
            return Err(
                "Source observation belongs to another or unqualified selected-Scene opening"
                    .into(),
            );
        }
        let scene_owner = self
            .expressions
            .procedural_scene_owner(&before, &selected.scene_ref)?;
        if scene_owner.instance_ref() != opening.scene_owner.instance_ref()
            || scene_owner.construction_generation()
                != opening.scene_owner.construction_generation()
            || scene_owner.generation_domain() != opening.scene_owner.generation_domain()
        {
            return Err("Actual selected Scene constructor lifetime differs from the original native opening".into());
        }
        self.expressions
            .require_procedural_scene_owner(&scene_owner, &before)?;
        let before_sha256 = fingerprint(&before)?;
        let original_constructor = opening.opened["source"]["constructor_request"].clone();
        let retained = self.with_native_document_scene(&selected.expression_ref, selected.document_revision,
            &selected.scene_ref, selected.scene_revision, |manager, reader| {
                let world = RetainedWorld::read(reader)?;
                let owner = manager.active.as_mut().ok_or("Actual selected native source owner is unavailable")?;
                if owner.lease != request.lease || owner.stopped
                    || owner.process_exited()?
                    || owner.last_request_id.checked_add(1).map(|id| id.to_string()).as_ref() != Some(&request.expected_request_id)
                    || owner.procedural_position["generation"] != request.expected_generation
                    || owner.procedural_position["samples_elapsed"] != request.expected_samples_elapsed
                    || !same_json(&world.original_request, &original_constructor)
                    || ["instance_ref", "event_ref", "subject_ref"].iter().any(|key| owner.identity[*key] != world.original_request[*key])
                {
                    return Err("Source observation differs from its actual owner, next ordinal, native position or original World constructor".into());
                }
                Ok((world, owner.identity.clone()))
            })?;
        retained.currentness?;
        let (world, identity) = retained.result?;
        let world_scene = world.world_source_scene["scene_ref"]
            .as_str()
            .ok_or("Actual World source Scene reference unavailable")?;
        let world_revision = world.world_source_scene["scene_revision"]
            .as_u64()
            .ok_or("Actual World source Scene revision unavailable")?;
        // The getter's manifest is the actual World-carrier Scene. Subsequent
        // selected-Scene consumers resolve this one asset from the same Doc.
        let observed = self.with_native_document_scene(
            &selected.expression_ref,
            selected.document_revision,
            world_scene,
            world_revision,
            |manager, reader| {
                Ok(
                    match manager.native_field_source_scene_read(
                        &request.lease,
                        &NativeSceneSourceReader::CurrentDocument(reader),
                    ) {
                        Ok(native) => (native, None),
                        Err(refusal) => match refusal.native_reply() {
                            Some(native) => (native.clone(), Some(refusal.reason().to_owned())),
                            None => return Err(refusal.reason().to_owned()),
                        },
                    },
                )
            },
        )?;
        let (native, channel_refusal) = observed.result?;
        // Install the original native result before any post-channel validation,
        // codec allocation or Document edit. Later errors remain recoverable.
        let allocation_preflight = measure(
            &(&native, &native, &native["host_receipt"], &before),
            super::super::MAX_REPLY
                - crate::expression_procedural_source_budget::FILE_BYTES
                - 64 * 1024,
        );
        let mut initial = json!({"schema":"oi.native-expression-selected-scene-source/v1",
            "original_request":request,"lease":request.lease,
            "native_procedural_receipts":[],"native_ordered_receipt_pending":true,
            "document_result":null,"document_receipts":[],
            "selected_scene":selected,"world_source_scene":world.world_source_scene,
            "source_current":false,"source_currentness":"Original native observation retained; source retention has not completed",
            "qualification":"unqualified","recovered":false,"replayed":false});
        initial["native_result"] = native; // move the original; do not clone before charging
        if let Some(opening) = self.native_expression.selected_scene_opening.as_mut() {
            opening.source_observation = Some(Observation {
                request: request.clone(),
                original: initial,
                document_revision: before.revision,
                document_sha256: before_sha256,
                scene_owner: scene_owner.clone(),
            });
        } else {
            return Ok(crate::KernelOpOutcome {
                receipts: Vec::new(),
                result: crate::KernelOpResult::NativeExpression { data: initial },
            });
        }
        allocation_preflight?; // the original is already retained on refusal
        let native = self
            .native_expression
            .selected_scene_opening
            .as_ref()
            .and_then(|opening| opening.source_observation.as_ref())
            .ok_or("Original native source observation holder is unavailable")?
            .original["native_result"]
            .clone();
        // Once a genuine result exists every later refusal returns it intact.
        // Source/currentness refusal may never hide an already consumed ordinal.
        let ack = receipt(&native, &request, &identity);
        let ordered_receipt_pending = ack.is_err();
        let actual_receipts: Vec<Value> = ack
            .as_ref()
            .map_or_else(|_| vec![], |ack| vec![(**ack).clone()]);
        if let Some(stored) = self
            .native_expression
            .selected_scene_opening
            .as_mut()
            .and_then(|opening| opening.source_observation.as_mut())
        {
            stored.original["native_procedural_receipts"] = json!(actual_receipts);
            stored.original["native_ordered_receipt_pending"] = json!(ordered_receipt_pending);
        }
        let qualification = observed.currentness.and_then(|()| {
            if let Some(reason) = channel_refusal {return Err(reason);}
            ack.map(|_| ())?;
            if native["status"] != "ok" {return Err("Actual native World source read refused".into());}
            let source = &native["result"]["native_field_source"];
            if source["schema"] != "ql.native-held-field-source/v1"
                || source["instance_ref"] != identity["instance_ref"]
                || !same_json(&source["original_basis"], &world.record["world"]["basis"])
                || !same_json(&source["current_basis"], &source["original_basis"])
            {
                return Err("Initial World source differs from its actual complete original/current basis; continuation opening requires its native owner".into());
            }
            let source = NativeFieldSource::from_native_artifact(source)?;
            // Charge the actual typed asset beside both retained/working native
            // values, original receipt and complete Doc before Change/Doc copies.
            measure(&(&native, &native, &native["host_receipt"], &before, &source),
                super::super::MAX_REPLY - 64 * 1024)?;
            if before.scenes.iter().find(|scene| scene.scene_ref == world_scene)
                .and_then(|scene| scene.native_field_source.as_ref())
                .is_some_and(|existing| existing != &source)
            {
                return Err("Saved current World source differs from this actual initial observation; continuation source must remain with its native owner".into());
            }
            Ok(source)
        });
        let mut after = before;
        let mut document_result = Value::Null;
        let mut document_receipts = Vec::new();
        let mut current_scene_owner = scene_owner;
        let current_scene_owner_before_instance = current_scene_owner.instance_ref().to_owned();
        let current_scene_owner_before_generation = current_scene_owner.construction_generation();
        let mut reason = qualification.as_ref().err().cloned();
        if let Ok(source) = qualification {
            let changes = vec![Change::SceneNativeFieldSourceSet {
                scene_ref: world_scene.to_owned(),
                source: Box::new(source),
            }];
            let commit = after.edited(changes.clone()).and_then(|candidate| {
                // Charge original Act evidence, its actual host receipt and the
                // prospective complete Document before committing or cloning it.
                measure(
                    &(&native, &actual_receipts, &candidate),
                    super::super::MAX_REPLY - 64 * 1024,
                )?;
                let changed = self.apply(crate::KernelOp::Expression {
                    request: crate::expression::Request::Edit {
                        expression_ref: selected.expression_ref.clone(),
                        expected_revision: selected.document_revision,
                        actor: request.actor.clone(),
                        changes,
                    },
                })?;
                document_receipts = changed.receipts;
                document_result = match changed.result {
                    crate::KernelOpResult::Expression { data } => data,
                    other => {
                        return Err(format!(
                            "Actual native source Edit returned another result: {other:?}"
                        ))
                    }
                };
                if let Some(stored) = self
                    .native_expression
                    .selected_scene_opening
                    .as_mut()
                    .and_then(|opening| opening.source_observation.as_mut())
                {
                    stored.original["document_result"] = document_result.clone();
                    stored.original["document_receipts"] = json!(document_receipts);
                }
                after = serde_json::from_value(document_result["document"].clone())
                    .map_err(|e| e.to_string())?;
                let actual = self
                    .expressions
                    .procedural_source_snapshot(&selected.expression_ref, after.revision)?;
                current_scene_owner = self
                    .expressions
                    .procedural_scene_owner(&after, &selected.scene_ref)?;
                if current_scene_owner.instance_ref() != current_scene_owner_before_instance
                    || current_scene_owner.construction_generation()
                        != current_scene_owner_before_generation
                {
                    return Err(
                        "Actual source Edit changed its native Scene constructor lifetime".into(),
                    );
                }
                if let Some(stored) = self
                    .native_expression
                    .selected_scene_opening
                    .as_mut()
                    .and_then(|opening| opening.source_observation.as_mut())
                {
                    stored.document_revision = after.revision;
                    stored.document_sha256 = fingerprint(&after)?;
                    stored.scene_owner = current_scene_owner.clone();
                }
                if actual != candidate || after != actual {
                    return Err(
                        "Actual source Edit differs from its complete preflighted Document".into(),
                    );
                }
                Ok(())
            });
            if let Err(error) = commit {
                reason = Some(error);
            }
        }
        let owner_current = match self.native_expression.active.as_ref() {
            Some(owner) => {
                owner.lease == request.lease
                    && !owner.stopped
                    && !owner.process_exited()?
                    && owner.last_request_id.to_string() == request.expected_request_id
                    && owner.procedural_position["generation"] == request.expected_generation
                    && owner.procedural_position["samples_elapsed"]
                        == request.expected_samples_elapsed
            }
            None => false,
        };
        if !owner_current && reason.is_none() {
            reason = Some("Original native source observation remains retained; its live owner/position is no longer current".into());
        }
        let selected_scene = after
            .scenes
            .iter()
            .find(|scene| scene.scene_ref == selected.scene_ref)
            .ok_or("Actual selected Scene disappeared during source retention")?;
        let current_world_scene = after
            .scenes
            .iter()
            .find(|scene| scene.scene_ref == world_scene)
            .ok_or("Actual World source Scene disappeared during source retention")?;
        let response = json!({"schema":"oi.native-expression-selected-scene-source/v1",
            "original_request":request,"lease":request.lease,"native_result":native,
            "native_procedural_receipts":actual_receipts,"native_ordered_receipt_pending":ordered_receipt_pending,
            "document_result":document_result,"document_receipts":document_receipts,
            "selected_scene":{"expression_ref":after.expression_ref,"document_revision":after.revision,
                "scene_ref":selected_scene.scene_ref,"scene_revision":selected_scene.revision},
            "world_source_scene":{"expression_ref":after.expression_ref,"document_revision":after.revision,
                "scene_ref":current_world_scene.scene_ref,"scene_revision":current_world_scene.revision},
            "source_current":reason.is_none(),"source_currentness":reason,
            "qualification":if reason.is_none() {"pending_source_bootstrap"} else {"unqualified"},"recovered":false,"replayed":false,
            "standing":"actual World source observation and native Document retention; no procedural Source/body/audio/receiving acknowledgement"});
        measure(&response, super::super::MAX_REPLY)?;
        let observation = Observation {
            request,
            original: response.clone(),
            document_revision: after.revision,
            document_sha256: fingerprint(&after)?,
            scene_owner: current_scene_owner,
        };
        self.native_expression
            .selected_scene_opening
            .as_mut()
            .ok_or("Actual source observation lost its selected opening")?
            .source_observation = Some(observation);
        Ok(crate::KernelOpOutcome {
            receipts: document_receipts,
            result: crate::KernelOpResult::NativeExpression { data: response },
        })
    }
}
