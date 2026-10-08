import {useEffect, useRef, type SyntheticEvent} from 'react'
import type {AgentSubject} from '../../../../../desktop/cradle/src/agent/AgentLayer'
import {PreparedContextView} from '../../../../../desktop/cradle/src/context/PreparedContextView'
import {useEncounterSession} from '../../../../../desktop/cradle/src/encounter/session'
import {preparedContextCurrent, preparedContextScopeKey, preparedContextSession, readDeliveredContext, type NativePreparedContextScope} from '../native/preparedContextBinding'

export interface NativePreparedContextProps {
  scope: NativePreparedContextScope
  current: () => boolean
  onOpenSubject?: (subject: AgentSubject) => void
}
export function NativePreparedContext(props: NativePreparedContextProps) {
  let key: string
  try { key = preparedContextScopeKey(props.scope) }
  catch (error) { return <p className="native-error" role="alert">{String(error)}</p> }
  return <ScopedPreparedContext key={key} {...props}/>
}
function ScopedPreparedContext({scope, current, onOpenSubject}: NativePreparedContextProps) {
  const region = useRef<HTMLElement>(null)
  const mounted = useRef(false)
  const latest = useRef({scope, current, onOpenSubject})
  latest.current = {scope, current, onOpenSubject}
  const key = preparedContextScopeKey(scope)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const qualified = () => preparedContextCurrent(latest.current.scope, key, latest.current.current, mounted.current, !!region.current?.getClientRects().length)
  const session = useEncounterSession(current() ? preparedContextSession(scope) : undefined)
  let receipts: ReturnType<typeof readDeliveredContext>
  let receiptError: string | undefined
  try { receipts = readDeliveredContext(scope, session?.state.reading) }
  catch (error) { receiptError = String(error) }
  const guard = (event: SyntheticEvent) => { if (!qualified()) { event.preventDefault(); event.stopPropagation() } }
  const reveal = (subject: AgentSubject) => { if (qualified()) latest.current.onOpenSubject?.(subject) }
  if (!current()) return <p className="native-empty">The context destination is no longer presented.</p>
  return <section ref={region} aria-label="Prepared and delivered agent context" onClickCapture={guard} onKeyDownCapture={guard} onSubmitCapture={guard}>
    <PreparedContextView project={scope.project} session={scope.accompanying?.ref} sourceWorldRef={scope.sourceWorldRef} onOpenSubject={onOpenSubject ? reveal : undefined}/>
    <section aria-label="Delivered context"><h3>Delivered</h3>
      {!scope.accompanying && <p className="native-empty">Select a retained conversation to inspect what it received.</p>}
      {scope.accompanying && receipts === undefined && !receiptError && <p className="native-empty">The native conversation has not disclosed delivered-context receipts.</p>}
      {receiptError && <p className="native-error" role="alert">{receiptError}</p>}
      {receipts?.length === 0 && <p className="native-empty">No prepared context was delivered in this native reading.</p>}
      {receipts && receipts.length > 0 && <ol>{receipts.map((receipt, index) => <li key={`${receipt.cursor}:${receipt.digest}:${index}`}>
        <p>{receipt.standing}</p><ul>{receipt.items.map(item => <li key={item.id}>{item.title}</li>)}</ul>
        <details><summary>Delivery provenance · cursor {receipt.cursor}</summary><dl><dt>Digest</dt><dd>{receipt.digest}</dd><dt>Context revision</dt><dd>{receipt.revision}</dd></dl>
          <ul>{receipt.items.map(item => <li key={item.id}>{item.id} · {item.source_ref}{item.source_revision !== undefined ? ` · ${item.source_revision}` : ''}</li>)}</ul>
        </details>
      </li>)}</ol>}
    </section>
  </section>
}
