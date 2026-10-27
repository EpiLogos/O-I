<!-- Implementation facts extracted from mvschwarz/openrig@c8fca9d5c436e5357807e05254bf6735613eea3f (Apache-2.0) on 2026-09-23. Paths are relative to that repository. See CROSSWALK.md for O:I dispositions. -->

# OpenRig behaviours: reverse-engineered for porting

Checkout: `/Users/admin/Central/worktrees/references/openrig` at `c8fca9d5c436e5357807e05254bf6735613eea3f` (Apache-2.0). I only read it. Nothing in the checkout was changed.

**Method.**
- Everything below comes from the executable TypeScript source and its tests.
- Where the only source is prose (docs or `SKILL.md`), I mark it **[doc]**.
- Where a comment, help text, test title or error message disagrees with what the code actually does, I mark it **[drift]**.
- Every path is relative to the repo root.
- Four parallel readers covered behaviours 1–5 and 9–16. I read behaviours 6, 7, 8 and 17 myself, then re-checked the readers' load-bearing claims against the source.
- Longer per-behaviour notes are in the same folder as this file: `part-A.md` (1, 2, 15, 16), `part-B.md` (3, 4, 5), `part-C.md` (6, 7, 8, 17), `part-D.md` (9, 10, 11), `part-E.md` (12, 13, 14).

**The model in one paragraph.**
- A **rig** is a set of **pods**, and a pod is a set of **members**.
- Each member becomes one `nodes` row. That row is the **seat**, and it is keyed by an opaque ULID `nodes.id`.
- A seat is filled over time by successive **occupants**. Each occupant is one row in an append-only `occupant_tenures` ledger and carries a globally unique generation UUID.
- The substrate is tmux: one tmux session per seat, named `{pod}-{member}@{rig}`.
- A long-running daemon owns the state (SQLite via better-sqlite3) and serves it over a Hono HTTP API.
- The `rig` CLI, the TUI and the web UI are all clients of that API.
- Agents learn who they are from env vars and tmux user options stamped at launch. They never learn it from text.

---

## 1. RigSpec topology: declare, validate, instantiate

**OpenRig source:**
- `packages/daemon/src/domain/rigspec-schema.ts`
  - `:46-74` closed key sets and the unknown-key refusal
  - `:85-199` `RigSpecSchema.validate`
  - `:347-401` pod validation
  - `:403-565` member validation
  - `:725-790` pod-local vs cross-pod edges
  - `:995-1041` `continuity_policy`
  - `:1095-1154` normalize
- `packages/daemon/src/domain/rigspec-preflight.ts`
  - `:142-144` supported runtimes
  - `:239-266` and `:275-420` preflight
- `packages/daemon/src/domain/running-name-guard.ts:40-74`
- `packages/daemon/src/domain/rigspec-instantiator.ts`
  - `:1125-1505` `PodRigInstantiator.instantiate`
  - `:1507-1566` launch order
  - `:606-826` `materializeValidatedSpec`
  - `:948-1110` `addMemberToPod`
- `packages/daemon/src/domain/node-launcher.ts:95-200`
- `packages/daemon/src/domain/topology-converge.ts:21-164`
- `packages/daemon/src/domain/rigspec-codec.ts:91-213`
- `packages/daemon/src/domain/rigspec-exporter.ts:112-225`
- Routes: `packages/daemon/src/routes/rigspec.ts:69-272` and `packages/daemon/src/routes/rigs.ts:313-345,736-860`
- Example spec: `packages/daemon/specs/rigs/launch/implementation-pair/rig.yaml`

**Tests:**
- `packages/daemon/test/rigspec-schema.test.ts`: "rejects an unknown $label key with its exact path and silent-normalization consequence", "cross-pod edge using unqualified id fails", "pod-local edge using fully-qualified id fails", "dot in pod id or member id fails"
- `packages/daemon/test/pod-rigspec-instantiator.test.ts`: "launches nodes in topological order based on edges", "rejects dependency cycle between two nodes", "cycle_error: no orphan rig record persists", "kills orphan tmux sessions on total failure", "HG-2 mixed: one attention_required + one launched → rig preserved (ok:true)"
- `packages/daemon/test/running-name-guard.test.ts`
- `packages/daemon/test/rigspec-preflight.test.ts`
- `packages/daemon/test/topology-converge.test.ts`: "reports every unsupported op-kind as detected-not-supported"
- `packages/daemon/test/rigspec-routes.test.ts`
- `packages/daemon/test/session-name.test.ts`

**Behaviour:**

*YAML shape* (snake_case, closed key sets; `*` means required):
- **Rig:** `{version*, name*, summary, culture_file, permission_policy, docs, startup, services, workspace{workspace_root*, repos*[{name,path,kind}], default_repo, knowledge_root}, pods*[], edges[]}`
- **Pod:** `{id*, label*, summary, continuity_policy, startup, members*[], edges[]}`
- **Member:** `{id*, label, agent_ref* (local:|path:), profile*, runtime*, codex_config_profile, model, role, permission_policy, cwd*, restore_policy, compaction_strategy, mechanic, startup, session_source, starter_ref}`
- **Edge:** `{kind, from, to}`, where `kind ∈ delegates_to|spawned_by|can_observe|collaborates_with|escalates_to`
  - Pod-local edges use bare member ids.
  - Rig-level edges must be `pod.member` and must span two different pods.
- **Terminal seats** need exactly `runtime: terminal` + `agent_ref: builtin:terminal` + `profile: none`.
- **Runtime set** `claude-code|codex|pi|terminal|stub` is enforced at preflight, not in the schema.

*Validation:* all errors are collected before refusing. Advisories never block.

*Identity formation:*
- `logical_id` is `${pod}.${member}`.
- The canonical tmux session is `${pod}-${member}@${rig}`, built by plain concatenation.
- Allowed characters are `[A-Za-z0-9-_.@]`.

*Instantiate pipeline:*
1. Parse, validate and normalize.
2. Running-name guard: refuse if a same-name rig has any `running` session.
3. Preflight: session-name components, agent_ref and profile resolution, runtime set, cwd not inside the install, plus codex-profile and `pi --version` probes.
4. Compute a topological launch order *before* `createRig`.
   - Dependencies are `delegates_to` (from→to) and `spawned_by` (to→from).
   - Ties break alphabetically.
5. `createRig`.
6. Install topology defaults. This is best-effort.
7. `createPod` for each pod, with `namespace = pod.id`.
8. Optional services prelaunch hook.
9. For each member in order:
   - `addNode` plus policy provenance, in one savepoint
   - `NodeLauncher.launchNode`, which creates the tmux session with the `OPENRIG_*` env vars (see §6)
   - the startup orchestrator (§2)
10. Insert edges last. This is best-effort: an edge with a missing endpoint is skipped silently.
11. Emit `rig.imported`.

*Outcomes:*
- All nodes failed: kill the launched sessions, delete the rig, return `instantiate_error`.
- Any node `attention_required` and none launched: keep the rig and return `code:"attention_required"`.
- Otherwise: `ok:true` with a per-node status.

*Topology mutation:*
- `add_member` and `reconcile_session` are the only converge operations implemented.
- `remove_member|move_member|fork_member|change_runtime` return `{detected:true, supported:false}`.

**Key invariants:**
- Unknown keys are refused, because the normalizer would otherwise drop them silently.
- The cycle check runs before any DB write, so a cycle leaves no orphan rig.
- `UNIQUE(rig_id, logical_id)` holds, and `pods.namespace` is unique per rig.
- A trigger forces edges to stay within one rig.
- **[drift]**
  - The exporter is lossy: it hard-codes `version:"0.2"` and drops startup, culture, services and starter_ref.
  - The codec omits member `mechanic`.
  - A pod-local self `can_observe` edge is accepted.

**Failure messages:**
- `${path}: unknown key "${key}"; refusing the spec because normalization would otherwise discard it and alter the requested topology`
- `${prefix}: cross-pod edge must reference different pods (both reference "${fromPod}"); use pod-local edges instead`
- `${prefix}.from: pod-local edge must use unqualified member id, not fully-qualified (got "${from}")`
- `${pod.id}.${member.id}: unsupported runtime "${member.runtime}"`
- `A rig named "${name}" is already RUNNING: ${rig.id} with ${runningSessionCount} running session(s) (checked: existing rigs with this name for sessions in status 'running'). Nothing was created or launched. Alternatives: work with the running rig (rig ps --nodes / rig send), stop it first with 'rig down ${name}', or launch this spec under a different name.`
- `Dependency cycle detected among nodes: ${cycled.join(", ")}`
- `${n} node(s) require attention before becoming interactive (rig parked, NOT failed; approve and resume to proceed).`
- ``Pod "${podNamespace}" not found in rig "${rig}". Existing pods: ${hint}. Check the namespace, or add a new pod with `rig expand`.``

**Routes:**
- `POST /api/rigs/import` (`rigspec.ts:69`): 400 for validation or cycle errors, 409 for preflight failure or `rig_name_running`
- `POST /api/rigs/import/{workspace,materialize,validate,preflight}`
- `POST /api/rigs/:rigId/expand`
- `POST /api/rigs/:rigId/pods/:podNamespace/members`
- `DELETE /api/rigs/:rigId/pods/:podRef`
- `GET /api/rigs/:rigId/spec[.json]`
- `rig up` enters through `POST /api/up`, then `bootstrap-orchestrator.ts:637`, then `PodRigInstantiator.instantiate`.

---

## 2. AgentSpec and startup layering

**OpenRig source:**
- `packages/daemon/src/domain/agent-manifest.ts`: `:16-38` vocabularies, `:75-109` lifecycle validation, `:147-296` spec validation, `:321-395` normalization
- `packages/daemon/src/domain/agent-resolver.ts:55-67,146-262`
- `packages/daemon/src/domain/profile-resolver.ts`: `:115-306` (`resolveNodeConfig`), `:431-513` (compaction, mechanic and restore resolution)
- `packages/daemon/src/domain/startup-resolver.ts:14-97`
- `packages/daemon/src/domain/startup-validation.ts:6-176`
- `packages/daemon/src/domain/rigspec-instantiator.ts`
  - `:2251-2338` the file-layer builder (checked)
  - `:1985-2034` the STARTER prepend (checked)
  - `:2340-2409` dedupe and the session-identity action
- `packages/daemon/src/domain/startup-orchestrator.ts`
  - `:126-440` `startNode`
  - `:132,171-173` the rebuild prepend (checked)
  - `:556-658` the first prompt and send
- `packages/daemon/src/domain/managed-blocks.ts:7-79`
- `packages/daemon/src/domain/startup-proof.ts:49-200`
- Adapters: `packages/daemon/src/adapters/claude-code-adapter.ts:166-210,544-561` and `codex-runtime-adapter.ts:270-290`
- Assets:
  - `packages/daemon/assets/guidance/CULTURE-default.md`
  - `packages/daemon/assets/guidance/openrig-start.md`
  - `packages/daemon/assets/onboarding/01-world-and-purpose.md` and `02-self-and-competent-action.md`

**Tests:**
- `packages/daemon/test/startup-resolver.test.ts`: "startup files ordered correctly across all layers", "operator startup append happens last"
- `packages/daemon/test/pod-rigspec-instantiator.test.ts`: "orders the default culture before the rig culture overlay", "delivers the two-part default onboarding pack on fresh starts", "dedupes role guidance when the same file is referenced by resources.guidance and startup.files"
- `packages/daemon/test/startup-orchestrator.test.ts`: "startup sequence: pre-launch deliver before launchHarness; after_files after post-launch; after_ready last", "does not replay the session identity on a resumed restore", "non-idempotent action skipped on restore"
- `packages/daemon/test/agentspec-startup.integration.test.ts`
- `packages/daemon/test/context-pack-startup-files.test.ts`

**Behaviour:**

*`agent.yaml` fields:*
- `name*`, `version*`
- `imports[{ref, version}]`: flat only, exact versions, and resources are addressable as `spec:id`
- `defaults{runtime, model, lifecycle}`
- `startup{files, actions}`
- `resources{skills, subagents, guidance[{id,path,target,merge}], plugins, runtime_resources}`
- `profiles{<name>: {preferences, startup, lifecycle, uses, activity}}`

*`lifecycle`:*
- `execution_mode ∈ {interactive_resident}`
- `compaction_strategy ∈ {default-compaction, managed-compaction, handover, apprentice-handover}`
- `mechanic`, which must be a canonical `seat@rig`
- `restore_policy`
- Resolution rules:
  - Restore policy can only **narrow**, on the scale `resume_if_possible < relaunch_fresh < checkpoint_only`.
  - Compaction strategy and mechanic: the most specific level wins.
  - The whole lifecycle block is replaced, not merged: `profile.lifecycle ?? spec.defaults.lifecycle`.

*"Culture"* is not an agent field. It is the always-on floor `CULTURE-default.md` plus the rig's `culture_file`.

*Startup file entry:* `{path, delivery_hint ∈ auto|guidance_merge|skill_install|send_text, required=true, applies_on ⊂ {fresh_start, restore}}`.

*Startup action:* `{type ∈ slash_command|send_text|startup_proof, value, phase ∈ after_files|after_ready, idempotent*, applies_on}`.

*Layering order* for an agent seat (plain concatenation):
1. `session_source.mode: rebuild` artifacts
2. `starter_ref` STARTER artifacts
3. agent `startup.files`
4. profile `startup.files`
5. `CULTURE-default.md`
6. the rig's `culture_file`
7. rig `startup.files`
8. pod `startup.files`
9. member `startup.files`
10. `openrig-start.md`
11. onboarding files 01 and 02 (fresh start only, gated by a setting)

Terminal seats get only layers 5–9. Actions are ordered agent → profile → rig → pod → member, with a builtin `session_identity` send_text action last.

*`auto` delivery hint resolution:*
- `SKILL.md` becomes `skill_install`.
- Any other `*.md` becomes `guidance_merge`.
- Anything else becomes `send_text`.

*Delivery by mode:*
- `guidance_merge`: a managed block `<!-- BEGIN OpenRig MANAGED BLOCK: ${id} -->` in `<cwd>/CLAUDE.md` or `AGENTS.md`. The id `rig-role` is refused because pod-mates share a cwd.
- `skill_install`: written under `.claude/skills/` or `.agents/skills/`.
- `send_text`: a tmux paste, a 200 ms pause, then `C-m`.

*Orchestrator sequence:*
1. Deliver pre-launch files (everything except send_text).
2. Persist `node_startup_context`.
3. `launchHarness`.
4. Optional startup-proof challenge.
5. `waitForReady` (backoff from 1 s to 16 s, 30 s timeout).
6. Send one first prompt: identity text, the first send_text file, and the challenge.
7. Deliver the remaining files.
8. Run `after_files` actions, then `after_ready` actions.
9. Mark the node `ready`.

**Key invariants:**
- The default culture always comes before the rig culture.
- The only dedup is removing a guidance file that projection already delivered.
- Non-idempotent actions may not declare `restore`.
- Identity is never replayed on a resumed session.
- `ready` does not mean "oriented". Proof is a separate event.
- **[drift]** The operator-append layer has no production caller.
- **[drift]** `packages/daemon/src/domain/lifecycle-manifest.ts` is mission composition, not agent lifecycle.

**Failure messages:**
- `${prefix}files[${index}]: compose context packs with 'rig context compose' and use a dedicated delivery verb; startup context-pack entries are not supported`
- `${prefix}actions[${index}]: non-idempotent action must not apply on restore`
- `Profile restorePolicy "${p}" broadens "${current}" — only narrowing is allowed`
- `Profile uses ${cat}: "${ref}" is ambiguous (declared in: ${sources}). Use a qualified id like "specname:${ref}"`
- `Readiness timeout after 30s — harness did not become interactive: ${reason}`
- `Pre-launch file delivery failed: ${path}: ${error}`
- The identity prompt ends with `…For durable identity recovery after compaction, run:` / `  rig whoami --json`.

**Storage:**
- `node_startup_context(node_id PK, projection_entries_json, resolved_files_json, startup_actions_json, runtime)` (migration 015). This is the source that restore replays.
- `sessions.startup_status` (`pending|ready|attention_required|failed`) (migration 014).

---

## 3. Stable seat identity

**OpenRig source:**
- `packages/daemon/src/domain/session-name.ts`
  - `:13-19` `deriveCanonicalSessionName` returns `` `${podName}-${memberName}@${rigName}` `` (checked)
  - `:25-99` legacy names and validation
  - `:100-193` the parse contract, mirrored verbatim in `packages/cli/src/session-name.ts` and `packages/ui/src/lib/session-name.ts`
- `packages/daemon/src/domain/seat-status-service.ts:43-87` (seat-ref resolution)
- `packages/daemon/src/domain/seat-lifecycle-service.ts:987-1045`
- `packages/daemon/src/domain/session-registry.ts:89-133`
- `packages/daemon/src/domain/seat-identity-reconciler.ts:40-436`
- `packages/daemon/src/domain/seat-identity-store.ts:46-193`
- Identity stamping:
  - `packages/daemon/src/domain/node-launcher.ts:128-138`
  - `packages/daemon/src/domain/claim-service.ts:166-190` (the `@rigged_*` tmux options)

**Tests:**
- `packages/daemon/test/session-name.test.ts`
- `packages/daemon/test/session-name-parity.test.ts`: "cli and ui copies are byte-identical files", "TOOTH 2: member@rig@x looks up EXACTLY the greedy rig 'rig@x' and fails the gate"
- `packages/daemon/test/seat-status-service.test.ts`
- `packages/daemon/test/seat-identity-reconciler.test.ts`: "MISMATCH — orphan/squat process…", "TMUX BLIP GUARD…"
- `packages/daemon/test/self-host-identity.test.ts`

**Behaviour:** there are three identity layers.

1. **`nodes.id` (ULID).**
   - Every foreign key points at it.
   - It is the only key that stays stable across handover, fresh launch and repair.
   - It does not survive tearing a rig down and recreating it.
2. **`nodes.logical_id`** is `pod.member`, unique per rig. It is the human address.
3. **The session name `{pod}-{member}@{rig}`** is the transport address.
   - `parseSessionName` checks the forms in this order: `<local>@external`, then canonical (split at the first `@`, with the rig part greedy), then legacy `r\d{2}-…` (no `@`, no rig binding), then `{kind:"malformed", error:"malformed_session_name"}`.
   - Callers must classify human seats (`^human(-x)?@(kernel|host)$`) *before* parsing.
   - The host never rides inside the session string. A host qualifier `member@rig@host` exists only at the CLI edge and is stripped into `hostId`.

*Seat-ref resolution:*
- A ref matches a node when `canonicalSessionName === ref` or `logicalId === member`. So `dev.impl@r` and `dev-impl@r` both work.
- The rig is looked up with `findRigsByName`, which returns a list because `rigs.name` is not unique.
- 0 matches gives `seat_not_found`. More than one gives `seat_ambiguous` with `matches[]`. The resolver never picks.

*How the running process learns its seat:*
- At launch, env vars `OPENRIG_NODE_ID`, `OPENRIG_SESSION_NAME`, `OPENRIG_RUNTIME` and `OPENRIG_OCCUPANT_GENERATION`.
- For adopted sessions, tmux options `@rigged_node_id`, `@rigged_session_name`, `@rigged_rig_id`, `@rigged_rig_name` and `@rigged_logical_id`.

*Liveness:*
- A reconciler runs every 5 s and upserts one verdict per node: `verified|mismatch|pane_missing|binding_absent|tmux_unavailable`.
- Only `mismatch` and `pane_missing` down-rank a seat. Unknown fails open.

**Key invariants:**
- The parser has one malformed shape, and three byte-identical copies are pinned by a parity test.
- Seat resolution never guesses.
- **[drift]**
  - `{pod}-{member}` cannot be split back apart when an id contains `-`.
  - `sessions.session_name` has no uniqueness constraint.
  - The lifecycle verbs also match a derived canonical name; status and handover do not.

**Failure messages:**
- `Invalid session name "${sessionName}": must match legacy r{NN}-{suffix} or canonical {pod}-{member}@{rig} format with allowed characters (a-z, A-Z, 0-9, -, _, ., @)`
- `Seat "${ref}" not found` and `Seat "${ref}" matched multiple nodes`, each with the guidance `List seats with: rig ps --nodes`
- `Seat "${ref}" not found (checked: canonical session names and logical ids across ${"the named rig"|"all rigs"}).`
- `Rig name '${spec.name}' is reserved (virtual-domain token): it would collide with the '<local>@${spec.name}' classifier — pick a different name`

---

## 4. Occupant generation and tenure

**OpenRig source:**
- `packages/daemon/src/domain/session-registry.ts:143-169,207-279` (mint, reserve, current)
- `packages/daemon/src/domain/node-launcher.ts:125-140,183-205`
- `packages/daemon/src/domain/successor-session-launcher.ts:157-165`
- `packages/daemon/src/domain/active-occupant.ts:1-174`
- `packages/daemon/src/domain/fresh-occupant-relation.ts:1-29`
- `packages/daemon/src/domain/seat-lifecycle-service.ts:368-678` (`launchFresh`), `:871-920` (compensation)
- `packages/daemon/src/domain/model-divergence/current-generation-record.ts:113-203`
- Consumers:
  - `packages/daemon/src/domain/queue-repository.ts:2065-2085`
  - `packages/daemon/src/domain/watchdog-jobs-repository.ts:311-340`
  - `packages/daemon/src/domain/watchdog-policy-engine.ts:428-460`
- Migrations: `060_occupant_tenures`, `063_occupant_generation_stamps`, `066`, `074`, `075`

**Tests:**
- `packages/daemon/test/occupant-generation-producer-carry.test.ts`: "reserves side-effect-free and both registration verbs persist the exact supplied UUID"
- `packages/daemon/test/current-generation-record.test.ts`
- `packages/daemon/test/seat-fresh-launch.test.ts`: "supersedes detached history…", "compensates a hard startup failure to zero live session and binding while retaining audit tenure"
- `packages/daemon/test/seat-lifecycle-service.test.ts`
- `packages/daemon/test/effective-model-occupant-identity.test.ts`

**Behaviour:**

*Seat vs occupant:* the seat is `nodes.id`. The occupant is an `occupant_tenures` row `{id, node_id, generation_ordinal (per node MAX+1), generation_uuid (globally UNIQUE), kind ∈ initial|handover|adopt|fresh, native_session_id_at_boot, boot_at}`. A `sessions` row is only a registration.

*Minting:*
- Every register verb mints a tenure.
- `registerSession` defaults to kind `initial`, and uses `fresh` for `seat launch --fresh`.
- `registerClaimedSession` defaults to `adopt`, and uses `handover` for a handover.

*Reserve before start:*
1. `reserveOccupantGeneration()` returns a `randomUUID()` and writes nothing.
2. The UUID goes into the pane env as `OPENRIG_OCCUPANT_GENERATION`, so hooks and the status-line sidecar stamp it from the first byte.
3. Registration then persists exactly that UUID.
4. A reservation that is never registered (a failed launch) resolves to `generation_unresolvable`.

*Current occupant:* the tenure with the highest ordinal. A null result means UNKNOWN and matches nothing.

*Active occupant for snapshots and restore:*
- If a relation map exists, it is authoritative. A missing, null or dangling entry is ambiguous and fails loudly.
- Otherwise the legacy rule applies: one row, or exactly one running row.
- There is never a newest-row-wins fallback.

*Generation-scoped stamps:*
- `queue_items.claimed_by_generation_uuid` and `minting_generation_uuid`
- `watchdog_jobs.registered_by_generation_uuid`
- `target_generation_uuid`: an opt-in fire gate. On a mismatch the wake is skipped with `target_generation_mismatch`.
- the context watchdog's `watched_file_generation_uuid` and `last_fired_generation_uuid`

*`rig seat launch --fresh --reason [--stop]`, in order:*
1. Refuse if the occupant was adopted (`origin=claimed`).
2. Snapshot every session row not already `superseded` or `exited`. Detached rows are included.
3. If a tmux session is live, it must be this seat's managed session and `--stop` must be passed. The seat is then stopped.
4. Clean leftover rows.
5. Re-probe tmux to confirm the session is absent.
6. Mark the snapshotted rows `superseded` and invalidate the retiring occupant.
7. Launch with kind `fresh`. A new generation that differs from the retiring one is required.
8. Start the node.
9. On a hard failure, compensate: kill the new session, return to zero live sessions, **keep the tenure**, and emit `seat.fresh_launch_failed`.
10. On success, set the node to `active/fresh` and emit `seat.fresh_launched{retiringGeneration,newGeneration}`.

**Key invariants:**
- The ledger is append-only. Even compensation never deletes a tenure.
- A new occupant always gets a new UUID. An unknown generation never matches as "retired".
- Every mutating verb requires `--reason`.
- A tmux probe that fails because the transport is down is a refusal. It is never read as "the session is absent".
- **[drift]** The native-session continuation dedup in `mintOccupantTenure` is unreachable, because the register verbs always pass null. Every re-bind or `reconcile-session` mints a new `adopt` generation.

**Failure messages:**
- `Active-occupant ambiguity: ${n} candidate session rows (${ids}) — ${detail}. Seat unrecoverable until resolved. Refusing newest-row-wins and refusing a replacement occupant.`
- `Seat "${ref}" is live; fresh launch refuses without --stop.`, with the guidance `Re-run with --stop to end exactly this managed occupant, or use rig handover to carry context.`
- `Seat "${ref}" has an adopted/operator-owned occupant; fresh launch refuses even with --stop.`, with the guidance `Stop the adopted process yourself, then run rig seat clean before launching fresh.`
- `Session "${s}" is absent in tmux (checked: tmux has-session, POSITIVE absence evidence) — there is nothing to stop.`, with the guidance `A dead seat with stale records is returned to launchable with: rig seat clean`
- `Session "${n}" is alive in tmux (checked: …) — clean only operates on dead seats.`, with the guidance `Stop a live seat first with: rig seat stop`
- `tmux transport unavailable probing "${s}" (${cause}) — session existence was NOT determined (checked: classified tmux probe), so ${consequence}. Retry when the tmux transport is back.`

---

## 5. Seat handover and predecessor invalidation

**OpenRig source:**
- `packages/daemon/src/domain/seat-handover-planner.ts:4-283` (sources, capability table, dry-run plan)
- `packages/daemon/src/domain/seat-handover-service.ts`
  - `:252-570` the composer
  - `:584-706` `finalizeWithDiscovered`
  - `:900-1102` `commit`
  - `:1131-1199` the restore packet
- `packages/daemon/src/domain/successor-session-launcher.ts:141-455` (in-pane cutover)
- `packages/daemon/src/domain/occupant-invalidator.ts:17-88`
- `packages/daemon/src/domain/applied-launch-observation-store.ts:25-111`
- `packages/daemon/src/domain/predecessor-recap-resolver.ts:57-90`
- Per-store invalidators:
  - `packages/daemon/src/domain/claude-compaction-enforcer.ts:683-691`
  - `packages/daemon/src/domain/context-usage-store.ts:129-136`
  - `packages/daemon/src/domain/watchdog-jobs-repository.ts:598-607`
  - `packages/daemon/src/domain/queue-repository.ts:3432-3462`
- Routes and CLI: `packages/daemon/src/routes/seat.ts:40-162` and `packages/cli/src/commands/seat.ts:590-676`

**Tests:**
- `packages/daemon/test/seat-handover-service.test.ts`: "composes the full cycle for a fresh source: create -> deliver -> verify -> rebind", "does NOT invalidate the retiring occupant when the handover fails before commit", "invalidates predecessor posture at physical cutover before successor readiness", "unwinds when context delivery fails WITHOUT killing the preserved seat", "fails closed when tmux probe throws", "keeps dry-run side-effect free"
- `packages/daemon/test/seat-handover-sources.test.ts`: fork, rebuild, and plan/executor equality
- `packages/daemon/test/occupant-invalidator.test.ts`: "with NO retiringGeneration … NEVER name-scopes", "RELEASES the retiring generation's claimed queue items (gen-scoped)"
- `packages/daemon/test/applied-launch-observation-store.test.ts`
- End-to-end with real tmux: `packages/daemon/test/seat-handover-cutover-e2e.test.ts`: "predecessor scrollback SURVIVES in the SAME pane"

**Behaviour:**

*Handover sources* (`--source`):
- `fresh` (the default)
- `rebuild`
- `fork:<ref>`, which is a native conversation fork
- `discovered:<id>`, which binds an already-running candidate

*Phases for fresh, fork and rebuild:*
1. **Validate.** Require a reason, a current occupant and a latest session row. For fork, resolve the native id here, before anything mutates.
2. **Capture.** Take the departing pane's screen and the predecessor generation. Read the predecessor recap *before* launch, because the successor overwrites the name-keyed sidecar.
3. **Reserve** the successor generation.
4. **Cutover in the same pane.**
   1. Set `remain-on-exit`.
   2. Send TERM, wait 3 s, then KILL.
   3. Invalidate the predecessor's applied-launch observation. This writes an irreversible tombstone.
   4. `respawn-pane` with an explicit shell and without `-k`, so scrollback survives.
   5. Verify the pane is a blank shell.
   6. Launch the harness, or the fork.
   7. Wait for readiness.
   8. Upsert a discovery candidate.
5. **Deliver.**
   - fresh: a restore packet (screen capture, recap, pointer)
   - rebuild: a priming packet (artifacts plus named gaps)
   - fork: nothing, because the context is native
   - If delivery fails, the candidate is unwound and **the session is never killed**.
6. **Verify the successor.** It must be active, runtime-matched, not owned by another node, and present in tmux.
7. **Commit in one SQLite transaction:**
   1. Mark every non-terminal session row `superseded`.
   2. Rebind.
   3. Read the retiring generation *before* the new mint.
   4. Register the successor with kind `handover`.
   5. Store the resume token from the launch scrape.
   6. Mark the discovery row `claimed`.
   7. Update the node: `occupant_lifecycle='active'`, `continuity_outcome ∈ fresh|forked|rebuilt|NULL`, `handover_result='complete'`, and `previous_occupant`.
   8. Call `invalidateRetiringOccupant`.
   9. Emit `seat.handover_completed`.

The `discovered` source skips phases 2 to 5.

*What happens to the predecessor:*

| Retiring state | What happens |
|---|---|
| Session rows | Marked `superseded`. The resume token is **retained**, so the predecessor can be re-woken. |
| Tenure | Retained. |
| tmux session | Never killed. Only the process inside the pane is replaced. |
| Compaction enforcer maps and context sidecar file | Dropped **by name** ("Class A"). |
| Armed watchdog jobs | Only jobs with `registered_by_generation_uuid = retiring` become `stopped`. |
| In-progress queue items | Only items with `claimed_by_generation_uuid = retiring` go back to `pending`, with the note `released: claimant generation retired (seat handover)`. |
| Applied-launch observation | Invalidated at physical cutover. Late writes are refused. |

If the retiring generation is unknown, the Class-B step (queue and watchdog) is a **logged no-op**. It never falls back to name scope.

**Key invariants:**
- The binding stays untouched until commit, and commit is the only rebind.
- Invalidation happens only on a committed handover.
- A failure after respawn leaves the seat re-wakeable from its provider session file.
- **[drift]**
  - Handover passes a *session ULID* to `declareOccupantSwap` where fresh launch passes the tenure UUID (`seat-handover-service.ts:1023` vs `seat-lifecycle-service.ts:548`, checked).
  - The successor row is `origin='claimed'` (`session-registry.ts:124`, checked). As a result, `seat stop` and `seat launch --fresh` would then refuse that seat as adopted. No test covers this.
  - Class-A drops are not rolled back if the commit transaction later throws.
  - The plan steps "queue state capture" and "pod shared-log append" are not implemented.
  - Several refusals fall through to HTTP 404.

**Failure messages:**
- `Missing required option: --reason <reason>`, with the guidance `Provide an explicit handover reason, for example: --reason context-wall`
- `Invalid handover source "${raw}".`, with the guidance `Use --source fresh, --source rebuild, --source fork:<id>, or --source discovered:<id>.`
- `Seat "${ref}" has no current occupant to hand over from.`, with the guidance `Start or claim the current seat occupant first, then retry handover.`
- `No native resume id is discoverable for fork source "${ref}" — the conversation may not have produced output yet. No successor was created and the seat is untouched.`, with the guidance `Retry after the source session has a native conversation id, or use --source fresh.`
- `Handover failed at step "${step}": ${message}`, with the guidance `The seat's registry binding is unchanged. If the failure was after the in-place respawn, the seat is re-wakeable from its provider session file. Inspect tmux/daemon logs and retry.`
- `Fresh successor pane "${pane}" of "${s}" is running "${cmd}" instead of a blank shell — refusing to launch into a non-blank pane. …recreate the pane (or hand over with --source discovered:<id>) and retry.`
- `Could not verify successor tmux session "${s}": …`, with the guidance `Retry after tmux health is known; probe failures are not treated as absence.`

**Routes:**
- `POST /api/seat/handover/:seatRef` with `{reason, source, operator, dryRun}`. Called by `rig seat handover` and by the top-level `rig handover`.
- `GET /api/seat/status/:seatRef`
- `POST /api/seat/{set-model,launch,stop,clean,switch-client}/:seatRef`
- HTTP status mapping (`routes/seat.ts:182-190`): 400 for bad input, 404 for `seat_not_found`, 502 for `tmux_probe_failed`, 500 for launch failures, 409 for everything else.

---

## 6. `whoami`

**OpenRig source:**
- `packages/cli/src/commands/whoami.ts`
  - `:140-193` `resolveIdentitySource`
  - `:195-370` the command
  - `:78-104` `projectCompactWhoami`
  - `:110-138` the partial result
- `packages/daemon/src/routes/whoami.ts:8-52`
- `packages/daemon/src/domain/whoami-service.ts`
  - `:7-70` result shape
  - `:157-352` `resolve`
  - `:411-425` current session name
- `packages/cli/src/openrig-compat.ts:58-71` (`RIGGED_*` legacy env fallback, with a one-time warning)
- The separate verb `rig queue whoami`:
  - `packages/cli/src/commands/queue.ts:928-946`
  - `packages/daemon/src/routes/queue.ts:743-770`
  - `packages/daemon/src/domain/queue-repository.ts:1971-2034`

**Tests:**
- `packages/cli/test/whoami.test.ts`: "TMUX_PANE with @rigged_node_id metadata resolves nodeId (takes precedence over display-message)", "no resolution source → exit 1 with guidance", "daemon down with OPENRIG_NODE_ID env returns partial JSON instead of hard-failing", "AC-1/AC-3: --json default is the compact recovery allowlist (exact keys)"
- `packages/daemon/test/whoami-service.test.ts`: "session name matching multiple rigs returns ambiguous error", "AC-4: compact resolve does NOT call the contextUsageStore lookup"
- `packages/daemon/test/whoami-routes.test.ts`: the 400, 404 and 409 cases

**Behaviour:**

*Client-side resolution chain*; the first hit wins:
1. `--node-id`
2. `--session`
3. env `OPENRIG_NODE_ID`, which also carries `OPENRIG_SESSION_NAME` if set
4. env `OPENRIG_SESSION_NAME`
5. `TMUX_PANE`, then `tmux show-option -v -t <pane> @rigged_node_id`
6. `TMUX_PANE`, then `@rigged_session_name`
7. `TMUX_PANE`, then `tmux display-message -p "#{session_name}"` (the weakest source)
8. Fail.

*Daemon resolution:*
- By `nodes.id`, or by `sessions.session_name`, newest first (`ORDER BY id DESC`).
- If the name appears in more than one rig, it raises `WhoamiAmbiguousError` and returns **409**. It never picks.
- The current session name is `bindings.tmux_session`, else `bindings.external_session_name`, else the newest `sessions.session_name`.
- `memberId` is the logical id with its first `.`-segment removed.

*Payload:* `{resolvedBy: "node_id"|"session_name", identity{rigId, rigName, nodeId, logicalId, attachmentType, podId, podNamespace, podLabel, memberId, memberLabel, sessionName, runtime, cwd, agentRef, profile, resolvedSpecName, resolvedSpecVersion}, peers[], peersNote, edges{outgoing,incoming}, transcript{enabled,path,tailCommand,grepCommand}, commands{sendExamples,captureExamples}, contextUsage?, runtimeContext?, workspace?}`

*Compact by default:*
- The CLI sends `compact=1`, and the daemon then skips the context-usage lookup.
- `--json` prints an **allowlist** projection: `resolvedBy`, the identity subset, peers as `{logicalId, sessionName, runtime}`, `peersNote`, `edges`, and `transcript{path, tailCommand}`.
- `--full` / `--verbose` prints everything.

*Daemon down or unhealthy:* the command does not hard-fail. It prints `{partial:true, daemonReachable:false, identity{nodeId, sessionName, …null}}`.

*`rig queue whoami` is a different verb:*
- It returns `{session, asDestination{pending, inProgress, blocked, recent[default 25, max 200]}, asSource{total}}` plus `currentWork` / `currentWorkBasis` (see §8).
- Its session comes only from `--session` or `OPENRIG_SESSION_NAME`.

**Key invariants:**
- Identity comes from env or tmux metadata stamped by the daemon, never from what the agent says.
- An ambiguous name is refused. Only `nodeId` is globally unique.
- Because the compact form is an allowlist, a new payload field appears only under `--full`.

**Failure messages:**
- `Cannot determine identity. Run inside an OpenRig-managed session, or use --session or --node-id.` (exit 1)
- `Missing query parameter: provide nodeId or sessionName. Run rig ps --nodes to find available sessions.` (400)
- `Session or node '${identifier}' not found in any managed rig. Check available sessions with: rig ps --nodes` (404)
- `Session '${query.sessionName}' is ambiguous — found in ${rigIds.size} rigs. Use --node-id instead.` (409)
- `daemon unreachable — topology and peer info unavailable.` (human output, partial)
- `--${optionName} is required when OPENRIG_SESSION_NAME is not set` (queue whoami)

---

## 7. Peer and topology discovery

**OpenRig source:**
- `packages/daemon/src/domain/whoami-service.ts:244-314` (peers, edges, example commands)
- `packages/daemon/src/routes/sessions.ts`
  - `:97-167` `GET /api/rigs/:rigId/nodes`: `?full=true` adds the per-node capture fallback, and `?refresh=true` re-samples context first
  - `:169` node detail
- `packages/daemon/src/domain/types.ts:620-700` (`NodeInventoryEntry`)
- `packages/daemon/src/routes/ps.ts:7-16` (`GET /api/ps`)
- `packages/cli/src/commands/ps.ts`
  - `:500-562` `validatePsLadder`
  - `:840-930` the action
  - `:1089-1096` the per-rig nodes fetch
- Discovery of unmanaged sessions:
  - `packages/daemon/src/domain/discovery-coordinator.ts:22-143`
  - `packages/daemon/src/routes/discovery.ts`
  - `packages/cli/src/commands/discover.ts:20-64`

**Tests:**
- `packages/daemon/test/whoami-service.test.ts`: "peers[] is the same-rig roster excluding self, independent of directional edges (the contract)", "emits NO roster/podRoster field"
- `packages/cli/test/whoami.test.ts`: "human Peers header names the roster contract…"
- `packages/cli/test/sweep-b-ps-session-ladder.test.ts`
- `packages/cli/test/ps-current-rig.test.ts`
- `packages/cli/test/ps-scope-metadata.test.ts`
- `packages/daemon/test/session-name-parity.test.ts`

**Behaviour:** there are three separate layers.

1. **Roster.**
   - `whoami.peers[]` is every *other* node in the rig, with no edge or status filter: `{logicalId, sessionName|null, runtime, podId, podNamespace, memberId}`.
   - `edges.outgoing/incoming` are the directed `edges` rows: `kind`, plus `to` or `from` as `{logicalId, sessionName}`.
   - `sendExamples` and `captureExamples` are built from the first 3 peers that have a session:
     - `rig send <s> 'message' --verify`
     - `rig capture <s>`
   - `peersNote` states this contract inside the payload itself.
2. **Inventory.**
   - `rig ps --nodes` returns `NodeInventoryEntry` rows, **including self**, with live state: `canonicalSessionName, attachmentType, nodeKind, runtime, sessionStatus, startupStatus, restoreOutcome, lifecycleState, occupantLifecycle, continuityOutcome, handoverResult, previousOccupant, terminalActive, activityState`, and so on.
   - The default scope is the caller's rig, derived from `OPENRIG_SESSION_NAME` via `sessionRigOf`.
   - `--rig <name>` or `-A` widen the scope explicitly.
   - Remote hosts and fan-out must name their scope explicitly, because an implicit scope never crosses a host boundary.
   - Each row is stamped with `hostSelfId`.
3. **Discovery.**
   - `rig discover` scans tmux for panes no rig manages.
   - Candidates are fingerprinted and persisted in `discovered_sessions` as `active|vanished|claimed`.
   - They can then be adopted or bound.

**Key invariants:**
- "Peers" means the roster, not the set of edge neighbours.
- A scoped list states its scope, so a restoring agent does not mistake it for the whole fleet.
- A daemon inventories only its own host.

**Failure messages:**
- `rig ps --nodes: no target — outside a managed session there is no current rig to default to.` followed by `Name one: rig ps --nodes --rig <name>, or go fleet-wide explicitly: rig ps --nodes -A.`
- `rig ps --host ${host} --nodes: no target — the local session's rig is not a remote scope` followed by `(implicit scope defaults don't cross host boundaries; a same-named remote rig would silently misresolve).`
- `rig ps --session: '--session' filters NODES, so it needs the --nodes tier.` followed by `Valid form: rig ps --nodes --session <member@rig> (add --rig/-A for scope).`
- `Rig "${rigId}" not found. List rigs with: rig ps` (404)
- `No unmanaged sessions discovered.`

---

## 8. Current-work derivation and ambiguity refusal

**OpenRig source:**
- `packages/daemon/src/domain/current-work.ts:1-280`
  - `deriveCurrentWork` at `:199-280`
  - `resolveWorkNodeDirs` at `:133-155`
  - `resolveRow` at `:165-197`
- The only production call site is `packages/daemon/src/routes/queue.ts:743-770`.
- Its input is `packages/daemon/src/domain/queue-repository.ts:2019-2034` (`listInProgressForDestination`: unbounded, single-state). That is deliberately **not** `whoami().asDestination.recent` (`:1979-2016`), which is capped and mixes states.

**Tests:** `packages/daemon/test/current-work.test.ts`:
- "treats two rows naming ONE work node via different tag forms as one, not an ambiguity"
- "refuses a single row carrying conflicting slice tags, in either array order"
- "refuses when a typed row fails to resolve alongside one that succeeds"
- "refuses ambiguity even when the second baton sits beyond the 25-row recent cap"
- "refuses with a named basis when nothing resolves, and ignores non-claimed rows"

The consumer side is covered by `packages/daemon/test/refocus-context-ref.test.ts`: "consults the daemon and still refuses to guess when two typed batons are held".

**Behaviour:**

*Input and output:*
- Input: every `in-progress` queue row destined for the session, plus `missionsRoot` from the setting `workspace.slices_root`.
- Output: `{currentWork: {mission, slice, workNodePath, basis} | null, currentWorkBasis: string}`. `currentWorkBasis` is always present.

*Algorithm:*
1. If there is no root, refuse.
2. For each in-progress row, collect the *distinct* non-empty values of its `mission:` and `slice:` tags.
   - A row missing either prefix is ignored, because it is not a typed baton.
   - A row with more than one distinct value is a **conflict**. Values are sorted, and the row is labelled by `qitemId`.
3. If there are any conflicts, refuse, even if other rows are valid.
4. If no typed rows remain, refuse. The message names the scope: pending and blocked rows do not count.
5. Resolve each row.
   - The mission must match exactly one directory under the root, either by directory name or by the `id` in that directory's `SPEC.md` frontmatter.
   - The slice must match exactly one directory under `<mission>/slices/` in the same way.
6. If any row fails to resolve, refuse. The rows that did resolve are not trusted on their own.
7. De-duplicate by the resolved `workNodePath`. If more than one distinct path remains, refuse.
8. If exactly one remains, answer. `basis` names which match forms were used.

*Summary by count:*
- 0 typed rows: refusal.
- 1: an answer.
- Several: an answer only if all of them resolve to the same node; otherwise a refusal.

*Canonical tag pair:* `mission:<directory>` + `slice:<dot-id>`. The id-form mission tag is accepted as compatibility and labelled "(compat)".

**Key invariants:**
- The derivation refuses rather than guesses. A wrong work node would re-aim the whole refocus.
- The result does not depend on tag order or row order.
- Ambiguity is judged on *resolved nodes*, and only when every row resolved.
- The refusal is carried by `currentWork: null`, not by the prose. Consumers read `workNodePath`.
- The input is never capped. The test proves that the capped `recent` list turns a refusal into a confident wrong answer.

**Failure messages** (`currentWorkBasis`):
- `no missions root configured`
- `no typed in-progress work (only in-progress rows are considered; a typed row that is pending or blocked is not current work)`
- `conflicting typed tags: row ${qitemId} carries ${n} distinct slice tags (${sorted})`, with multiple entries joined by `; `
- `typed work did not resolve: row ${qitemId} — mission ${mission} resolves to ${n} directories`
- `${byPath.size} distinct typed work nodes — refusing to guess`
- On success: `one typed in-progress work node; mission via canonical directory-name tag, slice via canonical id tag`

---

## 9. Direct `send` and messaging

**OpenRig source:**
- `packages/cli/src/commands/send.ts`
  - `:65-94` `wrapSendBody`, which builds the envelope
  - `:147-159` empty-message refusal
  - `:213-548` single-seat send
  - `:585-691` staged-text detector plus one guarded Enter
  - `:881-1022` fan-out
- `packages/cli/src/sender-identity.ts:11-27`
- `packages/cli/src/client.ts:8-33,122-140,219-229`: the header is stamped last on every request
- `packages/daemon/src/routes/transport.ts:28-315`
- `packages/daemon/src/routes/require-sender-identity.ts:47-179`
- `packages/daemon/src/domain/session-transport.ts`
  - `:127-318` activity classification
  - `:783-1151` `send`
  - `:1163-1279` idle wait and readiness
  - `:1398-1504` capture and broadcast
- `packages/daemon/src/adapters/tmux.ts:350-384`: `load-buffer`, then `paste-buffer -d -r -p` (checked), then `send-keys C-m`
- `packages/daemon/src/lib/pane-envelope.ts:22,49-121`

**Tests:**
- `packages/daemon/test/send-prompt-guard.test.ts`: "K-1: default send to an AskUserQuestion refuses (target_needs_input) and never types or submits", "K-3: --force to an interactive prompt is STILL refused", "K-4: --dangerously-interact --reason drives the prompt AND writes a transport.prompt_override audit"
- `packages/daemon/test/transport-routes.test.ts`: "P21 I4: the From: line derives from the transport header, IGNORING a forged body.envelopeSender"
- `packages/daemon/test/session-transport.test.ts`: "send calls sendText then sendKeys C-m with delay", "send with verify does not false-positive on pre-existing pane content"
- `packages/cli/test/send.test.ts`: "P18: an env-less send DELIVERS with an honest `<unknown sender>` label"
- `packages/daemon/test/pane-envelope.test.ts` and `packages/cli/test/send-header.test.ts`, which are byte-parity twins

**Behaviour:**

*Attribution:*
- Every CLI request carries `X-OpenRig-Session: $OPENRIG_SESSION_NAME`.
- For cross-host sends, `member@rig@<selfHostId>` is used, or `X-OpenRig-Origin-Unknown: true` when that is not available.
- The daemon's actor is the header value. Body-supplied `--from`, `--sender` and `--actor` are ignored.
- A send with no header is **delivered** and labelled `<unknown sender>` with an `UNKNOWN_SENDER_NOTICE` warning. It is not refused.

*Envelope:*
```text
From: <sender>
To: <r>
Sent: MM-DD HH:MMZ · gen <8>
---
<body>
---
↩ Reply: rig send <sender> "..."
```
`--raw` sends the bytes as-is.

*Transport pipeline:*
1. Refuse `external_cli` seats.
2. `tmux has-session`. The result is present, absent or transport-unavailable, and each is distinct.
3. Readiness.
   - A runtime hook younger than 15 s is authoritative.
   - Otherwise capture 20 lines and classify them.
   - Only `needs_input` refuses: a selector, a permission question, or a draft above the footer.
   - `running` and `unknown` both send, with an advisory.
4. With `--verify`, pre-capture the pane.
5. Write the text to a temp file, `tmux load-buffer`, then `tmux paste-buffer -d -r -p`. This is a bracketed paste with raw LF, so newlines never submit.
6. Wait 200 ms, then `send-keys C-m`.
7. With `--verify`: wait 500 ms, recapture, and report `delivered | rendered-unconfirmed | failed`.

*Remedy:*
- If the CLI sees the text still staged at the prompt, it sends exactly one `submitOnly` Enter.
- The daemon re-checks the staged text first and refuses if it does not match.

*Related verbs:*
- `broadcast` (`--to/--pod/--rig`) sends sequentially through the same guards and returns `{total, sent, failed, results}`.
- `capture` runs `capture-pane -S -N`.
- `rig ask` searches transcripts and chat. It is not messaging.

*Outbox:* rows are auto-recorded only for header-derived sends.

**Key invariants:**
- Only positive evidence of an interactive prompt blocks a send. `--force` is a no-op.
- Driving a prompt requires `--dangerously-interact --reason`, and the audit event is written before the send.
- A timeout means "unconfirmed", never "failed". The user is told to check the pane before resending.
- **[drift]**
  - On a single send, the daemon passes the CLI-built `From:` through verbatim, so a raw POST can forge it. Only fan-out envelopes are daemon-derived.
  - Several code comments and help strings are stale (see `part-D.md`).

**Failure messages:**
- `Refused: '${s}' is at an interactive prompt (${reason}). A message must not select or approve it. To deliberately drive the prompt: rig send ${s} "<text>" --dangerously-interact --reason "<why>". No text was sent.` (409 `target_needs_input`)
- `Session '${s}' not found: tmux reports no session with this name. No text was sent. Check available sessions with: rig ps --nodes` (404)
- `The tmux server could not be reached (${cause}). Whether session '${s}' exists was not determined. No text was sent.` (503)
- `Text is visible in '${s}' but was not submitted (Enter failed). The agent may need manual attention.` (502)
- `submitOnly refused: the pane of '${s}' does not show the expected staged text — pressing Enter here could drive something else entirely. Nothing was submitted.` (409)
- On CLI timeout: `Delivery UNCONFIRMED — the daemon may have received and delivered the message.` / `Reconcile by EFFECT before any resend: check the pane/target for the message (rig capture <session>). A resend without checking risks a duplicate. …`

**Routes:**
- `POST /api/transport/send`, `/capture` and `/broadcast` (`routes/transport.ts:28,170,217`). These are bearer-gated when a terminal token is configured.

---

## 10. Chatroom

**OpenRig source:**
- `packages/daemon/src/db/migrations/016_chat_messages.ts:3-18`
- `packages/daemon/src/domain/chat-repository.ts:41-160`
- `packages/daemon/src/routes/chat.ts:19-165`, mounted at `/api/rigs/:rigId/chat` (`packages/daemon/src/server.ts:740`)
- `packages/cli/src/commands/chatroom.ts:15-349`

**Tests:**
- `packages/daemon/test/chat-repository.test.ts`: "history --topic returns messages between topic marker and next topic marker", "--topic + --after composable within topic window"
- `packages/daemon/test/chat-routes.test.ts`: "send — header present + differing body sender → wire supersedes (sender alice, 201)", "GET /watch SSE stream delivers initial batch + new messages"

**Behaviour:**
- **Scope:** one room per rig, with no channels.
- **Row shape:** `{id: monotonic ULID, rigId, sender, kind: 'message'|'topic', body, topic|null, createdAt}`.
- **Topics:**
  - A topic is a marker row.
  - `history?topic=X` returns the window from the newest `X` marker (inclusive) up to the next marker of any topic (exclusive).
  - Filters: `after` (a ULID cursor), `since`, `sender`, `limit`.
- **Sender resolution:**
  - If the `X-OpenRig-Session` header is present, it is the sender.
  - Otherwise the body's `sender` is used, labelled "claimed".
  - If neither is present, the request fails with 400 `actor_required`.
- **Posting:** writes the row, then emits `chat.message` on the event bus.
- **`GET /watch` (SSE):**
  1. Subscribe first.
  2. Send the latest 20 messages.
  3. Flush anything that arrived meanwhile, de-duplicated by id.
  4. Stream live.
- **`rig chatroom watch --tmux`:** opens a *watcher* tmux session `chatroom@<rig>`.
- **`wait`:** polls every 3 s, with a 120 s default timeout.
- **No pane injection, no mentions, no retention.** Chat never calls the session transport. Rows are removed only by `/clear` (the whole rig, no identity check) or by the rig cascade delete.

**Key invariants:**
- The header beats the body sender.
- Topic windows are defined purely by ULID order.
- Watch neither drops nor duplicates messages.
- **[drift]** `chat_messages` never received the `identity_provenance` column that migration 065 promised.
- **[drift]** Neither the chat routes nor `/clear` are authenticated.

**Failure messages:**
- `Cannot record chat send: no authenticated transport identity (X-OpenRig-Session absent) and no actor named in the request body. The channel of record needs an actor to attribute the row to — name one, or run from a managed seat so the identity is derived for you.`
- `Rig '${rig}' not found. List rigs with: rig ps`
- `Rig '${rig}' is ambiguous — ${n} rigs share that name. Use a unique name or remove duplicates.`
- `Timed out after ${t} seconds — no new messages matching filters.`

---

## 11. Durable queue and work handoff

**OpenRig source:**
- `packages/daemon/src/domain/queue-repository.ts`
  - `:30-78` states and typed gate blockers
  - `:377-385` `QueueRepositoryError`
  - `:1310-1500` create
  - `:1507-1847` handoff and handoff-and-complete
  - `:1971-2034` whoami
  - `:2038-2168` claim and unclaim
  - `:2225-2718` the update state machine
  - `:2744-2826` blocker propagation
  - `:3432-3459` generation release
- `packages/daemon/src/domain/hot-potato-enforcer.ts:18-126` (closure reasons, SLA)
- `packages/daemon/src/domain/queue-transition-log.ts`
- `packages/daemon/src/domain/queue-wake-ladder.ts`
- `packages/daemon/src/domain/queue-stuck-sweep.ts`
- `packages/daemon/src/domain/queue-retention.ts`
- `packages/daemon/src/domain/outbox-handler.ts`
- `packages/daemon/src/domain/inbox-handler.ts`
- `packages/daemon/src/routes/queue.ts:116-167` (error-code-to-HTTP map) and `:389-1108`
- `packages/cli/src/commands/queue.ts:237-309,398-1326`

**Tests:**
- `packages/daemon/test/queue-repository.test.ts`: "handoff is transactional: closes source as handed-off + creates new qitem", "claim rejects mismatched destination", "terminalizing a blocker auto-unparks the rows blocked on it", "RELEASES retired-gen in-progress items to pending (never drops)"
- `packages/daemon/test/queue-transactional-closure.test.ts`: "a nudge-intended terminal handoff with NO outbox attached FAILS CLOSED", "two concurrent drains of the same crash-orphaned intent: ONE send"
- `packages/daemon/test/queue-blocker-refusal-shape.test.ts`
- `packages/daemon/test/queue-park-wake.test.ts`
- `packages/daemon/test/queue-routes.test.ts`
- `packages/cli/test/queue.test.ts`

**Behaviour:**

*States:*
- `pending | in-progress | blocked | done | failed | denied | canceled | handed-off`.
- `ACTIVE = {pending, in-progress, blocked}`.
- Rows in `{done, canceled, handed-off}` need `--reopen --note` to move back to active.
- Ids look like `qitem-YYYYMMDDHHMMSS-<8hex>`.
- A caller-supplied id makes create idempotent for the same source and destination.

*Verbs:*

| Verb | Transition | Guard or effect |
|---|---|---|
| create | → `pending` | Destination rig must exist. Human destinations need `summary` + `evidence_ref`. Nudges the destination. |
| claim | `pending` or `blocked` → `in-progress` | **Caller must equal the destination.** Sets the SLA deadline (fast 30 m, routine 4 h, deep 24 h, critical 15 m). Stamps `claimed_by_generation_uuid`. |
| unclaim | `in-progress` → `pending` | No owner check. |
| update `done` | → `done` | Needs `closure_reason ∈ {handed_off_to, blocked_on, denied, canceled, no-follow-on, escalation, superseded}`. `handed_off_to`, `blocked_on` and `escalation` also need a target. |
| update `blocked` | → `blocked` | Needs a `blocked_on` that is either a live qitem or a typed gate (`fold:`, `auth:`, `external:`). Plus one park wake: an existing watchdog job, a one-shot timer, or an implicit wake on the blocker. |
| handoff / handoff-and-complete | source → `handed-off` / `done`, plus a new `pending` row | One SQLite transaction. The new row gets `handed_off_from` and an extended `chain_of_record`; body, tier and tags are inherited. A durable wake intent is written to the outbox in the same transaction and fails closed if the outbox is missing. |
| auto-unpark | `blocked` → `pending` | Fires when the blocker leaves ACTIVE. If the blocker was handed off, the park is rebound to the successor instead. |
| generation release | `in-progress` → `pending` | On seat handover (§5). |

*Nudge / notify:*
- Create and handoff inject an envelope into the destination pane through the same guarded `SessionTransport.send(…, {verify:true})` used by `rig send`.
- The result is stored in `last_nudge_result`: `verified | delivered-ack-pending | indeterminate:… | failed:… | gateway-owned: …`.
- A handoff wake is durable: `pending → sending → delivered|indeterminate|failed`. At boot, orphaned `sending` rows become `indeterminate`.

*Background loops:*
- Wake ladder: 300 s, up to 3 retries, then escalate.
- Stuck sweep: rows unclaimed for more than 60 minutes.
- Nothing ever auto-unclaims.

**Key invariants:**
- Every state write appends a `queue_transitions` row in the same transaction.
- Only `claim` checks ownership.
- **[drift]**
  - Several refusal codes are missing from the HTTP map and fall through to **500** (`blocker_*`, `closure_fields_not_admitted`, `wake_*`).
  - `expires_at` and `last_heartbeat` are never enforced or written.
  - A comment says handoff sets `done`; it actually sets `handed-off`.

**Failure messages** (JSON `{error: code, message, ...meta}`; meta carries `currentState` and `requestedState`):
- `qitem ${id} is in state ${s}; only pending/blocked are claimable` (409)
- `qitem ${id} destination is ${dest}, not ${caller}` (403)
- `qitem ${id} is currently '${cur}'; state='${req}' would reopen a terminal row. Re-run deliberately with --reopen --note <reason>.` (409)
- `state=done requires closure_reason; valid values: handed_off_to, blocked_on, denied, canceled, no-follow-on, escalation, superseded`
- `blocked_on names a resolved qitem: ${b} is '${state}'. A park must name a LIVE blocker — parking on a completed/closed row is a dead-blocker park that never self-clears.`
- `qitem ${id} is the LIVE frontier packet of workflow instance ${i} (${w}). Closing it out-of-band would strand the workflow. Use the workflow verbs instead: rig workflow project (advance) | rig workflow route (re-target the owner).`
- CLI (fact / consequence / action): `Neither --body nor --body-file was provided.` / `The queue command did not run; the daemon was not contacted.` / `Pass the body via --body "<text>" or --body-file <path> (use - for stdin).`

---

## 12. Refocus delivery

**OpenRig source:**
- `packages/daemon/assets/plugins/openrig-core/hooks/scripts/refocus.cjs:1-322`
  - `:15` `DEFAULT_THRESHOLD = 2_600_000` (checked)
  - `:149-151` SessionStart no-op
  - `:161-244` per-occupant state and the shrink reset
  - `:246-261` due and pending logic (checked)
  - `:263-307` payload
  - `:308-321` consume only after the stdout write
- `packages/daemon/assets/plugins/openrig-core/hooks/claude.json`: refocus is registered on `UserPromptSubmit`, `PostCompact` and `Stop`
- `packages/daemon/assets/plugins/openrig-core/hooks/codex.json`: `UserPromptSubmit` and `PostCompact` only
- The work node comes from `packages/daemon/src/domain/current-work.ts` via `GET /api/queue/whoami` (§8)
- `packages/daemon/src/domain/plugin-discovery-service.ts:637-685` refuses duplicate hook registrations
- **[doc]** `docs/reference/refocus-channel.md:3-7` (the "editing a file is not delivery" rationale) and `packages/daemon/assets/plugins/openrig-core/skills/refocusing/references/refocus.md`, which is also the shipped default payload

**Tests:**
- `packages/daemon/test/refocus-context-ref.test.ts`: "never registers or emits refocus at SessionStart", "retains due state at Stop, then consumes one context-visible delivery", "retains PostCompact due-state without invalid output, then delivers it at the next prompt", "uses Codex PostCompact exactly and never substitutes a byte/reset threshold", "REF wins over FILE…", "consults the daemon and still refuses to guess when two typed batons are held"
- `packages/daemon/test/refocus-occupant-baseline.test.ts`: "a fresh occupant measures from its own baseline and never inherits the prior occupant's lastBytes", "a prior occupant's pending delivery never leaks to the new occupant", "shrink clears pending and resets the baseline BEFORE due computation"
- `packages/daemon/test/openrig-core-plugin.test.ts`

**Behaviour:**

*Triggers.* A refocus is **due** when any of these holds:
- `OPENRIG_REFOCUS_NOW` is truthy (the only on-demand path; there is no `rig` command).
- The event is `PostCompact`.
- A `pendingOn` is stored.
- (Claude only) The transcript file grew by at least `OPENRIG_REFOCUS_BYTES` (default 2.6 MB) since the last refocus.

Growth is `stat(transcript_path).size` minus the stored baseline. The daemon's context percentage is never consulted.

*Delivery happens only at `UserPromptSubmit`:*
- On `Stop` or `PostCompact` the hook stores `pendingOn` (PostCompact overwrites any earlier value), writes nothing to stdout, and exits 0.
- At the next prompt it prints `{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":<payload>}}`.
- The payload is `REFOCUS (<why>). Answer briefly, out loud, before your next move:` followed by a trace-to-root, then the body.
- `why` is one of `on demand`, `just compacted — your picture is lossy`, or `<X.X>MB of work since your last refocus`.

*Body sources*, first hit wins:
1. `OPENRIG_REFOCUS_CONTENT_REF`, via `rig context get`
2. `OPENRIG_REFOCUS_CONTENT_FILE`
3. `$OPENRIG_HOME/refocus/REFOCUS.md`
4. the shipped `refocus.md`
5. three hard-coded questions

*Trace:*
- The trace runs `trace-to-root.py`.
- Its work start is `OPENRIG_REFOCUS_WORK_NODE`, or `.currentWork.workNodePath` from `rig queue whoami --json`, which may refuse (§8).

*Consumption:*
- State updates happen **inside the `stdout.write` callback**: `lastBytes = size`, `firedAt`, `firedOn`, and `pendingOn` is deleted.
- So "delivered" means the context was emitted into the turn.

*Why "editing a file is not delivery"* **[doc]**: a running seat read its configuration at session start, and nothing re-reads disk. Content counts as delivered only when injected into the turn as `additionalContext`. The code enforces this by keeping the due state until a `UserPromptSubmit` actually prints; the Stop and PostCompact tests assert empty stdout plus a persisted `pendingOn`.

*State file:* `$OPENRIG_HOME/refocus/<seatKey>__<sanitized identity>.json`, holding `{lastBytes, baselineAt, pendingOn, pendingAt, firedAt, firedOn, lastReset}`. The identity is `session_id`, else the transcript basename. This is not SQLite.

**Key invariants:**
- Each occupant has its own baseline, and nothing leaks from the predecessor.
- A shrinking transcript resets the baseline and never fires.
- With no identity at all, only a sentinel file is written: no baseline, no fire.
- Every error path exits 0.
- A failed content ref is announced at the head of the payload, and the default body is still delivered.
- **[drift]** While `OPENRIG_REFOCUS_NOW=1` remains set, every prompt refocuses.

**Failure messages:**
- `refocus: no session identity and no transcript path for ${seat} — measurement unavailable this episode`
- `refocus: transcript shrank for ${seat} — baseline reset, pending cleared`
- `REFOCUS CONTENT REF FAILED: ${ref} — ${failure}` followed by `The configured source failed; use the shipped default below for this turn.`
- `TRACE GAP — ${reason}`
- `Duplicate hook registration "${identity}" found in both ${a} and ${b}. Archive or disable one provider before loading plugins.`

---

## 13. Snapshot, restore, relaunch and fresh

**OpenRig source:**
- `packages/daemon/src/domain/types.ts:431-499`: the outcome types
- `packages/daemon/src/domain/restore-orchestrator.ts`
  - `:74-99` rollup
  - `:201-370` `restore()`
  - `:563-760` pre-validation
  - `:932-1129` per-node restore and rollback
  - `:1131-1600` post-launch resume
  - `:1649-1800` runtime truth and checkpoint write
- `packages/daemon/src/domain/snapshot-capture.ts:60-184`
- `packages/daemon/src/domain/snapshot-repository.ts:21-315`
- `packages/daemon/src/domain/periodic-snapshot-scheduler.ts`
- `packages/daemon/src/domain/restore-plan-preview.ts:20-262`
- `packages/daemon/src/domain/rehydrate-eligibility.ts`
- `packages/daemon/src/domain/native-resume-probe.ts:28-222`
- `packages/daemon/src/domain/resume-token-validation.ts`
- `packages/daemon/src/domain/restore-check-service.ts`
- Routes: `packages/daemon/src/routes/snapshots.ts`, `routes/up.ts:97-199`, `routes/rigs.ts:627-700`, `routes/restore-check.ts:175`
- CLI: `packages/cli/src/commands/restore.ts`, `up.ts`, `restore-check.ts`

**Tests:**
- `packages/daemon/test/restore-orchestrator.test.ts`: "running rig with live tmux sessions -> rig_not_stopped", "resume succeeds -> status 'resumed'", "(A) PRE-LAUNCH: missing token -> awaiting-decision with launchNode NOT called", "(B) POST-LAUNCH rollback: resume concluded failed -> awaiting-decision, launched session KILLED + superseded", "BOUNDARY: a live parked resume prompt stays attention_required (no kill, never awaiting-decision)", "--fresh opt-in: listed seat launches deliberately and reports fresh-primed"
- `packages/daemon/test/restore-plan-preview.test.ts`
- `packages/daemon/test/restore-honesty-d1-d6.test.ts`
- `packages/daemon/test/periodic-snapshot-scheduler.test.ts`
- `packages/daemon/test/stub-runner-restore-e2e.test.ts`

**Behaviour:**

*Snapshot kinds:*
- `auto-pre-down`: always taken by `rig down`.
- `auto-periodic`: every 300 s; the 10 most recent are kept.
- `manual`
- `pre_restore`
- `auto-rehydrate`

*Snapshot contents:*
- rig, nodes, edges, sessions, pods
- `activeOccupantsByNode` and `topologyRoster`
- checkpoints and continuity states
- `nodeStartupContext`
- an env receipt

*Snapshot selection:*
- Auto kinds are preferred over manual ones, then the newest wins, then the first that is structurally restore-usable.
- `up` additionally rejects a snapshot that names an older occupant.

*Restore order:*
1. Validate the snapshot.
2. Refuse if any session is live or unknown.
3. Take a per-rig lock.
4. Pre-validate. Any blocker returns `not_attempted`.
5. Take a `pre_restore` snapshot.
6. Emit `restore.started`. Its `seq` is the `attemptId`, and the route returns HTTP 202 at this point.
7. Restore each node in launch order.

*Per-node decision:*
1. Ambiguous active occupant: `failed`.
2. **Stop-and-ask before launch**: the policy is `resume_if_possible`, a session existed, there is no token, and the node is not listed in `--fresh`. Result: `awaiting-decision`, with zero sessions started.
3. Launch.
4. If a resume was requested, run `claude --resume <tok>` / `codex resume <tok>` and probe the pane:
   - resumed: `resumed`
   - parked on a prompt: `attention_required`
   - anything else: kill the session, roll back to zero sessions, `awaiting-decision`
5. Not resumed but a checkpoint exists: write `.rigged-checkpoint.md`, result `rebuilt`.
6. A pod-aware runtime reports fresh continuity without proof: roll back, `awaiting-decision`.

*Outcome vocabulary:*

| Outcome | Meaning |
|---|---|
| `resumed` | The original native conversation came back. |
| `fresh-primed` | A deliberate blank start: policy `relaunch_fresh` or `checkpoint_only`, `--fresh`, or no prior session. |
| `rebuilt` | Fresh, but seeded from a checkpoint or a `session_source: rebuild`. |
| `awaiting-decision` | Resume was impossible and **no session is running**; the operator must choose. |
| `attention_required` | A live session is parked on a runtime prompt. |
| `failed` | Failure. |
| `fresh` | Legacy skip path only. |
| `operator_recovered` | Set later by a reconcile event. |
| `n-a` | Shown only in `rig ps`. |

Two related vocabularies:
- Rig-level: `fully_restored | partially_restored | failed | not_attempted`.
- Continuity outcome, set by handover and launch: `fresh | forked | rebuilt`.

*"Relaunch":*
- `restore_policy: relaunch_fresh` means restarting with a fresh occupant, never resuming.
- `rig up --existing <rig> [--fresh <id>…] [--plan]` is the relaunch entry point.
- The plan preview returns `intendedAction ∈ resume-original|fresh-primed|awaiting-decision` and `tokenState ∈ missing|stale|unverified|present`.

*Probe codes:*
- `no_conversation_found`
- `trust_gate`
- `login_required`
- `codex_client_incompatible`
- `returned_to_shell`
- `awaiting_runtime`
- and others

*`rig restore-check`:*
- Verdict: `restorable|restorable_with_caveats|not_restorable|unknown`.
- Exit code 0, 1 or 2 respectively for restorable, not restorable and unknown.
- Continuity is always reported `not_proven`.

**Key invariants:**
- A requested resume is **never** silently downgraded to fresh. There are only three routes to a fresh seat: no prior session, a non-resume policy, or an explicit `--fresh`.
- `awaiting-decision` always means zero running sessions.
- A live prompt is never `awaiting-decision`.
- `--fresh` cannot override an ambiguous occupant.
- **[drift]**
  - The plan preview predicts `awaiting-decision` for a token that has no resume type, but execution launches fresh-primed.
  - `rig down --snapshot` is a no-op, because the snapshot is always taken.
  - Several test titles no longer match their assertions.

**Failure messages:**
- `Rig ${rigId} has live sessions. Stop the rig with 'rig down' before restoring, or use the latest auto-pre-down snapshot.`
- `Original session unresumable: ${sourceNote}. No session was started. Re-run with --fresh ${logicalId} to deliberately start a fresh-primed seat, or restore the original session manually.`
- `Original session unresumable: resume attempted but failed. The blank session was rolled back; no session is running. Re-run with --fresh ${id} for a deliberate fresh-primed seat, or check the harness state manually.`
- `Exact native session resumed, but joined restore proof is incomplete: ${detail}. The resumed session was preserved; no replacement was started.`
- CLI: `${id}: awaiting-decision — no session started. To deliberately fresh-prime: rig up --existing ${source} --fresh ${id}`
- `Restore conflict: ${error}. Stop the rig first with: rig down ${rigId}`

**Storage:**
- `snapshots(id, rig_id, kind, status, data JSON, created_at)`: migration 004.
- `checkpoints(node_id, summary, current_task, next_step, blocked_on, key_artifacts, confidence, …)`: migration 005, extended by 014.
- `sessions.resume_type/resume_token/restore_policy`: migration 006.
- `resume_provenance`: migration 043. Its ranks are scrape < adoption < hook < operator.
- `resume_last_verified/resume_last_probe_status`: migration 045.
- A restore attempt is not a table. It is reconstructed from the `restore.*` event rows.

---

## 14. Context and continuity policies

**OpenRig source:**
- `packages/daemon/src/domain/continuity-policy-materializer.ts:14-452`, armed after launch at `packages/daemon/src/domain/rigspec-instantiator.ts:2046-2059`
- `packages/daemon/src/domain/policies/context-usage-threshold.ts:1-110`
- `packages/daemon/src/domain/watchdog-policy-engine.ts:255-330,495-521`
- `packages/daemon/src/domain/continuity-stack-packets.ts:8-150`, plus `packages/daemon/assets/continuity/apprentice-{prepare,cutover}.md`
- `packages/daemon/src/domain/context-monitor.ts:12-281`
- `packages/daemon/src/domain/context-usage-store.ts`
- `packages/daemon/src/domain/claude-compaction-enforcer.ts:46-716`
- `packages/daemon/src/domain/health-policy.ts`
- `packages/daemon/src/routes/compaction.ts:24-146`
- `packages/cli/src/commands/{compact,compact-plan,context,watchdog}.ts`

**Tests:**
- `packages/daemon/test/continuity-policy-materializer.test.ts`: "materializes the apprentice strategy as exactly two calibrated watchdog registrations", "arms managed compaction as exactly one real prep-nudge registration"
- `packages/daemon/test/context-usage-watchdog.test.ts`: "rebinds a new occupant to its own transcript", "requires an earlier job receipt for the same occupant generation"
- `packages/daemon/test/claude-compaction-enforcer.test.ts`: "HG-5: opt-in default-off", "HG-2 + HG-3: threshold crossing first sends the pre-compaction prep prompt, then /compact on the next high-usage tick"
- `packages/daemon/test/compaction-routes.test.ts`: "unknown usage (no sample persisted) → 409 no_usage_data (never triggers blind)"
- `packages/daemon/test/context-pack-routes.test.ts`: "is delivery-free"

**Behaviour:**

*The continuity policy* is `lifecycle.compaction_strategy`, resolved from agentspec defaults, then the profile, then the member.
- Values: `default-compaction`, `managed-compaction`, `handover`, `apprentice-handover`.
- `apprentice-handover` also needs a `mechanic: seat@rig`.

*Materialization.* Only Claude seats with `managed-compaction` or `apprentice-handover` get policy jobs. The jobs are `context-usage-threshold` watchdog jobs watching the seat's transcript JSONL.
- Byte thresholds come from a calibration of 153k tokens per MB:
  - prepare at 600k tokens, which is 3,921,568 bytes
  - cutover at 900k tokens, which is 5,882,352 bytes, and it requires the prepare job's receipt first
- Jobs are evaluated every 60 s and fire at most once per occupant generation.
- When the generation changes, the job rebinds to the new transcript.
- Managed mode: prepare only. The seat is told to run `rig context recap-write`.
- Apprentice mode: the prepare job notifies the occupant, and the cutover job creates a queue item for the mechanic seat.

*Usage tracking.* `ContextMonitor` polls every 30 s.
- Sources:
  - Claude's status-line sidecar JSON, `context_window.used_percentage`
  - Codex `token_count` JSONL events
- Samples are upserted into `context_usage`.
- A sample is fresh when under 600 s old.
- Reads return `unknown` with a reason: `not_managed|no_data|session_mismatch|stale_generation`.

*Compaction enforcer* (Claude only):
- Off by default. Configured by `policies.claude_compaction.{enabled, threshold_percent=80, …}`.
- Above the threshold:
  1. First, a prep prompt.
  2. On the next tick, `/compact`.
  3. Then, once usage is below the threshold: acknowledgement, restore prompt, audit prompt.
  4. Then a 10-minute cooldown and a width receipt.
- All enforcer state is in memory.

*Other pieces:*
- Health detector `context.pressure`: warns at 95%, critical at 99%.
- Context packs are read-only library content. They reach a seat only through refocus `CONTENT_REF` or `rig send --context`.

**Key invariants:**
- Transcript bytes are a stand-in for tokens.
- The generation gate stops a retired occupant's job from firing on its successor.
- Unknown usage never triggers compaction.
- A disabled policy drains nothing unless an operator started that sequence.
- **[drift]**
  - The pod-level `continuity_policy` block (`sync_triggers`, `artifacts`, `restore_protocol`) is validated and stored but **not enforced**. Only `continuity_state='restoring'` is read, by restore.
  - Stale samples can still drive the enforcer.
  - The `custom_prompt` error recommends deprecated names.

**Failure messages:**
- `mechanic is required for apprentice-handover; declare a canonical seat@rig at spec-default, profile, or member lifecycle level, then follow continuity/apprentice-cutover.md`
- `Managed compaction preparation threshold crossed for ${s}.` … `Deposit continuity context now with rig context recap-write before the enforcer reaches its compaction threshold; this nudge prepares and never compacts.`
- `Refused: no known context-usage sample for '${s}' yet; not triggering blind. Retry once telemetry is fresh.`
- `Prep was sent to '${s}' but it did not go idle in time, so /compact was NOT sent. Retry once the prep turn completes.`

**Storage:**
- `context_usage(node_id PK, session_id, session_name, availability, reason, source, used_percentage, remaining_percentage, context_window_size, total_input_tokens, total_output_tokens, transcript_path, sampled_at)`: migration 018.
- `watchdog_jobs.{watched_file_path, threshold_bytes, requires_job_id, last_fired_generation_uuid, watched_file_generation_uuid}`: migrations 074 and 075.
- `pods.continuity_policy_json` and `continuity_state`: migration 014.

---

## 15. TUI topology and population presentation

**OpenRig source:**
- `packages/tui/src/sections.ts:4-29`
- `packages/tui/src/daemon-client.ts:85-91,188-200`
- `packages/tui/src/hydrate.ts`
  - `:212-277` `toAgentRow`, which derives status
  - `:280-290` `groupPods`
  - `:361-368` named read errors
  - `:440-580`
- `packages/tui/src/state.ts:566-645`
- `packages/tui/src/navigator.ts:32-203`
- `packages/tui/src/topology/{glyphs,layout,render-graph,graph-types}.ts`
- `packages/tui/src/render.ts:134-152,339-350,580-830`

**Tests:**
- `packages/tui/test/topology-view.test.ts`: "honest-unknown ○ renders in the shipped graph view (never a fabricated ●)", "a rig without a hydrated graph renders honest-empty, never fabricated boxes", "pod containers wrap their member agent boxes and the rig container wraps all", "rig glyph is ▦ and pod glyph is ≡"
- `packages/tui/test/hydrate.test.ts`: "gives failed, attention, and needs-input truth precedence over terminal active/idle", "leaves a failed read honest-empty with a NAMED error; other sections still hydrate"

**Behaviour:**

*Reads.* The TUI is a pure client.
- `GET /api/rigs/summary`
- For the focused rig only, `GET /api/rigs/:id/nodes`
- `GET /api/rigs/:id/graph`, only on the graph tab. It returns ReactFlow-shaped `podGroup`/`rigNode` nodes and edges labelled by kind.
- `GET /api/rigs/:id/status`, only for non-running rigs
- `GET /api/activity/events` (SSE). A push only signals that something changed; the TUI then re-reads.

*Model:*
- `Host → Rig{lifecycleState, hasLiveAgents} → Pod (grouped by podNamespace, or "(no pod)") → AgentRow`.
- Only `nodeKind === "agent"` rows are shown. Terminal and infrastructure seats are hidden.

*Status precedence*, first match wins:
1. `startupStatus failed`: failed.
2. Attention required, or identity verdict `mismatch|pane_missing`: attention.
3. `needs-input`.
4. running or ready: active or idle.
5. Otherwise unknown.

*Glyphs:*
- Explorer and graph: `●` active or idle, `◐` attention or needs input, `○` unknown or detached, `✕` failed.
- Table: working, `◐` needs you, `⚑` blocked, `✕`, `·` idle, `○` detached, `?` unknown.
- The rig is `▦`: bright if it has live agents, grey if none, `?` if unknown. The pod is `≡`.
- Tree guides are `┃ ┣━ ┗━`. Agent labels drop the pod prefix.

*Tabs:*
- **TABLE**: columns `RIG POD SEAT RT CTX STATE Q WORK NOW`. The footer reads `N rigs · N seats · N working · N need attention · N open rows`.
- **GRAPH**: nested boxes, rig then pod then agent. Pods are ordered by delegation rank. Edges are coloured by kind.
- Also RECENT, OVERVIEW, HEALTH and PULSE.

**Key invariants:**
- Absence renders as `○`, `—` or `?`, never as `●`.
- A failed read becomes a named `readErrors` entry, and that region stays empty.
- **[drift]** The section registry and a comment say the TUI reads `/api/ps`, but hydrate never calls it.

**Empty and failure states:**
- `(no rigs served — proven empty, not fabricated)`
- `✕ rigs read failed — named in the status line (honest-empty, not fabricated)`
- `Inventory unavailable for ${rig.name} · refresh to Retry`
- `  (no topology graph served — honest-empty, never fabricated)`
- `Bright ▦ live agents · gray ▦ none · ? unknown`

---

## 16. Herdr terminal provider and topology composition

**OpenRig source:**
- `packages/daemon/src/domain/terminal/terminal-provider.ts:22-110`: the contract
- `packages/daemon/src/domain/terminal/view-composer.ts:34,62-185`: a pure composer
- `packages/daemon/src/domain/terminal/terminal-service.ts:144-301`: view resolution
- `packages/daemon/src/domain/terminal/terminal-views-store.ts:74-203`
- `packages/daemon/src/domain/terminal/herdr-adapter.ts:98-381`
- `packages/daemon/src/domain/terminal/herdr-transport.ts:56-171`: socket path (checked)
- `packages/daemon/src/domain/terminal/cmux-provider-adapter.ts:63-136`
- `packages/daemon/src/routes/terminal.ts:29-113`
- `packages/cli/src/commands/terminal.ts:57-137`
- `packages/tui/src/terminals/terminal-model.ts:39-134`

**Tests:**
- `packages/daemon/test/terminal-provider-ride.test.ts`: "local live seat → tmux attach -t (no -r)", "http host → NO pane, honest-degrade", "paging caps at 9 (3×3) panes per page", "openView refuses herdr_unavailable when the socket is dead — and sends NOTHING", "openView = fresh workspace.create then ONE atomic layout.apply per page", "REGRESSION: only socket methods ever — the absent CLI `herdr layout apply` cannot pass again"
- `packages/daemon/test/terminal-service.test.ts`
- `packages/daemon/test/terminal-routes.test.ts`
- `packages/cli/test/terminal.test.ts`
- `packages/tui/test/terminal-journey.test.ts`: "refuses a changed plan before any launch, then allows a fresh preview"

**Behaviour:**

*What herdr is.* An external terminal multiplexer. OpenRig drives it at arm's length over herdr's unix control socket.
- Socket path, first hit wins:
  1. `$HERDR_SOCKET_PATH`
  2. `~/.config/herdr/sessions/$HERDR_SESSION/herdr.sock`
  3. `~/.config/herdr/herdr.sock`
- Protocol: newline-delimited JSON `{id, method, params}`. One connection per request, 5 s timeout.
- Methods used: `ping`, `workspace.create`, `layout.apply`.
- `cmux` is the alternative provider. tmux is **not** a provider: every pane simply runs a composed `tmux attach`.

*Composition pipeline*, which keeps semantic topology separate from rendering:
1. **Resolve the view argument.**
   - Accepted forms: `saved:<id>`, `mission:<id>` or `slice:<id>` (read-only), `pod:<rig>/<pod>`, `rig:<x>` or a bare rig name, a bare saved-view id.
   - Anything else: `view_not_found`.
2. **Take rows from the node inventory**, as `{canonicalSessionName, attachmentType, rigName, logicalId}`.
3. **`deriveViewMembers`** keeps only tmux-attached seats that have a session. The pane label is `logicalId`.
4. **Check liveness** with `has-session`.
5. **`composeView`** sorts each seat into one of three buckets:
   - **opened**, with pane command `tmux attach [-r] -t '<s>'`, or `ssh '<user@host>' tmux attach …` for ssh hosts
   - **degraded**: an http or unknown host, or an ssh destination that looks like an option
   - **absent**: no session, or a dead session

   Opened panes are paged 9 per page.
6. **Render with the provider.**
   - herdr creates a fresh workspace per open, labelled `openrig:<view>#l<N>`.
   - It then sends one atomic `layout.apply` per page. The layout is an equal grid: `cols = ceil(sqrt(N))`, with rows combined downward and empty cells padded.

*What the provider never sees.* Pods, edges and roles. Topology reaches the provider only as the view scope and the pane labels.

*Preview before open.*
- `GET /api/terminal/preview` returns a `planId`, which is a sha256 of the plan. It has no side effects.
- `POST /api/terminal/open` with `expectedPlan` refuses `preview_changed` if the plan has drifted since the preview.

**Key invariants:**
- One composer serves every view kind.
- Every requested seat ends up opened, absent or degraded, and the result says which.
- A relaunch never replaces a previous workspace.
- A page is atomic: if the page fails, all of its seats are degraded.
- Derived views are never persisted. Saved views live in `$OPENRIG_HOME/terminal-views.yaml`.
- **[drift]**
  - Non-tmux rows are dropped silently from derived views.
  - The CLI help omits the `pod:`, `rig:` and `saved:` forms.

**Failure messages:**
- `herdr control socket is not answering ping; is herdr running?` (`herdr_unavailable`, returned as HTTP 200 with `ok:false`)
- `herdr workspace.create failed: ${msg | "no workspace id in the response"}`
- `cmux is not connected — install cmux from https://cmux.io and run: cmux ping`
- `unknown provider '${providerName}' — expected herdr or cmux` (400)
- `View membership or layout changed. Refresh the preview before Open; nothing was launched.` (409)
- `unknown view '${view}' — not a known rig, a mission:/slice: scope, or a saved-view id` (404)
- `host ${h} is http-registered; tiles need ssh`
- `tmux session ${s} is not alive`
- TUI: `Herdr unavailable on the selected daemon host. Start/connect Herdr there, then refresh this preview. No automatic recovery.`

---

## 17. Failure messages: current state and the next valid operation

**OpenRig source (helpers):**
- `packages/cli/src/cli-error.ts`
  - `:87-138` `renderDaemonTransportError`
  - `:141-175` `runProgram`: under `--json` it prints a JSON error object and exits nonzero
  - `:69-73` `formatCliError` returns `{ok:false, error:{code, message}}`
- `packages/cli/src/daemon-lifecycle.ts:74-147`: `DaemonNotRunningError{fact, consequence, action}`, `statusGuardMessage` and `daemonStatusGuard`, the single precheck used by every command
- `packages/cli/src/commands/workflow-errors.ts:12-117`: `describeDaemonRejection` maps error codes to three-part messages, and `formatThreePart` renders them
- `packages/cli/src/commands/workflow.ts:71-104`: `OutcomeSummary{what, state, next}`, printed as `what:/state:/next:` after every mutating workflow command
- The three-part `emit3PartError` / `emitBodyResolveError` shape: `packages/cli/src/commands/workspace.ts:68` and `packages/cli/src/commands/queue.ts:293`
- Daemon side: `QueueRepositoryError(code, message, meta{currentState, requestedState})` at `packages/daemon/src/domain/queue-repository.ts:377-385`, and the code-to-HTTP map at `packages/daemon/src/routes/queue.ts:116-153`
- Seat lifecycle refusals carry `{error, message, guidance}` (see §4 and §5)

**Tests:**
- `packages/cli/test/response-integrity.test.ts`
- `packages/cli/test/slice15-cli-contract.test.ts`
- `packages/cli/test/d14-loud-queue-transport-failure.test.ts`
- `packages/cli/test/workflow-errors.test.ts`
- `packages/cli/test/daemon-lifecycle-status.test.ts`
- `packages/daemon/test/queue-blocker-refusal-shape.test.ts`

**Behaviour.** The convention has three parts:

| Part | Content |
|---|---|
| **fact** | What is true now, naming the current state. |
| **consequence** | What did or did not happen: "nothing was persisted", "the daemon was not contacted", or "outcome UNKNOWN". |
| **action** | The exact next command. |

Rendering:
- JSON: `{ok:false, error:{fact, consequence, action}}` or `{error:{…}}`.
- Human: `Error: <fact>` followed by two indented lines.

On the daemon side:
- Refusals carry a stable `code` and `meta`.
- HTTP status: 404 not found, 409 state conflict or ambiguity, 403 wrong owner, 400 bad input.
- CLI exit code: 1 for 4xx, 2 for 5xx.

Seat verbs use an older two-part variant: `message` plus `guidance` (for example `List seats with: rig ps --nodes`). Transport failures are worded by what the client actually knows: a daemon that did not respond is never reported as stopped.

**Key invariants:**
- Every refusal names the current state and one concrete next command.
- Refusals happen before any mutation, and the consequence line says so.
- An unknown outcome is reported as unknown ("may or may not have been applied"). It is never reported as failure or success.

**Representative messages:**
- `qitem ${id} is currently '${state}'; state='${requested}' would reopen a terminal row. Re-run deliberately with --reopen --note <reason>.`
- `Daemon not running.` / `This command needs a running daemon.` / `Run 'rig up' (it auto-starts the daemon), or 'rig daemon start'.`
- `Daemon did not respond — it may be busy or stopped (state not confirmed).` / `This command needs a responsive daemon; the outcome of proceeding would be indeterminate.` / `Re-check with 'rig daemon status'. If it is confirmed stopped, run 'rig up' or 'rig daemon start'.`
- `The command's outcome is UNKNOWN — it may or may not have been applied.` / `Re-check current state (e.g. 'rig queue show <id>'); if it repeats, inspect daemon health with 'rig daemon status' and the daemon logs. This is a bad response, not a stopped daemon.`
- Workflow `instance_not_active`: `The instance is ${state}.` / `Only an active instance can advance; terminal and waiting states reject projection.` / `If it is failed, redrive it: rig workflow resume <instanceId> --actor-session <you>. Otherwise inspect: rig workflow show <id>`
- `A concurrent writer advanced the instance first (expected version ${e}, actual ${a}).` / `This projection was rolled back whole; no partial state was written.` / `Re-read the current state (rig workflow trace <id>), then retry against it.`
- `${source} resolved to 0 bytes; an empty body is not a valid implicit queue payload.` / `The coordination command did not run, the daemon was not contacted, and nothing was persisted.` / `Pipe non-empty content to stdin, or pass a non-empty file with --body-file <path>.`
- The running-name guard (§1), the fresh-launch and stop refusals (§4), the handover refusals (§5) and the restore stop-and-ask (§13) all follow the same pattern.

---

## Storage summary (SQLite, `packages/daemon/src/db/migrations/`)

| Table | Migration | Role and key columns |
|---|---|---|
| `rigs` | 001 (+038 `workspace_json`, +042 `archived_at`) | `id`, `name`. The name is **not unique**. |
| `nodes` | 001 (+007/014/021/022/055/057/077) | The seat. `id` ULID, `rig_id`, `logical_id` with `UNIQUE(rig_id, logical_id)`, `runtime`, `model`, `cwd`, `pod_id`, `agent_ref`, `profile`, `resolved_spec_*`, `occupant_lifecycle`, `continuity_outcome`, `handover_result`, `previous_occupant`, `handover_at`, `session_source_json`. |
| `pods` | 014, 017 | `namespace`, unique per rig. `label`, `continuity_policy_json`. |
| `edges` | 001 | `source_id`, `target_id`, `kind`. A trigger keeps both ends in the same rig. |
| `bindings` | 002 (+019) | One row per node: `tmux_session/window/pane`, `attachment_type`, `external_session_name`, `cmux_*`. |
| `sessions` | 002 (+006/012/014/043/045/053) | Registrations. `id` ULID, `node_id`, `session_name` (not unique), `status` (`running`/`idle`/`unknown`/`detached`/`superseded`/`exited`), `origin` (`launched`/`claimed`), `startup_status`, `resume_type`, `resume_token`, `resume_provenance`, `restore_policy`. |
| `occupant_tenures` | 060 | The occupant ledger. `generation_uuid` UNIQUE, `UNIQUE(node_id, generation_ordinal)`, `kind`. |
| `seat_identity_verdicts` | 046 | One liveness verdict per node. |
| `self_host_identity` | 059 | Singleton row holding the daemon's host id. |
| `applied_launch_observations`, `…_invalidations` | 069, 070 | Per-generation launch posture, plus tombstones. |
| `node_startup_context` | 015 | The startup plan that restore replays. |
| `discovered_sessions` | 012, 013 | Unmanaged tmux panes: `active`/`vanished`/`claimed`. |
| `continuity_state` | 014 | Per pod and node. Read only by restore. |
| `queue_items` | 024 (+039/044/048/063/081) | See §11. Indexed on `(destination_session, state)`. |
| `queue_transitions`, `…_archive` | 025, 054 (+067/076/082) | Append-only log. The archive takes terminal rows after 30 days. |
| `queue_transition_wakes` | 073 | Park wake: `armed`/`fired` × `watchdog`/`timer`/`blocker`. |
| `inbox_entries`, `outbox_entries` | 026, 027 | Wake intents live in the outbox as `wake-intent-<qitem>`. |
| `chat_messages` | 016 | Per-rig room. |
| `context_usage` | 018 | Latest sample per node. |
| `watchdog_jobs`, `watchdog_history` | 031/032 (+063/066/074/075) | Generation-scoped jobs. |
| `snapshots`, `checkpoints` | 004, 005 | See §13. |
| `events` | 003 | Event bus. Holds the `restore.*`, `seat.*` and `node.*` lifecycle events. |

## Daemon HTTP routes, by behaviour

| Behaviour | Routes |
|---|---|
| Topology (1) | `POST /api/rigs/import[/validate\|/preflight\|/materialize\|/workspace]`, `POST /api/up`, `POST /api/rigs/:rigId/expand`, `POST /api/rigs/:rigId/pods/:podNamespace/members`, `GET /api/rigs[/:id][/graph\|/status\|/spec.json]`, `GET /api/rigs/summary` |
| Seats (3–5) | `GET /api/seat/status/:seatRef`, `POST /api/seat/{handover,set-model,launch,stop,clean,switch-client}/:seatRef`, `POST /api/sessions/:name/reconcile`, `POST /api/sessions/:ref/unclaim`, `POST /api/discovery/{scan,:id/bind,:id/adopt}` |
| Identity and peers (6–8) | `GET /api/whoami?nodeId\|sessionName[&compact=1]`, `GET /api/queue/whoami?session=`, `GET /api/ps`, `GET /api/rigs/:rigId/nodes[/:logicalId]` |
| Messaging (9–10) | `POST /api/transport/{send,capture,broadcast}`, `POST /api/ask`, `/api/rigs/:rigId/chat/{send,history,watch,topic,clear}` |
| Queue (11) | `POST /api/queue/create`, `POST /api/queue/:id/{claim,unclaim,update,handoff,handoff-and-complete,fallback}`, `GET /api/queue/{list,:id,:id/transitions,overdue,undelivered,watch}`, `/api/queue/inbox/*`, `/api/queue/outbox/*` |
| Restore (13) | `POST/GET /api/rigs/:rigId/snapshots[/:id]`, `POST /api/rigs/:rigId/restore/:snapshotId` (202), `GET /api/rigs/:rigId/restore/status/:attemptId`, `POST /api/rigs/:id/{up,launch-plan}`, `GET /api/restore-check` |
| Context (14) | `POST /api/compaction/trigger`, `GET /api/compaction/state`, `POST /api/watchdog/register`, `/api/context-packs/library/*` |
| Terminal (16) | `GET /api/terminal/{views,preview,status}`, `POST /api/terminal/open`, `POST /api/rigs/:rigId/terminal/open` |
| Events (15) | `GET /api/activity/events` (SSE) |

## Discrepancies worth knowing before porting

1. **Handover passes the wrong kind of value to the occupant-swap declaration.**
   - Handover passes a session ULID to `declareOccupantSwap` (`seat-handover-service.ts:1023`).
   - Fresh launch passes the tenure UUID (`seat-lifecycle-service.ts:548`).
2. **Handed-over successors are registered as adopted** (`origin='claimed'`). After a handover, `seat stop` and `seat launch --fresh` would refuse that seat. No test covers this.
3. **Tenure continuation dedup is unreachable.** Every re-bind or reconcile mints a new `adopt` generation.
4. **Several queue refusals return HTTP 500 instead of a 4xx.** The code-to-HTTP map omits `blocker_*`, `closure_fields_not_admitted` and `wake_*`.
5. **The pod-level `continuity_policy` block is validated but has no runtime effect.**
6. **Single-send `From:` lines can be forged.** On a single send the daemon passes the CLI-built `From:` through unverified. Only fan-out derives it from the header.
7. **Chat and queue routes have no bearer middleware**, and chat `/clear` is unauthenticated.
8. **Refocus has no CLI verb for on-demand use.** It is driven by an env var, which refocuses on every prompt while it stays set.
9. **The restore plan preview and execution disagree** for a token that has no resume type: the preview says `awaiting-decision`, but execution launches fresh-primed.
10. **Seat names can collide.** `{pod}-{member}` cannot be split back apart when an id contains `-`, and neither session names nor rig names are unique in the DB.
