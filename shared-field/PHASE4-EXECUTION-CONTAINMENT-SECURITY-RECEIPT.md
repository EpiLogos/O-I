# Phase 4 — Execution Containment Security Receipt

**Programme:** O:I #31 Encounter Security  
**Protocol ticket:** O:I #43  
**Phase:** 4 — machine/delegated execution containment  
**Base:** exact Phase-3 receipt head `56d9ca4d785372bf60dbf3be6179bad348b84110`  
**Canonical Phase-4 PR:** O:I #60 — `agent/oi-017-execution-containment`  
**Status:** Phase-4 implementation and fresh convergence evidence complete; final receipt-bearing head validation follows this receipt commit.

## 1. Constitutional result

Phase 4 establishes one rule across the live suite:

> **Visibility, Contact, Admission, Exchange, renderability, package presence, provider reachability, Workcell allocation and Factory/SessionSpace existence do not confer execution authority.**

A privileged effect is permitted only where the native owner/runtime reaches the actual side-effect boundary with a separately resolved, exact and finite authority/capability that still matches the current actor, target, purpose and binding revision.

O:I does **not** become a universal dispatcher, execution authority database, Action owner, Agency owner, Workcell owner, package runtime, MCP server or capability owner. The canonical O:I Phase-4 module is a conformance oracle used by the permanent adversarial corpus. Real enforcement lives at native privileged seams.

This is consistent with the suite's governing Workcell boundary: AIKit/Factory determine semantic availability/authority; Workcell materialises an executable world and must not silently promote material reachability into semantic authority.

## 2. Exact implementation lines

### O:I native/Tauri host — PR #58

Branch: `agent/oi-017-native-execution-containment`  
Base: current native desktop host PR #34 / `760aadc01cc3b603826d624e68c54eb1ac7cc547`  
Implementation head: `c621a4475625ab7eb0f73e842501df7e25bc8279`

Provider proof:

- O:I Verify run **#297 / 32025144712** — SUCCESS.
- O:I desktop run **#174 / 32025144761** — SUCCESS.

Enforcement:

- `ActionAuthorityStore` consumes already-issued `oi.bounded-action-grant/v1` authority rather than minting it.
- The grant is bound to exact Action, subject, native owner, required Capability, current binding revision, validity window and use budget.
- The webview can submit only an opaque authority reference and operation id at `dispatch_factory_action`; it cannot submit trusted authority facts.
- Authority is consumed before `FactoryActionExecutor` is reached.
- absent, revoked, expired, exhausted, replayed, subject-substituted, capability-widened and revision-substituted calls fail before the Factory mutation.
- optional native handoff uses `OI_ACTION_AUTHORITY_FILE`; the file is read and deleted before the webview starts, so restart cannot silently resurrect the same materialised grants.
- the root Tauri capability remains `core:default`; no filesystem, shell, process, network or secret plugin capability is granted to the webview.
- an explicit restrictive CSP is now configured (`script-src 'self'`, `object-src 'none'`, `frame-src 'none'`, `base-uri 'none'`, IPC-only `connect-src`).
- declarative contribution UI tests reject `dangerouslySetInnerHTML`, `iframe`, `srcDoc` and `eval` execution surfaces.
- `BridgeCaller::SandboxedContribution` remains denied every native bridge call.

### AIKit live target-process activation — EpiLogos/ai-kit PR #72

Branch: `agent/oi-017-execution-authority-containment`  
Base: current green SessionSpace/Composition line `e85755f1aea80e8d669da0e06b1ca76c0e94a656` / PR #68  
Implementation head: `d7f892a3db670e064104a255df5cb5b55227935d`

Provider proof:

- AIKit CI run **#449 / 32025487060** — SUCCESS.

Enforcement at the real provider seam:

- SessionSpace admission, `LiveMounted` eligibility, Surface visibility and provider reachability do not start the target process.
- `CordisProcessActivationDriver` requires a separately registered finite `CordisActivationGrant` immediately before real `Command::spawn` and before final process teardown.
- grants bind operation (activate/deactivate), SessionSpace, AgentSession, Harness, Component, canonical composition fingerprint, pinned DeepSeek Harness implementation revision, expiry and use budget.
- missing, revoked, expired, exhausted, stale/recomposed and revision-substituted authority fails before process side effects.
- grant consumption happens before process start/stop; failed execution cannot restore the consumed authority and create an amplification loop.
- successful provider observations carry the external authority provenance.
- the deterministic live-process test first proves no-authority denial with no process running, then proves one exact activation, denies replay, and requires a different exact grant for teardown.
- the opt-in source-real DeepSeek/Cordis test uses the same exact authority discipline at pinned target revision `DEEPSEEK_HARNESS_UPSTREAM_REVISION`.

### Workcell real host-process materialisation — EpiLogos/Workcell PR #32

Branch: `agent/oi-017-execution-material-containment`  
Base: current model-serving/materialisation line `3406ebe72a88cc7e6734f514543d5842201037c0` / PR #31  
Implementation head: `6762d1897328b4c43d28bc066d71fafa65767155`

Provider proof:

- Workcell verify run **#536 / 32025883769** — SUCCESS.

Enforcement at the actual material effect:

- `ProviderAllocation` and host-process offers are explicitly not execution authority.
- `HostProcessExecutionProvider::execute_operation` denies before `std::process::Command` unless the trusted control plane has registered a finite `HostProcessOperationGrant`.
- the grant binds external authority provenance, exact material allocation, operation key, executable, ordered arguments, working directory, expiry and use budget.
- each execution requires an operation id; replay/conflicting replay is denied.
- the material grant is consumed before `Command`, so spawn/exec failure does not restore authority.
- release revokes all material grants bound to the allocation.
- a real Unix `/bin/sh` test proves: allocation with no authority -> denial; exact one-shot material authority -> process executes; replay -> denial.

The host-process provider deliberately **does not counterfeit untrusted isolation**. It refuses generic connectivity demands and any isolation requirement stronger than `host-process`, advertises `untrusted_isolation=unsupported-use-isolated-provider`, and therefore cannot be selected as though it supplied CPU/memory/network isolation it does not actually enforce. No live isolated/MicroVM or Wasm execution provider exists on the inspected O:I/AIKit/Workcell lines in this phase, so none was fabricated. Future untrusted Wasm/native/package execution must enforce the same authority plus real provider resource limits at its own runtime boundary before it can satisfy the corresponding Workcell demand.

### Factory-owned Action execution — existing source of native mutation

Factory PR #146 remains the Action owner at exact head `c39bd63580cb7196f38c9a26b49e3977aac95e6a`.

Its existing `FactoryActionExecutor` already rejects wrong native owner, missing Capability grant, wrong Capability identity and missing Action authority before canonical Factory state mutation. Exact-head Factory Rust run **#148 / 31982029376** is SUCCESS (with the associated Build UI and QL experiment lanes also green).

Phase 4 does not duplicate this executor. O:I #58 now prevents webview-supplied authority facts from reaching it and consumes bounded external authority before dispatch.

### Actuation authority lineage — existing authority vocabulary

Actuation PR #6 remains the portable root-agency/authority line at `b977939ec25c32b3dc8f5ed251b70e4c26933086`; Agency contract run **#3 / 31976861145** is SUCCESS.

Its explicit `MetagencyGrant`/`Determination` boundary remains authority vocabulary above technical body/materialisation. Phase 4 introduces no hidden RootAgent/manager privilege and does not turn Workcell or O:I into an Agency authority source.

## 3. MCP and package conformance

### Current MCP source line

The current official MCP specification is `2026-07-28`, released 2026-07-28. It moved to a stateless request core, makes requests self-describing, carries `Mcp-Method` / `Mcp-Name` for routable/authorisable requests, and includes authorization hardening. Official source:

- https://blog.modelcontextprotocol.io/posts/2026-07-28/
- https://modelcontextprotocol.io/specification/draft/server/tools

The protocol itself distinguishes discovery/listing from `tools/call`, and the official tools guidance treats tool annotations as untrusted unless the server is trusted and expects explicit host/user control around invocation.

The currently inspected O:I/AIKit/Workcell implementation lines do **not** contain a dedicated live MCP tool-call dispatcher. Phase 4 therefore does not fabricate one. The permanent corpus proves the required law at the suite boundary:

- MCP tool listed != MCP tool callable;
- Phase-3 MCP data Exchange != `tool:call` authority;
- server/binding replacement invalidates old execution authority;
- a future live MCP dispatcher must consume a fresh exact execution grant immediately before `tools/call` / transport I/O.

### O:I package floor

O:I package PR #28 remains an envelope/registration floor at exact head `31bce75863966c698b617b6ae5a28437f5b57068`. It carries package version, source revision, declared permissions/effects, native target contract and verification operations; O:I records lifecycle receipts only from target-native outcomes.

It is deliberately non-activating. Therefore:

- package present != active;
- package signed != active;
- package admitted/registered != execution authority;
- package/source revision replacement must invalidate old activation authority.

Where a package contribution resolves to the currently live AIKit Cordis Component/process path, PR #72 supplies the actual version/fingerprint-bound privileged activation boundary.

## 4. Rich-content and native bridge containment

The inspected O:I desktop Surface is currently declarative React data, not a remote-content plugin browser or iframe runtime. The phase therefore hardens the **real** boundary instead of inventing an imaginary rich-content subsystem:

- contribution text does not become HTML/JS execution;
- no iframe/srcDoc/eval/raw-HTML rendering path is present in the tested UI;
- CSP forbids frames/objects and restricts scripts/connectivity;
- Tauri frontend permissions remain minimal;
- all sandboxed-contribution bridge calls are denied;
- Action execution uses an opaque authority handle and exact native-side revalidation before dispatch.

Tauri 2's documented trust model treats Rust/core and WebView as different trust groups, with capabilities/runtime authority controlling frontend command exposure and CSP reducing web-content attack surface. Source references:

- https://v2.tauri.app/security/runtime-authority/
- https://v2.tauri.app/security/csp/
- https://v2.tauri.app/reference/acl/core-permissions/

## 5. Permanent adversarial corpus

Canonical files:

- `shared-field/execution-containment.mjs`
- `shared-field/execution-containment.test.mjs`

Canonical implementation validation at Phase-4 code head `e7f72917f83943765cb628445f7f1db5395832bb`:

- Shared field run **#148 / 32025637367** — SUCCESS.

The corpus carries **35 independent deny classes** and 5 narrowly authorised positive cases. It includes:

1. Action discovery without grant;
2. MCP tool listing without grant;
3. Contact-as-execution confusion;
4. Exchange-as-execution confusion;
5. MCP data Exchange widened to tool call;
6. Admission-as-execution confusion;
7. package presence-as-activation;
8. package signature-as-activation;
9. package Admission/registration-as-activation;
10. renderable hostile rich content attempting native bridge escalation;
11. explicit prompt-injection payload asking for secret read/tool invocation/package activation/exfiltration;
12. Workcell allocation-as-process-authority;
13. Factory Run-as-host-authority;
14. `LiveMounted`-as-process-authority;
15. connected/available provider-as-execution-authority;
16. actor substitution;
17. target-kind substitution;
18. exact target substitution;
19. binding-revision replacement;
20. purpose widening;
21. network-effect widening;
22. filesystem-read widening;
23. filesystem-write widening;
24. secret-access widening;
25. subprocess widening;
26. native-bridge widening;
27. dynamic-load widening;
28. expired grant;
29. revoked grant;
30. exhausted grant;
31. not-yet-valid grant;
32. MCP server/binding replacement;
33. package artifact/digest replacement;
34. Exchange envelope masquerading as execution authority;
35. signature receipt masquerading as execution authority.

Positive cases prove the inverse boundary only when exact authority matches: bounded Factory Action, bounded MCP tool shape, exact version-bound package Component activation shape, exact Workcell process material capability, and explicit native-bridge method capability.

## 6. Fresh full-stack convergence

Evidence-only PR #62 / `agent/oi-017-execution-containment-conformance` was created fresh from the prior Phase-3 convergence evidence head `ad6de826a0b7f14d719bb24925b15b648a2b1fad` and adds only the Phase-4 oracle/corpus.

Evidence head: `c7d828fe28d483303896098563d418698edb19ee`.

Shared field run **#151 / 32026012799** — SUCCESS in both lanes:

- `test` — SUCCESS;
- `spacetimedb-live` — SUCCESS.

The live lane re-proves, in one fresh evidence stack:

- Phase 1 server-enforced private/audience content;
- Phase 2 generic ingress -> quarantine -> Admission -> index eligibility;
- Phase 3 Exchange authority;
- source-faithful A2A exchange with fresh authority after binding replacement;
- returned A2A material -> generic quarantine -> separate Admission;
- canonical Exchange grant consumption before A2A network I/O;
- Watch -> availability -> Encounter -> explicit Central `personal.notify`;
- plus the Phase-4 execution non-promotion/adversarial corpus in the shared-field test lane.

The evidence PR is evidence-only and must be closed without merge after this receipt is recorded.

## 7. Authority composition laws now executable

The full security chain is now executable rather than documentary:

```text
Visible != Contact
Contact != Admission
Admission != Exchange
Exchange != Execution
Action discovery != invocation
MCP tools/list != tools/call
Package present/signed/registered != activation
Workcell allocation != process authority
SessionSpace LiveMounted != provider-process authority
Renderable content != native bridge authority
```

And composition is explicit:

```text
semantic Action/Agency authority
        + exact current native binding
        + exact Capability grant where required
        + material/runtime capability
        + provider-enforced effects/isolation actually offered
        -> one bounded privileged effect
```

No member of that equation can silently substitute for another.

## 8. Deliberate non-claims

Phase 4 does **not** claim:

- that O:I is an execution authority owner;
- that a generic MCP tool dispatcher exists where none is implemented;
- that a Wasm runtime exists where none is implemented;
- that host processes provide strong untrusted isolation, CPU/memory quotas or controlled network egress they do not actually provide;
- that package signatures are execution capability;
- that rich content has arbitrary bridge access;
- that Factory Runs grant host privilege;
- that completion of #43 alone completes every remaining acceptance item in #31.

These non-claims are part of the containment proof: unsupported powers fail closed instead of being inferred from adjacent concepts.

## 9. Phase disposition

Subject to the final receipt-bearing exact-head workflow succeeding after this receipt and the fresh-session handoff are committed:

- Phase 4 is complete.
- The four-phase #43 protocol is eligible for closure on its own acceptance criteria.
- #31 remains open for the explicit final Encounter-Security closure/ratification frontier.
- No Phase 5 is started here.
