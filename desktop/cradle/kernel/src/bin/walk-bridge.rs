//! The U0.4 walk bridge — a **dev-only** channel (map §3 D10: "a typed,
//! dev-only channel in the cradle … invoke operations, read state,
//! capture receipts"). It fronts the very same kernel the Tauri host
//! fronts, over plain HTTP, so the walk can drive the web bundle with the
//! kernel invoked for real. It grants no renderer authority: it speaks
//! only the typed `KernelOp` seam, exactly like the Tauri commands, and it
//! exists only for walks and development — it is never shipped.
//!
//! Endpoints (CORS-open, loopback by default):
//!   POST /op        body = one KernelOp JSON   -> {"ok":true,"outcome":…}
//!                                                or {"ok":false,"error":…}
//!   GET  /events?since=N  receipts at/after seq N (the ordered log)
//!   GET  /state            the kernel snapshot
//!   GET  /material/<url-encoded location JSON>/<relative path>
//!                          dev-only mirror of the Tauri `oi-material://`
//!                          protocol (FND-04), same resolution rules
//!                          (`oi_cradle_kernel::files::resolve_material`):
//!                          raw bytes, real Content-Type, never JSON.
//!
//! Usage: cargo run --bin walk-bridge [--bind 127.0.0.1:4179]

use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::{Arc, Mutex};

use oi_cradle_kernel::files::MaterialRouteError;
use oi_cradle_kernel::{events::KERNEL_EVENT_TOPIC, Kernel, KernelOp, KernelOpResult};

fn main() {
    let bind = std::env::args()
        .nth(1)
        .unwrap_or_else(|| "127.0.0.1:4179".to_owned());
    let listener = TcpListener::bind(&bind).expect("bind the walk bridge");
    let kernel = Arc::new(Mutex::new(Kernel::discover()));
    println!("oi-cradle walk bridge listening on http://{bind} (topic {KERNEL_EVENT_TOPIC})");
    for stream in listener.incoming() {
        let Ok(stream) = stream else { continue };
        let kernel = Arc::clone(&kernel);
        std::thread::spawn(move || {
            let mut stream = stream;
            loop {
                let Some(request) = read_request(&mut stream) else { return };
                respond(&mut stream, handle(&kernel, &request));
                if !request.keep_alive {
                    return;
                }
            }
        });
    }
}

struct Request {
    method: String,
    path: String,
    body: Vec<u8>,
    keep_alive: bool,
}

fn read_request(stream: &mut TcpStream) -> Option<Request> {
    let mut buffer = [0u8; 8192];
    let mut head = Vec::new();
    // Read until the end of the headers.
    loop {
        let read = stream.read(&mut buffer).ok()?;
        if read == 0 {
            return None;
        }
        head.extend_from_slice(&buffer[..read]);
        if let Some(split) = find_head_end(&head) {
            let head_text = String::from_utf8_lossy(&head[..split]).to_string();
            let mut lines = head_text.split("\r\n");
            let request_line = lines.next()?.to_owned();
            
            
            let mut content_length = 0usize;
            let mut keep_alive = false;
            for header in lines {
                let Some((name, value)) = header.split_once(':') else { continue };
                let name = name.trim().to_ascii_lowercase();
                let value = value.trim();
                if name == "content-length" {
                    content_length = value.parse().unwrap_or(0);
                }
                if name == "connection" && value.eq_ignore_ascii_case("keep-alive") {
                    keep_alive = true;
                }
            }
            let mut parts = request_line.split_whitespace();
            let method = parts.next().unwrap_or_default().to_owned();
            let path = parts.next().unwrap_or_default().to_owned();
            let mut body = head[split + 4..].to_vec();
            while body.len() < content_length {
                let read = stream.read(&mut buffer).ok()?;
                if read == 0 {
                    break;
                }
                body.extend_from_slice(&buffer[..read]);
            }
            body.truncate(content_length);
            return Some(Request { method, path, body, keep_alive });
        }
        if head.len() > 65536 {
            return None;
        }
    }
}

fn find_head_end(bytes: &[u8]) -> Option<usize> {
    bytes.windows(4).position(|window| window == b"\r\n\r\n")
}

/// Every response body is built through `serde_json` (never `format!`
/// string interpolation) so an owner error message containing a quote,
/// newline or other control character can never produce invalid JSON —
/// the F-01 finding ("Bad control character in string literal") this
/// bridge previously produced on a real owner error.
enum BridgeResponse {
    Json { status: u16, body: serde_json::Value },
    Binary { status: u16, content_type: String, body: Vec<u8> },
    Empty { status: u16 },
}
fn json_ok(fields: serde_json::Value) -> BridgeResponse {
    let mut body = serde_json::json!({"ok": true});
    if let (Some(target), Some(extra)) = (body.as_object_mut(), fields.as_object()) {
        target.extend(extra.clone());
    }
    BridgeResponse::Json { status: 200, body }
}
fn json_error(status: u16, message: impl Into<String>) -> BridgeResponse {
    BridgeResponse::Json { status, body: serde_json::json!({"ok": false, "error": message.into()}) }
}

fn handle(kernel: &Mutex<Kernel>, request: &Request) -> BridgeResponse {
    let path = request.path.split('?').next().unwrap_or("");
    match (request.method.as_str(), path) {
        ("OPTIONS", _) => BridgeResponse::Empty { status: 204 },
        ("GET", "/state") => {
            let kernel = kernel.lock().expect("kernel mutex");
            match serde_json::to_value(kernel.snapshot()) {
                Ok(snapshot) => json_ok(serde_json::json!({"snapshot": snapshot})),
                Err(error) => json_error(500, error.to_string()),
            }
        }
        ("GET", "/events") => {
            let kernel = kernel.lock().expect("kernel mutex");
            let since = request
                .path
                .split_once("since=")
                .map(|(_, value)| value.split('&').next().unwrap_or("0"))
                .and_then(|value| value.parse::<u64>().ok())
                .unwrap_or(0);
            match serde_json::to_value(kernel.event_log().since(since.max(1))) {
                Ok(receipts) => json_ok(serde_json::json!({"receipts": receipts})),
                Err(error) => json_error(500, error.to_string()),
            }
        }
        ("POST", "/op") => {
            let body = String::from_utf8_lossy(&request.body);
            let op: KernelOp = match serde_json::from_str(body.trim()) {
                Ok(op) => op,
                Err(error) => return json_error(400, format!("unreadable op: {error}")),
            };
            let mut kernel = kernel.lock().expect("kernel mutex");
            match kernel.apply(op) {
                Ok(outcome) => match serde_json::to_value(&outcome) {
                    Ok(outcome) => json_ok(serde_json::json!({"outcome": outcome})),
                    Err(error) => json_error(500, error.to_string()),
                },
                Err(error) => json_error(200, error),
            }
        }
        _ if request.method == "GET" && path.starts_with("/material/") => {
            material(kernel, &path["/material/".len()..])
        }
        _ => json_error(404, "unknown walk-bridge endpoint"),
    }
}

/// Dev-only mirror of the Tauri `oi-material://` protocol: identical
/// grammar (`<url-encoded location JSON>/<relative path>`) and identical
/// resolution (`oi_cradle_kernel::files::resolve_material`), so a walk
/// exercises the same traversal law the shipped protocol enforces.
fn material(kernel: &Mutex<Kernel>, rest: &str) -> BridgeResponse {
    let mut segments = rest.split('/').filter(|segment| !segment.is_empty());
    let Some(encoded_location) = segments.next() else {
        return json_error(404, "No material location in the request");
    };
    let Some(location) = percent_decode(encoded_location).and_then(|json| serde_json::from_str(&json).ok()) else {
        return json_error(404, "Material location is not a valid Central path reference");
    };
    let mut relative = Vec::new();
    for raw in segments {
        match percent_decode(raw) {
            Some(segment) => relative.push(segment),
            None => return json_error(403, "Material path segment is not validly encoded"),
        }
    }
    let mut kernel = kernel.lock().expect("kernel mutex");
    let target = match oi_cradle_kernel::files::resolve_material(&mut kernel, &location, &relative) {
        Ok(resolved) => resolved,
        Err(MaterialRouteError::Forbidden(message)) => return json_error(403, message),
        Err(MaterialRouteError::NotFound(message)) => return json_error(404, message),
    };
    match kernel.apply(KernelOp::FileBytes { location: target.clone() }) {
        Ok(outcome) => match outcome.result {
            KernelOpResult::FileBytes { mime_hint, content_base64, .. } => match base64_decode(&content_base64) {
                Some(body) => BridgeResponse::Binary { status: 200, content_type: content_type_for(mime_hint.as_deref(), &target.path), body },
                None => json_error(404, "Central returned an unreadable material encoding"),
            },
            _ => json_error(404, "Central returned an unsupported material reading"),
        },
        Err(message) => json_error(404, message),
    }
}

fn percent_decode(input: &str) -> Option<String> {
    let bytes = input.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        match bytes[index] {
            b'%' => {
                let byte = u8::from_str_radix(input.get(index + 1..index + 3)?, 16).ok()?;
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

/// Dependency-free base64 decode (mirrors `src-tauri/src/material_protocol.rs`).
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

fn content_type_for(mime_hint: Option<&str>, path: &str) -> String {
    oi_cradle_kernel::files::material_content_type(mime_hint, path)
}

fn respond(stream: &mut TcpStream, response: BridgeResponse) {
    let (status, content_type, body): (u16, String, Vec<u8>) = match response {
        BridgeResponse::Json { status, body } => (status, "application/json".into(), body.to_string().into_bytes()),
        BridgeResponse::Binary { status, content_type, body } => (status, content_type, body),
        BridgeResponse::Empty { status } => (status, "text/plain".into(), Vec::new()),
    };
    let reason = match status {
        200 => "OK",
        204 => "No Content",
        400 => "Bad Request",
        403 => "Forbidden",
        404 => "Not Found",
        _ => "Internal Server Error",
    };
    let headers = format!(
        "HTTP/1.1 {status} {reason}\r\nAccess-Control-Allow-Origin: *\r\n\
         Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n\
         Access-Control-Allow-Headers: content-type\r\n\
         Content-Type: {content_type}\r\nCache-Control: no-store\r\nContent-Length: {}\r\nConnection: keep-alive\r\n\r\n",
        body.len()
    );
    let _ = stream.write_all(headers.as_bytes());
    let _ = stream.write_all(&body);
    let _ = stream.flush();
}
