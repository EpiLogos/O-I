// S owns the default binding, Central owns recognition. No ground initialization occurs here.
const COMPOSITION_MAX_BYTES: u64 = 4 * 1024 * 1024;

fn composition_read_bytes(path: &Path) -> Result<Option<Vec<u8>>, String> {
    use std::io::Read;
    let metadata = match fs::symlink_metadata(path) {
        Ok(value) => value,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(format!("cannot inspect composition: {error}")),
    };
    if !metadata.is_file() || metadata.file_type().is_symlink() {
        return Err("composition must be a regular file, not a symlink".into());
    }
    let mut bytes = Vec::new();
    let mut options = fs::OpenOptions::new();
    options.read(true);
    #[cfg(unix)] {
        use std::os::unix::fs::OpenOptionsExt;
        #[cfg(target_os = "macos")] options.custom_flags(0x100);
        #[cfg(target_os = "linux")] options.custom_flags(0x20000);
    }
    let file = options.open(path).map_err(|e| e.to_string())?;
    if !file.metadata().map_err(|e| e.to_string())?.is_file() { return Err("composition is not a regular file".into()); }
    file.take(COMPOSITION_MAX_BYTES + 1)
        .read_to_end(&mut bytes).map_err(|e| e.to_string())?;
    if bytes.len() as u64 > COMPOSITION_MAX_BYTES { return Err("composition exceeds 4 MiB".into()); }
    Ok(Some(bytes))
}

fn composition_lock(path: &Path) -> Result<fs::File, String> {
    let parent = path.parent().ok_or("composition has no parent")?;
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    let lock_path = parent.join("composition.lock");
    let mut options = fs::OpenOptions::new();
    options.read(true).write(true).create(true);
    #[cfg(unix)] {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
        // O_NOFOLLOW; Linux and Darwin expose different native values.
        #[cfg(target_os = "macos")] options.custom_flags(0x100);
        #[cfg(target_os = "linux")] options.custom_flags(0x20000);
    }
    let lock = options.open(&lock_path).map_err(|e| format!("cannot open composition lock: {e}"))?;
    if !lock.metadata().map_err(|e| e.to_string())?.is_file() { return Err("composition lock is not a file".into()); }
    lock.lock().map_err(|e| format!("cannot lock composition: {e}"))?;
    Ok(lock)
}

fn composition_publish(path: &Path, expected: Option<&[u8]>, bytes: &[u8]) -> Result<(), String> {
    use std::io::Write;
    if bytes.len() as u64 > COMPOSITION_MAX_BYTES { return Err("composition exceeds 4 MiB".into()); }
    if composition_read_bytes(path)?.as_deref() != expected { return Err("composition conflict: state changed since it was read".into()); }
    let parent = path.parent().ok_or("composition has no parent")?;
    let nonce = SystemTime::now().duration_since(UNIX_EPOCH).map_err(|e| e.to_string())?.as_nanos();
    let temporary = parent.join(format!(".composition-{}-{nonce}.tmp", std::process::id()));
    let result = (|| {
        let mut options = fs::OpenOptions::new();
        options.write(true).create_new(true);
        #[cfg(unix)] { use std::os::unix::fs::OpenOptionsExt; options.mode(0o600); }
        let mut file = options.open(&temporary).map_err(|e| e.to_string())?;
        if expected.is_some() {
            #[cfg(target_os = "macos")] {
                use std::os::fd::AsRawFd;
                unsafe extern "C" { fn fcopyfile(from: i32, to: i32, state: *mut std::ffi::c_void, flags: u32) -> i32; }
                let source = fs::File::open(path).map_err(|e| e.to_string())?;
                // COPYFILE_METADATA = ACL | STAT | XATTR, without copying data.
                if unsafe { fcopyfile(source.as_raw_fd(), file.as_raw_fd(), std::ptr::null_mut(), 7) } != 0 {
                    return Err(format!("cannot preserve composition metadata: {}", std::io::Error::last_os_error()));
                }
            }
            let permissions = fs::metadata(path).map_err(|e| e.to_string())?.permissions();
            file.set_permissions(permissions).map_err(|e| format!("cannot preserve composition permissions: {e}"))?;
        }
        file.write_all(bytes).and_then(|_| file.sync_all()).map_err(|e| e.to_string())?;
        if composition_read_bytes(path)?.as_deref() != expected { return Err("composition conflict: state changed before publication".into()); }
        fs::rename(&temporary, path).map_err(|e| e.to_string())?;
        fs::File::open(parent).and_then(|directory| directory.sync_all())
            .map_err(|e| format!("composition published but directory durability confirmation failed: {e}"))?;
        Ok(())
    })();
    if result.is_err() { let _ = fs::remove_file(&temporary); }
    result
}

fn composition_save_cas(composition: &Composition) -> Result<(), String> {
    let path = state_path()?;
    let _lock = composition_lock(&path)?;
    let basis = composition.loaded_basis.borrow();
    let mut value = match basis.as_deref() {
        Some(bytes) => serde_json::from_slice::<serde_json::Value>(bytes).map_err(|e| e.to_string())?,
        None => json!({}),
    };
    let encoded = serde_json::to_value(composition).map_err(|e| e.to_string())?;
    let object = value.as_object_mut().ok_or("composition must be an object")?;
    // Preserve fields unknown to this S version, including native module extensions.
    if let Some(previous) = object.get_mut("modules").and_then(|v| v.as_object_mut()) {
        let modules = encoded["modules"].as_object().ok_or("invalid module map")?;
        previous.retain(|name, _| modules.contains_key(name));
        for (name, module) in modules {
            if let (Some(old), Some(new)) = (previous.get_mut(name).and_then(|v| v.as_object_mut()), module.as_object()) {
                for key in ["native_executable", "alias", "version", "skill", "root"] {
                    if !new.contains_key(key) { old.remove(key); }
                }
                for (key, item) in new { old.insert(key.clone(), item.clone()); }
            } else { previous.insert(name.clone(), module.clone()); }
        }
    } else { object.insert("modules".into(), encoded["modules"].clone()); }
    object.insert("schema".into(), encoded["schema"].clone());
    match &composition.personal_ground {
        Some(path) => { object.insert("personal_ground".into(), json!(path)); }
        None => { object.remove("personal_ground"); }
    }
    let bytes = serde_json::to_vec_pretty(&value).map_err(|e| e.to_string())?;
    composition_publish(&path, basis.as_deref(), &bytes)?;
    drop(basis);
    *composition.loaded_basis.borrow_mut() = Some(bytes);
    Ok(())
}

fn ground_owner_recognition(path: &str) -> Result<serde_json::Value, String> {
    let output = Command::new(env::current_exe().map_err(|e| e.to_string())?)
        .args(["central", "--json", "action", "run", "central.recognize"])
        .arg(json!({"path":path}).to_string()).output().map_err(|e| format!("Central recognition unavailable: {e}"))?;
    if !output.status.success() { return Err(format!("Central recognition failed: {}", String::from_utf8_lossy(&output.stderr))); }
    if output.stdout.len() > 1024 * 1024 { return Err("Central recognition response exceeds bound".into()); }
    let response: serde_json::Value = serde_json::from_slice(&output.stdout).map_err(|e| e.to_string())?;
    if response["ok"] != true || response["data"]["schema"] != "central.root-recognition/v1" {
        return Err("Central did not return a root recognition reading".into());
    }
    Ok(response["data"].clone())
}

fn ground_binding_value(bytes: Option<&[u8]>) -> Result<serde_json::Value, String> {
    let value = match bytes { Some(bytes) => serde_json::from_slice(bytes).map_err(|e| format!("invalid composition: {e}"))?, None => json!({"schema":1,"modules":{}}) };
    if value["schema"] != STATE_SCHEMA { return Err("unsupported composition schema".into()); }
    if !value["personal_ground"].is_null() && !value["personal_ground"].is_string() { return Err("invalid personal_ground binding".into()); }
    Ok(value)
}

fn command_ground_binding(args: &[OsString]) -> Result<i32, String> {
    let verb = args.first().and_then(|s| s.to_str());
    if matches!(verb, None | Some("--help") | Some("help")) {
        println!("oi ground status --json\noi ground bind --request-json JSON|@FILE [--json]");
        return Ok(0);
    }
    if verb == Some("status") && args[1..].iter().all(|a| a == "--json") {
        let bytes = composition_read_bytes(&state_path()?)?;
        let state = ground_binding_value(bytes.as_deref())?;
        println!("{}", json!({"schema":"oi.ground-binding/v1","personal_ground":state["personal_ground"]}));
        return Ok(0);
    }
    if verb != Some("bind") || args.get(1).and_then(|a| a.to_str()) != Some("--request-json") || args.len() < 3 || !args[3..].iter().all(|a| a == "--json") {
        return Err("usage: oi ground bind --request-json JSON|@FILE [--json]".into());
    }
    let request = args[2].to_str().ok_or("request must be UTF-8")?;
    let bytes = if let Some(path) = request.strip_prefix('@') {
        use std::io::Read;
        let mut bytes = Vec::new();
        fs::File::open(path).map_err(|e| e.to_string())?.take(65537).read_to_end(&mut bytes).map_err(|e| e.to_string())?;
        bytes
    } else { request.as_bytes().to_vec() };
    if bytes.len() > 65536 { return Err("binding request exceeds 64 KiB".into()); }
    let request: serde_json::Value = serde_json::from_slice(&bytes).map_err(|e| e.to_string())?;
    let expected = request.get("expected_previous").ok_or("expected_previous is required (string or explicit null)")?;
    if !expected.is_null() && !expected.is_string() { return Err("expected_previous must be string or null".into()); }
    let selected = request["canonical_path"].as_str().filter(|s| Path::new(s).is_absolute() && s.len() <= 16384).ok_or("canonical_path must be an absolute bounded path")?;
    for key in ["device", "inode"] {
        if request["identity"][key].as_str().filter(|s| !s.is_empty() && s.bytes().all(|b| b.is_ascii_digit())).is_none() { return Err(format!("identity.{key} must be an exact decimal string")); }
    }
    let path = state_path()?;
    let _lock = composition_lock(&path)?;
    let basis = composition_read_bytes(&path)?;
    let mut state = ground_binding_value(basis.as_deref())?;
    let previous = state["personal_ground"].clone();
    let result = if &previous != expected {
        json!({"outcome":"conflict","reason":"previous_binding_changed"})
    } else {
        let recognition = ground_owner_recognition(selected)?;
        if recognition["outcome"] != "recognized" || recognition["access"]["readable"] != true || recognition["access"]["searchable"] != true {
            json!({"outcome":"refused","reason":"ground_not_readable_and_recognized","recognition":recognition})
        } else if recognition["canonical_path"] != selected || recognition["identity"] != request["identity"] {
            json!({"outcome":"refused","reason":"ground_identity_changed","recognition":recognition})
        } else if previous == selected {
            json!({"outcome":"unchanged","recognition":recognition})
        } else {
            state["personal_ground"] = json!(selected);
            let bytes = serde_json::to_vec_pretty(&state).map_err(|e| e.to_string())?;
            composition_publish(&path, basis.as_deref(), &bytes)?;
            json!({"outcome":"bound","recognition":recognition})
        }
    };
    let mut result = result;
    result["schema"] = json!("oi.ground-binding/v1");
    result["previous"] = previous;
    result["personal_ground"] = state["personal_ground"].clone();
    result["ground_mutated"] = json!(false);
    result["takes_effect"] = json!("next-launch");
    println!("{result}");
    Ok(0)
}

#[cfg(test)]
mod ground_binding_tests {
    use super::*;
    #[test]
    fn composition_real_cas_preserves_extensions_and_clears_optional_fields() {
        let home = tempfile::tempdir().unwrap();
        if env::var_os("OI_GROUND_CAS_TEST_CHILD").is_none() {
            let status = Command::new(env::current_exe().unwrap())
                .args(["--exact", "composition::ground_binding_tests::composition_real_cas_preserves_extensions_and_clears_optional_fields", "--test-threads=1"])
                .env("OI_GROUND_CAS_TEST_CHILD", "1").env("OI_HOME", home.path()).status().unwrap();
            assert!(status.success());
            return;
        }
        let path = state_path().unwrap();
        let initial = json!({"schema":1,"personal_ground":"/old","future":{"keep":true},"modules":{"central":{"id":"central","public_name":"Central","docs":"docs","native_executable":"/old/ctrl","alias":"c","version":"v","skill":"s","root":"r","extension":{"keep":true}}}});
        fs::write(&path, serde_json::to_vec(&initial).unwrap()).unwrap();
        #[cfg(unix)] { use std::os::unix::fs::PermissionsExt; fs::set_permissions(&path, fs::Permissions::from_mode(0o640)).unwrap(); }
        let mut state = load_composition().unwrap();
        let stale = load_composition().unwrap();
        let registration = state.modules.get_mut("central").unwrap();
        registration.native_executable = None; registration.alias = None; registration.version = None; registration.skill = None; registration.root = None;
        save_composition(&state).unwrap();
        state.personal_ground = Some("/new".into());
        save_composition(&state).unwrap(); // same loaded instance can save repeatedly
        assert!(save_composition(&stale).unwrap_err().contains("conflict"));
        let value: serde_json::Value = serde_json::from_slice(&fs::read(&path).unwrap()).unwrap();
        assert_eq!(value["personal_ground"], "/new");
        assert_eq!(value["future"], initial["future"]);
        assert_eq!(value["modules"]["central"]["extension"], initial["modules"]["central"]["extension"]);
        for key in ["native_executable","alias","version","skill","root"] { assert!(value["modules"]["central"].get(key).is_none()); }
        #[cfg(unix)] { use std::os::unix::fs::PermissionsExt; assert_eq!(fs::metadata(&path).unwrap().permissions().mode() & 0o777, 0o640); }
        fs::remove_file(&path).unwrap();
        let absent = load_composition().unwrap();
        fs::write(&path, b"{}").unwrap();
        assert!(save_composition(&absent).unwrap_err().contains("conflict"));
        assert_eq!(fs::read(&path).unwrap(), b"{}");
    }
}
