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
//!
//! Usage: cargo run --bin walk-bridge [--bind 127.0.0.1:4179]

use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::{Arc, Mutex};

use oi_cradle_kernel::{events::KERNEL_EVENT_TOPIC, Kernel, KernelOp};

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
            let method;
            let path;
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
            method = parts.next().unwrap_or_default().to_owned();
            path = parts.next().unwrap_or_default().to_owned();
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

fn handle(kernel: &Mutex<Kernel>, request: &Request) -> (u16, String) {
    match (request.method.as_str(), request.path.split('?').next().unwrap_or("")) {
        ("OPTIONS", _) => (204, String::new()),
        ("GET", "/state") => {
            let kernel = kernel.lock().expect("kernel mutex");
            match serde_json::to_string(&kernel.snapshot()) {
                Ok(payload) => (200, format!("{{\"ok\":true,\"snapshot\":{payload}}}")),
                Err(error) => (500, format!("{{\"ok\":false,\"error\":\"{error}\"}}")),
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
            match serde_json::to_string(kernel.event_log().since(since.max(1))) {
                Ok(payload) => (200, format!("{{\"ok\":true,\"receipts\":{payload}}}")),
                Err(error) => (500, format!("{{\"ok\":false,\"error\":\"{error}\"}}")),
            }
        }
        ("POST", "/op") => {
            let body = String::from_utf8_lossy(&request.body);
            let op: KernelOp = match serde_json::from_str(body.trim()) {
                Ok(op) => op,
                Err(error) => {
                    return (400, format!("{{\"ok\":false,\"error\":\"unreadable op: {error}\"}}"))
                }
            };
            let mut kernel = kernel.lock().expect("kernel mutex");
            match kernel.apply(op) {
                Ok(outcome) => match serde_json::to_string(&outcome) {
                    Ok(payload) => (200, format!("{{\"ok\":true,\"outcome\":{payload}}}")),
                    Err(error) => (500, format!("{{\"ok\":false,\"error\":\"{error}\"}}")),
                },
                Err(error) => (200, format!("{{\"ok\":false,\"error\":\"{error}\"}}")),
            }
        }
        _ => (404, "{\"ok\":false,\"error\":\"unknown walk-bridge endpoint\"}".to_owned()),
    }
}

fn respond(stream: &mut TcpStream, (status, payload): (u16, String)) {
    let reason = match status {
        200 => "OK",
        204 => "No Content",
        400 => "Bad Request",
        404 => "Not Found",
        _ => "Internal Server Error",
    };
    let headers = format!(
        "HTTP/1.1 {status} {reason}\r\nAccess-Control-Allow-Origin: *\r\n\
         Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n\
         Access-Control-Allow-Headers: content-type\r\n\
         Content-Type: application/json\r\nContent-Length: {}\r\nConnection: keep-alive\r\n\r\n",
        payload.len()
    );
    let _ = stream.write_all(headers.as_bytes());
    let _ = stream.write_all(payload.as_bytes());
    let _ = stream.flush();
}
