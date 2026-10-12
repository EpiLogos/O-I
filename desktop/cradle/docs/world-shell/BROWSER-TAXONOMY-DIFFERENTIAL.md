# Browser taxonomy differential: Ableton folder types against four O:I modes

**Standing:** read-only research study, 8 October 2026. Companion matrix: [browser-taxonomy-matrix.json](browser-taxonomy-matrix.json) (68 cells, one per Ableton folder type and mode).
**Question:** which Ableton Browser folder types have an honest functional equivalent in each O:I mode (Expressions, Technè, Factory/Agency, Central), and what must vary by mode in the left sidebar against what can stay constant.
**Not in scope:** no code change, no design of the Technè or Factory tracks owned by others, no shipped Ableton material.

Every statement is tagged **EVIDENCE** (cited to a file and line or section) or **INFERENCE** (a judgement, a design proposal, or an absence I could not fully check).

---

## 1. Method and evidence

### 1.1 Count and mode discrepancies (read first)

- **EVIDENCE:** the request says "15 types x 4 modes = 60 cells", but its own list names **17** rows: Collections/Favorites, Sounds, Drums, Instruments, Audio Effects, MIDI Effects, Modulators, Max for Live, Plug-ins, Clips, Samples, Grooves, Templates, Places, Packs, User Library, Current Project. I covered all 17 named rows, so the matrix has **68 cells**, not 60. The owner should confirm this (open question Q1).
- **EVIDENCE:** the shells disagree about what a "mode" is. The live shell has three modes, `WorkspaceMode = 'audio' | 'expressions' | 'techne'` (`packages/live-shell/ui/src/shell/workspace.tsx:12`). The cradle has six, `base | factory | expressions | techne | epi-logos | settings` (`CR/workspace/mode.ts:23`), where `base` is labelled "Central" (`CR/workspace/mode.ts:98-102`). The world-shell design says Central is "not a fifth view and not a separate app" ([NS-WSD] `new-shell/WORLD-SHELL-DESIGN.md:253-256`). This study maps the user's four names onto the cradle modes (Expressions to `expressions`, Technè to `techne`, Factory/Agency to `factory`, Central to `base`), because only the cradle defines a left body for each. Open question Q2.

### 1.2 Aliases used in citations

| Alias | Root |
| --- | --- |
| LS | `/Users/admin/Central/worktrees/env-1/o-i/packages/live-shell/ui/src/components/` |
| LS-app | `/Users/admin/Central/worktrees/env-1/o-i/packages/live-shell/ui/src/App.tsx` |
| CR | `/Users/admin/Central/worktrees/env-1/o-i/desktop/cradle/src/` |
| NS | `desktop/cradle/docs/world-shell/` |
| UIE | `/Users/admin/Central/Work/O-I/docs/research/ableton-live-12.0.25/ui/UI-EVIDENCE.md` |
| SCOPE | `desktop/cradle/docs/world-shell/lanes/lane-6-ableton-shell/SCOPE.md` |
| SHELLBP | `/Users/admin/Central/Work/O-I/docs/research/ableton-live-12.0.25/shell/SHELL-BLUEPRINT.md` |
| FAE | `/Users/admin/Central/worktrees/env-1/o-i/docs/experience/FACTORY-AGENCY.md` |
| SPEC | `/Users/admin/Downloads/oi-editor-v2/EDITOR-AND-DEVICE-SPEC.md` |
| CTRL | `/Users/admin/Central/Control/` |

### 1.3 Verdict definitions (applied per cell)

- **SHARED:** the same folder with the same UX in this mode and at least one other mode. Only the contents are the same kind of thing.
- **MODE-SPECIFIC:** the folder slot has an honest equivalent in this mode, but its contents or operations differ by mode.
- **ABSENT:** no honest equivalent in this mode. The folder would be empty or would be a fiction.

Basis rule: **evidence** when the mode's contents or operation are observed in code, a captured artefact, or an accepted document. **inference** when the cell rests on a design proposal, a naming analogy, or an absence I could not fully check. Status tags in the matrix `assetKind` text mean: `[built]` implemented in code; `[internal]` implemented in an internal app but not outward; `[gated]` waiting on an owner; `[specified]` written in an accepted document; `[design]` a design proposal only.

### 1.4 Evidence read (in the requested order)

1. Ableton captures: `UIE` (126 lines); `evidence/ui/live-session-real.png` (viewed; it shows the Library and Places columns); `SHELLBP`; `SCOPE` sections 1-3 and 8; `lom/LOM-INVENTORY.md` (grepped for Browser: no Browser class is inventoried).
2. Shell browser: `LS/WorldBrowser.tsx` (all 223 lines), `LS/nativeBrowserModel.ts`, `LS/NativeDeviceBrowser.tsx`, `LS/NativeMaterialBrowser.tsx`, `LS/NativeObjectBrowser.tsx`, `LS/NativeTechneBrowser.tsx`, `LS/NativeExpressionCollections.tsx`, `LS/nativeDeviceCatalogue.ts`; plus `LS/BrowserPane.tsx` (the Live-mirror browser used in audio mode) and `LS-app:268-269`.
3. New-shell docs: `NS/EXPRESSIONS-FEATURE-MAP.md`, `NS/AGENTIC-CONVERGENCE.md`, `NS/DEVICE-PANEL-BRIEF.md`, `NS/UI-UX-CONVERGENCE-STUDY.md`, `NS/WORLD-SHELL-DESIGN.md`.
4. `SPEC` sections 2, 3, 6 and 8 (lines 19-63, 134-218).
5. Central tree: `CTRL` (counts and shape), `/Users/admin/Central/CLAUDE.md` (the world's own floor, its command surface and folder law).
6. Technè and Factory: grepped the o-i checkout for browser, agency and techne terms. Read only the left-body code and the accepted Factory document; did not design those tracks.

### 1.5 Checks that found nothing

- `lom/LOM-INVENTORY.md` has no Browser class; the browser folder list rests only on the captures and `BrowserPane.tsx:10`.
- No captured evidence shows the Ableton browser's audition (preview) behaviour. Ableton preview is therefore recorded as not evidenced, not assumed.
- `NativePropertyBrowser.tsx` (156 lines) was checked for a preview action. It has only drag and pin paths (`LS/NativePropertyBrowser.tsx:41, 54-60`). A non-mutating preview is a design requirement in `NS/UI-UX-CONVERGENCE-STUDY.md:49` and is not built.

---

## 2. Ableton folder types as observed

| Ableton folder | Where observed | Evidence |
| --- | --- | --- |
| Collections: Favorites | Top section, above Library | **EVIDENCE** `UIE:50`; screenshot `evidence/ui/live-session-real.png` |
| Library: All | Library list | **EVIDENCE** `UIE:51`; screenshot |
| Sounds, Drums, Instruments, MIDI Effects, Max for Live, Plug-ins, Clips, Samples, Grooves, Tunings | Library list | **EVIDENCE** `UIE:51-52`; screenshot |
| Audio Effects, Modulators | Library list in the screenshot | **EVIDENCE** screenshot only. **UIE omits both** (`UIE:51-52` lists neither). This is a correction to the dossier. |
| Templates | Library list in the screenshot | **EVIDENCE** screenshot. UIE puts Templates under Places (`UIE:52-53`). |
| Places (user folders: warm, amp, Sampler) | Below Library | **EVIDENCE** `UIE:52-53`; screenshot shows user folders |
| Groove Pool | Lower pool with column headers and a drop empty state | **EVIDENCE** `UIE:57-59`; screenshot shows the Groove Pool and Global Amount |
| Packs, User Library | Not visible in the captured browser | **EVIDENCE** on disk only: `SCOPE:49-54` says `~/Music/Ableton/` holds a User Library and Factory Packs. Browser presence not captured. |
| Current Project | Not a browser folder in the captures | **INFERENCE** that it is the open set's own content. The set is shown in Session and Arrangement (`UIE:61-98`). |
| Tunings | Library list (not in the request's list) | **EVIDENCE** `UIE:51-52` and `LS/BrowserPane.tsx:10`. Relevant to M2 tuning (`SCOPE:122`). |

Two further observations from the evidence:

- **EVIDENCE:** the Live-mirror browser in the shell (`LS/BrowserPane.tsx:10`) copies the Library list (All, Sounds, Drums, Instruments, Audio Effects, MIDI Effects, Modulators, Max for Live, Plug-ins, Clips, Samples, Grooves, Tunings). Its contents come only from devices already present in the open set (`BrowserPane.tsx:24-25`). Only All, Plug-ins, Instruments and Audio Effects can show anything. Every other category prints "No ... disclosed by this set." (`BrowserPane.tsx:34`). The labels exist without data behind most of them.
- **EVIDENCE:** Ableton's observed interaction facts are drag targets everywhere (browser to track, clip to slot, device to chain) and inline editing (`UIE:100-108`). Audition is not captured in the evidence.

---

## 3. The matrix, per mode

Verdicts are from `browser-taxonomy-matrix.json`. "Insertion" is the cell's `insertionTarget`.

### 3.1 Expressions

| Ableton folder | Verdict | O:I asset kind (status) | Insertion | Basis |
| --- | --- | --- | --- | --- |
| Collections/Favorites | MODE-SPECIFIC | read-only featured and starting-point collections; Open disabled `[built]` | none | evidence |
| Sounds | ABSENT | none; object sound device `[gated]` | none | evidence |
| Drums | ABSENT | none | none | evidence |
| Instruments | SHARED | Technè lens list (six lenses) `[built]` | centre lens over the work | evidence |
| Audio Effects | MODE-SPECIFIC | Expression device families: field, entity and scene devices `[built]` | rack | evidence |
| MIDI Effects | ABSENT | none in the feature inventory | none | evidence |
| Modulators | MODE-SPECIFIC | LFO and ramp automation groups `[internal]`; browser slot proposed `[design]` | lower assignment `[design]` | evidence |
| Max for Live | ABSENT | no M1 to M3 instrument host in any mode | none | evidence |
| Plug-ins | ABSENT | none | none | evidence |
| Clips | MODE-SPECIFIC | expression, scene and entity rows (cradle left body) `[built]` | Session row or Clip detail | evidence |
| Samples | MODE-SPECIFIC | glyph and image sources `[internal]`; Central files with retrieval grant `[built]` | Expression source or layer `[design]` | evidence |
| Grooves | ABSENT | none (Groove Pool geometry only) | none | evidence |
| Templates | MODE-SPECIFIC | starting points, read-only `[built]` | none | evidence |
| Places | MODE-SPECIFIC | native library scopes and Central file listing `[built]` | none (opens a scope) | evidence |
| Packs | ABSENT | none | none | evidence |
| User Library | MODE-SPECIFIC | saved works and reusable material `[built]` | open work; Perform into the Scene | evidence |
| Current Project | MODE-SPECIFIC | the open Expression's Scenes, objects and chosen controls `[built]` | open Scene or chosen-controls rack | evidence |

### 3.2 Technè

| Ableton folder | Verdict | O:I asset kind (status) | Insertion | Basis |
| --- | --- | --- | --- | --- |
| Collections/Favorites | ABSENT | none | none | evidence |
| Sounds | ABSENT | none | none | evidence |
| Drums | ABSENT | none | none | evidence |
| Instruments | SHARED | six lenses: Graph, Canvas, Timeline, Journey, Places, Palace `[built]` | centre lens | evidence |
| Audio Effects | ABSENT | none | none | evidence |
| MIDI Effects | ABSENT | none | none | evidence |
| Modulators | ABSENT | none (Now, Occasion and Transport are time controls) | none | evidence |
| Max for Live | ABSENT | none (M0 and M5 are coupled views) | none | evidence |
| Plug-ins | ABSENT | none | none | evidence |
| Clips | ABSENT | none as a folder; passages and periods live inside Journey and Timeline | none in the sidebar | evidence |
| Samples | ABSENT | none (Canvas holds source occurrences) | none | evidence |
| Grooves | ABSENT | none | none | evidence |
| Templates | ABSENT | none | none | evidence |
| Places | MODE-SPECIFIC | wiki registers and constellations `[built]`; the geographic Places lens is an instrument, not this folder | centre lens or construction | evidence |
| Packs | ABSENT | none | none | evidence |
| User Library | MODE-SPECIFIC | saved knowledge constructions `[built]` | opens in the lens | evidence |
| Current Project | MODE-SPECIFIC | the open lens subject: selected source, relations, Scene `[built]` | centre lens over the subject | evidence |

### 3.3 Factory/Agency

| Ableton folder | Verdict | O:I asset kind (status) | Insertion | Basis |
| --- | --- | --- | --- | --- |
| Collections/Favorites | MODE-SPECIFIC | agents and reusable teams (roster) `[specified]` | current-work membership | evidence |
| Sounds | ABSENT | none | none | evidence |
| Drums | ABSENT | none | none | evidence |
| Instruments | MODE-SPECIFIC | agent devices, one agent one device `[design]` | agent device face on a scope | inference |
| Audio Effects | ABSENT | none; skills are the nearest plug-in analogue | none | evidence |
| MIDI Effects | ABSENT | none | none | evidence |
| Modulators | ABSENT | none; routing is sends-like, not modulation | none | inference |
| Max for Live | ABSENT | none; Factory is arrangements, takes and automation | none | evidence |
| Plug-ins | MODE-SPECIFIC | agent skill catalogue with search source `[built]`; drop onto device `[design]` | skill list on agent device | evidence |
| Clips | MODE-SPECIFIC | Runs in the Desk view `[built]`; acts `[design]` | Session clip slot `[design]` | evidence |
| Samples | ABSENT | none; project files appear under Places | none | evidence |
| Grooves | ABSENT | none; routines are not timing templates | none | inference |
| Templates | MODE-SPECIFIC | returned-document templates `[specified]` | return or handoff document | evidence |
| Places | MODE-SPECIFIC | project folder tree and task rows, one project register `[built]` | centre encounter | evidence |
| Packs | MODE-SPECIFIC | AIKit capsules and skillsets; harness presets `[design]` | harness behind the agent device | inference |
| User Library | MODE-SPECIFIC | minted agents (team or temporary) and Runs `[built]` | bring into work, or keep as Agent | evidence |
| Current Project | MODE-SPECIFIC | the selected project register and its active Run `[built]` | centre conversation | evidence |

### 3.4 Central

| Ableton folder | Verdict | O:I asset kind (status) | Insertion | Basis |
| --- | --- | --- | --- | --- |
| Collections/Favorites | MODE-SPECIFIC | remembered rows and destination rows `[built]` | none (opens) | evidence |
| Sounds | ABSENT | none | none | evidence |
| Drums | ABSENT | none | none | evidence |
| Instruments | ABSENT | none in the Central navigator | none | evidence |
| Audio Effects | ABSENT | none | none | evidence |
| MIDI Effects | ABSENT | none | none | evidence |
| Modulators | ABSENT | none | none | evidence |
| Max for Live | ABSENT | none | none | evidence |
| Plug-ins | MODE-SPECIFIC | 35 authored skills on disk `[built]` | none; AIKit delivers them to harnesses | evidence |
| Clips | MODE-SPECIFIC | 109 NOW clearings, returns, 7 Flow documents `[built]` | day track `[design]` | evidence |
| Samples | ABSENT | none; Central files appear under Places | none | evidence |
| Grooves | ABSENT | none | none | evidence |
| Templates | MODE-SPECIFIC | Day and Epi-Card document forms, created in place `[built]` | opens the document | evidence |
| Places | MODE-SPECIFIC | Control tree, WORK projects, Today, Library, Explore, Identity `[built]` | opens a destination | evidence |
| Packs | ABSENT | none in the navigator; AIKit installation is machine-level | none | evidence |
| User Library | MODE-SPECIFIC | authored human ground in Control/user `[built]` | none; writes go through contribution | evidence |
| Current Project | MODE-SPECIFIC | the current day and NOW `[built]` | day track `[design]` | evidence |

---

## 4. Per-type findings

Each bullet is tagged. "No honest equivalent" means the verdict is ABSENT in every mode in which I checked.

### 4.1 Collections/Favorites
- **EVIDENCE:** Expressions shows read-only featured and starting-point collections inside the Expressions category. Every Open button is disabled (`LS/NativeExpressionCollections.tsx:20-36`). The category is `works` (`LS/WorldBrowser.tsx:184`).
- **EVIDENCE:** Technè has no collection section. Its only list is the six lenses (`LS/NativeTechneBrowser.tsx:47-52`).
- **EVIDENCE:** Factory has the roster of agents and teams (`CR/agency/roster.ts:70,88`; `FAE:50-59`). Teams are reusable groupings, not favourites. Mapping them to Collections is **INFERENCE**.
- **EVIDENCE:** Central's navigator imports `RememberedRows` and shows Today, Library, Explore and Identity destinations (`CR/surfaces/navigator/WorldNavigator.tsx:14, 125-128`). The rows' contents were not read.

### 4.2 Sounds
- **No honest equivalent in any of the four modes.**
- **EVIDENCE:** the object sound device is `[gated]`: it waits on native engine and hosting acceptance (`NS/EXPRESSIONS-FEATURE-MAP.md:55`).
- **EVIDENCE:** the live engine's audio devices are Glue, Echo and Reverb, not a sound library (`SHELLBP:40-41`). In audio mode the Sounds category is empty (`LS/BrowserPane.tsx:25`).

### 4.3 Drums
- **No honest equivalent in any mode.** No drum-kit or drum-pad asset kind exists in `LS/WorldBrowser.tsx:22-30`, and none is named in the Factory or Central navigators. Drum Rack appears in the Instruments list of the captured screenshot `evidence/ui/live-session-real.png`, and has no O:I analogue.

### 4.4 Instruments
- **EVIDENCE:** Expressions and Technè show the same six-lens list. It sits in the Knowledge category of the one non-audio browser (`LS/WorldBrowser.tsx:182, 218`; `LS-app:268-269`). That is why this row is SHARED.
- **EVIDENCE:** opening a lens switches the mode to Technè (`LS/NativeTechneBrowser.tsx:42`). A browser action therefore changes the mode, which is a sidebar-to-mode coupling to remove or keep on purpose (Q7).
- **EVIDENCE:** the native live instrument (Operator and Wavetable style voice models) is not modelled: "Operator/Wavetable synthesis NOT yet modeled" (`SHELLBP:40`). It is `[gated]` (`NS/EXPRESSIONS-FEATURE-MAP.md:56`).
- **INFERENCE:** in Factory, an agent device is the nearest instrument-like device (`NS/AGENTIC-CONVERGENCE.md:24-37, 101`). It is a design proposal, not built.

### 4.5 Audio Effects
- **EVIDENCE:** the Expression device families are the nearest processor-like objects. They are field faces, morph, colour, force and entity and scene devices (`LS/nativeDeviceCatalogue.ts:67-74`). They are inserted by double-click, + Add or drag (`LS/NativeDeviceBrowser.tsx:26-38`).
- **INFERENCE:** the Devices category mixes instrument-like and processor-like families in one list. Ableton separates them. A real Audio Effects folder would filter that list.
- **EVIDENCE:** in Technè, Factory and Central there are no processor devices (`LS/NativeTechneBrowser.tsx:7-14`; `FAE:17-24`; `CR/surfaces/navigator/WorldNavigator.tsx:125-128`).
- **EVIDENCE (Live fork, outside the four modes):** Glue, Echo and Reverb are real Audio Effects in `live-engine` (`SHELLBP:40-41`). This is where the Ableton effect row has honest content, in audio mode.

### 4.6 MIDI Effects
- **No honest equivalent in any mode.** The feature inventory has no note-transform or event-processing row (`NS/EXPRESSIONS-FEATURE-MAP.md:15-73`). Pointer and click effects are interaction, not note transforms (line 37).

### 4.7 Modulators
- **EVIDENCE:** Expressions has LFO and ramp automation groups, pin cycle clocks and target assignment, all internal to the app (`NS/EXPRESSIONS-FEATURE-MAP.md:27, 42-43`). A modulator browser slot is proposed but not built (`NS/UI-UX-CONVERGENCE-STUDY.md:47`).
- **EVIDENCE:** `SCOPE:122` places M2 modulation in Live's modulator devices and automation. In the Expressions row the content is the automation groups; M2 as a hosted modulator device does not exist yet.
- **EVIDENCE:** Technè, Factory and Central have no parameter modulators. Routing in Factory is sends-like (`NS/AGENTIC-CONVERGENCE.md:130-131`), which is **INFERENCE** that it is not modulation.

### 4.8 Max for Live (M1 to M3 deep-instrument plugin space)
- **No honest equivalent in any of the four modes, and this is the most important absence.**
- **EVIDENCE:** `SCOPE:121` places M1 as an instrument device in Live's device chain. `SCOPE:254-256` (decision D-H) leaves the host open: external instrument, Max for Live or RNBO, or both. No host is decided, so the slot cannot be filled honestly.
- **EVIDENCE:** `SHELLBP:77-82` puts Operator and Wavetable voice models at M6, and says MIDI tracks are blocked on RE-lane voice models.
- **EVIDENCE:** the Expressions device families are the M4 body's own parameter devices. Filing them under Max for Live would be wrong; they belong under Audio Effects or Devices (see 4.5).
- **EVIDENCE:** Technè and Central are coupled views (`SCOPE:125`). Factory is arrangements, takes and automation (`SCOPE:126`).

### 4.9 Plug-ins
- **EVIDENCE:** Factory has the nearest honest analogue. Agent skills form a catalogue with a registered search source (`CR/agency/agencySources.ts:46-59, 111`). `NS/AGENTIC-CONVERGENCE.md:74-76` calls skills the agent's plug-ins and says harnesses sit behind the face.
- **EVIDENCE:** Central has 35 authored skill directories under `CTRL/user/skills`. They reach agents through AIKit, not through a rack (`/Users/admin/Central/CLAUDE.md`, section "The layers, plainly").
- **EVIDENCE:** Expressions and Technè have no plug-in host. No third-party or external plug-in category appears in the browser (`LS/WorldBrowser.tsx:22-30`).

### 4.10 Clips
- **EVIDENCE:** Expressions has scenes and formation states as clip-like units. The cradle's expression graph lists expression, scene and entity rows (`CR/workspace/modeBodies.tsx`; `CR/expressions/ExpressionGraphNavigator.tsx` type Row). Scene launch and state editing sit in the Session and Clip views (`NS/EXPRESSIONS-FEATURE-MAP.md:29, 45`).
- **EVIDENCE:** in Factory, clip-like units are Runs (Desk view, `CR/surfaces/navigator/FactoryNavigator.tsx`) and, as a design, acts (prompt plus settings, `NS/AGENTIC-CONVERGENCE.md:44-45`).
- **EVIDENCE:** Central has 109 NOW clearings (`CTRL/agents/now/clearings`) and 7 Flow documents (`CTRL/user/flows`). The Timeline lane for days is a design (`NS/WORLD-SHELL-DESIGN.md:259-262`).
- **EVIDENCE:** Technè has no clip folder. Passages and periods are inside the Journey and Timeline lenses (`LS/NativeTechneBrowser.tsx:10-11`).
- **INFERENCE:** `SCOPE:123` puts M3 clips and notes (score side) in Live natively. The Expressions Clips row is Expression scenes, not M3 notes. Those are different things under one folder name (Q5).

### 4.11 Samples
- **EVIDENCE:** Expressions has partly built sources: image and ASCII import is internal (`NS/EXPRESSIONS-FEATURE-MAP.md:31`), and Central files open with a retrieval grant (`LS/WorldBrowser.tsx:110-126, 189-203`). A browser import of sources is planned (`NS/UI-UX-CONVERGENCE-STUDY.md:47`).
- **EVIDENCE:** in Technè, Factory and Central there is no sample-like asset. Canvas holds source occurrences (`LS/NativeTechneBrowser.tsx:9`). Project and Central files are shown under Places (`CR/workspace/mode.ts:59-63`; `WorldNavigator.tsx:18-19`).

### 4.12 Grooves
- **No honest equivalent in any mode.** Only the Groove Pool geometry carries over, as the lower contextual pool (`NS/UI-UX-CONVERGENCE-STUDY.md:49`). Routines and NOW and DAY recurrence are not timing templates (**INFERENCE**, `FAE:173-180`).

### 4.13 Templates
- **EVIDENCE:** Expressions starting points (Composition and Native starters) are read-only (`LS/NativeExpressionCollections.tsx:20-36`). New blank Expression is a File and New action, not a browser row (`NS/EXPRESSIONS-FEATURE-MAP.md:17`).
- **EVIDENCE:** Factory has returned-document templates for code change, verification, report, preview and handoff (`FAE:114-126`, specified, not built in the live shell).
- **EVIDENCE:** Central has document forms, Day and Epi-Card, created in place through the document roster (`CR/CradleFrame.tsx:734, 1996, 2056`).

### 4.14 Places
- **Name collision.** Ableton Places are folders on disk. Technè has a "Places" lens that discloses geographic places, imagery and facets (`LS/NativeTechneBrowser.tsx:12`). The lens is an instrument, not a folder. Q5 asks whether to rename one.
- **EVIDENCE:** Expressions shows native library scopes (world, library, register) and Central files (`NS/EXPRESSIONS-FEATURE-MAP.md:19`; `LS/WorldBrowser.tsx:109, 189-203`).
- **EVIDENCE:** Technè's wiki map is a Central-rooted tree with one node per Project register and its constellations (`CR/techne/WikiMapNavigator.tsx:14-25`).
- **EVIDENCE:** Factory has a project folder tree and task rows, scoped to one project register (`CR/workspace/mode.ts:59-63`).
- **EVIDENCE:** Central has the Control tree, WORK projects and destinations (`CR/surfaces/navigator/WorldNavigator.tsx:18-19, 125-128`). This is the closest match to the Ableton Places row of any mode.

### 4.15 Packs
- **EVIDENCE:** no pack concept exists in Expressions, Technè or Central's navigator (`LS/WorldBrowser.tsx:22-30`; `LS/NativeTechneBrowser.tsx:7-14`).
- **INFERENCE:** Factory's nearest analogue is installable AIKit capsules and skillsets, plus harness presets (`NS/AGENTIC-CONVERGENCE.md:147-153`). The browser placement is a design, not built.

### 4.16 User Library
- **EVIDENCE:** Expressions has saved native works and reusable material (character, scene, expression, gesture). Material can be performed, played or saved as reusable (`LS/NativeMaterialBrowser.tsx:54-69, 84-97`).
- **EVIDENCE:** Technè has saved knowledge constructions (`CR/techne/WikiMapNavigator.tsx:13`).
- **EVIDENCE:** Factory has minted agents with team or temporary durability (`CR/agency/agencyTypes.ts:20`; `CR/agency/MintAgent.tsx`).
- **EVIDENCE:** Central's authored human ground is `CTRL/user` (skills 35, flows 7, day 4, identity, telos, contracts). Writes go through contribution, not the browser (`/Users/admin/Central/CLAUDE.md`, "The owner's ground").

### 4.17 Current Project
- **EVIDENCE:** the one folder that holds in every mode, but with different contents. In Expressions it is the open Expression's objects and chosen controls (`LS/WorldBrowser.tsx:187-188`; `LS/nativeBrowserModel.ts:94-96, 242-246`). In Technè it is the open lens subject (`LS/NativeTechneBrowser.tsx:36, 53-58`). In Factory it is the selected project register. In Central it is the current day and NOW (`CR/surfaces/navigator/WorldNavigator.tsx:125`).
- **INFERENCE:** this should be a constant slot in the skeleton, because it is the "where am I" pointer. Its contents are the mode.

---

## 5. Recommendation

### 5.1 Verdict summary

- **EVIDENCE:** of 68 cells, **28 are MODE-SPECIFIC, 38 are ABSENT, and 2 are SHARED**. The only SHARED cells are Instruments in Expressions and Technè, which are the same lens list.
- **INFERENCE:** the Ableton model of a single constant folder set does not survive contact with these modes. Most rows change contents. About a third of the Ableton rows have no honest equivalent in any mode.

### 5.2 What the current shell does

- **EVIDENCE:** the sidebar is swapped wholesale by mode. In audio mode the Live-mirror `BrowserPane` shows; in every other mode the `WorldBrowser` shows (`LS-app:268-269`). The categories do not change between Expressions and Technè, because it is the same component.
- **EVIDENCE:** the cradle swaps the whole left body by mode: `world` for Central, `factory` for Factory, `expression-graph` for Expressions, `wiki-map` for Technè (`CR/workspace/mode.ts:98-120`; `CR/CradleFrame.tsx:2011`).
- **INFERENCE:** the current design already varies the sidebar by mode, but as whole replacement rather than a constant frame with changing rows. That is the discipline to change.

### 5.3 The constant skeleton (what stays the same in every mode)

Four regions, fixed in position, size and behaviour. Evidence for each comes from the Ableton captures (`UIE:49-59`) and the shell's existing `WorldBrowser` frame (`LS/WorldBrowser.tsx:177-205`).

1. **Search row.** One search field and one count. (`LS/WorldBrowser.tsx:178`; `LS/BrowserPane.tsx:26`.)
2. **Collections section.** A fixed top slot for the mode's favourites or remembered rows. Content varies; if empty, it says "None disclosed" (`LS/NativeExpressionCollections.tsx:31`).
3. **Category column.** A fixed ordered list of category slots. Each mode fills the slots it has and hides the rest. Slot labels are the Ableton names where a mapping exists, and O:I names where not.
4. **Results list.** One list pattern in every mode: a Name header, a filter, one row per asset, Space to preview or select, Enter to open, drag to insert. Keyboard walk and Esc-to-clear already exist (`LS/WorldBrowser.tsx:139-152`).
5. **Lower pool.** One frame, with a role selector. Its role changes per mode (see 5.5). (Groove Pool geometry is UIE:57-59; `NS/UI-UX-CONVERGENCE-STUDY.md:49`.)

Current Project is the one row that stays in the category column in every mode. Its contents are the mode's current work.

### 5.4 Category slots and when each shows

| Slot | Shown when | Ableton row(s) it carries | Modes with content |
| --- | --- | --- | --- |
| Current work | always | Current Project | all four (MODE-SPECIFIC) |
| Collections | always (may be empty) | Collections/Favorites | Expressions, Factory, Central |
| Instruments | when lens or agent instruments are available | Instruments | Expressions, Technè (SHARED); Factory [design] |
| Devices | Expressions only (rack devices) | Audio Effects; Modulators as a lane | Expressions |
| Clips and runs | when a mode has clip-like units | Clips | Expressions, Factory, Central |
| Templates | when a mode has templates | Templates | Expressions, Factory, Central |
| Places | always | Places | all four |
| User Library | always | User Library | all four |
| Plug-ins and packs | Factory and Central | Plug-ins; Packs | Factory, Central |
| Files and samples | Expressions and where files exist | Samples (Expressions only) | Expressions |

Rows that must **not** appear in the constant skeleton until an owner operation exists: **Sounds, Drums, MIDI Effects, Max for Live, Grooves, Tunings**. Rule from the owner's own UX study: "A device category is useful only when its insertion/capability is real" (`NS/UI-UX-CONVERGENCE-STUDY.md:47`). Those six rows are ABSENT in all four modes, so showing them would be a dead category.

### 5.5 What changes per mode (the explicit list)

| Mode | Category rows shown | What the rows hold | Lower-pool role | Source |
| --- | --- | --- | --- | --- |
| Expressions | Current work, Collections (read-only), Instruments, Devices, Clips (scenes), Templates (starters), Places (library scopes), User Library (works and material), Files and samples | Open Expression's objects and chosen controls; device families; saved works and material; scope and file listing | Property, macro or material destination, or modulation monitor | `LS/WorldBrowser.tsx:22-30`; `NS/UI-UX-CONVERGENCE-STUDY.md:49` |
| Technè | Current work (open lens subject), Instruments (six lenses), Places (wiki registers), User Library (constructions) | Lens subject; lens list; wiki registers and constellations; saved constructions | Lens filters and selection (Timeline filters, Places layers) | `NS/UI-UX-CONVERGENCE-STUDY.md:51`; `SPEC:201-207` |
| Factory/Agency | Current work (project and Run), Collections (agents and teams), Instruments (agent devices) [design], Plug-ins (skills), Clips (Runs and acts), Templates (returned documents), Places (project tree and tasks), Packs (AIKit) [design], User Library (minted agents) | Roster, skill catalogue, Runs, project folders, returned-document templates | Delegations (act lifecycle) and Context (`NS/AGENTIC-CONVERGENCE.md:101-104`) | `FAE:12-30`; `SPEC:209-217` |
| Central | Current work (day and NOW), Collections (remembered), Plug-ins (skills), Clips (clearings, returns, flows), Templates (document forms), Places (Control tree and WORK), User Library (authored ground) | Day and NOW; authored skills; clearings and flows; forms; Control tree; human ground | Day detail: clearing or return reading [INFERENCE] | `CR/surfaces/navigator/WorldNavigator.tsx:14, 18-19, 125-128` |

### 5.6 Live-shell placement (recommendation only; no code changed)

- **INFERENCE:** keep one sidebar frame (5.3), and let the mode choose which category slots show and what they hold. This replaces the current whole-sidebar swap at `LS-app:268-269`.
- **INFERENCE:** do not add Sounds, Drums, MIDI Effects, Max for Live, Grooves or Tunings until their owner exists (5.4). This keeps the sidebar honest.
- **INFERENCE:** the Live-mirror `BrowserPane` (`LS/BrowserPane.tsx:10-37`) should show only categories with real content. It currently prints empty labels for most of them.

---

## 6. Candidate asset-type data model

Shape only. No code is proposed for adoption; this is the vocabulary the matrix uses. The model is open: owners register new kinds, and the skeleton does not change when they do.

```ts
// Open identifiers: owners register kinds; the skeleton never enumerates them.
type AssetKindId = string;                 // e.g. 'expression', 'material', 'lens', 'device-family', 'central-file', 'agent', 'skill', 'run', 'template', 'construction', 'clearing', 'flow', 'day'
type ModeId = 'expressions' | 'techne' | 'factory' | 'central' | (string & {});  // open for audio, epi-logos, or later modes
type AbletonFolder =                       // review-only reference label; never a routing key
  | 'Collections' | 'Sounds' | 'Drums' | 'Instruments' | 'Audio Effects' | 'MIDI Effects'
  | 'Modulators' | 'Max for Live' | 'Plug-ins' | 'Clips' | 'Samples' | 'Grooves'
  | 'Templates' | 'Places' | 'Packs' | 'User Library' | 'Current Project' | 'Tunings';

type Standing = 'built' | 'internal' | 'gated' | 'specified' | 'design';

type PreviewKind =
  | 'none'              // no audition exists
  | 'select-only'       // selection shows a description, nothing else
  | 'open-panel'        // opens the object's panel without changing the work
  | 'playback'          // plays material (e.g. Play passages)
  | 'render-preview'    // renders a non-mutating view of the asset
  | 'document-preview'; // renders a returned document

type InsertTarget =
  | 'none'
  | 'rack'              // Expression device rack
  | 'open-scene'        // object or formation added to the open Scene
  | 'chosen-controls'   // compact pinned controls
  | 'centre-lens'       // a lens presentation over the current subject
  | 'session-slot'      // clip or run slot in a session grid
  | 'agent-device'      // agent device face on a scope
  | 'day-track'         // Timeline day lane
  | (string & {});      // owners add their own targets

interface OwnerRef {
  id: string;           // the product or module that owns the asset, e.g. 'expressions-boundary', 'cradle.agency', 'central.control'
  operations: string[]; // native operation names; empty means read-only
}

interface BrowserAssetKind {
  id: AssetKindId;
  label: string;
  ableton?: AbletonFolder;   // nearest reference folder, if any; for review only
  owner: OwnerRef;
  standing: Standing;        // every kind declares how real it is
  list: 'read' | 'none';
  preview: PreviewKind;
  insert: InsertTarget[];    // empty means the kind cannot be inserted
  open: boolean;             // true if selecting opens the asset in the centre
  extra?: Record<string, unknown>; // open extension point for owner-specific facts
}

interface BrowserCategorySlot {
  id: string;                    // stable slot id in the constant skeleton
  label: string;                 // per-mode label allowed
  ableton?: AbletonFolder;
  kinds: AssetKindId[];          // registered kinds this slot can show
  showWhen: 'always' | 'has-content' | 'mode-only';
  modes: ModeId[];               // modes that may show this slot
}

type LowerPoolRole =
  | 'device-panel' | 'property-detail' | 'macro-mapping' | 'material-destination'
  | 'modulation-monitor' | 'lens-filters' | 'delegations' | 'context' | 'day-detail' | 'none';

interface ModeBrowserProfile {
  mode: ModeId;
  slots: BrowserCategorySlot[];  // rows shown in this mode, in skeleton order
  lowerPool: LowerPoolRole;
}

// The skeleton is fixed. Modes supply profiles; they never supply new regions.
interface BrowserSkeleton {
  search: true;
  collections: 'constant-slot';
  categories: 'constant-slot-list';
  results: 'single-list-pattern';
  lowerPool: 'single-frame-role-selector';
}

interface AssetKindRegistry {
  register(kind: BrowserAssetKind): void;   // owners call this; the skeleton does not change
  kindsFor(mode: ModeId): BrowserAssetKind[];
}
```

Design notes, each tagged:

- **INFERENCE:** `standing` is required on every kind, so a placeholder cannot look like a working asset. It is the matrix's status tag made type-level.
- **INFERENCE:** `ableton` is a review label, never a routing key. Routing by Ableton name would tie the product to Live's taxonomy.
- **EVIDENCE:** `OwnerRef` mirrors the existing rule that each domain has one native owner (`SHELLBP:27-30`, "one native owner per domain").
- **EVIDENCE:** `LowerPoolRole` matches the roles the owner's study already names (`NS/UI-UX-CONVERGENCE-STUDY.md:49`).
- **EVIDENCE:** `PreviewKind` separates selection, non-mutating panel opening and playback, which the code already distinguishes (`LS/NativeDeviceBrowser.tsx:26-28`; `LS/NativeMaterialBrowser.tsx:131`).
- **EVIDENCE:** the existing panel registry already does this kind of declaration: `browser-section` is a registered slot for additional native material (`packages/live-shell/ui/src/shell/panels.ts:23`; `packages/live-shell/ui/PANELS.md:10`). The data model extends that door rather than adding a new one.

---

## 7. Open questions for the owner

- **Q1. Row count.** The request says 15 types and 60 cells, but names 17 rows (68 cells). Confirm 17. Should Tunings (observed, not requested) be a row?
- **Q2. Modes.** Which four are the modes? The live shell has audio, expressions and techne. The cradle has base (Central), factory, expressions, techne, epi-logos and settings. The world-shell design says Central is not a mode. This matrix uses the cradle mapping. Confirm or correct.
- **Q3. Max for Live.** Which mode owns the M1 to M3 instrument host? All four modes show it as ABSENT. D-H (`SCOPE:254-256`) must decide the host before a slot can be filled.
- **Q4. Audio mode.** Should the Live-set audio mode be a fifth column? Audio Effects (Glue, Echo, Reverb), Instruments, Sounds, Drums and MIDI all have honest content there, and nowhere else.
- **Q5. Name collisions.** "Places" means folders in Ableton and a geographic lens in Technè. "Clips" means Expression scenes in Expressions and M3 notes in SCOPE. Rename, or keep the collision?
- **Q6. Modulators.** Are modulators browsable assets (a library of LFO and envelope shapes), or only per-parameter lanes? Expressions currently has the lanes, not a library.
- **Q7. Lens opening changes mode.** Should opening a lens from the sidebar switch the mode to Technè (`LS/NativeTechneBrowser.tsx:42`), or should the sidebar stay in the current mode?
- **Q8. Factory agents as instruments.** Are agent devices instruments (Instruments row) or a new asset kind? The Ableton list has no agent row, so the matrix currently maps them to Instruments by inference.
- **Q9. Preview standard.** Ableton audition is not in the evidence. Owner ruling needed: which preview kinds are required per asset, and must every preview be non-mutating?
- **Q10. Central left body.** Should the Central navigator (`WorldNavigator`) become a constant-skeleton category column, or keep its tree? The tree is the closest match to Places.

---

## 8. Limits and what I could not find

- **Not found:** a Browser class or browser folder list in the LOM inventory (`lom/LOM-INVENTORY.md`). The Ableton folder list rests on the captures and `BrowserPane.tsx:10`.
- **Not found:** captured evidence of Ableton audition or preview behaviour.
- **Not found:** Packs, User Library and Current Project as visible browser folders in the captures. Their existence on disk is cited from `SCOPE:49-54`.
- **Not read:** the contents of `RememberedRows` (Central), `DOCUMENT_FORMS` (Central forms, named only in messages), and the Factory left body's full row list beyond `FactoryNavigator`'s type View. Cells citing these are marked with what was seen.
- **Not run:** no app was started and no screenshot of the Factory or Central browsers was taken. Verdicts for those cells rest on code and accepted documents, not on a running application.
- **Discrepancy noted, not edited:** `UIE:51-52` omits Audio Effects and Modulators, which the captured screenshot shows. I did not edit the dossier, as the study is read-only.
- **Caveat on Factory cells:** `FAE` is an accepted working-experience document, and it describes intended behaviour. Factory cells marked `[specified]` are cited to it, not to running code.
