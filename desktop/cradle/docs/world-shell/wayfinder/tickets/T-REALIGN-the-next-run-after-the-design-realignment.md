# T-REALIGN — the next run, after the design realignment (17 Oct 2026)

From the documentation lane, for the lead who opens the next full build run. The design realignment of 16 Oct changed what F3,
F4 and F5 build (FOUNDATION §3) and what several device lanes bound. This ticket says where things stand, what the run builds, in
FOUNDATION's order, and how each piece is checked. PATH stays the lead's; this is the input to its §5 and §7.

## 1. The source

- **The manual, O-I main** (`b772a05b4` or later; rendered `docs/dlw/DLW.html`, embeds served by the `dlw-device-gallery`
  preview on 5208):
  - §16.1 what goes where (track, clip, Clip view, device, view);
  - §16.3 six views; §16.4 opening, folding and hiding (Live's head, the expanded band, the window, the keys);
  - §16.5 Clip view's panels; §16.6 tracks, the mixer row, the Main track, Session view, Arrangement's automation and take lanes;
  - each mode's own tracks and clips: §17.1 Technē, §18.1 Central, §19.1 Factory, §20.1 Expressions, §21.1 Live;
  - the device entries §17–§23 (67), every one with a working design embedded.
- **Live 12 evidence:** `Work/reverse-engineering/ableton-live-12.0.25/ui/CLIP-VIEW-EVIDENCE.md` (51 captures), and the shell-side
  mapping with file:line for every move, `ui/DLW-CLIP-VIEW-MAPPING.md` (§2 what the shell does today, §4 the reassignment, §5 the ten
  disagreements, ruled in the manual).
- **Designs, on `dlw/build`:** `inhabitants/catalogue/panels/` (devices; contract `design.ts` with `popout?`, `room`, `frame`,
  `scoped`/`prefixed`; `popout.tsx`), `inhabitants/catalogue/clips/` (Clip view: `clipKit.tsx`, contract `clips/design.ts`,
  `clip:techne|central|factory|expressions|live`), the kit `inhabitants/sdk/panel.tsx` (Live's head order, `Option.why`, `Swatch`,
  `Rows onMove`, `Tile badge`, `dp-mono`).

## 2. State at handover

| Thing | State |
|---|---|
| `dlw/build` on GitHub | `82a82d43a` (16 Oct 22:20): OI Verify, O:I desktop, Exact source landing, Native Expression back all green; PR #677 MERGEABLE, CLEAN. |
| Local commits after it | the documentation lane's: the kit's gaps (`db1fb30d9`), the Studio's design (`9e57d8fe0`), this ticket. |
| Lane S1 (six-view runtime) | Not running. Its work stands uncommitted in the seat: `DeviceFlip.tsx` (the expanded band host, Esc folds), the door's `flipDevice`/`popout` seam, `DeviceView`, `deviceHost`, `designed.ts`, `App.tsx` areas (`shell/workspaceAreas.ts`), `TransportBar`, layout CSS. tsc is clean with it. Snapshot: `refs/recovered/dlw-s1-t1-wip-20261017` (`c67469fda`). |
| Lane T1 (theme) | Not running. Uncommitted in the seat: `shell/theme/index.ts`, `oi-design-system/themes/{house,oi}/dlw.json`, the converter and build scripts, `themes.css`, `styles.css` tokens. Same snapshot. |
| Lane BC3 | Landed (`e2cc4aed4`): Packet, Answer, Search, Context & world, Agent identity bound on Central — now to be folded (§3 R4). |
| Lane A1 | ai-kit `env-2`; independent of this run. |
| Bound to designs | Factory (`agent/devices/*`), Central (`central/devices/*`), Technē (`ql/devices`), the Torus. Not bound: the 24 designs of 16 Oct (§3 R5), the Studio's new design, and every clip. |

## 3. The run

Lead plus at most four Opus builders, exclusive zones, briefs from `BRIEF-BUILDER.md` with the manual sections and the design's
gallery shot as the mockup. Each item is seen on screen before the next opens (FOUNDATION §9).

**R1 — F5, the six views (finish S1).** Restore S1 from the seat (or the snapshot), finish and land it.
- The kit's `PlaceContext` gets `onExpand`/`expanded`/`onPopout` from the host; every view gets its `room` and `frame`.
- The expanded view: one device at a time, a band as wide as the detail area between Clip view and the chain; the panes shrink;
  ▸/▾ on the head, Esc folds.
- Pop-out: its own window (the native host's second window, or an in-shell floating window until it exists), Full over Whole by
  default (`popoutOf`); any number open; closes when its device leaves the chain.
- Full in a pane (▦); the pool shows Whole for a browser selection; the head's double-click folds.
- Zone: `frame/devices/**`, `App.tsx` areas, `styles.css` layout. *Done when:* the Day, the Torus, Physics, the Skillset rack and
  Scope stand in all six views in the candidate, on their owners, as their embeds show.

**R2 — F4, Clip view after Live.** One clip host draws the mode's designed clip on its owners.
- The detail area stacks Clip view over Device view when both fit; ⇧Tab switches when one shows; ⌥⌘E gives Clip view the main area.
- Clip view hosts `clips/index.ts`'s design for the selected clip's mode, with a clip binding per mode (as `DesignBinding` is for
  devices). It replaces `agent/devices/TaskClipDevice.tsx`, `central/CentralClipDetail.tsx`, `live/LiveClip.tsx` and the Expressions
  clip column (`components/NativeWorldDetail.tsx`), and `inhabitants/sdk/semantics.ts` DETAIL_CLIP_HOLDER.
- Launch is per clip (the transport's Quantize is Global); a placed clip (a Central page, an Arrangement clip) has no Launch tab;
  Envelopes as Automation or Modulation, linked or unlinked.
- Owner ops that do not exist yet are built, not listed: per-task Launch/Then/Mode/Effort/Autonomy are refused today
  (`agent/devices/taskBindings.ts:43-55`).
- Zone: `frame/detail/**`, each mode's clip file, the clip bindings. *Done when:* each mode's Clip view in the candidate matches its
  clip design on real owners.

**R3 — F3, tracks, the mixer row and Arrangement's lanes.**
- Every track's mixer row (activator, solo, arm, monitor, input and output), with each mode's meaning (§17.1–§21.1 tables).
- The Main track: row launchers, Stop All, Back to Arrangement, its own chain. Central's tracks are its workspaces and the Day is
  its Main track (`timeline/centralTrackAdapter.ts:64-68` makes streams tracks and the Day ordinary today).
- Arrangement: automation lanes under every track; take lanes with comping (attempts, captured takes, revisions); Factory's event
  lanes; needles.
- Zone: `frame/tracks/**`, the track adapters. *Done when:* in every mode a track shows its row, a recorded move shows as a lane,
  and a comp chooses what stands.

**R4 — the merged and moved devices' bindings.**
- One Agent: Answer, Agent identity, Custody and Thread bindings host on `actuation:harness-model` under `custody.*`, `id.*`,
  `thread.*` (`design.ts` `scoped`/`prefixed`; `3679a9ceb`). One Scope: `contextWorldBinding` becomes Scope's on Central.
- Off the chain, into Clip view or the views: Session grid, Arrangement ruler, Workspace (the track head and its kept context),
  Flow/Beings/Things (a page's Clip panel and editor tabs), Text/Highlight/Notes (a page's tools), Tasks/Run/Runs (a task's panels,
  the session's mixer row and lanes, takes), Expressions' scene and symbol devices (a scene's panels, Expression tab, tools), the
  Jankó keyboard (`live:keyboard` becomes the part's input and the Notes editor's key column), the Sessions/Agents/Results widgets
  (views). Search (@) opens in a pane and on the typing line, not on Central's chain.
- The Studio (§20.3, design `9e57d8fe0`): the Expression's rack, your chosen controls as its macros, the field devices in four
  chains; the shell's Studio still draws the old eight sections.
- Zone: `agent/devices/**`, `central/devices/**`, `components/expressions/studio/**`, `live/liveChainDevices.ts`.

**R5 — the 24 designs of 16 Oct, bound.** Each design names its owner paths in its header; the device run's return lists them.
- Live: Scale mapping (the Scale note device), Exact-ratio tuning; the four effects need their owner built — the torus's sound is one
  gain stage today (`native-audio.mjs`).
- Quaternal Logic: Sky modulation (any chain), M3 clock (`m3_reception`), Deck, Chakra (`ql.scene/v1`), M′ matrices.
- Rail: Files, Web, Diff, Trail, NOWs, Wiki, Calendar (no provider is installed).
- Expressions: Morph, Focus, Colour, Ink, Depth, Resonance, on the engine's registry paths.

T1 (the theme) is the lane the owner set apart for Settings › Appearance; its work waits in the seat and the snapshot.

## 4. How each piece is checked

- `node packages/live-shell/ui/scripts/candidate-reachable.mjs <files…>` before a builder edits and before a commit.
- tsc on the three roots (cradle, expressions-app, live-shell); the UI suite with WebStorage suites under `npm run test:webstorage`.
- The candidate on screen against the item's embed in the manual (the gallery at `?device=…&view=all` or `?clip=…`): a computer-use
  pass at each item's end.
- After each push: `gh pr view 677 --json mergeable,mergeStateStatus` and `gh run list --branch dlw/build`; the documentation lane
  commits `docs/dlw` to main, so merge `origin/main` taking main's `docs/dlw`.

## 5. Open, not blocking

- Live's rack (macros, chain list and devices shown and hidden) and a plug-in window are not captured; §16.4 states them from Live's
  known behaviour.
- The 17 catalogue designs of devices that left the chain stay as drawing sources until R2 and R4 retire their placements.
