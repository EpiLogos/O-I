//! Retrying a unit: the person's own press on the Run map (manual §19.25,
//! T-COVERAGE §1.2 "the attempt `retry`"). Factory's own attempt operation
//! `retry` starts a new attempt for a unit under the retry grant its current
//! attempt already consumes (`factory attempt action <state> -`,
//! `factory.attempt-action/v1`; Factory's attempt_application.rs decides
//! whether it may).
//!
//! The owner decides and the driver only assembles what the owners disclose:
//!
//! - whether a desktop may retry at all, and the caller, the capability and
//!   the native action a grant must carry, come from Factory's own admission
//!   reading (`factory attempt admission`): its `attempt-retry` action. Until
//!   Factory admits one, the retry is refused naming what Factory admits;
//! - the grant is resolved here, in the native process, against Central's
//!   native action authority contract with the host's own token, as a
//!   choice's and a close's are, and never named by the desk;
//! - the task, the parent Journey, the retry grant and the whole disposition
//!   come verbatim from Factory's attempt reading of the unit's current
//!   attempt. The driver changes nothing in them, so Factory sees the same
//!   conditions; a retry that needs re-resolution (partial effects, a changed
//!   NOW or material) is Factory's to refuse, in its words.
//!
//! The new attempt's ref and the projection are derived from the Run, the
//! unit, the attempt it replaces and the revision read, so the same press
//! twice is the same document. Every refusal of the owner comes back in its
//! own words; the driver refuses on its own only before any move, and says so.
use super::*;

pub const CONTRACT: &str = "oi.factory-attempt-retry/v1";
/// The admission's action for a retry, and the contract it must name.
const ACTION_REF: &str = "attempt-retry";

/// The host's native action authority for one retry: the grant ref it holds
/// (else the principal its token belongs to), the token, the contract the
/// grant resolves against and the reading clock.
pub struct RetryAuthority<'a> {
    pub grant: Option<String>,
    pub token: Option<AuthorityToken>,
    /// `None` when no Central contract is found above the Factory state.
    pub contract: Option<&'a Path>,
    pub now_unix_seconds: u64,
}

/// What Factory admits of a desktop caller's retry.
struct Admitted {
    caller: Value,
    capability_ref: String,
    native_owner: String,
    native_action: String,
    scope: String,
    actor_kind: String,
}

fn text(value: &Value) -> Option<String> {
    value
        .as_str()
        .map(str::trim)
        .filter(|text| !text.is_empty())
        .map(str::to_owned)
}

/// Factory's admission of a retry, or the reason it admits none — the
/// actions it does name, in its own refs.
fn admitted(reading: &Value) -> Result<Admitted, String> {
    let actions = reading["actions"].as_array().cloned().unwrap_or_default();
    let Some(action) = actions
        .iter()
        .find(|action| action["actionRef"] == ACTION_REF)
    else {
        let named: Vec<String> = actions
            .iter()
            .filter_map(|a| text(&a["actionRef"]))
            .collect();
        return Err(format!(
            "Factory admits no retry from a desktop caller: its attempt admission (factory attempt admission) names no {ACTION_REF} action{}.",
            if named.is_empty() {
                String::new()
            } else {
                format!(", only {}", named.join(", "))
            }
        ));
    };
    if action["contract"] != ATTEMPT_ACTION_CONTRACT {
        return Err(format!(
            "Factory's {ACTION_REF} action names another contract than {ATTEMPT_ACTION_CONTRACT}."
        ));
    }
    let caller = &reading["desktopCaller"];
    let caller_ref =
        text(&caller["callerRef"]).ok_or("Factory's admission names no desktop caller.")?;
    if caller["projectionKind"] != "desktop-human"
        || caller["lineage"].as_array().and_then(|l| l.last()) != Some(&Value::from(caller_ref))
    {
        return Err(
            "Factory's admitted desktop caller is not a human projection ending its own lineage."
                .into(),
        );
    }
    let field = |value: &Value, what: &str| {
        text(value).ok_or_else(|| format!("Factory's {ACTION_REF} admission names no {what}."))
    };
    Ok(Admitted {
        caller: caller.clone(),
        capability_ref: field(&reading["capabilityRef"], "capability")?,
        native_owner: field(&reading["nativeOwner"], "native owner")?,
        native_action: field(&action["nativeAction"], "native action")?,
        scope: field(&action["scopeRef"], "scope")?,
        actor_kind: field(&action["actorKind"], "actor kind")?,
    })
}

/// The unit's current attempt, as Factory's reading names it: the attempt of
/// the unit whose execution is the unit's leg's current execution (Factory's
/// attempt_application.rs `current_for_unit`), and the leg.
fn current<'a>(reading: &'a Value, unit: &str) -> Result<(&'a Value, &'a Value), String> {
    let leg = reading["legs"]
        .get(unit)
        .filter(|leg| leg.is_object())
        .ok_or_else(|| format!("Factory's attempt reading has no leg for {unit} in this Run."))?;
    let execution = leg["executionRef"].as_str().unwrap_or_default();
    let attempt = reading["attempts"]
        .as_array()
        .and_then(|rows| {
            rows.iter().find(|row| {
                row["workflowUnitRef"] == unit
                    && (row["executionRef"]
                        .as_str()
                        .or(row["reservedExecutionRef"].as_str())
                        == Some(execution))
            })
        })
        .ok_or_else(|| format!("Factory's attempt reading names no current attempt for {unit}."))?;
    Ok((attempt, leg))
}

/// The same ref for the same press: the Run, the unit, the attempt it
/// replaces and the revision read.
fn suffix(run_ref: &str, unit: &str, prior: &str, revision: u64) -> String {
    use sha2::{Digest, Sha256};
    let digest = Sha256::digest(
        [run_ref, unit, prior, &revision.to_string()]
            .join("\n")
            .as_bytes(),
    );
    digest
        .iter()
        .take(12)
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

/// Retry one unit. Returns the retry document: `retried` (Factory admitted
/// the new attempt), `already-retried` (Factory answered an earlier
/// application of the same document), `uncertain` (the owner may have run and
/// did not answer) or `refused`, with the owner's own words, or the driver's
/// own named as such. A refusal moves nothing.
pub(super) fn attempt_retry(
    call: &mut OwnerCall<'_>,
    state_path: &Path,
    run_ref: &str,
    unit: &str,
    authority: RetryAuthority<'_>,
) -> Value {
    let envelope = |status: &str, changed: bool, extra: Value| {
        let mut document = serde_json::json!({
            "contract": CONTRACT,
            "runRef": run_ref,
            "workflowUnitRef": unit,
            "status": status,
            "changed": changed,
            "attemptRef": null,
            "priorAttemptRef": null,
            "authorityRef": null,
            "receipt": null,
            "refusal": null,
        });
        if let (Some(into), Some(from)) = (document.as_object_mut(), extra.as_object()) {
            for (key, value) in from {
                into.insert(key.clone(), value.clone());
            }
        }
        document
    };
    let refused = |source: &str, step: Option<&str>, message: String| {
        envelope(
            "refused",
            false,
            serde_json::json!({"refusal": refusal(source, step, message)}),
        )
    };
    if run_ref.trim().is_empty() || unit.trim().is_empty() {
        return refused(
            "driver",
            None,
            "A retry names the exact Run and the exact unit.".into(),
        );
    }
    // Whether Factory admits a desktop's retry, and what the grant must carry.
    let disclosure = match call(
        &["attempt".into(), "admission".into(), "--json".into()],
        None,
    ) {
        Ok(reading) if reading["contract"] == receiving::ADMISSION_CONTRACT => reading,
        Ok(_) => {
            return refused(
                "owner",
                Some("admission"),
                format!(
                    "Factory answered an unexpected admission reading where {} was asked for.",
                    receiving::ADMISSION_CONTRACT
                ),
            )
        }
        Err(error) => return refused("owner", Some("admission"), error.message),
    };
    let expected = match admitted(&disclosure) {
        Ok(expected) => expected,
        Err(reason) => return refused("owner", Some("admission"), reason),
    };
    // The grant gate comes before any other owner call: no grant, no move.
    let contract = match read_authority_contract(authority.contract) {
        Ok(contract) => contract,
        Err(reason) => return refused("driver", None, reason),
    };
    let grant = match authority
        .grant
        .clone()
        .filter(|grant| !grant.trim().is_empty())
    {
        Some(grant) => grant,
        None => match authority
            .token
            .as_ref()
            .and_then(|token| grant_held_by(&contract, token, &expected.actor_kind))
        {
            Some(grant) => grant,
            None => {
                return refused(
                    "driver",
                    None,
                    format!(
                        "No native action authority grant names the host: no {} principal in the contract holds the host's token (Control/user/native-action-authority.json).",
                        expected.actor_kind
                    ),
                )
            }
        },
    };
    if let Some(reason) = grant_refusal(
        &contract,
        &grant,
        authority.token.as_ref(),
        authority.now_unix_seconds,
        &Wanted {
            action: &expected.native_action,
            scope: &expected.scope,
            actor_kind: Some(&expected.actor_kind),
        },
    ) {
        return refused("driver", None, reason);
    }
    let attempts = match read_owner(call, ["attempt", "read"], state_path, run_ref) {
        Ok(attempts) => attempts,
        Err(error) => return refused("owner", Some("attempt"), error.message),
    };
    let Some(revision) = attempts["revision"].as_u64() else {
        return refused(
            "owner",
            Some("attempt"),
            "Factory's attempt reading names no state revision.".into(),
        );
    };
    let (prior, leg) = match current(&attempts, unit) {
        Ok(pair) => pair,
        Err(reason) => return refused("driver", Some("attempt"), reason),
    };
    let prior_ref = text(&prior["attemptRef"]).unwrap_or_default();
    let Some(grant_ref) = text(&prior["disposition"]["budget"]["retryGrantRef"]) else {
        return refused(
            "driver",
            Some("attempt"),
            format!("{prior_ref} carries no retry grant (disposition.budget.retryGrantRef); Factory retries a unit only under the grant its attempt consumes."),
        );
    };
    let (Some(task_ref), Some(parent_journey_ref)) = (
        text(&prior["taskRef"]),
        text(&leg["delegation"]["parentJourneyRef"]),
    ) else {
        return refused(
            "owner",
            Some("attempt"),
            format!("Factory's attempt reading names no task or parent Journey for {unit}."),
        );
    };
    let suffix = suffix(run_ref, unit, &prior_ref, revision);
    let attempt_ref = format!("attempt:desk-retry:{suffix}");
    let body = serde_json::json!({
        "contract": ATTEMPT_ACTION_CONTRACT,
        "projectionRef": format!("projection:desk-retry:{suffix}"),
        "caller": expected.caller,
        "runRef": run_ref,
        "expectedRevision": revision,
        "authority": {
            "authorityRef": grant,
            "nativeOwner": expected.native_owner,
            "capabilityRef": expected.capability_ref,
            "capabilityGranted": true,
            "actionAuthorised": true,
        },
        // Factory's own spelling of the operation (attempt_runtime.rs
        // FactoryAttemptOperation::Retry), its fields snake_case.
        "operation": {
            "operation": "retry",
            "attempt_ref": attempt_ref,
            "task_ref": task_ref,
            "parent_journey_ref": parent_journey_ref,
            "workflow_unit_ref": unit,
            "grant_ref": grant_ref,
            "disposition": prior["disposition"],
            "tracking": [],
            "reresolution": null,
        },
    });
    let refs = serde_json::json!({"attemptRef": attempt_ref, "priorAttemptRef": prior_ref, "authorityRef": grant});
    match action_call(call, state_path, &body) {
        Ok(receipt) => {
            let applied = step_status(&receipt, revision) == "applied";
            let mut extra = refs;
            extra["receipt"] = receipt;
            envelope(
                if applied {
                    "retried"
                } else {
                    "already-retried"
                },
                applied,
                extra,
            )
        }
        Err(error) => {
            // Factory refuses before it applies anything (its store checks the
            // revision under its lock); a stopped or broken owner may have run.
            let uncertain = matches!(error.kind.as_str(), "timeout" | "process-error");
            let mut extra = refs;
            extra["refusal"] = serde_json::json!({"source": "owner", "step": "retry",
                "message": error.message, "operationMayHaveRun": uncertain});
            envelope(
                if uncertain { "uncertain" } else { "refused" },
                uncertain,
                extra,
            )
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const TOKEN: &str = "the-hosts-own-token";
    const HUMAN: &str = "central:source:control:root:Control/user/identity";
    const NOW: u64 = 1_800_000_000;
    const UNIT: &str = "unit:inspect-source";
    const RETRY_ACTION: &str = "factory.attempt.retry";

    fn contract(actions: &[&str]) -> Value {
        serde_json::json!({
            "schema": "central.native-action-authority/v1",
            "grants": [
                {"principal_ref": HUMAN, "actor_kind": "human", "token_sha256": token_sha256(TOKEN),
                 "scope_refs": ["project:Factory"], "actions": actions, "expires_at_unix_seconds": NOW + 1000},
            ],
        })
    }

    struct TempContract(PathBuf);
    impl TempContract {
        fn new(name: &str, document: &Value) -> Self {
            static NEXT: std::sync::atomic::AtomicUsize = std::sync::atomic::AtomicUsize::new(0);
            let dir = std::env::temp_dir().join(format!(
                "factory-retry-{name}-{}-{}",
                std::process::id(),
                NEXT.fetch_add(1, std::sync::atomic::Ordering::Relaxed)
            ));
            std::fs::create_dir_all(&dir).unwrap();
            let path = dir.join("native-action-authority.json");
            std::fs::write(&path, serde_json::to_vec(document).unwrap()).unwrap();
            Self(path)
        }
    }
    impl Drop for TempContract {
        fn drop(&mut self) {
            if let Some(dir) = self.0.parent() {
                let _ = std::fs::remove_dir_all(dir);
            }
        }
    }

    /// Factory's admission reading as the installed owner answers it (`factory
    /// attempt admission --json`, 22 Oct 2026), and the same with an
    /// `attempt-retry` action admitted.
    fn admission(with_retry: bool) -> Value {
        let mut reading = serde_json::json!({
            "contract": "factory.attempt-admission/v1",
            "nativeOwner": "factory",
            "capabilityRef": "capability/factory/operate-attempt",
            "desktopCaller": {"callerRef": "oi:desktop", "projectionKind": "desktop-human", "lineage": ["oi:desktop"]},
            "actions": [{"actionRef": "attempt-receiving", "contract": "factory.attempt-receiving-action/v1",
                "nativeAction": "central.receiving.submit", "scopeRef": "project:Factory", "actorKind": "human"}],
        });
        if with_retry {
            reading["actions"].as_array_mut().unwrap().push(serde_json::json!({
                "actionRef": "attempt-retry", "contract": "factory.attempt-action/v1",
                "nativeAction": RETRY_ACTION, "scopeRef": "project:Factory", "actorKind": "human"}));
        }
        reading
    }

    /// Factory's attempt reading of a Run whose unit's current attempt failed,
    /// in the owner's camelCase (attempt_runtime.rs FactoryAttemptReading).
    fn attempts() -> Value {
        serde_json::json!({
            "contract": "factory.attempt-reading/v1",
            "revision": 7,
            "runRef": "run:one",
            "legs": {UNIT: {"executionRef": "factory-attempt:attempt:first", "status": "failed",
                "delegation": {"parentJourneyRef": "journey:one", "parentRunRef": "run:one"}}},
            "attempts": [
                {"attemptRef": "attempt:older", "taskRef": "task:inspect", "workflowUnitRef": UNIT,
                 "reservedExecutionRef": "factory-attempt:attempt:older", "disposition": {"budget": {}}},
                {"attemptRef": "attempt:first", "taskRef": "task:inspect", "workflowUnitRef": UNIT,
                 "reservedExecutionRef": "factory-attempt:attempt:first",
                 "disposition": {"participant": {"agentRef": "agent:a"}, "budget": {"retryGrantRef": "grant:inspect", "maximumAttempts": 2}}},
            ],
        })
    }

    /// A scripted Factory: admission, attempt read, and the attempt action,
    /// which it answers (or refuses) as given; every call is kept.
    fn owner<'a>(
        with_retry: bool,
        action: Result<Value, Error>,
        calls: &'a std::cell::RefCell<Vec<(Vec<String>, Option<Value>)>>,
    ) -> impl FnMut(&[std::ffi::OsString], Option<&[u8]>) -> Result<Value, Error> + 'a {
        let mut action = Some(action);
        move |args, input| {
            let words: Vec<String> = args
                .iter()
                .map(|a| a.to_string_lossy().into_owned())
                .collect();
            calls.borrow_mut().push((
                words.clone(),
                input.map(|bytes| serde_json::from_slice(bytes).unwrap()),
            ));
            match (words[0].as_str(), words[1].as_str()) {
                ("attempt", "admission") => Ok(admission(with_retry)),
                ("attempt", "read") => Ok(attempts()),
                ("attempt", "action") => action.take().expect("one action"),
                other => panic!("unexpected owner call {other:?}"),
            }
        }
    }

    fn authority(contract: &TempContract) -> RetryAuthority<'_> {
        RetryAuthority {
            grant: None,
            token: AuthorityToken::for_test(TOKEN),
            contract: Some(&contract.0),
            now_unix_seconds: NOW,
        }
    }

    #[test]
    fn a_retry_factory_does_not_admit_is_refused_before_any_move_naming_what_it_admits() {
        let contract = TempContract::new("unadmitted", &contract(&[RETRY_ACTION]));
        let calls = std::cell::RefCell::new(Vec::new());
        let mut call = owner(false, Ok(Value::Null), &calls);
        let answer = attempt_retry(
            &mut call,
            Path::new("/s"),
            "run:one",
            UNIT,
            authority(&contract),
        );
        assert_eq!(answer["status"], "refused");
        assert_eq!(answer["changed"], false);
        assert_eq!(answer["refusal"]["step"], "admission");
        let words = answer["refusal"]["message"].as_str().unwrap();
        assert!(
            words.contains("no attempt-retry action") && words.contains("only attempt-receiving"),
            "{words}"
        );
        assert_eq!(calls.borrow().len(), 1, "only the admission was read");
    }

    #[test]
    fn a_grant_that_does_not_carry_the_admitted_action_refuses_before_any_move() {
        let contract = TempContract::new("ungranted", &contract(&["central.receiving.submit"]));
        let calls = std::cell::RefCell::new(Vec::new());
        let mut call = owner(true, Ok(Value::Null), &calls);
        let answer = attempt_retry(
            &mut call,
            Path::new("/s"),
            "run:one",
            UNIT,
            authority(&contract),
        );
        assert_eq!(answer["status"], "refused");
        assert!(
            answer["refusal"]["message"]
                .as_str()
                .unwrap()
                .contains("does not list factory.attempt.retry"),
            "{answer}"
        );
        assert_eq!(calls.borrow().len(), 1, "no attempt was read or acted on");
    }

    #[test]
    fn an_admitted_granted_retry_carries_the_current_attempts_task_journey_grant_and_disposition_verbatim(
    ) {
        let contract = TempContract::new("granted", &contract(&[RETRY_ACTION]));
        let calls = std::cell::RefCell::new(Vec::new());
        let receipt = serde_json::json!({"contract": "factory.attempt-action/v1", "previousRevision": 7,
            "nextRevision": 8, "operation": "retry", "attemptRefs": ["attempt:new"], "standing": "admitted"});
        let mut call = owner(true, Ok(receipt), &calls);
        let answer = attempt_retry(
            &mut call,
            Path::new("/s"),
            "run:one",
            UNIT,
            authority(&contract),
        );
        assert_eq!(answer["status"], "retried", "{answer}");
        assert_eq!(answer["changed"], true);
        assert_eq!(answer["priorAttemptRef"], "attempt:first");
        assert_eq!(
            answer["authorityRef"],
            format!("central:native-action-authority#{HUMAN}")
        );
        let calls = calls.borrow();
        let (words, body) = calls.last().unwrap();
        assert_eq!(words, &["attempt", "action", "/s", "-", "--json"]);
        let body = body.as_ref().unwrap();
        assert_eq!(body["expectedRevision"], 7);
        assert_eq!(body["caller"]["callerRef"], "oi:desktop");
        assert_eq!(
            body["authority"]["capabilityRef"],
            "capability/factory/operate-attempt"
        );
        let operation = &body["operation"];
        assert_eq!(operation["operation"], "retry");
        assert_eq!(operation["task_ref"], "task:inspect");
        assert_eq!(operation["parent_journey_ref"], "journey:one");
        assert_eq!(operation["workflow_unit_ref"], UNIT);
        assert_eq!(operation["grant_ref"], "grant:inspect");
        assert_eq!(
            operation["disposition"],
            attempts()["attempts"][1]["disposition"]
        );
        assert_eq!(operation["attempt_ref"], answer["attemptRef"]);
        // The same press at the same revision is the same document.
        assert_eq!(
            suffix("run:one", UNIT, "attempt:first", 7),
            suffix("run:one", UNIT, "attempt:first", 7)
        );
    }

    #[test]
    fn factorys_refusal_of_the_retry_comes_back_in_its_words() {
        let contract = TempContract::new("refused", &contract(&[RETRY_ACTION]));
        let calls = std::cell::RefCell::new(Vec::new());
        let words = "factory: Factory attempt error: InvalidOperation(\"partial effects or changed conditions require explicit re-resolution\")";
        let mut call = owner(
            true,
            Err(Error {
                kind: "owner-refused-or-failed".into(),
                message: words.into(),
                operation_may_have_run: true,
            }),
            &calls,
        );
        let answer = attempt_retry(
            &mut call,
            Path::new("/s"),
            "run:one",
            UNIT,
            authority(&contract),
        );
        assert_eq!(answer["status"], "refused");
        assert_eq!(answer["changed"], false);
        assert_eq!(answer["refusal"]["source"], "owner");
        assert_eq!(answer["refusal"]["message"], words);
    }

    #[test]
    fn a_unit_without_a_leg_is_named_and_the_current_attempt_is_the_legs_execution() {
        let contract = TempContract::new("unit", &contract(&[RETRY_ACTION]));
        let calls = std::cell::RefCell::new(Vec::new());
        let mut call = owner(true, Ok(Value::Null), &calls);
        let answer = attempt_retry(
            &mut call,
            Path::new("/s"),
            "run:one",
            "unit:other",
            authority(&contract),
        );
        assert_eq!(answer["status"], "refused");
        assert!(answer["refusal"]["message"]
            .as_str()
            .unwrap()
            .contains("no leg for unit:other"));
        assert!(
            calls.borrow().iter().all(|(words, _)| words[1] != "action"),
            "nothing was asked of the attempt action"
        );
        let reading = attempts();
        let (prior, leg) = current(&reading, UNIT).unwrap();
        assert_eq!(
            prior["attemptRef"], "attempt:first",
            "the current attempt is the leg's execution"
        );
        assert_eq!(leg["delegation"]["parentJourneyRef"], "journey:one");
    }
}
