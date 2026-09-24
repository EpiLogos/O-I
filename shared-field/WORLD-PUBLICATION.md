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
| `central-wiki-projection.mjs` | readings + selection → publication bundle; `hostedPublicationArgs`; `exploreSeedFromPublication`; `reprojectCentralWikiWorld`; `publicationSentinelLeaks`; `worldPublicationLeaks` |
| `world-edition.mjs` | standalone edition HTML + manifest, rendered only from the Projection |
| `scripts/publish-world.mjs` | local step: `--selection`, `--reading`/`--from-ctrl` (wiki, Positions, population, constellations), `--sentinel`, `--out` |
| `expression-projection.mjs` | one Expression → Projection; World relations to a hosted Position / constellation |
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

## The inhabited World in the same bundle

The same selection, the same bundle and the same Projection lineage carry the
World's Positions, their occupancy and current work, and its constellations —
each only when the selection names it. There is no second script and no second
Projection.

```text
central.position.list {project}              central.position-listing/v1   Central: the Position definitions
aikit gateway who --project-world P --json   aikit.population-reading/v1   AIKit: occupancy (Actuation) + current work (Factory), joined
aikit wiki-construct inspect --file W <ref>  aikit.constellation/v1        AIKit: one constructive WikiFrame with its participations
```

`publish-world.mjs --from-ctrl` runs these when the selection needs them (the
Position listing when any Position is selected, the population when any is in
`occupancy` mode, one inspect per selected constellation against each wiki
register `central.world.here` discloses). The same documents may be passed as
`--reading` files; each is recognised by its schema, bare or inside its
owner's `--json` envelope. O:I never reads Actuation or Factory itself — AIKit
is their joiner — and never reads AIKit's files.

```json
{
  "positions": {
    "central:position:project:O-I:anima-4": "occupancy",
    "central:position:project:O-I:aletheia-5": "address"
  },
  "constellations": ["wiki:frame:…"]
}
```

| Selected | Entry | Relations |
|---|---|---|
| Position, `address` | `world-position` at `<world>/<position_ref>`; `meta.local_ref`, `role_ref`, `handle`, `label` | `oi.world/position` World → Position (origin `projection`) |
| Position, `occupancy` | the same, plus `meta.occupancy {state, generation_ordinal, workcell_ref, observed_via?}`, `meta.current_work {outcome}`, `meta.communiques {undelivered}` | as above; plus `oi.world/works-on` Position → entry when current work is exactly one custody whose `work_ref` is a selected wiki node or constellation (provenance names the custody ref) |
| constellation | `constellation` at `<world>/<frame_ref>`; title, revision, participation count | `oi.world/constellation` World → constellation (origin `projection`); `aikit.constellation/participation` constellation → each participating wiki node that is itself selected (origin `aikit-knowledge`) |

The presentation gains a `positions` region and a `constellations` region of
reference cards. Occupancy lives in entry meta, never in generation-specific
entries or relations: the hosted field has no delete for Explore rows, so a
changing occupant updates one entry in place.

What never travels, whatever the selection says: `agent_session_ref`,
`session_space_ref`, gateway addresses and tokens, attention, Communique bodies,
a Position's `purpose` and `purpose_ref`, participation notes and sources, the
constellation's inquiry and its participation-to-participation edges, and any
`remotes` detail. Entries are built from allow-lists; then every outward
payload is scanned for the values of those protected keys found in the readings
and for session-ref, gateway-address and token shapes, and a bundle that would
carry any of them is refused whole. `publish-world.mjs` runs the same scan over
the edition HTML and manifest, in addition to the publisher's `--sentinel`s.
`observed_via` travels only as `local` or `gateway:<gateway_ref>`; a value that
looks like an address is withheld.

A World with Positions or constellations carries a composite source revision
(`oi.world-sources/v1:<digest>`) over every source it stands on — each wiki
reading, the selected Positions' definitions, the occupancy and custody this
publication carries, each selected constellation's revision — listed in the
bundle's `sources` and the World entry's provenance. So a new occupant
generation or a custody change is a source revision on re-projection
(`moved_sources` names which source moved), while a change in anything that is
never published (attention, an unselected Position, an `address`-mode
Position's occupant) moves nothing. A wiki-only publication keeps its subject
wiki revision exactly as before.

**AIKit follow-up.** `aikit wiki-construct inspect` is AIKit's read-only
constellation reading, but it takes `--file <wiki.json>`: the caller has to
compose the register's file path (O:I composes it from the roots
`central.world.here` discloses), and there is no read-only command that lists
the constructive frames a register holds. The AIKit read this lane needs is a
register-addressed `aikit wiki-construct list|inspect --project-world <W>`
(root when absent) emitting `aikit.constellation/v1` records; until it lands,
the selection names constellation refs the owner already knows.

## Technè: Expressions related to their World

`expression-projection.mjs` relates a shared Expression to the World it came
from. The Cradle's Share / Project passes the constellation the Expression was
constructed from (the frame reading every member's subject binding carries)
and — only when its own `aikit whoami` reading proves this body holds an
occupied Position — that Position. When the hosted field already holds either
as a World entry, the owner may place the Expression beside that World (in the
World's field, under the field's unchanged contract) and the publication
carries `oi.world/authored-by` (Expression → Position) and `oi.world/expresses`
(Expression → constellation). Relations never cross a field boundary; an
authoring ref the field does not host is named to the publisher as an omission
and never travels.

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
