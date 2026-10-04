//! Authored Continue of an actual retained performance Act into its current
//! Scene. The reader and Scene constructor remain live through the operation.
//! A request names addresses/CAS; it supplies no checkpoint or native receipt.
use super::recording::NativeSceneRecordingCommit;
use super::recording_channel::NativeCurrentRecordingRefusal;
use crate::expression::{Change, Request};
use crate::expression_performance_delivery::Selection;
use crate::expression_procedural_scene_reader::NativeDocumentSceneReader;

pub(crate) struct CurrentSceneContinueActIntent<'a> {
    pub lease: &'a str,
    pub expression_ref: &'a str,
    pub document_revision: u64,
    pub scene_ref: &'a str,
    pub scene_revision: u64,
    pub actor: &'a str,
    pub act_ref: &'a str,
    pub selection: Selection,
    pub checkpoint_index: usize,
    pub transaction_ref: &'a str,
}

impl crate::Kernel {
    pub(crate) fn continue_current_native_scene_act(
        &mut self,
        input: CurrentSceneContinueActIntent<'_>,
    ) -> Result<NativeSceneRecordingCommit, NativeCurrentRecordingRefusal> {
        for text in [input.actor, input.act_ref, input.transaction_ref] {
            crate::expression::text(text)?;
        }
        let before = self
            .expressions
            .procedural_source_snapshot(input.expression_ref, input.document_revision)?;
        let owner = self
            .expressions
            .procedural_scene_owner(&before, input.scene_ref)?;
        let scene_reader = NativeDocumentSceneReader::from_native_scene_owner(
            &self.expressions,
            &owner,
            before,
            input.scene_ref,
            input.scene_revision,
        )?;
        self.expressions
            .require_procedural_scene_owner(&owner, scene_reader.document())?;
        let current_scene = scene_reader
            .document()
            .scenes
            .iter()
            .find(|scene| scene.scene_ref == input.scene_ref)
            .ok_or("actual current continuation Scene absent")?;
        let current_performance = current_scene
            .performance
            .as_ref()
            .ok_or("actual current Scene has no saved native performance")?;
        current_performance.validate()?;
        if input.selection.scene_ref != input.scene_ref
            || input.selection.performance_digest != current_performance.fingerprint()?
        {
            return Err("Continue names another selected native Scene/performance".into());
        }

        // Keep the native channel outside the closure BEFORE any post-store
        // check. An external ActStore/Doc CAS refusal cannot drop received
        // numerical ACKs, feedback or diagnostic receipt files.
        let mut execution = None;
        let mut channel_refusal = None;
        let checked = self.with_native_act_delivery_manager(
            input.act_ref,
            &input.selection,
            |manager, reader| {
                if reader.document() != scene_reader.document()
                    || reader.scene().scene_ref != input.scene_ref
                    || reader.performance() != current_performance
                {
                    return Err(
                        "current Scene differs from the complete actual selected Act edition"
                            .into(),
                    );
                }
                let received = match manager.readmit_native_act_checkpoint(
                    input.lease,
                    reader,
                    input.document_revision,
                    input.checkpoint_index,
                    input.transaction_ref,
                    input.actor,
                ) {
                    Ok(received) => received,
                    Err(refusal) => {
                        let reason = refusal.reason().to_owned();
                        channel_refusal = Some(refusal);
                        return Err(reason);
                    }
                };
                execution = Some(received);
                Ok(())
            },
        );
        let execution = match execution {
            Some(received) => received,
            None => {
                if let Some(refusal) = channel_refusal {
                    return Err(refusal);
                }
                return Err(checked
                    .err()
                    .unwrap_or_else(|| {
                        "Continue produced no original selected native channel".into()
                    })
                    .into());
            }
        };
        let (prospective, native_error, original_channel) = execution.into_parts();
        let application = (|| -> Result<Option<crate::KernelOpOutcome>, String> {
            checked?;
            if let Some(reason) = native_error {
                return Err(reason);
            }
            let prospective = prospective
                .as_ref()
                .ok_or("native Continue did not produce an exact retained continuation")?;
            self.expressions
                .require_procedural_scene_owner(&owner, scene_reader.document())?;
            self.apply(crate::KernelOp::Expression {
                request: Request::Edit {
                    expression_ref: input.expression_ref.into(),
                    expected_revision: input.document_revision,
                    actor: input.actor.into(),
                    changes: vec![Change::ScenePerformanceSet {
                        scene_ref: input.scene_ref.into(),
                        performance: prospective.clone(),
                    }],
                },
            })
            .map(Some)
        })();
        let currentness = (|| -> Result<(), String> {
            application.as_ref().map_err(Clone::clone)?;
            let revision = input
                .document_revision
                .checked_add(1)
                .ok_or("Continue Document revision exhausted")?;
            let after = self
                .expressions
                .procedural_source_snapshot(input.expression_ref, revision)?;
            let scene = after
                .scenes
                .iter()
                .find(|scene| scene.scene_ref == input.scene_ref)
                .ok_or("continued Scene disappeared after ordinary native edit")?;
            if scene.performance.as_ref() != prospective.as_ref() {
                return Err(
                    "ordinary native edit did not retain the entire real continuation".into(),
                );
            }
            let after_owner = self
                .expressions
                .procedural_scene_owner(&after, input.scene_ref)?;
            self.expressions
                .require_procedural_scene_owner(&after_owner, &after)?;
            if after_owner.instance_ref() != owner.instance_ref()
                || after_owner.construction_generation() != owner.construction_generation()
                || after_owner.generation_domain() != owner.generation_domain()
            {
                return Err("Continue changed the actual original Scene constructor".into());
            }
            Ok(())
        })();
        Ok(NativeSceneRecordingCommit::from_native_continuation(
            application,
            currentness,
            original_channel,
        ))
    }
}

#[cfg(test)]
#[path = "native_expression_scene_continuation_tests.rs"]
pub(super) mod tests;
