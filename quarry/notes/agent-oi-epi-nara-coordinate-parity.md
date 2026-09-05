# agent/oi-epi-nara-coordinate-parity

`origin/agent/oi-epi-nara-coordinate-parity` @ 76d076f (2026-08-19) · 25
commits · Class B QUARRY-EPI/FOG (§3) · tip of the chain
mode-kernel-bridge ⊂ personal-return(=nara-lived-vertical) ⊂ this branch.

## What it is

The coordinate-parity proof for Nara: that a lived Nara surface inside O:I
and the Epi-owned coordinate system (bimba sources, m-coordinates) stay in
exact correspondence through write, selection, and send-off — hosted Nara
coordinate lineage asserted end-to-end against the real provider when
supplied. This is the deepest concrete semantics that exists for the map's
"Nara/Epi composition" fog row.

## Feature/function inventory

- **Nara provider surface** — `desktop/core/src/local_epi.rs` (chain-tip
  version): schemas `epi.nara-daily-surface/v1`, `epi.nara-selection/v1`;
  sendoff action/capability refs (`epi.action.nara.selection.sendoff`,
  `epi.capability.nara.selected-context`); `EPI_NARA_M_COORDINATE_MANIFEST_REF`;
  methods `nara_daily()`, `nara_write()`, `nara_selection(request)` over the
  native producer executable.
- **Coordinate binding invariant** —
  `desktop/core/tests/local_epi_provider.rs`:
  `real_nara_daily_round_trip_uses_the_same_provider_and_bounded_selection_
  packet`: written daily body carries `privacyClass:
  "protected-local-body"`, `livedContext.coordinateRef:
  "epi:bimba:#-4/M4'"`, and a full `coordinateBinding` quadruple —
  bimba `#4.4` ↔ pratibimba `epi:m-coordinate:M4-4'`, carrier
  `#4.4.4.4` ↔ `epi:m-coordinate:M4-4-4-4'`, review `#4.5` ↔
  `epi:m-coordinate:M4-5'` — and a reread returns **identical**
  `episodeRef`, `coordinateBinding`, `body`.
- **Selection packet privacy** — selection carries `selectedText: "α"`,
  `privacyClass: "protected-local-selected-disclosure"`, the same
  `coordinateBinding`; and the wire **never** contains the lived body or
  identity (`!encoded.contains("The lived Nara surface sees this exact")`,
  `!encoded.contains("identityRef")`).
- **Nara surface UX law** — `desktop/ui/src/nara-presentation.test.mjs`:
  "Nara is a **write-first daily canvas** over native provider operations"
  (`<textarea`, `nara_daily_snapshot`, `nara_save_daily`,
  `nara_send_selection`, `Explain this reading`); forbidden: any second
  cosmology or private identity model in the renderer.
- **Situated region co-reference** — "situated region co-refers to the
  governed stable selection packet only": `SituatedNaraPacket`,
  `selection.{selectionRef,episodeRef,selectedText}`, `agentContextScope`,
  `Exact disclosure scope`; no `dangerouslySetInnerHTML`.
- **Provider-loss and Action binding** — "fix: own Nara Action binding
  across contribution refresh" (Action authority survives contribution
  refresh); "test: include Epi in stable desktop destinations".

## Map-unit mapping

- Whole branch → fog row **Nara/Epi composition** (§2.4; #138 §12): the
  write-first canvas + selection-packet disclosure scope + coordinate
  binding quadruple are that row's concrete semantics.
- Disclosure-scope ladder (`agentContextScope`, protected classes) → §2.1
  distinction laws (`selected != disclosed to Agent`).
- Action binding across contribution refresh → D15/§2.1 authority-at-commit.

## Quarry verdict

**FOG-NOTE** — quarry into the Nara/Epi fog row feeding the QL/Epi design
line (programme §3 Class B action). Nothing here merges; the binding
quadruple and privacy classes are the knowledge kept.
