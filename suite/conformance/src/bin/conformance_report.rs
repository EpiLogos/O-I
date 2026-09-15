//! `config-conformance-report` — aggregates the conformance suite's per-test
//! verdicts into the required-test status table (#299 §22) and runs the
//! whole-artifact redaction sweep (09 §14) over everything the suite wrote.
//!
//! Run after the suite:
//!
//! ```text
//! cargo run -p oi-config-conformance --bin config-conformance-report
//! ```
//!
//! Exit 1 if any required test is missing (a failed or crashed test writes
//! no verdict), any verdict is not passed/partial, or the redaction sweep
//! is dirty. A test that silently faked a pass is the one failure this
//! report exists to prevent.

use serde_json::Value;
use std::path::PathBuf;

fn target_dir() -> PathBuf {
    // The report binary lives at <target>/debug/, the suite artifacts at
    // <target>/tmp/conformance/.
    std::env::current_exe()
        .ok()
        .and_then(|exe| exe.ancestors().nth(2).map(|p| p.to_path_buf()))
        .unwrap_or_else(std::env::temp_dir)
}

fn main() {
    let conformance = target_dir().join("tmp").join("conformance");
    // Each suite run writes under runs/<pid>; report on the most recent
    // run that produced verdicts.
    let runs = conformance.join("runs");
    let mut latest: Option<(std::time::SystemTime, PathBuf)> = None;
    if let Ok(entries) = std::fs::read_dir(&runs) {
        for entry in entries.flatten() {
            let verdicts = entry.path().join("verdicts");
            let modified = entry
                .metadata()
                .and_then(|m| m.modified())
                .unwrap_or(std::time::SystemTime::UNIX_EPOCH);
            if verdicts.exists() && latest.as_ref().map(|(t, _)| modified > *t).unwrap_or(true) {
                latest = Some((modified, entry.path()));
            }
        }
    }
    let Some((_, run)) = latest else {
        println!(
            "No conformance run found under {}. Run the suite first:",
            runs.display()
        );
        println!("  cargo test -p oi-config-conformance --test configuration_conformance");
        std::process::exit(1);
    };
    println!("run: {}", run.display());
    println!();
    let verdicts = run.join("verdicts");
    let artifacts = run.join("artifacts");

    println!("# C7 conformance — required tests of #299 §22");
    println!();

    let mut verdicts_found: Vec<(u8, Value)> = Vec::new();
    if let Ok(entries) = std::fs::read_dir(&verdicts) {
        for entry in entries.flatten() {
            let raw = match std::fs::read_to_string(entry.path()) {
                Ok(raw) => raw,
                Err(_) => continue,
            };
            if let Ok(verdict) = serde_json::from_str::<Value>(&raw) {
                let n = verdict["n"].as_u64().unwrap_or(0) as u8;
                verdicts_found.push((n, verdict));
            }
        }
    }
    verdicts_found.sort_by_key(|(n, _)| *n);

    let required: [(u8, &str); 14] = [
        (1, "ordinary-setting propagation"),
        (2, "native-first edit"),
        (3, "O:I-routed edit"),
        (4, "profile switch"),
        (5, "scope"),
        (6, "secrets"),
        (7, "partial multi-owner apply"),
        (8, "absence/degradation"),
        (9, "CLI/Desktop parity"),
        (10, "Agent parity"),
        (11, "no semantic mirroring"),
        (12, "bootstrap reuse"),
        (13, "connector proof"),
        (14, "versioning"),
    ];

    let mut healthy = true;
    for (n, name) in required {
        match verdicts_found.iter().find(|(vn, _)| *vn == n) {
            Some((_, verdict)) => {
                let status = verdict["status"].as_str().unwrap_or("unknown");
                if status != "passed" && status != "partial" {
                    healthy = false;
                }
                println!("#{:<2} {:<34} {}", n, name, status.to_uppercase());
                for verified in verdict["verified"].as_array().unwrap_or(&vec![]) {
                    println!("      verified: {}", verified.as_str().unwrap_or("?"));
                }
                for leg in verdict["pending"].as_array().unwrap_or(&vec![]) {
                    println!(
                        "      pending binding: {} ({}) — {}",
                        leg["surface"].as_str().unwrap_or("?"),
                        leg["lane"].as_str().unwrap_or("?"),
                        leg["reason"].as_str().unwrap_or("?")
                    );
                }
            }
            None => {
                healthy = false;
                println!(
                    "#{:<2} {:<34} NOT RUN (no verdict; the test failed or never executed)",
                    n, name
                );
            }
        }
    }

    println!();
    println!("# Redaction sweep (09 §14) over every artifact the suite wrote");
    match oi_config_conformance::redaction_sweep(&artifacts, &[]) {
        Ok(count) => println!("clean — {count} artifacts swept, no credential material present"),
        Err(error) => {
            healthy = false;
            println!("DIRTY — {error}");
        }
    }

    println!();
    if healthy {
        println!("The suite ran; executable legs held; pending bindings are named above and remain open acceptance requirements.");
        std::process::exit(0);
    } else {
        println!("The suite is NOT healthy: a required test did not run or failed. Acceptance stays open.");
        std::process::exit(1);
    }
}
