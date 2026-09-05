//! U0.4 kernel unit tests — the three the unit brief names, plus the
//! ported honesty guards. The owner is a fixture `ctrl` shell script (the
//! ported `desktop/core/src/flow.rs` test pattern): the kernel's calls and
//! their inputs are logged, and the fixture answers in the owner's real
//! envelope shapes (`central.project-world-source-reading/v1`,
//! `central.project-world-source-write-receipt/v1`).
//!
//! Fixture contents are deliberately free of quotes and backslashes so the
//! JSON templating below stays honest.

use std::fs;
use std::os::unix::fs::PermissionsExt;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

use oi_cradle_kernel::events::KernelEvent;
use oi_cradle_kernel::flow::SourceWriteFailure;
use oi_cradle_kernel::world::ListingAvailability;
use oi_cradle_kernel::{CentralClient, Kernel, KernelOp, KernelOpOutcome, KernelOpResult};

const CANONICAL_REF: &str =
    "central:source:project:project:o-i:ProjectCentral/user/learnings/README.md";
const REV1: &str = "central.content-fnv1a64/v1:2389:0aed651ab4539664";
const REV2: &str = "central.content-fnv1a64/v1:2404:8a5621ce8df6b57f";
const REV3: &str = "central.content-fnv1a64/v1:2431:1517f0eb5a11d29c";

struct Fixture {
    root: PathBuf,
    log: PathBuf,
}

impl Fixture {
    /// A fixture whose `source.read` serves the state files, and whose
    /// `source.write` performs a real compare-and-swap against them:
    /// mismatched `expected_revision` fails the CAS; a match stores the
    /// content and advances the revision.
    fn cas_owner() -> Self {
        Self::install(
            r#"#!/bin/sh
printf '%s %s\n' "$4" "$5" >> 'CALLS'
case "$4" in
  projectcentral.source.read)
    rev=$(cat 'STATE/rev' 2>/dev/null || printf '%s' 'REV1')
    content=$(cat 'STATE/content' 2>/dev/null || printf '%s' 'original canonical content')
    printf '{"ok":true,"data":{"schema":"central.project-world-source-reading/v1","world_ref":"project:project:o-i","source":{"ref":"REF","path":"ProjectCentral/user/learnings/README.md","exists":true,"provenance":"unresolved","standing":"unspecified","roles":[],"treatment":"projectcentral-user","agent_retrieval_allowed":true},"revision":{"revision":"%s","byte_len":25},"content":"%s","content_encoding":"utf-8","automatic_agent_or_model_invocation":false}}\n' "$rev" "$content"
    ;;
  projectcentral.source.write)
    expected=$(printf '%s' "$5" | sed 's/.*"expected_revision":"\([^"]*\)".*/\1/')
    content=$(printf '%s' "$5" | sed 's/.*"content":"\([^"]*\)".*/\1/')
    current=$(cat 'STATE/rev' 2>/dev/null || printf '%s' 'REV1')
    if [ "$expected" != "$current" ]; then
      printf '{"ok":false,"status":"invalid_input","error":{"code":"invalid_input","message":"World source revision conflict: expected %s, current %s"}}\n' "$expected" "$current"
      exit 2
    fi
    printf '%s' "$content" > 'STATE/content'
    printf '%s' 'REV3' > 'STATE/rev'
    printf '{"ok":true,"data":{"receipt":{"schema":"central.project-world-source-write-receipt/v1","world_ref":"project:project:o-i","source":{"ref":"REF","path":"ProjectCentral/user/learnings/README.md","exists":true,"provenance":"unresolved","standing":"unspecified","roles":[],"treatment":"projectcentral-user","agent_retrieval_allowed":true},"previous_revision":"%s","revision":{"revision":"REV3","byte_len":25},"changed":true,"change_ref":"central:change:project:project:o-i:1","actor":"human:desktop","actor_kind":"human","automatic_agent_or_model_invocation":false}}}\n' "$current"
    ;;
  *) exit 7 ;;
esac
"#,
        )
    }

    fn install(script: &str) -> Self {
        static FIXTURE_SEQUENCE: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let sequence = FIXTURE_SEQUENCE.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
        let root = std::env::temp_dir().join(format!(
            "oi-kernel-u04-{}-{nonce}-{sequence}",
            std::process::id()
        ));
        fs::create_dir_all(root.join("state")).unwrap();
        let log = root.join("calls.log");
        let executable = root.join("ctrl-fixture");
        let staging = root.join("ctrl-fixture.staging");
        let body = script
            .replace("CALLS", log.to_str().unwrap())
            .replace("STATE", root.join("state").to_str().unwrap())
            .replace("REF", CANONICAL_REF)
            .replace("REV1", REV1)
            .replace("REV3", REV3);
        fs::write(&staging, body).unwrap();
        let mut permissions = fs::metadata(&staging).unwrap().permissions();
        permissions.set_mode(0o755);
        fs::set_permissions(&staging, permissions).unwrap();
        fs::rename(&staging, &executable).unwrap();
        Self { root, log }
    }

    fn client(&self) -> CentralClient {
        CentralClient::with(self.root.join("ctrl-fixture"), None, "o-i".to_owned())
    }

    fn calls(&self) -> Vec<String> {
        fs::read_to_string(&self.log)
            .unwrap_or_default()
            .lines()
            .map(str::to_owned)
            .collect()
    }

    /// Simulate the concurrent external edit: the file on disk moves under
    /// the cradle's buffer, exactly as `echo >>` from another process.
    fn external_edit(&self, content: &str) {
        fs::write(self.root.join("state/rev"), REV2).unwrap();
        fs::write(self.root.join("state/content"), content).unwrap();
    }
}

impl Drop for Fixture {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.root);
    }
}

// ---------------------------------------------------------------------------
// 1. The CAS conflict path: structured failure, both sides preserved
// ---------------------------------------------------------------------------

#[test]
fn a_failed_cas_is_a_structured_conflict_with_both_sides_preserved() {
    let fixture = Fixture::cas_owner();
    let mut kernel = Kernel::new(fixture.client());
    kernel
        .apply(KernelOp::SourceOpen { project: None, source_ref: CANONICAL_REF.into() })
        .unwrap();
    kernel
        .apply(KernelOp::SourceEdit {
            source_ref: CANONICAL_REF.into(),
            content: "the cradle edit must survive the conflict".into(),
        })
        .unwrap();

    // The concurrent external edit: the file moves under the buffer.
    fixture.external_edit("the external edit landed on disk");

    let outcome = kernel
        .apply(KernelOp::SourceSave { project: None, source_ref: CANONICAL_REF.into() })
        .unwrap();
    let KernelOpResult::SourceSaveFailed { buffer, failure } = outcome.result else {
        panic!("a failed CAS must surface as SourceSaveFailed");
    };
    // Structured, both observed revisions, no prose mining.
    assert!(matches!(
        &failure,
        SourceWriteFailure::RevisionConflict { expected, current, .. }
            if expected == REV1 && current == REV2
    ));
    assert_eq!(failure.kind(), "revision-conflict");
    // BOTH sides preserved: the cradle buffer stays dirty and intact...
    assert!(buffer.dirty);
    assert_eq!(buffer.content, "the cradle edit must survive the conflict");
    // ...and the canonical side is kept re-readable in the conflict record.
    let conflict = buffer.conflict.expect("the conflict is recorded in the buffer");
    assert_eq!(conflict.expected_revision, REV1);
    assert_eq!(conflict.current_revision, REV2);
    assert_eq!(conflict.canonical_content, "the external edit landed on disk");
    // Exactly one conflict event, carrying both revisions and the ref.
    assert_eq!(outcome.receipts.len(), 1);
    let receipt = &outcome.receipts[0];
    assert_eq!(receipt.envelope.event.tag(), "source_write_conflict");
    match &receipt.envelope.event {
        KernelEvent::SourceWriteConflict { source, expected_revision, current_revision, .. } => {
            assert_eq!(source.ref_id, CANONICAL_REF);
            assert_eq!(expected_revision, REV1);
            assert_eq!(current_revision, REV2);
        }
        other => panic!("wrong event: {other:?}"),
    }
    // Nothing was overwritten silently: exactly one CAS write went out,
    // carrying the buffer's base revision.
    let writes: Vec<String> = fixture
        .calls()
        .into_iter()
        .filter(|call| call.starts_with("projectcentral.source.write"))
        .collect();
    assert_eq!(writes.len(), 1);
    assert!(writes[0].contains(&format!("\"expected_revision\":\"{REV1}\"")));

    // After re-reading the new revision, a second save succeeds (the
    // walk's reconcile path).
    let outcome = kernel
        .apply(KernelOp::SourceReread { project: None, source_ref: CANONICAL_REF.into() })
        .unwrap();
    assert_eq!(outcome.receipts.len(), 1, "the canonical re-read is one state change");
    let KernelOpResult::SourceReread { buffer } = outcome.result else {
        panic!("reread result");
    };
    // The dirty buffer survived the re-read; only its base moved.
    assert!(buffer.dirty);
    assert_eq!(buffer.content, "the cradle edit must survive the conflict");
    assert_eq!(buffer.base_revision, REV2);
    assert!(buffer.conflict.is_none(), "the conflict is resolved by the re-read");

    let outcome = kernel
        .apply(KernelOp::SourceSave { project: None, source_ref: CANONICAL_REF.into() })
        .unwrap();
    let KernelOpResult::SourceSaved { buffer, previous_revision, revision, changed } =
        &outcome.result
    else {
        panic!("save result");
    };
    assert!(changed);
    assert_eq!(previous_revision, REV2);
    assert_eq!(revision, REV3);
    assert!(!buffer.dirty);
    assert_eq!(outcome.receipts.len(), 1, "exactly one save-success event");
    assert_eq!(outcome.receipts[0].envelope.event.tag(), "source_changed");
}

// ---------------------------------------------------------------------------
// 2. One event per state change; seqs monotonic, no gaps, no duplicates
// ---------------------------------------------------------------------------

#[test]
fn every_state_change_emits_exactly_one_event_and_seqs_never_gap() {
    let fixture = Fixture::cas_owner();
    let mut kernel = Kernel::new(fixture.client());
    let mut total = 0usize;

    // Surface open: 1 event (surface_changed).
    let outcome = kernel
        .apply(KernelOp::SurfaceOpen {
            surface_id: "s1".into(),
            kind: "source".into(),
            source_ref: Some(CANONICAL_REF.into()),
            title: "README.md".into(),
        })
        .unwrap();
    assert_eq!(outcome.receipts.len(), 1, "surface open = exactly one event");
    assert_eq!(outcome.receipts[0].envelope.event.tag(), "surface_changed");
    total += 1;

    // Source open: 1 event (source_opened).
    let outcome = kernel
        .apply(KernelOp::SourceOpen { project: None, source_ref: CANONICAL_REF.into() })
        .unwrap();
    assert_eq!(outcome.receipts.len(), 1, "source open = exactly one event");
    assert_eq!(outcome.receipts[0].envelope.event.tag(), "source_opened");
    total += 1;

    // First edit: 1 event (buffer_dirty). Further edits: none — continued
    // typing is not a state change.
    let outcome = kernel
        .apply(KernelOp::SourceEdit {
            source_ref: CANONICAL_REF.into(),
            content: "edited once".into(),
        })
        .unwrap();
    assert_eq!(outcome.receipts.len(), 1, "clean->dirty = exactly one event");
    assert_eq!(outcome.receipts[0].envelope.event.tag(), "buffer_dirty");
    match &outcome.receipts[0].envelope.event {
        KernelEvent::BufferDirty { dirty, .. } => assert!(*dirty),
        other => panic!("wrong event: {other:?}"),
    }
    total += 1;
    for content in ["edited twice", "edited thrice", "and again"] {
        let outcome = kernel
            .apply(KernelOp::SourceEdit {
                source_ref: CANONICAL_REF.into(),
                content: content.into(),
            })
            .unwrap();
        assert!(outcome.receipts.is_empty(), "continued typing is not a state change");
    }

    // Reverting to the canonical content: dirty -> clean = exactly one event.
    let outcome = kernel
        .apply(KernelOp::SourceEdit {
            source_ref: CANONICAL_REF.into(),
            content: "original canonical content".into(),
        })
        .unwrap();
    assert_eq!(outcome.receipts.len(), 1, "dirty->clean = exactly one event");
    match &outcome.receipts[0].envelope.event {
        KernelEvent::BufferDirty { dirty, .. } => assert!(!dirty),
        other => panic!("wrong event: {other:?}"),
    }
    total += 1;

    // Dirty it again for the save.
    kernel
        .apply(KernelOp::SourceEdit {
            source_ref: CANONICAL_REF.into(),
            content: "edited for save".into(),
        })
        .unwrap();
    total += 1;

    // Save success: exactly 1 event (source_changed), revision advanced.
    let outcome = kernel
        .apply(KernelOp::SourceSave { project: None, source_ref: CANONICAL_REF.into() })
        .unwrap();
    assert_eq!(outcome.receipts.len(), 1, "save success = exactly one event");
    assert_eq!(outcome.receipts[0].envelope.event.tag(), "source_changed");
    let KernelOpResult::SourceSaved { buffer, previous_revision, revision, changed } =
        &outcome.result
    else {
        panic!("save result");
    };
    assert!(changed);
    assert_eq!(previous_revision, REV1);
    assert_eq!(revision, REV3);
    assert_ne!(previous_revision, revision, "the revision advanced");
    assert!(!buffer.dirty, "the buffer synced clean to the canonical layer");
    total += 1;

    // Focus: first move emits exactly one event; the same ref again emits
    // nothing (the relation did not move).
    let outcome = kernel
        .apply(KernelOp::SurfaceFocus { surface_id: "s1".into() })
        .unwrap();
    assert_eq!(outcome.receipts.len(), 1);
    assert_eq!(outcome.receipts[0].envelope.event.tag(), "focus_changed");
    total += 1;
    let outcome = kernel
        .apply(KernelOp::SurfaceFocus { surface_id: "s1".into() })
        .unwrap();
    assert!(outcome.receipts.is_empty(), "focusing the same ref again changes nothing");

    // Surface close: 1 event for the surface + 1 for the cleared focus —
    // two state changes, two receipts, never one event for two changes.
    let outcome = kernel
        .apply(KernelOp::SurfaceClose { surface_id: "s1".into() })
        .unwrap();
    assert_eq!(outcome.receipts.len(), 2);
    total += 2;

    // The whole log: strictly monotonic seqs from 1, no gaps, no duplicate
    // emission for one state change.
    let log = kernel.event_log();
    assert_eq!(log.len(), total);
    assert!(log.seq_is_ordered());
    let seqs: Vec<u64> = log.since(0).iter().map(|entry| entry.seq).collect();
    let expected: Vec<u64> = (1..=total as u64).collect();
    assert_eq!(seqs, expected, "seq is 1..=N with no gaps");
}

// ---------------------------------------------------------------------------
// 3. Ref grammar passthrough — Central's canonical grammar, verbatim
// ---------------------------------------------------------------------------

#[test]
fn refs_pass_through_in_centrals_canonical_grammar_verbatim() {
    let fixture = Fixture::cas_owner();
    let mut kernel = Kernel::new(fixture.client());

    // Open, edit, save — every owner call must carry the owner's ref
    // byte-identical; the kernel never mints or normalises one.
    kernel
        .apply(KernelOp::SourceOpen { project: None, source_ref: CANONICAL_REF.into() })
        .unwrap();
    kernel
        .apply(KernelOp::SourceEdit { source_ref: CANONICAL_REF.into(), content: "v2".into() })
        .unwrap();
    kernel
        .apply(KernelOp::SourceSave { project: None, source_ref: CANONICAL_REF.into() })
        .unwrap();

    for call in fixture.calls() {
        let (action, input) = call.split_once(' ').expect("action + json on the log");
        assert!(action.starts_with("projectcentral.source."), "{action}");
        let value: serde_json::Value = serde_json::from_str(input).unwrap();
        assert_eq!(value["source_ref"], CANONICAL_REF, "verbatim in {action}");
        assert_eq!(value["project"], "o-i", "co-reference through the project query");
    }

    // The focus event carries the same ref, exactly once, as the subject.
    kernel
        .apply(KernelOp::SurfaceOpen {
            surface_id: "s1".into(),
            kind: "source".into(),
            source_ref: Some(CANONICAL_REF.into()),
            title: "README.md".into(),
        })
        .unwrap();
    let outcome = kernel
        .apply(KernelOp::SurfaceFocus { surface_id: "s1".into() })
        .unwrap();
    assert_eq!(outcome.receipts.len(), 1);
    match &outcome.receipts[0].envelope.event {
        KernelEvent::FocusChanged { focus } => {
            assert_eq!(focus.subject_ref().unwrap().ref_id, CANONICAL_REF);
            assert_eq!(focus.subject_ref().unwrap().native_owner, "central");
        }
        other => panic!("wrong event: {other:?}"),
    }
    // The event round-trips on the wire with the ref intact.
    let receipt_json = serde_json::to_string(&outcome.receipts[0]).unwrap();
    assert!(receipt_json.contains(CANONICAL_REF));
    let parsed: serde_json::Value = serde_json::from_str(&receipt_json).unwrap();
    assert_eq!(parsed["seq"], 5); // open, edit, save, surface, focus — one each
    assert_eq!(parsed["schema"], "oi.kernel-event/v1");
    assert_eq!(parsed["version"], 1);
}

// ---------------------------------------------------------------------------
// 4. Unavailable ≠ error (honesty law)
// ---------------------------------------------------------------------------

#[test]
fn a_missing_ctrl_is_an_honest_unavailable_observation_not_a_crash() {
    let mut kernel = Kernel::new(CentralClient::with(
        "/nonexistent/oi-kernel-ctrl".into(),
        None,
        "o-i".into(),
    ));
    // Opening through an unavailable owner is an honest refusal to serve.
    assert!(kernel
        .apply(KernelOp::SourceOpen { project: None, source_ref: CANONICAL_REF.into() })
        .is_err());
    // A listing is an honest unavailable observation, not an error.
    let outcome = kernel
        .apply(KernelOp::SourcesList { project: None })
        .unwrap();
    let KernelOpResult::SourcesListed { listing } = outcome.result else {
        panic!("listing");
    };
    assert!(listing.sources.is_empty());
    let reason = match &listing.availability {
        ListingAvailability::Unavailable { reason } => reason.clone(),
        other => panic!("expected unavailable, got {other:?}"),
    };
    assert!(reason.to_lowercase().contains("unavailable"), "{reason}");
    assert_eq!(kernel.event_log().len(), 0, "no state changed, nothing emitted");
}

// ---------------------------------------------------------------------------
// 5. The op/outcome seam round-trips on the wire (the bridge protocol)
// ---------------------------------------------------------------------------

#[test]
fn ops_and_outcomes_round_trip_through_the_wire_protocol() {
    let op = serde_json::to_value(KernelOp::SourceSave {
        project: None,
        source_ref: CANONICAL_REF.into(),
    })
    .unwrap();
    assert_eq!(op["op"], "source_save");
    assert_eq!(op["source_ref"], CANONICAL_REF);
    let restored: KernelOp = serde_json::from_value(op).unwrap();
    assert_eq!(
        restored,
        KernelOp::SourceSave { project: None, source_ref: CANONICAL_REF.into() }
    );

    let mut kernel = Kernel::new(CentralClient::with(
        "/nonexistent/oi-kernel-ctrl".into(),
        None,
        "o-i".into(),
    ));
    let outcome = kernel.apply(KernelOp::State).unwrap();
    let wire = serde_json::to_value(&outcome).unwrap();
    assert_eq!(wire["result"], "state");
    assert!(wire["snapshot"]["focus"].is_object());
    let restored: KernelOpOutcome = serde_json::from_value(wire).unwrap();
    assert!(restored.receipts.is_empty());
}
