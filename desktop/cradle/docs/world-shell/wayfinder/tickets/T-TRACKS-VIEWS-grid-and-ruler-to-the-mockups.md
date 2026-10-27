# T-TRACKS-VIEWS — the shared grid and ruler at the craft floor

FOUNDATION §3 F3. The shared `SessionGrid` and `ArrangementRuler` landed minimal (F3); the Central and Factory track
builders (14 Oct) named what the views lack to carry their material at the mockups' floor. Builder: Sonnet. 14 Oct 2026.

## Realises

Manual `docs/dlw/DLW.md` §3 (Session: tracks as columns, clips in slots, stops as rows, the empty slot's square stops
the track; Arrangement: the same clips on one ruler). Lock §9.1 (every mode reads track/clip/stop/takes the same way).
Craft floor: `desktop/cradle/docs/world-shell/world-shell-mockup.html` (the session grid and the arrangement),
`world-shell-mockup-base-session` / `-r2-scenes` (Central's five coloured columns), the legacy grid and run viewer
being ported: `agent/AgentSessionGrid.tsx`, `agent/AgentArrangementView.tsx`.

## What the views gain (each generic — the views name no mode)

Grid (`frame/tracks/SessionGrid.tsx`):
- fold a group by `parentId` (`AgentSessionGrid.tsx:78,92-96`); one rail per ancestor in that ancestor's colour
  (`:180-183`); group roll-up cells derived from members' `parentId` and `status` (`:214-229`);
- a waiting clip looks waiting (`.cs.clip.waiting`), distinct from stopped;
- a lit retry on a stalled lane where the set carries one (`WorldTrackActions.retry`, a stalled flag on the track)
  (`:238-247`);
- an action's receipt (`{ok, note}` / `{ok:false, error}`) shown where it was pressed (`AgentShellRoot.tsx:90-92`);
  an owner-disclosed absence on a clip (`WorldTrackClip.note`) (`AgentSessionGrid.tsx:139`).

Ruler (`frame/tracks/ArrangementRuler.tsx`):
- when `set.ruler` exists, lay only clips with `at` (no `at`, no place on the ruler);
- a fixed window ending now when the ruler says so (`ruler.end` + a now line) (`AgentArrangementView.tsx:39,200`);
- a stalled needle in `--stall` with its age (`:96-98`); running as an open edge; queued as a dash.

Additive fields on `timeline/worldTrackAdapter.ts` only; every existing adapter keeps working unchanged.

## Zone

`packages/live-shell/ui/src/frame/tracks/SessionGrid.tsx`, `ArrangementRuler.tsx`, `tracks.css`,
`packages/live-shell/ui/src/timeline/worldTrackAdapter.ts` (additive optional fields only),
`packages/live-shell/ui/tests/tracks-views*.test.mjs`. Not the adapters or the hooks (others own them).

## Done when (lead, on screen)

Factory's grid folds its helpers under their parent with ancestor rails; a stalled lane is striped with its retry lit;
Central's five columns carry the mockup colours; the ruler shows a now line and stalled needles; no view names a mode
(`tests/f3-tracks.test.mjs` and the tripwire stay green).

## State of record (moved from PATH sec 7, 22 Oct 2026)

Moved verbatim from the retired `PATH.md` (history: PATH.md at `41557a9ed`). Hashes, run labels (r1, r23 ...) and cross-references inside are as PATH wrote them; "PATH sec N" and "FOUNDATION sec N" in this text name the retired files, whose content is now in `MAP.md` (State of the streams, The foundation's route), `EXECUTE.md` and the tickets.

### PATH sec 7: the grid and ruler regain the World-cut presentation (lane K)

Then: the shared grid and ruler regained what the World-cut presentation drew (`c89cb9ab1`, lane K: standing edges,
sections by atmosphere, cron firings — at their instant on Central's ruler too —, the retained occasion with its admission
light, walk rails, ruler zoom/pan/snap; ported from `09a573a1d`).
