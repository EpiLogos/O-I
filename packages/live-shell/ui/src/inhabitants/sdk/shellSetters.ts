/** The armed shell setters' runtime registry — the writers law's other half.
 *
 * The gate (`validate.ts`) checks that a `shell.<setter>` write path is
 * ARMED: carried by the verified address table or declared by the family
 * with an authority. Arming is the declaration half. This registry is the
 * runtime half: the shell REGISTERS the setter functions the armed rows
 * name, and a dispatch may fire a `shell.` path only through the registered
 * function. An armed-but-unregistered setter refuses with the setter's name
 * — the honest refusal the agent-native P0 ligament's aperture law demands
 * (never a fake fire, never a silent drop).
 *
 * The registry holds PRESENTATION-NEUTRAL dispatch functions: each returns
 * a receipt the calling surface renders. What a setter does inside (update
 * the shell's state, forward the value to the harness, or refuse naming the
 * owner op that is missing) is the setter's own honesty — the ligament's
 * wiring lives in `src/agent/shellSetterBridge.ts`, not here.
 *
 * Pure: no view, no store beyond this registry; resets with the door. */

import {onFamilyManifestReset} from '../familyManifest.ts'

/** The uniform receipt of one write dispatch, whatever channel carried it.
 * `fired` carries the owner's acknowledgement line (and the raw outcome for
 * the reading surfaces, folded); `refused` names the law and — where the
 * owner operation is missing — THE OP, so the next lane can land it. */
export type DispatchReceipt =
  | {kind: 'fired'; channel: 'kernel' | 'shell' | 'tool'; writePath: string; note: string; outcome?: unknown}
  | {kind: 'refused'; channel: 'kernel' | 'shell' | 'tool' | 'none'; writePath: string; reason: string; missingOp?: string}

export type ShellSetterDispatch = (value: unknown) => Promise<DispatchReceipt>

const setters = new Map<string, ShellSetterDispatch>()

onFamilyManifestReset(() => {
  setters.clear()
})

/** Register one armed setter under its `shell.<name>` path. Idempotent per
 * path (re-registration replaces — the shell owns its setters); the path
 * must carry the grammar's shape (`shell.<name>`). */
export function registerShellSetter(path: string, dispatch: ShellSetterDispatch): void {
  if (!/^shell\.[a-z][a-zA-Z0-9]*$/.test(path)) {
    throw new Error(`registerShellSetter("${path}") refuses — a setter path is shell.<name> (the write-path grammar)`)
  }
  setters.set(path, dispatch)
}

/** The registered dispatch of one `shell.` path, when the shell armed it
 * at runtime. Undefined = armed at the gate but not wired yet — the
 * caller refuses honestly naming the setter. */
export function shellSetter(path: string): ShellSetterDispatch | undefined {
  return setters.get(path)
}

/** Every registered setter path (the disclosure surfaces' membership check). */
export function registeredShellSetters(): readonly string[] {
  return [...setters.keys()]
}
