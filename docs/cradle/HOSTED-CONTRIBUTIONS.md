# Compiled contributions and portable presentations

This implements the hosted-surface boundary in
[`OI-DESKTOP-P1-HOST-INTEGRATION-CONTRACT.md`](../OI-DESKTOP-P1-HOST-INTEGRATION-CONTRACT.md).
A contribution describes reviewed local source. A world presentation describes
portable data. Neither registration grants Action authority or executes code.

## Native source contributions

The canonical contract is
[`oi.native-source-contribution-v1.schema.json`](../../schemas/oi.native-source-contribution-v1.schema.json).
Factory's conformant manifest is
[`contribution.json`](../../desktop/cradle/src/contributions/factory/contribution.json).
Its original capture provenance remains under `source_capture`; that history
does not become an executable path or grant authority.

Each manifest declares its stable contribution ref, owner, positive revision,
relative source entry, SHA-256 of that entry, and surface descriptors. Each
descriptor names a stable descriptor ref, kind, title, exported mount component,
canvas region and mounted retention. The entry is a local `.ts`/`.tsx` file
inside the manifest directory. Traversal, source escape, digest mismatch,
duplicate kinds/refs and undeclared fields are refused.

```sh
oi contribution validate desktop/cradle/src/contributions/factory/contribution.json
oi contribution register desktop/cradle/src/contributions/factory/contribution.json
oi contribution show oi.contribution/factory
oi contribution list
```

Registration writes validated data into the O:I state directory under
`hosted/contribution` (`OI_HOME` overrides that directory). It reports
`requires-reviewed-rebuild`: this does **not** mount a contribution. Re-registering
the same document is idempotent; changes require a strictly newer revision.
Concurrent writers serialize the revision comparison and atomic publication.
Readback checks the record's document digest and identity.

Owner-reviewed promotion compiles source into the desktop. From the repository
root, regenerate both tracked tables using the candidate `oi` executable:

```sh
oi contribution compile-registry --root desktop/cradle/src/contributions \
  desktop/cradle/src/contributions/core/contribution.json \
  desktop/cradle/src/contributions/factory/contribution.json \
  desktop/cradle/src/contributions/automations/contribution.json \
  > desktop/cradle/src/contributions/generated.ts
oi contribution compile-registry --root desktop/cradle/src/contributions --metadata \
  desktop/cradle/src/contributions/core/contribution.json \
  desktop/cradle/src/contributions/factory/contribution.json \
  desktop/cradle/src/contributions/automations/contribution.json \
  > desktop/cradle/src/contributions/registered-kinds.mjs
```

Review the changed source, updated entry digest and generated literal imports
together, then run native contract tests and the cradle gates. Typechecking
verifies that the declared exports actually exist. Entry digests pin the adapter;
review and the repository commit retain responsibility for its imported source.
The native generator does not treat a digest as whole-module trust.

`HostedSurfaceDescriptor` is presentation metadata. `SurfacePresentationBinding`
holds the viewer-local binding ID and optional provider descriptor identity;
the existing `SurfaceBinding.ref` still names the native subject. The compiled
registry creates lazy components once, at module initialization. Mode stage
keys and retained pane keys remain unchanged, so hiding a surface does not
move its DOM, reload its iframe, or lose its editor state.

Older bindings gain the known descriptor identity when restored. A saved
binding whose descriptor is absent remains in the arrangement and presents an
unavailable message. Its subject ref is retained; another provider is never
substituted. Runtime registration cannot change the compiled mount table.
Adding a hosted kind requires manifest admission, reviewed registry generation
and a new build; it requires no closed TypeScript kind union edit.

## Portable world presentations

The canonical schema now lives at
[`oi.world-presentation-v1.schema.json`](../../schemas/oi.world-presentation-v1.schema.json).
The former `shared-field/presentation-schema-v1.json` is a compatibility `$ref`.
The existing shared-field authoring functions normalize optional defaults into
the complete wire document; the native validator checks that complete document.

```sh
oi presentation validate presentation.json
oi presentation register presentation.json
oi presentation show presentation:my-world
oi presentation list
```

The native registry preserves the exact accepted document under
`hosted/presentation`, with the same revision and integrity rules. `registered-data`
means data registration, not publication into a SharedField or authority to
invoke an Action. Publishing still follows the existing owner operation.
Desktop Explore's `WorldPresentationView` accepts the returned payload through
its existing projection path. Only the client's compiled renderer set is used;
an unavailable renderer shows the document's explicit fallback. No module URL
or executable from the data is imported.

## Product command registration

`surfaces.json` remains the CLI's bootstrap catalogue. An adopted live catalogue
is read by `catalog_source`; native `current-world` exposes each descriptor's
canonical namespace. The desktop composition adapter derives owner service
commands from that native reading. It does not maintain a second namespace
table or parse a separate copy of the catalogue. Missing executables remain
named native failures, not empty successful service registrations.

## Verification

`cargo test --manifest-path cli/Cargo.toml --test hosted_contracts` exercises
the real candidate CLI: Factory admission, refused altered source, generated
table byte equality, immutable/concurrent registration, adopted catalogue
namespace propagation through the actual desktop kernel adapter, and portable
presentation readback rendered by the production desktop Explore component.
No installed O:I registry is changed. The last test requires the cradle's
existing Node dependencies for its bounded renderer bundle.

`desktop/cradle/tests/hosted-contributions.test.mjs` exercises the production
layout/restore/mode/retention functions and stable compiled mount identities.
Native app walking remains the evidence for visual appearance, retained live
engine behavior and interaction; server rendering is not visual acceptance.
