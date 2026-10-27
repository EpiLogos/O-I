# The shared experiential Document Surface

Commissioned 2026-09-25 (local lane of the Agent praxis + documentation +
experiential document world programme; Wayfinder
`.wayfinder/maps/agent-praxis-document-world.md` §11–§14, work packages
W6/W7/W8). This file records the current-cut owner ledger (W0) and the one
small host contract this lane adds (W6). It is implementation documentation,
not a claim that every family already uses every part.

## The current-cut owner ledger (what already runs)

One Central-owned spine, no second document store:

    SurfaceBinding (kind "file", ref, location, title)
      → FileSurface (files/FileSurface.tsx)  detects format from extension
          text        → CodeMirror editor, CAS save, history/recovery
          html/md/…   → MaterialSurface (material/MaterialSurface.tsx)
      → MaterialSurface: sandboxed opaque-origin iframe
          (`oi-material://` under Tauri; srcDoc + injected <base> on the
          walk bridge), `context/page-context.js` injected for selection,
          `data-file-revision` / `data-generation` stamped, continuity law
          (remount only on committed replacement; suspension is disclosure).
      → Save: `file_operation {write, expected_revision}` → created |
        written | unchanged | conflict (current reading returned).
        Drafts live in localStorage (`oi-cradle.draft.v1:<ref>`);
        history / recovery_preview / restore are native owner operations.
      → Reads: the shared resource broker (files/resources.ts) — one
        owner round trip per subject per epoch, generation-invalidated,
        receipt-driven (`file_changed`).
      → Personal pages: `oi.page/v1` (personal/page.mjs) — meta
        (documentId, revision, family, template, sourceMode), bindings
        (worldRef/subjectRef/expressionRef/sources), page (sections, links,
        expression), notes, extensions (unknown fields preserved).
        Families today: beings, things, goal, vision.
      → PageExpression (personal/PageExpression.tsx): the existing bounded
        host handshake (`oi:page-expression-host`) that admits a live
        Expression renderer for a page's exact identity+revisions.
      → Selection → context: page-context.js RPC (mode/take/selection/
        validate/mark) → `oi:context-candidate` → ContextTray validates
        (stale refusal) → prepared context in the AIKit encounter store
        (selected ≠ sent; explicit dispatch).
      → Receiving: Central's native receiving field per register; the
        Inbox (receiving/ReceivingTray.tsx) reads every register; review
        and inclusion are revision-checked owner operations; arrival never
        edits a document.
      → Creation in place (flow/createInPlace.ts): a form choice copies the
        template bytes through Central's file route and writes the copy —
        flows through Control's one ordinary create door
        (Control/user/flows/); goal/vision ask for the scope's human ground
        (Work/<project>/ProjectCentral/user/).

## The seams this lane found missing (W0 findings)

1. **Native Save for experiential documents.** In-page edits bump the
   embedded `ql-doc` revision but stay page-local ("Save an HTML copy to
   keep them; native source Save is separate"). There is no host relation
   that persists an edited payload through the owner.
2. **Human-ground saves.** Files under `ProjectCentral/` are participating
   sources (project-human-source-aperture). Ordinary file CAS refuses them;
   the native owner operation is `projectcentral.source.write` (CAS,
   declared-human callers only for aperture material). The desktop's file
   save path does not route there.
3. **No creation door for a project vision page.** An absent aperture file
   has no horizon basis, so `projectcentral.source.write` cannot create it,
   and ordinary creation is flows-only. "Write it" for a project with no
   vision page refuses honestly (createInPlace.ts). Central needs a bounded
   authored creation operation for absent human-ground documents.
4. **UI Mockup is not a document family.** The owner-intended template is
   the Central `ui-mockup-authoring` skill asset
   (`skills/ui-mockup-authoring/assets/ui-mockup-template.html`,
   Central main `b3c867d`, PR #225): state switcher, provenance block,
   five state sections with `data-design-ref`/`data-vision-ref`/
   `data-capability-ref`. The Cradle roster has no mockup entry and no
   placement law for created mockups.
5. **Document identity/family is implicit.** MaterialSurface knows HTML vs
   markdown; the ql-doc island (family, template lineage, documentId,
   revision) is parsed only for `oi.page/v1` personal pages.

## The host contract this lane adds

Small, underneath, through existing owners:

- **Identity** (`src/document/identity.ts`): parse the `ql-doc` data island
  of any rendered HTML document; classify family and template lineage;
  expose documentId + document revision beside the file revision. Unknown
  shapes classify as `unknown` — never fabricated.
- **Save** (`src/document/hostSave.ts`): one save router. Ordinary files
  save through the existing CAS file operation; participating sources save
  through `projectcentral.source.write` with the same expected_revision
  law. The payload saved is the page's own serialised data island; bytes
  outside the island are the template's, unchanged. Conflict is a real
  state, never an overwrite.
- **Bridge** (`src/context/document-host.js`, host-injected like
  page-context.js): reads the current data island and revision from the
  frame on the host's request, reports dirty state, and nothing else. The
  page gains no authority; the forms' own bytes are untouched.
- **Host bar** (MaterialSurface chrome): family, document identity,
  unsaved/native-save state, one native Save action. Portable export
  remains the page's own "Save HTML copy"; full-copy export stays labelled
  and distinct from any filtered projection.
- **Creation** (`projectcentral.source.create`, Central): creates one
  absent document in a project's human ground under the same discipline as
  the flows door — expected-absent, atomic no-overwrite admission, the
  parent must already exist, declared human attribution, owner lock, and
  the recorded change is the horizon's Added entry. The desktop's
  create-in-place consumes it for goal/vision/mockup; the refusal names the
  owner when the door is absent.
- **Placement law (created documents)**: vision
  `ProjectCentral/user/<project>.html` (one per project, existing rule);
  mockups `ProjectCentral/user/mockup-<slug>-<local-stamp>.html` — flat in
  the project's own human ground (no implicit directory creation), many per
  project. Created files join the horizon as
  project-human-source-aperture sources; every later revision goes through
  `projectcentral.source.write` CAS.

Day and Flow adopt identity + native Save through this same relation
without their designs or payloads changing (W8). Relations surface through
the existing Run/Agents/Context accompaniment; receiving binds to the open
document's source ref.
