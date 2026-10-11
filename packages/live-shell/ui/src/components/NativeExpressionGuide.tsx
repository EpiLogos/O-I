import {useEffect, useRef} from 'react'
import {ABOUT, BOUND_SHORTCUTS, QUICK_GUIDE, QUICK_GUIDE_STANDING} from './nativeExpressionCommands'
import './NativeExpressionGuide.css'

/** Help for the open Expression: the app's quick guide and About text, with the
 * shortcuts the shell binds. Escape or the close button dismisses it. */
export function NativeExpressionGuide({onClose}: {onClose: () => void}) {
  const dialog = useRef<HTMLElement>(null)
  useEffect(() => {dialog.current?.focus()}, [])
  return <section ref={dialog} className="native-expression-guide" role="dialog" aria-label="Expressions guide" tabIndex={-1}
    onKeyDown={event => {if (event.key === 'Escape') {event.preventDefault(); onClose()}}}>
    <header><h2>Quick guide</h2><button type="button" aria-label="Close guide" title="Close guide" onClick={onClose}>×</button></header>
    {QUICK_GUIDE.map(item => <article key={item.heading}><h3>{item.heading}</h3><p>{item.text}</p></article>)}
    <p className="native-expression-guide-standing">{QUICK_GUIDE_STANDING}</p>
    <h2>Shortcuts</h2>
    <dl className="native-expression-guide-keys">{BOUND_SHORTCUTS.map(row => <div key={row.keys}><dt><kbd>{row.keys}</kbd></dt><dd>{row.action}<small> · {row.source}</small></dd></div>)}</dl>
    <h2>About</h2>
    <h3>{ABOUT.title}</h3>
    <p>{ABOUT.lede}</p>
    <p>{ABOUT.living}</p>
    <p>{ABOUT.editable}</p>
    <p>{ABOUT.kept}</p>
  </section>
}
