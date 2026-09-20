# Proposal: `oi.package/v1` — one distributable package, many owned contributions

**Standing: proposal.** This document is authored for owner review under the
#65 SDK campaign's external-boundary round (`sdk:package`, EX04, EX05). It
composes two contracts that already exist and are load-bearing; it invents no
new contribution kind. Nothing here is implemented until the owner adopts it.

## What already exists (and is kept verbatim)

| Contract | Role today |
|---|---|
| `oi.native-source-contribution/v1` | one product's source contribution into the desktop host: entry, runtime exports, native view type, styles, per-file SHA-256 inventory, peer dependencies, authority statement, and its test census (component tests, CSS isolation, React externals). Precedent: `desktop/cradle/src/contributions/factory/contribution.json`. |
| `oi.configuration-contribution/v1` | one product's settings disclosure to the configuration plane, emitted by `<ns> config-contribution --json`, JSON-Schema'd at `schemas/oi.configuration-contribution-v1.schema.json`. |

Both are single-owner and single-contribution. What has no form today is the
unit a third party can hand the host: **one package, several contributions,
independently owned, with registration, compatibility, upgrade and uninstall
that the host can enforce** — the `sdk:package` obligation.

## The proposal

A package is a directory (or zip of it) with one manifest:

```jsonc
// oi.package.json — schema oi.package/v1
{
  "schema": "oi.package/v1",
  "id": "com.example.workbench",
  "version": "1.0.0",
  "owner": { "name": "Example Works", "provenance": "signed-url or repo ref" },
  "host_compatibility": { "cradle_contract": ">=7", "tested_host": "6539b266" },
  "contributions": [
    { "kind": "native-source-contribution",
      "manifest": "contributions/workbench-ui/contribution.json" },
    { "kind": "configuration-contribution",
      "document": "contributions/workbench-settings/contribution.json" }
  ],
  "files_sha256": { "…every file in the package…" },
  "authority": "one plain-language statement of what this package may touch",
  "trust": { "reviewed": false }
}
```

Law the host enforces:

1. **Contributions are the existing contracts, unmodified.** Each entry
   points at a manifest that must validate against its existing schema. A
   package introduces no second way to describe a page or a settings plane.
2. **Ownership stays per contribution.** Different `contributions[]` entries
   may carry different `owner` values in their own manifests; the package
   manifest's owner is the distributor, not a claim over member contributions.
3. **Hashes are whole-package.** `files_sha256` covers every file, and each
   source contribution keeps its own per-file inventory; the host verifies
   both at install and at load.
4. **Trust is explicit.** An unreviewed package renders its presence (the
   configuration plane already degrades on unknown kinds — same posture) but
   its active content never loads until `trust.reviewed` is recorded, the
   same gate AIKit capsules use.
5. **Compatibility is declared against host contract revisions**, not dates;
   a host above the declared line discloses the mismatch and refuses active
   load rather than improvising.
6. **Install/upgrade/uninstall touch only package-owned paths.** Upgrade
   replaces hashed files atomically and runs the new manifest's tests claim
   (typecheck/isolation) before activation; uninstall removes exactly the
   installed inventory and records what was retained — user data, user
   settings, and any foreign file the package found are named, never
   silently deleted. Degraded uninstall names its consequence, per EX05.

## The specimen

`docs/proposals/oi-package-v1/specimen/` is test material: a minimal package
carrying one source contribution (two files, real hashes) and one
configuration-contribution document in the existing schema's shape. It exists
so that whichever host implements the loader has an honest fixture that was
written before the loader, not after it.

## What this proposal does not do

- It does not implement a loader, registry or marketplace.
- It does not change either existing contract.
- It does not authorize experimental packages to activate globally; adoption,
  then the host's own install surface, are the owner's decisions.
