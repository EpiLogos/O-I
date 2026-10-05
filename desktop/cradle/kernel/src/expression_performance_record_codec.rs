//! Private complete-record packing, never a native numerical or public body
//! representation. Original JSON bytes, pages, source and hashes are restored
//! before ordinary owner qualification. The physical and live limits remain.
use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::io::{self, Read, Write};

pub(crate) const SCHEMA: &str = "oi.expression-performance-record-codec/v1";
const MAX_EXPANDED: usize = crate::expression_act_storage::LIVE_BYTES;
const MAX_PHYSICAL: usize = crate::expression_file::FILE_BYTES;
const MAX_STREAM: usize = MAX_PHYSICAL / 4 * 3;

#[derive(Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct EncodedRecord {
    schema: String,
    expanded_bytes: u32,
    expanded_sha256: String,
    payload: String,
}

// Only a fully decoded, bounded and byte-qualified private envelope can create
// this proof. Public raw readers cannot acquire it by naming a schema.
pub(crate) struct PackedProof {
    bytes: Vec<u8>,
}
impl PackedProof {
    pub(crate) fn canonical<T: Serialize + ?Sized>(&self, value: &T) -> Result<(), String> {
        struct Compare<'a> {
            expected: &'a [u8],
            at: usize,
        }
        impl Write for Compare<'_> {
            fn write(&mut self, bytes: &[u8]) -> io::Result<usize> {
                let end = self
                    .at
                    .checked_add(bytes.len())
                    .ok_or_else(|| io::Error::other("packed native canonical stream overflow"))?;
                if self.expected.get(self.at..end) != Some(bytes) {
                    return Err(io::Error::other("packed native canonical record differs"));
                }
                self.at = end;
                Ok(bytes.len())
            }
            fn flush(&mut self) -> io::Result<()> {
                Ok(())
            }
        }
        let mut compared = Compare {
            expected: &self.bytes,
            at: 0,
        };
        serde_json::to_writer(&mut compared, value).map_err(|e| e.to_string())?;
        if compared.at != self.bytes.len() {
            return Err("packed native canonical record has omitted bytes".into());
        }
        Ok(())
    }
}

struct Output {
    bytes: Vec<u8>,
}
impl Write for Output {
    fn write(&mut self, bytes: &[u8]) -> io::Result<usize> {
        if self
            .bytes
            .len()
            .checked_add(bytes.len())
            .is_none_or(|n| n > MAX_STREAM)
        {
            return Err(io::Error::other(
                "packed native record exceeds physical 4 MiB",
            ));
        }
        self.bytes.extend_from_slice(bytes);
        Ok(bytes.len())
    }
    fn flush(&mut self) -> io::Result<()> {
        Ok(())
    }
}
fn compress(bytes: &[u8]) -> Result<Vec<u8>, String> {
    let params = brotli::enc::BrotliEncoderParams {
        quality: 3,
        lgwin: 22,
        ..Default::default()
    };
    let mut output = Output { bytes: Vec::new() };
    // The fallible complete encoder propagates FINISH/output-budget errors.
    // CompressorWriter::into_inner/Drop alone would silently swallow them.
    brotli::BrotliCompress(&mut io::Cursor::new(bytes), &mut output, &params)
        .map_err(|e| e.to_string())?;
    Ok(output.bytes)
}
impl EncodedRecord {
    pub(crate) fn from_value<T: Serialize + ?Sized>(value: &T) -> Result<Self, String> {
        crate::expression_act_storage::measure(value, MAX_EXPANDED)?;
        Self::from_bytes(&serde_json::to_vec(value).map_err(|e| e.to_string())?)
    }
    pub(crate) fn from_bytes(bytes: &[u8]) -> Result<Self, String> {
        if bytes.is_empty() || bytes.len() > MAX_EXPANDED {
            return Err("packed native decoded record exceeds live 64 MiB".into());
        }
        let result = Self {
            schema: SCHEMA.into(),
            expanded_bytes: bytes.len() as u32,
            expanded_sha256: crate::expression_file::digest(bytes),
            payload: STANDARD.encode(compress(bytes)?),
        };
        crate::expression_act_storage::measure(&result, MAX_PHYSICAL)?;
        Ok(result)
    }
    pub(crate) fn decode(&self) -> Result<(Value, PackedProof), String> {
        crate::expression_act_storage::measure(self, MAX_PHYSICAL)?;
        let declared = self.expanded_bytes as usize;
        if self.schema != SCHEMA
            || declared == 0
            || declared > MAX_EXPANDED
            || !crate::expression_file::digest_ref(&self.expanded_sha256)
            || self.payload.len() > MAX_PHYSICAL
        {
            return Err("packed native record contract/expansion differs".into());
        }
        let stream = STANDARD.decode(&self.payload).map_err(|e| e.to_string())?;
        if STANDARD.encode(&stream) != self.payload
            || stream.first().is_none_or(|b| b & 0x0f != 0x0b)
        {
            // Pinned encoder22 spells WBITS as low nibble0xB. Check BEFORE
            // decoder allocation; large-window/alternate headers are refused.
            return Err("packed native base64/fixed 4 MiB window differs".into());
        }
        let mut bytes = Vec::with_capacity(declared);
        brotli::Decompressor::new(io::Cursor::new(&stream), 4096)
            .take(declared as u64 + 1)
            .read_to_end(&mut bytes)
            .map_err(|e| e.to_string())?;
        if bytes.len() != declared
            || crate::expression_file::digest(&bytes) != self.expanded_sha256
            || compress(&bytes)? != stream
        {
            // Decoder EOF may leave buffered trailing bytes. Compare the
            // ENTIRE canonical stream, not only its first decoded prefix.
            return Err("packed native length/hash/canonical complete stream differs".into());
        }
        let crate::expression_file::UniqueValue(value) =
            serde_json::from_slice(&bytes).map_err(|e| e.to_string())?;
        Ok((value, PackedProof { bytes }))
    }
}

/// Actual physical private representation. Unique live weight is still counted
/// independently by the ordinary owner; selected bodies remain bounded at8MiB.
pub(crate) fn physical_bytes<T: Serialize + ?Sized>(value: &T) -> Result<usize, String> {
    let raw = crate::expression_act_storage::measure(value, MAX_EXPANDED)?;
    if raw <= MAX_PHYSICAL {
        return Ok(raw);
    }
    crate::expression_act_storage::measure(&EncodedRecord::from_value(value)?, MAX_PHYSICAL)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn complete_bytes_are_lossless_and_corrupt_bounds_hash_tail_window_and_keys_refuse() {
        let native = serde_json::json!({"source":"native body λ\n\"\\".repeat(400_000),
            "late":[null,false,18446744073709551615u64,0.12345678901234567]});
        let original = serde_json::to_vec(&native).unwrap();
        assert!(original.len() > MAX_PHYSICAL);
        let page = EncodedRecord::from_bytes(&original).unwrap();
        assert!(serde_json::to_vec(&page).unwrap().len() < MAX_PHYSICAL);
        let (value, proof) = page.decode().unwrap();
        assert_eq!(value, native);
        proof.canonical(&native).unwrap();
        let mut changed = native.clone();
        changed["late"][1] = Value::Bool(true);
        assert!(proof.canonical(&changed).is_err());
        let wire = serde_json::to_value(&page).unwrap();
        for mutation in [
            "length",
            "hash",
            "tail",
            "window",
            "unknown",
            "expanded_limit",
        ] {
            let mut bad = wire.clone();
            match mutation {
                "length" => bad["expanded_bytes"] = (original.len() as u64 - 1).into(),
                "hash" => bad["expanded_sha256"] = crate::expression_file::digest(b"other").into(),
                "expanded_limit" => bad["expanded_bytes"] = (MAX_EXPANDED as u64 + 1).into(),
                "unknown" => {
                    bad["unadmitted"] = Value::Bool(true);
                }
                _ => {
                    let mut stream = STANDARD.decode(page.payload.as_bytes()).unwrap();
                    if mutation == "tail" {
                        stream.push(0);
                    } else {
                        stream[0] ^= 2;
                    }
                    bad["payload"] = STANDARD.encode(stream).into();
                }
            }
            let decoded = EncodedRecord::deserialize(bad)
                .and_then(|p| p.decode().map_err(serde::de::Error::custom));
            assert!(decoded.is_err(), "{mutation}");
        }
        let duplicated = EncodedRecord::from_bytes(b"{\"x\":1,\"x\":2}").unwrap();
        assert!(duplicated.decode().is_err());
        let spoof = EncodedRecord::from_bytes(b"{\"$serde_json::private::Number\":\"1\"}").unwrap();
        assert!(spoof.decode().is_err());
    }
}
