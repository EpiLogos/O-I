//! Application-owned hosted code, distinct from owner-authored Central material.
//! Only the Expressions build is admitted. Release bytes come from this binary's
//! embedded frontend assets; debug builds may read this checkout's hosted build.
use oi_cradle_kernel::application_asset::asset_key;
use tauri::http::{Method, Request, Response, StatusCode};
use tauri::{AppHandle, Runtime};

pub fn handle<R: Runtime>(app: &AppHandle<R>, request: &Request<Vec<u8>>) -> Response<Vec<u8>> {
    respond(request, |key| {
        // AssetResolver::get has an SPA fallback to the shell index. Exact
        // admission avoids serving that shell for a missing hosted module.
        // The candidate embeds its frontend with the shell beside `__application/expressions/` (build-native-candidate.py
        // stage), so a key is found under that prefix there and bare where the Expressions build is the whole frontend.
        let resolver = app.asset_resolver();
        let names: Vec<String> = resolver.iter().map(|(name, _)| name.to_string()).collect();
        if let Some(name) = embedded_name(names.iter().map(String::as_str), key) {
            return resolver.get(name).map(|asset| (asset.bytes, "bundled"));
        }
        #[cfg(all(debug_assertions, not(feature = "native_shell")))]
        {
            oi_cradle_kernel::application_asset::read_development_asset(key)
                .map(|bytes| (bytes, "development-build"))
        }
        #[cfg(any(not(debug_assertions), feature = "native_shell"))]
        None
    })
}

/// The embedded asset that answers `key` (`expressions/…`): stored bare, or under the candidate's `__application/` prefix.
fn embedded_name<'a>(names: impl IntoIterator<Item = &'a str>, key: &str) -> Option<String> {
    let prefixed = format!("__application/{key}");
    names
        .into_iter()
        .map(|name| name.trim_start_matches('/'))
        .find(|name| *name == key || *name == prefixed)
        .map(str::to_owned)
}

/// The application's policy (O-I #747 round 896 1T item 10, L5): what the Expressions application's documents, and any document
/// they make, may load from the personal material host. Nothing that runs or is read:
/// - `script-src`: their own scripts and inline ones, no other host's. A file of personal material that is valid JavaScript would
///   otherwise run in the frame with the frame's authority: a `<script src="oi-material://localhost/…">` is a no-cors load, which
///   no CORS answer of the material host stops.
/// - `connect-src` and `frame-src`: a document the frame makes keeps this policy (a `srcdoc`, a sandboxed `srcdoc`, a `blob:`
///   document), so it can neither fetch from the material host nor run its scripts; a `data:` frame or a material page cannot be
///   made at all. `object-src 'none'` closes the same door through `<object>` and `<embed>`.
/// - `worker-src`: the application's own workers alone (1T.0 item 15, review 956a: named, where it fell back to `script-src`), no
///   other host's and no `blob:` one. The frame starts none today.
///
/// This is the second fence. The first is the material host's own: it answers no cross-origin read (material_protocol.rs
/// `personal_material`, 1T item 20), so a document with an opaque origin reads nothing from it, whatever made it. The material host
/// cannot refuse a no-cors load itself: WKWebView sends a custom scheme's handler no `Sec-Fetch-*` header, and no `Origin` or
/// `Referer` on a no-cors load, and does not honour `Cross-Origin-Resource-Policy` for it (the round's WKWebView probe). Images and
/// media are not limited: a media card on the Research Canvas shows a possessed file from the material host (`canvasEmbeds.ts`
/// `mediaSourceUrl`), which the frame can show and cannot read.
pub(crate) const APPLICATION_POLICY: &str = "script-src 'self' 'unsafe-inline'; worker-src 'self'; connect-src 'self' https: data: blob:; frame-src 'self' https:; object-src 'none'";

fn respond(
    request: &Request<Vec<u8>>,
    load: impl FnOnce(&str) -> Option<(Vec<u8>, &'static str)>,
) -> Response<Vec<u8>> {
    let refuse = |status, reason: &str| {
        Response::builder()
            .status(status)
            .header("Content-Type", "text/plain; charset=utf-8")
            .header("Access-Control-Allow-Origin", "*")
            .body(reason.as_bytes().to_vec())
            .expect("valid asset refusal")
    };
    // The application's own host alone (O-I #747 round 896, 1R-authority.6, F6; material_protocol.rs APPLICATION_HOSTS).
    if !request
        .uri()
        .host()
        .is_some_and(|host| crate::material_protocol::APPLICATION_HOSTS.contains(&host))
    {
        return refuse(
            StatusCode::FORBIDDEN,
            "This webview cannot load hosted application assets",
        );
    }
    if request.method() != Method::GET && request.method() != Method::HEAD {
        return refuse(
            StatusCode::METHOD_NOT_ALLOWED,
            "Application assets are read-only",
        );
    }
    let Some(key) = request
        .uri()
        .path()
        .strip_prefix("/__application")
        .and_then(asset_key)
    else {
        return refuse(
            StatusCode::FORBIDDEN,
            "Only files within the Expressions application are admitted",
        );
    };
    let Some((bytes, source)) = load(&key) else {
        return refuse(
            StatusCode::NOT_FOUND,
            "This candidate has no built Expressions asset at the requested path",
        );
    };
    Response::builder()
        .status(StatusCode::OK)
        .header(
            "Content-Type",
            oi_cradle_kernel::files::material_content_type(None, &key),
        )
        .header("Content-Length", bytes.len())
        .header("Cache-Control", "no-store")
        .header("Access-Control-Allow-Origin", "*")
        .header("X-Content-Type-Options", "nosniff")
        .header("Content-Security-Policy", APPLICATION_POLICY)
        .header("X-OI-Asset-Source", source)
        .body(if request.method() == Method::HEAD {
            Vec::new()
        } else {
            bytes
        })
        .expect("valid hosted asset response")
}

#[cfg(test)]
mod tests {
    use super::*;
    fn request(path: &str) -> Request<Vec<u8>> {
        Request::builder()
            .uri(format!(
                "oi-material://application.localhost/__application{path}"
            ))
            .body(Vec::new())
            .unwrap()
    }
    #[test]
    fn protocol_refuses_traversal_before_asset_resolution() {
        for path in ["/index.html", "/expressions/%2e%2e/index.html"] {
            let response = respond(&request(path), |_| panic!("refused request reached assets"));
            assert_eq!(response.status(), StatusCode::FORBIDDEN);
        }
    }
    #[test]
    fn a_key_is_found_bare_or_under_the_candidates_application_prefix() {
        let candidate = ["/app/index.html", "/__application/expressions/library.html"];
        assert_eq!(
            embedded_name(candidate, "expressions/library.html").as_deref(),
            Some("__application/expressions/library.html")
        );
        assert_eq!(
            embedded_name(["/expressions/index.html"], "expressions/index.html").as_deref(),
            Some("expressions/index.html")
        );
        assert_eq!(embedded_name(candidate, "expressions/missing.html"), None);
        assert_eq!(
            embedded_name(
                ["/app/expressions/library.html"],
                "expressions/library.html"
            ),
            None
        );
    }
    #[test]
    fn embedded_response_keeps_exact_bytes_and_missing_asset_is_not_shell_html() {
        let bytes = include_bytes!("../../expressions-app/index.html").to_vec();
        let response = respond(&request("/expressions/index.html?mode=techne"), |_| {
            Some((bytes.clone(), "bundled"))
        });
        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(response.body(), &bytes);
        assert_eq!(response.headers()["X-OI-Asset-Source"], "bundled");
        assert_eq!(
            respond(&request("/expressions/missing.html"), |_| None).status(),
            StatusCode::NOT_FOUND
        );
    }
    /// 1T item 10 (L5): every document and asset of the application carries its policy, and nothing in it lets a script, a read or a
    /// frame come from the personal material host (or any host but the application's own, for scripts).
    #[test]
    fn every_application_response_carries_the_application_policy() {
        for path in [
            "/expressions/index.html?mode=expressions",
            "/expressions/assets/index.js",
        ] {
            let response = respond(&request(path), |_| Some((b"x".to_vec(), "bundled")));
            assert_eq!(response.status(), StatusCode::OK, "{path}");
            let policy = response
                .headers()
                .get("Content-Security-Policy")
                .unwrap_or_else(|| panic!("{path} carries no policy"))
                .to_str()
                .unwrap();
            let directive = |name: &str| -> Vec<&str> {
                policy
                    .split(';')
                    .map(str::split_whitespace)
                    .find_map(|mut words| (words.next() == Some(name)).then(|| words.collect()))
                    .unwrap_or_else(|| panic!("{path}: no {name}"))
            };
            assert_eq!(
                directive("script-src"),
                ["'self'", "'unsafe-inline'"],
                "{path}"
            );
            assert_eq!(directive("object-src"), ["'none'"], "{path}");
            assert_eq!(directive("worker-src"), ["'self'"], "{path}");
            for name in ["connect-src", "frame-src"] {
                for source in directive(name) {
                    assert!(
                        !(source == "*"
                            || source.starts_with("oi-material")
                            || source.contains("oi-material.localhost")),
                        "{path}: {name} admits {source}"
                    );
                }
            }
        }
    }
    /// 1R-authority.6 (F6): the material host, which serves personal pages, is never given the application's code.
    #[test]
    fn the_application_is_served_from_its_own_host_alone() {
        for origin in [
            "oi-material://localhost",
            "http://oi-material.localhost",
            "oi-material://application",
        ] {
            let request = Request::builder()
                .uri(format!("{origin}/__application/expressions/index.html"))
                .body(Vec::new())
                .unwrap();
            assert_eq!(
                respond(&request, |_| panic!("{origin} reached the assets")).status(),
                StatusCode::FORBIDDEN,
                "{origin}"
            );
        }
        let windows = Request::builder()
            .uri("http://oi-material.application.localhost/__application/expressions/index.html")
            .body(Vec::new())
            .unwrap();
        assert_eq!(
            respond(&windows, |_| Some((b"x".to_vec(), "bundled"))).status(),
            StatusCode::OK
        );
    }
}
