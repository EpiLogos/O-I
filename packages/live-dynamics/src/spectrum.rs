//! Log-magnitude band profiles and the spectral-distance metric of the gate.
//!
//! Metric definition (from reconstruction-backlog.md): STFT 2048 / 50% hop,
//! magnitude in dB per band over 20 Hz–20 kHz; distance = mean |Δ| and max
//! band |Δ| between two profiles.

pub struct SpectrumError(pub String);

/// In-place iterative radix-2 FFT (sizes: power of two). Forward transform;
/// for the inverse, swap re/im around a forward call (see `reverb.rs`).
pub(crate) fn fft(re: &mut [f64], im: &mut [f64]) {
    let n = re.len();
    debug_assert!(n.is_power_of_two());
    let mut j = 0usize;
    for i in 0..n {
        if i < j {
            re.swap(i, j);
            im.swap(i, j);
        }
        let mut m = n >> 1;
        while m >= 1 && j & m != 0 {
            j ^= m;
            m >>= 1;
        }
        j ^= m;
    }
    let mut len = 2;
    while len <= n {
        let ang = -2.0 * std::f64::consts::PI / len as f64;
        let (wr, wi) = (1.0f64, 0.0f64);
        let step = (ang.cos(), ang.sin());
        for start in (0..n).step_by(len) {
            let (mut cr, mut ci) = (wr, wi);
            for k in 0..len / 2 {
                let a = start + k;
                let b = a + len / 2;
                let tr = re[b] * cr - im[b] * ci;
                let ti = re[b] * ci + im[b] * cr;
                re[b] = re[a] - tr;
                im[b] = im[a] - ti;
                re[a] += tr;
                im[a] += ti;
                let ncr = cr * step.0 - ci * step.1;
                ci = cr * step.1 + ci * step.0;
                cr = ncr;
            }
        }
        len <<= 1;
    }
}

fn hann(n: usize) -> Vec<f64> {
    (0..n)
        .map(|i| 0.5 - 0.5 * (2.0 * std::f64::consts::PI * i as f64 / n as f64).cos())
        .collect()
}

/// Mean log-magnitude (dBFS) per linear band between `f_lo` and `f_hi`.
/// `n_bands` bands partition the range on a log axis.
pub fn band_profile(samples: &[f32], sample_rate: u32, n_bands: usize) -> Vec<f64> {
    const N: usize = 2048;
    let win = hann(N);
    let half = N / 2;
    let f_lo = 20.0f64;
    let f_hi = (sample_rate as f64 / 2.0).min(20000.0);
    // accumulate power per band across frames
    let mut acc = vec![0f64; n_bands];
    let mut frames = 0f64;
    let mut re = vec![0f64; N];
    let mut im = vec![0f64; N];
    let mut pos = 0usize;
    while pos + N <= samples.len() {
        for i in 0..N {
            re[i] = samples[pos + i] as f64 * win[i];
            im[i] = 0.0;
        }
        fft(&mut re, &mut im);
        for k in 0..half {
            let f = k as f64 * sample_rate as f64 / N as f64;
            if f < f_lo || f > f_hi {
                continue;
            }
            let band = (((f / f_lo).ln()) / (f_hi / f_lo).ln() * n_bands as f64) as usize;
            let band = band.min(n_bands - 1);
            acc[band] += re[k] * re[k] + im[k] * im[k];
        }
        frames += 1.0;
        pos += N / 2;
    }
    acc.iter()
        .map(|p| {
            if *p <= 0.0 || frames == 0.0 {
                -144.0
            } else {
                10.0 * (p / frames).log10()
            }
        })
        .collect()
}

pub struct Distance {
    pub mean_db: f64,
    pub max_band_db: f64,
}

/// Mean and max band-wise |Δ| between two profiles.
pub fn band_distance(a: &[f64], b: &[f64]) -> Distance {
    let n = a.len().min(b.len());
    let mut sum = 0f64;
    let mut max = 0f64;
    for i in 0..n {
        let d = (a[i] - b[i]).abs();
        sum += d;
        max = max.max(d);
    }
    Distance { mean_db: sum / n.max(1) as f64, max_band_db: max }
}
