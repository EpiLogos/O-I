//! Minimal audio readers for the verify gate. No dependencies.
//!
//! Supported: 32-bit IEEE-float WAV (what our signal generator writes) and
//! 16-bit big-endian AIFF (what Live's export writes). Both are the exact
//! formats the golden-render pipeline produces; anything else is rejected —
//! this crate reads evidence, it is not a converter.

#[derive(Debug, Clone)]
pub struct Audio {
    pub sample_rate: u32,
    /// mono mixdown (L+R)/2
    pub samples: Vec<f32>,
}

#[derive(Debug)]
pub struct AudioError(pub String);

impl std::fmt::Display for AudioError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "audio: {}", self.0)
    }
}

impl std::error::Error for AudioError {}

fn err<T>(msg: &str) -> Result<T, AudioError> {
    Err(AudioError(msg.to_string()))
}

/// Parse a RIFF/WAVE file containing IEEE float samples (format tag 3).
pub fn read_wav_f32(bytes: &[u8]) -> Result<Audio, AudioError> {
    if bytes.len() < 12 || &bytes[0..4] != b"RIFF" || &bytes[8..12] != b"WAVE" {
        return err("not a RIFF/WAVE file");
    }
    let mut pos = 12usize;
    let (mut rate, mut channels, mut data): (u32, u16, Option<&[u8]>) = (0, 0, None);
    while pos + 8 <= bytes.len() {
        let id = &bytes[pos..pos + 4];
        let size = u32::from_le_bytes(bytes[pos + 4..pos + 8].try_into().unwrap()) as usize;
        let body = bytes
            .get(pos + 8..pos + 8 + size)
            .ok_or_else(|| AudioError("truncated chunk".into()))?;
        match id {
            b"fmt " => {
                let tag = u16::from_le_bytes(body[0..2].try_into().unwrap());
                if tag != 3 {
                    return err("WAV is not IEEE float (tag 3); 32-bit integer is rejected, matching Live's own rule");
                }
                channels = u16::from_le_bytes(body[2..4].try_into().unwrap());
                rate = u32::from_le_bytes(body[4..8].try_into().unwrap());
            }
            b"data" => data = Some(body),
            _ => {}
        }
        pos += 8 + size + (size & 1);
    }
    let data = data.ok_or_else(|| AudioError("no data chunk".into()))?;
    let floats: Vec<f32> = data
        .as_chunks::<4>()
        .0
        .iter()
        .map(|c| f32::from_le_bytes(*c))
        .collect();
    Ok(mixdown(floats, channels, rate))
}

/// Parse an AIFF file with 16-bit big-endian samples (Live's export format).
pub fn read_aiff_i16(bytes: &[u8]) -> Result<Audio, AudioError> {
    if bytes.len() < 12 || &bytes[0..4] != b"FORM" || (&bytes[8..12] != b"AIFF" && &bytes[8..12] != b"AIFC") {
        return err("not an AIFF/AIFC file");
    }
    let mut pos = 12usize;
    let (mut rate, mut channels, mut data): (u32, u16, Option<&[u8]>) = (0, 0, None);
    while pos + 8 <= bytes.len() {
        let id = &bytes[pos..pos + 4];
        let size = u32::from_be_bytes(bytes[pos + 4..pos + 8].try_into().unwrap()) as usize;
        let body = bytes
            .get(pos + 8..pos + 8 + size)
            .ok_or_else(|| AudioError("truncated chunk".into()))?;
        match id {
            b"COMM" => {
                if body.len() < 18 {
                    return err("COMM chunk too short");
                }
                channels = u16::from_be_bytes(body[0..2].try_into().unwrap());
                let bits = i16::from_be_bytes(body[6..8].try_into().unwrap());
                if bits != 16 {
                    return err("only 16-bit AIFF supported");
                }
                let expon = i16::from_be_bytes(body[8..10].try_into().unwrap()) as i32;
                let mant = u64::from_be_bytes(body[10..18].try_into().unwrap());
                rate = (mant as f64 * 2f64.powi(expon - 16383 - 63)) as u32;
            }
            b"SSND" => {
                let offset = u32::from_be_bytes(body[0..4].try_into().unwrap()) as usize;
                data = Some(&body[8 + offset..]);
            }
            _ => {}
        }
        pos += 8 + size + (size & 1);
    }
    let data = data.ok_or_else(|| AudioError("no SSND chunk".into()))?;
    let ints: Vec<f32> = data
        .as_chunks::<2>()
        .0
        .iter()
        .map(|c| i16::from_be_bytes(*c) as f32 / 32768.0)
        .collect();
    Ok(mixdown(ints, channels, rate))
}

fn mixdown(interleaved: Vec<f32>, channels: u16, rate: u32) -> Audio {
    if channels <= 1 {
        return Audio { sample_rate: rate, samples: interleaved };
    }
    let ch = channels as usize;
    let samples: Vec<f32> = interleaved
        .chunks_exact(ch)
        .map(|frame| frame.iter().sum::<f32>() / ch as f32)
        .collect();
    Audio { sample_rate: rate, samples }
}

/// RMS power in dBFS for one channel-agnostic slice.
pub fn rms_db(samples: &[f32]) -> f64 {
    if samples.is_empty() {
        return -144.0;
    }
    let acc: f64 = samples.iter().map(|v| (*v as f64) * (*v as f64)).sum();
    let mean = acc / samples.len() as f64;
    if mean <= 0.0 {
        -144.0
    } else {
        10.0 * mean.log10()
    }
}

/// Per-channel AIFF reader (circuit-model lane addition, 2026-10-08): the
/// Echo pingpong gate needs the L and R channels separately — the shared
/// mono mixdown halves every single-channel tap by −6 dB and lets the
/// between-tap reverb floor mask them. Pure addition; `read_aiff_i16`
/// behavior is unchanged.
pub fn read_aiff_i16_channels(bytes: &[u8]) -> Result<(Audio, Audio), AudioError> {
    if bytes.len() < 12 || &bytes[0..4] != b"FORM" || (&bytes[8..12] != b"AIFF" && &bytes[8..12] != b"AIFC") {
        return err("not an AIFF/AIFC file");
    }
    let mut pos = 12usize;
    let (mut rate, mut channels, mut data): (u32, u16, Option<&[u8]>) = (0, 0, None);
    while pos + 8 <= bytes.len() {
        let id = &bytes[pos..pos + 4];
        let size = u32::from_be_bytes(bytes[pos + 4..pos + 8].try_into().unwrap()) as usize;
        let body = bytes
            .get(pos + 8..pos + 8 + size)
            .ok_or_else(|| AudioError("truncated chunk".into()))?;
        match id {
            b"COMM" => {
                if body.len() < 18 {
                    return err("COMM chunk too short");
                }
                channels = u16::from_be_bytes(body[0..2].try_into().unwrap());
                let bits = i16::from_be_bytes(body[6..8].try_into().unwrap());
                if bits != 16 {
                    return err("only 16-bit AIFF supported");
                }
                let expon = i16::from_be_bytes(body[8..10].try_into().unwrap()) as i32;
                let mant = u64::from_be_bytes(body[10..18].try_into().unwrap());
                rate = (mant as f64 * 2f64.powi(expon - 16383 - 63)) as u32;
            }
            b"SSND" => {
                let offset = u32::from_be_bytes(body[0..4].try_into().unwrap()) as usize;
                data = Some(&body[8 + offset..]);
            }
            _ => {}
        }
        pos += 8 + size + (size & 1);
    }
    let data = data.ok_or_else(|| AudioError("no SSND chunk".into()))?;
    if channels != 2 {
        return err("read_aiff_i16_channels requires stereo");
    }
    let ints: Vec<f32> = data
        .as_chunks::<2>()
        .0
        .iter()
        .map(|c| i16::from_be_bytes(*c) as f32 / 32768.0)
        .collect();
    let mut l = Vec::with_capacity(ints.len() / 2);
    let mut r = Vec::with_capacity(ints.len() / 2);
    for frame in ints.as_chunks::<2>().0 {
        l.push(frame[0]);
        r.push(frame[1]);
    }
    Ok((
        Audio { sample_rate: rate, samples: l },
        Audio { sample_rate: rate, samples: r },
    ))
}
