# Buzz/Grok agent-messaging RE — contract of record

**Status:** landed 2026-10-08, closing the three unresolved items from the
2026-10-07 campaign (lost decompile outputs, missing behaviours research,
stale landing pointers). This contract is the functional spec for the live-shell
"agent conversations" surface; the shell-builder and Astra
conform to it through `shell-inputs/INDEX.md`.

**Scope:** this document is the *messaging-mechanics layer* — the five
turn-life behaviours and their exact framing. The agent system itself
(identities, management plane, multi-agent collaboration, presence, UI/UX
patterns, screenshot evidence) is decoded in **`AGENT-SYSTEM.md`** in this
directory; read both.

**Target:** Buzz Desktop 0.5.20 (`xyz.block.buzz.app`), installed at
`/Applications/Buzz.app`. Buzz is Block's Apache-2.0 open-source Nostr
workspace where humans and AI agents share channels
(github.com/block/buzz). The desktop app embeds a Rust agent harness,
`buzz-acp`, which subscribes to channels on an encrypted Nostr relay and
bridges inbound @mentions to local coding-agent processes over JSON-RPC
(Agent Client Protocol plus per-agent extensions).

**Evidence base — every claim below is source-anchored and binary-verified:**

- Binary: `buzz-acp` arm64, sha256
  `2356ed0661a1ad0b5641ad09bdaed52d9285cf21913464c3f6ec37be9b57197c`.
- Source pin: commit `95154bee` (tag `desktop-v0.5.20`, 2026-08-25). Pin
  verified against the binary's embedded panic locations: `queue.rs:815`
  (queue-cap warn), `acp.rs:681` ("session created"), `config.rs:985`
  (turn-timeout deprecation warn), `lib.rs:4665` ("agent initialized").
- Decompile: `decompiled-targets.c` in this directory — 100 functions,
  including the 13 targets of the original 2026-10-07 run at identical
  addresses (`ObserverPublishQueue_ingest@0x10024ec18`,
  `send_steer@0x10011fb80`, `build_acp_steer_params@0x10013c0a8`,
  `build_goose_steer_params@0x10013da64`, `dispatch_pending@0x10024aa88`,
  `dispatch_heartbeat@0x10024ca1c`, …). Binary-string evidence is quoted
  verbatim where it carries the claim.
- Method: Ghidra 12.1.4 headless, one analysis pass
  (`ghidra_scripts/DecompileMessaging.java`, log `ghidra-headless-redo.log`).

---

## Behaviour 1 — Queue (how mentions wait while an agent works)

`crates/buzz-acp/src/queue.rs` implements a per-channel event queue; the
state machine is documented in source at `queue.rs:90-137`.

- **Per-channel FIFO, capped.** `MAX_PENDING_PER_CHANNEL = 500`
  (`queue.rs:24`). On overflow the oldest event is dropped and the new one
  appended (`queue.rs:242-247`; binary string: *"queue depth cap reached —
  dropped newest event to enforce cap"*).
- **One in-flight turn per channel.** `in_flight_channels` +
  `in_flight_deadlines`; a channel whose turn outlives its deadline is
  auto-expired so the queue cannot deadlock (*"in-flight expiry recovered
  withheld steer event(s)"*).
- **Dispatch order is fairness-by-age:** `flush_next()` expires stuck
  in-flight entries, then picks the channel with the oldest head event,
  drains up to `MAX_BATCH_EVENTS` into a `FlushBatch`, and marks the
  channel in-flight (`queue.rs:104-127`; decompiled
  `dispatch_pending@0x10024aa88`).
- **Failure path:** failed batches requeue at the *front*, preserving
  received order, with exponential backoff — `BASE * 2^(attempt-1)`,
  capped, ±20% jitter — tracked per channel, dead-lettering after
  `MAX_RETRIES` (`queue.rs:448-472`; binary strings: *"requeueing failed
  batch with backoff"*, *"dead-lettering batch immediately"*, *"re-queued
  with +5s penalty"* after reconnect).
- **Dedup modes:** `DedupMode::Queue` (store; default) vs
  `DedupMode::Drop` (discard events arriving during the cancel-drain
  window). All mid-turn handling modes require `Queue` — see Behaviour 3.
- The **relay observer** path (encrypted frames published back to the
  relay) has its own bounded queue with a byte budget:
  `ObserverPublishQueue` (*"observer publish queue over byte budget;
  dropped oldest events"*; decompiled `ObserverPublishQueue_ingest@0x10024ec18`,
  `ObserverChunkCoalescer_push_pending@0x1002547a8`,
  `batch_envelope@0x10024a420`).

## Behaviour 2 — Steer (mid-turn message injection, the default)

Steering is the **default** mid-turn path (`MultipleEventHandling::Steer`):
a new @mention does not wait; it is delivered into the running turn.

- **Capability discovery:** the agent's `initialize` result is probed for
  `_meta.steering.supported` (`acp.rs:616-617`), stored as
  `steering_supported`. Buzz announces `_meta.goose` client capability so
  goose emits its custom session-update notifications (`acp.rs:397-405`).
- **Transport precedence** (`acp.rs:1400-1450`, the decision tree):
  1. `active_run_id` present → **goose-native steer**
     `_goose/unstable/session/steer` with `expectedRunId`
     (`build_goose_steer_params@0x10013da64`); run id wins because
     `expectedRunId` is strictly more precise about *which* run is
     steered.
  2. No run id + `steering_supported` → **cross-adapter steer**
     `_session/steering`, params `{sessionId, prompt}`
     (`build_acp_steer_params@0x10013c0a8`); shipped by claude-agent-acp
     and codex-acp.
  3. No run id + no capability → ack `ExpectedRunIdMissing`; the main
     loop falls back to **cancel+merge** (Behaviour 3's framing).
  - Probing unknown methods is *forbidden* by design: codex-acp answers
    unrecognized extension methods with `{}` — a JSON-RPC success — which
    would be read as a delivered steer and silently drop the user's
    message (`acp.rs:1436-1444`). `send_steer@0x10011fb80` +
    `record_successful_steer@0x100120434` carry the wire write and
    ledger.
- **Steer outcomes** (ACP extension): `injected` — the steered turn keeps
  running, hard deadline renewed (*"steer success: renewed hard
  deadline"*); `startedNewTurn` — the awaited turn had already finished
  and the steer began a fresh one; still a delivery success but must not
  renew the deadline (`acp.rs:372-382`). Reject/ack strings: *"steer
  accepted as …"*, *"steer rejected: … returned unrecog[nized]"*,
  *"non-cancelling steer ack received"*.
- **Delivery ledger:** while a steer is in flight the triggering event is
  *withheld* from the normal queue, so it cannot double-deliver
  (*"native steer accepted by read loop but event was not in queue to
  withhold"*; *"steer ack never arrived; normal dispatch will deliver"*);
  the steer receiver is single-consumer (*"stacking receivers would
  misroute steer requests across turns"*; *"install_steer_rx: previous
  turn's receiver was not consumed"*).
- **Heartbeat / liveness:** an idle agent is kept or re-prompted by a
  heartbeat self-prompt distinct from user turns
  (`dispatch_heartbeat@0x10024ca1c`; config `turn-liveness-secs` /
  `BUZZ_ACP_TURN_LIVENESS_SECS`, heartbeat prompt text/file). Turn guards:
  `turn_timeout`, `max_turn_duration`, proactive session rotation at
  `max-turns-per-session` (outcome ledger: `PromptCompleted | Cancel |
  Interrupt | Steer | Rotate | SwitchModel`).

## Behaviour 3 — Interrupt (cancel + supersede re-dispatch)

`crates/buzz-acp/src/config.rs:63-88` — `MultipleEventHandling`:

- **`queue`** — events wait until the current turn completes (the
  original behaviour).
- **`steer`** (default) — cancel+re-prompt via the steer path above;
  frames the new mention as *arrived mid-task*.
- **`interrupt`** — for ANY new @mention: cancel the in-flight turn and
  re-dispatch a merged prompt framed as **supersede** (new replaces old).
- **`owner-interrupt`** — interrupt only when the new @mention is from
  the agent's owner (resolved via `owner_cache`); all other authors queue.
- Constraint: every non-queue mode **requires `--dedup=queue`** — Drop
  mode would discard events during the cancel-drain window and produce
  incomplete merged prompts (config validation; binary string verbatim).
- **Framing is exact and tested** (`queue.rs:1719-1738`):
  - Steer merge: `"[What you were working on]"` +
    `"[New message — arrived while you were working]"` + closing note
    *"Note: A new message arrived while you were working. Continue your
    in-progress work and incorporate the new message if it's relevant; if
    it's unrelated, you may briefly acknowledge it and carry on."* — and
    unit tests assert steer prompts must **not** contain "supersedes"
    (`queue.rs:2046-2068`).
  - Interrupt merge: `"[Previous request — interrupted before
    completion]"` + `"[New request — supersedes previous]"` + closing
    note *"Note: The previous request was interrupted. Please address the
    new request. If the new request is unrelated to the previous one, you
    may briefly acknowledge the interruption."*
- `session/cancel` is terminal and returns nothing — the merged prompt
  carries the **original request text**, never a captured partial
  transcript (`queue.rs:1720-1723`).
- Stop reasons parsed from the agent (`StopReason_from_str@0x10013b020`):
  `EndTurn | Cancelled | MaxTokens | MaxTurnRequests | Refusal`.

## Behaviour 4 — Diff review (how agent edits meet human judgement)

- **Agent file edits → diff cards.** Agent-session tool items with
  `renderClass: "file-edit"` are parsed into per-file diffs —
  add/remove/context lines, Shiki `//!code ++/--` markers recognised —
  by `desktop/src/features/agents/ui/agentSessionFileEditDiff.ts:31+`
  (`buildFileEditDiff`), rendered in the transcript with
  additions/deletions summaries.
- **Diffs as message cards.** `DiffMessage.tsx` renders a unified diff as
  a rounded card with repo URL, file path, commit sha (7-char short sha,
  deep link `{repoUrl}/commit/{sha}`), truncation flag and expand-to-full
  viewer (`DiffMessageExpanded.tsx`, `DiffViewer.tsx` + CSS, syntax
  highlighted via `parseDiff.ts`). The shipped binary carries the built
  chunks (`DiffMessage-*.js`, `DiffViewer-*.css`, `file-diff-*.js`).
  Diffs auto-truncate at 61,440 bytes at a hunk boundary; content max
  65,536 bytes (binary string).
- **Approval machinery is protocol-level.** Workflows carry
  `request_approval` steps routed to a named approver with timeout and
  approved/denied branches (`crates/buzz-workflow/src/schema.rs:397,
  435-437`); messages, patches, reviews, workflow steps and approvals are
  signed events on the self-hosted relay.
- **Owner gate on agent write-outs.** Agent draft/PR commands only open
  an *owner-reviewed Desktop draft* (`{request_id, action, saved:false}` —
  binary string); merge flows enforce owner identity (*"Repository
  address does not match the repository owner."*, *"Managed agent key
  does not match the repository owner."*, *"Only the owner identity or
  the owner of its managed agent can perform this action."*).
- **Permission requests.** ACP `session/request_permission` is handled by
  the harness: configured auto-approve uses `allow_once` (*"auto-approving
  permission id=… with allow_once option"*), falls back to `reject_once`
  when no such option exists, and pending permissions are cancelled on
  turn end (*"responded cancelled to pending permission"*). The Grok
  preset sidesteps the prompt entirely: `grok agent --always-approve
  stdio` (`desktop/src-tauri/src/managed_agents/discovery/presets.rs:121-128`).

## Behaviour 5 — Return (composer send semantics)

- **Plain Enter submits the message**; **Shift+Enter inserts a hard
  break** (`desktop/src/features/messages/lib/useRichTextEditor.ts:251,
  446-449`, Tiptap/ProseMirror keymap).
- `smartShiftEnter` splits list/blockquote nodes instead of submitting
  (`useRichTextEditor.ts:355-358, 417`), and a dedicated code-fence Enter
  handler (`handleCodeFenceEnter`, line 39) keeps Enter inside a fence
  from submitting.
- Submission runs through the mention send flow
  (`sendMessageWithMentionFlow`, `MessageComposer.tsx:625`) — agent
  addressing is resolved before send.

## The "Grok" in the lane name

Buzz's managed-agent discovery ships a **Grok Build** preset: id `grok`,
command `grok agent --always-approve stdio`, docs at build.x.ai
(`discovery/presets.rs:121-128`). Sibling presets: Devin (`devin acp`),
Cursor (`cursor-agent`), Oh My Pi (`omp acp`), OpenCode, Kimi Code
(`kimi acp`), Amp (`amp-acp`), Hermes Agent (`hermes-acp`), OpenClaw.
Agent-side steering support is adapter-dependent — Grok Build's stdio
mode advertising `_meta.steering.supported` is an **open item** (would
need a live adapter run to confirm; the harness side accepts either
answer and falls back per Behaviour 2).

## Shell adoption notes

- Adopt the whole queue/steer/interrupt model **harness-side**; the UI
  surface only needs turn state, typing indicator, and the queue —
  Buzz's own UI adds no queue chrome.
- Take the framing strings verbatim (Behaviour 3); they are
  behaviour-tested upstream and carry the semantics ("continue" vs
  "supersede") the agent actually obeys.
- Licence gate: Apache-2.0 — permissive; preserve notices and attribution
  when adopting code-shaped parts. The framing text and state machine are
  the spec; reimplementation in the shell's own idiom is expected.

## Ported (29 Oct, O-I #741 lane AC)

- **Steer and queue (Behaviours 2–3)** into AIKit's Communiques: `aikit gateway send --handling queue|steer` records where the words land
  (`aikit.communique/v1` `handling`, absent = queue). A queue waits for the occupant's next prompt, as every Communique did; a steer rides the
  running turn at the occupant's next tool call (`PostToolUse`), framed in Buzz's steer words verbatim, wherever the harness carries context
  on that event, and falls back to the next prompt elsewhere. Buzz's rule against reading an unknown-request success as a delivered steer is
  kept: a gateway that does not advertise `communique-handling` is never handed a steer, and one that answers without it is refused.
  Messages binds the Thread's Input to it.
- **Return (Behaviour 5)** into the Thread's composer (Messages' Full and the Agent's): Enter sends, Shift+Enter breaks the line, and Enter
  inside an open ``` block breaks it too.
- Judged out, with reasons, in the lane's return on #741: interrupt and owner-interrupt, the queue cap that drops, fairness-by-age, the
  heartbeat self-prompt, the cancel+merge fallback, diff cards, permission auto-approval, typing and presence.

## Evidence index

```
2026-10-07-buzz-grok-agent-messaging-re/buzz-messaging/
├── CONTRACT.md                  this file
├── decompiled-targets.c         100 functions, 13/13 original targets at identical addresses
├── candidate-names.txt          696 messaging-relevant demangled symbols
├── ghidra-headless-redo.log     2026-10-08 run (one-pass analysis + decompile)
├── ghidra_scripts/DecompileMessaging.java   the regenerated post-script
└── ghidra-headless-{full,java,java2,names,byaddr}.log   surviving 2026-10-07 logs
```

Source tree used for anchors: `/tmp/buzz-re-20261008/buzz-src` @ `95154bee`
(shallow clone of github.com/block/buzz; scratch discipline — not part of
the landing).

**Open items:** Grok Build steering advertisement (needs live adapter);
mobile app out of scope; `buzz-agent` crate (goose-like) not decoded —
same family as buzz-acp, expected to reuse the steer methods
(`_goose/unstable/*`).
