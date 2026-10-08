//! Candidate bootstrap over the real Cradle kernel. Byte qualification happens
//! before owner discovery; installed functional acceptance remains a separate gate.
use serde::Deserialize;

#[derive(Deserialize)]
#[serde(tag = "kind", rename_all = "lowercase", deny_unknown_fields)]
pub enum ReadRequest {
    Summary { path: String },
    Document { path: String },
    Set { path: String },
}

#[cfg(feature = "native_shell")]
#[path = "../../../../packages/live-shell/src/api.rs"]
mod api;
#[cfg(feature = "native_shell")]
#[path = "../../../../packages/live-shell/src/inhabitants.rs"]
mod inhabitants;
#[cfg(feature = "native_shell")]
#[path = "../../../../packages/live-shell/src/runtime.rs"]
pub mod runtime;

#[cfg(feature = "native_shell")]
mod candidate {
    use super::runtime;
    use serde_json::{json, Value};
    use std::collections::BTreeMap;
    use std::fs;
    use std::path::{Path, PathBuf};
    use std::sync::OnceLock;

    pub static PAYLOAD: OnceLock<runtime::QualifiedPayload> = OnceLock::new();
    static RUNTIME: OnceLock<Value> = OnceLock::new();
    // Product namespace aliases are the native explicit override contracts,
    // not a second capability catalogue.
    const OWNERS: &[(&str, &str, &str, &str)] = &[
        ("central", "ctrl", "OI_CENTRAL_CTRL_BIN", "Central"),
        ("actuation", "actuation", "OI_ACTUATION_BIN", "Actuation"),
        ("ai-kit", "aikit", "OI_AIKIT_BIN", "AIKit"),
        (
            "software-factory",
            "factory",
            "OI_FACTORY_BIN",
            "Software Factory",
        ),
        ("workcell", "workcell", "OI_WORKCELL_BIN", "Workcell"),
        ("quaternal-logic", "ql", "OI_QL_BIN", "Quaternal Logic"),
    ];

    pub fn binary(
        payload: &runtime::QualifiedPayload,
        owner: &str,
        name: &str,
        absent: &Path,
    ) -> PathBuf {
        payload
            .product_executables
            .get(owner)
            .and_then(|paths| {
                paths
                    .iter()
                    .find(|p| p.file_name().is_some_and(|n| n == name))
            })
            .cloned()
            .unwrap_or_else(|| absent.join(name))
    }

    fn write_atomic(path: &Path, value: &Value) -> Result<(), String> {
        let temporary = path.with_extension(format!("{}.tmp", std::process::id()));
        let bytes = serde_json::to_vec_pretty(value).map_err(|e| e.to_string())?;
        fs::write(&temporary, bytes).map_err(|e| e.to_string())?;
        fs::rename(&temporary, path).map_err(|e| e.to_string())
    }

    fn admit_contributions(
        root: &Path,
        payload: &runtime::QualifiedPayload,
    ) -> Result<Vec<Value>, String> {
        let directory = root.join("Contents/Resources/live-shell-contributions");
        let index: Value = runtime::unique_json(
            &fs::read(directory.join("index.json")).map_err(|e| e.to_string())?,
        )?;
        if index["schema"] != "oi.live-shell-contributions/v1" {
            return Err("Candidate has no reviewed native contribution build".into());
        }
        let mut readings = Vec::new();
        let mut identities = std::collections::BTreeSet::new();
        for contribution in index["contributions"]
            .as_array()
            .ok_or("Candidate contribution index is unavailable")?
        {
            let reference = contribution["contribution_ref"]
                .as_str()
                .ok_or("Contribution identity is unavailable")?;
            let owner = contribution["owner"]
                .as_str()
                .ok_or("Contribution owner is unavailable")?;
            let relative = Path::new(
                contribution["manifest"]
                    .as_str()
                    .ok_or("Contribution manifest is unavailable")?,
            );
            if !identities.insert(reference)
                || relative.as_os_str().is_empty()
                || !relative.components().all(|c| matches!(c, std::path::Component::Normal(_)))
            {
                return Err("Candidate contribution identity/path is invalid".into());
            }
            let manifest = directory.join(relative);
            let selected = owner == "oi" || payload.product_executables.contains_key(owner);
            let mut reading = json!({"contribution_ref":reference,"owner":owner,
                "revision":contribution["revision"],"compiled":true,"owner_selected":selected});
            if !selected {
                reading["registration"] = json!("excluded");
                readings.push(reading);
                continue;
            }
            // The native owner validates and persists data only. This does not
            // import executable code or claim that its operations are live.
            let registered = (|| -> Result<Value, String> {
                let output = std::process::Command::new(&payload.suite_cli)
                    .args(["contribution", "register"])
                    .arg(&manifest)
                    .stdin(std::process::Stdio::null())
                    .output()
                    .map_err(|e| e.to_string())?;
                if !output.status.success() {
                    return Err(String::from_utf8_lossy(&output.stderr).trim().to_owned());
                }
                let receipt: Value = runtime::unique_json(&output.stdout)?;
                if receipt["schema"] != "oi.hosted-registration/v1"
                    || receipt["activation"] != "requires-reviewed-rebuild"
                    || receipt["document"]["contribution_ref"] != reference
                    || receipt["document"]["owner"] != owner
                    || receipt["document"]["revision"] != contribution["revision"]
                {
                    return Err("Native contribution registration returned a different identity".into());
                }
                Ok(receipt)
            })();
            match registered {
                Ok(receipt) => {
                    reading["registration"] = json!("registered");
                    reading["receipt"] = receipt;
                }
                Err(error) => {
                    reading["registration"] = json!("failed");
                    reading["failure"] = json!(error);
                }
            }
            readings.push(reading);
        }
        Ok(readings)
    }

    pub fn prepare() -> Result<(), String> {
        let executable = std::env::current_exe()
            .map_err(|e| e.to_string())?
            .canonicalize()
            .map_err(|e| e.to_string())?;
        let root = executable
            .parent()
            .and_then(Path::parent)
            .and_then(Path::parent)
            .ok_or("Candidate executable is outside its native .app")?;
        if root.extension().is_none_or(|e| e != "app") {
            return Err("Candidate must launch from its relocatable native .app".into());
        }
        let footprint = fs::read(root.join("Contents/Resources/live-shell-footprint.json"))
            .map_err(|e| e.to_string())?;
        let native: Value = runtime::unique_json(&footprint)?;
        if native["app_id"] != "org.epilogos.oi.live-shell" {
            return Err("Candidate footprint identity mismatch".into());
        }
        let seal = std::process::Command::new("/usr/bin/codesign")
            .args(["--verify", "--strict", "--all-architectures"])
            .arg(root)
            .output()
            .map_err(|e| e.to_string())?;
        if !seal.status.success() {
            return Err(format!(
                "Native candidate resource seal is invalid: {}",
                String::from_utf8_lossy(&seal.stderr)
            ));
        }
        if !root.join("Contents/_CodeSignature/CodeResources").is_file() {
            return Err("Native candidate has no final resource seal".into());
        }
        let payload = runtime::qualify(root, &footprint)?;
        let shared_field_client = root.join("Contents/Resources/shared-field/field-client.sh");
        if !shared_field_client.is_file() {
            return Err("Candidate has no bundled native SharedField client".into());
        }
        std::env::set_var("OI_SHARED_FIELD_CLIENT", shared_field_client);
        std::env::set_var("OI_NODE", &payload.application_node);
        std::env::remove_var("NODE_OPTIONS");
        std::env::remove_var("NODE_PATH");
        std::env::remove_var("OI_SHARED_FIELD_ENTRY");
        if payload.native_host != executable
            || payload.suite_cli != root.join("Contents/Resources/live-shell/bin/oi")
        {
            return Err("This process is not the qualified native host/suite CLI".into());
        }
        let home = std::env::var_os("HOME")
            .map(PathBuf::from)
            .ok_or("Candidate needs the native user's HOME")?;
        // Backing-specific state prevents a full bundle's registrations leaking
        // into a smaller candidate. Retained product homes/ground stay native.
        let candidate_home = home
            .join(".config/oi-shell-candidate")
            .join(payload.backing_id.replace('/', "-"));
        let data_home = home
            .join("Library/Application Support/OI-Shell-Candidate")
            .join(payload.backing_id.replace('/', "-"));
        fs::create_dir_all(&candidate_home).map_err(|e| e.to_string())?;
        let cache_home = data_home.join("caches");
        fs::create_dir_all(&cache_home).map_err(|e| e.to_string())?;
        let cache_root = cache_home.canonicalize().map_err(|e| e.to_string())?;
        // The native CLI and human entries share this host's existing owner
        // transport. A candidate must not compete for the daily cradle socket.
        let expression_socket =
            oi_cradle_kernel::expression_transport::socket_path_for_directory(&data_home)?;
        std::env::set_var("OI_EXPRESSION_SOCKET", &expression_socket);
        for (owner, bindings) in &payload.product_runtime {
            for (name, binding) in bindings {
                let path = match binding {
                    runtime::QualifiedRuntimeBinding::Executable(path) => path.clone(),
                    runtime::QualifiedRuntimeBinding::Cache(relative) => {
                        let path = cache_home.join(owner).join(relative);
                        fs::create_dir_all(&path).map_err(|e| e.to_string())?;
                        let path = path.canonicalize().map_err(|e| e.to_string())?;
                        if !path.starts_with(&cache_root) {
                            return Err(
                                "Native owner cache escapes the isolated candidate profile".into(),
                            );
                        }
                        path
                    }
                };
                std::env::set_var(name, path);
            }
        }
        // The owner-exported sky payload also uses XDG_CACHE_HOME for its
        // extracted immutable source. Generated cache bytes stay outside the
        // sealed application and the owner's daily installation.
        std::env::set_var("XDG_CACHE_HOME", &cache_root);
        if payload.product_executables.contains_key("quaternal-logic") {
            std::env::set_var("PYTHONNOUSERSITE", "1");
            std::env::set_var("PYTHONDONTWRITEBYTECODE", "1");
            std::env::remove_var("PYTHONPYCACHEPREFIX");
            std::env::remove_var("PYTHONPATH");
            std::env::remove_var("PYTHONHOME");
        }
        if !payload.product_executables.contains_key("quaternal-logic") {
            for name in ["QL_SKY_PYTHON", "QL_NARA_PYTHON", "QL_NARA_PROVIDER_CACHE"] {
                std::env::remove_var(name);
            }
        }
        let composition_path = candidate_home.join("composition.json");
        let mut composition = if composition_path.exists() {
            runtime::unique_json::<Value>(&fs::read(&composition_path).map_err(|e| e.to_string())?)?
        } else {
            json!({"schema":1})
        };
        if composition["schema"] != 1 {
            return Err("Candidate native composition schema mismatch".into());
        }
        let native_home = std::env::var_os("OI_HOME")
            .filter(|v| !v.is_empty())
            .map(PathBuf::from);
        let native_composition = native_home
            .as_ref()
            .map(|p| p.join("composition.json"))
            .unwrap_or_else(|| {
                std::env::var_os("XDG_CONFIG_HOME")
                    .map(PathBuf::from)
                    .unwrap_or_else(|| home.join(".config"))
                    .join("oi/composition.json")
            });
        let adopted = if native_composition.is_file() && native_composition != composition_path {
            runtime::unique_json::<Value>(
                &fs::read(native_composition).map_err(|e| e.to_string())?,
            )?
        } else {
            json!({})
        };
        let personal_ground = std::env::var_os("OI_CENTRAL_ROOT")
            .filter(|v| !v.is_empty())
            .map(PathBuf::from)
            .or_else(|| composition["personal_ground"].as_str().map(PathBuf::from))
            .or_else(|| adopted["personal_ground"].as_str().map(PathBuf::from));
        let resolved_ground = personal_ground
            .as_ref()
            .filter(|p| p.is_absolute() && p.is_dir());
        if let Some(ground) = resolved_ground {
            std::env::set_var("OI_CENTRAL_ROOT", ground);
        } else {
            std::env::remove_var("OI_CENTRAL_ROOT");
        }
        let owner_home = std::env::var_os("OI_EXPRESSION_HOME")
            .filter(|v| !v.is_empty())
            .map(PathBuf::from)
            .or_else(|| composition["owner_home"].as_str().map(PathBuf::from))
            .or_else(|| native_home.clone())
            .unwrap_or_else(|| home.join(".oi"));
        if !owner_home.is_absolute()
            || owner_home.starts_with(home.join(".config/oi-shell-candidate"))
        {
            return Err(
                "Retained Expression owner home must remain distinct from candidate configuration"
                    .into(),
            );
        }
        std::env::set_var("OI_EXPRESSION_HOME", &owner_home);
        // Keep an explicitly selected authored-work location through an ordinary
        // Finder launch, application restart and update, using this same config.
        composition["owner_home"] = json!(owner_home);
        let identity_config = candidate_home.join("saved-work.json");
        if !identity_config.exists() {
            if let Some(import) =
                std::env::var_os("LIVE_SHELL_IMPORT_SAVED_WORK_CONFIG").filter(|v| !v.is_empty())
            {
                let import = PathBuf::from(import);
                if !import.is_absolute() {
                    return Err(
                        "Saved-work identity adoption requires an explicit absolute native path"
                            .into(),
                    );
                }
                std::env::set_var("LIVE_SHELL_SAVED_WORK_CONFIG", &import);
                super::inhabitants::configured_works()?;
                fs::copy(import, &identity_config).map_err(|e| e.to_string())?;
            }
        }
        if identity_config.exists() {
            std::env::set_var("LIVE_SHELL_SAVED_WORK_CONFIG", &identity_config);
        } else {
            std::env::remove_var("LIVE_SHELL_SAVED_WORK_CONFIG");
        }
        super::inhabitants::configured_works()?;
        let absent = root.join("Contents/Resources/live-shell/unavailable");
        if absent.exists() {
            return Err("Candidate unavailable sentinel directory must not exist".into());
        }
        let mut modules = BTreeMap::new();
        let mut catalogue: Value =
            runtime::unique_json(&fs::read(&payload.catalogue).map_err(|e| e.to_string())?)?;
        let surfaces = catalogue["surfaces"]
            .as_array_mut()
            .ok_or("Native catalogue has no surfaces")?;
        for (owner, name, key, public_name) in OWNERS {
            let path = binary(&payload, owner, name, &absent);
            if payload.product_executables.contains_key(*owner) && !path.is_file() {
                return Err(format!("Selected owner has no native entry: {owner}"));
            }
            std::env::set_var(key, &path);
            let surface = surfaces
                .iter_mut()
                .find(|s| s["id"] == *owner)
                .ok_or_else(|| format!("Native catalogue misses {owner}"))?;
            surface["native"]["executable"] = json!(path);
            if payload.product_executables.contains_key(*owner) {
                modules.insert(*owner,json!({"id":owner,"public_name":public_name,"native_executable":path,"docs":surface["docs_path"],"modality":"unknown","install_source":"live-shell-qualified-payload"}));
            }
        }
        for (name, key) in [
            ("ql-sky", "OI_QL_SKY_BIN"),
            ("ql-field-host", "OI_QL_FIELD_HOST_BIN"),
            ("ql-field-worker", "OI_QL_FIELD_WORKER_BIN"),
            ("ql-focused-host", "OI_QL_FOCUSED_HOST_BIN"),
        ] {
            std::env::set_var(key, binary(&payload, "quaternal-logic", name, &absent));
        }
        let catalogue_path = candidate_home.join("catalogue.json");
        write_atomic(&catalogue_path, &catalogue)?;
        composition["modules"] = serde_json::to_value(modules).map_err(|e| e.to_string())?;
        if let Some(ground) = &personal_ground {
            composition["personal_ground"] = json!(ground);
        }
        write_atomic(&composition_path, &composition)?;
        std::env::set_var("OI_HOME", &candidate_home);
        std::env::set_var("OI_DATA_HOME", &data_home);
        std::env::set_var("OI_CATALOG", &catalogue_path);
        std::env::set_var("OI_BIN", &payload.suite_cli);
        let contributions = admit_contributions(root, &payload)?;
        RUNTIME.set(json!({"runtime_epoch":uuid::Uuid::new_v4().to_string(),"owner_home":owner_home,"expression_socket":expression_socket,"configuration_home":candidate_home,"composition_path":composition_path,"saved_work_config":identity_config,"contributions":contributions})).map_err(|_|"Native runtime already initialized")?;
        PAYLOAD
            .set(payload)
            .map_err(|_| "Candidate bootstrap already ran".to_string())
    }

    pub fn config() -> Result<Value, String> {
        let payload = PAYLOAD
            .get()
            .ok_or("Native candidate has not qualified its payload")?;
        let runtime = RUNTIME.get().ok_or("Native runtime is unbound")?;
        let composition: Value = runtime::unique_json(
            &fs::read(
                runtime["composition_path"]
                    .as_str()
                    .ok_or("Native composition path is unbound")?,
            )
            .map_err(|e| e.to_string())?,
        )?;
        let ground = composition["personal_ground"]
            .as_str()
            .filter(|p| Path::new(p).is_absolute() && Path::new(p).is_dir());
        let world_scope = if let Some(path) = ground {
            let world = runtime::current_world(&payload.suite_cli)?;
            let actual = world["personal_ground"]
                .as_str()
                .ok_or("Native CurrentWorld has no configured personal ground")?;
            if Path::new(actual)
                .canonicalize()
                .map_err(|e| e.to_string())?
                != Path::new(path).canonicalize().map_err(|e| e.to_string())?
            {
                return Err("Native CurrentWorld belongs to a different personal ground".into());
            }
            Some(
                json!({"owner":"central","world":"control:root","personal_ground":actual,
                "workcell_ref":world["current_machine"]["workcell_ref"],
                "current_machine":world["current_machine"],"warnings":world["warnings"]}),
            )
        } else {
            None
        };
        let mut result =
            json!({"default_set":std::env::var("LIVE_SHELL_DEFAULT_SET").unwrap_or_default(),"saved_works":super::inhabitants::configured_works()?,"kernel_transport":{"kind":"tauri","invoke":"kernel_op"},"kernel_epoch":runtime["runtime_epoch"],"runtime_epoch":runtime["runtime_epoch"],"runtime_scope":{"kind":"host-runtime","epoch":runtime["runtime_epoch"]},"profile_scope":{"backing_id":payload.backing_id,"configuration_home":runtime["configuration_home"],"active_profile":composition["active_profile"]},"personal_ground":ground,"onboarding":ground.is_none(),"world_scope":world_scope,"saved_work_config":runtime["saved_work_config"],"expressions_entry":"/__application/expressions/index.html","backing_id":payload.backing_id,"product_ids":payload.product_ids,"source_revision":payload.source_revision,"source_tree_sha256":payload.source_tree_sha256,"acceptance":"qualified-bytes; native-functional-acceptance-separate"});
        result["contributions"] = runtime["contributions"].clone();
        result["expression_transport"] =
            json!({"kind":"unix","socket":runtime["expression_socket"]});
        result["source_dirty"] = json!(payload.source_dirty);
        Ok(result)
    }

    pub fn attach_act_store(kernel: &mut oi_cradle_kernel::Kernel) -> Result<(), String> {
        let home = RUNTIME
            .get()
            .and_then(|v| v["owner_home"].as_str())
            .ok_or("Native Expression owner home is unavailable")?;
        kernel.attach_act_store(Path::new(home))
    }
}

#[cfg(feature = "native_shell")]
pub use candidate::attach_act_store;
#[cfg(feature = "native_shell")]
pub use candidate::prepare;

#[cfg(any(test, feature = "native_shell"))]
fn candidate_asset_view_allowed(
    label: &str,
    registered: bool,
    scheme: &str,
    host: Option<&str>,
    path: &str,
) -> bool {
    let owner = label == "main" || (label.starts_with("surface-") && registered);
    let bundled_origin = (scheme == "tauri" && host == Some("localhost"))
        || (matches!(scheme, "http" | "https") && host == Some("tauri.localhost"));
    owner && bundled_origin && matches!(path, "/app/index.html" | "/app/")
}

#[cfg(feature = "native_shell")]
pub(crate) fn admit_candidate_webview(webview: &tauri::WebviewWindow) -> Result<(), String> {
    use tauri::Manager;
    let label = webview.label();
    let registered = if label.starts_with("surface-") {
        webview
            .app_handle()
            .state::<crate::windows::Windows>()
            .0
            .lock()
            .map_err(|_| "Window state unavailable")?
            .contains_key(label)
    } else {
        false
    };
    let url = webview.url().map_err(|e| e.to_string())?;
    if candidate_asset_view_allowed(label, registered, url.scheme(), url.host_str(), url.path()) {
        Ok(())
    } else {
        Err("Candidate reads require the bundled shell in its main or registered detached webview".into())
    }
}

// Standalone policy tests exercise this actual admission helper; native Tauri
// receiving/window creation remains part of installed candidate acceptance.
#[cfg(test)]
mod candidate_view_admission_tests {
    use super::candidate_asset_view_allowed;

    #[test]
    fn bundled_main_and_registered_detached_views_are_admitted() {
        assert!(candidate_asset_view_allowed("main", false, "tauri", Some("localhost"), "/app/index.html"));
        assert!(candidate_asset_view_allowed("surface-1", true, "tauri", Some("localhost"), "/app/index.html"));
        assert!(candidate_asset_view_allowed("surface-1", true, "http", Some("tauri.localhost"), "/app/"));
    }

    #[test]
    fn label_alone_does_not_grant_detached_admission() {
        assert!(!candidate_asset_view_allowed("surface-1", false, "tauri", Some("localhost"), "/app/index.html"));
        assert!(!candidate_asset_view_allowed("browser-1", true, "tauri", Some("localhost"), "/app/index.html"));
    }

    #[test]
    fn external_or_other_bundled_bodies_are_refused() {
        assert!(!candidate_asset_view_allowed("main", false, "https", Some("example.com"), "/app/index.html"));
        assert!(!candidate_asset_view_allowed("surface-1", true, "tauri", Some("localhost"), "/index.html"));
        assert!(!candidate_asset_view_allowed("surface-1", true, "tauri", Some("localhost"), "/__application/expressions/index.html"));
    }
}

#[tauri::command]
pub async fn live_shell_config(webview: tauri::WebviewWindow) -> Result<serde_json::Value, String> {
    #[cfg(feature = "native_shell")]
    admit_candidate_webview(&webview)?;
    #[cfg(not(feature = "native_shell"))]
    if webview.label() != "main" {
        return Err("Candidate configuration is scoped to the main shell webview".into());
    }
    #[cfg(feature = "native_shell")]
    {
        tauri::async_runtime::spawn_blocking(candidate::config).await.map_err(|error| error.to_string())?
    }
    #[cfg(not(feature = "native_shell"))]
    {
        Err("This native host was built without the shell candidate".into())
    }
}

#[tauri::command]
pub async fn live_shell_read(
    webview: tauri::WebviewWindow,
    request: ReadRequest,
) -> Result<serde_json::Value, String> {
    #[cfg(feature = "native_shell")]
    admit_candidate_webview(&webview)?;
    #[cfg(not(feature = "native_shell"))]
    if webview.label() != "main" {
        return Err("Live document reads are scoped to the main shell webview".into());
    }
    #[cfg(feature = "native_shell")]
    {
        if candidate::PAYLOAD.get().is_none() {
            return Err("Candidate payload is unqualified".into());
        }
        tauri::async_runtime::spawn_blocking(move || {
            let (path, kind) = match request {
                ReadRequest::Summary { path } => (path, "summary"),
                ReadRequest::Document { path } => (path, "document"),
                ReadRequest::Set { path } => (path, "set"),
            };
            let native = std::path::Path::new(&path);
            if !native.is_absolute() || native.extension().is_none_or(|e| e != "als") {
                return Err("Choose an absolute native .als document path".into());
            }
            if kind == "set" {
                return api::set_json(&path);
            }
            let bytes = std::fs::read(native).map_err(|e| e.to_string())?;
            let root = live_set::open_gz(&bytes).map_err(|e| e.to_string())?;
            if kind == "summary" {
                serde_json::to_value(
                    api::summary_json(&path, &root).ok_or("No LiveSet in native document")?,
                )
                .map_err(|e| e.to_string())
            } else {
                serde_json::to_value(
                    api::document_json(&path, &root).ok_or("No LiveSet in native document")?,
                )
                .map_err(|e| e.to_string())
            }
        })
        .await
        .map_err(|e| e.to_string())?
    }
    #[cfg(not(feature = "native_shell"))]
    {
        let _ = request;
        Err("This native host was built without the shell candidate".into())
    }
}

// Candidate application release: local document acknowledgements precede the
// stock process exit/restart. The everyday Cradle has no close coordinator.
#[cfg(feature = "native_shell")]
mod application_close {
    use std::{collections::{BTreeMap,BTreeSet},sync::{atomic::{AtomicU64,Ordering},Mutex},time::{Duration,Instant}};
    use tauri::{AppHandle,Emitter,Manager};
    // BEGIN native close reply state (standalone source-bound regression).
    #[derive(Clone,PartialEq,Eq)]
    struct Target { url:String, record:Option<String> }
    struct Pending { id:String, targets:BTreeMap<String,Target>, waiting:BTreeSet<String>, code:i32, restart:bool, deadline:Instant }
    impl Pending {
        fn validate_reply(&self,id:&str,label:&str,current:&BTreeMap<String,Target>)->Result<(),&'static str>{
            if self.id!=id{return Err("This application close request has retired");}
            if &self.targets!=current{return Err("Application view identity changed");}
            if !self.targets.contains_key(label){return Err("This view does not participate in the application checkpoint");}
            Ok(())
        }
        fn acknowledge(&mut self,label:&str)->Result<bool,&'static str>{
            if self.waiting.first().map(String::as_str)!=Some(label){return Err("This view is not the current application checkpoint participant");}
            self.waiting.remove(label);Ok(self.waiting.is_empty())
        }
    }
    // END native close reply state.

    #[derive(Default)]
    pub(crate) struct Coordinator(Mutex<State>);
    #[derive(Default)]
    struct State { pending:Option<Pending>, approved_exit:Option<i32>, watchdog_running:bool }

    #[cfg(test)]
    mod close_reply_state_tests {
        use super::*;
        fn pending()->Pending{
            let targets=BTreeMap::from([("main".into(),Target{url:"tauri://localhost/app/index.html".into(),record:None}),("surface-1".into(),Target{url:"tauri://localhost/app/index.html".into(),record:Some(r#"{"workspace_id":"w","binding":{"id":"b","kind":"source","ref":"central:source:control:root:Test.html"}}"#.into())})]);
            Pending{id:"close-1".into(),waiting:targets.keys().cloned().collect(),targets,code:0,restart:false,deadline:Instant::now()+Duration::from_secs(30)}
        }
        #[test]fn every_actual_target_must_acknowledge_once_in_order(){let mut p=pending();assert!(p.acknowledge("surface-1").is_err());assert!(!p.acknowledge("main").unwrap());assert!(p.acknowledge("main").is_err());assert!(p.acknowledge("surface-1").unwrap());assert!(p.acknowledge("surface-1").is_err());}
        #[test]fn request_and_sender_are_exact(){let p=pending();assert!(p.validate_reply("close-1","main",&p.targets).is_ok());assert!(p.validate_reply("close-0","main",&p.targets).is_err());assert!(p.validate_reply("close-1","surface-2",&p.targets).is_err());}
        #[test]fn changed_native_subject_or_url_refuses_the_held_batch(){let p=pending();let mut changed=p.targets.clone();changed.get_mut("surface-1").unwrap().record=Some("changed binding".into());assert!(p.validate_reply("close-1","main",&changed).is_err());let mut changed=p.targets.clone();changed.get_mut("main").unwrap().url="https://example.com".into();assert!(p.validate_reply("close-1","main",&changed).is_err());}
        #[test]fn new_or_disappeared_registered_view_requires_another_attempt(){let p=pending();let mut changed=p.targets.clone();changed.remove("surface-1");assert!(p.validate_reply("close-1","main",&changed).is_err());let mut changed=p.targets.clone();changed.insert("surface-2".into(),p.targets["surface-1"].clone());assert!(p.validate_reply("close-1","main",&changed).is_err());}
    }
    static NEXT:AtomicU64=AtomicU64::new(1);
    fn targets(app:&AppHandle)->Result<BTreeMap<String,Target>,String> {
        let records=app.state::<crate::windows::Windows>().0.lock().map_err(|_|"Registered window state unavailable")?.clone();
        if records.len()>63{return Err("Too many registered views for one bounded application checkpoint".into());}
        let mut labels=vec![("main".to_owned(),None)];
        for (label,record) in records {labels.push((label,Some(serde_json::to_string(&record).map_err(|e|e.to_string())?)));}
        let mut targets=BTreeMap::new();
        for (label,record) in labels {
            let view=app.get_webview_window(&label).ok_or_else(||format!("Registered view {label} is unavailable; keep the application open"))?;
            super::admit_candidate_webview(&view)?;
            targets.insert(label,Target{url:view.url().map_err(|e|e.to_string())?.to_string(),record});
        }
        Ok(targets)
    }
    fn report_request(app:&AppHandle,id:Option<&str>,error:String){
        let _=app.emit("oi:application-close-failed",serde_json::json!({"request_id":id,"error":error}));
        if let Some(main)=app.get_webview_window("main"){let _=main.set_focus();}
    }
    pub(crate) fn report(app:&AppHandle,error:String){report_request(app,None,error);}
    fn fail(app:&AppHandle,id:&str,error:String){
        let cleared=app.state::<Coordinator>().0.lock().map(|mut state|{
            if state.pending.as_ref().is_some_and(|pending|pending.id==id){state.pending=None;true}else{false}
        }).unwrap_or(false);
        if cleared{report_request(app,Some(id),error);}
    }
    pub(crate) fn approved(app:&AppHandle,code:Option<i32>)->bool {
        app.state::<Coordinator>().0.lock().map(|mut state|{
            if state.approved_exit==Some(code.unwrap_or(0)){state.approved_exit=None;true}else{false}
        }).unwrap_or(false)
    }
    fn dispatch(app:&AppHandle,id:&str,label:&str,target:&Target)->Result<(),String>{
        let record=target.record.as_ref().map(|value|serde_json::from_str::<serde_json::Value>(value)).transpose().map_err(|error|error.to_string())?;
        app.emit_to(label,"oi:application-close-checkpoint",serde_json::json!({"request_id":id,"label":label,"workspace_id":record.as_ref().and_then(|r|r["workspace_id"].as_str()),"binding_id":record.as_ref().and_then(|r|r["binding"]["id"].as_str())})).map_err(|error|error.to_string())
    }
    pub(crate) fn request(app:&AppHandle,code:i32,restart:bool)->Result<(),String>{
        {let owner=app.state::<Coordinator>();if owner.0.lock().map_err(|_|"Application close state unavailable")?.pending.is_some(){return Ok(());}}
        let targets=targets(app)?;
        let id=format!("close-{}",NEXT.fetch_add(1,Ordering::Relaxed));
        let start_watchdog={
            let owner=app.state::<Coordinator>();let mut state=owner.0.lock().map_err(|_|"Application close state unavailable")?;
            if state.pending.is_some(){return Ok(());}
            state.pending=Some(Pending{id:id.clone(),waiting:targets.keys().cloned().collect(),targets:targets.clone(),code,restart,deadline:Instant::now()+Duration::from_secs(30)});
            let start=!state.watchdog_running;state.watchdog_running=true;start
        };
        if start_watchdog {
            let handle=app.clone();std::thread::spawn(move||loop{
                std::thread::sleep(Duration::from_millis(250));
                let expired={
                    let owner=handle.state::<Coordinator>();let Ok(mut state)=owner.0.lock() else{return;};
                    match &state.pending {
                        Some(pending) if Instant::now()>=pending.deadline=>{let id=pending.id.clone();state.pending=None;state.watchdog_running=false;Some(id)}
                        Some(_)=>continue,
                        None=>{state.watchdog_running=false;return;}
                    }
                };
                if let Some(id)=expired{report_request(&handle,Some(&id),"Application close timed out while securing a document view. Keep the application open, resolve the local recovery error, then retry Quit or Restart.".into());return;}
            });
        }
        // Freeze all participating views before reading them serially. Each
        // view's original registry admits at most four physical frame reads.
        for label in targets.keys(){if let Err(error)=app.emit_to(label,"oi:application-close-freeze",serde_json::json!({"request_id":id,"label":label})){fail(app,&id,format!("Could not retain {label} during close: {error}"));return Ok(());}}
        if let Some((label,target))=targets.iter().next(){if let Err(error)=dispatch(app,&id,label,target){fail(app,&id,error);}}
        Ok(())
    }
    pub(crate) fn reply(app:&AppHandle,window:&tauri::WebviewWindow,id:&str,error:Option<String>)->Result<(),String>{
        super::admit_candidate_webview(window)?;
        let current=targets(app)?;
        let completed={
            let owner=app.state::<Coordinator>();let mut state=owner.0.lock().map_err(|_|"Application close state unavailable")?;
            let pending=state.pending.as_mut().ok_or("No application close checkpoint is pending")?;
            if let Err(error)=pending.validate_reply(id,window.label(),&current){
                if error=="Application view identity changed"{drop(state);fail(app,id,"Registered application views changed during close. Retry after the current view settles.".into());}
                return Err(error.into());
            }
            if let Some(error)=error {drop(state);fail(app,id,format!("{} could not secure its local work: {}. Keep the view open and retry after resolving the failure.",window.label(),error.chars().take(2048).collect::<String>()));return Ok(());}
            if pending.acknowledge(window.label())?{Some((pending.code,pending.restart))}else{
                let label=pending.waiting.first().expect("waiting view").clone();let target=pending.targets.get(&label).expect("registered waiting view").clone();
                drop(state);if let Err(error)=dispatch(app,id,&label,&target){fail(app,id,error);}
                None
            }
        };
        if let Some((code,restart))=completed{
            // The view acknowledgements secure xterm's serialized screen.
            // The actual owner also secures unread output from retained PTYs
            // whose disposable view was already released. No PTY is closed.
            let handle=app.clone();let request=id.to_owned();
            tauri::async_runtime::spawn(async move{
                let owner=handle.clone();
                let secured=tauri::async_runtime::spawn_blocking(move||crate::terminal::checkpoint_all(&owner)).await.map_err(|error|error.to_string()).and_then(|result|result);
                if let Err(error)=secured{fail(&handle,&request,error);return;}
                let current=match targets(&handle){Ok(current)=>current,Err(error)=>{fail(&handle,&request,error);return;}};
                let approved={
                    let owner=handle.state::<Coordinator>();let Ok(mut state)=owner.0.lock() else{return;};
                    let Some(pending)=state.pending.as_ref() else{return;};
                    if pending.id!=request{return;}
                    if pending.targets!=current||Instant::now()>=pending.deadline{drop(state);fail(&handle,&request,"Application identity changed or the terminal checkpoint timed out. Keep the application open and retry after it settles.".into());return;}
                    if !pending.waiting.is_empty(){return;}
                    state.pending=None;state.approved_exit=Some(if restart{tauri::RESTART_EXIT_CODE}else{code});true
                };
                if approved{if restart{handle.request_restart();}else{handle.exit(code);}}
            });
        }
        Ok(())
    }
}
#[cfg(feature = "native_shell")]
pub(crate) use application_close::{Coordinator as ApplicationClose,approved as close_approved,request as request_close,report as report_close_failure};

#[tauri::command]
pub fn live_shell_checkpoint_reply(app:tauri::AppHandle,webview:tauri::WebviewWindow,request_id:String,error:Option<String>)->Result<(),String>{
    #[cfg(feature = "native_shell")]
    {application_close::reply(&app,&webview,&request_id,error)}
    #[cfg(not(feature = "native_shell"))]
    {let _=(app,webview,request_id,error);Err("This host has no candidate application close coordinator".into())}
}
#[tauri::command]
pub fn live_shell_request_close(app:tauri::AppHandle,webview:tauri::WebviewWindow,restart:bool)->Result<(),String>{
    #[cfg(feature = "native_shell")]
    {admit_candidate_webview(&webview)?;if webview.label()!="main"{return Err("Application Quit and Restart belong to the main candidate window".into());}application_close::request(&app,0,restart)}
    #[cfg(not(feature = "native_shell"))]
    {let _=(app,webview,restart);Err("This host has no candidate application close coordinator".into())}
}

// Stable actual profile qualification; runtime epochs do not address archives.
#[cfg(feature="native_shell")]
pub(crate) fn terminal_profile_scope()->Result<serde_json::Value,String>{
    let config=candidate::config()?;
    let profile=config.get("profile_scope").ok_or("Candidate terminal profile scope unavailable")?;
    Ok(profile.clone())
}
