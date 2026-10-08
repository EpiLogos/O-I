import {featuredExpressions, startingPoints} from '../../../../../desktop/cradle/expressions-app/field-studies-journeys/src/expressions'
import {collectionSections, FORK_REASON, type CollectionItem} from './nativeExpressionCommands'
import './NativeExpressionCollections.css'

let collectionItems: readonly CollectionItem[] | null = null
/** The app's own collections, read once: featuredExpressions() and startingPoints(). Both are pure data constructions. */
export function appCollectionItems(): readonly CollectionItem[] {
  if (!collectionItems) {
    const featured: CollectionItem[] = featuredExpressions().map(expression => ({id: expression.id, name: expression.name,
      description: expression.description ?? '', group: 'Featured'}))
    const starters: CollectionItem[] = startingPoints().map(point => ({id: point.id, name: point.expression.name,
      description: point.expression.description ?? '', group: point.group}))
    collectionItems = [...featured, ...starters]
  }
  return collectionItems
}

/** Read-only app collections in the Expressions browser. Nothing here opens:
 * every row's action is disabled, with its reason shown on the page. */
export function NativeExpressionCollections({query}: {query: string}) {
  const sections = collectionSections(appCollectionItems(), query)
  return <div className="native-expression-collections">
    {sections.map(section => <section key={section.id} className="world-collection" aria-label={section.title}>
      <h3>{section.title}</h3>
      {section.rows.length
        ? <ul>{section.rows.map(row => <li key={row.id} className="world-collection-row">
          <span className="world-collection-name">{row.name}</span>
          {row.description && <small className="world-collection-description">{row.description}</small>}
          <button type="button" disabled aria-label={`Open ${row.name} (unavailable)`} title={row.open.reason}>Open</button>
        </li>)}</ul>
        : <p className="native-empty">{query.trim() ? 'No collections match this search.' : 'None disclosed.'}</p>}
      {section.rows.length > 0 && <p className="native-empty world-collection-reason">{FORK_REASON}</p>}
    </section>)}
    <p className="native-empty world-collection-reason">Fork as variation and Remove saved copy need native owner operations, so the saved works above do not offer them.</p>
  </div>
}
