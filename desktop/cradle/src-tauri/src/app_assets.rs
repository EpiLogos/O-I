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
        let resolver = app.asset_resolver();
        if resolver.iter().any(|(name, _)| name.trim_start_matches('/') == key) {
            return resolver.get(key.to_owned()).map(|asset| (asset.bytes, "bundled"));
        }
        #[cfg(debug_assertions)]
        {
            return oi_cradle_kernel::application_asset::read_development_asset(key).map(|bytes| (bytes, "development-build"));
        }
        #[cfg(not(debug_assertions))]
        None
    })
}


fn respond(
    request: &Request<Vec<u8>>,
    load: impl FnOnce(&str) -> Option<(Vec<u8>, &'static str)>,
) -> Response<Vec<u8>> {
    let refuse = |status, reason: &str| Response::builder().status(status)
        .header("Content-Type", "text/plain; charset=utf-8")
        .header("Access-Control-Allow-Origin", "*")
        .body(reason.as_bytes().to_vec()).expect("valid asset refusal");
    if !matches!(request.uri().host(), Some("localhost" | "oi-material.localhost")) {
        return refuse(StatusCode::FORBIDDEN, "This webview cannot load hosted application assets");
    }
    if request.method() != Method::GET && request.method() != Method::HEAD {
        return refuse(StatusCode::METHOD_NOT_ALLOWED, "Application assets are read-only");
    }
    let Some(key) = request.uri().path().strip_prefix("/__application").and_then(asset_key) else {
        return refuse(StatusCode::FORBIDDEN, "Only files within the Expressions application are admitted");
    };
    let Some((bytes, source)) = load(&key) else {
        return refuse(StatusCode::NOT_FOUND, "This candidate has no built Expressions asset at the requested path");
    };
    Response::builder().status(StatusCode::OK)
        .header("Content-Type", oi_cradle_kernel::files::material_content_type(None, &key))
        .header("Content-Length", bytes.len())
        .header("Cache-Control", "no-store")
        .header("Access-Control-Allow-Origin", "*")
        .header("X-Content-Type-Options", "nosniff")
        .header("X-OI-Asset-Source", source)
        .body(if request.method() == Method::HEAD { Vec::new() } else { bytes })
        .expect("valid hosted asset response")
}

#[cfg(test)]
mod tests {
    use super::*;
    fn request(path: &str) -> Request<Vec<u8>> {
        Request::builder().uri(format!("oi-material://localhost/__application{path}")).body(Vec::new()).unwrap()
    }
    #[test]
    fn protocol_refuses_traversal_before_asset_resolution() {
        for path in ["/index.html", "/expressions/%2e%2e/index.html"] {
            let response = respond(&request(path), |_| panic!("refused request reached assets"));
            assert_eq!(response.status(), StatusCode::FORBIDDEN);
        }
    }
    #[test]
    fn embedded_response_keeps_exact_bytes_and_missing_asset_is_not_shell_html() {
        let bytes = include_bytes!("../../expressions-app/index.html").to_vec();
        let response = respond(&request("/expressions/index.html?mode=techne"), |_| Some((bytes.clone(), "bundled")));
        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(response.body(), &bytes);
        assert_eq!(response.headers()["X-OI-Asset-Source"], "bundled");
        assert_eq!(respond(&request("/expressions/missing.html"), |_| None).status(), StatusCode::NOT_FOUND);
    }
}
