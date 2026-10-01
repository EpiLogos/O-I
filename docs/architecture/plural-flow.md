---
role: architecture
standing: agent-inference
scope: ordinary plural Flow dispatch, recovery and incorporation
diagram_refs: ["plural-flow.mmd"]
design_refs: ["../experience/PLURAL-FLOW-SPEC.md"]
updated: 2026-09-30
---
# How does an interrupted Flow return?

![Plural Flow](rendered/plural-flow.svg)

The ordinary Flow is a `ql-doc` HTML file in the person's Central
`Control/user/flows/`. Central owns its source mutation and revision. O:I edits
and presents it through the existing document Surface. This is the current
route for ordinary plural Flow. `PROJECTCENTRAL-FLOW.md` describes registered
continuity identity, metadata and older placement rules; it is not the public
request/delivery protocol. Use the plural specification and native append
source for this operation, including its authorised `Control/user/flows/` path.

The public operation is `aikit session-space encounter --request-json <JSON>`
(or `oi aikit session-space encounter` through the suite). `conversation-send`,
`conversation-read` and `conversation-reconcile` are JSON `action` values,
not positional CLI subcommands. Send supplies
`{"action":"conversation-send","request":{...}}`, with the real
`ConversationSendRequest` defined in the source below. Recovery of an existing
request uses:

```sh
aikit session-space encounter --request-json '{"action":"conversation-reconcile","request_ref":"<existing request ref>"}'
```

Send admits the Flow-bound sender, request digest and one to 32 recipients.
Before dispatch, Central's native append
operation commits the original entry, retrying a source conflict without
overwriting the intervening edit. Its operation ref/digest makes replay
idempotent. A request record without that source acknowledgement cannot dispatch.

AIKit rechecks current membership/seat authority, builds an attributed bounded
packet from the actual source, and targets the actual Agency's canonical
session. Local resident delivery and explicit SSH/exec remote routes are
implemented carriers. A connection/session signal is not participant identity.
Delivery/cursor state and replies are durably journalled; serial delivery on a
single provider session prevents reply attribution crossing adjacent turns.
Independent sessions can proceed independently.

After interruption, `conversation-reconcile` reads durable state and reconciles
acknowledged steps. Unknown provider continuation becomes `reconciled-no-replay`;
it is never automatically resent. Inclusion retries can terminate in refusal
after their bounded attempt limit (currently 20). A completed nonempty reply
is incorporated only after current
membership is checked again. Central's append records the original request and
source revision, actual agent/session/generation/Workcell and bounded reply.
Its native acknowledgement marks inclusion; reread/reopen shows the source
result, rather than trusting a desktop bubble. The JSON request addresses the
current native encounter owner; it does not start a replacement provider or
derive participant identity from a socket.

| Operation/source | Storage and lifecycle | Verification route |
| --- | --- | --- |
| Central Flow append, `ctrl/src/flow_append.rs` included by `file_mutation.rs` | Source CAS, policy/lock/journal; entry.request ref/digest and reply relation | `ctrl/tests/flow_append.rs`, shared plural conformance fixtures. |
| AIKit `conversation_send/step/admit/incorporate`, `crates/aikit-cli/src/encounter_conversation.rs` | `state/encounters.sqlite3`: request/recipient state, source ack, delivery IDs and cursors in `crates/aikit-store/src/encounter_conversation.rs` / `encounter_delivery.rs` | `crates/aikit-cli/src/encounter_conversation_tests.rs` departed/queued/running cases and the [independent return](../../.wayfinder/maps/plural-flow-now.md#9-independent-verification--30-september-2026). |
| O:I native document integration | `desktop/cradle/src` and embedded plural module | `desktop/cradle` `test:plural-flow`; installed keyboard/pointer proof has its own standing. |

The map reports an installed AIKit `02395f05` / Central `fe269e19` interrupted
Mac↔Omarchy episode and source readback. The retained receipt demonstrates
saved attribution and historical reply relations. The restored
[local and remote logs](../experience/evidence/plural-flow-20260930/README.md)
record interruption, restoration and `unknown → returned → included`.
The driver creates an SSH refusal flag, waits 30,000 ms and removes it;
the logs support that driver-controlled interval but have no break/restore
timestamps independently measuring elapsed time. This episode does not prove
withdrawal during recovery; the departed-participant tests below cover that
separate source boundary. D1–D9 are recorded repaired;
D10 remains open at this cut. Hosted SharedField/Gateway-native transport,
facilitated team budgets/cancel, independent two-human participation, Workcell
succession and installed pointer/keyboard completion still need their named
acceptance. These are not implied by the ordinary native route.

The departed/queued/running tests exercise real EncounterService and Central
files with scripted ACP processes. Their `need_ctrl!` guard can return early
without `AIKIT_TEST_CENTRAL_CTRL`; a passing runner without that native binary
does not prove the boundary. The fresh-agent navigation inspected these tests
and current source bytes; it did not execute a new live-model episode.

F1–F10 in [relations.json](relations.json) identify each implemented relation.
