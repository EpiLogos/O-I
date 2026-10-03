//! Actual current Document/Scene custody, independently of recorded Act custody.
//! Only the existing Kernel/Application source owner constructs this reader.
//! Native source operations borrow it before/after the SAME complete Doc CAS.
use crate::expression::{Document, Scene};
use crate::expression_procedural_source_budget::digest;
use serde_json::{json, Value};

/// Not Deserialize/Clone: only an actual current Application snapshot can
/// produce this source reader. A recorded Act uses its separate cold reader.
pub struct NativeDocumentSceneReader {
    document: Document,
    scene_index: usize,
    document_digest: String,
}
impl NativeDocumentSceneReader {
    fn from_current_document(
        document: Document,
        scene_ref: &str,
        expected_scene_revision: u64,
    ) -> Result<Self, String> {
        document.validate()?;
        let scenes: Vec<_> = document
            .scenes
            .iter()
            .enumerate()
            .filter(|(_, scene)| scene.scene_ref == scene_ref)
            .collect();
        if scenes.len() != 1 || scenes[0].1.revision != expected_scene_revision {
            return Err("current native Scene is absent, ambiguous or changed".into());
        }
        if scenes[0].1.presentation.is_none() {
            return Err("current native Scene has no actual presentation material".into());
        }
        let scene_index = scenes[0].0;
        let document_digest = digest(&serde_json::to_vec(&document).map_err(|e| e.to_string())?);
        Ok(Self {
            document,
            scene_index,
            document_digest,
        })
    }
    pub(crate) fn document(&self) -> &Document {
        &self.document
    }
    pub fn scene(&self) -> &Scene {
        &self.document.scenes[self.scene_index]
    }
    fn verify_current(&self, actual: &Document) -> Result<(), String> {
        actual.validate()?;
        if *actual != self.document {
            return Err(
                "complete current native Document/Scene changed during source operation".into(),
            );
        }
        Ok(())
    }
    pub(crate) fn native_manifest(&self) -> Result<Value, String> {
        // Existing expanded Document and 32MiB delivery bounds are preflighted
        // before constructing transport strings/Value copies. No cap increase.
        crate::expression_procedural_source_budget::measure(&self.document, crate::expression::DOCUMENT_BYTES)?;
        let document_bytes = serde_json::to_vec(&self.document).map_err(|e| e.to_string())?;
        let scene_bytes = serde_json::to_vec(self.scene()).map_err(|e| e.to_string())?;
        let canonical_document_bytes =
            String::from_utf8(document_bytes.clone()).map_err(|e| e.to_string())?;
        let canonical_scene_bytes =
            String::from_utf8(scene_bytes.clone()).map_err(|e| e.to_string())?;
        let field_source_manifest = self
            .scene()
            .native_field_source
            .as_ref()
            .map(|source| source.manifest())
            .transpose()?;
        #[derive(serde::Serialize)]
        struct Delivery<'a> {
            schema: &'static str,
            expression_ref: &'a str,
            expression_revision: u64,
            expanded_document_sha256: String,
            canonical_document_bytes: &'a str,
            scene_ref: &'a str,
            scene_revision: u64,
            scene: &'a Scene,
            canonical_scene_bytes: &'a str,
            selected_scene_sha256: String,
            field_source_manifest: &'a Option<Value>,
        }
        let delivery = Delivery {
            schema: "oi.expression-native-current-scene-delivery/v1",
            expression_ref: &self.document.expression_ref,
            expression_revision: self.document.revision,
            expanded_document_sha256: digest(&document_bytes),
            canonical_document_bytes: &canonical_document_bytes,
            scene_ref: &self.scene().scene_ref,
            scene_revision: self.scene().revision,
            scene: self.scene(),
            canonical_scene_bytes: &canonical_scene_bytes,
            selected_scene_sha256: digest(&scene_bytes),
            field_source_manifest: &field_source_manifest,
        };
        crate::expression_procedural_source_budget::measure(
            &delivery,
            crate::expression_procedural_source_budget::MAX_DELIVERY_BYTES,
        )?;
        serde_json::to_value(delivery).map_err(|e| e.to_string())
    }
    pub(crate) fn field_source_part(&self, index: usize) -> Result<Value, String> {
        let source = self
            .scene()
            .native_field_source
            .as_ref()
            .ok_or("current Scene lacks full original/current native FIELD source custody")?;
        let mut part = source.sample_part(index)?;
        part["selection"] = json!({"expression_ref":self.document.expression_ref,
            "expression_revision":self.document.revision,
            "expanded_document_sha256":self.document_digest,
            "scene_ref":self.scene().scene_ref,"scene_revision":self.scene().revision,
            "source_digest":source.source_digest()});
        Ok(part)
    }
}

/// Source6's borrowed current-Document case. Full recorded Act custody remains
/// in its separate native owner module; this child has no imported wire factory.
pub(crate) enum NativeSceneSourceReader<'a> {
    CurrentDocument(&'a NativeDocumentSceneReader),
}
impl NativeSceneSourceReader<'_> {
    pub(crate) fn document(&self) -> &Document {
        match self { Self::CurrentDocument(reader) => reader.document() }
    }
    pub(crate) fn scene(&self) -> &Scene {
        match self { Self::CurrentDocument(reader) => reader.scene() }
    }
    pub(crate) fn native_manifest(&self) -> Result<Value, String> {
        match self { Self::CurrentDocument(reader) => reader.native_manifest() }
    }
    pub(crate) fn field_source_part(&self, index: usize) -> Result<Value, String> {
        match self { Self::CurrentDocument(reader) => reader.field_source_part(index) }
    }
}

/// A native exchange may have consumed applications even if source CAS
/// subsequently refuses. Preserve its whole result separately from currentness.
/// Callers MUST return the original receipt/pulse on post-operation refusal.
pub(crate) struct NativeSceneCustodyOutcome<T> {
    pub(crate) result: Result<T, String>,
    pub(crate) currentness: Result<(), String>,
}

impl crate::Kernel {
    /// Source-only native operation on a currently owned Application Document.
    /// Full source/CAS is re-read even after a refused native consumer; no result
    /// is published after a changed current Document. Act lookup is never used.
    pub(crate) fn with_native_document_scene<T>(
        &mut self,
        expression_ref: &str,
        expected_document_revision: u64,
        scene_ref: &str,
        expected_scene_revision: u64,
        consumer: impl FnOnce(
            &mut crate::native_expression::Manager,
            &NativeDocumentSceneReader,
        ) -> Result<T, String>,
    ) -> Result<NativeSceneCustodyOutcome<T>, String> {
        let before = self
            .expressions
            .procedural_source_snapshot(expression_ref, expected_document_revision)?;
        let reader = NativeDocumentSceneReader::from_current_document(
            before,
            scene_ref,
            expected_scene_revision,
        )?;
        let result = consumer(&mut self.native_expression, &reader);
        let currentness = self
            .expressions
            .procedural_source_snapshot(expression_ref, expected_document_revision)
            .and_then(|current| reader.verify_current(&current));
        Ok(NativeSceneCustodyOutcome {
            result,
            currentness,
        })
    }

}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{CentralClient, KernelOp, KernelOpResult};
    fn apply(kernel: &mut crate::Kernel, request: Value) -> Value {
        let data = match kernel
            .apply(KernelOp::Expression {
                request: serde_json::from_value(request).unwrap(),
            })
            .unwrap()
            .result
        {
            KernelOpResult::Expression { data } => data,
            other => panic!("{other:?}"),
        };
        assert_eq!(
            data["state"], "ready",
            "actual native application setup refused: {data}"
        );
        data
    }
    fn inspect(kernel: &mut crate::Kernel) -> Document {
        serde_json::from_value(
            apply(
                kernel,
                json!({"operation":"inspect","expression_ref":"expression:closed-current-source"}),
            )["document"]
                .clone(),
        )
        .unwrap()
    }
    fn setup() -> crate::Kernel {
        let mut kernel = crate::Kernel::new(CentralClient::discover());
        let created = apply(
            &mut kernel,
            json!({"operation":"create","expression_ref":"expression:closed-current-source",
            "title":"Actual current source","actor":"human:source-reader-test"}),
        );
        let before = inspect(&mut kernel);
        before.validate().unwrap();
        assert_eq!(created["document"], serde_json::to_value(&before).unwrap());
        let scene = &before.scenes[0];
        let material = json!({"schema":"oi.journey-scene/v1","scene":{
            "id":scene.scene_ref,"name":scene.title,"character":"Authored native Scene",
            "duration":42,"transition":3,"view":{"mode":"3d","yaw":0.0,"pitch":0.0,"zoom":1.0,"panX":0.0,"panY":0.0},
            "field":{"background":"#fafafa","palette":["#111111"],"material":"ink","params":{}},
            "composition":{},"morph":{},"engine":{},
            "entities":[],"text":[{"body":"Original native authored source material"}],"automation":[]}});
        let edited = apply(
            &mut kernel,
            json!({"operation":"edit","expression_ref":before.expression_ref,"expected_revision":before.revision,
            "actor":"human:source-reader-test","changes":[{"change":"scene_material_set",
            "scene_ref":scene.scene_ref,"presentation":material}]}),
        );
        let current = inspect(&mut kernel);
        current.validate().unwrap();
        assert_eq!(edited["document"], serde_json::to_value(&current).unwrap());
        assert_eq!(current.revision, before.revision + 1);
        assert_eq!(
            serde_json::to_value(current.scenes[0].presentation.as_ref().unwrap()).unwrap(),
            material
        );
        kernel
    }
    #[test]
    fn actual_current_application_reader_retains_whole_doc_without_an_act() {
        let mut kernel = setup();
        let doc = inspect(&mut kernel);
        let scene = &doc.scenes[0];
        let outcome = kernel
            .with_native_document_scene(
                &doc.expression_ref,
                doc.revision,
                &scene.scene_ref,
                scene.revision,
                |_, reader| reader.native_manifest(),
            )
            .unwrap();
        outcome.currentness.unwrap();
        let manifest = outcome.result.unwrap();
        assert_eq!(
            manifest["schema"],
            "oi.expression-native-current-scene-delivery/v1"
        );
        for key in ["act_ref", "act_revision", "act_digest", "edition_position"] {
            assert!(manifest.get(key).is_none());
        }
        let exact: Document =
            serde_json::from_str(manifest["canonical_document_bytes"].as_str().unwrap()).unwrap();
        assert_eq!(exact, doc);
        assert_eq!(manifest["scene"], serde_json::to_value(scene).unwrap());
        assert_eq!(
            manifest["expanded_document_sha256"],
            digest(
                manifest["canonical_document_bytes"]
                    .as_str()
                    .unwrap()
                    .as_bytes()
            )
        );
        assert!(
            manifest["field_source_manifest"].is_null(),
            "an authored plain Scene cannot manufacture native FIELD authority"
        );
    }
    #[test]
    fn actual_current_native_edit_invalidates_the_old_complete_scene_selection() {
        let mut kernel = setup();
        let original = inspect(&mut kernel);
        apply(
            &mut kernel,
            json!({"operation":"edit","expression_ref":original.expression_ref,
            "expected_revision":original.revision,"actor":"human:source-reader-test","changes":[
                {"change":"scene_rename","scene_ref":original.scenes[0].scene_ref,"title":"Actual human revision"}]}),
        );
        let current = inspect(&mut kernel);
        assert_ne!(current, original);
        assert!(kernel
            .with_native_document_scene(
                &original.expression_ref,
                original.revision,
                &original.scenes[0].scene_ref,
                original.scenes[0].revision,
                |_, reader| reader.native_manifest()
            )
            .is_err());
        let currentness = kernel
            .with_native_document_scene(
                &current.expression_ref,
                current.revision,
                &current.scenes[0].scene_ref,
                current.scenes[0].revision,
                |_, reader| reader.native_manifest(),
            )
            .unwrap();
        currentness.currentness.unwrap();
        assert_eq!(
            currentness.result.unwrap()["scene"]["title"],
            "Actual human revision"
        );
        assert_eq!(
            inspect(&mut kernel),
            current,
            "source reading cannot itself mutate the native Document"
        );
    }
}
