/**
 * Builtin panel registration.
 *
 * Each module self-registers on import; this file is imported by main.tsx so
 * the shipped panels exist in the registry. Third-party panels register the
 * same way — see ui/PANELS.md.
 */

import './context'
import './expressions'
import './knowledge'
import './settings'

import './workbench'
import './agentShell'

// The device-face family: the generic stored-parameter editors (M3), which
// the Live chain renders one per device on the selected track, and the
// devices-pro faces, frozen as the corpus reference (FOUNDATION-AUDIT §E 1);
// its two generators stay in the browser's Legacy generators section. The
// devices-b2 faces kept local state and wrote nothing, so they are gone
// (FOUNDATION §7): the generic editor writes the same stored parameters.
import './devices'
import './devices-pro'
