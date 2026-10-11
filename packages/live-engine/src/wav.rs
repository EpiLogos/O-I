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
        return Err(WavError("data length is not a whole number of frames".into()));
    }
    Ok(WavAudio { sample_rate: rate, channels: channels as usize, samples })
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

    #[test]
    fn rejects_non_float_and_garbage() {
        let mut w = tiny_wav();
        w[20] = 1; // format tag → 1 (integer PCM)
        assert!(read_wav_f32(&w).is_err());
        assert!(read_wav_f32(b"not a wav at all........").is_err());
    }
}
