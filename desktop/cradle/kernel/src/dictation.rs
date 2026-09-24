//! Desktop-owned local dictation. The renderer owns microphone permission and
//! capture; this native boundary owns endpoint choice and bounded local HTTP.
use base64::{engine::general_purpose::STANDARD, Engine};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    collections::BTreeMap,
    io::{Read, Write},
    path::PathBuf,
    process::{Command, Stdio},
    sync::{Arc, Mutex},
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};
use url::{Host, Url};
const DEFAULT_URL: &str = "http://127.0.0.1:8080/inference";
const MAX_WAV: usize = 44 + 16000 * 2 * 300;
const MAX_REPLY: u64 = 1024 * 1024;
fn now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}
fn random() -> Result<String, String> {
    let mut bytes = [0u8; 32];
    getrandom::fill(&mut bytes).map_err(|e| e.to_string())?;
    Ok(bytes.iter().map(|b| format!("{b:02x}")).collect())
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct Stipulation {
    pub revision: u64,
    pub stt_url: String,
}
impl Default for Stipulation {
    fn default() -> Self {
        Self {
            revision: 0,
            stt_url: DEFAULT_URL.into(),
        }
    }
}
fn endpoint(value: &str) -> Result<Url, String> {
    if value.len() > 2048 {
        return Err("Dictation endpoint is too long".into());
    }
    let url = Url::parse(value).map_err(|_| "Dictation needs a loopback HTTP(S) endpoint")?;
    let local = match url.host() {
        Some(Host::Domain("localhost")) => true,
        Some(Host::Ipv4(ip)) => ip == std::net::Ipv4Addr::LOCALHOST,
        Some(Host::Ipv6(ip)) => ip == std::net::Ipv6Addr::LOCALHOST,
        _ => false,
    };
    if !local
        || !matches!(url.scheme(), "http" | "https")
        || !url.username().is_empty()
        || url.password().is_some()
        || url.fragment().is_some()
    {
        return Err("Dictation refuses a non-loopback endpoint or embedded credentials; local HTTP(S) speech only".into());
    }
    Ok(url)
}
#[derive(Clone, Debug)]
struct Lease {
    stipulation: Stipulation,
    expires: u64,
}
#[derive(Debug, Default)]
struct State {
    leases: BTreeMap<String, Lease>,
}
#[derive(Clone, Debug, Default)]
pub struct Store {
    state: Arc<Mutex<State>>,
    path: Option<PathBuf>,
}
impl Store {
    fn path(&self) -> Result<PathBuf, String> {
        if let Some(path) = &self.path {
            return Ok(path.clone());
        }
        let home = std::env::var_os("OI_HOME")
            .map(PathBuf::from)
            .or_else(|| std::env::var_os("HOME").map(|h| PathBuf::from(h).join(".oi")))
            .ok_or("Native home unavailable")?;
        Ok(home.join("desktop/dictation.json"))
    }
    pub fn read(&self) -> Result<Stipulation, String> {
        let path = self.path()?;
        let metadata = match std::fs::symlink_metadata(&path) {
            Ok(m) => m,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(Stipulation::default()),
            Err(e) => return Err(e.to_string()),
        };
        if !metadata.is_file() || metadata.file_type().is_symlink() || metadata.len() > 4096 {
            return Err("Invalid native dictation configuration".into());
        }
        let value: Stipulation =
            serde_json::from_slice(&std::fs::read(path).map_err(|e| e.to_string())?)
                .map_err(|e| format!("Invalid native dictation configuration: {e}"))?;
        endpoint(&value.stt_url)?;
        Ok(value)
    }
    pub fn configure(&self, value: String, expected: u64) -> Result<(Stipulation, bool), String> {
        use std::os::unix::fs::{OpenOptionsExt, PermissionsExt};
        let url = endpoint(&value)?.to_string();
        let _guard = self.state.lock().map_err(|_| "Dictation lock failed")?;
        let old = self.read()?;
        if old.revision != expected {
            return Err("Dictation settings changed; read them again".into());
        }
        if old.stt_url == url {
            return Ok((old, false));
        }
        let next = Stipulation {
            revision: old
                .revision
                .checked_add(1)
                .ok_or("Dictation revision exhausted")?,
            stt_url: url,
        };
        let path = self.path()?;
        let dir = path.parent().ok_or("Invalid dictation directory")?;
        std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
        std::fs::set_permissions(dir, std::fs::Permissions::from_mode(0o700))
            .map_err(|e| e.to_string())?;
        let temporary = dir.join(format!(".dictation-{}.tmp", random()?));
        let result = (|| {
            let mut file = std::fs::OpenOptions::new()
                .write(true)
                .create_new(true)
                .mode(0o600)
                .open(&temporary)
                .map_err(|e| e.to_string())?;
            file.write_all(&serde_json::to_vec(&next).map_err(|e| e.to_string())?)
                .map_err(|e| e.to_string())?;
            file.sync_all().map_err(|e| e.to_string())?;
            std::fs::rename(&temporary, path).map_err(|e| e.to_string())
        })();
        if result.is_err() {
            let _ = std::fs::remove_file(temporary);
        }
        result?;
        Ok((next, true))
    }
    pub fn prepare(&self, op: &crate::KernelOp) -> Result<Option<Prepared>, String> {
        match op {
            crate::KernelOp::DictationProbe => Ok(Some(Prepared::Probe {
                store: self.clone(),
                stipulation: self.read()?,
            })),
            crate::KernelOp::DictationTranscribe {
                capture_ref,
                wav_base64,
            } => {
                if wav_base64.len() > MAX_WAV.div_ceil(3) * 4 {
                    return Err("Dictation recording exceeds five minutes".into());
                }
                let wav = STANDARD
                    .decode(wav_base64)
                    .map_err(|_| "Invalid dictation audio encoding")?;
                validate_wav(&wav)?;
                let lease = self
                    .state
                    .lock()
                    .map_err(|_| "Dictation lock failed")?
                    .leases
                    .remove(capture_ref)
                    .ok_or("Unknown or already used dictation capture")?;
                if lease.expires <= now() {
                    return Err("Dictation capture expired; record again".into());
                }
                if self.read() != Ok(lease.stipulation.clone()) {
                    return Err("Dictation endpoint changed during capture; record again".into());
                }
                Ok(Some(Prepared::Transcribe {
                    stipulation: lease.stipulation,
                    wav,
                }))
            }
            _ => Ok(None),
        }
    }
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum Outcome {
    Transcript { text: String },
    ServiceDown { detail: String, endpoint: String },
    Failed { detail: String },
    Empty,
}
pub enum Prepared {
    Probe {
        store: Store,
        stipulation: Stipulation,
    },
    Transcribe {
        stipulation: Stipulation,
        wav: Vec<u8>,
    },
}
impl Prepared {
    pub fn execute(self) -> Result<crate::KernelOpOutcome, String> {
        let result = match self {
            Self::Probe { store, stipulation } => {
                // A real local HTTP response of any status proves reachability. No mic
                // bytes are requested until the native probe has returned successfully.
                local_post(&stipulation.stt_url, &silence(), Duration::from_secs(3)).map_err(
                    |e| {
                        format!(
                            "Local speech is not running at {}: {e}",
                            stipulation.stt_url
                        )
                    },
                )?;
                if store.read() != Ok(stipulation.clone()) {
                    return Err("Dictation endpoint changed during probe; start again".into());
                }
                let capture_ref = format!("dictation-capture:{}", random()?);
                let mut state = store.state.lock().map_err(|_| "Dictation lock failed")?;
                state.leases.retain(|_, lease| lease.expires > now());
                if state.leases.len() >= 64 {
                    return Err("Too many open dictation captures".into());
                }
                state.leases.insert(
                    capture_ref.clone(),
                    Lease {
                        stipulation: stipulation.clone(),
                        expires: now() + 600,
                    },
                );
                crate::KernelOpResult::DictationPrepared {
                    capture_ref,
                    stipulation,
                }
            }
            Self::Transcribe { stipulation, wav } => {
                let outcome = match local_post(&stipulation.stt_url, &wav, Duration::from_secs(30))
                {
                    Ok((status, body)) => parse_reply(status, &body),
                    Err(detail) => Outcome::ServiceDown {
                        detail,
                        endpoint: stipulation.stt_url,
                    },
                };
                crate::KernelOpResult::DictationTranscribed { outcome }
            }
        };
        Ok(crate::KernelOpOutcome {
            receipts: vec![],
            result,
        })
    }
}
fn validate_wav(bytes: &[u8]) -> Result<(), String> {
    if bytes.len() < 44
        || bytes.len() > MAX_WAV
        || &bytes[..4] != b"RIFF"
        || &bytes[8..12] != b"WAVE"
        || &bytes[12..16] != b"fmt "
        || &bytes[36..40] != b"data"
    {
        return Err("Dictation requires bounded 16 kHz mono PCM WAV".into());
    }
    let u16at = |i| u16::from_le_bytes([bytes[i], bytes[i + 1]]);
    let u32at = |i| u32::from_le_bytes(bytes[i..i + 4].try_into().unwrap());
    if u32at(4) as usize != bytes.len() - 8
        || u32at(16) != 16
        || u16at(20) != 1
        || u16at(22) != 1
        || u32at(24) != 16000
        || u32at(28) != 32000
        || u16at(32) != 2
        || u16at(34) != 16
        || u32at(40) as usize != bytes.len() - 44
        || (bytes.len() - 44) % 2 != 0
    {
        return Err("Dictation WAV format or length is invalid".into());
    }
    Ok(())
}
fn silence() -> Vec<u8> {
    let mut wav = Vec::new();
    wav.extend(b"RIFF");
    wav.extend(132u32.to_le_bytes());
    wav.extend(b"WAVEfmt ");
    wav.extend(16u32.to_le_bytes());
    wav.extend(1u16.to_le_bytes());
    wav.extend(1u16.to_le_bytes());
    wav.extend(16000u32.to_le_bytes());
    wav.extend(32000u32.to_le_bytes());
    wav.extend(2u16.to_le_bytes());
    wav.extend(16u16.to_le_bytes());
    wav.extend(b"data");
    wav.extend(96u32.to_le_bytes());
    wav.extend([0; 96]);
    wav
}
fn parse_reply(status: u16, body: &[u8]) -> Outcome {
    if !(200..300).contains(&status) {
        return Outcome::Failed {
            detail: format!("the local server answered HTTP {status}"),
        };
    }
    let value: Value = match serde_json::from_slice(body) {
        Ok(value) => value,
        Err(error) => {
            return Outcome::Failed {
                detail: format!("the local server's answer was not JSON ({error})"),
            }
        }
    };
    match value["text"].as_str() {
        Some(text) if text.trim().is_empty() => Outcome::Empty,
        Some(text) => Outcome::Transcript { text: text.into() },
        None => Outcome::Failed {
            detail: "the local server's answer carried no text field".into(),
        },
    }
}
fn local_post(target: &str, wav: &[u8], timeout: Duration) -> Result<(u16, Vec<u8>), String> {
    let url = endpoint(target)?;
    let boundary = format!("oi-dictation-{}", random()?);
    let mut body=format!("--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"dictation.wav\"\r\nContent-Type: audio/wav\r\n\r\n").into_bytes();
    body.extend(wav);
    body.extend(format!("\r\n--{boundary}\r\nContent-Disposition: form-data; name=\"response_format\"\r\n\r\njson\r\n--{boundary}--\r\n").as_bytes());
    let mut command = Command::new("curl");
    command.args([
        "--disable",
        "--silent",
        "--show-error",
        "--noproxy",
        "*",
        "--proto",
        "=http,https",
        "--max-redirs",
        "0",
        "--connect-timeout",
        "2",
        "--max-time",
        &timeout.as_secs().to_string(),
        "--header",
        &format!("Content-Type: multipart/form-data; boundary={boundary}"),
        "--data-binary",
        "@-",
        "--write-out",
        "\n%{http_code}",
    ]);
    if matches!(url.host(), Some(Host::Domain("localhost"))) {
        command.args([
            "--resolve",
            &format!(
                "localhost:{}:127.0.0.1",
                url.port_or_known_default().unwrap()
            ),
        ]);
    }
    let mut child = command
        .arg(url.as_str())
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Cannot reach the native local speech transport: {e}"))?;
    let mut stdin = child.stdin.take().ok_or("Dictation stdin absent")?;
    let stdout = child.stdout.take().ok_or("Dictation stdout absent")?;
    let stderr = child.stderr.take().ok_or("Dictation stderr absent")?;
    let write = std::thread::spawn(move || stdin.write_all(&body));
    let read = std::thread::spawn(move || {
        let mut bytes = Vec::new();
        stdout
            .take(MAX_REPLY + 1)
            .read_to_end(&mut bytes)
            .map(|_| bytes)
    });
    let errors = std::thread::spawn(move || {
        let mut bytes = Vec::new();
        stderr.take(4096).read_to_end(&mut bytes).map(|_| bytes)
    });
    let began = Instant::now();
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break Ok(status),
            Ok(None) => {}
            Err(e) => {
                let _ = child.kill();
                let _ = child.wait();
                break Err(e.to_string());
            }
        }
        if began.elapsed() > timeout + Duration::from_secs(2) {
            let _ = child.kill();
            let _ = child.wait();
            break Err("Local speech transport timed out".into());
        }
        std::thread::sleep(Duration::from_millis(10));
    };
    let _ = write.join();
    let bytes = read
        .join()
        .map_err(|_| "Local speech read failed")?
        .map_err(|e| e.to_string())?;
    let detail = errors
        .join()
        .map_err(|_| "Local speech error read failed")?
        .map_err(|e| e.to_string())?;
    if !status?.success() {
        return Err(String::from_utf8_lossy(&detail).trim().to_owned());
    }
    if bytes.len() > MAX_REPLY as usize {
        return Err("Local speech response exceeds its size bound".into());
    }
    let split = bytes
        .iter()
        .rposition(|b| *b == b'\n')
        .ok_or("Local speech response has no HTTP status")?;
    let status = std::str::from_utf8(&bytes[split + 1..])
        .map_err(|e| e.to_string())?
        .parse::<u16>()
        .map_err(|e| e.to_string())?;
    Ok((status, bytes[..split].to_vec()))
}
impl crate::Kernel {
    pub fn prepare_dictation(&mut self, op: &crate::KernelOp) -> Result<Option<Prepared>, String> {
        self.dictation.prepare(op)
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn endpoint_is_local_pinned_and_never_accepts_embedded_credentials() {
        for value in [
            DEFAULT_URL,
            "http://localhost:8123/inference",
            "https://[::1]/inference",
        ] {
            assert!(endpoint(value).is_ok(), "{value}")
        }
        for value in [
            "https://speech.example/inference",
            "http://127.0.0.2/",
            "http://localhost.evil/",
            "http://user:secret@127.0.0.1/",
            "file:///tmp/audio",
            "http://127.0.0.1/#redirect",
        ] {
            assert!(endpoint(value).is_err(), "{value}")
        }
    }
    #[test]
    fn exact_pcm_wire_and_reply_states() {
        let wav = silence();
        validate_wav(&wav).unwrap();
        let mut wrong = wav.clone();
        wrong[24] = 0;
        assert!(validate_wav(&wrong).is_err());
        assert!(validate_wav(&wav[..40]).is_err());
        assert!(
            matches!(parse_reply(200,br#"{"text":" spoken words "}"#),Outcome::Transcript{text} if text==" spoken words ")
        );
        assert_eq!(parse_reply(200, br#"{"text":" "}"#), Outcome::Empty);
        assert!(matches!(
            parse_reply(500, b"unavailable"),
            Outcome::Failed { .. }
        ));
        assert!(matches!(
            parse_reply(200, b"not-json"),
            Outcome::Failed { .. }
        ));
    }
    #[test]
    fn native_config_is_revision_checked_and_survives_new_store() {
        let path = std::env::temp_dir()
            .join(format!("oi-dictation-test-{}", random().unwrap()))
            .join("dictation.json");
        let store = Store {
            path: Some(path.clone()),
            ..Store::default()
        };
        assert_eq!(store.read().unwrap(), Stipulation::default());
        let (saved, changed) = store
            .configure("http://localhost:8123/inference".into(), 0)
            .unwrap();
        assert!(changed);
        assert_eq!(saved.revision, 1);
        assert!(store.configure(DEFAULT_URL.into(), 0).is_err());
        assert!(store
            .configure("https://outside.invalid".into(), 1)
            .is_err());
        assert_eq!(
            Store {
                path: Some(path.clone()),
                ..Store::default()
            }
            .read()
            .unwrap(),
            saved
        );
        assert!(!store.configure(saved.stt_url, 1).unwrap().1);
        std::fs::remove_dir_all(path.parent().unwrap()).unwrap();
    }
}
