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
//!
//! A clip of a constellation is made in an empty slot (`live_clip_create`,
//! O-I #768), its source kept in the DLW's record beside the set
//! (`live_set::sources`) and read back with the clip by `live_clip_read`.
//!
//! Beside the clip and the mixer row (`live_set::edit`): a track's sends
//! written through the mixer write (`control: "send"` with its index), a
//! stretch of a take comped into the main lane (`live_take_comp`), and the
//! set's Groove Pool read and written (`live_groove_pool_read`,
//! `live_groove_pool_write`) — each write admitted, gated and refused as the
//! others are.
//!
//! The acts on the set's objects (DLW §10.9, O-I #743: paste, duplicate and
//! delete a clip, an empty slot's stop button, rename, move and duplicate a
//! track, insert, rename, duplicate and delete a row) are one op typed by its
//! act (`live_set_act`, `live_set::acts`), admitted, gated and refused as
//! every other write.

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
        KernelOp::LiveClipCreate {
            path,
            expected_revision,
            track,
            scene,
            length,
            set,
            notes,
            source,
        } => native_document(path)
            .and_then(|()| admitted_for_write(path))
            .and_then(|()| {
                let _gate = WRITE_GATE
                    .lock()
                    .unwrap_or_else(|poisoned| poisoned.into_inner());
                live_set::edit::clip_create(
                    path,
                    expected_revision,
                    *track,
                    *scene,
                    *length,
                    set.as_ref(),
                    notes,
                    source.as_deref(),
                )
                .map(|reading| KernelOpResult::LiveClipReading { reading })
            }),
        KernelOp::LiveTrackMixerWrite {
            path,
            expected_revision,
            track,
            control,
            value,
            index,
        } => native_document(path)
            .and_then(|()| admitted_for_write(path))
            .and_then(|()| {
                let _gate = WRITE_GATE
                    .lock()
                    .unwrap_or_else(|poisoned| poisoned.into_inner());
                live_set::edit::mixer_write(path, expected_revision, *track, control, value, *index)
                    .map(|reading| KernelOpResult::LiveTrackMixerReading { reading })
            }),
        KernelOp::LiveTakeComp {
            path,
            expected_revision,
            track,
            take,
            range,
        } => native_document(path)
            .and_then(|()| admitted_for_write(path))
            .and_then(|()| {
                let _gate = WRITE_GATE
                    .lock()
                    .unwrap_or_else(|poisoned| poisoned.into_inner());
                live_set::edit::take_comp(path, expected_revision, *track, *take, range)
                    .map(|reading| KernelOpResult::LiveTakeCompReading { reading })
            }),
        KernelOp::LiveGroovePoolRead { path } => native_document(path).and_then(|()| {
            let reading = live_set::edit::groove_pool_read(path)?;
            remember_read(path);
            Ok(KernelOpResult::LiveGroovePoolReading { reading })
        }),
        KernelOp::LiveGroovePoolWrite {
            path,
            expected_revision,
            groove,
            field,
            value,
        } => native_document(path)
            .and_then(|()| admitted_for_write(path))
            .and_then(|()| {
                let _gate = WRITE_GATE
                    .lock()
                    .unwrap_or_else(|poisoned| poisoned.into_inner());
                live_set::edit::groove_pool_write(path, expected_revision, *groove, field, value)
                    .map(|reading| KernelOpResult::LiveGroovePoolReading { reading })
            }),
        KernelOp::LiveSetAct {
            path,
            expected_revision,
            act,
        } => native_document(path)
            .and_then(|()| admitted_for_write(path))
            .and_then(|()| {
                let _gate = WRITE_GATE
                    .lock()
                    .unwrap_or_else(|poisoned| poisoned.into_inner());
                live_set::acts::act(path, expected_revision, act)
                    .map(|reading| KernelOpResult::LiveSetActed { reading })
            }),
        KernelOp::LiveSetsList => std::env::var_os("HOME")
            .filter(|home| !home.is_empty())
            .ok_or_else(|| {
                "The person's home is not named (HOME), so their Live sets cannot be found"
                    .to_owned()
            })
            .map(|home| KernelOpResult::LiveSetsReading {
                reading: sets_reading(std::path::Path::new(&home)),
            }),
        _ => return None,
    })
}

/// How deep a place is walked, how many entries are looked at in all, and how
/// many sets are listed: the person's Music folder can be large.
const SETS_DEPTH: usize = 8;
const SETS_ENTRIES: usize = 50_000;
const SETS_LISTED: usize = 500;

/// Folders a person's own sets never stand in: Live's backups, Live's own
/// packs and project bookkeeping. A hidden folder, a symbolic link and a
/// package (an app, a plug-in, a Logic or GarageBand project, a media
/// library) are never walked either.
const NOT_SETS: &[&str] = &["Backup", "Factory Packs", "Ableton Project Info"];
const PACKAGES: &[&str] = &[
    "app",
    "bundle",
    "component",
    "framework",
    "vst",
    "vst3",
    "logicx",
    "band",
    "musiclibrary",
    "photoslibrary",
    "tvlibrary",
    "plugin",
];

/// One `Value="…"` attribute read back from Library.cfg's XML.
fn cfg_unescape(raw: &str) -> String {
    raw.replace("&quot;", "\"")
        .replace("&apos;", "'")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&amp;", "&")
}

/// Every `<Tag Value="…"` inside the first `<section>…</section>` of a
/// Library.cfg, whose tag name ends with `suffix`.
fn cfg_values(cfg: &str, section: &str, suffix: &str) -> Vec<String> {
    let (open, close) = (format!("<{section}>"), format!("</{section}>"));
    let Some(body) = cfg
        .split_once(&open)
        .and_then(|(_, rest)| rest.split_once(&close).map(|(body, _)| body))
    else {
        return Vec::new();
    };
    body.split('<')
        .filter_map(|tag| {
            let (name, rest) = tag.split_once(' ')?;
            let value = rest.split_once("Value=\"")?.1.split_once('"')?.0;
            (name.ends_with(suffix) && !value.is_empty()).then(|| cfg_unescape(value))
        })
        .collect()
}

/// Live's own places, from each installed Live's Library.cfg under the
/// person's preferences: the User Library (its ProjectPath joined with its
/// ProjectName) and every folder added to Places (UserFolderInfoList).
fn lives_places(home: &std::path::Path) -> Vec<(String, std::path::PathBuf)> {
    let preferences = home.join("Library/Preferences/Ableton");
    let mut versions: Vec<std::path::PathBuf> = std::fs::read_dir(&preferences)
        .map(|rows| {
            rows.flatten()
                .map(|row| row.path().join("Library.cfg"))
                .collect()
        })
        .unwrap_or_default();
    versions.sort();
    let mut places = Vec::new();
    for cfg in versions {
        let Ok(text) = std::fs::read_to_string(&cfg) else {
            continue;
        };
        let root = cfg_values(&text, "UserLibrary", "ProjectPath");
        let name = cfg_values(&text, "UserLibrary", "ProjectName");
        if let (Some(root), Some(name)) = (root.first(), name.first()) {
            places.push((name.clone(), std::path::Path::new(root).join(name)));
        }
        for folder in cfg_values(&text, "UserFolderInfoList", "Path") {
            let path = std::path::PathBuf::from(&folder);
            let label = path
                .file_name()
                .map(|name| name.to_string_lossy().into_owned())
                .unwrap_or(folder);
            places.push((label, path));
        }
    }
    places
}

/// Whether a folder is walked for sets.
fn walks(name: &str) -> bool {
    let package = name
        .rsplit_once('.')
        .is_some_and(|(_, extension)| PACKAGES.contains(&extension.to_ascii_lowercase().as_str()));
    !name.starts_with('.') && !package && !NOT_SETS.contains(&name)
}

/// The person's own Live sets (DLW §10.3, "What leads the browser — Live:
/// Your sets, and the Torus's saved sounds"; §21: Live reads and writes a
/// real `.als`): every `.als` in the places a person keeps them — the Music
/// folder, and Live's own places read from its Library.cfg (the User Library,
/// whose Templates hold the sets to start from, and each folder the person
/// added to Live's Places) — newest first. A set's place is the most
/// particular place it stands in. Live's backups, its Factory Packs, hidden
/// folders, packages and symbolic links are never walked. Read only: nothing
/// here opens, copies or writes a set.
pub fn sets_reading(home: &std::path::Path) -> serde_json::Value {
    let mut places: Vec<(String, std::path::PathBuf)> = vec![("Music".into(), home.join("Music"))];
    for place in lives_places(home) {
        if !places.iter().any(|(_, path)| path == &place.1) {
            places.push(place);
        }
    }
    let library = places
        .iter()
        .skip(1)
        .find(|(_, path)| path.join("Templates").is_dir())
        .map(|(_, path)| path.clone());
    let mut seen = std::collections::BTreeMap::<std::path::PathBuf, serde_json::Value>::new();
    let (mut looked, mut truncated) = (0usize, false);
    for (_, root) in &places {
        let mut stack = vec![(root.clone(), 0usize)];
        while let Some((dir, depth)) = stack.pop() {
            let Ok(rows) = std::fs::read_dir(&dir) else {
                continue;
            };
            for row in rows.flatten() {
                looked += 1;
                if looked > SETS_ENTRIES || seen.len() >= SETS_LISTED {
                    truncated = true;
                    break;
                }
                let Ok(kind) = row.file_type() else { continue };
                let path = row.path();
                let name = row.file_name().to_string_lossy().into_owned();
                if kind.is_dir() {
                    if depth < SETS_DEPTH && walks(&name) {
                        stack.push((path, depth + 1));
                    }
                    continue;
                }
                if !kind.is_file()
                    || name.starts_with('.')
                    || path.extension().and_then(|e| e.to_str()) != Some("als")
                    || seen.contains_key(&path)
                {
                    continue;
                }
                let place = places
                    .iter()
                    .filter(|(_, root)| path.starts_with(root))
                    .max_by_key(|(_, root)| root.components().count())
                    .map(|(label, _)| label.clone())
                    .unwrap_or_default();
                let template = library.as_ref().is_some_and(|library| {
                    path.strip_prefix(library).is_ok_and(|rest| {
                        rest.components()
                            .any(|part| part.as_os_str() == "Templates")
                    })
                });
                let modified = row
                    .metadata()
                    .ok()
                    .and_then(|meta| meta.modified().ok())
                    .and_then(|at| at.duration_since(std::time::UNIX_EPOCH).ok())
                    .map(|at| at.as_millis() as u64);
                let stem = path
                    .file_stem()
                    .map(|s| s.to_string_lossy().into_owned())
                    .unwrap_or(name);
                seen.insert(
                    path.clone(),
                    serde_json::json!({"path": path.to_string_lossy(), "name": stem, "place": place,
                        "template": template, "modified_unix_ms": modified}),
                );
            }
        }
    }
    let mut sets: Vec<serde_json::Value> = seen.into_values().collect();
    sets.sort_by(|a, b| {
        b["modified_unix_ms"]
            .as_u64()
            .cmp(&a["modified_unix_ms"].as_u64())
            .then_with(|| a["path"].as_str().cmp(&b["path"].as_str()))
    });
    let places: Vec<serde_json::Value> = places
        .iter()
        .map(|(label, path)| serde_json::json!({"label": label, "path": path.to_string_lossy(), "present": path.is_dir()}))
        .collect();
    serde_json::json!({"schema": "oi.live-sets/v1", "places": places, "sets": sets, "truncated": truncated})
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
            index: None,
        });
        assert!(
            matches!(mixed, Some(Ok(KernelOpResult::LiveTrackMixerReading { ref reading })) if reading["mixer"]["solo"] == json!(true))
        );
        let _ = std::fs::remove_file(&path);
    }

    /// One MIDI part whose first slot holds a clip in Live 12's own shape and whose second is empty.
    const MAKE_FIXTURE: &str = r#"<Ableton><LiveSet><Tracks><MidiTrack Id="7"><Name><EffectiveName Value="Keys" /></Name><Color Value="26" /><DeviceChain><Mixer><Speaker><Manual Value="true" /></Speaker><SoloSink Value="false" /></Mixer><MainSequencer><MonitoringEnum Value="1" /><Recorder><IsArmed Value="false" /></Recorder><ClipSlotList><ClipSlot Id="0"><ClipSlot><Value><MidiClip Id="0" Time="0"><CurrentStart Value="0" /><CurrentEnd Value="8" /><Loop><LoopStart Value="0" /><LoopEnd Value="8" /><StartRelative Value="0" /><LoopOn Value="false" /><OutMarker Value="8" /><HiddenLoopStart Value="0" /><HiddenLoopEnd Value="8" /></Loop><Name Value="Riff" /><Annotation Value="" /><Color Value="14" /><LaunchMode Value="1" /><LaunchQuantisation Value="0" /><Envelopes><Envelopes /></Envelopes><Legato Value="true" /><GrooveSettings><GrooveId Value="-1" /></GrooveSettings><Disabled Value="false" /><VelocityAmount Value="0" /><FollowAction><FollowTime Value="4" /><IsLinked Value="true" /><LoopIterations Value="1" /><FollowActionA Value="4" /><FollowActionB Value="0" /><FollowChanceA Value="100" /><FollowChanceB Value="0" /><JumpIndexA Value="1" /><JumpIndexB Value="1" /><FollowActionEnabled Value="true" /></FollowAction><Notes><KeyTracks /><NoteIdGenerator><NextId Value="1" /></NoteIdGenerator></Notes><ScaleInformation><RootNote Value="0" /><Name Value="Major" /></ScaleInformation><IsInKey Value="true" /></MidiClip></Value></ClipSlot></ClipSlot><ClipSlot Id="1"><ClipSlot><Value /></ClipSlot></ClipSlot></ClipSlotList></MainSequencer></DeviceChain></MidiTrack></Tracks><MainTrack><DeviceChain><Mixer><Tempo><Manual Value="120" /></Tempo></Mixer></DeviceChain></MainTrack><Scenes><Scene /><Scene /></Scenes></LiveSet></Ableton>"#;

    /// O-I #768: Live makes its clip of a constellation through the owner: only on a set it has read and on its revision, in the
    /// part's first empty slot, with its notes, and its source kept beside the set and read back with the clip.
    #[test]
    fn a_clip_of_a_constellation_is_made_on_a_read_set_and_reads_back_with_its_source() {
        let dir = std::env::temp_dir().join(format!("live-set-owner-{}-make", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let file = dir.join("make.als");
        std::fs::write(
            &file,
            live_set::write_gz(&live_set::xml::parse(MAKE_FIXTURE).unwrap()).unwrap(),
        )
        .unwrap();
        let path = file.to_string_lossy().into_owned();
        let op: KernelOp = serde_json::from_value(json!({"op": "live_clip_create", "path": path, "expected_revision": "sha256:none", "track": 0, "length": 4,
            "set": {"name": "The lived-in world"}, "notes": [{"p": 62, "at": 0, "len": 4, "vel": 100}], "source": "wiki:anchor:lived-in"}))
        .unwrap();
        let unread = match execute(&op) {
            Some(Err(error)) => error,
            other => panic!("refusal expected, got {other:?}"),
        };
        assert!(
            unread.contains("Read this Live set before writing"),
            "{unread}"
        );
        let read = match execute(&KernelOp::LiveClipRead {
            path: path.clone(),
            track: 0,
            clip: json!({"slot": 0}),
        }) {
            Some(Ok(KernelOpResult::LiveClipReading { reading })) => reading,
            other => panic!("clip reading expected, got {other:?}"),
        };
        assert_eq!(read["clip"]["source"], serde_json::Value::Null);
        let mut request = serde_json::to_value(&op).unwrap();
        request["expected_revision"] = read["revision"].clone();
        let made = match execute(&serde_json::from_value(request).unwrap()) {
            Some(Ok(KernelOpResult::LiveClipReading { reading })) => reading,
            other => panic!("clip reading expected, got {other:?}"),
        };
        assert_eq!(made["at"], json!({"slot": 1}));
        assert_eq!(made["clip"]["name"], "The lived-in world");
        assert_eq!(made["clip"]["source"], "wiki:anchor:lived-in");
        let back = match execute(&KernelOp::LiveClipRead {
            path: path.clone(),
            track: 0,
            clip: json!({"slot": 1}),
        }) {
            Some(Ok(KernelOpResult::LiveClipReading { reading })) => reading,
            other => panic!("clip reading expected, got {other:?}"),
        };
        assert_eq!(
            back["clip"]["source"], "wiki:anchor:lived-in",
            "the source reads back from the owner"
        );
        assert_eq!(back["clip"]["notes"][0]["p"], 62);
        let _ = std::fs::remove_dir_all(&dir);
    }

    /// A MIDI track with two take lanes (TakeId 1 and 2), its main lane holding take 1, sends to one return, and a Groove Pool
    /// of one groove: element names and nesting as real Live 12 sets keep them (live-set's own tests carry the full shapes).
    const COMP_FIXTURE: &str = r#"<Ableton><LiveSet><Tracks><MidiTrack Id="1"><Name><EffectiveName Value="Keys" /></Name><TakeLanes><TakeLanes><TakeLane Id="0"><ClipAutomation><Events><MidiClip Id="0" Time="0"><CurrentStart Value="0" /><CurrentEnd Value="8" /><Loop><LoopStart Value="0" /><LoopEnd Value="8" /><StartRelative Value="0" /><LoopOn Value="false" /><OutMarker Value="8" /><HiddenLoopStart Value="0" /><HiddenLoopEnd Value="8" /></Loop><Name Value="Keys" /><TakeId Value="1" /></MidiClip></Events></ClipAutomation><Name Value="Lane" /></TakeLane><TakeLane Id="1"><ClipAutomation><Events><MidiClip Id="0" Time="2"><CurrentStart Value="2" /><CurrentEnd Value="6" /><Loop><LoopStart Value="0" /><LoopEnd Value="4" /><StartRelative Value="0" /><LoopOn Value="false" /><OutMarker Value="4" /><HiddenLoopStart Value="0" /><HiddenLoopEnd Value="4" /></Loop><Name Value="Keys 2" /><TakeId Value="2" /></MidiClip></Events></ClipAutomation><Name Value="Lane" /></TakeLane></TakeLanes></TakeLanes><DeviceChain><Mixer><Sends><TrackSendHolder Id="0"><Send><Manual Value="0.0003162277571" /><MidiControllerRange><Min Value="0.0003162277571" /><Max Value="1" /></MidiControllerRange><AutomationTarget Id="30" /></Send><EnabledByUser Value="true" /></TrackSendHolder></Sends><Speaker><Manual Value="true" /></Speaker></Mixer><MainSequencer><ClipTimeable><ArrangerAutomation><Events><MidiClip Id="3" Time="0"><CurrentStart Value="0" /><CurrentEnd Value="8" /><Loop><LoopStart Value="0" /><LoopEnd Value="8" /><StartRelative Value="0" /><LoopOn Value="false" /><OutMarker Value="8" /><HiddenLoopStart Value="0" /><HiddenLoopEnd Value="8" /></Loop><Name Value="Keys" /><TakeId Value="1" /></MidiClip></Events></ArrangerAutomation></ClipTimeable></MainSequencer></DeviceChain></MidiTrack><ReturnTrack Id="2"><Name><EffectiveName Value="A-Reverb" /></Name><DeviceChain><Mixer><Speaker><Manual Value="true" /></Speaker></Mixer></DeviceChain></ReturnTrack></Tracks><MainTrack><DeviceChain><Mixer><Tempo><Manual Value="120" /><AutomationTarget Id="8" /></Tempo><GlobalGrooveAmount><Manual Value="100" /><MidiControllerRange><Min Value="0" /><Max Value="131.25" /></MidiControllerRange></GlobalGrooveAmount></Mixer></DeviceChain></MainTrack><Scenes><Scene /></Scenes><GroovePool><Grooves><Groove Id="0"><Name Value="Swing 16ths 57" /><Grid Value="3" /><QuantizationAmount Value="0" /><TimingAmount Value="100" /><RandomAmount Value="0" /><VelocityAmount Value="100" /></Groove></Grooves></GroovePool></LiveSet></Ableton>"#;

    fn comp_fixture(name: &str) -> String {
        let path =
            std::env::temp_dir().join(format!("live-set-owner-{}-{name}.als", std::process::id()));
        std::fs::write(
            &path,
            live_set::write_gz(&live_set::xml::parse(COMP_FIXTURE).unwrap()).unwrap(),
        )
        .unwrap();
        path.to_string_lossy().into_owned()
    }

    fn pool(path: &str) -> serde_json::Value {
        match execute(&KernelOp::LiveGroovePoolRead { path: path.into() }) {
            Some(Ok(KernelOpResult::LiveGroovePoolReading { reading })) => reading,
            other => panic!("groove pool reading expected, got {other:?}"),
        }
    }

    #[test]
    fn a_comp_a_send_and_a_groove_are_written_only_after_a_read_and_on_its_revision() {
        let path = comp_fixture("comp");
        let comp = |revision: &str| {
            execute(&KernelOp::LiveTakeComp {
                path: path.clone(),
                expected_revision: revision.into(),
                track: 0,
                take: 1,
                range: json!({"start": 3, "end": 5}),
            })
            .unwrap()
        };
        assert!(comp("sha256:none")
            .unwrap_err()
            .contains("Read this Live set before writing"));
        let read = pool(&path);
        assert_eq!(read["grooves"][0]["name"], "Swing 16ths 57");
        assert_eq!(read["grooves"][0]["base"], "1/16");
        let revision = read["revision"].as_str().unwrap().to_string();
        let comped = match comp(&revision) {
            Ok(KernelOpResult::LiveTakeCompReading { reading }) => reading,
            other => panic!("comp reading expected, got {other:?}"),
        };
        let main: Vec<_> = comped["clips"]
            .as_array()
            .unwrap()
            .iter()
            .map(|c| (c["start"].clone(), c["end"].clone(), c["takeId"].clone()))
            .collect();
        assert_eq!(
            main,
            vec![
                (json!(0.0), json!(3.0), json!(1.0)),
                (json!(3.0), json!(5.0), json!(2.0)),
                (json!(5.0), json!(8.0), json!(1.0)),
            ]
        );
        assert!(comp(&revision)
            .unwrap_err()
            .contains("changed since it was read"));
        let revision = comped["revision"].as_str().unwrap().to_string();
        let sent = match execute(&KernelOp::LiveTrackMixerWrite {
            path: path.clone(),
            expected_revision: revision,
            track: 0,
            control: "send".into(),
            value: json!(0.5),
            index: Some(0),
        }) {
            Some(Ok(KernelOpResult::LiveTrackMixerReading { reading })) => reading,
            other => panic!("mixer reading expected, got {other:?}"),
        };
        assert_eq!(sent["mixer"]["sends"][0]["name"], "A-Reverb");
        assert_eq!(sent["mixer"]["sends"][0]["value"].as_f64(), Some(0.5));
        let grooved = execute(&KernelOp::LiveGroovePoolWrite {
            path: path.clone(),
            expected_revision: sent["revision"].as_str().unwrap().into(),
            groove: None,
            field: "amount".into(),
            value: json!(80),
        });
        assert!(
            matches!(grooved, Some(Ok(KernelOpResult::LiveGroovePoolReading { ref reading })) if reading["amount"] == json!(80.0))
        );
        let _ = std::fs::remove_file(&path);
    }

    /// The kernel's own dispatch serves the comp and the Groove Pool (lib.rs `apply`), as the native host runs them.
    #[test]
    fn the_kernel_serves_the_comp_and_the_groove_pool() {
        let path = comp_fixture("apply");
        let mut kernel = crate::Kernel::new(crate::CentralClient::discover());
        let read = kernel
            .apply(KernelOp::LiveGroovePoolRead { path: path.clone() })
            .unwrap();
        let KernelOpResult::LiveGroovePoolReading { reading } = read.result else {
            panic!("groove pool reading expected");
        };
        assert!(
            read.receipts.is_empty(),
            "a Live op records nothing in the kernel"
        );
        let wrote = kernel
            .apply(KernelOp::LiveGroovePoolWrite {
                path: path.clone(),
                expected_revision: reading["revision"].as_str().unwrap().into(),
                groove: Some(0),
                field: "base".into(),
                value: json!("1/8"),
            })
            .unwrap();
        let KernelOpResult::LiveGroovePoolReading { reading } = wrote.result else {
            panic!("groove pool reading expected");
        };
        assert_eq!(reading["grooves"][0]["base"], "1/8");
        let comped = kernel.apply(KernelOp::LiveTakeComp {
            path: path.clone(),
            expected_revision: reading["revision"].as_str().unwrap().into(),
            track: 0,
            take: 0,
            range: json!({"start": 0, "end": 8}),
        });
        assert!(matches!(
            comped,
            Ok(crate::KernelOpOutcome {
                result: KernelOpResult::LiveTakeCompReading { .. },
                ..
            })
        ));
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn the_wire_names_of_the_comp_the_send_and_the_groove_pool() {
        let comp: KernelOp = serde_json::from_value(
            json!({"op": "live_take_comp", "path": "/a.als", "expected_revision": "sha256:x",
            "track": 0, "take": 1, "range": {"start": 2, "end": 4}}),
        )
        .unwrap();
        assert!(matches!(comp, KernelOp::LiveTakeComp { take: 1, .. }));
        let send: KernelOp = serde_json::from_value(json!({"op": "live_track_mixer_write", "path": "/a.als", "expected_revision": "sha256:x",
            "track": 0, "control": "send", "value": 0.5, "index": 1}))
        .unwrap();
        assert!(matches!(
            send,
            KernelOp::LiveTrackMixerWrite { index: Some(1), .. }
        ));
        let solo: KernelOp = serde_json::from_value(json!({"op": "live_track_mixer_write", "path": "/a.als", "expected_revision": "sha256:x",
            "track": 0, "control": "solo", "value": true}))
        .unwrap();
        assert!(
            matches!(solo, KernelOp::LiveTrackMixerWrite { index: None, .. }),
            "the existing controls' wire stands"
        );
        let global: KernelOp = serde_json::from_value(json!({"op": "live_groove_pool_write", "path": "/a.als", "expected_revision": "sha256:x",
            "field": "amount", "value": 90}))
        .unwrap();
        assert!(matches!(
            global,
            KernelOp::LiveGroovePoolWrite { groove: None, .. }
        ));
        let read: KernelOp =
            serde_json::from_value(json!({"op": "live_groove_pool_read", "path": "/a.als"}))
                .unwrap();
        assert!(matches!(read, KernelOp::LiveGroovePoolRead { .. }));
    }

    /// O-I #743: the acts on the set's objects come through one op typed by its act — only on a set this process has read, on its
    /// revision, through the kernel's own dispatch as the native host runs it — and answer what they did in words.
    #[test]
    fn the_kernel_serves_the_acts_on_the_sets_objects() {
        let dir = std::env::temp_dir().join(format!("live-set-owner-{}-acts", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let file = dir.join("acts.als");
        std::fs::write(
            &file,
            live_set::write_gz(&live_set::xml::parse(MAKE_FIXTURE).unwrap()).unwrap(),
        )
        .unwrap();
        let path = file.to_string_lossy().into_owned();
        let op: KernelOp = serde_json::from_value(json!({"op": "live_set_act", "path": path, "expected_revision": "sha256:none",
            "act": {"kind": "clip_paste", "from_track": 0, "from": {"slot": 0}, "track": 0, "scene": 1}}))
        .unwrap();
        assert!(matches!(
            &op,
            KernelOp::LiveSetAct {
                act: live_set::acts::SetAct::ClipPaste {
                    scene: 1,
                    cut: false,
                    ..
                },
                ..
            }
        ));
        let unread = match execute(&op) {
            Some(Err(error)) => error,
            other => panic!("refusal expected, got {other:?}"),
        };
        assert!(
            unread.contains("Read this Live set before writing"),
            "{unread}"
        );
        let mut kernel = crate::Kernel::new(crate::CentralClient::discover());
        let read = kernel
            .apply(KernelOp::LiveSetRead { path: path.clone() })
            .unwrap();
        let KernelOpResult::LiveSetReading { reading } = read.result else {
            panic!("set reading expected");
        };
        let mut request = serde_json::to_value(&op).unwrap();
        request["expected_revision"] = reading["revision"].clone();
        let pasted = kernel
            .apply(serde_json::from_value(request).unwrap())
            .unwrap();
        assert!(
            pasted.receipts.is_empty(),
            "a Live op records nothing in the kernel"
        );
        let KernelOpResult::LiveSetActed { reading } = pasted.result else {
            panic!("an act's answer expected");
        };
        assert_eq!(reading["act"], "clip_paste");
        assert_eq!(reading["done"], "Pasted Riff into row 2 of Keys.");
        assert_eq!(reading["at"], json!({"track": 0, "slot": 1}));
        let renamed = kernel.apply(KernelOp::LiveSetAct {
            path: path.clone(),
            expected_revision: reading["revision"].as_str().unwrap().into(),
            act: live_set::acts::SetAct::SceneRename {
                scene: 1,
                name: "Chorus".into(),
            },
        });
        assert!(matches!(
            renamed,
            Ok(crate::KernelOpOutcome { result: KernelOpResult::LiveSetActed { ref reading }, .. }) if reading["done"] == "Renamed row 2 to Chorus."
        ));
        let stale = kernel.apply(KernelOp::LiveSetAct {
            path: path.clone(),
            expected_revision: reading["revision"].as_str().unwrap().into(),
            act: live_set::acts::SetAct::SceneDelete { scene: 0 },
        });
        assert!(stale.unwrap_err().contains("changed since it was read"));
        let after = match execute(&KernelOp::LiveSetRead { path: path.clone() }) {
            Some(Ok(KernelOpResult::LiveSetReading { reading })) => reading,
            other => panic!("set reading expected, got {other:?}"),
        };
        assert_eq!(
            after["document"]["tracks"][0]["sessionSlots"],
            json!({"0": "Riff", "1": "Riff"})
        );
        assert_eq!(after["document"]["tracks"][0]["stoplessSlots"], json!([]));
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn other_ops_are_not_served_here() {
        assert!(execute(&KernelOp::ConfigDiff).is_none());
    }

    /// A home of the person's: sets in the Music folder (one in a project
    /// folder, with Live's Backup beside it), the User Library's template,
    /// a folder added to Live's Places outside the Music folder, and what
    /// is never a set of theirs (a hidden folder, Live's backups, the
    /// Factory Packs, a set inside an app bundle).
    fn home_of_sets(name: &str) -> std::path::PathBuf {
        let home = std::env::temp_dir().join(format!("live-sets-{}-{name}", std::process::id()));
        let _ = std::fs::remove_dir_all(&home);
        let put = |relative: &str| {
            let path = home.join(relative);
            std::fs::create_dir_all(path.parent().unwrap()).unwrap();
            std::fs::write(&path, b"set").unwrap();
        };
        put("Music/Song.als");
        put("Music/Album Project/Album.als");
        put("Music/Live 12.1 Sets/Dotted.als");
        put("Music/Album Project/Backup/Album [2026-10-01 120000].als");
        put("Music/Ableton/User Library/Templates/Start Here.als");
        put("Music/Ableton/Factory Packs/Demo/Demo.als");
        put("Music/.hidden/Secret.als");
        put("Music/Tool.app/Contents/Inside.als");
        put("Music/notes.txt");
        put("Elsewhere/Sets/Added.als");
        let cfg = home.join("Library/Preferences/Ableton/Live 12.1/Library.cfg");
        std::fs::create_dir_all(cfg.parent().unwrap()).unwrap();
        let music = home.join("Music/Ableton");
        let added = home.join("Elsewhere");
        std::fs::write(
            &cfg,
            format!(
                r#"<?xml version="1.0" encoding="UTF-8"?>
<Ableton><ContentLibrary><UserLibrary><LibraryProject Id="0"><ProjectLocation /><ProjectName Value="User Library" /><ProjectPath Value="{}" /></LibraryProject></UserLibrary>
<UserFolderInfoList><UserFolderInfo><Path Value="{}" /></UserFolderInfo></UserFolderInfoList></ContentLibrary></Ableton>"#,
                music.display(),
                added.display()
            ),
        )
        .unwrap();
        home
    }

    #[test]
    fn sets_list_finds_the_persons_own_sets_in_music_and_lives_places() {
        let home = home_of_sets("places");
        let reading = sets_reading(&home);
        assert_eq!(reading["schema"], "oi.live-sets/v1");
        let mut found: Vec<(String, String, bool)> = reading["sets"]
            .as_array()
            .unwrap()
            .iter()
            .map(|set| {
                (
                    set["name"].as_str().unwrap().to_owned(),
                    set["place"].as_str().unwrap().to_owned(),
                    set["template"].as_bool().unwrap(),
                )
            })
            .collect();
        found.sort();
        assert_eq!(
            found,
            vec![
                ("Added".into(), "Elsewhere".into(), false),
                ("Album".into(), "Music".into(), false),
                ("Dotted".into(), "Music".into(), false),
                ("Song".into(), "Music".into(), false),
                ("Start Here".into(), "User Library".into(), true),
            ],
            "the person's sets and template, never a backup, a pack, a hidden or bundled one"
        );
        for set in reading["sets"].as_array().unwrap() {
            let path = std::path::Path::new(set["path"].as_str().unwrap());
            assert!(path.is_absolute() && path.starts_with(&home), "{path:?}");
            assert!(set["modified_unix_ms"].as_u64().is_some());
        }
        let places: Vec<&str> = reading["places"]
            .as_array()
            .unwrap()
            .iter()
            .map(|place| place["label"].as_str().unwrap())
            .collect();
        assert_eq!(places, vec!["Music", "User Library", "Elsewhere"]);
        assert_eq!(reading["truncated"], false);
        let _ = std::fs::remove_dir_all(&home);
    }

    #[test]
    fn sets_list_without_lives_preferences_reads_the_music_folder_alone() {
        let home = home_of_sets("no-preferences");
        std::fs::remove_dir_all(home.join("Library")).unwrap();
        let reading = sets_reading(&home);
        let names: Vec<&str> = reading["sets"]
            .as_array()
            .unwrap()
            .iter()
            .map(|set| set["name"].as_str().unwrap())
            .collect();
        assert!(
            names.contains(&"Song") && names.contains(&"Start Here"),
            "{names:?}"
        );
        assert!(
            !names.contains(&"Added"),
            "a folder only Live's Places name"
        );
        let _ = std::fs::remove_dir_all(&home);
    }

    #[test]
    fn sets_list_is_served_as_an_op_and_parses_from_its_wire_name() {
        let op: KernelOp = serde_json::from_value(json!({"op": "live_sets_list"})).unwrap();
        assert!(matches!(op, KernelOp::LiveSetsList));
        assert!(matches!(
            execute(&op),
            Some(Ok(KernelOpResult::LiveSetsReading { .. })) | Some(Err(_))
        ));
    }
}
