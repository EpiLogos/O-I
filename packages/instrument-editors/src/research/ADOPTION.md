# Timeline / Places receiving packet

The same installed `installResearchInstruments(host)` handles compact and full. The native lens opens lazily on first reveal. Depth and fold then change visibility/chrome; they do not reopen the installer, replace the native model, or close its Timeline working set/frame/filter/save-retry state. The wrapper is keyed by the exact expression+Scene identity, not revision. The parent's admitted target transfer remains responsible for blocking a transfer while `onDraftChange(true)` is held.

## Component contract

`TimelineEditor` / `PlacesEditor` retain their existing host, sceneId, depth, visible, revision, onExpand, onSource and onVisibility props. Added exported `ResearchEditorView` and `ResearchEvidenceContext` interfaces and optional receiving callbacks:

- `onDraftChange(pending)` runs synchronously **before** native material execution, remains true after refusal, and clears after the actual same operation succeeds. Connect this to InstrumentPresentation.setDraft.
- `view: {selectedFacet?: string|null}` and `onViewChange({selectedFacet})` carry only the exact overview facet selection. No reading/body is serialised into view state.
- `onOpenEvidence(provenance, {basis, readingRef, facetRef})` receives the source's exact source_ref/source_revision/native_owner/selector and the expression+Scene+revision basis. Without this hook, anchor-open is absent. Ordinary source opening uses the existing owner openSubject(ref), guarded against native basis drift. Its generic source/open/select callbacks are also refused when the native owner has another active Scene: these callback signatures cannot receive a different pinned Scene context. Add a basis-qualified source-open/inspect receiving method to remove that limitation; until then select the pinned Scene in its owner first.
- `onVisibility` stays the existing native graphics receiving hook. Folding preserves mounted state; the host must suspend actual renderer graphics and resize them on reveal. The wrapper does not simulate browser visibility or destroy the renderer to imitate suspension.

Common placement/fullscreen remains under InstrumentPresentation and its host. Internal Focus/F hides chrome over the same viewport, restores with Escape, and changes no camera/model state.

## Actual adoption

`receiveResearchHost` observes the **renderer’s own** primary host.read, rather than issuing a second read or creating another repository. It rechecks the expression/Scene/revision after the awaited publication, uses mature assertInstrumentReadingScope, then validates the complete ql.techne/v1 contract. The overview preserves the reading object, native refs, anonymous continuity, precision, uncertainty and provenance. Timeline bands use native facetRange/domainOfSpans; place precision uses native precisionMarker.

Compact Timeline reveals native zoom/Fit and Chronology/Relations controls. Compact Places reveals the actual native Globe/Flat/Fit controls; native facet filters, imagery and inspector return at full depth. Full additionally offers selected-facet provenance and optional exact-anchor opening. Native Timeline/Places editing, source inspection, source-backed filtering, map offline attribution, imagery budget and source refusal messages remain the mature implementation.

Required native import aliases are unchanged: @research-canvas/{schema,domain,desktop-api,geography,viewers,node-document,exporter}, React/ReactDOM and maplibre-gl resolve to the installed cradle/vendor paths already declared by the parent package. No dependency install, new clock, globe, semantic store, or native write verb was added.

## Full lane-qualified target mapping

Source coverage is not native acceptance closure. Every original target remains in scope. The original IDs are lane-qualified below because Timeline and Places each use T1 onward. “Open” means its specified driven/native acceptance has not been closed; the executed model/adapter tests and the refused kernel camera write do not pass that UI target. The middle column separates current adopted behavior from the exact remaining native capability or receiving hook.

| Original lane-qualified target | Adopted UI / remaining native hook | Native acceptance |
|---|---|---|
| lane-2:T1 | Native subday precision is exact in overview; chronology bridge still coarsens it. | Open |
| lane-2:T2 | Overview draws native precision bands; main chronology bands/inclusive display remain open. | Open |
| lane-2:T3 | Verbatim uncertainty visible in overview/evidence; chronology hatch/standing edge work remains open. | Open |
| lane-2:T4 | Deep integer year axis requires native chronology/scale extension; none fabricated. | Open |
| lane-2:T5 | Relative axis requires disclosed zero-ref/session projection hook. | Open |
| lane-2:T6 | Shared time-axis projection/session window producer remains open. | Open |
| lane-2:T7 | Main minor/major calendar axis extension remains open. | Open |
| lane-2:T8 | General sourced periodisation bands remain open. | Open |
| lane-2:T9 | Mature full sub-timeline frames retained; hierarchy semantics/zoom collapse remain open. | Open |
| lane-2:T10 | Mature relation-field cause chains retained; dated offset/camera walk remains open. | Open |
| lane-2:T11 | Mature relation-field standing legend retained; chronology edge grammar remains open. | Open |
| lane-2:T12 | Source facet counts are honest; zoom aggregation in the main chronology remains open. | Open |
| lane-2:T13 | Whole disclosed extent shown; camera-window drag/resize needs native camera hook. | Open |
| lane-2:T14 | Participant validity spans behind main event cards remain open. | Open |
| lane-2:T15 | Mature single viewport save retained; named projection/filter/frame views need native schema + capture/restore. Current material writer is blocked below. | Open |
| lane-2:T16 | Mature style refusal retained; defined native style mapping remains open. | Open |
| lane-2:T17 | Explicit shared session-window update hook remains open. | Open |
| lane-2:T18 | Mounted working set/frame survive depth/fold; durable ref-only capture/restore remains open. | Open |
| lane-2:T19 | Exact provenance/selector displayed; anchor opening offered only when native source-reader hook exists. | Open |
| lane-2:T20 | Mature source/relation inspection retained; complete native round-trip still needs live proof. | Open |
| lane-2:T21 | Shared event/window/place handoff receiving hook remains open. | Open |
| lane-2:T22 | Exact subject/reading/expression/Scene/revision disclosure and stale-publication guards implemented. | Open |
| lane-2:T23 | Wrapper graphics are still; mature palette retained. Full driven craft audit remains open. | Open |
| lane-2:T24 | View-local Focus/F/Escape implemented; fullscreen/placement belongs to common receiving host. | Open |
| lane-2:T25 | Native absence/refusal disclosure retained; no invented temporal material. | Open |

| Original lane-qualified target | Adopted UI / remaining native hook | Native acceptance |
|---|---|---|
| lane-4:T1 | Mature native globe/flat retained; pitch/bearing view/material extension remains open. | Open |
| lane-4:T2 | Actual native Fit retained; precision fly-to requires native camera helper. | Open |
| lane-4:T3 | Compass/north/home reset requires native camera helper. | Open |
| lane-4:T4 | Existing attributed offline pack retained; provider/source layer stack needs native receiving hook. | Open |
| lane-4:T5 | No terrain source disclosed; native provider/source hook remains open. | Open |
| lane-4:T6 | Mature renderer sky retained; tuned atmosphere audit remains open. | Open |
| lane-4:T7 | Native offline attribution retained; live provider/source reasons require supplied native policy/provider. | Open |
| lane-4:T8 | Mature full relation/standing filters drive its map repository; on-map overlay layer/legend extension remains open. | Open |
| lane-4:T9 | Region polygons on native map remain open. | Open |
| lane-4:T10 | Precision grammar visible in overview; native map marker/polygon styling remains open. | Open |
| lane-4:T11 | Mature route panel preserved; native geography-edge producer remains honestly unavailable. | Open |
| lane-4:T12 | Native hierarchy edges on globe remain open. | Open |
| lane-4:T13 | Full exact provenance/selector/source revision shown; source open guarded by captured basis. | Open |
| lane-4:T14 | Mature validity fields retained; shared dated-data slider/window hook remains open. | Open |
| lane-4:T15 | Shared-window playback requires native session/time-axis hook; no second clock added. | Open |
| lane-4:T16 | Offline source carries no historical imagery; no claim of past imagery made. | Open |
| lane-4:T17 | Mature exact Edit place/time route retained where disclosed; clicked-coordinate authoring receiving hook remains open. | Open |
| lane-4:T18 | Native place_set writer untouched; source-basis round-trip remains separate native acceptance. | Open |
| lane-4:T19 | Native drag-to-refine proposal hook remains open. | Open |
| lane-4:T20 | Mature single map viewport retained; named camera/filter/window view schema remains open. Current material writer is blocked below. | Open |
| lane-4:T21 | Native bounded layer/filter persistence schema remains open. | Open |
| lane-4:T22 | Bound facet chooser/open source implemented; native subject search/fly receiving hook remains open. | Open |
| lane-4:T23 | Source open retains refs; shared session place→Timeline window handoff remains open. | Open |
| lane-4:T24 | Wrapper retained facet selection is ref-only; map spatial-focus/session receiving hook remains open. | Open |
| lane-4:T25 | Native bounded tour material/camera replay hook remains open. | Open |
| lane-4:T26 | Journey owns beat binding; no journey store added here. | Open |
| lane-4:T27 | Native dated-sky overlay hook remains open; no local astronomy added. | Open |
| lane-4:T28 | Mature reference-frame depth panel and honest absences preserved. | Open |
| lane-4:T29 | Wrapper adds no idle animation/loop; actual graphics suspension requires host onVisibility implementation and driven idle proof. | Open |
| lane-4:T30 | Mature mythic/owner-vocabulary panel grammar retained; full map/route legend harmonisation remains open. | Open |

## Concrete native receiving work

1. **Current kernel admission mismatch (executed).** Current applyResearchMaterial backfills `frames` and `namedViews`, but `desktop/cradle/kernel/src/expression_scene.rs:409` admits only schema/cards/strokes/views/timeline. Real scene_material_set therefore refuses even Timeline/Places camera writes with `Invalid or unbounded research Scene material`. The component preserves this refusal and retry state; it never strips those fields to force acceptance. Repair the native Rust research validator to admit/bound frames (≤64, nonempty label≤160, ≤64 admitted occurrence memberRefs, integer z) and namedViews (≤32, bounded viewport, ≤64 selectedRefs/frameOrder), matching the TS source. Keep legacy absence valid. Extend `expression_scene.rs::remap_refs` for frame memberRefs/namedView selectedRefs/frameOrder and frame keys where applicable, preserving source refs. Native card size admission must likewise match current TS ResearchCard.size; source-level compact/native card tests do not establish kernel acceptance of it.
2. **Camera/filter/session hooks.** Add native installer return methods captureView/restoreView/focusFacet/setVisible, delegating into the existing TimelineSurface and MapSurfaceRenderer. Capture ref-only workingSet/frame/walk/filter/projection plus the real camera; restore with fresh source reads. No CSS/DOM scraping or fake button activation. Publish existing camera changes without reopening the native lens. Native typed session receiving callbacks must retain subject_ref/reading_ref/snapshot basis and explicit time_window/spatial_focus_ref; pan is never a semantic window write.
3. **Graphics lifecycle.** Current MapSurfaceRenderer has no exposed visible/resize receiving methods. Add visibility/resize to its existing MapLibre instance and the native installer, preserving React filter/frame/working-set/save-retry state; a fold must not force a full renderer unmount to stop graphics.
4. **Named material/provider capabilities.** Native schema + matching validator/fork remap are needed before named Timeline/Places views, tour/layer records, pitch/bearing, temporal style or provider overlays can be written. Keep unavailable provider/action controls absent or reasoned until the owner supplies the actual capability.

## Executed evidence

`node packages/instrument-editors/tests/research-run.mjs` runs imported native contract/scale/precision/material code, actual receiving refusal guards and an isolated real kernel case at http://127.0.0.1:4186. Ten tests passed, zero skipped. ResearchEditor TSX transpilation passed. No broad build/install/Git operation was run.

`tests/research-native-evidence.json` records the exact controlled before document, native refusal, byte-equivalent after-refusal document/revision, synchronous pending publications/retained error, then the separate historical five-field camera readback and stale-CAS refusal. The historical compatibility payload exists only in the test; no UI serializer drops current authored fields. This proves the native limitation and historical persistence route, not rendered chronology/map acceptance. No existing owner document was mutated; only a uniquely named controlled test Expression was created.
