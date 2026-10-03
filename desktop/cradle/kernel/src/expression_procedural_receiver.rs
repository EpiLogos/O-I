//! Project an actual sealed producer into the normal receiving operation.
//! The native owner supplies registered counterpart facts; no public request
//! supplies a boundary capability or an observation.
use super::*;

/// Borrowed only from the actual warm Source admission at its original CAS.
/// The resident native factory resolves these exact targets and source node
/// correspondence before it constructs a ReceivingBoundary. No wire grants it.
pub(crate) struct ReceivingWork<'a> {
    producer: &'a ProducerAdmission,
}
impl ReceivingWork<'_> {
    pub(crate) fn original_preparation(&self) -> &Value {
        &self.producer.prepared
    }
    pub(crate) fn source(&self) -> &Value {
        &self.producer.source
    }
    pub(crate) fn existing_targets(&self) -> &[Address] {
        &self.producer.targets
    }
    pub(crate) fn produced_targets(&self) -> &[Address] {
        &self.producer.outputs
    }
    pub(crate) fn changes(&self) -> &[Change] {
        &self.producer.changes
    }
    pub(crate) fn original_native_position(&self) -> Option<&Value> {
        self.producer.lifecycle_position.as_ref()
    }
}

impl Application {
    pub(crate) fn procedural_receiving_work<'a>(
        &'a self,
        before: &Document,
        producer_ref: &str,
    ) -> Result<ReceivingWork<'a>, String> {
        if self.document(&before.expression_ref)? != before {
            return Err("revision_conflict".into());
        }
        let producer = self
            .procedural_runtime
            .producers
            .get(producer_ref)
            .ok_or("Registered native receiving requires its actual warm Source admission")?;
        if producer.expression_ref != before.expression_ref
            || producer.document_revision != before.revision
        {
            return Err("Native receiving work has another original Document/CAS".into());
        }
        let mut bounded = budget::Budget::new();
        bounded.value(&producer.prepared)?;
        bounded.value(&producer.source)?;
        bounded.value(&producer.targets)?;
        bounded.value(&producer.outputs)?;
        bounded.value(&producer.changes)?;
        Ok(ReceivingWork { producer })
    }
    pub(crate) fn procedural_receiving_envelope(
        &self,
        before: &Document,
        producer_ref: &str,
        boundary: &crate::native_expression::procedural::lifecycle::ReceivingBoundary,
    ) -> Result<Envelope, String> {
        if self.document(&before.expression_ref)? != before {
            return Err("revision_conflict".into());
        }
        let producer = self
            .procedural_runtime
            .producers
            .get(producer_ref)
            .ok_or("Normal receiving requires its actual current sealed producer")?;
        if producer.expression_ref != before.expression_ref
            || producer.document_revision != before.revision
            || boundary.expression_ref() != before.expression_ref
            || boundary.document_revision() != before.revision
        {
            return Err(
                "Registered native receiving boundary has another actual producer Document".into(),
            );
        }
        let prepared = &producer.prepared;
        let expected: BTreeSet<_> = prepared["required_consumers"]
            .as_array()
            .ok_or("Actual native producer consumer contract absent")?
            .iter()
            .map(|row| {
                row.as_str()
                    .ok_or("Invalid actual native required consumer")
            })
            .collect::<Result<_, _>>()?;
        let actual: BTreeSet<_> = boundary
            .participants()
            .iter()
            .map(|p| p.owner.as_str())
            .collect();
        if expected != actual || actual.is_empty() || boundary.participants().len() > 16 {
            return Err(
                "Registered native counterparts differ from the actual complete producer consumers"
                    .into(),
            );
        }
        if !matches!(boundary.timing(), Timing::OwnerBoundary{owner,cursor,..}
            if prepared["timing"]["owner_ref"] == *owner
                && prepared["timing"]["requested_cursor"].as_u64() == Some(*cursor))
        {
            return Err(
                "Registered receiving boundary differs from the actual native timing owner/cursor"
                    .into(),
            );
        }
        // Count and stream every borrowed receiver field before copying any
        // native target arrays or prepared material into the wire envelope.
        if boundary
            .participants()
            .iter()
            .any(|p| p.targets.len() > MAX_TARGETS)
        {
            return Err(
                "Registered native consumer target bound exceeded before allocation".into(),
            );
        }
        let mut borrowed = budget::Budget::new();
        borrowed.reserve(4096)?;
        borrowed.value(&prepared["operation_ref"])?;
        borrowed.value(&prepared["native_edit"]["actor"])?;
        borrowed.value(&before.expression_ref)?;
        borrowed.value(producer_ref)?;
        borrowed.value(&producer.targets)?;
        borrowed.value(&producer.changes)?;
        borrowed.value(&prepared["output_readings"])?;
        borrowed.value(boundary.participants())?;
        borrowed.value(boundary.timing())?;
        for key in ["recipe", "profile"] {
            borrowed.value(&prepared["original_procedure"][key]["source_ref"])?;
            borrowed.value(&prepared["original_procedure"][key]["revision"])?;
        }
        let mut sources = Vec::new();
        for key in ["recipe", "profile"] {
            let original = &prepared["original_procedure"][key];
            let reading: ReadingRef = serde_json::from_value(json!({"ref":original["source_ref"],
                "revision":original["revision"],"availability":"available"}))
            .map_err(|e| e.to_string())?;
            super::super::readings(std::slice::from_ref(&reading))?;
            if !sources.contains(&reading) {
                sources.push(reading);
            }
        }
        let envelope = Envelope {
            operation_ref: retained_text(prepared, "operation_ref")?.to_owned(),
            expression_ref: before.expression_ref.clone(),
            expected_revision: before.revision,
            actor: retained_text(&prepared["native_edit"], "actor")?.to_owned(),
            scope: Scope::Addresses {
                addresses: producer.targets.clone(),
            },
            sources,
            changes: producer.changes.clone(),
            participants: boundary.participants().to_vec(),
            timing: boundary.timing().clone(),
            cause_ref: None,
            output_readings: serde_json::from_value(prepared["output_readings"].clone())
                .map_err(|e| e.to_string())?,
            producer_ref: Some(producer_ref.to_owned()),
        };
        let mut bounded = budget::Budget::new();
        bounded.value(&envelope)?;
        // Exercise the normal, complete receiving validator without retaining
        // a preparation or changing the actual Document.
        self.procedural_runtime
            .check_preparation(before, envelope.clone())?;
        Ok(envelope)
    }
}
