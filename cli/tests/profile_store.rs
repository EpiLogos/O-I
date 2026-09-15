//! C2 profile-store tests (#299 §17): persistence at
//! `$OI_HOME/profiles/<ref>.json` under the file-safety law, secret law on
//! load/save/export/import, deterministic diff/plan inputs for switching,
//! unknown-field tolerance, and the proof that profile operations alone
//! change nothing but the store (no native state, no composition mark).

use oi_cli::configuration::profile_store::{
    diff_profiles, export_document, import_document, overlay_by_owner, DesiredDifference,
    ProfileStore, StoreError, PROFILE_SIZE_CAP_BYTES,
};
use oi_cli::configuration::{Contribution, ContributionRegistry, NativeProfileRef, Profile};
use serde_json::{json, Value};
use std::fs;
use std::path::PathBuf;

fn cases_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../suite/configuration/cases")
}

fn load_case(name: &str) -> Value {
    let path = cases_dir().join(format!("{name}.json"));
    let raw = fs::read_to_string(&path)
        .unwrap_or_else(|error| panic!("cannot read {}: {error}", path.display()));
    serde_json::from_str(&raw).unwrap_or_else(|error| panic!("{name} is not JSON: {error}"))
}

fn fixture_profile() -> Profile {
    let case = load_case("profile-development");
    serde_json::from_value(case["profile"].clone())
        .unwrap_or_else(|error| panic!("fixture profile does not parse: {error}"))
}

fn fixture_profile_value() -> Value {
    load_case("profile-development")["profile"].clone()
}

/// Every contribution fixture, parsed and validated, in one registry (the
/// same basis the Gate-A contract tests use).
fn registry_with_contributions() -> ContributionRegistry {
    let mut registry = ContributionRegistry::new();
    for name in [
        "contribution-ai-kit",
        "contribution-oi",
        "contribution-connector-fixture",
        "contribution-unavailable",
    ] {
        let case = load_case(name);
        let contribution: Contribution = serde_json::from_value(case["contribution"].clone())
            .unwrap_or_else(|error| panic!("{name} does not parse: {error}"));
        contribution
            .validate()
            .unwrap_or_else(|error| panic!("{name} violates the contribution contract: {error}"));
        registry
            .register(&contribution)
            .unwrap_or_else(|error| panic!("{name} cannot register: {error}"));
    }
    registry
}

fn store_in(home: &tempfile::TempDir) -> ProfileStore {
    ProfileStore::from_config_home(home.path())
}

// --- storage location, round-trip, file-safety law ----------------------

#[test]
fn profile_is_stored_at_the_frozen_location_and_round_trips() {
    let home = tempfile::tempdir().unwrap();
    let store = store_in(&home);
    let profile = fixture_profile();

    store.save(&profile).unwrap();
    let path = store.path("development").unwrap();
    assert_eq!(
        path,
        home.path().join("profiles").join("development.json"),
        "profiles live at $OI_HOME/profiles/<ref>.json (09 §12)"
    );
    assert!(path.is_file(), "the stored profile is a regular file");

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mode = fs::metadata(&path).unwrap().permissions().mode() & 0o777;
        assert_eq!(mode, 0o600, "stored profiles are 0600 (09 §12)");
        let dir_mode = fs::metadata(home.path().join("profiles"))
            .unwrap()
            .permissions()
            .mode()
            & 0o777;
        assert_eq!(dir_mode, 0o700, "the profiles directory is created 0700");
    }

    let loaded = store.load("development").unwrap();
    assert_eq!(loaded, profile, "load round-trips the stored profile");
    assert_eq!(store.list_refs().unwrap(), vec!["development"]);
}

#[test]
fn save_publishes_atomically_with_no_temp_files_left_behind() {
    let home = tempfile::tempdir().unwrap();
    let store = store_in(&home);
    let mut profile = fixture_profile();
    store.save(&profile).unwrap();

    // Re-saving replaces the file in place (still exactly one artifact).
    profile.description = Some("revised".to_owned());
    store.save(&profile).unwrap();
    let entries: Vec<String> = fs::read_dir(home.path().join("profiles"))
        .unwrap()
        .map(|entry| entry.unwrap().file_name().to_string_lossy().into_owned())
        .collect();
    assert_eq!(entries.len(), 1, "no temp files survive a publish");
    assert_eq!(
        store.load("development").unwrap().description,
        Some("revised".to_owned())
    );
}

#[test]
fn empty_store_lists_nothing() {
    let home = tempfile::tempdir().unwrap();
    assert_eq!(store_in(&home).list_refs().unwrap(), Vec::<String>::new());
}

#[test]
fn invalid_refs_are_refused_before_any_path_is_built() {
    let home = tempfile::tempdir().unwrap();
    let store = store_in(&home);
    for bad in ["Development", "../evil", "with_underscore", "", "a:b"] {
        assert!(
            matches!(store.path(bad), Err(StoreError::InvalidProfileRef(_))),
            "`{bad}` must not become a store path"
        );
        assert!(store.load(bad).is_err(), "`{bad}` must not load");
    }
}

#[test]
fn document_identity_must_match_its_storage_location() {
    let home = tempfile::tempdir().unwrap();
    let store = store_in(&home);
    let mut profile = fixture_profile();
    profile.profile_ref = "staging".to_owned();
    store.save(&profile).unwrap();
    let misplaced = store.path("development").unwrap();
    fs::rename(store.path("staging").unwrap(), &misplaced).unwrap();
    assert!(
        matches!(
            store.load("development"),
            Err(StoreError::IdentityMismatch { .. })
        ),
        "a document at development.json claiming profile_ref staging is inconsistent state"
    );
}

#[cfg(unix)]
#[test]
fn symlinks_are_rejected_on_load_save_and_directory() {
    use std::os::unix::fs::symlink;

    let home = tempfile::tempdir().unwrap();
    let store = store_in(&home);
    store.save(&fixture_profile()).unwrap();

    // A symlink at the profile path is rejected on load, never followed.
    let target = tempfile::tempdir().unwrap();
    let outside = target.path().join("outside.json");
    fs::write(&outside, "material").unwrap();
    fs::remove_file(store.path("development").unwrap()).unwrap();
    symlink(&outside, store.path("development").unwrap()).unwrap();
    assert!(matches!(
        store.load("development"),
        Err(StoreError::SymlinkRejected(_))
    ));

    // Saving over a symlink refuses rather than replacing the link.
    let mut other = fixture_profile();
    other.profile_ref = "other".to_owned();
    symlink(&outside, store.path("other").unwrap()).unwrap();
    assert!(matches!(
        store.save(&other),
        Err(StoreError::SymlinkRejected(_))
    ));
    assert_eq!(
        fs::read(&outside).unwrap(),
        b"material",
        "the symlink target was never written through"
    );

    // A symlinked profiles directory is rejected too.
    let second = tempfile::tempdir().unwrap();
    fs::create_dir(second.path().join("real-profiles")).unwrap();
    symlink(
        second.path().join("real-profiles"),
        second.path().join("profiles"),
    )
    .unwrap();
    let diverted = ProfileStore::from_config_home(second.path());
    assert!(matches!(
        diverted.save(&fixture_profile()),
        Err(StoreError::SymlinkRejected(_))
    ));
}

#[test]
fn the_size_cap_bounds_stored_documents() {
    let home = tempfile::tempdir().unwrap();
    let store = store_in(&home);

    // A profile whose serialized document exceeds the cap is refused on save.
    let mut giant = fixture_profile();
    giant.description = Some("x".repeat(PROFILE_SIZE_CAP_BYTES as usize + 1));
    assert!(matches!(
        store.save(&giant),
        Err(StoreError::TooLarge { .. })
    ));

    // An oversized file planted in the store is refused on load.
    fs::create_dir_all(home.path().join("profiles")).unwrap();
    let path = store.path("giant").unwrap();
    fs::write(&path, vec![b'a'; PROFILE_SIZE_CAP_BYTES as usize + 1]).unwrap();
    assert!(matches!(
        store.load("giant"),
        Err(StoreError::TooLarge { .. })
    ));
}

#[test]
fn missing_profiles_are_not_found() {
    let home = tempfile::tempdir().unwrap();
    let store = store_in(&home);
    assert!(matches!(
        store.load("development"),
        Err(StoreError::NotFound(_))
    ));
}

// --- validation and the secret law ---------------------------------------

#[test]
fn load_and_save_enforce_the_structural_profile_laws() {
    let home = tempfile::tempdir().unwrap();
    let store = store_in(&home);
    let mut profile = fixture_profile();
    profile.schema = "oi.profile/v2".to_owned();
    let error = store.save(&profile).expect_err("unknown majors are errors");
    assert!(
        error.message().contains("unsupported_schema"),
        "unknown major names unsupported_schema, got: {}",
        error.message()
    );

    let mut contradictory = fixture_profile();
    let secret_entry = contradictory
        .desired
        .iter_mut()
        .find(|entry| entry.setting_ref == "ai-kit:providers:credentials.anthropic")
        .unwrap();
    secret_entry.value = Some(json!("sk-ant-material"));
    let error = store
        .save(&contradictory)
        .expect_err("value and secret_reference together are structural");
    assert!(
        error.message().contains("never a value"),
        "got: {}",
        error.message()
    );
}

#[test]
fn checked_operations_reject_material_for_secret_kind_settings() {
    let home = tempfile::tempdir().unwrap();
    let store = store_in(&home);
    let registry = registry_with_contributions();

    // The frozen fixture survives the checked paths: secret entries carry
    // references only.
    let profile = fixture_profile();
    store.save_checked(&profile, &registry).unwrap();
    let loaded = store.load_checked("development", &registry).unwrap();
    assert_eq!(loaded, profile);

    // A value on a secret-kind entry is rejected on save and on load. The
    // reference is removed so the value alone crosses the structural law —
    // the rejection below is the redaction law proper.
    let mut violating = fixture_profile_value();
    let secret_entry = violating["desired"]
        .as_array_mut()
        .unwrap()
        .iter_mut()
        .find(|entry| entry["setting_ref"] == "ai-kit:providers:credentials.anthropic")
        .unwrap();
    secret_entry["secret_reference"] = Value::Null;
    secret_entry["value"] = json!("sk-ant-MATERIAL");
    let error = store
        .save_value(&violating, Some(&registry))
        .expect_err("material for a secret-kind setting must be rejected");
    assert!(
        error.message().contains("redaction"),
        "the rejection names the redaction law, got: {}",
        error.message()
    );

    // The rejected write never landed: the store still holds the pristine,
    // reference-only document.
    let stored = store.load_value("development").unwrap();
    let secret_entry = stored["desired"]
        .as_array()
        .unwrap()
        .iter()
        .find(|entry| entry["setting_ref"] == "ai-kit:providers:credentials.anthropic")
        .unwrap();
    assert!(secret_entry.get("value").is_none());

    // Planted by hand, it is rejected on checked load as well.
    fs::create_dir_all(home.path().join("profiles")).unwrap();
    fs::write(
        store.path("development").unwrap(),
        serde_json::to_vec_pretty(&violating).unwrap(),
    )
    .unwrap();
    let error = store
        .load_checked("development", &registry)
        .expect_err("material in the store must be rejected on checked load");
    assert!(
        error.message().contains("redaction"),
        "got: {}",
        error.message()
    );
}

// --- unknown-field tolerance (09 §15) ------------------------------------

#[test]
fn store_round_trips_preserve_unknown_fields() {
    let home = tempfile::tempdir().unwrap();
    let store = store_in(&home);
    let registry = registry_with_contributions();

    let mut document = fixture_profile_value();
    document["oi-future-field"] = json!("preserved");
    document["desired"][0]["oi-future-entry-field"] = json!(true);
    store.save_value(&document, Some(&registry)).unwrap();

    let round = store.load_value("development").unwrap();
    assert_eq!(round["oi-future-field"], "preserved");
    assert_eq!(round["desired"][0]["oi-future-entry-field"], true);
    let typed = store.load("development").unwrap();
    typed.validate().unwrap();
}

// --- overlay grouping and the switch diff --------------------------------

#[test]
fn overlay_groups_desired_entries_by_owner_and_scope() {
    let profile = fixture_profile();
    let overlays = overlay_by_owner(&profile).unwrap();
    let owners: Vec<&str> = overlays.iter().map(|o| o.owner_ref.as_str()).collect();
    assert_eq!(
        owners,
        vec!["ai-kit", "connector/factory-actuation", "oi"],
        "owners appear in ref order, connector included"
    );

    let ai_kit = &overlays[0];
    assert_eq!(
        ai_kit.native_profiles,
        vec!["coding"],
        "native profiles travel by reference, grouped with their owner"
    );
    let keys: Vec<(String, String)> = ai_kit
        .desired
        .iter()
        .map(|entry| (entry.setting_ref.clone(), entry.scope.compact()))
        .collect();
    assert_eq!(
        keys,
        vec![
            (
                "ai-kit:providers:credentials.anthropic".to_owned(),
                "world".to_owned()
            ),
            (
                "ai-kit:resolution:model.default".to_owned(),
                "project:epilogos/o-i".to_owned()
            ),
            (
                "ai-kit:session:session.provider".to_owned(),
                "world".to_owned()
            ),
        ],
        "one owner's entries are ordered by (setting_ref, scope)"
    );
}

#[test]
fn switching_profiles_produces_a_deterministic_plan_input() {
    let home = tempfile::tempdir().unwrap();
    let store = store_in(&home);
    let registry = registry_with_contributions();

    let development = fixture_profile();
    let mut staging = development.clone();
    staging.profile_ref = "staging".to_owned();
    staging.native_profiles = vec![NativeProfileRef {
        owner_ref: "ai-kit".to_owned(),
        native_profile_ref: "review".to_owned(),
    }];
    // Same relation, different value → Changed.
    staging.desired[1].value = Some(json!("opus"));
    // Drop one relation (the oi override) → Removed.
    staging
        .desired
        .retain(|entry| entry.setting_ref != "oi:verify:verify.before-run");

    store.save_checked(&development, &registry).unwrap();
    store.save_checked(&staging, &registry).unwrap();
    assert_eq!(
        store.list_refs().unwrap(),
        vec!["development", "staging"],
        "two profiles coexist, each with its own native-profile ref and overrides"
    );

    let first = diff_profiles(Some(&development), &staging);
    let second = diff_profiles(Some(&development), &staging);
    assert_eq!(first, second, "the diff is deterministic");
    assert_eq!(
        serde_json::to_string(&first).unwrap(),
        serde_json::to_string(&second).unwrap(),
        "the serialized plan input is byte-identical across computations"
    );

    assert_eq!(first.from_profile_ref.as_deref(), Some("development"));
    assert_eq!(first.to_profile_ref, "staging");
    assert_eq!(
        first.native_profiles,
        vec![oi_cli::configuration::profile_store::NativeProfileChange {
            owner_ref: "ai-kit".to_owned(),
            from: vec!["coding".to_owned()],
            to: vec!["review".to_owned()],
        }],
        "the native-profile switch is explicit in the plan input (09 §13)"
    );

    let mut seen: Vec<String> = first
        .desired
        .iter()
        .map(|difference| {
            format!(
                "{} @ {}",
                difference.setting_ref(),
                difference.scope().compact()
            )
        })
        .collect();
    seen.sort();
    assert_eq!(
        seen,
        vec![
            "ai-kit:resolution:model.default @ project:epilogos/o-i".to_owned(),
            "oi:verify:verify.before-run @ world".to_owned(),
        ],
        "the switch changes exactly the relations that differ"
    );
    assert!(
        matches!(first.desired[0], DesiredDifference::Changed { .. }),
        "same relation, new value → Changed"
    );

    // The removal converts to the reset convention: no value, no reference.
    let removed = first
        .desired
        .iter()
        .find(|difference| matches!(difference, DesiredDifference::Removed { .. }))
        .unwrap();
    let requested = removed.to_requested_change();
    assert_eq!(requested.setting_ref, "oi:verify:verify.before-run");
    assert!(requested.value.is_none() && requested.secret_reference.is_none());

    // The change carries its value into the frozen ChangeSet shape.
    let changed = first
        .desired
        .iter()
        .find(|difference| matches!(difference, DesiredDifference::Changed { .. }))
        .unwrap();
    assert_eq!(changed.to_requested_change().value, Some(json!("opus")));
}

#[test]
fn activation_from_no_desired_state_adds_every_relation() {
    let profile = fixture_profile();
    let fresh = diff_profiles(None, &profile);
    assert_eq!(fresh.from_profile_ref, None);
    assert_eq!(
        fresh.desired.len(),
        profile.desired.len(),
        "every desired relation is Added from nothing"
    );
    assert!(fresh
        .desired
        .iter()
        .all(|difference| matches!(difference, DesiredDifference::Added { .. })));
    // Deterministic here too.
    assert_eq!(fresh, diff_profiles(None, &profile));
}

// --- export/import --------------------------------------------------------

#[test]
fn export_returns_the_same_document_secret_safe() {
    let home = tempfile::tempdir().unwrap();
    let store = store_in(&home);
    let registry = registry_with_contributions();

    let mut document = fixture_profile_value();
    document["oi-future-field"] = json!("travels");
    store.save_value(&document, Some(&registry)).unwrap();

    let exported = export_document(&store, "development", Some(&registry)).unwrap();
    assert_eq!(
        exported, document,
        "export is the same oi.profile/v1 document"
    );
    let secret_entry = exported["desired"]
        .as_array()
        .unwrap()
        .iter()
        .find(|entry| entry["setting_ref"] == "ai-kit:providers:credentials.anthropic")
        .unwrap();
    assert!(
        secret_entry.get("value").is_none(),
        "no material ever exports"
    );
    assert_eq!(
        secret_entry["secret_reference"]["ref"], "aikit:credentials:anthropic-key",
        "the secret travels as a reference"
    );
}

#[test]
fn import_stores_inspectable_desired_state_and_never_applies() {
    let home = tempfile::tempdir().unwrap();
    let store = store_in(&home);
    let registry = registry_with_contributions();

    let mut document = fixture_profile_value();
    document["oi-future-field"] = json!("kept");
    let stored = import_document(
        &store,
        &document,
        Some("suite:/fixtures/profile-development.json"),
        Some(&registry),
    )
    .unwrap();
    assert_eq!(stored.profile_ref, "development");

    let round = store.load_value("development").unwrap();
    assert_eq!(
        round["oi-future-field"], "kept",
        "unknown fields survive import"
    );
    assert_eq!(
        round["provenance"]["authored_by"], "imported",
        "import records its provenance as data"
    );
    assert_eq!(
        round["provenance"]["imported_from_ref"],
        "suite:/fixtures/profile-development.json"
    );
    assert_eq!(
        round["native_profiles"][0]["native_profile_ref"], "coding",
        "native-profile refs are preserved as references, never rebound silently"
    );
    assert_eq!(
        round["desired"][1]["scope"]["scope_ref"], "epilogos/o-i",
        "scope refs are preserved as references"
    );

    // Import never overwrites; a second import of the same document is an
    // explicit collision.
    assert!(matches!(
        import_document(&store, &document, None, Some(&registry)),
        Err(StoreError::AlreadyExists(_))
    ));

    // Import is not a hidden apply: no composition mark was written, and
    // profile operations alone created nothing but the store.
    assert!(
        !home.path().join("composition.json").exists(),
        "import must not write the active-profile mark or any composition state"
    );
    let mut home_entries: Vec<String> = fs::read_dir(home.path())
        .unwrap()
        .map(|entry| entry.unwrap().file_name().to_string_lossy().into_owned())
        .collect();
    home_entries.sort();
    assert_eq!(
        home_entries,
        vec!["profiles"],
        "profile operations alone touch only the profile store"
    );
}

#[test]
fn import_rejects_contract_violations_instead_of_storing_them() {
    let home = tempfile::tempdir().unwrap();
    let store = store_in(&home);
    let registry = registry_with_contributions();

    let mut violating = fixture_profile_value();
    let secret_entry = &mut violating["desired"][3];
    secret_entry["secret_reference"] = Value::Null;
    secret_entry["value"] = json!("sk-ant-MATERIAL");
    let error = import_document(&store, &violating, Some("somewhere"), Some(&registry))
        .expect_err("material for a secret-kind setting must not import");
    assert!(
        error.message().contains("redaction"),
        "got: {}",
        error.message()
    );
    assert!(!store.exists("development").unwrap(), "nothing was stored");

    // Structural laws hold even without a registry: both a value and a
    // secret_reference on one entry is already invalid.
    let mut contradictory = fixture_profile_value();
    contradictory["desired"][3]["value"] = json!("anything");
    contradictory["desired"][3]["secret_reference"] =
        json!({ "ref": "aikit:credentials:anthropic-key" });
    assert!(import_document(&store, &contradictory, None, None).is_err());
    assert!(!store.exists("development").unwrap());
}

// --- C2 acceptance (#299 §17) ---------------------------------------------

#[test]
fn profile_operations_alone_change_nothing_native() {
    let home = tempfile::tempdir().unwrap();
    let store = store_in(&home);
    let registry = registry_with_contributions();

    let document = fixture_profile_value();
    let _ = import_document(&store, &document, Some("fixture"), Some(&registry)).unwrap();
    let mut staging = document.clone();
    staging["profile_ref"] = json!("staging");
    staging["native_profiles"] = json!([{ "owner_ref": "ai-kit", "native_profile_ref": "review" }]);
    let _ = import_document(&store, &staging, Some("fixture"), Some(&registry)).unwrap();

    // Selecting for a switch is a diff — pure, no writes, no owner contact.
    let development = store.load_checked("development", &registry).unwrap();
    let staging_profile = store.load_checked("staging", &registry).unwrap();
    let plan = diff_profiles(Some(&development), &staging_profile);
    assert_eq!(plan.native_profiles.len(), 1);
    assert_eq!(plan.native_profiles[0].to, vec!["review".to_owned()]);

    // The only filesystem facts profile operations ever produced are the
    // two stored documents; nothing native, nothing compositional.
    let mut stored: Vec<String> = fs::read_dir(home.path().join("profiles"))
        .unwrap()
        .map(|entry| entry.unwrap().file_name().to_string_lossy().into_owned())
        .collect();
    stored.sort();
    assert_eq!(stored, vec!["development.json", "staging.json"]);
    assert!(!home.path().join("composition.json").exists());
}
