//! Live shell — dev server + static host for the application frame (M2).
//!
//! Run:  cargo run -- <path-to-set.als>   (serves on 127.0.0.1:8787)
//!       cargo run -- --play <set.als>    (plays the set's arrangement
//!                                        through the default output
//!                                        device — realtime output, the
//!                                        engine's `realtime` feature)
//!
//! Surfaces:
//!   /                legacy document inspector (kept for tooling)
//!   /app/            the React application frame (ui/ui-dist via `npm run build`)
//!   /api/summary?path=<abs .als>   document summary JSON — the M2 contract
//!   /api/document?path=<abs .als>  deep document JSON (devices with parameter
//!                                  trees, arrangement clips, session grids)
//!   /api/config      { default_set } — the set passed on the command line
//!   /api/device-descriptors        parameter tables of the panel devices,
//!                                  generated from live-dynamics (M3)
//!   /api/document/device-params?path=&track=&device=   stored values of one
//!                                  device (the deep model's parameter walk)
//!   POST /api/document/device-param  {path, track, deviceName|deviceIndex,
//!                                  paramId, value} — validate against the
//!                                  stored range, set the Manual value and
//!                                  write the set back (deterministic gzip)
//!
//! UI development: `cd ui && npm run dev` (:5173, /api proxied here).
//! This is the surface wider agents build against; Tauri wrap at M2-complete
//! (shell/SHELL-BLUEPRINT.md). Panels integrate through ui/PANELS.md.

mod api;
mod play;

use axum::extract::{Query, State};
use axum::response::Html;
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::Deserialize;
use std::path::PathBuf;
use tower_http::services::ServeDir;

const INDEX: &str = include_str!("../assets/index.html");

/// ui-dist relative to this file's crate — where `npm run build` lands.
const UI_DIST: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/ui/ui-dist");

#[derive(Clone)]
struct AppState {
    /// Set passed on the command line ("" when none); the UI auto-loads it
    /// via /api/config — the React port of the legacy __DEFAULT_SET__ swap.
    default_set: String,
    /// Directory served at /app (built by `npm run build` in ui/).
    ui_dist: PathBuf,
}

#[derive(Deserialize)]
struct PathQ {
    path: String,
}

async fn summary(Query(q): Query<PathQ>) -> Json<serde_json::Value> {
    let err = |m: &str| serde_json::json!({ "error": m });
    match live_set::open_als(std::path::Path::new(&q.path)) {
        Ok(root) => match api::summary_json(&q.path, &root) {
            Some(s) => Json(serde_json::to_value(s).unwrap()),
            None => Json(err("no LiveSet in document")),
        },
        Err(e) => Json(err(&e.to_string())),
    }
}

async fn document(Query(q): Query<PathQ>) -> Json<serde_json::Value> {
    let err = |m: &str| serde_json::json!({ "error": m });
    match live_set::open_als(std::path::Path::new(&q.path)) {
        Ok(root) => match api::document_json(&q.path, &root) {
            Some(d) => Json(serde_json::to_value(d).unwrap()),
            None => Json(err("no LiveSet in document")),
        },
        Err(e) => Json(err(&e.to_string())),
    }
}

async fn config(State(state): State<AppState>) -> Json<serde_json::Value> {
    Json(serde_json::json!({ "default_set": state.default_set }))
}

// ------------------------------------------------------ device parameters
//
// The M3 parameter-editing surface: panels read a device's stored values
// and write single parameters (the set is re-encoded deterministically and
// written back on every POST).

#[derive(Deserialize)]
struct DeviceParamsQ {
    path: String,
    track: String,
    device: String,
}

async fn device_params(Query(q): Query<DeviceParamsQ>) -> Json<serde_json::Value> {
    let err = |m: &str| serde_json::json!({ "error": m });
    match live_set::open_als(std::path::Path::new(&q.path)) {
        Ok(root) => match api::device_params_json(&q.path, &root, &q.track, &q.device) {
            Ok(d) => Json(serde_json::to_value(d).unwrap()),
            Err(m) => Json(err(&m)),
        },
        Err(e) => Json(err(&e.to_string())),
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct DeviceParamBody {
    path: String,
    track: String,
    /// Device element name (e.g. "GlueCompressor") — first match on the track.
    #[serde(alias = "device")]
    device_name: Option<String>,
    /// Zero-based position in the track's Devices list — wins over the name.
    device_index: Option<usize>,
    param_id: String,
    /// Number in stored units; toggles also take true/false.
    value: serde_json::Value,
}

async fn set_device_param(Json(body): Json<DeviceParamBody>) -> Json<serde_json::Value> {
    let err = |m: &str| serde_json::json!({ "error": m });
    let req = api::DeviceParamWrite {
        track: &body.track,
        device_name: body.device_name.as_deref(),
        device_index: body.device_index,
        param_id: &body.param_id,
        value: &body.value,
    };
    match live_set::open_als(std::path::Path::new(&body.path)) {
        Ok(mut root) => match api::set_device_param(&mut root, &req) {
            Ok(res) => match live_set::write_gz(&root) {
                Ok(bytes) => match std::fs::write(&body.path, bytes) {
                    Ok(()) => Json(serde_json::to_value(res).unwrap()),
                    Err(e) => Json(err(&e.to_string())),
                },
                Err(e) => Json(err(&e.to_string())),
            },
            Err(m) => Json(err(&m)),
        },
        Err(e) => Json(err(&e.to_string())),
    }
}

async fn device_descriptors() -> Json<serde_json::Value> {
    Json(api::device_descriptors_json())
}

async fn index(State(state): State<AppState>) -> Html<String> {
    Html(INDEX.replace("__DEFAULT_SET__", &state.default_set))
}

fn build_router(state: AppState) -> Router {
    Router::new()
        .route("/", get(index))
        .route("/api/summary", get(summary))
        .route("/api/document", get(document))
        .route("/api/config", get(config))
        .route("/api/device-descriptors", get(device_descriptors))
        .route("/api/document/device-params", get(device_params))
        .route("/api/document/device-param", post(set_device_param))
        .nest_service("/app", ServeDir::new(state.ui_dist.clone()))
        .with_state(state)
}

#[tokio::main]
async fn main() {
    let args: Vec<String> = std::env::args().collect();

    // --play <set.als>: realtime audition — bridge the set, fill the
    // arrangement sources, play through the default output device. The
    // server routes below are untouched.
    if args.get(1).map(String::as_str) == Some("--play") {
        let Some(path) = args.get(2) else {
            eprintln!("live-shell --play: usage: cargo run -- --play <set.als>");
            std::process::exit(2);
        };
        let code = play::run_play(path);
        std::process::exit(code);
    }

    let state = AppState {
        default_set: args.get(1).cloned().unwrap_or_default(),
        ui_dist: PathBuf::from(UI_DIST),
    };

    let app = build_router(state.clone());
    // Two shells side by side (an owner seat plus a verification seat) bind
    // different addresses: LIVE_SHELL_ADDR overrides the default.
    let addr =
        std::env::var("LIVE_SHELL_ADDR").unwrap_or_else(|_| "127.0.0.1:8787".to_string());
    println!("live-shell dev server on http://{addr}/  (frame at /app/)");
    if state.default_set.is_empty() {
        println!("no set passed — open one from the UI browser or restart with: cargo run -- <set.als>");
    } else {
        println!("opened set: {}", state.default_set);
    }
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::{to_bytes, Body};
    use axum::http::{Request, StatusCode};
    use tower::ServiceExt;

    async fn get_body(app: Router, uri: &str) -> (StatusCode, String) {
        let resp = app
            .oneshot(Request::builder().uri(uri).body(Body::empty()).unwrap())
            .await
            .unwrap();
        let status = resp.status();
        let bytes = to_bytes(resp.into_body(), usize::MAX).await.unwrap();
        (status, String::from_utf8_lossy(&bytes).into_owned())
    }

    #[tokio::test]
    async fn config_exposes_default_set() {
        let app = build_router(AppState {
            default_set: "/tmp/some.als".into(),
            ui_dist: PathBuf::from("/nonexistent-ui-dist"),
        });
        let (status, body) = get_body(app, "/api/config").await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(
            serde_json::from_str::<serde_json::Value>(&body).unwrap(),
            serde_json::json!({ "default_set": "/tmp/some.als" })
        );
    }

    #[tokio::test]
    async fn legacy_index_substitutes_default_set() {
        let app = build_router(AppState {
            default_set: "/tmp/legacy.als".into(),
            ui_dist: PathBuf::from("/nonexistent-ui-dist"),
        });
        let (status, body) = get_body(app, "/").await;
        assert_eq!(status, StatusCode::OK);
        assert!(body.contains("/tmp/legacy.als"));
        assert!(!body.contains("__DEFAULT_SET__"));
    }

    #[tokio::test]
    async fn app_serves_built_ui() {
        // Self-contained: stage a fake ui-dist so the test does not depend on
        // `npm run build` having run.
        let dir = std::env::temp_dir().join(format!(
            "live-shell-uitest-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(dir.join("assets")).unwrap();
        std::fs::write(
            dir.join("index.html"),
            "<!doctype html><title>live-shell frame</title>ui-dist-marker",
        )
        .unwrap();
        std::fs::write(dir.join("assets/app.js"), "console.log('frame')").unwrap();

        let app = build_router(AppState {
            default_set: String::new(),
            ui_dist: dir.clone(),
        });

        let (status, body) = get_body(app.clone(), "/app/").await;
        assert_eq!(status, StatusCode::OK);
        assert!(body.contains("ui-dist-marker"));

        let (status, body) = get_body(app.clone(), "/app/assets/app.js").await;
        assert_eq!(status, StatusCode::OK);
        assert!(body.contains("console.log"));

        // directory traversal stays inside ui-dist
        let (status, _) = get_body(app, "/app/../Cargo.toml").await;
        assert_ne!(status, StatusCode::OK);

        let _ = std::fs::remove_dir_all(dir);
    }

    #[tokio::test]
    async fn app_missing_dist_is_not_a_crash() {
        let app = build_router(AppState {
            default_set: String::new(),
            ui_dist: PathBuf::from("/nonexistent-ui-dist"),
        });
        let (status, _) = get_body(app, "/app/").await;
        assert_eq!(status, StatusCode::NOT_FOUND);
    }

    /// A real gzipped .als on disk (the shell only reads .als), served
    /// through the /api/document route.
    fn write_temp_als() -> PathBuf {
        let doc = live_set::xml::parse(
            r#"<Ableton><LiveSet>
            <MainTrack><DeviceChain><Mixer><Tempo><Manual Value="131" /></Tempo></Mixer>
            <DeviceChain><Devices><Saturator Id="7"><Drive><Manual Value="2.0" />
              <MidiControllerRange><Min Value="0" /><Max Value="12" /></MidiControllerRange>
            </Drive></Saturator></Devices></DeviceChain></DeviceChain></MainTrack>
            <Tracks /><Scenes><Scene /></Scenes></LiveSet></Ableton>"#,
        )
        .unwrap();
        let dir = std::env::temp_dir().join(format!(
            "live-shell-doctest-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("t.als");
        std::fs::write(&path, live_set::write_gz(&doc).unwrap()).unwrap();
        path
    }

    #[tokio::test]
    async fn document_endpoint_serves_deep_json() {
        let als = write_temp_als();
        let app = build_router(AppState {
            default_set: String::new(),
            ui_dist: PathBuf::from("/nonexistent-ui-dist"),
        });
        let (status, body) = get_body(
            app,
            &format!("/api/document?path={}", als.to_str().unwrap()),
        )
        .await;
        assert_eq!(status, StatusCode::OK);
        let v: serde_json::Value = serde_json::from_str(&body).unwrap();
        assert_eq!(v["tempo"], 131.0);
        assert_eq!(v["scenes"], 1);
        assert_eq!(v["path"], als.to_str().unwrap());
        let master = v["tracks"].as_array().unwrap().last().unwrap();
        assert_eq!(master["kind"], "master");
        assert_eq!(master["devices"][0]["name"], "Saturator");
        assert_eq!(master["devices"][0]["params"][0]["id"], "Drive");
        assert_eq!(master["devices"][0]["params"][0]["value"], "2.0");
        assert_eq!(master["devices"][0]["params"][0]["min"], "0");
        assert_eq!(master["devices"][0]["params"][0]["max"], "12");
        // the summary contract is untouched and still served
        let app = build_router(AppState {
            default_set: String::new(),
            ui_dist: PathBuf::from("/nonexistent-ui-dist"),
        });
        let (status, body) = get_body(
            app,
            &format!("/api/summary?path={}", als.to_str().unwrap()),
        )
        .await;
        assert_eq!(status, StatusCode::OK);
        let v: serde_json::Value = serde_json::from_str(&body).unwrap();
        assert_eq!(v["tempo_bpm"], 131.0);
        assert!(v["arrangement_clips"].is_number());
        let _ = std::fs::remove_dir_all(als.parent().unwrap());
    }

    #[tokio::test]
    async fn document_endpoint_reports_unreadable_path() {
        let app = build_router(AppState {
            default_set: String::new(),
            ui_dist: PathBuf::from("/nonexistent-ui-dist"),
        });
        let (status, body) = get_body(app, "/api/document?path=/definitely/not/here.als").await;
        assert_eq!(status, StatusCode::OK);
        let v: serde_json::Value = serde_json::from_str(&body).unwrap();
        assert!(v["error"].is_string());
    }

    // -------------------------------------------------- device parameters

    /// A set shaped like the harness ones: an audio track "STIM" carrying a
    /// GlueCompressor with the parameter children real documents store.
    fn write_glue_set() -> PathBuf {
        let doc = live_set::xml::parse(
            r#"<Ableton MajorVersion="5"><LiveSet>
            <MainTrack><DeviceChain><Mixer><Tempo><Manual Value="120" /></Tempo></Mixer></DeviceChain></MainTrack>
            <Tracks>
              <AudioTrack Id="8"><Name><EffectiveName Value="STIM" /></Name>
                <DeviceChain><DeviceChain><Devices>
                  <GlueCompressor Id="2">
                    <On><Manual Value="true" /></On>
                    <Threshold><Manual Value="-12" />
                      <MidiControllerRange><Min Value="-40" /><Max Value="0" /></MidiControllerRange>
                    </Threshold>
                    <Range><Manual Value="30" />
                      <MidiControllerRange><Min Value="0" /><Max Value="70" /></MidiControllerRange>
                    </Range>
                    <Ratio><Manual Value="1" /></Ratio>
                    <Makeup><Manual Value="0" />
                      <MidiControllerRange><Min Value="0" /><Max Value="20" /></MidiControllerRange>
                    </Makeup>
                    <Attack><Manual Value="2" /></Attack>
                    <Release><Manual Value="0" /></Release>
                    <DryWet><Manual Value="1" /></DryWet>
                    <PeakClipIn><Manual Value="true" /></PeakClipIn>
                  </GlueCompressor>
                </Devices></DeviceChain></DeviceChain>
              </AudioTrack>
            </Tracks><Scenes><Scene /></Scenes></LiveSet></Ableton>"#,
        )
        .unwrap();
        let dir = std::env::temp_dir().join(format!(
            "live-shell-devtest-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("glue.als");
        std::fs::write(&path, live_set::write_gz(&doc).unwrap()).unwrap();
        path
    }

    async fn post_device_param(app: Router, body: serde_json::Value) -> (StatusCode, String) {
        let resp = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/document/device-param")
                    .header("content-type", "application/json")
                    .body(Body::from(serde_json::to_string(&body).unwrap()))
                    .unwrap(),
            )
            .await
            .unwrap();
        let status = resp.status();
        let bytes = to_bytes(resp.into_body(), usize::MAX).await.unwrap();
        (status, String::from_utf8_lossy(&bytes).into_owned())
    }

    #[tokio::test]
    async fn device_param_roundtrip_set_then_get() {
        let als = write_glue_set();
        let app = build_router(AppState {
            default_set: String::new(),
            ui_dist: PathBuf::from("/nonexistent-ui-dist"),
        });
        let p = als.to_str().unwrap();

        // set Threshold via the POST surface (deviceName addressing)
        let (status, body) = post_device_param(
            app.clone(),
            serde_json::json!({
                "path": p, "track": "STIM", "deviceName": "GlueCompressor",
                "paramId": "Threshold", "value": -6.5
            }),
        )
        .await;
        assert_eq!(status, StatusCode::OK);
        let v: serde_json::Value = serde_json::from_str(&body).unwrap();
        assert!(v.get("error").is_none(), "{body}");
        assert_eq!(v["track"], "STIM");
        assert_eq!(v["device"], "GlueCompressor");
        assert_eq!(v["param"]["id"], "Threshold");
        assert_eq!(v["param"]["value"], "-6.5");
        assert_eq!(v["param"]["min"], "-40");
        assert_eq!(v["param"]["max"], "0");

        // the persisted document carries it (reopen from disk)
        let root = live_set::open_als(&als).unwrap();
        assert_eq!(
            root.find("Threshold").unwrap().child("Manual").unwrap().attr("Value"),
            Some("-6.5")
        );

        // and GET /api/document/device-params reports the new value
        let (status, body) = get_body(
            app,
            &format!("/api/document/device-params?path={p}&track=STIM&device=GlueCompressor"),
        )
        .await;
        assert_eq!(status, StatusCode::OK);
        let v: serde_json::Value = serde_json::from_str(&body).unwrap();
        assert_eq!(v["track"], "STIM");
        assert_eq!(v["device"], "GlueCompressor");
        let threshold = v["params"]
            .as_array()
            .unwrap()
            .iter()
            .find(|pp| pp["id"] == "Threshold")
            .unwrap();
        assert_eq!(threshold["value"], "-6.5");

        let _ = std::fs::remove_dir_all(als.parent().unwrap());
    }

    #[tokio::test]
    async fn device_param_validates_against_stored_range() {
        let als = write_glue_set();
        let app = build_router(AppState {
            default_set: String::new(),
            ui_dist: PathBuf::from("/nonexistent-ui-dist"),
        });
        let p = als.to_str().unwrap();

        // above the stored ceiling → rejected with the range in the message
        let (_, body) = post_device_param(
            app.clone(),
            serde_json::json!({
                "path": p, "track": "STIM", "deviceName": "GlueCompressor",
                "paramId": "Threshold", "value": 5.0
            }),
        )
        .await;
        let v: serde_json::Value = serde_json::from_str(&body).unwrap();
        let msg = v["error"].as_str().unwrap().to_string();
        assert!(msg.contains("out of range"), "{msg}");
        assert!(msg.contains("-40") && msg.contains("0 dB"), "{msg}");

        // below the stored floor → rejected too
        let (_, body) = post_device_param(
            app.clone(),
            serde_json::json!({
                "path": p, "track": "STIM", "deviceIndex": 0,
                "paramId": "Threshold", "value": -41.0
            }),
        )
        .await;
        let v: serde_json::Value = serde_json::from_str(&body).unwrap();
        assert!(v["error"].as_str().unwrap().contains("out of range"));

        // a discrete menu takes only stored indices
        let (_, body) = post_device_param(
            app.clone(),
            serde_json::json!({
                "path": p, "track": "STIM", "deviceName": "GlueCompressor",
                "paramId": "Ratio", "value": 1.5
            }),
        )
        .await;
        let v: serde_json::Value = serde_json::from_str(&body).unwrap();
        assert!(v["error"].as_str().unwrap().contains("stored index"));

        // …and the document is untouched after every rejection
        let root = live_set::open_als(&als).unwrap();
        assert_eq!(
            root.find("Threshold").unwrap().child("Manual").unwrap().attr("Value"),
            Some("-12")
        );

        let _ = std::fs::remove_dir_all(als.parent().unwrap());
    }

    #[tokio::test]
    async fn device_param_toggle_and_discrete_store_as_documents_do() {
        let als = write_glue_set();
        let app = build_router(AppState {
            default_set: String::new(),
            ui_dist: PathBuf::from("/nonexistent-ui-dist"),
        });
        let p = als.to_str().unwrap();

        // toggle: boolean in, "true"/"false" stored
        let (_, body) = post_device_param(
            app.clone(),
            serde_json::json!({
                "path": p, "track": "STIM", "deviceName": "GlueCompressor",
                "paramId": "PeakClipIn", "value": false
            }),
        )
        .await;
        let v: serde_json::Value = serde_json::from_str(&body).unwrap();
        assert_eq!(v["param"]["value"], "false");

        // discrete menu: integer in, bare integer stored
        let (_, body) = post_device_param(
            app.clone(),
            serde_json::json!({
                "path": p, "track": "STIM", "deviceName": "GlueCompressor",
                "paramId": "Attack", "value": 4
            }),
        )
        .await;
        let v: serde_json::Value = serde_json::from_str(&body).unwrap();
        assert_eq!(v["param"]["value"], "4");

        // deviceIndex addressing hits the same device
        let (_, body) = post_device_param(
            app.clone(),
            serde_json::json!({
                "path": p, "track": "STIM", "deviceIndex": 0,
                "paramId": "Makeup", "value": 7.25
            }),
        )
        .await;
        let v: serde_json::Value = serde_json::from_str(&body).unwrap();
        assert_eq!(v["param"]["value"], "7.25");

        let root = live_set::open_als(&als).unwrap();
        assert_eq!(
            root.find("PeakClipIn").unwrap().child("Manual").unwrap().attr("Value"),
            Some("false")
        );
        assert_eq!(
            root.find("Attack").unwrap().child("Manual").unwrap().attr("Value"),
            Some("4")
        );

        // missing device / missing parameter / untyped parameter → named errors
        for (req, fragment) in [
            (
                serde_json::json!({"path": p, "track": "STIM", "deviceName": "Echo", "paramId": "Feedback", "value": 0.5}),
                "not found",
            ),
            (
                serde_json::json!({"path": p, "track": "STIM", "deviceName": "GlueCompressor", "paramId": "Nope", "value": 1.0}),
                "no entry in the GlueCompressor parameter table",
            ),
            (
                serde_json::json!({"path": p, "track": "NOPE", "deviceName": "GlueCompressor", "paramId": "Threshold", "value": 1.0}),
                "not found in set",
            ),
        ] {
            let (_, body) = post_device_param(app.clone(), req).await;
            let v: serde_json::Value = serde_json::from_str(&body).unwrap();
            assert!(
                v["error"].as_str().unwrap().contains(fragment),
                "expected \"{fragment}\" in {body}"
            );
        }

        let _ = std::fs::remove_dir_all(als.parent().unwrap());
    }

    #[tokio::test]
    async fn device_descriptors_serve_the_panel_tables() {
        let app = build_router(AppState {
            default_set: String::new(),
            ui_dist: PathBuf::from("/nonexistent-ui-dist"),
        });
        let (status, body) = get_body(app, "/api/device-descriptors").await;
        assert_eq!(status, StatusCode::OK);
        let v: serde_json::Value = serde_json::from_str(&body).unwrap();
        for name in ["GlueCompressor", "Echo", "Reverb", "Operator"] {
            let rows = v[name].as_array().unwrap_or_else(|| panic!("{name} missing"));
            assert!(!rows.is_empty());
            for row in rows {
                assert!(row["id"].is_string());
                assert!(row["uiName"].is_null()); // snake_case contract
                assert!(row["ui_name"].is_string());
                assert!(row["stored_min"].is_number());
                assert!(row["stored_max"].is_number());
                assert!(matches!(
                    row["kind"].as_str(),
                    Some("continuous") | Some("discrete") | Some("toggle")
                ));
                if row["kind"] == "discrete" {
                    let labels = row["labels"].as_array().expect("labels on discrete");
                    assert!(!labels.is_empty());
                }
            }
        }
        let glue = &v["GlueCompressor"];
        assert_eq!(glue.as_array().unwrap().len(), 8);
        // the Operator table carries the document paths the voice model and
        // the OP probes pin (`Operator.0/Envelope/...`, `Globals/Volume`)
        let operator = v["Operator"].as_array().unwrap();
        assert_eq!(operator.len(), 23);
        assert!(operator
            .iter()
            .any(|r| r["id"] == "Operator.0/Envelope/SustainLevel"));
        assert!(operator.iter().any(|r| r["id"] == "Globals/Volume"));
    }
}
