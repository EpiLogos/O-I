# New-shell acceptance register

This continuation record tracks the owner-approved 126 functional targets in
the Ableton-shell commission. It leaves the programme and target sets untouched.
The exact target definitions, reference behaviours, craft bars and acceptance
shapes remain the source; this register binds them to file and block SHA-256
revisions. Historical M-numbers survive only inside verbatim source definitions.

The owner’s latest WORK ORDER 0 commissions SOl to build the initial shell
surface. That overrides PROGRAMME D-A’s external surface ownership in this
scope. PROGRAMME’s current D-E reversal brings both the Expressions body and
the full deep-working app into the shell. Older coupled-views-only claims in
STRUCTURE P7 and lane 6 are not operative. Deep document/audio/device lanes are
consumed when landed; their work is not rebuilt here.

| Lane | Identity set | Targets | Native acceptance passed |
|---|---|---:|---:|
| Canvas / Project / Graph | A1–A10, B1–B4, C1–C4, D1–D3 | 21 | 0 |
| Timeline | T1–T25 | 25 | 0 |
| Expressions editing core | E01–E26 | 26 | 0 |
| Places | T1–T30 | 30 | 0 |
| Journey / Palace | T1–T24 | 24 | 0 |
| Total | lane-qualified unique identities | 126 | 0 |

All five progress axes—implemented, exercised, passed, failed, blocked—start
`pending`, meaning unassessed. No failure or external blocker is invented from
missing implementation. Existing model tests, earlier campaign evidence and
successful source imports cannot close these new-shell targets. Native
functional acceptance is still required against each target’s actual reference
behaviour, including rendered craft, saved-owner acknowledgements and ref
continuity wherever the target requires them.

- `targets.json` carries every identity, source text, revision, owner,
  dependencies, licence decisions and separate progress axes.
- `sources.json` binds the programme, convergence record, all target sets and
  reference inventories, lane-7 structure, and the Obsidian A1 contract/backlog.
- `references.json` records pinned local repository revisions, actual licence
  file hashes and acquisition classifications before any reference code entry.
- `saved-work.json` records read-only native endpoint observations and saved
  checkpoint metadata, with typed native read requests. It copies no bodies.
- `register-verification.json` records structural/source integrity only.

Run:

```sh
python3 desktop/cradle/docs/world-shell/acceptance.py verify
```

Initialization has already run and refuses to replace existing progress. Future
coherent increments update the existing target records with exact candidate
revision and executed evidence, then verify. A `yes` progress claim requires a
revision and evidence; `passed` and `failed` additionally require `exercised`.
Keep the native source and screenshot/receipt oracle available, not just a test
name or a green aggregate count.

Licence discrepancies found before import:

- Twine 2.12.1 at `2c3b80144ba6f1fe9d8a4e5e11a2349ba55fc310` has GPL-3.0
  in both LICENSE and package.json, despite the programme/commission’s
  permissive/MIT premise. Its class is `interface-only`, with no code entry.
- TimelineJS3 3.9.13 at `12a80199b967394a020f8faa7b001162a71e2494` has MPL-2.0
  in both LICENSE and package.json, despite lane 2’s MIT claim. Its class is
  `interface-only`, with no code entry.
- PeriodO’s repository code root LICENSE is Unlicense. Its dataset’s documented
  CC0 posture does not classify every repository artifact. This baseline adopts
  neither data nor code.

tldraw remains study-only, with no vendoring. The GPL/LGPL NLE references remain
interface-only pending any separately recorded adoption decision. Excalidraw,
vis-timeline and Godot’s own permissively licensed source have pinned licence
evidence before possible adoption; their import records are empty. Places keeps
the existing MapLibre 6.11.1 dependency and renderer.

The native Expression list and index were empty on the resolved endpoint at
observation. Saved recovery checkpoints nevertheless exist. Useful genuine
work includes Central’s wiki whole (15 scenes), Actuation’s wiki whole (2 scenes)
and the authored Chakral Body constellation (1 scene); exact refs/revisions and
read requests are in `saved-work.json`. A checkpoint is not an active or
published document. The recovery owner must validate it, and the ordinary
Expression owner must explicitly reopen it. The shell must not create another
semantic store from those saved bodies.

The existing app is private package `oi-expressions-app` 0.3.0. Its normal
`npm run build` produces the journeys page and Vite `dist/` with relative base.
The native host’s single application route and handshake remain authoritative.
For development, the existing kernel walk bridge takes a **positional** bind:

```sh
cd desktop/cradle/kernel
cargo run --bin walk-bridge -- 127.0.0.1:4179
```

The header’s `--bind` example is stale; the actual source parser consumes the
first positional argument. POST one typed `KernelOp` to `/op`. Native production
hosting uses the existing Tauri `kernel_op` seam. No bridge was listening at
4179 during the read-only baseline, and this child started no host or UI.


## What the 126 targets are, and where each one lives

The 126 targets (`lanes/*/TARGET-SET.md`, `targets.json`) are the Technē-instrument
editing behaviours of five lanes (Canvas / Project / Graph, Timeline, Expressions
editing core, Places, Journey / Palace), approved as that programme's scope
(`PROGRAMME.md`). They are not an inventory of what the O:I products do through the
DLW: the retired FOUNDATION §8 said they cover Central, AIKit, Factory, Workcell,
Actuation, Quaternal Logic and the Expressions owner, and that was wrong. The
products' capability record is the O:I matrix (`wayfinder/MAP.md`, Rooting).

*The rest of this section is moved verbatim from the retired `wayfinder/FOUNDATION.md`
§8 (22 Oct 2026; history: `2a1ccca02`). PORT-AUDIT is `audit-20261014/PORT-AUDIT.md`.*

After F2–F5, every target is re-homed. The register gains two columns, both
verified on screen:
- **home:** the instrument pane, device, clip editor or adapter that carries it;
- **owner op:** the suite operation it reads or writes.

A target counts as implemented only when its home is reachable in the
candidate and reads its real owner. The "implemented: 125" of 14 Oct records
code in the frame, mostly unreachable (PORT-AUDIT B2). It is not a measure of
the product.

The re-homing ran (lane M: `acceptance.py rehome`, its input is built by
`wayfinder/tools/build_rehome.py`); its state is in the State of record of
`wayfinder/tickets/T-PLACES-ONTO-ATLAS.md`.

---

## Where the new shell lives

*Folded from the retired `PLACEMENT.md` (copied 11 October 2026); the one wayfinder sentence is brought up to date, the rest is verbatim.*

Copied 11 October 2026 from the reverse-engineering campaign so the design
sits in the cradle tree with the app. The campaign copy remains at
`desktop/cradle/docs/world-shell/`.

- **This directory** holds the design pack: `WORLD-SHELL-DESIGN.md`, the
  mockups, `icon-cut.html`, the port and instrumentation contracts, and
  `wayfinder/` (the map `MAP.md`, which holds the route and the state of the
  streams, the tickets, and the wholesale port map; the product plan and the pane ontology are folded into
  `WORLD-SHELL-DESIGN.md`).
- **The shell code** is `packages/live-shell`. It is not a second app inside
  `desktop/cradle/src`. The cradle tree is still the installed legacy app
  (`org.epilogos.oi.cradle`). The successor named in
  `LEGACY-CRADLE-RETIREMENT.md` is `org.epilogos.oi.live-shell`. Cutover
  stays owner-named; the wholesale port mounts the cradle's working
  components (terminal, browser, documents, chats) into the shell's panes.
- **Not copied:** the campaign's `evidence/`, native build stages, and
  package snapshots (about 4.4 GB). Those stay in the campaign directory.
- **The face rig** is `~/Central/Work/face-rig`. The campaign still holds a
  duplicate `face-rig.html`; it was not copied here again.
