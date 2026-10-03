//! Bounded lossless control-side pages embedded in the existing native Act.
//! Hashes identify canonical bytes; they never admit playback or disclosure.
//! No allocation/codec operation runs on the audio callback.
use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::sync::OnceLock;

pub const SCHEMA: &str = "oi.expression-performance-page-codec/v1";
pub const MAX_DECODED_BYTES: usize = 4 * 1024 * 1024;
const WINDOW: usize = 65535;
const MIN_MATCH: usize = 8;
const MAX_CHAIN: usize = 32;
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct EncodedPage {
    schema: String,
    decoded_bytes: u32,
    decoded_sha256: String,
    payload: String,
    // Native bytes are private and immutable. Only this owner can qualify the
    // canonical stream. Serde never imports the qualification, and no expanded
    // body/page is retained by the cache. Clones preserve the same actual bytes.
    #[serde(skip)]
    canonical: OnceLock<()>,
}
impl PartialEq for EncodedPage {
    fn eq(&self, other: &Self) -> bool {
        self.schema == other.schema
            && self.decoded_bytes == other.decoded_bytes
            && self.decoded_sha256 == other.decoded_sha256
            && self.payload == other.payload
    }
}
impl Eq for EncodedPage {}
fn hash(bytes: &[u8]) -> String {
    format!("sha256:{:x}", Sha256::digest(bytes))
}
fn key(bytes: &[u8], at: usize) -> usize {
    let x = u32::from_le_bytes(bytes[at..at + 4].try_into().unwrap());
    (x.wrapping_mul(2654435761) >> 16) as usize
}
fn word(out: &mut Vec<u8>, n: usize) {
    out.extend_from_slice(&(n as u16).to_le_bytes());
}
fn literals(out: &mut Vec<u8>, input: &[u8]) {
    for block in input.chunks(WINDOW) {
        out.push(0);
        word(out, block.len());
        out.extend_from_slice(block);
    }
}
/// Deterministic finite-window LZ copy/literal stream. Hash-chain traversal is
/// capped; work is bounded by 32 candidates per input byte, independent of data.
fn encode(input: &[u8]) -> Vec<u8> {
    let mut heads = vec![usize::MAX; 65536];
    let mut links = vec![usize::MAX; input.len()];
    let mut out = Vec::new();
    let mut at = 0;
    let mut first = 0;
    while at + MIN_MATCH <= input.len() {
        let h = key(input, at);
        let mut candidate = heads[h];
        let mut best = 0;
        let mut distance = 0;
        for _ in 0..MAX_CHAIN {
            if candidate == usize::MAX || at - candidate > WINDOW {
                break;
            }
            let mut count = 0;
            let max = WINDOW.min(input.len() - at);
            while count < max && input[candidate + count] == input[at + count] {
                count += 1;
            }
            if count > best {
                best = count;
                distance = at - candidate;
            }
            candidate = links[candidate];
        }
        if best >= MIN_MATCH {
            literals(&mut out, &input[first..at]);
            out.push(1);
            word(&mut out, distance);
            word(&mut out, best);
            for (index, link) in links.iter_mut().enumerate().skip(at).take(best) {
                if index + MIN_MATCH <= input.len() {
                    let h = key(input, index);
                    *link = heads[h];
                    heads[h] = index;
                }
            }
            at += best;
            first = at;
        } else {
            links[at] = heads[h];
            heads[h] = at;
            at += 1;
        }
    }
    literals(&mut out, &input[first..]);
    out
}
fn read_word(bytes: &[u8], at: &mut usize) -> Result<usize, String> {
    let end = at.checked_add(2).ok_or("page offset overflow")?;
    let value = bytes.get(*at..end).ok_or("truncated page token")?;
    *at = end;
    Ok(u16::from_le_bytes(value.try_into().unwrap()) as usize)
}
impl EncodedPage {
    pub fn from_value<T: Serialize + ?Sized>(value: &T) -> Result<Self, String> {
        // Borrowed budget preflight BEFORE constructing expanded JSON bytes.
        crate::expression_act_storage::measure(value, MAX_DECODED_BYTES)?;
        let bytes = serde_json::to_vec(value).map_err(|e| e.to_string())?;
        if bytes.is_empty() || bytes.len() > MAX_DECODED_BYTES {
            return Err("performance decoded page budget exceeded".into());
        }
        Ok(Self {
            schema: SCHEMA.into(),
            decoded_bytes: bytes.len() as u32,
            decoded_sha256: hash(&bytes),
            payload: STANDARD.encode(encode(&bytes)),
            canonical: OnceLock::from(()),
        })
    }
    pub fn bytes(&self) -> Result<Vec<u8>, String> {
        if self.schema != SCHEMA
            || self.decoded_bytes == 0
            || self.decoded_bytes as usize > MAX_DECODED_BYTES
            || self.payload.len() > (MAX_DECODED_BYTES + 256) * 4 / 3 + 8
        {
            return Err("performance page contract/encoded/decoded budget differs".into());
        }
        let stream = STANDARD.decode(&self.payload).map_err(|e| e.to_string())?;
        if STANDARD.encode(&stream) != self.payload {
            return Err("noncanonical performance page base64".into());
        }
        let limit = self.decoded_bytes as usize;
        let mut out = Vec::with_capacity(limit);
        let mut at = 0;
        while at < stream.len() {
            let tag = stream[at];
            at += 1;
            match tag {
                0 => {
                    let length = read_word(&stream, &mut at)?;
                    let end = at.checked_add(length).ok_or("page literal overflow")?;
                    if length == 0 || out.len().checked_add(length).is_none_or(|n| n > limit) {
                        return Err("performance literal exceeds declared expansion".into());
                    }
                    out.extend_from_slice(stream.get(at..end).ok_or("truncated page literal")?);
                    at = end;
                }
                1 => {
                    let distance = read_word(&stream, &mut at)?;
                    let length = read_word(&stream, &mut at)?;
                    if distance == 0
                        || distance > out.len()
                        || length < MIN_MATCH
                        || out.len().checked_add(length).is_none_or(|n| n > limit)
                    {
                        return Err(
                            "performance page copy exceeds qualified window/expansion".into()
                        );
                    }
                    for _ in 0..length {
                        out.push(out[out.len() - distance]);
                    }
                }
                _ => return Err("unknown performance page token".into()),
            }
        }
        if out.len() != limit || hash(&out) != self.decoded_sha256 {
            return Err("performance page decoded length/hash differs".into());
        }
        if self.canonical.get().is_none() && encode(&out) != stream {
            return Err("performance page decoded length/hash/canonical stream differs".into());
        }
        let _ = self.canonical.set(());
        Ok(out)
    }
    pub(crate) fn decoded_digest(&self) -> &str {
        &self.decoded_sha256
    }
    pub fn read<T: serde::de::DeserializeOwned + Serialize>(&self) -> Result<T, String> {
        let bytes = self.bytes()?;
        let typed: T = serde_json::from_slice(&bytes).map_err(|e| e.to_string())?;
        if serde_json::to_vec(&typed).map_err(|e| e.to_string())? != bytes {
            return Err("performance page typed defaults/canonical bytes differ".into());
        }
        Ok(typed)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn canonical_requalification_is_private_and_imported_alternative_stream_refuses() {
        let value = serde_json::json!({"samples":["0","128","48000","18446744073709551615"],"receipts":vec![serde_json::json!({"kind":5,"requested_sample":"48000","value":0.12345678901234567});128]});
        let raw = serde_json::to_vec(&value).unwrap();
        let page = EncodedPage::from_value(&value).unwrap();
        let original = serde_json::to_vec(&page).unwrap();
        assert_eq!(page.bytes().unwrap(), raw);
        let imported: EncodedPage = serde_json::from_slice(&original).unwrap();
        assert!(imported.canonical.get().is_none());
        assert_eq!(imported.bytes().unwrap(), raw);
        assert!(imported.canonical.get().is_some());
        assert_eq!(imported.clone().bytes().unwrap(), raw);
        assert_eq!(serde_json::to_vec(&imported).unwrap(), original);
        assert_eq!(imported, page);
        let mut alternate = serde_json::to_value(&page).unwrap();
        let mut stream = Vec::new();
        literals(&mut stream, &raw);
        assert_ne!(stream, encode(&raw));
        alternate["payload"] = serde_json::json!(STANDARD.encode(&stream));
        let alternate: EncodedPage = serde_json::from_value(alternate).unwrap();
        assert!(alternate.canonical.get().is_none());
        assert!(alternate.bytes().unwrap_err().contains("canonical stream"));
        let mut supplied_cache = serde_json::to_value(&page).unwrap();
        supplied_cache["canonical"] = serde_json::json!(true);
        assert!(serde_json::from_value::<EncodedPage>(supplied_cache).is_err());
        let mut wrong = serde_json::to_value(&page).unwrap();
        wrong["decoded_sha256"] = serde_json::json!(hash(b"different"));
        assert!(serde_json::from_value::<EncodedPage>(wrong)
            .unwrap()
            .bytes()
            .is_err());
    }
}
