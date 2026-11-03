//! A K8 continuation that is silent until struck, for the Torus node's
//! tests and the key-to-sound measurement: QL-MEF's own acceptance input
//! (`cpp/tests/continuous_field.cpp` `input()`: its refs, its native clock,
//! its exact M2 coordinate `#2-2-2-5-5` and sample constituent `#3-5-5/0`),
//! with the two modes at rest (no initial amplitude, no drive), at 220 Hz
//! and 330 Hz, damped so a strike rings out in about a second. The key
//! table is the test's, not QL's played-address law: key 60 strikes the
//! first mode, 67 the second, 64 both.

use live_engine::k8::{CoupledClock, K8Field, K8Input, K8Mode, K8Sample, PhaseLift};

pub fn input(sample_rate: u32) -> K8Input {
    let mode = |reference: &str, frequency_hz: f64| K8Mode {
        reference: reference.into(),
        source_coordinate: "#2-2-2-5-5".into(),
        frequency_hz,
        damping_per_second: 6.0,
        amplitude_metres: (0.0, 0.0),
        drive_metres_per_second: (0.0, 0.0),
        audio_gain_per_metre: 2.0,
    };
    K8Input {
        event_ref: "acceptance:one-world".into(),
        subject_ref: "acceptance:nara-a".into(),
        geometry_ref: "fixture:mesh".into(),
        material_ref: "fixture:material".into(),
        model_ref: "model:complex-modal-linear/v1".into(),
        generation: 7,
        sample_rate,
        clock: CoupledClock {
            inscription: PhaseLift {
                turns: 0,
                half_degrees: 718,
            },
            lensing: PhaseLift {
                turns: 1,
                half_degrees: 17,
            },
            grid_origin_half_degrees: [3, 9, 21],
            rate_numerators: [9, 8],
            rate_denominator: 8,
            rate_remainders: [0, 0],
            generation: 4,
        },
        driver_numerator: 360,
        driver_denominator: 1,
        modes: vec![mode("mode:earth", 220.0), mode("mode:earth-fifth", 330.0)],
        samples: vec![K8Sample {
            identity: 1,
            constituent: "#3-5-5/0".into(),
            attachment: 0,
            rest_metres: [0.0; 3],
            mode_shapes: vec![[0.0, 0.0, 1.0], [0.0, 0.0, 1.0]],
        }],
    }
}

/// The fixture field with its key table.
pub fn field(sample_rate: u32) -> K8Field {
    let mut f = K8Field::new(&input(sample_rate)).expect("QL's acceptance input continues");
    f.set_key(60, &[(0, (0.05, 0.0))]).unwrap();
    f.set_key(67, &[(1, (0.05, 0.0))]).unwrap();
    f.set_key(64, &[(0, (0.03, 0.0)), (1, (0.03, 0.0))])
        .unwrap();
    f
}
