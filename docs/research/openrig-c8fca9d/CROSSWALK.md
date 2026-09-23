# OpenRig → O:I behavioural crosswalk

## Source lock

| | |
|---|---|
| Repository | `https://github.com/mvschwarz/openrig` |
| Revision | `c8fca9d5c436e5357807e05254bf6735613eea3f` (merge of PR #20, 2026-09-23 13:00 -0700), package `openrig@0.5.14` |
| Licence | Apache-2.0 (`LICENSE` at the pinned revision). Reference study only: no OpenRig code is vendored or linked; nothing here is a runtime dependency. |
| Inspectable copy | detached checkout at `~/Central/worktrees/references/openrig` (`git -C … rev-parse HEAD` = the revision above) |
| Observed | 2026-09-23, from executable TypeScript source and tests (`packages/daemon`, `cli`, `tui`, `ui`); prose-only claims are marked as such |
| Reopen when | upstream changes seat/occupant identity, `current-work.ts`, `refocus.cjs`, the transport envelope, or the restore outcome vocabulary |

Why not `aikit source add-git`: that mechanism pins *Agent Skill* sources and validates every
`SKILL.md`; OpenRig's `packages/daemon/specs/agents/apps/vault-specialist/skills/vault-user/SKILL.md`
has no frontmatter, so it is correctly refused. A reference repository is not a skill source.

Governing O:I contract: [`docs/contracts/WORLD-INHABITATION-V1.md`](../../contracts/WORLD-INHABITATION-V1.md).
Campaign: EpiLogos/O-I#65, #220; EpiLogos/Factory#195.

## Reading the table

OpenRig's model: a *rig* of *pods* of *members*; each member is a *seat* (`nodes.id`),
filled over time by *occupants* (`occupant_tenures`, generation UUID), on a tmux substrate,
with one daemon owning SQLite state. O:I keeps its owners: Central grounds World, Project
World and the Position definition; Actuation owns occupancy; AIKit composes body, context,
session and the joined reading; Factory owns durable work custody; Workcell owns material
actuality. No Pod store, queue clone, SQLite topology or second graph is introduced.

Dispositions: `already equivalent | fragmented | patch | port/adapt | O:I extension | reject(reason)`.

## Crosswalk

### 1. RigSpec topology — **patch**
- **OpenRig**: `packages/daemon/src/domain/rigspec-schema.ts` (closed key sets `:46-74`, unknown-key refusal), `rigspec-instantiator.ts:1125-1566`; tests `rigspec-schema.test.ts` ("rejects an unknown $label key…"), `pod-rigspec-instantiator.test.ts`.
- **O:I owner**: Central (World records `ctrl/src/world.rs`, ProjectCentral grounding, AgentSets); AIKit session topology (`aikit session up`) for material launch.
- **Current**: World/Project nesting existed; the addressable unit (seat) did not.
- **Difference**: O:I topology is authored ground (Control / ProjectCentral files), not an instantiated YAML spec; material launch stays with AIKit/Workcell.
- **Patch/test**: `central.world-position/v1` records under `{Control|ProjectCentral}/relations/positions/`, with OpenRig's closed-key rule (a silently dropped key alters the address). Tests: unknown key refused; ref/slug/file-name/enclosing-world mismatches refused.

### 2. AgentSpec / startup layering — **already equivalent**
- **OpenRig**: `agent-manifest.ts`, `startup-resolver.ts:14-97` (agent → profile → culture → rig → pod → member), `startup-orchestrator.ts:126-440`; tests `startup-resolver.test.ts`, `startup-orchestrator.test.ts` ("does not replay the session identity on a resumed restore").
- **O:I owner**: AIKit composition (`aikit compose`: Central AgentProfile + Actuation instantiation receipt → `ActorBootstrap`, `aikit-core/src/actor_bootstrap.rs`), capsule/skill-set layering, managed client skill projection.
- **Difference**: O:I layers typed profiles/capsules instead of concatenating files; identity is carried by refs and receipts, not re-sent text.
- **Patch/test**: none to layering. Adopted invariant only: identity is stamped into the body's environment (`OI_POSITION_REF`, `OI_OCCUPANT_GENERATION`), never recovered from text.

### 3. Stable seat identity — **patch**
- **OpenRig**: `session-name.ts:13-193` (`{pod}-{member}@{rig}`), `seat-status-service.ts:43-87`, seat resolution `0 → seat_not_found`, `>1 → seat_ambiguous`; tests `session-name-parity.test.ts`, `seat-identity-reconciler.test.ts`.
- **O:I owner**: Central (definition), because a Position is durable World structure beside AgentProfiles and World records.
- **Current**: absent. Factory `NodeKind::Position` is a RunMap node, O:I CLI `CurrentWorldPosition` is a product slot, Actuation `AgenticLocus` is per-composition — none is a stable World address.
- **Difference**: `central:position:<world>:<slug>` is a structured ref, not a concatenated name, so OpenRig's recorded drift (`{pod}-{member}` unsplittable, non-unique rig names) cannot arise.
- **Patch/test**: `central.position.list|read`; handle uniqueness; profile resolution through world ancestry.

### 4. Occupant generation / tenure — **port/adapt**
- **OpenRig**: `session-registry.ts:143-279`, `active-occupant.ts`, migration 060 `occupant_tenures` (per-node ordinal, unique generation UUID, kinds initial/handover/adopt/fresh), reserve-before-start; tests `occupant-generation-producer-carry.test.ts`, `seat-fresh-launch.test.ts`.
- **O:I owner**: Actuation (actual Agency/occupancy).
- **Current**: absent; Actuation gateway binding is "presence, not identity"; AgentSession lives in AIKit SessionSpace.
- **Difference**: ledger is an append-only file per Position under the Actuation store, not SQLite; the occupant names Agent + Agency (+ AgentSession, SessionSpace, harness composition, model, Workcell) so every one of them can change while the Position holds.
- **Patch/test**: `actuation occupancy claim|release|verify|presence|read|list`; single open tenure law, ambiguity refusal, racing claims, ordinal/uuid monotonicity.

### 5. Seat handover and predecessor invalidation — **port/adapt**
- **OpenRig**: `seat-handover-service.ts:252-1199` (commit in one transaction; invalidate only on committed handover), `occupant-invalidator.ts:17-88` (generation-scoped, never name-scoped); tests `seat-handover-service.test.ts` ("does NOT invalidate the retiring occupant when the handover fails before commit"), `occupant-invalidator.test.ts`.
- **O:I owner**: Actuation (tenure supersession); Factory (custody continuity).
- **Difference**: OpenRig releases the retiring generation's queue claims to `pending`. In O:I custody belongs to the **Position**, so work continuity survives reoccupation without re-queueing; what is invalidated is the predecessor generation's standing (`verify`, `presence`, `release` refuse). Predecessor history remains testimony, never successor authority. OpenRig's drift (successor recorded as adopted) is not ported.
- **Patch/test**: `claim --expect-generation <current>` supersedes atomically; stale expectation refused; predecessor verify → `occupancy.superseded`.

### 6. `whoami` — **port/adapt** (+ O:I extension)
- **OpenRig**: `packages/cli/src/commands/whoami.ts:140-370` (flag → env → tmux metadata chain; partial result when daemon down), `whoami-service.ts` (ambiguous name → 409); tests `whoami.test.ts`, `whoami-service.test.ts`.
- **O:I owner**: AIKit (joined composition reading) over Central / Actuation / Factory / Workcell / Redis.
- **Current**: fragments only — `ActorBootstrap`, the encounter Agency header, TUI-only `ProjectWorldReadModel`, unwired `SessionEcologyReadModel`.
- **Difference**: the O:I reading adds Local World, Project World, root/child NOW, current work, prepared-context revision, authority, working Surface and Return destination; every facet is `present|absent|ambiguous|unavailable|not-attempted`.
- **Patch/test**: `aikit whoami`; resolution `--position` → `OI_POSITION_REF` → occupancy by AgentSession → absent; owner-down yields `unavailable` with the failing command, never a crash or guess.

### 7. Peer / topology discovery — **port/adapt**
- **OpenRig**: `whoami-service.ts:244-314` (peers = same-rig roster excluding self, independent of edges), `ps.ts:500-562` (scope named or refused); test "peers[] is the same-rig roster excluding self…".
- **O:I owner**: Central (Position listing) + Actuation (occupancy list), joined by AIKit.
- **Difference**: the roster is the Project World's Positions (plus inherited root Positions), not a rig.
- **Patch/test**: `whoami` peers facet (uncapped); `aikit gateway who`.

### 8. Current-work derivation and ambiguity refusal — **port/adapt**
- **OpenRig**: `packages/daemon/src/domain/current-work.ts:199-280` over the unbounded `listInProgressForDestination` (`queue-repository.ts:2019-2034`), deliberately not the 25-row `recent` list; tests `current-work.test.ts` ("refuses ambiguity even when the second baton sits beyond the 25-row recent cap").
- **O:I owner**: Factory (durable developmental work).
- **Current**: absent; first-match / most-recent heuristics in Factory (`build.rs:1013-1028` frontier, `development_field.rs:443`) and Cradle (`factoryReads.ts:76` first page of 100, `deskStore.ts:174` first run containing the session).
- **Difference**: candidates are Position custody + active attempts whose participant names the Position; work node = run + workflow unit (or work ref) instead of mission/slice directories.
- **Patch/test**: `factory development current-work` → none/one/ambiguous; order independence; ambiguity beyond any presentation cap; blocked custody is not current.

### 9. Direct `send` / messaging — **port/adapt**
- **OpenRig**: `packages/cli/src/commands/send.ts` (From/To/Sent/gen envelope with reply line), `session-transport.ts` (bracketed paste + guarded Enter; refuses at a live prompt), attribution from `X-OpenRig-Session` header only; tests `send-prompt-guard.test.ts`, `send.test.ts`.
- **O:I owner**: AIKit Agency Gateway (contact plane); Actuation occupancy (sender attribution).
- **Current**: AIKit gateway has no send; Actuation gateway `Communique` blocks until a Return (`actuation-gateway/src/server.rs:214-312`), so it is not cheap.
- **Difference**: a Communique is addressed to a **Position**, persisted, and delivered at the recipient occupant's next turn boundary; keystroke injection is a material provider operation, not messaging truth. Attribution comes from the sender's own occupancy, never from a claimed `from`.
- **Patch/test**: `aikit gateway who|send|inbox|conversation`; same Workcell, cross-Workcell, occupant replacement, unavailable recipient, delayed delivery.

### 10. Chatroom — **reject(second conversation store)**
- **OpenRig**: `chat-repository.ts`, `routes/chat.ts` (one room per rig, topic markers, SSE watch).
- **Reason**: O:I already carries conversation through Gateway journals and Conversation/Flow; a per-topology chat table would be a second conversation store. The inspect need is met by `aikit gateway conversation`. Reopen if a many-party room is required that journals cannot express.

### 11. Durable queue / work handoff — **patch** (queue store rejected)
- **OpenRig**: `queue-repository.ts` (states, claim must be destination, transactional handoff with chain of record, closure reasons).
- **O:I owner**: Factory (Commission / Journey / Run custody).
- **Difference**: Factory is the durable work owner; cloning a queue would fork work truth. Ported: claim-by-addressee, closure/transition validation, handed-off chain, and the explicit Communique → custody crossing.
- **Patch/test**: `factory development custody assign|update|list` (+ `origin.communique_ref`); `aikit gateway delegate`.

### 12. Refocus delivery — **port/adapt**
- **OpenRig**: `packages/daemon/assets/plugins/openrig-core/hooks/scripts/refocus.cjs` (due on explicit / PostCompact / pending / transcript growth; delivered only at `UserPromptSubmit`; state consumed inside the stdout write callback; per-occupant baseline); tests `refocus-context-ref.test.ts`, `refocus-occupant-baseline.test.ts`.
- **O:I owner**: AIKit (projection, hooks, encounter delivery).
- **Difference**: the O:I trace runs current operation ← workflow unit ← attempt/Run ← Journey/Commission ← Project intent ← ProjectCentral ground, plus Position, NOW, body, nearby work, changed sources and Return target. Claude's `SessionStart(source=compact)` accepts context, so post-compaction delivery is direct; the transition trigger is a change of current-work digest, not transcript bytes.
- **Patch/test**: `aikit refocus`; hook triggers fresh / compaction / transition / sustained / explicit; not every turn; no predecessor leak.

### 13. Snapshot / restore / relaunch / fresh — **patch**
- **OpenRig**: `restore-orchestrator.ts` (outcomes `resumed | fresh-primed | rebuilt | awaiting-decision | attention_required | failed`; a requested resume is never silently downgraded to fresh).
- **O:I owner**: Actuation (tenure `kind`), AIKit SessionSpace (`reconstruct`), Workcell (material).
- **Difference**: O:I carries the honesty rule in the tenure record (`initial | handover | fresh | adopt`) and in the joined reading (a fresh body is never reported as a continued one). A rig-wide restore orchestrator is not ported: material restore stays with Workcell/AIKit session topology.

### 14. Context / continuity policies — **already equivalent** (compaction enforcer rejected)
- **OpenRig**: `continuity-policy-materializer.ts`, `context-usage-threshold.ts`, `claude-compaction-enforcer.ts`.
- **O:I owner**: AIKit continuity engine and pressure brackets (`aikit-core/src/pressure.rs`), Jev/Redis prepared context.
- **Reason for rejecting the enforcer**: O:I does not drive `/compact` into a body; pressure feeds the sustained-work Refocus trigger instead. Ported invariant: unknown usage never triggers action.

### 15. TUI topology / population presentation — **patch**
- **OpenRig**: `packages/tui/src/hydrate.ts`, `topology/*` (honest-unknown `○`, never a fabricated `●`; failed read = named error, empty region).
- **O:I owner**: O:I Cradle (Factory Agents / Run / Context apertures) over owner reads.
- **Current**: the Agents tab is a profile roster (`FactoryAgentsTab.tsx`).
- **Patch/test**: Agents becomes a Position/occupancy aperture over `central.position.list` + `actuation occupancy list` + current work; absence rendered as absence.

### 16. Herdr terminal provider relation — **already equivalent**
- **OpenRig**: `terminal/view-composer.ts` (semantic topology composed before render; pods/edges never reach the provider), `herdr-adapter.ts`.
- **O:I owner**: AIKit Herdr adapter (`aikit-adapters/src/herdr.rs`, #139/#404) and SessionSpace working-surface binding.
- **Difference**: none in principle; O:I's semantic topology (whoami, positions, occupancy) is readable with every terminal UI closed.

### 17. Failure messages with current state and next lawful operation — **port/adapt**
- **OpenRig**: `packages/cli/src/cli-error.ts:87-175`, `daemon-lifecycle.ts:74-147` (`fact / consequence / action`), `workflow-errors.ts`.
- **O:I owner**: every verb introduced here.
- **Patch/test**: refusals are `{code, fact, consequence, action}` under `--json` and three lines otherwise; tests assert the named holder/state and the exact next command.

## Upstream drift not ported

Recorded in the study so it is not re-imported: handover successors registered as `adopted`;
swap declared with a session id in one path and a tenure id in another; name-scoped invalidation;
`From:` forgeable on a raw POST; unauthenticated chat/queue routes; pod `continuity_policy`
validated but inert; restore plan and executor disagreeing on token type.
