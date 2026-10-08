# Plural Flow two-Workcell conversation — Mac + Omarchy, 30 September 2026

Factory commission `commission:plural-flow-558-20260930`, run
`run:01M3RRNJM0T0E369SS6PMS4FW4` (O-I `.factory/development-state.json`),
episode clearing
`central:now:control:root:9c2d1597d728778b5999dd3cbb81df75907a453a66f6bdef5fff4e5d92fe89a3`.

Scope: one source-backed concern — **"In a multi-recipient conversation, what
must reply correlation rest on, and what breaks if an owner infers an answer
from recency (the newest assistant block) instead of durable delivery
identity?"** — answered by two actual agent bodies through the NATIVE
encounter owners of two Workcells, their replies returning through their own
Workcell's owner as native deliveries, correlated per (session, delivery) row:

- `contribution-mac.md` — the Mac participant (`workcell:mac`, session
  `agent-session/oi203-pf-mac-participant`) recovering the argument from
  Wayfinder map `.wayfinder/maps/plural-flow-now.md` §6.3 ("Request, turn and
  output identity", `origin/main` after PR 560) plus the delivery-lifecycle
  facts of the installed owner — which it verified itself, read-only, with
  tool calls against `~/.aikit/state/encounters.sqlite3` during its turn.
- `contribution-omarchy.md` — the Omarchy participant (`workcell:omarchy`,
  host `frank`, session `agent-session/oi203-pf-omarchy-participant`)
  answering from its own position inside a live conflicting-reply scenario
  executed against the installed owner there (see Verdicts).

Both bodies are verbatim reconstructions from `agent-message-*` journal
events between each delivery row's `first_cursor` and `terminal_cursor`.

## What ran, where

| Thing | Mac (workcell:mac) | Omarchy (workcell:omarchy, host `frank`) |
|---|---|---|
| aikit | `0.1.0 (eeaab031bd94)` | `0.1.0 (eeaab031bd94)` |
| Resident encounter owner | pid 61168, `-C /Users/admin/Central`, protocol `aikit-encounter-v1` (already running; not restarted) | pid 1923289, `-C /home/frank`, protocol `aikit-encounter-v1` (started earlier today; not restarted) |
| Provider used | `pi-plain` (pi-rpc, zai) — `pi` refused at open, see repairs | `pi` (pi-rpc, zai/glm-5.3-flash) |
| Encounters DB | `~/.aikit/state/encounters.sqlite3` (strictly read-only SQL) | same |
| Throwaway SessionSpace | `session-space/oi203-pf-mac` | `session-space/oi203-pf` |
| Throwaway sessions | `agent-session/oi203-pf-mac-participant` | `agent-session/oi203-pf-omarchy-participant` (s1), `-omarchy-peer` (s2), `-s3` |
| Agency mints (`agent/oh-i`, agency `agency:aikit-mint-o-i-744f0a98`) | `rev/aikit-mint-1790769172-dca0` | s1 `rev/aikit-mint-1790768449-be20`, s2 `rev/aikit-mint-1790768495-4d1c`, s3 `rev/aikit-mint-1790768473-8609` |

## Delivery refs table (every row `returned`)

| Workcell | session | delivery_ref | phase | cursors | reply |
|---|---|---|---|---|---|
| mac | agent-session/oi203-pf-mac-participant | delivery/oi203-pf-mac-a1 | returned | 17680–18008 | contribution A, ends `MACSIG-OI203-7K2M` |
| omarchy | agent-session/oi203-pf-omarchy-participant | delivery/oi203-pf-q1 | returned | 5132–5148 | `OI203-PONG-ALPHA` (sanity ping) |
| omarchy | agent-session/oi203-pf-s3 | delivery/oi203-pf-qx | returned | 5151–5169 | `QX-INTERLEAVE-9K2D` |
| omarchy | agent-session/oi203-pf-s3 | delivery/oi203-pf-qx2 | returned | 5170–5187 | `QX-INTERLEAVE-B3E8` |
| omarchy | agent-session/oi203-pf-omarchy-participant | delivery/oi203-pf-group1 | returned | 5188–5425 | contribution B, ends `GROUPSIG-OI203-4F7Q` |
| omarchy | agent-session/oi203-pf-omarchy-peer | delivery/oi203-pf-group1 | returned | 5192–5685 | second recipient body, same token |
| omarchy | agent-session/oi203-pf-s3 | delivery/oi203-pf-qx3 | returned | 5426–5442 | `QX-INTERLEAVE-C5A1` (the interleave) |

`send-group` `delivery/oi203-pf-group1` answered `atomic_fanout: false` with
two per-recipient rows sharing only the caller's `delivery_ref` — confirming
the baseline finding that no durable request entity spans recipients (§6.3
item 2 still unbuilt in the installed owner).

## Correlation verdicts

1. **Group fanout attribution — PASS.** One logical request to two recipients
   produced two distinct generated bodies; each landed only on its own
   (session, delivery) row; exactly one `TurnEnded` per row. The two row
   spans overlap (5188–5425 vs 5192–5685), so cursor range alone cannot
   discriminate — attribution rests on the row key plus the per-event
   `delivery_ref` / `connection_generation` carried on every journal event.
2. **Interleaved conflicting reply — PASS.** While both group replies were in
   flight, an unrelated short question to s3 was accepted at cursor 5426 —
   INSIDE the peer's row span [5192–5685] and immediately adjacent to the
   participant's span end (5425/5426). `QX-INTERLEAVE-C5A1` appears in s3's
   row only; neither group row contains any `QX-INTERLEAVE` token. A
   recency-inferring owner would have credited s3's reply to the peer session
   (its block was the newest at that instant); the row-based owner did not.
3. **UI closure loses nothing — PASS.** All reading clients were closed at
   11:50:36Z with the group replies still in flight; reconnect at 11:51:33Z
   found every row `returned` with full bodies reconstructable from the
   journal. The resident owner (pid 1923289, unchanged) held the turns;
   client closure was only an observer leaving.
4. **Mac one-to-one return — PASS (after provider repair).** The Mac
   participant's answer streamed as 310 `agent-message-chunk` events inside
   its own row cursors (17680–18008); `MACSIG-OI203-7K2M` is present only in
   that row. Its turn included read-only tool calls against the owner's own
   DB — the participant verified the row mechanics it argues from.

## Queued-row observation (§6.3 item 4, live)

The first send to a session with no resident native session stayed
`phase=queued` (row retained, `first_cursor` assigned, no dispatch) and
completed without resend the moment its session was explicitly opened. No
replay, no duplicate row. Queued rows are durable; an unknown external
dispatch is never blindly replayed.

## Failure + repair pairs

1. **Mac provider `pi` refused at open** — `agent_session_host.transport_closed`
   (its configured mcp-bridge target closed stdout). Repair: the SAME session
   opened against the standing provider `pi-plain` (pi-rpc); the same
   activity then completed.
2. **Send accepted but never dispatched** — `"This canonical encounter has no
   resident native session; explicit owner open is required"`. Repair:
   explicit `{"action":"open","space":…,"agent_session":…,"provider":…,"cwd":…}`
   per session; the queued row then dispatched and returned.
3. **`send-group` request shape** — three client-side schema refusals
   (`missing field delivery_ref`; `missing field recipients`; recipients as
   strings `expected struct EncounterGroupRecipient`) until the per-recipient
   struct form `recipients:[{"agent_session":…,"expected_binding_revision":…}, …]`
   was used — each recipient carries its OWN binding revision.
4. **`session_space.preview_stale`** — a hand-rebuilt SessionSpace create
   preview was refused at apply; passing the create command's exact output
   back through receipt-backed `apply` succeeded.

## Files

- `contribution-mac.md`, `contribution-omarchy.md` — the two contributions,
  verbatim from the journals.
- `raw/delivery-rows-mac.txt`, `raw/delivery-rows-frank.txt` — every episode
  delivery row per machine.
- `raw/mac-a1-chunk-events.txt` — the Mac reply's full chunk-event stream.
- `raw/group1-s1-segments.txt`, `raw/group1-s2-segments.txt` — message events
  inside each group row's cursors (frank).
- `raw/q1-full-events.txt`, `raw/qx3-full-events.txt` — full journal for the
  sanity ping and the interleaved reply.
- `raw/phaseB-readback.txt` — the reconnect transcript (rows, bodies,
  TurnEnded counts, verdict probes, interleave position, owner health).
- `raw/mac-env.txt`, `raw/frank-env.txt` — versions and clone revision.
- `scripts/` — the exact scenario scripts (`phaseA2.sh` sends + closes
  clients; `phaseB.sh` reconnects and reads; `body.sh` reconstructs verbatim
  bodies; `mac-body.sh` same on the Mac).

Nothing else was modified: both grounds read-only except the throwaway
`oi203-pf-*` session refs, their agency mints, and this evidence branch. The
Mac checkout was returned untouched (still on `unified-entry/oi-act-20260928`).
