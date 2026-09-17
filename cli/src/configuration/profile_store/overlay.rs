//! Profile diff/resolution inputs (C2 — #299 §17): pure functions that
//! group a profile's desired overlay entries by owner/scope and diff two
//! profiles (or a profile against no-desired-state) into the deterministic
//! plan input the kernel lane (C1) turns into a ChangeSet.
//!
//! Nothing here plans, dispatches or applies: no owner is contacted, no
//! ChangeSet is built, no state is written. The conversion to
//! [`RequestedChange`] is a data hand-off in the frozen ChangeSet shape
//! (09 §8); orchestration stays with the kernel.

use crate::configuration::changeset::RequestedChange;
use crate::configuration::profile::{DesiredEntry, Profile, SecretReferenceValue};
use crate::configuration::refs::{parse_setting_ref, Scope};
use crate::configuration::resolution::SecretReference;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeMap;

/// One desired overlay entry keyed for diffing: `(setting_ref, scope)` is
/// the identity of a desired relation — the same setting at a different
/// scope is a different relation.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct DesiredOverlayEntry {
    pub setting_ref: String,
    pub scope: Scope,
    pub value: Option<Value>,
    pub secret_reference: Option<SecretReferenceValue>,
}

impl From<&DesiredEntry> for DesiredOverlayEntry {
    fn from(entry: &DesiredEntry) -> Self {
        Self {
            setting_ref: entry.setting_ref.clone(),
            scope: entry.scope.clone(),
            value: entry.value.clone(),
            secret_reference: entry.secret_reference.clone(),
        }
    }
}

impl DesiredOverlayEntry {
    fn key(&self) -> (String, String) {
        (self.setting_ref.clone(), self.scope.compact())
    }
}

/// One owner's slice of a profile (09 §12 resolution order): the owner's
/// native profile references first (applied by the owner natively), then
/// the owner's sparse overrides at their declared scopes. Overlays appear
/// in owner-ref order; each owner's entries in
/// `(setting_ref, scope compact form)` order — deterministic by
/// construction.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct OwnerOverlay {
    /// The owner as named in refs: `ai-kit`, `oi`,
    /// `connector/factory-actuation`.
    pub owner_ref: String,
    /// Native profile refs this profile selects for the owner, in document
    /// order. Opaque to O:I — planned and routed as references (09 §13).
    pub native_profiles: Vec<String>,
    pub desired: Vec<DesiredOverlayEntry>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct OverlayError {
    pub setting_ref: String,
    pub message: String,
}

impl OverlayError {
    pub fn message(&self) -> String {
        format!("`{}`: {}", self.setting_ref, self.message)
    }
}

/// Group a profile's desired relations by owner. A `setting_ref` that does
/// not parse is an explicit error (a validated profile cannot produce one;
/// this function is total and refuses to guess).
pub fn overlay_by_owner(profile: &Profile) -> Result<Vec<OwnerOverlay>, OverlayError> {
    let mut owners: BTreeMap<String, OwnerOverlay> = BTreeMap::new();
    for native in &profile.native_profiles {
        owners
            .entry(native.owner_ref.clone())
            .or_insert_with(|| OwnerOverlay {
                owner_ref: native.owner_ref.clone(),
                native_profiles: Vec::new(),
                desired: Vec::new(),
            })
            .native_profiles
            .push(native.native_profile_ref.clone());
    }
    for entry in &profile.desired {
        let parts = parse_setting_ref(&entry.setting_ref).map_err(|error| OverlayError {
            setting_ref: entry.setting_ref.clone(),
            message: error.message(),
        })?;
        let owner_ref = if parts.is_connector {
            format!("connector/{}", parts.owner_ref)
        } else {
            parts.owner_ref
        };
        owners
            .entry(owner_ref.clone())
            .or_insert_with(|| OwnerOverlay {
                owner_ref,
                native_profiles: Vec::new(),
                desired: Vec::new(),
            })
            .desired
            .push(entry.into());
    }
    let mut overlays: Vec<OwnerOverlay> = owners.into_values().collect();
    for overlay in &mut overlays {
        overlay.desired.sort_by_key(|left| left.key());
    }
    Ok(overlays)
}

/// One desired relation's difference between two profiles.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum DesiredDifference {
    /// The target profile desires this relation; the source did not.
    Added { to: DesiredOverlayEntry },
    /// The source profile desired this relation; the target does not.
    /// Conversion to a ChangeSet entry follows the reset convention
    /// (09 §8): no value, no secret reference.
    Removed { previous: DesiredOverlayEntry },
    /// Both profiles desire this relation, with different content.
    Changed {
        previous: DesiredOverlayEntry,
        to: DesiredOverlayEntry,
    },
}

impl DesiredDifference {
    pub fn setting_ref(&self) -> &str {
        match self {
            DesiredDifference::Added { to } => &to.setting_ref,
            DesiredDifference::Removed { previous } => &previous.setting_ref,
            DesiredDifference::Changed { previous, .. } => &previous.setting_ref,
        }
    }

    pub fn scope(&self) -> &Scope {
        match self {
            DesiredDifference::Added { to } => &to.scope,
            DesiredDifference::Removed { previous } => &previous.scope,
            DesiredDifference::Changed { previous, .. } => &previous.scope,
        }
    }

    /// The ChangeSet `requested` entry this difference plans (09 §8/§14):
    /// additions and changes carry their value or secret reference
    /// (`present` is never stored — it is an observed-only fact);
    /// removals carry neither, the reset convention. Building the
    /// ChangeSet itself — ids, operations, owner routing — is the kernel
    /// lane's work.
    pub fn to_requested_change(&self) -> RequestedChange {
        let entry = match self {
            DesiredDifference::Added { to } => to,
            DesiredDifference::Removed { previous } => previous,
            DesiredDifference::Changed { to, .. } => to,
        };
        let (value, secret_reference) = match self {
            DesiredDifference::Removed { .. } => (None, None),
            _ => (
                entry.value.clone(),
                entry
                    .secret_reference
                    .as_ref()
                    .map(|reference| SecretReference {
                        ref_: reference.ref_.clone(),
                        // `present` is observed-only and never stored as
                        // desired state (09 §14).
                        present: None,
                    }),
            ),
        };
        RequestedChange {
            setting_ref: entry.setting_ref.clone(),
            scope: entry.scope.clone(),
            value,
            secret_reference,
        }
    }

    fn key(&self) -> (String, String) {
        (self.setting_ref().to_owned(), self.scope().compact())
    }
}

/// A native-profile selection change for one owner (09 §13): the owner
/// receives both lists as references; it resolves them natively.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct NativeProfileChange {
    pub owner_ref: String,
    pub from: Vec<String>,
    pub to: Vec<String>,
}

/// The deterministic diff/plan input for switching profiles (C2
/// acceptance, #299 §17): what desired relations appear, disappear or
/// change, and which owners' native-profile selections move.
///
/// `from = None` means activation from no prior desired state: every
/// target entry is [`DesiredDifference::Added`]. Entries are ordered by
/// `(setting_ref, scope compact form)`, owners by ref — computing this
/// twice yields the same bytes.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct ProfileDiff {
    /// `None` when diffing from no-desired-state.
    pub from_profile_ref: Option<String>,
    pub to_profile_ref: String,
    pub native_profiles: Vec<NativeProfileChange>,
    pub desired: Vec<DesiredDifference>,
}

fn entries_of(profile: &Profile) -> BTreeMap<(String, String), DesiredOverlayEntry> {
    profile
        .desired
        .iter()
        .map(|entry| {
            let overlay: DesiredOverlayEntry = entry.into();
            (overlay.key(), overlay)
        })
        .collect()
}

fn native_profiles_of(profile: Option<&Profile>) -> BTreeMap<String, Vec<String>> {
    let mut map: BTreeMap<String, Vec<String>> = BTreeMap::new();
    if let Some(profile) = profile {
        for native in &profile.native_profiles {
            map.entry(native.owner_ref.clone())
                .or_default()
                .push(native.native_profile_ref.clone());
        }
    }
    map
}

pub fn diff_profiles(from: Option<&Profile>, to: &Profile) -> ProfileDiff {
    let from_entries = from.map(entries_of).unwrap_or_default();
    let to_entries = entries_of(to);

    let mut desired = Vec::new();
    for (key, to_entry) in &to_entries {
        match from_entries.get(key) {
            None => desired.push(DesiredDifference::Added {
                to: to_entry.clone(),
            }),
            Some(previous) if previous != to_entry => {
                desired.push(DesiredDifference::Changed {
                    previous: previous.clone(),
                    to: to_entry.clone(),
                });
            }
            Some(_) => {}
        }
    }
    for (key, previous) in &from_entries {
        if !to_entries.contains_key(key) {
            desired.push(DesiredDifference::Removed {
                previous: previous.clone(),
            });
        }
    }
    desired.sort_by_key(|left| left.key());

    let from_native = native_profiles_of(from);
    let to_native = native_profiles_of(Some(to));
    let owners: std::collections::BTreeSet<&String> =
        from_native.keys().chain(to_native.keys()).collect();
    let mut native_profiles = Vec::new();
    for owner_ref in owners {
        let before = from_native.get(owner_ref);
        let after = to_native.get(owner_ref);
        if before != after {
            native_profiles.push(NativeProfileChange {
                owner_ref: owner_ref.clone(),
                from: before.cloned().unwrap_or_default(),
                to: after.cloned().unwrap_or_default(),
            });
        }
    }

    ProfileDiff {
        from_profile_ref: from.map(|profile| profile.profile_ref.clone()),
        to_profile_ref: to.profile_ref.clone(),
        native_profiles,
        desired,
    }
}
