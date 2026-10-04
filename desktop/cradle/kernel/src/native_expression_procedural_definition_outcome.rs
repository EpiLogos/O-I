//! Actual original native delivery custody. This is not a deserializable
//! capability and no caller outcome, ACK or Source label can construct it.
use super::*;
use crate::expression::procedural::scene_receiver::SceneOwner;
use crate::expression::Document;
use crate::native_expression::procedural::conduct::Request;
use crate::native_expression::procedural::stage_library::SourceDeliveryCapture;
use sha2::{Digest, Sha256};

/// The exact normal serde wire is hashed without a complete Document Vec.
/// Stream charge precedes each hash update and bounds every actual byte.
fn document_digest<T: serde::Serialize + ?Sized>(document: &T) -> Result<String, String> {
    struct Writer {
        hash: Sha256,
        budget: crate::expression::procedural::budget::Budget,
    }
    impl std::io::Write for Writer {
        fn write(&mut self, bytes: &[u8]) -> std::io::Result<usize> {
            self.budget
                .reserve(bytes.len())
                .map_err(std::io::Error::other)?;
            self.hash.update(bytes);
            Ok(bytes.len())
        }
        fn flush(&mut self) -> std::io::Result<()> {
            Ok(())
        }
    }
    let mut writer = Writer {
        hash: Sha256::new(),
        budget: crate::expression::procedural::budget::Budget::new(),
    };
    serde_json::to_writer(&mut writer, document).map_err(|error| error.to_string())?;
    Ok(format!("{:x}", writer.hash.finalize()))
}

#[derive(Debug)]
pub(super) struct DeliveryAnchor {
    original: Request,
    document_sha256: String,
    scene_owner: SceneOwner,
    identity: Value,
    binding: Value,
    executable: PathBuf,
    native_field_epoch: String,
    ordinal: u64,
    resource: SourceDeliveryCapture,
}
#[derive(Debug)]
pub(super) struct DefinitionOutcome {
    // Moved directly from this original private Kernel delivery. Evidence only;
    // lookup cannot install a definition or reconstruct Source/clock authority.
    result: Value,
    // Rust drops fields in declaration order. Keep the original shared resource
    // alive until the complete terminal result and original context are gone.
    anchor: DeliveryAnchor,
}
impl DeliveryAnchor {
    pub(super) fn reply_limit(&self) -> usize {
        self.resource.reply_limit()
    }
    pub(super) fn copies(&mut self)->&mut SourceDeliveryCapture {&mut self.resource}
    fn receipt_valid(&self, result: &Value) -> Result<(), String> {
        let receipt = &result["native_receipt"];
        if result["schema"] != "oi.native-procedural-definition/v1"
            || result["original_intent"]
                != serde_json::to_value(&self.original).map_err(|e| e.to_string())?
            || result["original_request"] != self.original.request
            || result["captured_producer_ref"] != json!(self.original.source_producer_ref)
            || receipt["schema"] != "ql.field-host-receipt/v1"
            || receipt["available"] != true
            || !matches!(receipt["status"].as_str(), Some("ok" | "refused"))
            || receipt["instance_ref"] != self.identity["instance_ref"]
            || cursor(&receipt["request_id"])? != self.ordinal
            || cursor(&receipt["last_request_id"])? != self.ordinal
            || receipt["field"]["event_ref"] != self.identity["event_ref"]
            || receipt["field"]["subject_ref"] != self.identity["subject_ref"]
            || receipt["field"]["generation"] != self.original.request["expected_generation"]
            || receipt["field"]["samples_elapsed"]
                != self.original.request["expected_samples_elapsed"]
            || receipt["field"]["audio"] != json!([])
        {
            return Err(
                "Original definition has no complete unchanged-field native receipt".into(),
            );
        }
        Ok(())
    }
}
impl crate::Kernel {
    pub(in crate::native_expression) fn capture_current_native_definition_delivery(
        &mut self,
        input: &Request,
        scene_ref: &str,
    ) -> Result<DeliveryAnchor, String> {
        // Borrow the accepted actual Document; no full snapshot, input reading,
        // command or Prepared factory copy exists before this shared reservation.
        let before=self.expressions.procedural_source_borrow(
            &input.expression_ref,input.document_revision)?;
        let scene_owner = self.expressions.procedural_scene_owner(before, scene_ref)?;
        self.expressions
            .require_procedural_scene_owner(&scene_owner, before)?;
        let owner = self
            .native_expression
            .active
            .as_mut()
            .ok_or("Actual definition owner closed")?;
        let ordinal = cursor(&input.request["request_id"])?;
        if owner.lease != input.lease
            || owner.stopped
            || owner.process_exited()?
            || owner.last_request_id.checked_add(1) != Some(ordinal)
            || input.expression_ref != before.expression_ref
            || input.document_revision != before.revision
            || ["instance_ref", "event_ref", "subject_ref"]
                .iter()
                .any(|key| input.request[*key] != owner.identity[*key])
            || input.request["expected_generation"] != owner.procedural_position["generation"]
            || input.request["expected_samples_elapsed"]
                != owner.procedural_position["samples_elapsed"]
        {
            return Err(
                "Definition delivery changed original owner/ordinal/current native position".into(),
            );
        }
        // End the mutable owner borrow before the existing qualified Source
        // callback streams its complete original provenance and reply.
        let application=&self.expressions;
        let resource = self
            .native_expression
            .with_registered_source_context_owner(
                &self.expressions,
                before,
                scene_ref,
                |manager, source, provenance, reply, contract| {
                    let owner = manager
                        .active
                        .as_ref()
                        .ok_or("Actual definition owner closed")?;
                    let initial_work = input.source_producer_ref.as_deref()
                        .map(|producer| application.procedural_receiving_work(before, producer))
                        .transpose()?;
                    owner.stage_library_replays.reserve_source_delivery(&(
                        input,
                        input,
                        input,
                        before,before,
                        &input.request["command"]["request"],
                        &owner.identity,
                        &owner.procedural_source,
                        &owner.procedural_definitions,
                        source,source,
                        provenance,provenance,
                        reply,contract,
                        // The initial batch is a borrowed actual Runtime producer,
                        // not a caller or restored Source preparation.
                        initial_work.as_ref().map(|work|
                            (work.original_preparation(),work.source())),
                    ))
                },
            )?;
        let owner = self
            .native_expression
            .active
            .as_ref()
            .ok_or("Actual definition owner closed")?;
        let document_sha256 = document_digest(before)?;
        Ok(DeliveryAnchor {
            original: input.clone(),
            document_sha256,
            scene_owner,
            identity: owner.identity.clone(),
            binding: owner.procedural_source.clone(),
            executable: owner.procedural_executable.clone(),
            native_field_epoch: owner.native_field_epoch.clone(),
            ordinal,
            resource,
        })
    }
    pub(in crate::native_expression) fn retain_native_definition_outcome(
        &mut self,
        anchor: DeliveryAnchor,
        result: Value,
    ) -> Result<crate::KernelOpOutcome, String> {
        // Original result is moved into custody before any outward clone. If
        // qualification is refused it remains evidence of consumed delivery.
        // The same Manager owns this original evidence. A native post-channel
        // refusal may already have closed its Owner; still retain the whole
        // received outcome, with recovery_current false and no reconstruction.
        self.native_expression.definition_outcome = Some(DefinitionOutcome { anchor, result });
        let stored = self
            .native_expression
            .definition_outcome
            .as_mut()
            .ok_or("Original definition custody absent")?;
        stored
            .anchor
            .resource
            .settle_outcome(&stored.result, &stored.anchor.original)?;
        stored
            .anchor
            .resource
            .preflight_outward(&stored.result, &stored.result)?;
        let data = stored.result.clone();
        Ok(crate::KernelOpOutcome {
            receipts: Vec::new(),
            result: crate::KernelOpResult::NativeExpression { data },
        })
    }
    /// Identities-only readonly lookup. No native request, field read, ordinal,
    /// edit, clock, replay, schedule or consumer application occurs here.
    pub(crate) fn native_procedural_definition_retry(
        &mut self,
        original: Request,
    ) -> Result<Value, String> {
        let stored =
            self.native_expression.definition_outcome.as_ref().ok_or(
                "Original native definition outcome unavailable; delivery remains unknown",
            )?;
        if stored.anchor.original != original {
            return Err(
                "Definition lookup requires the complete exact original native intent".into(),
            );
        }
        let currentness = (|| -> Result<(), String> {
            let anchor = &stored.anchor;
            let owner = self
                .native_expression
                .active
                .as_ref()
                .ok_or("Original native definition owner closed")?;
            anchor.receipt_valid(&stored.result)?;
            if owner.lease != original.lease
                || owner.stopped
                || owner.process_exited()?
                || owner.identity != anchor.identity
                || owner.procedural_source != anchor.binding
                || owner.procedural_executable != anchor.executable
                || owner.native_field_epoch != anchor.native_field_epoch
                || owner.last_request_id != anchor.ordinal
                || owner.procedural_position["generation"]
                    != stored.result["native_receipt"]["field"]["generation"]
                || owner.procedural_position["samples_elapsed"]
                    != stored.result["native_receipt"]["field"]["samples_elapsed"]
            {
                return Err(
                    "Original native definition owner/position has advanced or closed".into(),
                );
            }
            let actual = self
                .expressions
                .procedural_source_borrow(&original.expression_ref, original.document_revision)?;
            if document_digest(actual)? != anchor.document_sha256 {
                return Err("Complete Document changed after original definition delivery".into());
            }
            self.expressions
                .require_procedural_scene_owner(&anchor.scene_owner, actual)
        })();
        #[derive(serde::Serialize)]
        struct Recovery<'a> {
            schema: &'static str,
            original_intent: &'a Request,
            found: bool,
            recovered: bool,
            replayed: bool,
            recovery_current: bool,
            recovery_currentness: &'a Option<String>,
            original_result: &'a Value,
            native_procedural_receipts: &'a [Value],
            consumer_release: &'static str,
        }
        let recovery_current = currentness.is_ok();
        let reason = currentness.err();
        let borrowed = Recovery {
            schema: "oi.native-procedural-definition-recovery/v1",
            original_intent: &original,
            found: true,
            recovered: true,
            replayed: false,
            recovery_current,
            recovery_currentness: &reason,
            original_result: &stored.result,
            native_procedural_receipts: &[],
            consumer_release: "unconfirmed",
        };
        stored
            .anchor
            .resource
            .preflight_outward(&stored.result, &borrowed)?;
        Ok(
            json!({"schema":"oi.native-procedural-definition-recovery/v1","original_intent":original,
            "found":true,"recovered":true,"replayed":false,"recovery_current":recovery_current,
            "recovery_currentness":reason,"original_result":stored.result,
            "native_procedural_receipts":[],"consumer_release":"unconfirmed"}),
        )
    }
}

#[cfg(test)]
mod digest_tests {
    use super::*;
    #[test]
    fn streamed_document_digest_matches_exact_existing_serde_wire() {
        let material = json!({"ref":"scene/native","parameters":{"radius":0.3},"presentations":["glyph","force"],"optional":null});
        let original_wire = serde_json::to_vec(&material).unwrap();
        assert_eq!(
            document_digest(&material).unwrap(),
            sha256_hex(&original_wire)
        );
        let mut changed = material.clone();
        changed["parameters"]["radius"] = json!(0.42);
        assert_ne!(
            document_digest(&material).unwrap(),
            document_digest(&changed).unwrap()
        );
        assert_eq!(material["parameters"]["radius"], json!(0.3));
    }
    #[test]
    fn streamed_document_digest_refuses_actual_overbound_wire() {
        let bytes = "x".repeat(crate::expression::procedural::budget::SOURCE_BYTES);
        assert!(document_digest(&bytes).is_err());
    }
}
