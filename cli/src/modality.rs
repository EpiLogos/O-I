//! The canonical installation-modality vocabulary (O:I #192).
//!
//! Every path that installs, registers, establishes or reconciles an {O:I}
//! composition belongs to exactly one of these context frames. The frame is
//! declared where the path is dispatched (the bootstrap dispatch table and
//! the install descriptors in `surfaces.json`), recorded in composition
//! state at install/init time, and disclosed by `oi status`, `oi doctor`
//! and `oi current-world`. Legacy state that predates the field discloses
//! [`InstallModality::Unknown`] honestly rather than guessing.
//!
//! Each modality exists to deliver one operative-UX outcome from
//! `docs/OI-OPERATIVE-FRONTDOOR-WAYFINDER.md`: bootstrap acceptance is UX
//! acceptance, not just command success. The per-modality outcome is part
//! of the vocabulary itself, so a bootstrap path cannot claim a modality
//! without claiming its UX thread.

use serde::{Deserialize, Serialize};

/// One installation modality (context frame). Serde names are the canonical
/// kebab-case wire vocabulary; there are no synonyms.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum InstallModality {
    /// Establish a personal ground from nothing: `oi install central` +
    /// `oi init --personal-ground PATH` (and the recorded first-suite /
    /// released-artifact bootstrap paths). Includes the
    /// `machine.adopt-current` step (Central #87) and the guardian-SkillSet
    /// pickup.
    ///
    /// UX thread: a human/Agent receives one standing, searchable world —
    /// the front door (`oi` and the six-product command field) resolves to
    /// authored ground material from the very first invocation.
    FreshGround,
    /// Operate on a ground that already exists without re-installing it:
    /// `oi skills sync`, `oi migrate <path>`, plain `oi register`/`oi init`
    /// adoption of detected natives.
    ///
    /// UX thread: reconciliation preserves what inhabitation already built;
    /// the front door keeps addressing the same world, now explicitly
    /// composed.
    ExistingGroundReconcile,
    /// The developer source world under the ground's `Work/`:
    /// `oi dev status|sync|build|test|install|acceptance` and
    /// `oi install <product>` source registrations pinned to current
    /// accepted mains.
    ///
    /// UX thread: developer and inhabitant share one instrument — the same
    /// search/address/dispatch path exercises exactly the source world that
    /// `oi dev acceptance` proved current.
    DeveloperSource,
    /// Recognise and adopt an already-inhabited world: `oi adopt PATH`,
    /// `oi recognition ...` (world recognition engine, #93 adoption law).
    ///
    /// UX thread: recognition comes before composition — the front door
    /// names what already exists (owner handoffs) instead of inventing a
    /// parallel suite ontology.
    ExistingWorldAdoption,
    /// The reference-world host relation: `oi host omarchy plan|realise|verify`
    /// materialises only O:I-owned plugin payloads against the pinned
    /// Omarchy contract.
    ///
    /// UX thread: a reference host machine joins the world as a first-class
    /// inhabited surface, with native enable/reload left explicit.
    ReferenceWorldHost,
    /// Harness admission and strapping delegated to AIKit (ai-kit #114).
    /// O:I's own strap step today is the guardian-SkillSet handoff to the
    /// installed AIKit (init / `oi skills sync`) and the `oi.package/v1`
    /// native lifecycle envelope (`native_lifecycle.rs`); harness admission
    /// proper is not reimplemented here.
    ///
    /// UX thread: Skills/capabilities land in the resolver the front door
    /// already consults, so admission never creates a second registry.
    HarnessStrap,
    /// Legacy composition state that predates the modality field. Disclosed
    /// as `unknown`; never inferred retroactively.
    #[default]
    Unknown,
}

impl InstallModality {
    /// Canonical kebab-case name (`fresh-ground`, …, `unknown`).
    pub fn as_str(self) -> &'static str {
        match self {
            Self::FreshGround => "fresh-ground",
            Self::ExistingGroundReconcile => "existing-ground-reconcile",
            Self::DeveloperSource => "developer-source",
            Self::ExistingWorldAdoption => "existing-world-adoption",
            Self::ReferenceWorldHost => "reference-world-host",
            Self::HarnessStrap => "harness-strap",
            Self::Unknown => "unknown",
        }
    }

    /// Parse a canonical name. Returns `None` for anything else — the
    /// vocabulary has no synonyms.
    pub fn from_name(value: &str) -> Option<Self> {
        [
            Self::FreshGround,
            Self::ExistingGroundReconcile,
            Self::DeveloperSource,
            Self::ExistingWorldAdoption,
            Self::ReferenceWorldHost,
            Self::HarnessStrap,
            Self::Unknown,
        ]
        .into_iter()
        .find(|modality| modality.as_str() == value)
    }

    /// The complete canonical set (including `unknown`) in declaration
    /// order. Set proofs over the dispatch table and the install
    /// descriptors are written against this.
    pub const ALL: [InstallModality; 7] = [
        InstallModality::FreshGround,
        InstallModality::ExistingGroundReconcile,
        InstallModality::DeveloperSource,
        InstallModality::ExistingWorldAdoption,
        InstallModality::ReferenceWorldHost,
        InstallModality::HarnessStrap,
        InstallModality::Unknown,
    ];
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn wire_names_are_canonical_kebab_case_without_synonyms() {
        let expected = [
            "fresh-ground",
            "existing-ground-reconcile",
            "developer-source",
            "existing-world-adoption",
            "reference-world-host",
            "harness-strap",
            "unknown",
        ];
        assert_eq!(InstallModality::ALL.len(), expected.len());
        for (modality, name) in InstallModality::ALL.into_iter().zip(expected) {
            assert_eq!(modality.as_str(), name);
            assert_eq!(
                serde_json::to_value(modality).unwrap(),
                serde_json::json!(name)
            );
            assert_eq!(InstallModality::from_name(name), Some(modality));
        }
        let names: Vec<&str> = InstallModality::ALL.map(|m| m.as_str()).to_vec();
        let mut sorted = names.clone();
        sorted.sort_unstable();
        sorted.dedup();
        assert_eq!(sorted.len(), names.len(), "duplicate modality names");
    }

    #[test]
    fn near_synonyms_are_rejected_rather_than_guessed() {
        for stray in ["adoption", "fresh", "source", "dev-source", "bootstrap", ""] {
            assert_eq!(InstallModality::from_name(stray), None, "{stray:?}");
        }
    }

    #[test]
    fn every_install_descriptor_declares_a_canonical_modality() {
        let catalog: serde_json::Value =
            serde_json::from_str(include_str!("../../surfaces.json")).unwrap();
        for surface in catalog["surfaces"].as_array().unwrap() {
            let id = surface["id"].as_str().unwrap();
            let declared = surface["install"]["modality"]
                .as_str()
                .unwrap_or_else(|| panic!("{id} install descriptor lacks a modality"));
            let modality = InstallModality::from_name(declared)
                .unwrap_or_else(|| panic!("{id} declares non-canonical modality {declared:?}"));
            assert_ne!(
                modality,
                InstallModality::Unknown,
                "{id} declares modality unknown; descriptors must declare a real frame"
            );
        }
    }
}
