//! Clean-room stub of the Hermes `tui_gateway` stdio JSON-RPC contract.
//! Written from the reverse-engineered spec (A1-gateway-surface.md); every
//! captured-case branch cites its replay vector. Not a translation of the
//! Python source — behavior only, at the boundaries the captures pin.

use std::io::{self, BufRead, Write};
use std::process::Command;

use serde_json::{json, Map, Value};
use uuid::Uuid;

// Captured default-skin gateway.ready payload (capture frame 1), replay_epoch
// substituted at startup — it is a fresh uuid4 per process.
const READY_PARAMS_TEMPLATE: &str = r##"{"skin":{"name":"default","colors":{"banner_border":"#CD7F32","banner_title":"#FFD700","banner_accent":"#FFBF00","banner_dim":"#B8860B","banner_text":"#FFF8DC","ui_accent":"#FFBF00","ui_label":"#DAA520","ui_ok":"#4caf50","ui_error":"#ef5350","ui_warn":"#ffa726","prompt":"#FFF8DC","input_rule":"#CD7F32","response_border":"#FFD700","status_bar_bg":"#1a1a2e","status_bar_text":"#C0C0C0","status_bar_strong":"#FFD700","status_bar_dim":"#8A7A4A","status_bar_good":"#8FBC8F","status_bar_warn":"#FFD700","status_bar_bad":"#FF8C00","status_bar_critical":"#FF6B6B","session_label":"#DAA520","session_border":"#8B8682","completion_menu_bg":"#1a1a2e","completion_menu_current_bg":"#333355","selection_bg":"#3a3a55","shell_dollar":"#4dabf7","voice_status_bg":"#1a1a2e"},"light_colors":{"banner_title":"#C8961E","banner_accent":"#D89B04","banner_dim":"#B8860B","banner_text":"#5C4718","ui_accent":"#D89B04","ui_label":"#A97E10","ui_ok":"#2E7D32","ui_error":"#C62828","ui_warn":"#D97706","prompt":"#5C4718","response_border":"#C8961E","session_label":"#A97E10","status_bar_text":"#6F6F6F","status_bar_strong":"#C8961E","status_bar_dim":"#9A8A5A","status_bar_good":"#2E7D32","status_bar_warn":"#C8961E","status_bar_bad":"#C2410C","status_bar_critical":"#B91C1C","shell_dollar":"#1E6FC0","completion_menu_bg":"#F5F5F5","completion_menu_current_bg":"#E0D1BF","selection_bg":"#D4E4F7","status_bar_bg":"#F5F5F5","voice_status_bg":"#F5F5F5"},"dark_colors":{},"branding":{"agent_name":"Hermes Agent","welcome":"Welcome to Hermes Agent! Type your message or /help for commands.","goodbye":"Goodbye! ⚕","response_label":" ⚕ Hermes ","prompt_symbol":"❯","help_header":"(^_^)? Available Commands"},"banner_logo":"","banner_hero":"","tool_prefix":"┊","help_header":"(^_^)? Available Commands"},"change_events":true,"replay_epoch":"__REPLAY_EPOCH__"}"##;

type RpcError = (i64, String);

fn main() {
    let stdout = io::stdout();
    let mut out = stdout.lock();

    let ready = READY_PARAMS_TEMPLATE.replace(
        "__REPLAY_EPOCH__",
        &Uuid::new_v4().simple().to_string(),
    );
    let payload = serde_json::from_str::<Value>(&ready).expect("ready template is valid JSON");
    let frame = json!({
        "jsonrpc": "2.0",
        "method": "event",
        "params": {"type": "gateway.ready", "payload": payload},
    });
    write_line(&mut out, &frame);

    let stdin = io::stdin();
    for line in stdin.lock().lines() {
        let line = match line {
            Ok(l) => l,
            Err(_) => break,
        };
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        let response = handle_line(trimmed);
        write_line(&mut out, &response);
    }
    eprintln!("[gateway-exit] stdin EOF (peer closed)");
}

fn write_line(out: &mut impl Write, value: &Value) {
    let mut buf = serde_json::to_string(value).expect("responses serialize");
    buf.push('\n');
    out.write_all(buf.as_bytes()).expect("stdout write");
    out.flush().expect("stdout flush");
}

fn handle_line(line: &str) -> Value {
    let parsed: Value = match serde_json::from_str(line) {
        Ok(v) => v,
        Err(_) => return error_response(Value::Null, -32700, "parse error"),
    };
    if !parsed.is_object() {
        return error_response(Value::Null, -32600, "invalid request: expected an object");
    }
    let req = parsed.as_object().unwrap();
    let id = req.get("id").cloned().unwrap_or(Value::Null);

    let method = match req.get("method") {
        Some(Value::String(m)) if !m.is_empty() => m.clone(),
        _ => {
            return error_response(id, -32600, "invalid request: method must be a non-empty string")
        }
    };

    let params = match req.get("params") {
        None | Some(Value::Null) => None,
        Some(Value::Object(_)) => req.get("params"),
        Some(_) => {
            return error_response(id, -32602, "invalid params: expected an object");
        }
    };

    match dispatch(&method, params.and_then(Value::as_object)) {
        Ok(result) => {
            let mut resp = Map::new();
            resp.insert("jsonrpc".into(), json!("2.0"));
            resp.insert("id".into(), id);
            resp.insert("result".into(), result);
            Value::Object(resp)
        }
        Err((code, message)) => error_response(id, code, &message),
    }
}

fn error_response(id: Value, code: i64, message: &str) -> Value {
    json!({
        "jsonrpc": "2.0",
        "id": id,
        "error": {"code": code, "message": message}
    })
}

fn dispatch(method: &str, params: Option<&Map<String, Value>>) -> Result<Value, RpcError> {
    match method {
        "ping" => Ok(json!({"pong": true})),
        "gateway.capabilities" => Ok(json!({"per_session_exclusive_submit": true})),
        "session.list" => Ok(json!({"sessions": []})),
        "session.most_recent" => Ok(json!({"session_id": null})),
        "setup.status" => Ok(json!({"provider_configured": provider_configured()})),
        "system.battery" => Ok(battery_status()),
        "free_tier.status" => Ok(json!({
            "has_guest": false,
            "enabled": false,
            "available": false,
            "notice_pending": false,
            "model": "nous/welcome",
            "label": "Nous · free tier"
        })),
        "config.get" => {
            let key = params
                .and_then(|p| p.get("key"))
                .and_then(Value::as_str)
                .map(str::to_owned);
            match key {
                // Only the captured shapes: absent key → 4002 (vector r4);
                // empty-string key → whole-config semantics (spec, unverified);
                // the stub carries no config catalog, so any named key is unknown.
                None => Err((4002, "unknown config key: ".to_string())),
                Some(k) if k.is_empty() => Ok(json!({})),
                Some(k) => Err((4002, format!("unknown config key: {k}"))),
            }
        }
        "session.delete" => {
            match params.and_then(|p| p.get("session_id")) {
                None => Err((4006, "session_id required".to_string())),
                Some(_) => Err((4001, "unknown session".to_string())),
            }
        }
        _ => Err((-32601, format!("unknown method: {method}"))),
    }
}

// The real gateway reports inherited-environment credentials; the stub's rule
// is a documented approximation over common provider key names. The replay
// harness normalizes this field (env-dependent in both implementations).
fn provider_configured() -> bool {
    const PROVIDER_ENV: &[&str] = &[
        "OPENAI_API_KEY",
        "ANTHROPIC_API_KEY",
        "GEMINI_API_KEY",
        "GOOGLE_API_KEY",
        "GROQ_API_KEY",
        "MISTRAL_API_KEY",
        "OPENROUTER_API_KEY",
        "XAI_API_KEY",
        "DEEPSEEK_API_KEY",
        "TOGETHER_API_KEY",
        "FIREWORKS_API_KEY",
    ];
    PROVIDER_ENV
        .iter()
        .any(|k| std::env::var(k).is_ok_and(|v| !v.trim().is_empty()))
}

fn battery_status() -> Value {
    let output = Command::new("pmset")
        .arg("-g")
        .arg("batt")
        .output()
        .ok()
        .map(|o| String::from_utf8_lossy(&o.stdout).to_string());
    let Some(text) = output else {
        return json!({"available": false, "percent": null, "plugged": null, "category": "unknown"});
    };
    let available = text.contains("InternalBattery");
    // pmset tokens carry trailing punctuation ("74%;"); scan the digits
    // immediately before each '%'.
    let percent = text
        .char_indices()
        .filter(|&(_, c)| c == '%')
        .find_map(|(i, _)| {
            let start = text[..i]
                .chars()
                .rev()
                .take_while(char::is_ascii_digit)
                .collect::<Vec<_>>();
            if start.is_empty() {
                return None;
            }
            start.iter().rev().collect::<String>().parse::<i64>().ok()
        });
    let plugged = text.contains("AC Power");
    let category = match percent {
        Some(p) if p >= 50 => "good",
        Some(p) if p >= 20 => "fair",
        Some(_) => "critical",
        None => "unknown",
    };
    json!({
        "available": available,
        "percent": percent,
        "plugged": if available { Some(plugged) } else { None },
        "category": category
    })
}
