# Racks and the session model — structural document model, Live 12.0.25

**Status:** evidence-backed spec, revision 1 (2026-10-09). Companion to
`../session-model.md` (container format, loader rules, clip models — not
repeated here). Scope per `COVERAGE.md`: "racks ×4, mixer/sends,
scenes/tempo" — the structural XML model needed for full-parity reconstruction.

**Evidence classes used (all offline, no Live run):**

- **E1 — App-bundle Schema** (`App-Resources/Schema/`, 173 translator files,
  8.1→12.0; the 50 `12.0_*` slices concatenated define the Live 12 class
  vocabulary; slices are per-translator *deltas*, so absence of a class there
  is not absence from the format).
- **E2 — Factory rack presets**: 963 `.adg` files under
  `App-Resources/Core Library/Racks/{Instrument,Audio Effect,Drum,MIDI Effect} Racks/`
  (gzip XML, Creator `Ableton Live 12.0.5d1`, MinorVersion `12.0_12049` —
  same document schema as 12.0.25).
- **E3 — Factory sets**: `Builtin/Templates/DefaultLiveSet.als`,
  `Core Library/Templates/Quick Start Beat.als` + `Quick Start Song.als`,
  `Core Library/Lessons/Sets/*` (APC20 Demo, Live 11 Suite Empty, …). All
  Creator 12.0.5d1 except where noted.
- **E4 — One authored rack saved by 12.0.25 itself**
  (`~/Music/Ableton/User Library/Presets/.../chunky shine master.adg`,
  Revision `2627c43816…` — byte-identical build id to the analyzed binary).
- **E5 — Crafted harness sets** (`harness/live/*.als`): checked — **none
  contain racks** (they are single-device probes). No rack claims below rest
  on E5; a crafted-rack probe is the outstanding gap (§7).

Factory content is cited for **structure only** (element shapes, ranges,
counts); no sample or preset payload is reproduced.

## 1. The four rack devices

### 1.1 Class vocabulary (E1, 12.0 slices)

| rack (UI) | device element | chain element (LiveSet, E3) | chain element (preset, E2) | chain mixer class |
| --- | --- | --- | --- | --- |
| Instrument Rack | `InstrumentGroupDevice` | `InstrumentBranch` | `InstrumentBranchPreset` | `MidiBranchMixerDevice` (MIDI-chain) / mixer inside branch |
| Audio Effect Rack | `AudioEffectGroupDevice` | `AudioEffectBranch` | `AudioEffectBranchPreset` | `AudioBranchMixerDevice` |
| MIDI Effect Rack | `MidiEffectGroupDevice` | `MidiEffectBranch` | `MidiEffectBranchPreset` | `MidiBranchMixerDevice` |
| Drum Rack | `DrumGroupDevice` | `DrumBranch` | `DrumBranchPreset` | `AudioBranchMixerDevice` |

LiveSet chains carry a **typed device chain** container naming the chain's
signal domain (E1, E3): `MidiToMidiDeviceChain`, `MidiToAudioDeviceChain`,
`AudioToAudioDeviceChain` (plus track-level `AudioTrackDeviceChain`,
`MidiTrackDeviceChain`, `GroupTrackDeviceChain`, `SendTrackDeviceChain`,
`MainTrackDeviceChain`, `MasterTrackDeviceChain`, `PreHearTrackDeviceChain`).
A drum-rack pad chain is a `DrumBranch` whose `DeviceChain` is a
`MidiToAudioDeviceChain` — an Instrument Rack nested inside (E3, Quick Start
Beat: `DrumBranch → MidiToAudioDeviceChain → InstrumentGroupDevice →
InstrumentBranch → …` to arbitrary depth).

### 1.2 Group-device chassis (E1 + E2/E4 quotes)

All four devices share the device boilerplate (§6 of `../session-model.md`)
plus the rack surface. From `AudioEffectGroupDevice` (12.0 slice) and quoted
identical in every E2/E4 file:

```xml
<AudioEffectGroupDevice Id="0">
  …device boilerplate…
  <Branches />                                <!-- chain list; members carry Id -->
  <IsBranchesListVisible Value="true" />
  <IsReturnBranchesListVisible Value="false" />
  <IsRangesEditorVisible Value="false" />
  <AreDevicesVisible Value="true" />
  <NumVisibleMacroControls Value="8" />       <!-- observed default 8, max 16 -->
  <MacroControls.0>…TimeableFloat + MidiControllerRange 0..127…</MacroControls.0>
  …MacroControls.0–15…
  <MacroDisplayNames.0–15 /> <MacroDefaults.0–15 /> <MacroAnnotations.0–15 />
  <MacroColor.0–15 /> <ForceDisplayGenericValue.0–15 />
  <ExcludeMacroFromRandomization.0–15 /> <ExcludeMacroFromSnapshots.0–15 />
  <AreMacroControlsVisible Value="true" />
  <IsAutoSelectEnabled Value="true" />
  <ChainSelector>…TimeableFloat, 0..127…</ChainSelector>
  <ChainSelectorRelativePosition Value="0" />
  <ViewsToRestoreWhenUnfolding Value="0" />
  <ReturnBranches />                          <!-- rack-internal return chains -->
  <BranchesSplitterProportion Value="0.5" />
  <ShowBranchesInSessionMixer Value="false" />
  <MacroSnapshots /> <MacroVariations><MacroSnapshots /></MacroVariations>
  <RecallSelectedSnapshotKeyMidi … /> <RandomizeMacrosKeyMidi … />
</AudioEffectGroupDevice>
```

Type-specific additions (E1): **Drum Rack** only — `ArePadsVisible`,
`PadScrollPosition`, `DrumPadsListWrapper`, `VisibleDrumPadsListWrapper`,
`ChainSelectorFilterMidiCtrl`; **Instrument Rack** — nothing extra beyond the
chassis (in the 12.0 slice `InstrumentGroupDevice` ≡ `AudioEffectGroupDevice`
surface).

### 1.3 Branch/chain skeleton in a LiveSet (E3)

Every branch member of `Branches` carries `Id`, a `Name` block, selection,
its typed `DeviceChain`, its selector zone, and its chain mixer (quoted shape,
Quick Start Beat + DefaultLiveSet):

```xml
<InstrumentBranch Id="0">
  <Name><EffectiveName Value="…" /><UserName Value="" />
        <Annotation Value="" /><MemorizedFirstClipName Value="" /></Name>
  <IsSelected Value="true" />
  <DeviceChain>
    <MidiToAudioDeviceChain Id="0">
      <Devices> …device elements, each with Id="N"… </Devices>
      <SignalModulations />
    </MidiToAudioDeviceChain>
  </DeviceChain>
  <BranchSelectorRange>            <!-- the chain-selector zone, 0..127 ints -->
    <Min Value="0" /><Max Value="0" />
    <CrossfadeMin Value="0" /><CrossfadeMax Value="0" />
  </BranchSelectorRange>
  <IsSoloed Value="false" />
  <SessionViewBranchWidth Value="55" />
  <IsHighlightedInSessionView Value="false" />
  <SourceContext><Value /></SourceContext>
  <Color Value="19" /> <AutoColored Value="true" /> <AutoColorScheme Value="0" />
  <SoloActivatedInSessionMixer Value="false" />
  <DevicesListWrapper LomId="0" />
  <MixerDevice> …chain mixer, §2.2… </MixerDevice>
</InstrumentBranch>
```

`ReturnBranch` (rack-internal return chain) is the same chassis with an
`AudioToAudioDeviceChain` and its `MixerDevice` carrying `Panorama` +
`SendInfos/AudioBranchSendInfo*` instead of `Sends` (quoted, Quick Start Beat
Drum Rack return "… Drum Processing").

### 1.4 Preset wrapper (.adg) — how factory racks serialize (E2/E4)

`.adg` = `GroupDevicePreset` (single device) or `AbletonDevicePreset`
containers; chains appear as **presets**, not live branches:

```xml
<GroupDevicePreset>
  <OverwriteProtectionNumber Value="3072" />
  <Device><AudioEffectGroupDevice Id="0"> …chassis… </AudioEffectGroupDevice></Device>
  <BranchPresets>
    <AudioEffectBranchPreset Id="0">
      <Name><EffectiveName Value="Dry" /> …</Name>
      <DevicePresets> <AbletonDevicePreset Id="0"><Device>…device…</Device>…
                       </AbletonDevicePreset> … </DevicePresets>
      <MixerPreset><AbletonDevicePreset Id="0">
        <Device><AudioBranchMixerDevice Id="0">…</AudioBranchMixerDevice></Device>
        <PresetRef><AbletonDefaultPresetRef Id="0">…
          <DeviceId Name="AudioBranchMixerDevice" />…</AbletonDefaultPresetRef></PresetRef>
      </AbletonDevicePreset></MixerPreset>
      <BranchSelectorRange><Min Value="8" /><Max Value="120" />
        <CrossfadeMin Value="59" /><CrossfadeMax Value="69" /></BranchSelectorRange>
      <SessionViewBranchWidth Value="55" />
      <DocumentColorIndex Value="6" /> <AutoColored Value="true" /> <AutoColorScheme Value="0" />
      <SourceContext><BranchSourceContext Id="0">…
        <BrowserContentPath Value="query:…" /><BranchDeviceId Value="" />…</BranchSourceContext></SourceContext>
      <ZoneSettings>                        <!-- instrument/keys zones -->
        <KeyRange><Min Value="0" /><Max Value="127" />
          <CrossfadeMin Value="0" /><CrossfadeMax Value="127" /></KeyRange>
        <VelocityRange><Min Value="1" /><Max Value="127" />
          <CrossfadeMin Value="1" /><CrossfadeMax Value="127" /></VelocityRange>
      </ZoneSettings>
    </AudioEffectBranchPreset> …
  </BranchPresets>
  <ReturnBranchPresets />
</GroupDevicePreset>
```

The loader accepts the *device element* of a preset lifted into a set
(`../session-model.md` §4); branches convert 1:1 between the two spellings
above (same field set, `ZoneSettings` vs inline `BranchSelectorRange`).

### 1.5 ChainSelector zone math (E2 verified)

Zone = `[Min, Max]` active window with `[CrossfadeMin, CrossfadeMax]` ramp
inside it, all integers 0..127 (Schema `ZoneRange`). Real multi-chain quote
(E2, Audio Effect Rack "Knob 1 RePulsor", 3 chains, Creator 12.0.5d1):

```
chain "Dry":    Min=8   Max=120  CrossfadeMin=59  CrossfadeMax=69
chain "Force":  Min=0   Max=59   CrossfadeMin=0   CrossfadeMax=8
chain 3:        Min=69  Max=127  CrossfadeMin=120 CrossfadeMax=127
```

So zones tile the selector axis with the crossfade ramp of each chain
overlapping its neighbour's window (chain gain is full inside
`[CrossfadeMax…n]`/`[…CrossfadeMin]` flat regions and ramps across the
`[CrossfadeMin,CrossfadeMax]` band; **ramp curve law not yet probed** — §7).
Selector position itself is `ChainSelector/Manual` (0..127 TimeableFloat;
observed default 0) plus a `ChainSelectorRelativePosition` display offset.
The default single/crossfaded pair case (E2, 2-chain rack): both chains
`Min=0 Max=127` with ramps `[127,127]` and `[0,0]` respectively. Drum-rack
pad chains all carry zeroed ranges — pad chains select by note, not selector
(E2, Drum Rack "Selector Kit Warm": all `BranchSelectorRange` = 0).

### 1.6 Drum Rack pad → chain layout (E1 + E2 + E3)

Pad identity lives **per chain**, not in a pad table:

- LiveSet: `DrumBranch/BranchInfo` = `{ ReceivingNote (enum int), SendingNote
  (float), ChokeGroup (enum int) }` — E3 quote: `ReceivingNote=92,
  SendingNote=60, ChokeGroup=0` (Quick Start Beat).
- Preset: `DrumBranchPreset/ZoneSettings` carries the identical triple
  (E2 quote, "Selector Kit Warm": `ReceivingNote=92 / SendingNote=60 /
  ChokeGroup=0`).
- The pad's sound is the branch's device list; factory pads nest a full
  `GroupDevicePreset/InstrumentGroupDevice` per pad (rack-in-rack, E2).
- Schema classes: `DrumZoneSettings{ReceivingNote: RemoteableEnum,
  SendingNote: UserFloat, ChokeGroup: RemoteableEnum}`;
  `DrumGroupDevice` pads surface as `DrumPadsListWrapper` +
  `FilledDrumRackPad` color entry; `ShowsZonesInsteadOfNoteNames=true` on
  selector-kit racks (E2).

### 1.7 Macro controls and snapshots (E1 + E2/E4)

- `MacroControls.0–15`: each a TimeableFloat parameter block with
  `MidiControllerRange 0..127`; display name/annotation/color/default per
  index; `NumVisibleMacroControls` gates the UI row (default 8, E2/E4).
- **Macro snapshots**: `MacroSnapshots/MacroSnapshot Id=N` with
  `{AutogeneratedNameIndex, SnapshotName, MacroValues.0–15, MacroHasValue.0–15,
  RecallSnapshotKeyMidi, OverwriteSnapshotKeyMidi}` (Schema; E4 quote:
  `SnapshotName="Clean"`, `MacroValues.7=127`, unset slots = `-1` +
  `MacroHasValue=false`). `MacroVariations/MacroSnapshots` is the parallel
  randomization-variation store.
- **Macro → parameter mappings — negative/adjusted finding:** the classic
  `MacroControlMapping` XML element does **not exist** in Live 12 documents on
  this machine: 0 hits across all 963 E2 racks, all 24 E3 sets, and the E4
  12.0.25 rack (scanned for `MacroControlMapping`, `MacroControlIndex`,
  `MappingRange`). The 12.0 Schema carries macro-mapping fields only inside
  `PluginParameterSettings`/`VstPreset`/`Vst3Preset`/`AuPreset`
  (`MacroControlIndex: Int`, `PowerMacroMappingRange: MidiControllerRange`) —
  i.e. third-party parameter mapping metadata. The native mapping store has
  moved to the Flip live-model layer, per binary strings (not decompiled —
  literal string evidence only): Flip classes `live.MacroMapping`,
  `live.MacroMappings` (`FMacroMapping.cpp`, `MacroMappingsHandle.cpp`) with
  properties `macroIndex`, `rangeMin`, `rangeMax`, `targetDevice`,
  `targetParameter`, `has_macro_mappings`. **Consequence:** a
  document-engine rack writer needs a load-probe against a Live-saved rack
  with a mapped macro to pin the exact persisted spelling (§7). Confidence:
  negative result high (exhaustive scan); replacement encoding open.

## 2. Mixer model

### 2.1 Track mixer (E3, DefaultLiveSet + Quick Start Beat)

`<Track>/DeviceChain/Mixer` (element `Mixer`, class `MixerDevice`), after the
common device boilerplate:

```xml
<Sends>                                  <!-- one TrackSendHolder per return track -->
  <TrackSendHolder Id="0">
    <Send> …TimeableFloat; Manual default 0.0003162277571 … </Send>
    <EnabledByUser Value="true" />
  </TrackSendHolder> …
</Sends>
<Speaker>…TimeableBool, true…</Speaker>  <!-- track activator -->
<SoloSink Value="false" />
<PanMode Value="0" />                    <!-- 0 = stereo balance mode -->
<Pan>…-1..1…</Pan>
<SplitStereoPanL>…-1..1…</SplitStereoPanL> <SplitStereoPanR>…-1..1…</SplitStereoPanR>
<Volume>…Manual=1, MidiControllerRange Min=0.0003162277571 Max=1.99526238…</Volume>
<ViewStateSesstionTrackWidth Value="93" />   <!-- sic: writer's typo is canonical -->
<CrossFadeState>…Manual=1…</CrossFadeState>  <!-- crossfader assign, enum -->
<SendsListWrapper LomId="0" />
```

Closed forms worth pinning: send/volume `MidiControllerRange` endpoints are
`10^(-70/20) = 0.0003162277571` (−70 dB) and `10^(+6/20) = 1.99526238`
(+6 dB), linear-gain domain; `Pan` ∈ [−1, 1]. `MixerDevice` schema also
declares `CrossFadeState` (crossfader A/B/Off assign); the observed default
is `1` on every track (semantics of the enum not probed, §7).
Schema `TrackSendHolder = {Send: TimeableFloat, Active: RemoteableBool}` —
in-set serialization adds `EnabledByUser`; send *count* must equal the set's
return count (loader-enforced, `../session-model.md` §4).

### 2.2 Chain mixer (E1 + E3)

Chain/branch mixer classes: `AudioBranchMixerDevice = {Speaker, Volume,
Panorama, SendInfos: AudioBranchSendInfo*, RoutingHelper,
SendsListWrapper}`; `AudioBranchSendInfo = {Send: TimeableFloat,
Active: RemoteableBool, Index: RemoteableInt}`; `MidiBranchMixerDevice`
analogous. Rack **return chains** route through `SendInfos` (one per rack
return), while track sends use the `Sends/TrackSendHolder` list — two
different spellings of the same law (E3 quote, Drum Rack `ReturnBranch`).
Chain send amount default matches the track default (−70 dB linear).

### 2.3 Master, cue and crossfader (E3, DefaultLiveSet)

`LiveSet/MainTrack` (the master) `DeviceChain/Mixer` extends the track mixer
with, in order: `Tempo` (TimeableFloat, Manual=120 — the session tempo
lives here, already validated by load experiments in `../session-model.md`
§2), `TimeSignature` (Manual=201, §3.3), `GlobalGrooveAmount`
(Manual=100, 0..100), `CrossFade` (Manual=0 — the crossfader position),
`TempoAutomationViewBottom/Top` (60/200 — the master tempo lane zoom).
`PreHearTrack` is the cue mixer (same chassis, no sends).
`LiveSet/CrossfadeCurve` = value enum, observed `Value="2"` (Quick Start
Beat); `SendsPre/SendPreBool Id=N Value=bool` stores per-return pre/post
flag in return order. Master `Volume` uses the same −70…+6 dB range; the
MainTrack mixer carries `Pan`/`SplitStereoPanL/R` blocks even though the UI
hides them (E3).

## 3. Session model

### 3.1 Scenes (E3, DefaultLiveSet; enabled-state quote from Quick Start Song)

```xml
<Scene Id="16">
  <FollowAction> …10 fields, per devices/follow-action.md… </FollowAction>
  <Name Value="Slow Rock" /> <Annotation Value="" /> <Color Value="69" />
  <Tempo Value="74" /> <IsTempoEnabled Value="true" />
  <TimeSignatureId Value="201" /> <IsTimeSignatureEnabled Value="false" />
  <LomId Value="0" /> <ClipSlotsListWrapper LomId="0" />
</Scene>
```

Scene tempo/time-signature are **scene properties** (not clip properties);
`IsTempoEnabled=true` makes scene launch adopt `Tempo`. `TimeSignatureId` is
the encoded signature (201 = 4/4 default — the *only* value observed across
all 24 factory sets; encoding open, §7). Scene `Name` is a plain value
element, unlike track `Name/{EffectiveName,UserName,…}`.

### 3.2 Clip slots (E3)

Session slots live per track at `DeviceChain/<Main|Midi|Audio>Sequencer →
ClipSlotList/ClipSlot` (the group track nests them as
`Slots/GroupTrackSlot*` instead, §4). Three states, quoted:

```xml
<ClipSlot Id="0">
  <LomId Value="0" />
  <ClipSlot><Value /></ClipSlot>   <!-- empty: no element inside Value -->
  <HasStop Value="true" />         <!-- stop button shown -->
  <NeedRefreeze Value="true" />
</ClipSlot>
```

A clip replaces the empty `<Value />` with `<Value><MidiClip Id="0" …/></Value>`
(or `AudioClip`); `HasStop=false` hides the stop button (clip-filled slots in
E3 sets). `FreezeSequencer` mirrors the same slot list for freeze.

### 3.3 Tempo and time signature storage

- Session tempo: `MainTrack/DeviceChain/Mixer/Tempo/Manual` (§2.3).
- Song signature: `MainTrack/…/Mixer/TimeSignature/Manual` = code `201`
  (= 4/4; single-sample evidence). Clip-local signatures store a
  `TimeSignature/TimeSignatures` block (empty in every factory set here).
- Scene-adopted tempo/sig per §3.1. Arrangement automation of tempo targets
  `Tempo/AutomationTarget` like any TimeableFloat.
- `Transport` (LiveSet child) carries the session clock: `{PhaseNudgeTempo,
  LoopOn, LoopStart, LoopLength, LoopIsSongStart, CurrentTime, PunchIn,
  PunchOut, MetronomeTickDuration, DrawMode}` (beats; quoted
  defaults LoopStart=8, LoopLength=16, LoopOn=false). `Grid` = `{FixedNumerator,
  FixedDenominator, GridIntervalPixel, Ntoles, SnapToGrid, Fixed}`;
  `GlobalQuantisation`/`AutoQuantisation` are value elements on LiveSet.

### 3.4 Groove pool (E3, APC20 Demo)

```xml
<GroovePool><LomId Value="0" /><Grooves>
  <Groove Id="0">
    <LomId Value="0" />
    <Name Value="SP1200 8 Swing-54" />
    <Clip><Value><MidiClip Id="0" Time="0"> …41 children — the .agr content
      inlined as a clip… </MidiClip></Value></Clip>
    <Grid Value="1" />
    <QuantizationAmount Value="0" />
    <TimingAmount Value="100" /> <RandomAmount Value="0" /> <VelocityAmount Value="30" />
    <Annotation Value="" /> <Selection Value="false" />
    <SourceContext><SourceContext Id="0"><OriginalFileRef>…</OriginalFileRef>
      <BrowserContentPath Value="query:LivePacks#…/SP1200%208%20Swing-54.agr" />
      <LocalFiltersJson Value="" /></SourceContext></SourceContext>
  </Groove> …
</Grooves></GroovePool>
```

The groove **is** a MIDI clip (the extracted timing grid) inlined into the
set — consistent with the `.agr`/`GrooveSettings` knowledge already in
`../session-model.md` §8; `TimingAmount/VelocityAmount/RandomAmount` are the
per-groove application amounts (0..100+). Clips reference pool entries via
their `GrooveSettings` block.

### 3.5 Locators (E3, APC20 Demo)

`LiveSet/Locators/Locators/Locator Id=N = {LomId, Time (beats), Name,
Annotation, IsSongStart}`. Set-level loop/locate interaction:
`Transport/LoopIsSongStart`.

## 4. Track topology in LiveSet (E1 + E3)

```
LiveSet
├── Tracks/                      document-order list; member tags:
│     MidiTrack | AudioTrack | GroupTrack | ReturnTrack   (each Id="N")
│   grouping: members carry TrackGroupId=<GroupTrack Id> (-1 = ungrouped);
│   GroupTrack carries Slots/GroupTrackSlot* (merged session grid) and the
│   same track chassis; MidiTrack adds ReWireDeviceMidiTargetId,
│   PitchbendRange(=96), IsTuned, ControllerLayout*
├── MainTrack/                   the master (§2.3) — NOT a member of Tracks/
├── PreHearTrack/                the cue track
├── SendsPre/SendPreBool*        per-return pre/post, in return order
├── Scenes/Scene*                §3.1
├── Transport, Grid, Locators, GroovePool, …   §3
└── TracksListWrapper, VisibleTracksListWrapper, ReturnTracksListWrapper,
    ScenesListWrapper, CuePointsListWrapper   (stub wrappers, no members)
```

Verified counts (E3): DefaultLiveSet `Tracks` = 2 MidiTrack + 2 AudioTrack +
2 ReturnTrack; Quick Start Beat = 4 MidiTrack + 2 ReturnTrack + racks;
Live 11 Suite Empty = 29 tracks with one `GroupTrack Id=76` and five members
`TrackGroupId=76`. Return tracks are plain `Tracks` members (already
established in `../session-model.md` §2); their `DeviceChain` uses the track
chassis (`Mixer`, `FreezeSequencer`, `DeviceChain/Devices`) without a
MainSequencer.

## 5. Verification ledger

| claim | evidence |
| --- | --- |
| Group-device chassis field list | E1 12.0 slices × E2 r159.adg quote — identical order |
| Branch chassis in set (InstrumentBranch) | E3 Quick Start Beat (Kick Fishnet rack, 14 InstrumentBranch) |
| Branch-per-type element names in set | E3 counts: AudioEffectBranch ×2, MidiEffectBranch ×2, DrumBranch ×17, ReturnBranch ×4 |
| Preset branch wrapper + ZoneSettings | E2 r250.adg (InstrumentBranchPreset tail quoted) |
| ChainSelector zone math, tiled+ramps | E2 r215.adg (3-chain ranges quoted §1.5) |
| Drum pad identity = per-branch note | E3 DrumBranch/BranchInfo(92,60,0) ≡ E2 r1.adg DrumBranchPreset/ZoneSettings |
| Drum pad nests rack-in-rack | E2 r1.adg: DrumBranchPreset/DevicePresets/GroupDevicePreset/InstrumentGroupDevice |
| Macro snapshot shape + unset = −1/false | E4 12.0.25 rack MacroSnapshots quote; Schema MacroSnapshot class |
| NO MacroControlMapping element in documents | exhaustive scan: 963 .adg + 24 .als + E4, 0 hits; Flip `live.MacroMapping` strings in binary |
| Track mixer params + dB closed forms | E3 DefaultLiveSet Mixer quote; 10^(±dB/20) endpoints |
| Chain mixer + SendInfos spelling | E1 AudioBranchMixerDevice/AudioBranchSendInfo; E3 ReturnBranch quote |
| Master mixer carries Tempo/TimeSignature/GrooveAmount/CrossFade | E3 DefaultLiveSet MainTrack Mixer (33 children listed) |
| Scene shape + enabled tempo | E3 DefaultLiveSet ×8 scenes; Quick Start Song scene 16 "Slow Rock" Tempo=74 enabled |
| ClipSlot states | E3 DefaultLiveSet (empty) + APC20 Demo (clip-filled, HasStop=true) |
| Groove pool inline clip | E3 APC20 Demo Groove[0] quote |
| Locator shape | E3 APC20 Demo Locator[0] quote |
| Grouping topology (TrackGroupId / GroupTrackSlot) | E3 Live 11 Suite Empty (Id=76 group, 5 members) |

## 6. Where this leaves the crate

- Racks are **pure structure** over already-verified parts: the device
  boilerplate (session-model §6) + `Branches` list + per-chain typed
  `DeviceChain` + zone triple + chain mixer. A writer that can emit devices
  can emit racks with no new parameter machinery.
- The mixer/session surfaces above are value-addressable
  (`…/Mixer/Volume/Manual`, `…/Scene/Tempo`, `GroovePool/Grooves/Groove`) and
  loader-constrained only by the already-recorded rules (send-count vs
  returns, Id-carrying list members, allocated pointees).
- Drum Racks need one new primitive beyond racks: pad identity
  (`ReceivingNote`/`ChokeGroup`) + the `ShowsZonesInsteadOfNoteNames` flag.

## 7. Open items (owned, blocking nothing above)

1. **Macro mapping persistence** — one probe: hand-author a rack with a
   mapped macro against the Flip-spelling hypothesis (`macroIndex`,
   `rangeMin/Max`, `targetParameter`), load in Live, save, diff. Highest-value
   single probe in this lane.
2. **TimeSignatureId encoding** — collect a set saved with a non-4/4 scene
   signature; decode code ↔ (num, den).
3. **ChainSelector crossfade curve** — equal-power vs linear vs
   `CrossfadeCurve` enum (observed value 2); render probe through a
   selector rack.
4. **`CrossFadeState` enum semantics** (A/Off/B ↔ values) — one load probe or
   a saved set with tracks assigned to A/B.
5. **Crafted-rack corpus** — harness/live has no rack sets; bulk-rack builders
   (chained racks, drum racks, selector racks) should join the golden corpus
   once (1) lands.
