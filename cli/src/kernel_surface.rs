//! The real engine binding of the C5 seam (#299 §14/§20): the C1 kernel
//! binds [`ConfigSurface`] and the C2 profile store binds
//! [`ProfileSurface`], so `oi config` and `oi profile` run against real
//! owner executables through the frozen four-verb grammar.
//!
//! The binding adapts; it never re-decides. Wire shapes, statuses, scopes
//! and error codes come from the frozen C0 contract through the lane
//! modules:
//!
//! - **Discovery** runs C1's [`OwnerRegistry::discover_specs`] over
//!   [`product_position_specs`] with the real [`ProcessTransport`]. Every
//!   read that does not produce a conforming contribution surfaces as an
//!   `Unavailable` owner entry — data, never an error (09 §4). Connector
//!   owners need no branch here: their `connector/`-prefixed specs join the
//!   same spec list and the registry handles them like any owner.
//! - **Desired state** is not a second store. The kernel already persists
//!   every executed ChangeSet beside the receipts and reconciliation
//!   records (`$OI_HOME/configuration/`, 09 §9); the desired layer is the
//!   fold over those persisted ChangeSets, in creation order, by
//!   per-operation truth: an executed apply holds its requested change as
//!   desired, an executed reset withdraws it. The active profile composes
//!   on top for `diff`/`doctor` (09 §12 resolution order), never under it.
//! - **Application** is C1's orchestration verbatim: assemble → per-owner
//!   validate/plan/apply through the [`OwnerGateway`] → re-read
//!   verification → O:I-side persistence, returning the same ChangeSet and
//!   owner-minted receipt identity the kernel recorded.
//! - **Profiles** are C2's [`ProfileStore`] with its file-safety and
//!   redaction law; import is [`import_document`] (validates, never
//!   applies, never overwrites). The active-profile mark is read and
//!   written on `composition.json` — the same single mark the command
//!   layer owns — under the same file law as `composition.rs` (regular
//!   file, no symlinks, 0600, lock + compare-and-publish, unknown fields
//!   preserved). Writing is only ever the explicit `use`/clear.
//!
//! Fixture mode stays untouched: `OI_CONFIG_SURFACE_FIXTURES` binds
//! [`crate::fixture_surface::FixtureSurface`], which remains a test double.

use crate::config_surface::{
    classify_reconciliation, AppliedChange, ChangeRequest, ConfigPlan, ConfigSurface,
    DoctorClassification, DoctorFinding, ListedSetting, OwnerContribution, PlanChange,
    ProfileActivation, ProfileSummary, ProfileSurface, SurfaceError, SurfaceResult,
};
use crate::configuration::kernel::{
    assemble_changeset, desired_change, execute_changeset, mint_changeset_id, plan_request,
    product_position_specs, reset_setting, resolve_setting, resolve_setting_address,
    ConfigurationStore, DesiredChange, DesiredInput, KernelError, OwnerGateway, OwnerRegistry,
    PlanDocument, ProcessTransport,
};
use crate::configuration::profile_store::{
    import_document, is_valid_profile_ref, ProfileStore, StoreError,
};
use crate::configuration::{
    validate_changeset, validate_resolution, AuthoredBy, ChangeSet, Desired, DesiredEntry,
    ErrorCode, OperationKind, OperationStatus, Profile, ProfileProvenance, Reconciliation,
    ReconciliationStatus, RequestedChange, Resolution, Scope, SecretReference,
    SecretReferenceValue, SettingSpec, ValueKind, RESOLUTION_SCHEMA,
};
use serde_json::Value;
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

/// One held desired entry beside the identity of the ChangeSet that last
/// recorded it (the resolution reading's `source_ref`).
struct HeldDesired {
    entry: DesiredEntry,
    changeset_id: Option<String>,
}

/// The real configuration engine over one O:I home: the discovered owner
/// registry, the process transport to every owner executable, the kernel's
/// persistence, and the C2 profile store beside it.
pub struct KernelSurface {
    registry: OwnerRegistry,
    transport: ProcessTransport,
    store: ConfigurationStore,
    profiles: ProfileStore,
    home: PathBuf,
}

impl KernelSurface {
    /// Discover the machine's owners and open every store under the
    /// resolved O:I home. Discovery degradations are carried, not raised:
    /// an owner that does not answer is data the surface reports.
    pub fn open() -> Result<Self, String> {
        let home = crate::configuration::kernel::oi_home()
            .map_err(|error| format!("configuration engine cannot find the O:I home: {error}"))?;
        // The seven product positions come from the deployed surface
        // catalogue; `oi` is the running executable. Connector owners
        // (`connector/<name>` specs) join this list where a connector
        // catalogue exists — the registry handles them without branching.
        let specs = product_position_specs()?;
        let transport = ProcessTransport::with_specs(&specs);
        let mut registry = OwnerRegistry::new();
        registry.discover_specs(&transport, &specs);
        Ok(Self {
            registry,
            transport,
            store: ConfigurationStore::open(&home),
            profiles: ProfileStore::from_config_home(&home),
            home,
        })
    }

    fn gateway(&self) -> OwnerGateway<'_> {
        OwnerGateway::new(&self.transport)
    }

    // -----------------------------------------------------------------------
    // Error mapping: every kernel/store failure travels as its frozen code
    // -----------------------------------------------------------------------

    fn kernel_error(
        error: KernelError,
        setting_ref: Option<&str>,
        scope: Option<&Scope>,
    ) -> SurfaceError {
        let mut surface = SurfaceError::new(error.code, error.message);
        if let Some(setting_ref) = setting_ref {
            surface = surface.setting(setting_ref);
        }
        if let Some(scope) = scope {
            surface = surface.scope(scope);
        }
        if surface.code == ErrorCode::OwnerUnavailable {
            surface = surface.retryable();
        }
        surface
    }

    fn store_error(error: StoreError) -> SurfaceError {
        let code = match &error {
            StoreError::NotFound(_) => ErrorCode::UnsupportedSetting,
            StoreError::InvalidProfileRef(_)
            | StoreError::AlreadyExists(_)
            | StoreError::Invalid(_)
            | StoreError::InvalidJson(_)
            | StoreError::IdentityMismatch { .. } => ErrorCode::InvalidValue,
            StoreError::HomeUnavailable
            | StoreError::SymlinkRejected(_)
            | StoreError::UnexpectedPath(_)
            | StoreError::TooLarge { .. }
            | StoreError::Io(_) => ErrorCode::Internal,
        };
        SurfaceError::new(code, error.message())
    }

    // -----------------------------------------------------------------------
    // Request normalisation: address explicitly, secret law, shape checks
    // -----------------------------------------------------------------------

    /// Contribution-level shape check over the disclosed `value_schema`
    /// (09 §2.3: a validation hint; the owner's native validation stays
    /// authoritative).
    fn check_value_shape(spec: &SettingSpec, value: &Value) -> SurfaceResult<()> {
        let refused = |message: String| {
            SurfaceError::new(
                ErrorCode::InvalidValue,
                format!(
                    "disclosed schema rejects the value for `{}` ({message}); the owner's native \
                     validation remains authoritative",
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
            ValueKind::List => {
                if !value.is_array() {
                    return Err(refused("expected a JSON array".into()));
                }
            }
            _ => {}
        }
        Ok(())
    }

    /// Normalise one surface request into a kernel desired change: explicit
    /// addressing, the secret law (09 §14 — the reference crosses, never
    /// material; the CLI passes the owner-namespace reference as the value
    /// argument), and the disclosed shape checks. Writability and the
    /// apply/plan capability stay the kernel assembly's own decisions.
    fn normalize(&self, request: &ChangeRequest) -> SurfaceResult<DesiredChange> {
        let (registered, _owner) =
            resolve_setting_address(&self.registry, &request.setting_ref, &request.scope).map_err(
                |error| Self::kernel_error(error, Some(&request.setting_ref), Some(&request.scope)),
            )?;
        let spec = &registered.spec;
        let mut value = request.value.clone();
        let mut secret_reference = request.secret_reference.clone();
        match spec.value_schema.kind {
            ValueKind::Secret => {
                if secret_reference.is_none() {
                    let Some(Value::String(reference)) = value.take() else {
                        return Err(SurfaceError::new(
                            ErrorCode::InvalidValue,
                            format!(
                                "`{}` is secret-kind: pass the owner-namespace secret reference, \
                                 never a material value",
                                request.setting_ref
                            ),
                        )
                        .setting(&request.setting_ref)
                        .scope(&request.scope));
                    };
                    secret_reference = Some(SecretReferenceValue { ref_: reference });
                }
                value = None;
            }
            _ => {
                if secret_reference.is_some() {
                    return Err(SurfaceError::new(
                        ErrorCode::InvalidValue,
                        format!(
                            "`{}` is not secret-kind; `secret_reference` belongs to secret-kind \
                             settings only",
                            request.setting_ref
                        ),
                    )
                    .setting(&request.setting_ref)
                    .scope(&request.scope));
                }
                let Some(value) = value.as_ref() else {
                    return Err(SurfaceError::new(
                        ErrorCode::InvalidValue,
                        format!("`{}` carries no value", request.setting_ref),
                    )
                    .setting(&request.setting_ref)
                    .scope(&request.scope));
                };
                Self::check_value_shape(spec, value)?;
            }
        }
        Ok(desired_change(
            &request.setting_ref,
            request.scope.clone(),
            value,
            secret_reference.map(|reference| SecretReference {
                ref_: reference.ref_,
                present: None,
            }),
        ))
    }

    fn requested_of(change: &DesiredChange) -> RequestedChange {
        RequestedChange {
            setting_ref: change.setting_ref.clone(),
            scope: change.scope.clone(),
            value: change.value.clone(),
            secret_reference: change.secret_reference.clone(),
        }
    }

    // -----------------------------------------------------------------------
    // The desired layer: folded from the kernel's persisted ChangeSets
    // -----------------------------------------------------------------------

    /// The O:I-owned desired state: the fold over every persisted ChangeSet
    /// in creation order, per-operation truth (09 §9). An executed apply
    /// holds its requested change; an executed reset withdraws it; failed
    /// and planned-only operations hold nothing.
    fn held_desired(&self) -> SurfaceResult<BTreeMap<(String, String), HeldDesired>> {
        let mut changesets = self.store.list_changesets().map_err(internal)?;
        changesets.sort_by(|left, right| {
            (left.created_at_unix_ms, left.changeset_id.as_str())
                .cmp(&(right.created_at_unix_ms, right.changeset_id.as_str()))
        });
        let mut held: BTreeMap<(String, String), HeldDesired> = BTreeMap::new();
        for changeset in &changesets {
            for operation in &changeset.operations {
                if !matches!(
                    operation.status,
                    OperationStatus::Applied | OperationStatus::Verified
                ) {
                    continue;
                }
                let Some(requested) = changeset.requested.iter().find(|requested| {
                    requested.setting_ref == operation.setting_ref
                        && requested.scope == operation.scope
                }) else {
                    continue;
                };
                let key = (requested.setting_ref.clone(), requested.scope.compact());
                match operation.kind {
                    OperationKind::Reset => {
                        held.remove(&key);
                    }
                    OperationKind::Apply => {
                        held.insert(
                            key,
                            HeldDesired {
                                entry: DesiredEntry {
                                    setting_ref: requested.setting_ref.clone(),
                                    scope: requested.scope.clone(),
                                    value: requested.value.clone(),
                                    secret_reference: requested.secret_reference.as_ref().map(
                                        |reference| SecretReferenceValue {
                                            ref_: reference.ref_.clone(),
                                        },
                                    ),
                                },
                                changeset_id: Some(changeset.changeset_id.clone()),
                            },
                        );
                    }
                    OperationKind::Validate | OperationKind::Plan => {}
                }
            }
        }
        Ok(held)
    }

    /// The composed desired layer (09 §12 resolution order): explicit O:I
    /// sets first, then the active profile's entries where nothing explicit
    /// is held.
    fn composed_desired(&self) -> SurfaceResult<Vec<HeldDesired>> {
        let held = self.held_desired()?;
        let mut composed: Vec<HeldDesired> = held.into_values().collect();
        if let Some(profile_ref) = active_mark(&self.home)? {
            match self.profiles.load(&profile_ref) {
                Ok(profile) => {
                    for entry in profile.desired {
                        if !composed.iter().any(|held| {
                            held.entry.setting_ref == entry.setting_ref
                                && held.entry.scope == entry.scope
                        }) {
                            composed.push(HeldDesired {
                                entry,
                                changeset_id: None,
                            });
                        }
                    }
                }
                // A dangling mark names no stored profile: nothing composes.
                Err(StoreError::NotFound(_)) => {}
                Err(error) => return Err(Self::store_error(error)),
            }
        }
        Ok(composed)
    }

    /// The resolution reading for one setting at one scope with an optional
    /// held desired entry — C1's `resolve_setting` with the redaction check
    /// the C0 validators carry.
    fn build_resolution(
        &self,
        setting_ref: &str,
        scope: &Scope,
        held: Option<&HeldDesired>,
    ) -> SurfaceResult<Resolution> {
        let (desired_value, desired_secret) = held
            .map(|held| {
                (
                    held.entry.value.clone(),
                    held.entry
                        .secret_reference
                        .as_ref()
                        .map(|reference| SecretReference {
                            ref_: reference.ref_.clone(),
                            present: None,
                        }),
                )
            })
            .unwrap_or((None, None));
        let desired_input = match (&desired_value, &desired_secret) {
            (Some(value), _) => Some(DesiredInput::Value(value)),
            (None, Some(secret)) => Some(DesiredInput::Secret(secret)),
            _ => None,
        };
        let source_ref = held.and_then(|held| held.changeset_id.as_deref());
        let resolution = resolve_setting(
            &self.registry,
            &self.gateway(),
            setting_ref,
            scope,
            desired_input,
            source_ref,
            now_unix_ms(),
        )
        .map_err(|error| Self::kernel_error(error, Some(setting_ref), Some(scope)))?;
        validate_resolution(&resolution, self.registry.settings())
            .map_err(|error| SurfaceError::new(ErrorCode::Internal, error).setting(setting_ref))?;
        Ok(resolution)
    }

    fn plan_document_into(plan: PlanDocument) -> ConfigPlan {
        ConfigPlan {
            schema: plan.schema,
            plan_id: plan.plan_id,
            plan_digest: plan.plan_digest,
            setting_ref: plan.setting_ref,
            scope: plan.scope,
            changes: plan
                .changes
                .into_iter()
                .map(|change| PlanChange {
                    summary: change.summary,
                    native_ref: change.native_ref,
                    before_ref: change.before_ref,
                    after_ref: change.after_ref,
                })
                .collect(),
            expected_effect: plan.expected_effect,
            expires_at_unix_ms: plan.expires_at_unix_ms,
            explain_ref: plan.explain_ref,
        }
    }
}

fn now_unix_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

fn internal(error: impl std::fmt::Display) -> SurfaceError {
    SurfaceError::new(ErrorCode::Internal, error.to_string())
}

impl ConfigSurface for KernelSurface {
    fn discover(&self) -> SurfaceResult<Vec<OwnerContribution>> {
        let mut owners = Vec::new();
        for owner_ref in self.registry.owner_refs() {
            if let Some(entry) = self.registry.entry(owner_ref) {
                owners.push(OwnerContribution::Available(entry.contribution.clone()));
            }
        }
        for degradation in self.registry.degradations() {
            let mut reason = degradation.reason.clone();
            if let Some(native_error) = &degradation.native_error {
                reason.push_str(&format!(" (observed: {native_error})"));
            }
            owners.push(OwnerContribution::Unavailable {
                owner_ref: degradation.owner_ref.clone(),
                reason,
                // No contribution document exists behind a degradation, so
                // no obligations are invented for it.
                obligations: Vec::new(),
            });
        }
        Ok(owners)
    }

    fn list(&self) -> SurfaceResult<Vec<ListedSetting>> {
        // An owner that did not contribute fabricates no settings (09 §4):
        // only registered owners are listed, specs verbatim.
        let mut listed = Vec::new();
        for owner_ref in self.registry.owner_refs() {
            let Some(entry) = self.registry.entry(owner_ref) else {
                continue;
            };
            for section in &entry.contribution.sections {
                for setting in &section.settings {
                    listed.push(ListedSetting {
                        owner_ref: owner_ref.to_owned(),
                        setting: setting.clone(),
                    });
                }
            }
        }
        Ok(listed)
    }

    fn resolve(&self, setting_ref: &str, scope: &Scope) -> SurfaceResult<Resolution> {
        let held = self.held_desired()?;
        let key = (setting_ref.to_owned(), scope.compact());
        self.build_resolution(setting_ref, scope, held.get(&key))
    }

    fn resolve_entry(&self, entry: &DesiredEntry) -> SurfaceResult<Resolution> {
        let held = HeldDesired {
            entry: entry.clone(),
            changeset_id: None,
        };
        self.build_resolution(&entry.setting_ref, &entry.scope, Some(&held))
    }

    fn desired_entries(&self) -> SurfaceResult<Vec<DesiredEntry>> {
        Ok(self
            .composed_desired()?
            .into_iter()
            .map(|held| held.entry)
            .collect())
    }

    fn diff(&self) -> SurfaceResult<Vec<Resolution>> {
        self.composed_desired()?
            .iter()
            .map(|held| {
                self.build_resolution(&held.entry.setting_ref, &held.entry.scope, Some(held))
            })
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
        // Phase 1: every request must address explicitly before anything is
        // assembled (09 §5/§13/§14).
        let desired = requests
            .iter()
            .map(|request| self.normalize(request))
            .collect::<SurfaceResult<Vec<_>>>()?;
        let changeset = assemble_changeset(
            &self.registry,
            changeset_id,
            now_unix_ms(),
            profile_ref,
            &desired,
        )
        .map_err(|error| Self::kernel_error(error, None, None))?;
        validate_changeset(&changeset, self.registry.settings())
            .map_err(|error| SurfaceError::new(ErrorCode::Internal, error))?;
        Ok(changeset)
    }

    fn plan(&self, request: &ChangeRequest) -> SurfaceResult<ConfigPlan> {
        let desired = self.normalize(request)?;
        // The owner-native plan crosses back whole (09 §6): O:I mints no
        // plan identity and no idempotency digest.
        let document = plan_request(
            &self.registry,
            &self.gateway(),
            &Self::requested_of(&desired),
        )
        .map_err(|error| {
            Self::kernel_error(error, Some(&desired.setting_ref), Some(&desired.scope))
        })?;
        Ok(Self::plan_document_into(document))
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
        // Phase 1: explicit addressing before anything runs.
        let desired = requests
            .iter()
            .map(|request| self.normalize(request))
            .collect::<SurfaceResult<Vec<_>>>()?;
        let mut changeset = assemble_changeset(
            &self.registry,
            changeset_id,
            now_unix_ms(),
            profile_ref,
            &desired,
        )
        .map_err(|error| Self::kernel_error(error, None, None))?;
        validate_changeset(&changeset, self.registry.settings())
            .map_err(|error| SurfaceError::new(ErrorCode::Internal, error))?;
        // Owner-native orchestration with re-read verification; the kernel
        // persists the ChangeSet, the receipt references and the
        // reconciliation records at every transition — the same identity
        // the owners minted (09 §9).
        let report = execute_changeset(
            &self.registry,
            &self.gateway(),
            Some(&self.store),
            &mut changeset,
            now_unix_ms(),
        )
        .map_err(|error| Self::kernel_error(error, None, None))?;
        Ok(AppliedChange {
            changeset,
            receipts: report.receipts,
        })
    }

    fn reset(&self, setting_ref: &str, scope: &Scope) -> SurfaceResult<AppliedChange> {
        let changeset_id = mint_changeset_id(now_unix_ms());
        let (changeset, report) = reset_setting(
            &self.registry,
            &self.gateway(),
            Some(&self.store),
            &changeset_id,
            now_unix_ms(),
            setting_ref,
            scope,
            now_unix_ms(),
        )
        .map_err(|error| Self::kernel_error(error, Some(setting_ref), Some(scope)))?;
        Ok(AppliedChange {
            changeset,
            receipts: report.receipts,
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
        for held in self.composed_desired()? {
            let entry = &held.entry;
            let setting_ref = entry.setting_ref.clone();
            let scope = entry.scope.clone();
            let effect_kind = self
                .registry
                .lookup(&setting_ref)
                .map(|(registered, _)| registered.spec.effect.kind);
            // A desired entry that violates its own contribution (e.g. a
            // secret-kind entry carrying a value) is invalid desired state.
            let shape_ok = validate_resolution(
                &Resolution {
                    schema: RESOLUTION_SCHEMA.to_owned(),
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
                    reconciliation: Reconciliation {
                        status: ReconciliationStatus::Satisfied,
                        reason: None,
                        detail_ref: None,
                    },
                },
                self.registry.settings(),
            );
            if let Err(error) = shape_ok {
                findings.push(DoctorFinding {
                    classification: DoctorClassification::InvalidDesiredState,
                    owner_ref: self.registry.owner_of(&setting_ref).map(str::to_owned),
                    setting_ref: Some(setting_ref),
                    scope: Some(scope),
                    reconciliation_status: None,
                    effect_kind,
                    error_code: Some(ErrorCode::InvalidValue.as_wire().to_owned()),
                    message: error,
                });
                continue;
            }
            let classification = match self.resolve_entry(entry) {
                Ok(resolution) => {
                    let status = resolution.reconciliation.status;
                    // At resolution time `blocked` always means the owner
                    // did not answer on this subject (09 §7.1); validation
                    // failures surface at apply time as operation errors.
                    if status == ReconciliationStatus::Blocked {
                        Some(DoctorClassification::OwnerUnavailable)
                    } else {
                        classify_reconciliation(status)
                    }
                }
                Err(error) => match error.code {
                    ErrorCode::UnsupportedScope | ErrorCode::UnknownScopeKind => {
                        Some(DoctorClassification::UnsupportedScope)
                    }
                    ErrorCode::OwnerUnavailable => Some(DoctorClassification::OwnerUnavailable),
                    _ => Some(DoctorClassification::InvalidDesiredState),
                },
            };
            if let Some(classification) = classification {
                let reconciliation_status = self
                    .resolve_entry(entry)
                    .ok()
                    .map(|resolution| resolution.reconciliation.status);
                findings.push(DoctorFinding {
                    classification,
                    owner_ref: self.registry.owner_of(&setting_ref).map(str::to_owned),
                    setting_ref: Some(setting_ref),
                    scope: Some(scope),
                    reconciliation_status,
                    effect_kind,
                    error_code: None,
                    message: "reconciliation is not satisfied for this desired entry".to_owned(),
                });
            }
        }
        Ok(findings)
    }
}

impl ProfileSurface for KernelSurface {
    fn list(&self) -> SurfaceResult<Vec<ProfileSummary>> {
        let mut summaries = Vec::new();
        for profile_ref in self.profiles.list_refs().map_err(Self::store_error)? {
            let profile = self
                .profiles
                .load(&profile_ref)
                .map_err(Self::store_error)?;
            summaries.push(ProfileSummary {
                profile_ref: profile.profile_ref,
                title: profile.title,
                description: profile.description,
                created_at_unix_ms: profile.created_at_unix_ms,
                revised_at_unix_ms: profile.revised_at_unix_ms,
                native_profiles: profile.native_profiles.len(),
                desired_entries: profile.desired.len(),
            });
        }
        Ok(summaries)
    }

    fn load(&self, profile_ref: &str) -> SurfaceResult<Profile> {
        // Loading validates the structural laws and the redaction law over
        // the contributions (09 §12/§14).
        self.profiles
            .load_checked(profile_ref, self.registry.settings())
            .map_err(Self::store_error)
    }

    fn create(
        &self,
        profile_ref: &str,
        title: Option<String>,
        description: Option<String>,
    ) -> SurfaceResult<Profile> {
        if !is_valid_profile_ref(profile_ref) {
            return Err(SurfaceError::new(
                ErrorCode::InvalidValue,
                format!("profile_ref `{profile_ref}` violates `[a-z0-9][a-z0-9-]*` (09 §12)"),
            ));
        }
        if self
            .profiles
            .exists(profile_ref)
            .map_err(Self::store_error)?
        {
            return Err(SurfaceError::new(
                ErrorCode::InvalidValue,
                format!("profile `{profile_ref}` already exists"),
            ));
        }
        let profile = Profile {
            schema: crate::configuration::PROFILE_SCHEMA.to_owned(),
            profile_ref: profile_ref.to_owned(),
            title,
            description,
            created_at_unix_ms: now_unix_ms(),
            revised_at_unix_ms: now_unix_ms(),
            native_profiles: Vec::new(),
            desired: Vec::new(),
            provenance: Some(ProfileProvenance {
                authored_by: Some(AuthoredBy::Human),
                notes_ref: None,
                imported_from_ref: None,
            }),
        };
        profile
            .validate()
            .map_err(|error| SurfaceError::new(ErrorCode::InvalidValue, error))?;
        self.profiles
            .save_checked(&profile, self.registry.settings())
            .map_err(Self::store_error)?;
        Ok(profile)
    }

    fn clone_profile(&self, source_ref: &str, target_ref: &str) -> SurfaceResult<Profile> {
        let mut profile = self.load(source_ref)?;
        profile.profile_ref = target_ref.to_owned();
        profile.created_at_unix_ms = now_unix_ms();
        profile.revised_at_unix_ms = now_unix_ms();
        profile
            .validate()
            .map_err(|error| SurfaceError::new(ErrorCode::InvalidValue, error))?;
        if self
            .profiles
            .exists(target_ref)
            .map_err(Self::store_error)?
        {
            return Err(SurfaceError::new(
                ErrorCode::InvalidValue,
                format!("profile `{target_ref}` already exists"),
            ));
        }
        // Secrets travel as references only — the store never holds
        // material, so the copy is redaction-safe by construction (09 §12).
        self.profiles
            .save_checked(&profile, self.registry.settings())
            .map_err(Self::store_error)?;
        Ok(profile)
    }

    fn set_active(&self, profile_ref: Option<&str>) -> SurfaceResult<ProfileActivation> {
        let previous = active_mark(&self.home)?;
        if let Some(profile_ref) = profile_ref {
            // The active mark names a stored profile or the operation fails.
            self.load(profile_ref)?;
        }
        set_active_mark(&self.home, profile_ref)?;
        Ok(ProfileActivation {
            active_profile: profile_ref.map(str::to_owned),
            previous,
        })
    }

    fn active(&self) -> SurfaceResult<Option<String>> {
        active_mark(&self.home)
    }

    fn export(&self, profile_ref: &str) -> SurfaceResult<Profile> {
        // The portable form is the same document; secret-kind entries stay
        // references, so there is nothing to strip (09 §12).
        self.load(profile_ref)
    }

    fn import(&self, profile: &Profile, source_ref: Option<&str>) -> SurfaceResult<Profile> {
        let document = serde_json::to_value(profile).map_err(internal)?;
        // Import stores inspectable desired state; it never applies
        // anything and never overwrites (09 §12). The redaction law is
        // enforced against the contributions before the store accepts it.
        import_document(
            &self.profiles,
            &document,
            source_ref,
            Some(self.registry.settings()),
        )
        .map_err(Self::store_error)?;
        self.load(&profile.profile_ref)
    }
}

// ---------------------------------------------------------------------------
// The composition active-profile mark
// ---------------------------------------------------------------------------
//
// One mark, one file: `composition.json` (`active_profile`, 09 §12). The
// command layer's `composition.rs` owns the full composition state with the
// same law this reader/writer follows: regular files only (no symlinks,
// opened no-follow), size-capped, schema-checked, mutated as raw JSON so
// unknown fields survive, published under the composition lock with a
// compare-and-publish check, atomic rename and directory durability. Only
// the explicit use/clear writes; reading never selects.

const COMPOSITION_MAX_BYTES: u64 = 4 * 1024 * 1024;
const COMPOSITION_SCHEMA: u32 = 1;

fn composition_path(home: &Path) -> PathBuf {
    home.join("composition.json")
}

fn read_composition_bytes(path: &Path) -> Result<Option<Vec<u8>>, SurfaceError> {
    use std::io::Read;
    let metadata = match std::fs::symlink_metadata(path) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(internal(format!("cannot inspect composition: {error}"))),
    };
    if !metadata.is_file() || metadata.file_type().is_symlink() {
        return Err(internal(
            "composition must be a regular file, not a symlink",
        ));
    }
    let mut bytes = Vec::new();
    let mut options = std::fs::OpenOptions::new();
    options.read(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        // O_NOFOLLOW; Linux and Darwin expose different native values.
        #[cfg(target_os = "macos")]
        options.custom_flags(0x100);
        #[cfg(target_os = "linux")]
        options.custom_flags(0x20000);
    }
    let file = options.open(path).map_err(|error| internal(error))?;
    if !file.metadata().map_err(|error| internal(error))?.is_file() {
        return Err(internal("composition is not a regular file"));
    }
    file.take(COMPOSITION_MAX_BYTES + 1)
        .read_to_end(&mut bytes)
        .map_err(|error| internal(error))?;
    if bytes.len() as u64 > COMPOSITION_MAX_BYTES {
        return Err(internal("composition exceeds 4 MiB"));
    }
    Ok(Some(bytes))
}

fn composition_value(home: &Path) -> Result<Option<Value>, SurfaceError> {
    match read_composition_bytes(&composition_path(home))? {
        None => Ok(None),
        Some(bytes) => {
            let value: Value = serde_json::from_slice(&bytes)
                .map_err(|error| internal(format!("invalid composition: {error}")))?;
            if value.get("schema").and_then(Value::as_u64) != Some(COMPOSITION_SCHEMA as u64) {
                return Err(internal(
                    "unsupported composition schema; the active-profile mark needs schema 1",
                ));
            }
            Ok(Some(value))
        }
    }
}

/// The explicitly selected active profile, or `None` (09 §12: reading never
/// selects).
fn active_mark(home: &Path) -> SurfaceResult<Option<String>> {
    Ok(composition_value(home)?
        .and_then(|value| {
            value
                .get("active_profile")
                .and_then(Value::as_str)
                .map(str::to_owned)
        })
        .filter(|mark| !mark.is_empty()))
}

/// Write the active mark through the composition law: lock, read the basis,
/// mutate the one key, compare-and-publish atomically.
fn set_active_mark(home: &Path, profile_ref: Option<&str>) -> SurfaceResult<()> {
    use std::io::Write;
    let path = composition_path(home);
    std::fs::create_dir_all(home).map_err(|error| internal(error))?;
    let lock_path = home.join("composition.lock");
    let mut options = std::fs::OpenOptions::new();
    options.read(true).write(true).create(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
        #[cfg(target_os = "macos")]
        options.custom_flags(0x100);
        #[cfg(target_os = "linux")]
        options.custom_flags(0x20000);
    }
    let lock = options
        .open(&lock_path)
        .map_err(|error| internal(format!("cannot open composition lock: {error}")))?;
    lock.lock()
        .map_err(|error| internal(format!("cannot lock composition: {error}")))?;
    let result = (|| {
        let basis = read_composition_bytes(&path)?;
        let mut value = match &basis {
            Some(bytes) => serde_json::from_slice::<Value>(bytes)
                .map_err(|error| internal(format!("invalid composition: {error}")))?,
            None => serde_json::json!({ "schema": COMPOSITION_SCHEMA, "modules": {} }),
        };
        let object = value
            .as_object_mut()
            .ok_or_else(|| internal("composition must be a JSON object"))?;
        match profile_ref {
            Some(profile_ref) => {
                object.insert(
                    "active_profile".into(),
                    Value::String(profile_ref.to_owned()),
                );
            }
            None => {
                object.remove("active_profile");
            }
        }
        let bytes = serde_json::to_vec_pretty(&value).map_err(|error| internal(error))?;
        let nonce = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map_err(|error| internal(error))?
            .as_nanos();
        let temporary = home.join(format!(".composition-{}-{nonce}.tmp", std::process::id()));
        let outcome = (|| -> Result<(), SurfaceError> {
            let mut file = std::fs::OpenOptions::new()
                .write(true)
                .create_new(true)
                .open(&temporary)
                .map_err(|error| internal(error))?;
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                file.set_permissions(std::fs::Permissions::from_mode(0o600))
                    .map_err(|error| internal(error))?;
            }
            file.write_all(&bytes)
                .and_then(|_| file.sync_all())
                .map_err(|error| internal(error))?;
            // Compare-and-publish: the basis must not have moved under the
            // lock (the same protocol composition.rs publishes under).
            if read_composition_bytes(&path)?.as_deref() != basis.as_deref() {
                return Err(internal(
                    "composition conflict: state changed since it was read",
                ));
            }
            std::fs::rename(&temporary, &path).map_err(|error| internal(error))?;
            std::fs::File::open(home)
                .and_then(|directory| directory.sync_all())
                .map_err(|error| internal(error))?;
            Ok(())
        })();
        if outcome.is_err() {
            let _ = std::fs::remove_file(&temporary);
        }
        outcome
    })();
    drop(lock);
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn composition_mark_round_trips_without_touching_unknown_fields() {
        let home = tempfile::tempdir().expect("tempdir");
        let path = home.path().join("composition.json");
        std::fs::write(
            &path,
            serde_json::json!({
                "schema": 1,
                "personal_ground": "/some/ground",
                "future_extension": { "kept": true },
            })
            .to_string(),
        )
        .unwrap();

        assert_eq!(active_mark(home.path()).unwrap(), None);
        set_active_mark(home.path(), Some("development")).unwrap();
        assert_eq!(
            active_mark(home.path()).unwrap().as_deref(),
            Some("development")
        );
        let value: Value = serde_json::from_slice(&std::fs::read(&path).unwrap()).unwrap();
        assert_eq!(value["personal_ground"], "/some/ground");
        assert_eq!(value["future_extension"]["kept"], true);
        assert_eq!(value["schema"], 1);

        set_active_mark(home.path(), None).unwrap();
        assert_eq!(active_mark(home.path()).unwrap(), None);
        let value: Value = serde_json::from_slice(&std::fs::read(&path).unwrap()).unwrap();
        assert!(value.get("active_profile").is_none(), "{value}");
        assert_eq!(value["future_extension"]["kept"], true);
    }

    #[test]
    fn a_missing_composition_file_reads_as_no_mark_and_publishes_schema_one() {
        let home = tempfile::tempdir().expect("tempdir");
        assert_eq!(active_mark(home.path()).unwrap(), None);
        set_active_mark(home.path(), Some("sparse")).unwrap();
        let value: Value =
            serde_json::from_slice(&std::fs::read(home.path().join("composition.json")).unwrap())
                .unwrap();
        assert_eq!(value["schema"], 1);
        assert_eq!(value["active_profile"], "sparse");
    }
}
