# Central field — results (6–7 October 2026)

Parent: O:I #592 · map `.wayfinder/maps/epi-logos-field.md` · ledger #598 · branch `feat/central-field-base`.
Contract and decisions: `CENTRAL-FIELD-CONTRACT.md`. Receipts: `desktop/cradle/walk/artifacts/*.json`. Every number below is
from a receipt or a command the lead re-ran; "proven" names the check, "not proven" names the gap.

## What exists

| Piece | State | Evidence |
|---|---|---|
| Site-led field as Base's default centre (`oi.surface/field`), one coordinated locus, main/tangent/keep/promote/return, shared graph+connections filters, breadcrumbs/pager, search, Expression chips + Library "Here", constellation → Technē, reachability utility bar, continuity across reload/reopen | working | walks: first-encounter 39, generic (Epi OFF, ordinary corpus) 26, reachability 20, constellation 25, continuity 23, keyboard 22, ux-transfer 52, typography 52 |
| Same operations for human and agent (`select`/`open-preview`/`keep`/`promote`/`close` = ExpressionWorld `selection_set`/`portal_open`/`portal_close`) | working | `field-world.test` 5/5 against the real kernel: pointer == direct == second caller; an external `selection_set` moves the field with no navigation |
| Companion with the field encounter as prepared context (generation recorded; in-flight turn keeps its basis) | working | real turn: journal carries `field generation 7`, live moved to 8 (walk 15/15, re-run by lead) |
| Epi lens selects the real Prime-QL body; real turn makes `ql_*` calls; Kev decision + Redis-prepared context delivered | working | field-matrix prime/rich 15/15; `prime-kev-redis-turn` 7/7 (Kev counters 18→24, 3 QL receipts at `6a81fc44`, Redis readback = delivered view) |
| #598 repairs, each with a regression | done | see below |
| Minimal bundle closure, clean install/update/rollback/remove | working | `clean-minimal-install` 15/15; bundle `oi-cradle-0.1.0-aarch64-apple-darwin.tar.gz` (21 MB), `BUNDLE.json` records closure `minimal` |
| Clean-context services without Workcell (real Redis, real Kev from the pinned weights with nothing fetched, a real `decide invoke`, a prepare electing it, a real QL op) | working | `clean-services` 13/13 |
| Complete public World package (1057 pages, 48 movements, 135 Expressions/1194 scenes, 64 assets, Expression renderer inside) installable independent of the author checkout; Epi adapter reads it through the kernel | working | rev `34a3fa34c85c6eeb` pinned to `cc3f8e4bf`; verify ok, 0 undispositioned; ref round trip 1057/1057, anchors 12553/12553, bodies 135/135, mutation probe 0/3056; packaged walk 14/14 (every request via `/world/`) |
| Pi package source of record and Prime distribution (pinned upstream 0.9.4, no upstream patch; explicit `-e`; fail closed; install root off the Workcell tool root; coherent faculty config) | working | Actuation 78/78, install-and-load, live launcher check; Actuation `4b13b6d` |
| AIKit: `decide service` (Kev), `now-context service` (Redis), provider-row `now_context`, config-contribution elections, `encounter-use` recorder | working | aikit-cli 586+, store 342, clippy/fmt clean; real redis-server 8.10.2; ai-kit `557abfc8` |
| Candidate launch route (isolated profile, real kernel, real World/edition; web and native shell) | working | `scripts/candidate-launch.mjs`; native shell starts under its own socket; `candidate-route` walk 16/16 (re-run by lead): first-run welcome → real projects → Epi on → packaged essay (19 graph nodes) → relation → tangent → Expression from the packaged renderer, all 15 edition/renderer requests via `/world/` (200), none elsewhere. Notes: the footer lens appears on hovering the bottom edge; on the dev bridge opening takes 3–20 s (≈25 queued `receiving` ops, no limit under Tauri IPC); a dropped `world_resolve` request is retried twice and the unavailable state has a 'Look again' button |

### #598 repairs

1. Common hosted-surface contract carried Factory fields → neutral `conversation` + `HostedHostContext`; non-Factory specimen mounts through it.
2. Base dispatched `oi workcell status` on every scope-menu open and always offered Factory → census-gated (`known present` to dispatch, `not known absent` to offer).
3. Kernel configuration registry, system-composition read and the CLI configuration engine ran `<ns> config-contribution|system` for products the census reports missing (and could reach binaries via inherited `OI_*_BIN`) → disclosed as not installed, never probed. Found and proved by the absence tripwire (red→green): 0 dispatches across startup, scope menu, every mode, Settings; census reports exactly 0/1/2 + 5; positive control recorded. Kernel lib 244; CLI `kernel_surface`/registry conformance 10/10.
4. Registry compiles without the Factory manifest and names no Factory (CLI test).
5. With the everyday INSTALLED (old) `oi` the installed app still dispatched `factory|workcell config-contribution` at start (via `oi profile list`): the CLI fix ships with the app.

## Measurements (first main-machine baseline, M-series Mac, debug-quality dev server)

`field-resources`, 30 cycles of select→tangent→keep→promote→back→Expression→return, budget fixed from the first run before tuning:

- cold shell 901 ms; essay ready 412 ms after the lens turns on (1313 ms total); warm reload 278 ms.
- latency p50/p95 (ms): select 71/79 · open tangent 97/120 · keep 63/64 · promote 64/79 · back 231/280 · open Expression 83/157 · return 197/231.
- start/peak/settled: heap 71.0/111.4/76.5 MB · DOM 29,739/108,785/42,352 · listeners 528/7,197/847 · process RSS 1290/2261/1548 MB · iframes 0/1/0.
- the first run found a real leak (~+355 detached nodes per cycle: contents-row closures kept every left page alive). Fixed; after the fix DOM/listener drift 0, heap +2.7 MB, 13/13 against the unchanged budget.
- latency budgets are load-sensitive: a run at machine load 7–10 failed four p95 budgets while structural checks passed; the walk now records load and does not evaluate latency under load (B).

## Actual QL / Kev / Redis use (not process presence)

- **Prime-QL body in the field:** `encounter-use` read-back — prepared context delivered (version 2, no degradation, 8 sources selected), Kev decision invocation and provider identity behind it, Redis readback equals the delivered view, `ql_project_event` → `ql.agent-projection/v1`, owner faculty receipts `success` at QL `6a81fc44`.
- **Kev:** the owner's real `kev-0.8b` (mlx) serving at :8019; request counters moved in every real turn (e.g. 22→29, 29→32). In the clean sandbox a second Kev from the same pinned weights answered a real invoke (candidate "The Crossed Zero" 0.7824 vs "Pasta recipes" 0.3103, 123 ms).
- **Redis:** AIKit's native service (`now-context service`), "workcell not involved", profile conforms; delivered view read back with digest.
- **Finding:** Kev's NOW selection does not discriminate on a small candidate set (an unrelated Jung page scored highest at threshold 0.2); the QL faculty's own decision heads have no Kev election in the installed faculty config (pinned model revision not available here).
- **Version-drift defect (fixed in Actuation):** the owner instrument answers with the revision baked into its binary; a stale `faculty.json` pin made every faculty call fail "revision mismatch" and the body investigated for 8–15 minutes. `install` now refuses an incoherent config; `faculty-config` generates one from the instrument.

## Not proven / needs the owner (exact)

- **No automated drive of the installed app's window** (no screen-capture permission): the installer lifecycle, process start, socket, kernel and the same frontend are proven; the native window and the renderer inside it were probed (`isSecureContext`, `crypto.subtle`, digest match) but not driven.
- **Real model turn in the CLEAN context: not run, by design** — no credential exists there and none was copied. Named gap per harness (Pi, Prime). Login/API-key coverage is therefore: Prime and Pi via the owner's existing login in the isolated rich context only.
- **Everyday `epi-prime-ql` and `pi` rows are unchanged.** Installed AIKit (`1bf1f02a`, session-space 23 Sep) lacks `encounter-now-context-configure`, provider selection and the elections; they need AIKit ≥ `557abfc8` installed through the owner's `oi` product install, the resident `encounter-serve`/gateway restarted, and `epi-prime-ql` reconfigured with `encounter-epi-prime-configure` (new `--extension`/`--installation`) and a generated faculty config.
- `~/.config/epi-logos/faculty.json` is stale (pins `8eff719b`; instrument is `6a81fc44`); not edited.
- **QL release material (G4):** the `ql` binary, `ql-agent*` wrappers and faculty config as versioned release artefacts are named in the manifest as supplied, not packaged.
- **Prime "fork":** none exists upstream; delivered as a pinned distribution with a three-point delta in Actuation (no repository created; creating one is the owner's act).
- **Authoring defects in the World (the owner's text; listed, not hidden):** 79 dead edition links (9 ambiguous wikilinks: two published notes share a name), 45 missing fragments, 114 source references resolving to nothing (24 targets; 7 mechanical `WHOLE-FIELD` renames and Method/Methodology prefixes are prepared as `ESSAY-MECHANICAL-REPAIRS.proposal.patch`, not applied), 83 stale Expression source bindings (exported against `dbf3b17`).
- **Local Kev and Central-read sources:** provider selection only offers sources with `external_egress = allowed` and `agent_visibility = payload`; Central-read sources default to denied, so local Kev sees only the field's own per-item allowances (narrow, recorded). Loosening the default is a disclosure-law change.
- **Environment:** `/opt/homebrew/bin/node` (Cellar node 26.8.1) is broken by a Homebrew `simdjson` upgrade (`libsimdjson.33.dylib`); `node@24` works; `brew reinstall node` is the usual repair and was not run.
- Not yet built: the 4-context matrix's second leg for Pi/Prime on a clean *installed* app window; wider-product refit (#594, deferred by instruction).

## Next concrete action

1. **Open the candidate from a Terminal (zsh), not from Finder or the Dock:**
   `cd desktop/cradle && node scripts/candidate-launch.mjs --mode web --worlds-root ~/.oi-candidates/worlds --oi <candidate oi>` (or `--mode tauri` for the native shell).
   It provisions, idempotently, an isolated AIKit home at `~/.oi-candidates/central-field/aikit-home` (the everyday `~/.aikit`, its rows and tools are not touched):
   the `epi-prime-ql` row on the NEW launcher (explicit `-e` QL extension, fail-closed binding, coherent faculty config generated from the owner instrument), Redis-prepared NOW
   context electing your live Kev, a Redis service of its own on `127.0.0.1:6391` (stopped when the launcher exits), a frozen, verified copy of the candidate AIKit build
   (`~/.oi-candidates/central-field/aikit-bin/aikit`), and frozen copies of the `ql` and `ql-wiki-refraction` engines (builds of the live QL checkout, not release material: the G4 gap).
2. **In the app:** choose the **O-I** project in the scope menu (it holds the essay; the companion's conversation belongs to a project, and with none the panel says "opens a new conversation in ,"), turn the
   **Epi-Logos** lens on (hover the bottom edge, press the lens, or Scope → World → Epi-Logos), open the companion (right panel) and set **Companion → "Follows the active locus"** so each turn carries the field's
   place (the default is "present, not prepared"). The first send provisions the Prime-QL body.
3. **Kev** must be answering at `127.0.0.1:8019`. The launcher says if it is not; to start it:
   `sh ~/.workcell/decision-models/kev-0.8b/serve-kev.sh ~/.workcell/decision-models/kev-0.8b 8019`. If it is down, context delivery degrades and says so; the turn still runs.
4. **Model login, per harness, stated independently.** Both harnesses default to `zai` / `glm-5.3-flash` (`~/.prime/agent/settings.json`: low thinking; `~/.pi/agent/settings.json`: high).
   - **Prime** (the Epi-Logos Prime-QL body, what the lens uses): its stored logins (`~/.prime/agent/auth.json`) hold only `minimax` (API key). There is **no stored `zai` login**: the key comes from the
     environment variable `ZAI_API_KEY` of the process that launches the candidate (candidate-launch to bridge to the resident owner to Prime). Nothing here ever writes it to a file.
   - **Pi** (the other body): `~/.pi/agent/auth.json` holds only `openai-codex` (OAuth). Likewise no stored `zai` login: it also reads `ZAI_API_KEY` from its environment. A Pi `/login` for zai would store one, and is optional.
   - Where the variable lives today: it is exported in `~/.zshenv`, so any zsh (including non-interactive ones) has it and a Terminal launch works. `launchctl getenv ZAI_API_KEY` is empty, so an app started from
     Finder/Dock has NO key and Prime/Pi will fail to authenticate (`401`/"no API key"). If you want Dock launches to work, either `launchctl setenv ZAI_API_KEY ...` (kept in launchd memory until logout) or log Prime in with `prime-agent` for zai.
   - The launcher prints `ZAI_API_KEY is not set in this environment` when it is absent.
   - A `429 Rate limit reached for requests` from the provider (seen when several runs overlap on the same plan) is the plan's limit, not the candidate: wait and send again.
5. **Everyday rows, not changed.** To upgrade `epi-prime-ql` and `pi` in place, safely and reversibly: (a) back up `~/.aikit/state/encounter-providers/{epi-prime-ql,pi}.json`, `~/.aikit/decision-provider.json`, `~/.config/epi-logos/faculty.json` (pattern: `~/.oi-candidates/epi-prime/backups/<stamp>/`);
   (b) install AIKit at or after `557abfc8` through the owner's `oi` install (the installed `1bf1f02a` lacks `encounter-now-context-configure`, provider selection and the elections), restart the resident `encounter-serve` owner and the gateway;
   (c) install the Prime distribution into a tools root (`epi-distribution.mjs install`), generate the faculty config from the instrument (`epi-distribution.mjs faculty-config`), `encounter-epi-prime-configure --provider-id epi-prime-ql ...`, then
   `encounter-now-context-configure` on both rows against a request authored for the project; (d) verify with one real turn and `encounter-use`; to undo, restore the backed-up files and the previous aikit. I have not done this: the owner's call, after the candidate review.
6. Land the branch (O:I, AIKit, Actuation) through their PRs after the owner's review.
