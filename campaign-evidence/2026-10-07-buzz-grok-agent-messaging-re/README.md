# buzz-grok-messaging-re — findings landing path

This is the landing path for further findings from the Buzz/Grok
agent-messaging RE lane (see `LANDING-REGISTER.md`, other-app RE lanes).

**Decodes of record:** the Buzz agent system and UI/UX (identities,
management plane, multi-agent collaboration, presence, screenshot-driven
UI inventory) at
[`../2026-10-07-buzz-grok-agent-messaging-re/buzz-messaging/AGENT-SYSTEM.md`](../2026-10-07-buzz-grok-agent-messaging-re/buzz-messaging/AGENT-SYSTEM.md);
the messaging mechanics (queue, steer, interrupt, diff-review, Return) at
[`../2026-10-07-buzz-grok-agent-messaging-re/buzz-messaging/CONTRACT.md`](../2026-10-07-buzz-grok-agent-messaging-re/buzz-messaging/CONTRACT.md),
alongside the regenerated decompile (`decompiled-targets.c`, 13/13
original targets at identical addresses) and pinned-source anchors
(commit `95154bee`, tag `desktop-v0.5.20`). The Grok half — **Grok
Bot**, xAI's own desktop agent app on the Anysphere/Cursor stack — is
decoded separately at
[`../2026-10-08-grok-bot-re/DECODE.md`](../2026-10-08-grok-bot-re/DECODE.md).

Provenance: the 2026-10-07 campaign's outputs were lost in the
campaign-evidence move (only Ghidra logs survived); the decompile was
regenerated and the behaviours contract written on 2026-10-08 after the
owner flagged the gap. Buzz is Block's Apache-2.0 open-source Nostr agent
workspace (github.com/block/buzz); "Grok" enters through the shipped
**Grok Build** preset (`grok agent --always-approve stdio`).

New findings from this lane land here.
