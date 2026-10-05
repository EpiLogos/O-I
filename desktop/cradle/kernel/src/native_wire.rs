//! Bounded serialization of native wire values. One streaming pass measures
//! the exact serialized bytes — and, when asked, digests them — without ever
//! cloning the value or buffering its full text. Shared by the file owner,
//! transport budget and registry admission; storage owners bring their own
//! bounds on top of these primitives.
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::io::Write;

/// Live native reply budget for one transport read.
pub(crate) const LIVE_BYTES: usize = 64 * 1024 * 1024;
const HASH_BUFFER_BYTES: usize = 8192;

struct Counter<const HASH: bool> {
    bytes: usize,
    limit: usize,
    hash: Sha256,
    hash_buffer: Vec<u8>,
}
impl<const HASH: bool> Write for Counter<HASH> {
    fn write(&mut self, bytes: &[u8]) -> std::io::Result<usize> {
        self.bytes = self
            .bytes
            .checked_add(bytes.len())
            .ok_or_else(|| std::io::Error::other("Native wire size overflow"))?;
        if self.bytes > self.limit {
            return Err(std::io::Error::other(
                "Native wire byte budget exceeded before cloning",
            ));
        }
        if HASH {
            let mut remaining = bytes;
            while !remaining.is_empty() {
                if self.hash_buffer.is_empty() && remaining.len() >= HASH_BUFFER_BYTES {
                    self.hash.update(remaining);
                    break;
                }
                let take = remaining
                    .len()
                    .min(HASH_BUFFER_BYTES - self.hash_buffer.len());
                self.hash_buffer.extend_from_slice(&remaining[..take]);
                remaining = &remaining[take..];
                if self.hash_buffer.len() == HASH_BUFFER_BYTES {
                    self.hash.update(&self.hash_buffer);
                    self.hash_buffer.clear();
                }
            }
        }
        Ok(bytes.len())
    }
    fn flush(&mut self) -> std::io::Result<()> {
        Ok(())
    }
}

pub(crate) fn measure<T: Serialize + ?Sized>(value: &T, limit: usize) -> Result<usize, String> {
    let mut output = Counter::<false> {
        bytes: 0,
        limit,
        hash: Sha256::new(),
        hash_buffer: Vec::new(),
    };
    serde_json::to_writer(&mut output, value).map_err(|e| e.to_string())?;
    Ok(output.bytes)
}

pub(crate) fn fingerprint<T: Serialize + ?Sized>(
    value: &T,
    limit: usize,
) -> Result<(usize, String), String> {
    let mut output = Counter::<true> {
        bytes: 0,
        limit,
        hash: Sha256::new(),
        hash_buffer: Vec::with_capacity(HASH_BUFFER_BYTES),
    };
    serde_json::to_writer(&mut output, value).map_err(|e| e.to_string())?;
    output.hash.update(&output.hash_buffer);
    Ok((output.bytes, format!("sha256:{:x}", output.hash.finalize())))
}
