//! The kernel's ref vocabulary — ported KEEP-RE-EARN from `desktop/core`
//! (`shell.rs`'s SemanticRef shapes, carried verbatim).
//!
//! The law (02 §9.3, ported): refs stay opaque. The kernel never re-owns
//! another product's nouns and never infers a relation from a ref's kind
//! string. Central owns source refs (D12): every ref the kernel names in a
//! source event is the owner's canonical grammar
//! (`central:source:project:{project_id}:{escaped-path}`), carried verbatim
//! — the desktop never mints its own refs (map §1 law 4).

use serde::{Deserialize, Serialize};

/// A ref the kernel may name: an identifier, a kind and a native owner,
/// attributed (02 §5). `ref_id` is the owner's own spelling, verbatim.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct SemanticRef {
    #[serde(rename = "ref")]
    pub ref_id: String,
    pub kind: String,
    pub native_owner: String,
    pub provenance: RefProvenance,
}

/// Attribution carried beside every ref (02 §5).
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct RefProvenance {
    pub source: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub revision: Option<String>,
}

/// The native owner of the source refs this kernel carries. Central owns
/// source identity, revision and mutation (D12; OI-CENTRAL-FOUNDATION).
pub const SOURCE_NATIVE_OWNER: &str = "central";

/// The owner-declared kind of a Central source ref, in the owner's own
/// vocabulary (a `central:source:…` ref names a source).
pub const SOURCE_KIND: &str = "source";

/// The provenance source string for refs this kernel derives from Central's
/// ProjectCentral owner Actions.
pub const SOURCE_PROVENANCE: &str = "central.projectcentral";

/// Wrap a Central source ref — already in the owner's canonical grammar —
/// as the whole ref the kernel names in events. The ref string is carried
/// verbatim; nothing is normalised, escaped, or re-derived here.
pub fn source_semantic_ref(source_ref: &str, revision: Option<&str>) -> Result<SemanticRef, String> {
    if source_ref.trim().is_empty() {
        return Err("a source ref the kernel would name is empty".to_owned());
    }
    Ok(SemanticRef {
        ref_id: source_ref.to_owned(),
        kind: SOURCE_KIND.to_owned(),
        native_owner: SOURCE_NATIVE_OWNER.to_owned(),
        provenance: RefProvenance {
            source: SOURCE_PROVENANCE.to_owned(),
            revision: revision.map(str::to_owned),
        },
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_central_source_ref_travels_verbatim_and_whole() {
        let canonical = "central:source:project:project:o-i:ProjectCentral/user/learnings/README.md";
        let reference = source_semantic_ref(canonical, Some("central.content-fnv1a64/v1:2389:x"))
            .expect("a canonical ref is a whole ref");
        assert_eq!(reference.ref_id, canonical);
        assert_eq!(reference.kind, "source");
        assert_eq!(reference.native_owner, "central");
        assert_eq!(
            reference.provenance.source, "central.projectcentral"
        );
        let wire = serde_json::to_value(&reference).unwrap();
        assert_eq!(wire["ref"], canonical);
        // round trip keeps the owner's spelling byte-identical
        let restored: SemanticRef = serde_json::from_value(wire).unwrap();
        assert_eq!(restored, reference);
    }

    #[test]
    fn an_empty_ref_is_refused_rather_than_wrapped() {
        assert!(source_semantic_ref("   ", None).is_err());
    }
}
