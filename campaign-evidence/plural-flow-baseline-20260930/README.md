# Plural Flow baseline replay — Omarchy (host `frank`), 30 September 2026

Factory commission `commission:plural-flow-558-20260930`, run `run:01M3RRNJM0T0E369SS6PMS4FW4`
(O-I `.factory/development-state.json`), workflow-unit `omarchy-baseline-replay`,
position `central:position:project:O-I:workcell-guardian`.

Scope: PF0 baseline replay against the **currently installed** encounter owner on
frank — not a source reading. The case definitions come from
`docs/experience/PLURAL-FLOW-SPEC.md` and the Wayfinder map
`.wayfinder/maps/plural-flow-now.md` §6.3 and §3 (MP04, MP06, MP11), fetched from
`origin/feat/plural-flow-20260930` (frank's O-I checkout stands on `main` and does
not yet carry them; nothing was switched).

## Installed revisions and standing owner state found (not mutated)

| Thing | Value |
|---|---|
| aikit | `0.1.0 (eeaab031bd94)` |
| ctrl | `0.1.0 (8b2ab9d84892)` |
| O-I checkout at investigation | `main` @ `36c9e411` (behind origin/main by 1) |
| Resident encounter owner | protocol `aikit-encounter-v1`, pid 1923289, started for this investigation via `aikit session-space encounter-start` |
| Encounters DB | `~/.aikit/state/encounters.sqlite3` (inspected strictly read-only) |
| Configured providers (standing, untouched) | `pi` (pi-rpc, `pi --mode rpc --model glm-5.3-flash`, zai gateway chat), `oi-live-walk-pi` (pi-rpc), `oi-live-walk-codex` (ACP, `INITIAL_AGENT_MODE=read-only`) |
| Standing encounter state predating this run | session `agent-session/nara-source-verifier-20260928` with two `returned` deliveries (cursors 79–3215, 3216–4308) and an `owner-shutdown-completed` event — proof the owner has completed real returns before, on provider `pi` |

## Throwaway state created (clearly named, inside commission custody)

- SessionSpace `session-space/pf-baseline-inv` (create/apply receipt-backed).
- Agent sessions `agent-session/pf-baseline-inv-1`, `-2`, `-3`, attached to that
  space, each opened against the **standing** provider `pi` (cwd `/tmp/pf-baseline-inv`).
- Native Agency bindings minted per session via `encounter-agency-mint`
  (project identity O-I): revisions `rev/aikit-mint-1790764658-bf85` (s1),
  `rev/aikit-mint-1790764664-6f7f` (s2), `rev/aikit-mint-1790764770-8e8d` (s3);
  all resolve to agent `agent/o-i-chat` under `agency:aikit-mint-o-i-dbfb08f7`,
  sender `human:owner` allowed. Addressed delivery refuses without an agency
  binding (`encounter.agency_required`) — the agency mint is the installed
  admission path.
- Deliveries: `delivery/pf-baseline-inv-*`, `delivery/pf-case1-*`, `delivery/pf-case2-*`.

## What was run

1. **One-to-one baseline** (spec §0.1/§6.3): addressed `send` to s1,
   `delivery/pf-baseline-inv-q1`, "Reply with exactly the token PONG1-ALPHA".
   Result: `submitted` (first_cursor 4313) → `returned` (terminal_cursor 4328);
   journal shows per-chunk streaming (`P`,`ONG`,`1`,`-`,`AL`,`PHA`), a
   `agent-message-segment 'PONG1-ALPHA'`, `completed stop_reason=stop`, `TurnEnded`
   with first/last sequence. **PASS.**
2. **Controlled two-recipient attempt** (MP11 addressed / spec §3.2):
   `send-group` `delivery/pf-baseline-inv-group1` to s1+s2, one logical request
   (≈120-word workcell question, told to end with `GROUPSIG` + random suffix).
   Owner answered `atomic_fanout: false` with **two per-recipient rows**:
   s1 4330–4695, s2 4334–4529, both `returned`. While in flight, an unrelated
   question went to independent s3 (`delivery/pf-baseline-inv-qx-unrelated`,
   4354–4371) — its reply `QX-GAMMA-7741` landed **inside** the group's cursor
   span, yet each row kept its own reply: `GROUPSIG-K7QT` (s2) vs `GROUPSIG-QKZT`
   (s1) — two distinct bodies, correctly attributed. All reading clients were
   closed during the flight; reconnecting found every row intact. **SUCCESS** on
   the native owner.
3. **Case 1 — wrong-request discrimination** (MP04): see
   `scripts/case1-wrong-request.sh`, transcript `raw/case1-observed-output.txt`.
   An unrelated/newer reply must NOT satisfy the wrong request.
   **PASS**: while QA was in flight, a second addressed send to the same session
   was refused (`encounter.delivery_pending` — the §6.3 one-active-delivery rule:
   serialize, never guess); after QA returned, QB took its own row and disjoint
   cursors; QA's readback stayed `returned 4696-4712`; segment 4707 is
   `TOKEN-ALPHA-9042` and no `TOKEN-BETA-5117` exists inside QA's range.
4. **Case 2 — delayed return exactly once after UI closure** (MP06): see
   `scripts/case2-no-ui-return-once.sh`, transcript `raw/case2-observed-output.txt`.
   **PASS**: `delivery/pf-case2-qd2` accepted (first_cursor 4937), all clients
   closed, 45 s detached, reconnect found `returned 4937-5131`, two fresh-client
   readbacks identical, the 863-char answer (ending `TOKEN-DELTA-3311`) inside
   the row's cursors, exactly 1 row and 1 `TurnEnded`.

## Denominators

| Case | Behaviour | Result |
|---|---|---|
| baseline | one-to-one addressed send returns with streaming + terminal row | PASS (1/1) |
| two-recipient | one `send-group` → two distinguishable per-recipient rows, distinct bodies, closure-safe, unrelated reply not confused | SUCCESS (1/1) |
| case 1 | newer/unrelated reply never satisfies the wrong request; same-session concurrency serializes | PASS (1/1) |
| case 2 | delayed reply returns exactly once, retained across full client closure, no turn restart | PASS (1/1) |

## What the installed owner does NOT yet do (boundary findings, from behaviour)

- **No durable request entity spanning recipients**: `send-group` fans out to
  per-session delivery rows that share only the caller's `delivery_ref` string;
  there is no native conversation-request record binding recipients, roster
  revision or basis (matches Wayfinder §6.3 item 2).
- **Nothing native consumes a `returned` delivery**: every readback here was
  performed by an operator query; no reply reducer / incorporation step ran
  (§6.3 item 3). The Flow inclusion path is not exercised by the installed owner.
- **Cursor ranges of concurrent recipients overlap** in the single journal
  (4330–4695 vs 4334–4529), so range alone does not discriminate — attribution
  rests on the per-(session, delivery) row key plus `delivery_ref`/
  `connection_generation` on each event. Sufficient for the owner's own
  correlation; a Flow document still needs the §6.3 output-identity mapping.
- **Addressed delivery requires a minted Agency binding** even for a plain
  `human:owner` send (`encounter.agency_required`), and the packet audience must
  name the agent ref (`encounter.disclosure_denied` for a `human:owner`
  audience on these bindings).
- **No provider turn/output identity** beyond the recorded delivery→cursor
  mapping (§6.3 item 1 decision) — consistent with what we observed; nothing in
  the rows carries a provider-side turn id.

## Files

- `scripts/case1-wrong-request.sh` — MP04-flavoured discriminating case.
- `scripts/case2-no-ui-return-once.sh` — MP06-flavoured discriminating case.
- `raw/delivery-rows-final.txt` — every delivery row this investigation created.
- `raw/final-segment-events.txt` — exact `agent-message-segment` events with
  cursor, session and text for each case's reply.
- `raw/baseline-q1-journal-4313-4328.txt` — full journal for the baseline delivery.
- `raw/case1-observed-output.txt`, `raw/case2-observed-output.txt` — run transcripts.

Scripts are reproducible against the installed owner provided the throwaway
sessions/binding revisions are substituted (they are parameterised at the top).
