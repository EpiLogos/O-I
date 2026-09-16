//! The fixture-backed in-memory implementation of the C5 seam
//! ([`crate::config_surface`]). It loads the frozen C0 conformance fixtures
//! (`suite/configuration/cases/`), simulates owner-native
//! validate/plan/apply/reset against the disclosed contributions, and keeps
//! desired state, profiles and idempotency keys in memory only.
//!
//! It exists so the CLI lane can prove the frozen shapes end to end before
//! the C1 kernel and the C2 profile store exist. It is not the kernel: no
//! discovery beyond the fixture set, no persistence, no real owner
//! dispatch. The integrator binds `ConfigSurface`/`ProfileSurface` to the
//! real engine; this type stays a test double.

use crate::config_surface::{
    sha256_hex, AppliedChange, ChangeRequest, ConfigPlan, ConfigSurface, DoctorClassification,
    DoctorFinding, ListedSetting, OwnerContribution, PlanChange, ProfileActivation,
    ProfileEditApplied, ProfileEditOp, ProfileEditOutcome, ProfileSummary, ProfileSurface,
    ReceiptSummary, SurfaceError, SurfaceResult, CONFIG_PLAN_SCHEMA,
};
use crate::configuration::{
    derive_changeset_status, parse_setting_ref, reconcile, validate_changeset, validate_profile,
    AuthoredBy, ChangeSet, Contribution, ContributionRegistry, Desired, DesiredEntry, ErrorCode,
    IdempotencyKey, NativeAxes, NativeAxis, Operation, OperationKind, OperationStatus, Profile,
    ProfileProvenance, Receipt, ReceiptOutcome, ReconciliationInputs, ReconciliationStatus,
    RequestedChange, Resolution, Scope, ScopeDecision, SecretReference, SettingSpec, StageState,
    ValueKind,
};
use serde_json::Value;
use std::cell::{Cell, RefCell};
use std::collections::BTreeMap;
use std::path::Path;
use std::rc::Rc;

const FIXTURE_CONTRIBUTIONS: [&str; 4] = [
    "contribution-ai-kit",
    "contribution-oi",
    "contribution-connector-fixture",
    "contribution-unavailable",
];
const FIXTURE_PROFILE: &str = "profile-development";

/// One simulated owner-native fact for a setting: an ordinary value, or a
/// credential reference with its observed presence (never material).
#[derive(Clone, Debug, Default, serde::Serialize)]
struct NativeFact {
    value: Option<Value>,
    secret_ref: Option<String>,
    secret_present: Option<bool>,
}

pub struct FixtureSurface {
    contributions: Vec<Contribution>,
    registry: ContributionRegistry,
    /// owner_ref -> Some(reason) when the owner disclosed itself unavailable.
    unavailable_owners: BTreeMap<String, String>,
    native: RefCell<BTreeMap<String, NativeFact>>,
    stages: RefCell<BTreeMap<String, StageState>>,
    desired: RefCell<Vec<DesiredEntry>>,
    profiles: RefCell<BTreeMap<String, Profile>>,
    active_profile: RefCell<Option<String>>,
    /// canonical idempotency key -> original receipt id (09 §9).
    executed: RefCell<BTreeMap<String, String>>,
    /// The receipts this session's applies and resets minted — the fixture
    /// surface's honest receipts listing (in memory only; the real engine
    /// reads the recorded refs from the O:I store).
    recorded_receipts: RefCell<Vec<Receipt>>,
    plan_counter: Cell<u64>,
    receipt_counter: Cell<u64>,
    /// Deterministic fixture clock (unix ms); 0 keeps tests reproducible.
    now_ms: Cell<u64>,
}

impl FixtureSurface {
    /// Load the frozen contribution and profile fixtures from a
    /// `suite/configuration/cases` directory and validate every document
    /// against the C0 contract on the way in.
    pub fn from_cases_dir(dir: &Path) -> Result<Self, String> {
        let mut contributions = Vec::new();
        let mut unavailable_owners = BTreeMap::new();
        let mut registry = ContributionRegistry::new();
        for name in FIXTURE_CONTRIBUTIONS {
            let case = read_case(dir, name)?;
            let contribution: Contribution =
                serde_json::from_value(case["contribution"].clone())
                    .map_err(|error| format!("{name} does not parse: {error}"))?;
            contribution
                .validate()
                .map_err(|error| format!("{name} violates the contribution contract: {error}"))?;
            if contribution
                .availability
                .as_ref()
                .is_some_and(|availability| {
                    availability.state == crate::configuration::AvailabilityState::Unavailable
                })
            {
                let reason = contribution
                    .availability
                    .as_ref()
                    .and_then(|availability| availability.reason.clone())
                    .unwrap_or_else(|| "owner unavailable".to_owned());
                unavailable_owners.insert(contribution.owner.owner_ref.clone(), reason);
            }
            registry
                .register(&contribution)
                .map_err(|error| format!("{name} cannot register: {error}"))?;
            contributions.push(contribution);
        }
        let profile_case = read_case(dir, FIXTURE_PROFILE)?;
        let profile: Profile = serde_json::from_value(profile_case["profile"].clone())
            .map_err(|error| format!("{FIXTURE_PROFILE} does not parse: {error}"))?;
        profile
            .validate()
            .map_err(|error| format!("{FIXTURE_PROFILE} is invalid: {error}"))?;
        let surface = Self {
            contributions,
            registry,
            unavailable_owners,
            native: RefCell::new(BTreeMap::new()),
            stages: RefCell::new(BTreeMap::new()),
            desired: RefCell::new(Vec::new()),
            profiles: RefCell::new(BTreeMap::new()),
            active_profile: RefCell::new(None),
            executed: RefCell::new(BTreeMap::new()),
            recorded_receipts: RefCell::new(Vec::new()),
            plan_counter: Cell::new(0),
            receipt_counter: Cell::new(0),
            now_ms: Cell::new(0),
        };
        // Seed the simulated owner-native baseline: constant defaults are the
        // only values an owner discloses as its baseline (09 §2.2); computed
        // defaults stay uncopied — a forbidden storage class.
        for listed in ConfigSurface::list(&surface).expect("fixture surface lists its own settings")
        {
            if listed.setting.default_semantics
                == Some(crate::configuration::DefaultSemantics::Constant)
            {
                if let Some(default) = &listed.setting.default {
                    surface.native.borrow_mut().insert(
                        listed.setting.setting_ref.clone(),
                        NativeFact {
                            value: Some(default.clone()),
                            ..NativeFact::default()
                        },
                    );
                }
            }
        }
        // Seed the fixture profile as inspectable desired state.
        validate_profile(&profile, &surface.registry)?;
        surface
            .profiles
            .borrow_mut()
            .insert(profile.profile_ref.clone(), profile);
        Ok(surface)
    }

    /// Share one surface as both seam halves (the CLI binds the pair; state
    /// is shared so a set and an apply in one process agree).
    pub fn into_surfaces(self: Rc<Self>) -> (Rc<dyn ConfigSurface>, Rc<dyn ProfileSurface>) {
        let config: Rc<dyn ConfigSurface> = self.clone();
        let profiles: Rc<dyn ProfileSurface> = self;
        (config, profiles)
    }

    fn contribution_of(&self, owner_ref: &str) -> Option<&Contribution> {
        self.contributions
            .iter()
            .find(|contribution| contribution.owner.owner_ref == owner_ref)
    }

    /// The owner part of a setting ref, `connector/` prefix intact.
    fn owner_of(setting_ref: &str) -> Option<String> {
        parse_setting_ref(setting_ref).ok().map(|parts| {
            if parts.is_connector {
                format!("connector/{}", parts.owner_ref)
            } else {
                parts.owner_ref
            }
        })
    }

    /// Explicit addressing (09 §5/§13): unknown owners, unavailable owners,
    /// unknown settings and malformed refs each get their own frozen code —
    /// never a silent fallback.
    fn resolve_spec(&self, setting_ref: &str) -> SurfaceResult<SettingSpec> {
        if let Err(error) = parse_setting_ref(setting_ref) {
            return Err(SurfaceError::new(
                ErrorCode::UnsupportedSetting,
                format!("`{setting_ref}`: {}", error.message()),
            )
            .setting(setting_ref));
        }
        let Some(owner_ref) = Self::owner_of(setting_ref) else {
            return Err(SurfaceError::new(
                ErrorCode::UnsupportedSetting,
                format!("`{setting_ref}` names no owner"),
            )
            .setting(setting_ref));
        };
        if let Some(reason) = self.unavailable_owners.get(&owner_ref) {
            return Err(SurfaceError::new(
                ErrorCode::OwnerUnavailable,
                format!("owner `{owner_ref}` is unavailable on this machine: {reason}"),
            )
            .setting(setting_ref)
            .retryable());
        }
        if self.contribution_of(&owner_ref).is_none() {
            return Err(SurfaceError::new(
                ErrorCode::UnsupportedSetting,
                format!("no owner `{owner_ref}` contributed settings here"),
            )
            .setting(setting_ref));
        }
        self.registry
            .lookup(setting_ref)
            .map(|entry| entry.spec.clone())
            .ok_or_else(|| {
                SurfaceError::new(
                    ErrorCode::UnsupportedSetting,
                    format!("`{setting_ref}` is not in any contribution"),
                )
                .setting(setting_ref)
            })
    }

    /// The frozen scope decision, phrased as an explicit error (09 §5).
    fn check_scope(&self, setting_ref: &str, scope: &Scope) -> SurfaceResult<()> {
        scope.validate().map_err(|error| {
            SurfaceError::new(
                ErrorCode::UnsupportedScope,
                format!("`{setting_ref}`: {}", error.message()),
            )
            .setting(setting_ref)
            .scope(scope)
        })?;
        match self.registry.scope_decision(setting_ref, scope) {
            ScopeDecision::Supported => Ok(()),
            ScopeDecision::UnsupportedScope => {
                let allowed = self
                    .registry
                    .lookup(setting_ref)
                    .map(|entry| {
                        entry
                            .spec
                            .allowed_scopes
                            .iter()
                            .map(|allowed| match &allowed.scope_ref {
                                Some(reference) => {
                                    format!("{}:{reference}", allowed.scope_kind.as_wire())
                                }
                                None => allowed.scope_kind.as_wire().to_owned(),
                            })
                            .collect::<Vec<_>>()
                            .join(", ")
                    })
                    .unwrap_or_default();
                Err(SurfaceError::new(
                    ErrorCode::UnsupportedScope,
                    format!(
                        "`{setting_ref}` is not addressable at scope `{}`; allowed: {allowed}",
                        scope.compact()
                    ),
                )
                .setting(setting_ref)
                .scope(scope))
            }
            ScopeDecision::UnknownScopeKind => Err(SurfaceError::new(
                ErrorCode::UnknownScopeKind,
                format!(
                    "scope kind `{}` is outside the frozen registry",
                    scope.scope_kind.as_wire()
                ),
            )
            .setting(setting_ref)
            .scope(scope)),
        }
    }

    /// Contribution-level shape checks plus the secret law (09 §14): a
    /// secret-kind request carries a reference and never a value.
    fn normalize_request(
        &self,
        request: &ChangeRequest,
    ) -> SurfaceResult<(SettingSpec, RequestedChange)> {
        let spec = self.resolve_spec(&request.setting_ref)?;
        self.check_scope(&request.setting_ref, &request.scope)?;
        if !spec.writable {
            return Err(SurfaceError::new(
                ErrorCode::UnsupportedSetting,
                format!("`{}` is disclosed as not writable", request.setting_ref),
            )
            .setting(&request.setting_ref)
            .scope(&request.scope));
        }
        Ok((spec.clone(), self.normalize_value_law(&spec, request)?))
    }

    /// Normalise a desired entry for profile editing: the same addressing,
    /// secret law and shape checks as any change request, without the
    /// apply-time writability gate — a profile holds desired intent, and
    /// writability stays the owner's apply-time decision.
    fn normalize_desired_entry(&self, request: &ChangeRequest) -> SurfaceResult<RequestedChange> {
        let spec = self.resolve_spec(&request.setting_ref)?;
        self.check_scope(&request.setting_ref, &request.scope)?;
        self.normalize_value_law(&spec, request)
    }

    /// The shared secret law and shape checks of both normalisations.
    fn normalize_value_law(
        &self,
        spec: &SettingSpec,
        request: &ChangeRequest,
    ) -> SurfaceResult<RequestedChange> {
        let mut value = request.value.clone();
        let mut secret_reference = request.secret_reference.clone();
        match spec.value_schema.kind {
            ValueKind::Secret => {
                if secret_reference.is_none() {
                    // The CLI surface passes the owner-namespace reference as
                    // the value argument for secret-kind settings; it never
                    // carries material.
                    let Some(Value::String(reference)) = value.take() else {
                        return Err(SurfaceError::new(
                            ErrorCode::InvalidValue,
                            format!(
                                "`{}` is secret-kind: pass the owner-namespace secret reference, never a material value",
                                request.setting_ref
                            ),
                        )
                        .setting(&request.setting_ref)
                        .scope(&request.scope));
                    };
                    secret_reference =
                        Some(crate::configuration::SecretReferenceValue { ref_: reference });
                }
                value = None;
            }
            _ => {
                if secret_reference.is_some() {
                    return Err(SurfaceError::new(
                        ErrorCode::InvalidValue,
                        format!(
                            "`{}` is not secret-kind; `secret_reference` belongs to secret-kind settings only",
                            request.setting_ref
                        ),
                    )
                    .setting(&request.setting_ref)
                    .scope(&request.scope));
                }
                if value.is_none() {
                    return Err(SurfaceError::new(
                        ErrorCode::InvalidValue,
                        format!("`{}` carries no value", request.setting_ref),
                    )
                    .setting(&request.setting_ref)
                    .scope(&request.scope));
                }
                self.check_value_shape(spec, value.as_ref().unwrap())?;
            }
        }
        Ok(RequestedChange {
            setting_ref: request.setting_ref.clone(),
            scope: request.scope.clone(),
            value,
            // The wire form carries the reference without presence:
            // presence is observed-only and never stored (09 §14).
            secret_reference: secret_reference.map(|reference| SecretReference {
                ref_: reference.ref_,
                present: None,
            }),
        })
    }

    /// The disclosed `value_schema` is a validation hint; the owner's native
    /// validation stays authoritative (09 §2.3). This checks only shape.
    fn check_value_shape(&self, spec: &SettingSpec, value: &Value) -> SurfaceResult<()> {
        let refused = |message: String| {
            SurfaceError::new(
                ErrorCode::InvalidValue,
                format!(
                    "disclosed schema rejects the value for `{}` ({message}); the owner's native validation remains authoritative",
                    spec.setting_ref
                ),
            )
            .setting(&spec.setting_ref)
        };
        match spec.value_schema.kind {
            ValueKind::Boolean => {
                if !value.is_boolean() {
                    return Err(refused("expected true or false".into()));
                }
            }
            ValueKind::Number => {
                if !value.is_number() {
                    return Err(refused("expected a number".into()));
                }
            }
            ValueKind::Integer => match value.as_i64() {
                None => return Err(refused("expected an integer".into())),
                Some(integer) => {
                    if spec
                        .value_schema
                        .minimum
                        .is_some_and(|minimum| (integer as f64) < minimum)
                        || spec
                            .value_schema
                            .maximum
                            .is_some_and(|maximum| (integer as f64) > maximum)
                    {
                        return Err(refused("integer outside the disclosed range".into()));
                    }
                }
            },
            ValueKind::Enum => {
                let matches = spec
                    .value_schema
                    .options
                    .as_ref()
                    .is_some_and(|options| options.iter().any(|option| &option.value == value));
                if !matches {
                    return Err(refused("value is not one of the disclosed options".into()));
                }
            }
            ValueKind::Table => {
                if !value.is_object() {
                    return Err(refused("expected a JSON object".into()));
                }
            }
            ValueKind::List if !value.is_array() => {
                return Err(refused("expected a JSON array".into()));
            }
            _ => {}
        }
        Ok(())
    }

    fn next_plan_id(&self) -> String {
        self.plan_counter.set(self.plan_counter.get() + 1);
        format!("fixture-plan-{}", self.plan_counter.get())
    }

    fn next_receipt_id(&self) -> String {
        self.receipt_counter.set(self.receipt_counter.get() + 1);
        format!("fixture-receipt-{}", self.receipt_counter.get())
    }

    /// The owner-native plan for one already-normalised request.
    fn plan_normalized(
        &self,
        spec: &SettingSpec,
        requested: &RequestedChange,
    ) -> SurfaceResult<ConfigPlan> {
        let owner_ref = Self::owner_of(&requested.setting_ref).ok_or_else(|| {
            SurfaceError::new(ErrorCode::Internal, "normalised request lost its owner")
        })?;
        if let Some(reason) = self.unavailable_owners.get(&owner_ref) {
            return Err(SurfaceError::new(
                ErrorCode::OwnerUnavailable,
                format!("owner `{owner_ref}` cannot plan: {reason}"),
            )
            .setting(&requested.setting_ref)
            .scope(&requested.scope)
            .retryable());
        }
        if !requested.setting_ref.is_empty() && !spec.operations.plan {
            return Err(SurfaceError::new(
                ErrorCode::UnsupportedSetting,
                format!("`{}` discloses no plan capability", requested.setting_ref),
            )
            .setting(&requested.setting_ref)
            .scope(&requested.scope));
        }
        let subject = requested
            .secret_reference
            .as_ref()
            .map(|reference| format!("secret reference `{}`", reference.ref_))
            .unwrap_or_else(|| format!("value {}", requested.value.clone().unwrap_or(Value::Null)));
        let plan = ConfigPlan {
            schema: CONFIG_PLAN_SCHEMA.to_owned(),
            plan_id: self.next_plan_id(),
            plan_digest: String::new(),
            setting_ref: requested.setting_ref.clone(),
            scope: requested.scope.clone(),
            changes: vec![PlanChange {
                summary: format!(
                    "owner `{owner_ref}` applies {subject} at `{}`",
                    requested.scope.compact()
                ),
                native_ref: spec.native_ref.clone(),
                before_ref: None,
                after_ref: None,
            }],
            expected_effect: spec.effect.clone(),
            expires_at_unix_ms: Some(self.now_ms.get() + 600_000),
            explain_ref: spec.effect.ref_.clone(),
        };
        let mut digested = plan.clone();
        digested.plan_digest = digested.canonical_digest();
        Ok(digested)
    }

    /// The desired entry this surface holds for a setting at a scope.
    fn held_desired(&self, setting_ref: &str, scope: &Scope) -> Option<DesiredEntry> {
        self.desired
            .borrow()
            .iter()
            .find(|entry| entry.setting_ref == setting_ref && entry.scope == *scope)
            .cloned()
    }

    fn record_desired(&self, requested: &RequestedChange) {
        let mut desired = self.desired.borrow_mut();
        desired.retain(|entry| {
            !(entry.setting_ref == requested.setting_ref && entry.scope == requested.scope)
        });
        desired.push(DesiredEntry {
            setting_ref: requested.setting_ref.clone(),
            scope: requested.scope.clone(),
            value: requested.value.clone(),
            secret_reference: requested.secret_reference.as_ref().map(|reference| {
                crate::configuration::SecretReferenceValue {
                    ref_: reference.ref_.clone(),
                }
            }),
        });
    }

    /// The desired entries this surface holds for the composed World:
    /// explicit O:I sets first, then the active profile's entries (09 §12
    /// resolution order; the active mark is the explicit `use` only).
    fn composed_desired(&self) -> Vec<DesiredEntry> {
        let mut entries = self.desired.borrow().clone();
        let active = self.active_profile.borrow().clone();
        if let Some(profile_ref) = active {
            let profile = self.profiles.borrow().get(&profile_ref).cloned();
            if let Some(profile) = profile {
                for entry in profile.desired {
                    if !entries.iter().any(|held| {
                        held.setting_ref == entry.setting_ref && held.scope == entry.scope
                    }) {
                        entries.push(entry);
                    }
                }
            }
        }
        entries
    }

    fn owner_available(&self, setting_ref: &str) -> bool {
        Self::owner_of(setting_ref)
            .map(|owner| !self.unavailable_owners.contains_key(&owner))
            .unwrap_or(false)
    }

    /// Build the frozen resolution reading for one setting/scope with an
    /// explicit desired entry (held state or a caller-supplied entry).
    fn build_resolution(
        &self,
        setting_ref: &str,
        scope: &Scope,
        desired: Option<DesiredEntry>,
    ) -> SurfaceResult<Resolution> {
        // Explicit addressing: unknown settings, unavailable owners and
        // unsupported scopes are errors here, never readings.
        self.resolve_spec(setting_ref)?;
        self.check_scope(setting_ref, scope)?;
        let native = self.native.borrow();
        let fact = native.get(setting_ref);
        let provenance = || crate::configuration::Provenance {
            owner_ref: Some(Self::owner_of(setting_ref).unwrap_or_default()),
            path: Some("fixture owner baseline".to_owned()),
            observed_at_unix_ms: Some(self.now_ms.get()),
        };
        let axis = |fact: Option<&NativeFact>| {
            fact.and_then(|fact| fact.value.clone())
                .map(|value| NativeAxis {
                    value: Some(value),
                    provenance: Some(provenance()),
                    materialisation_ref: None,
                    stage_state: None,
                })
        };
        let native_axes = if fact.is_some() {
            Some(NativeAxes {
                declared: axis(fact),
                effective: axis(fact),
                active: None,
                staged: None,
            })
        } else {
            None
        };
        let stage_state = self
            .stages
            .borrow()
            .get(setting_ref)
            .copied()
            .unwrap_or(StageState::None);
        let desired_document = desired.map(|entry| Desired {
            value: entry.value,
            // Presence is observed-only; it is never stored as desired state
            // (09 §14).
            secret_reference: entry.secret_reference.map(|reference| SecretReference {
                ref_: reference.ref_,
                present: None,
            }),
            source_ref: Some("fixture-desired".to_owned()),
            set_at_unix_ms: Some(self.now_ms.get()),
        });
        let desired_value = desired_document
            .as_ref()
            .and_then(|desired| desired.value.as_ref());
        let native_effective = native_axes
            .as_ref()
            .and_then(|axes| axes.effective.as_ref())
            .and_then(|axis| axis.value.as_ref());
        let native_declared = native_axes
            .as_ref()
            .and_then(|axes| axes.declared.as_ref())
            .and_then(|axis| axis.value.as_ref());
        let status = reconcile(ReconciliationInputs {
            desired: desired_value,
            native_effective,
            native_declared,
            stage_state,
            owner_available: self.owner_available(setting_ref),
            setting_supported: true,
        });
        let reason = match status {
            ReconciliationStatus::Drifted => {
                Some("desired differs from native effective".to_owned())
            }
            ReconciliationStatus::Unknown => {
                Some("no native axes were disclosed for this setting".to_owned())
            }
            _ => None,
        };
        let resolution = Resolution {
            schema: crate::configuration::RESOLUTION_SCHEMA.to_owned(),
            setting_ref: setting_ref.to_owned(),
            scope: scope.clone(),
            desired: desired_document,
            native: native_axes,
            native_reading: Some(crate::configuration::NativeReading {
                reading_digest: Some(sha256_hex(
                    serde_json::to_string(&*native)
                        .unwrap_or_default()
                        .as_bytes(),
                )),
                observed_at_unix_ms: Some(self.now_ms.get()),
            }),
            reconciliation: crate::configuration::Reconciliation {
                status,
                reason,
                detail_ref: None,
            },
        };
        crate::configuration::validate_resolution(&resolution, &self.registry)
            .map_err(|error| SurfaceError::new(ErrorCode::Internal, error).setting(setting_ref))?;
        Ok(resolution)
    }

    fn idempotency_key_string(key: &IdempotencyKey) -> String {
        format!(
            "{}|{}|{}|{}|{}",
            key.owner_ref,
            key.changeset_id,
            key.setting_ref,
            key.scope.compact(),
            key.plan_digest.clone().unwrap_or_default()
        )
    }

    fn apply_one(
        &self,
        request: &ChangeRequest,
    ) -> SurfaceResult<(SettingSpec, RequestedChange, ConfigPlan)> {
        let (spec, requested_change) = self.normalize_request(request)?;
        let plan = self.plan_normalized(&spec, &requested_change)?;
        Ok((spec, requested_change, plan))
    }
}

fn read_case(dir: &Path, name: &str) -> Result<Value, String> {
    let path = dir.join(format!("{name}.json"));
    let raw = std::fs::read_to_string(&path)
        .map_err(|error| format!("cannot read {}: {error}", path.display()))?;
    serde_json::from_str(&raw).map_err(|error| format!("{name} is not JSON: {error}"))
}

impl ConfigSurface for FixtureSurface {
    fn discover(&self) -> SurfaceResult<Vec<OwnerContribution>> {
        Ok(self
            .contributions
            .iter()
            .map(|contribution| {
                if let Some(reason) = self.unavailable_owners.get(&contribution.owner.owner_ref) {
                    OwnerContribution::Unavailable {
                        owner_ref: contribution.owner.owner_ref.clone(),
                        reason: reason.clone(),
                        obligations: contribution.obligations.clone().unwrap_or_default(),
                    }
                } else {
                    OwnerContribution::Available(contribution.clone())
                }
            })
            .collect())
    }

    fn list(&self) -> SurfaceResult<Vec<ListedSetting>> {
        let mut listed = Vec::new();
        for contribution in &self.contributions {
            if self
                .unavailable_owners
                .contains_key(&contribution.owner.owner_ref)
            {
                continue;
            }
            for section in &contribution.sections {
                for setting in &section.settings {
                    listed.push(ListedSetting {
                        owner_ref: contribution.owner.owner_ref.clone(),
                        setting: setting.clone(),
                    });
                }
            }
        }
        Ok(listed)
    }

    fn resolve(&self, setting_ref: &str, scope: &Scope) -> SurfaceResult<Resolution> {
        let desired = self.held_desired(setting_ref, scope);
        self.build_resolution(setting_ref, scope, desired)
    }

    fn resolve_entry(&self, entry: &DesiredEntry) -> SurfaceResult<Resolution> {
        self.build_resolution(&entry.setting_ref, &entry.scope, Some(entry.clone()))
    }

    fn desired_entries(&self) -> SurfaceResult<Vec<DesiredEntry>> {
        Ok(self.composed_desired())
    }

    fn diff(&self) -> SurfaceResult<Vec<Resolution>> {
        let entries = self.desired_entries()?;
        entries
            .iter()
            .map(|entry| self.resolve_entry(entry))
            .collect()
    }

    fn assemble(
        &self,
        changeset_id: &str,
        requests: &[ChangeRequest],
        profile_ref: Option<&str>,
    ) -> SurfaceResult<ChangeSet> {
        if requests.is_empty() {
            return Err(SurfaceError::new(
                ErrorCode::InvalidValue,
                "a ChangeSet carries at least one requested change",
            ));
        }
        let mut requested = Vec::new();
        let mut operations = Vec::new();
        for (index, change) in requests.iter().enumerate() {
            let (_, normalized) = self.normalize_request(change)?;
            requested.push(normalized.clone());
            operations.push(Operation {
                op_id: format!("op-{}", index + 1),
                depends_on: Some(Vec::new()),
                owner_ref: Self::owner_of(&normalized.setting_ref)
                    .unwrap_or_else(|| normalized.setting_ref.clone()),
                setting_ref: normalized.setting_ref.clone(),
                scope: normalized.scope.clone(),
                kind: OperationKind::Apply,
                plan_digest: None,
                plan_ref: None,
                status: OperationStatus::Planned,
                receipt_ref: None,
                error: None,
            });
        }
        let changeset = ChangeSet {
            schema: crate::configuration::CHANGSET_SCHEMA.to_owned(),
            changeset_id: changeset_id.to_owned(),
            created_at_unix_ms: self.now_ms.get(),
            profile_ref: profile_ref.map(str::to_owned),
            requested,
            operations,
            verification: None,
            status: crate::configuration::ChangeSetStatus::Planned,
            authority: None,
        };
        validate_changeset(&changeset, &self.registry)
            .map_err(|error| SurfaceError::new(ErrorCode::Internal, error))?;
        Ok(changeset)
    }

    fn plan(&self, request: &ChangeRequest) -> SurfaceResult<ConfigPlan> {
        let (spec, normalized) = self.normalize_request(request)?;
        self.plan_normalized(&spec, &normalized)
    }

    fn apply(
        &self,
        changeset_id: &str,
        requests: &[ChangeRequest],
        profile_ref: Option<&str>,
    ) -> SurfaceResult<AppliedChange> {
        if requests.is_empty() {
            return Err(SurfaceError::new(
                ErrorCode::InvalidValue,
                "a ChangeSet carries at least one requested change",
            ));
        }
        // Phase 1 — every request must address explicitly before anything
        // runs: unknown settings, unsupported scopes, unwritable settings and
        // secret-law violations abort the whole application with their frozen
        // error (09 §5/§13/§14). Per-operation truth then covers owner-side
        // execution, as the C0 partial-apply fixture pins.
        let mut prepared = Vec::with_capacity(requests.len());
        for change in requests {
            prepared.push(self.apply_one(change)?);
        }
        let mut requested = Vec::new();
        let mut operations = Vec::new();
        let mut receipts = Vec::new();
        let mut applied_setting_scopes = Vec::new();
        for (index, (spec, normalized, plan)) in prepared.into_iter().enumerate() {
            let op_id = format!("op-{}", index + 1);
            let owner_ref = Self::owner_of(&normalized.setting_ref).unwrap_or_default();
            requested.push(normalized.clone());
            let key = IdempotencyKey {
                owner_ref: owner_ref.clone(),
                changeset_id: changeset_id.to_owned(),
                setting_ref: normalized.setting_ref.clone(),
                scope: normalized.scope.clone(),
                plan_digest: Some(plan.plan_digest.clone()),
            };
            let key_string = Self::idempotency_key_string(&key);
            let replayed = self.executed.borrow().get(&key_string).cloned();
            let receipt = match replayed {
                Some(original_receipt_id) => {
                    // Idempotent replay (09 §9): the owner did not
                    // re-execute, and names the executed receipt.
                    Receipt {
                        schema: crate::configuration::RECEIPT_SCHEMA.to_owned(),
                        receipt_id: self.next_receipt_id(),
                        owner_ref: owner_ref.clone(),
                        changeset_id: changeset_id.to_owned(),
                        plan_digest: Some(plan.plan_digest.clone()),
                        setting_ref: normalized.setting_ref.clone(),
                        scope: normalized.scope.clone(),
                        operation: OperationKind::Apply,
                        outcome: ReceiptOutcome::NoOp,
                        applied_at_unix_ms: self.now_ms.get(),
                        native_ref: spec.native_ref.clone(),
                        expected_effect: Some(spec.effect.clone()),
                        original_receipt_id: Some(original_receipt_id),
                        error: None,
                    }
                }
                None => {
                    // Owner-native apply against the simulated owner.
                    {
                        let mut native = self.native.borrow_mut();
                        let fact = native.entry(normalized.setting_ref.clone()).or_default();
                        if let Some(reference) = &normalized.secret_reference {
                            fact.secret_ref = Some(reference.ref_.clone());
                            fact.secret_present = Some(true);
                            fact.value = None;
                        } else {
                            fact.value = normalized.value.clone();
                        }
                    }
                    self.record_desired(&normalized);
                    let receipt_id = self.next_receipt_id();
                    self.executed
                        .borrow_mut()
                        .insert(key_string, receipt_id.clone());
                    Receipt {
                        schema: crate::configuration::RECEIPT_SCHEMA.to_owned(),
                        receipt_id,
                        owner_ref: owner_ref.clone(),
                        changeset_id: changeset_id.to_owned(),
                        plan_digest: Some(plan.plan_digest.clone()),
                        setting_ref: normalized.setting_ref.clone(),
                        scope: normalized.scope.clone(),
                        operation: OperationKind::Apply,
                        outcome: ReceiptOutcome::Applied,
                        applied_at_unix_ms: self.now_ms.get(),
                        native_ref: spec.native_ref.clone(),
                        expected_effect: Some(spec.effect.clone()),
                        original_receipt_id: None,
                        error: None,
                    }
                }
            };
            operations.push(Operation {
                op_id,
                depends_on: Some(Vec::new()),
                owner_ref,
                setting_ref: normalized.setting_ref.clone(),
                scope: normalized.scope.clone(),
                kind: OperationKind::Apply,
                plan_digest: Some(plan.plan_digest.clone()),
                plan_ref: Some(plan.plan_id.clone()),
                status: OperationStatus::Applied,
                receipt_ref: Some(receipt.receipt_id.clone()),
                error: None,
            });
            applied_setting_scopes.push((normalized.setting_ref.clone(), normalized.scope.clone()));
            self.recorded_receipts.borrow_mut().push(receipt.clone());
            receipts.push(receipt);
        }
        // Re-read verification (09 §9): reconcile every applied setting and
        // settle each operation on the re-read evidence.
        let mut reconciliations = Vec::new();
        for (setting_ref, scope) in &applied_setting_scopes {
            let status = self
                .resolve(setting_ref, scope)
                .map(|resolution| resolution.reconciliation.status)
                .unwrap_or(ReconciliationStatus::Unsupported);
            reconciliations.push(crate::configuration::VerificationEntry {
                setting_ref: setting_ref.clone(),
                status,
            });
            for operation in operations.iter_mut() {
                if operation.setting_ref == *setting_ref && operation.scope == *scope {
                    operation.status = OperationStatus::Verified;
                }
            }
        }
        let native = self.native.borrow();
        let verification = crate::configuration::Verification {
            reading_digest: Some(sha256_hex(
                serde_json::to_string(&*native)
                    .unwrap_or_default()
                    .as_bytes(),
            )),
            observed_at_unix_ms: self.now_ms.get(),
            reconciliations,
        };
        drop(native);
        let changeset = ChangeSet {
            schema: crate::configuration::CHANGSET_SCHEMA.to_owned(),
            changeset_id: changeset_id.to_owned(),
            created_at_unix_ms: self.now_ms.get(),
            profile_ref: profile_ref.map(str::to_owned),
            status: derive_changeset_status(&operations, Some(&verification)),
            requested,
            operations,
            verification: Some(verification),
            authority: None,
        };
        validate_changeset(&changeset, &self.registry)
            .map_err(|error| SurfaceError::new(ErrorCode::Internal, error))?;
        Ok(AppliedChange {
            changeset,
            receipts,
        })
    }

    fn reset(&self, setting_ref: &str, scope: &Scope) -> SurfaceResult<AppliedChange> {
        let spec = self.resolve_spec(setting_ref)?;
        self.check_scope(setting_ref, scope)?;
        if !spec.writable || !spec.operations.reset {
            return Err(SurfaceError::new(
                ErrorCode::UnsupportedSetting,
                format!("`{setting_ref}` discloses no reset capability"),
            )
            .setting(setting_ref)
            .scope(scope));
        }
        let owner_ref = Self::owner_of(setting_ref).unwrap_or_default();
        // Withdraw the O:I desired entry and return the owner fact to its
        // disclosed constant default, or to honest absence.
        self.desired
            .borrow_mut()
            .retain(|entry| !(entry.setting_ref == setting_ref && entry.scope == *scope));
        {
            let mut native = self.native.borrow_mut();
            if spec.default_semantics == Some(crate::configuration::DefaultSemantics::Constant) {
                if let Some(default) = &spec.default {
                    let fact = native.entry(setting_ref.to_owned()).or_default();
                    fact.value = Some(default.clone());
                }
            } else {
                native.remove(setting_ref);
            }
        }
        let receipt_id = self.next_receipt_id();
        let receipt = Receipt {
            schema: crate::configuration::RECEIPT_SCHEMA.to_owned(),
            receipt_id: receipt_id.clone(),
            owner_ref: owner_ref.clone(),
            changeset_id: format!("cs-reset-{}", receipt_id.trim_start_matches("fixture-")),
            plan_digest: None,
            setting_ref: setting_ref.to_owned(),
            scope: scope.clone(),
            operation: OperationKind::Reset,
            outcome: ReceiptOutcome::Applied,
            applied_at_unix_ms: self.now_ms.get(),
            native_ref: spec.native_ref.clone(),
            expected_effect: Some(spec.effect.clone()),
            original_receipt_id: None,
            error: None,
        };
        let requested = vec![RequestedChange {
            setting_ref: setting_ref.to_owned(),
            scope: scope.clone(),
            value: None,
            secret_reference: None,
        }];
        let resolution = self.resolve(setting_ref, scope)?;
        let operations = vec![Operation {
            op_id: "op-1".to_owned(),
            depends_on: Some(Vec::new()),
            owner_ref,
            setting_ref: setting_ref.to_owned(),
            scope: scope.clone(),
            kind: OperationKind::Reset,
            plan_digest: None,
            plan_ref: None,
            status: OperationStatus::Verified,
            receipt_ref: Some(receipt_id),
            error: None,
        }];
        let native = self.native.borrow();
        let verification = crate::configuration::Verification {
            reading_digest: Some(sha256_hex(
                serde_json::to_string(&*native)
                    .unwrap_or_default()
                    .as_bytes(),
            )),
            observed_at_unix_ms: self.now_ms.get(),
            reconciliations: vec![crate::configuration::VerificationEntry {
                setting_ref: setting_ref.to_owned(),
                status: resolution.reconciliation.status,
            }],
        };
        drop(native);
        let changeset = ChangeSet {
            schema: crate::configuration::CHANGSET_SCHEMA.to_owned(),
            changeset_id: format!(
                "cs-reset-{}",
                receipt.receipt_id.trim_start_matches("fixture-")
            ),
            created_at_unix_ms: self.now_ms.get(),
            profile_ref: None,
            status: derive_changeset_status(&operations, Some(&verification)),
            requested,
            operations,
            verification: Some(verification),
            authority: None,
        };
        validate_changeset(&changeset, &self.registry)
            .map_err(|error| SurfaceError::new(ErrorCode::Internal, error))?;
        self.recorded_receipts.borrow_mut().push(receipt.clone());
        Ok(AppliedChange {
            changeset,
            receipts: vec![receipt],
        })
    }

    fn doctor(&self) -> SurfaceResult<Vec<DoctorFinding>> {
        let mut findings = Vec::new();
        // Absent owners are findings, never silence (09 §4).
        for owner in self.discover()? {
            if let OwnerContribution::Unavailable {
                owner_ref, reason, ..
            } = owner
            {
                findings.push(DoctorFinding {
                    classification: DoctorClassification::OwnerUnavailable,
                    owner_ref: Some(owner_ref),
                    setting_ref: None,
                    scope: None,
                    reconciliation_status: None,
                    effect_kind: None,
                    error_code: Some(ErrorCode::OwnerUnavailable.as_wire().to_owned()),
                    message: format!("owner unavailable: {reason}"),
                });
            }
        }
        // Every held desired entry is judged by the frozen truth table.
        for entry in self.desired_entries()? {
            let scope = entry.scope.clone();
            let setting_ref = entry.setting_ref.clone();
            let effect_kind = self
                .resolve_spec(&setting_ref)
                .ok()
                .map(|spec| spec.effect.kind);
            // A desired entry that violates its own contribution (e.g. a
            // secret-kind entry carrying a value) is invalid desired state.
            let shape_ok = crate::configuration::validate_resolution(
                &crate::configuration::Resolution {
                    schema: crate::configuration::RESOLUTION_SCHEMA.to_owned(),
                    setting_ref: setting_ref.clone(),
                    scope: scope.clone(),
                    desired: Some(Desired {
                        value: entry.value.clone(),
                        secret_reference: entry.secret_reference.as_ref().map(|reference| {
                            SecretReference {
                                ref_: reference.ref_.clone(),
                                present: None,
                            }
                        }),
                        source_ref: None,
                        set_at_unix_ms: None,
                    }),
                    native: None,
                    native_reading: None,
                    reconciliation: crate::configuration::Reconciliation {
                        status: ReconciliationStatus::Satisfied,
                        reason: None,
                        detail_ref: None,
                    },
                },
                &self.registry,
            );
            if let Err(error) = shape_ok {
                findings.push(DoctorFinding {
                    classification: DoctorClassification::InvalidDesiredState,
                    owner_ref: Self::owner_of(&setting_ref),
                    setting_ref: Some(setting_ref),
                    scope: Some(scope),
                    reconciliation_status: None,
                    effect_kind,
                    error_code: Some(ErrorCode::InvalidValue.as_wire().to_owned()),
                    message: error,
                });
                continue;
            }
            let classification = match self.resolve_entry(&entry) {
                Ok(resolution) => {
                    let status = resolution.reconciliation.status;
                    if status == ReconciliationStatus::Blocked
                        && !self.owner_available(&setting_ref)
                    {
                        Some(DoctorClassification::OwnerUnavailable)
                    } else {
                        crate::config_surface::classify_reconciliation(status)
                    }
                }
                Err(error) => {
                    // The entry addresses something unaddressable: an
                    // explicit scope/setting failure, never a guess.
                    match error.code {
                        ErrorCode::UnsupportedScope | ErrorCode::UnknownScopeKind => {
                            Some(DoctorClassification::UnsupportedScope)
                        }
                        ErrorCode::OwnerUnavailable => Some(DoctorClassification::OwnerUnavailable),
                        _ => Some(DoctorClassification::InvalidDesiredState),
                    }
                }
            };
            if let Some(classification) = classification {
                let status = self
                    .resolve_entry(&entry)
                    .ok()
                    .map(|resolution| resolution.reconciliation.status);
                findings.push(DoctorFinding {
                    classification,
                    owner_ref: Self::owner_of(&setting_ref),
                    setting_ref: Some(setting_ref),
                    scope: Some(scope),
                    reconciliation_status: status,
                    effect_kind,
                    error_code: None,
                    message: "reconciliation is not satisfied for this desired entry".to_owned(),
                });
            }
        }
        Ok(findings)
    }

    fn receipts(&self) -> SurfaceResult<Vec<ReceiptSummary>> {
        // The fixture's session-applied receipts, in mint order — in memory
        // only. The real engine reads the recorded refs from the O:I store.
        Ok(self
            .recorded_receipts
            .borrow()
            .iter()
            .map(|receipt| ReceiptSummary {
                receipt_id: receipt.receipt_id.clone(),
                owner_ref: receipt.owner_ref.clone(),
                changeset_id: receipt.changeset_id.clone(),
                setting_ref: receipt.setting_ref.clone(),
                scope: receipt.scope.clone(),
                operation: receipt.operation,
                outcome: receipt.outcome,
                applied_at_unix_ms: receipt.applied_at_unix_ms,
                native_ref: receipt.native_ref.clone(),
            })
            .collect())
    }
}

impl ProfileSurface for FixtureSurface {
    fn list(&self) -> SurfaceResult<Vec<ProfileSummary>> {
        let profiles = self.profiles.borrow();
        Ok(profiles
            .values()
            .map(|profile| ProfileSummary {
                profile_ref: profile.profile_ref.clone(),
                title: profile.title.clone(),
                description: profile.description.clone(),
                created_at_unix_ms: profile.created_at_unix_ms,
                revised_at_unix_ms: profile.revised_at_unix_ms,
                native_profiles: profile.native_profiles.len(),
                desired_entries: profile.desired.len(),
            })
            .collect())
    }

    fn load(&self, profile_ref: &str) -> SurfaceResult<Profile> {
        self.profiles
            .borrow()
            .get(profile_ref)
            .cloned()
            .ok_or_else(|| {
                SurfaceError::new(
                    ErrorCode::UnsupportedSetting,
                    format!("no profile `{profile_ref}` is stored"),
                )
            })
    }

    fn create(
        &self,
        profile_ref: &str,
        title: Option<String>,
        description: Option<String>,
    ) -> SurfaceResult<Profile> {
        let profile = Profile {
            schema: crate::configuration::PROFILE_SCHEMA.to_owned(),
            profile_ref: profile_ref.to_owned(),
            title,
            description,
            created_at_unix_ms: self.now_ms.get(),
            revised_at_unix_ms: self.now_ms.get(),
            native_profiles: Vec::new(),
            desired: Vec::new(),
            provenance: Some(ProfileProvenance {
                authored_by: Some(AuthoredBy::Human),
                notes_ref: None,
                imported_from_ref: None,
            }),
        };
        profile.validate().map_err(|error| {
            SurfaceError::new(ErrorCode::InvalidValue, format!("`{profile_ref}`: {error}"))
        })?;
        let mut profiles = self.profiles.borrow_mut();
        if profiles.contains_key(profile_ref) {
            return Err(SurfaceError::new(
                ErrorCode::InvalidValue,
                format!("profile `{profile_ref}` already exists"),
            ));
        }
        profiles.insert(profile_ref.to_owned(), profile.clone());
        Ok(profile)
    }

    fn clone_profile(&self, source_ref: &str, target_ref: &str) -> SurfaceResult<Profile> {
        let mut profile = self.load(source_ref)?;
        profile.profile_ref = target_ref.to_owned();
        profile.created_at_unix_ms = self.now_ms.get();
        profile.revised_at_unix_ms = self.now_ms.get();
        profile
            .validate()
            .map_err(|error| SurfaceError::new(ErrorCode::InvalidValue, error))?;
        let mut profiles = self.profiles.borrow_mut();
        if profiles.contains_key(target_ref) {
            return Err(SurfaceError::new(
                ErrorCode::InvalidValue,
                format!("profile `{target_ref}` already exists"),
            ));
        }
        profiles.insert(target_ref.to_owned(), profile.clone());
        Ok(profile)
    }

    fn set_active(&self, profile_ref: Option<&str>) -> SurfaceResult<ProfileActivation> {
        let previous = self.active_profile.borrow().clone();
        if let Some(profile_ref) = profile_ref {
            // The active mark names a stored profile or the operation fails.
            self.load(profile_ref)?;
            *self.active_profile.borrow_mut() = Some(profile_ref.to_owned());
        } else {
            *self.active_profile.borrow_mut() = None;
        }
        Ok(ProfileActivation {
            active_profile: self.active_profile.borrow().clone(),
            previous,
        })
    }

    fn active(&self) -> SurfaceResult<Option<String>> {
        Ok(self.active_profile.borrow().clone())
    }

    fn export(&self, profile_ref: &str) -> SurfaceResult<Profile> {
        // Export is the same document; secret-kind entries stay references,
        // so there is nothing to strip (09 §12).
        self.load(profile_ref)
    }

    fn import(&self, profile: &Profile, source_ref: Option<&str>) -> SurfaceResult<Profile> {
        let mut imported = profile.clone();
        imported.revised_at_unix_ms = self.now_ms.get();
        imported.provenance = Some(ProfileProvenance {
            authored_by: Some(AuthoredBy::Imported),
            notes_ref: None,
            imported_from_ref: source_ref.map(str::to_owned),
        });
        // Import stores inspectable desired state; it never applies anything
        // (09 §12). The seam validates the document and its redaction law.
        // Importing over an existing ref is the named operation's direct,
        // observable effect — provenance-stamped — never a hidden write.
        validate_profile(&imported, &self.registry)
            .map_err(|error| SurfaceError::new(ErrorCode::InvalidValue, error))?;
        self.profiles
            .borrow_mut()
            .insert(imported.profile_ref.clone(), imported.clone());
        Ok(imported)
    }

    fn edit(
        &self,
        profile_ref: &str,
        operations: &[ProfileEditOp],
    ) -> SurfaceResult<ProfileEditOutcome> {
        if operations.is_empty() {
            return Err(SurfaceError::new(
                ErrorCode::InvalidValue,
                "a profile edit carries at least one operation",
            ));
        }
        let mut profile = self.load(profile_ref)?;
        let mut applied = Vec::new();
        for operation in operations {
            match operation {
                ProfileEditOp::SetEntry {
                    setting_ref,
                    scope,
                    value,
                    secret_reference,
                } => {
                    // The same laws as any change request: explicit
                    // addressing, the secret law, the disclosed shape
                    // checks (writability stays an apply-time decision,
                    // exactly as in the engine).
                    let normalized = self.normalize_desired_entry(&ChangeRequest {
                        setting_ref: setting_ref.clone(),
                        scope: scope.clone(),
                        value: value.clone(),
                        secret_reference: secret_reference.clone(),
                    })?;
                    let entry = DesiredEntry {
                        setting_ref: normalized.setting_ref,
                        scope: normalized.scope,
                        value: normalized.value,
                        secret_reference: normalized.secret_reference.map(|reference| {
                            crate::configuration::SecretReferenceValue {
                                ref_: reference.ref_,
                            }
                        }),
                    };
                    let position = profile.desired.iter().position(|held| {
                        held.setting_ref == entry.setting_ref && held.scope == entry.scope
                    });
                    match position {
                        Some(index) => {
                            let previous = profile.desired.remove(index);
                            applied.push(ProfileEditApplied {
                                action: "entry_updated".to_owned(),
                                setting_ref: Some(entry.setting_ref.clone()),
                                scope: Some(entry.scope.clone()),
                                next: Some(entry.clone()),
                                previous: Some(previous),
                            });
                        }
                        None => {
                            applied.push(ProfileEditApplied {
                                action: "entry_added".to_owned(),
                                setting_ref: Some(entry.setting_ref.clone()),
                                scope: Some(entry.scope.clone()),
                                next: Some(entry.clone()),
                                previous: None,
                            });
                        }
                    }
                    profile.desired.push(entry);
                }
                ProfileEditOp::RemoveEntry { setting_ref, scope } => {
                    let position = match scope {
                        Some(scope) => profile.desired.iter().position(|held| {
                            held.setting_ref == *setting_ref && held.scope == *scope
                        }),
                        None => {
                            let matches: Vec<usize> = profile
                                .desired
                                .iter()
                                .enumerate()
                                .filter(|(_, held)| held.setting_ref == *setting_ref)
                                .map(|(index, _)| index)
                                .collect();
                            match matches.as_slice() {
                                [] => None,
                                [only] => Some(*only),
                                _ => {
                                    let scopes = matches
                                        .iter()
                                        .map(|index| profile.desired[*index].scope.compact())
                                        .collect::<Vec<_>>()
                                        .join(", ");
                                    return Err(SurfaceError::new(
                                        ErrorCode::InvalidValue,
                                        format!(
                                            "`{setting_ref}` is held at several scopes \
                                             ({scopes}); name the scope to remove"
                                        ),
                                    )
                                    .setting(setting_ref));
                                }
                            }
                        }
                    };
                    match position {
                        Some(index) => {
                            let previous = profile.desired.remove(index);
                            applied.push(ProfileEditApplied {
                                action: "entry_removed".to_owned(),
                                setting_ref: Some(previous.setting_ref.clone()),
                                scope: Some(previous.scope.clone()),
                                next: None,
                                previous: Some(previous),
                            });
                        }
                        None => {
                            applied.push(ProfileEditApplied {
                                action: "entry_absent".to_owned(),
                                setting_ref: Some(setting_ref.clone()),
                                scope: scope.clone(),
                                next: None,
                                previous: None,
                            });
                        }
                    }
                }
                ProfileEditOp::SetTitle(title) => {
                    profile.title = title.clone();
                    applied.push(ProfileEditApplied {
                        action: "title_set".to_owned(),
                        setting_ref: None,
                        scope: None,
                        next: None,
                        previous: None,
                    });
                }
                ProfileEditOp::SetDescription(description) => {
                    profile.description = description.clone();
                    applied.push(ProfileEditApplied {
                        action: "description_set".to_owned(),
                        setting_ref: None,
                        scope: None,
                        next: None,
                        previous: None,
                    });
                }
            }
        }
        profile.revised_at_unix_ms = self.now_ms.get();
        validate_profile(&profile, &self.registry)
            .map_err(|error| SurfaceError::new(ErrorCode::InvalidValue, error))?;
        self.profiles
            .borrow_mut()
            .insert(profile.profile_ref.clone(), profile.clone());
        Ok(ProfileEditOutcome { profile, applied })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn cases_dir() -> std::path::PathBuf {
        std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../suite/configuration/cases")
    }

    fn surface() -> Rc<FixtureSurface> {
        Rc::new(
            FixtureSurface::from_cases_dir(&cases_dir())
                .expect("the frozen fixtures load into the fixture surface"),
        )
    }

    #[test]
    fn fixture_surface_seeds_and_discovers_honestly() {
        let surface = surface();
        let owners = surface.discover().expect("discover");
        assert_eq!(owners.len(), 4, "four fixture owners");
        assert_eq!(owners.iter().filter(|owner| owner.available()).count(), 3);
        let workcell = owners
            .iter()
            .find(|owner| owner.owner_ref() == "workcell")
            .expect("the unavailable owner is discovered");
        assert!(!workcell.available());
        let listed = ConfigSurface::list(&*surface).expect("list");
        assert!(
            listed
                .iter()
                .any(|setting| setting.setting.setting_ref
                    == "ai-kit:providers:credentials.anthropic"),
            "the secret-kind setting is listed"
        );
        assert!(
            !listed
                .iter()
                .any(|setting| setting.setting.setting_ref.starts_with("workcell:")),
            "an unavailable owner fabricates no settings"
        );
    }

    #[test]
    fn enum_rejection_names_the_owner_as_authoritative() {
        let surface = surface();
        let error = surface
            .plan(&ChangeRequest {
                setting_ref: "ai-kit:resolution:model.default".into(),
                scope: crate::configuration::parse_scope_compact("project:epilogos/o-i").unwrap(),
                value: Some(Value::String("gpt-who".into())),
                secret_reference: None,
            })
            .expect_err("an undiscosed option is rejected");
        assert_eq!(error.code, ErrorCode::InvalidValue);
        assert!(error.message.contains("authoritative"));
    }

    #[test]
    fn profile_edit_applies_the_operation_set_and_names_what_changed() {
        let surface = surface();
        let scope = crate::configuration::parse_scope_compact("project:epilogos/o-i").unwrap();
        let outcome = surface
            .edit(
                "development",
                &[
                    ProfileEditOp::SetEntry {
                        setting_ref: "ai-kit:resolution:model.default".into(),
                        scope: scope.clone(),
                        value: Some(Value::String("opus".into())),
                        secret_reference: None,
                    },
                    ProfileEditOp::RemoveEntry {
                        setting_ref: "ai-kit:session:session.provider".into(),
                        scope: None,
                    },
                    ProfileEditOp::SetTitle(Some("Edited".into())),
                ],
            )
            .expect("the edit applies");
        let actions: Vec<&str> = outcome
            .applied
            .iter()
            .map(|applied| applied.action.as_str())
            .collect();
        assert_eq!(actions, ["entry_updated", "entry_removed", "title_set"]);
        assert_eq!(
            outcome.applied[0]
                .previous
                .as_ref()
                .expect("previous")
                .value,
            Some(Value::String("sonnet-next".into()))
        );
        assert_eq!(outcome.profile.desired.len(), 4);
        assert_eq!(outcome.profile.title.as_deref(), Some("Edited"));
        // The edited document is what the seam answers afterwards.
        let loaded = surface.load("development").expect("loaded");
        assert_eq!(loaded.desired.len(), 4);
        assert!(loaded
            .desired
            .iter()
            .all(|entry| entry.setting_ref != "ai-kit:session:session.provider"));

        // The same setting held at two scopes makes a scope-less removal
        // ambiguous: refused, naming the scopes, storing nothing.
        surface
            .edit(
                "development",
                &[ProfileEditOp::SetEntry {
                    setting_ref: "ai-kit:resolution:model.default".into(),
                    scope: crate::configuration::parse_scope_compact("project:other").unwrap(),
                    value: Some(Value::String("opus".into())),
                    secret_reference: None,
                }],
            )
            .expect("the second scope entry stores");
        let error = surface
            .edit(
                "development",
                &[ProfileEditOp::RemoveEntry {
                    setting_ref: "ai-kit:resolution:model.default".into(),
                    scope: None,
                }],
            )
            .expect_err("an ambiguous removal is refused");
        assert_eq!(error.code, ErrorCode::InvalidValue);
        assert!(error.message.contains("several scopes"), "{error}");
        assert_eq!(
            surface.load("development").expect("loaded").desired.len(),
            5,
            "a refused edit stores nothing"
        );

        // An empty operation set is refused too.
        let error = surface
            .edit("development", &[])
            .expect_err("an empty edit is refused");
        assert_eq!(error.code, ErrorCode::InvalidValue);
    }

    #[test]
    fn receipts_listing_reads_this_session_s_recorded_refs() {
        let surface = surface();
        assert!(
            surface.receipts().expect("receipts").is_empty(),
            "an absent history reads as empty, never invented"
        );
        let request = ChangeRequest {
            setting_ref: "ai-kit:resolution:model.default".into(),
            scope: crate::configuration::parse_scope_compact("project:epilogos/o-i").unwrap(),
            value: Some(Value::String("opus".into())),
            secret_reference: None,
        };
        let applied = surface
            .apply("cs-fixture-receipts", std::slice::from_ref(&request), None)
            .expect("apply");
        assert_eq!(applied.receipts.len(), 1);
        let listed = surface.receipts().expect("receipts");
        assert_eq!(listed.len(), 1);
        assert_eq!(listed[0].receipt_id, applied.receipts[0].receipt_id);
        assert_eq!(listed[0].changeset_id, "cs-fixture-receipts");
        assert_eq!(listed[0].outcome, ReceiptOutcome::Applied);
    }
}
