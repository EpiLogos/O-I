//! Minimal WAV reader for track sources: 32-bit IEEE-float WAV (format tag
//! 3), the exact format the harness signal generator writes
//! (harness/gen_signals.py) and the only 32-bit format Live itself accepts
//! (session-model.md §4: "For 32 bit, only floating point samples can be
//! used").
//!
//! Deliberately NOT a copy of `live_dynamics::audio`: that reader is a
//! gate utility and mixdowns to mono; the engine owns multi-channel
//! buffers, so this reader PRESERVES the interleaved channel layout. No
//! dependencies, same as the house style.
//!
//! What a clip plays is decoded here too ([`read_audio`]): WAV ([`read_wav`])
//! and AIFF, the format Live renders and consolidates to ([`read_aiff`]); and
//! a sample at another rate than the engine runs at is brought to it once,
//! when it is decoded ([`resample`]), as Live plays an unwarped clip "at
//! original rate" whatever rate the engine runs at (session-model.md §5).

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

/// Decode the sample a clip plays by its header: a RIFF/WAVE file as [`read_wav`] reads it, a FORM/AIFF or AIFC file as
/// [`read_aiff`] reads it; anything else is refused in words.
pub fn read_audio(bytes: &[u8]) -> Result<WavAudio, WavError> {
    match bytes.get(0..4) {
        Some(b"RIFF") => read_wav(bytes),
        Some(b"FORM") => read_aiff(bytes),
        _ => Err(WavError(
            "the file is neither a WAV (RIFF) nor an AIFF (FORM) file".into(),
        )),
    }
}

/// Decode an AIFF or AIFC file a clip plays (O-I #743, item 3: Live renders to AIFF — its renders under the clean-room
/// corpus's harness/renders are `FORM` `AIFF`, `COMM` then `SSND`, 16-bit stereo — and its consolidated clips are
/// `.aif`). Big-endian integer PCM at any depth to 32 bit, each sample in the whole bytes that hold it, left-justified as
/// AIFF stores it, read to −1…+1 over that width's full scale (8 bit signed, as AIFF stores it, unlike WAV); from where
/// `SSND` says its sound starts (its offset), for as many frames as `COMM` says, at the rate `COMM` stores as an 80-bit
/// extended float, to the nearest whole hertz. AIFC as its compression type says: uncompressed (`NONE`, `twos`),
/// byte-swapped (`sowt`) or float (`fl32`, `fl64`); any other is refused in words, as is a file shorter than `COMM`
/// says. ENGINE DECISION: a 32-bit integer AIFF is read; what Live refuses at 32 bit is attested for WAV only.
pub fn read_aiff(bytes: &[u8]) -> Result<WavAudio, WavError> {
    let kind = bytes.get(8..12);
    if bytes.get(0..4) != Some(b"FORM") || !matches!(kind, Some(b"AIFF") | Some(b"AIFC")) {
        return Err(WavError("not an AIFF or AIFC file".into()));
    }
    let aifc = kind == Some(b"AIFC");
    let mut pos = 12usize;
    let mut comm: Option<(u16, usize, u16, u32, [u8; 4])> = None;
    let mut sound: Option<&[u8]> = None;
    while pos + 8 <= bytes.len() {
        let id = &bytes[pos..pos + 4];
        let size = u32::from_be_bytes(bytes[pos + 4..pos + 8].try_into().unwrap()) as usize;
        let body = bytes
            .get(pos + 8..pos + 8 + size)
            .ok_or_else(|| WavError("truncated chunk".into()))?;
        match id {
            b"COMM" => {
                if body.len() < if aifc { 22 } else { 18 } {
                    return Err(WavError("COMM chunk too short".into()));
                }
                let u16_at = |i: usize| u16::from_be_bytes(body[i..i + 2].try_into().unwrap());
                let frames = u32::from_be_bytes(body[2..6].try_into().unwrap()) as usize;
                let rate = extended_rate(body[8..18].try_into().unwrap())?;
                let compression = if aifc {
                    body[18..22].try_into().unwrap()
                } else {
                    *b"NONE"
                };
                comm = Some((u16_at(0), frames, u16_at(6), rate, compression));
            }
            b"SSND" => {
                if body.len() < 8 {
                    return Err(WavError("SSND chunk too short".into()));
                }
                let offset = u32::from_be_bytes(body[0..4].try_into().unwrap()) as usize;
                sound = Some(
                    body.get(8 + offset..)
                        .ok_or_else(|| WavError("SSND's offset is past its end".into()))?,
                );
            }
            _ => {}
        }
        pos += 8 + size + (size & 1);
    }
    let (channels, frames, bits, rate, compression) =
        comm.ok_or_else(|| WavError("no COMM chunk".into()))?;
    if channels == 0 {
        return Err(WavError("no channels".into()));
    }
    let (width, float, little) = match &compression {
        b"NONE" | b"twos" if (1..=32).contains(&bits) => (usize::from(bits.div_ceil(8)), false, false),
        b"sowt" if (1..=32).contains(&bits) => (usize::from(bits.div_ceil(8)), false, true),
        b"fl32" | b"FL32" => (4, true, false),
        b"fl64" | b"FL64" => (8, true, false),
        b"NONE" | b"twos" | b"sowt" => {
            return Err(WavError(format!(
                "{bits}-bit AIFF is not read: integer at 1 to 32 bit"
            )))
        }
        other => {
            return Err(WavError(format!(
                "AIFC compression '{}' is not read: uncompressed (NONE, twos, sowt) or float (fl32, fl64)",
                String::from_utf8_lossy(other)
            )))
        }
    };
    let sound = sound.ok_or_else(|| WavError("no SSND chunk".into()))?;
    let need = frames * usize::from(channels) * width;
    if sound.len() < need {
        return Err(WavError(format!(
            "its sound is shorter than COMM says: {} of {need} bytes",
            sound.len()
        )));
    }
    let samples: Vec<f32> = sound[..need]
        .chunks_exact(width)
        .map(|b| match (float, width) {
            (true, 4) => f32::from_be_bytes(b.try_into().unwrap()),
            (true, _) => f64::from_be_bytes(b.try_into().unwrap()) as f32,
            (false, _) => {
                let mut word = [0u8; 4];
                for (k, byte) in b.iter().enumerate() {
                    word[if little { width - 1 - k } else { k }] = *byte;
                }
                (f64::from(i32::from_be_bytes(word)) / 2_147_483_648.0) as f32
            }
        })
        .collect();
    Ok(WavAudio {
        sample_rate: rate,
        channels: usize::from(channels),
        samples,
    })
}

/// The rate `COMM` stores, an IEEE 80-bit extended float (sign and 15-bit exponent, then a 64-bit mantissa with its
/// integer bit), to the nearest whole hertz.
fn extended_rate(b: [u8; 10]) -> Result<u32, WavError> {
    let head = u16::from_be_bytes([b[0], b[1]]);
    let exponent = i32::from(head & 0x7FFF);
    let mantissa = u64::from_be_bytes(b[2..10].try_into().unwrap());
    let rate = (mantissa as f64 * 2f64.powi(exponent - 16_383 - 63)).round();
    if head & 0x8000 != 0 || exponent == 0x7FFF || !(1.0..=f64::from(u32::MAX)).contains(&rate) {
        return Err(WavError("COMM's rate is not a sample rate".into()));
    }
    Ok(rate as u32)
}

/// The resampling kernel's reach either side of a frame, in samples of the lower rate (ENGINE DECISION, [`resample`]).
const REACH: usize = 32;
/// Steps of the kernel's table per sample; between two steps it is read along the line joining them.
const STEPS: usize = 2_048;
/// The Kaiser window's shape: about 99 dB of stopband (β = 0.1102 · (A − 8.7)).
const BETA: f64 = 10.0;
/// The band kept, as a share of the lower rate's Nyquist (the −6 dB point): what the window spreads
/// around it reaches no further than the Nyquist itself.
const ROLLOFF: f64 = 0.9;

/// The kernel `ROLLOFF · sinc(ROLLOFF · u) · kaiser(u / REACH)` from `u` = 0 to `REACH`, `STEPS` to a sample.
fn kernel() -> &'static [f64] {
    static TABLE: std::sync::OnceLock<Vec<f64>> = std::sync::OnceLock::new();
    TABLE.get_or_init(|| {
        // the modified Bessel function of the first kind, order 0, by its series
        let i0 = |x: f64| {
            let (mut sum, mut term, q) = (1.0f64, 1.0f64, x * x / 4.0);
            for k in 1..200 {
                term *= q / f64::from(k * k);
                sum += term;
                if term < sum * 1e-17 {
                    break;
                }
            }
            sum
        };
        let norm = i0(BETA);
        (0..=REACH * STEPS)
            .map(|k| {
                let u = k as f64 / STEPS as f64;
                let x = std::f64::consts::PI * ROLLOFF * u;
                let sinc = if k == 0 { 1.0 } else { x.sin() / x };
                let r = u / REACH as f64;
                ROLLOFF * sinc * i0(BETA * (1.0 - r * r).max(0.0).sqrt()) / norm
            })
            .collect()
    })
}

/// The kernel at `u` samples (of the lower rate) from a frame: nothing past its reach.
fn kernel_at(table: &[f64], u: f64) -> f64 {
    let at = u * STEPS as f64;
    let i = at as usize;
    match (table.get(i), table.get(i + 1)) {
        (Some(a), Some(b)) => a + (b - a) * (at - i as f64),
        (Some(a), None) => *a,
        _ => 0.0,
    }
}

/// `samples` (interleaved, `channels` to a frame) at `from` Hz, at `to` Hz instead — ENGINE DECISION (O-I #743, item 3),
/// band-limited interpolation: each frame at the new rate is the sum of the frames about it, each weighed by a
/// Kaiser-windowed sinc (β = 10, reaching 32 samples of the lower rate either side, its band 90 % of the lower rate's
/// Nyquist, read from a table of 2,048 steps a sample), the frames before the first and after the last silent; each
/// channel on its own. Measured, not heard: a sine resampled is the exact sine at the new rate within −105 dB (−112 dB at
/// worst, measured), and a tone above the new rate's Nyquist comes out more than 100 dB below itself (−104 dB at worst)
/// rather than folding back into its band (the tests below). As long as the sound at the new
/// rate (its frames × `to` / `from`, the last part frame whole); at the same rate, the samples as they are.
pub fn resample(samples: &[f32], channels: usize, from: u32, to: u32) -> Vec<f32> {
    if from == to || from == 0 || to == 0 || channels == 0 {
        return samples.to_vec();
    }
    let frames = samples.len() / channels;
    let out_frames = (frames as u64 * u64::from(to)).div_ceil(u64::from(from));
    let scale = (f64::from(to) / f64::from(from)).min(1.0);
    let reach = (REACH as f64 / scale).ceil() as i64;
    let (mut a, mut b) = (from, to);
    while b != 0 {
        (a, b) = (b, a % b);
    }
    let (step, den) = (u64::from(from / a), u64::from(to / a));
    let table = kernel();
    let mut out = Vec::with_capacity(out_frames as usize * channels);
    let mut sum = vec![0.0f64; channels];
    for n in 0..out_frames {
        let whole = (n * step / den) as i64;
        let part = (n * step % den) as f64 / den as f64;
        sum.fill(0.0);
        for i in (whole - reach).max(0)..=(whole + reach + 1).min(frames as i64 - 1) {
            let weight = kernel_at(table, ((whole - i) as f64 + part).abs() * scale);
            if weight == 0.0 {
                continue;
            }
            let at = i as usize * channels;
            for (c, s) in sum.iter_mut().enumerate() {
                *s += weight * f64::from(samples[at + c]);
            }
        }
        out.extend(sum.iter().map(|s| (s * scale) as f32));
    }
    out
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

    /// An AIFF of `data` (big-endian, interleaved) as Live renders one (its renders under harness/renders are `FORM`
    /// `AIFF` with `COMM` then `SSND`, 16-bit stereo at 44.1 kHz): `rate` as the 80-bit extended float `COMM` stores,
    /// `offset` bytes before the sound in `SSND`; with `compression`, an AIFC of that type.
    fn aiff_of(
        channels: u16,
        bits: u16,
        rate: [u8; 10],
        offset: u32,
        data: &[u8],
        compression: Option<&[u8; 4]>,
    ) -> Vec<u8> {
        let frames = data.len() as u32 / (u32::from(channels) * u32::from(bits.div_ceil(8)));
        let mut comm = Vec::new();
        comm.extend_from_slice(&channels.to_be_bytes());
        comm.extend_from_slice(&frames.to_be_bytes());
        comm.extend_from_slice(&bits.to_be_bytes());
        comm.extend_from_slice(&rate);
        if let Some(kind) = compression {
            comm.extend_from_slice(kind);
            comm.extend_from_slice(&[3, b'a', b'b', b'c']);
        }
        let mut ssnd = offset.to_be_bytes().to_vec();
        ssnd.extend_from_slice(&0u32.to_be_bytes());
        ssnd.extend(std::iter::repeat_n(0xEE, offset as usize));
        ssnd.extend_from_slice(data);
        let mut body = if compression.is_some() {
            b"AIFC".to_vec()
        } else {
            b"AIFF".to_vec()
        };
        if compression.is_some() {
            body.extend_from_slice(b"FVER\0\0\0\x04\xA2\x80\x51\x40");
        }
        for (id, chunk) in [(b"COMM", &comm), (b"SSND", &ssnd)] {
            body.extend_from_slice(id);
            body.extend_from_slice(&(chunk.len() as u32).to_be_bytes());
            body.extend_from_slice(chunk);
            if chunk.len() % 2 == 1 {
                body.push(0);
            }
        }
        let mut out = b"FORM".to_vec();
        out.extend_from_slice(&(body.len() as u32).to_be_bytes());
        out.extend_from_slice(&body);
        out
    }

    /// 44.1 kHz and 48 kHz as `COMM` stores a rate (the IEEE 80-bit extended float; Live's renders carry the first).
    const AT_44K1: [u8; 10] = [0x40, 0x0E, 0xAC, 0x44, 0, 0, 0, 0, 0, 0];
    const AT_48K: [u8; 10] = [0x40, 0x0E, 0xBB, 0x80, 0, 0, 0, 0, 0, 0];

    /// AIFF is read as Live renders it (16-bit stereo, big-endian) and at the other integer depths (8 bit signed, as AIFF
    /// stores it, 24 and 32), to −1…+1 over each one's full scale, from where `SSND` says its sound starts, at the rate
    /// `COMM` stores; AIFC uncompressed (`NONE`), byte-swapped (`sowt`) and 32-bit float (`fl32`); any other compression,
    /// and a file shorter than `COMM` says, is refused in words. [`read_audio`] reads either kind by its header.
    #[test]
    fn aiff_is_read_as_live_renders_it_and_aifc_by_its_compression() {
        let a = read_aiff(&aiff_of(
            2,
            16,
            AT_44K1,
            0,
            &[0x80, 0x00, 0x7F, 0xFF, 0x40, 0x00, 0xC0, 0x00],
            None,
        ))
        .unwrap();
        assert_eq!((a.sample_rate, a.channels), (44_100, 2));
        assert_eq!(a.samples, vec![-1.0, 32_767.0 / 32_768.0, 0.5, -0.5]);
        let a = read_aiff(&aiff_of(
            1,
            24,
            AT_48K,
            4,
            &[0x80, 0, 0, 0x7F, 0xFF, 0xFF, 0xC0, 0, 0],
            None,
        ))
        .unwrap();
        assert_eq!((a.sample_rate, a.channels), (48_000, 1));
        assert_eq!(a.samples, vec![-1.0, 8_388_607.0 / 8_388_608.0, -0.5]);
        let a = read_aiff(&aiff_of(1, 8, AT_44K1, 0, &[0x80, 0x00, 0x40], None)).unwrap();
        assert_eq!(a.samples, vec![-1.0, 0.0, 0.5]);
        let a = read_aiff(&aiff_of(
            1,
            32,
            AT_44K1,
            0,
            &[0x80, 0, 0, 0, 0x40, 0, 0, 0],
            None,
        ))
        .unwrap();
        assert_eq!(a.samples, vec![-1.0, 0.5]);
        let a = read_aiff(&aiff_of(
            1,
            16,
            AT_44K1,
            0,
            &[0x80, 0x00, 0x40, 0x00],
            Some(b"NONE"),
        ))
        .unwrap();
        assert_eq!(a.samples, vec![-1.0, 0.5]);
        let a = read_aiff(&aiff_of(
            1,
            16,
            AT_44K1,
            0,
            &[0x00, 0x80, 0x00, 0x40],
            Some(b"sowt"),
        ))
        .unwrap();
        assert_eq!(a.samples, vec![-1.0, 0.5]);
        let float: Vec<u8> = [0.25f32, -0.75]
            .iter()
            .flat_map(|v| v.to_be_bytes())
            .collect();
        let a = read_aiff(&aiff_of(1, 32, AT_48K, 0, &float, Some(b"fl32"))).unwrap();
        assert_eq!((a.sample_rate, a.samples), (48_000, vec![0.25, -0.75]));
        let words = read_aiff(&aiff_of(1, 8, AT_44K1, 0, &[0; 4], Some(b"ulaw")))
            .unwrap_err()
            .0;
        assert!(words.contains("ulaw"), "{words}");
        let mut short = aiff_of(1, 16, AT_44K1, 0, &[0; 8], None);
        short.truncate(short.len() - 2);
        let at = short.windows(4).position(|w| w == b"SSND").unwrap();
        short[at + 4..at + 8].copy_from_slice(&(8u32 + 6).to_be_bytes());
        let words = read_aiff(&short).unwrap_err().0;
        assert!(words.contains("shorter"), "{words}");
        assert!(read_aiff(b"FORM\0\0\0\x04WAVE").is_err());
        let live = aiff_of(2, 16, AT_44K1, 0, &[0x80, 0x00, 0x7F, 0xFF], None);
        assert_eq!(
            read_audio(&live).unwrap().samples,
            read_aiff(&live).unwrap().samples
        );
        assert_eq!(
            read_audio(&tiny_wav()).unwrap().samples,
            read_wav(&tiny_wav()).unwrap().samples
        );
        let words = read_audio(b"OggS not a wav or an aiff....").unwrap_err().0;
        assert!(words.contains("neither"), "{words}");
    }

    /// `hz` at `rate` for `frames` frames, as `channels` channels (the second the first's negative).
    fn sine(hz: f64, rate: u32, frames: usize, channels: usize) -> Vec<f32> {
        (0..frames)
            .flat_map(|i| {
                let v = (std::f64::consts::TAU * hz * i as f64 / f64::from(rate)).sin() * 0.5;
                [v as f32, -v as f32].into_iter().take(channels)
            })
            .collect()
    }

    /// The level of `error` against `signal`, in dB.
    fn db(error: f64, signal: f64) -> f64 {
        20.0 * (error / signal).log10()
    }

    /// ENGINE DECISION resampling (O-I #743, item 3), measured against the reference and not by ear: a sine at one rate,
    /// resampled to another, is the exact sine sampled at the new rate within −105 dB (its error's RMS against the
    /// sine's; −112.5 dB at worst when measured), across 44.1 kHz to 48 kHz and back, 22.05 kHz up and 96 kHz down, from low tones to 75 % of the lower
    /// rate's Nyquist, each channel of a stereo file on its own; it is as long as the sound at the new rate, and a
    /// sample at the engine's own rate is untouched. Its first and last frames, where the kernel reaches past the
    /// file's ends into silence, are not measured.
    #[test]
    fn a_resampled_sine_is_the_exact_sine_at_the_new_rate_within_a_hundred_and_five_db() {
        for (from, to) in [
            (44_100u32, 48_000u32),
            (48_000, 44_100),
            (22_050, 48_000),
            (96_000, 48_000),
        ] {
            let nyquist = f64::from(from.min(to)) / 2.0;
            for hz in [100.0, 1_000.0, 0.4 * nyquist, 0.75 * nyquist] {
                let frames = from as usize / 4;
                let out = resample(&sine(hz, from, frames, 2), 2, from, to);
                let expect = (frames as u64 * u64::from(to)).div_ceil(u64::from(from)) as usize;
                assert_eq!(
                    out.len(),
                    2 * expect,
                    "{from} to {to}: as long as the sound at the new rate"
                );
                let exact = sine(hz, to, expect, 2);
                let edge = to as usize / 100;
                let (mut error, mut signal) = (0.0f64, 0.0f64);
                for i in 2 * edge..2 * (expect - edge) {
                    error += (f64::from(out[i]) - f64::from(exact[i])).powi(2);
                    signal += f64::from(exact[i]).powi(2);
                }
                let level = db(error.sqrt(), signal.sqrt());
                assert!(level < -105.0, "{hz} Hz from {from} to {to}: {level:.1} dB");
            }
        }
        let same = sine(1_000.0, 48_000, 480, 2);
        assert_eq!(resample(&same, 2, 48_000, 48_000), same);
    }

    /// Resampling down keeps what is above the new rate's Nyquist from folding back into its band (measured: a tone
    /// above it comes out more than 100 dB below itself; −103.9 dB at worst), and holds a steady level steady.
    #[test]
    fn resampling_down_does_not_fold_what_is_above_the_new_nyquist_back() {
        for (from, to, hz) in [
            (48_000u32, 44_100u32, 23_000.0),
            (96_000, 48_000, 30_000.0),
            (96_000, 44_100, 40_000.0),
        ] {
            let frames = from as usize / 4;
            let out = resample(&sine(hz, from, frames, 1), 1, from, to);
            let edge = to as usize / 100;
            let inner = &out[edge..out.len() - edge];
            let rms = (inner.iter().map(|v| f64::from(*v).powi(2)).sum::<f64>()
                / inner.len() as f64)
                .sqrt();
            let level = db(rms, 0.5 / 2f64.sqrt());
            assert!(level < -100.0, "{hz} Hz from {from} to {to}: {level:.1} dB");
        }
        let steady = vec![0.5f32; 4_410];
        let out = resample(&steady, 1, 44_100, 48_000);
        assert!(
            out[480..out.len() - 480]
                .iter()
                .all(|v| (v - 0.5).abs() < 2e-5),
            "a steady level stays steady"
        );
    }

    #[test]
    fn rejects_non_float_and_garbage() {
        let mut w = tiny_wav();
        w[20] = 1; // format tag → 1 (integer PCM)
        assert!(read_wav_f32(&w).is_err());
        assert!(read_wav_f32(b"not a wav at all........").is_err());
    }
}
