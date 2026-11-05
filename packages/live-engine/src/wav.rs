//! Minimal WAV reader for track sources: 32-bit IEEE-float WAV (format tag
//! 3), the exact format the harness signal generator writes
//! (harness/gen_signals.py) and the only 32-bit format Live itself accepts
//! (session-model.md §4: "For 32 bit, only floating point samples can be
//! used").
//!
//! Deliberately NOT a copy of `live_dynamics::audio`: that reader is a
//! gate utility and mixdowns to mono; the engine owns multi-channel
//! buffers, so this reader PRESERVES the interleaved channel layout. No
//! dependencies, same as the house style. This crate reads audio, it is
//! not a converter: anything else is rejected.

#[derive(Debug, Clone)]
pub struct WavAudio {
    pub sample_rate: u32,
    pub channels: usize,
    /// Interleaved frames.
    pub samples: Vec<f32>,
}

#[derive(Debug)]
pub struct WavError(pub String);

impl std::fmt::Display for WavError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "wav: {}", self.0)
    }
}

impl std::error::Error for WavError {}

/// Parse a RIFF/WAVE file containing IEEE float samples (format tag 3).
pub fn read_wav_f32(bytes: &[u8]) -> Result<WavAudio, WavError> {
    if bytes.len() < 12 || &bytes[0..4] != b"RIFF" || &bytes[8..12] != b"WAVE" {
        return Err(WavError("not a RIFF/WAVE file".into()));
    }
    let mut pos = 12usize;
    let (mut rate, mut channels, mut data): (u32, u16, Option<&[u8]>) = (0, 0, None);
    while pos + 8 <= bytes.len() {
        let id = &bytes[pos..pos + 4];
        let size = u32::from_le_bytes(bytes[pos + 4..pos + 8].try_into().unwrap()) as usize;
        let body = bytes
            .get(pos + 8..pos + 8 + size)
            .ok_or_else(|| WavError("truncated chunk".into()))?;
        match id {
            b"fmt " => {
                if body.len() < 16 {
                    return Err(WavError("fmt chunk too short".into()));
                }
                let tag = u16::from_le_bytes(body[0..2].try_into().unwrap());
                if tag != 3 {
                    return Err(WavError(
                        "WAV is not IEEE float (tag 3); 32-bit integer is rejected, \
                         matching Live's own rule"
                            .into(),
                    ));
                }
                channels = u16::from_le_bytes(body[2..4].try_into().unwrap());
                rate = u32::from_le_bytes(body[4..8].try_into().unwrap());
            }
            b"data" => data = Some(body),
            _ => {}
        }
        pos += 8 + size + (size & 1);
    }
    let channels = channels.max(1);
    let data = data.ok_or_else(|| WavError("no data chunk".into()))?;
    let samples: Vec<f32> = data
        .as_chunks::<4>()
        .0
        .iter()
        .map(|c| f32::from_le_bytes(*c))
        .collect();
    if !samples.len().is_multiple_of(channels as usize) {
        return Err(WavError(
            "data length is not a whole number of frames".into(),
        ));
    }
    Ok(WavAudio {
        sample_rate: rate,
        channels: channels as usize,
        samples,
    })
}

/// Decode a RIFF/WAVE file a clip plays (DLW build ruling 2026-11-05, the sample-playback source): the
/// formats Live itself takes (session-model.md §4: "Supported integer formats are 8, 16 and 24 bit", and
/// for 32 bit only IEEE float) — integer PCM (format tag 1) at 8, 16 or 24 bit, read to −1…+1 as the
/// integer over its full scale (8 bit unsigned around 128, as WAV stores it), and IEEE float at 32 bit
/// (tag 3) as [`read_wav_f32`] reads it; `WAVE_FORMAT_EXTENSIBLE` (tag 0xFFFE) by its sub-format's tag.
/// Anything else, a 32-bit integer file among them, is refused in words.
pub fn read_wav(bytes: &[u8]) -> Result<WavAudio, WavError> {
    if bytes.len() < 12 || &bytes[0..4] != b"RIFF" || &bytes[8..12] != b"WAVE" {
        return Err(WavError("not a RIFF/WAVE file".into()));
    }
    let mut pos = 12usize;
    let mut format: Option<(u16, u16, u32, u16)> = None;
    let mut data: Option<&[u8]> = None;
    while pos + 8 <= bytes.len() {
        let id = &bytes[pos..pos + 4];
        let size = u32::from_le_bytes(bytes[pos + 4..pos + 8].try_into().unwrap()) as usize;
        let body = bytes
            .get(pos + 8..pos + 8 + size)
            .ok_or_else(|| WavError("truncated chunk".into()))?;
        match id {
            b"fmt " => {
                if body.len() < 16 {
                    return Err(WavError("fmt chunk too short".into()));
                }
                let u16_at = |i: usize| u16::from_le_bytes(body[i..i + 2].try_into().unwrap());
                let mut tag = u16_at(0);
                if tag == 0xFFFE {
                    if body.len() < 26 {
                        return Err(WavError("extensible fmt chunk too short".into()));
                    }
                    tag = u16_at(24);
                }
                let rate = u32::from_le_bytes(body[4..8].try_into().unwrap());
                format = Some((tag, u16_at(2), rate, u16_at(14)));
            }
            b"data" => data = Some(body),
            _ => {}
        }
        pos += 8 + size + (size & 1);
    }
    let (tag, channels, rate, bits) = format.ok_or_else(|| WavError("no fmt chunk".into()))?;
    let data = data.ok_or_else(|| WavError("no data chunk".into()))?;
    if channels == 0 {
        return Err(WavError("no channels".into()));
    }
    let samples: Vec<f32> = match (tag, bits) {
        (3, 32) => data
            .as_chunks::<4>()
            .0
            .iter()
            .map(|c| f32::from_le_bytes(*c))
            .collect(),
        (1, 8) => data.iter().map(|b| (*b as f32 - 128.0) / 128.0).collect(),
        (1, 16) => data
            .as_chunks::<2>()
            .0
            .iter()
            .map(|c| i16::from_le_bytes(*c) as f32 / 32_768.0)
            .collect(),
        (1, 24) => data
            .as_chunks::<3>()
            .0
            .iter()
            .map(|c| (i32::from_le_bytes([0, c[0], c[1], c[2]]) >> 8) as f32 / 8_388_608.0)
            .collect(),
        (1, 32) => {
            return Err(WavError(
                "32-bit integer WAV is not read: for 32 bit, only floating point samples are, as Live reads them"
                    .into(),
            ))
        }
        (1 | 3, bits) => {
            return Err(WavError(format!(
                "{bits}-bit {} WAV is not read: integer at 8, 16 or 24 bit, or float at 32",
                if tag == 3 { "float" } else { "integer" }
            )))
        }
        (tag, _) => {
            return Err(WavError(format!(
                "WAV format {tag} is not read: integer PCM or IEEE float"
            )))
        }
    };
    if !samples.len().is_multiple_of(channels as usize) {
        return Err(WavError(
            "data length is not a whole number of frames".into(),
        ));
    }
    Ok(WavAudio {
        sample_rate: rate,
        channels: channels as usize,
        samples,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A minimal tag-3 stereo WAV, hand-packed like harness/gen_signals.py.
    fn tiny_wav() -> Vec<u8> {
        let data: Vec<u8> = [0.25f32, -0.5f32, 1.0f32, -1.0f32]
            .iter()
            .flat_map(|v| v.to_le_bytes())
            .collect();
        let mut out = b"RIFF".to_vec();
        out.extend_from_slice(&(36u32 + data.len() as u32).to_le_bytes());
        out.extend_from_slice(b"WAVE");
        out.extend_from_slice(b"fmt ");
        out.extend_from_slice(&16u32.to_le_bytes());
        out.extend_from_slice(&3u16.to_le_bytes()); // IEEE float
        out.extend_from_slice(&2u16.to_le_bytes()); // stereo
        out.extend_from_slice(&48_000u32.to_le_bytes());
        out.extend_from_slice(&(48_000u32 * 8).to_le_bytes());
        out.extend_from_slice(&8u16.to_le_bytes());
        out.extend_from_slice(&32u16.to_le_bytes());
        out.extend_from_slice(b"data");
        out.extend_from_slice(&(data.len() as u32).to_le_bytes());
        out.extend_from_slice(&data);
        out
    }

    #[test]
    fn reads_channels_and_layout() {
        let a = read_wav_f32(&tiny_wav()).unwrap();
        assert_eq!(a.sample_rate, 48_000);
        assert_eq!(a.channels, 2);
        assert_eq!(a.samples, vec![0.25, -0.5, 1.0, -1.0]);
    }

    /// A WAV of `data` at `tag` (with `extensible`, as `WAVE_FORMAT_EXTENSIBLE` naming it), `bits`, mono.
    fn wav_of(tag: u16, bits: u16, data: &[u8], extensible: bool) -> Vec<u8> {
        let mut fmt = Vec::new();
        fmt.extend_from_slice(&(if extensible { 0xFFFE } else { tag }).to_le_bytes());
        fmt.extend_from_slice(&1u16.to_le_bytes());
        fmt.extend_from_slice(&44_100u32.to_le_bytes());
        fmt.extend_from_slice(&(44_100u32 * u32::from(bits / 8)).to_le_bytes());
        fmt.extend_from_slice(&(bits / 8).to_le_bytes());
        fmt.extend_from_slice(&bits.to_le_bytes());
        if extensible {
            fmt.extend_from_slice(&22u16.to_le_bytes());
            fmt.extend_from_slice(&bits.to_le_bytes());
            fmt.extend_from_slice(&4u32.to_le_bytes());
            fmt.extend_from_slice(&tag.to_le_bytes());
            fmt.extend_from_slice(&[0u8; 14]);
        }
        let mut out = b"RIFF".to_vec();
        out.extend_from_slice(&((4 + 8 + fmt.len() + 8 + data.len()) as u32).to_le_bytes());
        out.extend_from_slice(b"WAVE");
        out.extend_from_slice(b"fmt ");
        out.extend_from_slice(&(fmt.len() as u32).to_le_bytes());
        out.extend_from_slice(&fmt);
        out.extend_from_slice(b"data");
        out.extend_from_slice(&(data.len() as u32).to_le_bytes());
        out.extend_from_slice(data);
        out
    }

    /// The formats Live takes are read to −1…+1 over each one's full scale, a file's rate and channels as it
    /// stores them; the extensible header reads as the format it names; a 32-bit integer file, and any other
    /// format, is refused in words. Float reads as `read_wav_f32` reads it.
    #[test]
    fn reads_the_formats_live_takes_and_refuses_the_rest_in_words() {
        let a = read_wav(&wav_of(1, 16, &[0x00, 0x80, 0xFF, 0x7F, 0x00, 0x40], false)).unwrap();
        assert_eq!((a.sample_rate, a.channels), (44_100, 1));
        assert_eq!(a.samples, vec![-1.0, 32_767.0 / 32_768.0, 0.5]);
        let a = read_wav(&wav_of(
            1,
            24,
            &[0x00, 0x00, 0x80, 0xFF, 0xFF, 0x7F, 0x00, 0x00, 0xC0],
            true,
        ))
        .unwrap();
        assert_eq!(a.samples, vec![-1.0, 8_388_607.0 / 8_388_608.0, -0.5]);
        let a = read_wav(&wav_of(1, 8, &[0, 128, 192], false)).unwrap();
        assert_eq!(a.samples, vec![-1.0, 0.0, 0.5]);
        let float: Vec<u8> = [0.25f32, -0.75]
            .iter()
            .flat_map(|v| v.to_le_bytes())
            .collect();
        assert_eq!(
            read_wav(&wav_of(3, 32, &float, false)).unwrap().samples,
            vec![0.25, -0.75]
        );
        assert_eq!(
            read_wav(&tiny_wav()).unwrap().samples,
            read_wav_f32(&tiny_wav()).unwrap().samples
        );
        let words = read_wav(&wav_of(1, 32, &[0; 4], false)).unwrap_err().0;
        assert!(words.contains("32-bit integer"), "{words}");
        let words = read_wav(&wav_of(3, 64, &[0; 8], false)).unwrap_err().0;
        assert!(words.contains("64-bit float"), "{words}");
        let words = read_wav(&wav_of(2, 4, &[0; 4], false)).unwrap_err().0;
        assert!(words.contains("format 2"), "{words}");
        assert!(read_wav(b"not a wav at all........").is_err());
    }

    #[test]
    fn rejects_non_float_and_garbage() {
        let mut w = tiny_wav();
        w[20] = 1; // format tag → 1 (integer PCM)
        assert!(read_wav_f32(&w).is_err());
        assert!(read_wav_f32(b"not a wav at all........").is_err());
    }
}
