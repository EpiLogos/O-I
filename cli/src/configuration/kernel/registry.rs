//! Owner registry and discovery (09 §4): registration content is the
//! contribution document itself — there is no second descriptor format. A
//! failed or non-conforming discovery read is a named degradation on the
//! registry, never an invented contribution (L3).
//!
//! The registry covers the seven product positions (`central`, `actuation`,
//! `ai-kit`, `software-factory`, `workcell`, `quaternal-logic`, `oi`) plus
//! connector owners (owner_ref prefix `connector/`). The position list
//! seeds discovery only; every setting, scope and operation fact comes from
//! the owner's own document — nothing is hardcoded.

// The kernel's error documents carry whole owner failures by design (09 §6, §15):
// keeping them unboxed is the pass-through tradeoff, made explicit here.
#![allow(clippy::result_large_err)]
use crate::configuration::contribution::{
    Contribution, ContributionRegistry, DegradationState, RegisteredSetting,
};
use crate::configuration::refs::{parse_setting_ref, Scope, ScopeDecision};
use serde_json::Value;
use std::collections::BTreeMap;
use std::path::PathBuf;

use super::transport::{OwnerSpec, OwnerTransport, TransportError};

/// The seven positions of the Wave-5 mount (09 §3): the six products plus
/// `oi`, the composition layer itself.
pub const PRODUCT_POSITIONS: [&str; 7] = [
    "central",
    "actuation",
    "ai-kit",
    "software-factory",
    "workcell",
    "quaternal-logic",
    "oi",
];

/// Owner specs for the seven product positions, ready for discovery. The
/// six products come from the deployed surface catalogue; `oi` is the
/// running executable itself. Connector owners are registered explicitly by
/// the caller (the connector mechanism is C4's); pass their specs alongside.
///
/// A product's program is the one the composition actually dispatches to:
/// when the O:I home's `composition.json` registers a `native_executable`
/// for the product — the same registration `oi <alias>` and
/// `oi <namespace>` dispatch exec through — discovery consults that
/// program, so a developer-source registration is read as the build it
/// names. Only a product with no resolvable registration falls back to the
/// deployed catalogue executable.
pub fn product_position_specs() -> Result<Vec<OwnerSpec>, String> {
    let home = crate::configuration::kernel::oi_home().ok();
    product_position_specs_with(|product| Ok(home.as_deref()
        .and_then(|home| registered_program(home, &product.id))
        .unwrap_or_else(|| PathBuf::from(product.executable.clone()))))
}

/// The CLI supplies its actual product dispatcher resolver so discovery,
/// native reads, planning and writes honor exactly the same executable
/// override and verified-suite authority as `oi <product>`.
pub fn product_position_specs_with(
    mut resolve: impl FnMut(&crate::product_command::ProductCommandDescriptor) -> Result<PathBuf, String>,
) -> Result<Vec<OwnerSpec>, String> {
    let catalogue = crate::product_command::product_command_catalogue()?;
    let mut specs = Vec::with_capacity(PRODUCT_POSITIONS.len());
    for product in &catalogue.products {
        specs.push(OwnerSpec { owner_ref: product.id.clone(), program: resolve(product)? });
    }
    let oi = std::env::current_exe()
        .map_err(|error| format!("cannot locate the running `oi` executable: {error}"))?;
    specs.push(OwnerSpec {
        owner_ref: "oi".to_owned(),
        program: oi,
    });
    Ok(specs)
}

/// The composition registration's executable for one product, when the O:I
/// home's `composition.json` names one that resolves. A missing or
/// unshaped state file registers nothing, and an unresolvable registration
/// is no registration: the catalogue executable answers, exactly as before.
fn registered_program(home: &std::path::Path, product_id: &str) -> Option<PathBuf> {
    let bytes = std::fs::read(home.join("composition.json")).ok()?;
    let state: Value = serde_json::from_slice(&bytes).ok()?;
    let registered = state
        .get("modules")?
        .get(product_id)?
        .get("native_executable")?
        .as_str()?;
    resolve_executable(registered)
}

/// Path resolution as the composition dispatcher performs it: a candidate
/// carrying a directory component or an absolute path must itself be
/// executable; a bare name resolves through `PATH`.
fn resolve_executable(candidate: &str) -> Option<PathBuf> {
    let path = std::path::Path::new(candidate);
    if path.components().count() > 1 || path.is_absolute() {
        return is_executable(path).then(|| path.to_path_buf());
    }
    std::env::var_os("PATH").and_then(|paths| {
        std::env::split_paths(&paths)
            .map(|directory| directory.join(path))
            .find(|path| is_executable(path))
    })
}

fn is_executable(path: &std::path::Path) -> bool {
    let Ok(metadata) = std::fs::metadata(path) else {
        return false;
    };
    if !metadata.is_file() {
        return false;
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        metadata.permissions().mode() & 0o111 != 0
    }
    #[cfg(not(unix))]
    {
        true
    }
}

/// An honest record of a discovery read that did not produce a usable
/// contribution. Recorded on the registry, never papered over.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct RegistryDegradation {
    pub owner_ref: String,
    pub state: DegradationState,
    pub reason: String,
    pub native_error: Option<String>,
}

/// One discovered owner. The contribution document *is* the registration.
#[derive(Clone, Debug)]
pub struct OwnerEntry {
    pub contribution: Contribution,
}

/// Every owner discovered on this machine, their settings, and the honest
/// degradations of the reads that failed.
#[derive(Default)]
pub struct OwnerRegistry {
    owners: BTreeMap<String, OwnerEntry>,
    settings: ContributionRegistry,
    degradations: Vec<RegistryDegradation>,
}

impl std::fmt::Debug for OwnerRegistry {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("OwnerRegistry")
            .field("owners", &self.owners.keys().collect::<Vec<_>>())
            .field("degradations", &self.degradations)
            .finish()
    }
}

impl OwnerRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    /// Register a contribution document directly (the `oi` composition
    /// position may be registered this way; tests use it for fixture
    /// owners). Validates the document and enforces unique stable identity
    /// across the whole registry.
    pub fn register_contribution(&mut self, contribution: Contribution) -> Result<(), String> {
        contribution.validate()?;
        let owner_ref = contribution.owner.owner_ref.clone();
        // A re-registration of the same owner replaces its previous document.
        if self.owners.contains_key(&owner_ref) {
            self.owners.remove(&owner_ref);
            self.rebuild_settings()?;
        }
        self.check_no_duplicates(&contribution)?;
        self.settings.register(&contribution)?;
        self.owners.insert(owner_ref, OwnerEntry { contribution });
        Ok(())
    }

    fn check_no_duplicates(&self, contribution: &Contribution) -> Result<(), String> {
        for section in &contribution.sections {
            for setting in &section.settings {
                if self.settings.lookup(&setting.setting_ref).is_some() {
                    return Err(format!(
                        "`{}` contributed twice; stable identity is unique",
                        setting.setting_ref
                    ));
                }
            }
        }
        Ok(())
    }

    fn rebuild_settings(&mut self) -> Result<(), String> {
        let mut settings = ContributionRegistry::new();
        for entry in self.owners.values() {
            settings.register(&entry.contribution)?;
        }
        self.settings = settings;
        Ok(())
    }

    /// Discover one owner through the frozen discovery relation
    /// (`<owner> config-contribution --json`, 09 §4). Any outcome other
    /// than a conforming contribution for the addressed owner becomes a
    /// [`RegistryDegradation`]; the registry state stays truthful.
    pub fn discover(&mut self, transport: &dyn OwnerTransport, spec: &OwnerSpec) {
        let degradation = match transport.discover(&spec.owner_ref) {
            Ok(value) => self.admit_document(spec, value),
            Err(TransportError::Owner(document)) => Some(RegistryDegradation {
                owner_ref: spec.owner_ref.clone(),
                state: DegradationState::Unavailable,
                reason: format!(
                    "owner answered the discovery read with `{}`: {}",
                    document.error_code, document.message
                ),
                native_error: Some(document.message),
            }),
            Err(TransportError::Failure(failure)) => Some(RegistryDegradation {
                owner_ref: spec.owner_ref.clone(),
                state: DegradationState::Unavailable,
                reason: "the discovery read produced no usable answer".to_owned(),
                native_error: Some(failure.message),
            }),
        };
        if let Some(degradation) = degradation {
            self.degradations.push(degradation);
        }
    }

    /// Turn a discovery document into a registration, or into the reason it
    /// could not be admitted. `Ok(())` under `Err(reason)`-shaped results.
    fn admit_document(&mut self, spec: &OwnerSpec, value: Value) -> Option<RegistryDegradation> {
        let failure = |state, reason: String, native_error: Option<String>| {
            Some(RegistryDegradation {
                owner_ref: spec.owner_ref.clone(),
                state,
                reason,
                native_error,
            })
        };
        let contribution: Contribution = match serde_json::from_value(value) {
            Ok(contribution) => contribution,
            Err(error) => {
                return failure(
                    DegradationState::Degraded,
                    "the discovery answer is not a contribution document".to_owned(),
                    Some(error.to_string()),
                );
            }
        };
        if let Err(error) = contribution.validate() {
            return failure(
                DegradationState::Degraded,
                "the discovery answer violates the contribution contract".to_owned(),
                Some(error),
            );
        }
        if contribution.owner.owner_ref != spec.owner_ref {
            return failure(
                DegradationState::Degraded,
                format!(
                    "the document names owner `{}` while `{}` was addressed; no contribution is invented for either",
                    contribution.owner.owner_ref, spec.owner_ref
                ),
                None,
            );
        }
        if let Err(error) = self.register_contribution(contribution) {
            return failure(
                DegradationState::Degraded,
                "the contribution could not be registered".to_owned(),
                Some(error),
            );
        }
        None
    }

    /// Discover a set of owner specs in order.
    pub fn discover_specs(&mut self, transport: &dyn OwnerTransport, specs: &[OwnerSpec]) {
        for spec in specs {
            self.discover(transport, spec);
        }
    }

    pub fn entry(&self, owner_ref: &str) -> Option<&OwnerEntry> {
        self.owners.get(owner_ref)
    }

    pub fn owner_refs(&self) -> impl Iterator<Item = &str> {
        self.owners.keys().map(String::as_str)
    }

    /// The registered setting, with the owner that contributes it.
    pub fn lookup(&self, setting_ref: &str) -> Option<(&RegisteredSetting, &str)> {
        let parts = parse_setting_ref(setting_ref).ok()?;
        let owner_ref = if parts.is_connector {
            format!("connector/{}", parts.owner_ref)
        } else {
            parts.owner_ref.clone()
        };
        let (key, _) = self.owners.get_key_value(&owner_ref)?;
        let registered = self.settings.lookup(setting_ref)?;
        Some((registered, key.as_str()))
    }

    /// The owner that answers a setting ref, for dispatch routing.
    pub fn owner_of(&self, setting_ref: &str) -> Option<&str> {
        self.lookup(setting_ref).map(|(_, owner)| owner)
    }

    /// The explicit scope decision of 09 §5, through the frozen C0
    /// registry logic.
    pub fn scope_decision(&self, setting_ref: &str, scope: &Scope) -> ScopeDecision {
        self.settings.scope_decision(setting_ref, scope)
    }

    /// The C0 settings registry over every registered contribution — the
    /// shape the frozen redaction validators consume.
    pub fn settings(&self) -> &ContributionRegistry {
        &self.settings
    }

    pub fn degradations(&self) -> &[RegistryDegradation] {
        &self.degradations
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::configuration::contribution::Contribution;
    use crate::configuration::refs::ScopeKind;
    use crate::configuration::TransportFailure;
    use serde_json::json;

    fn fixture_contribution(name: &str) -> Contribution {
        let raw = std::fs::read_to_string(format!(
            "{}/../suite/configuration/cases/{name}.json",
            env!("CARGO_MANIFEST_DIR")
        ))
        .expect("fixture readable");
        let value: Value = serde_json::from_str(&raw).unwrap();
        serde_json::from_value(value["contribution"].clone()).unwrap()
    }

    #[derive(Debug)]
    struct StubTransport {
        answers: BTreeMap<String, Result<Value, TransportError>>,
    }

    impl OwnerTransport for StubTransport {
        fn discover(&self, owner_ref: &str) -> Result<Value, TransportError> {
            self.answers
                .get(owner_ref)
                .cloned()
                .unwrap_or_else(|| Err(TransportFailure::owner_unavailable("absent").into()))
        }
        fn system_reading(&self, _owner_ref: &str) -> Result<Value, TransportError> {
            Err(TransportFailure::owner_unavailable("stub").into())
        }
        fn validate(
            &self,
            _: &str,
            _: &super::super::transport::SettingRequest,
        ) -> Result<Value, TransportError> {
            Err(TransportFailure::owner_unavailable("stub").into())
        }
        fn plan(
            &self,
            _: &str,
            _: &super::super::transport::SettingRequest,
        ) -> Result<Value, TransportError> {
            Err(TransportFailure::owner_unavailable("stub").into())
        }
        fn apply(
            &self,
            _: &str,
            _: &super::super::transport::ApplyRequest,
        ) -> Result<Value, TransportError> {
            Err(TransportFailure::owner_unavailable("stub").into())
        }
        fn reset(
            &self,
            _: &str,
            _: &super::super::transport::ResetRequest,
        ) -> Result<Value, TransportError> {
            Err(TransportFailure::owner_unavailable("stub").into())
        }
    }

    #[test]
    fn discovery_registers_conforming_documents_and_degrades_failures_honestly() {
        let good = fixture_contribution("contribution-ai-kit");
        let mut answers: BTreeMap<String, Result<Value, TransportError>> = BTreeMap::new();
        answers.insert(
            "ai-kit".to_owned(),
            Ok(serde_json::to_value(&good).unwrap()),
        );
        answers.insert(
            "workcell".to_owned(),
            Err(TransportFailure::owner_unavailable("executable not installed").into()),
        );
        answers.insert(
            "central".to_owned(),
            Ok(json!({ "schema": "oi.configuration-contribution/v1", "owner": {} })),
        );
        let transport = StubTransport { answers };

        let mut registry = OwnerRegistry::new();
        registry.discover_specs(
            &transport,
            &[
                OwnerSpec {
                    owner_ref: "ai-kit".into(),
                    program: "aikit".into(),
                },
                OwnerSpec {
                    owner_ref: "workcell".into(),
                    program: "workcell".into(),
                },
                OwnerSpec {
                    owner_ref: "central".into(),
                    program: "ctrl".into(),
                },
            ],
        );

        // The conforming document is registered whole.
        assert!(registry.lookup("ai-kit:resolution:model.default").is_some());
        // The absent owner fabricated nothing.
        assert!(registry
            .lookup("workcell:placement:placement.policy")
            .is_none());
        // The non-conforming answer is a named degradation, never a guess.
        let degraded = &registry.degradations()[1];
        assert_eq!(degraded.owner_ref, "central");
        assert_eq!(degraded.state, DegradationState::Degraded);
        let unavailable = &registry.degradations()[0];
        assert_eq!(unavailable.owner_ref, "workcell");
        assert_eq!(unavailable.state, DegradationState::Unavailable);
        assert!(unavailable
            .native_error
            .as_deref()
            .unwrap()
            .contains("not installed"));
    }

    #[test]
    fn re_registration_replaces_the_owner_document_whole() {
        let mut registry = OwnerRegistry::new();
        registry
            .register_contribution(fixture_contribution("contribution-ai-kit"))
            .expect("first document registers");
        let mut revised = fixture_contribution("contribution-ai-kit");
        revised.sections[0].settings[0].title = "Revised default model".to_owned();
        registry
            .register_contribution(revised)
            .expect("a re-registration replaces the owner document");
        let (registered, owner) = registry.lookup("ai-kit:resolution:model.default").unwrap();
        assert_eq!(owner, "ai-kit");
        assert_eq!(registered.spec.title, "Revised default model");
        // And within one document, a repeated setting identity is refused.
        let mut doubled = fixture_contribution("contribution-ai-kit");
        let repeat = doubled.sections[0].settings[0].clone();
        doubled.sections[0].settings.push(repeat);
        let error = registry
            .register_contribution(doubled)
            .expect_err("a repeated identity inside one document is refused");
        assert!(error.contains("contributed twice"), "{error}");
    }

    #[test]
    fn scope_decision_delegates_to_the_frozen_logic() {
        let mut registry = OwnerRegistry::new();
        registry
            .register_contribution(fixture_contribution("contribution-ai-kit"))
            .unwrap();
        let scope = Scope {
            scope_kind: ScopeKind::World,
            scope_ref: None,
        };
        assert_eq!(
            registry.scope_decision("ai-kit:session:session.provider", &scope),
            ScopeDecision::Supported
        );
        assert_eq!(
            registry.scope_decision("ai-kit:resolution:model.default", &scope),
            ScopeDecision::UnsupportedScope
        );
        assert!(
            registry
                .owner_of("ai-kit:resolution:model.default")
                .unwrap()
                == "ai-kit"
        );
    }

    #[test]
    fn a_composition_registration_names_the_discovery_program() {
        let home = tempfile::tempdir().expect("tempdir");
        let program = home.path().join("registered-aikit");
        std::fs::write(&program, "#!/bin/sh\nexit 0\n").expect("stub written");
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&program, std::fs::Permissions::from_mode(0o755))
                .expect("stub made executable");
        }
        std::fs::write(
            home.path().join("composition.json"),
            serde_json::json!({
                "schema": 1,
                "modules": {
                    "ai-kit": { "native_executable": program.to_string_lossy() }
                }
            })
            .to_string(),
        )
        .expect("composition state written");

        // The registered product resolves to its registered executable.
        assert_eq!(
            registered_program(home.path(), "ai-kit").as_deref(),
            Some(program.as_path())
        );
        // An unregistered product names nothing.
        assert_eq!(registered_program(home.path(), "actuation"), None);
    }

    #[test]
    fn an_unresolvable_registration_registers_nothing() {
        let home = tempfile::tempdir().expect("tempdir");
        std::fs::write(
            home.path().join("composition.json"),
            serde_json::json!({
                "schema": 1,
                "modules": {
                    "ai-kit": { "native_executable": "/nonexistent/owner/path" }
                }
            })
            .to_string(),
        )
        .expect("composition state written");
        assert_eq!(registered_program(home.path(), "ai-kit"), None);
        // A state file that is not a composition state registers nothing.
        std::fs::write(home.path().join("composition.json"), "not json")
            .expect("broken state written");
        assert_eq!(registered_program(home.path(), "ai-kit"), None);
        // No state file at all registers nothing.
        std::fs::remove_file(home.path().join("composition.json")).expect("state file removed");
        assert_eq!(registered_program(home.path(), "ai-kit"), None);
    }
}
