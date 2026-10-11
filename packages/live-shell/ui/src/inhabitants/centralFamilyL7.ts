/** The L7 additive extension onto the central family (ticket L7; the L2
 * declared-extension grammar — `declareFamilyExtension`, never a rewrite of
 * the door or of `worldShellFamilies.ts`'s owner sections).
 *
 * What this lane adds, and why only this:
 * - The L2 extension already declared the family's faces (`ground-hygiene`,
 *   `impact`, `day-die`, `flow-document`, `nara-conversation`). L7's devices
 *   EXTEND those declared faces — they give `ground-hygiene` and `impact`
 *   their bodies (CentralHygieneDevice, CentralImpactDevice) and bind the
 *   day/now craft — they do not re-declare them (the door refuses
 *   collisions, rightly).
 * - The one genuinely new face is `day-now`: the civil stratum's temporal
 *   controls (day close, rollover, archive recovery) as DECLARED controls
 *   bound to their native actions (§15.2: "day operations are
 *   Central-family devices"), beside the document devices the L2 extension
 *   declared. It is a parameter-kind face whose body renders the declared
 *   controls and the civil reading; it mutates nothing.
 *
 * Loading is the host's concern: `declareCentralFamilyL7()` is idempotent
 * through the door's own law (a second identical declaration composes the
 * same extension and changes nothing). */

import {declareFamilyExtension} from './manifest.ts'
import {CIVIL_TEMPORAL_CONTROLS} from './centralDayNowModel.ts'

export const CENTRAL_FAMILY_L7_EXTENSION_ID = 'central:world-shell-l7'

/** The day/now face's control note is generated from the declared controls
 * so the manifest and the model cannot drift. */
function dayNowNote(): string {
  const bound = CIVIL_TEMPORAL_CONTROLS
    .map(control => `${control.label} → ${control.nativeAction.split(' (')[0]}`)
    .join(' · ')
  return `The civil stratum as declared temporal controls: ${bound}. Each names its native action, its authority (CENTRAL_NATIVE_TOKEN-gated lifecycle mutations) and its receipt — declared, waiting, never fired from a device or a lane. The civil reading stands on the kernel's temporal read; the policy row is the owner's civil-time contract carried verbatim.`
}

/** Declare the L7 extension. Returns the declared extension (the door's own
 * identity law makes a second call a no-op returning the same extension). */
export function declareCentralFamilyL7(): ReturnType<typeof declareFamilyExtension> {
  return declareFamilyExtension('central', {
    id: CENTRAL_FAMILY_L7_EXTENSION_ID,
    by: 'zcode:central-family-l7 (ticket L7, owner commission, WORLD-SHELL-DESIGN §12/§15)',
    faces: [
      {
        id: 'day-now',
        presentations: ['compact', 'expanded'],
        note: dayNowNote(),
      },
    ],
    note: 'L7 extension: the day/now civil craft. The ground-hygiene and impact bodies live in the L7 device modules (centralHygieneDevice.ts, centralImpactDevice.ts) and extend the L2-declared faces — this extension adds only what L2 did not already declare.',
  })
}
