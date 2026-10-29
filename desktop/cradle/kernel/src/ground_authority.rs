//! The person's key in a new world (O-I #740; manual §10.11 Ground: "Central keeps a key in this world so that only you act as you
//! here"). Central authenticates the person's own presses (a Day opened, a document kept, a Return denied) against its
//! native-action authority with the credential the host holds (`factory::host_native_token`: `CENTRAL_NATIVE_TOKEN`, else
//! `$HOME/.central/native-token`). A world Setup makes has neither, so nothing the person presses authenticates.
//!
//! This route makes the credential and has Central keep its grant, on Setup's held Ground Accept:
//!
//! - **Preview** asks Central what it would write (`central.ground.authority.preview`) for the world's person, and says whether a key
//!   can be kept here: only where the host's HOME is the chosen world's own folder (`OI_WORLD_FOLDER`), never the owner's real home.
//! - **Adopt** makes 32 random bytes into `$HOME/.central/native-token` (0600, its folder 0700) when no key stands there, and passes
//!   Central only its sha256 (`central.ground.authority.adopt`, on the preview's digest and the acceptance named). A ground that keeps
//!   an authority changes nothing. The key never leaves this process: no answer, log or receipt carries it or its digest.
use crate::flow::CentralClient;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::io::Write;
use std::os::unix::fs::{OpenOptionsExt, PermissionsExt};
use std::path::{Path, PathBuf};

pub const SCHEMA: &str = "oi.ground-authority/v1";
const PREVIEW: &str = "central.ground.authority.preview";
const ADOPT: &str = "central.ground.authority.adopt";
/// Where the host keeps the key, relative to HOME (`factory::host_native_token` reads it there).
pub const KEY_PATH: &str = ".central/native-token";

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(tag = "operation", rename_all = "snake_case", deny_unknown_fields)]
pub enum Request {
    Preview,
    Adopt {
        acceptance_ref: String,
        expected_digest: String,
    },
}

/// The world this host stands in: HOME, when it is the chosen world's own folder, and the person it names.
#[derive(Debug, PartialEq, Eq)]
pub struct World {
    pub home: PathBuf,
    pub principal_ref: String,
}
/// The world the host's environment names, or why a key is not kept here. Pure over the two readings.
pub fn world(home: Option<PathBuf>, folder: Option<PathBuf>) -> Result<World, String> {
    let folder = folder.filter(|f| !f.as_os_str().is_empty()).ok_or(
        "This window is not a world's own (OI_WORLD_FOLDER is not set): Central keeps your key only in a world's folder, never in your own home.",
    )?;
    let home = home
        .filter(|h| !h.as_os_str().is_empty())
        .ok_or("This window has no HOME: Central keeps no key here.")?;
    let (canonical_home, canonical_folder) = (
        std::fs::canonicalize(&home)
            .map_err(|e| format!("This window's HOME cannot be read: {e}"))?,
        std::fs::canonicalize(&folder)
            .map_err(|e| format!("The world's folder cannot be read: {e}"))?,
    );
    if canonical_home != canonical_folder {
        return Err("This window's HOME is not the world's folder: Central keeps your key only in the world's own folder.".into());
    }
    let name = canonical_folder
        .file_name()
        .and_then(|n| n.to_str())
        .filter(|n| !n.trim().is_empty())
        .ok_or("The world's folder has no name to keep a key under.")?;
    Ok(World {
        home: canonical_home,
        principal_ref: format!("human:{name}"),
    })
}
fn this_world() -> Result<World, String> {
    world(
        std::env::var_os("HOME").map(PathBuf::from),
        std::env::var_os("OI_WORLD_FOLDER").map(PathBuf::from),
    )
}

/// The key's sha256, making the key first where none stands: 32 random bytes, hex, written once (create-new, 0600) in a 0700 folder.
/// A key that stands is read, never replaced. The key itself is dropped here; only its digest leaves.
pub fn key_digest(home: &Path) -> Result<String, String> {
    let path = home.join(KEY_PATH);
    let token = match std::fs::read_to_string(&path) {
        Ok(text) => text.trim().to_owned(),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            let folder = path.parent().ok_or("The key has no folder.")?;
            std::fs::create_dir_all(folder)
                .map_err(|e| format!("Cannot make the key's folder: {e}"))?;
            std::fs::set_permissions(folder, std::fs::Permissions::from_mode(0o700))
                .map_err(|e| format!("Cannot close the key's folder: {e}"))?;
            let mut bytes = [0u8; 32];
            getrandom::fill(&mut bytes).map_err(|e| format!("Cannot make a key: {e}"))?;
            let token: String = bytes.iter().map(|b| format!("{b:02x}")).collect();
            let mut file = std::fs::OpenOptions::new()
                .write(true)
                .create_new(true)
                .mode(0o600)
                .open(&path)
                .map_err(|e| format!("Cannot keep the key: {e}"))?;
            file.write_all(token.as_bytes())
                .and_then(|()| file.sync_all())
                .map_err(|e| format!("Cannot keep the key: {e}"))?;
            token
        }
        Err(error) => return Err(format!("The key that stands cannot be read: {error}")),
    };
    if token.len() < 32 {
        return Err(format!("A key stands at ~/{KEY_PATH} that Central cannot take (shorter than 32 characters): mend it by hand. Nothing was sent."));
    }
    Ok(format!("{:x}", Sha256::digest(token.as_bytes())))
}

fn central(client: &CentralClient, action: &str, input: Value) -> Result<Value, String> {
    client.run(action, input).map_err(|e| e.to_string())
}
/// Preview or adopt the person's key in this world (`Request`), over Central and this host's environment.
pub fn operate(client: &CentralClient, request: &Request) -> Result<Value, String> {
    operate_in(client, request, this_world())
}
pub fn operate_in(
    client: &CentralClient,
    request: &Request,
    world: Result<World, String>,
) -> Result<Value, String> {
    // Where no key can be kept here, Central is still asked: a ground that keeps an authority already is kept as it stands.
    let principal = world
        .as_ref()
        .map(|w| w.principal_ref.clone())
        .unwrap_or_else(|_| "human:person".into());
    let preview = central(client, PREVIEW, json!({"principal_ref":principal}))?;
    let state = preview["state"].as_str().unwrap_or_default().to_owned();
    let world = match world {
        Ok(world) => world,
        Err(why) => return Ok(json!({"schema":SCHEMA,"keeps":false,"why":why,"central":preview})),
    };
    match request {
        Request::Preview => Ok(
            json!({"schema":SCHEMA,"keeps":true,"principal_ref":world.principal_ref,
            "key_stands":world.home.join(KEY_PATH).is_file(),"central":preview}),
        ),
        Request::Adopt {
            acceptance_ref,
            expected_digest,
        } => {
            // A ground that keeps an authority changes nothing.
            if state == "present" {
                return Ok(
                    json!({"schema":SCHEMA,"keeps":true,"adopted":false,"state":"present","principal_ref":world.principal_ref,
                    "reason":preview["reason"]}),
                );
            }
            let digest = key_digest(&world.home)?;
            let receipt = central(
                client,
                ADOPT,
                json!({"actor_kind":"human","acceptance":"human-accepted","acceptance_ref":acceptance_ref,
                    "principal_ref":world.principal_ref,"token_sha256":digest,"expected_digest":expected_digest}),
            )?;
            crate::read_cache::written();
            Ok(
                json!({"schema":SCHEMA,"keeps":true,"adopted":receipt["adopted"] == true,"state":"recognised",
                "principal_ref":world.principal_ref,"source_ref":receipt["source_ref"],
                "actions":receipt["actions"].as_array().map(Vec::len).unwrap_or(0)}),
            )
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    struct Scratch(PathBuf);
    impl Drop for Scratch {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }
    fn scratch(label: &str) -> Scratch {
        let path = std::env::temp_dir().join(format!(
            "oi-ground-authority-{label}-{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&path).unwrap();
        Scratch(path.canonicalize().unwrap())
    }

    #[test]
    fn a_key_is_kept_only_where_home_is_the_chosen_world_s_folder() {
        let world_folder = scratch("Bare");
        let other = scratch("home");
        let kept = world(Some(world_folder.0.clone()), Some(world_folder.0.clone())).unwrap();
        assert_eq!(kept.home, world_folder.0);
        assert!(kept
            .principal_ref
            .starts_with("human:oi-ground-authority-Bare-"));
        assert!(world(Some(other.0.clone()), Some(world_folder.0.clone()))
            .unwrap_err()
            .contains("not the world's folder"));
        assert!(world(Some(other.0.clone()), None)
            .unwrap_err()
            .contains("OI_WORLD_FOLDER"));
        assert!(world(None, Some(world_folder.0.clone())).is_err());
    }

    #[test]
    fn the_key_is_made_once_owner_only_and_only_its_digest_leaves() {
        let home = scratch("key");
        let first = key_digest(&home.0).unwrap();
        let path = home.0.join(KEY_PATH);
        let key = fs::read_to_string(&path).unwrap();
        assert_eq!(key.len(), 64, "32 random bytes, hex");
        assert!(key.bytes().all(|b| b.is_ascii_hexdigit()));
        assert_eq!(first, format!("{:x}", Sha256::digest(key.as_bytes())));
        assert_ne!(first, key, "the digest, never the key");
        assert_eq!(
            fs::metadata(&path).unwrap().permissions().mode() & 0o777,
            0o600
        );
        assert_eq!(
            fs::metadata(path.parent().unwrap())
                .unwrap()
                .permissions()
                .mode()
                & 0o777,
            0o700
        );
        // A key that stands is read, never replaced.
        assert_eq!(key_digest(&home.0).unwrap(), first);
        assert_eq!(fs::read_to_string(&path).unwrap(), key);
        // A key Central could not take is named, and nothing is made over it.
        let short = scratch("short");
        fs::create_dir_all(short.0.join(".central")).unwrap();
        fs::write(short.0.join(KEY_PATH), "too-short").unwrap();
        assert!(key_digest(&short.0)
            .unwrap_err()
            .contains("mend it by hand"));
        assert_eq!(
            fs::read_to_string(short.0.join(KEY_PATH)).unwrap(),
            "too-short"
        );
    }

    /// A Central that records what it is sent (argv and the JSON input), answering as the built ctrl does.
    fn recording_central(dir: &Path, state: &str) -> (CentralClient, PathBuf) {
        let log = dir.join("sent.log");
        let script = dir.join("ctrl");
        fs::write(&script, format!(r#"#!/usr/bin/env python3
import json, sys
open({log:?}, "a").write(json.dumps(sys.argv[1:]) + "\n")
action = sys.argv[sys.argv.index("run") + 1]
if action == "central.ground.authority.preview":
    data = {{"schema": "central.ground-authority-preview/v1", "state": "{state}", "digest": "d" * 64, "reason": None}}
else:
    data = {{"adopted": True, "source_ref": "central:source:control:root:Control/user/native-action-authority.json", "actions": ["central.day.ensure"]}}
print(json.dumps({{"ok": True, "status": "success", "action": action, "data": data}}))
"#)).unwrap();
        fs::set_permissions(&script, fs::Permissions::from_mode(0o755)).unwrap();
        (
            CentralClient::with(script, Some(dir.join("Central")), String::new()),
            log,
        )
    }

    #[test]
    fn adopt_sends_central_only_the_key_s_digest_and_answers_without_either() {
        let world_folder = scratch("Arriving");
        let (client, log) = recording_central(&world_folder.0, "absent");
        let here = || world(Some(world_folder.0.clone()), Some(world_folder.0.clone()));
        let preview = operate_in(&client, &Request::Preview, here()).unwrap();
        assert_eq!(preview["keeps"], true);
        assert_eq!(preview["key_stands"], false);
        let answer = operate_in(
            &client,
            &Request::Adopt {
                acceptance_ref: "oi-setup-adoption:review-1".into(),
                expected_digest: "d".repeat(64),
            },
            here(),
        )
        .unwrap();
        assert_eq!(answer["adopted"], true);
        let key = fs::read_to_string(world_folder.0.join(KEY_PATH)).unwrap();
        let digest = format!("{:x}", Sha256::digest(key.as_bytes()));
        let sent = fs::read_to_string(&log).unwrap();
        assert!(!sent.contains(&key), "the key never crosses to Central");
        assert!(sent.contains(&digest), "its digest does");
        assert!(
            sent.contains("\"acceptance_ref\": \"oi-setup-adoption:review-1\"")
                || sent.contains("oi-setup-adoption:review-1")
        );
        let said = answer.to_string();
        assert!(
            !said.contains(&key) && !said.contains(&digest),
            "the answer carries neither"
        );
        // A ground that keeps an authority: nothing is made, nothing adopted.
        let kept = scratch("Kept");
        let (client, log) = recording_central(&kept.0, "present");
        let answer = operate_in(
            &client,
            &Request::Adopt {
                acceptance_ref: "x".into(),
                expected_digest: "d".repeat(64),
            },
            world(Some(kept.0.clone()), Some(kept.0.clone())),
        )
        .unwrap();
        assert_eq!(answer["adopted"], false);
        assert!(
            !kept.0.join(KEY_PATH).exists(),
            "no key is made for a ground that keeps an authority"
        );
        assert!(!fs::read_to_string(log).unwrap().contains(ADOPT));
        // Outside a world's folder: said, Central's own standing read, and nothing adopted.
        let outside = operate_in(
            &client,
            &Request::Preview,
            Err("This window is not a world's own".into()),
        )
        .unwrap();
        assert_eq!(outside["keeps"], false);
        assert_eq!(outside["central"]["state"], "present");
        let refused = operate_in(
            &client,
            &Request::Adopt {
                acceptance_ref: "x".into(),
                expected_digest: "d".repeat(64),
            },
            Err("This window is not a world's own".into()),
        )
        .unwrap();
        assert_eq!(refused["keeps"], false);
        assert!(refused.get("adopted").is_none());
    }

    #[test]
    #[ignore = "requires the rebuilt actual OI_CENTRAL_CTRL_BIN; never substitutes owner replies"]
    fn the_real_owner_keeps_the_grant_and_the_person_s_credential_authenticates_today_s_day() {
        let binary =
            std::env::var_os("OI_CENTRAL_CTRL_BIN").expect("pin the rebuilt native Central owner");
        let world_folder = scratch("Real");
        let ground = world_folder.0.join("Central");
        let client = CentralClient::with(binary.into(), Some(ground.clone()), String::new());
        client.run("central.init", json!({"project":null})).unwrap();
        let days = client
            .run("central.time.policy.preview", json!({}))
            .unwrap();
        client.run("central.time.policy.adopt", json!({"actor_kind":"human","acceptance":"human-accepted","acceptance_ref":"test","expected_digest":days["digest"]})).unwrap();
        let here = || world(Some(world_folder.0.clone()), Some(world_folder.0.clone()));
        let preview = operate_in(&client, &Request::Preview, here()).unwrap();
        assert_eq!(preview["central"]["state"], "absent");
        let answer = operate_in(
            &client,
            &Request::Adopt {
                acceptance_ref: "oi-setup-adoption:test".into(),
                expected_digest: preview["central"]["digest"].as_str().unwrap().into(),
            },
            here(),
        )
        .unwrap();
        assert_eq!(answer["adopted"], true, "{answer}");
        let time = client
            .run("central.time.policy", json!({"project":null}))
            .unwrap();
        let person = client.with_person_token(
            fs::read_to_string(world_folder.0.join(KEY_PATH))
                .unwrap()
                .trim(),
        );
        let day = person
            .run(
                "central.day.ensure",
                json!({"project":null,"expected_time_policy_revision":time["revision"]}),
            )
            .unwrap();
        assert_eq!(day["temporal"]["civil_date"], time["civil_date"]);
        let again = operate_in(
            &client,
            &Request::Adopt {
                acceptance_ref: "x".into(),
                expected_digest: "x".into(),
            },
            here(),
        )
        .unwrap();
        assert_eq!(
            again["adopted"], false,
            "a ground that keeps an authority changes nothing"
        );
    }
}
