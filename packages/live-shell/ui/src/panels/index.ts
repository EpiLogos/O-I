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

// The device-face family (M3 — Glue/Echo/Reverb generic editors, the 12
// devices-b2 ports, the devices-pro faces and racks). Each module
// self-registers; the family renders in the live-mode detail host
// (DeviceChainPanel's bottom slot — the one mounted panel host in live
// mode, per the integration map's host decision: the frame's dock residence
// belongs to the Rev 4 mode context dock, so no second right-dock host is
// mounted).
import './devices'
import './devices-b2'
import './devices-pro'
