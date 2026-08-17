# O:I #43 Phase 4 — Fresh Session Prompt: Execution / Package / Tool / Rich-Content Containment

Work directly in GitHub on and across the live seams of:

- `https://github.com/EpiLogos/O-I`
- `https://github.com/EpiLogos/ai-kit` where capability/Action/Component resolution is actually owned
- `https://github.com/EpiLogos/Actuation` where Agency/Determination/execution authority is actually owned
- `https://github.com/EpiLogos/agent-system-design` where Workcell/Factory runtime containment is actually owned
- Central only where an existing personal Action/secret boundary is materially exercised

PRIMARY TICKETS

- O:I #31 — `[OI-017] Research and implement encounter security for shared and composable O:I spaces`
- O:I #43 — `[OI-017-C] Encounter-security convergence: private content → admission → exchange authority → containment`

THIS SESSION IS **PHASE 4 OF #43 ONLY**:

> **MACHINE / DELEGATED SOFTWARE EXECUTION CONTAINMENT: hostile or merely untrusted rich content, Actions, tools, packages/components and executable material must remain data by default and gain only explicitly granted, bounded capabilities at the real privileged execution boundary.**

This is an IMPLEMENTATION / PROVIDER-CONFORMANCE / ADVERSARIAL-CONTAINMENT session.

**DO NOT restart Phase 1, Phase 2 or Phase 3.**
**DO NOT treat semantic policy text as an execution sandbox.**
**DO NOT close #31 merely because Phase 4 succeeds.**
**DO NOT continue into the remaining #31 closure frontier in this same session.**

On successful Phase 4, produce a final fresh-session prompt for the remaining #31 closure/verification frontier and STOP.

---

# 0. DISTRUST THIS HANDOFF UNTIL VERIFIED

Start from the **actual current live GitHub state**.

Do not trust any SHA, PR state, issue comment, CI status, provider version, implementation claim or architectural handoff below without re-verifying it.

Inspect before changing code:

- O:I #31 and every current comment;
- O:I #43 and every current phase receipt/comment;
- O:I PR #53 and its current head/checks;
- current package/extension work from O:I #21 / PR #28 or successors;
- current desktop/native-host work from #23/#25/#26 and successor PRs;
- current A2A work from #24/#37 and Phase-3 adaptations;
- current AIKit Action/Capability/Component/Surface and trust/resolution work;
- current Actuation authority/Determination/Return work;
- current Factory/Workcell execution-provider and isolation work;
- all parallel branches/PRs which have moved since this receipt.

Other agents may be working in parallel. Converge with live implementations; do not overwrite or duplicate them.

---

# 1. VERIFIED HANDOFF EXPECTED FROM PHASE 3 — RECHECK IT

The Phase-3 receipt is expected at:

```text
shared-field/PHASE3-EXCHANGE-AUTHORITY-SECURITY-RECEIPT.md
```

Expected canonical Phase-3 line at handoff time:

```text
branch: agent/oi-017-exchange-authority
Phase-2 base: 679a370dcd7a5ce99178e3c86e8f581f72147a7b
implementation/documentation head before Phase-3 receipt: da3cf594da8828037332853c343368c87b44785a
PR: #53 — [OI-017-C/P3] Enforce explicit bounded Exchange authority
SpaceTimeDB: 2.8.1
canonical implementation run: #139 / Actions 32022520356 — SUCCESS/SUCCESS
```

Expected full downstream conformance evidence:

```text
branch: agent/oi-017-exchange-authority-conformance
evidence head: ad6de826a0b7f14d719bb24925b15b648a2b1fad
PR: #55 — closed without merge, evidence-only
run: #141 / Actions 32022942197 — SUCCESS/SUCCESS
```

Expected Phase-3 provider proof:

```text
proof: oi-exchange-authority-phase3/v1
cases: 24
private_audit_tables:
  exchange_request
  exchange_grant
  exchange_use
contact_is_exchange: false
admission_is_exchange: false
exchange_is_execution: false
a2a_return_state: quarantined
mcp_tool_invocation_authority: false
```

Expected source-faithful downstream A2A proof:

```text
proof: oi-a2a-sharedfield-live/v3-exchange-authority
fresh authority required on endpoint/binding revision replacement
returned difference passes through generic Phase-2 quarantine/Admission
transport_did_not_create_actuation_or_run: true
```

Expected Watch/notification proof remained green:

```text
proof: oi-watch-availability-notification-live/v1
central_action: personal.notify
human_acknowledgement_recorded: false
intruder_watch_visibility: 0
revocation_stopped_delivery: true
rebuild_deduplicated: true
endpoint_churn_preserved_identity: true
```

Re-verify all of this from GitHub before relying on it.

---

# 2. SECURITY LAWS THAT PHASE 4 MUST PRESERVE

The completed phases established a sequence of **non-promoting gates**.

Never collapse these distinctions:

```text
visible ≠ contactable
contactable ≠ contacted
accepted Contact ≠ Exchange
Exchange ≠ trust
Exchange ≠ execution

received ≠ admitted
Contribution ≠ canonical
Admission ≠ execution
index eligibility ≠ trust
renderable ≠ executable

Participant ≠ runtime identity
Agent ≠ endpoint
Agent Card ≠ identity authority
semantic Ref possession ≠ capability authority

Action discoverable ≠ Action invocable
MCP tool discoverable ≠ MCP tool-call authorised
package/component visible ≠ package/component activated
package admitted ≠ package executable
hosted rich content ≠ privileged browser/native code
Workcell reachable ≠ Workcell allocated
Actuation result ≠ ambient authority
Factory Run ≠ arbitrary host authority
```

And above all:

> **Composition transfers reference and possibility, not ambient trust or authority.**

Phase 4 must extend this law into the actual process/tool/package/native-host execution boundary.

---

# 3. PHASE-4 DESTINATION

Implement a real containment path in which untrusted or merely admitted material remains inert until a **separate explicit execution/capability decision** grants only the required power.

The target shape is conceptually:

```text
received / admitted / exchanged material
        ↓
inspectable / renderable DATA
        ↓
requests an Action / tool / component / package / executable effect
        ↓
EXECUTION DEMAND
        ↓
resolve explicit authority + capability + policy
        ↓
DENY
  → zero privileged effect

or

ALLOW
  → finite scoped execution grant
        ↓
real privileged boundary
  browser / native host / MCP tool / Action / package runtime / Workcell
        ↓
provider-enforced resource + side-effect limits
        ↓
attributable execution result / evidence
        ↓
revocation / completion / expiry / exhaustion
```

A model deciding conversationally to follow malicious text is **not** allowed to manufacture the capability needed to make the effect real.

---

# 4. OWNERSHIP: DO NOT BUILD A UNIVERSAL O:I EXECUTION SYSTEM

Before implementation, produce and then honor a concrete ownership map from the live code.

Expected constitutional boundary to verify/refine:

```text
O:I
  Encounter / Projection / Participant / SharedField / Contact / Admission / Exchange semantics
  package/presentation composition boundary
  semantic request/grant provenance where O:I owns the interaction

AIKit
  effective Capability / Action / Component / tool resolution
  trust and context disclosure to agents
  harness/model/session capability projection

Actuation
  Agency / Root Agency / Determination / delegated action authority
  execution intent and authoritative Return semantics

Factory
  developmental Runs/Candidates/evidence
  must not turn an observed remote result into arbitrary authority

Workcell
  material execution-provider selection
  process/runtime/network/filesystem/resource isolation and bindings

Central
  human-authored personal policy/preferences and personal Actions where relevant
  secret ownership where already established

native desktop host / browser / OS
  actual privileged bridge, process, credential-store, origin and sandbox enforcement
```

If a responsibility belongs in another product, implement the minimum cross-product contract there rather than hiding a duplicate O:I authority database behind an adapter.

---

# 5. FIRST EXECUTABLE AUTHORITY MODEL

Do **not** equate the Phase-3 `exchange_grant` with an execution grant.

Introduce or converge on the narrowest existing product-native authority primitive that can express an execution/capability decision.

The execution decision must be attributable and must bind, as applicable:

```text
request / operation id
initiating runtime identity
Agent / Agency / Participant / Project / Run lineage as appropriate
containing field/world/project
requested Action/tool/component/package/executable ref
exact version / revision / digest where executable material is versioned
provider / harness / host / Workcell target
purpose
allowed operation/method
input schema / bounded arguments
filesystem scope
network / egress scope
credential / secret refs
process/subprocess permission
CPU / memory / wall-time / output bounds where provider supports them
use count / one-shot semantics
server/authority time
issuer / authority basis
decision / provenance / evidence
revocation / completion / expiry / exhaustion
```

Not every field belongs in one global schema. The requirement is that the **effective grant at the privileged boundary** is sufficiently exact to prevent authority widening and confused-deputy reuse.

Use existing AIKit/Actuation/Workcell types if they already own these distinctions.

---

# 6. REQUIRED CONTAINMENT SURFACES

Phase 4 must implement the highest-value coherent vertical slice across the actual current product seams. It must not stop at interface sketches.

At minimum, cover the following categories where they are live in the suite.

## 6A — Action / MCP tool invocation

Prove:

```text
Action discoverable
or MCP tool listed in metadata
≠
invocation authority
```

A hostile Contribution, Wiki page, A2A Artifact, Agent Card or tool description may request/instruct a tool call, but cannot create the capability needed to execute it.

The invocation gate must exist at the actual privileged dispatcher/tool client, not only in the LLM prompt or UI.

Deny before side effect.

For MCP specifically:

- re-verify the **current** MCP specification from primary sources;
- distinguish server/tool discovery, schema metadata, transport authentication and actual invocation authority;
- do not treat tool metadata as trusted instructions;
- bind authority to exact server/tool identity and relevant version/connection lineage where practical;
- prove an Exchange grant from Phase 3 cannot be replayed as a `tool:call` grant.

## 6B — Package / component activation

Consume the actual current O:I package/extension envelope and native contribution host rather than creating another package ontology.

Prove:

```text
package present / received / admitted / signed
≠
package activated
≠
package privileged
```

Where executable package/component material exists, bind activation/execution to exact revision/digest and explicit requested capabilities.

A package update/substitution must not silently inherit authority intended for an earlier artifact.

If provenance/signing is materially used, verify current primary sources for the selected mechanism. A signature proves the signed statement/artifact relation; it does not make the package semantically trustworthy or grant capabilities.

## 6C — Native / Wasm / process execution

Use the actual current Workcell/native-host provider seam.

Research and provider-test the live mechanisms actually chosen, potentially including current:

- Wasmtime / WASI Component Model capability boundaries;
- separate-process native plugin execution;
- Linux user/mount/network namespaces;
- seccomp/AppArmor;
- bubblewrap/nsjail or equivalent;
- gVisor / Firecracker / MicroVM provider paths where the Workcell already supports or selects them.

Do not make one sandbox vendor constitutional unless the live architecture genuinely requires it.

The invariant is provider-neutral:

```text
Execution Demand
      ↓
explicit effective capabilities
      ↓
Workcell / host provider binding
      ↓
material isolated execution world
```

## 6D — Rich content / browser/native bridge

Where O:I can render remote HTML/SVG/rich component material, prove:

```text
renderable ≠ executable ≠ native-bridge-authorised
```

Re-verify and use current browser/platform mechanisms actually appropriate to the live UI, such as:

- origin/sandboxed iframe separation;
- Content Security Policy;
- Trusted Types where applicable;
- maintained HTML sanitisation such as DOMPurify where actual HTML is accepted;
- strict MIME/content handling;
- explicit SVG/script treatment;
- archive/decompression/file-size bounds where files are accepted.

A hostile rendering fixture must not gain filesystem, network, secret or privileged Rust/native bridge access merely because the user can inspect it.

---

# 7. PROMPT-INJECTION / CONFUSED-DEPUTY REQUIREMENT

Phase 4 must include an adversarial untrusted-context fixture.

At minimum:

```text
hostile Contribution / Wiki / A2A return / package metadata contains instructions:
  "read secret X"
  "invoke privileged Action Y"
  "call MCP tool Z"
  "install/execute package Q"
  "exfiltrate file/network data"
        ↓
agent/model may parse or even conversationally repeat the instruction
        ↓
actual privileged boundary receives no valid execution grant
        ↓
ZERO privileged side effect
```

Do not claim prompt text alone can provide this guarantee.

If current research on instruction/data separation, capability gating, information-flow or taint approaches materially informs the implementation, verify the current primary paper/spec and use it as an additional control, not as a replacement for the hard capability boundary.

---

# 8. REQUIRED RESOURCE / SIDE-EFFECT BOUNDS

For every executable provider materially exercised, make the denied/allowed effect surface explicit.

Prove or fail closed for relevant axes:

```text
network / egress destination
filesystem read roots
filesystem write roots
secret / credential refs
environment variables
subprocess creation
host/native bridge methods
package installation / dynamic loading
CPU / wall time
memory
output / artifact size
open-file / process count where available
persistent state access
service bindings
Workcell/project runtime connectivity
```

A grant for one capability must not silently imply another.

Examples:

```text
filesystem-read grant ≠ filesystem-write grant
network-to-A grant ≠ arbitrary internet egress
MCP tool X ≠ MCP tool Y
Action X(args schema A) ≠ arbitrary Action dispatcher access
package revision 1 ≠ package revision 2
one Workcell binding ≠ another Workcell
read secret ref A ≠ enumerate credential store
```

---

# 9. REVOCATION / REPLAY / LIFECYCLE

Execution authority must be finite and attributable.

At minimum prove:

- exact operation retry is idempotent where the operation is retry-safe;
- conflicting replay fails;
- one-shot authority cannot be reused;
- N-use authority exhausts;
- server/authority-time expiry fails closed;
- explicit revocation fails closed;
- package/binary revision substitution fails;
- tool/server connection replacement does not silently inherit authority;
- Workcell/environment replacement does not silently inherit authority;
- reconnect/restart does not resurrect expired/revoked/exhausted grants;
- completion closes the authority where completion semantics exist.

Do not use client clock as the authority source where a server/provider authority clock is available.

---

# 10. PRIVATE AUDIT / PRIVACY

Record enough private execution evidence to answer:

```text
who/what requested the effect?
what exact capability was requested?
what authority allowed or denied it?
which artifact/tool/package revision was involved?
where did it execute?
what bounded side effects were permitted?
what happened?
when did authority end?
```

Do not turn this into a public behavioural/social graph or store unrelated secrets/arguments indefinitely.

Preserve the #31 audit/privacy requirement: inspectability with explicit retention/access boundaries.

---

# 11. MANDATORY ADVERSARIAL CORPUS

Extend the existing executable security corpus rather than replacing it.

The Phase-4 suite must include positive and negative tests for the actual chosen execution surfaces and prove at least the following classes where applicable:

1. hostile retrieved/admitted Contribution requests an ungranted Action → **zero Action side effect**;
2. Phase-3 Exchange grant replayed as execution/tool authority → denied;
3. MCP tool discovered but not granted → zero tool call;
4. MCP tool A grant used for tool B → denied;
5. tool/server endpoint or connection revision replacement → old grant denied;
6. package present/admitted but no activation grant → no code execution;
7. package revision/digest substitution after approval → denied;
8. package asks for undeclared filesystem/network/secret capability → denied;
9. malicious HTML/SVG/rich content renders/inspects without privileged script/native bridge execution;
10. denied native/Wasm/process execution cannot reach privileged filesystem path;
11. denied execution cannot reach unrelated network destination;
12. denied execution cannot read unrelated secret/credential;
13. allowed narrow execution can perform **only** the declared operation;
14. subprocess/escalation attempt outside grant → denied;
15. one-shot/N-use exhaustion → denied after budget;
16. expiry/revocation → denied at real execution boundary;
17. replay/conflicting operation id → idempotent or denied as specified;
18. reconnect/restart/rebuild does not resurrect authority;
19. execution result remains attributable evidence and does not rewrite authorship/Admission/Exchange history;
20. execution does not auto-canonicalise or auto-propagate unrelated material.

Add provider-specific attacks required by the chosen sandbox/runtime.

Do not merely mock the privileged function if a real provider/host acceptance path exists.

---

# 12. PROVIDER / PRIMARY-SOURCE CONFORMANCE

For each external mechanism materially used in Phase 4:

1. identify the actual current version/specification from a primary source;
2. record the exact security property used;
3. record what that mechanism **does not** guarantee;
4. pin versions/revisions where reproducibility requires it;
5. exercise the real provider/host path in CI or a reproducible acceptance fixture;
6. preserve provider replaceability beneath the O:I/AIKit/Actuation/Workcell semantic boundary.

Do not rely on stale ticket prose for current provider behavior.

---

# 13. REQUIRED DOWNSTREAM CONVERGENCE

After the canonical Phase-4 implementation is green, build a **fresh evidence-only stack** over the current relevant downstream lines.

At minimum re-prove that Phase 4 does not regress:

```text
Phase 1 caller-scoped private content
Phase 2 quarantine / Admission / independent indexing
Phase 3 explicit bounded Exchange authority
source-faithful A2A endpoint replacement/withdrawal
Watch → availability → Encounter → Central notification
```

Then exercise the real execution/container seam selected for Phase 4.

As in Phases 1–3:

- evidence-only convergence is not a production implementation shortcut;
- close evidence PRs without merge after proof unless live repo topology specifically requires another safe integration path;
- record exact heads/checks/provider receipts.

---

# 14. REQUIRED DOCUMENTATION / RECEIPT

Before stopping, commit a durable Phase-4 receipt such as:

```text
shared-field/PHASE4-EXECUTION-CONTAINMENT-SECURITY-RECEIPT.md
```

It must record:

- exact Phase-3 base;
- canonical Phase-4 branch/PR/head;
- all cross-product branches/PRs genuinely changed;
- exact provider/runtime versions and primary-source rationale;
- execution authority/grant shape;
- actual privileged enforcement points;
- real sandbox/Workcell/native-host topology;
- resource/network/filesystem/secret bounds;
- package/tool/version/digest binding law;
- adversarial corpus and case count;
- exact CI/provider/host commands and results;
- downstream full-stack conformance evidence;
- changed files;
- remaining limitations;
- which #31 acceptance items are now genuinely closed and which remain open.

Post the exact Phase-4 receipt to #43 and a corresponding progress receipt to #31.

Keep #31 open unless its **entire** wider acceptance is proven complete.

If Phase 4 completes #43's own four-phase acceptance, #43 may be closed only after exact receipt/check verification. Do not infer that this automatically closes #31.

---

# 15. PHASE-4 COMPLETION OUTPUT — FRESH SESSION ONLY

At the end of successful Phase 4, create and commit a **fresh-session prompt for the remaining #31 closure frontier / final closure-verification session**.

That prompt must contain:

```text
repository + parent tickets
exact Phase-4 implementation branch/PR/head
exact CI/provider/host receipts
all Phase 1–4 security invariants now proven
all permanent attack fixtures
provider-conformance caveats
cross-product ownership decisions
remaining #31 acceptance items, if any
parallel PRs/branches to recheck
explicit instruction to verify every SHA/status/provider claim live
```

Then STOP.

Do not use remaining context to begin another security phase or broad #31 closure programme.

---

# 16. NON-GOALS

Do not:

- redesign O:I identity, Participant, Contact, Contribution, Admission or Exchange ontology;
- create a global trust/reputation score;
- make accepted Contact imply execution;
- make Exchange imply execution;
- make Admission imply execution;
- make an Agent Card/tool/package manifest an authority source;
- give arbitrary package JavaScript ambient desktop/session authority;
- equate model instruction-following with authorisation;
- build a universal policy engine merely because several products participate;
- hard-code Docker/MicroVM/Wasmtime/etc. into the constitutional product ontology;
- collect broad private social/execution graphs into public Explore;
- silently broaden Central or Root Agency privileges;
- rebuild A2A, AIKit, Actuation, Factory or Workcell from scratch;
- close #31 without proving its wider acceptance.

---

# 17. START

Begin by verifying live state and reading the Phase-3 receipt in full.

Then inspect the real current package/native-host/AIKit/Actuation/Workcell execution seams, choose the narrowest vertical slice that can prove the actual authority boundary end to end, implement it, provider-test it adversarially, publish the Phase-4 receipt and final #31 fresh-session handoff, and STOP.
