# Behavior contract — A3: link resolution & graph construction (Obsidian 1.7.7)

Distilled from `findings/a3-graph-links.md` (evidence there). Acceptance:
`verification/gates/gate3-graph-parity.mjs` (7 checks) — a reference
implementation of this contract in ~200 lines of script achieves exact parity
with the live 1.7.7 dump on the campaign fixture.

## 1. Parsing

- Recognized link forms: `[[target]]`, `[[target|alias]]`, `[[target#heading]]`,
  `[[target#^blockid]]`, bare `[[#subpath]]`, `![[embed]]` (notes, images,
  any file), markdown links `[t](path)` / `[t](path.md)` / `[t](path#heading)`
  (URL-decoded; internal iff no URI scheme).
- Link record: `{original, link (target-with-subpath, alias split off at the
  first `|`), displayText (alias, else path with `#` parts joined by " > ")}`,
  with 0-based line/col/offset positions.
- Frontmatter: string values whose ENTIRE text is `[[...]]` become
  frontmatter links (arrays/objects recursed, dotted keys); they count as
  link occurrences and create real graph edges. Frontmatter `aliases` NEVER
  resolve (suggestions only).
- Block ids: `^` + `[A-Za-z0-9-]+` at end of a block (paragraph-end
  annotation pattern; list items may carry them), keyed lowercased per file.

## 2. Resolution rule chain (per link occurrence, in order)

1. Cut the target at the **first `#`** (subpath stripped before resolution —
   renamed headings never unresolve a link; only navigation/preview fails).
2. Empty remainder → the **source file itself**.
3. Lowercase; take the basename (after last `/`).
4. Basename with a dot → look up in a multimap keyed by **lowercased file
   basenames including extension**.
5. Miss (or no dot) → append `.md` to both and retry.
6. No candidates → **unresolved**.
7. Unique candidate and no folder part in the link → that file wins.
8. `./`/`../` forms: join to the source's folder, normalize; first candidate
   whose full lowercased path equals it wins; **miss → unresolved**.
9. Leading `/` stripped; exact full-path equality wins (**this beats
   same-folder preference** — `[[Target]]` from `sub/Sibling.md` resolves to
   root `Target.md`).
10. Leading-`/` form with no exact match → unresolved.
11. Ambiguity fallback: among candidates whose full path **ends with** the
    linktext, prefer those under the source's folder, then **shortest full
    path first**.

Everything is case-insensitive. All 37 live probes and both collision cases
in the fixture pin this chain.

## 3. Cache shapes

- `resolvedLinks: {sourcePath: {targetPath: occurrenceCount}}` — every parsed
  md file is a key (possibly `{}`); embeds, frontmatter links and
  self-references are ordinary entries; parallel links accumulate counts.
- `unresolvedLinks: {sourcePath: {key: count}}` — key = target with subpath
  and alias removed, trailing `.md` stripped **iff** that is the extension,
  case preserved as written (`[[Missing]]`, `[[Missing#Head]]`,
  `[[Missing.md]]` all collapse to `Missing`).
- Backlinks are **computed on demand** (invert resolved per reference); a
  rebuild may materialize the inverted index instead.

## 4. Graph construction (1.7.7 default options)

- Options (persisted `.obsidian/graph.json`): `showTags:false`,
  `showAttachments:false`, `hideUnresolved:false`, `showOrphans:true`,
  `search:""`, `colorGroups:[]`, plus render-only force/display keys.
- Nodes: every indexed md file (+ attachments iff `showAttachments`) + one
  **phantom node per distinct unresolved key** (iff `hideUnresolved:false`)
  + one case-merged tag node per tag (iff `showTags`; source→tag edges; tags
  merge case-insensitively keeping most-frequent casing; hierarchies count
  parents).
- Edges: **one per unique (source → target) pair** — parallel links collapse;
  a pair survives only if both endpoints pass the filters; self-loops count
  as pairs.
- Orphan: no in-edges and no out-edges among surviving nodes; self-loops do
  not count; pruned only when `showOrphans:false`.
- Search filters prune files (and their edges); color groups color but never
  prune; first matching group wins.
- Fixture parity (campaign oracle): 16 nodes / 19 edges, exact adjacency —
  **Gate 3**.

## 5. Local graph

- BFS over the global filtered graph from the focus node, `localJumps` rings
  (default 1); `localForelinks`/`localBacklinks` (default ON/ON) choose
  direction; tag nodes never expand; ring weight `30 − 30·(ring+1)/jumps`;
  `localInterlinks` (default OFF) keeps neighbor-to-neighbor edges; focus
  absent from the filtered graph → just the focus node.

## 6. Re-resolution triggers

- Creating/renaming a file re-resolves every source whose resolved or
  unresolved keys mention its basename (lowercased, with and without `.md`).
- Delete/rename maintain the basename multimap and both maps.

## Acceptance

`node verification/gates/gate3-graph-parity.mjs` (7 checks) must pass
unchanged for any rebuild claiming this contract; the fixture and oracles are
under `ProjectCentral/now/tmp/obsidian-re-20261007/lanes/a3/` (regeneration
procedure in GATE-RESULTS.md).
