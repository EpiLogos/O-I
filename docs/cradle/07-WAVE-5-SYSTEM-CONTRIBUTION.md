# 07 — Wave 5 System contribution contract

*The interface between the six product owners and the cradle's System
surface. Freezes the field names; leaves the canonical Rust/TS types to the
composition-kernel track (`02-ARCHITECTURE.md` lineage: one composition
layer, native ownership preserved).*

Supplements `06-SYSTEM-SETTINGS.md`, which remains the law (L1–L6) and the
base disclosure contract (`oi.product-settings-disclosure/v1`). Wave 5 does
not replace that design — it makes it native. §4.5 of 06 ("Source today")
said every section is `provenance: cradle-composed` until each product ships
its descriptor natively. Wave 5 is P2 and P3 of 06 §8: the products ship.

---

## 1. Why this contract exists

`desktop/cradle/kernel/src/composition.rs` names the gap in its own
`integration_obligations`, verbatim:

1. *"Native per-operation readiness/compatibility disclosure; installation
   is not ready, incompatible or degraded runtime evidence."*
2. *"Native authored/effective/active configuration readings with owner
   refs; installation versions are not these axes."*
3. *"Native Action/Surface contribution descriptors and containment/
   availability contract; a capability catalogue is not a mountable
   contribution."*

Wave 5 closes those three. The System surface must be able to render, for
every owner and every disclosed subject:

```text
AUTHORED / DECLARED      what the human wrote
EFFECTIVE / RESOLVED     what the owner actually resolved
ACTIVE / MATERIALISED    what is running now, with its materialisation ref
STAGED                   what is prepared but not applied, with its stage state
EXPECTED EFFECT          what applying it would do, disclosed before invoke
OWNER / PROVENANCE       which owner disclosed it, from where, observed when
```

Plus the two things that make the surface honest rather than decorative:

```text
AVAILABILITY / DEGRADATION   available | degraded | unavailable | unknown, with reason
ACTIONS                      disclosed | missing_native_obligation | unavailable
```

## 2. Schema

```text
schema            oi.product-settings-disclosure/v2
contract_revision wave-5/system.1
```

`v1` (06 §4.1) stays readable — the cradle's P1 projection still consumes it.
`v2` is `v1` plus: the `owner` block, the `staged` and `expected_effect`
axes, per-value provenance on every axis, `drift`, per-action
`authority`/`exposure`/`explain`/`history`, and owner-level
`availability`/`degradations`/`obligations`.

New kinds extend the schema version (06 §4.3). An unknown `kind` degrades to
raw-with-label; it is never dropped.

## 3. The descriptor

```json
{
  "schema": "oi.product-settings-disclosure/v2",
  "product_id": "ai-kit",
  "contract_revision": "wave-5/system.1",
  "disclosed_at_unix_ms": 1757324400000,
  "owner": {
    "owner_id": "ai-kit",
    "owner_ref": "<stable ref in the owner's own namespace>",
    "owner_version": "<product version>",
    "reading_command": ["aikit", "system", "--json"],
    "reading_digest": "<sha256 of the canonical reading body, or null>",
    "observed_at_unix_ms": 1757324400000
  },
  "about": "2-3 lines, disclosure-grade: what this product does in this world.",
  "sections": [
    {
      "id": "resolution",
      "title": "Resolution chain",
      "settings": [
        {
          "key": "sources.pins",
          "title": "Skill source pins",
          "kind": "table",
          "axes": {
            "declared":  { "value": {}, "provenance": {"owner_ref": "...", "path": "...", "observed_at_unix_ms": 0} },
            "effective": { "value": {}, "provenance": {"owner_ref": "...", "path": "...", "observed_at_unix_ms": 0} },
            "active":    { "value": {}, "provenance": {"owner_ref": "...", "path": "...", "observed_at_unix_ms": 0},
                           "materialisation_ref": "<apply receipt / generation id>" },
            "staged":    { "value": {}, "provenance": {"owner_ref": "...", "path": "...", "observed_at_unix_ms": 0},
                           "stage_ref": "<stage id>", "stage_state": "none|prepared|previewed|discardable" },
            "expected_effect": { "summary": "what applying the stage would change", "ref": "<explain ref>" }
          },
          "mutable": false,
          "native_path": "aikit sources / aikit set",
          "bootstrap": false,
          "drift": { "state": "none|diverged|unknown", "between": ["declared", "effective"], "remediation_action_ref": null }
        }
      ]
    }
  ],
  "actions": [
    {
      "action_ref": "factory.bind.intent",
      "title": "Preview a binding change",
      "args": [{ "name": "project_ref", "kind": "string" }],
      "availability": "disclosed",
      "unavailable_reason": null,
      "subject_kinds": ["software-factory.binding"],
      "authority": { "requires": ["<capability>"], "granted_by": "<who>", "evidence_ref": null },
      "exposure": { "ui": true, "agent": true, "headless": true },
      "explain": { "ref": "factory explain", "command": ["factory", "explain", "--json"] },
      "history": { "ref": "factory history", "command": ["factory", "history", "--json"] }
    }
  ],
  "availability": { "state": "available", "reason": null },
  "degradations": [
    { "subject_ref": "...", "state": "unavailable", "reason": "...", "native_error": "..." }
  ],
  "obligations": [
    "Native operation that does not exist yet, named so the surface renders an obligation instead of a disabled button."
  ]
}
```

## 4. The four distinctions that must not collapse

**4.1 Axes.** `declared`, `effective` and `active` are always all three
present, even when they agree — the agreement is the information (06 §4.2).
`staged` is present with `stage_state: "none"` when nothing is prepared.
`expected_effect` names what the stage would do. A divergence between
declared and effective is a `drift` and is the surface's primary
maintenance signal.

**4.2 Action states.** For every action the owner must keep distinct:

```text
exists     the owner has the operation
selected   the surface/user picked it for this subject
exposed    the owner discloses it through the seam (exposure.ui/agent/headless)
authorised the caller holds the authority (authority.requires/granted_by)
invoked    it actually ran, and produced a receipt
```

Authority is never inferred from UI location, from root-agent identity, or
from the fact that an action is listed. An action that exists but is not
disclosed has `availability: "missing_native_obligation"` and renders as a
named obligation — never as a disabled control. An action disclosed but not
authorised for this caller shows its authority requirement and stays
uncalled.

**4.3 Availability.** Owner-level `availability` and per-subject
`degradations` are separate facts. A product that is discovered is not
thereby ready (L1): readiness is the owner's own per-operation disclosure,
not the census `state`. Missing hardware, absent providers and unreachable
remotes appear as `unavailable` with a reason — never as a fabricated
control.

**4.4 Credential material is presence-only.** Keys, tokens and secrets are
disclosed as presence plus a ref. Never a value.

**4.5 `reading_digest` has one convention.** The canonical body is the whole
descriptor with every `*_unix_ms` field zeroed (`disclosed_at_unix_ms`,
`owner.observed_at_unix_ms`, and every `axes.*.provenance.observed_at_unix_ms`)
and `owner.reading_digest` itself set to null. `reading_digest` is
`sha256` over that body, hex. The point is that two readings of an unchanged
world produce the same digest, so a changed digest means a changed reading and
never a changed clock. An owner that hashes live timestamps is wrong, not
merely different. Where an owner documents its convention, it names it in
`owner.reading_digest_covers`.

**4.6 `provenance.path` is a location, not a command.** `owner_ref` names the
owner's namespace; `path` names where the value comes from inside it — a real
source path, a real file in the owner's tree, or a real owner-namespace
location (`workcell:local:instances:registry`). A command string is not a
path: `"path": "aikit status --all"` is not traceable and does not satisfy
L2. When the value comes from a command rather than a file, `path` names the
owner-side location the command reads, and the command belongs in the
action's `native_path`.

**4.7 Availability is probed, not asserted.** `availability.state` and
`degradations` must reflect a real observation of this machine, not a literal.
An owner that hardcodes `"available"` while its own probes can fail is telling
the surface something it did not check. Where a faculty is structurally absent
(rather than merely unobserved), the degradation reason says so, and the
reading stays honest when the faculty later appears.

**4.8 Three axes, three facts.** `declared`, `effective` and `active` are not
three labels for one resolved value. A resolved binding is not `declared`; the
honest `declared` for a value nobody authored is `null` and that null is the
finding. Cloning `effective` into `declared` destroys the surface's only
purpose (see §4.1).

## 5. Consumer seam

The cradle's System surface obtains each reading the same way for every
owner: a read-only invocation of the owner's own executable, in that owner's
own namespace, returning one document on stdout. The composition kernel owns
discovery and mounting; the cradle projects. No owner-specific branch in the
cradle (L6) — adding an owner, a section or a setting never requires cradle
code changes.

### 5.1 The mounted composition reading

Discovery and mounting happen in the composition kernel, which returns one
document:

```json
{
  "schema": "oi.system-composition/v1",
  "contract_revision": "wave-5/system.1",
  "observed_at_unix_ms": 1757324400000,
  "census": { "schema": "oi.desktop-composition-reading/v1", "positions": [] },
  "owners": [
    {
      "product_id": "ai-kit",
      "availability": "available",
      "reason": null,
      "reading_command": ["aikit", "system", "--json"],
      "descriptor": { "schema": "oi.product-settings-disclosure/v2" },
      "error": null,
      "provenance": { "observed_at_unix_ms": 1757324400000, "digest": null }
    }
  ],
  "obligations": [
    "Named native operation that does not exist yet."
  ]
}
```

Rules the mount obeys:

- One entry per position, always seven: the composition layer (`oi`) plus the
  six products. A position with no mounted descriptor still appears, with
  `availability` and a `reason` — absence is data.
- `descriptor` is the owner's own document, passed through unmodified. The
  kernel does not rewrite, normalise or re-derive owner values.
- A mount failure is `error` plus a degraded `availability`, never an empty
  success and never a fabricated descriptor.
- `census` carries the existing census reading so the surface keeps its
  honest "installed but not ready" position (L1).
- The surface renders a mounted descriptor natively. Where no descriptor is
  mounted it falls back to the P1 cradle-composed section, still marked
  `provenance: cradle-composed` (06 §4.5) and visibly cheaper than a native
  disclosure. Native disclosures replace composition one product at a time
  and the page does not change when they do (L6).

Owner readings are read-only. Engagement (P3) crosses the seam only through
the owner's disclosed intent/invoke operations, following the Factory
pattern: `descriptor discloses action → surface renders it → invoke crosses
the owner seam via the kernel op → owner executes natively → receipts return
→ surface shows the receipt`.

## 6. Owner scope for Wave 5

| owner | product_id | scope of this wave |
|---|---|---|
| Actuation | `actuation` | Agent/Agency, WorldBinding, bounds/determination, authority, availability, Activity/ActuationStream where current, Return, canonical Actions |
| AIKit | `ai-kit` | Project/Profile/scope, Skills/SkillSets/Methods/UsageOverlays, ContextSources/ContextResolution, models/providers/credential refs, Harnesses/HarnessComposition, Components/providers, Surfaces, SessionSpaces/AgentSessions, resource + Action horizon, Generation/Procedure, Explain/History |
| Central | `central` | authored vs effective/observed for personal and Project ground, self-description, machine intent, Skills/Methods source, privacy/disclosure policy, proposals, accepted source mutation, current owner Actions |
| Factory | `software-factory` | configuration, developmental state, canonical Actions the owner contract genuinely supplies |
| Workcell | `workcell` | Workcells/instances, providers/offers/capabilities, processes/services, storage/artifacts, Fabric/reachability, local/remote, model-serving materialisation, hardware/accelerator observations, lifecycle/reconcile/release, public material Actions |
| QL-MEF | `quaternal-logic` | currently accepted native QL Kernel availability/readings/Actions/readiness only. QL stays optional. No anticipation of QL-MEF #123 Vāk/C′/Context-Frame conclusions |
| O:I | `oi` | the composition layer's own constitutional state: suite pin set, managed root, ground binding, install receipts, verify/doctor, drift |

**Serialized owner decision outstanding.** The Factory↔Actuation
discovery/intent/authority seam is not jointly owned by either track. Each
implements everything independent of it and returns the exact remaining
decision. It is not invented here.

## 7. What this wave does not do

- No configuration semantics, no `oi-settings` storage, no settings
  database, no duplicate Action catalogue, no duplicate provider registry.
- No renderer-owned business logic: the cradle projects, never authors.
- No fake capability state. An empty section is proof, not failure (L3).
- No change to Navigator/Canvas/right-layer/lower-region geometry, and no
  disturbance of the Wave 1–4 work.
