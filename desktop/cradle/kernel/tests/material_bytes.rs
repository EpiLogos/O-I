//! Integration with the real pinned/installed Central executable for the
//! binary-safe material read (FND-04). Owns temporary Central ground and a
//! real PNG-magic-byte fixture; no protocol stubs. Requires an owner build
//! that understands `central.files.read` with `encoding: "base64"` — set
//! `OI_CENTRAL_CTRL_BIN` to that candidate; the installed `ctrl` on PATH
//! predates this contract and will fail these assertions.
use std::{
    fs,
    path::PathBuf,
    process::Command,
    time::{SystemTime, UNIX_EPOCH},
};

use oi_cradle_kernel::{CentralClient, Kernel, KernelOp, KernelOpResult};

struct Ground {
    root: PathBuf,
    client: CentralClient,
}
impl Ground {
    fn new() -> Self {
        static SEQ: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
        let root = std::env::temp_dir().join(format!(
            "oi-kernel-material-bytes-{}-{}-{}",
            std::process::id(),
            SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos(),
            SEQ.fetch_add(1, std::sync::atomic::Ordering::Relaxed)
        ));
        fs::create_dir(&root).unwrap();
        let binary = std::env::var_os("OI_CENTRAL_CTRL_BIN")
            .map(PathBuf::from)
            .unwrap_or_else(|| "ctrl".into());
        let output = Command::new(&binary)
            .args(["--root"])
            .arg(&root)
            .args(["--json", "action", "run", "central.init", "{}"])
            .output()
            .expect("real ctrl must be installed, or OI_CENTRAL_CTRL_BIN must name the pinned build");
        assert!(output.status.success(), "{}", String::from_utf8_lossy(&output.stdout));
        let client = CentralClient::with(binary, Some(root.clone()), "material-bytes".into());
        Self { root, client }
    }
}
impl Drop for Ground {
    fn drop(&mut self) {
        fs::remove_dir_all(&self.root).unwrap();
    }
}

const PNG_BYTES: &[u8] = &[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 1, 2, 3, 4];

fn locate(ground: &Ground, name: &str) -> oi_cradle_kernel::files::Location {
    let listing = ground.client.run("central.files.list", serde_json::json!({"path": ""})).unwrap();
    let entries = listing["entries"].as_array().unwrap();
    let entry = entries.iter().find(|entry| entry["name"] == name).unwrap();
    serde_json::from_value(entry["location"].clone()).unwrap()
}

#[test]
#[ignore = "requires actual OI_CENTRAL_CTRL_BIN, or a real ctrl on PATH"]
fn binary_material_reads_base64_with_mime_hint_and_matches_bytes() {
    let ground = Ground::new();
    fs::write(ground.root.join("asset.png"), PNG_BYTES).unwrap();
    let mut kernel = Kernel::new(ground.client.clone());
    let location = locate(&ground, "asset.png");

    let outcome = kernel.apply(KernelOp::FileBytes { location: location.clone() }).unwrap();
    match outcome.result {
        KernelOpResult::FileBytes { location: returned, byte_len, mime_hint, content_base64, .. } => {
            assert_eq!(returned, location);
            assert_eq!(byte_len, PNG_BYTES.len() as u64);
            assert_eq!(mime_hint.as_deref(), Some("image/png"));
            let decoded = base64_decode(&content_base64);
            assert_eq!(decoded, PNG_BYTES);
        }
        other => panic!("expected FileBytes, got {other:?}"),
    }
}

#[test]
#[ignore = "requires actual OI_CENTRAL_CTRL_BIN, or a real ctrl on PATH"]
fn nul_containing_file_refuses_text_read_but_succeeds_as_material() {
    let ground = Ground::new();
    let bytes: &[u8] = &[0, 1, 2, 255, 0];
    fs::write(ground.root.join("mystery.bin"), bytes).unwrap();
    let mut kernel = Kernel::new(ground.client.clone());
    let location = locate(&ground, "mystery.bin");

    let text_result = kernel.apply(KernelOp::FileRead { location: location.clone() });
    assert!(text_result.is_err(), "NUL bytes must still refuse the UTF-8 text contract");

    let outcome = kernel.apply(KernelOp::FileBytes { location: location.clone() }).unwrap();
    match outcome.result {
        KernelOpResult::FileBytes { byte_len, content_base64, mime_hint, .. } => {
            assert_eq!(byte_len, bytes.len() as u64);
            assert_eq!(mime_hint, None, "an unrecognised extension and no magic bytes yields no hint");
            assert_eq!(base64_decode(&content_base64), bytes);
        }
        other => panic!("expected FileBytes, got {other:?}"),
    }
}

/// Minimal dependency-free base64 decoder for verifying the wire content in
/// tests only (the kernel itself never decodes — the encoded payload
/// travels intact to its eventual owner).
fn base64_decode(input: &str) -> Vec<u8> {
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
        if byte == b'=' {
            break;
        }
        let Some(v) = value(byte) else { continue };
        buffer = (buffer << 6) | v as u32;
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            out.push((buffer >> bits) as u8);
        }
    }
    out
}
