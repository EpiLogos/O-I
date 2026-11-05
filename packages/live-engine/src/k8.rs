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
//! strike nothing (they only let the key go from the hand); Panic stills what was struck (`ql::ContinuousField::silence`,
//! [`Instrument::panic`]). A MIDI note on the part strikes the act prepared
//! for its key ([`K8Field::set_key`]); QL gives no law from a MIDI pitch to
//! a Jankó key, so a part with none prepared strikes nothing for a note.
//!
//! The hand's touch on the keys it holds (O-I #853; DLW §21.2 The keyboard:
//! "Velocity and pressure set how hard each point is struck"; §21.4 Rules:
//! "Pressure or bend on a held note moves the sound. It does not change the
//! tuning"): a channel pressure (0 to 1) or a pitch bend (its force either
//! way from rest) is a force on the held points. A rise of it strikes each
//! held key's own act again by the rise ([`K8Field::strike_key_by`]), a full
//! push from rest as hard as its note struck; a fall lets go, and the body
//! rings on. The modes keep their frequencies: nothing retunes. A Torus its
//! owner handed over holds no note of its own, so a touch strikes nothing
//! there: its owner strikes the rise on the keys its keyboard holds (the
//! shell's playing path, `jankoInput.ts` touch), and that act lands as the
//! owner's.
//!
//! Realtime: striking, silencing and `render_audio` run on the audio
//! thread, the field's "one host-owned serial execution thread", and
//! allocate nothing (`strike_now`, `silence`, `TorusKeys::play`;
//! `tests/k8_no_alloc.rs` counts them at zero). Making a field and its law
//! allocates, off the thread.

use crate::graph::{
    Clock, Instrument, TorusAct, TorusHear, TorusStrike, TorusVoice, TorusVoiceNote,
    TORUS_ACT_KEYS, TORUS_HEAR_FRAMES, TORUS_NOTE_VOICES, TORUS_STRIKE_MODES, TORUS_VOICE_MADE_WAY,
    TORUS_VOICE_NOTES,
};
use std::ffi::{c_char, c_int, CString};
use std::ptr::NonNull;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;

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

/// An act admitted for a later sample and not yet landed (`ql::PendingAct`): impulses by mode index, or (an act voicing
/// notes, QL-MEF #287) its notes and the ids of the notes making way for them.
#[derive(Debug, Clone, PartialEq, Default)]
pub struct K8Pending {
    pub at_samples_elapsed: u64,
    pub impulses: Vec<(usize, (f64, f64))>,
    pub notes: Vec<K8Note>,
    pub made_way: Vec<u64>,
}

/// The voices of one note (`ql::note_voices`, QL-MEF #287 packet A; DLW manual §21.2 Rules: "Each note strikes its own eight
/// voices").
pub const NOTE_VOICES: usize = 8;
/// The most notes the native bank holds (`ql::max_bank_notes`), and the most one act names as making way.
pub const BANK_NOTES: usize = 32;
pub const MADE_WAY_MAX: usize = 64;
// The notes the engine carries to a Torus (graph.rs `TorusVoice`) are the bank's.
const _: () = assert!(
    TORUS_NOTE_VOICES == NOTE_VOICES
        && TORUS_VOICE_NOTES == BANK_NOTES
        && TORUS_VOICE_MADE_WAY == MADE_WAY_MAX
);

/// One voice of a note as it is struck (`ql::NoteVoice`): the mode it is like (whose material it rings in and whose hearing it
/// is heard by), its own frequency and its impulse (re, im), modal metres.
#[derive(Debug, Clone, Copy, PartialEq, Default)]
pub struct K8NoteVoice {
    pub like: usize,
    pub frequency_hz: f64,
    pub impulse: (f64, f64),
}

/// One note of an act (`ql::NoteAct`): its owner's id and its eight voices.
#[derive(Debug, Clone, Copy, PartialEq, Default)]
pub struct K8Note {
    pub id: u64,
    pub voices: [K8NoteVoice; NOTE_VOICES],
}

/// One voice of a bank slot as it rings (`ql::BankVoice`): the mode it is like, its frequency and its state (re, im).
#[derive(Debug, Clone, Copy, PartialEq, Default)]
pub struct K8BankVoice {
    pub like: usize,
    pub frequency_hz: f64,
    pub state: (f64, f64),
}

/// One slot of the native bank as it stands (`ql::BankNote`): whether it holds a note, that note's id, the order its last note
/// was voiced in, its voices and a note's voices still fading there.
#[derive(Debug, Clone, Copy, PartialEq, Default)]
pub struct K8BankSlot {
    pub slot: usize,
    pub held: bool,
    pub id: u64,
    pub order: u64,
    pub voices: [K8BankVoice; NOTE_VOICES],
    pub fading: [K8BankVoice; NOTE_VOICES],
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
    /// The notes as they ring (QL-MEF #287) and the order the last was voiced in.
    pub bank: Vec<K8BankSlot>,
    pub bank_order: u64,
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

/// One voice of an arc's cell (`ql::CellVoice`, QL-MEF #287): the mode it is like, its own frequency and its surface term.
#[derive(Debug, Clone, Copy, PartialEq, Default)]
pub struct K8CellVoice {
    pub like: usize,
    pub frequency_hz: f64,
    pub longitude_radians: f64,
    pub weight: f64,
    pub phase_radians: f64,
    pub m: u32,
    pub n: u32,
}

/// A note the owner counts (`ql::TorusKeyLaw::Counted`): its id and its key.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct K8CountedNote {
    pub id: u64,
    pub row: u8,
    pub column: u32,
}

/// QL's played-address law as its owner hands it over (`ql::TorusKeyLaw`, `ql.torus-keys/v1`): each
/// key's ring arc, the voices of the tuning in force, Strike, the pulse, the rate and the material cap;
/// and, where each note sounds its own voices (QL-MEF #287, Logic on the torus), each arc's cell, the
/// Polyphony, the owner's count of notes and the id its next note takes (`cells` empty otherwise).
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
    pub cells: Vec<[K8CellVoice; NOTE_VOICES]>,
    pub polyphony: u32,
    pub notes: Vec<K8CountedNote>,
    pub next_note: u64,
}

#[repr(C)]
#[derive(Clone, Copy, Default)]
struct LeK8NoteVoice {
    like: usize,
    frequency_hz: f64,
    re: f64,
    im: f64,
}

#[repr(C)]
#[derive(Clone, Copy, Default)]
struct LeK8Note {
    id: u64,
    voices: [LeK8NoteVoice; NOTE_VOICES],
}

#[repr(C)]
#[derive(Clone, Copy, Default)]
struct LeK8BankVoice {
    like: usize,
    frequency_hz: f64,
    re: f64,
    im: f64,
}

#[repr(C)]
#[derive(Clone, Copy, Default)]
struct LeK8BankSlot {
    slot: usize,
    held: c_int,
    id: u64,
    order: u64,
    voices: [LeK8BankVoice; NOTE_VOICES],
    fading: [LeK8BankVoice; NOTE_VOICES],
}

#[repr(C)]
struct LeK8CellVoice {
    like: usize,
    frequency_hz: f64,
    longitude_radians: f64,
    weight: f64,
    phase_radians: f64,
    m: u32,
    n: u32,
}

#[repr(C)]
struct LeK8Counted {
    id: u64,
    row: u8,
    column: u32,
}

#[repr(C)]
struct LeK8Pending {
    at_samples_elapsed: u64,
    modes: *const usize,
    re: *const f64,
    im: *const f64,
    n: usize,
    notes: *const LeK8Note,
    note_count: usize,
    made_way: *const u64,
    made_way_count: usize,
}

/// A note as the engine carried it to the Torus (graph.rs `TorusVoiceNote`), as the field voices it.
fn note_of(note: &TorusVoiceNote) -> K8Note {
    let mut out = K8Note {
        id: note.id,
        ..K8Note::default()
    };
    for (k, v) in out.voices.iter_mut().enumerate() {
        *v = K8NoteVoice {
            like: usize::from(note.like[k]),
            frequency_hz: note.frequency_hz[k],
            impulse: (note.re[k], note.im[k]),
        };
    }
    out
}

fn le_note(note: &K8Note) -> LeK8Note {
    let mut out = LeK8Note {
        id: note.id,
        ..LeK8Note::default()
    };
    for (o, v) in out.voices.iter_mut().zip(&note.voices) {
        *o = LeK8NoteVoice {
            like: v.like,
            frequency_hz: v.frequency_hz,
            re: v.impulse.0,
            im: v.impulse.1,
        };
    }
    out
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
    bank: *const LeK8BankSlot,
    bank_count: usize,
    bank_order: u64,
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
    cells: *const LeK8CellVoice,
    cell_count: usize,
    polyphony: u32,
    notes: *const LeK8Counted,
    note_count: usize,
    next_note: u64,
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
    fn le_k8_strike_modes(
        field: *mut LeK8Field,
        modes: *const u16,
        re: *const f64,
        im: *const f64,
        n: usize,
    ) -> c_int;
    fn le_k8_move_gains(field: *mut LeK8Field, gains: *const f64, n: usize, frames: u64) -> c_int;
    fn le_k8_release_keys(field: *mut LeK8Field, rows: *const u8, columns: *const u32, n: usize);
    fn le_k8_voice_notes(
        field: *mut LeK8Field,
        notes: *const LeK8Note,
        n: usize,
        made_way: *const u64,
        m: usize,
    ) -> c_int;
    fn le_k8_bank_count(field: *const LeK8Field) -> usize;
    fn le_k8_bank_slot(field: *const LeK8Field, i: usize, out: *mut LeK8BankSlot) -> c_int;
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
    /// Each key's prepared act as a touch strikes it again ([`K8Field::strike_key_by`]), kept here as it was prepared.
    keys: Box<[KeyAct; 128]>,
}

/// A key's prepared act (O-I #853): its modes and their impulses (re, im), at most
/// [`TORUS_STRIKE_MODES`]; none (`count` 0) for a key with no act, or one too wide for a touch.
#[derive(Debug, Clone, Copy, Default)]
struct KeyAct {
    count: u8,
    modes: [u16; TORUS_STRIKE_MODES],
    re: [f64; TORUS_STRIKE_MODES],
    im: [f64; TORUS_STRIKE_MODES],
}

fn no_keys() -> Box<[KeyAct; 128]> {
    Box::new([KeyAct::default(); 128])
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
            .map(|ptr| K8Field {
                ptr,
                keys: no_keys(),
            })
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
        let notes: Vec<Vec<LeK8Note>> = handed
            .pending
            .iter()
            .map(|p| p.notes.iter().map(le_note).collect())
            .collect();
        let bank: Vec<LeK8BankSlot> = handed
            .bank
            .iter()
            .map(|s| {
                let lane = |voices: &[K8BankVoice; NOTE_VOICES]| {
                    voices.map(|v| LeK8BankVoice {
                        like: v.like,
                        frequency_hz: v.frequency_hz,
                        re: v.state.0,
                        im: v.state.1,
                    })
                };
                LeK8BankSlot {
                    slot: s.slot,
                    held: c_int::from(s.held),
                    id: s.id,
                    order: s.order,
                    voices: lane(&s.voices),
                    fading: lane(&s.fading),
                }
            })
            .collect();
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
            .zip(&notes)
            .map(|((p, (modes, re, im)), notes)| LeK8Pending {
                at_samples_elapsed: p.at_samples_elapsed,
                modes: modes.as_ptr(),
                re: re.as_ptr(),
                im: im.as_ptr(),
                n: modes.len(),
                notes: notes.as_ptr(),
                note_count: notes.len(),
                made_way: p.made_way.as_ptr(),
                made_way_count: p.made_way.len(),
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
            bank: bank.as_ptr(),
            bank_count: bank.len(),
            bank_order: handed.bank_order,
        };
        let mut err = [0u8; 512];
        // SAFETY: every pointer in `raw` borrows a buffer alive across the call (`input`,
        // the carrier, pending and heard vectors); the shim copies what it keeps and
        // writes at most `err.len()` bytes (NUL-terminated) into `err`.
        let ptr = unsafe { le_k8_field_continue(&raw, err.as_mut_ptr().cast(), err.len()) };
        NonNull::new(ptr)
            .map(|ptr| K8Field {
                ptr,
                keys: no_keys(),
            })
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
        let cells: Vec<LeK8CellVoice> = law
            .cells
            .iter()
            .flatten()
            .map(|v| LeK8CellVoice {
                like: v.like,
                frequency_hz: v.frequency_hz,
                longitude_radians: v.longitude_radians,
                weight: v.weight,
                phase_radians: v.phase_radians,
                m: v.m,
                n: v.n,
            })
            .collect();
        let notes: Vec<LeK8Counted> = law
            .notes
            .iter()
            .map(|n| LeK8Counted {
                id: n.id,
                row: n.row,
                column: n.column,
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
            cells: cells.as_ptr(),
            cell_count: cells.len(),
            polyphony: law.polyphony,
            notes: notes.as_ptr(),
            note_count: notes.len(),
            next_note: law.next_note,
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

    /// Keys let go (the audio thread: no allocation): they leave the count of notes the field's law keeps (QL-MEF #287), and
    /// nothing moves in the body; a released note keeps its own tail.
    pub fn release_keys(&mut self, rows: &[u8], columns: &[u32]) {
        let n = rows.len().min(columns.len());
        // SAFETY: a live owned field; `rows` and `columns` hold at least `n` keys each, read during the call only.
        unsafe { le_k8_release_keys(self.ptr.as_ptr(), rows.as_ptr(), columns.as_ptr(), n) }
    }

    /// Voice notes its owner voiced at the cursor (QL-MEF #287 packet A): each note its own eight voices, and the notes that
    /// made way for them fading, as the owner's field voiced them (the audio thread: no allocation). False when the field refused
    /// the act whole (no note, more than [`BANK_NOTES`], a note already held, or a voice it cannot ring): nothing moved.
    pub fn voice_notes(&mut self, notes: &[K8Note], made_way: &[u64]) -> bool {
        if notes.is_empty() || notes.len() > BANK_NOTES || made_way.len() > MADE_WAY_MAX {
            return false;
        }
        let mut raw = [LeK8Note::default(); BANK_NOTES];
        for (r, note) in raw.iter_mut().zip(notes) {
            *r = le_note(note);
        }
        // SAFETY: a live owned field; `raw` holds `notes.len()` notes and `made_way` its ids, read during the call only.
        unsafe {
            le_k8_voice_notes(
                self.ptr.as_ptr(),
                raw.as_ptr(),
                notes.len(),
                made_way.as_ptr(),
                made_way.len(),
            ) == 1
        }
    }

    /// The bank as it stands (off the audio thread: a reading that allocates; nothing moves).
    pub fn bank(&self) -> Vec<K8BankSlot> {
        // SAFETY: a live owned field.
        let n = unsafe { le_k8_bank_count(self.ptr.as_ptr()) };
        (0..n)
            .filter_map(|i| {
                let mut slot = LeK8BankSlot::default();
                // SAFETY: a live owned field; the shim writes one slot into `slot` when it answers 1.
                (unsafe { le_k8_bank_slot(self.ptr.as_ptr(), i, &mut slot) } == 1).then(|| {
                    let lane = |voices: &[LeK8BankVoice; NOTE_VOICES]| {
                        voices.map(|v| K8BankVoice {
                            like: v.like,
                            frequency_hz: v.frequency_hz,
                            state: (v.re, v.im),
                        })
                    };
                    K8BankSlot {
                        slot: slot.slot,
                        held: slot.held != 0,
                        id: slot.id,
                        order: slot.order,
                        voices: lane(&slot.voices),
                        fading: lane(&slot.fading),
                    }
                })
            })
            .collect()
    }

    /// Strike an act its owner landed at the cursor ([`TorusStrike`]: the impulses its owner's law gave the modes,
    /// by mode index), as the owner's field struck it (the audio thread: no allocation). False when the field
    /// refused it whole (a mode it does not hold, named twice, or an impulse past its bound): nothing moved.
    pub fn strike_modes(&mut self, act: &TorusStrike) -> bool {
        let n = usize::from(act.count);
        if n == 0 || n > TORUS_STRIKE_MODES {
            return false;
        }
        // SAFETY: a live owned field; the three arrays hold `n` ≤ 16 values each.
        unsafe {
            le_k8_strike_modes(
                self.ptr.as_ptr(),
                act.modes.as_ptr(),
                act.re.as_ptr(),
                act.im.as_ptr(),
                n,
            ) == 1
        }
    }

    /// Move the gains the body is heard by to `gains` (one per mode, in mode order) over the next `frames`
    /// samples from the cursor, as its owner reached them over a part of its block (O-I #849 round 14;
    /// `ql::ContinuousField::move_gains`), however those samples are rendered (the audio thread: no
    /// allocation). A move under way is reached on from where it stands. False when the field refused it
    /// whole (not one finite gain per mode within its bound, or a length outside 1 to 8192): nothing moved.
    pub fn move_gains(&mut self, gains: &[f64], frames: u32) -> bool {
        if frames == 0 || frames > TORUS_HEAR_FRAMES {
            return false;
        }
        // SAFETY: a live owned field; `gains` holds `gains.len()` doubles, read during the call only.
        unsafe {
            le_k8_move_gains(
                self.ptr.as_ptr(),
                gains.as_ptr(),
                gains.len(),
                u64::from(frames),
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
        if ok != 1 {
            return Err(text(&err));
        }
        let mut kept = KeyAct::default();
        if act.len() <= TORUS_STRIKE_MODES {
            for (i, (mode, (re, im))) in act.iter().enumerate() {
                let Ok(mode) = u16::try_from(*mode) else {
                    kept.count = 0;
                    break;
                };
                (kept.modes[i], kept.re[i], kept.im[i]) = (mode, *re, *im);
                kept.count += 1;
            }
        }
        if let Some(slot) = self.keys.get_mut(usize::from(key)) {
            *slot = kept;
        }
        Ok(())
    }

    /// Strike `key`'s prepared act again at `by` of its impulses (0 < `by` ≤ 1) at the cursor (O-I #853: a rise of
    /// the hand's force on a held key; the audio thread: no allocation). False when the key has no act, its act
    /// strikes more than [`TORUS_STRIKE_MODES`] modes, `by` is outside its range, or the field refused it: nothing
    /// moved.
    pub fn strike_key_by(&mut self, key: u8, by: f64) -> bool {
        let Some(act) = self.keys.get(usize::from(key)) else {
            return false;
        };
        let n = usize::from(act.count);
        if n == 0 || !(by > 0.0 && by <= 1.0) {
            return false;
        }
        let (mut re, mut im) = ([0f64; TORUS_STRIKE_MODES], [0f64; TORUS_STRIKE_MODES]);
        for ((r, i), (are, aim)) in re
            .iter_mut()
            .zip(im.iter_mut())
            .zip(act.re.iter().zip(&act.im))
        {
            (*r, *i) = (are * by, aim * by);
        }
        // SAFETY: a live owned field; the three arrays hold `n` ≤ 16 values each, read during the call only.
        unsafe {
            le_k8_strike_modes(
                self.ptr.as_ptr(),
                act.modes.as_ptr(),
                re.as_ptr(),
                im.as_ptr(),
                n,
            ) == 1
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

/// The owner's acts one Torus keeps for later samples of its continuation; past this many an act is
/// refused and counted ([`K8Instrument::refused`]).
pub const K8_WAITING: usize = 256;

/// The Torus on a MIDI part: one K8 continuation played key by key (see
/// the module doc). The field must be made at the graph's sample rate;
/// at any other rate the node stays silent rather than play at the wrong
/// speed.
///
/// A Torus its owner handed over ([`K8Instrument::handed_over`]) strikes the acts its owner lands
/// after that handover ([`crate::EngineEvent::TorusStrike`]) at the owner's own sample: one landing at
/// a sample its continuation has not reached waits for it, and lands before that sample renders, as
/// the owner's did; one whose sample has passed lands at once and is counted late. Such a Torus
/// strikes no note of its own: a note on its part (its clip's or a MIDI note-on) is its owner's to
/// play, which the host hands the owner as a key at the note's sample and the owner strikes back as
/// its act. A Torus not handed over strikes a note's prepared act ([`K8Field::set_key`]), if any.
///
/// It is heard by the gains its owner is heard by (O-I #849 round 14): a move its owner reached over a
/// part of its block ([`crate::EngineEvent::TorusHear`]) waits for the owner's sample and is reached
/// from it over the owner's samples, as the owner reached it, though the node renders one frame at a
/// time; one whose sample has passed is reached at once and counted late.
#[derive(Debug)]
pub struct K8Instrument {
    field: K8Field,
    one: [f32; 1],
    rate_ok: bool,
    /// What it could not do as it was asked, counted where its host reads them ([`K8Counts`]).
    counts: Arc<K8Counts>,
    handover: Option<u32>,
    /// The owner's acts for later samples, by sample (capacity [`K8_WAITING`], made off the audio thread).
    waiting: Vec<TorusStrike>,
    /// The owner's moves for later samples, by sample, a move's parts together (capacity [`K8_WAITING`]).
    hearing: Vec<TorusHear>,
    /// One gain per mode: where a move's parts are gathered as it is reached (made off the audio thread).
    gains: Vec<f64>,
    /// The parts of the notes its owner voiced for later samples, by sample, an act's parts together (capacity
    /// [`K8_WAITING`]; O-I #850 round 24).
    voicing: Vec<TorusVoice>,
    /// Where an act's notes and the notes making way are gathered as it is voiced (made off the audio thread).
    notes: Vec<K8Note>,
    made_way: Vec<u64>,
    /// The keys its notes hold (O-I #853): what a touch strikes again. A Torus handed over holds none.
    held: [bool; 128],
    /// The hand's force of each touch as it last stood (0: the bend's, either way; 1: the pressure's).
    force: [f32; 2],
}

/// A Torus node's counts as its host reads them while it plays (O-I #849 round 13): the audio
/// thread adds to them (no lock, no allocation) and the host reads them from its own thread.
#[derive(Debug, Default)]
pub struct K8Counts {
    /// Notes and acts that struck nothing (no key or act, refused by the field, or no room to wait).
    pub refused: AtomicU64,
    /// Frames the field refused to render (silence was played).
    pub unrendered: AtomicU64,
    /// The owner's acts that came after their sample and landed at once.
    pub late: AtomicU64,
}

impl K8Counts {
    fn add(counter: &AtomicU64) {
        counter.fetch_add(1, Ordering::Relaxed);
    }
}

impl K8Instrument {
    pub fn new(field: K8Field) -> K8Instrument {
        let modes = field.mode_count();
        K8Instrument {
            field,
            one: [0.0],
            rate_ok: true,
            counts: Arc::default(),
            handover: None,
            waiting: Vec::with_capacity(K8_WAITING),
            hearing: Vec::with_capacity(K8_WAITING),
            gains: vec![0.0; modes],
            voicing: Vec::with_capacity(K8_WAITING),
            notes: Vec::with_capacity(BANK_NOTES),
            made_way: Vec::with_capacity(MADE_WAY_MAX),
            held: [false; 128],
            force: [0.0; 2],
        }
    }

    /// The Torus of the host's `handover`-th handover of its owner's field: the acts its owner lands
    /// after it are this Torus's to strike.
    pub fn handed_over(mut self, handover: u32) -> K8Instrument {
        self.handover = Some(handover);
        self
    }

    pub fn field(&self) -> &K8Field {
        &self.field
    }

    /// Notes and owner's acts that struck nothing (no key or act for a note, refused by the field,
    /// or no room left to wait).
    pub fn refused(&self) -> u64 {
        self.counts.refused.load(Ordering::Relaxed)
    }

    /// Frames the field refused to render.
    pub fn unrendered(&self) -> u64 {
        self.counts.unrendered.load(Ordering::Relaxed)
    }

    /// The owner's acts that came after their sample and landed at once.
    pub fn late(&self) -> u64 {
        self.counts.late.load(Ordering::Relaxed)
    }

    /// Its counts, for its host to read while the engine plays it.
    pub fn counts(&self) -> Arc<K8Counts> {
        Arc::clone(&self.counts)
    }

    /// The owner's acts waiting for their sample.
    pub fn waiting(&self) -> usize {
        self.waiting.len()
    }

    /// The parts of the owner's moves waiting for their sample.
    pub fn hearing(&self) -> usize {
        self.hearing.len()
    }

    /// Reach the move whose parts stand first in `hearing`: gathered whole (one part after another,
    /// every mode once, all for one sample and length) it is moved; otherwise refused and counted.
    fn hear(&mut self) {
        let Some(first) = self.hearing.first().copied() else {
            return;
        };
        let ends = self
            .hearing
            .iter()
            .position(|h| h.at != first.at || h.frames != first.frames)
            .unwrap_or(self.hearing.len());
        let mut whole = usize::from(first.total) == self.gains.len();
        let mut reached = 0;
        for part in &self.hearing[..ends] {
            let from = usize::from(part.first);
            let gains = part.gains();
            if !whole
                || from != reached
                || part.total != first.total
                || from + gains.len() > self.gains.len()
            {
                whole = false;
                break;
            }
            self.gains[from..from + gains.len()].copy_from_slice(gains);
            reached += gains.len();
        }
        self.hearing.drain(..ends);
        if !(whole
            && reached == self.gains.len()
            && self.field.move_gains(&self.gains, first.frames))
        {
            K8Counts::add(&self.counts.refused);
        }
    }

    /// A touch of the hand (see the module doc): `which` force now stands at `force` (0 to 1); a rise strikes each key
    /// its notes hold again by the rise, each that strikes nothing counted refused. Taken whatever it strikes.
    fn touched(&mut self, which: usize, force: f32) -> bool {
        let force = force.clamp(0.0, 1.0);
        let rise = force - self.force[which];
        self.force[which] = force;
        if rise <= 0.0 || !self.rate_ok {
            return true;
        }
        for key in 0..128u8 {
            if self.held[usize::from(key)] && !self.field.strike_key_by(key, f64::from(rise)) {
                K8Counts::add(&self.counts.refused);
            }
        }
        true
    }

    /// Voice the act at the head of what waits (O-I #850 round 24): its parts, gathered whole, as one act of the field (QL's
    /// own `voice_notes`), as the owner's field voiced it. An act whose parts did not all come is dropped and counted refused.
    fn voice(&mut self) {
        let first = self.voicing[0];
        let parts = usize::from(first.parts);
        let mut whole = 0;
        while whole < parts
            && self.voicing.get(whole).is_some_and(|v| {
                v.at == first.at
                    && v.handover == first.handover
                    && v.parts == first.parts
                    && usize::from(v.part) == whole
            })
        {
            whole += 1;
        }
        self.notes.clear();
        self.made_way.clear();
        if whole == parts {
            for part in &self.voicing[..parts] {
                if let Some(note) = &part.note {
                    if self.notes.len() < self.notes.capacity() {
                        self.notes.push(note_of(note));
                    }
                }
                for id in part.made_way() {
                    if self.made_way.len() < self.made_way.capacity() {
                        self.made_way.push(*id);
                    }
                }
            }
        }
        self.voicing.drain(..whole.max(1));
        if whole != parts || !self.field.voice_notes(&self.notes, &self.made_way) {
            K8Counts::add(&self.counts.refused);
        }
    }

    fn strike(&mut self, act: &TorusStrike) -> bool {
        let struck = self.field.strike_modes(act);
        if !struck {
            K8Counts::add(&self.counts.refused);
        }
        struck
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
        // A Torus its owner handed over strikes no note of its own: the note is its owner's to play
        // (the host hands it over as a key at its sample), and sounds here as the owner's act.
        if self.handover.is_some() {
            return;
        }
        // velocity is unrouted: the act's impulses are the host's, as QL
        // prepared them
        if !self.rate_ok || !self.field.strike_key(key) {
            K8Counts::add(&self.counts.refused);
        }
        if let Some(held) = self.held.get_mut(usize::from(key)) {
            *held = true;
        }
    }

    // A released note of the struck body rings on with its own damping (QL's release law): it is only no longer held.
    fn note_off(&mut self, key: u8, _clock: &Clock) {
        if let Some(held) = self.held.get_mut(usize::from(key)) {
            *held = false;
        }
    }

    fn release_all(&mut self, _clock: &Clock) {
        self.held = [false; 128];
    }

    fn touch(&self) -> crate::graph::Touch {
        crate::graph::Touch {
            bend: Ok(()),
            pressure: Ok(()),
        }
    }

    // A bend is a force along the held keys, either way from rest (see the module doc).
    fn bend(&mut self, amount: f32, _clock: &Clock) -> bool {
        self.touched(0, amount.abs())
    }

    fn pressure(&mut self, amount: f32, _clock: &Clock) -> bool {
        self.touched(1, amount)
    }

    fn torus_play(&mut self, act: &TorusAct, _clock: &Clock) -> bool {
        let struck = self.rate_ok && self.field.play_keys(act);
        if !struck {
            K8Counts::add(&self.counts.refused);
        }
        struck
    }

    fn torus_handover(&self) -> Option<u32> {
        self.handover
    }

    // a Torus at another rate renders nothing, so it stands at no sample a hand-over waits for
    fn torus_cursor(&self) -> Option<u64> {
        self.rate_ok.then(|| self.field.samples_elapsed())
    }

    fn torus_strike(&mut self, act: &TorusStrike, _clock: &Clock) -> bool {
        if self.handover != Some(act.handover) {
            return false;
        }
        if !self.rate_ok {
            K8Counts::add(&self.counts.refused);
            return false;
        }
        let now = self.field.samples_elapsed();
        if act.at <= now {
            if act.at < now {
                K8Counts::add(&self.counts.late);
            }
            return self.strike(act);
        }
        if self.waiting.len() == self.waiting.capacity() {
            K8Counts::add(&self.counts.refused);
            return false;
        }
        // after the acts for the same sample that came before it: they land in the order they came
        let at = self.waiting.partition_point(|w| w.at <= act.at);
        self.waiting.insert(at, *act);
        true
    }

    fn torus_hear(&mut self, hear: &TorusHear, _clock: &Clock) -> bool {
        if self.handover != Some(hear.handover) {
            return false;
        }
        if !self.rate_ok || self.hearing.len() == self.hearing.capacity() {
            K8Counts::add(&self.counts.refused);
            return false;
        }
        // after the parts for the same sample that came before it: a move's parts stay together, in order
        let at = self.hearing.partition_point(|h| h.at <= hear.at);
        self.hearing.insert(at, *hear);
        true
    }

    fn torus_voice(&mut self, voice: &TorusVoice, _clock: &Clock) -> bool {
        if self.handover != Some(voice.handover) {
            return false;
        }
        if !self.rate_ok || self.voicing.len() == self.voicing.capacity() {
            K8Counts::add(&self.counts.refused);
            return false;
        }
        // after the parts for the same sample that came before it: an act's parts stay together, in order
        let at = self.voicing.partition_point(|v| v.at <= voice.at);
        self.voicing.insert(at, *voice);
        true
    }

    // Panic stills what was struck (QL's silence law), lets every held key go and drops the acts waiting for later samples;
    // the body's drive and the gains it is heard by stand, and so do the moves its owner reached.
    fn panic(&mut self, _clock: &Clock) {
        self.field.silence();
        self.waiting.clear();
        self.voicing.clear();
        self.held = [false; 128];
    }

    fn process(&mut self, frame_io: &mut [f32], _clock: &Clock) {
        if !self.waiting.is_empty() && self.rate_ok {
            let now = self.field.samples_elapsed();
            while self.waiting.first().is_some_and(|w| w.at <= now) {
                let act = self.waiting.remove(0);
                self.strike(&act);
            }
        }
        if !self.hearing.is_empty() && self.rate_ok {
            let now = self.field.samples_elapsed();
            while self.hearing.first().is_some_and(|h| h.at <= now) {
                if self.hearing[0].at < now {
                    K8Counts::add(&self.counts.late);
                }
                self.hear();
            }
        }
        if !self.voicing.is_empty() && self.rate_ok {
            let now = self.field.samples_elapsed();
            while self.voicing.first().is_some_and(|v| v.at <= now) {
                if self.voicing[0].at < now {
                    K8Counts::add(&self.counts.late);
                }
                self.voice();
            }
        }
        let v = if self.rate_ok && self.field.render(&mut self.one, false) {
            self.one[0]
        } else {
            K8Counts::add(&self.counts.unrendered);
            0.0
        };
        frame_io.fill(v);
    }
}
