# The World package: contract for the Cradle Field adapter (Essay #78 / EF2)

Status: implemented and receipted (`site/essay-world.mjs`, `desktop/cradle/kernel/src/world_resolve.rs`). The TypeScript side (`src/field`) is B's;
section 5 is the exact contract it consumes. Owner decisions taken by the lead 6 Oct 2026: no publication in this pass (the package ships with the
release bundle/distribution and installs locally under the worlds root); seam option A; worlds root as in section 3.

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
4. Known defects are part of the contract and each carries a disposition (manifest `verification.edition.dispositions`, per-link list in
   `source/dependency-defects.json`): 189 edition links resolve to no page (3 withheld-by-design, 70 authoring defects, 116 publication defects: 102
   `#tag` text rendered as `/tags/...` links and 14 resolver mismatches) and 45 fragments resolve to no anchor (authoring defects). B should render such a
   link as unresolved (plain label with the reason), not as a link, and must not rewrite it. No edition link points into a withheld desk.
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

Default root (decided): `$OI_WORLDS_ROOT`, else `~/Library/Application Support/OI/worlds` (macOS),
`$XDG_DATA_HOME/oi/worlds` (Linux). It is deliberately outside every checkout and outside the Central ground (the ground holds authored source;
this is a derived, replaceable artifact).

## 4. The seam (implemented, option A)

Owner: Rust slice `desktop/cradle/kernel/src/world_resolve.rs` (new), additive lines in `kernel/src/lib.rs`, the `__world` route in
`src-tauri/src/material_protocol.rs`, the same route mirrored in the dev walk bridge (`kernel/src/bin/walk-bridge.rs`, `GET /world/...`), and a lock-free
short-circuit for the op in `src-tauri/src/main.rs` and the bridge (like `ExpressionRecovery`).

- `KernelOp::WorldResolve { world_id?: string, verify?: bool }` answers `{ "result": "world_resolve", "receipts": [], "resolution": {...} }`. The
  resolution is the `resolveWorld` document of section 2 (`state`, `world_id`, `root`, `reason?`, `revision`, `manifest_sha256`, `dir`, `edition_dir`,
  `praxis_dir`, `manifest`, `source_addressing`, `counts`, `verified { level: "listing"|"files", files, bytes }`, `route_path`).
  `verify: true` hashes every listed file (about 133 MB); without it the listing is checked against the manifest's tree digest.
- `__world` route: `oi-material://localhost/__world/<world id as ONE percent-encoded segment>/<revision>/<listed path>` (the resolution's
  `route_path` + path). A file is served only if the revision's `world.files.json` lists it, that listing matches the manifest's `tree_sha256`, the
  bytes match the listed SHA-256, and the path is a regular file reached without a symbolic link inside the revision directory. `..`, `.`, empty
  segments, encoded `/`, `\` and NUL are refused (403); a file not in the listing, a directory, `world.manifest.json` and `world.files.json` themselves are 404;
  a listing that does not match the manifest or bytes that do not match their digest are 500 and no bytes are returned. HTML is served byte-exact
  (no page-context injection, unlike `oi-material` material); the worlds root is not a Central ground, so this route does not go through `central.files.read`.
- Bridge mirror for walks: `GET http://127.0.0.1:<bridge port>/world/<same path after __world/>`; the op goes through `POST /op`. Start the bridge with
  `OI_WORLDS_ROOT=<root>` to point it at an installed World.
- Not changed by me: `src-tauri/tauri.conf.json`. `fetch()` of an `oi-material:` URL needs it in `connect-src` (today `ipc: http://ipc.localhost
  http://127.0.0.1:* http://localhost:*`): add `oi-material:` (and `http://oi-material.localhost` where the webview uses it). That is a security-relevant
  line, so it is the lead's call; the route itself grants only the listed edition files. The web bundle on the walk bridge needs no CSP change.
- Rust tests (kernel `cargo test --lib -j2`: 244 passed, baseline 231 + 13 new): absent/available/broken resolution, wire shape of the op and result,
  exact serve + content types, file not in the manifest 404, traversal in 14 forms refused with no outside byte read, a listed symlink to outside refused,
  changed bytes not served, replaced listing not served. `tests/world_resolve_installed.rs` (set `OI_WORLD_TEST_ROOT`) served all 3106 listed files of the
  real installed World (133,266,037 bytes) and refused the manifest, the listing, an unlisted file and a traversal.

## 5. Exact TypeScript contract for B

```ts
// Kernel op (Tauri `kernel_op` command, or POST {bridge}/op in walks)
type WorldState = "available" | "absent" | "broken";
interface WorldResolution {
  state: WorldState;
  world_id: string; root: string; reason?: string;               // reason present when absent/broken: show it
  revision?: string; manifest_sha256?: string;
  dir?: string; edition_dir?: string; praxis_dir?: string; manifest?: string;   // absolute paths, informational
  source_addressing?: { world: string; prefix: string };          // = EssayEdition.addressing
  counts?: unknown;                                              // manifest.counts, display as given
  verified?: { level: "listing" | "files"; files: number; bytes: number };
  route_path?: string;                                           // "__world/<enc world>/<revision>/"
}
const outcome = await kernelOp({ op: "world_resolve" });        // -> { result: "world_resolve", receipts: [], resolution: WorldResolution }
```

`resolveEssayEdition` gains a packaged path, after the existing overrides (`window.__OI_ESSAY_EDITION__`, localStorage, `VITE_ESSAY_EDITION` keep winning for development):

```ts
export async function resolvePackagedEssayEdition(host: { worldBase(routePath: string): string }): Promise<EssayEdition | { unavailable: string }> {
  const { resolution } = (await kernelOp({ op: "world_resolve" })) as { resolution: WorldResolution };
  if (resolution.state !== "available" || !resolution.route_path || !resolution.source_addressing)
    return { unavailable: `The Return-of-Zero World is ${resolution.state}${resolution.reason ? `: ${resolution.reason}` : ""}` };
  return { baseUrl: host.worldBase(resolution.route_path) + "edition/", addressing: resolution.source_addressing };
}
// native:      worldBase = (rp) => `oi-material://localhost/${rp}`         (same scheme/host form the app already builds for material URLs)
// walk bridge: worldBase = (rp) => `${bridge}/world/${rp.replace(/^__world\//, "")}`
```

Rules for the adapter: an `unavailable` result is shown, never replaced by a fallback host; every request is a plain `GET` under `baseUrl` (the files in section 1); a non-200 from this route is a
refusal to surface (404 = not part of this World, 403 = refused path, 500 = the install does not verify), not a retry; `expressions/x/<id>.journey.json`
bodies stay hash-checked against `entries[].digest` in the adapter as well (the route already refuses bytes that differ from the listing). The installed
revision is immutable, so `revision` is the cache key; re-resolve on app start and after an install.

## 6. Dispositions (every unresolved reference is classified, none hidden)

`manifest.dependency_closure.dispositions` (per-target table, totals) and `source/dependency-defects.json` (per reference, per edition link and fragment). Values:
`withheld-by-design` (the note exists but never publishes: a symlink into `working/`, a `quilt/` note, a name the essay itself places in a withheld desk),
`external`, `authoring-defect` (with `repair`: `mechanical` = one published page differs only by name; `candidates` = the author chooses; `none`),
`publication-defect` (the edition itself is wrong: `#tag` text rendered as a link, or a resolver mismatch; `withheld-desk-link` would fail `verify`).

| set | total | withheld-by-design | authoring-defect | publication-defect | undispositioned |
|---|---|---|---|---|---|
| source references that resolve to nothing | 114 (23 targets) | 25 | 89 | 0 | 0 |
| edition links to no page | 189 | 3 | 70 | 116 (102 hashtag, 14 resolver mismatch) | 0 |
| edition fragments to no anchor | 45 | 0 | 45 | 0 | 0 |

Source authoring defects by repair: 44 references to 7 `WHOLE-FIELD` targets are mechanical; 13 references to 4 title-style targets have candidates; 32 references to 6 targets
have none. The 25 withheld-by-design references are the `AUTHORIAL-TEXT` symlink (into `working/`), `agentworld-response-matrix` (in `quilt/`) and `Antikythera Agentworld Brief` (a
working paper the essay itself links to in `working/`). `ESSAY-MECHANICAL-REPAIRS.proposal.patch` (this directory) applies the mechanical repairs and the Method/Methodology
description prefixes to the pinned vault commit; it is a proposal, not applied.

## 7. Verification receipts (vault 4df2f721, PCD e875344c, O:I 138f76bb plus the uncommitted `site/essay-source.mjs`)

The package records `source.edition_build.pinned: false` and the overlaid file's digest, because the staging fix is not yet in a commit; rebuild with the commit that contains it to pin.
Package revision `352c9138c3f17bf0`: 3106 files, 133,266,037 bytes.

| check | result |
|---|---|
| pages read / missing | 1057 / 0 |
| ref round trip (path, native ref, path, page) | 1057 of 1057 |
| anchor round trip (every heading id) | 12553 of 12553 |
| Expression bodies hash-verified | 135 of 135 |
| vault files matching the pinned commit | 1121 of 1121 |
| embeds resolved | 111 of 111 |
| links to published files (figures) | 4 (not pages, not dead) |
| unresolved declared references UNDISPOSITIONED | 0 |
| edition links into a withheld desk | 0 (was 38 before the staging fix) |
| ordinary-reading mutations | 0 changed, 0 added, 0 removed of 3108 files |
| reader SkillSet | 16 members, 13 bound, 0 unbound |
| tests | `node --test essay-world.test.mjs essay-source.test.mjs quartz-staged-input.test.mjs`: 21 of 21 |

Acceptance "zero unresolved declared-internal dependencies" is still NOT met by the source (114 references, 89 of them authoring defects). It is now met in the sense asked of `verify`: zero undispositioned, defects listed.
Also recorded and unchanged: Expression source bindings are stale (83 bindings exported against essay commit dbf3b17; 0 match the current vault); the edition ships `oi.journey` bodies, with no separate ExpressionProfile artifact;
the mutation claim is file-level, not a live agent run.

### Staging fix (O:I, `site/essay-source.mjs`)
`stageEssayInputs` now unlinks wikilinks into withheld desks as it already did markdown links: path-qualified `[[quilt/...]]`/`[[working/...]]` forms (with fragment, alias, table-escaped pipe, embed), bare names that exist only
as withheld or symlinked notes, and markdown links written as `](<path with spaces>)` or with %-escapes (which the old rule missed). Code spans and fences are left alone. Tests in `site/essay-source.test.mjs`.

## 8. Needs direction, still open

1. The `oi-material:` entry in `connect-src` (section 4): the lead's call.
2. `#tag` links (102) are a site build matter (the Quartz hashtag transformer renders prose `#1-4` as a link to a tag page the edition does not emit); the repair is in `site/` (disable it for this edition or emit the pages). Not made.
3. 14 resolver mismatches (a wikilink that resolves case-insensitively in the vault but not in the edition) could be repaired at staging by rewriting the target to the file's exact name. Not made.
4. Authoring defects with `repair.kind` `candidates` or `none` are the owner's text.
