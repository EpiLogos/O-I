# Legacy cradle retirement register

Prepared 8 October 2026 by the native-composition parent, on the owner's
direction to prepare a clean retirement of the legacy cradle app. This is a
preparation register: **the cutover itself is owner-named** — nothing here
removes or disables anything until the owner declares the day.

## 1. What retires

| Retiring | Identity | Where |
|---|---|---|
| The everyday cradle app | `org.epilogos.oi.cradle` v0.1.0 | `/Users/admin/Applications/O-I.app` |
| The legacy shell UI entry surfaces of the cradle build | non-live-shell `desktop/cradle` UI paths, `legacy.html`/`render.html`/`library.html` entries where superseded by the retained-app grammar | `desktop/cradle` build tree |
| The development bridge runtime of the composition campaign | Vite `5176`, backend `8788`, native dev bridge `4180` | dev only — never installed |
| The owner-side legacy runtime seam | owner service `8787` responsibilities assumed by the candidate kernel | everyday runtime |

What does **not** retire: the owner's personal ground (`~/Central`), all
saved work (Expressions saved through `central.files.*`), native receipts and
history, credentials (native facilities), and the civil-time/ground law.
The candidate reads the same ground through the same owner paths — this was
proven in every installed journey (OI_CENTRAL_ROOT, `central.files.create`
with readback).

## 2. The successor, and what it has already proven

The successor is the integrated candidate (`org.epilogos.oi.live-shell`,
delivered at 0.1.2 — `evidence/integrated-v012-delivery-receipt.json`):

- six-product composition, full and smaller profiles, product absence as a
  real composition case;
- install → adopt → update (0.1.0→0.1.1→0.1.2) → interruption → recovery,
  all through the native installer with exact-receipt admission;
- tripartite continuity operating across the installed app: secured quit
  (AppleEvent route, exit 0, recovery record written), checkpoint adoption on
  restart, save-as with readback, native typed `revision_conflict`;
- packaged execution without development-tree dependencies (payload-pinned
  binaries, bundled Python/Node, relocated Mach-O bindings, strict seals).

## 3. Cutover gates (all owner-verifiable; evidence-linked where passed)

1. **Functional parity** — the FUNCTIONAL-CROSSWALK's 126 targets distributed
   to (projection, rack) destinations per `WORLD-SHELL-DESIGN.md` §9, with the
   port ledger's `outward_home`/`boundary_op` assignments complete
   (`EXPRESSIONS-PORT-STATUS.json`). **Open, narrowed (14 Oct 2026).** Ledger:
   213 of 213 rows name an `outward_home` and a `boundary_op` (160 operations,
   28 explicit `none:`, 25 explicit `pending:` naming the owner op or track;
   before: 159 of 213 had a `boundary_op`). Validator:
   `tests/conformance/port-ledger.test.mjs`, 3 of 3 pass (scripted; it checks the ledger's shape — fields present, counts consistent — not behaviour; 2026-10-14, PORT-AUDIT §E9). Crosswalk:
   126 of 126 destinations named, 2 corrected (lane-1 D1, D2); native exercise
   is `pending` for all 126 (source-level only). Open: the 25 `pending:` rows,
   native exercise of all 126, and the §9 vocabulary (the destinations are
   lens and instrument names, not (projection, rack) pairs).
   Restated 14 Oct after the port audit (`audit-20261014/PORT-AUDIT.md` §E):
   "126 of 126 destinations named" overstates — in Technē the named
   destinations open the shell's own presentations or disabled buttons, not
   the frame instruments the targets were built in; the port-ledger test checks
   the ledger's shape, not behaviour; EXPRESSIONS-PORT-STATUS's `ported: 136`
   is a static reading with every row unreplayed natively, and its 20
   "cannot call save_as" rows are wrong (`fork`, `save_as`, `create` exist and
   are relayed).
2. **UX spine convergence** — the shell's spine matches the design frontier
   per `UX-SPINE-ALIGNMENT.md` (the eight seams). **Open.** Seam status
   (`UX-SPINE-ALIGNMENT.md` §5, updated 14 Oct 2026 after the seam builds;
   scripted and source only) marked all eight converged; restated 14 Oct after
   the foundation audit: the seams' code exists, but the candidate runs a
   per-mode switchboard beside it, and on screen none holds in use. Open; the
   work is `wayfinder/FOUNDATION.md` F1–F9.
3. **Everyday-data continuity** — the candidate adopts the everyday
   workspace state on first cutover run: the everyday workspace book,
   recovery records and drafts are migrated (or re-adoptable in place) into
   the candidate's namespace without loss; saved Expressions open with their
   native identities and revisions. **Built, scripted-verified; open on owner data** — the
   one-time owner-admitted copy (export, admit, and the candidate's
   first-run apply) is in §4.1; the namespaces stay isolated, never a
   shared store. It has not been run on the owner's stores or in a native
   candidate.
   Restated 14 Oct: built is not run — the migration has never run, and the
   kernel keeps Expressions only in memory, which is why the candidate has no
   works (PORT-AUDIT break 2; FOUNDATION N1).
4. **Native service parity** — every owner operation the everyday runtime
   served (ground reads/writes, day/now operations, kernel ops, events) is
   served by the candidate kernel at parity; the 8787 seam retires with a
   named replacement for each caller. **Native callers replaced (scripted); the seam retires
   with the dev server.** Scripted census: `tests/conformance/owner-service-census.test.mjs`
   with register `tests/conformance/owner-service-census.json`; first
   evidence `ProjectCentral/docs/5-evidence/world-shell/evidence/owner-service-census-20261014.json`.
   The census test fails on any new 8787 caller. The in-tree 8787 server
   (`packages/live-shell`) serves only the Live Set document and the device
   parameters. Its shipping callers: 6, in 3 files. Replaced: 4, by the
   kernel ops `LiveSetRead`, `LiveDeviceDescriptors`, `LiveDeviceParamsRead`
   and `LiveDeviceParamWrite` (`kernel/src/live_set_owner.rs`; the handlers
   live once, in `packages/live-set/src/api.rs`, for the server, the native
   host and the kernel). The device panels and the set reader use the kernel
   transport whenever one exists, which is always natively. The two that
   remain are dev-browser paths the native host never takes: `/api/config`
   in `application.ts` (natively the host's `live_shell_config` answers) and
   the server's own inspector page `assets/index.html` (`/api/summary`).
   Both retire with the server. Device writes change the owner's `.als` and
   record no kernel receipt, since no kernel state changes. [Scripted:
   kernel `live_set_owner` 7 tests, `device-kernel-transport.test.mjs` 3
   tests, conformance 25 of 25. Not run natively.]
   The relative `/api/*` routes the frame calls (scenes, media, overlay,
   state, hardware, events, telemetry) belong to the Physis desktop server,
   `Work/point-cloud-demo/server/index.mjs`, the frame's upstream. Every
   call sits behind `physisHost()` (`field-studies-journeys/src/physis.ts`),
   which is true only when the Physis server injects its `physis-host` meta
   tag, so the cradle and the candidate never make them. `src/physis/render.ts`
   is that server's screensaver page and is not loaded by either app.
   [Source reading.]
5. **Everyday journey acceptance on the successor** — one full owner day
   lived in the candidate (ground work, conversations, Expression editing,
   day close) with identities, drafts and revisions preserved across
   quit/restart. **Open** — the daily-driver trial before the owner names
   the day.
6. **Owner authorisation** — the owner names the cutover day. Always last.

## 4. Migration register (built once, admitted once)

| Item | Source | Destination | Mechanism |
|---|---|---|---|
| Workspace book + recovery records | everyday WebKit localstorage (`org.epilogos.oi.cradle`) | candidate namespace (`org.epilogos.oi.live-shell`), or the candidate's candidate-backing | one-time owner-admitted migration command (to build; the source-archive helper's atomic-publish pattern is the template) |
| Draft/recovery previews | everyday draft records | candidate recovery helpers | same migration, isolated keys preserved |
| Ground placement/owner home | everyday configuration | candidate configuration (`owner_home` persisted — already implemented in the candidate bootstrap) | config adoption at first run |
| Credentials | native credential facilities | unchanged (never migrate; both apps read the same facilities) | — |
| Receipts/history | `~/Library/Application Support/OI/receipts` | unchanged (owner world records; candidate reads, never rewrites) | — |

### 4.1 The migration command and first-run apply (gate 3): built, scripted-verified, not yet run on owner data

Command: `packages/live-shell/continuity-migration.py`, with `export` and
`admit` (each takes `--dry-run`). Tests:
`packages/live-shell/tests/continuity_migration_test.py`. Both run on fixture
homes only. No owner WebKit store was written, and the owner's data was not
used as a test input.

Audit, with the evidence channel for each finding:

- The everyday book, journal, recovery records and drafts are all in WebKit
  `localStorage` (`ItemTable(key TEXT, value BLOB)`), with UTF-16LE values.
  [Native read-only audit: key names and four-byte value headers on scratch
  copies; no values read.]
- Everyday localStorage sits in eleven origin stores, across
  `WebsiteData/Default` and `WebsiteDataStore/<partition>/Origins`. Ten hold a
  `oi-cradle.workspaces.v1` book. The live store appears to be
  `Default/hFjtlW…` (last written 9 October 2026; the everyday app's data
  directory carries the same date), but that is an inference from mtimes. The
  owner names the store with `--origin`. [Native read-only audit: names, sizes
  and mtimes.]
- The candidate's keys derive from `oi.live-shell.candidate.workspace.v2`: its
  journal is `…stage`, its recovery keys are `…recovery.`, and its carried
  drafts are `…unplaced-draft:`. The everyday and candidate namespaces therefore
  differ on those keys. The draft records (`oi-cradle.draft.v1:<ref>`) are the
  same key in both apps, so they are kept verbatim. [Source reading:
  `desktop/cradle/src/workspace/store.ts` `workspaceStorageNamespace`,
  `drafts.ts`; pinned by `test_key_map_matches_source`.]
- The candidate's WebKit origin already holds candidate data (a book, two
  recovery records and a stage journal). Admission therefore refuses by default.
  [Native read-only audit.]
- The native recovery store lives under `OI_EXPRESSION_HOME`, the owner home,
  not in WebKit. It is already shared, so it needs no migration. [Source
  reading: `desktop/cradle/kernel/src/expression_recovery.rs`, `Store`.]
- Ground placement and owner home are already adopted natively. The candidate
  reads `personal_ground` from `~/.config/oi/composition.json`, and it persists
  `owner_home` in its own composition. The first run should verify this, and no
  migration step is needed. [Source reading:
  `desktop/cradle/src-tauri/src/native_shell.rs` around lines 326–377.]

Decision. WebKit storage cannot safely be written from outside a running app,
and the candidate must not write a shared store. Export therefore reads a
private copy while the everyday app is stopped. Admission publishes an adoption
record into the candidate's own data home,
`~/Library/Application Support/OI-Shell-Candidate/<backing>/continuity/admission-<digest16>/`,
and the candidate applies it in its own process on first run. The placement
follows the audit: the command sits beside the candidate packaging scripts and
reuses the source-archive helper's publish pattern (`build-source-archive.py`).
The `oi` suite CLI is the installed suite and sits outside this gate.

What the command does:

- `export` refuses while the everyday app runs (checked by executable path
  prefix, before any store is read). It refuses when more than one origin holds
  a book and no `--origin <label>` is given, and it names the most recently
  modified store as a suggestion only. It digests each store file before and
  after the copy. It keeps only register keys (an allowlist), so credentials,
  receipts and every unlisted key are counted and left behind. It re-keys the
  namespace keys and carries everything else verbatim. It publishes
  `BUNDLE.json` and `records.json`, sealed by digest, through stage, fsync,
  verify and rename. A re-run reports `already exported` with the bundle digest.
- `admit` re-verifies the bundle digest, each text digest and the key mapping
  (recomputed from the source keys). It refuses an unreadable book and a running
  candidate. It probes the candidate namespace read-only and refuses on existing
  data or key collisions unless `--owner-replace` is given. The adoption record
  is published as `adoption.json` and `ADMISSION.json`. A re-run reports
  `already admitted` with the bundle digest.

Scripted evidence (fixtures only):

- `python3 -m unittest packages/live-shell/tests/continuity_migration_test.py`:
  25 tests pass. They cover the key-map pin against the TypeScript sources, the
  allowlist, the UTF-16 decode, the rewrites, both dry runs, the running-app
  refusals, the ambiguous-origin refusal, byte-identical source digests after
  export, the publish-failure injections that leave no partial output, tampered
  and recomputed-mapping bundles, the namespace refusal and `--owner-replace`,
  and idempotent re-runs.

The candidate's first-run apply: built, scripted-verified, not yet run in a
native app.

- Native: `desktop/cradle/src-tauri/src/continuity_admission.rs` finds the one
  pending `admission-*` directory under the candidate's data home and verifies it
  against the digests the command recorded: the adoption digest over the stored
  bytes, the schemas, the policy and its preconditions, each record's text digest
  and key mapping, and the counts. It refuses a tampered or mis-keyed admission by
  name and leaves it on disk. `confirm` re-verifies and writes `APPLIED.json`
  once. The commands `live_shell_continuity_pending` and
  `live_shell_continuity_confirm` answer the main webview only.
- Shell: `packages/live-shell/ui/src/continuity/admission.ts` applies the verified
  records before the workspace book is read (`ContinuityProvider` in
  `continuity/workspace.tsx` is the gate). The default policy fills only an empty
  namespace. A key that already holds the exact admitted value counts as applied,
  so an interrupted apply retries cleanly. `--owner-replace` copies the existing
  namespace aside first (`<namespace>.preserved.<digest16>`, the same snapshot on
  every retry), checks the copy, then writes. The outcome is shown once in a
  dismissible status line. A held apply (a native read error, a write failure, a
  failed confirm) mounts no workspace, so nothing can overwrite a partial apply.
  A refusal starts the candidate on its own data and reports it on each start.
- Scripted evidence: 8 Rust tests, including a round trip over a bundle the
  Python command admitted, and 15 Node tests over a Storage-shaped store
  (`packages/live-shell/ui/tests/continuity-admission.test.mjs`).
- The preserved copy sits in the same WebKit store it protects, so a store wipe
  removes both. The digests prove integrity, not authority: authority rests on
  `admit` being the only writer under the owner's home.

Open:

1. The owner runs `export --dry-run` on the real stores, names the origin, archives
   the bundle, then runs `admit --dry-run`. Nothing above has been run on owner data.
2. Candidate acceptance (gate 5): the apply runs in the native candidate, and the book opens with identities and drafts
   restored after a quit and restart.

## 5. Removal steps (executed only after §3 completes)

1. Owner backs up / acknowledges: the everyday app's WebKit data stores are
   archived (not deleted) to the owner's archive area.
2. Remove `/Users/admin/Applications/O-I.app` via the installer's owned
   removal path (the desktop installer's owned-removal route, extended to
   accept the everyday app's recorded footprint — the same
   owned-resource law that installed the candidate).
3. Retire the legacy UI entry surfaces from `desktop/cradle` source (the
   non-live-shell paths), one removal commit per surface, each citing the
   crosswalk row that supersedes it.
4. Retire the dev-bridge runtime paths from the campaign (dev-only; no
   installed trace).
5. Retire the owner-service `8787` seam once its census (gate 4) shows zero
   remaining callers.
6. Rename day: the candidate graduates from "Shell Candidate" to the
   owner-chosen everyday identity (bundle display name and install location
   are owner decisions; the app_id `org.epilogos.oi.live-shell` stays).

## 6. Risk notes

- The everyday app is the owner's daily driver — gate 5 (a lived day) is the
  real proof; nothing else substitutes for it.
- The two apps share the owner ground; during any overlap window both must
  obey the same custody/CAS law (they do — same owner paths).
- WebKit localstorage migration is the one genuinely lossy-risk item; the
  migration command must verify record counts and digests both sides and
  refuse on any mismatch (the archive helper's verify-before-publish law).
