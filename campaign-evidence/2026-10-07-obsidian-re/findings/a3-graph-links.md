# Lane A3 dossier — Link resolution and graph construction (Obsidian 1.7.7)

Lane: A3 of the 2026-10-07 Obsidian RE campaign. Serves the O-I cradle rebuild
(Rust/Tauri, later, clean-room from this doc).

## Scope & method

**Pinned target:** `/Applications/Obsidian.app` bundled **Obsidian 1.7.7**
(CFBundleVersion 0.14.8). All offsets below are byte offsets (file is a
single-line minified bundle) into
`shared/obsidian-asar-extracted/app.js` (renderer, 2,989,294 bytes) or
`.../worker.js` (226,434 bytes) unless labeled `main.js` (Electron main,
32,016 bytes). The shared bulk REA of this tree failed (schema rejection on
the 3 MB app.js), so analysis was done by `grep -bo` + byte-window extraction,
per the parent coordinator's instruction.

**Dynamic confirmation:** two isolated runs of the pinned app against a
purpose-built fixture vault (12 md files + 4 attachments; full inventory in
"Observed transcripts / fixtures" below — path `lanes/a3/fixture-vault/`), launched as:

```
/Applications/Obsidian.app/Contents/MacOS/Obsidian \
  --user-data-dir=<lane>/userdata[2] \
  --remote-debugging-port=9224|9225 \
  "obsidian://<abs-path-to-fixture-vault>"
```

Findings on the launch method itself (RE results):

- `--user-data-dir` **is honored** by this build (all Chromium profile dirs
  and the vault registry land in the given dir; real
  `~/Library/Application Support/obsidian/` verified untouched by mtime scan
  after both runs).
- A bare vault path on argv is **not** handled by the Electron main;
  `main.js:31927` (`Pe`) only recognizes argv entries starting
  `obsidian://`; `main.js:~30235` (`pe`) turns `obsidian:///<abs-path>` into
  an open-vault action. That is the working CLI vector.
- Vault registry: `<userData>/obsidian.json`, shape
  `{"vaults": {"<id>": {"path": ..., "ts": ..., "open": true}}}`
  (`main.js:~11947`). Pre-seeding it in the scratch userData skips the vault
  picker.
- `window.app` **is exposed globally in the renderer** (`app.js:2989236`,
  `window.app=new h1(o,n)` inside `ready()`), which made a CDP dump possible
  without installing a plugin.

**Deviation from the brief's "minimal test plugin" plan:** a community plugin
cannot load in a fresh userData. Plugin enable is gated by
`localStorage.getItem("enable-plugin-"+appId) === "true"`
(`app.js:2209461`, `isEnabled`); a fresh userData has no such key, the plugin
system stays in restricted mode and, when manifests exist, shows the
"Trust author" modal (`app.js:2205255`). Rather than fight the trust gate,
the dump was taken over CDP `Runtime.evaluate` against `window.app`
(`lanes/a3/run/cdp-dump.js`). The trust mechanism itself is recorded here as
an RE finding.

**Runs:** run 1 (`userdata`, port 9224) produced
`lanes/a3/dump/a3-metadata-dump.json`. Run 2 (`userdata2`, port 9225) opened
the graph view and produced `lanes/a3/dump/graph-links-live.txt` and
`lanes/a3/dump/graph.json.persisted-defaults.json`. Both instances were shut
down cleanly (Browser.close); only PIDs started by this lane were ever
killed/signaled.

**PINNING CAVEAT (verified live):** ~60 s after each launch the auto-updater
downloaded `obsidian-1.14.4.asar` into that run's scratch userData (run 1
log: `lanes/a3/dump/run1-obsidian-stdout.log`, lines "Latest version is
1.14.4 … Update complete."). The running instance nevertheless used the
bundled code — three independent pins: startup log line "Loading main app
package /Applications/Obsidian.app/Contents/Resources/obsidian.asar";
CDP `ipcRenderer.sendSync("version")` = `"1.7.7"`; window title "… Obsidian
v1.7.7". **No relaunch was performed in a userData that contains the newer
asar**; any relaunch there would execute 1.14.4. All findings below pin to
the bundled 1.7.7 code; deltas in 1.13.7/1.14.4 are unknown and out of
scope. The owner's daily app (1.13.7 via shadowing asar in real userData)
may differ in details flagged medium/low confidence.

---

## Findings

### F1. Link syntax recognized by the metadata cache

**Behavior.** The cache worker (worker.js, `self.onmessage` handler at
~224850) parses markdown and emits per-file caches. Recognized link forms,
all confirmed in the fixture dump (`a3-metadata-dump.json`, `perFile`):

| Form | Cached as | `link` field | `displayText` |
|---|---|---|---|
| `[[Target]]` | `links[]` | `Target` | `Target` |
| `[[Target|Alias]]` | `links[]` | `Target` (alias not in link) | `Alias` |
| `[[Note#Heading]]` | `links[]` | `Note#Heading` | `Note > Heading` |
| `[[#Heading]]` (bare subpath) | `links[]` | `#Heading` | `Heading` |
| `[[Note#h1#h2]]` (nested) | `links[]` | `Note#h1#h2` | `Note > h1 > h2` |
| `[[Note#^blockid]]` | `links[]` | `Note#^blockid` | `Note > ^blockid` (unresolved paths only; for resolvable ones display falls back) |
| `![[Note]]`, `![[img.png]]`, `![[doc.pdf]]` | `embeds[]` | same rules | same rules |
| `[t](Note.md)` | `links[]` | `Note.md` | `t` (the md link text) |
| `[t](Note)` (no ext) | `links[]` | `Note` | `t` |
| `[t](Note.md#Heading)` | `links[]` | `Note.md#Heading` (`%20` decoded) | `t` |
| `[t](file.pdf)`, `[[data.csv]]` | links/embeds to non-md | `doc.pdf` / `data.csv` | as above |

- LinkCache/embedCache entry shape (worker.js ~225181): `{position:{start,end}
  (0-based line/col/offset), link, original, displayText}`; `original` is the
  raw source text (`"[[Bravo|Bee]]"`, `"[Alpha heading](Alpha.md#Section%20One)"`).
- A wikilink target becomes `link` after splitting off `|alias` (worker.js
  `wn` at 205472: split on first `|`; trailing `\` dropped; NFC-normalized).
- Markdown-link hrefs are converted to internal links when they start with
  `./`/`../` or contain no `:` (worker.js `vn` at 205206); the URL is
  `decodeURI`d.
- displayText defaults to the path with `#` parts joined by `" > "` (worker.js
  `kn` at 205472 region) or the alias when present.

**Evidence:** dump `perFile.Alpha.md.links`, `perFile.Bravo.md.links/embeds`
(transcript below); worker.js offsets 205206/205472/224850-225300.
**Confidence:** high (static + fixture). **Limitations:** exotic syntax
(`[[a\|b]]` escapes, `![[Note#heading]]` display text for resolvable
subpaths) not individually fixture-exercised.

### F2. Block-id definition grammar

**Behavior.** A block id is `^` followed by `[a-zA-Z0-9-]+` only (no
underscore, no digits-only restriction). It is recognized as a tokenizer when
the `^` is preceded by whitespace, and as a paragraph-end annotation matching
`/^\^([a-zA-Z0-9\-]+)(?=$|\n$|\n\n)/` — i.e. at the very end of a paragraph
block (worker.js ~213777-214155). The per-file cache stores
`blocks[id.toLowerCase()] = {position, id}` for any block carrying the id
(also list items, which additionally appear in `listItems[]` with `id`).

**Evidence:** worker.js offsets above; dump `perFile.Alpha.md.blocks` =
`["bid1","item1"]` for `… end of paragraph. ^bid1` and `- A list item with an
id ^item1`.
**Confidence:** high. **Limitations:** block ids on other block types
(quotes, code fences) not individually fixture-tested; grammar is from the
regex, exhaustive per the tokenizer code.

### F3. Heading/block subpath resolution (navigation/preview), and what a stale subpath does

**Behavior.** `parseLinktext` (`YE`, app.js:872306) splits a link at the
FIRST `#` into `{path, subpath}`; everything from the first `#` on is
subpath. `resolveSubpath` (`iS`, app.js:873027) then:

- single part starting `^`: block ref — looks up `blocks[part[1..].toLowerCase()]`
  (case-insensitive against the lowercased-key map), also locating the
  matching `listItems[]` entry; returns `{type:"block", block, list, start, end}`.
- single part starting `[^`: footnote lookup by label.
- otherwise: heading match — the subpath is split on `#`; the parts are
  matched hierarchically against `headings[]`: each successive part must match
  `stripHeading(heading).toLowerCase()` (case-insensitive; `stripHeading`
  `tS` at 872164 region removes `!"#$%&()*+,.:;<=>?@^`{|}~/[]\` and newlines,
  collapsing whitespace) at a strictly deeper level than the previous match.

**A stale/renamed heading or missing block id does NOT unresolve the link.**
Link resolution (F4) strips the entire subpath before resolving; the dump
proves `[[Missing#Head]]` is unresolved only because `Missing` is missing,
and `BlockRef.md` has `resolvedLinks = {Alpha.md: 3}` where the 3 links are
`[[Alpha#^bid1]]`, `![[Alpha#^bid1]]`, `![[Alpha#Section One]]` — subpaths
never appear in resolved/unresolved keys. A renamed heading leaves the graph
edge intact; only deep-link navigation/preview fails (resolveSubpath returns
null — static reading).

**Evidence:** app.js offsets 872164 (`KE` strip-at-`#`), 872306 (`YE`), 873027
(`iS`), plus dump transcript. **Confidence:** high for resolution; medium for
the exact post-failure navigation UX (not tested).

### F4. The resolution algorithm (rule chain), fixture-proven

**Behavior.** For each source file, `resolveLinks` (app.js:~1893300) iterates
`frontmatterLinks + links + embeds` (helper `XE` at 872410 — frontmatter
links count!), strips the subpath with `KE` (872164) and resolves the
remaining linkpath with `getFirstLinkpathDest` → `getLinkpathDest`
(app.js:1886011). The full rule chain (minified names de-minified):

1. **Subpath strip:** `linkpath = link.upToFirstHash()`.
2. **Empty linkpath** (e.g. `[[#Section]]`) → resolves to the source file
   itself (self-reference).
3. **Lowercase** the linkpath; take its **basename** (text after last `/`,
   `Dc` at 531222).
4. If the basename **contains a dot**, look it up in the file-lookup multimap
   (keyed by lowercased file basename incl. extension — `uniqueFileLookup`
   `Vl` at 519495, `add(e.name.toLowerCase(), e)` at 1894429).
5. If that missed (or no dot), **append `.md`** to both and retry.
6. Still no candidates → **unresolved**.
7. If the candidates are unique and the linkpath had no folder part → that
   file wins outright.
8. **Relative forms first:** if the (lowercased) linkpath starts `./` or
   `../`, it is joined onto the source file's folder (`Ac` = dirname,
   531290; `../` climbs) and the FIRST candidate whose full lowercased path
   equals that is returned.
9. **Exact path:** a leading `/` is stripped; the first candidate whose full
   lowercased path equals the linkpath (+`.md` if appended) is returned.
10. If the original linkpath started with `/` and step 9 found nothing →
    unresolved.
11. **Ambiguity fallback:** among candidates whose full lowercased path
    **ends with** the linkpath, prefer those whose path starts with the
    source's folder, then sort each group by **shortest path length**
    (`rU` at 1882040: `a.path.length - b.path.length`) and take the first.

Fixture-proven consequences (dump `probes` + `resolvedLinks`):

- **Case-insensitive everywhere:** `alpha`, `ALPHA`, `ALPHA.MD`, `bravo`,
  `Selfloop`, `Sub/Target` all resolve (probes → dest).
- **Extension optional for md, taken literally otherwise:** `Alpha.md`,
  `FM-Link.md` resolve; `data.csv` → `attach/data.csv`, `doc.pdf` →
  `attach/doc.pdf`, `img.png` → `img.png` (basenames are unique per name, so
  folder of the attachment is irrelevant).
- **Exact-path beats same-folder basename preference.** `[[Target]]` written
  in `sub/Sibling.md` resolved to ROOT `Target.md` (its full path equals the
  linktext; step 9 precedes step 11), while `[[./Target]]` in the same file
  resolved to `sub/Target.md` (step 8 precedes step 9). Dump:
  `sub/Sibling.md → {Target.md: 2, sub/Target.md: 2, Alpha.md: 2}` where the
  Target.md pair is `[[Target]]` + `[sib](Target.md)` and the sub pair is
  `[[sub/Target]]` + `[[./Target]]`.
- **Ambiguous from another folder → root (shortest/exact) wins:**
  `[[Target]]` from `other/FromOther.md` → `Target.md`.
- **Relative forms are strict:** `[[./Target]]` from `other/` → None;
  `[[../Alpha]]` and `[up](../Alpha.md)` from `sub/` → `Alpha.md`.
- **Empty linkpath** `''` from `Alpha.md` → `Alpha.md`.
- **Absolute form works:** `/Alpha`, `/sub/Target` resolve (leading `/`
  stripped).
- **Aliases never resolve.** Frontmatter `aliases: [A-One, A2]` (Alpha.md):
  probe `A-One` → None. Aliases participate only in link *suggestions*
  (`getLinkSuggestions`, app.js:~1884400, reads `parseFrontMatterAliases`
  `TE` at 866622 — frontmatter key matching `/^alias(es)?$/i`, string or
  string array; suggestion entries carry `{file, path, alias}`). Nothing in
  the resolution path reads aliases. Consequently aliases add nothing to
  graph or backlinks; a node is always the file, never the alias.
- **Unresolved key normalization** (`iU`, app.js:1881876): subpath already
  stripped by `KE`; trailing `.md` removed iff the remaining extension is
  `md`; case preserved as written; alias dropped. Fixture: `Alpha.md`
  unresolved = `{Missing: 3}` — `[[Missing]]`, `[[Missing#Head]]`,
  `[[Missing.md]]` all collapse to the key `Missing` with count 3;
  `other/FromOther.md` unresolved = `{Nothing: 1 (alias dropped),
  ghost.png: 1 (non-md ext kept), Ghost: 1 (from md link [ghost md](Ghost.md))}`.
- **Frontmatter links create real graph links.** `FM-Link.md` frontmatter
  `related: "[[Alpha]]"` → cache `frontmatterLinks[0] =
  {key:"related", link:"Alpha", original:"[[Alpha]]", displayText:"Alpha"}`
  and `resolvedLinks["FM-Link.md"]["Alpha.md"] = 1`; the backlink appears in
  `getBacklinksForFile(Alpha.md)`. Only string values whose ENTIRE text is
  `[[...]]` become frontmatterLinks (worker.js `$n` at ~224850); arrays and
  nested objects are recursed (keys become dotted `a.0.b`).

**Evidence:** offsets above; fixture dump `probes` (37 cases),
`resolvedLinks`, `unresolvedLinks`, `backlinks`. **Confidence:** high.
**Limitations:** step 11's same-folder-preference branch was never the
deciding rule in any fixture case (steps 8/9 decided every collision); the
branch is read from code (medium-high). Insertion-order effects inside the
basename multimap (two same-basename files created in one session) untested.

### F5. MetadataCache structures a graph builder consumes

**Behavior.**

- `metadataCache.resolvedLinks`: `{sourcePath: {targetPath: linkCount}}`.
  Every parsed md file is a key (value `{}` when it has no resolving links —
  Orphan.md, Tags.md, Target.md, sub/Target.md all appear with `{}`).
  Counts are per link OCCURRENCE (Alpha→Bravo counted 2 from `[[Bravo]]` +
  `[[Bravo|Bee]]`), dedup NOT applied at this layer, embeds and frontmatter
  links included, self-references included (`Alpha.md → Alpha.md: 5`).
- `metadataCache.unresolvedLinks`: `{sourcePath: {unresolvedKey: count}}`,
  same keying (all parsed md files present).
- Per-file cache (`getFileCache`): `{links[], embeds[], tags[] (inline only),
  headings[], footnotes[], sections[], listItems[], blocks{} , frontmatter,
  frontmatterPosition, frontmatterLinks[]}` (worker.js `onmessage` ~224850).
  Frontmatter `tags` are NOT in `tags[]`; `getTags()` (app.js ~1885100) merges
  frontmatter + inline tags and walks the hierarchy (`a/b` also counts `a`),
  merging case-insensitively and keeping the most frequent casing as canonical.
- **Backlinks are not stored.** `getBacklinksForFile(file)` (app.js:1887940)
  computes on demand: iterate every file's `frontmatterLinks+links+embeds`
  (`iterateReferences`/`XE`), resolve each link from its source, collect
  where the destination is the given file; returns a multimap
  `sourcePath → [reference objects]`. A Rust rebuild may keep a materialized
  inverted index; Obsidian 1.7.7 recomputes.
- Resolution pipeline/rebuild triggers: worker "Metadata Cache Worker"
  parses per file; `resolveLinks(source)` fills the two maps
  (app.js:~1893323); on file create,
  `updateRelatedLinks([name])` (app.js:~1893540) re-queues every source whose
  resolved or unresolved keys mention the new name (name lowercased, plus a
  `.md`-stripped variant) — i.e. creating `X.md` re-resolves dangling `[[X]]`
  links; delete/rename maintain the maps and the basename multimap
  (`onDelete` 1896345 area, `onRename` 1896444).
- Link format for new links (`fileToLinktext`, app.js:~1888100): config
  `newLinkFormat` = `absolute` | `relative` | shortest-wins default.

**Evidence:** dump (all structures above captured), offsets above.
**Confidence:** high. **Limitations:** `listItems`/`sections`/`footnotes`
shapes captured but not deeply exercised; embedded-cache `original` field is
present in 1.7.7 (the `delete h.original` branch at worker.js ~225181 is
gated by an option that is off).

### F6. Graph view construction (global graph)

**Behavior.** The engine (`render` at app.js:~2028300, engine defaults `Sj`
at ~1990074) builds:

- **Node set:** every file in the metadataCache index (`getCachedFiles()`) —
  md always; attachments (non-md) only when `showAttachments`; each must pass
  the search filter and not be user-ignored. Plus **unresolved phantom
  nodes** (type `"unresolved"`, node id = unresolved key, deduplicated by
  key, only when `hideUnresolved` = false). Plus **tag nodes** (type `tag`,
  one per case-merged tag, edges source→tag, only when `showTags`).
- **Edge set:** for each included source node, one edge per entry of its
  `links` map — i.e. **one edge per unique (source → target) pair**;
  parallel links collapse (count is lost in the graph); a pair survives only
  if BOTH endpoints pass the filters (attachment targets dropped unless
  `showAttachments`; unresolved targets dropped when `hideUnresolved`).
  **Self-loops are pairs too** (present in `links`, counted in the edge
  list, but excluded from orphan determination).
- **Orphan:** a node with no outgoing edge to an EXISTING node and no
  incoming edge from any node — self-loops don't count as either
  (prune function after the builder: nodes not linked-to and not
  linking-out are deleted). Pruning runs when `showOrphans` is **false**;
  the DEFAULT is `showOrphans: true` (orphans kept) per both the engine
  defaults and the persisted `.obsidian/graph.json` captured in the fixture.
  Consequence (from code + dump): `SelfLoop.md` (only self-loop links) and
  `Orphan.md` (no links) are both orphans; with default settings both are
  shown, with the Orphans toggle off both disappear.
- **Filters:** the `search` text filters FILES (a file must match to be
  included; non-matching files are pruned entirely when any filter is
  active); **groups** (`colorGroups`) are ordered query+color pairs — a file
  matching a group query gets that group's color, first match wins; colors
  never prune, queries prune. `hideUnresolved` is the UI "Existing files
  only" toggle (i18n `option-show-existing-files-only`), `showAttachments`
  the "Attachments" toggle, `showTags` the "Tags" toggle, `showOrphans` the
  "Orphans" toggle. Tag nodes are filtered by the query's `matchTag`;
  attachments by `matchFilepath` with type "attachment".
- **Persisted config** (`.obsidian/graph.json`, created when the view is
  opened; captured file):
  `{"collapse-filter":true,"search":"","showTags":false,"showAttachments":false,
  "hideUnresolved":false,"showOrphans":true,"collapse-color-groups":true,
  "colorGroups":[],"collapse-display":true,"showArrow":false,
  "textFadeMultiplier":0,"nodeSizeMultiplier":1,"lineSizeMultiplier":1,
  "collapse-forces":true,"centerStrength":0.518713248970312,"repelStrength":10,
  "linkStrength":1,"linkDistance":250,"scale":1,"close":false}`

**Dynamic confirmation (run 2, default options):** live renderer state
`nodes = 16`, `links = 19`. Predicted from the dump: 12 md files + 4
unresolved (`Missing`, `Ghost`, `Nothing`, `ghost.png` — `Ghost` deduped
across two sources) = 16; 19 unique pairs = the resolvedLinks/unresolvedLinks
union collapsed to unique source→target pairs including self-loops
`Alpha.md→Alpha.md` and `SelfLoop.md→SelfLoop.md`, with all attachment
edges (data.csv, doc.pdf, img.png) excluded by `showAttachments:false`. Full
link list in `lanes/a3/dump/graph-links-live.txt`. Exact match.

**Confidence:** high (engine read + live observation).
**Limitations:** large-graph progressive rendering (files sorted by
`min(ctime,mtime)`, rendered in stages — `this.progression`) not exercised
(irrelevant at fixture scale; note it exists: `render` + sort at
app.js:~2028400); tag nodes not rendered live (showTags off — semantics from
code only); timelapse/display options (arrows, sizes, forces) are render-only
and not graph semantics.

### F7. Local graph

**Behavior.** Same engine in local mode (`s.localFile` set; function at
app.js:~2030000). Starting from the focused file's node in the GLOBAL
filtered graph:

- Expansion is a **breadth-first walk over the global edge structure** for
  `localJumps` rings (UI "Depth"; default 1; persisted key absent → engine
  default 1).
- Directions: `localForelinks` (UI "Outgoing links", default ON) follows a
  node's `links` map outward; `localBacklinks` (UI "Incoming links", default
  ON) pulls in sources that link to an in-set node. **Tag-type nodes never
  expand** (`Dj = {tag: !0}`); unresolved nodes expand (they just have no
  outgoing links).
- Each ring's newly discovered nodes get **weight** `30 - (30/jumps)*(ring+1)`
  (focus = 30) — a rendering weight, not an edge count.
- `localInterlinks` (UI "Neighbor links", default OFF) copies the global
  graph's full node objects into the local set, so links BETWEEN neighbors
  that are not on a focus-rooted path still render.
- If the focus file is absent from the (filtered) global graph, the local
  graph is just the focus node.

**Evidence:** app.js offsets ~2030000-2030700, engine defaults `Sj` at
~1990074, i18n labels. **Confidence:** medium-high (static only — no
dynamic local-graph capture; semantics are simple and the code is clear).
**Limitations:** no live observation; interaction between local mode and
search filters read but not proven.

---

## Observed transcripts / fixtures

- **Fixture vault:** `lanes/a3/fixture-vault/` — Alpha.md (aliases, tags,
  heading h1/h2/h3, block ids on paragraph + list item, 11 body links incl.
  self/nested/case/attachment), Bravo.md (backlink, note embed, image embed,
  md links with/without ext/with `%20` heading, pdf link+embed, ghost embed,
  collision probe), BlockRef.md (block link + block embed + heading embed),
  CaseTest.md (`[[Sub/Target]]`, `[[Target.md]]`), FM-Link.md (frontmatter
  link), SelfLoop.md (2 self-references incl. bare `[[#Self Loop]]`),
  Orphan.md, Tags.md (frontmatter + inline + hierarchical tags), Target.md +
  sub/Target.md (folder/name collision), sub/Sibling.md (same-folder +
  explicit + `./` + `../` + md-relative links), other/FromOther.md
  (cross-folder collision, ghost with alias, ghost with png ext, md ghost),
  attach/{img.png,doc.pdf,data.csv}, root img.png.
- **Parity oracle (authoritative dump):**
  `lanes/a3/dump/a3-metadata-dump.json` — taken via CDP from the live
  1.7.7 renderer after `metadataCache` settled (12/12 files, 0 pending).
  Contents: `resolvedLinks`, `unresolvedLinks`, per-file caches (frontmatter,
  frontmatterLinks, links, embeds, blocks, headings, tags), full
  `getBacklinksForFile` maps for all 12 files, 37 `getFirstLinkpathDest`
  probe cases, `getTags()`, and (null) graphConfig. Pretty-printed copy
  alongside.
- **Live graph transcript:** `lanes/a3/dump/graph-links-live.txt` (19 edges)
  and `lanes/a3/dump/graph.json.persisted-defaults.json`.
- **Run logs:** `lanes/a3/dump/run1-obsidian-stdout.log`,
  `run2-obsidian-stdout.log` (pinning evidence; updater activity).
- **Driver scripts:** `lanes/a3/run/cdp-dump.js`, `probe.js`, `graph2/3/4/5.js`.

**Counts (parity oracle):** vault files 16 (12 md + 4 attachments);
resolvedLinks keys 12; non-empty resolved source files 8; **resolved pairs 17
summing counts: 33 link occurrences; unresolved keys 4 distinct**
({Missing×3, Ghost×2, Nothing, ghost.png} across sources; 7 unresolved
occurrences); live graph with default options: 16 nodes / 19 edges.
*(Corrected at convergence 2026-10-07: the lane initially reported
21/34/6 here; the gate run against the dump itself returned 17/33/4 — the
dump is the oracle, not the summary. Correction verified by
`verification/gates/gate3-graph-parity.mjs` D1/D7.)*

## Open questions & unverified items

1. Local graph dynamics (F7) — static only.
2. Search-query grammar and group color ordering under multiple matches —
   static reading only (`fileFilter` construction not fully traced).
3. Navigation/preview behavior when a heading subpath no longer matches
   (mechanism static: `resolveSubpath` returns null; UX untested).
4. Run 1's Obsidian instance exited silently ~90 s after the update
   download (no crash report found); cause unknown. All artifacts had
   already been captured.
5. Multimap insertion order as a tie-breaker (step 11, two same-basename
   candidates both ending-with and both out-of-folder with EQUAL path
   length) — untested; shortest-path sort is deterministic, equal-length
   order is not.
6. Aliases in `getLinkSuggestions` ordering/dedup — partially read.
7. Any behavior differences in the owner's daily 1.13.7 or the downloaded
   1.14.4 — out of scope, not examined.

## Rebuild hints for the Rust clean-room (behavioral requirements only)

1. **Parse** each md file into: inline links, embeds, inline tags, headings
   (level + text), block ids (`^` + `[A-Za-z0-9-]` at end of a block; list
   items may carry them), and frontmatter. Frontmatter strings that are
   entirely `[[...]]` become frontmatter links (recurse arrays/objects;
   record the dotted key). Link record = (rawText, target-with-subpath,
   displayText). Wikilink target = text before first `|`; md-link hrefs
   without a URI scheme (or starting `./`,`../`) are internal links.
2. **Resolve** every link (frontmatter + body + embed) by: cut target at
   first `#`; empty → the source itself; else case-insensitive matching —
   basename lookup first (with `.md` appended when the basename has no dot),
   then in order: (a) `./`/`../` forms joined to the source's folder matched
   against full paths, (b) exact full-path equality, (c) if the original
   started with `/` → unresolved, (d) else among basename candidates whose
   full path ends with the linktext prefer ones under the source's folder,
   shortest full path first. Missing → unresolved with key = linkpath
   (`.md` stripped iff that is the extension), subpath removed, alias
   removed, case as written. **Aliases must not resolve.**
3. **Cache shapes:** `resolved: source → {targetPath → occurrenceCount}`;
   `unresolved: source → {key → count}`; every parsed md file is a key in
   both (empty maps allowed); self-references and attachment targets are
   ordinary entries. Backlinks are derivable (invert resolved, keep per-ref
   detail if the UI needs it).
4. **Graph:** nodes = all indexed md files (+ attachments iff
   showAttachments) passing filters, + one phantom node per distinct
   unresolved key (type unresolved, iff existing-files-only is off), + one
   node per case-merged tag (iff showTags; source→tag edges; tags merge
   case-insensitively, keep most-frequent casing, hierarchy counts parents).
   Edges = unique (source,target) pairs — collapse parallels, drop pairs
   whose target is filtered out; keep self-loops as pairs. Orphan = no
   in-edges and no out-edges among surviving nodes, self-loops not counted;
   hide orphans when the Orphans toggle is off (default ON = keep them).
   Filters: file must match the search query when one is active; group
   queries assign colors in declaration order without pruning; tags filter
   tag nodes. Persisted settings keys as in the captured graph.json.
5. **Local graph:** BFS on the built graph from the focus node, `depth`
   rings, outgoing/incoming toggles; tag nodes never expand; node weight =
   30 − 30·(ring+1)/depth; neighbor-links mode keeps full link sets of
   included nodes so neighbor-to-neighbor edges render.
6. **Re-resolution on rename/create:** creating or renaming a file must
   re-resolve sources that mention its basename (lowercased, with and
   without `.md`) in either map.

## Guardrail compliance

No writes outside `lanes/a3/` and this dossier. `/Applications/Obsidian.app`
and product trees untouched; real userData and real vaults untouched
(verified by mtime scan: zero entries newer than the pre-launch marker);
only this lane's PIDs were launched and shut down; recovered code appears
above only as short quoted/paraphrased snippets with byte offsets.
