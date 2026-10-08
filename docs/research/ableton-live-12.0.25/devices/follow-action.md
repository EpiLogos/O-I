# FollowAction — element shape, loader acceptance, probe status (Live 12.0.25)

**Status:** element shape documented + loader-accepted; session-launch
semantics **BLOCKED** for the export driver (2026-10-08, live render lane).
Owner: session model M4 (the FollowAction state machine row in
`session-model.md` §8 points here).

## Element shape (from the template, loader-accepted)

`FollowAction` sits per-clip (MidiClip and AudioClip both carry it; all 73
arrangement clips of `evidence/sets/template-piano-voices-mastering.xml`
have it), between `Envelopes` and `Notes` in template relative order. The
brief's guessed tags `FollowActionMode` / `action_time` **do not exist**;
the witnessed shape is:

```
<FollowAction>
  <FollowTime Value="4" />            <!-- beats; template default 4 = one bar -->
  <IsLinked Value="true" />
  <LoopIterations Value="1" />
  <FollowActionA Value="4" />         <!-- action enum, A slot -->
  <FollowActionB Value="0" />
  <FollowChanceA Value="100" />       <!-- percent -->
  <FollowChanceB Value="0" />
  <JumpIndexA Value="1" />
  <JumpIndexB Value="1" />
  <FollowActionEnabled Value="false" />
</FollowAction>
```

The template's stored element is exactly this with `FollowActionEnabled
false` — i.e. the stored default action is A=4 at chance 100, gate closed.
Which enum value is "Next" is UNVERIFIED (A=4 is the stored default; the
UI's fresh-clip default is Next, so 4 = Next is plausible but unproven).
A hand-built element with `FollowActionEnabled=true` loads and exports
without any loader complaint (FA1_NEXT, below).

## Probe sets and renders (2026-10-08)

Builder: `harness/build_followaction.py` (takes a fresh `build_set_midi.py`
Operator output, stamps the template element on every clip, duplicates the
clip once after itself, shrinks the transport loop). Sets
`harness/live/FA1_NEXT.als` (enabled) / `FA2_OFF.als` (disabled template
default) / `FA3_POSONLY.als` (single offset clip, diagnostic); renders
`FA1_NEXT.aif` / `FA2_OFF.aif` / `FA3_POSONLY.aif` (10.75 s each).

| probe | intent | result |
|-------|--------|--------|
| FA1 vs FA2 | does follow engaged change the render? | **Dither-identical** (max\|Δ\| 2 LSB16, 2.55% >1 LSB) — arrangement export is FollowAction-invariant, as expected for session-only behavior |
| FA1/FA2 clip 2 | does playback continue past the first clip? | **VOID — clip 2 never sounded in either render** (silence from 4.25 s; both clips verified present in the built XML) |
| FA3_POSONLY | single clip at arrangement 9.75..19.5 beats | **the clip's notes played at arrangement 0**, not at `CurrentStart` — the offset was not honored |

## The loader fact that voided the probe

A hand-built second `Events` member (Id 912, `CurrentStart` 9.75, verified
in the built XML, no loader rejection) contributes no audio; and a lone
clip with `CurrentStart` 9.75 renders its note grid at position 0.
Hand-built arrangement MidiClips are **anchored at arrangement 0 regardless
of `CurrentStart`** — either the loader re-homes them or the real writer
stores arrangement position in a companion element the crafted sets omit
(the single-clip sets so far all sat at 0, so this was never exercised).
This is an `live-set` loader-model fact, not a FollowAction fact; it is
recorded in `session-model.md` §7 and blocks ALL future multi-clip /
offset-clip crafted sets until the anchoring element is identified.

## What is actually established for M4

- Element shape and child order (above) — loader-accepted, template-evidenced.
- `FollowActionEnabled` gates the element without loader complaint.
- Arrangement export/render is FollowAction-invariant (FA1 ≡ FA2).
- Session-launch semantics (follow to the next scene slot under global
  quantise, chance/jump resolution, `FollowTime` counting) remain
  **unprobed**: the export driver renders the arrangement timeline only and
  cannot launch session clips. Needed: a session-capture driver (record
  session playback into the arrangement, or a LOM-based launcher) — queued
  as backlog, per the brief's two-attempt block (both attempts spent:
  FA1/FA2 pair, FA3 diagnostic).

## Evidence

- Template shape: `evidence/sets/template-piano-voices-mastering.xml`
  (640 FollowAction elements; shape identical across MidiClip/AudioClip/Scene)
- Sets/renders: `harness/live/FA1_NEXT.als`, `FA2_OFF.als`,
  `FA3_POSONLY.als`; `harness/renders/FA1_NEXT.aif`, `FA2_OFF.aif`,
  `FA3_POSONLY.aif`
- Builder: `harness/build_followaction.py`; timeline analysis inline
  (250 ms RMS windows, `analyze_render.read_aiff`)
