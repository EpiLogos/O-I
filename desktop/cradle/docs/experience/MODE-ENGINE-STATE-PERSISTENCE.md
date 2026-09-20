# Mode-engine state persistence — spec and design (2026-09-19)

Status: commissioned design for implementation. Owner report: switching to
and from the Expressions and Technè engines loses their state — the engines
reboot instead of resuming.

<<<<<<< HEAD
LANDED 2026-09-20: the first pass (§1–6, per-mode persistent stage slots)
and the second pass (§7/§8) are both implemented on this branch. §7.1: the
park is retired — `SurfaceBody` mounts `ModeCentreBody` directly (a
stage-owned centre's own pane tab presents nothing; a foreign-tree centre
presents through its pane wrapper), and the warm-tree criterion counts
foreign-tree centres as a shelving reason. §7.2: the stage slots checkpoint
the hosted application's current expression ref onto the binding
(`SurfaceBinding.engine`, written debounced through
`workspace.surfaceEngine`, carried across restarts by the layout codec) and
the remounted application is deep-linked `?expression=<ref>` through its own
boot grammar. Technè's centre is the same hosted application in its deep
cut, so the same checkpoint covers it; the wiki-projection registers are
kernel-backed and needed no renderer checkpoint. Evidence:
`walk/artifacts/mode-engine-state.json` (26/26, three runs) and
`walk/artifacts/html-continuity.json` (7/7 identity checks; the
pending-origin/restart legs stand down at the documented pre-existing
navigator-listing stall, WORKSPACE-CONTINUITY-EXECUTION).

=======
>>>>>>> origin/main
## 1. Root cause (suspected, verify first)

The mode-centre retention park (`src/surface/retention.tsx`) keeps centre
bodies mounted, but PRESENTS them by **moving** the container: a presenting
`CentreOutlet` runs `outlet.appendChild(record.container)` and an unmounting
outlet moves it back into the park. Moving a DOM subtree that contains an
iframe detaches the iframe from the document, and a detached-and-reinserted
iframe **re-navigates** — measured and proven earlier in this track for pane
surfaces (the same defect, fixed there by the warm-tree shelf: never move the
DOM, flip visibility).

So each mode round trip (Expressions → anything → Expressions) reboots the
vendored Expressions application: its in-memory state — the current
expression, camera, scene edits — resets. Technè loses its projection
state the same way. The park's "same DOM node" probe assertions passed
because the node survives; the document inside it does not.

Verification step 0 for the implementer: reproduce before fixing — enter
Expressions, mark the app state (interact or read a state probe), switch to
Technè and back, and record (a) iframe node identity, (b) document
token/re-execution, (c) app state. The mark: the same
postMessage-identity fixture pattern html-continuity uses, applied to the
centre's frame.

## 2. Design — per-mode persistent stage slots (never move, flip visibility)

The pane tier's proven law, applied to mode centres: **the centre body
mounts ONCE at a stable position and presentation flips visibility.**

- For every workspace mode whose curation carries a `centreKind`
  (factory, expressions, techne, epi-logos, settings), CradleFrame renders
  an ALWAYS-PRESENT keyed stage slot beside the warm-tree hosts:

  ```tsx
  <div key={`mode-stage-${mode}`} className="mode-stage" data-mode={mode}
       hidden={mode !== currentMode || !centreBindingOf(mode) || undefined}>
    {centreBindingOf(mode) && <ModeCentreBody binding={centreBindingOf(mode)} … />}
  </div>
  ```

- `centreBindingOf(mode)` finds the centre-kind binding living in that
  mode's own tree (the active layout when `mode === currentMode`, else
  `modeLayouts[mode]`). No such binding → the slot renders empty (a fresh
  mode's stage before its centre opens).
- `ModeCentreBody` (new, exported from retention.tsx) is the direct centre
  arm — the existing `retainedBody` dispatch (PointCloudHost, TechneSurface,
  EpiLogosSurface, SystemPanel, FactoryCentre) under one Suspense — mounted
  DIRECTLY, with no park, no outlet, no adopt, no move. The component
  instance lives as long as the binding does.
- Switching modes flips `hidden` between the slots. `display:none` keeps
  documents alive; the engines suspend by their own disclosure laws
  (`useSuspensionDisclosure`) exactly as concealed panes do.

## 3. Ownership: one mount per centre binding

The existing park must not double-mount what a stage slot owns:

- **Stage-owned**: a centre binding living in its own mode's tree
  (expressions centre in the expressions tree). The stage slot owns it;
  the park never declares it.
- **Park-owned**: a centre binding presented as an ordinary pane tab in
  another tree (a Factory centre tab in Base, for example). The park keeps
  its declarer/adopter path for these — with the known residual that
  presenting a park-owned centre in a pane still moves the container and
  reloads it (documented; same defect class, next pass — the pane-tab case
  may adopt the slot pattern later).

`retainedCentres` narrows to park-owned bindings only (exclude any binding
a stage slot owns). `CentreOutlet` remains for pane-tab presentation.

## 4. What retires

- The stage path's adopt/move: `ModeCentreRetention`'s stage-owned
  declarations and the stage's `CentreOutlet` use disappear. The park
  remains solely for park-owned (pane-tab) centres.
- The unconditional `modeSoloStage` gate no longer decides "is a stage
  mounted" — the slots always exist; each shows its centre only while its
  mode is current and its binding exists. The mode's dedicated-stage
  presentation law (owner ruling 2026-09-19, second pass) is preserved:
  entering a centre mode shows that mode's stage, full-screen, with the
  trees holding mode-specific tabs hidden.

## 5. Acceptance (the implementer's proof bar)

1. New walk scenario `walk/scenarios/mode-engine-state.mjs`: enter
   Expressions (the real vendored app), mark in-app state (interact with
   the app's own UI or an in-page probe), switch to Technè, interact,
   return to Expressions — the SAME iframe node (stamp) and the SAME
   document (token) carry the state; the interaction state survives.
   Mirror the journey for Technè. Run twice.
2. The existing vertical stays green: `npm run walk -- html-continuity`
   (13/13) — the stage change must not disturb the warm-tree law.
3. `retention-probe.mjs`'s centre legs updated to the new law (same node +
   same document across the round trip — stronger than the old
   same-node-only assertion).
4. Node suites 37/37; `npx tsc --noEmit` clean; `npm run walk -- files
   material shell-recovery workspace-continuity` still green (or their
   failures unchanged and named).
5. No double mount: with Expressions and Technè both visited, exactly one
   PointCloudHost instance and one TechneSurface instance exist in the DOM.

## 6. Out of scope (documented, not claimed)

- Cross-app-restart persistence of the Expressions app's own state (the
  app's Save into its kernel-backed documents is its own feature).
- Pane-tab-presented centres' move-reload residual.
- The C-matrix's native legs (C07/C21/C22/C23) — unchanged.
<<<<<<< HEAD

## 7. Second pass — commissioned 2026-09-19 (owner directive: these are not residuals)

### 7.1 Pane-tab-presented centres: retire the park entirely

The park-adopt path moves the container — the same reload defect — for a
centre opened as an ordinary pane tab outside its own mode's tree. Design:

- `SurfaceBody`'s centre arm mounts `ModeCentreBody` DIRECTLY (in place,
  inside the pane's own `.surface-retained` wrapper, mounted-concealed by
  the pane tier like every other retained tab). `CentreOutlet` and the
  park-adopt path retire entirely; `ModeCentreRetention`, `retainedCentres`
  and the park layer are removed.
- The warm-tree shelving criterion widens: a tree is shelved when it
  carries ANY retained binding — pane kinds, plus centre bindings that are
  NOT stage-owned (a centre opened into a foreign tree keeps its body
  across mode swaps because its tree shelves). Stage-owned centres remain
  covered by their per-mode stage slots.
- Single-mount law unchanged: a stage-owned centre is presented only by
  its stage slot; a foreign-tree centre only by its pane wrapper.

### 7.2 Cross-restart persistence of the hosted engine's state

The Expressions application's in-memory state must survive a full app
restart, not just mode round trips. The app already deep-links its entry
(`?expression=<ref>`) and posts hosted-state messages the shell validates
(PageExpression integration). Design:

- The stage slot for the expressions centre CHECKPOINTS the app's current
  expression: the shell already receives hosted-state posts (document id,
  expression ref, revisions — validated token/generation/revision); store
  the current `expressionRef` as a checkpoint on the binding (`view` or a
  dedicated checkpoint field, debounced on change).
- On restart restore, the stage slot re-mounts the hosted app and
  deep-links it to the checkpointed expression ref through the app's own
  `?expression=` grammar — the app's own boot then carries the person back
  to the work they had open. The checkpoint is a REF into the person's
  saved work, never a copy of app content.
- Technè: verify its state is kernel-backed (projection registers) and
  therefore already survives; if any stage-local state (focus, reading
  position) is renderer-only, checkpoint it the same way.

## 8. Second-pass acceptance

- Pane-tab centre legs in `mode-engine-state.mjs`: open a centre as a pane
  tab in a foreign tree, mark state, switch modes/workspaces, return —
  same node, same document, state kept. Run twice.
- Restart leg: with an expression open in the Expressions engine, restart
  the renderer — the stage slot re-presents the SAME expression (the
  checkpointed ref) via the app's own deep-link.
- All prior acceptance (10/10 mode-engine-state, 13/13 html-continuity,
  37+/39 node suites, tsc, no double mounts) stays green.
=======
>>>>>>> origin/main
