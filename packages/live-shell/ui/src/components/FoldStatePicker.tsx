/** Fold a selected state into an earlier Scene's formation (app.ts 'fold-state' and 'confirm-fold'). Two inline steps and no
 * window.confirm: "Fold into earlier object…" opens the destination and playback choice; "Review fold" states what will be
 * added, and only "Confirm fold" sends the one state-fold change. The owner's refusal shows in a role="alert" line. */
import {useEffect, useRef, useState} from 'react'
import type {NativeEditorReading, NativeEditorReply, NativeEditorRequest, NativeFoldChange, NativeFoldTarget} from '../../../../expressions-boundary/src/editor'
import {FOLD_MODES} from '../../../../expressions-boundary/src/nativeStateFold'

export type FoldMode = (typeof FOLD_MODES)[number]
export type FoldStage = 'closed' | 'choose' | 'confirm'
/** The app's fold dialog labels (app.ts 'fold-mode' options). */
export const FOLD_MODE_LABELS: Readonly<Record<FoldMode, string>> = {seconds: 'Seconds · hold and transition', morph: 'Morph cycles', manual: 'Manual blend'}

/** The one admitted change for a fold: the selected state, the chosen destination and its options. */
export function foldChange(entityId: string, stepId: string, target: NativeFoldTarget, mode: FoldMode, removeSource: boolean): NativeFoldChange {
  return {kind: 'state-fold', entity_id: entityId, step_id: stepId, target_entity_id: target.entity_id, mode, remove_source: removeSource}
}
/** A destination is named by its Scene and formation, since a formation name can repeat across Scenes. */
export const foldDestinationKey = (target: NativeFoldTarget) => `${target.scene_id}|${target.entity_id}`
export const foldDestinationLabel = (target: NativeFoldTarget) => `${target.scene_title} / ${target.entity_name}`

export interface FoldStateViewProps {
  stage: FoldStage;
  targets: readonly NativeFoldTarget[];
  destination: string;
  mode: FoldMode;
  removeSource: boolean;
  stateLabel: string;
  sourceName: string;
  disabled: boolean;
  pending: boolean;
  fault: string | null;
  onStage: (stage: FoldStage) => void;
  onDestination: (key: string) => void;
  onMode: (mode: FoldMode) => void;
  onRemoveSource: (value: boolean) => void;
  onConfirm: () => void;
}

/** Every stage renders from props, so the two-step markup is testable without a live stage. */
export function FoldStateView(props: FoldStateViewProps) {
  const {stage, targets, destination, mode, removeSource, stateLabel, sourceName, disabled, pending, fault} = props
  const chosen = targets.find(target => foldDestinationKey(target) === destination)
  const alert = fault ? <p role="alert" className="glyph-option-alert">{fault}</p> : null
  if (stage === 'closed') return <div className="fold-state">
    <button type="button" disabled={disabled || targets.length === 0}
      title={targets.length ? 'Copy this state into an earlier Scene’s formation' : 'No earlier Scene has an unlocked formation with room for another state'}
      onClick={() => props.onStage('choose')}>Fold into earlier object…</button>{alert}
  </div>
  if (stage === 'choose') return <div className="fold-state" role="group" aria-label="Fold this state">
    <label>Destination<select aria-label="Fold destination" value={destination} disabled={disabled} onChange={event => props.onDestination(event.target.value)}>
      {targets.map(target => <option key={foldDestinationKey(target)} value={foldDestinationKey(target)}>{foldDestinationLabel(target)}</option>)}</select></label>
    <label>Play these states with<select aria-label="Fold playback" value={mode} disabled={disabled} onChange={event => props.onMode(event.target.value as FoldMode)}>
      {FOLD_MODES.map(option => <option key={option} value={option}>{FOLD_MODE_LABELS[option]}</option>)}</select></label>
    <label className="glyph-switch"><input type="checkbox" checked={removeSource} disabled={disabled} onChange={event => props.onRemoveSource(event.target.checked)} />Remove this state here after adding</label>
    <button type="button" disabled={disabled || !chosen} onClick={() => props.onStage('confirm')}>Review fold</button>
    <button type="button" onClick={() => props.onStage('closed')}>Cancel</button>{alert}
  </div>
  return <div className="fold-state" role="group" aria-label="Confirm fold">
    <p>Copy {stateLabel} of {sourceName} into {chosen ? foldDestinationLabel(chosen) : 'the chosen formation'}. It adds one state to that formation’s sequence{removeSource ? ', and this state is removed from here' : ''}. Undo restores it.</p>
    <button type="button" disabled={disabled || pending || !chosen} onClick={() => props.onConfirm()}>Confirm fold</button>
    <button type="button" disabled={pending} onClick={() => props.onStage('choose')}>Back</button>{alert}
  </div>
}

/** Stateful wrapper: the choices, the stage and the single apply. The apply is on the basis read at confirmation, so a stale view is refused by the owner. */
export function FoldStatePicker({reading, request, entityId, stepId, stepIndex, disabled, isPresented}: {reading: NativeEditorReading; request: (request: NativeEditorRequest) => Promise<NativeEditorReply>; entityId: string; stepId: string; stepIndex: number; disabled: boolean; isPresented?: () => boolean}) {
  const [stage, setStage] = useState<FoldStage>('closed'), [destination, setDestination] = useState(''), [mode, setMode] = useState<FoldMode>('seconds')
  const [removeSource, setRemoveSource] = useState(false), [fault, setFault] = useState<string | null>(null), [pending, setPending] = useState(false)
  const mounted = useRef(true)
  useEffect(() => {mounted.current = true; return () => {mounted.current = false}}, [])
  useEffect(() => {setStage('closed'); setFault(null); setPending(false)}, [entityId, stepId, reading.basis.expression_ref, reading.basis.scene_ref])
  const targets = reading.foldTargets ?? []
  const entity = reading.scene.entities.find(row => row.id === entityId)
  const open = (stage: FoldStage) => {
    if (stage === 'choose' && !targets.some(target => foldDestinationKey(target) === destination)) setDestination(targets[0] ? foldDestinationKey(targets[0]) : '')
    setFault(null); setStage(stage)
  }
  const confirm = async () => {
    const chosen = targets.find(target => foldDestinationKey(target) === destination)
    if (!chosen || pending) return
    setPending(true); setFault(null)
    try {
      const reply = await request({operation: 'apply', basis: reading.basis, changes: [foldChange(entityId, stepId, chosen, mode, removeSource)]})
      if (!mounted.current || isPresented?.() === false) return
      if (reply.ok) setStage('closed'); else setFault(reply.error)
    } catch (cause) {
      if (mounted.current) setFault(cause instanceof Error ? cause.message : String(cause))
    } finally {
      if (mounted.current) setPending(false)
    }
  }
  return <FoldStateView stage={stage} targets={targets} destination={destination} mode={mode} removeSource={removeSource}
    stateLabel={`State ${stepIndex + 1}`} sourceName={entity?.name ?? 'this formation'} disabled={disabled} pending={pending} fault={fault}
    onStage={open} onDestination={setDestination} onMode={setMode} onRemoveSource={setRemoveSource} onConfirm={() => void confirm()} />
}
