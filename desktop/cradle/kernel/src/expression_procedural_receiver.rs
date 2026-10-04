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
    /// Charge the complete repeated counterpart wire with the SAME native S
    /// writer before the actual receiving factory copies any target array.
    pub(crate) fn preflight_counterparts<P: Serialize + ?Sized, T: Serialize + ?Sized>(
        &self,
        before: &Document,
        participants: &P,
        timing: &T,
    ) -> Result<(), String> {
        let prepared = self.original_preparation();
        let mut borrowed = budget::Budget::new();
        borrowed.reserve(4096)?;
        borrowed.value(&prepared["operation_ref"])?;
        borrowed.value(&prepared["native_edit"]["actor"])?;
        borrowed.value(&before.expression_ref)?;
        borrowed.value(&self.producer.producer_ref)?;
        borrowed.value(&self.producer.targets)?;
        borrowed.value(&self.producer.changes)?;
        borrowed.value(&prepared["output_readings"])?;
        borrowed.value(participants)?;
        borrowed.value(timing)?;
        for key in ["recipe", "profile"] {
            borrowed.value(&prepared["original_procedure"][key]["source_ref"])?;
            borrowed.value(&prepared["original_procedure"][key]["revision"])?;
        }
        Ok(())
    }

    /// SAME native target resolution used by normal preparation, including
    /// current owned outputs when original selector membership remains empty.
    pub(crate) fn resolved_targets(
        &self,
        application: &Application,
        before: &Document,
    ) -> Result<Vec<Address>, String> {
        if application.document(&before.expression_ref)? != before {
            return Err("revision_conflict".into());
        }
        let actual = application
            .procedural_runtime
            .producers
            .get(&self.producer.producer_ref)
            .ok_or("Actual receiving producer expired")?;
        if !std::ptr::eq(actual, self.producer) {
            return Err("Receiving work is not borrowed from this actual Application".into());
        }
        let readings: Vec<Value> =
            serde_json::from_value(self.producer.prepared["output_readings"].clone())
                .map_err(|error| error.to_string())?;
        application.procedural_runtime.resolve_receiving_targets(
            before,
            &Scope::Addresses {
                addresses: self.producer.targets.clone(),
            },
            Some(&self.producer.producer_ref),
            &readings,
        )
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

impl Runtime {
    /// Canonical native selector/output resolution. This is factored from
    /// check_preparation; it never edits the original Envelope or selector.
    pub(super) fn resolve_receiving_targets(
        &self,
        document: &Document,
        scope: &Scope,
        producer_ref: Option<&str>,
        output_readings: &[Value],
    ) -> Result<Vec<Address>, String> {
        let producer = producer_ref
            .map(|reference| {
                self.producers
                    .get(reference)
                    .ok_or("Actual native receiving producer absent")
            })
            .transpose()?;
        let mut targets = if matches!(scope, Scope::Addresses { addresses } if addresses.is_empty())
            && producer.is_some_and(|p| p.targets.is_empty())
        {
            Vec::new()
        } else {
            resolve(document, scope)?
        };
        if let Some(producer) = producer {
            targets.extend(producer.outputs.iter().cloned());
        }
        if output_readings.len() > MAX_TARGETS {
            return Err("Output reading budget exceeded".into());
        }
        let mut capability_ids = BTreeSet::new();
        for reading in output_readings {
            let procedure_ref = retained_text(reading, "procedure_ref")?;
            let contribution_ref = retained_text(reading, "contribution_ref")?;
            if !capability_ids.insert(contribution_ref.to_owned()) {
                return Err("Duplicate owned output capability".into());
            }
            let actual = self.output_readings(document, procedure_ref)?;
            if !actual.iter().any(|r| r == reading) {
                return Err("Owned output capability is stale, foreign or differs from the actual native journal/material/source".into());
            }
            let owned: Vec<Address> = serde_json::from_value(reading["owned_addresses"].clone())
                .map_err(|e| e.to_string())?;
            for target in owned {
                targets.push(canonical_address(document, &target)?);
            }
        }
        targets.sort();
        targets.dedup();
        if targets.len() > MAX_TARGETS {
            return Err("Resolved owned scope exceeds native cardinality".into());
        }
        if targets.is_empty() {
            return Err("Scope deliberately resolves to no targets".into());
        }
        Ok(targets)
    }
}

#[cfg(test)]
mod receiving_target_tests {
    use super::*;

    fn actual_document(reference: &str) -> (Application, Document) {
        let client = CentralClient::discover();
        let mut application = Application::default();
        let (created, changed) = application
            .apply(
                &client,
                ExpressionRequest::Create {
                    expression_ref: reference.into(),
                    title: "Native receiving targets".into(),
                    actor: "human:receiving-target-test".into(),
                },
            )
            .unwrap();
        assert_eq!(created["state"], "ready");
        assert!(changed.is_some());
        let document = application.document(reference).unwrap().clone();
        document.validate().unwrap();
        (application, document)
    }

    #[test]
    fn real_native_document_scopes_keep_exact_current_addresses() {
        let (application, document) = actual_document("expression:receiving-real-addresses");
        let runtime = Runtime::default();
        let target = address(
            &document,
            Some(&document.scenes[0].scene_ref),
            None,
            Component::Scene,
        );
        let scope = Scope::Addresses {
            addresses: vec![target.clone()],
        };
        assert_eq!(
            runtime
                .resolve_receiving_targets(&document, &scope, None, &[])
                .unwrap(),
            vec![target]
        );
        assert_eq!(
            application.document(&document.expression_ref).unwrap(),
            &document
        );
        assert!(runtime.operations.is_empty());
    }

    #[test]
    fn foreign_native_address_refuses_without_altering_actual_document() {
        let (application, document) = actual_document("expression:receiving-wrong-address");
        let runtime = Runtime::default();
        let mut target = address(
            &document,
            Some(&document.scenes[0].scene_ref),
            None,
            Component::Scene,
        );
        target.expression_ref = "expression:foreign-receiving".into();
        assert!(runtime
            .resolve_receiving_targets(
                &document,
                &Scope::Addresses {
                    addresses: vec![target]
                },
                None,
                &[]
            )
            .is_err());
        assert_eq!(
            application.document(&document.expression_ref).unwrap(),
            &document
        );
        assert!(runtime.operations.is_empty());
    }

    #[test]
    fn empty_scope_or_imported_capability_never_creates_warm_producer_authority() {
        let (application, document) = actual_document("expression:receiving-empty-owned");
        let runtime = Runtime::default();
        let scope = Scope::Addresses { addresses: vec![] };
        assert!(runtime
            .resolve_receiving_targets(&document, &scope, None, &[])
            .is_err());
        assert!(runtime
            .resolve_receiving_targets(&document, &scope, Some("copied-producer-ref"), &[])
            .is_err());
        let reading = json!({"procedure_ref":"copied-procedure","contribution_ref":"copied-output","owned_addresses":[]});
        assert!(runtime
            .resolve_receiving_targets(&document, &Scope::Expression, None, &[reading])
            .is_err());
        assert_eq!(
            application.document(&document.expression_ref).unwrap(),
            &document
        );
        assert!(runtime.producers.is_empty());
        assert!(runtime.operations.is_empty());
    }
}
