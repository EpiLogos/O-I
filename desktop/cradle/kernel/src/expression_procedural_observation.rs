//! Native receiving journals use the applied material revision. A subsequent
//! journal-only Document revision does not ask a physical consumer to apply
//! the same material again. Cold saved rows restore history, never this fence.
use super::*;

#[derive(Clone, Debug)]
pub(super) struct MaterialFence {
    pub(super) material_revision: u64,
    pub(super) journal_revision: u64,
}

fn equal_except(left: &Value, right: &Value, omitted: &str) -> bool {
    match (left.as_object(), right.as_object()) {
        (Some(left), Some(right)) => {
            left.iter()
                .filter(|(key, _)| key.as_str() != omitted)
                .count()
                == right
                    .iter()
                    .filter(|(key, _)| key.as_str() != omitted)
                    .count()
                && left
                    .iter()
                    .filter(|(key, _)| key.as_str() != omitted)
                    .all(|(key, value)| right.get(key) == Some(value))
        }
        _ => left == right,
    }
}

/// Compare borrowed actual presentations; no complete Scene is cloned to
/// decide whether a native journal write also changes authored material.
pub(super) fn journal_only(document: &Document, changes: &[Change]) -> bool {
    !changes.is_empty()
        && changes.iter().all(|change| {
            let Change::SceneMaterialSet {
                scene_ref,
                presentation,
            } = change
            else {
                return false;
            };
            let Some(current) = document
                .scenes
                .iter()
                .find(|s| &s.scene_ref == scene_ref)
                .and_then(|s| s.presentation.as_ref())
            else {
                return false;
            };
            current.schema == presentation.schema
                && current.saved == presentation.saved
                && equal_except(&current.scene, &presentation.scene, "procedural")
                && equal_except(
                    &current.scene["procedural"],
                    &presentation.scene["procedural"],
                    "operations",
                )
        })
}

impl Runtime {
    pub(super) fn advance_journal_fences(&mut self, expression_ref: &str, from: u64, to: u64) {
        for (operation_ref, fence) in &mut self.material_fences {
            if fence.journal_revision == from
                && self
                    .operations
                    .get(operation_ref)
                    .is_some_and(|op| op.envelope.expression_ref == expression_ref)
            {
                fence.journal_revision = to;
            }
        }
    }
    pub(super) fn current_material(&self, document: &Document, operation: &Operation) -> bool {
        !self.restored.contains(&operation.envelope.operation_ref)
            && self
                .material_fences
                .get(&operation.envelope.operation_ref)
                .is_some_and(|fence| {
                    fence.journal_revision == document.revision
                        && Some(fence.material_revision) == operation.applied_revision
                })
    }
}

impl Application {
    /// The actual registered owner invokes this outside its real-time audio
    /// or render callback. There is no caller JSON observation request.
    pub fn procedural_observe_from_owner(
        &mut self,
        client: &CentralClient,
        observation: ConsumerObservation,
    ) -> Result<(Value, Option<Changed>), String> {
        let original = self
            .procedural_runtime
            .inspect(&observation.operation_ref)?;
        let before = self.document(&original.envelope.expression_ref)?;
        if !self.procedural_runtime.current_material(before, original) {
            return Err("Native observation has no current original material revision".into());
        }
        let mut bounded = budget::Budget::new();
        bounded.value(original)?;
        bounded.value(&observation)?;
        // Completion records the first actual application, rather than a
        // high-rate stream of subsequent body/render readings. Native Inspect
        // owns those live readings. Exact delivery retries remain idempotent.
        let completed = original.status == Status::Applied;
        let delivered = original.observations.iter().find(|stored| {
            stored.owner == observation.owner && stored.instance_ref == observation.instance_ref
        });
        if delivered.is_some_and(|stored| stored != &observation) {
            return Err("Consumer application retains its first receiving receipt while its counterparts settle; later state is read through native Inspect".into());
        }
        if completed && delivered.is_none() {
            return Err("Completed application retains its first receiving receipts; later state is read through native Inspect".into());
        }
        let operation_ref = observation.operation_ref.clone();
        let received = if delivered.is_some() {
            Ok(original.clone())
        } else {
            self.procedural_runtime
                .observe_from_owner(observation.clone())
        };
        let observed = match received {
            Ok(observed) => observed,
            Err(error) => {
                // An exhausted delta cursor can refuse publication after the
                // real ACK has entered the runtime. Retain that ACK on return.
                let actual = self.procedural_runtime.inspect(&operation_ref)?;
                if actual
                    .observations
                    .iter()
                    .any(|stored| stored == &observation)
                {
                    return Ok((
                        json!({"schema":SCHEMA,"state":"reconciliation_required",
                        "operation":actual,"reason":error,
                        "durability":"live_native_until_file_save"}),
                        None,
                    ));
                }
                return Err(error);
            }
        };
        if observed.status != Status::Applied {
            return Ok((
                json!({"schema":SCHEMA,"operation":observed,
                "durability":"live_native_until_file_save"}),
                None,
            ));
        }
        // Every failure after reception returns the original completed ACK;
        // journal preparation, serialization and edit failures cannot erase it.
        let staged = (|| -> Result<(_, _, _), String> {
            let document = self.document(&observed.envelope.expression_ref)?;
            let stored: Operation = serde_json::from_value(
                journal(document)?
                    .get(&observed.envelope.operation_ref)
                    .ok_or("Actual native observation journal absent")?
                    .clone(),
            )
            .map_err(|e| e.to_string())?;
            let changes = retain_operation_changes(document, vec![], &observed)?;
            if !journal_only(document, &changes) {
                return Err("Native observation journal changed actual authored material".into());
            }
            Ok((document.revision, stored, changes))
        })();
        let (revision, stored, changes) = match staged {
            Ok(staged) => staged,
            Err(error) => {
                return Ok((
                    json!({"schema":SCHEMA,"state":"reconciliation_required",
                "operation":observed,"reason":error,
                "durability":"live_native_until_file_save"}),
                    None,
                ));
            }
        };
        if stored == observed {
            return Ok((
                json!({"schema":SCHEMA,"operation":observed,
                "document_revision":revision,"replayed":true,
                "durability":"native_document_until_file_save"}),
                None,
            ));
        }
        let result = self.procedural_edit(
            client,
            observed.envelope.expression_ref.clone(),
            revision,
            observed.envelope.actor.clone(),
            changes,
        );
        match result {
            Ok((receipt, changed)) if receipt["state"] != "revision_conflict" => Ok((
                json!({"schema":SCHEMA,"operation":observed,"document_receipt":receipt,
                    "material_revision":observed.applied_revision,"durability":"native_document_until_file_save"}),
                changed,
            )),
            Ok((receipt, _)) => Ok((
                json!({"schema":SCHEMA,"state":"reconciliation_required",
                "operation":observed,"document_receipt":receipt,"reason":"Native final observation journal CAS conflict"}),
                None,
            )),
            Err(error) => Ok((
                json!({"schema":SCHEMA,"state":"reconciliation_required",
                "operation":observed,"reason":error,"durability":"live_native_until_file_save"}),
                None,
            )),
        }
    }
}
