# Configuration-plane conformance fixtures

The frozen behaviour examples for the O:I configuration plane
(`docs/cradle/09-CONFIGURATION-PLANE.md`, #299 Gate A / C0). Every lane —
C1 kernel, C2 profiles, C3 owner lanes, C4 connectors, C5 CLI, C6 Desktop,
C7 conformance — consumes these same bytes; no lane re-decides the contract
they demonstrate.

## Shape

Each file under `cases/` is a self-describing JSON case:

```json
{ "fixture": "<name>", "kind": "<case-kind>", "...": "kind-specific" }
```

Case kinds: `contribution`, `profile`, `resolution-cases`, `scope-cases`,
`changeset`, `secret-redaction`.

## What each fixture freezes

| fixture | freezes |
|---|---|
| `contribution-ai-kit.json` | a product owner contributing scalar / boolean / number / enum / path / reference / table / secret settings across several real scopes, with effect kinds and both constant and computed defaults |
| `contribution-oi.json` | the `oi` composition layer as a configuration owner |
| `contribution-connector-fixture.json` | the connector-owner mechanism shape — explicitly a fixture; it invents no Factory↔Actuation semantics (#299 §9) |
| `contribution-unavailable.json` | an absent owner: honest `availability`, named obligations, empty sections as proof (L3), nothing fabricated |
| `profile-development.json` | a sparse profile: native-profile references, world- and project-scoped overrides, a secret reference (never a value) |
| `resolution-cases.json` | all six reconciliation statuses with their exact preconditions |
| `scope-cases.json` | supported and unsupported scope addressing, with the frozen error codes |
| `changeset-simple-apply.json` | plan → apply → receipt → re-read → `verified` lifecycle |
| `changeset-partial-apply.json` | two owners, one failure: truthful `partially_applied`, per-operation receipts, no rollback claim |
| `changeset-idempotent-replay.json` | replay under the idempotency key returns `no_op` with the original receipt |
| `secret-redaction-cases.json` | the redaction law across every O:I-owned document type, plus a violating example that validation MUST reject |

## How they are enforced

`cli/tests/configuration_contracts.rs` loads every fixture, parses each
document into `oi_cli::configuration` types, and enforces the frozen laws.
The JSON Schemas in `schemas/oi.configuration-*.schema.json`,
`oi.config-*.schema.json` and `oi.profile-v1.schema.json` are the wire
statements of the same contract.
