//! Read-only private initial definition projection and actual Source continuation.
//! No native exchange, Scene Edit or acknowledgement occurs in this factory.
use super::*;
use crate::expression::procedural::receiver::ReceivingWork;
#[path = "native_expression_procedural_definition_channel.rs"]
mod channel;

/// Native factory custody only. Its command is transported configuration;
/// protected execution must recheck this same factory against actual current
/// Source and compiler admission before sending the existing C channel request.
pub(crate) struct NativePendingDefinition {
    command: Value,
    source_producer_ref: String,
    document_fingerprint: String,
    original_preparation: Value,
    original_source: Value,
}
impl NativePendingDefinition {
    pub(crate) fn command(&self) -> &Value {
        &self.command
    }
    pub(crate) fn require_current(
        &self,
        manager: &mut crate::native_expression::Manager,
        application: &Application,
        before: &Document,
        scene_ref: &str,
    ) -> Result<(), String> {
        let work = application.procedural_receiving_work(before, &self.source_producer_ref)?;
        if super::super::bootstrap::fingerprint(before)? != self.document_fingerprint
            || work.original_preparation() != &self.original_preparation
            || work.source() != &self.original_source
        {
            return Err(
                "Initial native definition has another actual producer/Document CAS".into(),
            );
        }
        manager.with_registered_source_context(application, before, scene_ref, |source, _, _, _| {
            validate_initial_source(&work, source)
        })
    }
}
fn validate_initial_source(work: &ReceivingWork<'_>, source: &Value) -> Result<(), String> {
    let prepared = work.original_preparation();
    let context = &work.source()["original_request"]["native_context"];
    if source["expression_ref"] != prepared["native_edit"]["expression_ref"]
        || source["document_revision"] != prepared["native_edit"]["expected_revision"]
        || ["source_composition", "currentness", "thread_plan"]
            .iter()
            .any(|key| context[*key] != source[*key])
        || prepared["original_procedure"]["composition"] != source["authored_cprime"]
        || prepared["original_procedure"]["timing"] != source["timing"]
        || prepared["required_consumers"] != source["consumer_contract"]["required_consumers"]
        || prepared["native_cprime"].is_null()
        || !prepared["lifecycle_intent"].is_null()
    {
        return Err(
            "Initial native definition differs from the actual completed Source/compiler basis"
                .into(),
        );
    }
    Ok(())
}
fn initial_definition(work: &ReceivingWork<'_>, source: &Value) -> Result<Value, String> {
    validate_initial_source(work, source)?;
    let prepared = work.original_preparation();
    let original = &work.source()["original_request"];
    let program = &prepared["original_procedure"]["recipe_parameters"]["native_program"];
    if program.is_null() || original["procedure"] != prepared["original_procedure"] {
        return Err("Initial installed program lacks its exact admitted original Procedure".into());
    }
    let interval_ref = format!(
        "interval:procedure:{}",
        super::super::bootstrap::fingerprint(&(
            &prepared["procedure_ref"],
            &prepared["operation_ref"],
            &prepared["fingerprint"]
        ))?
    );
    Ok(
        json!({"schema":"ql.procedural-conduct/v1","procedure":prepared["original_procedure"],
        "program":program,"expression_ref":prepared["native_edit"]["expression_ref"],
        "document_revision":prepared["expected_document_revision"],
        "current_readings":original["current_readings"],
        "source_composition":source["source_composition"],"currentness":source["currentness"],
        "thread_plan":source["thread_plan"],"required_consumers":prepared["required_consumers"],
        "interval_ref":interval_ref,"materialization":original["materialization"]}),
    )
}
/// Borrowed configuration comparison only. The caller already owns a real
/// current CompletedSourceIntake; this function cannot construct that custody.
/// Fresh material evidence may change the native interpretation revision,
/// while every original semantic source/shape/actor/profile stays exact.
fn validate_fresh_continuation_semantics(installed: &Value, source: &Value) -> Result<(), String> {
    fn same_fields_except(left: &Value, right: &Value, omitted: &[&str]) -> bool {
        let (Some(a), Some(b)) = (left.as_object(), right.as_object()) else {
            return false;
        };
        a.len() == b.len()
            && a.iter().all(|(key, value)| {
                b.get(key)
                    .is_some_and(|next| omitted.contains(&key.as_str()) || value == next)
            })
    }
    let old = &installed["procedure"]["composition"];
    let fresh = &source["authored_cprime"];
    if !same_fields_except(old, fresh, &["interpretation"])
        || !same_fields_except(
            &old["interpretation"],
            &fresh["interpretation"],
            &["revision"],
        )
        || old["interpretation"]["revision"]
            != installed["currentness"]["expected"]["bindingRevision"]
        || fresh["interpretation"]["revision"]
            != source["currentness"]["expected"]["bindingRevision"]
        || source["native_scene_source"]["source_basis"] != installed["procedure"]["profile"]
    {
        return Err(
            "Fresh native Source changed original semantic authoring/profile identity".into(),
        );
    }
    let a = &installed["source_composition"];
    let b = &source["source_composition"];
    let (Some(old_steps), Some(new_steps)) = (a["steps"].as_array(), b["steps"].as_array()) else {
        return Err("Original/current native Source composition steps absent".into());
    };
    if !same_fields_except(a, b, &["steps"]) || old_steps.len() != 2 || new_steps.len() != 2 {
        return Err("Native source continuation changed original compiler topology".into());
    }
    for (index, (old_step, new_step)) in old_steps.iter().zip(new_steps).enumerate() {
        let coordinate = if index == 0 { "useRef" } else { "from" };
        let old_evidence = &old_step["basis"]["evidence"];
        let new_evidence = &new_step["basis"]["evidence"];
        if old_step["op"] != if index == 0 { "whole" } else { "reframe" }
            || !same_fields_except(old_step, new_step, &[coordinate, "basis"])
            || !same_fields_except(&old_step["basis"], &new_step["basis"], &["evidence"])
            || old_evidence.as_array().is_none_or(|e| e.len() != 2)
            || new_evidence.as_array().is_none_or(|e| e.len() != 2)
            || old_evidence[0] != installed["procedure"]["profile"]["source_ref"]
            || new_evidence[0] != source["native_scene_source"]["source_basis"]["source_ref"]
            || new_evidence[1] != source["native_scene_source"]["material_fingerprint"]
            || old_evidence != old_steps[0]["basis"]["evidence"]
            || new_evidence != new_steps[0]["basis"]["evidence"]
            || old_step[coordinate].as_str().is_none_or(str::is_empty)
            || new_step[coordinate].as_str().is_none_or(str::is_empty)
        {
            return Err("Fresh native Source changed immutable graph/source attribution".into());
        }
    }
    if old_steps[1]["from"] != old_steps[0]["useRef"]
        || new_steps[1]["from"] != new_steps[0]["useRef"]
    {
        return Err("Fresh native Source detached its canonical whole/reframe dependency".into());
    }
    Ok(())
}
impl crate::native_expression::Manager {
    pub(crate) fn native_definition_scene_ref(
        &mut self,
        application: &Application,
        before: &Document,
    ) -> Result<String, String> {
        let scene_ref = text(
            &self
                .active
                .as_ref()
                .ok_or("Actual Source owner closed")?
                .registered_consumers
                .as_ref()
                .ok_or("Current native Source roster absent")?
                .source["scene_ref"],
        )?
        .to_owned();
        self.with_registered_source_context(application, before, &scene_ref, |_, _, _, _| {
            Ok(scene_ref.clone())
        })
    }

    /// Borrow from genuine warm admission/current completion at unchanged Docr.
    /// The caller performs the existing acknowledged private Conduct request
    /// before ordinary S Prepare journals r->r+1. This method never exchanges.
    pub(crate) fn native_prepared_definition(
        &mut self,
        application: &Application,
        before: &Document,
        scene_ref: &str,
        producer_ref: &str,
        copies:&mut super::super::stage_library::SourceDeliveryCapture,
    ) -> Result<NativePendingDefinition, String> {
        let work = application.procedural_receiving_work(before, producer_ref)?;
        if self
            .active
            .as_ref()
            .and_then(|owner| owner.registered_consumers.as_ref())
            .and_then(|registered| registered.issued_scene.as_ref())
            .is_none()
        {
            return Err(
                "Initial definition requires the actual retained no-write Scene issuer".into(),
            );
        }
        let command = self.with_registered_source_context(application, before, scene_ref,
            |source, provenance, _, _| {
                let bootstrap = &provenance["original_request"]["input"];
                if provenance["original_request"]["action"] != "source_bootstrap"
                    || bootstrap["schema"] != "ql.native-procedural-source-bootstrap-request/v1"
                    || bootstrap["scene"]["document_revision"].as_u64() != Some(before.revision) {
                    return Err("First installation requires the same current private bootstrap intake".into());
                }
                // Charge the command and the retained factory custody together
                // while all original Scene/compiler bodies are still borrowed.
                // The repeated originals cover the command's preparation/source
                // fields plus the immutable pending factory copies below.
                crate::expression::procedural::bootstrap::preflight_source_message(&(
                    source, provenance, work.original_preparation(), work.source(),
                    work.original_preparation(), work.source()))?;
                copies.preflight_copies(&(source,provenance,work.original_preparation(),
                    work.source(),work.original_preparation(),work.source()))?;
                let definition = initial_definition(&work, source)?;
                crate::expression::procedural::bootstrap::preflight_source_message(&(
                    &definition, bootstrap, work.original_preparation(), work.source()))?;
                copies.preflight_copies(&(&definition,bootstrap,work.original_preparation(),work.source()))?;
                application.qualify_procedural_definition(before, producer_ref, &definition)?;
                Ok(json!({"action":"install_prepared","input":{
                    "schema":"ql.native-procedural-prepared-install/v1","definition":definition,
                    "original_preparation":work.original_preparation(),"source_bootstrap":bootstrap}}))
            })?;
        Ok(NativePendingDefinition {
            command,
            source_producer_ref: producer_ref.into(),
            document_fingerprint: super::super::bootstrap::fingerprint(before)?,
            original_preparation: work.original_preparation().clone(),
            original_source: work.source().clone(),
        })
    }

    /// Current readings are supplied by Root's protected actual ReadSource.
    /// Fresh issuer/SceneOwner/Source completion already live on this Manager;
    /// neither a browser graph nor a serialized old contract can qualify this.
    pub(crate) fn native_source_continuation_input(
        &mut self,
        application: &Application,
        before: &Document,
        scene_ref: &str,
        lease: &str,
        procedure_ref: &str,
        current_readings: &Value,
        materialization: &Value,
        copies:&mut super::super::stage_library::SourceDeliveryCapture,
    ) -> Result<Value, String> {
        self.with_registered_source_context_owner(application, before, scene_ref,
            |owner, source, provenance, _, contract| {
                let installed = owner.procedural_definition_borrowed(lease, &before.expression_ref, procedure_ref)?;
                let bootstrap = &provenance["original_request"]["input"];
                if provenance["original_request"]["action"] != "source_bootstrap"
                    || bootstrap["scene"]["document_revision"].as_u64() != Some(before.revision)
                    || !same_anchor(&contract["original_timing"], &installed["procedure"]["timing"])
                    || contract["required_consumers"] != installed["required_consumers"] {
                    return Err("Continuation needs fresh native source of the exact installed semantic definition".into());
                }
                // Admit the entire borrowed current source/command expansion
                // before json! copies any Source or materialization body.
                crate::expression::procedural::bootstrap::preflight_source_message(&(
                    source, provenance, &installed, current_readings, materialization))?;
                validate_fresh_continuation_semantics(installed, source)?;
                copies.preflight_copies(&(bootstrap,bootstrap,current_readings,materialization))?;
                Ok(json!({"action":"source_continue","input":{
                    "schema":"ql.native-procedural-source-continuation/v1","procedure_ref":procedure_ref,
                    "expected_procedure_revision":installed["procedure"]["revision"],
                    "source_bootstrap":bootstrap,"current_readings":current_readings,"materialization":materialization}}))
            })
    }

    /// Only the completed SAME private C/Source request may advance currentness.
    /// The original definition and compiler admission stay immutable; this is
    /// no new producer, S preparation, journal row or consumer acknowledgement.
    pub(crate) fn retain_registered_source_continuation(
        &mut self,
        application: &Application,
        before: &Document,
        scene_owner: SceneOwner,
        completion: CompletedSourceIntake,
    ) -> Result<(), String> {
        completion.require_current(self)?;
        let origin = &completion.source()["original_request"];
        let receipt = &completion.reply()["procedural"]["definition_receipt"];
        let lease = self
            .active
            .as_ref()
            .ok_or("Actual native owner closed")?
            .lease
            .clone();
        let procedure_ref = text(&origin["input"]["procedure_ref"])?;
        let original = self.procedural_definition_borrowed(&lease, &before.expression_ref, procedure_ref)?;
        let next = &receipt["definition"];
        if origin["action"] != "source_continue"
            || completion.reply()["status"] != "ok"
            || completion.reply()["procedural"]["status"] != "source_continued"
            || receipt["schema"] != "ql.native-procedural-definition-receipt/v1"
            || receipt["kind"] != "source_continue"
            || &receipt["original_definition"] != original
            || next["procedure"] != original["procedure"]
            || next["program"] != original["program"]
            || next["required_consumers"] != original["required_consumers"]
            || next["interval_ref"] != original["interval_ref"]
            || next["expression_ref"] != before.expression_ref
            || next["document_revision"].as_u64() != Some(before.revision)
            || receipt["source_bootstrap"] != origin["input"]["source_bootstrap"]
            || ["source_composition", "currentness", "thread_plan"]
                .iter()
                .any(|key| next[*key] != receipt["current_source"][*key])
            || receipt["material_status"] != "unchanged"
        {
            return Err("Private continuation changed its actual installed original definition/current intake".into());
        }
        crate::expression::procedural::bootstrap::preflight_source_message(&(
            &original,
            next,
            completion.source(),
            completion.reply(),
        ))?;
        self.check_procedural_definition_budget(&lease, next)?;
        let next = next.clone();
        let mut registered =
            RegisteredConsumers::from_bootstrap(application, before, scene_owner, completion)?;
        registered.continued_definition = Some(next.clone());
        if self
            .active
            .as_ref()
            .and_then(|owner| owner.registered_consumers.as_ref())
            .and_then(|old| old.issued_scene.as_ref())
            .is_none()
        {
            return Err("Continuation lost its original private Scene issuer custody".into());
        }
        self.retain_procedural_definition(&lease, next, registered.completion.reply())?;
        registered.issued_scene = self
            .active
            .as_mut()
            .ok_or("Actual Source owner closed")?
            .registered_consumers
            .as_mut()
            .and_then(|old| old.issued_scene.take());
        self.active
            .as_mut()
            .ok_or("Actual Source owner closed")?
            .registered_consumers = Some(registered);
        Ok(())
    }
}

/// The current no-write bootstrap's exact native issuer, not its JSON projection.
/// Move it once from actual bootstrap finish; no Deserialize/Clone constructor.
pub(super) struct RegisteredDefinitionSceneRead {
    issued: crate::native_expression::procedural::bootstrap::IssuedSceneRead,
    intent: crate::native_expression::procedural::bootstrap::Intent,
}
impl std::fmt::Debug for RegisteredDefinitionSceneRead {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("RegisteredDefinitionSceneRead")
            .field("scene_ref", &self.intent.scene_ref)
            .finish_non_exhaustive()
    }
}
impl crate::native_expression::Manager {
    pub(crate) fn retain_registered_definition_scene_read(
        &mut self,
        application: &Application,
        before: &Document,
        issued: crate::native_expression::procedural::bootstrap::IssuedSceneRead,
        intent: crate::native_expression::procedural::bootstrap::Intent,
    ) -> Result<(), String> {
        let registered = self
            .active
            .as_mut()
            .ok_or("Actual Source owner closed")?
            .registered_consumers
            .as_mut()
            .ok_or("Current native Source roster absent")?;
        application.require_procedural_scene_owner(&registered.scene_owner, before)?;
        let reading = issued.lifecycle_reading(before, &intent.scene_ref)?;
        if super::super::bootstrap::fingerprint(before)? != registered.document_fingerprint
            || registered.completion.source()["original_request"]["action"] != "source_bootstrap"
            || reading != registered.completion.source()["original_request"]["input"]["scene"]
            || serde_json::to_value(&intent.authorship).map_err(|e| e.to_string())?
                != registered.completion.source()["original_request"]["input"]["authorship"]
        {
            return Err(
                "Retained definition issuer differs from actual no-write bootstrap/Document".into(),
            );
        }
        registered.issued_scene = Some(RegisteredDefinitionSceneRead { issued, intent });
        Ok(())
    }
    /// Account only the real same-owner installed-pending result. First batch
    /// remains wholly unmodified and pending; no receiving operation is applied.
    pub(crate) fn retain_prepared_definition(
        &mut self,
        application: &Application,
        before: &Document,
        pending: NativePendingDefinition,
        scene_owner: SceneOwner,
        completion: CompletedSourceIntake,
    ) -> Result<(), String> {
        completion.require_current(self)?;
        let work = application.procedural_receiving_work(before, &pending.source_producer_ref)?;
        let record = &completion.reply()["procedural"]["definition_receipt"];
        if pending.document_fingerprint != super::super::bootstrap::fingerprint(before)?
            || work.original_preparation() != &pending.original_preparation
            || work.source() != &pending.original_source
            || completion.source()["original_request"] != pending.command
            || completion.reply()["status"] != "ok"
            || completion.reply()["procedural"]["status"] != "installed_pending_material"
            || record["schema"] != "ql.native-procedural-definition-receipt/v1"
            || record["kind"] != "install_prepared"
            || record["definition"] != pending.command["input"]["definition"]
            || record["original_preparation"] != pending.original_preparation
            || record["source_bootstrap"] != pending.command["input"]["source_bootstrap"]
            || record["material_status"] != "pending_reception"
        {
            return Err(
                "Private initial definition result lost its original pending preparation".into(),
            );
        }
        let next = &record["definition"];
        // Charge complete actual pending/completion custody and both next
        // definition copies before taking the first material copy.
        crate::expression::procedural::bootstrap::preflight_source_message(&(
            completion.source(),
            completion.reply(),
            &pending.command,
            &pending.original_preparation,
            &pending.original_source,
            next,
            next,
        ))?;
        let lease = self
            .active
            .as_ref()
            .ok_or("Actual Source owner closed")?
            .lease
            .clone();
        self.check_procedural_definition_budget(&lease, next)?;
        let next = next.clone();
        let mut registered =
            RegisteredConsumers::from_bootstrap(application, before, scene_owner, completion)?;
        registered.continued_definition = Some(next.clone());
        if self
            .active
            .as_ref()
            .and_then(|owner| owner.registered_consumers.as_ref())
            .and_then(|old| old.issued_scene.as_ref())
            .is_none()
        {
            return Err("Initial definition lost actual Scene issuer custody".into());
        }
        self.retain_procedural_definition(&lease, next, registered.completion.reply())?;
        registered.issued_scene = self
            .active
            .as_mut()
            .ok_or("Actual Source owner closed")?
            .registered_consumers
            .as_mut()
            .and_then(|old| old.issued_scene.take());
        self.active
            .as_mut()
            .ok_or("Actual Source owner closed")?
            .registered_consumers = Some(registered);
        Ok(())
    }
}

impl crate::native_expression::Manager {
    /// One existing native C exchange over the retained opaque issuer. Root
    /// calls this only inside with_native_document_scene and retains the full
    /// returned channel result even if its outer Doc postcheck later refuses.
    pub(crate) fn procedural_registered_definition_scene_read(
        &mut self,
        lease: &str,
        reader: &crate::expression_procedural_scene_reader::NativeSceneSourceReader<'_>,
        request: Value,
    ) -> Result<
        Result<
            (Value, Value),
            crate::native_expression::native_scene_source::NativeSceneOperationRefusal,
        >,
        String,
    > {
        let registered = self
            .active
            .as_mut()
            .ok_or("Actual Source owner closed")?
            .registered_consumers
            .take()
            .ok_or("Current native Source roster absent")?;
        let result = (|| {
            registered.completion.require_current(self)?;
            let before = reader.document();
            let scene_ref = &reader.scene().scene_ref;
            registered
                .scene_owner
                .closed_constructor_fact(before, scene_ref)?;
            if super::super::bootstrap::fingerprint(before)? != registered.document_fingerprint
                || !matches!(
                    request["command"]["request"]["action"].as_str(),
                    Some("install_prepared" | "source_continue")
                )
            {
                return Err(
                    "Definition channel changed current complete Document or exact action".into(),
                );
            }
            let native = registered
                .issued_scene
                .as_ref()
                .ok_or("Original private Scene issuer absent")?;
            let actual = native.issued.lifecycle_reading(before, scene_ref)?;
            let bootstrap = &request["command"]["request"]["input"]["source_bootstrap"];
            if bootstrap["scene"] != actual || bootstrap["authorship"] != native.intent.authorship {
                return Err(
                    "Definition request changed original privately issued Source/authoring".into(),
                );
            }
            Ok(self.procedural_definition_scene_read(
                lease,
                reader,
                &native.issued,
                &native.intent,
                request,
            ))
        })();
        if let Some(owner) = self.active.as_mut() {
            owner.registered_consumers = Some(registered);
        }
        result
    }
}
