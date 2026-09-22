# LOCAL INTEGRATION PROMPT — Jev + Redis NOW context for O:I #65

> **Publication state while this branch is under cloud verification:** the structure and commands in this handoff are derived from the implemented native cut. Before this file is merged, the delivery lead must replace the `__FINAL_*__` markers below with the exact accepted merge revisions and evidence run IDs. Do not execute a marker-bearing copy as an installed-world handoff.

You are the **local integration and live-provider agent** for the completed cloud Jev + Redis NOW-context delivery under:

- campaign: `EpiLogos/O-I#65`
- connective owner: `EpiLogos/O-I#220`
- primary implementation: `EpiLogos/ai-kit#388`
- AIKit PR: `EpiLogos/ai-kit#393`

The cloud implementation is complete only at the exact cut recorded below. Your task is to reconcile that delivered cut with this machine's existing O:I installation, run the installed/live-provider episode safely, repair only bounded integration defects at their native owners, and return evidence to #388/#220/#65. You are **not** commissioned to redesign the feature.

## Delivered cloud cut

Use these exact accepted revisions as the minimum delivered basis, while reconciling any newer compatible remote/local work:

- AIKit: `__FINAL_AIKIT_MERGE_SHA__` — PR #393
- Central: `__FINAL_CENTRAL_SHA__`
- Workcell: `__FINAL_WORKCELL_SHA__` — Redis NOW material hosting includes PR #98, merge `9d627ff4d90de2cddf237b14f9854a64e1b5819e`
- Factory: `__FINAL_FACTORY_SHA__`
- Actuation: `__FINAL_ACTUATION_SHA__`
- O:I handoff/publication: `__FINAL_OI_DELIVERY_SHA__`
- QL-MEF: no new Jev/Redis core was introduced for this first ordinary Factory use; retain the receiving installation's current compatible QL-MEF and source-owned meanings.

Cloud joined evidence:
- AIKit workflow: `.github/workflows/jev-redis-now.yml`
- reusable joined/live runner: `scripts/jev-redis/joined_proof.py`
- operator contract: `docs/JEV-REDIS-NOW.md`
- Workcell Redis contract: `docs/REDIS-NOW-SERVICE.md`
- final joined Actions run: `__FINAL_JOINED_RUN_ID__`
- final independent joined review artifact/run: `__FINAL_INDEPENDENT_REVIEW_RUN_ID__`
- O:I source/experience verification: `__FINAL_OI_VERIFY_EVIDENCE__`

Cloud controlled proof uses real AIKit, Central/ctrl, BKMR 7.6.7, Factory, Actuation and Redis 8.10. Only Jev inference is replaced by the production transport's explicit loopback-only `controlled-protocol` seam. Never relabel that result as live TypeSafe behavior.

## A. Preserve and understand this installation first

Do not reset, force-pull, clean, replace `main`, create a fourth Mac verifier tree, flush Redis, restart shared services, rewrite Central, or change an active Factory Run merely to make the test convenient.

1. Read the current local track/checkout restrictions and the current O:I #65/#220 sources. At minimum read:
   - `docs/positions/FOUNDING-POSITIONS.md`
   - `docs/experience/JEV-REDIS-NOW-INTEGRATION.md`
   - this file
   - `docs/experience/SESSION-GROUNDING.md`
   - `docs/experience/WORKCELL-NOW-TEMPORAL-FIELD.md`
   - `docs/experience/NOW-PARADIGM-RETURN.md`
   - the current #65/220 issue updates
2. Discover the authorised existing repository trees. Do not assume paths:
   ```sh
   pwd
   command -v ctrl aikit workcell factory actuation bkmr redis-server redis-cli || true
   ctrl root
   ctrl projects
   ```
   Use Central/AIKit native discovery plus the existing checkout restrictions to identify the current O-I, ai-kit, Central, Workcell, Factory, Actuation and QL-MEF trees.
3. For every receiving repository, record without mutation:
   ```sh
   git -C "$REPO" status --short --branch
   git -C "$REPO" rev-parse HEAD
   git -C "$REPO" rev-parse --verify origin/main
   git -C "$REPO" worktree list --porcelain
   git -C "$REPO" remote -v
   ```
   Preserve dirty files, local branches, in-flight worktrees, unpublished commits and active agents.
4. Record the actual installed binaries separately from source:
   ```sh
   aikit --version || true
   ctrl --version || true
   workcell --version || true
   factory --version || true
   actuation --version || true
   bkmr --version || true
   redis-server --version || true
   redis-cli --version || true
   ```
   Resolve their actual executable paths and digests. Source HEAD is not proof of the running binary.
5. Inspect active Factory/Day/NOW/session state through its current native readers. Do not close or reconstruct a living parent merely to integrate this feature. Record current participant/write-scope relations and any service whose restart would affect another participant.

## B. Reconcile the delivered revisions

For each owner, fetch remote refs without discarding local work. Compare local/current remote to the delivered revision above.

A safe pattern is:

```sh
git -C "$REPO" fetch origin
git -C "$REPO" merge-base --is-ancestor "__DELIVERED_SHA__" HEAD
git -C "$REPO" log --oneline --decorate --graph --max-count=30 HEAD origin/main
```

If the delivered commit is already an ancestor, keep the newer compatible local state. If not, integrate through the repository's established merge/rebase/cherry-pick/update route in an authorised existing tree. Never `git reset --hard`, force-pull, delete a dirty worktree, or replace local `main`.

Build/install through each repository's current native instructions. For AIKit, the baseline source build is:

```sh
cargo build --locked -p aikit-cli --bin aikit
cargo test --locked -p aikit-core -p aikit-store --lib
cargo test --locked -p aikit-core --test jev_protocol
cargo test --locked -p aikit-adapters --test jev_transport
cargo test --locked -p aikit-store --test redis_now_context
```

Then use the installation's established AIKit install/update route. Do not shadow a managed installed binary with a random `target/debug` path for the real episode.

Confirm the installed command surface:

```sh
aikit jev --help
aikit now-context --help
```

The required no-MCP path is native CLI/direct service. Do not add MCP as a prerequisite.

## C. Inspect and adopt/provision Redis through Workcell

### C1. Existing Redis first

Before provisioning anything, inspect existing Redis services and Workcell declarations:

```sh
workcell --state-root "$WORKCELL_STATE_ROOT" doctor --json
workcell --state-root "$WORKCELL_STATE_ROOT" discover --json
redis-cli -h 127.0.0.1 -p "$PORT" PING
redis-cli -h 127.0.0.1 -p "$PORT" INFO server
redis-cli -h 127.0.0.1 -p "$PORT" INFO persistence
redis-cli -h 127.0.0.1 -p "$PORT" CONFIG GET bind protected-mode appendonly appendfsync dir maxmemory maxmemory-policy
```

Do not expose secrets in receipts. If authentication is already configured, use its existing local credential mechanism rather than logging it in shell history.

Inspect the database/keyspace non-destructively. **Never use `FLUSHDB` or `FLUSHALL` for setup, tests, reset or teardown.** Never adopt a pre-existing database by overwriting its config or data directory.

### C2. Workcell-owned reference material

Workcell's built-in reference policy is Redis OSS **8.10 series**, loopback only:
- AOF enabled, `appendfsync everysec`
- finite `maxmemory`, minimum 64 MiB
- `maxmemory-policy noeviction`
- protected mode
- operator-selected RDB snapshots
- Workcell-owned data directory
- target-owned lifetime

For a new local service, resolve an unused port and real owner-approved absolute paths, then render/verify policy equivalent to:

```conf
bind 127.0.0.1
protected-mode yes
port 6381
dir /ACTUAL/WORKCELL/OWNED/redis-now/data
appendonly yes
appendfsync everysec
save 900 1
save 300 10
maxmemory 268435456
maxmemory-policy noeviction
stop-writes-on-bgsave-error yes
```

Use Workcell's existing declared-service setting rather than inventing a daemon. The complete declaration is documented in Workcell `docs/REDIS-NOW-SERVICE.md`. Preserve unrelated existing declared services because `workcell.declared-services` is a whole-list setting.

Validate, preview and apply:

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

Then use the ordinary Workcell discovery/plan/prepare/reconcile path to require the service. Workcell may stop only a service it actually owns. Removing a dedicated data directory is a separate authorised filesystem operation after required Return/continuation is durable and after an operator-approved backup.

A remote Redis is **not** the built-in profile. Reuse a remote deployment only when its existing Workcell generic service declaration and AIKit transport have an explicit authenticated/encrypted boundary. Never make the loopback reference service reachable on `0.0.0.0`.

### C3. AIKit Redis consumer config

Create the receiving AIKit config from the actual service observation:

```json
{
  "schema": "aikit.redis-now-config/v1",
  "address": "127.0.0.1:6381",
  "database": 0,
  "key_prefix": "aikit-now",
  "username": null,
  "credential_ref": null,
  "allow_remote": false,
  "connect_timeout_ms": 1000,
  "io_timeout_ms": 1000,
  "prepared_ttl_seconds": 21600,
  "coordination_retention_seconds": 1209600
}
```

If the real deployment uses ACL authentication, set `username` and a native `credential_ref`; do not put a password in the endpoint or committed config.

Verify:

```sh
aikit --json now-context status --config-file "$REDIS_NOW_CONFIG"
```

Record the returned Redis version, address/database/prefix and actual enhancement/degradation standing.

## D. Resolve Jev credentials through AIKit

Never copy a key from another machine, scrape shell history, commit a key, or publish raw credentials.

Inspect native safe binding metadata:

```sh
aikit --json credential list
aikit --json credential discover
```

Use an existing semantic credential binding if it is correct. Otherwise declare the real local secure-store reference explicitly, e.g. a supported `keychain://`, `pass://`, `varlock://` or `op://` reference:

```sh
aikit --json credential setup typesafe-jev \
  --consumer operator:aikit \
  --purpose "Jev System One provider authentication" \
  --ref "$REAL_SECRET_REF"
```

Use `env://` only as a deliberate local test import with `--allow-env-import`; it is not the normal persistent secret route.

Before any live provider call:

```sh
aikit --json credential explain typesafe-jev \
  --consumer operator:aikit \
  --purpose "Jev System One provider authentication"
```

Resolve the actual SecretRef from the safe binding/result. Set an explicit finite test budget. The cloud cut pins/validates the returned semantic model version rather than assuming an alias served the requested version.

The implementation was checked against TypeSafe's current official API surface on 22 September 2026:
- `POST https://api.typesafe.ai/v1/systemone`
- Bearer authorization
- typed Noul / Choice / Score questions
- response contains actual `model`, complete `answers`, and `usage`
- current public launch pricing: $0.042 per million input tokens, output free

The local live episode must still record the actual returned model and actual usage. Provider conditions can change.

## E. Confirm native preparation and automatic harness delivery

The general Jev path is available independently:

```sh
aikit --json jev invoke \
  --request-file "$JEV_REQUEST" \
  --limits-file "$JEV_LIMITS" \
  --credential-ref "$JEV_SECRET_REF"
```

Do not add `--controlled-endpoint` in the live episode. That flag is a loopback-only deterministic protocol seam and its receipts are explicitly `controlled-protocol`.

The prepared NOW surface is:

```sh
aikit --json now-context prepare --request-file "$PREPARE_REQUEST"
aikit --json now-context inspect \
  --config-file "$REDIS_NOW_CONFIG" \
  --participant-ref "$PARTICIPANT_REF"
```

Preparation consumes real Central `central.now.read` / `central.file-map.resolve`, BKMR-backed source identity, AIKit Knowledge/Wiki readings, and Factory developmental reads. A prepared view retains:
- exact source/dependency/disclosure/Factory basis and digest
- participant + AgentSession identity
- selected source/Wiki routes/passages
- Factory Run/Journey/WorkflowUnit meaning including required difference/Return/verification, praxis/capability refs, dependencies and permitted effects
- nearby participants/dependencies/Returns
- continuation/cursor
- Jev invocation ref when Jev selection was used

The configured EncounterProvider performs preparation/delivery **before the provider turn** and records the exact prepared version/digest accepted for delivery. Do not tell the worker to remember a “plan context” tool call. Inspect the delivery receipt to prove which version reached the harness.

Selected-but-unavailable Redis/Jev must show real degradation/failure. No-Redis/no-Jev operation remains available where those enhancements are not selected.

## F. Run disposable local proof before touching live work

Use the delivered runner instead of inventing fixtures:

```sh
python3 scripts/jev-redis/joined_proof.py --help
```

First run it against disposable local material. Supply the **installed/coherent delivered** binaries for:
- AIKit `aikit`
- Central `ctrl`
- real BKMR
- Factory `factory`
- Actuation `actuation`
- a disposable Redis service/database/prefix
- the Factory repository's real `contracts/factory/fixtures/oi-self-hosting-state.json`

Run controlled mode first. It uses the production Jev transport's explicit loopback test boundary and must report `controlled-protocol`, never live-provider standing.

The runner covers:
- ordinary-context arm
- Redis-prepared/no-Jev arm
- Jev-assisted arm
- general typed Jev question outside documentation practice
- multi-capability selection and a catalogue-insufficiency finding
- actual Central source registration/BKMR resolution and NOW allocation
- actual Factory Run/WorkflowUnit reading
- Actuation invocation/usage/Activity correlation
- distinct implementer/related/verifier views
- verifier-private canary isolation
- related-worker Return/change delivery
- fresh-session continuation
- stale CAS refusal
- source changed while Jev is in flight
- malformed provider response
- disclosure revocation
- durable Wiki/practice Return
- later fresh participant consuming the revised Wiki field

Then restart only the **disposable** Redis service over the same data directory and confirm state/replay survives. Replay a notification and confirm no duplicate effect. Do not use live Factory state for destructive/recovery tests.

## G. Run the live-provider comparison and first real Factory undertaking

When the bounded existing Factory/Day/NOW route is usable, run the same runner in live mode with:
- the actual Jev credential ref
- a finite `--jev-budget-microusd`
- current real AIKit/Central/BKMR/Factory/Actuation binaries
- real admitted Agency/Actuation/AgentSession refs supplied to the runner's Actuation options
- a disposable Redis key prefix for the comparison unless the actual undertaking is explicitly selected for the episode

Do not pass `--controlled-endpoint`.

Preserve the three matched arms:
1. ordinary context
2. Redis-prepared context without Jev selection
3. Jev-assisted preparation

Hold task/source/worker-model conditions comparable. Record observed:
- context discovery calls
- time to first useful action
- source omissions
- stale decisions
- duplicated work
- handover success
- corrections
- acting-model/Jev/retrieval token/cost/latency where genuinely available

Do not manufacture unavailable worker-model or monetary metrics. Actuation's model-usage record may retain provider-reported tokens and observed latency; do not label tariff-derived cost as observed cost without its exact pricing basis.

For the first real Factory undertaking, use bounded child NOWs for:
- implementer
- related worker
- independent verifier

Keep verifier expectations and sibling-private material out of worker preparation. Known dependencies/write scopes come from native owner relations. Semantic Jev relevance never grants a write.

Exercise:
- relevant source/contract change
- related-worker Return
- affected participant delta
- fresh admitted session handover without parent reconstruction
- stale preparation refusal
- Redis restart/recovery at a coordinated boundary
- warranted Wiki/practice Return
- later participant using the revised field

If reservations are enforced, validate current ownership/generation/source basis before native writes. If shell work is merely cooperatively coordinated, report that distinction. Lost presence is uncertainty, never overwrite authority.

## H. Durable Return and document/matrix practice

Use actual results/corrections/questions to decide what remains:
- task-local
- active NOW material
- Wiki knowledge
- practice
- account/matrix pressure

Perform only authorised native updates. Preserve stable identities, companion-file coherence, unknown fields, source revisions and recoverable partial-write behavior.

A Jev classification that the current catalogue is insufficient is **pressure/proposal**, not permission to silently rewrite human-authored account/matrix ground. Human authored positions and required human EX remain human decisions.

Retain consequential Return through Central/Factory/Actuation owners before releasing hot Redis material. Waiting child NOWs must survive session closure/Day rollover according to the existing temporal protocol.

## I. Repair bounded integration defects at their native owners

If the local run exposes an implementation defect:
1. identify the actual owner
2. reproduce it with a focused native test
3. repair it in an authorised existing owner tree
4. run focused + affected cross-product checks
5. publish the exact follow-up commit/PR
6. update #388/#220/#65 with source/build/install/running basis

Do not build a replacement Python/Node orchestration service, second Wiki, second workflow store, second capability registry or unrecorded “temporary architecture.”

If the cloud delivery itself is materially incomplete, say so and return the exact missing requirement to #388/#220. Do not silently compensate with local-only architecture.

## J. Evidence return

Return a redacted/public receipt to the existing evidence path containing:

- source revisions integrated for AIKit/Central/Workcell/Factory/Actuation/O:I/QL-MEF
- exact installed binary paths/versions/digests
- Workcell Redis material/service/config revision and actual Redis version
- Central/BKMR revision and source/NOW refs used
- Factory Run/Journey/WorkflowUnit refs and participant relations
- AIKit prepared versions/digests actually delivered
- Jev requested + actual returned model version, attempts, usage, bounded spend receipt
- Actuation invocation/Activity/usage refs
- controlled vs live evidence standing
- disposable Redis restart/replay result
- three-arm comparison observations
- failures, recoveries and corrections
- durable Wiki/practice Return and subsequent participant reuse
- human experience judgment where #65 requires it
- remaining two-Workcell/SharedField/advanced-QL obligations still open

Keep private source payloads, secrets, verifier canaries and personal machine paths out of public receipts.

Post the final local result to:
- `EpiLogos/ai-kit#388`
- `EpiLogos/O-I#220`
- `EpiLogos/O-I#65`
and any native owner issue whose implementation was actually changed.

Do not close the broader #65/#220 programme merely because this first Jev + Redis NOW episode is successful. Preserve the foundation-first broad-fan-out gate and later physical two-Workcell/SharedField obligations.
