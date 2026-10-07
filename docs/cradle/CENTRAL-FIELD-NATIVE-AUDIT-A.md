# Central Field — native audit A: Workcell/Factory independence of local Kev, Redis preparation, body placement and local serving

Packet: Actuation #132 (EF1), under O:I #592 / repair ledger #598. Author: Sonnet A, 6 October 2026.
Method: current source and live machine state read directly; every row cites a path and symbol (or a command and its output). Nothing here is claimed from memory.

Revisions read:

| Repo | Seat | Branch | HEAD |
|---|---|---|---|
| AIKit | `worktrees/env-1/ai-kit` | `feat/central-field-ai-kit` | `1bf1f02a7a20` (+ this packet's uncommitted changes) |
| Actuation | `worktrees/env-1/actuation` | `feat/central-field-actuation` | `2139d78ceed1` (unchanged) |
| O:I | `worktrees/env-2/o-i` | `feat/central-field-base` | `0ba932d37c4e` (read only, plus this file) |

Classification used below:

- **H** hard dependency: an executable, service, installed tool root or lifecycle that exists only through the Workcell product (or a Factory run) and whose absence changes behaviour.
- **S** soft: the code asks Workcell/Factory and degrades visibly when it is absent.
- **L** location metadata: "Workcell" is the name of a NOW location (`workcell:mac` from `Control/machines/current.json`), not the product.
- **G** gap that is not a Workcell coupling but blocks the commissioned outcome.
- **N** checked and clean.

## 0. What is live on this machine (and what that does and does not prove)

These were run read-only against the owner's installed, Workcell-managed services:

```text
$ aikit --json now-context status --config-file ~/.aikit/redis-now.json
{"address":"127.0.0.1:6381","available":true,"database":0,"key_prefix":"aikit-now","redis_version":"8.10.2"}

$ aikit --json decide status --provider-file ~/.aikit/decision-provider.json
mode managed-local, placement 127.0.0.1:8019, selected_model kev-latest, install.state "loaded"
served: kev-latest and jev-latest, run jaredpalmer/kev-0.8b, base Qwen/Qwen3.5-0.8B-Base, backend mlx, device mps, dtype bfloat16, temperature 2.351, 50 requests served
```

`~/.workcell/services.json` declares four services (`redis-now` :6381, `kev-decision` :8019, `gliner25-decision` :8020, `gliner25-ql-candidate`), each `target-owned`, started by `redis-server`, `serve-kev.sh` or `launchctl bootstrap` and installed under `~/.workcell/`. This proves the Kev and Redis services work **with** Workcell. It is not evidence for the Workcell-free path, and nothing below treats it as such.

## 1. Findings

### 1.1 Local Kev decision model

| ID | Class | Source (path, symbol) | Intended relation | Behaviour in an installation without Workcell/Factory | Owning contract | Repair | Status |
|---|---|---|---|---|---|---|---|
| K1 | **H** | `ai-kit/scripts/decision-local/{install-kev.sh,serve-kev.sh,kev-decision-service.example.json}`; `docs/JEV-REDIS-NOW.md` (ownership + election table); `crates/aikit-cli/src/decide.rs` module doc | AIKit owns the decision protocol and election; some local-service owner supplies provision/start/health/stop/restart/upgrade | No AIKit verb provisions, starts, stops, restarts or upgrades a serving process. The scripts live in the source tree, not the installed binary, and their last line sends the operator to "Workcell's declared-services path". `endpoint` mode only works if someone already runs a server. The Workcell-installed `serve-kev.sh` (`~/.workcell/decision-models/kev-0.8b/serve-kev.sh`) is a different script from the repo's: it delegates readiness to "Workcell's separate bounded readiness probe" and registers a launchd job labelled `org.epilogos.workcell.kev-…`. | `aikit.decision-provider/v1` (election, existing); `aikit.decision-service/v1` (lifecycle, new) | `aikit decide service {provision,start,status,stop,restart,upgrade}` in AIKit (`crates/aikit-cli/src/decide_service.rs`) | **Repaired (section 2)** |
| K2 | L | `decide.rs` `DecisionProviderMode::ManagedLocal`; live `~/.aikit/decision-provider.json` (mode `managed-local`, `install_path` under `~/.workcell`) | `managed-local` = a loopback service whose lifecycle a product owns | Validation (`DecisionProviderConfig::validate`) and invocation need only address + limits; no `workcell` executable is run. The label is the only Workcell claim. A Workcell-free service must not carry it. | `aikit.decision-provider/v1` | The new lifecycle writes mode `endpoint`; module and `docs/JEV-REDIS-NOW.md` text corrected; `managed-local` kept for the Workcell-owned case | Repaired |
| K3 | S | `crates/aikit-adapters/src/model_realisation.rs` `material_body_plan` (runs `workcell plan --demand-ref demand:model:<provider> …`) | Ask Workcell whether it can materialise a local-serving model body | Returns `MaterialBodyOutcome::Unavailable` when the executable cannot run; a body that already serves is never asked. **No production caller exists**: `grep` finds callers only in `crates/aikit-adapters/tests/model_realisation_end_to_end.rs` | `actuation.instantiation/v1` + Workcell `ExecutionDemand` | None needed now. Any future caller must read `Unavailable` as "no local body supplied", never as a failure of the route | N (watch) |
| K4 | G | `desktop/cradle/kernel/src/decision.rs:871` (`oi aikit --json -C <cwd> jev invoke --request-file … --limits-file … --credential-ref …`), `decision_sites.json` | Cradle decision sites (receiving priority, workspace recovery, agent.ui …) obtain bounded model decisions | The host calls the **hosted** `aikit jev invoke` with a credential reference, tariff and spend reservation. It never calls `aikit decide invoke` with an elected `endpoint`/local provider. A minimal install with local Kev and no hosted credential therefore has no Kev route from any Cradle decision site, although the service is healthy | O:I kernel `decision.rs`; AIKit `action/model/decide` | Route episodes through the elected decision provider (standing `local-protocol`, no tariff, usage still recorded); keep the hosted path for `hosted` election. **Outside this packet's write claim (O:I `src/**` / kernel)** | Open, assigned to lead |
| K5 | N | `crates/aikit-adapters/src/actuation_model_routes.rs` (catalogue ↔ route-availability join; no Workcell reference), `actuation_instantiation.rs` | Acting-model local serving routes (ollama, llama.cpp, vllm) | Availability comes from Actuation's live detection and loopback evidence, not from Workcell. A route whose body is not serving is reported unproven; only `material_body_plan` (K3) ever asks Workcell, and nothing in production calls it | `actuation.instantiation/v1` | None | N |
| K6 | H | `~/.workcell/services.json` `service:gliner25-decision/personal-workcell` (:8020), `~/.aikit/decision-providers/ql-gliner-stock.json` | A second decision model (GLiNER2.5-Decide) for QL-DECIDE | Same Workcell-only lifecycle as K1. The new lifecycle is recipe-shaped but only the Kev recipe is built in | `aikit.decision-provider/v1` | Add a GLiNER recipe when that model is in the minimal composition (it is not named in #592) | Open, not in scope |

### 1.2 Redis and prepared context

| ID | Class | Source | Intended relation | Behaviour without Workcell/Factory | Owning contract | Repair | Status |
|---|---|---|---|---|---|---|---|
| R1 | **H** | `docs/JEV-REDIS-NOW.md` ("Workcell owns Redis as target material"); `crates/aikit-store/src/now_context.rs` (connect/CAS only; no process management anywhere in AIKit — `grep redis-server` finds only CI workflows); live `~/.workcell/services.json` `service:redis-now/personal-workcell` → `redis-server ~/.workcell/redis-now/redis.conf --daemonize yes`; live config `appendonly yes`, `maxmemory 268435456`, `maxmemory-policy noeviction` | Redis is operative-context material; AIKit connects, prepares, delivers | No Workcell → no Redis process and no reference configuration. `aikit now-context status` reports `available:false`. An encounter provider with `now_context.required: true` refuses every turn (`encounter_agency.rs:560`); with `required: false` it records `now_degradation` and proceeds (`:564`) — honest, but the companion then never receives prepared context | `aikit.redis-now-config/v1` + the reference profile (loopback, AOF, finite maxmemory, noeviction) | Same lifecycle core as K1: `aikit now-context service {provision,start,status,stop,restart,upgrade}` (`crates/aikit-cli/src/redis_service.rs`) generating the reference-profile `redis.conf` and the `aikit.redis-now-config/v1` election, ready only when the live `INFO` reading conforms | **Repaired (section 2.1)** |
| R2 | N | `encounter_agency.rs:424` `prepare_now_context`; `jev_now.rs` `prepare_for_encounter`, `now_status` | Prepared turn delivery | No `workcell` or `factory` executable is referenced. `factory: Option<FactoryPrepare>` (`jev_now.rs:310`) and `factory_owner_basis` run only when a request carries a `factory` block; `central.ctrl_bin` is Central (included) | — | None | N |
| R3 | **G** | live `~/.aikit/state/encounter-providers/{epi-prime-ql,pi}.json`; `session_space_cli.rs` `EpiPrimeConfigureArgs` → `EncounterProvider { now_context: None, … }` (≈ line 620) | The companion body receives AIKit-prepared context | Neither shipped provider row has `now_context`. Only `jev-redis-now-proof.json` does. So in the current install neither Pi nor Prime is delivered prepared context, with or without Workcell | `EncounterProvider.now_context` (`encounter_service.rs:74`) | `aikit-session-space encounter-now-context-configure` sets/withdraws `now_context` on any stored row (Pi, Prime) and validates the preparation request at configuration | **Verb landed and tested (section 2.2); not yet applied to the live rows** |
| R4 | G | `jev_now.rs` `SelectionRequest` mode `provider`; no shipped prepare request names a provider | Kev ranks/prunes candidates during preparation | Preparation defaults to `selection: all` (no decision service). Kev results are used only if a prepare request elects `mode: provider` with an explicit `provider_file` and explicit threshold. None ships | `aikit.now-preparation-request/v1` | The configure verb reports what a request elects (`selection.mode`); `tests/now_context_kev_selection.rs` proves the provider path end to end against AIKit's own Redis and records the decision invocation in the view | **Path proven with a protocol-compatible endpoint; no request is shipped or applied to the live rows** |

### 1.3 Agent/body placement and installed tool roots

| ID | Class | Source | Intended relation | Behaviour without Workcell/Factory | Owning contract | Repair | Status |
|---|---|---|---|---|---|---|---|
| B1 | L | `crates/aikit-cli/src/inhabit.rs:220–260,421` (`--workcell` from Central `world.here` role `current`); `inhabitation.rs` `facets.workcell` (`absent` with reason when none declared); `gateway_*` `AIKIT_WORKCELL_REF` | A Position occupant's NOW location | `--workcell` is optional and is a location ref (`workcell:mac`), not a call to the product. Facet reads degrade to `absent`/`not-attempted` with reasons | `aikit.inhabitation-reading/v1`; Central `central.world.here` | None. Rename of the facet label is cosmetic and deferred | N |
| B2 | **H** (task path only) | `encounter_task.rs` (`workcell_boundary_bin`, `workcell.prepared-write-boundary/v1`, test "Codex is not launched outside Workcell"), `encounter_task_run.rs:96–108` (`resolve_executable("workcell")`, `"workcell-write-boundary"`, `WORKCELL_HOME`), `encounter_task_material.rs` | A commissioned *task* body runs inside a Workcell write boundary on an allocated run | Task admission refuses without those executables. **Not on the reader/companion path**: kernel `agency.rs` `encounter_provision` (SessionSpace → agent session → agency binding → provider open) names no Workcell; `pi.json`/`epi-prime-ql.json` launch the harness argv directly | `aikit.encounter-task/v1` | None for this commission: "Direct reader agency and local constructive work do not require Factory Run ancestry" (#132 §2). A tripwire must fail if the companion path ever acquires this dependency | N for the companion; H for commissioned tasks (out of scope) |
| B3 | **H** | Installed QL bodies: `~/.workcell/tools/{ql-agent,actuation-ql-agent,aikit-package-native}/<sha>/…`; `~/.pi/agent/settings.json` `"packages": ["../../.workcell/tools/ql-agent/pi-packages/aikit/f6d2…"]`; `~/.prime/agent/extensions/ql-faculty-bindings.ts` and `~/.prime/agent/skills/ql-relational` (symlinks into `~/.workcell/tools/actuation-ql-agent`); `~/.local/bin/{ql-agent,ql-agent-decide,ql-agent-encounter,actuation-ql-agent}` (symlinks into the same root); Actuation `experiments/native-research/prime/extensions/ql-faculty-bindings.ts` (default `join(homedir(), ".workcell/tools/actuation-ql-agent/current.json")`) | Source-owned QL tools and faculties reach Pi and Prime | The tool root is a Workcell material path. Without it: the Pi package is absent from settings, so no `ql_*` tools; where the package is present but the wrappers are not on PATH, `ql_*` tools register (registration "performs no CLI call") and then fail with a spawn error on first use. `ql-faculty-bindings.ts` does `if (!existsSync(path)) return;` — **silent**: Prime starts with no QL extension and no error. No repository producer of `ql.pi-tool-source/v1` or of `ql-agent.ts`/`ql-event-context.ts` was found (`git log --all -S registerQlEventContext` in QL-MEF: empty; Actuation: empty; `gh search code`: empty) | Actuation (binding), QL-MEF #291 (tool source), AIKit `pi-package/1` export (`aikit-package.json` says `generator: "aikit 0.1.0"`) | Install the package through an AIKit/O:I-owned content-addressed root (not `~/.workcell`); make the binding **fail closed** when Epi mode requires the extension; commit the tool source to its owner repo | **Repaired for Prime (section 2.3); Pi source recorded** |
| B4 | G | live `~/.aikit/state/encounter-providers/epi-prime-ql.json` argv: `--ql-bin /Users/admin/Central/Work/Quaternal-Logic/target/debug/ql`, `--skill-path /Users/admin/Central/Work/Actuation/experiments/ql-runtime/prime/skills/ql-relational`, `--faculty-config ~/.config/epi-logos/faculty.json`, `--research-bin ~/.local/bin/actuation-research`, `--prime-bin ~/.npm-global/lib/node_modules/prime-agent/dist/bundle/cli.js` | A distributable Prime-QL body | The shipped body is wired to the owner's source checkouts and a **debug** QL build; it cannot be installed elsewhere. No Workcell binary is involved, but it is the same class of "this machine only" assumption | `aikit session-space epi-prime-configure` (explicit absolute paths); Actuation `epi_provider.rs` | Package QL binary, skill, faculty config and research binary as versioned install material and have `epi-prime-configure` take the package, not loose paths | Open (section 4) |
| B5 | G (confirmed live) | `crates/actuation-cli/src/epi_provider.rs` `run` passes `--no-extensions` and no `-e`; `prime-agent` 0.9.4 `dist/bundle/chunk-NUZCDYZG.js:22706` `extensionPaths = this.noExtensions ? cliEnabledExtensions : merge(...)` | The shared QL owner extension loads into Prime | By source reading, the product launcher disables extension discovery and passes no explicit extension, so `~/.prime/agent/extensions/ql-faculty-bindings.ts` is **not loaded** in the `epi-prime-ql` provider. QL reaches Prime only through the Python `ql-relational` skill and the research binary. Confirmed live on 6 Oct with Prime 0.9.4: `get_commands` with the launcher's flags lists **no** `ql*` command; with `-e` the binding it lists `ql-mode`, `ql-status` | Actuation `epi_provider.rs` | Pass the shared extension explicitly with `-e` and verify the binding before launch | **Repaired (section 2.3)** |

### 1.4 Factory dispatch

| ID | Class | Source | Finding |
|---|---|---|---|
| F1 | S | `gateway_install.rs:218–232`, `gateway_owners.rs:160–170`, `routine_native.rs`, `inhabitation.rs:69–86` | `factory` is resolved as an *optional* owner binary (`owner_binary(...)?` returns `Option`); `ctrl` (Central) is required. Absence degrades the Routine/Factory event paths, never the reader path |
| F2 | N | `jev_now.rs` `factory` block | Optional, see R2 |
| F3 | N | `main.rs:1305` `aikit factory` | An explicit verb; refuses when `factory` is absent |

### 1.5 O:I install side (files claimed by this packet; context for #595)

`cli/src/composition.rs:241,656,786` special-case `software-factory` only when that product is installed (conditional reconcile). `cli/src/configuration/profile.rs` is generic (`oi.profile/v1` carries native profile refs and setting refs; no Workcell reference). `desktop/cradle/package-bundle.sh` and `cli/src/desktop_install.rs` have no Workcell/Factory reference. No change was made to them in this packet. A local-service election cannot currently be expressed in `oi.profile/v1` because AIKit's `config-contribution` (`oi.configuration-contribution/v1`) exposes only profiles, capability toggles, default skill-sets, `models.default` and credential presence — **a decision-provider/service setting is not contributed** (`aikit config-contribution --json`). That belongs to #595's profile-to-install connection.

## 2. Repair B — Kev through the standalone provider path with its complete lifecycle

Violation repaired: **K1/K2** (the first confirmed one). Owner: AIKit (`crates/aikit-cli`). Branch `feat/central-field-ai-kit` seat `env-1/ai-kit`, uncommitted (lead owns git).

What now exists, `aikit decide service {provision,start,status,stop,restart,upgrade}` (`crates/aikit-cli/src/decide_service.rs`, wired in `cli.rs`/`main.rs`/`lib.rs`):

| Lifecycle step | Behaviour | Receipt it returns |
|---|---|---|
| provision | pinned upstream checkout (full 40-hex pin; a branch/tag recipe is refused; a foreign checkout origin is refused), `uv sync --python 3.13 --extra serve`, adapter and base fetched **by pinned revision** (the snapshot directory name must equal the pin), every artifact SHA-256 hashed into `decision-material-manifest.json`, provider election written as mode **`endpoint`** | pins, `weights_bytes`, `manifest_sha256`, `provider_file`, `"workcell":"not involved"` |
| start | adopts only a process it started (pid + `ps lstart` + command line recorded); detached process group; `WORKCELL_*` stripped from the child; ready = pinned model card answers (name, `run`, `base` must match the recipe) **and** one real Noul/Choice/Score warm decision completed through the elected provider; refuses (`decision_service.port_occupied`) when a listener it did not start already answers on the port | `outcome started|already-running`, pid, served card, `ready_ms`, `warm_ms` |
| status | process standing (`ours|gone|pid-reused`), live model-card identity, optional `--verify-material` (re-hash) and `--probe` (real decision); state `running|running-unhealthy|stopped|foreign-listener|not-provisioned` | as stated |
| stop | identity-checked TERM then KILL; idempotent; refuses to signal a reused pid | `stopped|already-stopped|not-running`, `escalated_to_kill` |
| restart | stop then start | both receipts |
| upgrade | move to a different pinned recipe; stop, re-provision, restart if it was running; on any failure return to the previous cut (re-provision + restart) and say whether the rollback held; same recipe is a no-op `current` | `from/to` pins, or `decision_service.upgrade_failed … rolled back …` |

Not mislabelled: the generated provider file is `aikit.decision-provider/v1` mode `endpoint`; the lifecycle owner is recorded as `aikit` in `service.json`; `managed-local` stays the Workcell-owned label. Kev and Redis are not removed or disabled; the Workcell-declared scripts remain for installs that have Workcell.

Tests (all run on the final tree after the machine crash; Cargo pool `Work/ai-kit/target`, no new target tree):

```text
cargo test -p aikit-cli --lib decide_service
  5 passed; 0 failed
cargo test -p aikit-cli --test decide_service --test decide_surface --test cli_route_parity
  decide_service 3 passed; decide_surface 6 passed; cli_route_parity 6 passed; 0 failed
cargo clippy -p aikit-cli --lib --bin aikit --test decide_service --test decide_surface
  Finished, 0 warnings
cargo fmt --all -- --check
  clean
```

Tripwire: `tests/decide_service.rs` puts `workcell`, `workcell-write-boundary` and `factory` on PATH as shims that record the call and exit 99, runs the **whole** lifecycle through the real `aikit` binary with a cleared environment (provision, start, start-again adoption, status with material verify and probe, a `decide status --probe` consuming the written election, restart, upgrade while running, upgrade to an unprovisionable cut with rollback, stop, idempotent stop, a foreign listener left untouched) and asserts the marker file is empty. `the_tripwire_itself_detects_a_workcell_call` proves the detector is live. **Mutation check:** inserting one `Command::new("workcell").arg("plan")` call into `provision_with` made the lifecycle test fail (`an excluded owner was reached … "workcell plan\nworkcell plan\n"`); the source was restored byte-for-byte (`cmp`) and the test is green again.

What this does and does not prove (honest limits):

- The model server in the tests is `tests/fixtures/fake_kev.py`, a loopback SystemOne-compatible process started through the recipe's real command line (`<venv>/bin/python -m kev.serve --run … --port …`); `git` and `uv` are shims. So process start/identity/stop, health against a pinned model card, the warm decision through the elected provider, upgrade and rollback are real production code; **the Kev weights, `uv sync`, Hugging Face download and the MLX backend were not exercised**. No real Kev was provisioned from this code. Cost to do so on this machine: the pinned artifacts are already in the Hugging Face cache (adapter `9a45d25e…`, base `dc7cdfe2…`), `uv sync` would populate ~1.1 GB (clone-linked from the uv cache), and a second resident model needs ~1.7 GB RAM beside the owner's running Kev on :8019. Command: `aikit decide service provision --service-dir <scratch> --port 8029 && aikit decide service start --service-dir <scratch>`. Left for the lead's go-ahead.
- The owner's live Kev (:8019, Workcell) and Redis (:6381) were only read (section 0); nothing was stopped, restarted or adopted.
- Not covered: persistence across logout/reboot (the service is a detached process, not a launchd/systemd unit; `start` re-launches), Redis (R1), the GLiNER model (K6), exposing the election through `aikit config-contribution` so `oi.profile/v1` can carry it.
- Build-pool hazard found while verifying: `env-1/ai-kit` and `env-2/ai-kit` (another branch) share one Cargo pool and cargo's fingerprint compares only file mtimes, so one seat can silently link the other's `aikit-core` (observed: E0063 "missing field `revision` in `SourceHit`" / `harness_auth_source` in `aikit-adapters` files I did not touch). Workaround used: `touch` the seat's sources before building (no content change). Whoever builds second in a seat on a different branch must do the same, or builds fail/mislink.


### 2.1 Repair R1 — Redis without Workcell

`aikit now-context service {provision,start,status,stop,restart,upgrade}` (`crates/aikit-cli/src/redis_service.rs`, shared core exported `pub(crate)` from `decide_service.rs`: `process_standing`, `signal`, `wait_until`, `write_atomic`, `sha256_file`). `provision` runs `redis-server --version`, requires the 8.10 series, hashes the executable and writes `redis.conf` (bind 127.0.0.1, `appendonly yes`, `appendfsync everysec`, finite `maxmemory`, `maxmemory-policy noeviction`) plus `redis-now.json`. `start` adopts only its own process, refuses a foreign Redis on the port, and is ready only when PING answers and `RedisNowStore::profile_reading` (new, `INFO server|persistence|memory`) conforms. `stop` is TERM (AOF flush) then KILL and keeps the data; `restart` and `upgrade` reuse the data directory; `upgrade` refuses an older series before touching the service and rolls back to the previous executable on failure.

Tests (real `redis-server` 8.10.2, real `aikit` binary, tripwire `workcell`/`workcell-write-boundary`/`factory` shims on PATH):

```text
cargo test -p aikit-cli --test redis_service          2 passed
  full lifecycle: provision, start (profile conforms: aof on, maxmemory 64 MiB, noeviction), adoption,
  SET key -> restart -> GET key (data kept), upgrade to a second executable (data kept),
  older-series upgrade refused with the service left running, failing upgrade rolled back (data kept),
  stop keeps data and is idempotent, a foreign Redis on another port is reported and left running,
  tripwire marker empty; missing redis-server is a named prerequisite
cargo test -p aikit-cli --lib redis_service            3 passed (reference conf, version parsing, profile violations)
```

Mutation check: one `Command::new("workcell").arg("plan")` inserted into `service_provision` made both integration tests fail (`an excluded owner was reached`); source restored byte-for-byte.

Live receipt (scratch service dir, port 6395, then stopped): provision → `executable /opt/homebrew/Cellar/redis/8.10.2/bin/redis-server`, start → `aof_enabled true, maxmemory 67108864, maxmemory_policy noeviction, redis_version 8.10.2`, and the existing real-Redis encounter test passed against it (`AIKIT_TEST_REDIS_ADDR=127.0.0.1:6395 cargo test -p aikit-cli --test now_context_encounter`, 1 passed, not skipped).

### 2.2 R3/R4 — prepared context on the Pi and Prime rows, and what a turn actually received

- `aikit-session-space encounter-now-context-configure --provider-id ID --redis-config F [--prepare-request R] [--required] [--local-provider] | --withdraw` (`EncounterService::configure_now_context`, `jev_now::describe_encounter_prepare_request`). It edits only `now_context` on the *stored* registration (so a profile-derived row keeps `from_profile`), refuses a preparation request whose Redis election or external-provider setting differs, and reports the request's selection mode. Tested on a Pi row and a Prime row: only `now_context` changes, withdrawal restores the row exactly, a mismatching request and an unknown provider are refused (`tests/now_context_provider_configuration.rs`, 2 passed).
- **Defect found and fixed:** the provider selection path published views with `jev_invocation_ref` empty (only the hosted Jev path set it), so nothing recorded which decision invocation a prepared view was selected by. `jev_now.rs` now records whichever transport made the decision. `tests/now_context_kev_selection.rs` pins it and was shown to fail without the fix (`left: Null`).
- Observability: `NowDeliveryReceipt` gained optional `decision_provider` and `jev_invocation_ref` (read from the delivered view's own basis; older receipts still parse); the encounter view gained `now_context_receipts` (latest delivered / degraded / uncertain journal events). `now_context_encounter` (real Redis) asserts the receipt and the view entry name the version, digest, decision provider and invocation.
- Joined run (not a test): real `ctrl` + AIKit's own Redis + a prepare request electing a loopback provider with three candidates → `publishedVersion 1`, `decisionInvocation.standing local-protocol, outcome completed`, `selectedCandidateRefs` 3, `decisionProvider blake3:fbd3eec7…`, readback `basis.decision_provider` matching. **The endpoint was `fake_kev.py` (answers 0.75 to everything), not Kev**, so it proves wiring, not selection quality.
- Not done: the live `epi-prime-ql` and `pi` rows in `~/.aikit` were not modified (they are the owner's installed state); no prepare request is shipped. Applying them is one command each once a Redis service and a Kev service are running.

New findings recorded while doing this:

| ID | Class | Finding |
|---|---|---|
| R5 | G | Provider selection offers only candidates with `external_egress = allowed` and `agent_visibility = payload` (`jev_now.rs`, Provider arm), even when the provider is a local loopback one. Central-read sources default to egress `denied`, so a local Kev never sees them. Relaxing it for `local-protocol` standing is a disclosure-law change for the owner; not made |
| K7 | S (live) | After the machine restart the owner's Workcell-managed Kev on :8019 was **not running** (`aikit decide status` → `endpoint did not answer its model card`; no `kev.serve` process). The launchd job is `RunAtLoad` under `gui/501` but did not come back. Nothing was restarted. This is the current live state, and it is why the joined run above used a stand-in |

### 2.3 G1–G4 — Prime delta over pinned 0.9.4 and the Pi source of record (Actuation)

Source prepared in `env-1/actuation` (`feat/central-field-actuation`), uncommitted. No repository, release or download was created.

- **`distribution/pi-ql-native/`** — the Pi package (`ql-native-agent` 0.3.3: `ql_project_event`, `ql_decision_frame`, `ql_harmonic_read`, `ql_decide`, `ql_validate_determination`, `ql_invoke`, event context, six Skills) copied from `~/.workcell/tools/ql-agent/pi-packages/aikit/f6d2aa93…` (the package `~/.pi/agent/settings.json` references), with `PROVENANCE.json`: copy path and date, generator (`aikit 0.1.0`, `pi-package/1`), QL-MEF #291 owner provenance and kernel digest, the search that found no other repository home, per-file SHA-256 (19 files) and a tree digest. Its `ql-agent.ts` is byte-identical (`3e33f6cf…`) to the owner-extension copy Prime's binding verifies. G1 is closed as to *location*; regenerating it from QL-MEF's SkillSets and scripts remains QL-MEF's.
- **The Prime distribution** (first built as Actuation `distribution/prime-epi/`; now its own repository, EpiLogos/Epi-Prime, with the same files at the repository root; the evidence below was taken at the earlier location) — `manifest.json` (`epi-prime.distribution/v1`, earlier `actuation.prime-distribution/v1`) pinning upstream Prime Agent v0.9.4 (`f771dfce…`), recording that **no upstream source is patched** and that the delta is three changes: (a) the launcher loads the shared extension explicitly, (b) a missing or drifted QL binding fails closed, (c) the install root is `$EPI_LOGOS_TOOLS_ROOT`, else `$AIKIT_HOME/tools`, not a Workcell root. `tools/epi-distribution.mjs` has `verify`, `seal` and `install`. `extensions/ql-faculty-bindings.ts` moved here from `experiments/native-research/prime/extensions/` (with its proof test).
- **Rust launcher** (`crates/actuation-cli/src/epi_provider.rs`): requires `--extension` and `--installation`; verifies the binding before Prime starts (schema, absolute paths, the owner extension's source closure by SHA-256, entry point, containment) and exits 2 with the reason; passes `-e <extension>` after `--no-extensions`. AIKit's `epi-prime-configure` takes and passes both.
- **Prime facts found while doing it:** Prime swallows extension load errors in RPC mode (an extension that throws leaves stderr empty and `get_commands` empty), so fail-closed cannot live in the extension alone; and Prime supplies `typebox` to extensions itself, so the earlier `node_modules/typebox` symlink into Pi's tree was never needed (an owner root with no `node_modules` loads; pinned by test).

Evidence:

```text
cargo test -p actuation-cli -j2 --lib epi_provider        6 passed (argv has -e after --no-extensions; missing --extension/--installation refused at parse;
                                                           binding verified by schema, closure and digest; a drifted binding makes run() fail and Prime is NOT started)
cargo test -p actuation-cli -j2                           78 passed, 0 failed (12 suites); cargo clippy -p actuation-cli --all-targets: clean; cargo fmt --all --check: clean
node tools/epi-distribution.mjs verify (in Epi-Prime)            ok (4 files + pi-ql-native tree digest)
node tests/install-and-load.mjs (in Epi-Prime)    6 checks, 0 model calls: install under a temp root, binding has no ".workcell",
                                                           real Prime loads it (ql-mode, ql-status), absent root loads nothing, no node_modules needed,
                                                           one changed owner byte loads nothing, a .workcell root is refused
node tests/ql-native-bindings.mjs (in Epi-Prime) <installed current.json> <out>   18 checks, 0 model calls (the earlier proof, now on the relocated extension)
live: target/debug/actuation-epi-prime + real prime-agent 0.9.4 over an installed distribution:
   verified binding -> exit 0, get_commands lists ql-mode, ql-status
   drifted ql-agent.ts -> exit 2, "QL binding refused: extensions/ql-agent.ts differs from its installed source digest", Prime not started
   missing binding file -> exit 2, "QL binding (installation) file is unavailable"
cargo test -p aikit-cli --lib epi_prime                  2 passed (configure grammar carries both; omitting either is a parse refusal)
```

Not done (named): G4 packaging of the `ql` binary, the `ql-agent*` wrappers and the faculty configuration as versioned release material (needs QL-MEF release artefacts; the manifest lists them as supplied, not packaged); re-pinning to Prime v0.9.8; the live `epi-prime-ql` row in `~/.aikit` and the installed `~/.local/bin/actuation-epi-prime` were **not** touched, so they still use the old launcher until the distribution is installed and the row re-configured (the new launcher refuses the old argv by design).

### 2.4 Elections through `aikit config-contribution`

`ai-kit:local-services:decision.provider` and `ai-kit:local-services:now.redis` (new `local-services` section; `crates/aikit-cli/src/local_services_election.rs`, `config_plane.rs`, `system.rs`). Type `path` of the owner-native document; validated with the owner's own law; applied as a reference plus the digest it was elected at; reset removes only the election; the `system` disclosure reports declared / effective (current, changed-since-elected, unreadable) / active (bounded read-only probe). `decide status|invoke` and `now-context status` use the election when given no file and refuse a drifted one (`config.election_drifted`). Electing starts nothing.

```text
cargo test -p aikit-cli --test config_plane_local_services   2 passed (contribution; invalid values refused; plan/apply/receipt; disclosure with a live endpoint;
                                                              default use by `decide status --probe`; drift refused and disclosed; re-apply; reset keeps the document;
                                                              Redis election with nothing listening reports unreachable and starts nothing, and with a real redis-server answers)
cargo test -p aikit-cli --test config_plane                  existing suite green (section order test updated for the new `local-services` section)
cargo test -p aikit-cli --lib local_services_election        2 passed
```

### 2.5 Actual-use reading (`aikit-session-space encounter-use`)

`crates/aikit-cli/src/encounter_use.rs`. For one turn (last, `--turn N`, or `--cursor C`): the prepared-context version delivered (journal receipt), decision provider and invocation behind it, the selected sources read back from Redis and verified by digest (`--redis-config`), and the QL operations the body made (`ql_*` tool calls and results; `ql_relational.*` calls inside `ipython`; the QL owner's `actuation.prime-ql-operation/v1` receipts for the session in the turn window, reconciled by count). `absences` names what was not read. It writes nothing and adds no store.

```text
cargo test -p aikit-cli --test encounter_use                 1 passed (real EncounterStore journal + real faculty-receipt directory through the real binary)
cargo test -p aikit-cli --lib encounter_use                  5 passed
AIKIT_TEST_REDIS_ADDR=127.0.0.1:6396 cargo test -p aikit-cli --test now_context_encounter   1 passed — real EncounterService, real Redis (AIKit's own service),
   real journal: the reading says delivered, version 1, digest equal to the receipt, decision provider and invocation named, view_is_the_delivered_one true,
   selected_source_refs [context-source/proof]
```

Limits: the Kev answer body is not persisted by the prepare path, so only the invocation ref and the provider identity digest are reportable; QL tool calls prove the body *called*, and an owner receipt proves the QL owner *executed* (the reading reports both and whether their counts agree, matched by count and time, not identity); a live Pi or Prime body calling QL during an encounter was not run in this packet (no model credentials exercised), so the recorder's QL part is proven over journals shaped like the owner's, not over a live model turn.

### 2.6 Real-turn proof, and the QL failures it exposed (6 Oct 2026)

`walk/scenarios/prime-kev-redis-turn.mjs` (receipt `walk/artifacts/prime-kev-redis-turn.json`, grade A) drives one real encounter turn on the
Prime-QL body with Redis-prepared NOW context electing the live Kev, then reads it back with `encounter-use` and `now-context inspect`. The two QL
failures seen in its first runs were run down:

- **`native faculty receipt filing failed (1):` on every `ql_relational` Python call that files a receipt.** Version drift in the install, not a
  QL-MEF defect. `~/.config/epi-logos/faculty.json` pins `owner.revision` 8eff719b (23 Sep); the source-built owner instrument
  (`native-owner-instrument`, rebuilt from the 2 Oct Actuation source, #127) bakes `OWNER_REVISION` 6a81fc44 into the binary and answers every request
  with it. `actuation-research faculty.invoke` refuses the reply ("owner response correlation/revision mismatch"), and its error goes to stdout, so
  Python reports an empty stderr. Reproduced directly against the installed `actuation-research`; with the pin changed to 6a81fc44 the same call
  succeeds and files its receipt. The turn is damaged, not just the receipt: after the failure the body went on investigating for over fifteen minutes.
  The everyday `epi-prime-ql` row still carries the stale config.
  Repair (Epi-Prime, first made in Actuation `distribution/prime-epi`): `install` now refuses a faculty configuration whose pin is not the revision the instrument reports
  (`checkFacultyCoherence`, naming both), and `epi-distribution.mjs faculty-config --instrument … --source-root … --evidence-root … --out …`
  writes the configuration from the instrument's own reply, so it follows a rebuild. Native-CLI owners report no revision and are disclosed, not probed.
- **`ql_decision_frame` refused `quaternary.position.structure` ("expected one of lens, context-frame, faculty, operation").** The model invented
  an element kind; the kernel's own schema refused it with an error naming the valid ones. Correct behaviour, no defect.

## 3. Pi / Prime inventory (task C)

Scope: what exists of the Pi extension and the Prime harness fork, how a session crosses the supported boundary into Cradle, and the exact gaps to make both bodies consume QL operations, Kev results and AIKit-prepared context. No runtime was built or changed for this section. Facts below are from source, installed artifacts and one registry/GitHub read on 6 October 2026; where something was not run live it says so.

### 3.1 Upstreams, versions and the fork delta

| Item | Pi | Prime |
|---|---|---|
| Upstream product | `@earendil-works/pi-coding-agent` | `PrimeIntellect-ai/prime-agent`, monorepo `packages/coding-agent` (`package.json` `repository.directory`), `piConfig {name: prime-agent, configDir: .prime/agent}` — a Pi-derived coding agent with a persistent Python REPL kernel and recursive child sessions |
| Installed here | 0.84.4 (`pi --version`; `~/.npm-global/lib/node_modules/@earendil-works/pi-coding-agent`) | 0.9.4 (`prime-agent --version`; `~/.npm-global/lib/node_modules/prime-agent`; not on the npm registry — `npm view prime-agent` 404; its installer is `curl … app.primeintellect.ai/prime-agent/install.sh`) |
| Pinned by | AIKit `crates/aikit-core/src/skillset_package/pi.rs` (`PI_CORE_PACKAGE`, "vendor facts … 0.84.4"); `crates/aikit-adapters/src/pi_rpc_connection.rs` ("Pi 0.84 JSONL RPC"); Actuation `catalog/targets.json` (`pi` descriptor, detection of 0.84.4) | Actuation `experiments/native-research/prime-source-lock.json` (release `v0.9.4` = `f771dfcedd684d1afff84ca2c6fa95c7a21efbc2`, observed main `55ade48b…` on 2026-09-09); AIKit `prime_rpc_connection.rs` `PRIME_AGENT_RELEASE_REVISION` (same `f771dfce…`) |
| Upstream now (read 6 Oct) | npm `latest` = **1.0.4** (installed 0.84.4: a major-version gap) | GitHub latest release **v0.9.8** (2026-09-29), `main` = `672085e883c25a8a5f10c77ad8e5d3fb38dd6584` (pinned 0.9.4) |
| Fork delta | **None.** No EpiLogos fork of Pi exists (`gh repo view EpiLogos/pi-mono` → not found). Epi-Logos adds a *package*, not a fork | **No fork exists.** `gh repo list EpiLogos --limit 60` has no Prime repository, and `gh repo view EpiLogos/prime-agent` → not found. The product runs the unmodified upstream 0.9.4 binary through the `actuation-epi-prime` launcher (`--mode rpc --no-extensions --no-prompt-templates --no-context-files --no-skills --skill <ql-relational>`). The "Prime harness fork" the commission names is **a deliverable that does not yet exist** |

### 3.2 What each body carries today

| Layer | Pi | Prime |
|---|---|---|
| Extension/package form | Pi package `ql-native-agent` 0.3.3 (`package.json` `pi.extensions: ./skills/ql-agent-reading/extensions/ql-agent.ts`, `pi.skills: ./skills`, `peerDependencies: @earendil-works/pi-coding-agent *`), generated by `aikit 0.1.0` (`aikit-package.json` `format_version pi-package/1`, members ql-agent-reading, ql-foundations, ql-law, ql-evidence-report, ql-mef-operation, vak-coordinate-frame). Installed at `~/.workcell/tools/ql-agent/pi-packages/aikit/f6d2aa93…` and referenced by relative path from `~/.pi/agent/settings.json` `packages` | No package. Two assets: the Python-backed skill `experiments/ql-runtime/prime/skills/ql-relational` (loaded with `--skill`), and the TypeScript binding `experiments/native-research/prime/extensions/ql-faculty-bindings.ts` that loads the **same shared owner extension** `ql-agent.ts` with `body = "prime"` (`export default function (pi, body: "pi"\|"prime")`) |
| Adapter imports | `ql-agent.ts` imports `node:child_process`, `node:crypto`, `node:fs`, `typebox`, and type-only `ExtensionAPI` from `@earendil-works/pi-coding-agent`, plus `./ql-event-context.ts` | the shared extension is called through `extension.default(prime, "prime")`; the launcher also sets `RLM_MAX_DEPTH=2`, `QL_BIN`, `QL_OWNER_REVISION`, `ACTUATION_RESEARCH_BIN`, `ACTUATION_RESEARCH_FACULTY_CONFIG`, `QL_MEF_ROOT`, `AIKIT_BIN`, `CENTRAL_CTRL_BIN`, `CENTRAL_ROOT`, `CENTRAL_PROJECT`, `ACTUATION_CHILD_MESSAGE_DIR`, `ACTUATION_RESEARCH_TRACE_REF` |
| Tools contributed | `ql_project_event`, `ql_decision_frame`, `ql_harmonic_read`, `ql_decide`, `ql_validate_determination`, `ql_invoke` (six, registered with no CLI/provider call), plus `registerQlEventContext` (event-context hooks, on only when `QL_AGENT_MODE=on`). Each shells out to `ql-agent`, `ql-agent-decide` or `ql-agent-encounter` on PATH (`QL_AGENT_BIN`/`QL_AGENT_DECIDE_BIN`/`QL_AGENT_ENCOUNTER_BIN` override) with 5 s (190 s for `decide`) bounds | the `ql_relational` Python faculty (`capabilities, kernel_apply, ananda_m1_2, mef_lenses, context_frames, vak_locate, negotiate, wiki_refract, constellation_contract, harmonic_search, harmonic_snapshot, spawn_child_cheapest, central_now_handover, central_now_handoff_read, return_envelope, agent_message.send`) reaching QL through `actuation-research` + faculty config; the shared owner extension adds the same six `ql_*` tools **if it is loaded** (see B5) |
| Where QL executables come from | `~/.local/bin/ql-agent*` → `~/.workcell/tools/ql-agent/<sha>/…` (Workcell tool root, B3) | provider argv: `--ql-bin /Users/admin/Central/Work/Quaternal-Logic/target/debug/ql` (a debug build in a source checkout), `--research-bin ~/.local/bin/actuation-research`, `--faculty-config ~/.config/epi-logos/faculty.json` (B4) |
| Decision (Kev) route | `ql_decide` → `ql-agent-decide` → `aikit decide invoke --provider-file <file>` (`ql_agent_aikit.py`: accepts modes `none/managed-local/endpoint/hosted`; **no implicit provider election**, the request must name `provider_file`). The service written by the new `aikit decide service` is mode `endpoint`, which this consumer accepts | same tool via the shared extension; same requirement |
| Prepared (Redis) context | provider row `pi.json` has no `now_context` (R3) | provider row `epi-prime-ql.json` has no `now_context` (R3) |
| Child recursion | none (Pi has one resident session per process) | native RLM children; AIKit surfaces `rlm_child_update` as `Status` signals (`prime_rpc_connection.rs`); child messages go to `ACTUATION_CHILD_MESSAGE_DIR` (AIKit `encounter_prime_launch.rs`) |

### 3.3 How a session crosses the boundary into Cradle today

```text
Cradle UI (src/encounter/client.ts, kernelOp)
  -> kernel op `encounter` / `encounter_provision`   (desktop/cradle/kernel/src/agency.rs)
  -> child process `$OI_AIKIT_BIN encounter --request-json …`   (agency.rs:775)
  -> AIKit encounter service (encounter_service.rs; resident owner process, journal, drafts, deliveries)
  -> provider process from state/encounter-providers/<id>.json   (argv, protocol pi-rpc | prime-rpc | acp)
  -> JSONL RPC over the child's stdio, via PiRpcConnectionAdapter / PrimeRpcConnectionAdapter
```

| Phase | Pi (`pi_rpc_connection.rs`, 729 lines) | Prime (`prime_rpc_connection.rs`, 837 lines) |
|---|---|---|
| start | one process = one resident session; `get_state` observes the session, **attach only** ("create/load/resume are not claimed", line 314) | `get_state` attach; `Attach`/`Resume` admitted, `create/load` not claimed |
| message/stream | `prompt {message}`; events `message_update`/`text_delta`, `agent_end` | `prompt`; `message_update` (`text_delta`, `thinking`), `message_end`, `agent_end` |
| tool call/result | `tool_execution_start/update` → `ToolCall`, `tool_execution_end` → `ToolResult` (lines 543–548) | same (lines 503–510); `extension_ui_request` is surfaced as `Degraded` ("extension-ui" unavailable) |
| cancel | `abort` → `Control`; ack tracked, may arrive after the turn settled (`abort_requested`) | `abort` → `Control`, `abort_acknowledged` |
| resume | **not claimed** | `switch_session {sessionPath}` after the owner resolves the exact prior native session and the same cwd; refuses extra directories/MCP servers |
| model | `get_available_models`, `set_model` (native model controls) | no `set_model`; model fixed at launch (`--provider/--model` appended by AIKit) |
| permission | none ("no in-session permission modes") | `respond_permission` refused: "extension UI is not an admitted … permission route" |
| identity | native session id bound to a canonical AgentSession by AIKit; process/model/session identity never promoted to Agent identity | same |

Cradle composes the model, harness, agent and local decision model identities only through this path; it contains no harness protocol of its own. `desktop/cradle/kernel/src/agency.rs` already prefers a provider row with `body_ref = agent-body/epi-prime-ql` for Epi mode, falling back to the owner's choice, then the row literally named `pi`.

### 3.4 Gaps to make both bodies consume QL operations, Kev results and AIKit-prepared context

| # | Gap | Evidence | Body | Owner | Smallest repair |
|---|---|---|---|---|---|
| G1 | The Pi QL package and its source have no repository home | `ql-agent.ts`/`ql-event-context.ts` not in any QL-MEF/Actuation/AIKit ref (`git log --all -S`) or `gh search code`; installed copy is content-addressed under `~/.workcell/tools` | Pi, Prime | QL-MEF #291 (source), AIKit (package export) | Commit the tool source to QL-MEF, export through `aikit` package generation, publish as a versioned package |
| G2 | Installed roots are Workcell's (B3) | `settings.json`, `~/.prime/agent` symlinks, `~/.local/bin` wrappers | Pi, Prime | AIKit (install root), Actuation (binding default) | Install under an AIKit/O:I root; `ql-faculty-bindings.ts` default root becomes AIKit's and **fails closed** when Epi mode requires the extension |
| G3 | Prime launcher passes `--no-extensions` and no `-e` (B5) | `epi_provider.rs`; `prime-agent` chunk `:22706` | Prime | Actuation | Add `-e <packaged binding>`; test the argv. Confirm with a live Prime session |
| G4 | No packaged QL executables for the bodies (B4) | provider argv points at debug build + source checkout | Prime (and `ql-agent*` for Pi) | QL-MEF release artefact; Actuation; AIKit | Ship `ql`, `actuation-research`, faculty config, skill as versioned install material; `epi-prime-configure` accepts the package |
| G5 | No `now_context` on the shipped provider rows (R3) | `~/.aikit/state/encounter-providers/*.json` | Pi, Prime | AIKit (`epi-prime-configure`; Pi provider configure), O:I profile | Configure Redis `now_context` with a prepare request that elects `selection.mode = provider` (R4); depends on R1 Redis lifecycle |
| G6 | Redis has no Workcell-free lifecycle (R1) | AIKit has no Redis process management | Pi, Prime | AIKit | Second recipe on `decide_service` core, `aikit now-context service …` |
| G7 | Cradle decision sites cannot reach local Kev (K4) | `kernel/src/decision.rs:871` hosted-only | — | O:I kernel | Route episodes through the elected decision provider |
| G8 | Pi attach-only (no resume claimed) while Prime resumes via `switch_session` | adapters | Pi | AIKit adapter | Decide whether Pi resume is required for "preserve the reader's inquiry through harness handover"; if so a Pi `switch_session` equivalent must be proven against 0.84.4 and 1.0.x before claiming |
| G9 | Version drift: Pi 0.84.4 → 1.0.4 and Prime 0.9.4 → 0.9.8 upstream; adapters and the `pi-package/1` target are pinned to the old wire/package facts | section 3.1 | Pi, Prime | AIKit adapters/targets; Actuation source lock | Re-pin deliberately with a protocol conformance run against the chosen releases; do not silently accept drift |
| G10 | The Pi provider row is not bound to the source-owned body | `pi.json` has no `body_ref`/`body_revision`; only `prime`/`epi-prime-ql` carry `agent-body/epi-prime-ql` | Pi | AIKit/Cradle | Give the Pi row the same body ref once the Pi package is the source-owned carrier, so Epi mode selects either body by the same relation |
| G11 | The requested **Prime harness fork** does not exist | section 3.1 | Prime | Opus decision | Decide what the fork must change over upstream 0.9.x (the QL extension loading by default? the RLM tool surface?) before creating one; until then the supported route is upstream + launcher + package |
| G12 | Prime/Pi extension UI and permissions are unsupported through the host | adapters | Pi, Prime | AIKit | Out of this packet; native login/API-key stays inside each harness |

### 3.5 Not verified in this packet

- No live Pi or Prime session was started, so G3 (extension actually not loaded) and every "QL tool actually called" claim are source-reading only. A live Prime run with the `epi-prime-ql` row and a trace of `ql_*` tool calls is the missing evidence.
- No model call was made (no credentials were exercised); `glm-5.3-flash`/`zai` are what `~/.pi/agent/settings.json` and `~/.prime/agent/settings.json` default to.

