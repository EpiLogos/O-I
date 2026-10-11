// World track adapter contract.
//
// A family projects its own reading into the Timeline projection's neutral
// shape: columns (time blocks, e.g. scenes), tracks (lanes, e.g. objects or
// automation), clips (spans placed in a column on a track), and optional
// transport material. The Timeline renders this shape; it knows no family.
//
// Pure TypeScript. No React, no family names.

export interface WorldTrackColumn {
  id: string;
  name: string;
}

export interface WorldTrack {
  id: string;
  name: string;
  // Lane kind, chosen by the family (e.g. 'entity', 'automation').
  kind: string;
}

export interface WorldTrackClip {
  id: string;
  trackId: string;
  columnId: string;
  label: string;
  // Column-local time span. Units are the family's own.
  span?: {start: number; end: number};
  state?: string;
}

// A transport take exposed by a family. Takes belong to the Transport stratum
// of the time spine. An adapter may expose them, but a take is never a clock
// and never a Timeline track.
export interface WorldTrackTake {
  id: string;
  target: string;
  name: string;
}

export interface WorldTrackSet {
  columns: WorldTrackColumn[];
  tracks: WorldTrack[];
  clips: WorldTrackClip[];
  transport?: {takes: WorldTrackTake[]};
}

export interface WorldTrackAdapter<T> {
  id: string;
  project(reading: T): WorldTrackSet;
}
