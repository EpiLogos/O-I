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
