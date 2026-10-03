//! The actual native Document owner is the Scene material consumer. Its
//! constructor lifetime is separate from a Window, sampler, Source or clock.
//! Only ordinary open/close and the original successful Edit can issue facts.
use super::*;
use std::sync::{
    Arc,
    atomic::{AtomicBool, AtomicU64, Ordering},
};

static NEXT_CONSTRUCTION: AtomicU64 = AtomicU64::new(1);
const DOMAIN: &str = "native-document-scene-construction";

#[derive(Debug)]
struct Lifetime {
    expression_ref: String,
    instance_ref: String,
    construction_generation: u64,
    initial_document_revision: u64,
    initial_document_sha256: String,
    live: AtomicBool,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create(app: &mut Application, reference: &str) -> Document {
        let client = CentralClient::discover();
        let request =
            serde_json::from_value(json!({"operation":"create","expression_ref":reference,
            "title":"Native Scene constructor test","actor":"human:scene-owner-test"}))
            .unwrap();
        let (_, changed) = app.apply(&client, request).unwrap();
        assert!(changed.is_some());
        app.document(reference).unwrap().clone()
    }

    #[test]
    fn actual_open_constructs_once_and_reads_never_mint_application_receipts() {
        let mut app = Application::default();
        let document = create(&mut app, "expression:actual-scene-constructor");
        let scene_ref = &document.scenes[0].scene_ref;
        let first = app.procedural_scene_owner(&document, scene_ref).unwrap();
        let second = app.procedural_scene_owner(&document, scene_ref).unwrap();
        assert_eq!(first.instance_ref(), second.instance_ref());
        assert_eq!(
            first.construction_generation(),
            second.construction_generation()
        );
        assert_eq!(first.generation_domain(), DOMAIN);
        assert!(first.construction_generation() > 0);
        app.require_procedural_scene_owner(&first, &document)
            .unwrap();
        assert!(app.procedural_runtime.operations.is_empty());
        assert!(app.procedural_runtime.producers.is_empty());
        assert!(
            app.procedural_scene_owner(&document, "absent-native-scene")
                .is_err()
        );
        assert!(app.procedural_runtime.operations.is_empty());
    }

    #[test]
    fn actual_edit_preserves_constructor_and_invalidates_original_document_read() {
        let client = CentralClient::discover();
        let mut app = Application::default();
        let before = create(&mut app, "expression:actual-scene-edition");
        let owner = app
            .procedural_scene_owner(&before, &before.scenes[0].scene_ref)
            .unwrap();
        let (receipt, changed) = app
            .apply(
                &client,
                ExpressionRequest::Edit {
                    expression_ref: before.expression_ref.clone(),
                    expected_revision: before.revision,
                    actor: "agent:actual-scene-edit".into(),
                    changes: vec![Change::Rename {
                        title: "Changed actual native document".into(),
                    }],
                },
            )
            .unwrap();
        let changed = changed.unwrap();
        let after = app.document(&before.expression_ref).unwrap();
        assert_eq!(changed.revision, before.revision + 1);
        assert_eq!(receipt["document"]["revision"], after.revision);
        assert!(app.require_procedural_scene_owner(&owner, &before).is_err());
        let current = app
            .procedural_scene_owner(after, &after.scenes[0].scene_ref)
            .unwrap();
        assert_eq!(owner.instance_ref(), current.instance_ref());
        assert_eq!(
            owner.construction_generation(),
            current.construction_generation()
        );
        app.require_procedural_scene_owner(&current, after).unwrap();
        assert!(
            owner
                .closed_constructor_fact(after, &after.scenes[0].scene_ref)
                .is_err()
        );
        assert_eq!(
            current
                .closed_constructor_fact(after, &after.scenes[0].scene_ref)
                .unwrap(),
            current.constructor_fact()
        );
        assert!(
            current
                .closed_constructor_fact(after, "wrong-native-scene")
                .is_err()
        );
        assert!(app.procedural_runtime.operations.is_empty());
    }

    #[test]
    fn copied_document_and_dirty_close_do_not_transfer_constructor_authority() {
        let client = CentralClient::discover();
        let mut first = Application::default();
        let document = create(&mut first, "expression:actual-scene-independent-owner");
        let original = first
            .procedural_scene_owner(&document, &document.scenes[0].scene_ref)
            .unwrap();
        let mut second = Application::default();
        let request = serde_json::from_value(json!({"operation":"open","document":document,
            "actor":"agent:actual-scene-other-application"}))
        .unwrap();
        let (_, changed) = second.apply(&client, request).unwrap();
        assert!(changed.is_some());
        let copied = second
            .procedural_scene_owner(&document, &document.scenes[0].scene_ref)
            .unwrap();
        assert_ne!(original.instance_ref(), copied.instance_ref());
        assert_ne!(
            original.construction_generation(),
            copied.construction_generation()
        );
        assert!(
            second
                .require_procedural_scene_owner(&original, &document)
                .is_err()
        );
        let (receipt, changed) = first
            .apply(
                &client,
                ExpressionRequest::Close {
                    expression_ref: document.expression_ref.clone(),
                    actor: "human:actual-scene-close".into(),
                },
            )
            .unwrap();
        assert_eq!(receipt["state"], "dirty");
        assert!(changed.is_none());
        first
            .require_procedural_scene_owner(&original, &document)
            .unwrap();
    }

    #[test]
    fn borrowed_original_edit_fingerprint_is_the_real_native_edit_abi() {
        let mut app = Application::default();
        let document = create(&mut app, "expression:actual-scene-edit-abi");
        let changes = vec![Change::SceneRename {
            scene_ref: document.scenes[0].scene_ref.clone(),
            title: "Native Scene edition".into(),
        }];
        let borrowed = OriginalEdit {
            operation: "edit",
            expression_ref: &document.expression_ref,
            expected_revision: document.revision,
            actor: "human:real-native-abi",
            changes: &changes,
        };
        let ordinary = ExpressionRequest::Edit {
            expression_ref: document.expression_ref.clone(),
            expected_revision: document.revision,
            actor: "human:real-native-abi".into(),
            changes: changes.clone(),
        };
        assert_eq!(
            serde_json::to_value(&borrowed).unwrap(),
            serde_json::to_value(&ordinary).unwrap()
        );
        assert_eq!(
            crate::native_expression::procedural::bootstrap::fingerprint(&borrowed).unwrap(),
            crate::native_expression::procedural::bootstrap::fingerprint(&ordinary).unwrap()
        );
    }
}

#[derive(Clone, Debug, Default)]
pub(super) struct Registry {
    owners: BTreeMap<String, Arc<Lifetime>>,
}

/// Prepared before insertion; the Document is not a consumer until the
/// actual Application::open has inserted its original native document.
pub(in crate::expression) struct PendingOpen(Arc<Lifetime>);

/// A private current native construction/read pairing, never a JSON grant.
#[derive(Clone, Debug)]
pub(crate) struct SceneOwner {
    lifetime: Arc<Lifetime>,
    scene_ref: String,
    document_revision: u64,
    document_sha256: String,
}
impl SceneOwner {
    pub(crate) fn instance_ref(&self) -> &str {
        &self.lifetime.instance_ref
    }
    pub(crate) fn construction_generation(&self) -> u64 {
        self.lifetime.construction_generation
    }
    pub(crate) fn generation_domain(&self) -> &str {
        DOMAIN
    }
    pub(crate) fn closed_constructor_fact(
        &self,
        document: &Document,
        scene_ref: &str,
    ) -> Result<Value, String> {
        if !self.lifetime.live.load(Ordering::Acquire)
            || document.expression_ref != self.lifetime.expression_ref
            || document.revision != self.document_revision
            || crate::native_expression::procedural::bootstrap::fingerprint(document)?
                != self.document_sha256
            || scene_ref != self.scene_ref
            || !document
                .scenes
                .iter()
                .any(|scene| scene.scene_ref == scene_ref)
        {
            return Err("Native Scene constructor is retired or differs from this full closed Document/Scene".into());
        }
        Ok(self.constructor_fact())
    }

    pub(crate) fn constructor_fact(&self) -> Value {
        json!({"schema":"oi.native-document-scene-constructor/v1",
            "expression_ref":self.lifetime.expression_ref,"scene_ref":self.scene_ref,
            "instance_ref":self.instance_ref(),"construction_generation":self.construction_generation(),
            "generation_domain":DOMAIN,"initial_document_revision":self.lifetime.initial_document_revision,
            "initial_document_sha256":self.lifetime.initial_document_sha256,
            "document_revision":self.document_revision,"document_sha256":self.document_sha256})
    }
}

/// Prepared from the real registered owner, original operation and actual
/// admitted timing boundary. It has no Deserialize or public constructor.
pub(super) struct EditTicket {
    lifetime: Arc<Lifetime>,
    operation_ref: String,
    actor: String,
    before_revision: u64,
    after_revision: u64,
    before_sha256: String,
    after_sha256: String,
    edit_sha256: String,
    targets: Vec<Address>,
    timing_owner: String,
    timing_instance_ref: String,
    requested_cursor: u64,
    actual_cursor: u64,
}

#[derive(Serialize)]
struct OriginalEdit<'a> {
    operation: &'static str,
    expression_ref: &'a str,
    expected_revision: u64,
    actor: &'a str,
    changes: &'a [Change],
}

impl Registry {
    pub(super) fn retire(&mut self, expression_ref: &str) {
        if let Some(owner) = self.owners.remove(expression_ref) {
            owner.live.store(false, Ordering::Release);
        }
    }
    fn current(&self, owner: &Arc<Lifetime>) -> Result<(), String> {
        if !owner.live.load(Ordering::Acquire)
            || !self
                .owners
                .get(&owner.expression_ref)
                .is_some_and(|current| Arc::ptr_eq(current, owner))
        {
            return Err("Native Scene material consumer lifetime is no longer current".into());
        }
        Ok(())
    }
}

impl Application {
    pub(in crate::expression) fn prepare_native_scene_open(
        &self,
        document: &Document,
    ) -> Result<PendingOpen, String> {
        if self.documents.contains_key(&document.expression_ref)
            || self
                .procedural_runtime
                .scene_receivers
                .owners
                .contains_key(&document.expression_ref)
            || self.documents.len() >= 64
        {
            return Err(
                "A Scene consumer is constructed only by a new actual native Document open".into(),
            );
        }
        document.validate()?;
        let mut entropy = [0u8; 16];
        getrandom::fill(&mut entropy).map_err(|error| error.to_string())?;
        let generation = NEXT_CONSTRUCTION
            .try_update(Ordering::Relaxed, Ordering::Relaxed, |current| {
                current.checked_add(1)
            })
            .map_err(|_| "Scene construction generation exhausted")?;
        let nonce = entropy
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect::<String>();
        Ok(PendingOpen(Arc::new(Lifetime {
            expression_ref: document.expression_ref.clone(),
            instance_ref: format!("oi:document-scene:{nonce}:{generation}"),
            construction_generation: generation,
            initial_document_revision: document.revision,
            initial_document_sha256: crate::native_expression::procedural::bootstrap::fingerprint(
                document,
            )?,
            live: AtomicBool::new(false),
        })))
    }

    pub(in crate::expression) fn finish_native_scene_open(
        &mut self,
        pending: PendingOpen,
    ) -> Result<(), String> {
        let owner = pending.0;
        let document = self.document(&owner.expression_ref)?;
        if document.revision != owner.initial_document_revision
            || crate::native_expression::procedural::bootstrap::fingerprint(document)?
                != owner.initial_document_sha256
            || self
                .procedural_runtime
                .scene_receivers
                .owners
                .contains_key(&owner.expression_ref)
        {
            return Err(
                "Native Scene constructor did not adopt its original actual Document".into(),
            );
        }
        owner.live.store(true, Ordering::Release);
        self.procedural_runtime
            .scene_receivers
            .owners
            .insert(owner.expression_ref.clone(), owner);
        Ok(())
    }

    pub(crate) fn procedural_scene_owner(
        &self,
        before: &Document,
        scene_ref: &str,
    ) -> Result<SceneOwner, String> {
        if self.document(&before.expression_ref)? != before
            || !before
                .scenes
                .iter()
                .any(|scene| scene.scene_ref == scene_ref)
        {
            return Err(
                "Scene constructor/read pairing differs from the current native Document".into(),
            );
        }
        let owner = self
            .procedural_runtime
            .scene_receivers
            .owners
            .get(&before.expression_ref)
            .ok_or("Actual native Document/Scene constructor absent; a read cannot create it")?;
        self.procedural_runtime.scene_receivers.current(owner)?;
        Ok(SceneOwner {
            lifetime: owner.clone(),
            scene_ref: scene_ref.into(),
            document_revision: before.revision,
            document_sha256: crate::native_expression::procedural::bootstrap::fingerprint(before)?,
        })
    }

    pub(crate) fn require_procedural_scene_owner(
        &self,
        owner: &SceneOwner,
        before: &Document,
    ) -> Result<(), String> {
        self.procedural_runtime
            .scene_receivers
            .current(&owner.lifetime)?;
        if self.document(&before.expression_ref)? != before
            || owner.lifetime.expression_ref != before.expression_ref
            || owner.document_revision != before.revision
            || owner.document_sha256
                != crate::native_expression::procedural::bootstrap::fingerprint(before)?
            || !before
                .scenes
                .iter()
                .any(|scene| scene.scene_ref == owner.scene_ref)
        {
            return Err("The actual Scene constructor/read Document or Scene changed".into());
        }
        Ok(())
    }

    pub(super) fn prepare_scene_edit_receipt(
        &self,
        before: &Document,
        after: &Document,
        operation: &Operation,
        changes: &[Change],
        boundary: Option<(&str, &str, u64)>,
    ) -> Result<Option<EditTicket>, String> {
        // Unqualified generic journal tests do not acquire a Source consumer.
        // Every actual sealed producer must supply this registered Scene role.
        if operation.envelope.producer_ref.is_none() {
            return Ok(None);
        }
        if !self
            .procedural_runtime
            .qualified_operations
            .contains_key(&operation.envelope.operation_ref)
            || self
                .procedural_runtime
                .restored
                .contains(&operation.envelope.operation_ref)
        {
            return Err("Scene application has no original live qualified Source operation".into());
        }
        let owner = self
            .procedural_runtime
            .scene_receivers
            .owners
            .get(&before.expression_ref)
            .ok_or("Source material cannot apply without its actual Scene consumer constructor")?;
        self.procedural_runtime.scene_receivers.current(owner)?;
        if self.document(&before.expression_ref)? != before
            || after.expression_ref != before.expression_ref
        {
            return Err("Scene receipt preparation changed the original native Document".into());
        }
        let participants = operation
            .envelope
            .participants
            .iter()
            .filter(|participant| participant.owner == "scene")
            .collect::<Vec<_>>();
        if participants.len() != 1 {
            return Err(
                "Actual producer requires exactly one native Scene material consumer".into(),
            );
        }
        let participant = participants[0];
        if participant.instance_ref != owner.instance_ref
            || participant.required_generation != owner.construction_generation
            || participant.targets.is_empty()
            || participant.targets.len() > MAX_TARGETS
        {
            return Err(
                "Scene receipt differs from its actual registered constructor or targets".into(),
            );
        }
        for target in &participant.targets {
            if target.expression_ref != before.expression_ref
                || (canonical_address(before, target).is_err()
                    && canonical_address(after, target).is_err())
                || !operation.targets.iter().any(|scope| covers(scope, target))
            {
                return Err(
                    "Scene consumer targets differ from the actual original material edit".into(),
                );
            }
        }
        let (timing_owner, timing_instance_ref, actual_cursor) = boundary
            .ok_or("Source Scene application requires the actual admitted native boundary")?;
        let Timing::OwnerBoundary {
            owner: expected_owner,
            instance_ref: expected_instance,
            cursor: requested_cursor,
        } = &operation.envelope.timing
        else {
            return Err("Actual Source Scene application has no named native boundary".into());
        };
        if timing_owner != expected_owner
            || timing_instance_ref != expected_instance
            || actual_cursor < *requested_cursor
        {
            return Err(
                "Scene application has another actual timing owner or applies before admission"
                    .into(),
            );
        }
        let edit = OriginalEdit {
            operation: "edit",
            expression_ref: &before.expression_ref,
            expected_revision: before.revision,
            actor: &operation.envelope.actor,
            changes,
        };
        let mut bounded = budget::Budget::new();
        bounded.value(before)?;
        bounded.value(after)?;
        bounded.value(&edit)?;
        bounded.value(&participant.targets)?;
        Ok(Some(EditTicket {
            lifetime: owner.clone(),
            operation_ref: operation.envelope.operation_ref.clone(),
            actor: operation.envelope.actor.clone(),
            before_revision: before.revision,
            after_revision: after.revision,
            before_sha256: crate::native_expression::procedural::bootstrap::fingerprint(before)?,
            after_sha256: crate::native_expression::procedural::bootstrap::fingerprint(after)?,
            edit_sha256: crate::native_expression::procedural::bootstrap::fingerprint(&edit)?,
            targets: participant.targets.clone(),
            timing_owner: timing_owner.into(),
            timing_instance_ref: timing_instance_ref.into(),
            requested_cursor: *requested_cursor,
            actual_cursor,
        }))
    }

    pub(super) fn finish_scene_edit_receipt(
        &self,
        ticket: EditTicket,
        receipt: &Value,
        changed: &Changed,
    ) -> Result<ConsumerObservation, String> {
        self.procedural_runtime
            .scene_receivers
            .current(&ticket.lifetime)?;
        let document = self.document(&ticket.lifetime.expression_ref)?;
        if changed.expression_ref != document.expression_ref
            || changed.revision != ticket.after_revision
            || changed.actor != ticket.actor
            || document.revision != ticket.after_revision
            || crate::native_expression::procedural::bootstrap::fingerprint(document)?
                != ticket.after_sha256
            || !budget::matches_borrowed(document, &receipt["document"])
        {
            return Err(
                "Original ordinary native Edit did not adopt the exact Scene material batch".into(),
            );
        }
        Ok(ConsumerObservation {
            owner: "scene".into(),
            instance_ref: ticket.lifetime.instance_ref.clone(),
            generation: ticket.lifetime.construction_generation,
            document_revision: document.revision,
            operation_ref: ticket.operation_ref.clone(),
            cursor: ticket.actual_cursor,
            targets: ticket.targets,
            effective: json!({"schema":"oi.native-scene-application/v1","generation_domain":DOMAIN,
                "expression_ref":document.expression_ref,"operation_ref":ticket.operation_ref,
                "original_document_revision":ticket.before_revision,"document_revision":ticket.after_revision,
                "original_document_sha256":ticket.before_sha256,"document_sha256":ticket.after_sha256,
                "native_edit_sha256":ticket.edit_sha256,
                "document_receipt_sha256":crate::native_expression::procedural::bootstrap::fingerprint(receipt)?,
                "timing_owner":ticket.timing_owner,"timing_instance_ref":ticket.timing_instance_ref,
                "requested_cursor":ticket.requested_cursor,"actual_cursor":ticket.actual_cursor,
                "material_adopted":true,"renderer_observation":"unobserved"}),
        })
    }
}
