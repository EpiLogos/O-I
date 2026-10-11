# Live Object Model inventory — Ableton Live 12.0.25

Enumerated LOM surface recovered offline from the shipped MIDI Remote Scripts of
`/Applications/Ableton Live 12 Suite.app` (bundle version `12.0.25
(2024-08-27_2627c43816)`). This is the object/property/method inventory that
the shell's later editing APIs (M4+ session editing, device control) are
expected to mirror.

App-shipped artifacts of the owner's licensed copy were read for study only.
No decompiled source is reproduced: the dossier names the API surface
(class/property/method names, signatures) and cites file paths. Scratch
extraction tooling lives in `/tmp/lomtool/` (pure-stdlib, throwaway).

## Method and evidence basis

- Source tree: `Contents/App-Resources/MIDI Remote Scripts/` — 140 controller
  script directories, 1269 `.pyc` files (incl. `_Framework`, `ableton/`,
  `pushbase/`, `Push/`, `Push2/`, `_MxDCore/`, `_APC/`).
- Bytecode is **CPython 3.7** (magic `0x0d42` = 3394) in both the scripts and
  the embedded stdlib at `Contents/App-Resources/Python/lib/`. This corrects
  the working assumption that Live 12 shipped Python 3.11 — the embedded
  interpreter of 12.0.25 is 3.7.
- Python's `dis` was unusable directly (no 3.7 interpreter installed), so a
  purpose-built pure-Python reader for the 3.7 marshal format recovered code
  objects (names, varnames, flags, consts, docstring-eligible first consts)
  and a 3.7 opcode scanner recovered per-function facts:
  - imports: `IMPORT_NAME` carries the full dotted module name;
    `IMPORT_FROM` carries the imported symbol (`co_names` index);
  - attribute reads/writes and method calls: `LOAD_ATTR`, `STORE_ATTR`,
    `LOAD_METHOD` operand indices into `co_names`;
  - class skeletons: class bodies are zero-arg code objects containing
    `__qualname__` in `co_names`; methods are their child code objects, with
    signatures reconstructible from `argcount`/`kwonlyargcount`/`varnames`/flags.
- All 1269 `.pyc` parsed with zero errors.
- For the authoritative LOM class/property table, a mini stack machine replayed
  the module body of `_MxDCore/LomTypes.pyc`, which registers every
  Max-for-Live-visible LOM member as an `MFLProperty(name, format, to_json,
  from_json, min_epii_version, hidden)` descriptor grouped per `Live.*` class.
  Dict/subscript evaluation order in the bytecode preserves the class
  grouping, so the reconstruction below is Live's own table, not an inference.

Method confidence per section is stated inline. In everything below,
"member" means property or method; the source table does not distinguish
them (M4L treats both as `obj_set`/`obj_get`/`obj_call` targets).

## 1. The LOM class table (authoritative, from `_MxDCore/LomTypes.pyc`)

Confidence: **high** — this is the registration table Live itself serves to
Max for Live (`get_available_lom_types`,
`get_available_properties_for_type`, `LomIntrospection` in the same module
walk `dir()` over the `Live` package against this table).

37 `Live.*` classes, 549 member registrations, plus a shared device-base
template of 30 entries concatenated onto every `*Device` class (579 total).
18 members are registered with `MFLPropertyFormats.JSON` (structured
serialization): `warp_markers` on `Clip` and `Sample`, and the routing
type/channel getters on `Track`, `CompressorDevice`, `DeviceIO`.

#### `Live.Application.Application` — 13 members

`control_surfaces`, `current_dialog_button_count`, `current_dialog_message`, `get_bugfix_version`, `get_document`, `get_version_string`, `get_major_version`, `get_minor_version`, `open_dialog_count`, `press_current_dialog_button`, `average_process_usage`, `peak_process_usage`, `view`

#### `Live.Application.Application.View` — 11 members

`available_main_views`, `browse_mode`, `canonical_parent`, `focus_view`, `focused_document_view`, `hide_view`, `is_view_visible`, `scroll_view`, `show_view`, `toggle_browse`, `zoom_view`

#### `Live.Song.Song` — 90 members

`appointed_device`, `arrangement_overdub`, `back_to_arranger`, `can_capture_midi`, `can_jump_to_next_cue`, `can_jump_to_prev_cue`, `can_redo`, `can_undo`, `capture_and_insert_scene`, `capture_midi`, `clip_trigger_quantization`, `continue_playing`, `count_in_duration`, `create_audio_track`, `create_midi_track`, `create_return_track`, `create_scene`, `cue_points`, `current_song_time`, `delete_return_track`, `delete_scene`, `delete_track`, `duplicate_scene`, `duplicate_track`, `exclusive_arm`, `exclusive_solo`, `file_path`, `find_device_position`, `force_link_beat_time`, `get_beats_loop_length`, `get_beats_loop_start`, `get_current_beats_song_time`, `get_current_smpte_song_time`, `groove_amount`, `groove_pool`, `is_ableton_link_enabled`, `is_ableton_link_start_stop_sync_enabled`, `is_counting_in`, `is_cue_point_selected`, `is_playing`, `jump_by`, `jump_to_next_cue`, `jump_to_prev_cue`, `last_event_time`, `loop`, `loop_length`, `loop_start`, `master_track`, `metronome`, `midi_recording_quantization`, `move_device`, `name`, `nudge_down`, `nudge_up`, `tempo_follower_enabled`, `overdub`, `play_selection`, `punch_in`, `punch_out`, `re_enable_automation`, `re_enable_automation_enabled`, `record_mode`, `redo`, `return_tracks`, `root_note`, `scale_intervals`, `scale_mode`, `scale_name`, `scenes`, `scrub_by`, `select_on_launch`, `session_automation_record`, `session_record`, `session_record_status`, `set_or_delete_cue`, `signature_denominator`, `signature_numerator`, `song_length`, `start_playing`, `start_time`, `stop_all_clips`, `stop_playing`, `swing_amount`, `tap_tempo`, `tempo`, `tracks`, `trigger_session_record`, `undo`, `view`, `visible_tracks`

#### `Live.Song.Song.View` — 10 members

`canonical_parent`, `detail_clip`, `draw_mode`, `follow_song`, `highlighted_clip_slot`, `select_device`, `selected_chain`, `selected_parameter`, `selected_scene`, `selected_track`

#### `Live.Song.CuePoint` — 4 members

`canonical_parent`, `jump`, `name`, `time`

#### `Live.Track.Track` — 63 members

`arm`, `arrangement_clips`, `available_input_routing_channels`, `available_input_routing_types`, `available_output_routing_channels`, `available_output_routing_types`, `back_to_arranger`, `can_be_armed`, `can_be_frozen`, `can_show_chains`, `canonical_parent`, `clip_slots`, `color`, `color_index`, `create_audio_clip`, `current_input_routing`, `current_input_sub_routing`, `current_monitoring_state`, `current_output_routing`, `current_output_sub_routing`, `delete_clip`, `delete_device`, `devices`, `duplicate_clip_slot`, `duplicate_clip_to_arrangement`, `fired_slot_index`, `fold_state`, `group_track`, `has_audio_input`, `has_audio_output`, `has_midi_input`, `has_midi_output`, `implicit_arm`, `input_meter_left`, `input_meter_level`, `input_meter_right`, `input_routing_channel`, `input_routing_type`, `input_routings`, `input_sub_routings`, `is_foldable`, `is_frozen`, `is_grouped`, `is_part_of_selection`, `is_showing_chains`, `is_visible`, `jump_in_running_session_clip`, `mixer_device`, `mute`, `muted_via_solo`, `name`, `output_meter_left`, `output_meter_level`, `output_meter_right`, `output_routing_channel`, `output_routing_type`, `output_routings`, `output_sub_routings`, `performance_impact`, `playing_slot_index`, `solo`, `stop_all_clips`, `view`

#### `Live.Track.Track.View` — 5 members

`canonical_parent`, `device_insert_mode`, `is_collapsed`, `select_instrument`, `selected_device`

#### `Live.Scene.Scene` — 15 members

`canonical_parent`, `clip_slots`, `color`, `color_index`, `fire`, `fire_as_selected`, `is_empty`, `is_triggered`, `name`, `set_fire_button_state`, `tempo`, `tempo_enabled`, `time_signature_numerator`, `time_signature_denominator`, `time_signature_enabled`

#### `Live.ClipSlot.ClipSlot` — 20 members

`canonical_parent`, `clip`, `color`, `color_index`, `controls_other_clips`, `create_audio_clip`, `create_clip`, `delete_clip`, `duplicate_clip_to`, `fire`, `has_clip`, `has_stop_button`, `is_group_slot`, `is_playing`, `is_recording`, `is_triggered`, `playing_status`, `set_fire_button_state`, `stop`, `will_record_on_start`

#### `Live.Clip.Clip` — 78 members

`add_new_notes`, `add_warp_marker`, `apply_note_modifications`, `available_warp_modes`, `canonical_parent`, `clear_all_envelopes`, `clear_envelope`, `color`, `color_index`, `crop`, `deselect_all_notes`, `duplicate_loop`, `duplicate_notes_by_id`, `duplicate_region`, `end_marker`, `end_time`, `file_path`, `fire`, `gain`, `gain_display_string`, `get_all_notes_extended`, `get_notes`, `get_notes_by_id`, `get_notes_extended`, `get_selected_notes`, `get_selected_notes_extended`, `groove`, `has_envelopes`, `has_groove`, `is_arrangement_clip`, `is_audio_clip`, `is_midi_clip`, `is_overdubbing`, `is_playing`, `is_recording`, `is_triggered`, `launch_mode`, `launch_quantization`, `legato`, `length`, `loop_end`, `loop_start`, `looping`, `move_playing_pos`, `move_warp_marker`, `muted`, `name`, `pitch_coarse`, `pitch_fine`, `playing_position`, `position`, `quantize`, `quantize_pitch`, `ram_mode`, `remove_notes`, `remove_notes_by_id`, `remove_notes_extended`, `remove_warp_marker`, `replace_selected_notes`, `sample_length`, `sample_rate`, `scrub`, `select_all_notes`, `select_notes_by_id`, `set_fire_button_state`, `set_notes`, `signature_denominator`, `signature_numerator`, `start_marker`, `start_time`, `stop`, `stop_scrub`, `velocity_amount`, `view`, `warp_markers`, `warp_mode`, `warping`, `will_record_on_start`

The note API family here (`add_new_notes`, `get_notes_extended`,
`apply_note_modifications`, `get_notes_by_id`, `duplicate_notes_by_id`,
`remove_notes_extended`, `select_notes_by_id`, ...) is the Live 11+ by-id
note model — the natural substrate for shell note editing.

#### `Live.Clip.Clip.View` — 7 members

`canonical_parent`, `grid_is_triplet`, `grid_quantization`, `hide_envelope`, `select_envelope_parameter`, `show_envelope`, `show_loop`

#### `Live.Sample.Sample` — 29 members

`beats_granulation_resolution`, `beats_transient_envelope`, `beats_transient_loop_mode`, `canonical_parent`, `clear_slices`, `complex_pro_envelope`, `complex_pro_formants`, `end_marker`, `file_path`, `gain`, `gain_display_string`, `insert_slice`, `length`, `move_slice`, `remove_slice`, `reset_slices`, `sample_rate`, `slices`, `slicing_beat_division`, `slicing_region_count`, `slicing_sensitivity`, `slicing_style`, `start_marker`, `texture_flux`, `texture_grain_size`, `tones_grain_size`, `warp_mode`, `warp_markers`, `warping`

#### `Live.Groove.Groove` — 7 members

`base`, `canonical_parent`, `name`, `quantization_amount`, `random_amount`, `timing_amount`, `velocity_amount`

#### `Live.GroovePool.GroovePool` — 2 members

`canonical_parent`, `grooves`

#### `Live.DeviceParameter.DeviceParameter` — 15 members

`__str__`, `automation_state`, `canonical_parent`, `default_value`, `is_enabled`, `is_quantized`, `max`, `min`, `name`, `original_name`, `re_enable_automation`, `state`, `str_for_value`, `value`, `value_items`

#### `Live.DeviceIO.DeviceIO` — 6 members

`available_routing_channels`, `available_routing_types`, `canonical_parent`, `default_external_routing_channel_is_none`, `routing_channel`, `routing_type`

#### `Live.MixerDevice.MixerDevice` — 12 members

`canonical_parent`, `crossfade_assign`, `crossfader`, `cue_volume`, `left_split_stereo`, `panning`, `panning_mode`, `right_split_stereo`, `sends`, `song_tempo`, `track_activator`, `volume`

#### `Live.ChainMixerDevice.ChainMixerDevice` — 5 members

`canonical_parent`, `chain_activator`, `panning`, `sends`, `volume`

#### `Live.PluginDevice.PluginDevice` — 2 members

`presets`, `selected_preset_index`

#### `Live.RackDevice.RackDevice` — 20 members

`add_macro`, `can_show_chains`, `chain_selector`, `chains`, `copy_pad`, `delete_selected_variation`, `drum_pads`, `has_drum_pads`, `has_macro_mappings`, `is_showing_chains`, `randomize_macros`, `recall_last_used_variation`, `recall_selected_variation`, `remove_macro`, `return_chains`, `selected_variation_index`, `store_variation`, `variation_count`, `visible_drum_pads`, `visible_macro_count`

#### `Live.RackDevice.RackDevice.View` — 4 members

`drum_pads_scroll_position`, `is_showing_chain_devices`, `selected_chain`, `selected_drum_pad`

#### `Live.DrumPad.DrumPad` — 7 members

`canonical_parent`, `chains`, `delete_all_chains`, `mute`, `name`, `note`, `solo`

#### `Live.DrumChain.DrumChain` — 2 members

`out_note`, `choke_group`

#### `Live.MaxDevice.MaxDevice` — 7 members

`audio_inputs`, `audio_outputs`, `get_bank_count`, `get_bank_name`, `get_bank_parameters`, `midi_inputs`, `midi_outputs`

#### Native-device classes (Live 12 devices with LOM-visible parameters)

- `Live.CompressorDevice.CompressorDevice` — 4: `available_input_routing_channels`, `available_input_routing_types`, `input_routing_channel`, `input_routing_type`
- `Live.Eq8Device.Eq8Device` — 3: `edit_mode`, `global_mode`, `oversample`; `.View` — 1: `selected_band`
- `Live.DriftDevice.DriftDevice` — 29: `mod_matrix_filter_source_1_index`, `mod_matrix_filter_source_1_list`, `mod_matrix_filter_source_2_index`, `mod_matrix_filter_source_2_list`, `mod_matrix_lfo_source_index`, `mod_matrix_lfo_source_list`, `mod_matrix_pitch_source_1_index`, `mod_matrix_pitch_source_1_list`, `mod_matrix_pitch_source_2_index`, `mod_matrix_pitch_source_2_list`, `mod_matrix_shape_source_index`, `mod_matrix_shape_source_list`, `mod_matrix_source_1_index`, `mod_matrix_source_1_list`, `mod_matrix_source_2_index`, `mod_matrix_source_2_list`, `mod_matrix_source_3_index`, `mod_matrix_source_3_list`, `mod_matrix_target_1_index`, `mod_matrix_target_1_list`, `mod_matrix_target_2_index`, `mod_matrix_target_2_list`, `mod_matrix_target_3_index`, `mod_matrix_target_3_list`, `pitch_bend_range`, `voice_count_index`, `voice_count_list`, `voice_mode_index`, `voice_mode_list`
- `Live.HybridReverbDevice.HybridReverbDevice` — 8: `ir_attack_time`, `ir_category_index`, `ir_category_list`, `ir_decay_time`, `ir_file_index`, `ir_file_list`, `ir_size_factor`, `ir_time_shaping_on`
- `Live.LooperDevice.LooperDevice` — 15: `clear`, `double_length`, `double_speed`, `half_length`, `half_speed`, `loop_length`, `overdub`, `overdub_after_record`, `play`, `record`, `record_length_index`, `record_length_list`, `stop`, `tempo`, `undo`
- `Live.MeldDevice.MeldDevice` — 4: `selected_engine`, `unison_voices`, `mono_poly`, `poly_voices`
- `Live.RoarDevice.RoarDevice` — 3: `routing_mode_index`, `routing_mode_list`, `env_listen`
- `Live.ShifterDevice.ShifterDevice` — 2: `pitch_bend_range`, `pitch_mode_index`
- `Live.SimplerDevice.SimplerDevice` — 18: `can_warp_as`, `can_warp_double`, `can_warp_half`, `crop`, `guess_playback_length`, `multi_sample_mode`, `pad_slicing`, `playback_mode`, `playing_position`, `playing_position_enabled`, `retrigger`, `reverse`, `sample`, `slicing_playback_mode`, `voices`, `warp_as`, `warp_double`, `warp_half`; `.View` — 1: `selected_slice`
- `Live.SpectralResonatorDevice.SpectralResonatorDevice` — 7: `frequency_dial_mode`, `midi_gate`, `mod_mode`, `mono_poly`, `pitch_mode`, `pitch_bend_range`, `polyphony`
- `Live.WavetableDevice.WavetableDevice` — 20: `add_parameter_to_modulation_matrix`, `filter_routing`, `get_modulation_target_parameter_name`, `get_modulation_value`, `is_parameter_modulatable`, `mono_poly`, `oscillator_1_effect_mode`, `oscillator_1_wavetable_category`, `oscillator_1_wavetable_index`, `oscillator_1_wavetables`, `oscillator_2_effect_mode`, `oscillator_2_wavetable_category`, `oscillator_2_wavetable_index`, `oscillator_2_wavetables`, `oscillator_wavetable_categories`, `poly_voices`, `set_modulation_value`, `unison_mode`, `unison_voice_count`, `visible_modulation_target_names`

#### Shared device-base template — 30 entries, concatenated onto every `*Device`

`can_have_chains`, `can_have_drum_pads`, `canonical_parent`, `class_display_name`, `class_name`, `is_active`, `latency_in_ms`, `latency_in_samples`, `name`, `parameters`, `store_chosen_bank`, `type`, `view`, `canonical_parent`, `is_collapsed`, `canonical_parent`, `color`, `color_index`, `delete_device`, `devices`, `has_audio_input`, `has_audio_output`, `has_midi_input`, `has_midi_output`, `is_auto_colored`, `mixer_device`, `mute`, `muted_via_solo`, `name`, `solo`

(The repetition in the template is in the source table — it concatenates
device-base, chain-host and channel-strip fragments. Effective device surface
= template + class-specific members; `canonical_parent`, `class_name`, `name`,
`parameters`, `type`, `view` are the universal addressing members.)

### Classes imported from `Live` by scripts but absent from the M4L table

Cross-corpus import scan (all 1269 files): `Live.Application` (1 file),
`Live.Base` (2, incl. `LimitationError`), `Live.Clip` (5, incl.
`MidiNoteSpecification`, `GridQuantization`, `WarpMarker` usage inside
`_MxDCore/MxDCore.pyc`), `Live.ClipSlot` (3), `Live.DeviceParameter` (2),
`Live.DrumPad` (2), `Live.MixerDevice` (1), `Live.PluginDevice` (1),
`Live.Sample` (1, `SlicingStyle`), `Live.Scene` (2), `Live.Song` (9,
incl. `Quantization`, `RecordingQuantization`, `SessionRecordStatus`),
`Live.Track` (3), plus bare `Live` in 259 files. These enums/helper types
ride on the classes above; no additional object root appeared.

## 2. Instance-level usage evidence (what controllers actually touch)

Confidence: **medium-high for names** — recovered from `LOAD_ATTR`/
`LOAD_METHOD`/`STORE_ATTR` operands, which prove the *name* is accessed on
some object; receiver typing is inferred from context. Method: full-corpus
scan of all 1269 `.pyc` files (every code object, all script directories)
against the section-1 name set, plus structural extraction of the focus
frameworks (`_Framework`, `ableton/v2+v3` incl. both frameworks'
`components/` subtrees, `pushbase`, `Push`, `Push2`, `_MxDCore`,
`APC40_MkII`/`_APC` — 484 modules).

- **267 of the 579 registered LOM members are observed in live use** across
  the corpus; **83 members are also written** (`STORE_ATTR` — see the
  mutation list below, the strongest evidence of the actually-mutable set
  the shell must support).
- Most-touched members (count of script directories/modules touching them):
  `view` (216), `is_enabled` (197), `name` (154), `value` (126,
  DeviceParameter), `selected_track` (118, Song.View), `color` (103),
  `tracks` (92), `return_tracks` (64), `clip` (60), `selected_scene` (59),
  `master_track` (56), `can_be_armed` (55), `is_playing` (51), `scenes` (46),
  `clip_slots` (46), `arm` (45), `has_clip` (41), `is_view_visible` (41),
  `visible_tracks` (40), `canonical_parent` (39), `mixer_device` (37),
  `fire` (34), `show_view` (32), `mute` (32), `min` (31).
- Usage intensity by package (distinct LOM members used): `ableton` 171,
  `pushbase` 141, `Push2` 127, `_Framework` 86, `MackieControl`/
  `MackieControl_Classic` 82 each, `Akai_Force_MPC` 66.
- Members observed written (all 83): `appointed_device`, `arm`,
  `back_to_arranger`, `canonical_parent`, `choke_group`, `clip`,
  `clip_trigger_quantization`, `color`, `color_index`, `count_in_duration`,
  `crossfade_assign`, `crossfader`, `current_monitoring_state`,
  `current_song_time`, `default_value`, `detail_clip`, `device_insert_mode`,
  `draw_mode`, `drum_pads`, `drum_pads_scroll_position`, `end_marker`,
  `fold_state`, `follow_song`, `gain`, `grid_is_triplet`, `grid_quantization`,
  `has_stop_button`, `highlighted_clip_slot`, `implicit_arm`,
  `input_routing_channel`, `input_routing_type`, `is_collapsed`,
  `is_enabled`, `is_playing`, `is_showing_chain_devices`,
  `is_showing_chains`, `length`, `loop`, `loop_end`, `loop_length`,
  `loop_start`, `looping`, `metronome`, `midi_recording_quantization`,
  `move_device`, `mute`, `muted`, `muted_via_solo`, `name`, `nudge_down`,
  `nudge_up`, `output_routing_channel`, `output_routing_type`, `overdub`,
  `pad_slicing`, `pitch_coarse`, `pitch_fine`, `position`, `punch_in`,
  `punch_out`, `record_mode`, `root_note`, `sample_length`, `scale_name`,
  `selected_chain`, `selected_drum_pad`, `selected_preset_index`,
  `selected_scene`, `selected_slice`, `selected_track`,
  `session_automation_record`, `session_record`, `slices`, `solo`,
  `start_marker`, `start_time`, `state`, `swing_amount`, `tempo`, `time`,
  `value`, `volume`, `warp_mode`.
- Song-level editing verbs observed in use: `create_audio_track`,
  `create_midi_track`, `create_return_track`, `create_scene`,
  `duplicate_scene`, `duplicate_track`, `delete_track`, `delete_scene`,
  `duplicate_clip_to`, `duplicate_clip_slot`, `duplicate_clip_to_arrangement`,
  `delete_clip`, `fire`, `stop_all_clips`, `jump_by`, `undo`, `redo`
  (e.g. `Push/actions.pyc`, `pushbase/actions.pyc`,
  `pushbase/song_utils.pyc`, `Launchpad_Pro/ActionsComponent.pyc`,
  `ableton/v2/control_surface/components/undo_redo.pyc`,
  `_Framework/ClipCreator.pyc`; `jump_by` in 30 places incl.
  `_Axiom/Transport.pyc`).

## 3. Control-surface framework architecture

Confidence: **high** — full class/method extraction (names + signatures).

### 3a. `_Framework` (legacy, per-script copies) — 59 modules, 172 classes, 1318 methods

Layering, bottom-up:

- **MIDI element layer**: `InputControlElement` (with `ParameterSlot`,
  `InputSignal`; methods `send_value`, `receive_value`, `connect_to`,
  `install_connections`, `begin_gesture`/`end_gesture`), `ButtonElement`,
  `EncoderElement` (+ touch/fine-grain variants), `SliderElement`,
  `ButtonMatrixElement`, `ButtonSliderElement`, `NotifyingControlElement`,
  `SysexValueControl`, `PhysicalDisplayElement`/`LogicalDisplaySegment`.
- **Element combinators**: `ComboElement` module (`WrapperElement`,
  `ComboElement`, `MultiElement`, `DoublePressElement`, `ToggleElement`,
  `EventElement`), `OptionalElement`/`ChoosingElement`, `CompoundElement`,
  `Proxy`, `Control` module (`ControlManager`, `MappedControl`,
  `ButtonControl`, `ToggleButtonControl`, `EncoderControl`, `PlayableControl`,
  `RadioButtonControl`, `ControlList`, `MatrixControl` — the modern
  declarative control layer used by APC64/mk3-era scripts).
- **Resources & modes**: `Resource` module (`ExclusiveResource`,
  `SharedResource`, `StackingResource`, `PrioritizedResource`,
  `CompoundResource`, `ProxyResource`), `Layer` (binding-by-name; `LayerMode`,
  `AddLayerMode`, `CompoundMode`, behaviour classes `LatchingBehaviour`,
  `ImmediateBehaviour`, `DelayMode`, ...), `ModesComponent` (+ `Skin`,
  `ToggleComponent`, `ScrollComponent`, `SlideComponent`).
- **Components** (`ControlSurfaceComponent` base: `__init__(self, name,
  register_component, song, layer, is_enabled, is_root, *a, **k)`,
  `update_all`, `on_track_list_changed`, `on_scene_list_changed`,
  `on_selected_track_changed`, `on_selected_scene_changed`):
  - `SessionComponent` (82 methods: `set_offsets`, `set_clip_launch_buttons`,
    `set_scene_launch_buttons`, `set_stop_track_clip_buttons`,
    `set_show_highlight`, `set_rgb_mode`, `track_offset`/`scene_offset`,
    linking via `_link`/`_unlink`) over `SceneComponent` (23) over
    `ClipSlotComponent` (38: `set_clip_slot`, `_do_launch_clip`,
    `_do_delete_clip`, `_do_duplicate_clip`, `_do_select_clip`,
    `_on_clip_color_changed`, ...).
  - `MixerComponent` (37) over `ChannelStripComponent` (41: `set_track`,
    `set_volume_control`, `set_arm_button`, `_on_input_routing_changed`, ...).
  - `DeviceComponent` (48: `set_device`, `_assign_parameters`,
    `_parameter_banks`, `_best_of_parameter_bank`) with `DeviceBankRegistry`.
  - `TransportComponent` (33: `set_play_button`, `set_record_button`,
    `set_tempo_control`, `_move_current_song_time`), 
    `SessionRecordingComponent`, `ClipCreator`, `DrumGroupComponent`,
    `DrumRackComponent`, `ViewControlComponent` (selected
    track/scene/detail navigation), `BackgroundComponent`,
    `ModeSelectorComponent`, `SessionZoomingComponent`.
- **Infrastructure**: `Task` module (TaskGroup, DelayTask, TimerTask, ...),
  `Signal`/`SubjectSlot` (listener machinery incl. `Subject` metaclass),
  `Dependency` (injection), `MessageScheduler`, `Profile`, `Defaults`,
  `MidiMap`, `Util`.
- **The surface base class** `_Framework/ControlSurface.pyc`:
  `ControlSurface` (68 methods) — the contract every script implements:
  `__init__(self, c_instance, *a, **k)`; host callbacks `receive_midi`,
  `build_midi_map`, `request_rebuild_midi_map`, `refresh_state`, `update`,
  `update_display`, `port_settings_changed`, `connect_script_instances`,
  `can_lock_to_devices`, `lock_to_device`/`unlock_from_device`,
  `restore_bank`, `suggest_input_port`/`suggest_output_port`,
  `suggest_map_mode`, `suggest_needs_takeover`, `set_pad_translations`,
  `set_feedback_channels`, `set_controlled_track`/
  `release_controlled_track`, `schedule_message`, `show_message`,
  `log_message`; internals `_send_midi`, `_install_mapping`,
  `_install_forwarding`, `_translate_message`, `_set_session_highlight`,
  `component_guard`; helpers `application()`, `song()` — the LOM entry
  points. `OptimizedControlSurface` subclasses it (3 methods).

### 3b. `ableton/v2` + `ableton/v3` (shared, current)

- `ableton/v2/base/` (13 modules, incl. `collection/`): `event` (Signal/Slot),
  `task`, `dependency`, `disconnectable`, `proxy`, `util`,
  **`live_api_utils`** (`liveobj_valid`, `liveobj_changed`,
  `is_parameter_bipolar`, `duplicate_clip_loop`, `move_current_song_time` —
  the canonical guards and helpers for holding LOM references across
  invalidation), `abl_signal`.
- `ableton/v2/control_surface/` (91 modules, incl. a `components/` layer of
  27 — `session`, `session_ring`, `session_navigation`, `session_overview`,
  `session_recording`, `channel_strip`, `mixer`, `device`,
  `device_navigation`, `device_parameters`, `drum_group`, `clip_actions`,
  `clip_slot`, `transport`, `undo_redo`, `view_control`, `scroll`,
  `slide`, `toggle`, `target_track`, `playable`, `accent`, `auto_arm`,
  `background`, `item_lister`): same roles as `_Framework` but shared and
  current. Key modules: `control_surface.py` (`SimpleControlSurface` 54
  methods implementing the same host contract as 3a, plus `ControlSurface`
  adding `device_provider`, `_init_device_provider`,
  `lock_to_device`/`unlock_from_device`), `component.py`, `layer.py`,
  `mode.py`, `skin.py`, `resource.py`, `input_control_element.py`,
  `device_parameter_bank.py`, `device_bank_registry.py`,
  `device_provider.py`, `device_chain_utils.py`, decorator factories for
  native devices (`device_decorator_factory`, `simpler_decoration`,
  `wavetable_decoration`, `drift_decoration`, `roar_decoration`,
  `internal_parameter` — wrapping the section-1 device classes),
  `banking_util.py`, `default_bank_definitions.py`, `capabilities.py`
  (`__live_api_version__`-style capability declaration),
  `identifiable_surface.py` (sysex product identification).
- `ableton/v3/` (114 modules — the current generation, used by newest
  scripts): `control_surface/` with `component_map`,
  `control_surface_specification`, `elements_base`, `identification`,
  `colors`, `parameter_info`, `parameter_mapping_sensitivities`,
  `device_decorators`, `instrument_finder`, `legacy_bank_definitions`,
  plus a `components/` layer of 40 — `clip_actions`, `clipboard`,
  `item_list`, `loop_selector`, `bar_based_sequence`, `step_sequence`,
  `note_editor`, `sliced_simpler`, `device_navigation`,
  `device_bank_navigation`, `device_parameters`, `session*`, `mixer`,
  `drum_group*`, `channel_strip`, `transport`, `recording`, `paginator`,
  `playhead`, `zoom`, `view_toggle`, ... — and **`live/action.py`**: the
  canonical editing-verb layer over the LOM: `delete(obj)` (dispatching per
  type: track/scene/clip/clip-slot/device/parameter return-state),
  `duplicate`, `select`, `fire(fireable, button_state)`,
  `toggle_arm(track, exclusive)`, `duplicate_loop(clip)`,
  `duplicate_clip_special(clip)`, `delete_notes_with_pitch(clip, pitch)`,
  `delete_notes_in_range(clip, from_time, time_span)`,
  `extend_loop_for_region(clip, region_start, region_length)`,
  `set_loop_start(clip, loop_start, show_loop)`, `set_loop_end(...)`,
  `set_loop_position(...)`, `toggle_or_cycle_parameter_value(parameter)`;
  it imports `Live.Clip`, `Live.ClipSlot`, `Live.DeviceParameter`,
  `Live.Scene`, `Live.Song`, `Live.Track`, `Live.Base.LimitationError` and
  references `Live.Song.Quantization` (in `duplicate_clip_special`).
  `v3 .../components/clip_actions.py` (`ClipActionsComponent`) wires these
  to buttons — `delete`, `duplicate`, `duplicate_loop`,
  `duplicate_clip_special`, `double_loop`, `quantize`, with
  `midi_recording_quantization` and `Quantization` enum members
  (`rec_q_no_q`, `rec_q_sixtenth`). This module pair is the closest existing
  template for M4+ session editing.

### 3c. A minimal script: `APC40_MkII` (case study)

`APC40_MkII/APC40_MkII.pyc` — single class `APC40_MkII(OptimizedControlSurface)`
built entirely from factories and layers: `from _APC.APC import APC`,
`_create_controls` (button/encoder factories with skins per function:
`Track_Control_%d`, `%d_Clip_%d_Button`, `Scene_%d_Launch_Button`,
`Device_Control_%d`...), then `Layer`-bound components `_create_session`,
`_create_mixer`, `_create_transport`, `_create_device`, `_create_view_control`,
`_create_quantization_selection`, `_create_recording`. Same shape as every
simple controller script; the shell can mirror this assembly pattern.

## 4. Max-for-Live device-control layer (`_MxDCore`) — the addressing model

Confidence: **high**. `_MxDCore` is how Live already exposes remote control
of the LOM to external clients; its vocabulary is what M4+ device control
should mirror.

- `_MxDCore/LomTypes.pyc` — the property table of section 1 plus type
  predicates: `is_lom_object`, `is_cplusplus_lom_object`, `is_control_surface`,
  `get_available_lom_types`, `get_available_properties_for_type`,
  `verify_object_property`; error types `LomAttributeError`,
  `LomObjectError`, `LomNoteOperationError`/`Warning`; root aliases
  `live_app`, `live_set`, `this_device`.
- `_MxDCore/LomUtils.pyc` — `LomInformation` (introspection producing
  `description`, `children`, `lists_of_children`, `functions`,
  `properties`), `LomIntrospection` (walks the `Live` package with
  `dir()`), `LomPathCalculator` (object -> path) and `LomPathResolver`
  (path -> object): paths are property/tuple component lists anchored at
  roots, navigating via `canonical_parent` and list indices — the same
  model as `live_set tracks 3 mixer_device volume`.
- `_MxDCore/MxDCore.pyc` — the command server: `path_set_path`, `path_goto`,
  `path_get_id`, `path_get_props`, `path_get_children`, `path_get_count`,
  `obj_set_id`/`obj_get_id`, `obj_get_path`, `obj_get_type`, `obj_get_info`,
  `obj_get`/`obj_set`/`obj_call`, `obs_set_id`/`obs_get_id`/`obs_set_prop`/
  `obs_get_prop`/`obs_bang` (observers, incl. listener installation on
  `_listenable_property_for`), `rmt_*`/`mod_*` (remote/modulator mapping
  via `register_timeable`/`unregister_timeable`), addressing by integer
  `lom_id` per device context (`_get_lom_object_by_lom_id`,
  `_get_lom_id_by_lom_object`, `appointed_lom_ids`), and the note/warp
  command handlers (`get_notes_extended`, `add_new_notes`,
  `apply_note_modifications`, `get_notes_by_id`, `duplicate_notes_by_id`,
  `replace_selected_notes`, `add_warp_marker`/`WarpMarker`).
- `_MxDCore/MxDControlSurfaceAPI.pyc` + `ControlSurfaceWrapper.pyc` —
  treating other control surfaces as LOM objects: `WrapperRegistry`,
  `ControlSurfaceWrapper` (`canonical_parent`, `type_name`,
  `control_names`, `grab_control`, `release_control`,
  `object_send_midi`, `object_grab_midi`/`object_release_midi`,
  `object_send_receive_sysex`), `LocalControlSurfaceWrapper`,
  `RemoteControlSurfaceWrapper`, `ControlProxy` (`send_value`,
  `receive_value`, `add_value_listener`).

## 5. Confidence and limitations

- Section 1 (class/property table): **high**. Recovered from Live's own
  registration table with evaluation-order replay; member names exact.
  The table does not encode types/arglists (M4L resolves those at runtime),
  and it is the *Max-for-Live-visible* subset: the C++ LOM may expose more
  (e.g. `Song.View` members beyond the 10 listed) — cross-check against the
  official LOM docs for the installed version before relying on an absence.
- Section 2 (usage evidence): **medium-high for names, low for receiver
  typing**. Attribute names are exact; which object they were accessed on is
  inferred. Counts are per-module distinct names, not call frequencies.
- Section 3 (framework): **high for names/signatures**. Signatures come from
  `varnames`+flags, so default values and kwarg names are not recovered.
- Section 4 (MxD): **high** for command names; handler semantics are
  inferred from call structure, not from running Live.
- Bytecode-only method: docstrings rarely survive as first-consts in this
  codebase (most modules are docstring-free), so member purpose is
  evidenced by usage context, not comments.
- Version caveat: everything is exact for 12.0.25 (2024-08-27). The same
  extraction re-run against another Live version is the way to diff the LOM.
- The lane brief's "Python 3.11" assumption is corrected: 12.0.25 embeds
  CPython 3.7 (magic 3394 in `MIDI Remote Scripts/**` and
  `App-Resources/Python/lib/**` alike).
