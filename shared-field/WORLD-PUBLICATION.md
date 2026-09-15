# World publication — from a native authored world to the shared field

This note records how an authored world enters the shared field, as implemented
in this directory. It is an implementation note for the #18 Explore programme
and the #279 PW5 tranche; it introduces no new ontology.

## The relation

```text
native authored material            Markdown / HTML / document / curated asset / native object
        ↓ source binding
Central / ProjectCentral world      central.wiki.read · projectcentral.wiki.read  (central.wiki-reading/v1)
        ↓
WikiSpace / WikiNode / relations    okf-wiki/v1, read through the owner's Actions, never the filesystem
        ↓ deliberate composition    oi.central-wiki-selection/v1 — the owner names spaces, nodes, audience
WorldPresentation                   oi.world-presentation/v1
        ↓ explicit audience + publication decision
Projection                          oi.projection/v1  (oi.world-publication/v1 bundle)
        ├─ hosted representation    edition/index.html + projection.json + manifest.json
        └─ SpaceTimeDB shared state put_shared_field · put_participant · put_projection · put_explore_entry · put_explore_relation
                ↓
SharedField / Contribution / Encounter / Watch
```

A curated file can be source material for a WikiNode without becoming the
Wiki. A Wiki is persistent semantic topology; it is not a SharedField. A
Projection is a selected outward representation; it is not its source. Hosted
HTML is transport material; it is not a writable Wiki replica. The SharedField
is the relational environment around addressable objects; it acquires no source
ownership.

## Modules

| Module | Role |
|---|---|
| `central-wiki-projection.mjs` | readings + selection → publication bundle; `hostedPublicationArgs`; `exploreSeedFromPublication`; `reprojectCentralWikiWorld`; `publicationSentinelLeaks` |
| `world-edition.mjs` | standalone edition HTML + manifest, rendered only from the Projection |
| `scripts/publish-world.mjs` | local step: `--selection`, `--reading`/`--from-ctrl`, `--sentinel`, `--out` |
| `spacetimedb/publish-world.ts` | hosted push through the generated client; owner token outside the repo |
| `spacetimedb/two-world-live-acceptance.ts` | two independently grounded worlds meet, contribute, return, re-project |
| `aikit-contribution-field.mjs` | `aikit.composition-body/v1` → authoring contribution field |
| `native-action-binding.mjs` | authored `action_refs` → canonical Action through its owner's doorway |
| `scripts/native-action-live-acceptance.mjs` | one real Action (`projectcentral.now.return`) and the two Return authorities |

## Selection is the publication decision

```json
{
  "schema": "oi.central-wiki-selection/v1",
  "project": "O-I",
  "world_ref": "world:central:project:O-I",
  "subject_world_ref": "project:O-I",
  "field_ref": "oi:field:central:project:O-I",
  "projection_ref": "projection:central:project:O-I",
  "presentation_ref": "presentation:central:project:O-I",
  "title": "O-I — a ProjectCentral world",
  "audience": { "visibility": "public" },
  "publisher": { "participant_ref": "participant:central:owner", "identity_ref": "human:central:owner" },
  "spaces": { "central:wiki:root": "address", "central:wiki:project:O-I": "nodes" },
  "node_refs": ["wiki:node:project-root/o-i"],
  "disclose_source_refs": true
}
```

- A space selected as `address` is addressable (its title and its place in the
  topology) and nothing else: no nodes, no unselected children. The root
  Central WikiSpace is normally published this way, so a ProjectCentral world
  keeps its parent without the parent's contents.
- A space selected as `nodes` may contribute nodes, and only those listed in
  `node_refs`. Selecting a node outside a `nodes` space is refused.
- Relations survive only when both endpoints were selected. `node-source`
  relations never become Explore relations; source paths appear only as
  provenance, only when `disclose_source_refs` is true, and only for selected
  nodes.
- Hosted refs are qualified by the publication world
  (`world:central:project:O-I/central:wiki:root`). Every Central has a
  `central:wiki:root`; two independent worlds must never collide on one
  semantic ref. The local ref is kept in `meta.local_ref` and as an alias.
- Standing travels: a node whose sources are under `Control/user/`,
  `Control/relations/` or `ProjectCentral/user/` is `human-authored`; anything
  else is `agent-maintained`. Provenance kinds
  `human-authored-source` / `agent-maintained-source` keep them distinguishable.

The selection is the owner's authored publication decision. Its durable home is
the owner's ground (`ProjectCentral/user/…`), not this repository; the CI
fixture selection under `fixtures/` describes a Central-shaped fixture world,
never an owner's world.

## What must not leak

`publicationSentinelLeaks(payloads, sentinels)` scans every serialised outward
payload — bundle, projection, hosted reducer arguments, Explore seed, edition
HTML (including its embedded JSON), manifest and the structured agent reading.
`publish-world.mjs --sentinel` refuses to write a publication that leaks. The
unit test plants a human-authored identity node, a private journal node, a
private child space and a private source path, and proves all are absent from
all payloads and from Explore search, relations and neighbourhoods.

Digest ≠ authorship ≠ permission ≠ confidentiality: the manifest says so.

## Re-projection

`reprojectCentralWikiWorld(previous, { readings, selection })` keeps
projection_ref, presentation_ref and subject. If the native source revision
moved, the result is a source revision (`reviseProjection`: drift visible in
`source.revision` and `supersedes`). If it did not, the result is a
representation refinement (`refineWorldPresentationProjection`: source revision
copied verbatim). A browser edit of a Projection is always the second kind.

## Return authorities

The native-action acceptance binds `central:action:projectcentral.now.return`
on the projected page and invokes it through `ctrl --json action run`. The
owner writes the record into the project's NOW field; O:I represents the owner's
envelope as `oi.activity/v1` with the canonical `action_ref`. The same binding
then promotes that record into the Agent-maintained wiki with
`acceptance: agent-return`, and the owner refuses the identical promotion toward
human-authored ground with agent acceptance:

```text
return to Agent-maintained Wiki   (agent-return, accepted by the owner)
    ≠
proposal to human-authored source (requires human-accepted; refused otherwise)
```

## AIKit contribution field

Authoring consumes `aikit.composition-body/v1` — AIKit's resolved
Component/Contract/Contribution/Surface body (ADR 0004). Only contributions
AIKit projected onto a Surface become bindable; a recorded absence degrades its
contribution rather than dropping it; an `action-projection` keeps its canonical
Action ref. No `aikit` CLI command emits the body yet; that producer is pinned
as EpiLogos/ai-kit#313, and the browser reads the body from
`?composition_body=` or `VITE_OI_COMPOSITION_BODY_URL` until it lands.

## Hosting

See `spacetimedb/HOSTING.md`. The site's Explore connects to the database named
by the repository variables `OI_SPACETIMEDB_URI` / `OI_SPACETIMEDB_DATABASE`;
`hosting.json` names the targets; `deploy.sh` publishes the module; the owner's
login and the SDK owner token never enter the repository.

## Curated HTML artifacts (Lane C step 4)

`curated-html-projection.mjs` projects one authored artifact — a Flow instance
(the ratified `ql-doc` carrier under `Control/user/flows/`) or a Central
document — through the same seam: an explicit
`oi.curated-artifact-selection/v1` names the entries, the disclosable meta
(`document_id`, `title`, `created`, `template`, `revision` only), any withheld
collection the owner deliberately includes (journal/packet/notes/media stay
home by default) and the audience. The WorldPresentation renders only the
selection; the hosted edition is **rebuilt** from the Projection (no source
byte, no embedded carrier state, a script-forbidding CSP) — never the original
file with something hidden. The artifact is one Explore entry of kind
`curated-artifact`, related to its Wiki node through `node-source` (origin
`wiki` when the reading attests it, `projection` when the owner declares it);
it is not a Wiki page. `scripts/publish-artifact.mjs` is the local step;
`spacetimedb/field.sh publish` is the push. Admitted replies enter a later
revision only through the selection's `replies` (a refinement: the source
revision stays constant).
