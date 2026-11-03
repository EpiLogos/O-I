//! The Torus instrument node (feature `k8`; O-I #849, manual §21.2: "The
//! torus is the only generator").
//!
//! A [`K8Instrument`] is the head of a MIDI part's chain that sounds
//! through QL's K8 typed API: it owns one `ql::ContinuousField` (the
//! continuation of supplied M2 modes, `<ql/continuous_field.hpp>` from an
//! installed QL prefix, linked by `build.rs` through the C ABI of
//! `src/k8/field_shim.cpp`) and plays it on the engine's timeline. A key
//! strikes the act the host prepared for it — named resident modes and
//! their modal impulses — at the frame the engine applies the note, and
//! every frame is the field's own `render_audio`: the node adds no physics,
//! no pitch law and no envelope of its own. Picture and sound stay one
//! state because the field the node renders is the continuation QL
//! prepared (the host supplies its modes and samples); the node never
//! re-derives one.
//!
//! What the node does not decide, because QL has not said it: which modes
//! a key strikes and how hard (the host's key table — QL's played-address
//! law, #850), what a key's release does to a struck modal body (the modes
//! ring on with their own damping; `note_off` does nothing), and how Panic
//! silences it (`release_all` does nothing: the typed API has no
//! allocation-free silencing operation — the lane's PROPOSE).
//!
//! Realtime: `strike` and `render_audio` run on the audio thread, the
//! field's "one host-owned serial execution thread". The shim allocates
//! nothing there; `ql::ContinuousField::strike` reserves one vector per act
//! (see `field_shim.cpp`, `le_k8_strike_key`) — the one allocation on the
//! engine's audio path with this node, and QL's to remove.

use crate::graph::{Clock, Instrument};
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

#[repr(C)]
struct LeK8Field {
    _opaque: [u8; 0],
}

extern "C" {
    fn le_k8_clock_size() -> usize;
    fn le_k8_field_new(input: *const LeK8Input, err: *mut c_char, err_len: usize)
        -> *mut LeK8Field;
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

impl K8Field {
    /// Make the continuation (off the audio thread: it allocates). The
    /// field's own validation answers, in its words, when it refuses.
    pub fn new(input: &K8Input) -> Result<K8Field, String> {
        // SAFETY: a pure query of a compile-time size.
        let c_size = unsafe { le_k8_clock_size() };
        if c_size != std::mem::size_of::<CoupledClock>() {
            return Err(format!(
                "QL_CoupledClock is {c_size} bytes in this QL, {} here: the prefix's clock header changed",
                std::mem::size_of::<CoupledClock>()
            ));
        }
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
        let mut err = [0u8; 512];
        // SAFETY: every pointer in `raw` borrows a buffer that outlives the
        // call; the shim copies what it keeps and writes at most `err.len()`
        // bytes (NUL-terminated) into `err`.
        let ptr = unsafe { le_k8_field_new(&raw, err.as_mut_ptr().cast(), err.len()) };
        NonNull::new(ptr)
            .map(|ptr| K8Field { ptr })
            .ok_or_else(|| text(&err))
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

    fn release_all(&mut self, _clock: &Clock) {}

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
