// The Expressions pane body (T-EXPRESSIONS-PANE-LEASE): the `projection.expressions` pane kind admitted through the cradle's
// projection module door (desktop/cradle/src/surface/projectionModules.ts), the door the Timeline pane (timelinePane.tsx) uses.
//
// The pane does not host a frame. The question is answered from code (the receipt): the kernel's native owner holds one active
// driver, so there is one lease and one frame. The one live frame (the centre panel's container, never re-parented) is drawn
// over this pane's slot while this pane holds the placement (framePlacement.ts, expressionsPaneHost.ts).
//
// The pane IS the field (the mockup's Expressions centre, world-shell-mockup.html:1716: "the field only — tools live in the
// Studio"; PATH §1: controls live in device UI, never as chrome inside a pane). The body is the slot only, edge to edge. Under the
// frame it draws one line saying what it waits for (no work open, or the application not yet reporting), so an empty frame never
// leaves a blank pane. When another Expressions pane holds the frame, this one says so; pressing it brings the frame here. The
// frame's faults stand at the slot's foot, with a Technē ask's refusal on the pane whose stage took it (techne/subject/askFault.ts).
// The stage's controls stand in the Studio's Tools and Capture sections
// (components/expressions/studio/StudioStage.tsx); orbit is a pointer drag on the stage, said in the pane's hover words.
//
// Lifecycle: the module mounts its React root into the pane element and admits the pane to the placement registry. Its handle's
// `setVisible` is the pane tier's concealment (the same observer every projection uses), so a tab switch or leaving Factory
// releases the frame from this pane. Unmount unregisters the pane at once and unmounts only its own root, after the commit that
// asked for it (the pane session tears down inside React's commit, and its container is the session's own). The pane holds no lease.

import {useLayoutEffect, useRef, type CSSProperties} from 'react'
import {createRoot} from 'react-dom/client'
import type {ProjectionModuleHandle} from '../../../../../desktop/cradle/src/surface/projectionModules'
import {
  attachExpressionsSlot, expressionsPaneAdmitted, preferExpressionsPane, registerExpressionsPane, setExpressionsPanePresented,
  unregisterExpressionsPane, useFramePlacement, useHostedChrome, useHostedExpressions, type ExpressionsPaneAdmission,
} from './expressionsPaneHost'
import {clearAskFault, useAskFault} from '../techne/subject/askFault'

// The kind's registration is light (projections/expressionsPaneRegistration.ts): it admits this module, which loads when an Expressions
// pane first opens (O-I #740).
export {EXPRESSIONS_MODULE_ID, registerExpressionsPaneHost} from './expressionsPaneRegistration'

/** The frame's reading as one line: the held expression's title and ref, or the honest state the reading stands in. It names the
 * pane in the Info view's hover words. */
export function expressionsHeading(reading: ReturnType<typeof useHostedExpressions>): string {
  if (reading === null) return 'Expressions: the hosted application has not reported its state yet'
  if (!reading.expression_ref) return 'Expressions: no native Expression open'
  return `${reading.title ?? reading.expression_ref} · ${reading.expression_ref}`
}

/** What an empty slot says it waits for — the heading's two honest states, with the way to the work — or null while a work is open
 * (then the field fills the slot and nothing is drawn under it). */
export function expressionsWaiting(reading: ReturnType<typeof useHostedExpressions>): string | null {
  if (reading === null) return 'The Expressions application has not reported its state yet.'
  if (!reading.expression_ref) return 'No Expression is open — open one from the browser\'s Expressions, or New.'
  return null
}

export const EXPRESSIONS_ELSEWHERE = 'Presented in the other Expressions pane.'
/** The pane's hover words beyond its reading: what the pane does when pressed, and orbit (a pointer drag, never a button). */
const ORBIT_WORDS = 'Orbit is a pointer drag on the stage itself, not a button; the stage\'s view and capture are in the Studio.'

/** The shell's empty idiom (styles.css .view-empty): one centred line, dim, on the stage's ground. */
const EMPTY_LINE: CSSProperties = {position: 'absolute', inset: 0, display: 'grid', placeContent: 'center', margin: 0, padding: 16, textAlign: 'center',
  fontSize: 11, lineHeight: 1.5, color: 'var(--text-dim)', pointerEvents: 'none'}
const FAULT_LINE: CSSProperties = {flex: 'none', margin: 0, padding: '3px 8px', borderTop: '1px solid var(--line)', background: 'var(--bg-1)',
  color: 'var(--rec)', fontSize: 10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}

/** The pane body: the slot the frame is drawn over while this pane holds it, edge to edge. `admission` is the module instance's
 * own (mountExpressionsPane); its slot notices reach only the record that admission holds. */
export function ExpressionsPaneBody({paneId, admission}: {paneId: string; admission?: ExpressionsPaneAdmission}) {
  const reading = useHostedExpressions()
  const chrome = useHostedChrome()
  const placement = useFramePlacement()
  const here = placement?.paneId === paneId
  const elsewhere = placement !== null && !here
  const slot = useRef<HTMLDivElement | null>(null)
  // The slot is this pane's rectangle for the frame. It is attached while the body is mounted and released when it leaves.
  useLayoutEffect(() => {
    attachExpressionsSlot(paneId, slot.current, admission)
    return () => attachExpressionsSlot(paneId, null, admission)
  }, [paneId, admission])
  const heading = expressionsHeading(reading)
  const waiting = elsewhere ? EXPRESSIONS_ELSEWHERE : expressionsWaiting(reading)
  // The frame's own faults, and a Technē ask's refusal when this is the pane whose stage took the ask and the frame stands in the
  // cut it took it in (askFault.ts): an ask's fault line is its pane's, never another mode's pane's.
  const askFault = useAskFault(paneId, chrome?.state?.hostMode)
  const faults = [...new Set([...(chrome?.faults ?? []), ...(askFault ? [askFault] : [])])]
  const words = elsewhere ? `${EXPRESSIONS_ELSEWHERE} Press this pane to bring the field here.` : `${heading}. ${ORBIT_WORDS}`
  return <div className="expressions-pane-body" data-expressions-presenter="true" data-frame-here={here ? 'true' : 'false'}
    data-i={`Expressions|${words}`} aria-label={heading} tabIndex={elsewhere ? 0 : undefined}
    onPointerDown={() => preferExpressionsPane(paneId)}
    onKeyDown={event => {if (elsewhere && (event.key === 'Enter' || event.key === ' ')) {event.preventDefault(); preferExpressionsPane(paneId)}}}
    style={{position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', minHeight: 0, background: 'var(--bg-0)'}}>
    <div ref={slot} className="expressions-frame-slot" data-frame-slot={here ? 'held' : 'free'} data-hosted-expression={reading?.expression_ref ?? undefined}
      style={{flex: '1 1 auto', minHeight: 0, position: 'relative'}}>
      {waiting && <p role="status" className="view-empty expressions-pane-waiting" style={EMPTY_LINE}>{waiting}</p>}
    </div>
    {faults.length > 0 && <p role="alert" className="inhabitant-fault expressions-pane-fault" title={faults.join('\n')} style={FAULT_LINE}>{faults.join(' · ')}</p>}
  </div>
}

/** Mount the body into a pane element. The module owns the element's content and leaves it clean on unmount. */
export function mountExpressionsPane(element: HTMLElement, paneId: string): ProjectionModuleHandle {
  // This instance's own admission: a second instance of the same pane (StrictMode, a remount in one commit) takes the record
  // over, and this one's late unmount and notices no longer reach it (expressionsPaneHost.ts registerExpressionsPane).
  const admission = registerExpressionsPane(paneId, {})
  const root = createRoot(element)
  root.render(<ExpressionsPaneBody paneId={paneId} admission={admission} />)
  return {
    unmount: () => {
      unregisterExpressionsPane(paneId, admission)
      // The pane leaves (its instrument changed, or it closed): an ask's fault it held leaves with it. A later instance of the same
      // pane that took the record over (a remount in one commit) keeps it.
      if (!expressionsPaneAdmitted(paneId)) clearAskFault(paneId)
      queueMicrotask(() => root.unmount())
    },
    setVisible: visible => setExpressionsPanePresented(paneId, visible, admission),
  }
}

