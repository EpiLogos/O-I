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
| R1 | **H** | `docs/JEV-REDIS-NOW.md` ("Workcell owns Redis as target material"); `crates/aikit-store/src/now_context.rs` (connect/CAS only; no process management anywhere in AIKit — `grep redis-server` finds only CI workflows); live `~/.workcell/services.json` `service:redis-now/personal-workcell` → `redis-server ~/.workcell/redis-now/redis.conf --daemonize yes`; live config `appendonly yes`, `maxmemory 268435456`, `maxmemory-policy noeviction` | Redis is operative-context material; AIKit connects, prepares, delivers | No Workcell → no Redis process and no reference configuration. `aikit now-context status` reports `available:false`. An encounter provider with `now_context.required: true` refuses every turn (`encounter_agency.rs:560`); with `required: false` it records `now_degradation` and proceeds (`:564`) — honest, but the companion then never receives prepared context | `aikit.redis-now-config/v1` + the reference profile (loopback, AOF, finite maxmemory, noeviction) | Same lifecycle core as K1 with a Redis recipe: generated `redis.conf` (loopback, AOF, finite maxmemory, noeviction), `aikit now-context service …`. Not done in this packet (K1 first, per the brief) | **Open — next repair** |
| R2 | N | `encounter_agency.rs:424` `prepare_now_context`; `jev_now.rs` `prepare_for_encounter`, `now_status` | Prepared turn delivery | No `workcell` or `factory` executable is referenced. `factory: Option<FactoryPrepare>` (`jev_now.rs:310`) and `factory_owner_basis` run only when a request carries a `factory` block; `central.ctrl_bin` is Central (included) | — | None | N |
| R3 | **G** | live `~/.aikit/state/encounter-providers/{epi-prime-ql,pi}.json`; `session_space_cli.rs` `EpiPrimeConfigureArgs` → `EncounterProvider { now_context: None, … }` (≈ line 620) | The companion body receives AIKit-prepared context | Neither shipped provider row has `now_context`. Only `jev-redis-now-proof.json` does. So in the current install neither Pi nor Prime is delivered prepared context, with or without Workcell | `EncounterProvider.now_context` (`encounter_service.rs:74`) | `epi-prime-configure` accepts a Redis config + prepare request and writes `now_context`; Pi provider rows get the same | Open (section 4) |
| R4 | G | `jev_now.rs` `SelectionRequest` mode `provider`; no shipped prepare request names a provider | Kev ranks/prunes candidates during preparation | Preparation defaults to `selection: all` (no decision service). Kev results are used only if a prepare request elects `mode: provider` with an explicit `provider_file` and explicit threshold. None ships | `aikit.now-preparation-request/v1` | Ship a prepare request template with `selection.mode = provider` pointing at the service's `decision-provider.json` | Open (section 4) |

### 1.3 Agent/body placement and installed tool roots

| ID | Class | Source | Intended relation | Behaviour without Workcell/Factory | Owning contract | Repair | Status |
|---|---|---|---|---|---|---|---|
| B1 | L | `crates/aikit-cli/src/inhabit.rs:220–260,421` (`--workcell` from Central `world.here` role `current`); `inhabitation.rs` `facets.workcell` (`absent` with reason when none declared); `gateway_*` `AIKIT_WORKCELL_REF` | A Position occupant's NOW location | `--workcell` is optional and is a location ref (`workcell:mac`), not a call to the product. Facet reads degrade to `absent`/`not-attempted` with reasons | `aikit.inhabitation-reading/v1`; Central `central.world.here` | None. Rename of the facet label is cosmetic and deferred | N |
| B2 | **H** (task path only) | `encounter_task.rs` (`workcell_boundary_bin`, `workcell.prepared-write-boundary/v1`, test "Codex is not launched outside Workcell"), `encounter_task_run.rs:96–108` (`resolve_executable("workcell")`, `"workcell-write-boundary"`, `WORKCELL_HOME`), `encounter_task_material.rs` | A commissioned *task* body runs inside a Workcell write boundary on an allocated run | Task admission refuses without those executables. **Not on the reader/companion path**: kernel `agency.rs` `encounter_provision` (SessionSpace → agent session → agency binding → provider open) names no Workcell; `pi.json`/`epi-prime-ql.json` launch the harness argv directly | `aikit.encounter-task/v1` | None for this commission: "Direct reader agency and local constructive work do not require Factory Run ancestry" (#132 §2). A tripwire must fail if the companion path ever acquires this dependency | N for the companion; H for commissioned tasks (out of scope) |
| B3 | **H** | Installed QL bodies: `~/.workcell/tools/{ql-agent,actuation-ql-agent,aikit-package-native}/<sha>/…`; `~/.pi/agent/settings.json` `"packages": ["../../.workcell/tools/ql-agent/pi-packages/aikit/f6d2…"]`; `~/.prime/agent/extensions/ql-faculty-bindings.ts` and `~/.prime/agent/skills/ql-relational` (symlinks into `~/.workcell/tools/actuation-ql-agent`); `~/.local/bin/{ql-agent,ql-agent-decide,ql-agent-encounter,actuation-ql-agent}` (symlinks into the same root); Actuation `experiments/native-research/prime/extensions/ql-faculty-bindings.ts` (default `join(homedir(), ".workcell/tools/actuation-ql-agent/current.json")`) | Source-owned QL tools and faculties reach Pi and Prime | The tool root is a Workcell material path. Without it: the Pi package is absent from settings, so no `ql_*` tools; where the package is present but the wrappers are not on PATH, `ql_*` tools register (registration "performs no CLI call") and then fail with a spawn error on first use. `ql-faculty-bindings.ts` does `if (!existsSync(path)) return;` — **silent**: Prime starts with no QL extension and no error. No repository producer of `ql.pi-tool-source/v1` or of `ql-agent.ts`/`ql-event-context.ts` was found (`git log --all -S registerQlEventContext` in QL-MEF: empty; Actuation: empty; `gh search code`: empty) | Actuation (binding), QL-MEF #291 (tool source), AIKit `pi-package/1` export (`aikit-package.json` says `generator: "aikit 0.1.0"`) | Install the package through an AIKit/O:I-owned content-addressed root (not `~/.workcell`); make the binding **fail closed** when Epi mode requires the extension; commit the tool source to its owner repo | Open (section 4) |
| B4 | G | live `~/.aikit/state/encounter-providers/epi-prime-ql.json` argv: `--ql-bin /Users/admin/Central/Work/Quaternal-Logic/target/debug/ql`, `--skill-path /Users/admin/Central/Work/Actuation/experiments/ql-runtime/prime/skills/ql-relational`, `--faculty-config ~/.config/epi-logos/faculty.json`, `--research-bin ~/.local/bin/actuation-research`, `--prime-bin ~/.npm-global/lib/node_modules/prime-agent/dist/bundle/cli.js` | A distributable Prime-QL body | The shipped body is wired to the owner's source checkouts and a **debug** QL build; it cannot be installed elsewhere. No Workcell binary is involved, but it is the same class of "this machine only" assumption | `aikit session-space epi-prime-configure` (explicit absolute paths); Actuation `epi_provider.rs` | Package QL binary, skill, faculty config and research binary as versioned install material and have `epi-prime-configure` take the package, not loose paths | Open (section 4) |
| B5 | G (unverified live) | `crates/actuation-cli/src/epi_provider.rs` `run` passes `--no-extensions` and no `-e`; `prime-agent` 0.9.4 `dist/bundle/chunk-NUZCDYZG.js:22706` `extensionPaths = this.noExtensions ? cliEnabledExtensions : merge(...)` | The shared QL owner extension loads into Prime | By source reading, the product launcher disables extension discovery and passes no explicit extension, so `~/.prime/agent/extensions/ql-faculty-bindings.ts` is **not loaded** in the `epi-prime-ql` provider. QL reaches Prime only through the Python `ql-relational` skill and the research binary. No live Prime session was run in this packet to confirm | Actuation `epi_provider.rs` | Pass the shared extension explicitly (`-e <packaged ql-faculty-bindings.ts>`) and add a launcher test that the argv carries it | Open; **needs a live Prime session to confirm** |

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

