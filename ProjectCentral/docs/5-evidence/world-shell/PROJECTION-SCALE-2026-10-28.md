# Projection scale: how much the World and the graphs hold, and how they thin (28 Oct 2026)

O-I #773, a research ticket under the map #706. This document is evidence. It names the counts measured, the costs measured, the threshold at which each surface must change method, and the change each open ticket takes. The raw measurements are in [`projection-scale-2026-10-28/`](projection-scale-2026-10-28/). They hold counts and timings only. The scripts that produced them are in `method/`, with machine paths replaced by tokens.

The basis is O-I `57691e4e9` (`dlw/build-lane`), read from git, never from the shared working tree. The manual is cited at `ProjectCentral/docs/1-vision/dlw/DLW.md` as of `6aa2a26b7`.

## The answer in short

- **Yours holds about a thousand subjects, and the globe has none of them to plot.** The root Graph op returns 1,016 owner rows: 968 from AIKit, 42 hosted and 6 from the wiki. The atlas composes these into 1,007 occurrences. None is located and none is dated, because no owner declares a place or a time for any subject. Across the root and all 17 project registers, there are only 1,042 distinct refs. The Knowledge graph's root reading holds 974 nodes and 1,286 edges.
- **The Graph op is not the long pole.** The 88 s cold figure did not reproduce. At the root, every input answers in 0.07–1.7 s. The slowest single read is one register's first AIKit touch, at 10.0 s, which is AIKit re-deriving its knowledge. The same register then answers in 0.9–1.45 s.
- **The globe's cost is the GPU fill of its presences. Its CPU work does not grow with the count.** The globe draws individual presences up to **6,000 located occurrences in the pane** (measured: 4,028 gives a 7.9 ms frame; 11,260 gives 17.5 ms). Above that, presences aggregate by sphere cell, with counts. The same cell index serves picking.
- **The atlas graph's cost is set by its largest form, not by its node count.** Its cluster force (`field-force.ts`) repels every pair of dust inside a form. Yours puts 526 occurrences in one form: a tick takes 0.8 ms at ×1, 15.4 ms at ×4 and 204 ms at ×16. The bound is about 1,000 members in the largest form. Above that, the near field within a form becomes Barnes–Hut. The atlas graph's draw needs level of detail above about 2,000 drawn nodes or 4,000 drawn edges. The port's own founding field (3,456 nodes, 13,960 edges) already draws at 34 ms.
- **The Knowledge graph's cost is its layout, not its draw.** The worker's simulation takes 2.9 ms a tick at 974 nodes, 16.3 ms at 3,896 and 103 ms at 15,584. The draw stays at or under 9 ms up to 15,584. Live simulation stays at or under the manual's Budget maximum of 4,096 nodes. Above about 1,000 nodes, positions are published in batches rather than every tick. The Budget parameter itself (8–4,096, default 64) is not wired.

## Worlds

| World | State on this machine | Measured |
|---|---|---|
| Yours (`~/Central`) | Present. Read only: see the method below | Yes. Root register, all 17 project registers, the hosted field |
| Lived-in | **Absent.** The four starting worlds are #738, open and blocked by #717. No Lived-in folder exists here (`~/.oi-candidates/worlds` holds one Expression world, not a Central; `~/.workcell/worlds` is empty) | No |
| Bare, Arriving | **Absent**, for the same reason | No |
| The founding corpus (Archetypal-Earth `dist/data/field.json`, a public repository) | Present. It is the field the atlas port was designed on (`view.ts:8`: "~3,500 nodes and ~14,000 relations") | Yes, as the located reference. Counts and spatial spread only |

## Method and machine

**Machine.** Apple M4 (10 cores, 16 GB), macOS 26.5.2. The 1-minute load average is recorded on every read row (2.4–4.2 during reads, 2.4–6.3 during the browser runs, 6.1 during the ×64 composition). Installed owners: `ctrl` e3246d2142b0, `aikit` 395efaf838dd, `oi` 08df20494ed5.

**Reads (scripted channel).** A private `walk-bridge` was built from `git archive 57691e4e9` in a private target and run in the debug profile on 127.0.0.1:4773. `OI_HOME` and `OI_EXPRESSION_HOME` were in scratch, and the bridge called the installed owners directly.

- **Read only, enforced.** The bridge and every owner process it started ran under `sandbox-exec`, with file writes refused anywhere under the home directory (`method/readonly.sb`). The probe write into the world was refused.
- **AIKit cannot read under that rule.** Its graph read writes its open-lock: `aikit.sqlite-open.lock: Operation not permitted`. AIKit therefore read a copy-on-write clone of its home, with credentials removed, through `AIKIT_HOME`.
- **What was sent.** Each read was `POST /op {"op":"graph","project":…,"options":{"input":…,"max_nodes":4096,"max_edges":16384}}`. The public record keeps counts by kind and relation, bytes and wall time (`graph-op-reads.jsonl`), and the bridge's own per-op timing (`bridge-graph-op-timings.csv`). Project registers are indexed p01–p17, never named.

**Composition (scripted).** The atlas's own `composeSuite → buildModel → buildGraph` were run in Node through the repository tests' TypeScript loader (`atlas-suite-provider.test.mjs:14-30`). They ran over Yours' three root readings and the root `wiki.json` declarations, read verbatim. CPU time is `process.cpuUsage`.

**Surfaces (measured, headless).** The browser was Chromium 1248 (Chrome for Testing), headless with a visible document (`document.hidden` false), on ANGLE Metal on the M4 GPU, at a 1280×800 CSS viewport and DPR 2 (a 2560×1600 buffer).

- **Mounting.** A scratch Vite page mounted the atlas's own `GlobeEngine` and `GraphView` from source. A second scratch page mounted the cradle's `GraphCanvas` through React, laid out by its own `ForceWorld`.
- **How frames were timed.**
  - Globe frames were timed as `engine.frame(1/60)` followed by a 1-pixel `readPixels`, so the GPU's work is inside the measure.
  - Graph frames were timed as the view's own `step` and `draw`, followed by a 1-pixel `getImageData`.
  - The Knowledge graph's draws were timed by wrapping each animation-frame callback.
- **The in-app browser pane was not used.** It reports `document.hidden`.

**Synthetic multiples.** For ×k, every owner row and edge is repeated k times under a suffixed ref.

- **Globe.** Yours declares no place, so its occurrences took the founding corpus's positions and years in order, cycled. Each copy was moved by up to 0.5°.
- **Founding corpus.** It is multiplied the same way.
- **Multiplied rows keep their kind.** So a form's membership grows with k, as it would in a world with more subjects of the same kinds.

**Channels and limits.** All of this is scripted or measured on a headless run. None of it is computer-use on the native candidate, and none of it is acceptance. The read path is the HTTP walk-bridge, not the candidate's Tauri IPC.

## Counts

### What the Graph op returns from Yours

| Register · input (owner op) | Nodes | Edges | Bytes | Kinds |
|---|---|---|---|---|
| root · `central_wiki` (`central.wiki.read`) | 6 | 34 | 7.7 KB | 5 wiki-node, 1 wiki-space |
| root · `aikit_resolution` (`aikit.knowledge.graph`) | 968 | 1,252 | 1.22 MB | 531 knowledge-node, 329 capability, 79 knowledge-source, 25 knowledge-space, 3 action, 1 host |
| root · `shared_field` (`shared-field.projection`) | 42 | 59 | 33 KB | 18 hosted-practice, 7 hosted-wiki-node, 5 hosted-wiki-space, 4 hosted-curated-artifact, 8 others |
| root · `wiki_links` (derived) | 6 | 34 | 7.8 KB | 0 unresolved links |
| root · `all` (the three at once; AIKit through `knowledge resolve`) | 98 | 93 | 51 KB | 50 ai-kit, 42 hosted, 6 wiki |
| p01–p17 · `central_wiki` | 1–2 each | 0–3 each | 1.0–1.8 KB | — |
| p01–p17 · `aikit_resolution` | 459–757 each | 69–930 each | 236–941 KB | the same 329 capabilities in each, plus the register's own knowledge |
| **Union: root, 17 registers and the hosted field** | **1,042 distinct refs** | **922 distinct (relation, from, to)** | — | 999 ai-kit, 42 hosted, 1 wiki-only (the other wiki refs are also disclosed by AIKit) |

No reading was truncated at the default budget of 4,096 nodes and 16,384 edges (`graph.rs:91-96`). Yours' largest input stands at 24% of it. On 14 Oct the recorded root reading (`tests/fixtures/atlas-suite-reading.json`) held 6 wiki rows and 42 hosted rows, and AIKit was unavailable.

### What the surfaces would hold (Yours, composed by the atlas)

| Surface | Holds | Of which |
|---|---|---|
| World globe | 1,007 occurrences | **0 located, 0 dated.** `wiki.json` declares 0 places and 0 times, with 5 types, and no Graph row carries either (`suiteReading.ts:10-12`). 18 archetypes (registers), 17 forms |
| World graph side (atlas `GraphView`) | 1,042 nodes, 1,642 edges | 18 archetype, 17 family, 1,007 occurrence. Edges: 1,007 instance, 585 parallel, 50 tie. Largest form 526 members, then 329, 79, 24, 18. Σ(members²) = 392,179 |
| Knowledge graph (root, wiki and AIKit joined as `graphProgress.ts` joins them) | 974 nodes, 1,286 edges | — |
| Sky anchors | 10 bodies | Fixed by the sky contract (`skyProvider.ts:9-13`); independent of the world |
| Founding corpus (reference) | 2,854 occurrences; graph 3,456 nodes, 13,960 edges | 2,815 located (1,567 place, 1,039 region, 209 culture), all dated. 561 families (372 with members, largest 136; Σm² 106,414), 27 archetypes. The top ten 1° cells hold 47% of located occurrences |

## Costs

### The read

| Read | Kernel cold (first after start) | Kernel hit | Fresh (owner re-read) |
|---|---|---|---|
| root `central_wiki` | 0.125 s, which includes the World read (127 ms); the owner process takes 4.2 ms | 0.014 s | 0.009 s (Central's read model holds it) |
| root `aikit_resolution` | 1.66 s | 0.069 s | 0.90–1.01 s (6 runs); 0.96 s with AIKit's knowledge cache removed |
| root `shared_field` | 1.53 s | never held: the kernel always asks the hosted owner (`graph.rs:839`) | 1.04–1.15 s (6 runs) |
| root `all` | 1.10 s | — | — |
| per register `aikit_resolution`, first touch | 0.78–10.02 s, median 1.19 s; three registers at or above 4.5 s (p03 4.57, p16 4.71, p08 10.02) | — | p08: 0.93–1.45 s (6 runs). 8.59 s with AIKit's knowledge cache removed. Direct `oi aikit … knowledge graph` takes 0.79–0.86 s warm |

How the atlas loads (`suiteProvider.ts:176-180`). It reads the wiki, then the declarations, then the hosted field, then AIKit, one after another. AIKit races a 3 s grace (`:131`). AIKit's rows make 962 of the 1,007 occurrences (96%): without them the composition holds 45. The atlas reads the root register, whose first AIKit touch was 1.66 s, inside the grace. A first touch past 3 s, as p08's was at 10 s, would stand the World on 45 occurrences until the next reading.

### Transfer and parse (the root AIKit reading)

| ×k | Nodes | Bytes | V8 `JSON.parse` CPU |
|---|---|---|---|
| 1 | 968 | 1.22 MB | 2.1 ms |
| 4 | 3,872 | 4.79 MB | 7.8 ms |
| 16 | 15,488 | 19.1 MB | 33 ms |
| 64 | 61,952 | 76.4 MB | 173 ms |

Each node costs about 1.24 KB on the wire. At the kernel's validated maximum of 20,000 nodes (`graph.rs:109`), one input would be about 25 MB. The bridge's kernel-hit round trip for the 1.22 MB reading was 69 ms, in a debug build over HTTP.

### Composition (CPU, Node)

| ×k | Occurrences | `composeSuite` | `buildModel` | `buildGraph` |
|---|---|---|---|---|
| 1 | 1,007 | 28 ms | 5 ms | 9 ms |
| 4 | 4,028 | 101 ms | 23 ms | 39 ms |
| 16 | 16,112 | 339 ms | 126 ms | 53 ms |
| 64 | 64,448 | 2,361 ms | 1,518 ms | 257 ms |

`buildModel` grows faster than its input: ×4 the rows costs ×12 the time between 16k and 64k. In the browser the same step took 84 ms at 64k and 447 ms at the founding ×64 (180k).

### The globe (`GlobeEngine`, measured)

| Field | Located | Frame at rest, median / p95 | Draw and GPU finish | Draw without presences | **Presences' draw** | Pick (per pointer move) |
|---|---|---|---|---|---|---|
| Yours ×1 | 1,007 | 6.4 / 7.4 ms | 4.8 ms | 4.4 ms | 0.4 ms | 0.1 ms |
| Yours ×4 | 4,028 | 7.9 / 10.6 | 6.0 | 3.7 | 2.3 | 0.4 |
| founding ×1 | 2,815 | 5.8 / 7.5 | 5.7 | 4.0 | 1.7 | 0.4 |
| founding ×4 | 11,260 | 17.5 / 26.3 | 11.2 | 3.5 | 7.7 | 0.8 |
| Yours ×16 | 16,112 | 26.2 / 37.6 | 16.0 | 3.8 | 12.2 | 1.6 |
| founding ×16 | 45,040 | 73.8 / 93.2 | 49.6 | 3.8 | 45.8 | 2.8 |
| Yours ×64 | 64,448 | 120.4 / 147.0 | 76.5 | 3.6 | 72.9 | 5.8 |
| founding ×64 | 180,160 | 322.7 / 379.2 | 224.4 | 3.2 | 221.2 | 11.3 |

- **CPU per frame.** The frame's CPU work without the draw stays at or under 0.2 ms at every count. The level easing (`presences.ts:232`) takes at most 0.2 ms per frame at 180k.
- **The density pass.** The splat into the 1024×512 texture (`:121`, `:246`) took about 0.1 ms when forced. It ran 0 times in 90 rest frames.
- **Time playing.** Forcing the density pass and a filter's ease every frame gave a frame no slower than at rest.
- **Why the rest frame is above the draw.** The rest frames were taken first, before the GPU's clock had settled. The presences' share is the draw and finish minus the draw without presences.

### The World's graph side (`GraphView`, measured)

| Field | Nodes / edges | Largest form | Tick | Settling | Draw at rest, median / p95 |
|---|---|---|---|---|---|
| Yours ×1 | 1,042 / 1,642 | 526 | 0.8 ms | 65 frames, 1.5 s | 8.2 / 18.0 ms |
| founding ×1 | 3,456 / 13,960 | 136 | 1.7 ms | 52 frames, 2.4 s (each frame 42 ms) | **33.7 / 34.4 ms** |
| Yours ×4 | 4,063 / 6,418 | 2,104 | 15.4 ms | 104 frames, 3.5 s | 16.0 / 16.3 ms |
| founding ×4 | 12,018 / 51,793 | 544 | 5.8 ms | 99 frames, 4.9 s | 38.8 / 42.9 ms |
| founding ×16 | 46,266 / 203,125 | 2,176 | 66 ms | about 104 ticks, about 7 s | 46.2 / 49.0 ms |
| Yours ×16 | 16,147 / 25,522 | 8,416 | 204 ms | about 104 ticks, about 21 s | 36.0 / 40.0 ms |
| Yours ×64 | 64,483 / 101,938 | 33,664 | 2.4–3.7 s | minutes | 80.6 / 90.1 ms |

The tick follows Σ(members²) of the forms, not the node count. The founding field at ×4 has three times the nodes of Yours ×4 and ticks in a third of the time.

### The Knowledge graph (`ForceWorld` in Node; `GraphCanvas` in the browser)

| ×k | Nodes / edges | Tick (CPU) median / p95 | 300 ticks (settle) | Per-tick publish (`structuredClone`) | Draw per pan frame, whole wiki in view, median / p95 |
|---|---|---|---|---|---|
| 1 | 974 / 1,286 | 2.9 / 6.1 ms | 1.0 s | 0.36 ms | 2.4 / 4.4 ms |
| 4 | 3,896 / 5,144 | 16.3 / 20.2 ms | 5.0 s | 1.4 ms | 5.0 / 7.2 ms |
| 16 | 15,584 / 20,576 | 103 / 164 ms | about 31 s | 5.7 ms | 9.0 / 10.3 ms |
| 64 | 62,336 / 82,304 | 619 / 956 ms | about 3 min | 25 ms | — (past the kernel's 20,000 maximum) |

Pointer-move handlers took at most 0.1 ms at every size.

## Thresholds, and the method each surface adopts

### World globe (§17.2)

- **Individual presences up to 6,000 located occurrences in the pane.** That is today's one instanced draw. 4,028 holds a 7.9 ms median and 10.6 ms p95; 11,260 is already at 17.5 ms. Yours today has 0 located occurrences, and 1,007 if every subject declared a place.
- **Above 6,000, aggregate by sphere cell.** A fixed spherical cell index (equal-angle or geohash buckets over the occurrence's direction) is built once per Field change, in the composition, never per frame. At System and Body scale, one presence stands per occupied cell, carrying its count. Individual presences return inside a cell once its screen area admits them, at Region and Place scale.
  - The density texture stays as it is: its pass costs about 0.1 ms.
  - The count follows the manual: "What lies just past the edge of your view is counted and offered" (DLW.md:3278).
  - Precision keeps its look: "An approximate place does not look exact" (:3406). A cell never makes an approximate place look exact, and a mythic occurrence keeps its look (:3408).
- **Picking uses the same index once aggregation is on.** Today's linear scan costs 1.6 ms at 16k and 5.8 ms at 64k, once per pointer move inside the frame.
- **Load.** Composition and `buildModel` stay on the main thread up to 16k (465 ms of CPU at 16k). Above that they run in a worker. `buildModel`'s growth faster than its input is fixed before any promise above 16k is made.
- **The idle body stays still** (:3411). The engine already draws presences at rest without any per-occurrence CPU work.

### World, graph side (§17.2 "The graph view")

- **Layout.** The largest form's membership is held to about 1,000 or less, which keeps Σm² to about 1.5M pair checks and a tick to about 6 ms. Measured: 526 members gives 0.8 ms; 2,104 gives 15.4 ms.
  - Above that, the near field inside a form becomes Barnes–Hut: a quadtree per form, at the theta the far field already uses (`field-force.ts:5-7`, `:256`). This replaces `forceCluster`'s all-pairs loop.
  - The alternative is to sample the dust shown per form and show the count of the rest.
- **Draw.** Level of detail starts above about 2,000 drawn nodes or 4,000 drawn edges. At those sizes the Canvas 2D draw passes about 10 ms at DPR 2 (8.2 ms at 1,042 / 1,642; 16 ms at 4,063 / 6,418).
  - Below a zoom threshold, the dust is drawn as its form's halo with a count.
  - Dust ties are drawn only for the hovered or selected neighbourhood.
  - The manual's own controls are the thinning: "Choose which occurrences show as dust around a node … which tiers of node show" (:3298).
  - The founding field draws at 34 ms. The level of detail is owed even at the port's design scale.
- **The graph keeps no data of its own** (:3296). Thinning is presentation only, and every hidden count is said.

### Knowledge graph (§17.3)

- **Budget.** The Budget is wired as the manual has it: 8–4,096 nodes, default 64, and "The graph says when it hides more" (:3493).
  - Today the surface asks every input for 4,096 (`KnowledgeSurface.tsx:157` passes no `maxNodes`; `graphProgress.ts:44`). It says only "a bounded reading" when the kernel truncates (`GraphFilters.tsx:57`).
  - The Budget bounds the drawn and simulated set: by hops from the selected note first (:3455), then by degree. The hidden count is said.
- **Live simulation up to 4,096 nodes.** That settles in about 5 s of worker CPU at 3,896 nodes.
  - "Whole wiki" past the Budget does not live-simulate. It starts from the retained arrangement (`layoutIdentity`), settles without publishing and publishes once.
- **Publication.** Batched above 1,000 nodes: at most every 100 ms of worker time, and once at the end.
  - Today every tick posts every point (`layout.worker.ts:20`) and rebuilds a `Map` on the main thread (`useLayout.ts:31`). At 3,896 nodes that is 300 posts of about 1.4 ms of cloning each, before React renders.
- **Draw is not the limit up to 15,584 nodes** (9 ms). Viewport culling and the one edge path already hold it. The minimap, which shows all nodes (:3457), is drawn inside the measured frame.

### The Graph op (all three surfaces)

- **Budgets.** They stand at 4,096 nodes and 16,384 edges per input. Yours uses 24%.
- **The atlas reads the hosted field and AIKit beside each other.** The kernel already does this for `all` (`graph.rs:362`). This brings the World up at about the slower of the two (about 1.5 s), instead of their sum plus the wiki (about 3 s).
- **AIKit's first touch of a register (up to 10 s) is AIKit's own re-derivation.** It is not the Graph op's. It belongs to AIKit's read-cost work.

## What the atlas port already does

- **Globe.**
  - One instanced draw for every presence, and one instanced splat pass into an equirect density texture, three copies across the dateline (`presences.ts:1-2`, `:58-125`).
  - The density is redrawn only when time or emphasis changes (`:246-266`).
  - CPU picking with horizon and level gates, "so the field can hold thousands of points without picking buffers" (`:275-318`). There is no spatial index.
  - The CPU loop over occurrences runs only while a filter eases (`:225-240`).
  - 16 spare slots for an in-place seam insert (`:12`).
  - Frustum culling is off; the shader culls (`:94`).
- **World graph side.**
  - Canvas 2D, drawn only on change, then idle (`view.ts:1-6`).
  - Barnes–Hut over forms only, with the dust carried by its form (`field-force.ts:1-7`). Pairwise repulsion inside each form (`:229-275`).
  - At most two ticks, within 6 ms, per frame (`view.ts:47-48`).
  - A d3-quadtree for hit testing, rebuilt when stale (`:1370`).
  - Halos cached per colour, and stars on their own canvas.
  - A settled layout kept between visits (`settings.ts`).
- **Knowledge graph.**
  - A layout worker with a seeded phyllotaxis start and positions retained across topology changes (`layout.ts`, `useLayout.ts`).
  - Barnes–Hut `forceManyBody` (`layout.ts:120`).
  - Viewport culling and one stroked path for the edges (`GraphCanvas.tsx`).
  - Linear hit testing over on-screen nodes.
- **Prior art.** research-canvas#41 (T12, closed) asked for "all located nodes" on a globe and set no scale contract.

## Tickets it changes

- **#740 Foundations and loading.**
  - Replace "the Graph op at 88 s cold and `knowledge resolve` at 20 s" with this finding's figures. At the root, every input answers in 0.07–1.7 s and `all` in 1.1 s. The slowest is one register's first AIKit touch, at 10.0 s, which is AIKit's re-derivation.
  - Add: the atlas's suite load reads the hosted field and AIKit beside each other (`suiteProvider.ts:176-180`). Its 3 s grace stays the bound for the first standing.
  - Add: AIKit's graph read writes its home (the open-lock), so it cannot run against a read-only world. That is for AIKit's read path.
- **#742 Technē's construction chain** (the World's graph side and the Knowledge graph are its instruments).
  - Add to its done-when for the World's graph side: a field whose largest form holds 1,000 or fewer settles within 5 s and pans at 30 fps or better. Above that, the near field per form is Barnes–Hut and the dust thins with its count shown.
  - Add the same for the Knowledge graph: the Budget parameter is wired (8–4,096, default 64, the hidden count said); live layout stays within the Budget; positions publish batched above 1,000 nodes.
- **#745 The readings the device designs wait on.** Add **a place and a time for each subject, from its owner**: the wiki node's `place` and AIKit's `aikit.techne-facet/v1` declarations. Yours' 1,007 occurrences carry neither, so the World's Place scale, the occasion window (§17.2) and every globe promise have nothing to draw until they are delivered.
- **#746 Procedural bodies.** The locations on a body, its routes and its outer ring adopt the globe's thresholds: individual up to 6,000 in the pane, aggregated by cell with counts above that, and picking through the cell index.
- **#738 The four starting worlds.** Once Lived-in exists, re-run this measurement on it (the `method/` scripts take any world root). Until then every promise here stands on Yours and synthetic multiples.

## Open

- **The Tauri IPC transfer in the native candidate is unmeasured.** These reads went over the debug walk-bridge's HTTP.
- **The native candidate's own frame times are unmeasured** (no computer use in this lane). The headless GPU figures are on the M4 at DPR 2. A smaller pane or DPR 1 lowers fill. A weaker GPU (Omarchy) raises it.
- **The 88 s of 15 Oct cannot be re-run on that day's owners.** It is recorded as not reproduced, not as explained.
- **The cause of `buildModel`'s and `composeSuite`'s growth above 16k is not traced.** Yours sits at 1k.
- **The aggregation cell size and the switch-over scale are not fixed here.** They are a design reading against §17.2's five scales.
