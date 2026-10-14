// The Expressions pane body (T-EXPRESSIONS-PANE-LEASE): the `projection.expressions` pane kind admitted through the cradle's
// projection module door (desktop/cradle/src/surface/projectionModules.ts), the door the Timeline pane (timelinePane.tsx) uses.
//
// The pane does not host a frame. The question is answered from code (the receipt): the kernel's native owner holds one active
// driver, so there is one lease and one frame. The one live frame (the centre panel's container, never re-parented) is drawn
// over this pane's slot while this pane holds the placement (framePlacement.ts, expressionsPaneHost.ts). The body is the
// placeholder: a header line (the frame's reading, by value), the frame's own chrome, "Show in the centre", and the slot the
// frame fills. When another Expressions pane holds the frame, this one says so and offers to move it here.
//
// Lifecycle: the module mounts its React root into the pane element and admits the pane to the placement registry. Its handle's
// `setVisible` is the pane tier's concealment (the same observer every projection uses), so a tab switch or leaving Factory
// releases the frame from this pane. Unmount unregisters the pane and unmounts only its own root. The pane holds no lease.

import {useLayoutEffect, useRef} from 'react'
import {createRoot} from 'react-dom/client'
import {registerProjectionModule, type ProjectionModuleHandle} from '../../../../../desktop/cradle/src/surface/projectionModules'
import {NativeStageTools} from '../components/NativeStageTools'
import {
  attachExpressionsSlot, preferExpressionsPane, presentHostedExpressions, registerExpressionsPane, setExpressionsPanePresented,
  unregisterExpressionsPane, useFramePlacement, useHostedChrome, useHostedExpressions,
} from './expressionsPaneHost'

export const EXPRESSIONS_MODULE_ID = 'expressions-hosted-presenter'

/** The header's reading line: the held expression's title and ref, or the honest state the reading stands in. */
export function expressionsHeading(reading: ReturnType<typeof useHostedExpressions>): string {
  if (reading === null) return 'Expressions: the hosted application has not reported its state yet'
  if (!reading.expression_ref) return 'Expressions: no native Expression open'
  return `${reading.title ?? reading.expression_ref} · ${reading.expression_ref}`
}

/** The pane body. The slot is the placeholder the frame is drawn over while this pane holds it. */
export function ExpressionsPaneBody({paneId}: {paneId: string}) {
  const reading = useHostedExpressions()
  const chrome = useHostedChrome()
  const placement = useFramePlacement()
  const here = placement?.paneId === paneId
  const elsewhere = placement !== null && !here
  const slot = useRef<HTMLDivElement | null>(null)
  // The slot is this pane's rectangle for the frame. It is attached while the body is mounted and released when it leaves.
  useLayoutEffect(() => {
    attachExpressionsSlot(paneId, slot.current)
    return () => attachExpressionsSlot(paneId, null)
  }, [paneId])
  return <div className="expressions-pane-body" data-expressions-presenter="true" data-frame-here={here ? 'true' : 'false'}
    onPointerDown={() => preferExpressionsPane(paneId)}
    style={{position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', minHeight: 0, padding: '6px 8px', gap: 6, boxSizing: 'border-box'}}>
    <header style={{display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, flex: 'none'}}>
      <span data-hosted-expression={reading?.expression_ref ?? undefined} style={{fontSize: 12, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
        {expressionsHeading(reading)}
      </span>
      <button type="button" onClick={() => presentHostedExpressions()}>Show in the centre</button>
      {elsewhere && <button type="button" onClick={() => preferExpressionsPane(paneId)}>Show here</button>}
    </header>
    {chrome?.faults.map(text => <p key={text} role="alert" className="inhabitant-fault" style={{margin: 0, flex: 'none'}}>{text}</p>)}
    <div style={{flex: 'none'}}>
      <NativeStageTools state={chrome?.state ?? null} run={chrome?.run ?? null} />
    </div>
    <div ref={slot} className="expressions-frame-slot" data-frame-slot={here ? 'held' : 'free'} style={{flex: '1 1 auto', minHeight: 0, position: 'relative'}}>
      {elsewhere && <p role="status" style={{margin: 0, padding: 8, fontSize: 12}}>Presented in the other Expressions pane.</p>}
    </div>
  </div>
}

/** Mount the body into a pane element. The module owns the element's content and leaves it clean on unmount. */
function mountExpressionsPane(element: HTMLElement, paneId: string): ProjectionModuleHandle {
  registerExpressionsPane(paneId)
  const root = createRoot(element)
  root.render(<ExpressionsPaneBody paneId={paneId} />)
  return {
    unmount: () => {
      unregisterExpressionsPane(paneId)
      root.unmount()
    },
    setVisible: visible => setExpressionsPanePresented(paneId, visible),
  }
}

let registered = false

/** Admit the Expressions body for the `projection.expressions` pane kind. Called once, from the centre's panel module
 * (panels/expressions.tsx), which owns the one hosted frame the pane presents. */
export function registerExpressionsPaneHost(): void {
  if (registered) return
  registered = true
  registerProjectionModule({id: EXPRESSIONS_MODULE_ID, kind: 'projection.expressions', create: context => mountExpressionsPane(context.element, context.binding.id)})
}
