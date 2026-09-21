# 08 — Wave 5 System contribution: the consumer seam

**Historical/current boundary:** §§1–7 preserve the 10 September 2026 Wave 5
record, including its then-open gaps and receipts. They are not a fresh
machine census or a claim that engagement is still read-only. The current
19 September human setup/configuration/recovery consumer is recorded in §8.

What the cradle's System surface could consume in the recorded Wave 5 round,
owner by owner, and what each reading was honest about. This is the
integration contract for the UI lead. The historical round describes inputs
that existed and were exercised on that machine; it is not a design for
anything unbuilt or evidence of a newly inspected machine.

Companion documents: `06-SYSTEM-SETTINGS.md` (the law, L1–L6, and the base
`v1` descriptor) and `07-WAVE-5-SYSTEM-CONTRIBUTION.md` (the `v2` descriptor,
the mount document, and §4.5–§4.8 which fix the conventions this round
closed).

## 1. The one call convention

For every owner the surface asks the same question in the same way: invoke
the owner's own executable, read-only, in that owner's own namespace, take
one document from stdout.

```text
oi <namespace> system --json        # through the oi six-product command field
```

The `oi` dispatcher maps namespace to the owner's real executable, so
`central` runs `ctrl` and `ai-kit` runs `aikit`; the surface never needs to
know the executable's name. The document on stdout is the whole reading.
Nothing is passed through a cache, a settings store or a renderer-side
transform.

Five of six owners emit the descriptor bare on stdout. AIKit did not: it
wrapped the descriptor in its normal command envelope, so its top-level
`schema` was `1` and the mount correctly degraded it. That is now fixed at
source — `aikit system --json` emits the bare document, and every other
`aikit` command keeps its envelope. All six now answer with a top-level
`schema` of `oi.product-settings-disclosure/v2`.

## 2. What each owner discloses

Exercised against the live checkouts, readings re-taken 2026-09-10.

| owner | namespace | product_id | sections | actions | top-level `schema` |
|---|---|---|---|---|---|
| Central | `central` | `central` | 8 | 8 | `oi.product-settings-disclosure/v2` |
| Actuation | `actuation` | `actuation` | 5 | 17 | `oi.product-settings-disclosure/v2` |
| AIKit | `ai-kit` | `ai-kit` | 9 | 14 | `oi.product-settings-disclosure/v2` |
| Factory | `software-factory` | `software-factory` | 2 | 2 | `oi.product-settings-disclosure/v2` |
| Workcell | `workcell` | `workcell` | 9 | 18 | `oi.product-settings-disclosure/v2` |
| QL-MEF | `quaternal-logic` | `quaternal-logic` | 3 | 1 | `oi.product-settings-disclosure/v2` |

Each document carries its own `owner` block (`owner_ref`, `owner_version`,
`reading_command`, `reading_digest`, `reading_digest_covers`,
`observed_at_unix_ms`), `about`, `sections[].settings[]`, `actions[]`,
`availability`, `degradations[]` and `obligations[]`.

Coverage, honestly stated:

- **Central** — personal/Project ground, self-description, machine intent,
  skills and their authored standing, privacy/disclosure policy, proposals
  as the staged axis, accepted source mutation, and its canonical Actions.
  Authored source lives under `Control/`; observed state (doctor, wiki,
  machine inspection) appears as `active` with its own provenance and is
  never presented as authored.
- **Actuation** — agencies and determinations, WorldBindings, bounds,
  authority, harness detection and self-identification, realised/instantiated
  actuation receipts, streams, and its canonical Actions with each action's
  authority requirement named.
- **AIKit** — project binding, profile/scope resolution, skills, sets and
  methods, usage overlays, context sources and resolution, models/providers
  and credential *presence*, harness composition, surfaces, session spaces,
  resource and Action horizon, generation and procedure, explain/history.
- **Factory** — build provider and view contract, developmental reads, the
  Run development ledger, and the `request-evidence` canonical Action.
- **Workcell** — workcells and instances, providers/offers/capabilities,
  processes and services, storage and artifacts, fabric reachability,
  local/remote state, model-serving materialisation, hardware and accelerator
  observations, lifecycle/reconcile/release, and material Actions.
- **QL-MEF** — only currently accepted kernel availability, deterministic
  operators, verification, and provider-backed service availability. QL
  remains optional; the surface must stay functional without it.

## 3. The mount document

The composition layer returns `oi.system-composition/v1` (frozen shape in
07 §5.1): seven positions — `oi` plus the six products — each with
`availability`, `reason`, `reading_command`, the owner's `descriptor` passed
through unmodified, `error`, and `provenance`. A position with no mounted
descriptor still appears, with its reason. The census rides along so
"installed is not ready" stays true.

### 3.1 What the mount resolves, and what that means today

The mount does not run the dev trees. It asks `oi <namespace> system --json`,
and the dispatcher resolves each namespace to the product the suite has
actually deployed under the managed root. Verified on this machine
(2026-09-10):

- The deployed product builds are from 17 August and predate the Wave 5
  `system` verb, so `oi central system --json` answers
  `Unknown command: system`, and `oi actuation`, `oi factory`, `oi ql`
  answer `not registered with O:I`.
- Therefore every mounted position degrades today, with a real reason, and
  none of them fabricate a descriptor. That is the correct reading of this
  machine, not a defect in the mount.
- The composition becomes populated only after the owners' revisions are
  deployed through `oi install`. Per-product environment overrides
  (`OI_CENTRAL_CTRL_BIN`, `OI_ACTUATION_BIN`, `OI_AIKIT_BIN`,
  `OI_FACTORY_BIN`, `OI_WORKCELL_BIN`, `OI_QL_BIN`) point the dispatcher at
  a dev tree instead; confirmed working — routing `aikit` through
  `OI_AIKIT_BIN` returns the bare `v2` descriptor.

The consequence for the surface: the mount's reading is only ever as good as
what `oi install` has deployed, and the UI should present a degraded position
as "the deployed build does not answer this reading yet", which is a
deployment fact, not a missing capability.

`oi`'s own position is derived from the census the mount actually obtained:
`unavailable` when the census could not be read, `degraded` when it warned,
`available` otherwise. It is never asserted.

## 4. The axes the surface must not collapse

Per setting: `declared | effective | active | staged | expected_effect`, each
carrying provenance. Per 07 §4.1 and §4.8 these are three different facts,
not three labels for one resolved value. Where nobody authored a value,
`declared` is `null` — and that null is the finding the surface exists to
show. AIKit was the owner that got this wrong and has been corrected: 21 of
its 24 settings have an honestly null `declared` axis, and no setting's
`declared` axis shares its `effective` axis's provenance.

## 5. What is still open

1. **Factory ↔ Actuation.** The discovery/intent/authority seam between these
   two owners is not resolved in current native contracts and was
   deliberately not invented. Factory carries `actuation_ref` as an opaque
   reference it reads but assigns no discovery, intent or authority semantics
   to. This is a serialized owner decision, and the sole blocker carried out
   of this wave.
2. **The owner set is a constant, not a discovery.** Both kernel
   implementations hold the seven positions as a fixed table
   (`PRODUCT_IDS[6]` and `FALLBACK_NAMESPACES[6]` in the kernel; the existing
   `composition::PRODUCTS` also validates that the census discloses exactly
   six). Adding a seventh product therefore needs a code change in the
   kernel, which is in tension with L6's "adding an owner never requires
   cradle code changes". The *loop* over owners is uniform; the *set* is not
   discovered.
3. **Engagement is read-only.** P3 intent/invoke is not wired through the
   System seam this wave. Each owner's mutating operations are disclosed as
   `missing_native_obligation` or `unavailable` with a reason, never as
   callable controls.
4. **AIKit's reading outside a project.** From a cwd with no project root the
   reading is now honest and stable — it exits 0, emits the bare `v2`
   document, and reports `availability.state: "degraded"` with a fixed
   reason — where before it exited 1. One blemish: its single degradation
   entry carries a null `subject_ref`, so the surface has a degraded state
   with nothing to attach it to. Worth naming the subject
   (`ai-kit:project-binding`) on the owner's next pass.

## 6. Evidence

- Round-1 owner receipts: `/private/tmp/oi-w5/RECEIPTS/*.md`
- Independent round-1 verification: `/private/tmp/oi-w5/RECEIPTS/VERIFY-*.md`
- Round-2 remediation receipts: `/private/tmp/oi-w5/RECEIPTS/REMEDY-*.md`
- Independent re-verification: `/private/tmp/oi-w5/RECEIPTS/REVERIFY.md`,
  with its full method detail preserved at `REVERIFY-full-report.md`
- Round-3 fixes (Central availability, Actuation stream state):
  `/private/tmp/oi-w5/RECEIPTS/REMEDY-3.md`
- Live readings and test output per owner: `/private/tmp/oi-w5/LIVE-EVIDENCE/`
- **A real composed mount**, taken through the `oi` dispatcher with the six
  owner overrides set to the remediated dev trees:
  `/private/tmp/oi-w5/LIVE-EVIDENCE/system-composition-live.json`
  (`schema: oi.system-composition/v1`, 7 positions, 345,139 bytes). Each of
  the six product descriptors was compared against that owner's own
  `system --json` output: all six are identical modulo the live timestamp
  fields, and all six `reading_digest` values match the owner's own read.
  Workcell's differs across runs only in `live_processes` (736 then 738) —
  the world changed, not the reading.

### 6.1 The O:I kernel contribution is a candidate, not landed

`desktop/cradle/kernel/src/system_composition.rs` in the export is the
composition adapter described here, with its own tests (29 passing). It is
**not** in the live O-I checkout, because a concurrent session has already
written a parallel implementation of the same seam into
`desktop/cradle/kernel/src/composition.rs` and the cradle UI types, and
landing over it would collide. Treat the export file as a candidate that
already satisfies this contract; the reconciliation is the O:I owner's call.

Its `oi` position availability is derived from the census the mount actually
obtained — `unavailable` when the census could not be read, `degraded` when it
warned, `available` otherwise — pinned by two tests.

## 7. Conventions closed in this round

Nine real defects across three audit rounds were found by independent
verification and fixed at the owners, then re-taken live. The rules now in 07
§4.5–§4.8 are the result:

- `reading_digest` is sha256 over the descriptor with every `*_unix_ms` field
  zeroed and `reading_digest` null, so a changed digest means a changed
  reading and not a changed clock. Verified stable across two runs for all
  six owners, and `owner.reading_digest_covers` is present in all six.
- `provenance.path` is a location, never a command string.
- `availability.state` and `degradations` are derived from a real observation
  whose failure branch is reachable, never a literal.
- `declared` is authored source only; `null` where nobody authored it.

The two that would have shown Frank something untrue:

- **Actuation** claimed no product-owned default stream store exists, when the
  store exists, and then reported one open stream when the only stream in it
  was closed. Both were unprobed counts. The axis now reads each stream's real
  lifecycle state and reports `open_streams: 0, closed_streams: 1`.
- **Central** asserted `availability: available` as a literal while already
  running the doctor probe that could answer it. It now derives the state from
  that probe, and the failure branch is reachable: pointed at a root that does
  not exist, it reports `unavailable` with the reason, not `available`.

Two of the nine were the UI lead's to catch and one was mine: the first
remediation wave omitted Central entirely, so its hardcoded availability
survived a round and was only caught by the re-verification. Worth knowing
when reading the receipts — the audit found what the brief forgot, not what
the worker got wrong.

## 8. Human setup and recovery consumer — 19 September 2026

### 8.1 Recover the current implementation before naming a gap

The source inspected for this contribution is O:I
`0b3583be80868bcc3edfb4a449ae17010f0bbd74`, not the older installed cut in
§3.1. The accepted [#299 configuration plane](https://github.com/EpiLogos/O-I/issues/299)
and [#109 native engagement](https://github.com/EpiLogos/O-I/issues/109)
already supply mutable owner operations. The `v2` System disclosure above
still does not itself grant write authority: the configuration plane's
existing contributions, planning, native operations and receipts do that.

```text
System / Profiles
  → existing PlanDrawer ingress
  → ConfigPlaneSource (sourceHost / liveSource)
  → existing config_* KernelOps
  → installed oi config / oi profile engine
  → native owner operation
  → independent resolution / receipt readback
```

[#406](https://github.com/EpiLogos/O-I/pull/406) adds a reusable human flow
on this path, not another store, registry, dispatcher or configuration
architecture. Its bounded files were claimed with the active #375 Track 1
owner before editing. It leaves CradleFrame, shared routes/store/styles,
SettingsHome design and unpublished local UI work untouched. Track 1
integrates the compatible drawer into the actual current Mac application;
Track 2 owns the native operations; Track 3 owns QL/Expression facilities.

### 8.2 Human sequence and truthful state

The full setup experience is discovery → intended composition → relevant
settings → validation/plan → authorised application → native readback →
useful first action. This contribution implements the contributed-setting
portion and recovery through the existing System/Profiles entry. It
supports discovery of actual composition/availability, typed setting and
scope selection, native path browsing, and a real optional source-reading
first action. It is not a replacement installer or the final cross-product
composition picker: installation/adoption/removal remains an operation of
the installation owner under [the existing variant specification](../experience/INSTALLATION-VARIANTS.md).
Do not represent product absence as a mutable preference or equate an
application M′ mode with an installation form.

Back, Cancel and drawer remount retain an **in-memory, app-session draft**;
this is not a promise of process-restart persistence. Editing invalidates
the reviewed plan. Discovery, editing and planning do not write native
settings. Apply explicitly authorises holding the reviewed desired entries
and invoking native apply. Forms use actual enums, booleans, scopes, numbers
and structured rows/lists, not a raw-JSON editor. Reference suggestions are
previously disclosed values; they are not represented as a universal
resolver. Read-only, unavailable and out-of-composition contributions remain
read-only. Secret settings transport references from the owner's secure
mechanism; no credential-material field, profile copy, log or receipt is
introduced by this flow.

Desired, declared, effective, active and staged values are separately
rendered. A successful apply does not assert that an old running Session or
service has restarted. The owner-disclosed restart/reconnect effect stays
explicit. Incomplete, expired, duplicate or foreign-scope plans cannot
silently apply a successful subset. Native/desired changes after review
require a fresh plan. There is no implicit rollback.

A partial desired hold is distinct from native application. Partial native
results preserve each operation. Only explicitly retryable failed
setting/scope pairs enter a new plan; successful siblings do not replay.
Receipt/readback failure retains the apply result and offers a **read**
retry. A lost apply response is an unknown outcome, not a failed write;
reconcile it through native state/history rather than automatically trying
again. Closing or remounting the form must never repeat an operation.

The production `files_list`, `sources_list` and `source_open` adapters
support a native directory picker and an optional first source read. Root
work does not fabricate a child Project. The source preview does not invoke
an Agent, write the file, replace normal pane routing or establish that a
Factory Run or the whole corpus is ready.

### 8.3 Native dependencies and parity

CLI/headless and desktop remain consumers of the same installed engine and
native contributions. Native terminal interaction continues through the
existing AIKit places/session surface and
`ai-kit/docs/v2/23-TUI-HUMAN-EXPERIENCE-SPEC.md`; a settings form is not a
terminal replacement. Use the native owner contribution to determine its
actual supported scopes, reference resolution, authority, effects and
recovery operations. An absent operation is a precise owner dependency,
not permission to fake an enabled control.

The current `liveSource.apply` submits bound requests through `config_apply`.
The renderer's reviewed-plan and preflight checks do **not** establish
atomic enforcement against a concurrent external write. Track 2 retains
native tests for authority, plan binding/staleness and concurrent CLI edits
at the selected engine cut. Secret storage/rotation and any required
restart remain native-owner responsibilities. The real file/source
adapters depend on the existing native file service and Central source
provider, not a browser-supplied filesystem substitute.

### 8.4 Executed-test record and exact remaining interaction checks

The implementation PR contains the executed results and unchanged failed
runs, with exact head/merge revisions. Its focused commands are:

```sh
cd desktop/cradle
npm ci --no-audit --no-fund
node --experimental-strip-types --import ./tests/ts-register.mjs --test tests/configuration-setup.test.mjs
npx tsc --noEmit
npx playwright install chromium webkit
node walk/configuration-setup.test.mjs
```

The tests use the existing C0 configuration fixtures, the production
controller/forms/PlanDrawer and the actual live/native adapters against
controlled typed handlers. They include disconnected-handler and negative
recovery cases. These are controlled D-scope tests, not an installed native
owner, Mac interaction or human acceptance claim. Browser artifacts remain
under the existing test-artifact convention and on the PR's CI run, not a
new evidence service. A green fixture is not completion of the production
route.

Track 1 must perform [LOCAL-CAMPAIGN §7.1](../experience/LOCAL-CAMPAIGN.md#71-a-bounded-human-setupconfigurationrecovery-episode)
on the chosen current Mac cut: System → Settings → select real owner/scope
→ edit → review → Back/edit → Cancel/reopen → one authorised Apply →
independent native CLI and desktop readback → actual restart/reconnect if
required → native path picker and a returned source. Check keyboard,
IME/Escape, focus, narrow/wide scrolling, draft restoration and terminal
continuity. Exercise denied/absent owners, stale/expired/incomplete plans,
partial application, unavailable receipts/readback and uncertain replies;
retain their original evidence. Track 2 proves native effects/authority and
concurrency, while Track 3 supplies selected QL consumer facilities.

The [current orientation](../experience/INHABITED-SYSTEM-ORIENTATION.md)
and [local campaign](../experience/LOCAL-CAMPAIGN.md) set three bounded Mac
tracks: **three O:I trees total including the primary**, one owner checkout
per native repository, no fourth verifier tree. Omarchy's bounded independent
work and Bimba/SharedField hosting do not gate unrelated Mac progress. The
Day/NOW foundation still gates broad dependent fan-out, not this independent
useful contribution. No further whole-suite audit or planning approval is
required before affected implementation/testing.

Actual Factory self-inhabitation and the complete source-backed Epi/Wiki/
Expression/Technè corpus with real hosted publication remain the two
near-term outcomes under #65/#220. This setup slice does not claim either
complete. The latest application-level M4′/M5′ clarification is consumed by
reference to the Epi lane's coordinated source amendment, as joined in the
orientation, rather than redefined in this configuration document. No
personal machine was connected to or mutated for this GitHub contribution.


### 8.5 Adoption/composition extension — 20 September 2026

#423 extends #406 instead of replacing it. `AdoptionEntry` / `AdoptionFlow` consume `oi.setup/v1` through the additive `setup` / `setup_reading` kernel adapter. The fixed stdin protocol is `oi setup --request-file - --json`, available before Central is bound. Native `setup.rs` owns review binding and durable no-retry recovery; `setup_command.rs` invokes the existing source-build/activation, Central and Desktop lifecycle owners. There is no renderer installer, authority database or credential store.

After installation/readback, the entry passes into the existing `PlanDrawer` and `SetupFlowController` with discovery-first entry. Existing callers retain direct review by default. Lane A owns the shared System ingress and visual treatment; the small dependent ingress PR must accompany the native/controller implementation. Lane C retains Agent/harness session composition. A component-only export is not an installed, wired desktop.

Native reply dispositions, exact journal identity and per-step states are checked before recovery unlocks a new plan. Contradictory success, missing journals and lost/foreign replies remain unknown. Stale native composition/receipt changes before apply are refused before writes; changes between operations stop subsequent work and retain preceding effects. Terminal configuration stops on an unverified ChangeSet rather than entering another write. Secure credential setup delegates to AIKit's existing terminal/provider operations; no password input or policy adoption is smuggled into installation.

The [local adoption packet and Mac/TUI checks](../experience/LOCAL-CAMPAIGN.md#72-installationadoption-extension--423--268--299--109) distinguish controlled browser tests, actual CLI/journal tests, actual package installation, provider inference, native Mac computer interaction, and microphone/audio observations. Web implements and controls verification through reviewable PRs; the same three Mac receiving slots integrate and perform material testing. Omarchy contributes/hosts. C0–C5, native matrices, full published corpus, Factory self-inhabitation and Day/NOW sequencing remain unchanged. No source-presence or settings-fixture result closes installation or either whole-product outcome.
