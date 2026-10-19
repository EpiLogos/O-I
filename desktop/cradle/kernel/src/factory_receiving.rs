//! Choosing an attempt: the person's own press, the Return of one attempt
//! proposed to Central's receiving field (`factory attempt receiving`). The
//! shell lays a session's attempts as takes; choosing one is this act.
//!
//! The owner decides and the driver only assembles what the owners disclose:
//!
//! - the caller, the capability and the native action come from Factory's own
//!   admission reading (`factory attempt admission`), never a name this driver
//!   invents;
//! - the target (the Central Flow the Run is associated with, its document and
//!   the revision observed), the Central root and the state revision come from
//!   Factory's Run and attempt readings;
//! - the grant is resolved here, in the native process, against Central's
//!   native action authority contract with the host's own token (as a Run's
//!   close does). The token reaches Factory's environment, where Factory's call
//!   to Central needs it, and never a request, a document or a reply.
//!
//! Every refusal of the owner comes back in its own words; the driver refuses
//! on its own only before any move, and says so.
use super::*;

pub(super) const ADMISSION_CONTRACT: &str = "factory.attempt-admission/v1";
pub const CONTRACT: &str = "oi.factory-attempt-receiving/v1";
const ACTION_REF: &str = "attempt-receiving";
const RECEIPT_CONTRACT: &str = "factory.attempt-receiving-receipt/v1";

/// The host's native action authority for one choice: the grant ref it holds
/// (else the principal its token belongs to), the token, the contract the grant
/// resolves against, the reading clock and the Central owner it names.
pub struct ReceivingAuthority<'a> {
    pub grant: Option<String>,
    pub token: Option<AuthorityToken>,
    /// `None` when no Central contract is found above the Factory state.
    pub contract: Option<&'a Path>,
    pub now_unix_seconds: u64,
    /// The host's Central owner executable (`OI_CENTRAL_CTRL_BIN`).
    pub central_binary: Option<PathBuf>,
}

/// What Factory discloses it expects of a desktop caller.
struct Admission {
    caller: Value,
    capability_ref: String,
    native_owner: String,
    native_action: String,
    scope: String,
    actor_kind: String,
    central_revision: String,
}

fn text(value: &Value) -> Option<String> {
    value
        .as_str()
        .map(str::trim)
        .filter(|text| !text.is_empty())
        .map(str::to_owned)
}

fn admission(reading: &Value) -> Result<Admission, String> {
    let caller = &reading["desktopCaller"];
    let caller_ref = text(&caller["callerRef"]).ok_or("it names no desktop caller")?;
    if caller["projectionKind"] != "desktop-human"
        || caller["lineage"].as_array().and_then(|l| l.last()) != Some(&Value::from(caller_ref))
    {
        return Err("its desktop caller is not a human projection ending its own lineage".into());
    }
    let action = reading["actions"]
        .as_array()
        .and_then(|actions| {
            actions
                .iter()
                .find(|action| action["actionRef"] == ACTION_REF)
        })
        .ok_or("it names no attempt-receiving action")?;
    if action["contract"] != "factory.attempt-receiving-action/v1" {
        return Err("its attempt-receiving action is another contract".into());
    }
    Ok(Admission {
        caller: caller.clone(),
        capability_ref: text(&reading["capabilityRef"]).ok_or("it names no capability")?,
        native_owner: text(&reading["nativeOwner"]).ok_or("it names no native owner")?,
        native_action: text(&action["nativeAction"]).ok_or("it names no native action")?,
        scope: text(&action["scopeRef"]).ok_or("it names no scope")?,
        actor_kind: text(&action["actorKind"]).ok_or("it names no actor kind")?,
        central_revision: text(&reading["central"]["contractRevision"])
            .ok_or("it names no Central contract revision")?,
    })
}

/// The Central Flow a Run is associated with: the target a Return is
/// received into. Exactly one, or the person has nothing to choose among.
struct Flow {
    source_ref: String,
    document_id: String,
    source_revision: String,
    root: String,
}

fn flow_of(run: &Value, run_ref: &str) -> Result<Flow, String> {
    let associations: Vec<&Value> = run["flowAssociations"]
        .as_array()
        .map(|rows| rows.iter().filter(|row| row["runRef"] == run_ref).collect())
        .unwrap_or_default();
    let [association] = associations.as_slice() else {
        return Err(if associations.is_empty() {
            "This Run is associated with no Central Flow, so its Return has nowhere to be received."
                .into()
        } else {
            "This Run is associated with several Central Flows; Factory names no one of them to receive into."
                .into()
        });
    };
    let flow = &association["flow"];
    Ok(Flow {
        source_ref: text(&flow["location"]["ref"]).ok_or("its Flow names no source")?,
        document_id: text(&flow["documentId"]).ok_or("its Flow names no document")?,
        source_revision: text(&flow["sourceRevision"])
            .ok_or("its Flow names no observed source revision")?,
        root: text(&flow["location"]["root"]).ok_or("its Flow names no Central root")?,
    })
}

/// A request ref that is the same for the same choice: the same press twice
/// is Factory's replay, never a second proposal.
fn request_suffix(run_ref: &str, attempt_ref: &str, flow: &Flow) -> String {
    use sha2::{Digest, Sha256};
    let digest = Sha256::digest(
        [
            run_ref,
            attempt_ref,
            &flow.source_ref,
            &flow.document_id,
            &flow.source_revision,
        ]
        .join("\n")
        .as_bytes(),
    );
    digest
        .iter()
        .take(12)
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

/// Choose one attempt. Returns the choice document: `received` (Central
/// confirmed it), `already-received` (the attempt's Return already carries
/// Central's receipt; no call is made), `needs-reconciliation` (Factory
/// retained the call but Central's answer is not confirmed), `uncertain` (the
/// owner may have run and did not answer) or `refused`, with the owner's own
/// words, or the driver's own named as such. A refusal moves nothing.
pub(super) fn attempt_receiving(
    read: &mut OwnerCall<'_>,
    receive: &mut OwnerCall<'_>,
    state_path: &Path,
    run_ref: &str,
    attempt_ref: &str,
    authority: ReceivingAuthority<'_>,
) -> Value {
    let envelope = |status: &str, changed: bool, extra: Value| {
        let mut document = serde_json::json!({
            "contract": CONTRACT,
            "runRef": run_ref,
            "attemptRef": attempt_ref,
            "status": status,
            "changed": changed,
            "target": null,
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
    if run_ref.trim().is_empty() || attempt_ref.trim().is_empty() {
        return refused(
            "driver",
            None,
            "A choice names the exact Run and the exact attempt.".into(),
        );
    }
    // What Factory expects of the caller and what the grant must carry.
    let disclosure = match read(
        &[
            "attempt".into(),
            "admission".into(),
            "--json".into(),
        ],
        None,
    ) {
        Ok(reading) if reading["contract"] == ADMISSION_CONTRACT => reading,
        Ok(_) => {
            return refused(
                "owner",
                Some("admission"),
                format!("Factory answered an unexpected admission reading where {ADMISSION_CONTRACT} was asked for."),
            )
        }
        Err(error) => return refused("owner", Some("admission"), error.message),
    };
    let expected = match admission(&disclosure) {
        Ok(expected) => expected,
        Err(reason) => {
            return refused(
                "driver",
                Some("admission"),
                format!("Factory's admission reading cannot be used: {reason}."),
            )
        }
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
    let Some(central_binary) = authority
        .central_binary
        .clone()
        .filter(|binary| binary.is_absolute())
    else {
        return refused(
            "driver",
            None,
            "The host names no Central owner executable (OI_CENTRAL_CTRL_BIN, an absolute path) for the proposal to reach Central.".into(),
        );
    };
    let run = match read_owner(read, ["development", "run"], state_path, run_ref) {
        Ok(run) => run,
        Err(error) => return refused("owner", Some("run"), error.message),
    };
    let flow = match flow_of(&run, run_ref) {
        Ok(flow) => flow,
        Err(reason) => return refused("driver", Some("run"), reason),
    };
    let target = serde_json::json!({
        "sourceRef": flow.source_ref, "documentId": flow.document_id,
        "sourceRevision": flow.source_revision, "root": flow.root,
    });
    let attempts = match read_owner(read, ["attempt", "read"], state_path, run_ref) {
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
    let Some(attempt) = attempts["attempts"]
        .as_array()
        .and_then(|rows| rows.iter().find(|row| row["attemptRef"] == attempt_ref))
    else {
        return refused(
            "driver",
            Some("attempt"),
            format!("{attempt_ref} is not an attempt of this Run."),
        );
    };
    if attempt["readableReturn"].is_null() {
        return refused(
            "driver",
            Some("attempt"),
            "This attempt has no Return yet; there is nothing to receive.".into(),
        );
    }
    if let Some(receiving) = text(&attempt["readableReturn"]["receivingRef"]) {
        return envelope(
            "already-received",
            false,
            serde_json::json!({"target": target, "authorityRef": grant,
                "receipt": {"receivingRef": receiving}}),
        );
    }
    let suffix = request_suffix(run_ref, attempt_ref, &flow);
    let request = serde_json::json!({
        "contract": "factory.attempt-receiving-action/v1",
        "requestRef": format!("request:desk-receiving:{suffix}"),
        "projectionRef": format!("projection:desk-receiving:{suffix}"),
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
        "attemptRef": attempt_ref,
        "central": {
            "binary": central_binary,
            "root": flow.root,
            "contractRevision": expected.central_revision,
            "project": null,
        },
        "target": {
            "sourceRef": flow.source_ref, "documentId": flow.document_id,
            "sourceRevision": flow.source_revision, "expectedAuthorityRevision": null,
        },
        "occurredAtUnixSeconds": null,
        "recover": false,
    });
    let body = match serde_json::to_vec(&request) {
        Ok(body) => body,
        Err(error) => return refused("driver", None, error.to_string()),
    };
    let args: Vec<std::ffi::OsString> = vec![
        "attempt".into(),
        "receiving".into(),
        path_arg(state_path),
        "-".into(),
        "--json".into(),
    ];
    match receive(&args, Some(&body)) {
        Err(error) => envelope(
            if error.operation_may_have_run { "uncertain" } else { "refused" },
            error.operation_may_have_run,
            serde_json::json!({"target": target, "authorityRef": grant,
                "refusal": {"source": "owner", "step": "receiving", "message": error.message,
                    "operationMayHaveRun": error.operation_may_have_run}}),
        ),
        Ok(receipt) if receipt["contract"] != RECEIPT_CONTRACT => refused(
            "owner",
            Some("receiving"),
            format!("Factory answered an unexpected receiving receipt where {RECEIPT_CONTRACT} was asked for."),
        ),
        Ok(receipt) => {
            let unconfirmed = receipt["needsReconciliation"] == true
                || receipt["centralResponse"].is_null();
            let replayed = receipt["replayed"] == true;
            envelope(
                if unconfirmed { "needs-reconciliation" } else { "received" },
                !replayed,
                serde_json::json!({"target": target, "authorityRef": grant, "receipt": receipt}),
            )
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const TOKEN: &str = "the-hosts-own-token";
    const OTHER_TOKEN: &str = "somebody-elses-token";
    const HUMAN: &str = "central:source:control:root:Control/user/identity";
    const NOW: u64 = 1_800_000_000;

    fn contract(actions: &[&str], scopes: &[&str], expires: u64) -> Value {
        serde_json::json!({
            "schema": "central.native-action-authority/v1",
            "grants": [
                {"principal_ref": "native-service:other", "actor_kind": "native-service",
                 "token_sha256": token_sha256(OTHER_TOKEN), "scope_refs": ["project:Factory"],
                 "actions": ["central.receiving.submit"], "expires_at_unix_seconds": NOW + 1000},
                {"principal_ref": HUMAN, "actor_kind": "human", "token_sha256": token_sha256(TOKEN),
                 "scope_refs": scopes, "actions": actions, "expires_at_unix_seconds": expires},
            ],
        })
    }

    struct TempContract(PathBuf);
    impl TempContract {
        fn new(name: &str, document: &Value) -> Self {
            // Tests run side by side: every contract is its own file.
            static NEXT: std::sync::atomic::AtomicUsize = std::sync::atomic::AtomicUsize::new(0);
            let dir = std::env::temp_dir().join(format!(
                "factory-receiving-{name}-{}-{}",
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

    fn disclosure() -> Value {
        serde_json::json!({
            "contract": ADMISSION_CONTRACT, "nativeOwner": "factory",
            "capabilityRef": "capability/factory/operate-attempt",
            "desktopCaller": {"callerRef": "oi:desktop", "projectionKind": "desktop-human", "lineage": ["oi:desktop"]},
            "central": {"contractRevision": "e7e8479f1502732821bd3e7d3d5ceda38fd4279f"},
            "actions": [{"actionRef": "attempt-receiving", "contract": "factory.attempt-receiving-action/v1",
                "nativeAction": "central.receiving.submit", "scopeRef": "project:Factory", "actorKind": "human"}],
        })
    }

    fn flow() -> Value {
        serde_json::json!({"journeyRef": "journey:J1", "runRef": "run:R1",
            "flow": {"location": {"schema": "central.location/v1", "ref": "central:source:control:root:flow-a",
                                  "root": "/Users/test/Central", "path": "Control/user/flows/a.html"},
                     "documentId": "doc:flow-a", "documentRevision": 3, "sourceRevision": "rev:flow-a:9"}})
    }

    struct Fake {
        admission: Result<Value, String>,
        flows: Vec<Value>,
        returned: bool,
        received: Option<&'static str>,
        receive: Result<Value, (String, bool)>,
        calls: Vec<String>,
        sent: Vec<Value>,
    }

    impl Fake {
        fn new() -> Self {
            Self {
                admission: Ok(disclosure()),
                flows: vec![flow()],
                returned: true,
                received: None,
                receive: Ok(serde_json::json!({
                    "contract": RECEIPT_CONTRACT, "requestRef": "request:desk-receiving:x",
                    "replayed": false, "needsReconciliation": false,
                    "centralResponse": {"ok": true, "action": "central.receiving.submit",
                                        "data": {"return_ref": "return:C1"}},
                })),
                calls: Vec::new(),
                sent: Vec::new(),
            }
        }

        fn read(&mut self, args: &[std::ffi::OsString], _: Option<&[u8]>) -> Result<Value, Error> {
            let words: Vec<String> = args
                .iter()
                .map(|a| a.to_string_lossy().into_owned())
                .collect();
            self.calls.push(format!("{} {}", words[0], words[1]));
            match (words[0].as_str(), words[1].as_str()) {
                ("attempt", "admission") => self.admission.clone().map_err(incompatible),
                ("development", "run") => Ok(serde_json::json!({"flowAssociations": self.flows})),
                ("attempt", "read") => Ok(serde_json::json!({
                    "revision": 40,
                    "attempts": [{"attemptRef": "attempt:A1",
                        "readableReturn": if self.returned {
                            serde_json::json!({"returnRef": "return:A1", "receivingRef": self.received})
                        } else { Value::Null }}],
                })),
                _ => panic!("unexpected read {words:?}"),
            }
        }

        fn receive(
            &mut self,
            args: &[std::ffi::OsString],
            input: Option<&[u8]>,
        ) -> Result<Value, Error> {
            let words: Vec<String> = args
                .iter()
                .map(|a| a.to_string_lossy().into_owned())
                .collect();
            self.calls
                .push(format!("{} {} (write)", words[0], words[1]));
            assert_eq!(&words[..2], ["attempt", "receiving"]);
            assert_eq!(words[3], "-");
            self.sent
                .push(serde_json::from_slice(input.unwrap()).unwrap());
            self.receive
                .clone()
                .map_err(|(message, may_have_run)| Error {
                    kind: "owner-refused-or-failed".into(),
                    message,
                    operation_may_have_run: may_have_run,
                })
        }
    }

    fn choose(
        fake: &mut Fake,
        grant: Option<&str>,
        token: Option<&str>,
        contract: Option<&Path>,
        central: Option<&str>,
    ) -> Value {
        let cell = std::cell::RefCell::new(fake);
        let mut read =
            |args: &[std::ffi::OsString], input: Option<&[u8]>| cell.borrow_mut().read(args, input);
        let mut receive = |args: &[std::ffi::OsString], input: Option<&[u8]>| {
            cell.borrow_mut().receive(args, input)
        };
        attempt_receiving(
            &mut read,
            &mut receive,
            Path::new("/state/factory.json"),
            "run:R1",
            "attempt:A1",
            ReceivingAuthority {
                grant: grant.map(Into::into),
                token: token.and_then(AuthorityToken::for_test),
                contract,
                now_unix_seconds: NOW,
                central_binary: central.map(PathBuf::from),
            },
        )
    }

    fn granted() -> TempContract {
        TempContract::new(
            "granted",
            &contract(
                &["central.receiving.submit"],
                &["control:root", "project:Factory"],
                NOW + 1000,
            ),
        )
    }

    const CTRL: &str = "/opt/central/ctrl";

    #[test]
    fn a_choice_is_assembled_from_what_the_owners_disclose_and_the_hosts_own_grant() {
        let contract = granted();
        let mut fake = Fake::new();
        let result = choose(&mut fake, None, Some(TOKEN), Some(&contract.0), Some(CTRL));
        assert_eq!(result["status"], "received", "{result}");
        assert_eq!(result["changed"], true);
        assert_eq!(result["contract"], CONTRACT);
        assert_eq!(
            result["target"]["sourceRef"],
            "central:source:control:root:flow-a"
        );
        assert_eq!(
            result["receipt"]["centralResponse"]["data"]["return_ref"],
            "return:C1"
        );
        assert_eq!(
            fake.calls,
            [
                "attempt admission",
                "development run",
                "attempt read",
                "attempt receiving (write)"
            ]
        );
        let sent = &fake.sent[0];
        assert_eq!(sent["contract"], "factory.attempt-receiving-action/v1");
        assert_eq!(sent["caller"]["callerRef"], "oi:desktop");
        assert_eq!(sent["caller"]["projectionKind"], "desktop-human");
        assert_eq!(sent["runRef"], "run:R1");
        assert_eq!(sent["attemptRef"], "attempt:A1");
        assert_eq!(sent["expectedRevision"], 40);
        assert_eq!(
            sent["authority"]["authorityRef"],
            format!("central:native-action-authority#{HUMAN}"),
            "the principal the host's token belongs to, not a ref the desk named"
        );
        assert_eq!(sent["authority"]["nativeOwner"], "factory");
        assert_eq!(
            sent["authority"]["capabilityRef"],
            "capability/factory/operate-attempt"
        );
        assert_eq!(sent["authority"]["capabilityGranted"], true);
        assert_eq!(sent["authority"]["actionAuthorised"], true);
        assert_eq!(sent["central"]["binary"], CTRL);
        assert_eq!(sent["central"]["root"], "/Users/test/Central");
        assert_eq!(
            sent["central"]["contractRevision"],
            "e7e8479f1502732821bd3e7d3d5ceda38fd4279f"
        );
        assert_eq!(sent["central"]["project"], Value::Null);
        assert_eq!(
            sent["target"]["sourceRef"],
            "central:source:control:root:flow-a"
        );
        assert_eq!(sent["target"]["documentId"], "doc:flow-a");
        assert_eq!(sent["target"]["sourceRevision"], "rev:flow-a:9");
        assert_eq!(sent["recover"], false);
        // The token never travels in a document or a reply.
        assert!(!sent.to_string().contains(TOKEN));
        assert!(!result.to_string().contains(TOKEN));
        // The same choice again is the same request: Factory's replay, not a second proposal.
        let mut again = Fake::new();
        choose(&mut again, None, Some(TOKEN), Some(&contract.0), Some(CTRL));
        assert_eq!(again.sent[0]["requestRef"], sent["requestRef"]);
        assert!(sent["requestRef"]
            .as_str()
            .unwrap()
            .starts_with("request:desk-receiving:"));
    }

    #[test]
    fn a_grant_the_host_cannot_hold_is_refused_before_any_run_or_attempt_is_read() {
        for (name, grant, token, document, reason) in [
            (
                "no token",
                None,
                None,
                contract(
                    &["central.receiving.submit"],
                    &["project:Factory"],
                    NOW + 1000,
                ),
                "No native action authority grant names the host",
            ),
            (
                "a token no human principal holds",
                None,
                Some(OTHER_TOKEN),
                contract(
                    &["central.receiving.submit"],
                    &["project:Factory"],
                    NOW + 1000,
                ),
                "No native action authority grant names the host",
            ),
            (
                "a grant the contract does not name",
                Some("central:native-action-authority#central:source:nobody"),
                Some(TOKEN),
                contract(
                    &["central.receiving.submit"],
                    &["project:Factory"],
                    NOW + 1000,
                ),
                "unknown grant:",
            ),
            (
                "a grant that does not list central.receiving.submit",
                None,
                Some(TOKEN),
                contract(&["central.day.ensure"], &["project:Factory"], NOW + 1000),
                "action not granted: the grant does not list central.receiving.submit",
            ),
            (
                "a grant that does not cover project:Factory",
                None,
                Some(TOKEN),
                contract(&["central.receiving.submit"], &["control:root"], NOW + 1000),
                "scope not granted: the grant does not cover project:Factory",
            ),
            (
                "a grant that has expired",
                None,
                Some(TOKEN),
                contract(&["central.receiving.submit"], &["project:Factory"], NOW),
                "expired:",
            ),
            (
                "a service principal's grant for a human's act",
                Some("central:native-action-authority#native-service:other"),
                Some(OTHER_TOKEN),
                contract(
                    &["central.receiving.submit"],
                    &["project:Factory"],
                    NOW + 1000,
                ),
                "actor not granted:",
            ),
        ] {
            let contract = TempContract::new("refused", &document);
            let mut fake = Fake::new();
            let result = choose(&mut fake, grant, token, Some(&contract.0), Some(CTRL));
            assert_eq!(result["status"], "refused", "{name}: {result}");
            assert_eq!(result["changed"], false, "{name}");
            assert_eq!(result["refusal"]["source"], "driver", "{name}");
            let message = result["refusal"]["message"].as_str().unwrap();
            assert!(message.starts_with(reason), "{name}: {message}");
            assert_eq!(
                fake.calls,
                ["attempt admission"],
                "{name}: only the disclosure is read"
            );
            assert!(fake.sent.is_empty(), "{name}: nothing is sent");
            for secret in [TOKEN, OTHER_TOKEN] {
                assert!(
                    !result.to_string().contains(secret),
                    "{name}: no token is echoed"
                );
            }
        }
        // No contract above the state, or one that cannot be read.
        let mut fake = Fake::new();
        let none = choose(&mut fake, None, Some(TOKEN), None, Some(CTRL));
        assert!(none["refusal"]["message"]
            .as_str()
            .unwrap()
            .starts_with("The native action authority contract is not found"));
        let missing =
            std::env::temp_dir().join("factory-receiving-absent/native-action-authority.json");
        let unreadable = choose(&mut fake, None, Some(TOKEN), Some(&missing), Some(CTRL));
        assert!(unreadable["refusal"]["message"]
            .as_str()
            .unwrap()
            .starts_with("The native action authority contract cannot be read"));
        assert!(fake.sent.is_empty());
    }

    #[test]
    fn what_cannot_be_received_is_named_before_anything_is_sent() {
        let contract = granted();
        let central = Some(CTRL);
        // The Run has no Flow, or several.
        let mut fake = Fake::new();
        fake.flows.clear();
        let none = choose(&mut fake, None, Some(TOKEN), Some(&contract.0), central);
        assert!(none["refusal"]["message"]
            .as_str()
            .unwrap()
            .contains("associated with no Central Flow"));
        let mut fake = Fake::new();
        fake.flows = vec![flow(), flow()];
        let several = choose(&mut fake, None, Some(TOKEN), Some(&contract.0), central);
        assert!(several["refusal"]["message"]
            .as_str()
            .unwrap()
            .contains("several Central Flows"));
        // A Flow of another Run is not this Run's.
        let mut fake = Fake::new();
        fake.flows = vec![serde_json::json!({"runRef": "run:other", "flow": flow()["flow"]})];
        let other = choose(&mut fake, None, Some(TOKEN), Some(&contract.0), central);
        assert!(other["refusal"]["message"]
            .as_str()
            .unwrap()
            .contains("associated with no Central Flow"));
        // The attempt has no Return yet.
        let mut fake = Fake::new();
        fake.returned = false;
        let unreturned = choose(&mut fake, None, Some(TOKEN), Some(&contract.0), central);
        assert!(unreturned["refusal"]["message"]
            .as_str()
            .unwrap()
            .contains("no Return yet"));
        // No Central owner named by the host (or a relative one).
        let mut fake = Fake::new();
        let absent = choose(&mut fake, None, Some(TOKEN), Some(&contract.0), None);
        assert!(absent["refusal"]["message"]
            .as_str()
            .unwrap()
            .contains("OI_CENTRAL_CTRL_BIN"));
        let relative = choose(
            &mut fake,
            None,
            Some(TOKEN),
            Some(&contract.0),
            Some("ctrl"),
        );
        assert!(relative["refusal"]["message"]
            .as_str()
            .unwrap()
            .contains("OI_CENTRAL_CTRL_BIN"));
        assert!(fake.sent.is_empty());
        // The Return is already received: nothing to send, and the receipt is named.
        let mut fake = Fake::new();
        fake.received = Some("receiving:R9");
        let already = choose(&mut fake, None, Some(TOKEN), Some(&contract.0), central);
        assert_eq!(already["status"], "already-received");
        assert_eq!(already["changed"], false);
        assert_eq!(already["receipt"]["receivingRef"], "receiving:R9");
        assert!(fake.sent.is_empty());
    }

    #[test]
    fn an_admission_reading_that_cannot_be_used_is_named_and_nothing_follows() {
        let contract = granted();
        for (name, admission, said) in [
            (
                "an unreachable owner",
                Err("Factory is unavailable".to_string()),
                "Factory is unavailable",
            ),
            (
                "another contract",
                Ok(serde_json::json!({"contract": "factory.something/v1"})),
                "unexpected admission reading",
            ),
            (
                "an agent caller",
                Ok({
                    let mut reading = disclosure();
                    reading["desktopCaller"]["projectionKind"] = "situated-agent".into();
                    reading
                }),
                "cannot be used",
            ),
            (
                "no attempt-receiving action",
                Ok({
                    let mut reading = disclosure();
                    reading["actions"] = serde_json::json!([]);
                    reading
                }),
                "names no attempt-receiving action",
            ),
        ] {
            let mut fake = Fake::new();
            fake.admission = admission;
            let result = choose(&mut fake, None, Some(TOKEN), Some(&contract.0), Some(CTRL));
            assert_eq!(result["status"], "refused", "{name}");
            assert!(
                result["refusal"]["message"]
                    .as_str()
                    .unwrap()
                    .contains(said),
                "{name}: {result}"
            );
            assert_eq!(fake.calls.len(), 1, "{name}");
        }
    }

    #[test]
    fn the_owners_refusal_and_an_unconfirmed_answer_come_back_as_the_owner_gave_them() {
        let contract = granted();
        // Factory refuses in its words.
        let mut fake = Fake::new();
        fake.receive = Err((
            "stale Factory state revision before receiving".into(),
            false,
        ));
        let refused = choose(&mut fake, None, Some(TOKEN), Some(&contract.0), Some(CTRL));
        assert_eq!(refused["status"], "refused");
        assert_eq!(refused["changed"], false);
        assert_eq!(refused["refusal"]["source"], "owner");
        assert_eq!(
            refused["refusal"]["message"],
            "stale Factory state revision before receiving"
        );
        assert_eq!(refused["target"]["documentId"], "doc:flow-a");
        // An owner that may have run and did not answer is uncertain, never a refusal.
        let mut fake = Fake::new();
        fake.receive = Err(("the owner did not answer in time".into(), true));
        let uncertain = choose(&mut fake, None, Some(TOKEN), Some(&contract.0), Some(CTRL));
        assert_eq!(uncertain["status"], "uncertain");
        assert_eq!(uncertain["changed"], true);
        assert_eq!(uncertain["refusal"]["operationMayHaveRun"], true);
        // Factory retained the call but Central's answer is not confirmed.
        let mut fake = Fake::new();
        fake.receive = Ok(
            serde_json::json!({"contract": RECEIPT_CONTRACT, "replayed": false,
            "needsReconciliation": true, "centralResponse": null}),
        );
        let unconfirmed = choose(&mut fake, None, Some(TOKEN), Some(&contract.0), Some(CTRL));
        assert_eq!(unconfirmed["status"], "needs-reconciliation");
        assert_eq!(unconfirmed["changed"], true);
        // A replay of a retained call changed nothing.
        let mut fake = Fake::new();
        fake.receive = Ok(
            serde_json::json!({"contract": RECEIPT_CONTRACT, "replayed": true,
            "needsReconciliation": true, "centralResponse": null}),
        );
        let replayed = choose(&mut fake, None, Some(TOKEN), Some(&contract.0), Some(CTRL));
        assert_eq!(replayed["status"], "needs-reconciliation");
        assert_eq!(replayed["changed"], false);
        // Another contract is not a receipt.
        let mut fake = Fake::new();
        fake.receive = Ok(serde_json::json!({"contract": "factory.something/v1"}));
        let strange = choose(&mut fake, None, Some(TOKEN), Some(&contract.0), Some(CTRL));
        assert_eq!(strange["status"], "refused");
        assert!(strange["refusal"]["message"]
            .as_str()
            .unwrap()
            .contains("unexpected receiving receipt"));
    }

    #[test]
    fn the_request_kinds_deserialise_from_the_desktop_wire() {
        let admission: OwnerRequest =
            serde_json::from_value(serde_json::json!({"kind": "attempt-admission"})).unwrap();
        assert!(admission.is_read());
        let receiving: OwnerRequest = serde_json::from_value(serde_json::json!({
            "kind": "attempt-receiving", "state_path": "/s.json", "run_ref": "run:R1", "attempt_ref": "attempt:A1"
        }))
        .unwrap();
        assert!(!receiving.is_read(), "choosing an attempt is a write");
        assert!(matches!(
            receiving,
            OwnerRequest::AttemptReceiving {
                authority_grant: None,
                ..
            }
        ));
        // The desk cannot supply the host's token.
        assert!(serde_json::from_value::<OwnerRequest>(serde_json::json!({
            "kind": "attempt-receiving", "state_path": "/s.json", "run_ref": "r", "attempt_ref": "a",
            "authority_token": "x"
        }))
        .is_ok(), "an unknown field is ignored and never read");
    }
}
