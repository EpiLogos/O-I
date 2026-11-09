/** Default application: the native journey editor. The original workbench remains at legacy.html. */
import '../field-studies-journeys/src/styles.css';
import '../field-studies-journeys/src/workspace.css';
import {carryStorageFromHost} from '../../../../packages/expressions-boundary/src/storageCarry';

// The frame is served at an origin of its own (O-I #747 round 896, item 0.3), so what the person kept while it was served at the
// shell's origin is carried here once, before the application reads its storage (storageCarry.ts). It boots however the host answers.
void carryStorageFromHost().catch(() => undefined).then(() => import('../field-studies-journeys/src/app'));
