//! The world's Music folder as a scope of Central's file map (DLW build ruling 2026-11-09, round 47 item 1; 2026-11-08, LV01: "Setup's
//! part is only where"). Samples lists Music's audio only from Central's file map (`live_set_owner.rs` `samples_reading`), so Setup's
//! Ground step reads whether Central keeps the folder as a folder scope, and its held Accept registers it: Central lists its files by
//! metadata only (name, kind, size, time) and never writes inside it (central-47, Central #154). The scope leaves out what Samples never
//! lists — Live's backups and packs, and its project info — so they never fill a page; Central walks no hidden folder, link or package.
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

pub const SCHEMA: &str = "oi.ground-music/v1";
/// The scope's name in Central's file map (its world ref is `folder:Music`).
pub const NAME: &str = "Music";
/// The media the scope admits: the audio Samples lists, and the audio it names but does not make a clip of.
pub const MEDIA: [&str; 6] = ["wav", "aif", "aiff", "flac", "mp3", "m4a"];
/// The folders the scope leaves out, at any depth: Live's backups and packs, and its project info.
pub const EXCLUDE: [&str; 3] = ["Backup", "Factory Packs", "Ableton Project Info"];

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(tag = "operation", rename_all = "snake_case", deny_unknown_fields)]
pub enum Request {
    Preview,
    /// Register the folder, on the file map's revision the step was read on (Central refuses one that moved).
    Keep {
        expected_revision: String,
    },
}

/// The scope (its world ref) whose root is `music`, in Central's answer to `central.file-map.inspect`, by canonical path.
pub(crate) fn scope_in(
    inspected: &Value,
    music: &std::path::Path,
) -> Result<Option<String>, String> {
    let scopes = inspected["result"]["scopes"]
        .as_array()
        .ok_or("Central's file map answered without its scopes")?;
    let wanted = std::fs::canonicalize(music).unwrap_or_else(|_| music.to_path_buf());
    Ok(scopes.iter().find_map(|scope| {
        let root = std::path::Path::new(scope["path"].as_str()?);
        let root = std::fs::canonicalize(root).unwrap_or_else(|_| root.to_path_buf());
        (root == wanted)
            .then(|| scope["world_ref"].as_str().map(str::to_owned))
            .flatten()
    }))
}

/// Whether Central keeps the world's Music folder (`home`/Music) as a scope: `present` (its `world_ref`), `absent` (Accept keeps it, on
/// the map's `revision`) or `no-folder`.
fn preview(
    central: &dyn Fn(&str, Value) -> Result<Value, String>,
    music: &std::path::Path,
) -> Result<Value, String> {
    let inspected = central(
        "central.file-map.inspect",
        json!({"project": null, "resources": false}),
    )?;
    let revision = inspected["result"]["revision"].clone();
    let path = music.to_string_lossy();
    let mut reading = json!({"schema": SCHEMA, "path": path, "revision": revision, "media": MEDIA, "exclude": EXCLUDE});
    match scope_in(&inspected, music)? {
        Some(world_ref) => {
            reading["state"] = json!("present");
            reading["world_ref"] = json!(world_ref);
        }
        None if !music.is_dir() => reading["state"] = json!("no-folder"),
        None => reading["state"] = json!("absent"),
    }
    Ok(reading)
}

/// Preview, or keep, the world's Music folder as a folder scope of Central's file map (`Request`). A folder kept already is never
/// registered twice; there is none to keep where no Music folder stands.
pub fn operate(
    central: &dyn Fn(&str, Value) -> Result<Value, String>,
    home: &std::path::Path,
    request: &Request,
) -> Result<Value, String> {
    let music = home.join(NAME);
    let read = preview(central, &music)?;
    let Request::Keep { expected_revision } = request else {
        return Ok(read);
    };
    match read["state"].as_str() {
        Some("present") => {
            return Ok(json!({"schema": SCHEMA, "path": read["path"], "kept": false, "state": "present", "world_ref": read["world_ref"]}))
        }
        Some("no-folder") => {
            return Err(format!(
                "There is no Music folder at {}, so Central's file map keeps none. Nothing was registered.",
                music.display()
            ))
        }
        _ => {}
    }
    central(
        "central.file-map.scope-register",
        // The root register's file map, named: a register without `project` is filled with the kernel client's co-reference (`o-i`),
        // which Central refuses as an unknown Project map (walk 857, round 47, Bare's Setup).
        json!({"project": null, "name": NAME, "path": music.to_string_lossy(), "kind": "folder", "allow_external": true, "media": MEDIA,
            "exclude": EXCLUDE, "expected_revision": expected_revision}),
    )?;
    crate::read_cache::written();
    let back = preview(central, &music)?;
    if back["state"] != "present" {
        return Err(format!(
            "Central answered central.file-map.scope-register, but {} does not read back as a scope of its file map.",
            music.display()
        ));
    }
    Ok(
        json!({"schema": SCHEMA, "path": back["path"], "kept": true, "state": "present", "world_ref": back["world_ref"]}),
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::{Cell, RefCell};

    /// Central's own answers (tests/fixtures/central-47-music-inspect.json, captured with ctrl built from central-47 from fixture roots):
    /// the `setup` ground before Music is a scope (`unscoped`), the register Setup sends, and the ground after it (`setup`).
    fn captured(home: &std::path::Path) -> Vec<Value> {
        let text = include_str!("../tests/fixtures/central-47-music-inspect.json");
        let here = std::fs::canonicalize(home)
            .unwrap()
            .to_string_lossy()
            .into_owned();
        let fixture: Value = serde_json::from_str(text).unwrap();
        let answers = serde_json::to_string(&fixture["answers"]).unwrap();
        serde_json::from_str(
            &answers
                .replace("{home}", &here)
                .replace("{ground}", "/ground"),
        )
        .unwrap()
    }
    /// A world with a Music folder (or none), its home canonical, removed when dropped.
    struct World(std::path::PathBuf);
    impl Drop for World {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }
    fn world(tag: &str, music: bool) -> World {
        let home = std::env::temp_dir().join(format!("ground-music-{tag}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&home);
        std::fs::create_dir_all(if music { home.join(NAME) } else { home.clone() }).unwrap();
        World(std::fs::canonicalize(&home).unwrap())
    }
    /// The actions Central was asked, in order.
    type Asked = std::rc::Rc<RefCell<Vec<String>>>;
    /// What ctrl is handed for `input` by the kernel's Central client (flow.rs `with_project`): an absent project is filled with the
    /// client's co-reference (`o-i` unless the host names another), an explicit null names the root register and goes as absence.
    fn as_the_client_sends(input: &Value) -> Value {
        let mut sent = input.clone();
        if let Some(object) = sent.as_object_mut() {
            match object.get("project") {
                Some(Value::Null) => {
                    object.remove("project");
                }
                None => {
                    object.insert("project".to_owned(), json!("o-i"));
                }
                Some(_) => {}
            }
        }
        sent
    }
    /// What ctrl was handed in the capture (asked of it directly, so a null project is the root register too).
    fn as_ctrl_got(input: &Value) -> Value {
        let mut got = input.clone();
        if let Some(object) = got.as_object_mut() {
            if object.get("project") == Some(&Value::Null) {
                object.remove("project");
            }
        }
        got
    }
    /// Central replayed from the capture, as the kernel's client hands it each call: the `unscoped` ground until the register Setup
    /// sends is asked — exactly one the capture sent, answered or refused in Central's words as the client words a refusal (flow.rs
    /// `OwnerCallError::Refused`) — then the `setup` ground. Every call is kept.
    fn central(home: &std::path::Path) -> (impl Fn(&str, Value) -> Result<Value, String>, Asked) {
        let answers = captured(home);
        let asked = std::rc::Rc::new(RefCell::new(Vec::new()));
        let kept = asked.clone();
        let registered = Cell::new(false);
        let replay = move |action: &str, input: Value| {
            kept.borrow_mut().push(action.to_owned());
            let input = as_the_client_sends(&input);
            if action == "central.file-map.scope-register" {
                let answer = answers
                    .iter()
                    .find(|a| a["action"] == action && as_ctrl_got(&a["input"]) == input)
                    .unwrap_or_else(|| panic!("the capture never registered {input}: the register Setup sends is the capture's own"));
                if let Some(message) = answer["refused"]["error"]["message"].as_str() {
                    return Err(format!("Central owner Action refused: {message}"));
                }
                registered.set(true);
                return Ok(answer["data"].clone());
            }
            assert_eq!(action, "central.file-map.inspect");
            let ground = if registered.get() {
                "setup"
            } else {
                "unscoped"
            };
            let answer = answers
                .iter()
                .find(|a| {
                    a["action"].is_null()
                        && a["ground"] == ground
                        && as_ctrl_got(&a["input"]) == input
                })
                .unwrap_or_else(|| {
                    panic!("Central was not asked {input} in the capture's {ground} ground")
                });
            Ok(answer["data"].clone())
        };
        (replay, asked)
    }

    #[test]
    fn setup_keeps_the_music_folder_as_a_folder_scope_once_with_live_s_backups_and_packs_left_out()
    {
        let home = world("keep", true);
        let (central, asked) = central(&home.0);
        let read = operate(&central, &home.0, &Request::Preview).unwrap();
        assert_eq!(read["schema"], SCHEMA);
        assert_eq!(read["state"], "absent", "{read}");
        assert_eq!(read["path"], home.0.join(NAME).to_string_lossy().as_ref());
        assert_eq!(
            read["exclude"],
            json!(["Backup", "Factory Packs", "Ableton Project Info"])
        );
        let revision = read["revision"].as_str().unwrap().to_owned();
        let refused = operate(
            &central,
            &home.0,
            &Request::Keep {
                expected_revision: "stale".into(),
            },
        )
        .unwrap_err();
        assert!(
            refused.contains("Source-relations revision changed: expected stale"),
            "Central's own words: {refused}"
        );
        let kept = operate(
            &central,
            &home.0,
            &Request::Keep {
                expected_revision: revision.clone(),
            },
        )
        .unwrap();
        assert_eq!(
            (
                kept["kept"].clone(),
                kept["state"].clone(),
                kept["world_ref"].clone()
            ),
            (json!(true), json!("present"), json!("folder:Music"))
        );
        let again = operate(
            &central,
            &home.0,
            &Request::Keep {
                expected_revision: revision,
            },
        )
        .unwrap();
        assert_eq!(again["kept"], false, "kept once: {again}");
        assert_eq!(
            asked
                .borrow()
                .iter()
                .filter(|a| a.as_str() == "central.file-map.scope-register")
                .count(),
            2,
            "the stale revision, then the one register; the second Accept registers nothing"
        );
        assert_eq!(
            operate(&central, &home.0, &Request::Preview).unwrap()["state"],
            "present"
        );
    }

    #[test]
    fn a_world_with_no_music_folder_registers_none_and_says_so() {
        let home = world("none", false);
        let (central, asked) = central(&home.0);
        let read = operate(&central, &home.0, &Request::Preview).unwrap();
        assert_eq!(read["state"], "no-folder", "{read}");
        let refused = operate(
            &central,
            &home.0,
            &Request::Keep {
                expected_revision: read["revision"].as_str().unwrap().into(),
            },
        )
        .unwrap_err();
        assert!(
            refused.starts_with("There is no Music folder at "),
            "{refused}"
        );
        assert!(
            asked
                .borrow()
                .iter()
                .all(|a| a == "central.file-map.inspect"),
            "nothing is registered"
        );
    }

    #[test]
    fn the_request_is_the_shape_setup_sends() {
        assert_eq!(
            serde_json::from_value::<Request>(json!({"operation": "preview"})).unwrap(),
            Request::Preview
        );
        assert_eq!(
            serde_json::from_value::<Request>(
                json!({"operation": "keep", "expected_revision": "r"})
            )
            .unwrap(),
            Request::Keep {
                expected_revision: "r".into()
            }
        );
        assert!(
            serde_json::from_value::<Request>(
                json!({"operation": "keep", "expected_revision": "r", "path": "/elsewhere"})
            )
            .is_err(),
            "Setup names no folder: the kernel keeps the world's own Music"
        );
    }
}
