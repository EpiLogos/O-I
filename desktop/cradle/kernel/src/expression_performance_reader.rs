//! Closed same-owner selected Act reader for the native score/export bridge.
//! Its constructor is crate-private and reached through the existing Kernel
//! Act lookup. Payloads remain evidence, never a deserializable selection lease.
use crate::expression_performance_delivery::{SelectedPerformance, Selection};
use crate::expression_world::Act;
use serde_json::Value;

pub struct NativeActDeliveryReader {
    selected: SelectedPerformance,
    selection: Selection,
    manifest: Option<Value>,
    act_ref: String,
    act_digest: String,
}
impl NativeActDeliveryReader {
    pub(crate) fn from_native_act(act: &Act, selection: &Selection) -> Result<Self, String> {
        let selected = SelectedPerformance::from_act(act, selection)?;
        let manifest = selected.native_payload()?;
        let act_digest = manifest["act_digest"]
            .as_str()
            .ok_or("native selected Act digest absent")?
            .into();
        Ok(Self {
            selected,
            selection: selection.clone(),
            manifest: Some(manifest),
            act_ref: act.act_ref.clone(),
            act_digest,
        })
    }
    /// The host invokes the source compiler with THIS borrowed complete native
    /// manifest. There is no caller-supplied Value parameter to this operation.
    /// Moving the existing value avoids a second full manifest allocation.
    pub fn compile_with<T>(
        &mut self,
        compiler: impl FnOnce(&Value, &mut Self) -> Result<T, String>,
    ) -> Result<T, String> {
        let manifest = self
            .manifest
            .take()
            .ok_or("native Act reader is already in a consumer operation")?;
        let result = compiler(&manifest, self);
        self.manifest = Some(manifest);
        result
    }
    pub fn require_exact_manifest(&self, candidate: &Value) -> Result<(), String> {
        if self.manifest.as_ref() != Some(candidate) {
            return Err("caller manifest differs from complete native selected Act".into());
        }
        Ok(())
    }
    pub fn page(&self, index: usize) -> Result<Value, String> {
        self.selected.native_page(index)
    }
    pub fn checkpoint(&self, index: usize) -> Result<Value, String> {
        self.selected.native_checkpoint(index)
    }
    pub fn require_native_sources(&self, actual: &[Value]) -> Result<(), String> {
        self.selected.verify_native_sources(actual)
    }
    pub fn requires_private_disclosure(&self) -> bool {
        self.selected.requires_private_disclosure()
    }
    pub(crate) fn verify_current(&self, act: &Act) -> Result<(), String> {
        if act.act_ref != self.act_ref
            || act.revision != self.selection.expected_act_revision
            || crate::expression_file::digest(&serde_json::to_vec(act).map_err(|e| e.to_string())?)
                != self.act_digest
        {
            return Err(
                "native selected Act changed during source compilation/export preparation".into(),
            );
        }
        crate::expression_performance_act::validate(act)?;
        Ok(())
    }
}
