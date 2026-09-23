# Jev + Redis NOW local integration prompt

**Campaign:** EpiLogos/O-I#65  
**Connective owner:** EpiLogos/O-I#220  
**Primary cloud implementation:** EpiLogos/ai-kit#388 / PR #393  
**Purpose:** integrate the completed cloud Jev + Redis NOW-context cut into the existing installation, then run installed/live-provider evidence without replacing or resetting local work.

This is an execution handoff. Do not redesign the architecture or redo routine cloud implementation.

## Published cloud basis

Reconcile these exact remote revisions with whatever has advanced when this prompt is run:

- AIKit candidate delivery PR #393: `13dcb7b6488a88f3e0143a1876af7021adbc37f7` (use the merged successor of PR #393 if the PR has merged).
- Central main: `1d5cd52109bda59e440a66db29723fd5412b67d6`.
- Workcell main: `063bc15a56851b921a34437e13daa1a0f5327921`; Redis NOW material service landed in PR #98 / `9d627ff4d90de2cddf237b14f9854a64e1b5819e`.
- Factory main: `e2d16dbdfabec4157e47028d1bbe7a8cf7b8fc59`.
- Actuation main: `161b869740c54dc325ad1d6aef765dbf32920073`.
- QL-MEF main: `89ca4088ea47fe626c23c2b11efe2d38bdfcd1f7`.
- O:I handoff basis: `6bd649761185d4fcf48249eea94599e05a9b33fe`.

Dependency order for the local cut is:

```
Central + Factory + Actuation + Workcell current owner contracts
        ↓
AIKit PR #393 Jev / Redis NOW consumer + encounter delivery
        ↓
O:I #65 local installed-world and live-provider episode
```

Do not wait for advanced QL/EBM/Prime work, full desktop completion, or the later physical two-Workcell proof before running the first ready single-Workcell episode.

## 1. Preserve the actual installed World first

Inspect the existing installation before changing anything.

1. Read the current local track/checkout restrictions and reuse the authorised O:I/native repository trees. Do **not** create a fourth Mac verifier workspace.
2. For every relevant repository, record:
   - checkout path;
   - current branch and HEAD;
   - dirty/staged/untracked work;
   - worktrees;
   - remotes;
   - local commits not on the intended remote branch.
3. Record the current running Factory/Day/NOW/session state, active AgentSessions/SessionSpaces, current Workcell services, Central root and current BKMR/source-map state.
4. Do not run `git reset --hard`, `git clean`, force-pull, delete worktrees, terminate unrelated sessions, or replace local main.
5. If a repository has active unrelated work, integrate by normal merge/rebase/cherry-pick in the authorised tree only after preserving that state.

Use the installed commands to discover paths instead of guessing them:

```sh
command -v aikit || true
command -v ctrl || true
command -v workcell || true
command -v factory || true
command -v redis-server || true
command -v redis-cli || true
command -v bkmr || true
```

Resolve the real Central root from the existing installation/configuration. Central remains the root meta-Project; do not reinterpret it as a child Project or configuration directory.

## 2. Reconcile and install the delivered source

Fetch without resetting local work.

For AIKit, integrate PR #393 or its merged successor. Verify that the integrated source contains:

```
crates/aikit-core/src/jev.rs
crates/aikit-adapters/src/jev.rs
crates/aikit-store/src/now_context.rs
crates/aikit-cli/src/jev_now.rs
crates/aikit-cli/tests/now_context_encounter.rs
crates/aikit-store/tests/redis_now_context.rs
crates/aikit-adapters/tests/jev_transport.rs
scripts/jev-redis/joined_proof.py
docs/JEV-REDIS-NOW.md
.github/workflows/jev-redis-now.yml
```

Confirm the current installed Workcell contains `docs/REDIS-NOW-SERVICE.md` and the exported `redis_now_service` / `redis_now_config_policy` helpers.

Build/install through the repository's established native route. At minimum, in a clean build context for the reconciled checkout:

```sh
cargo test --locked -p aikit-core --test jev_protocol -- --nocapture
cargo test --locked -p aikit-adapters --test jev_transport -- --nocapture
cargo test --locked -p aikit-store --test redis_now_context -- --nocapture
cargo test --locked -p aikit-cli --test now_context_encounter -- --nocapture
cargo test --locked -p aikit-cli --lib -- --nocapture
cargo build --locked -p aikit-cli --bin aikit
```

Run the affected repository verification commands required by the current repo before replacing an installed binary. Record source SHA, binary path/digest and actual running version separately.

## 3. Inspect or provision Redis through Workcell

First inspect whether a Redis service already exists. Record:

- Redis version;
- bind/listen addresses;
- ACL/auth/TLS boundary;
- persistence mode;
- data directory;
- maxmemory and eviction policy;
- whether the database contains pre-existing keys;
- whether Workcell already owns the service declaration.

Never use `FLUSHDB` or `FLUSHALL`. Never overwrite or delete a pre-existing database as test setup/cleanup.

The built-in Workcell reference profile is loopback-only. It requires AOF persistence, finite maxmemory and `maxmemory-policy noeviction`. A remote Redis must remain an explicit operator-owned service with its own authenticated/encrypted boundary.

If a dedicated Redis NOW service is needed, use the delivered Workcell declared-services configuration path from `Workcell/docs/REDIS-NOW-SERVICE.md`.

Resolve real values first, then validate, plan and apply:

```sh
workcell --state-root "$WORKCELL_STATE_ROOT" config validate --json \
  --setting workcell.declared-services \
  --value-file redis-now-services.json

workcell --state-root "$WORKCELL_STATE_ROOT" config plan --json \
  --setting workcell.declared-services \
  --value-file redis-now-services.json > redis-now-plan.json

workcell --state-root "$WORKCELL_STATE_ROOT" config apply --json \
  --plan-file redis-now-plan.json \
  --changeset redis-now-adoption
```

The Redis service configuration must preserve existing unrelated declared services. For a dedicated 256 MiB local service, the delivered reference policy is equivalent to:

```conf
bind 127.0.0.1
protected-mode yes
port <chosen-free-port>
dir <absolute-workcell-owned-data-directory>
appendonly yes
appendfsync everysec
save 900 1
save 300 10
maxmemory 268435456
maxmemory-policy noeviction
stop-writes-on-bgsave-error yes
```

Take an operator-approved backup before adopting/replacing persistent material. Cleanup is owner-scoped and reversible; stopping a service does not imply deleting its data.

## 4. Configure AIKit Redis NOW

Create a local configuration using actual discovered values:

```json
{
  "schema": "aikit.redis-now-config/v1",
  "address": "<host:port>",
  "database": 0,
  "key_prefix": "<installation-specific-prefix>",
  "username": null,
  "credential_ref": null,
  "allow_remote": false,
  "connect_timeout_ms": 1000,
  "io_timeout_ms": 1000,
  "prepared_ttl_seconds": 21600,
  "coordination_retention_seconds": 1209600
}
```

For authenticated Redis, use the native `credential_ref` mechanism. Do not put secrets in the endpoint, command history, prompt or public evidence.

Confirm:

```sh
aikit --json now-context status --config-file redis-now.json
```

The command must report the actual Redis version and selected address/database/prefix. Selected-but-unavailable Redis must be reported as degradation/failure, not silently treated as the enhanced path.

## 5. Resolve Jev credentials and finite live budget

The production Jev surface is:

```sh
aikit --json jev invoke \
  --request-file jev-request.json \
  --limits-file jev-limits.json \
  --credential-ref '<native-secret-ref>'
```

Use the existing native secret mechanism (`varlock://`, `pass://`, `keychain://`, `op://`; `env://` only with the explicit opt-in intended by the local setup). Keep secret material local.

Before any live provider call, set an explicit finite `JevLimits` budget. The request must use the model selected for the episode and the response must report its actual returned model/version and usage. Missing/malformed/incomplete answers are failures.

Do not run live calls until the deterministic/controlled suites below pass.

## 6. Prepare real participant-specific context

Construct the preparation request using the actual Central, Factory, NOW and participant identities discovered locally:

```json
{
  "schema": "aikit.now-preparation-request/v1",
  "redis": { "<actual>": "aikit.redis-now-config/v1 values" },
  "project_ref": "<real ProjectRef>",
  "now_ref": "<real child/root NOW ref as appropriate>",
  "participant_ref": "<real participant ref>",
  "agent_session": "<real AgentSession ref>",
  "concern": "<the bounded Factory undertaking>",
  "disclosure_revision": "<current disclosure/policy revision>",
  "practice_refs": ["<actual selected practices>"],
  "central": {
    "root": "<resolved Central root>",
    "project": "<actual project id or null>",
    "ctrl_bin": "<resolved ctrl binary>",
    "source_refs": ["<actual source refs>"]
  },
  "factory": {
    "state": "<actual Factory provider state>",
    "run_ref": "<actual Run ref>",
    "factory_bin": "<resolved factory binary>",
    "workflow_unit_refs": ["<actual workflow unit refs>"]
  },
  "wiki_queries": ["<bounded relevant queries>"],
  "candidate_items": [],
  "continuation": null,
  "expected_version": 0,
  "external_provider": true,
  "allow_redis_env_import": false,
  "selection": { "mode": "all" }
}
```

First prove the non-Jev Redis-prepared path:

```sh
aikit --json now-context prepare --request-file prepare.json
aikit --json now-context inspect \
  --config-file redis-now.json \
  --participant-ref '<participant-ref>' \
  --external-provider
```

Then run Jev-assisted selection with the same task/source/actor conditions by changing only the selection mode and supplying the bounded Jev state/credential/limits.

## 7. Enable automatic delivery through the actual encounter provider

Do not make workers remember to call `now-context prepare`.

The delivered provider configuration adds:

```json
"now_context": {
  "redis": { "<actual>": "aikit.redis-now-config/v1 values" },
  "prepare_request": "<absolute path to owner-authored preparation request>",
  "required": true,
  "external_provider": true
}
```

Reconcile this with the existing provider JSON rather than replacing unrelated provider settings. Configure it through the owner-only route:

```sh
aikit session-space encounter-configure --provider-json '<provider-json>'
```

Use the exact current command spelling shown by `aikit --help` if the enclosing command namespace has advanced.

Open/re-enter the supported encounter path and prove that:

1. preparation occurs before the first relevant provider turn;
2. a warm read does not call Jev again;
3. the provider receives the prepared participant view;
4. AIKit records the prepared version/digest actually accepted for delivery;
5. fresh-session continuation can advance the same participant by CAS;
6. verifier-private material is absent from worker delivery.

## 8. Run deterministic and real-service acceptance before live inference

Run the native tests listed in section 2 and the joined runner:

```sh
python3 scripts/jev-redis/joined_proof.py \
  --aikit '<resolved rebuilt aikit>' \
  --ctrl '<resolved rebuilt/current ctrl>' \
  --bkmr '<resolved bkmr>' \
  --central-repo '<resolved current Central repository checkout>' \
  --factory '<resolved rebuilt/current factory>' \
  --factory-state '<disposable Factory fixture/state>' \
  --actuation '<resolved rebuilt/current actuation>' \
  --redis-address '<disposable Redis host:port>' \
  --jev-mode controlled \
  --output '<evidence path>/joined-proof.json'
```

Use disposable Redis material for this proof. The runner must cover real AIKit + Central + BKMR + Factory + Redis and controlled Jev transport.

For the credentialed local Jev episode, run the **same** runner with `--jev-mode live`, add `--jev-credential-ref '<native-secret-ref>'`, set `--jev-model` to the concrete admitted model/version and set an explicit finite `--jev-budget-microusd`. Use `--agency-ref`, `--actuation-ref`, `--activity-ref`, `--actuation-stream-ref` and `--actuation-session-ref` when binding the proof to already-admitted local owner identities instead of the controlled defaults. Do not copy credentials into the request fixture or public evidence.

Exercise and retain evidence for:

- implementer / related-worker / verifier participant isolation;
- multi-capability selection;
- a need the current catalogue does not sufficiently represent;
- source/dependency/Return change delivery;
- fresh AgentSession continuation;
- stale expected-version refusal;
- source change during Jev refusing late publication;
- malformed/missing provider answer refusal;
- disclosure revocation;
- Redis restart with persisted records;
- duplicate/replayed notification handling;
- selected-but-unavailable degradation.

## 9. Execute the three matched comparison arms

Use the same real bounded undertaking, source basis and worker model:

1. ordinary context;
2. Redis-prepared context without Jev selection;
3. Jev-assisted preparation.

Record only observed metrics:

- context-discovery calls;
- time to first useful action;
- source/capability omissions;
- stale decisions;
- duplicated work;
- continuation/handover success;
- corrections;
- acting-model usage/cost where actually reported;
- Jev usage/cost where actually reported;
- retrieval calls/latency where observed.

Unavailable metrics remain unavailable; do not invent zeros or derived provider costs without a price source.

Keep the independent verifier's expected result outside worker preparation.

## 10. Run the first real Factory episode

Once the existing bounded Factory/Day/NOW route is usable, execute one real ordinary Factory development undertaking with:

- implementer child NOW;
- related-worker child NOW;
- independent verifier child NOW;
- exact declared write scopes and dependencies;
- real source/contract change;
- related Return;
- fresh-session continuation;
- Redis restart/recovery;
- a warranted document/Wiki/practice Return.

Do not introduce another scheduler or Factory workflow store.

Where a Redis-backed reservation is actually enforced, validate current owner/generation/source basis before the write. External shell work that is merely cooperatively coordinated must remain described as such; lost presence is uncertainty, not overwrite authority.

## 11. Knowledge / document Return

Use actual results, corrections and unresolved questions to decide what remains:

- task-local;
- active NOW continuation;
- source-linked Wiki knowledge;
- practice improvement;
- account/matrix pressure.

Jev may classify the relation; it does not author the change. Perform authorised source/Wiki/practice/document operations through the existing owners and preserve stable identities, source revisions, companion-file coherence and unknown fields.

Demonstrate one later fresh participant using the revised field.

## 12. Safety during integration

- Coordinate restarts/writes at the affected native owner boundary.
- Preserve the existing #65 foundation-first broad-fan-out gate.
- Do not stop unrelated sessions/services.
- Do not expose private payloads, credentials or verifier canaries in public evidence.
- Do not flush Redis.
- Do not mistake namespace/key prefixes for disclosure authority.
- Revalidate disclosure at preparation **and** delivery.
- Reconcile uncertain effects/reservations after restart before retry.

If a bounded integration defect is found, repair it at the native owner, rerun the affected tests, publish the exact follow-up commit/PR, and update the evidence path. Do not invent a replacement architecture locally.

## 13. O:I source checks

From the reconciled O:I repository:

```sh
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover \
  -s tests/experience -p 'test_*.py' -v

python3 scripts/experience_map.py
```

These source checks accompany runtime proof; they do not replace Redis/BKMR/Factory/harness/live-provider evidence.

## 14. Return evidence

Return the exact:

- source revisions;
- built binary versions and hashes;
- installed/running binary paths and versions;
- Central/BKMR source basis;
- Workcell Redis configuration/version/persistence standing;
- Factory Run/Journey/workflow/participant refs;
- prepared and delivered context version/digest;
- controlled test outcomes;
- live Jev returned model/version/usage/cost;
- worker-model usage/cost where reported;
- recovery/restart observations;
- document/Wiki/practice Returns;
- remaining environment-only or human-recognition obligations.

Publish redacted receipts to AIKit #388 and O:I #220/#65. Keep broader programmes open unless their own acceptance is independently satisfied.
