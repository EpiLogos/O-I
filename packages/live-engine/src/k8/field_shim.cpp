// A C ABI over QL's K8 typed API (`ql::ContinuousField`,
// <ql/continuous_field.hpp> from an installed QL prefix), so the engine's
// Torus node (`src/k8.rs`) can hold one continuation and play it on the
// audio thread. It adds no physics: every operation is one call into the
// typed API, and every exception the API raises is caught here and handed
// back as text (an exception must not cross into Rust).
//
// The field's own rule binds: "Control methods and rendering have one
// host-owned serial execution thread. Prepare/change topology off the audio
// callback." `le_k8_field_new`, `le_k8_field_continue`, `le_k8_set_key` and
// `le_k8_set_law` allocate and run off the audio thread; `le_k8_strike_key`,
// `le_k8_play_keys`, `le_k8_release_keys`, `le_k8_voice_notes`, `le_k8_strike_modes`, `le_k8_silence` and
// `le_k8_render` are the audio thread's, and allocate nothing (`ql::ContinuousField::strike_now`,
// `voice_now`, `silence`, `render_audio`, `ql::TorusKeys::play` and `release` are noexcept and
// allocation-free).
#include <ql/continuous_field.hpp>
#include <ql/torus_keys.hpp>

#include <cstdio>
#include <cstring>
#include <exception>
#include <memory>
#include <new>
#include <string>
#include <vector>

extern "C" {

struct LeK8Mode {
    const char *reference;
    const char *source_coordinate;
    double frequency_hz, damping_per_second;
    double amplitude_re, amplitude_im, drive_re, drive_im;
    double audio_gain_per_metre;
};

struct LeK8Sample {
    std::uint64_t identity;
    const char *constituent;
    unsigned attachment;
    double rest[3];
    // mode_count × 3 shape coefficients, mode-major
    const double *shapes;
};

struct LeK8Input {
    const char *event_ref, *subject_ref, *geometry_ref, *material_ref, *model_ref;
    std::uint64_t generation;
    unsigned sample_rate;
    QL_CoupledClock clock;
    std::uint32_t driver_numerator, driver_denominator;
    const LeK8Mode *modes;
    std::size_t mode_count;
    const LeK8Sample *samples;
    std::size_t sample_count;
};

// A continuation as QL hands it over (`ql.continuous-handover/v1`, O-I #849): the input with each mode's
// resident state as its amplitude, the cursor and the driver's remainder, the Carrier's drive, the acts
// waiting for later samples and a receiver move not yet reached.
// One voice of a note as it is struck (`ql::NoteVoice`, QL-MEF #287): the mode it is like, its frequency, its impulse.
struct LeK8NoteVoice {
    std::size_t like;
    double frequency_hz, re, im;
};
// One note of an act (`ql::NoteAct`): its owner's id and its eight voices.
struct LeK8Note {
    std::uint64_t id;
    LeK8NoteVoice voices[8];
};
struct LeK8Pending {
    std::uint64_t at_samples_elapsed;
    const std::size_t *modes;
    const double *re, *im;
    std::size_t n;
    // An act voicing notes (QL-MEF #287): its notes and the ids of the notes making way for them.
    const LeK8Note *notes;
    std::size_t note_count;
    const std::uint64_t *made_way;
    std::size_t made_way_count;
};
// One voice of a bank slot as it rings (`ql::BankVoice`), and one slot (`ql::BankNote`).
struct LeK8BankVoice {
    std::size_t like;
    double frequency_hz, re, im;
};
struct LeK8BankSlot {
    std::size_t slot;
    int held;
    std::uint64_t id, order;
    LeK8BankVoice voices[8], fading[8];
};

struct LeK8Continuation {
    LeK8Input input;
    std::uint64_t samples_elapsed, driver_remainder;
    double last_unmuted_sample;
    double carrier_steps_per_second;
    std::uint64_t carrier_anchor_samples;
    double carrier_anchor_steps, carrier_reached;
    const double *carrier_re, *carrier_im;
    std::size_t carrier_count;
    const LeK8Pending *pending;
    std::size_t pending_count;
    const double *heard_from;
    std::size_t heard_count;
    // The notes as they ring (QL-MEF #287) and the order the last was voiced in.
    const LeK8BankSlot *bank;
    std::size_t bank_count;
    std::uint64_t bank_order;
};

// QL's played-address law (`ql.torus-keys/v1`, <ql/torus_keys.hpp>) as the owner hands it over.
struct LeK8KeyVoice {
    std::size_t mode;
    double longitude_radians, weight, phase_radians;
    unsigned m, n;
};

// One voice of an arc's cell (`ql::CellVoice`, QL-MEF #287), and a note the owner counts (`ql::TorusKeyLaw::Counted`).
struct LeK8CellVoice {
    std::size_t like;
    double frequency_hz, longitude_radians, weight, phase_radians;
    unsigned m, n;
};
struct LeK8Counted {
    std::uint64_t id;
    std::uint8_t row;
    std::uint32_t column;
};

struct LeK8KeyLaw {
    std::uint8_t arcs[36];
    const LeK8KeyVoice *voices;
    std::size_t voice_count;
    double strike;
    std::uint64_t anchor_samples;
    double anchor_steps, steps_per_second;
    unsigned sample_rate;
    double cap_metres;
    // Each note its own voices (QL-MEF #287): each ring arc's cell (12 × 8 voices, arc-major; none: keys strike the voices above),
    // the Polyphony notes are counted under, the owner's count (oldest first) and the id its next note takes.
    const LeK8CellVoice *cells;
    std::size_t cell_count;
    unsigned polyphony;
    const LeK8Counted *notes;
    std::size_t note_count;
    std::uint64_t next_note;
};

struct LeK8Field {
    explicit LeK8Field(ql::ContinuationInput in) : field(std::move(in)) {}
    explicit LeK8Field(ql::Continuation c) : field(std::move(c)) {}
    ql::ContinuousField field;
    // the strike act each key plays, prepared off the audio thread, by prepared mode index
    struct Act {
        std::vector<std::size_t> modes;
        std::vector<ql::Complex> impulses;
    };
    Act keys[128];
    // the Torus's keys by QL's played-address law, made off the audio thread
    std::unique_ptr<ql::TorusKeys> law;
};

static void say(char *err, std::size_t len, const char *what) {
    if (err && len) std::snprintf(err, len, "%s", what);
}

std::size_t le_k8_clock_size(void) { return sizeof(QL_CoupledClock); }

static ql::ContinuationInput continuation_input(const LeK8Input *in) {
    ql::ContinuationInput c;
    c.event_ref = in->event_ref ? in->event_ref : "";
    c.subject_ref = in->subject_ref ? in->subject_ref : "";
    c.geometry_ref = in->geometry_ref ? in->geometry_ref : "";
    c.material_ref = in->material_ref ? in->material_ref : "";
    c.model_ref = in->model_ref ? in->model_ref : "";
    c.generation = in->generation;
    c.sample_rate = in->sample_rate;
    c.clock = in->clock;
    c.driver_numerator = in->driver_numerator;
    c.driver_denominator = in->driver_denominator;
    for (std::size_t i = 0; i < in->mode_count; ++i) {
        const LeK8Mode &m = in->modes[i];
        c.modes.push_back({m.reference ? m.reference : "", m.source_coordinate ? m.source_coordinate : "",
                           m.frequency_hz, m.damping_per_second, {m.amplitude_re, m.amplitude_im},
                           {m.drive_re, m.drive_im}, m.audio_gain_per_metre});
    }
    for (std::size_t i = 0; i < in->sample_count; ++i) {
        const LeK8Sample &s = in->samples[i];
        ql::Sample sample{s.identity, s.constituent ? s.constituent : "",
                          static_cast<ql::ClockAttachment>(s.attachment), {s.rest[0], s.rest[1], s.rest[2]}, {}};
        for (std::size_t j = 0; j < in->mode_count; ++j)
            sample.mode_shapes.push_back({s.shapes[j * 3], s.shapes[j * 3 + 1], s.shapes[j * 3 + 2]});
        c.samples.push_back(std::move(sample));
    }
    return c;
}

static ql::NoteAct note_act(const LeK8Note &n) {
    ql::NoteAct act{n.id, {}};
    for (std::size_t k = 0; k < ql::note_voices; ++k)
        act.voices[k] = {n.voices[k].like, n.voices[k].frequency_hz, {n.voices[k].re, n.voices[k].im}};
    return act;
}

LeK8Field *le_k8_field_new(const LeK8Input *in, char *err, std::size_t err_len) {
    if (!in || (in->mode_count && !in->modes) || (in->sample_count && !in->samples)) {
        say(err, err_len, "missing continuation input");
        return nullptr;
    }
    try {
        return new LeK8Field(continuation_input(in));
    } catch (const std::exception &e) {
        say(err, err_len, e.what());
    } catch (...) {
        say(err, err_len, "the continuation refused its input");
    }
    return nullptr;
}

// Off the audio thread: continue a handed-over continuation at its cursor (`ql::ContinuousField(ql::Continuation)`).
// The field judges it whole and refuses, in its words, one that is not a continuation of its own input.
LeK8Field *le_k8_field_continue(const LeK8Continuation *in, char *err, std::size_t err_len) {
    if (!in || (in->input.mode_count && !in->input.modes) || (in->input.sample_count && !in->input.samples) ||
        (in->carrier_count && (!in->carrier_re || !in->carrier_im)) || (in->pending_count && !in->pending) ||
        (in->heard_count && !in->heard_from) || (in->bank_count && !in->bank)) {
        say(err, err_len, "missing continuation");
        return nullptr;
    }
    try {
        ql::Continuation c;
        c.input = continuation_input(&in->input);
        c.samples_elapsed = in->samples_elapsed;
        c.driver_remainder = in->driver_remainder;
        c.last_unmuted_sample = in->last_unmuted_sample;
        c.carrier.steps_per_second = in->carrier_steps_per_second;
        c.carrier.anchor_samples = in->carrier_anchor_samples;
        c.carrier.anchor_steps = in->carrier_anchor_steps;
        c.carrier.reached = in->carrier_reached;
        for (std::size_t i = 0; i < in->carrier_count; ++i) c.carrier.impulses.push_back({in->carrier_re[i], in->carrier_im[i]});
        for (std::size_t i = 0; i < in->pending_count; ++i) {
            const LeK8Pending &p = in->pending[i];
            if (p.n && (!p.modes || !p.re || !p.im)) {
                say(err, err_len, "missing waiting act");
                return nullptr;
            }
            if ((p.note_count && !p.notes) || (p.made_way_count && !p.made_way)) {
                say(err, err_len, "missing waiting notes");
                return nullptr;
            }
            ql::PendingAct act{p.at_samples_elapsed, {}};
            for (std::size_t j = 0; j < p.n; ++j) act.impulses.push_back({p.modes[j], {p.re[j], p.im[j]}});
            for (std::size_t j = 0; j < p.note_count; ++j) act.notes.push_back(note_act(p.notes[j]));
            act.made_way.assign(p.made_way, p.made_way + p.made_way_count);
            c.pending.push_back(std::move(act));
        }
        c.heard_from.assign(in->heard_from, in->heard_from + in->heard_count);
        for (std::size_t i = 0; i < in->bank_count; ++i) {
            const LeK8BankSlot &s = in->bank[i];
            ql::BankNote slot;
            slot.slot = s.slot;
            slot.held = s.held != 0;
            slot.id = s.id;
            slot.order = s.order;
            for (std::size_t k = 0; k < ql::note_voices; ++k) {
                slot.voices[k] = {s.voices[k].like, s.voices[k].frequency_hz, {s.voices[k].re, s.voices[k].im}};
                slot.fading[k] = {s.fading[k].like, s.fading[k].frequency_hz, {s.fading[k].re, s.fading[k].im}};
            }
            c.bank.push_back(slot);
        }
        c.bank_order = in->bank_order;
        auto *f = new LeK8Field(std::move(c));
        // A move its owner handed over unreached is reached over the part of its owner's block that reaches it, which
        // its owner names as it renders it (`le_k8_move_gains`): until then it is heard by the gains it leaves.
        f->field.await_gain_ramp();
        return f;
    } catch (const std::exception &e) {
        say(err, err_len, e.what());
    } catch (...) {
        say(err, err_len, "the continuation refused its handover");
    }
    return nullptr;
}

// Off the audio thread: the Torus's keys by QL's played-address law (`ql::TorusKeys`), made against this
// field; the law it cannot stand on is refused in QL's words and the field keeps the law it had.
int le_k8_set_law(LeK8Field *f, const LeK8KeyLaw *in, char *err, std::size_t err_len) {
    if (!f || !in || (in->voice_count && !in->voices) || (in->cell_count && !in->cells) || (in->note_count && !in->notes)) {
        say(err, err_len, "missing key law");
        return 0;
    }
    if (in->cell_count % ql::note_voices) {
        say(err, err_len, "a cell holds eight voices");
        return 0;
    }
    try {
        ql::TorusKeyLaw law;
        for (std::size_t i = 0; i < 36; ++i) law.arcs[i] = in->arcs[i];
        for (std::size_t i = 0; i < in->voice_count; ++i) {
            const LeK8KeyVoice &v = in->voices[i];
            law.voices.push_back({v.mode, v.longitude_radians, v.weight, v.phase_radians, v.m, v.n});
        }
        law.strike = in->strike;
        law.anchor_samples = in->anchor_samples;
        law.anchor_steps = in->anchor_steps;
        law.steps_per_second = in->steps_per_second;
        law.sample_rate = in->sample_rate;
        law.cap_metres = in->cap_metres;
        for (std::size_t c = 0; c < in->cell_count / ql::note_voices; ++c) {
            ql::KeyCell cell{};
            for (std::size_t k = 0; k < ql::note_voices; ++k) {
                const LeK8CellVoice &v = in->cells[c * ql::note_voices + k];
                cell[k] = {v.like, v.frequency_hz, v.longitude_radians, v.weight, v.phase_radians, v.m, v.n};
            }
            law.cells.push_back(cell);
        }
        law.polyphony = in->polyphony;
        for (std::size_t i = 0; i < in->note_count; ++i) law.notes.push_back({in->notes[i].id, in->notes[i].row, in->notes[i].column});
        law.next_note = in->next_note;
        f->law = std::make_unique<ql::TorusKeys>(std::move(law), f->field);
        return 1;
    } catch (const std::exception &e) {
        say(err, err_len, e.what());
    } catch (...) {
        say(err, err_len, "key law refused");
    }
    return 0;
}

// The audio thread: one act of the Torus's keys at the cursor (`ql::TorusKeys::play`). 1 when struck; 0 when the
// field holds no law or refused the act whole (the body stands as it was). noexcept and allocation-free.
int le_k8_play_keys(LeK8Field *f, const std::uint8_t *rows, const std::uint32_t *columns, std::size_t n, double re,
                    double im) {
    return f && f->law && f->law->play(f->field, rows, columns, n, ql::Complex(re, im)) ? 1 : 0;
}

// The audio thread: keys let go (`ql::TorusKeys::release`, QL-MEF #287): they leave the count of notes and nothing moves in the
// body; a released note keeps its own tail. noexcept and allocation-free.
void le_k8_release_keys(LeK8Field *f, const std::uint8_t *rows, const std::uint32_t *columns, std::size_t n) {
    if (f && f->law) f->law->release(rows, columns, n);
}

// The audio thread: notes the Torus's owner voiced (QL-MEF #287 packet A), `n` (0..32) notes, each its own eight voices, and the
// `m` notes that made way for them, voiced at the cursor as the owner's field voiced them — `ql::ContinuousField::voice_now`,
// noexcept and allocation-free. An act of no note only makes way (Polyphony lowered below the notes sounding; DLW build ruling
// 2026-11-05), so it names at least one. 1 when voiced; 0 leaves the body as it stood.
int le_k8_voice_notes(LeK8Field *f, const LeK8Note *notes, std::size_t n, const std::uint64_t *made_way, std::size_t m) {
    if (!f || (n && !notes) || n + m == 0 || n > ql::max_bank_notes || m > ql::max_made_way || (m && !made_way)) return 0;
    ql::NoteAct acts[ql::max_bank_notes];
    for (std::size_t i = 0; i < n; ++i) acts[i] = note_act(notes[i]);
    return f->field.voice_now(acts, n, made_way, m) ? 1 : 0;
}

// Off the audio thread: the bank as it stands, slot `i` of `le_k8_bank_count` (a reading; nothing moves).
std::size_t le_k8_bank_count(const LeK8Field *f) { return f ? f->field.bank().size() : 0; }
int le_k8_bank_slot(const LeK8Field *f, std::size_t i, LeK8BankSlot *out) {
    if (!f || !out) return 0;
    const auto bank = f->field.bank();
    if (i >= bank.size()) return 0;
    const auto &s = bank[i];
    out->slot = s.slot;
    out->held = s.held ? 1 : 0;
    out->id = s.id;
    out->order = s.order;
    for (std::size_t k = 0; k < ql::note_voices; ++k) {
        out->voices[k] = {s.voices[k].like, s.voices[k].frequency_hz, s.voices[k].state.real(), s.voices[k].state.imag()};
        out->fading[k] = {s.fading[k].like, s.fading[k].frequency_hz, s.fading[k].state.real(), s.fading[k].state.imag()};
    }
    return 1;
}

// The audio thread: an act the Torus's owner landed (O-I #849), `n` (1..16) impulses in modal metres to prepared modes
// `modes[i]`, struck at the cursor — `ql::ContinuousField::strike_now`, noexcept and allocation-free. The owner's law made the
// impulses; this strikes them as the owner's field did, so the two ring alike. 1 when struck; 0 leaves the body as it stood.
int le_k8_strike_modes(LeK8Field *f, const std::uint16_t *modes, const double *re, const double *im, std::size_t n) {
    constexpr std::size_t most = 16;
    if (!f || !modes || !re || !im || n == 0 || n > most) return 0;
    std::size_t index[most];
    ql::Complex impulses[most];
    for (std::size_t i = 0; i < n; ++i) {
        index[i] = modes[i];
        impulses[i] = ql::Complex(re[i], im[i]);
    }
    return f->field.strike_now(index, impulses, n) ? 1 : 0;
}

// The audio thread: a move of the gains the Torus is heard by that its owner reached over `frames` of its samples (O-I #849
// round 14; QL `TORUS_HEARD_LAW`), `n` gains in mode order, reached from the cursor over those samples however they are rendered
// — `ql::ContinuousField::move_gains`, noexcept and allocation-free. 1 when moved; 0 changes nothing.
int le_k8_move_gains(LeK8Field *f, const double *gains, std::size_t n, std::uint64_t frames) {
    return f && f->field.move_gains(gains, n, frames) ? 1 : 0;
}

// The audio thread: Panic stills the body (`ql::ContinuousField::silence`). noexcept and allocation-free.
void le_k8_silence(LeK8Field *f) {
    if (f) f->field.silence();
}

// A resident state, for a reading off the audio thread.
int le_k8_amplitude(const LeK8Field *f, std::size_t mode, double *re, double *im) {
    if (!f || !re || !im || mode >= f->field.source().modes.size()) return 0;
    const auto z = f->field.amplitude(mode);
    *re = z.real();
    *im = z.imag();
    return 1;
}

void le_k8_field_free(LeK8Field *f) { delete f; }

std::size_t le_k8_mode_count(const LeK8Field *f) { return f ? f->field.source().modes.size() : 0; }

unsigned le_k8_sample_rate(const LeK8Field *f) { return f ? f->field.source().sample_rate : 0; }

std::uint64_t le_k8_samples_elapsed(const LeK8Field *f) { return f ? f->field.receipt().samples_elapsed : 0; }

// Off the audio thread: the strike act `key` plays — `n` named resident
// modes (by index into the input's modes) and their modal impulses. n = 0
// clears the key.
int le_k8_set_key(LeK8Field *f, unsigned key, const std::size_t *modes, const double *re, const double *im,
                  std::size_t n, char *err, std::size_t err_len) {
    if (!f || key > 127 || (n && (!modes || !re || !im))) {
        say(err, err_len, "no such key or strike");
        return 0;
    }
    try {
        LeK8Field::Act act;
        act.modes.reserve(n);
        act.impulses.reserve(n);
        const auto &source = f->field.source().modes;
        for (std::size_t i = 0; i < n; ++i) {
            if (modes[i] >= source.size()) {
                say(err, err_len, "a key's strike names a mode the continuation does not hold");
                return 0;
            }
            act.modes.push_back(modes[i]);
            act.impulses.push_back({re[i], im[i]});
        }
        f->keys[key].modes.swap(act.modes);
        f->keys[key].impulses.swap(act.impulses);
        return 1;
    } catch (const std::exception &e) {
        say(err, err_len, e.what());
    } catch (...) {
        say(err, err_len, "key strike refused");
    }
    return 0;
}

// The audio thread: play key `key`'s prepared strike act at the
// continuation's cursor (it lands before the next rendered sample). Returns
// 1 when struck, 0 when the key has no act or the field refused it (the
// body then stands exactly as it was — the typed API's own guarantee).
// `ql::ContinuousField::strike_now` strikes by prepared mode index: noexcept
// and allocation-free (O-I #849).
int le_k8_strike_key(LeK8Field *f, unsigned key, char *err, std::size_t err_len) {
    if (!f || key > 127 || f->keys[key].modes.empty()) return 0;
    const auto &act = f->keys[key];
    if (f->field.strike_now(act.modes.data(), act.impulses.data(), act.modes.size())) return 1;
    say(err, err_len, "the field refused the key's strike");
    return 0;
}

// The audio thread: render `frames` mono samples (≤ 8192: one bounded
// block) — `ql::ContinuousField::render_audio`, noexcept and
// allocation-free.
int le_k8_render(LeK8Field *f, float *out, std::size_t frames, int muted) {
    return f && f->field.render_audio(out, frames, muted != 0) ? 1 : 0;
}

} // extern "C"
