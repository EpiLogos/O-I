# The World package: contract for the Cradle Field adapter (Essay #78 / EF2)

Status: proposal and receipts, written by the implementer of the package (`site/essay-world.mjs`). Nothing here edits
`desktop/cradle/src/field`, the kernel or `src-tauri`; section 4 proposes the seam for their owner to decide.

## 1. What a World package is

One directory, built from pinned commits and verifiable without any checkout:

```text
world.manifest.json      identity, pins, derived counts, dependency closure, verification, exclusions, praxis
world.files.json         every file: path, sha256, bytes; tree digest (revision = first 16 hex of it)
edition/                 the published reading (the Quartz site) + Expression layer
  static/fieldIndex.json   structure, links, rooms, moves, tree  (v, regs, stations, nodes[i,s,t,lab,coord,st,k,r,w,mvs], links, rooms, moves, tree, x)
  static/contentIndex.json full text index
  quartz-source.json       source receipt: vault_commit, working_tree_dirty, input_sha256, per-file sha256
  expressions/index.json   oi.essay-expressions/v1; entries[].{id,digest,journey,cover,scenes,nodes}
  expressions/x/<id>.journey.json, <id>.cover.*   digest-checked bodies
  <slug>.html              one rendered page per node; body is `#essay-pane > article`
source/                  dependency-closure receipts (`dependency-defects.json`)
praxis/skills/<name>/SKILL.md   the shipped reader Skills (source-owned)
praxis-skillset/members  the reader SkillSet (composition, one capability id per line)
```

Identity: `world_id` `epi-logos/confronting-the-limit`; native page ref `central:source:project:Antykathera-Essay-Work:submission-package/essay/<path>`
(`manifest.source_addressing = {world, prefix}`); slugs and numeric node ids are indices, never identity. Page revisions are
the per-file sha256 in `quartz-source.json`. This is exactly what `essayModel.ts` derives today (`DEFAULT_ADDRESSING`).

## 2. Contract for B (the `src/field` implementer)

B consumes `resolveWorld()` output (CLI: `node site/essay-world.mjs resolve --root <worlds root> --verify`, JSON on stdout):

```text
state             "available" | "absent" | "broken"      anything but "available" is reported with `reason`; never papered over
world_id, revision, manifest_sha256
edition_dir       absolute path of the installed `edition/`  (the directory `EssayEdition.baseUrl` names)
praxis_dir, manifest
source_addressing { world, prefix }                    pass as `EssayEdition.addressing`
counts            the manifest's derived counts (pages, structure, depth_classes, assets, expressions, praxis)
verified          { pages, expressions }               present only with --verify
```

What B must do with it:

1. `resolveEssayEdition()` returns `{ baseUrl, addressing: source_addressing }` from `resolveWorld`, not from `window.__OI_ESSAY_EDITION__`
   (keep the override for development). `state != "available"` becomes the source's honest "unavailable: reason".
2. Read only the files listed above; every one is in `world.files.json` with a digest. `expressions/x/<id>.journey.json` must be hash-checked
   against `entries[].digest` (`sha256:` prefix) before use. A mismatch is a refusal, not a fallback.
3. Counts shown in the Field come from `manifest.counts`; do not recompute different numbers. Rooms 8, movements 48, A 36, A′ 36, C 64, A-C 1, S 7.
4. Known defects are part of the contract (manifest `dependency_closure`, `verification.edition`): 235 internal edition links resolve to no
   page (38 into withheld `quilt/`/`working/` desks that render as dead links, 197 to unpublished in-scope paths, mostly `WHOLE-FIELD`) and 45 fragments
   resolve to no anchor. B should render such a link as unresolved (plain label with the reason), not as a link, and must not rewrite it.
5. Read-only. The installed revision is chmod-read-only; `mutation-probe` shows reading all 1057 pages and 135 Expressions changes 0 of 3108 files.

## 3. Install and resolve

```text
node site/essay-world.mjs build   --vault <checkout, read only> --vault-commit <sha> --pcd <checkout> --pcd-commit <sha> \
                                  --oi <checkout> --oi-commit <sha> --node-modules-from site --out <package dir> [--scratch <dir>]
node site/essay-world.mjs verify  <package|installed dir> [--vault <pinned essay dir>]
node site/essay-world.mjs install <package dir> [--root <worlds root>] [--register-praxis [--aikit-home <dir>]]
node site/essay-world.mjs resolve [--root <worlds root>] [--verify]
```

`build` never reads the author working tree: it clones the pinned commits into a scratch directory (shared object store, sparse checkout) and
archives the O:I commit. `install` verifies first, writes `<root>/<world_id>/revisions/<revision>/` read-only, then moves `current.json`
(`oi.world-install/v1`: revision, manifest_sha256, previous_revision) atomically; the previous revision stays. A failed verify changes nothing.

Default root (proposal, needs owner confirmation): `$OI_WORLDS_ROOT`, else `~/Library/Application Support/OI/worlds` (macOS),
`$XDG_DATA_HOME/oi/worlds` (Linux). It is deliberately outside every checkout and outside the Central ground (the ground holds authored source;
this is a derived, replaceable artifact).

## 4. Proposed minimal kernel/file seam (for the owner of `src-tauri` and the kernel; not implemented)

Constraints found: `connect-src` is `ipc: http://ipc.localhost http://127.0.0.1:* http://localhost:*`, so the webview cannot `fetch` an
`oi-material:` URL or a file path; `oi-material://` serves only files reachable through a Central `central.path-ref/v1` Location and per-component
`central.files.read` listings, and the worlds root is not a Central location.

Smallest honest seam, in order of preference:

- A. Kernel op `WorldResolve { world_id }` (reads `current.json`, checks `manifest_sha256`, returns the `resolveWorld` JSON above) plus a protocol
  route `oi-material://localhost/__world/<world_id>/<revision>/<path>` that serves a file only if `<path>` is listed in that revision's
  `world.files.json` (no listing walk, no `..`, read-only, `Cache-Control: no-store`). The Field then uses
  `baseUrl = oi-material://localhost/__world/<id>/<rev>/` and needs a `connect-src` entry for `oi-material:` (or the existing `ipc:` bridge
  returning bytes). Verification of digests can stay in B's adapter (it already holds the receipts).
- B. Keep the webview on `http://127.0.0.1:*`: the host starts a read-only static server over `edition_dir`, bound to loopback, on `WorldResolve`.
  No CSP change, but it adds a listening process whose lifecycle someone owns.
- C. Development only: `__OI_ESSAY_EDITION__` pointing at a local server over the installed `edition_dir`. Works today; not an install story.

Recommendation: A. Needs owner direction: which of A/B, and who owns the `__world` route.

## 5. Reader/expressive praxis SkillSet

`praxis-skillset/members` composes existing Skills; it invents no practice engine and carries no per-turn prompt.

- 13 source-owned Skills, shipped under `praxis/skills/` and registered as AIKit source `epi-logos-reader`
  (`apply-cmea, apply-tetralemma, choose-modality, choose-topological-mode, converse-pedagogically, engage-encounter-axis,
  etymological-archaeology, investigate, okf-wiki, run-l4-prime-loop, two-logics-of-two, using-epi-logos, walk-the-essay`).
- 3 specialist Skills by reference to their existing owner (`skill/ql/ql-foundations`, `skill/ql/ql-operation`, `skill/ql/vak-coordinate-frame`).
- Binding proof: `verifyPraxisBinding` requires every source-owned member to resolve to `praxis/skills/<name>/SKILL.md` whose frontmatter name equals the
  binding; `verifyPackage` fails while one does not. `essay-world.test.mjs` removes a Skill and shows the failure, and with real `aikit` (temp `AIKIT_HOME`)
  shows `set show` naming the removed one "not present in any registry".
- Registration is explicit and machine-local (`install --register-praxis` or `register-praxis`); verified here only into a temp AIKIT_HOME. The owner's
  `~/.aikit` and `~/.local/bin` were not touched.

Gaps that need essay-source edits (not made; own scoped branch, lead told first): the Skills carry no `METHOD:`/`METHODOLOGY:` description prefix, so
`aikit praxis list` cannot classify them (proposal: `using-epi-logos` METHODOLOGY; `walk-the-essay`, `investigate`, `okf-wiki`, `converse-pedagogically`,
`two-logics-of-two`, `apply-tetralemma`, `apply-cmea`, `etymological-archaeology`, `engage-encounter-axis`, `run-l4-prime-loop` METHOD; `choose-*` as plain
Skills). The owner's AIKit catalogue holds stale `local-*` capsules for these Skills pointing at a path that no longer exists; registering `epi-logos-reader`
supersedes them but does not remove them.

## 6. Verification receipts (pinned build, vault 4df2f721, PCD e875344c, O:I 5ef038db)

Package revision `4bd5f9cd6265ab63`: 3106 files, 133,202,221 bytes.

| check | result |
|---|---|
| pages read / pages missing | 1057 / 0 |
| ref round trip (path -> native ref -> path -> page) | 1057 of 1057, 0 problems |
| anchor round trip (every heading id) | 12553 of 12553 |
| Expression bodies hash-verified | 135 of 135 |
| vault receipt files matched at the pinned commit | 1121 of 1121 |
| embeds resolved | 111 of 111 |
| edition links to no page | 235 (recorded; equals manifest) |
| edition fragments to no anchor | 45 (recorded; equals manifest) |
| declared source references unresolved | 115 (24 distinct targets) |
| ordinary-reading mutations | 0 changed, 0 added, 0 removed of 3108 files |
| reader SkillSet | 16 members, 13 bound, 0 unbound |
| tests | `npm run test:world`: 12 of 12 (includes the real-aikit case) |

So acceptance "zero unresolved declared-internal dependencies" is NOT met by the source: 115 references. Seven targets rename mechanically
(`.../WHOLE-FIELD` to `.../WHOLE-FIELD-<dir>`); 17 have no candidate. The package records them (`source/dependency-defects.json`) and
`verify` refuses any growth beyond the recorded counts. Also recorded: Expression source bindings are stale (83 bindings, exported against
essay commit dbf3b17: 0 match the current vault, 16 missing, 67 differ), so the Expressions describe an earlier prose state than the pages they are laid over.
The edition ships `oi.journey` bodies (scenes inside); there is no separate ExpressionProfile artifact.

Limit of the mutation claim: it is file-level (a read of every page and Expression changes no byte; digest, size, mode and mtime of every file compared before and after). A live agent run
under the Cradle with a mutation counter was not run.

## 7. Needs owner direction

1. Where the World package is hosted/published (nothing was published; no repository created). Today the artifact exists only in the scratch directory.
2. Seam choice A/B/C in section 4 and the default worlds root in section 3.
3. Whether the essay source gets the scoped branch for Method/Methodology prefixes and the 115 reference repairs (and the stale Expression bindings re-export).
4. Whether withheld wikilinks (38 internal edition links into `quilt/`/`working/`) should be unlinked at staging like markdown links are (a change in `site/essay-source.mjs`).
