//! The Live document owner's kernel ops: the reads and the validated
//! device-parameter write that the 8787 owner-service seam served. The
//! handler bodies are `live_set::api`, shared with `packages/live-shell`'s
//! server, so the kernel and the dev server answer from one contract.
//!
//! Reads are owner reads (`owner_read.rs`, outside the kernel lock). The
//! write rewrites one user `.als` file and no kernel state, so it records no
//! receipt; it runs outside the kernel lock too, serialised among writes by
//! `WRITE_GATE` so two edits cannot interleave their read-modify-write.
//!
//! Every path is one absolute `.als` document, the law the native host's own
//! read keeps (`native_shell.rs` live_shell_read): the renderer reaches one
//! Live set at a time, never an arbitrary file. A write is admitted only for a
//! set this kernel process has already read (`READ_SETS`, by canonical path):
//! the device panels always read before they write, so an op naming any other
//! `.als` on disk is refused. The write itself replaces the file atomically
//! (`live_set::api`), so a crash never leaves a half-written set.

use crate::{KernelOp, KernelOpResult};
use std::collections::HashSet;
use std::path::PathBuf;
use std::sync::Mutex;

static WRITE_GATE: Mutex<()> = Mutex::new(());
static READ_SETS: Mutex<Option<HashSet<PathBuf>>> = Mutex::new(None);

fn canonical(path: &str) -> Option<PathBuf> {
    std::fs::canonicalize(path).ok()
}

/// Record a set this process has read, by its canonical path.
fn remember_read(path: &str) {
    if let Some(path) = canonical(path) {
        READ_SETS
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .get_or_insert_with(HashSet::new)
            .insert(path);
    }
}

/// A write names a set this process has read, or it is refused.
fn admitted_for_write(path: &str) -> Result<(), String> {
    let known = canonical(path).is_some_and(|path| {
        READ_SETS
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .as_ref()
            .is_some_and(|sets| sets.contains(&path))
    });
    if known {
        Ok(())
    } else {
        Err("Read this Live set before writing to it: the kernel writes only a set the shell has read".into())
    }
}

/// Serve one Live op; `None` for every other op.
pub fn execute(op: &KernelOp) -> Option<Result<KernelOpResult, String>> {
    Some(match op {
        KernelOp::LiveSetRead { path } => native_document(path).and_then(|()| {
            let reading = live_set::api::set_json(path)?;
            remember_read(path);
            Ok(KernelOpResult::LiveSetReading { reading })
        }),
        KernelOp::LiveDeviceDescriptors => Ok(KernelOpResult::LiveDeviceDescriptorsReading {
            descriptors: live_set::api::device_descriptors_json(),
        }),
        KernelOp::LiveDeviceParamsRead {
            path,
            track,
            device,
        } => native_document(path).and_then(|()| {
            let reading = live_set::api::device_params_json(path, track, device)?;
            remember_read(path);
            Ok(KernelOpResult::LiveDeviceParamsReading { reading })
        }),
        KernelOp::LiveDeviceParamWrite {
            path,
            track,
            device_name,
            param_id,
            value,
        } => native_document(path)
            .and_then(|()| admitted_for_write(path))
            .and_then(|()| {
                let _gate = WRITE_GATE
                    .lock()
                    .unwrap_or_else(|poisoned| poisoned.into_inner());
                live_set::api::device_param_set(path, track, device_name, param_id, value)
                    .map(|reading| KernelOpResult::LiveDeviceParamWritten { reading })
            }),
        KernelOp::LiveClipRead { path, track, clip } => native_document(path).and_then(|()| {
            let at = live_set::edit::ClipAt::of(clip)?;
            let reading = live_set::edit::clip_json(path, *track, at)?;
            remember_read(path);
            Ok(KernelOpResult::LiveClipReading { reading })
        }),
        KernelOp::LiveClipWrite {
            path,
            expected_revision,
            track,
            clip,
            set,
            notes,
            envelopes,
        } => native_document(path)
            .and_then(|()| admitted_for_write(path))
            .and_then(|()| {
                let at = live_set::edit::ClipAt::of(clip)?;
                let _gate = WRITE_GATE
                    .lock()
                    .unwrap_or_else(|poisoned| poisoned.into_inner());
                live_set::edit::clip_write(
                    path,
                    expected_revision,
                    *track,
                    at,
                    set.as_ref(),
                    notes.as_deref(),
                    envelopes.as_deref(),
                )
                .map(|reading| KernelOpResult::LiveClipReading { reading })
            }),
        KernelOp::LiveTrackMixerWrite {
            path,
            expected_revision,
            track,
            control,
            value,
        } => native_document(path)
            .and_then(|()| admitted_for_write(path))
            .and_then(|()| {
                let _gate = WRITE_GATE
                    .lock()
                    .unwrap_or_else(|poisoned| poisoned.into_inner());
                live_set::edit::mixer_write(path, expected_revision, *track, control, value)
                    .map(|reading| KernelOpResult::LiveTrackMixerReading { reading })
            }),
        _ => return None,
    })
}

/// Admit one native `.als` document path, as the host's live_shell_read does.
fn native_document(path: &str) -> Result<(), String> {
    let native = std::path::Path::new(path);
    if native.is_absolute() && native.extension().and_then(|e| e.to_str()) == Some("als") {
        Ok(())
    } else {
        Err("Choose an absolute native .als document path".into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    /// One Master track carrying a Compressor2 device: a Threshold (stored
    /// 0.5, range 0..2) and an On toggle (true).
    const FIXTURE: &str = r#"<Ableton><LiveSet><MainTrack><DeviceChain><Mixer><Tempo><Manual Value="131" /></Tempo></Mixer><DeviceChain><Devices><Compressor2 Id="90"><Threshold><Manual Value="0.5" /><MidiControllerRange><Min Value="0" /><Max Value="2" /></MidiControllerRange></Threshold><On><Manual Value="true" /></On></Compressor2></Devices></DeviceChain></DeviceChain></MainTrack><Tracks /><Scenes><Scene /></Scenes></LiveSet></Ableton>"#;

    /// A gzip `.als` in the temp directory, unique to the test that asks for it.
    fn fixture(name: &str) -> String {
        let path =
            std::env::temp_dir().join(format!("live-set-owner-{}-{name}.als", std::process::id()));
        let root = live_set::xml::parse(FIXTURE).unwrap();
        std::fs::write(&path, live_set::write_gz(&root).unwrap()).unwrap();
        path.to_string_lossy().into_owned()
    }

    fn params(path: &str) -> serde_json::Value {
        let op = KernelOp::LiveDeviceParamsRead {
            path: path.into(),
            track: "Master".into(),
            device: "Compressor2".into(),
        };
        match execute(&op) {
            Some(Ok(KernelOpResult::LiveDeviceParamsReading { reading })) => reading,
            other => panic!("params reading expected, got {other:?}"),
        }
    }

    fn write(
        path: &str,
        param_id: &str,
        value: serde_json::Value,
    ) -> Result<KernelOpResult, String> {
        let op = KernelOp::LiveDeviceParamWrite {
            path: path.into(),
            track: "Master".into(),
            device_name: "Compressor2".into(),
            param_id: param_id.into(),
            value,
        };
        execute(&op).expect("a Live op")
    }

    #[test]
    fn set_read_serves_the_shared_reading() {
        let path = fixture("set-read");
        let op = KernelOp::LiveSetRead { path: path.clone() };
        let Some(Ok(KernelOpResult::LiveSetReading { reading })) = execute(&op) else {
            panic!("set reading expected");
        };
        assert_eq!(reading["summary"]["tempo_bpm"], 131.0);
        assert_eq!(reading["summary"]["path"], reading["document"]["path"]);
        assert!(reading["revision"].as_str().unwrap().starts_with("sha256:"));
        std::fs::remove_file(path).unwrap();
    }

    #[test]
    fn device_descriptors_are_the_live_dynamics_tables() {
        let Some(Ok(KernelOpResult::LiveDeviceDescriptorsReading { descriptors })) =
            execute(&KernelOp::LiveDeviceDescriptors)
        else {
            panic!("descriptor map expected");
        };
        let rows = descriptors["Compressor2"]
            .as_array()
            .expect("Compressor2 table");
        assert!(rows.iter().any(|row| row["id"] == "Threshold"));
        assert_eq!(
            descriptors.as_object().unwrap().len(),
            live_dynamics::params::table_keys().len()
        );
    }

    #[test]
    fn device_params_read_the_stored_values_and_their_ranges() {
        let path = fixture("params-read");
        let reading = params(&path);
        let threshold = reading["params"]
            .as_array()
            .unwrap()
            .iter()
            .find(|row| row["id"] == "Threshold")
            .expect("Threshold is stored");
        assert_eq!(threshold["value"], "0.5");
        assert_eq!(threshold["min"], "0");
        assert_eq!(threshold["max"], "2");
        std::fs::remove_file(path).unwrap();
    }

    #[test]
    fn device_param_write_validates_then_writes_back_in_place() {
        let path = fixture("param-write");
        // The shell reads a set before writing to it.
        params(&path);
        // Out of the table's stored extent: refused, and the set is untouched.
        let refused = write(&path, "Threshold", json!(3.0)).unwrap_err();
        assert!(refused.contains("out of range for Threshold"), "{refused}");
        assert!(params(&path)["params"].to_string().contains("\"0.5\""));
        // In range: written, persisted, and read back from the document.
        let Ok(KernelOpResult::LiveDeviceParamWritten { reading }) =
            write(&path, "Threshold", json!(0.25))
        else {
            panic!("write expected");
        };
        assert_eq!(reading["param"]["value"], "0.25");
        assert!(params(&path)["params"].to_string().contains("\"0.25\""));
        // A toggle takes a boolean only, and writes its stored word.
        assert!(write(&path, "On", json!(1)).unwrap_err().contains("toggle"));
        write(&path, "On", json!(false)).unwrap();
        assert!(params(&path)["params"].to_string().contains("\"false\""));
        // The write replaced the file atomically: no staged sibling is left behind.
        let set = std::path::Path::new(&path);
        let prefix = format!(".{}.oi-write-", set.file_name().unwrap().to_string_lossy());
        let staged: Vec<_> = std::fs::read_dir(set.parent().unwrap())
            .unwrap()
            .filter_map(|entry| entry.ok())
            .filter(|entry| entry.file_name().to_string_lossy().starts_with(&prefix))
            .collect();
        assert!(staged.is_empty(), "a staged write was left: {staged:?}");
        std::fs::remove_file(path).unwrap();
    }

    #[test]
    fn a_set_never_read_by_this_process_is_not_written() {
        let path = fixture("unread-write");
        let before = std::fs::read(&path).unwrap();
        let refused = write(&path, "Threshold", json!(0.25)).unwrap_err();
        assert!(
            refused.contains("Read this Live set before writing"),
            "{refused}"
        );
        assert_eq!(
            std::fs::read(&path).unwrap(),
            before,
            "the unread set is untouched"
        );
        std::fs::remove_file(path).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn a_read_only_or_hard_linked_set_is_refused_and_left_as_it_was() {
        use std::os::unix::fs::PermissionsExt;
        let locked = fixture("read-only");
        params(&locked);
        std::fs::set_permissions(&locked, std::fs::Permissions::from_mode(0o444)).unwrap();
        let before = std::fs::read(&locked).unwrap();
        let refused = write(&locked, "Threshold", json!(0.25)).unwrap_err();
        assert!(refused.contains("read-only"), "{refused}");
        assert_eq!(std::fs::read(&locked).unwrap(), before);
        std::fs::set_permissions(&locked, std::fs::Permissions::from_mode(0o644)).unwrap();
        std::fs::remove_file(&locked).unwrap();

        let linked = fixture("hard-linked");
        let other = format!("{linked}.other.als");
        std::fs::hard_link(&linked, &other).unwrap();
        params(&linked);
        let refused = write(&linked, "Threshold", json!(0.25)).unwrap_err();
        assert!(refused.contains("hard links"), "{refused}");
        std::fs::remove_file(&other).unwrap();
        std::fs::remove_file(&linked).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn a_symlinked_set_is_written_at_its_target_and_the_link_stays() {
        let target = fixture("linked-target");
        let link = format!("{target}.link.als");
        std::os::unix::fs::symlink(&target, &link).unwrap();
        params(&link);
        write(&link, "Threshold", json!(0.25)).unwrap();
        assert!(std::fs::symlink_metadata(&link)
            .unwrap()
            .file_type()
            .is_symlink());
        assert!(params(&target)["params"].to_string().contains("\"0.25\""));
        std::fs::remove_file(&link).unwrap();
        std::fs::remove_file(target).unwrap();
    }

    #[test]
    fn the_wire_names_are_the_device_panels_request_fields() {
        let write: KernelOp = serde_json::from_value(json!({
            "op": "live_device_param_write",
            "path": "/a.als",
            "track": "Master",
            "device_name": "Compressor2",
            "param_id": "Threshold",
            "value": 0.5
        }))
        .unwrap();
        assert!(matches!(write, KernelOp::LiveDeviceParamWrite { .. }));
        let read: KernelOp = serde_json::from_value(json!({
            "op": "live_device_params_read",
            "path": "/a.als",
            "track": "Master",
            "device": "Compressor2"
        }))
        .unwrap();
        assert!(matches!(read, KernelOp::LiveDeviceParamsRead { .. }));
        let set: KernelOp =
            serde_json::from_value(json!({"op": "live_set_read", "path": "/a.als"})).unwrap();
        assert!(matches!(set, KernelOp::LiveSetRead { .. }));
        let descriptors: KernelOp =
            serde_json::from_value(json!({"op": "live_device_descriptors"})).unwrap();
        assert!(matches!(descriptors, KernelOp::LiveDeviceDescriptors));
    }

    /// The renderer reaches one Live set at a time: a relative path, a
    /// non-.als file and a write to either are refused before any file is read.
    #[test]
    fn only_an_absolute_als_document_is_admitted() {
        let refused = |op: KernelOp| match execute(&op) {
            Some(Err(error)) => error,
            other => panic!("refusal expected, got {other:?}"),
        };
        let relative = refused(KernelOp::LiveSetRead {
            path: "set.als".into(),
        });
        assert!(relative.contains("absolute native .als"), "{relative}");
        let not_a_set = refused(KernelOp::LiveSetRead {
            path: std::env::temp_dir()
                .join("notes.txt")
                .to_string_lossy()
                .into_owned(),
        });
        assert!(not_a_set.contains("absolute native .als"), "{not_a_set}");
        let write = refused(KernelOp::LiveDeviceParamWrite {
            path: "/etc/hosts".into(),
            track: "Master".into(),
            device_name: "Compressor2".into(),
            param_id: "Threshold".into(),
            value: json!(0.5),
        });
        assert!(write.contains("absolute native .als"), "{write}");
    }

    /// One MIDI track holding a session clip, in Live 12's own shape.
    const CLIP_FIXTURE: &str = r#"<Ableton><LiveSet><Tracks><MidiTrack Id="1"><Name><EffectiveName Value="Keys" /></Name><DeviceChain><Mixer><Speaker><Manual Value="true" /></Speaker><SoloSink Value="false" /></Mixer><MainSequencer><MonitoringEnum Value="1" /><Recorder><IsArmed Value="false" /></Recorder><ClipSlotList><ClipSlot Id="0"><ClipSlot><Value><MidiClip Id="0" Time="0"><Loop><LoopStart Value="0" /><LoopEnd Value="4" /><StartRelative Value="0" /><LoopOn Value="true" /><OutMarker Value="4" /><HiddenLoopStart Value="0" /><HiddenLoopEnd Value="4" /></Loop><Name Value="Riff" /><LaunchMode Value="0" /><LaunchQuantisation Value="0" /><Notes><KeyTracks /><NoteIdGenerator><NextId Value="1" /></NoteIdGenerator></Notes></MidiClip></Value></ClipSlot></ClipSlot></ClipSlotList></MainSequencer></DeviceChain></MidiTrack></Tracks><MainTrack><DeviceChain><Mixer><Tempo><Manual Value="120" /></Tempo></Mixer></DeviceChain></MainTrack><Scenes><Scene /></Scenes></LiveSet></Ableton>"#;

    #[test]
    fn a_clip_and_a_mixer_row_are_written_only_after_a_read_and_on_its_revision() {
        let path =
            std::env::temp_dir().join(format!("live-set-owner-{}-clip.als", std::process::id()));
        std::fs::write(
            &path,
            live_set::write_gz(&live_set::xml::parse(CLIP_FIXTURE).unwrap()).unwrap(),
        )
        .unwrap();
        let path = path.to_string_lossy().into_owned();
        let slot = json!({"slot": 0});
        let write = |revision: &str, set: serde_json::Value| {
            execute(&KernelOp::LiveClipWrite {
                path: path.clone(),
                expected_revision: revision.into(),
                track: 0,
                clip: slot.clone(),
                set: set.as_object().cloned(),
                notes: None,
                envelopes: None,
            })
            .unwrap()
        };
        assert!(write("sha256:none", json!({"name": "x"}))
            .unwrap_err()
            .contains("Read this Live set before writing"));
        let read = match execute(&KernelOp::LiveClipRead {
            path: path.clone(),
            track: 0,
            clip: slot.clone(),
        }) {
            Some(Ok(KernelOpResult::LiveClipReading { reading })) => reading,
            other => panic!("clip reading expected, got {other:?}"),
        };
        assert_eq!(read["clip"]["name"], "Riff");
        let revision = read["revision"].as_str().unwrap().to_string();
        let wrote = match write(&revision, json!({"name": "Hook", "launch": "toggle"})) {
            Ok(KernelOpResult::LiveClipReading { reading }) => reading,
            other => panic!("clip reading expected, got {other:?}"),
        };
        assert_eq!(
            (
                wrote["clip"]["name"].clone(),
                wrote["clip"]["launch"].clone()
            ),
            (json!("Hook"), json!("toggle"))
        );
        assert!(write(&revision, json!({"name": "y"}))
            .unwrap_err()
            .contains("changed since it was read"));
        let mixed = execute(&KernelOp::LiveTrackMixerWrite {
            path: path.clone(),
            expected_revision: wrote["revision"].as_str().unwrap().into(),
            track: 0,
            control: "solo".into(),
            value: json!(true),
        });
        assert!(
            matches!(mixed, Some(Ok(KernelOpResult::LiveTrackMixerReading { ref reading })) if reading["mixer"]["solo"] == json!(true))
        );
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn other_ops_are_not_served_here() {
        assert!(execute(&KernelOp::ConfigDiff).is_none());
    }
}
