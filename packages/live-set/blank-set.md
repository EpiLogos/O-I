# The blank set

This document is what live-set's New set writes. `blank_set()` (`src/acts.rs`) is written from it, and the test
`the_blank_set_keeps_every_element_a_set_live_wrote_keeps` reads its table. The table lists each element a set Live 12.0.25 writes,
in Live's order and nesting, with the values Live wrote and the values the blank set writes. The blank set has every element the
table names and nothing it leaves out (DLW build ruling 2026-11-08, 0.10; written through this document by DLW build ruling
2026-11-09, 46c item 1).

**Source:** `docs/research/ableton-live-12.0.25/session-model.md`, the study's session and device model. The evidence and Schema
vocabulary below are the ones it names.

## The evidence

- **The set.** `evidence/sets/template-piano-voices-mastering.xml` in that study, a real authored set, unpacked. Its root says
  `Creator="Ableton Live 12.0.25"`, `Revision="2627c4381666539a5a808a0e92d54866fe4b1706"`, `MajorVersion="5"`,
  `MinorVersion="12.0_12049"` and `SchemaChangeCount="12"`.
- **Provenance class:** reference study only, under the study's own rules. No Live code, samples, presets or artwork are
  redistributed, and the evidence set is not in this repository. Element names, format constants and the values a new set holds
  are what this document carries.
- **Grade:** observed in one set that Live 12.0.25 wrote, not loader-validated. The study marks a rule *validated* only when Live's
  own loader enforced it, and the blank set has had no such load. Whether Live opens a set made by New set without a warning is the
  owner's check (walk #857), because Live is never driven here.
- **Where the check runs.** In CI, the test compares the blank set's elements, child order and values with the table. Where the
  evidence set stands (`OI_EVIDENCE_SETS`, or the study's own folder), the same test also compares the table with the evidence:
  every element, child order and value Live wrote.

## The Schema check

Every element in the table is checked against the Schema vocabulary in the app,
`Ableton Live 12 Suite.app/Contents/App-Resources/Schema/12.0_12049.txt` (`AbletonSchema Version="5" TranslatorNumber="12049"
ChangeCount="12"`, the same version the evidence set names).

- Each element must be a member of its parent's class block. A numbered family is checked through its `.0` member, and the members
  of a `RemoteableList` or a `Slot<…>` are named by their own class.
- The **Schema class** column gives the class each element resolves to.
- Result: 1184 elements, and none of them is missing from the Schema.

## How to read the table

- **Sections.** There are three: the set's first MIDI track (`MidiTrack`), its first return (`ReturnTrack`), and the set itself
  (`LiveSet`), which includes its Main and cue tracks.
- **Element.** The path from the section's root. Numbered families (`ControllerTargets.0`, `.1`, …) are read as `.N`, and a run of
  one name (scenes, clip slots, lanes) appears once.
- **Children.** Listed in Live's order. The table does not look inside what a set *holds* rather than *is*. Those elements appear
  as present but empty: `Devices`, `Envelopes`, `Events`, `Grooves`, a slot's clip (`Value`), the list of tracks (`Tracks`; each
  section is one of them), and the `Locators` and `TakeLanes` lists.
- **Live wrote.** Each distinct value the evidence set holds at that path, in the order met. `""` is an empty value.
- **The blank set writes.** `=` means the blank set writes Live's values. Any other entry is the blank set's own values, and the
  reason is given below.
- **Standing.** `state`, or `view state, Live’s own`. View state is pure view: track widths, lane heights, editor lane models,
  folds, scroll, zoom, selection and the draw mode. It is listed because Live writes it, so the blank set carries it knowingly.
  The shell neither reads nor sets it.

## What the blank set leaves

The blank set holds none of the set's content: no device, clip, envelope, groove, locator or take. It has one MIDI part, one
return, the Main track, the cue track and four empty scenes. Everything else the table names is there, at a new set's values.

## Where the blank set writes other values

There are 39 rows where the blank set's values are not the ones Live wrote. Each falls under one of the reasons below.

- **A new set, not that set's use** (LV01, DLW build ruling 2026-11-08):
  - The Main track's tempo is 120, not 131.
  - The loop is off and 16 beats long (`Transport/LoopOn`, `LoopLength`), not on and 512 beats.
  - The set is not in key (`InKey`), the automation mode is off (`AutomationMode`) and MIDI prelisten is off (`MidiPrelisten`).
  - The cue track's volume is at unity (`PreHearTrack/.../Volume/Manual` 1, not 0.912).
  - The return holds no device, so it is `A-Return`, not the evidence's `A-Reverb`.
  - The colour sequence starts at 0 (`ColorSequenceIndex`).
  - The player tracks' colour picker gives 11 next (`NextColorIndex`), the colour after the one part's colour, 10.
- **Nothing recorded or targeted yet:**
  - No takes have been counted (`TakeCounter` 0).
  - No controller target is locked (`LockEnvelope` 0 only).
  - `NextPointeeId` is the blank set's own: 223, above the targets it numbers, not the evidence's 35094.
- **View state at a new set's values:**
  - Nothing is selected, since there is no device or envelope (`SelectedDevice`, `SelectedEnvelope` and
    `LastSelectedTimeableIndex` are 0).
  - The first track is highlighted (`HighlightedTrackIndex` 0).
  - The time selection starts at 0 and the zoom is 1 (`TimeSelection/AnchorTime`, `BeatTimeHelper/CurrentZoom`).
  - The MIDI fold mode is 0 (`MidiFoldMode`).
  - Each track is 93 wide, the width of the evidence's MIDI track (`ViewStateSesstionTrackWidth`, where the evidence's Main track
    is 103 and its cue track 74).
- **The routing's words:**
  - Each routing's `Target` is Live's own: `MidiIn/External.All/-1` and `AudioOut/Main`.
  - The display strings are the words the shell reads back as a part's input and output (`edit.rs`, the mixer reading's `input`
    and `output`): `All Ins`, `All Channels` and `Main`. The evidence set kept other words for the same targets (`Ext: All Ins`,
    an empty channel, `Master`).
  - Whether Live keeps or rewrites them on opening is part of the owner's check (#857).
- **The same floats, spelled shortest:**
  - The note tools' shape levels (`ShapeLevels/RemoteableFloat`) are the 32-bit floats Live wrote, spelled as the shortest
    decimal that reads back as each one (`0.05` for Live's `0.05000000075`).

## The blank set

### MidiTrack

| Element | Children, in Live's order | Live wrote | The blank set writes | Schema class | Standing |
| --- | --- | --- | --- | --- | --- |
| `/MidiTrack` | LomId, LomIdView, IsContentSelectedInDocument, PreferredContentViewMode, TrackDelay, Name, Color, AutomationEnvelopes, TrackGroupId, TrackUnfolded, DevicesListWrapper, ClipSlotsListWrapper, ViewData, TakeLanes, LinkedTrackGroupId, SavedPlayingSlot, SavedPlayingOffset, Freeze, VelocityDetail, NeedArrangerRefreeze, PostProcessFreezeClips, DeviceChain, ReWireDeviceMidiTargetId, PitchbendRange, IsTuned, ControllerLayoutRemoteable, ControllerLayoutCustomization |  | = | MidiTrack | state |
| `/MidiTrack/LomId` |  | `0` | = | Int | state |
| `/MidiTrack/LomIdView` |  | `0` | = | Int | state |
| `/MidiTrack/IsContentSelectedInDocument` |  | `false` | = | RemoteableBool | view state, Live’s own |
| `/MidiTrack/PreferredContentViewMode` |  | `0` | = | RemoteableInt | view state, Live’s own |
| `/MidiTrack/TrackDelay` | Value, IsValueSampleBased |  | = | TimeInSamplesOrMs | state |
| `/MidiTrack/TrackDelay/Value` |  | `0` | = | UserFloat | state |
| `/MidiTrack/TrackDelay/IsValueSampleBased` |  | `false` | = | RemoteableBool | state |
| `/MidiTrack/Name` | EffectiveName, UserName, Annotation, MemorizedFirstClipName |  | = | DeviceChainContainerName | state |
| `/MidiTrack/Name/EffectiveName` |  | `1-MIDI` | = | RemoteableString | state |
| `/MidiTrack/Name/UserName` |  | `""` | = | RemoteableString | state |
| `/MidiTrack/Name/Annotation` |  | `""` | = | RemoteableString | state |
| `/MidiTrack/Name/MemorizedFirstClipName` |  | `""` | = | RemoteableString | state |
| `/MidiTrack/Color` |  | `10` | = | RemoteableDocumentColor | state |
| `/MidiTrack/AutomationEnvelopes` | Envelopes |  | = | AutomationEnvelopes | state |
| `/MidiTrack/AutomationEnvelopes/Envelopes` |  |  | = | RemoteableList | state |
| `/MidiTrack/TrackGroupId` |  | `-1` | = | RemoteableInt | state |
| `/MidiTrack/TrackUnfolded` |  | `true` | = | RemoteableBool | view state, Live’s own |
| `/MidiTrack/DevicesListWrapper` |  |  | = | PythonListWrapper | state |
| `/MidiTrack/ClipSlotsListWrapper` |  |  | = | PythonListWrapper | state |
| `/MidiTrack/ViewData` |  | `{}` | = | RemoteableViewData | view state, Live’s own |
| `/MidiTrack/TakeLanes` | TakeLanes, AreTakeLanesFolded |  | = | TakeLanes | state |
| `/MidiTrack/TakeLanes/TakeLanes` |  |  | = | RemoteableList | state |
| `/MidiTrack/TakeLanes/AreTakeLanesFolded` |  | `true` | = | RemoteableBool | view state, Live’s own |
| `/MidiTrack/LinkedTrackGroupId` |  | `-1` | = | RemoteableInt | state |
| `/MidiTrack/SavedPlayingSlot` |  | `-1` | = | Int | state |
| `/MidiTrack/SavedPlayingOffset` |  | `0` | = | Double | state |
| `/MidiTrack/Freeze` |  | `false` | = | RemoteableBool | state |
| `/MidiTrack/VelocityDetail` |  | `0` | = | RemoteableEnum | state |
| `/MidiTrack/NeedArrangerRefreeze` |  | `true` | = | RemoteableBool | state |
| `/MidiTrack/PostProcessFreezeClips` |  | `0` | = | RemoteableInt | state |
| `/MidiTrack/DeviceChain` | AutomationLanes, ClipEnvelopeChooserViewState, AudioInputRouting, MidiInputRouting, AudioOutputRouting, MidiOutputRouting, Mixer, MainSequencer, FreezeSequencer, DeviceChain |  | = | MidiTrackDeviceChain | state |
| `/MidiTrack/DeviceChain/AutomationLanes` | AutomationLanes, AreAdditionalAutomationLanesFolded |  | = | AutomationLanes | view state, Live’s own |
| `/MidiTrack/DeviceChain/AutomationLanes/AutomationLanes` | AutomationLane |  | = | RemoteableList | view state, Live’s own |
| `/MidiTrack/DeviceChain/AutomationLanes/AutomationLanes/AutomationLane` | SelectedDevice, SelectedEnvelope, IsContentSelectedInDocument, LaneHeight |  | = | AutomationLane | view state, Live’s own |
| `/MidiTrack/DeviceChain/AutomationLanes/AutomationLanes/AutomationLane/SelectedDevice` |  | `1` | `0` | RemoteableEnum | view state, Live’s own |
| `/MidiTrack/DeviceChain/AutomationLanes/AutomationLanes/AutomationLane/SelectedEnvelope` |  | `0` | = | RemoteableEnum | view state, Live’s own |
| `/MidiTrack/DeviceChain/AutomationLanes/AutomationLanes/AutomationLane/IsContentSelectedInDocument` |  | `false` | = | RemoteableBool | view state, Live’s own |
| `/MidiTrack/DeviceChain/AutomationLanes/AutomationLanes/AutomationLane/LaneHeight` |  | `68` | = | RemoteableInt | view state, Live’s own |
| `/MidiTrack/DeviceChain/AutomationLanes/AreAdditionalAutomationLanesFolded` |  | `false` | = | RemoteableBool | view state, Live’s own |
| `/MidiTrack/DeviceChain/ClipEnvelopeChooserViewState` | SelectedDevice, SelectedEnvelope, PreferModulationVisible |  | = | ClipEnvelopeChooserViewState | view state, Live’s own |
| `/MidiTrack/DeviceChain/ClipEnvelopeChooserViewState/SelectedDevice` |  | `0` | = | RemoteableEnum | view state, Live’s own |
| `/MidiTrack/DeviceChain/ClipEnvelopeChooserViewState/SelectedEnvelope` |  | `0` | = | RemoteableEnum | view state, Live’s own |
| `/MidiTrack/DeviceChain/ClipEnvelopeChooserViewState/PreferModulationVisible` |  | `false` | = | RemoteableBool | view state, Live’s own |
| `/MidiTrack/DeviceChain/AudioInputRouting` | Target, UpperDisplayString, LowerDisplayString, MpeSettings |  | = | Routable | state |
| `/MidiTrack/DeviceChain/AudioInputRouting/Target` |  | `AudioIn/External/S0` | = | RemoteableString | state |
| `/MidiTrack/DeviceChain/AudioInputRouting/UpperDisplayString` |  | `Ext. In` | = | RemoteableString | state |
| `/MidiTrack/DeviceChain/AudioInputRouting/LowerDisplayString` |  | `1/2` | = | RemoteableString | state |
| `/MidiTrack/DeviceChain/AudioInputRouting/MpeSettings` | ZoneType, FirstNoteChannel, LastNoteChannel |  | = | MpeSettings | state |
| `/MidiTrack/DeviceChain/AudioInputRouting/MpeSettings/ZoneType` |  | `0` | = | RemoteableInt | state |
| `/MidiTrack/DeviceChain/AudioInputRouting/MpeSettings/FirstNoteChannel` |  | `1` | = | RemoteableInt | state |
| `/MidiTrack/DeviceChain/AudioInputRouting/MpeSettings/LastNoteChannel` |  | `15` | = | RemoteableInt | state |
| `/MidiTrack/DeviceChain/MidiInputRouting` | Target, UpperDisplayString, LowerDisplayString, MpeSettings |  | = | Routable | state |
| `/MidiTrack/DeviceChain/MidiInputRouting/Target` |  | `MidiIn/External.All/-1` | = | RemoteableString | state |
| `/MidiTrack/DeviceChain/MidiInputRouting/UpperDisplayString` |  | `Ext: All Ins` | `All Ins` | RemoteableString | state |
| `/MidiTrack/DeviceChain/MidiInputRouting/LowerDisplayString` |  | `""` | `All Channels` | RemoteableString | state |
| `/MidiTrack/DeviceChain/MidiInputRouting/MpeSettings` | ZoneType, FirstNoteChannel, LastNoteChannel |  | = | MpeSettings | state |
| `/MidiTrack/DeviceChain/MidiInputRouting/MpeSettings/ZoneType` |  | `0` | = | RemoteableInt | state |
| `/MidiTrack/DeviceChain/MidiInputRouting/MpeSettings/FirstNoteChannel` |  | `1` | = | RemoteableInt | state |
| `/MidiTrack/DeviceChain/MidiInputRouting/MpeSettings/LastNoteChannel` |  | `15` | = | RemoteableInt | state |
| `/MidiTrack/DeviceChain/AudioOutputRouting` | Target, UpperDisplayString, LowerDisplayString, MpeSettings |  | = | Routable | state |
| `/MidiTrack/DeviceChain/AudioOutputRouting/Target` |  | `AudioOut/Main` | = | RemoteableString | state |
| `/MidiTrack/DeviceChain/AudioOutputRouting/UpperDisplayString` |  | `Master` | `Main` | RemoteableString | state |
| `/MidiTrack/DeviceChain/AudioOutputRouting/LowerDisplayString` |  | `""` | = | RemoteableString | state |
| `/MidiTrack/DeviceChain/AudioOutputRouting/MpeSettings` | ZoneType, FirstNoteChannel, LastNoteChannel |  | = | MpeSettings | state |
| `/MidiTrack/DeviceChain/AudioOutputRouting/MpeSettings/ZoneType` |  | `0` | = | RemoteableInt | state |
| `/MidiTrack/DeviceChain/AudioOutputRouting/MpeSettings/FirstNoteChannel` |  | `1` | = | RemoteableInt | state |
| `/MidiTrack/DeviceChain/AudioOutputRouting/MpeSettings/LastNoteChannel` |  | `15` | = | RemoteableInt | state |
| `/MidiTrack/DeviceChain/MidiOutputRouting` | Target, UpperDisplayString, LowerDisplayString, MpeSettings |  | = | Routable | state |
| `/MidiTrack/DeviceChain/MidiOutputRouting/Target` |  | `MidiOut/None` | = | RemoteableString | state |
| `/MidiTrack/DeviceChain/MidiOutputRouting/UpperDisplayString` |  | `None` | = | RemoteableString | state |
| `/MidiTrack/DeviceChain/MidiOutputRouting/LowerDisplayString` |  | `""` | = | RemoteableString | state |
| `/MidiTrack/DeviceChain/MidiOutputRouting/MpeSettings` | ZoneType, FirstNoteChannel, LastNoteChannel |  | = | MpeSettings | state |
| `/MidiTrack/DeviceChain/MidiOutputRouting/MpeSettings/ZoneType` |  | `0` | = | RemoteableInt | state |
| `/MidiTrack/DeviceChain/MidiOutputRouting/MpeSettings/FirstNoteChannel` |  | `1` | = | RemoteableInt | state |
| `/MidiTrack/DeviceChain/MidiOutputRouting/MpeSettings/LastNoteChannel` |  | `15` | = | RemoteableInt | state |
| `/MidiTrack/DeviceChain/Mixer` | LomId, LomIdView, IsExpanded, On, ModulationSourceCount, ParametersListWrapper, Pointee, LastSelectedTimeableIndex, LastSelectedClipEnvelopeIndex, LastPresetRef, LockedScripts, IsFolded, ShouldShowPresetName, UserName, Annotation, SourceContext, Sends, Speaker, SoloSink, PanMode, Pan, SplitStereoPanL, SplitStereoPanR, Volume, ViewStateSesstionTrackWidth, CrossFadeState, SendsListWrapper |  | = | TrackDevice | state |
| `/MidiTrack/DeviceChain/Mixer/LomId` |  | `0` | = | Int | state |
| `/MidiTrack/DeviceChain/Mixer/LomIdView` |  | `0` | = | Int | state |
| `/MidiTrack/DeviceChain/Mixer/IsExpanded` |  | `true` | = | RemoteableBool | view state, Live’s own |
| `/MidiTrack/DeviceChain/Mixer/On` | LomId, Manual, AutomationTarget, MidiCCOnOffThresholds |  | = | TimeableBool | state |
| `/MidiTrack/DeviceChain/Mixer/On/LomId` |  | `0` | = | Int | state |
| `/MidiTrack/DeviceChain/Mixer/On/Manual` |  | `true` | = | RemoteableBool | state |
| `/MidiTrack/DeviceChain/Mixer/On/AutomationTarget` | LockEnvelope |  | = | BoolAutomationTarget | state |
| `/MidiTrack/DeviceChain/Mixer/On/AutomationTarget/LockEnvelope` |  | `0` | = | RemoteableEnum | state |
| `/MidiTrack/DeviceChain/Mixer/On/MidiCCOnOffThresholds` | Min, Max |  | = | MidiControllerRange | state |
| `/MidiTrack/DeviceChain/Mixer/On/MidiCCOnOffThresholds/Min` |  | `64` | = | UserFloat | state |
| `/MidiTrack/DeviceChain/Mixer/On/MidiCCOnOffThresholds/Max` |  | `127` | = | UserFloat | state |
| `/MidiTrack/DeviceChain/Mixer/ModulationSourceCount` |  | `0` | = | RemoteableInt | state |
| `/MidiTrack/DeviceChain/Mixer/ParametersListWrapper` |  |  | = | PythonListWrapper | state |
| `/MidiTrack/DeviceChain/Mixer/Pointee` |  |  | = | Pointee | state |
| `/MidiTrack/DeviceChain/Mixer/LastSelectedTimeableIndex` |  | `0` | = | Int | view state, Live’s own |
| `/MidiTrack/DeviceChain/Mixer/LastSelectedClipEnvelopeIndex` |  | `0` | = | Int | view state, Live’s own |
| `/MidiTrack/DeviceChain/Mixer/LastPresetRef` | Value |  | = | RemoteableSlot | state |
| `/MidiTrack/DeviceChain/Mixer/LastPresetRef/Value` |  |  | = | Slot<Compound> | state |
| `/MidiTrack/DeviceChain/Mixer/LockedScripts` |  |  | = | RemoteableList | state |
| `/MidiTrack/DeviceChain/Mixer/IsFolded` |  | `false` | = | RemoteableBool | view state, Live’s own |
| `/MidiTrack/DeviceChain/Mixer/ShouldShowPresetName` |  | `false` | = | RemoteableBool | view state, Live’s own |
| `/MidiTrack/DeviceChain/Mixer/UserName` |  | `""` | = | RemoteableString | state |
| `/MidiTrack/DeviceChain/Mixer/Annotation` |  | `""` | = | RemoteableString | state |
| `/MidiTrack/DeviceChain/Mixer/SourceContext` | Value |  | = | RemoteableSlot | state |
| `/MidiTrack/DeviceChain/Mixer/SourceContext/Value` |  |  | = | Slot<Compound> | state |
| `/MidiTrack/DeviceChain/Mixer/Sends` | TrackSendHolder |  | = | RemoteableList | state |
| `/MidiTrack/DeviceChain/Mixer/Sends/TrackSendHolder` | Send, EnabledByUser |  | = | TrackSendHolder | state |
| `/MidiTrack/DeviceChain/Mixer/Sends/TrackSendHolder/Send` | LomId, Manual, MidiControllerRange, AutomationTarget, ModulationTarget |  | = | TimeableFloat | state |
| `/MidiTrack/DeviceChain/Mixer/Sends/TrackSendHolder/Send/LomId` |  | `0` | = | Int | state |
| `/MidiTrack/DeviceChain/Mixer/Sends/TrackSendHolder/Send/Manual` |  | `0.0003162277571` | = | RemoteableFloat | state |
| `/MidiTrack/DeviceChain/Mixer/Sends/TrackSendHolder/Send/MidiControllerRange` | Min, Max |  | = | MidiControllerRange | state |
| `/MidiTrack/DeviceChain/Mixer/Sends/TrackSendHolder/Send/MidiControllerRange/Min` |  | `0.0003162277571` | = | UserFloat | state |
| `/MidiTrack/DeviceChain/Mixer/Sends/TrackSendHolder/Send/MidiControllerRange/Max` |  | `1` | = | UserFloat | state |
| `/MidiTrack/DeviceChain/Mixer/Sends/TrackSendHolder/Send/AutomationTarget` | LockEnvelope |  | = | FloatAutomationTarget | state |
| `/MidiTrack/DeviceChain/Mixer/Sends/TrackSendHolder/Send/AutomationTarget/LockEnvelope` |  | `0` | = | RemoteableEnum | state |
| `/MidiTrack/DeviceChain/Mixer/Sends/TrackSendHolder/Send/ModulationTarget` | LockEnvelope |  | = | TimeableModulationTarget | state |
| `/MidiTrack/DeviceChain/Mixer/Sends/TrackSendHolder/Send/ModulationTarget/LockEnvelope` |  | `0` | = | RemoteableEnum | state |
| `/MidiTrack/DeviceChain/Mixer/Sends/TrackSendHolder/EnabledByUser` |  | `true` | = | RemoteableBool | state |
| `/MidiTrack/DeviceChain/Mixer/Speaker` | LomId, Manual, AutomationTarget, MidiCCOnOffThresholds |  | = | TimeableBool | state |
| `/MidiTrack/DeviceChain/Mixer/Speaker/LomId` |  | `0` | = | Int | state |
| `/MidiTrack/DeviceChain/Mixer/Speaker/Manual` |  | `true` | = | RemoteableBool | state |
| `/MidiTrack/DeviceChain/Mixer/Speaker/AutomationTarget` | LockEnvelope |  | = | BoolAutomationTarget | state |
| `/MidiTrack/DeviceChain/Mixer/Speaker/AutomationTarget/LockEnvelope` |  | `0` | = | RemoteableEnum | state |
| `/MidiTrack/DeviceChain/Mixer/Speaker/MidiCCOnOffThresholds` | Min, Max |  | = | MidiControllerRange | state |
| `/MidiTrack/DeviceChain/Mixer/Speaker/MidiCCOnOffThresholds/Min` |  | `64` | = | UserFloat | state |
| `/MidiTrack/DeviceChain/Mixer/Speaker/MidiCCOnOffThresholds/Max` |  | `127` | = | UserFloat | state |
| `/MidiTrack/DeviceChain/Mixer/SoloSink` |  | `false` | = | RemoteableBool | state |
| `/MidiTrack/DeviceChain/Mixer/PanMode` |  | `0` | = | RemoteableEnum | state |
| `/MidiTrack/DeviceChain/Mixer/Pan` | LomId, Manual, MidiControllerRange, AutomationTarget, ModulationTarget |  | = | TimeableFloat | state |
| `/MidiTrack/DeviceChain/Mixer/Pan/LomId` |  | `0` | = | Int | state |
| `/MidiTrack/DeviceChain/Mixer/Pan/Manual` |  | `0` | = | RemoteableFloat | state |
| `/MidiTrack/DeviceChain/Mixer/Pan/MidiControllerRange` | Min, Max |  | = | MidiControllerRange | state |
| `/MidiTrack/DeviceChain/Mixer/Pan/MidiControllerRange/Min` |  | `-1` | = | UserFloat | state |
| `/MidiTrack/DeviceChain/Mixer/Pan/MidiControllerRange/Max` |  | `1` | = | UserFloat | state |
| `/MidiTrack/DeviceChain/Mixer/Pan/AutomationTarget` | LockEnvelope |  | = | FloatAutomationTarget | state |
| `/MidiTrack/DeviceChain/Mixer/Pan/AutomationTarget/LockEnvelope` |  | `0` | = | RemoteableEnum | state |
| `/MidiTrack/DeviceChain/Mixer/Pan/ModulationTarget` | LockEnvelope |  | = | TimeableModulationTarget | state |
| `/MidiTrack/DeviceChain/Mixer/Pan/ModulationTarget/LockEnvelope` |  | `0` | = | RemoteableEnum | state |
| `/MidiTrack/DeviceChain/Mixer/SplitStereoPanL` | LomId, Manual, MidiControllerRange, AutomationTarget, ModulationTarget |  | = | TimeableFloat | state |
| `/MidiTrack/DeviceChain/Mixer/SplitStereoPanL/LomId` |  | `0` | = | Int | state |
| `/MidiTrack/DeviceChain/Mixer/SplitStereoPanL/Manual` |  | `-1` | = | RemoteableFloat | state |
| `/MidiTrack/DeviceChain/Mixer/SplitStereoPanL/MidiControllerRange` | Min, Max |  | = | MidiControllerRange | state |
| `/MidiTrack/DeviceChain/Mixer/SplitStereoPanL/MidiControllerRange/Min` |  | `-1` | = | UserFloat | state |
| `/MidiTrack/DeviceChain/Mixer/SplitStereoPanL/MidiControllerRange/Max` |  | `1` | = | UserFloat | state |
| `/MidiTrack/DeviceChain/Mixer/SplitStereoPanL/AutomationTarget` | LockEnvelope |  | = | FloatAutomationTarget | state |
| `/MidiTrack/DeviceChain/Mixer/SplitStereoPanL/AutomationTarget/LockEnvelope` |  | `0` | = | RemoteableEnum | state |
| `/MidiTrack/DeviceChain/Mixer/SplitStereoPanL/ModulationTarget` | LockEnvelope |  | = | TimeableModulationTarget | state |
| `/MidiTrack/DeviceChain/Mixer/SplitStereoPanL/ModulationTarget/LockEnvelope` |  | `0` | = | RemoteableEnum | state |
| `/MidiTrack/DeviceChain/Mixer/SplitStereoPanR` | LomId, Manual, MidiControllerRange, AutomationTarget, ModulationTarget |  | = | TimeableFloat | state |
| `/MidiTrack/DeviceChain/Mixer/SplitStereoPanR/LomId` |  | `0` | = | Int | state |
| `/MidiTrack/DeviceChain/Mixer/SplitStereoPanR/Manual` |  | `1` | = | RemoteableFloat | state |
| `/MidiTrack/DeviceChain/Mixer/SplitStereoPanR/MidiControllerRange` | Min, Max |  | = | MidiControllerRange | state |
| `/MidiTrack/DeviceChain/Mixer/SplitStereoPanR/MidiControllerRange/Min` |  | `-1` | = | UserFloat | state |
| `/MidiTrack/DeviceChain/Mixer/SplitStereoPanR/MidiControllerRange/Max` |  | `1` | = | UserFloat | state |
| `/MidiTrack/DeviceChain/Mixer/SplitStereoPanR/AutomationTarget` | LockEnvelope |  | = | FloatAutomationTarget | state |
| `/MidiTrack/DeviceChain/Mixer/SplitStereoPanR/AutomationTarget/LockEnvelope` |  | `0` | = | RemoteableEnum | state |
| `/MidiTrack/DeviceChain/Mixer/SplitStereoPanR/ModulationTarget` | LockEnvelope |  | = | TimeableModulationTarget | state |
| `/MidiTrack/DeviceChain/Mixer/SplitStereoPanR/ModulationTarget/LockEnvelope` |  | `0` | = | RemoteableEnum | state |
| `/MidiTrack/DeviceChain/Mixer/Volume` | LomId, Manual, MidiControllerRange, AutomationTarget, ModulationTarget |  | = | TimeableFloat | state |
| `/MidiTrack/DeviceChain/Mixer/Volume/LomId` |  | `0` | = | Int | state |
| `/MidiTrack/DeviceChain/Mixer/Volume/Manual` |  | `1` | = | RemoteableFloat | state |
| `/MidiTrack/DeviceChain/Mixer/Volume/MidiControllerRange` | Min, Max |  | = | MidiControllerRange | state |
| `/MidiTrack/DeviceChain/Mixer/Volume/MidiControllerRange/Min` |  | `0.0003162277571` | = | UserFloat | state |
| `/MidiTrack/DeviceChain/Mixer/Volume/MidiControllerRange/Max` |  | `1.99526238` | = | UserFloat | state |
| `/MidiTrack/DeviceChain/Mixer/Volume/AutomationTarget` | LockEnvelope |  | = | FloatAutomationTarget | state |
| `/MidiTrack/DeviceChain/Mixer/Volume/AutomationTarget/LockEnvelope` |  | `0` | = | RemoteableEnum | state |
| `/MidiTrack/DeviceChain/Mixer/Volume/ModulationTarget` | LockEnvelope |  | = | TimeableModulationTarget | state |
| `/MidiTrack/DeviceChain/Mixer/Volume/ModulationTarget/LockEnvelope` |  | `0` | = | RemoteableEnum | state |
| `/MidiTrack/DeviceChain/Mixer/ViewStateSesstionTrackWidth` |  | `93` | = | RemoteableInt | view state, Live’s own |
| `/MidiTrack/DeviceChain/Mixer/CrossFadeState` | LomId, Manual, AutomationTarget |  | = | TimeableEnum | state |
| `/MidiTrack/DeviceChain/Mixer/CrossFadeState/LomId` |  | `0` | = | Int | state |
| `/MidiTrack/DeviceChain/Mixer/CrossFadeState/Manual` |  | `1` | = | RemoteableEnum | state |
| `/MidiTrack/DeviceChain/Mixer/CrossFadeState/AutomationTarget` | LockEnvelope |  | = | EnumAutomationTarget | state |
| `/MidiTrack/DeviceChain/Mixer/CrossFadeState/AutomationTarget/LockEnvelope` |  | `0` | = | RemoteableEnum | state |
| `/MidiTrack/DeviceChain/Mixer/SendsListWrapper` |  |  | = | PythonListWrapper | state |
| `/MidiTrack/DeviceChain/MainSequencer` | LomId, LomIdView, IsExpanded, On, ModulationSourceCount, ParametersListWrapper, Pointee, LastSelectedTimeableIndex, LastSelectedClipEnvelopeIndex, LastPresetRef, LockedScripts, IsFolded, ShouldShowPresetName, UserName, Annotation, SourceContext, ClipSlotList, MonitoringEnum, KeepRecordMonitoringLatency, ClipTimeable, Recorder, MidiControllers |  | = | MidiSequencer | state |
| `/MidiTrack/DeviceChain/MainSequencer/LomId` |  | `0` | = | Int | state |
| `/MidiTrack/DeviceChain/MainSequencer/LomIdView` |  | `0` | = | Int | state |
| `/MidiTrack/DeviceChain/MainSequencer/IsExpanded` |  | `true` | = | RemoteableBool | view state, Live’s own |
| `/MidiTrack/DeviceChain/MainSequencer/On` | LomId, Manual, AutomationTarget, MidiCCOnOffThresholds |  | = | TimeableBool | state |
| `/MidiTrack/DeviceChain/MainSequencer/On/LomId` |  | `0` | = | Int | state |
| `/MidiTrack/DeviceChain/MainSequencer/On/Manual` |  | `true` | = | RemoteableBool | state |
| `/MidiTrack/DeviceChain/MainSequencer/On/AutomationTarget` | LockEnvelope |  | = | BoolAutomationTarget | state |
| `/MidiTrack/DeviceChain/MainSequencer/On/AutomationTarget/LockEnvelope` |  | `0` | = | RemoteableEnum | state |
| `/MidiTrack/DeviceChain/MainSequencer/On/MidiCCOnOffThresholds` | Min, Max |  | = | MidiControllerRange | state |
| `/MidiTrack/DeviceChain/MainSequencer/On/MidiCCOnOffThresholds/Min` |  | `64` | = | UserFloat | state |
| `/MidiTrack/DeviceChain/MainSequencer/On/MidiCCOnOffThresholds/Max` |  | `127` | = | UserFloat | state |
| `/MidiTrack/DeviceChain/MainSequencer/ModulationSourceCount` |  | `0` | = | RemoteableInt | state |
| `/MidiTrack/DeviceChain/MainSequencer/ParametersListWrapper` |  |  | = | PythonListWrapper | state |
| `/MidiTrack/DeviceChain/MainSequencer/Pointee` |  |  | = | Pointee | state |
| `/MidiTrack/DeviceChain/MainSequencer/LastSelectedTimeableIndex` |  | `0` | = | Int | view state, Live’s own |
| `/MidiTrack/DeviceChain/MainSequencer/LastSelectedClipEnvelopeIndex` |  | `0` | = | Int | view state, Live’s own |
| `/MidiTrack/DeviceChain/MainSequencer/LastPresetRef` | Value |  | = | RemoteableSlot | state |
| `/MidiTrack/DeviceChain/MainSequencer/LastPresetRef/Value` |  |  | = | Slot<Compound> | state |
| `/MidiTrack/DeviceChain/MainSequencer/LockedScripts` |  |  | = | RemoteableList | state |
| `/MidiTrack/DeviceChain/MainSequencer/IsFolded` |  | `false` | = | RemoteableBool | view state, Live’s own |
| `/MidiTrack/DeviceChain/MainSequencer/ShouldShowPresetName` |  | `false` | = | RemoteableBool | view state, Live’s own |
| `/MidiTrack/DeviceChain/MainSequencer/UserName` |  | `""` | = | RemoteableString | state |
| `/MidiTrack/DeviceChain/MainSequencer/Annotation` |  | `""` | = | RemoteableString | state |
| `/MidiTrack/DeviceChain/MainSequencer/SourceContext` | Value |  | = | RemoteableSlot | state |
| `/MidiTrack/DeviceChain/MainSequencer/SourceContext/Value` |  |  | = | Slot<Compound> | state |
| `/MidiTrack/DeviceChain/MainSequencer/ClipSlotList` | ClipSlot |  | = | RemoteableList | state |
| `/MidiTrack/DeviceChain/MainSequencer/ClipSlotList/ClipSlot` | LomId, ClipSlot, HasStop, NeedRefreeze |  | = | ClipSlot | state |
| `/MidiTrack/DeviceChain/MainSequencer/ClipSlotList/ClipSlot/LomId` |  | `0` | = | Int | state |
| `/MidiTrack/DeviceChain/MainSequencer/ClipSlotList/ClipSlot/ClipSlot` | Value |  | = | RemoteableSlot | state |
| `/MidiTrack/DeviceChain/MainSequencer/ClipSlotList/ClipSlot/ClipSlot/Value` |  |  | = | Slot<Compound> | state |
| `/MidiTrack/DeviceChain/MainSequencer/ClipSlotList/ClipSlot/HasStop` |  | `true` | = | RemoteableBool | state |
| `/MidiTrack/DeviceChain/MainSequencer/ClipSlotList/ClipSlot/NeedRefreeze` |  | `true` | = | RemoteableBool | state |
| `/MidiTrack/DeviceChain/MainSequencer/MonitoringEnum` |  | `1` | = | RemoteableEnum | state |
| `/MidiTrack/DeviceChain/MainSequencer/KeepRecordMonitoringLatency` |  | `true` | = | RemoteableBool | state |
| `/MidiTrack/DeviceChain/MainSequencer/ClipTimeable` | ArrangerAutomation |  | = | TimeableMidiClip | state |
| `/MidiTrack/DeviceChain/MainSequencer/ClipTimeable/ArrangerAutomation` | Events, AutomationTransformViewState |  | = | ListAutomation | state |
| `/MidiTrack/DeviceChain/MainSequencer/ClipTimeable/ArrangerAutomation/Events` |  |  | = | RemoteableList | state |
| `/MidiTrack/DeviceChain/MainSequencer/ClipTimeable/ArrangerAutomation/AutomationTransformViewState` | IsTransformPending, TimeAndValueTransforms |  | = | AutomationTransformViewState | view state, Live’s own |
| `/MidiTrack/DeviceChain/MainSequencer/ClipTimeable/ArrangerAutomation/AutomationTransformViewState/IsTransformPending` |  | `false` | = | RemoteableBool | view state, Live’s own |
| `/MidiTrack/DeviceChain/MainSequencer/ClipTimeable/ArrangerAutomation/AutomationTransformViewState/TimeAndValueTransforms` |  |  | = | RemoteableList | view state, Live’s own |
| `/MidiTrack/DeviceChain/MainSequencer/Recorder` | IsArmed, TakeCounter |  | = | MidiRecorder | state |
| `/MidiTrack/DeviceChain/MainSequencer/Recorder/IsArmed` |  | `false` | = | RemoteableBool | state |
| `/MidiTrack/DeviceChain/MainSequencer/Recorder/TakeCounter` |  | `0` | = | Int | state |
| `/MidiTrack/DeviceChain/MainSequencer/MidiControllers` | ControllerTargets.N |  | = | MidiControllers | state |
| `/MidiTrack/DeviceChain/MainSequencer/MidiControllers/ControllerTargets.N` | LockEnvelope |  | = | UserFloatModulationTarget | state |
| `/MidiTrack/DeviceChain/MainSequencer/MidiControllers/ControllerTargets.N/LockEnvelope` |  | `0` · `1` | `0` | RemoteableEnum | state |
| `/MidiTrack/DeviceChain/FreezeSequencer` | LomId, LomIdView, IsExpanded, On, ModulationSourceCount, ParametersListWrapper, Pointee, LastSelectedTimeableIndex, LastSelectedClipEnvelopeIndex, LastPresetRef, LockedScripts, IsFolded, ShouldShowPresetName, UserName, Annotation, SourceContext, ClipSlotList, MonitoringEnum, KeepRecordMonitoringLatency, Sample, VolumeModulationTarget, TranspositionModulationTarget, TransientEnvelopeModulationTarget, GrainSizeModulationTarget, FluxModulationTarget, SampleOffsetModulationTarget, ComplexProFormantsModulationTarget, ComplexProEnvelopeModulationTarget, PitchViewScrollPosition, SampleOffsetModulationScrollPosition, Recorder |  | = | AudioSequencer | state |
| `/MidiTrack/DeviceChain/FreezeSequencer/LomId` |  | `0` | = | Int | state |
| `/MidiTrack/DeviceChain/FreezeSequencer/LomIdView` |  | `0` | = | Int | state |
| `/MidiTrack/DeviceChain/FreezeSequencer/IsExpanded` |  | `true` | = | RemoteableBool | view state, Live’s own |
| `/MidiTrack/DeviceChain/FreezeSequencer/On` | LomId, Manual, AutomationTarget, MidiCCOnOffThresholds |  | = | TimeableBool | state |
| `/MidiTrack/DeviceChain/FreezeSequencer/On/LomId` |  | `0` | = | Int | state |
| `/MidiTrack/DeviceChain/FreezeSequencer/On/Manual` |  | `true` | = | RemoteableBool | state |
| `/MidiTrack/DeviceChain/FreezeSequencer/On/AutomationTarget` | LockEnvelope |  | = | BoolAutomationTarget | state |
| `/MidiTrack/DeviceChain/FreezeSequencer/On/AutomationTarget/LockEnvelope` |  | `0` | = | RemoteableEnum | state |
| `/MidiTrack/DeviceChain/FreezeSequencer/On/MidiCCOnOffThresholds` | Min, Max |  | = | MidiControllerRange | state |
| `/MidiTrack/DeviceChain/FreezeSequencer/On/MidiCCOnOffThresholds/Min` |  | `64` | = | UserFloat | state |
| `/MidiTrack/DeviceChain/FreezeSequencer/On/MidiCCOnOffThresholds/Max` |  | `127` | = | UserFloat | state |
| `/MidiTrack/DeviceChain/FreezeSequencer/ModulationSourceCount` |  | `0` | = | RemoteableInt | state |
| `/MidiTrack/DeviceChain/FreezeSequencer/ParametersListWrapper` |  |  | = | PythonListWrapper | state |
| `/MidiTrack/DeviceChain/FreezeSequencer/Pointee` |  |  | = | Pointee | state |
| `/MidiTrack/DeviceChain/FreezeSequencer/LastSelectedTimeableIndex` |  | `0` | = | Int | view state, Live’s own |
| `/MidiTrack/DeviceChain/FreezeSequencer/LastSelectedClipEnvelopeIndex` |  | `0` | = | Int | view state, Live’s own |
| `/MidiTrack/DeviceChain/FreezeSequencer/LastPresetRef` | Value |  | = | RemoteableSlot | state |
| `/MidiTrack/DeviceChain/FreezeSequencer/LastPresetRef/Value` |  |  | = | Slot<Compound> | state |
| `/MidiTrack/DeviceChain/FreezeSequencer/LockedScripts` |  |  | = | RemoteableList | state |
| `/MidiTrack/DeviceChain/FreezeSequencer/IsFolded` |  | `false` | = | RemoteableBool | view state, Live’s own |
| `/MidiTrack/DeviceChain/FreezeSequencer/ShouldShowPresetName` |  | `false` | = | RemoteableBool | view state, Live’s own |
| `/MidiTrack/DeviceChain/FreezeSequencer/UserName` |  | `""` | = | RemoteableString | state |
| `/MidiTrack/DeviceChain/FreezeSequencer/Annotation` |  | `""` | = | RemoteableString | state |
| `/MidiTrack/DeviceChain/FreezeSequencer/SourceContext` | Value |  | = | RemoteableSlot | state |
| `/MidiTrack/DeviceChain/FreezeSequencer/SourceContext/Value` |  |  | = | Slot<Compound> | state |
| `/MidiTrack/DeviceChain/FreezeSequencer/ClipSlotList` | ClipSlot |  | = | RemoteableList | state |
| `/MidiTrack/DeviceChain/FreezeSequencer/ClipSlotList/ClipSlot` | LomId, ClipSlot, HasStop, NeedRefreeze |  | = | ClipSlot | state |
| `/MidiTrack/DeviceChain/FreezeSequencer/ClipSlotList/ClipSlot/LomId` |  | `0` | = | Int | state |
| `/MidiTrack/DeviceChain/FreezeSequencer/ClipSlotList/ClipSlot/ClipSlot` | Value |  | = | RemoteableSlot | state |
| `/MidiTrack/DeviceChain/FreezeSequencer/ClipSlotList/ClipSlot/ClipSlot/Value` |  |  | = | Slot<Compound> | state |
| `/MidiTrack/DeviceChain/FreezeSequencer/ClipSlotList/ClipSlot/HasStop` |  | `true` | = | RemoteableBool | state |
| `/MidiTrack/DeviceChain/FreezeSequencer/ClipSlotList/ClipSlot/NeedRefreeze` |  | `true` | = | RemoteableBool | state |
| `/MidiTrack/DeviceChain/FreezeSequencer/MonitoringEnum` |  | `1` | = | RemoteableEnum | state |
| `/MidiTrack/DeviceChain/FreezeSequencer/KeepRecordMonitoringLatency` |  | `true` | = | RemoteableBool | state |
| `/MidiTrack/DeviceChain/FreezeSequencer/Sample` | ArrangerAutomation |  | = | TimeableSample | state |
| `/MidiTrack/DeviceChain/FreezeSequencer/Sample/ArrangerAutomation` | Events, AutomationTransformViewState |  | = | ListAutomation | state |
| `/MidiTrack/DeviceChain/FreezeSequencer/Sample/ArrangerAutomation/Events` |  |  | = | RemoteableList | state |
| `/MidiTrack/DeviceChain/FreezeSequencer/Sample/ArrangerAutomation/AutomationTransformViewState` | IsTransformPending, TimeAndValueTransforms |  | = | AutomationTransformViewState | view state, Live’s own |
| `/MidiTrack/DeviceChain/FreezeSequencer/Sample/ArrangerAutomation/AutomationTransformViewState/IsTransformPending` |  | `false` | = | RemoteableBool | view state, Live’s own |
| `/MidiTrack/DeviceChain/FreezeSequencer/Sample/ArrangerAutomation/AutomationTransformViewState/TimeAndValueTransforms` |  |  | = | RemoteableList | view state, Live’s own |
| `/MidiTrack/DeviceChain/FreezeSequencer/VolumeModulationTarget` | LockEnvelope |  | = | UserFloatModulationTarget | state |
| `/MidiTrack/DeviceChain/FreezeSequencer/VolumeModulationTarget/LockEnvelope` |  | `0` | = | RemoteableEnum | state |
| `/MidiTrack/DeviceChain/FreezeSequencer/TranspositionModulationTarget` | LockEnvelope |  | = | UserFloatModulationTarget | state |
| `/MidiTrack/DeviceChain/FreezeSequencer/TranspositionModulationTarget/LockEnvelope` |  | `0` | = | RemoteableEnum | state |
| `/MidiTrack/DeviceChain/FreezeSequencer/TransientEnvelopeModulationTarget` | LockEnvelope |  | = | UserFloatModulationTarget | state |
| `/MidiTrack/DeviceChain/FreezeSequencer/TransientEnvelopeModulationTarget/LockEnvelope` |  | `0` | = | RemoteableEnum | state |
| `/MidiTrack/DeviceChain/FreezeSequencer/GrainSizeModulationTarget` | LockEnvelope |  | = | UserFloatModulationTarget | state |
| `/MidiTrack/DeviceChain/FreezeSequencer/GrainSizeModulationTarget/LockEnvelope` |  | `0` | = | RemoteableEnum | state |
| `/MidiTrack/DeviceChain/FreezeSequencer/FluxModulationTarget` | LockEnvelope |  | = | UserFloatModulationTarget | state |
| `/MidiTrack/DeviceChain/FreezeSequencer/FluxModulationTarget/LockEnvelope` |  | `0` | = | RemoteableEnum | state |
| `/MidiTrack/DeviceChain/FreezeSequencer/SampleOffsetModulationTarget` | LockEnvelope |  | = | UserFloatModulationTarget | state |
| `/MidiTrack/DeviceChain/FreezeSequencer/SampleOffsetModulationTarget/LockEnvelope` |  | `0` | = | RemoteableEnum | state |
| `/MidiTrack/DeviceChain/FreezeSequencer/ComplexProFormantsModulationTarget` | LockEnvelope |  | = | UserFloatModulationTarget | state |
| `/MidiTrack/DeviceChain/FreezeSequencer/ComplexProFormantsModulationTarget/LockEnvelope` |  | `0` | = | RemoteableEnum | state |
| `/MidiTrack/DeviceChain/FreezeSequencer/ComplexProEnvelopeModulationTarget` | LockEnvelope |  | = | UserFloatModulationTarget | state |
| `/MidiTrack/DeviceChain/FreezeSequencer/ComplexProEnvelopeModulationTarget/LockEnvelope` |  | `0` | = | RemoteableEnum | state |
| `/MidiTrack/DeviceChain/FreezeSequencer/PitchViewScrollPosition` |  | `-1073741824` | = | RemoteableInt | state |
| `/MidiTrack/DeviceChain/FreezeSequencer/SampleOffsetModulationScrollPosition` |  | `-1073741824` | = | RemoteableInt | view state, Live’s own |
| `/MidiTrack/DeviceChain/FreezeSequencer/Recorder` | IsArmed, TakeCounter |  | = | AudioRecorder | state |
| `/MidiTrack/DeviceChain/FreezeSequencer/Recorder/IsArmed` |  | `false` | = | RemoteableBool | state |
| `/MidiTrack/DeviceChain/FreezeSequencer/Recorder/TakeCounter` |  | `1` | `0` | Int | state |
| `/MidiTrack/DeviceChain/DeviceChain` | Devices, SignalModulations |  | = | MidiToAudioDeviceChain | state |
| `/MidiTrack/DeviceChain/DeviceChain/Devices` |  |  | = | RemoteableList | state |
| `/MidiTrack/DeviceChain/DeviceChain/SignalModulations` |  |  | = | RemoteableList | state |
| `/MidiTrack/ReWireDeviceMidiTargetId` |  | `0` | = | Int | state |
| `/MidiTrack/PitchbendRange` |  | `96` | = | RemoteableInt | state |
| `/MidiTrack/IsTuned` |  | `true` | = | RemoteableBool | state |
| `/MidiTrack/ControllerLayoutRemoteable` |  | `0` | = | RemoteableEnum | state |
| `/MidiTrack/ControllerLayoutCustomization` | PitchClassSource, OctaveSource, KeyNoteTarget, StepSize, OctaveEvery, AllowedKeys, FillerKeysMapTo |  | = | ControllerLayoutCustomization | state |
| `/MidiTrack/ControllerLayoutCustomization/PitchClassSource` |  | `0` | = | RangedRemoteableInt | state |
| `/MidiTrack/ControllerLayoutCustomization/OctaveSource` |  | `2` | = | RangedRemoteableInt | state |
| `/MidiTrack/ControllerLayoutCustomization/KeyNoteTarget` |  | `60` | = | RangedRemoteableInt | state |
| `/MidiTrack/ControllerLayoutCustomization/StepSize` |  | `1` | = | RangedRemoteableInt | state |
| `/MidiTrack/ControllerLayoutCustomization/OctaveEvery` |  | `12` | = | RangedRemoteableInt | state |
| `/MidiTrack/ControllerLayoutCustomization/AllowedKeys` |  | `0` | = | RemoteableEnum | state |
| `/MidiTrack/ControllerLayoutCustomization/FillerKeysMapTo` |  | `0` | = | RemoteableEnum | state |

### ReturnTrack

| Element | Children, in Live's order | Live wrote | The blank set writes | Schema class | Standing |
| --- | --- | --- | --- | --- | --- |
| `/ReturnTrack` | LomId, LomIdView, IsContentSelectedInDocument, PreferredContentViewMode, TrackDelay, Name, Color, AutomationEnvelopes, TrackGroupId, TrackUnfolded, DevicesListWrapper, ClipSlotsListWrapper, ViewData, TakeLanes, LinkedTrackGroupId, DeviceChain |  | = | ReturnTrack | state |
| `/ReturnTrack/LomId` |  | `0` | = | Int | state |
| `/ReturnTrack/LomIdView` |  | `0` | = | Int | state |
| `/ReturnTrack/IsContentSelectedInDocument` |  | `false` | = | RemoteableBool | view state, Live’s own |
| `/ReturnTrack/PreferredContentViewMode` |  | `0` | = | RemoteableInt | view state, Live’s own |
| `/ReturnTrack/TrackDelay` | Value, IsValueSampleBased |  | = | TimeInSamplesOrMs | state |
| `/ReturnTrack/TrackDelay/Value` |  | `0` | = | UserFloat | state |
| `/ReturnTrack/TrackDelay/IsValueSampleBased` |  | `false` | = | RemoteableBool | state |
| `/ReturnTrack/Name` | EffectiveName, UserName, Annotation, MemorizedFirstClipName |  | = | DeviceChainContainerName | state |
| `/ReturnTrack/Name/EffectiveName` |  | `A-Reverb` | `A-Return` | RemoteableString | state |
| `/ReturnTrack/Name/UserName` |  | `""` | = | RemoteableString | state |
| `/ReturnTrack/Name/Annotation` |  | `""` | = | RemoteableString | state |
| `/ReturnTrack/Name/MemorizedFirstClipName` |  | `""` | = | RemoteableString | state |
| `/ReturnTrack/Color` |  | `22` | = | RemoteableDocumentColor | state |
| `/ReturnTrack/AutomationEnvelopes` | Envelopes |  | = | AutomationEnvelopes | state |
| `/ReturnTrack/AutomationEnvelopes/Envelopes` |  |  | = | RemoteableList | state |
| `/ReturnTrack/TrackGroupId` |  | `-1` | = | RemoteableInt | state |
| `/ReturnTrack/TrackUnfolded` |  | `false` | = | RemoteableBool | view state, Live’s own |
| `/ReturnTrack/DevicesListWrapper` |  |  | = | PythonListWrapper | state |
| `/ReturnTrack/ClipSlotsListWrapper` |  |  | = | PythonListWrapper | state |
| `/ReturnTrack/ViewData` |  | `{}` | = | RemoteableViewData | view state, Live’s own |
| `/ReturnTrack/TakeLanes` | TakeLanes, AreTakeLanesFolded |  | = | TakeLanes | state |
| `/ReturnTrack/TakeLanes/TakeLanes` |  |  | = | RemoteableList | state |
| `/ReturnTrack/TakeLanes/AreTakeLanesFolded` |  | `true` | = | RemoteableBool | view state, Live’s own |
| `/ReturnTrack/LinkedTrackGroupId` |  | `-1` | = | RemoteableInt | state |
| `/ReturnTrack/DeviceChain` | AutomationLanes, ClipEnvelopeChooserViewState, AudioInputRouting, MidiInputRouting, AudioOutputRouting, MidiOutputRouting, Mixer, DeviceChain, FreezeSequencer |  | = | SendTrackDeviceChain | state |
| `/ReturnTrack/DeviceChain/AutomationLanes` | AutomationLanes, AreAdditionalAutomationLanesFolded |  | = | AutomationLanes | view state, Live’s own |
| `/ReturnTrack/DeviceChain/AutomationLanes/AutomationLanes` | AutomationLane |  | = | RemoteableList | view state, Live’s own |
| `/ReturnTrack/DeviceChain/AutomationLanes/AutomationLanes/AutomationLane` | SelectedDevice, SelectedEnvelope, IsContentSelectedInDocument, LaneHeight |  | = | AutomationLane | view state, Live’s own |
| `/ReturnTrack/DeviceChain/AutomationLanes/AutomationLanes/AutomationLane/SelectedDevice` |  | `2` | `0` | RemoteableEnum | view state, Live’s own |
| `/ReturnTrack/DeviceChain/AutomationLanes/AutomationLanes/AutomationLane/SelectedEnvelope` |  | `2` | `0` | RemoteableEnum | view state, Live’s own |
| `/ReturnTrack/DeviceChain/AutomationLanes/AutomationLanes/AutomationLane/IsContentSelectedInDocument` |  | `false` | = | RemoteableBool | view state, Live’s own |
| `/ReturnTrack/DeviceChain/AutomationLanes/AutomationLanes/AutomationLane/LaneHeight` |  | `85` | = | RemoteableInt | view state, Live’s own |
| `/ReturnTrack/DeviceChain/AutomationLanes/AreAdditionalAutomationLanesFolded` |  | `false` | = | RemoteableBool | view state, Live’s own |
| `/ReturnTrack/DeviceChain/ClipEnvelopeChooserViewState` | SelectedDevice, SelectedEnvelope, PreferModulationVisible |  | = | ClipEnvelopeChooserViewState | view state, Live’s own |
| `/ReturnTrack/DeviceChain/ClipEnvelopeChooserViewState/SelectedDevice` |  | `0` | = | RemoteableEnum | view state, Live’s own |
| `/ReturnTrack/DeviceChain/ClipEnvelopeChooserViewState/SelectedEnvelope` |  | `0` | = | RemoteableEnum | view state, Live’s own |
| `/ReturnTrack/DeviceChain/ClipEnvelopeChooserViewState/PreferModulationVisible` |  | `false` | = | RemoteableBool | view state, Live’s own |
| `/ReturnTrack/DeviceChain/AudioInputRouting` | Target, UpperDisplayString, LowerDisplayString, MpeSettings |  | = | Routable | state |
| `/ReturnTrack/DeviceChain/AudioInputRouting/Target` |  | `AudioIn/External/S0` | = | RemoteableString | state |
| `/ReturnTrack/DeviceChain/AudioInputRouting/UpperDisplayString` |  | `Ext. In` | = | RemoteableString | state |
| `/ReturnTrack/DeviceChain/AudioInputRouting/LowerDisplayString` |  | `1/2` | = | RemoteableString | state |
| `/ReturnTrack/DeviceChain/AudioInputRouting/MpeSettings` | ZoneType, FirstNoteChannel, LastNoteChannel |  | = | MpeSettings | state |
| `/ReturnTrack/DeviceChain/AudioInputRouting/MpeSettings/ZoneType` |  | `0` | = | RemoteableInt | state |
| `/ReturnTrack/DeviceChain/AudioInputRouting/MpeSettings/FirstNoteChannel` |  | `1` | = | RemoteableInt | state |
| `/ReturnTrack/DeviceChain/AudioInputRouting/MpeSettings/LastNoteChannel` |  | `15` | = | RemoteableInt | state |
| `/ReturnTrack/DeviceChain/MidiInputRouting` | Target, UpperDisplayString, LowerDisplayString, MpeSettings |  | = | Routable | state |
| `/ReturnTrack/DeviceChain/MidiInputRouting/Target` |  | `MidiIn/External.All/-1` | = | RemoteableString | state |
| `/ReturnTrack/DeviceChain/MidiInputRouting/UpperDisplayString` |  | `Ext: All Ins` | `All Ins` | RemoteableString | state |
| `/ReturnTrack/DeviceChain/MidiInputRouting/LowerDisplayString` |  | `""` | `All Channels` | RemoteableString | state |
| `/ReturnTrack/DeviceChain/MidiInputRouting/MpeSettings` | ZoneType, FirstNoteChannel, LastNoteChannel |  | = | MpeSettings | state |
| `/ReturnTrack/DeviceChain/MidiInputRouting/MpeSettings/ZoneType` |  | `0` | = | RemoteableInt | state |
| `/ReturnTrack/DeviceChain/MidiInputRouting/MpeSettings/FirstNoteChannel` |  | `1` | = | RemoteableInt | state |
| `/ReturnTrack/DeviceChain/MidiInputRouting/MpeSettings/LastNoteChannel` |  | `15` | = | RemoteableInt | state |
| `/ReturnTrack/DeviceChain/AudioOutputRouting` | Target, UpperDisplayString, LowerDisplayString, MpeSettings |  | = | Routable | state |
| `/ReturnTrack/DeviceChain/AudioOutputRouting/Target` |  | `AudioOut/Main` | = | RemoteableString | state |
| `/ReturnTrack/DeviceChain/AudioOutputRouting/UpperDisplayString` |  | `Master` | `Main` | RemoteableString | state |
| `/ReturnTrack/DeviceChain/AudioOutputRouting/LowerDisplayString` |  | `""` | = | RemoteableString | state |
| `/ReturnTrack/DeviceChain/AudioOutputRouting/MpeSettings` | ZoneType, FirstNoteChannel, LastNoteChannel |  | = | MpeSettings | state |
| `/ReturnTrack/DeviceChain/AudioOutputRouting/MpeSettings/ZoneType` |  | `0` | = | RemoteableInt | state |
| `/ReturnTrack/DeviceChain/AudioOutputRouting/MpeSettings/FirstNoteChannel` |  | `1` | = | RemoteableInt | state |
| `/ReturnTrack/DeviceChain/AudioOutputRouting/MpeSettings/LastNoteChannel` |  | `15` | = | RemoteableInt | state |
| `/ReturnTrack/DeviceChain/MidiOutputRouting` | Target, UpperDisplayString, LowerDisplayString, MpeSettings |  | = | Routable | state |
| `/ReturnTrack/DeviceChain/MidiOutputRouting/Target` |  | `MidiOut/None` | = | RemoteableString | state |
| `/ReturnTrack/DeviceChain/MidiOutputRouting/UpperDisplayString` |  | `None` | = | RemoteableString | state |
| `/ReturnTrack/DeviceChain/MidiOutputRouting/LowerDisplayString` |  | `""` | = | RemoteableString | state |
| `/ReturnTrack/DeviceChain/MidiOutputRouting/MpeSettings` | ZoneType, FirstNoteChannel, LastNoteChannel |  | = | MpeSettings | state |
| `/ReturnTrack/DeviceChain/MidiOutputRouting/MpeSettings/ZoneType` |  | `0` | = | RemoteableInt | state |
| `/ReturnTrack/DeviceChain/MidiOutputRouting/MpeSettings/FirstNoteChannel` |  | `1` | = | RemoteableInt | state |
| `/ReturnTrack/DeviceChain/MidiOutputRouting/MpeSettings/LastNoteChannel` |  | `15` | = | RemoteableInt | state |
| `/ReturnTrack/DeviceChain/Mixer` | LomId, LomIdView, IsExpanded, On, ModulationSourceCount, ParametersListWrapper, Pointee, LastSelectedTimeableIndex, LastSelectedClipEnvelopeIndex, LastPresetRef, LockedScripts, IsFolded, ShouldShowPresetName, UserName, Annotation, SourceContext, Sends, Speaker, SoloSink, PanMode, Pan, SplitStereoPanL, SplitStereoPanR, Volume, ViewStateSesstionTrackWidth, CrossFadeState, SendsListWrapper |  | = | TrackDevice | state |
| `/ReturnTrack/DeviceChain/Mixer/LomId` |  | `0` | = | Int | state |
| `/ReturnTrack/DeviceChain/Mixer/LomIdView` |  | `0` | = | Int | state |
| `/ReturnTrack/DeviceChain/Mixer/IsExpanded` |  | `true` | = | RemoteableBool | view state, Live’s own |
| `/ReturnTrack/DeviceChain/Mixer/On` | LomId, Manual, AutomationTarget, MidiCCOnOffThresholds |  | = | TimeableBool | state |
| `/ReturnTrack/DeviceChain/Mixer/On/LomId` |  | `0` | = | Int | state |
| `/ReturnTrack/DeviceChain/Mixer/On/Manual` |  | `true` | = | RemoteableBool | state |
| `/ReturnTrack/DeviceChain/Mixer/On/AutomationTarget` | LockEnvelope |  | = | BoolAutomationTarget | state |
| `/ReturnTrack/DeviceChain/Mixer/On/AutomationTarget/LockEnvelope` |  | `0` | = | RemoteableEnum | state |
| `/ReturnTrack/DeviceChain/Mixer/On/MidiCCOnOffThresholds` | Min, Max |  | = | MidiControllerRange | state |
| `/ReturnTrack/DeviceChain/Mixer/On/MidiCCOnOffThresholds/Min` |  | `64` | = | UserFloat | state |
| `/ReturnTrack/DeviceChain/Mixer/On/MidiCCOnOffThresholds/Max` |  | `127` | = | UserFloat | state |
| `/ReturnTrack/DeviceChain/Mixer/ModulationSourceCount` |  | `0` | = | RemoteableInt | state |
| `/ReturnTrack/DeviceChain/Mixer/ParametersListWrapper` |  |  | = | PythonListWrapper | state |
| `/ReturnTrack/DeviceChain/Mixer/Pointee` |  |  | = | Pointee | state |
| `/ReturnTrack/DeviceChain/Mixer/LastSelectedTimeableIndex` |  | `2` | `0` | Int | view state, Live’s own |
| `/ReturnTrack/DeviceChain/Mixer/LastSelectedClipEnvelopeIndex` |  | `0` | = | Int | view state, Live’s own |
| `/ReturnTrack/DeviceChain/Mixer/LastPresetRef` | Value |  | = | RemoteableSlot | state |
| `/ReturnTrack/DeviceChain/Mixer/LastPresetRef/Value` |  |  | = | Slot<Compound> | state |
| `/ReturnTrack/DeviceChain/Mixer/LockedScripts` |  |  | = | RemoteableList | state |
| `/ReturnTrack/DeviceChain/Mixer/IsFolded` |  | `false` | = | RemoteableBool | view state, Live’s own |
| `/ReturnTrack/DeviceChain/Mixer/ShouldShowPresetName` |  | `false` | = | RemoteableBool | view state, Live’s own |
| `/ReturnTrack/DeviceChain/Mixer/UserName` |  | `""` | = | RemoteableString | state |
| `/ReturnTrack/DeviceChain/Mixer/Annotation` |  | `""` | = | RemoteableString | state |
| `/ReturnTrack/DeviceChain/Mixer/SourceContext` | Value |  | = | RemoteableSlot | state |
| `/ReturnTrack/DeviceChain/Mixer/SourceContext/Value` |  |  | = | Slot<Compound> | state |
| `/ReturnTrack/DeviceChain/Mixer/Sends` | TrackSendHolder |  | = | RemoteableList | state |
| `/ReturnTrack/DeviceChain/Mixer/Sends/TrackSendHolder` | Send, EnabledByUser |  | = | TrackSendHolder | state |
| `/ReturnTrack/DeviceChain/Mixer/Sends/TrackSendHolder/Send` | LomId, Manual, MidiControllerRange, AutomationTarget, ModulationTarget |  | = | TimeableFloat | state |
| `/ReturnTrack/DeviceChain/Mixer/Sends/TrackSendHolder/Send/LomId` |  | `0` | = | Int | state |
| `/ReturnTrack/DeviceChain/Mixer/Sends/TrackSendHolder/Send/Manual` |  | `0.0003162277571` | = | RemoteableFloat | state |
| `/ReturnTrack/DeviceChain/Mixer/Sends/TrackSendHolder/Send/MidiControllerRange` | Min, Max |  | = | MidiControllerRange | state |
| `/ReturnTrack/DeviceChain/Mixer/Sends/TrackSendHolder/Send/MidiControllerRange/Min` |  | `0.0003162277571` | = | UserFloat | state |
| `/ReturnTrack/DeviceChain/Mixer/Sends/TrackSendHolder/Send/MidiControllerRange/Max` |  | `1` | = | UserFloat | state |
| `/ReturnTrack/DeviceChain/Mixer/Sends/TrackSendHolder/Send/AutomationTarget` | LockEnvelope |  | = | FloatAutomationTarget | state |
| `/ReturnTrack/DeviceChain/Mixer/Sends/TrackSendHolder/Send/AutomationTarget/LockEnvelope` |  | `0` | = | RemoteableEnum | state |
| `/ReturnTrack/DeviceChain/Mixer/Sends/TrackSendHolder/Send/ModulationTarget` | LockEnvelope |  | = | TimeableModulationTarget | state |
| `/ReturnTrack/DeviceChain/Mixer/Sends/TrackSendHolder/Send/ModulationTarget/LockEnvelope` |  | `0` | = | RemoteableEnum | state |
| `/ReturnTrack/DeviceChain/Mixer/Sends/TrackSendHolder/EnabledByUser` |  | `false` | = | RemoteableBool | state |
| `/ReturnTrack/DeviceChain/Mixer/Speaker` | LomId, Manual, AutomationTarget, MidiCCOnOffThresholds |  | = | TimeableBool | state |
| `/ReturnTrack/DeviceChain/Mixer/Speaker/LomId` |  | `0` | = | Int | state |
| `/ReturnTrack/DeviceChain/Mixer/Speaker/Manual` |  | `true` | = | RemoteableBool | state |
| `/ReturnTrack/DeviceChain/Mixer/Speaker/AutomationTarget` | LockEnvelope |  | = | BoolAutomationTarget | state |
| `/ReturnTrack/DeviceChain/Mixer/Speaker/AutomationTarget/LockEnvelope` |  | `0` | = | RemoteableEnum | state |
| `/ReturnTrack/DeviceChain/Mixer/Speaker/MidiCCOnOffThresholds` | Min, Max |  | = | MidiControllerRange | state |
| `/ReturnTrack/DeviceChain/Mixer/Speaker/MidiCCOnOffThresholds/Min` |  | `64` | = | UserFloat | state |
| `/ReturnTrack/DeviceChain/Mixer/Speaker/MidiCCOnOffThresholds/Max` |  | `127` | = | UserFloat | state |
| `/ReturnTrack/DeviceChain/Mixer/SoloSink` |  | `false` | = | RemoteableBool | state |
| `/ReturnTrack/DeviceChain/Mixer/PanMode` |  | `0` | = | RemoteableEnum | state |
| `/ReturnTrack/DeviceChain/Mixer/Pan` | LomId, Manual, MidiControllerRange, AutomationTarget, ModulationTarget |  | = | TimeableFloat | state |
| `/ReturnTrack/DeviceChain/Mixer/Pan/LomId` |  | `0` | = | Int | state |
| `/ReturnTrack/DeviceChain/Mixer/Pan/Manual` |  | `0` | = | RemoteableFloat | state |
| `/ReturnTrack/DeviceChain/Mixer/Pan/MidiControllerRange` | Min, Max |  | = | MidiControllerRange | state |
| `/ReturnTrack/DeviceChain/Mixer/Pan/MidiControllerRange/Min` |  | `-1` | = | UserFloat | state |
| `/ReturnTrack/DeviceChain/Mixer/Pan/MidiControllerRange/Max` |  | `1` | = | UserFloat | state |
| `/ReturnTrack/DeviceChain/Mixer/Pan/AutomationTarget` | LockEnvelope |  | = | FloatAutomationTarget | state |
| `/ReturnTrack/DeviceChain/Mixer/Pan/AutomationTarget/LockEnvelope` |  | `0` | = | RemoteableEnum | state |
| `/ReturnTrack/DeviceChain/Mixer/Pan/ModulationTarget` | LockEnvelope |  | = | TimeableModulationTarget | state |
| `/ReturnTrack/DeviceChain/Mixer/Pan/ModulationTarget/LockEnvelope` |  | `0` | = | RemoteableEnum | state |
| `/ReturnTrack/DeviceChain/Mixer/SplitStereoPanL` | LomId, Manual, MidiControllerRange, AutomationTarget, ModulationTarget |  | = | TimeableFloat | state |
| `/ReturnTrack/DeviceChain/Mixer/SplitStereoPanL/LomId` |  | `0` | = | Int | state |
| `/ReturnTrack/DeviceChain/Mixer/SplitStereoPanL/Manual` |  | `-1` | = | RemoteableFloat | state |
| `/ReturnTrack/DeviceChain/Mixer/SplitStereoPanL/MidiControllerRange` | Min, Max |  | = | MidiControllerRange | state |
| `/ReturnTrack/DeviceChain/Mixer/SplitStereoPanL/MidiControllerRange/Min` |  | `-1` | = | UserFloat | state |
| `/ReturnTrack/DeviceChain/Mixer/SplitStereoPanL/MidiControllerRange/Max` |  | `1` | = | UserFloat | state |
| `/ReturnTrack/DeviceChain/Mixer/SplitStereoPanL/AutomationTarget` | LockEnvelope |  | = | FloatAutomationTarget | state |
| `/ReturnTrack/DeviceChain/Mixer/SplitStereoPanL/AutomationTarget/LockEnvelope` |  | `0` | = | RemoteableEnum | state |
| `/ReturnTrack/DeviceChain/Mixer/SplitStereoPanL/ModulationTarget` | LockEnvelope |  | = | TimeableModulationTarget | state |
| `/ReturnTrack/DeviceChain/Mixer/SplitStereoPanL/ModulationTarget/LockEnvelope` |  | `0` | = | RemoteableEnum | state |
| `/ReturnTrack/DeviceChain/Mixer/SplitStereoPanR` | LomId, Manual, MidiControllerRange, AutomationTarget, ModulationTarget |  | = | TimeableFloat | state |
| `/ReturnTrack/DeviceChain/Mixer/SplitStereoPanR/LomId` |  | `0` | = | Int | state |
| `/ReturnTrack/DeviceChain/Mixer/SplitStereoPanR/Manual` |  | `1` | = | RemoteableFloat | state |
| `/ReturnTrack/DeviceChain/Mixer/SplitStereoPanR/MidiControllerRange` | Min, Max |  | = | MidiControllerRange | state |
| `/ReturnTrack/DeviceChain/Mixer/SplitStereoPanR/MidiControllerRange/Min` |  | `-1` | = | UserFloat | state |
| `/ReturnTrack/DeviceChain/Mixer/SplitStereoPanR/MidiControllerRange/Max` |  | `1` | = | UserFloat | state |
| `/ReturnTrack/DeviceChain/Mixer/SplitStereoPanR/AutomationTarget` | LockEnvelope |  | = | FloatAutomationTarget | state |
| `/ReturnTrack/DeviceChain/Mixer/SplitStereoPanR/AutomationTarget/LockEnvelope` |  | `0` | = | RemoteableEnum | state |
| `/ReturnTrack/DeviceChain/Mixer/SplitStereoPanR/ModulationTarget` | LockEnvelope |  | = | TimeableModulationTarget | state |
| `/ReturnTrack/DeviceChain/Mixer/SplitStereoPanR/ModulationTarget/LockEnvelope` |  | `0` | = | RemoteableEnum | state |
| `/ReturnTrack/DeviceChain/Mixer/Volume` | LomId, Manual, MidiControllerRange, AutomationTarget, ModulationTarget |  | = | TimeableFloat | state |
| `/ReturnTrack/DeviceChain/Mixer/Volume/LomId` |  | `0` | = | Int | state |
| `/ReturnTrack/DeviceChain/Mixer/Volume/Manual` |  | `1` | = | RemoteableFloat | state |
| `/ReturnTrack/DeviceChain/Mixer/Volume/MidiControllerRange` | Min, Max |  | = | MidiControllerRange | state |
| `/ReturnTrack/DeviceChain/Mixer/Volume/MidiControllerRange/Min` |  | `0.0003162277571` | = | UserFloat | state |
| `/ReturnTrack/DeviceChain/Mixer/Volume/MidiControllerRange/Max` |  | `1.99526238` | = | UserFloat | state |
| `/ReturnTrack/DeviceChain/Mixer/Volume/AutomationTarget` | LockEnvelope |  | = | FloatAutomationTarget | state |
| `/ReturnTrack/DeviceChain/Mixer/Volume/AutomationTarget/LockEnvelope` |  | `0` | = | RemoteableEnum | state |
| `/ReturnTrack/DeviceChain/Mixer/Volume/ModulationTarget` | LockEnvelope |  | = | TimeableModulationTarget | state |
| `/ReturnTrack/DeviceChain/Mixer/Volume/ModulationTarget/LockEnvelope` |  | `0` | = | RemoteableEnum | state |
| `/ReturnTrack/DeviceChain/Mixer/ViewStateSesstionTrackWidth` |  | `93` | = | RemoteableInt | view state, Live’s own |
| `/ReturnTrack/DeviceChain/Mixer/CrossFadeState` | LomId, Manual, AutomationTarget |  | = | TimeableEnum | state |
| `/ReturnTrack/DeviceChain/Mixer/CrossFadeState/LomId` |  | `0` | = | Int | state |
| `/ReturnTrack/DeviceChain/Mixer/CrossFadeState/Manual` |  | `1` | = | RemoteableEnum | state |
| `/ReturnTrack/DeviceChain/Mixer/CrossFadeState/AutomationTarget` | LockEnvelope |  | = | EnumAutomationTarget | state |
| `/ReturnTrack/DeviceChain/Mixer/CrossFadeState/AutomationTarget/LockEnvelope` |  | `0` | = | RemoteableEnum | state |
| `/ReturnTrack/DeviceChain/Mixer/SendsListWrapper` |  |  | = | PythonListWrapper | state |
| `/ReturnTrack/DeviceChain/DeviceChain` | Devices, SignalModulations |  | = | AudioToAudioDeviceChain | state |
| `/ReturnTrack/DeviceChain/DeviceChain/Devices` |  |  | = | RemoteableList | state |
| `/ReturnTrack/DeviceChain/DeviceChain/SignalModulations` |  |  | = | RemoteableList | state |
| `/ReturnTrack/DeviceChain/FreezeSequencer` | LomId, LomIdView, IsExpanded, On, ModulationSourceCount, ParametersListWrapper, Pointee, LastSelectedTimeableIndex, LastSelectedClipEnvelopeIndex, LastPresetRef, LockedScripts, IsFolded, ShouldShowPresetName, UserName, Annotation, SourceContext, ClipSlotList, MonitoringEnum, KeepRecordMonitoringLatency, Sample, VolumeModulationTarget, TranspositionModulationTarget, TransientEnvelopeModulationTarget, GrainSizeModulationTarget, FluxModulationTarget, SampleOffsetModulationTarget, ComplexProFormantsModulationTarget, ComplexProEnvelopeModulationTarget, PitchViewScrollPosition, SampleOffsetModulationScrollPosition, Recorder |  | = | AudioSequencer | state |
| `/ReturnTrack/DeviceChain/FreezeSequencer/LomId` |  | `0` | = | Int | state |
| `/ReturnTrack/DeviceChain/FreezeSequencer/LomIdView` |  | `0` | = | Int | state |
| `/ReturnTrack/DeviceChain/FreezeSequencer/IsExpanded` |  | `true` | = | RemoteableBool | view state, Live’s own |
| `/ReturnTrack/DeviceChain/FreezeSequencer/On` | LomId, Manual, AutomationTarget, MidiCCOnOffThresholds |  | = | TimeableBool | state |
| `/ReturnTrack/DeviceChain/FreezeSequencer/On/LomId` |  | `0` | = | Int | state |
| `/ReturnTrack/DeviceChain/FreezeSequencer/On/Manual` |  | `true` | = | RemoteableBool | state |
| `/ReturnTrack/DeviceChain/FreezeSequencer/On/AutomationTarget` | LockEnvelope |  | = | BoolAutomationTarget | state |
| `/ReturnTrack/DeviceChain/FreezeSequencer/On/AutomationTarget/LockEnvelope` |  | `0` | = | RemoteableEnum | state |
| `/ReturnTrack/DeviceChain/FreezeSequencer/On/MidiCCOnOffThresholds` | Min, Max |  | = | MidiControllerRange | state |
| `/ReturnTrack/DeviceChain/FreezeSequencer/On/MidiCCOnOffThresholds/Min` |  | `64` | = | UserFloat | state |
| `/ReturnTrack/DeviceChain/FreezeSequencer/On/MidiCCOnOffThresholds/Max` |  | `127` | = | UserFloat | state |
| `/ReturnTrack/DeviceChain/FreezeSequencer/ModulationSourceCount` |  | `0` | = | RemoteableInt | state |
| `/ReturnTrack/DeviceChain/FreezeSequencer/ParametersListWrapper` |  |  | = | PythonListWrapper | state |
| `/ReturnTrack/DeviceChain/FreezeSequencer/Pointee` |  |  | = | Pointee | state |
| `/ReturnTrack/DeviceChain/FreezeSequencer/LastSelectedTimeableIndex` |  | `0` | = | Int | view state, Live’s own |
| `/ReturnTrack/DeviceChain/FreezeSequencer/LastSelectedClipEnvelopeIndex` |  | `0` | = | Int | view state, Live’s own |
| `/ReturnTrack/DeviceChain/FreezeSequencer/LastPresetRef` | Value |  | = | RemoteableSlot | state |
| `/ReturnTrack/DeviceChain/FreezeSequencer/LastPresetRef/Value` |  |  | = | Slot<Compound> | state |
| `/ReturnTrack/DeviceChain/FreezeSequencer/LockedScripts` |  |  | = | RemoteableList | state |
| `/ReturnTrack/DeviceChain/FreezeSequencer/IsFolded` |  | `false` | = | RemoteableBool | view state, Live’s own |
| `/ReturnTrack/DeviceChain/FreezeSequencer/ShouldShowPresetName` |  | `false` | = | RemoteableBool | view state, Live’s own |
| `/ReturnTrack/DeviceChain/FreezeSequencer/UserName` |  | `""` | = | RemoteableString | state |
| `/ReturnTrack/DeviceChain/FreezeSequencer/Annotation` |  | `""` | = | RemoteableString | state |
| `/ReturnTrack/DeviceChain/FreezeSequencer/SourceContext` | Value |  | = | RemoteableSlot | state |
| `/ReturnTrack/DeviceChain/FreezeSequencer/SourceContext/Value` |  |  | = | Slot<Compound> | state |
| `/ReturnTrack/DeviceChain/FreezeSequencer/ClipSlotList` |  |  | = | RemoteableList | state |
| `/ReturnTrack/DeviceChain/FreezeSequencer/MonitoringEnum` |  | `1` | = | RemoteableEnum | state |
| `/ReturnTrack/DeviceChain/FreezeSequencer/KeepRecordMonitoringLatency` |  | `true` | = | RemoteableBool | state |
| `/ReturnTrack/DeviceChain/FreezeSequencer/Sample` | ArrangerAutomation |  | = | TimeableSample | state |
| `/ReturnTrack/DeviceChain/FreezeSequencer/Sample/ArrangerAutomation` | Events, AutomationTransformViewState |  | = | ListAutomation | state |
| `/ReturnTrack/DeviceChain/FreezeSequencer/Sample/ArrangerAutomation/Events` |  |  | = | RemoteableList | state |
| `/ReturnTrack/DeviceChain/FreezeSequencer/Sample/ArrangerAutomation/AutomationTransformViewState` | IsTransformPending, TimeAndValueTransforms |  | = | AutomationTransformViewState | view state, Live’s own |
| `/ReturnTrack/DeviceChain/FreezeSequencer/Sample/ArrangerAutomation/AutomationTransformViewState/IsTransformPending` |  | `false` | = | RemoteableBool | view state, Live’s own |
| `/ReturnTrack/DeviceChain/FreezeSequencer/Sample/ArrangerAutomation/AutomationTransformViewState/TimeAndValueTransforms` |  |  | = | RemoteableList | view state, Live’s own |
| `/ReturnTrack/DeviceChain/FreezeSequencer/VolumeModulationTarget` | LockEnvelope |  | = | UserFloatModulationTarget | state |
| `/ReturnTrack/DeviceChain/FreezeSequencer/VolumeModulationTarget/LockEnvelope` |  | `0` | = | RemoteableEnum | state |
| `/ReturnTrack/DeviceChain/FreezeSequencer/TranspositionModulationTarget` | LockEnvelope |  | = | UserFloatModulationTarget | state |
| `/ReturnTrack/DeviceChain/FreezeSequencer/TranspositionModulationTarget/LockEnvelope` |  | `0` | = | RemoteableEnum | state |
| `/ReturnTrack/DeviceChain/FreezeSequencer/TransientEnvelopeModulationTarget` | LockEnvelope |  | = | UserFloatModulationTarget | state |
| `/ReturnTrack/DeviceChain/FreezeSequencer/TransientEnvelopeModulationTarget/LockEnvelope` |  | `0` | = | RemoteableEnum | state |
| `/ReturnTrack/DeviceChain/FreezeSequencer/GrainSizeModulationTarget` | LockEnvelope |  | = | UserFloatModulationTarget | state |
| `/ReturnTrack/DeviceChain/FreezeSequencer/GrainSizeModulationTarget/LockEnvelope` |  | `0` | = | RemoteableEnum | state |
| `/ReturnTrack/DeviceChain/FreezeSequencer/FluxModulationTarget` | LockEnvelope |  | = | UserFloatModulationTarget | state |
| `/ReturnTrack/DeviceChain/FreezeSequencer/FluxModulationTarget/LockEnvelope` |  | `0` | = | RemoteableEnum | state |
| `/ReturnTrack/DeviceChain/FreezeSequencer/SampleOffsetModulationTarget` | LockEnvelope |  | = | UserFloatModulationTarget | state |
| `/ReturnTrack/DeviceChain/FreezeSequencer/SampleOffsetModulationTarget/LockEnvelope` |  | `0` | = | RemoteableEnum | state |
| `/ReturnTrack/DeviceChain/FreezeSequencer/ComplexProFormantsModulationTarget` | LockEnvelope |  | = | UserFloatModulationTarget | state |
| `/ReturnTrack/DeviceChain/FreezeSequencer/ComplexProFormantsModulationTarget/LockEnvelope` |  | `0` | = | RemoteableEnum | state |
| `/ReturnTrack/DeviceChain/FreezeSequencer/ComplexProEnvelopeModulationTarget` | LockEnvelope |  | = | UserFloatModulationTarget | state |
| `/ReturnTrack/DeviceChain/FreezeSequencer/ComplexProEnvelopeModulationTarget/LockEnvelope` |  | `0` | = | RemoteableEnum | state |
| `/ReturnTrack/DeviceChain/FreezeSequencer/PitchViewScrollPosition` |  | `-1073741824` | = | RemoteableInt | state |
| `/ReturnTrack/DeviceChain/FreezeSequencer/SampleOffsetModulationScrollPosition` |  | `-1073741824` | = | RemoteableInt | view state, Live’s own |
| `/ReturnTrack/DeviceChain/FreezeSequencer/Recorder` | IsArmed, TakeCounter |  | = | AudioRecorder | state |
| `/ReturnTrack/DeviceChain/FreezeSequencer/Recorder/IsArmed` |  | `false` | = | RemoteableBool | state |
| `/ReturnTrack/DeviceChain/FreezeSequencer/Recorder/TakeCounter` |  | `1` | `0` | Int | state |

### LiveSet

| Element | Children, in Live's order | Live wrote | The blank set writes | Schema class | Standing |
| --- | --- | --- | --- | --- | --- |
| `/LiveSet` | NextPointeeId, OverwriteProtectionNumber, LomId, LomIdView, Tracks, MainTrack, PreHearTrack, SendsPre, Scenes, Transport, SessionScrollPos, SignalModulations, GlobalQuantisation, AutoQuantisation, Grid, ScaleInformation, InKey, SmpteFormat, TimeSelection, SequencerNavigator, IsContentSplitterOpen, IsExpressionSplitterOpen, ExpressionLanes, ContentLanes, ViewStateFxSlotCount, ViewStateSessionMixerHeight, ViewStateArrangerMixerVolumeSectionHeight, ShouldSceneTempoAndTimeSignatureBeVisible, WaveformVerticalZoomFactor, IsWaveformVerticalZoomActive, Locators, DetailClipKeyMidis, TracksListWrapper, VisibleTracksListWrapper, ReturnTracksListWrapper, ScenesListWrapper, CuePointsListWrapper, ChooserBar, Annotation, SoloOrPflSavedValue, SoloInPlace, CrossfadeCurve, LatencyCompensation, HighlightedTrackIndex, GroovePool, AutomationMode, SnapAutomationToGrid, ArrangementOverdub, ColorSequenceIndex, AutoColorPickerForPlayerAndGroupTracks, AutoColorPickerForReturnAndMainTracks, ViewData, ResetNonautomatedMidiControllersOnClipStarts, MidiFoldIn, MidiFoldMode, MultiClipFocusMode, MultiClipLoopBarHeight, MidiPrelisten, LinkedTrackGroups, NoteSpellingPreference, AccidentalSpellingPreference, PreferFlatRootNote, UseWarperLegacyHiQMode, VideoWindowRect, ShowVideoWindow, TuningSystems, TrackHeaderWidth, ViewStateMainWindowClipDetailOpen, ViewStateMainWindowHiddenOtherDocViewTypeClipDetailOpen, ViewStateMainWindowHiddenOtherDocViewTypeDeviceDetailOpen, ViewStateMainWindowDeviceDetailOpen, ViewStateSecondWindowClipDetailOpen, ViewStateSecondWindowDeviceDetailOpen, ViewStates, NoteAlgorithms |  | = | LiveSet | state |
| `/LiveSet/NextPointeeId` |  | `35094` | `223` | Int | state |
| `/LiveSet/OverwriteProtectionNumber` |  | `3072` | = | Int | state |
| `/LiveSet/LomId` |  | `0` | = | Int | state |
| `/LiveSet/LomIdView` |  | `0` | = | Int | state |
| `/LiveSet/Tracks` |  |  | = | RemoteableList | state |
| `/LiveSet/MainTrack` | LomId, LomIdView, IsContentSelectedInDocument, PreferredContentViewMode, TrackDelay, Name, Color, AutomationEnvelopes, TrackGroupId, TrackUnfolded, DevicesListWrapper, ClipSlotsListWrapper, ViewData, TakeLanes, LinkedTrackGroupId, DeviceChain |  | = | MainTrack | state |
| `/LiveSet/MainTrack/LomId` |  | `0` | = | Int | state |
| `/LiveSet/MainTrack/LomIdView` |  | `0` | = | Int | state |
| `/LiveSet/MainTrack/IsContentSelectedInDocument` |  | `false` | = | RemoteableBool | view state, Live’s own |
| `/LiveSet/MainTrack/PreferredContentViewMode` |  | `0` | = | RemoteableInt | view state, Live’s own |
| `/LiveSet/MainTrack/TrackDelay` | Value, IsValueSampleBased |  | = | TimeInSamplesOrMs | state |
| `/LiveSet/MainTrack/TrackDelay/Value` |  | `0` | = | UserFloat | state |
| `/LiveSet/MainTrack/TrackDelay/IsValueSampleBased` |  | `false` | = | RemoteableBool | state |
| `/LiveSet/MainTrack/Name` | EffectiveName, UserName, Annotation, MemorizedFirstClipName |  | = | DeviceChainContainerName | state |
| `/LiveSet/MainTrack/Name/EffectiveName` |  | `Main` | = | RemoteableString | state |
| `/LiveSet/MainTrack/Name/UserName` |  | `""` | = | RemoteableString | state |
| `/LiveSet/MainTrack/Name/Annotation` |  | `""` | = | RemoteableString | state |
| `/LiveSet/MainTrack/Name/MemorizedFirstClipName` |  | `""` | = | RemoteableString | state |
| `/LiveSet/MainTrack/Color` |  | `8` | = | RemoteableDocumentColor | state |
| `/LiveSet/MainTrack/AutomationEnvelopes` | Envelopes |  | = | AutomationEnvelopes | state |
| `/LiveSet/MainTrack/AutomationEnvelopes/Envelopes` |  |  | = | RemoteableList | state |
| `/LiveSet/MainTrack/TrackGroupId` |  | `-1` | = | RemoteableInt | state |
| `/LiveSet/MainTrack/TrackUnfolded` |  | `true` | = | RemoteableBool | view state, Live’s own |
| `/LiveSet/MainTrack/DevicesListWrapper` |  |  | = | PythonListWrapper | state |
| `/LiveSet/MainTrack/ClipSlotsListWrapper` |  |  | = | PythonListWrapper | state |
| `/LiveSet/MainTrack/ViewData` |  | `{}` | = | RemoteableViewData | view state, Live’s own |
| `/LiveSet/MainTrack/TakeLanes` | TakeLanes, AreTakeLanesFolded |  | = | TakeLanes | state |
| `/LiveSet/MainTrack/TakeLanes/TakeLanes` |  |  | = | RemoteableList | state |
| `/LiveSet/MainTrack/TakeLanes/AreTakeLanesFolded` |  | `true` | = | RemoteableBool | view state, Live’s own |
| `/LiveSet/MainTrack/LinkedTrackGroupId` |  | `-1` | = | RemoteableInt | state |
| `/LiveSet/MainTrack/DeviceChain` | AutomationLanes, ClipEnvelopeChooserViewState, AudioInputRouting, MidiInputRouting, AudioOutputRouting, MidiOutputRouting, Mixer, FreezeSequencer, DeviceChain |  | = | MainTrackDeviceChain | state |
| `/LiveSet/MainTrack/DeviceChain/AutomationLanes` | AutomationLanes, AreAdditionalAutomationLanesFolded |  | = | AutomationLanes | view state, Live’s own |
| `/LiveSet/MainTrack/DeviceChain/AutomationLanes/AutomationLanes` | AutomationLane |  | = | RemoteableList | view state, Live’s own |
| `/LiveSet/MainTrack/DeviceChain/AutomationLanes/AutomationLanes/AutomationLane` | SelectedDevice, SelectedEnvelope, IsContentSelectedInDocument, LaneHeight |  | = | AutomationLane | view state, Live’s own |
| `/LiveSet/MainTrack/DeviceChain/AutomationLanes/AutomationLanes/AutomationLane/SelectedDevice` |  | `4` | `0` | RemoteableEnum | view state, Live’s own |
| `/LiveSet/MainTrack/DeviceChain/AutomationLanes/AutomationLanes/AutomationLane/SelectedEnvelope` |  | `64` | `0` | RemoteableEnum | view state, Live’s own |
| `/LiveSet/MainTrack/DeviceChain/AutomationLanes/AutomationLanes/AutomationLane/IsContentSelectedInDocument` |  | `false` | = | RemoteableBool | view state, Live’s own |
| `/LiveSet/MainTrack/DeviceChain/AutomationLanes/AutomationLanes/AutomationLane/LaneHeight` |  | `85` | = | RemoteableInt | view state, Live’s own |
| `/LiveSet/MainTrack/DeviceChain/AutomationLanes/AreAdditionalAutomationLanesFolded` |  | `false` | = | RemoteableBool | view state, Live’s own |
| `/LiveSet/MainTrack/DeviceChain/ClipEnvelopeChooserViewState` | SelectedDevice, SelectedEnvelope, PreferModulationVisible |  | = | ClipEnvelopeChooserViewState | view state, Live’s own |
| `/LiveSet/MainTrack/DeviceChain/ClipEnvelopeChooserViewState/SelectedDevice` |  | `0` | = | RemoteableEnum | view state, Live’s own |
| `/LiveSet/MainTrack/DeviceChain/ClipEnvelopeChooserViewState/SelectedEnvelope` |  | `0` | = | RemoteableEnum | view state, Live’s own |
| `/LiveSet/MainTrack/DeviceChain/ClipEnvelopeChooserViewState/PreferModulationVisible` |  | `false` | = | RemoteableBool | view state, Live’s own |
| `/LiveSet/MainTrack/DeviceChain/AudioInputRouting` | Target, UpperDisplayString, LowerDisplayString, MpeSettings |  | = | Routable | state |
| `/LiveSet/MainTrack/DeviceChain/AudioInputRouting/Target` |  | `AudioIn/External/S0` | = | RemoteableString | state |
| `/LiveSet/MainTrack/DeviceChain/AudioInputRouting/UpperDisplayString` |  | `Ext. In` | = | RemoteableString | state |
| `/LiveSet/MainTrack/DeviceChain/AudioInputRouting/LowerDisplayString` |  | `1/2` | = | RemoteableString | state |
| `/LiveSet/MainTrack/DeviceChain/AudioInputRouting/MpeSettings` | ZoneType, FirstNoteChannel, LastNoteChannel |  | = | MpeSettings | state |
| `/LiveSet/MainTrack/DeviceChain/AudioInputRouting/MpeSettings/ZoneType` |  | `0` | = | RemoteableInt | state |
| `/LiveSet/MainTrack/DeviceChain/AudioInputRouting/MpeSettings/FirstNoteChannel` |  | `1` | = | RemoteableInt | state |
| `/LiveSet/MainTrack/DeviceChain/AudioInputRouting/MpeSettings/LastNoteChannel` |  | `15` | = | RemoteableInt | state |
| `/LiveSet/MainTrack/DeviceChain/MidiInputRouting` | Target, UpperDisplayString, LowerDisplayString, MpeSettings |  | = | Routable | state |
| `/LiveSet/MainTrack/DeviceChain/MidiInputRouting/Target` |  | `MidiIn/External.All/-1` | = | RemoteableString | state |
| `/LiveSet/MainTrack/DeviceChain/MidiInputRouting/UpperDisplayString` |  | `Ext: All Ins` | `All Ins` | RemoteableString | state |
| `/LiveSet/MainTrack/DeviceChain/MidiInputRouting/LowerDisplayString` |  | `""` | `All Channels` | RemoteableString | state |
| `/LiveSet/MainTrack/DeviceChain/MidiInputRouting/MpeSettings` | ZoneType, FirstNoteChannel, LastNoteChannel |  | = | MpeSettings | state |
| `/LiveSet/MainTrack/DeviceChain/MidiInputRouting/MpeSettings/ZoneType` |  | `0` | = | RemoteableInt | state |
| `/LiveSet/MainTrack/DeviceChain/MidiInputRouting/MpeSettings/FirstNoteChannel` |  | `1` | = | RemoteableInt | state |
| `/LiveSet/MainTrack/DeviceChain/MidiInputRouting/MpeSettings/LastNoteChannel` |  | `15` | = | RemoteableInt | state |
| `/LiveSet/MainTrack/DeviceChain/AudioOutputRouting` | Target, UpperDisplayString, LowerDisplayString, MpeSettings |  | = | Routable | state |
| `/LiveSet/MainTrack/DeviceChain/AudioOutputRouting/Target` |  | `AudioOut/External/S0` | = | RemoteableString | state |
| `/LiveSet/MainTrack/DeviceChain/AudioOutputRouting/UpperDisplayString` |  | `Ext. Out` | = | RemoteableString | state |
| `/LiveSet/MainTrack/DeviceChain/AudioOutputRouting/LowerDisplayString` |  | `1/2` | = | RemoteableString | state |
| `/LiveSet/MainTrack/DeviceChain/AudioOutputRouting/MpeSettings` | ZoneType, FirstNoteChannel, LastNoteChannel |  | = | MpeSettings | state |
| `/LiveSet/MainTrack/DeviceChain/AudioOutputRouting/MpeSettings/ZoneType` |  | `0` | = | RemoteableInt | state |
| `/LiveSet/MainTrack/DeviceChain/AudioOutputRouting/MpeSettings/FirstNoteChannel` |  | `1` | = | RemoteableInt | state |
| `/LiveSet/MainTrack/DeviceChain/AudioOutputRouting/MpeSettings/LastNoteChannel` |  | `15` | = | RemoteableInt | state |
| `/LiveSet/MainTrack/DeviceChain/MidiOutputRouting` | Target, UpperDisplayString, LowerDisplayString, MpeSettings |  | = | Routable | state |
| `/LiveSet/MainTrack/DeviceChain/MidiOutputRouting/Target` |  | `MidiOut/None` | = | RemoteableString | state |
| `/LiveSet/MainTrack/DeviceChain/MidiOutputRouting/UpperDisplayString` |  | `None` | = | RemoteableString | state |
| `/LiveSet/MainTrack/DeviceChain/MidiOutputRouting/LowerDisplayString` |  | `""` | = | RemoteableString | state |
| `/LiveSet/MainTrack/DeviceChain/MidiOutputRouting/MpeSettings` | ZoneType, FirstNoteChannel, LastNoteChannel |  | = | MpeSettings | state |
| `/LiveSet/MainTrack/DeviceChain/MidiOutputRouting/MpeSettings/ZoneType` |  | `0` | = | RemoteableInt | state |
| `/LiveSet/MainTrack/DeviceChain/MidiOutputRouting/MpeSettings/FirstNoteChannel` |  | `1` | = | RemoteableInt | state |
| `/LiveSet/MainTrack/DeviceChain/MidiOutputRouting/MpeSettings/LastNoteChannel` |  | `15` | = | RemoteableInt | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer` | LomId, LomIdView, IsExpanded, On, ModulationSourceCount, ParametersListWrapper, Pointee, LastSelectedTimeableIndex, LastSelectedClipEnvelopeIndex, LastPresetRef, LockedScripts, IsFolded, ShouldShowPresetName, UserName, Annotation, SourceContext, Sends, Speaker, SoloSink, PanMode, Pan, SplitStereoPanL, SplitStereoPanR, Volume, ViewStateSesstionTrackWidth, CrossFadeState, SendsListWrapper, Tempo, TimeSignature, GlobalGrooveAmount, CrossFade, TempoAutomationViewBottom, TempoAutomationViewTop |  | = | MainTrackDevice | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/LomId` |  | `0` | = | Int | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/LomIdView` |  | `0` | = | Int | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/IsExpanded` |  | `true` | = | RemoteableBool | view state, Live’s own |
| `/LiveSet/MainTrack/DeviceChain/Mixer/On` | LomId, Manual, AutomationTarget, MidiCCOnOffThresholds |  | = | TimeableBool | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/On/LomId` |  | `0` | = | Int | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/On/Manual` |  | `true` | = | RemoteableBool | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/On/AutomationTarget` | LockEnvelope |  | = | BoolAutomationTarget | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/On/AutomationTarget/LockEnvelope` |  | `0` | = | RemoteableEnum | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/On/MidiCCOnOffThresholds` | Min, Max |  | = | MidiControllerRange | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/On/MidiCCOnOffThresholds/Min` |  | `64` | = | UserFloat | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/On/MidiCCOnOffThresholds/Max` |  | `127` | = | UserFloat | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/ModulationSourceCount` |  | `0` | = | RemoteableInt | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/ParametersListWrapper` |  |  | = | PythonListWrapper | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/Pointee` |  |  | = | Pointee | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/LastSelectedTimeableIndex` |  | `2` | `0` | Int | view state, Live’s own |
| `/LiveSet/MainTrack/DeviceChain/Mixer/LastSelectedClipEnvelopeIndex` |  | `0` | = | Int | view state, Live’s own |
| `/LiveSet/MainTrack/DeviceChain/Mixer/LastPresetRef` | Value |  | = | RemoteableSlot | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/LastPresetRef/Value` |  |  | = | Slot<Compound> | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/LockedScripts` |  |  | = | RemoteableList | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/IsFolded` |  | `false` | = | RemoteableBool | view state, Live’s own |
| `/LiveSet/MainTrack/DeviceChain/Mixer/ShouldShowPresetName` |  | `false` | = | RemoteableBool | view state, Live’s own |
| `/LiveSet/MainTrack/DeviceChain/Mixer/UserName` |  | `""` | = | RemoteableString | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/Annotation` |  | `""` | = | RemoteableString | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/SourceContext` | Value |  | = | RemoteableSlot | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/SourceContext/Value` |  |  | = | Slot<Compound> | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/Sends` |  |  | = | RemoteableList | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/Speaker` | LomId, Manual, AutomationTarget, MidiCCOnOffThresholds |  | = | TimeableBool | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/Speaker/LomId` |  | `0` | = | Int | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/Speaker/Manual` |  | `true` | = | RemoteableBool | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/Speaker/AutomationTarget` | LockEnvelope |  | = | BoolAutomationTarget | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/Speaker/AutomationTarget/LockEnvelope` |  | `0` | = | RemoteableEnum | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/Speaker/MidiCCOnOffThresholds` | Min, Max |  | = | MidiControllerRange | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/Speaker/MidiCCOnOffThresholds/Min` |  | `64` | = | UserFloat | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/Speaker/MidiCCOnOffThresholds/Max` |  | `127` | = | UserFloat | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/SoloSink` |  | `false` | = | RemoteableBool | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/PanMode` |  | `0` | = | RemoteableEnum | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/Pan` | LomId, Manual, MidiControllerRange, AutomationTarget, ModulationTarget |  | = | TimeableFloat | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/Pan/LomId` |  | `0` | = | Int | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/Pan/Manual` |  | `0` | = | RemoteableFloat | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/Pan/MidiControllerRange` | Min, Max |  | = | MidiControllerRange | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/Pan/MidiControllerRange/Min` |  | `-1` | = | UserFloat | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/Pan/MidiControllerRange/Max` |  | `1` | = | UserFloat | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/Pan/AutomationTarget` | LockEnvelope |  | = | FloatAutomationTarget | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/Pan/AutomationTarget/LockEnvelope` |  | `0` | = | RemoteableEnum | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/Pan/ModulationTarget` | LockEnvelope |  | = | TimeableModulationTarget | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/Pan/ModulationTarget/LockEnvelope` |  | `0` | = | RemoteableEnum | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/SplitStereoPanL` | LomId, Manual, MidiControllerRange, AutomationTarget, ModulationTarget |  | = | TimeableFloat | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/SplitStereoPanL/LomId` |  | `0` | = | Int | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/SplitStereoPanL/Manual` |  | `-1` | = | RemoteableFloat | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/SplitStereoPanL/MidiControllerRange` | Min, Max |  | = | MidiControllerRange | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/SplitStereoPanL/MidiControllerRange/Min` |  | `-1` | = | UserFloat | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/SplitStereoPanL/MidiControllerRange/Max` |  | `1` | = | UserFloat | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/SplitStereoPanL/AutomationTarget` | LockEnvelope |  | = | FloatAutomationTarget | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/SplitStereoPanL/AutomationTarget/LockEnvelope` |  | `0` | = | RemoteableEnum | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/SplitStereoPanL/ModulationTarget` | LockEnvelope |  | = | TimeableModulationTarget | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/SplitStereoPanL/ModulationTarget/LockEnvelope` |  | `0` | = | RemoteableEnum | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/SplitStereoPanR` | LomId, Manual, MidiControllerRange, AutomationTarget, ModulationTarget |  | = | TimeableFloat | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/SplitStereoPanR/LomId` |  | `0` | = | Int | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/SplitStereoPanR/Manual` |  | `1` | = | RemoteableFloat | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/SplitStereoPanR/MidiControllerRange` | Min, Max |  | = | MidiControllerRange | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/SplitStereoPanR/MidiControllerRange/Min` |  | `-1` | = | UserFloat | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/SplitStereoPanR/MidiControllerRange/Max` |  | `1` | = | UserFloat | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/SplitStereoPanR/AutomationTarget` | LockEnvelope |  | = | FloatAutomationTarget | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/SplitStereoPanR/AutomationTarget/LockEnvelope` |  | `0` | = | RemoteableEnum | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/SplitStereoPanR/ModulationTarget` | LockEnvelope |  | = | TimeableModulationTarget | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/SplitStereoPanR/ModulationTarget/LockEnvelope` |  | `0` | = | RemoteableEnum | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/Volume` | LomId, Manual, MidiControllerRange, AutomationTarget, ModulationTarget |  | = | TimeableFloat | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/Volume/LomId` |  | `0` | = | Int | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/Volume/Manual` |  | `1` | = | RemoteableFloat | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/Volume/MidiControllerRange` | Min, Max |  | = | MidiControllerRange | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/Volume/MidiControllerRange/Min` |  | `0.0003162277571` | = | UserFloat | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/Volume/MidiControllerRange/Max` |  | `1.99526238` | = | UserFloat | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/Volume/AutomationTarget` | LockEnvelope |  | = | FloatAutomationTarget | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/Volume/AutomationTarget/LockEnvelope` |  | `0` | = | RemoteableEnum | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/Volume/ModulationTarget` | LockEnvelope |  | = | TimeableModulationTarget | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/Volume/ModulationTarget/LockEnvelope` |  | `0` | = | RemoteableEnum | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/ViewStateSesstionTrackWidth` |  | `103` | `93` | RemoteableInt | view state, Live’s own |
| `/LiveSet/MainTrack/DeviceChain/Mixer/CrossFadeState` | LomId, Manual, AutomationTarget |  | = | TimeableEnum | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/CrossFadeState/LomId` |  | `0` | = | Int | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/CrossFadeState/Manual` |  | `1` | = | RemoteableEnum | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/CrossFadeState/AutomationTarget` | LockEnvelope |  | = | EnumAutomationTarget | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/CrossFadeState/AutomationTarget/LockEnvelope` |  | `0` | = | RemoteableEnum | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/SendsListWrapper` |  |  | = | PythonListWrapper | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/Tempo` | LomId, Manual, MidiControllerRange, AutomationTarget, ModulationTarget |  | = | TimeableSongTempo | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/Tempo/LomId` |  | `0` | = | Int | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/Tempo/Manual` |  | `131` | `120` | RemoteableFloat | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/Tempo/MidiControllerRange` | Min, Max |  | = | MidiControllerRange | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/Tempo/MidiControllerRange/Min` |  | `60` | = | UserFloat | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/Tempo/MidiControllerRange/Max` |  | `200` | = | UserFloat | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/Tempo/AutomationTarget` | LockEnvelope |  | = | FloatAutomationTarget | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/Tempo/AutomationTarget/LockEnvelope` |  | `0` | = | RemoteableEnum | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/Tempo/ModulationTarget` | LockEnvelope |  | = | TimeableModulationTarget | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/Tempo/ModulationTarget/LockEnvelope` |  | `0` | = | RemoteableEnum | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/TimeSignature` | LomId, Manual, AutomationTarget |  | = | TimeableTimeSignature | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/TimeSignature/LomId` |  | `0` | = | Int | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/TimeSignature/Manual` |  | `201` | = | RemoteableEnum | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/TimeSignature/AutomationTarget` | LockEnvelope |  | = | EnumAutomationTarget | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/TimeSignature/AutomationTarget/LockEnvelope` |  | `0` | = | RemoteableEnum | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/GlobalGrooveAmount` | LomId, Manual, MidiControllerRange, AutomationTarget, ModulationTarget |  | = | TimeableFloat | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/GlobalGrooveAmount/LomId` |  | `0` | = | Int | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/GlobalGrooveAmount/Manual` |  | `100` | = | RemoteableFloat | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/GlobalGrooveAmount/MidiControllerRange` | Min, Max |  | = | MidiControllerRange | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/GlobalGrooveAmount/MidiControllerRange/Min` |  | `0` | = | UserFloat | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/GlobalGrooveAmount/MidiControllerRange/Max` |  | `131.25` | = | UserFloat | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/GlobalGrooveAmount/AutomationTarget` | LockEnvelope |  | = | FloatAutomationTarget | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/GlobalGrooveAmount/AutomationTarget/LockEnvelope` |  | `0` | = | RemoteableEnum | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/GlobalGrooveAmount/ModulationTarget` | LockEnvelope |  | = | TimeableModulationTarget | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/GlobalGrooveAmount/ModulationTarget/LockEnvelope` |  | `0` | = | RemoteableEnum | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/CrossFade` | LomId, Manual, MidiControllerRange, AutomationTarget, ModulationTarget |  | = | TimeableFloat | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/CrossFade/LomId` |  | `0` | = | Int | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/CrossFade/Manual` |  | `0` | = | RemoteableFloat | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/CrossFade/MidiControllerRange` | Min, Max |  | = | MidiControllerRange | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/CrossFade/MidiControllerRange/Min` |  | `-1` | = | UserFloat | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/CrossFade/MidiControllerRange/Max` |  | `1` | = | UserFloat | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/CrossFade/AutomationTarget` | LockEnvelope |  | = | FloatAutomationTarget | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/CrossFade/AutomationTarget/LockEnvelope` |  | `0` | = | RemoteableEnum | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/CrossFade/ModulationTarget` | LockEnvelope |  | = | TimeableModulationTarget | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/CrossFade/ModulationTarget/LockEnvelope` |  | `0` | = | RemoteableEnum | state |
| `/LiveSet/MainTrack/DeviceChain/Mixer/TempoAutomationViewBottom` |  | `60` | = | UserFloat | view state, Live’s own |
| `/LiveSet/MainTrack/DeviceChain/Mixer/TempoAutomationViewTop` |  | `200` | = | UserFloat | view state, Live’s own |
| `/LiveSet/MainTrack/DeviceChain/FreezeSequencer` | AudioSequencer |  | = | Slot<SequencerDevice> | state |
| `/LiveSet/MainTrack/DeviceChain/FreezeSequencer/AudioSequencer` | LomId, LomIdView, IsExpanded, On, ModulationSourceCount, ParametersListWrapper, Pointee, LastSelectedTimeableIndex, LastSelectedClipEnvelopeIndex, LastPresetRef, LockedScripts, IsFolded, ShouldShowPresetName, UserName, Annotation, SourceContext, ClipSlotList, MonitoringEnum, KeepRecordMonitoringLatency, Sample, VolumeModulationTarget, TranspositionModulationTarget, TransientEnvelopeModulationTarget, GrainSizeModulationTarget, FluxModulationTarget, SampleOffsetModulationTarget, ComplexProFormantsModulationTarget, ComplexProEnvelopeModulationTarget, PitchViewScrollPosition, SampleOffsetModulationScrollPosition, Recorder |  | = | AudioSequencer | state |
| `/LiveSet/MainTrack/DeviceChain/FreezeSequencer/AudioSequencer/LomId` |  | `0` | = | Int | state |
| `/LiveSet/MainTrack/DeviceChain/FreezeSequencer/AudioSequencer/LomIdView` |  | `0` | = | Int | state |
| `/LiveSet/MainTrack/DeviceChain/FreezeSequencer/AudioSequencer/IsExpanded` |  | `true` | = | RemoteableBool | view state, Live’s own |
| `/LiveSet/MainTrack/DeviceChain/FreezeSequencer/AudioSequencer/On` | LomId, Manual, AutomationTarget, MidiCCOnOffThresholds |  | = | TimeableBool | state |
| `/LiveSet/MainTrack/DeviceChain/FreezeSequencer/AudioSequencer/On/LomId` |  | `0` | = | Int | state |
| `/LiveSet/MainTrack/DeviceChain/FreezeSequencer/AudioSequencer/On/Manual` |  | `true` | = | RemoteableBool | state |
| `/LiveSet/MainTrack/DeviceChain/FreezeSequencer/AudioSequencer/On/AutomationTarget` | LockEnvelope |  | = | BoolAutomationTarget | state |
| `/LiveSet/MainTrack/DeviceChain/FreezeSequencer/AudioSequencer/On/AutomationTarget/LockEnvelope` |  | `0` | = | RemoteableEnum | state |
| `/LiveSet/MainTrack/DeviceChain/FreezeSequencer/AudioSequencer/On/MidiCCOnOffThresholds` | Min, Max |  | = | MidiControllerRange | state |
| `/LiveSet/MainTrack/DeviceChain/FreezeSequencer/AudioSequencer/On/MidiCCOnOffThresholds/Min` |  | `64` | = | UserFloat | state |
| `/LiveSet/MainTrack/DeviceChain/FreezeSequencer/AudioSequencer/On/MidiCCOnOffThresholds/Max` |  | `127` | = | UserFloat | state |
| `/LiveSet/MainTrack/DeviceChain/FreezeSequencer/AudioSequencer/ModulationSourceCount` |  | `0` | = | RemoteableInt | state |
| `/LiveSet/MainTrack/DeviceChain/FreezeSequencer/AudioSequencer/ParametersListWrapper` |  |  | = | PythonListWrapper | state |
| `/LiveSet/MainTrack/DeviceChain/FreezeSequencer/AudioSequencer/Pointee` |  |  | = | Pointee | state |
| `/LiveSet/MainTrack/DeviceChain/FreezeSequencer/AudioSequencer/LastSelectedTimeableIndex` |  | `0` | = | Int | view state, Live’s own |
| `/LiveSet/MainTrack/DeviceChain/FreezeSequencer/AudioSequencer/LastSelectedClipEnvelopeIndex` |  | `0` | = | Int | view state, Live’s own |
| `/LiveSet/MainTrack/DeviceChain/FreezeSequencer/AudioSequencer/LastPresetRef` | Value |  | = | RemoteableSlot | state |
| `/LiveSet/MainTrack/DeviceChain/FreezeSequencer/AudioSequencer/LastPresetRef/Value` |  |  | = | Slot<Compound> | state |
| `/LiveSet/MainTrack/DeviceChain/FreezeSequencer/AudioSequencer/LockedScripts` |  |  | = | RemoteableList | state |
| `/LiveSet/MainTrack/DeviceChain/FreezeSequencer/AudioSequencer/IsFolded` |  | `false` | = | RemoteableBool | view state, Live’s own |
| `/LiveSet/MainTrack/DeviceChain/FreezeSequencer/AudioSequencer/ShouldShowPresetName` |  | `false` | = | RemoteableBool | view state, Live’s own |
| `/LiveSet/MainTrack/DeviceChain/FreezeSequencer/AudioSequencer/UserName` |  | `""` | = | RemoteableString | state |
| `/LiveSet/MainTrack/DeviceChain/FreezeSequencer/AudioSequencer/Annotation` |  | `""` | = | RemoteableString | state |
| `/LiveSet/MainTrack/DeviceChain/FreezeSequencer/AudioSequencer/SourceContext` | Value |  | = | RemoteableSlot | state |
| `/LiveSet/MainTrack/DeviceChain/FreezeSequencer/AudioSequencer/SourceContext/Value` |  |  | = | Slot<Compound> | state |
| `/LiveSet/MainTrack/DeviceChain/FreezeSequencer/AudioSequencer/ClipSlotList` |  |  | = | RemoteableList | state |
| `/LiveSet/MainTrack/DeviceChain/FreezeSequencer/AudioSequencer/MonitoringEnum` |  | `1` | = | RemoteableEnum | state |
| `/LiveSet/MainTrack/DeviceChain/FreezeSequencer/AudioSequencer/KeepRecordMonitoringLatency` |  | `true` | = | RemoteableBool | state |
| `/LiveSet/MainTrack/DeviceChain/FreezeSequencer/AudioSequencer/Sample` | ArrangerAutomation |  | = | TimeableSample | state |
| `/LiveSet/MainTrack/DeviceChain/FreezeSequencer/AudioSequencer/Sample/ArrangerAutomation` | Events, AutomationTransformViewState |  | = | ListAutomation | state |
| `/LiveSet/MainTrack/DeviceChain/FreezeSequencer/AudioSequencer/Sample/ArrangerAutomation/Events` |  |  | = | RemoteableList | state |
| `/LiveSet/MainTrack/DeviceChain/FreezeSequencer/AudioSequencer/Sample/ArrangerAutomation/AutomationTransformViewState` | IsTransformPending, TimeAndValueTransforms |  | = | AutomationTransformViewState | view state, Live’s own |
| `/LiveSet/MainTrack/DeviceChain/FreezeSequencer/AudioSequencer/Sample/ArrangerAutomation/AutomationTransformViewState/IsTransformPending` |  | `false` | = | RemoteableBool | view state, Live’s own |
| `/LiveSet/MainTrack/DeviceChain/FreezeSequencer/AudioSequencer/Sample/ArrangerAutomation/AutomationTransformViewState/TimeAndValueTransforms` |  |  | = | RemoteableList | view state, Live’s own |
| `/LiveSet/MainTrack/DeviceChain/FreezeSequencer/AudioSequencer/VolumeModulationTarget` | LockEnvelope |  | = | UserFloatModulationTarget | state |
| `/LiveSet/MainTrack/DeviceChain/FreezeSequencer/AudioSequencer/VolumeModulationTarget/LockEnvelope` |  | `0` | = | RemoteableEnum | state |
| `/LiveSet/MainTrack/DeviceChain/FreezeSequencer/AudioSequencer/TranspositionModulationTarget` | LockEnvelope |  | = | UserFloatModulationTarget | state |
| `/LiveSet/MainTrack/DeviceChain/FreezeSequencer/AudioSequencer/TranspositionModulationTarget/LockEnvelope` |  | `0` | = | RemoteableEnum | state |
| `/LiveSet/MainTrack/DeviceChain/FreezeSequencer/AudioSequencer/TransientEnvelopeModulationTarget` | LockEnvelope |  | = | UserFloatModulationTarget | state |
| `/LiveSet/MainTrack/DeviceChain/FreezeSequencer/AudioSequencer/TransientEnvelopeModulationTarget/LockEnvelope` |  | `0` | = | RemoteableEnum | state |
| `/LiveSet/MainTrack/DeviceChain/FreezeSequencer/AudioSequencer/GrainSizeModulationTarget` | LockEnvelope |  | = | UserFloatModulationTarget | state |
| `/LiveSet/MainTrack/DeviceChain/FreezeSequencer/AudioSequencer/GrainSizeModulationTarget/LockEnvelope` |  | `0` | = | RemoteableEnum | state |
| `/LiveSet/MainTrack/DeviceChain/FreezeSequencer/AudioSequencer/FluxModulationTarget` | LockEnvelope |  | = | UserFloatModulationTarget | state |
| `/LiveSet/MainTrack/DeviceChain/FreezeSequencer/AudioSequencer/FluxModulationTarget/LockEnvelope` |  | `0` | = | RemoteableEnum | state |
| `/LiveSet/MainTrack/DeviceChain/FreezeSequencer/AudioSequencer/SampleOffsetModulationTarget` | LockEnvelope |  | = | UserFloatModulationTarget | state |
| `/LiveSet/MainTrack/DeviceChain/FreezeSequencer/AudioSequencer/SampleOffsetModulationTarget/LockEnvelope` |  | `0` | = | RemoteableEnum | state |
| `/LiveSet/MainTrack/DeviceChain/FreezeSequencer/AudioSequencer/ComplexProFormantsModulationTarget` | LockEnvelope |  | = | UserFloatModulationTarget | state |
| `/LiveSet/MainTrack/DeviceChain/FreezeSequencer/AudioSequencer/ComplexProFormantsModulationTarget/LockEnvelope` |  | `0` | = | RemoteableEnum | state |
| `/LiveSet/MainTrack/DeviceChain/FreezeSequencer/AudioSequencer/ComplexProEnvelopeModulationTarget` | LockEnvelope |  | = | UserFloatModulationTarget | state |
| `/LiveSet/MainTrack/DeviceChain/FreezeSequencer/AudioSequencer/ComplexProEnvelopeModulationTarget/LockEnvelope` |  | `0` | = | RemoteableEnum | state |
| `/LiveSet/MainTrack/DeviceChain/FreezeSequencer/AudioSequencer/PitchViewScrollPosition` |  | `-1073741824` | = | RemoteableInt | state |
| `/LiveSet/MainTrack/DeviceChain/FreezeSequencer/AudioSequencer/SampleOffsetModulationScrollPosition` |  | `-1073741824` | = | RemoteableInt | view state, Live’s own |
| `/LiveSet/MainTrack/DeviceChain/FreezeSequencer/AudioSequencer/Recorder` | IsArmed, TakeCounter |  | = | AudioRecorder | state |
| `/LiveSet/MainTrack/DeviceChain/FreezeSequencer/AudioSequencer/Recorder/IsArmed` |  | `false` | = | RemoteableBool | state |
| `/LiveSet/MainTrack/DeviceChain/FreezeSequencer/AudioSequencer/Recorder/TakeCounter` |  | `42` | `0` | Int | state |
| `/LiveSet/MainTrack/DeviceChain/DeviceChain` | Devices, SignalModulations |  | = | AudioToAudioDeviceChain | state |
| `/LiveSet/MainTrack/DeviceChain/DeviceChain/Devices` |  |  | = | RemoteableList | state |
| `/LiveSet/MainTrack/DeviceChain/DeviceChain/SignalModulations` |  |  | = | RemoteableList | state |
| `/LiveSet/PreHearTrack` | LomId, LomIdView, IsContentSelectedInDocument, PreferredContentViewMode, TrackDelay, Name, Color, AutomationEnvelopes, TrackGroupId, TrackUnfolded, DevicesListWrapper, ClipSlotsListWrapper, ViewData, TakeLanes, LinkedTrackGroupId, DeviceChain |  | = | PreHearTrack | state |
| `/LiveSet/PreHearTrack/LomId` |  | `0` | = | Int | state |
| `/LiveSet/PreHearTrack/LomIdView` |  | `0` | = | Int | state |
| `/LiveSet/PreHearTrack/IsContentSelectedInDocument` |  | `false` | = | RemoteableBool | view state, Live’s own |
| `/LiveSet/PreHearTrack/PreferredContentViewMode` |  | `0` | = | RemoteableInt | view state, Live’s own |
| `/LiveSet/PreHearTrack/TrackDelay` | Value, IsValueSampleBased |  | = | TimeInSamplesOrMs | state |
| `/LiveSet/PreHearTrack/TrackDelay/Value` |  | `0` | = | UserFloat | state |
| `/LiveSet/PreHearTrack/TrackDelay/IsValueSampleBased` |  | `false` | = | RemoteableBool | state |
| `/LiveSet/PreHearTrack/Name` | EffectiveName, UserName, Annotation, MemorizedFirstClipName |  | = | DeviceChainContainerName | state |
| `/LiveSet/PreHearTrack/Name/EffectiveName` |  | `Master` | = | RemoteableString | state |
| `/LiveSet/PreHearTrack/Name/UserName` |  | `""` | = | RemoteableString | state |
| `/LiveSet/PreHearTrack/Name/Annotation` |  | `""` | = | RemoteableString | state |
| `/LiveSet/PreHearTrack/Name/MemorizedFirstClipName` |  | `""` | = | RemoteableString | state |
| `/LiveSet/PreHearTrack/Color` |  | `-1` | = | RemoteableDocumentColor | state |
| `/LiveSet/PreHearTrack/AutomationEnvelopes` | Envelopes |  | = | AutomationEnvelopes | state |
| `/LiveSet/PreHearTrack/AutomationEnvelopes/Envelopes` |  |  | = | RemoteableList | state |
| `/LiveSet/PreHearTrack/TrackGroupId` |  | `-1` | = | RemoteableInt | state |
| `/LiveSet/PreHearTrack/TrackUnfolded` |  | `false` | = | RemoteableBool | view state, Live’s own |
| `/LiveSet/PreHearTrack/DevicesListWrapper` |  |  | = | PythonListWrapper | state |
| `/LiveSet/PreHearTrack/ClipSlotsListWrapper` |  |  | = | PythonListWrapper | state |
| `/LiveSet/PreHearTrack/ViewData` |  | `{}` | = | RemoteableViewData | view state, Live’s own |
| `/LiveSet/PreHearTrack/TakeLanes` | TakeLanes, AreTakeLanesFolded |  | = | TakeLanes | state |
| `/LiveSet/PreHearTrack/TakeLanes/TakeLanes` |  |  | = | RemoteableList | state |
| `/LiveSet/PreHearTrack/TakeLanes/AreTakeLanesFolded` |  | `true` | = | RemoteableBool | view state, Live’s own |
| `/LiveSet/PreHearTrack/LinkedTrackGroupId` |  | `-1` | = | RemoteableInt | state |
| `/LiveSet/PreHearTrack/DeviceChain` | AutomationLanes, ClipEnvelopeChooserViewState, AudioInputRouting, MidiInputRouting, AudioOutputRouting, MidiOutputRouting, Mixer, DeviceChain |  | = | PreHearTrackDeviceChain | state |
| `/LiveSet/PreHearTrack/DeviceChain/AutomationLanes` | AutomationLanes, AreAdditionalAutomationLanesFolded |  | = | AutomationLanes | view state, Live’s own |
| `/LiveSet/PreHearTrack/DeviceChain/AutomationLanes/AutomationLanes` | AutomationLane |  | = | RemoteableList | view state, Live’s own |
| `/LiveSet/PreHearTrack/DeviceChain/AutomationLanes/AutomationLanes/AutomationLane` | SelectedDevice, SelectedEnvelope, IsContentSelectedInDocument, LaneHeight |  | = | AutomationLane | view state, Live’s own |
| `/LiveSet/PreHearTrack/DeviceChain/AutomationLanes/AutomationLanes/AutomationLane/SelectedDevice` |  | `0` | = | RemoteableEnum | view state, Live’s own |
| `/LiveSet/PreHearTrack/DeviceChain/AutomationLanes/AutomationLanes/AutomationLane/SelectedEnvelope` |  | `0` | = | RemoteableEnum | view state, Live’s own |
| `/LiveSet/PreHearTrack/DeviceChain/AutomationLanes/AutomationLanes/AutomationLane/IsContentSelectedInDocument` |  | `false` | = | RemoteableBool | view state, Live’s own |
| `/LiveSet/PreHearTrack/DeviceChain/AutomationLanes/AutomationLanes/AutomationLane/LaneHeight` |  | `85` | = | RemoteableInt | view state, Live’s own |
| `/LiveSet/PreHearTrack/DeviceChain/AutomationLanes/AreAdditionalAutomationLanesFolded` |  | `false` | = | RemoteableBool | view state, Live’s own |
| `/LiveSet/PreHearTrack/DeviceChain/ClipEnvelopeChooserViewState` | SelectedDevice, SelectedEnvelope, PreferModulationVisible |  | = | ClipEnvelopeChooserViewState | view state, Live’s own |
| `/LiveSet/PreHearTrack/DeviceChain/ClipEnvelopeChooserViewState/SelectedDevice` |  | `0` | = | RemoteableEnum | view state, Live’s own |
| `/LiveSet/PreHearTrack/DeviceChain/ClipEnvelopeChooserViewState/SelectedEnvelope` |  | `0` | = | RemoteableEnum | view state, Live’s own |
| `/LiveSet/PreHearTrack/DeviceChain/ClipEnvelopeChooserViewState/PreferModulationVisible` |  | `false` | = | RemoteableBool | view state, Live’s own |
| `/LiveSet/PreHearTrack/DeviceChain/AudioInputRouting` | Target, UpperDisplayString, LowerDisplayString, MpeSettings |  | = | Routable | state |
| `/LiveSet/PreHearTrack/DeviceChain/AudioInputRouting/Target` |  | `AudioIn/External/S0` | = | RemoteableString | state |
| `/LiveSet/PreHearTrack/DeviceChain/AudioInputRouting/UpperDisplayString` |  | `Ext. In` | = | RemoteableString | state |
| `/LiveSet/PreHearTrack/DeviceChain/AudioInputRouting/LowerDisplayString` |  | `1/2` | = | RemoteableString | state |
| `/LiveSet/PreHearTrack/DeviceChain/AudioInputRouting/MpeSettings` | ZoneType, FirstNoteChannel, LastNoteChannel |  | = | MpeSettings | state |
| `/LiveSet/PreHearTrack/DeviceChain/AudioInputRouting/MpeSettings/ZoneType` |  | `0` | = | RemoteableInt | state |
| `/LiveSet/PreHearTrack/DeviceChain/AudioInputRouting/MpeSettings/FirstNoteChannel` |  | `1` | = | RemoteableInt | state |
| `/LiveSet/PreHearTrack/DeviceChain/AudioInputRouting/MpeSettings/LastNoteChannel` |  | `15` | = | RemoteableInt | state |
| `/LiveSet/PreHearTrack/DeviceChain/MidiInputRouting` | Target, UpperDisplayString, LowerDisplayString, MpeSettings |  | = | Routable | state |
| `/LiveSet/PreHearTrack/DeviceChain/MidiInputRouting/Target` |  | `MidiIn/External.All/-1` | = | RemoteableString | state |
| `/LiveSet/PreHearTrack/DeviceChain/MidiInputRouting/UpperDisplayString` |  | `Ext: All Ins` | `All Ins` | RemoteableString | state |
| `/LiveSet/PreHearTrack/DeviceChain/MidiInputRouting/LowerDisplayString` |  | `""` | `All Channels` | RemoteableString | state |
| `/LiveSet/PreHearTrack/DeviceChain/MidiInputRouting/MpeSettings` | ZoneType, FirstNoteChannel, LastNoteChannel |  | = | MpeSettings | state |
| `/LiveSet/PreHearTrack/DeviceChain/MidiInputRouting/MpeSettings/ZoneType` |  | `0` | = | RemoteableInt | state |
| `/LiveSet/PreHearTrack/DeviceChain/MidiInputRouting/MpeSettings/FirstNoteChannel` |  | `1` | = | RemoteableInt | state |
| `/LiveSet/PreHearTrack/DeviceChain/MidiInputRouting/MpeSettings/LastNoteChannel` |  | `15` | = | RemoteableInt | state |
| `/LiveSet/PreHearTrack/DeviceChain/AudioOutputRouting` | Target, UpperDisplayString, LowerDisplayString, MpeSettings |  | = | Routable | state |
| `/LiveSet/PreHearTrack/DeviceChain/AudioOutputRouting/Target` |  | `AudioOut/External/S0` | = | RemoteableString | state |
| `/LiveSet/PreHearTrack/DeviceChain/AudioOutputRouting/UpperDisplayString` |  | `Ext. Out` | = | RemoteableString | state |
| `/LiveSet/PreHearTrack/DeviceChain/AudioOutputRouting/LowerDisplayString` |  | `1/2` | = | RemoteableString | state |
| `/LiveSet/PreHearTrack/DeviceChain/AudioOutputRouting/MpeSettings` | ZoneType, FirstNoteChannel, LastNoteChannel |  | = | MpeSettings | state |
| `/LiveSet/PreHearTrack/DeviceChain/AudioOutputRouting/MpeSettings/ZoneType` |  | `0` | = | RemoteableInt | state |
| `/LiveSet/PreHearTrack/DeviceChain/AudioOutputRouting/MpeSettings/FirstNoteChannel` |  | `1` | = | RemoteableInt | state |
| `/LiveSet/PreHearTrack/DeviceChain/AudioOutputRouting/MpeSettings/LastNoteChannel` |  | `15` | = | RemoteableInt | state |
| `/LiveSet/PreHearTrack/DeviceChain/MidiOutputRouting` | Target, UpperDisplayString, LowerDisplayString, MpeSettings |  | = | Routable | state |
| `/LiveSet/PreHearTrack/DeviceChain/MidiOutputRouting/Target` |  | `MidiOut/None` | = | RemoteableString | state |
| `/LiveSet/PreHearTrack/DeviceChain/MidiOutputRouting/UpperDisplayString` |  | `None` | = | RemoteableString | state |
| `/LiveSet/PreHearTrack/DeviceChain/MidiOutputRouting/LowerDisplayString` |  | `""` | = | RemoteableString | state |
| `/LiveSet/PreHearTrack/DeviceChain/MidiOutputRouting/MpeSettings` | ZoneType, FirstNoteChannel, LastNoteChannel |  | = | MpeSettings | state |
| `/LiveSet/PreHearTrack/DeviceChain/MidiOutputRouting/MpeSettings/ZoneType` |  | `0` | = | RemoteableInt | state |
| `/LiveSet/PreHearTrack/DeviceChain/MidiOutputRouting/MpeSettings/FirstNoteChannel` |  | `1` | = | RemoteableInt | state |
| `/LiveSet/PreHearTrack/DeviceChain/MidiOutputRouting/MpeSettings/LastNoteChannel` |  | `15` | = | RemoteableInt | state |
| `/LiveSet/PreHearTrack/DeviceChain/Mixer` | LomId, LomIdView, IsExpanded, On, ModulationSourceCount, ParametersListWrapper, Pointee, LastSelectedTimeableIndex, LastSelectedClipEnvelopeIndex, LastPresetRef, LockedScripts, IsFolded, ShouldShowPresetName, UserName, Annotation, SourceContext, Sends, Speaker, SoloSink, PanMode, Pan, SplitStereoPanL, SplitStereoPanR, Volume, ViewStateSesstionTrackWidth, CrossFadeState, SendsListWrapper |  | = | TrackDevice | state |
| `/LiveSet/PreHearTrack/DeviceChain/Mixer/LomId` |  | `0` | = | Int | state |
| `/LiveSet/PreHearTrack/DeviceChain/Mixer/LomIdView` |  | `0` | = | Int | state |
| `/LiveSet/PreHearTrack/DeviceChain/Mixer/IsExpanded` |  | `true` | = | RemoteableBool | view state, Live’s own |
| `/LiveSet/PreHearTrack/DeviceChain/Mixer/On` | LomId, Manual, AutomationTarget, MidiCCOnOffThresholds |  | = | TimeableBool | state |
| `/LiveSet/PreHearTrack/DeviceChain/Mixer/On/LomId` |  | `0` | = | Int | state |
| `/LiveSet/PreHearTrack/DeviceChain/Mixer/On/Manual` |  | `true` | = | RemoteableBool | state |
| `/LiveSet/PreHearTrack/DeviceChain/Mixer/On/AutomationTarget` | LockEnvelope |  | = | BoolAutomationTarget | state |
| `/LiveSet/PreHearTrack/DeviceChain/Mixer/On/AutomationTarget/LockEnvelope` |  | `0` | = | RemoteableEnum | state |
| `/LiveSet/PreHearTrack/DeviceChain/Mixer/On/MidiCCOnOffThresholds` | Min, Max |  | = | MidiControllerRange | state |
| `/LiveSet/PreHearTrack/DeviceChain/Mixer/On/MidiCCOnOffThresholds/Min` |  | `64` | = | UserFloat | state |
| `/LiveSet/PreHearTrack/DeviceChain/Mixer/On/MidiCCOnOffThresholds/Max` |  | `127` | = | UserFloat | state |
| `/LiveSet/PreHearTrack/DeviceChain/Mixer/ModulationSourceCount` |  | `0` | = | RemoteableInt | state |
| `/LiveSet/PreHearTrack/DeviceChain/Mixer/ParametersListWrapper` |  |  | = | PythonListWrapper | state |
| `/LiveSet/PreHearTrack/DeviceChain/Mixer/Pointee` |  |  | = | Pointee | state |
| `/LiveSet/PreHearTrack/DeviceChain/Mixer/LastSelectedTimeableIndex` |  | `0` | = | Int | view state, Live’s own |
| `/LiveSet/PreHearTrack/DeviceChain/Mixer/LastSelectedClipEnvelopeIndex` |  | `0` | = | Int | view state, Live’s own |
| `/LiveSet/PreHearTrack/DeviceChain/Mixer/LastPresetRef` | Value |  | = | RemoteableSlot | state |
| `/LiveSet/PreHearTrack/DeviceChain/Mixer/LastPresetRef/Value` |  |  | = | Slot<Compound> | state |
| `/LiveSet/PreHearTrack/DeviceChain/Mixer/LockedScripts` |  |  | = | RemoteableList | state |
| `/LiveSet/PreHearTrack/DeviceChain/Mixer/IsFolded` |  | `false` | = | RemoteableBool | view state, Live’s own |
| `/LiveSet/PreHearTrack/DeviceChain/Mixer/ShouldShowPresetName` |  | `false` | = | RemoteableBool | view state, Live’s own |
| `/LiveSet/PreHearTrack/DeviceChain/Mixer/UserName` |  | `""` | = | RemoteableString | state |
| `/LiveSet/PreHearTrack/DeviceChain/Mixer/Annotation` |  | `""` | = | RemoteableString | state |
| `/LiveSet/PreHearTrack/DeviceChain/Mixer/SourceContext` | Value |  | = | RemoteableSlot | state |
| `/LiveSet/PreHearTrack/DeviceChain/Mixer/SourceContext/Value` |  |  | = | Slot<Compound> | state |
| `/LiveSet/PreHearTrack/DeviceChain/Mixer/Sends` |  |  | = | RemoteableList | state |
| `/LiveSet/PreHearTrack/DeviceChain/Mixer/Speaker` | LomId, Manual, AutomationTarget, MidiCCOnOffThresholds |  | = | TimeableBool | state |
| `/LiveSet/PreHearTrack/DeviceChain/Mixer/Speaker/LomId` |  | `0` | = | Int | state |
| `/LiveSet/PreHearTrack/DeviceChain/Mixer/Speaker/Manual` |  | `true` | = | RemoteableBool | state |
| `/LiveSet/PreHearTrack/DeviceChain/Mixer/Speaker/AutomationTarget` | LockEnvelope |  | = | BoolAutomationTarget | state |
| `/LiveSet/PreHearTrack/DeviceChain/Mixer/Speaker/AutomationTarget/LockEnvelope` |  | `0` | = | RemoteableEnum | state |
| `/LiveSet/PreHearTrack/DeviceChain/Mixer/Speaker/MidiCCOnOffThresholds` | Min, Max |  | = | MidiControllerRange | state |
| `/LiveSet/PreHearTrack/DeviceChain/Mixer/Speaker/MidiCCOnOffThresholds/Min` |  | `64` | = | UserFloat | state |
| `/LiveSet/PreHearTrack/DeviceChain/Mixer/Speaker/MidiCCOnOffThresholds/Max` |  | `127` | = | UserFloat | state |
| `/LiveSet/PreHearTrack/DeviceChain/Mixer/SoloSink` |  | `false` | = | RemoteableBool | state |
| `/LiveSet/PreHearTrack/DeviceChain/Mixer/PanMode` |  | `0` | = | RemoteableEnum | state |
| `/LiveSet/PreHearTrack/DeviceChain/Mixer/Pan` | LomId, Manual, MidiControllerRange, AutomationTarget, ModulationTarget |  | = | TimeableFloat | state |
| `/LiveSet/PreHearTrack/DeviceChain/Mixer/Pan/LomId` |  | `0` | = | Int | state |
| `/LiveSet/PreHearTrack/DeviceChain/Mixer/Pan/Manual` |  | `0` | = | RemoteableFloat | state |
| `/LiveSet/PreHearTrack/DeviceChain/Mixer/Pan/MidiControllerRange` | Min, Max |  | = | MidiControllerRange | state |
| `/LiveSet/PreHearTrack/DeviceChain/Mixer/Pan/MidiControllerRange/Min` |  | `-1` | = | UserFloat | state |
| `/LiveSet/PreHearTrack/DeviceChain/Mixer/Pan/MidiControllerRange/Max` |  | `1` | = | UserFloat | state |
| `/LiveSet/PreHearTrack/DeviceChain/Mixer/Pan/AutomationTarget` | LockEnvelope |  | = | FloatAutomationTarget | state |
| `/LiveSet/PreHearTrack/DeviceChain/Mixer/Pan/AutomationTarget/LockEnvelope` |  | `0` | = | RemoteableEnum | state |
| `/LiveSet/PreHearTrack/DeviceChain/Mixer/Pan/ModulationTarget` | LockEnvelope |  | = | TimeableModulationTarget | state |
| `/LiveSet/PreHearTrack/DeviceChain/Mixer/Pan/ModulationTarget/LockEnvelope` |  | `0` | = | RemoteableEnum | state |
| `/LiveSet/PreHearTrack/DeviceChain/Mixer/SplitStereoPanL` | LomId, Manual, MidiControllerRange, AutomationTarget, ModulationTarget |  | = | TimeableFloat | state |
| `/LiveSet/PreHearTrack/DeviceChain/Mixer/SplitStereoPanL/LomId` |  | `0` | = | Int | state |
| `/LiveSet/PreHearTrack/DeviceChain/Mixer/SplitStereoPanL/Manual` |  | `-1` | = | RemoteableFloat | state |
| `/LiveSet/PreHearTrack/DeviceChain/Mixer/SplitStereoPanL/MidiControllerRange` | Min, Max |  | = | MidiControllerRange | state |
| `/LiveSet/PreHearTrack/DeviceChain/Mixer/SplitStereoPanL/MidiControllerRange/Min` |  | `-1` | = | UserFloat | state |
| `/LiveSet/PreHearTrack/DeviceChain/Mixer/SplitStereoPanL/MidiControllerRange/Max` |  | `1` | = | UserFloat | state |
| `/LiveSet/PreHearTrack/DeviceChain/Mixer/SplitStereoPanL/AutomationTarget` | LockEnvelope |  | = | FloatAutomationTarget | state |
| `/LiveSet/PreHearTrack/DeviceChain/Mixer/SplitStereoPanL/AutomationTarget/LockEnvelope` |  | `0` | = | RemoteableEnum | state |
| `/LiveSet/PreHearTrack/DeviceChain/Mixer/SplitStereoPanL/ModulationTarget` | LockEnvelope |  | = | TimeableModulationTarget | state |
| `/LiveSet/PreHearTrack/DeviceChain/Mixer/SplitStereoPanL/ModulationTarget/LockEnvelope` |  | `0` | = | RemoteableEnum | state |
| `/LiveSet/PreHearTrack/DeviceChain/Mixer/SplitStereoPanR` | LomId, Manual, MidiControllerRange, AutomationTarget, ModulationTarget |  | = | TimeableFloat | state |
| `/LiveSet/PreHearTrack/DeviceChain/Mixer/SplitStereoPanR/LomId` |  | `0` | = | Int | state |
| `/LiveSet/PreHearTrack/DeviceChain/Mixer/SplitStereoPanR/Manual` |  | `1` | = | RemoteableFloat | state |
| `/LiveSet/PreHearTrack/DeviceChain/Mixer/SplitStereoPanR/MidiControllerRange` | Min, Max |  | = | MidiControllerRange | state |
| `/LiveSet/PreHearTrack/DeviceChain/Mixer/SplitStereoPanR/MidiControllerRange/Min` |  | `-1` | = | UserFloat | state |
| `/LiveSet/PreHearTrack/DeviceChain/Mixer/SplitStereoPanR/MidiControllerRange/Max` |  | `1` | = | UserFloat | state |
| `/LiveSet/PreHearTrack/DeviceChain/Mixer/SplitStereoPanR/AutomationTarget` | LockEnvelope |  | = | FloatAutomationTarget | state |
| `/LiveSet/PreHearTrack/DeviceChain/Mixer/SplitStereoPanR/AutomationTarget/LockEnvelope` |  | `0` | = | RemoteableEnum | state |
| `/LiveSet/PreHearTrack/DeviceChain/Mixer/SplitStereoPanR/ModulationTarget` | LockEnvelope |  | = | TimeableModulationTarget | state |
| `/LiveSet/PreHearTrack/DeviceChain/Mixer/SplitStereoPanR/ModulationTarget/LockEnvelope` |  | `0` | = | RemoteableEnum | state |
| `/LiveSet/PreHearTrack/DeviceChain/Mixer/Volume` | LomId, Manual, MidiControllerRange, AutomationTarget, ModulationTarget |  | = | TimeableFloat | state |
| `/LiveSet/PreHearTrack/DeviceChain/Mixer/Volume/LomId` |  | `0` | = | Int | state |
| `/LiveSet/PreHearTrack/DeviceChain/Mixer/Volume/Manual` |  | `0.9120108485` | `1` | RemoteableFloat | state |
| `/LiveSet/PreHearTrack/DeviceChain/Mixer/Volume/MidiControllerRange` | Min, Max |  | = | MidiControllerRange | state |
| `/LiveSet/PreHearTrack/DeviceChain/Mixer/Volume/MidiControllerRange/Min` |  | `0.0003162277571` | = | UserFloat | state |
| `/LiveSet/PreHearTrack/DeviceChain/Mixer/Volume/MidiControllerRange/Max` |  | `1.99526238` | = | UserFloat | state |
| `/LiveSet/PreHearTrack/DeviceChain/Mixer/Volume/AutomationTarget` | LockEnvelope |  | = | FloatAutomationTarget | state |
| `/LiveSet/PreHearTrack/DeviceChain/Mixer/Volume/AutomationTarget/LockEnvelope` |  | `0` | = | RemoteableEnum | state |
| `/LiveSet/PreHearTrack/DeviceChain/Mixer/Volume/ModulationTarget` | LockEnvelope |  | = | TimeableModulationTarget | state |
| `/LiveSet/PreHearTrack/DeviceChain/Mixer/Volume/ModulationTarget/LockEnvelope` |  | `0` | = | RemoteableEnum | state |
| `/LiveSet/PreHearTrack/DeviceChain/Mixer/ViewStateSesstionTrackWidth` |  | `74` | `93` | RemoteableInt | view state, Live’s own |
| `/LiveSet/PreHearTrack/DeviceChain/Mixer/CrossFadeState` | LomId, Manual, AutomationTarget |  | = | TimeableEnum | state |
| `/LiveSet/PreHearTrack/DeviceChain/Mixer/CrossFadeState/LomId` |  | `0` | = | Int | state |
| `/LiveSet/PreHearTrack/DeviceChain/Mixer/CrossFadeState/Manual` |  | `1` | = | RemoteableEnum | state |
| `/LiveSet/PreHearTrack/DeviceChain/Mixer/CrossFadeState/AutomationTarget` | LockEnvelope |  | = | EnumAutomationTarget | state |
| `/LiveSet/PreHearTrack/DeviceChain/Mixer/CrossFadeState/AutomationTarget/LockEnvelope` |  | `0` | = | RemoteableEnum | state |
| `/LiveSet/PreHearTrack/DeviceChain/Mixer/SendsListWrapper` |  |  | = | PythonListWrapper | state |
| `/LiveSet/PreHearTrack/DeviceChain/DeviceChain` | Devices, SignalModulations |  | = | AudioToAudioDeviceChain | state |
| `/LiveSet/PreHearTrack/DeviceChain/DeviceChain/Devices` |  |  | = | RemoteableList | state |
| `/LiveSet/PreHearTrack/DeviceChain/DeviceChain/SignalModulations` |  |  | = | RemoteableList | state |
| `/LiveSet/SendsPre` | SendPreBool |  | = | RemoteableList | state |
| `/LiveSet/SendsPre/SendPreBool` |  | `false` | = | SendPreBool | state |
| `/LiveSet/Scenes` | Scene |  | = | RemoteableList | state |
| `/LiveSet/Scenes/Scene` | FollowAction, Name, Annotation, Color, Tempo, IsTempoEnabled, TimeSignatureId, IsTimeSignatureEnabled, LomId, ClipSlotsListWrapper |  | = | Scene | state |
| `/LiveSet/Scenes/Scene/FollowAction` | FollowTime, IsLinked, LoopIterations, FollowActionA, FollowActionB, FollowChanceA, FollowChanceB, JumpIndexA, JumpIndexB, FollowActionEnabled |  | = | FollowAction | state |
| `/LiveSet/Scenes/Scene/FollowAction/FollowTime` |  | `4` | = | RemoteableDouble | state |
| `/LiveSet/Scenes/Scene/FollowAction/IsLinked` |  | `true` | = | RemoteableBool | state |
| `/LiveSet/Scenes/Scene/FollowAction/LoopIterations` |  | `1` | = | RangedRemoteableInt | state |
| `/LiveSet/Scenes/Scene/FollowAction/FollowActionA` |  | `4` | = | RemoteableEnum | state |
| `/LiveSet/Scenes/Scene/FollowAction/FollowActionB` |  | `0` | = | RemoteableEnum | state |
| `/LiveSet/Scenes/Scene/FollowAction/FollowChanceA` |  | `100` | = | UserFloat | state |
| `/LiveSet/Scenes/Scene/FollowAction/FollowChanceB` |  | `0` | = | UserFloat | state |
| `/LiveSet/Scenes/Scene/FollowAction/JumpIndexA` |  | `0` | = | UserFloat | state |
| `/LiveSet/Scenes/Scene/FollowAction/JumpIndexB` |  | `0` | = | UserFloat | state |
| `/LiveSet/Scenes/Scene/FollowAction/FollowActionEnabled` |  | `false` | = | RemoteableBool | state |
| `/LiveSet/Scenes/Scene/Name` |  | `""` | = | RemoteableString | state |
| `/LiveSet/Scenes/Scene/Annotation` |  | `""` | = | RemoteableString | state |
| `/LiveSet/Scenes/Scene/Color` |  | `-1` | = | RemoteableDocumentColor | state |
| `/LiveSet/Scenes/Scene/Tempo` |  | `120` | = | UserFloat | state |
| `/LiveSet/Scenes/Scene/IsTempoEnabled` |  | `false` | = | RemoteableBool | state |
| `/LiveSet/Scenes/Scene/TimeSignatureId` |  | `201` | = | RemoteableInt | state |
| `/LiveSet/Scenes/Scene/IsTimeSignatureEnabled` |  | `false` | = | RemoteableBool | state |
| `/LiveSet/Scenes/Scene/LomId` |  | `0` | = | Int | state |
| `/LiveSet/Scenes/Scene/ClipSlotsListWrapper` |  |  | = | PythonListWrapper | state |
| `/LiveSet/Transport` | PhaseNudgeTempo, LoopOn, LoopStart, LoopLength, LoopIsSongStart, CurrentTime, PunchIn, PunchOut, MetronomeTickDuration, DrawMode |  | = | Transport | state |
| `/LiveSet/Transport/PhaseNudgeTempo` |  | `10` | = | UserFloat | state |
| `/LiveSet/Transport/LoopOn` |  | `true` | `false` | LoopOn | state |
| `/LiveSet/Transport/LoopStart` |  | `0` | = | LoopStart | state |
| `/LiveSet/Transport/LoopLength` |  | `512` | `16` | LoopLength | state |
| `/LiveSet/Transport/LoopIsSongStart` |  | `false` | = | RemoteableBool | state |
| `/LiveSet/Transport/CurrentTime` |  | `0` | = | CurrentTime | state |
| `/LiveSet/Transport/PunchIn` |  | `false` | = | RemoteableBool | state |
| `/LiveSet/Transport/PunchOut` |  | `false` | = | RemoteableBool | state |
| `/LiveSet/Transport/MetronomeTickDuration` |  | `0` | = | RemoteableFloat | state |
| `/LiveSet/Transport/DrawMode` |  | `false` | = | RemoteableBool | view state, Live’s own |
| `/LiveSet/SessionScrollPos` |  |  | = | RemoteablePoint | view state, Live’s own |
| `/LiveSet/SignalModulations` |  |  | = | RemoteableList | state |
| `/LiveSet/GlobalQuantisation` |  | `4` | = | RemoteableEnum | state |
| `/LiveSet/AutoQuantisation` |  | `0` | = | RemoteableEnum | state |
| `/LiveSet/Grid` | FixedNumerator, FixedDenominator, GridIntervalPixel, Ntoles, SnapToGrid, Fixed |  | = | BeatGrid | state |
| `/LiveSet/Grid/FixedNumerator` |  | `1` | = | Int | state |
| `/LiveSet/Grid/FixedDenominator` |  | `16` | = | Int | state |
| `/LiveSet/Grid/GridIntervalPixel` |  | `20` | = | Int | view state, Live’s own |
| `/LiveSet/Grid/Ntoles` |  | `2` | = | Int | state |
| `/LiveSet/Grid/SnapToGrid` |  | `true` | = | RemoteableBool | state |
| `/LiveSet/Grid/Fixed` |  | `false` | = | RemoteableBool | state |
| `/LiveSet/ScaleInformation` | RootNote, Name |  | = | ScaleInformation | state |
| `/LiveSet/ScaleInformation/RootNote` |  | `0` | = | RemoteableInt | state |
| `/LiveSet/ScaleInformation/Name` |  | `Major` | = | RemoteableString | state |
| `/LiveSet/InKey` |  | `true` | `false` | RemoteableBool | state |
| `/LiveSet/SmpteFormat` |  | `0` | = | RemoteableEnum | state |
| `/LiveSet/TimeSelection` | AnchorTime, OtherTime |  | = | TimeSelection | view state, Live’s own |
| `/LiveSet/TimeSelection/AnchorTime` |  | `512` | `0` | Double | view state, Live’s own |
| `/LiveSet/TimeSelection/OtherTime` |  | `0` | = | Double | view state, Live’s own |
| `/LiveSet/SequencerNavigator` | BeatTimeHelper, ScrollerPos, ClientSize |  | = | SequencerNavigator | view state, Live’s own |
| `/LiveSet/SequencerNavigator/BeatTimeHelper` | CurrentZoom |  | = | BeatTimeViewPosConverter | view state, Live’s own |
| `/LiveSet/SequencerNavigator/BeatTimeHelper/CurrentZoom` |  | `3.0113798777668372` | `1` | Double | view state, Live’s own |
| `/LiveSet/SequencerNavigator/ScrollerPos` |  |  | = | RemoteablePoint | view state, Live’s own |
| `/LiveSet/SequencerNavigator/ClientSize` |  |  | = | RemoteablePoint | view state, Live’s own |
| `/LiveSet/IsContentSplitterOpen` |  | `true` | = | RemoteableBool | view state, Live’s own |
| `/LiveSet/IsExpressionSplitterOpen` |  | `true` | = | RemoteableBool | view state, Live’s own |
| `/LiveSet/ExpressionLanes` | MidiEditorLaneModel |  | = | RemoteableList | view state, Live’s own |
| `/LiveSet/ExpressionLanes/MidiEditorLaneModel` | Type, Size, IsMinimized |  | = | MidiEditorLaneModel | view state, Live’s own |
| `/LiveSet/ExpressionLanes/MidiEditorLaneModel/Type` |  | `0` · `1` · `2` · `3` | = | Int | view state, Live’s own |
| `/LiveSet/ExpressionLanes/MidiEditorLaneModel/Size` |  | `41` | = | RemoteableInt | view state, Live’s own |
| `/LiveSet/ExpressionLanes/MidiEditorLaneModel/IsMinimized` |  | `false` · `true` | = | RemoteableBool | view state, Live’s own |
| `/LiveSet/ContentLanes` | MidiEditorLaneModel |  | = | RemoteableList | view state, Live’s own |
| `/LiveSet/ContentLanes/MidiEditorLaneModel` | Type, Size, IsMinimized |  | = | MidiEditorLaneModel | view state, Live’s own |
| `/LiveSet/ContentLanes/MidiEditorLaneModel/Type` |  | `4` · `5` | = | Int | view state, Live’s own |
| `/LiveSet/ContentLanes/MidiEditorLaneModel/Size` |  | `41` · `25` | = | RemoteableInt | view state, Live’s own |
| `/LiveSet/ContentLanes/MidiEditorLaneModel/IsMinimized` |  | `false` · `true` | = | RemoteableBool | view state, Live’s own |
| `/LiveSet/ViewStateFxSlotCount` |  | `4` | = | RemoteableInt | view state, Live’s own |
| `/LiveSet/ViewStateSessionMixerHeight` |  | `120` | = | RemoteableInt | view state, Live’s own |
| `/LiveSet/ViewStateArrangerMixerVolumeSectionHeight` |  | `120` | = | RemoteableInt | view state, Live’s own |
| `/LiveSet/ShouldSceneTempoAndTimeSignatureBeVisible` |  | `false` | = | RemoteableBool | view state, Live’s own |
| `/LiveSet/WaveformVerticalZoomFactor` |  | `1` | = | UserFloat | view state, Live’s own |
| `/LiveSet/IsWaveformVerticalZoomActive` |  | `true` | = | RemoteableBool | view state, Live’s own |
| `/LiveSet/Locators` | Locators |  | = | CuePointManager | state |
| `/LiveSet/Locators/Locators` |  |  | = | RemoteableList | state |
| `/LiveSet/DetailClipKeyMidis` |  |  | = | DetailClipKeyMidis | view state, Live’s own |
| `/LiveSet/TracksListWrapper` |  |  | = | PythonListWrapper | state |
| `/LiveSet/VisibleTracksListWrapper` |  |  | = | PythonListWrapper | state |
| `/LiveSet/ReturnTracksListWrapper` |  |  | = | PythonListWrapper | state |
| `/LiveSet/ScenesListWrapper` |  |  | = | PythonListWrapper | state |
| `/LiveSet/CuePointsListWrapper` |  |  | = | PythonListWrapper | state |
| `/LiveSet/ChooserBar` |  | `0` | = | RemoteableInt | view state, Live’s own |
| `/LiveSet/Annotation` |  | `""` | = | RemoteableString | state |
| `/LiveSet/SoloOrPflSavedValue` |  | `true` | = | Bool | state |
| `/LiveSet/SoloInPlace` |  | `true` | = | RemoteableBool | state |
| `/LiveSet/CrossfadeCurve` |  | `2` | = | RemoteableEnum | state |
| `/LiveSet/LatencyCompensation` |  | `2` | = | RemoteableEnum | state |
| `/LiveSet/HighlightedTrackIndex` |  | `12` | `0` | RemoteableInt | view state, Live’s own |
| `/LiveSet/GroovePool` | LomId, Grooves |  | = | GroovePool | state |
| `/LiveSet/GroovePool/LomId` |  | `0` | = | Int | state |
| `/LiveSet/GroovePool/Grooves` |  |  | = | RemoteableList | state |
| `/LiveSet/AutomationMode` |  | `true` | `false` | RemoteableBool | state |
| `/LiveSet/SnapAutomationToGrid` |  | `true` | = | RemoteableBool | state |
| `/LiveSet/ArrangementOverdub` |  | `false` | = | RemoteableBool | state |
| `/LiveSet/ColorSequenceIndex` |  | `1641970612` | `0` | RemoteableInt | state |
| `/LiveSet/AutoColorPickerForPlayerAndGroupTracks` | NextColorIndex |  | = | AutoColorPicker | state |
| `/LiveSet/AutoColorPickerForPlayerAndGroupTracks/NextColorIndex` |  | `10` | `11` | RemoteableInt | state |
| `/LiveSet/AutoColorPickerForReturnAndMainTracks` | NextColorIndex |  | = | AutoColorPicker | state |
| `/LiveSet/AutoColorPickerForReturnAndMainTracks/NextColorIndex` |  | `0` | = | RemoteableInt | state |
| `/LiveSet/ViewData` |  | `{}` | = | RemoteableViewData | view state, Live’s own |
| `/LiveSet/ResetNonautomatedMidiControllersOnClipStarts` |  | `true` | = | RemoteableBool | state |
| `/LiveSet/MidiFoldIn` |  | `false` | = | RemoteableBool | view state, Live’s own |
| `/LiveSet/MidiFoldMode` |  | `-99` | `0` | RemoteableEnum | view state, Live’s own |
| `/LiveSet/MultiClipFocusMode` |  | `false` | = | RemoteableBool | view state, Live’s own |
| `/LiveSet/MultiClipLoopBarHeight` |  | `0` | = | RemoteableInt | view state, Live’s own |
| `/LiveSet/MidiPrelisten` |  | `true` | `false` | RemoteableBool | state |
| `/LiveSet/LinkedTrackGroups` |  |  | = | RemoteableList | state |
| `/LiveSet/NoteSpellingPreference` |  | `0` | = | RangedRemoteableInt | state |
| `/LiveSet/AccidentalSpellingPreference` |  | `3` | = | RemoteableEnum | state |
| `/LiveSet/PreferFlatRootNote` |  | `false` | = | RemoteableBool | state |
| `/LiveSet/UseWarperLegacyHiQMode` |  | `false` | = | RemoteableBool | state |
| `/LiveSet/VideoWindowRect` |  |  | = | Rect | view state, Live’s own |
| `/LiveSet/ShowVideoWindow` |  | `true` | = | Bool | view state, Live’s own |
| `/LiveSet/TuningSystems` |  |  | = | RemoteableList | state |
| `/LiveSet/TrackHeaderWidth` |  | `93` | = | RemoteableInt | view state, Live’s own |
| `/LiveSet/ViewStateMainWindowClipDetailOpen` |  | `false` | = | RemoteableBool | view state, Live’s own |
| `/LiveSet/ViewStateMainWindowHiddenOtherDocViewTypeClipDetailOpen` |  | `false` | = | RemoteableBool | view state, Live’s own |
| `/LiveSet/ViewStateMainWindowHiddenOtherDocViewTypeDeviceDetailOpen` |  | `true` | = | RemoteableBool | view state, Live’s own |
| `/LiveSet/ViewStateMainWindowDeviceDetailOpen` |  | `true` | = | RemoteableBool | view state, Live’s own |
| `/LiveSet/ViewStateSecondWindowClipDetailOpen` |  | `false` | = | RemoteableBool | view state, Live’s own |
| `/LiveSet/ViewStateSecondWindowDeviceDetailOpen` |  | `false` | = | RemoteableBool | view state, Live’s own |
| `/LiveSet/ViewStates` | MixerInArrangement, ArrangerMixerIO, ArrangerMixerSends, ArrangerMixerReturns, ArrangerMixerVolume, ArrangerMixerTrackOptions, ArrangerMixerCrossFade, ArrangerMixerTrackPerformanceImpactMeter, MixerInSession, SessionIO, SessionSends, SessionReturns, SessionVolume, SessionTrackOptions, SessionCrossFade, SessionTrackPerformanceImpactMeter, SessionShowOverView, ArrangerIO, ArrangerReturns, ArrangerVolume, ArrangerTrackOptions, ArrangerShowOverView |  | = | LiveDocumentViewStates | view state, Live’s own |
| `/LiveSet/ViewStates/MixerInArrangement` |  | `0` | = | Int | view state, Live’s own |
| `/LiveSet/ViewStates/ArrangerMixerIO` |  | `1` | = | Int | view state, Live’s own |
| `/LiveSet/ViewStates/ArrangerMixerSends` |  | `1` | = | Int | view state, Live’s own |
| `/LiveSet/ViewStates/ArrangerMixerReturns` |  | `1` | = | Int | view state, Live’s own |
| `/LiveSet/ViewStates/ArrangerMixerVolume` |  | `1` | = | Int | view state, Live’s own |
| `/LiveSet/ViewStates/ArrangerMixerTrackOptions` |  | `0` | = | Int | view state, Live’s own |
| `/LiveSet/ViewStates/ArrangerMixerCrossFade` |  | `0` | = | Int | view state, Live’s own |
| `/LiveSet/ViewStates/ArrangerMixerTrackPerformanceImpactMeter` |  | `0` | = | Int | view state, Live’s own |
| `/LiveSet/ViewStates/MixerInSession` |  | `1` | = | Int | view state, Live’s own |
| `/LiveSet/ViewStates/SessionIO` |  | `1` | = | Int | view state, Live’s own |
| `/LiveSet/ViewStates/SessionSends` |  | `1` | = | Int | view state, Live’s own |
| `/LiveSet/ViewStates/SessionReturns` |  | `1` | = | Int | view state, Live’s own |
| `/LiveSet/ViewStates/SessionVolume` |  | `1` | = | Int | view state, Live’s own |
| `/LiveSet/ViewStates/SessionTrackOptions` |  | `0` | = | Int | view state, Live’s own |
| `/LiveSet/ViewStates/SessionCrossFade` |  | `0` | = | Int | view state, Live’s own |
| `/LiveSet/ViewStates/SessionTrackPerformanceImpactMeter` |  | `0` | = | Int | view state, Live’s own |
| `/LiveSet/ViewStates/SessionShowOverView` |  | `0` | = | Int | view state, Live’s own |
| `/LiveSet/ViewStates/ArrangerIO` |  | `1` | = | Int | view state, Live’s own |
| `/LiveSet/ViewStates/ArrangerReturns` |  | `1` | = | Int | view state, Live’s own |
| `/LiveSet/ViewStates/ArrangerVolume` |  | `1` | = | Int | view state, Live’s own |
| `/LiveSet/ViewStates/ArrangerTrackOptions` |  | `0` | = | Int | view state, Live’s own |
| `/LiveSet/ViewStates/ArrangerShowOverView` |  | `1` | = | Int | view state, Live’s own |
| `/LiveSet/NoteAlgorithms` | ArpeggiateAlgorithm, SpanAlgorithm, ConnectAlgorithm, OrnamentAlgorithm, RecombineAlgorithm, QuantizeAlgorithm, StrumAlgorithm, TimeWarpAlgorithm, RhythmAlgorithm, StacksAlgorithm, ShapeAlgorithm, SeedAlgorithm |  | = | RemoteableList | state |
| `/LiveSet/NoteAlgorithms/ArpeggiateAlgorithm` | Rate, Steps, Distance, Gate, Style |  | = | ArpeggiateAlgorithm | state |
| `/LiveSet/NoteAlgorithms/ArpeggiateAlgorithm/Rate` |  | `10` | = | RemoteableEnum | state |
| `/LiveSet/NoteAlgorithms/ArpeggiateAlgorithm/Steps` |  | `2` | = | RangedRemoteableInt | state |
| `/LiveSet/NoteAlgorithms/ArpeggiateAlgorithm/Distance` |  | `12` | = | RangedRemoteableInt | state |
| `/LiveSet/NoteAlgorithms/ArpeggiateAlgorithm/Gate` |  | `1` | = | UserFloat | state |
| `/LiveSet/NoteAlgorithms/ArpeggiateAlgorithm/Style` |  | `0` | = | RemoteableEnum | state |
| `/LiveSet/NoteAlgorithms/SpanAlgorithm` | Mode, ChordThreshold, LengthVariation, LengthOffset, FixedLength |  | = | SpanAlgorithm | state |
| `/LiveSet/NoteAlgorithms/SpanAlgorithm/Mode` |  | `1` | = | RemoteableEnum | state |
| `/LiveSet/NoteAlgorithms/SpanAlgorithm/ChordThreshold` |  | `10` | = | RemoteableEnum | state |
| `/LiveSet/NoteAlgorithms/SpanAlgorithm/LengthVariation` |  | `0` | = | UserFloat | state |
| `/LiveSet/NoteAlgorithms/SpanAlgorithm/LengthOffset` |  | `0` | = | UserFloat | state |
| `/LiveSet/NoteAlgorithms/SpanAlgorithm/FixedLength` |  | `0` | = | RemoteableEnum | state |
| `/LiveSet/NoteAlgorithms/ConnectAlgorithm` | Tie, Density, Spread, Rate |  | = | ConnectAlgorithm | state |
| `/LiveSet/NoteAlgorithms/ConnectAlgorithm/Tie` |  | `0` | = | UserFloat | state |
| `/LiveSet/NoteAlgorithms/ConnectAlgorithm/Density` |  | `1` | = | UserFloat | state |
| `/LiveSet/NoteAlgorithms/ConnectAlgorithm/Spread` |  | `0` | = | RangedRemoteableInt | state |
| `/LiveSet/NoteAlgorithms/ConnectAlgorithm/Rate` |  | `0` | = | RemoteableEnum | state |
| `/LiveSet/NoteAlgorithms/OrnamentAlgorithm` | FlamEnabled, FlamPosition, FlamVelocity, GraceNotesEnabled, GraceNotesChance, GraceNotesVelocity, GraceNotesPosition, GraceNotesAmount, GraceNotesPitch |  | = | OrnamentAlgorithm | state |
| `/LiveSet/NoteAlgorithms/OrnamentAlgorithm/FlamEnabled` |  | `true` | = | RemoteableBool | state |
| `/LiveSet/NoteAlgorithms/OrnamentAlgorithm/FlamPosition` |  | `-0.200000003` | = | UserFloat | state |
| `/LiveSet/NoteAlgorithms/OrnamentAlgorithm/FlamVelocity` |  | `0.5` | = | UserFloat | state |
| `/LiveSet/NoteAlgorithms/OrnamentAlgorithm/GraceNotesEnabled` |  | `false` | = | RemoteableBool | state |
| `/LiveSet/NoteAlgorithms/OrnamentAlgorithm/GraceNotesChance` |  | `1` | = | UserFloat | state |
| `/LiveSet/NoteAlgorithms/OrnamentAlgorithm/GraceNotesVelocity` |  | `0.5` | = | UserFloat | state |
| `/LiveSet/NoteAlgorithms/OrnamentAlgorithm/GraceNotesPosition` |  | `-0.200000003` | = | UserFloat | state |
| `/LiveSet/NoteAlgorithms/OrnamentAlgorithm/GraceNotesAmount` |  | `3` | = | RangedRemoteableInt | state |
| `/LiveSet/NoteAlgorithms/OrnamentAlgorithm/GraceNotesPitch` |  | `1` | = | RemoteableEnum | state |
| `/LiveSet/NoteAlgorithms/RecombineAlgorithm` | PermutePitches, PermuteDurations, PermuteVelocities, Shuffle, Mirror, RotateAmount |  | = | RecombineAlgorithm | state |
| `/LiveSet/NoteAlgorithms/RecombineAlgorithm/PermutePitches` |  | `true` | = | RemoteableBool | state |
| `/LiveSet/NoteAlgorithms/RecombineAlgorithm/PermuteDurations` |  | `true` | = | RemoteableBool | state |
| `/LiveSet/NoteAlgorithms/RecombineAlgorithm/PermuteVelocities` |  | `true` | = | RemoteableBool | state |
| `/LiveSet/NoteAlgorithms/RecombineAlgorithm/Shuffle` |  | `false` | = | RemoteableBool | state |
| `/LiveSet/NoteAlgorithms/RecombineAlgorithm/Mirror` |  | `false` | = | RemoteableBool | state |
| `/LiveSet/NoteAlgorithms/RecombineAlgorithm/RotateAmount` |  | `0` | = | RangedRemoteableInt | state |
| `/LiveSet/NoteAlgorithms/QuantizeAlgorithm` | Reference, TripletReference, QuantizeNoteStarts, QuantizeNoteEnds, Amount |  | = | QuantizeAlgorithm | state |
| `/LiveSet/NoteAlgorithms/QuantizeAlgorithm/Reference` |  | `0` | = | RemoteableEnum | state |
| `/LiveSet/NoteAlgorithms/QuantizeAlgorithm/TripletReference` |  | `false` | = | RemoteableBool | state |
| `/LiveSet/NoteAlgorithms/QuantizeAlgorithm/QuantizeNoteStarts` |  | `true` | = | RemoteableBool | state |
| `/LiveSet/NoteAlgorithms/QuantizeAlgorithm/QuantizeNoteEnds` |  | `false` | = | RemoteableBool | state |
| `/LiveSet/NoteAlgorithms/QuantizeAlgorithm/Amount` |  | `100` | = | UserFloat | state |
| `/LiveSet/NoteAlgorithms/StrumAlgorithm` | ChordThreshold, StrumLow, StrumHigh, TensionAmount |  | = | StrumAlgorithm | state |
| `/LiveSet/NoteAlgorithms/StrumAlgorithm/ChordThreshold` |  | `0` | = | RemoteableEnum | state |
| `/LiveSet/NoteAlgorithms/StrumAlgorithm/StrumLow` |  | `0` | = | UserFloat | state |
| `/LiveSet/NoteAlgorithms/StrumAlgorithm/StrumHigh` |  | `0` | = | UserFloat | state |
| `/LiveSet/NoteAlgorithms/StrumAlgorithm/TensionAmount` |  | `0` | = | UserFloat | state |
| `/LiveSet/NoteAlgorithms/TimeWarpAlgorithm` | Breakpoints, StretchNoteEnd, PreserveTimeRange, Quantize |  | = | TimeWarpAlgorithm | state |
| `/LiveSet/NoteAlgorithms/TimeWarpAlgorithm/Breakpoints` | Breakpoint |  | = | RemoteableList | state |
| `/LiveSet/NoteAlgorithms/TimeWarpAlgorithm/Breakpoints/Breakpoint` | Value, Time, Control1X, Control1Y, Control2X, Control2Y, IsActive |  | = | Breakpoint | state |
| `/LiveSet/NoteAlgorithms/TimeWarpAlgorithm/Breakpoints/Breakpoint/Value` |  | `0.5` | = | RemoteableDouble | state |
| `/LiveSet/NoteAlgorithms/TimeWarpAlgorithm/Breakpoints/Breakpoint/Time` |  | `0` · `0.5` · `1` | = | RemoteableDouble | state |
| `/LiveSet/NoteAlgorithms/TimeWarpAlgorithm/Breakpoints/Breakpoint/Control1X` |  | `0.5` | = | RemoteableDouble | state |
| `/LiveSet/NoteAlgorithms/TimeWarpAlgorithm/Breakpoints/Breakpoint/Control1Y` |  | `0.5` | = | RemoteableDouble | state |
| `/LiveSet/NoteAlgorithms/TimeWarpAlgorithm/Breakpoints/Breakpoint/Control2X` |  | `0.5` | = | RemoteableDouble | state |
| `/LiveSet/NoteAlgorithms/TimeWarpAlgorithm/Breakpoints/Breakpoint/Control2Y` |  | `0.5` | = | RemoteableDouble | state |
| `/LiveSet/NoteAlgorithms/TimeWarpAlgorithm/Breakpoints/Breakpoint/IsActive` |  | `true` · `false` | = | RemoteableBool | state |
| `/LiveSet/NoteAlgorithms/TimeWarpAlgorithm/StretchNoteEnd` |  | `true` | = | RemoteableBool | state |
| `/LiveSet/NoteAlgorithms/TimeWarpAlgorithm/PreserveTimeRange` |  | `true` | = | RemoteableBool | state |
| `/LiveSet/NoteAlgorithms/TimeWarpAlgorithm/Quantize` |  | `false` | = | RemoteableBool | state |
| `/LiveSet/NoteAlgorithms/RhythmAlgorithm` | Density, Repetitions, Pattern, PatternLength, Pitch, Velocity, Accent, Period, Offset, Shift, StepDuration, Split |  | = | RhythmAlgorithm | state |
| `/LiveSet/NoteAlgorithms/RhythmAlgorithm/Density` |  | `4` | = | UserFloat | state |
| `/LiveSet/NoteAlgorithms/RhythmAlgorithm/Repetitions` |  | `1` | = | RangedRemoteableInt | state |
| `/LiveSet/NoteAlgorithms/RhythmAlgorithm/Pattern` |  | `14` | = | UserFloat | state |
| `/LiveSet/NoteAlgorithms/RhythmAlgorithm/PatternLength` |  | `8` | = | UserFloat | state |
| `/LiveSet/NoteAlgorithms/RhythmAlgorithm/Pitch` |  | `36` | = | RemoteableEnum | state |
| `/LiveSet/NoteAlgorithms/RhythmAlgorithm/Velocity` |  | `100` | = | UserFloat | state |
| `/LiveSet/NoteAlgorithms/RhythmAlgorithm/Accent` |  | `127` | = | UserFloat | state |
| `/LiveSet/NoteAlgorithms/RhythmAlgorithm/Period` |  | `4` | = | RangedRemoteableInt | state |
| `/LiveSet/NoteAlgorithms/RhythmAlgorithm/Offset` |  | `0` | = | RangedRemoteableInt | state |
| `/LiveSet/NoteAlgorithms/RhythmAlgorithm/Shift` |  | `0` | = | RangedRemoteableInt | state |
| `/LiveSet/NoteAlgorithms/RhythmAlgorithm/StepDuration` |  | `7` | = | RemoteableEnum | state |
| `/LiveSet/NoteAlgorithms/RhythmAlgorithm/Split` |  | `0` | = | UserFloat | state |
| `/LiveSet/NoteAlgorithms/StacksAlgorithm` | Sequence |  | = | StacksAlgorithm | state |
| `/LiveSet/NoteAlgorithms/StacksAlgorithm/Sequence` | Chord |  | = | RemoteableList | state |
| `/LiveSet/NoteAlgorithms/StacksAlgorithm/Sequence/Chord` | RootDegree, Octave, RootPitch, Inversion, RuleNumber, Duration, Offset |  | = | Chord | state |
| `/LiveSet/NoteAlgorithms/StacksAlgorithm/Sequence/Chord/RootDegree` |  | `0` | = | RangedRemoteableInt | state |
| `/LiveSet/NoteAlgorithms/StacksAlgorithm/Sequence/Chord/Octave` |  | `3` | = | RangedRemoteableInt | state |
| `/LiveSet/NoteAlgorithms/StacksAlgorithm/Sequence/Chord/RootPitch` |  | `60` | = | RemoteableEnum | state |
| `/LiveSet/NoteAlgorithms/StacksAlgorithm/Sequence/Chord/Inversion` |  | `0` | = | RemoteableEnum | state |
| `/LiveSet/NoteAlgorithms/StacksAlgorithm/Sequence/Chord/RuleNumber` |  | `0` | = | RangedRemoteableInt | state |
| `/LiveSet/NoteAlgorithms/StacksAlgorithm/Sequence/Chord/Duration` |  | `1` | = | UserFloat | state |
| `/LiveSet/NoteAlgorithms/StacksAlgorithm/Sequence/Chord/Offset` |  | `0` | = | UserFloat | state |
| `/LiveSet/NoteAlgorithms/ShapeAlgorithm` | ShapeLevels, ShapePresets, Rate, Tie, Density, MinPitch, MaxPitch, PitchVariation |  | = | ShapeAlgorithm | state |
| `/LiveSet/NoteAlgorithms/ShapeAlgorithm/ShapeLevels` | RemoteableFloat |  | = | RemoteableList | state |
| `/LiveSet/NoteAlgorithms/ShapeAlgorithm/ShapeLevels/RemoteableFloat` |  | `0` · `0.05000000075` · `0.1000000015` · `0.150000006` · `0.200000003` · `0.25` · `0.3000000119` · `0.349999994` · `0.400000006` · `0.4499999881` · `0.5` · `0.5500000119` · `0.6000000238` · `0.6499999762` · `0.6999999881` · `0.75` · `0.8000000119` · `0.8500000238` · `0.8999999762` · `0.9499999881` · `1` | `0` · `0.05` · `0.1` · `0.15` · `0.2` · `0.25` · `0.3` · `0.35` · `0.4` · `0.45` · `0.5` · `0.55` · `0.6` · `0.65` · `0.7` · `0.75` · `0.8` · `0.85` · `0.9` · `0.95` · `1` | RemoteableFloat | state |
| `/LiveSet/NoteAlgorithms/ShapeAlgorithm/ShapePresets` |  | `2` | = | RemoteableEnum | state |
| `/LiveSet/NoteAlgorithms/ShapeAlgorithm/Rate` |  | `0` | = | RemoteableEnum | state |
| `/LiveSet/NoteAlgorithms/ShapeAlgorithm/Tie` |  | `0` | = | UserFloat | state |
| `/LiveSet/NoteAlgorithms/ShapeAlgorithm/Density` |  | `1` | = | UserFloat | state |
| `/LiveSet/NoteAlgorithms/ShapeAlgorithm/MinPitch` |  | `60` | = | RemoteableEnum | state |
| `/LiveSet/NoteAlgorithms/ShapeAlgorithm/MaxPitch` |  | `84` | = | RemoteableEnum | state |
| `/LiveSet/NoteAlgorithms/ShapeAlgorithm/PitchVariation` |  | `0` | = | UserFloat | state |
| `/LiveSet/NoteAlgorithms/SeedAlgorithm` | NotesDensity, MinPitch, MaxPitch, MinDuration, MaxDuration, MinVelocity, MaxVelocity, VerticalLimit |  | = | SeedAlgorithm | state |
| `/LiveSet/NoteAlgorithms/SeedAlgorithm/NotesDensity` |  | `0.5` | = | UserFloat | state |
| `/LiveSet/NoteAlgorithms/SeedAlgorithm/MinPitch` |  | `60` | = | RemoteableEnum | state |
| `/LiveSet/NoteAlgorithms/SeedAlgorithm/MaxPitch` |  | `84` | = | RemoteableEnum | state |
| `/LiveSet/NoteAlgorithms/SeedAlgorithm/MinDuration` |  | `-6` | = | UserFloat | state |
| `/LiveSet/NoteAlgorithms/SeedAlgorithm/MaxDuration` |  | `-3` | = | UserFloat | state |
| `/LiveSet/NoteAlgorithms/SeedAlgorithm/MinVelocity` |  | `30` | = | UserFloat | state |
| `/LiveSet/NoteAlgorithms/SeedAlgorithm/MaxVelocity` |  | `100` | = | UserFloat | state |
| `/LiveSet/NoteAlgorithms/SeedAlgorithm/VerticalLimit` |  | `4` | = | RangedRemoteableInt | state |
