//! The main window's download receiver (ticket P, G1). Every export the shell
//! and its hosted frame offer is an `<a download>` click (the frame's
//! capture.ts `download()`, library.ts `downloadVerbatim`, the canvas's
//! `saveBlob`, the natal chart link); wry cancels a download when its webview
//! carries no handler, so without this receiver each export vanished.
//!
//! The shape is browser.rs's own `.on_download` (its Requested/Finished arms
//! and the notice it records), ported for the main window: the destination is
//! the one the engine proposes — the platform's Downloads folder, the file
//! name de-duplicated — because the machine's placement policy
//! (Control/user/placement.json) rules no home for exports; the person is told
//! where the file landed, and a refusal or failure is carried as its named
//! fault, never silence. The notice goes to the shell on `oi:native-download`.
use serde::Serialize;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use tauri::webview::DownloadEvent;
use tauri::{Emitter, Manager, Runtime, Webview};

/// The topic the shell's Studio reads (components/expressions/studio/studioExports.ts).
pub const DOWNLOAD_EVENT: &str = "oi:native-download";

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum DownloadState {
    Saving,
    Saved,
    Failed,
}

/// Why a download did not land, by name.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum DownloadFault {
    /// The engine proposed no absolute place to write (no Downloads folder and
    /// no working directory); the download is cancelled rather than written to
    /// a relative path.
    NoDestination,
    /// The engine reported the download failed or was cancelled.
    NotSaved,
}

impl DownloadFault {
    pub fn words(self) -> &'static str {
        match self {
            DownloadFault::NoDestination => {
                "This machine offers no Downloads folder to save it in, so it was not saved"
            }
            DownloadFault::NotSaved => "The download failed or was cancelled; nothing was saved",
        }
    }
}

/// What the person is told about one download.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct DownloadNotice {
    pub state: DownloadState,
    /// The file's name as it lands (the engine de-duplicates it in the folder).
    pub file: Option<String>,
    /// The folder it lands in, whole.
    pub folder: Option<String>,
    /// The folder as the person reads it: under the home folder it starts `~/`.
    pub place: Option<String>,
    pub fault: Option<DownloadFault>,
    pub reason: Option<String>,
}

impl DownloadNotice {
    fn at(state: DownloadState, path: Option<&Path>, home: Option<&Path>) -> Self {
        let file = path
            .and_then(Path::file_name)
            .map(|name| name.to_string_lossy().into_owned());
        let folder = path.and_then(Path::parent);
        DownloadNotice {
            state,
            file,
            folder: folder.map(|dir| dir.display().to_string()),
            place: folder.map(|dir| place(dir, home)),
            fault: None,
            reason: None,
        }
    }
    fn failed(fault: DownloadFault, path: Option<&Path>, home: Option<&Path>) -> Self {
        DownloadNotice {
            fault: Some(fault),
            reason: Some(fault.words().into()),
            ..DownloadNotice::at(DownloadState::Failed, path, home)
        }
    }
}

/// A folder in the person's words: under the home folder it reads `~/…`.
pub fn place(folder: &Path, home: Option<&Path>) -> String {
    match home.and_then(|home| folder.strip_prefix(home).ok()) {
        Some(rest) if rest.as_os_str().is_empty() => "~".into(),
        Some(rest) => format!("~/{}", rest.display()),
        None => folder.display().to_string(),
    }
}

/// The destination decision. The placement policy rules no home for exports,
/// so the engine's proposal stands when it is an absolute file path; anything
/// else is refused by name.
pub fn destination(proposed: &Path) -> Result<PathBuf, DownloadFault> {
    if proposed.is_absolute() && proposed.file_name().is_some() {
        Ok(proposed.to_path_buf())
    } else {
        Err(DownloadFault::NoDestination)
    }
}

/// The downloads this window started and has not heard finish, in order:
/// WebKit's finish names no path on macOS (wry: "always empty, due to API
/// limitations"), so the destination is kept from the request.
#[derive(Default)]
pub struct Ledger(Mutex<Vec<(String, PathBuf)>>);

impl Ledger {
    /// A download is requested: decide its destination, remember it, and say
    /// where it is going. `false` cancels it.
    pub fn requested(
        &self,
        url: &str,
        proposed: &mut PathBuf,
        home: Option<&Path>,
    ) -> (bool, DownloadNotice) {
        match destination(proposed) {
            Ok(path) => {
                *proposed = path.clone();
                let notice = DownloadNotice::at(DownloadState::Saving, Some(&path), home);
                if let Ok(mut open) = self.0.lock() {
                    open.push((url.to_owned(), path));
                }
                (true, notice)
            }
            Err(fault) => (false, DownloadNotice::failed(fault, None, home)),
        }
    }

    /// A download finished: where it landed (the engine's path, else the one
    /// kept from its request), or its failure by name.
    pub fn finished(
        &self,
        url: &str,
        path: Option<PathBuf>,
        success: bool,
        home: Option<&Path>,
    ) -> DownloadNotice {
        let kept = self.0.lock().ok().and_then(|mut open| {
            let index = open.iter().position(|(started, _)| started == url)?;
            Some(open.remove(index).1)
        });
        let landed = path.filter(|p| !p.as_os_str().is_empty()).or(kept);
        if success {
            DownloadNotice::at(DownloadState::Saved, landed.as_deref(), home)
        } else {
            DownloadNotice::failed(DownloadFault::NotSaved, landed.as_deref(), home)
        }
    }
}

/// The receiver a window is built with (main.rs): each event decided by the
/// ledger, and its notice announced to the shell.
pub fn receiver<R: Runtime>(
) -> impl Fn(Webview<R>, DownloadEvent<'_>) -> bool + Send + Sync + 'static {
    let ledger = Arc::new(Ledger::default());
    move |webview, event| {
        let home = webview.path().home_dir().ok();
        let (allow, notice) = match event {
            DownloadEvent::Requested { url, destination } => {
                ledger.requested(url.as_str(), destination, home.as_deref())
            }
            DownloadEvent::Finished { url, path, success } => (
                true,
                ledger.finished(url.as_str(), path, success, home.as_deref()),
            ),
            _ => return true,
        };
        if let Err(error) = webview.app_handle().emit(DOWNLOAD_EVENT, &notice) {
            eprintln!("The download notice could not reach the shell: {error}");
        }
        allow
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn home() -> PathBuf {
        PathBuf::from("/Users/person")
    }

    #[test]
    fn the_engines_proposal_stands_as_the_destination() {
        let ledger = Ledger::default();
        let mut proposed = PathBuf::from("/Users/person/Downloads/field-study (1).png");
        let (allow, notice) =
            ledger.requested("blob:tauri://localhost/1", &mut proposed, Some(&home()));
        assert!(allow);
        assert_eq!(
            proposed,
            PathBuf::from("/Users/person/Downloads/field-study (1).png")
        );
        assert_eq!(notice.state, DownloadState::Saving);
        assert_eq!(notice.file.as_deref(), Some("field-study (1).png"));
        assert_eq!(notice.folder.as_deref(), Some("/Users/person/Downloads"));
        assert_eq!(notice.place.as_deref(), Some("~/Downloads"));
        assert_eq!(notice.fault, None);
    }

    #[test]
    fn a_relative_or_nameless_proposal_is_refused_by_name() {
        for proposed in ["field-study.png", "", "/"] {
            let ledger = Ledger::default();
            let mut path = PathBuf::from(proposed);
            let (allow, notice) = ledger.requested("blob:x", &mut path, Some(&home()));
            assert!(!allow, "{proposed}");
            assert_eq!(notice.state, DownloadState::Failed);
            assert_eq!(notice.fault, Some(DownloadFault::NoDestination));
            assert_eq!(
                notice.reason.as_deref(),
                Some(DownloadFault::NoDestination.words())
            );
            // A refused request is not remembered, so no finish can claim it.
            assert!(ledger.0.lock().unwrap().is_empty());
        }
    }

    #[test]
    fn a_finish_without_a_path_lands_where_its_request_was_sent() {
        // macOS: WebKit's finish carries no path; the request's destination is the record.
        let ledger = Ledger::default();
        let mut first = PathBuf::from("/Users/person/Downloads/a.expression.json");
        let mut second = PathBuf::from("/Volumes/Work/Downloads/b.png");
        ledger.requested("blob:a", &mut first, Some(&home()));
        ledger.requested("blob:b", &mut second, Some(&home()));
        let notice = ledger.finished("blob:b", None, true, Some(&home()));
        assert_eq!(notice.state, DownloadState::Saved);
        assert_eq!(notice.file.as_deref(), Some("b.png"));
        assert_eq!(notice.place.as_deref(), Some("/Volumes/Work/Downloads"));
        let notice = ledger.finished("blob:a", None, true, Some(&home()));
        assert_eq!(notice.file.as_deref(), Some("a.expression.json"));
        assert_eq!(notice.place.as_deref(), Some("~/Downloads"));
        assert!(ledger.0.lock().unwrap().is_empty());
    }

    #[test]
    fn the_engines_own_finish_path_wins_over_the_kept_one() {
        let ledger = Ledger::default();
        let mut proposed = PathBuf::from("/Users/person/Downloads/a.png");
        ledger.requested("blob:a", &mut proposed, Some(&home()));
        let notice = ledger.finished(
            "blob:a",
            Some(PathBuf::from("/Users/person/Downloads/a (2).png")),
            true,
            Some(&home()),
        );
        assert_eq!(notice.file.as_deref(), Some("a (2).png"));
    }

    #[test]
    fn a_failed_or_cancelled_download_is_carried_as_its_named_fault() {
        let ledger = Ledger::default();
        let mut proposed = PathBuf::from("/Users/person/Downloads/take.webm");
        ledger.requested("blob:take", &mut proposed, Some(&home()));
        let notice = ledger.finished("blob:take", None, false, Some(&home()));
        assert_eq!(notice.state, DownloadState::Failed);
        assert_eq!(notice.fault, Some(DownloadFault::NotSaved));
        assert_eq!(
            notice.reason.as_deref(),
            Some(DownloadFault::NotSaved.words())
        );
        assert_eq!(notice.file.as_deref(), Some("take.webm"));
        // A finish this window never saw requested still says what happened.
        let notice = ledger.finished("blob:unknown", None, false, None);
        assert_eq!((notice.state, notice.file), (DownloadState::Failed, None));
    }

    #[test]
    fn the_notice_reads_as_the_shell_parses_it() {
        let notice =
            DownloadNotice::failed(DownloadFault::NotSaved, Some(Path::new("/tmp/x.png")), None);
        let value = serde_json::to_value(&notice).unwrap();
        assert_eq!(value["state"], "failed");
        assert_eq!(value["fault"], "not_saved");
        assert_eq!(value["file"], "x.png");
        assert_eq!(value["place"], "/tmp");
        assert_eq!(place(Path::new("/Users/person"), Some(&home())), "~");
    }
}
