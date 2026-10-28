// Templates in the one browser, under Material in every mode (manual §10.3: Material holds "sets and their templates"; "Choose Save Set as
// Template… … and the template stands in the browser with your sets. A new set started from it takes its tracks and its layout"; §16.7's
// Start from a template row). A row body under the browser's control (browserKinds.ts ControlledBrowser): the rows are the book's kept
// arrangements (templates.ts templatesOf), a press selects one and its preview — what it keeps — shows at the foot of the list, a
// double-click (or Enter) starts your set from it, and Save Set as Template… at the head keeps what is in front of you as a new one. The
// book is the one writer (continuity/workspace.tsx changeBook); every act is a pure change of it (templates.ts).
import {useState} from 'react'
import {createPortal} from 'react-dom'
import type {Workspace} from '../../../../../../desktop/cradle/src/workspace/store'
import {useOptionalContinuity} from '../../continuity/workspace'
import type {ControlledBrowser} from './browserKinds'
import {saveAsTemplate, startFromTemplate, templatesOf, templateWords} from './templates'
import {Icon} from '../../inhabitants/sdk/Icon'

export interface TemplateRowsViewProps {
  readonly templates: readonly Workspace[]
  readonly query: string
  readonly onStart: (id: string) => void
  readonly onSave: (name: string) => void
  /** The name Save Set as Template… offers: the set in front of you. */
  readonly setName?: string
  readonly selected?: string | null
  readonly onSelect?: (id: string) => void
  readonly previewHost?: HTMLElement | null
}

export function TemplateRowsView({templates, query, onStart, onSave, setName = '', selected = null, onSelect, previewHost = null}: TemplateRowsViewProps) {
  const [name, setName_] = useState<string | null>(null)
  const needle = query.trim().toLowerCase()
  const rows = needle ? templates.filter(template => template.name.toLowerCase().includes(needle)) : templates
  const chosen = templates.find(template => template.id === selected) ?? null
  const naming = name ?? setName
  return <div className="browser-results" data-browser-templates>
    <form className="browser-template-save" onSubmit={event => { event.preventDefault(); if (naming.trim()) { onSave(naming); setName_(null) } }}>
      <label><span className="sr-only">Template name</span>
        <input type="text" value={naming} placeholder="Template name" onChange={event => setName_(event.target.value)}
          data-i="Template name|The name the new template stands under in the browser." /></label>
      <button type="submit" disabled={!naming.trim()} data-action="save-template"
        data-i="Save Set as Template…|Keeps the arrangement in front of you — every mode's panes and the rail — as a template you can start a set from again. You stay in your set.">Save Set as Template…</button>
    </form>
    <div className="browser-list-heading">Name <span /></div>
    {rows.map(template => <button key={template.id} type="button" className="browser-item" aria-pressed={template.id === selected} data-template={template.id}
      title={templateWords(template)} data-i={`${template.name}|${templateWords(template)}`}
      onClick={() => onSelect?.(template.id)} onDoubleClick={() => onStart(template.id)}
      onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); onStart(template.id) } }}>
      <Icon name="arrangement" size={12} /><span>{template.name}</span>
    </button>)}
    {!templates.length && <p className="browser-empty">No template yet: Save Set as Template… keeps the arrangement in front of you as one.</p>}
    {templates.length > 0 && !rows.length && <p className="browser-empty">No template matches.</p>}
    {previewHost && chosen && createPortal(<p className="browser-empty" role="status">{templateWords(chosen)}</p>, previewHost)}
  </div>
}

/** The book's templates, under the browser's control. */
export function TemplateRows({controlled}: {controlled: ControlledBrowser}) {
  const continuity = useOptionalContinuity()
  const [selected, select] = useState<string | null>(null)
  if (!continuity) return <p className="browser-empty">The book of arrangements is not open in this window, so there are no templates to show.</p>
  const {book, changeBook} = continuity
  return <TemplateRowsView templates={templatesOf(book)} query={controlled.query} previewHost={controlled.previewHost} selected={selected} onSelect={select}
    setName={continuity.current.name}
    onStart={id => changeBook(next => startFromTemplate(next, id))}
    onSave={name => changeBook(next => saveAsTemplate(next, name, crypto.randomUUID()))} />
}
