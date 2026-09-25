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
    classify_reconciliation, AppliedChange, ChangeRequest, CompositionDisclosure, ConfigPlan,
    ConfigSurface, DoctorClassification, DoctorFinding, ListedSetting, OwnerContribution,
    PlanChange, ProfileActivation, ProfileEditApplied, ProfileEditOp, ProfileEditOutcome,
    ProfileSummary, ProfileSurface, ReceiptSummary, SurfaceError, SurfaceResult,
};
use crate::configuration::kernel::{
    assemble_changeset, desired_change, execute_changeset, mint_changeset_id, plan_request,
    product_position_specs, product_position_specs_with, reset_setting, resolve_setting, resolve_setting_address,
    ConfigurationStore, DesiredChange, DesiredInput, DesiredRecord, KernelError, OwnerGateway,
    OwnerRegistry, PlanDocument, ProcessTransport,
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
#[derive(Clone)]
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
    /// The world reading this surface stands in (lock §5): taken once at
    /// open, disclosed verbatim, never re-decided. `None` when the reading
    /// was unavailable — the reason travels beside it, and no owner
    /// standings are invented.
    world: Option<oi_cli_current_world::CurrentWorldReading>,
    world_error: Option<String>,
}

/// The current-world module, aliased so the engine binding reads as one
/// seam against the world reading it joins.
use crate::current_world as oi_cli_current_world;

impl KernelSurface {
    /// Discover the machine's owners and open every store under the
    /// resolved O:I home. Discovery degradations are carried, not raised:
    /// an owner that does not answer is data the surface reports.
    pub fn open() -> Result<Self, String> {
        Self::open_with_specs(product_position_specs()?)
    }

    /// Bind through the same executable authority as the calling CLI.
    pub fn open_with_product_resolver(
        resolve: impl FnMut(&crate::product_command::ProductCommandDescriptor) -> Result<PathBuf, String>,
    ) -> Result<Self, String> {
        Self::open_with_specs(product_position_specs_with(resolve)?)
    }

    fn open_with_specs(specs: Vec<crate::configuration::kernel::OwnerSpec>) -> Result<Self, String> {
        let home = crate::configuration::kernel::oi_home()
            .map_err(|error| format!("configuration engine cannot find the O:I home: {error}"))?;
        let transport = ProcessTransport::with_specs(&specs);
        let mut registry = OwnerRegistry::new();
        registry.discover_specs(&transport, &specs);
        // The world reading is data, never a gate: a reading that fails
        // leaves every owner's standing `unknown` and the reason disclosed,
        // and does not stop the engine from answering.
        let (world, world_error) = match oi_cli_current_world::live_current_world() {
            Ok(reading) => (Some(reading), None),
            Err(error) => (None, Some(error)),
        };
        Ok(Self {
            registry,
            transport,
            store: ConfigurationStore::open(&home),
            profiles: ProfileStore::from_config_home(&home),
            home,
            world,
            world_error,
        })
    }

    /// The composition disclosure of the settings surface (lock §5): the
    /// world's own facts, verbatim.
    fn composition_disclosure(&self) -> CompositionDisclosure {
        match &self.world {
            Some(reading) => CompositionDisclosure {
                requested_mode: reading
                    .requested_mode
                    .as_ref()
                    .map(|requested| requested.mode.clone()),
                install_mode: reading.context_frame.install_mode.clone(),
                install_mode_basis: reading.context_frame.install_mode_basis.clone(),
                present_positions: reading.context_frame.present_positions.clone(),
                warnings: reading.warnings.clone(),
                error: None,
            },
            None => CompositionDisclosure {
                error: self
                    .world_error
                    .clone()
                    .or_else(|| Some("the world reading is unavailable".to_owned())),
                ..CompositionDisclosure::default()
            },
        }
    }

    fn absent_owner_reason(&self, setting_ref: &str) -> Option<String> {
        absent_owner_reason(&self.registry, setting_ref)
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
            ValueKind::List if !value.is_array() => {
                return Err(refused("expected a JSON array".into()));
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
    /// is held. Held-but-unexecuted intent (the desired overlay) composes
    /// last: it is the most recent explicit O:I act for its subject and
    /// replaces whatever was held before it.
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
        // The explicit holds: each replaces whatever the fold and the active
        // profile hold for its (setting, scope).
        for record in self.store.list_desired().map_err(internal)? {
            let entry = DesiredEntry {
                setting_ref: record.setting_ref.clone(),
                scope: record.scope.clone(),
                value: record.value.clone(),
                secret_reference: record.secret_reference.as_ref().map(|reference| {
                    SecretReferenceValue {
                        ref_: reference.ref_.clone(),
                    }
                }),
            };
            composed.retain(|held| {
                !(held.entry.setting_ref == entry.setting_ref && held.entry.scope == entry.scope)
            });
            composed.push(HeldDesired {
                entry,
                changeset_id: None,
            });
        }
        Ok(composed)
    }

    /// The held desired intent for one exact (setting, scope): an executed
    /// ChangeSet's recorded change, else the explicit hold. (Active-profile
    /// entries compose into `diff`/`doctor`; `resolve` keeps its historical
    /// explicit-acts-only reading.)
    fn held_for(&self, setting_ref: &str, scope: &Scope) -> SurfaceResult<Option<HeldDesired>> {
        let fold = self.held_desired()?;
        if let Some(held) = fold.get(&(setting_ref.to_owned(), scope.compact())) {
            return Ok(Some(held.clone()));
        }
        Ok(self
            .store
            .load_desired(setting_ref, scope)
            .map_err(internal)?
            .map(|record| HeldDesired {
                entry: DesiredEntry {
                    setting_ref: record.setting_ref,
                    scope: record.scope,
                    value: record.value,
                    secret_reference: record.secret_reference.as_ref().map(|reference| {
                        SecretReferenceValue {
                            ref_: reference.ref_.clone(),
                        }
                    }),
                },
                changeset_id: None,
            }))
    }

    /// Hold one desired entry as explicit O:I intent (09 §7: the desired
    /// axis O:I owns beside the owner's own facts). The same normalisation
    /// as any change request applies — explicit addressing, the secret law,
    /// the disclosed shape checks — but nothing is planned, applied or
    /// mutated: the owner is not touched. A later hold of the same subject
    /// replaces the earlier one.
    fn hold(&self, request: &ChangeRequest) -> SurfaceResult<DesiredEntry> {
        let desired = self.normalize(request)?;
        let record = DesiredRecord {
            setting_ref: desired.setting_ref.clone(),
            scope: desired.scope.clone(),
            value: desired.value.clone(),
            secret_reference: desired.secret_reference.as_ref().map(|reference| {
                crate::configuration::resolution::SecretReference {
                    ref_: reference.ref_.clone(),
                    present: None,
                }
            }),
        };
        self.store.save_desired(&record).map_err(internal)?;
        Ok(DesiredEntry {
            setting_ref: record.setting_ref,
            scope: record.scope,
            value: record.value,
            secret_reference: record.secret_reference.as_ref().map(|reference| {
                SecretReferenceValue {
                    ref_: reference.ref_.clone(),
                }
            }),
        })
    }

    /// Withdraw one explicitly held desired intent. Discarding a subject
    /// nothing is held for is `Ok(false)`, not an error — discard is an
    /// explicit operation and its absence is observable.
    fn discard(&self, setting_ref: &str, scope: &Scope) -> SurfaceResult<bool> {
        self.store
            .delete_desired(setting_ref, scope)
            .map_err(internal)
    }

    /// Retire the explicit holds an executed ChangeSet settled: an applied
    /// operation's requested change now lives in the ChangeSet fold, and a
    /// reset withdraws the subject entirely — in both cases the hold has
    /// done its job and must stop speaking for the subject.
    fn retire_holds(&self, changeset: &ChangeSet) -> SurfaceResult<()> {
        for operation in &changeset.operations {
            if !matches!(
                operation.status,
                OperationStatus::Applied | OperationStatus::Verified
            ) {
                continue;
            }
            self.store
                .delete_desired(&operation.setting_ref, &operation.scope)
                .map_err(internal)?;
        }
        Ok(())
    }

    /// The resolution reading for one setting at one scope with an optional
    /// held desired entry — C1's `resolve_setting` with the redaction check
    /// the C0 validators carry. A held entry whose owner left the
    /// composition resolves through [`absent_owner_resolution`] instead: one
    /// absent product must not blind the whole diff reading, and its
    /// retained desired state stays legible and truthfully named.
    fn build_resolution(
        &self,
        setting_ref: &str,
        scope: &Scope,
        held: Option<&HeldDesired>,
    ) -> SurfaceResult<Resolution> {
        if let Some(reason) = self.absent_owner_reason(setting_ref) {
            return Ok(absent_owner_resolution(setting_ref, scope, held, reason));
        }
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

/// Why this setting's owner is absent from the registry, when it is: the
/// discovery degradation that recorded the failed read. `None` when the
/// owner answered discovery (or was never probed) — the caller then treats
/// the subject as genuinely unaddressable. The message names the failed
/// read only; the composition relation is disclosed separately through the
/// standings, never asserted here.
fn absent_owner_reason(registry: &OwnerRegistry, setting_ref: &str) -> Option<String> {
    let owner = setting_ref.split(':').next()?;
    if owner.is_empty() || registry.entry(owner).is_some() {
        return None;
    }
    registry
        .degradations()
        .iter()
        .find(|degradation| degradation.owner_ref == owner)
        .map(|degradation| {
            format!(
                "owner `{owner}` did not answer discovery ({}); held desired intent for its \
                 settings is retained but cannot reconcile until the owner answers again",
                degradation.reason
            )
        })
}

/// The truthful resolution of a held desired entry whose owner no longer
/// answers discovery (a product that left the composition): the frozen
/// `blocked` status — the owner cannot reconcile — with the retained
/// desired axis still legible beside the named absence. Retained state is
/// disclosed, never deleted, and never renamed into a false status.
fn absent_owner_resolution(
    setting_ref: &str,
    scope: &Scope,
    held: Option<&HeldDesired>,
    reason: String,
) -> Resolution {
    Resolution {
        schema: RESOLUTION_SCHEMA.to_owned(),
        setting_ref: setting_ref.to_owned(),
        scope: scope.clone(),
        desired: held.map(|held| Desired {
            value: held.entry.value.clone(),
            secret_reference: held.entry.secret_reference.as_ref().map(|reference| {
                SecretReference {
                    ref_: reference.ref_.clone(),
                    present: None,
                }
            }),
            source_ref: held.changeset_id.clone(),
            set_at_unix_ms: None,
        }),
        native: None,
        native_reading: None,
        reconciliation: Reconciliation {
            status: ReconciliationStatus::Blocked,
            reason: Some(reason),
            detail_ref: None,
        },
    }
}

fn internal(error: impl std::fmt::Display) -> SurfaceError {
    SurfaceError::new(ErrorCode::Internal, error.to_string())
}

impl ConfigSurface for KernelSurface {
    fn composition(&self) -> SurfaceResult<CompositionDisclosure> {
        Ok(self.composition_disclosure())
    }

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
        let held = self.held_for(setting_ref, scope)?;
        self.build_resolution(setting_ref, scope, held.as_ref())
    }

    fn resolve_many(&self, pairs: &[(String, Scope)]) -> Vec<SurfaceResult<Resolution>> {
        self.transport.with_reading_batch(|| pairs.iter().map(|(setting, scope)| self.resolve(setting, scope)).collect())
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
        self.transport.with_reading_batch(|| {
            self.composed_desired()?.iter().map(|held| {
                self.build_resolution(&held.entry.setting_ref, &held.entry.scope, Some(held))
            }).collect()
        })
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
        self.retire_holds(&changeset)?;
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
        self.retire_holds(&changeset)?;
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
            // An entry whose owner left the composition is not invalid —
            // it is retained state whose owner cannot answer; it is judged
            // by the resolution path below, which names the absence.
            let shape_ok = if self.absent_owner_reason(&setting_ref).is_some() {
                Ok(())
            } else {
                validate_resolution(
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
                )
            };
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

    fn hold_desired(&self, request: &ChangeRequest) -> SurfaceResult<DesiredEntry> {
        self.hold(request)
    }

    fn discard_desired(&self, setting_ref: &str, scope: &Scope) -> SurfaceResult<bool> {
        self.discard(setting_ref, scope)
    }

    fn receipts(&self) -> SurfaceResult<Vec<ReceiptSummary>> {
        let mut receipts = self.store.list_receipts().map_err(internal)?;
        // Oldest first, then identity — a stable, readable order; the
        // timestamps live inside the recorded refs themselves.
        receipts.sort_by(|left, right| {
            (
                left.applied_at_unix_ms,
                left.changeset_id.as_str(),
                left.owner_ref.as_str(),
                left.receipt_id.as_str(),
            )
                .cmp(&(
                    right.applied_at_unix_ms,
                    right.changeset_id.as_str(),
                    right.owner_ref.as_str(),
                    right.receipt_id.as_str(),
                ))
        });
        Ok(receipts
            .into_iter()
            .map(|receipt| ReceiptSummary {
                receipt_id: receipt.receipt_id,
                owner_ref: receipt.owner_ref,
                changeset_id: receipt.changeset_id,
                setting_ref: receipt.setting_ref,
                scope: receipt.scope,
                operation: receipt.operation,
                outcome: receipt.outcome,
                applied_at_unix_ms: receipt.applied_at_unix_ms,
                native_ref: receipt.native_ref,
            })
            .collect())
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
        // The checked load enforces the structural laws and the redaction
        // law before anything is edited (09 §12/§14). The active mark is
        // not touched: editing desired state is not using it.
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
                    // The same normalisation as any change request: explicit
                    // addressing, the secret law, the disclosed shape checks.
                    let desired = self.normalize(&ChangeRequest {
                        setting_ref: setting_ref.clone(),
                        scope: scope.clone(),
                        value: value.clone(),
                        secret_reference: secret_reference.clone(),
                    })?;
                    let entry = DesiredEntry {
                        setting_ref: desired.setting_ref,
                        scope: desired.scope,
                        value: desired.value,
                        secret_reference: desired.secret_reference.map(|reference| {
                            SecretReferenceValue {
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
        // The edited document is re-validated and stored through the same
        // path as creation: structural laws, redaction law, atomic 0600
        // publish (09 §12).
        profile.revised_at_unix_ms = now_unix_ms();
        profile
            .validate()
            .map_err(|error| SurfaceError::new(ErrorCode::InvalidValue, error))?;
        self.profiles
            .save_checked(&profile, self.registry.settings())
            .map_err(Self::store_error)?;
        Ok(ProfileEditOutcome { profile, applied })
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
    let file = options.open(path).map_err(internal)?;
    if !file.metadata().map_err(internal)?.is_file() {
        return Err(internal("composition is not a regular file"));
    }
    file.take(COMPOSITION_MAX_BYTES + 1)
        .read_to_end(&mut bytes)
        .map_err(internal)?;
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
    std::fs::create_dir_all(home).map_err(internal)?;
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
        let bytes = serde_json::to_vec_pretty(&value).map_err(internal)?;
        let nonce = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map_err(internal)?
            .as_nanos();
        let temporary = home.join(format!(".composition-{}-{nonce}.tmp", std::process::id()));
        let outcome = (|| -> Result<(), SurfaceError> {
            let mut file = std::fs::OpenOptions::new()
                .write(true)
                .create_new(true)
                .open(&temporary)
                .map_err(internal)?;
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                file.set_permissions(std::fs::Permissions::from_mode(0o600))
                    .map_err(internal)?;
            }
            file.write_all(&bytes)
                .and_then(|_| file.sync_all())
                .map_err(internal)?;
            // Compare-and-publish: the basis must not have moved under the
            // lock (the same protocol composition.rs publishes under).
            if read_composition_bytes(&path)?.as_deref() != basis.as_deref() {
                return Err(internal(
                    "composition conflict: state changed since it was read",
                ));
            }
            std::fs::rename(&temporary, &path).map_err(internal)?;
            std::fs::File::open(home)
                .and_then(|directory| directory.sync_all())
                .map_err(internal)?;
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
    use crate::configuration::kernel::transport::{
        OwnerTransport, TransportError, TransportFailure,
    };
    use crate::configuration::refs::ScopeKind;

    /// A transport where every owner fails discovery: exactly the shape of
    /// a machine whose products did not answer.
    #[derive(Debug)]
    struct FailingTransport;

    impl OwnerTransport for FailingTransport {
        fn discover(&self, owner_ref: &str) -> Result<Value, TransportError> {
            Err(TransportFailure::owner_unavailable(format!(
                "{owner_ref} executable not installed"
            ))
            .into())
        }
        fn system_reading(&self, _owner_ref: &str) -> Result<Value, TransportError> {
            Err(TransportFailure::owner_unavailable("stub").into())
        }
        fn validate(
            &self,
            _: &str,
            _: &crate::configuration::kernel::transport::SettingRequest,
        ) -> Result<Value, TransportError> {
            Err(TransportFailure::owner_unavailable("stub").into())
        }
        fn plan(
            &self,
            _: &str,
            _: &crate::configuration::kernel::transport::SettingRequest,
        ) -> Result<Value, TransportError> {
            Err(TransportFailure::owner_unavailable("stub").into())
        }
        fn apply(
            &self,
            _: &str,
            _: &crate::configuration::kernel::transport::ApplyRequest,
        ) -> Result<Value, TransportError> {
            Err(TransportFailure::owner_unavailable("stub").into())
        }
        fn reset(
            &self,
            _: &str,
            _: &crate::configuration::kernel::transport::ResetRequest,
        ) -> Result<Value, TransportError> {
            Err(TransportFailure::owner_unavailable("stub").into())
        }
    }

    fn scope_world() -> Scope {
        Scope {
            scope_kind: ScopeKind::World,
            scope_ref: None,
        }
    }

    #[test]
    fn a_held_entry_whose_owner_left_composition_resolves_blocked_with_retained_desired() {
        // The transition law (lock §5, §7): when a product leaves the
        // composition, its held desired intent is retained state — resolved
        // as `blocked` with the failed discovery named, never deleted,
        // never renamed into invalid-desired-state, and never a wholesale
        // diff failure.
        let mut registry = OwnerRegistry::new();
        registry.discover_specs(
            &FailingTransport,
            &[crate::configuration::kernel::OwnerSpec {
                owner_ref: "workcell".into(),
                program: "workcell".into(),
            }],
        );
        let reason = absent_owner_reason(&registry, "workcell:placement:placement.policy")
            .expect("the absent owner is named");
        assert!(
            reason.contains("workcell") && reason.contains("did not answer discovery"),
            "{reason}"
        );

        let held = HeldDesired {
            entry: DesiredEntry {
                setting_ref: "workcell:placement:placement.policy".to_owned(),
                scope: scope_world(),
                value: Some(serde_json::json!("balanced")),
                secret_reference: None,
            },
            changeset_id: Some("cs-1".to_owned()),
        };
        let resolution = absent_owner_resolution(
            "workcell:placement:placement.policy",
            &scope_world(),
            Some(&held),
            reason,
        );
        assert_eq!(
            resolution.reconciliation.status,
            ReconciliationStatus::Blocked
        );
        assert_eq!(
            resolution.desired.as_ref().unwrap().value,
            Some(serde_json::json!("balanced"))
        );
        assert_eq!(
            resolution.desired.as_ref().unwrap().source_ref.as_deref(),
            Some("cs-1")
        );
        assert!(
            resolution.native.is_none(),
            "no native axes are invented for an absent owner"
        );
    }

    #[test]
    fn an_owner_that_answered_discovery_is_never_reported_absent() {
        use crate::configuration::contribution::Contribution;
        let contribution: Contribution = serde_json::from_value(serde_json::json!({
            "schema": "oi.configuration-contribution/v1",
            "owner": {
                "owner_ref": "ai-kit",
                "owner_kind": "product",
                "owner_version": "test",
                "contribution_command": ["aikit", "config-contribution", "--json"],
                "disclosed_at_unix_ms": 0
            },
            "about": "test contribution",
            "sections": [],
            "operations": { "transport": "cli/v1" },
            "availability": { "state": "available", "reason": null }
        }))
        .unwrap();
        let mut registry = OwnerRegistry::new();
        registry.register_contribution(contribution).unwrap();
        // An answered owner and a never-probed name are both None: the
        // absent-owner reading applies only where discovery failed.
        assert_eq!(
            absent_owner_reason(&registry, "ai-kit:resolution:model.default"),
            None
        );
        assert_eq!(
            absent_owner_reason(&registry, "elsewhere:section:key"),
            None
        );
    }

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
