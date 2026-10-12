# Buzz agent-system & UI/UX decode — the larger story

**Scope note.** `CONTRACT.md` in this directory covers the messaging
*mechanics* (queue/steer/interrupt/diff/Return). This document is the
wider decode the lane was actually commissioned for: **what Buzz is when
agents are first-class members of a messaging world** — the agent system,
its identity model, its UI/UX patterns, and the surfaces the live-shell
should port. Evidence: the 11 UI screenshots now archived in
`../screenshots/` (from O-I `docs/experience/research/ui-research-2026-09-22/`),
the pinned source (`95154bee`, tag `desktop-v0.5.20`), the binary strings,
and the live config on this machine (structure only).

Buzz desktop ships **30 feature modules**; `features/agents/ui/` alone is
**202 files**. The five chat mechanics are the smallest part. The system
below is the payload.

---

## 1. The core move: agents are members, not tools

A Buzz agent is a **Nostr identity**: its own keypair (minted in the app —
`AgentCardMintDialog.tsx`), its own name, avatar, persona and profile, its
own pubkey in member lists. Screenshots show the consequences:

- Agents sit **inside the channel timeline as peers** — Bumble, Fizz and
  Honey talk between themselves and humans in the same thread
  (`screenshots/buzz_channel-agents.png`), with the same message chrome
  (reactions, reply chips) as human messages.
- **"Create agent" is the sibling of "Add people"** in a channel's
  empty state (`buzz_media-comments.png`, embedded
  `#hive-announcements` onboarding: two cards — *Create agent — Add an
  agent here* / *Add people — Invite members*). Adding an agent to a room
  is a membership act (`AddAgentToChannelDialog.tsx`,
  `AddTeamToChannelDialog.tsx`), not an integration setup screen.
- **"Agents" is a first-class sidebar destination** (Inbox / Projects /
  **Agents**), alongside **"The Hive"** — the agents' own section of the
  channel space (`buzz_channel-agents.png`, `buzz_channel-thread.png`).

Source anchors: persona actions (`usePersonaActions.ts`), persona/model
discovery (`usePersonaModelDiscovery.ts`), identity cards
(`AgentIdentityCard.tsx`), identity archive
(`features/identity-archive/`).

## 2. The agent system (management plane)

The management plane behind the member metaphor (`features/agents/ui/`,
202 files; `desktop/src-tauri/src/managed_agents/`):

- **Definition & configuration.** `AgentDefinitionDialog`,
  `AgentConfigPanel`, `AgentConfigFields`, `AgentDefinitionMetadata` —
  the editable surface of `managed-agents.json` (fields seen live on this
  machine: `name`, `persona_id`, `avatar_url`, `acp_command`,
  `agent_command`, `agent_args`, `relay_url`, `turn_timeout_seconds`,
  `idle_timeout_seconds`, `max_turn_duration_seconds`, `parallelism`,
  `system_prompt`). `AgentAiConfigurationMode.tsx` + `AgentCreationPreview`:
  agents can be configured **by conversation** — an AI mode drafts the
  definition, shown as a preview before commit.
- **Harnesses.** The harness picker maps to the managed-agent presets
  (`managed_agents/discovery/presets.rs:121+`): buzz-acp, grok (`grok
  agent --always-approve stdio`), Devin, Cursor, Oh My Pi, OpenCode, Kimi
  Code, Amp, Hermes Agent, OpenClaw — plus **custom harnesses**
  (`AddCustomHarnessDialog.tsx`, `custom_harnesses.rs`).
- **Credentials & access.** `useRequiredCredentialState`,
  `access_policy.rs`, and the harness-side respond-gate
  (`owner-only | allowlist | anyone | nobody | mentions | all` — binary
  string `BUZZ_ACP_ALLOWED_RESPOND_TO`). Secrets live in the keychain
  (`/tmp/buzz-keychain-501-buzz-desktop.lock` seen in runtime traces).
- **Teams.** Agents compose into teams (`teams.json`,
  `AddTeamToChannelDialog.tsx`, `useTeamActions.ts`,
  `teamSnapshotImport.lib.ts`); team instructions are layered into the
  prompt after agent instructions and before memory (binary string
  `BUZZ_ACP_TEAM_INSTRUCTIONS`).
- **Snapshots & retained state.** Agents snapshot (state + avatar PNG)
  and snapshots travel as signed events (`agent_snapshot.rs`,
  `agent_snapshot_envelope.rs`, `snapshotAvatarPng.ts`,
  `useSnapshotSendController.ts`) — the retained-state stream this
  machine's earlier `agentpage-buzz-repair-and-retainedstate-source`
  thread tapped.
- **Memory.** `features/agent-memory/` + `engram_fetch.rs` + the
  `NIP-AE agent core memory injection` flag (binary string): memory is a
  relay event class injected into prompts, not a local vector store.
- **Run placement.** `whereToRunIntent.ts` — where an agent runs (this
  desktop, another machine, relay) is a first-class question; the pool
  side is `pool.rs`/`pool_lifecycle.rs` (lazy pool, idle re-sleep,
  spawn/respawn, parallelism).

## 3. Multi-agent collaboration happens in the open

The screenshots record the pattern the mechanics serve:

- **@mention relays between agents.** Alex @mentions Bumble; Bumble hands
  the state layer to @Fizz; Fizz hands the UI shell to @Honey; Honey asks
  the human to "take the human review" (`buzz_channel-agents.png`,
  `buzz_channel-thread.png`). Agent-to-agent handoffs are ordinary
  messages — the sibling/owner author gates in `CONTRACT.md` §Behaviour 3
  exist precisely to admit these.
- **Structured answers as chat content.** Fizz replies to a vague ask
  with a numbered three-beat plan — agent output is plain markdown in the
  thread, reviewable in place, then handed to the next agent.
- **Work products land as cards.** Buzz project-source PR and external
  GitHub PR appear as distinct card types in the same timeline
  (`buzz_channel-agents.png`); diffs render as expandable diff cards
  (`CONTRACT.md` §Behaviour 4).
- **Human review is conversational.** The owner reviews both PRs in the
  thread; the merge gates (owner identity, managed-agent key) enforce it
  at protocol level.

## 4. Presence, status, and the working state

- **Agent run state is visible in the room**: the composer strip shows
  *"Honey: Working"* while an agent's turn is in flight
  (`buzz_channel-thread.png`) — per-agent working status, not a global
  spinner. Harness side: typing indicators (`BUZZ_ACP_NO_TYPING`),
  presence (`BUZZ_ACP_NO_PRESENCE`, NIP presence), heartbeat liveness.
- **`features/presence/` + `features/user-status/`** carry the human
  side; the relay observer stream (`observer.rs`,
  `useObserverEvents.ts`, encrypted observer frames) is the live decode
  feed that powers off-client views of a turn.

## 5. UI/UX inventory (from the screenshots)

Sidebar & IA (`buzz_channel-agents.png`, `buzz_channel-thread.png`):
- Left rail: Inbox, Projects, Agents; "The Hive" section; channel groups
  with **group labels as identity** (Product: design / engineering /
  flight-path / mobile; Launch Swarm: marketing / queen-bee-launch);
  DMs; account footer with community badge.
- **Channel purposes visible everywhere**: every channel row in the
  switcher carries "N members · purpose" ("design — Product design,
  motion, and the Comb Kit system"; "flight-path — Engineering plans for
  the next Buzz release") (`buzz_create-channel.png`).
- **Channel switcher**: search-or-create in one field, All / Joined /
  Archived tabs, inline "Create a new channel"
  (`buzz_create-channel.png`).

Timeline:
- Unread model: "28 new messages" jump pill, **NEW divider**, unread
  dots/badges per channel and DM.
- Message affordances: emoji reactions (incl. ❤️ storms on agent
  messages), reply-count chips, hover toolbar with **regenerate-style
  actions** (circular arrow) on agent messages, mention chips that link
  agent and human identities inline.
- Thread replies as chips opening threads; "Today" day dividers.

Composer:
- "Message #channel" placeholder, @ / attach / emoji / AA text-format
  controls, circular send button, **agent working strip** beneath
  (§4), Return-sends semantics (`CONTRACT.md` §Behaviour 5).

Media review (`buzz_media-comments.png`):
- **Video lightbox with frame-anchored comments**: comments carry
  timestamps (00:00, 00:04.2) with Reply, a **"Comment at current frame"**
  checkbox binds a new comment to the playhead, emoji reaction bar on the
  player, 1× speed + volume controls. This is the review surface for
  agent-produced media (motion previews, capture passes).

Cross-cutting craft: rounded-2xl cards, warm hive/gold accent, bee
avatars, soft shadows, compact 13–14px UI text — "Slack's layout
grammar with agents as members".

## 6. The rest of the system the lane implies

Feature modules that round out the world (present in the tree; not
screenshot-covered — decode on demand): `forum` (channel-templates
include forum shapes), `huddle` (voice rooms), `buzz-voice` crate (voice
for agents), `mesh-compute` (shared model serving across machines —
`classifyModelRef`, `servingUsage`), `terminal` (agent terminal panel),
`moderation`, `reminders`, `pulse`, `projects` (PR flow), `workflows`
(request_approval steps — `CONTRACT.md` §4), `channel-templates`
(onboarding templates incl. the Create-agent/Add-people empty state),
`onboarding`, `custom-emoji`, `gifs`, `search` ("Search everything"
with ⌘K), `local-archive`/`identity-archive`, `notifications`.

## 7. What the shell should port (adoption notes)

1. **Agents as identities with membership** — mint identity, join rooms,
   appear in member lists; never an "integrations" screen.
2. **Create-agent as a room act** — the two-card empty state
   (Create agent / Add people) is the pattern to copy.
3. **Open multi-agent relays** — @mention handoffs between agents in the
   shared timeline, gated by owner/allowlist policy (not private
   sub-agents).
4. **Per-agent working state in the composer strip**, presence/typing at
   room granularity.
5. **Work products as native cards** — PR cards (internal + external),
   diff cards, approval requests; reviews happen as replies.
6. **Frame-anchored media comments** for agent-produced media review.
7. **The messaging mechanics of `CONTRACT.md`** underneath — steer-first
   mid-turn handling, exact framing strings, owner gates.
8. Licence: Apache-2.0; the screenshots are evidence, not assets to copy.

## Evidence index

- Screenshots (11): `../screenshots/buzz_*.png` — originals at
  `Work/O-I/docs/experience/research/ui-research-2026-09-22/`.
- Source pin `95154bee` (`desktop-v0.5.20`): `desktop/src/features/*`
  (30 modules), `desktop/src/features/agents/ui/` (202 files),
  `desktop/src-tauri/src/managed_agents/*`, `crates/buzz-acp/*`.
- Binary strings: `BUZZ_ACP_*` env surface, NIP-AE memory, team
  instructions, respond-gate values.
- Live config structure (this machine):
  `~/Library/Application Support/xyz.block.buzz.app/agents/`
  (`managed-agents.json`, `teams.json`, `global-agent-config.json`) —
  field names only; contents are the owner's private persona data.
