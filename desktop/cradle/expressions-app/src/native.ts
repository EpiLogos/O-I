/** The application: the native journey editor, the frame's one host of the field engine (O-I ticket 1008 retired the legacy workbench). */
import '../field-studies-journeys/src/styles.css';
import '../field-studies-journeys/src/workspace.css';
import {carryStorageFromHost} from '../../../../packages/expressions-boundary/src/storageCarry';

// The frame is served at an origin of its own (O-I #747 round 896, item 0.3), so what the person kept while it was served at the
// shell's origin is carried here once, before the application reads its storage (storageCarry.ts). It boots however the host answers.
// A carry left undone or not asked has its words (round 896, 1R-surface.1 and .2): the application says them once it stands.
void carryStorageFromHost().catch(() => undefined).then(outcome => {
  if (outcome?.said) (window as unknown as {__oiStorageCarrySaid?: string}).__oiStorageCarrySaid = outcome.said;
  return import('../field-studies-journeys/src/app');
});
