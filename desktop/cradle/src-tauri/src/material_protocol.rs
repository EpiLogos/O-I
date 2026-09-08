//! The `oi-material://` custom protocol (FND-04): the only way rich
//! material content (HTML, its relative assets, images, PDFs) reaches a
//! webview. Every byte still passes through the Central owner's
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
use oi_cradle_kernel::{KernelOp, KernelOpResult};
use tauri::http::{Request, Response, StatusCode};
use tauri::{AppHandle, Manager, Runtime};

use crate::KernelHost;

const SCHEME: &str = "oi-material";

pub fn register<R: Runtime>(builder: tauri::Builder<R>) -> tauri::Builder<R> {
    builder.register_asynchronous_uri_scheme_protocol(SCHEME, |context, request, responder| {
        let app_handle = context.app_handle().clone();
        std::thread::spawn(move || {
            responder.respond(handle(&app_handle, &request));
        });
    })
}

fn handle<R: Runtime>(app_handle: &AppHandle<R>, request: &Request<Vec<u8>>) -> Response<Vec<u8>> {
    let path = request.uri().path();
    let mut segments = path.split('/').filter(|segment| !segment.is_empty());

    let Some(encoded_location) = segments.next() else {
        return refuse(StatusCode::NOT_FOUND, "No material location in the request");
    };
    let Some(location) = decode_location(encoded_location) else {
        return refuse(StatusCode::NOT_FOUND, "Material location is not a valid Central path reference");
    };

    let mut relative = Vec::new();
    for raw in segments {
        match percent_decode(raw) {
            Some(segment) if segment == ".." || segment == "." || segment.is_empty() || segment.contains('/') => {
                return refuse(StatusCode::FORBIDDEN, "Traversal outside the material directory is refused");
            }
            Some(segment) => relative.push(segment),
            None => return refuse(StatusCode::FORBIDDEN, "Material path segment is not validly encoded"),
        }
    }

    let host = app_handle.state::<KernelHost>();
    let mut kernel = match host.0.lock() {
        Ok(kernel) => kernel,
        Err(_) => return refuse(StatusCode::NOT_FOUND, "Kernel is unavailable"),
    };

    let target = match oi_cradle_kernel::files::resolve_material(&mut kernel, &location, &relative) {
        Ok(resolved) => resolved,
        Err(MaterialRouteError::Forbidden(message)) => return refuse(StatusCode::FORBIDDEN, &message),
        Err(MaterialRouteError::NotFound(message)) => return owner_error(&message),
    };

    match kernel.apply(KernelOp::FileBytes { location: target.clone() }) {
        Ok(outcome) => match outcome.result {
            KernelOpResult::FileBytes { byte_len: _, mime_hint, content_base64, .. } => {
                match base64_decode(&content_base64) {
                    Some(bytes) => {
                        let content_type = content_type_for(mime_hint.as_deref(), &target.path);
                        Response::builder()
                            .status(StatusCode::OK)
                            .header("Content-Type", content_type)
                            .header("Cache-Control", "no-store")
                            // Sandboxed documents have opaque (null) origins.
                            // Allow their read-only module/font/data requests, never credentials.
                            .header("Access-Control-Allow-Origin", "null")
                            .header("X-Content-Type-Options", "nosniff")
                            .body(bytes)
                            .unwrap_or_else(|_| refuse(StatusCode::NOT_FOUND, "Material response could not be built"))
                    }
                    None => refuse(StatusCode::NOT_FOUND, "Central returned an unreadable material encoding"),
                }
            }
            _ => refuse(StatusCode::NOT_FOUND, "Central returned an unsupported material reading"),
        },
        Err(message) => owner_error(&message),
    }
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
