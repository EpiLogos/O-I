//! Audible demo: a C-minor-to-C arpeggio rendered through the Operator voice
//! model — proof the engine chain makes real sound.
//!
//! Run: cargo run --example demo -- <out.wav>

use live_dynamics::operator::OperatorVoiceA;

fn main() {
    let out_path = std::env::args()
        .nth(1)
        .unwrap_or_else(|| "operator-voice-demo.wav".into());
    let sr = 44100u32;
    // C3 E3 G3 C4 arpeggio, 0.35 s hold / 0.5 s slot, then a held C4.
    let keys: [u8; 5] = [48, 52, 55, 60, 60];
    let holds = [0.40, 0.40, 0.40, 0.40, 1.60];
    let slots = [0.50, 0.50, 0.50, 0.50, 2.00];
    let total: f32 = slots.iter().sum();

    let mut mix = vec![0f32; (total * sr as f32) as usize];
    let mut t0 = 0f32;
    for (i, key) in keys.iter().enumerate() {
        let voice = OperatorVoiceA::default_patch(*key, sr);
        let note = voice.render_note(holds[i], slots[i] as f64);
        let start = (t0 * sr as f32) as usize;
        for (n, v) in note.iter().enumerate() {
            if start + n < mix.len() {
                mix[start + n] += v;
            }
        }
        t0 += slots[i];
    }

    // peak-normalize to −3 dBFS so the demo is clearly audible
    let peak = mix.iter().fold(0f32, |a, v| a.max(v.abs()));
    if peak > 0.0 {
        let g = 10f32.powf(-3.0 / 20.0) / peak;
        for v in &mut mix {
            *v *= g;
        }
    }

    // minimal 16-bit PCM WAV writer
    let data_len = (mix.len() * 2) as u32;
    let mut wav: Vec<u8> = Vec::with_capacity(44 + data_len as usize);
    wav.extend_from_slice(b"RIFF");
    wav.extend_from_slice(&(36 + data_len).to_le_bytes());
    wav.extend_from_slice(b"WAVEfmt ");
    wav.extend_from_slice(&16u32.to_le_bytes());
    wav.extend_from_slice(&1u16.to_le_bytes()); // PCM
    wav.extend_from_slice(&1u16.to_le_bytes()); // mono
    wav.extend_from_slice(&sr.to_le_bytes());
    wav.extend_from_slice(&(sr * 2).to_le_bytes()); // byte rate
    wav.extend_from_slice(&2u16.to_le_bytes()); // block align
    wav.extend_from_slice(&16u16.to_le_bytes()); // bits
    wav.extend_from_slice(b"data");
    wav.extend_from_slice(&data_len.to_le_bytes());
    for v in &mix {
        let s = (v.clamp(-1.0, 1.0) * 32767.0) as i16;
        wav.extend_from_slice(&s.to_le_bytes());
    }
    std::fs::write(&out_path, &wav).unwrap();

    let rms: f32 = mix.iter().map(|v| v * v).sum::<f32>() / mix.len() as f32;
    println!(
        "wrote {out_path}: {:.1}s, peak {:.1} dBFS, rms {:.1} dBFS",
        total,
        20.0 * peak.abs().log10(),
        10.0 * rms.log10()
    );
}
