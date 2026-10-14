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
   `tests/conformance/port-ledger.test.mjs`, 3 of 3 pass (scripted). Crosswalk:
   126 of 126 destinations named, 2 corrected (lane-1 D1, D2); native exercise
   is `pending` for all 126 (source-level only). Open: the 25 `pending:` rows,
   native exercise of all 126, and the §9 vocabulary (the destinations are
   lens and instrument names, not (projection, rack) pairs).
2. **UX spine convergence** — the shell's spine matches the design frontier
   per `UX-SPINE-ALIGNMENT.md` (the eight seams). **Open.** Seam status recorded
   14 Oct 2026 (`UX-SPINE-ALIGNMENT.md` §5, source-level): seam 2 converged;
   seams 1, 3, 4, 5, 6, 7 partial; seam 8 open. Native verification of every
   seam is still pending.
3. **Everyday-data continuity** — the candidate adopts the everyday
   workspace state on first cutover run: the everyday workspace book,
   recovery records and drafts are migrated (or re-adoptable in place) into
   the candidate's namespace without loss; saved Expressions open with their
   native identities and revisions. **Open** — a migration step to build
   (the namespaces are deliberately isolated today; the migration is a
   one-time owner-admitted copy, never a shared store).
4. **Native service parity** — every owner operation the everyday runtime
   served (ground reads/writes, day/now operations, kernel ops, events) is
   served by the candidate kernel at parity; the 8787 seam retires with a
   named replacement for each caller. **Partially proven** (kernel ops and
   files verified). **Census built (scripted), replacements still open.**
   Scripted census: `tests/conformance/owner-service-census.test.mjs` with
   register `tests/conformance/owner-service-census.json`; evidence
   `docs/world-shell/evidence/owner-service-census-20261014.json`; 22 of 22
   conformance tests pass, including a negative control that a new 8787
   caller fails. The in-tree 8787 server (`packages/live-shell`) has 8 routes
   and serves only the Live Set document and device-parameter domain. Its
   shipping callers: 6, in 3 files (`application.ts` x2, `devices/api.ts` x3,
   `assets/index.html` x1). Status: 0 replaced, 1 replaceable (`/api/config`,
   residual ShellConfigRead; not converted, since a conversion would change
   the result shape), 5 missing (no KernelOp for Live Set or device
   parameters). Conversions made: 0. Test-tree callers: 11 hits in 6 files.
   Open owner ops, named in the register: `LiveSetRead` (set, summary),
   `LiveDeviceDescriptors`, `LiveDeviceParamsRead`, `LiveDeviceParamWrite`,
   `ShellConfigRead`. The retirement's premise that 8787 served ground, day/now
   and event routes is not borne out by the in-tree server. The relative
   `/api/*` routes the frame calls (scenes, media, overlay, state, hardware,
   events, telemetry) are not on 8787's table, and no in-tree server answers
   them. Their owner is unresolved, and gate 4 cannot close until it is named.
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
