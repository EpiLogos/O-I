# JS-era q1/q2/q3 group (Quaternal-Logic) — quarry paragraph before group delete

Branches: `agent/q1-deterministic-kernel`, `agent/q2-mef-registry`,
`agent/q2-mef-registry-candidate`, `agent/q2-mef-registry-final`,
`agent/q3-provider-service-transport` (all 2026-08-14, JS `src/` layout
removed by the Rust rewrite). Per the N5 table's note 3, this paragraph
records what the group uniquely states before deletion (S-PRODUCTS).

## The durable statement: schemas/v1 as clearest statement of MEF intent

The JS-era branches document the original MEF square/refraction contracts in
schema form. On `agent/q2-mef-registry` @ tip the schema
`schemas/v1/contracts.schema.json` (and siblings on the candidate/final
variants) define the q2 contract surface: squares A/B/C with lookup
contracts, QLTarget, provenance classes, refraction/result envelopes. If any
QL semantic is ever unclear in the Rust code (`crates/ql-mef`), these schemas
are the clearest statement of original intent — read them from this receipt's
branch tips until GitHub GC:

- `agent/q1-deterministic-kernel` — minimal deterministic QL kernel: src/
  operators, registry, provider, address + q1 fixtures (q1 semantics
  re-derived in `crates/ql-core`: deterministic kernel, no semantic inference,
  no Loop Runtime dependency).
- `agent/q2-mef-registry{,-candidate,-final}` — MEF manifold registry:
  squares A/B/C, lookup contracts, QLTarget, provenance classes, refraction
  contracts (re-derived in `crates/ql-mef`: identity-preserving refraction,
  MEF_REGISTRY_VERSION grammar).
- `agent/q3-provider-service-transport` — provider inspection + capability
  negotiation + service result envelope (re-derived in `crates/ql-service`).

The Rust crates are the evolved operative form; the JS group is pre-rewrite
intent, not missing code. Deleted after this record.
