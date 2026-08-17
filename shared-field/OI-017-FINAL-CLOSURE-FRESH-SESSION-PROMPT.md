# Fresh Session Prompt — O:I #31 Final Encounter-Security Closure Frontier

Work directly in GitHub across the actual current live state of:

- `https://github.com/EpiLogos/O-I`
- `https://github.com/EpiLogos/ai-kit`
- `https://github.com/EpiLogos/Actuation`
- `https://github.com/EpiLogos/Workcell`
- `https://github.com/EpiLogos/agent-system-design`
- `https://github.com/EpiLogos/Central` where the live notification/policy boundary requires it

## Primary ticket

O:I #31 — **[OI-017] Research and implement encounter security for shared and composable O:I spaces**

## Completed security protocol

O:I #43 has completed its four fresh implementation phases:

1. server-enforced private / audience-scoped hosted content;
2. ingress -> quarantine -> Admission -> index eligibility;
3. finite Exchange authority before network I/O;
4. machine/delegated execution containment before privileged effects.

**Do not restart those phases.**

Read first:

- `shared-field/PHASE3-EXCHANGE-AUTHORITY-SECURITY-RECEIPT.md`
- `shared-field/PHASE4-EXECUTION-CONTAINMENT-SECURITY-RECEIPT.md`
- #31 current body and every completion receipt/comment;
- #43 final Phase-4 receipt/comment;
- the actual current heads/CI of every PR referenced by those receipts.

Phase-4 implementation coordinates at the time of handoff:

- canonical O:I Phase-4 PR #60, branch `agent/oi-017-execution-containment`, originally stacked on exact Phase-3 receipt head `56d9ca4d785372bf60dbf3be6179bad348b84110`;
- O:I native host PR #58, implementation head `c621a4475625ab7eb0f73e842501df7e25bc8279`, green OI Verify #297 / 32025144712 and O:I desktop #174 / 32025144761;
- AIKit execution-containment PR #72, implementation head `d7f892a3db670e064104a255df5cb5b55227935d`, green CI #449 / 32025487060;
- Workcell execution-material containment PR #32, implementation head `6762d1897328b4c43d28bc066d71fafa65767155`, green verify #536 / 32025883769;
- Factory Action owner PR #146 at `c39bd63580cb7196f38c9a26b49e3977aac95e6a`, Factory Rust #148 / 31982029376 green;
- Actuation authority line PR #6 at `b977939ec25c32b3dc8f5ed251b70e4c26933086`, Agency contract #3 / 31976861145 green;
- fresh full-stack Phase-4 evidence PR #62 at evidence head `c7d828fe28d483303896098563d418698edb19ee`, Shared field #151 / 32026012799 green in both `test` and `spacetimedb-live`, and deliberately closed without merge after receipt.

**These coordinates are receipts, not permission to trust stale state. Re-inspect current heads, branches, PR state, issue comments and workflow conclusions before acting. Other agents may have moved the suite.**

---

# This session is not Phase 5

There is no new security phase to invent.

This is a **closure / ratification / residual-gap implementation session for #31 only**.

The destination is:

```text
#31 acceptance body
        ↓
current live implementation + receipts
        ↓
exact acceptance matrix
        ↓
prove what is already satisfied
        ↓
implement only real residual gaps
        ↓
fresh complete attack/conformance evidence
        ↓
close #31 only if every acceptance condition is actually evidenced
```

Do not turn this into another ontology exercise, another universal policy engine, another sandbox abstraction, or a rewrite of the four completed #43 phases.

---

# 1. Start from actual live state

Before choosing any base:

1. inspect current open/draft/merged/closed PRs in all six repos;
2. inspect current #31 and #43 comments;
3. inspect the exact current heads and CI of Phase-1/2/3/4 lines;
4. inspect all parallel security work that #31 may now consume, especially authentication/secret-materialisation work such as O:I #56 and its current native successors;
5. inspect current package/provenance/signing, content/file handling, audit, rate/resource, Contact, Watch, A2A and search/index work;
6. do not edit a live parallel implementation branch owned by another agent unless convergence genuinely requires it.

Do not trust historical SHA/status/provider-version claims in this prompt without revalidation.

---

# 2. Build the #31 acceptance matrix before coding

Take every required end-to-end attack fixture and every acceptance bullet in #31 and map it to:

```text
requirement
→ owning product
→ exact implementation file/function/table
→ exact adversarial fixture
→ exact PR/head
→ exact CI/provider receipt
→ status: proven / partially proven / genuinely missing
```

At minimum account for all twelve #31 attack fixtures:

1. cross-field unauthorised SpaceTimeDB mutation denied server-side;
2. private contact/watch relation absent from public Explore/index/subscription;
3. high-rate unsolicited Contact bounded without identity/provenance mutation;
4. hostile HTML/SVG/embedded script stored/encountered without execution authority;
5. hostile package/component cannot access bridge/filesystem/network/secret without explicit grant;
6. tampered signed/attested package or Projection revision fails verification where signing is required;
7. malicious retrieved Contribution cannot cause ungranted Action/secret disclosure;
8. untrusted A2A endpoint/Agent Card cannot overwrite canonical identity;
9. returned A2A material remains unadmitted until separate transition;
10. blocked/revoked relation remains blocked after reconnect/restart;
11. public index rebuild excludes quarantined/private/withdrawn material according to policy;
12. audit explains representative allowed/denied paths without exposing unrelated private relationship data.

Do not infer that a neighbouring test proves a requirement. Use the actual implementation and actual executable evidence.

---

# 3. Consume completed #43 proofs instead of recreating them

The closure session should treat these as already implemented unless live state disproves them:

```text
Visible != Contact
Contact != Admission
Admission != Exchange
Exchange != Execution
```

and:

```text
Action discovery != invocation
MCP tools/list != tools/call
Package present/signed/registered != activation
Workcell allocation != process authority
SessionSpace LiveMounted != provider-process authority
Renderable content != native bridge authority
```

The fresh Phase-4 full-stack evidence proved Phases 1–3, A2A replacement/quarantine, Watch→availability→Encounter→Central notification, and the Phase-4 execution corpus together.

Do not weaken those boundaries while closing later acceptance gaps.

---

# 4. Resolve only actual remaining #31 gaps

Likely closure-frontier areas must be **re-inspected**, not assumed missing:

## Authentication / secret materialisation

Consume the current O:I #56 programme and current AIKit/Workcell/Actuation/Central implementation state. #31 requires real distinction among human/device/Agent/workload identity and safe secret materialisation. Do not duplicate #56 or take over its live branch.

## Executable provenance / package attestation

O:I package v1 already preserves package/source revision and native target verification and is deliberately non-activating. #31 additionally requires at least one strong provenance/attestation path for executable package/component material and a tamper/substitution fixture where signing/attestation is required.

Inspect current package/provenance successors before adding anything. A signature must remain a statement about a particular artifact/revision, never semantic trust or execution authority.

## Hostile file/rich-content handling

Phase 4 proves the current O:I declarative React/Tauri surface cannot convert hostile contribution text into JS/native authority and carries a restrictive CSP. #31 also names HTML/SVG/file storage/inspection and MIME/parser/decompression concerns.

If no file/rich-content ingestion runtime is live, record that accurately and do not invent ClamAV/YARA/DOMPurify theatre. If a live ingestion/rendering path exists by this session, attack it at that actual boundary.

## Audit/privacy/retention

Phase-1/2/3 SpaceTimeDB and native runtime provenance provide security evidence, but #31 requires an inspectable representative allowed/denied path with explicit retention/redaction/access policy and no unrelated private social graph disclosure.

Implement or consolidate the smallest native audit surface required by the actual substrates. Do not centralise private relationship history merely to make auditing easy.

## Rate/resource pressure

Contact and hosted-state phases already carry bounded semantics. Reprove the actual high-rate Contact/Contribution limits and current Workcell resource/isolation truth. Never claim CPU/memory/network isolation from the trusted host-process provider: Phase 4 explicitly makes it reject stronger isolation demands.

## Source-locked research record

Bring `docs/ENCOUNTER-SECURITY.md` and its source/version rationale into exact agreement with what is actually adopted, adapted, rejected or deferred. Current-provider/source assertions must come from primary sources and executable provider evidence where applicable.

This is a closure document, not a vendor catalogue. Do not make OpenFGA/SpiceDB/Cedar/OPA/Biscuit/Sigstore/TUF/Wasmtime/etc. constitutional merely because #31 asked that they be researched.

---

# 5. Re-run a fresh closure evidence stack

Do not close #31 from a pile of historical green badges.

Create a fresh evidence-only convergence line that consumes the current final implementation heads and re-proves the complete representative security path.

At minimum it must include/re-reference executable evidence for:

```text
private audience enforcement
Contact refusal/block/rate boundary
quarantine + Admission + index eligibility
Exchange authority before network
A2A identity/binding replacement + return quarantine
Watch privacy + explicit Central notification
hostile retrieved/prompt-injection data cannot create Action/tool authority
package/component revision/attestation substitution fails where required
native/Component/Workcell privileged execution requires exact authority
rich content/file path cannot inherit native authority
index rebuild excludes private/quarantined/withdrawn state
representative private audit allowed + denied path
```

Where evidence lives in other products, use their exact current heads and current CI/provider receipts. Do not copy native semantics into O:I merely to make one workflow green.

Close temporary/evidence-only PRs without merge once their exact receipt is recorded.

---

# 6. Closure discipline

Close #31 **only if**:

- every #31 acceptance bullet is mapped to executable/current evidence or a justified non-live/deferred surface allowed by the ticket's own wording;
- every required attack fixture has a reproducible proof;
- current source/provider versions have been reverified from primary sources;
- native ownership remains intact across O:I/Central/AIKit/Actuation/Factory/Workcell/browser/OS;
- no universal reputation system, hidden Root Agency bypass, ambient package authority, or universal policy/sandbox engine has been introduced;
- fresh final evidence is green on exact heads;
- the final closure receipt names all exact heads/runs and all deliberate non-claims.

If a genuine unmet acceptance item remains, **do not close #31**. Implement the smallest correct residual seam in its native owner, prove it, and only then reassess closure.

Do not reopen #43 unless live evidence shows one of its four completed protocol phases is actually broken.

---

# Final outputs

If #31 closes, commit a durable final receipt such as:

`docs/OI-017-ENCOUNTER-SECURITY-FINAL-RECEIPT.md`

containing:

- exact live ownership matrix;
- acceptance matrix;
- source/provider version ledger;
- exact implementation PR/head/run receipts;
- full attack-fixture result matrix;
- audit/privacy/retention statement;
- deliberate non-claims/deferred non-live surfaces;
- final conclusion explaining why #31 can now close without authority collapse.

Write the exact completion receipt to #31 and the relevant native PRs/issues, close temporary evidence PRs unmerged, and close #31 only after the final receipt-bearing head itself is green.

Then STOP. Do not invent a successor security phase in the same session.
