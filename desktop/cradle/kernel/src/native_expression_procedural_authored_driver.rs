//! Fixed installed Source catalogue and privately selected actual Scene reader.
//! The desktop executes this outside its mutable Kernel lock, then rechecks
//! the complete Document and the native lease before exposing a reading.
use crate::expression::procedural::{self, authored_driver, Request, SCHEMA};
use crate::expression::Document;
use serde_json::{json, Value};

pub struct PreparedRead {
    before: Document,
    intent: Request,
    lease: Option<String>,
    identity: Option<Value>,
    source_intents: Vec<(String, Result<super::bootstrap::Intent, String>)>,
    capture: Option<std::sync::Arc<std::sync::Mutex<super::stage_library::SourceDeliveryCapture>>>,
}
pub struct CompletedRead {
    catalogue: Result<Value, String>,
    issued: Vec<(String, Result<super::bootstrap::IssuedSceneRead, String>)>,
    prepared: PreparedRead,
}
impl PreparedRead {
    pub fn execute(self) -> CompletedRead {
        // Catalogue is a read-only Source operation. It supplies no native
        // performance ordinal, currentness capability or consumer observation.
        let catalogue_limit = self.capture.as_ref()
            .map(reserve_catalogue_allowance).transpose();
        let catalogue = catalogue_limit.and_then(|limit| match &self.capture {
            Some(capture) => super::execute_stateless_with_capture(
                "authored_catalog", "authored_catalog", Value::Null,
                limit.ok_or("Original authored catalogue allowance is absent")?, capture.clone(),
            ),
            None => super::execute_stateless("authored_catalog", "authored_catalog", Value::Null, 8*1024*1024),
        });
        let issued = self
            .source_intents
            .iter()
            .enumerate()
            .map(|(index, (scene_ref, intent))| {
                let issued = match (intent, &self.identity) {
                    (Ok(intent), Some(identity)) => self.capture.as_ref()
                        .ok_or_else(||"Actual native Source read resource is absent".to_owned())
                        .and_then(|capture| {
                            super::bootstrap::read_selected_scene_with_capture(
                                &self.before, identity, intent, capture, self.source_intents.len() - index,
                            )
                        }),
                    (Err(error), _) => Err(error.clone()),
                    _ => Err("Actual native Source owner is unavailable".into()),
                };
                (scene_ref.clone(), issued)
            })
            .collect();
        CompletedRead {
            prepared: self,
            catalogue,
            issued,
        }
    }
}

impl crate::Kernel {
    pub fn prepare_native_authored_driver_read(
        &self,
        op: &crate::KernelOp,
    ) -> Result<Option<PreparedRead>, String> {
        let crate::KernelOp::Expression {
            request: crate::expression::Request::Procedural { request },
        } = op
        else {
            return Ok(None);
        };
        let Request::ReadAuthoredDrivers {
            expression_ref,
            expected_revision,
            scene_ref,
            scope,
        } = request
        else {
            return Ok(None);
        };
        let before = self
            .expressions
            .procedural_source_borrow(expression_ref, *expected_revision)?;
        crate::expression::text(scene_ref)?;
        if !before.scenes.iter().any(|s| &s.scene_ref == scene_ref) {
            return Err("Actual authored Scene is absent".into());
        }
        procedural::resolve(before, scope)?;
        let scene_refs = if matches!(scope, procedural::Scope::Expression) {
            before
                .scenes
                .iter()
                .map(|scene| scene.scene_ref.as_str())
                .collect::<Vec<_>>()
        } else {
            vec![scene_ref.as_str()]
        };
        let borrowed_intents = scene_refs
            .iter()
            .map(|reference| {
                self.expressions
                    .lifecycle_source_intent_borrowed(before, reference)
                    .map(|intent| (*reference, intent))
            })
            .collect::<Result<Vec<_>, _>>()?;
        let mut intake = procedural::budget::Budget::new();
        intake.value(before)?;
        intake.value(request)?;
        intake.value(&borrowed_intents)?;
        intake.reserve(4096)?;
        let owner = self.native_expression.active.as_ref().filter(|owner|!owner.stopped);
        let capture = owner.map(|owner|owner.stage_library_replays.reserve_source_delivery(&(
            before,before,request,request,&borrowed_intents,&owner.identity,
            &owner.procedural_source,&owner.procedural_definitions,
        )).map(|capture|std::sync::Arc::new(std::sync::Mutex::new(capture)))).transpose()?;
        let source_intents = borrowed_intents.into_iter()
            .map(|(reference,intent)|(reference.to_owned(),Ok(intent.clone()))).collect();
        Ok(Some(PreparedRead {
            before: before.clone(),
            intent: request.clone(),
            lease: owner.map(|o| o.lease.clone()),
            identity: owner.map(|o| o.identity.clone()),
            source_intents,
            capture,
        }))
    }

    pub fn finish_native_authored_driver_read(
        &mut self,
        completed: CompletedRead,
    ) -> Result<crate::KernelOpOutcome, String> {
        let CompletedRead {
            prepared,
            catalogue,
            issued,
        } = completed;
        let Request::ReadAuthoredDrivers {
            expression_ref,
            expected_revision,
            scene_ref,
            scope,
        } = &prepared.intent
        else {
            return Err("Original authored read intent changed".into());
        };
        let current = self
            .expressions
            .procedural_source_borrow(expression_ref, *expected_revision)?;
        if current != &prepared.before {
            return Err("revision_conflict".into());
        }
        let native_current = match (
            &prepared.lease,
            &prepared.identity,
            self.native_expression.active.as_mut(),
        ) {
            (Some(lease), Some(identity), Some(owner)) => {
                owner.lease == *lease
                    && owner.identity == *identity
                    && !owner.stopped
                    && !owner.process_exited()?
            }
            _ => false,
        };
        let mut reading = Value::Null;
        let mut catalog = Value::Null;
        let mut catalog_revision = Value::Null;
        let mut source = Value::Null;
        let mut catalogue_response = Value::Null;
        let mut reason = Value::Null;
        let mut selected_source = Value::Null;
        match catalogue {
            Ok(reply) => {
                // Charge all retained response/catalogue copies before cloning.
                crate::expression::procedural::bootstrap::preflight_source_message(&(
                    current,
                    &prepared.intent,
                    &reply,
                    &reply,
                    &reply["native_result"]["result"]["catalog"],
                ))?;
                let actual = authored_driver::catalogue(&reply);
                match actual {
                    Ok((native_catalog, revision)) => {
                        catalog = native_catalog.clone();
                        catalog_revision = json!(revision);
                        source = reply["source"].clone();
                        catalogue_response = reply.clone();
                        let qualified = (|| -> Result<Value, String> {
                            if !native_current {
                                return Err(
                                    "Actual native Source owner changed or is unavailable".into()
                                );
                            }
                            // Charge the ENTIRE borrowed issuer cohort and all
                            // prospective final readings before the first copy.
                            let mut aggregate = procedural::budget::Budget::new();
                            aggregate.value(current)?;
                            aggregate.value(&prepared.intent)?;
                            aggregate.value(&reply)?;
                            for (reference, issued) in &issued {
                                let issued = issued.as_ref().map_err(|error| error.clone())?;
                                let selected =
                                    issued.lifecycle_reading_borrowed(current, reference)?;
                                aggregate.value(selected)?;
                                for _ in 0..2 {
                                    authored_driver::charge_reading(
                                        &mut aggregate,
                                        current,
                                        reference,
                                        scope,
                                        selected,
                                        None,
                                    )?;
                                }
                            }
                            let mut readings = Vec::new();
                            for (reference, issued) in issued {
                                let issued = issued?;
                                let selected =
                                    issued.lifecycle_reading_borrowed(current, &reference)?;
                                let actual = authored_driver::reading(
                                    &self.expressions,
                                    current,
                                    &reference,
                                    scope,
                                    selected,
                                    revision,
                                    None,
                                )?;
                                if reference == *scene_ref {
                                    selected_source = selected.clone();
                                }
                                readings.push(actual);
                            }
                            if matches!(scope, procedural::Scope::Expression) {
                                authored_driver::expression_reading(
                                    &self.expressions,
                                    current,
                                    scope,
                                    readings,
                                )
                            } else if readings.len() == 1 {
                                Ok(readings.remove(0))
                            } else {
                                Err("Authored selected read changed its exact Scene membership"
                                    .into())
                            }
                        })();
                        match qualified {
                            Ok(actual) => reading = actual,
                            Err(error) => reason = json!(error),
                        }
                    }
                    Err(error) => reason = json!(error),
                }
            }
            Err(error) => reason = json!(error),
        }
        let controls = current
            .scenes
            .iter()
            .find(|s| &s.scene_ref == scene_ref)
            .and_then(|s| s.presentation.as_ref())
            .map(|p| p.scene["procedural"]["controls"].clone())
            .unwrap_or_else(|| json!([]));
        Ok(crate::KernelOpOutcome {
            receipts: vec![],
            result: crate::KernelOpResult::Expression {
                data: json!({"schema":SCHEMA,"operation":"read_authored_drivers","original_intent":prepared.intent,
                "expression_ref":expression_ref,"document_revision":current.revision,"scene_ref":scene_ref,
                "original_scope":scope,"catalog_revision":catalog_revision,"catalog":catalog,
                "reading":reading,"controls":controls,"source":source,"catalogue_response":catalogue_response,"native_scene_read":selected_source,
                "source_current":reason.is_null()&&!reading.is_null(),"reason":reason,
                "effective_state":"native_consumers_not_yet_observed"}),
            },
        })
    }
}

/// This value is created only after the actual closed Source channel, current
/// lease and complete original Document are requalified. There is no serde or
/// public KernelOp constructor for a sealed authored Edit.
#[derive(Debug)]
pub(crate) struct SealedEdit {
    before: Document,
    intent: Request,
    input: Value,
    catalog: Value,
    preparation: Value,
    source: Value,
    native_receipt: Value,
    native_source_channel: Value,
    replay_owner: ReplayOwner,
}
#[derive(Clone, Debug)]
pub(crate) struct ReplayOwner {
    lease: String,
    identity: Value,
    executable: std::path::PathBuf,
    binding: Value,
    ordinal: u64,
}
impl ReplayOwner {
    pub(in crate::native_expression) fn require_current(
        &self,
        manager: &mut super::super::Manager,
    ) -> Result<(), String> {
        let owner = manager
            .active
            .as_mut()
            .ok_or("Original authored native Source owner is unavailable")?;
        if owner.stopped
            || owner.lease != self.lease
            || owner.identity != self.identity
            || owner.procedural_executable != self.executable
            || owner.procedural_source != self.binding
            || owner.last_request_id < self.ordinal
            || owner.process_exited()?
        {
            return Err(
                "Original authored native Source lease/image/identity changed or closed".into(),
            );
        }
        Ok(())
    }
}
impl SealedEdit {
    pub(crate) fn replay_owner(&self) -> &ReplayOwner {
        &self.replay_owner
    }
    pub(crate) fn retained_payload(&self) -> impl serde::Serialize + '_ {
        (
            &self.before,
            &self.intent,
            &self.input,
            &self.catalog,
            &self.preparation,
            &self.source,
            &self.native_receipt,
            &self.native_receipt,
            &self.native_receipt,
            &self.native_source_channel,
            &self.replay_owner.identity,
            &self.replay_owner.binding,
        )
    }
    pub(crate) fn before(&self) -> &Document {
        &self.before
    }
    pub(crate) fn intent(&self) -> &Request {
        &self.intent
    }
    pub(crate) fn input(&self) -> &Value {
        &self.input
    }
    pub(crate) fn catalog(&self) -> &Value {
        &self.catalog
    }
    pub(crate) fn preparation(&self) -> &Value {
        &self.preparation
    }
    pub(crate) fn original(&self) -> crate::expression::Request {
        crate::expression::Request::Procedural {
            request: self.intent.clone(),
        }
    }
    pub(crate) fn response(&self) -> Value {
        json!({"schema":SCHEMA,"operation":"authored_driver","original_intent":self.intent,
            "operation_ref":self.input["operation_ref"],"state":"source_prepared","source_current":true,
            "driver_preparation":self.preparation,"source":self.source,
            "native_result":self.native_receipt,"native_receipt":self.native_receipt,"native_source_channel":self.native_source_channel,
            "native_procedural_receipts":[self.native_receipt],"replayed":false,
            "effective_state":"native_consumers_not_yet_observed"})
    }
}

pub struct PreparedMutation {
    before: Document,
    intent: Request,
    lease: String,
    identity: Value,
    installed: Value,
    source_intents: Vec<(String, super::bootstrap::Intent)>,
    // SAME private process reservation, admitted while every heavy value was
    // still borrowed. Last field keeps admission through full context drop.
    capture: std::sync::Arc<std::sync::Mutex<super::stage_library::SourceDeliveryCapture>>,
}
pub struct CompletedMutation {
    catalogue: Value,
    issued: Vec<(String, super::bootstrap::IssuedSceneRead)>,
    // The preparation's resource is released only after both real replies.
    prepared: PreparedMutation,
}
fn reserve_catalogue_allowance(
    capture: &std::sync::Arc<std::sync::Mutex<super::stage_library::SourceDeliveryCapture>>,
) -> Result<usize, String> {
    let mut capture = capture.lock().map_err(|_| "Original authored catalogue resource unavailable")?;
    let limit = capture.reply_limit() / 8;
    if limit == 0 { return Err("Original authored catalogue has no bounded capacity".into()); }
    // The complete raw reply, parsed catalogue and its retained/outward forms
    // coexist while all subsequent Scene issuance consumes the same horizon.
    let copies = limit.checked_mul(32).and_then(|n|n.checked_add(4096))
        .ok_or("Original authored catalogue copy allowance overflow")?;
    capture.preflight_copy_bytes(copies)?;
    Ok(limit)
}

impl PreparedMutation {
    pub fn execute(self) -> Result<CompletedMutation, String> {
        let catalogue_limit = reserve_catalogue_allowance(&self.capture)?;
        if catalogue_limit == 0 {
            return Err("Original authored preparation has no bounded catalogue capacity".into());
        }
        let catalogue = super::execute_stateless_with_capture(
            "authored_catalog",
            "authored_catalog",
            Value::Null,
            catalogue_limit,
            self.capture.clone(),
        )?;
        let mut issued = Vec::with_capacity(self.source_intents.len());
        for (index, (reference, intent)) in self.source_intents.iter().enumerate() {
            let actual = super::bootstrap::read_selected_scene_with_capture(
                &self.before, &self.identity, intent,
                &self.capture, self.source_intents.len() - index,
            )?;
            issued.push((reference.clone(), actual));
        }
        Ok(CompletedMutation {
            prepared: self,
            catalogue,
            issued,
        })
    }
}

impl crate::Kernel {
    pub fn prepare_native_authored_driver_mutation(
        &mut self,
        op: &crate::KernelOp,
    ) -> Result<Option<PreparedMutation>, String> {
        let crate::KernelOp::Expression {
            request: crate::expression::Request::Procedural { request: intent },
        } = op
        else {
            return Ok(None);
        };
        let Request::AuthoredDriver {
            expression_ref,
            expected_revision,
            scene_ref,
            procedure_ref,
            expected_procedure_revision,
            actor,
            operation_ref,
            scope,
            target,
            ..
        } = intent
        else {
            return Ok(None);
        };
        if self.expressions.has_authored_mutation_replay(intent)? {
            return Ok(None);
        }
        crate::expression::text(actor)?;
        crate::expression::text(operation_ref)?;
        let before = self
            .expressions
            .procedural_source_borrow(expression_ref, *expected_revision)?;
        let targets = procedural::resolve(before, scope)?;
        // A shared property belongs to the complete Expression. Every Scene
        // keeps its own accepted source intent, in the actual Document order.
        let shared = target.kind == "expression_shared";
        let scene_refs = if shared {
            before
                .scenes
                .iter()
                .map(|scene| scene.scene_ref.as_str())
                .collect::<Vec<_>>()
        } else {
            vec![scene_ref.as_str()]
        };
        if !scene_refs.contains(&scene_ref.as_str()) {
            return Err("Actual authored anchor is absent from its Scene cohort".into());
        }
        let source_intents = scene_refs
            .iter()
            .map(|reference| {
                self.expressions
                    .lifecycle_source_intent_borrowed(before, reference)
                    .map(|intent| (*reference, intent))
            })
            .collect::<Result<Vec<_>, String>>()?;
        let prepared = self.native_expression.with_registered_source_context_owner(
            &self.expressions, before, scene_ref,
            |manager, source, provenance, reply, contract| {
                let owner = manager.active.as_ref()
                    .ok_or("Actual authored Source owner absent")?;
                if owner.stopped || owner.process_exited()? {
                    return Err("Actual authored native Source owner closed".into());
                }
                let lease = &owner.lease;
                let identity = &owner.identity;
                let installed = manager.procedural_definition_borrowed(
                    lease, expression_ref, procedure_ref,
                )?;
                procedural::validate_retained_procedural_definition(before, installed)?;
                if installed["procedure"]["revision"] != *expected_procedure_revision
                    || targets.is_empty() {
                    return Err("Authored operation has another actual installed Procedure revision or empty scope".into());
                }
                crate::expression::procedural::bootstrap::preflight_source_message(&(
                    before, before, intent, installed, installed,
                    &source_intents, lease, identity,
                ))?;
                // The qualified callback borrows the SAME actual Manager.
                // Reserve before cloning; no Manager reference outlives the
                // mutable guarded entry and no preparation can bypass it.
                // Both borrowed groups are counted by the original native
                // budget before cloning. Keep all eighteen original inputs;
                // serde implements tuples only through sixteen elements.
                let capture = owner.stage_library_replays.reserve_source_delivery(&(
                    (before, before, before, intent, intent, intent, intent,
                        installed, installed),
                    (&source_intents, lease, identity, source, provenance,
                        reply, contract, &owner.procedural_source,
                        &owner.procedural_definitions),
                ))?;
                Ok(PreparedMutation {
                    before: before.clone(),
                    intent: intent.clone(),
                    lease: lease.clone(),
                    identity: identity.clone(),
                    installed: installed.clone(),
                    source_intents: source_intents.iter()
                        .map(|(reference, intent)| ((*reference).to_owned(), (*intent).clone()))
                        .collect(),
                    capture: std::sync::Arc::new(std::sync::Mutex::new(capture)),
                })
            },
        )?;
        Ok(Some(prepared))
    }

    #[cfg(any(target_os = "linux", target_os = "macos"))]
    pub fn finish_native_authored_driver_mutation(
        &mut self,
        completed: CompletedMutation,
    ) -> Result<crate::KernelOpOutcome, String> {
        // Declare the shared guard before all moved heavy locals so every
        // early-return path drops those locals before releasing admission.
        let preparation_capture = completed.prepared.capture.clone();
        let CompletedMutation {
            prepared,
            catalogue,
            issued,
        } = completed;
        let PreparedMutation {
            before,
            intent,
            lease,
            identity,
            installed,
            source_intents,
            capture: prepared_capture,
        } = prepared;
        drop(prepared_capture); // preparation_capture holds the SAME slot.
        let Request::AuthoredDriver {
            expression_ref,
            scene_ref,
            procedure_ref,
            actor,
            operation_ref,
            scope,
            catalog_revision,
            target,
            action,
            ..
        } = &intent
        else {
            return Err("Original authored intent changed".into());
        };
        if self
            .expressions
            .procedural_current_receiver_document(expression_ref)?
            != &before
        {
            return Err("The full original authored Document changed during Source reading".into());
        }
        if self.native_expression.procedural_definition_borrowed(
            &lease,
            expression_ref,
            procedure_ref,
        )? != &installed
        {
            return Err("Actual authored installed Procedure changed during Source reading".into());
        }
        let (catalog, revision) = authored_driver::catalogue(&catalogue)?;
        if revision != catalog_revision {
            return Err(
                "Installed authored catalogue changed; inspect the actual new Source catalogue"
                    .into(),
            );
        }
        let shared = target.kind == "expression_shared";
        let expected_refs = if shared {
            before
                .scenes
                .iter()
                .map(|scene| scene.scene_ref.as_str())
                .collect::<Vec<_>>()
        } else {
            vec![scene_ref.as_str()]
        };
        if issued.len() != expected_refs.len()
            || source_intents.len() != expected_refs.len()
            || issued
                .iter()
                .zip(&expected_refs)
                .any(|((reference, _), expected)| reference != *expected)
            || source_intents
                .iter()
                .zip(&expected_refs)
                .any(|((reference, _), expected)| reference != *expected)
        {
            return Err("Original authored Scene/intent/issuer cohort changed".into());
        }
        // Stream-charge the entire held context and EVERY prospective Scene
        // expansion before constructing even the first material/input Value.
        let mut bounded = crate::expression::procedural::budget::Budget::new();
        bounded.value(&(
            &before,
            &intent,
            &installed,
            &source_intents,
            &lease,
            &identity,
            &catalogue,
        ))?;
        bounded.value(&intent)?;
        bounded.value(&intent)?;
        let retained_context_bytes = bounded.charged_bytes();
        let targets = procedural::resolve(&before, scope)?;
        for (reference, actual) in &issued {
            actual.charge_closed_source_read(&mut bounded)?;
            let selected = actual.lifecycle_reading_borrowed(&before, reference)?;
            for _ in 0..3 {
                authored_driver::charge_reading(
                    &mut bounded,
                    &before,
                    reference,
                    scope,
                    selected,
                    None,
                )?;
            }
            let address =
                procedural::address(&before, Some(reference), None, procedural::Component::Scene);
            let binding = procedural::source_exact_binding_borrowed(&before, &address)?
                .ok_or("Actual authored source binding absent")?;
            // The original selected issuer remains resident; Host input owns
            // its selected read and exact contributors, with no caller seal.
            bounded.value(selected)?;
            bounded.value(selected)?;
            bounded.value(&binding["contributors"])?;
        }
        for _ in 0..3 {
            bounded.value(&targets)?;
            if shared {
                bounded.value(&before.presentation)?;
            }
        }
        bounded.value(&installed["procedure"])?;
        bounded.value(&installed["procedure"])?;
        bounded.reserve(16 * 1024)?;
        preparation_capture.lock()
            .map_err(|_| "Original authored preparation resource unavailable")?
            .preflight_copy_bytes(bounded.charged_bytes().checked_sub(retained_context_bytes)
                .ok_or("Authored prospective reading budget moved backwards")?)?;
        let mut readings = Vec::with_capacity(issued.len());
        let mut scene_reads = Vec::with_capacity(issued.len());
        for (reference, actual) in &issued {
            let selected = actual.lifecycle_reading_borrowed(&before, reference)?;
            let reading = authored_driver::reading(
                &self.expressions,
                &before,
                reference,
                scope,
                selected,
                revision,
                None,
            )?;
            scene_reads.push(
                json!({"scene_read":selected,"contributors":reading["source"]["contributors"]}),
            );
            readings.push(reading);
        }
        let reading = if shared {
            authored_driver::expression_reading(&self.expressions, &before, scope, readings)?
        } else {
            readings.remove(0)
        };
        let mut input = json!({"procedure":installed["procedure"],"reading":reading,"target":target,
            "actor_ref":actor,"operation_ref":operation_ref,"action":action});
        if shared {
            input
                .as_object_mut()
                .ok_or("Authored input unavailable")?
                .insert("source_scene_ref".into(), Value::String(scene_ref.clone()));
        }
        // Input now owns its one material reading. Release the temporary
        // before capturing the complete opaque issuer/request context.
        drop(reading);
        let owner = self
            .native_expression
            .active
            .as_mut()
            .ok_or("Actual authored Source owner closed during reading")?;
        if owner.lease != lease
            || owner.identity != identity
            || owner.stopped
            || owner.process_exited()?
        {
            return Err("Actual authored native Source owner changed during reading".into());
        }
        let request_id = owner
            .last_request_id
            .checked_add(1)
            .ok_or("Native authored request sequence exhausted")?;
        // The real HostRequest requires both exact current native cursors.
        // These come from THIS observed Owner, never a caller clock or default.
        let expected_generation = owner.procedural_position["generation"]
            .as_str()
            .ok_or("Actual authored native generation cursor absent")?;
        let expected_samples_elapsed = owner.procedural_position["samples_elapsed"]
            .as_str()
            .ok_or("Actual authored native sample cursor absent")?;
        super::super::cursor(&owner.procedural_position["generation"])?;
        super::super::cursor(&owner.procedural_position["samples_elapsed"])?;
        let mut host_input = serde_json::Map::new();
        host_input.insert("input".into(), input.clone());
        if shared {
            host_input.insert("scene_reads".into(), Value::Array(scene_reads));
        } else {
            let row = scene_reads.remove(0);
            let Value::Object(mut row) = row else {
                return Err("Actual selected Scene input unavailable".into());
            };
            host_input.insert(
                "scene_read".into(),
                row.remove("scene_read")
                    .ok_or("Actual selected read unavailable")?,
            );
            host_input.insert(
                "contributors".into(),
                row.remove("contributors")
                    .ok_or("Actual contributors unavailable")?,
            );
        }
        let request = json!({"schema":"ql.field-host-request/v1","request_id":request_id.to_string(),
            "expected_generation":expected_generation,"expected_samples_elapsed":expected_samples_elapsed,
            "instance_ref":identity["instance_ref"],"event_ref":identity["event_ref"],"subject_ref":identity["subject_ref"],
            "command":{"operation":"procedure","request":{"action":if shared {"authored_shared"} else {"authored_driver"},
                "input":Value::Object(host_input)}}});
        let borrowed_scene_reads = issued
            .iter()
            .map(|(reference, actual)| (reference, actual.retained_source_payload()))
            .collect::<Vec<_>>();
        let anchor = self.capture_authored_original_delivery(
            &before,
            &intent,
            &lease,
            &identity,
            scene_ref,
            &request,
            &preparation_capture,
            &(
                &before,
                &before,
                &before,
                &intent,
                &intent,
                &intent,
                &input,
                &input,
                &request,
                &installed,
                &catalogue,
                &source_intents,
                &borrowed_scene_reads,
            ),
        )?;
        let reply_limit = anchor
            .resource
            .lock()
            .map_err(|_| "Original authored resource unavailable")?
            .reply_limit()
            / 4;
        if reply_limit == 0 {
            return Err("Original authored custody has no bounded native reply capacity".into());
        }
        // SAME 64/8MiB capture, smaller private ingress to account all sealed,
        // receiving/cache/outward copies (32x actual raw reply allowance).
        let intake =
            super::lifecycle::SourceIntake::capture(&self.native_expression, &lease, &request)?;
        drop(borrowed_scene_reads);
        self.native_expression
            .active
            .as_mut()
            .ok_or("Actual authored owner closed")?
            .definition_reply_limit = Some(reply_limit);
        let scene_revision = before
            .scenes
            .iter()
            .find(|scene| scene.scene_ref == *scene_ref)
            .ok_or("Actual authored Scene absent")?
            .revision;
        let outcome=self.with_native_document_scene(expression_ref,before.revision,scene_ref,scene_revision,
            |manager,reader|Ok(if shared {
                manager.procedural_authored_shared_scene_read(&lease,reader,&issued,&source_intents,request)
            } else {
                manager.procedural_authored_scene_read(&lease,
                    &crate::expression_procedural_scene_reader::NativeSceneSourceReader::CurrentDocument(reader),
                    &issued[0].1,&source_intents[0].1,request)
            }));
        if let Some(owner) = self.native_expression.active.as_mut() {
            owner.definition_reply_limit = None;
        }
        let outcome = outcome?;
        let (native_receipt, channel) = match outcome.result? {
            Ok(receipts) => receipts,
            Err(refusal) => {
                let (reason, channel, diagnostics, attempted) = refusal.into_recording_custody();
                let native_receipt = channel
                    .as_ref()
                    .and_then(|reply| reply.get("result"))
                    .and_then(|reply| reply.get("native_receipt"))
                    .cloned()
                    .unwrap_or(Value::Null);
                let fields = json!({"schema":SCHEMA,"operation":"authored_driver","original_intent":intent,
                    "state":"reconciliation_required","reason":reason,"source_current":false,
                    "delivery_attempted":attempted,"post_source_refusal":outcome.currentness.err(),
                    "native_receipt":native_receipt,
                    "native_diagnostics":diagnostics.reading(),"replayed":false,
                    "effective_state":"native_consumers_not_yet_observed"});
                let Value::Object(mut fields) = fields else {
                    return Err("Actual authored refusal wrapper unavailable".into());
                };
                // MOVE the complete original channel; no annotation becomes a
                // native receipt, and an unknown pipe never normalizes to ACK.
                if native_receipt.is_object() {
                    fields.insert(
                        "native_procedural_receipts".into(),
                        Value::Array(vec![native_receipt.clone()]),
                    );
                } else if !attempted {
                    fields.insert("native_procedural_receipts".into(), Value::Array(vec![]));
                }
                // Attempted without an actual receipt leaves this member
                // ABSENT. Neither [] nor caller counters infer no native ACK.
                fields.insert(
                    "native_source_channel".into(),
                    channel.unwrap_or(Value::Null),
                );
                let result = crate::KernelOpOutcome {
                    receipts: vec![],
                    result: crate::KernelOpResult::Expression {
                        data: Value::Object(fields),
                    },
                };
                drop((
                    before,
                    intent,
                    lease,
                    identity,
                    installed,
                    source_intents,
                    catalogue,
                    issued,
                    input,
                    intake,
                    native_receipt,
                ));
                drop(preparation_capture);
                return self.retain_authored_original_outcome(anchor, result, Some(diagnostics));
            }
        };
        // The raw owner/channel replies remain unchanged even when the post-read
        // or receiving edit refuses. No annotated value becomes the native seal.
        let source = intake.finish(&mut self.native_expression, &native_receipt);
        let qualified = (|| -> Result<SealedEdit, String> {
            outcome.currentness?;
            let source = source?;
            if native_receipt["status"] != "ok"
                || channel["schema"] != "ql.native-act-owner-result/v1"
                || channel["result"]["native_receipt"] != native_receipt
            {
                return Err(
                    "Actual authored native Source refused or changed its full original receipt"
                        .into(),
                );
            }
            let preparation = &native_receipt["procedural"];
            if preparation["schema"] != "ql.authored-driver-preparation/v1"
                || preparation["original_procedure"] != input["procedure"]
                || preparation["driver_reading"] != input["reading"]
                || preparation["operation_ref"] != *operation_ref
                || preparation["catalog_revision"] != *catalog_revision
                || preparation["consumer_state"] != "unconfirmed"
            {
                return Err(
                    "Actual authored Source preparation changed its original private input".into(),
                );
            }
            // Charge every borrowed value before constructing the retained
            // whole-response seal. A bounded request does not bound its reply.
            crate::expression::procedural::bootstrap::preflight_source_message(&(
                &before,
                &intent,
                &input,
                catalog,
                preparation,
                &source,
                &native_receipt,
                &native_receipt,
                &native_receipt,
                &channel,
            ))?;
            let replay_owner = ReplayOwner {
                lease: lease.clone(),
                identity: identity.clone(),
                executable: std::path::PathBuf::from(
                    source["ql_executable"]
                        .as_str()
                        .ok_or("Actual Source executable absent")?,
                ),
                binding: source["native_binding"].clone(),
                ordinal: super::super::cursor(&source["native_request_id"])?,
            };
            Ok(SealedEdit {
                before: before.clone(),
                intent: intent.clone(),
                input: input.clone(),
                catalog: catalog.clone(),
                preparation: preparation.clone(),
                source,
                native_receipt: native_receipt.clone(),
                native_source_channel: channel.clone(),
                replay_owner,
            })
        })();
        let result = match qualified {
            Err(reason) => self.authored_native_refusal(&intent, &native_receipt, &channel, reason),
            Ok(sealed) => {
                if self
                    .native_expression
                    .procedural_authored_completion
                    .is_some()
                {
                    self.authored_native_refusal(
                        &intent,
                        &native_receipt,
                        &channel,
                        "An actual authored completion is awaiting its original native operation"
                            .into(),
                    )
                } else {
                    self.native_expression.procedural_authored_completion = Some(sealed);
                    // Ordinary Kernel dispatch owns the atomic Edit and event
                    // log. The record retains its original outcome unchanged.
                    let applied = self.apply(crate::KernelOp::Expression {
                        request: crate::expression::Request::Procedural {
                            request: intent.clone(),
                        },
                    });
                    self.native_expression.procedural_authored_completion.take();
                    match applied {
                        Ok(outcome) => outcome,
                        Err(reason) => {
                            self.authored_native_refusal(&intent, &native_receipt, &channel, reason)
                        }
                    }
                }
            }
        };
        // All transient raw/context copies are released BEFORE shared
        // reservation settlement. The complete result moves into custody.
        drop((
            before,
            intent,
            lease,
            identity,
            installed,
            source_intents,
            catalogue,
            issued,
            input,
            native_receipt,
            channel,
        ));
        drop(preparation_capture);
        self.retain_authored_original_outcome(anchor, result, None)
    }

    #[cfg(not(any(target_os = "linux", target_os = "macos")))]
    pub fn finish_native_authored_driver_mutation(
        &mut self,
        _completed: CompletedMutation,
    ) -> Result<crate::KernelOpOutcome, String> {
        Err("Actual private native Scene Source is unavailable on this platform".into())
    }

    #[cfg(any(target_os = "linux", target_os = "macos"))]
    fn authored_native_refusal(
        &self,
        intent: &Request,
        native_receipt: &Value,
        channel: &Value,
        reason: String,
    ) -> crate::KernelOpOutcome {
        let mut document = match intent {
            Request::AuthoredDriver { expression_ref, .. } => self
                .expressions
                .procedural_current_receiver_document(expression_ref)
                .ok(),
            _ => None,
        };
        // Current Document disclosure is optional on an already-consumed
        // native refusal. Never allocate an unbounded post-edit Document clone.
        if crate::expression::procedural::bootstrap::preflight_source_message(&(
            document,
            document,
            intent,
            native_receipt,
            native_receipt,
            native_receipt,
            channel,
        ))
        .is_err()
        {
            document = None;
        }
        crate::KernelOpOutcome {
            receipts: vec![],
            result: crate::KernelOpResult::Expression {
                data: json!({"schema":SCHEMA,"operation":"authored_driver","original_intent":intent,
                "state":"reconciliation_required","reason":reason,"source_current":false,"document":document,
                "native_receipt":native_receipt,"native_source_channel":channel,
                "native_procedural_receipts":[native_receipt],"replayed":false,"effective_state":"native_consumers_not_yet_observed"}),
            },
        }
    }
}

/// The two admitted operations share the normal host and Agent lifecycle.
/// Neither job is serde-readable; native completions retain their original intent.
pub enum Prepared {
    Read(PreparedRead),
    Mutation(PreparedMutation),
    Retry(PreparedRetry),
}
pub enum Completed {
    Read(CompletedRead),
    Mutation(CompletedMutation),
    Retry(CompletedRetry),
}
impl Prepared {
    pub fn execute(self) -> Result<Completed, String> {
        match self {
            Self::Read(prepared) => Ok(Completed::Read(prepared.execute())),
            Self::Mutation(prepared) => prepared.execute().map(Completed::Mutation),
            Self::Retry(prepared) => Ok(Completed::Retry(prepared.execute())),
        }
    }
}
impl Completed {
    pub(crate) fn original(&self) -> crate::expression::Request {
        let intent = match self {
            Self::Read(completed) => &completed.prepared.intent,
            Self::Mutation(completed) => &completed.prepared.intent,
            Self::Retry(completed) => &completed.intent,
        };
        crate::expression::Request::Procedural {
            request: intent.clone(),
        }
    }
}
impl crate::Kernel {
    pub fn prepare_native_authored_driver(
        &mut self,
        op: &crate::KernelOp,
    ) -> Result<Option<Prepared>, String> {
        if let Some(prepared) = self.prepare_authored_original_retry(op)? {
            return Ok(Some(Prepared::Retry(prepared)));
        }
        if let Some(prepared) = self.prepare_native_authored_driver_read(op)? {
            return Ok(Some(Prepared::Read(prepared)));
        }
        self.prepare_native_authored_driver_mutation(op)
            .map(|prepared| prepared.map(Prepared::Mutation))
    }
    pub fn finish_native_authored_driver(
        &mut self,
        completed: Completed,
    ) -> Result<crate::KernelOpOutcome, String> {
        match completed {
            Completed::Retry(completed) => self.authored_original_lookup(&completed.intent),
            Completed::Read(completed) => self.finish_native_authored_driver_read(completed),
            Completed::Mutation(completed) => {
                self.finish_native_authored_driver_mutation(completed)
            }
        }
    }
}

/// Original native outcome custody is shared with the application replay row.
/// Arc shares this one allocation and reservation; it does not clone a Source
/// grant, receipt body, reservation, native owner or continuation namespace.
pub(crate) struct OriginalOutcome {
    outcome: crate::KernelOpOutcome,
    #[cfg(any(target_os = "linux", target_os = "macos"))]
    diagnostics: Option<super::super::act_diagnostics::NativeDiagnosticReceipts>,
    publication_returned: std::sync::Mutex<bool>,
    // Result and diagnostic custody drop before the original resource anchor.
    anchor: OutcomeAnchor,
}
impl std::fmt::Debug for OriginalOutcome {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let mut result = f.debug_struct("OriginalAuthoredOutcome");
        result
            .field("original_intent", &self.anchor.intent)
            .field("ordinal", &self.anchor.ordinal);
        #[cfg(any(target_os = "linux", target_os = "macos"))]
        result.field("has_native_diagnostics", &self.diagnostics.is_some());
        result.finish_non_exhaustive()
    }
}
#[derive(Debug)]
struct OutcomeAnchor {
    intent: Request,
    lease: String,
    identity: Value,
    binding: Value,
    executable: std::path::PathBuf,
    field_epoch: String,
    ordinal: u64,
    original_document_sha256: String,
    // Private, non-Clone/non-serde resource from the original shared registry.
    resource: std::sync::Arc<std::sync::Mutex<super::stage_library::SourceDeliveryCapture>>,
}
impl OriginalOutcome {
    pub(crate) fn original(&self) -> &Request {
        &self.anchor.intent
    }
    pub(crate) fn original_response(&self) -> Result<&Value, String> {
        let crate::KernelOpResult::Expression { data } = &self.outcome.result else {
            return Err("Original authored outcome has another native result".into());
        };
        Ok(data)
    }
    pub(crate) fn preflight_response(&self, wrapper: &impl serde::Serialize) -> Result<(), String> {
        self.anchor
            .resource
            .lock()
            .map_err(|_| "Original authored resource custody unavailable")?
            .preflight_outward(&self.outcome, wrapper)
    }
    fn returned_outcome(
        &self,
        intent: &Request,
        historical: bool,
    ) -> Result<crate::KernelOpOutcome, String> {
        if &self.anchor.intent != intent {
            return Err(
                "Authored operation identity already has another complete original intent".into(),
            );
        }
        let mut published = self
            .publication_returned
            .lock()
            .map_err(|_| "Original authored publication fence unavailable")?;
        self.preflight_response(&(
            &self.outcome,
            intent,
            &self.anchor.lease,
            &self.anchor.identity,
            &self.anchor.binding,
            &self.anchor.executable,
            &self.anchor.field_epoch,
            &self.anchor.original_document_sha256,
        ))?;
        let mut result = self.outcome.clone();
        // The original committed events remain in the native event log and in
        // original custody. Readonly retry publishes no events a second time.
        if *published {
            result.receipts.clear();
        }
        if historical {
            if let crate::KernelOpResult::Expression { data } = &mut result.result {
                data["replayed"] = json!(true);
                data["original_state"] = data["state"].clone();
                data["state"] = json!("original_outcome_retained");
                data["source_current"] = json!(false);
                data["recovery_current"] = json!(false);
                data["qualification"] = json!("original_authored_outcome_only");
                data["effective_state"] = json!("native_consumers_not_yet_observed");
                data["original_native_origin"] = json!({"lease":self.anchor.lease,
                "identity":self.anchor.identity,"binding":self.anchor.binding,
                "executable":self.anchor.executable,"field_epoch":self.anchor.field_epoch,
                "ordinal":self.anchor.ordinal.to_string(),
                "document_sha256":self.anchor.original_document_sha256});
            }
        }
        // Return admission is fenced only after the whole bounded clone has
        // succeeded. Lost outward responses do not repeat committed events.
        *published = true;
        Ok(result)
    }
}
pub struct PreparedRetry {
    intent: Request,
}
pub struct CompletedRetry {
    intent: Request,
}
impl PreparedRetry {
    fn execute(self) -> CompletedRetry {
        CompletedRetry {
            intent: self.intent,
        }
    }
}
fn outcome_intent(intent: &Request) -> Result<&Request, String> {
    match intent {
        Request::AuthoredDriver { .. } => Ok(intent),
        Request::AuthoredDriverRetry { original_intent } => match original_intent.as_ref() {
            original @ Request::AuthoredDriver { .. } => Ok(original),
            _ => Err(
                "Readonly authored retry requires exactly the full original authored-driver intent"
                    .into(),
            ),
        },
        _ => Err("Original authored outcome has another operation".into()),
    }
}
fn outcome_key(intent: &Request) -> Result<&str, String> {
    let Request::AuthoredDriver { operation_ref, .. } = outcome_intent(intent)? else {
        return Err("Original authored outcome has another operation".into());
    };
    crate::expression::text(operation_ref)?;
    Ok(operation_ref)
}
impl crate::Kernel {
    fn authored_original_lookup(
        &self,
        requested: &Request,
    ) -> Result<crate::KernelOpOutcome, String> {
        let intent = outcome_intent(requested)?;
        if let Some(original) = self
            .native_expression
            .procedural_authored_outcomes
            .get(outcome_key(intent)?)
        {
            return original.returned_outcome(intent, true);
        }
        if !matches!(requested, Request::AuthoredDriverRetry { .. }) {
            return Err(
                "Original authored outcome custody unavailable; no automatic re-delivery".into(),
            );
        }
        // Absence does not prove that native delivery never happened. There is
        // no ACK, current Source, native receipt or permission to resend here.
        let mut bounded = procedural::budget::Budget::new();
        bounded.value(requested)?;
        bounded.value(intent)?;
        bounded.reserve(4096)?;
        Ok(crate::KernelOpOutcome {
            receipts: vec![],
            result: crate::KernelOpResult::Expression {
                data: json!({
                    "schema":SCHEMA,"operation":"authored_driver","original_intent":intent,
                    "state":"original_outcome_unavailable","lookup_only":true,
                    "source_current":false,"recovery_current":false,
                    "qualification":"no_original_authored_outcome_custody",
                    "effective_state":"native_consumers_not_yet_observed",
                    "reason":"Original authored outcome unavailable; native delivery remains unknown; no automatic re-delivery"
                }),
            },
        })
    }
    pub(crate) fn retry_native_authored_driver_original(
        &self,
        request: crate::expression::Request,
    ) -> Result<crate::KernelOpOutcome, String> {
        let crate::expression::Request::Procedural {
            request: intent @ Request::AuthoredDriverRetry { .. },
        } = request
        else {
            return Err("Readonly authored recovery changed its exact lookup operation".into());
        };
        self.authored_original_lookup(&intent)
    }
    fn prepare_authored_original_retry(
        &self,
        op: &crate::KernelOp,
    ) -> Result<Option<PreparedRetry>, String> {
        let crate::KernelOp::Expression {
            request: crate::expression::Request::Procedural { request: intent },
        } = op
        else {
            return Ok(None);
        };
        let lookup_only = matches!(intent, Request::AuthoredDriverRetry { .. });
        if !lookup_only && !matches!(intent, Request::AuthoredDriver { .. }) {
            return Ok(None);
        }
        let original_intent = outcome_intent(intent)?;
        let key = outcome_key(original_intent)?;
        let mut bounded = procedural::budget::Budget::new();
        // Account the complete prospective retry copy cohort while borrowing:
        // incoming offered request, retained Prepared/Completed request,
        // Completed::original comparison copy, and absent-result inner intent.
        // The pure off-lock path must not allocate its first full clone before
        // admitting the comparison and response copies that follow it.
        bounded.value(&(intent, intent, intent, original_intent))?;
        bounded.reserve(4096)?;
        if let Some(original) = self.native_expression.procedural_authored_outcomes.get(key) {
            if original.original() != original_intent {
                return Err(
                    "Authored operation identity already has another complete original intent"
                        .into(),
                );
            }
            original.preflight_response(&(&original.outcome, intent))?;
        } else if !lookup_only {
            // This is the ordinary first edit, never a recovery lookup.
            return Ok(None);
        }
        // Explicit lookup is always consumed here, including absent custody.
        // Its off-lock execute is pure and can never fall through to Source.
        Ok(Some(PreparedRetry {
            intent: intent.clone(),
        }))
    }
    fn capture_authored_original_delivery(
        &mut self,
        before: &Document,
        intent: &Request,
        lease: &str,
        identity: &Value,
        scene_ref: &str,
        request: &Value,
        preparation_capture: &std::sync::Arc<std::sync::Mutex<super::stage_library::SourceDeliveryCapture>>,
        complete_borrowed_context: &impl serde::Serialize,
    ) -> Result<OutcomeAnchor, String> {
        if self
            .native_expression
            .procedural_authored_outcomes
            .contains_key(outcome_key(intent)?)
        {
            return Err("Original authored operation already has held outcome custody; inspect it without re-delivery".into());
        }
        let owner = self
            .native_expression
            .active
            .as_ref()
            .ok_or("Actual authored owner closed")?;
        let ordinal = super::super::cursor(&request["request_id"])?;
        if owner.lease != lease
            || &owner.identity != identity
            || owner.stopped
            || owner.process_exited()?
            || owner.last_request_id.checked_add(1) != Some(ordinal)
            || request["expected_generation"] != owner.procedural_position["generation"]
            || request["expected_samples_elapsed"] != owner.procedural_position["samples_elapsed"]
            || ["instance_ref", "event_ref", "subject_ref"]
                .iter()
                .any(|key| request[*key] != owner.identity[*key])
        {
            return Err(
                "Original authored delivery changed its actual owner/identity/ordinal/cursors"
                    .into(),
            );
        }
        // The Source context is the genuine original private completion. Caller
        // JSON, a saved outcome and the selected anchor cannot reconstruct it.
        self.native_expression.with_registered_source_context_owner(
            &self.expressions, before, scene_ref,
            |manager, source, provenance, reply, contract| {
                let owner = manager.active.as_ref().ok_or("Actual authored owner closed")?;
                // Keep the full original local aperture checked. Its Document
                // and Source context were already admitted at preparation.
                crate::expression::procedural::bootstrap::preflight_source_message(&(
                    complete_borrowed_context, source, provenance, reply, contract,
                    &owner.identity, &owner.procedural_source, &owner.procedural_definitions,
                ))?;
                // Only the NEW retained anchor copies consume the original
                // reply allowance here. No second capture slot or reservation.
                preparation_capture.lock()
                    .map_err(|_| "Original authored preparation resource unavailable")?
                    .preflight_copies(&(
                        intent, lease, identity, &owner.procedural_source,
                        &owner.procedural_executable, &owner.native_field_epoch,
                    ))
            },
        )?;
        let owner = self
            .native_expression
            .active
            .as_ref()
            .ok_or("Actual authored owner closed")?;
        Ok(OutcomeAnchor {
            intent: intent.clone(),
            lease: lease.to_owned(),
            identity: identity.clone(),
            binding: owner.procedural_source.clone(),
            executable: owner.procedural_executable.clone(),
            field_epoch: owner.native_field_epoch.clone(),
            ordinal,
            original_document_sha256: super::bootstrap::fingerprint(before)?,
            resource: preparation_capture.clone(),
        })
    }
    fn retain_authored_original_outcome(
        &mut self,
        anchor: OutcomeAnchor,
        outcome: crate::KernelOpOutcome,
        #[cfg(any(target_os = "linux", target_os = "macos"))] diagnostics: Option<
            super::super::act_diagnostics::NativeDiagnosticReceipts,
        >,
    ) -> Result<crate::KernelOpOutcome, String> {
        let key = outcome_key(&anchor.intent)?.to_owned();
        if self
            .native_expression
            .procedural_authored_outcomes
            .contains_key(&key)
        {
            return Err("Original authored outcome custody cannot be overwritten".into());
        }
        // MOVE the whole original outcome before any outward clone or capacity
        // settlement. A qualification/return refusal leaves this body retained.
        let original = OriginalOutcome {
            outcome,
            anchor,
            publication_returned: std::sync::Mutex::new(false),
            #[cfg(any(target_os = "linux", target_os = "macos"))]
            diagnostics,
        };
        let shared = std::sync::Arc::new(original);
        self.native_expression
            .procedural_authored_outcomes
            .insert(key, shared.clone());
        // The private application replay references SAME original allocation.
        // Its previous response bytes are released after this original is held.
        self.expressions
            .attach_authored_original_outcome(shared.clone())?;
        // The old application evidence is now released; the same allocation is
        // held by both owners. Only now may the original capacity be reduced.
        shared
            .anchor
            .resource
            .lock()
            .map_err(|_| "Original authored resource custody unavailable")?
            .settle_outcome(
                &shared.outcome,
                &(
                    &shared.anchor.intent,
                    &shared.anchor.lease,
                    &shared.anchor.identity,
                    &shared.anchor.binding,
                    &shared.anchor.executable,
                    &shared.anchor.field_epoch,
                    &shared.anchor.original_document_sha256,
                ),
            )?;
        shared.returned_outcome(shared.original(), false)
    }
}

#[cfg(test)]
mod readonly_original_retry_tests {
    use super::*;
    fn original_intent() -> Request {
        Request::AuthoredDriver {
            expression_ref: "expression:readonly-original".into(),
            expected_revision: 1,
            scene_ref: "expression:readonly-original:scene:main".into(),
            procedure_ref: "procedure:readonly-original".into(),
            expected_procedure_revision: "r1".into(),
            actor: "human:author".into(),
            operation_ref: "operation:readonly-unknown".into(),
            scope: procedural::Scope::Expression,
            catalog_revision: "original-catalog".into(),
            target: authored_driver::Target {
                kind: "expression_shared".into(),
                key: "speed".into(),
                entity_ref: None,
            },
            action: Box::new(authored_driver::Action::SetBase { value: 0.5 }),
        }
    }
    #[test]
    fn absent_authored_original_lookup_never_falls_through_to_source_or_mutation() {
        let mut kernel = crate::Kernel::new(crate::CentralClient::discover());
        let original = original_intent();
        let request = Request::AuthoredDriverRetry {
            original_intent: Box::new(original.clone()),
        };
        let op = crate::KernelOp::Expression {
            request: crate::expression::Request::Procedural {
                request: request.clone(),
            },
        };
        let prepared = kernel.prepare_native_authored_driver(&op).unwrap().unwrap();
        assert!(matches!(&prepared, Prepared::Retry(_)));
        let completed = prepared.execute().unwrap();
        assert_eq!(
            completed.original(),
            crate::expression::Request::Procedural {
                request: request.clone()
            }
        );
        let outcome = kernel.finish_native_authored_driver(completed).unwrap();
        assert!(outcome.receipts.is_empty());
        let crate::KernelOpResult::Expression { data } = outcome.result else {
            panic!("another result")
        };
        assert_eq!(
            data["original_intent"],
            serde_json::to_value(&original).unwrap()
        );
        assert_eq!(data["state"], "original_outcome_unavailable");
        assert_eq!(data["source_current"], false);
        assert!(data.get("native_procedural_receipts").is_none());
        let again = kernel.apply(op).unwrap();
        assert!(again.receipts.is_empty());
        let crate::KernelOpResult::Expression { data: again } = again.result else {
            panic!("another result")
        };
        assert_eq!(data, again);
        assert!(kernel.native_expression.active.is_none());
        assert!(kernel
            .native_expression
            .procedural_authored_outcomes
            .is_empty());
        assert!(kernel
            .apply(crate::KernelOp::Expression {
                request: crate::expression::Request::Inspect {
                    expression_ref: "expression:readonly-original".into(),
                },
            })
            .is_err());
    }
    #[test]
    fn readonly_authored_lookup_rejects_nested_or_non_authored_original_intents() {
        let mut kernel = crate::Kernel::new(crate::CentralClient::discover());
        for original in [
            Request::AuthoredDriverRetry {
                original_intent: Box::new(original_intent()),
            },
            Request::ReadAuthoredDrivers {
                expression_ref: "expression:readonly-original".into(),
                expected_revision: 1,
                scene_ref: "expression:readonly-original:scene:main".into(),
                scope: procedural::Scope::Expression,
            },
        ] {
            let op = crate::KernelOp::Expression {
                request: crate::expression::Request::Procedural {
                    request: Request::AuthoredDriverRetry {
                        original_intent: Box::new(original),
                    },
                },
            };
            assert!(kernel.prepare_native_authored_driver(&op).is_err());
            assert!(kernel.apply(op).is_err());
        }
        assert!(kernel.native_expression.active.is_none());
        assert!(kernel
            .native_expression
            .procedural_authored_outcomes
            .is_empty());
    }

    #[test]
    fn absent_authored_original_retry_bounds_all_copies_before_prepared_clone() {
        let mut kernel = crate::Kernel::new(crate::CentralClient::discover());
        let mut original = original_intent();
        let Request::AuthoredDriver { scope, .. } = &mut original else {
            panic!("another original")
        };
        *scope = procedural::Scope::Scenes {
            scene_refs: (0..65_536)
                .map(|index| {
                    format!("expression:readonly-original:scene:{index:06}:original-copy-boundary")
                })
                .collect(),
        };
        let request = Request::AuthoredDriverRetry {
            original_intent: Box::new(original),
        };
        // A single typed request fits the existing byte horizon. This does
        // not provide a native Scene, Source or outcome custody of any kind.
        let mut one = procedural::budget::Budget::new();
        one.value(&request).unwrap();
        one.reserve(4096).unwrap();
        assert!(one.charged_bytes() < procedural::budget::SOURCE_BYTES);
        let op = crate::KernelOp::Expression {
            request: crate::expression::Request::Procedural { request },
        };
        let error = kernel
            .prepare_native_authored_driver(&op)
            .err()
            .expect("all prospective cold lookup copies must refuse before preparation");
        assert!(error.contains("aggregate intake byte budget exceeded before allocation"));
        assert!(kernel.native_expression.active.is_none());
        assert!(kernel.native_expression.procedural_authored_outcomes.is_empty());
        assert!(kernel.apply(op).is_err());
    }
}

#[cfg(test)]
mod source_catalogue_custody_tests {
    use super::*;
    #[test]
    fn actual_native_catalogue_and_installed_selector_preserve_same_resource() {
        let candidate = std::env::var_os("OI_BIN").filter(|value| !value.is_empty())
            .expect("OI_BIN must name the native publisher's pinned candidate");
        assert!(std::path::Path::new(&candidate).is_absolute());
        let capture = std::sync::Arc::new(std::sync::Mutex::new(
            super::super::stage_library::SourceDeliveryCapture::isolated_resource_for_test(
                &"native catalogue custody; no Scene/current Source authority",
            ).unwrap(),
        ));
        let prior = capture.lock().unwrap().reply_limit();
        let limit = reserve_catalogue_allowance(&capture).unwrap();
        assert!(capture.lock().unwrap().reply_limit() < prior);
        let ordinary = super::super::execute_stateless(
            "authored_catalog", "authored_catalog", Value::Null, 8 * 1024 * 1024,
        ).unwrap();
        let bounded = super::super::execute_stateless_with_capture(
            "authored_catalog", "authored_catalog", Value::Null, limit, capture,
        ).unwrap();
        assert_eq!(bounded["native_result"], ordinary["native_result"]);
        assert_eq!(bounded["source"]["ql_executable"], ordinary["source"]["ql_executable"]);
        assert_eq!(bounded["source"]["ql_selection"], ordinary["source"]["ql_selection"]);
        assert_eq!(bounded["source"]["ql_revision"], ordinary["source"]["ql_revision"]);
        assert_eq!(bounded["source"]["original_request"], Value::Null);
        assert!(!bounded["native_result"]["result"]["catalog"].is_null());
    }
}
