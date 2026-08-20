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

pub use aikit_core::ContextResolution as NativeContextResolution;

#[cfg(test)]
mod tests {
    #[test]
    fn source_never_becomes_a_second_context_resolver() {
        let source = include_str!("native_application.rs");
        let compose = ["compose_context_", "resolution("].concat();
        let application = ["application_context_", "resolution("].concat();
        assert!(!source.contains(&compose));
        assert!(!source.contains(&application));
        assert!(source.contains("CONTEXT_RESOLUTION_VERSION"));
    }
}
