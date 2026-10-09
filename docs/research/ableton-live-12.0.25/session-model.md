# Session & device model — Ableton Live 12.0.25

**Status:** evidence-backed spec, revision 1 (2026-10-07).
**Evidence classes used:** app-bundle Schema directory (356 AbletonSchema translator
files, `App-Resources/Schema/*.txt`), a real authored set unpacked
(`evidence/sets/template-piano-voices-mastering.xml`, saved by Creator
`Ableton Live 12.0.25`, Revision `2627c4381666539a5a808a0e92d54866fe4b1706` —
byte-identical build id to the analyzed binary), factory device presets
(`evidence/devices/...`), and **crafted-set load experiments** where Live's own
loader accepted or rejected documents with precise error strings. The crafted-set
experiments are the strongest evidence here: every rule below marked
*validated* was enforced on us by the loader itself.

## 1. Container format

All session/preset documents are **gzip-compressed XML** with a common root:

```xml
<Ableton MajorVersion="5" MinorVersion="12.0_12049" SchemaChangeCount="12"
         Creator="Ableton Live 12.0.25" Revision="2627c43816…">
```

- Extensions map to content: `.als` Live set (`<LiveSet>`), `.adv` device preset
  (root device element, e.g. `<GlueCompressor>`), `.adg` rack
  (`<AudioEffectGroupDevice>`), `.alc` clip, `.agr` groove, `.adv` default device
  states under `Core Library/Defaults/`.
- `MinorVersion` carries the document schema (`12.0_12049` across everything we
  unpacked from 12.0.x-era writers); `Creator` names the writing build;
  `Revision` is the writing build's commit id.
- The full element vocabulary per class lives in the app's Schema directory —
  356 files of `AbletonSchema Version="5"` translator tables declaring every
  serializable class and field with its storage class (`Int`, `TimeableFloat`,
  `RemoteableBool`, `PythonListWrapper`, `Slot<Device>` …). These tables are
  the authoritative field list; the binary populates them. Confidence: **high**
  (app-authoritative surface).

## 2. LiveSet skeleton

```
LiveSet
├── NextPointeeId                (allocation counter for pointee references)
├── OverwriteProtectionNumber, LomId, LomIdView
├── Tracks/                      (ordered: MidiTrack | AudioTrack | GroupTrack …)
├── MainTrack/                   (the master: DeviceChain/Mixer carries Tempo, Volume, Pan…)
├── Scenes/                      (one element per scene row)
├── Grooves/, SignalModulations/, Locators/, …
```

- **Return tracks are members of `Tracks` itself** (tag `ReturnTrack`); the
  LiveSet-level `ReturnTracksListWrapper` is only a stub wrapper with no
  members. *Corrected 2026-10-07 second session:* an earlier revision of this
  document showed a `ReturnTracks/` child — the real writer does not have
  one (M0 document-engine test caught it). Consequence recorded in the
  harness: the build scripts' return-pruning was a silent no-op; the
  load-bearing fix for pruned sets was clearing track sends.
- **Tempo** is not a LiveSet-level field: it is the MainTrack mixer's
  `Tempo/Manual` (a TimeableFloat; automation target allocated like any
  parameter). *Validated:* setting `LiveSet/Tempo` (nonexistent) silently did
  nothing; the value Live displays comes from `MainTrack/DeviceChain/Mixer/Tempo/Manual`.
  Confidence: **high**.
- Song time is **beats**: arrangement positions, clip bounds and loop fields are
  beats (1.1.1 = 0). Seconds = beats × 60 / tempo.

## 3. Track anatomy (AudioTrack)

```
AudioTrack Id="8"
├── Name/EffectiveName|UserName|Annotation|MemorizedFirstClipName
├── Color, AutomationEnvelopes/Envelopes, TrackGroupId, TrackUnfolded, ViewData
├── ClipSlotsListWrapper, DevicesListWrapper, TakeLanes/, LinkedTrackGroupId
└── DeviceChain
    ├── AutomationLanes, ClipEnvelopeChooserViewState
    ├── AudioInputRouting, MidiInputRouting, AudioOutputRouting, MidiOutputRouting
    ├── Mixer/          (Volume, Pan, Sends/TrackSendHolder*, …)
    ├── MainSequencer/  (Sample/ArrangerAutomation/Events/AudioClip* — the arrangement lane)
    ├── FreezeSequencer/ (Recorder, …)
    └── DeviceChain/
        ├── Devices/           (the device list — each device element carries Id="N")
        └── SignalModulations/ (modulation routed into device targets)
```

MidiTrack carries the same chassis with a MidiSequencer instead of MainSequencer.
Confidence: **high** (validated by load + round-trip in this session).

## 4. Loader rules — every one of these rejected or accepted a real document

| rule | evidence (loader's own words, Log.txt / dialogs) |
| --- | --- |
| Every member of the device list carries an `Id` attribute | "Not all list members have Ids. (at line 1276, column 23)" — device without Id in `<Devices>` |
| `AutomationTarget`/`ModulationTarget`/`Pointee` elements must reference allocated pointee Ids (`< NextPointeeId`); presets carry `Id="0"` but sets do not accept 0 | "Invalid Pointee Id." — preset device pasted with Id="0" targets |
| No dangling references: track `AutomationEnvelopes`, `SignalModulations` and clip `Envelopes` referencing removed devices' targets must be cleared | same rejection; cleared → loads |
| Track send count must match the set's return-track count | "(Track has more send knobs than set has return tracks.)" |
| 32-bit audio files must be IEEE float (WAVE format tag 3); integer WAV supported only at 8/16/24 bit | dialog: "[32-bit integer WAV files are not supported. For 32 bit, only floating point samples can be used. Supported integer formats are 8, 16 and 24 bit.]" |
| A device element (e.g. `<GlueCompressor>`) can be lifted from its `.adv` preset into a set's `<Devices>` as-is, plus Id + allocated pointees | the entire harness pipeline stands on this |

Confidence: **high** — each rule was exercised against the real loader this
session. These messages are also behavioral documentation of the validator.

## 5. Clip model (arrangement AudioClip)

```
AudioClip
├── CurrentStart, CurrentEnd          (beats)
├── Loop/ LoopStart, LoopEnd, StartRelative, LoopOn, OutMarker,
│        HiddenLoopStart, HiddenLoopEnd          (beats)
├── Name, Annotation, Color, TimeSignature/TimeSignatures
├── Envelopes/                        (clip automation of device/track targets)
├── LaunchMode, LaunchQuantisation, Legato, Ram, GrooveSettings, Disabled,
│   VelocityAmount, FollowAction/     (session follow behavior lives per-clip)
├── IsWarped, WarpMode, GranularityTones, GranularityTexture,
│   FluctuationTexture, TransientResolution, TransientLoopMode,
│   TransientEnvelope, ComplexProFormants, ComplexProEnvelope,
│   Sync, HiQ, Fade, Fades/(FadeInLength, FadeOutLength, ClipFadesAreInitialized, …)
├── PitchCoarse, PitchFine, SampleVolume, WarpMarkers/,
│   SavedWarpMarkersForStretched, MarkersGenerated, IsSongTempoLeader, TakeId
└── SampleRef/FileRef/ RelativePathType, RelativePath, Path, Type, LivePackName…
```

- Warp algorithm surface is visible as per-algorithm parameter fields
  (Beats/Texture/Complex Pro …). Unwarped playback (`IsWarped=false`) plays the
  sample at original rate. *Validated:* 5.25 s unwarped clip rendered as
  5.25 s of content inside a longer stored arrangement.
- Fades are sample-domain lengths; loop/clip bounds are beat-domain. Confidence:
  **high** for the fields exercised; **medium** for warp-algorithm semantics
  (not yet behaviorally probed).

## 6. Device preset model (.adv)

Root device element (e.g. `<GlueCompressor>`) with a uniform parameter pattern:

```xml
<Threshold>
  <LomId Value="0"/>
  <Manual Value="-40"/>                 <!-- current value, device units -->
  <MidiControllerRange><Min Value="-40"/><Max Value="0"/></MidiControllerRange>
  <AutomationTarget Id="0"><LockEnvelope Value="0"/></AutomationTarget>
  <ModulationTarget Id="0"><LockEnvelope Value="0"/></ModulationTarget>
</Threshold>
```

- `Manual` is the stored value in **device units** (dB for compressor
  threshold/makeup); `MidiControllerRange` documents the control-surface
  mapping range — together with the Schema tables this is the parameter-tree
  evidence the dossiers cite. The LOM exposes the same parameters as children
  of the device object (remote scripts confirm the same names).
- Device on/off is the `On` parameter (`Manual` true/false) — used for bypass
  reference renders.

## 7. MIDI clip model (crafted-set experiments, 2026-10-07 second session)

Arrangement MIDI clips live at
`MidiTrack/DeviceChain/MainSequencer/ClipTimeable/ArrangerAutomation/Events/MidiClip`
(`ClipTimeable` instead of the audio track's `Sample`; session clips live in
`MainSequencer/ClipSlotList`).

Loader-validated rules (each enforced by a real rejection):

| rule | evidence |
| --- | --- |
| `MidiClip` (as an Events list member) carries an `Id` attribute | "Not all list members have Ids. (at line 313, column 26)" |
| `KeyTrack` members of `Notes/KeyTracks` carry an `Id` attribute | same rejection class, passed after Ids added (no error at its column) |
| **`Notes/KeyTracks` IS the KeyTrack array itself** — no inner `KeyTracks` wrapper | "Unknown class 'KeyTracks' encountered (at line 313, column 482)" |
| **`MidiNoteEvent` takes NO `Id` attribute** | "Unknown attribute 'Id' (at line 313, column 620)" |
| `MidiNoteEvent` fields: `Time`, `Duration` (doubles, beats), `Velocity` (float 0..1), `OffVelocity`, `IsEnabled` | Schema `MidiNoteEvent` translator; attributes accepted up to the noted rejection |
| `NoteIdGenerator` = note count; `ProbabilityGroupIdGenerator` present | Schema + accepted so far |
| **Arrangement anchoring element = the clip element's `Time` attribute** (`<MidiClip Id="20" Time="13.105…">`, == `CurrentStart`; present on all 73 template arrangement clips, absent on session-slot clips). Crafted clips without it anchor at arrangement 0 regardless of `CurrentStart` — a clip built at start 9.75 rendered its note grid at 0 and a verified-present second `Events` member contributed no audio (FA1-FA3); stamping `Time` = `CurrentStart` alone fixes both: FA4_TIME's clip B sounds at beats 9.75-17.8 exactly | FA probes + FA4_TIME 2026-10-08 (`devices/follow-action.md`). Multi-clip / offset-clip crafted sets are UNBLOCKED — builders must write `Time` (backlog row covers the builder adoption) |

`KeyTrack` = `{ MidiKey: Int, Notes: MidiNoteEvent[] }` (Schema). End-to-end
load of a crafted MIDI clip: **VALIDATED 2026-10-07** — crafted clips (key 48,
velocities 127/96/64/32, 1.75-beat durations) loaded, triggered Operator and
Wavetable at exact note times (note fundamental ≈130 Hz = C3 end-to-end), and
rendered silence immediately after clip end. Generators serialize as the real
writer writes them: `<ProbabilityGroupIdGenerator><NextId Value="…"/></…>`,
`<NoteIdGenerator><NextId Value="…"/></NoteIdGenerator>`,
`<PerNoteEventStore><EventLists /></PerNoteEventStore>`. The five-iteration
rejection ladder is recorded in the D7 row of `reconstruction-backlog.md`.

## 8. Semantics still unverified

- Warp-algorithm behavior per mode (Beats vs Texture vs Complex Pro) — model
  surface documented, DSP behavior not yet probed.
- FollowAction state machine (session follow), scene temporal semantics under
  global quantise — element shape documented and loader-accepted
  (`devices/follow-action.md`); dynamics **BLOCKED for the export driver**
  (arrangement render is FollowAction-invariant; session-launch capture
  needed).
- Groove pool (`GrooveSettings`/`.agr`) application mechanics.
- The LOM object graph as exposed to remote scripts is compiled into the binary
  (shipped Python is infrastructure-only); enumeration via `.pyc` decompile of
  remote-script components or binary symbols is **pending binary lane**.
- Export-render provenance: renders carry the export prefs of the running
  instance (observed 44.1 kHz / 16-bit / dithered); render length = stored
  arrangement length (234 s), not content length. Absolute-level claims must
  account for the master/track staging; bypass-reference renders are the
  calibration.
