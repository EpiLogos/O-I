// A C ABI over QL's K8 typed API (`ql::ContinuousField`,
// <ql/continuous_field.hpp> from an installed QL prefix), so the engine's
// Torus node (`src/k8.rs`) can hold one continuation and play it on the
// audio thread. It adds no physics: every operation is one call into the
// typed API, and every exception the API raises is caught here and handed
// back as text (an exception must not cross into Rust).
//
// The field's own rule binds: "Control methods and rendering have one
// host-owned serial execution thread. Prepare/change topology off the audio
// callback." `le_k8_field_new` and `le_k8_set_key` allocate and run off the
// audio thread; `le_k8_strike_key` and `le_k8_render` are the audio
// thread's (see the allocation note at `le_k8_strike_key`).
#include <ql/continuous_field.hpp>

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

struct LeK8Field {
    explicit LeK8Field(ql::ContinuationInput in) : field(std::move(in)) {}
    ql::ContinuousField field;
    // the strike act each key plays, prepared off the audio thread
    std::vector<ql::Strike> keys[128];
};

static void say(char *err, std::size_t len, const char *what) {
    if (err && len) std::snprintf(err, len, "%s", what);
}

std::size_t le_k8_clock_size(void) { return sizeof(QL_CoupledClock); }

LeK8Field *le_k8_field_new(const LeK8Input *in, char *err, std::size_t err_len) {
    if (!in || (in->mode_count && !in->modes) || (in->sample_count && !in->samples)) {
        say(err, err_len, "missing continuation input");
        return nullptr;
    }
    try {
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
        return new LeK8Field(std::move(c));
    } catch (const std::exception &e) {
        say(err, err_len, e.what());
    } catch (...) {
        say(err, err_len, "the continuation refused its input");
    }
    return nullptr;
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
        std::vector<ql::Strike> act;
        act.reserve(n);
        const auto &source = f->field.source().modes;
        for (std::size_t i = 0; i < n; ++i) {
            if (modes[i] >= source.size()) {
                say(err, err_len, "a key's strike names a mode the continuation does not hold");
                return 0;
            }
            act.push_back({source[modes[i]].reference, {re[i], im[i]}});
        }
        f->keys[key].swap(act);
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
//
// ALLOCATION: the act vector is prepared, so this shim allocates nothing;
// `ql::ContinuousField::strike` itself reserves one vector of mode pointers
// per act (`std::vector<Prepared *> struck; struck.reserve(...)`). That is
// the one allocation on this path, and it is QL's to remove (the lane's
// PROPOSE: an allocation-free strike of a prepared act).
int le_k8_strike_key(LeK8Field *f, unsigned key, char *err, std::size_t err_len) {
    if (!f || key > 127 || f->keys[key].empty()) return 0;
    try {
        f->field.strike(f->keys[key]);
        return 1;
    } catch (const std::exception &e) {
        say(err, err_len, e.what());
    } catch (...) {
        say(err, err_len, "strike refused");
    }
    return 0;
}

// The audio thread: render `frames` mono samples (≤ 8192: one bounded
// block) — `ql::ContinuousField::render_audio`, noexcept and
// allocation-free.
int le_k8_render(LeK8Field *f, float *out, std::size_t frames, int muted) {
    return f && f->field.render_audio(out, frames, muted != 0) ? 1 : 0;
}

} // extern "C"
