# O:I #31 — Final Encounter-Security Ratification Receipt

**Status:** final cloud-available security ratification candidate  
**Primary ticket:** O:I #31 — `[OI-017] Research and implement encounter security for shared and composable O:I spaces`  
**Protocol child:** O:I #43 — four completed fresh implementation phases  
**Authentication/material child:** O:I #56  
**Final closure line:** `agent/oi-017-final-security-closure`  
**Closure ancestry:** exact Phase-4 head `5418d1024237f74d2b88a0111754423d90299be4`

This receipt closes the security programme only at the **cloud-available / provider-evidenced boundary**. It does not claim workstation, home-server, private-account, local-provider, Tailscale, live 1Password, live SPIFFE/SPIRE, tmpfs/native-secret-mount, GPU/model-serving or other physical acceptance. Those remain separate native/provider acceptance work and are not reasons to keep the semantic Encounter-Security programme open.

## 1. Ratified security law

The complete implemented boundary is:

```text
Visible != Contact
Contact != Admission
Admission != Exchange
Exchange != Execution

Authentication != semantic identity
Authentication != participation / trust / authority
Credential availability != secret material
Secret materialisation != execution authority

Action discovery != invocation
MCP tools/list != tools/call
Package present / described / attested != activation
Workcell allocation != process authority
SessionSpace LiveMounted != target-process authority
Renderable content != native bridge authority
```

No O:I Account identity, global reputation score, universal policy engine, universal sandbox, hidden Root Agency bypass, ambient package authority, or second secret store is introduced.

## 2. Exact protocol receipts

| Boundary | Exact current head | Exact verification |
|---|---|---|
| Phase 1 — private/audience hosted content | O:I PR #44 `58e40b65e4e33bbca16f6321f3d7d871498291cc` | Shared field `32011645897` — SUCCESS |
| Phase 2 — ingress/quarantine/Admission/index eligibility | O:I PR #47 `679a370dcd7a5ce99178e3c86e8f581f72147a7b` | Shared field `32017137289` — SUCCESS |
| Phase 3 — finite Exchange authority before I/O | O:I PR #53 `56d9ca4d785372bf60dbf3be6179bad348b84110` | Shared field `32023251553` — SUCCESS |
| Phase 4 — execution containment conformance | O:I PR #60 `5418d1024237f74d2b88a0111754423d90299be4` | Shared field `32026303870` — SUCCESS |
| Phase 4 native O:I host | O:I PR #58 `c621a4475625ab7eb0f73e842501df7e25bc8279` | OI Verify `32025144712`; O:I desktop `32025144761` — SUCCESS |
| Phase 4 AIKit target process | AIKit PR #72 `d7f892a3db670e064104a255df5cb5b55227935d` | CI `32025487060` — SUCCESS |
| Phase 4 Workcell material process | Workcell PR #32 `6762d1897328b4c43d28bc066d71fafa65767155` | verify `32025883769` — SUCCESS |
| Factory Action authority consumer | Factory PR #146 `c39bd63580cb7196f38c9a26b49e3977aac95e6a` | Factory Rust `31982029376` — SUCCESS |
| Actuation authority lineage | Actuation PR #6 `b977939ec25c32b3dc8f5ed251b70e4c26933086` | Agency contract `31976861145` — SUCCESS |
| Fresh Phase-4 full-stack evidence | closed evidence PR #62 `c7d828fe28d483303896098563d418698edb19ee` | Shared field `32026012799` — SUCCESS |

The evidence-only PR #62 remains deliberately unmerged. Its receipt is retained; it is not a production ancestry requirement.

## 3. #56 authentication / credential / secret boundary

| Owner | Exact current head | Exact verification | Ratified meaning |
|---|---|---|---|
| O:I AuthBinding | PR #59 `b20ed63cb754798f0b1df31782fc1750217ff773` | Shared field `32026123915` — SUCCESS | runtime/auth principal binds to, but does not become, Participant/Agent/world identity; authentication grants no Participation/Trust/Authority |
| AIKit CredentialRef resolution | PR #71 `52f220d9487edbac709a6d7b103a8040adfee6f6` | CI `32025455382` — SUCCESS | `SecretRequirement -> CredentialRef -> eligible provider/binding -> permitted materialisation class`; no raw secret in the read model |
| Workcell secret materialisation | PR #33 `e2629d95e55573928b0c13c91ae45a85c60892ef` | verify `32026807820`; Secret conformance `32026807812` — SUCCESS | exact privileged material boundary, value-free receipt, child-only/brokered delivery, redaction and explicit rotation semantics |

The Workcell proof pins Varlock `1.16.1` and separately executes its broker proof and a Docker deny-by-default boundary. The integrated preview `varlock proxy run --sandbox=docker` path is **not** claimed: it failed before broker receipt on the hosted runner and is not relied upon. The private 1Password service-account path pins `@varlock/1password-plugin@2.0.0` but remains private-provider gated.

## 4. Final residual closure seams

The final closure branch adds two narrow O:I-owned seams rather than reopening a fifth protocol phase.

### 4.1 Executable artifact attestation

`shared-field/security-closure.mjs` implements `oi.artifact-attestation/v1` using an Ed25519 signature over a fixed O:I statement envelope bound to:

```text
artifact ref
source revision
SHA-256 of exact artifact bytes
signer ref
key id
issue time
```

The receiving verifier separately supplies the expected artifact ref, source revision and key id. Tests prove:

- exact artifact/revision verifies;
- byte tampering fails;
- source-revision substitution fails with identical bytes;
- key substitution fails;
- mutation of the signed statement fails cryptographic verification;
- the attestation carries no trust, Capability grant, Action authority or activation state.

This is one strong provenance path for executable component/package material. It is not a universal PKI, trust score, package manager or execution grant.

### 4.2 Privacy-minimised security audit

`oi.security-audit/v1` records only the representative security facts required to explain a bounded allow/deny decision:

```text
event ref + time
decision
boundary
reason code
operation ref
scoped principal fingerprint
provenance ref
hash-chain predecessor
```

The ledger:

- requires explicit `security:audit:read` scope for explanation;
- stores neither raw principal identity nor content payload nor secret value nor private relationship graph;
- refuses callers attempting to insert those private payload classes;
- has explicit finite retention and pruning;
- preserves a retained hash-chain anchor so post-prune retained integrity stays checkable;
- returns copies, not mutable ledger state.

Audit therefore provides representative explanation without creating a central private social-history database.

## 5. #31 attack-fixture matrix

| # | Required attack | Owning implementation / executable proof | Status |
|---|---|---|---|
| S1 | cross-field unauthorised SpaceTimeDB mutation denied server-side | Phase-1 private backing tables + caller-filtered views/reducers; live SpaceTimeDB acceptance on PR #44 and inherited fresh closure lane | **PROVEN** |
| S2 | private Contact/Watch absent from public Explore/index/subscription | encounter-security floor + Phase-1 visibility and Watch privacy; full-stack Phase-4 evidence | **PROVEN** |
| S3 | high-rate unsolicited Contact bounded without identity/provenance mutation | Contact rate/refusal/block corpus plus server-side bounded shared-state fixtures | **PROVEN** |
| S4 | hostile HTML/SVG/script encountered without execution authority | O:I native/Tauri PR #58 CSP + declarative rendering tests; Phase-4 hostile rich-content and prompt-injection deny corpus | **PROVEN for the live render/host path** |
| S5 | hostile package/component cannot gain bridge/filesystem/network/secret without explicit grant | Phase-4 O:I native host + AIKit process + Workcell material-process exact authority checks | **PROVEN** |
| S6 | tampered signed/attested package or Projection revision fails when attestation is required | `oi.artifact-attestation/v1` exact bytes/revision/key tests plus Phase-4 binding-revision substitution denial | **PROVEN** |
| S7 | malicious retrieved Contribution cannot cause ungranted Action/secret disclosure | Phase-2 quarantine/Admission + Phase-4 prompt-injection/Action/tool/native-bridge deny corpus + #56 material boundary | **PROVEN** |
| S8 | untrusted A2A endpoint/Agent Card cannot overwrite canonical identity | Phase-3 A2A binding/replacement evidence and final full-stack Phase-4 evidence | **PROVEN** |
| S9 | returned A2A material stays unadmitted until separate transition | `acceptance:a2a` live SpaceTimeDB lane and Phase-3 Exchange return-to-quarantine law | **PROVEN** |
| S10 | blocked/revoked relation stays blocked after reconnect/restart | Contact/Watch persistence/revocation corpus plus hosted-state/provider evidence | **PROVEN** |
| S11 | public index rebuild excludes quarantined/private/withdrawn material | Phase-2 index eligibility/de-index/withdrawal + caller-filtered rebuild; PR #61 privacy-safe referent/index rebuild at `7a4522a588ff46fa82e19d0e33b9156bae8a948c`, Shared field `32025848896` SUCCESS | **PROVEN** |
| S12 | audit explains allowed/denied path without exposing unrelated private relationship data | `oi.security-audit/v1` scoped allow/deny explanation, minimisation and retention tests | **PROVEN** |

### S4 file-ingestion non-claim

The current live O:I boundary under test is declarative shared-field content rendered through the browser/Tauri host. There is no general archive/document upload parser or malware-scanning pipeline whose safety can honestly be demonstrated in this ancestry. This receipt therefore proves the actual rich-content/native-host boundary and does **not** invent ClamAV/YARA/DOMPurify or decompression-parser theatre for a non-live ingestion product. If a later native file-ingestion path is introduced, that product owns a new parser/content-security acceptance surface.

## 6. Search/index and common-referent security

O:I PR #61 (`agent/oi-explore-common-referents`) remains an independent Phase-2 sibling, not a #43 mutation. Exact current head `7a4522a588ff46fa82e19d0e33b9156bae8a948c` passed Shared field run `32025848896`.

Its accepted security contribution is narrow:

- reconciliation reads only caller-visible Projection/Contribution/Explore views;
- exact representation equality may group visible holdings without leaking hidden holding counts/refs;
- weak similarity stays proposal-only;
- admitted-but-unindexed material does not enter reconciliation;
- duplicate holdings do not boost ranking/authority;
- rebuild from the same filtered state reproduces the same referent identities.

This strengthens S11 without transferring source identity, ownership, trust or authority into the read model.

## 7. Provider/source ledger used by this ratification

The ratified implementation pins and proves versions at the point where they are actually used rather than declaring a vendor constitutional:

- hosted shared-field CI installs and verifies SpaceTimeDB CLI/SDK `2.8.1` and runs the live privacy/Admission/Exchange/A2A lanes;
- O:I shared-field JS tests run on Node `22` and the final attestation uses the runtime's native Ed25519 sign/verify API;
- Workcell secret conformance pins Varlock `1.16.1` and the optional private 1Password adapter fixture pins `@varlock/1password-plugin@2.0.0`;
- Docker is used only for the concrete deny-by-default filesystem/network proof executed by Workcell; no VM-grade isolation claim is inferred from it.

Research into Sigstore/in-toto, policy engines, capability systems, sandbox runtimes and other security products informed the architecture, but none is promoted to a constitutional dependency merely because it was researched.

## 8. Deliberate remaining non-claims

The following are explicitly **outside this cloud closure** and remain native/provider/physical acceptance where/when required:

- private 1Password account/service-account acceptance;
- the currently non-green Varlock integrated preview `proxy run --sandbox=docker` bridge;
- tmpfs/native secret mount providers not presently implemented/proven;
- provider-native dynamic secret lease and cloud workload-federation physical proofs;
- live WebAuthn/OIDC/SPIFFE/SPIRE provider deployment where no current product boundary requires a hosted instance;
- real workstation/home-server containment and secret-delivery observations;
- Docker/Arrakis/Tailscale/reference-Workcell physical topology acceptance;
- live Ollama/llama.cpp/vLLM/GPU provider acceptance;
- future general archive/document upload parser or malware-scanning paths not present in this live O:I ancestry.

None of these non-claims weakens the protocol distinction proved here; none is silently represented as green.

## 9. Closure conclusion

Every #31 required end-to-end attack class is now mapped to a live owning boundary and executable evidence, or—only where the corresponding product path does not exist—to an explicit non-claim that does not pretend to secure a fictional surface.

The final cloud-available security whole therefore has no unresolved semantic privilege escalation between visibility, Contact, Admission, Exchange, authentication, credentials, materialisation and execution. Provenance/attestation is bound to an exact artifact/revision and remains non-authoritative. Audit is bounded and privacy-minimised. Native owners continue to enforce their own privileged effects.

**#31 may close once the final receipt-bearing branch head itself passes the fresh Shared-field workflow.**
