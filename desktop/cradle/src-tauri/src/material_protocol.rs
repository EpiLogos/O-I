//! The `oi-material://` custom protocol (FND-04): the only way rich
//! material content (HTML, its relative assets, images, PDFs) reaches a
//! webview. The reserved `/__application/` route serves candidate-owned code
//! through the application asset owner, and at its one exact path the native
//! document frame (kernel `document_frame`); every personal-material byte passes
//! through the Central owner's
//! `central.files.read` (via the kernel's typed `KernelOp::FilesList` /
//! `KernelOp::FileBytes` seam) — this module resolves the URL grammar and
//! translates the owner reading into an HTTP response; it never touches
//! the filesystem directly and never grants a sandboxed iframe ambient
//! filesystem or native-bridge authority.
//!
//! URL grammar: `oi-material://localhost/<url-encoded location JSON>/<relative path>`.
//! The first path segment is a `central.path-ref/v1` `Location` (schema,
//! ref, root, path) as JSON, percent-encoded whole. An empty remaining
//! path serves that location itself (the material's own document); a
//! non-empty remaining path is resolved as a sibling of that location's
//! directory, one owner-verified directory listing per path component —
//! so a name that does not appear in a real Central listing can never be
//! reached, and `..`/absolute segments are refused outright before any
//! owner call is made.
use oi_cradle_kernel::files::MaterialRouteError;
use oi_cradle_kernel::KernelOpResult;
use tauri::http::{Request, Response, StatusCode};
use tauri::{AppHandle, Manager, Runtime};

use crate::KernelHost;

const SCHEME: &str = "oi-material";

pub fn register<R: Runtime>(builder: tauri::Builder<R>) -> tauri::Builder<R> {
    builder.register_asynchronous_uri_scheme_protocol(SCHEME, |context, request, responder| {
        if context.webview_label().starts_with("browser-") {
            responder.respond(refuse(
                StatusCode::FORBIDDEN,
                "Browser pages cannot read Central material",
            ));
            return;
        }
        let app_handle = context.app_handle().clone();
        std::thread::spawn(move || {
            responder.respond(handle(&app_handle, &request));
        });
    })
}

/// The application's own host (O-I #747 round 896, 1R-authority.6, F6): `oi-material://application.localhost`, served on Windows and
/// Android as `http://oi-material.application.localhost` (wry's form of a custom protocol, a subdomain of localhost there, so its
/// documents stay a secure context). It answers `/__application/` alone, so the Expressions application's origin holds no personal
/// material page and no material page holds the application's origin. The personal material host (`localhost`) answers everything
/// else, and never `/__application/`.
pub(crate) const APPLICATION_HOSTS: [&str; 2] =
    ["application.localhost", "oi-material.application.localhost"];

/// Which of the protocol's routes a request's host and path take (F6).
#[derive(Debug, PartialEq, Eq)]
enum Route {
    Application,
    /// Personal material, the World, the document frame: everything the material host answers.
    Material,
    Refused(StatusCode, &'static str),
}
fn route(host: Option<&str>, path: &str) -> Route {
    let application = host.is_some_and(|host| APPLICATION_HOSTS.contains(&host));
    // The native document frame stands under `/__application/` at the material host (the kernel's `document_frame::PATH`, answered
    // by its own host rule): it is no part of the Expressions application, so the application's host does not answer it and the
    // material host's refusal of `/__application/` does not reach it.
    let frame = path == oi_cradle_kernel::document_frame::PATH;
    match (application, path.starts_with("/__application/") && !frame) {
        (true, true) => Route::Application,
        (true, false) => Route::Refused(
            StatusCode::NOT_FOUND,
            "The application's host serves the Expressions application alone",
        ),
        (false, true) => Route::Refused(
            StatusCode::FORBIDDEN,
            "The Expressions application is served from its own host, not the material's",
        ),
        (false, false) => Route::Material,
    }
}

fn handle<R: Runtime>(app_handle: &AppHandle<R>, request: &Request<Vec<u8>>) -> Response<Vec<u8>> {
    let path = request.uri().path();
    match route(request.uri().host(), path) {
        Route::Application => return crate::app_assets::handle(app_handle, request),
        Route::Refused(status, words) => return refuse(status, words),
        Route::Material => {}
    }
    // The native document frame (kernel `document_frame`): candidate-owned code compiled into this binary, answered at
    // its one exact path, which `route` lets through to the material host alone (the application's own host admits only the
    // Expressions build). A Central document face's iframe loads it under Tauri because a srcdoc document inherits the window's
    // CSP; it reads no file.
    let host = request.uri().host();
    if let Some(page) =
        oi_cradle_kernel::document_frame::serve(host, request.method().as_str(), path)
    {
        return document_frame(page);
    }
    // The installed World (Essay #78): a derived artifact outside any Central ground, so it is not
    // read through `central.files.read`. Its own, smaller law lives in the kernel
    // (`world_resolve::serve`): only files the revision's `world.files.json` lists, only with
    // matching bytes, nothing outside the revision directory.
    if let Some(rest) = path.strip_prefix("/__world/") {
        return world_file(rest);
    }
    let mut segments = path.split('/').filter(|segment| !segment.is_empty());

    let Some(encoded_location) = segments.next() else {
        return refuse(StatusCode::NOT_FOUND, "No material location in the request");
    };
    let Some(location) = decode_location(encoded_location) else {
        return refuse(
            StatusCode::NOT_FOUND,
            "Material location is not a valid Central path reference",
        );
    };

    let mut relative = Vec::new();
    for raw in segments {
        match percent_decode(raw) {
            Some(segment)
                if segment == ".."
                    || segment == "."
                    || segment.is_empty()
                    || segment.contains('/') =>
            {
                return refuse(
                    StatusCode::FORBIDDEN,
                    "Traversal outside the material directory is refused",
                );
            }
            Some(segment) => relative.push(segment),
            None => {
                return refuse(
                    StatusCode::FORBIDDEN,
                    "Material path segment is not validly encoded",
                )
            }
        }
    }

    // Through the kernel's one dispatch (files::read_material), as the dev bridge's /material route already reads: the listing and
    // the bytes are prepared owner reads, so a document's material never holds the kernel lock while Central answers.
    let host = app_handle.state::<KernelHost>();
    // Each op the route dispatches writes its timing line (kernel dispatch.rs `trace_op`).
    let mut trace = |name: &str,
                     ok: bool,
                     total: std::time::Duration,
                     timing: &oi_cradle_kernel::dispatch::Timing| {
        oi_cradle_kernel::dispatch::trace_op("native", name, ok, total, timing)
    };
    let (target, bytes) = match oi_cradle_kernel::files::read_material_observed(
        &host.0, &location, &relative, &mut trace,
    ) {
        Ok(read) => read,
        Err(MaterialRouteError::Forbidden(message)) => {
            return refuse(StatusCode::FORBIDDEN, &message)
        }
        Err(MaterialRouteError::NotFound(message)) => return owner_error(&message),
    };

    match bytes {
        Ok(outcome) => match outcome.result {
            KernelOpResult::FileBytes {
                byte_len: _,
                mime_hint,
                content_base64,
                ..
            } => {
                match base64_decode(&content_base64) {
                    Some(bytes) => {
                        let content_type = content_type_for(mime_hint.as_deref(), &target.path);
                        // Presentation-only observation and document-host bridges;
                        // owner bytes remain untouched.
                        let bytes = if content_type.starts_with("text/html") {
                            match String::from_utf8(bytes.clone()) {
                                Ok(mut html) => {
                                    html.push_str("<script>");
                                    html.push_str(include_str!(
                                        "../../src/context/page-context.js"
                                    ));
                                    html.push_str("</script><script>");
                                    html.push_str(include_str!(
                                        "../../src/context/document-host.js"
                                    ));
                                    html.push_str("</script>");
                                    html.into_bytes()
                                }
                                Err(_) => bytes,
                            }
                        } else {
                            bytes
                        };
                        personal_material(&content_type, bytes)
                    }
                    None => refuse(
                        StatusCode::NOT_FOUND,
                        "Central returned an unreadable material encoding",
                    ),
                }
            }
            _ => refuse(
                StatusCode::NOT_FOUND,
                "Central returned an unsupported material reading",
            ),
        },
        Err(message) => owner_error(&message),
    }
}

/// A personal material reading as the material host answers it. It answers no cross-origin read (O-I #747 round 896 1T item 20,
/// DLW build ruling 2026-11-09): no `Access-Control-Allow-Origin`, so no other origin's script reads these bytes, an opaque
/// (`null`) one least of all. Every document that can be made with an opaque origin sends `Origin: null` (a sandboxed `srcdoc`, a
/// `data:` frame, the material surface's own sandboxed pages), so answering `null` answered them all: any of them could read any
/// personal material it named. The shell never read material this way; it reads through the kernel. What a person's own HTML
/// page loads from beside it without CORS still loads (classic scripts, stylesheets, images, media); its module scripts, fonts and
/// `fetch` of siblings, which are CORS reads from an opaque origin, do not.
fn personal_material(content_type: &str, bytes: Vec<u8>) -> Response<Vec<u8>> {
    Response::builder()
        .status(StatusCode::OK)
        .header("Content-Type", content_type)
        .header("Cache-Control", "no-store")
        .header("X-Content-Type-Options", "nosniff")
        .body(bytes)
        .unwrap_or_else(|_| {
            refuse(
                StatusCode::NOT_FOUND,
                "Material response could not be built",
            )
        })
}

/// The document frame page carries no Content-Security-Policy, deliberately: the form written into it runs its own
/// scripts (a form that brings its own policy, as the Day die's projection does, keeps it). Never cached.
fn document_frame(page: oi_cradle_kernel::document_frame::FramePage) -> Response<Vec<u8>> {
    Response::builder()
        .status(StatusCode::from_u16(page.status).unwrap_or(StatusCode::NOT_FOUND))
        .header("Content-Type", page.content_type)
        .header("Cache-Control", "no-store")
        .header("X-Content-Type-Options", "nosniff")
        .body(page.body)
        .unwrap_or_else(|_| {
            refuse(
                StatusCode::NOT_FOUND,
                "Document frame response could not be built",
            )
        })
}

fn world_file(rest: &str) -> Response<Vec<u8>> {
    let served = oi_cradle_kernel::world_resolve::serve(rest);
    let status = StatusCode::from_u16(served.status).unwrap_or(StatusCode::NOT_FOUND);
    let mut response = Response::builder()
        .status(status)
        .header("Content-Type", served.content_type)
        .header("Cache-Control", "no-store")
        .header("X-Content-Type-Options", "nosniff");
    if status == StatusCode::OK {
        // Public, read-only edition bytes; the app's own origin reads them with `fetch`.
        response = response.header("Access-Control-Allow-Origin", "*");
    }
    response
        .body(served.body)
        .unwrap_or_else(|_| refuse(StatusCode::NOT_FOUND, "World response could not be built"))
}

fn decode_location(encoded: &str) -> Option<oi_cradle_kernel::files::Location> {
    let json = percent_decode(encoded)?;
    serde_json::from_str(&json).ok()
}

fn percent_decode(input: &str) -> Option<String> {
    let bytes = input.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        match bytes[index] {
            b'%' => {
                let hex = input.get(index + 1..index + 3)?;
                let byte = u8::from_str_radix(hex, 16).ok()?;
                out.push(byte);
                index += 3;
            }
            b'+' => {
                out.push(b' ');
                index += 1;
            }
            byte => {
                out.push(byte);
                index += 1;
            }
        }
    }
    String::from_utf8(out).ok()
}

/// A dependency-free base64 decoder: material bytes travel from Central to
/// this handler as base64 (kernel `FileBytes`), and decoding a small,
/// locally-owned alphabet does not warrant a new Cargo dependency here.
fn base64_decode(input: &str) -> Option<Vec<u8>> {
    fn value(byte: u8) -> Option<u8> {
        match byte {
            b'A'..=b'Z' => Some(byte - b'A'),
            b'a'..=b'z' => Some(byte - b'a' + 26),
            b'0'..=b'9' => Some(byte - b'0' + 52),
            b'+' => Some(62),
            b'/' => Some(63),
            _ => None,
        }
    }
    let mut out = Vec::new();
    let mut buffer = 0u32;
    let mut bits = 0u32;
    for byte in input.bytes() {
        if byte == b'=' || byte.is_ascii_whitespace() {
            continue;
        }
        let value = value(byte)?;
        buffer = (buffer << 6) | value as u32;
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            out.push((buffer >> bits) as u8);
        }
    }
    Some(out)
}

/// Owner mime sniff first (Central's magic-byte/extension disclosure);
/// falls back to a small local extension table only when the owner
/// disclosed no hint at all.
fn content_type_for(mime_hint: Option<&str>, path: &str) -> String {
    oi_cradle_kernel::files::material_content_type(mime_hint, path)
}

fn refuse(status: StatusCode, message: &str) -> Response<Vec<u8>> {
    Response::builder()
        .status(status)
        .header("Content-Type", "text/plain; charset=utf-8")
        .header("Cache-Control", "no-store")
        .body(message.as_bytes().to_vec())
        .expect("a plain-text refusal body always builds")
}

/// Owner errors do not disclose a structured refusal reason at the kernel
/// seam (`CentralClient::run` folds every non-`ok` answer into one
/// message string) — retrieval exclusion is recognisable by its owner
/// message text and maps to 403; everything else this handler cannot
/// otherwise classify is an honest 404, never a fabricated success.
fn owner_error(message: &str) -> Response<Vec<u8>> {
    if message.contains("no-agent-retrieval") || message.contains("excluded") {
        refuse(StatusCode::FORBIDDEN, message)
    } else {
        refuse(StatusCode::NOT_FOUND, message)
    }
}

#[cfg(test)]
mod route_tests {
    use super::{route, Route};
    use tauri::http::StatusCode;

    /// 1T item 20 (L5 at the root): personal material answers no cross-origin read, an opaque origin's least of all; the public
    /// World edition still answers every origin.
    #[test]
    fn personal_material_answers_no_cross_origin_read() {
        for (content_type, body) in [
            ("text/plain; charset=utf-8", b"personal words".to_vec()),
            (
                "text/javascript; charset=utf-8",
                b"export const ran = true;".to_vec(),
            ),
            ("font/woff2", vec![0, 1, 2]),
        ] {
            let response = super::personal_material(content_type, body.clone());
            assert_eq!(response.status(), StatusCode::OK, "{content_type}");
            assert_eq!(response.body(), &body, "{content_type}");
            assert_eq!(response.headers()["Content-Type"], content_type);
            assert_eq!(response.headers()["X-Content-Type-Options"], "nosniff");
            assert!(
                response
                    .headers()
                    .get("Access-Control-Allow-Origin")
                    .is_none(),
                "{content_type}: {:?}",
                response.headers().get("Access-Control-Allow-Origin")
            );
        }
        // Nowhere else in the protocol either: the public World edition's `*` is its one cross-origin answer.
        let source = include_str!("material_protocol.rs");
        let protocol = &source[..source.find("#[cfg(test)]").expect("the tests")];
        let answers: Vec<_> = protocol
            .lines()
            .filter(|line| line.contains("\"Access-Control-Allow-Origin\""))
            .map(str::trim)
            .collect();
        assert_eq!(
            answers,
            ["response = response.header(\"Access-Control-Allow-Origin\", \"*\");"]
        );
        assert!(protocol.contains("fn world_file(rest: &str)"));
    }

    /// O-I #747 round 896, 1R-authority.6 (F6): the application's host answers `/__application/` alone, and the material host never does.
    #[test]
    fn the_application_has_a_host_of_its_own() {
        for host in ["application.localhost", "oi-material.application.localhost"] {
            assert_eq!(
                route(Some(host), "/__application/expressions/index.html"),
                Route::Application,
                "{host}"
            );
            for path in [
                "/",
                "/%7B%22schema%22%7D/",
                "/__world/r/world.files.json",
                oi_cradle_kernel::document_frame::PATH,
                "/__applicationx/a",
            ] {
                assert_eq!(
                    route(Some(host), path),
                    Route::Refused(
                        StatusCode::NOT_FOUND,
                        "The application's host serves the Expressions application alone"
                    ),
                    "{host}{path}"
                );
            }
        }
        for host in [
            Some("localhost"),
            Some("oi-material.localhost"),
            Some("application"),
            Some("evil.localhost"),
            None,
        ] {
            assert_eq!(
                route(host, "/__application/expressions/index.html"),
                Route::Refused(
                    StatusCode::FORBIDDEN,
                    "The Expressions application is served from its own host, not the material's"
                ),
                "{host:?}"
            );
            assert_eq!(
                route(host, "/__world/r/world.files.json"),
                Route::Material,
                "{host:?}"
            );
        }
        // The native document frame stands under `/__application/` at the material host, which answers it (the kernel's
        // `document_frame::serve`, by its own host rule): it is no part of the Expressions application, and no refusal of the
        // material host's `/__application/` reaches it (the document faces' iframe, document-native-frame.test.mjs).
        for host in ["localhost", "oi-material.localhost"] {
            assert_eq!(
                route(Some(host), oi_cradle_kernel::document_frame::PATH),
                Route::Material,
                "{host}"
            );
        }
    }
}
