## 15. Native Agent creation and Direct-session delivery — 20 September 2026

This section continues SG12 and the existing #220/#65 campaign. The creation and
session consumers are production code, not renderer-only Agent records. Their
installation, actual model behaviour and human experience remain separately
proved. Both near-term outcomes remain standing: installable/self-inhabiting
technology **and** the complete source-backed published corpus. This lane does
not claim the Factory, voice, QL or publication programmes complete.

### Exact source and review boundary

The implementation is [O:I #424](https://github.com/EpiLogos/O-I/pull/424), branch
`agent/native-agent-session-20260920`. Its recovered UI source is
`060f0165a8ecbdc2fb3bece48c7c4d48d05e2610`, not an assumed main. The original
`agent/expression-world-convergence-20260917` ref was subsequently retired; the
immutable review anchor `agent/native-agent-review-base-060f0165` names those
same bytes. #424 is retargeted to that anchor so its review shows the bounded
Agent/session delta, not hundreds of inherited UI changes. **Do not merge the
review anchor into current main or restore its old UI wholesale.** Local
integration takes the reviewed delta into the actual reconciled application.

Native dependencies, with the exact inspected production cuts:

| Native owner | Required contract | Inspected head |
| --- | --- | --- |
| [Central #202](https://github.com/EpiLogos/Central/pull/202) | `agent-profile.review`, authenticated `.accept`, accepted `.roster`, exact source locking | `d0001cb7ca9eb2886c7158f05aa65272da198fa1` |
| [AIKit #358](https://github.com/EpiLogos/ai-kit/pull/358) | accepted Direct Agent binding, effective Skill discovery, preparation/readback, parent context and credential boundary | See #358's final head/CI receipt; production descended from `79790ad48d98c228d4f5162617333a059c755617` |
| [AIKit #356](https://github.com/EpiLogos/ai-kit/pull/356) | exact native model capability/read/write and observed-session guard | `8290196495e83605fdcafa986c2130939a19fc64` |
| [AIKit #364](https://github.com/EpiLogos/ai-kit/pull/364) | real folded `aikit session-space` owner startup and model/task self-spawn | `62161b00249111ae797a41c825bc75e5054b4de0` |

#364's actual commit parent is `37994265f5727af50ec6446687ed629dde047412`.
A PR's moving base SHA is not the historical parent of its implementation.
The joined CI applies the published native deltas only to its disposable test
checkout, records the exact composition, and never merges or pushes that assembly.

The merged [setup #406](https://github.com/EpiLogos/O-I/pull/406), merge
`574ef564523b8e1c582a47aa4c6f5a90811c1f75`, and D's current successors must be retained.
In particular, do not replace its reviewed `SetupFlowController`/PlanDrawer with
older files inherited by the UI anchor. SettingsHome and SettingsPageV2 carry
small, explicitly dependent target/return hunks only; their general forms and
W1's shell/layout remain with those owners. The same rule applies to the small
AgentLayer, CradleFrame, kernel-operation and type registrations. Preserve the
Context/editor and Factory writers' independent hunks.

AIKit #360 and #364 overlap at native startup/credential delivery; Central #204
and #202 overlap at profile storage. Inspect the actual successor/merge state
before integration. Preserve #202's stronger descriptor-relative acceptance and
locking protections. Do not resolve a conflict by restoring an entire older file.
Actuation's existing harness/admission/permission contracts are consumed, not
replaced; model choice is never an Actuation grant.

### What the new path does

The person names a reusable Agent, writes its purpose and explicitly confirms the
native root or child-Project scope. The surface discovers actual effective Skills;
untrusted, disabled or unavailable revisions cannot become selectable by a renderer
flag. References are retained through proposal and source review. Central creates
the definition through its existing expression path. Its generated provenance
remains generated; a separate authenticated human acceptance receipt binds the
exact revision and source digest. The consumer rereads both the source and the
native roster before offering preparation. A lost acceptance reply triggers a
read, never another silent write.

AIKit then prepares an existing native SessionSpace/AgentSession attachment under
an idempotent request identity. An interrupted partial preparation is disclosed
as partial and continues only under that same identity. Preparation starts no
provider, creates no Factory ancestry and grants no execution authority. Durable
Agent identity, a temporary task role and the runtime session remain different
objects. No Guardian replacement or renderer-side Agent store is introduced.

Opening that session uses the existing native discovery, harness startup,
handshake, stream, tool/permission, cancellation and supported reconnect paths.
The composer reads model options from the exact resident harness. ACP may expose
a writable session selector; Pi's launch-time policy does not become a fabricated
resident selector. Older owners without the capability field stay read-only.
Native policy pins and observed session identity constrain writes. Lost or
contradictory acknowledgements are unknown, not success or an automatic retry.

The parent receives the current accepted native definition and exact effective
Skill bytes on the actual prompt path. Changed accepted source or Skill digests
are refused before a subsequent turn. A native submission receipt records hashes
and source relationships, not private body text. Submission, provider response and
independent model consumption remain different observations. Brokered-child
activation is explicitly **not established** by the parent receipt; children need
their own context and authority admission. The implementation does not quietly
promise parent Skills to every descendant.

The sidebar's repair excursion names the native owner, topic and operation when
available, selects the actual owner Settings receiver, and offers credential
presence/reference controls rather than secret-material fields. World and
acceptance repair retain their Central operation identity. Returning rereads
readiness without submitting the held Agent purpose, replaying a turn or clearing
the conversation draft. General setup and secure credential material remain native
owner operations. No key is entered into chat, this packet, a profile, browser
persistence, telemetry or a PR.

The new Direct-definition route is presently scoped to Central root and an exact
registered Work Project. Central remains the root meta-project. Existing other
native World/Agency/session routes are retained; this is not a claim that every
harness or arbitrary external World acquired a new selector or admission path.

### Executed evidence and original failures

O:I production source `3b8f46433e8f453e20dd35a0dccc380d736a6ae1` passed run
[35531934485](https://github.com/EpiLogos/O-I/actions/runs/35531934485): 34 controller
regressions, nine actual-component Chromium checks, 16 packet tests, full production
TypeScript/Vite build, 12 focused kernel tests, full kernel **105 passed / 0 failed /
51 existing native-owner-gated ignores**, and strict kernel Clippy. Artifact
`10611184741` retains the actual tested source and logs; the workflow's trigger SHA
is the preceding source-publication step, not the tested commit. The later packet
context-receipt assertion is tested separately at the final PR head.

Central #202's source passed **508 workspace tests**, its six focused acceptance
cases and an explicit `ctrl` build. Its repository-wide formatting and strict lint
are not green: the separately retained baseline at `12ee31313e710378845baae190efc1a4b3e7ebdb`
reproduces formatting changes and the harness connector's redundant-closure lint.
Baseline artifact `10602979237` and current artifact `10603657859` preserve that
comparison. Those unrelated files were not reformatted or their checks disabled.

AIKit source `66abc6bee7a61f0539e339f1b327981aa86ad5ad` passed the full native suite:
**2,942 passed / 0 failed / 35 existing ignores**, plus full strict Clippy. The
original QL-provider failure also passed its separate fresh three-case rerun;
that observation is not a claim to have repaired QL production code. The native
joined checks in #358 exercise actual `ctrl`, `aikit`, stores and production ACP
handlers with a test-only peer, including fragmented streams, source-dependent
returns, permission denial, cancellation, disconnect, owner restart, native
identity refusal and effective Skill byte delivery. Their final result and exact
composed tree are in #358's closing receipt, not inferred from the desktop build.

Retain the original failed runs. O:I `35522541087` exposed a missing SessionSpace
version in the controlled peer; `5f702302` corrected it and added malformed/missing
version refusal. `35526825805` then passed those focused cases but encountered
`ETXTBSY` in the existing full-kernel temporary-script test; the fresh full run
above passed without changing that test. AIKit's joined test first incorrectly
waited for `Idle` instead of the native `Resident` state, then correctly refused
an enabled but unreviewed test Skill. The repair performs the native trust-review
operation for that controlled revision, not an eligibility bypass. A test assembly
using #364's moving PR base rather than its real parent also failed; its patch and
failure remain retained. Earlier selector-format, formatter, preview-interface,
browser-render and rejected-workflow-push failures in #356/#424 remain in their
historical CI receipts. None is relabelled as a pass.

These are repository and controlled-process results. No live commercial/local
model, installed Mac candidate, microphone, voice conversation or human acceptance
has been observed by this remote lane.

### Bounded local packet and integration walk

Use `desktop/cradle/tests/agent-native-local.py` with Python 3.11 or later and the
actual selected `ctrl`, `aikit` and `oi` executable paths. The default preflight is
read-only. It records their SHA-256s, the native scope, eligible Skills and the
roster. Every subsequent phase uses a **new private receipt file** and the previous
receipt; a changed candidate or scope is refused rather than quietly reusing it.

```sh
python3 desktop/cradle/tests/agent-native-local.test.py
python3 desktop/cradle/tests/agent-native-local.py --help
python3 desktop/cradle/tests/agent-native-local.py \
  --ctrl "$CTRL" --aikit "$AIKIT" --oi "$OI" --cwd "$WORLD_DIR" \
  --receipt "$PRIVATE_RECEIPTS/01-preflight.json"
```

Resolve the arguments from those actual readings, not a guessed model or Agent.
The phase sequence is:

| Phase | Additional explicit input | Evidence required before the next phase |
| --- | --- | --- |
| `propose` | `--execute --name … --purpose-file … --confirm-scope …`, optional repeated native `--skill` | Real source ref and reviewed body; no acceptance implied |
| `review` | Previous receipt or an actual `--profile-ref` | Exact native source and digest shown for human review |
| `accept` | `--execute --prior … --reviewed-digest …` | Existing native human-authority channel, then source and roster readback |
| `prepare` | `--execute --prior …` | Original request correlation and complete native attachment, no provider yet |
| `connect` | `--execute --prior … --provider …` | Actual eligible provider discovery, startup and native handshake |
| `live` | `--execute --prior … --provider … --source …` | A new source-dependent assistant return and fresh matching parent context-delivery receipt |
| `resume` | Same as live with the previous live receipt and a **new** source nonce | Same persisted native identity and another fresh source-dependent return |

The purpose file is the exact desired text, including an explicitly reviewed
trailing-newline choice; the packet never silently trims authored words. No phase
creates a human authority source, installs a credential, invents a provider or
makes a private rule authoritative. Missing genuine setup goes through its native
owner and a reviewed human decision. A stored proposal does not substitute for it.

The source probe's first line is `OI_AGENT_PROBE_` followed by a new random
32-digit hexadecimal value. Keep the source within the explicitly selected World;
its bytes must never appear in the prompt. The live phase delegates to the existing
`agent-native-live.py`, checks new output from the exact native session and requires
healthy completion. It additionally reads new journal events and compares the
accepted Agent and effective Skill digests to preparation. Parent submission is
not relabelled as independent model consumption or child activation. A timeout,
disconnect or refusal preserves the receipt and never automatically replays work.
Provider use may be billable. Permission requests remain visible for human review.

After integrating the delta and selected native dependencies, repeat the activity
through the actual desktop: create/review/accept, read the roster, select the native
harness/model, retain a draft through one setup excursion, return useful work,
deny one harmless requested effect, interrupt and explicitly reopen where supported.
Use both root and one genuine child Project without manufacturing a fake child
for root. A native process restart and a UI close/reopen are different observations.
The local operator starts the supported native owner before the packet's resume
phase; the packet itself never installs products or kills resident services.

Open `tests/agent-native-device.html` in the actual candidate for explicit local
microphone capture/stop/playback and record human listening, denial or unavailable
capture honestly. It uploads and persists no audio. Ordinary-browser playback is
not Mac app microphone or Nara/dictation proof. Native keyboard, focus, window and
voice integration are separate local checks. Return exact source/build/install/
running/provider identity and bounded failures to these same PRs and #65. Keep
private receipts private; publish safe hashes and outcomes, not personal source,
transcripts, keys or device names. Local integration owns merging and installation;
this remote lane performed neither.
