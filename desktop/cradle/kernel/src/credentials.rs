//! The credential and harness-install verbs of the Settings page
//! (docs/cradle/12-SETTINGS.md §3.2, §3.4, §6): typed operations over the
//! owner's own `aikit credential …` and `aikit client install …` commands,
//! routed through the suite (`oi aikit …`, `OI_BIN` else `oi`) exactly like
//! every other AIKit read the kernel makes. The desktop holds no credential
//! state of its own: bindings, verification and revocation are AIKit's.
//!
//! Secret material law (12 §3.4, decision S2). A pasted key crosses the
//! kernel exactly once, in one direction:
//!
//!   renderer ──(the op's `material` field)──▶ kernel ──(child STDIN)──▶ aikit
//!
//! It never enters argv, the child's environment, a log line, an error
//! message, an event receipt or an outcome. [`SecretMaterial`] carries it:
//! its `Debug` and `Serialize` are redacted, and its bytes are overwritten
//! when it drops. A stored-secret *reference* (`keychain://`, `op://`,
//! `varlock://`, `pass://`) names a location, not material, and travels as
//! the owner's own `--ref` argument.
//!
//! Material entry needs the owner to read a key from STDIN
//! (`aikit credential setup <ref> --stdin`). The installed AIKit is asked
//! whether it offers that (`credential setup --help` names the flag); when
//! it does not, the kernel refuses BEFORE anything is spawned, names the
//! missing operation in plain words, and drops the material.

use serde::{Deserialize, Deserializer, Serialize, Serializer};
use serde_json::{json, Value};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};

/// A pasted key, held only as long as the op that carries it.
#[derive(Clone, PartialEq, Eq)]
pub struct SecretMaterial(String);

impl SecretMaterial {
    pub fn new(value: impl Into<String>) -> Self {
        Self(value.into())
    }
    fn expose(&self) -> &str {
        &self.0
    }
    fn is_blank(&self) -> bool {
        self.0.trim().is_empty()
    }
}

impl std::fmt::Debug for SecretMaterial {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("SecretMaterial([redacted])")
    }
}

impl Serialize for SecretMaterial {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        // Material never travels back out of the kernel in any encoding.
        serializer.serialize_str("[redacted]")
    }
}

impl<'de> Deserialize<'de> for SecretMaterial {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        String::deserialize(deserializer).map(SecretMaterial)
    }
}

impl Drop for SecretMaterial {
    fn drop(&mut self) {
        // Overwrite the bytes before the allocation is released.
        // SAFETY: zero bytes are valid UTF-8, so the String stays well-formed.
        unsafe {
            for byte in self.0.as_bytes_mut() {
                std::ptr::write_volatile(byte, 0);
            }
        }
    }
}

/// The stored-secret schemes the owner declares (`aikit credential setup
/// --ref`). `env://` is deliberately absent: the owner refuses it as a
/// declared location.
pub const REFERENCE_SCHEMES: &[&str] = &["keychain://", "op://", "varlock://", "pass://"];

/// Whether this cut of AIKit can receive a key from the app.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct MaterialEntry {
    pub available: bool,
    /// Plain words naming the missing operation when it is not available.
    pub missing: Option<String>,
}

const MISSING_MATERIAL_ENTRY: &str = "Saving a pasted key needs AIKit to read the key from the app (`aikit credential setup <provider> --stdin`); the installed AIKit only reads a key typed into a terminal, so the key was not saved. A stored secret works today.";

#[derive(Clone, Debug)]
pub struct Client {
    executable: PathBuf,
    suite_route: bool,
    /// The per-process answer to "does `credential setup` read STDIN?".
    material_entry: Arc<Mutex<Option<bool>>>,
}

/// Where the material goes on the owner's side.
enum Material<'a> {
    None,
    Reference(&'a str),
    /// The owner's explicit environment import (`--from-env --env-var NAME`):
    /// the person chose a discovered variable; the material moves inside
    /// AIKit only and never crosses the kernel.
    Environment(&'a str),
    Stdin(&'a SecretMaterial),
}

impl Client {
    pub fn discover() -> Self {
        Self {
            executable: std::env::var_os("OI_BIN").map(PathBuf::from).unwrap_or_else(|| "oi".into()),
            suite_route: true,
            material_entry: Arc::new(Mutex::new(None)),
        }
    }

    /// A direct `aikit` binding (tests, or a host that names the binary).
    pub fn with(executable: PathBuf, suite_route: bool) -> Self {
        Self { executable, suite_route, material_entry: Arc::new(Mutex::new(None)) }
    }

    fn command(&self, cwd: &Path) -> Command {
        let mut command = Command::new(&self.executable);
        command.current_dir(cwd);
        if self.suite_route {
            command.arg("aikit");
        }
        command
    }

    /// Run one owner verb. STDIN is closed (null) unless material crosses;
    /// the owner's JSON envelope is unwrapped; a refusal carries the owner's
    /// own message (AIKit error messages never carry material).
    fn run(&self, cwd: &Path, args: &[&str], material: Material<'_>) -> Result<Value, String> {
        let mut command = self.command(cwd);
        command.args(args);
        if let Material::Reference(reference) = material {
            command.arg("--ref").arg(reference);
        }
        if let Material::Environment(name) = material {
            command.arg("--from-env").arg("--env-var").arg(name);
        }
        if matches!(material, Material::Stdin(_)) {
            command.arg("--stdin");
        }
        command.stdout(Stdio::piped()).stderr(Stdio::piped());
        command.stdin(if matches!(material, Material::Stdin(_)) { Stdio::piped() } else { Stdio::null() });
        let mut child = command.spawn().map_err(|error| format!("AIKit's credential commands are unavailable: {error}"))?;
        if let Material::Stdin(secret) = material {
            let mut pipe = child.stdin.take().ok_or("The key could not be handed to AIKit (no input pipe); nothing was saved")?;
            let mut line = String::with_capacity(secret.expose().len() + 1);
            line.push_str(secret.expose().trim());
            line.push('\n');
            let written = pipe.write_all(line.as_bytes());
            // Overwrite the transient copy before anything else can happen.
            unsafe {
                for byte in line.as_bytes_mut() {
                    std::ptr::write_volatile(byte, 0);
                }
            }
            drop(pipe);
            if written.is_err() {
                let _ = child.kill();
                let _ = child.wait();
                return Err("The key could not be handed to AIKit; nothing was saved".into());
            }
        }
        let output = child.wait_with_output().map_err(|error| format!("AIKit's credential command did not finish: {error}"))?;
        envelope(&output.stdout, &output.stderr, output.status.success())
    }

    /// `credential setup --help` names `--stdin` when the owner can read a
    /// key from the app. Asked once per process.
    pub fn material_entry(&self, cwd: &Path) -> MaterialEntry {
        let mut cached = self.material_entry.lock().unwrap_or_else(|poison| poison.into_inner());
        let available = *cached.get_or_insert_with(|| {
            let mut command = self.command(cwd);
            command.args(["credential", "setup", "--help"]).stdin(Stdio::null());
            command
                .output()
                .map(|output| String::from_utf8_lossy(&output.stdout).contains("--stdin"))
                .unwrap_or(false)
        });
        MaterialEntry { available, missing: (!available).then(|| MISSING_MATERIAL_ENTRY.to_owned()) }
    }

    /// The persisted binding metadata (`aikit credential list --json`) beside
    /// whether a pasted key can be saved on this cut.
    pub fn list(&self, cwd: &Path) -> Result<Value, String> {
        let data = self.run(cwd, &["credential", "list", "--json"], Material::None)?;
        if !data.get("bindings").is_some_and(Value::is_array) {
            return Err("AIKit's credential list carried no bindings".into());
        }
        Ok(json!({
            "bindings": data["bindings"],
            "material_entry": self.material_entry(cwd),
        }))
    }

    /// Presence-only findings (`aikit credential discover --json`): names and
    /// locations, never values.
    pub fn discover_keys(&self, cwd: &Path) -> Result<Value, String> {
        let data = self.run(cwd, &["credential", "discover", "--json"], Material::None)?;
        if !data.get("findings").is_some_and(Value::is_array) {
            return Err("AIKit's key discovery carried no findings".into());
        }
        Ok(data)
    }

    /// Bind a credential: a stored-secret reference, or pasted material
    /// through STDIN. Exactly one of the two.
    pub fn setup(&self, cwd: &Path, credential: &str, reference: Option<&str>, material: Option<&SecretMaterial>) -> Result<Value, String> {
        self.bind("setup", cwd, credential, reference, material)
    }

    /// Replace the material or its location; the credential ref stays.
    pub fn rotate(&self, cwd: &Path, credential: &str, reference: Option<&str>, material: Option<&SecretMaterial>) -> Result<Value, String> {
        self.bind("rotate", cwd, credential, reference, material)
    }

    fn bind(&self, verb: &str, cwd: &Path, credential: &str, reference: Option<&str>, material: Option<&SecretMaterial>) -> Result<Value, String> {
        let credential = credential_ref(credential)?;
        let reference = reference.map(str::trim).filter(|value| !value.is_empty());
        let material = material.filter(|value| !value.is_blank());
        match (reference, material) {
            (Some(_), Some(_)) => Err("Give either a key or a stored-secret reference, not both; nothing was saved".into()),
            (None, None) => Err("Paste a key or name a stored secret; nothing was saved".into()),
            (Some(reference), None) if reference.starts_with("env://") => {
                let name = &reference["env://".len()..];
                let valid = !name.is_empty() && !name.starts_with(|c: char| c.is_ascii_digit()) && name.chars().all(|c| c.is_ascii_alphanumeric() || c == '_');
                if !valid {
                    return Err("An environment import names one variable (for example env://OPENROUTER_API_KEY)".into());
                }
                let mut args = vec!["credential", verb, credential.as_str()];
                if verb == "setup" {
                    args.push("--headless");
                }
                args.push("--json");
                self.run(cwd, &args, Material::Environment(name))
            }
            (Some(reference), None) => {
                let reference = secret_reference(reference)?;
                let mut args = vec!["credential", verb, credential.as_str()];
                if verb == "setup" {
                    args.push("--headless");
                }
                args.push("--json");
                self.run(cwd, &args, Material::Reference(&reference))
            }
            (None, Some(material)) => {
                if !self.material_entry(cwd).available {
                    return Err(MISSING_MATERIAL_ENTRY.to_owned());
                }
                let mut args = vec!["credential", verb, credential.as_str()];
                if verb == "setup" {
                    args.push("--headless");
                }
                args.push("--json");
                self.run(cwd, &args, Material::Stdin(material))
            }
        }
    }

    /// One operator-invoked live check (`aikit credential verify`): the
    /// owner's verdict — working, refused or unreachable — with its time.
    pub fn verify(&self, cwd: &Path, credential: &str) -> Result<Value, String> {
        let credential = credential_ref(credential)?;
        let data = self.run(cwd, &["credential", "verify", credential.as_str(), "--json"], Material::None)?;
        if data.get("verdict").and_then(Value::as_str).is_none() {
            return Err("AIKit's verify answered without a verdict".into());
        }
        Ok(data)
    }

    /// Mark the binding revoked (`aikit credential revoke`). Nothing the
    /// operator owns is deleted.
    pub fn revoke(&self, cwd: &Path, credential: &str) -> Result<Value, String> {
        let credential = credential_ref(credential)?;
        self.run(cwd, &["credential", "revoke", credential.as_str(), "--json"], Material::None)
    }

    /// Install AIKit's integration for one detected harness
    /// (`aikit client install <client>`).
    pub fn client_install(&self, cwd: &Path, client: &str) -> Result<Value, String> {
        let client = client.trim();
        if client.is_empty() || !client.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_') {
            return Err("A harness is installed by its client name (letters, digits and dashes)".into());
        }
        self.run(cwd, &["client", "install", client, "--json"], Material::None)
    }
}

/// The process-wide suite binding (its STDIN capability answer is asked
/// once per kernel).
fn shared() -> &'static Client {
    static CLIENT: std::sync::OnceLock<Client> = std::sync::OnceLock::new();
    CLIENT.get_or_init(Client::discover)
}

/// The kernel arm: one credential/install op against the suite binding.
pub fn apply(cwd: &Path, op: crate::KernelOp) -> Result<crate::KernelOpResult, String> {
    use crate::{KernelOp, KernelOpResult};
    let client = shared();
    Ok(match op {
        KernelOp::CredentialList => KernelOpResult::CredentialReading { data: client.list(cwd)? },
        KernelOp::CredentialDiscover => KernelOpResult::CredentialReading { data: client.discover_keys(cwd)? },
        KernelOp::CredentialSetup { credential, reference, material } => KernelOpResult::CredentialChanged { data: client.setup(cwd, &credential, reference.as_deref(), material.as_ref())? },
        KernelOp::CredentialRotate { credential, reference, material } => KernelOpResult::CredentialChanged { data: client.rotate(cwd, &credential, reference.as_deref(), material.as_ref())? },
        KernelOp::CredentialVerify { credential } => KernelOpResult::CredentialVerified { data: client.verify(cwd, &credential)? },
        KernelOp::CredentialRevoke { credential } => KernelOpResult::CredentialChanged { data: client.revoke(cwd, &credential)? },
        KernelOp::ClientInstall { client: name } => KernelOpResult::ClientInstalled { data: client.client_install(cwd, &name)? },
        _ => return Err("not a credential operation".into()),
    })
}

/// `credential:<provider>` or the bare provider id the owner also accepts.
fn credential_ref(raw: &str) -> Result<String, String> {
    let raw = raw.trim();
    let name = raw.strip_prefix("credential:").unwrap_or(raw);
    let valid = !name.is_empty()
        && name.len() <= 96
        && name.chars().next().is_some_and(|c| c.is_ascii_alphanumeric())
        && name.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.'));
    if !valid {
        return Err("A credential is named by its provider (for example credential:openrouter)".into());
    }
    Ok(raw.to_owned())
}

/// A stored-secret reference: one of the owner's declared schemes, with a
/// location after it. A reference names where material lives; it is never
/// material itself.
fn secret_reference(raw: &str) -> Result<String, String> {
    let scheme = REFERENCE_SCHEMES.iter().find(|scheme| raw.starts_with(**scheme));
    match scheme {
        Some(scheme) if raw.len() > scheme.len() && !raw.chars().any(char::is_whitespace) => Ok(raw.to_owned()),
        _ => Err(format!(
            "A stored secret is named by its location: {}",
            REFERENCE_SCHEMES.join(" · ")
        )),
    }
}

/// Unwrap the owner's `{ok, data}` envelope. A refusal carries the owner's
/// message; stderr is used only when stdout held no envelope.
fn envelope(stdout: &[u8], stderr: &[u8], success: bool) -> Result<Value, String> {
    match serde_json::from_slice::<Value>(stdout) {
        Ok(value) if value.get("ok").and_then(Value::as_bool) == Some(true) => {
            let mut data = value.get("data").cloned().unwrap_or(Value::Null);
            if let (Some(object), Some(warnings)) = (data.as_object_mut(), value.get("warnings")) {
                object.entry("warnings").or_insert_with(|| warnings.clone());
            }
            Ok(data)
        }
        Ok(value) if value.get("ok").and_then(Value::as_bool) == Some(false) => {
            let message = value["error"]["message"].as_str().unwrap_or("AIKit refused the credential operation");
            Err(message.to_owned())
        }
        _ if success => Err("AIKit answered the credential operation without a readable result".into()),
        _ => {
            let text = String::from_utf8_lossy(stderr);
            let line = text.lines().rev().find(|line| !line.trim().is_empty()).unwrap_or("AIKit refused the credential operation");
            Err(line.trim().to_owned())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::os::unix::fs::PermissionsExt;

    /// A stub `aikit` that records argv, the environment's key names and
    /// whatever arrives on stdin, then answers from the scene body.
    struct Scene {
        dir: PathBuf,
        executable: PathBuf,
    }

    impl Scene {
        fn with(body: &str) -> Self {
            use std::sync::atomic::{AtomicUsize, Ordering};
            static SCENE: AtomicUsize = AtomicUsize::new(0);
            let dir = std::env::temp_dir().join(format!("oi-cradle-credentials-{}-{}", std::process::id(), SCENE.fetch_add(1, Ordering::Relaxed)));
            std::fs::create_dir_all(&dir).unwrap();
            let log = dir.join("argv.log").display().to_string();
            let stdin_log = dir.join("stdin.log").display().to_string();
            let env_log = dir.join("env.log").display().to_string();
            let script = format!(
                "#!/bin/sh\nprintf '%s\\n' \"$*\" >> {log}\nenv >> {env_log}\ncase \"$*\" in *--stdin*) cat >> {stdin_log};; esac\n{body}\n"
            );
            let executable = dir.join("aikit");
            std::fs::write(&executable, script).unwrap();
            std::fs::set_permissions(&executable, std::fs::Permissions::from_mode(0o755)).unwrap();
            for _ in 0..50 {
                match Command::new(&executable).arg("--settle").stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null()).status() {
                    Ok(_) => break,
                    Err(error) if error.kind() == std::io::ErrorKind::ExecutableFileBusy => std::thread::sleep(std::time::Duration::from_millis(2)),
                    Err(error) => panic!("cannot settle the stub: {error}"),
                }
            }
            let _ = std::fs::remove_file(dir.join("argv.log"));
            let _ = std::fs::remove_file(dir.join("env.log"));
            Self { dir, executable }
        }
        fn client(&self) -> Client {
            Client::with(self.executable.clone(), false)
        }
        fn read(&self, name: &str) -> String {
            std::fs::read_to_string(self.dir.join(name)).unwrap_or_default()
        }
    }

    impl Drop for Scene {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.dir);
        }
    }

    const OK: &str = r#"printf '%s' '{"ok":true,"schema":1,"data":{"bindings":[],"verdict":"refused","findings":[]},"warnings":["w"]}'"#;
    const HELP_WITH_STDIN: &str = r#"case "$*" in *--help*) echo "      --stdin   Read the key from standard input"; exit 0;; esac"#;

    #[test]
    fn pasted_material_crosses_on_stdin_only_never_argv_or_env() {
        let scene = Scene::with(&format!("{HELP_WITH_STDIN}\n{OK}"));
        let secret = SecretMaterial::new("sk-walk-dummy-4242");
        scene.client().setup(&scene.dir, "credential:anthropic", None, Some(&secret)).unwrap();
        assert_eq!(scene.read("stdin.log"), "sk-walk-dummy-4242\n");
        let argv = scene.read("argv.log");
        assert!(argv.contains("credential setup credential:anthropic --headless --json --stdin"), "{argv}");
        assert!(!argv.contains("sk-walk-dummy"), "material reached argv: {argv}");
        assert!(!scene.read("env.log").contains("sk-walk-dummy"), "material reached the environment");
    }

    #[test]
    fn material_is_refused_before_spawning_when_the_owner_cannot_read_stdin() {
        let scene = Scene::with(&format!("case \"$*\" in *--help*) echo 'Usage: setup'; exit 0;; esac\n{OK}"));
        let secret = SecretMaterial::new("sk-walk-dummy-4242");
        let error = scene.client().setup(&scene.dir, "anthropic", None, Some(&secret)).unwrap_err();
        assert!(error.contains("--stdin") && error.contains("not saved"), "{error}");
        assert!(!error.contains("sk-walk-dummy"));
        let argv = scene.read("argv.log");
        assert!(argv.lines().all(|line| line.contains("--help")), "only the capability probe ran: {argv}");
        assert_eq!(scene.read("stdin.log"), "");
    }

    #[test]
    fn a_reference_travels_as_the_owners_ref_argument() {
        let scene = Scene::with(OK);
        scene.client().setup(&scene.dir, "credential:deepseek", Some(" varlock:///tmp/v/.env/KEY "), None).unwrap();
        let argv = scene.read("argv.log");
        assert!(argv.contains("credential setup credential:deepseek --headless --json --ref varlock:///tmp/v/.env/KEY"), "{argv}");
        let refused = scene.client().setup(&scene.dir, "credential:deepseek", Some("file:///KEY"), None).unwrap_err();
        assert!(refused.contains("keychain://"), "{refused}");
        scene.client().setup(&scene.dir, "credential:deepseek", Some("env://DEEPSEEK_API_KEY"), None).unwrap();
        assert!(scene.read("argv.log").contains("credential setup credential:deepseek --headless --json --from-env --env-var DEEPSEEK_API_KEY"));
        assert!(scene.client().setup(&scene.dir, "credential:deepseek", Some("env://BAD NAME"), None).is_err());
        let both = scene.client().setup(&scene.dir, "x", Some("pass://a"), Some(&SecretMaterial::new("k"))).unwrap_err();
        assert!(both.contains("not both"));
    }

    #[test]
    fn material_is_redacted_in_debug_and_serialisation() {
        let secret = SecretMaterial::new("sk-walk-dummy-4242");
        assert!(!format!("{secret:?}").contains("sk-walk"));
        assert_eq!(serde_json::to_string(&secret).unwrap(), "\"[redacted]\"");
        let parsed: SecretMaterial = serde_json::from_str("\"abc\"").unwrap();
        assert_eq!(parsed.expose(), "abc");
    }

    #[test]
    fn verify_revoke_list_discover_and_install_run_the_owner_verbs() {
        let scene = Scene::with(OK);
        let client = scene.client();
        assert_eq!(client.verify(&scene.dir, "openrouter").unwrap()["verdict"], "refused");
        client.revoke(&scene.dir, "credential:openrouter").unwrap();
        let listed = client.list(&scene.dir).unwrap();
        assert_eq!(listed["material_entry"]["available"], false);
        assert!(listed["material_entry"]["missing"].as_str().unwrap().contains("--stdin"));
        client.discover_keys(&scene.dir).unwrap();
        client.client_install(&scene.dir, "pi").unwrap();
        assert!(client.client_install(&scene.dir, "pi; rm -rf /").is_err());
        let argv = scene.read("argv.log");
        for expected in ["credential verify openrouter --json", "credential revoke credential:openrouter --json", "credential list --json", "credential discover --json", "client install pi --json"] {
            assert!(argv.contains(expected), "{expected} missing from {argv}");
        }
    }

    #[test]
    fn an_owner_refusal_travels_in_its_own_words() {
        let scene = Scene::with(r#"printf '%s' '{"ok":false,"schema":1,"error":{"code":"credential.verify_unbound","message":"no binding exists for credential:zai"}}'; exit 1"#);
        let error = scene.client().verify(&scene.dir, "credential:zai").unwrap_err();
        assert_eq!(error, "no binding exists for credential:zai");
        assert!(credential_ref("bad name").is_err());
    }
}
