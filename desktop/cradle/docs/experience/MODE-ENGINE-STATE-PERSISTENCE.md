# Mode-engine state persistence — spec and design (2026-09-19)

Status: commissioned design for implementation. Owner report: switching to
and from the Expressions and Technè engines loses their state — the engines
reboot instead of resuming.

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
