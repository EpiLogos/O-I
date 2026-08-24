use aikit_core::model_runtime::{ModelRuntimeReadModel, MODEL_RUNTIME_RELATION_VERSION};
use aikit_core::{ContextResolution, CONTEXT_RESOLUTION_VERSION};
use std::fs;
use std::path::Path;

/// Read an AIKit-owned ContextResolution snapshot without recomputing it in O:I.
///
/// The desktop may be handed this file by a native integration/provider. The
/// payload remains AIKit application state: O:I validates the canonical schema
/// version, keeps the full typed resolution intact, and projects it read-only.
/// No project/actor/resource resolution rule lives here.
pub fn load_context_resolution(path: impl AsRef<Path>) -> Result<ContextResolution, String> {
    let path = path.as_ref();
    let content = fs::read_to_string(path)
        .map_err(|error| format!("read AIKit ContextResolution {}: {error}", path.display()))?;
    let resolution: ContextResolution = serde_json::from_str(&content)
        .map_err(|error| format!("decode AIKit ContextResolution {}: {error}", path.display()))?;
    if resolution.version != CONTEXT_RESOLUTION_VERSION {
        return Err(format!(
            "unsupported AIKit ContextResolution `{}`; expected `{CONTEXT_RESOLUTION_VERSION}`",
            resolution.version
        ));
    }
    Ok(resolution)
}

/// Read an AIKit-owned ModelRuntimeReadModel without inventing model, Harness,
/// Agent, Agency or AgentSession identity in the desktop. The native host later
/// correlates the canonical AgentSession against the actually open ACP Surface.
pub fn load_model_runtime(path: impl AsRef<Path>) -> Result<ModelRuntimeReadModel, String> {
    let path = path.as_ref();
    let content = fs::read_to_string(path)
        .map_err(|error| format!("read AIKit ModelRuntimeReadModel {}: {error}", path.display()))?;
    let runtime: ModelRuntimeReadModel = serde_json::from_str(&content)
        .map_err(|error| format!("decode AIKit ModelRuntimeReadModel {}: {error}", path.display()))?;
    if runtime.version != MODEL_RUNTIME_RELATION_VERSION {
        return Err(format!(
            "unsupported AIKit ModelRuntimeReadModel `{}`; expected `{MODEL_RUNTIME_RELATION_VERSION}`",
            runtime.version
        ));
    }
    Ok(runtime)
}

pub use aikit_core::model_runtime::ModelRuntimeReadModel as NativeModelRuntimeReadModel;
pub use aikit_core::ContextResolution as NativeContextResolution;

#[cfg(test)]
mod tests {
    #[test]
    fn source_never_becomes_a_second_context_or_runtime_resolver() {
        let source = include_str!("native_application.rs");
        let compose = ["compose_context_", "resolution("].concat();
        let application = ["application_context_", "resolution("].concat();
        let disclose_runtime = ["disclose_model_", "runtime("].concat();
        assert!(!source.contains(&compose));
        assert!(!source.contains(&application));
        assert!(!source.contains(&disclose_runtime));
        assert!(source.contains("CONTEXT_RESOLUTION_VERSION"));
        assert!(source.contains("MODEL_RUNTIME_RELATION_VERSION"));
    }
}