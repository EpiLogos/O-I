// The set-device faces by the element name the document stores, with their display titles: the stored-parameter editors
// registered in ./index.tsx. The Live chain renders one face per device on the selected track from this table (FOUNDATION F0:
// the chain is the track's devices, never the registry). A plain table, so reading it registers nothing and touches no DOM.
export const DEVICE_FACE_TITLES: ReadonlyMap<string, string> = new Map([
  ['GlueCompressor', 'Glue Compressor'],
  ['Echo', 'Echo'],
  ['Reverb', 'Reverb'],
  ['Compressor2', 'Compressor'],
  ['Overdrive', 'Overdrive'],
  ['Redux2', 'Redux'],
  ['Gate', 'Gate'],
  ['Erosion', 'Erosion'],
  ['Limiter', 'Limiter'],
  ['FilterDelay', 'Filter Delay'],
  ['BeatRepeat', 'Beat Repeat'],
  ['ChannelEq', 'Channel EQ'],
  ['FilterEQ3', 'EQ Three'],
  ['GrainDelay', 'Grain Delay'],
  ['PhaserNew', 'Phaser-Flanger'],
])
