//! The Torus instrument node (feature `k8`; O-I #849, manual §21.2: "The
//! torus is the only generator").
//!
//! A [`K8Instrument`] is the head of a MIDI part's chain that sounds
//! through QL's K8 typed API: it owns one `ql::ContinuousField` (the
//! continuation of supplied M2 modes, `<ql/continuous_field.hpp>` from an
//! installed QL prefix, linked by `build.rs` through the C ABI of
//! `src/k8/field_shim.cpp`) and plays it on the engine's timeline. Every
//! frame is the field's own `render_audio`: the node adds no physics, no
//! pitch law and no envelope of its own.
//!
//! The Torus in the candidate's one engine is the field its owner hands
//! over (QL's `torus-native`, `ql.torus-native/v1`): the continuation as it
//! stood at the owner's cursor ([`K8Continuation`], continued by
//! [`K8Field::continue_from`] sample for sample) and the played-address law
//! of the tuning in force ([`K8KeyLaw`], `<ql/torus_keys.hpp>`). An act of
//! the Torus's keys ([`crate::EngineEvent::TorusPlay`]) strikes each key's
//! moving point on the voices of the tuning, as QL's own `torus-play` would,
//! at the frame the engine applies it. What QL says of the rest (its
//! `release` and `silence` laws): a key's release moves no native state —
//! the body rings on with its own damping, so `note_off` and `release_all`
//! do nothing; Panic stills what was struck (`ql::ContinuousField::silence`,
//! [`Instrument::panic`]). A MIDI note on the part strikes the act prepared
//! for its key ([`K8Field::set_key`]); QL gives no law from a MIDI pitch to
//! a Jankó key, so a part with none prepared strikes nothing for a note.
//!
//! Realtime: striking, silencing and `render_audio` run on the audio
//! thread, the field's "one host-owned serial execution thread", and
//! allocate nothing (`strike_now`, `silence`, `TorusKeys::play`;
//! `tests/k8_no_alloc.rs` counts them at zero). Making a field and its law
//! allocates, off the thread.

use crate::graph::{Clock, Instrument, TorusAct, TORUS_ACT_KEYS};
use std::ffi::{c_char, c_int, CString};
use std::ptr::NonNull;

/// `QL_PhaseLift` (`<ql/coupled_clock.h>`): an integer winding and a
/// position in half-degrees within the 720-half-degree turn.
#[repr(C)]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct PhaseLift {
    pub turns: i64,
    pub half_degrees: u16,
}

/// `QL_CoupledClock` (`<ql/coupled_clock.h>`), field for field; the shim
/// checks the size against the C definition before a field is made.
#[repr(C)]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct CoupledClock {
    pub inscription: PhaseLift,
    pub lensing: PhaseLift,
    pub grid_origin_half_degrees: [u16; 3],
    pub rate_numerators: [i32; 2],
    pub rate_denominator: u32,
    pub rate_remainders: [i64; 2],
    pub generation: u64,
}

/// One supplied mode (`ql::Mode`).
#[derive(Debug, Clone, PartialEq)]
pub struct K8Mode {
    pub reference: String,
    /// An exact M2 coordinate (the field refuses any other).
    pub source_coordinate: String,
    pub frequency_hz: f64,
    pub damping_per_second: f64,
    /// Complex modal amplitude, metres (re, im).
    pub amplitude_metres: (f64, f64),
    pub drive_metres_per_second: (f64, f64),
    pub audio_gain_per_metre: f64,
}

/// One supplied sample of the body (`ql::Sample`): its shape function per
/// mode, in mode order.
#[derive(Debug, Clone, PartialEq)]
pub struct K8Sample {
    pub identity: u64,
    pub constituent: String,
    /// 0 fixed, 1 inscription, 2 lensing (`ql::ClockAttachment`).
    pub attachment: u32,
    pub rest_metres: [f64; 3],
    pub mode_shapes: Vec<[f64; 3]>,
}

/// The continuation the host supplies (`ql::ContinuationInput`).
#[derive(Debug, Clone, PartialEq)]
pub struct K8Input {
    pub event_ref: String,
    pub subject_ref: String,
    pub geometry_ref: String,
    pub material_ref: String,
    pub model_ref: String,
    pub generation: u64,
    pub sample_rate: u32,
    pub clock: CoupledClock,
    /// Half-degree driver units per second, as numerator / denominator.
    pub driver_numerator: u32,
    pub driver_denominator: u32,
    pub modes: Vec<K8Mode>,
    pub samples: Vec<K8Sample>,
}

#[repr(C)]
struct LeK8Mode {
    reference: *const c_char,
    source_coordinate: *const c_char,
    frequency_hz: f64,
    damping_per_second: f64,
    amplitude_re: f64,
    amplitude_im: f64,
    drive_re: f64,
    drive_im: f64,
    audio_gain_per_metre: f64,
}

#[repr(C)]
struct LeK8Sample {
    identity: u64,
    constituent: *const c_char,
    attachment: u32,
    rest: [f64; 3],
    shapes: *const f64,
}

#[repr(C)]
struct LeK8Input {
    event_ref: *const c_char,
    subject_ref: *const c_char,
    geometry_ref: *const c_char,
    material_ref: *const c_char,
    model_ref: *const c_char,
    generation: u64,
    sample_rate: u32,
    clock: CoupledClock,
    driver_numerator: u32,
    driver_denominator: u32,
    modes: *const LeK8Mode,
    mode_count: usize,
    samples: *const LeK8Sample,
    sample_count: usize,
}

/// The M1′ pulse's drive of the body as the field holds it (`ql::CarrierDrive`): the pulse and one
/// impulse per mode (none: no drive), and the whole steps it has landed.
#[derive(Debug, Clone, PartialEq, Default)]
pub struct K8Carrier {
    pub steps_per_second: f64,
    pub anchor_samples: u64,
    pub anchor_steps: f64,
    pub reached: f64,
    pub impulses: Vec<(f64, f64)>,
}

/// An act admitted for a later sample and not yet landed (`ql::PendingAct`): impulses by mode index.
#[derive(Debug, Clone, PartialEq)]
pub struct K8Pending {
    pub at_samples_elapsed: u64,
    pub impulses: Vec<(usize, (f64, f64))>,
}

/// A continuation as its owner hands it over (`ql::Continuation`, `ql.continuous-handover/v1`):
/// the input with each mode's resident state as its amplitude, the clock and generation as they
/// stand, the cursor, the driver's remainder, the Carrier's drive, the acts waiting for later
/// samples and a receiver move not yet reached (`heard_from`, empty when none).
#[derive(Debug, Clone, PartialEq)]
pub struct K8Continuation {
    pub input: K8Input,
    pub samples_elapsed: u64,
    pub driver_remainder: u64,
    pub last_unmuted_sample: f64,
    pub carrier: K8Carrier,
    pub pending: Vec<K8Pending>,
    pub heard_from: Vec<f64>,
}

/// One voice of the tuning in force (`ql::KeyVoice`): the mode it sounds through and its surface term.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct K8KeyVoice {
    pub mode: usize,
    pub longitude_radians: f64,
    pub weight: f64,
    pub phase_radians: f64,
    pub m: u32,
    pub n: u32,
}

/// QL's played-address law as its owner hands it over (`ql::TorusKeyLaw`, `ql.torus-keys/v1`): each
/// key's ring arc, the voices of the tuning in force, Strike, the pulse, the rate and the material cap.
#[derive(Debug, Clone, PartialEq)]
pub struct K8KeyLaw {
    pub arcs: [u8; 36],
    pub voices: Vec<K8KeyVoice>,
    pub strike: f64,
    pub anchor_samples: u64,
    pub anchor_steps: f64,
    pub steps_per_second: f64,
    pub sample_rate: u32,
    pub cap_metres: f64,
}

#[repr(C)]
struct LeK8Pending {
    at_samples_elapsed: u64,
    modes: *const usize,
    re: *const f64,
    im: *const f64,
    n: usize,
}

#[repr(C)]
struct LeK8Continuation {
    input: LeK8Input,
    samples_elapsed: u64,
    driver_remainder: u64,
    last_unmuted_sample: f64,
    carrier_steps_per_second: f64,
    carrier_anchor_samples: u64,
    carrier_anchor_steps: f64,
    carrier_reached: f64,
    carrier_re: *const f64,
    carrier_im: *const f64,
    carrier_count: usize,
    pending: *const LeK8Pending,
    pending_count: usize,
    heard_from: *const f64,
    heard_count: usize,
}

#[repr(C)]
struct LeK8KeyVoice {
    mode: usize,
    longitude_radians: f64,
    weight: f64,
    phase_radians: f64,
    m: u32,
    n: u32,
}

#[repr(C)]
struct LeK8KeyLaw {
    arcs: [u8; 36],
    voices: *const LeK8KeyVoice,
    voice_count: usize,
    strike: f64,
    anchor_samples: u64,
    anchor_steps: f64,
    steps_per_second: f64,
    sample_rate: u32,
    cap_metres: f64,
}

#[repr(C)]
struct LeK8Field {
    _opaque: [u8; 0],
}

extern "C" {
    fn le_k8_clock_size() -> usize;
    fn le_k8_field_new(input: *const LeK8Input, err: *mut c_char, err_len: usize)
        -> *mut LeK8Field;
    fn le_k8_field_continue(
        input: *const LeK8Continuation,
        err: *mut c_char,
        err_len: usize,
    ) -> *mut LeK8Field;
    fn le_k8_set_law(
        field: *mut LeK8Field,
        law: *const LeK8KeyLaw,
        err: *mut c_char,
        err_len: usize,
    ) -> c_int;
    fn le_k8_play_keys(
        field: *mut LeK8Field,
        rows: *const u8,
        columns: *const u32,
        n: usize,
        re: f64,
        im: f64,
    ) -> c_int;
    fn le_k8_silence(field: *mut LeK8Field);
    fn le_k8_amplitude(field: *const LeK8Field, mode: usize, re: *mut f64, im: *mut f64) -> c_int;
    fn le_k8_field_free(field: *mut LeK8Field);
    fn le_k8_mode_count(field: *const LeK8Field) -> usize;
    fn le_k8_sample_rate(field: *const LeK8Field) -> u32;
    fn le_k8_samples_elapsed(field: *const LeK8Field) -> u64;
    fn le_k8_set_key(
        field: *mut LeK8Field,
        key: u32,
        modes: *const usize,
        re: *const f64,
        im: *const f64,
        n: usize,
        err: *mut c_char,
        err_len: usize,
    ) -> c_int;
    fn le_k8_strike_key(field: *mut LeK8Field, key: u32, err: *mut c_char, err_len: usize)
        -> c_int;
    fn le_k8_render(field: *mut LeK8Field, out: *mut f32, frames: usize, muted: c_int) -> c_int;
}

fn text(err: &[u8]) -> String {
    let end = err.iter().position(|b| *b == 0).unwrap_or(err.len());
    String::from_utf8_lossy(&err[..end]).into_owned()
}

fn cstring(s: &str) -> Result<CString, String> {
    CString::new(s).map_err(|_| format!("a reference holds a NUL: {s:?}"))
}

/// The most frames one render call takes (the typed API's bound).
pub const MAX_RENDER_FRAMES: usize = 8192;

/// One K8 continuation, owned (dropping it frees the field).
pub struct K8Field {
    ptr: NonNull<LeK8Field>,
}

// SAFETY: the field has no thread affinity, only the rule that one thread
// at a time drives it ("one host-owned serial execution thread"). `K8Field`
// is not `Sync` and every operation takes `&mut self`, so moving it to the
// audio thread with the graph keeps that rule.
unsafe impl Send for K8Field {}

impl std::fmt::Debug for K8Field {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("K8Field")
            .field("modes", &self.mode_count())
            .field("sample_rate", &self.sample_rate())
            .field("samples_elapsed", &self.samples_elapsed())
            .finish()
    }
}

/// The buffers a [`LeK8Input`] borrows: built off the audio thread, alive across the call.
struct RawInput {
    _refs: Vec<CString>,
    _mode_text: Vec<(CString, CString)>,
    _modes: Vec<LeK8Mode>,
    _constituents: Vec<CString>,
    _shapes: Vec<Vec<f64>>,
    _samples: Vec<LeK8Sample>,
    raw: LeK8Input,
}

fn clock_matches() -> Result<(), String> {
    // SAFETY: a pure query of a compile-time size.
    let c_size = unsafe { le_k8_clock_size() };
    if c_size != std::mem::size_of::<CoupledClock>() {
        return Err(format!(
            "QL_CoupledClock is {c_size} bytes in this QL, {} here: the prefix's clock header changed",
            std::mem::size_of::<CoupledClock>()
        ));
    }
    Ok(())
}

impl RawInput {
    fn of(input: &K8Input) -> Result<RawInput, String> {
        let refs = [
            &input.event_ref,
            &input.subject_ref,
            &input.geometry_ref,
            &input.material_ref,
            &input.model_ref,
        ]
        .map(|s| cstring(s));
        let refs: Vec<CString> = refs.into_iter().collect::<Result<_, _>>()?;
        let mode_text: Vec<(CString, CString)> = input
            .modes
            .iter()
            .map(|m| Ok((cstring(&m.reference)?, cstring(&m.source_coordinate)?)))
            .collect::<Result<_, String>>()?;
        let modes: Vec<LeK8Mode> = input
            .modes
            .iter()
            .zip(&mode_text)
            .map(|(m, (r, c))| LeK8Mode {
                reference: r.as_ptr(),
                source_coordinate: c.as_ptr(),
                frequency_hz: m.frequency_hz,
                damping_per_second: m.damping_per_second,
                amplitude_re: m.amplitude_metres.0,
                amplitude_im: m.amplitude_metres.1,
                drive_re: m.drive_metres_per_second.0,
                drive_im: m.drive_metres_per_second.1,
                audio_gain_per_metre: m.audio_gain_per_metre,
            })
            .collect();
        let constituents: Vec<CString> = input
            .samples
            .iter()
            .map(|s| cstring(&s.constituent))
            .collect::<Result<_, _>>()?;
        let mut shapes: Vec<Vec<f64>> = Vec::with_capacity(input.samples.len());
        for s in &input.samples {
            if s.mode_shapes.len() != input.modes.len() {
                return Err(format!(
                    "sample {} carries {} shape functions for {} modes",
                    s.identity,
                    s.mode_shapes.len(),
                    input.modes.len()
                ));
            }
            shapes.push(s.mode_shapes.iter().flatten().copied().collect());
        }
        let samples: Vec<LeK8Sample> = input
            .samples
            .iter()
            .zip(&constituents)
            .zip(&shapes)
            .map(|((s, c), sh)| LeK8Sample {
                identity: s.identity,
                constituent: c.as_ptr(),
                attachment: s.attachment,
                rest: s.rest_metres,
                shapes: sh.as_ptr(),
            })
            .collect();
        let raw = LeK8Input {
            event_ref: refs[0].as_ptr(),
            subject_ref: refs[1].as_ptr(),
            geometry_ref: refs[2].as_ptr(),
            material_ref: refs[3].as_ptr(),
            model_ref: refs[4].as_ptr(),
            generation: input.generation,
            sample_rate: input.sample_rate,
            clock: input.clock,
            driver_numerator: input.driver_numerator,
            driver_denominator: input.driver_denominator,
            modes: modes.as_ptr(),
            mode_count: modes.len(),
            samples: samples.as_ptr(),
            sample_count: samples.len(),
        };
        // Moving the vectors into the struct moves their headers, not their heap buffers: every
        // pointer in `raw` stays valid while this value lives.
        Ok(RawInput {
            _refs: refs,
            _mode_text: mode_text,
            _modes: modes,
            _constituents: constituents,
            _shapes: shapes,
            _samples: samples,
            raw,
        })
    }
}

impl K8Field {
    /// Make the continuation (off the audio thread: it allocates). The
    /// field's own validation answers, in its words, when it refuses.
    pub fn new(input: &K8Input) -> Result<K8Field, String> {
        clock_matches()?;
        let input = RawInput::of(input)?;
        let mut err = [0u8; 512];
        // SAFETY: every pointer in `input.raw` borrows a buffer `input` owns, alive across
        // the call; the shim copies what it keeps and writes at most `err.len()` bytes
        // (NUL-terminated) into `err`.
        let ptr = unsafe { le_k8_field_new(&input.raw, err.as_mut_ptr().cast(), err.len()) };
        NonNull::new(ptr)
            .map(|ptr| K8Field { ptr })
            .ok_or_else(|| text(&err))
    }

    /// Continue a handed-over continuation at its cursor (off the audio thread: it allocates):
    /// the field renders, sample for sample, what the field it was taken from would have. One
    /// that is not a continuation of its own input is refused in QL's words.
    pub fn continue_from(handed: &K8Continuation) -> Result<K8Field, String> {
        clock_matches()?;
        let input = RawInput::of(&handed.input)?;
        let carrier_re: Vec<f64> = handed.carrier.impulses.iter().map(|z| z.0).collect();
        let carrier_im: Vec<f64> = handed.carrier.impulses.iter().map(|z| z.1).collect();
        let acts: Vec<(Vec<usize>, Vec<f64>, Vec<f64>)> = handed
            .pending
            .iter()
            .map(|p| {
                (
                    p.impulses.iter().map(|a| a.0).collect(),
                    p.impulses.iter().map(|a| a.1 .0).collect(),
                    p.impulses.iter().map(|a| a.1 .1).collect(),
                )
            })
            .collect();
        let pending: Vec<LeK8Pending> = handed
            .pending
            .iter()
            .zip(&acts)
            .map(|(p, (modes, re, im))| LeK8Pending {
                at_samples_elapsed: p.at_samples_elapsed,
                modes: modes.as_ptr(),
                re: re.as_ptr(),
                im: im.as_ptr(),
                n: modes.len(),
            })
            .collect();
        let raw = LeK8Continuation {
            input: LeK8Input { ..input.raw },
            samples_elapsed: handed.samples_elapsed,
            driver_remainder: handed.driver_remainder,
            last_unmuted_sample: handed.last_unmuted_sample,
            carrier_steps_per_second: handed.carrier.steps_per_second,
            carrier_anchor_samples: handed.carrier.anchor_samples,
            carrier_anchor_steps: handed.carrier.anchor_steps,
            carrier_reached: handed.carrier.reached,
            carrier_re: carrier_re.as_ptr(),
            carrier_im: carrier_im.as_ptr(),
            carrier_count: carrier_re.len(),
            pending: pending.as_ptr(),
            pending_count: pending.len(),
            heard_from: handed.heard_from.as_ptr(),
            heard_count: handed.heard_from.len(),
        };
        let mut err = [0u8; 512];
        // SAFETY: every pointer in `raw` borrows a buffer alive across the call (`input`,
        // the carrier, pending and heard vectors); the shim copies what it keeps and
        // writes at most `err.len()` bytes (NUL-terminated) into `err`.
        let ptr = unsafe { le_k8_field_continue(&raw, err.as_mut_ptr().cast(), err.len()) };
        NonNull::new(ptr)
            .map(|ptr| K8Field { ptr })
            .ok_or_else(|| text(&err))
    }

    /// Give the field the Torus's keys by QL's played-address law (off the audio thread: it
    /// allocates). A law that cannot stand on this field is refused in QL's words and the field
    /// keeps the law it had.
    pub fn set_law(&mut self, law: &K8KeyLaw) -> Result<(), String> {
        let voices: Vec<LeK8KeyVoice> = law
            .voices
            .iter()
            .map(|v| LeK8KeyVoice {
                mode: v.mode,
                longitude_radians: v.longitude_radians,
                weight: v.weight,
                phase_radians: v.phase_radians,
                m: v.m,
                n: v.n,
            })
            .collect();
        let raw = LeK8KeyLaw {
            arcs: law.arcs,
            voices: voices.as_ptr(),
            voice_count: voices.len(),
            strike: law.strike,
            anchor_samples: law.anchor_samples,
            anchor_steps: law.anchor_steps,
            steps_per_second: law.steps_per_second,
            sample_rate: law.sample_rate,
            cap_metres: law.cap_metres,
        };
        let mut err = [0u8; 256];
        // SAFETY: a live owned field; `voices` outlives the call; `err` bounds the message.
        let ok =
            unsafe { le_k8_set_law(self.ptr.as_ptr(), &raw, err.as_mut_ptr().cast(), err.len()) };
        if ok == 1 {
            Ok(())
        } else {
            Err(text(&err))
        }
    }

    /// One act of the Torus's keys at the cursor, by the law the field was given (the audio
    /// thread: no allocation). False when the field holds no law or refused the act whole (a key
    /// off the surface, a velocity or a summed impulse past the material's cap): nothing moved.
    pub fn play_keys(&mut self, act: &TorusAct) -> bool {
        let n = usize::from(act.count);
        if n == 0 || n > TORUS_ACT_KEYS {
            return false;
        }
        let mut columns = [0u32; TORUS_ACT_KEYS];
        for (c, k) in columns.iter_mut().zip(&act.columns[..n]) {
            *c = u32::from(*k);
        }
        // SAFETY: a live owned field; `rows` and `columns` hold `n` keys each.
        unsafe {
            le_k8_play_keys(
                self.ptr.as_ptr(),
                act.rows.as_ptr(),
                columns.as_ptr(),
                n,
                act.amplitude[0],
                act.amplitude[1],
            ) == 1
        }
    }

    /// Still the body at the cursor (Panic; `ql::ContinuousField::silence`): every resident
    /// state at rest and the acts waiting for later samples dropped; the voices, gains, clock,
    /// cursor and the Carrier's drive stand. The audio thread: no allocation.
    pub fn silence(&mut self) {
        // SAFETY: a live owned field.
        unsafe { le_k8_silence(self.ptr.as_ptr()) }
    }

    /// Mode `mode`'s resident state (re, im), metres; `None` past the modes.
    pub fn amplitude(&self, mode: usize) -> Option<(f64, f64)> {
        let (mut re, mut im) = (0.0, 0.0);
        // SAFETY: a live owned field; the shim writes two doubles when it answers 1.
        (unsafe { le_k8_amplitude(self.ptr.as_ptr(), mode, &mut re, &mut im) } == 1)
            .then_some((re, im))
    }

    pub fn mode_count(&self) -> usize {
        // SAFETY: `ptr` is a live field this value owns.
        unsafe { le_k8_mode_count(self.ptr.as_ptr()) }
    }

    pub fn sample_rate(&self) -> u32 {
        // SAFETY: as above.
        unsafe { le_k8_sample_rate(self.ptr.as_ptr()) }
    }

    /// Samples rendered so far (the continuation's cursor).
    pub fn samples_elapsed(&self) -> u64 {
        // SAFETY: as above.
        unsafe { le_k8_samples_elapsed(self.ptr.as_ptr()) }
    }

    /// Prepare the strike act `key` plays (off the audio thread): the
    /// resident modes it strikes, by index into the input's modes, with
    /// their modal impulses in metres (re, im). An empty act clears the key.
    pub fn set_key(&mut self, key: u8, act: &[(usize, (f64, f64))]) -> Result<(), String> {
        let modes: Vec<usize> = act.iter().map(|a| a.0).collect();
        let re: Vec<f64> = act.iter().map(|a| a.1 .0).collect();
        let im: Vec<f64> = act.iter().map(|a| a.1 .1).collect();
        let mut err = [0u8; 256];
        // SAFETY: the three arrays hold `act.len()` values each and outlive
        // the call; `err` bounds the shim's message.
        let ok = unsafe {
            le_k8_set_key(
                self.ptr.as_ptr(),
                key as u32,
                modes.as_ptr(),
                re.as_ptr(),
                im.as_ptr(),
                act.len(),
                err.as_mut_ptr().cast(),
                err.len(),
            )
        };
        if ok == 1 {
            Ok(())
        } else {
            Err(text(&err))
        }
    }

    /// Strike `key`'s prepared act at the cursor (the audio thread). False
    /// when the key has no act or the field refused it.
    pub fn strike_key(&mut self, key: u8) -> bool {
        let mut err = [0u8; 128];
        // SAFETY: a live owned field; `err` bounds the message.
        unsafe {
            le_k8_strike_key(
                self.ptr.as_ptr(),
                key as u32,
                err.as_mut_ptr().cast(),
                err.len(),
            ) == 1
        }
    }

    /// Render `out.len()` (≤ [`MAX_RENDER_FRAMES`]) mono samples — the
    /// field's `render_audio`. False (and `out` untouched) when the field
    /// refuses the block.
    pub fn render(&mut self, out: &mut [f32], muted: bool) -> bool {
        if out.len() > MAX_RENDER_FRAMES {
            return false;
        }
        // SAFETY: `out` is a writable buffer of `out.len()` floats.
        unsafe {
            le_k8_render(
                self.ptr.as_ptr(),
                out.as_mut_ptr(),
                out.len(),
                muted as c_int,
            ) == 1
        }
    }
}

impl Drop for K8Field {
    fn drop(&mut self) {
        // SAFETY: `ptr` came from `le_k8_field_new` and is freed once.
        unsafe { le_k8_field_free(self.ptr.as_ptr()) }
    }
}

/// The Torus on a MIDI part: one K8 continuation played key by key (see
/// the module doc). The field must be made at the graph's sample rate;
/// at any other rate the node stays silent rather than play at the wrong
/// speed.
#[derive(Debug)]
pub struct K8Instrument {
    field: K8Field,
    one: [f32; 1],
    rate_ok: bool,
    /// Notes whose key had no act or whose strike the field refused.
    refused: u64,
    /// Frames the field refused to render (silence was played).
    unrendered: u64,
}

impl K8Instrument {
    pub fn new(field: K8Field) -> K8Instrument {
        K8Instrument {
            field,
            one: [0.0],
            rate_ok: true,
            refused: 0,
            unrendered: 0,
        }
    }

    pub fn field(&self) -> &K8Field {
        &self.field
    }

    /// Notes that struck nothing (no act for the key, or refused).
    pub fn refused(&self) -> u64 {
        self.refused
    }

    /// Frames the field refused to render.
    pub fn unrendered(&self) -> u64 {
        self.unrendered
    }
}

impl Instrument for K8Instrument {
    fn name(&self) -> &str {
        "Torus"
    }

    fn prepare(&mut self, sample_rate: u32) {
        self.rate_ok = sample_rate == self.field.sample_rate();
    }

    fn note_on(&mut self, key: u8, _velocity: f32, _clock: &Clock) {
        // velocity is unrouted: the act's impulses are the host's, as QL
        // prepared them
        if !self.rate_ok || !self.field.strike_key(key) {
            self.refused += 1;
        }
    }

    fn note_off(&mut self, _key: u8, _clock: &Clock) {}

    // A released note of the struck body rings on with its own damping (QL's release law).
    fn release_all(&mut self, _clock: &Clock) {}

    fn torus_play(&mut self, act: &TorusAct, _clock: &Clock) -> bool {
        let struck = self.rate_ok && self.field.play_keys(act);
        if !struck {
            self.refused += 1;
        }
        struck
    }

    // Panic stills what was struck (QL's silence law); the body's drive stands.
    fn panic(&mut self, _clock: &Clock) {
        self.field.silence();
    }

    fn process(&mut self, frame_io: &mut [f32], _clock: &Clock) {
        let v = if self.rate_ok && self.field.render(&mut self.one, false) {
            self.one[0]
        } else {
            self.unrendered += 1;
            0.0
        };
        frame_io.fill(v);
    }
}
