//! Source6 private serialization support extracted from the current native
//! File/Act owners. This owns no Act, store, time, source grant or material.
//! Full original owners and tests remain in the source reference inventory.
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::io::{self, Write};

pub(crate) const FILE_BYTES: usize = 4 * 1024 * 1024;
pub(crate) const LIVE_BYTES: usize = 64 * 1024 * 1024;
pub(crate) const MAX_DELIVERY_BYTES: usize = 4 * crate::expression::DOCUMENT_BYTES;

pub(crate) fn digest(bytes: &[u8]) -> String {
    format!("sha256:{:x}", Sha256::digest(bytes))
}
pub(crate) fn digest_ref(value: &str) -> bool {
    value.strip_prefix("sha256:").is_some_and(|hex| {
        hex.len() == 64
            && hex
                .bytes()
                .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
    })
}
struct Counter {
    bytes: usize,
    limit: usize,
    hash: Sha256,
}
impl Write for Counter {
    fn write(&mut self, bytes: &[u8]) -> io::Result<usize> {
        self.bytes = self
            .bytes
            .checked_add(bytes.len())
            .ok_or_else(|| io::Error::other("Expanded Act size overflow"))?;
        if self.bytes > self.limit {
            return Err(io::Error::other(
                "Expanded Act byte budget exceeded before cloning",
            ));
        }
        self.hash.update(bytes);
        Ok(bytes.len())
    }
    fn flush(&mut self) -> io::Result<()> {
        Ok(())
    }
}
pub(crate) fn measure<T: Serialize + ?Sized>(value: &T, limit: usize) -> Result<usize, String> {
    Ok(fingerprint(value, limit)?.0)
}

fn fingerprint<T: Serialize + ?Sized>(value: &T, limit: usize) -> Result<(usize, String), String> {
    let mut output = Counter {
        bytes: 0,
        limit,
        hash: Sha256::new(),
    };
    serde_json::to_writer(&mut output, value).map_err(|e| e.to_string())?;
    Ok((output.bytes, format!("sha256:{:x}", output.hash.finalize())))
}
