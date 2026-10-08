/**
 * Builtin panel registration.
 *
 * Each module self-registers on import; this file is imported by main.tsx so
 * the shipped panels exist in the registry. Third-party panels register the
 * same way — see ui/PANELS.md.
 */

import './inspector'
import './clock'
import './devices'
import './devices-b2'
