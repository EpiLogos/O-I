//! Candidate application assets are code owned by this checkout, never
//! Central personal material. The native adapter serves compiled assets;
//! this owner supplies bounded debug-build reads and validates URI admission.
#[cfg(any(debug_assertions, test))]
use std::path::Path;

/// Only a debug candidate may read its own explicitly built application.
#[cfg(debug_assertions)]
pub fn read_development_asset(key: &str) -> Option<Vec<u8>> {
    let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../expressions-app/dist");
    read_at(&root, key)
}

pub fn asset_key(path: &str) -> Option<String> {
    let mut decoded = Vec::new();
    let mut bytes = path.as_bytes().iter().copied();
    while let Some(byte) = bytes.next() {
        if byte == b'%' {
            let high = (bytes.next()? as char).to_digit(16)?;
            let low = (bytes.next()? as char).to_digit(16)?;
            decoded.push((high * 16 + low) as u8);
        } else { decoded.push(byte); }
    }
    let path = String::from_utf8(decoded).ok()?;
    let key = path.strip_prefix('/')?;
    if !key.starts_with("expressions/") || key.contains(['\\', '\0', '%']) { return None; }
    if key.split('/').any(|part| part.is_empty() || part == "." || part == "..") { return None; }
    Some(key.to_owned())
}

#[cfg(any(debug_assertions, test))]
fn read_at(root: &Path, key: &str) -> Option<Vec<u8>> {
    asset_key(&format!("/{key}"))?;
    let relative = key.strip_prefix("expressions/")?;
    let root = root.canonicalize().ok()?;
    let path = root.join(relative).canonicalize().ok()?;
    if !path.starts_with(&root) || !path.is_file() { return None; }
    std::fs::read(path).ok()
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn admission_refuses_traversal_and_other_application_files() {
        assert_eq!(asset_key("/expressions/assets/native.js"), Some("expressions/assets/native.js".into()));
        for path in ["/index.html", "/expressions/../index.html", "/expressions/%2e%2e/index.html", "/expressions/%252e%252e/index.html", "/expressions/%2fetc/passwd", "/expressions/a%5cb", "/expressions/%00", "/expressions/%zz"] {
            assert!(asset_key(path).is_none(), "admitted {path}");
        }
    }
    #[test]
    fn candidate_reads_exact_build_bytes_and_refuses_missing_or_escaped_files() {
        let root = std::env::temp_dir().join(format!("oi-hosted-assets-{}-{}", std::process::id(), std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()));
        let dist = root.join("dist");
        std::fs::create_dir_all(dist.join("assets")).unwrap();
        std::fs::write(dist.join("index.html"), b"<html>candidate hosted build</html>").unwrap();
        std::fs::write(dist.join("assets/native.js"), b"export const candidate = true;").unwrap();
        assert_eq!(read_at(&dist, "expressions/index.html").unwrap(), b"<html>candidate hosted build</html>");
        assert_eq!(read_at(&dist, "expressions/assets/native.js").unwrap(), b"export const candidate = true;");
        assert!(read_at(&dist, "expressions/missing.html").is_none());
        #[cfg(unix)] {
            std::fs::write(root.join("outside.txt"), b"outside").unwrap();
            std::os::unix::fs::symlink(root.join("outside.txt"), dist.join("escape.txt")).unwrap();
            assert!(read_at(&dist, "expressions/escape.txt").is_none());
        }
        std::fs::remove_dir_all(root).unwrap();
    }
}
