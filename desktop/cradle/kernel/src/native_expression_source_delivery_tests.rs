use super::*;
use std::io::{BufReader, Cursor};

#[test]
fn bounded_native_ingress_accepts_exact_real_json_line_and_leaves_next_line() {
    let original = br#"{"status":"refused","field":{"audio":[]}}"#;
    let mut bytes = original.to_vec();
    bytes.extend_from_slice(b"\n{\"later\":true}\n");
    let mut reader = BufReader::with_capacity(3, Cursor::new(bytes));
    let (value, consumed) = line_bounded_counted(&mut reader, original.len() + 1).unwrap();
    assert_eq!(consumed, original.len() + 1);
    assert_eq!(value, serde_json::from_slice::<Value>(original).unwrap());
    assert_eq!(line(&mut reader).unwrap(), json!({"later":true}));
}

#[test]
fn bounded_native_ingress_refuses_before_overflow_chunk_copy_and_does_not_parse_suffix() {
    let original = b"{\"actual\":12345}\n";
    let mut reader = BufReader::with_capacity(3, Cursor::new(original));
    let reason = line_bounded_counted(&mut reader, original.len() - 1).unwrap_err();
    assert!(reason.contains("original delivery unknown"));
    assert_eq!(reader.fill_buf().unwrap(), b"}\n");
}

#[test]
fn bounded_native_ingress_preserves_actual_eof_and_malformed_diagnostics() {
    let mut eof = BufReader::new(Cursor::new(b"{\"actual\":1}"));
    assert_eq!(
        line_bounded(&mut eof, 32).unwrap_err(),
        "native host closed before acknowledgement"
    );
    let mut malformed = BufReader::new(Cursor::new(b"{not-json}\n"));
    assert!(line_bounded(&mut malformed, 32)
        .unwrap_err()
        .contains("malformed native acknowledgement"));
    assert!(line_bounded(&mut malformed, 0)
        .unwrap_err()
        .contains("Invalid private"));
    assert!(line_bounded(&mut malformed, MAX_REPLY + 1)
        .unwrap_err()
        .contains("Invalid private"));
}

#[test]
fn private_aggregate_reply_allowance_counts_actual_queries_before_terminal() {
    let bytes = b"{\"query\":1}\n{\"terminal\":true}\n";
    let mut reader = BufReader::with_capacity(4, Cursor::new(bytes));
    let cap = bytes.len() - 1;
    let (query, first) = line_bounded_counted(&mut reader, cap).unwrap();
    assert_eq!(query, json!({"query":1}));
    assert!(line_bounded_counted(&mut reader, cap - first)
        .unwrap_err()
        .contains("original delivery unknown"));
}
