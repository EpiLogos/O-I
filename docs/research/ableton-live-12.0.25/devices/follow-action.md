# FollowAction — element shape, loader acceptance, anchoring RESOLVED (Live 12.0.25)

**Status:** element shape documented + loader-accepted; **the crafted-clip
anchoring element is IDENTIFIED (2026-10-08 late lane): the clip element's
`Time` attribute**; session-launch semantics remain **BLOCKED** for the
export driver (arrangement export is FollowAction-invariant). Owner:
session model M4 (the FollowAction state machine row in `session-model.md`
§8 points here).

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

## The anchoring element — RESOLVED: the clip `Time` attribute (2026-10-08 late lane)

The Schema translator (`App-Resources/Schema/12.0_12049.txt`) lists `Time
Class="Double"` as the FIRST child of both `MidiClip` and `AudioClip` — and
the template set writes it as an XML **attribute on the clip element**:

```
<MidiClip Id="20" Time="13.105149017649017">   <!-- == CurrentStart -->
<AudioClip Id="10" Time="371.5">                <!-- == CurrentStart -->
```

Census of `template-piano-voices-mastering.xml`: **all 73 arrangement clips**
(56 MidiClip + 17 AudioClip) carry `Time` == `CurrentStart` exactly; **none
of the 1152 session-slot clips carries `Time`** (session placement is the
slot, not the attribute). The crafted builders (`build_set.py`,
`build_set_midi.py`) wrote `<MidiClip Id="910">` with no `Time` — the loader
defaults it to 0 and anchors the clip's content at arrangement 0 regardless
of `CurrentStart`. (The same absent-attribute is invisible in every earlier
crafted set because they all sat at 0.)

**Loader test FA4_TIME (one render; the brief allowed two):** `FA1_NEXT.als`
re-built with the single delta `Time` = `CurrentStart` stamped on both clips
(`0.0` and `9.75`; FollowAction still enabled, geometry otherwise
identical). Render `FA4_TIME.aif` (10.75 s, 21.5-beat loop): clip A sounds at
beats 0..8.0 and **clip B sounds at beats 9.75..17.8** (4.80-8.90 s) — both
clips play at their attribute positions. FA1's render had BOTH clips at 0
(clip B voided); FA3's lone clip at `CurrentStart` 9.75 played at 0. The
`Time` attribute is the anchoring element, and it alone repairs both defects.

Consequences:

- Arrangement clip placement semantics: **content time `c` sounds at
  arrangement `Time + (c − Loop/LoopStart)`** — consistent with every
  render so far (all had Time = LoopStart = 0) and with the template's
  comp-take clips (window [CurrentStart, CurrentEnd] = content [LoopStart,
  LoopStart + CE−CS]).
- Multi-clip / offset-clip crafted sets are **UNBLOCKED**: stamp `Time`
  (= `CurrentStart`) on every crafted clip. `build_set_midi.py` and
  `build_set.py` should adopt this (backlog row updated).
- The real writer also writes `Time` on session-slot clips' `MidiClip`
  elements? — no: census says session clips carry NO `Time`; the earlier
  grep hits (`MidiClip Id="0" Time="210.49..."`) ARE arrangement clips.
- `LaunchMode`/`LaunchQuantisation` (the brief's variant B) were **not
  needed** — the anchor is `Time` alone; variant B was never spent.

## The loader fact that voided the FA1-FA3 probes (superseded reading)

A hand-built second `Events` member (Id 912, `CurrentStart` 9.75, verified
in the built XML, no loader rejection) contributed no audio; and a lone
clip with `CurrentStart` 9.75 rendered its note grid at position 0.
Hand-built arrangement MidiClips anchored at arrangement 0 **because the
crafted clips omitted the `Time` attribute** (resolved above). Recorded in
`session-model.md` §7; the §7 row is revised by this dossier.

## What is actually established for M4

- Element shape and child order (above) — loader-accepted, template-evidenced.
- `FollowActionEnabled` gates the element without loader complaint.
- Arrangement export/render is FollowAction-invariant (FA1 ≡ FA2).
- **Crafted-clip anchoring = the clip element's `Time` attribute**
  (= `CurrentStart`; loader-clamped default 0) — loader-proven by FA4_TIME;
  multi-clip crafted sets unblocked.
- Session-launch semantics (follow to the next scene slot under global
  quantise, chance/jump resolution, `FollowTime` counting) remain
  **unprobed**: the export driver renders the arrangement timeline only and
  cannot launch session clips. Needed: a session-capture driver (record
  session playback into the arrangement, or a LOM-based launcher) — queued
  as backlog (one attempt of the brief's two was returned unspent: only
  FA4_TIME rendered; the LaunchMode variant was never needed).

## Evidence

- Template shape: `evidence/sets/template-piano-voices-mastering.xml`
  (640 FollowAction elements; shape identical across MidiClip/AudioClip/Scene;
  73/73 arrangement clips carry `Time` == `CurrentStart`)
- Sets/renders: `harness/live/FA1_NEXT.als`, `FA2_OFF.als`,
  `FA3_POSONLY.als`, `FA4_TIME.als`; `harness/renders/FA1_NEXT.aif`,
  `FA2_OFF.aif`, `FA3_POSONLY.aif`, `FA4_TIME.aif`
- Builder: `harness/build_followaction.py`; FA4 built from `FA1_NEXT.als`
  by stamping `Time` (inline edit); timeline analysis inline
  (100 ms RMS windows, `analyze_ec_duck.read_aiff_stereo`)

## Builders adopt the `Time` attribute (2026-10-09, offline engineering lane)

All three crafted-set builders now stamp `Time` = `CurrentStart` on every
arrangement clip they write (adoption landed with the probes-round commit
89a66f07a; this lane verified the adoption is complete and made it
checkable):

- `build_set.py` (its single arrangement AudioClip), `build_set_midi.py`
  (its single arrangement MidiClip), `build_followaction.py` (both clips,
  including the duplicated second clip at a nonzero offset — the exact case
  FA1–FA3 got wrong). The attribute format matches the real writer's census
  forms (`"0"`, `"216"`, `"371.5"`, full-precision repr decimals): `Time` ==
  `CurrentStart` as strings, per the template census.
- Offline self-check: `harness/check_clip_time.py` (runs without Live; exit
  code is the verdict). It re-proves the template census against the pinned
  evidence set (73 arrangement clips = 56 MidiClip + 17 AudioClip, every one
  `Time` == `CurrentStart`), then builds a MIDI set, an audio set and a
  two-clip follow-action set into a temp dir (synthetic device preset/WAV;
  nothing is written into `harness/live/`) and asserts every arrangement
  clip carries `Time` == `CurrentStart` — including the nonzero-offset
  second clip — and re-reads `FA4_TIME.als` when present.
- Status: unchanged in kind. The stamp itself remains **loader-proven by
  FA4_TIME only**; the self-check is structural (no render was spent, none
  was available on this offline lane). Session-launch semantics stay
  unprobed (section above).
