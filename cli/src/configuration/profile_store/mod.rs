//! The O:I profile store (C2 — #299 §17): persistence and diff inputs for
//! `oi.profile/v1` documents (09 §12–§13).
//!
//! What this module owns:
//!
//! - **Storage.** Profiles live at `$OI_HOME/profiles/<profile_ref>.json`
//!   (XDG default `~/.config/oi/profiles/`), beside `composition.json` —
//!   O:I composition state, never Central/Control (09 §12: generated
//!   profile state must not become authored Central source).
//! - **File-safety law** (09 §12): regular files only (no symlinks), 0600
//!   on write, size-capped ([`store::PROFILE_SIZE_CAP_BYTES`]), atomic
//!   publish (temp file + rename, with directory durability confirmation —
//!   the same discipline as `composition.json`), directories created 0700.
//!   The number of the size cap is this lane's to choose (256 KiB): far
//!   above any sparse profile, far below anything that is not one.
//! - **Validation on load/save** with the C0 profile types; with a
//!   [`ContributionRegistry`] the redaction law (09 §14) is enforced too:
//!   a profile carrying a `value` for a secret-kind desired entry is
//!   rejected, secret entries carry `secret_reference` only.
//! - **Diff/resolution inputs**: pure functions grouping a profile's
//!   desired entries by owner/scope and diffing two profiles (or a profile
//!   against no-desired-state) into the deterministic plan input the kernel
//!   lane (C1) turns into a ChangeSet. No ChangeSet orchestration here.
//! - **Export/import**: export is the same `oi.profile/v1` document
//!   (secret-safe by construction); import validates and stores the
//!   document as inspectable desired state — it never applies anything.
//!   Unknown fields are tolerated and preserved through store round-trips
//!   (09 §15).
//!
//! What this module deliberately does not own: the active-profile mark
//! (composition.json `active_profile`, written only by the explicit
//! use/clear operation through the composition state helpers — this store
//! never touches composition.json), the `oi profile` command surface (C5),
//! the kernel registry/ChangeSet engine (C1), or owner-native application.
pub mod overlay;
pub mod store;
pub mod transfer;

pub use overlay::{
    diff_profiles, overlay_by_owner, DesiredDifference, DesiredOverlayEntry, NativeProfileChange,
    OverlayError, OwnerOverlay, ProfileDiff,
};
pub use store::{
    is_valid_profile_ref, oi_config_home, ProfileStore, StoreError, PROFILE_SIZE_CAP_BYTES,
};
pub use transfer::{export_document, import_document};
