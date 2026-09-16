# 09 — Configuration plane: the C0 contract lock

*The frozen contract for O:I configuration, profiles, scopes and owner-native
mutation (#299, Gate A / C0). Supplements `06-SYSTEM-SETTINGS.md` (the System
law, L1–L6), `07-WAVE-5-SYSTEM-CONTRIBUTION.md` (the `v2` native-read seam,
whose §7 storage boundary this document explicitly narrows) and
`08-WAVE-5-CONSUMER-SEAM.md` (the consumer seam as exercised).*

Standing: this document is the contract of record for the configuration
plane. After Gate A it is **closed for fan-out**: a lane that finds a real
contradiction returns it as an explicit contract issue against #299; it does
not mint divergent local semantics.

---

## 0. What C0 is

C0 is the contract/design convergence layer of the Configuration Plane
Wayfinder (#299). It freezes sixteen decisions so that the parallel lanes
(C1 kernel, C2 profiles, C3 owner lanes, C4 connectors, C5 CLI, C6 Desktop,
C7 conformance) begin from one contract instead of deciding architecture
independently.

C0 owns decisions, not features. It does not implement the kernel, the
`oi config` / `oi profile` command set, owner migrations, or Desktop
configuration UI. The only implementation it carries is the minimum
schema/types/fixtures/validation scaffolding that makes its decisions
executable and testable (§19).

## 0.1 The superseding storage law

Wave 5 (07 §7) said:

> No configuration semantics, no `oi-settings` storage, no settings database.

That was correct for the disclosure wave and is too broad as the permanent
O:I rule. 07 §7 is amended in place (see the amendment there). The
superseding law, which governs everything below, is:

> **O:I SHALL NOT mirror or independently reinterpret product-owned
> configuration. O:I MAY own composition configuration, sparse desired-state
> profiles, scope overlays, connector configuration, configuration provenance
> and reconciliation state required to operate the six as one World. Native
> product configuration remains authoritative in its owning product.**

Everything O:I may persist is enumerated in §8 (Storage boundary). The
existing read-only disclosure plane is preserved unchanged; this contract
adds a complementary operability plane beside it.

---

## 1. The two complementary contracts

Read-state evidence and operability metadata are **different contracts about
different questions**, and neither is inferred from the other when the owner
can disclose it explicitly.

| | native state disclosure | configuration contribution |
|---|---|---|
| schema | `oi.product-settings-disclosure/v2` (07) | `oi.configuration-contribution/v1` (this lock) |
| question | *what does this owner report is true now?* | *what may the composed World legitimately address, at what scopes, with what value contract, through what owner-native operation?* |
| carries | declared/effective/active/staged, expected_effect, drift, availability, actions, provenance | setting identity, value schema, allowed scopes, sensitivity, effect, operation capabilities, native ref |
| O:I role | mount and project unmodified | address, compose, plan, route |
| command | `<ns> system --json` | `<ns> config-contribution --json` |

Structural rule: a contribution document never carries declared/effective/
active values, and a disclosure document never carries desired values or
mutability contracts. A document that mixes the two planes is invalid
(conformance fixtures enforce this).

## 2. C0-1 — Contribution schema, version, location

The configuration contribution contract is:

```text
schema            oi.configuration-contribution/v1
contract_revision configuration-plane/contribution.1
```

Canonical locations:

- design contract — this document;
- JSON Schema — `schemas/oi.configuration-contribution-v1.schema.json`
  (draft 2020-12);
- native Rust types — `cli/src/configuration/` (module `oi_cli::configuration`);
- conformance fixtures — `suite/configuration/cases/`.

### 2.1 Document shape

```json
{
  "schema": "oi.configuration-contribution/v1",
  "contract_revision": "configuration-plane/contribution.1",
  "owner": {
    "owner_ref": "ai-kit",
    "owner_kind": "product",
    "owner_version": "<product version>",
    "contribution_command": ["aikit", "config-contribution", "--json"],
    "disclosed_at_unix_ms": 0,
    "reading_digest": "<sha256 hex or null>",
    "reading_digest_covers": "07 §4.5 convention"
  },
  "about": "1-3 lines: what this owner's configurable surface is.",
  "sections": [
    {
      "id": "resolution",
      "title": "Resolution chain",
      "settings": [{ "setting_ref": "ai-kit:resolution:model.default", "...": "SettingSpec, §2.2" }]
    }
  ],
  "operations": {
    "transport": "cli/v1",
    "validate": { "availability": "disclosed" },
    "plan":     { "availability": "disclosed" },
    "apply":    { "availability": "disclosed" },
    "reset":    { "availability": "disclosed" }
  },
  "availability": { "state": "available", "reason": null },
  "degradations": [],
  "obligations": []
}
```

`availability`, `degradations` and `obligations` reuse the Wave-5 vocabulary
and laws (07 §4.7: probed, not asserted). `reading_digest` reuses the 07 §4.5
convention exactly (sha256 over the document with every `*_unix_ms` field
zeroed and `reading_digest` null).

### 2.2 SettingSpec

```json
{
  "setting_ref": "ai-kit:resolution:model.default",
  "section_ref": "resolution",
  "title": "Default model",
  "description": "What this setting decides, disclosure-grade.",
  "value_schema": { "type": "enum", "options": [{ "value": "sonnet" }, { "value": "opus" }] },
  "allowed_scopes": [ { "scope_kind": "project", "scope_ref": null },
                      { "scope_kind": "session-space", "scope_ref": null } ],
  "writable": true,
  "profileable": true,
  "sensitive": false,
  "default": "sonnet",
  "default_semantics": "constant",
  "effect": { "kind": "session-restart-required", "summary": "New sessions resolve; running sessions keep their model.", "ref": null },
  "operations": { "validate": true, "plan": true, "apply": true, "reset": true },
  "native_ref": "aikit:project:profiles:default:model"
}
```

Frozen field laws:

- `setting_ref` is the full stable identity (§3) and its owner part must
  equal `owner.owner_ref`; `section_ref` must equal the enclosing
  `sections[].id`. (The redundancy is deliberate: the nested position is
  presentation grouping, the refs are the identity.)
- `value_schema.type` is one of the frozen kinds (§2.3). Unknown kinds make
  the document invalid at contract revision 1 — new kinds extend the schema
  minor revision (§15), they are not silently accepted. This differs from the
  disclosure plane's degrade-on-unknown-kind rule because a contribution is
  an operability contract: consumers must know they can operate, not merely
  render.
- `default` may appear only when `default_semantics` is `"constant"`. When
  `default_semantics` is `"computed"`, the owner computes the default and O:I
  never caches or materialises it (a copied native default is a forbidden
  storage class, §8). `default` disclosure is informational: it explains the
  owner's baseline, it does not authorise O:I to write it anywhere.
- `native_ref` is a location in the owner's namespace, never a command
  string (07 §4.6 law carried over).
- `sensitive: true` marks values that must be redacted from logs and casual
  display; `value_schema.type: "secret"` marks credential material, which is
  governed by §11 and is stronger than sensitivity.
- `effect.kind` is from the frozen expected-effect vocabulary (§12).

### 2.3 Value-schema kinds

```text
boolean   scalar   number   integer   enum   path   reference   table   list   secret
```

Type-specific restrictions are carried inside `value_schema`
(`options` for enum, `columns` for table, `items` for list, `minimum`/
`maximum` for number/integer, `pattern`/`format` for scalar/path). They are
validation hints for consumers; the owner's native validation remains
authoritative (the transport returns `invalid_value` with owner reasons).
This is the generic-rendering basis for the Desktop law in #299 §11:
`bool → switch, scalar/number/integer → typed input, enum → choice,
path → path chooser, reference → native resolver, table/list → structured
editor, secret → presence/reference + owner operation`.

## 3. C0-2 — Stable setting-reference namespace

One setting has exactly one stable identity everywhere: native owner,
contribution, resolver, profile override, CLI, Desktop, Agent, receipts.

Grammar (frozen):

```text
setting_ref  := owner_ref ":" section_ref ":" setting_key
owner_ref    := product_id | "connector/" connector_name
product_id / connector_name / section_ref
             := [a-z0-9][a-z0-9-]*          (no dots, no colons)
setting_key  := dotted lowercase key         ([a-z0-9_][a-z0-9_-]* ("." ...)*)
```

Examples:

```text
ai-kit:resolution:model.default          product owner (existing product_id)
workcell:placement:placement.policy      product owner
oi:composition:managed-root              the O:I composition layer itself
connector/factory-actuation:authority:authority.mode
                                         connector owner (fixture-only until C4;
                                         the real Factory↔Actuation relation is
                                         NOT invented here — #299 §9)
```

Frozen laws:

- `product_id` is the existing canonical id set — the seven positions of the
  Wave-5 mount (`central`, `actuation`, `ai-kit`, `software-factory`,
  `workcell`, `quaternal-logic`, plus `oi` for the composition layer). No
  second alias exists.
- The `connector/` prefix is the only structural kind marker inside a ref.
  Owner kind is otherwise a descriptor fact (`owner.owner_kind`), not a ref
  prefix (§4).
- `setting_ref` parses by splitting on `:` into exactly three components.
  A ref that does not parse is invalid; it is never coerced.
- Identity is presentation-free: no section ordering, no UI path, no locale
  in the ref.
- Compatibility mapping to the v2 disclosure plane is structural and exact
  (§16): `owner_ref` ↔ `product_id`, `section_ref` ↔ `sections[].id`,
  `setting_key` ↔ `settings[].key`.

## 4. C0-3 — Owner descriptor and discovery

Owner kinds are exactly:

```text
product     one native product (the six)
oi          the O:I composition layer itself
connector   a relation between products/systems (mechanism only in C0; #299 §9)
```

The owner descriptor is the `owner` block of the contribution document:
`owner_ref`, `owner_kind`, `owner_version`, `contribution_command`,
`disclosed_at_unix_ms`, `reading_digest`, `reading_digest_covers`.

Discovery relation (frozen, mirroring the Wave-5 one-call convention):

```text
<owner executable> config-contribution --json     # bare document on stdout
oi <namespace> config-contribution --json         # through the oi dispatcher
```

- The document is emitted bare (no envelope) — the exact convention Wave 5
  had to repair for AIKit (`aikit system --json`); it is a law from day one
  here.
- Through `oi`, the dispatcher resolves the namespace to the owner the suite
  actually deployed, exactly as for `system --json`.
- A failed or non-conforming read is a named degradation on the mount, never
  an invented contribution. Absence of a contribution does not falsify a v2
  disclosure and vice versa (§16).
- The owner set is discovered through owner descriptors, not a constant —
  but C0 does not build the registry. The kernel lane (C1) owns the registry;
  the contract here is that registration content is the contribution
  document itself, so no lane needs a second descriptor format.
- Discovery and installed-executable resolution are deliberately two
  relations (C0-3 disposition, returned by the post-Gate-A fan-out):
  discovery enumerates owners from their contribution documents — the mount
  is the registration — while the `oi` dispatcher resolves a namespace to
  the executable the suite actually deployed. The registry does not consult
  the dispatcher's installed-executable table. An installed-but-unregistered
  product therefore degrades honestly as unavailable on the configuration
  plane (no invented contribution), and a registered-but-unreadable owner
  degrades by name on read; `oi current-world` remains the material
  presence census.

## 5. C0-4 — Scope address representation

Every addressable configuration request carries an explicit scope:

```json
{ "scope_kind": "project", "scope_ref": "epilogos/o-i" }
```

Frozen seed scope kinds (an open registry; new kinds extend the contract
minor revision, §15):

```text
world        the O:I World as a whole            (singular)
ground       the personal ground                  (singular)
project      a Project
machine      this machine                         (singular)
workcell     a Workcell
agency       an Agency
agent        a durable Agent
session-space  a SessionSpace
agent-session  a running AgentSession
provider     a provider relation
connector-relation  the relation a connector owns
invocation   one invocation (ephemeral)
```

Laws:

- The six products do not share one universal hierarchy and none is
  manufactured. An owner contribution declares, per setting, which scope
  kinds are meaningful (`allowed_scopes`, §2.2). A scope kind not in the
  setting's `allowed_scopes` is an error, never a fallback to another scope.
- `scope_ref` is a non-empty string in the scope kind's own namespace.
  For singular kinds (`world`, `ground`, `machine`) `scope_ref` may be
  `null`, denoting the singular instance. In contribution `allowed_scopes`,
  `scope_ref: null` means "any instance of this kind".
- Compact form (CLI/grammar only, never wire): `"<scope_kind>:<scope_ref>"`,
  with the ref omitted for singular kinds (`project:epilogos/o-i`, `world`).
- Observed facts (hardware, provider availability, reachability, process
  state) are evidence and constraints. They are never a scope layer and never
  profile state (§9).

Unsupported-scope semantics (frozen error codes, §13): addressing a valid
setting outside its `allowed_scopes` is `unsupported_scope`; using a
scope kind outside the registry is `unknown_scope_kind`. Both are explicit,
structured errors — never silent reinterpretation at another scope.

## 6. C0-5 — Owner-native mutation transport

Four operations, one transport, mirroring the Wave-5 fixed-verb convention.
Every owner that accepts mutation implements the same verb grammar on its own
executable; `oi` routes through its dispatcher; no O:I-side per-product
parsers exist.

```text
<ns> config validate --json --setting <setting_ref> [--scope <compact>]
          (--value <json> | --value-file <path|->)
<ns> config plan     --json --setting <setting_ref> [--scope <compact>]
          (--value <json> | --value-file <path|->)
<ns> config apply    --json (--plan-file <path|->) [--changeset <id>]
<ns> config reset    --json --setting <setting_ref> [--scope <compact>]
          [--changeset <id>]
```

- Responses are bare JSON documents on stdout; failures exit non-zero with
  an `oi.config-error/v1` document on stdout (§13).
- `validate` → `oi.config-validation/v1`; `plan` → `oi.config-plan/v1`
  (owner-minted `plan_id`, `plan_digest`, expected effect, explain ref);
  `apply`/`reset` → `oi.config-receipt/v1`.
- `plan_digest` is the idempotency anchor (§10) and is **owner-canonical**
  (C0-5 disposition, returned by the post-Gate-A fan-out): the owner mints
  it over the plan body by its own single function, and consumers treat it
  as an opaque identity — proven by replay under the same changeset
  (`no_op` + `original_receipt_id`), never by independent re-derivation of
  a foreign owner's digest. Owner-internal recipes may differ (excluding
  the volatile fields from the hashed body, or zeroing them); both are
  conforming for exactly that reason.
- Values cross as JSON; `--value-file -` reads stdin so no argv
  size/quoting limits exist. Secrets cross only as secret references (§11);
  an owner that needs material credentials mutates them owner-natively
  outside this plane and discloses presence only.
- Owner-side authority applies exactly as in Wave 5: disclosure is not
  authority (07 §4.2); the transport carries the caller's authority context
  and the owner decides.

## 7. C0-6 — Desired/native resolution and reconciliation vocabulary

`desired` is the one axis native disclosure deliberately does not contain.
It is never named `declared` and never written into a native reading.

The resolved reading document is:

```text
schema   oi.config-resolution/v1
```

```json
{
  "schema": "oi.config-resolution/v1",
  "setting_ref": "ai-kit:resolution:model.default",
  "scope": { "scope_kind": "project", "scope_ref": "epilogos/o-i" },
  "desired": { "value": "sonnet-next", "source_ref": "profile:development", "set_at_unix_ms": 0 },
  "native": {
    "declared":  { "value": "sonnet-current", "provenance": { "owner_ref": "ai-kit", "path": "project profile", "observed_at_unix_ms": 0 } },
    "effective": { "value": "sonnet-current", "provenance": { "owner_ref": "ai-kit", "path": "resolution", "observed_at_unix_ms": 0 } },
    "active":    { "value": "sonnet-current", "provenance": { "owner_ref": "ai-kit", "path": "session", "observed_at_unix_ms": 0 } }
  },
  "native_reading": { "reading_digest": "<sha256 or null>", "observed_at_unix_ms": 0 },
  "reconciliation": { "status": "drifted", "reason": "desired differs from native effective", "detail_ref": null }
}
```

`native` axes are the owner's own v2 facts passed through unmodified —
O:I never recomputes them. `desired.value` is present only when O:I actually
holds desired state for that setting at that scope.

### 7.1 Reconciliation status vocabulary (frozen)

```text
satisfied     desired present and the owner's effective (or declared where
              effective is absent) equals it; or no desired held and nothing
              owed.
drifted       desired and native fact both present and differ.
pending       an owner-side stage or a planned-but-unapplied ChangeSet
              exists for this setting (stage_state prepared/previewed, or an
              open plan).
blocked       the setting cannot be reconciled now: owner unavailable or
              degraded on this subject, native validation failed, or
              authority is missing. The reason names which.
unsupported   the setting does not exist in the owner's contribution, or is
              not addressable at this scope / not profileable here.
unknown       no native axes were disclosed for this setting (no v2 reading,
              or the axes are absent). Never guessed, never fabricated.
```

Derivation is a pure function of (desired state, native reading). The exact
truth table is pinned by fixtures (`suite/configuration/cases/
resolution-cases.json`) and by `oi_cli::configuration::reconciliation`.

## 8. C0-7 — ChangeSet schema, lifecycle, ordering

```text
schema   oi.config-changeset/v1
```

```json
{
  "schema": "oi.config-changeset/v1",
  "changeset_id": "cs-01JABC...",
  "created_at_unix_ms": 0,
  "profile_ref": "development",
  "requested": [
    { "setting_ref": "ai-kit:resolution:model.default",
      "scope": { "scope_kind": "project", "scope_ref": "epilogos/o-i" },
      "value": "sonnet-next" }
  ],
  "operations": [
    { "op_id": "op-1", "depends_on": [],
      "owner_ref": "ai-kit", "setting_ref": "ai-kit:resolution:model.default",
      "scope": { "scope_kind": "project", "scope_ref": "epilogos/o-i" },
      "kind": "apply", "plan_digest": "<sha256>",
      "status": "verified", "receipt_ref": "aikit-receipt-...", "error": null }
  ],
  "verification": {
    "reading_digest": "<sha256 of the post-apply v2 reading>",
    "observed_at_unix_ms": 0,
    "reconciliations": [ { "setting_ref": "ai-kit:resolution:model.default", "status": "satisfied" } ]
  },
  "status": "verified"
}
```

Laws:

- A ChangeSet is a stable, machine-readable change plan over one or more
  owner operations. It is **not** a distributed transaction: no ACID is
  claimed across independent products, and compensation exists only where an
  owner really supplies it (a `reset` operation may be included explicitly;
  no implicit rollback is ever recorded).
- `changeset_id` is client-minted (`cs-` + a globally-unique suffix).
- `operations[]` is an ordered list; `depends_on` names real dependencies
  only (where the owner disclosed ordering). Independent operations may
  execute in any order.
- Per-operation truth is kept per operation: `planned → validated → applied
  → verified`, or `failed` with the owner error. The overall status is
  derived, never asserted:

```text
planned            no operation has passed validation
validated          all operations validated, none applied
applied            all operations applied, verification not yet taken
verified           all applied and the re-read reconciles satisfied
partially_applied  at least one applied/verified AND at least one failed
failed             all operations failed (or the last remaining op failed)
```

- Lifecycle is explicit: no operation runs without a ChangeSet carrying it,
  and statuses only move forward except `failed`, which is terminal.

## 9. C0-8 — Receipts, re-read verification, idempotency

```text
schema   oi.config-receipt/v1
```

```json
{
  "schema": "oi.config-receipt/v1",
  "receipt_id": "<owner-minted, unique per owner>",
  "owner_ref": "ai-kit",
  "changeset_id": "cs-01JABC...",
  "plan_digest": "<sha256 or null>",
  "setting_ref": "ai-kit:resolution:model.default",
  "scope": { "scope_kind": "project", "scope_ref": "epilogos/o-i" },
  "operation": "apply",
  "outcome": "applied",
  "applied_at_unix_ms": 0,
  "native_ref": "<owner-native receipt/history ref>",
  "expected_effect": { "kind": "session-restart-required", "summary": null, "ref": null },
  "original_receipt_id": null,
  "error": null
}
```

- **Receipt identity.** `receipt_id` is minted by the owner and unique
  within the owner. O:I stores only the reference plus the fields above; the
  owner's own history remains the record of record (`native_ref`).
- **Re-read verification.** After apply, O:I re-reads the owner's
  `system --json` v2 reading and records `verification` on the ChangeSet:
  the reading digest (07 §4.5 convention) and the per-setting reconciliation
  status (§7.1). Verification is evidence, not a promise: `pending` effects
  (e.g. restart-required) may legitimately reconcile later.
- **Idempotency contract.** The idempotency key is
  `(owner_ref, changeset_id, setting_ref, scope, plan_digest)`. Re-submitting
  an executed key MUST return outcome `no_op` with `original_receipt_id`
  pointing at the original receipt — the owner must not re-execute, and O:I
  must not re-plan. Enforcement is owner-side (C3 lanes prove it); the
  contract and fixtures are frozen here
  (`changeset-idempotent-replay.json`).

## 10. External native edits

Native CLIs and native configuration remain first-class. An edit made
through `aikit`, `ctrl`, `workcell`, … is not corruption of an O:I model —
O:I holds no model to corrupt, only desired intent and reconciliation state.
On the next native read, the new v2 axes reach reconciliation and the
setting becomes `satisfied`/`drifted`/… explicitly. O:I never silently
rewrites an externally changed owner to restore a profile: reconciliation
and apply are explicit operations under authority (#299 §7).

## 11. C0-9 — Expected-effect vocabulary

```text
effect.kind := none | value-change | restart-required |
               session-restart-required | provider-reconnect-required |
               material-effect | pending | unknown
```

Relation to the v2 axes: a contribution's `effect` declares what *applying a
change to this setting will do*. The v2 `staged`/`expected_effect` axes
report what the *owner currently has staged*. They are different facts about
different moments; after a plan is applied the owner's staged axes should
reflect reality, but O:I never writes them. The doctor distinctions
(#299 §12 — pending/restart-required vs ordinary degradation) key off
`effect.kind` and reconciliation `pending`/`blocked`, never off guesses.

## 12. C0-10 — O:I profiles: representation, persistence, ground relation

An O:I profile is a **sparse composition of desired relations** — never a
serialised snapshot of six native configuration trees.

```text
schema        oi.profile/v1
persistence   $OI_HOME/profiles/<profile_ref>.json
              (XDG default: ~/.config/oi/profiles/<profile_ref>.json)
active mark   composition.json `active_profile` field, written only by the
              explicit `oi profile use` operation — never inferred
```

```json
{
  "schema": "oi.profile/v1",
  "profile_ref": "development",
  "title": "Development world",
  "description": "Sparse intent for the development world.",
  "created_at_unix_ms": 0,
  "revised_at_unix_ms": 0,
  "native_profiles": [
    { "owner_ref": "ai-kit", "native_profile_ref": "coding" }
  ],
  "desired": [
    { "setting_ref": "ai-kit:resolution:session.provider",
      "scope": { "scope_kind": "world", "scope_ref": null },
      "value": "herdr",
      "secret_reference": null }
  ],
  "provenance": { "authored_by": "human", "notes_ref": null }
}
```

Frozen laws:

- **Location.** Profiles are O:I composition state and live in the O:I
  application-config home beside `composition.json` — *not* in Central.
  Central/Control is human-authored ground; generated profile state must
  never become authored Central source, and profile mutation never uses the
  Central proposal/acceptance path (that path is for authored ground — C3A
  preserves it for Central's own settings). A profile may *reference*
  Central/project context through scopes; it never embeds it.
- **Sparse.** Only deliberate overrides appear. Absence of an entry means
  "no O:I intent", never "use this value".
- **Native profiles by reference.** `native_profiles[]` carries the owner's
  own profile identity (`native_profile_ref`) opaquely. O:I never copies
  native profile internals (§8 forbidden class) and never needs to parse
  them.
- **Resolution order (frozen).** native authored/default state → selected
  native product profile → active O:I World profile → Project/session-scoped
  O:I override → explicit invocation override → owner-native resolution.
  Within one owner, the native profile is applied first, then that profile's
  sparse overrides at their declared scopes. The owner still determines its
  own effective result.
- **Secrets.** A profile never captures credential material. A desired
  entry for a secret-kind setting carries `secret_reference` (§13) and never
  a `value`.
- **No volatile state.** Observed machine/process/provider facts never
  enter a profile merely because a System reading showed them.
- **Portability.** Export is the same `oi.profile/v1` document; machine- or
  world-specific references (native profile refs, scope refs) travel as
  references and may be rebinding targets on import. Import must not be a
  hidden apply: imported profiles become inspectable desired state; a
  ChangeSet is planned separately.
- **File safety.** Regular files only (no symlinks), 0600, size-capped, and
  written through atomic publish with the same discipline as
  `composition.json`. (C2 implements; the law is frozen here.)

## 13. C0-11 — Native product-profile reference semantics

- `native_profile_ref` is an opaque string in the owner's namespace. O:I
  compares, displays, plans and routes it; it never interprets its internals.
- Switching O:I profiles passes native-profile references to the owner's
  plan/apply as references; the owner resolves them natively.
- **Activation is an ordinary ChangeSet** (C0-11 disposition, returned by
  the post-Gate-A fan-out). A `native_profiles[]` reference becomes
  operative only through the owner's own native operations: the owner
  contributes a writable setting whose value carries the native profile
  selection, so a profile switch plans a normal ChangeSet over that setting
  — plan/apply/receipt/re-read like any other change. The explicit
  `oi profile use` mark (§12) moves no native state; no side channel
  exists, and none may be invented.
- A profile holding both a `native_profiles` entry and sparse overrides for
  the same owner is normal and ordered by §12's resolution order.
- The owner's disclosure (`system --json`) remains the only evidence of what
  a native profile actually resolved to; O:I never mirrors the expansion.

## 14. C0-12 — Secrets and redaction law

Carrying forward 07 §4.4 (credential material is presence-only), the
configuration plane freezes:

- **Representation.** Secret-kind values are represented **only** as

  ```json
  { "secret_reference": { "ref": "aikit:credentials:anthropic-key", "present": true } }
  ```

  where `ref` is a stable reference in the owner's namespace and `present`
  is the owner's disclosed presence fact. O:I-owned documents (profiles,
  ChangeSets, receipts, resolutions) may carry the `ref`; `present` is
  observed-only and is never stored as desired state. The JSON key `value`
  MUST be absent for secret-kind settings in every O:I-owned document.
- **Owner-native mutation.** Where a product owns a credential, the
  credential is set through that product's own native mechanism. The
  configuration plane mutates the *reference* (e.g. which provider ref a
  setting points at), never the material.
- **No plaintext anywhere.** No plaintext secret in profiles, ChangeSets,
  receipts, logs, exports or redaction-safe JSON output. Validation rejects
  an O:I-owned document that carries a `value` for a secret-kind setting.
- **Generic treatment.** CLI/Desktop/Agent surfaces render presence plus the
  owner operation; they never learn the value.
- Conformance fixture: `secret-redaction-cases.json` proves every O:I-owned
  document type survives the redaction validator with no material present.

## 15. C0-13 — Versioning, deprecation, unknown fields

- Every configuration-plane document carries `schema: "<name>/v<major>"`.
  Same major ⇒ additive evolution only; consumers MUST accept unknown fields
  (no `deny_unknown_fields` semantics anywhere in the plane) and MUST NOT
  drop settings whose fields they do not understand.
- Adding an enum value, a scope kind, a value-schema kind or an optional
  field is a minor revision (bump `contract_revision`, extend the JSON
  Schema); removing/renaming a field or changing a meaning is a major
  version with an explicit migration note in this document.
- Field-level deprecation is marked `deprecated: true` in the schema plus a
  note here; deprecated fields keep working until the next major.
- An unknown *major* version is an explicit `unsupported_schema` error —
  never silent reinterpretation, never silent dropping.
- Pass-through duty: documents that relay owner documents (mounts, readings)
  relay them as opaque values, unmodified, exactly as the Wave-5 mount does.

## 16. C0-14 — Conformance fixtures

Machine-readable fixtures live at `suite/configuration/` and are the frozen
behaviour examples for every lane. They are plain JSON so the Rust CLI, the
Desktop and owner repositories consume the same bytes.

| fixture | freezes |
|---|---|
| `cases/contribution-ai-kit.json` | product owner: scalar/boolean/number/enum/path/reference/table/secret settings; several real scopes; effect kinds |
| `cases/contribution-oi.json` | the `oi` composition owner as a contribution |
| `cases/contribution-connector-fixture.json` | connector-owner mechanism shape (explicitly a fixture; invents no Factory↔Actuation semantics) |
| `cases/contribution-unavailable.json` | absent/degraded owner: honest availability, obligations, no fabricated settings |
| `cases/profile-development.json` | sparse profile with native-profile refs + overrides incl. a secret reference |
| `cases/resolution-cases.json` | all six reconciliation statuses with their exact preconditions |
| `cases/scope-cases.json` | supported and unsupported scope addressing with expected error codes |
| `cases/changeset-simple-apply.json` | plan → apply → receipt → re-read → verified lifecycle |
| `cases/changeset-partial-apply.json` | two owners, one failure: truthful `partially_applied`, per-operation receipts, no rollback claim |
| `cases/changeset-idempotent-replay.json` | replay under the idempotency key returns `no_op` + original receipt |
| `cases/secret-redaction-cases.json` | redaction law over every O:I-owned document type |
| `README.md` | how lanes consume the fixtures |

The contract tests (`cli/tests/configuration_contracts.rs` +
`oi_cli::configuration` validation) load every fixture, parse it into the
frozen types, and enforce the frozen laws, including: ref grammar
accept/reject, unsupported-scope errors, secret redaction across document
types, ChangeSet status derivation, idempotent replay semantics, partial-apply
truthfulness, unknown-field tolerance, and read/operability plane separation.

## 17. C0-15 — Compatibility with the existing v2 disclosure plane

- The v2 plane is unchanged: `system --json` remains read-only native
  evidence; its axes, digest convention, availability laws and consumer seam
  (07, 08) keep their standing. The `oi` position in the mount continues to
  be O:I's constitutional census reading.
- Structural identity mapping (§3) makes `setting_ref` ↔ v2 section/key
  resolution exact, so reconciliation can always find the native axes for a
  contributed setting.
- An owner may ship either plane alone. Contribution without disclosure ⇒
  reconciliation is `unknown` (no native axes to compare) and mutation may
  still work; disclosure without contribution ⇒ the setting is visible and
  honest in System but not addressable through the configuration plane. No
  plane infers the other's content.
- `desired` never appears in a v2 document; `declared/effective/active`
  never appear in a contribution document.
- The owner set is shared: `product_id`s are the seven mount positions; a
  connector owner appears only in the configuration plane until/unless the
  disclosure plane grows one (out of scope here). For a connector owner
  this is the standing case — a known boundary, not a gap
  (C0-15 disposition, returned by the post-Gate-A fan-out): reconciliation
  stays `unknown` (§7.1) with the owner receipt referenced as the
  reconciliation's `detail_ref`, which is the proof an applied connector
  change really happened, until a connector disclosure mount supplies
  native axes.

## 18. C0-16 — The architecture amendment

The Wave-5 boundary is superseded/narrowed at `07 §7` in place. The amended
text carries the superseding storage law of §0.1, keeps the still-true
prohibitions (no duplicate Action catalogue, no duplicate provider registry,
no renderer-owned business logic), and names this document as the governing
contract. Native ownership is not weakened anywhere: the owner remains the
sole semantic authority for its settings, its validation, its effects and
its receipts.

## 19. What C0 implemented (and nothing more)

- `schemas/oi.configuration-contribution-v1.schema.json`,
  `oi.config-resolution-v1.schema.json`, `oi.config-changeset-v1.schema.json`,
  `oi.config-receipt-v1.schema.json`, `oi.config-validation-v1.schema.json`,
  `oi.config-plan-v1.schema.json`, `oi.config-error-v1.schema.json`,
  `oi.profile-v1.schema.json` — draft 2020-12.
- `cli/src/configuration/` — grammar, document types, redaction and
  reconciliation validation, profile validation; no commands, no kernel, no
  persistence engine.
- `suite/configuration/` — the fixtures of §16.
- `cli/tests/configuration_contracts.rs` — the contract tests.

Everything else (C1–C7) begins from this document, the schemas and the
fixtures, and does not re-decide them.
