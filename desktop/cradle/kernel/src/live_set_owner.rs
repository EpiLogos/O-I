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
//! track, insert a MIDI part (O-I #852: a kept sound dropped on the grid
//! plays on a new part), insert, rename, duplicate and delete a row) are one op typed by its
//! act (`live_set_act`, `live_set::acts`), admitted, gated and refused as
//! every other write.
//!
//! Export Audio (O-I #849, manual §21.1: "What Export Audio renders is what
//! you heard, sample for sample") is this owner's one write outside a set:
//! the engine's render, as a WAV, into the file the person chose in the
//! native host's own save dialog (`Kernel::live_audio_export`). It is no
//! `KernelOp`, so the renderer cannot name where a file goes; the host calls
//! it with the dialog's answer, and its receipt (`FileChanged`) is recorded.
//!
//! Reverse (`clip_reverse`, an act on the set) keeps a reversed sample beside
//! the set, as Consolidate and Crop keep theirs, and the kernel records that
//! file's receipt (`FileChanged`, [`kept_beside`]) once the act is done.

use crate::{KernelOp, KernelOpResult};
use std::collections::HashSet;
use std::path::PathBuf;
use std::sync::Mutex;

static WRITE_GATE: Mutex<()> = Mutex::new(());
static READ_SETS: Mutex<Option<HashSet<PathBuf>>> = Mutex::new(None);
/// The Music folder Samples last listed from Central's file map (canonical path), and the world it was listed in (the Central root
/// the kernel's client names): with the folders of the sets read, the places a sample is made into a clip from (DLW build ruling
/// 2026-11-09, 46c item 4). A complete Samples reading replaces it with what Central answered then, and a world other than the one it
/// was listed in clears it (47c item 5); a clip-make holds it to Central's file map as it stands then (0C item 12), so a folder is
/// admitted only while the world's Central keeps it. `withdrawn` is the root a clip-make found Central no longer keeps, and why.
/// `listed` counts the readings and world changes that replaced `roots`, so a hold withdraws only the root it asked about (0D item 8).
#[derive(Default)]
struct MusicScopes {
    world: Option<PathBuf>,
    roots: HashSet<PathBuf>,
    withdrawn: Option<(PathBuf, String)>,
    listed: u64,
}
#[cfg(not(test))]
static MUSIC_SCOPES: Mutex<Option<MusicScopes>> = Mutex::new(None);
// Each test runs on its own thread, and its world is its own: a test that lists another world's Music never clears this one's.
#[cfg(test)]
thread_local! {
    static MUSIC_SCOPES: std::cell::RefCell<Option<MusicScopes>> = const { std::cell::RefCell::new(None) };
}
fn music_scopes<R>(f: impl FnOnce(&mut MusicScopes) -> R) -> R {
    #[cfg(not(test))]
    {
        f(MUSIC_SCOPES
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .get_or_insert_with(MusicScopes::default))
    }
    #[cfg(test)]
    {
        MUSIC_SCOPES.with(|cell| f(cell.borrow_mut().get_or_insert_with(MusicScopes::default)))
    }
}

/// The world the kernel's Central client names (its Central root; none where the host names none): a world other than the one Music
/// was listed in clears what was admitted from it (47c item 5). Called before each Live op the kernel serves with its client.
pub(crate) fn bind_world(world: Option<&std::path::Path>) {
    music_scopes(|scopes| {
        if scopes.world.as_deref() != world {
            scopes.world = world.map(std::path::Path::to_path_buf);
            scopes.roots.clear();
            scopes.withdrawn = None;
            scopes.listed = scopes.listed.wrapping_add(1);
        }
    });
}

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

/// Whether this process has read the set at `path`, by its canonical path
/// (a set read once and gone since is not one).
fn read_before(path: &str) -> bool {
    canonical(path).is_some_and(|path| {
        READ_SETS
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .as_ref()
            .is_some_and(|sets| sets.contains(&path))
    })
}

/// The Music folder a complete Samples reading listed from Central's file map, by its canonical path, or none (Central said it does
/// not keep it): it replaces what an earlier reading listed (47c item 5). A reading Central did not finish replaces nothing, so what
/// was admitted stands while one is in flight (round 48's review, item 12; DLW build ruling 2026-11-09, 0C item 12).
fn listed_music_scope(root: Option<&std::path::Path>) {
    let root = root.and_then(|root| std::fs::canonicalize(root).ok());
    music_scopes(|scopes| {
        scopes.roots.clear();
        scopes.roots.extend(root);
        scopes.withdrawn = None;
        scopes.listed = scopes.listed.wrapping_add(1);
    });
}

/// Before a clip is made (0C item 12): what Music admitted stands only while Central's file map keeps the folder now. Where Central
/// says it no longer does, or cannot be read, the root is withdrawn with words that say why, and a sample in it is refused in them
/// until Samples lists Music again. Nothing is asked where nothing was admitted from Music. Central is asked outside the scopes' lock,
/// so what it answers withdraws the root only while that root is still the one asked about: a Samples reading or a world change in
/// the meantime stands (0D item 8).
pub(crate) fn hold_music_to_central(
    central: &dyn Fn(&str, serde_json::Value) -> Result<serde_json::Value, String>,
) {
    let Some((root, listed)) = music_scopes(|scopes| {
        scopes
            .roots
            .iter()
            .next()
            .cloned()
            .map(|root| (root, scopes.listed))
    }) else {
        return;
    };
    let why = match music_scope(central, &root) {
        Ok(Some(_)) => return,
        Ok(None) => "which Central's file map no longer keeps, so it is not read: Setup's Ground step keeps it on your acceptance".to_owned(),
        Err(why) => format!("and Central's file map could not be read just now ({why}), so it is not read: read Samples again once Central answers"),
    };
    music_scopes(|scopes| {
        if scopes.listed == listed && scopes.roots.contains(&root) {
            scopes.roots.clear();
            scopes.withdrawn = Some((root, why));
        }
    });
}

/// Whether Samples lists `path` from the place whose root is `root` (47c item 5: the one rule the set's folder walk, Music's listing
/// and a clip's admission apply): it stands inside the root no deeper than the walk goes (`SETS_DEPTH` folders), in no folder the
/// walk leaves (Live's backups and packs, a hidden folder, a package), and is no hidden file.
fn lists_sample(root: &std::path::Path, path: &std::path::Path) -> bool {
    path.strip_prefix(root).is_ok_and(|inside| {
        let parts: Vec<String> = inside
            .components()
            .map(|part| part.as_os_str().to_string_lossy().into_owned())
            .collect();
        parts.split_last().is_some_and(|(file, folders)| {
            folders.len() <= SETS_DEPTH
                && folders.iter().all(|folder| walks(folder))
                && !file.starts_with('.')
        })
    })
}

/// Whether a sample may be made into a clip of the set at `set` (DLW build ruling 2026-11-09, 46c item 4): its file, by its
/// canonical path, is one Samples lists — a file live-set makes a clip of ([`makes_clip_of`], round 48's review item 13; 0C item 13),
/// standing where Samples lists it from ([`lists_sample`]): the folder of that set (one this process has read), or the Music folder
/// Samples listed from Central's file map in this world while Central keeps it. Answers the file's canonical path, which the act then
/// uses (47c item 5); the refusal says only where a sample is made from, and nothing of the file.
///
/// Reverse (`clip_reverse`) is no clip-make and is not admitted here (DLW build ruling 2026-11-09, 48e item 4): it reads only the
/// file the clip already plays, by the set's own `SampleRef` (as the engine plays it and Crop cuts it), and adds no source to the
/// set; it writes only under the set's own `Samples/Processed/Reverse`, and what it writes is admitted for a clip-make only as any
/// file is, by this function.
pub(crate) fn admitted_sample(set: &str, file: &str) -> Result<PathBuf, String> {
    let refused = || {
        format!("{file} is not in this set's folder or in the world's Music scope, so it is not read: a clip is made of a sample Samples lists")
    };
    let real = canonical(file).ok_or_else(refused)?;
    let folder = canonical(set).and_then(|set| set.parent().map(std::path::Path::to_path_buf));
    let in_folder = read_before(set)
        && folder
            .as_deref()
            .is_some_and(|root| lists_sample(root, &real));
    let (in_music, withdrawn) = music_scopes(|scopes| {
        (
            scopes.roots.iter().any(|root| lists_sample(root, &real)),
            scopes
                .withdrawn
                .as_ref()
                .filter(|(root, _)| lists_sample(root, &real))
                .map(|(_, why)| why.clone()),
        )
    });
    if (in_folder || in_music) && makes_clip_of(&real) {
        return Ok(real);
    }
    match withdrawn {
        Some(why) if !in_folder && makes_clip_of(&real) => {
            Err(format!("{file} is in the world's Music folder, {why}"))
        }
        _ => Err(refused()),
    }
}

/// The receipt an act on the set records for the file it kept beside the set (DLW build ruling 2026-11-09, 48e item 12): Reverse's
/// reversed sample, by the path the act answers under the set's folder, as Consolidate and Crop record theirs
/// (`Kernel::live_audio_consolidate`, `Kernel::live_audio_crop`); `None` for every other op, and for an answer that names no sample.
pub(crate) fn kept_beside(
    op: &KernelOp,
    result: &KernelOpResult,
) -> Option<crate::events::KernelEvent> {
    let (
        KernelOp::LiveSetAct {
            path,
            act: live_set::acts::SetAct::ClipReverse { .. },
            ..
        },
        KernelOpResult::LiveSetActed { reading },
    ) = (op, result)
    else {
        return None;
    };
    let native = std::path::Path::new(path);
    let kept = native.parent()?.join(reading["sample"]["path"].as_str()?);
    let set_name = native.file_name()?.to_string_lossy().into_owned();
    Some(crate::events::KernelEvent::FileChanged {
        path: kept.to_string_lossy().into_owned(),
        summary: format!("Reverse kept a reversed sample of a clip of {set_name} beside it."),
    })
}

/// A write names a set this process has read, or it is refused.
fn admitted_for_write(path: &str) -> Result<(), String> {
    if read_before(path) {
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
            at,
        } => native_document(path).and_then(|()| {
            let reading = live_set::api::device_params_json(path, track, device, *at)?;
            remember_read(path);
            Ok(KernelOpResult::LiveDeviceParamsReading { reading })
        }),
        KernelOp::LiveDeviceParamWrite {
            path,
            track,
            device_name,
            at,
            param_id,
            value,
        } => native_document(path)
            .and_then(|()| admitted_for_write(path))
            .and_then(|()| {
                let _gate = WRITE_GATE
                    .lock()
                    .unwrap_or_else(|poisoned| poisoned.into_inner());
                live_set::api::device_param_set(path, track, device_name, *at, param_id, value)
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
                // A sample is read (its headers) only where Samples lists it from (46c item 4), and by the path admitted: its
                // canonical path, never the name as given (47c item 5).
                let admitted;
                let act = match act {
                    live_set::acts::SetAct::AudioClipMake {
                        track,
                        file,
                        scene,
                        start,
                    } => {
                        admitted = live_set::acts::SetAct::AudioClipMake {
                            track: *track,
                            file: admitted_sample(path, file)?
                                .to_string_lossy()
                                .into_owned(),
                            scene: *scene,
                            start: *start,
                        };
                        &admitted
                    }
                    other => other,
                };
                let _gate = WRITE_GATE
                    .lock()
                    .unwrap_or_else(|poisoned| poisoned.into_inner());
                live_set::acts::act(path, expected_revision, act)
                    .map(|reading| KernelOpResult::LiveSetActed { reading })
            }),
        KernelOp::LiveSetFromTemplate {
            template,
            project,
            name,
        } => std::env::var_os("HOME")
            .filter(|home| !home.is_empty())
            .ok_or_else(|| {
                "The person's home is not named (HOME), so Live's templates cannot be found"
                    .to_owned()
            })
            .and_then(|home| {
                let central = std::env::var_os("OI_CENTRAL_ROOT")
                    .filter(|root| !root.is_empty())
                    .ok_or_else(|| {
                        "The world's Central is not named (OI_CENTRAL_ROOT), so a new set has no project to be kept in"
                            .to_owned()
                    })?;
                let _gate = WRITE_GATE
                    .lock()
                    .unwrap_or_else(|poisoned| poisoned.into_inner());
                set_from_template(
                    std::path::Path::new(&home),
                    std::path::Path::new(&central),
                    template,
                    project,
                    name,
                )
            })
            .map(|reading| KernelOpResult::LiveSetStarted { reading }),
        KernelOp::LiveSetNew { name, place } => std::env::var_os("HOME")
            .filter(|home| !home.is_empty())
            .ok_or_else(|| {
                "The person's home is not named (HOME), so a new set has no Music folder to be kept in"
                    .to_owned()
            })
            .and_then(|home| {
                let _gate = WRITE_GATE
                    .lock()
                    .unwrap_or_else(|poisoned| poisoned.into_inner());
                set_new(std::path::Path::new(&home), name, place.as_deref())
            })
            .map(|reading| KernelOpResult::LiveSetStarted { reading }),
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

/// How many samples each place lists, and how many entries each place's walk looks at: a folder can hold many.
const SAMPLES_LISTED: usize = 2_000;
const SAMPLE_ENTRIES: usize = 50_000;

/// One place's budget: the entries its walk looks at, the samples it lists, and how many entries one page of Central's answer for
/// Music holds (`limit`).
#[derive(Clone, Copy)]
struct Budget {
    entries: usize,
    listed: usize,
    page: usize,
}
const PLACE_BUDGET: Budget = Budget {
    entries: SAMPLE_ENTRIES,
    listed: SAMPLES_LISTED,
    page: MUSIC_PAGE,
};

/// An audio file live-set makes a clip of (`SAMPLE_EXTENSIONS`, a WAV or an AIFF): its own rule of what it makes, not a guess at a kind.
fn makes_clip_of(path: &std::path::Path) -> bool {
    path.extension().and_then(|e| e.to_str()).is_some_and(|e| {
        live_set::acts::SAMPLE_EXTENSIONS.contains(&e.to_ascii_lowercase().as_str())
    })
}

/// One place's samples: `found` (path, bytes) in order; `more`, a sample stood past its budget; `unlooked`, entries stood past
/// the entries its walk looks at, so they were not looked at.
struct Listed {
    found: Vec<(std::path::PathBuf, u64)>,
    more: bool,
    unlooked: bool,
    /// Why the reading ended before Central said it was done, in words (47c item 6): Central's bound, or a page that could not be
    /// followed. Set only where more stands, so the place is `truncated`.
    stopped: Option<String>,
}

/// The samples of the set's own folder, walked breadth-first under its own budget, as Your sets is walked ([`sets_reading`]): never
/// Live's backups or packs, a hidden folder, a package or a symbolic link, to the same depth. `more` and `unlooked` only where a
/// sample, or an entry, stood past the budget.
fn set_folder_samples(root: &std::path::Path, budget: Budget) -> Listed {
    let mut found = Vec::new();
    let (mut looked, mut more, mut unlooked) = (0usize, false, false);
    let mut queue = std::collections::VecDeque::from([(root.to_path_buf(), 0usize)]);
    'walk: while let Some((dir, depth)) = queue.pop_front() {
        let Ok(rows) = std::fs::read_dir(&dir) else {
            continue;
        };
        let mut rows: Vec<_> = rows.flatten().collect();
        rows.sort_by_key(|row| row.file_name());
        for row in rows {
            if looked == budget.entries {
                unlooked = true;
                break 'walk;
            }
            looked += 1;
            let Ok(kind) = row.file_type() else { continue };
            let path = row.path();
            let name = row.file_name().to_string_lossy().into_owned();
            if kind.is_dir() {
                if depth < SETS_DEPTH && walks(&name) {
                    queue.push_back((path, depth + 1));
                }
                continue;
            }
            if !kind.is_file() || name.starts_with('.') || !makes_clip_of(&path) {
                continue;
            }
            if found.len() == budget.listed {
                more = true;
                break 'walk;
            }
            found.push((path, row.metadata().map_or(0, |meta| meta.len())));
        }
    }
    Listed {
        found,
        more,
        unlooked,
        stopped: None,
    }
}

/// Central's own words for why its file map gave no Music scope, or the scope (its world ref) whose root is `music`.
fn music_scope(
    central: &dyn Fn(&str, serde_json::Value) -> Result<serde_json::Value, String>,
    music: &std::path::Path,
) -> Result<Option<String>, String> {
    let inspected = central(
        "central.file-map.inspect",
        serde_json::json!({"project": null, "resources": false}),
    )?;
    crate::ground_music::scope_in(&inspected, music)
}

/// What Samples says where Central keeps folder scopes but not the world's Music folder.
const MUSIC_NOT_KEPT: &str = "The world's Music folder is not a scope of Central's file map, so its samples are not listed: Setup's Ground step keeps it on your acceptance.";

/// How many entries one page of Central's answer for Music holds (Central's own most is 5000).
const MUSIC_PAGE: usize = 1_000;

/// The Music scope's samples, as Central's file map gives its entries (the same a Files browser gets), page by page (`limit`,
/// `after`; DLW build ruling 2026-11-09, 46c item 2): each entry of kind `audio` that live-set makes a clip of, by its path and the
/// size Central read, never one under `skip` (the set's own folder, listed there) and never one in a folder Samples does not walk
/// (Live's backups and packs, a hidden folder, a package: Central's scope excludes them, and an entry under one is not listed
/// whatever the scope says; 46c item 3). `more` is Central's own answer: a page it said is not the last, or an entry past the
/// budget; `unlooked`, the budget's count of entries was looked at and Central said more stand. Each page asks for no more than the
/// budget has left; a page given without its `page` is an error, and a page that says more stands but cannot be followed (it holds
/// none of it, or says not where the next starts) ends the reading in words, `stopped` (47c item 6). Central reads the folder;
/// nothing here walks it.
fn music_samples(
    central: &dyn Fn(&str, serde_json::Value) -> Result<serde_json::Value, String>,
    scope: &str,
    music: &std::path::Path,
    skip: Option<&std::path::Path>,
    budget: Budget,
) -> Result<(Listed, usize), String> {
    let prefix = std::fs::canonicalize(music).unwrap_or_else(|_| music.to_path_buf());
    let mut found: Vec<(std::path::PathBuf, u64)> = Vec::new();
    let (mut other, mut looked, mut more, mut unlooked) = (0usize, 0usize, false, false);
    let mut stopped = None;
    let mut after: Option<String> = None;
    // Every page asked for, by where it starts: a next page that comes round again is never asked for twice (0C item 16).
    let mut asked: HashSet<Option<String>> = HashSet::new();
    'pages: loop {
        asked.insert(after.clone());
        // No more than the budget has left, so the budget and Central's answer end together.
        let limit = budget
            .page
            .min(budget.entries.saturating_sub(looked))
            .max(1);
        let inspected = central(
            "central.file-map.inspect",
            serde_json::json!({"project": scope, "resources": true, "path_prefixes": [prefix.to_string_lossy()],
                "limit": limit, "after": after}),
        )?;
        let answer = &inspected["result"];
        let entries = answer["resources"]
            .as_array()
            .ok_or("Central's file map answered without the scope's entries")?;
        let page = answer["page"].as_object().ok_or(
            "Central's file map answered Music without a page, so whether more of it stands is not known",
        )?;
        for entry in entries {
            looked += 1;
            if entry["kind"] != "audio" {
                continue;
            }
            let Some(path) = entry["path"].as_str().map(std::path::PathBuf::from) else {
                continue;
            };
            let canonical = std::fs::canonicalize(&path).unwrap_or_else(|_| path.clone());
            if !lists_sample(&prefix, &path)
                || skip.is_some_and(|folder| canonical.starts_with(folder))
            {
                continue;
            }
            if !makes_clip_of(&path) {
                other += 1;
                continue;
            }
            if found.len() == budget.listed {
                more = true;
                break 'pages;
            }
            found.push((path, entry["size"].as_u64().unwrap_or(0)));
        }
        if page.get("truncated") != Some(&serde_json::Value::Bool(true)) {
            break;
        }
        if found.len() == budget.listed {
            more = true;
            break;
        }
        if looked >= budget.entries {
            unlooked = true;
            break;
        }
        // More stands. A page that holds none of it, or says not where the next starts, is not followed, nor one that starts where a
        // page already asked for did (this one, or any before it: 0C item 16): the reading ends in words, and never asks for the same
        // page twice.
        let next = page.get("next").and_then(serde_json::Value::as_str);
        let again = next.is_some_and(|next| asked.contains(&Some(next.to_owned())));
        let bound = page.get("bound").and_then(serde_json::Value::as_str);
        stopped = Some(match (entries.is_empty(), next, bound) {
            (true, _, Some(bound)) => {
                format!("Central stopped reading Music before it listed more: {bound}.")
            }
            (true, _, None) => "Central said more of Music stands, and its page held none of it, so the rest of Music is not listed.".to_owned(),
            (false, None, _) => "Central said more of Music stands, and not where its next page starts, so the rest of Music is not listed.".to_owned(),
            (false, Some(_), _) if again => "Central said more of Music stands, and its next page is one it gave already, so the rest of Music is not listed.".to_owned(),
            (false, Some(next), _) => {
                after = Some(next.to_owned());
                continue;
            }
        });
        break;
    }
    Ok((
        Listed {
            found,
            more,
            unlooked,
            stopped,
        },
        other,
    ))
}

/// The browser's Samples (G14; DLW build ruling 2026-11-08, round 47 item 1 and item 0.4): the audio files live-set makes a clip of
/// (a WAV or an AIFF), from two places, each listed once under the label that fits it:
///
/// - **This set's folder**: the folder of the set at `set`, only when it is the kernel's admitted set (one this process has read; never
///   a path a caller only names), walked breadth-first under its own budget, as Your sets is walked ([`set_folder_samples`]).
/// - **Music**: the world's Music folder, read through Central's file map, never walked here. It is listed when Central keeps it as a
///   read-only scope (Setup's Ground step keeps it); otherwise Samples says so in words, and lists the set's folder only. A file of
///   the set's folder that stands in Music is listed once, under the set's folder, by its canonical path.
///
/// Each place says in words what it does not list: a set not read, no Music scope, a scope that holds no audio, audio live-set does
/// not make clips of, and samples past its budget (`truncated`, set only where more stood). Read only: what a sample is made into is
/// live-set's act (`audio_clip_make`).
pub fn samples_reading(
    central: &dyn Fn(&str, serde_json::Value) -> Result<serde_json::Value, String>,
    home: &std::path::Path,
    set: Option<&std::path::Path>,
) -> serde_json::Value {
    samples_reading_within(central, home, set, PLACE_BUDGET)
}

fn samples_reading_within(
    central: &dyn Fn(&str, serde_json::Value) -> Result<serde_json::Value, String>,
    home: &std::path::Path,
    set: Option<&std::path::Path>,
    budget: Budget,
) -> serde_json::Value {
    use serde_json::json;
    let mut places = Vec::new();
    let mut samples = Vec::new();
    let mut truncated = false;
    let push = |label: &str, listed: &Listed, samples: &mut Vec<serde_json::Value>| {
        for (path, bytes) in &listed.found {
            let name = path
                .file_name()
                .map(|n| n.to_string_lossy().into_owned())
                .unwrap_or_default();
            samples.push(json!({"path": path.to_string_lossy(), "name": name, "place": label, "bytes": bytes}));
        }
    };
    let past = |place: &str, count: usize| {
        format!(
            "Only the first {count} {} in {place} {} listed; more stand in it.",
            if count == 1 { "sample" } else { "samples" },
            if count == 1 { "is" } else { "are" }
        )
    };
    // The set's own folder: the folder of the set's canonical path (a set reached through a link, or by a path with `..` in it, is
    // listed where it stands; 46c item 4), only for the kernel's admitted set. A set that stands in Music itself is listed under
    // Music, once, and Music's other audio with it.
    let music = home.join("Music");
    let music_root = std::fs::canonicalize(&music).ok();
    let mut folder = None;
    if let Some(set) = set {
        let shown = set
            .parent()
            .map(std::path::Path::to_path_buf)
            .unwrap_or_default();
        let admitted = set.is_absolute() && set.to_str().is_some_and(read_before);
        let canonical = std::fs::canonicalize(set)
            .ok()
            .and_then(|real| real.parent().map(std::path::Path::to_path_buf))
            .filter(|_| admitted);
        match (admitted, canonical) {
            (true, Some(canonical)) if music_root.as_deref() == Some(canonical.as_path()) => {
                places.push(json!({"label": "This set's folder", "path": canonical.to_string_lossy(), "present": true, "read": true, "listed": 0, "truncated": false,
                    "words": "This set stands in Music itself, so its samples are listed under Music."}));
            }
            (true, Some(canonical)) => {
                let listed = set_folder_samples(&canonical, budget);
                push("This set's folder", &listed, &mut samples);
                let cut = listed.more || listed.unlooked;
                truncated |= cut;
                let mut place = json!({"label": "This set's folder", "path": canonical.to_string_lossy(), "present": true, "read": true, "listed": listed.found.len(), "truncated": cut});
                let words: Vec<String> = [
                    listed.more.then(|| past("this set's folder", listed.found.len())),
                    listed.unlooked.then(|| format!("This set's folder holds more than {} entries; only those were looked at.", budget.entries)),
                ]
                .into_iter()
                .flatten()
                .collect();
                if !words.is_empty() {
                    place["words"] = json!(words.join(" "));
                }
                places.push(place);
                folder = Some(canonical);
            }
            (true, None) => places.push(json!({"label": "This set's folder", "path": shown.to_string_lossy(), "present": false, "read": false, "listed": 0, "truncated": false,
                "words": "This set's folder is not there any more."})),
            // An unadmitted path is told only that: nothing of whether its folder stands (46c item 4).
            (false, _) => places.push(json!({"label": "This set's folder", "path": shown.to_string_lossy(), "present": false, "read": false, "listed": 0, "truncated": false,
                "words": "This set has not been read here, so its folder is not listed: open the set first."})),
        }
    }
    // The world's Music folder, through Central's file map.
    let mut place = json!({"label": "Music", "path": music.to_string_lossy(), "present": music.is_dir(), "read": false, "listed": 0, "truncated": false});
    // What a complete reading lists from Music replaces what an earlier one listed; one Central does not finish replaces nothing, so
    // what was admitted stands while this one is in flight (0C item 12). Where Central says it keeps no Music, nothing of it is admitted.
    let scope = music_scope(central, &music);
    if matches!(scope, Ok(None)) {
        listed_music_scope(None);
    }
    match scope {
        Err(why) => {
            place["words"] = json!(format!(
                "Central's file map could not be read, so Music is not listed: {why}"
            ))
        }
        // No Music scope: why, as Setup's Music row says it (DLW build ruling 2026-11-09): this Central keeps no folder scope, in its
        // own disclosure, or it does and Setup's Ground step keeps Music on the person's acceptance.
        Ok(None) => {
            place["words"] = json!(match crate::ground_music::keeps_folder_scopes(central) {
                Ok(false) => crate::ground_music::UNSUPPORTED.to_owned(),
                Ok(true) => MUSIC_NOT_KEPT.to_owned(),
                Err(why) => format!(
                    "{MUSIC_NOT_KEPT} Central did not say whether it keeps folder scopes: {why}"
                ),
            })
        }
        Ok(Some(scope)) => {
            match music_samples(central, &scope, &music, folder.as_deref(), budget) {
                Err(why) => {
                    place["words"] = json!(format!(
                        "Central's file map did not give Music's entries: {why}"
                    ))
                }
                Ok((listed, other)) => {
                    listed_music_scope(Some(&music));
                    push("Music", &listed, &mut samples);
                    let cut = listed.more || listed.unlooked || listed.stopped.is_some();
                    truncated |= cut;
                    place["scope"] = json!(scope);
                    place["read"] = json!(true);
                    place["listed"] = json!(listed.found.len());
                    place["truncated"] = json!(cut);
                    let mut words = Vec::new();
                    if listed.found.is_empty() && other == 0 && !cut {
                        words.push("Central's file map holds no audio in Music.".to_owned());
                    }
                    if other > 0 {
                        words.push(format!("{other} audio {} in Music {} not a WAV or an AIFF, which a clip here is made of.", if other == 1 { "file" } else { "files" }, if other == 1 { "is" } else { "are" }));
                    }
                    if listed.more {
                        words.push(past("Music", listed.found.len()));
                    }
                    if listed.unlooked {
                        words.push(format!(
                            "Music holds more than {} entries; only those were looked at.",
                            budget.entries
                        ));
                    }
                    words.extend(listed.stopped.clone());
                    if !words.is_empty() {
                        place["words"] = json!(words.join(" "));
                    }
                }
            }
        }
    }
    places.push(place);
    json!({"schema": "oi.live-samples/v1", "places": places, "samples": samples, "truncated": truncated})
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
    let library = templates_library(&places);
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
                let template = is_template(library.as_deref(), &path);
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

/// Live's User Library, where its Templates stand: the first of Live's own
/// places (after the Music folder) that holds a Templates folder.
fn templates_library(places: &[(String, std::path::PathBuf)]) -> Option<std::path::PathBuf> {
    places
        .iter()
        .skip(1)
        .find(|(_, path)| path.join("Templates").is_dir())
        .map(|(_, path)| path.clone())
}

/// Whether a set is one of Live's templates: it stands under a Templates
/// folder of the User Library.
fn is_template(library: Option<&std::path::Path>, path: &std::path::Path) -> bool {
    library.is_some_and(|library| {
        path.strip_prefix(library).is_ok_and(|rest| {
            rest.components()
                .any(|part| part.as_os_str() == "Templates")
        })
    })
}

/// A set's name, as the person gives it: one line of words that names a
/// file, with Live's `.als` added here (a name that already ends in `.als`
/// keeps one).
const SET_NAME_MAX_CHARS: usize = 120;
fn set_name(name: &str) -> Result<String, String> {
    let name = name.trim();
    let name = name.strip_suffix(".als").unwrap_or(name).trim_end();
    if name.is_empty()
        || name.chars().count() > SET_NAME_MAX_CHARS
        || name.starts_with('.')
        || name
            .chars()
            .any(|c| c.is_control() || matches!(c, '/' | '\\' | ':'))
    {
        return Err(format!(
            "A set's name is 1 to {SET_NAME_MAX_CHARS} characters of one line, without a slash or a colon, and not starting with a dot"
        ));
    }
    Ok(name.to_owned())
}

/// The place a new set is kept in when none is named: the Music folder, in its `Ableton` folder, where Live keeps a new project.
const NEW_SET_PLACE: &str = "Music";

/// Make a blank set (DLW build ruling 2026-11-08, LV01: "Setup's part is only where (the Music folder or Live's places). Bare offers
/// \"New set\" in words"): the set live-set's own act writes (`live_set::acts::new_set`: one MIDI part with its mixer and
/// recorder, the Main track and a return), named `name`, in a project folder of its own (`<name> Project`, as Live keeps a set).
/// `place` is where: the Music folder (the default; its `Ableton` folder, made where it is not), or one of Live's places read from
/// its Library.cfg, named by its label (the User Library's name, or a folder added to Live's Places), at its root. A set that stands
/// is never written over, a place that is not there is refused, and a project folder made here goes again with a set not made. The
/// set is remembered as read, so it can be worked on at once. Answers `{schema: oi.live-set-new/v1, path,
/// name, place, tracks}`.
pub fn set_new(
    home: &std::path::Path,
    name: &str,
    place: Option<&str>,
) -> Result<serde_json::Value, String> {
    let name = set_name(name)?;
    let label = place.unwrap_or(NEW_SET_PLACE);
    let root = if label == NEW_SET_PLACE {
        home.join("Music").join("Ableton")
    } else {
        let places = lives_places(home);
        let Some((_, root)) = places.iter().find(|(named, _)| named == label) else {
            return Err(format!(
                "{label} is no place of yours: a new set is kept in the Music folder or one of Live's places"
            ));
        };
        if !std::fs::symlink_metadata(root)
            .is_ok_and(|metadata| metadata.is_dir() && !metadata.file_type().is_symlink())
        {
            return Err(format!(
                "{label} ({}) is no place of yours that stands: a new set has nowhere to be kept",
                root.display()
            ));
        }
        root.clone()
    };
    let project = root.join(format!("{name} Project"));
    let target = project.join(format!("{name}.als"));
    if std::fs::symlink_metadata(&target).is_ok() {
        return Err(format!(
            "A set named {name} stands in {label} already: choose another name"
        ));
    }
    let made_folder = std::fs::symlink_metadata(&project).is_err();
    std::fs::create_dir_all(&project)
        .map_err(|error| format!("The new set's folder could not be made in {label}: {error}"))?;
    let path = target.to_string_lossy().into_owned();
    let made = live_set::acts::new_set(&path);
    if made.is_err() && made_folder {
        let _ = std::fs::remove_dir(&project);
    }
    let made = made?;
    remember_read(&path);
    Ok(
        serde_json::json!({"schema": "oi.live-set-new/v1", "path": path, "name": name, "place": label,
        "tracks": made["tracks"]}),
    )
}

/// The most a template is read: a Live set is a compressed document.
const TEMPLATE_MAX_BYTES: u64 = 256 * 1024 * 1024;

/// Start a new set from one of Live's templates (DLW §10.3, "A set you want
/// to start from again is a template … A new set started from it takes its
/// tracks and its layout"; §16.7, "Start from a template"): the template, a
/// set under the User Library's Templates as `sets_reading` marks it, is
/// copied whole into the project `project` of the world's Central `central`
/// (`Work/<project>`, a folder of the world: "The set is a file of the DLW's
/// own, kept in the project") as `<name>.als`. The template stays as it is.
/// The copy is made under a name of its own and linked into place, so a set
/// that stands there already is never overwritten and nothing half-made is
/// left; the copy is read back by the set's own reader before it is kept,
/// and it is remembered as read, so it can be worked on at once. Answers
/// `{schema: oi.live-set-from-template/v1, path, name, project, template,
/// tracks}`.
pub fn set_from_template(
    home: &std::path::Path,
    central: &std::path::Path,
    template: &str,
    project: &str,
    name: &str,
) -> Result<serde_json::Value, String> {
    native_document(template)
        .map_err(|_| "A template is named by its absolute path to a Live set (.als)".to_owned())?;
    let source = std::path::Path::new(template);
    let metadata = std::fs::symlink_metadata(source)
        .map_err(|error| format!("The template {template} cannot be read: {error}"))?;
    if !metadata.is_file() || metadata.len() > TEMPLATE_MAX_BYTES {
        return Err(format!("The template {template} is not a Live set file"));
    }
    let mut places: Vec<(String, std::path::PathBuf)> = vec![("Music".into(), home.join("Music"))];
    places.extend(lives_places(home));
    let library = templates_library(&places);
    let canonical = |path: &std::path::Path| std::fs::canonicalize(path).ok();
    let admitted = is_template(library.as_deref(), source)
        || library
            .as_deref()
            .and_then(canonical)
            .zip(canonical(source))
            .is_some_and(|(library, source)| is_template(Some(&library), &source));
    if !admitted {
        return Err(format!(
            "{template} is not one of Live's templates (a set under the User Library's Templates): only a template starts a new set"
        ));
    }
    let plain_project = !project.is_empty()
        && project != "."
        && project != ".."
        && !project.starts_with('.')
        && !project
            .chars()
            .any(|c| c.is_control() || matches!(c, '/' | '\\' | ':'));
    let folder = central.join("Work").join(project);
    let is_folder = plain_project
        && std::fs::symlink_metadata(&folder)
            .is_ok_and(|metadata| metadata.is_dir() && !metadata.file_type().is_symlink());
    if !is_folder {
        return Err(format!(
            "{project} is no project of your world (no folder Work/{project} in its Central): the new set has nowhere to be kept"
        ));
    }
    let name = set_name(name)?;
    let target = folder.join(format!("{name}.als"));
    if std::fs::symlink_metadata(&target).is_ok() {
        return Err(format!(
            "A set named {name} stands in {project} already: choose another name"
        ));
    }
    let bytes = std::fs::read(source)
        .map_err(|error| format!("The template {template} cannot be read: {error}"))?;
    let staged = folder.join(format!(".{name}.als.{}.partial", std::process::id()));
    let made = std::fs::write(&staged, &bytes)
        .map_err(|error| format!("The new set could not be written in {project}: {error}"))
        .and_then(|()| {
            live_set::api::set_json(&staged.to_string_lossy()).map_err(|error| {
                format!("The template {template} is not a Live set the DLW can read ({error}): no set was made")
            })
        })
        .and_then(|reading| {
            std::fs::hard_link(&staged, &target)
                .map(|()| reading)
                .map_err(|error| match error.kind() {
                    std::io::ErrorKind::AlreadyExists => format!(
                        "A set named {name} stands in {project} already: choose another name"
                    ),
                    _ => format!("The new set could not be kept in {project}: {error}"),
                })
        });
    let _ = std::fs::remove_file(&staged);
    let reading = made?;
    let path = target.to_string_lossy().into_owned();
    remember_read(&path);
    let tracks = reading["summary"]["tracks"].as_array().map_or(0, Vec::len);
    Ok(
        serde_json::json!({"schema": "oi.live-set-from-template/v1", "path": path, "name": name,
        "project": project, "template": template, "tracks": tracks}),
    )
}

/// The words a refused Export Audio says, before anything is written.
fn export_refused(why: &str) -> String {
    format!("Export Audio did not write: {why}")
}

impl crate::Kernel {
    /// Live's engine (the native host's `live_engine_open`) plays only a set
    /// this kernel can read and has read: an absolute native `.als` the shell
    /// read through `live_set_read`, by its canonical path. The renderer
    /// names the set; the kernel decides whether it is one.
    pub fn live_engine_admits(&self, set: &str) -> Result<(), String> {
        let refused = |why: &str| format!("The engine did not open the set: {why}");
        native_document(set).map_err(|e| refused(&e))?;
        if read_before(set) {
            Ok(())
        } else {
            Err(refused(&format!(
                "Live has not read {set} in this window, and the engine plays only a set Live has read"
            )))
        }
    }

    /// Export Audio: write `wav` — the engine's render of the set at `set`,
    /// a RIFF/WAVE file — into `chosen`, the file the person chose in the
    /// native host's save dialog, replacing it atomically (a sibling written
    /// whole, then renamed over it), and record its receipt. Only the native
    /// host calls this, with the dialog's answer: no op of the renderer's
    /// reaches it. Refused, it writes nothing and records nothing.
    pub fn live_audio_export(
        &mut self,
        set: &str,
        chosen: &std::path::Path,
        wav: &[u8],
    ) -> Result<(crate::events::KernelEventReceipt, serde_json::Value), String> {
        native_document(set).map_err(|e| export_refused(&e))?;
        let is_wav = chosen
            .extension()
            .and_then(|e| e.to_str())
            .is_some_and(|e| e.eq_ignore_ascii_case("wav"));
        if !chosen.is_absolute() || !is_wav {
            return Err(export_refused(
                "the file it writes is an absolute .wav path",
            ));
        }
        let (Some(folder), Some(name)) = (chosen.parent(), chosen.file_name()) else {
            return Err(export_refused("the chosen file names no folder"));
        };
        if !folder.is_dir() {
            return Err(export_refused(&format!(
                "{} is not a folder on this machine",
                folder.display()
            )));
        }
        if wav.len() < 44 || &wav[..4] != b"RIFF" || &wav[8..12] != b"WAVE" {
            return Err(export_refused("what the engine rendered is not a WAV file"));
        }
        let staged = folder.join(format!(
            ".{}.oi-export-{}",
            name.to_string_lossy(),
            std::process::id()
        ));
        {
            let _gate = WRITE_GATE
                .lock()
                .unwrap_or_else(|poisoned| poisoned.into_inner());
            std::fs::write(&staged, wav)
                .and_then(|()| std::fs::rename(&staged, chosen))
                .map_err(|e| {
                    let _ = std::fs::remove_file(&staged);
                    export_refused(&format!("{}: {e}", chosen.display()))
                })?;
        }
        let path = chosen.to_string_lossy().into_owned();
        let set_name = std::path::Path::new(set)
            .file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_default();
        let receipt = self.log.record(crate::events::KernelEvent::FileChanged {
            path: path.clone(),
            summary: format!("Export Audio wrote what {set_name} played."),
        });
        Ok((
            receipt,
            serde_json::json!({"schema": "oi.live-audio-export/v1", "path": path, "set": set, "bytes": wav.len()}),
        ))
    }

    /// Consolidate on an audio part (O-I #743; manual §10.9 "In Arrangement view, Split (⌘E), Consolidate (⌘J)"): the
    /// native host renders the part's clips alone across beats `from`–`to` (live-engine `render_clips_alone`) and hands
    /// this owner the WAV; the owner keeps it beside the set and lays the clip that plays it, against the set's revision
    /// and under the write gate, as it makes every act on the set (live-set `consolidate_audio`), and records the sample it
    /// kept. Only a set the shell has read is written; a refusal writes and records nothing.
    pub fn live_audio_consolidate(
        &mut self,
        set: &str,
        expected_revision: &str,
        track: usize,
        from: f64,
        to: f64,
        wav: &[u8],
    ) -> Result<(crate::events::KernelEventReceipt, serde_json::Value), String> {
        native_document(set)?;
        admitted_for_write(set)?;
        let reading = {
            let _gate = WRITE_GATE
                .lock()
                .unwrap_or_else(|poisoned| poisoned.into_inner());
            live_set::acts::consolidate_audio(set, expected_revision, track, from, to, wav)?
        };
        let native = std::path::Path::new(set);
        let kept = reading["sample"]["path"]
            .as_str()
            .and_then(|sample| native.parent().map(|folder| folder.join(sample)))
            .map_or_else(
                || set.to_owned(),
                |file| file.to_string_lossy().into_owned(),
            );
        let set_name = native
            .file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_default();
        let receipt = self.log.record(crate::events::KernelEvent::FileChanged {
            path: kept,
            summary: format!("Consolidate kept a sample of {set_name}'s clips beside it."),
        });
        Ok((receipt, reading))
    }

    /// Crop on an audio clip (DLW build ruling 2026-11-05: Live's Crop Clip, "an audio clip's sample is cut to a new file beside
    /// the set, the way Consolidate keeps one"): the native host cuts the stretch of the clip's sample it keeps (live-set
    /// `crop_source`) and hands this owner the WAV; the owner keeps it beside the set and crops the clip to play it, against the
    /// set's revision and under the write gate, as it makes every act on the set (live-set `crop_audio`), and records the sample
    /// it kept. Only a set the shell has read is written; a refusal writes and records nothing.
    pub fn live_audio_crop(
        &mut self,
        set: &str,
        expected_revision: &str,
        track: usize,
        clip: live_set::edit::ClipAt,
        span: Option<(f64, f64)>,
        wav: &[u8],
    ) -> Result<(crate::events::KernelEventReceipt, serde_json::Value), String> {
        native_document(set)?;
        admitted_for_write(set)?;
        let reading = {
            let _gate = WRITE_GATE
                .lock()
                .unwrap_or_else(|poisoned| poisoned.into_inner());
            live_set::acts::crop_audio(set, expected_revision, track, clip, span, wav)?
        };
        let native = std::path::Path::new(set);
        let kept = reading["sample"]["path"]
            .as_str()
            .and_then(|sample| native.parent().map(|folder| folder.join(sample)))
            .map_or_else(
                || set.to_owned(),
                |file| file.to_string_lossy().into_owned(),
            );
        let set_name = native
            .file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_default();
        let receipt = self.log.record(crate::events::KernelEvent::FileChanged {
            path: kept,
            summary: format!("Crop kept a cut of a clip's sample of {set_name} beside it."),
        });
        Ok((receipt, reading))
    }
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
            at: None,
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
            at: None,
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

    /// DLW build ruling 2026-11-05 (O-I #849): the second of two devices of one name is read and written at its own
    /// place on the chain; the first keeps what it stored.
    #[test]
    fn the_second_of_two_devices_of_one_name_is_read_and_written_at_its_place() {
        let path = std::env::temp_dir()
            .join(format!(
                "live-set-owner-{}-two-compressors.als",
                std::process::id()
            ))
            .to_string_lossy()
            .into_owned();
        let two = FIXTURE.replace(
            "</Compressor2></Devices>",
            r#"</Compressor2><Compressor2 Id="91"><Threshold><Manual Value="0.5" /><MidiControllerRange><Min Value="0" /><Max Value="2" /></MidiControllerRange></Threshold></Compressor2></Devices>"#,
        );
        std::fs::write(
            &path,
            live_set::write_gz(&live_set::xml::parse(&two).unwrap()).unwrap(),
        )
        .unwrap();
        let threshold = |at: usize| {
            let op = KernelOp::LiveDeviceParamsRead {
                path: path.clone(),
                track: "Master".into(),
                device: "Compressor2".into(),
                at: Some(at),
            };
            let Some(Ok(KernelOpResult::LiveDeviceParamsReading { reading })) = execute(&op) else {
                panic!("params reading expected");
            };
            reading["params"]
                .as_array()
                .unwrap()
                .iter()
                .find(|row| row["id"] == "Threshold")
                .unwrap()["value"]
                .clone()
        };
        assert_eq!(threshold(1), "0.5");
        let op = KernelOp::LiveDeviceParamWrite {
            path: path.clone(),
            track: "Master".into(),
            device_name: "Compressor2".into(),
            at: Some(1),
            param_id: "Threshold".into(),
            value: json!(0.25),
        };
        assert!(matches!(
            execute(&op),
            Some(Ok(KernelOpResult::LiveDeviceParamWritten { .. }))
        ));
        assert_eq!((threshold(0), threshold(1)), (json!("0.5"), json!("0.25")));
        std::fs::remove_file(path).unwrap();
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
        // a device's place on its chain (DLW build ruling 2026-11-05)
        let placed: KernelOp = serde_json::from_value(json!({
            "op": "live_device_param_write", "path": "/a.als", "track": "Master",
            "device_name": "Compressor2", "at": 1, "param_id": "Threshold", "value": 0.5
        }))
        .unwrap();
        assert!(matches!(
            placed,
            KernelOp::LiveDeviceParamWrite { at: Some(1), .. }
        ));
        let placed: KernelOp = serde_json::from_value(json!({
            "op": "live_device_params_read", "path": "/a.als", "track": "Master", "device": "Compressor2", "at": 1
        }))
        .unwrap();
        assert!(matches!(
            placed,
            KernelOp::LiveDeviceParamsRead { at: Some(1), .. }
        ));
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
            at: None,
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

    /// O-I #849: a part's Volume (linear gain) and Pan (−1…1) are written through the kernel against the set's revision and stand
    /// in the file: the set read again — as Play bridges it into the engine — holds both; a move out of Live's range is refused.
    #[test]
    fn a_parts_volume_and_pan_are_written_against_the_revision_and_read_back_from_the_file() {
        let xml = COMP_FIXTURE.replacen(
            r#"<Speaker><Manual Value="true" /></Speaker></Mixer><MainSequencer>"#,
            r#"<Speaker><Manual Value="true" /></Speaker><Volume><Manual Value="1" /><MidiControllerRange><Min Value="0.0003162277571" /><Max Value="1.99526238" /></MidiControllerRange></Volume><Pan><Manual Value="0" /><MidiControllerRange><Min Value="-1" /><Max Value="1" /></MidiControllerRange></Pan></Mixer><MainSequencer>"#,
            1,
        );
        assert_ne!(
            xml, COMP_FIXTURE,
            "the fixture's part carries a Volume and a Pan"
        );
        let file =
            std::env::temp_dir().join(format!("live-set-owner-{}-levels.als", std::process::id()));
        std::fs::write(
            &file,
            live_set::write_gz(&live_set::xml::parse(&xml).unwrap()).unwrap(),
        )
        .unwrap();
        let path = file.to_string_lossy().into_owned();
        let read = || match execute(&KernelOp::LiveSetRead { path: path.clone() }) {
            Some(Ok(KernelOpResult::LiveSetReading { reading })) => reading,
            other => panic!("set reading expected, got {other:?}"),
        };
        let write = |revision: &str, control: &str, value: serde_json::Value| {
            execute(&KernelOp::LiveTrackMixerWrite {
                path: path.clone(),
                expected_revision: revision.into(),
                track: 0,
                control: control.into(),
                value,
                index: None,
            })
            .expect("the mixer write is served here")
        };
        let before = read();
        let mixer = &before["document"]["tracks"][0]["mixer"];
        assert_eq!(
            (mixer["volume"].as_f64(), mixer["pan"].as_f64()),
            (Some(1.0), Some(0.0))
        );
        let revision = before["revision"].as_str().unwrap().to_string();
        let volume = match write(&revision, "volume", json!(0.5)) {
            Ok(KernelOpResult::LiveTrackMixerReading { reading }) => reading,
            other => panic!("mixer reading expected, got {other:?}"),
        };
        assert_eq!(volume["mixer"]["volume"].as_f64(), Some(0.5));
        assert!(write(&revision, "pan", json!(0.3))
            .unwrap_err()
            .contains("changed since it was read"));
        let pan = match write(volume["revision"].as_str().unwrap(), "pan", json!(-0.25)) {
            Ok(KernelOpResult::LiveTrackMixerReading { reading }) => reading,
            other => panic!("mixer reading expected, got {other:?}"),
        };
        assert_eq!(
            (
                pan["mixer"]["volume"].as_f64(),
                pan["mixer"]["pan"].as_f64()
            ),
            (Some(0.5), Some(-0.25))
        );
        let refused = write(pan["revision"].as_str().unwrap(), "volume", json!(4.0)).unwrap_err();
        assert!(
            refused.contains("The volume is a gain from 0.0003162277571 to 1.99526238"),
            "{refused}"
        );
        let after = read();
        let mixer = &after["document"]["tracks"][0]["mixer"];
        assert_eq!(
            (mixer["volume"].as_f64(), mixer["pan"].as_f64()),
            (Some(0.5), Some(-0.25)),
            "the file holds both"
        );
        let _ = std::fs::remove_file(&file);
    }

    /// Export Audio (O-I #849): the kernel's Live owner writes the engine's render into the file the person chose, whole, and
    /// records its receipt; refused — a path that is not an absolute .wav, a folder that is not there, bytes that are not a WAV, a
    /// set that is not a native document — it writes nothing and records nothing.
    #[test]
    fn export_audio_writes_the_chosen_file_whole_and_records_its_receipt() {
        let dir =
            std::env::temp_dir().join(format!("live-set-owner-{}-export", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let mut wav = b"RIFF\x24\0\0\0WAVEfmt ".to_vec();
        wav.resize(48, 0);
        let mut kernel = crate::Kernel::new(crate::CentralClient::discover());
        let set = "/sets/Song.als";
        let chosen = dir.join("Song.wav");
        std::fs::write(&chosen, b"an older export").unwrap();
        let (receipt, reading) = kernel.live_audio_export(set, &chosen, &wav).unwrap();
        assert_eq!(
            std::fs::read(&chosen).unwrap(),
            wav,
            "the chosen file holds the render, whole"
        );
        assert_eq!(reading["bytes"], 48);
        assert_eq!(reading["path"], chosen.to_string_lossy().as_ref());
        assert!(
            matches!(&receipt.envelope.event, crate::events::KernelEvent::FileChanged { path, summary }
            if *path == chosen.to_string_lossy() && summary == "Export Audio wrote what Song.als played.")
        );
        let left: Vec<_> = std::fs::read_dir(&dir)
            .unwrap()
            .map(|e| e.unwrap().file_name())
            .collect();
        assert_eq!(
            left,
            vec![std::ffi::OsString::from("Song.wav")],
            "no staged file is left beside it"
        );
        for (set, chosen, bytes, said) in [
            (
                set,
                std::path::PathBuf::from("Song.wav"),
                &wav[..],
                "an absolute .wav path",
            ),
            (set, dir.join("Song.mp3"), &wav[..], "an absolute .wav path"),
            (
                set,
                dir.join("gone").join("Song.wav"),
                &wav[..],
                "is not a folder on this machine",
            ),
            (
                set,
                dir.join("Other.wav"),
                &b"not a wave file at all, though long enough to be one"[..],
                "is not a WAV file",
            ),
            (
                "Song.als",
                dir.join("Other.wav"),
                &wav[..],
                "absolute native .als",
            ),
        ] {
            let refused = kernel.live_audio_export(set, &chosen, bytes).unwrap_err();
            assert!(
                refused.starts_with("Export Audio did not write: ") && refused.contains(said),
                "{refused}"
            );
        }
        assert!(!dir.join("Other.wav").exists(), "a refusal writes nothing");
        assert_eq!(
            kernel.event_log().since(receipt.seq + 1).len(),
            0,
            "and records nothing"
        );
        let _ = std::fs::remove_dir_all(&dir);
    }

    /// Consolidate on an audio part (O-I #743): the host's render of the clips alone is kept beside a set the shell has read,
    /// the clip that plays it laid against the set's revision, and the sample's writing recorded; a set not read, or one that
    /// changed since, is refused with nothing written or recorded.
    #[test]
    fn consolidate_keeps_the_engines_render_beside_a_read_set_and_records_it() {
        let dir =
            std::env::temp_dir().join(format!("live-set-owner-{}-consolidate", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        let set = dir.join("Song.als");
        let xml = r#"<Ableton MajorVersion="5" MinorVersion="12.0_12049"><LiveSet><Tracks>
<AudioTrack Id="8"><Name><EffectiveName Value="Vox"/><UserName Value=""/></Name><DeviceChain><MainSequencer><ClipSlotList/><Sample><ArrangerAutomation><Events>
<AudioClip Id="0" Time="0"><CurrentStart Value="0"/><CurrentEnd Value="2"/><Loop><LoopStart Value="0"/><LoopEnd Value="1"/><StartRelative Value="0"/><LoopOn Value="false"/></Loop><Name Value="Room"/><IsWarped Value="false"/><SampleVolume Value="1"/><SampleRef><FileRef><RelativePath Value="room.wav"/></FileRef></SampleRef></AudioClip>
</Events></ArrangerAutomation></Sample></MainSequencer><DeviceChain><Devices/></DeviceChain></DeviceChain></AudioTrack>
</Tracks><MainTrack><DeviceChain><Mixer><Tempo><Manual Value="120"/></Tempo></Mixer></DeviceChain></MainTrack><Scenes><Scene Id="0"><Name Value=""/></Scene></Scenes></LiveSet></Ableton>"#;
        std::fs::write(
            &set,
            live_set::write_gz(&live_set::xml::parse(xml).unwrap()).unwrap(),
        )
        .unwrap();
        let path = set.to_str().unwrap();
        // one second of stereo 32-bit float at 8 kHz: beats 0 to 2 at 120 BPM
        let frames = 8_000usize;
        let mut wav = b"RIFF".to_vec();
        wav.extend_from_slice(&(36 + frames as u32 * 8).to_le_bytes());
        wav.extend_from_slice(b"WAVEfmt ");
        for word in [
            16u32.to_le_bytes().as_slice(),
            &3u16.to_le_bytes(),
            &2u16.to_le_bytes(),
            &8_000u32.to_le_bytes(),
            &64_000u32.to_le_bytes(),
            &8u16.to_le_bytes(),
            &32u16.to_le_bytes(),
            b"data",
            &(frames as u32 * 8).to_le_bytes(),
        ] {
            wav.extend_from_slice(word);
        }
        wav.resize(wav.len() + frames * 8, 0);
        let revision = || {
            live_set::edit::clip_json(path, 0, live_set::edit::ClipAt::Arrangement(0)).unwrap()
                ["revision"]
                .as_str()
                .unwrap()
                .to_string()
        };
        let mut kernel = crate::Kernel::new(crate::CentralClient::discover());
        let unread = kernel
            .live_audio_consolidate(path, &revision(), 0, 0.0, 2.0, &wav)
            .unwrap_err();
        assert!(
            unread.contains("Read this Live set before writing to it"),
            "{unread}"
        );
        execute(&KernelOp::LiveSetRead {
            path: path.to_owned(),
        })
        .unwrap()
        .unwrap();
        let stale = kernel
            .live_audio_consolidate(path, "sha256:older", 0, 0.0, 2.0, &wav)
            .unwrap_err();
        assert!(stale.contains("changed since it was read"), "{stale}");
        assert!(!dir.join("Samples").exists(), "a refusal writes nothing");
        let (receipt, reading) = kernel
            .live_audio_consolidate(path, &revision(), 0, 0.0, 2.0, &wav)
            .unwrap();
        let kept = dir.join(reading["sample"]["path"].as_str().unwrap());
        assert_eq!(
            std::fs::read(&kept).unwrap(),
            wav,
            "the render is kept beside the set, whole"
        );
        assert!(
            reading["done"].as_str().unwrap().starts_with(
                "Consolidated 1 audio clip between beat 0 and beat 2 into one, 1 second of sound"
            ),
            "{reading}"
        );
        assert!(
            matches!(&receipt.envelope.event, crate::events::KernelEvent::FileChanged { path, summary }
            if *path == kept.to_string_lossy() && summary == "Consolidate kept a sample of Song.als's clips beside it.")
        );
        assert_eq!(kernel.event_log().since(receipt.seq + 1).len(), 0);
        let _ = std::fs::remove_dir_all(&dir);
    }

    /// Crop on an audio clip (DLW build ruling 2026-11-05): the host's cut of the clip's sample is kept beside a set the shell has
    /// read and the clip cropped to play it, against the set's revision, and the sample's writing recorded; a set not read, or one
    /// that changed since, is refused with nothing written or recorded.
    #[test]
    fn crop_keeps_the_hosts_cut_beside_a_read_set_and_records_it() {
        let dir = std::env::temp_dir().join(format!("live-set-owner-{}-crop", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        let set = dir.join("Song.als");
        let xml = r#"<Ableton MajorVersion="5" MinorVersion="12.0_12049"><LiveSet><Tracks>
<AudioTrack Id="8"><Name><EffectiveName Value="Vox"/><UserName Value=""/></Name><DeviceChain><MainSequencer><ClipSlotList/><Sample><ArrangerAutomation><Events>
<AudioClip Id="0" Time="0"><CurrentStart Value="0"/><CurrentEnd Value="2"/><Loop><LoopStart Value="0.5"/><LoopEnd Value="1.5"/><StartRelative Value="0"/><LoopOn Value="false"/></Loop><Name Value="Room"/><IsWarped Value="false"/><SampleVolume Value="1"/><SampleRef><FileRef><RelativePath Value="room.wav"/></FileRef></SampleRef></AudioClip>
</Events></ArrangerAutomation></Sample></MainSequencer><DeviceChain><Devices/></DeviceChain></DeviceChain></AudioTrack>
</Tracks><MainTrack><DeviceChain><Mixer><Tempo><Manual Value="120"/></Tempo></Mixer></DeviceChain></MainTrack><Scenes><Scene Id="0"><Name Value=""/></Scene></Scenes></LiveSet></Ableton>"#;
        std::fs::write(
            &set,
            live_set::write_gz(&live_set::xml::parse(xml).unwrap()).unwrap(),
        )
        .unwrap();
        let path = set.to_str().unwrap();
        // one second of mono 32-bit float at 8 kHz: the clip's 0.5–1.5 seconds
        let frames = 8_000usize;
        let mut wav = b"RIFF".to_vec();
        wav.extend_from_slice(&(36 + frames as u32 * 4).to_le_bytes());
        wav.extend_from_slice(b"WAVEfmt ");
        for word in [
            16u32.to_le_bytes().as_slice(),
            &3u16.to_le_bytes(),
            &1u16.to_le_bytes(),
            &8_000u32.to_le_bytes(),
            &32_000u32.to_le_bytes(),
            &4u16.to_le_bytes(),
            &32u16.to_le_bytes(),
            b"data",
            &(frames as u32 * 4).to_le_bytes(),
        ] {
            wav.extend_from_slice(word);
        }
        wav.resize(wav.len() + frames * 4, 0);
        let at = live_set::edit::ClipAt::Arrangement(0);
        let revision = || {
            live_set::edit::clip_json(path, 0, at).unwrap()["revision"]
                .as_str()
                .unwrap()
                .to_string()
        };
        let mut kernel = crate::Kernel::new(crate::CentralClient::discover());
        let unread = kernel
            .live_audio_crop(path, &revision(), 0, at, None, &wav)
            .unwrap_err();
        assert!(
            unread.contains("Read this Live set before writing to it"),
            "{unread}"
        );
        execute(&KernelOp::LiveSetRead {
            path: path.to_owned(),
        })
        .unwrap()
        .unwrap();
        let stale = kernel
            .live_audio_crop(path, "sha256:older", 0, at, None, &wav)
            .unwrap_err();
        assert!(stale.contains("changed since it was read"), "{stale}");
        assert!(!dir.join("Samples").exists(), "a refusal writes nothing");
        let (receipt, reading) = kernel
            .live_audio_crop(path, &revision(), 0, at, None, &wav)
            .unwrap();
        let kept = dir.join(reading["sample"]["path"].as_str().unwrap());
        assert!(
            kept.starts_with(dir.join("Samples/Processed/Crop")),
            "{}",
            kept.display()
        );
        assert_eq!(
            std::fs::read(&kept).unwrap(),
            wav,
            "the cut is kept beside the set, whole"
        );
        assert!(
            reading["done"]
                .as_str()
                .unwrap()
                .starts_with("Cropped Room to its start and end: 2 beats, 1 second of sound"),
            "{reading}"
        );
        assert!(
            matches!(&receipt.envelope.event, crate::events::KernelEvent::FileChanged { path, summary }
            if *path == kept.to_string_lossy() && summary == "Crop kept a cut of a clip's sample of Song.als beside it.")
        );
        assert_eq!(kernel.event_log().since(receipt.seq + 1).len(), 0);
        let _ = std::fs::remove_dir_all(&dir);
    }

    /// The engine plays only a set the kernel can read and has read (O-I #849): the native host asks before it bridges one, and a set
    /// named by the page alone — never read, not a native document, or gone — is refused in words.
    #[test]
    fn the_engine_admits_only_a_set_the_kernel_has_read() {
        let kernel = crate::Kernel::new(crate::CentralClient::discover());
        let path = fixture("engine-admits");
        let unread = kernel.live_engine_admits(&path).unwrap_err();
        assert!(
            unread.starts_with("The engine did not open the set: ")
                && unread.contains("has not read"),
            "{unread}"
        );
        let Some(Ok(_)) = execute(&KernelOp::LiveSetRead { path: path.clone() }) else {
            panic!("the set reads");
        };
        kernel.live_engine_admits(&path).unwrap();
        for (set, said) in [
            ("Song.als", "absolute native .als"),
            ("/sets/Song.txt", "absolute native .als"),
            ("/sets/never-there.als", "has not read"),
        ] {
            let refused = kernel.live_engine_admits(set).unwrap_err();
            assert!(refused.contains(said), "{set}: {refused}");
        }
        std::fs::remove_file(&path).unwrap();
        assert!(
            kernel.live_engine_admits(&path).is_err(),
            "a set read once and gone since is not admitted"
        );
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

    /// A home of sets with a world's Central beside it: the User Library's
    /// template is a real Live set, and the world keeps one project, Album.
    fn home_and_world(name: &str) -> (std::path::PathBuf, std::path::PathBuf, std::path::PathBuf) {
        let home = home_of_sets(name);
        let template = home.join("Music/Ableton/User Library/Templates/Start Here.als");
        let set = fixture(&format!("template-{name}"));
        std::fs::copy(&set, &template).unwrap();
        std::fs::remove_file(set).unwrap();
        let central = home.join("Central");
        std::fs::create_dir_all(central.join("Work/Album")).unwrap();
        (home, central, template)
    }

    #[test]
    fn a_new_set_starts_from_a_template_in_a_project_of_the_world() {
        let (home, central, template) = home_and_world("from-template");
        let started = set_from_template(
            &home,
            &central,
            template.to_str().unwrap(),
            "Album",
            "First Take",
        )
        .unwrap();
        let made = central.join("Work/Album/First Take.als");
        assert_eq!(started["schema"], "oi.live-set-from-template/v1");
        assert_eq!(started["path"], made.to_string_lossy().as_ref());
        assert_eq!(started["name"], "First Take");
        assert_eq!(started["project"], "Album");
        assert_eq!(started["template"], template.to_string_lossy().as_ref());
        let template_reading = live_set::api::set_json(template.to_str().unwrap()).unwrap();
        assert_eq!(
            started["tracks"],
            template_reading["summary"]["tracks"]
                .as_array()
                .unwrap()
                .len(),
            "the template's tracks, as the set's reader reads them"
        );
        assert_eq!(
            std::fs::read(&made).unwrap(),
            std::fs::read(&template).unwrap(),
            "the new set is the template's tracks and layout, byte for byte"
        );
        // The new set is one this kernel has read: it can be written straight away.
        assert!(admitted_for_write(made.to_str().unwrap()).is_ok());
        // A set of that name stands there now: refused, and nothing is overwritten.
        let before = std::fs::read(&made).unwrap();
        let again = set_from_template(
            &home,
            &central,
            template.to_str().unwrap(),
            "Album",
            "First Take.als",
        );
        assert!(
            again.unwrap_err().contains("already"),
            "a second set of the same name"
        );
        assert_eq!(std::fs::read(&made).unwrap(), before);
        // What is not a template, not a project of the world, or not a name is refused, and nothing is made.
        let song = home.join("Music/Song.als");
        for (template, project, name, says) in [
            (
                song.to_str().unwrap(),
                "Album",
                "Copy",
                "not one of Live's templates",
            ),
            (template.to_str().unwrap(), "Absent", "Copy", "no project"),
            (template.to_str().unwrap(), "../Album", "Copy", "no project"),
            (template.to_str().unwrap(), "Album", "a/b", "name"),
            (template.to_str().unwrap(), "Album", " ", "name"),
            (template.to_str().unwrap(), "Album", ".hidden", "name"),
            ("Templates/Start Here.als", "Album", "Copy", "absolute"),
        ] {
            let refused = set_from_template(&home, &central, template, project, name).unwrap_err();
            assert!(
                refused.contains(says),
                "{template} {project} {name}: {refused}"
            );
        }
        let made: Vec<_> = std::fs::read_dir(central.join("Work/Album"))
            .unwrap()
            .flatten()
            .map(|row| row.file_name())
            .collect();
        assert_eq!(made, vec![std::ffi::OsString::from("First Take.als")]);
        let _ = std::fs::remove_dir_all(&home);
    }

    #[test]
    fn a_template_that_is_not_a_live_set_makes_no_set() {
        let (home, central, template) = home_and_world("not-a-set");
        std::fs::write(&template, b"not a set").unwrap();
        let refused = set_from_template(
            &home,
            &central,
            template.to_str().unwrap(),
            "Album",
            "Broken",
        )
        .unwrap_err();
        assert!(refused.contains("not a Live set"), "{refused}");
        assert!(!central.join("Work/Album/Broken.als").exists());
        assert_eq!(
            std::fs::read_dir(central.join("Work/Album"))
                .unwrap()
                .count(),
            0,
            "no partial copy left behind"
        );
        let _ = std::fs::remove_dir_all(&home);
    }

    /// The blank set (DLW build ruling 2026-11-08, LV01): in a world with no set and no template (Bare), New set makes one in the
    /// Music folder, as Live keeps a project (`Music/Ableton/<name> Project/<name>.als`), through live-set's own new-set act; it is
    /// read and remembered, so it can be written at once. One of Live's places can be named instead; a place that is neither, a name
    /// that is no file name and a set that stands are refused, and nothing half-made is left.
    #[test]
    fn a_new_set_is_made_in_the_music_folder_of_a_world_with_none() {
        let home = std::env::temp_dir().join(format!("live-sets-{}-blank", std::process::id()));
        let _ = std::fs::remove_dir_all(&home);
        std::fs::create_dir_all(&home).unwrap();
        let made = set_new(&home, "Sketch", None).unwrap();
        let path = home.join("Music/Ableton/Sketch Project/Sketch.als");
        assert_eq!(made["schema"], "oi.live-set-new/v1");
        assert_eq!(made["path"], path.to_string_lossy().as_ref());
        assert_eq!(made["name"], "Sketch");
        assert_eq!(made["place"], "Music");
        assert_eq!(
            made["tracks"], 2,
            "one MIDI part and a return; the Main track besides"
        );
        assert!(
            admitted_for_write(path.to_str().unwrap()).is_ok(),
            "read and remembered: written at once"
        );
        let listed = sets_reading(&home);
        assert_eq!(
            listed["sets"][0]["name"], "Sketch",
            "it stands in Live sets now"
        );
        let again = set_new(&home, "Sketch", None).unwrap_err();
        assert!(again.contains("already"), "{again}");
        for (name, place, says) in [
            ("a/b", None, "name"),
            (".hidden", None, "name"),
            ("Other", Some("Nowhere"), "no place"),
        ] {
            let refused = set_new(&home, name, place).unwrap_err();
            assert!(refused.contains(says), "{name} {place:?}: {refused}");
        }
        let projects: Vec<_> = std::fs::read_dir(home.join("Music/Ableton"))
            .unwrap()
            .flatten()
            .map(|row| row.file_name())
            .collect();
        assert_eq!(
            projects,
            vec![std::ffi::OsString::from("Sketch Project")],
            "nothing half-made"
        );
        // One of Live's places, named by its label, keeps it there.
        let places = home_of_sets("blank-places");
        let added = set_new(&places, "Elsewhere Take", Some("Elsewhere")).unwrap();
        assert_eq!(
            added["path"],
            places
                .join("Elsewhere/Elsewhere Take Project/Elsewhere Take.als")
                .to_string_lossy()
                .as_ref()
        );
        let op: KernelOp =
            serde_json::from_value(json!({"op": "live_set_new", "name": "Sketch"})).unwrap();
        assert!(matches!(op, KernelOp::LiveSetNew { ref name, place: None } if name == "Sketch"));
        let _ = std::fs::remove_dir_all(&home);
        let _ = std::fs::remove_dir_all(&places);
    }

    #[test]
    fn set_from_template_parses_from_its_wire_name() {
        let op: KernelOp = serde_json::from_value(json!({"op": "live_set_from_template",
            "template": "/t/Start Here.als", "project": "Album", "name": "First Take"}))
        .unwrap();
        assert!(
            matches!(op, KernelOp::LiveSetFromTemplate { ref project, .. } if project == "Album")
        );
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

    /// Central's own answers for a world's Music folder, captured from fixture roots with ctrl built from Central with central-47
    /// (DLW build ruling 2026-11-09, 46c item 2): the world they were captured in, and each answer by the input it was asked with.
    fn captured() -> serde_json::Value {
        serde_json::from_str(include_str!(
            "../tests/fixtures/central-47-music-inspect.json"
        ))
        .unwrap()
    }
    /// A world for Samples, as the capture's: a home with its Music folder, a set's project in it, files of every kind and two
    /// folders linked from elsewhere; and, beside them, one file Central's capture never saw (`Music/Audio/unmapped.wav`).
    struct SampleWorld(std::path::PathBuf);
    impl Drop for SampleWorld {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }
    fn sample_world(tag: &str) -> (SampleWorld, std::path::PathBuf, std::path::PathBuf) {
        let home = std::env::temp_dir().join(format!("live-samples-{tag}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&home);
        let fixture = captured();
        let put = |relative: &str, bytes: u64| {
            let path = home.join(relative);
            std::fs::create_dir_all(path.parent().unwrap()).unwrap();
            std::fs::write(&path, vec![0u8; bytes as usize]).unwrap();
        };
        for file in fixture["world"].as_array().unwrap() {
            put(file[0].as_str().unwrap(), file[1].as_u64().unwrap());
        }
        for link in fixture["links"].as_array().unwrap() {
            std::os::unix::fs::symlink(
                link[1].as_str().unwrap(),
                home.join(link[0].as_str().unwrap()),
            )
            .unwrap();
        }
        put("Music/Audio/unmapped.wav", 9);
        let set = home.join("Music/Ableton/Tide Sketch Project/Tide Sketch.als");
        (SampleWorld(home.clone()), home, set)
    }
    /// Every input the file map was asked with, in order.
    type Asked = std::rc::Rc<std::cell::RefCell<Vec<serde_json::Value>>>;
    /// Central's file map as ctrl answered it (central.file-map.inspect) in the capture's ground `ground`, read in this world: each
    /// input asked must be one the capture asked, and its answer is Central's own; `asked` keeps every call.
    fn file_map(
        home: &std::path::Path,
        ground: &str,
    ) -> (
        impl Fn(&str, serde_json::Value) -> Result<serde_json::Value, String>,
        Asked,
    ) {
        let asked = std::rc::Rc::new(std::cell::RefCell::new(Vec::new()));
        let kept = asked.clone();
        let here = std::fs::canonicalize(home)
            .unwrap()
            .to_string_lossy()
            .into_owned();
        let text = serde_json::to_string(&captured()["answers"]).unwrap();
        let answers: Vec<serde_json::Value> =
            serde_json::from_str(&text.replace("{home}", &here).replace("{ground}", "/ground"))
                .unwrap();
        let ground = ground.to_owned();
        let central = move |action: &str, input: serde_json::Value| {
            // Whether this Central keeps folder scopes, as the capture's ctrl disclosed the register: the older ctrl's for `older` (whose
            // map, holding no Music scope, is read as `unscoped`), central-47b's for every other ground.
            let (disclosed, ground) = match ground.as_str() {
                "older" => ("older", "unscoped"),
                other => ("setup", other),
            };
            if action == "action.describe" {
                let answer = answers
                    .iter()
                    .find(|a| a["ground"] == disclosed && a["action"] == "action.describe")
                    .unwrap();
                return Ok(answer["data"].clone());
            }
            assert_eq!(action, "central.file-map.inspect");
            kept.borrow_mut().push(input.clone());
            let answer = answers
                .iter()
                .find(|a| a["ground"] == ground && a["input"] == input)
                .unwrap_or_else(|| {
                    panic!("Central was not asked {input} in the capture's {ground} ground")
                });
            Ok(answer["data"].clone())
        };
        (central, asked)
    }
    fn listed(reading: &serde_json::Value) -> Vec<String> {
        reading["samples"]
            .as_array()
            .unwrap()
            .iter()
            .map(|s| {
                format!(
                    "{} {} {}",
                    s["name"].as_str().unwrap(),
                    s["place"].as_str().unwrap(),
                    s["bytes"]
                )
            })
            .collect()
    }
    fn place<'a>(reading: &'a serde_json::Value, label: &str) -> &'a serde_json::Value {
        reading["places"]
            .as_array()
            .unwrap()
            .iter()
            .find(|p| p["label"] == label)
            .unwrap()
    }

    /// G14 through Central's file owner (DLW build ruling 2026-11-08, round 47 item 1; item 0.4), on Central's own answers (46c item
    /// 2): the admitted set's folder, walked under its own budget; the world's Music folder as Central's file map gives its entries,
    /// by their kind; each sample once, under the label that fits it; never a backup, a pack, a hidden or packaged file, a linked
    /// folder, nor another kind.
    #[test]
    fn samples_list_the_admitted_sets_folder_and_the_music_scope_central_keeps() {
        let (_world, home, set) = sample_world("scope");
        let (central, asked) = file_map(&home, "setup");
        remember_read(set.to_str().unwrap());
        let reading = samples_reading(&central, &home, Some(&set));
        assert_eq!(reading["schema"], "oi.live-samples/v1");
        assert_eq!(
            listed(&reading),
            vec![
                "gull.wav This set's folder 44",
                "estuary-low-tide.wav Music 96",
                "market-hall.AIFF Music 54"
            ],
            "the set's folder first, then Music as Central gives it: a file of the set's folder once, there; the file Central's capture never saw (unmapped.wav) never"
        );
        assert_eq!(place(&reading, "Music")["scope"], "folder:Music");
        assert_eq!(
            [
                place(&reading, "This set's folder")["read"].clone(),
                place(&reading, "Music")["read"].clone()
            ],
            [json!(true), json!(true)]
        );
        assert_eq!(
            place(&reading, "Music")["words"],
            "1 audio file in Music is not a WAV or an AIFF, which a clip here is made of."
        );
        assert_eq!(reading["truncated"], false);
        assert_eq!(
            asked.borrow().len(),
            2,
            "the scopes, then the Music scope's entries, in one page"
        );
        // Through a symbolic link to the same home, the same set: each sample still once.
        let linked = home.with_extension("link");
        let _ = std::fs::remove_file(&linked);
        std::os::unix::fs::symlink(&home, &linked).unwrap();
        let through = linked.join("Music/Ableton/Tide Sketch Project/Tide Sketch.als");
        remember_read(through.to_str().unwrap());
        let again = samples_reading(&central, &linked, Some(&through));
        assert_eq!(
            listed(&again),
            listed(&reading),
            "a set that sits in the Music folder is listed once, under the label that fits"
        );
        let _ = std::fs::remove_file(&linked);
    }

    /// Item 0.4: only the kernel's admitted set is listed, never a path a caller only names, and nothing is said of whether such a
    /// path's folder stands (46c item 4); with no Music scope, Samples says so and lists the set's folder only; a scope that holds no
    /// audio says that.
    #[test]
    fn samples_refuse_in_words_what_they_may_not_list() {
        let (_world, home, set) = sample_world("words");
        let (unscoped, _) = file_map(&home, "unscoped");
        for named in [
            home.join("Music/Ableton/Tide Sketch Project/Elsewhere.als"),
            home.join("Elsewhere/Unread.als"),
        ] {
            let reading = samples_reading(&unscoped, &home, Some(&named));
            assert_eq!(listed(&reading), Vec::<String>::new());
            assert_eq!(
                [
                    place(&reading, "This set's folder")["words"].clone(),
                    place(&reading, "This set's folder")["present"].clone()
                ],
                [
                    json!("This set has not been read here, so its folder is not listed: open the set first."),
                    json!(false)
                ],
                "{named:?}: the same words, and nothing of its folder"
            );
            assert_eq!(
                place(&reading, "Music")["words"],
                "The world's Music folder is not a scope of Central's file map, so its samples are not listed: Setup's Ground step keeps it on your acceptance."
            );
            assert_eq!(
                [
                    place(&reading, "This set's folder")["read"].clone(),
                    place(&reading, "Music")["read"].clone()
                ],
                [json!(false), json!(false)],
                "a place not looked at says so, for the list's own words"
            );
        }
        remember_read(set.to_str().unwrap());
        let alone = samples_reading(&unscoped, &home, Some(&set));
        assert_eq!(
            listed(&alone),
            vec!["gull.wav This set's folder 44"],
            "no Music scope: the set's own folder only"
        );
        // A Central that keeps no folder scope, in its own disclosure (the older ctrl's describe): Samples says what Setup says of it
        // (DLW build ruling 2026-11-09), and lists the set's own folder only.
        let (older, _) = file_map(&home, "older");
        let kept_none = samples_reading(&older, &home, Some(&set));
        assert_eq!(listed(&kept_none), vec!["gull.wav This set's folder 44"]);
        assert_eq!(
            place(&kept_none, "Music")["words"],
            crate::ground_music::UNSUPPORTED,
            "the words Setup's Music row says of this Central"
        );
        let (silent, _) = file_map(&home, "silent");
        let none = samples_reading(&silent, &home, None);
        assert_eq!(listed(&none), Vec::<String>::new());
        assert_eq!(
            place(&none, "Music")["words"],
            "Central's file map holds no audio in Music."
        );
        let refused = |_: &str, _: serde_json::Value| -> Result<serde_json::Value, String> {
            Err("the owner is not installed".into())
        };
        assert_eq!(
            place(&samples_reading(&refused, &home, None), "Music")["words"],
            "Central's file map could not be read, so Music is not listed: the owner is not installed"
        );
        let op: KernelOp = serde_json::from_value(
            json!({"op": "live_samples_list", "path": set.to_string_lossy()}),
        )
        .unwrap();
        assert!(matches!(op, KernelOp::LiveSamplesList { path: Some(_) }));
        assert!(
            execute(&op).is_none(),
            "the samples are served with Central's client (owner_read.rs)"
        );
    }

    /// Item 0.4: each place has its own budget, walked breadth-first, and `truncated` is set only where more stood, said in words.
    #[test]
    fn each_place_lists_within_its_own_budget_and_says_where_more_stood() {
        let (_world, home, set) = sample_world("budget");
        remember_read(set.to_str().unwrap());
        let folder = home.join("Music/Ableton/Tide Sketch Project");
        for name in ["a.wav", "b.wav"] {
            std::fs::write(folder.join(name), [0u8; 2]).unwrap();
        }
        let (central, _) = file_map(&home, "setup");
        let within = |entries: usize, listed: usize| Budget {
            entries,
            listed,
            page: MUSIC_PAGE,
        };
        let exact = samples_reading_within(&central, &home, Some(&set), within(100, 3));
        assert_eq!(
            listed(&exact),
            vec![
                "a.wav This set's folder 2",
                "b.wav This set's folder 2",
                "gull.wav This set's folder 44",
                "estuary-low-tide.wav Music 96",
                "market-hall.AIFF Music 54"
            ],
            "breadth-first: the folder's own files before its subfolders'; each place its own three"
        );
        assert_eq!(
            exact["truncated"], false,
            "exactly the budget is no truncation"
        );
        let one = samples_reading_within(&central, &home, Some(&set), within(100, 1));
        assert_eq!(
            place(&one, "Music")["words"],
            "Only the first 1 sample in Music is listed; more stand in it."
        );
        let cut = samples_reading_within(&central, &home, Some(&set), within(100, 2));
        assert_eq!(cut["truncated"], true);
        assert_eq!(
            place(&cut, "This set's folder")["words"],
            "Only the first 2 samples in this set's folder are listed; more stand in it."
        );
        assert_eq!(
            place(&cut, "Music")["truncated"],
            false,
            "Music's own two are its whole budget"
        );
        let short = samples_reading_within(&central, &home, Some(&set), within(3, 10));
        assert_eq!(
            place(&short, "This set's folder")["words"],
            "This set's folder holds more than 3 entries; only those were looked at."
        );
    }

    /// 46c item 2 (DLW build ruling 2026-11-09): Music is read page by page as Central pages it (`limit`, `after`), each page
    /// Central's own answer; `truncated` comes from Central's word that more stands, and the budget stops the reading in words.
    #[test]
    fn music_is_read_page_by_page_as_central_answers() {
        let (_world, home, set) = sample_world("pages");
        remember_read(set.to_str().unwrap());
        let (central, asked) = file_map(&home, "setup");
        let paged = |entries: usize, listed: usize| Budget {
            entries,
            listed,
            page: 2,
        };
        let whole = samples_reading_within(&central, &home, Some(&set), paged(100, 10));
        assert_eq!(
            listed(&whole),
            vec![
                "gull.wav This set's folder 44",
                "estuary-low-tide.wav Music 96",
                "market-hall.AIFF Music 54"
            ]
        );
        let music = std::fs::canonicalize(home.join("Music")).unwrap();
        let pages: Vec<_> = asked.borrow()[1..]
            .iter()
            .map(|input| (input["limit"].clone(), input["after"].clone()))
            .collect();
        assert_eq!(
            pages,
            vec![
                (json!(2), json!(null)),
                (
                    json!(2),
                    json!(music.join("Audio/estuary-low-tide.wav").to_string_lossy())
                )
            ],
            "the second page starts where Central said the first ended"
        );
        assert_eq!(
            whole["truncated"], false,
            "Central said its last page was the last"
        );
        asked.borrow_mut().clear();
        let looked = samples_reading_within(&central, &home, Some(&set), paged(2, 10));
        assert_eq!(
            asked.borrow().len(),
            2,
            "one page: the budget's two entries"
        );
        assert_eq!(
            [
                place(&looked, "Music")["words"].clone(),
                looked["truncated"].clone()
            ],
            [
                json!("Music holds more than 2 entries; only those were looked at."),
                json!(true)
            ]
        );
        let first = samples_reading_within(&central, &home, Some(&set), paged(100, 1));
        assert_eq!(
            [
                place(&first, "Music")["words"].clone(),
                place(&first, "Music")["truncated"].clone()
            ],
            [
                json!("Only the first 1 sample in Music is listed; more stand in it."),
                json!(true)
            ]
        );
    }

    /// A Central whose file map keeps `home`/Music as `folder:Music` and answers each read of it with `answer(input)`. `asked` keeps
    /// every read; a reader that asks more than ten times has looped, and fails.
    fn paging_central(
        home: &std::path::Path,
        answer: impl Fn(&serde_json::Value) -> serde_json::Value + 'static,
    ) -> (
        impl Fn(&str, serde_json::Value) -> Result<serde_json::Value, String>,
        Asked,
    ) {
        let asked: Asked = std::rc::Rc::new(std::cell::RefCell::new(Vec::new()));
        let kept = asked.clone();
        let music = std::fs::canonicalize(home.join("Music")).unwrap();
        let central = move |action: &str, input: serde_json::Value| {
            assert_eq!(action, "central.file-map.inspect");
            if input["resources"] == false {
                return Ok(json!({"result": {"scopes": [
                    {"world_ref": "folder:Music", "kind": "folder", "path": music.to_string_lossy()}]}}));
            }
            kept.borrow_mut().push(input.clone());
            assert!(kept.borrow().len() <= 10, "the reader kept asking: {input}");
            Ok(json!({"result": answer(&input)}))
        };
        (central, asked)
    }
    /// An honest Central over `audio` (absolute paths in path order): `limit` entries a page after `after`, and its word on more.
    fn honest_pages(audio: Vec<String>) -> impl Fn(&serde_json::Value) -> serde_json::Value {
        move |input| {
            let after = input["after"].as_str();
            let rest: Vec<&String> = audio
                .iter()
                .filter(|path| after.is_none_or(|after| path.as_str() > after))
                .collect();
            let limit = input["limit"].as_u64().unwrap() as usize;
            let page: Vec<&String> = rest.iter().take(limit).copied().collect();
            let more = rest.len() > limit;
            json!({"resources": page.iter().map(|path| json!({"path": path, "kind": "audio", "size": 4})).collect::<Vec<_>>(),
                "page": {"limit": limit, "after": after, "truncated": more, "next": more.then(|| page.last().unwrap().to_string())}})
        }
    }

    /// 47c item 6 (DLW build ruling 2026-11-09): the edges of Music's paging. Each page asks no more than the budget has left; a
    /// page Central gives without its `page` is an error in words; a truncated page with no entries, or one that says more stands
    /// and not where, ends the reading in Central's words and never loops; and `truncated` holds only where Central said more stands
    /// or the budget ended first.
    #[test]
    fn music_paging_edges_end_in_words() {
        let (_world, home, _set) = sample_world("edges");
        let music = std::fs::canonicalize(home.join("Music")).unwrap();
        let audio: Vec<String> = (1..=5)
            .map(|n| {
                music
                    .join(format!("Audio/take-{n}.wav"))
                    .to_string_lossy()
                    .into_owned()
            })
            .collect();
        let budget = |entries: usize, listed: usize| Budget {
            entries,
            listed,
            page: 2,
        };
        let (central, asked) = paging_central(&home, honest_pages(audio.clone()));
        let short = samples_reading_within(&central, &home, None, budget(3, 10));
        let limits: Vec<_> = asked
            .borrow()
            .iter()
            .map(|input| input["limit"].clone())
            .collect();
        assert_eq!(
            limits,
            [json!(2), json!(1)],
            "the second page asks only for what the budget has left"
        );
        assert_eq!(place(&short, "Music")["listed"], 3);
        assert_eq!(place(&short, "Music")["truncated"], true);
        // The budget and Central ending together: nothing stands past it, so nothing is cut.
        let (central, _) = paging_central(&home, honest_pages(audio.clone()));
        let exact = samples_reading_within(&central, &home, None, budget(5, 5));
        assert_eq!(place(&exact, "Music")["listed"], 5);
        assert_eq!(place(&exact, "Music")["truncated"], false);
        assert_eq!(exact["truncated"], false);

        // A page without its `page`: whether more stands is not known, so it is an error, in words.
        let (central, _) = paging_central(&home, |_| json!({"resources": []}));
        let unpaged = samples_reading_within(&central, &home, None, PLACE_BUDGET);
        assert_eq!(
            place(&unpaged, "Music")["words"],
            "Central's file map did not give Music's entries: Central's file map answered Music without a page, so whether more of it stands is not known"
        );
        assert_eq!(place(&unpaged, "Music")["read"], false);

        // A truncated page with no entries ends the reading in Central's words, asked once.
        let (central, asked) = paging_central(&home, |input| {
            json!({"resources": [], "page": {"limit": input["limit"], "after": input["after"], "truncated": true,
                "next": "/elsewhere", "bound": "the time bound stopped the walk: 5s passed before the page filled"}})
        });
        let stopped = samples_reading_within(&central, &home, None, PLACE_BUDGET);
        assert_eq!(asked.borrow().len(), 1);
        assert_eq!(
            [place(&stopped, "Music")["words"].clone(), place(&stopped, "Music")["truncated"].clone(), stopped["truncated"].clone()],
            [json!("Central stopped reading Music before it listed more: the time bound stopped the walk: 5s passed before the page filled."), json!(true), json!(true)]
        );
        let (central, asked) = paging_central(
            &home,
            |input| json!({"resources": [], "page": {"limit": input["limit"], "after": input["after"], "truncated": true, "next": "/elsewhere"}}),
        );
        let empty = samples_reading_within(&central, &home, None, PLACE_BUDGET);
        assert_eq!(asked.borrow().len(), 1);
        assert_eq!(
            place(&empty, "Music")["words"],
            "Central said more of Music stands, and its page held none of it, so the rest of Music is not listed."
        );
        // More stands, and Central says not where: the entries given are listed, and the rest is said.
        let first = audio[0].clone();
        let (central, asked) = paging_central(&home, move |input| {
            json!({"resources": [{"path": first, "kind": "audio", "size": 4}],
                "page": {"limit": input["limit"], "after": input["after"], "truncated": true, "next": null}})
        });
        let lost = samples_reading_within(&central, &home, None, PLACE_BUDGET);
        assert_eq!(asked.borrow().len(), 1);
        assert_eq!(place(&lost, "Music")["listed"], 1);
        assert_eq!(place(&lost, "Music")["truncated"], true);
        assert_eq!(
            place(&lost, "Music")["words"],
            "Central said more of Music stands, and not where its next page starts, so the rest of Music is not listed."
        );
        // A next page said to start where this one did is never asked for again.
        let honest = honest_pages(audio.clone());
        let (central, asked) = paging_central(&home, move |input| {
            let mut answer = honest(input);
            if input["after"].is_string() {
                answer["page"]["truncated"] = json!(true);
                answer["page"]["next"] = input["after"].clone();
            }
            answer
        });
        let stuck = samples_reading_within(&central, &home, None, budget(10, 10));
        assert_eq!(asked.borrow().len(), 2);
        assert_eq!(place(&stuck, "Music")["listed"], 4);
        assert_eq!(place(&stuck, "Music")["truncated"], true);
        // Round 48's review, item 18 (DLW build ruling 2026-11-09, 0C item 16): next pages that come round again (A, then B, then A)
        // are each asked once, and the reading ends in words.
        let first = audio[0].clone();
        let (central, asked) = paging_central(&home, move |input| {
            let next = match input["after"].as_str() {
                None => "/a",
                Some("/a") => "/b",
                Some(_) => "/a",
            };
            json!({"resources": [{"path": first, "kind": "audio", "size": 4}],
                "page": {"limit": input["limit"], "after": input["after"], "truncated": true, "next": next}})
        });
        let round = samples_reading_within(&central, &home, None, PLACE_BUDGET);
        assert_eq!(asked.borrow().len(), 3, "each page once");
        assert_eq!(place(&round, "Music")["truncated"], true);
        assert_eq!(
            place(&round, "Music")["words"],
            "Central said more of Music stands, and its next page is one it gave already, so the rest of Music is not listed."
        );
    }

    /// 47c item 6 with Central's own answer (central-47b, the capture's `bounded` ground: more folders under Music/Archive than
    /// Central's walk reads at once): Central's first page holds no entry and says which bound stopped it, so the reading ends there,
    /// in Central's words, asked once.
    #[test]
    fn centrals_own_bound_ends_the_reading_in_its_words() {
        let (_world, home, _set) = sample_world("bounded");
        let (central, asked) = file_map(&home, "bounded");
        let reading = samples_reading(&central, &home, None);
        assert_eq!(
            [
                place(&reading, "Music")["words"].clone(),
                place(&reading, "Music")["truncated"].clone(),
                place(&reading, "Music")["listed"].clone(),
                reading["truncated"].clone()
            ],
            [
                json!("Central stopped reading Music before it listed more: the directory bound stopped the walk: 10000 folders were read before the page filled."),
                json!(true),
                json!(0),
                json!(true)
            ]
        );
        assert_eq!(asked.borrow().len(), 2, "the scope, then one page");
    }

    /// 46c item 3: Live's backups and packs, a hidden folder and a package are never listed from Music, whatever the scope says:
    /// Setup's scope excludes them (Central's own answer holds none), and an entry Central gives from one is still not listed, so
    /// `Factory Packs` never fills the budget. A set that stands in Music itself leaves Music listed whole.
    #[test]
    fn music_never_lists_lives_backups_or_packs_whatever_the_scope_says() {
        let (_world, home, _set) = sample_world("packs");
        let fixture = captured();
        let held = |ground: &str| -> Vec<String> {
            fixture["answers"]
                .as_array()
                .unwrap()
                .iter()
                .filter(|a| a["ground"] == ground && a["input"]["limit"] == 1000)
                .flat_map(|a| a["data"]["result"]["resources"].as_array().unwrap().clone())
                .map(|e| e["path"].as_str().unwrap().to_owned())
                .collect()
        };
        assert!(
            held("setup")
                .iter()
                .all(|p| !p.contains("/Backup/") && !p.contains("/Factory Packs/")),
            "Setup's scope: Central excludes them"
        );
        assert!(
            held("unexcluded")
                .iter()
                .any(|p| p.contains("/Factory Packs/"))
                && held("unexcluded").iter().any(|p| p.contains("/Backup/")),
            "a scope with no exclusions: Central lists them"
        );
        let (central, _) = file_map(&home, "unexcluded");
        let two = Budget {
            entries: 100,
            listed: 2,
            page: MUSIC_PAGE,
        };
        let reading = samples_reading_within(&central, &home, None, two);
        assert_eq!(
            listed(&reading),
            vec!["gull.wav Music 44", "estuary-low-tide.wav Music 96"],
            "the pack's kick and the backup never take a place in Music's budget"
        );
        assert_eq!(
            place(&reading, "Music")["words"],
            "Only the first 2 samples in Music are listed; more stand in it."
        );
        // A set that stands in Music itself: its folder is Music, listed once, under Music, with Music's other audio.
        let loose = home.join("Music/Loose.als");
        std::fs::write(&loose, [0u8; 3]).unwrap();
        remember_read(loose.to_str().unwrap());
        let (setup, _) = file_map(&home, "setup");
        let reading = samples_reading(&setup, &home, Some(&loose));
        assert_eq!(
            listed(&reading),
            vec![
                "gull.wav Music 44",
                "estuary-low-tide.wav Music 96",
                "market-hall.AIFF Music 54"
            ]
        );
        assert_eq!(
            place(&reading, "This set's folder")["words"],
            "This set stands in Music itself, so its samples are listed under Music."
        );
    }

    /// 46c item 4: the folder listed is the admitted set's own, by its canonical path: a set reached through a symbolic link, or by
    /// a path with `..` in it, lists the folder it stands in; a linked folder inside the walk is not walked; a `..` path to a set not
    /// read is refused like any other.
    #[test]
    fn the_folder_listed_is_the_admitted_sets_own() {
        let (_world, home, set) = sample_world("canonical");
        let (unscoped, _) = file_map(&home, "unscoped");
        let real = std::fs::canonicalize(set.parent().unwrap()).unwrap();
        let link = home.join("Elsewhere/Linked.als");
        std::os::unix::fs::symlink(&set, &link).unwrap();
        remember_read(link.to_str().unwrap());
        let through = samples_reading(&unscoped, &home, Some(&link));
        assert_eq!(
            listed(&through),
            vec!["gull.wav This set's folder 44"],
            "the set's own folder, not the link's (which holds far.wav), and never the linked Samples/Linked"
        );
        assert_eq!(
            place(&through, "This set's folder")["path"],
            json!(real.to_string_lossy())
        );
        let dotted =
            home.join("Music/Audio/../Ableton/Tide Sketch Project/Samples/../Tide Sketch.als");
        remember_read(dotted.to_str().unwrap());
        let by_dots = samples_reading(&unscoped, &home, Some(&dotted));
        assert_eq!(listed(&by_dots), listed(&through));
        assert_eq!(
            place(&by_dots, "This set's folder")["path"],
            json!(real.to_string_lossy())
        );
        // 47c item 3: the `..` path names a real set, never read, beside a sample, and reaches it from inside the read set's folder:
        // only the canonical read check refuses it (the folder it would list holds other.wav).
        let other = home.join("Music/Ableton/Other Project");
        std::fs::create_dir_all(other.join("Samples")).unwrap();
        std::fs::copy(&set, other.join("Other.als")).unwrap();
        std::fs::write(other.join("Samples/other.wav"), vec![0u8; 44]).unwrap();
        let unread = home.join("Music/Ableton/Tide Sketch Project/../Other Project/Other.als");
        assert!(unread.is_file(), "the `..` path names a real set");
        let refused = samples_reading(&unscoped, &home, Some(&unread));
        assert_eq!(
            listed(&refused),
            Vec::<String>::new(),
            "nothing of the set not read is listed"
        );
        let shut = place(&refused, "This set's folder");
        assert_eq!(shut["present"], false);
        assert_eq!(
            shut["words"],
            "This set has not been read here, so its folder is not listed: open the set first."
        );
    }

    /// 46c item 4: a sample is made into a clip (its headers read) only from where Samples lists it: the read set's folder, or the
    /// Music folder once Central has answered for it as a scope, by the file's canonical path, never inside a folder the walk
    /// leaves; anything else is refused in the same words, through the act too.
    #[test]
    fn a_clip_is_made_only_of_a_sample_samples_lists() {
        let (_world, home, set) = sample_world("admitted");
        let folder = home.join("Music/Ableton/Tide Sketch Project");
        let words = |file: &std::path::Path| {
            format!("{} is not in this set's folder or in the world's Music scope, so it is not read: a clip is made of a sample Samples lists", file.display())
        };
        let gull = folder.join("Samples/Imported/gull.wav");
        assert_eq!(
            admitted_sample(set.to_str().unwrap(), gull.to_str().unwrap()).unwrap_err(),
            words(&gull),
            "a set not read admits nothing"
        );
        remember_read(set.to_str().unwrap());
        assert_eq!(
            admitted_sample(set.to_str().unwrap(), gull.to_str().unwrap()).unwrap(),
            std::fs::canonicalize(&gull).unwrap()
        );
        for outside in [
            home.join("Elsewhere/far.wav"),
            folder.join("Samples/Linked/far.wav"),
            folder.join("Backup/old.wav"),
            folder.join(".hidden/secret.wav"),
            folder.join("Tool.app/Contents/inside.wav"),
            folder.join("Samples/Imported/../../../../../Elsewhere/far.wav"),
        ] {
            assert_eq!(
                admitted_sample(set.to_str().unwrap(), outside.to_str().unwrap()).unwrap_err(),
                words(&outside),
                "{outside:?}"
            );
        }
        let estuary = home.join("Music/Audio/estuary-low-tide.wav");
        assert!(
            admitted_sample(set.to_str().unwrap(), estuary.to_str().unwrap()).is_err(),
            "Music, before Central has answered for it as a scope"
        );
        let (setup, _) = file_map(&home, "setup");
        samples_reading(&setup, &home, Some(&set));
        assert!(admitted_sample(set.to_str().unwrap(), estuary.to_str().unwrap()).is_ok());
        assert!(
            admitted_sample(
                set.to_str().unwrap(),
                home.join("Music/Ableton/Factory Packs/Drums/kick.wav")
                    .to_str()
                    .unwrap()
            )
            .is_err(),
            "never a pack, even in Music"
        );
        // Through the act: a real set, read, and a sample from outside: refused before its file is opened.
        let made = folder.join("Real.als");
        live_set::acts::new_set(made.to_str().unwrap()).unwrap();
        remember_read(made.to_str().unwrap());
        let far = home.join("Elsewhere/far.wav");
        let op: KernelOp = serde_json::from_value(json!({"op": "live_set_act", "path": made.to_string_lossy(),
            "expected_revision": "sha256:none", "act": {"kind": "audio_clip_make", "track": 0, "file": far.to_string_lossy()}}))
        .unwrap();
        match execute(&op) {
            Some(Err(why)) => assert_eq!(why, words(&far)),
            other => panic!("the act was not refused in words: {other:?}"),
        }
    }

    /// A folder a test keeps under the temp directory, taken away when the test ends, whether it passes or fails (48e item 14).
    struct Held(std::path::PathBuf);
    impl Drop for Held {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }

    /// A kernel whose Central is a stub that marks each run in the file it answers with, and answers nothing: no real Central is
    /// reached.
    fn stub_kernel(
        home: &std::path::Path,
    ) -> (std::sync::Mutex<crate::Kernel>, std::path::PathBuf) {
        use std::os::unix::fs::PermissionsExt;
        let ran = home.join("ran");
        let ctrl = home.join("ctrl");
        std::fs::write(
            &ctrl,
            format!("#!/bin/sh\necho \"$@\" >> '{}'\nexit 1\n", ran.display()),
        )
        .unwrap();
        std::fs::set_permissions(&ctrl, std::fs::Permissions::from_mode(0o755)).unwrap();
        crate::test_stub::settle_stub(&ctrl);
        let client = crate::flow::CentralClient::with(ctrl, None, "test".into());
        (std::sync::Mutex::new(crate::Kernel::new(client)), ran)
    }

    /// One audio part, Vox, whose Arrangement clip Room plays the file its `FileRef` names (`file`: its children's XML), at 120 BPM.
    fn reverse_set(set: &std::path::Path, file: &str) {
        let xml = format!(
            r#"<Ableton MajorVersion="5" MinorVersion="12.0_12049"><LiveSet><Tracks>
<AudioTrack Id="8"><Name><EffectiveName Value="Vox"/><UserName Value=""/></Name><DeviceChain><MainSequencer><ClipSlotList/><Sample><ArrangerAutomation><Events>
<AudioClip Id="0" Time="0"><CurrentStart Value="0"/><CurrentEnd Value="2"/><Loop><LoopStart Value="0"/><LoopEnd Value="0.0005"/><StartRelative Value="0"/><LoopOn Value="false"/><OutMarker Value="0.0005"/><HiddenLoopStart Value="0"/><HiddenLoopEnd Value="0.0005"/></Loop><Name Value="Room"/><IsWarped Value="false"/><SampleVolume Value="1"/><SampleRef><FileRef>{file}</FileRef></SampleRef></AudioClip>
</Events></ArrangerAutomation></Sample></MainSequencer><DeviceChain><Devices/></DeviceChain></DeviceChain></AudioTrack>
</Tracks><MainTrack><DeviceChain><Mixer><Tempo><Manual Value="120"/></Tempo></Mixer></DeviceChain></MainTrack><Scenes><Scene Id="0"><Name Value=""/></Scene></Scenes></LiveSet></Ableton>"#
        );
        std::fs::write(
            set,
            live_set::write_gz(&live_set::xml::parse(&xml).unwrap()).unwrap(),
        )
        .unwrap();
    }

    /// Four frames of 16-bit mono at 8 kHz: 1, 2, 3, 4.
    fn four_frames() -> Vec<u8> {
        let mut wav = b"RIFF".to_vec();
        wav.extend_from_slice(&(36u32 + 8).to_le_bytes());
        wav.extend_from_slice(b"WAVEfmt ");
        for word in [
            16u32.to_le_bytes().as_slice(),
            &1u16.to_le_bytes(),
            &1u16.to_le_bytes(),
            &8_000u32.to_le_bytes(),
            &16_000u32.to_le_bytes(),
            &2u16.to_le_bytes(),
            &16u16.to_le_bytes(),
            b"data",
            &8u32.to_le_bytes(),
        ] {
            wav.extend_from_slice(word);
        }
        for frame in [1i16, 2, 3, 4] {
            wav.extend_from_slice(&frame.to_le_bytes());
        }
        wav
    }

    /// The set at `path` read through `dispatch`, as the shell reads it before a write; its revision.
    fn read_through(kernel: &std::sync::Mutex<crate::Kernel>, path: &str) -> serde_json::Value {
        let (read, _) = crate::dispatch::dispatch(
            kernel,
            KernelOp::LiveSetRead {
                path: path.to_owned(),
            },
        );
        let KernelOpResult::LiveSetReading { reading } = read.unwrap().result else {
            panic!("set reading expected");
        };
        reading["revision"].clone()
    }

    /// Round 48d item 1: the Sample tab's Reverse comes through the kernel as an act on the set's objects (`clip_reverse`, as the
    /// shell sends it): only on a set this process has read, on its revision, and its sample, the clip's own played backwards, is
    /// written into the set's own folder, the file the clip played standing as it was. The clip's file is the set's to name, as
    /// Crop's is: the shell names none. Through `dispatch`, the path the hosts take, and the sample it kept is recorded, as Crop's and
    /// Consolidate's are (48e items 12 and 14).
    #[test]
    fn the_kernel_serves_reverse_into_the_sets_own_folder() {
        let held = Held(
            std::env::temp_dir().join(format!("live-set-owner-{}-reverse", std::process::id())),
        );
        let dir = held.0.clone();
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        let set = dir.join("Song.als");
        reverse_set(&set, r#"<RelativePath Value="room.wav"/>"#);
        let wav = four_frames();
        std::fs::write(dir.join("room.wav"), &wav).unwrap();
        let (kernel, ran) = stub_kernel(&dir);
        let path = set.to_string_lossy().into_owned();
        let reverse = |revision: serde_json::Value| -> KernelOp {
            serde_json::from_value(
                json!({"op": "live_set_act", "path": path, "expected_revision": revision,
                "act": {"kind": "clip_reverse", "track": 0, "clip": {"arrangement": 0}}}),
            )
            .unwrap()
        };
        let (refused, _) = crate::dispatch::dispatch(&kernel, reverse(json!("sha256:none")));
        let refused = refused.map(|_| ()).unwrap_err();
        assert!(
            refused.contains("Read this Live set before writing"),
            "{refused}"
        );
        let revision = read_through(&kernel, &path);
        let (reversed, _) = crate::dispatch::dispatch(&kernel, reverse(revision));
        let outcome = reversed.unwrap();
        let KernelOpResult::LiveSetActed { reading } = outcome.result else {
            panic!("an act's answer expected");
        };
        assert_eq!(reading["act"], "clip_reverse");
        assert_eq!(reading["at"], json!({"track": 0, "arrangement": 0}));
        let relative = reading["sample"]["path"].as_str().unwrap();
        assert!(
            relative.starts_with("Samples/Processed/Reverse/room [") && relative.ends_with("].wav"),
            "{relative}"
        );
        let written = std::fs::read(dir.join(relative)).unwrap();
        assert_eq!(
            &written[written.len() - 8..],
            &[4, 0, 3, 0, 2, 0, 1, 0],
            "the frames, last first"
        );
        assert_eq!(
            std::fs::read(dir.join("room.wav")).unwrap(),
            wav,
            "the file the clip played stands as it was"
        );
        let kept = dir.join(relative).to_string_lossy().into_owned();
        assert_eq!(
            outcome.receipts.len(),
            1,
            "one receipt, for the sample kept"
        );
        assert!(
            matches!(&outcome.receipts[0].envelope.event, crate::events::KernelEvent::FileChanged { path, summary }
                if *path == kept && summary == "Reverse kept a reversed sample of a clip of Song.als beside it."),
            "{:?}",
            outcome.receipts[0].envelope.event
        );
        assert!(!ran.exists(), "no Central ran for it");
    }

    /// 48e item 4 (DLW build ruling 2026-11-09, on #944's review, M3): Reverse reads only the file the clip already plays, as the
    /// engine and Crop do; it adds no new source to the set and admits nothing. Through `dispatch`: a clip whose file sits outside
    /// the set's folder and the world's Music scope is reversed from that one file, the reversed sample is written only under the
    /// set's own `Samples/Processed/Reverse`, and that file is still not admitted for making a clip of (the Live act's arm, which
    /// `dispatch` reaches, and the admission itself).
    #[test]
    fn reverse_reads_only_the_clips_own_file_and_admits_nothing() {
        let held = Held(
            std::env::temp_dir().join(format!("live-set-owner-{}-reverse-own", std::process::id())),
        );
        let _ = std::fs::remove_dir_all(&held.0);
        let (folder, pack) = (held.0.join("Set"), held.0.join("Factory Packs/Drums"));
        std::fs::create_dir_all(&folder).unwrap();
        std::fs::create_dir_all(&pack).unwrap();
        let kick = pack.join("kick.wav");
        let wav = four_frames();
        std::fs::write(&kick, &wav).unwrap();
        let set = folder.join("Song.als");
        reverse_set(
            &set,
            &format!(
                r#"<RelativePath Value=""/><Path Value="{}"/>"#,
                kick.display()
            ),
        );
        let (kernel, ran) = stub_kernel(&held.0);
        let path = set.to_string_lossy().into_owned();
        let mut before = Vec::new();
        files_under(&held.0, &mut before);
        let revision = read_through(&kernel, &path);
        let op: KernelOp = serde_json::from_value(
            json!({"op": "live_set_act", "path": path, "expected_revision": revision,
            "act": {"kind": "clip_reverse", "track": 0, "clip": {"arrangement": 0}}}),
        )
        .unwrap();
        let (reversed, _) = crate::dispatch::dispatch(&kernel, op);
        let KernelOpResult::LiveSetActed { reading } = reversed.unwrap().result else {
            panic!("an act's answer expected");
        };
        let relative = reading["sample"]["path"].as_str().unwrap();
        assert!(
            relative.starts_with("Samples/Processed/Reverse/kick ["),
            "{relative}"
        );
        let written = std::fs::read(folder.join(relative)).unwrap();
        assert_eq!(
            &written[written.len() - 8..],
            &[4, 0, 3, 0, 2, 0, 1, 0],
            "kick.wav, read"
        );
        assert_eq!(
            std::fs::read(&kick).unwrap(),
            wav,
            "kick.wav stands as it was"
        );
        let mut after = Vec::new();
        files_under(&held.0, &mut after);
        let reverse_dir = folder.join("Samples/Processed/Reverse");
        let new: Vec<_> = after
            .iter()
            .filter(|f| !before.contains(f) && **f != held.0.join("ran"))
            .collect();
        assert!(
            !new.is_empty() && new.iter().all(|f| f.starts_with(&reverse_dir)),
            "written only under the set's Samples/Processed/Reverse: {new:?}"
        );
        assert!(!ran.exists(), "no Central ran for it");
        // Not admitted: a clip is still not made of it.
        let kick_name = kick.to_string_lossy().into_owned();
        let words = format!("{kick_name} is not in this set's folder or in the world's Music scope, so it is not read: a clip is made of a sample Samples lists");
        assert_eq!(admitted_sample(&path, &kick_name).unwrap_err(), words);
        let made: KernelOp = serde_json::from_value(
            json!({"op": "live_set_act", "path": path, "expected_revision": "sha256:none",
            "act": {"kind": "audio_clip_make", "track": 0, "file": kick_name}}),
        )
        .unwrap();
        match execute(&made) {
            Some(Err(why)) => assert_eq!(why, words),
            other => panic!("the clip was not refused in words: {other:?}"),
        }
    }

    /// Every file under `dir`, links not followed.
    fn files_under(dir: &std::path::Path, into: &mut Vec<std::path::PathBuf>) {
        for row in std::fs::read_dir(dir).unwrap().flatten() {
            let kind = row.file_type().unwrap();
            if kind.is_dir() {
                files_under(&row.path(), into);
            } else if kind.is_file() {
                into.push(row.path());
            }
        }
    }

    /// 47c item 5 (DLW build ruling 2026-11-09): admission applies the listing's rules exactly. Every file of the world live-set makes
    /// a clip of is admitted if and only if Samples lists it, from the set's folder or from Music: no deeper than the walk goes,
    /// never a hidden file, never in a folder the walk leaves — whatever Central's own walk gives.
    #[test]
    fn a_sample_is_admitted_exactly_where_samples_lists_it() {
        let (_world, home, set) = sample_world("exactly");
        let music = std::fs::canonicalize(home.join("Music")).unwrap();
        let folder = std::fs::canonicalize(set.parent().unwrap()).unwrap();
        let deep = |root: &std::path::Path, folders: usize| {
            (0..folders).fold(root.to_path_buf(), |at, n| at.join(format!("d{n}")))
        };
        let audio = music.join("Audio");
        let mut planted = Vec::new();
        for at in [
            deep(&folder, SETS_DEPTH),
            deep(&folder, SETS_DEPTH + 1),
            deep(&audio, SETS_DEPTH - 1),
            deep(&audio, SETS_DEPTH),
        ] {
            std::fs::create_dir_all(&at).unwrap();
            planted.push(at.join("deep.wav"));
        }
        planted.push(folder.join("Samples/Imported/.hidden.wav"));
        planted.push(audio.join("._estuary-low-tide.wav"));
        for file in &planted {
            std::fs::write(file, [0u8; 4]).unwrap();
        }
        remember_read(set.to_str().unwrap());
        // Central gives every file under Music, hidden or deep, so what is listed is the kernel's own rule.
        let mut every = Vec::new();
        files_under(&music, &mut every);
        let mut given: Vec<String> = every
            .iter()
            .filter(|file| makes_clip_of(file))
            .map(|file| file.to_string_lossy().into_owned())
            .collect();
        given.sort();
        let (central, _) = paging_central(&home, honest_pages(given.clone()));
        let reading = samples_reading(&central, &home, Some(&set));
        let listed: HashSet<PathBuf> = reading["samples"]
            .as_array()
            .unwrap()
            .iter()
            .map(|sample| std::fs::canonicalize(sample["path"].as_str().unwrap()).unwrap())
            .collect();
        assert_eq!(
            planted
                .iter()
                .map(|file| listed.contains(file))
                .collect::<Vec<_>>(),
            [true, false, true, false, false, false],
            "the walk's depth from either place, and no hidden file"
        );
        for file in &given {
            assert_eq!(
                admitted_sample(set.to_str().unwrap(), file).is_ok(),
                listed.contains(std::path::Path::new(file)),
                "{file}: admitted exactly where it is listed"
            );
        }
        assert!(given.len() > 10, "{given:?}");
        // Round 48's review, item 13 (DLW build ruling 2026-11-09, 0C item 13): admission is by file too, by the listing's own rule:
        // audio live-set makes no clip of, and a file that is no audio, is never admitted from either place, wherever it stands.
        for file in [
            audio.join("tide.mp3"),
            audio.join("notes.txt"),
            folder.join("Samples/Imported/take.flac"),
        ] {
            std::fs::write(&file, [0u8; 4]).unwrap();
            assert!(
                admitted_sample(set.to_str().unwrap(), file.to_str().unwrap()).is_err(),
                "{file:?} is not listed, so it is not admitted"
            );
        }
    }

    /// 47c item 5: what was admitted from Music stands only in the world it was listed in, and only while that world's Central
    /// keeps it: another world clears it, and so does a reading in which Central no longer keeps Music.
    #[test]
    fn music_is_admitted_only_in_its_world_and_while_central_keeps_it() {
        let (_world, home, set) = sample_world("worlds");
        remember_read(set.to_str().unwrap());
        let estuary = home.join("Music/Audio/estuary-low-tide.wav");
        let admitted = || admitted_sample(set.to_str().unwrap(), estuary.to_str().unwrap()).is_ok();
        let (setup, _) = file_map(&home, "setup");
        let (unscoped, _) = file_map(&home, "unscoped");
        let (one, two) = (
            std::path::Path::new("/worlds/one"),
            std::path::Path::new("/worlds/two"),
        );
        bind_world(Some(one));
        samples_reading(&setup, &home, Some(&set));
        assert!(admitted());
        bind_world(Some(one));
        assert!(admitted(), "the same world keeps it");
        bind_world(Some(two));
        assert!(
            !admitted(),
            "another world admits nothing of the first's Music"
        );
        bind_world(Some(one));
        assert!(
            !admitted(),
            "back in the first world, Music waits for Central to answer for it again"
        );
        samples_reading(&setup, &home, Some(&set));
        assert!(admitted());
        samples_reading(&unscoped, &home, Some(&set));
        assert!(
            !admitted(),
            "the reading in which Central keeps no Music clears what an earlier one listed"
        );
    }

    /// The world Music was last bound to.
    fn bound_world() -> Option<PathBuf> {
        music_scopes(|scopes| scopes.world.clone())
    }

    /// A kernel client of the Central at `root`, whose executable stands nowhere: every ask of it fails, as an unreachable Central's.
    fn unreachable_client(home: &std::path::Path, root: &str) -> crate::flow::CentralClient {
        crate::flow::CentralClient::with(
            home.join("no-ctrl-stands-here"),
            Some(PathBuf::from(root)),
            "o-i".into(),
        )
    }

    /// One op served as the kernel serves it (owner_read.rs, outside the kernel lock), with `client`.
    fn served(
        client: &crate::flow::CentralClient,
        op: serde_json::Value,
    ) -> Result<crate::KernelOpOutcome, String> {
        let op: KernelOp = serde_json::from_value(op).unwrap();
        crate::owner_read::PreparedRead::prepare(
            client,
            crate::agent_prepared::PreparedWorld::held_only(client.clone(), None),
            &op,
            None,
        )
        .expect("a Live op is a prepared read")
        .execute()
    }

    /// Round 48's review, item 5 (DLW build ruling 2026-11-09, 0C item 5): the kernel binds the world its Central client names before
    /// it serves a Live op, so what Music admitted in one world never stands in another.
    #[test]
    fn a_live_op_is_served_in_the_world_its_client_names() {
        let (_world, home, _set) = sample_world("bound");
        bind_world(Some(std::path::Path::new("/worlds/one")));
        served(
            &unreachable_client(&home, "/worlds/two"),
            json!({"op": "live_device_descriptors"}),
        )
        .unwrap();
        assert_eq!(bound_world(), Some(PathBuf::from("/worlds/two")));
    }

    /// Round 48's review, item 12 (0C item 12): what Music admitted stands until a complete reading replaces it — never withdrawn while
    /// a reading is in flight, nor by a reading Central did not finish.
    #[test]
    fn music_is_replaced_only_by_a_complete_reading() {
        let (_world, home, set) = sample_world("inflight");
        remember_read(set.to_str().unwrap());
        let estuary = home.join("Music/Audio/estuary-low-tide.wav");
        let (setup, _) = file_map(&home, "setup");
        samples_reading(&setup, &home, Some(&set));
        let (named, file) = (
            set.to_str().unwrap().to_owned(),
            estuary.to_str().unwrap().to_owned(),
        );
        let during = std::rc::Rc::new(std::cell::Cell::new(None));
        let seen = during.clone();
        let (paging, _) = paging_central(&home, move |input| {
            seen.set(Some(admitted_sample(&named, &file).is_ok()));
            honest_pages(Vec::new())(input)
        });
        samples_reading(&paging, &home, Some(&set));
        assert_eq!(
            during.get(),
            Some(true),
            "a clip made while Samples reads Music again finds it admitted"
        );
        let unanswered = |_: &str, _: serde_json::Value| -> Result<serde_json::Value, String> {
            Err("Central is not answering".into())
        };
        samples_reading(&unanswered, &home, Some(&set));
        assert!(
            admitted_sample(set.to_str().unwrap(), estuary.to_str().unwrap()).is_ok(),
            "a reading Central did not finish withdraws nothing"
        );
    }

    /// 0C item 12: a clip is made from Music only while Central's file map keeps it now. Where it no longer does, or cannot be read,
    /// what an earlier reading admitted is withdrawn, and the clip-make is refused in words that say so.
    #[test]
    fn a_clip_is_made_from_music_only_while_central_keeps_it() {
        let (_world, home, set) = sample_world("holds");
        remember_read(set.to_str().unwrap());
        let estuary = home.join("Music/Audio/estuary-low-tide.wav");
        let admitted = || admitted_sample(set.to_str().unwrap(), estuary.to_str().unwrap());
        let (setup, _) = file_map(&home, "setup");
        let (unscoped, _) = file_map(&home, "unscoped");
        samples_reading(&setup, &home, Some(&set));
        hold_music_to_central(&setup);
        assert!(admitted().is_ok(), "Central keeps it still");
        hold_music_to_central(&unscoped);
        assert_eq!(
            admitted().unwrap_err(),
            format!("{} is in the world's Music folder, which Central's file map no longer keeps, so it is not read: Setup's Ground step keeps it on your acceptance", estuary.display())
        );
        samples_reading(&setup, &home, Some(&set));
        assert!(admitted().is_ok(), "kept, and read again: admitted again");
        let unanswered = |_: &str, _: serde_json::Value| -> Result<serde_json::Value, String> {
            Err("Central is not answering".into())
        };
        hold_music_to_central(&unanswered);
        assert_eq!(
            admitted().unwrap_err(),
            format!("{} is in the world's Music folder, and Central's file map could not be read just now (Central is not answering), so it is not read: read Samples again once Central answers", estuary.display())
        );
    }

    /// 0D item 8 (review 8): a Samples reading that finishes while the hold asks Central stands. The hold withdraws only what it
    /// asked about: the root as the reading it judged left it, not one a later reading listed again.
    #[test]
    fn a_reading_that_lists_music_while_the_hold_asks_stands() {
        let (_world, home, set) = sample_world("hold-race");
        remember_read(set.to_str().unwrap());
        let estuary = home.join("Music/Audio/estuary-low-tide.wav");
        let (setup, _) = file_map(&home, "setup");
        let (unscoped, _) = file_map(&home, "unscoped");
        samples_reading(&setup, &home, Some(&set));
        let music = std::fs::canonicalize(home.join("Music")).unwrap();
        // Central answers that it keeps no Music, but only after a Samples reading has listed Music afresh.
        let late = |action: &str, input: serde_json::Value| {
            listed_music_scope(Some(&music));
            unscoped(action, input)
        };
        hold_music_to_central(&late);
        assert!(
            admitted_sample(set.to_str().unwrap(), estuary.to_str().unwrap()).is_ok(),
            "the reading that listed Music after the ask stands"
        );
    }

    /// 0C item 12, through the kernel: a clip-make it serves asks Central's file map whether Music stands kept before the sample is
    /// admitted.
    #[test]
    fn the_kernel_holds_music_to_central_before_it_makes_a_clip() {
        let (_world, home, set) = sample_world("kernel-holds");
        let client = unreachable_client(&home, "/worlds/kernel-holds");
        bind_world(client.configured_root());
        let (setup, _) = file_map(&home, "setup");
        samples_reading(&setup, &home, Some(&set));
        let made = std::fs::canonicalize(set.parent().unwrap())
            .unwrap()
            .join("Held.als");
        live_set::acts::new_set(made.to_str().unwrap()).unwrap();
        remember_read(made.to_str().unwrap());
        let estuary = home.join("Music/Audio/estuary-low-tide.wav");
        assert!(admitted_sample(made.to_str().unwrap(), estuary.to_str().unwrap()).is_ok());
        let refused = served(
            &client,
            json!({"op": "live_set_act", "path": made.to_string_lossy(), "expected_revision": "sha256:none",
                "act": {"kind": "audio_clip_make", "track": 0, "file": estuary.to_string_lossy()}}),
        )
        .map(|_| ())
        .unwrap_err();
        assert!(
            refused.starts_with(&format!("{} is in the world's Music folder, and Central's file map could not be read just now (", estuary.display())),
            "{refused}"
        );
    }

    /// 47c item 5: the act reads the file admitted, by its canonical path, never the name as given: a sample named through a link
    /// in the set's folder is read where it stands, and live-set's own words name that file.
    #[test]
    fn the_act_reads_the_path_admitted() {
        let (_world, _home, set) = sample_world("made");
        let folder = std::fs::canonicalize(set.parent().unwrap()).unwrap();
        let made = folder.join("Real.als");
        live_set::acts::new_set(made.to_str().unwrap()).unwrap();
        let read = match execute(&KernelOp::LiveSetRead {
            path: made.to_string_lossy().into_owned(),
        }) {
            Some(Ok(KernelOpResult::LiveSetReading { reading })) => reading,
            other => panic!("set reading expected, got {other:?}"),
        };
        // gull.wav (44 bytes, no sound in it), named through a link beside it in the set's own folder.
        let alias = folder.join("Samples/alias.wav");
        std::os::unix::fs::symlink("Imported/gull.wav", &alias).unwrap();
        let op: KernelOp = serde_json::from_value(json!({"op": "live_set_act", "path": made.to_string_lossy(),
            "expected_revision": read["revision"], "act": {"kind": "audio_clip_make", "track": 0, "file": alias.to_string_lossy()}}))
        .unwrap();
        match execute(&op) {
            Some(Err(why)) => assert!(
                why.starts_with("gull.wav ") && !why.contains("alias"),
                "live-set read the file admitted, by its own name: {why}"
            ),
            other => panic!("the act was not refused in live-set's words: {other:?}"),
        }
    }
}
