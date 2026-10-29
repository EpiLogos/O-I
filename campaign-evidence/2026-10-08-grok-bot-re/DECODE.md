# Grok Bot RE — decode of record

**Landed:** 2026-10-08, owner direction ("grok bot is its own app — we
should equally have the decompile work from that too"). Companion campaign
to `2026-10-07-buzz-grok-agent-messaging-re/` (whose Buzz-side decode is
`../2026-10-07-buzz-grok-agent-messaging-re/buzz-messaging/`): this is the
**Grok** half, decoded as its own application.

## What Grok Bot is

**xAI's desktop agent client, built on Cursor's stack.** The app at
`/Applications/Grok Bot.app` (v0.68.1, installed 2026-10-06) is an
Electron application whose bundle identifier is `com.anysphere.sand` and
whose `package.json` reads `name: "sand"`, `author: "SpaceXAI"`,
`homepage: https://cursor.com`, description *"Grok Bot desktop agent"*.
Its dependency tree is the Anysphere (Cursor) agent platform re-aimed at
Grok: `@anysphere/agent`, `agent-client`, `agent-core`, `agent-exec`,
`agent-kv`, `agent-store-sync`, `agent-summarization`,
`agent-transcript`, `chat-inference`, `context`, `context-rpc`, …
(38+ workspace packages; full manifest in `asar-inventory/package.json`).

Official role (docs.x.ai/grok-bot, fetched 2026-10-08): persistent
**"AI teammates with names, jobs, and context that compounds over
time"** running on a **persistent cloud computer** in Cursor's
infrastructure — browser, filesystem, terminal per account; bots work in
parallel, each on its own screen. You **message** bots (typing,
dictation, voice); they post mid-task updates incl. **voice memos and
drafts awaiting approval**; **bots message each other**, share group
chats, and hand off task ownership. Workflows are learned **by
demonstration** and saved as scheduled skills; an X integration turns
@bot mentions into tasks.

## Architecture (from the asar + process layout)

```
app.asar (41 MB, extracted inventory in asar-inventory/)
├── dist/electron-main/        main.cjs, main-app.cjs, main-core.cjs, proto.cjs
├── dist/electron-preload/     preload.cjs + preload-vnc.cjs (computer-use
│                              view), preload-avatar-source.cjs (bot avatars),
│                              preload-desktop-mount-panel.cjs (local mounts)
├── dist/node-agent-coordinator/  local agent session coordinator
│                                 (sessionId/sessionBox/spawn_limit strings)
├── dist/local-exec-daemon/    local execution daemon: Executor/shell/git/
│                              workspace/github (local repo work executor)
├── dist/renderer/             the app UI (bundled, KaTeX etc.)
└── dist/deps/                 native modules (see below)
```

Native (decompiled here):

| Binary | sha256 | Functions decompiled | Role |
|---|---|---|---|
| `Grok Bot` (main exec) | `9c557efe…` | 9/9 | stock Electron launcher stub |
| `cursor_proclist.node` | `51583041…` | 148/148 | process listing (Anysphere native) |
| `sand_notification_settings.node` | `9bb3e005…` | 149/149 | notification settings (sand native) |
| `tree-sitter*.node` ×2 | — | skipped | stock upstream tree-sitter, no product logic |

Decompile method: Ghidra 12.1.4 headless, one pass per binary
(`logs/DecompileAll.java`, logs `logs/*.log`). Note the
`preload-vnc`/cloud-computer + `local-exec-daemon` split: bot work can run
on the Cursor cloud computer (streamed via the VNC-style preload) **or**
locally through the exec daemon against local git workspaces.

## Relation to the Buzz lane

- Buzz's managed-agent preset `grok` runs **`grok agent --always-approve
  stdio`** — the Grok *CLI* adapter. **Grok Bot is a separate, fuller
  surface**: xAI's own agent client with the Cursor agent stack beneath.
- Comparative ingredient set for the shell's agent surface: Buzz shows
  *agents as Nostr members of open human rooms* (relay-native, self-hosted,
  open protocols); Grok Bot shows *named persistent teammates on a cloud
  computer with bot-to-bot messaging, demonstrated skills, and approval
  drafts* (hosted, closed protocol). The shell takes the first's openness
  and membership model; the second's compounding-context/teammate framing
  and drafts-awaiting-approval UX are the patterns worth study
  (docs-level only — no hosted-protocol adoption).

## Turn runtime: how a turn's failure is classified (29 Oct, O-I #741)

Read from the installed app, 0.70.2 (`app.asar` sha256 `8dd7b6c4a58439d626a9a7b3766982b7c725db2bc1f6ff68a29fc1ec62ca4cf7`),
by reading the asar header and the bundled main process `dist/electron-main/main-core.cjs` (sha256
`3f39655cf1284f010567ce58422891ecc6ec26ef313430acc095c17147b7ef3a`). The bundle carries the app's error registry: 108 entries, each
with a code, a name, a domain, whether a retry helps, a one-line summary and the source predicate that raises it (`seededFrom`). The
turn runtime itself runs on the hosted box, so its code is not in the desktop bundle; the registry is its specification.

The agent domain, which is the turn client's classification (`turn-runtime.ts` `classifyAgentError`, `transient-stream-error.ts`):

| Code | Name | A retry | What it names (paraphrased) | Decided by |
|---|---|---|---|---|
| SAND-E0401 | providerOverloaded | helps | the model provider is at capacity or rate-limited | `isProviderCapacityError` |
| SAND-E0402 | firstTokenStall | helps | nothing streamed before the first-token deadline | `isFirstTokenStallError` |
| SAND-E0403 | streamReset | helps | the turn's stream dropped on a transient transport reset | `isTransientStreamError` |
| SAND-E0404 | contextWindowOverflow | does not | a context-window dead end a retry would repeat | `isContextOverflowDeadEnd` |
| SAND-E0405 | backendRejected | does not | a terminal structured error from the backend | `isRetryableProviderError` false |
| SAND-E0406 | turnRetryable | helps | retryable, outside every more specific shape | `isRetryableProviderError` true |
| SAND-E0407 | agentUnclassified | does not | outside every classified shape | the `classifyAgentError` fallback |
| SAND-E0408 | backendCapacityDeferred | helps | deferred at capacity with a server-paced retry-after, which the runner sleeps | `serverRetryAfterMsFromError` |
| SAND-E0414 | conversationTooLarge | does not | over the conversation-size cap until it is shrunk or a new conversation starts | `conversation-size-limits.ts` |
| SAND-E0415 | streamIdleStall | helps | a stream that had produced output went silent; cancelled so the step settles, re-entered from a checkpoint | `isStreamIdleError` |
| SAND-E0418 | turnBackendUnreachable | helps | the backend was never reached (a refused connect, an unresolved host) | `isBackendUnreachableError` |

The rule it encodes: a retry is offered only for a named cause a retry can clear, and a failure outside every named shape is terminal.
**Ported** into Factory's agent client (Factory `factory/src/agent_turn.rs`, read by `task_activity.rs` from AIKit's encounter status
`last_turn`, which ai-kit's `encounter_service.rs` now carries): a task whose last turn failed for a retryable cause is Stalled and lights
its retry, with the provider's pace when it named one; one whose turn ended where a retry repeats it is Stopped and says what to do instead.

Read and not ported (each judged in #741's lane AC return): the client send journal (`client/send/send-journal.ts`: SAND-E0703–E0707 —
an offline-queued send flushed with a nonce whose accepted digest must match, retired explicitly without delivery proof, and expired when
no authoritative echo arrives before its online ACK deadline), the transcript write-ahead journal (`transcript-mirror.ts`, SAND-E0720–E0725),
the local-exec bridge's provider liveness (SAND-E0111–E0115), and the coordinator's retry primitive (`dist/node-agent-coordinator/main.cjs`:
exponential delay `initial × factor^(attempt−1)` capped at `max`, jitter `none | equal | full` taking 0, ½ or all of the delay as its spread,
a server-named delay replacing the computed one).

## Evidence index

```
2026-10-08-grok-bot-re/
├── DECODE.md                 this file
├── decompiled/               grok-bot-main.c, cursor_proclist.node.c,
│                             sand_notification_settings.node.c
├── logs/                     one Ghidra headless log per binary + the script
└── asar-inventory/package.json   app manifest (name "sand", author "SpaceXAI")
```

**Open items:** renderer bundle not decoded (bundled JS, low value vs the
public docs); cloud-computer protocol not probed (hosted/closed — out of
adoption scope per the licence gate); no Buzz↔Grok Bot direct coupling
found on this machine (the `grok` preset targets the CLI, not this app).
