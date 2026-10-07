//! Live shell — dev server + static host for the application frame (M2).
//!
//! Run:  cargo run -- <path-to-set.als>   (serves on 127.0.0.1:8787)
//!
//! Surfaces:
//!   /                legacy document inspector (kept for tooling)
//!   /app/            the React application frame (ui/ui-dist via `npm run build`)
//!   /api/summary?path=<abs .als>   document summary JSON — the M2 contract
//!   /api/document?path=<abs .als>  deep document JSON (devices with parameter
//!                                  trees, arrangement clips, session grids)
//!   /api/config      { default_set } — the set passed on the command line
//!
//! UI development: `cd ui && npm run dev` (:5173, /api proxied here).
//! This is the surface wider agents build against; Tauri wrap at M2-complete
//! (shell/SHELL-BLUEPRINT.md). Panels integrate through ui/PANELS.md.

mod api;

use axum::extract::{Query, State};
use axum::response::Html;
use axum::routing::get;
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

async fn index(State(state): State<AppState>) -> Html<String> {
    Html(INDEX.replace("__DEFAULT_SET__", &state.default_set))
}

fn build_router(state: AppState) -> Router {
    Router::new()
        .route("/", get(index))
        .route("/api/summary", get(summary))
        .route("/api/document", get(document))
        .route("/api/config", get(config))
        .nest_service("/app", ServeDir::new(state.ui_dist.clone()))
        .with_state(state)
}

#[tokio::main]
async fn main() {
    let args: Vec<String> = std::env::args().collect();
    let state = AppState {
        default_set: args.get(1).cloned().unwrap_or_default(),
        ui_dist: PathBuf::from(UI_DIST),
    };

    let app = build_router(state.clone());
    let addr = "127.0.0.1:8787";
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
}
