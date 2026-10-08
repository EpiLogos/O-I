pub mod readiness {
    //! The readiness reading: bounded, local, evidence-stating probes answering
    //! one question — is this machine's O:I serviceable right now — and nothing
    //! more.
    //!
    //! Laws this reading keeps (the Hermes `gateway/readiness` shape at O-I's
    //! own honesty): every probe is bounded and names exactly what it observed —
    //! a catalogue row is never activation evidence, so the gateway probe
    //! *connects* rather than trusting a socket file's existence. Nothing here
    //! opens a provider, mutates state, or takes readiness on faith from a
    //! recorded receipt. The composition reports each probe's own elapsed time;
    //! budgets are per probe and stated beside the answer.

    use oi_cli::configuration::kernel::store::oi_home;
    use serde::{Deserialize, Serialize};
    use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

    /// The frozen readiness contract. Bump when a probe's meaning changes,
    /// never by adding a probe.
    pub const READINESS_SCHEMA: &str = "oi.readiness-reading/v1";

    /// The ordinary probe budget. The gateway-connect probe carries its own
    /// wider cap, named in its evidence when it spends it.
    const PROBE_BUDGET: Duration = Duration::from_millis(10);
    const GATEWAY_CONNECT_BUDGET: Duration = Duration::from_millis(250);

    #[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
    pub struct ReadinessProbe {
        pub name: String,
        /// `ready` | `degraded` | `unavailable`. Degraded: this surface is
        /// reduced but the machine still serves O:I.
        pub state: String,
        /// Exactly what was observed — the path, the value, or the owner's own
        /// refusal words. Never an inference from a recorded receipt.
        pub evidence: String,
        pub elapsed_us: u128,
        pub budget_ms: u128,
    }

    #[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
    pub struct ReadinessReading {
        pub schema: String,
        /// `observed`: every state here was read off this machine during this
        /// reading. The reading has no recorded-receipt basis and refuses one.
        pub basis: String,
        pub ready: bool,
        pub observed_at_unix_ms: u64,
        pub probes: Vec<ReadinessProbe>,
    }

    /// Compose the answer from finished probes: ready only when every probe is.
    /// The one law this composition enforces is arithmetic, not faith.
    pub fn compose(probes: Vec<ReadinessProbe>) -> ReadinessReading {
        let ready = probes
            .iter()
            .all(|probe| probe.state == "ready" || probe.state == "degraded");
        ReadinessReading {
            schema: READINESS_SCHEMA.to_owned(),
            basis: "observed".to_owned(),
            ready,
            observed_at_unix_ms: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis() as u64,
            probes,
        }
    }

    fn probe(name: &str, budget: Duration) -> (Instant, ReadinessProbe) {
        (
            Instant::now(),
            ReadinessProbe {
                name: name.to_owned(),
                state: "ready".to_owned(),
                evidence: String::new(),
                elapsed_us: 0,
                budget_ms: budget.as_millis(),
            },
        )
    }

    fn finish(
        start: Instant,
        mut probe: ReadinessProbe,
        state: &str,
        evidence: String,
    ) -> ReadinessProbe {
        probe.state = state.to_owned();
        probe.evidence = evidence;
        probe.elapsed_us = start.elapsed().as_micros();
        probe
    }

    /// The engine probe: the reading runs inside the engine, so the binary
    /// answering IS the evidence (version and, when built with one, the
    /// suite revision).
    pub fn probe_engine() -> ReadinessProbe {
        let (start, probe) = probe("engine", PROBE_BUDGET);
        let revision = option_env!("SUITE_BUILD_REVISION").unwrap_or("unknown");
        finish(
            start,
            probe,
            "ready",
            format!("oi {} ({revision})", env!("CARGO_PKG_VERSION")),
        )
    }

    /// The O:I state home probe: resolvable, present, a directory. Without it
    /// no desired state, receipts or profiles exist: unavailable, not degraded.
    pub fn probe_state_home() -> ReadinessProbe {
        let (start, probe) = probe("state_home", PROBE_BUDGET);
        match oi_home() {
            Ok(home) => match std::fs::metadata(&home) {
                Ok(metadata) if metadata.is_dir() => finish(
                    start,
                    probe,
                    "ready",
                    format!("{} (present)", home.display()),
                ),
                Ok(_) => finish(
                    start,
                    probe,
                    "unavailable",
                    format!("{} exists but is not a directory", home.display()),
                ),
                Err(error) => finish(
                    start,
                    probe,
                    "unavailable",
                    format!("{} is absent ({error})", home.display()),
                ),
            },
            Err(error) => finish(start, probe, "unavailable", error),
        }
    }

    /// The AIKit state home probe: where conversation state and the gateway's
    /// well-known carrier live. Absent means conversation surfaces are reduced;
    /// the machine still serves O:I: degraded, not unavailable.
    pub fn probe_aikit_home() -> ReadinessProbe {
        let (start, probe) = probe("aikit_home", PROBE_BUDGET);
        let home = std::env::var_os("AIKIT_HOME")
            .map(std::path::PathBuf::from)
            .unwrap_or_else(|| {
                let user = std::env::var_os("HOME").unwrap_or_default();
                std::path::PathBuf::from(user).join(".aikit")
            });
        let state = home.join("state");
        match std::fs::metadata(&state) {
            Ok(metadata) if metadata.is_dir() => finish(
                start,
                probe,
                "ready",
                format!("{} (present)", state.display()),
            ),
            Ok(_) => finish(
                start,
                probe,
                "degraded",
                format!("{} exists but is not a directory", state.display()),
            ),
            Err(error) => finish(
                start,
                probe,
                "degraded",
                format!(
                    "{} is absent ({error}); conversation surfaces are reduced",
                    state.display()
                ),
            ),
        }
    }

    /// The gateway-carrier probe: *connect* to the well-known socket — a socket
    /// file's existence is a catalogue row, never activation evidence. A
    /// refused connect is degraded (the gateway is startable; it is not now
    /// answering on this carrier).
    pub fn probe_gateway_carrier() -> ReadinessProbe {
        let (start, probe) = probe("gateway_carrier", GATEWAY_CONNECT_BUDGET);
        let home = std::env::var_os("AIKIT_HOME")
            .map(std::path::PathBuf::from)
            .unwrap_or_else(|| {
                let user = std::env::var_os("HOME").unwrap_or_default();
                std::path::PathBuf::from(user).join(".aikit")
            });
        let socket = home.join("state").join("gateway.sock");
        let answer = std::os::unix::net::UnixStream::connect(&socket);
        let elapsed = start.elapsed();
        if elapsed > GATEWAY_CONNECT_BUDGET {
            return finish(
                start,
                probe,
                "degraded",
                format!(
                    "connect to {} exceeded its {} ms budget ({} ms)",
                    socket.display(),
                    GATEWAY_CONNECT_BUDGET.as_millis(),
                    elapsed.as_millis()
                ),
            );
        }
        match answer {
            Ok(stream) => {
                drop(stream);
                finish(
                    start,
                    probe,
                    "ready",
                    format!("{} answered a connect", socket.display()),
                )
            }
            Err(error) => finish(
                start,
                probe,
                "degraded",
                format!("{} refused a connect ({error})", socket.display()),
            ),
        }
    }

    /// The Central-ground probe: the personal world root this machine serves.
    /// Absent means the ground relations are reduced; degraded, not unavailable.
    pub fn probe_central_ground() -> ReadinessProbe {
        let (start, probe) = probe("central_ground", PROBE_BUDGET);
        let root = std::env::var_os("CENTRAL_ROOT")
            .map(std::path::PathBuf::from)
            .unwrap_or_else(|| {
                let user = std::env::var_os("HOME").unwrap_or_default();
                std::path::PathBuf::from(user).join("Central")
            });
        match std::fs::metadata(&root) {
            Ok(metadata) if metadata.is_dir() => finish(
                start,
                probe,
                "ready",
                format!("{} (present)", root.display()),
            ),
            Ok(_) => finish(
                start,
                probe,
                "degraded",
                format!("{} exists but is not a directory", root.display()),
            ),
            Err(error) => finish(
                start,
                probe,
                "degraded",
                format!("{} is absent ({error})", root.display()),
            ),
        }
    }

    /// Compose the live reading: every probe runs now, in order, bounded.
    pub fn live() -> ReadinessReading {
        compose(vec![
            probe_engine(),
            probe_state_home(),
            probe_configuration_store(),
            probe_aikit_home(),
            probe_gateway_carrier(),
            probe_central_ground(),
        ])
    }

    /// The configuration-store probe: the desired-state area lists. A corrupt
    /// record is named loudly on its own read (store law); this probe is
    /// presence and readability of the area itself.
    pub fn probe_configuration_store() -> ReadinessProbe {
        let (start, probe) = probe("configuration_store", PROBE_BUDGET);
        let area = match oi_home() {
            Ok(home) => home.join("configuration"),
            Err(error) => return finish(start, probe, "unavailable", error),
        };
        match std::fs::read_dir(&area) {
            Ok(_) => finish(
                start,
                probe,
                "ready",
                format!("{} (listable)", area.display()),
            ),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => finish(
                start,
                probe,
                "ready",
                format!("{} has no stored state yet (fresh machine)", area.display()),
            ),
            Err(error) => finish(
                start,
                probe,
                "degraded",
                format!("{} cannot be listed ({error})", area.display()),
            ),
        }
    }

    /// `oi readiness [--json]`. Exit 0 when the reading is ready; 1 when any
    /// probe degraded; 2 when the machine is not serviceable. The exit code is
    /// itself a readiness signal for scripts and the omarchy surface.
    pub fn command_readiness(args: &[std::ffi::OsString]) -> Result<i32, String> {
        let json_mode = match args {
            [] => false,
            [one] if one == "--json" => true,
            _ => return Err("usage: oi readiness [--json]".to_owned()),
        };
        let reading = live();
        if json_mode {
            println!(
                "{}",
                serde_json::to_string_pretty(&reading)
                    .map_err(|error| format!("cannot encode the readiness reading: {error}"))?
            );
        } else {
            println!("oi readiness — {}", reading.schema);
            for probe in &reading.probes {
                println!(
                    "  {:<22} {:<12} {:>7}.{:0>3} ms  {}",
                    probe.name,
                    probe.state,
                    probe.elapsed_us / 1000,
                    (probe.elapsed_us % 1000) / 100,
                    probe.evidence
                );
            }
            println!("  ready: {}", reading.ready);
        }
        let worst = reading
            .probes
            .iter()
            .map(|probe| probe.state.as_str())
            .fold("ready", |worst, state| match (worst, state) {
                (_, "unavailable") | ("unavailable", _) => "unavailable",
                (_, "degraded") | ("degraded", _) => "degraded",
                _ => worst,
            });
        Ok(match worst {
            "ready" => 0,
            "degraded" => 1,
            _ => 2,
        })
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn the_composition_is_ready_only_when_every_probe_serves() {
            let probe = |name: &str, state: &str| ReadinessProbe {
                name: name.to_owned(),
                state: state.to_owned(),
                evidence: "test observation".to_owned(),
                elapsed_us: 42,
                budget_ms: 10,
            };
            let reading = compose(vec![probe("engine", "ready"), probe("state_home", "ready")]);
            assert!(reading.ready);
            assert_eq!(reading.basis, "observed");
            assert_eq!(reading.schema, "oi.readiness-reading/v1");

            let reading = compose(vec![
                probe("engine", "ready"),
                probe("gateway_carrier", "degraded"),
            ]);
            assert!(reading.ready, "degraded surfaces still serve O:I");

            let reading = compose(vec![
                probe("engine", "ready"),
                probe("state_home", "unavailable"),
            ]);
            assert!(!reading.ready);
        }

        #[test]
        fn a_socket_file_is_never_activation_evidence() {
            let _lock = crate::test_support::env_lock();
            // The gateway probe connects; a present-but-dead socket is degraded
            // with the connect refusal as its evidence — the socket file's mere
            // existence can never read as "the gateway is alive".
            let dir = std::env::temp_dir().join(format!(
                "oi-readiness-dead-socket-{}-{}",
                std::process::id(),
                std::time::SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap()
                    .as_nanos()
            ));
            std::fs::create_dir_all(dir.join("state")).unwrap();
            // A plain file where a socket would live: existence alone must not
            // satisfy the probe.
            std::fs::write(dir.join("state").join("gateway.sock"), b"").unwrap();
            std::env::set_var("AIKIT_HOME", &dir);
            let probe = probe_gateway_carrier();
            std::env::remove_var("AIKIT_HOME");
            assert_eq!(probe.state, "degraded", "evidence: {}", probe.evidence);
            assert!(
                probe.evidence.contains("refused a connect"),
                "the evidence names the connect, not the file: {}",
                probe.evidence
            );
            std::fs::remove_dir_all(&dir).ok();
        }

        #[test]
        fn an_absent_state_home_is_unavailable_and_the_reading_says_so() {
            let _lock = crate::test_support::env_lock();
            std::env::set_var("OI_HOME", "/oi-readiness-nonexistent-home-forbidden");
            let probe = probe_state_home();
            std::env::remove_var("OI_HOME");
            assert_eq!(probe.state, "unavailable");
            let reading = compose(vec![probe]);
            assert!(!reading.ready);
        }
    }
}
