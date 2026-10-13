// Applying a walk stop's focus (T-TIMELINE-WALKS leg 3): the one place the Timeline and the Journey write when a stop is
// selected. An occasion goes to the spine through the caller's selectOccasion. A layer stop goes to the atlas's own epoch
// through the encounter bridge (AtlasProjectionPanel). Owners write, faces read: the atlas owns its camera, so this writes
// the atlas's linkable state and reads nothing back. Resolves to the named absence, or null when the focus stands.

import {jumpAtlasToLayerStop} from '../projections/atlas/AtlasProjectionPanel';
import type {TemporalEventRow} from './timeSpine';
import type {WalkStopFocus} from './journeyWalks';

export async function applyWalkStopFocus(
  focus: WalkStopFocus,
  selectOccasion: (event: TemporalEventRow) => void,
): Promise<string | null> {
  if (focus.kind === 'occasion') {
    selectOccasion(focus.event);
    return null;
  }
  if (focus.kind === 'absent') return focus.reason;
  const jump = await jumpAtlasToLayerStop(focus.layerId, focus.stopId);
  return jump ? null : 'The atlas holds no epoch for this stop. Its reading loads when the Earth pane opens.';
}
