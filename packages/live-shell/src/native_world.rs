//! Bounded process lifetime for the existing native CurrentWorld owner.
use std::path::Path;
#[path = "native_contract.rs"]
mod native_contract;
use native_contract::current_world_output;
pub(crate) use native_contract::current_world_product_ids;

fn spawn_current_world(suite_cli: &Path) -> Result<tokio::process::Child, String> {
    tokio::process::Command::new(suite_cli)
        .args(["current-world", "--json"])
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .kill_on_drop(true)
        .spawn()
        .map_err(|error| format!("Native CurrentWorld is unavailable: {error}"))
}

async fn wait_current_world(
    child: tokio::process::Child,
    deadline: std::time::Duration,
) -> Result<serde_json::Value, String> {
    // Dropping this future kills its owned child. A timeout must not leave a
    // detached blocking read running after the request has returned.
    let output = tokio::time::timeout(deadline, child.wait_with_output())
        .await
        .map_err(|_| "Native CurrentWorld read timed out".to_owned())?
        .map_err(|error| format!("Native CurrentWorld read failed: {error}"))?;
    current_world_output(output)
}

pub async fn current_world_bounded(
    suite_cli: &Path,
    deadline: std::time::Duration,
) -> Result<serde_json::Value, String> {
    wait_current_world(spawn_current_world(suite_cli)?, deadline).await
}

#[cfg(test)]
mod native_world_acceptance {
    use super::*;
    use std::path::PathBuf;

    fn installed_owner() -> PathBuf {
        std::env::var_os("LIVE_SHELL_ACCEPTANCE_OI_BIN")
            .map(PathBuf::from)
            .expect("Provide the actual installed O:I executable for this native acceptance")
    }

    #[tokio::test]
    #[ignore = "Requires the actual installed O:I CurrentWorld owner"]
    async fn current_world_reads_the_installed_native_owner() {
        let reading = current_world_bounded(&installed_owner(), std::time::Duration::from_secs(30))
            .await
            .expect("Actual native CurrentWorld must acknowledge its reading");
        assert_eq!(reading["schema"], "oi.current-world/v2");
        let products = current_world_product_ids(&reading)
            .expect("Actual native product positions must qualify without a guessed backing");
        let positions = reading["positions"].as_array().expect("Native product positions");
        let expected = positions.iter().filter(|position| position["present"] == true)
            .map(|position| position["product_id"].as_str().expect("Native product identity").to_owned())
            .collect::<Vec<_>>();
        assert_eq!(products, expected, "Projection preserves native presence and order");

        // Exercise refusal against the same actual owner reading, never a
        // substitute native World or a hardcoded product composition.
        let first = positions.first().expect("The installed owner discloses its product positions");
        let mut duplicate = reading.clone();
        duplicate["positions"].as_array_mut().unwrap().push(first.clone());
        assert!(current_world_product_ids(&duplicate).unwrap_err().contains("duplicate product_id"));
        let mut malformed = reading.clone();
        malformed["positions"][0]["present"] = "true".into();
        assert!(current_world_product_ids(&malformed).unwrap_err().contains(".present"));
        let mut missing = reading.clone();
        missing["positions"][0].as_object_mut().unwrap().remove("product_id");
        assert!(current_world_product_ids(&missing).unwrap_err().contains(".product_id"));
        let mut malformed_id = reading.clone();
        malformed_id["positions"][0]["product_id"] = "invalid identity".into();
        assert!(current_world_product_ids(&malformed_id).unwrap_err().contains(".product_id"));
        let mut missing_positions = reading.clone();
        missing_positions.as_object_mut().unwrap().remove("positions");
        assert!(current_world_product_ids(&missing_positions).unwrap_err().contains("positions"));
        let mut absent = reading.clone();
        absent["positions"][0]["present"] = false.into();
        let expected_absent = products.iter().filter(|id| Some(id.as_str()) != first["product_id"].as_str())
            .cloned().collect::<Vec<_>>();
        assert_eq!(current_world_product_ids(&absent).unwrap(), expected_absent);
        // An absent duplicate still makes the owner's identity ambiguous.
        duplicate["positions"].as_array_mut().unwrap().last_mut().unwrap()["present"] = false.into();
        assert!(current_world_product_ids(&duplicate).unwrap_err().contains("duplicate product_id"));
    }

    #[cfg(unix)]
    #[tokio::test]
    #[ignore = "Requires the actual installed O:I executable and Unix process observation"]
    async fn current_world_timeout_stops_its_actual_native_process() {
        let child = spawn_current_world(&installed_owner()).expect("Launch the actual native owner");
        let pid = child.id().expect("Observe the actual child identity");
        let error = wait_current_world(child, std::time::Duration::ZERO)
            .await
            .expect_err("An expired native read must remain a refusal");
        assert!(error.contains("timed out"), "{error}");
        let until = std::time::Instant::now() + std::time::Duration::from_secs(5);
        loop {
            let state = std::process::Command::new("/bin/ps")
                .args(["-p", &pid.to_string(), "-o", "stat="])
                .output()
                .expect("Observe the actual native process after timeout");
            let state_text = String::from_utf8_lossy(&state.stdout);
            if !state.status.success() || state_text.trim().is_empty() || state_text.trim().starts_with('Z') {
                break;
            }
            assert!(std::time::Instant::now() < until, "Native CurrentWorld process {pid} remains running after its timeout");
            tokio::time::sleep(std::time::Duration::from_millis(20)).await;
        }
    }
}
