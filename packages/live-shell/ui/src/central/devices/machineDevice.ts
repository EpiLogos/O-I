// Machine's readings for the chain (DLW §18.7; machineBinding.ts): Central's five readings through invoke_action, held for the window.
// Refresh On open (the default) reads them when the device stands on the chain and again when the kernel says the ground moved; Manual
// reads only when you press Plan (or Verify, or the Recover page's Plan), and keeps what that press read until the next.
import {useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore} from 'react'
import {kernelRead} from '../../../../../../desktop/cradle/src/kernel/bridge'
import type {KernelTransportStatus} from '../../../../../../desktop/cradle/src/kernel/types'
import type {DesignBinding} from '../../frame/devices/designed'
import {actionAnswerOf, centralActionOp, type ActionAnswer} from './centralActions'
import {MACHINE_ACCOUNT_ACTION, MACHINE_DECLARATION_ACTION, MACHINE_DEVICE_ID, MACHINE_PLAN_ACTION, MACHINE_UNREAD, MACHINE_VERIFY_ACTION, RECOVERY_PLAN_ACTION,
  boundRoleOf, machineBinding, type MachineAnswers} from './machineBinding'
import {heldOf, holdsVersion, subscribeHolds} from './pageBindings'
import {useCentralActionAsked} from './useCentralReadings'

const ACTIONS: Readonly<Record<keyof MachineAnswers, string>> = {
  account: MACHINE_ACCOUNT_ACTION, declaration: MACHINE_DECLARATION_ACTION, plan: MACHINE_PLAN_ACTION, verify: MACHINE_VERIFY_ACTION, recovery: RECOVERY_PLAN_ACTION,
}

/** One of Central's readings asked afresh, for a press under Manual. */
async function readOnce(transport: KernelTransportStatus, action: string, input: Readonly<Record<string, unknown>>): Promise<ActionAnswer> {
  const call = await kernelRead(transport, centralActionOp(action, input), {fresh: true})
  return actionAnswerOf({status: call.error ? 'refused' : 'answered', value: call.outcome?.result === 'action_dispatched' ? call.outcome : null, error: call.error ?? null}, action)
}

export function useMachineDevice(transport: KernelTransportStatus, open: boolean): DesignBinding {
  useSyncExternalStore(subscribeHolds, holdsVersion, holdsVersion)
  const version = holdsVersion()
  const held = heldOf(MACHINE_DEVICE_ID)
  const manual = held.refresh === 'manual'
  const usable = transport.kind !== 'unavailable'
  const reads = open && usable && !manual
  const account = useCentralActionAsked(transport, MACHINE_ACCOUNT_ACTION, reads ? {} : null)
  const [pressed, setPressed] = useState<MachineAnswers | null>(null)
  // What a press read under Manual stands only while Manual does.
  useEffect(() => { if (!manual) setPressed(null) }, [manual])
  const shownAccount = manual ? pressed?.account ?? null : account.answer
  const role = typeof held.role === 'string' && held.role ? held.role : shownAccount?.status === 'answered' ? boundRoleOf(shownAccount.value) : null
  const input = useMemo(() => (reads && role ? {role} : null), [reads, role])
  const declaration = useCentralActionAsked(transport, MACHINE_DECLARATION_ACTION, input)
  const plan = useCentralActionAsked(transport, MACHINE_PLAN_ACTION, input)
  const verify = useCentralActionAsked(transport, MACHINE_VERIFY_ACTION, input)
  const recovery = useCentralActionAsked(transport, RECOVERY_PLAN_ACTION, input)
  const live = useMemo<MachineAnswers>(() => ({account: account.answer, declaration: declaration.answer, plan: plan.answer, verify: verify.answer, recovery: recovery.answer}),
    [account.answer, declaration.answer, plan.answer, verify.answer, recovery.answer])
  // Under Manual the device shows what the last press read, else what On open last read before Manual was chosen.
  const kept = useRef<MachineAnswers>(MACHINE_UNREAD)
  if (!manual) kept.current = live
  const shown = manual ? pressed ?? kept.current : live
  const shownRef = useRef(shown)
  shownRef.current = shown
  const ask = useCallback(async (which: readonly (keyof MachineAnswers)[]) => {
    if (!manual) {
      const again = {account: account.again, declaration: declaration.again, plan: plan.again, verify: verify.again, recovery: recovery.again}
      for (const key of which) again[key]()
      return
    }
    // Manual: the press reads, and what it read stands until the next press. The account comes first: it names the role by default.
    const base = shownRef.current
    const next: Record<keyof MachineAnswers, ActionAnswer> = {...base}
    if (which.includes('account')) next.account = await readOnce(transport, MACHINE_ACCOUNT_ACTION, {})
    const chosen = typeof heldOf(MACHINE_DEVICE_ID).role === 'string' ? heldOf(MACHINE_DEVICE_ID).role as string
      : next.account.status === 'answered' ? boundRoleOf(next.account.value) : null
    for (const key of which.filter(key => key !== 'account')) {
      next[key] = chosen ? await readOnce(transport, ACTIONS[key], {role: chosen}) : {status: 'refused', error: 'No role is chosen.'}
    }
    setPressed(next)
  }, [manual, transport, account.again, declaration.again, plan.again, verify.again, recovery.again])
  const asks = useMemo(() => (usable ? {
    replan: () => ask(['account', 'declaration', 'plan']),
    verify: () => ask(['verify']),
    recoveryPlan: () => ask(['recovery']),
  } : null), [usable, ask])
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the holds' version re-binds the view's own keys
  return useMemo(() => machineBinding(MACHINE_DEVICE_ID, shown, asks, open && usable && (!manual || pressed !== null)), [shown, asks, open, usable, manual, pressed, version])
}
