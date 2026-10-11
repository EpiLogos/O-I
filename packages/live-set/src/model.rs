//! Typed summary over a LiveSet tree — the view the shell's UI needs first.

use crate::xml::Element;

#[derive(Debug, Clone, PartialEq)]
pub struct TrackInfo {
    pub kind: TrackKind,
    pub name: String,
    pub devices: Vec<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TrackKind {
    Audio,
    Midi,
    Return,
    Master,
}

#[derive(Debug, Clone, PartialEq)]
pub struct SetSummary {
    pub tempo_bpm: f64,
    pub tracks: Vec<TrackInfo>,
    pub scene_count: usize,
    pub arrangement_clips: usize,
}

impl SetSummary {
    /// Summarize a parsed `<Ableton>` document (must contain a LiveSet).
    pub fn of(root: &Element) -> Option<SetSummary> {
        let ls = root.find("LiveSet")?;
        // tempo lives in the MainTrack mixer, not under LiveSet directly
        // (session-model.md §2 — earned rule)
        let tempo_bpm = ls
            .find("MainTrack")
            .and_then(|mt| mt.find("Tempo"))
            .and_then(|t| t.child("Manual"))
            .and_then(|m| m.attr("Value"))
            .and_then(|v| v.parse().ok())
            .unwrap_or(120.0);
        let mut tracks = Vec::new();
        let mut arrangement_clips = 0usize;
        if let Some(t) = ls.find("Tracks") {
            for tr in &t.children {
                // return tracks are members of Tracks itself; the
                // LiveSet-level ReturnTracksListWrapper is only a stub
                // (session-model.md §2)
                let kind = match tr.name.as_str() {
                    "AudioTrack" => TrackKind::Audio,
                    "MidiTrack" => TrackKind::Midi,
                    "ReturnTrack" => TrackKind::Return,
                    _ => continue,
                };
                let name = tr
                    .find("EffectiveName")
                    .and_then(|n| n.attr("Value"))
                    .unwrap_or("")
                    .to_string();
                let devices = tr
                    .find("Devices")
                    .map(|ds| ds.children.iter().map(|d| d.name.clone()).collect())
                    .unwrap_or_default();
                arrangement_clips += count_arrangement_clips(tr);
                tracks.push(TrackInfo { kind, name, devices });
            }
        }
        if let Some(mt) = ls.find("MainTrack") {
            let devices = mt
                .find("Devices")
                .map(|ds| ds.children.iter().map(|d| d.name.clone()).collect())
                .unwrap_or_default();
            tracks.push(TrackInfo {
                kind: TrackKind::Master,
                name: "Master".into(),
                devices,
            });
        }
        let scene_count = ls.find("Scenes").map(|s| s.children.len()).unwrap_or(0);
        Some(SetSummary { tempo_bpm, tracks, scene_count, arrangement_clips })
    }
}

/// Clip kind of an arrangement/session clip element.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ClipKind {
    Audio,
    Midi,
}

/// One arrangement clip: bounds in beats (1.1.1 = 0, session-model.md §2).
#[derive(Debug, Clone, PartialEq)]
pub struct ClipInfo {
    pub name: String,
    pub kind: ClipKind,
    pub start: f64,
    pub end: f64,
}

/// One device parameter: `Manual` is the stored value in device units;
/// `MidiControllerRange` documents the control-surface mapping range and is
/// present only on some parameters (session-model.md §6).
#[derive(Debug, Clone, PartialEq)]
pub struct ParamInfo {
    pub id: String,
    pub value: String,
    pub min: Option<String>,
    pub max: Option<String>,
}

/// One device element with its parameter tree.
#[derive(Debug, Clone, PartialEq)]
pub struct DeviceInfo {
    pub name: String,
    pub params: Vec<ParamInfo>,
}

/// Deep per-track view: devices with parameters, arrangement clips, and
/// the track's session grid.
#[derive(Debug, Clone, PartialEq)]
pub struct TrackDetail {
    pub kind: TrackKind,
    pub name: String,
    pub devices: Vec<DeviceInfo>,
    pub arrangement_clips: Vec<ClipInfo>,
    /// Indexed by scene row: the clip a slot holds, None when empty. Only
    /// the MainSequencer grid is the track's session view — session-model.md
    /// §7 ("session clips live in MainSequencer/ClipSlotList"); the
    /// FreezeSequencer copy and the track-level ClipSlotsListWrapper are
    /// bookkeeping, not the grid.
    pub session_slots: Vec<Option<String>>,
}

/// The full document view behind /api/document — SetSummary deepened with
/// clips and device parameter trees (the summary stays the /api/summary
/// contract and is untouched by this).
#[derive(Debug, Clone, PartialEq)]
pub struct SetDocument {
    pub tempo_bpm: f64,
    pub tracks: Vec<TrackDetail>,
    pub scene_count: usize,
}

impl SetDocument {
    /// Deep-read a parsed `<Ableton>` document (must contain a LiveSet).
    pub fn of(root: &Element) -> Option<SetDocument> {
        let ls = root.find("LiveSet")?;
        // tempo lives in the MainTrack mixer, not under LiveSet directly
        // (session-model.md §2 — earned rule, same as the summary)
        let tempo_bpm = ls
            .find("MainTrack")
            .and_then(|mt| mt.find("Tempo"))
            .and_then(|t| t.child("Manual"))
            .and_then(|m| m.attr("Value"))
            .and_then(|v| v.parse().ok())
            .unwrap_or(120.0);
        let scene_count = ls.find("Scenes").map(|s| s.children.len()).unwrap_or(0);
        let mut tracks = Vec::new();
        if let Some(t) = ls.find("Tracks") {
            for tr in &t.children {
                // return tracks are members of Tracks itself; the
                // LiveSet-level ReturnTracksListWrapper is only a stub
                // (session-model.md §2 — same walk as the summary)
                let kind = match tr.name.as_str() {
                    "AudioTrack" => TrackKind::Audio,
                    "MidiTrack" => TrackKind::Midi,
                    "ReturnTrack" => TrackKind::Return,
                    _ => continue,
                };
                let name = tr
                    .find("EffectiveName")
                    .and_then(|n| n.attr("Value"))
                    .unwrap_or("")
                    .to_string();
                tracks.push(TrackDetail {
                    kind,
                    name,
                    devices: device_list(tr),
                    arrangement_clips: arrangement_clips(tr),
                    session_slots: session_slots(tr),
                });
            }
        }
        if let Some(mt) = ls.find("MainTrack") {
            tracks.push(TrackDetail {
                kind: TrackKind::Master,
                name: "Master".into(),
                devices: device_list(mt),
                arrangement_clips: Vec::new(),
                session_slots: Vec::new(),
            });
        }
        Some(SetDocument { tempo_bpm, tracks, scene_count })
    }
}

/// The device list of a track or the master: `DeviceChain/DeviceChain/Devices`
/// (session-model.md §3), each member carrying its parameter tree.
fn device_list(holder: &Element) -> Vec<DeviceInfo> {
    holder
        .child("DeviceChain")
        .and_then(|dc| dc.child("DeviceChain"))
        .and_then(|dc| dc.child("Devices"))
        .map(|ds| {
            ds.children
                .iter()
                .map(|d| DeviceInfo { name: d.name.clone(), params: params_of(d) })
                .collect()
        })
        .unwrap_or_default()
}

/// A parameter is a direct child of the device carrying a `Manual` value —
/// the uniform pattern every device parameter follows (session-model.md §6).
/// Navigates by direct children only: device subtrees (racks, plugin
/// descriptors) carry nested elements that are not this device's knobs.
fn params_of(device: &Element) -> Vec<ParamInfo> {
    device
        .children
        .iter()
        .filter_map(|child| {
            let manual = child.child("Manual")?;
            let range = child.child("MidiControllerRange");
            Some(ParamInfo {
                id: child.name.clone(),
                value: manual.attr("Value").unwrap_or_default().to_string(),
                min: range
                    .and_then(|r| r.child("Min"))
                    .and_then(|m| m.attr("Value"))
                    .map(str::to_string),
                max: range
                    .and_then(|r| r.child("Max"))
                    .and_then(|m| m.attr("Value"))
                    .map(str::to_string),
            })
        })
        .collect()
}

/// Arrangement clips of one track: the MainSequencer lane only — audio under
/// `Sample`, midi under `ClipTimeable`, both as `ArrangerAutomation/Events`
/// members (session-model.md §3/§5/§7). Take-lane comp takes
/// (`TakeLanes/TakeLane/ClipAutomation/Events`) and the FreezeSequencer copy
/// sit outside this path and are deliberately not enumerated.
fn arrangement_clips(track: &Element) -> Vec<ClipInfo> {
    let Some(sequencer) = track
        .child("DeviceChain")
        .and_then(|dc| dc.child("MainSequencer"))
    else {
        return Vec::new();
    };
    let mut clips = Vec::new();
    for holder in ["Sample", "ClipTimeable"] {
        let Some(events) = sequencer
            .child(holder)
            .and_then(|h| h.child("ArrangerAutomation"))
            .and_then(|a| a.child("Events"))
        else {
            continue;
        };
        for clip in &events.children {
            let kind = match clip.name.as_str() {
                "AudioClip" => ClipKind::Audio,
                "MidiClip" => ClipKind::Midi,
                _ => continue,
            };
            let beat = |field: &str| {
                clip.child(field)
                    .and_then(|e| e.attr("Value"))
                    .and_then(|v| v.parse().ok())
                    .unwrap_or(0.0)
            };
            clips.push(ClipInfo {
                name: clip
                    .child("Name")
                    .and_then(|n| n.attr("Value"))
                    .unwrap_or("")
                    .to_string(),
                kind,
                start: beat("CurrentStart"),
                end: beat("CurrentEnd"),
            });
        }
    }
    clips
}

/// The track's session grid: one entry per scene row, the held clip's name
/// when the slot is filled (`ClipSlot/ClipSlot/Value` wraps the clip), None
/// when empty.
fn session_slots(track: &Element) -> Vec<Option<String>> {
    track
        .child("DeviceChain")
        .and_then(|dc| dc.child("MainSequencer"))
        .and_then(|ms| ms.child("ClipSlotList"))
        .map(|list| {
            list.children
                .iter()
                .map(|slot| {
                    slot.child("ClipSlot")
                        .and_then(|inner| inner.child("Value"))
                        .and_then(|v| v.children.first())
                        .map(|clip| {
                            clip.child("Name")
                                .and_then(|n| n.attr("Value"))
                                .unwrap_or(clip.name.as_str())
                                .to_string()
                        })
                })
                .collect()
        })
        .unwrap_or_default()
}

fn count_arrangement_clips(track: &Element) -> usize {
    // arrangement clips: MainSequencer/Sample (audio) or ClipTimeable (midi)
    // → ArrangerAutomation/Events/{AudioClip,MidiClip}
    track
        .find("ArrangerAutomation")
        .and_then(|a| a.find("Events"))
        .map(|e| e.children_named("AudioClip").count() + e.children_named("MidiClip").count())
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::xml;

    #[test]
    fn summarizes_a_minimal_set() {
        let src = r#"<Ableton MajorVersion="5"><LiveSet>
          <MainTrack><Name><EffectiveName Value="Master" /></Name>
            <DeviceChain><DeviceChain><Devices><GlueCompressor Id="1" /></Devices></DeviceChain></DeviceChain>
          </MainTrack>
          <Tracks><AudioTrack Id="8"><Name><EffectiveName Value="STIM" /></Name>
            <DeviceChain><DeviceChain><Devices><GlueCompressor Id="2" /></Devices></DeviceChain></DeviceChain>
            <ClipSlotsListWrapper LomId="0" />
          </AudioTrack></Tracks>
          <Scenes><Scene /><Scene /></Scenes>
        </LiveSet></Ableton>"#;
        let tree = xml::parse(src).unwrap();
        let s = SetSummary::of(&tree).unwrap();
        assert_eq!(s.tempo_bpm, 120.0);
        assert_eq!(s.tracks.len(), 2);
        assert_eq!(s.tracks[0].name, "STIM");
        assert_eq!(s.tracks[0].devices, vec!["GlueCompressor"]);
        assert_eq!(s.tracks[1].kind, TrackKind::Master);
        assert_eq!(s.scene_count, 2);
    }

    #[test]
    fn document_enumerates_clips_slots_and_params() {
        let src = r#"<Ableton MajorVersion="5"><LiveSet>
          <MainTrack><DeviceChain><DeviceChain><Devices>
            <Compressor2 Id="90">
              <On><Manual Value="true" /><AutomationTarget Id="0" /></On>
              <Threshold><Manual Value="-12.5" />
                <MidiControllerRange><Min Value="-40" /><Max Value="0" /></MidiControllerRange>
              </Threshold>
            </Compressor2>
          </Devices></DeviceChain></DeviceChain></MainTrack>
          <Tracks>
            <AudioTrack Id="8"><Name><EffectiveName Value="STIM" /></Name>
              <DeviceChain>
                <MainSequencer>
                  <ClipSlotList>
                    <ClipSlot Id="0"><ClipSlot><Value /></ClipSlot><HasStop Value="true" /></ClipSlot>
                    <ClipSlot Id="1"><ClipSlot><Value>
                      <AudioClip Id="5" Time="0"><Name Value="take1" />
                        <CurrentStart Value="2" /><CurrentEnd Value="9.5" />
                      </AudioClip>
                    </Value></ClipSlot><HasStop Value="true" /></ClipSlot>
                  </ClipSlotList>
                  <Sample><ArrangerAutomation><Events>
                    <AudioClip Id="5" Time="0"><Name Value="bed" />
                      <CurrentStart Value="0" /><CurrentEnd Value="384" />
                    </AudioClip>
                  </Events></ArrangerAutomation></Sample>
                </MainSequencer>
                <FreezeSequencer><Sample><ArrangerAutomation><Events>
                  <AudioClip Id="9" Time="0"><CurrentStart Value="0" /><CurrentEnd Value="1" /></AudioClip>
                </Events></ArrangerAutomation></Sample></FreezeSequencer>
                <DeviceChain>
                  <Devices>
                    <GlueCompressor Id="2">
                      <Threshold><Manual Value="-40" />
                        <MidiControllerRange><Min Value="-40" /><Max Value="0" /></MidiControllerRange>
                      </Threshold>
                      <On><Manual Value="false" /></On>
                    </GlueCompressor>
                  </Devices>
                </DeviceChain>
              </DeviceChain>
              <TakeLanes><TakeLanes><TakeLane Id="0">
                <ClipAutomation><Events>
                  <AudioClip Id="7" Time="10"><CurrentStart Value="10" /><CurrentEnd Value="20" /></AudioClip>
                </Events></ClipAutomation>
              </TakeLane></TakeLanes></TakeLanes>
            </AudioTrack>
            <MidiTrack Id="9"><Name><EffectiveName Value="SYN" /></Name>
              <DeviceChain>
                <MainSequencer><ClipTimeable><ArrangerAutomation><Events>
                  <MidiClip Id="1" Time="4"><Name Value="hook" />
                    <CurrentStart Value="4" /><CurrentEnd Value="12" />
                  </MidiClip>
                </Events></ArrangerAutomation></ClipTimeable></MainSequencer>
              </DeviceChain>
            </MidiTrack>
          </Tracks>
          <Scenes><Scene /><Scene /></Scenes>
        </LiveSet></Ableton>"#;
        let tree = xml::parse(src).unwrap();
        let d = SetDocument::of(&tree).unwrap();
        assert_eq!(d.tempo_bpm, 120.0);
        assert_eq!(d.scene_count, 2);
        assert_eq!(d.tracks.len(), 3);

        // arrangement clips: MainSequencer lanes only — the take-lane comp
        // clip and the FreezeSequencer copy are not the arrangement
        let stim = &d.tracks[0];
        assert_eq!(stim.arrangement_clips.len(), 1);
        let bed = &stim.arrangement_clips[0];
        assert_eq!(bed.name, "bed");
        assert_eq!(bed.kind, ClipKind::Audio);
        assert_eq!(bed.start, 0.0);
        assert_eq!(bed.end, 384.0);
        let syn = &d.tracks[1];
        assert_eq!(syn.arrangement_clips.len(), 1);
        assert_eq!(syn.arrangement_clips[0].kind, ClipKind::Midi);
        assert_eq!(syn.arrangement_clips[0].start, 4.0);
        assert_eq!(syn.arrangement_clips[0].end, 12.0);

        // session grid: scene row 1 holds "take1", row 0 is empty
        assert_eq!(stim.session_slots.len(), 2);
        assert_eq!(stim.session_slots[0], None);
        assert_eq!(stim.session_slots[1], Some("take1".to_string()));
        // midi track has no ClipSlotList in this document
        assert!(syn.session_slots.is_empty());

        // device parameter trees: element name + Manual, range when present
        let glue = &stim.devices[0];
        assert_eq!(glue.name, "GlueCompressor");
        assert_eq!(glue.params.len(), 2);
        assert_eq!(glue.params[0].id, "Threshold");
        assert_eq!(glue.params[0].value, "-40");
        assert_eq!(glue.params[0].min, Some("-40".to_string()));
        assert_eq!(glue.params[0].max, Some("0".to_string()));
        assert_eq!(glue.params[1].id, "On");
        assert_eq!(glue.params[1].value, "false");
        assert_eq!(glue.params[1].min, None);
        assert_eq!(glue.params[1].max, None);

        // master carries the same deep view
        let master = &d.tracks[2];
        assert_eq!(master.kind, TrackKind::Master);
        assert_eq!(master.devices[0].name, "Compressor2");
        assert_eq!(master.devices[0].params[0].value, "true");
        assert_eq!(master.devices[0].params[1].value, "-12.5");
        assert!(master.arrangement_clips.is_empty());
        assert!(master.session_slots.is_empty());
    }
}
