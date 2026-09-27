import type {SurfaceBinding} from '../surface/types';
import {PointCloudHost} from '../expressions/PointCloudHost';

/** The personal entrance opens depth inside the actual Expression application. */
export function PersonalSurface({binding}:{binding:SurfaceBinding}) {
  return <PointCloudHost bindingId={binding.id} project={binding.project}
    deepLink={binding.ref?.startsWith('expression:') ? binding.ref : undefined}
    entryInstrument="nara"/>;
}
