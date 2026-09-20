# Public Library receiving integration — 2026-09-19

Owner: O:I #65, publication/promotion coordination #220; existing site PR #400.
Branch: `site/library-first-public-expressions-20260919`, verified successor of
`site/redesign-v2`. The approved hero, its editorial construction and lower-page
video are retained. This work uses connected GitHub/CI, not another Mac checkout.
C0–C5, native matrices, historical receipts and the DAY/NOW gate are unchanged.

## What this change does

The common Library now receives native public subject and collection refs before
its explicitly labelled site-authored accounts. `publication-model.mjs` delegates
identity, discovery, membership and graph relations to `createExploreSurfaceModel`.
The receiver does not create a Wiki, scene store, catalogue identity or a second
graph. `wiki.contains` and native Wiki-reading binding refs determine membership;
titles and product slogans never infer it.

Read-first navigation is `site → Library/collection → native subject → Expression
→ published graph/source depth → same subject and paragraph`. The source Projection
ref/revision, Expression ref/revision, Expression Projection ref/revision and Scene
are separate URL fields. Reading paragraph and within-paragraph offset are URL state,
so refresh and back/forward do not depend on a local daemon or a session key.
`library.html?ref=<native-ref>` remains a supported native direct entry. Unknown
subjects, absent revisions and incompatible Scenes do not silently resolve to a
replacement. A detached native source edition leaves the original reader intact.

The actual accepted `NativeStage` and instrument engine render an admitted native
Expression. No Point-Cloud-Demo app, `oi.journey` scene store or author machine has
been copied into the website. The browser admits the existing native renderer only;
unknown native bodies fail public admission pending a reviewed browser-safe adapter.
Field interaction is not a live subscription. Published image/video fallbacks stay
labelled frozen representations. Arbitrary embedded HTML is not executed.

## Producer input and public-output boundary

Run the native producer first, outside the site's public directory. The receiver
accepts the existing `oi.world-publication/v1`, `oi.expression-publication/v1` and
`oi.explore-browser-seed/v1` outputs; not raw Central readings or `oi.journey` files.
Supply explicitly selected producer output files using a JSON array:

```sh
cd site
OI_LIBRARY_PUBLICATIONS='["/path/to/native-world/bundle.json","/path/to/native-expression/bundle.json"]' npm run build:public
```

This is a local build example, not a claim that those paths or outputs exist. CI
must acquire real revision-pinned producer outputs through the owning publication
pipeline; it must not fetch them from an author's laptop. No source crawling or
human-maintained list of corpus entries is introduced. Source selection and
publication authority remain native responsibilities.

Without supplied outputs the existing empty public seed produces an empty native
Library with an explicit unavailable message. Invalid configured inputs fail the
build, not fall back to samples. Fixture modules live under `site/tests/`, and the
browser contract tests intercept requests; fixtures are never copied into `dist`.

Before any browser JSON, search row, preview or standalone edition is written:
private/withdrawn Projections are discarded; private membership and relations are
excluded; public bindings are schema-checked; undisclosed/unsupported bodies,
protected refs and local/credential-bearing asset routes are refused. Public
listing text comes from the admitted Projection, not arbitrary source search-row
metadata. Local omission reports, raw readings, Actions, context and private
metadata are not copied. Existing public-dir seed files must stay empty; raw
producer inputs belong outside `public/`, because Vite copies that directory.

The build emits the native Explore seed, native `oi.world-edition-manifest/v1`
records, and native standalone HTML/Projection files. Transport directories are
hashes of the existing Projection ref/revision, not new semantic identities.
Manifest digests identify emitted bytes, not authorship, permission or confidentiality.
The receiving build currently carries the admitted edition, not a revision archive;
a removed historical revision is explicitly unavailable rather than relabelled latest.

## Current source and installation grounding

Founding position: `docs/positions/FOUNDING-POSITIONS.md` (human-authored ground
upstream of architecture; heterogeneous Worlds; authored/observed/generated
material kept distinct; implementation standing is not philosophical proof).
The current essay master is a section index, not the older complete prose snapshot.
The selected current §5 source is
`Antykathera-Essay-Work/submission-package/essay/section-rooms/06-objective-internality/ROOM.md`,
blob `1bdea0c253184fa67150d83d3741599a91d9a279`, with its six native movement sources.
Its six offices are meaningful continuity, living articulation, potency,
transformation, situated existence and Transcendent Relation. They are a constructed
paradigm within Objective Internality, not a mandatory definition of every World.
Do not relabel the old `e3aee553` site source basis as the current complete essay.

Install/setup links use the inspected accepted O:I instructions at
`0b3583be80868bcc3edfb4a449ae17010f0bbd74`: `docs/INSTALL.md` and
`docs/INSTALL-UPDATE-FLOW.md`. Human disclosure distinguishes historical release
artifacts from current source installation, the prerequisite for a current Central
ground, supported prebuilt targets, scoped/check/apply/update/rollback conditions,
and an intended registry command from a verified registry publication. No private
machine receipts or percentage-complete score enter the public page.

## Producer and hosting dependencies — not completion claims

The existing public seed is empty. Essay PR #70's E0 return records 52 sandbox
`oi.journey` artifacts / 473 Scenes at census `dbf3b17`, with native O:I Pass-B
runtime proving, T26 reconciliation and owner recognition outstanding. Those are
not treated as native published Expressions. The source receipt also records a
163/288 stale-hash issue for the earlier census receipt; the producer owns its
reconciliation. A current canonical essay source and a sandbox corpus are not by
themselves an admitted public edition.

Still required for real corpus acceptance: Track 3's eligible native subject refs,
collection membership, source bodies, matching Expression/Projection revisions,
publication-approved assets and browser-safe Technè/body outputs. Native Wiki
reference-card metadata is explicitly not represented as the full source text.
The receiver exposes the declared Explore neighbourhood; it does not pretend to
supply a complete Technè instrument from an uninspected desktop bridge.

Hosted success requires the actual website deployment plus real admitted producer
outputs and an end-to-end route on that public host. This branch's preview workflow
builds and tests only; a green build or localhost browser test is not deployed
publication. Record the actual run/commit and deployed endpoint separately. Do not
promote #65/#220 or remove native-owner dependencies on this receipt alone.
